/**
 * §10.7.6 / §10.7.7 KayKit characters in the actor pool (node, no GPU), over a synthetic `CharacterSource` shaped like
 * the pipeline's output: manifest parsing and look resolution, bodies cloned per actor (shared geometry, own bones,
 * the one `'character'` material, per-object tile), accessories on the hand-slot joint, gait by measured speed with
 * foot-matched time scales, facing smoothing, emotes, nearest-N shadow casters and distance LOD, recycling, anchors,
 * and an exact dispose.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  AnimationClip, Bone, BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardNodeMaterial, NumberKeyframeTrack, PerspectiveCamera, QuaternionKeyframeTrack, Skeleton,
  Quaternion, SkinnedMesh, Texture, Vector3,
} from 'three/webgpu';
import { uniform } from 'three/tsl';
import { ACTOR_POOL_SIZE, BREAKDANCE_EMOTE, BREAKDANCE_MS, CHARACTER, FP_HEADLESS_SCALE, CharacterPool, EMOTE_CLIPS, EMOTE_POSES, emoteMs } from '../src/stage/actors.js';
import { parseCharacterSet, resolveLook, type AccessoryTemplate, type CharacterSet, type CharacterSource, type ShapeTemplate } from '../src/stage/looks.js';

const file = (url: string) => ({ url, bytes: 1, hash: 'abcdef0123456789' });
const MANIFEST = {
  version: 2,
  characters: {
    rig: 'Rig_Medium', scale: 0.68, heightM: 1.55,
    animations: { ...file('characters/animations.glb'), clips: ['cheer', 'flinch', 'idle', 'run', 'use', 'walk'], durations: {}, gaitSpeed: { walk: 0.8, run: 3.4 } },
    atlas: { ...file('characters/atlas.abcdef01.ktx2'), textures: 'ktx2', width: 2048, height: 1024, columns: 8, rows: 4, tileSize: 256 },
    shapes: { ranger_lad: { ...file('characters/ranger_lad.glb'), triangles: 8000, texture: 'ranger' }, knight: { ...file('characters/knight.glb'), triangles: 5000, texture: 'knight' } },
    accessories: { mug_full: { ...file('characters/acc_mug_full.glb'), triangles: 400, texture: 'barbarian', bone: 'handslot.r' } },
  },
  looks: {
    casual_male: { shape: 'ranger_lad', tile: 7, accessory: null, accessoryTile: null, scale: 0.68, heightM: 1.55 },
    casual3_male: { shape: 'ranger_lad', tile: 5, accessory: 'mug_full', accessoryTile: 24, scale: 0.68, heightM: 1.55 },
    knight_male: { shape: 'knight', tile: 15, accessory: null, accessoryTile: null, scale: 0.68, heightM: 1.63 },
    'knight_male:forge': { shape: 'knight', tile: 16, accessory: null, accessoryTile: null, scale: 0.68, heightM: 1.63 },
    broken: { shape: 'no_such_shape', tile: 3 },
  },
  totalBytes: 1,
};

/** A shape template like GLTFLoader gives for a pipeline shape: Group → root bone chain + one SkinnedMesh. */
function shapeTemplate(id: string): ShapeTemplate {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 2.3, 0]), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2));
  g.setAttribute('skinIndex', new BufferAttribute(new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0]), 4));
  g.setAttribute('skinWeight', new BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 4));
  const root = new Bone(); root.name = 'root';
  const hips = new Bone(); hips.name = 'hips'; hips.position.y = 0.4; root.add(hips);
  const head = new Bone(); head.name = 'head'; head.position.y = 0.84; hips.add(head);
  const hand = new Bone(); hand.name = 'handslotr'; hand.position.set(-0.5, 0.5, 0); hips.add(hand);
  const mesh = new SkinnedMesh(g, new MeshStandardNodeMaterial());
  mesh.name = id;
  const scene = new Group();
  scene.add(root, mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new Skeleton([root, hips, head, hand]));
  return { id, scene, mesh };
}

function clips(): AnimationClip[] {
  // like the shipped clips, every clip sways the head's rotation: the mixer rewrites it each frame (it skips a value that
  // did not change), so procedural poses never pile up
  const sway = Math.sin(0.01);
  return ['idle', 'walk', 'run', 'cheer', 'flinch', 'use'].map((n) => new AnimationClip(n, 1, [
    new NumberKeyframeTrack('head.position[y]', [0, 1], [0.84, 0.9]),
    new QuaternionKeyframeTrack('head.quaternion', [0, 0.5, 1], [0, 0, 0, 1, 0, sway, 0, Math.cos(0.01), 0, 0, 0, 1]),
  ]));
}

function source(over: Partial<CharacterSource> = {}): CharacterSource & { shapeCalls: string[]; disposed: number } {
  const shapeCalls: string[] = [];
  const s = {
    shapeCalls, disposed: 0,
    set: async () => parseCharacterSet(MANIFEST),
    clips: async () => clips(),
    atlas: async () => { const t = new Texture(); t.name = 'atlas'; return t; },
    shape: async (id: string) => { shapeCalls.push(id); return id === 'no_such_shape' ? null : shapeTemplate(id); },
    accessory: async (id: string): Promise<AccessoryTemplate> => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0]), 3));
      return { id, mesh: new Mesh(g, new MeshStandardNodeMaterial()), bone: 'handslot.r' };
    },
    dispose() { s.disposed++; },
    ...over,
  };
  return s;
}

function camera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 400);
  cam.position.set(0, 20.49, 16.01); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  return cam;
}

const flush = async (): Promise<void> => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

async function readyPool(src = source()): Promise<{ pool: CharacterPool; src: ReturnType<typeof source> }> {
  const pool = new CharacterPool({ harvestLevel: uniform(0), camera: camera(), viewport: () => ({ w: 1280, h: 720 }), source: src });
  await pool.ready;
  return { pool, src };
}

/** Moves `id` in a straight line at `speed` m/s for `frames` × 16 ms. */
function walk(pool: CharacterPool, id: string, speed: number, frames: number, running = false): void {
  for (let i = 0; i < frames; i++) {
    const t = i * 0.016;
    pool.setTransform(id, speed * t, 0, Math.PI / 2, speed > 0, running);
    pool.update(16);
  }
}

describe('manifest v2 and look resolution', () => {
  it('parses the character set; v1 / missing parts → null; looks on an unknown shape are skipped', () => {
    const s = parseCharacterSet(MANIFEST)!;
    expect(Object.keys(s.looks).sort()).toEqual(['casual3_male', 'casual_male', 'knight_male', 'knight_male:forge']);
    expect(s.animations.gaitSpeed).toEqual({ walk: 0.8, run: 3.4 });
    expect(parseCharacterSet({ ...MANIFEST, version: 1 })).toBeNull();
    expect(parseCharacterSet({ version: 2, looks: {} })).toBeNull();
    expect(parseCharacterSet(null)).toBeNull();
  });

  it('resolves a variant, falls back to the base look for an unknown palette and to a deterministic base look otherwise', () => {
    const s = parseCharacterSet(MANIFEST) as CharacterSet;
    expect(resolveLook(s, 'knight_male:forge').id).toBe('knight_male:forge');
    expect(resolveLook(s, 'knight_male:ember').id).toBe('knight_male');
    const a = resolveLook(s, 'spectator_3_1').id;
    expect(['casual3_male', 'casual_male', 'knight_male']).toContain(a);
    expect(resolveLook(s, 'spectator_3_1').id).toBe(a);
    // ids differing in their last character spread over the base looks (plain FNV-1a put them all on one)
    const picks = new Set(Array.from({ length: 6 }, (_, i) => resolveLook(s, `spectator_3_${i}`).id));
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('CharacterPool — KayKit bodies', () => {
  it('no source: decals and anchors only, no body, ready = false', async () => {
    const pool = new CharacterPool({ harvestLevel: uniform(0), camera: camera() });
    expect(await pool.ready).toBe(false);
    pool.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: true });
    expect(pool.hasModel('a')).toBe(false);
    expect(pool.decalMesh.count).toBe(1);
    pool.dispose();
  });

  it('one body per actor: shared geometry per shape, own skeleton, the one character material, the look tile, one load per shape', async () => {
    const { pool, src } = await readyPool();
    pool.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: true });
    pool.spawn('b', { look: 'casual3_male', name: 'B', guildTag: '', isLocal: false });
    pool.spawn('k', { look: 'knight_male:forge', name: 'K', guildTag: '', isLocal: false });
    await flush();
    expect(src.shapeCalls.sort()).toEqual(['knight', 'ranger_lad']);
    const ma = pool.meshOf('a')!, mb = pool.meshOf('b')!, mk = pool.meshOf('k')!;
    expect(ma.geometry).toBe(mb.geometry);
    expect(ma.geometry).not.toBe(mk.geometry);
    expect(ma.skeleton).not.toBe(mb.skeleton);
    expect(ma.material).toBe(pool.material);
    expect(mk.material).toBe(pool.material);
    expect(ma.userData).toMatchObject({ sharp: 1, ewaTile: 7 });
    expect(mb.userData).toMatchObject({ sharp: 0, ewaTile: 5 });
    expect(mk.userData).toMatchObject({ ewaTile: 16 });
    expect(pool.lookOf('k')).toBe('knight_male:forge');
    // scaled to the manifest's one factor; the root is a child of the pool root
    const root = ma.parent!;
    expect(root.parent).toBe(pool.root);
    expect(root.scale.y).toBeCloseTo(0.68, 6);
    // accessory: on the hand-slot joint, the pool material, its own tile, sharp follows the actor
    const acc = pool.accessoryOf('b')!;
    expect(acc.parent!.name).toBe('handslotr');
    expect(acc.material).toBe(pool.material);
    expect(acc.userData).toMatchObject({ ewaTile: 24, sharp: 0 });
    expect(pool.accessoryOf('a')).toBeNull();
    pool.dispose();
  });

  it('gait follows the measured speed: walk at 1 m/s, run at the protocol speeds, each clip timed to the ground; idle when still', async () => {
    const { pool } = await readyPool();
    pool.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: false });
    await flush();
    walk(pool, 'a', 0, 30);
    expect(pool.gaitOf('a')!.idle).toBeGreaterThan(0.95);
    walk(pool, 'a', 1.0, 60);
    let g = pool.gaitOf('a')!;
    expect(g.speed).toBeCloseTo(1.0, 1);
    expect(g.walk).toBeGreaterThan(0.9);
    walk(pool, 'a', 4.2, 60);
    g = pool.gaitOf('a')!;
    expect(g.run).toBeGreaterThan(0.95);
    // the run clip plays at speed / (clip ground speed × scale): planted feet move with the ground
    const inst = (pool as unknown as { rigs: { id: string | null; inst: { run: { getEffectiveTimeScale(): number } } | null }[] }).rigs.find((r) => r.id === 'a')!.inst!;
    expect(inst.run.getEffectiveTimeScale()).toBeCloseTo(4.2 / (3.4 * 0.68), 1);
    walk(pool, 'a', 7.0, 60, true);
    expect(inst.run.getEffectiveTimeScale()).toBeCloseTo(Math.min(CHARACTER.runScaleMax, 7 / (3.4 * 0.68)), 1);
    // the flags alone do not animate: a `moving` actor that does not move stands
    for (let i = 0; i < 60; i++) { pool.setTransform('a', 0, 0, 0, true, true); pool.update(16); }
    expect(pool.gaitOf('a')!.idle).toBeGreaterThan(0.95);
    pool.dispose();
  });

  it('facing turns smoothly along the shortest arc', async () => {
    const { pool } = await readyPool();
    pool.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: false });
    await flush();
    pool.setTransform('a', 0, 0, 3.0, false, false);
    pool.update(16);
    pool.setTransform('a', 0, 0, -3.0, false, false);
    pool.update(16);
    const y1 = pool.gaitOf('a')!.yaw;
    expect(Math.abs(y1)).toBeGreaterThan(3.0);                    // went through ±π, not back through 0
    for (let i = 0; i < 60; i++) pool.update(16);
    expect(pool.gaitOf('a')!.yaw).toBeCloseTo(-3.0, 3);
    expect(pool.meshOf('a')!.parent!.rotation.y).toBeCloseTo(-3.0, 3);
    pool.dispose();
  });

  it('an emote plays its clip over the blend while standing and yields to walking; it clears after 2 s', async () => {
    const { pool } = await readyPool();
    pool.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: false });
    await flush();
    pool.setEmote('a', 2);
    for (let i = 0; i < 40; i++) pool.update(16);
    expect(EMOTE_CLIPS[2]).toBe('cheer');
    expect(pool.gaitOf('a')!.emote).toBeGreaterThan(0.95);
    expect(pool.emoteOf('a').n).toBe(2);
    walk(pool, 'a', 2, 40);
    expect(pool.gaitOf('a')!.emote).toBeLessThan(0.05);
    for (let i = 0; i < 100; i++) pool.update(16);
    expect(pool.emoteOf('a').n).toBe(0);
    pool.dispose();
  });

  it('the breakdance (emote 7) runs 6 s and throws the body around; a hop lifts a villager; a hidden actor draws no body', async () => {
    const { pool } = await readyPool();
    pool.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: false });
    pool.spawn('b', { look: 'casual_male', name: 'B', guildTag: '', isLocal: false });
    await flush();
    pool.setTransform('a', 0, 0, 0, false, false);
    pool.setTransform('b', 3, 0, 0, false, false);
    pool.update(16);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the instance root is private
    const root = (id: string) => (pool as any).byId.get(id).inst.root as { position: { y: number }; rotation: { x: number } };
    pool.setEmote('a', BREAKDANCE_EMOTE);
    pool.setHop('b', BREAKDANCE_MS);
    let lifted = 0;
    let flipped = false;
    let hopped = 0;
    for (let t = 0; t < 3000; t += 16) {
      pool.update(16);
      lifted = Math.max(lifted, root('a').position.y);
      if (Math.abs(root('a').rotation.x) > 3) flipped = true;
      hopped = Math.max(hopped, root('b').position.y);
    }
    expect(pool.emoteOf('a').n).toBe(BREAKDANCE_EMOTE);
    expect(lifted).toBeGreaterThan(1);
    expect(flipped).toBe(true);
    expect(hopped).toBeGreaterThan(0.2);
    for (let t = 0; t < 3300; t += 16) pool.update(16);
    expect(pool.emoteOf('a').n).toBe(0);
    pool.update(16);
    expect(root('a').position.y).toBeCloseTo(0);
    expect(root('a').rotation.x).toBe(0);
    pool.setHidden('b', true);
    pool.update(16);
    expect((pool as unknown as { byId: Map<string, { inst: { root: { visible: boolean } } }> }).byId.get('b')!.inst.root.visible).toBe(false);
    pool.dispose();
  });

  it('the emote wheel (8..14) plays each silly one for its own length, moves the body and leaves it upright', async () => {
    const { pool } = await readyPool();
    pool.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: false });
    await flush();
    pool.setTransform('a', 0, 0, 0, false, false);
    pool.update(16);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the instance root is private
    const root = (id: string) => (pool as any).byId.get(id).inst.root as { position: { y: number }; rotation: { x: number; y: number; z: number } };
    for (const n of [8, 9, 10, 11, 12, 13, 14] as const) {
      expect(EMOTE_POSES[n], `emote ${n}`).not.toBeNull();
      expect(emoteMs(n)).toBeGreaterThan(2000);
      pool.setEmote('a', n);
      let moved = 0;
      for (let t = 0; t < emoteMs(n) - 200; t += 16) {
        pool.update(16);
        const r = root('a');
        moved = Math.max(moved, Math.abs(r.position.y), Math.abs(r.rotation.x), Math.abs(r.rotation.y), Math.abs(r.rotation.z));
      }
      expect(pool.emoteOf('a').n, `emote ${n} still on`).toBe(n);
      expect(moved, `emote ${n} moves`).toBeGreaterThan(0.05);
      for (let t = 0; t < 400; t += 16) pool.update(16);
      expect(pool.emoteOf('a').n, `emote ${n} over`).toBe(0);
      for (let t = 0; t < 600; t += 16) pool.update(16);
      expect(root('a').position.y).toBeCloseTo(0);
      expect(root('a').rotation.x).toBe(0);
      expect(root('a').rotation.z).toBe(0);
    }
    pool.dispose();
  });

  it('first person rides the emoting head (the bird looks down at the crank, six seven up, crying down then up) and shows the body headless', async () => {
    const { pool } = await readyPool();
    pool.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: false });
    await flush();
    pool.setTransform('a', 0, 0, 0, false, false);
    pool.setHidden('a', true);
    pool.update(16);
    const head = new Vector3(), pivot = new Vector3(), q = new Quaternion();
    expect(pool.emoteHead('a', head, pivot, q)).toBe(0);
    // the view's forward (the body faces +z at yaw 0) after the head's turn: left of it is +x, up is +y
    const view = (n: 12 | 13 | 14, atMs: number): Vector3 => {
      pool.setEmote('a', n);
      for (let t = 0; t < atMs; t += 16) pool.update(16);
      expect(pool.emoteHead('a', head, pivot, q), `emote ${n} weight`).toBeGreaterThan(0.9);
      return new Vector3(0, 0, 1).applyQuaternion(q);
    };
    expect(view(13, 800).y, 'the bird, eyes on the crank').toBeLessThan(-0.2);
    expect(view(12, 3200).y, 'six seven, the SIX SEVEEEN').toBeGreaterThan(0.2);
    expect(view(14, 1200).y, 'crying, face in the hands').toBeLessThan(-0.2);
    pool.setEmote('a', 0);
    for (let t = 0; t < 600; t += 16) pool.update(16);
    expect(view(14, 1900).y, 'crying, the wail').toBeGreaterThan(0.2);
    // the hands in view: the body draws while it emotes, its head shrunk away; hidden and whole again after
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the instance is private
    const inst = (pool as any).byId.get('a').inst as { root: { visible: boolean }; head: { scale: Vector3 } };
    expect(inst.root.visible).toBe(true);
    expect(inst.head.scale.x).toBe(FP_HEADLESS_SCALE);
    for (let t = 0; t < 3000; t += 16) pool.update(16);
    expect(pool.emoteOf('a').n).toBe(0);
    expect(inst.root.visible).toBe(false);
    pool.setHidden('a', false);
    pool.update(16);
    expect(inst.head.scale.x).toBe(1);
    pool.dispose();
  });

  it('shadows from the nearest 12 bodies within range; accessories hidden and bodies culled with distance', async () => {
    const { pool } = await readyPool();
    const cam = camera();
    for (let i = 0; i < 20; i++) {
      pool.spawn(`n${i}`, { look: 'casual3_male', name: '', guildTag: '', isLocal: false });
      pool.setTransform(`n${i}`, 0, -i * 1.5, 0, false, false);          // ever farther from the camera
    }
    pool.spawn('far', { look: 'casual3_male', name: '', guildTag: '', isLocal: false });
    pool.setTransform('far', 0, -(CHARACTER.cullRangeM + 30), 0, false, false);
    await flush();
    pool.update(16);
    const casters = Array.from({ length: 20 }, (_, i) => pool.meshOf(`n${i}`)!.castShadow);
    expect(casters.filter(Boolean)).toHaveLength(CHARACTER.shadowCasters);
    expect(casters.slice(0, CHARACTER.shadowCasters).every(Boolean)).toBe(true);   // the nearest ones
    expect(pool.stats().shadowCasters).toBe(CHARACTER.shadowCasters);
    const d = (i: number): number => cam.position.distanceTo(new Vector3(0, 0, -i * 1.5));
    for (let i = 0; i < 20; i++) expect(pool.accessoryOf(`n${i}`)!.visible, `n${i}`).toBe(d(i) <= CHARACTER.accessoryRangeM);
    expect(pool.meshOf('far')!.parent!.visible).toBe(false);
    expect(pool.meshOf('far')!.castShadow).toBe(false);
    for (let i = 0; i < 20; i++) expect(pool.accessoryOf(`n${i}`)!.castShadow).toBe(false);
    pool.dispose();
  });

  it('despawn recycles the body per shape and the accessory per id; the pool never grows past 48', async () => {
    const { pool } = await readyPool();
    pool.spawn('a', { look: 'casual3_male', name: '', guildTag: '', isLocal: false });
    await flush();
    const body = pool.meshOf('a')!;
    const acc = pool.accessoryOf('a')!;
    pool.despawn('a');
    expect(body.parent!.parent).toBeNull();
    expect(acc.parent).toBeNull();
    pool.spawn('b', { look: 'casual3_male', name: '', guildTag: '', isLocal: false });
    expect(pool.meshOf('b')).toBe(body);
    expect(pool.accessoryOf('b')).toBe(acc);
    expect(pool.capacity).toBe(ACTOR_POOL_SIZE);
    pool.dispose();
  });

  it('nameplate anchors sit above the look top, at the head joint', async () => {
    const { pool } = await readyPool();
    pool.spawn('a', { look: 'knight_male', name: 'A', guildTag: '', isLocal: false });
    await flush();
    pool.setTransform('a', 0, 0, 0, false, false);
    pool.update(16);
    const out = new Float32Array(4);
    expect(pool.projectHead('a', out, 0)).toBe(true);
    const feet = new Float32Array(2);
    const cam = camera();
    const p = new Vector3(0, 0, 0).project(cam);
    feet[1] = (-p.y * 0.5 + 0.5) * 720;
    expect(out[1]!).toBeLessThan(feet[1]!);                     // above the feet on screen
    const top = new Vector3(0, 1.63 + CHARACTER.headMarginM, 0).project(cam);
    expect(Math.abs(out[1]! - (-top.y * 0.5 + 0.5) * 720)).toBeLessThan(4);   // the idle clip lifts the head a little
    expect(pool.screenPositions(new Float32Array(8))).toBe(1);
    pool.dispose();
  });

  it('dispose is exact: material, placeholder, decals and clone skeletons released once; the source disposes the templates', async () => {
    const { pool, src } = await readyPool();
    pool.spawn('a', { look: 'casual3_male', name: '', guildTag: '', isLocal: false });
    pool.spawn('b', { look: 'knight_male', name: '', guildTag: '', isLocal: false });
    await flush();
    pool.despawn('b');                                           // one clone in the free list, one live
    const events: string[] = [];
    pool.material.addEventListener('dispose', () => events.push('material'));
    pool.characterMaterial.placeholder.addEventListener('dispose', () => events.push('placeholder'));
    pool.decalMesh.geometry.addEventListener('dispose', () => events.push('decal-geometry'));
    (pool.decalMesh.material as MeshStandardNodeMaterial).addEventListener('dispose', () => events.push('decal-material'));
    const skA = vi.spyOn(pool.meshOf('a')!.skeleton, 'dispose');
    const warm = pool.warmupMesh();
    let warmGeoms = 0;
    warm.traverse((o) => { if ((o as Mesh).isMesh === true) (o as Mesh).geometry.addEventListener('dispose', () => { warmGeoms++; }); });
    pool.dispose();
    pool.dispose();
    expect(events.sort()).toEqual(['decal-geometry', 'decal-material', 'material', 'placeholder']);
    expect(skA).toHaveBeenCalledTimes(1);
    expect(warmGeoms).toBe(2);
    expect(src.disposed).toBe(1);
    expect(pool.root.parent).toBeNull();
  });

  it('the warm-up body is a 23-bone skinned mesh with the shipped attribute formats, plus an accessory, both on the character material', () => {
    const pool = new CharacterPool({ harvestLevel: uniform(0), camera: camera() });
    const w = pool.warmupMesh();
    const meshes: Mesh[] = [];
    w.traverse((o) => { if ((o as Mesh).isMesh === true) meshes.push(o as Mesh); });
    expect(meshes).toHaveLength(2);
    const body = meshes.find((m) => (m as SkinnedMesh).isSkinnedMesh === true) as SkinnedMesh;
    expect(body.skeleton.bones).toHaveLength(23);
    expect(body.geometry.getAttribute('position').array).toBeInstanceOf(Int16Array);
    expect(body.geometry.getAttribute('skinIndex').array).toBeInstanceOf(Uint8Array);
    for (const m of meshes) { expect(m.material).toBe(pool.material); expect(m.castShadow).toBe(true); }
    expect(pool.warmupMesh()).toBe(w);
    pool.dispose();
  });
});
