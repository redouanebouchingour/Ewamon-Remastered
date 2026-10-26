import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, NoColorSpace, Texture } from 'three/webgpu';
import { LAYERS } from '../src/descriptors.js';
import { MaterialBudget, countMaterials, createMaterialLibraryWith, paintSurfaceColor, refreshCachedTextureBindings, type MaterialLibrary } from '../src/materials/library.js';
import type { MaterialsManifest } from '../src/materials/manifest.js';
import { COAT_GLOSS, structureKey, surfaceStructure } from '../src/materials/graph.js';
import { SURFACE_IDS, SURFACES } from '../src/materials/surfaces.js';

/** A mock texture source: every url gets a fresh three `Texture` whose `dispose` is spied. */
function mockSource(opts: { fail?: (url: string) => boolean; defer?: boolean } = {}) {
  const loaded: { url: string; tex: Texture; dispose: ReturnType<typeof vi.fn> }[] = [];
  const pending: (() => void)[] = [];
  const source = {
    load: vi.fn((url: string) => {
      if (opts.fail?.(url)) return Promise.reject(new Error(`404 ${url}`));
      const tex = new Texture();
      tex.name = url;
      const dispose = vi.fn();
      tex.dispose = dispose;
      loaded.push({ url, tex, dispose });
      if (opts.defer) return new Promise<Texture>((res) => pending.push(() => res(tex)));
      return Promise.resolve(tex);
    }),
  };
  return { source, loaded, flush: () => { while (pending.length) pending.shift()!(); } };
}

function manifestFor(ids: readonly string[], heroIds: readonly string[] = []): MaterialsManifest {
  const tier = (id: string, t: string, size: 512 | 1024) => ({ albedo: `${id}.${t}_albedo.ktx2`, orm: `${id}.${t}_orm.ktx2`, normal: `${id}.${t}_normal.ktx2`, size, bytes: 3000 });
  return {
    version: 2,
    surfaces: Object.fromEntries(ids.map((id) => [id, {
      field: tier(id, 'field', 512), hero: heroIds.includes(id) ? tier(id, 'hero', 1024) : null, metres: 2, wrap: 'repeat', hash: `h-${id}`, albedoClampedPct: 0,
    }])),
    byBiome: {},
    placeholder: { albedo: 'placeholder_albedo.ktx2', orm: 'placeholder_orm.ktx2', normal: 'placeholder_normal.ktx2' },
    fieldBytes: 0, heroBytes: 0, totalBytes: 0,
  };
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { warn.mockRestore(); });

describe('MaterialLibrary: shared instances and the surface table', () => {
  it('returns one shared material per SurfaceId and throws RangeError on unknown ids', async () => {
    const { source } = mockSource();
    const lib = createMaterialLibraryWith({ baseUrl: '/materials/', source, fetchJson: async () => manifestFor([]) });
    await lib.ready;
    const a = lib.get('cobble');
    expect(lib.get('cobble')).toBe(a);
    expect(a.name).toBe('ewa:cobble');
    expect(a.userData).toMatchObject({ ewaSurface: 'cobble', ewaClass: 'physical' });
    expect(() => lib.get('not_a_surface' as never)).toThrow(RangeError);
    await expect(lib.preload(['nope' as never])).rejects.toThrow(RangeError);
    expect(lib.warmup()).toHaveLength(83);
    expect(lib.stats().liveMaterials).toBe(83);
    lib.disposeAll();
  });

  it('collapses the 83 surfaces into ≤ 8 program structures (uniforms carry the per-surface numbers)', () => {
    const keys = new Set(SURFACE_IDS.map((id) => structureKey(surfaceStructure(SURFACES[id]))));
    expect(keys.size).toBeLessThanOrEqual(8);
    expect(keys.has('card')).toBe(true);
    expect(keys.has('water')).toBe(true);
    // no clearcoat lobe (graph.ts deviation 7): the physical structures are gone, the coat folds into the roughness
    expect([...keys].some((k) => k.startsWith('physical'))).toBe(false);
  });

  it('renders the clearcoat surfaces on the standard graph (deviation 7); water stays physical', async () => {
    const { source } = mockSource();
    const lib = createMaterialLibraryWith({ baseUrl: '/materials/', source, fetchJson: async () => manifestFor([]) });
    await lib.ready;
    for (const id of ['cobble', 'slate_roof', 'obsidian', 'wet_rock', 'wet_flagstone'] as const) {
      const m = lib.get(id);
      expect(m).toBeInstanceOf(MeshStandardNodeMaterial);
      expect(m).not.toBeInstanceOf(MeshPhysicalNodeMaterial);
    }
    expect(lib.get('water_pond')).toBeInstanceOf(MeshPhysicalNodeMaterial);
    expect(COAT_GLOSS).toBeGreaterThan(1);
    lib.disposeAll();
  });
});

describe('MaterialLibrary: degradation to the placeholder set', () => {
  it('keeps rendering with the runtime neutral set when neither manifest nor placeholder KTX2 exist', async () => {
    const { source } = mockSource({ fail: () => true });
    const lib = createMaterialLibraryWith({ baseUrl: '/materials/', source, fetchJson: () => Promise.reject(new Error('not found')) });
    const early = lib.get('plaster');                      // synchronous, before ready
    expect((early.map as Texture & { isDataTexture?: boolean }).isDataTexture).toBe(true);
    await lib.ready;
    await lib.preload(['plaster', 'cobble']);
    expect(lib.manifest()).toBeNull();
    expect(lib.warnings().some((w) => w.includes('manifest unavailable'))).toBe(true);
    expect(lib.warnings().some((w) => w.includes('placeholder set unavailable'))).toBe(true);
    const info = lib.describe(early)!;
    expect(info).toMatchObject({ surface: 'plaster', bound: 'placeholder', ktx2: false, maps: { albedo: true, orm: true, normal: true } });
    expect(lib.stats().residentSets).toBe(0);
    lib.disposeAll();
  });

  it('binds the KTX2 placeholder once ready and keeps surfaces missing from the manifest on it', async () => {
    const { source, loaded } = mockSource();
    const lib = createMaterialLibraryWith({ baseUrl: '/materials/', source, fetchJson: async () => manifestFor(['cobble']) });
    const m = lib.get('thatch');
    await lib.ready;
    const ph = loaded.find((l) => l.url.endsWith('placeholder_albedo.ktx2'))!.tex;
    expect(m.map).toBe(ph);
    await lib.preload(['thatch']);
    expect(m.map).toBe(ph);                                // no entry → placeholder kept
    expect(lib.warnings().some((w) => w.includes("'thatch'"))).toBe(true);
    expect(lib.describe(m)!.ktx2).toBe(true);
    lib.disposeAll();
  });
});

describe('MaterialLibrary: loading, dedupe, re-pointing', () => {
  it('loads each (surface, tier) once even under concurrent preloads, and stamps every texture', async () => {
    const { source, loaded } = mockSource();
    const lib = createMaterialLibraryWith({ baseUrl: '/materials/', source, fetchJson: async () => manifestFor(['cobble', 'plaster']) });
    await Promise.all([lib.preload(['cobble', 'plaster']), lib.preload(['cobble']), lib.preload(['plaster', 'cobble'])]);
    const urls = loaded.map((l) => l.url.split('?')[0]);
    expect(urls.filter((u) => u!.includes('cobble.field'))).toHaveLength(3);
    expect(urls.filter((u) => u!.includes('plaster.field'))).toHaveLength(3);
    expect(source.load).toHaveBeenCalledTimes(3 + 6);      // placeholder + 2 surfaces × 3 maps
    expect(loaded.find((l) => l.url.includes('cobble.field_albedo'))!.url).toContain('?h=h-cobble');   // cache-buster

    const m = lib.get('cobble');
    const albedo = loaded.find((l) => l.url.includes('cobble.field_albedo'))!.tex;
    const orm = loaded.find((l) => l.url.includes('cobble.field_orm'))!.tex;
    expect(m.map).toBe(albedo);
    expect(m.aoMap).toBe(orm); expect(m.roughnessMap).toBe(orm); expect(m.metalnessMap).toBe(orm);
    expect(lib.describe(m)).toMatchObject({ bound: 'field', ktx2: true });
    for (const l of loaded) {
      expect(l.tex.wrapS).toBe(RepeatWrapping); expect(l.tex.wrapT).toBe(RepeatWrapping);
      expect(l.tex.minFilter).toBe(LinearMipmapLinearFilter); expect(l.tex.magFilter).toBe(LinearFilter);
      expect(l.tex.anisotropy).toBe(8); expect(l.tex.generateMipmaps).toBe(false);
      expect(l.tex.colorSpace).toBe(l.url.includes('albedo') ? SRGBColorSpace : NoColorSpace);
    }
    expect(lib.stats().residentSets).toBe(2);
    expect(lib.residentTextureBytes()).toBe(2 * 3000);        // mock textures carry no level data → manifest bytes
    lib.disposeAll();
  });

  it('preloadHero re-points the same material and retires the field set until the next eviction; field-only ids are a no-op', async () => {
    const { source, loaded } = mockSource();
    const lib = createMaterialLibraryWith({ baseUrl: '/materials/', source, fetchJson: async () => manifestFor(['cobble', 'thatch'], ['cobble']) });
    await lib.preload(['cobble', 'thatch']);
    const m = lib.get('cobble');
    const fieldAlbedo = loaded.find((l) => l.url.includes('cobble.field_albedo'))!;
    await lib.preloadHero(['cobble', 'thatch']);
    expect(lib.get('cobble')).toBe(m);                     // same material object: no new program
    const heroAlbedo = loaded.find((l) => l.url.includes('cobble.hero_albedo'))!;
    expect(m.map).toBe(heroAlbedo.tex);
    // H5c: not disposed at the hero bind (three's shadow pass may still re-initialise it), released at eviction
    expect(fieldAlbedo.dispose).not.toHaveBeenCalled();
    expect(loaded.some((l) => l.url.includes('thatch.hero'))).toBe(false);
    expect(lib.describe(m)!.bound).toBe('hero');
    const setsBefore = lib.stats().residentSets;
    lib.evictExcept(['cobble']);                             // cobble is kept (its hero set stays), the retired field set goes
    expect(fieldAlbedo.dispose).toHaveBeenCalledTimes(1);
    expect(lib.stats().residentSets).toBe(setsBefore - 2);   // cobble.field (retired) + thatch.field (evicted)
    expect(lib.get('cobble').map).toBe(heroAlbedo.tex);
    lib.disposeAll();
  });

  it('H5: beforeRelease runs after the re-point and before the replaced set is disposed (hero bind and eviction)', async () => {
    const { source, loaded } = mockSource();
    const order: string[] = [];
    const lib = createMaterialLibraryWith({
      baseUrl: '/materials/', source, fetchJson: async () => manifestFor(['cobble'], ['cobble']),
      beforeRelease: () => {
        const field = loaded.find((l) => l.url.includes('cobble.field_albedo'));
        order.push(`refresh(map=${lib.get('cobble').map === field?.tex ? 'field' : 'other'}, fieldDisposed=${field ? (field.dispose as unknown as { mock: { calls: unknown[] } }).mock.calls.length : -1})`);
      },
    });
    await lib.preload(['cobble']);
    await lib.preloadHero(['cobble']);
    lib.evictExcept([]);
    // after the hero bind (map already the hero set, field set not disposed), then after the eviction re-point (the
    // retired field set is disposed only after the hook)
    expect(order.filter((o) => o.startsWith('refresh(map=other, fieldDisposed=0)')).length).toBe(2);
    lib.disposeAll();
  });

  it('H5: refreshCachedTextureBindings brings every cached sampled-texture binding up to its texture node', () => {
    const a = new Texture(); const b = new Texture();
    const node = { value: b };
    const binding = { isSampledTexture: true, textureNode: node, texture: a, update(this: { texture: Texture; textureNode: { value: Texture } }) { if (this.texture !== this.textureNode.value) { this.texture = this.textureNode.value; return true; } return false; } };
    const uniform = { isUniformBuffer: true };
    const renderer = { _nodes: { nodeBuilderCache: new Map([[1, { bindings: [{ bindings: [binding, uniform] }] }]]) } };
    refreshCachedTextureBindings(renderer as never);
    expect(binding.texture).toBe(b);
    expect(() => refreshCachedTextureBindings({} as never)).not.toThrow();
  });

  it('evictExcept frees texture sets and re-points evicted materials to the placeholder', async () => {
    const { source, loaded } = mockSource();
    const lib = createMaterialLibraryWith({ baseUrl: '/materials/', source, fetchJson: async () => manifestFor(['cobble', 'plaster']) });
    await lib.preload(['cobble', 'plaster']);
    lib.evictExcept(['plaster']);
    const cobble = loaded.filter((l) => l.url.includes('cobble.field'));
    for (const c of cobble) expect(c.dispose).toHaveBeenCalledTimes(1);
    const ph = loaded.find((l) => l.url.endsWith('placeholder_albedo.ktx2'))!.tex;
    expect(lib.get('cobble').map).toBe(ph);
    expect(lib.get('plaster').map).not.toBe(ph);
    lib.evictExcept([]);
    expect(lib.stats().residentSets).toBe(0);
    expect(lib.stats().textureBytes).toBe(0);
    expect(lib.residentTextureBytes()).toBe(0);
    lib.disposeAll();
  });

  it('disposes a set that arrives after its surface was evicted (no leak, no stale bind)', async () => {
    const { source, loaded, flush } = mockSource({ defer: true });
    const lib = createMaterialLibraryWith({ baseUrl: '/materials/', source, fetchJson: async () => manifestFor(['cobble']) });
    const ready = lib.ready;
    await Promise.resolve();
    flush();
    await ready;
    const p = lib.preload(['cobble']);
    await new Promise((r) => setTimeout(r, 0));
    lib.evictExcept([]);
    flush();
    await p;
    const cobble = loaded.filter((l) => l.url.includes('cobble.field'));
    expect(cobble).toHaveLength(3);
    for (const c of cobble) expect(c.dispose).toHaveBeenCalledTimes(1);
    expect(lib.describe(lib.get('cobble'))!.bound).toBe('placeholder');
    lib.disposeAll();
  });
});

describe('MaterialLibrary: dispose contract (§10.2.8)', () => {
  it('disposeAll disposes every material, resident set and the placeholder, idempotently', async () => {
    const { source, loaded } = mockSource();
    const lib: MaterialLibrary = createMaterialLibraryWith({ baseUrl: '/materials/', source, fetchJson: async () => manifestFor(['cobble']) });
    await lib.preload(['cobble']);
    const mats = lib.warmup();
    const spies = mats.map((m) => vi.spyOn(m, 'dispose'));
    lib.disposeAll();
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1);
    for (const l of loaded) expect(l.dispose).toHaveBeenCalledTimes(1);
    lib.disposeAll();
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1);
    for (const l of loaded) expect(l.dispose).toHaveBeenCalledTimes(1);
    expect(() => lib.get('cobble')).toThrow();
  });
});

describe('MaterialBudget (§10.2.7) and helpers', () => {
  it('counts distinct materials, skips the debug layer, throws above 48 in dev', () => {
    const root = new Group();
    const geo = new PlaneGeometry(1, 1);
    const shared = new MeshStandardNodeMaterial();
    for (let i = 0; i < 10; i++) root.add(new Mesh(geo, shared));
    for (let i = 0; i < 47; i++) root.add(new Mesh(geo, new MeshStandardNodeMaterial()));
    expect(MaterialBudget.assert(root, 48)).toBe(48);
    const debug = new Group();
    debug.layers.set(LAYERS.debug);
    for (let i = 0; i < 5; i++) debug.add(new Mesh(geo, new MeshStandardNodeMaterial()));
    root.add(debug);
    expect(countMaterials(root)).toBe(48);
    root.add(new Mesh(geo, new MeshStandardNodeMaterial()));
    expect(() => MaterialBudget.assert(root, 48)).toThrow(RangeError);
  });

  it('paintSurfaceColor writes the linear SurfaceDef albedo as the level-2 colour attribute', () => {
    const g = paintSurfaceColor(new PlaneGeometry(1, 1), 'plaster');
    const c = g.getAttribute('color');
    expect(c.count).toBe(4);
    expect(c.getX(0)).toBeCloseTo(0.693, 2);   // #d9 → linear 0.693
  });
});
