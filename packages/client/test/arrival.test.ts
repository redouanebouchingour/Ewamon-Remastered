/**
 * The zone load's arrival point (scene/arrival.ts): a zone room joined with the renderer already up (back from the
 * arena) has no state patch yet; the load waits for the one carrying the local player instead of predicting the first
 * view at the zone's spawn (which left the real view gated and the frame white — the arena "back to world" bug).
 */
import { describe, expect, it } from 'vitest';
import { ARRIVAL_TIMEOUT_MS, arrivalOf, awaitArrival } from '../src/scene/arrival';
import type { ArrivalRoom } from '../src/scene/arrival';

function fakeRoom(): { room: ArrivalRoom; players: Map<string, { x: number; z: number }> } {
  const players = new Map<string, { x: number; z: number }>();
  return { room: { state: { players } }, players };
}

function fakeClock(): { now: () => number; sleep: (ms: number) => Promise<void>; onSleep: ((t: number) => void)[] } {
  let t = 0;
  const onSleep: ((t: number) => void)[] = [];
  return { now: () => t, sleep: async (ms) => { t += ms; for (const f of onSleep) f(t); }, onSleep };
}

describe('arrival point of a just-joined zone room', () => {
  it('reads the local player when the state already holds it', () => {
    const { room, players } = fakeRoom();
    expect(arrivalOf(room, 'me')).toBeNull();
    players.set('me', { x: 12, z: -9.5 });
    expect(arrivalOf(room, 'me')).toEqual({ x: 12, z: -9.5 });
    expect(arrivalOf({ state: null }, 'me')).toBeNull();
    expect(arrivalOf({}, 'me')).toBeNull();
    players.set('me', { x: Number.NaN, z: 0 });
    expect(arrivalOf(room, 'me')).toBeNull();
  });

  it('waits for the first patch that carries the player (the arena return), not the zone spawn', async () => {
    const { room, players } = fakeRoom();
    const c = fakeClock();
    players.set('other', { x: 1, z: 1 });
    c.onSleep.push((t) => { if (t >= 240) players.set('me', { x: 12, z: -9.5 }); });
    await expect(awaitArrival(room, 'me', { now: c.now, sleep: c.sleep })).resolves.toEqual({ x: 12, z: -9.5 });
    expect(c.now()).toBeGreaterThanOrEqual(240);
    expect(c.now()).toBeLessThan(ARRIVAL_TIMEOUT_MS);
  });

  it('gives up after the timeout (load with no arrival point) and stops when the room is replaced', async () => {
    const { room } = fakeRoom();
    const c = fakeClock();
    await expect(awaitArrival(room, 'me', { now: c.now, sleep: c.sleep, timeoutMs: 500 })).resolves.toBeNull();
    expect(c.now()).toBeGreaterThanOrEqual(500);
    let current = true;
    const c2 = fakeClock();
    c2.onSleep.push((t) => { if (t >= 90) current = false; });
    await expect(awaitArrival(room, 'me', { now: c2.now, sleep: c2.sleep, stillCurrent: () => current })).resolves.toBeNull();
    expect(c2.now()).toBeLessThan(200);
  });
});
