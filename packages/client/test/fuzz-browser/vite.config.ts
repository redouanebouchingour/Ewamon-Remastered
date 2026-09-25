/**
 * Vite config for the `fuzz-browser.spec.ts` harness (SPEC §50.4.7, §50.5 M0): `index.html` + `main.ts` start
 * `worker.ts` as a module Web Worker. Playwright's `webServer` (root `playwright.config.ts`) runs
 * `vite build` + `vite preview` with this file, so the worker is the production bundle the client would ship,
 * served from `dist/` next to this file (gitignored by the root `dist/` rule).
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export const FUZZ_BROWSER_PORT = 4179;

export default defineConfig({
  root: here('.'),
  base: './',
  publicDir: false,
  logLevel: 'error', // zod's @__PURE__ comment-position notices are noise here
  resolve: {
    alias: [
      // core's legacy-content fixture is Node test code; in the browser these two return the same bytes (shims/)
      { find: /^node:fs$/, replacement: here('./shims/fs.ts') },
      { find: /^node:url$/, replacement: here('./shims/url.ts') },
    ],
  },
  worker: { format: 'es' },
  build: {
    outDir: here('./dist'),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 4096,
  },
  preview: { host: '127.0.0.1', port: FUZZ_BROWSER_PORT, strictPort: true },
});
