/**
 * SPEC §10.2 — the runtime material library.
 *
 * - One shared node material per SurfaceId (`get(id)`), built once by the one graph (graph.ts). The
 *   material never changes identity; texture tiers are re-pointed into it (placeholder → field → hero)
 *   by assigning the base `TextureNode.value`s plus the classic `map`/`aoMap`/`roughnessMap`/
 *   `metalnessMap`/`normalMap` slots (the latter so the Pillar 2 audit can read them). Every bound
 *   texture carries the same sampler stamp, so `RenderObject.getMaterialCacheKey()` is unchanged and no
 *   program is created by a re-point.
 * - Texture sets are keyed by `(surface, tier)` and deduplicated: concurrent `preload`s share one fetch.
 * - Degradation: no manifest / missing entry / failed fetch → the material stays on the placeholder set;
 *   no KTX2 placeholder → a runtime 4×4 neutral `DataTexture` set (dev-only fallback, reported by
 *   `describe().ktx2 === false`). Warnings are collected in `warnings()`.
 * - Dispose contract §10.2.8: the library owns every material and texture it hands out.
 */
import {
  BufferAttribute, DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace,
  UnsignedByteType, Vector3,
} from 'three/webgpu';
import type { BufferGeometry, Material, Object3D, Texture, TextureNode, WebGPURenderer } from 'three/webgpu';
import { texture as textureNode } from 'three/tsl';
import type { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { LAYERS } from '../descriptors.js';
import { isDevBuild } from '../env.js';
import {
  applyBakedParams, applyPlaceholderParams, buildSurfaceGraph, createSurfaceParams, defaultMetres, linearRgb,
  type SurfaceMaps, type SurfaceMaterial, type SurfaceParams,
} from './graph.js';
import { createSharedUniforms, type SharedUniforms } from './harvest.js';
import {
  MANIFEST_FILE, MAP_NAMES, PLACEHOLDER_TEXELS, parseMaterialsManifest, placeholderUrls, planTierUrls, resolveUrl,
  type MapName, type MaterialsManifest, type TierName,
} from './manifest.js';
import { SURFACE_IDS, surfaceDef, surfaceExtras, type MaterialClass, type SurfaceDef, type SurfaceId } from './surfaces.js';

export type { SharedUniforms } from './harvest.js';
export type { SurfaceMaterial } from './graph.js';

/** SPEC §10.2.3, verbatim. */
export interface TextureSet { readonly albedo: Texture; readonly orm: Texture; readonly normal: Texture; readonly bytes: number; readonly tier: 'field' | 'hero' }

/** What `describe()` reports for the zone dump (§10.10.1 `ZoneDump.materials`). */
export interface MaterialInfo {
  readonly surface: SurfaceId;
  readonly cls: MaterialClass;
  readonly bound: 'placeholder' | TierName;
  readonly maps: { readonly albedo: boolean; readonly orm: boolean; readonly normal: boolean };
  readonly ktx2: boolean;
}

/**
 * SPEC §10.2.3 `MaterialLibrary`, verbatim, plus four documented additions: `ready` (the SPEC's own
 * doc comment says the set is "awaitable through `ready`"), `warmup()`, `describe()` and `warnings()`.
 */
export interface MaterialLibrary {
  /** Shared instance; never dispose it. Loads the KTX2 set on first call (awaitable through `ready`). */
  get(id: SurfaceId): SurfaceMaterial;
  /** Resolves when the `field` tier of every surface in `ids` is resident. loadZone awaits this before building. */
  preload(ids: readonly SurfaceId[]): Promise<void>;
  /** Resolves when the `hero` tier of every `hero: true` surface in `ids` is resident and re-pointed; no-op for field-only ids. Never awaited before the first frame. */
  preloadHero(ids: readonly SurfaceId[]): Promise<void>;
  /** Releases the texture sets of surfaces not in `keep`; materials stay (their maps are re-pointed on next preload). */
  evictExcept(keep: readonly SurfaceId[]): void;
  /** Uniform group shared by every material: harvestLevel, wetness, windTime, windDir, timeOfDay. */
  readonly uniforms: SharedUniforms;
  stats(): { readonly liveMaterials: number; readonly residentSets: number; readonly textureBytes: number };
  disposeAll(): void;                              // only Renderer.dispose calls this, last

  /** Manifest + placeholder set loaded (resolves even when both are missing: degraded mode). */
  readonly ready: Promise<void>;
  /** Creates (if needed) and returns every library material, for the §10.1.2 step-8 warm-up compile. */
  warmup(): readonly SurfaceMaterial[];
  /** Library bookkeeping for one of its materials; `null` for foreign materials. */
  describe(material: Material): MaterialInfo | null;
  /** The parsed manifest (null until `ready`, or when unavailable). */
  manifest(): MaterialsManifest | null;
  /** Degradation messages collected so far (missing manifest, missing entries, failed fetches). */
  warnings(): readonly string[];
  /**
   * GPU bytes of the resident texture sets, maintained incrementally (no allocation). three 0.186's
   * `Info` counts every compressed texture as 1 byte, so the host adds this to `RenderStats.textureBytes`.
   */
  residentTextureBytes(): number;
}

/** Anything that turns a url into a GPU-ready texture (the KTX2 loader in production, a mock in tests). */
export interface TextureSource {
  load(url: string): Promise<Texture>;
}

export interface LibraryDeps {
  readonly baseUrl: string;
  readonly source: TextureSource;
  readonly fetchJson: (url: string) => Promise<unknown>;
  /** Optional eager GPU upload (`renderer.initTexture`) so the first frame uploads nothing. */
  readonly upload?: (t: Texture) => void;
  /**
   * Called after materials were re-pointed and BEFORE the replaced textures are disposed (hero bind, eviction). The
   * renderer refreshes three's cached node-builder states there (IMPLEMENTATION-NOTES Part 4, H5): a render object
   * created later clones its bindings from a state built before the re-point and would re-initialise the disposed
   * texture on the GPU — a texture nothing releases again.
   */
  readonly beforeRelease?: () => void;
}

/**
 * H5 (three 0.186): `NodeBuilderState.createBindings()` clones each `NodeSampledTexture` with the `texture` captured
 * when the state was built, and `Bindings._createBindings` uploads `binding.texture` before `binding.update()`
 * refreshes it from its texture node. So after a re-point, every cached state's sampled textures are brought up to
 * date (`update()` = `texture = textureNode.value`); render objects that already exist refresh on their next render.
 * Reads three internals (`_nodes.nodeBuilderCache`); absent → nothing happens.
 */
export function refreshCachedTextureBindings(renderer: WebGPURenderer): void {
  type Binding = { isSampledTexture?: boolean; textureNode?: unknown; update?: () => boolean };
  const cache = (renderer as unknown as { _nodes?: { nodeBuilderCache?: Map<unknown, { bindings?: readonly { bindings: readonly Binding[] }[] }> } })._nodes?.nodeBuilderCache;
  if (!cache) return;
  for (const state of cache.values()) {
    for (const group of state.bindings ?? []) {
      for (const b of group.bindings) if (b.isSampledTexture === true && b.textureNode !== undefined && typeof b.update === 'function') b.update();
    }
  }
}

/** SPEC §10.2.3 factory. `baseUrl` is where `materials.manifest.json` lives (e.g. `'/materials/'`). */
export function createMaterialLibrary(renderer: WebGPURenderer, ktx2: KTX2Loader, baseUrl: string): MaterialLibrary {
  return createMaterialLibraryWith({
    baseUrl,
    source: { load: (url) => ktx2.loadAsync(url) as Promise<Texture> },
    fetchJson: async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Dev servers answer unknown paths with index.html (SPA fallback): treat non-JSON as "not found".
      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('json')) throw new Error(`not found (got ${type || 'no content-type'})`);
      return res.json() as Promise<unknown>;
    },
    upload: (t) => renderer.initTexture(t),
    beforeRelease: () => refreshCachedTextureBindings(renderer),
  });
}

/** Runtime texture state stamped on every bound texture (§10.2.1). Identical for all tiers → same cache key. */
export function stampTexture(t: Texture, map: MapName): Texture {
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 8;
  t.generateMipmaps = false;
  t.colorSpace = map === 'albedo' ? SRGBColorSpace : NoColorSpace;
  return t;
}

/** GPU byte estimate of a texture from its level data (compressed mip chain or raw image data). */
export function textureBytes(t: Texture): number {
  const mips = (t as Texture & { mipmaps?: { data?: ArrayBufferView }[] }).mipmaps;
  let n = 0;
  if (Array.isArray(mips) && mips.length > 0) {
    for (const m of mips) n += m.data?.byteLength ?? 0;
    if (n > 0) return n;
  }
  const img = t.image as { data?: ArrayBufferView } | null;
  return img?.data?.byteLength ?? 0;
}

function neutralTexture(map: MapName): DataTexture {
  const [r, g, b, a] = PLACEHOLDER_TEXELS[map];
  const data = new Uint8Array(4 * 4 * 4);
  for (let i = 0; i < 16; i++) { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a; }
  const t = new DataTexture(data, 4, 4, RGBAFormat, UnsignedByteType);
  t.name = `ewa_neutral_${map}`;
  stampTexture(t, map);
  t.needsUpdate = true;
  return t;
}

interface PlaceholderSet { readonly albedo: Texture; readonly orm: Texture; readonly normal: Texture; readonly ktx2: boolean }

interface Rec {
  readonly def: SurfaceDef;
  readonly material: SurfaceMaterial;
  readonly maps: SurfaceMaps;
  readonly params: SurfaceParams;
  bound: 'placeholder' | TierName;
}

interface Resident { readonly id: SurfaceId; readonly tier: TierName; readonly set: TextureSet }

const setKey = (id: SurfaceId, tier: TierName): string => `${id}.${tier}`;

function disposeSet(s: { albedo: Texture; orm: Texture; normal: Texture }): void {
  s.albedo.dispose(); s.orm.dispose(); s.normal.dispose();
}

/** Dependency-injected constructor (tests pass a mock `source` / `fetchJson`). */
export function createMaterialLibraryWith(deps: LibraryDeps): MaterialLibrary {
  const uniforms = createSharedUniforms();
  const recs = new Map<SurfaceId, Rec>();
  const byMaterial = new Map<string, Rec>();
  const resident = new Map<string, Resident>();
  const pending = new Map<string, Promise<TextureSet | null>>();
  /**
   * Field sets replaced by their hero set, kept resident until the next `evictExcept` (IMPLEMENTATION-NOTES Part 4,
   * H5c): three's shadow pass samples `material.map` through a `reference()` node whose value updates only during a
   * render, so a shadow render object created after the re-point re-initialised a field texture disposed at the hero
   * bind (measured: +1 texture per zone visit). At eviction the zone's render objects are gone.
   */
  const retired = new Set<string>();
  const wanted = new Set<SurfaceId>();
  const warned = new Set<string>();
  const warnings: string[] = [];
  let manifest: MaterialsManifest | null = null;
  let residentBytes = 0;
  let disposed = false;

  const fallback: PlaceholderSet = { albedo: neutralTexture('albedo'), orm: neutralTexture('orm'), normal: neutralTexture('normal'), ktx2: false };
  let placeholder: PlaceholderSet = fallback;

  const warn = (msg: string): void => {
    if (warned.has(msg)) return;
    warned.add(msg);
    warnings.push(msg);
    if (isDevBuild()) console.warn(`[@ewa/render materials] ${msg}`);
  };

  const assign = (rec: Rec, a: Texture, o: Texture, n: Texture): void => {
    rec.maps.albedo.value = a;
    rec.maps.orm.value = o;
    rec.maps.normal.value = n;
    const m = rec.material;
    m.map = a;
    m.aoMap = o; m.roughnessMap = o; m.metalnessMap = o;   // one texture, one sampler, three slots (§10.2.1)
    m.normalMap = n;
  };

  const bindPlaceholder = (rec: Rec): void => {
    assign(rec, placeholder.albedo, placeholder.orm, placeholder.normal);
    applyPlaceholderParams(rec.params, rec.def);
    rec.bound = 'placeholder';
  };

  const bindSet = (rec: Rec, set: TextureSet): void => {
    assign(rec, set.albedo, set.orm, set.normal);
    const metres = manifest?.surfaces[rec.def.id]?.metres ?? defaultMetres(rec.def);
    applyBakedParams(rec.params, rec.def, metres);
    rec.bound = set.tier;
  };

  const ensureRec = (id: SurfaceId): Rec => {
    let rec = recs.get(id);
    if (rec !== undefined) return rec;
    const def = surfaceDef(id);
    const extras = surfaceExtras(id);
    const maps: SurfaceMaps = {
      albedo: textureNode(placeholder.albedo) as TextureNode,
      orm: textureNode(placeholder.orm) as TextureNode,
      normal: textureNode(placeholder.normal) as TextureNode,
    };
    const params = createSurfaceParams(def, extras);
    const material = buildSurfaceGraph(def, extras, maps, params, uniforms);
    material.name = `ewa:${id}`;
    material.userData = { ewaSurface: id, ewaClass: def.cls };
    rec = { def, material, maps, params, bound: 'placeholder' };
    bindPlaceholder(rec);
    recs.set(id, rec);
    byMaterial.set(material.uuid, rec);
    return rec;
  };

  const loadTriple = async (urls: Record<MapName, string>): Promise<Record<MapName, Texture>> => {
    const settled = await Promise.allSettled(MAP_NAMES.map((m) => deps.source.load(urls[m])));
    const out: Partial<Record<MapName, Texture>> = {};
    let failure: unknown = null;
    settled.forEach((s, i) => {
      const m = MAP_NAMES[i]!;
      if (s.status === 'fulfilled') out[m] = stampTexture(s.value, m);
      else failure = failure ?? s.reason;
    });
    if (failure !== null) {
      for (const t of Object.values(out)) t?.dispose();
      throw failure;
    }
    return out as Record<MapName, Texture>;
  };

  const loadTier = (id: SurfaceId, tier: TierName): Promise<TextureSet | null> => {
    const key = setKey(id, tier);
    const have = resident.get(key);
    if (have !== undefined) return Promise.resolve(have.set);
    const inflight = pending.get(key);
    if (inflight !== undefined) return inflight;
    const urls = planTierUrls(manifest, deps.baseUrl, id, tier);
    if (urls === null) {
      if (tier === 'field') warn(manifest === null ? 'no materials manifest: every surface renders the placeholder set' : `manifest has no '${id}' ${tier} tier: placeholder kept`);
      return Promise.resolve(null);
    }
    const p = loadTriple(urls).then(
      (t) => {
        pending.delete(key);
        if (disposed || !wanted.has(id)) { disposeSet(t); return null; }   // evicted (or disposed) while in flight
        const set: TextureSet = {
          albedo: t.albedo, orm: t.orm, normal: t.normal, tier,
          bytes: textureBytes(t.albedo) + textureBytes(t.orm) + textureBytes(t.normal) || urls.bytes,
        };
        if (deps.upload) { deps.upload(set.albedo); deps.upload(set.orm); deps.upload(set.normal); }
        resident.set(key, { id, tier, set });
        residentBytes += set.bytes;
        return set;
      },
      (err: unknown) => {
        pending.delete(key);
        warn(`failed to load '${id}' ${tier} tier (${err instanceof Error ? err.message : String(err)}): placeholder kept`);
        return null;
      },
    );
    pending.set(key, p);
    return p;
  };

  const releaseResident = (key: string): void => {
    const r = resident.get(key);
    if (r === undefined) return;
    resident.delete(key);
    residentBytes -= r.set.bytes;
    disposeSet(r.set);
  };

  const ready: Promise<void> = (async () => {
    try {
      const parsed = parseMaterialsManifest(await deps.fetchJson(resolveUrl(deps.baseUrl, MANIFEST_FILE)));
      manifest = parsed.manifest;
      for (const e of parsed.errors) warn(`manifest: ${e}`);
    } catch (err) {
      manifest = null;
      warn(`materials manifest unavailable (${err instanceof Error ? err.message : String(err)})`);
    }
    try {
      const t = await loadTriple(placeholderUrls(manifest, deps.baseUrl));
      if (disposed) { disposeSet(t); return; }
      if (deps.upload) { deps.upload(t.albedo); deps.upload(t.orm); deps.upload(t.normal); }
      placeholder = { albedo: t.albedo, orm: t.orm, normal: t.normal, ktx2: true };
      for (const rec of recs.values()) if (rec.bound === 'placeholder') bindPlaceholder(rec);
      deps.beforeRelease?.();
      disposeSet(fallback);   // nothing references the runtime set any more
    } catch (err) {
      warn(`KTX2 placeholder set unavailable (${err instanceof Error ? err.message : String(err)}): using the runtime 4×4 neutral set`);
    }
  })();

  const lib: MaterialLibrary = {
    uniforms,
    ready,

    get(id) {
      if (disposed) throw new Error('@ewa/render: MaterialLibrary used after disposeAll()');
      return ensureRec(id).material;
    },

    async preload(ids) {
      const defs = ids.map((id) => surfaceDef(id).id);   // RangeError on unknown ids, before any await
      await ready;
      if (disposed) return;
      await Promise.all(defs.map(async (id) => {
        wanted.add(id);
        const rec = ensureRec(id);
        if (rec.bound !== 'placeholder') return;             // field or hero already bound
        const set = await loadTier(id, 'field');
        if (set !== null && !disposed && wanted.has(id) && rec.bound === 'placeholder') bindSet(rec, set);
      }));
    },

    async preloadHero(ids) {
      const defs = ids.map((id) => surfaceDef(id));
      await ready;
      if (disposed) return;
      await Promise.all(defs.filter((d) => d.hero).map(async (d) => {
        const id = d.id;
        wanted.add(id);
        const rec = ensureRec(id);
        if (rec.bound === 'hero') return;
        const set = await loadTier(id, 'hero');
        if (set === null || disposed || !wanted.has(id)) return;
        bindSet(rec, set);
        deps.beforeRelease?.();
        if (resident.has(setKey(id, 'field'))) retired.add(setKey(id, 'field'));   // released at the next eviction (H5c)
      }));
    },

    evictExcept(keep) {
      if (disposed) return;
      const keepSet = new Set<SurfaceId>(keep);
      for (const id of [...wanted]) if (!keepSet.has(id)) wanted.delete(id);
      for (const rec of recs.values()) {
        if (!keepSet.has(rec.def.id) && rec.bound !== 'placeholder') bindPlaceholder(rec);
      }
      deps.beforeRelease?.();
      for (const [key, r] of [...resident]) if (!keepSet.has(r.id) || retired.has(key)) releaseResident(key);
      retired.clear();
    },

    stats() {
      return { liveMaterials: recs.size, residentSets: resident.size, textureBytes: residentBytes };
    },

    residentTextureBytes: () => residentBytes,

    disposeAll() {
      if (disposed) return;
      disposed = true;
      for (const rec of recs.values()) rec.material.dispose();
      for (const key of [...resident.keys()]) releaseResident(key);
      if (placeholder !== fallback) disposeSet(placeholder);
      disposeSet(fallback);   // idempotent on the three side; harmless if already disposed after `ready`
      recs.clear(); byMaterial.clear(); pending.clear(); wanted.clear(); retired.clear();
    },

    warmup() {
      return SURFACE_IDS.map((id) => lib.get(id));
    },

    describe(material) {
      const rec = byMaterial.get(material.uuid);
      if (rec === undefined) return null;
      const m = rec.material;
      return {
        surface: rec.def.id,
        cls: rec.def.cls,
        bound: rec.bound,
        maps: { albedo: m.map !== null, orm: m.aoMap !== null && m.aoMap === m.roughnessMap && m.aoMap === m.metalnessMap, normal: m.normalMap !== null },
        ktx2: rec.bound !== 'placeholder' || placeholder.ktx2,
      };
    },

    manifest: () => manifest,
    warnings: () => warnings,
  };
  return lib;
}

/** SPEC §10.2.3 / §10.2.7. */
export class MaterialBudget {
  /**
   * Counts distinct `Material.uuid` reachable from `zoneRoot`, skipping subtrees on layer 31 (debug).
   * Throws in dev builds when the count exceeds `max`; logs in prod. Returns the count.
   */
  static assert(zoneRoot: Object3D, max: 48 = 48): number {
    const n = countMaterials(zoneRoot);
    if (n > max) {
      const msg = `@ewa/render: zone binds ${n} distinct materials (> ${max}, §10.2.7)`;
      if (isDevBuild()) throw new RangeError(msg);
      console.error(msg);
    }
    return n;
  }
}

const DEBUG_MASK = 1 << LAYERS.debug;

/** Distinct material uuids under `root`, debug-layer subtrees excluded (§50.2.2 "Unique materials"). */
export function countMaterials(root: Object3D): number {
  const seen = new Set<string>();
  const visit = (o: Object3D): void => {
    if ((o.layers.mask & DEBUG_MASK) !== 0) return;
    const mat = (o as Object3D & { material?: Material | Material[] }).material;
    if (Array.isArray(mat)) { for (const m of mat) seen.add(m.uuid); } else if (mat) seen.add(mat.uuid);
    for (const c of o.children) visit(c);
  };
  visit(root);
  return seen.size;
}

const _v = new Vector3();

/**
 * Writes the surface's base albedo (linear) into the geometry's `color` attribute — the harvest level-2
 * colour source (§10.2.4: "the builder writes def.albedo into the `color` attribute"). Builders call it
 * on every geometry they bind to a library material (a missing attribute renders white at level 2).
 */
export function paintSurfaceColor(geometry: BufferGeometry, id: SurfaceId): BufferGeometry {
  const pos = geometry.getAttribute('position');
  const n = pos.count;
  linearRgb(surfaceDef(id).albedo, _v);
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { data[i * 3] = _v.x; data[i * 3 + 1] = _v.y; data[i * 3 + 2] = _v.z; }
  geometry.setAttribute('color', new BufferAttribute(data, 3));
  return geometry;
}
