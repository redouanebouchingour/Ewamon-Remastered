/**
 * Dev measurement (run from tools/model-pipeline: `npx tsx dev/rigcheck2.ts`): every KayKit file's skin joint order, and
 * per joint name the largest difference of rest TRS and inverse bind matrix against Knight.glb (IMPLEMENTATION-NOTES K1).
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const K = '../../assets-src/models/kaykit-adventurers/';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const files = ['Characters/gltf/Knight.glb','Characters/gltf/Barbarian.glb','Characters/gltf/Mage.glb','Characters/gltf/Ranger.glb','Characters/gltf/Rogue.glb','Characters/gltf/Rogue_Hooded.glb','Animations/gltf/Rig_Medium/Rig_Medium_General.glb','Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb'];
let ref: Map<string, { ibm: number[]; trs: number[] }> | null = null;
for (const f of files) {
  const doc = await io.read(K + f);
  const skin = doc.getRoot().listSkins()[0]!;
  const acc = skin.getInverseBindMatrices()!;
  const m = new Map<string, { ibm: number[]; trs: number[] }>();
  skin.listJoints().forEach((j, i) => { const e: number[] = []; acc.getElement(i, e); m.set(j.getName(), { ibm: e, trs: [...j.getTranslation(), ...j.getRotation(), ...j.getScale()] }); });
  console.log(f, skin.listJoints().map((j) => j.getName()).join(' '));
  if (!ref) { ref = m; continue; }
  let dI = 0, dT = 0; const missing: string[] = [];
  for (const [k, v] of ref) { const o = m.get(k); if (!o) { missing.push(k); continue; } dI = Math.max(dI, ...v.ibm.map((x, i) => Math.abs(x - o.ibm[i]!))); dT = Math.max(dT, ...v.trs.map((x, i) => Math.abs(x - o.trs[i]!))); }
  console.log('   by name: ibmDiff', dI.toExponential(2), 'trsDiff', dT.toExponential(2), 'missing', missing.join(','));
}
