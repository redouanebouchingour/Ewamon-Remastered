/**
 * SPEC §10.6 — terrain = collision.
 *
 * `TerrainCollider` samples content's heightfield (`HeightfieldData`, passed through unchanged by the client) with
 * exactly the arithmetic of content's `sampleHeight` / `isWalkable` / `isWater` (§3.11), so what render shows,
 * what the client predicts and what the server validates are one array. Render never writes `heights`, `walkable`
 * or `water`.
 *
 * Addition (IMPLEMENTATION-NOTES.md, Part 2): content's heightfield does not (yet) mark building / prop footprints
 * unwalkable (§3.11 says it should), so the zone builder registers **blockers** (oriented rectangles for
 * buildings, circles for trunks, rocks, posts) and `resolveMove` tests `passable = walkable && !blocked`.
 * `walkable()` itself stays byte-identical to content (the `collider.test.ts` contract). A client that treats a
 * house as solid is only ever stricter than the server, so prediction never lands somewhere the server refuses.
 */
import { Vector3 } from 'three/webgpu';
import type { HeightfieldData } from '../contracts.js';
import { FIELD_MARGIN, heightAt, heightClamped, inField, walkableAt, waterAt, type Bounds } from './field.js';

export { FIELD_MARGIN } from './field.js';
export type { Bounds } from './field.js';

/** Oriented rectangle blocker (buildings): centre, half extents, yaw (radians, rotation about +Y). */
export interface RectBlocker { readonly kind: 'rect'; readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly yaw: number }
/** Circle blocker (trunks, rocks, posts). */
export interface CircleBlocker { readonly kind: 'circle'; readonly x: number; readonly z: number; readonly r: number }
export type Blocker = RectBlocker | CircleBlocker;

const DEG = 180 / Math.PI;
const CELL = 4;

export class TerrainCollider {
  readonly bounds: Bounds;
  /** The full field extent (margin included). */
  readonly field: Bounds;
  private readonly h: HeightfieldData;
  private readonly blockers: Blocker[] = [];
  private readonly grid = new Map<number, number[]>();
  private readonly _n = new Vector3();

  constructor(h: HeightfieldData) {
    this.h = h;
    this.field = { minX: h.originX, maxX: h.originX + h.size, minZ: h.originZ, maxZ: h.originZ + h.size };
    this.bounds = {
      minX: h.originX + FIELD_MARGIN, maxX: h.originX + h.size - FIELD_MARGIN,
      minZ: h.originZ + FIELD_MARGIN, maxZ: h.originZ + h.size - FIELD_MARGIN,
    };
  }

  get heightfield(): HeightfieldData { return this.h; }

  /** Bilinear over the 4 surrounding samples (identical to content's sampleHeight). NaN outside the field. */
  sample(x: number, z: number): number { return heightAt(this.h, x, z); }

  /** Height clamped into the field (for geometry that must never read NaN: skirts, props near the edge). */
  sampleClamped(x: number, z: number): number { return heightClamped(this.h, x, z); }

  /** Central differences over ±step; normalised; writes into `out` (no allocation). Up outside the field. */
  normal(x: number, z: number, out: Vector3): Vector3 {
    if (!inField(this.h, x, z)) return out.set(0, 1, 0);
    const s = this.h.step;
    const hx = (this.sampleClamped(x + s, z) - this.sampleClamped(x - s, z)) / (2 * s);
    const hz = (this.sampleClamped(x, z + s) - this.sampleClamped(x, z - s)) / (2 * s);
    return out.set(-hx, 1, -hz).normalize();
  }

  /** Nearest sample's walkable bit; false outside. Identical to content's isWalkable. */
  walkable(x: number, z: number): boolean { return walkableAt(this.h, x, z); }

  /** Nearest sample's water bit; false outside. Identical to content's isWater. */
  water(x: number, z: number): boolean { return waterAt(this.h, x, z); }

  /** Slope in degrees at (x, z) from `normal`. */
  slopeDeg(x: number, z: number): number {
    const n = this.normal(x, z, this._n);
    return Math.acos(Math.min(1, Math.max(-1, n.y))) * DEG;
  }

  // ---- blockers (addition) ------------------------------------------------------------------------------

  /** Registers a footprint the movement solver treats as solid (the zone builder calls this). */
  addBlocker(b: Blocker): void {
    const i = this.blockers.length;
    this.blockers.push(b);
    const r = b.kind === 'circle' ? b.r : Math.hypot(b.hw, b.hd);
    const c0 = Math.floor((b.x - r) / CELL); const c1 = Math.floor((b.x + r) / CELL);
    const r0 = Math.floor((b.z - r) / CELL); const r1 = Math.floor((b.z + r) / CELL);
    for (let cz = r0; cz <= r1; cz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const k = cellKey(cx, cz);
        let list = this.grid.get(k);
        if (list === undefined) { list = []; this.grid.set(k, list); }
        list.push(i);
      }
    }
  }

  blockerCount(): number { return this.blockers.length; }

  /** True when (x, z) lies inside a registered blocker. */
  blocked(x: number, z: number): boolean {
    const list = this.grid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (list === undefined) return false;
    for (let k = 0; k < list.length; k++) {
      const b = this.blockers[list[k]!]!;
      if (b.kind === 'circle') {
        const dx = x - b.x; const dz = z - b.z;
        if (dx * dx + dz * dz < b.r * b.r) return true;
      } else {
        const dx = x - b.x; const dz = z - b.z;
        const c = Math.cos(b.yaw); const s = Math.sin(b.yaw);
        // world → local (inverse rotation about +Y): local x = c·dx − s·dz, local z = s·dx + c·dz
        const lx = c * dx - s * dz;
        const lz = s * dx + c * dz;
        if (Math.abs(lx) < b.hw && Math.abs(lz) < b.hd) return true;
      }
    }
    return false;
  }

  /** `walkable && !blocked` — what the movement solver may stand on. */
  passable(x: number, z: number): boolean {
    return this.walkable(x, z) && !this.blocked(x, z);
  }

  /** Nearest passable sample centre within `radius` metres (0.5 m ring spiral); null when none. */
  nearestPassable(x: number, z: number, radius: number): readonly [number, number] | null {
    const h = this.h;
    const col0 = Math.round((x - h.originX) / h.step);
    const row0 = Math.round((z - h.originZ) / h.step);
    const K = Math.ceil(radius / h.step);
    let best: [number, number] | null = null;
    let bestD2 = radius * radius;
    const consider = (row: number, col: number): void => {
      if (row < 0 || col < 0 || row >= h.res || col >= h.res) return;
      const sx = h.originX + col * h.step;
      const sz = h.originZ + row * h.step;
      if (!this.passable(sx, sz)) return;
      const d2 = (sx - x) * (sx - x) + (sz - z) * (sz - z);
      if (d2 <= bestD2 && (best === null || d2 < bestD2)) { bestD2 = d2; best = [sx, sz]; }
    };
    for (let k = 0; k <= K; k++) {
      if (best !== null && (k - 1) * h.step > Math.sqrt(bestD2)) break;
      if (k === 0) { consider(row0, col0); continue; }
      for (let d = -k; d <= k; d++) { consider(row0 - k, col0 + d); consider(row0 + k, col0 + d); }
      for (let d = -k + 1; d <= k - 1; d++) { consider(row0 + d, col0 - k); consider(row0 + d, col0 + k); }
    }
    return best;
  }
}

function cellKey(cx: number, cz: number): number {
  return (cx + 4096) * 8192 + (cz + 4096);
}

// ---- §10.6.2 movement solver -----------------------------------------------------------------------------

/** SPEC §10.6.2, verbatim. `capsuleRadius` = protocol `MOVEMENT.radius`. */
export const MOVER = { capsuleRadius: 0.35, capsuleHeight: 1.7, stepHeight: 0.4, slopeLimitDeg: 40, skin: 0.02 } as const;

/** SPEC §10.6.2, verbatim. */
export interface MoveResult { readonly x: number; readonly z: number; readonly y: number; readonly blocked: boolean; readonly slid: boolean }

/** Mutable result for the allocation-free variant. */
export interface MoveResultMut { x: number; z: number; y: number; blocked: boolean; slid: boolean }

/**
 * Rule-4 probe directions relative to the desired direction, smallest angle first: ±22.5°, ±45°, ±67.5°, ±90°
 * (IMPLEMENTATION-NOTES Part 4, H9 — never backwards, never farther than the step).
 */
const PROBE_ANGLES: readonly number[] = [22.5, -22.5, 45, -45, 67.5, -67.5, 90, -90].map((d) => (d * Math.PI) / 180);
const PROBE_COS: readonly number[] = PROBE_ANGLES.map(Math.cos);
const PROBE_SIN: readonly number[] = PROBE_ANGLES.map(Math.sin);

function accepts(c: TerrainCollider, fromY: number, x: number, z: number): boolean {
  if (!c.passable(x, z)) return false;
  const y = c.sample(x, z);
  if (!(y - fromY <= MOVER.stepHeight)) return false;
  return c.slopeDeg(x, z) <= MOVER.slopeLimitDeg;
}

/**
 * §10.6.2 rules in order: (1) target; (2) accept when passable, step ≤ 0.4 m and slope ≤ 40°; (3) the two
 * axis-separated moves; (4) 8 probes AT THE STEP LENGTH around the START, ±22.5° … ±90° from the desired direction,
 * the first (smallest angle) that passes; (5) stay. If the start itself is not passable (spawned into a blocker), the
 * solver steps toward the nearest passable sample within 4 m by at most the step length.
 *
 * Invariant (IMPLEMENTATION-NOTES Part 4, H9): the returned position is never farther than `hypot(dx, dz)` from
 * the start. The SPEC's rule 4 probed the capsule radius around the TARGET (up to step + 0.35 m) and the escape
 * returned the nearest sample outright (up to 4 m); the server rejects any step over its speed cap and kicks after
 * 30 rejections, which live two-player runs hit at walls. Allocation-free: writes into `out`.
 */
export function resolveMoveInto(out: MoveResultMut, c: TerrainCollider, fromX: number, fromZ: number, dx: number, dz: number): MoveResultMut {
  const fromY = c.sample(fromX, fromZ);
  const tx = fromX + dx;
  const tz = fromZ + dz;
  out.blocked = false; out.slid = false;
  if (accepts(c, fromY, tx, tz)) return finish(out, c, tx, tz);
  if (dx !== 0 && accepts(c, fromY, fromX + dx, fromZ)) { out.slid = true; return finish(out, c, fromX + dx, fromZ); }
  if (dz !== 0 && accepts(c, fromY, fromX, fromZ + dz)) { out.slid = true; return finish(out, c, fromX, fromZ + dz); }
  const len = Math.hypot(dx, dz);
  if (len > 0) {
    const ux = dx / len; const uz = dz / len;
    for (let k = 0; k < PROBE_ANGLES.length; k++) {
      const co = PROBE_COS[k]!; const si = PROBE_SIN[k]!;
      const px = fromX + (ux * co - uz * si) * len;
      const pz = fromZ + (ux * si + uz * co) * len;
      if (accepts(c, fromY, px, pz)) { out.slid = true; return finish(out, c, px, pz); }
    }
  }
  out.blocked = true;
  if (c.passable(fromX, fromZ)) return finish(out, c, fromX, fromZ);
  const near = len > 0 ? c.nearestPassable(fromX, fromZ, 4) : null;
  if (near !== null) {
    const ex = near[0] - fromX; const ez = near[1] - fromZ;
    const el = Math.hypot(ex, ez);
    const k = el > len ? len / el : 1;                 // walk out of the blocker, one step at a time
    return finish(out, c, fromX + ex * k, fromZ + ez * k);
  }
  return finish(out, c, fromX, fromZ);
}

function finish(out: MoveResultMut, c: TerrainCollider, x: number, z: number): MoveResultMut {
  out.x = x; out.z = z;
  const y = c.sample(x, z);
  out.y = Number.isFinite(y) ? y : 0;
  return out;
}

/** SPEC §10.6.2, verbatim signature. Pure. Resolves a desired xz displacement against the collider. */
export function resolveMove(c: TerrainCollider, fromX: number, fromZ: number, dx: number, dz: number): MoveResult {
  return resolveMoveInto({ x: 0, z: 0, y: 0, blocked: false, slid: false }, c, fromX, fromZ, dx, dz);
}
