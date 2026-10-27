/**
 * Followers (§10.7.9): the party lead trails its trainer along the trainer's path (never cutting the corner, never an
 * exponential ease), keeps its distance standing still, snaps behind after a teleport, stands on the ground sampler,
 * floats along a lifted (gliding) owner, turns its back walking away from the camera, is a world-effects walker after
 * the character rigs, carries the Fire lead's light, and the character pool lifts a gliding actor off the ground.
 */
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { BillboardPool } from '../src/sprites/billboard.js';
import type { AtlasDecoder } from '../src/sprites/atlas.js';
import { ACTOR_POOL_SIZE, CharacterPool } from '../src/stage/actors.js';
import { FOLLOWER, FollowerPool, combinedWalkers } from '../src/stage/followers.js';
import { STEPS } from '../src/worldfx/footsteps.js';
import type { SpriteDescriptor } from '../src/contracts.js';
import { uniform } from 'three/tsl';

function fakeDecoder(): AtlasDecoder {
  return { decode: async (_url, crop) => ({ width: crop ? crop[2] : 2048, height: crop ? crop[3] : 2048, close: () => {} }) };
}
const desc = (id: string): SpriteDescriptor => {
  const f = { atlas: 'a-001', rect: [0, 0.5, 0.5, 1] as const, px: [0, 0, 1024, 1024] as const, footV: 0.08, aspect: 1 };
  return { id, front: f, back: f, heightM: 1.376, types: ['Fire'], variant: 'normal', isAlpha: false };
};

/** An owner the test moves by hand on a sloped ground (y = 0.1 x). */
function setup() {
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  cam.position.set(0, 20, 20);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  const owner = new Vector3(0, 0, 0);
  let lift = 0;
  const ground = (x: number, _z: number): number => 0.1 * x;
  const owners = {
    feetOf: (id: string, out: Vector3) => (id === 'me' ? out.set(owner.x, ground(owner.x, owner.z) + lift, owner.z) : null),
    groundAt: ground,
  };
  const sprites = new BillboardPool({ decoder: fakeDecoder(), camera: cam });
  const pool = new FollowerPool(sprites, owners, cam);
  return { cam, owner, pool, sprites, setLift: (m: number) => (lift = m) };
}

/** Moves the owner along (dx, dz) at `mps` for `ms`, 60 frames a second. */
function walk(t: ReturnType<typeof setup>, dx: number, dz: number, mps: number, ms: number): void {
  const l = Math.hypot(dx, dz);
  for (let k = 0; k < ms / 16.667; k++) {
    t.owner.x += (dx / l) * mps * 0.016667;
    t.owner.z += (dz / l) * mps * 0.016667;
    t.pool.update(16.667);
  }
}

describe('FollowerPool', () => {
  it('trails at the gap along the path, keeps it standing still, and walks round a corner', () => {
    const t = setup();
    expect(t.pool.set('me', desc('f:me'))).toBe(true);
    t.pool.update(16);
    walk(t, 1, 0, 4.2, 3000);
    const p = t.pool.positionOf('me', new Vector3())!;
    const behind = Math.hypot(t.owner.x - p.x, t.owner.z - p.z);
    expect(behind).toBeGreaterThan(FOLLOWER.gapM * 0.7);
    expect(behind).toBeLessThan(FOLLOWER.gapM * 1.6);
    expect(p.x).toBeLessThan(t.owner.x);
    // standing still: it settles at the gap and stops
    for (let k = 0; k < 120; k++) t.pool.update(16.667);
    const q = t.pool.positionOf('me', new Vector3())!;
    expect(Math.abs(Math.hypot(t.owner.x - q.x, t.owner.z - q.z) - FOLLOWER.gapM)).toBeLessThan(0.3);
    // a corner: the owner turns +z; a moment later the follower is still on the old leg (x < corner), not cutting across
    const cornerX = t.owner.x;
    walk(t, 0, 1, 4.2, 250);
    const c = t.pool.positionOf('me', new Vector3())!;
    expect(c.x).toBeLessThanOrEqual(cornerX + 0.05);
    // it stands on the ground
    expect(c.y).toBeCloseTo(0.1 * c.x, 1);
  });

  it('snaps behind the owner after a teleport, follows a lifted (gliding) owner up, hides and shows', () => {
    const t = setup();
    t.pool.set('me', desc('f:me'));
    t.pool.update(16);
    walk(t, 1, 0, 4.2, 1000);
    t.owner.set(80, 0, 40);
    t.pool.update(16.667);
    const p = t.pool.positionOf('me', new Vector3())!;
    expect(Math.hypot(p.x - 80, p.z - 40)).toBeLessThan(FOLLOWER.gapM + 0.1);
    t.setLift(4);
    walk(t, 1, 0, 7, 1500);
    const g = t.pool.positionOf('me', new Vector3())!;
    expect(g.y).toBeGreaterThan(0.1 * g.x + 2);
    t.pool.setShown('me', false);
    expect(t.pool.positionOf('me', new Vector3())).toBeNull();
    t.pool.setShown('me', true);
    t.pool.update(16.667);
    expect(t.pool.positionOf('me', new Vector3())).not.toBeNull();
  });

  it('turns its back walking away from the camera, its face walking toward it; front-only cards never turn', () => {
    const t = setup();
    t.pool.set('me', desc('f:me'));
    t.pool.update(16);
    walk(t, 0, -1, 4.2, 1500); // away from the camera (which sits at +z)
    expect(t.pool.billboardOf('me')!.facing).toBe('back');
    walk(t, 0, 1, 4.2, 1500);
    expect(t.pool.billboardOf('me')!.facing).toBe('front');
    t.pool.set('me', t.pool.billboardOf('me')!.descriptor, true);
    walk(t, 0, -1, 4.2, 1500);
    expect(t.pool.billboardOf('me')!.facing).toBe('front');
  });

  it('keeps its back through a frame on which the owner did not move, and shows its face once both stood a moment', () => {
    const t = setup();
    t.pool.set('me', desc('f:me'));
    t.pool.update(16);
    walk(t, 0, -1, 4.2, 1000);
    expect(t.pool.billboardOf('me')!.facing).toBe('back');
    // the fixed movement step beating the frame rate: every third frame the owner's feet do not move
    const faces = new Set<string>();
    for (let k = 0; k < 180; k++) {
      if (k % 3 !== 0) t.owner.z -= 4.2 * 0.025;
      t.pool.update(16.667);
      faces.add(t.pool.billboardOf('me')!.facing);
    }
    expect([...faces]).toEqual(['back']);
    // it stops: the face once it and its owner have stood FOLLOWER.faceFrontAfterS, not before
    let frontAt = -1;
    for (let k = 0; k < 120 && frontAt < 0; k++) {
      t.pool.update(16.667);
      if (t.pool.billboardOf('me')!.facing === 'front') frontAt = k;
    }
    expect(frontAt * 16.667).toBeGreaterThanOrEqual(FOLLOWER.faceFrontAfterS * 1000 - 20);
    expect(frontAt * 16.667).toBeLessThan(FOLLOWER.faceFrontAfterS * 1000 + 900);
  });

  it('is a walker after the character rigs; the footstep slots cover both', () => {
    const t = setup();
    t.pool.set('me', desc('f:me'));
    t.pool.update(16);
    walk(t, 1, 0, 4.2, 500);
    const slots: number[] = [];
    t.pool.forEachWalker((slot, _f, _n, speed) => { slots.push(slot); expect(speed).toBeGreaterThan(1); });
    expect(slots).toEqual([ACTOR_POOL_SIZE]);
    expect(STEPS.slots).toBeGreaterThanOrEqual(ACTOR_POOL_SIZE + FOLLOWER.max);
    const actors = new CharacterPool({ harvestLevel: uniform(0) });
    actors.spawn('a', { look: 'casual_male', name: 'a', guildTag: '', isLocal: false });
    const all: number[] = [];
    combinedWalkers(actors, t.pool).forEachWalker((slot) => all.push(slot));
    expect(all).toEqual([0, ACTOR_POOL_SIZE]);
  });

  it('a full pool refuses; a new descriptor swaps the card in place; null removes it', () => {
    const t = setup();
    for (let i = 0; i < FOLLOWER.max; i++) expect(t.pool.set(`o${i}`, desc(`f:${i}`))).toBe(true);
    expect(t.pool.set('extra', desc('f:x'))).toBe(false);
    const before = t.pool.billboardOf('o0');
    t.pool.set('o0', desc('f:new'));
    expect(t.pool.billboardOf('o0')).not.toBe(before);
    expect(t.pool.size).toBe(FOLLOWER.max);
    t.pool.set('o0', null);
    expect(t.pool.has('o0')).toBe(false);
    expect(t.pool.set('extra', desc('f:x'))).toBe(true);
  });

  it('carries the Fire lead light over its follower, off when asked or hidden', () => {
    const t = setup();
    t.pool.set('me', desc('f:me'));
    t.pool.update(16);
    expect(t.pool.lightIntensity).toBe(0);
    t.pool.setLight('me', 1);
    walk(t, 1, 0, 2, 500);
    expect(t.pool.lightIntensity).toBeGreaterThan(FOLLOWER.lightIntensity * 0.85);
    const p = t.pool.positionOf('me', new Vector3())!;
    expect(t.pool.light.position.y).toBeCloseTo(p.y + FOLLOWER.lightLiftM, 3);
    expect(t.pool.light.castShadow).toBe(false);
    t.pool.setShown('me', false);
    t.pool.update(16);
    expect(t.pool.lightIntensity).toBe(0);
    t.pool.setShown('me', true);
    t.pool.setLight(null, 1);
    t.pool.update(16);
    expect(t.pool.lightIntensity).toBe(0);
  });
});

describe('CharacterPool lift (a glide)', () => {
  it('raises the feet over the ground, keeps the shadow down, and leaves the world-effects walkers', () => {
    const actors = new CharacterPool({ harvestLevel: uniform(0) });
    actors.setGround(() => 2);
    actors.spawn('p', { look: 'casual_male', name: 'p', guildTag: '', isLocal: true });
    actors.setTransform('p', 1, 1, 0, true, true);
    expect(actors.feetOf('p', new Vector3())!.y).toBe(2);
    expect(actors.groundAt(5, 5)).toBe(2);
    actors.setLift('p', 3.5);
    expect(actors.feetOf('p', new Vector3())!.y).toBeCloseTo(5.5, 5);
    let n = 0;
    actors.forEachWalker(() => n++);
    expect(n).toBe(0);
    actors.setLift('p', 0);
    actors.forEachWalker(() => n++);
    expect(n).toBe(1);
  });
});
