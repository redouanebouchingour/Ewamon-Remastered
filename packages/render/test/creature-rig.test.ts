/**
 * Rigged 3D creature bodies (sprites/creatureRig.ts, IMPLEMENTATION-NOTES "Rigged creatures"), node, no GPU: a tiny
 * two-bone skinned template with named clips; the pool clones it per creature and the player picks the clip.
 */
import { describe, expect, it } from 'vitest';
import {
  AnimationClip, Bone, BufferAttribute, BufferGeometry, Group, Matrix4, MeshStandardNodeMaterial, NumberKeyframeTrack, Skeleton, SkinnedMesh,
} from 'three/webgpu';
import { CreatureRigPlayer, RIG, type CreatureRigTemplate } from '../src/sprites/creatureRig.js';
import { BillboardPool } from '../src/sprites/billboard.js';
import type { CreatureModelSource } from '../src/sprites/creatureModels.js';
import type { SpriteDescriptor } from '../src/contracts.js';

function template(names: readonly string[]): CreatureRigTemplate {
  const root = new Bone(); root.name = 'root';
  const head = new Bone(); head.name = 'head'; head.position.y = 0.5;
  root.add(head);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 0.1, 0, 0, 0, 0.6, 0]), 3));
  g.setAttribute('skinIndex', new BufferAttribute(new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]), 4));
  g.setAttribute('skinWeight', new BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 4));
  const mesh = new SkinnedMesh(g);
  const scene = new Group();
  scene.add(root, mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new Skeleton([root, head]), new Matrix4());
  // every clip moves the head on its own height, so the test can tell which one is playing
  const clips = names.map((n, i) => new AnimationClip(n, n === 'idle' ? 4 : n === 'walk' ? 1.2 : 0.3, [
    new NumberKeyframeTrack('head.position[x]', [0, n === 'idle' ? 4 : n === 'walk' ? 1.2 : 0.3], [i, i]),
  ]));
  return { scene, clips };
}

const ALL = ['idle', 'walk', 'idle_wave', 'lunge', 'faint', 'windup'];
const player = (names = ALL): CreatureRigPlayer => new CreatureRigPlayer(template(names), new MeshStandardNodeMaterial(), {}, 'flowbot', 1, 2);
const step = (p: CreatureRigPlayer, s: number, moved = 0, dt = 1 / 30): void => { for (let t = 0; t < s; t += dt) p.update(dt, moved * dt); };

describe('rigged creature bodies (creatureRig.ts)', () => {
  it('a clone of the template per body (own bones and skeleton, shared geometry), idling', () => {
    const t = template(ALL);
    const mat = new MeshStandardNodeMaterial();
    const ud = { hurt: 0 };
    const a = new CreatureRigPlayer(t, mat, ud, 'a', 1, 2);
    const b = new CreatureRigPlayer(t, mat, ud, 'b', 1, 2);
    expect(a.mesh).not.toBe(b.mesh);
    expect(a.mesh.skeleton).not.toBe(b.mesh.skeleton);
    expect(a.mesh.geometry).toBe(b.mesh.geometry);
    expect(a.mesh.material).toBe(mat);
    expect(a.mesh.userData).toBe(ud);
    expect(a.clipNames).toEqual(ALL);
    expect(a.playing).toBe('idle');
    a.dispose(); b.dispose();
  });

  it('walks while the feet move, idles when they stop', () => {
    const p = player();
    step(p, 0.5, 2.5);
    expect(p.playing).toBe('walk');
    step(p, 1, 0);
    expect(p.playing).toBe('idle');
    p.dispose();
  });

  it('a battle pose plays its clip once, stretched to the ms, then the loop returns; faint holds', () => {
    const p = player();
    p.setPose('lunge', 600);
    expect(p.playing).toBe('lunge');
    step(p, 0.4);
    expect(p.playing).toBe('lunge');       // 0.3 s clip over 600 ms
    step(p, 0.3);
    expect(p.playing).toBe('idle');
    p.setPose('faint', 900);
    step(p, 2);
    expect(p.playing).toBe('faint');
    p.setPose('idle', 0);
    expect(p.playing).toBe('idle');
    p.setPose('celebrate', 600);           // no clip: the loop keeps going
    expect(p.playing).toBe('idle');
    p.dispose();
  });

  it('a windup with no follow-up holds, then gives way; setFaint scrubs the faint clip', () => {
    const p = player();
    p.setPose('windup', 250);
    step(p, 0.25 + RIG.windupHoldS * 0.5);
    expect(p.playing).toBe('windup');
    step(p, RIG.windupHoldS);
    expect(p.playing).toBe('idle');
    p.setFaint(0.5);
    expect(p.playing).toBe('faint');
    step(p, 3);
    expect(p.playing).toBe('faint');
    p.setFaint(0);
    expect(p.playing).toBe('idle');
    p.dispose();
  });

  it('fidgets now and then while idling, never while walking', () => {
    const p = player();
    const seen = new Set<string>();
    for (let t = 0; t < RIG.fidgetS[0] + RIG.fidgetS[1] + 1; t += 1 / 30) { p.update(1 / 30, 0); seen.add(p.playing!); }
    expect(seen.has('idle_wave')).toBe(true);
    const w = player();
    const walking = new Set<string>();
    for (let t = 0; t < 20; t += 1 / 30) { w.update(1 / 30, 2.5 / 30); walking.add(w.playing!); }
    expect(walking.has('idle_wave')).toBe(false);
    p.dispose(); w.dispose();
  });

  it('the pool plays a rigged body in place of the static mesh, and drops it when models go off', async () => {
    const t = template(ALL);
    const src: CreatureModelSource = { model: () => Promise.resolve({ geometry: new BufferGeometry(), matrix: new Matrix4(), rig: t }), dispose: () => {} };
    // no atlas bound: the card waits, the body does not
    const pool = new BillboardPool({ models: src });
    const frame = { atlas: 'a-001', rect: [0, 0, 1, 1], px: [0, 0, 8, 8], footV: 0.05, aspect: 1 } as const;
    const d = { id: 'w:1', front: frame, back: frame, heightM: 1, types: ['Electric'], variant: 'normal', isAlpha: false, model: 'flowbot' } as unknown as SpriteDescriptor;
    const b = pool.acquire(d);
    pool.setModels(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(b.hasBody).toBe(true);
    expect(b.rigPlayer?.playing).toBe('idle');
    for (let i = 0; i < 40; i++) { pool.update(50); expect(b.object.children[2]!.position.y).toBe(0); }   // no card bob on top of the clips
    b.setPose('lunge', 300);
    expect(b.rigPlayer?.playing).toBe('lunge');
    pool.setModels(false);
    expect(b.rigPlayer).toBeNull();
    b.dispose(); pool.dispose();
  });
});
