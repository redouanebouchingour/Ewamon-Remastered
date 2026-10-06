// Drives a headless Chrome over CDP (the in-app Browser pane stops the game loop while hidden; HANDOFF "Dev tips").
// Start Chrome: chrome.exe --headless=new --remote-debugging-port=9446 --enable-unsafe-webgpu --enable-gpu
//   --ignore-gpu-blocklist --window-size=1440,900 --user-data-dir=<scratch dir> <url>
// Run: node scripts/cdp.mjs <steps.mjs> [--port 9446] [--shots <dir>]
// steps.mjs: `export default async ({ ev, shot, sleep, key, nav, send }) => result` — `ev(code)` evaluates an async
// function body in the page (return value by JSON), `shot(name)` writes <dir>/<name>.png, `key('e')` dispatches a key.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const port = Number(arg('--port', '9446'));
const shotsDir = resolve(arg('--shots', '.cdp-shots'));
mkdirSync(shotsDir, { recursive: true });
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pend = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr, timeout = 120000) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, timeout });
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text };
  return r.result?.result?.value;
};
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); const f = resolve(shotsDir, `${name}.png`); writeFileSync(f, Buffer.from(r.result.data, 'base64')); return f; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (k, code) => {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key: k, code: code ?? (k.length === 1 ? (/\d/.test(k) ? `Digit${k}` : `Key${k.toUpperCase()}`) : k), text: type === 'keyDown' && k.length === 1 ? k : undefined });
  }
};
const nav = (url) => send('Page.navigate', { url });
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const steps = await import(pathToFileURL(resolve(process.argv[2])).href);
try {
  console.log(JSON.stringify(await steps.default({ ev, shot, sleep, key, nav, send }), null, 1));
} catch (e) {
  console.error('STEP ERROR', e);
}
ws.close();
process.exit(0);
