/**
 * SPEC §10.5.5 — layout (pure TypeScript, no `three` construction; node-tested).
 *
 * Two callers share these functions so they can never disagree:
 * - the client adapter (`zoneSpecFor`, 20-client.md §20.4.4) calls `planLayout`, then `planBuildings`,
 *   `planLights`, `planProps` with `createRng(zone.layoutSeed)` forks (its "seeded decisions");
 * - the zone builder calls `planLayout(spec)` again (same inputs → same plan) for roads, plaza, tall-grass
 *   patches, clearings and the terrain splat, and never moves anything the spec already placed.
 *
 * Layouts: `town` = cobble plaza r 14 at the origin, 6–10 buildings on a ring of radius 22–30 facing the plaza with
 * ≥ 4 m gaps, the gym in the north slot with its door at world (0, −26) (the server's hard-coded gym door),
 * shop/healer flanking the south road, 3.5 m gravel roads from the plaza to each edge; `route` = a 12 m corridor
 * along x with 3–5 tall-grass patches alternating sides, 2–3 clearings, the set-piece at the midpoint; `story` =
 * the set-piece at the origin on a paved platform, approach roads from each edge. Content positions (actors,
 * pickups, tablets, warps) are never moved: layout keeps buildings 2.5 m and scatter 1.5 m away from them.
 */
import type { BuildingSpec, Dir, Edge, HeightfieldData, Layout, Marker, PropPlacement, SetPieceId, TypeName } from '../contracts.js';
import type { LightKind, LightSource } from '../descriptors.js';
import { FIELD_MARGIN, heightClamped, waterBodies, type Bounds, type WaterBody } from '../terrain/field.js';
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

/** House / landmark roof kinds per biome (the adapter's `planBuildings` input). */
export const BIOME_ROOFS: Readonly<Record<string, { readonly houses: readonly BuildingSpec['roof'][]; readonly landmark: BuildingSpec['roof'] }>> = {
  grove: { houses: ['thatch', 'slate'], landmark: 'slate' },
  cinder: { houses: ['tile', 'slate'], landmark: 'plate' },
  salt: { houses: ['slate', 'thatch'], landmark: 'slate' },
  storm: { houses: ['slate', 'plate'], landmark: 'plate' },
  marrow: { houses: ['tile', 'plate'], landmark: 'slate' },
  vesper: { houses: ['slate', 'thatch'], landmark: 'slate' },
  forge: { houses: ['plate', 'slate'], landmark: 'plate' },
  sky: { houses: ['tile', 'slate'], landmark: 'tile' },
  capital: { houses: ['tile', 'slate'], landmark: 'tile' },
  shrine: { houses: ['slate'], landmark: 'slate' },
  rift: { houses: ['slate'], landmark: 'slate' },
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

/** Oriented rectangles overlap test (SAT), each inflated by `pad`. */
function rectsOverlap(a: Pick<BuildingSpec, 'x' | 'z' | 'yaw' | 'w' | 'd'>, b: Pick<BuildingSpec, 'x' | 'z' | 'yaw' | 'w' | 'd'>, pad: number): boolean {
  const corners = (r: typeof a): Vec2[] => {
    const hw = r.w / 2 + pad; const hd = r.d / 2 + pad;
    return [toWorld(r, -hw, -hd), toWorld(r, hw, -hd), toWorld(r, hw, hd), toWorld(r, -hw, hd)];
  };
  const ca = corners(a); const cb = corners(b);
  for (const r of [a, b]) {
    for (const [ax, az] of [[Math.cos(r.yaw), -Math.sin(r.yaw)], [Math.sin(r.yaw), Math.cos(r.yaw)]] as const) {
      let minA = Infinity; let maxA = -Infinity; let minB = Infinity; let maxB = -Infinity;
      for (const [x, z] of ca) { const p = x * ax + z * az; if (p < minA) minA = p; if (p > maxA) maxA = p; }
      for (const [x, z] of cb) { const p = x * ax + z * az; if (p < minB) minB = p; if (p > maxB) maxB = p; }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
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

/** §10.5.5 layout plan. Pure: identical inputs give an identical plan (the adapter and the builder both call it). */
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
    water, points, warpPairs: warpPairs(i.warps), roadZ,
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

// ---- buildings (adapter-side seeded decision) ----------------------------------------------------------

export interface BuildingPlanInput {
  readonly plan: ZoneLayoutPlan;
  readonly zoneId: string;
  readonly gym: boolean;
  readonly shop: boolean;
  readonly healer: boolean;
  readonly roofs: readonly BuildingSpec['roof'][];   // biome roof choices for houses (first = most common)
  readonly landmarkRoof: BuildingSpec['roof'];
}

const snap = (v: number, q = 0.25): number => Math.round(v / q) * q;
const u32 = (r: RngLike): number => Math.floor(r.next() * 4294967296) >>> 0;

function buildingFits(plan: ZoneLayoutPlan, b: BuildingSpec, placed: readonly BuildingSpec[], gap: number): boolean {
  const ih = plan.half - FIELD_MARGIN;
  const hw = b.w / 2; const hd = b.d / 2;
  for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as const) {
    const [x, z] = toWorld(b, lx, lz);
    if (Math.abs(x) > ih - 3 || Math.abs(z) > ih - 3) return false;
  }
  for (const [px, pz] of plan.points) if (footprintDistance(b, px, pz) < TOWN_LAYOUT.pointClearance) return false;
  // roads: sample the footprint (inflated 1 m) on a grid
  for (let gx = -1; gx <= 1; gx += 0.25) {
    for (let gz = -1; gz <= 1; gz += 0.25) {
      const [x, z] = toWorld(b, gx * (hw + 1), gz * (hd + 1));
      if (roadDistance(plan.roads, x, z) < 0.6) return false;
      if (plan.plaza && Math.hypot(x - plan.plaza.x, z - plan.plaza.z) < plan.plaza.r + 3) return false;
      for (const w of plan.water) if (Math.hypot(x - w.cx, z - w.cz) < w.r + 3.5) return false;
      if (inSetPiece(plan, x, z, 1)) return false;
    }
  }
  for (const p of placed) if (rectsOverlap(b, p, gap / 2)) return false;
  return true;
}

/** Faces the plaza centre: local +z (the door) points at (0, 0). */
function facingCentre(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

/**
 * Town buildings: the gym first (door exactly at world (0, −26), facing +z), shop and healer flanking the south
 * road, then houses around the ring until 6–10 buildings stand; warp doors get a hut whose door is the marker.
 */
export function planBuildings(i: BuildingPlanInput, rng: RngLike): BuildingSpec[] {
  const plan = i.plan;
  const out: BuildingSpec[] = [];
  const T = TOWN_LAYOUT;
  const pickRoof = (): BuildingSpec['roof'] => (i.roofs.length === 0 ? 'slate' : i.roofs[Math.min(i.roofs.length - 1, Math.floor(Math.pow(rng.next(), 1.3) * i.roofs.length))]!);

  const clearOfPoints = (b: BuildingSpec): boolean => plan.points.every(([px, pz]) => footprintDistance(b, px, pz) >= TOWN_LAYOUT.pointClearance + 0.1);
  for (const w of plan.warpPairs) {
    const hall = /hall|league/i.test(w.id);
    const [dx, dz] = w.door;
    const len = Math.hypot(dx, dz) || 1;
    const base = Math.atan2(-dx / len, -dz / len);           // front faces the zone centre first
    const seed = u32(rng);
    let chosen: BuildingSpec | null = null;
    for (const shrink of [1, 0.85, 0.7]) {
      for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
        const yaw = base + turn;
        const wW = (hall ? 12 : 6.5) * shrink; const wD = (hall ? 10 : 5.5) * shrink;
        const nx = Math.sin(yaw); const nz = Math.cos(yaw);
        const b: BuildingSpec = { id: `${i.zoneId}.warp.${w.id}`, kind: hall ? 'landmark' : 'house', x: snap(dx - nx * wD / 2, 0.01), z: snap(dz - nz * wD / 2, 0.01), yaw, w: snap(wW), d: snap(wD), floors: hall ? 2 : 1, roof: hall ? i.landmarkRoof : 'slate', seed };
        if (clearOfPoints(b)) { chosen = b; break; }
      }
      if (chosen) break;
    }
    if (chosen) out.push({ ...chosen, roof: hall ? i.landmarkRoof : pickRoof() });
  }

  if (plan.layout !== 'town') return out;

  if (i.gym) {
    // the door is fixed (the server's (0, −26)); the hall shrinks until every authored point is clear of it
    const [gx, gz] = T.gymDoor;
    const seed = u32(rng);
    let gym: BuildingSpec | null = null;
    for (let d = T.gymD; d >= 5 && gym === null; d -= 0.5) {
      for (let w = T.gymW; w >= 8 && gym === null; w -= 0.5) {
        const b: BuildingSpec = { id: `${i.zoneId}.gym`, kind: 'gym', x: gx, z: gz - d / 2, yaw: 0, w, d, floors: 2, roof: i.landmarkRoof, seed };
        if (clearOfPoints(b)) gym = b;
      }
    }
    out.push(gym ?? { id: `${i.zoneId}.gym`, kind: 'gym', x: gx, z: gz - T.gymD / 2, yaw: 0, w: T.gymW, d: T.gymD, floors: 2, roof: i.landmarkRoof, seed });
  }
  const lane = plan.roads.find((r) => r.id === 'road_s' || r.id === 'lane_s');
  const flank = (kind: 'shop' | 'healer', side: -1 | 1): void => {
    const w = kind === 'shop' ? 9 : 10; const d = kind === 'shop' ? 7 : 8;
    for (let attempt = 0; attempt < 16; attempt++) {
      const r = T.ringMin + d / 2 + (attempt % 4) * 1.5;
      const off = (lane ? lane.width / 2 : 1.75) + T.gap / 2 + w / 2 + Math.floor(attempt / 4) * 1.5;
      const a = Math.PI / 2 + side * Math.atan2(off, r);
      const x = Math.cos(a) * Math.hypot(r, off); const z = Math.sin(a) * Math.hypot(r, off);
      const b: BuildingSpec = { id: `${i.zoneId}.${kind}`, kind, x: snap(x, 0.01), z: snap(z, 0.01), yaw: facingCentre(x, z), w, d, floors: kind === 'healer' ? 2 : 1, roof: 'tile', seed: u32(rng) };
      if (buildingFits(plan, b, out, T.gap)) { out.push(b); return; }
    }
  };
  if (i.shop) flank('shop', -1);
  if (i.healer) flank('healer', 1);

  const target = T.buildings[0] + Math.floor(rng.next() * (T.buildings[1] - T.buildings[0] + 1));
  const start = rng.next() * Math.PI * 2;
  let idx = 0;
  for (let step = 0; step < 240 && out.length < target; step++) {
    const a = start + (step * Math.PI * 2) / 120;
    const w = snap(7 + rng.next() * 2.5); const d = snap(5.5 + rng.next() * 1.75);
    const r = T.ringMin + rng.next() * (T.ringMax - T.ringMin);
    const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    const b: BuildingSpec = { id: `${i.zoneId}.house${idx}`, kind: 'house', x: snap(x, 0.01), z: snap(z, 0.01), yaw: facingCentre(x, z), w, d, floors: rng.next() < 0.45 ? 2 : 1, roof: pickRoof(), seed: u32(rng) };
    if (buildingFits(plan, b, out, T.gap)) { out.push(b); idx++; }
  }
  return out;
}

/** Nearest point on a polyline to (x, z). */
function nearestOnPolyline(pts: readonly Vec2[], x: number, z: number): Vec2 {
  let best: Vec2 = pts[0]!; let bd = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!; const b = pts[i + 1]!;
    const dx = b[0] - a[0]; const dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a[0] + dx * t; const pz = a[1] + dz * t;
    const d = (px - x) * (px - x) + (pz - z) * (pz - z);
    if (d < bd) { bd = d; best = [px, pz]; }
  }
  return best;
}

/**
 * Door paths: a 1.6 m path from each building door to the nearest point of a road or of the plaza rim, leaving
 * the door straight out for 1.2 m first so it meets the step square-on.
 */
export function doorPaths(plan: ZoneLayoutPlan, buildings: readonly BuildingSpec[]): Road[] {
  const out: Road[] = [];
  for (const b of buildings) {
    const d = doorOf(b);
    const sx = d.x + d.nx * 1.2; const sz = d.z + d.nz * 1.2;
    let target: Vec2 | null = null; let td = Infinity;
    for (const r of plan.roads) {
      const q = nearestOnPolyline(r.points, sx, sz);
      const dist = Math.hypot(q[0] - sx, q[1] - sz);
      if (dist < td) { td = dist; target = q; }
    }
    if (plan.plaza) {
      const dx = sx - plan.plaza.x; const dz = sz - plan.plaza.z;
      const l = Math.hypot(dx, dz) || 1;
      const q: Vec2 = [plan.plaza.x + (dx / l) * (plan.plaza.r - 0.4), plan.plaza.z + (dz / l) * (plan.plaza.r - 0.4)];
      const dist = Math.hypot(q[0] - sx, q[1] - sz);
      if (dist < td) { td = dist; target = q; }
    }
    const pts: Vec2[] = [[d.x - d.nx * 0.2, d.z - d.nz * 0.2], [sx, sz]];
    if (target !== null && td < 24) pts.push(target); else pts.push([d.x + d.nx * 6, d.z + d.nz * 6]);
    out.push({ id: `path_${b.id}`, kind: 'path', width: TOWN_LAYOUT.pathWidth, points: pts });
  }
  return out;
}

// ---- lights (adapter-side seeded decision) --------------------------------------------------------------

export interface BiomeLightStyle {
  readonly kind: LightKind; readonly generator: 'lantern' | 'brazier' | 'crystal' | 'candle';
  readonly color: string; readonly intensity: number; readonly range: number;
  readonly flicker: { readonly amplitude: number; readonly hz: number } | null;
}

/** The biome light table (§20.4.4 "per the biome's light table"). */
export const BIOME_LIGHTS: Readonly<Record<string, BiomeLightStyle>> = {
  grove: { kind: 'lantern', generator: 'lantern', color: '#ffb35c', intensity: 40, range: 12, flicker: null },
  cinder: { kind: 'brazier', generator: 'brazier', color: '#ff8a3c', intensity: 22, range: 10, flicker: { amplitude: 0.12, hz: 5 } },
  salt: { kind: 'lantern', generator: 'lantern', color: '#ffd6a0', intensity: 40, range: 12, flicker: null },
  storm: { kind: 'crystal', generator: 'crystal', color: '#9fd0ff', intensity: 18, range: 10, flicker: null },
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
 * What a zone spends of the 8 / 24 budget: 1 shadow-casting light (each local caster re-renders its casters: a
 * draw-call decision, IMPLEMENTATION-NOTES Part 2) and ≤ 20 non-shadowing; the arena's 2 beacons are reserved.
 */
export const ZONE_LIGHT_CAP = { shadow: 1, nonShadow: 20 } as const;

export interface LightPlanInput {
  readonly plan: ZoneLayoutPlan;
  readonly zoneId: string;
  readonly biome: string;
  readonly heightfield: HeightfieldData;
  readonly buildings: readonly BuildingSpec[];
  readonly accentType: TypeName | null;
}

/**
 * Lanterns around the plaza and along the roads, beacons at the gym door, a lantern at shop / healer / some doors,
 * route lamps at the road ends and clearings, and the set-piece's own lights — within `ZONE_LIGHT_CAP`.
 */
export function planLights(i: LightPlanInput, rng: RngLike): LightSource[] {
  const plan = i.plan;
  const style = BIOME_LIGHTS[i.biome] ?? BIOME_LIGHTS.grove!;
  const out: LightSource[] = [];
  let shadow = 0; let nonShadow = 0;
  const taken: Vec2[] = [];
  const clear = (x: number, z: number): boolean => {
    for (const [px, pz] of plan.points) if (Math.hypot(px - x, pz - z) < 1.8) return false;
    for (const b of i.buildings) if (footprintDistance(b, x, z) < 1.0) return false;
    for (const w of plan.water) if (Math.hypot(w.cx - x, w.cz - z) < w.r + 1.5) return false;
    for (const [tx, tz] of taken) if (Math.hypot(tx - x, tz - z) < 5) return false;
    if (inSetPiece(plan, x, z, 0.8)) return false;
    return Math.abs(x) < plan.half - FIELD_MARGIN - 1 && Math.abs(z) < plan.half - FIELD_MARGIN - 1;
  };
  const add = (id: string, x: number, z: number, wantShadow: boolean, over?: Partial<Pick<LightSource, 'kind' | 'color' | 'intensity' | 'range'>> & { generator?: 'lantern' | 'brazier' | 'beacon' | 'crystal' | 'candle' }): boolean => {
    const cast = wantShadow && shadow < ZONE_LIGHT_CAP.shadow;
    if (!cast && nonShadow >= ZONE_LIGHT_CAP.nonShadow) return false;
    if (!clear(x, z)) return false;
    const gen = over?.generator ?? style.generator;
    const hl = HOUSING_LOCAL[gen];
    const y = heightClamped(i.heightfield, x, z) + hl[1];
    out.push({
      id: `${i.zoneId}.light.${id}`, kind: over?.kind ?? style.kind, color: over?.color ?? style.color, intensity: over?.intensity ?? style.intensity,
      position: [round3(x), round3(y), round3(z)], castShadow: cast, range: over?.range ?? style.range,
      housing: { kind: 'generated', generator: gen, seed: u32(rng) }, flicker: gen === 'beacon' ? null : style.flicker,
    });
    taken.push([x, z]);
    if (cast) shadow++; else nonShadow++;
    return true;
  };

  // set-piece lights first (their housings are part of the set-piece geometry)
  const sp = plan.setPiece;
  SET_PIECE_LIGHTS[sp.id].forEach((l, k) => {
    const [wx, wz] = toWorld(sp, l.local[0], l.local[2]);
    const y = heightClamped(i.heightfield, sp.x, sp.z) + l.local[1];
    const cast = l.castShadow && shadow < ZONE_LIGHT_CAP.shadow;
    out.push({ id: `${i.zoneId}.light.setpiece${k}`, kind: l.kind, color: l.color, intensity: l.intensity, position: [round3(wx), round3(y), round3(wz)], castShadow: cast, range: l.range, housing: { kind: 'mesh', meshId: `setpiece:${sp.id}:${k}` }, flicker: l.flicker });
    if (cast) shadow++; else nonShadow++;
  });

  if (plan.layout === 'town' && plan.plaza) {
    const base = Math.PI / 4 + (rng.next() - 0.5) * 0.2;
    for (let k = 0; k < 4; k++) {
      for (let t = 0; t < 5; t++) {
        const a = base + (k * Math.PI) / 2 + (t % 2 === 0 ? 1 : -1) * Math.ceil(t / 2) * 0.16;
        const r = plan.plaza.r + 1.3;
        if (add(`plaza${k}`, Math.cos(a) * r, Math.sin(a) * r, k === 1 || k === 2)) break;
      }
    }
    for (const b of i.buildings) {
      const d = doorOf(b);
      const sx = d.nz; const sz = -d.nx;                        // along the front wall
      if (b.kind === 'gym') {
        const color = i.accentType ? TYPE_ACCENT[i.accentType] : '#ffffff';
        for (const s of [-1, 1]) add(`gym_beacon${s < 0 ? 'L' : 'R'}`, d.x + sx * s * 4.2 + d.nx * 1.6, d.z + sz * s * 4.2 + d.nz * 1.6, false, { kind: 'beacon', generator: 'beacon', color, intensity: 30, range: 10 });
      }
    }
  }
  // roads: every ~15 m, alternating sides, from the plaza / platform to 8 m inside the edge
  for (const road of plan.roads) {
    if (road.kind === 'path') continue;
    let acc = 7; let side = rng.next() < 0.5 ? 1 : -1; let n = 0;
    const spacing = plan.layout === 'route' ? 42 : 15;
    for (let s = 0; s + 1 < road.points.length; s++) {
      const a = road.points[s]!; const b = road.points[s + 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (acc <= len) {
        const t = acc / len;
        const x = a[0] + (b[0] - a[0]) * t; const z = a[1] + (b[1] - a[1]) * t;
        const px = -(b[1] - a[1]) / len; const pz = (b[0] - a[0]) / len;
        const ox = x + px * side * (road.width / 2 + 1.1); const oz = z + pz * side * (road.width / 2 + 1.1);
        const inside = Math.max(Math.abs(ox), Math.abs(oz)) < plan.half - FIELD_MARGIN - HANDOVER_INSET - 2;
        if (inside && (plan.plaza === null || Math.hypot(ox, oz) > plan.plaza.r + 4) && add(`${road.id}_${n}`, ox, oz, false)) { n++; side = -side; }
        acc += spacing;
      }
      acc -= len;
    }
  }
  if (plan.layout === 'town') {
    for (const b of i.buildings) {
      if (b.kind === 'gym') continue;
      if (b.kind === 'house' && rng.next() < 0.5) continue;
      const d = doorOf(b);
      const s = rng.next() < 0.5 ? -1 : 1;
      add(`door_${b.id.split('.').pop()}`, d.x + d.nx * 1.5 + d.nz * s * 1.9, d.z + d.nz * 1.5 - d.nx * s * 1.9, false);
    }
  }
  for (const c of plan.clearings) add(`clearing_${Math.round(c.x)}`, c.x + c.r * 0.45, c.z, false);
  return out;
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

// ---- props (adapter-side seeded decision) ---------------------------------------------------------------

export interface PropPlanInput {
  readonly plan: ZoneLayoutPlan;
  readonly biome: string;
  readonly buildings: readonly BuildingSpec[];
  readonly lights: readonly LightSource[];
}

/**
 * Hand-placed props (§10.5.4 kinds): plaza benches and planters, a well, crates / barrels / a stall by the shop,
 * barrels beside houses, fenced garden plots, carts, signposts at every exit; logs, stumps and rocks at route
 * clearings; a camp by route actors. Pure given the rng.
 */
export function planProps(i: PropPlanInput, rng: RngLike): PropPlacement[] {
  const plan = i.plan;
  const out: PropPlacement[] = [];
  const clearOf = (x: number, z: number, r: number): boolean => {
    if (Math.max(Math.abs(x), Math.abs(z)) > plan.half - FIELD_MARGIN - 1.5) return false;
    for (const [px, pz] of plan.points) if (Math.hypot(px - x, pz - z) < 1.6 + r) return false;
    for (const b of i.buildings) if (footprintDistance(b, x, z) < r + 0.3) return false;
    for (const l of i.lights) if (Math.hypot(l.position[0] - x, l.position[2] - z) < r + 0.9) return false;
    for (const w of plan.water) if (Math.hypot(w.cx - x, w.cz - z) < w.r + r + 1.2) return false;
    for (const p of out) if (Math.hypot(p.x - x, p.z - z) < r + 0.9) return false;
    if (inSetPiece(plan, x, z, r)) return false;
    return true;
  };
  const put = (kind: string, x: number, z: number, yaw: number, r: number, scale = 1, needRoadClear = true): boolean => {
    if (!clearOf(x, z, r)) return false;
    if (needRoadClear && roadDistance(plan.roads, x, z) < r + 0.3) return false;
    out.push({ kind, x: round3(x), z: round3(z), yaw: round3(yaw), scale: round3(scale), seed: u32(rng) });
    return true;
  };

  if (plan.layout === 'town' && plan.plaza) {
    const P = plan.plaza;
    // benches facing the centre, planters between them
    const a0 = rng.next() * 0.4;
    for (let k = 0; k < 6; k++) {
      const a = a0 + (k * Math.PI * 2) / 6 + Math.PI / 6;
      const r = P.r - 1.6;
      const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      const yaw = Math.atan2(-x, -z) + Math.PI;               // seat faces the centre
      if (k % 2 === 0) put('bench', x, z, yaw, 1.1, 1, false); else put('planter', x, z, yaw, 0.9, 1, false);
    }
    // two market stalls on the plaza with crates and barrels round them
    for (let k = 0; k < 2; k++) {
      for (let t = 0; t < 6; t++) {
        const a = a0 + k * Math.PI + Math.PI / 2 + (t % 2 === 0 ? 1 : -1) * Math.ceil(t / 2) * 0.22;
        const r = P.r - 4.4;
        const x = Math.cos(a) * r; const z = Math.sin(a) * r;
        const yaw = Math.atan2(-x, -z);
        if (!put('stall', x, z, yaw, 1.8, 1, false)) continue;
        const sx = Math.cos(yaw); const sz = -Math.sin(yaw);
        for (let c = 0; c < 3; c++) put(rng.next() < 0.5 ? 'crate' : 'barrel', x + sx * (1.9 + c * 0.1) * (c === 1 ? -1 : 1) - Math.sin(yaw) * (0.9 + c * 0.35), z + sz * (1.9 + c * 0.1) * (c === 1 ? -1 : 1) - Math.cos(yaw) * (0.9 + c * 0.35), rng.next() * 6.28, 0.45, 1, false);
        break;
      }
    }
    // the well on the plaza street
    for (let t = 0; t < 16; t++) {
      const a = Math.PI * 1.15 + t * 0.4;
      if (put('well', Math.cos(a) * (P.r + 4.2), Math.sin(a) * (P.r + 4.2), rng.next() * Math.PI * 2, 1.4)) break;
    }
    for (const b of i.buildings) {
      const d = doorOf(b);
      const sx = d.nz; const sz = -d.nx;
      if (b.kind === 'shop') {
        const s = rng.next() < 0.5 ? -1 : 1;
        put('stall', d.x + d.nx * 3.2 + sx * s * 4.2, d.z + d.nz * 3.2 + sz * s * 4.2, b.yaw, 1.7);
        for (let k = 0; k < 3; k++) put('crate', d.x + d.nx * 0.9 - sx * s * (b.w / 2 - 0.6 - k * 0.8), d.z + d.nz * 0.9 - sz * s * (b.w / 2 - 0.6 - k * 0.8), b.yaw + (rng.next() - 0.5) * 0.6, 0.55);
        for (let k = 0; k < 2; k++) put('barrel', d.x + d.nx * 0.8 + sx * s * (b.w / 2 - 0.5 - k * 0.7), d.z + d.nz * 0.8 + sz * s * (b.w / 2 - 0.5 - k * 0.7), rng.next() * 6.28, 0.45);
      } else if (b.kind === 'house' || b.kind === 'healer') {
        // a front garden: two picket runs parallel to the facade either side of the door path, flowers inside
        if (b.kind === 'house' && rng.next() < 0.75) {
          for (const s2 of [-1, 1]) {
            const fx = d.x + d.nx * 2.9 + sx * s2 * 2.75; const fz = d.z + d.nz * 2.9 + sz * s2 * 2.75;
            put('fence', fx, fz, b.yaw, 0.3, 1, true);
            put('flower_patch', d.x + d.nx * 1.5 + sx * s2 * 2.2, d.z + d.nz * 1.5 + sz * s2 * 2.2, rng.next() * 6.28, 0.5, 1, true);
          }
        }
        // barrels / crates against a side wall
        if (rng.next() < 0.7) {
          const side = rng.next() < 0.5 ? -1 : 1;
          const [x, z] = toWorld(b, side * (b.w / 2 + 0.55), b.d / 2 - 1.0 - rng.next() * 1.5);
          put(rng.next() < 0.6 ? 'barrel' : 'crate', x, z, rng.next() * 6.28, 0.45);
          const [x2, z2] = toWorld(b, side * (b.w / 2 + 0.55), b.d / 2 - 2.2 - rng.next());
          if (rng.next() < 0.5) put('barrel', x2, z2, rng.next() * 6.28, 0.45);
        }
        // a fenced garden plot behind some houses
        if (b.kind === 'house' && rng.next() < 0.55) {
          const gw = 5.4; const gd = 3.6;
          const [cx, cz] = toWorld(b, (rng.next() - 0.5) * 1.5, -(b.d / 2 + 0.8 + gd / 2));
          const g = { x: cx, z: cz, yaw: b.yaw, w: gw, d: gd };
          let ok = true;
          for (let gx = -1; gx <= 1 && ok; gx += 0.5) for (let gz = -1; gz <= 1 && ok; gz += 0.5) {
            const [x, z] = toWorld(g, gx * (gw / 2 + 0.3), gz * (gd / 2 + 0.3));
            if (!clearOf(x, z, 0.2) || roadDistance(plan.roads, x, z) < 0.5) ok = false;
          }
          if (ok) out.push({ kind: 'garden', x: round3(cx), z: round3(cz), yaw: round3(b.yaw), scale: 1, seed: u32(rng) });
        }
      }
    }
    // a cart and a woodpile by the roads
    for (const road of plan.roads) {
      if (road.kind !== 'road') continue;
      const p = road.points[Math.min(road.points.length - 1, 3)]!;
      const q = road.points[Math.min(road.points.length - 1, 4)]!;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const px = -(q[1] - p[1]) / len; const pz = (q[0] - p[0]) / len;
      const yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
      if (!put('cart', p[0] + px * (road.width / 2 + 1.6), p[1] + pz * (road.width / 2 + 1.6), yaw + 0.2, 1.4)) put('cart', p[0] - px * (road.width / 2 + 1.6), p[1] - pz * (road.width / 2 + 1.6), yaw - 0.2, 1.4);
    }
  }
  // signposts at every exit (road ends, 9 m inside the playable edge)
  const ih = plan.half - FIELD_MARGIN - 9;
  for (const road of plan.roads) {
    if (road.kind !== 'road') continue;
    for (const fromEnd of [true, false]) {
      const pts = fromEnd ? road.points : [...road.points].reverse();
      if (Math.max(Math.abs(pts[pts.length - 1]![0]), Math.abs(pts[pts.length - 1]![1])) < ih) continue;   // this end is inside (plaza side)
      for (let s = pts.length - 1; s > 0; s--) {
        const p = pts[s]!; const q = pts[s - 1]!;
        if (Math.max(Math.abs(q[0]), Math.abs(q[1])) > ih) continue;
        const len = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
        const px = -(p[1] - q[1]) / len; const pz = (p[0] - q[0]) / len;
        const yaw = Math.atan2(p[0] - q[0], p[1] - q[1]);
        const side = rng.next() < 0.5 ? 1 : -1;
        if (!put('sign', q[0] + px * side * (road.width / 2 + 0.9), q[1] + pz * side * (road.width / 2 + 0.9), yaw, 0.6)) {
          put('sign', q[0] - px * side * (road.width / 2 + 0.9), q[1] - pz * side * (road.width / 2 + 0.9), yaw, 0.6);
        }
        break;
      }
    }
  }
  if (plan.layout === 'route') {
    for (const c of plan.clearings) {
      put('log', c.x + (rng.next() - 0.5) * c.r, c.z + (rng.next() - 0.5) * c.r * 0.6, rng.next() * Math.PI, 1.8);
      put('stump', c.x + (rng.next() - 0.5) * c.r, c.z + (rng.next() - 0.5) * c.r, rng.next() * 6.28, 0.6);
      put('rock_m', c.x + (rng.next() - 0.5) * c.r * 1.2, c.z + (rng.next() - 0.5) * c.r, rng.next() * 6.28, 1.0);
    }
    // wayside fences along the road near both ends
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const x = sx * (plan.half - FIELD_MARGIN - 22 - k * 3.8);
        const zc = plan.roadZ(x);
        put('fence', x, zc + (rng.next() < 0.5 ? 1 : -1) * (ROUTE_LAYOUT.roadWidth / 2 + 1.4), Math.PI / 2, 0.4);
      }
    }
  }
  return out;
}

// ---- the terrain splat (builder) ------------------------------------------------------------------------

/** Signed layer fields at a point (positive = inside): the terrain mesh splits triangles on their zero lines. */
export interface SplatFields { plaza: number; path: number; detail: number }

export interface SplatContext {
  readonly plan: ZoneLayoutPlan;
  readonly roads: readonly Road[];            // plan.roads + door paths
  readonly buildings: readonly BuildingSpec[];
  readonly salt: number;
}

export function createSplatContext(plan: ZoneLayoutPlan, buildings: readonly BuildingSpec[], seed: number): SplatContext {
  return { plan, roads: [...plan.roads, ...doorPaths(plan, buildings)], buildings, salt: seed & 0xffff };
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
