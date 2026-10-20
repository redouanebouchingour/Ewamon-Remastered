/**
 * Ghost trainers (content ghosts.ts): leaving the world leaves the party behind as a ghost in that zone (a crossing
 * does not); a fight with a ghost is an AI trainer battle of healed copies (a win pays, the owner's creatures are
 * untouched) recorded for the owner; a zone room meets its recent ghosts now and then (never the player's own); the
 * owner hears how the ghost fared when they come back, once; GET /ghost shows where it haunts and its fights.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { ghostReport, ghostReward, ghostTrainerId, zone } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { ServerMessage } from '@ewa/protocol';
import { createRoomMetrics } from '../src/metrics';
import { silentLogger } from '../src/log';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import { SHADOW_CHECK_MS } from '../src/rooms/ZoneRoom';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { api, content, enter, ofType, rawQuery, register, startServer, waitFor } from './helpers';
import type { Joined, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const roomOf = (j: Joined): ZoneRoom => matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
const creatureRows = async (id: string) => JSON.stringify(await rawQuery(s.db, 'select * from creature_instances where owner_id = $1 order by id', [id]));

describe('ghost trainers', () => {
  it('leaving the world leaves the party behind as a ghost in that zone', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    expect(await s.repos.db.transaction((tx) => s.repos.ghosts.of(tx, acc.id))).toBeNull();
    await j.room.leave(true);
    let ghost = null;
    for (let i = 0; i < 100 && ghost === null; i++) {
      ghost = await s.repos.db.transaction((tx) => s.repos.ghosts.of(tx, acc.id));
      if (ghost === null) await new Promise((r) => setTimeout(r, 50));
    }
    expect(ghost).toMatchObject({ playerId: acc.id, name: acc.username, zoneId: 'mirevale' });
    expect(ghost!.party.length).toBeGreaterThan(0);
    expect(ghost!.topLevel).toBe(Math.max(...ghost!.party.map((c) => c.level)));
    const view = (await api(s, 'GET', '/ghost', acc.access)).body;
    expect(view.haunting).toMatchObject({ zoneId: 'mirevale' });
    expect(view.haunting.party[0]).toEqual({ speciesId: ghost!.party[0]!.speciesId, level: ghost!.party[0]!.level });
    expect(view).toMatchObject({ won: 0, lost: 0, fights: [] });
  }, 60_000);

  it('a fight with a ghost: AI copies, a win pays, the owner is untouched and the fight is recorded', async () => {
    const owner = await register(s);
    const me = await register(s);
    const party = await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, owner.id));
    const before = await creatureRows(owner.id);
    const msgs: ServerMessage[] = [];
    const host: BattleHost = { send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
    const c = new BattleCoordinator(createRng('ghost'), { repos: s.repos, content, clock: s.time.clock, log: silentLogger(), zone: zone('mirevale'), host, metrics: createRoomMetrics('r', 'mirevale', 0) });
    // a weakened ghost so the fight ends: its copy at level 2
    const weak = party.map((x) => ({ ...x, level: 2 }));
    const res = await c.startGhost({ playerId: me.id, sessionId: 's' }, { ownerId: owner.id, name: owner.username, party: weak, topLevel: 2 }, { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    const st0 = res.session.state;
    expect(st0.format).toBe('trainer');
    expect(st0.sides[1]).toMatchObject({ kind: 'npc', trainerId: ghostTrainerId(owner.username) });
    expect(st0.sides[1].party[0]!.creature.id.startsWith('arena:')).toBe(true);
    for (let i = 0; i < 40 && c.get(res.session.id) !== null; i++) {
      const st = c.get(res.session.id)!.state;
      const b = st.sides[0].party[st.sides[0].active]!;
      const mv = b.creature.moves.find((m) => m.pp > 0 && content.move(m.id).power > 0) ?? b.creature.moves.find((m) => m.pp > 0)!;
      c.action(me.id, res.session.id, st.turn + 1, { kind: 'move', move: mv.id });
      for (let k = 0; k < 300 && c.get(res.session.id)?.resolving; k++) await new Promise((r) => setTimeout(r, 5));
    }
    const end = msgs.find((m) => m.type === 'battleEnd');
    expect(end).toBeDefined();
    if (end?.type !== 'battleEnd') throw new Error('no end');
    expect(end.outcome).toEqual({ winner: 0 });
    expect(end.rewards.money).toBe(ghostReward(2));
    expect(await creatureRows(owner.id)).toBe(before);
    const fights = await s.repos.db.transaction((tx) => s.repos.ghosts.fights(tx, owner.id, 10));
    expect(fights).toMatchObject({ won: 0, lost: 1 });
    expect(fights.fights[0]).toMatchObject({ challenger: me.username, zoneId: 'mirevale', won: false });
    // no content flag for a ghost
    expect((await rawQuery(s.db, "select flag from story_flags where player_id = $1 and flag like 'trainer:ghost:%'", [me.id])).length).toBe(0);
    c.dispose();

    // the owner comes back: told once
    const j = await enter(s, owner, 'mirevale');
    await waitFor(() => ofType(j.msgs, 'toast').some((m) => m.text === ghostReport(0, 1)), 5000);
    await j.room.leave(true);
    const k = await enter(s, owner, 'mirevale');
    await new Promise((r) => setTimeout(r, 500));
    expect(ofType(k.msgs, 'toast').some((m) => m.text.startsWith('While you were away'))).toBe(false);
    await k.room.leave(true);
  }, 60_000);

  it("a zone room meets its recent ghosts now and then, never the player's own", async () => {
    const owner = await register(s);
    const me = await register(s);
    const party = await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, owner.id));
    await s.repos.db.transaction((tx) => s.repos.ghosts.save(tx, owner.id, owner.username, 'mirevale', party, new Date(s.time.clock())));
    const mine = await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, me.id));
    const j = await enter(s, me, 'mirevale');
    await s.repos.db.transaction((tx) => s.repos.ghosts.save(tx, me.id, me.username, 'mirevale', mine, new Date(s.time.clock())));
    s.time.advance(SHADOW_CHECK_MS);
    const room = roomOf(j);
    const met = new Set<string>();
    await waitFor(() => {
      for (let i = 0; i < 200; i++) {
        const g = room.ghostEncounter(me.id);
        if (g !== null) met.add(g.playerId);
      }
      return met.has(owner.id);
    }, 5000);
    expect(met.has(me.id)).toBe(false);
    await j.room.leave(true);
  }, 60_000);
});
