/**
 * The harness page: starts `worker.ts` as a module Web Worker, asks it to run once, and publishes the outcome as
 * `window.__fuzzBrowser` (read by `../fuzz-browser.spec.ts`) and as text in `#out` for a human looking at the page.
 */
import type { FuzzBrowserFailure, FuzzBrowserResult } from './worker';

declare global {
  interface Window {
    __fuzzBrowser?: FuzzBrowserResult | FuzzBrowserFailure;
  }
}

const out = document.getElementById('out')!;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

worker.addEventListener('message', (e: MessageEvent<FuzzBrowserResult | FuzzBrowserFailure>) => {
  window.__fuzzBrowser = e.data;
  out.textContent = e.data.ok
    ? `${e.data.battles} battles (${e.data.turns} turns) in ${e.data.fuzzMs} ms · ${Object.keys(e.data.heightfields).length} heightfields in ${e.data.heightfieldMs} ms`
    : `failed: ${e.data.error}`;
  worker.terminate();
});
worker.addEventListener('error', (e: ErrorEvent) => {
  window.__fuzzBrowser = { ok: false, error: `worker error: ${e.message} (${e.filename}:${e.lineno})` };
  out.textContent = window.__fuzzBrowser.error;
});

out.textContent = 'running…';
worker.postMessage('run');
