// Rigs a built creature GLB: a skeleton, rigid skin weights and baked animation clips, from rigs/<id>.mjs.
//
//   node src/rig.mjs <id …>     the static <id>.glb -> packages/client/public/creature-models/<id>.rig.glb (+ index.json)
//   node src/rig.mjs --all      every rigs/<id>.mjs
//   RIG_PARTS=1 node src/rig.mjs <id>   colours each joint's triangles apart (checking assign(); re-rig after)
//   node src/rig.mjs --npc …    the NPC set (rigs/npc/ -> public/npc-models/, paths.mjs)
//
// The static GLB (build.mjs) is the input. The first rig moves it from the client's public folder to glb/
// (STATIC_DIR), where it stays as the input; index.json serves the rigged one (index.mjs). The game plays the clips by
// name (render IMPLEMENTATION-NOTES "Rigged creatures").
//
// A rig file (rigs/flowbot.mjs is the worked example) authors everything in the scad's own frame and units: Z up,
// the creature faces -Y, +X is the creature's left (the viewer's right), the numbers of scad/<id>.scad. The mapping
// from the GLB back to scad coordinates comes from frames.json (build.mjs records it; `build.mjs --frames` refreshes
// it without rebuilding). It exports:
//   frame?  { height, minZ, cx?, cy? }: only for a creature missing from frames.json (the scad height and floor, and
//           the x / y centre the build moved to the origin)
//   joints  [{ name, parent?, at: [x, y, z], rot?: [rx, ry, rz], scale? }]: parents first; `at` the pivot in scad
//           coordinates, `rot` a rest rotation (degrees, OpenSCAD rotate() order), `scale` the rest scale (1e-4 hides
//           a part until a clip shows it, e.g. alternate eyes)
//   assign  (centroid [x, y, z], rgb sRGB 0..1, glows) => joint name, per triangle of the static mesh; null drops the
//           triangle (a base or stand the rigged creature does without), and the rest is refitted to 1 m, feet on 0
//   extras  [{ joint, color: [r, g, b], at, size, rot?, shape? }]: boxes (or `shape: 'ell'` ellipsoids, `size` the
//           diameters) added to the mesh in a joint's rest frame (relative to its pivot, scad axes), e.g. expression
//           strokes and eyelids the scad never had
//   clips   { [name]: { seconds, pose(t, u) => { [joint]: { r?: [rx, ry, rz], p?: [dx, dy, dz], s?: n | [x, y, z] } } } }
//           sampled at FPS; t in seconds, u = t / seconds. r rotates in the joint's frame (degrees, rotate() order),
//           p offsets it (scad units), s scales it. A joint a clip leaves out holds its rest pose.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, quantize, reorder, resample, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { readFrames, updateJsonMap } from './frames.mjs';
import { writeIndex } from './index.mjs';
import { NPC_SET, OUT_DIR, PKG, RIG_DIR, STATIC_DIR, staticGlb } from './paths.mjs';

const FPS = 30;
const EPS = 1e-5;
const CLIP_GAP = 0.1;
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const PARTS_VIEW = process.env.RIG_PARTS === '1';
/** A distinct linear colour per joint index (the golden-angle hue walk), for RIG_PARTS=1. */
function partColour(i) {
  const h = (i * 137.508) % 360;
  const f = (n) => { const k = (n + h / 30) % 12; return 0.55 - 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map(srgbToLinear);
}
/**
 * rig-parts.json: triangles per joint at the last rig. A re-rig after a scad change warns when a joint gains or loses
 * a lot (a recolour or a moved part that an `assign` rule no longer matches).
 */
const PARTS = join(PKG, NPC_SET ? 'rig-parts.npc.json' : 'rig-parts.json');
const PART_DRIFT = 0.25;
const PART_DRIFT_MIN = 24;

/** Rigs one creature: reads its static GLB (staticGlb) and rigs/<id>.mjs, writes OUT_DIR/<id>.rig.glb. */
export async function rig(id) {
  const def = (await import(`${pathToFileURL(join(RIG_DIR, `${id}.mjs`)).href}?t=${Date.now()}`)).default;
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const input = staticGlb(id);
  const src = readMesh(await io.read(input));
  const built = readFrames()[id];
  const f0 = { cx: 0, cy: 0, ...(built ?? def.frame) };
  if (f0.height === undefined) throw new Error(`${id}: not in frames.json (node src/build.mjs --frames ${id})`);
  checkFrame(id, src, built);
  const k0 = 1 / f0.height;
  const toScad = (p) => [p[0] / k0 + f0.cx, -p[2] / k0 + f0.cy, p[1] / k0 + f0.minZ];

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
  const frame = dropped > 0 ? { ...f0, height: hi - lo, minZ: lo } : f0;
  const k = 1 / frame.height;
  const toGlb = (p) => [(p[0] - frame.cx) * k, (p[2] - frame.minZ) * k, -(p[1] - frame.cy) * k];
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
      if (PARTS_VIEW) col.push(...partColour(ji), 0);
      else col.push(src.col[v * 4], src.col[v * 4 + 1], src.col[v * 4 + 2], src.col[v * 4 + 3]);
      jnt.push(ji);
    }
  }
  for (const e of def.extras ?? []) {
    const ji = index.get(e.joint);
    if (ji === undefined) throw new Error(`${id}: extra on unknown joint '${e.joint}'`);
    const lin = e.color.map(srgbToLinear);
    const boxQ = scadQuat(e.rot ?? [0, 0, 0]);
    for (const [p, n] of e.shape === 'ell' ? ellTriangles(e.size) : boxTriangles(e.size)) {
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
  if (!PARTS_VIEW) checkParts(id, Object.fromEntries(J.map((j, i) => [j.name, used[i]])));

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

  // clips, baked into ONE timeline (clip after clip, CLIP_GAP apart) with the table { name: [start, end] } in its
  // extras; the game cuts it back into the named clips (creatureRig.ts splitClips). One track per moving channel instead
  // of one per channel per clip keeps the JSON small, and every clip carries every channel any clip moves, so a
  // cross-fade never falls back to rest.
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
  const table = {};
  const times = [];
  const poses = [];
  for (const [name, s] of Object.entries(sampled)) {
    const at = times.length === 0 ? 0 : times[times.length - 1] + CLIP_GAP;
    table[name] = [round6(at), round6(at + s.times[s.times.length - 1])];
    for (let i = 0; i < s.times.length; i++) { times.push(at + s.times[i]); poses.push(s.poses[i]); }
  }
  {
    const anim = doc.createAnimation('clips').setExtras({ ewaClips: table });
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
    dedup(),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8, quantizeWeight: 8 }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const bytes = slimJson(Buffer.from(await io.writeBinary(doc)));
  writeFileSync(join(OUT_DIR, `${id}.rig.glb`), bytes);
  // the public folder ships the rig only: its static input moves to glb/
  if (!PARTS_VIEW && input.startsWith(OUT_DIR)) {
    mkdirSync(STATIC_DIR, { recursive: true });
    renameSync(input, join(STATIC_DIR, `${id}.glb`));
  }
  if (dropped > 0) console.log(`rig ${id}: dropped ${dropped} triangles, refitted to scad z ${lo.toFixed(2)}..${hi.toFixed(2)}`);
  console.log(`rig ${id}: ${J.length} joints, ${Object.keys(def.clips).length} clips (${Object.keys(def.clips).join(', ')}), ${(bytes.length / 1024).toFixed(0)} KiB`);
}

/** Warns when frames.json no longer describes the GLB (the scad changed, the GLB or the frame was not refreshed). */
function checkFrame(id, src, f) {
  if (f === undefined) { console.warn(`warn ${id}: not in frames.json, using the rig file's frame`); return; }
  const tris = src.idx.length / 3;
  const ext = [0, 1, 2].map((a) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = a; i < src.pos.length; i += 3) { lo = Math.min(lo, src.pos[i]); hi = Math.max(hi, src.pos[i]); }
    return hi - lo;
  });
  // GLB x / z extents against the scad's x / y extents over its height
  const off = Math.max(Math.abs(ext[0] - f.size[0] / f.height), Math.abs(ext[2] - f.size[1] / f.height));
  // the GLB's weld drops a few degenerate triangles; a real change moves far more, or the bounds
  if (Math.abs(tris - f.triangles) > Math.max(16, 0.002 * f.triangles) || off > 0.004) {
    console.warn(`warn ${id}: frames.json is stale (GLB ${tris} triangles vs ${f.triangles}, extents off by ${off.toFixed(4)}): rebuild, or node src/build.mjs --frames ${id}`);
  }
}

/** Compares the triangles per joint with the last rig's (rig-parts.json) and records the new counts. */
function checkParts(id, counts) {
  const all = existsSync(PARTS) ? JSON.parse(readFileSync(PARTS, 'utf8')) : {};
  const before = all[id];
  if (before) {
    for (const name of new Set([...Object.keys(before), ...Object.keys(counts)])) {
      const a = before[name] ?? 0;
      const b = counts[name] ?? 0;
      if (Math.abs(b - a) >= PART_DRIFT_MIN && Math.abs(b - a) > PART_DRIFT * Math.max(a, 1)) {
        console.warn(`warn ${id}: joint ${name} went from ${a} to ${b} triangles; check its assign() rule against the scad`);
      }
    }
  }
  updateJsonMap(PARTS, id, counts);
}

/** Drops glTF JSON defaults (LINEAR interpolation, byteOffset 0, normalized false): hundreds of animation samplers. */
function slimJson(glb) {
  const len = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + len).toString());
  for (const a of json.accessors ?? []) { if (a.byteOffset === 0) delete a.byteOffset; if (a.normalized === false) delete a.normalized; }
  for (const v of json.bufferViews ?? []) if (v.byteOffset === 0) delete v.byteOffset;
  for (const an of json.animations ?? []) for (const s of an.samplers) if (s.interpolation === 'LINEAR') delete s.interpolation;
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const rest = glb.subarray(20 + len);
  const out = Buffer.alloc(12 + 8 + text.length + rest.length);
  glb.copy(out, 0, 0, 12);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(text.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  text.copy(out, 20);
  rest.copy(out, 20 + text.length);
  return out;
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

/** An ellipsoid with diameters `size` centred at the origin (a 16 x 10 UV sphere), same layout as boxTriangles. */
function ellTriangles(size) {
  const r = size.map((x) => x / 2);
  const U = 16;
  const V = 10;
  const at = (i, j) => {
    const th = (i / U) * Math.PI * 2;
    const ph = (j / V) * Math.PI;
    const d = [Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), -Math.cos(ph)];
    return [[d[0] * r[0], d[1] * r[1], d[2] * r[2]], norm3([d[0] / r[0], d[1] / r[1], d[2] / r[2]])];
  };
  const out = [];
  for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
    const a = at(i, j); const b = at(i + 1, j); const c = at(i + 1, j + 1); const d = at(i, j + 1);
    if (j > 0) out.push(a, b, c);
    if (j < V - 1) out.push(a, c, d);
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
  // `--npc` picks the NPC set (paths.mjs); `_<name>.mjs` files are shared helpers, not rigs
  const args = process.argv.slice(2).filter((a) => a !== '--npc');
  const ids = args[0] === '--all' ? readdirSync(RIG_DIR).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')).map((f) => f.slice(0, -4)) : args;
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
