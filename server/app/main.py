from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import inspect, text

from .config import settings
from .database import engine
from .models import Base
from .routers import photos, tags, collections, slideshow, google

# Create all tables on startup (idempotent — safe to run every boot)
Base.metadata.create_all(bind=engine)

# Lightweight column migrations — add new columns to existing tables without Alembic
def _migrate(eng):
    with eng.connect() as conn:
        inspector = inspect(eng)
        photo_cols = {c["name"] for c in inspector.get_columns("photos")}
        if "is_hidden" not in photo_cols:
            conn.execute(text("ALTER TABLE photos ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
        if "display_path" not in photo_cols:
            conn.execute(text("ALTER TABLE photos ADD COLUMN display_path VARCHAR"))
            conn.commit()

_migrate(engine)

app = FastAPI(title="Photo Frame")

# ── API routes (must be registered before static mounts) ──────────────────
app.include_router(photos.router)
app.include_router(tags.router)
app.include_router(collections.router)
app.include_router(slideshow.router)
app.include_router(google.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Static: photo files ────────────────────────────────────────────────────
photos_dir = Path(settings.photos_dir)
photos_dir.mkdir(parents=True, exist_ok=True)
app.mount("/photos", StaticFiles(directory=str(photos_dir)), name="photos")

# ── Static: built React app ────────────────────────────────────────────────
DIST = Path(__file__).parent.parent.parent / "web" / "dist"

if DIST.exists():
    # Serve Vite's hashed asset bundle (JS, CSS, images)
    assets_dir = DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Catch-all: every non-API path serves index.html so React Router works
    @app.get("/{full_path:path}", response_class=HTMLResponse)
    async def serve_spa(full_path: str):
        return HTMLResponse((DIST / "index.html").read_text())
else:
    @app.get("/{full_path:path}", response_class=HTMLResponse)
    async def placeholder(full_path: str):
        return HTMLResponse("""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Photo Frame</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#241B16;color:#F4EAD7;font-family:Georgia,serif;
         display:flex;flex-direction:column;align-items:center;
         justify-content:center;height:100vh;gap:1rem}
    h1{font-size:2rem;color:#E5B547;letter-spacing:.05em}
    p{font-size:1rem;opacity:.4;font-family:sans-serif}
  </style>
</head>
<body>
  <h1>Photo Frame</h1>
  <p>Building frontend… push to main to deploy.</p>
</body>
</html>""")
