/**
 * 20-client.md §20.4.5 / 30-server-netcode.md §30.2.4 — MOVEMENT values (4.2 / 7.0 / 0.35),
 * stepMovement determinism over 10 000 steps, the speed cap, exact stop, collider contract.
 */
import { describe, expect, it } from 'vitest';
import {
  MOVEMENT,
  MOVEMENT_VALIDATION,
  NO_COLLIDER,
  createPose,
  maxStep,
  speedCap,
  stepMovement,
  wrapAngle,
} from '../src/index';
import type { Collider, MoveInput, MovePose } from '../src/index';

/** sfc32-free tiny LCG so the test needs no core import and is reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randomInputs(n: number, seed: number): MoveInput[] {
  const r = lcg(seed);
  const out: MoveInput[] = [];
  for (let i = 0; i < n; i++) {
    let ax = r() * 2 - 1;
    let az = r() * 2 - 1;
    if (r() < 0.15) {
      ax = 0;
      az = 0;
    }
    const m = Math.hypot(ax, az);
    if (m > 1) {
      ax /= m;
      az /= m;
    }
    out.push({ ax, az, running: r() < 0.4 });
  }
  return out;
}

describe('MOVEMENT constants', () => {
  it('match the reconciled table: walk 4.2 · run 7.0 · radius 0.35 · 60 Hz step · 20 Hz send · 100 ms max dt', () => {
    expect(MOVEMENT.walkSpeed).toBe(4.2);
    expect(MOVEMENT.runSpeed).toBe(7.0);
    expect(MOVEMENT.radius).toBe(0.35);
    expect(MOVEMENT.accel).toBe(40);
    expect(MOVEMENT.turnRate).toBe(12);
    expect(MOVEMENT.stepMs).toBeCloseTo(16.6667, 3);
    expect(MOVEMENT.sendHz).toBe(20);
    expect(MOVEMENT.maxDtMs).toBe(100);
    // Phase D11 added bikeSpeed (9 keys)
    expect(Object.isFrozen(MOVEMENT) || Object.keys(MOVEMENT).length === 9).toBe(true);
  });

  it('§30.2.4 validation companions: +15 %, budget -100..250, 0.02 m slack', () => {
    expect(MOVEMENT_VALIDATION.speedTolerance).toBe(1.15);
    expect(MOVEMENT_VALIDATION.budgetMinMs).toBe(-100);
    expect(MOVEMENT_VALIDATION.budgetMaxMs).toBe(250);
    expect(MOVEMENT_VALIDATION.quantisationSlack).toBe(0.02);
    expect(speedCap(false)).toBeCloseTo(4.83, 10); // MAX_WALK_STEP
    expect(speedCap(true)).toBeCloseTo(8.05, 10); // MAX_RUN_STEP
    expect(maxStep(true, 50)).toBeCloseTo(8.05 * 0.05 + 0.02, 10);
  });
});

describe('wrapAngle', () => {
  it('wraps into [-π, π)', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI)).toBe(-Math.PI);
    expect(wrapAngle(-Math.PI)).toBe(-Math.PI);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(-Math.PI, 12);
    expect(wrapAngle(Math.PI / 2 + 4 * Math.PI)).toBeCloseTo(Math.PI / 2, 12);
    expect(wrapAngle(-Math.PI / 2 - 6 * Math.PI)).toBeCloseTo(-Math.PI / 2, 12);
    for (let a = -50; a <= 50; a += 0.37) {
      const w = wrapAngle(a);
      expect(w).toBeGreaterThanOrEqual(-Math.PI);
      expect(w).toBeLessThan(Math.PI);
    }
  });
});

describe('stepMovement', () => {
  it('is deterministic: two runs over 10 000 random steps produce bit-identical poses', () => {
    const inputs = randomInputs(10_000, 1234);
    const run = (): MovePose => {
      const pose = createPose(1, 2, 0.5);
      for (const inp of inputs) stepMovement(pose, inp, MOVEMENT.stepMs, NO_COLLIDER);
      return pose;
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    expect(Object.is(a.x, b.x) && Object.is(a.z, b.z) && Object.is(a.angle, b.angle)).toBe(true);
    expect(Number.isFinite(a.x) && Number.isFinite(a.z)).toBe(true);
    expect(a.angle).toBeGreaterThanOrEqual(-Math.PI);
    expect(a.angle).toBeLessThan(Math.PI);
  });

  it('never exceeds the run speed per step, nor the walk speed while walking', () => {
    const inputs = randomInputs(10_000, 99);
    const pose = createPose();
    for (const inp of inputs) {
      const px = pose.x;
      const pz = pose.z;
      stepMovement(pose, inp, MOVEMENT.stepMs, NO_COLLIDER);
      const dist = Math.hypot(pose.x - px, pose.z - pz);
      const dt = MOVEMENT.stepMs / 1000;
      expect(dist).toBeLessThanOrEqual(MOVEMENT.runSpeed * dt + 1e-9);
      expect(Math.hypot(pose.vx, pose.vz)).toBeLessThanOrEqual(MOVEMENT.runSpeed + 1e-9);
    }
    // walking only: velocity magnitude never exceeds walkSpeed
    const walker = createPose();
    for (const inp of inputs) {
      stepMovement(walker, { ...inp, running: false }, MOVEMENT.stepMs, NO_COLLIDER);
      expect(Math.hypot(walker.vx, walker.vz)).toBeLessThanOrEqual(MOVEMENT.walkSpeed + 1e-9);
    }
  });

  it('a 50 ms server window of steps stays under the server’s accepted cap (speedCap × dt + slack)', () => {
    const pose = createPose();
    const sprint: MoveInput = { ax: 1, az: 0, running: true };
    // warm up to full speed
    for (let i = 0; i < 60; i++) stepMovement(pose, sprint, MOVEMENT.stepMs, NO_COLLIDER);
    const x0 = pose.x;
    for (let i = 0; i < 3; i++) stepMovement(pose, sprint, MOVEMENT.stepMs, NO_COLLIDER); // 3 steps = 50 ms
    expect(pose.x - x0).toBeCloseTo(MOVEMENT.runSpeed * 0.05, 9);
    expect(pose.x - x0).toBeLessThan(maxStep(true, 50));
  });

  it('Phase D11: the bicycle rides at bikeSpeed (running ignored) and stays under the bike cap per 50 ms window', () => {
    expect(MOVEMENT.bikeSpeed).toBe(10.5);
    expect(speedCap(false, true)).toBeCloseTo(10.5 * 1.15, 10);
    expect(speedCap(true, true)).toBeCloseTo(speedCap(false, true), 10);
    const pose = createPose();
    const ride: MoveInput = { ax: 1, az: 0, running: false, bike: true };
    for (let i = 0; i < 90; i++) stepMovement(pose, ride, MOVEMENT.stepMs, NO_COLLIDER);
    expect(Math.hypot(pose.vx, pose.vz)).toBeCloseTo(MOVEMENT.bikeSpeed, 9);
    const x0 = pose.x;
    for (let i = 0; i < 3; i++) stepMovement(pose, ride, MOVEMENT.stepMs, NO_COLLIDER);
    expect(pose.x - x0).toBeLessThan(maxStep(false, 50, true));
    expect(pose.x - x0).toBeGreaterThan(maxStep(true, 50)); // a bike window is a speed rejection under the run cap
  });

  it('accelerates at `accel`, reaches full speed, and stops exactly when the stick is released', () => {
    const pose = createPose();
    const fwd: MoveInput = { ax: 0, az: 1, running: false };
    const dt = MOVEMENT.stepMs / 1000;
    stepMovement(pose, fwd, MOVEMENT.stepMs, NO_COLLIDER);
    expect(pose.vz).toBeCloseTo(MOVEMENT.accel * dt, 12); // first step: accel-limited
    for (let i = 0; i < 30; i++) stepMovement(pose, fwd, MOVEMENT.stepMs, NO_COLLIDER);
    expect(pose.vz).toBe(MOVEMENT.walkSpeed); // snapped exactly onto target
    expect(pose.vx).toBe(0);
    const idle: MoveInput = { ax: 0, az: 0, running: false };
    for (let i = 0; i < 30; i++) stepMovement(pose, idle, MOVEMENT.stepMs, NO_COLLIDER);
    expect(pose.vx).toBe(0);
    expect(pose.vz).toBe(0); // no exponential tail
    const zBefore = pose.z;
    stepMovement(pose, idle, MOVEMENT.stepMs, NO_COLLIDER);
    expect(pose.z).toBe(zBefore);
  });

  it('turns toward the input heading at turnRate along the shortest arc; keeps heading with no input', () => {
    const pose = createPose(0, 0, 0);
    const dt = MOVEMENT.stepMs / 1000;
    stepMovement(pose, { ax: 1, az: 0, running: false }, MOVEMENT.stepMs, NO_COLLIDER); // target +π/2
    expect(pose.angle).toBeCloseTo(MOVEMENT.turnRate * dt, 12);
    for (let i = 0; i < 30; i++) stepMovement(pose, { ax: 1, az: 0, running: false }, MOVEMENT.stepMs, NO_COLLIDER);
    expect(pose.angle).toBeCloseTo(Math.PI / 2, 12);
    const held = pose.angle;
    stepMovement(pose, { ax: 0, az: 0, running: false }, MOVEMENT.stepMs, NO_COLLIDER);
    expect(pose.angle).toBe(held);
    // shortest arc: from +170° toward -170° goes through ±180°, not through 0
    const p2 = createPose(0, 0, (170 * Math.PI) / 180);
    const target = (-170 * Math.PI) / 180;
    stepMovement(p2, { ax: Math.sin(target), az: Math.cos(target), running: false }, MOVEMENT.stepMs, NO_COLLIDER);
    expect(Math.abs(p2.angle)).toBeGreaterThan((170 * Math.PI) / 180);
  });

  it('dt ≤ 0 / non-finite is a no-op; dt above maxDtMs is clamped', () => {
    const pose = createPose(1, 1, 1);
    const snapshot = { ...pose };
    stepMovement(pose, { ax: 1, az: 0, running: true }, 0, NO_COLLIDER);
    stepMovement(pose, { ax: 1, az: 0, running: true }, -5, NO_COLLIDER);
    stepMovement(pose, { ax: 1, az: 0, running: true }, Number.NaN, NO_COLLIDER);
    expect(pose).toEqual(snapshot);
    const a = createPose();
    const b = createPose();
    stepMovement(a, { ax: 0, az: 1, running: true }, 100, NO_COLLIDER);
    stepMovement(b, { ax: 0, az: 1, running: true }, 5000, NO_COLLIDER);
    expect(a).toEqual(b);
  });

  it('non-finite or over-unit input is normalised, never poisons the pose', () => {
    const pose = createPose();
    stepMovement(pose, { ax: Number.NaN, az: 1, running: false }, MOVEMENT.stepMs, NO_COLLIDER);
    expect(Number.isFinite(pose.x) && Number.isFinite(pose.z) && Number.isFinite(pose.angle)).toBe(true);
    const p2 = createPose();
    for (let i = 0; i < 60; i++) stepMovement(p2, { ax: 3, az: 4, running: false }, MOVEMENT.stepMs, NO_COLLIDER);
    expect(Math.hypot(p2.vx, p2.vz)).toBeCloseTo(MOVEMENT.walkSpeed, 9);
  });

  it('calls the collider last with MOVEMENT.radius and honours its in-place correction', () => {
    const calls: number[] = [];
    const wall: Collider = {
      resolve(p, radius) {
        calls.push(radius);
        if (p.x > 2) p.x = 2; // a wall at x = 2
      },
    };
    const pose = createPose();
    for (let i = 0; i < 120; i++) stepMovement(pose, { ax: 1, az: 0, running: true }, MOVEMENT.stepMs, wall);
    expect(calls).toHaveLength(120);
    expect(calls.every((r) => r === MOVEMENT.radius)).toBe(true);
    expect(pose.x).toBe(2);
  });

  it('mutates the given pose in place and returns nothing (allocation-free contract)', () => {
    const pose = createPose();
    const same = pose;
    const ret = stepMovement(pose, { ax: 1, az: 0, running: false }, MOVEMENT.stepMs, NO_COLLIDER);
    expect(ret).toBeUndefined();
    expect(pose).toBe(same);
    expect(pose.x).toBeGreaterThan(0);
  });
});
