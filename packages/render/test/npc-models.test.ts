/**
 * Rigged NPC set pieces (stage/npcModels.ts), node, no GPU: a synthetic source hands out a tiny skinned template; the
 * stage places a clone per spec, stands it on the ground, loops `idle` and plays a clip on demand.
 */
import { describe, expect, it } from 'vitest';
import {
  AnimationClip, Bone, BufferAttribute, BufferGeometry, Group, Matrix4, NumberKeyframeTrack, Skeleton, SkinnedMesh,
} from 'three/webgpu';
import { NpcModelStage } from '../src/stage/npcModels.js';
import type { CreatureModel, CreatureModelSource } from '../src/sprites/creatureModels.js';

function rigged(): CreatureModel {
  const root = new Bone(); root.name = 'root';
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 0.1, 0, 0, 0, 1, 0]), 3));
  g.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(12), 4));
  g.setAttribute('skinWeight', new BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 4));
  const mesh = new SkinnedMesh(g);
  const scene = new Group();
  scene.add(root, mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new Skeleton([root]), new Matrix4());
  const clip = (n: string, d: number): AnimationClip => new AnimationClip(n, d, [new NumberKeyframeTrack('root.position[x]', [0, d], [0, 0])]);
  return { geometry: g, matrix: new Matrix4(), rig: { scene, clips: [clip('idle', 2), clip('talk', 0.5), clip('idle_wraaah', 1)] } };
}

function source(): CreatureModelSource & { asked: string[] } {
  const asked: string[] = [];
  return { asked, model: async (id) => { asked.push(id); return id === 'missing' ? null : rigged(); }, dispose: () => undefined };
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('NPC set pieces (npcModels.ts)', () => {
  it('places each model on the ground, turned and scaled, and loops idle', async () => {
    const src = source();
    const s = new NpcModelStage({ baseUrl: null, source: src });
    s.setGround((x, z) => x * 0.1 + z);
    s.set([
      { id: 'a', model: 'fb_king_klinker', x: 2, z: 1, yaw: Math.PI / 2, heightM: 1.85 },
      { id: 'b', model: 'missing', x: 0, z: 0, yaw: 0, heightM: 1 },
    ]);
    await settle();
    expect(src.asked).toEqual(['fb_king_klinker', 'missing']);
    const a = s.root.children[0]!;
    expect(a.position.toArray()).toEqual([2, 1.2, 1]);
    expect(a.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(a.scale.x).toBeCloseTo(1.85);
    expect(s.clips('a')).toEqual(['idle', 'talk', 'idle_wraaah']);
    expect(s.clips('b')).toEqual([]);
    let culled: boolean | null = null;
    a.traverse((n) => { if ((n as { isSkinnedMesh?: boolean }).isSkinnedMesh === true) culled = n.frustumCulled; });
    expect(culled).toBe(false);
    expect(s.play('a', 'talk')).toBe(true);
    expect(s.play('a', 'nope')).toBe(false);
    expect(s.play('b', 'talk')).toBe(false);
    s.update(16);
    s.dispose();
  });

  it('a new set replaces the old one; a model that loads after it is dropped', async () => {
    const s = new NpcModelStage({ baseUrl: null, source: source() });
    s.set([{ id: 'a', model: 'x', x: 0, z: 0, yaw: 0, heightM: 1 }]);
    s.set([]);
    await settle();
    expect(s.root.children).toHaveLength(0);
    expect(s.play('a', 'talk')).toBe(false);
    s.dispose();
  });
});
