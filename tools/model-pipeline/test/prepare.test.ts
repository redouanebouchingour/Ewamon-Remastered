/** SPEC §40.2.3 per-set rules on synthetic documents. */
import type { Document } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import { describe, expect, it } from 'vitest';
import { LOOK_MATERIAL, classifyLegendaryTextures, detachAnimation, normalLike, prepareLegendary, prepareLook, pruneRestTracks } from '../src/prepare.js';
import type { QaFlag } from '../src/prepare.js';
import { KEPT_CLIP_NAMES, lookIdFromStem } from '../src/sets.js';
import { runSequence } from '../src/transform.js';
import { skinnedFixture } from './helpers.js';

const SEVENTEEN = ['Death', 'Defeat', 'Idle', 'Jump', 'PickUp', 'Punch', 'RecieveHit', 'Roll', 'Run', 'Run_Carry', 'Shoot_OneHanded', 'SitDown', 'StandUp', 'SwordSlash', 'Victory', 'Walk', 'Walk_Carry'];

describe('look ids (§40.2.5: snake_case of the file stem)', () => {
  it.each([
    ['Casual_Male', 'casual_male'], ['BlueSoldier_Male', 'blue_soldier_male'], ['Casual2_Female', 'casual2_female'],
    ['Knight_Golden_Male', 'knight_golden_male'], ['OldClassy_Female', 'old_classy_female'], ['Doctor_Female_Young', 'doctor_female_young'],
  ])('%s → %s', (stem, id) => expect(lookIdFromStem(stem)).toBe(id));
});

describe('prepareLook (§40.2.3 Quaternius rule)', () => {
  it('bakes each flat colour into COLOR_0 and merges the primitives into one with one `character` material', () => {
    const colours: [number, number, number][] = [[0.1, 0.2, 0.3], [0.9, 0.8, 0.7], [0.5, 0.5, 0.5]];
    const { doc } = skinnedFixture(colours, SEVENTEEN);
    const flags: QaFlag[] = [];
    const shape = prepareLook(doc, 'fixture', flags);
    const root = doc.getRoot();
    const prims = root.listMeshes()[0]!.listPrimitives();
    expect(prims).toHaveLength(1);
    expect(root.listMaterials().map((m) => m.getName())).toEqual([LOOK_MATERIAL]);
    const col = prims[0]!.getAttribute('COLOR_0')!;
    expect(col.getType()).toBe('VEC3');
    const seen = new Set<string>();
    const el: number[] = [];
    for (let i = 0; i < col.getCount(); i++) { col.getElement(i, el); seen.add(el.map((v) => v.toFixed(3)).join(',')); }
    expect([...seen].sort()).toEqual(colours.map((c) => c.map((v) => v.toFixed(3)).join(',')).sort());
    expect(shape.triangles).toBe(3 * 32);
    expect(flags).toEqual([]);
  });

  it('keeps exactly the 7 clips, lower-cased, and detaches the other 10 so prune() drops their keyframes', async () => {
    const { doc } = skinnedFixture([[1, 0, 0]], SEVENTEEN);
    const before = doc.getRoot().listAccessors().length;
    const shape = prepareLook(doc, 'fixture', []);
    expect(shape.clips).toEqual(KEPT_CLIP_NAMES);
    expect(KEPT_CLIP_NAMES).toEqual(['defeat', 'idle', 'run', 'sitdown', 'standup', 'victory', 'walk']);
    expect(doc.getRoot().listAnimations().map((a) => a.getName()).sort()).toEqual(KEPT_CLIP_NAMES);
    expect(before).toBe(1 + 5 + 17 * 3);                               // IBM + one primitive's 5 streams + 17 clips × (times, scale, rotation)
    await doc.transform(prune());
    // IBM + the merged primitive's 6 streams (COLOR_0 added) + the 7 kept clips × 3 — the 10 dropped clips' keyframes are gone
    expect(doc.getRoot().listAccessors().length).toBe(1 + 6 + 7 * 3);
  });

  it('fails with the look id when a kept clip is missing or the source carries images', () => {
    const { doc } = skinnedFixture([[1, 0, 0]], SEVENTEEN.filter((c) => c !== 'SitDown'));
    expect(() => prepareLook(doc, 'no_sit', [])).toThrow(/look no_sit: clip\(s\) sitdown missing/);
    const t = skinnedFixture([[1, 0, 0]], SEVENTEEN);
    t.doc.createTexture('img').setImage(new Uint8Array(8)).setMimeType('image/png');
    expect(() => prepareLook(t.doc, 'textured', [])).toThrow(/look textured: 1 images/);
  });

  it('flags materials whose non-colour factors differ (the merged material keeps the first)', () => {
    const { doc, materials } = skinnedFixture([[1, 0, 0], [0, 1, 0]], SEVENTEEN);
    materials[1]!.setRoughnessFactor(0.9);
    const flags: QaFlag[] = [];
    prepareLook(doc, 'rough', flags);
    expect(flags.map((f) => f.flag)).toEqual(['material-factors']);
    expect(doc.getRoot().listMaterials()[0]!.getRoughnessFactor()).toBe(0.5);
  });
});

describe('detachAnimation / pruneRestTracks (IMPLEMENTATION-NOTES M8)', () => {
  it('Animation.dispose() alone leaves the keyframes referenced; detachAnimation frees them', async () => {
    const a = skinnedFixture([[1, 0, 0]], ['A', 'B']);
    const n0 = a.doc.getRoot().listAccessors().length;
    a.doc.getRoot().listAnimations()[0]!.dispose();
    await a.doc.transform(prune());
    expect(a.doc.getRoot().listAccessors().length).toBe(n0);
    const b = skinnedFixture([[1, 0, 0]], ['A', 'B']);
    detachAnimation(b.doc.getRoot().listAnimations()[0]!);
    await b.doc.transform(prune());
    expect(b.doc.getRoot().listAccessors().length).toBe(n0 - 3);
  });

  it('drops a track only when it holds the rest value in every clip', () => {
    const { doc, joints } = skinnedFixture([[1, 0, 0]], ['A', 'B', 'C']);
    expect(pruneRestTracks(doc)).toBe(3);                              // hips scale == rest (1,1,1) in all three clips
    for (const a of doc.getRoot().listAnimations()) {
      expect(a.listChannels().map((c) => `${c.getTargetNode()!.getName()}.${c.getTargetPath()}`)).toEqual(['spine.rotation']);
    }
    const f = skinnedFixture([[1, 0, 0]], ['A', 'B']);
    f.joints[0]!.setScale([2, 2, 2]);                                   // rest differs → the constant (1,1,1) track moves the bone
    expect(pruneRestTracks(f.doc)).toBe(0);
    expect(joints).toHaveLength(2);
  });

  it('the sequence output keeps its skin and the kept clips (quantized + meshopt)', async () => {
    const { doc } = skinnedFixture([[1, 0, 0], [0, 0, 1]], SEVENTEEN);
    prepareLook(doc, 'fixture', []);
    pruneRestTracks(doc);
    await runSequence(doc);
    const root = doc.getRoot();
    expect(root.listSkins()).toHaveLength(1);
    expect(root.listAnimations().map((a) => a.getName()).sort()).toEqual(KEPT_CLIP_NAMES);
    const used = root.listExtensionsUsed().map((e) => e.extensionName).sort();
    expect(used).toEqual(['EXT_meshopt_compression', 'KHR_mesh_quantization']);
    expect(root.listExtensionsRequired().map((e) => e.extensionName).sort()).toEqual(['EXT_meshopt_compression', 'KHR_mesh_quantization']);
  });
});

describe('legendary rules', () => {
  function legendaryDoc(): Document {
    const { doc } = skinnedFixture([[1, 1, 1]], ['Animation']);
    const mat = doc.getRoot().listMaterials()[0]!;
    const tex = (name: string): ReturnType<Document['createTexture']> => doc.createTexture(name).setImage(new Uint8Array([name.length])).setMimeType('image/webp');
    mat.setNormalTexture(tex('Image_2')).setBaseColorTexture(tex('Image_0')).setMetallicRoughnessTexture(tex('Image_1'));
    return doc;
  }

  it('renames the single clip to idle and counts triangles', () => {
    const doc = legendaryDoc();
    expect(prepareLegendary(doc, 'lumyth')).toEqual({ triangles: 32, clips: ['idle'] });
    expect(doc.getRoot().listAnimations()[0]!.getName()).toBe('idle');
  });

  it('classifies textures by their material slot, whatever their order in the file', () => {
    const roles = classifyLegendaryTextures(legendaryDoc()).map((c) => `${c.role}:${c.texture.getName()}`);
    expect(roles).toEqual(['baseColor:Image_0', 'normal:Image_2', 'orm:Image_1']);
  });

  it('normalLike accepts the sources\' measured normal means and rejects colour/ORM means', () => {
    expect(normalLike([127.3, 127.5, 233.9])).toBe(true);                // lumyth normal map (§40.2.3's 16/255-of-255 test rejects it)
    expect(normalLike([126.5, 127.2, 237.2])).toBe(true);
    expect(normalLike([253.9, 28.3, 0.8])).toBe(false);                  // lumyth ORM
    expect(normalLike([113.4, 104.5, 165.8])).toBe(false);               // lumyth base colour
  });
});
