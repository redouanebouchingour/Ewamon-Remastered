# Ewamon on the Strato VPS (85.215.92.169)

Ubuntu 26.04, Docker + Compose, Caddy on the host (TLS), ufw (22, 80, 443 open). Everything else listens on
127.0.0.1 only. These files are the source of what lives on the server; copy changes over with rsync.

| On the server | From here | What |
|---|---|---|
| `/opt/ewamon/compose.yml` | `compose.yml` | postgres, server, mail (send-only Postfix + DKIM), llm (llama.cpp, gemma4-e2b, 2 threads) |
| `/opt/ewamon/dkim/` | (server only, generated) | DKIM key for `ewamon.com`; `ewamon.com.txt` is the DNS record |
| `/opt/ewamon/Dockerfile` | `Dockerfile` | `server` image + `site` (the built client) on top of the repo's `deps` target |
| `/opt/ewamon/deploy.sh` (`ewamon-deploy`) | `deploy.sh` | check out the newest tag → build → `up -d` → health check → swap `/srv/ewamon/www` |
| `/opt/ewamon/hook.py` | `hook.py` | deploy trigger on 127.0.0.1:9000 (`ewamon-hook.service`, user `ewahook`) |
| `/opt/ewamon/backup.sh` | `backup.sh` | nightly pg_dump at 04:15 into `/opt/ewamon/backups` (14 kept) |
| `/etc/caddy/Caddyfile` | `Caddyfile` | `/` static client, `/api` `/colyseus` `/npc/llm` `/_deploy` proxied |
| `/etc/systemd/system/ewamon-*` | `systemd/` | hook, deploy (+ path trigger), backup timer |
| `/opt/ewamon/.env`, `hook.env` | (server only) | Postgres password, JWT secret, origins; webhook secret + deploy token |
| `/opt/ewamon/models/gemma4-e2b/model.gguf` | `models/` (rsync) | the NPC model |

## Deploying

- **GitHub webhook** (needs repo admin): Settings → Webhooks → Add. Payload URL
  `https://ewamon.com/_deploy/github`, content type `application/json`, secret = `WEBHOOK_SECRET` from
  `/opt/ewamon/hook.env`, "Just the push event". Pushing a tag deploys; pushes to branches are ignored.
- **Releasing**: `git tag v1.2.3 && git push origin v1.2.3`. Every deploy (webhook, manual or `ewamon-deploy`) runs the
  newest tag in version order (`git tag --sort=-v:refname`), never `main`; deleting the newest tag on GitHub and
  deploying rolls back to the one before. With no tags the deploy stops and the running version stays.
- **By hand over HTTPS**: `curl -X POST https://ewamon.com/_deploy/run -H "Authorization: Bearer $DEPLOY_TOKEN"`
- **Status**: `curl https://ewamon.com/_deploy/status -H "Authorization: Bearer $DEPLOY_TOKEN"`
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

## Domain

Served at `ewamon.com` (`www` redirects), A records at 85.215.92.169; Caddy fetches the certificates. To change the
domain: edit the site blocks in `/etc/caddy/Caddyfile`, set `PUBLIC_ORIGINS` and `PUBLIC_WEB_URL` in
`/opt/ewamon/.env`, then `systemctl reload caddy && ewamon-deploy`.

## Notes

- `NPC_TOOLS=on` in `.env` (since 2026-10-27): NPCs can give / take money and Ewamon through `/npc/act`, which any
  logged-in player can call directly (the route's own caps are the only limit). `off` is the server's production default.
- `/npc/llm` is public (the browser calls the model directly), so anyone can use the CPU model; it is limited only by
  its 2 threads.
## Mail

The `mail` service is a send-only Postfix (`boky/postfix`) that signs with DKIM and delivers straight to the
recipients' MX over outbound port 25. It publishes no port, and the `server` reaches it as `smtp://mail:587`. Mail
goes out as `MAIL_FROM` (default `Ewamon <no-reply@ewamon.com>`, override it in `.env`). Nothing receives mail for
ewamon.com here: replies and bounces go to whatever the domain's MX says.

DNS (at the registrar) plus the PTR record (Strato server panel → reverse DNS for 85.215.92.169):

| Type | Name | Value |
|---|---|---|
| A | `mail.ewamon.com` | `85.215.92.169` |
| PTR | `85.215.92.169` | `mail.ewamon.com` (set at Strato, not in DNS) |
| TXT | `ewamon.com` | `v=spf1 ip4:85.215.92.169 -all` (Strato's own SPF rule set to "Geen", only one SPF record is allowed) |
| TXT | `mail._domainkey.ewamon.com` | the `p=…` record from `cat /opt/ewamon/dkim/ewamon.com.txt` |
| TXT | `_dmarc.ewamon.com` | `v=DMARC1; p=quarantine; adkim=s; aspf=s` (Strato's own DMARC rule set to "Geen") |

| TXT | `mail.ewamon.com` | `v=spf1 ip4:85.215.92.169 -all` (SPF for the HELO name) |

All of it is in the Strato panel: Domeinbeheer → ewamon.com → DNS → TXT- en CNAME-records. That form holds every TXT
record of the zone at once and replaces them all on save, so keep the existing rows when adding one. The zone has a wildcard
`*.ewamon.com CNAME ewamon.com`, so a name without its own record still resolves (to the A record).

```sh
docker compose --env-file .env logs -f mail          # every delivery: status=sent / deferred / bounced
docker compose --env-file .env exec mail postqueue -p # what's stuck in the queue
docker compose --env-file .env exec mail postqueue -f # retry the queue now
```

Check a setup by registering with a Gmail address and choosing "Show original": SPF, DKIM and DMARC should all say
PASS. If every delivery is `deferred` with a timeout to `:25`, the provider blocks outbound port 25.
