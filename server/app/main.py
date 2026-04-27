from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic_settings import BaseSettings
from pathlib import Path
import os


class Settings(BaseSettings):
    photos_dir: str = "/opt/apps/photoframe/data/photos"
    port: int = 8002

    class Config:
        env_file = ".env"


settings = Settings()
app = FastAPI(title="Photo Frame")

DIST = Path(__file__).parent.parent.parent / "web" / "dist"


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve built React app if it exists; otherwise serve Phase 0 placeholder
if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="static")
else:
    @app.get("/", response_class=HTMLResponse)
    def placeholder():
        return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Photo Frame</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #241B16;
      color: #F4EAD7;
      font-family: Georgia, serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 1rem;
    }
    h1 { font-size: 2rem; color: #E5B547; letter-spacing: 0.05em; }
    p  { font-size: 1rem; opacity: 0.5; font-family: sans-serif; }
  </style>
</head>
<body>
  <h1>Photo Frame</h1>
  <p>Phase 0 — server is running</p>
</body>
</html>"""
