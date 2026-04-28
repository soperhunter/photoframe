from sqlalchemy import (
    Boolean, Column, CheckConstraint, DateTime, Float, ForeignKey,
    Integer, String, Table,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


# ── Association tables ────────────────────────────────────────────────────────

photo_tags = Table(
    "photo_tags",
    Base.metadata,
    Column("photo_id", Integer, ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id",   Integer, ForeignKey("tags.id",   ondelete="CASCADE"), primary_key=True),
)

collection_photos = Table(
    "collection_photos",
    Base.metadata,
    Column("collection_id", Integer, ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True),
    Column("photo_id",      Integer, ForeignKey("photos.id",      ondelete="CASCADE"), primary_key=True),
)


# ── Models ────────────────────────────────────────────────────────────────────

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
    is_hidden     = Column(Boolean, default=False)   # excluded from slideshow without deleting

    tags        = relationship("Tag",        secondary=photo_tags,        back_populates="photos")
    collections = relationship("Collection", secondary=collection_photos, back_populates="photos")


class Tag(Base):
    __tablename__ = "tags"

    id    = Column(Integer, primary_key=True, index=True)
    name  = Column(String, unique=True, nullable=False)
    color = Column(String)

    photos = relationship("Photo", secondary=photo_tags, back_populates="tags")


class Collection(Base):
    __tablename__ = "collections"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    description = Column(String)
    created_at  = Column(DateTime, nullable=False, default=datetime.utcnow)

    photos = relationship("Photo", secondary=collection_photos, back_populates="collections")

    @property
    def photo_count(self) -> int:
        return len(self.photos)


class SlideshowState(Base):
    """Single-row config table (id always = 1)."""
    __tablename__ = "slideshow_state"
    __table_args__ = (CheckConstraint("id = 1"),)

    id                   = Column(Integer, primary_key=True, default=1)
    active_collection_id = Column(Integer, ForeignKey("collections.id", ondelete="SET NULL"), nullable=True)
    expires_at           = Column(DateTime, nullable=True)   # NULL = never expires
    fallback_filter      = Column(String,  default="favorites")  # "favorites" | "all"
    shuffle              = Column(Boolean, default=True)
    interval_seconds     = Column(Integer, default=8)
    show_captions        = Column(Boolean, default=True)
    show_dates           = Column(Boolean, default=True)

    active_collection = relationship("Collection")
