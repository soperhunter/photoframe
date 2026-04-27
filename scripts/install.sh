#!/bin/bash
# First-time setup for photoframe on the Pi.
# Run once as your Pi user (not root). Uses sudo where needed.
set -e

APP_DIR=/opt/apps/photoframe
REPO_URL=https://github.com/soperhunter/photoframe.git

echo "==> Creating /opt/apps/ directory..."
sudo mkdir -p /opt/apps
sudo chown "$USER:$USER" /opt/apps

echo "==> Cloning repo..."
git clone "$REPO_URL" "$APP_DIR"

echo "==> Creating photo storage directories..."
# Single-device setup: photos live alongside the app on the same drive.
# If you add a dedicated USB drive later, update PHOTOS_DIR in .env and
# point it at the new mount (e.g. /mnt/photos).
mkdir -p "$APP_DIR/data/photos/originals"
mkdir -p "$APP_DIR/data/photos/thumbs"

echo "==> Creating Python virtual environment..."
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install --upgrade pip
"$APP_DIR/.venv/bin/pip" install -r "$APP_DIR/server/requirements.txt"

echo "==> Copying .env file..."
cp "$APP_DIR/.env.example" "$APP_DIR/.env"
echo ""
echo "  --> Edit $APP_DIR/.env before starting the service if needed."
echo ""

echo "==> Installing systemd service..."
sudo cp "$APP_DIR/infra/photoframe.service" /etc/systemd/system/
# Replace 'pi' with your actual Pi username in the service file if different
sudo sed -i "s/User=pi/User=$USER/" /etc/systemd/system/photoframe.service
sudo systemctl daemon-reload
sudo systemctl enable photoframe
sudo systemctl start photoframe

echo "==> Installing Avahi mDNS alias service..."
sudo cp "$APP_DIR/infra/avahi-photoframe.service" /etc/systemd/system/
sudo systemctl enable avahi-photoframe
sudo systemctl start avahi-photoframe

echo "==> Installing Caddyfile..."
echo ""
echo "  --> Your current /etc/caddy/Caddyfile will need to be updated."
echo "      Reference config is at: $APP_DIR/infra/Caddyfile"
echo "      Merge photoframe.local block in, then run: sudo systemctl reload caddy"
echo ""

echo "==> Adding deploy sudoers rule (allows runner to restart service without password)..."
echo "$USER ALL=(ALL) NOPASSWD: /bin/systemctl restart photoframe" | sudo tee /etc/sudoers.d/photoframe-deploy > /dev/null
sudo chmod 440 /etc/sudoers.d/photoframe-deploy

echo ""
echo "Done! Check service status with:"
echo "  sudo systemctl status photoframe"
echo "  curl http://localhost:8002/api/health"
