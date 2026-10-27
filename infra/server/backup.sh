#!/usr/bin/env bash
# Nightly pg_dump of the game database into /opt/ewamon/backups, the newest 14 kept.
# Restore: gunzip -c <file> | docker compose -f /opt/ewamon/compose.yml exec -T postgres psql -U ewa -d ewa
set -euo pipefail
DIR=/opt/ewamon/backups
mkdir -p "$DIR"
OUT="$DIR/ewa-$(date +%Y%m%d-%H%M).sql.gz"
docker compose -f /opt/ewamon/compose.yml --env-file /opt/ewamon/.env exec -T postgres pg_dump -U ewa -d ewa --clean --if-exists | gzip > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
ls -1t "$DIR"/ewa-*.sql.gz | tail -n +15 | xargs -r rm -f
