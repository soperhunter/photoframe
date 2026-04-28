from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBasicCredentials

from ..database import SessionLocal
from ..deps import require_auth
from ..services import google_photos as gp

router = APIRouter(prefix="/api/google", tags=["google"])


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
def google_status():
    """Returns current auth + device flow + import state. No auth required."""
    session = gp.get_picker_session()
    job = gp.get_current_job()
    da = gp.get_device_auth()

    return {
        "configured": gp.is_configured(),
        "authorized": gp.is_authorized(),
        "device_auth": _device_auth_dict(da),
        "picker_session": (
            {"id": session.id, "picker_uri": session.picker_uri}
            if session else None
        ),
        "job": _job_dict(job),
    }


# ── Device Authorization flow ─────────────────────────────────────────────────

@router.post("/device-auth")
def start_device_auth(_: HTTPBasicCredentials = Depends(require_auth)):
    """
    Start the device authorization flow.
    Returns a user_code and verification_url the user must visit to approve access.
    The backend polls Google in the background; the frontend polls /status.
    """
    if not gp.is_configured():
        raise HTTPException(503, "Google credentials not configured in .env")

    try:
        da = gp.start_device_auth()
    except Exception as exc:
        raise HTTPException(500, f"Failed to start device auth: {exc}") from exc

    return _device_auth_dict(da)


@router.delete("/auth")
def revoke_auth(_: HTTPBasicCredentials = Depends(require_auth)):
    """Disconnect Google account — delete stored tokens."""
    gp.revoke()
    return {"ok": True}


# ── Picker session ────────────────────────────────────────────────────────────

@router.post("/picker-session")
def create_picker_session(_: HTTPBasicCredentials = Depends(require_auth)):
    """Create (or return a still-fresh cached) Google Photos Picker session."""
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
    """Poll the current import job. No auth required."""
    job = gp.get_current_job()
    if job is None:
        return {"status": "idle", "total": 0, "done": 0, "imported": 0, "skipped": 0, "error": None}
    return _job_dict(job)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _device_auth_dict(da) -> dict | None:
    if da is None:
        return None
    return {
        "user_code": da.user_code,
        "verification_url": da.verification_url,
        "expires_at": da.expires_at.isoformat(),
        "status": da.status,
    }


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
