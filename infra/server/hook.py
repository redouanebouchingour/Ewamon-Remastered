#!/usr/bin/env python3
"""
Deploy trigger on 127.0.0.1:9000, behind Caddy at /_deploy/*. Standard library only.

  POST /_deploy/github   GitHub webhook (X-Hub-Signature-256 checked against WEBHOOK_SECRET); a push to main deploys
  POST /_deploy/run      manual deploy, header `Authorization: Bearer <DEPLOY_TOKEN>`
  GET  /_deploy/status   the deployed commit and the log's tail, same token

A deploy is requested by creating /opt/ewamon/state/pending; ewamon-deploy.path sees it and starts the deploy, so this
process needs no privileges and pushes that land during a deploy queue up as one more run.
"""
import hashlib
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

STATE = Path('/opt/ewamon/state')
LOG = Path('/opt/ewamon/logs/deploy.log')
SECRET = os.environ['WEBHOOK_SECRET'].encode()
TOKEN = os.environ['DEPLOY_TOKEN']
BRANCH_REF = 'refs/heads/main'
MAX_BODY = 5 * 1024 * 1024


def request_deploy(reason: str) -> None:
    (STATE / 'pending').write_text(reason + '\n')


class Handler(BaseHTTPRequestHandler):
    server_version = 'ewamon-hook'

    def reply(self, code: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def token_ok(self) -> bool:
        auth = self.headers.get('Authorization', '')
        return auth.startswith('Bearer ') and hmac.compare_digest(auth[7:].strip(), TOKEN)

    def body(self) -> bytes:
        n = int(self.headers.get('Content-Length') or 0)
        if n > MAX_BODY:
            raise ValueError('body too large')
        return self.rfile.read(n)

    def do_POST(self) -> None:
        if self.path == '/_deploy/github':
            raw = self.body()
            sig = self.headers.get('X-Hub-Signature-256', '')
            want = 'sha256=' + hmac.new(SECRET, raw, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(sig, want):
                return self.reply(401, {'error': 'bad signature'})
            event = self.headers.get('X-GitHub-Event', '')
            if event == 'ping':
                return self.reply(200, {'ok': True, 'pong': True})
            if event != 'push':
                return self.reply(202, {'ignored': event})
            payload = json.loads(raw or b'{}')
            if payload.get('ref') != BRANCH_REF:
                return self.reply(202, {'ignored': payload.get('ref')})
            request_deploy('github ' + str(payload.get('after', ''))[:12])
            return self.reply(202, {'deploy': 'queued'})
        if self.path == '/_deploy/run':
            if not self.token_ok():
                return self.reply(401, {'error': 'bad token'})
            request_deploy('manual')
            return self.reply(202, {'deploy': 'queued'})
        self.reply(404, {'error': 'not found'})

    def do_GET(self) -> None:
        if self.path != '/_deploy/status':
            return self.reply(404, {'error': 'not found'})
        if not self.token_ok():
            return self.reply(401, {'error': 'bad token'})
        deployed = STATE / 'deployed'
        tail = LOG.read_text(errors='replace').splitlines()[-40:] if LOG.exists() else []
        self.reply(200, {
            'deployed': deployed.read_text().strip() if deployed.exists() else None,
            'pending': (STATE / 'pending').exists(),
            'log': tail,
        })

    def log_message(self, fmt: str, *args) -> None:
        print('%s %s' % (self.headers.get('X-Forwarded-For', self.client_address[0]), fmt % args), flush=True)


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 9000), Handler).serve_forever()
