import { describe, expect, it } from 'vitest';
import {
  BIOME_ROWS, GROVE_IDS, RECIPES, RECIPE_FILES, SHARED_SURFACE_IDS, SIGNATURE_SURFACES, SURFACES, SURFACE_IDS, WIND_AMPLITUDES,
  biomeSurfaceSet, createNoise, recipeCoverage, rng, sha256Hex,
} from '@ewa/render/surfaces';
import type { CardRgb, Orm, RecipeCtx, Rgb, ScalarField, SurfaceId } from '@ewa/render/surfaces';

/** §10.2.2 rows verbatim (ids only). */
const SPEC_IDS: Record<string, readonly string[]> = {
  grove: ['grove_bark', 'grove_leaf_canopy', 'grove_moss', 'path_gravel', 'cobble', 'plaster', 'timber', 'slate_roof', 'thatch', 'water_pond', 'stone_wall', 'lantern_metal', 'glass_warm', 'dirt', 'tall_grass'],
  cinder: ['cinder_basalt', 'cinder_ash_soil', 'cinder_scoria', 'lava_crust', 'lava_glow', 'obsidian', 'charred_timber', 'iron_grate', 'forge_brick'],
  salt: ['salt_sand', 'wet_rock', 'barnacle_stone', 'driftwood', 'rope', 'sailcloth', 'harbour_plank', 'sea_water', 'tide_pool'],
  storm: ['storm_slate', 'copper_oxide', 'coil_brass', 'insulator_glass', 'lightning_glass', 'tower_stone', 'wet_flagstone'],
  marrow: ['marrow_sandstone', 'bone_chalk', 'ore_vein', 'mine_timber', 'rail_iron', 'canyon_dust', 'gypsum_crystal'],
  vesper: ['vesper_bark_black', 'grave_moss', 'wrought_iron', 'candle_wax', 'mist_glass', 'willow_leaf', 'bog_water', 'lichen_stone'],
  forge: ['forge_steel_plate', 'rivet_iron', 'anvil_black', 'coal_glow', 'castle_granite', 'banner_cloth', 'chain'],
  sky: ['sky_marble', 'cloud_stone', 'gold_leaf', 'prayer_silk', 'dragon_scale_tile', 'frost_glass', 'pine_needle', 'snow'],
  capital: ['sun_marble', 'gilt_bronze', 'stained_glass', 'plaza_pale_stone', 'fountain_water', 'laurel_leaf'],
  shrine: ['void_glass', 'star_iron', 'eclipse_stone', 'ring_light'],
  rift: ['rift_shard', 'unmade_stone', 'void_floor'],
};

/** §40.3.6: id → [hero size, metres, normalStrength]. */
const SLICE_TABLE: Record<string, readonly [number, number, number]> = {
  grove_bark: [1024, 2, 0.7], grove_leaf_canopy: [512, 1, 0.45], grove_moss: [1024, 3, 0.55], path_gravel: [1024, 3, 0.8],
  cobble: [1024, 2, 0.85], plaster: [1024, 2, 0.35], timber: [1024, 2, 0.5], slate_roof: [512, 2, 0.75], thatch: [512, 2, 0.65],
  water_pond: [512, 4, 0.35], stone_wall: [1024, 2, 0.8], lantern_metal: [1024, 1, 0.4], glass_warm: [1024, 1, 0.2], dirt: [1024, 3, 0.6],
  tall_grass: [512, 1, 0.5],
};

describe('surface table (§10.2.2)', () => {
  it('declares exactly the 83 spec ids, grove first in audit order', () => {
    const all = Object.values(SPEC_IDS).flat();
    expect(all).toHaveLength(83);
    expect([...SURFACE_IDS]).toEqual(all);
    expect(new Set(SURFACE_IDS).size).toBe(83);
    expect(Object.keys(SURFACES).sort()).toEqual([...all].sort());
    expect([...GROVE_IDS]).toEqual(SPEC_IDS.grove);
    for (const [b, ids] of Object.entries(SPEC_IDS)) expect([...BIOME_ROWS[b as keyof typeof BIOME_ROWS]]).toEqual(ids);
  });

  it('carries the grove base values of the §10.2.2 table', () => {
    const want: Record<string, [string, number]> = {
      grove_bark: ['#5a4632', 0], grove_leaf_canopy: ['#4f7a3a', 0], grove_moss: ['#4a6b33', 0], path_gravel: ['#8d8272', 0],
      cobble: ['#6f6a63', 0], plaster: ['#d9cfbb', 0], timber: ['#6b4a2e', 0], slate_roof: ['#3f444c', 0], thatch: ['#a3813f', 0],
      water_pond: ['#2b5666', 0], stone_wall: ['#7d7569', 0], lantern_metal: ['#2e2a26', 0.85], glass_warm: ['#ffd9a0', 0],
      dirt: ['#6a5238', 0], tall_grass: ['#5f8a3c', 0],
    };
    for (const [id, [albedo, metal]] of Object.entries(want)) {
      expect(SURFACES[id as SurfaceId].albedo).toBe(albedo);
      expect(SURFACES[id as SurfaceId].metalness).toBe(metal);
    }
    expect(SURFACES.glass_warm.emissive).toEqual({ color: '#ffb35c', intensity: 3.2 });
    expect(SURFACES.grove_leaf_canopy.alphaTest).toBe(0.5);
    expect(SURFACES.water_pond.cls).toBe('water');
    expect(SURFACES.water_pond.castShadow).toBe(false);
  });

  it('carries the emissive and metal values the other rows name', () => {
    expect(SURFACES.lava_glow.emissive).toEqual({ color: '#ff5a1f', intensity: 4.0 });
    expect(SURFACES.lightning_glass.emissive).toEqual({ color: '#9fd0ff', intensity: 3.6 });
    expect(SURFACES.ore_vein.emissive).toEqual({ color: '#ffc766', intensity: 1.6 });
    expect(SURFACES.candle_wax.emissive).toEqual({ color: '#ffd08a', intensity: 2.4 });
    expect(SURFACES.coal_glow.emissive).toEqual({ color: '#ff7a2a', intensity: 3.0 });
    expect(SURFACES.void_glass.emissive).toEqual({ color: '#7be0d0', intensity: 2.8 });
    expect(SURFACES.ring_light.emissive).toEqual({ color: '#c7f4ff', intensity: 3.4 });
    expect(SURFACES.rift_shard.emissive).toEqual({ color: '#b46bff', intensity: 2.2 });
    expect(SURFACES.stained_glass.emissive?.intensity).toBe(2.0);
    expect([SURFACES.copper_oxide.metalness, SURFACES.copper_oxide.roughness]).toEqual([0.9, 0.35]);
    expect(SURFACES.coil_brass.metalness).toBe(1.0);
    expect([SURFACES.forge_steel_plate.metalness, SURFACES.forge_steel_plate.roughness]).toEqual([1.0, 0.3]);
    expect([SURFACES.gold_leaf.metalness, SURFACES.gold_leaf.roughness]).toEqual([1.0, 0.22]);
    expect(SURFACES.obsidian.clearcoat?.base).toBe(0.6);
    expect(SURFACES.wet_rock.clearcoat?.base).toBe(0.5);
    for (const id of ['sailcloth', 'willow_leaf', 'banner_cloth', 'prayer_silk', 'pine_needle', 'grove_leaf_canopy', 'tall_grass'] as const) {
      expect(SURFACES[id].cls).toBe('card');
      expect(SURFACES[id].doubleSide).toBe(true);
    }
  });

  it('records the §10.2.5 wind amplitudes and frequencies as metadata', () => {
    expect(WIND_AMPLITUDES).toEqual({ grove_bark: 0.02, grove_leaf_canopy: 0.12, tall_grass: 0.18, banner_cloth: 0.25, prayer_silk: 0.3 });
    expect(SURFACES.grove_bark.wind).toEqual({ amplitude: 0.02, frequency: 1.1, stiffnessFromUv: false });
    expect(SURFACES.tall_grass.wind).toEqual({ amplitude: 0.18, frequency: 1.9, stiffnessFromUv: true });
  });

  it('byBiome rows include the 6 shared ids and are sorted', () => {
    for (const b of Object.keys(BIOME_ROWS) as (keyof typeof BIOME_ROWS)[]) {
      const set = biomeSurfaceSet(b);
      for (const s of SHARED_SURFACE_IDS) expect(set).toContain(s);
      expect([...set]).toEqual([...set].sort());
    }
    expect(biomeSurfaceSet('grove')).toHaveLength(15);
    expect(biomeSurfaceSet('cinder')).toHaveLength(15);
  });
});

describe('hero tier (§40.3.5)', () => {
  const heroIds = SURFACE_IDS.filter((id) => SURFACES[id].hero);
  it('is ≤ 50 surfaces and exactly shared ∪ triplanar ∪ signatures', () => {
    expect(heroIds.length).toBeLessThanOrEqual(50);
    const named = new Set<string>([...SHARED_SURFACE_IDS, ...Object.values(SIGNATURE_SURFACES), ...SURFACE_IDS.filter((id) => SURFACES[id].triplanar)]);
    expect(new Set(heroIds)).toEqual(named);
    expect(Object.values(SIGNATURE_SURFACES).sort()).toEqual(
      ['grove_bark', 'lava_crust', 'wet_rock', 'copper_oxide', 'marrow_sandstone', 'vesper_bark_black', 'forge_steel_plate', 'sky_marble', 'sun_marble', 'void_glass', 'rift_shard'].sort(),
    );
  });
  it('has ≤ 3 triplanar terrain layers per biome', () => {
    for (const ids of Object.values(BIOME_ROWS)) expect(ids.filter((id) => SURFACES[id].triplanar).length).toBeLessThanOrEqual(3);
  });
  it('binds the 10 named Mirevale hero surfaces', () => {
    expect(GROVE_IDS.filter((id) => SURFACES[id].hero).sort()).toEqual(
      ['grove_bark', 'grove_moss', 'path_gravel', 'cobble', 'plaster', 'timber', 'stone_wall', 'lantern_metal', 'glass_warm', 'dirt'].sort(),
    );
  });
});

describe('RECIPES', () => {
  it('is a bijection with SURFACES, and every recipe agrees with its SurfaceDef', () => {
    expect(recipeCoverage()).toEqual({ missing: [], extra: [] });
    expect(Object.keys(RECIPES).sort()).toEqual([...SURFACE_IDS].sort());
    for (const id of SURFACE_IDS) {
      const r = RECIPES[id]!;
      expect(r.id).toBe(id);
      expect(r.hero).toBe(SURFACES[id].hero);
      expect(RECIPE_FILES[id]).toMatch(/^recipes\/[a-z]+\.ts$/);
      if (SURFACES[id].alphaTest !== null) expect(r.wrap).toBe('clamp');
      expect(r.normalStrength).toBeGreaterThan(0);
      expect(r.metres).toBeGreaterThan(0);
    }
  });

  it('fixes metres / hero / normalStrength of the 15 slice recipes (§40.3.6)', () => {
    for (const [id, [size, metres, strength]] of Object.entries(SLICE_TABLE)) {
      const r = RECIPES[id]!;
      expect([r.hero ? 1024 : 512, r.metres, r.normalStrength], id).toEqual([size, metres, strength]);
    }
    expect(RECIPES.water_pond!.wrap).toBe('repeat');
  });

  /** Paint every recipe at 128² (the painters are resolution-independent) and return the buffers. */
  function paint(id: string, S = 128): { h: Float32Array; rgb: Float32Array; alpha: Float32Array | null; orm: Orm } {
    const r = RECIPES[id]!, def = SURFACES[id as SurfaceId];
    const c: RecipeCtx = { id, size: S, metres: r.metres, noise: createNoise(id), def };
    const h: ScalarField = { width: S, height: S, data: new Float32Array(S * S) };
    const alpha = def.alphaTest !== null ? new Float32Array(S * S).fill(1) : null;
    const rgb: Rgb | CardRgb = alpha ? { width: S, height: S, data: new Float32Array(S * S * 3), alpha } : { width: S, height: S, data: new Float32Array(S * S * 3) };
    const orm: Orm = { width: S, height: S, ao: new Float32Array(S * S).fill(1), rough: new Float32Array(S * S).fill(0.5), metal: new Float32Array(S * S) };
    r.height(h, c); r.albedo(rgb, h, c); r.orm(orm, h, c);
    return { h: h.data, rgb: rgb.data, alpha, orm };
  }

  it('every recipe is deterministic and writes finite, non-flat fields', () => {
    for (const id of SURFACE_IDS) {
      const a = paint(id), b = paint(id);
      expect(Buffer.from(a.h.buffer).equals(Buffer.from(b.h.buffer)), `${id} height`).toBe(true);
      expect(Buffer.from(a.rgb.buffer).equals(Buffer.from(b.rgb.buffer)), `${id} albedo`).toBe(true);
      expect(Buffer.from(a.orm.rough.buffer).equals(Buffer.from(b.orm.rough.buffer)), `${id} rough`).toBe(true);
      let lo = Infinity, hi = -Infinity, alo = Infinity, ahi = -Infinity;
      for (const v of a.h) { expect(Number.isFinite(v)).toBe(true); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      for (let i = 0; i < a.rgb.length; i += 3) { const y = a.rgb[i]! + a.rgb[i + 1]! + a.rgb[i + 2]!; expect(Number.isFinite(y)).toBe(true); alo = Math.min(alo, y); ahi = Math.max(ahi, y); }
      expect(hi - lo, `${id} height is flat`).toBeGreaterThan(0.05);
      if (id !== 'water_pond') expect(ahi - alo, `${id} albedo is flat`).toBeGreaterThan(0.002);   // §40.3.6: water_pond albedo is flat by design
      if (a.alpha) {
        const covered = a.alpha.reduce((n, v) => n + (v >= 0.5 ? 1 : 0), 0) / a.alpha.length;
        expect(covered, `${id} card coverage`).toBeGreaterThan(0.05);
        expect(covered, `${id} card coverage`).toBeLessThan(0.98);
      }
    }
  });
});

describe('noise', () => {
  it('sha256 matches the FIPS 180-2 vectors', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });
  it('rng(seed) is a deterministic sfc32 stream in [0, 1)', () => {
    const a = rng('grove_moss'), b = rng('grove_moss'), c = rng('thatch');
    const xs = Array.from({ length: 64 }, () => a());
    expect(Array.from({ length: 64 }, () => b())).toEqual(xs);
    expect(Array.from({ length: 64 }, () => c())).not.toEqual(xs);
    for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('periodic noise wraps exactly (seamless torus)', () => {
    const n = createNoise('wrap').periodic(6, 18);
    for (let k = 0; k < 200; k++) {
      const y = (k / 200) * 18, x = (k * 0.37) % 6;
      expect(n.fbm2(x, y, 5)).toBeCloseTo(n.fbm2(x + 6, y, 5), 12);
      expect(n.fbm2(x, y, 5)).toBeCloseTo(n.fbm2(x, y + 18, 5), 12);
      expect(n.valueNoise2(x, y)).toBeCloseTo(n.valueNoise2(x - 6, y - 18), 12);
      const w1 = n.worley2(x, y), w2 = n.worley2(x + 6, y + 18);
      expect(w1.f1).toBeCloseTo(w2.f1, 12);
      expect(w1.id).toBe(w2.id);
    }
  });
  it('fbm / value noise stay in [0, 1] and hash21 is deterministic', () => {
    const n = createNoise('range');
    for (let k = 0; k < 500; k++) {
      const v = n.fbm2(k * 0.13, k * 0.07, 6);
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
      expect(n.hash21(k, -k)).toBe(createNoise('range').hash21(k, -k));
    }
  });
});
