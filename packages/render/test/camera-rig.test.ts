/**
 * §10.7.1–§10.7.4 rig state machine (node, no GPU): heading/zoom eases, dead-zone follow with the critically damped
 * spring, pushIn/release timing and the battle pose (Pillar 7), input ignored in a shot, cues, and the Pillar 8
 * shake refusal under reduced effects.
 */
import { describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three/webgpu';
import { ALL_EFFECTS, type EffectsFlags } from '../src/descriptors.js';
import { applyReducedEffects } from '../src/post/effects.js';
import { DioramaRig, DISTANCE, HEADING_TURN_MS, PITCH, ZOOM_MS, headingYaw, springStep } from '../src/camera/rig.js';
import { BATTLE_DISTANCE, BATTLE_PITCH, BATTLE_YAW_OFFSET, BATTLER_SEPARATION, PILLAR7_RADIUS, battlerSlot, cueEnvelope } from '../src/camera/battle.js';

const DEG = Math.PI / 180;
const FRAME = 1000 / 60;

function makeRig(effects: EffectsFlags = ALL_EFFECTS, feet?: Map<string, Vector3>, lift?: Map<string, number>) {
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  const onSlowmo = vi.fn();
  const onSettled = vi.fn();
  const r = new DioramaRig(cam, {
    effects: () => effects,
    feet: feet ? (id, out) => { const f = feet.get(id); return f ? out.copy(f) : null; } : undefined,
    lift: lift ? (id) => lift.get(id) ?? 0 : undefined,
    onSlowmo, onSettled,
  });
  return { r, cam, onSlowmo, onSettled };
}

function run(r: DioramaRig, ms: number, step = FRAME): void {
  for (let t = 0; t < ms - 1e-9; t += step) r.update(Math.min(step, ms - t));
}

describe('heading and zoom eases', () => {
  it('yaw eases by smoothstep over 320 ms along the shortest arc, then settles (csm.updateFrustums hook)', () => {
    const { r, onSettled } = makeRig();
    r.update(0);
    r.setHeading(1);
    run(r, HEADING_TURN_MS / 2);
    expect(r.orbit.yaw).toBeCloseTo((headingYaw(0) + headingYaw(1)) / 2, 2);
    run(r, HEADING_TURN_MS / 2 + FRAME);
    expect(r.orbit.yaw).toBeCloseTo(headingYaw(1), 6);
    expect(onSettled).toHaveBeenCalled();
    r.setHeading(3);   // 1 → 3 is 180°: either way; 0 → 3 must go −90° (shortest)
    run(r, HEADING_TURN_MS + FRAME);
    r.setHeading(0);
    const before = r.orbit.yaw;
    run(r, HEADING_TURN_MS + FRAME);
    expect(Math.abs(r.orbit.yaw - before)).toBeCloseTo(90 * DEG, 6);
  });

  it('orbitBy turns the yaw at once and keeps the nearest heading index; setHeading snaps back to the grid', () => {
    const { r } = makeRig();
    r.update(0);
    r.orbitBy(10 * DEG);
    r.update(FRAME);
    expect(r.orbit.yaw).toBeCloseTo(headingYaw(0) + 10 * DEG, 6);
    expect(r.headingIndex).toBe(0);
    r.orbitBy(70 * DEG);   // 80° past heading 0: nearest is heading 1
    r.update(FRAME);
    expect(r.headingIndex).toBe(1);
    r.setHeading(1);       // same index, off the grid: eases onto it
    run(r, HEADING_TURN_MS + FRAME);
    expect(r.orbit.yaw).toBeCloseTo(headingYaw(1), 6);
  });

  it('distance eases between stops over 260 ms', () => {
    const { r } = makeRig();
    r.update(0);
    expect(r.orbit.distance).toBe(DISTANCE[1]);
    r.setZoomStop(2);
    run(r, ZOOM_MS / 2);
    expect(r.orbit.distance).toBeCloseTo((DISTANCE[1] + DISTANCE[2]) / 2, 3);
    run(r, ZOOM_MS);
    expect(r.orbit.distance).toBe(DISTANCE[2]);
    expect(r.orbit.pitch).toBeCloseTo(PITCH * DEG, 12);
  });
});

describe('follow: dead zone + critically damped spring', () => {
  it('focus is the feet exactly; the target does not move inside 0.8 m and follows (feet − 0.8 m) outside', () => {
    const feet = new Map([['me', new Vector3(0, 0, 0)]]);
    const { r } = makeRig(ALL_EFFECTS, feet);
    r.follow('me');
    run(r, 500);
    const c0 = r.orbit.center.clone();
    feet.get('me')!.set(0.5, 0, 0);
    run(r, 500);
    expect(r.focus.x).toBe(0.5);                         // the DOF plane passes through the feet
    expect(r.orbit.center.distanceTo(c0)).toBeLessThan(1e-6);   // inside the dead zone
    feet.get('me')!.set(3, 0, 0);
    run(r, 2000);
    expect(r.orbit.center.x).toBeCloseTo(3 - 0.8, 3);
  });

  it('long frames stay stable: 250 ms steps converge without overshoot; ≤ 1/60 s is one plain Euler step', () => {
    const s = { x: 0, v: 0 };
    let max = 0;
    for (let i = 0; i < 40; i++) { springStep(s.x, s.v, 100, 0.25, s); max = Math.max(max, Math.abs(s.x)); }
    expect(Number.isFinite(s.x)).toBe(true);
    expect(max).toBeLessThanOrEqual(100 + 1e-3);
    expect(s.x).toBeCloseTo(100, 3);
    const w = 1 / 0.12;
    const h = FRAME / 1000;
    const one = springStep(0.3, -0.2, 1, h, { x: 0, v: 0 });
    const nv = -0.2 - (2 * w * -0.2 + w * w * (0.3 - 1)) * h;
    expect(one.v).toBe(nv);
    expect(one.x).toBe(0.3 + nv * h);
  });

  it('a lift (a jump, a glide) moves the orbit centre in the same frame, unsmoothed, and back down with it', () => {
    const ground = 2;
    const feet = new Map([['me', new Vector3(0, ground, 0)]]);
    const lift = new Map([['me', 0]]);
    const { r } = makeRig(ALL_EFFECTS, feet, lift);
    r.follow('me');
    run(r, 500);
    expect(r.orbit.center.y).toBeCloseTo(ground, 6);
    for (const m of [0.4, 1.2, 0.7, 0]) {
      lift.set('me', m);
      feet.get('me')!.y = ground + m;                    // the feet include the lift (CharacterPool.feetOf)
      r.update(FRAME);
      expect(r.orbit.center.y).toBeCloseTo(ground + m, 6);
      expect(r.focus.y).toBeCloseTo(ground + m, 6);
    }
  });

  it('the spring is critically damped: no overshoot toward a step target', () => {
    const s = { x: 0, v: 0 };
    let max = 0;
    for (let i = 0; i < 200; i++) { springStep(s.x, s.v, 1, FRAME / 1000, s); max = Math.max(max, s.x); }
    expect(max).toBeLessThanOrEqual(1 + 1e-3);
    expect(s.x).toBeCloseTo(1, 3);
  });
});

describe('pushIn / release (Pillar 7) and input lock', () => {
  it('eases to the battle pose over 600 ms: 12 m, 28° pitch, yaw + 12°, within 40 u of the player', () => {
    const feet = new Map([['me', new Vector3(10, 0.4, -6)]]);
    const { r, cam } = makeRig(ALL_EFFECTS, feet);
    r.follow('me');
    run(r, 300);
    const dioYaw = r.dioramaYaw;
    r.setShotInsets(0, 0);                 // §10.7.4's 12 m pose; the DOM panel's framing is battle-framing.test.ts
    r.pushIn({ x: 11, z: -5 }, 600);
    run(r, 300);
    expect(r.shotBlend).toBeCloseTo(0.5, 2);
    run(r, 300 + FRAME);
    expect(r.shotBlend).toBe(1);
    expect(r.orbit.distance).toBeCloseTo(BATTLE_DISTANCE, 6);
    expect(r.orbit.pitch).toBeCloseTo(BATTLE_PITCH * DEG, 6);
    expect(r.orbit.yaw).toBeCloseTo(dioYaw + BATTLE_YAW_OFFSET * DEG, 6);
    expect(cam.position.distanceTo(new Vector3(11, 0.4, -5))).toBeCloseTo(BATTLE_DISTANCE, 3);
    expect(cam.position.distanceTo(feet.get('me')!)).toBeLessThan(PILLAR7_RADIUS);
    expect(r.currentMode).toBe('battle');
  });

  it('ignores heading/zoom/follow while in a shot and returns to the diorama pose on release', () => {
    const { r } = makeRig();
    r.setFocus(0, 0, 0);
    r.update(0);
    r.pushIn({ x: 0, z: 0 }, 600);
    run(r, 700);
    r.setHeading(2); r.setZoomStop(0); r.follow('someone');
    expect(r.headingIndex).toBe(0);
    expect(r.zoomStop).toBe(1);
    expect(r.followedActor).toBeNull();
    r.release(600);
    run(r, 300);
    expect(r.shotBlend).toBeCloseTo(0.5, 2);
    run(r, 300 + FRAME);
    expect(r.shotBlend).toBe(0);
    expect(r.orbit.distance).toBe(DISTANCE[1]);
    expect(r.orbit.yaw).toBeCloseTo(headingYaw(0), 9);
    expect(r.currentMode).toBe('diorama');
  });

  it('battlers stand 5.5 m apart along the view axis, the player nearer the camera', () => {
    const c = new Vector3(4, 0, 2);
    const yaw = headingYaw(0);
    const a = battlerSlot(c, yaw, 0, 0, 1, new Vector3());
    const b = battlerSlot(c, yaw, 1, 0, 1, new Vector3());
    expect(a.distanceTo(b)).toBeCloseTo(BATTLER_SEPARATION, 9);
    const camPos = new Vector3(c.x + Math.sin(yaw) * 10, 5, c.z + Math.cos(yaw) * 10);
    expect(a.distanceTo(camPos)).toBeLessThan(b.distanceTo(camPos));
  });
});

describe('cues (§10.7.4 CameraWork)', () => {
  it('impact dollies toward the defender and eases back; ko requests slow-mo only when effects.slowmo', () => {
    const { r, onSlowmo } = makeRig();
    r.setFocus(0, 0, 0);
    r.setShotInsets(0, 0);                 // no DOM panel: the row's full push fits (T2 clamps it otherwise, below)
    r.pushIn({ x: 0, z: 0 }, 0);
    r.update(FRAME);
    const d0 = r.orbit.distance;
    // a defender on the arena centre: the dolly does not swing the near battler off frame, so the full row applies
    // (a far defender scales the push back: battle-framing.test.ts)
    r.setCueTarget('defender', new Vector3(0, 0, 0));
    r.cue('impact', 0);
    run(r, 90);
    expect(r.cueFit).toBe(1);
    expect(r.orbit.distance).toBeCloseTo(d0 - 1.2, 3);
    run(r, 200 + 90 + 2 * FRAME);
    expect(r.cueActive).toBe(false);
    expect(r.orbit.distance).toBeCloseTo(d0, 6);
    r.cue('ko', 0);
    expect(onSlowmo).toHaveBeenCalledWith(0.35, 400);
    const reduced = makeRig(applyReducedEffects(ALL_EFFECTS));
    reduced.r.pushIn({ x: 0, z: 0 }, 0);
    reduced.r.cue('ko', 0);
    expect(reduced.onSlowmo).not.toHaveBeenCalled();
  });

  it('cue envelope: in, hold, out', () => {
    expect(cueEnvelope(0, 100, 200, 100)).toBe(0);
    expect(cueEnvelope(50, 100, 200, 100)).toBeCloseTo(0.5, 9);
    expect(cueEnvelope(150, 100, 200, 100)).toBe(1);
    expect(cueEnvelope(350, 100, 200, 100)).toBeCloseTo(0.5, 9);
    expect(cueEnvelope(400, 100, 200, 100)).toBe(0);
  });
});

describe('shake (Pillar 8)', () => {
  it('reduced effects: 600 frames with zero shake offset and an untouched camera orientation', () => {
    const reduced = applyReducedEffects(ALL_EFFECTS);
    const a = makeRig(reduced); const b = makeRig(reduced);
    a.r.setFocus(0, 0, 0); b.r.setFocus(0, 0, 0);
    a.r.pushIn({ x: 0, z: 0 }, 0); b.r.pushIn({ x: 0, z: 0 }, 0);
    const qa = new Quaternion(); const qb = new Quaternion();
    for (let i = 0; i < 600; i++) {
      if (i % 30 === 0) { a.r.shake(0.5, 300); a.r.cue('impact', 0); b.r.cue('impact', 0); }
      a.r.update(FRAME); b.r.update(FRAME);
      expect(a.r.shakeOffset).toBe(0);
      expect(qa.copy(a.cam.quaternion).toArray()).toEqual(qb.copy(b.cam.quaternion).toArray());   // bit-identical orientation
    }
  });

  it('with effects on, shake rotates the camera and decays to 0 over its ms; switching to reduced cuts it', () => {
    let flags: EffectsFlags = ALL_EFFECTS;
    const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
    const r = new DioramaRig(cam, { effects: () => flags });
    r.setFocus(0, 0, 0);
    r.update(FRAME);
    const q0 = cam.quaternion.clone();
    r.shake(0.4, 200);
    r.update(FRAME);
    expect(r.shakeOffset).toBeGreaterThan(0);
    expect(cam.quaternion.angleTo(q0)).toBeGreaterThan(0);
    run(r, 220);
    expect(r.shakeOffset).toBe(0);
    r.shake(5, 300);                       // clamped to SHAKE_AMP_MAX 0.5
    r.update(FRAME);
    expect(r.shakeOffset).toBeLessThanOrEqual(0.5);
    flags = applyReducedEffects(ALL_EFFECTS);
    r.update(FRAME);
    expect(r.shakeOffset).toBe(0);
  });
});

describe('shot camera vs tree crowns (IMPLEMENTATION-NOTES Part 4, H11)', () => {
  it('a battle shot is pulled in in front of a crown between the camera and the arena; the diorama is left alone', async () => {
    const { TerrainCollider } = await import('../src/terrain/collider.js');
    const { getHeightfield } = await import('@ewa/content');
    const collider = new TerrainCollider(getHeightfield('mirevale' as never));
    const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
    let occ: InstanceType<typeof TerrainCollider> | null = null;
    const r = new DioramaRig(cam, { effects: () => ALL_EFFECTS, occluders: () => occ });
    r.pushIn({ x: 0, z: 0 }, 0);
    for (let i = 0; i < 5; i++) r.update(16);
    const free = cam.position.clone();
    const centre = new Vector3(0, r.focus.y, 0);
    const dFree = free.distanceTo(centre);
    // a 2 m crown two thirds of the way from the arena to the camera
    const at = centre.clone().lerp(free, 2 / 3);
    collider.addCrown({ x: at.x, y: at.y, z: at.z, r: 2 });
    occ = collider;
    r.update(16);
    const pulled = cam.position.distanceTo(centre);
    expect(pulled).toBeLessThan(dFree - 2);
    expect(collider.inCrown(cam.position.x, cam.position.y, cam.position.z)).toBe(false);
    expect(collider.crownClearance(centre.x, centre.y, centre.z, cam.position.x, cam.position.y, cam.position.z)).toBe(1);
    // back in the diorama (blend 0) the crown does not move the camera
    r.release(0);
    r.update(16);
    const dio = cam.position.clone();
    occ = null; r.update(16);
    expect(cam.position.distanceTo(dio)).toBeLessThan(1e-6);
  });
});
