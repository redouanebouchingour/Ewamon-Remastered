/**
 * Playwright (SPEC §50.4.7 browser specs, §50.5). Browser: the system Chrome (`channel: 'chrome'`, on Windows
 * `C:\Program Files\Google\Chrome\Application\chrome.exe`), so no Playwright browser download is needed.
 *
 * `webServer` builds and serves the `fuzz-browser.spec.ts` harness (`packages/client/test/fuzz-browser/`) with Vite
 * on every run — never reused, so the worker bundle is always the current source. vitest never sees these files: its
 * `include` is `*.test.ts(x)` only. Run: `pnpm test:browser` (= `playwright test`).
 *
 * Phase E5 (additive): the `client-e2e` project runs the game specs (`slice-e2e`, `no-dom-in-frame`, `first-frame`,
 * `dof-mask`) in Chrome with WebGPU; each spec boots its own isolated server + client on free ports
 * (`packages/client/test/e2e/stack.ts`), so no extra `webServer` is needed. Run one: `playwright test --project
 * client-e2e slice-e2e`, or `playwright test -c playwright.e2e.config.ts` (the same project without the fuzz `webServer`,
 * whose fixed port 4179 another run may hold).
 */
import { defineConfig } from '@playwright/test';

const FUZZ_PORT = 4179; // packages/client/test/fuzz-browser/vite.config.ts FUZZ_BROWSER_PORT
const FUZZ_CONFIG = 'packages/client/test/fuzz-browser/vite.config.ts';
/** Phase E5 game specs (own server + client per spec, WebGPU flags) */
const E2E_SPECS = ['**/slice-e2e.spec.ts', '**/no-dom-in-frame.spec.ts', '**/first-frame.spec.ts', '**/dof-mask.spec.ts'];

export default defineConfig({
  testDir: 'packages/client/test',
  testMatch: '**/*.spec.ts',
  // traces/screenshots of failures; `out/` is gitignored
  outputDir: 'out/playwright',
  reporter: 'list',
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env['CI'] !== undefined,
  retries: 0,
  timeout: 300_000,
  use: {
    channel: 'chrome',
    headless: true,
    baseURL: `http://127.0.0.1:${FUZZ_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chrome', use: { channel: 'chrome' }, testIgnore: E2E_SPECS },
    {
      name: 'client-e2e',
      testMatch: E2E_SPECS,
      use: {
        channel: 'chrome',
        viewport: { width: 1280, height: 800 }, // the client's minimum width (§20.2.3); fewer pixels for the dev iGPU
        // WebGPU headless (HANDOFF dev tips); no background throttling — slice-e2e drives two pages at once
        launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] },
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite build -c ${FUZZ_CONFIG} && pnpm exec vite preview -c ${FUZZ_CONFIG}`,
    url: `http://127.0.0.1:${FUZZ_PORT}/`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
