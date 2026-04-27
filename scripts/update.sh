#!/bin/bash
# Pull latest code and restart the photoframe service.
# Used for manual updates; GitHub Actions runs this automatically on push.
set -e

APP_DIR=/opt/apps/photoframe

echo "==> Pulling latest code..."
cd "$APP_DIR"
git pull origin main

echo "==> Installing Python dependencies..."
.venv/bin/pip install -r server/requirements.txt

echo "==> Building frontend (if present)..."
if [ -f "$APP_DIR/web/package.json" ]; then
    cd "$APP_DIR/web"
    npm ci
    npm run build
    cd "$APP_DIR"
else
    echo "  No web/package.json — skipping frontend build (Phase 0)"
fi

echo "==> Restarting service..."
sudo systemctl restart photoframe

echo "==> Verifying health..."
for i in $(seq 1 12); do
    curl -sf http://localhost:8002/api/health && echo "Healthy!" && exit 0
    echo "Waiting... ($i/12)"
    sleep 5
done
echo "ERROR: service did not respond after 60 seconds"
exit 1
