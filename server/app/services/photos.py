import hashlib
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import piexif
from PIL import Image, ExifTags

from ..config import settings

THUMB_MAX   = (600, 600)    # grid thumbnails — small and fast
DISPLAY_MAX = (2048, 2048)  # lightbox / slideshow — high quality, still fast
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tiff", ".tif"}


# ---------------------------------------------------------------------------
# Hashing
# ---------------------------------------------------------------------------

def compute_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# File storage
# ---------------------------------------------------------------------------

def photos_dir() -> Path:
    return Path(settings.photos_dir)


def save_original(data: bytes, original_name: str, taken_at: Optional[datetime]) -> tuple[str, Path]:
    """Write the original bytes to disk. Returns (relative_path, absolute_path)."""
    suffix = Path(original_name).suffix.lower() or ".jpg"
    uid = str(uuid.uuid4())

    if taken_at:
        subdir = f"originals/{taken_at.year}/{taken_at.month:02d}"
    else:
        subdir = "originals/unsorted"

    rel = f"{subdir}/{uid}{suffix}"
    abs_path = photos_dir() / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(data)
    return rel, abs_path


def generate_thumbnail(src: Path, uid: str) -> str:
    """Generate a WebP thumbnail. Returns relative path."""
    rel = f"thumbs/{uid}.webp"
    dest = photos_dir() / rel
    dest.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(src) as img:
        img = _fix_orientation(img)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.thumbnail(THUMB_MAX, Image.LANCZOS)
        img.save(dest, "WEBP", quality=85)

    return rel


def generate_display(src: Path, uid: str) -> str:
    """Generate a display-quality WebP (2048px). Returns relative path."""
    rel = f"display/{uid}.webp"
    dest = photos_dir() / rel
    dest.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(src) as img:
        img = _fix_orientation(img)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.thumbnail(DISPLAY_MAX, Image.LANCZOS)
        img.save(dest, "WEBP", quality=88)

    return rel


def photo_url(rel_path: str) -> str:
    return f"/photos/{rel_path}"


# ---------------------------------------------------------------------------
# EXIF extraction
# ---------------------------------------------------------------------------

def extract_exif(filepath: Path) -> dict:
    result: dict = {
        "taken_at": None,
        "latitude": None,
        "longitude": None,
        "width": None,
        "height": None,
    }

    try:
        with Image.open(filepath) as img:
            result["width"], result["height"] = img.size
    except Exception:
        pass

    try:
        exif = piexif.load(str(filepath))

        # Capture date
        raw = exif.get("Exif", {}).get(piexif.ExifIFD.DateTimeOriginal)
        if raw:
            try:
                result["taken_at"] = datetime.strptime(raw.decode(), "%Y:%m:%d %H:%M:%S")
            except ValueError:
                pass

        # GPS
        gps = exif.get("GPS", {})
        if gps:
            result["latitude"] = _gps_decimal(
                gps.get(piexif.GPSIFD.GPSLatitude),
                gps.get(piexif.GPSIFD.GPSLatitudeRef),
                b"S",
            )
            result["longitude"] = _gps_decimal(
                gps.get(piexif.GPSIFD.GPSLongitude),
                gps.get(piexif.GPSIFD.GPSLongitudeRef),
                b"W",
            )
    except Exception:
        pass

    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gps_decimal(coord, ref, negative_ref) -> Optional[float]:
    if not coord:
        return None
    try:
        d = coord[0][0] / coord[0][1]
        m = coord[1][0] / coord[1][1]
        s = coord[2][0] / coord[2][1]
        val = d + m / 60 + s / 3600
        return round(-val if ref == negative_ref else val, 7)
    except Exception:
        return None


def _fix_orientation(img: Image.Image) -> Image.Image:
    try:
        tag_id = next(k for k, v in ExifTags.TAGS.items() if v == "Orientation")
        exif = img._getexif()  # type: ignore[attr-defined]
        if exif:
            orient = exif.get(tag_id)
            if orient == 3:
                img = img.rotate(180, expand=True)
            elif orient == 6:
                img = img.rotate(270, expand=True)
            elif orient == 8:
                img = img.rotate(90, expand=True)
    except Exception:
        pass
    return img
