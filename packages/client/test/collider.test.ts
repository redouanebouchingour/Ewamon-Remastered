/**
 * The client's protocol Collider over render's resolveMoveInto (§20.4.5 / P6): walking into blockers never moves the
 * pose farther per step than the step asked for (render's corner probes land 0.35 m around the target), so every
 * input message stays inside the server's speed cap; the pose never ends on a blocked or unwalkable sample.
 */
import { describe, expect, it } from 'vitest';
import { getHeightfield } from '@ewa/content';
import { MOVEMENT, createPose, maxStep, stepMovement } from '@ewa/protocol';
import { TerrainCollider, resolveMoveInto } from '@ewa/render';
import { createRng } from '@ewa/core';
import { ESCAPE_STEP_M, createStepCollider } from '../src/scene/collider';

describe('step collider', () => {
  it('control: raw resolveMove corner probes can exceed the requested step (the render behaviour clamped here)', () => {
    const terrain = new TerrainCollider(getHeightfield('mire_route'));
    terrain.addBlocker({ kind: 'circle', x: -20, z: 0, r: 1 });
    const out = { x: 0, z: 0, y: 0, blocked: false, slid: false };
    let worst = 0;
    // head-on along −x (dz = 0: no z slide to try): the target is blocked, the x slide is the same move → corner probes
    for (let d = 1; d < 2.5; d += 0.01) {
      const fx = -20 + d;
      if (!terrain.passable(fx, 0)) continue;
      resolveMoveInto(out, terrain, fx, 0, -0.117, 0);
      worst = Math.max(worst, Math.hypot(out.x - fx, out.z));
    }
    expect(worst).toBeGreaterThan(0.117 + 0.01);
  });

  it('10 000 random steps through a field of trunks: ≤ the requested step each, never inside a blocker', () => {
    const terrain = new TerrainCollider(getHeightfield('mire_route'));
    const rng = createRng(11);
    for (let i = 0; i < 120; i++) terrain.addBlocker({ kind: 'circle', x: -40 + rng.next() * 30, z: -15 + rng.next() * 30, r: 0.4 + rng.next() * 0.8 });
    const c = createStepCollider(terrain);
    const pose = createPose(-25, 0);
    let worst = 0;
    let windowDist = 0;
    let windowWorst = 0;
    for (let i = 0; i < 10000; i++) {
      if (i % 90 === 0) pose.angle = rng.next() * Math.PI * 2;
      const input = { ax: Math.sin(pose.angle), az: Math.cos(pose.angle), running: true };
      const x0 = pose.x;
      const z0 = pose.z;
      c.begin(x0, z0);
      stepMovement(pose, input, MOVEMENT.stepMs, c);
      const d = Math.hypot(pose.x - x0, pose.z - z0);
      worst = Math.max(worst, d);
      windowDist += d;
      if (i % 3 === 2) {
        windowWorst = Math.max(windowWorst, windowDist);
        windowDist = 0;
      }
      if (terrain.passable(x0, z0)) expect(terrain.passable(pose.x, pose.z)).toBe(true);
    }
    const runStep = (MOVEMENT.runSpeed * MOVEMENT.stepMs) / 1000;
    expect(worst).toBeLessThanOrEqual(Math.max(runStep, ESCAPE_STEP_M) + 1e-6);
    // three steps (one 50 ms message) stay inside the server's run cap
    expect(windowWorst).toBeLessThanOrEqual(maxStep(true, 50));
  });
});
