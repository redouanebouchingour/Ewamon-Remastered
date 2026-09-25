/**
 * §50.4.5 story-beats / handover / challenge (room-level, real server + SDK clients):
 * - §30.4.8: interact on `mirevale.wynn` with no flags → storyBeat start, progressionDelta flags, complete;
 *   a second interact is a plain NPC; ZoneState.harvestState is never written.
 * - §30.2.7: crossing the trigger line emits `handover` with a full seat; the destination validates the
 *   presence reservation; `handoverAck` writes the position row once; the source removes the avatar (4002).
 *   A gated destination pushes the player back with a toast.
 * - §30.4.5: the challenge handshake re-checks presence/range on accept.
 * - §30.4.6 ground items: once per player.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { beatDoneFlag, getHeightfield, isWalkable, nearestWalkable, playableBounds } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { SeatReservation } from '@ewa/protocol';
import { enter, joinSeat, ofType, placePlayer, rawQuery, register, sleep, startServer, storyOnly, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

async function inZone(zoneId: ZoneId, x: number, z: number, acc?: Account): Promise<{ acc: Account; j: Joined }> {
  const a = acc ?? (await register(s));
  const p = nearestWalkable(getHeightfield(zoneId), x, z, 12)!;
  await placePlayer(s, a.id, zoneId, p[0], p[1]);
  return { acc: a, j: await enter(s, a, zoneId) };
}

/** Walks the avatar along +x/−x in legal running steps (≤ 0.4 m / 50 ms) until `done` or `maxSteps`. */
async function walk(j: Joined, id: string, dx: number, dz: number, maxSteps: number, done: () => boolean): Promise<void> {
  let seq = j.room.state.players.get(id)!.seq;
  for (let i = 0; i < maxSteps && !done(); i++) {
    const me = j.room.state.players.get(id);
    if (me === undefined) return;
    seq += 1;
    j.room.send('input', { seq, x: me.x + dx, z: me.z + dz, angle: 0, running: true, dtMs: 50 });
    const target = seq;
    await waitFor(() => (j.room.state.players.get(id)?.seq ?? target) >= target || done(), 2000).catch(() => undefined);
    await sleep(55);
  }
}

describe('§30.4.8 story beats', () => {
  it('wynn with no flags → start, flags (met_wynn + done), complete; a second interact is a plain NPC; harvestState untouched', async () => {
    const { acc, j } = await inZone('mirevale', 4, -12);
    j.room.send('interact', { kind: 'npc', targetId: 'mirevale.wynn' });
    await waitFor(() => ofType(j.msgs, 'storyBeat').some((m) => m.phase === 'complete'), 5000);
    const beats = ofType(j.msgs, 'storyBeat');
    expect(beats.map((b) => [b.beatId, b.phase])).toEqual([
      ['first_witness', 'start'],
      ['first_witness', 'complete'],
    ]);
    const prog = ofType(j.msgs, 'progressionDelta').find((m) => m.flags !== null)!;
    expect(prog.flags).toEqual(['met_wynn', beatDoneFlag('first_witness')]);
    // order: start → progressionDelta → complete
    const iStart = j.msgs.findIndex((m) => m.type === 'storyBeat' && m.phase === 'start');
    const iProg = j.msgs.indexOf(prog);
    const iDone = j.msgs.findIndex((m) => m.type === 'storyBeat' && m.phase === 'complete');
    expect(iStart).toBeLessThan(iProg);
    expect(iProg).toBeLessThan(iDone);
    const flags = (await rawQuery(s.db, 'select flag from story_flags where player_id = $1', [acc.id])).map((r) => r['flag']);
    expect(storyOnly(flags).sort()).toEqual(['beat:first_witness:done', 'met_wynn']);
    const n = j.msgs.length;
    j.room.send('interact', { kind: 'npc', targetId: 'mirevale.wynn' });
    await sleep(500);
    expect(ofType(j.msgs.slice(n), 'storyBeat')).toEqual([]);
    expect(j.room.state.harvestState).toBe('intact');
    await j.room.leave(true);
  }, 60_000);
});

describe('§30.4.6 ground items', () => {
  it('a pickup within 3 m grants the item once (flag item:<zone>:<id>)', async () => {
    const { acc, j } = await inZone('mirevale', -18, 9);
    j.room.send('interact', { kind: 'item', targetId: 'mv1' });
    await waitFor(() => ofType(j.msgs, 'inventoryDelta').length > 0, 5000);
    expect(ofType(j.msgs, 'inventoryDelta')[0]).toMatchObject({ items: { potion: 6 } });
    j.room.send('interact', { kind: 'item', targetId: 'mv1' });
    await waitFor(() => ofType(j.msgs, 'error').length > 0, 3000);
    expect(ofType(j.msgs, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'alreadyTaken' });
    const [inv] = await rawQuery(s.db, "select qty from inventory_items where player_id = $1 and item_id = 'potion'", [acc.id]);
    expect(Number(inv!['qty'])).toBe(6);
    await j.room.leave(true);
  }, 60_000);
});

describe('§30.2.7 handover', () => {
  it('crossing the east trigger emits handover; the destination validates it; the ack writes the row once; the source removes the avatar', async () => {
    const h = getHeightfield('mirevale');
    const b = playableBounds(h);
    // a walkable lane toward the east edge
    let start: readonly [number, number] | null = null;
    for (let z = -20; z <= 20 && start === null; z += 0.5) {
      let ok = true;
      for (let x = b.maxX - 10; x <= b.maxX - 5; x += 0.25) if (!isWalkable(h, x, z)) ok = false;
      if (ok) start = [b.maxX - 9, z];
    }
    expect(start).not.toBeNull();
    const { acc, j } = await inZone('mirevale', start![0], start![1]);
    await walk(j, acc.id, 0.38, 0, 40, () => ofType(j.msgs, 'handover').length > 0);
    await waitFor(() => ofType(j.msgs, 'handover').length > 0, 5000);
    const ho = ofType(j.msgs, 'handover')[0]!;
    expect(ho.zoneId).toBe('mire_route');
    expect(ho.seat).toMatchObject({ name: 'zone', roomId: ho.roomId });
    expect(typeof ho.seat.sessionId).toBe('string');
    const db = playableBounds(getHeightfield('mire_route'));
    expect(ho.x).toBeLessThan(db.minX + 8);
    // before the ack the row still says mirevale
    expect((await rawQuery(s.db, 'select zone_id from players where id = $1', [acc.id]))[0]!['zone_id']).toBe('mirevale');
    const dest = await joinSeat(s, acc.access, ho.seat as SeatReservation);
    await waitFor(() => dest.room.state.players.get(acc.id) !== undefined, 5000);
    expect(dest.room.state.players.get(acc.id)!.x).toBeCloseTo(ho.x, 3);
    dest.room.send('handoverAck', { roomId: dest.room.roomId, seat: dest.room.sessionId });
    await waitFor(() => j.left.code !== null, 6000);
    expect(j.left.code).toBe(4002);
    await sleep(300);
    const [row] = await rawQuery(s.db, 'select zone_id, x from players where id = $1', [acc.id]);
    expect(row!['zone_id']).toBe('mire_route');
    expect(Number(row!['x'])).toBeCloseTo(ho.x, 3);
    // the destination owns the player: presence says so
    expect(s.booted.runtime.presenceStore.get(acc.id)?.zoneId).toBe('mire_route');
    await dest.room.leave(true);
  }, 90_000);

  it('a gated destination: toast "The way is barred", pushed 1 m back, no handover', async () => {
    const h = getHeightfield('mire_route');
    const b = playableBounds(h);
    let start: readonly [number, number] | null = null;
    for (let z = -6; z <= 6 && start === null; z += 0.5) {
      let ok = true;
      for (let x = b.maxX - 9; x <= b.maxX - 5; x += 0.25) if (!isWalkable(h, x, z)) ok = false;
      if (ok) start = [b.maxX - 8, z];
    }
    expect(start).not.toBeNull();
    const { acc, j } = await inZone('mire_route', start![0], start![1]);
    await walk(j, acc.id, 0.38, 0, 30, () => ofType(j.msgs, 'toast').length > 0);
    await waitFor(() => ofType(j.msgs, 'toast').length > 0, 5000);
    expect(ofType(j.msgs, 'toast')[0]).toMatchObject({ level: 'warn' });
    expect(ofType(j.msgs, 'toast')[0]!.text).toContain('The way is barred');
    expect(ofType(j.msgs, 'handover')).toEqual([]);
    await sleep(200);
    expect(j.room.state.players.get(acc.id)!.x).toBeLessThan(b.maxX - 6);
    await j.room.leave(true);
  }, 90_000);
});

describe('§30.4.5 challenge handshake', () => {
  it('accept after the challenger walked out of range → unavailable, no battle; an in-range accept starts a pvp battle for both seats', async () => {
    const h = getHeightfield('mirevale');
    const lane: [number, number] = (() => {
      for (let z = -10; z <= 10; z += 0.5) {
        let ok = true;
        for (let x = -20; x <= 10; x += 0.25) if (!isWalkable(h, x, z)) ok = false;
        if (ok) return [0, z];
      }
      throw new Error('no lane');
    })();
    const a = await inZone('mirevale', lane[0], lane[1]);
    const b = await inZone('mirevale', lane[0] + 2, lane[1]);
    await waitFor(() => a.j.room.state.players.has(b.acc.id), 5000);
    a.j.room.send('challenge', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'challengeReceived').length > 0, 5000);
    expect(ofType(b.j.msgs, 'challengeReceived')[0]).toMatchObject({ fromId: a.acc.id, expiresInMs: 45000 });
    // a walks 14 m away (−x) before b accepts
    const x0 = a.j.room.state.players.get(a.acc.id)!.x;
    await walk(a.j, a.acc.id, -0.38, 0, 60, () => x0 - a.j.room.state.players.get(a.acc.id)!.x > 14);
    b.j.room.send('challengeReply', { fromId: a.acc.id, accept: true });
    await waitFor(() => ofType(b.j.msgs, 'challengeResult').length > 0, 5000);
    expect(ofType(b.j.msgs, 'challengeResult')[0]).toMatchObject({ targetId: a.acc.id, result: 'unavailable' });
    expect(ofType(a.j.msgs, 'battleStart')).toEqual([]);
    expect(ofType(b.j.msgs, 'battleStart')).toEqual([]);
    // walk back in range and try again: this time both get battleStart (seat 0 = challenger)
    await walk(a.j, a.acc.id, 0.38, 0, 60, () => a.j.room.state.players.get(a.acc.id)!.x - (x0 - 1) > 0);
    a.j.room.send('challenge', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'challengeReceived').length > 1, 5000);
    b.j.room.send('challengeReply', { fromId: a.acc.id, accept: true });
    await waitFor(() => ofType(a.j.msgs, 'battleStart').length > 0 && ofType(b.j.msgs, 'battleStart').length > 0, 8000);
    expect(ofType(a.j.msgs, 'battleStart')[0]).toMatchObject({ seat: 0, format: 'pvp' });
    expect(ofType(b.j.msgs, 'battleStart')[0]).toMatchObject({ seat: 1, format: 'pvp' });
    await waitFor(() => a.j.room.state.battles.size === 1 && a.j.room.state.players.get(a.acc.id)!.inBattle, 3000);
    // REST refuses creature mutations during the battle
    const me = await (await import('./helpers')).api(s, 'POST', '/heal', a.acc.access);
    expect(me.status).toBe(409);
    expect(me.body.code).toBe('inBattle');
    // b disconnects: pvp forfeit → a wins
    await b.j.room.leave(true);
    await waitFor(() => ofType(a.j.msgs, 'battleEnd').length > 0, 8000);
    expect(ofType(a.j.msgs, 'battleEnd')[0]).toMatchObject({ outcome: { winner: 0 } });
    await a.j.room.leave(true);
  }, 120_000);
});
