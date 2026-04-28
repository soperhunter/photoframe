from pydantic import BaseModel, ConfigDict, computed_field
from datetime import datetime
from typing import Optional


class TagResponse(BaseModel):
    id: int
    name: str
    color: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None


class CollectionBrief(BaseModel):
    """Minimal collection info embedded in photo responses."""
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)


class PhotoResponse(BaseModel):
    id: int
    filename: str
    original_name: str
    width: Optional[int] = None
    height: Optional[int] = None
    taken_at: Optional[datetime] = None
    uploaded_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    caption: Optional[str] = None
    is_favorite: bool
    is_hidden: bool = False
    thumb_url: str
    full_url: str
    tags: list[TagResponse] = []
    collections: list[CollectionBrief] = []
    model_config = ConfigDict(from_attributes=True)


class PhotoUpdate(BaseModel):
    caption: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_hidden: Optional[bool] = None
    tag_ids: Optional[list[int]] = None
    collection_ids: Optional[list[int]] = None


class BulkLocationUpdate(BaseModel):
    photo_ids: list[int]
    latitude: float
    longitude: float
    location_name: Optional[str] = None


# ── Collections ───────────────────────────────────────────────────────────────

class CollectionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    photo_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None


# ── Slideshow state ───────────────────────────────────────────────────────────

class SlideshowStateResponse(BaseModel):
    active_collection_id: Optional[int] = None
    active_collection_name: Optional[str] = None
    expires_at: Optional[datetime] = None
    fallback_filter: str = "favorites"
    shuffle: bool = True
    interval_seconds: int = 8
    show_captions: bool = True
    show_dates: bool = True
    is_collection_active: bool = False


class SlideshowStateUpdate(BaseModel):
    active_collection_id: Optional[int] = None
    expires_at: Optional[datetime] = None
    clear_collection: bool = False   # set True to deactivate without setting a new one
    fallback_filter: Optional[str] = None
    shuffle: Optional[bool] = None
    interval_seconds: Optional[int] = None
    show_captions: Optional[bool] = None
    show_dates: Optional[bool] = None
