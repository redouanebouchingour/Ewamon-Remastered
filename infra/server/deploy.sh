#!/usr/bin/env bash
# Checks out the newest tag (version order), builds the images and the client bundle, restarts the stack. Run by
# ewamon-deploy.service (started by ewamon-deploy.path when the webhook drops /opt/ewamon/state/pending), or by hand:
# `ewamon-deploy`.
set -euo pipefail

ROOT=/opt/ewamon
REPO=$ROOT/repo
WWW=/srv/ewamon/www
LOG=$ROOT/logs/deploy.log

mkdir -p "$ROOT/logs" "$ROOT/state" /srv/ewamon
exec > >(tee -a "$LOG") 2>&1
exec 9>"$ROOT/state/deploy.lock"
flock 9

# taken before the fetch: a tag pushed during this deploy drops a new file and the path unit runs us again
rm -f "$ROOT/state/pending"
echo "=== deploy $(date -Is) ==="

if [ ! -d "$REPO/.git" ]; then
  git clone https://github.com/redouanebouchingour/Ewamon-Remastered.git "$REPO"
fi
# --prune-tags drops tags deleted on GitHub, --force follows tags that were moved
git -C "$REPO" fetch --quiet --force --prune --prune-tags --tags origin
TAG=$(git -C "$REPO" tag --list --sort=-v:refname | head -n1)
if [ -z "$TAG" ]; then echo "no tags on origin, nothing to deploy"; exit 1; fi
git -C "$REPO" checkout --quiet --force --detach "refs/tags/$TAG"
git -C "$REPO" clean -fdq
SHA=$(git -C "$REPO" rev-parse --short HEAD)
echo "tag $TAG, commit $SHA: $(git -C "$REPO" log -1 --format=%s)"

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

echo "$TAG $SHA $(date -Is)" > "$ROOT/state/deployed"
docker image prune -f > /dev/null
docker builder prune -f --filter until=168h > /dev/null
echo "=== deployed $TAG ($SHA) ==="
