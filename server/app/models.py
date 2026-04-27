from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Table,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


photo_tags = Table(
    "photo_tags",
    Base.metadata,
    Column("photo_id", Integer, ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id",   Integer, ForeignKey("tags.id",   ondelete="CASCADE"), primary_key=True),
)


class Photo(Base):
    __tablename__ = "photos"

    id            = Column(Integer, primary_key=True, index=True)
    filename      = Column(String,  nullable=False)          # uuid-based storage name
    original_name = Column(String,  nullable=False)          # name as uploaded
    filepath      = Column(String,  nullable=False)          # relative to photos_dir
    thumb_path    = Column(String,  nullable=False)          # relative to photos_dir
    file_hash     = Column(String,  unique=True, index=True) # SHA-256 for dedup
    width         = Column(Integer)
    height        = Column(Integer)
    taken_at      = Column(DateTime)
    uploaded_at   = Column(DateTime, nullable=False, default=datetime.utcnow)
    latitude      = Column(Float)
    longitude     = Column(Float)
    location_name = Column(String)
    caption       = Column(String)
    is_favorite   = Column(Boolean, default=False)

    tags = relationship("Tag", secondary=photo_tags, back_populates="photos")


class Tag(Base):
    __tablename__ = "tags"

    id    = Column(Integer, primary_key=True, index=True)
    name  = Column(String, unique=True, nullable=False)
    color = Column(String)

    photos = relationship("Photo", secondary=photo_tags, back_populates="tags")
