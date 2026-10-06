/**
 * Phase E5 — the client game specs (`slice-e2e`, `no-dom-in-frame`, `first-frame`, `dof-mask`) on their own, without
 * the root config's global `webServer` (the fuzz harness on the fixed port 4179, which another Playwright run may hold).
 * Same project as `playwright.config.ts`'s `client-e2e`; each spec boots its own isolated server + client on free
 * ports (`packages/client/test/e2e/stack.ts`). Run: `pnpm exec playwright test -c playwright.e2e.config.ts [spec]`.
 */
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const e2e = base.projects?.find((p) => p.name === 'client-e2e');
if (e2e === undefined) throw new Error('playwright.config.ts has no client-e2e project');

export default defineConfig({
  testDir: base.testDir,
  outputDir: 'out/playwright-e2e',
  reporter: 'list',
  fullyParallel: false,
  workers: 1,
  forbidOnly: base.forbidOnly,
  retries: 0,
  timeout: 300_000,
  use: { channel: 'chrome', headless: true, trace: 'retain-on-failure' },
  projects: [e2e],
});
