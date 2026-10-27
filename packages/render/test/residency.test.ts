/**
 * Creature texture residency, render's half (render IMPLEMENTATION-NOTES Part 9; node, no GPU): three 0.186's `Info`
 * counts each sprite map's level 0 twice (`mipmaps[0]` is level 0) and `infoOvercountBytes` is exactly that surplus, so
 * the corrected §50.2.2 metric reads a creature atlas at its GPU bytes; the pool's overcount follows its loaded sets;
 * `atlasUsers` / `atlasRefs` report binds and samplers; `setFlipbook(false)` re-points a card to its static frame and
 * stops sampling — and waiting for — its flipbook, so a released flipbook leaves while the card stays up.
 */
import { describe, expect, it } from 'vitest';
import Info from 'three/src/renderers/common/Info.js';
import type { Texture } from 'three/webgpu';
import type { SpriteAnim, SpriteDescriptor } from '../src/contracts.js';
import { infoOvercountBytes, loadAnimAtlasTextures, loadAtlasTextures, type AnimAtlasSet, type AtlasDecoder, type AtlasSet, type AtlasTextures } from '../src/sprites/atlas.js';
import { BillboardPool } from '../src/sprites/billboard.js';

function fakeDecoder(): AtlasDecoder {
  return {
    decode: async (url) => {
      const lv = /\.m(\d)\./.exec(url);
      const level = lv ? Number(lv[1]) : 0;
      const anim = url.includes('/anim/');
      const half = url.includes('.normal.') ? 2 : 1;
      return { width: ((anim ? 3072 : 2048) / half) >> level, height: (2048 / half) >> level, close: () => {} };
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

function anim(atlas: string): SpriteAnim {
  const rects = Array.from({ length: 24 }, (_u, i) => {
    const x = (i % 6) * 512;
    const y = Math.floor(i / 6) * 512;
    return [x / 3072, 1 - (y + 512) / 2048, (x + 512) / 3072, 1 - y / 2048] as const;
  });
  return { atlas, rects, delaysMs: Array(24).fill(125) as number[], staticFrame: 0 };
}

function desc(id: string): SpriteDescriptor {
  const f = (x: number, side: 'front' | 'back') => ({
    atlas: 'a-035', rect: [x, 0.5, x + 0.5, 1] as const, px: [x * 2048, 0, 1024, 1024] as const, footV: 0.08, aspect: 1, anim: anim(`anim-legend-${side}`),
  });
  return { id, front: f(0.5, 'front'), back: f(0, 'back'), heightM: 1.376, types: ['Dragon'], variant: 'normal', isAlpha: false };
}

const rectOf = (b: { userDataRecord: { rect: { x: number; y: number; z: number; w: number } } }): number[] => {
  const r = b.userDataRecord.rect;
  return [r.x, r.y, r.z, r.w];
};

/** three's own per-texture count (`Info._getTextureMemorySize`, the one `renderer.info.memory.texturesSize` sums). */
function infoCount(t: AtlasTextures): number {
  const info = new Info() as unknown as { _getTextureMemorySize(t: Texture): number };
  return info._getTextureMemorySize(t.albedo) + info._getTextureMemorySize(t.normal) + info._getTextureMemorySize(t.emissive);
}

describe('the §50.2.2 texture metric reads a sprite atlas at its GPU bytes', () => {
  it('three counts each map\'s level 0 twice; infoOvercountBytes is exactly that surplus (static and anim atlases)', async () => {
    const st = await loadAtlasTextures(staticSet('a-1'), fakeDecoder());
    const an = await loadAnimAtlasTextures(animSet('anim-x-front'), fakeDecoder());
    for (const t of [st, an]) {
      const l0 = t.albedo.image.width * t.albedo.image.height * 4 + t.normal.image.width * t.normal.image.height * 4 + t.emissive.image.width * t.emissive.image.height;
      expect(infoOvercountBytes(t)).toBe(l0);
      expect(infoCount(t)).toBe(t.bytes + l0);                // 1.75 × the four-level chains
      expect(infoCount(t) - infoOvercountBytes(t)).toBe(t.bytes);
    }
    expect(infoCount(an) / an.bytes).toBeCloseTo(1.753, 3);
  });

  it('the pool\'s overcount follows its loaded sets: binds add, releases and dispose take it back to 0', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(staticSet('a-035'));
    await pool.bindAnimAtlas(animSet('anim-legend-front'));
    const st = await loadAtlasTextures(staticSet('a-035'), fakeDecoder());
    const an = await loadAnimAtlasTextures(animSet('anim-legend-front'), fakeDecoder());
    expect(pool.infoOvercountBytes()).toBe(infoOvercountBytes(st) + infoOvercountBytes(an));
    expect(pool.atlasRefs('a-035')).toBe(1);
    pool.releaseAtlas('anim-legend-front');
    expect(pool.infoOvercountBytes()).toBe(infoOvercountBytes(st));
    // released while loading: disposed on arrival, never counted
    const p = pool.bindAnimAtlas(animSet('anim-legend-back'));
    pool.releaseAtlas('anim-legend-back');
    await p;
    expect(pool.infoOvercountBytes()).toBe(infoOvercountBytes(st));
    pool.dispose();
    expect(pool.infoOvercountBytes()).toBe(0);
  });
});

describe('CreatureBillboard.setFlipbook (client residency: a far creature drops its flipbook)', () => {
  it('false shows the static frame and stops sampling and waiting for the flipbook; true plays it again', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(staticSet('a-035'));
    await pool.bindAnimAtlas(animSet('anim-legend-front'));
    const b = pool.acquire(desc('legend:1'));
    expect(b.animated).toBe(true);
    expect(pool.atlasUsers('anim-legend-front')).toBe(1);
    expect(pool.atlasUsers('a-035')).toBe(0);
    b.setFlipbook(false);
    expect(b.flipbookEnabled).toBe(false);
    expect(b.animated).toBe(false);
    expect(b.bound).toBe(true);
    expect(rectOf(b)).toEqual([0.5, 0.5, 1, 1]);
    expect(pool.atlasUsers('anim-legend-front')).toBe(0);
    expect(pool.atlasUsers('a-035')).toBe(1);
    // released now, the flipbook leaves the GPU (nothing samples it) while the card stays up
    pool.releaseAtlas('anim-legend-front');
    expect(pool.stats().atlases).toBe(1);
    // a bind landing meanwhile does not re-point a card whose flipbook is off
    await pool.bindAnimAtlas(animSet('anim-legend-front'));
    expect(b.animated).toBe(false);
    b.setFlipbook(true);
    expect(b.animated).toBe(true);
    // on with the flipbook unbound: the static frame, then one re-point when it lands
    b.setFlipbook(false);
    pool.releaseAtlas('anim-legend-front');
    b.setFlipbook(true);
    expect(b.animated).toBe(false);
    await pool.bindAnimAtlas(animSet('anim-legend-front'));
    expect(b.animated).toBe(true);
    b.dispose();
    pool.dispose();
  });
});
