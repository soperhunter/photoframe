import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBasicCredentials

from ..database import SessionLocal
from ..deps import require_auth
from ..services import google_photos as gp

router = APIRouter(prefix="/api/google", tags=["google"])


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
def google_status():
    """Returns the current Google auth + import state. No auth required."""
    session = gp.get_picker_session()
    job = gp.get_current_job()

    return {
        "configured": gp.is_configured(),
        "authorized": gp.is_authorized(),
        "picker_session": (
            {"id": session.id, "picker_uri": session.picker_uri}
            if session else None
        ),
        "job": _job_dict(job),
    }


# ── OAuth ─────────────────────────────────────────────────────────────────────

@router.get("/auth")
def start_auth(
    _: HTTPBasicCredentials = Depends(require_auth),
):
    """Redirect browser to Google OAuth consent screen."""
    if not gp.is_configured():
        raise HTTPException(503, "Google credentials not configured in .env")

    state = secrets.token_hex(16)
    url = gp.get_auth_url(state)

    response = RedirectResponse(url=url)
    response.set_cookie(
        "google_oauth_state",
        state,
        httponly=True,
        samesite="strict",
        max_age=600,
        secure=True,
    )
    return response


@router.get("/callback")
def oauth_callback(request: Request, code: str = "", state: str = ""):
    """Google redirects here after user consents. Exchanges code for tokens."""
    expected = request.cookies.get("google_oauth_state")
    if not expected or expected != state:
        raise HTTPException(400, "Invalid OAuth state — try connecting again")
    if not code:
        raise HTTPException(400, "No authorization code received")

    try:
        gp.exchange_code(code)
    except Exception as exc:
        raise HTTPException(500, f"Failed to exchange code: {exc}") from exc

    response = RedirectResponse(url="/admin")
    response.delete_cookie("google_oauth_state")
    return response


@router.delete("/auth")
def revoke_auth(_: HTTPBasicCredentials = Depends(require_auth)):
    """Disconnect Google account — delete stored tokens."""
    gp.revoke()
    return {"ok": True}


# ── Picker session ────────────────────────────────────────────────────────────

@router.post("/picker-session")
def create_picker_session(_: HTTPBasicCredentials = Depends(require_auth)):
    """Create (or return a cached) Google Photos Picker session."""
    if not gp.is_configured():
        raise HTTPException(503, "Google credentials not configured in .env")
    if not gp.is_authorized():
        raise HTTPException(401, "Not authorized — connect Google account first")

    try:
        session = gp.create_picker_session()
    except Exception as exc:
        raise HTTPException(500, f"Failed to create picker session: {exc}") from exc

    return {"id": session.id, "picker_uri": session.picker_uri}


# ── Import ────────────────────────────────────────────────────────────────────

@router.post("/import")
def start_import(
    body: dict,
    _: HTTPBasicCredentials = Depends(require_auth),
):
    """Start a background import for the given Picker session."""
    session_id: str = body.get("session_id", "")
    if not session_id:
        raise HTTPException(400, "session_id is required")

    try:
        job = gp.start_import(session_id, SessionLocal)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc

    return _job_dict(job)


@router.get("/import/status")
def import_status():
    """Poll the current import job status. No auth required."""
    job = gp.get_current_job()
    if job is None:
        return {"status": "idle", "total": 0, "done": 0, "imported": 0, "skipped": 0, "error": None}
    return _job_dict(job)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _job_dict(job) -> dict | None:
    if job is None:
        return None
    return {
        "status": job.status,
        "total": job.total,
        "done": job.done,
        "imported": job.imported,
        "skipped": job.skipped,
        "error": job.error,
    }
