/**
 * Phase D5 — achievements on the server: one quest code path (`advanceQuests`) auto-progresses the
 * `kind: 'achievement'` rows from every event source — catch (count, alpha / shiny tier, the absolute dex count),
 * battle win, trade, raid clear, daily-login streak — and `POST /quests/claim` pays them. The trade and raid
 * sources are asserted end to end in `challenge-trade.test.ts` / `raid.test.ts` ("Phase D5" lines).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { zone } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { AnyDb, Db, Repos } from '@ewa/persist';
import type { QuestProgressEntry, ServerMessage } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { absoluteValue, advanceQuests, target } from '../src/game/quests';
import { dailyLogin } from '../src/liveops/login';
import { DAY_MS, dayKey } from '../src/liveops/schedule';
import { silentLogger } from '../src/log';
import { createRoomMetrics } from '../src/metrics';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { api, content, openRepos, register, startServer, uniqueName } from './helpers';
import type { TestServer } from './helpers';

const now = 1_800_000_000_000;

function entry(list: readonly QuestProgressEntry[], questId: string): QuestProgressEntry | undefined {
  return list.find((p) => p.questId === questId);
}

describe('objective maths', () => {
  it('targets of the new kinds; dexCaught / loginStreak read the event value, nothing else does', () => {
    expect(target({ kind: 'dexCaught', count: 60 })).toBe(60);
    expect(target({ kind: 'loginStreak', days: 7 })).toBe(7);
    expect(target({ kind: 'catchTier', tier: 'shiny', count: 1 })).toBe(1);
    expect(target({ kind: 'completeTrades', count: 10 })).toBe(10);
    expect(target({ kind: 'clearRaids', count: 10 })).toBe(10);
    expect(absoluteValue({ kind: 'dexCaught', count: 60 }, { kind: 'dex', caught: 41 })).toBe(41);
    expect(absoluteValue({ kind: 'loginStreak', days: 7 }, { kind: 'streak', days: 3 })).toBe(3);
    expect(absoluteValue({ kind: 'dexCaught', count: 60 }, { kind: 'streak', days: 3 })).toBeNull();
    expect(absoluteValue({ kind: 'catchSpecies', count: 10 }, { kind: 'dex', caught: 41 })).toBeNull();
  });
});

describe('event sources (repos + BattleCoordinator)', () => {
  let db: AnyDb;
  let repos: Repos & { readonly db: Db };
  beforeAll(async () => {
    ({ db, repos } = await openRepos());
  }, 120_000);
  afterAll(async () => {
    await db?.close();
  });

  async function mkPlayer(items: Record<string, number> = {}): Promise<string> {
    return repos.db.transaction(async (tx) => {
      const name = uniqueName('ach');
      const { id } = await repos.players.create(tx, { username: name, email: `${name}@a.test`, passwordHash: 'x' }, new Date(now));
      await repos.creatures.insert(tx, newCreature(content, 'bramblecub', 30, { ownerId: id }), { kind: 'party', index: 0 });
      if (Object.keys(items).length > 0) await repos.inventory.addMany(tx, id, items);
      return id;
    });
  }

  function coordinator(msgs: ServerMessage[]): BattleCoordinator {
    const host: BattleHost = { send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
    return new BattleCoordinator(createRng('ach'), { repos, content, clock: () => now, log: silentLogger(), zone: zone('mire_route'), host, metrics: createRoomMetrics('r', 'mire_route', 0) });
  }

  const spawn = (over: Partial<SpawnRecord> = {}): SpawnRecord => ({
    id: `mire_route:${Math.floor(Math.random() * 1e9)}`, speciesId: 'mossling', level: 3, variantKey: 'normal', isAlpha: false,
    ability: content.species('mossling').abilities[0]!, medium: 'land', x: 0, z: 0, bornAt: 0, engagedBy: null, engagedAt: null, despawnAt: 1e15, ...over,
  });

  async function settle(c: BattleCoordinator, id: string): Promise<void> {
    for (let i = 0; i < 300 && c.get(id)?.resolving; i++) await new Promise((r) => setTimeout(r, 5));
  }

  const progressOf = (msgs: ServerMessage[]): QuestProgressEntry[] =>
    msgs.flatMap((m) => (m.type === 'progressionDelta' && m.questProgress !== null ? m.questProgress : []));

  it('a catch advances first catch, the alpha / shiny tiers and the absolute dex count', async () => {
    const msgs: ServerMessage[] = [];
    const c = coordinator(msgs);
    const pid = await mkPlayer({ aether_orb: 1 });
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn({ isAlpha: true, isShiny: true }), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    expect(c.action(pid, res.session.id, 1, { kind: 'catch', orb: 'aether_orb' })).toBeNull();
    await settle(c, res.session.id);
    const p = progressOf(msgs);
    expect(entry(p, 'ach_catch_1')).toMatchObject({ count: 1, done: true });
    expect(entry(p, 'ach_catch_10')).toMatchObject({ count: 1, done: false });
    expect(entry(p, 'ach_alpha_1')).toMatchObject({ done: true });
    expect(entry(p, 'ach_shiny_1')).toMatchObject({ done: true });
    // the starter is not in the dex here (direct insert), so the record holds exactly the catch
    expect(entry(p, 'ach_dex_10')).toMatchObject({ count: 1, done: false });
    expect(entry(p, 'ach_win_10')).toMatchObject({ count: 1, done: false }); // a catch is a wild win (§30.4.3)
  }, 120_000);

  it('a KO win advances the win counters (wild + any), not the catch counters', async () => {
    const msgs: ServerMessage[] = [];
    const c = coordinator(msgs);
    const pid = await mkPlayer();
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn({ level: 2 }), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    for (let i = 0; i < 20 && c.get(res.session.id) !== null; i++) {
      const st = c.get(res.session.id)!.state;
      const b = st.sides[0].party[st.sides[0].active]!;
      const mv = b.creature.moves.find((m) => m.pp > 0 && content.move(m.id).power > 0) ?? b.creature.moves.find((m) => m.pp > 0)!;
      expect(c.action(pid, res.session.id, st.turn + 1, { kind: 'move', move: mv.id })).toBeNull();
      await settle(c, res.session.id);
    }
    const p = progressOf(msgs);
    expect(entry(p, 'ach_win_10')).toMatchObject({ count: 1 });
    expect(entry(p, 'ach_catch_1')).toBeUndefined();
  }, 120_000);

  it('absolute objectives max-merge: a lower dex value never lowers progress, an equal one writes nothing', async () => {
    const pid = await mkPlayer();
    const t1 = await repos.db.transaction((tx) => advanceQuests(tx, repos, pid, [{ kind: 'dex', caught: 12 }], now));
    expect(entry(t1, 'ach_dex_10')).toMatchObject({ count: 10, done: true });
    expect(entry(t1, 'ach_dex_30')).toMatchObject({ count: 12, done: false });
    const t2 = await repos.db.transaction((tx) => advanceQuests(tx, repos, pid, [{ kind: 'dex', caught: 5 }], now));
    expect(entry(t2, 'ach_dex_30')).toBeUndefined();
    const t3 = await repos.db.transaction((tx) => advanceQuests(tx, repos, pid, [{ kind: 'dex', caught: 31 }, { kind: 'trade' }, { kind: 'raidClear' }], now));
    expect(entry(t3, 'ach_dex_30')).toMatchObject({ count: 30, done: true });
    expect(entry(t3, 'ach_dex_60')).toMatchObject({ count: 31, done: false });
    expect(entry(t3, 'ach_trade_1')).toMatchObject({ done: true });
    expect(entry(t3, 'ach_trade_10')).toMatchObject({ count: 1, done: false });
    expect(entry(t3, 'ach_raid_1')).toMatchObject({ done: true });
    const rows = await repos.db.transaction((tx) => repos.progress.quest(tx, pid, 'ach_dex_60'));
    expect(rows).toEqual([expect.objectContaining({ count: 31, done: false })]);
  });

  it('the daily login grant reports the streak: day 7 completes ach_streak_7', async () => {
    const pid = await mkPlayer();
    const yesterday = dayKey(now - DAY_MS);
    await repos.db.transaction((tx) => repos.progress.setFlags(tx, pid, ['streak:6', `streak:last:${yesterday}`], new Date(now - DAY_MS)));
    const g = await repos.db.transaction((tx) => dailyLogin(tx, repos, pid, now));
    expect(g!.streak).toBe(7);
    expect(entry(g!.questProgress, 'ach_streak_7')).toMatchObject({ count: 7, done: true });
    expect(entry(g!.questProgress, 'ach_streak_30')).toMatchObject({ count: 7, done: false });
    // the same day again grants nothing
    expect(await repos.db.transaction((tx) => dailyLogin(tx, repos, pid, now + 1000))).toBeNull();
  });
});

describe('claim (REST)', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  it('a done achievement is claimable once through POST /quests/claim; an undone one is questIncomplete; /me lists it', async () => {
    const acc = await register(s);
    const before = (await api(s, 'GET', '/me', acc.access)).body;
    expect(before.quests.some((q: { id: string }) => q.id === 'ach_trade_1')).toBe(true);
    expect((await api(s, 'POST', '/quests/claim', acc.access, { questId: 'ach_trade_1' })).status).toBe(409);
    await s.repos.db.transaction((tx) => advanceQuests(tx, s.repos, acc.id, [{ kind: 'trade' }], Date.now()));
    const r = await api(s, 'POST', '/quests/claim', acc.access, { questId: 'ach_trade_1' });
    expect(r.status).toBe(200);
    expect(r.body.money).toBe(before.money + 500);
    expect(r.body.inventory.potion).toBe((before.inventory.potion ?? 0) + 3);
    const again = await api(s, 'POST', '/quests/claim', acc.access, { questId: 'ach_trade_1' });
    expect(again.status).toBe(409);
    const me = (await api(s, 'GET', '/me', acc.access)).body;
    expect(me.quests.find((q: { id: string }) => q.id === 'ach_trade_1').claimed).toBe(true);
  }, 60_000);
});
