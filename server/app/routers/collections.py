from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBasicCredentials
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_auth
from ..models import Collection, Photo
from ..schemas import CollectionCreate, CollectionResponse

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.get("", response_model=list[CollectionResponse])
def list_collections(db: Session = Depends(get_db)):
    return db.query(Collection).order_by(Collection.created_at.desc()).all()


@router.post("", response_model=CollectionResponse)
def create_collection(
    body: CollectionCreate,
    db: Session = Depends(get_db),
    _: HTTPBasicCredentials = Depends(require_auth),
):
    c = Collection(name=body.name, description=body.description)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{collection_id}")
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    _: HTTPBasicCredentials = Depends(require_auth),
):
    c = db.query(Collection).filter(Collection.id == collection_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.post("/{collection_id}/photos/{photo_id}", response_model=CollectionResponse)
def add_photo(
    collection_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    _: HTTPBasicCredentials = Depends(require_auth),
):
    c = db.query(Collection).filter(Collection.id == collection_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    p = db.query(Photo).filter(Photo.id == photo_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Photo not found")
    if p not in c.photos:
        c.photos.append(p)
        db.commit()
        db.refresh(c)
    return c


@router.delete("/{collection_id}/photos/{photo_id}", response_model=CollectionResponse)
def remove_photo(
    collection_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    _: HTTPBasicCredentials = Depends(require_auth),
):
    c = db.query(Collection).filter(Collection.id == collection_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    p = db.query(Photo).filter(Photo.id == photo_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Photo not found")
    if p in c.photos:
        c.photos.remove(p)
        db.commit()
        db.refresh(c)
    return c
