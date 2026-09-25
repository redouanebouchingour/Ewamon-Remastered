/**
 * SPEC §50.4.7 `fuzz-browser.spec.ts` / §50.5 M0 — the browser half of the determinism criterion, run in a
 * dedicated Web Worker (bundled by Vite: `vite.config.ts` next to this file).
 *
 * 1. `fuzzBattles({ seeds: 1000 })` — core's own §2.20 fuzz driver over the same legacy ContentIndex that produced
 *    `packages/core/test/fuzz-digests.json` in Node (`determinism.test.ts`). The fixture reads
 *    `.design/legacy/ewamon.js` through `node:fs`; the Vite config aliases `node:fs` / `node:url` to `shims/`,
 *    which hand it the same file inlined at build time (`?raw`), so the worker evaluates byte-identical data.
 * 2. `buildHeightfield(zone)` for all 21 `@ewa/content` zones (not the memoised getter: every field is rebuilt
 *    here), digests compared by the spec with `packages/content/dist/content-report.json` (written in Node by
 *    `pnpm --filter @ewa/content run validate`).
 */
// The M0 criterion is by definition core's own fuzz driver and fixture (fuzz-digests.json is their output). They are
// test code — no package export exists — so they are imported by path, not through the '@ewa/core' surface.
// eslint-disable-next-line ewa/no-cross-package-relative-imports -- core's test fuzz driver is not a package export
import { fuzzBattles } from '../../../core/test/fuzz';
// eslint-disable-next-line ewa/no-cross-package-relative-imports -- the legacy ContentIndex the digests were made with
import { buildLegacyContent } from '../../../core/test/fixtures/legacyContent';
import { allZones, buildHeightfield } from '@ewa/content';

const SEEDS = 1000;
/** determinism.test.ts MAX_TURNS — the value fuzz-digests.json records */
const MAX_TURNS = 200;

export interface FuzzBrowserResult {
  readonly ok: true;
  readonly inWorker: boolean;
  readonly userAgent: string;
  readonly battles: number;
  readonly turns: number;
  readonly unfinished: readonly number[];
  readonly digests: readonly string[];
  readonly heightfields: Readonly<Record<string, string>>;
  readonly fuzzMs: number;
  readonly heightfieldMs: number;
}

export interface FuzzBrowserFailure {
  readonly ok: false;
  readonly error: string;
}

interface WorkerScope {
  postMessage(message: FuzzBrowserResult | FuzzBrowserFailure): void;
  addEventListener(type: 'message', listener: () => void): void;
}

const scope = self as unknown as WorkerScope;

function run(): FuzzBrowserResult {
  const t0 = performance.now();
  const content = buildLegacyContent();
  const fuzz = fuzzBattles({ seeds: SEEDS, content, maxTurns: MAX_TURNS });
  const t1 = performance.now();
  const heightfields: Record<string, string> = {};
  for (const zone of allZones()) heightfields[zone.id] = buildHeightfield(zone).digest;
  const t2 = performance.now();
  return {
    ok: true,
    // a dedicated worker has no `document` and its global scope is not a Window
    inWorker: typeof (globalThis as { document?: unknown }).document === 'undefined' && typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope === 'function',
    userAgent: navigator.userAgent,
    battles: fuzz.battles,
    turns: fuzz.turns,
    unfinished: fuzz.unfinished,
    digests: fuzz.digests,
    heightfields,
    fuzzMs: Math.round(t1 - t0),
    heightfieldMs: Math.round(t2 - t1),
  };
}

scope.addEventListener('message', () => {
  try {
    scope.postMessage(run());
  } catch (e) {
    scope.postMessage({ ok: false, error: e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e) });
  }
});
