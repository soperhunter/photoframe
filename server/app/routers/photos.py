import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.security import HTTPBasicCredentials
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_auth
from ..models import Photo, Tag
from ..schemas import PhotoResponse, PhotoUpdate
from ..services import photos as svc

router = APIRouter(prefix="/api/photos", tags=["photos"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_response(photo: Photo) -> PhotoResponse:
    return PhotoResponse(
        id=photo.id,
        filename=photo.filename,
        original_name=photo.original_name,
        width=photo.width,
        height=photo.height,
        taken_at=photo.taken_at,
        uploaded_at=photo.uploaded_at,
        latitude=photo.latitude,
        longitude=photo.longitude,
        location_name=photo.location_name,
        caption=photo.caption,
        is_favorite=photo.is_favorite,
        thumb_url=svc.photo_url(photo.thumb_path),
        full_url=svc.photo_url(photo.filepath),
        tags=[{"id": t.id, "name": t.name, "color": t.color} for t in photo.tags],
        collections=[{"id": c.id, "name": c.name} for c in photo.collections],
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=list[PhotoResponse])
def list_photos(
    favorite: bool | None = None,
    tag: str | None = None,
    has_gps: bool | None = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(Photo)
    if favorite is not None:
        q = q.filter(Photo.is_favorite == favorite)
    if has_gps is not None:
        q = q.filter(Photo.latitude.isnot(None)) if has_gps else q.filter(Photo.latitude.is_(None))
    if tag:
        q = q.join(Photo.tags).filter(Tag.name == tag)
    q = q.order_by(Photo.taken_at.desc().nullslast(), Photo.uploaded_at.desc())
    return [_to_response(p) for p in q.offset(offset).limit(limit).all()]


@router.post("", response_model=PhotoResponse)
async def upload_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: HTTPBasicCredentials = Depends(require_auth),
):
    data = await file.read()
    file_hash = svc.compute_hash(data)

    # Dedup — return existing if same file uploaded before
    existing = db.query(Photo).filter(Photo.file_hash == file_hash).first()
    if existing:
        return _to_response(existing)

    # Write to temp file for Pillow/piexif (need a real path)
    suffix = Path(file.filename or "photo.jpg").suffix or ".jpg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(data)
        tmp.close()
        tmp_path = Path(tmp.name)

        exif = svc.extract_exif(tmp_path)
        rel_path, abs_path = svc.save_original(data, file.filename or "photo.jpg", exif["taken_at"])
        uid = Path(rel_path).stem
        thumb_rel = svc.generate_thumbnail(abs_path, uid)
    finally:
        os.unlink(tmp.name)

    photo = Photo(
        filename=Path(rel_path).name,
        original_name=file.filename or "photo.jpg",
        filepath=rel_path,
        thumb_path=thumb_rel,
        file_hash=file_hash,
        width=exif["width"],
        height=exif["height"],
        taken_at=exif["taken_at"],
        latitude=exif["latitude"],
        longitude=exif["longitude"],
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return _to_response(photo)


@router.patch("/{photo_id}", response_model=PhotoResponse)
def update_photo(
    photo_id: int,
    update: PhotoUpdate,
    db: Session = Depends(get_db),
    _: HTTPBasicCredentials = Depends(require_auth),
):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if update.caption is not None:
        photo.caption = update.caption
    if update.latitude is not None:
        photo.latitude = update.latitude
    if update.longitude is not None:
        photo.longitude = update.longitude
    if update.location_name is not None:
        photo.location_name = update.location_name
    if update.is_favorite is not None:
        photo.is_favorite = update.is_favorite
    if update.tag_ids is not None:
        photo.tags = db.query(Tag).filter(Tag.id.in_(update.tag_ids)).all()

    if update.collection_ids is not None:
        from ..models import Collection
        photo.collections = db.query(Collection).filter(
            Collection.id.in_(update.collection_ids)
        ).all()

    db.commit()
    db.refresh(photo)
    return _to_response(photo)


@router.delete("/{photo_id}")
def delete_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    _: HTTPBasicCredentials = Depends(require_auth),
):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    pdir = svc.photos_dir()
    for rel in [photo.filepath, photo.thumb_path]:
        if rel:
            p = pdir / rel
            if p.exists():
                p.unlink()

    db.delete(photo)
    db.commit()
    return {"ok": True}
