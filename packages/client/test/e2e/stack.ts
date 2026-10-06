/**
 * Phase E5 — the isolated game stack the client Playwright specs (`slice-e2e`, `no-dom-in-frame`, `first-frame`) run
 * against: a real `@ewa/server` (`src/main.ts` through tsx, PGlite in a fresh temp `DATA_DIR`, `WORLD_WEATHER=off`, a
 * fixed `SERVER_SEED`) and the client (the Vite dev server, or `vite build` + a static server for `first-frame`), each
 * on a free port picked at start — never the shared 4000 / 2567 / 5173 / 4100 / 2667 / 5174 other sessions hold
 * (same env contract as `scripts/dev-alt.mjs`). `stop()` kills the server's whole process tree and deletes the temp
 * data dir. Not a spec and not a vitest file: neither runner collects it.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import type { Server } from 'node:http';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
export const CLIENT_DIR = join(REPO, 'packages', 'client');
const SERVER_DIR = join(REPO, 'packages', 'server');

/** Ports other sessions / tools on this machine hold at times. */
const RESERVED = new Set([4000, 2567, 5173, 4100, 2667, 5174, 5180, 4179, 9444, 9555]);

/** An OS-assigned free port that is not one of the shared ones. */
export async function freePort(): Promise<number> {
  for (let i = 0; i < 20; i++) {
    const p = await new Promise<number>((res, rej) => {
      const s = createNetServer();
      s.once('error', rej);
      s.listen(0, '127.0.0.1', () => {
        const a = s.address();
        const port = typeof a === 'object' && a !== null ? a.port : 0;
        s.close(() => res(port));
      });
    });
    if (p > 0 && !RESERVED.has(p)) return p;
  }
  throw new Error('no free port');
}

async function waitHttp(url: string, timeoutMs: number, proc?: ChildProcess, log?: () => string): Promise<void> {
  const t0 = Date.now();
  for (;;) {
    if (proc !== undefined && proc.exitCode !== null) throw new Error(`process exited (${proc.exitCode}) before ${url} answered:\n${log?.() ?? ''}`);
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      // not up yet
    }
    if (Date.now() - t0 > timeoutMs) throw new Error(`${url} did not answer within ${timeoutMs} ms:\n${log?.() ?? ''}`);
    await new Promise((res) => setTimeout(res, 250));
  }
}

function killTree(p: ChildProcess | null): void {
  if (p === null || p.pid === undefined || p.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
  else p.kill('SIGTERM');
}

export interface Stack {
  /** the client origin the browser opens, e.g. http://127.0.0.1:53121 */
  readonly origin: string;
  /** REST base (the server's own port; the client reaches it through the `/api` proxy) */
  readonly rest: string;
  readonly ws: string;
  /** server stdout + stderr so far (for failure messages) */
  serverLog(): string;
  stop(): Promise<void>;
}

export interface StackOptions {
  /** 'dev' (default): the Vite dev server; 'build': `vite build` into a temp dir served statically with an /api proxy */
  readonly client?: 'dev' | 'build';
}

/** Boots server + client. Throws (after stopping what started) when either does not come up. */
export async function startStack(o: StackOptions = {}): Promise<Stack> {
  const restPort = await freePort();
  const wsPort = await freePort();
  const clientPort = await freePort();
  const origin = `http://127.0.0.1:${clientPort}`;
  const dataDir = mkdtempSync(join(tmpdir(), 'ewa-e2e-'));
  const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
  let out = '';
  const server = spawn(process.execPath, [tsxCli, '--tsconfig', 'tsconfig.dev.json', 'src/main.ts'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT_REST: String(restPort),
      PORT_WS: String(wsPort),
      DATA_DIR: dataDir,
      CORS_ORIGINS: `${origin},http://localhost:${clientPort}`,
      JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-0123456789',
      WORLD_WEATHER: 'off',
      SERVER_SEED: 'e2e',
      LOG_LEVEL: 'warn',
      PUBLIC_WEB_URL: origin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
  server.stderr?.on('data', (d: Buffer) => { out += d.toString(); });
  const rest = `http://127.0.0.1:${restPort}`;
  const ws = `ws://127.0.0.1:${wsPort}`;
  let client: { close(): Promise<void> } | null = null;
  const stop = async (): Promise<void> => {
    try {
      await client?.close();
    } catch {
      // already closed
    }
    killTree(server);
    await new Promise((res) => setTimeout(res, 300));
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // PGlite files can stay locked for a moment on Windows; the OS temp cleaner takes them
    }
  };
  try {
    await waitHttp(`${rest}/health`, 120_000, server, () => out);
    client = o.client === 'build' ? await serveBuilt(clientPort, rest, ws) : await serveDev(clientPort, rest, ws);
    await waitHttp(`${origin}/`, 120_000);
  } catch (e) {
    await stop();
    throw e;
  }
  return { origin, rest, ws, serverLog: () => out, stop };
}

/** The Vite dev server in-process (HMR and the watcher off, so other agents' edits never reload a page mid-test). */
export async function serveDev(port: number, rest?: string, ws?: string): Promise<{ close(): Promise<void> }> {
  if (rest !== undefined) process.env['EWA_API_TARGET'] = rest;
  if (ws !== undefined) process.env['VITE_WS_URL'] = ws;
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: join(CLIENT_DIR, 'vite.config.ts'),
    root: CLIENT_DIR,
    logLevel: 'warn',
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false, watch: null },
  });
  await server.listen();
  return { close: () => server.close() };
}

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.bin': 'application/octet-stream', '.map': 'application/json',
};

/**
 * `vite build` (the app's own `index.html`, `VITE_WS_URL` baked in) into a temp dir, served by a small static server
 * with the SPA fallback and an `/api` → REST proxy — what a deployment serves, minus compression.
 */
async function serveBuilt(port: number, rest: string, ws: string): Promise<{ close(): Promise<void> }> {
  const outDir = mkdtempSync(join(tmpdir(), 'ewa-e2e-build-'));
  process.env['VITE_WS_URL'] = ws;
  const { build } = await import('vite');
  await build({ configFile: join(CLIENT_DIR, 'vite.config.ts'), root: CLIENT_DIR, logLevel: 'warn', build: { outDir, emptyOutDir: true, sourcemap: false, copyPublicDir: false } });
  const pub = join(CLIENT_DIR, 'public');
  const inside = (root: string, p: string): string | null => {
    const f = normalize(join(root, p));
    return f.startsWith(root + sep) && existsSync(f) && statSync(f).isFile() ? f : null;
  };
  // public/ (pipeline outputs, ~100 MB) is served in place rather than copied into the build
  const file = (p: string): string | null => inside(outDir, p) ?? inside(pub, p);
  const server: Server = createHttpServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://e2e');
    if (url.pathname.startsWith('/api/')) {
      const target = `${rest}${url.pathname.slice(4)}${url.search}`;
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string' && k !== 'host' && k !== 'connection') headers[k] = v;
        fetch(target, { method: req.method, headers, body: chunks.length > 0 ? Buffer.concat(chunks) : undefined })
          .then(async (r) => {
            res.statusCode = r.status;
            r.headers.forEach((v, k) => { if (k !== 'content-encoding' && k !== 'content-length' && k !== 'transfer-encoding') res.setHeader(k, v); });
            res.end(Buffer.from(await r.arrayBuffer()));
          })
          .catch(() => { res.statusCode = 502; res.end(); });
      });
      return;
    }
    const f = file(decodeURIComponent(url.pathname)) ?? join(outDir, 'index.html');
    res.setHeader('content-type', MIME[extname(f).toLowerCase()] ?? 'application/octet-stream');
    createReadStream(f).pipe(res);
  });
  await new Promise<void>((res) => server.listen(port, '127.0.0.1', () => res()));
  return {
    close: () =>
      new Promise<void>((res) => {
        server.closeAllConnections();
        server.close(() => {
          rmSync(outDir, { recursive: true, force: true });
          res();
        });
      }),
  };
}

/** Chrome flags the WebGPU game needs headless on this machine (HANDOFF "Dev tips"). */
export const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'];
