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
import type { BufferGeometry, Material, Object3D , InstancedMesh, Vector3 } from 'three/webgpu';
import type { BuildingSpec, HeightfieldData, ZoneHandle, ZoneSpec } from '../contracts.js';
import type { LightSource, RenderStats } from '../descriptors.js';
import type { MaterialLibrary } from '../materials/library.js';
import type { SurfaceId } from '../materials/surfaces.js';
import type { PunctualHandle } from '../lighting/rig.js';
import { createRenderStats } from '../stats.js';
import { TerrainCollider } from '../terrain/collider.js';
import { heightClamped } from '../terrain/field.js';
import { buildSkirt, buildTerrainChunks, skirtHeightFn, type SkirtOpts, type TerrainLayers } from '../terrain/mesh.js';
import type { Parts} from './geo.js';
import { Digest, box, beam, card, lathe, releaseShapeCache, trs } from './geo.js';
import { BIOME_GENERATORS, PROP_BLOCKER, SET_PIECE_BUILDERS, buildHousing, buildPropKind } from './generators/index.js';
import { addPropTier, disposeProp, finish, tiers3 } from './generators/common.js';
import { buildHouse } from './generators/buildings.js';
import { buildBush, buildFlowers, buildGroundTuft, buildImpostorCards, buildLog, buildRock, buildStump, buildTallGrass, buildTree } from './generators/nature.js';
import { buildPondBank } from './generators/props.js';
import { setSurfaces, type BiomeSet } from './generators/set.js';
import {
  FIELD_SIZE, HOUSING_LOCAL, createSplatContext, footprintDistance, inEllipse, planLayout, roadDistance, scatterClear, splatAt, toWorld,
  type SplatContext, type SplatFields, type ZoneLayoutPlan,
} from './layout.js';
import { BUILDING_LOD_LEVELS, CHUNK_SIZE, chunkGrid, type ChunkGrid } from './lod.js';
import { paletteFor } from './palettes.js';
import { createPrng, fbm2, hash2, valueNoise } from './prng.js';
import { ChunkSet, ScatterField, jitteredPoints, type ChunkRec, type Instance, type ScatterKind } from './scatter.js';
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
}

/** What the zone system needs beyond the verbatim `ZoneHandle`. */
export interface ZoneHandleImpl extends ZoneHandle {
  readonly collider: TerrainCollider;
  readonly palette: Palette;
  readonly surfaces: readonly SurfaceId[];
  readonly disposed: boolean;
  /** Geometries the builder created, in build order (§10.5.9). */
  readonly geometries: readonly BufferGeometry[];
  readonly instanced: readonly InstancedMesh[];
  readonly info: { readonly triangles: number; readonly chunks: number; readonly instances: number; readonly buildMs: number | null };
  /** Per-frame LOD pick against the main camera. Zero allocation. Returns chunks at the impostor tier. */
  updateLod(camera: Vector3, cameraObject: Object3D): number;
}

const MOVER_R = 0.35;

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

interface Built { readonly root: Group; readonly geometries: BufferGeometry[]; readonly instanced: InstancedMesh[]; triangles: number }

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

// ---- the build ----------------------------------------------------------------------------------------------

/** The surfaces a zone binds (for preload / eviction). */
export function zoneSurfaces(spec: ZoneSpec): SurfaceId[] {
  const set = BIOME_GENERATORS[spec.generators] ?? BIOME_GENERATORS.grove;
  const pal = paletteFor(spec.palette, spec.biome);
  const out = new Set<SurfaceId>([...setSurfaces(set), ...pal.terrainLayers, pal.plaza]);
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
  const handle = buildZone(spec, deps, surfaces);
  const buildMs = t0 !== null && clock ? clock() - t0 : null;
  (handle.info as { buildMs: number | null }).buildMs = buildMs;
  void deps.materials.preloadHero(surfaces);
  return handle;
}

/** Synchronous build (surfaces must be resolvable through `deps.materials.get`). */
export function buildZone(spec: ZoneSpec, deps: ZoneBuildDeps, surfaces: readonly SurfaceId[] = zoneSurfaces(spec)): ZoneHandleImpl {
  const set: BiomeSet = BIOME_GENERATORS[spec.generators] ?? BIOME_GENERATORS.grove;
  const palette = paletteFor(spec.palette, spec.biome);
  const mat = (id: SurfaceId): Material => deps.materials.get(id);
  const h = spec.heightfield;
  const collider = new TerrainCollider(h);
  const prng = createPrng(spec.seed);
  prng.fork('layout');                                   // consumed by planLayout's own fork; kept for the fixed label order
  const scatterRng = prng.fork('scatter');
  const propsRng = prng.fork('props');
  prng.fork('lights');
  const plan = planLayout(spec);
  const splat = createSplatContext(plan, spec.buildings, spec.seed);
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
  for (const c of buildTerrainChunks(h, grid, splat, layers, mat)) {
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
  const skirtOpts: SkirtOpts = { reach: 60, rise: spec.layout === 'route' ? 11 : 14, salt: spec.seed & 0xffff, exits };
  const skirtY = skirtHeightFn(h, skirtOpts);
  for (const c of buildSkirt(h, skirtOpts, layers, mat)) { root.add(c.mesh); record(c.geometry); built.triangles += c.triangles; }

  // 3. water
  const waterSurface: SurfaceId = set.props.water ?? 'water_pond';
  for (const body of plan.water) {
    const w = buildWaterMesh(h, body, waterSurface, mat(waterSurface));
    if (w) { root.add(w); record(w.geometry); }
  }

  // 4. buildings (THREE.LOD each)
  for (const b of spec.buildings) {
    const fh = footprintHeights(h, b);
    const geo = buildHouse(set.building, b, { drop: fh.max - fh.min, accent: b.kind === 'gym' ? set.accent : null });
    const lod = new LOD();
    lod.name = `ewa:building:${b.id}`;
    lod.autoUpdate = false;
    for (let t = 0; t < 3; t++) {
      const m = objectFromGeo(geo, t as 0 | 1 | 2, mat, `${lod.name}:lod${t}`, views, t < 2);
      lod.addLevel(m, BUILDING_LOD_LEVELS[t]!.distance, BUILDING_LOD_LEVELS[t]!.hysteresis);
    }
    lod.position.set(b.x, fh.max, b.z);
    lod.rotation.y = b.yaw;
    root.add(lod); lods.push(lod); lodChunks.push(chunks.at(b.x, b.z));
    record(geo.lod0); record(geo.lod1); record(geo.lod2);
    collider.addBlocker({ kind: 'rect', x: b.x, z: b.z, hw: b.w / 2 + 0.12 + MOVER_R, hd: b.d / 2 + 0.12 + MOVER_R, yaw: b.yaw });
  }

  // 5. set-piece
  {
    const sp = plan.setPiece;
    const y0 = heightClamped(h, sp.x, sp.z);
    const builder = SET_PIECE_BUILDERS[sp.id];
    if (builder) {
      const ground = (lx: number, lz: number): number => { const [wx, wz] = toWorld(sp, lx, lz); return heightClamped(h, wx, wz) - y0; };
      const geo = builder({ set, seed: spec.seed ^ 0x5e7, ground });
      const lod = new LOD();
      lod.name = `ewa:setpiece:${sp.id}`;
      lod.autoUpdate = false;
      for (let t = 0; t < 3; t++) {
        const m = objectFromGeo(geo, t as 0 | 1 | 2, mat, `${lod.name}:lod${t}`, views, t < 2);
        lod.addLevel(m, BUILDING_LOD_LEVELS[t]!.distance, BUILDING_LOD_LEVELS[t]!.hysteresis);
      }
      lod.position.set(sp.x, y0, sp.z);
      lod.rotation.y = sp.yaw;
      root.add(lod); lods.push(lod); lodChunks.push(chunks.at(sp.x, sp.z));
      record(geo.lod0); record(geo.lod1); record(geo.lod2);
      if (sp.id === 'grove_heart_tree') collider.addBlocker({ kind: 'circle', x: sp.x, z: sp.z, r: 4.45 + MOVER_R });
      else if (SOLID_SET_PIECES.has(sp.id)) collider.addBlocker({ kind: 'rect', x: sp.x, z: sp.z, hw: sp.hw * 0.6, hd: sp.hd * 0.6, yaw: sp.yaw });
    }
  }

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
  for (const pp of spec.props) {
    const geo = buildPropKind(set, pp.kind, pp.seed);
    if (!geo) continue;
    const y = heightClamped(h, pp.x, pp.z);
    placeProp(geo, pp.x, y - (pp.kind.startsWith('tree') ? 0.1 : 0), pp.z, pp.yaw, pp.scale > 0 ? pp.scale : 1, !NON_CASTING_PROPS.has(pp.kind));
    disposeProp(geo);
    const r = PROP_BLOCKER[pp.kind] ?? 0;
    if (pp.kind === 'garden') collider.addBlocker({ kind: 'rect', x: pp.x, z: pp.z, hw: 2.7 + MOVER_R, hd: 1.8 + MOVER_R, yaw: pp.yaw });
    else if (pp.kind === 'bench') collider.addBlocker({ kind: 'rect', x: pp.x, z: pp.z, hw: 1.0 + MOVER_R, hd: 0.25 + MOVER_R, yaw: pp.yaw });
    else if (r > 0) collider.addBlocker({ kind: 'circle', x: pp.x, z: pp.z, r: r + MOVER_R });
  }
  // light housings (generated)
  for (const l of spec.lights) {
    if (l.housing.kind !== 'generated') continue;
    const gen = l.housing.generator;
    const geo = buildHousing(set, gen, l.housing.seed);
    const [x, y, z] = l.position;
    const base = y - HOUSING_LOCAL[gen][1];
    const g = heightClamped(h, x, z);
    const castHousing = gen === 'beacon' || gen === 'brazier';
    placeProp(geo, x, base, z, 0, 1, castHousing);
    disposeProp(geo);
    if (base > g + 0.02) { const t = partsAt(x, z, castHousing); for (const p of t) box(p, set.props.stone, x, g - 0.2, z, 0.5, base - g + 0.22, 0.5, 0, 0.04); }
    collider.addBlocker({ kind: 'circle', x, z, r: (gen === 'beacon' ? 0.45 : 0.22) + MOVER_R });
  }
  dressBoundary(spec, plan, set, splat, partsAt, propsRng.next.bind(propsRng));
  dressWater(spec, plan, set, partsAt);
  if (plan.plaza) { plazaCurb(h, plan, palette, set, partsAt); plazaPattern(h, plan, set, partsAt, spec.seed); }
  warpRooms(h, plan, set, partsAt);
  releaseShapeCache();
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
  }

  // 7. scatter
  const tints = [...palette.scatterTints, ...FLOWER_TINTS, ...GRASS_TINTS].map((hex) => new Color(hex));
  const flowerTint0 = palette.scatterTints.length;
  const scatterKinds = buildScatter(spec, plan, set, splat, collider, skirtY, mat, views, (scatterRng.next() * 4294967296) >>> 0, flowerTint0, FLOWER_TINTS.length, palette.scatterTints.length);
  for (const sk of scatterKinds) {
    const field = new ScatterField(sk.kind, sk.instances, chunks, root, tints);
    fields.push(field);
    for (const m of field.meshes) built.instanced.push(m);
    for (const g of sk.sources) record(g);
  }
  chunks.initVisibility();
  for (const f of fields) f.sync(chunks);

  // 8. lights
  let punctuals: PunctualHandle[] = [];
  if (deps.lighting) punctuals = deps.lighting.createPunctuals(spec.lights, root);

  // digest: every builder geometry's position bytes in build order, then the instance matrices
  const digest = new Digest();
  for (const g of built.geometries) digest.add(g.getAttribute('position').array as Float32Array);
  let instances = 0;
  for (const f of fields) { digest.add(f.instanceData()); instances += f.total; }

  if (deps.scene) deps.scene.add(root);

  let disposed = false;
  const geometries = built.geometries;
  const handle: ZoneHandleImpl = {
    id: spec.id,
    group: root,
    collider,
    bounds: collider.bounds,
    geometryDigest: digest.hex(),
    palette,
    surfaces,
    get disposed() { return disposed; },
    geometries,
    instanced: built.instanced,
    info: { triangles: built.triangles, chunks: chunks.records().length, instances, buildMs: null },
    stats: () => (deps.stats ? deps.stats() : createRenderStats()),
    updateLod(camera: Vector3, cameraObject: Object3D): number {
      if (disposed) return 0;
      const far = chunks.update(camera, (cameraObject as Object3D & { isCamera?: boolean }).isCamera ? cameraObject as never : null);
      for (let i = 0; i < fields.length; i++) fields[i]!.sync(chunks);
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
      root.removeFromParent();
      for (let i = views.length - 1; i >= 0; i--) views[i]!.dispose();
      for (let i = geometries.length - 1; i >= 0; i--) geometries[i]!.dispose();
      for (let i = built.instanced.length - 1; i >= 0; i--) built.instanced[i]!.dispose();
      // plain meshes have no dispose(): dispatch the event their render objects listen to, so three releases the
      // render objects (and the programs they hold) now instead of never (library materials are never disposed)
      root.traverse((o) => { if ((o as Mesh).isMesh && !(o as InstancedMesh).isInstancedMesh) o.dispatchEvent({ type: 'dispose' } as never); });
      if (deps.lighting && punctuals.length > 0) deps.lighting.releasePunctuals(punctuals);
      punctuals = [];
      deps.materials.evictExcept(deps.nextKeep ? deps.nextKeep() : []);
      (handle as { collider: TerrainCollider | null }).collider = null;
      root.clear();
    },
  };
  return handle;
}

/** Set-pieces the movement solver treats as solid (towers, huts, gates…); the rest are walkable or open. */
const SOLID_SET_PIECES = new Set<string>(['cinder_caldera', 'salt_lighthouse', 'storm_coil_tower', 'marrow_mineshaft', 'vesper_witch_hut', 'siege_trebuchet', 'sky_shrine', 'solenne_cathedral', 'eclipse_engine', 'umbral_dome', 'celestial_spire', 'rift_maw', 'tide_wreck']);

const FLOWER_TINTS = ['#ffb3c8', '#ffe07a', '#fff6ea', '#c6adff', '#ffbd7a', '#ff9aa8'];
/** Ground-clump tints (darker, yellower than the card so clumps sit in the lawn instead of on it). */
const GRASS_TINTS = ['#c9d49c', '#b9c78c', '#d6d9a2', '#c2cf95'];

// ---- boundary / water / plaza / warp dressing ---------------------------------------------------------------

type PartsAt = (x: number, z: number, cast?: boolean) => [Parts, Parts, Parts];

/** Hand-placed kinds too small / low for a shadow draw per cascade. */
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

/** Dry-stone walls (grove towns) / fences along the playable boundary with gaps at the exits. */
function dressBoundary(spec: ZoneSpec, plan: ZoneLayoutPlan, set: BiomeSet, splat: SplatContext, partsAt: PartsAt, rnd: () => number): void {
  if (spec.layout !== 'town' || (set.boundary !== 'wall' && set.boundary !== 'fence')) return;
  void splat;
  const h = spec.heightfield;
  const ih = plan.half - 16 + 1.2;
  const gaps = exitGaps(plan, ih);
  const stone = set.props.stone;
  for (const side of ['n', 's', 'e', 'w'] as const) {
    const sideGaps = gaps.filter((g) => g.side === side).map((g) => g.at);
    for (let s = -ih; s < ih; ) {
      const len = 0.8 + rnd() * 0.5;
      const mid = s + len / 2;
      s += len + 0.02;
      if (sideGaps.some((g) => Math.abs(g - mid) < 3.8)) continue;
      const [x, z] = side === 'n' ? [mid, -ih] : side === 's' ? [mid, ih] : side === 'e' ? [ih, mid] : [-ih, mid];
      const yaw = side === 'n' || side === 's' ? 0 : Math.PI / 2;
      const y = heightClamped(h, x, z);
      const t = partsAt(x, z);
      if (set.boundary === 'wall') {
        box(t[0], stone, x, y - 0.25, z, len, 0.72 + rnd() * 0.08, 0.62, yaw + (rnd() - 0.5) * 0.04, 0.05);
        box(t[0], stone, x + (rnd() - 0.5) * 0.1, y + 0.47, z, len * (0.55 + rnd() * 0.4), 0.3 + rnd() * 0.08, 0.5, yaw + (rnd() - 0.5) * 0.1, 0.05);
        box(t[1], stone, x, y - 0.25, z, len, 0.95, 0.6, yaw, 0.04);
        box(t[2], stone, x, y - 0.25, z, len + 0.02, 0.95, 0.6, yaw, 0.02);
      } else {
        box(t[0], set.props.wood, x, y - 0.2, z, 0.12, 1.2, 0.12, yaw, 0.02);
      }
    }
  }
}

/** Stone banks round ponds (skipping the boardwalk arc) and a pier over content's boardwalk strips. */
function dressWater(spec: ZoneSpec, plan: ZoneLayoutPlan, set: BiomeSet, partsAt: PartsAt): void {
  const h = spec.heightfield;
  for (const body of plan.water) {
    if (body.r > 18) continue;                      // sea / lakes: no masonry ring
    const bank = buildPondBank(set.props, body.r + 0.3, spec.seed + body.id * 31);
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
    }
    for (const rk of rocks) disposeProp(rk);
    disposeProp(bank);
    // pier on the boardwalk strip (both walkable and water): planks across, posts into the water, a rail
    const bw = body.boardwalk;
    if (!bw) continue;
    const zc = (bw.z0 + bw.z1) / 2;
    const width = Math.max(2.4, bw.z1 - bw.z0 + 0.6);
    const x0 = bw.x0 - 0.6; const x1 = bw.x1 + 1.6;
    const deck = bw.y + 0.08;
    for (let x = x0; x <= x1; x += 0.36) {
      const tp = partsAt(x, zc, false);
      box(tp[0], set.props.wood, x, deck - 0.06, zc + (hash2(Math.round(x * 10), body.id, 1) - 0.5) * 0.04, 0.32, 0.06, width - hash2(Math.round(x * 10), body.id, 2) * 0.1, (hash2(Math.round(x * 10), body.id, 3) - 0.5) * 0.04, 0.012);
      if (Math.round((x - x0) / 0.36) % 2 === 0) box(tp[1], set.props.wood, x, deck - 0.06, zc, 0.7, 0.06, width, 0, 0.012);
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
    }
    for (const s of [-1, 1]) beam(tp[0], set.props.wood, [x0, deck + 0.82, zc + s * (width / 2 - 0.05)], [bw.x0 + 1, deck + 0.82, zc + s * (width / 2 - 0.05)], 0.09, 0.06, 0.015, [0, 0, s]);
  }
}

/** A flush stone curb round the plaza (top 5 cm above the ground). */
function plazaCurb(h: HeightfieldData, plan: ZoneLayoutPlan, palette: Palette, set: BiomeSet, partsAt: PartsAt): void {
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
  }
}

/**
 * The plaza's paving pattern: a band of large flags round the centre feature and round the rim, joined by eight
 * radial spokes (a compass rose), flags 2 cm proud of the cobbles with 4 cm chamfers.
 */
function plazaPattern(h: HeightfieldData, plan: ZoneLayoutPlan, set: BiomeSet, partsAt: PartsAt, seed: number): void {
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
    }
  }
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2 + Math.PI / 8;
    for (let r = inner + 1.45; r < P.r - 2.3; r += 0.95) flag(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 0.62, 0.88, -a, k++);
  }
}

/** Interior sub-areas at warp arrival markers: a roofless planked room (the camera looks in), low walls, furniture. */
function warpRooms(h: HeightfieldData, plan: ZoneLayoutPlan, set: BiomeSet, partsAt: PartsAt): void {
  for (const w of plan.warpPairs) {
    if (!w.to) continue;
    const [x, z] = w.to;
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
 * Every scatter kind of the zone: trees (interior groves + the margin forest + a treeline on the skirt), willows by
 * water, two rock shapes (+ pebbles along roads), bushes (hedgerows on route boundaries), flower patches, ground
 * tufts, tall grass in the layout's patches, stumps and logs.
 */
function buildScatter(spec: ZoneSpec, plan: ZoneLayoutPlan, set: BiomeSet, splat: SplatContext, collider: TerrainCollider, skirtY: (x: number, z: number) => number, mat: (id: SurfaceId) => Material, views: BufferGeometry[], seed: number, flower0: number, flowerN: number, foliageN: number): ScatterOut[] {
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

  // trees ---------------------------------------------------------------------------------------------------
  const treeKinds = set.trees.filter((t) => t.weight > 0);
  const wsum = treeKinds.reduce((a, t) => a + t.weight, 0);
  const treeGeos = treeKinds.map((t, k) => buildTree(t.bark, t.leaf, t.shape, (spec.seed ^ 0x7ee5) + k * 977));
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
    if (d > half) return 0.9 * Math.max(0.2, 1 - (d - half) / reachTrees);        // treeline on the skirt
    if (!inPlay(x, z)) {
      if (roadDistance(splat.roads, x, z) < 3.5) return 0;
      return 1;                                                                   // the margin forest
    }
    if (!scatterClear(splat, x, z, 1.4, false)) return 0;
    if (roadDistance(splat.roads, x, z) < 3.2) return 0;
    for (const c of plan.clearings) if (Math.hypot(c.x - x, c.z - z) < c.r) return 0;
    if (spec.layout === 'route') {
      if (Math.abs(z - plan.roadZ(x)) < 9) return 0.08;
      const n = clumpy(x, z, 11);
      return n > 0.05 ? 1 : 0.18;
    }
    return 1;
  };
  const marginDensity = Math.max(set.density.treeMargin, spec.layout === 'route' ? set.density.treeInterior : set.density.treeMargin);
  for (const p of jitteredPoints(-half - reachTrees, half + reachTrees, -half - reachTrees, half + reachTrees, marginDensity, salt + 101, (x, z, hh) => {
    const a = treeAccept(x, z);
    if (a <= 0) return 0;
    if (inPlay(x, z)) return a * (interiorDensity / marginDensity);
    return a * (hh < 2 ? 1 : 1);
  })) {
    const k = pickTree(p.h);
    const s = 0.85 + hash2(Math.round(p.x * 8), Math.round(p.z * 8), salt + 3) * 0.35;
    treeInst[k]!.push({ x: p.x, y: yAt(p.x, p.z) - 0.12, z: p.z, yaw: p.h * 97.3, scale: s, tint: foliageTint(p.h * 3.7 % 1) });
    if (inPlay(p.x, p.z)) collider.addBlocker({ kind: 'circle', x: p.x, z: p.z, r: 0.42 * s + MOVER_R });
  }
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
        if (!scatterClear(splat, x, z, 1.2, true) || roadDistance(splat.roads, x, z) < 2.5) continue;
        wInst.push({ x, y: yAt(x, z) - 0.12, z, yaw: a * 3.1, scale: 0.9 + hash2(k, body.id, salt + 43) * 0.25, tint: 0 });
        if (inPlay(x, z)) collider.addBlocker({ kind: 'circle', x, z, r: 0.5 + MOVER_R });
      }
    }
    if (wInst.length > 0) {
      const g = buildTree(willow.bark, willow.leaf, willow.shape, spec.seed ^ 0x3111);
      out.push({ ...kindFrom('tree_willow', g, mat, views, true, 3, impostorFor(g, willow.leaf)), instances: wInst });
    }
  }
  treeKinds.forEach((t, k) => {
    if (treeInst[k]!.length === 0) return;
    out.push({ ...kindFrom(t.kind, treeGeos[k]!, mat, views, true, 3, impostorFor(treeGeos[k]!, t.leaf)), instances: treeInst[k]! });
  });

  // rocks + pebbles ------------------------------------------------------------------------------------------
  const rockA = buildRock(set.rock, spec.seed ^ 0x40c1, { size: 1.05, squash: 0.62, elongate: 1.3, cuts: [3, 5] });
  const rockB = buildRock(set.rock, spec.seed ^ 0x40c2, { size: 0.6, squash: 0.55, elongate: 1.4, cuts: [3, 5] });
  const aInst: Instance[] = []; const bInst: Instance[] = [];
  for (const p of jitteredPoints(-half - 20, half + 20, -half - 20, half + 20, set.density.rock * 1.6, salt + 201, (x, z) => {
    if (Math.max(Math.abs(x), Math.abs(z)) > half + 20) return 0;
    if (inPlay(x, z)) return scatterClear(splat, x, z, 1.2, false) && roadDistance(splat.roads, x, z) > 1.5 ? 0.6 : 0;
    return 1;
  })) {
    const big = p.h < 0.45;
    const s = big ? 0.7 + p.h * 1.5 : 0.6 + p.h * 0.8;
    (big ? aInst : bInst).push({ x: p.x, y: yAt(p.x, p.z) - 0.05, z: p.z, yaw: p.h * 131, scale: s, tint: 0 });
    if (big && inPlay(p.x, p.z) && s > 0.8) collider.addBlocker({ kind: 'circle', x: p.x, z: p.z, r: 0.75 * s + MOVER_R * 0.6 });
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
        if (plan.plaza && Math.hypot(x - plan.plaza.x, z - plan.plaza.z) < plan.plaza.r + 0.6) continue;
        let blocked = false;
        for (const bb of spec.buildings) if (footprintDistance(bb, x, z) < 0.6) { blocked = true; break; }
        if (blocked) continue;
        bInst.push({ x, y: yAt(x, z) - 0.02, z, yaw: hk * 77, scale: 0.16 + hash2(k, i, salt + 304) * 0.2, tint: 0 });
      }
    }
  }
  if (aInst.length) out.push({ ...kindFrom('rock_a', rockA, mat, views, true, 3, rockA.lod2, 2), instances: aInst });
  if (bInst.length) out.push({ ...kindFrom('rock_b', rockB, mat, views, false, 3, null, 0), instances: bInst });

  // bushes (+ hedgerows along route / story boundaries) -----------------------------------------------------
  if (set.bushLeaf) {
    const bush = buildBush(set.bushLeaf, spec.seed ^ 0xb005);
    const inst: Instance[] = [];
    for (const p of jitteredPoints(-half - 6, half + 6, -half - 6, half + 6, set.density.bush * 1.4, salt + 401, (x, z) => {
      const d = Math.max(Math.abs(x), Math.abs(z));
      if (d > half + 6) return 0;
      if (d > ih && d < ih + 3.5) return roadDistance(splat.roads, x, z) < 3 ? 0 : spec.layout === 'town' ? 0.9 : 1;   // the hedge line
      if (!inPlay(x, z)) return 0.5;
      if (!scatterClear(splat, x, z, 0.9, false)) return 0;
      splatAt(splat, x, z, f);
      if (f.path > -0.6) return 0;
      const nearHouse = spec.buildings.some((b) => { const fd = footprintDistance(b, x, z); return fd > 1.0 && fd < 2.6; });
      return nearHouse ? 0.5 : clumpy(x, z, 21) > 0.1 ? 0.55 : 0.12;
    })) {
      inst.push({ x: p.x, y: yAt(p.x, p.z) - 0.05, z: p.z, yaw: p.h * 53, scale: 0.8 + p.h * 0.55, tint: foliageTint(p.h) });
    }
    if (inst.length) out.push({ ...kindFrom('bush', bush, mat, views, true, 3, null, 2), instances: inst });
  }

  // flowers -------------------------------------------------------------------------------------------------
  if (set.flower) {
    const fl = buildFlowers(set.flower, spec.seed ^ 0xf10e);
    const inst: Instance[] = [];
    for (const p of jitteredPoints(-ih, ih, -ih, ih, set.density.flower * 3, salt + 501, (x, z) => {
      if (!scatterClear(splat, x, z, 0.7, false)) return 0;
      splatAt(splat, x, z, f);
      if (f.path > -0.3 || f.detail > 0.1) return 0;
      const nearHouse = spec.buildings.some((b) => { const fd = footprintDistance(b, x, z); return fd > 0.6 && fd < 2.2; });
      if (nearHouse) return 0.9;
      return clumpy(x, z, 31) > 0.18 ? 0.55 : 0.05;
    })) {
      inst.push({ x: p.x, y: yAt(p.x, p.z), z: p.z, yaw: p.h * 71, scale: 0.8 + p.h * 0.5, tint: flower0 + (Math.floor(p.h * 997) % flowerN) });
    }
    if (inst.length) out.push({ ...kindFrom('flower_patch', fl, mat, views, false, 2, null, 0, 'all'), instances: inst });
  }

  // ground tufts (short grass on the ground layer) -----------------------------------------------------------
  if (set.tuft) {
    const tuft = buildGroundTuft(set.tuft, spec.seed ^ 0x70f7);
    const inst: Instance[] = [];
    for (const p of jitteredPoints(-half + 1, half - 1, -half + 1, half - 1, set.density.tuft, salt + 601, (x, z) => {
      if (plan.plaza && Math.hypot(x - plan.plaza.x, z - plan.plaza.z) < plan.plaza.r + 0.4) return 0;
      splatAt(splat, x, z, f);
      if (f.path > -0.15 || f.plaza > -0.2) return 0;
      if (f.detail > 0.35) return 0;
      for (const w of plan.water) if (Math.hypot(w.cx - x, w.cz - z) < w.r * 1.05) return 0;
      for (const b of spec.buildings) if (footprintDistance(b, x, z) < 0.4) return 0;
      const edge = roadDistance(splat.roads, x, z);
      if (edge > 0.1 && edge < 1.4) return 0.85;                                 // grass fringes the paths
      if (f.detail > -0.25) return 0.55;
      return clumpy(x, z, 41) > 0.12 ? 0.8 : 0.12;
    })) {
      inst.push({ x: p.x, y: yAt(p.x, p.z), z: p.z, yaw: p.h * 89, scale: 0.75 + p.h * 0.6, tint: flower0 + flowerN + (Math.floor(p.h * 131) % 4) });
    }
    if (inst.length) out.push({ ...kindFrom('grass_tuft', { ...tuft, lod1: tuft.lod0 }, mat, views, false, 2, null, 0), instances: inst });
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
        inst.push({ x: p.x, y: yAt(p.x, p.z) - 0.03, z: p.z, yaw: p.h * 61, scale: 0.85 + p.h * 0.5, tint: foliageTint(p.h) });
      }
    }
    if (inst.length) out.push({ ...kindFrom('tall_grass', geo, mat, views, false, 2, null, 0), instances: inst });
  }

  // stumps + logs in the margins and route woods ---------------------------------------------------------------
  const stump = buildStump(set.trees[0]?.bark ?? set.props.wood, set.props.wood, spec.seed ^ 0x5709);
  const log = buildLog(set.trees[0]?.bark ?? set.props.wood, set.props.wood, spec.seed ^ 0x1066);
  const sInst: Instance[] = []; const lInst: Instance[] = [];
  for (const p of jitteredPoints(-half, half, -half, half, 0.0016, salt + 801, (x, z) => {
    if (inPlay(x, z)) return spec.layout === 'town' ? 0 : scatterClear(splat, x, z, 1.5, false) && roadDistance(splat.roads, x, z) > 3 ? 0.5 : 0;
    return 1;
  })) {
    (p.h < 0.55 ? sInst : lInst).push({ x: p.x, y: yAt(p.x, p.z) - 0.05, z: p.z, yaw: p.h * 41, scale: 0.9 + p.h * 0.4, tint: 0 });
  }
  if (sInst.length) out.push({ ...kindFrom('stump', stump, mat, views, false, 3, null, 0), instances: sInst });
  if (lInst.length) out.push({ ...kindFrom('log', log, mat, views, false, 3, null, 0), instances: lInst });

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

