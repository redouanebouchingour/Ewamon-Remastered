/**
 * One roaming legendary per season (content roamer.ts): on the route the season's roamer is on, an encounter meets it
 * now and then (its own stream) as the season's species at its level; on another route never; once someone caught it
 * this season, never again. Catching a roamer encounter records the season's first catcher once (the catcher hears it,
 * the party's history keeps it); GET /legends says where it roams until then, and who caught it after.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { ROAMER_LEVEL, ROAM_PERIOD_MS, roamerOf, roamerZoneAt, seasonAt, zone } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { ServerMessage } from '@ewa/protocol';
import { createRoomMetrics } from '../src/metrics';
import { silentLogger } from '../src/log';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import { SHADOW_CHECK_MS } from '../src/rooms/ZoneRoom';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { api, content, enter, rawQuery, register, startServer, waitFor } from './helpers';
import type { Joined, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const roomOf = (j: Joined): ZoneRoom => matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;

describe('the roaming legendary', () => {
  it('meets players on its route only, until someone catches it; GET /legends follows it', async () => {
    // the start of a period of the running season when the roamer is on Mire Route (the test stays inside it)
    let t = (Math.floor(s.time.clock() / ROAM_PERIOD_MS) + 1) * ROAM_PERIOD_MS + 1000;
    while (roamerZoneAt(seasonAt(t).number, t) !== 'mire_route') t += ROAM_PERIOD_MS;
    s.time.advance(t - s.time.clock());
    const season = seasonAt(s.time.clock()).number;
    const acc = await register(s);
    await rawQuery(s.db, "update players set zone_id = 'mire_route' where id = $1", [acc.id]);
    const j = await enter(s, acc, 'mire_route');
    const room = roomOf(j);
    s.time.advance(SHADOW_CHECK_MS);
    // the minute read tells the room nobody caught it yet
    let met: SpawnRecord | null = null;
    await waitFor(() => {
      for (let i = 0; i < 200 && met === null; i++) met = room.roamerEncounter('land', 1, 2);
      return met !== null;
    }, 5000);
    expect(met).toMatchObject({ speciesId: roamerOf(season), level: ROAMER_LEVEL, x: 1, z: 2 });
    expect(met!.id).toContain(':roamer:');
    const roaming = (await api(s, 'GET', '/legends', acc.access)).body;
    expect(roaming).toMatchObject({ season, species: roamerOf(season), zoneId: 'mire_route', caught: null });
    expect(Date.parse(roaming.movesAt)).toBeGreaterThan(s.time.clock());

    // anywhere else (a town is never on its routes) it is never met, after the room's own minute read too
    const other = await register(s);
    const k = await enter(s, other, 'mirevale');
    s.time.advance(SHADOW_CHECK_MS);
    await new Promise((r) => setTimeout(r, 300));
    for (let i = 0; i < 400; i++) expect(roomOf(k).roamerEncounter('land', 0, 0)).toBeNull();
    await k.room.leave(true);

    // caught: the room hears it on its next minute read, and it roams no more this season
    await s.repos.db.transaction((tx) => s.repos.legends.claim(tx, season, roamerOf(season), acc.id, acc.username, new Date(s.time.clock())));
    s.time.advance(SHADOW_CHECK_MS);
    await waitFor(() => {
      for (let i = 0; i < 400; i++) if (room.roamerEncounter('land', 0, 0) !== null) return false;
      return true;
    }, 5000);
    const caught = (await api(s, 'GET', '/legends', acc.access)).body;
    expect(caught).toMatchObject({ zoneId: null, movesAt: null, caught: { season, username: acc.username } });
    expect(caught.past[0]).toMatchObject({ season, username: acc.username });
    await j.room.leave(true);
  }, 60_000);

  it('the first catch of a roamer encounter is recorded once; the catcher hears it; a later catch is not', async () => {
    const season = seasonAt(s.time.clock()).number + 1;
    s.time.advance(seasonAt(s.time.clock()).endsAt + 1000 - s.time.clock());
    expect(seasonAt(s.time.clock()).number).toBe(season);
    const msgs: ServerMessage[] = [];
    const host: BattleHost = { send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
    const c = new BattleCoordinator(createRng('roamer'), { repos: s.repos, content, clock: s.time.clock, log: silentLogger(), zone: zone('mire_route'), host, metrics: createRoomMetrics('r', 'mire_route', 0) });
    const catchOne = async (accId: string): Promise<boolean> => {
      // a weak stand-in marked as a roamer encounter (any species: the record keeps what was caught)
      const spawn: SpawnRecord = { id: `mire_route:roamer:${season}:1`, speciesId: 'mossling', level: 2, variantKey: 'normal', isAlpha: false, ability: content.species('mossling').abilities[0]!, medium: 'land', x: 0, z: 0, bornAt: 0, engagedBy: null, engagedAt: null, despawnAt: 1e15 };
      await s.repos.db.transaction((tx) => s.repos.inventory.add(tx, accId, 'aether_orb', 30));
      const res = await c.startWild({ playerId: accId, sessionId: 's' }, spawn, { x: 0, z: 0 });
      if (!res.ok) throw new Error(res.detail);
      for (let i = 0; i < 30 && c.get(res.session.id) !== null; i++) {
        const st = c.get(res.session.id)!.state;
        expect(c.action(accId, res.session.id, st.turn + 1, { kind: 'catch', orb: 'aether_orb' })).toBeNull();
        for (let k = 0; k < 300 && c.get(res.session.id)?.resolving; k++) await new Promise((r) => setTimeout(r, 5));
      }
      return c.get(res.session.id) === null;
    };
    const a = await register(s);
    const b = await register(s);
    expect(await catchOne(a.id)).toBe(true);
    expect(await s.repos.db.transaction((tx) => s.repos.legends.of(tx, season))).toMatchObject({ season, species: 'mossling', playerName: a.username });
    expect(msgs.some((m) => m.type === 'toast' && m.text.includes('first to catch'))).toBe(true);
    const n = msgs.length;
    expect(await catchOne(b.id)).toBe(true);
    expect((await s.repos.db.transaction((tx) => s.repos.legends.of(tx, season)))?.playerName).toBe(a.username);
    expect(msgs.slice(n).some((m) => m.type === 'toast' && m.text.includes('first to catch'))).toBe(false);
    c.dispose();
  }, 60_000);
});
