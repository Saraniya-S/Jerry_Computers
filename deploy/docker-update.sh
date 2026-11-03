#!/usr/bin/env bash
# Builds and (re)starts everything with Docker. First deploy and every update:
#   cd /opt/jerry-computers && ./deploy/docker-update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
dc() { docker compose -f deploy/docker-compose.yml --env-file .env.local "$@"; }

if [ "${1:-}" != "--no-pull" ]; then
  echo "==> Fetching the latest code"
  git pull --ff-only
fi

echo "==> Database"
dc up -d --wait postgres

echo "==> Migrations"
dc --profile tools build migrate
dc --profile tools run --rm migrate

echo "==> Building the site (prerenders from the database)"
dc build app

echo "==> Starting"
dc up -d app caddy
sleep 5
dc ps
echo "Done."
