from fastapi import APIRouter
from pathlib import Path
from ..config import settings

router = APIRouter(prefix="/api/photos", tags=["photos"])

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


@router.get("/dev")
def list_dev_photos() -> list[dict]:
    """
    Phase 1 — list all images under PHOTOS_DIR recursively.
    Returns URL paths that the frontend can use directly.
    Replaced by the full /api/photos endpoint in Phase 2.
    """
    originals = Path(settings.photos_dir) / "originals"

    if not originals.exists():
        return []

    photos = []
    for path in sorted(originals.rglob("*")):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            # Build a URL relative to the mounted /photos static route
            relative = path.relative_to(Path(settings.photos_dir))
            photos.append({
                "url": f"/photos/{relative.as_posix()}",
                "filename": path.name,
            })

    return photos
