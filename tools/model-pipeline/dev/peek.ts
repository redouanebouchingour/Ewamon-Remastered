/**
 * Dev inspection (not part of the build): `pnpm exec tsx tools/model-pipeline/dev/peek.ts <file.glb|gltf> …` prints
 * materials and textures, the node tree (TRS, meshes with primitive / triangle counts / attributes, skins) and the
 * clips with their channel counts and durations.
 */
import { NodeIO } from '@gltf-transform/core';
import type { Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const f3 = (v: readonly number[]): string => v.map((x) => x.toFixed(3)).join(',');
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const r = doc.getRoot();
  console.log('=====', f);
  console.log('meshes', r.listMeshes().length, 'skins', r.listSkins().length,
    'mats', r.listMaterials().map((m) => `${m.getName()}:${m.getBaseColorTexture()?.getName() ?? '-'}`).join(' | '),
    'tex', r.listTextures().map((t) => `${t.getName()}:${t.getImage()?.byteLength ?? 0}`).join(','));
  const walk = (n: Node, d: number): void => {
    const m = n.getMesh();
    const s = n.getSkin();
    let extra = '';
    if (m) {
      const prims = m.listPrimitives();
      const tris = prims.reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0);
      extra = ` MESH ${m.getName()} prims=${prims.length} tris=${tris} attrs=${prims[0]?.listSemantics().join('/') ?? ''}`;
    }
    if (s) extra += ` SKIN joints=${s.listJoints().length}`;
    console.log(`${' '.repeat(d * 2)}${n.getName()} t=[${f3(n.getTranslation())}] r=[${f3(n.getRotation())}] s=[${f3(n.getScale())}]${extra}`);
    for (const c of n.listChildren()) walk(c, d + 1);
  };
  for (const n of r.listScenes()[0]?.listChildren() ?? []) walk(n, 0);
  for (const a of r.listAnimations()) {
    let dur = 0;
    for (const s of a.listSamplers()) { const arr = s.getInput()?.getArray(); if (arr) dur = Math.max(dur, arr[arr.length - 1] ?? 0); }
    console.log('  anim', a.getName(), 'channels', a.listChannels().length, 'dur', dur.toFixed(3));
  }
}
