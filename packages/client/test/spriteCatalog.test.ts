/**
 * §20.4.4 sprite adapter + the §10.4.5 flipbook (amended 2026-10-06): `sprites[id].anim` → `SpriteFrame.anim`
 * (`frames → rects`, `delays → delaysMs`, `staticFrame`), `animAtlases` → render `AnimAtlasSet`s, a species' atlases
 * = its static atlases + its flipbooks, and `bindCatalogAtlas` routes each id to `bindAtlas` / `bindAnimAtlas`. Runs
 * on a small inline manifest and, when present, on the shipped `public/creatures/creatures.manifest.json`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEGENDARY_IDS, MYTHICAL_IDS, SPECIES } from '@ewa/content';
import type { AnimAtlasSet, AtlasSet } from '@ewa/render';
import { species as speciesDef } from '../src/data/content';
import type { CreatureManifest } from '../src/scene/spriteCatalog';
import { BACK_FULL_HEIGHT, FORM_AURA, auraOfSprite, bindCatalogAtlas, createSpriteCatalog, speciesAtlases } from '../src/scene/spriteCatalog';

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

describe('sprite catalog: battle-form auras', () => {
  it('a Majin / Tenjin form sprite carries its aura; the species own sprite and unknown forms carry none', () => {
    expect(auraOfSprite('hollowmane', 'hollowmane_rage')).toBe('majin');   // the shipped Rage Forms are Majin forms
    expect(auraOfSprite('thornback', 'thornback_tenjin')).toBe('tenjin');
    expect(auraOfSprite('infernomorel', 'infernomorel_majin')).toBe('majin');
    expect(auraOfSprite('hollowmane', undefined)).toBeUndefined();
    expect(auraOfSprite('hollowmane', 'hollowmane')).toBeUndefined();
    expect(auraOfSprite('hollowmane', 'hollowmane_zen')).toBeUndefined();
    expect(auraOfSprite('hollowmane', 'castlemaw_rage')).toBeUndefined();   // another species' form is not this one's
    expect(auraOfSprite('zenryu', 'zenryu_majin')).toBe('majin_gold');      // zenryu's Majin form is its Super Saiyan
    expect(auraOfSprite('zenryu', 'zenryu_tenjin')).toBe('tenjin');
    expect(Object.values(FORM_AURA).every((k) => k === 'majin' || k === 'tenjin')).toBe(true);
  });
});

describe.skipIf(!existsSync(REAL))('sprite catalog on the shipped manifest', () => {
  const m = JSON.parse(readFileSync(REAL, 'utf8')) as CreatureManifest;
  const cat = createSpriteCatalog(m, speciesDef);

  it('every shipped battle form with an aura gets it in its descriptor; the plain sprite gets none', () => {
    const forms = Object.keys(m.sprites).filter((id) => id.endsWith('_rage'));
    expect(forms.length).toBeGreaterThanOrEqual(2);
    for (const id of forms) {
      const sp = id.slice(0, -'_rage'.length);
      expect(cat.descriptor(sp, `t:${sp}`, 'normal', false, false, id)?.aura, id).toBe('majin');
      expect(cat.descriptor(sp, `t:${sp}`)?.aura, sp).toBeUndefined();
    }
  });

  it("astaroth's back stands its full height (BACK_FULL_HEIGHT); everyone else's back keeps the front's scale", () => {
    expect([...BACK_FULL_HEIGHT]).toEqual(['astaroth']);
    expect(cat.descriptor('astaroth', 't:astaroth')!.backFullHeight).toBe(true);
    expect(cat.descriptor('kygra', 't:kygra')!.backFullHeight).toBeUndefined();
  });

  it('the 10 legacy legendaries / mythicals and astaroth animate on both sides; nothing else does (hyoryu, the Elemutt line and kelvyre came as stills)', () => {
    const animated = Object.keys(m.sprites).filter((id) => cat.animAtlasesOf(id).length > 0).sort();
    // hyoryu (post-legacy legendary) was delivered as still sprites: it ships static until animated art exists
    // the Elemutt line and kelvyre (mythicals) likewise came as stills
    const stills = new Set(['hyoryu', 'elemutt', 'katamute', 'ravatar', 'kelvyre']);
    expect(animated).toEqual([...LEGENDARY_IDS, ...MYTHICAL_IDS].filter((id) => !stills.has(id)).sort());
    for (const id of animated) {
      const d = cat.descriptor(id, `t:${id}`)!;
      for (const side of ['front', 'back'] as const) {
        const a = d[side].anim!;
        const set = cat.animAtlas(a.atlas)!;
        expect(a.rects.length, `${id}/${side}`).toBe(a.delaysMs.length);
        // astaroth's back loop (from the user's second video, 2026-10-27) is 25 pages, its static frame the widest pose (frame-select.json)
        expect(a.rects.length, `${id}/${side}`).toBeGreaterThanOrEqual(18);
        expect(a.staticFrame).toBe(id === 'astaroth' && side === 'back' ? 21 : 0);
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

describe('sprite catalog: true heights', () => {
  it("passes the species' height, a taller form's, and each side's measured body share", () => {
    const tall = { ...rect(0.5), bodyV: 0.7 };
    const m: CreatureManifest = {
      ...INLINE,
      sprites: { hyoryu: { front: tall, back: rect(0), sizeScale: 1.45, home: 'a-000' }, hyoryu_majin: { front: rect(0.5), back: rect(0), sizeScale: 1.45, home: 'a-000' }, stray: { front: rect(0.5), back: rect(0), sizeScale: 1, home: 'a-000' } },
    };
    const lookup = (id: string) => SPECIES.find((s) => s.id === id);
    const cat = createSpriteCatalog(m, lookup, '/creatures/');
    const hyoryu = lookup('hyoryu')!;
    const d = cat.descriptor('hyoryu', 'x')!;
    expect(d.heightM).toBe(hyoryu.heightM);
    expect(d.front.bodyV).toBe(0.7);
    expect(d.back.bodyV).toBeUndefined();                             // an older manifest's side: the renderer's 0.86
    expect(cat.descriptor('hyoryu', 'y', 'normal', false, false, 'hyoryu_majin')!.heightM).toBe(hyoryu.battleForm!.heightM);
    expect(cat.descriptor('stray', 'z')!.heightM).toBeCloseTo(1.376, 9);   // no species: the legacy sizeScale's body
    expect(d.backFullHeight).toBeUndefined();
  });
});
