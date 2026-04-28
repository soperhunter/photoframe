from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from fastapi.security import HTTPBasicCredentials
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_auth
from ..models import Collection, Photo, SlideshowState
from ..schemas import PhotoResponse, SlideshowStateResponse, SlideshowStateUpdate

router = APIRouter(prefix="/api/slideshow", tags=["slideshow"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_state(db: Session) -> SlideshowState:
    state = db.query(SlideshowState).filter(SlideshowState.id == 1).first()
    if not state:
        state = SlideshowState(id=1)
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def _collection_is_active(state: SlideshowState) -> bool:
    if state.active_collection_id is None:
        return False
    if state.expires_at is None:
        return True
    return state.expires_at > datetime.utcnow()


def _build_state_response(state: SlideshowState) -> SlideshowStateResponse:
    active = _collection_is_active(state)
    return SlideshowStateResponse(
        active_collection_id=state.active_collection_id if active else None,
        active_collection_name=(
            state.active_collection.name
            if active and state.active_collection else None
        ),
        expires_at=state.expires_at if active else None,
        fallback_filter=state.fallback_filter or "favorites",
        shuffle=state.shuffle,
        interval_seconds=state.interval_seconds or 8,
        show_captions=state.show_captions,
        show_dates=state.show_dates,
        is_collection_active=active,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/state", response_model=SlideshowStateResponse)
def get_state(db: Session = Depends(get_db)):
    return _build_state_response(_get_or_create_state(db))


@router.put("/state", response_model=SlideshowStateResponse)
def update_state(
    update: SlideshowStateUpdate,
    db: Session = Depends(get_db),
    _: HTTPBasicCredentials = Depends(require_auth),
):
    state = _get_or_create_state(db)

    if update.clear_collection:
        state.active_collection_id = None
        state.expires_at = None
    else:
        if update.active_collection_id is not None:
            state.active_collection_id = update.active_collection_id
        if update.expires_at is not None:
            state.expires_at = update.expires_at

    if update.fallback_filter is not None:
        state.fallback_filter = update.fallback_filter
    if update.shuffle is not None:
        state.shuffle = update.shuffle
    if update.interval_seconds is not None:
        state.interval_seconds = update.interval_seconds
    if update.show_captions is not None:
        state.show_captions = update.show_captions
    if update.show_dates is not None:
        state.show_dates = update.show_dates

    db.commit()
    db.refresh(state)
    return _build_state_response(state)


@router.get("/photos", response_model=list[PhotoResponse])
def slideshow_photos(db: Session = Depends(get_db)):
    """Return the photos the slideshow should display right now."""
    # Import here to avoid circular import
    from .photos import _to_response

    state = _get_or_create_state(db)

    # 1. Active collection takes priority
    if _collection_is_active(state):
        col = db.query(Collection).filter(
            Collection.id == state.active_collection_id
        ).first()
        if col and col.photos:
            return [_to_response(p) for p in col.photos]

    # 2. Fallback: favorites
    favs = (
        db.query(Photo)
        .filter(Photo.is_favorite == True)
        .order_by(Photo.taken_at.desc().nullslast(), Photo.uploaded_at.desc())
        .all()
    )
    if favs:
        return [_to_response(p) for p in favs]

    # 3. Last resort: all photos (up to 200)
    return [
        _to_response(p)
        for p in db.query(Photo)
        .order_by(Photo.taken_at.desc().nullslast(), Photo.uploaded_at.desc())
        .limit(200)
        .all()
    ]
