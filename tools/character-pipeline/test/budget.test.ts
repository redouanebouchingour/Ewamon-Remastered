/**
 * `packages/client/public/characters/` — the REAL output (skipped when absent): the ≤ 3 MB budget (§40.6
 * proposal), the manifest's shape against the content vocabulary, the atlas maps decode to the declared size
 * with binary alpha, and a cached rebuild into a scratch directory is byte-identical and does no image work.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { BODIES, LOOKS } from '@ewa/content';
import { CHARACTERS_BUDGET_BYTES, MANIFEST_FILE, REAL_OUT_DIR, dirBytes, runBuild, type CharactersManifest } from '../src/bake.js';
import { CELL_H, CELL_W } from '../src/grid.js';
import { FOOT_ROW } from '../src/compose.js';

const MANIFEST = path.join(REAL_OUT_DIR, MANIFEST_FILE);

describe.skipIf(!existsSync(MANIFEST))('characters/ (real output)', () => {
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8')) as CharactersManifest;

  it(`totalBytes ≤ ${CHARACTERS_BUDGET_BYTES} (3 MiB) and equals the bytes on disk`, () => {
    expect(m.totalBytes).toBeLessThanOrEqual(CHARACTERS_BUDGET_BYTES);
    expect(dirBytes(REAL_OUT_DIR)).toBe(m.totalBytes);
  });

  it('carries every LOOK and every BODIES palette variant, with the full frame table', () => {
    for (const l of LOOKS) expect(m.looks[l], l).toBeDefined();
    for (const b of BODIES) if (b.palette !== null) expect(m.looks[`${b.look}:${b.palette}`]).toBeDefined();
    const counts: Record<string, Record<string, number>> = {
      D: { idle: 2, walk: 4, run: 4, wave: 2, cheer: 2 }, U: { idle: 2, walk: 4, run: 4 }, L: { idle: 2, walk: 4, run: 4 }, R: { idle: 2, walk: 4, run: 4 },
    };
    const a = m.atlases[0]!;
    for (const [id, look] of Object.entries(m.looks)) {
      expect(look.atlas).toBe(a.id);
      expect(look.heightPx, id).toBeGreaterThanOrEqual(38);
      for (const [facing, states] of Object.entries(counts)) {
        expect(Object.keys(look.frames[facing as 'D']).sort()).toEqual(Object.keys(states).sort());
        for (const [state, n] of Object.entries(states)) {
          const rects = look.frames[facing as 'D'][state as 'idle']!;
          expect(rects, `${id} ${facing} ${state}`).toHaveLength(n);
          for (const r of rects) {
            expect(r[0]).toBeGreaterThanOrEqual(0); expect(r[3]).toBeLessThanOrEqual(1);
            expect((r[2] - r[0]) * a.width).toBeCloseTo(CELL_W, 3);
            expect((r[3] - r[1]) * a.height).toBeCloseTo(CELL_H, 3);
          }
        }
      }
    }
  });

  it('world scale: 40 texels stand 1.7 m, the foot line one texel above the cell bottom', () => {
    expect(m.pixelsPerMetre).toBeCloseTo(40 / 1.7, 5);
    expect(m.cellM.h).toBeCloseTo(CELL_H / (40 / 1.7), 5);
    expect(m.footV).toBeCloseTo((CELL_H - FOOT_ROW) / CELL_H, 5);
  });

  it('the atlas maps decode to the declared size; albedo alpha is binary, normals are unit vectors', async () => {
    const a = m.atlases[0]!;
    const alb = await sharp(path.join(REAL_OUT_DIR, a.albedo)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([alb.info.width, alb.info.height]).toEqual([a.width, a.height]);
    let opaque = 0; let soft = 0;
    for (let i = 3; i < alb.data.length; i += 4) { if (alb.data[i] === 255) opaque++; else if (alb.data[i] !== 0) soft++; }
    expect(soft).toBe(0);
    expect(opaque).toBeGreaterThan(1000 * 44);
    const nrm = await sharp(path.join(REAL_OUT_DIR, a.normal)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([nrm.info.width, nrm.info.height]).toEqual([a.width, a.height]);
    let bad = 0;
    for (let i = 0; i < nrm.data.length; i += 4) {
      const x = (nrm.data[i]! - 128) / 127; const y = (nrm.data[i + 1]! - 128) / 127; const z = (nrm.data[i + 2]! - 128) / 127;
      if (Math.hypot(x, y, z) < 0.95 || z < 0.2) bad++;
    }
    expect(bad).toBe(0);
  });
});

describe('build determinism and cache', () => {
  it('a rebuild is byte-identical; the second run over the same sources is a cache hit', async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'ewa-chars-'));
    try {
      const a = await runBuild({ outDir: path.join(tmp, 'a'), qaDir: path.join(tmp, 'qa'), cacheDir: path.join(tmp, 'cache'), force: true });
      await runBuild({ outDir: path.join(tmp, 'b'), qaDir: path.join(tmp, 'qa2'), cacheDir: path.join(tmp, 'cache2'), force: true });
      expect(a.cacheHit).toBe(false);
      for (const f of a.files) expect(Buffer.compare(readFileSync(path.join(tmp, 'a', f)), readFileSync(path.join(tmp, 'b', f))), f).toBe(0);
      const c = await runBuild({ outDir: path.join(tmp, 'c'), qaDir: path.join(tmp, 'qa3'), cacheDir: path.join(tmp, 'cache') });
      expect(c.cacheHit).toBe(true);
      for (const f of a.files) expect(Buffer.compare(readFileSync(path.join(tmp, 'a', f)), readFileSync(path.join(tmp, 'c', f))), f).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120_000);
});
