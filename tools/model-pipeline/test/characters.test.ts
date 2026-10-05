/** SPEC §40.2.3 (amended 2026-10-05): the KayKit look table, the swatch recolour, the atlas, shapes and gait speeds. */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cellMean, composeAtlas, downscale, oklabToSrgb, parseHex, recolour, recolourCell, srgbToOklab, TILE_SIZE } from '../src/atlas.js';
import { atlasPlan, validateLookTable } from '../src/buildCharacters.js';
import {
  ACCESSORIES, LOOK_DEFS, NON_CLOTHING_SLOTS, PALETTE_VARIANTS, SHAPES, SLOTS, allLookIds, paletteOf,
} from '../src/characters.js';
import type { KayKitCharacter } from '../src/characters.js';
import { createIO } from '../src/glb.js';
import { RIG_JOINTS, buildAnimations, buildShape, gaitSpeed, partPrimitive, readRig } from '../src/kaykit.js';
import type { RgbaImage } from '../src/ktx2.js';
import { HAS_SOURCES, SRC_MODELS } from './helpers.js';

const KK = join(SRC_MODELS, 'kaykit-adventurers');

/** A 1024² image whose every cell is a vertical gradient from `top` to `bottom` (sRGB 0–255). */
function gradientImage(top: [number, number, number], bottom: [number, number, number]): RgbaImage {
  const W = 1024, H = 1024, d = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const t = (y % 256) / 255;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) d[i + k] = Math.round(top[k]! * (1 - t) + bottom[k]! * t);
      d[i + 3] = 255;
    }
  }
  return { width: W, height: H, data: d };
}

describe('look table', () => {
  it('validates: every palette slot exists on its body texture and variants recolour clothing only', () => {
    expect(() => validateLookTable()).not.toThrow();
    for (const [id, pal] of Object.entries(PALETTE_VARIANTS)) for (const slot of Object.keys(pal)) expect(NON_CLOTHING_SLOTS.has(slot), `${id} ${slot}`).toBe(false);
  });

  it('ships 24 looks: the 19 base looks and 5 variants, every shape used, no weapon accessories', () => {
    expect(allLookIds()).toHaveLength(24);
    expect(Object.keys(LOOK_DEFS)).toHaveLength(19);
    const used = new Set(Object.values(LOOK_DEFS).map((d) => d.shape));
    expect([...used].sort()).toEqual(Object.keys(SHAPES).sort());
    for (const id of Object.keys(ACCESSORIES)) expect(id).toMatch(/^(mug_|spellbook_|shield_)/);
    for (const [id, d] of Object.entries(LOOK_DEFS)) if (/^casual/.test(id) && d.accessory !== null) expect(d.accessory, id).toMatch(/^mug_/);
  });

  it('a variant keeps its base look\'s skin and hair and overrides clothing', () => {
    const base = paletteOf('casual2_male').palette;
    const dusk = paletteOf('casual2_male:dusk').palette;
    expect(dusk.skin).toBe(base.skin);
    expect(dusk.hair).toBe(base.hair);
    expect(dusk.tunic).not.toBe(base.tunic);
    expect(() => paletteOf('casual2_male:ember')).toThrow(/unknown palette variant/);
    expect(() => paletteOf('robot_male')).toThrow(/no base look/);
  });

  it('atlas plan: one tile per look (sorted), then the source textures the mug and the off-body book need', () => {
    const p = atlasPlan();
    expect(p.looks).toEqual(allLookIds());
    expect(p.props).toEqual(['barbarian', 'mage']);
  });

  it('every shape names parts of KayKit characters on one body texture', () => {
    for (const [id, s] of Object.entries(SHAPES)) {
      expect(s.parts.length, id).toBeGreaterThanOrEqual(6);
      expect(s.parts.filter((p) => p.part === 'Head'), id).toHaveLength(1);
      expect(SLOTS[s.texture], id).toBeDefined();
    }
  });
});

describe('OKLab swatch recolour', () => {
  it('OKLab round-trips sRGB', () => {
    for (const c of [[0.2, 0.4, 0.6], [1, 1, 1], [0, 0, 0], [0.9, 0.1, 0.3]] as const) {
      const [L, a, b] = srgbToOklab(c[0], c[1], c[2]);
      const back = oklabToSrgb(L, a, b);
      for (let k = 0; k < 3; k++) expect(back[k]!).toBeCloseTo(c[k]!, 4);
    }
    expect(parseHex('#ff8000')).toEqual([1, 128 / 255, 0]);
    expect(() => parseHex('red')).toThrow(/#rrggbb/);
  });

  it('moves a cell to the target hue around its mean lightness and keeps the gradient\'s light-to-dark order', () => {
    const img = gradientImage([220, 60, 60], [90, 20, 40]);
    recolourCell(img, '2,1', '#3060c0');
    const [r, g, b] = cellMean(img, '2,1');
    expect(b).toBeGreaterThan(r + 40);                                // now blue
    expect(b).toBeGreaterThan(g);
    const at = (y: number): number => { const i = ((256 + y) * 1024 + 2 * 128 + 64) * 4; return img.data[i]! + img.data[i + 1]! + img.data[i + 2]!; };
    expect(at(10)).toBeGreaterThan(at(240));                          // still light at the top, dark at the bottom
    expect(cellMean(img, '3,1')).toEqual(cellMean(gradientImage([220, 60, 60], [90, 20, 40]), '3,1'));   // neighbours untouched
  });

  it('recolour() applies a palette through the slot table and refuses unknown slots', () => {
    const src = gradientImage([200, 200, 200], [60, 60, 60]);
    const out = recolour(src, 'knight', { cape: '#2f5fae' });
    expect(out.data).not.toBe(src.data);
    expect(cellMean(out, '0,1')[2]).toBeGreaterThan(cellMean(out, '0,1')[0] + 40);
    expect(cellMean(out, '3,0')).toEqual(cellMean(src, '3,0'));
    expect(() => recolour(src, 'knight', { tunic: '#000000' })).toThrow(/knight texture has no slot "tunic"/);
  });

  it('downscale is a linear-light box filter; composeAtlas lays tiles out row-major', () => {
    const src = gradientImage([255, 0, 0], [255, 0, 0]);
    const t = downscale(src, TILE_SIZE);
    expect([t.width, t.height]).toEqual([TILE_SIZE, TILE_SIZE]);
    expect([t.data[0], t.data[1], t.data[2], t.data[3]]).toEqual([255, 0, 0, 255]);
    const blue = downscale(gradientImage([0, 0, 255], [0, 0, 255]), TILE_SIZE);
    const atlas = composeAtlas([t, blue]);
    const px = (x: number, y: number): number[] => Array.from(atlas.data.subarray((y * atlas.width + x) * 4, (y * atlas.width + x) * 4 + 3));
    expect(px(10, 10)).toEqual([255, 0, 0]);
    expect(px(TILE_SIZE + 10, 10)).toEqual([0, 0, 255]);
    expect(px(10, TILE_SIZE + 10)).toEqual([128, 128, 128]);          // empty slot
  });
});

describe.skipIf(!HAS_SOURCES)('KayKit geometry (real sources)', () => {
  async function load(...chars: KayKitCharacter[]): Promise<Map<KayKitCharacter, Awaited<ReturnType<Awaited<ReturnType<typeof createIO>>['read']>>>> {
    const io = await createIO();
    const m = new Map<KayKitCharacter, Awaited<ReturnType<typeof io.read>>>();
    for (const c of chars) m.set(c, await io.read(join(KK, 'Characters', 'gltf', `${c}.glb`)));
    return m;
  }

  it('a cross-character shape keeps every vertex on the same joint names (JOINTS_0 remapped to the canonical order)', async () => {
    const m = await load('Knight', 'Rogue', 'Ranger');
    const b = buildShape('rogue_captain', SHAPES.rogue_captain!, m);
    const prim = b.doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;
    expect(b.doc.getRoot().listSkins()[0]!.listJoints().map((j) => j.getName())).toEqual([...RIG_JOINTS]);
    // the head is the last part: its vertices are the tail of the merged primitive
    const { prim: head, jointNames } = partPrimitive(m.get('Ranger')!, 'Ranger', 'Head');
    const n = head.getAttribute('POSITION')!.getCount();
    const total = prim.getAttribute('POSITION')!.getCount();
    const a: number[] = [], c: number[] = [], wa: number[] = [];
    for (let i = 0; i < n; i += 17) {
      head.getAttribute('JOINTS_0')!.getElement(i, a);
      head.getAttribute('WEIGHTS_0')!.getElement(i, wa);
      prim.getAttribute('JOINTS_0')!.getElement(total - n + i, c);
      for (let k = 0; k < 4; k++) if (wa[k]! > 0) expect(RIG_JOINTS[c[k]!]).toBe(jointNames[a[k]!]);
    }
    expect(prim.listSemantics().sort()).toEqual(['JOINTS_0', 'NORMAL', 'POSITION', 'TEXCOORD_0', 'WEIGHTS_0']);
    expect(b.bareTopY).toBeGreaterThan(2);
  });

  it('measures the gait clips: run is several times faster than walk', async () => {
    const io = await createIO();
    const anims = [await io.read(join(KK, 'Animations', 'gltf', 'Rig_Medium', 'Rig_Medium_General.glb')), await io.read(join(KK, 'Animations', 'gltf', 'Rig_Medium', 'Rig_Medium_MovementBasic.glb'))];
    const m = await load('Knight');
    const doc = buildAnimations(anims, readRig(m.get('Knight')!, 'Knight'));
    const walk = gaitSpeed(doc, 'walk'), run = gaitSpeed(doc, 'run');
    expect(walk).toBeGreaterThan(0.5);
    expect(walk).toBeLessThan(1.2);
    expect(run).toBeGreaterThan(2.5);
    expect(run).toBeLessThan(4.5);
    expect(doc.getRoot().listAnimations().map((a) => a.getName()).sort()).toEqual(['cheer', 'flinch', 'idle', 'run', 'use', 'walk']);
  });
});
