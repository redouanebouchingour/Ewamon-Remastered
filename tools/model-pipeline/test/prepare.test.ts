/** SPEC §40.2.3 per-set rules on synthetic documents. */
import type { Document } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import { describe, expect, it } from 'vitest';
import { classifyLegendaryTextures, detachAnimation, normalLike, prepareLegendary, pruneRestTracks } from '../src/prepare.js';
import { runSequence } from '../src/transform.js';
import { skinnedFixture } from './helpers.js';


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

  it('the sequence output keeps its skin and its clips (quantized + meshopt)', async () => {
    const { doc } = skinnedFixture([[1, 0, 0], [0, 0, 1]], ['Idle', 'Walk']);
    pruneRestTracks(doc);
    await runSequence(doc);
    const root = doc.getRoot();
    expect(root.listSkins()).toHaveLength(1);
    expect(root.listAnimations().map((a) => a.getName()).sort()).toEqual(['Idle', 'Walk']);
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
