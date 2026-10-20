/**
 * Majin vs Tenjin seasons (content factions.ts, rest/routes/factions.ts): a trainer takes a side once a season (the
 * other side is 409 `alreadyJoined`, the same side again is fine); a mission claimed and a ranked win earn the side
 * its points (a raid clear is checked in raid.test.ts); GET /factions shows the totals, the best contributors, the
 * caller's side; the sky over Solenne and the Chronicle come from the closed seasons.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client as SdkClient } from '@colyseus/sdk';
import { FACTION_POINTS, seasonAt } from '@ewa/content';
import { ArenaState } from '@ewa/protocol';
import type { SeatReservation, ServerMessage } from '@ewa/protocol';
import { advanceQuests } from '../src/game/quests';
import { dayKey } from '../src/liveops/schedule';
import { dailyMissionsFor } from '../src/liveops/missions';
import { api, enter, ofType, register, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const season = () => seasonAt(s.time.clock()).number;
const pointsOf = async (id: string) => (await s.repos.db.transaction((tx) => s.repos.factions.of(tx, season(), id)))?.points ?? null;

describe('Majin vs Tenjin seasons', () => {
  it('a side once a season; GET /factions shows the totals, the best and your own', async () => {
    const a = await register(s);
    const b = await register(s);
    const first = (await api(s, 'GET', '/factions', a.access)).body;
    expect(first).toMatchObject({ season: season(), mine: null });
    expect(first.chronicle).toHaveLength(Math.min(6, season() - 1));
    const joined = await api(s, 'POST', '/factions/join', a.access, { side: 'majin' });
    expect(joined.status).toBe(200);
    expect(joined.body.mine).toEqual({ side: 'majin', points: 0 });
    expect(joined.body.members.majin).toBeGreaterThanOrEqual(1);
    const other = await api(s, 'POST', '/factions/join', a.access, { side: 'tenjin' });
    expect(other).toMatchObject({ status: 409, body: { code: 'alreadyJoined', side: 'majin' } });
    expect((await api(s, 'POST', '/factions/join', a.access, { side: 'majin' })).status).toBe(200);
    expect((await api(s, 'POST', '/factions/join', b.access, { side: 'neutral' })).status).toBe(400);
    await s.repos.db.transaction((tx) => s.repos.factions.award(tx, season(), a.id, 7));
    const after = (await api(s, 'GET', '/factions', b.access)).body;
    expect(after.mine).toBeNull();
    expect(after.top.majin).toContainEqual({ username: a.username, points: 7 });
    expect(after.points.majin).toBeGreaterThanOrEqual(7);
  });

  it("a mission claimed earns the side its point; a trainer with no side earns nothing", async () => {
    // the next day whose picks hold a catch mission (the server clock moves there)
    let now = s.time.clock();
    while (!dailyMissionsFor(dayKey(now)).some((m) => m.metric === 'catches')) now += 86_400_000;
    s.time.advance(now - s.time.clock());
    const mission = dailyMissionsFor(dayKey(now)).find((m) => m.metric === 'catches')!;
    const questId = `daily:${dayKey(now)}`;
    for (const side of ['tenjin', null] as const) {
      const acc = await register(s);
      if (side !== null) await api(s, 'POST', '/factions/join', acc.access, { side });
      await s.repos.db.transaction((tx) => advanceQuests(tx, s.repos, acc.id, Array.from({ length: mission.target }, () => ({ kind: 'catch' as const, species: 'glimp' })), now));
      expect((await api(s, 'POST', '/quests/claim', acc.access, { questId, objectiveId: mission.id })).status).toBe(200);
      expect(await pointsOf(acc.id)).toBe(side === null ? null : FACTION_POINTS.mission);
    }
  });

  it('a ranked win earns the winner side its points; the loser earns none', async () => {
    const online = async (): Promise<{ acc: Account; j: Joined }> => {
      const acc = await register(s);
      return { acc, j: await enter(s, acc, 'mirevale') };
    };
    const a = await online();
    const b = await online();
    await api(s, 'POST', '/factions/join', a.acc.access, { side: 'majin' });
    await api(s, 'POST', '/factions/join', b.acc.access, { side: 'tenjin' });
    await api(s, 'POST', '/arena/queue', a.acc.access, { mode: 'ranked' });
    await api(s, 'POST', '/arena/queue', b.acc.access, { mode: 'ranked' });
    await s.booted.runtime.arena.tick();
    const matched = (p: { j: Joined }) => ofType(p.j.msgs, 'arenaStatus').find((m) => m.state === 'matched');
    await waitFor(() => matched(a) !== undefined && matched(b) !== undefined, 8000);
    const arenas: { room: { send(t: string, m: unknown): void; leave(c: boolean): Promise<unknown> }; msgs: ServerMessage[] }[] = [];
    for (const p of [a, b]) {
      const seat = matched(p)!.seat as SeatReservation;
      await p.j.room.leave(true);
      const sdk = new SdkClient(s.wsUrl);
      sdk.auth.token = p.acc.access;
      const room = await sdk.consumeSeatReservation(seat as never, ArenaState);
      const msgs: ServerMessage[] = [];
      room.onMessage('*', (_t: string | number, m: unknown) => void msgs.push(m as ServerMessage));
      arenas.push({ room, msgs });
    }
    await waitFor(() => arenas.every((x) => ofType(x.msgs, 'battleStart').length > 0), 8000);
    const start = ofType(arenas[0]!.msgs, 'battleStart')[0]!;
    // a forfeits: b (Tenjin) wins
    arenas[0]!.room.send('battleAction', { battleId: start.battleId, turn: 1, action: { kind: 'forfeit' } });
    arenas[1]!.room.send('battleAction', { battleId: start.battleId, turn: 1, action: { kind: 'move', move: start.state.sides[1].party[0]!.creature.moves[0]!.id } });
    await waitFor(() => arenas.every((x) => ofType(x.msgs, 'battleEnd').length > 0), 8000);
    expect(ofType(arenas[1]!.msgs, 'battleEnd')[0]!.outcome).toEqual({ winner: 1 });
    expect(await pointsOf(b.acc.id)).toBe(FACTION_POINTS.rankedWin);
    expect(await pointsOf(a.acc.id)).toBe(0);
    for (const x of arenas) await x.room.leave(true);
  }, 60_000);

  it("the last closed season's winner holds the sky; the Chronicle tells it", async () => {
    const acc = await register(s);
    const before = season();
    // into the next season: the one before closes in the Chronicle
    const seasonNow = seasonAt(s.time.clock());
    s.time.advance(seasonNow.endsAt + 1000 - s.time.clock());
    const t = await s.repos.db.transaction((tx) => s.repos.factions.totals(tx, before));
    const sky = (await api(s, 'GET', '/factions/sky', acc.access)).body.sky;
    const winner = t.points.majin === t.points.tenjin ? null : t.points.majin > t.points.tenjin ? 'majin' : 'tenjin';
    expect(sky).toBe(winner);
    const view = (await api(s, 'GET', '/factions', acc.access)).body;
    expect(view.season).toBe(before + 1);
    expect(view.sky).toBe(winner);
    expect(view.chronicle[0]).toMatchObject({ season: before, winner });
    expect(view.chronicle[0].line).toContain(`Season ${before}:`);
    expect(view.mine).toBeNull();
  });
});
