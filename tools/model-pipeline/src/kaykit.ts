/**
 * KayKit geometry (SPEC §40.2.3, amended 2026-10-05): shapes, the shared animation file and the accessories, built
 * as fresh gltf-transform documents before the §40.2.2 sequence runs on them.
 *
 * Every KayKit character carries the same `Rig_Medium` skeleton (23 joints, identical names, rest TRS and inverse
 * bind matrices — asserted here), but each file lists the joints in a different order. A shape is assembled from parts
 * of up to two files, so the builder writes ONE canonical rig (the joint order of `Knight.glb`) and remaps every
 * part's `JOINTS_0` by joint name. The parts' vertices (POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0) are
 * appended into ONE primitive with ONE material (`character`, no image: the atlas is the runtime's) — the same result
 * `joinPrimitives` gives for parts of one file, without the cross-file joint mismatch.
 *
 * Animations: the kept clips (`CHARACTER_CLIPS`) are copied onto a node-only copy of the rig (no mesh, no skin —
 * three's `AnimationMixer` binds tracks by node name), the rest are not written. `gaitSpeed` measures each gait
 * clip's ground speed so the runtime can play walk / run at the speed the actor actually moves (no foot sliding).
 */
import { Document } from '@gltf-transform/core';
import type { Accessor, Animation, Node, Primitive } from '@gltf-transform/core';
import { CHARACTER_CLIPS, HEADWEAR_PARTS, KAYKIT_CHARACTERS, SHAPES } from './characters.js';
import type { KayKitCharacter, ShapeDef } from './characters.js';

/** The canonical joint order (Knight.glb's). */
export const RIG_JOINTS = Object.freeze([
  'root', 'hips', 'spine', 'chest', 'upperarm.l', 'lowerarm.l', 'wrist.l', 'hand.l', 'handslot.l', 'upperarm.r', 'lowerarm.r',
  'wrist.r', 'hand.r', 'handslot.r', 'head', 'upperleg.r', 'lowerleg.r', 'foot.r', 'toes.r', 'upperleg.l', 'lowerleg.l', 'foot.l', 'toes.l',
] as const);
export const RIG_NAME = 'Rig_Medium';
export const SHAPE_MATERIAL = 'character';

/** One joint of the canonical rig, read from a source. */
interface RigJoint { readonly name: string; readonly parent: string | null; readonly t: number[]; readonly r: number[]; readonly s: number[]; readonly ibm: number[] }

const EPS = 1e-6;
const IDENTITY: readonly number[] = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const close = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) <= EPS);

/** The rig of a source document (its one skin), by joint name; throws when it is not `Rig_Medium`. */
export function readRig(doc: Document, label: string): Map<string, RigJoint> {
  const skins = doc.getRoot().listSkins();
  if (skins.length !== 1) throw new Error(`[model-pipeline] ${label}: expected 1 skin, found ${skins.length}`);
  const skin = skins[0]!;
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const out = new Map<string, RigJoint>();
  const names = new Set(joints.map((j) => j.getName()));
  joints.forEach((j, i) => {
    const m: number[] = [];
    if (ibm) ibm.getElement(i, m); else m.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    const parent = j.getParentNode();
    out.set(j.getName(), { name: j.getName(), parent: parent && names.has(parent.getName()) ? parent.getName() : null, t: j.getTranslation(), r: j.getRotation(), s: j.getScale(), ibm: m });
  });
  const want = [...RIG_JOINTS].sort().join();
  if ([...out.keys()].sort().join() !== want) throw new Error(`[model-pipeline] ${label}: skin joints are not ${RIG_NAME} (${[...out.keys()].join(', ')})`);
  return out;
}

/** Throws unless `b` is the same rig as `a` (rest TRS + inverse bind matrices per joint name). */
export function assertSameRig(a: ReadonlyMap<string, RigJoint>, b: ReadonlyMap<string, RigJoint>, label: string): void {
  for (const [name, ja] of a) {
    const jb = b.get(name)!;
    if (ja.parent !== jb.parent || !close(ja.t, jb.t) || !close(ja.r, jb.r) || !close(ja.s, jb.s) || !close(ja.ibm, jb.ibm)) {
      throw new Error(`[model-pipeline] ${label}: joint ${name} differs from the canonical ${RIG_NAME} (parent, rest TRS or inverse bind)`);
    }
  }
}

/** Writes the canonical rig into `doc` under a `Rig_Medium` node; returns the joint nodes in `RIG_JOINTS` order. */
function writeRig(doc: Document, rig: ReadonlyMap<string, RigJoint>, scene: ReturnType<Document['createScene']>): { top: Node; joints: Node[] } {
  const top = doc.createNode(RIG_NAME);
  scene.addChild(top);
  const nodes = new Map<string, Node>();
  for (const name of RIG_JOINTS) {
    const j = rig.get(name)!;
    nodes.set(name, doc.createNode(name).setTranslation(j.t as [number, number, number]).setRotation(j.r as [number, number, number, number]).setScale(j.s as [number, number, number]));
  }
  for (const name of RIG_JOINTS) {
    const j = rig.get(name)!;
    (j.parent === null ? top : nodes.get(j.parent)!).addChild(nodes.get(name)!);
  }
  return { top, joints: RIG_JOINTS.map((n) => nodes.get(n)!) };
}

/** The single primitive of `<prefix>_<part>` in a KayKit character document. */
export function partPrimitive(doc: Document, from: KayKitCharacter, part: string): { prim: Primitive; jointNames: string[] } {
  const name = `${KAYKIT_CHARACTERS[from]}_${part}`;
  const node = doc.getRoot().listNodes().find((n) => n.getName() === name && n.getMesh());
  if (!node) throw new Error(`[model-pipeline] ${from}.glb has no mesh node ${name}`);
  const prims = node.getMesh()!.listPrimitives();
  if (prims.length !== 1) throw new Error(`[model-pipeline] ${name}: expected 1 primitive, found ${prims.length}`);
  const skin = node.getSkin();
  if (!skin) throw new Error(`[model-pipeline] ${name} is not skinned`);
  if (!close(node.getWorldMatrix(), IDENTITY)) throw new Error(`[model-pipeline] ${name}: mesh node is not at the identity`);
  return { prim: prims[0]!, jointNames: skin.listJoints().map((j) => j.getName()) };
}

function floats(a: Accessor, n: number): Float32Array {
  const out = new Float32Array(a.getCount() * n);
  const e: number[] = [];
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, e); for (let k = 0; k < n; k++) out[i * n + k] = e[k]!; }
  return out;
}

export interface ShapeBuild {
  readonly doc: Document;
  readonly triangles: number;
  /** Bind-pose max y over all parts / over the parts that are not headwear (model units). */
  readonly topY: number;
  readonly bareTopY: number;
}

/**
 * One shape: the canonical rig + ONE skinned primitive holding every listed part (joints remapped by name), material
 * `character`, no image. `sources` maps each KayKit character to its parsed document.
 */
export function buildShape(id: string, def: ShapeDef, sources: ReadonlyMap<KayKitCharacter, Document>): ShapeBuild {
  const knight = sources.get('Knight');
  if (!knight) throw new Error('[model-pipeline] Knight.glb (the canonical rig) is not loaded');
  const rig = readRig(knight, 'Knight.glb');
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const { top, joints } = writeRig(doc, rig, scene);
  const ibm = new Float32Array(RIG_JOINTS.length * 16);
  RIG_JOINTS.forEach((n, i) => ibm.set(rig.get(n)!.ibm, i * 16));
  const skin = doc.createSkin(RIG_NAME).setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
  for (const j of joints) skin.addJoint(j);
  skin.setSkeleton(joints[0]!);

  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], jnt: number[] = [], wgt: number[] = [], idx: number[] = [];
  let topY = -Infinity, bareTopY = -Infinity;
  for (const ref of def.parts) {
    const src = sources.get(ref.from);
    if (!src) throw new Error(`[model-pipeline] shape ${id}: ${ref.from}.glb not loaded`);
    assertSameRig(rig, readRig(src, `${ref.from}.glb`), `${ref.from}.glb`);
    const { prim, jointNames } = partPrimitive(src, ref.from, ref.part);
    const remap = jointNames.map((n) => RIG_JOINTS.indexOf(n as (typeof RIG_JOINTS)[number]));
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
    if (!P || !N || !T || !J || !W) throw new Error(`[model-pipeline] shape ${id}: ${ref.from} ${ref.part} lacks one of POSITION NORMAL TEXCOORD_0 JOINTS_0 WEIGHTS_0`);
    const base = pos.length / 3;
    const p3 = floats(P, 3), n3 = floats(N, 3), t2 = floats(T, 2), j4 = floats(J, 4), w4 = floats(W, 4);
    for (let i = 0; i < P.getCount(); i++) {
      pos.push(p3[i * 3]!, p3[i * 3 + 1]!, p3[i * 3 + 2]!);
      nrm.push(n3[i * 3]!, n3[i * 3 + 1]!, n3[i * 3 + 2]!);
      uv.push(t2[i * 2]!, t2[i * 2 + 1]!);
      let ws = 0;
      for (let k = 0; k < 4; k++) ws += w4[i * 4 + k]!;
      for (let k = 0; k < 4; k++) {
        const w = ws > 0 ? w4[i * 4 + k]! / ws : (k === 0 ? 1 : 0);
        const jj = w > 0 ? remap[j4[i * 4 + k]!] : 0;
        if (jj === undefined || jj < 0) throw new Error(`[model-pipeline] shape ${id}: ${ref.part} vertex ${i} weights an unknown joint`);
        jnt.push(jj); wgt.push(w);
      }
      topY = Math.max(topY, p3[i * 3 + 1]!);
      if (!HEADWEAR_PARTS.has(ref.part)) bareTopY = Math.max(bareTopY, p3[i * 3 + 1]!);
    }
    const I = prim.getIndices();
    if (!I) throw new Error(`[model-pipeline] shape ${id}: ${ref.part} is not indexed`);
    const ia = I.getArray()!;
    for (let i = 0; i < ia.length; i++) idx.push(base + ia[i]!);
  }
  const vcount = pos.length / 3;
  const acc = (type: 'VEC2' | 'VEC3' | 'VEC4' | 'SCALAR', arr: Float32Array | Uint8Array | Uint16Array | Uint32Array) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const material = doc.createMaterial(SHAPE_MATERIAL).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.75).setDoubleSided(true);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array(pos)))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array(nrm)))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uv)))
    .setAttribute('JOINTS_0', acc('VEC4', new Uint8Array(jnt)))
    .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(wgt)))
    .setIndices(acc('SCALAR', vcount < 65536 ? new Uint16Array(idx) : new Uint32Array(idx)))
    .setMaterial(material);
  const mesh = doc.createMesh(id).addPrimitive(prim);
  top.addChild(doc.createNode(id).setMesh(mesh).setSkin(skin));
  return { doc, triangles: idx.length / 3, topY, bareTopY };
}

// ---- accessories ---------------------------------------------------------------------------------------------------

/** An accessory as shipped: one rigid mesh, its UVs, material `character`, no image. */
export function buildAccessory(id: string, src: Document): { doc: Document; triangles: number } {
  const meshes = src.getRoot().listMeshes();
  if (meshes.length !== 1 || meshes[0]!.listPrimitives().length !== 1) throw new Error(`[model-pipeline] accessory ${id}: expected 1 mesh with 1 primitive`);
  const sp = meshes[0]!.listPrimitives()[0]!;
  const P = sp.getAttribute('POSITION'), N = sp.getAttribute('NORMAL'), T = sp.getAttribute('TEXCOORD_0'), I = sp.getIndices();
  if (!P || !N || !T || !I) throw new Error(`[model-pipeline] accessory ${id}: lacks POSITION / NORMAL / TEXCOORD_0 / indices`);
  const node = src.getRoot().listNodes().find((n) => n.getMesh() === meshes[0]);
  if (node && !close(node.getWorldMatrix(), IDENTITY)) throw new Error(`[model-pipeline] accessory ${id}: mesh node is not at the identity`);
  const doc = new Document();
  const buffer = doc.createBuffer();
  const ia = I.getArray()!;
  const material = doc.createMaterial(SHAPE_MATERIAL).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.75).setDoubleSided(true);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(floats(P, 3)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(floats(N, 3)).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(floats(T, 2)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(P.getCount() < 65536 ? Uint16Array.from(ia) : Uint32Array.from(ia)).setBuffer(buffer))
    .setMaterial(material);
  doc.createScene('Scene').addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(prim)));
  return { doc, triangles: ia.length / 3 };
}

// ---- animations ----------------------------------------------------------------------------------------------------

/**
 * The shipped clips on a node-only copy of the canonical rig. `sources` are the two `Rig_Medium_*` animation files;
 * a kept clip missing from both fails the build with its name.
 */
export function buildAnimations(sources: readonly Document[], rigRef: ReadonlyMap<string, RigJoint>): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const { joints } = writeRig(doc, rigRef, scene);
  const byName = new Map(RIG_JOINTS.map((n, i) => [n as string, joints[i]!] as const));
  const found = new Set<string>();
  for (const src of sources) {
    assertSameRig(rigRef, readRig(src, 'animation file'), 'animation file');
    for (const a of src.getRoot().listAnimations()) {
      const to = CHARACTER_CLIPS[a.getName()];
      if (!to) continue;
      if (found.has(to)) throw new Error(`[model-pipeline] clip ${a.getName()} appears in two animation files`);
      found.add(to);
      copyAnimation(doc, buffer, a, to, byName);
    }
  }
  const missing = Object.entries(CHARACTER_CLIPS).filter(([, to]) => !found.has(to)).map(([from]) => from);
  if (missing.length) throw new Error(`[model-pipeline] clip(s) ${missing.join(', ')} missing from the Rig_Medium animation files`);
  return doc;
}

function copyAnimation(doc: Document, buffer: ReturnType<Document['createBuffer']>, a: Animation, name: string, nodes: ReadonlyMap<string, Node>): void {
  const out = doc.createAnimation(name);
  for (const c of a.listChannels()) {
    const s = c.getSampler()!;
    const target = c.getTargetNode();
    const path = c.getTargetPath();
    if (!target || !path) continue;
    const node = nodes.get(target.getName());
    if (!node) continue;   // a track on a node outside the rig (none in the sources)
    const input = s.getInput()!, output = s.getOutput()!;
    const sampler = doc.createAnimationSampler()
      .setInput(doc.createAccessor().setType('SCALAR').setArray(new Float32Array(input.getArray()!)).setBuffer(buffer))
      .setOutput(doc.createAccessor().setType(output.getType()).setArray(floats(output, output.getElementSize())).setBuffer(buffer))
      .setInterpolation(s.getInterpolation());
    out.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
  }
}

// ---- measurements ----------------------------------------------------------------------------------------------------

type V = number[];
function sampleTrack(times: ArrayLike<number>, vals: ArrayLike<number>, n: number, t: number): V {
  const last = times.length - 1;
  const at = (i: number): V => Array.from({ length: n }, (_, k) => vals[i * n + k]!);
  if (t <= times[0]!) return at(0);
  if (t >= times[last]!) return at(last);
  let i = 0;
  while (times[i + 1]! < t) i++;
  const a = at(i), b = at(i + 1);
  const k = (t - times[i]!) / (times[i + 1]! - times[i]!);
  if (n === 4) {
    let d = 0;
    for (let j = 0; j < 4; j++) d += a[j]! * b[j]!;
    const sg = d < 0 ? -1 : 1;
    const o = a.map((x, j) => x * (1 - k) + sg * b[j]! * k);
    const l = Math.hypot(...o);
    return o.map((x) => x / l);
  }
  return a.map((x, j) => x * (1 - k) + b[j]! * k);
}
function compose(t: V, q: V, s: V): number[] {
  const [x, y, z, w] = q as [number, number, number, number];
  const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [(1 - (yy + zz)) * s[0]!, (xy + wz) * s[0]!, (xz - wy) * s[0]!, 0, (xy - wz) * s[1]!, (1 - (xx + zz)) * s[1]!, (yz + wx) * s[1]!, 0, (xz + wy) * s[2]!, (yz - wx) * s[2]!, (1 - (xx + yy)) * s[2]!, 0, t[0]!, t[1]!, t[2]!, 1];
}
function mul(a: readonly number[], b: readonly number[]): number[] {
  const o = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!; o[c * 4 + r] = s; }
  return o;
}

/** World position of `node` at clip time `t` (forward kinematics over the clip's tracks; rest TRS where untracked). */
function worldAt(a: Animation, node: Node, t: number): [number, number, number] {
  const tracks = new Map<string, { times: ArrayLike<number>; vals: ArrayLike<number> }>();
  for (const c of a.listChannels()) {
    const s = c.getSampler()!;
    tracks.set(`${c.getTargetNode()!.getName()}|${c.getTargetPath()}`, { times: s.getInput()!.getArray()!, vals: s.getOutput()!.getArray()! });
  }
  const local = (n: Node): number[] => {
    const g = (path: string, k: number, d: V): V => { const tr = tracks.get(`${n.getName()}|${path}`); return tr ? sampleTrack(tr.times, tr.vals, k, t) : d; };
    return compose(g('translation', 3, n.getTranslation()), g('rotation', 4, n.getRotation()), g('scale', 3, n.getScale()));
  };
  let m = local(node);
  for (let p = node.getParentNode(); p; p = p.getParentNode()) m = mul(local(p), m);
  return [m[12]!, m[13]!, m[14]!];
}

export function clipDuration(a: Animation): number {
  let d = 0;
  for (const s of a.listSamplers()) { const arr = s.getInput()!.getArray()!; d = Math.max(d, arr[arr.length - 1]!); }
  return d;
}

/**
 * Ground speed of an in-place gait clip (model units / s at time scale 1): the backward speed of the planted toe.
 * Samples 400 steps per cycle; a toe counts as planted while it is within 1.5 cm (model units) of its lowest point,
 * and the speed is the mean |dz/dt| over planted steps of both feet. The runtime plays the clip at
 * `groundSpeed / (speed × scale)`, so planted feet move with the ground.
 */
export function gaitSpeed(doc: Document, clip: string): number {
  const a = doc.getRoot().listAnimations().find((x) => x.getName() === clip);
  if (!a) throw new Error(`[model-pipeline] gaitSpeed: no clip ${clip}`);
  const dur = clipDuration(a);
  const N = 400;
  let sum = 0, n = 0;
  for (const toe of ['toes.l', 'toes.r']) {
    const node = doc.getRoot().listNodes().find((x) => x.getName() === toe);
    if (!node) throw new Error(`[model-pipeline] gaitSpeed: no joint ${toe}`);
    const ys: number[] = [], zs: number[] = [];
    for (let k = 0; k <= N; k++) { const w = worldAt(a, node, (dur * k) / N); ys.push(w[1]); zs.push(w[2]); }
    const minY = Math.min(...ys);
    for (let k = 1; k <= N; k++) {
      if (ys[k]! < minY + 0.015 && ys[k - 1]! < minY + 0.015) { sum += Math.abs(zs[k]! - zs[k - 1]!) / (dur / N); n++; }
    }
  }
  if (n === 0) throw new Error(`[model-pipeline] gaitSpeed: ${clip} never plants a foot`);
  return Math.round((sum / n) * 1e4) / 1e4;
}

/** The shape ids in a stable order. */
export function shapeIds(): string[] { return Object.keys(SHAPES).sort(); }
