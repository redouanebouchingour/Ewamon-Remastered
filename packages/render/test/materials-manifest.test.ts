import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLACEHOLDER, PLACEHOLDER_TEXELS, normalizeBaseUrl, parseMaterialsManifest, placeholderUrls, planTierUrls, resolveUrl, withCacheBuster,
} from '../src/materials/manifest.js';
import { BIOME_SURFACES, SHARED_SURFACES, SURFACES, SURFACE_IDS, heroSurfaces, surfaceDef } from '../src/materials/surfaces.js';
import { hexToSrgb, luminance709, srgbToLinear } from '../src/lighting/color.js';

const tier = (p: string, size = 512) => ({ albedo: `${p}_albedo.ktx2`, orm: `${p}_orm.ktx2`, normal: `${p}_normal.ktx2`, size, bytes: 300 });

describe('materials.manifest.json parsing (§40.3.4)', () => {
  it('accepts a valid v2 manifest', () => {
    const { manifest, errors } = parseMaterialsManifest({
      version: 2,
      surfaces: {
        cobble: { field: tier('cobble.field'), hero: tier('cobble.hero', 1024), metres: 2, wrap: 'repeat', hash: 'abc', albedoClampedPct: 0.4 },
        thatch: { field: tier('thatch.field'), hero: null, metres: 2, wrap: 'repeat', hash: 'def', albedoClampedPct: 0 },
      },
      byBiome: { grove: ['cobble', 'thatch'] },
      placeholder: DEFAULT_PLACEHOLDER,
      fieldBytes: 600, heroBytes: 300, totalBytes: 900,
    });
    expect(errors).toEqual([]);
    expect(manifest!.surfaces.cobble!.hero!.size).toBe(1024);
    expect(manifest!.surfaces.thatch!.hero).toBeNull();
    expect(manifest!.byBiome.grove).toEqual(['cobble', 'thatch']);
    expect(manifest!.totalBytes).toBe(900);
  });

  it('rejects a wrong version and non-objects', () => {
    expect(parseMaterialsManifest({ version: 1 }).manifest).toBeNull();
    expect(parseMaterialsManifest('nope').manifest).toBeNull();
    expect(parseMaterialsManifest(null).manifest).toBeNull();
  });

  it('drops broken entries, ignores unknown ids, degrades a broken hero tier to field-only', () => {
    const { manifest, errors } = parseMaterialsManifest({
      version: 2,
      surfaces: {
        cobble: { field: { albedo: 'a', orm: '', normal: 'n', size: 512, bytes: 1 }, hero: null },
        plaster: { field: tier('plaster.field'), hero: { albedo: 'x', size: 2048 }, metres: 2, wrap: 'repeat', hash: 'h', albedoClampedPct: 0 },
        not_a_surface: { field: tier('x') },
      },
    });
    expect(manifest).not.toBeNull();
    expect(manifest!.surfaces.cobble).toBeUndefined();
    expect(manifest!.surfaces.plaster!.hero).toBeNull();
    expect(manifest!.surfaces.not_a_surface).toBeUndefined();
    expect(manifest!.placeholder).toEqual(DEFAULT_PLACEHOLDER);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('plans tier urls relative to the base, with the hash as cache-buster', () => {
    const { manifest } = parseMaterialsManifest({
      version: 2,
      surfaces: { cobble: { field: tier('cobble.field'), hero: tier('/cdn/cobble.hero', 1024), metres: 2, wrap: 'repeat', hash: '0123456789abcdef0123', albedoClampedPct: 0 } },
      placeholder: DEFAULT_PLACEHOLDER,
    });
    const f = planTierUrls(manifest, '/materials', 'cobble', 'field')!;
    expect(f.albedo).toBe('/materials/cobble.field_albedo.ktx2?h=0123456789abcdef');
    expect(f.size).toBe(512);
    expect(planTierUrls(manifest, '/materials/', 'cobble', 'hero')!.orm).toBe('/cdn/cobble.hero_orm.ktx2?h=0123456789abcdef');
    expect(planTierUrls(manifest, '/materials/', 'thatch', 'field')).toBeNull();
    expect(planTierUrls(null, '/materials/', 'cobble', 'field')).toBeNull();
  });

  it('url helpers', () => {
    expect(normalizeBaseUrl('/m')).toBe('/m/');
    expect(normalizeBaseUrl('/m/')).toBe('/m/');
    expect(resolveUrl('/m/', 'a.ktx2')).toBe('/m/a.ktx2');
    expect(resolveUrl('/m/', 'https://x/a.ktx2')).toBe('https://x/a.ktx2');
    expect(withCacheBuster('/a?x=1', 'h')).toBe('/a?x=1&h=h');
    expect(withCacheBuster('/a', '')).toBe('/a');
    expect(placeholderUrls(null, '/materials/')).toEqual({
      albedo: '/materials/placeholder_albedo.ktx2', orm: '/materials/placeholder_orm.ktx2', normal: '/materials/placeholder_normal.ktx2',
    });
    expect(PLACEHOLDER_TEXELS).toEqual({ albedo: [128, 128, 128, 255], orm: [255, 128, 0, 255], normal: [128, 128, 255, 255] });
  });
});

describe('surface table (§10.2.2) as seen by the runtime', () => {
  it('has 83 unique ids, each defined', () => {
    expect(SURFACE_IDS).toHaveLength(83);
    expect(new Set(SURFACE_IDS).size).toBe(83);
    for (const id of SURFACE_IDS) expect(SURFACES[id].id).toBe(id);
    expect(() => surfaceDef('nope')).toThrow(RangeError);
  });

  it('grove rows carry the SPEC §10.2.2 base values', () => {
    const want: Record<string, [string, string, number]> = {
      grove_bark: ['standard', '#5a4632', 0], grove_leaf_canopy: ['card', '#4f7a3a', 0], grove_moss: ['standard', '#4a6b33', 0],
      path_gravel: ['standard', '#8d8272', 0], cobble: ['physical', '#6f6a63', 0], plaster: ['standard', '#d9cfbb', 0],
      timber: ['standard', '#6b4a2e', 0], slate_roof: ['physical', '#3f444c', 0], thatch: ['standard', '#a3813f', 0],
      water_pond: ['water', '#2b5666', 0], stone_wall: ['standard', '#7d7569', 0], lantern_metal: ['standard', '#2e2a26', 0.85],
      glass_warm: ['emissive', '#ffd9a0', 0], dirt: ['standard', '#6a5238', 0], tall_grass: ['card', '#5f8a3c', 0],
    };
    for (const [id, [cls, albedo, metal]] of Object.entries(want)) {
      const d = surfaceDef(id);
      expect([d.cls, d.albedo, d.metalness]).toEqual([cls, albedo, metal]);
    }
    expect(surfaceDef('glass_warm').emissive).toEqual({ color: '#ffb35c', intensity: 3.2 });
    expect(surfaceDef('glass_warm').castShadow).toBe(false);
    expect(surfaceDef('water_pond').castShadow).toBe(false);
    expect(surfaceDef('grove_leaf_canopy').alphaTest).toBe(0.5);
    expect(surfaceDef('grove_moss').triplanar).toBe(true);
  });

  it('every biome binds its rows plus the 6 shared ids; ≤ 50 hero surfaces; base albedo ≤ 0.85 luminance', () => {
    expect(SHARED_SURFACES).toEqual(['cobble', 'plaster', 'timber', 'stone_wall', 'lantern_metal', 'glass_warm']);
    for (const [biome, ids] of Object.entries(BIOME_SURFACES)) {
      for (const s of SHARED_SURFACES) expect(ids, biome).toContain(s);
    }
    expect(BIOME_SURFACES.grove).toHaveLength(15);
    expect(heroSurfaces().length).toBeLessThanOrEqual(50);
    for (const s of SHARED_SURFACES) expect(SURFACES[s].hero).toBe(true);
    for (const id of SURFACE_IDS) {
      const [r, g, b] = hexToSrgb(SURFACES[id].albedo).map(srgbToLinear) as [number, number, number];
      expect(luminance709(r, g, b), id).toBeLessThanOrEqual(0.85);
    }
  });
});
