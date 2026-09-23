/**
 * Checks the committed output tree `packages/client/public/materials/` (produced by `pnpm --filter
 * @ewa/material-bake run bake`): manifest shape, referenced files, KTX2 headers.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHARED_SURFACE_IDS, SURFACES, SURFACE_IDS, biomeSurfaceSet } from '@ewa/render/surfaces';
import type { Biome, SurfaceId } from '@ewa/render/surfaces';
import { DF_MODEL_UASTC, DF_TRANSFER_LINEAR, DF_TRANSFER_SRGB, KTX2_IDENTIFIER, SUPERCOMPRESSION_ZSTD, readDfd, readKtx2 } from '../src/ktx2';
import { MANIFEST_FILE, stableJson, validateManifest } from '../src/manifest';
import type { MaterialsManifest } from '../src/manifest';
import { DEFAULT_OUT_DIR } from '../src/paths';

const manifestPath = join(DEFAULT_OUT_DIR, MANIFEST_FILE);
const text = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
const m = (text ? JSON.parse(text) : null) as MaterialsManifest | null;

describe('materials.manifest.json', () => {
  it('exists (run the bake first)', () => {
    expect(m, `missing ${manifestPath}`).not.toBeNull();
  });

  it('has the §40.3.4 shape, sorted keys, 2-space JSON and a trailing LF', () => {
    expect(validateManifest(m)).toEqual([]);
    expect(text).toBe(stableJson(m));
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.includes('\r')).toBe(false);
    expect(m!.version).toBe(2);
  });

  it('lists every SurfaceId with a hero tier exactly when SurfaceDef.hero', () => {
    expect(Object.keys(m!.surfaces).sort()).toEqual([...SURFACE_IDS].sort());
    for (const id of SURFACE_IDS) {
      const e = m!.surfaces[id]!;
      expect(e.hero !== null, id).toBe(SURFACES[id].hero);
      expect(e.field.size).toBe(512);
      if (e.hero) expect(e.hero.size).toBe(1024);
      expect(e.albedoClampedPct).toBeGreaterThanOrEqual(0);
      if (!SURFACES[id].emissive) expect(e.albedoClampedPct, id).toBeLessThanOrEqual(5);
    }
  });

  it('byBiome is the §10.2.2 rows, each including the 6 shared ids', () => {
    expect(Object.keys(m!.byBiome).sort()).toEqual(['capital', 'cinder', 'forge', 'grove', 'marrow', 'rift', 'salt', 'shrine', 'sky', 'storm', 'vesper']);
    for (const [b, ids] of Object.entries(m!.byBiome)) {
      expect(ids).toEqual([...biomeSurfaceSet(b as Biome)]);
      for (const s of SHARED_SURFACE_IDS) expect(ids).toContain(s);
    }
  });

  it('references files that exist, with bytes equal to the files, and no orphan .ktx2 in the directory', () => {
    const referenced = new Set<string>(Object.values(m!.placeholder));
    let field = 0, hero = 0, ph = 0;
    for (const [id, e] of Object.entries(m!.surfaces)) {
      for (const tier of ['field', 'hero'] as const) {
        const t = e[tier];
        if (!t) continue;
        let sum = 0;
        for (const map of ['albedo', 'orm', 'normal'] as const) {
          const f = join(DEFAULT_OUT_DIR, t[map]);
          expect(existsSync(f), `${id} ${t[map]}`).toBe(true);
          expect(t[map]).toBe(`${id}.${tier}_${map}.ktx2`);
          sum += readFileSync(f).length;
          referenced.add(t[map]);
        }
        expect(t.bytes, `${id}.${tier}.bytes`).toBe(sum);
        if (tier === 'field') field += sum; else hero += sum;
      }
    }
    for (const f of Object.values(m!.placeholder)) ph += readFileSync(join(DEFAULT_OUT_DIR, f)).length;
    expect(m!.fieldBytes).toBe(field);
    expect(m!.heroBytes).toBe(hero);
    expect(m!.totalBytes).toBe(field + hero + ph);
    const onDisk = readdirSync(DEFAULT_OUT_DIR).filter((f) => f.endsWith('.ktx2'));
    expect(onDisk.sort()).toEqual([...referenced].sort());
  });
});

describe('KTX2 files', () => {
  it('every file is UASTC + zstd with a full mip chain and the right transfer function', () => {
    const check = (file: string, size: number, kind: 'albedo' | 'orm' | 'normal', id: string): void => {
      const bytes = new Uint8Array(readFileSync(join(DEFAULT_OUT_DIR, file)));
      expect([...bytes.subarray(0, 12)], file).toEqual([...KTX2_IDENTIFIER]);
      const f = readKtx2(bytes);
      expect(f.header.vkFormat, file).toBe(0);
      expect([f.header.pixelWidth, f.header.pixelHeight], file).toEqual([size, size]);
      expect(f.header.levelCount, file).toBe(Math.log2(size) + 1);
      expect(f.header.faceCount).toBe(1);
      expect(f.header.supercompressionScheme, file).toBe(SUPERCOMPRESSION_ZSTD);
      const dfd = readDfd(f.dfd);
      expect(dfd.colorModel, file).toBe(DF_MODEL_UASTC);
      expect(dfd.transferFunction, file).toBe(kind === 'albedo' ? DF_TRANSFER_SRGB : DF_TRANSFER_LINEAR);
      // cards carry alpha (UASTC channel id 3 = RGBA), everything else is opaque RGB (0)
      expect(dfd.samples, file).toBe(1);
      if (id !== 'placeholder') expect(dfd.channelId0, file).toBe(kind === 'albedo' && SURFACES[id as SurfaceId].alphaTest !== null ? 3 : 0);
      f.levels.forEach((l, i) => {
        const s = Math.max(1, size >> i);
        expect(l.uncompressedByteLength, `${file} level ${i}`).toBe(Math.ceil(s / 4) * Math.ceil(s / 4) * 16);
        expect(l.data.length).toBeGreaterThan(0);
      });
    };
    for (const [id, e] of Object.entries(m!.surfaces)) {
      for (const tier of ['field', 'hero'] as const) {
        const t = e[tier];
        if (t) for (const kind of ['albedo', 'orm', 'normal'] as const) check(t[kind], t.size, kind, id);
      }
    }
    for (const kind of ['albedo', 'orm', 'normal'] as const) check(m!.placeholder[kind], 4, kind, 'placeholder');
  });
});
