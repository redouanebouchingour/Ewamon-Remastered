/**
 * A recurring rival (content rival.ts, game/rival.ts, LLM feature 7): the gates (routes only, a badge, no story beat
 * waiting, nothing holding the player, the cooldown), the seeded roll, the stored identity and the team (deterministic,
 * scaled to the player, its signature evolving with the badges, leading by the record), where it steps out; with
 * `RIVAL=always` it arms on a route, steps out after a walk, holds the player and its interact starts the fight with
 * the team it announced; the battle end records the meeting (a win pays like a route trainer, a loss costs nothing
 * more), with an audit row; GET /rival and POST /rival/words; `RIVAL=off` (testEnv) changes nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BADGE_ORDER,
  RIVAL_CHANCE,
  RIVAL_COOLDOWN_MS,
  RIVAL_SPAWN_M,
  RIVAL_WALK_ALWAYS_M,
  RIVAL_WALK_M,
  encounterTableFor,
  getHeightfield,
  isWalkable,
  rivalReward,
  rivalTrainerId,
  zone as zoneById,
} from '@ewa/content';
import type { BadgeId, ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { ServerMessage } from '@ewa/protocol';
import { RivalRes } from '@ewa/protocol';
import type { Rival } from '@ewa/persist';
import { createRoomMetrics } from '../src/metrics';
import { silentLogger } from '../src/log';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import { lineOfSight } from '../src/rooms/encounters';
import { cleanWords, newRivalIdentity, playerStarter, rivalCooldownMs, rivalRefusal, rivalRoll, rivalSpawnPoint, rivalTeam, rivalView } from '../src/game/rival';
import type { RivalGateInput } from '../src/game/rival';
import { api, content, enter, ofType, placePlayer, rawQuery, register, sleep, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

const ZONE: ZoneId = 'mire_route';
const H = getHeightfield(ZONE);
const NOW = Date.UTC(2026, 9, 24, 12);
const D = String.fromCharCode(0x2014);

const rival = (over: Partial<Rival> = {}): Rival => ({
  playerId: 'p1', name: 'Corin', look: 'casual2_male', temperament: 'brash', signature: 'cindercap',
  playerWins: 0, rivalWins: 0, draws: 0, meetings: 0, lastResult: null, lastZone: null, lastMetAt: null, lastTeam: [], lastWords: null, nextAt: null,
  createdAt: new Date(NOW),
  ...over,
});

describe('the gates and the roll', () => {
  const base: RivalGateInput = { mode: 'on', zoneKind: 'route', inInterior: false, badges: 1, beatPending: false, busy: false, nextAt: null, now: NOW };

  it('come on a route, after a badge, with no beat waiting, nothing holding the player and the cooldown over', () => {
    expect(rivalRefusal(base)).toBeNull();
    expect(rivalRefusal({ ...base, mode: 'off' })).toBe('off');
    expect(rivalRefusal({ ...base, zoneKind: 'town' })).toBe('notRoute');
    expect(rivalRefusal({ ...base, zoneKind: 'story' })).toBe('notRoute');
    expect(rivalRefusal({ ...base, inInterior: true })).toBe('interior');
    expect(rivalRefusal({ ...base, badges: 0 })).toBe('badges');
    expect(rivalRefusal({ ...base, beatPending: true })).toBe('storyBeat');
    expect(rivalRefusal({ ...base, busy: true })).toBe('busy');
    expect(rivalRefusal({ ...base, nextAt: NOW + 1 })).toBe('cooldown');
    expect(rivalRefusal({ ...base, nextAt: NOW })).toBeNull();
    // always: every gate but the cooldown
    expect(rivalRefusal({ ...base, mode: 'always', nextAt: NOW + 1 })).toBeNull();
    expect(rivalRefusal({ ...base, mode: 'always', badges: 0 })).toBe('badges');
    expect(rivalCooldownMs('on')).toBe(RIVAL_COOLDOWN_MS);
    expect(rivalCooldownMs('always')).toBe(0);
  });

  it('rolls the same in an hour, again for a new meeting or hour, at about RIVAL_CHANCE, within the walk', () => {
    expect(rivalRoll('on', 'w', 'p', 0, ZONE, NOW)).toBe(rivalRoll('on', 'w', 'p', 0, ZONE, NOW + 60_000));
    expect(rivalRoll('off', 'w', 'p', 0, ZONE, NOW)).toBeNull();
    expect(rivalRoll('always', 'w', 'p', 0, ZONE, NOW)).toBe(RIVAL_WALK_ALWAYS_M);
    let hits = 0;
    for (let i = 0; i < 2000; i++) {
      const w = rivalRoll('on', 'w', `p${i}`, i % 5, ZONE, NOW + (i % 7) * 3_600_000);
      if (w === null) continue;
      hits += 1;
      expect(w).toBeGreaterThanOrEqual(RIVAL_WALK_M[0]);
      expect(w).toBeLessThanOrEqual(RIVAL_WALK_M[1]);
    }
    expect(Math.abs(hits / 2000 - RIVAL_CHANCE)).toBeLessThan(0.05);
  });
});

describe('identity and team', () => {
  it('takes the starter strong against the player starter (the gift, else the first starter line)', () => {
    expect(playerStarter([{ speciesId: 'mossling', caughtAt: { zoneId: ZONE, at: 1 } }, { speciesId: 'pyrecap', caughtAt: null }])).toBe('cindercap');
    expect(playerStarter([{ speciesId: 'briarbear', caughtAt: { zoneId: ZONE, at: 1 } }])).toBe('bramblecub');
    expect(playerStarter([{ speciesId: 'mossling', caughtAt: null }])).toBeNull();
    expect(newRivalIdentity('w', 'p', 'glimfin').signature).toBe('bramblecub');
    expect(newRivalIdentity('w', 'p', 'glimfin')).toEqual(newRivalIdentity('w', 'p', 'glimfin'));
  });

  it('is deterministic, scaled to the player and evolves with the badges', () => {
    const r = rival();
    expect(rivalTeam(r, 1, 14, ZONE)).toEqual(rivalTeam(r, 1, 14, ZONE));
    const land = new Set(encounterTableFor(ZONE)!.slots.map((s) => s.species));
    for (const badges of [1, 3, 6, 8]) {
      const t = rivalTeam(r, badges, 30, ZONE);
      expect(t.length).toBeGreaterThanOrEqual(2);
      expect(new Set(t.map((m) => m.speciesId)).size).toBe(t.length);
      for (const m of t.slice(1)) {
        expect(land.has(m.speciesId)).toBe(true);
        expect(m.level).toBeLessThan(t[0]!.level);
        expect(m.level).toBeGreaterThanOrEqual(t[0]!.level - 3);
      }
    }
    expect(rivalTeam(r, 1, 14, ZONE)[0]).toEqual({ speciesId: 'cindercap', level: 15 });
    expect(rivalTeam(r, 3, 24, ZONE)[0]!.speciesId).toBe('pyrecap');
    expect(rivalTeam(r, 7, 40, ZONE)[0]!.speciesId).toBe('infernomorel');
    expect(rivalTeam(r, 8, 40, ZONE).length).toBeGreaterThan(rivalTeam(r, 1, 40, ZONE).length);
    // ahead in the record: two above the player's strongest; behind: level with it
    expect(rivalTeam(rival({ rivalWins: 2, meetings: 2 }), 1, 14, ZONE)[0]!.level).toBe(16);
    expect(rivalTeam(rival({ playerWins: 2, meetings: 2 }), 1, 14, ZONE)[0]!.level).toBe(14);
    // a new meeting draws its other creatures again
    const others = new Set(Array.from({ length: 8 }, (_, i) => JSON.stringify(rivalTeam(rival({ meetings: i }), 4, 20, ZONE).slice(1))));
    expect(others.size).toBeGreaterThan(1);
  });

  it('shows the arc, the record and the last meeting', () => {
    const v = rivalView(rival({ playerWins: 2, rivalWins: 1, meetings: 3, lastResult: 'won', lastZone: ZONE, lastMetAt: new Date(NOW), lastWords: 'Next time.' }), 2, [{ speciesId: 'cindercap', level: 12 }]);
    expect(v).toMatchObject({ arc: 'frustrated', record: { playerWins: 2, rivalWins: 1, draws: 0, meetings: 3 }, last: { result: 'won', zoneId: ZONE, words: 'Next time.' } });
    expect(rivalView(rival(), 6, []).arc).toBe('respectful');
    expect(rivalView(rival(), 1, []).last).toBeNull();
  });

  it('steps out on walkable ground with a clear line to the player', () => {
    const z = zoneById(ZONE);
    const p = rivalSpawnPoint(H, [], z.spawn.x, z.spawn.z, 0, () => false);
    expect(p).not.toBeNull();
    expect(isWalkable(H, p!.x, p!.z)).toBe(true);
    expect(lineOfSight(H, [], p!.x, p!.z, z.spawn.x, z.spawn.z)).toBe(true);
    expect(Math.hypot(p!.x - z.spawn.x, p!.z - z.spawn.z)).toBeLessThanOrEqual(RIVAL_SPAWN_M + 0.01);
    expect(rivalSpawnPoint(H, [], z.spawn.x, z.spawn.z, 0, () => true)).toBeNull();
  });

  it('cleans the parting words', () => {
    expect(cleanWords(`  Next time ${D} I win.\n`, 200)).toBe('Next time, I win.');
    expect(cleanWords('x'.repeat(300), 200)).toHaveLength(200);
  });
});

// ---- integration ---------------------------------------------------------------------------------------------------

/** A walkable spot of the zone with `len` m of walkable ground straight ahead (+x). */
function openLine(len: number): { x: number; z: number } {
  const rng = createRng('rival-line');
  for (let i = 0; i < 4000; i++) {
    const x = -90 + rng.next() * 180;
    const z = -90 + rng.next() * 180;
    let ok = true;
    for (let d = 0; d <= len && ok; d += 0.25) ok = isWalkable(H, x + d, z);
    if (ok) return { x, z };
  }
  throw new Error('no open line');
}

async function withBadge(s: TestServer, acc: Account, n = 1): Promise<void> {
  await s.repos.db.transaction(async (tx) => {
    for (const b of BADGE_ORDER.slice(0, n) as BadgeId[]) await s.repos.progress.awardBadge(tx, acc.id, b, new Date());
  });
}

function me(j: Joined, acc: Account): { x: number; z: number; seq: number } {
  return j.room.state.players.get(acc.id)!;
}

async function step(j: Joined, acc: Account, x: number, z: number): Promise<boolean> {
  const p = me(j, acc);
  const seq = p.seq + 1;
  j.room.send('input', { seq, x, z, angle: Math.atan2(x - p.x, z - p.z), running: true, dtMs: 50 });
  await waitFor(() => me(j, acc).seq >= seq, 3000);
  await sleep(55);
  const q = me(j, acc);
  return Math.hypot(q.x - x, q.z - z) < 0.05;
}

describe('RIVAL=always (integration)', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer({ RIVAL: 'always' });
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  it('arms on a route, steps out after a walk, holds the player, and its interact starts the fight it announced', async () => {
    const acc = await register(s, 'glimfin');
    await withBadge(s, acc);
    const at = openLine(10);
    await placePlayer(s, acc.id, ZONE, at.x, at.z);
    const j = await enter(s, acc, ZONE);
    await sleep(500);
    // armed on the join, announced with the first accepted move
    expect(ofType(j.msgs, 'rival')).toHaveLength(0);
    await step(j, acc, me(j, acc).x + 0.35, me(j, acc).z);
    await waitFor(() => ofType(j.msgs, 'rival').length > 0, 5000);
    const near = ofType(j.msgs, 'rival')[0]!;
    expect(near.phase).toBe('near');
    expect(near.rival).toMatchObject({ signature: 'bramblecub', arc: 'cocky', record: { meetings: 0 }, last: null });
    expect(near.rival.team[0]!.speciesId).toBe('bramblecub');
    const row = await s.repos.db.transaction((tx) => s.repos.rivals.of(tx, acc.id));
    expect(row).toMatchObject({ name: near.rival.name, look: near.rival.look, signature: 'bramblecub' });

    const approached = (): boolean => ofType(j.msgs, 'rival').some((m) => m.phase === 'approach');
    for (let i = 0; i < 40 && !approached(); i++) await step(j, acc, me(j, acc).x + 0.35, me(j, acc).z);
    await waitFor(approached, 3000);
    const ap = ofType(j.msgs, 'rival').find((m) => m.phase === 'approach')!;
    expect(ap.rival.team).toEqual(near.rival.team);
    expect(isWalkable(H, ap.x, ap.z)).toBe(true);
    // held like a spotted player
    const p = me(j, acc);
    expect(await step(j, acc, p.x + 0.3, p.z)).toBe(false);
    j.room.send('interact', { kind: 'npc', targetId: rivalTrainerId(near.rival.name) });
    await waitFor(() => ofType(j.msgs, 'battleStart').length > 0, 5000);
    const start = ofType(j.msgs, 'battleStart')[0]!;
    expect(start.format).toBe('trainer');
    expect(start.state.sides[1].trainerId).toBe(rivalTrainerId(near.rival.name));
    expect(start.state.sides[1].party.map((b) => ({ speciesId: b.creature.speciesId, level: b.creature.level }))).toEqual(near.rival.team);
    await j.room.leave(true);
  }, 120_000);

  it('never comes before the first badge', async () => {
    const acc = await register(s);
    const at = openLine(10);
    await placePlayer(s, acc.id, ZONE, at.x, at.z);
    const j = await enter(s, acc, ZONE);
    for (let i = 0; i < 20; i++) await step(j, acc, me(j, acc).x + 0.35, me(j, acc).z);
    await sleep(300);
    expect(ofType(j.msgs, 'rival')).toHaveLength(0);
    expect(await s.repos.db.transaction((tx) => s.repos.rivals.of(tx, acc.id))).toBeNull();
    await j.room.leave(true);
  }, 120_000);

  it('never comes in a town', async () => {
    const acc = await register(s);
    await withBadge(s, acc);
    const j = await enter(s, acc, 'mirevale');
    await sleep(800);
    expect(ofType(j.msgs, 'rival')).toHaveLength(0);
    await j.room.leave(true);
  }, 60_000);

  it('the battle end records the meeting: a win pays like a route trainer, a loss only counts; GET /rival and the words', async () => {
    const acc = await register(s);
    await withBadge(s, acc, 2);
    const ensure = await s.repos.db.transaction((tx) => s.repos.rivals.ensure(tx, acc.id, newRivalIdentity('w', acc.id, 'bramblecub'), new Date(s.time.clock())));
    expect((await api(s, 'GET', '/rival', acc.access)).body).toEqual({ enabled: true, rival: null });
    const msgs: ServerMessage[] = [];
    const host: BattleHost = { send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
    const c = new BattleCoordinator(createRng('rival'), { repos: s.repos, content, clock: s.time.clock, log: silentLogger(), zone: zoneById(ZONE), host, metrics: createRoomMetrics('r', ZONE, 0) });
    const fight = async (team: { speciesId: string; level: number }[]): Promise<Extract<ServerMessage, { type: 'battleEnd' }>> => {
      msgs.length = 0;
      const res = await c.startRival({ playerId: acc.id, sessionId: 's' }, { name: ensure.name, team, cooldownMs: RIVAL_COOLDOWN_MS }, { x: 0, z: 0 });
      if (!res.ok) throw new Error(res.detail);
      expect(res.session.state.sides[1].trainerId).toBe(rivalTrainerId(ensure.name));
      for (let i = 0; i < 60 && c.get(res.session.id) !== null; i++) {
        const st = c.get(res.session.id)!.state;
        const b = st.sides[0].party[st.sides[0].active]!;
        const mv = b.creature.moves.find((m) => m.pp > 0 && content.move(m.id).power > 0) ?? b.creature.moves.find((m) => m.pp > 0)!;
        c.action(acc.id, res.session.id, st.turn + 1, { kind: 'move', move: mv.id });
        for (let k = 0; k < 300 && c.get(res.session.id)?.resolving; k++) await sleep(5);
      }
      const end = msgs.find((m): m is Extract<ServerMessage, { type: 'battleEnd' }> => m.type === 'battleEnd');
      if (end === undefined) throw new Error('no end');
      return end;
    };
    const money = async (): Promise<number> => Number((await rawQuery(s.db, 'select money from players where id = $1', [acc.id]))[0]!.money);

    const before = await money();
    const win = await fight([{ speciesId: 'glimfin', level: 2 }]);
    expect(win.outcome).toEqual({ winner: 0 });
    expect(win.rewards.money).toBe(rivalReward(2));
    expect(await money()).toBe(before + rivalReward(2));
    let r = await s.repos.db.transaction((tx) => s.repos.rivals.of(tx, acc.id));
    expect(r).toMatchObject({ playerWins: 1, rivalWins: 0, meetings: 1, lastResult: 'won', lastZone: ZONE, lastTeam: [{ speciesId: 'glimfin', level: 2 }] });
    expect(r!.nextAt!.getTime()).toBeGreaterThanOrEqual(s.time.clock() + RIVAL_COOLDOWN_MS - 5_000);
    // no content flag: the rival comes back
    expect((await rawQuery(s.db, "select flag from story_flags where player_id = $1 and flag like 'trainer:rival:%'", [acc.id])).length).toBe(0);
    expect((await rawQuery(s.db, "select detail from audit_log where actor_id = $1 and action = 'rival.battle'", [acc.id])).length).toBe(1);

    const mid = await money();
    const loss = await fight([{ speciesId: 'cindercap', level: 60 }]);
    expect(loss.outcome).toEqual({ winner: 1 });
    expect(loss.rewards.money).toBe(0);
    expect(await money()).toBe(mid);
    r = await s.repos.db.transaction((tx) => s.repos.rivals.of(tx, acc.id));
    expect(r).toMatchObject({ playerWins: 1, rivalWins: 1, meetings: 2, lastResult: 'lost' });
    c.dispose();

    const view = (await api(s, 'GET', '/rival', acc.access)).body;
    RivalRes.parse(view);
    expect(view.rival).toMatchObject({ name: ensure.name, record: { playerWins: 1, rivalWins: 1, meetings: 2 }, last: { result: 'lost', zoneId: ZONE, words: null }, team: [{ speciesId: 'cindercap', level: 60 }] });
    const said = await api(s, 'POST', '/rival/words', acc.access, { text: `Told you ${D} I win.` });
    expect(said.status).toBe(200);
    expect(said.body.rival.last.words).toBe('Told you, I win.');
    expect((await api(s, 'POST', '/rival/words', acc.access, { text: 'Again?' })).body).toMatchObject({ code: 'rivalNoMeeting' });
    expect((await rawQuery(s.db, "select 1 from audit_log where actor_id = $1 and action = 'rival.words'", [acc.id])).length).toBe(1);
  }, 120_000);
});

describe('RIVAL=off (testEnv)', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  it('never arms, and the routes say so', async () => {
    const acc = await register(s);
    await withBadge(s, acc, 3);
    const at = openLine(10);
    await placePlayer(s, acc.id, ZONE, at.x, at.z);
    const j = await enter(s, acc, ZONE);
    for (let i = 0; i < 20; i++) await step(j, acc, me(j, acc).x + 0.35, me(j, acc).z);
    await sleep(300);
    expect(ofType(j.msgs, 'rival')).toHaveLength(0);
    expect(await s.repos.db.transaction((tx) => s.repos.rivals.of(tx, acc.id))).toBeNull();
    await j.room.leave(true);
    expect((await api(s, 'GET', '/rival', acc.access)).body).toEqual({ enabled: false, rival: null });
    expect((await api(s, 'POST', '/rival/words', acc.access, { text: 'Hi.' })).body).toMatchObject({ code: 'rivalOff' });
  }, 120_000);
});
