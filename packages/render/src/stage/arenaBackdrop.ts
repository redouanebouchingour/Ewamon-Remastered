/**
 * The PvP arena backdrop: a compact stadium bowl around a battle ring dressed at the world origin, for battles fought
 * "outside the world" (no zone loaded). The client registers `root` as the scene's zone root (`setZoneRoot`) and
 * dresses the stage at (0, 0) with `ARENA_BACKDROP.terrain`; the backdrop then gets the normal sun / hemisphere / CSM /
 * fog treatment and the stage's two beacons light the ring as anywhere else.
 *
 * Look (the Broadcast direction): near-black carbon surfaces, paper-white lines, one hot orange (`ARENA_COLORS.accent`)
 * used only on the parapet's light line, the LED ribbon's chevrons and the screens' centre mark; no green. Parts:
 * - a dark polished floor slab out to the parapet (procedural slab seams, polished between them) with paper-white
 *   markings: a line round the stage's curb, a tick crown and an outer line in front of the parapet;
 * - a 1.1 m parapet carrying an animated LED ribbon board under the orange line, then 18 stepped tiers with bench rows
 *   and 12 aisles (grey step nosings), a concourse, a back wall with a second ribbon and four big screens, a
 *   cantilevered canopy with a light ring on its underside, four floodlight masts, and dark ground outside;
 * - an instanced seated crowd (one draw, 1 854 figures) that bobs and rolls a wave round the bowl every ~8 s — all in
 *   the vertex shader on a time uniform (`update` writes one float).
 *
 * The geometry is shaped by the battle camera (camera/battle.ts): the camera orbits the ring centre at a fixed −28°
 * pitch, 12–22 m out (+3 m on the 'wide' cue), so it always sits on the cone h = r·tan 28°. Every tier is laid on that
 * slope with the crowd's heads `cameraClearM` below it, and the concourse / back wall / canopy stay outside or above
 * the farthest camera; no part of the backdrop ever crosses the camera → battler corridor at any yaw (rotationally
 * symmetric). Inside `clearRadius` (the parapet face) the floor is flat and empty: the ring, curb, posts, beacon pylons,
 * trainers (4.45 m) and the stage's spectators (5.9 m) all stand on it.
 *
 * Budget: 5 meshes / 5 beauty draws (structure, floor, glow lines + lamps, LED panels, crowd) + the structure in the
 * sun's shadow cascades (the only caster); measured in the sandbox +5 beauty / +11 total draws. No textures, no punctual
 * lights (the emissive strips feed the bloom instead), 5 materials. `dispose` frees every geometry and material it made.
 */
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh,
  MeshStandardNodeMaterial, Quaternion, Vector3,
} from 'three/webgpu';
import type { Material, Node, Object3D, UniformNode } from 'three/webgpu';
import {
  abs, atan, attribute, cos, float, fract, fwidth, instancedBufferAttribute, length, max, mix, positionLocal, positionWorld, sin, smoothstep,
  step, uniform, uv, vec3,
} from 'three/tsl';
import type { Terrain } from '../contracts.js';
import type { LightingPalette } from '../lighting/daycycle.js';
import type { GradePalette } from '../post/grade.js';
import { BATTLE_DISTANCE_MAX, BATTLE_PITCH, CAMERA_WORK } from '../camera/battle.js';
import { mulberry32 } from './vfx.js';

// ---- numbers -------------------------------------------------------------------------------------------------------

const DEG = Math.PI / 180;
const TAN_PITCH = Math.tan(-BATTLE_PITCH * DEG);

export const ARENA_BACKDROP = Object.freeze({
  /** The stage terrain the client dresses the ring with in the arena (`stage.dress({x: 0, z: 0}, terrain, …)`): castle granite + the Steel accent. */
  terrain: 'forge' as Terrain,
  /** Recommended time of day in the arena (0..1): 21:30, a night match under the lights. */
  timeOfDay: 21.5 / 24,
  /** The floor is flat and empty inside this radius (m): the parapet's inner face. */
  clearRadius: 6.6,
  /** The polished floor slab runs from under the ring's curb to the parapet. */
  floorInner: 3.6,
  parapetHeight: 1.1, parapetDepth: 0.35,
  /** Tiers: the first tread sits behind the parapet; each is `tierDepth` deep and `tierRise` higher (the camera cone's slope). */
  tierCount: 18, tierDepth: 0.85, tierRise: 0.85 * TAN_PITCH, firstTreadY: 0.55,
  /** Bench on each tread (front offset, depth, height). */
  benchFront: 0.22, benchDepth: 0.36, benchHeight: 0.42,
  /** Aisles: count, first aisle bearing (deg), clear width (m). */
  aisles: 12, aisleOffsetDeg: 15, aisleWidth: 1.3,
  /** Crowd: seat pitch along a row (m), occupancy, the seated figure's height (m), the wave's lift (m), seed. */
  seatPitch: 0.62, occupancy: 0.9, figureHeight: 1.12, waveLift: 0.34, bobLift: 0.05, crowdSeed: 0x5eed_a7e,
  /** The wave: angular speed (rad/s) and the share of the bowl it lifts at once. */
  waveSpeed: 0.75, waveWidth: 0.07,
  /** Concourse depth behind the last tier, back wall top, canopy (inner edge, underside, thickness, outer radius). */
  concourseDepth: 1.75, backWallTop: 13.4, canopyInner: 19.5, canopyThick: 0.6, outerRadius: 25,
  /** Dark ground outside the bowl out to this radius. */
  groundRadius: 90,
  /** Floodlight masts: radius, height, bearings (deg). */
  mastRadius: 27.5, mastHeight: 24, mastBearingsDeg: [45, 135, 225, 315] as const,
  /** The LED ribbon on the parapet face (y range) and the upper ribbon on the back wall. */
  ribbonY: [0.22, 0.92] as const, upperRibbonY: [8.1, 9.0] as const,
  /** Four big screens on the back wall: bearings (deg), arc width (m), y range. */
  screenBearingsDeg: [0, 90, 180, 270] as const, screenWidth: 9, screenY: [9.5, 12.9] as const,
  /** Revolved segments (full circle). */
  segments: 96,
  /** Clearance kept between the crowd's heads and the battle camera's cone (m). */
  cameraClearM: 2.0,
});

/** Broadcast palette (sRGB): carbon, paper, the one hot orange. */
export const ARENA_COLORS = Object.freeze({
  carbon: '#18181c', paper: '#f5f3ee', accent: '#ff5b1f',
});

/** A neutral night-venue lighting palette for the arena (the client sets it through the host while no zone is loaded). */
export const ARENA_LIGHTING: LightingPalette = Object.freeze({
  skyZenith: '#7f8aa0',
  skyHorizon: '#c9ccd4',
  groundBounce: '#2a2a30',
  fogColor: ['#0d0e12', '#b9bcc4'] as const,
  fogDensity: 0.0025,
  fogStart: 24,
  fogBase: 0,
  fogFalloff: 0.35,
});

/** A neutral grade with a cool night lift (no green cast). */
export const ARENA_GRADE: GradePalette = Object.freeze({
  lift: [0.004, 0.004, 0.006] as const,
  gamma: [1, 1, 1] as const,
  gain: [1.02, 1.01, 1.0] as const,
  nightLift: [0.006, 0.006, 0.014] as const,
});

/** The farthest the battle camera gets from the ring centre: BATTLE_DISTANCE_MAX plus the 'wide' cue's pull-back. */
export const ARENA_CAMERA_MAX_DISTANCE = BATTLE_DISTANCE_MAX + Math.max(0, -(CAMERA_WORK.wide.push?.distance ?? 0));

export interface ArenaBackdrop {
  readonly root: Object3D;
  /** Advances the crowd / LED animation clock (seconds; pass the scaled frame time so hitstop freezes it). */
  update(dtSeconds: number): void;
  dispose(): void;
}

// ---- geometry builder ------------------------------------------------------------------------------------------------

const _c = new Color();
function lin(hex: string): [number, number, number] {
  _c.set(hex);   // ColorManagement: sRGB hex → linear working space
  return [_c.r, _c.g, _c.b];
}

/** Non-indexed triangle soup with position / normal / colour / uv and one float extra (`ewaGlow` or `ewaPanel`). */
class Soup {
  readonly pos: number[] = []; readonly nor: number[] = []; readonly col: number[] = []; readonly uvs: number[] = []; readonly extra: number[] = [];

  private vert(p: readonly number[], n: readonly number[], c: readonly number[], u: number, v: number, e: number): void {
    this.pos.push(p[0]!, p[1]!, p[2]!); this.nor.push(n[0]!, n[1]!, n[2]!); this.col.push(c[0]!, c[1]!, c[2]!); this.uvs.push(u, v); this.extra.push(e);
  }

  /**
   * Quad a b c d (with per-vertex normals and uvs), wound so the face normal agrees with the mean normal.
   */
  quad(p: readonly (readonly number[])[], n: readonly (readonly number[])[], c: readonly number[], uv4: readonly (readonly [number, number])[], e = 0): void {
    const [a, b, d] = [p[0]!, p[1]!, p[3]!];
    const ux = b[0]! - a[0]!; const uy = b[1]! - a[1]!; const uz = b[2]! - a[2]!;
    const vx = d[0]! - a[0]!; const vy = d[1]! - a[1]!; const vz = d[2]! - a[2]!;
    const fx = uy * vz - uz * vy; const fy = uz * vx - ux * vz; const fz = ux * vy - uy * vx;
    let mx = 0; let my = 0; let mz = 0;
    for (const q of n) { mx += q[0]!; my += q[1]!; mz += q[2]!; }
    const order = fx * mx + fy * my + fz * mz >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const i of order) this.vert(p[i]!, n[i]!, c, uv4[i]![0], uv4[i]![1], e);
  }

  /** A flat quad (one normal). */
  flat(p: readonly (readonly number[])[], normal: readonly number[], c: readonly number[], e = 0, uv4: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [1, 1], [0, 1]]): void {
    this.quad(p, [normal, normal, normal, normal], c, uv4, e);
  }

  /**
   * Revolves the profile segment (r0, y0) → (r1, y1) about +y between bearings a0..a1 (rad) in `segs` steps. The visible
   * side is on the left of the direction of travel: inner → outer faces up, upward faces the centre. Normals are smooth
   * round the circle and flat along the profile; u = arc length (m) at the vertex's radius, v = profile length (m), or
   * both 0..1 with `unitUv`.
   */
  revolve(r0: number, y0: number, r1: number, y1: number, c: readonly number[], a0: number, a1: number, segs: number, e = 0, unitUv = false): void {
    const dr = r1 - r0; const dy = y1 - y0;
    const L = Math.hypot(dr, dy) || 1;
    const nr = -dy / L; const ny = dr / L;
    for (let j = 0; j < segs; j++) {
      const t0 = a0 + ((a1 - a0) * j) / segs; const t1 = a0 + ((a1 - a0) * (j + 1)) / segs;
      const c0 = Math.cos(t0); const s0 = Math.sin(t0); const c1 = Math.cos(t1); const s1 = Math.sin(t1);
      const p = [[r0 * c0, y0, r0 * s0], [r0 * c1, y0, r0 * s1], [r1 * c1, y1, r1 * s1], [r1 * c0, y1, r1 * s0]];
      const n = [[nr * c0, ny, nr * s0], [nr * c1, ny, nr * s1], [nr * c1, ny, nr * s1], [nr * c0, ny, nr * s0]];
      const uv4: [number, number][] = unitUv
        ? [[j / segs, 0], [(j + 1) / segs, 0], [(j + 1) / segs, 1], [j / segs, 1]]
        : [[r0 * t0, 0], [r0 * t1, 0], [r1 * t1, L], [r1 * t0, L]];
      this.quad(p, n, c, uv4, e);
    }
  }

  /** An axis-aligned box (centre, size) turned by `yaw` about +y, flat-shaded. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, yaw: number, c: readonly number[], e = 0): void {
    const cs = Math.cos(yaw); const sn = Math.sin(yaw);
    const w = (x: number, y: number, z: number): number[] => [cx + x * cs + z * sn, cy + y, cz - x * sn + z * cs];
    const r = (x: number, y: number, z: number): number[] => [x * cs + z * sn, y, -x * sn + z * cs];
    const hx = sx / 2; const hy = sy / 2; const hz = sz / 2;
    this.flat([w(-hx, -hy, hz), w(hx, -hy, hz), w(hx, hy, hz), w(-hx, hy, hz)], r(0, 0, 1), c, e);
    this.flat([w(hx, -hy, -hz), w(-hx, -hy, -hz), w(-hx, hy, -hz), w(hx, hy, -hz)], r(0, 0, -1), c, e);
    this.flat([w(hx, -hy, hz), w(hx, -hy, -hz), w(hx, hy, -hz), w(hx, hy, hz)], r(1, 0, 0), c, e);
    this.flat([w(-hx, -hy, -hz), w(-hx, -hy, hz), w(-hx, hy, hz), w(-hx, hy, -hz)], r(-1, 0, 0), c, e);
    this.flat([w(-hx, hy, hz), w(hx, hy, hz), w(hx, hy, -hz), w(-hx, hy, -hz)], [0, 1, 0], c, e);
    this.flat([w(-hx, -hy, -hz), w(hx, -hy, -hz), w(hx, -hy, hz), w(-hx, -hy, hz)], [0, -1, 0], c, e);
  }

  build(extraName: string | null): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    if (extraName !== null) g.setAttribute(extraName, new BufferAttribute(new Float32Array(this.extra), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Radius of the front edge of tier `i`'s tread, and the tread's height. */
export function tierFront(i: number): number {
  const A = ARENA_BACKDROP;
  return A.clearRadius + A.parapetDepth + i * A.tierDepth;
}
export function tierY(i: number): number {
  const A = ARENA_BACKDROP;
  return A.firstTreadY + i * A.tierRise;
}

/** Bearings (rad) of the aisle centre lines. */
function aisleBearings(): number[] {
  const A = ARENA_BACKDROP;
  return Array.from({ length: A.aisles }, (_, k) => (A.aisleOffsetDeg + (360 / A.aisles) * k) * DEG);
}

/** Arc distance (m) at radius r from bearing `a` to the nearest aisle centre line. */
function aisleDistance(a: number, r: number, aisles: readonly number[]): number {
  let best = Infinity;
  for (const b of aisles) {
    let d = Math.abs(a - b) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    best = Math.min(best, d * r);
  }
  return best;
}

const TWO_PI = Math.PI * 2;

/** The carbon bowl: parapet, tiers with benches, concourse, back wall, canopy, outer wall, outer ground, masts. */
function structureGeometry(): BufferGeometry {
  const A = ARENA_BACKDROP;
  const s = new Soup();
  const N = A.segments;
  const C = {
    parapet: lin('#0f0f12'), cap: lin('#26272c'), tread: lin('#1c1d21'), riser: lin('#121215'), bench: lin('#2c2e35'), benchTop: lin('#34363e'),
    concourse: lin('#1a1b1f'), wall: lin('#111114'), canopy: lin('#141518'), canopyTop: lin('#202125'), outer: lin('#17181b'), ground: lin('#0e0f11'),
    mast: lin('#2a2b30'), head: lin('#1a1b1f'), aisle: lin('#2a2b31'),
  };
  const R0 = A.clearRadius; const R1 = R0 + A.parapetDepth; const H = A.parapetHeight;
  // parapet: face (up, facing the ring), cap, back face (down to the first tread)
  s.revolve(R0, 0, R0, H, C.parapet, 0, TWO_PI, N);
  s.revolve(R0, H, R1, H, C.cap, 0, TWO_PI, N);
  s.revolve(R1, H, R1, tierY(0), C.parapet, 0, TWO_PI, N);
  // tiers: tread (full circle) and riser; benches (front, top, back, ends) between the aisles
  const aisles = aisleBearings();
  const perSector = Math.max(2, Math.round(N / A.aisles));
  for (let i = 0; i < A.tierCount; i++) {
    const f = tierFront(i); const y = tierY(i); const b0 = f + A.benchFront; const b1 = b0 + A.benchDepth; const back = f + A.tierDepth;
    s.revolve(f, y, back, y, C.tread, 0, TWO_PI, N);
    s.revolve(back, y, back, i + 1 < A.tierCount ? tierY(i + 1) : tierY(i) + A.tierRise, C.riser, 0, TWO_PI, N);
    const yb = y + A.benchHeight;
    for (let k = 0; k < aisles.length; k++) {
      const half = (A.aisleWidth / 2) / ((b0 + b1) / 2);
      const a0 = aisles[k]! + half; const a1 = (k + 1 < aisles.length ? aisles[k + 1]! : aisles[0]! + TWO_PI) - half;
      s.revolve(b0, y, b0, yb, C.bench, a0, a1, perSector);
      s.revolve(b0, yb, b1, yb, C.benchTop, a0, a1, perSector);
      s.revolve(b1, yb, b1, y, C.bench, a0, a1, perSector);
      // the two bench ends facing the aisles
      for (const [a, sgn] of [[a0, -1], [a1, 1]] as const) {
        const ca = Math.cos(a); const sa = Math.sin(a);
        const nx = -sa * sgn; const nz = ca * sgn;
        s.flat([[b0 * ca, y, b0 * sa], [b1 * ca, y, b1 * sa], [b1 * ca, yb, b1 * sa], [b0 * ca, yb, b0 * sa]], [nx, 0, nz], C.bench);
      }
    }
  }
  // aisle stairs: a lighter step strip along every aisle (slightly proud of the treads), a half step per tier
  for (const b of aisles) {
    for (let i = 0; i < A.tierCount; i++) {
      const f = tierFront(i); const y = tierY(i) + 0.012; const back = f + A.tierDepth;
      const half = (A.aisleWidth / 2) / ((f + back) / 2);
      // two half-steps per tier (aisle stairs): tread at y and a mid step at y + rise/2
      const mid = f + A.tierDepth / 2; const ym = y + A.tierRise / 2;
      s.revolve(f, y, mid, y, C.aisle, b - half, b + half, 1);
      s.revolve(mid, y, mid, ym, C.riser, b - half, b + half, 1);
      s.revolve(mid, ym, back, ym, C.aisle, b - half, b + half, 1);
    }
  }
  const rb = tierFront(A.tierCount); const yc = tierY(A.tierCount - 1) + A.tierRise;
  const rw = rb + A.concourseDepth;
  s.revolve(rb, yc, rw, yc, C.concourse, 0, TWO_PI, N);
  s.revolve(rw, yc, rw, A.backWallTop, C.wall, 0, TWO_PI, N);
  // canopy: underside inward, lip, top outward; then the outer wall down to the ground and the ground outside
  const ct = A.backWallTop + A.canopyThick;
  s.revolve(A.outerRadius, A.backWallTop, A.canopyInner, A.backWallTop, C.canopy, 0, TWO_PI, N);
  s.revolve(A.canopyInner, A.backWallTop, A.canopyInner, ct, C.canopy, 0, TWO_PI, N);
  s.revolve(A.canopyInner, ct, A.outerRadius, ct, C.canopyTop, 0, TWO_PI, N);
  s.revolve(A.outerRadius, ct, A.outerRadius, 0, C.outer, 0, TWO_PI, N);
  s.revolve(A.outerRadius, 0, A.groundRadius, 0, C.ground, 0, TWO_PI, N);
  // floodlight masts: a column and a head frame turned to the ring
  for (const deg of A.mastBearingsDeg) {
    const a = deg * DEG; const x = Math.cos(a) * A.mastRadius; const z = Math.sin(a) * A.mastRadius;
    const yaw = Math.atan2(-x, -z);
    s.box(x, A.mastHeight / 2, z, 0.7, A.mastHeight, 0.7, yaw, C.mast);
    s.box(x - Math.cos(a) * 0.3, A.mastHeight + 0.6, z - Math.sin(a) * 0.3, 4.2, 2.6, 0.5, yaw, C.head);
  }
  return s.build(null);
}

/** The polished slab between the ring's curb and the parapet. */
function floorGeometry(): BufferGeometry {
  const s = new Soup();
  s.revolve(ARENA_BACKDROP.floorInner, 0, ARENA_BACKDROP.clearRadius, 0, lin(ARENA_COLORS.carbon), 0, TWO_PI, ARENA_BACKDROP.segments);
  return s.build(null);
}

/**
 * Emissive lines and lamps (`ewaGlow` = emissive gain): floor markings (paper), the orange ring line, the parapet's
 * top edge, aisle nosings, the canopy's light ring, the floodlight lamp grids.
 */
function glowGeometry(): BufferGeometry {
  const A = ARENA_BACKDROP;
  const s = new Soup();
  const paper = lin(ARENA_COLORS.paper); const accent = lin(ARENA_COLORS.accent); const lamp = lin('#fff3e2');
  const N = A.segments; const y = 0.008;
  const ring = (r: number, w: number, c: readonly number[], e: number): void => s.revolve(r - w / 2, y, r + w / 2, y, c, 0, TWO_PI, N, e);
  ring(4.12, 0.04, paper, 0.12);          // round the stage's curb (3.85), inside the trainers' slots
  ring(6.25, 0.05, paper, 0.12);          // the outer line, a step in front of the parapet
  // tick crown: every 10°, long every 30°
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * TWO_PI; const long = k % 3 === 0;
    const r0 = 5.7; const r1 = long ? 6.1 : 5.9; const hw = (long ? 0.04 : 0.02) / r0;
    s.revolve(r0, y, r1, y, paper, a - hw, a + hw, 1, 0.1);
  }
  // the parapet's face: the one orange line over the LED ribbon, a paper line along the top edge
  const H = A.parapetHeight; const rf = A.clearRadius - 0.004;
  s.revolve(rf, A.ribbonY[1] + 0.03, rf, A.ribbonY[1] + 0.065, accent, 0, TWO_PI, N, 2.2);
  s.revolve(rf, H - 0.05, rf, H - 0.01, paper, 0, TWO_PI, N, 0.8);
  // aisle nosings: a grey line on every aisle step edge (paper read as a zebra from above)
  const nosing = lin('#8d8e95');
  for (const b of aisleBearings()) {
    for (let i = 0; i < A.tierCount; i++) {
      const f = tierFront(i); const half = (A.aisleWidth / 2 - 0.08) / f;
      const yt = tierY(i) + 0.016; const mid = f + A.tierDepth / 2;
      s.revolve(f, yt, f + 0.05, yt, nosing, b - half, b + half, 1, 0.05);
      s.revolve(mid, yt + A.tierRise / 2, mid + 0.05, yt + A.tierRise / 2, nosing, b - half * f / mid, b + half * f / mid, 1, 0.05);
    }
  }
  // the canopy's light ring (underside, facing down) and the back wall's top edge
  s.revolve(A.canopyInner + 0.9, A.backWallTop - 0.01, A.canopyInner + 0.3, A.backWallTop - 0.01, lamp, 0, TWO_PI, N, 3.2);
  // floodlight lamp grids (4 × 3) on each head's ring-facing side, tilted down toward the ring
  for (const deg of A.mastBearingsDeg) {
    const a = deg * DEG; const ca = Math.cos(a); const sa = Math.sin(a);
    const cx = ca * (A.mastRadius - 0.58); const cz = sa * (A.mastRadius - 0.58); const cy = A.mastHeight + 0.6;
    const tx = -sa; const tz = ca;                     // tangent (across the head)
    const nx = -ca; const nz = -sa;                    // facing the ring
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 3; gy++) {
        const ox = (gx - 1.5) * 0.95; const oy = (gy - 1) * 0.75; const hw = 0.38; const hh = 0.28;
        const p = (u: number, v: number): number[] => [cx + tx * (ox + u) + nx * 0.01, cy + oy + v, cz + tz * (ox + u) + nz * 0.01];
        s.flat([p(-hw, -hh), p(hw, -hh), p(hw, hh), p(-hw, hh)], [nx, 0, nz], lamp, 4.5);
      }
    }
  }
  return s.build('ewaGlow');
}

/** The LED surfaces (`ewaPanel`: 0 = ribbon, u in metres; 1 = big screen, u / v 0..1 across the panel). */
function panelGeometry(): BufferGeometry {
  const A = ARENA_BACKDROP;
  const s = new Soup();
  const black = lin('#050506');
  const r = A.clearRadius - 0.002;
  s.revolve(r, A.ribbonY[0], r, A.ribbonY[1], black, 0, TWO_PI, A.segments * 2, 0);
  const rw = tierFront(A.tierCount) + A.concourseDepth - 0.01;
  s.revolve(rw, A.upperRibbonY[0], rw, A.upperRibbonY[1], black, 0, TWO_PI, A.segments * 2, 0);
  for (const deg of A.screenBearingsDeg) {
    const half = (A.screenWidth / 2) / rw;
    s.revolve(rw, A.screenY[0], rw, A.screenY[1], black, deg * DEG - half, deg * DEG + half, 8, 1, true);
  }
  // the ribbon u is the arc length; ribbons' v is 0..1 across their height
  const g = s.build('ewaPanel');
  const uvA = g.getAttribute('uv') as BufferAttribute; const pA = g.getAttribute('position') as BufferAttribute; const eA = g.getAttribute('ewaPanel') as BufferAttribute;
  for (let i = 0; i < uvA.count; i++) {
    if (eA.getX(i) > 0.5) continue;
    const y = pA.getY(i);
    const [y0, y1] = y < 5 ? A.ribbonY : A.upperRibbonY;
    uvA.setY(i, (y - y0) / (y1 - y0));
  }
  return g;
}

/** One seated figure: legs block (part 2), torso (part 0), head (part 1); facing +z (toward the ring after the instance turn). */
function figureGeometry(): BufferGeometry {
  const parts: [BufferGeometry, number][] = [];
  const legs = new BoxGeometry(0.38, 0.4, 0.34).toNonIndexed(); legs.translate(0, 0.2, 0.2);
  const torso = new BoxGeometry(0.44, 0.56, 0.26).toNonIndexed(); torso.translate(0, 0.42 + 0.28, -0.02);
  const head = new IcosahedronGeometry(0.12, 0); head.translate(0, 0.42 + 0.56 + 0.13, 0);
  parts.push([legs, 2], [torso, 0], [head, 1]);
  let n = 0;
  for (const [g] of parts) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3); const nor = new Float32Array(n * 3); const part = new Float32Array(n);
  let o = 0;
  for (const [g, k] of parts) {
    const P = g.getAttribute('position'); const Nn = g.getAttribute('normal');
    for (let i = 0; i < P.count; i++, o++) {
      pos[o * 3] = P.getX(i); pos[o * 3 + 1] = P.getY(i); pos[o * 3 + 2] = P.getZ(i);
      nor[o * 3] = Nn.getX(i); nor[o * 3 + 1] = Nn.getY(i); nor[o * 3 + 2] = Nn.getZ(i);
      part[o] = k;
    }
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nor, 3));
  out.setAttribute('ewaPart', new BufferAttribute(part, 1));
  out.computeBoundingSphere();
  return out;
}

/** Seat positions (x, y, z, yaw) for the crowd: every tier, `seatPitch` apart, aisles kept clear, `occupancy` filled. */
export function crowdSeats(): Float32Array {
  const A = ARENA_BACKDROP;
  const rnd = mulberry32(A.crowdSeed);
  const aisles = aisleBearings();
  const out: number[] = [];
  for (let i = 0; i < A.tierCount; i++) {
    const r = tierFront(i) + A.benchFront + A.benchDepth * 0.5;
    const y = tierY(i) + A.benchHeight - 0.42;      // the figure's hips (0.42 above its feet) on the bench
    const n = Math.floor((TWO_PI * r) / A.seatPitch);
    const off = rnd() * TWO_PI;
    for (let k = 0; k < n; k++) {
      const a = off + (k / n) * TWO_PI;
      if (aisleDistance(a, r, aisles) < A.aisleWidth / 2 + 0.2) continue;
      if (rnd() > A.occupancy) continue;
      const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      out.push(x, y, z, Math.atan2(-x, -z));
    }
  }
  return new Float32Array(out);
}

/** Shirt colours (sRGB) and weights: carbon greys and paper, cool blues, a few deep reds and ochre; never green (orange stays the venue's accent). */
const SHIRTS: readonly (readonly [string, number])[] = [
  ['#2b2b31', 18], ['#3d3f47', 14], ['#5a5c64', 8], ['#e6e2d8', 12], ['#c3bfb5', 6], ['#2e3b52', 10], ['#43597a', 8], ['#1f2a3d', 8],
  ['#6e2a2c', 6], ['#8c3b2f', 4], ['#a07a3a', 3], ['#7a7d86', 4],
];
const SKINS: readonly string[] = ['#e9c4a4', '#c99a74', '#a8744f', '#7a5236', '#5a3a26', '#f0d2b8'];

// ---- the backdrop ----------------------------------------------------------------------------------------------------

class Backdrop implements ArenaBackdrop {
  readonly root = new Group();
  private readonly time: UniformNode<'float', number>;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly crowd: InstancedMesh;
  private disposed = false;

  constructor() {
    this.root.name = 'ewa:arena-backdrop';
    this.time = uniform(0).setName('ewaArenaTime');
    const t = this.time;

    // structure: vertex-coloured carbon, matte; casts the sun's shadow onto the floor and the lower tiers
    const sm = new MeshStandardNodeMaterial();
    sm.vertexColors = true;
    sm.roughnessNode = float(0.78);
    sm.metalnessNode = float(0);
    sm.name = 'ewa:arena-structure';
    const structure = this.mesh(structureGeometry(), sm, 'structure');
    structure.castShadow = true; structure.receiveShadow = true;

    // floor: dark polished slab with seams (concentric every 1.6 m, radial every 15°), anti-aliased with fwidth
    const fm = new MeshStandardNodeMaterial();
    const xz = positionWorld.xz;
    const r = length(xz);
    const ang = atan(xz.y, xz.x);
    const ringD = abs(fract(r.div(1.6).add(0.5)).sub(0.5)).mul(1.6);
    const spoke = (Math.PI * 2) / 24;
    const radD = abs(fract(ang.div(spoke).add(0.5)).sub(0.5)).mul(spoke).mul(r);
    const line = (d: typeof ringD): typeof ringD => float(1).sub(smoothstep(float(0.012), float(0.012).add(fwidth(d).mul(1.5)), d));
    const seam = max(line(ringD), line(radD)).mul(step(4.4, r));
    const [c0r, c0g, c0b] = lin('#16161b'); const [c1r, c1g, c1b] = lin('#0b0b0e');
    const base = mix(vec3(c0r, c0g, c0b), vec3(c1r, c1g, c1b), smoothstep(4.0, ARENA_BACKDROP.clearRadius, r));
    fm.colorNode = base.mul(float(1).sub(seam.mul(0.55)));
    fm.roughnessNode = float(0.2).add(seam.mul(0.45));
    fm.metalnessNode = float(0);
    fm.name = 'ewa:arena-floor';
    const floor = this.mesh(floorGeometry(), fm, 'floor');
    floor.receiveShadow = true;

    // glow: lines and lamps — the vertex colour, lit, plus an emissive gain per vertex
    const gm = new MeshStandardNodeMaterial();
    const vcol = attribute('color', 'vec3');
    const glow = attribute('ewaGlow', 'float');
    gm.colorNode = vcol;
    gm.emissiveNode = vcol.mul(glow);
    gm.roughnessNode = float(0.5);
    gm.metalnessNode = float(0);
    gm.name = 'ewa:arena-glow';
    gm.userData = { ewaClass: 'emissive' };
    const glowMesh = this.mesh(glowGeometry(), gm, 'glow');
    glowMesh.receiveShadow = true;

    // LED panels: the ribbons scroll paper slabs with "type" bars and orange chevrons; the screens show a slanted
    // broadcast card with a sweeping highlight
    const pm = new MeshStandardNodeMaterial();
    const [pr, pg, pb] = lin(ARENA_COLORS.paper); const [ar, ag, ab] = lin(ARENA_COLORS.accent);
    const paper = vec3(pr, pg, pb); const accent = vec3(ar, ag, ab);
    const panel = attribute('ewaPanel', 'float');
    const u = uv().x; const v = uv().y;
    const slant = Math.tan(12 * DEG);
    // ribbon: 9 m cells scrolling at 1.4 m/s
    const sx = u.add(t.mul(1.4));
    const cell = fract(sx.div(9)).mul(9).add(v.mul(slant * 0.7));
    const slab = step(0.6, cell).mul(step(cell, 4.4));
    const bars = step(0.42, fract(cell.mul(2.6))).mul(step(0.3, v)).mul(step(v, 0.7));
    const chevron = step(5.0, cell).mul(step(cell, 5.35)).add(step(5.55, cell).mul(step(cell, 5.9)));
    const ribbon = paper.mul(slab.mul(float(1).sub(bars.mul(0.85))).mul(0.85)).add(accent.mul(chevron.mul(2.6))).add(vec3(0.004, 0.004, 0.005));
    // screen: frame, two slanted slabs meeting at the middle, a sweeping highlight
    const sxs = u.sub(0.5).add(v.sub(0.5).mul(slant * 0.4));
    const frame = max(max(step(u, 0.012), step(0.988, u)), max(step(v, 0.03), step(0.97, v)));
    const leftSlab = step(-0.42, sxs).mul(step(sxs, -0.06)).mul(step(0.38, v)).mul(step(v, 0.62));
    const rightSlab = step(0.06, sxs).mul(step(sxs, 0.42)).mul(step(0.38, v)).mul(step(v, 0.62));
    const mark = step(-0.025, sxs).mul(step(sxs, 0.025)).mul(step(0.3, v)).mul(step(v, 0.7));
    const sweep = smoothstep(0.04, 0.0, abs(fract(u.sub(t.mul(0.08))).sub(0.5))).mul(0.25);
    const screen = paper.mul(frame.mul(0.8).add(leftSlab.mul(1.2)).add(rightSlab.mul(0.55)).add(sweep)).add(accent.mul(mark.mul(2.4))).add(vec3(0.006, 0.006, 0.008));
    pm.colorNode = vec3(0.01, 0.01, 0.012);
    pm.emissiveNode = mix(ribbon, screen, panel);
    pm.roughnessNode = float(0.35);
    pm.metalnessNode = float(0);
    pm.name = 'ewa:arena-panels';
    pm.userData = { ewaClass: 'emissive' };
    this.mesh(panelGeometry(), pm, 'panels');

    // crowd: one instanced draw; shirt colour + phase and skin colour per instance; bob + the wave in the vertex stage
    const seats = crowdSeats();
    const count = seats.length / 4;
    const fig = figureGeometry();
    const tint = new Float32Array(count * 4); const skin = new Float32Array(count * 3);
    const rnd = mulberry32(ARENA_BACKDROP.crowdSeed ^ 0x9e37);
    const total = SHIRTS.reduce((s, x) => s + x[1], 0);
    const shirts = SHIRTS.map(([h, w]) => [lin(h), w] as const);
    const skins = SKINS.map(lin);
    for (let i = 0; i < count; i++) {
      let pick = rnd() * total; let c = shirts[0]![0];
      for (const [col, w] of shirts) { if ((pick -= w) <= 0) { c = col; break; } }
      tint.set([c[0], c[1], c[2], rnd()], i * 4);
      const k = skins[Math.floor(rnd() * skins.length)]!;
      skin.set(k, i * 3);
    }
    const tintAttr = new InstancedBufferAttribute(tint, 4);
    const skinAttr = new InstancedBufferAttribute(skin, 3);
    const tintN = instancedBufferAttribute(tintAttr, 'vec4') as unknown as Node<'vec4'>;
    const skinN = instancedBufferAttribute(skinAttr, 'vec3') as unknown as Node<'vec3'>;
    const part = attribute('ewaPart', 'float');
    const isHead = step(0.5, part).mul(step(part, 1.5));
    const isLegs = step(1.5, part);
    const cm = new MeshStandardNodeMaterial();
    cm.colorNode = mix(mix(tintN.xyz, skinN, isHead), tintN.xyz.mul(0.35), isLegs);
    cm.roughnessNode = float(0.85);
    cm.metalnessNode = float(0);
    const A = ARENA_BACKDROP;
    const phase = tintN.w;
    const theta = atan(positionLocal.z, positionLocal.x);
    const wave = smoothstep(float(1 - A.waveWidth), float(1), cos(theta.sub(t.mul(A.waveSpeed))));
    const bob = max(sin(t.mul(phase.mul(1.8).add(2.2)).add(phase.mul(6.283))), 0).pow(2).mul(A.bobLift);
    cm.positionNode = positionLocal.add(vec3(0, bob.add(wave.mul(A.waveLift)).mul(float(1).sub(isLegs)), 0));
    cm.name = 'ewa:arena-crowd';
    this.geometries.push(fig);
    this.materials.push(cm);
    const crowd = new InstancedMesh(fig, cm, count);
    crowd.name = 'ewa:arena-backdrop:crowd';
    const m = new Matrix4(); const q = new Quaternion(); const p = new Vector3(); const sc = new Vector3(); const up = new Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const s = 0.94 + tint[i * 4 + 3]! * 0.12;
      p.set(seats[i * 4]!, seats[i * 4 + 1]!, seats[i * 4 + 2]!);
      q.setFromAxisAngle(up, seats[i * 4 + 3]!);
      sc.set(s, s, s);
      crowd.setMatrixAt(i, m.compose(p, q, sc));
    }
    crowd.instanceMatrix.needsUpdate = true;
    fig.setAttribute('ewaTint', tintAttr);       // kept on the geometry too, so `dispose` releases them with it
    fig.setAttribute('ewaSkin', skinAttr);
    crowd.castShadow = false; crowd.receiveShadow = false;
    crowd.frustumCulled = false;                  // the bowl surrounds the camera; the instances' bound is the whole bowl
    this.root.add(crowd);
    this.crowd = crowd;
  }

  private mesh(g: BufferGeometry, m: Material, name: string): Mesh {
    this.geometries.push(g); this.materials.push(m);
    const mesh = new Mesh(g, m);
    mesh.name = `ewa:arena-backdrop:${name}`;
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    this.root.add(mesh);
    return mesh;
  }

  /** The crowd's instance count (tests / sandbox). */
  get crowdCount(): number { return this.crowd.count; }

  update(dtSeconds: number): void {
    if (this.disposed || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    // wrapped hourly so the float keeps its precision (the ribbon and the sweep loop exactly; the wave / bob skip once)
    this.time.value = (this.time.value + dtSeconds) % 3600;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.crowd.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
  }
}

/**
 * Builds the arena stadium around a ring at the world origin (y = 0 is the floor). Register `root` as the zone root
 * (`setZoneRoot` + `scene.add`), call `update(dtSeconds)` every frame, `dispose()` when leaving the arena.
 */
export function createArenaBackdrop(): ArenaBackdrop {
  return new Backdrop();
}
