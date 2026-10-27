# Ewamon on the Strato VPS (85.215.92.169)

Ubuntu 26.04, Docker + Compose, Caddy on the host (TLS), ufw (22, 80, 443 open). Everything else listens on
127.0.0.1 only. These files are the source of what lives on the server; copy changes over with rsync.

| On the server | From here | What |
|---|---|---|
| `/opt/ewamon/compose.yml` | `compose.yml` | postgres, server, llm (llama.cpp, gemma4-e2b, 2 threads) |
| `/opt/ewamon/Dockerfile` | `Dockerfile` | `server` image + `site` (the built client) on top of the repo's `deps` target |
| `/opt/ewamon/deploy.sh` (`ewamon-deploy`) | `deploy.sh` | pull origin/main → build → `up -d` → health check → swap `/srv/ewamon/www` |
| `/opt/ewamon/hook.py` | `hook.py` | deploy trigger on 127.0.0.1:9000 (`ewamon-hook.service`, user `ewahook`) |
| `/opt/ewamon/backup.sh` | `backup.sh` | nightly pg_dump at 04:15 into `/opt/ewamon/backups` (14 kept) |
| `/etc/caddy/Caddyfile` | `Caddyfile` | `/` static client, `/api` `/colyseus` `/npc/llm` `/_deploy` proxied |
| `/etc/systemd/system/ewamon-*` | `systemd/` | hook, deploy (+ path trigger), backup timer |
| `/opt/ewamon/.env`, `hook.env` | (server only) | Postgres password, JWT secret, origins; webhook secret + deploy token |
| `/opt/ewamon/models/gemma4-e2b/model.gguf` | `models/` (rsync) | the NPC model |

## Deploying

- **GitHub webhook** (needs repo admin): Settings → Webhooks → Add. Payload URL
  `https://uniforcemusic.com/_deploy/github`, content type `application/json`, secret = `WEBHOOK_SECRET` from
  `/opt/ewamon/hook.env`, "Just the push event". Pushes to `main` deploy.
- **By hand over HTTPS**: `curl -X POST https://uniforcemusic.com/_deploy/run -H "Authorization: Bearer $DEPLOY_TOKEN"`
- **Status**: `curl https://uniforcemusic.com/_deploy/status -H "Authorization: Bearer $DEPLOY_TOKEN"`
- **On the server**: `ewamon-deploy`, log in `/opt/ewamon/logs/deploy.log` (also `journalctl -u ewamon-deploy`).

The hook only creates `/opt/ewamon/state/pending`; `ewamon-deploy.path` starts the deploy. A push during a deploy
queues one more run. The new client bundle goes live only after the new server answers `/health`.

## Day to day

```sh
cd /opt/ewamon
docker compose --env-file .env logs -f server
docker compose --env-file .env exec postgres psql -U ewa -d ewa
# dev data scripts against production (DATABASE_URL from .env's POSTGRES_PASSWORD, port 5432 on localhost):
docker run --rm --network ewamon_default -e DATABASE_URL=postgres://ewa:$PW@postgres:5432/ewa ewamon/server pnpm grant:item ...
```

## Adding ewamon.com

Point `ewamon.com` and `www.ewamon.com` (A record) at 85.215.92.169, uncomment the block at the bottom of
`/etc/caddy/Caddyfile`, add `https://ewamon.com` to `PUBLIC_ORIGINS` in `/opt/ewamon/.env`, then
`systemctl reload caddy && ewamon-deploy`.

## Notes

- `NPC_TOOLS=on` in `.env` (since 2026-10-27): NPCs can give / take money and Ewamon through `/npc/act`, which any
  logged-in player can call directly (the route's own caps are the only limit). `off` is the server's production default.
- `/npc/llm` is public (the browser calls the model directly), so anyone can use the CPU model; it is limited only by
  its 2 threads.
- No SMTP yet: reset/verification emails land in the `data` volume under `mail/`. Set `SMTP_URL` + `MAIL_FROM` in
  the compose `server` environment to send them.
