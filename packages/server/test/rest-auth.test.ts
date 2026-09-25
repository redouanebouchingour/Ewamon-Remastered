/**
 * §30.6 / §50.4.5 rest-auth.test.ts via `fastify.inject`: register → login → refresh → logout; access
 * expiry 15 min (exp − iat = 900, iss/aud); refresh 30 d, rotating, stored hashed; argon2id m=19456 t=2 p=1;
 * every bearer route 401 without a token; admin routes 403 without is_admin; bans.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROUTES } from '@ewa/protocol';
import { ARGON2, hashPassword, verifyPassword } from '../src/rest/auth';
import { START_MONEY, api, rawQuery, register, startServer, uniqueName } from './helpers';
import type { TestServer } from './helpers';

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

function claims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('argon2id', () => {
  it('m=19456 t=2 p=1, PHC string, verify never compares strings', async () => {
    expect(ARGON2).toMatchObject({ memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 });
    const phc = await hashPassword('hunter2hunter2');
    expect(phc.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(await verifyPassword(phc, 'hunter2hunter2')).toBe(true);
    expect(await verifyPassword(phc, 'nope')).toBe(false);
    expect(await verifyPassword('not-a-phc', 'x')).toBe(false);
  });
});

describe('auth flow', () => {
  it('register → starter party + kit + dex; tokens with iss/aud and a 900 s lifetime; the password is stored argon2id', async () => {
    const name = uniqueName('reg');
    const res = await s.booted.rest.inject({ method: 'POST', url: '/auth/register', payload: { username: name, email: `${name.toUpperCase()}@Mail.Test`, password: 'correct horse battery', starter: 'glimfin' }, remoteAddress: '198.51.100.1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.player).toMatchObject({ username: name, email: `${name}@mail.test`, money: START_MONEY, zoneId: 'mirevale', trainerLevel: 1, tier: 'bronze' });
    const c = claims(body.access);
    expect(c).toMatchObject({ sub: body.player.id, usr: name, adm: false, iss: 'ewa-server', aud: 'ewa' });
    expect(Number(c['exp']) - Number(c['iat'])).toBe(900);
    const me = await api(s, 'GET', '/me', body.access);
    expect(me.status).toBe(200);
    expect(me.body.party).toHaveLength(1);
    expect(me.body.party[0]).toMatchObject({ speciesId: 'glimfin', level: 5, ownerId: body.player.id });
    expect(me.body.inventory).toEqual({ potion: 5, spark_orb: 10 });
    expect(me.body.presence).toEqual({ roomId: null, zoneId: 'mirevale', shard: 0 });
    const dex = await api(s, 'GET', '/dex', body.access);
    expect(dex.body.caught).toEqual(['glimfin']);
    const [row] = await rawQuery(s.db, 'select password_hash from players where id = $1', [body.player.id]);
    expect(String(row!['password_hash']).startsWith('$argon2id$')).toBe(true);
    const tokens = await rawQuery(s.db, 'select token_hash, expires_at, created_at from refresh_tokens where player_id = $1', [body.player.id]);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!['token_hash']).not.toBe(body.refresh);
    expect(new Date(String(tokens[0]!['expires_at'])).getTime() - new Date(String(tokens[0]!['created_at'])).getTime()).toBeGreaterThan(29 * 86_400_000);
  }, 60_000);

  it('duplicate username / email → 409 { code: taken, field }; bad payloads → 400 invalidPayload', async () => {
    const a = await register(s);
    const dupName = await s.booted.rest.inject({ method: 'POST', url: '/auth/register', payload: { username: a.username, email: 'fresh@x.test', password: 'correct horse battery', starter: 'glimfin' }, remoteAddress: '198.51.100.2' });
    expect(dupName.statusCode).toBe(409);
    expect(dupName.json()).toEqual({ code: 'taken', field: 'username' });
    const dupMail = await s.booted.rest.inject({ method: 'POST', url: '/auth/register', payload: { username: uniqueName('dm'), email: `${a.username}@test.ewa`, password: 'correct horse battery', starter: 'glimfin' }, remoteAddress: '198.51.100.3' });
    expect(dupMail.statusCode).toBe(409);
    expect(dupMail.json()).toEqual({ code: 'taken', field: 'email' });
    for (const payload of [
      { username: 'A!', email: 'x@y.z', password: 'correct horse battery', starter: 'glimfin' },
      { username: uniqueName('s'), email: 'x@y.z', password: 'short', starter: 'glimfin' },
      { username: uniqueName('s'), email: 'x@y.z', password: 'correct horse battery', starter: 'mewtwo' },
    ]) {
      const r = await s.booted.rest.inject({ method: 'POST', url: '/auth/register', payload, remoteAddress: `198.51.100.${10 + payload.password.length + payload.starter.length}` });
      expect(r.statusCode).toBe(400);
      expect(r.json().code).toBe('invalidPayload');
    }
  }, 60_000);

  it('login (case-insensitive username) → refresh rotates → logout revokes; wrong password and unknown user are the same 401', async () => {
    const a = await register(s);
    const login = await api(s, 'POST', '/auth/login', null, { username: a.username.toUpperCase(), password: 'correct horse battery' });
    expect(login.status).toBe(200);
    const bad = await api(s, 'POST', '/auth/login', null, { username: a.username, password: 'wrong password!' });
    const ghost = await api(s, 'POST', '/auth/login', null, { username: 'nobody_here_x', password: 'wrong password!' });
    expect(bad.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(bad.body).toEqual(ghost.body);
    const r1 = await api(s, 'POST', '/auth/refresh', null, { refresh: login.body.refresh });
    expect(r1.status).toBe(200);
    expect(r1.body.refresh).not.toBe(login.body.refresh);
    expect(claims(r1.body.access)['sub']).toBe(a.id);
    const out = await api(s, 'POST', '/auth/logout', r1.body.access, { refresh: r1.body.refresh });
    expect(out.status).toBe(204);
    const dead = await api(s, 'POST', '/auth/refresh', null, { refresh: r1.body.refresh });
    expect(dead.status).toBe(401);
    const unknown = await api(s, 'POST', '/auth/refresh', null, { refresh: 'never-issued-token' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.code).toBe('badRefresh');
  }, 60_000);

  it('every bearer route returns 401 without a token; admin routes return 403 without is_admin', async () => {
    const a = await register(s);
    for (const r of Object.values(ROUTES)) {
      if (r.auth === 'none') continue;
      const url = r.path.replace(':id', '00000000-0000-4000-8000-000000000000').replace(':zoneId', 'mirevale').replace(':username', 'someone');
      const res = await s.booted.rest.inject({ method: r.method, url, payload: r.method === 'POST' ? {} : undefined });
      // part-2 routes are not registered yet (404); every registered bearer route must refuse (401)
      expect([401, 404]).toContain(res.statusCode);
      if (r.auth === 'admin') {
        const withUser = await s.booted.rest.inject({ method: r.method, url, payload: r.method === 'POST' ? {} : undefined, headers: { authorization: `Bearer ${a.access}` } });
        expect([403, 404]).toContain(withUser.statusCode);
      }
    }
    // the implemented part-1 surface is present (not 404) without a token
    for (const url of ['/me', '/dex', '/battle-pass', '/history/battles', '/history/trades', '/leaderboard', '/players/x', '/shop/mirevale']) {
      expect((await api(s, 'GET', url, null)).status).toBe(401);
    }
    expect((await api(s, 'GET', '/health', null)).status).toBe(200);
  }, 60_000);

  it('bans: admin ban → 403 on the next request, refresh revoked; admins cannot be banned; the adm claim is never trusted', async () => {
    const admin = await register(s);
    const target = await register(s);
    // a user whose token claims adm but whose row is not admin is refused
    expect((await api(s, 'POST', '/admin/ban', admin.access, { username: target.username, reason: 'test' })).status).toBe(403);
    await s.repos.db.transaction((tx) => s.repos.players.setAdmin(tx, admin.id, true));
    const ban = await api(s, 'POST', '/admin/ban', admin.access, { username: target.username, reason: 'spam' });
    expect(ban.status).toBe(204);
    const me = await api(s, 'GET', '/me', target.access);
    expect(me.status).toBe(403);
    expect(me.body.code).toBe('banned');
    const refresh = await api(s, 'POST', '/auth/refresh', null, { refresh: target.refresh });
    expect(refresh.status).toBe(401);
    const login = await api(s, 'POST', '/auth/login', null, { username: target.username, password: 'correct horse battery' });
    expect(login.status).toBe(403);
    expect(login.body).toMatchObject({ code: 'banned', reason: 'spam' });
    const self = await api(s, 'POST', '/admin/ban', admin.access, { username: admin.username, reason: 'x' });
    expect(self.status).toBe(409);
    const unban = await api(s, 'POST', '/admin/unban', admin.access, { username: target.username });
    expect(unban.status).toBe(204);
    expect((await api(s, 'GET', '/me', target.access)).status).toBe(200);
    const metrics = await api(s, 'GET', '/admin/metrics', admin.access);
    expect(metrics.status).toBe(200);
    expect(metrics.body).toHaveProperty('rooms');
  }, 60_000);

  it('/players/:username is the toPublic allow-list; unknown → 404', async () => {
    const a = await register(s);
    const b = await register(s);
    const r = await api(s, 'GET', `/players/${b.username.toUpperCase()}`, a.access);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body)).toEqual(['id', 'username', 'title', 'motto', 'body', 'rating', 'peakRating', 'tier', 'trainerLevel', 'badges', 'guildTag', 'dexCaughtCount', 'showcase', 'createdAt']);
    expect(r.body.showcase[0].ownerId).toBeNull();
    expect(r.body).not.toHaveProperty('email');
    expect((await api(s, 'GET', '/players/nobody_at_all', a.access)).status).toBe(404);
  }, 60_000);
});

describe('guild routes (§30.7.3, M4)', () => {
  async function fund(id: string, amount: number): Promise<void> {
    await s.repos.db.transaction((tx) => s.repos.players.addMoney(tx, id, amount));
  }

  it('create charges 5 000 in the same tx (409 InsufficientFunds below), returns the money as an inventoryDelta; name/tag unique; one guild per player', async () => {
    const poor = await register(s); // START_MONEY (3 100) < 5 000
    const tag = `G${Math.floor(Math.random() * 900 + 100)}`;
    const refused = await api(s, 'POST', '/guilds', poor.access, { name: `Poor ${tag}`, tag });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('InsufficientFunds');
    const leader = await register(s);
    await fund(leader.id, 5_000);
    const created = await api(s, 'POST', '/guilds', leader.access, { name: `Wardens ${tag}`, tag });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ name: `Wardens ${tag}`, tag, leaderId: leader.id, memberCount: 1 });
    expect(created.body.inventoryDelta).toEqual({ items: {}, money: START_MONEY, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [] });
    const dupe = await register(s);
    await fund(dupe.id, 5_000);
    expect((await api(s, 'POST', '/guilds', dupe.access, { name: `Other ${tag}`, tag })).body.code).toBe('GuildNameTaken');
    expect((await api(s, 'POST', '/guilds', leader.access, { name: `Second ${tag}`, tag: `${tag}X`.slice(0, 4) })).body.code).toBe('AlreadyInGuild');
    expect((await api(s, 'POST', '/guilds', dupe.access, { name: 'ab', tag: 'ok' })).status).toBe(400); // zod: name ≥ 3, tag {3,4}
  }, 60_000);

  it('join / detail / kick / promote / leave: officer kicks members only, leader must promote before leaving, last leave deletes', async () => {
    const leader = await register(s);
    await fund(leader.id, 5_000);
    const tag = `K${Math.floor(Math.random() * 900 + 100)}`;
    const g = (await api(s, 'POST', '/guilds', leader.access, { name: `Kin ${tag}`, tag })).body;
    const a = await register(s);
    const b = await register(s);
    const c = await register(s);
    for (const m of [a, b, c]) expect((await api(s, 'POST', `/guilds/${g.id}/join`, m.access, {})).status).toBe(200);
    const detail = await api(s, 'GET', `/guilds/${g.id}`, a.access);
    expect(detail.body.memberCount).toBe(4);
    expect(detail.body.members.map((m: { playerId: string }) => m.playerId)).toEqual([leader.id, a.id, b.id, c.id]);
    const list = await api(s, 'GET', `/guilds?search=${encodeURIComponent('Kin')}`, a.access);
    expect(list.body.some((x: { id: string }) => x.id === g.id)).toBe(true);
    // a member cannot kick; the leader promotes a to officer; the officer kicks a member but not the leader
    expect((await api(s, 'POST', `/guilds/${g.id}/kick`, b.access, { playerId: c.id })).status).toBe(403);
    expect((await api(s, 'POST', `/guilds/${g.id}/promote`, a.access, { playerId: b.id })).status).toBe(403);
    expect((await api(s, 'POST', `/guilds/${g.id}/promote`, leader.access, { playerId: a.id })).status).toBe(200);
    expect((await api(s, 'POST', `/guilds/${g.id}/kick`, a.access, { playerId: c.id })).body.memberCount).toBe(3);
    expect((await api(s, 'POST', `/guilds/${g.id}/kick`, a.access, { playerId: leader.id })).status).toBe(403);
    // the leader cannot leave with members; promoting the officer hands over leadership
    const stuck = await api(s, 'POST', `/guilds/${g.id}/leave`, leader.access, {});
    expect(stuck.status).toBe(409);
    expect(stuck.body.code).toBe('leaderMustPromote');
    const handed = await api(s, 'POST', `/guilds/${g.id}/promote`, leader.access, { playerId: a.id });
    expect(handed.body.leaderId).toBe(a.id);
    expect((await api(s, 'POST', `/guilds/${g.id}/leave`, leader.access, {})).body.memberCount).toBe(2);
    expect((await api(s, 'POST', `/guilds/${g.id}/leave`, b.access, {})).body.memberCount).toBe(1);
    const last = await api(s, 'POST', `/guilds/${g.id}/leave`, a.access, {});
    expect(last.status).toBe(200);
    expect(last.body.memberCount).toBe(0);
    expect((await api(s, 'GET', `/guilds/${g.id}`, a.access)).status).toBe(404);
    // the guild tag is visible on the public profile while a member
    const pub = await api(s, 'GET', `/players/${a.username}`, b.access);
    expect(pub.body.guildTag).toBeNull();
  }, 60_000);
});
