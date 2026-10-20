/**
 * The daily challenge: the day's teams are fixed by the day alone (three distinct species each, level 50, disjoint
 * sides) and differ from day to day; the number counts from the first daily; the strip marks KOs per turn. End to end:
 * GET /daily shows the puzzle; POST /daily/start seats the player in an arena room whose battle is the day's teams on
 * the day's seed (two players get the same start, ids aside); playing it out records the try (and a win as the best,
 * with its turns and strip, on the daily leaderboard); nothing about the player's own creatures changes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client as SdkClient } from '@colyseus/sdk';
import type { Room as SdkRoom } from '@colyseus/sdk';
import { canonicalJson, resolveTurn } from '@ewa/core';
import type { Action, BattleEvent, BattleState } from '@ewa/core';
import { ArenaState, DAILY_TEAM_SIZE, DailyRes } from '@ewa/protocol';
import type { SeatReservation, ServerMessage } from '@ewa/protocol';
import { DAILY_LEVEL, DAILY_TRAINER, dailyMarks, dailyNumber, dailyPuzzle, dailySeed } from '../src/game/daily';
import { dayKey } from '../src/liveops/schedule';
import { api, content, enter, ofType, rawQuery, register, startServer, waitFor } from './helpers';
import type { Account } from './helpers';
import type { TestServer } from './helpers';

describe('the daily challenge, pure', () => {
  it('teams come from the day alone: three distinct species a side, level 50, disjoint; another day differs', () => {
    const a = dailyPuzzle('2026-10-20', content);
    expect(canonicalJson(a)).toBe(canonicalJson(dailyPuzzle('2026-10-20', content)));
    expect(a.team).toHaveLength(DAILY_TEAM_SIZE);
    expect(a.foe).toHaveLength(DAILY_TEAM_SIZE);
    const species = [...a.team, ...a.foe].map((c) => c.speciesId);
    expect(new Set(species).size).toBe(DAILY_TEAM_SIZE * 2);
    expect([...a.team, ...a.foe].every((c) => c.level === DAILY_LEVEL && c.ownerId === null)).toBe(true);
    expect(a.team.map((c) => c.id)).toEqual(['daily:me:0', 'daily:me:1', 'daily:me:2']);
    expect(a.foe.map((c) => c.id)).toEqual(['daily:foe:0', 'daily:foe:1', 'daily:foe:2']);
    const days = ['2026-10-21', '2026-10-22', '2026-10-23'].map((d) => canonicalJson(dailyPuzzle(d, content).team.map((c) => c.speciesId)));
    expect(new Set([canonicalJson(a.team.map((c) => c.speciesId)), ...days]).size).toBeGreaterThan(1);
    expect(dailySeed('2026-10-20')).toBe('daily:2026-10-20');
  });

  it('every day of a quarter is winnable: the core trainer AI wins it for the team, in `par` turns', () => {
    for (let d = 0; d < 90; d++) {
      const day = new Date(Date.UTC(2026, 9, 20) + d * 86_400_000).toISOString().slice(0, 10);
      const p = dailyPuzzle(day, content);
      expect(p.par, day).not.toBeNull();
      expect(p.par!).toBeGreaterThan(0);
    }
  });

  it('numbers count UTC days from the first daily; the strip marks each turn', () => {
    expect(dailyNumber('2026-10-20')).toBe(1);
    expect(dailyNumber('2026-11-19')).toBe(31);
    const st = (turn: number) => ({ turn }) as BattleState;
    const faint = (side: 0 | 1): BattleEvent => ({ t: 'faint', who: { side, slot: 0 } });
    const steps = [
      { state: st(1), events: [] },
      { state: st(2), events: [faint(1)] },
      { state: st(2), events: [] }, // a replacement step: same turn
      { state: st(3), events: [faint(0)] },
      { state: st(4), events: [faint(0), faint(1)] },
    ];
    expect(dailyMarks(steps, 0)).toBe('.KLX');
    expect(dailyMarks(steps, 1)).toBe('.LKX');
  });
});

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the SDK's room-type parameter is irrelevant here
type ArenaRoom = SdkRoom<any, ArenaState>;

async function joinArena(acc: Account, seat: SeatReservation): Promise<{ room: ArenaRoom; msgs: ServerMessage[] }> {
  const sdk = new SdkClient(s.wsUrl);
  sdk.auth.token = acc.access;
  const room = (await sdk.consumeSeatReservation(seat as never, ArenaState)) as ArenaRoom;
  const msgs: ServerMessage[] = [];
  room.onMessage('*', (_t: string | number, payload: unknown) => void msgs.push(payload as ServerMessage));
  return { room, msgs };
}

/** Starts today's daily for a fresh player and waits for its battleStart. */
async function startDaily(): Promise<{ acc: Account; room: ArenaRoom; msgs: ServerMessage[]; start: Extract<ServerMessage, { type: 'battleStart' }> }> {
  const acc = await register(s);
  const j = await enter(s, acc, 'mirevale');
  const r = await api(s, 'POST', '/daily/start', acc.access, {});
  expect(r.status).toBe(200);
  await j.room.leave(true);
  const ar = await joinArena(acc, r.body.seat as SeatReservation);
  await waitFor(() => ofType(ar.msgs, 'battleStart').length > 0, 8000);
  return { acc, ...ar, start: ofType(ar.msgs, 'battleStart')[0]! };
}

/** The player's choice: the strongest move with pp, or the first standing creature when it must switch. */
function choose(st: BattleState): Action {
  const side = st.sides[0];
  if (side.mustSwitch) return { kind: 'switch', to: side.party.findIndex((b, i) => i !== side.active && b.creature.hp > 0) };
  const moves = side.party[side.active]!.creature.moves.filter((m) => m.pp > 0);
  const best = [...moves].sort((a, b) => content.move(b.id).power - content.move(a.id).power)[0]!;
  return { kind: 'move', move: best.id };
}

describe('the daily challenge, end to end', () => {
  it('GET /daily, a start on the day’s teams and seed, a played try recorded (a win as the best, on the leaderboard)', async () => {
    const today = dayKey(Date.now());
    const first = await register(s);
    const info = await api(s, 'GET', '/daily', first.access);
    expect(info.status).toBe(200);
    expect(DailyRes.safeParse(info.body).success).toBe(true);
    const { team, foe } = dailyPuzzle(today, content);
    expect(info.body).toMatchObject({ dayKey: today, number: dailyNumber(today), attempts: 0, best: null, foeName: DAILY_TRAINER.name, par: dailyPuzzle(today, content).par });
    expect(info.body.team.map((c: { speciesId: string }) => c.speciesId)).toEqual(team.map((c) => c.speciesId));
    expect(info.body.foe.map((c: { speciesId: string }) => c.speciesId)).toEqual(foe.map((c) => c.speciesId));

    const a = await startDaily();
    const b = await startDaily();
    const strip = (st: BattleState) => canonicalJson({ ...st, id: 'x', sides: st.sides.map((sd) => ({ ...sd, trainerId: 'x' })) });
    expect(strip(a.start.state)).toBe(strip(b.start.state));
    expect(a.start.state.sides[0].party.map((p) => p.creature.speciesId)).toEqual(team.map((c) => c.speciesId));
    expect(a.start.state.sides[1]).toMatchObject({ kind: 'npc', trainerId: DAILY_TRAINER.id });
    const creatures = JSON.stringify(await rawQuery(s.db, 'select * from creature_instances where owner_id = $1 order by id', [a.acc.id]));

    // play it out, resolving locally (the null-passing convention) to know the next choice
    let st = a.start.state;
    let expected = ofType(a.msgs, 'battleEvents').length;
    for (let guard = 0; guard < 120 && st.ended === null; guard++) {
      const action = choose(st);
      a.room.send('battleAction', { battleId: a.start.battleId, turn: st.turn + 1, action });
      st = resolveTurn(st, [action, null], content).state;
      expected += 1;
      // a replacement only the AI must make: the server resolves it at once (one more battleEvents)
      while (st.ended === null && st.sides[1].mustSwitch && !st.sides[0].mustSwitch) {
        st = resolveTurn(st, [null, null], content).state;
        expected += 1;
      }
      await waitFor(() => ofType(a.msgs, 'battleEvents').length >= expected, 8000);
      expect(ofType(a.msgs, 'battleEvents').at(-1)!.turn).toBe(st.turn);
      await new Promise((r) => setTimeout(r, 260)); // battleAction is limited to 4 / s
    }
    await waitFor(() => ofType(a.msgs, 'battleEnd').length > 0, 8000);
    const end = ofType(a.msgs, 'battleEnd')[0]!;
    expect(end.rewards).toMatchObject({ money: 0, trainerExp: 0, ratingDelta: null });
    const after = (await api(s, 'GET', '/daily', a.acc.access)).body;
    expect(after.attempts).toBe(1);
    const won = end.outcome.winner === 0;
    if (won) {
      expect(after.best).toMatchObject({ turns: st.turn, battleId: a.start.battleId });
      expect(after.best.marks).toHaveLength(st.turn);
      const board = (await api(s, 'GET', '/leaderboard?mode=daily', a.acc.access)).body.rows;
      expect(board.some((r: { id: string; dailyTurns?: number }) => r.id === a.acc.id && r.dailyTurns === st.turn)).toBe(true);
    } else {
      expect(after.best).toBeNull();
    }
    expect(JSON.stringify(await rawQuery(s.db, 'select * from creature_instances where owner_id = $1 order by id', [a.acc.id]))).toBe(creatures);
    const hist = (await api(s, 'GET', '/history/battles', a.acc.access)).body.rows;
    expect(hist[0]).toMatchObject({ battleId: a.start.battleId, arena: 'daily', opponent: DAILY_TRAINER.id });
    await a.room.leave(true);
    await b.room.leave(true);
  }, 180_000);
});
