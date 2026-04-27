from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .config import settings
from .routers import photos

app = FastAPI(title="Photo Frame")

# --- API routes (must be registered before static mounts) ---
app.include_router(photos.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Static: photo files ---
# Mounted at /photos so the frontend can fetch /photos/originals/...
photos_dir = Path(settings.photos_dir)
if photos_dir.exists():
    app.mount("/photos", StaticFiles(directory=str(photos_dir)), name="photos")


# --- Static: built React app ---
# Served last so it catches everything not matched above.
# Falls back to the warm placeholder if web/dist hasn't been built yet.
DIST = Path(__file__).parent.parent.parent / "web" / "dist"

if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="static")
else:
    from fastapi.responses import HTMLResponse

    @app.get("/", response_class=HTMLResponse)
    def placeholder():
        return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Photo Frame</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#241B16; color:#F4EAD7; font-family:Georgia,serif;
           display:flex; flex-direction:column; align-items:center;
           justify-content:center; height:100vh; gap:1rem; }
    h1 { font-size:2rem; color:#E5B547; letter-spacing:.05em; }
    p  { font-size:1rem; opacity:.4; font-family:sans-serif; }
  </style>
</head>
<body>
  <h1>Photo Frame</h1>
  <p>Building frontend… push to main to deploy.</p>
</body>
</html>"""
