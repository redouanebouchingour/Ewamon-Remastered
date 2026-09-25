/**
 * SPEC §40.2.6 / §50.4.8 `tools/model-pipeline/test/budget.test.ts`, over the committed `public/models/` tree:
 * legendary LOD0 ≤ 1.2 MB, LOD1 ≤ 0.45 MB, 4 legendaries ≤ 6.5 MB; each look ≤ 0.25 MB, looks ≤ 5.0 MB,
 * `public/models/` ≤ 12 MB; every GLB carries EXT_meshopt_compression; every legendary texture is KTX2 and looks
 * have none; kept clips are exactly `idle walk run victory defeat sitdown standup`; CREDITS.txt present. Plus the
 * round trip: produced GLBs load back through gltf-transform with the meshopt decoder registered.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOOKS } from '@ewa/content';
import { describe, expect, it } from 'vitest';
import { LEGENDARIES_TOTAL_MAX, LEGENDARY_LOD0_MAX, LEGENDARY_LOD1_MAX, LOOKS_TOTAL_MAX, LOOK_MAX, MODELS_DIR_MAX } from '../src/budget.js';
import { createIO, readGlbJson } from '../src/glb.js';
import { isKtx2, readKtx2Header, SUPERCOMPRESSION_ZSTD } from '../src/ktx2.js';
import type { ModelEntry, ModelsManifest } from '../src/manifest.js';
import { KEPT_CLIP_NAMES, LEGENDARY_IDS } from '../src/sets.js';
import { OUT_MODELS, REPO } from './helpers.js';

const manifestText = readFileSync(join(OUT_MODELS, 'models.manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText) as ModelsManifest;
const file = (rel: string): Uint8Array => new Uint8Array(readFileSync(join(OUT_MODELS, rel)));
const size = (rel: string): number => statSync(join(OUT_MODELS, rel)).size;
const legendaries = Object.entries(manifest.legendaries) as [string, ModelEntry][];
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

describe('models.manifest.json (§40.2.5)', () => {
  it('has version 1, the 4 legendaries and exactly the @ewa/content looks', () => {
    expect(manifest.version).toBe(1);
    expect(Object.keys(manifest.legendaries).sort()).toEqual([...LEGENDARY_IDS]);
    expect(Object.keys(manifest.looks).sort()).toEqual([...LOOKS].sort());
  });

  it('is written deterministically: sorted keys, 2-space indent, trailing LF', () => {
    const sort = (v: unknown): unknown => (Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v);
    expect(manifestText).toBe(`${JSON.stringify(sort(manifest), null, 2)}\n`);
  });

  it('every entry points at a written GLB whose sha256 is `hash`, with sorted clips and finite bounds', () => {
    for (const [id, e] of [...legendaries, ...looks]) {
      expect(existsSync(join(OUT_MODELS, e.url)), id).toBe(true);
      expect(createHash('sha256').update(file(e.url)).digest('hex'), id).toBe(e.hash);
      expect([...e.clips].sort(), id).toEqual(e.clips);
      for (let k = 0; k < 3; k++) {
        expect(Number.isFinite(e.bounds.min[k]!) && Number.isFinite(e.bounds.max[k]!), id).toBe(true);
        expect(e.bounds.max[k]!, id).toBeGreaterThan(e.bounds.min[k]!);
      }
    }
  });

  it('totalBytes equals every file under public/models (the manifest included)', () => {
    expect(manifest.totalBytes).toBe(dirBytes(OUT_MODELS));
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

  it.each(looks)('look %s ≤ 0.25 MB, no lod1', (id, e) => {
    expect(e.bytes, `${id} ${e.bytes} B`).toBeLessThanOrEqual(LOOK_MAX);
    expect(e.bytes).toBe(size(e.url));
    expect(e.lod1).toBeNull();
  });

  it('all looks ≤ 5.0 MB and public/models/ ≤ 12 MB', () => {
    expect(looks.reduce((s, [, e]) => s + e.bytes, 0)).toBeLessThanOrEqual(LOOKS_TOTAL_MAX);
    expect(dirBytes(OUT_MODELS)).toBeLessThanOrEqual(MODELS_DIR_MAX);
  });

  it('pins the MiB arithmetic of the targets', () => {
    expect([LEGENDARY_LOD0_MAX, LEGENDARY_LOD1_MAX, LEGENDARIES_TOTAL_MAX, LOOK_MAX, LOOKS_TOTAL_MAX, MODELS_DIR_MAX])
      .toEqual([1_258_291, 471_859, 6_815_744, 262_144, 5_242_880, 12_582_912]);
  });
});

describe('§50.4.8 content rules', () => {
  const glbs = [...legendaries.flatMap(([, e]) => [e.url, e.lod1!]), ...looks.map(([, e]) => e.url)];

  it.each(glbs)('%s carries EXT_meshopt_compression and KHR_mesh_quantization (required)', (rel) => {
    const j = readGlbJson(file(rel)) as { extensionsUsed?: string[]; extensionsRequired?: string[] };
    expect(j.extensionsRequired).toEqual(expect.arrayContaining(['EXT_meshopt_compression', 'KHR_mesh_quantization']));
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

  it('legendaries keep one clip, `idle`; looks keep exactly the 7 kept clips and have no textures', () => {
    for (const [, e] of legendaries) expect(e.clips).toEqual(['idle']);
    expect(KEPT_CLIP_NAMES).toEqual(['defeat', 'idle', 'run', 'sitdown', 'standup', 'victory', 'walk']);
    for (const [id, e] of looks) {
      expect(e.clips, id).toEqual(KEPT_CLIP_NAMES);
      expect(e.textures, id).toBe('none');
      expect(images(e.url), id).toEqual([]);
    }
  });

  it('licences travel: CREDITS.txt and icons/TABLER-LICENSE.txt are byte copies of assets-src/licenses (legacy-render-audit Q18)', () => {
    expect(readFileSync(join(OUT_MODELS, 'CREDITS.txt'), 'utf8')).toBe(readFileSync(join(REPO, 'assets-src', 'licenses', 'QUATERNIUS-CREDITS.txt'), 'utf8'));
    expect(readFileSync(join(REPO, 'packages', 'client', 'public', 'icons', 'TABLER-LICENSE.txt'), 'utf8'))
      .toBe(readFileSync(join(REPO, 'assets-src', 'licenses', 'TABLER-LICENSE.txt'), 'utf8'));
  });

  it('nothing else sits in public/models (no stale textures or GLBs)', () => {
    const want = new Set(['CREDITS.txt', 'models.manifest.json']);
    for (const [, e] of [...legendaries, ...looks]) {
      want.add(e.url);
      if (e.lod1) want.add(e.lod1);
      for (const uri of images(e.url)) want.add(`legendaries/${uri}`);
    }
    const have: string[] = [];
    const walk = (d: string, pre: string): void => {
      for (const n of readdirSync(d, { withFileTypes: true })) {
        if (n.isDirectory()) walk(join(d, n.name), `${pre}${n.name}/`); else have.push(`${pre}${n.name}`);
      }
    };
    walk(OUT_MODELS, '');
    expect(have.sort()).toEqual([...want].sort());
  });
});

describe('round trip: produced GLBs load back through gltf-transform (meshopt decoder registered)', () => {
  it('a look decodes to one skinned primitive with COLOR_0, its triangles and its 7 clips', async () => {
    const io = await createIO();
    const e = manifest.looks.casual_male!;
    const doc = await io.readBinary(file(e.url));
    const root = doc.getRoot();
    const prims = root.listMeshes().flatMap((m) => m.listPrimitives());
    expect(prims).toHaveLength(1);
    const p = prims[0]!;
    expect(p.listSemantics().sort()).toEqual(['COLOR_0', 'JOINTS_0', 'NORMAL', 'POSITION', 'WEIGHTS_0']);
    expect(p.getIndices()!.getCount() / 3).toBe(e.triangles);
    expect(root.listSkins()).toHaveLength(1);
    expect(root.listMaterials().map((m) => m.getName())).toEqual(['character']);
    expect(root.listAnimations().map((a) => a.getName()).sort()).toEqual(KEPT_CLIP_NAMES);
    // the decoded data is real: every index addresses a vertex, weights sum to ~1
    const n = p.getAttribute('POSITION')!.getCount();
    const idx = p.getIndices()!.getArray()!;
    for (let i = 0; i < idx.length; i++) expect(idx[i]!).toBeLessThan(n);
    const w: number[] = [];
    p.getAttribute('WEIGHTS_0')!.getElement(0, w);
    expect(w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 1);
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
