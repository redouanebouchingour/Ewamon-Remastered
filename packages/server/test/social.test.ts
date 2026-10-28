/**
 * §30.7 social against a real server: friends (FriendView online/zoneId/inBattle from presence), persisted DMs
 * pushed live as `dm` to the recipient's room, the DM filter (hard reject), mark-read → /me unreadDm, and the
 * `ewa:profile` refresh of `PlayerState.guildTag` / `body` while the player is in a room.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, enter, ofType, register, sleep, startServer, waitFor } from './helpers';
import type { TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

describe('friends (§30.7.1)', () => {
  it('request → incoming/outgoing; accept → friends with presence fields; decline, remove; self 409, banned/unknown 404; a reverse request accepts', async () => {
    const a = await register(s);
    const b = await register(s);
    const c = await register(s);
    const req = await api(s, 'POST', '/friends/request', a.access, { username: b.username.toUpperCase() });
    expect(req.status).toBe(200);
    expect(req.body.outgoing.map((f: { id: string }) => f.id)).toEqual([b.id]);
    const bView = await api(s, 'GET', '/friends', b.access);
    expect(bView.body.incoming.map((f: { id: string }) => f.id)).toEqual([a.id]);
    expect((await api(s, 'GET', '/me', b.access)).body.friendRequests).toBe(1);
    // b is offline; after b enters a zone the friend view says online + zone
    const acc = await api(s, 'POST', '/friends/accept', b.access, { username: a.username });
    expect(acc.body.friends.map((f: { id: string }) => f.id)).toEqual([a.id]);
    let aView = (await api(s, 'GET', '/friends', a.access)).body.friends[0];
    expect(aView).toMatchObject({ id: b.id, username: b.username, online: false, zoneId: null, inBattle: false });
    expect(typeof aView.lastSeenAt).toBe('string');
    const jb = await enter(s, b, 'mirevale');
    aView = (await api(s, 'GET', '/friends', a.access)).body.friends[0];
    expect(aView).toMatchObject({ online: true, zoneId: 'mirevale', inBattle: false });
    await jb.room.leave(true);
    await sleep(200);
    expect((await api(s, 'GET', '/friends', a.access)).body.friends[0].online).toBe(false);
    // errors
    expect((await api(s, 'POST', '/friends/request', a.access, { username: a.username })).status).toBe(409);
    expect((await api(s, 'POST', '/friends/request', a.access, { username: 'nobody_here_x' })).status).toBe(404);
    expect((await api(s, 'POST', '/friends/request', a.access, { username: b.username })).body.code).toBe('AlreadyFriends');
    // c asks a; a asking c back accepts the pending row instead of inserting a mirror
    await api(s, 'POST', '/friends/request', c.access, { username: a.username });
    const back = await api(s, 'POST', '/friends/request', a.access, { username: c.username });
    expect(back.body.friends.map((f: { id: string }) => f.id).sort()).toEqual([b.id, c.id].sort());
    expect((await api(s, 'POST', '/friends/remove', a.access, { username: c.username })).body.friends.map((f: { id: string }) => f.id)).toEqual([b.id]);
    // decline an incoming request
    const d = await register(s);
    await api(s, 'POST', '/friends/request', d.access, { username: a.username });
    expect((await api(s, 'POST', '/friends/decline', a.access, { username: d.username })).body.incoming).toEqual([]);
    // a banned player is indistinguishable from an unknown one
    await s.repos.db.transaction((tx) => s.repos.players.ban(tx, d.id, 'x', new Date()));
    expect((await api(s, 'POST', '/friends/request', a.access, { username: d.username })).status).toBe(404);
  }, 60_000);
});

describe('DMs (§30.7.2)', () => {
  it('friends only when the recipient says so; sanitised; blocked words rejected; stored and pushed live as `dm`; thread paging; mark read clears unreadDm', async () => {
    const a = await register(s);
    const b = await register(s);
    const stranger = await register(s);
    // talking to other players: DMs are open by default; friends-only closes them to strangers
    await api(s, 'POST', '/social/prefs', b.access, { dmsFrom: 'friends' });
    await api(s, 'POST', '/social/prefs', stranger.access, { dmsFrom: 'friends' });
    expect((await api(s, 'POST', `/messages/${b.username}`, a.access, { text: 'hi' })).body.code).toBe('dmsClosed');
    await api(s, 'POST', '/friends/request', a.access, { username: b.username });
    await api(s, 'POST', '/friends/accept', b.access, { username: a.username });
    const jb = await enter(s, b, 'mirevale');
    const sent = await api(s, 'POST', `/messages/${b.username}`, a.access, { text: '  hello ​  there  ' });
    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({ fromId: a.id, toId: b.id, text: 'hello there', readAt: null });
    await waitFor(() => ofType(jb.msgs, 'dm').length === 1, 3000);
    const dm = ofType(jb.msgs, 'dm')[0]!;
    expect(dm).toEqual({ type: 'dm', id: sent.body.id, fromId: a.id, fromName: a.username, text: 'hello there', sentAt: Date.parse(sent.body.sentAt) });
    // the hard reject: nothing stored, nothing pushed
    const bad = await api(s, 'POST', `/messages/${b.username}`, a.access, { text: 'you b1tch' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('blockedWord');
    expect((await api(s, 'POST', `/messages/${b.username}`, a.access, { text: '​​' })).status).toBe(400);
    await api(s, 'POST', `/messages/${a.username}`, b.access, { text: 'hey back' });
    await api(s, 'POST', `/messages/${b.username}`, a.access, { text: 'third' });
    await sleep(100);
    expect(ofType(jb.msgs, 'dm')).toHaveLength(2);
    const thread = await api(s, 'GET', `/messages/${a.username}?limit=2`, b.access);
    expect(thread.body.messages.map((m: { text: string }) => m.text)).toEqual(['third', 'hey back']);
    const older = await api(s, 'GET', `/messages/${a.username}?before=${encodeURIComponent(thread.body.messages[1].sentAt)}`, b.access);
    expect(older.body.messages.map((m: { text: string }) => m.text)).toEqual(['hello there']);
    expect((await api(s, 'GET', '/me', b.access)).body.unreadDm).toEqual({ [a.id]: 2 });
    expect((await api(s, 'POST', '/messages/read', b.access, { username: a.username })).status).toBe(204);
    expect((await api(s, 'GET', '/me', b.access)).body.unreadDm).toEqual({});
    expect((await api(s, 'POST', `/messages/${stranger.username}`, a.access, { text: 'x' })).status).toBe(409);
    await jb.room.leave(true);
  }, 60_000);
});

describe('ewa:profile (§30.5, §30.7.3)', () => {
  it('founding a guild and changing body refresh PlayerState.guildTag / body in the room', async () => {
    const a = await register(s);
    await s.repos.db.transaction((tx) => s.repos.players.addMoney(tx, a.id, 5_000));
    const j = await enter(s, a, 'mirevale');
    expect(j.room.state.players.get(a.id)!.guildTag).toBe('');
    const tag = `P${Math.floor(Math.random() * 900 + 100)}`;
    expect((await api(s, 'POST', '/guilds', a.access, { name: `Prof ${tag}`, tag })).status).toBe(200);
    await waitFor(() => j.room.state.players.get(a.id)!.guildTag === tag, 3000);
    const bodies = ['ranger_f', 'ranger_m'];
    const next = bodies.find((b) => b !== j.room.state.players.get(a.id)!.body)!;
    const prof = await api(s, 'POST', '/profile', a.access, { body: next });
    expect(prof.status).toBe(200);
    await waitFor(() => j.room.state.players.get(a.id)!.body === next, 3000);
    await j.room.leave(true);
  }, 60_000);
});
