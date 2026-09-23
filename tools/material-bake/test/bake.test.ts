import { describe, expect, it } from 'vitest';
import { RECIPES, SURFACES, SURFACE_IDS } from '@ewa/render/surfaces';
import type { SurfaceDef, SurfaceId, SurfaceRecipe } from '@ewa/render/surfaces';
import { BakeError, LUMINANCE_CEILING, SEAM_TOLERANCE, bakeAt, bakeTier, seamError } from '../src/bake';
import { assertRecipeTable, selectIds } from '../src/run';

const lum = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const same = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(Buffer.from(b));

describe('recipe table', () => {
  it('SURFACES ↔ RECIPES is a bijection with matching hero flags', () => {
    expect(() => assertRecipeTable()).not.toThrow();
  });
  it('zones select their biome row plus the shared ids', () => {
    expect(selectIds(['mirevale', 'mire_route'], undefined)).toHaveLength(15);
    expect(selectIds(['cinderhold'], undefined)).toHaveLength(15);
    expect(selectIds(undefined, undefined)).toHaveLength(83);
    expect(() => selectIds(['nowhere'], undefined)).toThrow(/nowhere/);
  });
});

describe('bakeTier', () => {
  it('is deterministic: same id and tier → identical level buffers', () => {
    for (const id of ['cobble', 'grove_leaf_canopy', 'thatch'] as const) {
      const r = RECIPES[id]!, d = SURFACES[id];
      const a = bakeTier(r, d, 'field'), b = bakeTier(r, d, 'field');
      for (const k of ['albedo', 'orm', 'normal'] as const) {
        expect(a[k]).toHaveLength(10);                        // 512 → 1: 10 levels
        a[k].forEach((lv, i) => expect(same(lv.data, b[k][i]!.data), `${id} ${k} level ${i}`).toBe(true));
      }
    }
  });

  it('builds full mip chains with the expected sizes and alpha only for cards', () => {
    const t = bakeTier(RECIPES.tall_grass!, SURFACES.tall_grass, 'field');
    expect(t.albedo.map((l) => l.width)).toEqual([512, 256, 128, 64, 32, 16, 8, 4, 2, 1]);
    expect(t.alpha).toBe(true);
    expect(t.albedo[0]!.data.some((v, i) => i % 4 === 3 && v === 0)).toBe(true);
    const o = bakeTier(RECIPES.plaster!, SURFACES.plaster, 'field');
    expect(o.alpha).toBe(false);
    expect(o.albedo[0]!.data.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true);
    // normals stay unit length through the chain: z channel dominant and ≥ 128 on flat plaster
    for (const lv of o.normal) for (let i = 2; i < lv.data.length; i += 4) expect(lv.data[i]!).toBeGreaterThanOrEqual(128);
  });

  it('applies the 0.85 luminance ceiling to every surface (128² coverage bake)', () => {
    for (const id of SURFACE_IDS) {
      const r = RECIPES[id]!, d = SURFACES[id];
      const t = bakeAt(r, d, 128, null, { seamCheck: false });
      const lin = t.fields.albedoLinear;
      let max = 0;
      for (let i = 0; i < lin.length; i += 3) max = Math.max(max, lum(lin[i]!, lin[i + 1]!, lin[i + 2]!));
      expect(max, `${id} max luminance`).toBeLessThanOrEqual(LUMINANCE_CEILING + 1e-6);
      expect(t.seam === null, id).toBe(r.wrap === 'clamp');
      expect(t.clampedPct, `${id} clamped`).toBeLessThanOrEqual(d.emissive ? 100 : 5);
    }
  }, 300_000);

  // One case per surface so the worker yields between bakes (a single 55 s synchronous loop starves
  // vitest's RPC heartbeat and reports "Timeout calling onTaskUpdate").
  it.each(SURFACE_IDS.filter((id) => RECIPES[id]!.wrap === 'repeat'))('passes the wrap seam check at the field tier: %s', (id) => {
    const t = bakeTier(RECIPES[id]!, SURFACES[id], 'field');      // throws BakeError naming the surface on a seam
    expect(Math.max(t.seam!.albedo, t.seam!.height), `${id} seam`).toBeLessThanOrEqual(SEAM_TOLERANCE);
  }, 120_000);

  it('slice surfaces pass the ceiling and seam check at the field tier too', () => {
    for (const id of ['plaster', 'glass_warm', 'water_pond', 'path_gravel', 'stone_wall'] as const) {
      const t = bakeTier(RECIPES[id]!, SURFACES[id], 'field');
      expect(t.maxLuminance, id).toBeLessThanOrEqual(LUMINANCE_CEILING + 1e-6);
      if (t.seam) expect(Math.max(t.seam.albedo, t.seam.height), id).toBeLessThanOrEqual(SEAM_TOLERANCE);
    }
  }, 120_000);
});

describe('bake derivations', () => {
  const def = (over: Partial<SurfaceDef> = {}): SurfaceDef => ({ ...SURFACES.plaster, ...over });
  const flat = (id: string, lin: number, wrap: 'repeat' | 'clamp' = 'repeat', heightFn?: (u: number, v: number) => number): SurfaceRecipe => ({
    id, hero: false, metres: 1, normalStrength: 0.5, wrap,
    height(h) { for (let y = 0; y < h.height; y++) for (let x = 0; x < h.width; x++) h.data[y * h.width + x] = heightFn ? heightFn((x + 0.5) / h.width, (y + 0.5) / h.height) : 0.5; },
    albedo(rgb) { rgb.data.fill(lin); },
    orm() { /* defaults */ },
  });

  it('clamps texels above 0.85 luminance and fails when more than 5 % were clamped', () => {
    expect(() => bakeAt(flat('too_bright', 0.95), def(), 64)).toThrow(BakeError);
    expect(() => bakeAt(flat('too_bright', 0.95), def(), 64)).toThrow(/too_bright/);
  });

  it('reports but does not fail clamping on emissive housings (glass_warm rule)', () => {
    const t = bakeAt(flat('bright_housing', 0.95), def({ emissive: { color: '#ffb35c', intensity: 3.2 } }), 64);
    expect(t.clampedPct).toBe(100);
    expect(t.maxLuminance).toBeCloseTo(LUMINANCE_CEILING, 5);
  });

  it('fails a repeat surface whose painters are not written on a torus, naming it', () => {
    const ramp = flat('seamed', 0.3, 'repeat', (u) => u);
    expect(() => bakeAt(ramp, def(), 64)).toThrow(/seamed: wrap seam error/);
    expect(() => bakeAt(flat('seamed_clamp', 0.3, 'clamp', (u) => u), def(), 64)).not.toThrow();
  });

  it('seamError is 0 on a torus and the step size on a discontinuity', () => {
    const S = 32, tor = new Float32Array(S * S), cut = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { tor[y * S + x] = 0.5 + 0.5 * Math.sin((x / S) * Math.PI * 2); cut[y * S + x] = x / S; }
    expect(seamError(tor, S, 1, 1)).toBeLessThan(1e-3);
    expect(seamError(cut, S, 1, 1)).toBeGreaterThan(0.9);
  });

  it('writes the cavity AO only when the recipe leaves AO untouched', () => {
    const bumps = flat('bumps', 0.3, 'repeat', (u, v) => 0.5 + 0.5 * Math.sin(u * Math.PI * 8) * Math.sin(v * Math.PI * 8));
    const t = bakeAt(bumps, def(), 64);
    expect(t.aoDefault).toBe(true);
    const ao = t.orm[0]!.data;
    let minAo = 255;
    for (let i = 0; i < ao.length; i += 4) minAo = Math.min(minAo, ao[i]!);
    expect(minAo).toBeLessThan(255);
    const own: SurfaceRecipe = { ...bumps, id: 'own_ao', orm(o) { o.ao.fill(0.8); } };
    const t2 = bakeAt(own, def(), 64);
    expect(t2.aoDefault).toBe(false);
    expect(t2.orm[0]!.data[0]).toBe(Math.round(0.8 * 255));
  });

  it('stores absolute roughness in ORM green and normals OpenGL +Y', () => {
    const slope = flat('slope', 0.3, 'clamp', (_u, v) => v);           // height rises with v (row index)
    const t = bakeAt({ ...slope, orm(o) { o.rough.fill(0.36); } }, def({ roughness: 0.72 }), 64);
    const o = t.orm[0]!.data, n = t.normal[0]!.data;
    expect(o[1]).toBe(Math.round(0.36 * 255));                          // absolute, independent of SurfaceDef.roughness
    const mid = (32 * 64 + 32) * 4;
    expect(n[mid + 1]!).toBeLessThan(128);                              // surface faces −v where height grows with +v
    expect(Math.abs(n[mid]! - 128)).toBeLessThanOrEqual(1);
  });
});

void (null as unknown as SurfaceId);
