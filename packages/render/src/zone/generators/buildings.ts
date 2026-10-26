/**
 * §10.5.4 `makeHouse` — buildings for every biome set, parameterised by a `BuildingStyle` (surfaces + proportions).
 *
 * Walls are `ExtrudeGeometry`s of wall-elevation `Shape`s with the door and window openings cut as holes and a 4 cm
 * bevel (Pillar 3 chamfer, also round every opening); the openings are lined by the extrusion itself and the
 * panes sit 0.12 m behind the face. Timber framing (posts, plates, studs beside every opening, braces in free
 * bays, gable king post) is a separate surface group. Roofs are two bevelled slabs at the style's pitch (38° for
 * the grove) with a 0.35 m overhang, barge boards, a ridge; chimneys are chamfered stone stacks with a cap and a
 * lathed pot. Details: stone plinth reaching below the lowest terrain under the footprint, steps, door hood,
 * sills, shutters, window boxes. lod1 drops linings, frame and details (solid walls with flush panes); lod2 is the
 * chamfered shell.
 *
 * Local frame: footprint centred on the origin, the door wall facing +z (BuildingSpec.yaw rotates it), y = 0 at
 * the highest terrain sample under the footprint (the builder passes `drop` = how far the terrain falls below it).
 */
import { Matrix4, Path, Shape, Vector3 } from 'three/webgpu';
import type { BuildingSpec } from '../../contracts.js';
import type { SurfaceId } from '../../materials/surfaces.js';
import { Parts, beam, box, card, extrude, lathe, propGeo, rectShape, trs, type V3 } from '../geo.js';
import { createPrng, type Prng } from '../prng.js';
import type { PropGeo } from '../types.js';
import { drain, type Steps } from '../../steps.js';

export interface BuildingStyle {
  readonly wall: SurfaceId;
  readonly upperWall: SurfaceId;
  readonly frame: SurfaceId | null;
  readonly plinth: SurfaceId;
  readonly door: SurfaceId;
  readonly glass: SurfaceId;
  /** Glass of the lit windows (an emissive surface, ~1 in 3 windows). */
  readonly litGlass: SurfaceId;
  readonly sill: SurfaceId;
  readonly trim: SurfaceId;
  readonly chimney: SurfaceId | null;
  readonly metal: SurfaceId;
  readonly greenery: SurfaceId | null;
  readonly roofs: Readonly<Record<BuildingSpec['roof'], SurfaceId>>;
  readonly storey: number;
  readonly pitchDeg: number;
  readonly overhang: number;
  /** Lower wall band in plinth stone up to this height (stone-built biomes use the full storey). */
  readonly stoneBand: number;
}

const DEG = Math.PI / 180;
const THICK = 0.3;
/** Phase A: an open door shows this dark surface behind the opening (a shared surface every zone with buildings binds). */
export const DOORWAY_SURFACE: SurfaceId = 'lantern_metal';
/** How far an open door leaf swings in (rad). */
const DOOR_SWING = 100 * DEG;
const BEVEL = 0.04;

interface Opening { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly kind: 'door' | 'window' | 'round' | 'arch'; readonly shutters: boolean; readonly box: boolean }

interface WallDef {
  /** Wall-local frame: x along the wall (left → right seen from outside), y up from the wall base, outer face at z = 0 facing +z. */
  readonly m: Matrix4;
  readonly length: number;
  readonly height: number;
  /** Gable peak rise above `height` at the wall centre (side walls of the top storey). */
  readonly gable: number;
  readonly openings: readonly Opening[];
  readonly surface: SurfaceId;
}

function wallMatrix(side: 'front' | 'back' | 'left' | 'right', hw: number, hd: number, y: number): Matrix4 {
  switch (side) {
    case 'front': return trs(0, y, hd, 0);
    case 'back': return trs(0, y, -hd, Math.PI);
    case 'right': return trs(hw, y, 0, Math.PI / 2);
    default: return trs(-hw, y, 0, -Math.PI / 2);
  }
}

function openingPath(o: Opening): Path {
  const p = new Path();
  const x0 = o.x - o.w / 2; const x1 = o.x + o.w / 2;
  if (o.kind === 'round') {
    p.absarc(o.x, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2, true);
    return p;
  }
  p.moveTo(x0, o.y);
  if (o.kind === 'arch') {
    const r = o.w / 2;
    p.lineTo(x0, o.y + o.h - r);
    p.absarc(o.x, o.y + o.h - r, r, Math.PI, 0, true);
    p.lineTo(x1, o.y);
  } else {
    p.lineTo(x0, o.y + o.h); p.lineTo(x1, o.y + o.h); p.lineTo(x1, o.y);
  }
  p.lineTo(x0, o.y);
  return p;
}

/** The wall solid: elevation shape with holes, extruded inward by the wall thickness (outer face at z = 0). */
function wallSolid(parts: Parts, w: WallDef, withHoles: boolean): void {
  const L = w.length / 2;
  const s = new Shape();
  s.moveTo(-L, 0); s.lineTo(L, 0); s.lineTo(L, w.height);
  if (w.gable > 0) s.lineTo(0, w.height + w.gable);
  s.lineTo(-L, w.height); s.lineTo(-L, 0);
  if (withHoles) for (const o of w.openings) s.holes.push(openingPath(o));
  const m = w.m.clone().multiply(new Matrix4().makeTranslation(0, 0, -THICK));
  extrude(parts, w.surface, s, THICK, BEVEL, m, { curveSegments: 10 });
}

function frontOf(w: WallDef, x: number, y: number, z: number): [number, number, number] {
  const v = new Vector3(x, y, z).applyMatrix4(w.m);
  return [v.x, v.y, v.z];
}

/** The wall's outward normal in building space. */
function faceOf(w: WallDef): V3 {
  const v = new Vector3(0, 0, 1).transformDirection(w.m);
  return [v.x, v.y, v.z];
}

/** Timber framing on one wall: corner posts, bottom/top plates, studs at openings, braces in free bays. */
function frameWall(parts: Parts, st: BuildingStyle, w: WallDef, p: Prng, midRail: boolean): void {
  if (st.frame === null) return;
  const f = st.frame;
  const L = w.length / 2;
  const z = 0.02;
  const bw = 0.17; const bt = 0.07;
  const face = faceOf(w);
  const at = (x: number, y: number): [number, number, number] => frontOf(w, x, y, z);
  const bm = (a: V3, b: V3, width: number): void => beam(parts, f, a, b, width, bt, 0.02, face);
  // plates
  bm(at(-L, 0.085), at(L, 0.085), bw);
  bm(at(-L, w.height - 0.085), at(L, w.height - 0.085), bw);
  // studs
  const xs: number[] = [-L + 0.09, L - 0.09];
  for (const o of w.openings) { xs.push(o.x - o.w / 2 - 0.1, o.x + o.w / 2 + 0.1); }
  xs.sort((a, b) => a - b);
  const studs: number[] = [];
  for (const x of xs) if (studs.length === 0 || x - studs[studs.length - 1]! > 0.35) studs.push(x);
  for (const x of studs) bm(at(x, 0.17), at(x, w.height - 0.17), bw);
  // rails above / below openings, braces and mid rails in free bays
  for (let i = 0; i + 1 < studs.length; i++) {
    const a = studs[i]!; const b = studs[i + 1]!;
    const mid = (a + b) / 2;
    const blocked = w.openings.some((o) => Math.abs(o.x - mid) < o.w / 2 + 0.05);
    if (blocked) {
      for (const o of w.openings) {
        if (Math.abs(o.x - mid) >= o.w / 2 + 0.05) continue;
        if (o.kind !== 'door' && o.kind !== 'arch' && o.y > 0.4) bm(at(a + 0.08, o.y - 0.16), at(b - 0.08, o.y - 0.16), bw * 0.8);
        if (o.y + o.h < w.height - 0.4) bm(at(a + 0.08, o.y + o.h + 0.16), at(b - 0.08, o.y + o.h + 0.16), bw * 0.8);
      }
      continue;
    }
    if (b - a < 0.7) continue;
    const up = p.next() < 0.5;
    if (b - a > 1.1) bm(at(a + 0.08, up ? 0.17 : w.height - 0.2), at(b - 0.08, up ? w.height - 0.2 : 0.17), bw * 0.85);
    if (midRail && b - a > 0.9) bm(at(a + 0.08, w.height * 0.45), at(b - 0.08, w.height * 0.45), bw * 0.75);
  }
  // gable: king post + two raking braces
  if (w.gable > 0.4) {
    bm(at(0, w.height), at(0, w.height + w.gable - 0.15), bw);
    bm(at(-L + 0.2, w.height + 0.1), at(0, w.height + w.gable * 0.6), bw * 0.8);
    bm(at(L - 0.2, w.height + 0.1), at(0, w.height + w.gable * 0.6), bw * 0.8);
  }
}

/** Window / door dressing: pane, frame, mullions, sill, shutters, window box; door leaf, frame, lintel. */
function dressOpenings(parts: Parts, st: BuildingStyle, w: WallDef, p: Prng): void {
  const face = faceOf(w);
  for (const o of w.openings) {
    const x0 = o.x - o.w / 2; const x1 = o.x + o.w / 2; const y0 = o.y; const y1 = o.y + o.h;
    const m = w.m;
    const bm = (surf: SurfaceId, a: V3, b: V3, width: number, depth: number, c = 0.015): void => beam(parts, surf, a, b, width, depth, c, face);
    if (o.kind === 'door' || o.kind === 'arch') {
      // Phase A: the door stands OPEN — a dark doorway (the hall is reached through it) with the leaf (or both leaves
      // of an arch) swung in against the inner wall
      box(parts, DOORWAY_SURFACE, o.x, y0 - 0.02, -1.3, o.w + 0.34, o.h + 0.12, 0.06, 0, 0.01, m);
      box(parts, DOORWAY_SURFACE, o.x, y0 - 0.02, -0.8, o.w + 0.3, 0.03, 1.0, 0, 0.005, m);
      for (const sx of [x0 - 0.14, x1 + 0.14]) box(parts, DOORWAY_SURFACE, sx, y0 - 0.02, -0.8, 0.05, o.h + 0.12, 1.0, 0, 0.005, m);
      const leaves = o.kind === 'arch' ? [[x0 + 0.04, 1], [x1 - 0.04, -1]] as const : [[x1 - 0.04, -1]] as const;
      const lw = (o.kind === 'arch' ? o.w / 2 : o.w) - 0.03;
      const lh = o.kind === 'arch' ? o.h - o.w / 2 : o.h - 0.01;
      for (const [hx, s] of leaves) {
        const lm = m.clone().multiply(trs(hx, y0, -0.24, s * DOOR_SWING)).multiply(trs(s * lw / 2, 0, -0.04));
        box(parts, st.door, 0, 0, 0, lw, lh, 0.06, 0, 0.015, lm);
        box(parts, st.metal, -s * (lw / 2 - 0.12), 1.0, 0.04, 0.05, 0.16, 0.04, 0, 0.01, lm);
      }
      if (o.kind === 'arch') continue;
      const fr = st.frame ?? st.door;
      bm(fr, frontOf(w, x0 - 0.07, y0, 0.03), frontOf(w, x0 - 0.07, y1 + 0.02, 0.03), 0.14, 0.08, 0.02);
      bm(fr, frontOf(w, x1 + 0.07, y0, 0.03), frontOf(w, x1 + 0.07, y1 + 0.02, 0.03), 0.14, 0.08, 0.02);
      bm(fr, frontOf(w, x0 - 0.2, y1 + 0.09, 0.04), frontOf(w, x1 + 0.2, y1 + 0.09, 0.04), 0.18, 0.1, 0.025);
      continue;
    }
    if (o.kind === 'round') {
      lathe(parts, st.glass, [[o.w / 2, 0.001], [0.001, 0]], { segments: 16, smooth: false }, m.clone().multiply(trs(o.x, y0 + o.h / 2, -0.13)).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
      const ring = new Shape();
      ring.absarc(0, 0, o.w / 2 + 0.1, 0, Math.PI * 2, false);
      const hole = new Path(); hole.absarc(0, 0, o.w / 2 - 0.01, 0, Math.PI * 2, true);
      ring.holes.push(hole);
      extrude(parts, st.frame ?? st.trim, ring, 0.08, 0.02, m.clone().multiply(trs(o.x, y0 + o.h / 2, -0.03)), { curveSegments: 16 });
      bm(st.frame ?? st.trim, frontOf(w, o.x, y0 + 0.02, -0.11), frontOf(w, o.x, y1 - 0.02, -0.11), 0.05, 0.04, 0.01);
      bm(st.frame ?? st.trim, frontOf(w, x0 + 0.02, y0 + o.h / 2, -0.11), frontOf(w, x1 - 0.02, y0 + o.h / 2, -0.11), 0.05, 0.04, 0.01);
      continue;
    }
    box(parts, p.next() < 0.34 ? st.litGlass : st.glass, o.x, y0, -0.14, o.w, o.h, 0.03, 0, 0.01, m);
    const fr = st.frame ?? st.trim;
    bm(fr, frontOf(w, o.x, y0 + 0.02, -0.11), frontOf(w, o.x, y1 - 0.02, -0.11), 0.05, 0.04, 0.01);
    bm(fr, frontOf(w, x0 + 0.02, y0 + o.h * 0.55, -0.11), frontOf(w, x1 - 0.02, y0 + o.h * 0.55, -0.11), 0.05, 0.04, 0.01);
    bm(fr, frontOf(w, x0 - 0.05, y0 - 0.02, 0.02), frontOf(w, x0 - 0.05, y1 + 0.02, 0.02), 0.1, 0.06);
    bm(fr, frontOf(w, x1 + 0.05, y0 - 0.02, 0.02), frontOf(w, x1 + 0.05, y1 + 0.02, 0.02), 0.1, 0.06);
    bm(fr, frontOf(w, x0 - 0.12, y1 + 0.06, 0.02), frontOf(w, x1 + 0.12, y1 + 0.06, 0.02), 0.12, 0.07);
    box(parts, st.sill, o.x, y0 - 0.075, 0.01, o.w + 0.26, 0.075, 0.2, 0, 0.02, m);
    if (o.shutters) {
      const open = 0.2 + p.next() * 0.25;
      for (const s of [-1, 1] as const) {
        const hx = s < 0 ? x0 - 0.08 : x1 + 0.08;
        const mm = m.clone().multiply(trs(hx, y0, 0.035, -s * open)).multiply(trs(s * o.w / 4, 0, 0));
        box(parts, st.door, 0, 0, 0, o.w / 2, o.h, 0.04, 0, 0.012, mm);
        box(parts, st.door, 0, o.h * 0.2, 0.025, o.w / 2 - 0.05, 0.08, 0.025, 0, 0.008, mm);
        box(parts, st.door, 0, o.h * 0.72, 0.025, o.w / 2 - 0.05, 0.08, 0.025, 0, 0.008, mm);
      }
    }
    if (o.box && st.greenery) {
      box(parts, st.door, o.x, y0 - 0.36, 0.13, o.w + 0.12, 0.24, 0.24, 0, 0.02, m);
      for (let k = 0; k < 4; k++) {
        const c = frontOf(w, o.x - o.w / 2 + 0.1 + (k * (o.w - 0.2)) / 3, y0 - 0.2, 0.13);
        card(parts, st.greenery, c[0], c[1], c[2], 0.4, 0.34, k * 1.3 + p.next(), 0.1, [c[0], c[1] - 0.3, c[2]], 0.5, [0, 0, 1, 1], true);
      }
    }
  }
}

/** Two roof slabs + ridge + barge boards over a footprint `w × d` whose walls top out at `wallTop`. */
function roof(parts: Parts, st: BuildingStyle, surface: SurfaceId, kind: BuildingSpec['roof'], w: number, d: number, wallTop: number, detail: boolean): { ridgeY: number; eaveY: number } {
  const pitch = (kind === 'plate' ? 14 : kind === 'thatch' ? st.pitchDeg + 4 : st.pitchDeg) * DEG;
  const ov = kind === 'thatch' ? st.overhang + 0.15 : st.overhang;
  const T = kind === 'thatch' ? 0.34 : kind === 'plate' ? 0.08 : 0.12;
  const bev = kind === 'thatch' ? 0.1 : 0.03;
  const half = d / 2 + 0.02;
  const rise = half * Math.tan(pitch);
  const ridgeY = wallTop + rise;
  const eaveY = wallTop - ov * Math.tan(pitch);
  const Ls = (half + ov) / Math.cos(pitch) + T * Math.tan(pitch) * 0.5;
  const Wr = w + 2 * ov;
  for (const side of [1, -1] as const) {
    const slope = new Vector3(0, Math.sin(pitch), -Math.cos(pitch) * side);
    const normal = new Vector3(0, Math.cos(pitch), Math.sin(pitch) * side);
    const xAxis = new Vector3(side, 0, 0);
    const m = new Matrix4().makeBasis(xAxis, slope, normal);
    m.setPosition(0, eaveY, side * (half + ov));
    extrude(parts, surface, rectShape(-Wr / 2, 0, Wr / 2, Ls), T, bev, m, { bevelSegments: kind === 'thatch' ? 3 : 2 });
    if (detail && kind !== 'thatch') {
      // barge boards along both gable edges
      for (const gx of [-1, 1]) {
        const a = new Vector3(gx * (Wr / 2 - 0.04), 0, 0).applyMatrix4(m);
        const b = new Vector3(gx * (Wr / 2 - 0.04), Ls - 0.05, 0).applyMatrix4(m);
        beam(parts, st.trim, [a.x, a.y - 0.06, a.z], [b.x, b.y - 0.06, b.z], 0.24, 0.07, 0.02, [gx, 0, 0]);
      }
      // fascia along the eave
      const e0 = new Vector3(-Wr / 2, 0.0, 0).applyMatrix4(m); const e1 = new Vector3(Wr / 2, 0.0, 0).applyMatrix4(m);
      beam(parts, st.trim, [e0.x, e0.y - 0.06, e0.z], [e1.x, e1.y - 0.06, e1.z], 0.16, 0.06, 0.015, [0, 0, side]);
    }
  }
  if (kind === 'thatch') {
    lathe(parts, surface, [[0.001, -Wr / 2 - 0.06], [0.2, -Wr / 2], [0.24, -Wr / 2 + 0.2], [0.24, Wr / 2 - 0.2], [0.2, Wr / 2], [0.001, Wr / 2 + 0.06]], { segments: 8, smooth: true }, trs(0, ridgeY + 0.16, 0).multiply(new Matrix4().makeRotationZ(Math.PI / 2)));
  } else {
    const ry = ridgeY + T * 0.75;
    beam(parts, kind === 'plate' ? st.metal : surface, [-Wr / 2 - 0.02, ry, 0], [Wr / 2 + 0.02, ry, 0], 0.24, 0.24, 0.03, [0, Math.SQRT1_2, Math.SQRT1_2]);
  }
  return { ridgeY, eaveY };
}

/** A sloped canopy slab of `width` × `depth` over (x, y) on the wall z = zFace, on two brackets. */
function hood(parts: Parts, st: BuildingStyle, surface: SurfaceId, x: number, y: number, zFace: number, width: number, depth: number, bracket?: SurfaceId): void {
  const a = 0.5;
  const X = new Vector3(1, 0, 0);
  const Y = new Vector3(0, -Math.sin(a), Math.cos(a));
  const Z = new Vector3().crossVectors(X, Y);
  const m = new Matrix4().makeBasis(X, Y, Z).setPosition(x - width / 2, y, zFace + 0.02);
  extrude(parts, surface, rectShape(0, 0, width, depth), 0.08, 0.02, m);
  const br = bracket ?? st.frame ?? st.trim;
  for (const s of [-1, 1]) {
    beam(parts, br, [x + s * (width / 2 - 0.12), y - 0.55, zFace + 0.03], [x + s * (width / 2 - 0.12), y - 0.08, zFace + depth * 0.8], 0.08, 0.08, 0.02, [1, 0, 0]);
  }
}

function chimney(parts: Parts, st: BuildingStyle, x: number, z: number, y0: number, top: number): void {
  if (st.chimney === null) return;
  box(parts, st.chimney, x, y0, z, 0.78, top - y0, 0.66, 0, 0.04);
  box(parts, st.chimney, x, top, z, 0.92, 0.12, 0.8, 0, 0.03);
  lathe(parts, st.plinth, [[0.14, 0], [0.16, 0.05], [0.12, 0.28], [0.15, 0.34], [0.1, 0.34]], { segments: 10, smooth: false }, trs(x, top + 0.12, z));
}

function steps(parts: Parts, st: BuildingStyle, x: number, zFace: number, plinthTop: number, drop: number, width: number, m?: Matrix4): void {
  const n = Math.max(1, Math.round((plinthTop + drop * 0.5) / 0.2));
  const rise = plinthTop / n;
  for (let k = 0; k < n; k++) {
    const depth = 0.34 * (n - k);
    box(parts, st.plinth, x, -drop - 0.1, zFace + depth / 2, width + 0.2 - k * 0.06, drop + 0.1 + rise * (k + 1), depth, 0, 0.03, m);
  }
}

/** Openings for a wall of `length`: a door (front) and 1–3 windows spaced evenly, seeded. */
function layoutOpenings(p: Prng, length: number, height: number, door: { w: number; h: number; kind: Opening['kind'] } | null, windowW: number, windowH: number, sillY: number, shutters: boolean, boxes: boolean): Opening[] {
  const out: Opening[] = [];
  const L = length / 2;
  let doorX = 0;
  if (door) {
    doorX = Math.abs(p.next() - 0.5) < 0.2 || length < 6 ? 0 : (p.next() < 0.5 ? -1 : 1) * Math.min(1.2, L - door.w / 2 - 1.2);
    out.push({ x: doorX, y: 0, w: door.w, h: Math.min(door.h, height - 0.35), kind: door.kind, shutters: false, box: false });
  }
  const slots: number[] = [];
  const pitch = windowW + 1.25;
  const n = Math.max(1, Math.floor((length - 1.0) / pitch));
  for (let k = 0; k < n; k++) slots.push(-L + 0.5 + pitch / 2 + k * pitch + (length - 1.0 - n * pitch) / 2);
  for (const x of slots) {
    if (door && Math.abs(x - doorX) < door.w / 2 + windowW / 2 + 0.45) continue;
    if (Math.abs(x) + windowW / 2 > L - 0.45) continue;
    out.push({ x, y: sillY, w: windowW, h: Math.min(windowH, height - sillY - 0.35), kind: 'window', shutters, box: boxes && p.next() < 0.7 });
  }
  return out;
}

export interface HouseOpts { readonly drop?: number; readonly accent?: SurfaceId | null }

/** SPEC §10.5.4 `makeHouse(spec)` (+ `drop`: terrain fall under the footprint). */
export function buildHouse(st: BuildingStyle, spec: BuildingSpec, o: HouseOpts = {}): PropGeo {
  return drain(houseSteps(st, spec, o));
}

/** `buildHouse` as resumable steps (Handover II, steps.ts): a yield after each wall, the roof and the dressing. */
export function* houseSteps(style: BuildingStyle, spec: BuildingSpec, o: HouseOpts = {}): Steps<PropGeo> {
  const p = createPrng(spec.seed);
  const drop = Math.max(0, o.drop ?? 0);
  // a crypt (content data/hideouts.ts): the grand build in bare stone, no timber, chimney, window boxes or windows,
  // the accent glowing in its lintel and gable
  const crypt = spec.kind === 'crypt';
  const st: BuildingStyle = crypt ? { ...style, wall: style.plinth, upperWall: style.plinth, frame: null, chimney: null, greenery: null } : style;
  const grand = spec.kind === 'gym' || spec.kind === 'landmark' || crypt;
  const storey = st.storey * (grand ? 1.22 : 1);
  const P = grand ? 0.6 : 0.45;
  const w = spec.w; const d = spec.d;
  const hw = w / 2; const hd = d / 2;
  const floors = spec.floors;
  const jetty = floors === 2 && st.frame !== null && !grand ? 0.3 : 0;
  const roofSurface = st.roofs[spec.roof];
  const L0 = new Parts(); const L1 = new Parts(); const L2 = new Parts();

  // plinth (reaches below the lowest terrain under the footprint)
  for (const parts of [L0, L1, L2]) box(parts, st.plinth, 0, -drop - 0.3, 0, w + 0.24, P + drop + 0.3, d + 0.24, 0, 0.05);

  const ground = floors === 2 ? storey : storey * (grand ? 1.3 : 1);
  const upperY = P + ground;
  const upperD = d + 2 * jetty;
  const wallTop = floors === 2 ? upperY + storey * 0.92 : P + ground;
  const doorSpec = grand ? { w: 2.3, h: 3.0, kind: 'arch' as const } : spec.kind === 'shop' ? { w: 1.3, h: 2.2, kind: 'door' as const } : { w: 1.1, h: 2.1, kind: 'door' as const };
  const windowW = grand ? 1.0 : 0.9; const windowH = grand ? 1.6 : 1.05;
  const shut = st.frame !== null && p.next() < 0.6;

  const walls: WallDef[] = [];
  const addStorey = (y: number, h: number, depth: number, gable: number, upper: boolean): void => {
    const wallSurf = upper ? st.upperWall : st.wall;
    const sill = upper ? 0.75 : 0.95;
    // a crypt keeps only its door (the seeded draws still run, so nothing else in the build shifts)
    const keep = (ops: Opening[]): Opening[] => (crypt ? ops.filter((op) => op.kind === 'door' || op.kind === 'arch') : ops);
    walls.push({ m: wallMatrix('front', hw, depth / 2, y), length: w, height: h, gable: 0, surface: wallSurf, openings: keep(layoutOpenings(p, w, h, upper ? null : doorSpec, spec.kind === 'shop' && !upper ? 2.2 : windowW, spec.kind === 'shop' && !upper ? 1.35 : windowH, sill, shut, !upper && st.greenery !== null)) });
    walls.push({ m: wallMatrix('back', hw, depth / 2, y), length: w, height: h, gable: 0, surface: wallSurf, openings: keep(layoutOpenings(p, w, h, null, windowW, windowH, sill, false, false)) });
    for (const side of ['left', 'right'] as const) {
      const sideOpen = gable > 0 && grand && !crypt ? [{ x: 0, y: h + gable * 0.35, w: 1.1, h: 1.1, kind: 'round' as const, shutters: false, box: false }] : [];
      const ops = [...keep(layoutOpenings(p, depth - 2 * THICK, h, null, windowW, windowH, sill, shut && !upper, false)), ...sideOpen];
      walls.push({ m: wallMatrix(side, hw, 0, y), length: depth - 2 * THICK, height: h, gable, surface: wallSurf, openings: ops });
    }
  };
  const rise = ((floors === 2 ? upperD : d) / 2 + 0.02) * Math.tan((spec.roof === 'plate' ? 14 : spec.roof === 'thatch' ? st.pitchDeg + 4 : st.pitchDeg) * DEG);
  if (floors === 2) {
    addStorey(P, ground, d, 0, false);
    addStorey(upperY, wallTop - upperY, upperD, rise, true);
  } else {
    addStorey(P, wallTop - P, d, rise, false);
  }

  for (const wd of walls) {
    wallSolid(L0, wd, true);
    wallSolid(L1, { ...wd, openings: [] }, false);
    frameWall(L0, st, wd, p, wd.height > 2.4);
    dressOpenings(L0, st, wd, p);
    // lod1: flush panes and a door slab on the solid wall
    for (const op of wd.openings) {
      const surf = op.kind === 'door' || op.kind === 'arch' ? DOORWAY_SURFACE : st.glass;
      box(L1, surf, op.x, op.y, 0.005, op.w, op.h, 0.03, 0, 0.01, wd.m);
    }
    yield 'building:wall';
  }
  // stone band on the lower wall (stone-built looks) and corner posts for framed houses
  if (st.stoneBand > 0) {
    const bh = Math.min(st.stoneBand, ground);
    box(L0, st.plinth, 0, P - 0.02, 0, w + 0.1, bh, d + 0.1, 0, 0.04);
  }
  if (st.frame !== null) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      box(L0, st.frame, sx * (hw - 0.02), P - 0.02, sz * (hd - 0.02), 0.26, ground + 0.04, 0.26, 0, 0.03);
      if (floors === 2) box(L0, st.frame, sx * (hw - 0.02), upperY, sz * (upperD / 2 - 0.02), 0.24, wallTop - upperY, 0.24, 0, 0.03);
    }
    if (floors === 2) {
      // jetty beam + joist ends under the overhang
      for (const sz of [-1, 1]) {
        beam(L0, st.frame, [-hw - 0.05, upperY - 0.1, sz * (upperD / 2 - 0.1)], [hw + 0.05, upperY - 0.1, sz * (upperD / 2 - 0.1)], 0.22, 0.24, 0.03);
        for (let x = -hw + 0.4; x < hw - 0.2; x += 0.6) box(L0, st.frame, x, upperY - 0.34, sz * (hd + jetty / 2), 0.12, 0.13, jetty + 0.05, 0, 0.02);
      }
    }
  }
  // floor band between storeys for non-framed styles
  if (floors === 2 && st.frame === null) box(L0, st.trim, 0, upperY - 0.12, 0, w + 0.14, 0.18, upperD + 0.14, 0, 0.03);

  // roof
  const roofDepth = floors === 2 ? upperD : d;
  const r0 = roof(L0, st, roofSurface, spec.roof, w, roofDepth, wallTop, true);
  roof(L1, st, roofSurface, spec.roof, w, roofDepth, wallTop, false);
  roof(L2, st, roofSurface, spec.roof, w, roofDepth, wallTop, false);
  // gable infill for lod1/lod2 (solid walls have no gable in lod2)
  box(L2, st.wall, 0, P, 0, w, wallTop - P, roofDepth, 0, 0.05);
  yield 'building:roof';

  // chimney
  if (st.chimney !== null && spec.kind !== 'shop' && p.next() < 0.85) {
    const cx = (p.next() < 0.5 ? -1 : 1) * (hw - 0.7);
    const cz = -roofDepth / 4;
    const top = r0.ridgeY + 0.7;
    chimney(L0, st, cx, cz, wallTop - 0.6, top);
    box(L1, st.chimney, cx, wallTop - 0.6, cz, 0.78, top - wallTop + 0.6, 0.66, 0, 0.04);
  }

  // door furniture: steps, hood, and kind-specific dressing
  const front = walls[0]!;
  const doorOp = front.openings.find((op) => op.kind === 'door' || op.kind === 'arch');
  if (doorOp) {
    steps(L0, st, doorOp.x, hd + (floors === 2 ? 0 : 0), P, drop, doorOp.w + 0.3);
    steps(L1, st, doorOp.x, hd, P, drop, doorOp.w + 0.3);
    if (!grand) hood(L0, st, roofSurface, doorOp.x, P + doorOp.h + 0.32, hd, doorOp.w + 0.8, 0.85);
  }
  if (spec.kind === 'shop') {
    const win = front.openings.find((op) => op.kind === 'window');
    if (win) hood(L0, st, roofSurface, win.x, P + win.y + win.h + 0.45, hd, win.w + 0.7, 1.15, st.metal);
    const sx = (doorOp ? doorOp.x : 0) + (doorOp && doorOp.x > 0 ? -1.45 : 1.45);
    beam(L0, st.metal, [sx, P + 2.78, hd + 0.02], [sx, P + 2.78, hd + 0.9], 0.05, 0.05, 0.012);
    box(L0, st.door, sx, P + 2.02, hd + 0.62, 0.07, 0.62, 0.7, 0, 0.02);
    box(L0, st.frame ?? st.trim, sx, P + 1.99, hd + 0.62, 0.05, 0.68, 0.76, 0, 0.015);
  }
  if (grand) {
    // stone quoins, a sign board over the door and banner poles
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
      for (let y = P; y < wallTop - 0.3; y += 0.62) {
        const big = Math.round((y - P) / 0.62) % 2 === 0;
        box(L0, st.plinth, sx * (hw - (big ? 0.22 : 0.16)), y, sz * (hd - 0.12), big ? 0.52 : 0.4, 0.5, 0.3, 0, 0.04);
        box(L0, st.plinth, sx * (hw - 0.12), y, sz * (hd - (big ? 0.16 : 0.22)), 0.3, 0.5, big ? 0.4 : 0.52, 0, 0.04);
      }
    }
    if (doorOp && crypt) {
      // a glowing lintel in place of the sign board
      box(L0, st.trim, doorOp.x, P + doorOp.h + 0.4, hd + 0.02, 3.0, 0.5, 0.1, 0, 0.02);
      if (o.accent) box(L0, o.accent, doorOp.x, P + doorOp.h + 0.52, hd + 0.08, 2.2, 0.12, 0.04, 0, 0.008);
    } else if (doorOp) {
      box(L0, st.door, doorOp.x, P + doorOp.h + 0.45, hd + 0.02, 3.2, 0.7, 0.12, 0, 0.03);
      box(L0, st.frame ?? st.trim, doorOp.x, P + doorOp.h + 0.4, hd + 0.02, 3.4, 0.8, 0.08, 0, 0.02);
      // stone arch surround
      for (let k = 0; k <= 8; k++) {
        const a = Math.PI - (k * Math.PI) / 8;
        const r = doorOp.w / 2 + 0.18;
        const cx = doorOp.x + Math.cos(a) * r; const cy = P + doorOp.h - doorOp.w / 2 + Math.sin(a) * r;
        box(L0, st.plinth, cx, cy - 0.15, hd + 0.03, 0.36, 0.34, 0.1, 0, 0.03);
      }
    }
  }
  if (o.accent) {
    // accent emblem disc on the gable (gym type colour through an emissive surface)
    lathe(L0, o.accent, [[0.001, 0], [0.34, 0.001], [0.34, 0.06], [0.001, 0.07]], { segments: 12, smooth: false }, trs(0, wallTop + rise * 0.45, hd + 0.02 + jetty).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
  }

  yield 'building:dressing';
  const order: SurfaceId[] = [st.wall, st.upperWall, roofSurface, st.plinth, ...(st.frame ? [st.frame] : []), st.door, st.glass, st.litGlass, st.trim, st.sill, st.metal];
  return propGeo(L0, L1, L2, null, order);
}
