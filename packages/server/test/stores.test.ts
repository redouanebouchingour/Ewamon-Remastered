/**
 * Pure stores (NON-NEGOTIABLE 12): ChallengeStore (§30.4.5), PresenceStore (§30.7.4, the legacy
 * onlinePresence guarantee), the LIMITS rate limiter (§30.6.4) and the chat sanitiser (§30.6.5).
 */
import { describe, expect, it } from 'vitest';
import { CHALLENGE_TTL_MS, ChallengeStore } from '../src/rooms/challengeStore';
import { PresenceStore } from '../src/rooms/presenceStore';
import { LIMITS, allow, createLimiterState, localRateLimiter, presenceRateLimiter, retryAfterMs, shouldNotify } from '../src/rest/rateLimit';
import { censor, containsBlocked, sanitizeChat } from '../src/chat/filter';
import { EnvSchema, parseEnv, testEnv } from '../src/env';

describe('ChallengeStore', () => {
  it('offer / duplicate / self / targetBusy; consume within TTL once', () => {
    const s = new ChallengeStore();
    expect(s.offer('a', 'a', 0)).toBe('selfChallenge');
    expect(s.offer('a', 'b', 0)).toBe('ok');
    expect(s.offer('a', 'b', 10)).toBe('duplicate');
    expect(s.offer('c', 'b', 10)).toBe('targetBusy');
    expect(s.size).toBe(1);
    expect(s.consume('a', 'b', 1000)).toBe(true);
    expect(s.consume('a', 'b', 1000)).toBe(false);
  });

  it('an expired invite cannot be consumed; sweep returns expired ones; dropFor returns both directions', () => {
    const s = new ChallengeStore();
    s.offer('a', 'b', 0);
    expect(s.consume('a', 'b', CHALLENGE_TTL_MS + 1)).toBe(false);
    s.offer('a', 'b', 0);
    s.offer('c', 'd', 0);
    expect(s.sweep(CHALLENGE_TTL_MS + 1).map((c) => c.fromId).sort()).toEqual(['a', 'c']);
    expect(s.size).toBe(0);
    expect(s.offer('c', 'a', 0)).toBe('ok');
    expect(s.offer('a', 'b', 0)).toBe('ok');
    expect(s.dropFor('a').length).toBe(2);
    expect(s.size).toBe(0);
  });
});

describe('PresenceStore (legacy onlinePresence guarantee, rebuilt without refcounts)', () => {
  const entry = (roomId: string) => ({ roomId, zoneId: 'mirevale' as const, shard: 0, battleId: null, tradeId: null, since: 0 });

  it('two tabs → size 1, the older room is returned for kicking; a stale leave does not remove the newer entry', () => {
    const p = new PresenceStore();
    expect(p.enter('u', entry('r1'))).toBeNull();
    const prev = p.enter('u', entry('r2'));
    expect(prev?.roomId).toBe('r1');
    expect(p.size).toBe(1);
    expect(p.leave('u', 'r1')).toBe(false); // stale leave from the kicked room
    expect(p.get('u')?.roomId).toBe('r2');
    expect(p.leave('u', 'r2')).toBe(true);
    expect(p.isOnline('u')).toBe(false);
  });

  it('re-entering the same room is not a cross-room kick; battle/trade markers; ip counts', () => {
    const p = new PresenceStore();
    p.enter('u', entry('r1'));
    expect(p.enter('u', entry('r1'))).toBeNull();
    p.setBattle('u', 'b1');
    expect(p.battleOf('u')).toBe('b1');
    p.setBattle('u', null);
    expect(p.battleOf('u')).toBeNull();
    p.ipEnter('1.2.3.4');
    p.ipEnter('1.2.3.4');
    expect(p.ipCount('1.2.3.4')).toBe(2);
    p.ipLeave('1.2.3.4');
    p.ipLeave('1.2.3.4');
    expect(p.ipCount('1.2.3.4')).toBe(0);
  });
});

describe('rate limits (§30.6.4)', () => {
  it('5th chat in 4 s → false; one rateLimited notification per window', () => {
    const s = createLimiterState();
    for (let i = 0; i < 4; i++) expect(allow(s, 'chat', i * 100)).toBe(true);
    expect(allow(s, 'chat', 500)).toBe(false);
    expect(shouldNotify(s, 'chat', 500)).toBe(true);
    expect(allow(s, 'chat', 600)).toBe(false);
    expect(shouldNotify(s, 'chat', 600)).toBe(false);
    expect(retryAfterMs(s, 'chat', 600)).toBe(3400);
    // window slides
    expect(allow(s, 'chat', 4001)).toBe(true);
    expect(shouldNotify(s, 'chat', 4600)).toBe(true);
  });

  it('input 30/s: 200 in one second → 170 dropped', () => {
    const s = createLimiterState();
    let ok = 0;
    for (let i = 0; i < 200; i++) if (allow(s, 'input', i * 5)) ok++;
    expect(ok).toBe(LIMITS.input.max);
  });

  it('localRateLimiter keys by scope and sweeps empty scopes; presenceRateLimiter sums 1 s buckets', async () => {
    let t = 0;
    const l = localRateLimiter(() => t);
    for (let i = 0; i < 5; i++) expect(await l.allow('ip:1', 'register')).toBe(true);
    expect(await l.allow('ip:1', 'register')).toBe(false);
    expect(await l.allow('ip:2', 'register')).toBe(true);
    t = LIMITS.register.windowMs + 1;
    expect(l.sweep()).toBe(2);
    const hashes = new Map<string, Record<string, string>>();
    const fake = {
      async hincrbyex(key: string, field: string, value: number) {
        const h = hashes.get(key) ?? {};
        h[field] = String(Number(h[field] ?? 0) + value);
        hashes.set(key, h);
        return Number(h[field]);
      },
      async hgetall(key: string) {
        return hashes.get(key) ?? {};
      },
    };
    let now = 10_000;
    const p = presenceRateLimiter(fake, () => now);
    for (let i = 0; i < 4; i++) expect(await p.allow('u', 'chat')).toBe(true);
    expect(await p.allow('u', 'chat')).toBe(false);
    now += 5_000;
    expect(await p.allow('u', 'chat')).toBe(true);
  });
});

describe('chat sanitiser (§30.6.5)', () => {
  it('strips C0/C1 controls and zero-width characters, collapses whitespace, trims, caps at 120', () => {
    const zw = String.fromCharCode(0x200b);
    const bel = String.fromCharCode(7);
    expect(sanitizeChat(`  hi${bel}${zw}   there \n friend `)).toBe('hi there friend');
    expect(sanitizeChat('   ')).toBeNull();
    expect(sanitizeChat('x'.repeat(121))).toBeNull();
    expect(sanitizeChat('x'.repeat(120))).toBe('x'.repeat(120));
  });

  it('the blocklist seam is a pass-through until part 2 fills BLOCKED_WORDS', () => {
    expect(containsBlocked('hello')).toBe(false);
    expect(censor('hello world')).toBe('hello world');
  });
});

describe('env (§30.1.2)', () => {
  it('JWT_SECRET is required (≥ 32); production requires DATABASE_URL and refuses ADMIN_BOOTSTRAP_USERNAME / * CORS', () => {
    expect(() => EnvSchema.parse({})).toThrow();
    expect(testEnv().PORT_WS).toBe(2567);
    expect(testEnv().PORT_REST).toBe(4000);
    const secret = 'x'.repeat(32);
    expect(() => parseEnv({ NODE_ENV: 'production', JWT_SECRET: secret })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ NODE_ENV: 'production', JWT_SECRET: secret, DATABASE_URL: 'postgres://u:p@h/db', ADMIN_BOOTSTRAP_USERNAME: 'x' })).toThrow(/ADMIN/);
    expect(() => parseEnv({ NODE_ENV: 'production', JWT_SECRET: secret, DATABASE_URL: 'postgres://u:p@h/db', CORS_ORIGINS: '*' })).toThrow(/CORS/);
    expect(parseEnv({ NODE_ENV: 'development', JWT_SECRET: secret }).DATA_DIR).toBe('./.data');
  });
});
