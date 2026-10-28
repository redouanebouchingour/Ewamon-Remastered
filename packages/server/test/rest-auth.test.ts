/**
 * §30.6 / §50.4.5 rest-auth.test.ts via `fastify.inject`: register → login → refresh → logout; access
 * expiry 15 min (exp − iat = 900, iss/aud); refresh 30 d, rotating, stored hashed; argon2id m=19456 t=2 p=1;
 * every bearer route 401 without a token; admin routes 403 without is_admin; bans.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProcessMetricsSchema, ROUTES } from '@ewa/protocol';
import { ARGON2, hashPassword, verifyPassword } from '../src/rest/auth';
import { RESET_TTL_MS, isMemoryMailer, tokenOf } from '../src/mail/mailer';
import type { MailMessage, MemoryMailer } from '../src/mail/mailer';
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
      // every route of the table is registered (part 2): no token → 401, a non-admin on an admin route → 403
      expect(res.statusCode, `${r.method} ${r.path}`).toBe(401);
      if (r.auth === 'admin') {
        const withUser = await s.booted.rest.inject({ method: r.method, url, payload: r.method === 'POST' ? {} : undefined, headers: { authorization: `Bearer ${a.access}` } });
        expect(withUser.statusCode, `${r.method} ${r.path}`).toBe(403);
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
    expect(ProcessMetricsSchema.safeParse(metrics.body).success).toBe(true);
    expect(Object.keys(metrics.body.rest).some((k) => k === 'GET /me')).toBe(true);
    const stats = await api(s, 'GET', '/admin/stats', admin.access);
    expect(stats.status).toBe(200);
    expect(stats.body.total).toBeGreaterThanOrEqual(2);
    expect(stats.body.banned).toBe(0);
    const found = await api(s, 'GET', `/admin/players?q=${encodeURIComponent(target.username)}`, admin.access);
    expect(found.body.rows.map((r: { id: string }) => r.id)).toEqual([target.id]);
    expect((await api(s, 'GET', `/admin/players?q=${encodeURIComponent('%')}`, admin.access)).body.total).toBe(0);
    const lb = await api(s, 'GET', '/leaderboard?mode=dex', admin.access);
    expect(lb.status).toBe(200);
    expect(lb.body.rows.length).toBeGreaterThan(0);
  }, 60_000);

  it('/players/:username is the toPublic allow-list; unknown → 404', async () => {
    const a = await register(s);
    const b = await register(s);
    const r = await api(s, 'GET', `/players/${b.username.toUpperCase()}`, a.access);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body)).toEqual(['id', 'username', 'title', 'motto', 'body', 'rating', 'peakRating', 'tier', 'trainerLevel', 'badges', 'guildTag', 'dexCaughtCount', 'showcase', 'createdAt', 'banner']);
    expect(r.body.showcase[0].ownerId).toBeNull();
    expect(r.body).not.toHaveProperty('email');
    expect((await api(s, 'GET', '/players/nobody_at_all', a.access)).status).toBe(404);
  }, 60_000);
});

describe('Phase C6: password reset + email verification', () => {
  let ipSeq = 0;
  /** every call from its own address unless one is given (the email routes are limited per IP) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON response bodies are asserted field by field
  async function post(url: string, payload: unknown, opts: { ip?: string; token?: string } = {}): Promise<{ status: number; body: any }> {
    ipSeq += 1;
    const res = await s.booted.rest.inject({
      method: 'POST',
      url,
      payload: payload as object,
      remoteAddress: opts.ip ?? `203.0.113.${ipSeq % 250}`,
      headers: opts.token !== undefined ? { authorization: `Bearer ${opts.token}` } : {},
    });
    return { status: res.statusCode, body: res.body.length > 0 ? res.json() : null };
  }
  function mailer(): MemoryMailer {
    const m = s.booted.runtime.mailer;
    if (!isMemoryMailer(m)) throw new Error('NODE_ENV=test without SMTP must default to the memory mailer');
    return m;
  }
  function mailsTo(address: string, tag: MailMessage['tag']): MailMessage[] {
    return mailer().sent.filter((m) => m.to === address && m.tag === tag);
  }
  const emailOf = (a: { username: string }): string => `${a.username}@test.ewa`;

  it('registration sends a verification link (non-blocking: /me works and says emailVerified: false)', async () => {
    const a = await register(s);
    const mails = mailsTo(emailOf(a), 'verify');
    expect(mails).toHaveLength(1);
    expect(mails[0]!.text).toContain('http://localhost:5173/verify?token=');
    expect(mails[0]!.html).toContain('/verify?token=');
    const me = await api(s, 'GET', '/me', a.access);
    expect(me.status).toBe(200);
    expect(me.body.emailVerified).toBe(false);
  }, 60_000);

  it('forgot is always 204 — unknown email included — and mails only a known address; 5/h per IP → 429; 3 mails/h per address', async () => {
    const a = await register(s);
    const unknown = await post('/auth/forgot', { email: 'nobody-at-all@nowhere.test' });
    expect(unknown.status).toBe(204);
    expect(unknown.body).toBeNull();
    expect(mailer().sent.some((m) => m.to === 'nobody-at-all@nowhere.test')).toBe(false);
    const known = await post('/auth/forgot', { email: emailOf(a).toUpperCase() });
    expect(known.status).toBe(204);
    const mails = mailsTo(emailOf(a), 'reset');
    expect(mails).toHaveLength(1);
    expect(mails[0]!.text).toContain('http://localhost:5173/reset?token=');
    // the token is stored hashed only
    const rows = await rawQuery(s.db, "select token_hash, kind, expires_at, created_at from email_tokens where player_id = $1 and kind = 'reset'", [a.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!['token_hash']).not.toBe(tokenOf(mails[0]!));
    expect(new Date(String(rows[0]!['expires_at'])).getTime() - new Date(String(rows[0]!['created_at'])).getTime()).toBe(RESET_TTL_MS);
    // per address: the 2nd and 3rd mail go out, the 4th is answered 204 and dropped
    for (let i = 0; i < 3; i++) expect((await post('/auth/forgot', { email: emailOf(a) })).status).toBe(204);
    expect(mailsTo(emailOf(a), 'reset')).toHaveLength(3);
    // per IP: 5 per hour, the 6th → 429
    const ip = '203.0.113.251';
    for (let i = 0; i < 5; i++) expect((await post('/auth/forgot', { email: `ip-probe-${i}@nowhere.test` }, { ip })).status).toBe(204);
    const limited = await post('/auth/forgot', { email: 'ip-probe-x@nowhere.test' }, { ip });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('rateLimited');
    expect((await post('/auth/forgot', { email: 'not-an-email' })).status).toBe(400);
  }, 60_000);

  it('reset: sets the new argon2id hash, revokes every refresh token, single use; the old password stops working', async () => {
    const a = await register(s);
    const login = await api(s, 'POST', '/auth/login', null, { username: a.username, password: 'correct horse battery' });
    expect(login.status).toBe(200);
    expect((await post('/auth/forgot', { email: emailOf(a) })).status).toBe(204);
    const token = tokenOf(mailsTo(emailOf(a), 'reset').at(-1)!)!;
    const before = await rawQuery(s.db, 'select password_hash from players where id = $1', [a.id]);
    const res = await post('/auth/reset', { token, password: 'a brand new passphrase' });
    expect(res.status).toBe(204);
    const [row] = await rawQuery(s.db, 'select password_hash, email_verified_at from players where id = $1', [a.id]);
    expect(String(row!['password_hash']).startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(row!['password_hash']).not.toBe(before[0]!['password_hash']);
    expect(row!['email_verified_at']).not.toBeNull(); // the reset link proved the address
    // every refresh token (register's and login's) is revoked
    const live = await rawQuery(s.db, 'select count(*)::int as n from refresh_tokens where player_id = $1 and revoked_at is null', [a.id]);
    expect(Number(live[0]!['n'])).toBe(0);
    expect((await api(s, 'POST', '/auth/refresh', null, { refresh: a.refresh })).status).toBe(401);
    expect((await api(s, 'POST', '/auth/refresh', null, { refresh: login.body.refresh })).status).toBe(401);
    // passwords
    expect((await api(s, 'POST', '/auth/login', null, { username: a.username, password: 'correct horse battery' })).status).toBe(401);
    expect((await api(s, 'POST', '/auth/login', null, { username: a.username, password: 'a brand new passphrase' })).status).toBe(200);
    // single use
    const again = await post('/auth/reset', { token, password: 'yet another passphrase' });
    expect(again.status).toBe(400);
    expect(again.body).toEqual({ code: 'badToken', reason: 'used' });
    const audit = await rawQuery(s.db, "select detail from audit_log where actor_id = $1 and action = 'auth.passwordReset'", [a.id]);
    expect(audit).toHaveLength(1);
  }, 60_000);

  it('reset refuses an expired token, an unknown token, a verify token and a short password; nothing changes', async () => {
    const a = await register(s);
    const thirtyOneMinAgo = new Date(s.time.clock() - 31 * 60_000);
    const { token: stale } = await s.repos.db.transaction((tx) => s.repos.auth.issueEmailToken(tx, a.id, 'reset', RESET_TTL_MS, thirtyOneMinAgo));
    const expired = await post('/auth/reset', { token: stale, password: 'a brand new passphrase' });
    expect(expired.status).toBe(400);
    expect(expired.body).toEqual({ code: 'badToken', reason: 'expired' });
    const unknown = await post('/auth/reset', { token: 'x'.repeat(43), password: 'a brand new passphrase' });
    expect(unknown.body).toEqual({ code: 'badToken', reason: 'unknown' });
    const verifyToken = tokenOf(mailsTo(emailOf(a), 'verify').at(-1)!)!;
    expect((await post('/auth/reset', { token: verifyToken, password: 'a brand new passphrase' })).body).toEqual({ code: 'badToken', reason: 'unknown' });
    expect((await post('/auth/reset', { token: 'x'.repeat(43), password: 'short' })).status).toBe(400);
    // the original password still works and its refresh token still rotates
    expect((await api(s, 'POST', '/auth/login', null, { username: a.username, password: 'correct horse battery' })).status).toBe(200);
    expect((await api(s, 'POST', '/auth/refresh', null, { refresh: a.refresh })).status).toBe(200);
  }, 60_000);

  it('verify: the registration link verifies once; /me reports it; a reused link → 400 used', async () => {
    const a = await register(s);
    const token = tokenOf(mailsTo(emailOf(a), 'verify')[0]!)!;
    expect((await post('/auth/verify', { token })).status).toBe(204);
    const me = await api(s, 'GET', '/me', a.access);
    expect(me.body.emailVerified).toBe(true);
    const again = await post('/auth/verify', { token });
    expect(again.status).toBe(400);
    expect(again.body).toEqual({ code: 'badToken', reason: 'used' });
    expect((await post('/auth/verify', {})).status).toBe(400);
  }, 60_000);

  it('resend: bearer only; a fresh link supersedes the last; 3/h per player → 429; verified → 409 alreadyVerified', async () => {
    const a = await register(s);
    expect((await post('/auth/resend', {})).status).toBe(401);
    for (let i = 0; i < 3; i++) expect((await post('/auth/resend', {}, { token: a.access })).status).toBe(204);
    const limited = await post('/auth/resend', {}, { token: a.access });
    expect(limited.status).toBe(429);
    const mails = mailsTo(emailOf(a), 'verify');
    expect(mails).toHaveLength(4); // registration + 3 resends
    // only the newest link works
    expect((await post('/auth/verify', { token: tokenOf(mails[0]!)! })).body).toEqual({ code: 'badToken', reason: 'used' });
    expect((await post('/auth/verify', { token: tokenOf(mails[3]!)! })).status).toBe(204);
    const b = await register(s);
    expect((await post('/auth/verify', { token: tokenOf(mailsTo(emailOf(b), 'verify')[0]!)! })).status).toBe(204);
    const done = await post('/auth/resend', {}, { token: b.access });
    expect(done.status).toBe(409);
    expect(done.body.code).toBe('alreadyVerified');
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
