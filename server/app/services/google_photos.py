"""
Google Photos Picker API integration — Device Authorization flow.

No redirect URI required. Instead:
  1. POST /api/google/device-auth  → returns user_code + verification_url
  2. User visits verification_url on any device and enters user_code
  3. Background thread polls Google until user approves → token saved automatically
  4. Frontend polls /api/google/status until authorized == true
  5. POST /api/google/picker-session  → creates Picker session, returns pickerUri
  6. User opens pickerUri in new tab, selects photos
  7. POST /api/google/import  → background thread downloads & saves photos
  8. Frontend polls /api/google/import/status for progress
"""

import json
import tempfile
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests as http
from google.oauth2.credentials import Credentials

from ..config import settings
from ..models import Photo
from . import photos as svc

# ── Constants ─────────────────────────────────────────────────────────────────

SCOPES = ["https://www.googleapis.com/auth/photospicker.mediaitems.readonly"]
PICKER_BASE = "https://photospicker.googleapis.com/v1"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
DEVICE_CODE_ENDPOINT = "https://oauth2.googleapis.com/device/code"

# Picker session considered stale after 50 min (base URLs expire at 60 min)
SESSION_TTL_SECONDS = 50 * 60


# ── Module-level singletons ───────────────────────────────────────────────────

@dataclass
class DeviceAuth:
    device_code: str
    user_code: str
    verification_url: str
    expires_at: datetime
    interval: int
    status: str = "pending"   # pending | authorized | expired | denied | error


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


_device_auth: Optional[DeviceAuth] = None
_picker_session: Optional[PickerSession] = None
_current_job: Optional[ImportJob] = None


# ── Token file ────────────────────────────────────────────────────────────────

def _token_path() -> Path:
    return Path(settings.db_path).parent / "google_token.json"


# ── Public API ────────────────────────────────────────────────────────────────

def is_configured() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


def is_authorized() -> bool:
    return _load_credentials() is not None


def get_device_auth() -> Optional[DeviceAuth]:
    return _device_auth


def start_device_auth() -> DeviceAuth:
    """
    Request a device code from Google and start background polling.
    Returns immediately with the user_code the user needs to enter.
    """
    global _device_auth

    resp = http.post(
        DEVICE_CODE_ENDPOINT,
        data={
            "client_id": settings.google_client_id,
            "scope": " ".join(SCOPES),
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    expires_at = datetime.now(timezone.utc)
    from datetime import timedelta
    expires_at = expires_at + timedelta(seconds=data["expires_in"])

    _device_auth = DeviceAuth(
        device_code=data["device_code"],
        user_code=data["user_code"],
        verification_url=data.get("verification_url", "https://google.com/device"),
        expires_at=expires_at,
        interval=data.get("interval", 5),
    )

    t = threading.Thread(target=_poll_device_auth, args=(_device_auth,), daemon=True)
    t.start()
    return _device_auth


def revoke() -> None:
    """Delete stored tokens and reset state."""
    global _device_auth, _picker_session, _current_job
    p = _token_path()
    if p.exists():
        p.unlink()
    _device_auth = None
    _picker_session = None
    _current_job = None


def create_picker_session() -> PickerSession:
    """Create a new Picker session (or return a still-fresh cached one)."""
    global _picker_session

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

    _picker_session = PickerSession(id=data["id"], picker_uri=data["pickerUri"])
    return _picker_session


def get_picker_session() -> Optional[PickerSession]:
    return _picker_session


def get_current_job() -> Optional[ImportJob]:
    return _current_job


def start_import(session_id: str, session_factory) -> ImportJob:
    """Kick off a background import. Raises ValueError if already running."""
    global _current_job

    if _current_job and _current_job.status == "running":
        raise ValueError("Import already running")

    job = ImportJob(session_id=session_id)
    _current_job = job

    t = threading.Thread(target=_run_import, args=(job, session_factory), daemon=True)
    t.start()
    return job


# ── Internal helpers ──────────────────────────────────────────────────────────

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
    """Return credentials, refreshing the access token if expired."""
    creds = _load_credentials()
    if creds is None:
        raise RuntimeError("Not authorized — connect Google account first")

    if creds.expired and creds.refresh_token:
        import google.auth.transport.requests as g_requests
        creds.refresh(g_requests.Request())
        _save_credentials(creds)

    return creds


def _auth_headers(creds: Credentials) -> dict:
    return {"Authorization": f"Bearer {creds.token}"}


# ── Device auth polling thread ────────────────────────────────────────────────

def _poll_device_auth(auth: DeviceAuth) -> None:
    """Background thread: polls Google until the user approves or the code expires."""
    while True:
        time.sleep(auth.interval)

        # Check if state was reset (e.g. user clicked Disconnect)
        if _device_auth is not auth:
            return

        if datetime.now(timezone.utc) >= auth.expires_at:
            auth.status = "expired"
            return

        try:
            resp = http.post(
                TOKEN_ENDPOINT,
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "device_code": auth.device_code,
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                },
                timeout=15,
            )
            data = resp.json()
        except Exception:
            continue  # network hiccup — keep trying

        error = data.get("error")

        if error == "authorization_pending":
            continue

        if error == "slow_down":
            auth.interval += 5
            continue

        if error == "access_denied":
            auth.status = "denied"
            return

        if error == "expired_token":
            auth.status = "expired"
            return

        if error:
            auth.status = "error"
            return

        # Success — build and save credentials
        creds = Credentials(
            token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            token_uri=TOKEN_ENDPOINT,
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            scopes=SCOPES,
        )
        _save_credentials(creds)
        auth.status = "authorized"
        return


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
        if not resp.json().get("mediaItemsSet"):
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

    if not mime_type.startswith("image/"):
        job.skipped += 1
        job.done += 1
        return

    img_resp = http.get(f"{base_url}=d", timeout=120)
    img_resp.raise_for_status()
    data = img_resp.content

    file_hash = svc.compute_hash(data)
    if db.query(Photo).filter(Photo.file_hash == file_hash).first():
        job.skipped += 1
        job.done += 1
        return

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
