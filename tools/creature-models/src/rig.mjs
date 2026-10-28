// Rigs a built creature GLB: a skeleton, rigid skin weights and baked animation clips, from rigs/<id>.mjs.
//
//   node src/rig.mjs <id …>     packages/client/public/creature-models/<id>.glb -> <id>.rig.glb (+ index.json)
//   node src/rig.mjs --all      every rigs/<id>.mjs
//
// The static GLB (build.mjs) is the input and stays on disk; index.json serves the rigged one in its place
// (index.mjs). The game plays the clips by name (render IMPLEMENTATION-NOTES "Rigged creatures").
//
// A rig file (rigs/flowbot.mjs is the worked example) authors everything in the scad's own frame and units: Z up,
// the creature faces -Y, +X is the creature's left (the viewer's right), the numbers of scad/<id>.scad. It exports:
//   frame   { height, minZ }: the scad model's height and lowest z (the GLB is that box normalised to 1 m, feet at 0)
//   joints  [{ name, parent?, at: [x, y, z], rot?: [rx, ry, rz], scale? }]: parents first; `at` the pivot in scad
//           coordinates, `rot` a rest rotation (degrees, OpenSCAD rotate() order), `scale` the rest scale (1e-4 hides
//           a part until a clip shows it, e.g. alternate eyes)
//   assign  (centroid [x, y, z], rgb sRGB 0..1, glows) => joint name, per triangle of the static mesh; null drops the
//           triangle (a base or stand the rigged creature does without), and the rest is refitted to 1 m, feet on 0
//   extras  [{ joint, color: [r, g, b], at, size, rot? }]: boxes added to the mesh in a joint's rest frame (relative
//           to its pivot, scad axes), e.g. expression strokes the scad never had
//   clips   { [name]: { seconds, pose(t, u) => { [joint]: { r?: [rx, ry, rz], p?: [dx, dy, dz], s?: n | [x, y, z] } } } }
//           sampled at FPS; t in seconds, u = t / seconds. r rotates in the joint's frame (degrees, rotate() order),
//           p offsets it (scad units), s scales it. A joint a clip leaves out holds its rest pose.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, reorder, resample, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { writeIndex } from './index.mjs';
import { OUT_DIR, RIG_DIR } from './paths.mjs';

const FPS = 30;
const EPS = 1e-5;

/** Rigs one creature: reads OUT_DIR/<id>.glb and rigs/<id>.mjs, writes OUT_DIR/<id>.rig.glb. */
export async function rig(id) {
  const def = (await import(`${pathToFileURL(join(RIG_DIR, `${id}.mjs`)).href}?t=${Date.now()}`)).default;
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const src = readMesh(await io.read(join(OUT_DIR, `${id}.glb`)));
  const k0 = 1 / def.frame.height;
  const toScad = (p) => [p[0] / k0, -p[2] / k0, p[1] / k0 + def.frame.minZ];

  // which joint each triangle of the static mesh belongs to (its centroid and colour decide); null drops it
  const kept = [];
  let lo = Infinity;
  let hi = -Infinity;
  let dropped = 0;
  for (let t = 0; t < src.idx.length; t += 3) {
    const tri = [src.idx[t], src.idx[t + 1], src.idx[t + 2]];
    const c = [0, 1, 2].map((a) => tri.reduce((s, v) => s + src.pos[v * 3 + a], 0) / 3);
    const lin = [0, 1, 2].map((a) => src.col[tri[0] * 4 + a]);
    const name = def.assign(toScad(c), lin.map(linearToSrgb), src.col[tri[0] * 4 + 3] > 0.5);
    if (name === null) { dropped++; continue; }
    kept.push([tri, name]);
    for (const v of tri) { const z = toScad([src.pos[v * 3], src.pos[v * 3 + 1], src.pos[v * 3 + 2]])[2]; lo = Math.min(lo, z); hi = Math.max(hi, z); }
  }
  // with parts dropped (a base, a stand) the rest is refitted: 1 m tall again, its lowest point on the ground
  const frame = dropped > 0 ? { height: hi - lo, minZ: lo } : def.frame;
  const k = 1 / frame.height;
  const toGlb = (p) => [p[0] * k, (p[2] - frame.minZ) * k, -p[1] * k];
  const dirGlb = (d) => [d[0] * k, d[2] * k, -d[1] * k];

  // joints: rest local TRS (GLB frame) and rest world matrices (the bind pose, scale 1)
  const J = def.joints.map((j) => ({ ...j }));
  const index = new Map(J.map((j, i) => [j.name, i]));
  for (const j of J) {
    if (j.parent !== undefined && !(index.get(j.parent) < index.get(j.name))) throw new Error(`${id}: joint ${j.name}'s parent ${j.parent} must come first`);
    const p = j.parent === undefined ? null : J[index.get(j.parent)];
    j.restQ = scadQuat(j.rot ?? [0, 0, 0]);
    // the pivot relative to the parent, in the parent's rest frame
    const rel = p === null ? toGlb(j.at) : qRotate(qConj(p.worldQ), dirGlb(sub(j.at, p.at)));
    j.restT = rel;
    j.worldQ = p === null ? j.restQ : qMul(p.worldQ, j.restQ);
    j.world = p === null ? compose(rel, j.restQ, [1, 1, 1]) : mMul(p.world, compose(rel, j.restQ, [1, 1, 1]));
    j.restS = scale3(j.scale ?? 1);
  }

  // mesh: the kept triangles on their joints, plus the extras' boxes
  const pos = [];
  const nrm = [];
  const col = [];
  const jnt = [];
  const used = J.map(() => 0);
  for (const [tri, name] of kept) {
    const ji = index.get(name);
    if (ji === undefined) throw new Error(`${id}: assign() returned unknown joint '${name}'`);
    used[ji]++;
    for (const v of tri) {
      pos.push(...toGlb(toScad([src.pos[v * 3], src.pos[v * 3 + 1], src.pos[v * 3 + 2]])));
      nrm.push(src.nrm[v * 3], src.nrm[v * 3 + 1], src.nrm[v * 3 + 2]);
      col.push(src.col[v * 4], src.col[v * 4 + 1], src.col[v * 4 + 2], src.col[v * 4 + 3]);
      jnt.push(ji);
    }
  }
  for (const e of def.extras ?? []) {
    const ji = index.get(e.joint);
    if (ji === undefined) throw new Error(`${id}: extra on unknown joint '${e.joint}'`);
    const lin = e.color.map(srgbToLinear);
    const boxQ = scadQuat(e.rot ?? [0, 0, 0]);
    for (const [p, n] of boxTriangles(e.size)) {
      // box space (scad axes, scad units) -> the joint's rest frame -> GLB world
      const local = qRotate(J[ji].worldQ, dirGlb(add(e.at, qRotateScad(e.rot ?? [0, 0, 0], p))));
      const w = mApply(J[ji].world, [0, 0, 0]);
      pos.push(w[0] + local[0], w[1] + local[1], w[2] + local[2]);
      const nn = norm3(qRotate(J[ji].worldQ, qRotate(boxQ, scadToGlbDir(n))));
      nrm.push(...nn);
      col.push(...lin, 0);
      jnt.push(ji);
    }
    used[ji]++;
  }
  for (const [i, j] of J.entries()) if (used[i] === 0 && j.parent !== undefined) console.warn(`warn ${id}: joint ${j.name} has no geometry`);

  const doc = new Document();
  const buffer = doc.createBuffer();
  const n = jnt.length;
  const joints = new Uint8Array(n * 4);
  const weights = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { joints[i * 4] = jnt[i]; weights[i * 4] = 1; }
  if (J.length > 255) throw new Error(`${id}: ${J.length} joints (max 255)`);
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array(pos)))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array(nrm)))
    .setAttribute('COLOR_0', acc('VEC4', new Float32Array(col)))
    .setAttribute('JOINTS_0', acc('VEC4', joints))
    .setAttribute('WEIGHTS_0', acc('VEC4', weights))
    .setMaterial(doc.createMaterial('creature').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.75).setMetallicFactor(0));
  const mesh = doc.createMesh('creature').addPrimitive(prim);
  const nodes = J.map((j) => doc.createNode(j.name).setTranslation(j.restT).setRotation(j.restQ).setScale(j.restS));
  const scene = doc.createScene();
  for (const [i, j] of J.entries()) {
    if (j.parent === undefined) scene.addChild(nodes[i]);
    else nodes[index.get(j.parent)].addChild(nodes[i]);
  }
  const ibm = new Float32Array(J.length * 16);
  for (const [i, j] of J.entries()) ibm.set(mInvert(j.world), i * 16);
  const skin = doc.createSkin('creature').setInverseBindMatrices(acc('MAT4', ibm));
  for (const nd of nodes) skin.addJoint(nd);
  if (J.some((j) => j.parent === undefined && j !== J[0])) throw new Error(`${id}: one root joint (the first)`);
  skin.setSkeleton(nodes[0]);
  scene.addChild(doc.createNode('creature').setMesh(mesh).setSkin(skin));

  // clips: every clip carries a track for every channel any clip moves, so a cross-fade never falls back to rest
  const sampled = {};
  for (const [name, clip] of Object.entries(def.clips)) {
    const frames = Math.max(1, Math.round(clip.seconds * FPS));
    const times = [];
    const poses = [];
    for (let f = 0; f <= frames; f++) {
      const t = (f / frames) * clip.seconds;
      times.push(t);
      poses.push(clip.pose(t, t / clip.seconds) ?? {});
    }
    for (const jn of Object.keys(poses[0])) if (!index.has(jn)) throw new Error(`${id}: clip ${name} moves unknown joint '${jn}'`);
    sampled[name] = { times, poses };
  }
  const moved = { r: new Set(), p: new Set(), s: new Set() };
  for (const { poses } of Object.values(sampled)) for (const pose of poses) for (const [jn, q] of Object.entries(pose)) for (const ch of ['r', 'p', 's']) if (q[ch] !== undefined) moved[ch].add(jn);
  for (const [name, { times, poses }] of Object.entries(sampled)) {
    const anim = doc.createAnimation(name);
    const channel = (ji, path, values, width) => {
      const constant = values.every((v, i) => Math.abs(v - values[i % width]) < EPS);
      const input = constant ? new Float32Array([0]) : new Float32Array(times);
      const output = constant ? new Float32Array(values.slice(0, width)) : new Float32Array(values);
      const sampler = doc.createAnimationSampler().setInput(acc('SCALAR', input)).setOutput(acc(width === 4 ? 'VEC4' : 'VEC3', output)).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodes[ji]).setTargetPath(path).setSampler(sampler));
    };
    for (const [ji, j] of J.entries()) {
      if (moved.r.has(j.name)) {
        const v = [];
        let prev = null;
        for (const pose of poses) {
          let q = qMul(j.restQ, scadQuat(pose[j.name]?.r ?? [0, 0, 0]));
          if (prev !== null && q[0] * prev[0] + q[1] * prev[1] + q[2] * prev[2] + q[3] * prev[3] < 0) q = q.map((x) => -x);
          v.push(...q);
          prev = q;
        }
        channel(ji, 'rotation', v, 4);
      }
      if (moved.p.has(j.name)) {
        // the offset is in the joint's own rest frame, like r
        const v = poses.flatMap((pose) => add(j.restT, qRotate(j.restQ, dirGlb(pose[j.name]?.p ?? [0, 0, 0]))));
        channel(ji, 'translation', v, 3);
      }
      if (moved.s.has(j.name)) {
        const v = poses.flatMap((pose) => (pose[j.name]?.s === undefined ? j.restS : scale3(pose[j.name].s)).map((x) => Math.max(1e-4, x)));
        channel(ji, 'scale', v, 3);
      }
    }
  }

  await doc.transform(
    weld(),
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    resample({ tolerance: 1e-4 }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8, quantizeWeight: 8 }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const bytes = Buffer.from(await io.writeBinary(doc));
  writeFileSync(join(OUT_DIR, `${id}.rig.glb`), bytes);
  if (dropped > 0) console.log(`rig ${id}: dropped ${dropped} triangles, refitted to scad z ${lo.toFixed(2)}..${hi.toFixed(2)}`);
  console.log(`rig ${id}: ${J.length} joints, ${Object.keys(def.clips).length} clips (${Object.keys(def.clips).join(', ')}), ${(bytes.length / 1024).toFixed(0)} KiB`);
}

/** The static GLB's one mesh: positions (metres, node transform applied), normals, linear rgba colours, indices. */
function readMesh(doc) {
  const node = doc.getRoot().listNodes().find((x) => x.getMesh() !== null);
  if (!node) throw new Error('no mesh');
  const prim = node.getMesh().listPrimitives()[0];
  const m = node.getWorldMatrix();
  const P = prim.getAttribute('POSITION');
  const N = prim.getAttribute('NORMAL');
  const C = prim.getAttribute('COLOR_0');
  const count = P.getCount();
  const pos = new Float64Array(count * 3);
  const nrm = new Float64Array(count * 3);
  const col = new Float64Array(count * 4);
  const v = [];
  for (let i = 0; i < count; i++) {
    P.getElement(i, v);
    pos.set(mApply(m, v), i * 3);
    N.getElement(i, v);
    nrm.set(norm3(mApplyDir(m, v)), i * 3);
    C.getElement(i, v);
    col.set(v.length === 4 ? v : [...v, 0], i * 4);
  }
  return { pos, nrm, col, idx: prim.getIndices().getArray() };
}

/** A box of `size` centred at the origin: 12 triangles as [position, normal] corners, scad axes. */
function boxTriangles(size) {
  const h = size.map((x) => x / 2);
  const out = [];
  for (let a = 0; a < 3; a++) for (const sgn of [-1, 1]) {
    const b = (a + 1) % 3;
    const c = (a + 2) % 3;
    const nn = [0, 0, 0];
    nn[a] = sgn;
    const corner = (u, w) => { const p = [0, 0, 0]; p[a] = sgn * h[a]; p[b] = u * h[b]; p[c] = w * h[c]; return p; };
    const quad = sgn > 0 ? [[-1, -1], [1, -1], [1, 1], [-1, 1]] : [[-1, -1], [-1, 1], [1, 1], [1, -1]];
    const q = quad.map(([u, w]) => corner(u, w));
    for (const tri of [[0, 1, 2], [0, 2, 3]]) for (const i of tri) out.push([q[i], nn]);
  }
  return out;
}

// ---- small maths: quaternions [x, y, z, w], column-major 4x4 matrices ----------------------------------------------

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const scale3 = (s) => (Array.isArray(s) ? [s[0], s[2], s[1]] : [s, s, s]);   // scad axes -> GLB axes
const scadToGlbDir = (d) => [d[0], d[2], -d[1]];
const deg = Math.PI / 180;

function qAxis(axis, a) {
  const s = Math.sin(a / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(a / 2)];
}

function qMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];

function qRotate(q, v) {
  const r = qMul(qMul(q, [v[0], v[1], v[2], 0]), qConj(q));
  return [r[0], r[1], r[2]];
}

/** OpenSCAD rotate([rx, ry, rz]) (x first, then y, then z, about the fixed axes) in the GLB frame. */
function scadQuat(r) {
  // scad axes in GLB: x -> x, y -> -z, z -> y
  const qx = qAxis([1, 0, 0], r[0] * deg);
  const qy = qAxis([0, 0, -1], r[1] * deg);
  const qz = qAxis([0, 1, 0], r[2] * deg);
  return qMul(qz, qMul(qy, qx));
}

/** rotate(r) applied to a scad-frame point, staying in the scad frame. */
function qRotateScad(r, p) {
  const g = qRotate(scadQuat(r), scadToGlbDir(p));
  return [g[0], -g[2], g[1]];
}

function compose(t, q, s) {
  const [x, y, z, w] = q;
  const m = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    t[0], t[1], t[2], 1,
  ];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] *= s[c];
  return m;
}

function mMul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function mApply(m, v) {
  return [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);
}

function mApplyDir(m, v) {
  return [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2]);
}

/** Inverse of a rigid (rotation + translation) matrix: the bind pose has scale 1. */
function mInvert(m) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
  o[15] = 1;
  return o;
}

function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const ids = args[0] === '--all' ? readdirSync(RIG_DIR).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)) : args;
  if (ids.length === 0) throw new Error('usage: rig.mjs <id …> | --all');
  let failed = 0;
  for (const id of ids) {
    if (!existsSync(join(RIG_DIR, `${id}.mjs`))) { console.error(`FAIL ${id}: no rigs/${id}.mjs`); failed++; continue; }
    try {
      await rig(id);
    } catch (e) {
      failed++;
      console.error(`FAIL ${id}: ${e.stack ?? e.message}`);
    }
  }
  writeIndex();
  if (failed > 0) process.exit(1);
}
