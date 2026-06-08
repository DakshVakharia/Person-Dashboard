#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p logs server/data server/uploads

if ! command -v pm2 &>/dev/null; then
  echo "Installing pm2..."
  npm install -g pm2
fi

pm2 start ecosystem.config.cjs --env production
pm2 save

echo ""
echo "Dashboard running at http://localhost:3001"
echo "Use 'pm2 logs dashboard' to view logs"
echo "Use 'pm2 stop dashboard' to stop"
