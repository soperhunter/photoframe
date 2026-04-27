from pydantic import BaseModel, ConfigDict
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
    thumb_url: str
    full_url: str
    tags: list[TagResponse] = []
    model_config = ConfigDict(from_attributes=True)


class PhotoUpdate(BaseModel):
    caption: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    is_favorite: Optional[bool] = None
    tag_ids: Optional[list[int]] = None
