/**
 * §10.4.5 flipbook (amended 2026-10-06; node, no GPU): page timing from the source delays, per-instance phase, the
 * static frame until the anim atlas lands then one re-point, one material per anim atlas, rect writes only on a page
 * change, no heap growth while playing, the pause on faint (pose and `setFaint`), hitstop (dt × timeScale = 0) holds
 * it, the dissolve holes sized per anim cell, `setFacing` switching flipbooks, and the anim atlas's texture contract.
 */
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { LinearMipmapLinearFilter, NearestFilter, RedFormat, SRGBColorSpace } from 'three/webgpu';
import type { SpriteAnim, SpriteDescriptor } from '../src/contracts.js';
import { animAtlasSetBytes, chainBytesWH, loadAnimAtlasTextures, type AnimAtlasSet, type AtlasDecoder, type AtlasSet } from '../src/sprites/atlas.js';
import { BillboardPool } from '../src/sprites/billboard.js';
import { BILLBOARD, flipbookFrame, flipbookPhase01, flipbookTotalMs } from '../src/sprites/tables.js';

// ---- fixtures ---------------------------------------------------------------------------------------------------

function fakeDecoder(): AtlasDecoder {
  return {
    decode: async (url, crop) => {
      const lv = /\.m(\d)\./.exec(url);
      const level = lv ? Number(lv[1]) : 0;
      const anim = url.includes('/anim/');
      const half = url.includes('.normal.') ? 2 : 1;
      const w = (anim ? 3072 : 2048) / half;
      const h = (anim ? 2048 : 2048) / half;
      return { width: crop ? crop[2] : w >> level, height: crop ? crop[3] : h >> level, close: () => {} };
    },
  };
}

function staticSet(id: string): AtlasSet {
  const m = (k: string) => ({ url: `/c/${id}.${k}.webp`, mips: [1, 2, 3].map((i) => `/c/${id}.${k}.m${i}.webp`) });
  return { id, albedo: m('albedo'), normal: m('normal'), emissive: m('emissive'), size: 2048, normalScale: 0.5 };
}

function animSet(id: string): AnimAtlasSet {
  const m = (k: string) => ({ url: `/c/anim/${id}.${k}.webp`, mips: [1, 2, 3].map((i) => `/c/anim/${id}.${k}.m${i}.webp`) });
  return { id, albedo: m('albedo'), normal: m('normal'), emissive: m('emissive'), width: 3072, height: 2048, cell: 512, normalScale: 0.5 };
}

/** 24 pages of 125 ms on a 6 × 4 grid of 512² cells in a 3072 × 2048 atlas (the shipped WebP legendaries). */
function anim(atlas: string, delays: readonly number[] = Array(24).fill(125) as number[], staticFrame = 0): SpriteAnim {
  const rects = delays.map((_d, i) => {
    const x = (i % 6) * 512;
    const y = Math.floor(i / 6) * 512;
    return [x / 3072, 1 - (y + 512) / 2048, (x + 512) / 3072, 1 - y / 2048] as const;
  });
  return { atlas, rects, delaysMs: delays, staticFrame };
}

function desc(id: string, over: Partial<SpriteDescriptor> = {}): SpriteDescriptor {
  const f = (x: number, side: 'front' | 'back') => ({
    atlas: 'a-035', rect: [x, 0.5, x + 0.5, 1] as const, px: [x * 2048, 0, 1024, 1024] as const, footV: 0.08, aspect: 1, anim: anim(`anim-legend-${side}`),
  });
  return { id, front: f(0.5, 'front'), back: f(0, 'back'), sizeScale: 1, types: ['Dragon'], variant: 'normal', isAlpha: false, ...over };
}

const rectOf = (b: { userDataRecord: { rect: { x: number; y: number; z: number; w: number } } }): number[] => {
  const r = b.userDataRecord.rect;
  return [r.x, r.y, r.z, r.w];
};
const materialOf = (b: { object: { children: unknown[] } }): { uuid: string } => (b.object.children[0] as { material: { uuid: string } }).material;

// ---- pure timing -------------------------------------------------------------------------------------------------

describe('§10.4.5 flipbook timing (pure)', () => {
  it('pages follow the source delays and loop', () => {
    const d = Array(24).fill(125) as number[];
    const total = flipbookTotalMs(d);
    expect(total).toBe(3000);
    expect(flipbookFrame(d, total, 0)).toBe(0);
    expect(flipbookFrame(d, total, 124.999)).toBe(0);
    expect(flipbookFrame(d, total, 125)).toBe(1);
    expect(flipbookFrame(d, total, 2999)).toBe(23);
    expect(flipbookFrame(d, total, 3000)).toBe(0);
    expect(flipbookFrame(d, total, 3000 * 7 + 1250)).toBe(10);
    expect(flipbookFrame(d, total, -125)).toBe(23);
    // per-page delays (a GIF may vary them)
    const v = [100, 300, 50];
    expect(flipbookTotalMs(v)).toBe(450);
    expect([0, 99, 100, 399, 400, 449, 450].map((t) => flipbookFrame(v, 450, t))).toEqual([0, 0, 1, 1, 2, 2, 0]);
    // degenerate: no positive delay shows page 0
    expect(flipbookFrame([0, 0], 0, 1234)).toBe(0);
    expect(flipbookFrame(d, total, Number.NaN)).toBe(0);
  });

  it('the per-instance phase is deterministic, in [0, 1), and differs between ids', () => {
    expect(flipbookPhase01('spawn:1')).toBe(flipbookPhase01('spawn:1'));
    const ids = Array.from({ length: 50 }, (_u, i) => `spawn:${i}`);
    const ph = ids.map(flipbookPhase01);
    for (const p of ph) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
    expect(new Set(ph.map((p) => Math.floor(p * 24))).size).toBeGreaterThan(12);   // spread over the 24 pages
  });
});

// ---- the pool --------------------------------------------------------------------------------------------------

describe('§10.4.5 flipbook on CreatureBillboard', () => {
  it('shows the static frame until the anim atlas lands, then plays it on one anim material', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(staticSet('a-035'));
    const b = pool.acquire(desc('legend:1'));
    expect(b.bound).toBe(true);
    expect(b.animated).toBe(false);
    expect(b.animFrame).toBe(-1);
    expect(rectOf(b)).toEqual([0.5, 0.5, 1, 1]);
    const staticMat = materialOf(b).uuid;
    expect(b.userDataRecord.dissolveCells.x).toBe(BILLBOARD.dissolveCells);

    await pool.bindAnimAtlas(animSet('anim-legend-front'));
    expect(b.animated).toBe(true);
    const animMat = materialOf(b).uuid;
    expect(animMat).not.toBe(staticMat);
    const want = flipbookFrame(Array(24).fill(125) as number[], 3000, flipbookPhase01('legend:1') * 3000);
    expect(b.animFrame).toBe(want);
    expect(rectOf(b)).toEqual([...anim('x').rects[want]!]);
    // holes sized per anim cell: 512 per cell edge → 3072 × 2048 per uv unit (1 texel of the 512² cell)
    expect(b.userDataRecord.dissolveCells.x).toBeCloseTo(3072, 6);
    expect(b.userDataRecord.dissolveCells.y).toBeCloseTo(2048, 6);
    // a second creature of the species shares the anim material (one material per atlas) at its own phase
    const c = pool.acquire(desc('legend:2'));
    expect(materialOf(c).uuid).toBe(animMat);
    expect(pool.stats().atlases).toBe(2);
    b.dispose(); c.dispose();
    pool.dispose();
  });

  it('pages advance with update(dt) at the source delays, from a per-instance phase; rect writes only on a page change', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(staticSet('a-035'));
    await pool.bindAnimAtlas(animSet('anim-legend-front'));
    const a = pool.acquire(desc('legend:a'));
    const b = pool.acquire(desc('legend:b'));
    const start = (id: string): number => flipbookPhase01(id) * 3000;
    let t = 0;
    const seen = new Set<number>();
    const ra = a.userDataRecord.rect;
    let writes = 0;
    const orig = ra.set.bind(ra);
    ra.set = ((x: number, y: number, z: number, w: number) => { writes++; return orig(x, y, z, w); }) as typeof ra.set;
    const mat = materialOf(a);
    for (let i = 0; i < 600; i++) {               // 10 s at 60 fps
      pool.update(1000 / 60);
      t += 1000 / 60;
      expect(a.animFrame).toBe(flipbookFrame(a.descriptor.front.anim!.delaysMs, 3000, t + start('legend:a')));
      expect(b.animFrame).toBe(flipbookFrame(b.descriptor.front.anim!.delaysMs, 3000, t + start('legend:b')));
      seen.add(a.animFrame);
      expect(materialOf(a)).toBe(mat);            // never switches material while playing
    }
    expect(seen.size).toBe(24);
    // 10 s = 80 page changes (± the first partial page); one 4-scalar write each, none in between
    expect(writes).toBeGreaterThanOrEqual(79);
    expect(writes).toBeLessThanOrEqual(81);
    expect(a.animFrame).not.toBe(b.animFrame);    // these two ids are phase-shifted
    pool.dispose();
  });

  it('pauses on faint (pose and setFaint), holds under hitstop, resumes on enter / setFaint(0)', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(staticSet('a-035'));
    await pool.bindAnimAtlas(animSet('anim-legend-front'));
    const b = pool.acquire(desc('legend:f'));
    for (let i = 0; i < 10; i++) pool.update(50);
    b.setPose('faint', 900);
    expect(b.animPaused).toBe(true);
    const held = b.animFrame;
    const heldRect = rectOf(b);
    for (let i = 0; i < 120; i++) pool.update(1000 / 60);   // the 900 ms faint and beyond
    expect(b.animFrame).toBe(held);
    expect(rectOf(b)).toEqual(heldRect);
    expect(b.userDataRecord.dissolve).toBe(1);
    b.setPose('enter', 450);
    expect(b.animPaused).toBe(false);
    pool.update(125);
    expect(b.animFrame).toBe((held + 1) % 24);
    // the timeline's resync path: setFaint(1) holds, setFaint(0) releases
    b.setFaint(1);
    const f2 = b.animFrame;
    for (let i = 0; i < 30; i++) pool.update(125);
    expect(b.animFrame).toBe(f2);
    b.setFaint(0);
    pool.update(125);
    expect(b.animFrame).toBe((f2 + 1) % 24);
    // hitstop: the pool is driven with dt × timeScale = 0 → the page holds without a pause flag
    const f3 = b.animFrame;
    for (let i = 0; i < 30; i++) pool.update(0);
    expect(b.animFrame).toBe(f3);
    // poses other than faint keep it playing (hurt flash, lunge)
    b.setPose('hurt', 240);
    pool.update(125);
    expect(b.animFrame).toBe((f3 + 1) % 24);
    pool.dispose();
  });

  it('setFacing switches to the other side’s flipbook (bound) or its static frame (not bound yet)', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(staticSet('a-035'));
    await pool.bindAnimAtlas(animSet('anim-legend-front'));
    const b = pool.acquire(desc('legend:s'));
    expect(b.animated).toBe(true);
    b.setFacing('back');
    expect(b.animated).toBe(false);
    expect(rectOf(b)).toEqual([0, 0.5, 0.5, 1]);
    await pool.bindAnimAtlas(animSet('anim-legend-back'));
    expect(b.animated).toBe(true);
    expect(pool.stats().atlases).toBe(3);
    b.setFacing('front');
    expect(b.animated).toBe(true);
    b.dispose();
    pool.releaseAtlas('anim-legend-back');
    pool.releaseAtlas('anim-legend-front');
    expect(pool.stats().atlases).toBe(1);          // released and unused → disposed
    pool.dispose();
  });

  it('a creature without anim never waits on, nor samples, a flipbook', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(staticSet('a-035'));
    const d = desc('plain');
    const plain: SpriteDescriptor = { ...d, front: { ...d.front, anim: undefined }, back: { ...d.back, anim: undefined } };
    const b = pool.acquire(plain);
    for (let i = 0; i < 100; i++) pool.update(16);
    expect(b.animated).toBe(false);
    expect(rectOf(b)).toEqual([0.5, 0.5, 1, 1]);
    pool.dispose();
  });

  it('playing 20 flipbooks for 3000 frames grows the heap by ≤ 64 KB between forced GCs', async () => {
    setFlagsFromString('--expose_gc');
    const gc = runInNewContext('gc') as () => void;
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(staticSet('a-035'));
    await pool.bindAnimAtlas(animSet('anim-legend-front'));
    for (let i = 0; i < 20; i++) pool.acquire(desc(`legend:${i}`));
    for (let i = 0; i < 300; i++) pool.update(1000 / 60);   // warm (JIT, inline caches)
    gc(); gc();
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 3000; i++) pool.update(1000 / 60);
    gc(); gc();
    const grew = process.memoryUsage().heapUsed - before;
    expect(grew).toBeLessThanOrEqual(64 * 1024);
    pool.dispose();
  });
});

describe('§10.4.1 anim atlas set (amended 2026-10-06)', () => {
  it('uploads 3 maps × [l0..l3] of a non-square grid with the atlas sampler contract and its byte estimate', async () => {
    const t = await loadAnimAtlasTextures(animSet('anim-x-front'), fakeDecoder());
    for (const tex of [t.albedo, t.normal, t.emissive]) {
      expect(tex.mipmaps).toHaveLength(4);
      expect(tex.magFilter).toBe(NearestFilter);
      expect(tex.minFilter).toBe(LinearMipmapLinearFilter);
      expect(tex.generateMipmaps).toBe(false);
    }
    expect((t.albedo.mipmaps![0] as unknown as { width: number; height: number }).height).toBe(2048);
    expect((t.normal.mipmaps![0] as unknown as { width: number }).width).toBe(1536);
    expect(t.albedo.colorSpace).toBe(SRGBColorSpace);
    expect(t.emissive.format).toBe(RedFormat);
    expect(t.size).toBe(3072);
    expect(t.bytes).toBe(animAtlasSetBytes(3072, 2048, 0.5));
    expect(animAtlasSetBytes(3072, 2048, 0.5)).toBe(chainBytesWH(3072, 2048, 4) + chainBytesWH(1536, 1024, 4) + chainBytesWH(3072, 2048, 1));
    expect(chainBytesWH(3072, 2048, 4)).toBe(4 * (3072 * 2048 + 1536 * 1024 + 768 * 512 + 384 * 256));
  });
});
