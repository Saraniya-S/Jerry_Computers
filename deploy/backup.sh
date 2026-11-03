#!/usr/bin/env bash
# Nightly backup of the database and uploaded photos into ~/backups, keeping 14 days.
# setup-server.sh schedules it with cron at 02:30.
set -euo pipefail
cd "$(dirname "$0")/.."
out="$HOME/backups"
stamp="$(date +%Y-%m-%d)"
mkdir -p "$out"
docker compose -f deploy/docker-compose.yml --env-file .env.local exec -T postgres pg_dump -U jerry -d jerry_computers --format=custom > "$out/db-$stamp.dump"
tar -czf "$out/uploads-$stamp.tar.gz" uploads 2>/dev/null || true
find "$out" -type f -mtime +14 -delete
echo "Backed up to $out ($stamp)"
