/**
 * §10.7.7 GLB looks in the actor pool (IMPLEMENTATION-NOTES Part 4, H7), in node with a synthetic template shaped like
 * the pipeline's output (one skinned primitive, the kept clip names): procedural fallback while loading / without a
 * model / on failure, one shared geometry per look with per-actor bones, the pool's `'character'` material, the
 * manifest's scale, gait weights on idle / walk / run, recycling on despawn and disposal.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  AnimationClip, Bone, BufferAttribute, BufferGeometry, Group, MeshStandardNodeMaterial, NumberKeyframeTrack, PerspectiveCamera, Skeleton,
  SkinnedMesh,
} from 'three/webgpu';
import { uniform } from 'three/tsl';
import { CHARACTER, CharacterPool } from '../src/stage/actors.js';
import { lookScale, parseLooks, type LookSource, type LookTemplate } from '../src/stage/looks.js';

function template(look: string, scale: number): LookTemplate {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 3.1, 0]), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(9).fill(0.5), 3));
  g.setAttribute('skinIndex', new BufferAttribute(new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]), 4));
  g.setAttribute('skinWeight', new BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 4));
  const hips = new Bone(); hips.name = 'hips';
  const head = new Bone(); head.name = 'head'; head.position.y = 2.5; hips.add(head);
  const mesh = new SkinnedMesh(g, new MeshStandardNodeMaterial());
  const scene = new Group();
  scene.add(hips, mesh);
  mesh.bind(new Skeleton([hips, head]));
  const clip = (name: string): AnimationClip => new AnimationClip(name, 1, [new NumberKeyframeTrack('head.position[y]', [0, 1], [2.5, 2.6])]);
  return { look, scene, mesh, clips: ['idle', 'walk', 'run', 'victory', 'defeat', 'sitdown', 'standup'].map(clip), scale };
}

function pool(looks?: LookSource) {
  return new CharacterPool({ harvestLevel: uniform(0), camera: new PerspectiveCamera(), viewport: () => ({ w: 1280, h: 720 }), ...(looks ? { looks } : {}) });
}

const flush = async (): Promise<void> => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe('§10.7.7 GLB looks', () => {
  it('manifest: one scale for every look = 1.7 m / median height; unknown shapes are skipped', () => {
    const m = parseLooks({ looks: {
      a: { url: 'looks/a.glb', hash: 'aaaaaaaa11', clips: ['idle'], bounds: { min: [0, 0, 0], max: [1, 3.0, 1] } },
      b: { url: 'looks/b.glb', hash: 'bbbbbbbb22', clips: ['idle'], bounds: { min: [0, 0, 0], max: [1, 3.1, 1] } },
      c: { url: 'looks/c.glb', hash: 'cccccccc33', clips: ['idle'], bounds: { min: [0, 0, 0], max: [1, 3.5, 1] } },
      bad: { url: 7 },
    } });
    expect([...m.keys()]).toEqual(['a', 'b', 'c']);
    expect(lookScale(m, CHARACTER.heightM)).toBeCloseTo(1.7 / 3.1, 12);
    expect(parseLooks(null).size).toBe(0);
  });

  it('procedural while loading, then the GLB: shared geometry, own bones, the character material, scaled, one mesh per actor', async () => {
    let resolve!: (t: LookTemplate | null) => void;
    const src = vi.fn<LookSource>(() => new Promise((r) => { resolve = r; }));
    const p = pool(src);
    p.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: true });
    p.spawn('b', { look: 'casual_male', name: 'B', guildTag: '', isLocal: false });
    expect(src).toHaveBeenCalledTimes(1);                       // one load per look
    expect(p.hasModel('a')).toBe(false);
    const proc = p.meshOf('a')!;
    expect(proc.parent).toBe(p.root);
    const t = template('casual_male', 1.7 / 3.1);
    resolve(t);
    await flush();
    expect(p.hasModel('a')).toBe(true);
    const ma = p.meshOf('a')!; const mb = p.meshOf('b')!;
    expect(ma).not.toBe(proc);
    expect(proc.parent).toBeNull();                             // the procedural figure no longer draws
    expect(ma.geometry).toBe(t.mesh.geometry);                  // shared per look
    expect(mb.geometry).toBe(t.mesh.geometry);
    expect(ma.skeleton).not.toBe(mb.skeleton);                  // own bones per actor
    expect(ma.material).toBe(p.material);                       // the one 'character' material
    expect((ma.userData as { sharp: number }).sharp).toBe(1);   // the local player is DOF-sharp
    expect((mb.userData as { sharp: number }).sharp).toBe(0);
    let meshes = 0;
    const root = ma.parent!.parent === p.root ? ma.parent! : ma.parent!.parent!;
    root.traverse((o) => { if ((o as { isMesh?: boolean }).isMesh && o.visible) meshes++; });
    expect(meshes).toBe(1);                                     // one draw per actor
    // scaled to the SPEC height (the template is 3.1 units tall)
    const top = ma.parent === null ? 0 : 3.1 * (ma.parent.scale.y === 1 ? ma.parent.parent!.scale.y : ma.parent.scale.y);
    expect(top).toBeCloseTo(1.7, 6);
    p.dispose();
  });

  it('gait weights drive idle / walk / run; an emote takes over; transforms follow; recycled on despawn', async () => {
    const t = template('knight_male', 0.5);
    const p = pool(() => Promise.resolve(t));
    p.spawn('a', { look: 'knight_male', name: 'A', guildTag: '', isLocal: false });
    await flush();
    expect(p.hasModel('a')).toBe(true);
    const glb = (p as unknown as { rigs: { id: string | null; glb: { root: Group; idle: { getEffectiveWeight(): number }; walk: { getEffectiveWeight(): number }; run: { getEffectiveWeight(): number }; emotes: ({ getEffectiveWeight(): number } | null)[] } | null }[] }).rigs.find((r) => r.id === 'a')!.glb!;
    p.setTransform('a', 3, 4, 1.2, false, false);
    for (let i = 0; i < 30; i++) p.update(16);
    expect(glb.root.position.x).toBe(3); expect(glb.root.position.z).toBe(4); expect(glb.root.rotation.y).toBe(1.2);
    expect(glb.idle.getEffectiveWeight()).toBeCloseTo(1, 3);
    p.setTransform('a', 3, 4, 1.2, true, true);
    for (let i = 0; i < 60; i++) p.update(16);
    expect(glb.run.getEffectiveWeight()).toBeGreaterThan(0.95);
    expect(glb.idle.getEffectiveWeight()).toBeLessThan(0.05);
    p.setTransform('a', 3, 4, 1.2, false, false);
    p.setEmote('a', 1);                                         // wave → victory
    for (let i = 0; i < 60; i++) p.update(16);
    expect(glb.emotes[1]!.getEffectiveWeight()).toBeGreaterThan(0.95);
    p.despawn('a');
    expect(glb.root.parent).toBeNull();
    p.spawn('c', { look: 'knight_male', name: 'C', guildTag: '', isLocal: false });
    const again = (p as unknown as { rigs: { id: string | null; glb: unknown }[] }).rigs.find((r) => r.id === 'c')!.glb;
    expect(again).toBe(glb);                                     // the instance is recycled, not re-cloned
    p.dispose();
  });

  it('no model / a failed load keeps the procedural figure; dispose releases skeletons and the source', async () => {
    const warn = vi.fn();
    const dispose = vi.fn();
    const src = Object.assign(vi.fn<LookSource>(async (look) => { if (look === 'broken') throw new Error('404'); if (look === 'none') return null; return template(look, 0.5); }), { dispose });
    const p = pool(src);
    p.spawn('n', { look: 'none', name: '', guildTag: '', isLocal: false });
    p.spawn('x', { look: 'broken', name: '', guildTag: '', isLocal: false });
    p.spawn('g', { look: 'ok', name: '', guildTag: '', isLocal: false });
    await flush();
    expect(p.hasModel('n')).toBe(false);
    expect(p.hasModel('x')).toBe(false);
    expect(p.meshOf('x')!.parent).toBe(p.root);
    expect(p.hasModel('g')).toBe(true);
    const sk = vi.spyOn(p.meshOf('g')!.skeleton, 'dispose');
    p.dispose();
    expect(sk).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    void warn;
  });
});
