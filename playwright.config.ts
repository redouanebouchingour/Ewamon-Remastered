/**
 * Playwright (SPEC §50.4.7 browser specs, §50.5). Browser: the system Chrome (`channel: 'chrome'`, on Windows
 * `C:\Program Files\Google\Chrome\Application\chrome.exe`), so no Playwright browser download is needed.
 *
 * `webServer` builds and serves the `fuzz-browser.spec.ts` harness (`packages/client/test/fuzz-browser/`) with Vite
 * on every run — never reused, so the worker bundle is always the current source. vitest never sees these files: its
 * `include` is `*.test.ts(x)` only. Run: `pnpm test:browser` (= `playwright test`).
 */
import { defineConfig } from '@playwright/test';

const FUZZ_PORT = 4179; // packages/client/test/fuzz-browser/vite.config.ts FUZZ_BROWSER_PORT
const FUZZ_CONFIG = 'packages/client/test/fuzz-browser/vite.config.ts';

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
  projects: [{ name: 'chrome', use: { channel: 'chrome' } }],
  webServer: {
    command: `pnpm exec vite build -c ${FUZZ_CONFIG} && pnpm exec vite preview -c ${FUZZ_CONFIG}`,
    url: `http://127.0.0.1:${FUZZ_PORT}/`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
