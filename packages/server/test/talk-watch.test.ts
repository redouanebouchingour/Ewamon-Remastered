/**
 * Talking to other players and watching battles in the open world, against a real server:
 * - DMs to a non-friend when their DMs are open, 409 dmsClosed when friends-only or blocked (either way, same code);
 *   GET /social/prefs · POST /social/prefs; GET /social/relation; GET /conversations (friends or not, unread counts);
 * - blocks: friend requests refused (requestRefused), a friendship ends, the room refuses challenges and trade
 *   requests between them and drops their world chat to each other; unblock restores it;
 * - a battle near a player: `BattleSummary.field` / `trainers` / `angle` for the spectators, `battleWatch` after each
 *   turn to players within range (never the fighters), hp as a percentage only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getHeightfield, nearestWalkable } from '@ewa/content';
import { api, enter, ofType, placePlayer, register, sleep, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

async function inZone(x: number, z: number, acc?: Account): Promise<{ acc: Account; j: Joined }> {
  const a = acc ?? (await register(s));
  const p = nearestWalkable(getHeightfield('mirevale'), x, z, 12)!;
  await placePlayer(s, a.id, 'mirevale', p[0], p[1]);
  return { acc: a, j: await enter(s, a, 'mirevale') };
}

describe('messages between players who are not friends', () => {
  it('open DMs by default; friends-only closes them; relation and conversations follow', async () => {
    const a = await register(s);
    const b = await register(s);
    expect((await api(s, 'GET', '/social/prefs', b.access)).body).toEqual({ dmsFrom: 'everyone' });
    expect((await api(s, 'GET', `/social/relation/${b.username}`, a.access)).body).toMatchObject({ id: b.id, friend: 'none', blocked: false, canMessage: true });
    const sent = await api(s, 'POST', `/messages/${b.username}`, a.access, { text: 'nice team!' });
    expect(sent.status).toBe(200);
    const convRes = await api(s, 'GET', '/conversations', b.access);
    const convB = convRes.body.conversations;
    expect(convB).toEqual([{ username: a.username, lastText: 'nice team!', lastAt: sent.body.sentAt, fromMe: false, unread: 1, friend: false }]);
    expect((await api(s, 'GET', '/conversations', a.access)).body.conversations[0]).toMatchObject({ username: b.username, fromMe: true, unread: 0 });
    // friends only: a stranger's DM is refused, a friend's still goes through
    expect((await api(s, 'POST', '/social/prefs', b.access, { dmsFrom: 'friends' })).body).toEqual({ dmsFrom: 'friends' });
    expect((await api(s, 'GET', `/social/relation/${b.username}`, a.access)).body.canMessage).toBe(false);
    const closed = await api(s, 'POST', `/messages/${b.username}`, a.access, { text: 'hello?' });
    expect(closed).toMatchObject({ status: 409, body: { code: 'dmsClosed' } });
    await api(s, 'POST', '/friends/request', a.access, { username: b.username });
    expect((await api(s, 'GET', `/social/relation/${b.username}`, a.access)).body.friend).toBe('outgoing');
    expect((await api(s, 'GET', `/social/relation/${a.username}`, b.access)).body.friend).toBe('incoming');
    await api(s, 'POST', '/friends/accept', b.access, { username: a.username });
    expect((await api(s, 'POST', `/messages/${b.username}`, a.access, { text: 'now?' })).status).toBe(200);
    expect((await api(s, 'GET', '/conversations', b.access)).body.conversations[0]).toMatchObject({ lastText: 'now?', unread: 2, friend: true });
    expect((await api(s, 'POST', '/social/prefs', b.access, { dmsFrom: 'nobody' })).status).toBe(400);
  }, 60_000);

  it('a block ends the friendship and refuses DMs and friend requests both ways, with codes that do not say who blocked', async () => {
    const a = await register(s);
    const b = await register(s);
    await api(s, 'POST', '/friends/request', a.access, { username: b.username });
    await api(s, 'POST', '/friends/accept', b.access, { username: a.username });
    const blocked = await api(s, 'POST', '/social/block', b.access, { username: a.username });
    expect(blocked.body.blocked.map((x: { id: string }) => x.id)).toEqual([a.id]);
    expect((await api(s, 'GET', '/friends', a.access)).body.friends).toEqual([]);
    expect((await api(s, 'POST', `/messages/${b.username}`, a.access, { text: 'hey' })).body.code).toBe('dmsClosed');
    expect((await api(s, 'POST', `/messages/${a.username}`, b.access, { text: 'hey' })).body.code).toBe('dmsClosed');
    expect((await api(s, 'POST', '/friends/request', a.access, { username: b.username })).body.code).toBe('requestRefused');
    expect((await api(s, 'GET', `/social/relation/${a.username}`, b.access)).body).toMatchObject({ blocked: true, canMessage: false });
    // the blocked side only sees that a message would not go through
    expect((await api(s, 'GET', `/social/relation/${b.username}`, a.access)).body).toMatchObject({ blocked: false, canMessage: false });
    expect((await api(s, 'POST', '/social/block', b.access, { username: b.username })).status).toBe(409);
    expect((await api(s, 'POST', '/social/unblock', b.access, { username: a.username })).body.blocked).toEqual([]);
    expect((await api(s, 'POST', `/messages/${b.username}`, a.access, { text: 'hey' })).status).toBe(200);
  }, 60_000);
});

describe('blocks in the world', () => {
  it('no challenge, no trade request and no chat between a blocked pair; unblocking restores them', async () => {
    const a = await inZone(0, 6);
    const b = await inZone(1.5, 6);
    await waitFor(() => a.j.room.state.players.has(b.acc.id) && b.j.room.state.players.has(a.acc.id), 5000);
    await api(s, 'POST', '/social/block', b.acc.access, { username: a.acc.username });
    await sleep(300);
    a.j.room.send('challenge', { targetId: b.acc.id });
    a.j.room.send('tradeRequest', { targetId: b.acc.id });
    a.j.room.send('chat', { text: 'hello there' });
    await waitFor(() => ofType(a.j.msgs, 'error').length >= 2, 3000);
    expect(ofType(a.j.msgs, 'error').slice(0, 2)).toEqual([
      { type: 'error', code: 'notAllowed', detail: 'unavailable' },
      { type: 'error', code: 'notAllowed', detail: 'unavailable' },
    ]);
    await sleep(300);
    expect(ofType(b.j.msgs, 'challengeReceived')).toEqual([]);
    expect(ofType(b.j.msgs, 'tradeUpdate')).toEqual([]);
    expect(ofType(b.j.msgs, 'chat')).toEqual([]);
    await api(s, 'POST', '/social/unblock', b.acc.access, { username: a.acc.username });
    await sleep(1100);
    a.j.room.send('chat', { text: 'hello again' });
    await waitFor(() => ofType(b.j.msgs, 'chat').length === 1, 3000);
    a.j.room.send('challenge', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'challengeReceived').length === 1, 3000);
    await a.j.room.leave(true);
    await b.j.room.leave(true);
  }, 60_000);
});

describe('watching a battle in the open world', () => {
  it('spectators near the ring get the field and each turn; the fighters do not; hp only as a percentage', async () => {
    const a = await inZone(0, 6);
    const b = await inZone(1.5, 6);
    const c = await inZone(-3, 8);
    await waitFor(() => [a, b, c].every((p) => p.j.room.state.players.size === 3), 5000);
    a.j.room.send('challenge', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'challengeReceived').length === 1, 3000);
    b.j.room.send('challengeReply', { fromId: a.acc.id, accept: true });
    await waitFor(() => ofType(a.j.msgs, 'battleStart').length === 1 && ofType(b.j.msgs, 'battleStart').length === 1, 5000);
    const start = ofType(a.j.msgs, 'battleStart')[0]!;
    await waitFor(() => c.j.room.state.battles.has(start.battleId), 3000);
    const summary = c.j.room.state.battles.get(start.battleId)!;
    expect([...summary.trainers]).toEqual([a.acc.username, b.acc.username]);
    expect([...summary.field].map((f) => ({ side: f.side, pos: f.pos, species: f.species, hpPct: f.hpPct }))).toEqual(
      start.state.sides.map((side, i) => ({ side: i, pos: 0, species: side.party[side.active]!.creature.speciesId, hpPct: 100 })),
    );
    // one turn: both use their first move
    const moveOf = (seat: 0 | 1): string => start.state.sides[seat].party[start.state.sides[seat].active]!.creature.moves[0]!.id;
    const startB = ofType(b.j.msgs, 'battleStart')[0]!;
    a.j.room.send('battleAction', { battleId: start.battleId, turn: 1, action: { kind: 'move', move: moveOf(start.seat as 0 | 1) } });
    b.j.room.send('battleAction', { battleId: startB.battleId, turn: 1, action: { kind: 'move', move: moveOf(startB.seat as 0 | 1) } });
    await waitFor(() => ofType(c.j.msgs, 'battleWatch').length === 1, 5000);
    const watch = ofType(c.j.msgs, 'battleWatch')[0]!;
    expect(watch).toMatchObject({ battleId: start.battleId, turn: 1 });
    expect(watch.events.filter((e) => e.k === 'move')).toHaveLength(2);
    for (const e of watch.events) {
      expect(Object.keys(e)).not.toContain('amount');
      if (e.k === 'hit') expect(e.hpPct).toBeLessThanOrEqual(100);
    }
    await waitFor(() => c.j.room.state.battles.get(start.battleId)?.turn === 1, 3000);
    expect(ofType(a.j.msgs, 'battleWatch')).toEqual([]);
    expect(ofType(b.j.msgs, 'battleWatch')).toEqual([]);
    for (const p of [a, b, c]) await p.j.room.leave(true);
  }, 60_000);
});
