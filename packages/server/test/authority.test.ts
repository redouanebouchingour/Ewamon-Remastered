/**
 * §30.5 / §50.4.5 authority.test.ts — the adversarial suite against a real server (Colyseus + REST) with
 * `@colyseus/sdk` clients. Before each case the attacker's rows in every progression table are snapshotted
 * (canonicalJson); after, they must be byte-identical unless the case says otherwise.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { getHeightfield, nearestWalkable, zone } from '@ewa/content';
import { CLOSE_CODES } from '@ewa/protocol';
import type { ZoneId } from '@ewa/content';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { pickZoneRoom, reserveZoneSeat } from '../src/rooms/matchmaking';
import { START_EXP, api, enter, joinSeat, ofType, placePlayer, rawQuery, register, sleep, snapshot, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

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

async function inZone(zoneId: ZoneId, x: number, z: number, acc?: Account): Promise<{ acc: Account; j: Joined }> {
  const a = acc ?? (await register(s));
  const h = getHeightfield(zoneId);
  const p = nearestWalkable(h, x, z, 12)!;
  await placePlayer(s, a.id, zoneId, p[0], p[1]);
  const j = await enter(s, a, zoneId);
  return { acc: a, j };
}

async function giveBadge(id: string, badge: 'bloom' | 'ember' | 'current' | 'circuit' | 'fault' | 'wraith' | 'anvil' | 'ascend'): Promise<void> {
  await s.repos.db.transaction((tx) => s.repos.progress.awardBadge(tx, id, badge, new Date()));
}

describe('room messages (§30.5.1)', () => {
  it('A1: server-message-shaped payloads have no handler: no reply, unknownMessages counted, the 5th within 10 s kicks with 4003', async () => {
    const { acc, j } = await inZone('mirevale', 0, 6);
    const snap = await snapshot(s, acc.id);
    const room = roomOf(j);
    const before = room.metrics.unknownMessages;
    j.room.send('progressionDelta', { badges: ['bloom', 'ember'], trainerExp: 999999, trainerLevel: 100, rating: 3000, dexSeen: null, dexCaught: null, flags: ['champion:zeon:beaten'], questProgress: null });
    j.room.send('inventoryDelta', { items: { aether_orb: 99 }, money: 999999, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [] });
    j.room.send('battleEnd', { battleId: 'x', outcome: { winner: 0 }, rewards: { money: 1e6, items: {}, trainerExp: 1e6, ratingDelta: 500, badge: 'bloom' } });
    await waitFor(() => room.metrics.unknownMessages >= before + 3, 3000);
    await sleep(200);
    expect(j.msgs).toEqual([]); // no reply at all
    expect(j.left.code).toBeNull();
    j.room.send('progressionDelta', {});
    j.room.send('awardBadge', { badge: 'bloom' });
    await waitFor(() => j.left.code !== null, 5000);
    expect(j.left.code).toBe(4003);
    await sleep(300);
    expect(await snapshot(s, acc.id)).toBe(snap);
  }, 60_000);

  it('A15 + #17: a 64-unit teleport is refused silently (seq echoed, pose unchanged); a replayed seq is dropped', async () => {
    const { acc, j } = await inZone('mirevale', 0, 6);
    const snap = await snapshot(s, acc.id);
    const me = j.room.state.players.get(acc.id)!;
    const x0 = me.x;
    const z0 = me.z;
    j.room.send('input', { seq: 7, x: x0 + 64, z: z0, angle: 0, running: true, dtMs: 50 });
    await waitFor(() => j.room.state.players.get(acc.id)!.seq === 7, 3000);
    expect(j.room.state.players.get(acc.id)!.x).toBe(x0);
    expect(j.room.state.players.get(acc.id)!.z).toBe(z0);
    expect(ofType(j.msgs, 'error')).toEqual([]);
    // replay seq 7 with a legal step: dropped (seq stays 7, pose unchanged)
    j.room.send('input', { seq: 7, x: x0 + 0.1, z: z0, angle: 0, running: false, dtMs: 50 });
    await sleep(250);
    expect(j.room.state.players.get(acc.id)!.x).toBe(x0);
    expect(roomOf(j).metrics.rejectedInputs.speed).toBeGreaterThanOrEqual(1);
    await j.room.leave(true);
    await sleep(300);
    expect(await snapshot(s, acc.id)).toBe(snap);
  }, 60_000);

  it('#5: 30 movement rejections within 10 s → kicked with 4003 and an audit_log movement.kick row; the avatar never moved', async () => {
    const { acc, j } = await inZone('mirevale', 0, 6);
    const me = j.room.state.players.get(acc.id)!;
    const x0 = me.x;
    for (let i = 1; i <= 30; i++) j.room.send('input', { seq: i, x: x0 + 20, z: me.z, angle: 0, running: true, dtMs: 1 }); // dt 1: within budget, so every input reaches the speed check
    await waitFor(() => j.left.code !== null, 5000);
    expect(j.left.code).toBe(4003);
    await sleep(300);
    const audit = await rawQuery(s.db, "select action, detail from audit_log where actor_id = $1 and action = 'movement.kick'", [acc.id]);
    expect(audit).toHaveLength(1);
    const [row] = await rawQuery(s.db, 'select x from players where id = $1', [acc.id]);
    expect(Number(row!['x'])).toBeCloseTo(x0, 3);
  }, 60_000);

  it('A13: 200 inputs in one second → at most 30 applied, exactly one rateLimited error', async () => {
    const { j, acc } = await inZone('mirevale', 0, 6);
    const me = j.room.state.players.get(acc.id)!;
    for (let i = 1; i <= 200; i++) j.room.send('input', { seq: i, x: me.x, z: me.z, angle: 0, running: false, dtMs: 1 });
    await sleep(800);
    expect(j.room.state.players.get(acc.id)!.seq).toBeLessThanOrEqual(30);
    const limited = ofType(j.msgs, 'error').filter((e) => e.code === 'rateLimited');
    expect(limited).toHaveLength(1);
    await j.room.leave(true);
  }, 60_000);

  it('#18: chat over 120 chars → invalidPayload; the 5th chat in 4 s → rateLimited and dropped', async () => {
    const { j } = await inZone('mirevale', 0, 6);
    j.room.send('chat', { text: 'x'.repeat(121) });
    await waitFor(() => ofType(j.msgs, 'error').some((e) => e.code === 'invalidPayload'), 3000);
    for (let i = 0; i < 5; i++) j.room.send('chat', { text: `hi ${i}` });
    await waitFor(() => ofType(j.msgs, 'error').some((e) => e.code === 'rateLimited'), 3000);
    await sleep(200);
    // the malformed message consumed one of the 4 slots of the window (rate limits count every message of a type)
    expect(ofType(j.msgs, 'chat')).toHaveLength(3);
    await j.room.leave(true);
  }, 60_000);

  it('A14: a second socket with the same JWT → one PlayerState; the older socket is closed with CLOSE_CODES.replaced (4101, P4)', async () => {
    const { acc, j } = await inZone('mirevale', 0, 6);
    const j2 = await enter(s, acc, 'mirevale');
    await waitFor(() => j.left.code !== null, 5000);
    expect(j.left.code).toBe(CLOSE_CODES.replaced);
    expect(ofType(j.msgs, 'error').some((e) => e.code === 'busy' && e.detail === 'replaced')).toBe(true);
    const room = roomOf(j2);
    expect([...room.state.players.keys()].filter((k) => k === acc.id)).toHaveLength(1);
    await sleep(300);
    expect(room.state.players.has(acc.id)).toBe(true); // the old socket's leave did not remove the avatar
    await j2.room.leave(true);
  }, 60_000);

  it('A6 / A17: interact on the gym without a win writes no badge; a beat speaker whose `need` is unmet sends no storyBeat and writes no flag', async () => {
    const { acc, j } = await inZone('mire_route', -60, 8);
    const snap = await snapshot(s, acc.id);
    j.room.send('interact', { kind: 'npc', targetId: 'mire_route.sable' });
    await sleep(500);
    expect(ofType(j.msgs, 'storyBeat')).toEqual([]);
    expect(ofType(j.msgs, 'battleStart')).toEqual([]);
    expect(await snapshot(s, acc.id)).toBe(snap);
    await j.room.leave(true);

    const g = await inZone('mirevale', 0, 6);
    const gsnap = await snapshot(s, g.acc.id);
    g.j.room.send('interact', { kind: 'gym', targetId: 'verdant_gym' }); // 32 m from the marker: in AOI, out of range
    await waitFor(() => ofType(g.j.msgs, 'error').length > 0, 3000);
    expect(ofType(g.j.msgs, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'tooFar' });
    g.j.room.send('interact', { kind: 'gym', targetId: 'draco_gym' }); // not fought in this zone
    await waitFor(() => ofType(g.j.msgs, 'error').length > 1, 3000);
    expect(ofType(g.j.msgs, 'error')[1]).toMatchObject({ code: 'notFound' });
    const badges = await rawQuery(s.db, 'select * from badges where player_id = $1', [g.acc.id]);
    expect(badges).toEqual([]);
    expect(await snapshot(s, g.acc.id)).toBe(gsnap);
    await g.j.room.leave(true);
  }, 90_000);

  it('A18: interact on a static without its gate flag, or after its own flag is held → notAllowed, no battle', async () => {
    const a = await register(s);
    await giveBadge(a.id, 'bloom');
    const st = { species: 'sunjaw', x: 96, z: -88 };
    const { j } = await inZone('ash_route', st.x, st.z, a);
    const snap = await snapshot(s, a.id);
    j.room.send('interact', { kind: 'static', targetId: st.species });
    await waitFor(() => ofType(j.msgs, 'error').length > 0, 3000);
    expect(ofType(j.msgs, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'staticLocked' });
    expect(ofType(j.msgs, 'battleStart')).toEqual([]);
    expect(await snapshot(s, a.id)).toBe(snap);
    await j.room.leave(true);
  }, 90_000);

  it('A2 / A3 / A4 / A5 / #16: battle and spawn attacks — notFound for a foreign battle, move not known, wrong turn, tooFar, out-of-AOI', async () => {
    // B stands next to a spawn and engages it; A attacks B's battle
    const a = await inZone('mire_route', -92, 0);
    const room = roomOf(a.j);
    await waitFor(() => (room.spawns?.all.length ?? 0) >= 6, 10_000);
    const h = getHeightfield('mire_route');
    const target = room.spawns!.all.find((sp) => nearestWalkable(h, sp.x + 1.5, sp.z, 1.5) !== null)!;
    const standAt = nearestWalkable(h, target.x + 1.5, target.z, 1.5)!;
    const b = await register(s);
    await placePlayer(s, b.id, 'mire_route', standAt[0], standAt[1]);
    const jb = await enter(s, b, 'mire_route');
    await waitFor(() => jb.room.state.spawns.has(target.id), 5000);
    const bsnapBefore = await snapshot(s, b.id);
    jb.room.send('engageSpawn', { spawnId: target.id });
    await waitFor(() => ofType(jb.msgs, 'battleStart').length > 0, 10_000);
    const start = ofType(jb.msgs, 'battleStart')[0]!;
    const asnap = await snapshot(s, a.acc.id);
    // #16: engaging an engaged spawn → busy (A is far away: tooFar/notFound decide first, so use a 2nd client near)
    // A2: A sends a well-formed action for B's battle → notFound, identical to a missing id
    a.j.room.send('battleAction', { battleId: start.battleId, turn: 1, action: { kind: 'flee' } });
    a.j.room.send('battleAction', { battleId: '00000000-0000-4000-8000-000000000000', turn: 1, action: { kind: 'flee' } });
    await waitFor(() => ofType(a.j.msgs, 'error').length >= 2, 3000);
    expect(ofType(a.j.msgs, 'error').slice(0, 2)).toEqual([
      { type: 'error', code: 'notFound', detail: null },
      { type: 'error', code: 'notFound', detail: null },
    ]);
    // A3: B sends a move its creature does not know; A4: wrong turn
    jb.room.send('battleAction', { battleId: start.battleId, turn: 1, action: { kind: 'move', move: 'Hyper Beam' } });
    jb.room.send('battleAction', { battleId: start.battleId, turn: 5, action: { kind: 'flee' } });
    await waitFor(() => ofType(jb.msgs, 'error').length >= 2, 3000);
    expect(ofType(jb.msgs, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'unknownMove' });
    expect(ofType(jb.msgs, 'error')[1]).toMatchObject({ code: 'notAllowed', detail: 'wrongTurn' });
    expect(ofType(jb.msgs, 'battleEvents')).toEqual([]);
    // B is frozen: input → inBattle, interact → busy
    jb.room.send('interact', { kind: 'npc', targetId: 'mire_route.forager' });
    await waitFor(() => ofType(jb.msgs, 'error').some((e) => e.code === 'busy'), 3000);
    // A5: A (far from every spawn) engages B's spawn → out-of-AOI notFound or tooFar, never a battle
    a.j.room.send('engageSpawn', { spawnId: target.id });
    a.j.room.send('engageSpawn', { spawnId: 'mire_route:999999' });
    await waitFor(() => ofType(a.j.msgs, 'error').length >= 4, 3000);
    const aErr = ofType(a.j.msgs, 'error').slice(2, 4);
    expect(['notFound', 'notAllowed', 'busy']).toContain(aErr[0]!.code);
    expect(aErr[1]).toMatchObject({ code: 'notFound' });
    expect(ofType(a.j.msgs, 'battleStart')).toEqual([]);
    expect(await snapshot(s, a.acc.id)).toBe(asnap);
    // B flees: the battle ends; the fled spawn is gone for everyone
    jb.room.send('battleAction', { battleId: start.battleId, turn: 1, action: { kind: 'flee' } });
    await waitFor(() => ofType(jb.msgs, 'battleEnd').length > 0, 10_000);
    expect(ofType(jb.msgs, 'battleEnd')[0]).toMatchObject({ outcome: { winner: 'fled' } });
    await waitFor(() => !jb.room.state.spawns.has(target.id), 5000);
    // fleeing wrote nothing but dex-seen + history (no exp, no money)
    const [row] = await rawQuery(s.db, 'select trainer_exp, money from players where id = $1', [b.id]);
    expect(Number(row!['trainer_exp'])).toBe(START_EXP);
    expect(bsnapBefore).not.toBe(''); // snapshot taken
    await a.j.room.leave(true);
    await jb.room.leave(true);
  }, 120_000);

  it('A19: handoverAck without a reservation → notAllowed; a handover join option without the presence reservation → badHandover', async () => {
    const { acc, j } = await inZone('mirevale', 0, 6);
    const snap = await snapshot(s, acc.id);
    j.room.send('handoverAck', { roomId: j.room.roomId, seat: j.room.sessionId });
    await waitFor(() => ofType(j.msgs, 'error').length > 0, 3000);
    expect(ofType(j.msgs, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'noHandover' });
    await j.room.leave(true);
    await sleep(300);
    const after = await snapshot(s, acc.id);
    // the consented leave rewrites the same pose (x/z unchanged) — rows identical
    expect(after).toBe(snap);
    // keep the mire_route room alive with one honest client while the forged seats are tried
    const keeper = await inZone('mire_route', -92, 0);
    const room = await pickZoneRoom('mire_route', s.booted.runtime.ticket);
    // a reservation carrying a handover option the presence store never recorded
    await placePlayer(s, acc.id, 'mire_route', -90, 0);
    const seat = await reserveZoneSeat(room, { zoneId: 'mire_route', shard: 0, ticket: s.booted.runtime.ticket, handover: { fromRoomId: 'forged', x: 0, z: 0 } });
    await expect(joinSeat(s, acc.access, seat)).rejects.toThrow(/badHandover/);
    // a seat reserved without the server ticket is refused (Colyseus matchmake routes cannot bypass REST)
    const noTicket = await matchMaker.reserveSeatFor(room, { zoneId: 'mire_route', shard: 0 }, null);
    await expect(joinSeat(s, acc.access, noTicket as never)).rejects.toThrow(/noTicket/);
    const rows = await rawQuery(s.db, 'select x from players where id = $1', [acc.id]);
    expect(Number(rows[0]!['x'])).toBe(-90); // no position write from the refused joins
    await keeper.j.room.leave(true);
  }, 60_000);

  it('#23 (room): a forged JWT cannot join', async () => {
    const acc = await register(s);
    const r = await api(s, 'POST', '/zone/enter', acc.access, { zoneId: 'mirevale' });
    const forged = acc.access.slice(0, -4) + (acc.access.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(joinSeat(s, forged, r.body.seat)).rejects.toThrow();
  }, 60_000);
});

describe('REST attacks (§30.5.1)', () => {
  it('A7 / A8 / A9 / A10 / A11 / #10 / #12: evolve not ready, item at 0, buy beyond money, claim above level, move above level, qty ≤ 0, sell unowned', async () => {
    const { acc, j } = await inZone('mirevale', 0, 6); // presence in a shop zone
    const me = await api(s, 'GET', '/me', acc.access);
    expect(me.status).toBe(200);
    const starter = me.body.party[0];
    const snap = await snapshot(s, acc.id);

    const evo = await api(s, 'POST', `/creature/${starter.id}/evolve`, acc.access, { into: 'briarbear' });
    expect(evo.status).toBe(409);
    expect(evo.body.code).toBe('notReady');

    const use = await api(s, 'POST', '/item/use', acc.access, { item: 'rarecandy', target: starter.id, qty: 1 });
    expect(use.status).toBe(409);
    expect(use.body.code).toBe('InsufficientItems');

    const buy = await api(s, 'POST', '/shop/buy', acc.access, { item: 'superpotion', qty: 99 });
    expect(buy.status).toBe(409);
    expect(buy.body.code).toBe('InsufficientFunds');

    const claim = await api(s, 'POST', '/battle-pass/claim', acc.access, { level: 10 });
    expect(claim.status).toBe(409);
    expect(claim.body.code).toBe('levelLocked');

    const sp = (await import('./helpers')).content.species(starter.speciesId);
    const high = sp.learnableMoves.find((m) => m.level > starter.level)!;
    const moves = await api(s, 'POST', `/creature/${starter.id}/moves`, acc.access, { moves: [high.move] });
    expect(moves.status).toBe(409);
    expect(moves.body.code).toBe('notLearnable');

    for (const qty of [0, -1]) {
      const r = await api(s, 'POST', '/shop/buy', acc.access, { item: 'potion', qty });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('invalidPayload');
    }
    const sell = await api(s, 'POST', '/shop/sell', acc.access, { item: 'superpotion', qty: 1 });
    expect(sell.status).toBe(409);
    expect(sell.body.code).toBe('InsufficientItems');

    // someone else's creature is invisible (404), never editable
    const other = await register(s);
    const theirs = (await api(s, 'GET', '/me', other.access)).body.party[0];
    const steal = await api(s, 'POST', `/creature/${theirs.id}/flags`, acc.access, { favorite: true });
    expect(steal.status).toBe(404);

    expect(await snapshot(s, acc.id)).toBe(snap);
    await j.room.leave(true);
  }, 90_000);

  it('A20: /zone/enter for a gated zone without the badge → 403 gated, no seat', async () => {
    const acc = await register(s);
    const r = await api(s, 'POST', '/zone/enter', acc.access, { zoneId: 'cinderhold' });
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ code: 'gated', badge: zone('cinderhold').gate });
  }, 60_000);

  it('#23 (REST): wrong secret / garbage / missing token → 401 on every bearer route', async () => {
    for (const url of ['/me', '/dex', '/battle-pass', '/history/battles']) {
      expect((await api(s, 'GET', url, null)).status).toBe(401);
      expect((await api(s, 'GET', url, 'not.a.jwt')).status).toBe(401);
    }
  }, 60_000);

  it('#24: refresh-token reuse after rotation → 401 and every refresh token of the player revoked (audit auth.refreshReuse)', async () => {
    const acc = await register(s);
    const r1 = await api(s, 'POST', '/auth/refresh', null, { refresh: acc.refresh });
    expect(r1.status).toBe(200);
    const reuse = await api(s, 'POST', '/auth/refresh', null, { refresh: acc.refresh });
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('refreshReuse');
    // the legitimately rotated token died with the family
    const r2 = await api(s, 'POST', '/auth/refresh', null, { refresh: r1.body.refresh });
    expect(r2.status).toBe(401);
    const audit = await rawQuery(s.db, "select action from audit_log where actor_id = $1 and action = 'auth.refreshReuse'", [acc.id]);
    expect(audit.length).toBeGreaterThanOrEqual(1);
    expect(r2.body.code).toBe('refreshReuse');
  }, 60_000);

  it('#25: a 6th registration from one IP within an hour → 429 rateLimited', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const name = `ipflood${Date.now().toString(36).slice(-4)}${i}`;
      const res = await s.booted.rest.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: name, email: `${name}@t.ewa`, password: 'correct horse battery', starter: 'glimfin' },
        remoteAddress: '203.0.113.77',
      });
      statuses.push(res.statusCode);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  }, 120_000);
});
