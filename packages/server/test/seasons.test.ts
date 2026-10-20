/**
 * Ranked seasons and spectator mode (content seasons.ts, jobs/seasonRollover.ts, game/liveBoard.ts, ArenaRoom).
 * - pure: the season calendar from its anchor, Finals week, the rating pulled halfway back, the titles.
 * - seasons: the standings so far; the rollover closes an ended season once (standings kept, ratings halfway back);
 *   GET /seasons, /seasons/:season and /seasons/titles/:username.
 * - live: a ranked match between two of the season's top eight in Finals week is listed first as the Finals; its feed
 *   is a replay a turn behind that reproduces its digest; the end publishes the whole fight with its outcome and the
 *   match leaves the list; training is never listed.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client as SdkClient } from '@colyseus/sdk';
import type { Room as SdkRoom } from '@colyseus/sdk';
import { SEASON_ANCHOR_MS, SEASON_LENGTH_MS, finalsWeek, seasonAt, seasonByNumber, seasonResetRating, seasonTitle } from '@ewa/content';
import { replayBattle } from '@ewa/core';
import type { SideChoice } from '@ewa/core';
import { ArenaState, REPLAY_BATTLE_ID } from '@ewa/protocol';
import type { SeatReservation, ServerMessage } from '@ewa/protocol';
import { replayOpts } from '../src/game/replay';
import { runSeasonRollover } from '../src/jobs/seasonRollover';
import { silentLogger } from '../src/log';
import { api, content, enter, ofType, rawQuery, register, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

describe('the season calendar (pure)', () => {
  it('four weeks from Monday 5 October 2026; the last seven days are Finals week', () => {
    expect(new Date(SEASON_ANCHOR_MS).toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(new Date(SEASON_ANCHOR_MS).getUTCDay()).toBe(1);
    expect(seasonAt(SEASON_ANCHOR_MS)).toEqual(seasonByNumber(1));
    expect(seasonAt(SEASON_ANCHOR_MS + SEASON_LENGTH_MS - 1).number).toBe(1);
    expect(seasonAt(SEASON_ANCHOR_MS + SEASON_LENGTH_MS).number).toBe(2);
    expect(seasonAt(SEASON_ANCHOR_MS - 1).number).toBe(0);
    const s1 = seasonByNumber(1);
    expect(new Date(s1.finalsAt).toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(finalsWeek(s1.finalsAt - 1)).toBe(false);
    expect(finalsWeek(s1.finalsAt)).toBe(true);
    expect(finalsWeek(s1.endsAt)).toBe(false);
  });

  it('a rating moves halfway back to 1000 (towards it); first is Champion, the top eight Finalists', () => {
    expect(seasonResetRating(1301)).toBe(1150);
    expect(seasonResetRating(899)).toBe(950);
    expect(seasonResetRating(1000)).toBe(1000);
    expect(seasonResetRating(1001)).toBe(1000);
    expect([1, 2, 8, 9, 0].map(seasonTitle)).toEqual(['champion', 'finalist', 'finalist', null, null]);
  });
});

async function rated(s: TestServer, playerId: string, result: 'win' | 'loss', at: number): Promise<void> {
  await s.repos.db.transaction((tx) =>
    s.repos.history.recordBattle(tx, {
      battleId: randomUUID(),
      playerId,
      opponent: 'someone',
      format: 'pvp',
      result,
      turns: 3,
      ratingDelta: result === 'win' ? 12 : -12,
      rewards: { money: 0, items: {}, trainerExp: 0, ratingDelta: result === 'win' ? 12 : -12, badge: null },
      seed: [1, 2, 3, 4],
      actions: [],
      happenedAt: new Date(at),
    }),
  );
}
const setRating = (s: TestServer, id: string, rating: number) => rawQuery(s.db, 'update players set rating = $2, peak_rating = $2 where id = $1', [id, rating]);
/** Polls `get` until `pred` holds (an async read; waitFor takes a sync predicate). */
async function until<T>(get: () => Promise<T>, pred: (v: T) => boolean, tries = 100): Promise<T> {
  let v = await get();
  for (let i = 0; i < tries && !pred(v); i++) {
    await new Promise((r) => setTimeout(r, 50));
    v = await get();
  }
  return v;
}
const ratingOf = async (s: TestServer, id: string) => Number((await rawQuery(s.db, 'select rating from players where id = $1', [id]))[0]!['rating']);

describe('seasons (server)', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  it('standings so far; the rollover closes the season once; the closed standings, titles and pulled-back ratings', async () => {
    const [x, y, z, viewer] = [await register(s), await register(s), await register(s), await register(s)];
    const season = seasonAt(s.time.clock());
    await setRating(s, x.id, 1200);
    await setRating(s, y.id, 1300);
    await setRating(s, z.id, 900);
    await rated(s, x.id, 'win', season.startsAt + 1000);
    await rated(s, x.id, 'loss', season.startsAt + 2000);
    await rated(s, y.id, 'win', season.startsAt + 3000);
    await rated(s, z.id, 'loss', season.startsAt + 4000);

    const before = (await api(s, 'GET', '/seasons', viewer.access)).body;
    expect(before.current).toMatchObject({ season: season.number, startsAt: new Date(season.startsAt).toISOString(), finals: finalsWeek(s.time.clock()) });
    expect(before.current.top).toEqual([
      { rank: 1, username: y.username, rating: 1300, wins: 1, losses: 0, title: 'champion' },
      { rank: 2, username: x.username, rating: 1200, wins: 1, losses: 1, title: 'finalist' },
      { rank: 3, username: z.username, rating: 900, wins: 0, losses: 1, title: 'finalist' },
    ]);
    expect(before.past).toEqual([]);
    expect((await api(s, 'GET', `/seasons/${season.number}`, viewer.access)).status).toBe(404);

    // the season ends
    s.time.advance(season.endsAt + 1000 - s.time.clock());
    const deps = { repos: s.repos, clock: s.time.clock, log: silentLogger() };
    const closed = await runSeasonRollover(deps);
    expect(closed.at(-1)).toBe(season.number);
    expect(await runSeasonRollover(deps)).toEqual([]);

    const after = (await api(s, 'GET', '/seasons', viewer.access)).body;
    expect(after.current).toMatchObject({ season: season.number + 1, top: [] });
    expect(after.past[0]).toMatchObject({ season: season.number, top: before.current.top });
    const standings = (await api(s, 'GET', `/seasons/${season.number}`, viewer.access)).body;
    expect(standings.rows.map((r: { username: string }) => r.username)).toEqual([y.username, x.username, z.username]);
    expect(await ratingOf(s, y.id)).toBe(1150);
    expect(await ratingOf(s, z.id)).toBe(950);
    expect((await api(s, 'GET', `/seasons/titles/${y.username}`, viewer.access)).body).toEqual({ username: y.username, titles: [{ season: season.number, rank: 1, title: 'champion' }] });
    expect((await api(s, 'GET', `/seasons/titles/${viewer.username}`, viewer.access)).body.titles).toEqual([]);
    expect((await api(s, 'GET', '/seasons/titles/nobody_here', viewer.access)).status).toBe(404);
  });
});

// ---- spectator mode ---------------------------------------------------------------------------------------------

interface Arena {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the SDK's room-type parameter is irrelevant here
  readonly room: SdkRoom<any, ArenaState>;
  readonly msgs: ServerMessage[];
}

describe('spectator mode (live)', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

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
  /** Queues both, matches them, and seats them in the arena; resolves once the battle started. */
  async function rankedMatch(a: { acc: Account; j: Joined }, b: { acc: Account; j: Joined }): Promise<[Arena, Arena]> {
    await api(s, 'POST', '/arena/queue', a.acc.access, { mode: 'ranked' });
    await api(s, 'POST', '/arena/queue', b.acc.access, { mode: 'ranked' });
    await s.booted.runtime.arena.tick();
    await waitFor(() => statuses(a.j.msgs).some((m) => m.state === 'matched') && statuses(b.j.msgs).some((m) => m.state === 'matched'), 8000);
    const out: Arena[] = [];
    for (const p of [a, b]) {
      const seat = statuses(p.j.msgs).find((m) => m.state === 'matched')!.seat as SeatReservation;
      await p.j.room.leave(true);
      out.push(await joinArena(p.acc, seat));
    }
    await waitFor(() => out.every((x) => ofType(x.msgs, 'battleStart').length > 0), 8000);
    return [out[0]!, out[1]!];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON response bodies are asserted field by field
  const reproduces = (feed: any): boolean =>
    replayBattle(replayOpts(REPLAY_BATTLE_ID, 'pvp', feed.replay.seed, feed.replay.start), feed.replay.actions as readonly (readonly [SideChoice, SideChoice])[], content).finalDigest === feed.replay.digest;

  it('the Finals are listed first; the feed is a replay a turn behind; the end publishes the whole fight', async () => {
    // Finals week of the running season (or the next one when it is already past)
    const now = s.time.clock();
    const cur = seasonAt(now);
    const target = now >= cur.finalsAt ? now : cur.finalsAt + 60_000;
    s.time.advance(target - now);
    const season = seasonAt(s.time.clock());
    const a = await online();
    const b = await online();
    const viewer = await register(s);
    await setRating(s, a.acc.id, 2000);
    await setRating(s, b.acc.id, 1990);
    await rated(s, a.acc.id, 'win', season.startsAt + 1000);
    await rated(s, b.acc.id, 'win', season.startsAt + 1000);
    expect((await api(s, 'GET', '/arena/live', viewer.access)).body.matches).toEqual([]);

    const [aa, ab] = await rankedMatch(a, b);
    const sa = ofType(aa.msgs, 'battleStart')[0]!;
    const list = await until(async () => (await api(s, 'GET', '/arena/live', viewer.access)).body.matches, (x) => x.length > 0);
    expect(list).toHaveLength(1);
    const m = list[0];
    expect(m).toMatchObject({ kind: 'ranked', finals: true, turn: 0, players: [{ name: a.acc.username, rating: 2000 }, { name: b.acc.username, rating: 1990 }] });
    const feedOf = async () => (await api(s, 'GET', `/arena/live/${m.matchId}`, viewer.access)).body;
    const first = await feedOf();
    expect(first.replay).toMatchObject({ format: 'pvp', seat: 0, labels: [a.acc.username, b.acc.username], actions: [] });
    expect(first.outcome).toBeNull();
    expect(JSON.stringify(first)).not.toContain(a.acc.id);
    expect(reproduces(first)).toBe(true);

    // each lead's status move when it has one (the fight should outlast two turns), else its first move
    const moveOf = (side: 0 | 1): string => {
      const moves = sa.state.sides[side].party[0]!.creature.moves;
      return (moves.find((mv) => content.move(mv.id).power === 0) ?? moves[0]!).id;
    };
    const ended = (): boolean => ofType(aa.msgs, 'battleEnd').length > 0;
    for (let turn = 1; turn <= 2 && !ended(); turn++) {
      aa.room.send('battleAction', { battleId: sa.battleId, turn, action: { kind: 'move', move: moveOf(0) } });
      ab.room.send('battleAction', { battleId: sa.battleId, turn, action: { kind: 'move', move: moveOf(1) } });
      await waitFor(() => ofType(aa.msgs, 'battleEvents').length >= turn || ended(), 8000);
      if (ended()) break;
      // a turn behind: after turn n the watchers see n - 1 turns
      const f = await until(feedOf, (x) => x.turn === turn - 1);
      expect(f.replay.actions).toHaveLength(turn - 1);
      expect(f.outcome).toBeNull();
      expect(reproduces(f)).toBe(true);
    }
    // a player leaving forfeits: the battle ends
    const aLeft = !ended();
    if (aLeft) await aa.room.leave(true);
    await waitFor(() => ofType(ab.msgs, 'battleEnd').length > 0, 8000);
    const outcome = ofType(ab.msgs, 'battleEnd')[0]!.outcome;
    const final = await until(feedOf, (x) => x.outcome !== null);
    expect(final.outcome).toEqual(outcome);
    expect(final.replay.actions.length).toBe(ofType(ab.msgs, 'battleEvents').length);
    expect(reproduces(final)).toBe(true);
    expect((await api(s, 'GET', '/arena/live', viewer.access)).body.matches).toEqual([]);
    expect((await api(s, 'GET', `/arena/live/${randomUUID()}`, viewer.access)).status).toBe(404);
    if (!aLeft) await aa.room.leave(true);
    await ab.room.leave(true);
  }, 120_000);

  it('a training battle is never listed', async () => {
    const a = await online();
    const viewer = await register(s);
    const seat = (await api(s, 'POST', '/arena/training', a.acc.access, { difficulty: 'easy', rules: 'level50' })).body;
    await a.j.room.leave(true);
    const arena = await joinArena(a.acc, seat.seat as SeatReservation);
    await waitFor(() => ofType(arena.msgs, 'battleStart').length > 0, 8000);
    expect((await api(s, 'GET', '/arena/live', viewer.access)).body.matches).toEqual([]);
    await arena.room.leave(true);
  }, 120_000);
});
