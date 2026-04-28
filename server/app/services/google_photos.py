"""
Google Photos Picker API integration.

Flow:
  1. User hits GET /api/google/auth  → browser redirected to Google OAuth
  2. Google redirects back to GET /api/google/callback  → token saved
  3. POST /api/google/picker-session  → creates a Picker session, returns pickerUri
  4. User opens pickerUri, selects photos/albums, closes Google UI
  5. POST /api/google/import  → background thread downloads & saves photos
  6. Frontend polls GET /api/google/import/status  → tracks progress
"""

import json
import secrets
import tempfile
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests as http
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from ..config import settings
from ..models import Photo
from . import photos as svc

# ── Constants ─────────────────────────────────────────────────────────────────

SCOPES = ["https://www.googleapis.com/auth/photospicker.mediaitems.readonly"]
PICKER_BASE = "https://photospicker.googleapis.com/v1"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

# Session considered stale after 50 min (base URLs expire at 60 min)
SESSION_TTL_SECONDS = 50 * 60


# ── Module-level singletons ───────────────────────────────────────────────────

@dataclass
class PickerSession:
    id: str
    picker_uri: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ImportJob:
    session_id: str
    status: str = "running"   # running | done | error
    total: int = 0
    done: int = 0
    imported: int = 0
    skipped: int = 0
    error: Optional[str] = None
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None


_picker_session: Optional[PickerSession] = None
_current_job: Optional[ImportJob] = None


# ── Token file helpers ────────────────────────────────────────────────────────

def _token_path() -> Path:
    return Path(settings.db_path).parent / "google_token.json"


def _redirect_uri() -> str:
    # Must match exactly what's registered in Google Cloud Console
    return "https://photoframe.local/api/google/callback"


# ── Public API ────────────────────────────────────────────────────────────────

def is_configured() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


def is_authorized() -> bool:
    """Return True if a valid (or refreshable) token file exists."""
    creds = _load_credentials()
    return creds is not None


def get_auth_url(state: str) -> str:
    """Generate the Google OAuth authorization URL."""
    flow = _make_flow()
    flow.redirect_uri = _redirect_uri()
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return url


def exchange_code(code: str) -> None:
    """Exchange an authorization code for tokens and save to disk."""
    flow = _make_flow()
    flow.redirect_uri = _redirect_uri()
    flow.fetch_token(code=code)
    _save_credentials(flow.credentials)


def revoke() -> None:
    """Delete stored tokens (disconnect Google account)."""
    global _picker_session, _current_job
    p = _token_path()
    if p.exists():
        p.unlink()
    _picker_session = None
    _current_job = None


def create_picker_session() -> PickerSession:
    """Create a new Google Photos Picker session (or return a fresh cached one)."""
    global _picker_session

    # Reuse if still fresh
    if _picker_session:
        age = (datetime.now(timezone.utc) - _picker_session.created_at).total_seconds()
        if age < SESSION_TTL_SECONDS:
            return _picker_session

    creds = _require_credentials()
    resp = http.post(
        f"{PICKER_BASE}/sessions",
        headers=_auth_headers(creds),
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    _picker_session = PickerSession(
        id=data["id"],
        picker_uri=data["pickerUri"],
    )
    return _picker_session


def get_picker_session() -> Optional[PickerSession]:
    return _picker_session


def clear_picker_session() -> None:
    global _picker_session
    _picker_session = None


def get_current_job() -> Optional[ImportJob]:
    return _current_job


def start_import(session_id: str, session_factory) -> ImportJob:
    """
    Kick off a background import for the given Picker session.
    Raises ValueError if an import is already running.
    """
    global _current_job

    if _current_job and _current_job.status == "running":
        raise ValueError("Import already running")

    job = ImportJob(session_id=session_id)
    _current_job = job

    t = threading.Thread(target=_run_import, args=(job, session_factory), daemon=True)
    t.start()
    return job


# ── Internal helpers ──────────────────────────────────────────────────────────

def _make_flow() -> Flow:
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uris": [_redirect_uri()],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": TOKEN_ENDPOINT,
        }
    }
    return Flow.from_client_config(client_config, scopes=SCOPES)


def _save_credentials(creds: Credentials) -> None:
    _token_path().write_text(creds.to_json())


def _load_credentials() -> Optional[Credentials]:
    p = _token_path()
    if not p.exists():
        return None
    try:
        info = json.loads(p.read_text())
        creds = Credentials.from_authorized_user_info(info, SCOPES)
        return creds
    except Exception:
        return None


def _require_credentials() -> Credentials:
    """Load credentials, refreshing the access token if needed."""
    creds = _load_credentials()
    if creds is None:
        raise RuntimeError("Not authorized — complete OAuth flow first")

    if creds.expired and creds.refresh_token:
        import google.auth.transport.requests as g_requests
        creds.refresh(g_requests.Request())
        _save_credentials(creds)

    return creds


def _auth_headers(creds: Credentials) -> dict:
    return {"Authorization": f"Bearer {creds.token}"}


# ── Background import worker ──────────────────────────────────────────────────

def _run_import(job: ImportJob, session_factory) -> None:
    try:
        creds = _require_credentials()
        headers = _auth_headers(creds)

        # 1. Verify session has items selected
        resp = http.get(
            f"{PICKER_BASE}/sessions/{job.session_id}",
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        session_data = resp.json()

        if not session_data.get("mediaItemsSet"):
            raise RuntimeError(
                "No photos selected yet — finish selecting in the Google picker, then try again."
            )

        # 2. Paginate through all selected media items
        items = []
        page_token = None
        while True:
            params: dict = {"pageSize": 100}
            if page_token:
                params["pageToken"] = page_token
            r = http.get(
                f"{PICKER_BASE}/sessions/{job.session_id}/mediaItems",
                headers=headers,
                params=params,
                timeout=15,
            )
            r.raise_for_status()
            data = r.json()
            items.extend(data.get("mediaItems", []))
            page_token = data.get("nextPageToken")
            if not page_token:
                break

        job.total = len(items)

        # 3. Download and save each item
        db = session_factory()
        try:
            for item in items:
                try:
                    _process_item(item, db, job)
                except Exception as item_err:
                    # Log the failure but keep going
                    print(f"[google_import] skipping item {item.get('id')}: {item_err}")
                    job.skipped += 1
                    job.done += 1
        finally:
            db.close()

        job.status = "done"
        job.finished_at = datetime.now(timezone.utc)

    except Exception as exc:
        job.status = "error"
        job.error = str(exc)
        job.finished_at = datetime.now(timezone.utc)


def _process_item(item: dict, db, job: ImportJob) -> None:
    media_file = item.get("mediaFile", {})
    mime_type: str = media_file.get("mimeType", "")
    base_url: str = media_file.get("baseUrl", "")
    filename: str = media_file.get("filename", "photo.jpg")

    # Skip non-images (videos, etc.)
    if not mime_type.startswith("image/"):
        job.skipped += 1
        job.done += 1
        return

    # Download raw bytes (=d suffix = full download)
    img_resp = http.get(f"{base_url}=d", timeout=120)
    img_resp.raise_for_status()
    data = img_resp.content

    # Dedup check
    file_hash = svc.compute_hash(data)
    if db.query(Photo).filter(Photo.file_hash == file_hash).first():
        job.skipped += 1
        job.done += 1
        return

    # Process through existing pipeline using a temp file (Pillow needs a real path)
    suffix = Path(filename).suffix.lower() or ".jpg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(data)
        tmp.close()
        tmp_path = Path(tmp.name)

        exif = svc.extract_exif(tmp_path)
        rel_path, abs_path = svc.save_original(data, filename, exif["taken_at"])
        uid = Path(rel_path).stem
        thumb_rel   = svc.generate_thumbnail(abs_path, uid)
        display_rel = svc.generate_display(abs_path, uid)
    finally:
        Path(tmp.name).unlink(missing_ok=True)

    photo = Photo(
        filename=Path(rel_path).name,
        original_name=filename,
        filepath=rel_path,
        thumb_path=thumb_rel,
        display_path=display_rel,
        file_hash=file_hash,
        width=exif["width"],
        height=exif["height"],
        taken_at=exif["taken_at"],
        latitude=exif["latitude"],
        longitude=exif["longitude"],
    )
    db.add(photo)
    db.commit()

    job.imported += 1
    job.done += 1
