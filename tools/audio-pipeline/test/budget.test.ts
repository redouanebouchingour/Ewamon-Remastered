/**
 * SPEC §40.6 / §40.4.7 — `public/audio/` ≤ 80 MB (Σ webm + Σ m4a ≤ 83 886 080 B). The estimate is asserted
 * always (an over-budget bible fails before generation); the real directory is asserted once `process` has
 * written it.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUDIO_BUDGET_BYTES, clipBytes, estimateBytes, measureBytes } from '../src/budget.js';
import { DEFAULT_PATHS } from '../src/paths.js';
import { loadSourceManifest } from '../src/plan.js';

const m = loadSourceManifest(DEFAULT_PATHS.manifest);
const built = existsSync(DEFAULT_PATHS.out) && measureBytes(DEFAULT_PATHS.out).files > 0;

describe('audio budget', () => {
  it('the ceiling is 80 MiB', () => {
    expect(AUDIO_BUDGET_BYTES).toBe(80 * 1024 * 1024);
  });

  it('the manifest estimate fits, with every class accounted', () => {
    const e = estimateBytes(m);
    expect(e.total).toBeLessThanOrEqual(AUDIO_BUDGET_BYTES);
    expect(e.stems + e.ambience + e.sfx).toBe(e.total);
    expect(e.stems).toBeGreaterThan(e.ambience);
    expect(e.ambience).toBeGreaterThan(e.sfx);
  });

  it('clip estimates scale with the §40.4.5 bitrates', () => {
    const s = clipBytes('stem', 10);
    expect(s.webm).toBeGreaterThan(10 * 96 * 125);
    expect(s.m4a).toBeGreaterThan(10 * 112 * 125);
    expect(clipBytes('sfx', 1).webm).toBeLessThan(clipBytes('stem', 1).webm);
  });

  it.skipIf(!built)(`the built public/audio/ fits${built ? '' : ' — SKIPPED: public/audio/ not built yet (run process)'}`, () => {
    expect(measureBytes(DEFAULT_PATHS.out).total).toBeLessThanOrEqual(AUDIO_BUDGET_BYTES);
  });
});
