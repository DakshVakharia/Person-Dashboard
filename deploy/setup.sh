#!/usr/bin/env bash
# One-time setup for an Ubuntu VM (e.g. Oracle Cloud Always Free).
# Usage: DOMAIN=myname.duckdns.org bash deploy/setup.sh
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=myname.duckdns.org}"
APP_DIR="$HOME/dashboard"
REPO="https://github.com/DakshVakharia/Person-Dashboard.git"

sudo apt-get update
sudo apt-get install -y curl git build-essential python3 debian-keyring debian-archive-keyring apt-transport-https

# Node 20
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# App
[ -d "$APP_DIR" ] || git clone "$REPO" "$APP_DIR"
cd "$APP_DIR" && git pull
npm install
(cd server && npm install --omit=dev)

# systemd service (restarts on crash and on reboot)
sudo tee /etc/systemd/system/dashboard.service >/dev/null <<EOF
[Unit]
Description=Personal Dashboard
After=network.target

[Service]
User=$USER
WorkingDirectory=$APP_DIR/server
ExecStart=/usr/bin/node --env-file=$APP_DIR/server/.env index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable dashboard

# Caddy = automatic HTTPS
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update && sudo apt-get install -y caddy
fi
echo "$DOMAIN {
  reverse_proxy localhost:3001
}" | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl restart caddy

# Ubuntu images on Oracle block ports with iptables; open 80/443
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

echo
echo "Done. Next: create $APP_DIR/server/.env (see .env.example), then:"
echo "  sudo systemctl start dashboard && journalctl -u dashboard -f"
