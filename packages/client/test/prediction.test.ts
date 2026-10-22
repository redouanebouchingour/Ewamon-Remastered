/**
 * §50.4.7 prediction.test — input → predicted position; an ack whose seq/position agree with what was sent
 * reconciles with zero correction, a disagreeing one rebases and re-simulates the unsent steps; the §20.4.5 harness
 * (2 000 random inputs, client stepMovement vs a mirrored server loop with the server's validation rules, 80–200 ms
 * latency, 2 % input loss) ends with positions within 0.01 u and no reconcile above 4.0 u; remote interpolation never
 * extrapolates past 100 ms and a 100 ms jitter on the snapshot stream produces no positional reversal.
 */
import { describe, expect, it } from 'vitest';
import { MOVEMENT, MOVEMENT_VALIDATION, NO_COLLIDER, createPose, stepMovement } from '@ewa/protocol';
import { createRng } from '@ewa/core';
import { HELD } from '../src/scene/input';
import { LocalPlayerController, SNAP_DISTANCE } from '../src/scene/LocalPlayerController';
import type { InputPayload } from '../src/scene/LocalPlayerController';
import { EXTRAPOLATE_MS, INTERP_DELAY_MS, RemoteInterpolator, TICK_MS } from '../src/scene/RemoteInterpolator';
import type { StepCollider } from '../src/scene/collider';

const STEP = MOVEMENT.stepMs;
const open: StepCollider = { terrain: null, begin() {}, resolve() {}, height: () => 0 };

function controller(yaw = 0) {
  const held = new Uint8Array(5);
  const sent: InputPayload[] = [];
  const c = new LocalPlayerController({ held, cameraYaw: () => yaw, blocked: () => false, send: (p) => sent.push({ ...p }) });
  c.setCollider(open);
  c.reconcile(0, 0, 0, 0); // the join places the avatar
  return { c, held, sent };
}

describe('prediction', () => {
  it('forward input moves the predicted pose along the camera forward at walk speed', () => {
    const { c, held } = controller(0);
    held[HELD.forward] = 1;
    for (let i = 0; i < 120; i++) {
      c.sample();
      c.step(STEP);
    }
    // yaw 0: forward = (−sin 0, −cos 0) = (0, −1); 2 s at 4.2 m/s minus the 0.105 s acceleration ramp
    expect(c.pose.x).toBeCloseTo(0, 6);
    expect(c.pose.z).toBeLessThan(-8);
    expect(c.pose.z).toBeGreaterThan(-8.4);
    held[HELD.forward] = 0;
    held[HELD.run] = 1;
    held[HELD.right] = 1;
    const z0 = c.pose.z;
    for (let i = 0; i < 60; i++) {
      c.sample();
      c.step(STEP);
    }
    expect(c.pose.x).toBeGreaterThan(6); // right = (cos 0, −sin 0) = (1, 0), running
    expect(Math.abs(c.pose.z - z0)).toBeLessThan(0.5); // only the 0.1 s acceleration turn drifts along z
  });

  it('sends one input per 50 ms with seq +1 per message, dt the sum of steps, the predicted pose', () => {
    const { c, held, sent } = controller(0);
    held[HELD.forward] = 1;
    for (let i = 0; i < 30; i++) {
      c.sample();
      c.step(STEP);
    }
    expect(sent.length).toBe(10);
    expect(sent.map((s) => s.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const s of sent) expect(s.dtMs).toBe(50);
    expect(sent[9]!.z).toBeCloseTo(c.pose.z, 9);
  });

  it('an ack that agrees with the pose sent under its seq reconciles with zero correction', () => {
    const { c, held, sent } = controller(0);
    held[HELD.forward] = 1;
    for (let i = 0; i < 12; i++) {
      c.sample();
      c.step(STEP);
    }
    const before = { x: c.pose.x, z: c.pose.z, rx: c.renderX, rz: c.renderZ };
    const ack = sent[1]!;
    c.reconcile(Math.fround(ack.x), Math.fround(ack.z), ack.angle, ack.seq); // the wire is float32
    expect(c.pose.x).toBe(before.x);
    expect(c.pose.z).toBe(before.z);
    expect(c.renderX).toBe(before.rx);
    expect(c.corrections).toBe(0);
    expect(c.rubberBands).toBe(0);
    expect(c.pendingCount).toBe(12 - 6);
  });

  it('a disagreeing ack rebases on the server pose and re-simulates the unsent steps; the render offset blends', () => {
    const { c, held, sent } = controller(0);
    held[HELD.forward] = 1;
    for (let i = 0; i < 13; i++) {
      c.sample();
      c.step(STEP);
    }
    // 4 messages sent (12 steps), 1 step not yet sent
    expect(sent.length).toBe(4);
    const ack = sent[1]!;
    // the server rejected seq 2: it stays where seq 1 put the avatar
    const sx = sent[0]!.x;
    const sz = sent[0]!.z;
    c.reconcile(sx, sz, ack.angle, ack.seq);
    // the one unsent step replayed from the server pose with the velocity at the last send
    const expect1 = createPose(sx, sz, ack.angle);
    expect1.vx = 0;
    expect1.vz = -MOVEMENT.walkSpeed;
    stepMovement(expect1, { ax: 0, az: -1, running: false }, STEP, NO_COLLIDER);
    expect(c.pose.x).toBeCloseTo(expect1.x, 6); // the ring stores inputs as float32
    expect(c.pose.z).toBeCloseTo(expect1.z, 6);
    expect(c.corrections).toBe(1);
    expect(c.renderZ).not.toBeCloseTo(c.pose.z, 3); // blending from the old render pose
    for (let i = 0; i < 7; i++) c.step(0.0001 + 100 / 7);
    // stale acks (seq 3, 4) report the rebase pose: no second correction
    c.reconcile(sx, sz, ack.angle, 3);
    c.reconcile(sx, sz, ack.angle, 4);
    expect(c.corrections).toBe(1);
  });

  it('a correction above 4 u snaps (a rubber-band); a teleport without a seq change is corrected too', () => {
    const { c, held, sent } = controller(0);
    held[HELD.forward] = 1;
    for (let i = 0; i < 6; i++) {
      c.sample();
      c.step(STEP);
    }
    c.reconcile(sent[1]!.x, sent[1]!.z, 0, sent[1]!.seq);
    c.reconcile(30, 40, 0, sent[1]!.seq); // warp: same seq, new position
    expect(c.rubberBands).toBe(1);
    expect(c.pose.x).toBe(30);
    expect(c.renderX).toBe(30);
  });

  it('harness: 2 000 random inputs, 80–200 ms latency, 2 % loss → within 0.01 u, no reconcile > 4.0 u', () => {
    const rng = createRng(0x5eed);
    const { c, held } = controller(0);
    type Up = { at: number; p: InputPayload };
    type Down = { at: number; x: number; z: number; angle: number; seq: number };
    const up: Up[] = [];
    const down: Down[] = [];
    let now = 0;
    const lat = (): number => 40 + rng.next() * 60; // one way: 80–200 ms round trip
    let lastDownAt = 0;
    // client send hook
    (c as unknown as { deps: { send: (p: InputPayload) => void } }).deps.send = (p) => {
      if (rng.next() < 0.02) return; // lost
      up.push({ at: now + lat(), p: { ...p } });
    };
    // the server mirror (30-server-netcode.md §30.2.4 rules, open field)
    const srv = { x: 0, z: 0, angle: 0, seq: 0, budget: 0 };
    let maxCorrection = 0;
    let inputs = 0;
    let nextChange = 0;
    let serverTick = 0;
    const deliverUp = (): void => {
      up.sort((a, b) => a.at - b.at);
      while (up.length > 0 && up[0]!.at <= now) {
        const { p } = up.shift()!;
        if (p.seq <= srv.seq) continue;
        const budget = srv.budget - p.dtMs;
        if (budget < MOVEMENT_VALIDATION.budgetMinMs) continue;
        srv.budget = budget;
        const cap = ((p.running ? MOVEMENT.runSpeed : MOVEMENT.walkSpeed) * MOVEMENT_VALIDATION.speedTolerance * p.dtMs) / 1000 + MOVEMENT_VALIDATION.quantisationSlack;
        if (Math.hypot(p.x - srv.x, p.z - srv.z) <= cap) {
          srv.x = Math.fround(p.x);
          srv.z = Math.fround(p.z);
          srv.angle = p.angle;
        }
        srv.seq = p.seq; // accepted or rejected, the seq is echoed
      }
    };
    let settleUntil = Number.POSITIVE_INFINITY;
    while (now < settleUntil) {
      if (inputs >= 2000 && settleUntil === Number.POSITIVE_INFINITY) settleUntil = now + 5000;
      if (now >= nextChange && inputs < 2000) {
        held.fill(0);
        const r = rng.int(10);
        if (r > 1) held[rng.int(4)] = 1;
        if (r > 6) held[rng.int(4)] = 1;
        held[HELD.run] = rng.next() < 0.5 ? 1 : 0;
        inputs++;
        nextChange = now + 100 + rng.int(200);
      }
      if (inputs >= 2000 && now >= nextChange) held.fill(0);
      c.sample();
      c.step(STEP);
      now += STEP;
      if (now >= serverTick) {
        serverTick += TICK_MS;
        srv.budget = Math.min(MOVEMENT_VALIDATION.budgetMaxMs, srv.budget + TICK_MS);
        deliverUp();
        const at = Math.max(lastDownAt, now + lat()); // TCP: in order
        lastDownAt = at;
        down.push({ at, x: srv.x, z: srv.z, angle: srv.angle, seq: srv.seq });
      }
      while (down.length > 0 && down[0]!.at <= now) {
        const d = down.shift()!;
        const before = c.corrections + c.rubberBands;
        c.reconcile(d.x, d.z, d.angle, d.seq);
        if (c.corrections + c.rubberBands !== before) maxCorrection = Math.max(maxCorrection, c.lastError);
      }
    }
    expect(inputs).toBe(2000);
    expect(c.corrections).toBeGreaterThan(0); // the 2 % loss produced server rejections the client recovered from
    expect(Math.hypot(c.pose.x - srv.x, c.pose.z - srv.z)).toBeLessThan(0.01);
    expect(maxCorrection).toBeLessThanOrEqual(SNAP_DISTANCE);
    expect(c.rubberBands).toBe(0);
  });
});

describe('remote interpolation', () => {
  function remote() {
    let t = 0;
    const moves: { x: number; z: number; moving: boolean }[] = [];
    const r = new RemoteInterpolator(
      { spawn() {}, despawn() {}, setTransform: (_id, x, z, _a, moving) => moves.push({ x, z, moving }) },
      () => t,
      48,
    );
    r.add('p', { name: 'P', look: 'casual_male', guildTag: '', inBattle: false });
    return { r, moves, setNow: (v: number) => (t = v), now: () => t };
  }

  it('interpolates linearly 100 ms in the past, extrapolates ≤ 100 ms, then holds still', () => {
    const { r, moves, setNow } = remote();
    // samples every tick moving +1 u per tick along x, arriving with 30 ms latency
    for (let tick = 1; tick <= 10; tick++) {
      setNow(tick * TICK_MS + 30);
      r.observeTick(tick);
      r.push('p', tick, tick, 0, 0, true, false);
    }
    r.reselect(0, 0);
    moves.length = 0;
    // renderT = now − offset − 100 = (530 − 30) − 100 = 400 → x = 8
    setNow(530);
    r.step(16, 0, 0);
    expect(moves.at(-1)!.x).toBeCloseTo(8, 6);
    // the stream stops: extrapolation at most 100 ms past the newest sample (x 10 at t 500) → ≤ 12, then still
    for (let now = 540; now <= 1200; now += 16) {
      setNow(now);
      r.step(16, 0, 0);
    }
    const last = moves.at(-1)!;
    expect(last.x).toBeLessThanOrEqual(10 + (EXTRAPOLATE_MS / TICK_MS) * 1 + 1e-9);
    expect(last.moving).toBe(false);
    expect(INTERP_DELAY_MS).toBe(100);
  });

  it('a 100 ms jitter on the snapshot stream produces no positional reversal', () => {
    const { r, moves, setNow } = remote();
    const rng = createRng(7);
    const arrivals: { at: number; tick: number }[] = [];
    for (let tick = 1; tick <= 200; tick++) arrivals.push({ at: tick * TICK_MS + 40 + rng.next() * 100, tick });
    arrivals.sort((a, b) => a.at - b.at);
    let i = 0;
    let spawned = false;
    for (let now = 0; now <= 201 * TICK_MS + 400; now += 16) {
      setNow(now);
      while (i < arrivals.length && arrivals[i]!.at <= now) {
        const a = arrivals[i++]!;
        r.observeTick(a.tick);
        r.push('p', a.tick, a.tick * 0.35, 0, 0, true, true);
      }
      if (!spawned && i > 0) {
        r.reselect(0, 0);
        spawned = true;
      }
      r.step(16, 0, 0);
    }
    let reversals = 0;
    for (let k = 1; k < moves.length; k++) if (moves[k]!.x < moves[k - 1]!.x - 1e-9) reversals++;
    expect(moves.length).toBeGreaterThan(500);
    expect(reversals).toBe(0);
  });
});

describe('shove (NPC voice talk kick)', () => {
  it('runs the player along the shove for its duration even while the keys are blocked, then stops', () => {
    const sent: InputPayload[] = [];
    const c = new LocalPlayerController({ held: new Uint8Array(16), cameraYaw: () => 0, blocked: () => true, send: (p) => sent.push({ ...p }) });
    c.reconcile(0, 0, 0, 0);
    c.shove(0, 2, 250);
    for (let i = 0; i < 20; i++) {
      c.sample();
      c.step(50);
    }
    expect(c.shoving).toBe(false);
    expect(c.pose.z).toBeGreaterThan(1);
    expect(Math.abs(c.pose.x)).toBeLessThan(1e-6);
    expect(sent.length).toBeGreaterThan(0);
    const z = c.pose.z;
    c.sample();
    c.step(50);
    expect(c.pose.z - z).toBeLessThan(0.05);
  });
});
