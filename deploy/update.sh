#!/usr/bin/env bash
# Pulls the latest code and restarts the site. Run on the VPS as the `jerry` user:
#   cd ~/app && ./deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Fetching the latest code"
git pull --ff-only

echo "==> Installing packages"
npm ci

echo "==> Updating the database"
npm run db:migrate

echo "==> Building (the database must be running: the home page is prerendered from it)"
NODE_ENV=production npm run build

echo "==> Restarting the site"
sudo systemctl restart jerry-computers
sleep 3
systemctl --no-pager --lines=5 status jerry-computers
echo "Done."
