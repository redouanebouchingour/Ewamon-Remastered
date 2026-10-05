/** Synthetic glTF documents for the unit tests (no dependency on the git-ignored assets-src/models). */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Document, Logger } from '@gltf-transform/core';
import type { Material, Node } from '@gltf-transform/core';

export const REPO = resolve(__dirname, '..', '..', '..');
export const SRC_MODELS = resolve(REPO, 'assets-src', 'models');
export const OUT_MODELS = resolve(REPO, 'packages', 'client', 'public', 'models');
/** The raw sources are git-ignored; tests that need them skip on a checkout without them. */
export const HAS_SOURCES = existsSync(resolve(SRC_MODELS, 'legendaries')) && existsSync(resolve(SRC_MODELS, 'kaykit-adventurers'));

/** A grid of `n × n` quads in the XY plane at height `z`, indexed. */
function grid(n: number, z: number): { pos: Float32Array; nrm: Float32Array; idx: Uint16Array } {
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) { pos.push(x / n, y / n, z); nrm.push(0, 0, 1); }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = y * (n + 1) + x;
    idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
}

export interface SkinnedFixture {
  readonly doc: Document;
  readonly joints: readonly Node[];
  readonly materials: readonly Material[];
}

/**
 * A skinned test document: one skinned mesh with `colours.length` flat-colour primitives, a 2-joint rig,
 * and one clip per name in `clips`. Joint 0's scale track holds the rest value (1,1,1) in every clip; joint 1's
 * rotation track moves.
 */
export function skinnedFixture(colours: readonly [number, number, number][], clips: readonly string[]): SkinnedFixture {
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  const buffer = doc.createBuffer();
  const root = doc.createNode('Armature');
  const j0 = doc.createNode('hips').setTranslation([0, 1, 0]);
  const j1 = doc.createNode('spine').setTranslation([0, 0.5, 0]);
  root.addChild(j0);
  j0.addChild(j1);
  const ibm = doc.createAccessor().setType('MAT4').setBuffer(buffer).setArray(new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1.5, 0, 1,
  ]));
  const skin = doc.createSkin('rig').addJoint(j0).addJoint(j1).setInverseBindMatrices(ibm);
  const mesh = doc.createMesh('body');
  const materials: Material[] = [];
  colours.forEach((c, i) => {
    const g = grid(4, i * 0.1);
    const n = g.pos.length / 3;
    const joints = new Uint8Array(n * 4);
    const weights = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) { joints[v * 4] = v % 2; weights[v * 4] = 1; }
    const mat = doc.createMaterial(`mat${i}`).setBaseColorFactor([c[0], c[1], c[2], 1]).setMetallicFactor(0).setRoughnessFactor(0.5).setDoubleSided(true);
    materials.push(mat);
    mesh.addPrimitive(doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setBuffer(buffer).setArray(g.pos))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setBuffer(buffer).setArray(g.nrm))
      .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setBuffer(buffer).setArray(joints))
      .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setBuffer(buffer).setArray(weights))
      .setIndices(doc.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(g.idx))
      .setMaterial(mat));
  });
  const meshNode = doc.createNode('body').setMesh(mesh).setSkin(skin);
  root.addChild(meshNode);
  doc.createScene('scene').addChild(root);
  clips.forEach((name, k) => {
    const times = doc.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(new Float32Array([0, 0.5, 1]));
    const restScale = doc.createAccessor().setType('VEC3').setBuffer(buffer).setArray(new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]));
    const s = Math.sin(0.2 + k * 0.1);
    const c = Math.cos(0.2 + k * 0.1);
    const rot = doc.createAccessor().setType('VEC4').setBuffer(buffer).setArray(new Float32Array([0, 0, 0, 1, 0, s, 0, c, 0, 0, 0, 1]));
    const scaleSampler = doc.createAnimationSampler().setInput(times).setOutput(restScale).setInterpolation('LINEAR');
    const rotSampler = doc.createAnimationSampler().setInput(times).setOutput(rot).setInterpolation('LINEAR');
    doc.createAnimation(name)
      .addSampler(scaleSampler).addSampler(rotSampler)
      .addChannel(doc.createAnimationChannel().setTargetNode(j0).setTargetPath('scale').setSampler(scaleSampler))
      .addChannel(doc.createAnimationChannel().setTargetNode(j1).setTargetPath('rotation').setSampler(rotSampler));
  });
  return { doc, joints: [j0, j1], materials };
}
