/**
 * SPEC §10.5 — `loadZone(spec) → ZoneHandle`.
 *
 * Build order (the geometry digest follows it): terrain chunks → skirt → water → buildings → set-piece → static
 * props (hand-placed props, light housings, boundary dressing, pond banks and piers, plaza curb, warp rooms) →
 * scatter → lights. Everything is a child of one `Group` (the zone root; Pillar 7: never removed during a battle).
 * Only shared library materials are bound (§10.0.3 rule 3); every geometry the builder creates is recorded in
 * build order for the disposal contract (§10.5.9) and the digest.
 *
 * LOD: scatter and merged static props switch per 32 m chunk (0–40 / 40–90 / 90–160 / > 160 m, 4 m hysteresis);
 * buildings and the set-piece are `THREE.LOD` objects (0 / 40 / 90 m, 0.1 hysteresis) updated against the MAIN
 * camera by the zone system (auto-update is off: three's renderer would otherwise re-pick levels for every shadow
 * camera, so trees would cast LOD2 shadows).
 */
import { Color, Group, LOD, Mesh } from 'three/webgpu';
import type { BufferGeometry, Material, Object3D , Vector3 } from 'three/webgpu';
import type { BuildingSpec, CampTrophyKind, CampsHandle, HeightfieldData, ObstaclesHandle, ZoneHandle, ZoneSpec } from '../contracts.js';
import { TROPHY_KINDS, buildCampBanner, buildTrophy } from './generators/trophies.js';
import type { LightSource, RenderStats } from '../descriptors.js';
import type { MaterialLibrary } from '../materials/library.js';
import { SURFACES, type SurfaceId } from '../materials/surfaces.js';
import type { PunctualHandle } from '../lighting/rig.js';
import { HOUSINGS_KEY, createRenderStats, type HousingTag } from '../stats.js';
import { TerrainCollider } from '../terrain/collider.js';
import { SCATTER_MAX_SLOPE, heightClamped, slopeAt, wetNear } from '../terrain/field.js';
import { skirtClearFn, skirtHeightFn, skirtSteps, terrainChunkSteps, type NeighbourField, type SkirtOpts, type TerrainLayers } from '../terrain/mesh.js';
import { createSliceStats, drain, runSliced, type SliceStats, type Steps } from '../steps.js';
import type { Parts} from './geo.js';
import { Digest, box, beam, card, lathe, releaseShapeCache, swapShapeCache, trs, type V3 } from './geo.js';
import { BIOME_GENERATORS, FENCE_FOOTPRINT, PROP_BLOCKER, SET_PIECE_BUILDERS, buildHousing, buildPropKind } from './generators/index.js';
import { addPropTier, disposeProp, finish, tiers3, tower } from './generators/common.js';
import { DOORWAY_SURFACE, houseSteps } from './generators/buildings.js';
import { buildBush, buildFlowers, buildGroundTuft, buildImpostorCards, buildLog, buildRock, buildStump, buildTallGrass, buildTree } from './generators/nature.js';
import { buildPondBank } from './generators/props.js';
import { interiorSteps, interiorSurfaces, type BuiltInterior } from './generators/interiors.js';
import { boundaryPieces, buildClutterItem, buildShard, buildSkirtItem, dressingFor, plazaClutter, rockClusters, screeClusters, skirtPlacements, vergeClusters, type CoverPoint, type DressingStyle } from './generators/dressing.js';
import { InteriorSystem } from './interiors.js';
import { setSurfaces, type BiomeSet } from './generators/set.js';
import {
  FIELD_SIZE, HOUSING_LOCAL, createSplatContext, footprintDistance, inEllipse, inPocket, inSetPiece, layoutOf, roadDistance, scatterClear, splatAt, toWorld,
  type PocketRect, type SplatContext, type SplatFields, type ZoneLayoutPlan,
} from './layout.js';
import { BUILDING_LOD_LEVELS, CHUNK_SIZE, chunkGrid, type ChunkGrid } from './lod.js';
import { detailState } from './detail.js';
import { paletteFor } from './palettes.js';
import { createPrng, fbm2, hash2, valueNoise } from './prng.js';
import { ChunkSet, ScatterField, jitteredPointSteps, jitteredPoints, type ChunkRec, type Instance, type ScatterKind } from './scatter.js';
import { isScatterMesh, type ScatterMesh } from './instancing.js';
import type { Palette, PropGeo } from './types.js';
import { buildWaterMesh } from './water.js';
import { CARD_RENDER_ORDER, splitByClass } from './split.js';

export interface ZoneBuildDeps {
  readonly materials: Pick<MaterialLibrary, 'get' | 'preload' | 'preloadHero' | 'evictExcept'>;
  /** The rig that owns punctual lights (null in pure-geometry builds, e.g. node tests). */
  readonly lighting: { createPunctuals(s: readonly LightSource[], parent: Object3D): PunctualHandle[]; releasePunctuals(h: readonly PunctualHandle[]): void } | null;
  /** Where the zone root is attached (null = caller attaches). */
  readonly scene: Object3D | null;
  readonly stats?: () => RenderStats;
  /** Surfaces the next zone needs when a handover pre-load is pending (§10.5.9 step 3). */
  readonly nextKeep?: () => readonly SurfaceId[];
  /**
   * Called at the start of `dispose()` with the zone root; returns a finisher run after the geometries and meshes are
   * disposed. The zone system uses it to release GPU attributes three does not free itself (C26).
   */
  readonly releaseGpu?: (root: Object3D) => () => void;
  /**
   * The hero-tier stream (`preloadHero`) starts when this resolves (default: at once). The renderer opens it after
   * the zone's shader pre-compile: a hero set bound mid-compile disposed field sets the compile then re-initialised
   * on the GPU, and nothing ever released them again (IMPLEMENTATION-NOTES Part 4, H5: +21 textures per unload).
   */
  readonly heroGate?: Promise<void>;
  /**
   * Handover II: build in time slices of this many ms between frames (`runSliced`) instead of in one call — the
   * off-scene prepare, so preparing the next zone never holds a frame for the whole build. Same steps, same result.
   */
  readonly sliceMs?: number;
  /** Resolves when the next slice may run (default: the next task, steps.ts `nextSlice`). */
  readonly sliceWait?: () => Promise<void>;
  /** Filled by a sliced build (slices, the longest step). */
  readonly sliceStats?: SliceStats;
  /** A sliced build stops between slices once this returns true (`loadZone` rejects with `STEPS_CANCELLED`). */
  readonly cancelled?: () => boolean;
  /** A sliced build finishes without further waits once this returns true. */
  readonly urgent?: () => boolean;
}

/** What the zone system needs beyond the verbatim `ZoneHandle`. */
export interface ZoneHandleImpl extends ZoneHandle {
  readonly collider: TerrainCollider;
  readonly palette: Palette;
  readonly surfaces: readonly SurfaceId[];
  /** World effects (§10.7.8): the spec the zone was built from and its splat context (what a foot lands on). */
  readonly spec: ZoneSpec;
  readonly splat: SplatContext;
  readonly disposed: boolean;
  /** Geometries the builder created, in build order (§10.5.9). */
  readonly geometries: readonly BufferGeometry[];
  /** The scatter draws (instancing.ts; one per kind × tier × alpha class). */
  readonly instanced: readonly ScatterMesh[];
  readonly info: { readonly triangles: number; readonly chunks: number; readonly instances: number; readonly buildMs: number | null };
  /** Per-frame LOD pick against the main camera. Zero allocation. Returns chunks at the impostor tier. */
  updateLod(camera: Vector3, cameraObject: Object3D): number;
  /** Every scatter kind's instance matrices (16 floats per instance, all chunks; tests / audit). */
  scatterInstances(): readonly { readonly kind: string; readonly matrices: Float32Array }[];
  /** Phase A: the pockets' controller (absent when the spec has none); `step` runs from `updateLod`. */
  readonly interiors?: InteriorSystem;
}

const MOVER_R = 0.35;

/** Every drawable a zone build created (the renderer's node-build keep, Handover II: `isZoneMesh`). */
const ZONE_MESHES = new WeakSet<Object3D>();

/** Whether `o` was created by a zone build (terrain, props, buildings, scatter, pockets, obstacles). */
export function isZoneMesh(o: Object3D): boolean { return ZONE_MESHES.has(o); }

// ---- helpers ------------------------------------------------------------------------------------------------

function footprintHeights(h: HeightfieldData, b: BuildingSpec): { max: number; min: number } {
  let max = -Infinity; let min = Infinity;
  for (let i = -1; i <= 1.0001; i += 0.25) {
    for (let j = -1; j <= 1.0001; j += 0.25) {
      const [x, z] = toWorld(b, (i * b.w) / 2, (j * b.d) / 2);
      const y = heightClamped(h, x, z);
      if (y > max) max = y; if (y < min) min = y;
    }
  }
  return { max, min };
}

interface Built { readonly root: Group; readonly geometries: BufferGeometry[]; readonly instanced: ScatterMesh[]; triangles: number }

/**
 * A PropGeo tier as a render object: one Mesh, or a Group of two Meshes when the tier mixes solid and alpha-tested
 * surfaces (split.ts — cards render after solids). Geometry views created here are pushed to `views`.
 */
function objectFromGeo(geo: PropGeo, tier: 0 | 1 | 2, material: (id: SurfaceId) => Material, name: string, views: BufferGeometry[], castShadow: boolean): Object3D {
  const g = tier === 0 ? geo.lod0 : tier === 1 ? geo.lod1 : geo.lod2;
  const mats = geo.surfaces.map((s) => material(s));
  const split = splitByClass(g, mats);
  for (const v of split.views) views.push(v);
  const make = (pg: BufferGeometry, cls: 0 | 1, casts: boolean, k: number): Mesh => {
    const m = new Mesh(pg, mats.length === 1 ? mats[0]! : mats);
    m.name = `${name}${split.parts.length > 1 ? `:c${k}` : ''}`;
    m.renderOrder = cls === 1 ? CARD_RENDER_ORDER : 0;
    m.castShadow = castShadow && casts; m.receiveShadow = true;
    return m;
  };
  if (split.parts.length === 1) { const p0 = split.parts[0]!; return make(p0.geometry, p0.cls, p0.casts, 0); }
  const grp = new Group();
  grp.name = name;
  split.parts.forEach((p, k) => grp.add(make(p.geometry, p.cls, p.casts, k)));
  return grp;
}

/**
 * Local AABB `[minX, minY, minZ, maxX, maxY, maxZ]` of a prop's emissive-class triangles at lod0 (the part that
 * glows: lantern glass, brazier coals, crystal, candles); null when the prop has none.
 */
function emissivePartBounds(geo: PropGeo): [number, number, number, number, number, number] | null {
  return surfaceBounds(geo, (s) => SURFACES[s].cls === 'emissive');
}

/** Local AABB of a prop's lod0 triangles whose surface passes `test`; null when none. */
function surfaceBounds(geo: PropGeo, test: (s: SurfaceId) => boolean): [number, number, number, number, number, number] | null {
  const pos = geo.lod0.getAttribute('position');
  const idx = geo.lod0.getIndex();
  let b: [number, number, number, number, number, number] | null = null;
  for (const gr of geo.lod0.groups) {
    const s = geo.surfaces[gr.materialIndex ?? 0];
    if (s === undefined || !test(s)) continue;
    for (let i = gr.start; i < gr.start + gr.count; i++) {
      const v = idx ? idx.getX(i) : i;
      const x = pos.getX(v); const y = pos.getY(v); const z = pos.getZ(v);
      if (b === null) b = [x, y, z, x, y, z];
      else { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (z < b[2]) b[2] = z; if (x > b[3]) b[3] = x; if (y > b[4]) b[4] = y; if (z > b[5]) b[5] = z; }
    }
  }
  return b;
}

// ---- the build ----------------------------------------------------------------------------------------------

/** The surfaces a zone binds (for preload / eviction). */
export function zoneSurfaces(spec: ZoneSpec): SurfaceId[] {
  const set = BIOME_GENERATORS[spec.generators] ?? BIOME_GENERATORS.grove;
  const pal = paletteFor(spec.palette, spec.biome);
  const out = new Set<SurfaceId>([...setSurfaces(set), ...pal.terrainLayers, pal.plaza, ...interiorSurfaces(spec.interiors ?? [], set, pal)]);
  if (spec.buildings.length > 0) out.add(DOORWAY_SURFACE);
  return [...out].sort();
}

/**
 * SPEC §10.5 `loadZone`: preloads the zone's surfaces (field tier), builds, attaches, creates the lights. Resolves
 * with the handle; `dispose()` follows §10.5.9 exactly.
 */
export async function loadZone(spec: ZoneSpec, deps: ZoneBuildDeps, clock?: () => number): Promise<ZoneHandleImpl> {
  const surfaces = zoneSurfaces(spec);
  await deps.materials.preload(surfaces);
  const t0 = clock ? clock() : null;
  const handle = deps.sliceMs !== undefined && deps.sliceMs > 0
    ? await runSliced(buildZoneSteps(spec, deps, surfaces), {
      sliceMs: deps.sliceMs, now: clock ?? sliceClock, stats: deps.sliceStats ?? createSliceStats(),
      ...(deps.sliceWait ? { wait: deps.sliceWait } : {}), ...(deps.cancelled ? { cancelled: deps.cancelled } : {}), ...(deps.urgent ? { urgent: deps.urgent } : {}),
    })
    : buildZone(spec, deps, surfaces);
  const buildMs = t0 !== null && clock ? clock() - t0 : null;
  (handle.info as { buildMs: number | null }).buildMs = buildMs;
  const hero = (): void => { if (!handle.disposed) void deps.materials.preloadHero(surfaces); };   // never for a zone already gone
  if (deps.heroGate) void deps.heroGate.then(hero, hero); else hero();
  return handle;
}

const sliceClock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Synchronous build (surfaces must be resolvable through `deps.materials.get`). */
export function buildZone(spec: ZoneSpec, deps: ZoneBuildDeps, surfaces: readonly SurfaceId[] = zoneSurfaces(spec)): ZoneHandleImpl {
  return drain(buildZoneSteps(spec, deps, surfaces));
}

/**
 * Handover II: the build as resumable steps (steps.ts) — `buildZone` drains it, a sliced `loadZone` runs it between
 * frames. It yields after every unit of work (a terrain chunk or skirt segment, a building, a prop, a pocket, a static
 * chunk, a scatter kind's placement and its field, a batch of digested geometries); nothing outside the build is read
 * between steps, so the result does not depend on how it is sliced.
 */
export function buildZoneSteps(spec: ZoneSpec, deps: ZoneBuildDeps, surfaces: readonly SurfaceId[] = zoneSurfaces(spec)): Steps<ZoneHandleImpl> {
  return withOwnShapeCache(zoneSteps(spec, deps, surfaces));
}

/** Runs every step of `g` with one shape cache of its own (geo.ts `swapShapeCache`): interleaved builds never share boxes. */
function* withOwnShapeCache<T>(g: Steps<T>): Steps<T> {
  const cache = new Map<string, BufferGeometry>();
  for (;;) {
    const prev = swapShapeCache(cache);
    let r: IteratorResult<string, T>;
    try { r = g.next(); } finally { swapShapeCache(prev); }
    if (r.done === true) return r.value;
    yield r.value;
  }
}

function* zoneSteps(spec: ZoneSpec, deps: ZoneBuildDeps, surfaces: readonly SurfaceId[]): Steps<ZoneHandleImpl> {
  const set: BiomeSet = BIOME_GENERATORS[spec.generators] ?? BIOME_GENERATORS.grove;
  const palette = paletteFor(spec.palette, spec.biome);
  const mat = (id: SurfaceId): Material => deps.materials.get(id);
  const h = spec.heightfield;
  const collider = new TerrainCollider(h);
  const prng = createPrng(spec.seed);
  prng.fork('layout');                                   // content's plan drew its layout from this fork; kept for the fixed label order
  const scatterRng = prng.fork('scatter');
  const propsRng = prng.fork('props');
  prng.fork('lights');
  const plan = layoutOf(spec);                           // content's zone plan (spec.plan): the builder plans no layout of its own
  // a crypt (content data/hideouts.ts) stands outside the zone plan: the scatter content stamps never made way for it, so
  // neither does the drawn scatter (else a rock would vanish and leave its collider)
  const splat = createSplatContext(plan, spec.buildings.filter((b) => b.kind !== 'crypt'), spec.seed, spec.interiors);
  const fieldCells = Math.ceil(FIELD_SIZE[spec.layout] / CHUNK_SIZE);
  const grid: ChunkGrid = chunkGrid((fieldCells + 4) * CHUNK_SIZE);
  const chunks = new ChunkSet(grid);
  const root = new Group();
  root.name = `ewa:zone:${spec.id}`;
  const built: Built = { root, geometries: [], instanced: [], triangles: 0 };
  const lods: LOD[] = [];
  const lodChunks: ChunkRec[] = [];
  const fields: ScatterField[] = [];
  const views: BufferGeometry[] = [];
  const recorded = new Set<BufferGeometry>();
  const record = (g: BufferGeometry): void => { if (!recorded.has(g)) { recorded.add(g); built.geometries.push(g); } };

  // 1. terrain chunks + 2. skirt
  const layers: TerrainLayers = [palette.plaza, palette.terrainLayers[1], palette.terrainLayers[2], palette.terrainLayers[0]];
  for (const c of yield* terrainChunkSteps(h, grid, splat, layers, mat)) {
    root.add(c.mesh); record(c.geometry); built.triangles += c.triangles;
    chunks.at(c.centre[0], c.centre[1]).always.push(c.mesh);
  }
  const exits: { dir: 'n' | 'e' | 's' | 'w'; offset: number }[] = [];
  for (const r of plan.roads) {
    if (r.kind !== 'road') continue;
    for (const end of [r.points[0]!, r.points[r.points.length - 1]!]) {
      const half = h.size / 2;
      if (Math.abs(end[0]) >= half - 1) exits.push({ dir: end[0] > 0 ? 'e' : 'w', offset: end[1] });
      else if (Math.abs(end[1]) >= half - 1) exits.push({ dir: end[1] > 0 ? 's' : 'n', offset: end[0] });
    }
  }
  const neighbours = neighbourFields(spec);
  const skirtOpts: SkirtOpts = { reach: 60, rise: spec.layout === 'route' ? 11 : 14, salt: spec.seed & 0xffff, exits, ...(neighbours.length > 0 ? { neighbours } : {}) };
  const skirtY = skirtHeightFn(h, skirtOpts);
  const skirtClear = skirtClearFn(h, skirtOpts);
  for (const c of yield* skirtSteps(h, skirtOpts, layers, mat)) { root.add(c.mesh); record(c.geometry); built.triangles += c.triangles; }

  // 3. water
  const waterSurface: SurfaceId = set.props.water ?? 'water_pond';
  for (const body of plan.water) {
    const w = buildWaterMesh(h, body, waterSurface, mat(waterSurface));
    if (w) { root.add(w); record(w.geometry); }
    yield 'water';
  }

  // 4. buildings (THREE.LOD each)
  for (const b of spec.buildings) {
    const fh = footprintHeights(h, b);
    // a crypt's lintel and gable glow in lava red (content data/hideouts.ts; its hall's theme binds the surface)
    const geo = yield* houseSteps(set.building, b, { drop: fh.max - fh.min, accent: b.kind === 'gym' ? set.accent : b.kind === 'crypt' ? 'lava_glow' : null });
    yield 'building:geometry';
    const lod = new LOD();
    lod.name = `ewa:building:${b.id}`;
    lod.autoUpdate = false;
    for (let t = 0; t < 3; t++) {
      const m = objectFromGeo(geo, t as 0 | 1 | 2, mat, `${lod.name}:lod${t}`, views, t < 2);
      lod.addLevel(m, BUILDING_LOD_LEVELS[t]!.distance, BUILDING_LOD_LEVELS[t]!.hysteresis);
      yield 'building:tier';
    }
    lod.position.set(b.x, fh.max, b.z);
    lod.rotation.y = b.yaw;
    root.add(lod); lods.push(lod); lodChunks.push(chunks.at(b.x, b.z));
    record(geo.lod0); record(geo.lod1); record(geo.lod2);
    collider.addFootprint({ kind: 'rect', x: b.x, z: b.z, hw: b.w / 2 + 0.12 + MOVER_R, hd: b.d / 2 + 0.12 + MOVER_R, yaw: b.yaw });
    yield 'building';
  }

  // 5. set-piece
  {
    const sp = plan.setPiece;
    const y0 = heightClamped(h, sp.x, sp.z);
    const builder = SET_PIECE_BUILDERS[sp.id];
    if (builder) {
      const ground = (lx: number, lz: number): number => { const [wx, wz] = toWorld(sp, lx, lz); return heightClamped(h, wx, wz) - y0; };
      const geo = builder({ set, seed: spec.seed ^ 0x5e7, ground });
      yield 'set-piece:geometry';
      const lod = new LOD();
      lod.name = `ewa:setpiece:${sp.id}`;
      lod.autoUpdate = false;
      for (let t = 0; t < 3; t++) {
        const m = objectFromGeo(geo, t as 0 | 1 | 2, mat, `${lod.name}:lod${t}`, views, t < 2);
        lod.addLevel(m, BUILDING_LOD_LEVELS[t]!.distance, BUILDING_LOD_LEVELS[t]!.hysteresis);
        yield 'set-piece:tier';
      }
      lod.position.set(sp.x, y0, sp.z);
      lod.rotation.y = sp.yaw;
      root.add(lod); lods.push(lod); lodChunks.push(chunks.at(sp.x, sp.z));
      record(geo.lod0); record(geo.lod1); record(geo.lod2);
      if (sp.id === 'grove_heart_tree') collider.addFootprint({ kind: 'circle', x: sp.x, z: sp.z, r: 4.45 + MOVER_R });
      else if (SOLID_SET_PIECES.has(sp.id)) collider.addFootprint({ kind: 'rect', x: sp.x, z: sp.z, hw: sp.hw * 0.6, hd: sp.hd * 0.6, yaw: sp.yaw });
    }
  }
  yield 'set-piece';

  // 6. static props merged per chunk
  // key = chunk index * 2 + (casts shadows ? 1 : 0): small / low things go to a non-casting mesh per chunk
  const staticParts = new Map<number, [Parts, Parts, Parts]>();
  const partsAt = (x: number, z: number, cast = true): [Parts, Parts, Parts] => {
    const rec = chunks.at(x, z);
    const key = rec.index * 2 + (cast ? 1 : 0);
    let p = staticParts.get(key);
    if (!p) { p = tiers3(); staticParts.set(key, p); }
    return p;
  };
  const placeProp = (geo: PropGeo, x: number, y: number, z: number, yaw: number, scale = 1, cast = true): void => {
    const t = partsAt(x, z, cast);
    const m = trs(x, y, z, yaw, scale);
    for (let k = 0; k < 3; k++) addPropTier(t[k]!, geo, k as 0 | 1 | 2, m);
  };
  // hand-placed foliage joins the scatter of its kind (step 7), so it takes its LOD per instance (detail.ts)
  const propFoliage = new Map<string, { readonly seed: number; readonly instances: Instance[] }>();
  for (const pp of spec.props) {
    const y = heightClamped(h, pp.x, pp.z);
    const yp = y - (pp.kind.startsWith('tree') ? 0.1 : 0);
    if (isFoliageProp(pp.kind)) {
      let e = propFoliage.get(pp.kind);
      if (e === undefined) { e = { seed: pp.seed, instances: [] }; propFoliage.set(pp.kind, e); }
      e.instances.push({ x: pp.x, y: yp, z: pp.z, yaw: pp.yaw, scale: pp.scale > 0 ? pp.scale : 1, tint: UNTINTED });
    } else {
      const geo = buildPropKind(set, pp.kind, pp.seed);
      if (!geo) continue;
      placeProp(geo, pp.x, yp, pp.z, pp.yaw, pp.scale > 0 ? pp.scale : 1, !NON_CASTING_PROPS.has(pp.kind));
      disposeProp(geo);
    }
    const r = PROP_BLOCKER[pp.kind] ?? 0;
    if (pp.kind === 'garden') collider.addFootprint({ kind: 'rect', x: pp.x, z: pp.z, hw: 2.7 + MOVER_R, hd: 1.8 + MOVER_R, yaw: pp.yaw });
    else if (pp.kind === 'bench') collider.addFootprint({ kind: 'rect', x: pp.x, z: pp.z, hw: 1.0 + MOVER_R, hd: 0.25 + MOVER_R, yaw: pp.yaw });
    else if (pp.kind === 'fence') collider.addFootprint({ kind: 'rect', x: pp.x, z: pp.z, hw: FENCE_FOOTPRINT.hw + MOVER_R, hd: FENCE_FOOTPRINT.hd + MOVER_R, yaw: pp.yaw });
    else if (r > 0) collider.addFootprint({ kind: 'circle', x: pp.x, z: pp.z, r: r + MOVER_R });
    yield 'prop';
  }
  // Phase E1: wall-hugging dressing round the town buildings, inside their collider footprints (dressing.ts)
  const dressing = dressingFor(set.biome);
  {
    const near = (x: number, z: number): boolean => {
      for (const pp of spec.props) if (Math.hypot(pp.x - x, pp.z - z) < (PROP_BLOCKER[pp.kind] ?? 0) + 0.9) return false;
      for (const l of spec.lights) if (Math.hypot(l.position[0] - x, l.position[2] - z) < 0.9) return false;
      for (const [px, pz] of plan.points) if (Math.hypot(px - x, pz - z) < 1.3) return false;
      return true;
    };
    for (const b of spec.buildings) {
      for (const sk of skirtPlacements(b, dressing, near)) {
        const geo = buildSkirtItem(set, sk.kind, sk.seed);
        placeProp(geo, sk.x, heightClamped(h, sk.x, sk.z) - 0.02, sk.z, sk.yaw, 1, false);
        disposeProp(geo);
      }
      yield 'dressing';
    }
    // M3 review fixes: walk-through clutter round the plaza rim (dressing.ts `PLAZA_CLUTTER`; salt / storm / sky / cinder)
    if (plan.plaza && spec.layout === 'town') {
      const P = plan.plaza;
      const clear = (x: number, z: number, r: number): boolean => {
        if (!near(x, z)) return false;
        if (roadDistance(splat.roads, x, z) < r + 0.25) return false;
        if (inSetPiece(plan, x, z, r + 0.3)) return false;
        for (const b of spec.buildings) if (footprintDistance(b, x, z) < r + 0.3) return false;
        return true;
      };
      for (const c of plazaClutter(set.biome, P.x, P.z, P.r, spec.seed & 0xffff, clear)) {
        const geo = buildClutterItem(set, c.kind, c.seed);
        placeProp(geo, c.x, heightClamped(h, c.x, c.z) - 0.02, c.z, c.yaw, 1, true);
        disposeProp(geo);
      }
      yield 'dressing';
    }
  }
  // light housings (generated); each one's glowing part is tagged for dumpZone's lightSources (§50.4.6 both directions)
  const housingTags: HousingTag[] = [];
  for (const l of spec.lights) {
    if (l.housing.kind !== 'generated') continue;
    const gen = l.housing.generator;
    const geo = buildHousing(set, gen, l.housing.seed);
    const [x, y, z] = l.position;
    const base = y - HOUSING_LOCAL[gen][1];
    const g = heightClamped(h, x, z);
    const castHousing = gen === 'beacon' || gen === 'brazier';
    placeProp(geo, x, base, z, 0, 1, castHousing);
    const glow = emissivePartBounds(geo);
    if (glow) housingTags.push({ id: `${l.id}:housing`, min: [glow[0] + x, glow[1] + base, glow[2] + z], max: [glow[3] + x, glow[4] + base, glow[5] + z] });
    disposeProp(geo);
    if (base > g + 0.02) { const t = partsAt(x, z, castHousing); for (const p of t) box(p, set.props.stone, x, g - 0.2, z, 0.5, base - g + 0.22, 0.5, 0, 0.04); }
    collider.addFootprint({ kind: 'circle', x, z, r: (gen === 'beacon' ? 0.45 : 0.22) + MOVER_R });
    yield 'housing';
  }
  yield* boundarySteps(spec, plan, set, dressing, partsAt, propsRng.next.bind(propsRng));
  yield* waterDressingSteps(spec, plan, set, partsAt);
  yield* bridgeSteps(spec, plan, set, partsAt);
  yield* cragSteps(spec, plan, set, partsAt);
  yield* structureSteps(spec, plan, set, partsAt);
  if (plan.plaza) { yield* plazaCurbSteps(h, plan, palette, set, partsAt); yield* plazaPatternSteps(h, plan, set, partsAt, spec.seed); }
  yield* warpRoomSteps(h, plan, set, partsAt, splat.pockets);
  // 6b. Phase A pockets: one group per town building's hall (hall hidden, canopy shown until `setActive`)
  const pockets: BuiltInterior[] = [];
  for (const ip of spec.interiors ?? []) {
    const made: BufferGeometry[] = [];
    const b = yield* interiorSteps(ip, { zoneSet: set, palette, heightfield: h, material: mat, geometries: made, views });
    for (const g of made) { record(g); built.triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3; }
    root.add(b.root);
    for (const f of b.footprints) collider.addFootprint({ ...f, hw: f.hw + MOVER_R, hd: f.hd + MOVER_R });
    if (b.canopyLod) { lods.push(b.canopyLod); lodChunks.push(chunks.at(ip.x, ip.z)); }
    pockets.push(b);
    yield 'pocket';
  }
  const interiorSystem = pockets.length > 0 ? new InteriorSystem(pockets) : null;
  // 6c. Phase D10 obstacles: one object each (never merged), so a cleared one can be swapped per player
  const obstacles = buildObstacles(spec, set, mat, views, record, root);
  // 6d. camp bases: each camp's banner and one object per trophy kind per slot, all hidden until `camps.set`
  const camps = buildCamps(spec, set, mat, views, record, root);
  releaseShapeCache();
  yield 'obstacles';
  const chunkKeys = [...staticParts.keys()].sort((a, b) => a - b);
  for (const key of chunkKeys) {
    const tiers = staticParts.get(key)!;
    const geo = finish(tiers);
    const k = key >> 1; const cast = (key & 1) === 1;
    const rec = chunks.get(k);
    for (let t = 0; t < 3; t++) {
      const g = t === 0 ? geo.lod0 : t === 1 ? geo.lod1 : geo.lod2;
      record(g);
      if (g.getAttribute('position').count === 0) continue;
      const m = objectFromGeo(geo, t as 0 | 1 | 2, mat, `ewa:props:${k}:${cast ? 'c' : 'n'}:lod${t}`, views, cast && t < 2);
      m.visible = t === 0;
      root.add(m);
      rec.byTier[t]!.push(m);
      if (t === 2) rec.byTier[3]!.push(m);
    }
    yield 'static-chunk';
  }

  // 7. scatter
  const tints = [...palette.scatterTints, ...FLOWER_TINTS, ...dressing.grassTints].map((hex) => new Color(hex));
  const flowerTint0 = palette.scatterTints.length;
  const scatterKinds = yield* scatterSteps(spec, plan, set, dressing, splat, collider, skirtY, mat, views, (scatterRng.next() * 4294967296) >>> 0, flowerTint0, FLOWER_TINTS.length, palette.scatterTints.length, skirtClear);
  for (const [kind, e] of [...propFoliage].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const into = scatterKinds.find((sk) => sk.kind.name === kind);
    if (into !== undefined) { into.instances.push(...e.instances); continue; }
    const made = propFoliageKind(set, kind, e.seed, mat, views);
    if (made !== null) scatterKinds.push({ ...made, instances: e.instances });
  }
  for (const sk of scatterKinds) {
    const field = new ScatterField(sk.kind, sk.instances, chunks, root, tints);
    fields.push(field);
    for (const m of field.meshes) built.instanced.push(m);
    for (const g of sk.sources) record(g);
    yield 'scatter:field';
  }
  chunks.initVisibility();
  for (const f of fields) f.sync(chunks);
  yield 'scatter:sync';

  // 8. lights
  let punctuals: PunctualHandle[] = [];
  if (deps.lighting) punctuals = deps.lighting.createPunctuals(spec.lights, root);

  // digest: every builder geometry's position bytes in build order, then the instance matrices
  const digest = new Digest();
  for (let i = 0; i < built.geometries.length; i++) {
    digest.add(built.geometries[i]!.getAttribute('position').array as Float32Array);
    if ((i & 31) === 31) yield 'digest';
  }
  let instances = 0;
  for (const f of fields) { digest.add(f.instanceData()); instances += f.total; }
  yield 'digest';

  root.userData[HOUSINGS_KEY] = housingTags;
  root.traverse((o) => { if ((o as Mesh).isMesh === true) ZONE_MESHES.add(o); });
  if (deps.scene) deps.scene.add(root);

  let disposed = false;
  let lastStepMs = -1;
  let lodScale = 1;
  const geometries = built.geometries;
  const handle: ZoneHandleImpl = {
    id: spec.id,
    group: root,
    collider,
    bounds: collider.bounds,
    geometryDigest: digest.hex(),
    palette,
    surfaces,
    spec,
    splat,
    get disposed() { return disposed; },
    geometries,
    instanced: built.instanced,
    info: { triangles: built.triangles, chunks: chunks.records().length, instances, buildMs: null },
    ...(interiorSystem ? { interiors: interiorSystem } : {}),
    ...(obstacles ? { obstacles } : {}),
    ...(camps ? { camps } : {}),
    scatterInstances: () => fields.map((f) => ({ kind: f.kind.name, matrices: f.instanceData() })),
    stats: () => (deps.stats ? deps.stats() : createRenderStats()),
    updateLod(camera: Vector3, cameraObject: Object3D): number {
      if (disposed) return 0;
      if (interiorSystem) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        interiorSystem.step(lastStepMs < 0 ? 0 : now - lastStepMs);
        lastStepMs = now;
      }
      const far = chunks.update(camera, (cameraObject as Object3D & { isCamera?: boolean }).isCamera ? cameraObject as never : null);
      for (let i = 0; i < fields.length; i++) fields[i]!.sync(chunks);
      if (detailState.lodScale !== lodScale) {
        // the quality preset's LOD scale (detail.ts) moves the building / set-piece level distances too
        lodScale = detailState.lodScale;
        for (const lod of lods) lod.levels.forEach((lv, t) => { lv.distance = BUILDING_LOD_LEVELS[t]!.distance * lodScale; });
      }
      for (let i = 0; i < lods.length; i++) {
        const lod = lods[i]!;
        lod.visible = lodChunks[i]!.active;
        if (lod.visible) lod.update(cameraObject as never);
      }
      return far;
    },
    /** §10.5.9: remove; dispose geometries (reverse build order), instanced meshes, lights; evict; drop the collider. */
    dispose(): void {
      if (disposed) return;
      disposed = true;
      const finishGpu = deps.releaseGpu ? deps.releaseGpu(root) : null;
      root.removeFromParent();
      for (let i = views.length - 1; i >= 0; i--) views[i]!.dispose();
      for (let i = geometries.length - 1; i >= 0; i--) geometries[i]!.dispose();
      for (let i = built.instanced.length - 1; i >= 0; i--) built.instanced[i]!.dispose();
      // plain meshes have no dispose(): dispatch the event their render objects listen to, so three releases the
      // render objects (and the programs they hold) now instead of never (library materials are never disposed)
      root.traverse((o) => { if ((o as Mesh).isMesh && !isScatterMesh(o)) o.dispatchEvent({ type: 'dispose' } as never); });
      if (deps.lighting && punctuals.length > 0) deps.lighting.releasePunctuals(punctuals);
      punctuals = [];
      deps.materials.evictExcept(deps.nextKeep ? deps.nextKeep() : []);
      (handle as { collider: TerrainCollider | null }).collider = null;
      if (finishGpu) finishGpu();
      root.clear();
    },
  };
  return handle;
}

/** Slope (rise per metre) from which a cliff face gets boulders (the walkable limit is 0.7). */
const CLIFF_ROCK_SLOPE = 1.1;

/** Phase D10: a small tree's scale on the biome's first scatter tree (a sapling a Cut can fell). */
export const OBSTACLE_TREE_SCALE = 0.55;

/** fnv1a32 of an id, for per-obstacle seeds that never depend on list order. */
function idSeed(id: string): number {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) | 0; }
  return h >>> 0;
}

/**
 * Phase D10: each obstacle as its own object under the zone root (a tree: the biome's first scatter tree at
 * OBSTACLE_TREE_SCALE plus a hidden stump; a boulder: a large rock), and the handle that swaps them per player. Library
 * materials only; every geometry is recorded for the digest and disposal. null when the spec has none.
 */
function buildObstacles(
  spec: ZoneSpec, set: BiomeSet, material: (id: SurfaceId) => Material, views: BufferGeometry[], record: (g: BufferGeometry) => void, root: Group,
): ObstaclesHandle | null {
  const list = spec.obstacles ?? [];
  if (list.length === 0) return null;
  const h = spec.heightfield;
  const objs = new Map<string, { readonly standing: Object3D; readonly cleared: Object3D | null; done: boolean }>();
  for (const o of list) {
    const seed = (spec.seed ^ idSeed(o.id)) >>> 0;
    const y = heightClamped(h, o.x, o.z);
    const tree = set.trees[0];
    let standing: Object3D;
    let cleared: Object3D | null = null;
    if (o.kind === 'tree' && tree !== undefined) {
      const geo = buildTree(tree.bark, tree.leaf, tree.shape, seed);
      standing = objectFromGeo(geo, 0, material, `ewa:obstacle:${o.id}`, views, true);
      standing.scale.setScalar(OBSTACLE_TREE_SCALE);
      standing.position.set(o.x, y - 0.06, o.z);
      record(geo.lod0); record(geo.lod1); record(geo.lod2);
      const sg = buildStump(tree.bark, set.props.wood, seed ^ 0x51);
      cleared = objectFromGeo(sg, 0, material, `ewa:obstacle:${o.id}:stump`, views, false);
      cleared.position.set(o.x, y - 0.04, o.z);
      cleared.visible = false;
      record(sg.lod0); record(sg.lod1); record(sg.lod2);
      root.add(cleared);
    } else if (o.kind === 'bramble') {
      // §10.7.9 a thorn patch a Fire lead burns: a dense knot of the biome's bush leaves round a low rock; burnt, it is gone
      const leaf = set.bushLeaf ?? tree?.leaf ?? set.props.leaf;
      const knot = new Group();
      knot.name = `ewa:obstacle:${o.id}`;
      const parts: readonly (readonly [number, number, number])[] = [[0, 0, 1.25], [0.75, 0.35, 0.85], [-0.6, 0.5, 0.9], [0.15, -0.75, 0.8]];
      parts.forEach(([dx, dz, size], k) => {
        const geo = buildBush(leaf, (seed ^ (k * 0x9e37)) >>> 0, size);
        const bush = objectFromGeo(geo, 0, material, `ewa:obstacle:${o.id}:b${k}`, views, true);
        bush.position.set(dx, 0, dz);
        record(geo.lod0); record(geo.lod1); record(geo.lod2);
        knot.add(bush);
      });
      knot.position.set(o.x, y - 0.08, o.z);
      knot.rotation.y = ((seed & 0xffff) / 0xffff) * Math.PI * 2;
      standing = knot;
    } else {
      const geo = buildRock(set.rock, seed, { size: 1.15, squash: 0.78, elongate: 1.15, cuts: [3, 5] });
      standing = objectFromGeo(geo, 0, material, `ewa:obstacle:${o.id}`, views, true);
      standing.position.set(o.x, y - 0.2, o.z);
      standing.rotation.y = ((seed & 0xffff) / 0xffff) * Math.PI * 2;
      record(geo.lod0); record(geo.lod1); record(geo.lod2);
    }
    standing.userData = { ...standing.userData, ewaObstacle: o.id };
    root.add(standing);
    objs.set(o.id, { standing, cleared, done: false });
  }
  return {
    ids: list.map((o) => o.id),
    setCleared(id: string, done: boolean): void {
      const e = objs.get(id);
      if (e === undefined || e.done === done) return;
      e.done = done;
      e.standing.visible = !done;
      if (e.cleared !== null) e.cleared.visible = done;
    },
    isCleared(id: string): boolean {
      return objs.get(id)?.done === true;
    },
  };
}

/**
 * Camp bases (§10.7.10): per camp a group holding its banner pole and, for every trophy slot, one object per trophy kind
 * (the set's own prop builders and library materials), all hidden; the handle shows the banner and one kind per slot.
 * Walk-through: no collider footprint, the heightfield untouched. null when the spec has none.
 */
function buildCamps(
  spec: ZoneSpec, set: BiomeSet, material: (id: SurfaceId) => Material, views: BufferGeometry[], record: (g: BufferGeometry) => void, root: Group,
): CampsHandle | null {
  const list = spec.camps ?? [];
  if (list.length === 0) return null;
  const h = spec.heightfield;
  const st = set.props;
  const made = new Map<string, { readonly banner: Object3D; readonly slots: ReadonlyMap<CampTrophyKind, Object3D>[]; shown: (CampTrophyKind | null)[] }>();
  const place = (pieces: readonly { readonly geo: PropGeo; readonly x: number; readonly z: number; readonly yaw: number; readonly scale: number }[], name: string, x: number, z: number, yaw: number): Object3D => {
    const g = new Group();
    g.name = name;
    pieces.forEach((p, k) => {
      const o = objectFromGeo(p.geo, 0, material, `${name}:${k}`, views, true);
      o.position.set(p.x, 0, p.z);
      o.rotation.y = p.yaw;
      o.scale.setScalar(p.scale);
      record(p.geo.lod0); record(p.geo.lod1); record(p.geo.lod2);
      g.add(o);
    });
    g.position.set(x, heightClamped(h, x, z) - 0.04, z);
    g.rotation.y = yaw;
    g.visible = false;
    root.add(g);
    return g;
  };
  for (const c of list) {
    const banner = place([{ geo: buildCampBanner(st, (spec.seed ^ idSeed(`${c.id}:banner`)) >>> 0), x: 0, z: 0, yaw: 0, scale: 1 }], `ewa:camp:${c.id}:banner`, c.banner.x, c.banner.z, c.banner.yaw);
    const slots = c.slots.map((s, i) => {
      const byKind = new Map<CampTrophyKind, Object3D>();
      for (const kind of TROPHY_KINDS) byKind.set(kind, place(buildTrophy(st, kind, (spec.seed ^ idSeed(`${c.id}:${i}:${kind}`)) >>> 0), `ewa:camp:${c.id}:${i}:${kind}`, s.x, s.z, s.yaw));
      return byKind;
    });
    made.set(c.id, { banner, slots, shown: slots.map(() => null) });
  }
  return {
    ids: list.map((c) => c.id),
    set(id, held): void {
      const e = made.get(id);
      if (e === undefined) return;
      e.banner.visible = held !== null;
      e.slots.forEach((byKind, i) => {
        const want = held === null ? null : (held.trophies[i] ?? null);
        for (const [kind, o] of byKind) o.visible = kind === want;
        e.shown[i] = want !== null && byKind.has(want) ? want : null;
      });
    },
    shown(id) {
      const e = made.get(id);
      return e === undefined ? null : { banner: e.banner.visible, trophies: [...e.shown] };
    },
  };
}

/** Set-pieces the movement solver treats as solid (towers, huts, gates…); the rest are walkable or open. */
const SOLID_SET_PIECES = new Set<string>(['cinder_caldera', 'salt_lighthouse', 'storm_coil_tower', 'marrow_mineshaft', 'vesper_witch_hut', 'siege_trebuchet', 'sky_shrine', 'solenne_cathedral', 'eclipse_engine', 'umbral_dome', 'celestial_spire', 'rift_maw', 'tide_wreck']);

const FLOWER_TINTS = ['#ffb3c8', '#ffe07a', '#fff6ea', '#c6adff', '#ffbd7a', '#ff9aa8'];
/* Ground-clump tints are per biome since Phase E1 (`DressingStyle.grassTints`; the grove keeps #c9d49c / #b9c78c /
   #d6d9a2 / #c2cf95, darker and yellower than the card so clumps sit in the lawn instead of on it). */

// ---- boundary / water / plaza / warp dressing ---------------------------------------------------------------

type PartsAt = (x: number, z: number, cast?: boolean) => [Parts, Parts, Parts];

/** Hand-placed kinds too small / low for a shadow draw per cascade. */
/**
 * Hand-placed props drawn as scatter instances of their kind instead of merged into the chunk mesh: one draw per tier
 * and an LOD per instance (`detail.ts`). They take the zone's scatter geometry of that kind (or the first prop's when
 * the zone scatters none), so a hand-placed bush shares its shape with the zone's other bushes.
 */
function isFoliageProp(kind: string): boolean {
  return kind === 'bush' || kind === 'flower_patch' || kind.startsWith('tree');
}
/** A tint index past every palette: the instance keeps the material's own colour, as the merged prop did. */
const UNTINTED = -1;

/** The scatter kind for a hand-placed foliage prop kind the zone does not scatter itself. */
function propFoliageKind(set: BiomeSet, kind: string, seed: number, mat: (id: SurfaceId) => Material, views: BufferGeometry[]): { kind: ScatterKind; sources: BufferGeometry[] } | null {
  const geo = buildPropKind(set, kind, seed);
  if (geo === null) return null;
  if (kind === 'bush') return kindFrom('bush', geo, mat, views, true, 3, null, 2);
  if (kind === 'flower_patch') return kindFrom('flower_patch', geo, mat, views, false, 2, null, 0, 'all');
  const t = set.trees.find((x) => x.kind === kind) ?? set.trees[0];
  return kindFrom(kind, geo, mat, views, true, 3, t !== undefined ? impostorFor(geo, t.leaf) : null);
}

const NON_CASTING_PROPS = new Set<string>(['flower_patch', 'rock_s', 'sign', 'crate', 'barrel', 'planter', 'fence']);

/** Where roads cross the playable boundary (gaps in walls / hedges). */
function exitGaps(plan: ZoneLayoutPlan, ih: number): { side: 'n' | 's' | 'e' | 'w'; at: number }[] {
  const out: { side: 'n' | 's' | 'e' | 'w'; at: number }[] = [];
  for (const r of plan.roads) {
    if (r.kind !== 'road') continue;
    for (let i = 0; i + 1 < r.points.length; i++) {
      const a = r.points[i]!; const b = r.points[i + 1]!;
      for (const [side, axis, val] of [['e', 0, ih], ['w', 0, -ih], ['s', 1, ih], ['n', 1, -ih]] as const) {
        const va = a[axis]; const vb = b[axis];
        if ((va - val) * (vb - val) <= 0 && va !== vb) {
          const t = (val - va) / (vb - va);
          const other = axis === 0 ? a[1] + (b[1] - a[1]) * t : a[0] + (b[0] - a[0]) * t;
          out.push({ side, at: other });
        }
      }
    }
  }
  return out;
}

/**
 * The town boundary just outside the walkable square, with gaps (and, Phase E1, gate piers) at the road exits:
 * dry-stone walls (`wall`: grove, forge, capital), post-and-rail fences (`fence`: salt, vesper), boulder dykes
 * (`rocks`: cinder, storm, marrow, sky). Nothing here is walkable ground (the heightfield ends at `half − 16`).
 */
function* boundarySteps(spec: ZoneSpec, plan: ZoneLayoutPlan, set: BiomeSet, style: DressingStyle, partsAt: PartsAt, rnd: () => number): Steps<void> {
  if (spec.layout !== 'town' || set.boundary === 'hedge' || set.boundary === 'crystal') return;
  const h = spec.heightfield;
  const ih = plan.half - 16 + 1.2;
  const pieces = boundaryPieces(ih, exitGaps(plan, ih), style, spec.seed);
  const stone = set.props.stone;
  const wood = set.props.wood;
  const rocks = set.boundary === 'rocks'
    ? [0, 1, 2].map((k) => buildRock(set.rock, spec.seed + 0xb0d + k * 17, { size: 0.85 + k * 0.2, squash: 0.62, elongate: 1.35, cuts: [3, 5] }))
    : [];
  const piers = pieces.filter((pc) => pc.kind === 'pier');
  const nearPier = (x: number, z: number, r: number): boolean => piers.some((pc) => Math.hypot(pc.x - x, pc.z - z) < r);
  for (const pc of pieces) {
    yield 'boundary';
    const along = pc.yaw === 0 ? [1, 0] : [0, 1];
    const y = heightClamped(h, pc.x, pc.z);
    const t = partsAt(pc.x, pc.z);
    if (pc.kind === 'pier') {
      const top = set.boundary === 'fence' ? 1.55 : 1.9;
      if (set.boundary === 'fence') {
        box(t[0], wood, pc.x, y - 0.3, pc.z, 0.32, top + 0.3, 0.32, pc.yaw, 0.04);
        box(t[0], wood, pc.x, y + top - 0.02, pc.z, 0.42, 0.12, 0.42, pc.yaw, 0.03);
        box(t[1], wood, pc.x, y - 0.3, pc.z, 0.32, top + 0.42, 0.32, pc.yaw, 0.03);
        box(t[2], wood, pc.x, y - 0.3, pc.z, 0.36, top + 0.42, 0.36, pc.yaw, 0.02);
      } else {
        box(t[0], stone, pc.x, y - 0.3, pc.z, 0.95, 0.5, 0.95, pc.yaw, 0.05);
        box(t[0], stone, pc.x, y + 0.2, pc.z, 0.78, top - 0.2, 0.78, pc.yaw, 0.04);
        box(t[0], stone, pc.x, y + top, pc.z, 0.98, 0.16, 0.98, pc.yaw, 0.04);
        lathe(t[0], stone, [[0.001, 0], [0.22, 0.04], [0.26, 0.18], [0.16, 0.34], [0.001, 0.42]], { segments: 10 }, trs(pc.x, y + top + 0.16, pc.z));
        box(t[1], stone, pc.x, y - 0.3, pc.z, 0.85, top + 0.46, 0.85, pc.yaw, 0.04);
        box(t[2], stone, pc.x, y - 0.3, pc.z, 0.9, top + 0.46, 0.9, pc.yaw, 0.02);
      }
      continue;
    }
    if (set.boundary === 'wall') {
      // dry-stone blocks of 0.8–1.3 m along the run, a ragged coping course on top
      for (let s0 = -pc.len / 2; s0 < pc.len / 2 - 0.2;) {
        const len = Math.min(0.8 + rnd() * 0.5, pc.len / 2 - s0);
        const mid = s0 + len / 2;
        s0 += len + 0.02;
        const x = pc.x + along[0]! * mid; const z = pc.z + along[1]! * mid;
        const yy = heightClamped(h, x, z);
        box(t[0], stone, x, yy - 0.25, z, len, 0.72 + rnd() * 0.08, 0.62, pc.yaw + (rnd() - 0.5) * 0.04, 0.05);
        box(t[0], stone, x + (rnd() - 0.5) * 0.1, yy + 0.47, z, len * (0.55 + rnd() * 0.4), 0.3 + rnd() * 0.08, 0.5, pc.yaw + (rnd() - 0.5) * 0.1, 0.05);
      }
      box(t[1], stone, pc.x, y - 0.25, pc.z, pc.len, 0.95, 0.6, pc.yaw, 0.04);
      box(t[2], stone, pc.x, y - 0.25, pc.z, pc.len + 0.02, 0.95, 0.6, pc.yaw, 0.02);
    } else if (set.boundary === 'fence') {
      // posts at both ends of the run (shared with the neighbour), two chamfered rails
      const ax = pc.x - along[0]! * pc.len / 2; const az = pc.z - along[1]! * pc.len / 2;
      const bx = pc.x + along[0]! * pc.len / 2; const bz = pc.z + along[1]! * pc.len / 2;
      const ya = heightClamped(h, ax, az); const yb = heightClamped(h, bx, bz);
      for (const k of [0, 1] as const) box(t[k], wood, ax, ya - 0.25, az, 0.14, 1.4, 0.14, pc.yaw + (rnd() - 0.5) * 0.08, 0.02);
      for (const dy of [0.45, 0.95]) beam(t[0], wood, [ax, ya + dy, az], [bx, yb + dy, bz], 0.12, 0.06, 0.015, pc.yaw === 0 ? [0, 0, 1] : [1, 0, 0]);
      beam(t[1], wood, [ax, ya + 0.8, az], [bx, yb + 0.8, bz], 0.14, 0.07, 0.01, pc.yaw === 0 ? [0, 0, 1] : [1, 0, 0]);
      box(t[2], wood, pc.x, y - 0.2, pc.z, pc.len, 1.2, 0.1, pc.yaw, 0.01);
    } else {
      // boulder dyke: 2–3 rocks squeezed along the run, a smaller one on top now and then
      const n = 2 + (rnd() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const u = (-0.5 + (k + 0.5) / n) * pc.len + (rnd() - 0.5) * 0.4;
        const x = pc.x + along[0]! * u + along[1]! * (rnd() - 0.5) * 0.5; const z = pc.z + along[1]! * u + along[0]! * (rnd() - 0.5) * 0.5;
        const yy = heightClamped(h, x, z);
        const rk = rocks[Math.floor(rnd() * rocks.length)]!;
        if (nearPier(x, z, 1.7)) continue;                 // the pier stands on clear ground
        const m = trs(x, yy - 0.15, z, rnd() * Math.PI * 2, 0.9 + rnd() * 0.45);
        t[0].add(set.rock, rk.lod0, m); t[1].add(set.rock, rk.lod1, m); t[2].add(set.rock, rk.lod2, m);
        if (rnd() < 0.3) {
          const m2 = trs(x + (rnd() - 0.5) * 0.3, yy + 0.55, z + (rnd() - 0.5) * 0.3, rnd() * Math.PI * 2, 0.5 + rnd() * 0.2);
          t[0].add(set.rock, rk.lod0, m2); t[1].add(set.rock, rk.lod1, m2);
        }
      }
    }
  }
  for (const rk of rocks) disposeProp(rk);
}

/** Stone banks round ponds (skipping the boardwalk arc) and a pier over content's boardwalk strips. */
function* waterDressingSteps(spec: ZoneSpec, plan: ZoneLayoutPlan, set: BiomeSet, partsAt: PartsAt): Steps<void> {
  const h = spec.heightfield;
  for (const body of plan.water) {
    if (body.r > 18) continue;                      // sea / lakes: no masonry ring
    const bank = buildPondBank(set.props, body.r + 0.3, spec.seed + body.id * 31);
    yield 'water-dressing:bank';
    // re-emit the bank stones one by one so the boardwalk arc can be skipped and each sits on the terrain
    const t = partsAt(body.cx, body.cz, false);
    const n = Math.max(10, Math.round((Math.PI * 2 * (body.r + 0.3)) / 0.8));
    const rocks = [buildRock(set.props.rock, spec.seed + body.id * 7 + 1, { size: 0.42, squash: 0.45, elongate: 1.5, cuts: [3, 4] }), buildRock(set.props.rock, spec.seed + body.id * 7 + 2, { size: 0.36, squash: 0.5, elongate: 1.3, cuts: [3, 4] })];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (hash2(k, body.id, 5) - 0.5) * 0.12;
      if (body.boardwalk && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.32) continue;
      const rr = body.r + 0.35 + (hash2(k, body.id, 6) - 0.5) * 0.3;
      const x = body.cx + Math.cos(a) * rr; const z = body.cz + Math.sin(a) * rr;
      const y = Math.max(heightClamped(h, x, z), body.level - 0.05);
      const m = trs(x, y - 0.06, z, -a + (hash2(k, body.id, 7) - 0.5) * 0.4, 0.85 + hash2(k, body.id, 8) * 0.5);
      const rk = rocks[k % 2]!;
      t[0].add(set.props.rock, rk.lod0, m); t[1].add(set.props.rock, rk.lod1, m);
      if (k % 2 === 0) t[2].add(set.props.rock, rk.lod2, m);
      if ((k & 7) === 7) yield 'water-dressing:stones';
    }
    for (const rk of rocks) disposeProp(rk);
    disposeProp(bank);
    // pier on the boardwalk strip (both walkable and water): planks across, posts into the water, a rail
    const bw = body.boardwalk;
    if (!bw) continue;
    // a sculpted road's deck over this water is a bridge (bridgeSteps), not a pond pier
    if (plan.bridges.some((br) => br.points.some(([mx, mz]) => mx >= body.x0 - 2 && mx <= body.x1 + 2 && mz >= body.z0 - 2 && mz <= body.z1 + 2))) continue;
    const zc = (bw.z0 + bw.z1) / 2;
    const width = Math.max(2.4, bw.z1 - bw.z0 + 0.6);
    const x0 = bw.x0 - 0.6; const x1 = bw.x1 + 1.6;
    const deck = bw.y + 0.08;
    for (let x = x0; x <= x1; x += 0.36) {
      const tp = partsAt(x, zc, false);
      box(tp[0], set.props.wood, x, deck - 0.06, zc + (hash2(Math.round(x * 10), body.id, 1) - 0.5) * 0.04, 0.32, 0.06, width - hash2(Math.round(x * 10), body.id, 2) * 0.1, (hash2(Math.round(x * 10), body.id, 3) - 0.5) * 0.04, 0.012);
      if (Math.round((x - x0) / 0.36) % 2 === 0) box(tp[1], set.props.wood, x, deck - 0.06, zc, 0.7, 0.06, width, 0, 0.012);
      yield 'water-dressing:planks';
    }
    const tp = partsAt((x0 + x1) / 2, zc, false);
    box(tp[2], set.props.wood, (x0 + x1) / 2, deck - 0.08, zc, x1 - x0, 0.08, width, 0, 0.02);
    for (let x = x0; x <= x1 + 0.01; x += 1.8) {
      for (const s of [-1, 1]) {
        const z = zc + s * (width / 2 - 0.05);
        const tpp = partsAt(x, z, false);
        const top = deck + (x < bw.x0 + 1 ? 0.9 : 0.12);
        box(tpp[0], set.props.wood, x, body.floor - 0.2, z, 0.16, top - body.floor + 0.2, 0.16, 0, 0.03);
        box(tpp[1], set.props.wood, x, body.floor - 0.2, z, 0.16, top - body.floor + 0.2, 0.16, 0, 0.03);
      }
      yield 'water-dressing:posts';
    }
    for (const s of [-1, 1]) beam(tp[0], set.props.wood, [x0, deck + 0.82, zc + s * (width / 2 - 0.05)], [bw.x0 + 1, deck + 0.82, zc + s * (width / 2 - 0.05)], 0.09, 0.06, 0.015, [0, 0, s]);
    yield 'water-dressing:rail';
  }
}

/**
 * Sculpted bridges (content `ZonePlan.bridges`): where a road crosses water on its walkable deck strip: a plank deck a
 * hand above it, solid timber fascias from the deck down past the waterline (they hide the deck's earth bank), posts
 * into the bed and a post-and-rail on each side. A crossing inside the set-piece's extent is the set-piece's own.
 */
function* bridgeSteps(spec: ZoneSpec, plan: ZoneLayoutPlan, set: BiomeSet, partsAt: PartsAt): Steps<void> {
  const h = spec.heightfield;
  const wood = set.props.wood;
  for (const [n, br] of plan.bridges.entries()) {
    if (br.points.length < 2) continue;
    const [mx, mz] = br.points[Math.floor(br.points.length / 2)]!;
    if (inSetPiece(plan, mx, mz, 0)) continue;
    // the centreline run onto both banks by 1.2 m
    const pts: [number, number][] = br.points.map(([x, z]) => [x, z]);
    const ys: number[] = [...br.ys];
    for (const end of [0, 1]) {
      const p = end === 0 ? pts[0]! : pts[pts.length - 1]!; const q = end === 0 ? pts[1]! : pts[pts.length - 2]!;
      const l = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
      const e: [number, number] = [p[0] + ((p[0] - q[0]) / l) * 1.2, p[1] + ((p[1] - q[1]) / l) * 1.2];
      if (end === 0) { pts.unshift(e); ys.unshift(ys[0]!); } else { pts.push(e); ys.push(ys[ys.length - 1]!); }
    }
    let level = Math.min(...ys) - 0.8;
    for (const w of plan.water) if (mx >= w.x0 - 1 && mx <= w.x1 + 1 && mz >= w.z0 - 1 && mz <= w.z1 + 1) { level = w.level; break; }
    const bottom = level - 0.35;
    const half = br.width / 2;
    let acc = 0; let nextPost = 0; let k = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i]!; const [bx, bz] = pts[i + 1]!;
      const ya = ys[i]! + 0.07; const yb = ys[i + 1]! + 0.07;
      const dx = bx - ax; const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const ux = dx / len; const uz = dz / len; const sx = -uz; const sz = ux;
      const yaw = Math.atan2(-uz, ux);
      const cx = (ax + bx) / 2; const cz = (az + bz) / 2; const cy = (ya + yb) / 2;
      // planks
      const np = Math.max(1, Math.round(len / 0.34));
      for (let j = 0; j < np; j++, k++) {
        const t = (j + 0.5) / np;
        const px = ax + dx * t; const pz = az + dz * t; const py = ya + (yb - ya) * t;
        const tp = partsAt(px, pz, false);
        const jit = hash2(k, n, 11);
        box(tp[0], wood, px, py - 0.07, pz, 0.3, 0.07, br.width - jit * 0.12, yaw + (jit - 0.5) * 0.03, 0.012);
        if (k % 2 === 0) box(tp[1], wood, px, py - 0.07, pz, 0.68, 0.07, br.width, yaw, 0.012);
      }
      const tp = partsAt(cx, cz, false);
      box(tp[2], wood, cx, cy - 0.09, cz, len + 0.04, 0.09, br.width, yaw, 0.02);
      // fascias, both sides, from the deck down past the waterline
      for (const s2 of [-1, 1]) {
        const fx = cx + sx * s2 * (half + 0.06); const fz = cz + sz * s2 * (half + 0.06);
        const tf = partsAt(fx, fz, true);
        for (let t = 0; t < 3; t++) box(tf[t]!, wood, fx, bottom, fz, len + 0.06, Math.max(ya, yb) - bottom, 0.14, yaw, 0.02);
        const r0: V3 = [ax + sx * s2 * (half + 0.12), ya + 0.88, az + sz * s2 * (half + 0.12)];
        const r1: V3 = [bx + sx * s2 * (half + 0.12), yb + 0.88, bz + sz * s2 * (half + 0.12)];
        beam(tf[0], wood, r0, r1, 0.1, 0.07, 0.015, [sx * s2, 0, sz * s2]);
        beam(tf[1], wood, r0, r1, 0.1, 0.07, 0.015, [sx * s2, 0, sz * s2]);
      }
      // posts every 1.8 m along the run
      while (nextPost <= acc + len + 1e-6) {
        const t = (nextPost - acc) / len;
        const py = ya + (yb - ya) * t;
        for (const s2 of [-1, 1]) {
          const px = ax + dx * t + sx * s2 * (half + 0.12); const pz = az + dz * t + sz * s2 * (half + 0.12);
          const bed = Math.min(heightClamped(h, px, pz), bottom) - 0.3;
          const tpp = partsAt(px, pz, true);
          box(tpp[0], wood, px, bed, pz, 0.18, py + 0.95 - bed, 0.18, yaw, 0.03);
          box(tpp[1], wood, px, bed, pz, 0.18, py + 0.95 - bed, 0.18, yaw, 0.03);
        }
        nextPost += 1.8;
      }
      acc += len;
      yield 'bridge:segment';
    }
    yield 'bridge';
  }
}

/**
 * The sculpt's rock spires, tors and basalt columns (content `ZonePlan.crags`): the heightfield gives each its cliffed
 * cone (collision), and a faceted rock sized to it, seated on the lowest ground round its foot, gives it a face.
 */
function* cragSteps(spec: ZoneSpec, plan: ZoneLayoutPlan, set: BiomeSet, partsAt: PartsAt): Steps<void> {
  const h = spec.heightfield;
  for (const [k, c] of plan.crags.entries()) {
    let base = Infinity;
    for (let a = 0; a < 8; a++) base = Math.min(base, heightClamped(h, c.x + Math.cos((a * Math.PI) / 4) * (c.r + 0.4), c.z + Math.sin((a * Math.PI) / 4) * (c.r + 0.4)));
    const top = heightClamped(h, c.x, c.z);
    const rise = Math.max(0.6, top - base);
    const size = c.r * 1.12;
    const g = buildRock(set.rock, spec.seed + k * 977 + 0x6c, { size, squash: (rise * 1.05) / (1.1 * size), elongate: 1.15, cuts: [4, 6] });
    const tp = partsAt(c.x, c.z, true);
    const m = trs(c.x, base - 0.15, c.z, hash2(k, 7, spec.seed & 0xffff) * 6.28);
    for (let t = 0; t < 3; t++) addPropTier(tp[t]!, g, t as 0 | 1 | 2, m);
    disposeProp(g);
    yield 'crag';
  }
}

/**
 * The sculpt's dressed lifts (content `ZonePlan.structures`): a curtain wall of stone blocks with merlons along its
 * crest, a palisade of stakes along an earthwork, a round tower on its mound. The lift is the collision; where a road
 * has cut the crest down (a gate), the wall and the stakes stop.
 */
function* structureSteps(spec: ZoneSpec, plan: ZoneLayoutPlan, set: BiomeSet, partsAt: PartsAt): Steps<void> {
  const h = spec.heightfield;
  for (const [n, st] of plan.structures.entries()) {
    if (st.kind === 'tower') {
      const [x, z] = st.points[0]!;
      const r = st.width / 2;
      let base = Infinity;
      for (let a = 0; a < 8; a++) base = Math.min(base, heightClamped(h, x + Math.cos((a * Math.PI) / 4) * (r + 1.2), z + Math.sin((a * Math.PI) / 4) * (r + 1.2)));
      const top = heightClamped(h, x, z);
      const tp = partsAt(x, z, true);
      for (let t = 0; t < 3; t++) tower(tp[t]!, set.props.stone, set.props.stone, r * 0.98, top - base + 2.6, t === 0 ? 18 : 10, trs(x, base - 0.3, z));
      yield 'structure:tower';
      continue;
    }
    const half = st.width / 2;
    for (let i = 0; i + 1 < st.points.length; i++) {
      const a = st.points[i]!; const b = st.points[i + 1]!;
      const dx = b[0] - a[0]; const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const cx = (a[0] + b[0]) / 2; const cz = (a[1] + b[1]) / 2;
      if (Math.max(Math.abs(cx), Math.abs(cz)) > h.size / 2 - 0.5) continue;
      const nx = -dz / len; const nz = dx / len;
      const side = Math.min(heightClamped(h, cx + nx * (half + 2.5), cz + nz * (half + 2.5)), heightClamped(h, cx - nx * (half + 2.5), cz - nz * (half + 2.5)));
      const crest = heightClamped(h, cx, cz);
      if (crest < side + st.h * 0.55) continue;                // a gate: the road cut the crest down
      const yaw = Math.atan2(-dz, dx);
      const tp = partsAt(cx, cz, true);
      if (st.kind === 'wall') {
        for (let t = 0; t < 3; t++) box(tp[t]!, set.props.stone, cx, side - 0.4, cz, len + 0.04, crest + 0.55 - (side - 0.4), st.width + 1.0, yaw, t === 0 ? 0.05 : 0.02);
        if (i % 2 === 0) {
          for (const s2 of [-1, 1]) {
            const ox = nx * s2 * (half + 0.28); const oz = nz * s2 * (half + 0.28);
            box(tp[0], set.props.stone, cx + ox, crest + 0.55, cz + oz, Math.min(len, 0.9), 0.55, 0.42, yaw, 0.04);
            box(tp[1], set.props.stone, cx + ox, crest + 0.55, cz + oz, Math.min(len, 0.9), 0.55, 0.42, yaw, 0.02);
          }
        }
      } else {
        const k = Math.max(1, Math.round(len / 0.42));
        for (let j = 0; j < k; j++) {
          const t = (j + 0.5) / k;
          const px = a[0] + dx * t; const pz = a[1] + dz * t;
          const g = heightClamped(h, px, pz);
          const tall = 1.5 + hash2(i * 31 + j, n, 23) * 0.5;
          beam(tp[0], set.props.wood, [px, g - 0.4, pz], [px, g + tall, pz], 0.2, 0.2, 0.04);
          if (j % 2 === 0) beam(tp[1], set.props.wood, [px, g - 0.4, pz], [px, g + tall, pz], 0.22, 0.22, 0.03);
        }
      }
      if ((i & 7) === 7) yield 'structure:segment';
    }
    yield 'structure';
  }
}

/** A flush stone curb round the plaza (top 5 cm above the ground). */
function* plazaCurbSteps(h: HeightfieldData, plan: ZoneLayoutPlan, palette: Palette, set: BiomeSet, partsAt: PartsAt): Steps<void> {
  const P = plan.plaza!;
  const n = Math.round((Math.PI * 2 * P.r) / 0.62);
  void palette;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const x = P.x + Math.cos(a) * (P.r + 0.12); const z = P.z + Math.sin(a) * (P.r + 0.12);
    const y = heightClamped(h, x, z);
    const t = partsAt(x, z, false);
    box(t[0], set.props.stone, x, y - 0.2, z, 0.58, 0.25, 0.34, -a + Math.PI / 2, 0.03);
    if (k % 2 === 0) box(t[1], set.props.stone, x, y - 0.2, z, 1.2, 0.25, 0.34, -a + Math.PI / 2, 0.03);
    if ((k & 15) === 15) yield 'plaza:curb';
  }
  yield 'plaza:curb';
}

/**
 * The plaza's paving pattern: a band of large flags round the centre feature and round the rim, joined by eight
 * radial spokes (a compass rose), flags 2 cm proud of the cobbles with 4 cm chamfers.
 */
function* plazaPatternSteps(h: HeightfieldData, plan: ZoneLayoutPlan, set: BiomeSet, partsAt: PartsAt, seed: number): Steps<void> {
  const P = plan.plaza!;
  const stone = set.props.stone;
  const inner = plan.setPiece.x === P.x && plan.setPiece.z === P.z ? Math.max(plan.setPiece.hw, plan.setPiece.hd) + 0.2 : 2.5;
  const flag = (x: number, z: number, w: number, d: number, yaw: number, k: number): void => {
    const y = heightClamped(h, x, z);
    const t = partsAt(x, z, false);
    box(t[0], stone, x, y - 0.12, z, w * (0.92 + hash2(k, 1, seed) * 0.08), 0.145, d * (0.92 + hash2(k, 2, seed) * 0.08), yaw + (hash2(k, 3, seed) - 0.5) * 0.04, 0.04);
    if (k % 2 === 0) box(t[1], stone, x, y - 0.12, z, w * 2, 0.145, d, yaw, 0.03);
  };
  let k = 0;
  for (const [r0, r1] of [[inner, inner + 1.0], [P.r - 1.9, P.r - 0.9]] as const) {
    const r = (r0 + r1) / 2;
    const n = Math.round((Math.PI * 2 * r) / 0.9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      flag(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, (Math.PI * 2 * r) / n - 0.06, r1 - r0 - 0.06, -a + Math.PI / 2, k++);
      if ((i & 15) === 15) yield 'plaza:pattern';
    }
    yield 'plaza:pattern';
  }
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2 + Math.PI / 8;
    for (let r = inner + 1.45; r < P.r - 2.3; r += 0.95) flag(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 0.62, 0.88, -a, k++);
    yield 'plaza:pattern';
  }
}

/** Interior sub-areas at warp arrival markers: a roofless planked room (the camera looks in), low walls, furniture. */
function* warpRoomSteps(h: HeightfieldData, plan: ZoneLayoutPlan, set: BiomeSet, partsAt: PartsAt, pockets: readonly PocketRect[]): Steps<void> {
  for (const w of plan.warpPairs) {
    yield 'warp-room';
    if (!w.to) continue;
    const [x, z] = w.to;
    if (inPocket(pockets, x, z, 4)) continue;             // Phase A: the pocket's hall is the room
    const y = heightClamped(h, x, z);
    const t = partsAt(x, z);
    const b = set.building;
    for (const p of t) box(p, set.props.wood, x, y - 0.3, z, 8.4, 0.42, 6.4, 0, 0.04);
    for (const [dx, dz, ww, dd] of [[0, -3.1, 8.4, 0.3], [-4.1, 0, 0.3, 6.4], [4.1, 0, 0.3, 6.4]] as const) {
      for (const p of t) box(p, b.wall, x + dx, y + 0.1, z + dz, ww, 1.25, dd, 0, 0.04);
      box(t[0], b.frame ?? b.trim, x + dx, y + 1.33, z + dz, ww + 0.06, 0.12, dd + 0.08, 0, 0.02);
    }
    box(t[0], set.props.wood, x - 1.4, y + 0.12, z - 1.2, 1.6, 0.78, 0.9, 0.1, 0.03);
    lathe(t[0], set.props.wood, [[0.28, 0], [0.32, 0.4], [0.28, 0.8]], { segments: 10, capTop: true }, trs(x + 2.6, y + 0.12, z - 2.2));
    lathe(t[0], set.props.wood, [[0.28, 0], [0.32, 0.4], [0.28, 0.8]], { segments: 10, capTop: true }, trs(x + 3.2, y + 0.12, z - 1.7));
    card(t[0], set.props.leaf, x - 3.4, y + 0.1, z + 2.4, 0.8, 0.7, 0.3, -0.2);
  }
}

// ---- scatter ------------------------------------------------------------------------------------------------

interface ScatterOut { readonly kind: ScatterKind; readonly instances: Instance[]; readonly sources: readonly BufferGeometry[] }

function kindFrom(name: string, geo: PropGeo, material: (id: SurfaceId) => Material, views: BufferGeometry[], castShadow: boolean, tiers: number, impostor: BufferGeometry | null, shadowTierLimit = 2, tint: ScatterKind['tint'] = 'cards'): { kind: ScatterKind; sources: BufferGeometry[] } {
  const materials = geo.surfaces.map((s) => material(s));
  const src: (BufferGeometry | null)[] = [geo.lod0, tiers > 1 ? geo.lod1 : null, tiers > 2 ? geo.lod2 : null, impostor];
  const parts = src.map((g) => {
    if (!g) return null;
    const sp = splitByClass(g, materials);
    for (const v of sp.views) views.push(v);
    return sp.parts;
  });
  const sources: BufferGeometry[] = [geo.lod0, geo.lod1, geo.lod2];
  if (impostor && !sources.includes(impostor)) sources.push(impostor);
  return { kind: { name, tiers: [parts[0]!, parts[1]!, parts[2]!, parts[3]!], materials, castShadow, shadowTierLimit, tint }, sources };
}

/**
 * Phase E3 (audit M2-link-east-1): `ZoneSpec.neighbours` → the skirt's neighbour fields. The neighbour's `edge` point is
 * laid on this zone's `edges[dir]` point (world = neighbour-local + d) and its heights are offset so the two points
 * meet; its layout plan gives the road / plaza layers that continue into the skirt. Only sides that have both an edge
 * and a neighbour take part.
 */
export function neighbourFields(spec: Pick<ZoneSpec, 'edges' | 'heightfield' | 'neighbours'>): NeighbourField[] {
  const out: NeighbourField[] = [];
  for (const dir of ['n', 'e', 's', 'w'] as const) {
    const nb = spec.neighbours?.[dir];
    const edge = spec.edges[dir];
    if (nb === undefined || edge === undefined) continue;
    const dx = edge.x - nb.edge.x; const dz = edge.z - nb.edge.z;
    const dy = heightClamped(spec.heightfield, edge.x, edge.z) - heightClamped(nb.heightfield, nb.edge.x, nb.edge.z);
    const nbPlan = layoutOf({ layout: nb.layout, heightfield: nb.heightfield, plan: nb.plan });
    out.push({ dir, h: nb.heightfield, dx, dz, dy: Number.isFinite(dy) ? dy : 0, splat: createSplatContext(nbPlan, nb.buildings, nb.seed, nb.interiors) });
  }
  return out;
}

/**
 * Every scatter kind of the zone: trees (interior groves + the margin forest + a treeline on the skirt), willows by
 * water, two rock shapes (+ pebbles along roads), bushes (hedgerows on route boundaries), flower patches, ground
 * tufts, tall grass in the layout's patches, stumps and logs.
 */
/** Crown of one tree kind in its local frame: the leaf cards' bounding box as a sphere mostly inside the canopy. */
interface CrownShape { readonly cx: number; readonly cy: number; readonly cz: number; readonly r: number }
/** Fraction of the leaf box's half extent used as the crown radius (the camera may graze the outer leaves). */
const CROWN_FILL = 0.85;

function crownShape(geo: PropGeo, leaf: SurfaceId): CrownShape | null {
  const b = surfaceBounds(geo, (s) => s === leaf);
  if (b === null) return null;
  const half = Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]) / 2;
  return { cx: (b[0] + b[3]) / 2, cy: (b[1] + b[4]) / 2, cz: (b[2] + b[5]) / 2, r: half * CROWN_FILL };
}

/** Registers one crown per tree instance on the collider (H11: the battle / inspector camera avoids them). */
function addCrowns(collider: TerrainCollider, shape: CrownShape | null, instances: readonly Instance[]): void {
  if (shape === null) return;
  for (const it of instances) {
    const c = Math.cos(it.yaw); const sn = Math.sin(it.yaw);   // three's makeRotationY
    collider.addCrown({ x: it.x + (c * shape.cx + sn * shape.cz) * it.scale, y: it.y + shape.cy * it.scale, z: it.z + (-sn * shape.cx + c * shape.cz) * it.scale, r: shape.r * it.scale });
  }
}

function* scatterSteps(spec: ZoneSpec, plan: ZoneLayoutPlan, set: BiomeSet, dressing: DressingStyle, splat: SplatContext, collider: TerrainCollider, skirtY: (x: number, z: number) => number, mat: (id: SurfaceId) => Material, views: BufferGeometry[], seed: number, flower0: number, flowerN: number, foliageN: number, skirtClear: (x: number, z: number) => boolean = () => true): Steps<ScatterOut[]> {
  const out: ScatterOut[] = [];
  const h = spec.heightfield;
  const half = h.size / 2;
  const ih = half - 16;
  const reachTrees = 26;
  const f: SplatFields = { plaza: 0, path: 0, detail: 0 };
  const salt = seed & 0x7fffffff;
  const yAt = (x: number, z: number): number => (Math.max(Math.abs(x), Math.abs(z)) <= half ? collider.sampleClamped(x, z) : skirtY(x, z));
  const inPlay = (x: number, z: number): boolean => Math.abs(x) < ih && Math.abs(z) < ih;
  const clumpy = (x: number, z: number, s: number): number => fbm2(x * 0.045, z * 0.045, 3, salt + s);
  const foliageTint = (hh: number): number => Math.floor(hh * foliageN) % Math.max(1, foliageN);
  // Phase A: nothing centred inside a pocket's outer footprint (content drops exactly those scatter solids)
  const pockets = splat.pockets;
  const free = (x: number, z: number): boolean => pockets.length === 0 || !inPocket(pockets, x, z);
  // Phase E1 walk-through cover (dressing.ts): verge clusters along the roads, scree / shards on open ground, and (after
  // the rocks) clusters round the big rocks. Kept clear of everything the scatter keeps clear of, plus the hand-placed
  // props, the light posts, the Cut / Strength obstacles and the inside of the plaza curb.
  const bushLeaf = set.bushLeaf ?? dressing.bush;
  const obstacles = spec.obstacles ?? [];
  const coverClear = (x: number, z: number, r: number): boolean => {
    if (Math.max(Math.abs(x), Math.abs(z)) > half - 1.5) return false;
    if (!scatterClear(splat, x, z, r, false) || !free(x, z) || wetNear(h, x, z, r + 0.4)) return false;
    for (const pp of spec.props) if (Math.hypot(pp.x - x, pp.z - z) < r + (PROP_BLOCKER[pp.kind] ?? 0.3) + 0.5) return false;
    for (const l of spec.lights) if (Math.hypot(l.position[0] - x, l.position[2] - z) < r + 0.6) return false;
    for (const o of obstacles) if (Math.hypot(o.x - x, o.z - z) < r + 1.4) return false;
    return true;
  };
  const cover: CoverPoint[] = [
    ...vergeClusters(splat.roads, dressing, { bush: bushLeaf !== null, flower: set.flower !== null }, salt, coverClear),
    ...screeClusters(half - 1.5, dressing, salt, coverClear),
  ];
  const coverOf = (k: CoverPoint['kind']): CoverPoint[] => cover.filter((c) => c.kind === k);
  yield 'scatter:cover';
  const grassTint = (hh: number): number => flower0 + flowerN + (Math.floor(hh * 131) % 4);
  const bushTint = (hh: number): number => (dressing.bushTint === 'grass' ? grassTint(hh) : foliageTint(hh));

  // trees ---------------------------------------------------------------------------------------------------
  const treeKinds = set.trees.filter((t) => t.weight > 0);
  const wsum = treeKinds.reduce((a, t) => a + t.weight, 0);
  const treeGeos = treeKinds.map((t, k) => buildTree(t.bark, t.leaf, t.shape, (spec.seed ^ 0x7ee5) + k * 977));
  yield 'scatter:tree-geometry';
  const treeInst: Instance[][] = treeKinds.map(() => []);
  const interiorDensity = spec.layout === 'route' ? set.density.treeInterior : spec.layout === 'town' ? 0.009 : 0.012;
  const pickTree = (hh: number): number => {
    let acc = 0;
    for (let k = 0; k < treeKinds.length; k++) { acc += treeKinds[k]!.weight / wsum; if (hh < acc) return k; }
    return treeKinds.length - 1;
  };
  const treeAccept = (x: number, z: number): number => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d > half + reachTrees) return 0;
    if (d > half) return skirtClear(x, z) ? 0.9 * Math.max(0.2, 1 - (d - half) / reachTrees) : 0;   // treeline on the skirt (E3: off a neighbour's road)
    if (!inPlay(x, z)) {
      if (roadDistance(splat.roads, x, z) < 3.5 || wetNear(h, x, z, 2.0)) return 0;
      return 1;                                                                   // the margin forest
    }
    if (!scatterClear(splat, x, z, 1.4, false) || wetNear(h, x, z, 2.0)) return 0;
    if (roadDistance(splat.roads, x, z) < 3.2) return 0;
    if (slopeAt(h, x, z) > SCATTER_MAX_SLOPE) return 0;
    for (const c of plan.clearings) if (Math.hypot(c.x - x, c.z - z) < c.r) return 0;
    if (spec.layout === 'route') {
      if (plan.corridor(x, z) < 9) return 0.08;
      const n = clumpy(x, z, 11);
      return n > 0.05 ? 1 : 0.18;
    }
    return 1;
  };
  const marginDensity = Math.max(set.density.treeMargin, spec.layout === 'route' ? set.density.treeInterior : set.density.treeMargin);
  for (const p of yield* jitteredPointSteps(-half - reachTrees, half + reachTrees, -half - reachTrees, half + reachTrees, marginDensity, salt + 101, (x, z, hh) => {
    const a = treeAccept(x, z);
    if (a <= 0) return 0;
    if (inPlay(x, z)) return a * (interiorDensity / marginDensity);
    return a * (hh < 2 ? 1 : 1);
  })) {
    if (!free(p.x, p.z)) continue;
    const k = pickTree(p.h);
    const s = 0.85 + hash2(Math.round(p.x * 8), Math.round(p.z * 8), salt + 3) * 0.35;
    treeInst[k]!.push({ x: p.x, y: yAt(p.x, p.z) - 0.12, z: p.z, yaw: p.h * 97.3, scale: s, tint: foliageTint(p.h * 3.7 % 1) });
    if (inPlay(p.x, p.z)) collider.addFootprint({ kind: 'circle', x: p.x, z: p.z, r: 0.42 * s + MOVER_R });
  }
  yield 'scatter:trees';
  // willows ring the ponds
  const willow = set.trees.find((t) => t.nearWater);
  if (willow && plan.water.length > 0) {
    const wInst: Instance[] = [];
    for (const body of plan.water) {
      const n = Math.max(2, Math.round(body.r * 0.6));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + hash2(k, body.id, salt + 41) * 0.8;
        if (body.boardwalk && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.6) continue;
        const rr = body.r * 1.25 + 2.2 + hash2(k, body.id, salt + 42) * 2.5;
        const x = body.cx + Math.cos(a) * rr; const z = body.cz + Math.sin(a) * rr;
        if (!scatterClear(splat, x, z, 1.2, true) || wetNear(h, x, z, 1.8) || roadDistance(splat.roads, x, z) < 2.5) continue;
        if (slopeAt(h, x, z) > SCATTER_MAX_SLOPE) continue;
        if (!free(x, z)) continue;
        wInst.push({ x, y: yAt(x, z) - 0.12, z, yaw: a * 3.1, scale: 0.9 + hash2(k, body.id, salt + 43) * 0.25, tint: 0 });
        if (inPlay(x, z)) collider.addFootprint({ kind: 'circle', x, z, r: 0.5 + MOVER_R });
      }
    }
    if (wInst.length > 0) {
      const g = buildTree(willow.bark, willow.leaf, willow.shape, spec.seed ^ 0x3111);
      addCrowns(collider, crownShape(g, willow.leaf), wInst);
      out.push({ ...kindFrom('tree_willow', g, mat, views, true, 3, impostorFor(g, willow.leaf)), instances: wInst });
    }
  }
  for (let k = 0; k < treeKinds.length; k++) {
    const t = treeKinds[k]!;
    if (treeInst[k]!.length === 0) continue;
    addCrowns(collider, crownShape(treeGeos[k]!, t.leaf), treeInst[k]!);
    out.push({ ...kindFrom(t.kind, treeGeos[k]!, mat, views, true, 3, impostorFor(treeGeos[k]!, t.leaf)), instances: treeInst[k]! });
    yield 'scatter:tree-kind';
  }

  // rocks + pebbles ------------------------------------------------------------------------------------------
  const rockA = buildRock(set.rock, spec.seed ^ 0x40c1, { size: 1.05, squash: 0.62, elongate: 1.3, cuts: [3, 5] });
  const rockB = buildRock(set.rock, spec.seed ^ 0x40c2, { size: 0.6, squash: 0.55, elongate: 1.4, cuts: [3, 5] });
  const aInst: Instance[] = []; const bInst: Instance[] = [];
  for (const p of yield* jitteredPointSteps(-half - 20, half + 20, -half - 20, half + 20, set.density.rock * 1.6, salt + 201, (x, z) => {
    if (Math.max(Math.abs(x), Math.abs(z)) > half + 20) return 0;
    if (inPlay(x, z)) return scatterClear(splat, x, z, 1.2, false) && !wetNear(h, x, z, 1.8) && roadDistance(splat.roads, x, z) > 1.5 && slopeAt(h, x, z) <= SCATTER_MAX_SLOPE ? 0.6 : 0;
    if (wetNear(h, x, z, 1.5)) return 0;
    return Math.max(Math.abs(x), Math.abs(z)) <= half || skirtClear(x, z) ? 1 : 0;
  })) {
    if (!free(p.x, p.z)) continue;
    const big = p.h < 0.45;
    const s = big ? 0.7 + p.h * 1.5 : 0.6 + p.h * 0.8;
    (big ? aInst : bInst).push({ x: p.x, y: yAt(p.x, p.z) - 0.05, z: p.z, yaw: p.h * 131, scale: s, tint: 0 });
    if (big && inPlay(p.x, p.z) && s > 0.8) collider.addFootprint({ kind: 'circle', x: p.x, z: p.z, r: 0.75 * s + MOVER_R * 0.6 });
  }
  // pebbles along road edges
  for (const r of splat.roads) {
    if (r.kind === 'path') continue;
    for (let i = 0; i + 1 < r.points.length; i++) {
      const a = r.points[i]!; const b = r.points[i + 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.floor(len * 0.35);
      for (let k = 0; k < n; k++) {
        const hk = hash2(i * 131 + k, r.points.length, salt + 301);
        const t = (k + hash2(i, k, salt + 302)) / Math.max(1, n);
        const side = hk < 0.5 ? -1 : 1;
        const px = -(b[1] - a[1]) / len; const pz = (b[0] - a[0]) / len;
        const off = r.width / 2 + 0.1 + hash2(k, i, salt + 303) * 0.5;
        const x = a[0] + (b[0] - a[0]) * t + px * side * off; const z = a[1] + (b[1] - a[1]) * t + pz * side * off;
        if (Math.max(Math.abs(x), Math.abs(z)) > half - 1) continue;
        if (!free(x, z)) continue;
        if (plan.plaza && Math.hypot(x - plan.plaza.x, z - plan.plaza.z) < plan.plaza.r + 0.6) continue;
        let blocked = false;
        for (const bb of spec.buildings) if (footprintDistance(bb, x, z) < 0.6) { blocked = true; break; }
        if (blocked) continue;
        bInst.push({ x, y: yAt(x, z) - 0.02, z, yaw: hk * 77, scale: 0.16 + hash2(k, i, salt + 304) * 0.2, tint: 0 });
      }
    }
  }
  cover.push(...rockClusters(aInst.filter((r) => r.scale > 0.8), dressing, set.tuft !== null, salt, coverClear));
  for (const c of coverOf('stone')) bInst.push({ x: c.x, y: yAt(c.x, c.z) - 0.04, z: c.z, yaw: c.h * 113, scale: c.scale, tint: 0 });
  if (aInst.length) out.push({ ...kindFrom('rock_a', rockA, mat, views, true, 3, rockA.lod2, 2), instances: aInst });
  // cliff faces (the sculpt's scarps, ravine walls, crater rims): faceted boulders bedded into every steep slope so a
  // cliff reads as rock from the play camera, not as stretched ground. Walk-through: they stand on unwalkable samples.
  {
    const cliffRock = buildRock(set.rock, spec.seed ^ 0xc11f, { size: 0.95, squash: 0.85, elongate: 1.35, cuts: [3, 5] });
    const cInst: Instance[] = [];
    for (const p of yield* jitteredPointSteps(-half + 0.5, half - 0.5, -half + 0.5, half - 0.5, 0.55, salt + 251, (x, z) => {
      const sl = slopeAt(h, x, z);
      if (sl < CLIFF_ROCK_SLOPE) return 0;
      if (plan.plaza && Math.hypot(x - plan.plaza.x, z - plan.plaza.z) < plan.plaza.r + 1) return 0;
      if (roadDistance(splat.roads, x, z) < 0.6) return 0;
      return sl > CLIFF_ROCK_SLOPE * 1.5 ? 0.9 : 0.55;
    })) {
      if (!free(p.x, p.z)) continue;
      cInst.push({ x: p.x, y: yAt(p.x, p.z) - 0.35, z: p.z, yaw: p.h * 151, scale: 0.75 + p.h * 0.9, tint: 0 });
    }
    if (cInst.length) out.push({ ...kindFrom('cliff_rock', cliffRock, mat, views, true, 3, cliffRock.lod2, 2), instances: cInst });
  }
  if (bInst.length) out.push({ ...kindFrom('rock_b', rockB, mat, views, false, 3, null, 0), instances: bInst });
  yield 'scatter:rocks';

  // bushes (+ hedgerows along route / story boundaries) -----------------------------------------------------
  if (bushLeaf) {
    const bush = buildBush(bushLeaf, spec.seed ^ 0xb005);
    const inst: Instance[] = [];
    const bushDensity = set.density.bush > 0 ? set.density.bush : dressing.bushDensity;
    for (const p of yield* jitteredPointSteps(-half - 6, half + 6, -half - 6, half + 6, bushDensity * 1.4, salt + 401, (x, z) => {
      const d = Math.max(Math.abs(x), Math.abs(z));
      if (d > half + 6) return 0;
      if (d > ih && d < ih + 3.5) return roadDistance(splat.roads, x, z) < 3 ? 0 : spec.layout === 'town' ? 0.9 : 1;   // the hedge line
      if (wetNear(h, x, z, 1.2)) return 0;
      if (!inPlay(x, z)) return 0.5;
      if (!scatterClear(splat, x, z, 0.9, false)) return 0;
      splatAt(splat, x, z, f);
      if (f.path > -0.6) return 0;
      const nearHouse = spec.buildings.some((b) => { const fd = footprintDistance(b, x, z); return fd > 1.0 && fd < 2.6; });
      return nearHouse ? 0.5 : clumpy(x, z, 21) > 0.1 ? 0.55 : 0.12;
    })) {
      if (!free(p.x, p.z)) continue;
      inst.push({ x: p.x, y: yAt(p.x, p.z) - 0.05, z: p.z, yaw: p.h * 53, scale: 0.8 + p.h * 0.55, tint: bushTint(p.h) });
    }
    for (const c of coverOf('bush')) inst.push({ x: c.x, y: yAt(c.x, c.z) - 0.05, z: c.z, yaw: c.h * 53, scale: c.scale, tint: bushTint(c.h) });
    if (inst.length) out.push({ ...kindFrom('bush', bush, mat, views, true, 3, null, 2), instances: inst });
    yield 'scatter:bushes';
  }

  // flowers -------------------------------------------------------------------------------------------------
  if (set.flower) {
    const fl = buildFlowers(set.flower, spec.seed ^ 0xf10e);
    const inst: Instance[] = [];
    for (const p of yield* jitteredPointSteps(-ih, ih, -ih, ih, set.density.flower * 3, salt + 501, (x, z) => {
      if (!scatterClear(splat, x, z, 0.7, false) || wetNear(h, x, z, 1.0)) return 0;
      splatAt(splat, x, z, f);
      if (f.path > -0.3 || f.detail > 0.1) return 0;
      const nearHouse = spec.buildings.some((b) => { const fd = footprintDistance(b, x, z); return fd > 0.6 && fd < 2.2; });
      if (nearHouse) return 0.9;
      return clumpy(x, z, 31) > 0.18 ? 0.55 : 0.05;
    })) {
      if (!free(p.x, p.z)) continue;
      inst.push({ x: p.x, y: yAt(p.x, p.z), z: p.z, yaw: p.h * 71, scale: 0.8 + p.h * 0.5, tint: flower0 + (Math.floor(p.h * 997) % flowerN) });
    }
    for (const c of coverOf('flower')) inst.push({ x: c.x, y: yAt(c.x, c.z), z: c.z, yaw: c.h * 71, scale: c.scale, tint: flower0 + (Math.floor(c.h * 997) % flowerN) });
    if (inst.length) out.push({ ...kindFrom('flower_patch', fl, mat, views, false, 2, null, 0, 'all'), instances: inst });
    yield 'scatter:flowers';
  }

  // ground tufts (short grass on the ground layer) -----------------------------------------------------------
  if (set.tuft) {
    const tuft = buildGroundTuft(set.tuft, spec.seed ^ 0x70f7);
    const inst: Instance[] = [];
    for (const p of yield* jitteredPointSteps(-half + 1, half - 1, -half + 1, half - 1, set.density.tuft, salt + 601, (x, z) => {
      if (plan.plaza && Math.hypot(x - plan.plaza.x, z - plan.plaza.z) < plan.plaza.r + 0.4) return 0;
      splatAt(splat, x, z, f);
      if (f.path > -0.15 || f.plaza > -0.2) return 0;
      if (f.detail > 0.35) return 0;
      for (const w of plan.water) if (Math.hypot(w.cx - x, w.cz - z) < w.r * 1.05) return 0;
      if (wetNear(h, x, z, 0.6)) return 0;
      for (const b of spec.buildings) if (footprintDistance(b, x, z) < 0.4) return 0;
      const edge = roadDistance(splat.roads, x, z);
      if (edge > 0.1 && edge < 1.4) return 0.85;                                 // grass fringes the paths
      if (f.detail > -0.25) return 0.55;
      return clumpy(x, z, 41) > 0.12 ? 0.8 : 0.12;
    })) {
      if (!free(p.x, p.z)) continue;
      inst.push({ x: p.x, y: yAt(p.x, p.z), z: p.z, yaw: p.h * 89, scale: 0.75 + p.h * 0.6, tint: grassTint(p.h) });
    }
    for (const c of coverOf('tuft')) inst.push({ x: c.x, y: yAt(c.x, c.z), z: c.z, yaw: c.h * 89, scale: c.scale, tint: grassTint(c.h) });
    if (inst.length) out.push({ ...kindFrom('grass_tuft', tuft, mat, views, false, 3, null, 0), instances: inst });
    yield 'scatter:tufts';
  }

  // tall grass in the layout's patches (2.2 / m²) ------------------------------------------------------------
  if (set.tallGrass && spec.tallGrass && plan.grassPatches.length > 0) {
    const tg = buildTallGrass(set.tallGrass, spec.seed ^ 0x7a11);
    const geo: PropGeo = { ...tg, surfaces: [set.tallGrass], groups: [] };
    const inst: Instance[] = [];
    for (const e of plan.grassPatches) {
      const R = Math.max(e.rx, e.rz) + 1;
      for (const p of jitteredPoints(e.x - R, e.x + R, e.z - R, e.z + R, set.density.tallGrass, salt + 701 + Math.round(e.x), (x, z) => {
        if (!inEllipse(e, x, z)) return inEllipse(e, x, z, 0.9) ? 0.35 : 0;
        const dx = x - e.x; const dz = z - e.z;
        const edge = Math.hypot(dx / e.rx, dz / e.rz);
        return edge > 0.85 + valueNoise(x, z, salt) * 0.1 ? 0.6 : 1;
      })) {
        if (!free(p.x, p.z)) continue;
        inst.push({ x: p.x, y: yAt(p.x, p.z) - 0.03, z: p.z, yaw: p.h * 61, scale: 0.85 + p.h * 0.5, tint: foliageTint(p.h) });
      }
      yield 'scatter:tall-grass';
    }
    if (inst.length) out.push({ ...kindFrom('tall_grass', geo, mat, views, false, 2, null, 0), instances: inst });
  }

  // stumps + logs in the margins and route woods ---------------------------------------------------------------
  const stump = buildStump(set.trees[0]?.bark ?? set.props.wood, set.props.wood, spec.seed ^ 0x5709);
  const log = buildLog(set.trees[0]?.bark ?? set.props.wood, set.props.wood, spec.seed ^ 0x1066);
  const sInst: Instance[] = []; const lInst: Instance[] = [];
  for (const p of jitteredPoints(-half, half, -half, half, 0.0016, salt + 801, (x, z) => {
    if (wetNear(h, x, z, 1.5)) return 0;
    if (inPlay(x, z)) return spec.layout === 'town' ? 0 : scatterClear(splat, x, z, 1.5, false) && roadDistance(splat.roads, x, z) > 3 ? 0.5 : 0;
    return 1;
  })) {
    if (!free(p.x, p.z)) continue;
    (p.h < 0.55 ? sInst : lInst).push({ x: p.x, y: yAt(p.x, p.z) - 0.05, z: p.z, yaw: p.h * 41, scale: 0.9 + p.h * 0.4, tint: 0 });
  }
  if (sInst.length) out.push({ ...kindFrom('stump', stump, mat, views, false, 3, null, 0), instances: sInst });
  if (lInst.length) out.push({ ...kindFrom('log', log, mat, views, false, 3, null, 0), instances: lInst });
  yield 'scatter:stumps';

  // crystal shards (Phase E1: shrine / rift / marrow open ground; the set's own crystal surface)
  const shards = coverOf('shard');
  if (shards.length > 0) {
    const g = buildShard(set.props.crystal, spec.seed ^ 0x5a4d);
    const inst = shards.map((c) => ({ x: c.x, y: yAt(c.x, c.z) - 0.03, z: c.z, yaw: c.h * 97, scale: c.scale, tint: 0 }));
    out.push({ ...kindFrom('crystal_shard', g, mat, views, false, 3, null, 0), instances: inst });
  }

  return out;
}

/** Impostor tier (> 160 m) of a tree: two crossed canopy cards spanning its bounding box. */
function impostorFor(g: PropGeo, leaf: SurfaceId): BufferGeometry {
  g.lod0.computeBoundingBox();
  const bb = g.lod0.boundingBox!;
  const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
  const parts = buildImpostorCards(leaf, w * 0.9, bb.max.y, Math.max(0.4, bb.max.y * 0.18));
  const geo = parts.build().geometry;
  const li = g.surfaces.indexOf(leaf);
  for (const gr of geo.groups) gr.materialIndex = li < 0 ? 0 : li;        // index into the kind's material array
  return geo;
}

