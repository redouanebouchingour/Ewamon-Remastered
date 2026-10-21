/**
 * A living ecosystem (content ecosystem.ts, game/ecosystem.ts): a plain wild creature knocked out or caught is tallied
 * for its species in the zone's week, in the battle's own transaction (an ambush, the roamer or a static is not); the
 * zone room rolls on this week's table, so forced pressure visibly shifts the encounter roll; GET /world/ecosystem shows
 * the same reading. ECOSYSTEM=off (testEnv): nothing is tallied and every zone rolls its authored table.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { ecoWeek, ecosystemOf, encounterTableFor, getHeightfield, nearestWalkable, zone } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { Action, BattleState } from '@ewa/core';
import type { EncounterTable } from '@ewa/content';
import type { ServerMessage } from '@ewa/protocol';
import { createRoomMetrics } from '../src/metrics';
import { silentLogger } from '../src/log';
import { countsForEcosystem, takeOf } from '../src/game/ecosystem';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import { rollWild } from '../src/rooms/spawnDirector';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { api, content, enter, placePlayer, register, startServer } from './helpers';
import type { TestServer } from './helpers';

const spawn = (id: string, speciesId: string, level: number): SpawnRecord => ({
  id,
  speciesId,
  level,
  variantKey: 'normal',
  isAlpha: false,
  ability: content.species(speciesId).abilities[0]!,
  medium: 'land',
  x: 0,
  z: 0,
  bornAt: 0,
  engagedBy: null,
  engagedAt: null,
  despawnAt: 60_000,
});

/** How many of `n` land rolls at noon on `table` are each species. */
function counts(table: EncounterTable, n: number): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const r = rollWild(table, 'land', createRng(`eco:${i}`), content, 0.5, { x: 0, z: 0 }, `w${i}`, 0);
    if (r !== null) out.set(r.speciesId, (out.get(r.speciesId) ?? 0) + 1);
  }
  return out;
}

const strongest = (st: BattleState): Action => {
  const b = st.sides[0].party[st.sides[0].active]!;
  const mv = [...b.creature.moves].filter((m) => m.pp > 0).sort((x, y) => content.move(y.id).power - content.move(x.id).power)[0]!;
  return { kind: 'move', move: mv.id };
};

describe('a living ecosystem (pure)', () => {
  it('only plain wild creatures count; a turn takes what it caught or knocked out', () => {
    expect(countsForEcosystem('mire_route:wild:3')).toBe(true);
    expect(countsForEcosystem('mire_route:fish:1')).toBe(true);
    expect(countsForEcosystem('mire_route:12')).toBe(true);
    expect(countsForEcosystem('mire_route:nemesis:2')).toBe(false);
    expect(countsForEcosystem('ascent_route:roamer:1:4')).toBe(false);
    expect(countsForEcosystem(null)).toBe(false);
    const faint = (side: 0 | 1) => ({ t: 'faint', who: { side, slot: 0 } }) as never;
    expect(takeOf([faint(1), faint(0)])).toEqual({ caught: 0, ko: 1 });
    expect(takeOf([{ t: 'catchResult', caught: true } as never])).toEqual({ caught: 1, ko: 0 });
    expect(takeOf([{ t: 'catchResult', caught: false } as never])).toEqual({ caught: 0, ko: 0 });
  });

  it('forced pressure shifts the roll: an overcaught prey turns up less, its hunter more, on the same draws', () => {
    const authored = encounterTableFor('mire_route')!;
    const e = ecosystemOf({ zoneId: 'mire_route', season: 0, thisWeek: [{ speciesId: 'mufflo', caught: 40, ko: 0 }], lastWeek: [], shadow: 0, light: 0 })!;
    const before = counts(authored, 4000);
    const after = counts(e.table, 4000);
    expect(after.get('mufflo')!).toBeLessThan(before.get('mufflo')! * 0.7);
    expect(after.get('bramblecub')!).toBeGreaterThan(before.get('bramblecub')! * 1.4);
  });
});

describe('a living ecosystem (server, ECOSYSTEM=on)', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer({ ECOSYSTEM: 'on' });
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  function coordinator(msgs: ServerMessage[]): BattleCoordinator {
    const host: BattleHost = { send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
    return new BattleCoordinator(createRng('eco:mire_route'), {
      repos: s.repos,
      content,
      clock: s.time.clock,
      log: silentLogger(),
      zone: zone('mire_route'),
      host,
      metrics: createRoomMetrics('r', 'mire_route', 0),
      ecosystem: () => true,
    });
  }

  async function knockOut(id: string, speciesId: string): Promise<void> {
    const me = await register(s);
    const msgs: ServerMessage[] = [];
    const c = coordinator(msgs);
    const res = await c.startWild({ playerId: me.id, sessionId: 's' }, spawn(id, speciesId, 2), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    for (let i = 0; i < 60 && c.get(res.session.id) !== null; i++) {
      const st = c.get(res.session.id)!.state;
      c.action(me.id, res.session.id, st.turn + 1, strongest(st));
      for (let k = 0; k < 400 && c.get(res.session.id)?.resolving; k++) await new Promise((r) => setTimeout(r, 5));
    }
    const end = msgs.find((m) => m.type === 'battleEnd');
    if (end?.type !== 'battleEnd') throw new Error('no end');
    expect(end.outcome).toEqual({ winner: 0 });
    c.dispose();
  }

  it('a wild knockout is tallied for its species in the zone week; an ambush is not', async () => {
    const week = ecoWeek(s.time.clock());
    await knockOut('mire_route:wild:1', 'dustcub');
    await knockOut('mire_route:nemesis:1', 'mufflo');
    const rows = await s.repos.db.transaction((tx) => s.repos.ecosystem.week(tx, 'mire_route', week));
    expect(rows).toEqual([{ speciesId: 'dustcub', caught: 0, ko: 1 }]);
  }, 60_000);

  it('the zone room rolls on this week table, and GET /world/ecosystem shows the same reading', async () => {
    const now = s.time.clock();
    await s.repos.db.transaction((tx) => s.repos.ecosystem.add(tx, 'mire_route', ecoWeek(now), 'mufflo', 40, 0));
    const me = await register(s);
    const p = nearestWalkable(getHeightfield('mire_route'), 60, 40, 12)!;
    await placePlayer(s, me.id, 'mire_route', p[0], p[1]);
    const j = await enter(s, me, 'mire_route');
    const room = matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
    await room.readEcosystem(now);
    const authored = encounterTableFor('mire_route')!.slots;
    const table = room.wildTable()!;
    const w = (t: readonly { species: string; weight: number }[], id: string) => t.filter((x) => x.species === id).reduce((n, x) => n + x.weight, 0);
    expect(w(table.slots, 'mufflo')).toBeLessThan(w(authored, 'mufflo'));
    expect(w(table.slots, 'bramblecub')).toBeGreaterThan(w(authored, 'bramblecub'));
    const before = counts(encounterTableFor('mire_route')!, 3000);
    const after = counts(table, 3000);
    expect(after.get('mufflo')!).toBeLessThan(before.get('mufflo')!);
    expect(after.get('bramblecub')!).toBeGreaterThan(before.get('bramblecub')!);

    const view = (await api(s, 'GET', '/world/ecosystem/mire_route', me.access)).body;
    expect(view).toMatchObject({ zoneId: 'mire_route', enabled: true, judged: true });
    expect(view.week).toBeGreaterThanOrEqual(1);
    expect(view.scarce[0]).toMatchObject({ speciesId: 'mufflo', cause: 'hunted', caught: 40 });
    expect(view.scarce[0].huntedBy).toContain('bramblecub');
    expect(view.surging.map((x: { speciesId: string }) => x.speciesId)).toContain('bramblecub');
    expect((await api(s, 'GET', '/world/ecosystem/mirevale', me.access)).status).toBe(404);
    expect((await api(s, 'GET', '/world/ecosystem/atlantis', me.access)).status).toBe(400);
    await j.room.leave(true);
  }, 60_000);
});

describe('a living ecosystem (server, ECOSYSTEM=off in testEnv)', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  it('the room rolls the authored table and the panel says it is not running', async () => {
    const now = s.time.clock();
    await s.repos.db.transaction((tx) => s.repos.ecosystem.add(tx, 'mire_route', ecoWeek(now), 'mufflo', 40, 0));
    const me = await register(s);
    const p = nearestWalkable(getHeightfield('mire_route'), 60, 40, 12)!;
    await placePlayer(s, me.id, 'mire_route', p[0], p[1]);
    const j = await enter(s, me, 'mire_route');
    const room = matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
    expect(room.wildTable()).toBe(encounterTableFor('mire_route'));
    const view = (await api(s, 'GET', '/world/ecosystem/mire_route', me.access)).body;
    expect(view).toMatchObject({ enabled: false, surging: [], scarce: [], migrantsIn: [] });
    await j.room.leave(true);
  }, 60_000);
});
