/**
 * Shared plumbing of `harness:budget` / `harness:shots` (SPEC §50.2.3, §50.6.1): argument parsing, the harness page
 * server (a production `vite build` of `harness/index.html` served by a small static server, or the Vite dev server
 * with HMR off), a headless Chrome with WebGPU driven over the DevTools protocol with Node's built-in WebSocket/fetch
 * (no Playwright dependency), and a minimal PNG decoder for the screenshot checks. Everything started here is stopped
 * by `Session.close()` (also on SIGINT / an uncaught error).
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import type { Server } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { cpus, platform, release, tmpdir, totalmem } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

export const CLIENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPO_ROOT = resolve(CLIENT_DIR, '..', '..');
const BUILD_DIR = join(CLIENT_DIR, 'dist', 'harness');
const PUBLIC_DIR = join(CLIENT_DIR, 'public');
const HARNESS_HTML = join(CLIENT_DIR, 'harness', 'index.html');

export const DEFAULT_CHROME = process.env['EWA_CHROME'] ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// ---- args ------------------------------------------------------------------------------------------------------

export type Args = Readonly<Record<string, string | true>>;

/** `--k v`, `--k=v`, bare `--flag` (true); a lone `--` (pnpm passes it through) is skipped. */
export function parseArgs(argv: readonly string[]): Args {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--' || !a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[a.slice(2)] = next; i++; } else out[a.slice(2)] = true;
  }
  return out;
}

export function argStr(a: Args, k: string, d: string): string {
  const v = a[k];
  return typeof v === 'string' ? v : d;
}

export function argNum(a: Args, k: string, d: number): number {
  const v = a[k];
  if (typeof v !== 'string') return d;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${k} expects a number, got ${v}`);
  return n;
}

/** Paths on the command line resolve against the directory pnpm was invoked from (INIT_CWD), else the repo root. */
export function userPath(p: string): string {
  return resolve(process.env['INIT_CWD'] ?? REPO_ROOT, p);
}

export function log(line: string): void {
  process.stdout.write(`[harness ${new Date().toISOString().slice(11, 19)}] ${line}\n`);
}

// ---- ports -----------------------------------------------------------------------------------------------------

/** Ports other tools on this machine use (the app dev/preview, the render sandbox, other agents' Chromes). */
const RESERVED = new Set([5173, 5174, 5180, 9444, 9555, 4000, 2567]);

export function freePort(preferred: number): Promise<number> {
  const tryPort = (p: number): Promise<number | null> => new Promise((res) => {
    if (RESERVED.has(p)) { res(null); return; }
    const s = createNetServer();
    s.once('error', () => res(null));
    s.listen(p, '127.0.0.1', () => s.close(() => res(p)));
  });
  return (async () => {
    for (let p = preferred; p < preferred + 200; p++) { const ok = await tryPort(p); if (ok !== null) return ok; }
    throw new Error(`no free port from ${preferred}`);
  })();
}

// ---- the harness page server -------------------------------------------------------------------------------------

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.map': 'application/json', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

export interface PageServer { readonly origin: string; close(): Promise<void> }

/** `vite build` of the harness input only (outDir `dist/harness`, public assets served from `public/` directly). */
export async function buildHarness(): Promise<void> {
  const { build } = await import('vite');
  const t0 = Date.now();
  await build({
    configFile: join(CLIENT_DIR, 'vite.config.ts'),
    root: CLIENT_DIR,
    logLevel: 'warn',
    build: {
      outDir: BUILD_DIR, emptyOutDir: true, copyPublicDir: false, sourcemap: false,
      rollupOptions: { input: { harness: HARNESS_HTML } },
    },
  });
  log(`harness bundle built in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${BUILD_DIR}`);
}

function isHarnessRoute(pathname: string): boolean {
  return pathname === '/harness' || pathname === '/harness/' || pathname === '/harness/budget' || pathname === '/harness/shots' || pathname === '/harness/index.html';
}

/** Static server over the build output + `public/`; `/harness/{budget,shots}` → the harness HTML. */
export async function serveBuild(port: number): Promise<PageServer> {
  const html = join(BUILD_DIR, 'harness', 'index.html');
  if (!existsSync(html)) throw new Error(`no harness build at ${html} (run without --no-build)`);
  const inside = (root: string, p: string): string | null => {
    const f = normalize(join(root, p));
    return f.startsWith(root + sep) && existsSync(f) && statSync(f).isFile() ? f : null;
  };
  const server: Server = createHttpServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://harness');
    const path = decodeURIComponent(url.pathname);
    const file = isHarnessRoute(path) ? html : inside(BUILD_DIR, path) ?? inside(PUBLIC_DIR, path);
    if (file === null) { res.statusCode = 404; res.end('not found'); return; }
    res.setHeader('content-type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('cache-control', 'no-store');
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((res) => server.listen(port, '127.0.0.1', () => res()));
  return { origin: `http://127.0.0.1:${port}`, close: () => new Promise<void>((res) => server.close(() => res())) };
}

/** The Vite dev server (HMR and the file watcher off: other agents' edits never reload a page mid-capture). */
export async function serveDev(port: number): Promise<PageServer> {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: join(CLIENT_DIR, 'vite.config.ts'),
    root: CLIENT_DIR,
    logLevel: 'warn',
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false, watch: null },
    plugins: [{
      name: 'ewa:harness-routes',
      configureServer(s) {
        s.middlewares.use((req, _res, next) => {
          const u = new URL(req.url ?? '/', 'http://harness');
          if (isHarnessRoute(u.pathname)) req.url = `/harness/index.html${u.search}`;
          next();
        });
      },
    }],
  });
  await server.listen();
  return { origin: `http://127.0.0.1:${port}`, close: () => server.close() };
}

// ---- Chrome over CDP -----------------------------------------------------------------------------------------------

interface Pending { resolve(v: unknown): void; reject(e: Error): void; method: string }

export class Cdp {
  private id = 0;
  private readonly pending = new Map<number, Pending>();
  private readonly listeners = new Map<string, ((params: Record<string, unknown>) => void)[]>();

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (ev: MessageEvent) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: { message: string }; method?: string; params?: Record<string, unknown> };
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (p === undefined) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
        return;
      }
      if (msg.method !== undefined) for (const cb of this.listeners.get(msg.method) ?? []) cb(msg.params ?? {});
    });
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) p.reject(new Error(`CDP socket closed during ${p.method}`));
      this.pending.clear();
    });
  }

  static connect(url: string): Promise<Cdp> {
    return new Promise((res, rej) => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => res(new Cdp(ws)), { once: true });
      ws.addEventListener('error', () => rej(new Error(`CDP connect failed: ${url}`)), { once: true });
    });
  }

  send<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.id;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method: string, cb: (params: Record<string, unknown>) => void): void {
    const l = this.listeners.get(method) ?? [];
    l.push(cb);
    this.listeners.set(method, l);
  }

  close(): void {
    try { this.ws.close(); } catch { /* closed */ }
  }
}

export interface ChromeOptions { readonly width: number; readonly height: number; readonly chrome?: string }

export interface Browser { readonly cdp: Cdp; readonly port: number; readonly version: string; close(): Promise<void> }

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Launches headless Chrome with WebGPU on a free debugging port and a scratch profile; returns the page session. */
export async function launchChrome(o: ChromeOptions): Promise<Browser> {
  const port = await freePort(9470);
  const profile = join(tmpdir(), `ewa-harness-${process.pid}-${port}`);
  mkdirSync(profile, { recursive: true });
  const exe = o.chrome ?? DEFAULT_CHROME;
  const proc: ChildProcess = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--enable-unsafe-webgpu', '--enable-webgpu-developer-features', '--enable-gpu', '--ignore-gpu-blocklist',
    `--window-size=${o.width},${o.height}`, '--force-device-scale-factor=1', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  let exited = false;
  proc.on('exit', () => { exited = true; });
  let version = '';
  let pageWs = '';
  for (let i = 0; i < 150 && pageWs === ''; i++) {
    if (exited) throw new Error(`chrome exited at start (${exe})`);
    try {
      const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json() as { Browser?: string };
      version = v.Browser ?? '';
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as { type: string; webSocketDebuggerUrl: string }[];
      pageWs = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? '';
    } catch { await sleep(200); }
  }
  if (pageWs === '') throw new Error('chrome did not expose a page target');
  const cdp = await Cdp.connect(pageWs);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: o.width, height: o.height, deviceScaleFactor: 1, mobile: false });
  cdp.on('Runtime.consoleAPICalled', (p) => {
    const type = String(p['type']);
    if (type !== 'error' && type !== 'warning' && type !== 'warn' && type !== 'info' && type !== 'log') return;
    const args = (p['args'] as { value?: unknown; description?: string }[] | undefined) ?? [];
    const text = args.map((a) => (a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : a.description ?? '')).join(' ');
    if (type === 'info' && !text.startsWith('[harness]')) return;
    log(`page ${type}: ${text.slice(0, 600)}`);
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = p['exceptionDetails'] as { text?: string; exception?: { description?: string } } | undefined;
    log(`page exception: ${(d?.exception?.description ?? d?.text ?? '?').slice(0, 800)}`);
  });
  return {
    cdp, port, version,
    close: async () => {
      cdp.close();
      if (!exited) {
        proc.kill();
        for (let i = 0; i < 50 && !exited; i++) await sleep(100);
      }
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may still hold a file for a moment */ }
    },
  };
}

/** `Runtime.evaluate` with awaitPromise + returnByValue; throws the page exception text. */
export async function evaluate<T>(cdp: Cdp, expression: string, timeoutMs = 30 * 60_000): Promise<T> {
  const call = cdp.send<{ result: { value?: unknown }; exceptionDetails?: { text?: string; exception?: { description?: string } } }>('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  });
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_r, rej) => { timer = setTimeout(() => rej(new Error(`evaluate timed out after ${timeoutMs} ms: ${expression.slice(0, 120)}`)), timeoutMs); });
  try {
    const r = await Promise.race([call, timeout]);
    if (r.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? '?'}`);
    return r.result.value as T;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export interface Session {
  readonly browser: Browser;
  readonly server: PageServer;
  readonly info: Record<string, unknown>;
  readonly bootMs: number;
  close(): Promise<void>;
}

export interface SessionOptions {
  readonly zone: string;
  readonly route: 'budget' | 'shots';
  readonly width: number;
  readonly height: number;
  readonly serve: 'build' | 'dev';
  readonly build: boolean;
  /** §50.6.1 heading convention for the page (default 'words', anchors.ts) */
  readonly headings?: 'words' | 'rig';
}

/** Server + Chrome + the harness page booted for `zone` (renderer, zone, shader warm-up done). */
export async function openSession(o: SessionOptions): Promise<Session> {
  const port = await freePort(5191);
  if (o.serve === 'build' && o.build) await buildHarness();
  const server = o.serve === 'build' ? await serveBuild(port) : await serveDev(port);
  log(`harness page server ${server.origin} (${o.serve})`);
  let browser: Browser | null = null;
  const closeAll = async (): Promise<void> => {
    if (browser !== null) await browser.close();
    browser = null;
    await server.close();
  };
  const onSignal = (): void => { void closeAll().finally(() => process.exit(130)); };
  process.once('SIGINT', onSignal);
  try {
    browser = await launchChrome({ width: o.width, height: o.height });
    log(`chrome ${browser.version} on debugging port ${browser.port}`);
    const url = `${server.origin}/harness/${o.route}?zone=${encodeURIComponent(o.zone)}${o.headings === 'rig' ? '&headings=rig' : ''}`;
    const t0 = Date.now();
    await browser.cdp.send('Page.navigate', { url });
    let state: { ready: boolean; error: string | null } | null = null;
    for (let i = 0; i < 3600; i++) {
      await sleep(500);
      state = await evaluate<{ ready: boolean; error: string | null } | null>(browser.cdp, 'window.__ewaHarness ? { ready: window.__ewaHarness.ready, error: window.__ewaHarness.error } : null', 60_000).catch(() => null);
      if (state?.ready || state?.error) break;
    }
    if (!state?.ready) throw new Error(`harness page did not boot: ${state?.error ?? 'timeout'}`);
    const bootMs = Date.now() - t0;
    const info = await evaluate<Record<string, unknown>>(browser.cdp, 'window.__ewaHarness.info()');
    log(`page ready in ${(bootMs / 1000).toFixed(1)} s — ${String((info['caps'] as { adapter?: string } | undefined)?.adapter ?? '?')}`);
    const b = browser;
    return {
      browser: b, server, info, bootMs,
      close: async () => { process.removeListener('SIGINT', onSignal); await closeAll(); },
    };
  } catch (e) {
    process.removeListener('SIGINT', onSignal);
    await closeAll();
    throw e;
  }
}

export function machine(): Record<string, unknown> {
  const c = cpus();
  return { cpu: c[0]?.model ?? '?', cores: c.length, memoryGB: Math.round(totalmem() / 2 ** 30), os: `${platform()} ${release()}`, node: process.version };
}

// ---- PNG (decode for the screenshot checks) ------------------------------------------------------------------------

export interface Image { readonly width: number; readonly height: number; readonly channels: 3 | 4; readonly data: Uint8Array }

/** Decodes an 8-bit, non-interlaced RGB / RGBA PNG (what `Page.captureScreenshot` writes). */
export function decodePng(buf: Buffer): Image {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let width = 0; let height = 0; let depth = 0; let color = 0; let interlace = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]!; color = body[9]!; interlace = body[12]!; }
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || (color !== 2 && color !== 6) || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, colour ${color}, interlace ${interlace})`);
  const channels = color === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[dst + x - channels]! : 0;
      const b = y > 0 ? out[dst - stride + x]! : 0;
      const c = x >= channels && y > 0 ? out[dst - stride + x - channels]! : 0;
      const v = raw[src + x]!;
      let r: number;
      switch (f) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + b; break;
        case 3: r = v + ((a + b) >> 1); break;
        default: {
          const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
          r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        }
      }
      out[dst + x] = r & 255;
    }
  }
  return { width, height, channels, data: out };
}

export interface ImageStats {
  readonly width: number;
  readonly height: number;
  /** mean Rec.709 luma 0..255 */
  readonly meanLuma: number;
  /** share of pixels with luma < 8 (a camera inside geometry / a black frame reads ≈ 1) */
  readonly blackShare: number;
  /** share of pixels with R = G = B */
  readonly greyShare: number;
  /** mask variant: share of pixels at 0, at 255, and in between */
  readonly levels: { readonly zero: number; readonly full: number; readonly mid: number };
}

export function imageStats(img: Image): ImageStats {
  const n = img.width * img.height;
  let luma = 0; let black = 0; let grey = 0; let zero = 0; let full = 0;
  for (let i = 0; i < n; i++) {
    const o = i * img.channels;
    const r = img.data[o]!; const g = img.data[o + 1]!; const b = img.data[o + 2]!;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma += l;
    if (l < 8) black++;
    if (r === g && g === b) { grey++; if (r === 0) zero++; else if (r === 255) full++; }
  }
  const k = (v: number): number => Math.round((v / n) * 1e4) / 1e4;
  return { width: img.width, height: img.height, meanLuma: Math.round((luma / n) * 10) / 10, blackShare: k(black), greyShare: k(grey), levels: { zero: k(zero), full: k(full), mid: k(n - zero - full) } };
}

/** Share of pixels with value 255 (mask = 1.0) inside a CSS-px rect (dpr 1), clamped to the image. */
export function fullShareIn(img: Image, rect: readonly [number, number, number, number]): number | null {
  const x0 = Math.max(0, Math.floor(rect[0])); const y0 = Math.max(0, Math.floor(rect[1]));
  const x1 = Math.min(img.width, Math.ceil(rect[2])); const y1 = Math.min(img.height, Math.ceil(rect[3]));
  if (x1 <= x0 || y1 <= y0) return null;
  let full = 0; let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { n++; if (img.data[(y * img.width + x) * img.channels] === 255) full++; }
  return Math.round((full / n) * 1e4) / 1e4;
}
