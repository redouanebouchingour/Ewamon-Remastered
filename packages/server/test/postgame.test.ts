/**
 * Phase D14 — post-game. League rematches: the rematch team and ×1.5 reward, no badge / setsFlags, the
 * `league:<id>:rematchAt` cooldown (its set time moves on every win), refused before the Champion and inside the day.
 * The battle tower: the run (3 picks capped at Lv 50, healed, `noExp`, the stored creatures untouched), a win raises
 * the streak, the 7th win pays the set reward in the same transaction, a loss ends the run (current 0, best kept),
 * retiring likewise, the refusals; `GET /leaderboard?mode=towerStreak`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LEAGUE,
  LEAGUE_REMATCH,
  POSTGAME_FLAG,
  STORY,
  TOWER,
  beatDoneFlag,
  getHeightfield,
  interiorLeaders,
  league,
  leagueRematch,
  leagueRematchFlag,
  nearestWalkable,
  towerSetReward,
  towerTier,
  zone,
} from '@ewa/content';
import type { BadgeId, ZoneId } from '@ewa/content';
import { TRAINER_EXP, createRng } from '@ewa/core';
import type { BattleOutcome, BattleState } from '@ewa/core';
import type { AnyDb, Db, Repos } from '@ewa/persist';
import type { ServerMessage } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { silentLogger } from '../src/log';
import { createRoomMetrics } from '../src/metrics';
import { BattleCoordinator, autoAction } from '../src/rooms/battleSession';
import type { BattleHost, BattleSession } from '../src/rooms/battleSession';
import { TowerSessions, towerAttendant, towerPosition, towerTeam } from '../src/rooms/towerSession';
import { api, content, enter, ofType, openRepos, placePlayer, register, startServer, uniqueName, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let db: AnyDb;
let repos: Repos & { readonly db: Db };
let now = 1_950_000_000_000;

beforeAll(async () => {
  ({ db, repos } = await openRepos());
}, 120_000);
afterAll(async () => {
  await db?.close();
});

interface Rig {
  readonly msgs: Map<string, ServerMessage[]>;
  readonly battles: BattleCoordinator;
  tower: TowerSessions;
  readonly ended: Promise<void>[];
}
function rig(zoneId: ZoneId): Rig {
  const msgs = new Map<string, ServerMessage[]>();
  const send = (pid: string, m: ServerMessage): void => void (msgs.get(pid) ?? msgs.set(pid, []).get(pid)!).push(m);
  const r = { msgs, ended: [] as Promise<void>[] } as unknown as Rig;
  const host: BattleHost = {
    send,
    onStart: () => undefined,
    // the room's onEnd: a tower fight hands its result to the run
    onEnd: (session: BattleSession, outcome: BattleOutcome | 'void' | 'playerLeft') => {
      if (session.tower === true) r.ended.push(r.tower.onBattleEnd(session, outcome));
    },
    onProgress: () => undefined,
  };
  (r as { battles: BattleCoordinator }).battles = new BattleCoordinator(createRng(`d14:${zoneId}`), { repos, content, clock: () => now, log: silentLogger(), zone: zone(zoneId), host, metrics: createRoomMetrics('r', zoneId, 0) });
  r.tower = new TowerSessions({ repos, content, clock: () => now, log: silentLogger(), zoneId, battles: r.battles, send });
  return r;
}
const msgsOf = (r: Rig, pid: string): ServerMessage[] => r.msgs.get(pid) ?? [];
const last = <T extends ServerMessage['type']>(r: Rig, pid: string, t: T): Extract<ServerMessage, { type: T }> | undefined => ofType(msgsOf(r, pid), t).at(-1);

async function mkPlayer(party: { species: string; level: number }[]): Promise<{ id: string; creatureIds: string[] }> {
  return repos.db.transaction(async (tx) => {
    const name = uniqueName('pg');
    const { id } = await repos.players.create(tx, { username: name, email: `${name}@d14.test`, passwordHash: 'x' }, new Date(now));
    const creatureIds: string[] = [];
    for (let i = 0; i < party.length; i++) {
      const row = await repos.creatures.insert(tx, newCreature(content, party[i]!.species, party[i]!.level, { ownerId: id }), { kind: 'party', index: i });
      creatureIds.push(row.id);
    }
    return { id, creatureIds };
  });
}

async function settle(c: BattleCoordinator, id: string): Promise<void> {
  for (let i = 0; i < 400 && c.get(id)?.resolving; i++) await new Promise((r) => setTimeout(r, 5));
}

/** Plays the player's battle to its end with the first legal action each turn (switches when forced). */
async function playOut(c: BattleCoordinator, pid: string, patch?: (st: BattleState) => BattleState): Promise<void> {
  const s0 = c.ofPlayer(pid);
  if (s0 === null) throw new Error('no battle');
  if (patch !== undefined) s0.state = patch(s0.state);
  for (let guard = 0; guard < 150 && c.get(s0.id) !== null; guard++) {
    const s = c.get(s0.id)!;
    const err = c.action(pid, s.id, s.state.turn + 1, autoAction(s.state, 0, content));
    if (err !== null && err.detail !== 'actionNotRequired') throw new Error(`action refused: ${err.detail}`);
    await settle(c, s.id);
  }
  if (c.get(s0.id) !== null) throw new Error('battle did not end');
}

/**
 * A foe side that cannot hurt anyone and falls to one hit (the tower's win path, made deterministic whatever team the
 * run's random id draws): hp 1, last to move, a single self-targeting status move (damage reads the species' base
 * Attack, not `Battler.atk`, so only the moveset disarms a foe), and no ability or held item (an unknown ability id has
 * no hooks: Wonder Guard, Flash Fire and the like would otherwise wall the player's first move forever).
 */
const weakFoes = (st: BattleState): BattleState => ({
  ...st,
  sides: [
    st.sides[0],
    {
      ...st.sides[1],
      party: st.sides[1].party.map((b) => ({
        ...b,
        spd: 1,
        creature: { ...b.creature, hp: 1, ability: 'test:none', heldItem: null, moves: [{ id: 'Calm Mind', pp: 20, ppMax: 20 }] },
      })),
    },
  ],
});

const FIRE_100 = ['moblaze', 'pyrothal', 'infernomorel', 'solpyre', 'ignispectre', 'rexaloft'].map((species) => ({ species, level: 100 }));

describe('D14 league rematch content', () => {
  it('one rematch per league row: Lv 65–75, reward ×1.5, a legendary only where the original has it', () => {
    expect(LEAGUE_REMATCH.map((r) => r.leagueId).sort()).toEqual(LEAGUE.map((l) => l.id).sort());
    for (const r of LEAGUE_REMATCH) {
      const lt = league(r.leagueId);
      expect(r.reward).toBe(Math.round(lt.reward * 1.5));
      for (const m of r.team) {
        expect(m.level).toBeGreaterThanOrEqual(65);
        expect(m.level).toBeLessThanOrEqual(75);
        if (content.species(m.species).legendary) expect(lt.team.some((o) => o.species === m.species)).toBe(true);
      }
    }
  });
});

describe('D14 league rematch (coordinator)', () => {
  it('fights the rematch team; pays ×1.5 and the stage exp; no badge, no setsFlags; the cooldown flag is re-set on every win', async () => {
    const r = rig('mirevale');
    const { id: pid } = await mkPlayer(FIRE_100);
    const lt = league('verdant_gym');
    const rm = leagueRematch('verdant_gym');
    const res = await r.battles.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'league', league: lt, rematch: rm }, null, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    const start = last(r, pid, 'battleStart')!;
    expect(start.format).toBe('league');
    expect(start.state.sides[1].party.map((b) => [b.creature.speciesId, b.creature.level, b.creature.nickname])).toEqual(rm.team.map((m) => [m.species, m.level, m.nickname]));
    await playOut(r.battles, pid);
    const end = last(r, pid, 'battleEnd')!;
    expect(end.outcome).toEqual({ winner: 0 });
    expect(end.rewards).toMatchObject({ money: rm.reward, badge: null, trainerExp: TRAINER_EXP.gymWin });
    expect(await repos.db.transaction((tx) => repos.progress.badges(tx, pid))).toEqual([]);
    const flag = leagueRematchFlag('verdant_gym');
    const prog = ofType(msgsOf(r, pid), 'progressionDelta').filter((m) => m.flags !== null);
    expect(prog.flatMap((m) => m.flags ?? [])).toEqual([flag]);
    const first = await repos.db.transaction((tx) => repos.progress.flagSetAt(tx, pid, flag));
    expect(first?.getTime()).toBe(now);
    // a second win a day later moves the flag's set time
    now += 86_400_000 + 1;
    const res2 = await r.battles.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'league', league: lt, rematch: rm }, null, { x: 0, z: 0 });
    if (!res2.ok) throw new Error(res2.detail);
    await playOut(r.battles, pid);
    expect(last(r, pid, 'battleEnd')!.outcome).toEqual({ winner: 0 });
    expect((await repos.db.transaction((tx) => repos.progress.flagSetAt(tx, pid, flag)))?.getTime()).toBe(now);
  }, 60_000);

  it('a Warden rematch does not re-write its elite flag', async () => {
    const r = rig('solenne');
    const { id: pid } = await mkPlayer(['toxshade', 'aonred', 'infernomorel', 'velvetomb', 'darkyon', 'voidraith'].map((species) => ({ species, level: 100 })));
    const res = await r.battles.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'league', league: league('kirei'), rematch: leagueRematch('kirei') }, null, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    await playOut(r.battles, pid, weakFoes);
    const end = last(r, pid, 'battleEnd')!;
    expect(end.outcome).toEqual({ winner: 0 });
    const flags = ofType(msgsOf(r, pid), 'progressionDelta').flatMap((m) => m.flags ?? []);
    expect(flags).toEqual([leagueRematchFlag('kirei')]);
    expect(end.rewards.money).toBe(leagueRematch('kirei').reward);
  }, 60_000);
});

describe('D14 battle tower — pure rules', () => {
  it('generated teams: 3 distinct species from the streak tier pool, Lv 50, deterministic per seed', () => {
    for (const wins of [0, 6, 7, 14, 21, 60]) {
      const t = towerTeam(`seed:${wins}`, wins, content);
      expect(t).toHaveLength(TOWER.teamSize);
      expect(new Set(t.map((c) => c.speciesId)).size).toBe(TOWER.teamSize);
      for (const c of t) {
        expect(TOWER.pools[towerTier(wins)]).toContain(c.speciesId);
        expect(c.level).toBe(TOWER.levelCap);
        expect(content.species(c.speciesId).legendary).toBe(false);
      }
      expect(towerTeam(`seed:${wins}`, wins, content)).toEqual(t);
    }
    expect(towerTier(0)).toBe(0);
    expect(towerTier(7)).toBe(1);
    expect(towerTier(1000)).toBe(TOWER.pools.length - 1);
    expect(towerPosition(0)).toEqual({ set: 1, fight: 1 });
    expect(towerPosition(6)).toEqual({ set: 1, fight: 7 });
    expect(towerPosition(7)).toEqual({ set: 2, fight: 1 });
    expect(towerAttendant('solenne')).not.toBeNull();
    expect(towerAttendant('mirevale')).toBeNull();
  });
});

describe('D14 battle tower — runs (coordinator)', () => {
  const at = towerAttendant('solenne')!;
  const asker = (pid: string, over: Partial<{ flags: ReadonlySet<string>; x: number; z: number; busy: boolean }> = {}) => ({
    seat: { playerId: pid, sessionId: 's' },
    flags: over.flags ?? new Set([POSTGAME_FLAG]),
    x: over.x ?? at.x,
    z: over.z ?? at.z,
    busy: over.busy ?? false,
    at: { x: at.x, z: at.z },
  });

  it('refuses before the Champion, from afar, with picks outside the party, and a second start', async () => {
    const r = rig('solenne');
    const { id: pid, creatureIds } = await mkPlayer(FIRE_100.slice(0, 4));
    const errs = (): (string | null)[] => ofType(msgsOf(r, pid), 'error').map((e) => e.detail);
    await r.tower.start(asker(pid, { flags: new Set() }), creatureIds.slice(0, 3));
    await r.tower.start(asker(pid, { x: at.x + 6 }), creatureIds.slice(0, 3));
    await r.tower.start(asker(pid), [creatureIds[0]!, creatureIds[1]!, '00000000-0000-4000-8000-000000000000']);
    await r.tower.start(asker(pid), [creatureIds[0]!, creatureIds[0]!, creatureIds[1]!]);
    await r.tower.next(asker(pid));
    expect(errs()).toEqual(['locked', 'tooFar', 'badPicks', 'badPicks', 'noRun']);
    expect(r.battles.ofPlayer(pid)).toBeNull();
    await r.tower.start(asker(pid), creatureIds.slice(0, 3));
    expect(r.battles.ofPlayer(pid)).not.toBeNull();
    await r.tower.start(asker(pid), creatureIds.slice(0, 3));
    expect(errs().at(-1)).toBe('running');
    await r.tower.onLeave(pid);
    expect(r.tower.runOf(pid)).toBeNull();
  }, 60_000);

  it('seven wins: the streak climbs, the team fights capped at 50 with no exp, the 7th win pays the set reward; retiring keeps best', async () => {
    const r = rig('solenne');
    const { id: pid, creatureIds } = await mkPlayer(FIRE_100.slice(0, 4));
    const picks = creatureIds.slice(0, 3);
    const before = await repos.db.transaction((tx) => repos.creatures.party(tx, pid));
    await r.tower.start(asker(pid), picks);
    for (let k = 1; k <= TOWER.setLength; k++) {
      const start = last(r, pid, 'battleStart')!;
      expect(start.format).toBe('trainer');
      expect(start.state.noExp).toBe(true);
      expect(start.state.sides[0].party.map((b) => b.creature.level)).toEqual([50, 50, 50]);
      expect(start.state.sides[0].party.every((b) => b.creature.hp === b.maxHp)).toBe(true);
      expect(start.state.sides[1].trainerId).toBe(TOWER.trainerId);
      expect(last(r, pid, 'towerState')).toMatchObject({ phase: 'fighting', set: 1, fight: k, streak: k - 1 });
      await playOut(r.battles, pid, weakFoes);
      await Promise.all(r.ended);
      expect(last(r, pid, 'battleEnd')!.outcome).toEqual({ winner: 0 });
      const ts = last(r, pid, 'towerState')!;
      expect(ts).toMatchObject({ phase: 'won', streak: k, runWins: k, best: k, set: 1, fight: k });
      expect(await repos.db.transaction((tx) => repos.streaks.get(tx, pid))).toEqual({ current: k, best: k });
      if (k < TOWER.setLength) {
        expect(ts.reward).toBeNull();
        await r.tower.next(asker(pid));
      } else {
        const want = towerSetReward(1);
        expect(ts.reward).toEqual({ money: want.money, items: { ...want.items } });
        const end = last(r, pid, 'battleEnd')!;
        expect(end.rewards).toMatchObject({ money: want.money, items: want.items, trainerExp: 0 });
        const qty = await repos.db.transaction((tx) => repos.inventory.qty(tx, pid, 'rarecandy'));
        expect(qty).toBe(1);
      }
    }
    // no exp, no hp, no level written to the stored creatures, and no trainer flag for the tower opponent
    const after = await repos.db.transaction((tx) => repos.creatures.party(tx, pid));
    expect(after.map((c) => [c.id, c.level, c.exp, c.hp])).toEqual(before.map((c) => [c.id, c.level, c.exp, c.hp]));
    expect((await repos.db.transaction((tx) => repos.progress.flags(tx, pid))).some((f) => f.includes('tower'))).toBe(false);
    // retire: current 0, best 7
    await r.tower.quit(pid);
    expect(last(r, pid, 'towerState')).toMatchObject({ phase: 'ended', streak: 0, runWins: 7, best: 7 });
    expect(await repos.db.transaction((tx) => repos.streaks.get(tx, pid))).toEqual({ current: 0, best: 7 });
    expect(r.tower.runOf(pid)).toBeNull();
  }, 120_000);

  it('a loss ends the run: current 0, best kept', async () => {
    const r = rig('solenne');
    const { id: pid, creatureIds } = await mkPlayer(FIRE_100.slice(0, 3));
    await repos.db.transaction(async (tx) => {
      for (let i = 0; i < 9; i++) await repos.streaks.recordWin(tx, pid, new Date(now));
      await repos.streaks.endRun(tx, pid, new Date(now));
    });
    await r.tower.start(asker(pid), creatureIds);
    await playOut(r.battles, pid, weakFoes);
    await Promise.all(r.ended);
    expect(last(r, pid, 'towerState')).toMatchObject({ phase: 'won', streak: 1, best: 9 });
    await r.tower.next(asker(pid));
    // forfeit the second fight
    const s = r.battles.ofPlayer(pid)!;
    expect(r.battles.action(pid, s.id, s.state.turn + 1, { kind: 'forfeit' })).toBeNull();
    await settle(r.battles, s.id);
    await Promise.all(r.ended);
    expect(last(r, pid, 'battleEnd')!.outcome).toEqual({ winner: 1 });
    expect(last(r, pid, 'towerState')).toMatchObject({ phase: 'lost', streak: 0, runWins: 1, best: 9, set: 1, fight: 2 });
    expect(await repos.db.transaction((tx) => repos.streaks.get(tx, pid))).toEqual({ current: 0, best: 9 });
    expect(r.tower.runOf(pid)).toBeNull();
  }, 60_000);

  it('items are refused inside a tower fight', async () => {
    const r = rig('solenne');
    const { id: pid, creatureIds } = await mkPlayer(FIRE_100.slice(0, 3));
    await repos.db.transaction((tx) => repos.inventory.addMany(tx, pid, { potion: 3 }));
    await r.tower.start(asker(pid), creatureIds);
    const s = r.battles.ofPlayer(pid)!;
    expect(r.battles.action(pid, s.id, s.state.turn + 1, { kind: 'item', item: 'potion', target: 0 })).toMatchObject({ code: 'notAllowed' });
    await r.tower.onLeave(pid);
  }, 60_000);
});

// ─── the real room + REST ─────────────────────────────────────────────────────

describe('D14 through the room and REST', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  });

  async function inZone(zoneId: ZoneId, x: number, z: number, acc: Account): Promise<Joined> {
    const p = nearestWalkable(getHeightfield(zoneId), x, z, 12)!;
    await placePlayer(s, acc.id, zoneId, p[0], p[1]);
    return enter(s, acc, zoneId);
  }
  /** Every story beat done, all eight badges, and optionally the Wardens + Champion flags. */
  async function progressed(acc: Account, champion: boolean): Promise<void> {
    await s.repos.db.transaction(async (tx) => {
      const t = new Date(s.time.clock() - 3 * 86_400_000);
      for (const b of ['bloom', 'ember', 'current', 'circuit', 'fault', 'wraith', 'anvil', 'ascend'] as BadgeId[]) await s.repos.progress.awardBadge(tx, acc.id, b, t);
      await s.repos.progress.setFlags(tx, acc.id, [...STORY.map((b) => beatDoneFlag(b.id)), ...STORY.flatMap((b) => b.set)], t);
      if (champion) await s.repos.progress.setFlags(tx, acc.id, ['elite:veil:beaten', 'elite:aurelia:beaten', 'elite:kirei:beaten', POSTGAME_FLAG], t);
    });
  }

  it('a beaten gym leader refuses before the Champion, offers a rematch after it, and holds the day cooldown', async () => {
    const mira = interiorLeaders('mirevale').find((l) => l.leagueId === 'verdant_gym')!;
    const before = await register(s);
    await progressed(before, false);
    const j0 = await inZone('mirevale', mira.x, mira.z + 2, before);
    j0.room.send('interact', { kind: 'gym', targetId: 'verdant_gym' });
    await waitFor(() => ofType(j0.msgs, 'error').length > 0, 5000);
    expect(ofType(j0.msgs, 'toast').map((t) => t.text)).toContain('You already hold this badge.');
    expect(ofType(j0.msgs, 'battleStart')).toEqual([]);
    await j0.room.leave(true);

    const acc = await register(s);
    await progressed(acc, true);
    await s.repos.db.transaction((tx) => s.repos.progress.setFlags(tx, acc.id, [leagueRematchFlag('verdant_gym')], new Date(s.time.clock())));
    const j = await inZone('mirevale', mira.x, mira.z + 2, acc);
    j.room.send('interact', { kind: 'gym', targetId: 'verdant_gym' });
    await waitFor(() => ofType(j.msgs, 'error').length > 0, 5000);
    expect(ofType(j.msgs, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'leagueLocked' });
    expect(ofType(j.msgs, 'toast').at(-1)?.text).toMatch(/rematch/);
    s.time.advance(86_400_000 + 1_000);
    j.room.send('interact', { kind: 'gym', targetId: 'verdant_gym' });
    await waitFor(() => ofType(j.msgs, 'battleStart').length > 0, 5000);
    const start = ofType(j.msgs, 'battleStart')[0]!;
    expect(start.format).toBe('league');
    expect(start.state.sides[1].party.map((b) => b.creature.speciesId)).toEqual(leagueRematch('verdant_gym').team.map((m) => m.species));
    await j.room.leave(true);
  }, 90_000);

  it('the tower attendant in Solenne: tower start runs a capped fight; GET /leaderboard?mode=towerStreak ranks best streaks', async () => {
    const acc = await register(s);
    await progressed(acc, true);
    const at = towerAttendant('solenne')!;
    const j = await inZone('solenne', at.x + 1, at.z, acc);
    const party = await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, acc.id));
    // the starter only: the picks must be three party creatures
    j.room.send('tower', { action: 'start', picks: [party[0]!.id, 'x', 'y'] });
    await waitFor(() => ofType(j.msgs, 'error').length > 0, 5000);
    expect(ofType(j.msgs, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'badPicks' });
    await s.repos.db.transaction(async (tx) => {
      for (let i = 1; i < 3; i++) await s.repos.creatures.insert(tx, newCreature(content, 'mufflo', 30, { ownerId: acc.id }), { kind: 'party', index: i });
    });
    const ids = (await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, acc.id))).map((c) => c.id);
    j.room.send('tower', { action: 'start', picks: ids.slice(0, 3) });
    await waitFor(() => ofType(j.msgs, 'battleStart').length > 0, 5000);
    expect(ofType(j.msgs, 'towerState')[0]).toMatchObject({ phase: 'fighting', set: 1, fight: 1, streak: 0 });
    expect(ofType(j.msgs, 'battleStart')[0]!.state.noExp).toBe(true);
    await j.room.leave(true);
    await waitFor(() => true);

    const other = await register(s);
    await s.repos.db.transaction(async (tx) => {
      for (let i = 0; i < 12; i++) await s.repos.streaks.recordWin(tx, other.id, new Date());
      for (let i = 0; i < 3; i++) await s.repos.streaks.recordWin(tx, acc.id, new Date());
    });
    const lb = await api(s, 'GET', '/leaderboard?mode=towerStreak', acc.access);
    expect(lb.status).toBe(200);
    const rows = lb.body.rows as { id: string; towerBest: number; towerCurrent: number; rank: number }[];
    const mine = rows.find((x) => x.id === acc.id)!;
    const theirs = rows.find((x) => x.id === other.id)!;
    expect(theirs.towerBest).toBe(12);
    expect(mine.towerBest).toBe(3);
    expect(theirs.rank).toBeLessThan(mine.rank);
    const rating = await api(s, 'GET', '/leaderboard?mode=rating', acc.access);
    expect((rating.body.rows as { id: string; towerBest: number }[]).find((x) => x.id === other.id)?.towerBest).toBe(12);
  }, 90_000);
});
