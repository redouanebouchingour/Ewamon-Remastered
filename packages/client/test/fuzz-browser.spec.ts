/**
 * SPEC §50.4.7 `fuzz-browser.spec.ts` — `PLAN.md`'s M0 exit criterion (§50.5 M0): "a headless battle between two
 * seeded teams resolves identically on client and server 1,000 times", run once in Node and once in a browser worker.
 *
 * Browser side: `fuzz-browser/worker.ts` (Vite production bundle, served by the root config's `webServer`) runs core's
 * `fuzzBattles({ seeds: 1000 })` and rebuilds all 21 `@ewa/content` heightfields inside a dedicated Web Worker in
 * Chrome. Node side: `packages/core/test/fuzz-digests.json` (committed; `determinism.test.ts` asserts Node produces it)
 * and `packages/content/dist/content-report.json`, regenerated here by content's own `validate` CLI so it always
 * describes the current source. Every one of the 1000 battle digests and 21 heightfield digests must be equal.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { FuzzBrowserFailure, FuzzBrowserResult } from './fuzz-browser/worker';

const repo = (p: string): string => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

interface CommittedDigests {
  readonly seeds: number;
  readonly maxTurns: number;
  readonly digests: readonly string[];
}

interface ContentReport {
  readonly ok: boolean;
  readonly heightfields: Readonly<Record<string, { readonly digest: string }>>;
}

/** `pnpm --filter @ewa/content run validate`, without depending on pnpm being on PATH: node + tsx's CLI. */
function writeContentReport(): ContentReport {
  const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
  execFileSync(process.execPath, [tsxCli, 'scripts/validate-cli.ts'], { cwd: repo('packages/content'), stdio: 'pipe' });
  return JSON.parse(readFileSync(repo('packages/content/dist/content-report.json'), 'utf8')) as ContentReport;
}

test('M0: 1000/1000 fuzz battle digests and 21/21 heightfield digests from a Chrome Web Worker equal Node', async ({ page }) => {
  const committed = JSON.parse(readFileSync(repo('packages/core/test/fuzz-digests.json'), 'utf8')) as CommittedDigests;
  expect(committed.seeds).toBe(1000);
  expect(committed.maxTurns).toBe(200);
  expect(committed.digests).toHaveLength(1000);
  const report = writeContentReport();
  expect(report.ok).toBe(true);
  const zones = Object.keys(report.heightfields).sort();
  expect(zones).toHaveLength(21);

  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  const started = Date.now();
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __fuzzBrowser?: unknown }).__fuzzBrowser !== undefined, undefined, { timeout: 280_000, polling: 250 });
  const wallMs = Date.now() - started;
  const r = await page.evaluate(() => (window as unknown as { __fuzzBrowser: FuzzBrowserResult | FuzzBrowserFailure }).__fuzzBrowser);
  expect(pageErrors).toEqual([]);
  if (!r.ok) throw new Error(`worker failed: ${r.error}`);

  // it ran in a dedicated worker, in Chrome
  expect(r.inWorker).toBe(true);
  expect(r.userAgent).toContain('Chrome/');

  // 1000 battles, every one terminated, every digest equal to Node's
  expect(r.battles).toBe(committed.seeds);
  expect(r.unfinished).toEqual([]);
  expect(r.digests).toHaveLength(committed.digests.length);
  const battleMismatches = committed.digests.flatMap((d, seed) => (r.digests[seed] === d ? [] : [`seed ${seed}: browser ${r.digests[seed]} != node ${d}`]));
  expect(battleMismatches, `${battleMismatches.length} of ${committed.seeds} battle digests differ`).toEqual([]);

  // 21 heightfields rebuilt in the worker, every digest equal to Node's
  expect(Object.keys(r.heightfields).sort()).toEqual(zones);
  const fieldMismatches = zones.flatMap((z) => (r.heightfields[z] === report.heightfields[z]!.digest ? [] : [`${z}: browser ${r.heightfields[z]} != node ${report.heightfields[z]!.digest}`]));
  expect(fieldMismatches, `${fieldMismatches.length} of ${zones.length} heightfield digests differ`).toEqual([]);

  const summary = `${committed.seeds}/${committed.seeds} battle digests (${r.turns} turns, ${r.fuzzMs} ms) · ${zones.length}/${zones.length} heightfields (${r.heightfieldMs} ms) · page wall ${wallMs} ms · ${r.userAgent}`;
  test.info().annotations.push({ type: 'M0', description: summary });
  console.log(`fuzz-browser: ${summary}`);
});
