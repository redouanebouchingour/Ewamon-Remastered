/**
 * Honor shapes the world (content worldHonor.ts): a wild battle won by knocking the creature out adds shadow to the
 * zone's season tally, in the turn's own transaction; the zone room reads its tally once a minute into `state.shadow`
 * (clients see it) and lets it go when the light comes back; GET /world/shadow lists the shadowed zones; Dark-type
 * slots weigh more in a shadowed zone and a clear zone rolls as before.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { SHADOW_POINTS, ZONE_ORDER, encounterTableFor, seasonAt } from '@ewa/content';
import { createRng } from '@ewa/core';
import { SHADOW_CHECK_MS } from '../src/rooms/ZoneRoom';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { rollWild, slotEligible } from '../src/rooms/spawnDirector';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { api, content, enter, ofType, rawQuery, register, startServer, waitFor } from './helpers';
import type { Joined, TestServer } from './helpers';

describe('Dark slots in a shadowed zone (pure)', () => {
  it('weigh more per level; level 0 rolls exactly as before', () => {
    const dark = (id: string): boolean => content.species(id).types.includes('Dark');
    // a table and a time of day whose eligible slots hold both Dark and other species, on land or on water
    let pick: { id: (typeof ZONE_ORDER)[number]; medium: 'land' | 'water'; time: number } | null = null;
    for (const z of ZONE_ORDER) {
      for (const medium of ['land', 'water'] as const) {
        for (const time of [0.5, 0.0]) {
          const slots = encounterTableFor(z)?.slots.filter((s) => (s.medium ?? 'land') === medium && slotEligible(s, time)) ?? [];
          if (pick === null && slots.some((s) => dark(s.species)) && slots.some((s) => !dark(s.species))) pick = { id: z, medium, time };
        }
      }
    }
    expect(pick).not.toBeNull();
    const { medium, time } = pick!;
    const table = encounterTableFor(pick!.id)!;
    const share = (shadow: number): number => {
      let n = 0;
      let hits = 0;
      for (let i = 0; i < 3000; i++) {
        const r = rollWild(table, medium, createRng(`s:${i}`), content, time, { x: 0, z: 0 }, `s${i}`, 0, undefined, null, shadow);
        if (r === null) continue;
        n += 1;
        if (dark(r.speciesId)) hits += 1;
      }
      return hits / n;
    };
    const clear = share(0);
    expect(share(4)).toBeGreaterThan(clear * 1.5);
    expect(share(2)).toBeGreaterThan(clear);
    expect(rollWild(table, medium, createRng('x'), content, time, { x: 0, z: 0 }, 'x', 0)).toEqual(rollWild(table, medium, createRng('x'), content, time, { x: 0, z: 0 }, 'x', 0, undefined, null, 0));
  });
});

describe('honor shapes the world (server)', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  const roomOf = (j: Joined): ZoneRoom => matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
  const tally = async (zoneId: string) => {
    const rows = await rawQuery(s.db, 'select light, shadow from world_honor where season = $1 and zone_id = $2', [seasonAt(s.time.clock()).number, zoneId]);
    return rows.length === 0 ? { light: 0, shadow: 0 } : { light: Number(rows[0]!['light']), shadow: Number(rows[0]!['shadow']) };
  };
  function weakWild(): SpawnRecord {
    return { id: `test:${Math.floor(Math.random() * 1e9)}`, speciesId: 'mossling', level: 2, variantKey: 'normal', isAlpha: false, ability: content.species('mossling').abilities[0]!, medium: 'land', x: 0, z: 6, bornAt: 0, engagedBy: null, engagedAt: null, despawnAt: 1e15 };
  }

  it('knocking a wild creature out adds shadow to the zone, in the battle turn', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const before = await tally('mirevale');
    const room = roomOf(j);
    const started = await room.battles.startWild({ playerId: acc.id, sessionId: j.room.sessionId }, weakWild(), { x: 0, z: 6 });
    expect(started.ok).toBe(true);
    await waitFor(() => ofType(j.msgs, 'battleStart').length === 1, 3000);
    const bs = ofType(j.msgs, 'battleStart')[0]!;
    const moves = bs.state.sides[0].party[0]!.creature.moves;
    const strongest = [...moves].sort((a, b) => content.move(b.id).power - content.move(a.id).power)[0]!.id;
    for (let turn = 1; turn <= 20 && ofType(j.msgs, 'battleEnd').length === 0; turn++) {
      j.room.send('battleAction', { battleId: bs.battleId, turn, action: { kind: 'move', move: strongest } });
      await waitFor(() => ofType(j.msgs, 'battleEvents').length >= turn || ofType(j.msgs, 'battleEnd').length > 0, 5000);
    }
    expect(ofType(j.msgs, 'battleEnd')[0]!.outcome).toEqual({ winner: 0 });
    const after = await tally('mirevale');
    expect(after.shadow - before.shadow).toBeGreaterThanOrEqual(SHADOW_POINTS.wildKo);
    expect(after.light).toBe(before.light);
    await j.room.leave(true);
  }, 60_000);

  it('the zone room reads its tally into state.shadow; GET /world/shadow lists the shadowed zones', async () => {
    const season = seasonAt(s.time.clock()).number;
    await rawQuery(s.db, "insert into world_honor (season, zone_id, light, shadow) values ($1, 'mirevale', 5, 200) on conflict (season, zone_id) do update set light = 5, shadow = 200", [season]);
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    s.time.advance(SHADOW_CHECK_MS);
    await waitFor(() => roomOf(j).state.shadow === 4, 5000);
    await waitFor(() => (j.room.state as { shadow: number }).shadow === 4, 5000);
    const list = (await api(s, 'GET', '/world/shadow', acc.access)).body;
    expect(list.season).toBe(season);
    expect(list.zones).toContainEqual({ zoneId: 'mirevale', level: 4, light: 5, shadow: 200 });
    expect(list.zones.every((z: { level: number }) => z.level > 0)).toBe(true);
    // the light comes back: enough catches and fair wins lift it
    await rawQuery(s.db, "update world_honor set light = 1000 where season = $1 and zone_id = 'mirevale'", [season]);
    s.time.advance(SHADOW_CHECK_MS);
    await waitFor(() => roomOf(j).state.shadow === 0, 5000);
    await j.room.leave(true);
  }, 60_000);
});
