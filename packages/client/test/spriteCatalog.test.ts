/**
 * §20.4.4 sprite adapter + the §10.4.5 flipbook (amended 2026-10-06): `sprites[id].anim` → `SpriteFrame.anim`
 * (`frames → rects`, `delays → delaysMs`, `staticFrame`), `animAtlases` → render `AnimAtlasSet`s, a species' atlases
 * = its static atlases + its flipbooks, and `bindCatalogAtlas` routes each id to `bindAtlas` / `bindAnimAtlas`. Runs
 * on a small inline manifest and, when present, on the shipped `public/creatures/creatures.manifest.json`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEGENDARY_IDS, MYTHICAL_IDS } from '@ewa/content';
import type { AnimAtlasSet, AtlasSet } from '@ewa/render';
import { species as speciesDef } from '../src/data/content';
import type { CreatureManifest } from '../src/scene/spriteCatalog';
import { bindCatalogAtlas, createSpriteCatalog, speciesAtlases } from '../src/scene/spriteCatalog';

const map = (u: string) => ({ url: `atlases/${u}.webp`, mips: [1, 2, 3].map((i) => `atlases/${u}.m${i}.webp`), bytes: 10 });
const amap = (u: string) => ({ url: `anim/${u}.webp`, mips: [1, 2, 3].map((i) => `anim/${u}.m${i}.webp`), bytes: 100 });
const rect = (x: number) => ({ atlas: 'a-000', px: [x * 2048, 0, 1024, 1024] as const, uv: [x, 0.5, x + 0.5, 1] as const, footV: 0.08, aspect: 1 });
const frames = (n: number): [number, number, number, number][] =>
  Array.from({ length: n }, (_u, i) => [(i % 2) * 0.5, i < 2 ? 0.5 : 0, (i % 2) * 0.5 + 0.5, i < 2 ? 1 : 0.5]);

const INLINE: CreatureManifest = {
  version: 2,
  atlases: [{ id: 'a-000', species: ['flap', 'still'], size: 2048, albedo: map('a.albedo'), normal: map('a.normal'), emissive: map('a.emissive'), normalScale: 0.5 }],
  zones: { mirevale: ['a-000'] },
  sprites: {
    flap: {
      front: rect(0.5), back: rect(0), sizeScale: 1.2, home: 'a-000',
      anim: {
        front: { atlas: 'anim-flap-front', frames: frames(4), delays: [125, 125, 125, 125], staticFrame: 2 },
        back: { atlas: 'anim-flap-back', frames: frames(3), delays: [100, 100, 100], staticFrame: 0 },
      },
    },
    still: { front: rect(0.5), back: rect(0), sizeScale: 1, home: 'a-000' },
  },
  animAtlases: [
    { id: 'anim-flap-back', species: 'flap', side: 'back', width: 1024, height: 1024, cell: 512, albedo: amap('b.albedo'), normal: amap('b.normal'), emissive: amap('b.emissive'), normalScale: 0.5 },
    { id: 'anim-flap-front', species: 'flap', side: 'front', width: 1024, height: 1024, cell: 512, albedo: amap('f.albedo'), normal: amap('f.normal'), emissive: amap('f.emissive'), normalScale: 0.5 },
  ],
};

describe('sprite catalog: flipbooks', () => {
  it('maps sprites[id].anim into SpriteFrame.anim and animAtlases into AnimAtlasSets', () => {
    const cat = createSpriteCatalog(INLINE, () => undefined, '/creatures/');
    const d = cat.descriptor('flap', 'spawn:1')!;
    expect(d.front.rect).toEqual([0.5, 0.5, 1, 1]);                    // the static frame stays the static rect
    expect(d.front.anim).toEqual({ atlas: 'anim-flap-front', rects: frames(4), delaysMs: [125, 125, 125, 125], staticFrame: 2 });
    expect(d.back.anim?.atlas).toBe('anim-flap-back');
    expect(d.back.anim?.delaysMs).toEqual([100, 100, 100]);
    expect(cat.descriptor('still', 'x')!.front.anim).toBeUndefined();
    const set = cat.animAtlas('anim-flap-front')!;
    expect(set).toEqual({
      id: 'anim-flap-front', width: 1024, height: 1024, cell: 512, normalScale: 0.5,
      albedo: { url: '/creatures/anim/f.albedo.webp', mips: [1, 2, 3].map((i) => `/creatures/anim/f.albedo.m${i}.webp`) },
      normal: { url: '/creatures/anim/f.normal.webp', mips: [1, 2, 3].map((i) => `/creatures/anim/f.normal.m${i}.webp`) },
      emissive: { url: '/creatures/anim/f.emissive.webp', mips: [1, 2, 3].map((i) => `/creatures/anim/f.emissive.m${i}.webp`) },
    });
    expect(cat.animAtlas('a-000')).toBeNull();
    expect(cat.atlas('anim-flap-front')).toBeNull();
    expect(cat.animAtlasesOf('flap')).toEqual(['anim-flap-front', 'anim-flap-back']);
    expect(cat.animAtlasesOf('still')).toEqual([]);
    expect(speciesAtlases(cat, 'flap')).toEqual(['a-000', 'anim-flap-front', 'anim-flap-back']);
    expect(speciesAtlases(cat, 'still')).toEqual(['a-000']);
    // one side = its static atlas + that side's flipbook (what a view binds — creatureTextures.ts)
    expect(cat.sideAtlases('flap', 'front')).toEqual({ atlas: 'a-000', anim: 'anim-flap-front' });
    expect(cat.sideAtlases('flap', 'back')).toEqual({ atlas: 'a-000', anim: 'anim-flap-back' });
    expect(cat.sideAtlases('still', 'back')).toEqual({ atlas: 'a-000', anim: null });
    expect(cat.sideAtlases('nobody', 'front')).toBeNull();
    expect(cat.bytesOf(['a-000', 'anim-flap-front'])).toBe(30 + 300);
  });

  it('a flipbook whose atlas is not listed stays static (no dangling bind)', () => {
    const m: CreatureManifest = { ...INLINE, animAtlases: INLINE.animAtlases!.filter((a) => a.side === 'back') };
    const cat = createSpriteCatalog(m, () => undefined);
    const d = cat.descriptor('flap', 'k')!;
    expect(d.front.anim).toBeUndefined();
    expect(d.back.anim?.atlas).toBe('anim-flap-back');
    expect(cat.animAtlasesOf('flap')).toEqual(['anim-flap-back']);
    expect(cat.sideAtlases('flap', 'front')).toEqual({ atlas: 'a-000', anim: null });
  });

  it('bindCatalogAtlas routes static ids to bindAtlas and flipbook ids to bindAnimAtlas', async () => {
    const cat = createSpriteCatalog(INLINE, () => undefined);
    const calls: string[] = [];
    const pool = {
      bindAtlas: async (s: AtlasSet) => { calls.push(`static:${s.id}`); },
      bindAnimAtlas: async (s: AnimAtlasSet) => { calls.push(`anim:${s.id}`); },
    };
    for (const id of speciesAtlases(cat, 'flap')) await bindCatalogAtlas(pool, cat, id);
    expect(bindCatalogAtlas(pool, cat, 'nope')).toBeNull();
    expect(calls).toEqual(['static:a-000', 'anim:anim-flap-front', 'anim:anim-flap-back']);
  });
});

const REAL = fileURLToPath(new URL('../public/creatures/creatures.manifest.json', import.meta.url));

describe.skipIf(!existsSync(REAL))('sprite catalog on the shipped manifest', () => {
  const m = JSON.parse(readFileSync(REAL, 'utf8')) as CreatureManifest;
  const cat = createSpriteCatalog(m, speciesDef);

  it('the 10 legendaries / mythicals animate on both sides; nothing else does', () => {
    const animated = Object.keys(m.sprites).filter((id) => cat.animAtlasesOf(id).length > 0).sort();
    expect(animated).toEqual([...LEGENDARY_IDS, ...MYTHICAL_IDS].sort());
    for (const id of animated) {
      const d = cat.descriptor(id, `t:${id}`)!;
      for (const side of ['front', 'back'] as const) {
        const a = d[side].anim!;
        const set = cat.animAtlas(a.atlas)!;
        expect(a.rects.length, `${id}/${side}`).toBe(a.delaysMs.length);
        expect(a.rects.length, `${id}/${side}`).toBeGreaterThanOrEqual(24);
        expect(a.staticFrame).toBe(0);
        expect(set.cell).toBe(512);
        expect(Math.max(set.width, set.height)).toBeLessThanOrEqual(8192);
        for (const r of a.rects) {
          expect((r[2] - r[0]) * set.width, `${id}/${side} cell w`).toBeCloseTo(512, 6);
          expect((r[3] - r[1]) * set.height, `${id}/${side} cell h`).toBeCloseTo(512, 6);
        }
        for (const ms of a.delaysMs) expect([100, 125]).toContain(ms);
      }
    }
  });
});
