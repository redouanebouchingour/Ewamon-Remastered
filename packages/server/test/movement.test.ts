/**
 * §30.2.4 / §50.4.5 movement.test.ts — pure `validateInput` against the real content heightfield of
 * `mire_route` and protocol's MOVEMENT table (no Colyseus).
 */
import { describe, expect, it } from 'vitest';
import { getHeightfield, isWalkable, isWater, playableBounds } from '@ewa/content';
import type { Heightfield } from '@ewa/content';
import { MOVEMENT } from '@ewa/protocol';
import { BUDGET_MAX_MS, BUDGET_MIN_MS, MAX_RUN_STEP, MAX_WALK_STEP, RUN_SPEED, WALK_SPEED, refillBudget, validateInput } from '../src/rooms/movement';
import type { MovePrev } from '../src/rooms/movement';

const h = getHeightfield('mire_route');
const b = playableBounds(h);

function sample(h: Heightfield, pred: (x: number, z: number) => boolean): [number, number] {
  for (let z = b.minZ + 2; z < b.maxZ - 2; z += 0.5) {
    for (let x = b.minX + 2; x < b.maxX - 2; x += 0.5) if (pred(x, z)) return [x, z];
  }
  throw new Error('no sample');
}

/** A walkable point whose +x neighbour 0.5 m away is walkable too. */
const [wx, wz] = sample(h, (x, z) => isWalkable(h, x, z) && isWalkable(h, x + 0.5, z) && isWalkable(h, x + 1, z) && isWalkable(h, x - 1, z));
/** A walkable point next (0.5 m in +x) to an unwalkable one. */
const [ex, ez] = sample(h, (x, z) => isWalkable(h, x, z) && !isWalkable(h, x + 0.5, z) && Math.abs(x) < 90);
/** A walkable point with an unwalkable strip and walkable ground again within 0.6 m along +x (a "wall"). */
const wall = (() => {
  for (let z = b.minZ + 2; z < b.maxZ - 2; z += 0.5) {
    for (let x = b.minX + 2; x < b.maxX - 2; x += 0.5) {
      if (isWalkable(h, x, z) && !isWalkable(h, x + 0.25, z) && isWalkable(h, x + 0.5, z)) return [x, z] as const;
      if (isWalkable(h, x, z) && !isWalkable(h, x + 0.5, z) && isWalkable(h, x + 1.0, z)) return [x, z, 1.0] as const;
    }
  }
  return null;
})();
/** A water-only sample (water, not walkable) adjacent to walkable ground. */
const water = (() => {
  for (let z = b.minZ + 2; z < b.maxZ - 2; z += 0.5) {
    for (let x = b.minX + 2; x < b.maxX - 2; x += 0.5) if (isWalkable(h, x, z) && isWater(h, x + 0.5, z) && !isWalkable(h, x + 0.5, z)) return [x, z] as const;
  }
  return null;
})();

function prev(over: Partial<MovePrev> = {}): MovePrev {
  return { x: wx, z: wz, lastSeq: 0, budgetMs: 200, inBattle: false, ...over };
}

describe('constants come from protocol MOVEMENT (one table for prediction and validation)', () => {
  it('walk 4.2 / run 7.0 with +15 %', () => {
    expect(WALK_SPEED).toBe(MOVEMENT.walkSpeed);
    expect(RUN_SPEED).toBe(MOVEMENT.runSpeed);
    expect(MAX_WALK_STEP).toBeCloseTo(4.83, 5);
    expect(MAX_RUN_STEP).toBeCloseTo(8.05, 5);
    expect(BUDGET_MIN_MS).toBe(-100);
    expect(BUDGET_MAX_MS).toBe(250);
  });
});

describe('validateInput', () => {
  it('accepts a legal walking step and wraps the angle into [-π, π)', () => {
    const v = validateInput(prev(), { seq: 1, x: wx + 0.2, z: wz, angle: 3 * Math.PI, running: false, dtMs: 50 }, h);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.x).toBe(wx + 0.2);
    expect(v.angle).toBeGreaterThanOrEqual(-Math.PI);
    expect(v.angle).toBeLessThan(Math.PI);
    expect(v.budgetMs).toBe(150);
  });

  it('staleSeq: seq ≤ lastSeq is dropped (replay / reorder)', () => {
    expect(validateInput(prev({ lastSeq: 5 }), { seq: 5, x: wx, z: wz, angle: 0, running: false, dtMs: 50 }, h)).toMatchObject({ ok: false, reason: 'staleSeq' });
    expect(validateInput(prev({ lastSeq: 5 }), { seq: 3, x: wx, z: wz, angle: 0, running: false, dtMs: 50 }, h)).toMatchObject({ ok: false, reason: 'staleSeq' });
  });

  it('inBattle: position frozen', () => {
    expect(validateInput(prev({ inBattle: true }), { seq: 1, x: wx + 0.1, z: wz, angle: 0, running: false, dtMs: 50 }, h)).toMatchObject({ ok: false, reason: 'inBattle' });
  });

  it('speed: displacement beyond (RUN_SPEED × 1.15 × dt + 0.02) is rejected; exactly at the cap is accepted', () => {
    const cap = (MAX_RUN_STEP * 50) / 1000;
    const over = validateInput(prev(), { seq: 1, x: wx + cap + 0.03, z: wz, angle: 0, running: true, dtMs: 50 }, h);
    expect(over).toMatchObject({ ok: false, reason: 'speed' });
    // walking cap is lower than running cap
    const walkOver = validateInput(prev(), { seq: 1, x: wx + (MAX_WALK_STEP * 50) / 1000 + 0.03, z: wz, angle: 0, running: false, dtMs: 50 }, h);
    expect(walkOver).toMatchObject({ ok: false, reason: 'speed' });
    const atCap = validateInput(prev(), { seq: 1, x: wx + 0.39, z: wz, angle: 0, running: true, dtMs: 50 }, h);
    expect(atCap.ok).toBe(true);
  });

  it('teleport: 64 units in one 50 ms input → speed', () => {
    expect(validateInput(prev(), { seq: 1, x: wx + 64, z: wz, angle: 0, running: true, dtMs: 50 }, h)).toMatchObject({ ok: false, reason: 'speed' });
  });

  it('dt inflation: dtMs 100 every 33 ms is rejected within a few inputs; accepted dt never exceeds elapsed + banked + 100 ms', () => {
    let budget = BUDGET_MAX_MS; // an idle player banks at most 250 ms
    let lastSeq = 0;
    let accepted = 0;
    let firstReject = -1;
    let elapsed = 0;
    let nextTick = 50;
    let x = wx;
    for (let i = 0; i < 30; i++) {
      const t = i * 33;
      while (t >= nextTick) {
        budget = refillBudget(budget, 50);
        nextTick += 50;
      }
      elapsed = t;
      const v = validateInput({ x, z: wz, lastSeq, budgetMs: budget, inBattle: false }, { seq: i + 1, x, z: wz, angle: 0, running: false, dtMs: 100 }, h);
      budget = v.budgetMs;
      lastSeq = i + 1;
      if (v.ok) {
        accepted += 100;
        x = v.x;
      } else {
        expect(v.reason).toBe('dtBudget');
        if (firstReject === -1) firstReject = i + 1;
      }
    }
    expect(firstReject).toBeGreaterThan(0);
    expect(firstReject).toBeLessThanOrEqual(6);
    expect(accepted).toBeLessThanOrEqual(elapsed + BUDGET_MAX_MS + 100 + 100);
  });

  it('unwalkable: a target sample with walkable = 0 is rejected', () => {
    const v = validateInput(prev({ x: ex, z: ez }), { seq: 1, x: ex + 0.5, z: ez, angle: 0, running: true, dtMs: 100 }, h);
    expect(v).toMatchObject({ ok: false, reason: 'unwalkable' });
  });

  it('unwalkable: a segment crossing an unwalkable sample (0.25 m sampling) is rejected even if both ends are walkable', () => {
    if (wall === null) return; // field has no thin wall at this resolution — covered by the endpoint test
    const [x0, z0, span = 0.5] = wall as readonly [number, number, number?];
    const v = validateInput(prev({ x: x0, z: z0 }), { seq: 1, x: x0 + span, z: z0, angle: 0, running: true, dtMs: 100 }, h);
    expect(v).toMatchObject({ ok: false, reason: 'unwalkable' });
  });

  it('water: a water-only sample is standable only with HM Surf', () => {
    expect(water).not.toBeNull();
    const [x0, z0] = water!;
    const no = validateInput(prev({ x: x0, z: z0 }), { seq: 1, x: x0 + 0.5, z: z0, angle: 0, running: true, dtMs: 100 }, h);
    expect(no).toMatchObject({ ok: false, reason: 'unwalkable' });
    const yes = validateInput(prev({ x: x0, z: z0, canSurf: true }), { seq: 1, x: x0 + 0.5, z: z0, angle: 0, running: true, dtMs: 100 }, h);
    expect(yes.ok).toBe(true);
  });

  it('bounds: a position outside playableBounds is rejected with `bounds`', () => {
    const v = validateInput(prev({ x: b.maxX - 0.1, z: 0 }), { seq: 1, x: b.maxX + 0.2, z: 0, angle: 0, running: true, dtMs: 100 }, h);
    expect(v).toMatchObject({ ok: false, reason: 'bounds' });
  });

  it('non-staleSeq rejections spend the claimed dt (the ack still echoes the seq in the room)', () => {
    const v = validateInput(prev({ budgetMs: 100 }), { seq: 1, x: wx + 30, z: wz, angle: 0, running: true, dtMs: 50 }, h);
    expect(v).toMatchObject({ ok: false, reason: 'speed', budgetMs: 50 });
  });

  it('refillBudget clamps at 250 ms', () => {
    expect(refillBudget(240, 50)).toBe(250);
    expect(refillBudget(-100, 50)).toBe(-50);
  });
});
