/**
 * Part 2 fixes found by the client agent (IMPLEMENTATION-NOTES part 2, P1–P6):
 * P1 `/creature/:id/setup` returns the touched inventory counts; P3 a reload mid-battle rejoins the battle's
 * room and receives `battleResync` on join; P4 `CLOSE_CODES.replaced` no longer collides with Colyseus;
 * P5 loopback is exempt from the per-IP socket cap outside production; P6 a battle replays from the database
 * alone (battle_history.start + seed + actions → the final digest).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { createBattle, digestBattleState, resolveTurn } from '@ewa/core';
import type { Action, BattleState, CreateBattleOpts, RngState } from '@ewa/core';
import { CLOSE_CODES, ServerMessageSchema } from '@ewa/protocol';
import type { ServerMessage } from '@ewa/protocol';
import { socketCapApplies } from '../src/server';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { api, content, enter, joinSeat, ofType, register, sleep, startServer, waitFor } from './helpers';
import type { Joined, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

function roomOf(j: Joined): ZoneRoom {
  return matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
}

function spawnRecord(speciesId: string, level: number): SpawnRecord {
  return { id: `test:${Math.floor(Math.random() * 1e9)}`, speciesId, level, variantKey: 'normal', isAlpha: false, ability: content.species(speciesId).abilities[0]!, medium: 'land', x: 0, z: 6, bornAt: 0, engagedBy: null, engagedAt: null, despawnAt: 1e15 };
}

describe('P4 / P5 constants', () => {
  it('replaced is outside Colyseus reserved close codes; loopback is exempt from the socket cap only outside production', () => {
    expect(CLOSE_CODES.replaced).toBe(4101);
    expect([4000, 4001, 4002, 4003, 4010]).not.toContain(CLOSE_CODES.replaced);
    expect(socketCapApplies({ NODE_ENV: 'test' }, '127.0.0.1')).toBe(false);
    expect(socketCapApplies({ NODE_ENV: 'development' }, '::1')).toBe(false);
    expect(socketCapApplies({ NODE_ENV: 'development' }, '::ffff:127.0.0.1')).toBe(false);
    expect(socketCapApplies({ NODE_ENV: 'test' }, '10.0.0.4')).toBe(true);
    expect(socketCapApplies({ NODE_ENV: 'production' }, '127.0.0.1')).toBe(true);
  });

  it('nine sockets from loopback are accepted in test (the harness case)', async () => {
    const acc = await register(s);
    const joined: Joined[] = [];
    // one account, nine seats in a row: each new socket replaces the previous one, but every upgrade is accepted
    for (let i = 0; i < 9; i++) joined.push(await enter(s, acc, 'mirevale'));
    await waitFor(() => joined.slice(0, 8).every((j) => j.left.code === CLOSE_CODES.replaced), 5000);
    expect(joined[8]!.left.code).toBeNull();
    await joined[8]!.room.leave(true);
  }, 60_000);
});

describe('P1 /creature/:id/setup', () => {
  it('returns the creature plus an inventoryDelta with absolute counts of the equipped and returned items', async () => {
    const acc = await register(s);
    const me = await api(s, 'GET', '/me', acc.access);
    const starter = me.body.party[0];
    await s.repos.db.transaction(async (tx) => {
      await s.repos.inventory.add(tx, acc.id, 'Charcoal', 2);
      await s.repos.inventory.add(tx, acc.id, 'Choice Band', 1);
    });
    const r1 = await api(s, 'POST', `/creature/${starter.id}/setup`, acc.access, { ability: starter.ability, heldItem: 'Charcoal' });
    expect(r1.status).toBe(200);
    expect(r1.body.heldItem).toBe('Charcoal');
    expect(r1.body.inventoryDelta).toEqual({ items: { Charcoal: 1 }, money: null, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [expect.objectContaining({ id: starter.id, heldItem: 'Charcoal' })] });
    // swapping returns the previous item: both counts are absolute (Choice Band 1 → 0, Charcoal 1 → 2)
    const r2 = await api(s, 'POST', `/creature/${starter.id}/setup`, acc.access, { ability: starter.ability, heldItem: 'Choice Band' });
    expect(r2.body.inventoryDelta.items).toEqual({ 'Choice Band': 0, Charcoal: 2 });
    const r3 = await api(s, 'POST', `/creature/${starter.id}/setup`, acc.access, { ability: starter.ability, heldItem: null });
    expect(r3.body.inventoryDelta.items).toEqual({ 'Choice Band': 1 });
  });
});

describe('P3 reload mid-battle', () => {
  it('/zone/enter issues a seat in the battle room; the rejoining client gets battleResync on join; other zones stay 409 inBattle', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const room = roomOf(j);
    const started = await room.battles.startWild({ playerId: acc.id, sessionId: j.room.sessionId }, spawnRecord('mossling', 3), { x: 0, z: 6 });
    expect(started.ok).toBe(true);
    await waitFor(() => ofType(j.msgs, 'battleStart').length === 1, 3000);
    const battleId = ofType(j.msgs, 'battleStart')[0]!.battleId;
    // another zone is refused while the battle lives
    const other = await api(s, 'POST', '/zone/enter', acc.access, { zoneId: 'mire_route' });
    expect(other.status).toBe(409);
    // "reload": the socket drops without consent (the room keeps the avatar for the reconnection window)
    j.room.connection.close();
    await sleep(200);
    const r = await api(s, 'POST', '/zone/enter', acc.access, { zoneId: 'mirevale' });
    expect(r.status).toBe(200);
    expect(r.body.seat.roomId).toBe(j.room.roomId);
    const j2 = await joinSeat(s, acc.access, r.body.seat);
    await waitFor(() => ofType(j2.msgs, 'battleResync').length === 1, 5000);
    const resync = ofType(j2.msgs, 'battleResync')[0]!;
    expect(resync.battleId).toBe(battleId);
    expect(resync.stateDigest).toBe(digestBattleState(resync.state));
    expect(ServerMessageSchema.safeParse(resync).success).toBe(true);
    // the battle is still playable from the new socket
    const st = resync.state;
    const move = st.sides[0].party[st.sides[0].active]!.creature.moves.find((m) => m.pp > 0)!;
    j2.room.send('battleAction', { battleId, turn: st.turn + 1, action: { kind: 'move', move: move.id } });
    await waitFor(() => ofType(j2.msgs, 'battleEvents').length > 0 || ofType(j2.msgs, 'battleEnd').length > 0, 5000);
    await j2.room.leave(true);
  }, 60_000);
});

describe('P6 database-only replay', () => {
  it('battle_history.start + seed + actions reproduce the digest of the last battleEvents', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const room = roomOf(j);
    const started = await room.battles.startWild({ playerId: acc.id, sessionId: j.room.sessionId }, spawnRecord('glimp', 3), { x: 0, z: 6 });
    expect(started.ok).toBe(true);
    await waitFor(() => ofType(j.msgs, 'battleStart').length === 1, 3000);
    const battleId = ofType(j.msgs, 'battleStart')[0]!.battleId;
    let state: BattleState = ofType(j.msgs, 'battleStart')[0]!.state;
    for (let guard = 0; guard < 60 && ofType(j.msgs, 'battleEnd').length === 0; guard++) {
      const side = state.sides[0];
      const a: Action = side.mustSwitch
        ? { kind: 'switch', to: side.party.findIndex((b, i) => i !== side.active && b.creature.hp > 0) }
        : { kind: 'move', move: side.party[side.active]!.creature.moves.find((m) => m.pp > 0)!.id };
      const n = ofType(j.msgs, 'battleEvents').length;
      j.room.send('battleAction', { battleId, turn: state.turn + 1, action: a });
      await waitFor(() => ofType(j.msgs, 'battleEvents').length > n, 5000);
      state = room.battles.get(battleId)?.state ?? state;
      await sleep(260); // battleAction is limited to 4 / s (§30.6.4)
    }
    await waitFor(() => ofType(j.msgs, 'battleEnd').length === 1, 5000);
    const last = ofType(j.msgs, 'battleEvents').at(-1)!;
    const row = await s.repos.db.transaction((tx) => s.repos.history.battleById(tx, acc.id, battleId));
    expect(row).not.toBeNull();
    expect(row!.start).not.toBeNull();
    expect(row!.finalDigest).toBe(last.stateDigest);
    // the replay: nothing but the row and content
    const opts: CreateBattleOpts = {
      id: row!.battleId,
      format: row!.format,
      zoneId: row!.start!.zoneId,
      terrain: row!.start!.terrain as CreateBattleOpts['terrain'],
      seed: row!.seed as RngState,
      sides: row!.start!.sides as CreateBattleOpts['sides'],
    };
    let replay = createBattle(opts, content).state;
    for (const acts of row!.actions) replay = resolveTurn(replay, acts as [Action | null, Action | null], content).state;
    expect(replay.ended).not.toBeNull();
    expect(digestBattleState(replay)).toBe(last.stateDigest);
    expect(row!.turns).toBe(replay.turn);
    await j.room.leave(true);
  }, 60_000);
});

// keep the ServerMessage type import meaningful for readers of the resync assertion
export type _Msg = ServerMessage;

describe('field items (§30.6.3 part-1 seam)', () => {
  it('escape rope: route only, one orb of rope spent, the room teleports to the zone arrival point (a route spawn); repel/lure set a metre counter', async () => {
    const acc = await register(s);
    await s.repos.db.transaction(async (tx) => {
      await s.repos.inventory.add(tx, acc.id, 'escape_rope', 2);
      await s.repos.inventory.add(tx, acc.id, 'repel', 1);
    });
    // not in any room → not usable; in a town → not usable (nothing spent)
    expect((await api(s, 'POST', '/item/use', acc.access, { item: 'escape_rope', target: null, qty: 1 })).body.code).toBe('notUsableHere');
    const town = await enter(s, acc, 'mirevale');
    expect((await api(s, 'POST', '/item/use', acc.access, { item: 'escape_rope', target: null, qty: 1 })).body.code).toBe('notUsableHere');
    await town.room.leave(true);
    await sleep(200);
    const { arrivalPoint, getHeightfield, nearestWalkable, zone } = await import('@ewa/content');
    const p = nearestWalkable(getHeightfield('mire_route'), 60, 40, 12)!;
    await s.repos.db.transaction((tx) => s.repos.players.setPosition(tx, acc.id, 'mire_route', p[0], p[1], 0));
    const j = await enter(s, acc, 'mire_route');
    const r = await api(s, 'POST', '/item/use', acc.access, { item: 'escape_rope', target: null, qty: 1 });
    expect(r.status).toBe(200);
    expect(r.body.inventory.escape_rope).toBe(1);
    const spawn = arrivalPoint('mire_route');
    expect([spawn.x, spawn.z]).toEqual([zone('mire_route').spawn.x, zone('mire_route').spawn.z]);
    await waitFor(() => Math.hypot(j.room.state.players.get(acc.id)!.x - spawn.x, j.room.state.players.get(acc.id)!.z - spawn.z) < 9, 3000);
    expect((await api(s, 'POST', '/item/use', acc.access, { item: 'escape_rope', target: null, qty: 2 })).body.code).toBe('oneAtATime');
    const room = roomOf(j);
    expect((await api(s, 'POST', '/item/use', acc.access, { item: 'repel', target: null, qty: 1 })).status).toBe(200);
    await waitFor(() => room.clientOf(acc.id)?.userData?.repel?.kind === 'repel', 3000);
    expect(room.clientOf(acc.id)!.userData!.repel!.steps).toBe(50);
    await j.room.leave(true);
  }, 60_000);
});
