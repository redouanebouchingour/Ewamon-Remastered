/**
 * Zone sculpts: the hand-authored macro shape of a zone (`data/sculpts.ts`), applied by `buildTerrainField` on top of
 * the biome noise and read again by the plan (`plan.ts`), so the server's walkable mask and the client's terrain see
 * the same cliffs, rivers and roads.
 *
 * A sculpt is a short list of shapes: lifts (plateaus, terraces, basins, mesas, spires) with cliff or slope edges,
 * hills, rivers and lakes (water bodies of any outline), and the roads that wind through them. A road is flattened to
 * a profile that never climbs steeper than `ROAD_GRADE`, so a road crossing a cliff cuts its own ramp; where it
 * crosses water the samples become a bridge deck (walkable and water, like a pond's boardwalk).
 *
 * Pure and deterministic: + − × ÷, Math.sqrt / floor / round / abs / min / max only (no transcendental functions), so
 * the heightfield digest stays identical in Node and in a browser.
 */
import type { ZoneKind } from './types';

export type SVec2 = readonly [number, number];

/** A raised (h > 0) or sunken (h < 0) region: plateau, terrace, basin, mesa or spire. */
export interface SculptLift {
  /** outline (closed polygon, any winding) … */
  readonly poly?: readonly SVec2[];
  /** … or a circle … */
  readonly circle?: { readonly x: number; readonly z: number; readonly r: number };
  /** … or a stroke along a Catmull-Rom centreline (ridges, ravines, embankments, walls) */
  readonly line?: { readonly points: readonly SVec2[]; readonly width: number };
  /**
   * Roads span it level instead of climbing in and out (a ravine a road bridges, a wall a road gates through): the
   * road profile is interpolated straight across its samples, and the road's bed then makes the crossing.
   */
  readonly bridged?: boolean;
  /** What render builds on it: a stone curtain wall or a stake palisade along a line, a round tower on a circle. */
  readonly dress?: 'wall' | 'palisade' | 'tower';
  /** metres added inside */
  readonly h: number;
  /**
   * Width of the edge falloff (m). The steepest slope is ≈ 1.5·|h|/edge: below ≈ 2.1·|h| the edge is a cliff
   * (not walkable, painted rock), above it a walkable bank.
   */
  readonly edge: number;
  /** Ragged outline: the edge wanders by up to this many metres (value noise, 9 m cells). Default 0. */
  readonly ragged?: number;
}

/** A smooth dome (no cliff): rolling hills, dunes, mounds. */
export interface SculptHill { readonly x: number; readonly z: number; readonly r: number; readonly h: number }

/** A river or stream: a channel carved to one flat level along a Catmull-Rom centreline. */
export interface SculptRiver {
  readonly points: readonly SVec2[];
  /** channel width at the waterline (m) */
  readonly width: number;
  /** bed depth under the surface at the centreline (m) */
  readonly depth: number;
  /** bank blend width (m); default 3 */
  readonly bank?: number;
}

/** A lake, mire or sea: the polygon is dug to one level, open water inside, a beach / shore blend outside. */
export interface SculptLake {
  readonly poly: readonly SVec2[];
  readonly depth: number;
  /** shore blend width outside the outline (m); default 6 */
  readonly shore?: number;
  /** Ragged outline (m). Default 0. */
  readonly ragged?: number;
}

export type SculptRoadKind = 'road' | 'lane' | 'path';

/** A road, lane or trail: control points (Catmull-Rom), drawn by render and flattened into the terrain. */
export interface SculptRoad {
  readonly id: string;
  readonly kind: SculptRoadKind;
  readonly width: number;
  readonly points: readonly SVec2[];
}

/** A tall-grass patch (an ellipse: centre, radii, yaw in radians). */
export interface SculptGrass { readonly x: number; readonly z: number; readonly rx: number; readonly rz: number; readonly yaw?: number }

/** A hand-placed prop (`PROP_SOLID_RADIUS` decides whether it blocks). */
export interface SculptProp { readonly kind: string; readonly x: number; readonly z: number; readonly yaw?: number; readonly scale?: number }

export interface ZoneSculpt {
  /** Biome noise amplitude multiplier (default 1). */
  readonly rough?: number;
  /** Random biome ponds to place (default: the biome's count). */
  readonly ponds?: number;
  readonly lifts?: readonly SculptLift[];
  readonly hills?: readonly SculptHill[];
  readonly rivers?: readonly SculptRiver[];
  readonly lakes?: readonly SculptLake[];
  /**
   * Roads. A route's `road_main` replaces the generated meander (it must run from the west edge (−120, 0) to the east
   * edge (120, 0)); a town's `road_<dir>` / `lane_s` replaces that generated road; anything else is an extra trail.
   */
  readonly roads?: readonly SculptRoad[];
  /** Route / story tall grass: replaces the generated patches. */
  readonly grass?: readonly SculptGrass[];
  /** Where the set-piece stands (default: on the main road nearest x = 0, along it). */
  readonly setPiece?: { readonly x: number; readonly z: number; readonly yaw: number };
  /** Fence runs (a picket every 3.7 m along each polyline). */
  readonly fences?: readonly (readonly SVec2[])[];
  readonly props?: readonly SculptProp[];
  /** Scattered outcrops: rocky knolls, mounds or spires, placed from `seed` clear of roads, water, points and each other. */
  readonly outcrops?: readonly SculptOutcrops[];
}

export interface SculptOutcrops {
  readonly n: number;
  readonly r: readonly [number, number];
  readonly h: readonly [number, number];
  /** edge width as a fraction of the height: < 1.4 cliffed (default 0.7), ≥ 2.2 a walkable mound */
  readonly edge?: number;
  readonly ragged?: number;
  readonly seed: number;
  /** where they may stand (default: the playable interior) */
  readonly area?: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number };
  /** and only this far from the zone centre (a town keeps its streets clear) */
  readonly ring?: readonly [number, number];
  /** keep this far off the x and z axes (a town's or story zone's generated roads run along them) */
  readonly axes?: number;
}

// ─── geometry ────────────────────────────────────────────────────────────────

const sqrt = Math.sqrt;

export function smooth01(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/** Uniform Catmull-Rom through `ctrl` (ends repeated), sampled so no step exceeds `step` metres. */
export function sampleSpline(ctrl: readonly SVec2[], step = 2): SVec2[] {
  if (ctrl.length < 2) return ctrl.map((p) => [p[0], p[1]] as SVec2);
  const out: SVec2[] = [[ctrl[0]![0], ctrl[0]![1]]];
  for (let i = 0; i + 1 < ctrl.length; i++) {
    const p0 = ctrl[Math.max(0, i - 1)]!; const p1 = ctrl[i]!; const p2 = ctrl[i + 1]!; const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]!;
    const dx = p2[0] - p1[0]; const dz = p2[1] - p1[1];
    const n = Math.max(1, Math.ceil(sqrt(dx * dx + dz * dz) / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n; const t2 = t * t; const t3 = t2 * t;
      const a = -0.5 * t3 + t2 - 0.5 * t; const b = 1.5 * t3 - 2.5 * t2 + 1; const c = -1.5 * t3 + 2 * t2 + 0.5 * t; const d = 0.5 * t3 - 0.5 * t2;
      const x = a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0];
      const z = a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1];
      out.push([Math.round(x * 1000) / 1000, Math.round(z * 1000) / 1000]);
    }
  }
  return out;
}

/** Distance from (x, z) to segment ab and the segment parameter t of the nearest point. */
function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): { d: number; t: number } {
  const dx = bx - ax; const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - x; const qz = az + dz * t - z;
  return { d: sqrt(qx * qx + qz * qz), t };
}

/** Signed distance to a polygon outline: negative inside (even-odd), positive outside. */
export function polySignedDistance(poly: readonly SVec2[], x: number, z: number): number {
  let best = Infinity;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!; const b = poly[j]!;
    const d = segDist(x, z, a[0], a[1], b[0], b[1]).d;
    if (d < best) best = d;
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? -best : best;
}

function liftSignedDistance(l: SculptLift, x: number, z: number, line: readonly SVec2[] | null): number {
  if (l.poly !== undefined) return polySignedDistance(l.poly, x, z);
  if (line !== null) {
    let best = Infinity;
    for (let i = 0; i + 1 < line.length; i++) {
      const d = segDist(x, z, line[i]![0], line[i]![1], line[i + 1]![0], line[i + 1]![1]).d;
      if (d < best) best = d;
    }
    return best - l.line!.width / 2;
  }
  const c = l.circle!;
  const dx = x - c.x; const dz = z - c.z;
  return sqrt(dx * dx + dz * dz) - c.r;
}

/** Axis-aligned bounds of a lift's outline. */
function liftBounds(l: SculptLift, line: readonly SVec2[] | null): { x0: number; x1: number; z0: number; z1: number } {
  if (line !== null) {
    let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
    for (const [x, z] of line) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const w = l.line!.width / 2;
    return { x0: x0 - w, x1: x1 + w, z0: z0 - w, z1: z1 + w };
  }
  if (l.poly !== undefined) {
    let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
    for (const [x, z] of l.poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    return { x0, x1, z0, z1 };
  }
  const c = l.circle!;
  return { x0: c.x - c.r, x1: c.x + c.r, z0: c.z - c.r, z1: c.z + c.r };
}

// ─── the field pass ──────────────────────────────────────────────────────────

/** The steepest grade a road profile climbs (rise per metre). */
export const ROAD_GRADE = 0.3;
/** Width of the blend from a road's flat bed to the terrain beside it (m). */
const ROAD_SHOULDER: Readonly<Record<SculptRoadKind, number>> = { road: 4.5, lane: 3.5, path: 2.5 };

export interface FieldGrid {
  readonly res: number;
  readonly originX: number;
  readonly originZ: number;
  readonly step: number;
}

/** A bridge: the run of a road's centreline that crosses open water. */
export interface SculptBridge {
  readonly road: string;
  /** the centreline from bank to bank (≈ 2 m apart) … */
  readonly points: readonly SVec2[];
  /** … and the deck height at each (the road profile: the walkable samples under it) */
  readonly ys: readonly number[];
  readonly width: number;
}

export interface SculptResult {
  /** the roads as sampled polylines (what the plan and render draw) */
  readonly roads: readonly { readonly id: string; readonly kind: SculptRoadKind; readonly width: number; readonly points: readonly SVec2[] }[];
  readonly bridges: readonly SculptBridge[];
  /** Cliffed round lifts (authored spires and the scattered outcrops): render dresses each with a faceted rock. */
  readonly crags: readonly SculptCrag[];
  /** Dressed lifts: curtain walls, palisades (sampled crest lines) and towers (one point, width = diameter). */
  readonly structures: readonly SculptStructure[];
}

export interface SculptCrag { readonly x: number; readonly z: number; readonly r: number; readonly h: number }
export interface SculptStructure { readonly kind: 'wall' | 'palisade' | 'tower'; readonly points: readonly SVec2[]; readonly width: number; readonly h: number }

/**
 * Applies the sculpt's lifts, hills, water and roads to `raw` (heights, float64, row-major) and marks `water` /
 * `boardwalk`. `jitter(x, z)` is the zone's value noise in [−1, 1] (for ragged outlines).
 */
export function applySculpt(
  g: FieldGrid,
  raw: Float64Array,
  water: Uint8Array,
  boardwalk: Uint8Array,
  s: ZoneSculpt,
  jitter: (x: number, z: number) => number,
  points: readonly SVec2[] = [],
): SculptResult {
  const { res, originX, originZ, step } = g;
  const colOf = (x: number): number => Math.round((x - originX) / step);
  const rowOf = (z: number): number => Math.round((z - originZ) / step);
  const clampC = (c: number): number => (c < 0 ? 0 : c > res - 1 ? res - 1 : c);
  const heightAt = (x: number, z: number): number => {
    const c = clampC(colOf(x)); const r = clampC(rowOf(z));
    return raw[r * res + c]!;
  };

  // 1. lifts (additive): plateaus, terraces, basins, mesas, spires: the authored ones, then the scattered outcrops
  const allLifts = [...(s.lifts ?? []), ...placeOutcrops(s, -originX - 16, points)];
  const liftLines = allLifts.map((l) => (l.line !== undefined && l.poly === undefined ? sampleSpline(l.line.points, 2) : null));
  allLifts.forEach((l, li) => {
    const line = liftLines[li]!;
    const b = liftBounds(l, line);
    const reach = l.edge + (l.ragged ?? 0) + 1;
    const c0 = clampC(colOf(b.x0 - reach)); const c1 = clampC(colOf(b.x1 + reach));
    const r0 = clampC(rowOf(b.z0 - reach)); const r1 = clampC(rowOf(b.z1 + reach));
    for (let row = r0; row <= r1; row++) {
      const z = originZ + row * step;
      for (let col = c0; col <= c1; col++) {
        const x = originX + col * step;
        let sd = liftSignedDistance(l, x, z, line);
        if (l.ragged !== undefined) sd += jitter(x / 9, z / 9) * l.ragged;
        // full height from `edge / 2` inside the outline to nothing `edge / 2` outside
        const t = smooth01((l.edge / 2 - sd) / l.edge);
        if (t > 0) raw[row * res + col] = raw[row * res + col]! + l.h * t;
      }
    }
  });
  /** True inside a bridged lift's outline grown by its edge (where a road spans level). */
  const spanned = (x: number, z: number): boolean => {
    for (let li = 0; li < allLifts.length; li++) {
      const l = allLifts[li]!;
      if (l.bridged !== true) continue;
      let sd = liftSignedDistance(l, x, z, liftLines[li]!);
      if (l.ragged !== undefined) sd += jitter(x / 9, z / 9) * l.ragged;
      if (sd < l.edge) return true;
    }
    return false;
  };

  // 2. hills: smooth domes
  for (const hl of s.hills ?? []) {
    const c0 = clampC(colOf(hl.x - hl.r)); const c1 = clampC(colOf(hl.x + hl.r));
    const r0 = clampC(rowOf(hl.z - hl.r)); const r1 = clampC(rowOf(hl.z + hl.r));
    for (let row = r0; row <= r1; row++) {
      const z = originZ + row * step;
      for (let col = c0; col <= c1; col++) {
        const x = originX + col * step;
        const dx = x - hl.x; const dz = z - hl.z;
        const d = sqrt(dx * dx + dz * dz);
        if (d >= hl.r) continue;
        raw[row * res + col] = raw[row * res + col]! + hl.h * smooth01(1 - d / hl.r);
      }
    }
  }

  // 3. road profiles, from the dry terrain (before any water is dug): smoothed, then grade-limited both ways
  const roads = (s.roads ?? []).map((r) => ({ id: r.id, kind: r.kind, width: r.width, points: sampleSpline(r.points, 2) }));
  const profiles = roads.map((r) => {
    const n = r.points.length;
    const h0 = new Float64Array(n);
    const len = new Float64Array(n);
    const skip = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const p = r.points[i]!;
      h0[i] = heightAt(p[0], p[1]);
      if (spanned(p[0], p[1])) skip[i] = 1;
      if (i > 0) {
        const q = r.points[i - 1]!;
        const dx = p[0] - q[0]; const dz = p[1] - q[1];
        len[i] = len[i - 1]! + sqrt(dx * dx + dz * dz);
      }
    }
    // across a bridged lift the profile runs straight from bank to bank
    for (let i = 0; i < n; i++) {
      if (skip[i] === 0) continue;
      let j = i;
      while (j < n && skip[j] === 1) j++;
      const a = i > 0 ? i - 1 : -1; const b = j < n ? j : -1;
      for (let k = i; k < j; k++) {
        if (a >= 0 && b >= 0) h0[k] = h0[a]! + ((h0[b]! - h0[a]!) * (len[k]! - len[a]!)) / Math.max(1e-6, len[b]! - len[a]!);
        else if (a >= 0) h0[k] = h0[a]!;
        else if (b >= 0) h0[k] = h0[b]!;
      }
      i = j;
    }
    // a moving average over ±7 m of path
    const sm = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0; let k = 0;
      for (let j = i; j >= 0 && len[i]! - len[j]! <= 7; j--) { sum += h0[j]!; k++; }
      for (let j = i + 1; j < n && len[j]! - len[i]! <= 7; j++) { sum += h0[j]!; k++; }
      sm[i] = sum / k;
    }
    for (let i = 1; i < n; i++) {
      const lim = (len[i]! - len[i - 1]!) * ROAD_GRADE;
      if (sm[i]! > sm[i - 1]! + lim) sm[i] = sm[i - 1]! + lim;
      if (sm[i]! < sm[i - 1]! - lim) sm[i] = sm[i - 1]! - lim;
    }
    for (let i = n - 2; i >= 0; i--) {
      const lim = (len[i + 1]! - len[i]!) * ROAD_GRADE;
      if (sm[i]! > sm[i + 1]! + lim) sm[i] = sm[i + 1]! + lim;
      if (sm[i]! < sm[i + 1]! - lim) sm[i] = sm[i + 1]! - lim;
    }
    return sm;
  });

  // 4. lakes: dug to one level (the lowest dry point of the outline), open water inside, a shore blend outside
  for (const lk of s.lakes ?? []) {
    let lvl = Infinity;
    for (let i = 0, j = lk.poly.length - 1; i < lk.poly.length; j = i++) {
      const a = lk.poly[i]!; const b = lk.poly[j]!;
      const dx = b[0] - a[0]; const dz = b[1] - a[1];
      const n = Math.max(1, Math.ceil(sqrt(dx * dx + dz * dz) / 2));
      for (let k = 0; k < n; k++) {
        const x = a[0] + (dx * k) / n; const z = a[1] + (dz * k) / n;
        if (Math.abs(x) > -originX || Math.abs(z) > -originZ) continue;
        const y = heightAt(x, z);
        if (y < lvl) lvl = y;
      }
    }
    if (lvl === Infinity) lvl = 0;
    lvl -= 0.25;
    const shore = lk.shore ?? 6;
    let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
    for (const [x, z] of lk.poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const reach = shore + (lk.ragged ?? 0) + 1;
    const c0 = clampC(colOf(x0 - reach)); const c1 = clampC(colOf(x1 + reach));
    const r0 = clampC(rowOf(z0 - reach)); const r1 = clampC(rowOf(z1 + reach));
    for (let row = r0; row <= r1; row++) {
      const z = originZ + row * step;
      for (let col = c0; col <= c1; col++) {
        const x = originX + col * step;
        let sd = polySignedDistance(lk.poly, x, z);
        if (lk.ragged !== undefined) sd += jitter(x / 9 + 31, z / 9 + 17) * lk.ragged;
        const i = row * res + col;
        if (sd < 0) {
          // the bed falls over the first 7 m inside the outline
          raw[i] = lvl + 0.3 - (lk.depth + 0.3) * smooth01(-sd / 7);
          if (sd < -0.75) water[i] = 1;
        } else if (sd < shore) {
          const t = smooth01(sd / shore);
          const beach = lvl + 0.3;
          raw[i] = beach + (raw[i]! - beach) * t;
        }
      }
    }
  }

  // 5. rivers: one flat level per river (the lowest point of its course), banks blended down to it
  for (const rv of s.rivers ?? []) {
    const pts = sampleSpline(rv.points, 2);
    let lvl = Infinity;
    for (const [x, z] of pts) {
      if (Math.abs(x) > -originX - 1 || Math.abs(z) > -originZ - 1) continue;
      const y = heightAt(x, z);
      if (y < lvl) lvl = y;
    }
    if (lvl === Infinity) lvl = 0;
    lvl -= 0.35;
    const hw = rv.width / 2;
    const bank = rv.bank ?? 3;
    const reach = hw + bank + 1;
    const best = new Map<number, number>();
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k]!; const b = pts[k + 1]!;
      const c0 = clampC(colOf(Math.min(a[0], b[0]) - reach)); const c1 = clampC(colOf(Math.max(a[0], b[0]) + reach));
      const r0 = clampC(rowOf(Math.min(a[1], b[1]) - reach)); const r1 = clampC(rowOf(Math.max(a[1], b[1]) + reach));
      for (let row = r0; row <= r1; row++) {
        const z = originZ + row * step;
        for (let col = c0; col <= c1; col++) {
          const x = originX + col * step;
          const d = segDist(x, z, a[0], a[1], b[0], b[1]).d;
          if (d >= reach) continue;
          const i = row * res + col;
          const prev = best.get(i);
          if (prev === undefined || d < prev) best.set(i, d);
        }
      }
    }
    const keys = [...best.keys()].sort((p, q) => p - q);
    for (const i of keys) {
      const d = best.get(i)!;
      if (d < hw) {
        const u = d / hw;
        raw[i] = lvl + 0.3 - (rv.depth + 0.3) * (1 - u * u);
        if (u < 0.92) water[i] = 1;
      } else if (d < hw + bank) {
        const t = smooth01((d - hw) / bank);
        const beach = lvl + 0.3;
        raw[i] = beach + (raw[i]! - beach) * t;
      }
    }
  }

  // 6. roads: flatten to the profile; over water the road's own width becomes a bridge deck
  const bridges: SculptBridge[] = [];
  roads.forEach((r, ri) => {
    const prof = profiles[ri]!;
    const hw = r.width / 2;
    const shoulder = ROAD_SHOULDER[r.kind];
    const reach = hw + 0.5 + shoulder;
    const best = new Map<number, { d: number; y: number }>();
    for (let k = 0; k + 1 < r.points.length; k++) {
      const a = r.points[k]!; const b = r.points[k + 1]!;
      const c0 = clampC(colOf(Math.min(a[0], b[0]) - reach)); const c1 = clampC(colOf(Math.max(a[0], b[0]) + reach));
      const r0 = clampC(rowOf(Math.min(a[1], b[1]) - reach)); const r1 = clampC(rowOf(Math.max(a[1], b[1]) + reach));
      for (let row = r0; row <= r1; row++) {
        const z = originZ + row * step;
        for (let col = c0; col <= c1; col++) {
          const x = originX + col * step;
          const sg = segDist(x, z, a[0], a[1], b[0], b[1]);
          if (sg.d >= reach) continue;
          const i = row * res + col;
          const prev = best.get(i);
          if (prev === undefined || sg.d < prev.d) best.set(i, { d: sg.d, y: prof[k]! + (prof[k + 1]! - prof[k]!) * sg.t });
        }
      }
    }
    const keys = [...best.keys()].sort((p, q) => p - q);
    for (const i of keys) {
      const { d, y } = best.get(i)!;
      if (water[i] === 1) {
        // open water beside a bridge keeps its bed; the deck itself is walkable water
        if (d <= hw + 0.25) { raw[i] = y; boardwalk[i] = 1; }
        continue;
      }
      const t = smooth01((d - hw - 0.5) / shoulder);
      raw[i] = y + (raw[i]! - y) * t;
    }
    // the bridges: runs of the centreline over water
    let start = -1;
    for (let k = 0; k <= r.points.length; k++) {
      const p = r.points[Math.min(k, r.points.length - 1)]!;
      const c = colOf(p[0]); const rr = rowOf(p[1]);
      const wet = k < r.points.length && c >= 0 && rr >= 0 && c < res && rr < res && water[rr * res + c] === 1;
      if (wet && start < 0) start = k;
      if (!wet && start >= 0) {
        const i0 = Math.max(0, start - 1); const i1 = Math.min(r.points.length - 1, k);
        const pts: SVec2[] = []; const ys: number[] = [];
        for (let j = i0; j <= i1; j++) { pts.push(r.points[j]!); ys.push(Math.round(prof[j]! * 64) / 64); }
        bridges.push({ road: r.id, points: pts, ys, width: r.width + 0.6 });
        start = -1;
      }
    }
  });

  const crags: SculptCrag[] = [];
  const structures: SculptStructure[] = [];
  allLifts.forEach((l, li) => {
    if (l.dress === 'tower' && l.circle !== undefined) structures.push({ kind: 'tower', points: [[l.circle.x, l.circle.z]], width: l.circle.r * 2, h: l.h });
    else if ((l.dress === 'wall' || l.dress === 'palisade') && liftLines[li] !== null) structures.push({ kind: l.dress, points: sampleSpline(l.line!.points, 1.6), width: l.line!.width, h: l.h });
    else if (l.circle !== undefined && l.h > 0 && l.edge < 1.4 * l.h) crags.push({ x: l.circle.x, z: l.circle.z, r: l.circle.r, h: l.h });
  });
  return { roads, bridges, crags, structures };
}

/** A small deterministic generator (xorshift32 over an integer seed): outcrop placement only. */
function xorshift(seed: number): () => number {
  let x = (seed | 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/** The sculpt's outcrops as circle lifts, clear of its roads, rivers, lakes, the authored points and each other. */
export function placeOutcrops(s: ZoneSculpt, ih: number, points: readonly SVec2[]): SculptLift[] {
  const out: SculptLift[] = [];
  if (s.outcrops === undefined) return out;
  const lines = [...(s.roads ?? []).map((r) => ({ pts: sampleSpline(r.points, 3), w: r.width / 2 })), ...(s.rivers ?? []).map((r) => ({ pts: sampleSpline(r.points, 3), w: r.width / 2 }))];
  const placed: { x: number; z: number; r: number }[] = [];
  for (const o of s.outcrops) {
    const rnd = xorshift(o.seed);
    const a = o.area ?? { x0: -ih, x1: ih, z0: -ih, z1: ih };
    let made = 0;
    for (let attempt = 0; attempt < o.n * 40 && made < o.n; attempt++) {
      const r = o.r[0] + rnd() * (o.r[1] - o.r[0]);
      const h = o.h[0] + rnd() * (o.h[1] - o.h[0]);
      const x = Math.round((a.x0 + r + rnd() * (a.x1 - a.x0 - 2 * r)) * 4) / 4;
      const z = Math.round((a.z0 + r + rnd() * (a.z1 - a.z0 - 2 * r)) * 4) / 4;
      if (Math.abs(x) > ih - r - 2 || Math.abs(z) > ih - r - 2) continue;
      if (o.ring !== undefined) { const d = Math.sqrt(x * x + z * z); if (d < o.ring[0] + r || d > o.ring[1] - r) continue; }
      if (o.axes !== undefined && (Math.abs(x) < o.axes + r || Math.abs(z) < o.axes + r)) continue;
      let ok = true;
      for (const [px, pz] of points) if ((px - x) * (px - x) + (pz - z) * (pz - z) < (r + 10) * (r + 10)) { ok = false; break; }
      for (let k = 0; ok && k < lines.length; k++) {
        const ln = lines[k]!;
        for (let i = 0; i + 1 < ln.pts.length; i++) {
          const p = ln.pts[i]!; const q = ln.pts[i + 1]!;
          if (segDist(x, z, p[0], p[1], q[0], q[1]).d < r + ln.w + 6) { ok = false; break; }
        }
      }
      for (const lk of s.lakes ?? []) if (ok && polySignedDistance(lk.poly, x, z) < r + 6) ok = false;
      for (const l of s.lifts ?? []) if (ok && l.circle !== undefined && Math.sqrt((l.circle.x - x) ** 2 + (l.circle.z - z) ** 2) < l.circle.r + r + 6) ok = false;
      for (const q of placed) if (ok && (q.x - x) * (q.x - x) + (q.z - z) * (q.z - z) < (q.r + r + 6) * (q.r + r + 6)) ok = false;
      if (s.setPiece !== undefined && ok && (s.setPiece.x - x) ** 2 + (s.setPiece.z - z) ** 2 < (r + 18) * (r + 18)) ok = false;
      if (!ok) continue;
      placed.push({ x, z, r });
      out.push({ circle: { x, z, r }, h: Math.round(h * 64) / 64, edge: Math.max(0.6, h * (o.edge ?? 0.7)), ragged: o.ragged ?? Math.min(2, r * 0.35) });
      made++;
    }
  }
  return out;
}

/** Field extents by zone kind (the sculpt data's sanity checks). */
export function sculptHalf(kind: ZoneKind): number {
  return kind === 'town' ? 80 : kind === 'route' ? 120 : 100;
}
