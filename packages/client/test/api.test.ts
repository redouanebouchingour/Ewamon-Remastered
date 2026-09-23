// @vitest-environment jsdom
/**
 * SPEC §20.1.2 apiFetch: bearer header, zod-parsed bodies, one refresh + one retry on 401, coalesced refreshes,
 * a second 401 ends the session, network/bad-response failures, requireSession's /login redirect.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiFailure, __resetApiForTests, apiFetch, buildQuery, refreshSession, requireSession, storeTokens } from '../src/net/api';
import { describeError, isRouteUnavailable } from '../src/net/errors';
import { REFRESH_KEY, jwtExpiryMs } from '../src/net/tokens';
import { useSessionStore } from '../src/state/session';
import { inOneHour, json, makeJwt, meFixture } from './fixtures';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
let handler: Handler;
const calls: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
  calls.length = 0;
  localStorage.clear();
  useSessionStore.getState().clearSession();
  __resetApiForTests();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const auth = (init: RequestInit): string | undefined => (init.headers as Record<string, string>)['authorization'];

describe('apiFetch', () => {
  it('sends the bearer token and parses the body with the route schema', async () => {
    const access = makeJwt(inOneHour());
    storeTokens(access, 'r1');
    handler = () => json(meFixture());
    const me = await apiFetch('me');
    expect(me.username).toBe('qa_tester');
    expect(calls[0]!.url).toBe('/api/me');
    expect(auth(calls[0]!.init)).toBe(`Bearer ${access}`);
    expect(localStorage.getItem(REFRESH_KEY)).toBe('r1');
    expect(useSessionStore.getState().accessExp).toBe(jwtExpiryMs(access));
  });

  it('on 401 refreshes once, stores the rotated pair and retries once', async () => {
    storeTokens(makeJwt(inOneHour()), 'old-refresh');
    const fresh = makeJwt(inOneHour() + 60);
    let meCalls = 0;
    handler = (url, init) => {
      if (url === '/api/auth/refresh') {
        expect(JSON.parse(String(init.body))).toEqual({ refresh: 'old-refresh' });
        return json({ access: fresh, refresh: 'new-refresh' });
      }
      meCalls += 1;
      return meCalls === 1 ? json({ code: 'unauthorized' }, 401) : json(meFixture());
    };
    await expect(apiFetch('me')).resolves.toMatchObject({ username: 'qa_tester' });
    expect(calls.map((c) => c.url)).toEqual(['/api/me', '/api/auth/refresh', '/api/me']);
    expect(auth(calls[2]!.init)).toBe(`Bearer ${fresh}`);
    expect(localStorage.getItem(REFRESH_KEY)).toBe('new-refresh');
  });

  it('coalesces concurrent refreshes into one request', async () => {
    storeTokens(makeJwt(inOneHour()), 'r');
    const fresh = makeJwt(inOneHour() + 60);
    let refreshes = 0;
    handler = async (url, init) => {
      if (url === '/api/auth/refresh') {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 20));
        return json({ access: fresh, refresh: 'r2' });
      }
      return auth(init) === `Bearer ${fresh}` ? json({ seen: [], caught: [], variants: {}, alpha: [] }) : json({ code: 'unauthorized' }, 401);
    };
    const results = await Promise.all([apiFetch('dex'), apiFetch('dex'), apiFetch('dex')]);
    expect(results).toHaveLength(3);
    expect(refreshes).toBe(1);
  });

  it('refreshes up front when the access token is expired', async () => {
    storeTokens(makeJwt(Math.floor(Date.now() / 1000) - 10), 'r');
    const fresh = makeJwt(inOneHour());
    handler = (url) => (url === '/api/auth/refresh' ? json({ access: fresh, refresh: 'r2' }) : json(meFixture()));
    await apiFetch('me');
    expect(calls.map((c) => c.url)).toEqual(['/api/auth/refresh', '/api/me']);
  });

  it('a second 401 ends the session and throws', async () => {
    storeTokens(makeJwt(inOneHour()), 'r');
    handler = (url) => (url === '/api/auth/refresh' ? json({ access: makeJwt(inOneHour()), refresh: 'r2' }) : json({ code: 'unauthorized' }, 401));
    await expect(apiFetch('me')).rejects.toMatchObject({ error: { status: 401 } });
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('a refused refresh (badRefresh / reuse) ends the session', async () => {
    storeTokens(makeJwt(inOneHour()), 'r');
    handler = () => json({ code: 'refreshReuse' }, 401);
    expect(await refreshSession()).toBe('invalid');
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('maps a schema mismatch to badResponse and a thrown fetch to network', async () => {
    storeTokens(makeJwt(inOneHour()), 'r');
    handler = () => json({ nope: true });
    await expect(apiFetch('me')).rejects.toMatchObject({ error: { status: 0, code: 'badResponse' } });
    handler = () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(apiFetch('me')).rejects.toMatchObject({ error: { status: 0, code: 'network' } });
  });

  it('keeps the error body fields and tells a missing route from a domain 404', async () => {
    storeTokens(makeJwt(inOneHour()), 'r');
    handler = () => json({ code: 'taken', field: 'username' }, 409);
    const e1 = await apiFetch('me').catch((e: unknown) => e);
    expect(e1).toBeInstanceOf(ApiFailure);
    expect((e1 as ApiFailure).error.extra).toMatchObject({ field: 'username' });
    handler = () => json({ message: 'Route GET:/friends not found', error: 'Not Found', statusCode: 404 }, 404);
    const e2 = await apiFetch('friends').catch((e: unknown) => e);
    expect(isRouteUnavailable(e2)).toBe(true);
    handler = () => json({ code: 'NotFound' }, 404);
    const e3 = await apiFetch('dex').catch((e: unknown) => e);
    expect(isRouteUnavailable(e3)).toBe(false);
    handler = () => json({ code: 'rateLimited' }, 429, { 'retry-after': '3600' });
    const e4 = await apiFetch('dex').catch((e: unknown) => e);
    expect(describeError(e4)).toBe('Too many requests — try again in 60 min.');
  });

  it('substitutes path params and drops empty query values', async () => {
    storeTokens(makeJwt(inOneHour()), 'r');
    handler = () => json({ stock: ['potion'], prices: { potion: 150 } });
    await apiFetch('shop', { params: { zoneId: 'mirevale' } });
    expect(calls[0]!.url).toBe('/api/shop/mirevale');
    expect(buildQuery({ q: '', page: 2, alpha: null, sort: 'newest' })).toBe('?page=2&sort=newest');
  });
});

describe('requireSession', () => {
  it('redirects to /login?next= without a refresh token', async () => {
    const thrown = await requireSession(new Request('http://localhost/play/dex?type=Fire')).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).headers.get('Location')).toBe(`/login?next=${encodeURIComponent('/play/dex?type=Fire')}`);
  });

  it('resolves immediately with a fresh access token, refreshes a stale one', async () => {
    storeTokens(makeJwt(inOneHour()), 'r');
    handler = () => json({});
    await requireSession(new Request('http://localhost/play'));
    expect(calls).toHaveLength(0);
    useSessionStore.getState().setTokens('x', 0);
    handler = () => json({ access: makeJwt(inOneHour()), refresh: 'r2' });
    await requireSession(new Request('http://localhost/play'));
    expect(calls.map((c) => c.url)).toEqual(['/api/auth/refresh']);
  });
});
