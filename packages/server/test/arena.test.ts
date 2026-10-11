/**
 * Arena PvP — battles outside the world (protocol arena.ts, rooms/ArenaRoom.ts, rooms/arenaLobby.ts, rest/routes/arena.ts).
 * - pure: `pairArena` per mode (ranked window vs the two longest-waiting), `arenaCopies` (Lv 50 / own level, healed,
 *   synthetic ids), `arenaTrainingTeam` (seeded, distinct, sized), `arenaRefusal` (empty party, the cup's full party).
 * - live (real server + SDK clients): two players queue Level 50 → both matched with seats wherever they are → both
 *   join the arena room → the battle starts with every creature at 50 and full hp → a forfeit ends it: stored
 *   creatures byte-unchanged, no rating change, the pvp trainer exp, history rows with `arena: 'level50'`; Ranked
 *   applies Elo once per player; training starts at once, the AI acts, and pays nothing; a friend invite declined /
 *   accepted; the cup refused for a party under six; /zone/enter → 409 inArena mid-battle and /arena/rejoin resumes;
 *   a no-show cancels the match.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client as SdkClient } from '@colyseus/sdk';
import type { Room as SdkRoom } from '@colyseus/sdk';
import { ARENA_TRAINING, weeklyCup } from '@ewa/content';
import { TRAINER_EXP, calcMaxHp, eloDelta } from '@ewa/core';
import { ARENA_ARRIVAL_MS, ARENA_LEVEL, ArenaState } from '@ewa/protocol';
import type { SeatReservation, ServerMessage } from '@ewa/protocol';
import { arenaRefusal } from '../src/rooms/arenaLobby';
import { pairArena } from '../src/rooms/arenaQueue';
import type { ArenaEntry } from '../src/rooms/arenaQueue';
import { arenaCopies, arenaTrainingTeam } from '../src/rooms/battleSession';
import { newCreature, withSyntheticId } from '../src/game/creatures';
import { api, content, enter, ofType, rawQuery, register, sleep, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

const e = (playerId: string, rating: number, joinedAt = 0): ArenaEntry => ({ playerId, name: playerId, rating, joinedAt });

describe('arena pure parts', () => {
  it('pairArena: ranked keeps the rating window; the other modes pair the longest-waiting players', () => {
    const q = [e('a', 1000, 0), e('b', 1500, 1), e('c', 1050, 2), e('d', 2000, 3)];
    expect(pairArena('ranked', q, 5).map(([x, y]) => [x.playerId, y.playerId])).toEqual([['a', 'c']]);
    for (const mode of ['standard', 'level50', 'cup'] as const) {
      expect(pairArena(mode, q, 5).map(([x, y]) => [x.playerId, y.playerId])).toEqual([
        ['a', 'b'],
        ['c', 'd'],
      ]);
    }
    expect(pairArena('standard', [e('x', 1000)], 0)).toEqual([]);
  });

  it('arenaCopies: Lv 50 raised or lowered (or own level), healed, synthetic ids, at most six', () => {
    const mk = (sp: string, lv: number, i: number) => ({ ...withSyntheticId(newCreature(content, sp, lv), `00000000-0000-4000-8000-00000000000${i}`), hp: 1 });
    const party = [mk('bramblecub', 5, 1), mk('glimfin', 80, 2), mk('cindercap', 50, 3), mk('bramblecub', 9, 4), mk('glimfin', 9, 5), mk('cindercap', 9, 6), mk('glimfin', 9, 7)];
    const at50 = arenaCopies(party, ARENA_LEVEL, content);
    expect(at50).toHaveLength(6);
    for (const c of at50) {
      expect(c.level).toBe(50);
      expect(c.hp).toBe(calcMaxHp(content.species(c.speciesId).baseHp, 50));
      expect(c.id.startsWith('arena:')).toBe(true);
      expect(c.moves.every((m) => m.pp === m.ppMax)).toBe(true);
    }
    const own = arenaCopies(party, null, content);
    expect(own.map((c) => c.level)).toEqual([5, 80, 50, 9, 9, 9]);
    expect(own[1]!.hp).toBe(calcMaxHp(content.species('glimfin').baseHp, 80));
  });

  it('arenaTrainingTeam: seeded, distinct species from the pool, sized, levelled', () => {
    const a = arenaTrainingTeam('seed', 'hard', 4, 50, content);
    expect(a).toEqual(arenaTrainingTeam('seed', 'hard', 4, 50, content));
    expect(a).toHaveLength(4);
    expect(new Set(a.map((c) => c.speciesId)).size).toBe(4);
    expect(a.every((c) => ARENA_TRAINING.hard.pool.includes(c.speciesId) && c.level === 50)).toBe(true);
    expect(a.map((c) => c.id)).toEqual(['arena:foe:0', 'arena:foe:1', 'arena:foe:2', 'arena:foe:3']);
  });

  it('arenaRefusal: an empty party; the cup needs six (with the reason)', () => {
    const one = [withSyntheticId(newCreature(content, 'bramblecub', 5), 'x')];
    expect(arenaRefusal([], 'standard', 0)).toMatchObject({ reason: 'party' });
    expect(arenaRefusal(one, 'level50', 0)).toBeNull();
    const cup = arenaRefusal(one, 'cup', Date.UTC(2026, 9, 11));
    expect(cup?.reason).toBe('cup');
    expect(cup?.detail).toContain(weeklyCup(Date.UTC(2026, 9, 11)).def.name);
  });
});

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

interface Arena {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the SDK's room-type parameter is irrelevant here
  readonly room: SdkRoom<any, ArenaState>;
  readonly msgs: ServerMessage[];
}

async function joinArena(acc: Account, seat: SeatReservation): Promise<Arena> {
  const sdk = new SdkClient(s.wsUrl);
  sdk.auth.token = acc.access;
  const room = (await sdk.consumeSeatReservation(seat as never, ArenaState)) as Arena['room'];
  const msgs: ServerMessage[] = [];
  room.onMessage('*', (_t: string | number, payload: unknown) => void msgs.push(payload as ServerMessage));
  return { room, msgs };
}

async function online(): Promise<{ acc: Account; j: Joined }> {
  const acc = await register(s);
  return { acc, j: await enter(s, acc, 'mirevale') };
}

const statuses = (msgs: readonly ServerMessage[]) => ofType(msgs, 'arenaStatus');
const states = (a: Arena) => ofType(a.msgs, 'arenaState');

async function creatureRows(id: string): Promise<string> {
  return JSON.stringify(await rawQuery(s.db, 'select * from creature_instances where owner_id = $1 order by id', [id]));
}

async function playerRow(id: string): Promise<{ rating: number; rankedMatches: number; trainerExp: number }> {
  const [r] = await rawQuery(s.db, 'select rating, ranked_matches, trainer_exp from players where id = $1', [id]);
  return { rating: Number(r!['rating']), rankedMatches: Number(r!['ranked_matches']), trainerExp: Number(r!['trainer_exp']) };
}

/** Queues both, ticks the matcher, and returns each one's `matched` status (pushed through their zone rooms). */
async function queuePair(a: { acc: Account; j: Joined }, b: { acc: Account; j: Joined }, mode: string) {
  expect((await api(s, 'POST', '/arena/queue', a.acc.access, { mode })).body).toMatchObject({ state: 'queued', kind: mode });
  expect((await api(s, 'POST', '/arena/queue', b.acc.access, { mode })).body).toMatchObject({ state: 'queued', kind: mode });
  await s.booted.runtime.arena.tick();
  await waitFor(() => statuses(a.j.msgs).some((m) => m.state === 'matched') && statuses(b.j.msgs).some((m) => m.state === 'matched'), 8000);
  return [statuses(a.j.msgs).find((m) => m.state === 'matched')!, statuses(b.j.msgs).find((m) => m.state === 'matched')!] as const;
}

/** Leaves the world and takes the seat (as the client does), for both players; resolves once the battle started. */
async function intoArena(pairs: readonly [{ acc: Account; j: Joined }, SeatReservation][]): Promise<Arena[]> {
  const out: Arena[] = [];
  for (const [p, seat] of pairs) {
    await p.j.room.leave(true);
    out.push(await joinArena(p.acc, seat));
  }
  await waitFor(() => out.every((a) => ofType(a.msgs, 'battleStart').length > 0), 8000);
  return out;
}

describe('arena PvP (live)', () => {
  it('Level 50: matched anywhere → the arena → everyone at 50, full hp → forfeit: creatures untouched, no rating, pvp exp, history', async () => {
    const a = await online();
    const b = await online();
    const beforeA = await creatureRows(a.acc.id);
    const beforeB = await creatureRows(b.acc.id);
    const pa = await playerRow(a.acc.id);
    const pb = await playerRow(b.acc.id);
    const [ma, mb] = await queuePair(a, b, 'level50');
    expect(ma).toMatchObject({ kind: 'level50', opponent: { name: b.acc.username } });
    expect(mb.opponent?.name).toBe(a.acc.username);
    expect(ma.seat?.roomId).toBe(mb.seat?.roomId);
    expect((await api(s, 'GET', '/arena', a.acc.access)).body.status.state).toBe('idle');

    const [aa, ab] = await intoArena([
      [a, ma.seat as SeatReservation],
      [b, mb.seat as SeatReservation],
    ]);
    expect(states(aa!).map((m) => m.phase)).toEqual(expect.arrayContaining(['waiting', 'fighting']));
    expect(states(aa!).at(-1)).toMatchObject({ kind: 'level50', level: 50, phase: 'fighting', foeName: null, cup: null });
    const start = ofType(aa!.msgs, 'battleStart')[0]!;
    expect(start.format).toBe('pvp');
    expect(start.x).toBe(0);
    for (const side of start.state.sides) {
      expect(side.kind).toBe('player');
      for (const bt of side.party) {
        expect(bt.creature.level).toBe(50);
        expect(bt.creature.hp).toBe(bt.maxHp);
        expect(bt.creature.id.startsWith('arena:')).toBe(true);
      }
    }
    // presence: in the arena room, mid-battle → /zone/enter refuses
    const enterA = await api(s, 'POST', '/zone/enter', a.acc.access, { zoneId: 'mirevale' });
    expect(enterA).toMatchObject({ status: 409, body: { code: 'inArena', roomId: aa!.room.roomId } });
    // no bag items in the arena
    const startB = ofType(ab!.msgs, 'battleStart')[0]!;
    ab!.room.send('battleAction', { battleId: startB.battleId, turn: startB.state.turn + 1, action: { kind: 'item', item: 'potion', target: 0 } });
    await waitFor(() => ofType(ab!.msgs, 'error').length > 0, 5000);

    ab!.room.send('battleAction', { battleId: startB.battleId, turn: startB.state.turn + 1, action: { kind: 'forfeit' } });
    const move = start.state.sides[0].party[0]!.creature.moves[0]!.id;
    aa!.room.send('battleAction', { battleId: start.battleId, turn: start.state.turn + 1, action: { kind: 'move', move } });
    await waitFor(() => ofType(aa!.msgs, 'battleEnd').length > 0 && ofType(ab!.msgs, 'battleEnd').length > 0, 8000);
    expect(ofType(aa!.msgs, 'battleEnd')[0]!.rewards).toMatchObject({ trainerExp: TRAINER_EXP.pvpWin, ratingDelta: null });
    expect(ofType(ab!.msgs, 'battleEnd')[0]!.rewards).toMatchObject({ trainerExp: TRAINER_EXP.pvpLoss, ratingDelta: null });
    await waitFor(() => states(aa!).at(-1)?.phase === 'ended', 5000);
    await sleep(200);
    expect(await creatureRows(a.acc.id)).toBe(beforeA);
    expect(await creatureRows(b.acc.id)).toBe(beforeB);
    const qa = await playerRow(a.acc.id);
    const qb = await playerRow(b.acc.id);
    expect(qa).toEqual({ rating: pa.rating, rankedMatches: pa.rankedMatches, trainerExp: pa.trainerExp + TRAINER_EXP.pvpWin });
    expect(qb).toEqual({ rating: pb.rating, rankedMatches: pb.rankedMatches, trainerExp: pb.trainerExp + TRAINER_EXP.pvpLoss });
    const hist = (await api(s, 'GET', '/history/battles', a.acc.access)).body.rows;
    expect(hist[0]).toMatchObject({ battleId: start.battleId, format: 'pvp', result: 'win', opponent: b.acc.id, arena: 'level50', ratingDelta: null });
    // the battle is over: the world takes the player back, the rejoin has nothing to rejoin
    expect((await api(s, 'POST', '/arena/rejoin', a.acc.access)).status).toBe(404);
    expect((await api(s, 'POST', '/zone/enter', a.acc.access, { zoneId: 'mirevale' })).status).toBe(200);
    await aa!.room.leave(true);
    await ab!.room.leave(true);
  }, 120_000);

  it('Ranked: Elo exactly once per player (rankedMatches + 1)', async () => {
    const a = await online();
    const b = await online();
    await rawQuery(s.db, 'update players set rating = 1000, peak_rating = 1000 where id = $1', [a.acc.id]);
    await rawQuery(s.db, 'update players set rating = 1040, peak_rating = 1040 where id = $1', [b.acc.id]);
    const [ma, mb] = await queuePair(a, b, 'ranked');
    const [aa, ab] = await intoArena([
      [a, ma.seat as SeatReservation],
      [b, mb.seat as SeatReservation],
    ]);
    const sa = ofType(aa!.msgs, 'battleStart')[0]!;
    // side 0 = the longer-waiting player (a)
    expect(sa.seat).toBe(0);
    aa!.room.send('battleAction', { battleId: sa.battleId, turn: 1, action: { kind: 'forfeit' } });
    const sb = ofType(ab!.msgs, 'battleStart')[0]!;
    ab!.room.send('battleAction', { battleId: sb.battleId, turn: 1, action: { kind: 'move', move: sb.state.sides[1].party[0]!.creature.moves[0]!.id } });
    await waitFor(() => ofType(aa!.msgs, 'battleEnd').length > 0 && ofType(ab!.msgs, 'battleEnd').length > 0, 8000);
    const d = eloDelta(1040, 1000);
    expect(ofType(ab!.msgs, 'battleEnd')[0]!.rewards.ratingDelta).toBe(d.winnerDelta);
    expect(ofType(aa!.msgs, 'battleEnd')[0]!.rewards.ratingDelta).toBe(d.loserDelta);
    await sleep(200);
    expect(await playerRow(a.acc.id)).toMatchObject({ rating: 1000 + d.loserDelta, rankedMatches: 1 });
    expect(await playerRow(b.acc.id)).toMatchObject({ rating: 1040 + d.winnerDelta, rankedMatches: 1 });
    const hist = await rawQuery(s.db, 'select player_id from battle_history where battle_id = $1', [sa.battleId]);
    expect(hist).toHaveLength(2);
    await aa!.room.leave(true);
    await ab!.room.leave(true);
  }, 120_000);

  it('training: starts at once, the AI acts, nothing is paid; the history row says training', async () => {
    const a = await online();
    const before = await playerRow(a.acc.id);
    const creatures = await creatureRows(a.acc.id);
    const r = await api(s, 'POST', '/arena/training', a.acc.access, { rules: 'level50', difficulty: 'easy' });
    expect(r.status).toBe(200);
    await a.j.room.leave(true);
    const ar = await joinArena(a.acc, r.body.seat as SeatReservation);
    await waitFor(() => ofType(ar.msgs, 'battleStart').length > 0, 8000);
    const start = ofType(ar.msgs, 'battleStart')[0]!;
    expect(start.format).toBe('trainer');
    expect(start.state.sides[1]).toMatchObject({ kind: 'npc', trainerId: ARENA_TRAINING.easy.trainerId });
    expect(start.state.sides[1].party).toHaveLength(1); // the player's party size
    expect(start.state.sides[1].party[0]!.creature.level).toBe(50);
    expect(states(ar).at(-1)).toMatchObject({ kind: 'training', foeName: ARENA_TRAINING.easy.name, players: [{ playerId: a.acc.id }] });
    // play it out: a move every turn until the end
    const move = start.state.sides[0].party[0]!.creature.moves[0]!.id;
    let turn = start.state.turn + 1;
    ar.room.send('battleAction', { battleId: start.battleId, turn, action: { kind: 'move', move } });
    for (let guard = 0; guard < 80 && ofType(ar.msgs, 'battleEnd').length === 0; guard++) {
      await waitFor(() => ofType(ar.msgs, 'battleEvents').some((m) => m.turn === turn) || ofType(ar.msgs, 'battleEnd').length > 0, 8000);
      const ev = ofType(ar.msgs, 'battleEvents').find((m) => m.turn === turn);
      expect(ev !== undefined || ofType(ar.msgs, 'battleEnd').length > 0).toBe(true);
      if (ofType(ar.msgs, 'battleEnd').length > 0) break;
      turn += 1;
      ar.room.send('battleAction', { battleId: start.battleId, turn, action: { kind: 'move', move } });
    }
    await waitFor(() => ofType(ar.msgs, 'battleEnd').length > 0, 8000);
    expect(ofType(ar.msgs, 'battleEnd')[0]!.rewards).toMatchObject({ money: 0, trainerExp: 0, ratingDelta: null });
    // the AI acted (core chooseNpcAction): its creature used a move
    const all = ofType(ar.msgs, 'battleEvents').flatMap((m) => m.events);
    expect(all.some((x) => x.t === 'moveUsed' && x.who.side === 1)).toBe(true);
    await sleep(200);
    expect(await playerRow(a.acc.id)).toEqual(before);
    expect(await creatureRows(a.acc.id)).toBe(creatures);
    const flags = await rawQuery(s.db, "select flag from story_flags where player_id = $1 and flag like 'trainer:%'", [a.acc.id]);
    expect(flags).toEqual([]);
    const hist = (await api(s, 'GET', '/history/battles', a.acc.access)).body.rows;
    expect(hist[0]).toMatchObject({ battleId: start.battleId, format: 'trainer', arena: 'training', opponent: ARENA_TRAINING.easy.trainerId });
    await ar.room.leave(true);
  }, 120_000);

  it('friend invites: declined, then accepted → both seated in a friend battle', async () => {
    const a = await online();
    const b = await online();
    const stranger = await api(s, 'POST', '/arena/invite', a.acc.access, { username: b.acc.username, rules: 'standard' });
    expect(stranger).toMatchObject({ status: 409, body: { code: 'notFriends' } });
    await s.repos.db.transaction(async (tx) => {
      await s.repos.social.requestFriend(tx, a.acc.id, b.acc.id, new Date());
      await s.repos.social.acceptFriend(tx, b.acc.id, a.acc.id);
    });
    const inv1 = await api(s, 'POST', '/arena/invite', a.acc.access, { username: b.acc.username, rules: 'standard' });
    expect(inv1.status).toBe(200);
    await waitFor(() => ofType(b.j.msgs, 'arenaInvite').length > 0, 5000);
    expect(ofType(b.j.msgs, 'arenaInvite')[0]).toMatchObject({ inviteId: inv1.body.inviteId, fromId: a.acc.id, fromName: a.acc.username, rules: 'standard' });
    // only the addressee may answer
    expect((await api(s, 'POST', '/arena/invite/reply', a.acc.access, { inviteId: inv1.body.inviteId, accept: true })).status).toBe(404);
    expect((await api(s, 'POST', '/arena/invite/reply', b.acc.access, { inviteId: inv1.body.inviteId, accept: false })).body).toEqual({ seat: null });
    await waitFor(() => ofType(a.j.msgs, 'arenaInviteResult').length > 0, 5000);
    expect(ofType(a.j.msgs, 'arenaInviteResult')[0]).toMatchObject({ result: 'declined', toName: b.acc.username });

    const inv2 = await api(s, 'POST', '/arena/invite', a.acc.access, { username: b.acc.username, rules: 'level50' });
    await waitFor(() => ofType(b.j.msgs, 'arenaInvite').length > 1, 5000);
    const reply = await api(s, 'POST', '/arena/invite/reply', b.acc.access, { inviteId: inv2.body.inviteId, accept: true });
    expect(reply.status).toBe(200);
    await waitFor(() => statuses(a.j.msgs).some((m) => m.state === 'matched'), 5000);
    const ma = statuses(a.j.msgs).find((m) => m.state === 'matched')!;
    expect(ma).toMatchObject({ kind: 'friend', opponent: { name: b.acc.username } });
    const [aa, ab] = await intoArena([
      [a, ma.seat as SeatReservation],
      [b, reply.body.seat as SeatReservation],
    ]);
    expect(states(aa!).at(-1)).toMatchObject({ kind: 'friend', level: 50, phase: 'fighting' });
    expect(ofType(ab!.msgs, 'battleStart')[0]!.state.sides[1].party[0]!.creature.level).toBe(50);
    // a real leave forfeits
    await aa!.room.leave(true);
    await waitFor(() => ofType(ab!.msgs, 'battleEnd').length > 0, 8000);
    expect(ofType(ab!.msgs, 'battleEnd')[0]!.outcome).toMatchObject({ winner: 1 });
    await ab!.room.leave(true);
  }, 120_000);

  it('the Weekly Cup refuses a party under six (idle / cup with the reason)', async () => {
    const a = await online();
    const r = await api(s, 'POST', '/arena/queue', a.acc.access, { mode: 'cup' });
    expect(r.body).toMatchObject({ state: 'idle', reason: 'cup' });
    expect(r.body.detail).toContain('full party');
    const info = (await api(s, 'GET', '/arena', a.acc.access)).body;
    expect(info).toMatchObject({ level: 50, live: null, status: { state: 'idle' }, cup: { id: weeklyCup(s.time.clock()).def.id } });
    // queue / move / leave
    expect((await api(s, 'POST', '/arena/queue', a.acc.access, { mode: 'standard' })).body).toMatchObject({ state: 'queued', kind: 'standard' });
    expect((await api(s, 'POST', '/arena/queue', a.acc.access, { mode: 'ranked' })).body).toMatchObject({ state: 'queued', kind: 'ranked', window: 100 });
    expect((await s.booted.runtime.arena.queue.entries('standard')).map((x) => x.playerId)).not.toContain(a.acc.id);
    expect((await api(s, 'POST', '/arena/queue/leave', a.acc.access)).body).toMatchObject({ state: 'idle', reason: 'left' });
    expect(await s.booted.runtime.arena.queue.find(a.acc.id)).toBeNull();
    await a.j.room.leave(true);
    // offline: refused
    expect((await api(s, 'POST', '/arena/queue', a.acc.access, { mode: 'standard' })).status).toBe(409);
  }, 60_000);

  it('a reload mid-battle: /zone/enter → 409 inArena, /arena/rejoin → the same battle (arenaState + battleResync)', async () => {
    const a = await online();
    const b = await online();
    const [ma, mb] = await queuePair(a, b, 'standard');
    const [aa, ab] = await intoArena([
      [a, ma.seat as SeatReservation],
      [b, mb.seat as SeatReservation],
    ]);
    const start = ofType(aa!.msgs, 'battleStart')[0]!;
    // own levels in Standard (the starter's), healed
    expect(start.state.sides[0].party[0]!.creature.level).toBe(5);
    await aa!.room.leave(false); // a dropped socket: the seat is kept 20 s
    await sleep(200);
    expect((await api(s, 'POST', '/zone/enter', a.acc.access, { zoneId: 'mirevale' })).body).toMatchObject({ code: 'inArena' });
    expect((await api(s, 'GET', '/arena', a.acc.access)).body.live).toEqual({ roomId: aa!.room.roomId });
    const rj = await api(s, 'POST', '/arena/rejoin', a.acc.access);
    expect(rj.status).toBe(200);
    const back = await joinArena(a.acc, rj.body.seat as SeatReservation);
    await waitFor(() => ofType(back.msgs, 'battleResync').length > 0 && states(back).length > 0, 5000);
    expect(states(back)[0]).toMatchObject({ phase: 'fighting' });
    expect(ofType(back.msgs, 'battleResync')[0]!.battleId).toBe(start.battleId);
    // the battle goes on from the new socket
    back.room.send('battleAction', { battleId: start.battleId, turn: 1, action: { kind: 'forfeit' } });
    const sb = ofType(ab!.msgs, 'battleStart')[0]!;
    ab!.room.send('battleAction', { battleId: sb.battleId, turn: 1, action: { kind: 'move', move: sb.state.sides[1].party[0]!.creature.moves[0]!.id } });
    await waitFor(() => ofType(back.msgs, 'battleEnd').length > 0 && ofType(ab!.msgs, 'battleEnd').length > 0, 8000);
    const hist = (await api(s, 'GET', '/history/battles', a.acc.access)).body.rows;
    expect(hist[0]).toMatchObject({ arena: 'standard', result: 'loss' });
    await back.room.leave(true);
    await ab!.room.leave(true);
  }, 120_000);

  it('a no-show: the arena cancels after the arrival window; the absent player is told in the world', async () => {
    const a = await online();
    const b = await online();
    const [ma] = await queuePair(a, b, 'level50');
    await a.j.room.leave(true);
    const aa = await joinArena(a.acc, ma.seat as SeatReservation);
    await waitFor(() => states(aa).length > 0, 5000);
    expect(states(aa)[0]).toMatchObject({ phase: 'waiting' });
    s.time.advance(ARENA_ARRIVAL_MS + 1_000);
    await waitFor(() => states(aa).some((m) => m.phase === 'cancelled'), 5000);
    expect(states(aa).find((m) => m.phase === 'cancelled')).toMatchObject({ reason: 'noShow' });
    await waitFor(() => statuses(b.j.msgs).some((m) => m.state === 'idle' && m.reason === 'cancelled'), 5000);
    expect(ofType(aa.msgs, 'battleStart')).toEqual([]);
    // free again: no live arena
    expect((await api(s, 'GET', '/arena', a.acc.access)).body.live).toBeNull();
    await aa.room.leave(true);
    await b.j.room.leave(true);
  }, 60_000);
});
