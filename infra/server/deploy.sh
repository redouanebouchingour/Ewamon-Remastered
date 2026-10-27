#!/usr/bin/env bash
# Pulls origin/main, builds the images and the client bundle, restarts the stack. Run by ewamon-deploy.service
# (started by ewamon-deploy.path when the webhook drops /opt/ewamon/state/pending), or by hand: `ewamon-deploy`.
set -euo pipefail

ROOT=/opt/ewamon
REPO=$ROOT/repo
BRANCH=main
WWW=/srv/ewamon/www
LOG=$ROOT/logs/deploy.log

mkdir -p "$ROOT/logs" "$ROOT/state" /srv/ewamon
exec > >(tee -a "$LOG") 2>&1
exec 9>"$ROOT/state/deploy.lock"
flock 9

# taken before the pull: a push that lands during this deploy drops a new file and the path unit runs us again
rm -f "$ROOT/state/pending"
echo "=== deploy $(date -Is) ==="

if [ ! -d "$REPO/.git" ]; then
  git clone --branch "$BRANCH" https://github.com/redouanebouchingour/Ewamon-Remastered.git "$REPO"
fi
git -C "$REPO" fetch --quiet origin "$BRANCH"
git -C "$REPO" reset --quiet --hard "origin/$BRANCH"
git -C "$REPO" clean -fdq
SHA=$(git -C "$REPO" rev-parse --short HEAD)
echo "commit $SHA: $(git -C "$REPO" log -1 --format=%s)"

docker build --quiet --target deps -t ewamon/deps:latest "$REPO"
docker build --quiet -f "$ROOT/Dockerfile" --target server -t ewamon/server:latest "$REPO"
rm -rf "$WWW.new"
docker build --quiet -f "$ROOT/Dockerfile" --target site --output "type=local,dest=$WWW.new" "$REPO"
chmod -R u=rwX,go=rX "$WWW.new"  # the export is root-only (0700); Caddy reads it as its own user

docker compose -f "$ROOT/compose.yml" --env-file "$ROOT/.env" up -d --remove-orphans

for i in $(seq 1 90); do
  if curl -fs -o /dev/null http://127.0.0.1:4000/health; then break; fi
  if [ "$i" = 90 ]; then echo "server did not become healthy"; docker compose -f "$ROOT/compose.yml" logs --tail 80 server; exit 1; fi
  sleep 2
done

# the new bundle goes live only once the new server answers
rm -rf "$WWW.old"
[ -d "$WWW" ] && mv "$WWW" "$WWW.old"
mv "$WWW.new" "$WWW"
rm -rf "$WWW.old"

echo "$SHA $(date -Is)" > "$ROOT/state/deployed"
docker image prune -f > /dev/null
docker builder prune -f --filter until=168h > /dev/null
echo "=== deployed $SHA ==="
