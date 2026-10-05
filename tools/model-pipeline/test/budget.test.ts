/**
 * SPEC §40.2.6 / §50.4.8 `tools/model-pipeline/test/budget.test.ts`, over the committed `public/models/` tree:
 * legendary LOD0 ≤ 1.2 MB, LOD1 ≤ 0.45 MB, 4 legendaries ≤ 6.5 MB; each character GLB ≤ 0.25 MB, the character set
 * (`characters/`) ≤ 5.0 MB, `public/models/` ≤ 12 MB; every GLB carries EXT_meshopt_compression; legendary textures
 * and the character atlas are KTX2; shapes are one skinned primitive with UVs and no image; the shipped clips are
 * exactly `CHARACTER_CLIP_NAMES`; every look has a tile; CREDITS.txt credits Kay Lousberg. Plus the round trip:
 * produced GLBs load back through gltf-transform with the meshopt decoder registered.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOOKS } from '@ewa/content';
import { describe, expect, it } from 'vitest';
import { creditsText } from '../src/build.js';
import { LEGENDARIES_TOTAL_MAX, LEGENDARY_LOD0_MAX, LEGENDARY_LOD1_MAX, LOOKS_TOTAL_MAX, LOOK_MAX, MODELS_DIR_MAX } from '../src/budget.js';
import { CHARACTER_CLIP_NAMES, CHARACTER_HEIGHT_M, SHAPES } from '../src/characters.js';
import { createIO, readGlbJson } from '../src/glb.js';
import { RIG_JOINTS } from '../src/kaykit.js';
import { isKtx2, readKtx2Header, SUPERCOMPRESSION_ZSTD } from '../src/ktx2.js';
import type { CharacterFile, ModelEntry, ModelsManifest } from '../src/manifest.js';
import { LEGENDARY_IDS, bodyPaletteLooks } from '../src/sets.js';
import { OUT_MODELS, REPO } from './helpers.js';

const manifestText = readFileSync(join(OUT_MODELS, 'models.manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText) as ModelsManifest;
const file = (rel: string): Uint8Array => new Uint8Array(readFileSync(join(OUT_MODELS, rel)));
const size = (rel: string): number => statSync(join(OUT_MODELS, rel)).size;
const legendaries = Object.entries(manifest.legendaries) as [string, ModelEntry][];
const ch = manifest.characters;
const shapes = Object.entries(ch.shapes);
const accessories = Object.entries(ch.accessories);
const charFiles: [string, CharacterFile][] = [...shapes, ...accessories, ['animations', ch.animations], ['atlas', ch.atlas]];
const looks = Object.entries(manifest.looks);

function dirBytes(d: string): number {
  let n = 0;
  for (const e of readdirSync(d, { withFileTypes: true })) n += e.isDirectory() ? dirBytes(join(d, e.name)) : statSync(join(d, e.name)).size;
  return n;
}

function images(rel: string): string[] {
  const j = readGlbJson(file(rel)) as { images?: { uri?: string; bufferView?: number; mimeType?: string }[] };
  return (j.images ?? []).map((im) => {
    expect(im.bufferView, `${rel}: images must be external`).toBeUndefined();
    return im.uri!;
  });
}

describe('models.manifest.json (§40.2.5, version 2)', () => {
  it('has version 2, the 4 legendaries, and exactly the @ewa/content looks + BODIES palette variants', () => {
    expect(manifest.version).toBe(2);
    expect(Object.keys(manifest.legendaries).sort()).toEqual([...LEGENDARY_IDS]);
    expect(Object.keys(manifest.looks).sort()).toEqual([...LOOKS, ...bodyPaletteLooks()].sort());
    expect(Object.keys(ch.shapes).sort()).toEqual(Object.keys(SHAPES).sort());
    expect(ch.rig).toBe('Rig_Medium');
  });

  it('is written deterministically: sorted keys, 2-space indent, trailing LF', () => {
    const sort = (v: unknown): unknown => (Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v);
    expect(manifestText).toBe(`${JSON.stringify(sort(manifest), null, 2)}\n`);
  });

  it('every entry points at a written file whose sha256 is `hash`, with sorted clips and finite bounds', () => {
    for (const [id, e] of legendaries) {
      expect(existsSync(join(OUT_MODELS, e.url)), id).toBe(true);
      expect(createHash('sha256').update(file(e.url)).digest('hex'), id).toBe(e.hash);
      expect([...e.clips].sort(), id).toEqual(e.clips);
      for (let k = 0; k < 3; k++) expect(e.bounds.max[k]!, id).toBeGreaterThan(e.bounds.min[k]!);
    }
    for (const [id, e] of charFiles) {
      expect(e.url.startsWith('characters/'), id).toBe(true);
      expect(createHash('sha256').update(file(e.url)).digest('hex'), id).toBe(e.hash);
      expect(e.bytes, id).toBe(size(e.url));
    }
    for (const [id, e] of shapes) for (let k = 0; k < 3; k++) expect(e.bounds.max[k]!, id).toBeGreaterThan(e.bounds.min[k]!);
  });

  it('totalBytes equals every file under public/models (the manifest included)', () => {
    expect(manifest.totalBytes).toBe(dirBytes(OUT_MODELS));
  });

  it('looks: one tile each inside the atlas, a known shape, the accessory tile resolved, one scale, a chibi height', () => {
    const tiles = new Set<number>();
    const slots = ch.atlas.columns * ch.atlas.rows;
    for (const [id, l] of looks) {
      expect(ch.shapes[l.shape], id).toBeDefined();
      expect(tiles.has(l.tile), `${id} shares tile ${l.tile}`).toBe(false);
      tiles.add(l.tile);
      expect(l.tile).toBeLessThan(slots);
      if (l.accessory === null) expect(l.accessoryTile, id).toBeNull();
      else {
        expect(ch.accessories[l.accessory], id).toBeDefined();
        expect(l.accessoryTile!, id).toBeLessThan(slots);
        // the accessory samples the look's own tile when it shares the body's texture, else the source texture's tile
        if (ch.accessories[l.accessory]!.texture === ch.shapes[l.shape]!.texture) expect(l.accessoryTile, id).toBe(l.tile);
        else expect(looks.some(([, o]) => o.tile === l.accessoryTile), id).toBe(false);
      }
      expect(l.scale).toBe(ch.scale);
      expect(l.heightM, id).toBeGreaterThan(1.4);
      expect(l.heightM, id).toBeLessThan(1.9);
    }
    expect(ch.heightM).toBe(CHARACTER_HEIGHT_M);
    expect(ch.scale).toBeGreaterThan(0.6);
    expect(ch.scale).toBeLessThan(0.75);
  });
});

describe('§40.2.6 size targets', () => {
  it.each(legendaries)('legendary %s: LOD0 (GLB + its KTX2) ≤ 1.2 MB and LOD1 GLB ≤ 0.45 MB', (id, e) => {
    const texBytes = images(e.url).reduce((s, uri) => s + size(`legendaries/${uri}`), 0);
    expect(e.bytes).toBe(size(e.url) + texBytes);
    expect(e.bytes, `${id} LOD0 ${e.bytes} B`).toBeLessThanOrEqual(LEGENDARY_LOD0_MAX);
    expect(e.lod1).toBe(`legendaries/${id}.lod1.glb`);
    expect(size(e.lod1!), `${id} LOD1 ${size(e.lod1!)} B`).toBeLessThanOrEqual(LEGENDARY_LOD1_MAX);
  });

  it('4 legendaries (LOD0 + textures + LOD1) ≤ 6.5 MB', () => {
    const total = legendaries.reduce((s, [, e]) => s + e.bytes + size(e.lod1!), 0);
    expect(total).toBeLessThanOrEqual(LEGENDARIES_TOTAL_MAX);
  });

  it.each(charFiles)('character file %s ≤ 0.25 MB', (id, e) => {
    expect(e.bytes, `${id} ${e.bytes} B`).toBeLessThanOrEqual(LOOK_MAX);
  });

  it('the character set ≤ 5.0 MB and public/models/ ≤ 12 MB', () => {
    expect(dirBytes(join(OUT_MODELS, 'characters'))).toBeLessThanOrEqual(LOOKS_TOTAL_MAX);
    expect(dirBytes(OUT_MODELS)).toBeLessThanOrEqual(MODELS_DIR_MAX);
  });

  it('pins the MiB arithmetic of the targets', () => {
    expect([LEGENDARY_LOD0_MAX, LEGENDARY_LOD1_MAX, LEGENDARIES_TOTAL_MAX, LOOK_MAX, LOOKS_TOTAL_MAX, MODELS_DIR_MAX])
      .toEqual([1_258_291, 471_859, 6_815_744, 262_144, 5_242_880, 12_582_912]);
  });
});

describe('§50.4.8 content rules', () => {
  const meshGlbs = [...legendaries.flatMap(([, e]) => [e.url, e.lod1!]), ...shapes.map(([, e]) => e.url), ...accessories.map(([, e]) => e.url)];

  it.each(meshGlbs)('%s carries EXT_meshopt_compression and KHR_mesh_quantization (required)', (rel) => {
    const j = readGlbJson(file(rel)) as { extensionsRequired?: string[] };
    expect(j.extensionsRequired).toEqual(expect.arrayContaining(['EXT_meshopt_compression', 'KHR_mesh_quantization']));
  });

  it('the animation file carries EXT_meshopt_compression, no mesh, no skin', () => {
    const j = readGlbJson(file(ch.animations.url)) as { extensionsRequired?: string[]; meshes?: unknown[]; skins?: unknown[] };
    expect(j.extensionsRequired).toContain('EXT_meshopt_compression');
    expect(j.meshes ?? []).toEqual([]);
    expect(j.skins ?? []).toEqual([]);
  });

  it.each(legendaries)('legendary %s: every texture is an external UASTC KTX2 with zstd + mips, shared by LOD0 and LOD1', (id, e) => {
    expect(e.textures).toBe('ktx2');
    const lod0 = images(e.url);
    expect(lod0).toHaveLength(3);
    expect(images(e.lod1!)).toEqual(lod0);
    const j = readGlbJson(file(e.url)) as { textures: { extensions?: { KHR_texture_basisu?: { source: number } }; source?: number }[]; extensionsRequired: string[] };
    expect(j.extensionsRequired).toContain('KHR_texture_basisu');
    expect(j.extensionsRequired).not.toContain('EXT_texture_webp');
    for (const t of j.textures) { expect(t.source).toBeUndefined(); expect(t.extensions?.KHR_texture_basisu).toBeDefined(); }
    for (const uri of lod0) {
      expect(uri).toMatch(new RegExp(`^${id}\\.(basecolor|normal|orm|emissive)\\.[0-9a-f]{8}\\.ktx2$`));
      const k = file(`legendaries/${uri}`);
      expect(isKtx2(k), uri).toBe(true);
      const h = readKtx2Header(k);
      expect(h.colorModel, uri).toBe(166);                             // KHR_DF_MODEL_UASTC
      expect(h.supercompressionScheme, uri).toBe(SUPERCOMPRESSION_ZSTD);
      expect(h.levelCount, uri).toBe(Math.log2(Math.max(h.pixelWidth, h.pixelHeight)) + 1);
      expect(h.transfer, uri).toBe(uri.includes('.basecolor.') || uri.includes('.emissive.') ? 2 : 1);
      expect(createHash('sha256').update(k).digest('hex').slice(0, 8)).toBe(uri.split('.')[2]);
    }
  });

  it('the character atlas is one sRGB UASTC KTX2 (zstd, level 0 only) named by its hash, sized columns × rows tiles', () => {
    const a = ch.atlas;
    expect(a.textures).toBe('ktx2');
    expect(a.url).toBe(`characters/atlas.${a.hash.slice(0, 8)}.ktx2`);
    const h = readKtx2Header(file(a.url));
    expect([h.pixelWidth, h.pixelHeight]).toEqual([a.width, a.height]);
    expect([a.width, a.height]).toEqual([a.columns * a.tileSize, a.rows * a.tileSize]);
    expect(h.colorModel).toBe(166);
    expect(h.supercompressionScheme).toBe(SUPERCOMPRESSION_ZSTD);
    expect(h.levelCount).toBe(1);
    expect(h.transfer).toBe(2);
  });

  it('shapes and accessories ship no image; the legendaries keep one clip, `idle`; the shared clips are exactly CHARACTER_CLIP_NAMES', () => {
    for (const [id, e] of [...shapes, ...accessories]) expect(images(e.url), id).toEqual([]);
    for (const [, e] of legendaries) expect(e.clips).toEqual(['idle']);
    expect(CHARACTER_CLIP_NAMES).toEqual(['cheer', 'flinch', 'idle', 'run', 'use', 'walk']);
    expect(ch.animations.clips).toEqual(CHARACTER_CLIP_NAMES);
    expect(Object.keys(ch.animations.durations).sort()).toEqual(CHARACTER_CLIP_NAMES);
    expect(ch.animations.gaitSpeed.walk).toBeGreaterThan(0.3);
    expect(ch.animations.gaitSpeed.run).toBeGreaterThan(ch.animations.gaitSpeed.walk * 2);
  });

  it('licences travel: CREDITS.txt credits Kay Lousberg over the KayKit licence; icons/TABLER-LICENSE.txt is a byte copy', () => {
    const credits = readFileSync(join(OUT_MODELS, 'CREDITS.txt'), 'utf8');
    expect(credits).toBe(creditsText(readFileSync(join(REPO, 'assets-src', 'licenses', 'KAYKIT-ADVENTURERS-LICENSE.txt'), 'utf8')));
    expect(credits).toContain('Kay Lousberg, www.kaylousberg.com');
    expect(readFileSync(join(REPO, 'packages', 'client', 'public', 'icons', 'TABLER-LICENSE.txt'), 'utf8'))
      .toBe(readFileSync(join(REPO, 'assets-src', 'licenses', 'TABLER-LICENSE.txt'), 'utf8'));
  });

  it('nothing else sits in public/models (no stale textures, GLBs or Quaternius looks)', () => {
    const want = new Set(['CREDITS.txt', 'models.manifest.json']);
    for (const [, e] of legendaries) {
      want.add(e.url);
      if (e.lod1) want.add(e.lod1);
      for (const uri of images(e.url)) want.add(`legendaries/${uri}`);
    }
    for (const [, e] of charFiles) want.add(e.url);
    const have: string[] = [];
    const walk = (d: string, pre: string): void => {
      for (const n of readdirSync(d, { withFileTypes: true })) {
        if (n.isDirectory()) walk(join(d, n.name), `${pre}${n.name}/`); else have.push(`${pre}${n.name}`);
      }
    };
    walk(OUT_MODELS, '');
    expect(have.sort()).toEqual([...want].sort());
    expect(existsSync(join(OUT_MODELS, 'looks'))).toBe(false);
  });
});

describe('round trip: produced GLBs load back through gltf-transform (meshopt decoder registered)', () => {
  it('a shape decodes to one skinned primitive with UVs on the 23-joint Rig_Medium skin and one `character` material', async () => {
    const io = await createIO();
    const e = ch.shapes.ranger_lad!;
    const doc = await io.readBinary(file(e.url));
    const root = doc.getRoot();
    const prims = root.listMeshes().flatMap((m) => m.listPrimitives());
    expect(prims).toHaveLength(1);
    const p = prims[0]!;
    expect(p.listSemantics().sort()).toEqual(['JOINTS_0', 'NORMAL', 'POSITION', 'TEXCOORD_0', 'WEIGHTS_0']);
    expect(p.getIndices()!.getCount() / 3).toBe(e.triangles);
    expect(root.listSkins()).toHaveLength(1);
    expect(root.listSkins()[0]!.listJoints().map((j) => j.getName())).toEqual([...RIG_JOINTS]);
    expect(root.listMaterials().map((m) => m.getName())).toEqual(['character']);
    expect(root.listTextures()).toEqual([]);
    const n = p.getAttribute('POSITION')!.getCount();
    const idx = p.getIndices()!.getArray()!;
    for (let i = 0; i < idx.length; i++) expect(idx[i]!).toBeLessThan(n);
    const w: number[] = [];
    p.getAttribute('WEIGHTS_0')!.getElement(0, w);
    expect(w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 1);
    // UVs stay inside [0, 1] (the atlas tile is chosen at runtime)
    const uv: number[] = [];
    const T = p.getAttribute('TEXCOORD_0')!;
    for (let i = 0; i < T.getCount(); i += 37) { T.getElement(i, uv); expect(uv[0]!).toBeGreaterThanOrEqual(0); expect(uv[1]!).toBeLessThanOrEqual(1); }
  });

  it('the animation file decodes to the node-only rig and the shipped clips', async () => {
    const io = await createIO();
    const doc = await io.readBinary(file(ch.animations.url));
    const root = doc.getRoot();
    expect(root.listAnimations().map((a) => a.getName()).sort()).toEqual(CHARACTER_CLIP_NAMES);
    expect(root.listMeshes()).toEqual([]);
    const names = new Set(root.listNodes().map((n) => n.getName()));
    for (const j of RIG_JOINTS) expect(names.has(j), j).toBe(true);
    for (const a of root.listAnimations()) for (const c of a.listChannels()) expect(names.has(c.getTargetNode()!.getName())).toBe(true);
  });

  it('a legendary LOD0 and LOD1 decode, resolve their external KTX2 textures and keep skin + idle', async () => {
    const io = await createIO();
    const e = manifest.legendaries.lumyth;
    for (const rel of [e.url, e.lod1!]) {
      const doc = await io.read(join(OUT_MODELS, rel));
      const root = doc.getRoot();
      expect(root.listSkins()).toHaveLength(1);
      expect(root.listAnimations().map((a) => a.getName())).toEqual(['idle']);
      const texs = root.listTextures();
      expect(texs.map((t) => t.getMimeType())).toEqual(['image/ktx2', 'image/ktx2', 'image/ktx2']);
      for (const t of texs) expect(isKtx2(t.getImage()!)).toBe(true);
      const tris = root.listMeshes()[0]!.listPrimitives()[0]!.getIndices()!.getCount() / 3;
      if (rel === e.url) expect(tris).toBe(e.triangles);
      else expect(tris).toBeLessThan(e.triangles * 0.4);
    }
  });
});
