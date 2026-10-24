/**
 * The rumour board (LLM feature 8): the facts a town's crier calls out (`buildRumours`, pure and deterministic), the
 * market's swings, the town's gossip about the caller, the per-day cache, and `GET /world/rumours/:zoneId`: yesterday's
 * badges by name, today's raids and swarm, the caller's deeds in the town, the same world facts all day, a new board
 * the next day, 404 off a town, 409 with `NPC_TOOLS=off`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DAILY_SWARMS, RAID_HOTSPOTS, rumourZones } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { Bounty, NpcMemory } from '@ewa/persist';
import { RUMOUR_GOSSIP_MAX, RUMOUR_TEXT_MAX, RUMOUR_WORLD_MAX, RumoursRes } from '@ewa/protocol';
import { DAY_MS } from '../src/liveops/schedule';
import { EMPTY_WORLD, RumourBoard, buildRumours, dayStartOf, gossipRumours, marketSwings } from '../src/game/rumours';
import type { RumourWorld } from '../src/game/rumours';
import { api, enter, register, startServer } from './helpers';
import type { TestServer } from './helpers';

const DASH = String.fromCharCode(0x2014);
const DAY = Date.UTC(2026, 9, 21); // a Wednesday
const at = (ms: number): Date => new Date(ms);

const bounty = (id: string, zoneId: string, reward: number, extra: Partial<Bounty> = {}): Bounty => ({
  id,
  kind: 'game',
  targetId: `t-${id}`,
  targetName: `Ghost ${id}`,
  speciesId: 'mossling',
  level: 20,
  zoneId,
  wins: 6,
  posterId: null,
  posterName: null,
  reward,
  fee: 0,
  status: 'open',
  claimerId: null,
  claimerName: null,
  payout: null,
  bonus: false,
  createdAt: at(DAY - DAY_MS),
  expiresAt: at(DAY + DAY_MS),
  claimedAt: null,
  ...extra,
});

const WORLD: RumourWorld = {
  ...EMPTY_WORLD,
  badges: [
    { username: 'alice', badgeId: 'bloom', at: at(DAY - 5 * 3_600_000) },
    { username: 'bram', badgeId: 'ember', at: at(DAY - 3 * 3_600_000) },
  ],
  champions: [{ username: 'cora', at: at(DAY - 3_600_000) }],
  camps: [{ zoneId: 'mire_route', holder: 'dunst', at: at(DAY - 2 * 3_600_000) }],
  nemeses: [{ name: 'Gristle', title: 'the Scarred', speciesId: 'mossling', level: 24, rank: 3, zoneId: 'mire_route' }],
  bounties: [bounty('b1', 'ash_route', 900), bounty('b2', 'mire_route', 500)],
  claims: [bounty('c1', 'mire_route', 600, { status: 'claimed', claimerName: 'elsie', claimedAt: at(DAY - 3_600_000) })],
  sales: [
    { speciesId: 'mossling', price: 1000, at: at(DAY - 10 * DAY_MS) },
    { speciesId: 'mossling', price: 1000, at: at(DAY - 9 * DAY_MS) },
    { speciesId: 'mossling', price: 1500, at: at(DAY - 2 * DAY_MS) },
    { speciesId: 'mossling', price: 1500, at: at(DAY - DAY_MS) },
  ],
};

describe('the facts on a board', () => {
  it('are the same for the same day, town and rows; another town or day differs', () => {
    const a = buildRumours('mirevale', DAY, 'seed', WORLD, []);
    expect(buildRumours('mirevale', DAY, 'seed', WORLD, [])).toEqual(a);
    expect(a.length).toBeGreaterThan(3);
    expect(a.length).toBeLessThanOrEqual(RUMOUR_WORLD_MAX);
    expect(new Set(a.map((f) => f.id)).size).toBe(a.length);
    const other = buildRumours('cinderhold', DAY, 'seed', WORLD, []);
    expect(other.map((f) => f.id)).not.toEqual(a.map((f) => f.id));
    expect(buildRumours('mirevale', DAY + DAY_MS, 'seed', WORLD, []).map((f) => f.id)).not.toEqual(a.map((f) => f.id));
  });

  it('say only true names and numbers, in one short line without an em-dash', () => {
    const all = (['mirevale', 'cinderhold', 'saltmourn', 'solenne'] as ZoneId[]).flatMap((t) => buildRumours(t, DAY, 'seed', WORLD, []));
    for (const f of all) {
      expect(f.text.length).toBeLessThanOrEqual(RUMOUR_TEXT_MAX);
      expect(f.text.includes(DASH)).toBe(false);
      expect(f.text).not.toMatch(/\n/);
    }
    const text = (id: string): string | undefined => all.find((f) => f.id === id)?.text;
    // the deepest badge of the day is the news
    expect(text('badge:ember')).toBe('2 trainers won badges yesterday, and bram won the Ember Badge.');
    expect(text('champion:cora')).toBe('cora beat the Champion yesterday.');
    expect(text('camp:mire_route')).toBe('The camp on Mire Route changed hands yesterday, and dunst holds it now.');
    expect(text('nemesis:mire_route:Gristle')).toBe('Gristle the Scarred, a level 24 Mossling that has risen to rank 3, stalks Mire Route.');
    expect(text('claim:c1')).toBe('elsie brought in Ghost c1 on Mire Route yesterday.');
    expect(text('market:mossling')).toBe('Mossling sells for about 1,500 at the market now, up from about 1,000 the week before.');
  });

  it('put the town and its neighbours first: the raid on the route next door, the local bounty', () => {
    const a = buildRumours('mirevale', DAY, 'seed', WORLD, []);
    const near = new Set<string>(rumourZones('mirevale'));
    const raid = RAID_HOTSPOTS.find((h) => h.zoneId === 'mire_route')!;
    expect(a.find((f) => f.kind === 'raid')?.text).toBe(`A level ${raid.boss.level} Thornback raid opens on Mire Route at ${String(raid.window.utcHour).padStart(2, '0')}:00 UTC for ${raid.window.minutes} minutes.`);
    expect(a.find((f) => f.kind === 'bounty')?.zoneId).toBe('mire_route');
    // every local kind comes before the first non-local one
    const firstGlobal = a.findIndex((f) => f.zoneId === null || !near.has(f.zoneId));
    if (firstGlobal >= 0) for (const f of a.slice(firstGlobal)) expect(f.kind === 'raid' || f.kind === 'nemesis' || f.kind === 'weather' ? near.has(f.zoneId ?? '') : true).toBe(true);
  });

  it("names today's swarm and the week's cup when the board has room", () => {
    const empty = buildRumours('stormrook', DAY, 'seed', EMPTY_WORLD, []);
    const swarm = DAILY_SWARMS[new Date(DAY).getUTCDay()]!;
    const all = [...empty, ...buildRumours('mirevale', DAY, 'seed', EMPTY_WORLD, [])];
    expect(all.some((f) => f.id === `swarm:${swarm.id}`)).toBe(true);
    expect(all.some((f) => f.kind === 'cup' && f.text.startsWith("This week's arena cup is the "))).toBe(true);
  });

  it('finds the market swings of a quarter or more, with two sales a week', () => {
    expect(marketSwings(WORLD.sales, DAY)).toEqual([{ speciesId: 'mossling', now: 1500, before: 1000 }]);
    expect(marketSwings(WORLD.sales.slice(1), DAY)).toEqual([]);
    const small = WORLD.sales.map((s) => (s.price === 1500 ? { ...s, price: 1100 } : s));
    expect(marketSwings(small, DAY)).toEqual([]);
  });
});

describe("the town's gossip about the caller", () => {
  const mem = (npcId: string, standing: number, deeds: { deed: string; at: string }[]): NpcMemory =>
    ({ playerId: 'p', npcId, zoneId: 'mirevale', summary: '', standing, deeds, talks: 1, updatedAt: at(DAY) }) as NpcMemory;

  it('tells what the villagers remember, newest first, and how the town feels', () => {
    const g = gossipRumours('mirevale', 'red', [
      mem('mirevale.archivist', -5, [{ deed: 'hit', at: at(DAY - 1000).toISOString() }]),
      mem('mirevale.child', -1, [{ deed: 'kindWords', at: at(DAY - 500).toISOString() }, { deed: 'insulted', at: at(DAY - 100).toISOString() }]),
    ]);
    expect(g.length).toBeLessThanOrEqual(RUMOUR_GOSSIP_MAX);
    expect(g[0]!.kind).toBe('gossip');
    expect(g[0]!.text).toMatch(/^red insulted [a-zA-Z]/);
    expect(g.some((f) => f.kind === 'gossip' && /^red hit [a-zA-Z]/.test(f.text))).toBe(true);
    expect(g.at(-1)).toMatchObject({ kind: 'standing', text: 'Mirevale has turned against red.' });
    expect(gossipRumours('mirevale', 'red', [])).toEqual([]);
  });
});

describe('the per-day cache', () => {
  it('builds a town once a day, shares a read in flight, rebuilds the next day, and forgets a failure', async () => {
    const board = new RumourBoard();
    let builds = 0;
    const build = async (start: number) => {
      builds++;
      return [{ id: `cup:${start}`, kind: 'cup' as const, text: 'x', zoneId: null, speciesId: null, type: null }];
    };
    const [a, b] = await Promise.all([board.get('mirevale', DAY + 1000, build), board.get('mirevale', DAY + 5000, build)]);
    expect(a).toBe(b);
    expect(builds).toBe(1);
    await board.get('cinderhold', DAY + 6000, build);
    expect([builds, board.size]).toEqual([2, 2]);
    await board.get('mirevale', DAY + DAY_MS + 1, build);
    expect([builds, board.size]).toEqual([3, 1]);
    await expect(board.get('saltmourn', DAY + DAY_MS + 2, () => Promise.reject(new Error('db')))).rejects.toThrow('db');
    await board.get('saltmourn', DAY + DAY_MS + 3, build);
    expect(builds).toBe(4);
    expect(dayStartOf(DAY + 12_345)).toBe(DAY);
  });
});

describe('GET /world/rumours/:zoneId', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  it("calls out yesterday's badges by name, the caller's deeds in town, and keeps the world part all day", async () => {
    const now = s.time.clock();
    const yesterday = new Date(dayStartOf(now) - 3_600_000);
    const winner = await register(s);
    await s.repos.db.transaction((tx) => s.repos.progress.awardBadge(tx, winner.id, 'bloom', yesterday));
    const acc = await register(s);
    await enter(s, acc, 'mirevale');
    const wrote = await api(s, 'POST', '/npc/memory', acc.access, { npcId: 'mirevale.archivist', summary: 'The traveller slapped me.', deeds: ['hit'] });
    expect(wrote.status).toBe(200);

    const res = await api(s, 'GET', '/world/rumours/mirevale', acc.access);
    expect(res.status).toBe(200);
    const view = RumoursRes.parse(res.body);
    expect(view).toMatchObject({ zoneId: 'mirevale', town: 'Mirevale', day: new Date(now).toISOString().slice(0, 10) });
    expect(view.facts.find((f) => f.kind === 'badge')?.text).toBe(`${winner.username} won the Bloom Badge yesterday.`);
    expect(view.facts.find((f) => f.kind === 'raid')?.zoneId).toBe('mire_route');
    expect(view.facts.filter((f) => f.kind === 'gossip').map((f) => f.text)).toEqual([expect.stringMatching(new RegExp(`^${acc.username} hit `))]);
    expect(view.facts.at(-1)).toMatchObject({ kind: 'standing', text: `Mirevale is wary of ${acc.username}.` });

    // another player sees the same world facts and none of the caller's gossip
    const other = await register(s);
    const theirs = RumoursRes.parse((await api(s, 'GET', '/world/rumours/mirevale', other.access)).body);
    expect(theirs.facts).toEqual(view.facts.filter((f) => f.kind !== 'gossip' && f.kind !== 'standing'));

    // a badge won later today is tomorrow's news: the board stays as it was
    await s.repos.db.transaction((tx) => s.repos.progress.awardBadge(tx, other.id, 'bloom', new Date(now)));
    const again = RumoursRes.parse((await api(s, 'GET', '/world/rumours/mirevale', other.access)).body);
    expect(again.facts).toEqual(theirs.facts);

    // the next day: yesterday's badge is the news
    s.time.advance(DAY_MS);
    const next = RumoursRes.parse((await api(s, 'GET', '/world/rumours/mirevale', other.access)).body);
    expect(next.day).not.toBe(view.day);
    expect(next.facts.find((f) => f.kind === 'badge')?.text).toBe(`${other.username} won the Bloom Badge yesterday.`);
  });

  it('answers 404 off a town and 401 without a token', async () => {
    const acc = await register(s);
    expect((await api(s, 'GET', '/world/rumours/mire_route', acc.access)).status).toBe(404);
    expect((await api(s, 'GET', '/world/rumours/nowhere', acc.access)).status).toBe(404);
    expect((await api(s, 'GET', '/world/rumours/mirevale', null)).status).toBe(401);
  });

  it('answers npcToolsOff when NPC_TOOLS=off', async () => {
    const off = await startServer({ NPC_TOOLS: 'off' });
    try {
      const acc = await register(off);
      const res = await api(off, 'GET', '/world/rumours/mirevale', acc.access);
      expect(res.status).toBe(409);
      expect(res.body.code ?? res.body.error).toBe('npcToolsOff');
    } finally {
      await off.stop();
    }
  }, 120_000);
});
