/**
 * SPEC §10.5.5 — layout (pure TypeScript, no `three` construction; node-tested).
 *
 * The zone plan is content's (`@ewa/content` `zonePlan`, audit R1): roads, plaza, tall-grass patches, clearings,
 * the set-piece, buildings with their doors, lamp posts, hand-placed props and every solid footprint are planned
 * there from the `ZoneDef` + `layoutSeed`, so `buildHeightfield` can stamp the same footprints into `walkable` that
 * the zone builder draws. The client adapter passes the plan through `ZoneSpec` (`plan`, `buildings`, `props`, and
 * `lights` composed here by `lightsFromPlan` from content's light positions and render's light tables); the builder
 * reads it back with `layoutOf(spec)` and never plans a layout itself.
 *
 * What stays here is render's: geometry helpers, the set-piece extent / light / housing tables the generators build
 * to, the biome light styles, the terrain splat and the scatter keep-clear test. `planLayout` survives only for the
 * capture harness (`packages/client/src/harness/anchors.ts`) and is asserted equal to content's plan.
 */
import type { BuildingSpec, Dir, Edge, HeightfieldData, InteriorSpec, Layout, Marker, SetPieceId, TypeName, ZonePlanData, ZoneSpec } from '../contracts.js';
import type { LightKind, LightSource } from '../descriptors.js';
import { FIELD_MARGIN, waterBodies, type Bounds, type WaterBody } from '../terrain/field.js';
import { createPrng, valueNoise } from './prng.js';

export type Vec2 = readonly [number, number];
/** The only thing the planners need from an rng (core's `Rng` and render's `Prng` both satisfy it). */
export interface RngLike { next(): number }
export interface Circle { readonly x: number; readonly z: number; readonly r: number }
export interface Ellipse { readonly x: number; readonly z: number; readonly rx: number; readonly rz: number; readonly yaw: number }
export interface Road { readonly id: string; readonly points: readonly Vec2[]; readonly width: number; readonly kind: 'road' | 'lane' | 'path' }

export const DIRS: readonly Dir[] = ['n', 'e', 's', 'w'];

/** Field sizes (spine §3.1 extents). */
export const FIELD_SIZE: Readonly<Record<Layout, number>> = { town: 160, route: 240, story: 200 };
/** Playable interior `ZoneSpec.size` (field minus the 16 m margin on each side). */
export const INTERIOR_SIZE: Readonly<Record<Layout, number>> = { town: 128, route: 208, story: 168 };

export const TOWN_LAYOUT = Object.freeze({
  plazaR: 14, ringMin: 22, ringMax: 30, gap: 4, roadWidth: 3.5, laneWidth: 3.0, pathWidth: 1.6,
  gymDoor: [0, -26] as Vec2, gymW: 14, gymD: 12, buildings: [6, 10] as const, pointClearance: 2.5,
});
export const ROUTE_LAYOUT = Object.freeze({
  corridorHalf: 6, roadWidth: 3.5, meanderAmp: 1.4, meanderWavelength: 52, patches: [3, 5] as const, patchRx: 8, patchRz: 5,
  clearings: [2, 3] as const, clearingR: [7, 10] as const,
});
export const STORY_LAYOUT = Object.freeze({ platformR: 14, roadWidth: 4 });
/** The server's handover trigger: 6 m inside the playable edge. */
export const HANDOVER_INSET = 6;
/** Local position of a generated lantern's housing (post base at the origin). `makeLantern` builds to this. */
export const LANTERN_HOUSING_LOCAL: readonly [number, number, number] = [0, 2.62, 0];
/** Local housing positions of the other generated housings (post/stand base at the origin). */
export const HOUSING_LOCAL: Readonly<Record<'lantern' | 'brazier' | 'beacon' | 'window' | 'crystal' | 'candle', readonly [number, number, number]>> = {
  lantern: LANTERN_HOUSING_LOCAL, brazier: [0, 1.02, 0], beacon: [0, 3.35, 0], window: [0, 1.6, 0], crystal: [0, 1.9, 0], candle: [0, 1.28, 0],
};

// ---- small geometry ---------------------------------------------------------------------------------------

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax; const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px; const qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz);
}

export function distToPolyline(pts: readonly Vec2[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!; const b = pts[i + 1]!;
    const d = distToSegment(x, z, a[0], a[1], b[0], b[1]);
    if (d < best) best = d;
  }
  return best;
}

/** Signed distance to the nearest road edge (negative inside a road). */
export function roadDistance(roads: readonly Road[], x: number, z: number): number {
  let best = Infinity;
  for (const r of roads) {
    const d = distToPolyline(r.points, x, z) - r.width / 2;
    if (d < best) best = d;
  }
  return best;
}

/** World → building-local (inverse yaw about +Y). */
function toLocal(b: { readonly x: number; readonly z: number; readonly yaw: number }, x: number, z: number): Vec2 {
  const dx = x - b.x; const dz = z - b.z;
  const c = Math.cos(b.yaw); const s = Math.sin(b.yaw);
  return [c * dx - s * dz, s * dx + c * dz];
}

/** Local → world for a yawed frame. */
export function toWorld(b: { readonly x: number; readonly z: number; readonly yaw: number }, lx: number, lz: number): Vec2 {
  const c = Math.cos(b.yaw); const s = Math.sin(b.yaw);
  return [b.x + c * lx + s * lz, b.z - s * lx + c * lz];
}

/** Distance from a point to a building footprint (0 inside). */
export function footprintDistance(b: Pick<BuildingSpec, 'x' | 'z' | 'yaw' | 'w' | 'd'>, x: number, z: number): number {
  const [lx, lz] = toLocal(b, x, z);
  const qx = Math.max(0, Math.abs(lx) - b.w / 2); const qz = Math.max(0, Math.abs(lz) - b.d / 2);
  return Math.sqrt(qx * qx + qz * qz);
}

/** World position of a building's door (front wall centre, local +z) and the outward front normal. */
export function doorOf(b: Pick<BuildingSpec, 'x' | 'z' | 'yaw' | 'd'>): { readonly x: number; readonly z: number; readonly nx: number; readonly nz: number } {
  const nx = Math.sin(b.yaw); const nz = Math.cos(b.yaw);
  return { x: b.x + nx * (b.d / 2), z: b.z + nz * (b.d / 2), nx, nz };
}

export function edgePoint(layout: Layout, dir: Dir): Vec2 {
  const h = INTERIOR_SIZE[layout] / 2;
  switch (dir) {
    case 'n': return [0, -h];
    case 's': return [0, h];
    case 'e': return [h, 0];
    default: return [-h, 0];
  }
}

const DIR_VEC: Readonly<Record<Dir, Vec2>> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

// ---- set-piece tables (shared by the planners and the generators) ------------------------------------------

/** Keep-clear extent of each set-piece in its local frame (half width along x, half depth along z). */
export const SET_PIECE_EXTENT: Readonly<Record<SetPieceId, { readonly hw: number; readonly hd: number }>> = {
  grove_heart_tree: { hw: 5.2, hd: 5.2 }, mire_boardwalk: { hw: 15, hd: 4.5 }, cinder_caldera: { hw: 6.5, hd: 6.5 }, ash_lava_bridge: { hw: 11, hd: 5 },
  salt_lighthouse: { hw: 4.5, hd: 4.5 }, tide_wreck: { hw: 9, hd: 5 }, storm_coil_tower: { hw: 4.5, hd: 4.5 }, galvan_span: { hw: 12, hd: 4 },
  marrow_mineshaft: { hw: 6, hd: 5 }, deepcut_arch: { hw: 9, hd: 3.5 }, vesper_witch_hut: { hw: 5.5, hd: 5 }, hollow_lantern_road: { hw: 14, hd: 4 },
  forge_great_gate: { hw: 9, hd: 4 }, siege_trebuchet: { hw: 6, hd: 7 }, sky_shrine: { hw: 6, hd: 6 }, ascent_stair: { hw: 5, hd: 9 },
  solenne_cathedral: { hw: 8, hd: 8 }, eclipse_engine: { hw: 8, hd: 8 }, umbral_dome: { hw: 9, hd: 9 }, celestial_spire: { hw: 7, hd: 7 },
  rift_maw: { hw: 9, hd: 9 },
};

export interface SetPieceLight { readonly local: readonly [number, number, number]; readonly kind: LightKind; readonly color: string; readonly intensity: number; readonly range: number; readonly castShadow: boolean; readonly flicker: { readonly amplitude: number; readonly hz: number } | null }

const warmLantern = (x: number, y: number, z: number, castShadow = false): SetPieceLight => ({ local: [x, y, z], kind: 'lantern', color: '#ffb35c', intensity: 34, range: 11, castShadow, flicker: null });
const fire = (x: number, y: number, z: number, color = '#ff7a2a'): SetPieceLight => ({ local: [x, y, z], kind: 'fire', color, intensity: 26, range: 11, castShadow: false, flicker: { amplitude: 0.12, hz: 5 } });
const crystal = (x: number, y: number, z: number, color: string, intensity = 20): SetPieceLight => ({ local: [x, y, z], kind: 'crystal', color, intensity, range: 12, castShadow: false, flicker: null });

/** Lights carried by each set-piece (housing geometry is part of the set-piece at exactly these local points). */
export const SET_PIECE_LIGHTS: Readonly<Record<SetPieceId, readonly SetPieceLight[]>> = {
  grove_heart_tree: [warmLantern(2.9, 3.55, 1.3), warmLantern(-2.5, 3.8, -1.9), warmLantern(-0.9, 3.35, 3.1)],
  mire_boardwalk: [warmLantern(-7.4, 2.72, 2.05, true), warmLantern(7.4, 2.72, -2.05)],
  cinder_caldera: [{ local: [0, 0.6, 0], kind: 'lava', color: '#ff5a1f', intensity: 40, range: 14, castShadow: false, flicker: { amplitude: 0.08, hz: 1.5 } }],
  ash_lava_bridge: [fire(-9.5, 1.5, 2.6), fire(9.5, 1.5, -2.6)],
  salt_lighthouse: [{ local: [0, 12.4, 0], kind: 'beacon', color: '#fff2c4', intensity: 60, range: 22, castShadow: false, flicker: null }],
  tide_wreck: [warmLantern(3.2, 2.9, 0.9)],
  storm_coil_tower: [crystal(0, 9.2, 0, '#9fd0ff', 30)],
  galvan_span: [crystal(-10.6, 4.6, 0, '#9fd0ff'), crystal(10.6, 4.6, 0, '#9fd0ff')],
  marrow_mineshaft: [warmLantern(-2.6, 3.1, 3.4), warmLantern(2.6, 3.1, 3.4)],
  deepcut_arch: [warmLantern(-6.2, 2.9, 1.4)],
  vesper_witch_hut: [{ local: [2.2, 1.28, 3.4], kind: 'candle', color: '#ffd08a', intensity: 12, range: 8, castShadow: false, flicker: { amplitude: 0.1, hz: 7 } }],
  hollow_lantern_road: [warmLantern(-10, 2.72, 2.6), warmLantern(0, 2.72, -2.6), warmLantern(10, 2.72, 2.6)],
  forge_great_gate: [fire(-6.4, 3.3, 2.2), fire(6.4, 3.3, 2.2)],
  siege_trebuchet: [fire(3.6, 1.0, 4.4)],
  sky_shrine: [warmLantern(-3.6, 2.6, 3.6), warmLantern(3.6, 2.6, 3.6)],
  ascent_stair: [warmLantern(-2.4, 2.72, 7.5)],
  solenne_cathedral: [{ local: [0, 3.2, 5.5], kind: 'window', color: '#ffe8c0', intensity: 30, range: 12, castShadow: false, flicker: null }],
  eclipse_engine: [crystal(0, 4.4, 0, '#7be0d0', 28)],
  umbral_dome: [crystal(0, 6.5, 6.2, '#b8c0ff', 22)],
  celestial_spire: [crystal(0, 12, 0, '#c7f4ff', 30)],
  rift_maw: [crystal(0, 2.0, 0, '#b46bff', 34)],
};

// ---- the plan -------------------------------------------------------------------------------------------

export interface LayoutInput {
  readonly seed: number;
  readonly layout: Layout;
  readonly heightfield: HeightfieldData;
  readonly edges: Readonly<Partial<Record<Dir, Edge>>>;
  readonly actors: readonly { readonly x: number; readonly z: number }[];
  readonly pickups: readonly { readonly x: number; readonly z: number }[];
  readonly tablets: readonly { readonly x: number; readonly z: number }[];
  readonly warps: readonly Marker[];
  readonly tallGrass: boolean;
  readonly setPiece: SetPieceId;
}

export interface ZoneLayoutPlan {
  readonly layout: Layout;
  readonly half: number;
  readonly interior: Bounds;
  readonly plaza: Circle | null;
  readonly roads: readonly Road[];
  readonly grassPatches: readonly Ellipse[];
  readonly clearings: readonly Circle[];
  readonly setPiece: { readonly id: SetPieceId; readonly x: number; readonly z: number; readonly yaw: number; readonly hw: number; readonly hd: number };
  readonly water: readonly WaterBody[];
  /** Authored points (actors, pickups, tablets, warp ends): never moved; kept clear. */
  readonly points: readonly Vec2[];
  /** Warp pairs (door marker → arrival marker id `${id}:to`). */
  readonly warpPairs: readonly { readonly id: string; readonly door: Vec2; readonly to: Vec2 | null }[];
  /** Route road centreline z(x) (0 elsewhere). */
  /** Door paths (1.6 m, door → nearest road or the plaza rim): part of the splat's roads and the scatter keep-clear. */
  readonly doorPaths: readonly Road[];
  roadZ(x: number): number;
}

function authoredPoints(i: LayoutInput): Vec2[] {
  const out: Vec2[] = [];
  for (const a of i.actors) out.push([a.x, a.z]);
  for (const p of i.pickups) out.push([p.x, p.z]);
  for (const t of i.tablets) out.push([t.x, t.z]);
  for (const w of i.warps) out.push([w.x, w.z]);
  return out;
}

/** Warp door markers pair with arrival markers named `${id}:to` (ZoneSpec.warps carries both ends as Markers). */
export function warpPairs(warps: readonly Marker[]): { id: string; door: Vec2; to: Vec2 | null }[] {
  const byId = new Map(warps.map((w) => [w.id, w] as const));
  const out: { id: string; door: Vec2; to: Vec2 | null }[] = [];
  for (const w of warps) {
    if (w.id.endsWith(':to')) continue;
    const t = byId.get(`${w.id}:to`);
    out.push({ id: w.id, door: [w.x, w.z], to: t ? [t.x, t.z] : null });
  }
  return out;
}

function pushOffWater(p: [number, number], water: readonly WaterBody[], perp: Vec2, clearance: number): void {
  for (let k = 0; k < 12; k++) {
    let hit: WaterBody | null = null;
    for (const w of water) if (Math.hypot(p[0] - w.cx, p[1] - w.cz) < w.r + clearance) { hit = w; break; }
    if (hit === null) return;
    const side = (p[0] - hit.cx) * perp[0] + (p[1] - hit.cz) * perp[1] >= 0 ? 1 : -1;
    p[0] += perp[0] * side * 1.5; p[1] += perp[1] * side * 1.5;
  }
}

/** A wiggling polyline from `a` to `b` (n segments), pushed away from water. */
function wigglePath(a: Vec2, b: Vec2, n: number, amp: number, rng: RngLike, water: readonly WaterBody[], clearance: number): Vec2[] {
  const dx = b[0] - a[0]; const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const perp: Vec2 = [-dz / len, dx / len];
  const sign = rng.next() < 0.5 ? -1 : 1;
  const phase = rng.next() * Math.PI;
  const out: Vec2[] = [a];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const w = Math.sin(Math.PI * t) * amp * sign + Math.sin(t * 7 + phase) * amp * 0.25 * Math.sin(Math.PI * t);
    const p: [number, number] = [a[0] + dx * t + perp[0] * w, a[1] + dz * t + perp[1] * w];
    pushOffWater(p, water, perp, clearance);
    out.push(p);
  }
  out.push(b);
  return out;
}

/**
 * @deprecated The zone builder and the adapter read content's plan (`layoutOf(spec)`); this copy of the planner stays for
 * the capture harness's anchors only (`packages/client/test/zoneSpecFor.test.ts` asserts it equals `spec.plan`).
 * `doorPaths` is left empty.
 */
export function planLayout(i: LayoutInput): ZoneLayoutPlan {
  const rng = createPrng(i.seed).fork('layout');
  const half = FIELD_SIZE[i.layout] / 2;
  const ih = half - FIELD_MARGIN;
  const interior: Bounds = { minX: -ih, maxX: ih, minZ: -ih, maxZ: ih };
  const water = waterBodies(i.heightfield);
  const points = authoredPoints(i);
  const roads: Road[] = [];
  const grassPatches: Ellipse[] = [];
  const clearings: Circle[] = [];
  let plaza: Circle | null = null;
  let roadZ = (_x: number): number => 0;
  const T = TOWN_LAYOUT;

  if (i.layout === 'town') {
    plaza = { x: 0, z: 0, r: T.plazaR };
    for (const dir of DIRS) {
      if (i.edges[dir] === undefined) continue;
      const v = DIR_VEC[dir];
      const start: Vec2 = [v[0] * (T.plazaR - 0.6), v[1] * (T.plazaR - 0.6)];
      const end: Vec2 = [v[0] * half, v[1] * half];
      if (dir === 'n') {
        // detour west of the gym (footprint x ∈ [−7, 7], z ∈ [−38, −26])
        roads.push({ id: 'road_n', kind: 'road', width: T.roadWidth, points: [[-5.2, -12.9], [-10.4, -21], [-11.6, -30], [-11, -40], [-6.5, -50], [-1.5, -58], [0, -66], end] });
        continue;
      }
      roads.push({ id: `road_${dir}`, kind: 'road', width: T.roadWidth, points: wigglePath(start, end, 10, 2.2, rng, water, 5) });
    }
    if (i.edges.s === undefined) {
      // the south lane the shop and healer flank; it ends at a south pond's bank when there is one
      const pond = water.find((w) => w.cz > 20 && w.cz < 60 && Math.abs(w.cx) < 20);
      const endZ = pond ? pond.cz - pond.r - 3.5 : T.plazaR + 22;
      const endX = pond ? pond.cx * 0.6 : 0;
      roads.push({ id: 'lane_s', kind: 'lane', width: T.laneWidth, points: wigglePath([0, T.plazaR - 0.6], [endX, endZ], 6, 0.8, rng, [], 0) });
    }
  } else if (i.layout === 'route') {
    const R = ROUTE_LAYOUT;
    const phase = rng.next() * Math.PI * 2;
    const phase2 = rng.next() * Math.PI * 2;
    roadZ = (x: number): number => R.meanderAmp * Math.sin((2 * Math.PI * x) / R.meanderWavelength + phase) + 0.5 * Math.sin((2 * Math.PI * x) / (R.meanderWavelength * 0.37) + phase2);
    const pts: Vec2[] = [];
    for (let x = -half; x <= half + 1e-6; x += 4) pts.push([x, roadZ(x)]);
    roads.push({ id: 'road_main', kind: 'road', width: R.roadWidth, points: pts });
    for (const dir of ['n', 's'] as const) {
      if (i.edges[dir] === undefined) continue;
      const v = DIR_VEC[dir];
      roads.push({ id: `road_${dir}`, kind: 'road', width: R.roadWidth, points: wigglePath([0, roadZ(0)], [v[0] * half, v[1] * half], 10, 3, rng, water, 5) });
    }
    if (i.tallGrass) {
      const n = R.patches[1] - 1 + Math.floor(rng.next() * 2);   // 4–5 of the SPEC's 3–5: a 208 m route reads sparse with fewer
      let side = rng.next() < 0.5 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const baseX = -ih + 22 + (k * (2 * ih - 44)) / Math.max(1, n - 1) + (rng.next() - 0.5) * 16;
        const yaw = (rng.next() - 0.5) * 0.35;
        const rz = R.patchRz * (0.85 + rng.next() * 0.3);
        const rx = R.patchRx * (0.85 + rng.next() * 0.3);
        let placed: Ellipse | null = null;
        for (let attempt = 0; attempt < 16 && placed === null; attempt++) {
          const x = baseX + (attempt % 8 === 0 ? 0 : ((attempt % 2 === 0 ? 1 : -1) * Math.ceil((attempt % 8) / 2) * 6));
          const s = attempt >= 8 ? -side : side;
          const z = roadZ(x) + s * (R.roadWidth / 2 + 1.2 + rz);
          const e: Ellipse = { x, z, rx, rz, yaw };
          if (Math.abs(x) + rx > ih - 4) continue;
          if (water.some((w) => Math.hypot(w.cx - x, w.cz - z) < w.r + rx + 3)) continue;
          if (points.some(([px, pz]) => inEllipse(e, px, pz, 1.5))) continue;
          if (Math.abs(x) < SET_PIECE_EXTENT[i.setPiece].hw + rx + 2 && Math.abs(z) < SET_PIECE_EXTENT[i.setPiece].hd + rz + 2) continue;
          placed = e;
        }
        if (placed !== null) grassPatches.push(placed);
        side = -side;
      }
    }
    const nc = R.clearings[0] + Math.floor(rng.next() * (R.clearings[1] - R.clearings[0] + 1));
    for (let k = 0; k < nc; k++) {
      const r = R.clearingR[0] + rng.next() * (R.clearingR[1] - R.clearingR[0]);
      for (let attempt = 0; attempt < 12; attempt++) {
        const x = -ih + 30 + ((k + 0.5) * (2 * ih - 60)) / nc + (rng.next() - 0.5) * 24;
        const z = (rng.next() < 0.5 ? -1 : 1) * (18 + rng.next() * 26);
        if (Math.abs(x) > ih - r - 4 || Math.abs(z) > ih - r - 4) continue;
        if (water.some((w) => Math.hypot(w.cx - x, w.cz - z) < w.r + r + 3)) continue;
        if (grassPatches.some((e) => Math.hypot(e.x - x, e.z - z) < e.rx + r + 2)) continue;
        clearings.push({ x, z, r });
        break;
      }
    }
  } else {
    plaza = { x: 0, z: 0, r: STORY_LAYOUT.platformR };
    for (const dir of DIRS) {
      if (i.edges[dir] === undefined) continue;
      const v = DIR_VEC[dir];
      roads.push({ id: `road_${dir}`, kind: 'road', width: STORY_LAYOUT.roadWidth, points: wigglePath([v[0] * (STORY_LAYOUT.platformR - 0.6), v[1] * (STORY_LAYOUT.platformR - 0.6)], [v[0] * half, v[1] * half], 10, 2.5, rng, water, 5) });
    }
  }

  if (i.layout !== 'route' && i.tallGrass) {
    // towns / story zones with an encounter table: patches on the outskirts, away from roads and the gym
    const n = 3;
    const base = rng.next() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const a = base + (k * Math.PI * 2) / n + attempt * 0.37;
        const rr = (i.layout === 'town' ? 44 : 38) + rng.next() * 12;
        const x = Math.cos(a) * rr; const z = Math.sin(a) * rr;
        const e: Ellipse = { x, z, rx: ROUTE_LAYOUT.patchRx, rz: ROUTE_LAYOUT.patchRz, yaw: a + Math.PI / 2 };
        if (Math.abs(x) + 9 > ih - 3 || Math.abs(z) + 9 > ih - 3) continue;
        if (roadDistance(roads, x, z) < 10) continue;
        if (i.layout === 'town' && z < -20 && Math.abs(x) < 16) continue;
        if (water.some((w) => Math.hypot(w.cx - x, w.cz - z) < w.r + 11)) continue;
        if (points.some(([px, pz]) => inEllipse(e, px, pz, 1.5))) continue;
        grassPatches.push(e);
        break;
      }
    }
  }

  const sp = i.layout === 'route' ? { x: 0, z: roadZ(0) } : { x: 0, z: 0 };
  const ext = SET_PIECE_EXTENT[i.setPiece];
  return {
    layout: i.layout, half, interior, plaza, roads, grassPatches, clearings,
    setPiece: { id: i.setPiece, x: sp.x, z: sp.z, yaw: 0, hw: ext.hw, hd: ext.hd },
    water, points, warpPairs: warpPairs(i.warps), roadZ, doorPaths: [],
  };
}

export function inEllipse(e: Ellipse, x: number, z: number, pad = 0): boolean {
  const dx = x - e.x; const dz = z - e.z;
  const c = Math.cos(e.yaw); const s = Math.sin(e.yaw);
  const lx = c * dx - s * dz; const lz = s * dx + c * dz;
  const rx = e.rx + pad; const rz = e.rz + pad;
  return (lx * lx) / (rx * rx) + (lz * lz) / (rz * rz) <= 1;
}

export function inSetPiece(plan: ZoneLayoutPlan, x: number, z: number, pad = 0): boolean {
  const sp = plan.setPiece;
  const [lx, lz] = toLocal(sp, x, z);
  return Math.abs(lx) < sp.hw + pad && Math.abs(lz) < sp.hd + pad;
}

/** A route's road centreline z at x (content `roadZAt`, the same expression); 0 without a meander. */
export function roadZAt(m: ZonePlanData['roadMeander'], x: number): number {
  if (m === null) return 0;
  return m.amp * Math.sin((2 * Math.PI * x) / m.wavelength + m.phase) + 0.5 * Math.sin((2 * Math.PI * x) / (m.wavelength * 0.37) + m.phase2);
}

/**
 * The builder's view of `spec.plan` (content's `zonePlan`): the plan's roads, plaza, patches, clearings, set-piece,
 * authored points, warp pairs and door paths, the water bodies of `spec.heightfield` (footprints never touch water
 * samples, so they are content's bodies exactly) and the route centreline as a function.
 */
export function layoutOf(spec: Pick<ZoneSpec, 'layout' | 'heightfield' | 'plan'>): ZoneLayoutPlan {
  const p = spec.plan;
  const half = FIELD_SIZE[spec.layout] / 2;
  const ih = half - FIELD_MARGIN;
  const meander = p.roadMeander;
  return {
    layout: spec.layout, half, interior: { minX: -ih, maxX: ih, minZ: -ih, maxZ: ih },
    plaza: p.plaza, roads: p.roads, grassPatches: p.grassPatches, clearings: p.clearings, setPiece: p.setPiece,
    water: waterBodies(spec.heightfield), points: p.points, warpPairs: p.warpPairs, doorPaths: p.doorPaths,
    roadZ: (x: number): number => roadZAt(meander, x),
  };
}

// ---- light appearance (content plans where lights stand; the adapter composes them here) --------------------

export interface BiomeLightStyle {
  readonly kind: LightKind; readonly generator: 'lantern' | 'brazier' | 'crystal' | 'candle';
  readonly color: string; readonly intensity: number; readonly range: number;
  readonly flicker: { readonly amplitude: number; readonly hz: number } | null;
}

/** The biome light table (§20.4.4 "per the biome's light table"). */
export const BIOME_LIGHTS: Readonly<Record<string, BiomeLightStyle>> = {
  grove: { kind: 'lantern', generator: 'lantern', color: '#ffb35c', intensity: 40, range: 12, flicker: null },
  cinder: { kind: 'brazier', generator: 'brazier', color: '#ff8a3c', intensity: 30, range: 11, flicker: { amplitude: 0.12, hz: 5 } },   // M3 review fixes (Cinderhold's night murk): was 22 / 10 m
  salt: { kind: 'lantern', generator: 'lantern', color: '#ffd6a0', intensity: 40, range: 12, flicker: null },
  storm: { kind: 'crystal', generator: 'crystal', color: '#b4dcff', intensity: 38, range: 12, flicker: null },   // M3 review fixes (Stormrook at night): was 18 / 10 m, one cold pool per lamp
  marrow: { kind: 'lamp', generator: 'lantern', color: '#ffc766', intensity: 40, range: 12, flicker: null },
  vesper: { kind: 'candle', generator: 'candle', color: '#ffd08a', intensity: 12, range: 8, flicker: { amplitude: 0.1, hz: 7 } },
  forge: { kind: 'brazier', generator: 'brazier', color: '#ff7a2a', intensity: 22, range: 10, flicker: { amplitude: 0.12, hz: 5 } },
  sky: { kind: 'lantern', generator: 'lantern', color: '#ff9a6a', intensity: 36, range: 12, flicker: null },
  capital: { kind: 'lamp', generator: 'lantern', color: '#fff0c8', intensity: 44, range: 13, flicker: null },
  shrine: { kind: 'crystal', generator: 'crystal', color: '#7be0d0', intensity: 18, range: 10, flicker: null },
  rift: { kind: 'crystal', generator: 'crystal', color: '#b46bff', intensity: 16, range: 10, flicker: null },
};

/** Gym beacon / arena ring colour per type (sRGB). */
export const TYPE_ACCENT: Readonly<Record<TypeName, string>> = {
  Normal: '#a8a77a', Fire: '#ee8130', Water: '#6390f0', Grass: '#7ac74c', Electric: '#f7d02c', Ice: '#96d9d6', Fighting: '#c22e28',
  Poison: '#a33ea1', Ground: '#e2bf65', Flying: '#a98ff3', Psychic: '#f95587', Bug: '#a6b91a', Rock: '#b6a136', Ghost: '#735797',
  Dragon: '#6f35fc', Steel: '#b7b7ce', Fairy: '#d685ad', Dark: '#705746', Cosmic: '#7b6fd6',
};

/**
 * What a zone spends of the 8 / 24 budget (content applies the same cap, `ZONE_LIGHT_CAP`, when it plans the lights): 1 shadow-casting light (each local caster re-renders its casters: a
 * draw-call decision, IMPLEMENTATION-NOTES Part 2) and ≤ 20 non-shadowing; the arena's 2 beacons are reserved.
 */
export const ZONE_LIGHT_CAP = { shadow: 1, nonShadow: 20 } as const;

/** Where content's plan puts a light (`@ewa/content` `PlanLight`, structurally); appearance comes from the tables above. */
export interface PlanLightData {
  readonly id: string;
  readonly role: string;
  /** world position, 1 mm rounded */
  readonly x: number; readonly z: number;
  /** terrain height under the post (unrounded post position), or at the set-piece origin for set-piece lights */
  readonly ground: number;
  readonly castShadow: boolean;
  /** generated housing kind; null for a light carried by the set-piece mesh */
  readonly generator: 'lantern' | 'brazier' | 'beacon' | 'crystal' | 'candle' | null;
  /** index into `SET_PIECE_LIGHTS[setPiece]` (set-piece lights) */
  readonly slot: number | null;
  /** housing seed (generated lights) */
  readonly seed: number | null;
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * `LightSource`s from content's light positions: set-piece lights take kind / colour / intensity / range / flicker
 * and height from `SET_PIECE_LIGHTS`, lamp posts from the biome's `BIOME_LIGHTS` style (the gym's two beacons in
 * the zone's `TYPE_ACCENT`), the housing height from `HOUSING_LOCAL`. Pure; the order and ids are the plan's.
 */
export function lightsFromPlan(lights: readonly PlanLightData[], biome: string, setPiece: SetPieceId, accentType: TypeName | null): LightSource[] {
  const style = BIOME_LIGHTS[biome] ?? BIOME_LIGHTS.grove!;
  const out: LightSource[] = [];
  for (const l of lights) {
    if (l.generator === null) {
      const slot = l.slot ?? 0;
      const s = SET_PIECE_LIGHTS[setPiece][slot]!;
      out.push({ id: l.id, kind: s.kind, color: s.color, intensity: s.intensity, position: [l.x, round3(l.ground + s.local[1]), l.z], castShadow: l.castShadow, range: s.range, housing: { kind: 'mesh', meshId: `setpiece:${setPiece}:${slot}` }, flicker: s.flicker });
      continue;
    }
    const beacon = l.generator === 'beacon';
    const over = beacon ? { kind: 'beacon' as const, color: accentType ? TYPE_ACCENT[accentType] : '#ffffff', intensity: 30, range: 10 } : null;
    out.push({
      id: l.id, kind: over?.kind ?? style.kind, color: over?.color ?? style.color, intensity: over?.intensity ?? style.intensity,
      position: [l.x, round3(l.ground + HOUSING_LOCAL[l.generator][1]), l.z], castShadow: l.castShadow, range: over?.range ?? style.range,
      housing: { kind: 'generated', generator: l.generator, seed: l.seed ?? 0 }, flicker: beacon ? null : style.flicker,
    });
  }
  return out;
}

// ---- the terrain splat (builder) ------------------------------------------------------------------------

/** Signed layer fields at a point (positive = inside): the terrain mesh splits triangles on their zero lines. */
export interface SplatFields { plaza: number; path: number; detail: number }

/** Phase A: a pocket as the splat / scatter see it — the paved rect (floor + wall, local frame) and the outer footprint AABB. */
export interface PocketRect {
  readonly x: number; readonly z: number; readonly yaw: number;
  /** half extents of the floor + the 0.4 m wall (paved, crisp edge) */
  readonly hw: number; readonly hd: number;
  /** world AABB of the outer footprint (floor + wall + screen): no scatter inside it */
  readonly fx: number; readonly fz: number; readonly fhw: number; readonly fhd: number;
}

/** Wall thickness of a pocket (content `INTERIOR_WALL_T`). */
export const POCKET_WALL_T = 0.4;

export function pocketRects(interiors: readonly InteriorSpec[] | undefined): PocketRect[] {
  return (interiors ?? []).map((p) => ({
    x: p.x, z: p.z, yaw: p.yaw, hw: p.w / 2 + POCKET_WALL_T, hd: p.d / 2 + POCKET_WALL_T,
    fx: p.footprint.x, fz: p.footprint.z, fhw: p.footprint.hw, fhd: p.footprint.hd,
  }));
}

/** True when (x, z) lies within `pad` of a pocket's outer footprint (Phase A: scatter never stands there). */
export function inPocket(pockets: readonly PocketRect[], x: number, z: number, pad = 0): boolean {
  for (const p of pockets) if (Math.abs(x - p.fx) < p.fhw + pad && Math.abs(z - p.fz) < p.fhd + pad) return true;
  return false;
}

export interface SplatContext {
  readonly plan: ZoneLayoutPlan;
  readonly roads: readonly Road[];            // plan.roads + door paths
  readonly buildings: readonly BuildingSpec[];
  readonly salt: number;
  /** Phase A pockets (paved; scatter-free footprints). */
  readonly pockets: readonly PocketRect[];
}

export function createSplatContext(plan: ZoneLayoutPlan, buildings: readonly BuildingSpec[], seed: number, interiors?: readonly InteriorSpec[]): SplatContext {
  return { plan, roads: [...plan.roads, ...plan.doorPaths], buildings, salt: seed & 0xffff, pockets: pocketRects(interiors) };
}

/**
 * Plaza: inside the paved circle (crisp edge; a curb is built on it). Path: roads with a noisy 0.25 m edge.
 * Detail (dirt / fringe): a 0.8 m fringe along roads, aprons round buildings, pond banks, noise patches, and the
 * margin's worn ground. Ground everywhere else.
 */
export function splatAt(c: SplatContext, x: number, z: number, out: SplatFields): SplatFields {
  const plan = c.plan;
  const n1 = valueNoise(x * 0.9, z * 0.9, c.salt);
  const n2 = valueNoise(x * 0.23, z * 0.23, c.salt + 7);
  out.plaza = plan.plaza ? plan.plaza.r - Math.hypot(x - plan.plaza.x, z - plan.plaza.z) : -1e3;
  // Phase A: pocket floors (+ walls) are paved with a crisp edge (the hall's themed floor and the arena sit on it)
  for (const p of c.pockets) {
    const [lx, lz] = toLocal(p, x, z);
    const inside = Math.min(p.hw - Math.abs(lx), p.hd - Math.abs(lz));
    if (inside > out.plaza) out.plaza = inside;
  }
  let rd = Infinity; let pathRd = Infinity;
  for (const r of c.roads) {
    const d = distToPolyline(r.points, x, z) - r.width / 2;
    if (r.kind === 'path') { if (d < pathRd) pathRd = d; } else if (d < rd) rd = d;
  }
  out.path = Math.max(-rd + n1 * 0.22, -pathRd + n1 * 0.15 - 0.05);
  const n3 = valueNoise(x * 0.35, z * 0.35, c.salt + 13);
  let detail = -rd + 0.02 + n1 * 0.22 + n3 * 0.6;                          // road fringe: broken, irregular
  detail = Math.max(detail, -pathRd + 0.35 + n1 * 0.2);
  for (const b of c.buildings) {
    const fd = footprintDistance(b, x, z);
    if (fd < 3) detail = Math.max(detail, 0.3 - fd + n1 * 0.25 + n3 * 0.45);
  }
  for (const w of plan.water) {
    const d = Math.hypot(x - w.cx, z - w.cz);
    if (d < w.r + 3) detail = Math.max(detail, w.r + 0.7 - d + n1 * 0.35 + n3 * 0.3);
  }
  for (const e of plan.grassPatches) if (inEllipse(e, x, z, 1.2)) detail = Math.max(detail, -0.2);   // keep patches green
  detail = Math.max(detail, (n2 - 0.86) * 3 + n1 * 0.2);                    // rare worn patches
  const edge = Math.max(Math.abs(x), Math.abs(z)) - (plan.half - FIELD_MARGIN);
  if (edge > 2) detail = Math.max(detail, (edge - 6) * 0.25 + n2 * 0.8);   // the margin's rougher ground
  out.detail = detail;
  return out;
}

/** True when scatter of radius `r` may stand at (x, z) (roads, plaza, buildings, water, points, set-piece, patches optional). */
export function scatterClear(c: SplatContext, x: number, z: number, r: number, allowPatches: boolean): boolean {
  const plan = c.plan;
  if (plan.plaza && Math.hypot(x - plan.plaza.x, z - plan.plaza.z) < plan.plaza.r + r + 0.8) return false;
  if (roadDistance(c.roads, x, z) < r + 0.4) return false;
  for (const b of c.buildings) if (footprintDistance(b, x, z) < r + 1.0) return false;
  for (const [px, pz] of plan.points) if (Math.hypot(px - x, pz - z) < r + 1.5) return false;
  for (const w of plan.water) if (Math.hypot(w.cx - x, w.cz - z) < w.r * 1.05 + r + 0.6) return false;
  if (inSetPiece(plan, x, z, r)) return false;
  if (!allowPatches) for (const e of plan.grassPatches) if (inEllipse(e, x, z, r + 0.5)) return false;
  return true;
}
