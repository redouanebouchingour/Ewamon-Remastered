// Shared rig for the people of the NPC set (scad/npc/_human.scad). A character's rig file is short:
//
//   import { human, K, osc, win, smooth } from './_human.mjs';
//   export default await human({ id: 'fb_x', H: 172, head: 1.08, girth: 1.06, grips: { L: true }, freeHand: 'pound',
//                                clips: (h) => ({ idle_fidget: h.fidget(2.2, (t, u, base) => ({ ...spec })) }) });
//
// H / head / girth MUST match the scad's human() call: the pivots below are the scad's landmark formulas.
//
// Joints: root (feet) > pelvis > thighL/R > shinL/R > footL/R; pelvis > spine > chest > neck > head > jaw, browL/R;
// chest > uarmL/R > farmL/R > handL/R. Pivots sit at ball centres (hips, knees, ankles, shoulders, elbows, wrists).
//
// Poses are written as a body SPEC (all optional, degrees / cm, own frame: Z up, facing -Y, +X the person's left):
//   root [x, y, z]             whole-body offset (a hop; the feet go with it)
//   pelvisP [x, y, z]          hip offset: bob < 0 bends the knees (the feet stay planted by leg IK)
//   pelvis, spine, chest, neck, head [rx, ry, rz]   local rotations (rx > 0 bends forward, rz > 0 turns to +X)
//   jaw                        mouth opening in degrees (0 = the scad's grin)
//   brows { raise, angry }     raise in cm (head units), angry 0..1 tilts the inner ends down (negative = worried)
//   handL / handR { at: [x, y, z], twist, pole: [x, y, z] }   the fist centre target (2-bone IK, elbow towards pole),
//                              twist turns the fist about the forearm
//   joints { name: { r, p, s } }   raw extra channels (a character's own joints)
// `h.solve(spec)` turns a spec into the clip pose; `h.playing(t)` is the idle playing spec at time t (seconds).
//
// Grips (contract): grip L = (+10, -24, 87), grip R = (-10, -24, 87), the fist centre on the grip.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { staticGlb } from '../../src/paths.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT = resolve(PKG, '../..');

export const GRIP = { L: [10, -24, 87], R: [-10, -24, 87] };
/** The table rim (cabinet wall top edge) in a player's own frame: y of the wall, z of the top. */
export const RIM = { y: -39, z: 92 };

// ---- maths -------------------------------------------------------------------------------------------------------

const TAU = Math.PI * 2;
const D = Math.PI / 180;
export const osc = (u, cycles, phase = 0) => Math.sin(TAU * (u * cycles + phase));
export const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
export const mixv = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t);
/** Eased keyframes [[u, value], …] (numbers or arrays), held before the first and after the last. */
export function K(u, keys) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) return mixv(keys[i - 1][1], keys[i][1], smooth((u - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  }
  return keys[keys.length - 1][1];
}
/** A window 0..1..0 between u0 and u1 with `fade` ramps. */
export const win = (u, u0, u1, fade = 0.08) => Math.min(smooth((u - u0) / fade), smooth((u1 - u) / fade));
export const hash = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
/** A sharp periodic flick: 0 most of the time, a quick 0 -> 1 -> 0 spike `n` times per loop (whole n = seamless). */
export const flick = (u, n, phase = 0, width = 0.18) => {
  const f = ((u * n + phase) % 1 + 1) % 1;
  return f < width ? Math.sin((Math.PI * f) / width) ** 2 : 0;
};

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mv = (A, v) => A.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const tr = (A) => [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);
/** OpenSCAD rotate([rx, ry, rz]) = Rz * Ry * Rx (degrees). */
export function rotM([rx, ry, rz]) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx * D), Math.sin(rx * D), Math.cos(ry * D), Math.sin(ry * D), Math.cos(rz * D), Math.sin(rz * D)];
  const X = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
  const Y = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const Z = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  return mm(Z, mm(Y, X));
}
/** The inverse of rotM: [rx, ry, rz] in degrees. */
function euler(R) {
  const ry = Math.asin(Math.max(-1, Math.min(1, -R[2][0])));
  if (Math.abs(R[2][0]) > 0.99999) return [Math.atan2(-R[1][2], R[1][1]) / D, ry / D, 0];
  return [Math.atan2(R[2][1], R[2][2]) / D, ry / D, Math.atan2(R[1][0], R[0][0]) / D];
}
function axisAngle(axis, a) {
  const [x, y, z] = unit(axis);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
}
/** The shortest rotation taking unit a to unit b. */
function arc(a, b) {
  const c = Math.max(-1, Math.min(1, dot(a, b)));
  const ax = cross(a, b);
  if (len(ax) < 1e-9) return c > 0 ? I3() : axisAngle(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]), Math.PI);
  return axisAngle(ax, Math.acos(c));
}
/** 2-bone IK: the middle joint for a chain root -> target with lengths a, b, bending towards `pole`. */
function twoBone(root, target, a, b, pole) {
  let d = sub(target, root);
  let dist = len(d);
  const n = unit(d);
  dist = Math.min(Math.max(dist, Math.abs(a - b) + 1e-3), a + b - 1e-3);
  const cosA = (a * a + dist * dist - b * b) / (2 * a * dist);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  let m = sub(pole, mul(n, dot(pole, n)));
  if (len(m) < 1e-6) m = Math.abs(n[2]) < 0.9 ? cross(n, [0, 0, 1]) : cross(n, [1, 0, 0]);
  m = unit(m);
  const mid = add(root, add(mul(n, a * cosA), mul(m, a * sinA)));
  return { mid, end: add(root, mul(n, dist)) };
}

// ---- the body's landmarks (scad/npc/_human.scad) -----------------------------------------------------------------

const SKULL = [13, 13.5, 16.5];
const ys = (x, z) => -SKULL[1] * Math.sqrt(Math.max(0, 1 - (x / SKULL[0]) ** 2 - (z / SKULL[2]) ** 2));
const B = {
  shoulder: [18.5, 0, 133], arm: [4, 0, -54], hip: [9, 0, 86], knee: [9.5, -0.5, 47], ankle: [9.5, 0, 9],
};
B.elbow = add(B.shoulder, mul(B.arm, 29 / 54));
B.wrist = add(B.shoulder, B.arm);
B.fist = add(B.wrist, [0.33, 0, -4.5]);

/** Every pivot of a person of height H, head scale, girth (the scad's formulas). */
export function pivots({ H = 178, head = 1, girth = 1 } = {}) {
  const s = H / 178;
  const hk = s * head * 1.18;
  const b = (p) => [p[0] * s * girth, p[1] * s * girth, p[2] * s];
  const hc = [0, -hk, 145 * s + 15 * hk];
  const hl = (p) => add(hc, mul(p, hk));
  const side = (p, m) => [p[0] * m, p[1], p[2]];
  const P = {
    s, hk, hc, hl, b,
    root: [0, 0, 0], pelvis: b([0, 0, 88]), spine: b([0, 0, 99]), chest: b([0, 0, 113]), neck: b([0, 0.5, 136]),
    head: b([0, 0.5, 148]), jaw: hl([0, 2, -3]),
    browL: hl([5.4, ys(5.4, 6.1) + 0.25, 6.1]), browR: hl([-5.4, ys(5.4, 6.1) + 0.25, 6.1]),
  };
  for (const [k, m] of [['L', 1], ['R', -1]]) {
    P[`thigh${k}`] = side(b(B.hip), m);
    P[`shin${k}`] = side(b(B.knee), m);
    P[`foot${k}`] = side(b(B.ankle), m);
    P[`uarm${k}`] = side(b(B.shoulder), m);
    P[`farm${k}`] = side(b(B.elbow), m);
    P[`hand${k}`] = side(b(B.wrist), m);
    P[`fist${k}`] = side(b(B.fist), m);
    P[`toe${k}`] = side(b([B.ankle[0], -13, 3]), m);
  }
  return P;
}

const PARENT = {
  root: undefined, pelvis: 'root', thighL: 'pelvis', shinL: 'thighL', footL: 'shinL', thighR: 'pelvis', shinR: 'thighR', footR: 'shinR',
  spine: 'pelvis', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head', browL: 'head', browR: 'head',
  uarmL: 'chest', farmL: 'uarmL', handL: 'farmL', uarmR: 'chest', farmR: 'uarmR', handR: 'farmR',
};

// ---- which shell belongs to which joint ------------------------------------------------------------------------

/** The static GLB's triangles in scad coordinates, grouped into shells (connected by shared positions). */
async function shells(id, frame) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  // the rig's input: glb/npc/ once rigged (paths.mjs staticGlb), the public folder before
  const doc = await io.read(staticGlb(id));
  const node = doc.getRoot().listNodes().find((x) => x.getMesh() !== null);
  const prim = node.getMesh().listPrimitives()[0];
  const m = node.getWorldMatrix();
  const P = prim.getAttribute('POSITION');
  const C = prim.getAttribute('COLOR_0');
  const idx = prim.getIndices().getArray();
  const k = frame.height;
  const pos = [];
  const col = [];
  const v = [];
  for (let i = 0; i < P.getCount(); i++) {
    P.getElement(i, v);
    const w = [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);
    pos.push([w[0] * k, -w[2] * k, w[1] * k + frame.minZ]);
    C.getElement(i, v);
    col.push(v.slice(0, 3).map((c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)));
  }
  // union-find over vertices, joining equal positions too (colour seams and creases split the welded vertices)
  const parent = pos.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join2 = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const byPos = new Map();
  pos.forEach((p, i) => {
    const key = p.map((x) => Math.round(x * 50)).join(',');
    if (byPos.has(key)) join2(i, byPos.get(key)); else byPos.set(key, i);
  });
  for (let t = 0; t < idx.length; t += 3) { join2(idx[t], idx[t + 1]); join2(idx[t], idx[t + 2]); }
  const groups = new Map();
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const centroid = [0, 1, 2].map((ax) => (pos[a][ax] + pos[b][ax] + pos[c][ax]) / 3);
    const area = len(cross(sub(pos[b], pos[a]), sub(pos[c], pos[a]))) / 2;
    const g = find(a);
    if (!groups.has(g)) groups.set(g, { tris: 0, area: 0, sum: [0, 0, 0], lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity], colors: new Set() });
    const G = groups.get(g);
    G.tris++;
    G.area += area;
    G.sum = add(G.sum, mul(centroid, area));
    for (let ax = 0; ax < 3; ax++) { G.lo[ax] = Math.min(G.lo[ax], centroid[ax]); G.hi[ax] = Math.max(G.hi[ax], centroid[ax]); }
    G.colors.add(col[a].map((x) => x.toFixed(2)).join(','));
    tris.push({ centroid, g });
  }
  for (const G of groups.values()) G.centroid = mul(G.sum, 1 / (G.area || 1));
  return { tris, groups };
}

/** Point-to-segment distance. */
function segDist(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return len(sub(p, add(a, mul(ab, t))));
}

/** The model's height in scad units from the build's 3MF (the GLB is normalised), else `top`. */
function measureTop(id, top) {
  const f = join(PKG, '.cache/work', `${id}.3mf`);
  if (existsSync(f)) {
    const xml = execFileSync('unzip', ['-p', f, '3D/3dmodel.model'], { maxBuffer: 1 << 30 }).toString();
    let hi = -Infinity;
    let lo = Infinity;
    for (const m of xml.matchAll(/<vertex x="[^"]+" y="[^"]+" z="([^"]+)"/g)) { hi = Math.max(hi, +m[1]); lo = Math.min(lo, +m[1]); }
    if (top !== undefined && Math.abs(hi - top) > 0.05) console.warn(`warn ${id}: top ${top} in the rig file, the build says ${hi.toFixed(2)}`);
    return { height: hi - lo, minZ: lo };
  }
  if (top === undefined) throw new Error(`${id}: no .cache/work/${id}.3mf to measure; pass top (the scad's max z)`);
  return { height: top, minZ: 0 };
}

// ---- the person ------------------------------------------------------------------------------------------------

/**
 * Builds a person's rig. Options:
 *   id, H, head, girth          as in the scad (the pivots); top: the scad's max z (only used without a fresh build)
 *   grips { L, R }              which hands hold their grip in the playing loop
 *   freeHand                    'pound' (pounds the table rim), 'pump' (fist pumps), 'hip', 'rim' (rests on the rim)
 *                               or (t, u) => hand spec, for a hand that holds no grip
 *   energy, hunch, tempo        the playing loop's bounce / shoulder / head amplitude (1), forward lean (1), seconds (2.4)
 *   phase                       0..1 offset of the loop's beats (so two people are not in step)
 *   jawRest                     the playing loop's mouth opening in degrees (0)
 *   joints, extras              extra joints ({ name, parent, at, rot?, scale? }) and extra boxes (rig.mjs format)
 *   classify(shell)             => joint name | undefined for a character's own shells (props), before the default
 *   playing(t, u, base, h)      => spec: adjusts the playing loop (base = the default spec at t)
 *   clips(h)                    => { name: clip }: extra clips (h.fidget / h.solve / h.playing ... below)
 */
export async function human(o) {
  const { id, H = 178, head = 1, girth = 1, grips = {}, freeHand = 'rim', energy = 1, hunch = 1, tempo = 2.4, phase = 0, jawRest = 0 } = o;
  const P = pivots({ H, head, girth });
  const frame = measureTop(id, o.top);
  const s = P.s;

  // joints
  const names = Object.keys(PARENT);
  const joints = names.map((name) => ({ name, ...(PARENT[name] ? { parent: PARENT[name] } : {}), at: P[name] }));
  for (const j of o.joints ?? []) joints.push(j);
  const jointAt = Object.fromEntries(joints.map((j) => [j.name, j.at]));
  const parentOf = Object.fromEntries(joints.map((j) => [j.name, j.parent]));

  // assignment: whole shells to the nearest bone
  const bones = [
    ['pelvis', P.pelvis, P.b([0, 0, 96])], ['spine', P.spine, P.b([0, 0, 108])], ['chest', P.chest, P.b([0, 0, 134])],
    ['neck', P.neck, P.b([0, 0.5, 142])], ['head', P.hc, P.hl([0, 0, 6])], ['jaw', P.hl([0, -6, -11]), P.hl([0, -6, -11])],
    ['browL', P.browL, P.browL], ['browR', P.browR, P.browR],
  ];
  for (const k of ['L', 'R']) {
    bones.push([`thigh${k}`, P[`thigh${k}`], P[`shin${k}`]], [`shin${k}`, P[`shin${k}`], P[`foot${k}`]], [`foot${k}`, P[`foot${k}`], P[`toe${k}`]],
      [`uarm${k}`, P[`uarm${k}`], P[`farm${k}`]], [`farm${k}`, P[`farm${k}`], P[`hand${k}`]], [`hand${k}`, P[`fist${k}`], P[`fist${k}`]]);
  }
  const { tris, groups } = await shells(id, frame);
  const owner = new Map();
  for (const [g, G] of groups) {
    let name = o.classify?.(G, P);
    if (name === undefined) {
      let best = Infinity;
      for (const [n, a, b] of bones) { const d = segDist(G.centroid, a, b); if (d < best) { best = d; name = n; } }
    }
    owner.set(g, name);
  }
  if (process.env.HUMAN_DEBUG) {
    for (const [g, G] of groups) console.log(`shell ${String(owner.get(g)).padEnd(7)} ${String(G.tris).padStart(5)} tris  c ${G.centroid.map((x) => x.toFixed(1)).join(' ')}  ${[...G.colors].slice(0, 4).join(' | ')}`);
  }
  // rig.mjs passes each triangle's centroid in scad coordinates: look it up on a grid
  const grid = new Map();
  const cell = (c) => c.map((x) => Math.floor(x / 0.5)).join(',');
  for (const t of tris) { const key = cell(t.centroid); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(t); }
  function assign(c) {
    const [i, j, k] = c.map((x) => Math.floor(x / 0.5));
    let best = null;
    let bd = Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) {
      for (const t of grid.get(`${i + a},${j + b},${k + d}`) ?? []) {
        const dd = len(sub(t.centroid, c));
        if (dd < bd) { bd = dd; best = t; }
      }
    }
    if (best === null) throw new Error(`${id}: no shell triangle near ${c.map((x) => x.toFixed(2))}`);
    return owner.get(best.g);
  }

  // ---- forward kinematics + IK: spec -> pose ----
  const armLen = {};
  for (const k of ['L', 'R']) {
    const S = P[`uarm${k}`];
    const E = P[`farm${k}`];
    const F = P[`fist${k}`];
    armLen[k] = { a: len(sub(E, S)), b: len(sub(F, E)), u0: unit(sub(E, S)), f0: unit(sub(F, E)), w: sub(P[`hand${k}`], E) };
  }
  const legLen = {};
  for (const k of ['L', 'R']) {
    const Hh = P[`thigh${k}`];
    const Kn = P[`shin${k}`];
    const A = P[`foot${k}`];
    legLen[k] = { a: len(sub(Kn, Hh)), b: len(sub(A, Kn)), t0: unit(sub(Kn, Hh)), s0: unit(sub(A, Kn)) };
  }

  function solve(spec = {}) {
    const out = {};
    const W = {};   // world { R, p } per joint
    const put = (name, r, p) => {
      const par = parentOf[name];
      const R = rotM(r ?? [0, 0, 0]);
      if (par === undefined) W[name] = { R, p: add(jointAt[name], p ?? [0, 0, 0]) };
      else {
        const Pw = W[par];
        W[name] = { R: mm(Pw.R, R), p: add(Pw.p, mv(Pw.R, add(sub(jointAt[name], jointAt[par]), p ?? [0, 0, 0]))) };
      }
      out[name] = { r: r ?? [0, 0, 0], ...(p ? { p } : {}) };
    };
    const z3 = [0, 0, 0];
    put('root', z3, spec.root ?? z3);
    put('pelvis', spec.pelvis ?? z3, spec.pelvisP ?? z3);
    put('spine', spec.spine ?? z3);
    put('chest', spec.chest ?? z3);
    put('neck', spec.neck ?? z3);
    put('head', spec.head ?? z3);
    put('jaw', [spec.jaw ?? 0, 0, 0]);
    const br = spec.brows ?? {};
    for (const [k, m] of [['L', 1], ['R', -1]]) {
      // angry: the inner end down (left brow: ry < 0 lifts its outer end)
      put(`brow${k}`, [0, -m * 14 * (br.angry ?? 0), 0], [0, 0, (br.raise ?? 0) * P.hk]);
    }
    // legs: the ankle stays where the root puts it, the knee bends forward
    for (const k of ['L', 'R']) {
      const L = legLen[k];
      const Pw = W.pelvis;
      const hip = add(Pw.p, mv(Pw.R, sub(P[`thigh${k}`], P.pelvis)));
      const ankle = add(add(P[`foot${k}`], spec.root ?? z3), [0, 0, 0]);
      const { mid } = twoBone(hip, ankle, L.a, L.b, [0, -1, 0.15]);
      const Rt = arc(L.t0, unit(sub(mid, hip)));
      const Rs = arc(mv(Rt, L.s0), unit(sub(ankle, mid)));
      const RsW = mm(Rs, Rt);
      put(`thigh${k}`, euler(mm(tr(Pw.R), Rt)));
      put(`shin${k}`, euler(mm(tr(Rt), RsW)));
      put(`foot${k}`, euler(tr(RsW)));
    }
    // arms
    for (const [k, m] of [['L', 1], ['R', -1]]) {
      const A = armLen[k];
      const hs = spec[`hand${k}`] ?? { at: add(P[`fist${k}`], [0, 0, 0]) };
      const Cw = W.chest;
      const sh = add(Cw.p, mv(Cw.R, sub(P[`uarm${k}`], P.chest)));
      const pole = hs.pole ?? [m, 0.6, -0.2];
      const { mid, end } = twoBone(sh, hs.at, A.a, A.b, pole);
      const Ru = arc(A.u0, unit(sub(mid, sh)));
      const Rf = mm(arc(mv(Ru, A.f0), unit(sub(end, mid))), Ru);
      put(`uarm${k}`, euler(mm(tr(Cw.R), Ru)));
      put(`farm${k}`, euler(mm(tr(Ru), Rf)));
      put(`hand${k}`, euler(axisAngle(A.f0, (hs.twist ?? 0) * D * m)));
      W[`fist${k}`] = { p: add(W[`hand${k}`].p, mv(W[`hand${k}`].R, sub(P[`fist${k}`], P[`hand${k}`]))) };
    }
    for (const [name, q] of Object.entries(spec.joints ?? {})) out[name] = q;
    solve.world = W;
    return out;
  }

  // ---- specs: blend helpers and the playing loop ----
  /** Blends two specs (b weighted w); hands blend their targets, so the IK keeps the fists on a straight path. */
  function blend(a, b, w) {
    if (w <= 0) return a;
    if (w >= 1) return b;
    const out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[key];
      const y = b[key];
      if (x === undefined || y === undefined) out[key] = mixAny(x ?? zeroOf(y, key), y ?? zeroOf(x, key), w);
      else out[key] = mixAny(x, y, w);
    }
    return out;
  }
  const zeroOf = (v, key) => (key.startsWith('hand') ? { at: P[`fist${key.slice(4)}`] } : zeroLike(v));
  const zeroLike = (v) => (typeof v === 'number' ? 0 : Array.isArray(v) ? v.map(() => 0) : Object.fromEntries(Object.entries(v).map(([k2, x]) => [k2, k2 === 's' ? 1 : zeroLike(x)])));
  function mixAny(x, y, w) {
    if (typeof x === 'number') return x + (y - x) * w;
    if (Array.isArray(x)) return x.map((v, i) => v + (y[i] - v) * w);
    const out = {};
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      const xv = x[k] ?? (k === 's' ? 1 : (k === 'pole' ? y[k] : zeroLike(y[k])));
      const yv = y[k] ?? (k === 's' ? 1 : (k === 'pole' ? x[k] : zeroLike(x[k])));
      out[k] = mixAny(xv, yv, w);
    }
    return out;
  }

  const e = energy;
  const hn = hunch;
  /** The hand on a grip while playing: slides in / out and spins in bursts. */
  const gripHand = (k, u, ph) => {
    const m = k === 'L' ? 1 : -1;
    const slide = 2.2 * osc(u, 3, ph) + 2.5 * flick(u, 2, ph + 0.3, 0.12);
    return {
      at: add(GRIP[k], [0.6 * m * osc(u, 2, ph), -slide, 0.6 * osc(u, 6, ph)]),
      twist: 22 * osc(u, 4, ph) + 75 * flick(u, 2, ph + 0.31, 0.12),
      pole: [m, 0.55, 0.15],
    };
  };
  /** The free hand while playing. */
  const freeSpec = (k, t, u) => {
    const m = k === 'L' ? 1 : -1;
    if (typeof freeHand === 'function') return freeHand(t, u, k);
    if (freeHand === 'pound') {
      // two slams on the rim per loop: wind up, smash, bounce
      const f = ((u * 2 + phase + 0.5) % 1 + 1) % 1;
      const lift = f < 0.55 ? smooth(f / 0.55) : f < 0.7 ? 1 - smooth((f - 0.55) / 0.15) : 0.08 * Math.sin(((f - 0.7) / 0.3) * Math.PI);
      return { at: [m * 22 * s, RIM.y - 1, RIM.z + 5 + 14 * lift], twist: 10 * lift, pole: [m, 0.7, -0.1] };
    }
    if (freeHand === 'pump') {
      const f = ((u * 2 + phase) % 1 + 1) % 1;
      return { at: [m * 26 * s, -6, 118 * s + 22 * s * Math.sin(Math.PI * f) ** 2], twist: 0, pole: [m, 0.3, -0.6] };
    }
    if (freeHand === 'hip') return { at: P.b([m * 17, -1, 92]), twist: -40, pole: [m, 0.9, 0] };
    return { at: [m * 21 * s, RIM.y - 1, RIM.z + 4.5 + 0.8 * osc(u, 4, phase)], twist: 0, pole: [m, 0.6, -0.1] };
  };
  /** The default playing spec at time t (hunched, bouncing, wrists working, head tracking the ball). */
  function playingBase(t) {
    const u = (((t / tempo) % 1) + 1) % 1;
    const ph = phase;
    const spec = {
      pelvisP: [0.8 * e * osc(u, 2, ph), 0, -2.6 - 1.5 * e * (0.5 + 0.5 * osc(u, 4, ph))],
      pelvis: [11 * hn, 0, 3 * e * osc(u, 2, ph + 0.05)],
      spine: [8 * hn + 1.5 * e * osc(u, 4, ph + 0.1), 0, 2 * e * osc(u, 2, ph + 0.1)],
      chest: [11 * hn + 2.5 * e * osc(u, 4, ph + 0.2), 2.5 * e * osc(u, 2, ph + 0.25), 4 * e * osc(u, 2, ph + 0.3)],
      neck: [-12 * hn, 0, 0],
      head: [10 + 3 * osc(u, 4, ph + 0.35), 2 * osc(u, 2, ph), 13 * e * osc(u, 2, ph + 0.4) + 4 * flick(u, 4, ph, 0.2)],
      jaw: jawRest + 2 * (0.5 + 0.5 * osc(u, 4, ph)),
      brows: { raise: -0.3, angry: 0.35 },
    };
    for (const k of ['L', 'R']) spec[`hand${k}`] = grips[k] ? gripHand(k, u, ph + (k === 'R' ? 0.13 : 0)) : freeSpec(k, t, u);
    return spec;
  }
  const playing = (t) => {
    const base = playingBase(t);
    return o.playing ? o.playing(t, (((t / tempo) % 1) + 1) % 1, base, h) : base;
  };

  /**
   * A one-shot clip that starts and ends on the playing pose at t = 0: `body(t, u, base)` returns the spec to blend in,
   * weighted by `weight(u)` (default: in over the first 15 %, out over the last 15 %). The playing loop runs underneath
   * at a whole number of cycles, so the clip ends where it began.
   */
  function fidget(seconds, body, { inn = 0.15, out = 0.15, weight } = {}) {
    const cycles = Math.max(1, Math.round(seconds / tempo));
    return {
      seconds,
      pose: (t, u) => {
        const base = playing(u * cycles * tempo);
        const w = weight ? weight(u) : Math.min(smooth(u / inn), smooth((1 - u) / out));
        const b = body(t, u, base);
        // a character's own joints (expression swaps, props) are set as they are, not blended
        return solve({ ...blend(base, b, w), joints: { ...base.joints, ...b.joints } });
      },
    };
  }

  const h = { P, solve, blend, playing, fidget, gripHand, freeSpec, GRIP, RIM, s, tempo };

  // ---- the built-in clips ----
  const clips = {
    idle: { seconds: tempo, pose: (t) => solve(playing(t)) },
    // looks up at the player (+X side, towards the camera), chats with both hands, back to the table
    talk: fidget(2.6, (t, u) => ({
      pelvisP: [0, 0, -1],
      pelvis: [3, 0, 6],
      spine: [2, 0, 6],
      chest: [1 + 2 * osc(u, 3), 0, 14 + 4 * osc(u, 2)],
      neck: [-4, 0, 10],
      head: [-6 + 4 * osc(u, 5), 6 * osc(u, 2.5), 26],
      jaw: 4 + 11 * Math.abs(Math.sin(u * 7 * Math.PI)),
      brows: { raise: 0.4 + 0.2 * osc(u, 3), angry: -0.35 },
      handL: { at: P.b([24 + 4 * osc(u, 2.5), -26 + 3 * osc(u, 5), 112 + 6 * osc(u, 2.5, 0.2)]), twist: -30 + 25 * osc(u, 5), pole: [1, 0.5, -0.6] },
      handR: { at: P.b([-14 + 3 * osc(u, 2, 0.3), -24 + 2 * osc(u, 4), 104 + 4 * osc(u, 3, 0.1)]), twist: 20, pole: [-1, 0.6, -0.5] },
    }), { inn: 0.18, out: 0.2 }),
    // a goal: crouch, jump with both fists up, two pumps, land, back to the rods
    cheer: fidget(2.2, (t, u) => {
      const hop = K(u, [[0.12, 0], [0.24, 0], [0.36, 9], [0.48, 0], [1, 0]]);
      const crouch = K(u, [[0.05, 0], [0.18, -9], [0.27, 0], [0.48, 0], [0.56, -6], [0.7, -1.5], [1, -1.5]]);
      const pump = Math.sin(Math.max(0, u - 0.5) / 0.4 * 2 * Math.PI * 2) ** 2;
      const up = K(u, [[0.12, 0], [0.3, 1], [1, 1]]);
      return {
        root: [0, 0, hop],
        pelvisP: [0, 0, crouch],
        pelvis: [K(u, [[0.1, 4], [0.18, 14], [0.3, -4], [1, -2]]), 0, 0],
        spine: [K(u, [[0.18, 6], [0.3, -6], [1, -4]]), 0, 0],
        chest: [K(u, [[0.18, 6], [0.3, -10], [1, -8]]) + 3 * pump, 0, 0],
        neck: [-6, 0, 0],
        head: [K(u, [[0.18, 8], [0.32, -24], [1, -18]]) - 6 * pump, 0, 4 * osc(u, 3)],
        jaw: K(u, [[0.15, 2], [0.3, 26], [0.85, 22], [1, 20]]),
        brows: { raise: 0.5, angry: -0.3 },
        handL: { at: P.b([26 + 18 * up, -4, 120 + 62 * up - 10 * pump]), twist: 0, pole: [1, 0.2, -0.7] },
        handR: { at: P.b([-26 - 18 * up, -4, 120 + 62 * up - 10 * pump]), twist: 0, pole: [-1, 0.2, -0.7] },
      };
    }, { inn: 0.12, out: 0.14 }),
  };
  Object.assign(clips, o.clips?.(h) ?? {});

  return { frame, joints, assign, extras: o.extras ?? [], clips, human: h };
}
