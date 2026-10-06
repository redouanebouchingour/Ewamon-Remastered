/**
 * Phase D6 — doubles battle sessions. A trainer authored `doubles: true` (≥ 2 creatures) fights 2-on-2 when the player
 * has two usable creatures, else the battle falls back to singles. One `battleAction` per field position (`pos`; absent
 * = the lowest position still waiting); the turn resolves when every required position is in; deadlines auto-fill
 * only the missing positions; a doubles battle replays from its `battle_history` row (`start.slots`). One case drives
 * the real room (Colyseus + REST): interact with a doubles route trainer, two `battleAction { pos }` per turn, win.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getHeightfield, league, nearestWalkable, zone } from '@ewa/content';
import type { TrainerDef, ZoneId } from '@ewa/content';
import { chooseNpcDoubles, createBattle, createRng, digestBattleState, resolveTurn } from '@ewa/core';
import type { Action, BattleState, CreateBattleOpts, RngState, SideChoice } from '@ewa/core';
import type { AnyDb, Db, Repos } from '@ewa/persist';
import type { ServerMessage } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { silentLogger } from '../src/log';
import { createRoomMetrics } from '../src/metrics';
import { LIMITS } from '../src/rest/rateLimit';
import { BattleCoordinator, TURN_DEADLINE_MS, autoPair } from '../src/rooms/battleSession';
import type { BattleHost, BattleSession } from '../src/rooms/battleSession';
import { content, enter, ofType, openRepos, placePlayer, register, startServer, uniqueName, waitFor } from './helpers';
import type { TestServer } from './helpers';

let db: AnyDb;
let repos: Repos & { readonly db: Db };
let now = 1_900_000_000_000;

beforeAll(async () => {
  ({ db, repos } = await openRepos());
}, 120_000);
afterAll(async () => {
  await db?.close();
});

interface Recorder extends BattleHost {
  readonly msgs: Map<string, ServerMessage[]>;
}
function recorder(): Recorder {
  const msgs = new Map<string, ServerMessage[]>();
  return {
    msgs,
    send: (pid, m) => void (msgs.get(pid) ?? msgs.set(pid, []).get(pid)!).push(m),
    onStart: () => undefined,
    onEnd: () => undefined,
    onProgress: () => undefined,
  };
}
function coordinator(host: Recorder, zoneId: ZoneId = 'galvan_route', seed = 'd6'): BattleCoordinator {
  return new BattleCoordinator(createRng(seed), { repos, content, clock: () => now, log: silentLogger(), zone: zone(zoneId), host, metrics: createRoomMetrics('r', zoneId, 0) });
}
async function mkPlayer(party: { species: string; level: number; hp?: number }[]): Promise<string> {
  return repos.db.transaction(async (tx) => {
    const name = uniqueName('d');
    const { id } = await repos.players.create(tx, { username: name, email: `${name}@d.test`, passwordHash: 'x' }, new Date(now));
    for (let i = 0; i < party.length; i++) {
      const c = newCreature(content, party[i]!.species, party[i]!.level, { ownerId: id });
      await repos.creatures.insert(tx, party[i]!.hp === undefined ? c : { ...c, hp: party[i]!.hp! }, { kind: 'party', index: i });
    }
    await repos.inventory.addMany(tx, id, { potion: 3 });
    return id;
  });
}
const msgsOf = (h: Recorder, pid: string): ServerMessage[] => h.msgs.get(pid) ?? [];
async function settle(c: BattleCoordinator, id: string): Promise<void> {
  for (let i = 0; i < 200 && c.get(id)?.resolving; i++) await new Promise((r) => setTimeout(r, 5));
}
const trainer = (zoneId: ZoneId, id: string): TrainerDef => zone(zoneId).trainers.find((t) => t.id === id)!;
const STRONG = [
  { species: 'thornback', level: 45 },
  { species: 'caldermole', level: 45 },
  { species: 'bogmaw', level: 45 },
];

describe('D6 doubles sessions (coordinator)', () => {
  it('a doubles route trainer + two usable creatures → slots 2; per-position actions; win, reward, flag; replays from history', async () => {
    const host = recorder();
    const c = coordinator(host);
    const t = trainer('galvan_route', 'galvan_route.rocker');
    expect(t.doubles).toBe(true);
    const pid = await mkPlayer(STRONG);
    const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'trainer', trainer: t, rematch: false }, null, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    const start = msgsOf(host, pid).find((m): m is Extract<ServerMessage, { type: 'battleStart' }> => m.type === 'battleStart')!;
    expect(start.state.slots).toBe(2);
    expect(start.state.sides[0].actives).toEqual([0, 1]);
    expect(start.state.sides[1].actives).toEqual([0, 1]);
    expect(res.session.start.slots).toBe(2);
    const rng = createRng('d6-player');
    let client: BattleState = start.state;
    let desyncs = 0;
    for (let guard = 0; guard < 80 && c.get(res.session.id) !== null; guard++) {
      const s = c.get(res.session.id)!;
      const pair = chooseNpcDoubles(s.state, 0, content, rng);
      const before = msgsOf(host, pid).length;
      const preview = resolveTurn(client, [pair, null], content).state;
      for (const p of [0, 1] as const) if (pair[p] !== null) expect(c.action(pid, s.id, s.state.turn + 1, pair[p]!, p)).toBeNull();
      await settle(c, s.id);
      const ev = msgsOf(host, pid).slice(before).find((m): m is Extract<ServerMessage, { type: 'battleEvents' }> => m.type === 'battleEvents')!;
      if (ev.stateDigest !== digestBattleState(preview)) desyncs++;
      client = c.get(res.session.id)?.state ?? preview;
    }
    expect(desyncs).toBe(0);
    const end = msgsOf(host, pid).find((m): m is Extract<ServerMessage, { type: 'battleEnd' }> => m.type === 'battleEnd')!;
    expect(end).toMatchObject({ outcome: { winner: 0 }, rewards: { money: t.reward } });
    const flags = await repos.db.transaction((tx) => repos.progress.flags(tx, pid));
    expect(flags).toContain(`trainer:${t.id}:beaten`);
    const row = (await repos.db.transaction((tx) => repos.history.battleById(tx, pid, res.session.id)))!;
    expect(row.start!.slots).toBe(2);
    const opts: CreateBattleOpts = {
      id: row.battleId,
      format: row.format,
      zoneId: row.start!.zoneId,
      terrain: row.start!.terrain as CreateBattleOpts['terrain'],
      seed: row.seed as RngState,
      sides: row.start!.sides as CreateBattleOpts['sides'],
      slots: 2,
    };
    let replay = createBattle(opts, content).state;
    for (const acts of row.actions) replay = resolveTurn(replay, acts as [SideChoice, SideChoice], content).state;
    expect(digestBattleState(replay)).toBe(row.finalDigest);
    expect(row.actions.every((a) => a[1] === null)).toBe(true); // the NPC side never acted
  }, 60_000);

  it('singles fallback: only one usable creature → a singles battle (no slots / actives)', async () => {
    const host = recorder();
    const c = coordinator(host);
    const pid = await mkPlayer([{ species: 'thornback', level: 45 }, { species: 'bogmaw', level: 45, hp: 0 }]);
    const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'trainer', trainer: trainer('galvan_route', 'galvan_route.rocker'), rematch: false }, null, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    expect(res.session.state.slots).toBeUndefined();
    expect('actives' in res.session.state.sides[0]).toBe(false);
    expect(res.session.start.slots).toBeUndefined();
    expect(res.session.pending).toEqual([null, null]);
  });

  it('league doubles (draco_gym) starts 2-on-2; a plain trainer stays singles', async () => {
    const host = recorder();
    const c = coordinator(host, league('draco_gym').zoneId);
    const pid = await mkPlayer(STRONG);
    const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'league', league: league('draco_gym') }, null, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    expect(res.session.state.slots).toBe(2);
    const host2 = recorder();
    const c2 = coordinator(host2);
    const pid2 = await mkPlayer(STRONG);
    const plain = await c2.startNpc({ playerId: pid2, sessionId: 's' }, { kind: 'trainer', trainer: trainer('galvan_route', 'galvan_route.guard'), rematch: false }, null, { x: 0, z: 0 });
    if (!plain.ok) throw new Error(plain.detail);
    expect(plain.session.state.slots).toBeUndefined();
  });

  it('per-position rules: absent pos fills the lowest waiting position; alreadySubmitted; duplicate switch; bad target; deadline fills the rest', async () => {
    const host = recorder();
    const c = coordinator(host);
    const pid = await mkPlayer([...STRONG, { species: 'glimp', level: 20 }]);
    const res = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'trainer', trainer: trainer('galvan_route', 'galvan_route.rocker'), rematch: false }, null, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    const s: BattleSession = res.session;
    const turn = s.state.turn + 1;
    const m0 = s.state.sides[0].party[0]!.creature.moves[0]!.id;
    const self: Action = { kind: 'move', move: m0, target: { side: 0, pos: 0 } };
    expect(c.action(pid, s.id, turn, self, 0)).toEqual({ code: 'notAllowed', detail: 'badTarget' });
    expect(c.action(pid, s.id, turn, { kind: 'switch', to: 2 })).toBeNull(); // no pos → position 0
    expect(s.pending[0]).toEqual([{ kind: 'switch', to: 2 }, null]);
    expect(c.action(pid, s.id, turn, { kind: 'switch', to: 3 }, 0)).toEqual({ code: 'notAllowed', detail: 'alreadySubmitted' });
    expect(c.action(pid, s.id, turn, { kind: 'switch', to: 2 }, 1)).toEqual({ code: 'notAllowed', detail: 'switchToActive' });
    expect(s.resolving).toBe(false); // one of two positions in: nothing resolves yet
    now += TURN_DEADLINE_MS + 1;
    await c.tick(now);
    await settle(c, s.id);
    expect(s.actionsLog).toHaveLength(1);
    const first = s.actionsLog[0]![0] as readonly (Action | null)[];
    expect(first[0]).toEqual({ kind: 'switch', to: 2 });
    expect(first[1]).not.toBeNull(); // the deadline auto-filled position 1 only
    expect(autoPair(s.state, 0, content).filter((x) => x !== null).length).toBeGreaterThan(0);
  });
});

describe('D6 doubles through the room', () => {
  it('limiter: in a SINGLES battle `pos: 1` buys no extra window — the 5th battleAction within a second is refused', async () => {
    expect(LIMITS.battleActionPos1).toEqual(LIMITS.battleAction);
    const t = trainer('mire_route', 'mire_route.bug_catcher');
    const acc = await register(srv);
    const p = nearestWalkable(getHeightfield('mire_route'), t.x, t.z - 2, 12)!;
    await placePlayer(srv, acc.id, 'mire_route', p[0], p[1]);
    const j = await enter(srv, acc, 'mire_route');
    j.room.send('interact', { kind: 'npc', targetId: t.id });
    await waitFor(() => ofType(j.msgs, 'battleStart').length > 0, 10_000);
    const start = ofType(j.msgs, 'battleStart')[0]!;
    expect(start.state.slots).toBeUndefined();
    // wrong-turn spam alternating pos 0 / 1: all five share the singles window
    for (let i = 0; i < 5; i++) j.room.send('battleAction', { battleId: start.battleId, turn: 99, action: { kind: 'flee' }, pos: (i % 2) as 0 | 1 });
    await waitFor(() => ofType(j.msgs, 'error').some((e) => e.code === 'rateLimited'), 5_000);
    expect(ofType(j.msgs, 'error').filter((e) => e.code === 'notAllowed')).toHaveLength(4);
    await j.room.leave(true);
  }, 60_000);

  let srv: TestServer;
  beforeAll(async () => {
    srv = await startServer();
  }, 120_000);
  afterAll(async () => {
    await srv?.stop();
  }, 60_000);

  it('interact with a doubles route trainer → battleStart slots 2; two battleAction { pos } per turn play it out', async () => {
    const t = trainer('galvan_route', 'galvan_route.rocker');
    const acc = await register(srv);
    await srv.repos.db.transaction(async (tx) => {
      for (const [i, m] of STRONG.entries()) {
        if (i === 0) continue;
        await srv.repos.creatures.insert(tx, newCreature(content, m.species, m.level, { ownerId: acc.id }), { kind: 'party', index: i });
      }
      for (const b of ['bloom', 'ember', 'current'] as const) await srv.repos.progress.awardBadge(tx, acc.id, b, new Date());
    });
    const p = nearestWalkable(getHeightfield('galvan_route'), t.x, t.z - 2, 12)!;
    await placePlayer(srv, acc.id, 'galvan_route', p[0], p[1]);
    const j = await enter(srv, acc, 'galvan_route');
    j.room.send('interact', { kind: 'npc', targetId: t.id });
    await waitFor(() => ofType(j.msgs, 'battleStart').length > 0, 10_000);
    const start = ofType(j.msgs, 'battleStart')[0]!;
    expect(start.state.slots).toBe(2);
    let state = start.state;
    const rng = createRng('room-d6');
    for (let guard = 0; guard < 60 && ofType(j.msgs, 'battleEnd').length === 0; guard++) {
      const seen = ofType(j.msgs, 'battleEvents').length;
      const pair = chooseNpcDoubles(state, 0, content, rng);
      // a real client's burst: both positions' actions in the same tick, back to back (position 1 has its own
      // limiter window in a doubles battle, so neither is dropped even at ~3 turns per second)
      for (const pos of [0, 1] as const) {
        const a = pair[pos];
        if (a !== null) j.room.send('battleAction', { battleId: start.battleId, turn: state.turn + 1, action: a, pos });
      }
      // follow the server through any NPC-only replacement it resolves on its own (one battleEvents each)
      let st = resolveTurn(state, [pair, null], content).state;
      let n = 1;
      while (st.ended === null && st.sides[1].mustSwitch && !st.sides[0].mustSwitch) {
        st = resolveTurn(st, [null, null], content).state;
        n++;
      }
      await waitFor(() => ofType(j.msgs, 'battleEvents').length >= seen + n, 10_000);
      expect(ofType(j.msgs, 'error')).toEqual([]);
      const last = ofType(j.msgs, 'battleEvents').at(-1)!;
      expect(last.stateDigest).toBe(digestBattleState(st));
      state = st;
      await new Promise((r) => setTimeout(r, 300)); // a fast but human turn pace: ~3 turns (6 battleActions) per second
    }
    const end = ofType(j.msgs, 'battleEnd')[0]!;
    expect(end.outcome).toEqual({ winner: 0 });
    await j.room.leave(true);
  }, 120_000);
});
