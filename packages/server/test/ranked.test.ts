/**
 * Phase D13 — the ranked queue.
 * - pure: `pairUp` matches inside both windows (±100, +50 / 10 s, ≤ 400), closest first, oldest first; `RankedArena`.
 * - live (real server + SDK clients): join refusals (`party`, `busy`); leave removes the entry; two players in
 *   different zones are matched, the far one is handed over into the arena room and the near one teleported, the pvp
 *   battle starts there once both stand in it, and a forfeit applies Elo exactly once per player; a gap outside the
 *   window waits until the window widens; with three queued players the close pair matches and the outlier stays;
 *   a gap beyond the 400 cap never matches.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getHeightfield, isWalkable, nearestWalkable } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { eloDelta } from '@ewa/core';
import type { SeatReservation, ServerMessage } from '@ewa/protocol';
import { RANKED_ARENA, RANKED_ARRIVAL_MS, RankedArena, pairUp, rankedArenaSpots } from '../src/rooms/matchQueue';
import type { RankedEntry, RankedMatch } from '../src/rooms/matchQueue';
import { enter, joinSeat, ofType, placePlayer, rawQuery, register, sleep, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

const e = (playerId: string, rating: number, joinedAt = 0): RankedEntry => ({ playerId, name: playerId, rating, joinedAt });

describe('Phase D13 pairUp (pure)', () => {
  it('matches inside the ±100 window at once, never outside it', () => {
    expect(pairUp([e('a', 1000), e('b', 1090)], 0).map(([x, y]) => [x.playerId, y.playerId])).toEqual([['a', 'b']]);
    expect(pairUp([e('a', 1000), e('b', 1101)], 0)).toEqual([]);
  });

  it('the window widens +50 every 10 s for both players and is capped at 400', () => {
    const q = [e('a', 1000), e('b', 1240)];
    expect(pairUp(q, 19_999)).toEqual([]); // ±150
    expect(pairUp(q, 30_000)).toHaveLength(1); // ±250
    // both windows must hold the gap: a fresh joiner (±100) does not match an old waiter 240 away
    expect(pairUp([e('a', 1000, 0), e('b', 1240, 60_000)], 60_000)).toEqual([]);
    expect(pairUp([e('a', 1000), e('b', 1401)], 3_600_000)).toEqual([]);
    expect(pairUp([e('a', 1000), e('b', 1400)], 3_600_000)).toHaveLength(1);
  });

  it('oldest first, closest rating wins; an outlier stays queued', () => {
    const pairs = pairUp([e('c', 1500, 0), e('a', 1000, 1), e('b', 1080, 2), e('d', 1030, 3)], 5);
    expect(pairs.map(([x, y]) => [x.playerId, y.playerId])).toEqual([['a', 'd']]);
  });

  it('arena spots are walkable and apart', () => {
    const [s0, s1] = rankedArenaSpots();
    const h = getHeightfield(RANKED_ARENA.zoneId);
    expect(isWalkable(h, s0.x, s0.z) && isWalkable(h, s1.x, s1.z)).toBe(true);
    expect(Math.hypot(s0.x - s1.x, s0.z - s1.z)).toBeGreaterThan(2);
  });

  it('RankedArena: involving / cancel (once started it cannot be cancelled) / delete', () => {
    const arena = new RankedArena();
    const m: RankedMatch = {
      matchId: 'm1', zoneId: 'mirevale', arenaRoomId: 'r', expiresAt: 10,
      players: [{ playerId: 'a', name: 'a', rating: 1, x: 0, z: 0 }, { playerId: 'b', name: 'b', rating: 1, x: 0, z: 0 }],
    };
    arena.add(m);
    arena.add(m);
    expect(arena.size).toBe(1);
    expect(arena.involving('b')?.match.matchId).toBe('m1');
    expect(arena.involving('c')).toBeNull();
    const p = arena.cancel('m1', 'a')!;
    expect(p.cancelled).toBe(true);
    expect([...p.notified]).toEqual(['a']);
    p.starting = true;
    expect(arena.cancel('m1', null)).toBeNull();
    arena.delete('m1');
    expect(arena.size).toBe(0);
  });
});

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

async function inZone(zoneId: ZoneId, x: number, z: number, rating: number): Promise<{ acc: Account; j: Joined }> {
  const acc = await register(s);
  await rawQuery(s.db, 'update players set rating = $2, peak_rating = $2 where id = $1', [acc.id, rating]);
  const p = nearestWalkable(getHeightfield(zoneId), x, z, 12)!;
  await placePlayer(s, acc.id, zoneId, p[0], p[1]);
  return { acc, j: await enter(s, acc, zoneId) };
}

const statuses = (j: Joined): Extract<ServerMessage, { type: 'rankedStatus' }>[] => ofType(j.msgs, 'rankedStatus');
const lastStatus = (j: Joined): Extract<ServerMessage, { type: 'rankedStatus' }> | undefined => statuses(j).at(-1);

async function queue(j: Joined, action: 'join' | 'leave'): Promise<Extract<ServerMessage, { type: 'rankedStatus' }>> {
  const n = statuses(j).length;
  j.room.send('rankedQueue', { action });
  await waitFor(() => statuses(j).length > n, 5000);
  return statuses(j)[n]!;
}

async function queued(): Promise<string[]> {
  return (await s.booted.runtime.matchQueue.entries()).map((x) => x.playerId);
}

describe('Phase D13 ranked queue (live)', () => {
  it('join refused with a fainted party (`party`); join → queued (idempotent) → leave removes the entry', async () => {
    const { acc, j } = await inZone('mirevale', 0, 6, 1000);
    await rawQuery(s.db, 'update creature_instances set hp = 0 where owner_id = $1', [acc.id]);
    expect(await queue(j, 'join')).toMatchObject({ state: 'idle', reason: 'party', rating: 1000 });
    expect(await queued()).not.toContain(acc.id);
    await rawQuery(s.db, 'update creature_instances set hp = 20 where owner_id = $1', [acc.id]);

    const first = await queue(j, 'join');
    expect(first).toMatchObject({ state: 'queued', rating: 1000, window: 100, opponent: null, reason: null });
    s.time.advance(10_000);
    // a second join keeps the first entry and its wait
    const again = await queue(j, 'join');
    expect(again).toMatchObject({ state: 'queued', window: 150 });
    expect(again.waitedMs).toBeGreaterThanOrEqual(10_000);
    expect(await queued()).toContain(acc.id);
    expect(await queue(j, 'leave')).toMatchObject({ state: 'idle', reason: 'left' });
    expect(await queued()).not.toContain(acc.id);
    await j.room.leave(true);
  }, 60_000);

  it('join refused while in a battle (`busy`); a disconnect drops a queued player', async () => {
    const h = getHeightfield('mirevale');
    let lane: readonly [number, number] | null = null;
    for (let x = -10; x <= 10 && lane === null; x += 1) for (let z = 0; z <= 12; z += 1) if (isWalkable(h, x, z) && isWalkable(h, x + 2, z)) { lane = [x, z]; break; }
    const a = await inZone('mirevale', lane![0], lane![1], 1000);
    const b = await inZone('mirevale', lane![0] + 2, lane![1], 1000);
    await waitFor(() => a.j.room.state.players.has(b.acc.id), 5000);
    a.j.room.send('challenge', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'challengeReceived').length > 0, 5000);
    b.j.room.send('challengeReply', { fromId: a.acc.id, accept: true });
    await waitFor(() => ofType(a.j.msgs, 'battleStart').length > 0, 8000);
    expect(await queue(a.j, 'join')).toMatchObject({ state: 'idle', reason: 'busy' });
    await b.j.room.leave(true);
    await a.j.room.leave(true);

    const c = await inZone('mirevale', 0, 6, 3000); // nobody near 3000: stays queued
    expect(await queue(c.j, 'join')).toMatchObject({ state: 'queued' });
    expect(await queued()).toContain(c.acc.id);
    await c.j.room.leave(true);
    await sleep(500);
    expect(await queued()).not.toContain(c.acc.id);
  }, 90_000);

  it('match across zones: handover + teleport into the arena room, pvp starts there, Elo applied exactly once', async () => {
    const far = await inZone('mire_route', 0, 0, 1000);
    const near = await inZone('mirevale', 0, 6, 1050);
    expect(await queue(far.j, 'join')).toMatchObject({ state: 'queued' });
    expect(await queue(near.j, 'join')).toMatchObject({ state: 'queued' });
    void s.booted.runtime.matchQueue.tick();

    // the mire_route player: matched, then a handover to the arena room in Mirevale
    await waitFor(() => ofType(far.j.msgs, 'handover').length > 0, 8000);
    expect(statuses(far.j).find((m) => m.state === 'matched')).toMatchObject({ opponent: { name: near.acc.username, rating: 1050 }, rating: 1000 });
    const ho = ofType(far.j.msgs, 'handover')[0]!;
    expect(ho.zoneId).toBe(RANKED_ARENA.zoneId);
    expect(ho.roomId).toBe(near.j.room.roomId); // the arena room is the near player's own Mirevale room
    const [s0, s1] = rankedArenaSpots();
    expect(ho.x).toBeCloseTo(s0.x, 3);
    // the Mirevale player is teleported to the other spot (no handover)
    await waitFor(() => statuses(near.j).some((m) => m.state === 'matched'), 5000);
    await waitFor(() => Math.abs(near.j.room.state.players.get(near.acc.id)!.x - s1.x) < 0.01, 5000);
    expect(ofType(near.j.msgs, 'handover')).toEqual([]);
    // the battle waits for the crossing to finish
    await sleep(300);
    expect(ofType(near.j.msgs, 'battleStart')).toEqual([]);

    const dest = await joinSeat(s, far.acc.access, ho.seat as SeatReservation);
    await waitFor(() => dest.room.state.players.get(far.acc.id) !== undefined, 5000);
    dest.room.send('handoverAck', { roomId: dest.room.roomId, seat: dest.room.sessionId });
    await waitFor(() => ofType(dest.msgs, 'battleStart').length > 0 && ofType(near.j.msgs, 'battleStart').length > 0, 8000);
    const startFar = ofType(dest.msgs, 'battleStart')[0]!;
    const startNear = ofType(near.j.msgs, 'battleStart')[0]!;
    expect(startFar.format).toBe('pvp');
    expect(startFar.battleId).toBe(startNear.battleId);
    expect(startFar.seat).toBe(0); // the longer-waiting player is side 0
    await waitFor(() => lastStatus(dest)?.reason === 'started' && lastStatus(near.j)?.reason === 'started', 5000);
    expect(await queued()).not.toContain(far.acc.id);
    expect(await queued()).not.toContain(near.acc.id);

    // the near player forfeits: Elo once per player, from the ratings at the match
    near.j.room.send('battleAction', { battleId: startNear.battleId, turn: startNear.state.turn + 1, action: { kind: 'forfeit' } });
    const mine = startFar.state.sides[0];
    const move = mine.party[mine.active]!.creature.moves[0]!.id;
    dest.room.send('battleAction', { battleId: startFar.battleId, turn: startFar.state.turn + 1, action: { kind: 'move', move } });
    await waitFor(() => ofType(dest.msgs, 'battleEnd').length > 0 && ofType(near.j.msgs, 'battleEnd').length > 0, 8000);
    const d = eloDelta(1000, 1050);
    expect(ofType(dest.msgs, 'battleEnd')[0]!.rewards.ratingDelta).toBe(d.winnerDelta);
    expect(ofType(near.j.msgs, 'battleEnd')[0]!.rewards.ratingDelta).toBe(d.loserDelta);
    await sleep(500);
    const [rf] = await rawQuery(s.db, 'select rating from players where id = $1', [far.acc.id]);
    const [rn] = await rawQuery(s.db, 'select rating from players where id = $1', [near.acc.id]);
    expect(Number(rf!['rating'])).toBe(1000 + d.winnerDelta);
    expect(Number(rn!['rating'])).toBe(1050 + d.loserDelta);
    const hist = await rawQuery(s.db, 'select player_id, rating_delta from battle_history where battle_id = $1 order by player_id', [startNear.battleId]);
    expect(hist).toHaveLength(2);
    expect(ofType(dest.msgs, 'battleStart')).toHaveLength(1);
    await dest.room.leave(true);
    await near.j.room.leave(true);
    expect(far.j.left.code).toBe(4002); // the crossing's source closed with handoverComplete
  }, 120_000);

  it('a matched player who never reaches the arena: the other is told `cancelled` after the arrival window', async () => {
    const far = await inZone('mire_route', 0, 0, 1500);
    const near = await inZone('mirevale', 0, 6, 1520);
    await queue(far.j, 'join');
    await queue(near.j, 'join');
    void s.booted.runtime.matchQueue.tick();
    await waitFor(() => ofType(far.j.msgs, 'handover').length > 0 && statuses(near.j).some((m) => m.state === 'matched'), 8000);
    await far.j.room.leave(true); // never consumes the seat
    await sleep(300);
    expect(ofType(near.j.msgs, 'battleStart')).toEqual([]);
    s.time.advance(RANKED_ARRIVAL_MS + 1_000);
    await waitFor(() => lastStatus(near.j)?.reason === 'cancelled', 5000);
    expect(ofType(near.j.msgs, 'battleStart')).toEqual([]);
    // free to queue again
    expect(await queue(near.j, 'join')).toMatchObject({ state: 'queued' });
    await near.j.room.leave(true);
  }, 90_000);

  it('a gap outside the window waits; the widening window matches it later; a third outlier stays queued', async () => {
    const a = await inZone('mirevale', 0, 6, 1200);
    const b = await inZone('mirevale', 2, 6, 1440);
    const c = await inZone('mirevale', -2, 6, 2400);
    for (const p of [a, b, c]) expect(await queue(p.j, 'join')).toMatchObject({ state: 'queued' });
    await s.booted.runtime.matchQueue.tick();
    await sleep(1_500); // the 1 s matcher ran too
    for (const p of [a, b, c]) expect(statuses(p.j).some((m) => m.state === 'matched')).toBe(false);
    expect(await queued()).toEqual(expect.arrayContaining([a.acc.id, b.acc.id, c.acc.id]));

    s.time.advance(30_000); // ±250 holds 240
    await s.booted.runtime.matchQueue.tick();
    await waitFor(() => statuses(a.j).some((m) => m.state === 'matched') && statuses(b.j).some((m) => m.state === 'matched'), 5000);
    await waitFor(() => ofType(a.j.msgs, 'battleStart').length > 0 && ofType(b.j.msgs, 'battleStart').length > 0, 8000);
    expect(ofType(a.j.msgs, 'battleStart')[0]!.battleId).toBe(ofType(b.j.msgs, 'battleStart')[0]!.battleId);

    // the 2400 player is 960 away from anyone: past the 400 cap it never matches
    s.time.advance(3_600_000);
    await s.booted.runtime.matchQueue.tick();
    await sleep(300);
    expect(statuses(c.j).some((m) => m.state === 'matched')).toBe(false);
    expect(await queued()).toContain(c.acc.id);
    for (const p of [a, b, c]) await p.j.room.leave(true);
  }, 120_000);
});
