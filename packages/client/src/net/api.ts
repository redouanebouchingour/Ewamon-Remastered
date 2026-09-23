/**
 * `apiFetch` — the fetch() wrapper for spine §4.7 (SPEC §20.1.2).
 *
 * - Base URL `import.meta.env.VITE_API_URL` (default '/api'; the Vite dev server proxies /api → :4000 and
 *   strips the prefix, the server mounts routes at the root).
 * - Adds `Authorization: Bearer <access>` from useSessionStore; refreshes first when the access token is
 *   missing/expiring and a refresh token exists.
 * - On 401 with a refresh token: POST /auth/refresh ONCE, store the rotated pair, retry ONCE. A second 401
 *   ends the session and throws.
 * - Concurrent refreshes are coalesced: one in-flight refresh promise, shared.
 * - The 200 body is parsed with the zod schema protocol's ROUTES names for that route; a parse failure is
 *   ApiFailure { status: 0, code: 'badResponse' }.
 * - Timeout 10 000 ms via AbortSignal.timeout; a network error or timeout is { status: 0, code: 'network' }.
 *
 * Deviation D2: routes are addressed by protocol's `RouteKey` (`apiFetch('dex')`) — the typed route table
 * protocol ships — instead of a `RestRoute<T>` object; path params and query params are separate fields.
 */
import { redirect } from 'react-router';
import { ROUTES, routePath } from '@ewa/protocol';
import type { RouteKey, RouteRequestInput, RouteResponse } from '@ewa/protocol';
import { useSessionStore } from '../state/session';
import { ApiFailure } from './apiError';
import { endSession } from './sessionEnd';
import { getRefreshToken, hasRefreshToken, jwtExpiryMs, setRefreshToken } from './tokens';

export { ApiFailure, isApiFailure } from './apiError';
export type { ApiError } from './apiError';
export { endSession } from './sessionEnd';

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiInit<K extends RouteKey> {
  readonly body?: RouteRequestInput<K>;
  /** `:param` path segments */
  readonly params?: Readonly<Record<string, string>>;
  /** search params; null/undefined/'' are dropped */
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly signal?: AbortSignal;
}

export const API_TIMEOUT_MS = 10_000;
/** refresh when the access token has less than this left (the keeper refreshes 60 s early; this is the floor) */
const EXPIRY_SLACK_MS = 5_000;

function apiBase(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return env?.['VITE_API_URL'] ?? '/api';
}

export function buildQuery(query: Readonly<Record<string, QueryValue>> | undefined): string {
  if (query === undefined) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s.length > 0 ? `?${s}` : '';
}

function combineSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (a === undefined) return b;
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === 'function') return anyFn([a, b]);
  const ctl = new AbortController();
  const abort = (): void => ctl.abort();
  a.addEventListener('abort', abort, { once: true });
  b.addEventListener('abort', abort, { once: true });
  return ctl.signal;
}

async function readError(res: Response): Promise<ApiFailure> {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await res.json();
    if (parsed !== null && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch (_e) {
    body = {};
  }
  const { code, detail, ...extra } = body;
  const retry = res.headers.get('retry-after');
  if (retry !== null && Number.isFinite(Number(retry))) extra['retryAfterS'] = Number(retry);
  return new ApiFailure({
    status: res.status,
    code: typeof code === 'string' ? code : `http${res.status}`,
    detail: typeof detail === 'string' ? detail : null,
    extra,
  });
}

/** One request, no retry logic. */
async function send<K extends RouteKey>(key: K, init: ApiInit<K>, token: string | null): Promise<RouteResponse<K>> {
  const route = ROUTES[key];
  const url = `${apiBase()}${routePath(key, init.params)}${buildQuery(init.query)}`;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token !== null) headers['authorization'] = `Bearer ${token}`;
  let body: string | undefined;
  if (route.method === 'POST') {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.body ?? {});
  }
  const timeout = AbortSignal.timeout(API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { method: route.method, headers, body, signal: combineSignals(init.signal, timeout) });
  } catch (e) {
    // a caller's abort (React Router cancelling a loader) propagates untouched
    if (init.signal?.aborted === true) throw e;
    throw new ApiFailure({ status: 0, code: 'network', detail: timeout.aborted ? 'timeout' : e instanceof Error ? e.message : String(e) });
  }
  if (!res.ok) throw await readError(res);
  if (route.response === null || res.status === 204) return undefined as RouteResponse<K>;
  let json: unknown;
  try {
    json = await res.json();
  } catch (_e) {
    throw new ApiFailure({ status: 0, code: 'badResponse', detail: 'response is not JSON' });
  }
  const parsed = route.response.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ApiFailure({
      status: 0,
      code: 'badResponse',
      detail: first === undefined ? 'schema mismatch' : `${first.path.map(String).join('.')}: ${first.message}`,
    });
  }
  return parsed.data as RouteResponse<K>;
}

// ---- session lifecycle ----------------------------------------------------------------------------------

/** Stores a fresh pair from /auth/login, /auth/register or /auth/refresh. */
export function storeTokens(access: string, refresh: string): void {
  setRefreshToken(refresh);
  useSessionStore.getState().setTokens(access, jwtExpiryMs(access));
}

export type RefreshResult = 'ok' | 'invalid' | 'network';
let inflight: Promise<RefreshResult> | null = null;

/** POST /auth/refresh, coalesced: every concurrent caller shares one request. */
export function refreshSession(): Promise<RefreshResult> {
  if (inflight !== null) return inflight;
  const token = getRefreshToken();
  if (token === null || token.length === 0) return Promise.resolve('invalid');
  inflight = (async (): Promise<RefreshResult> => {
    try {
      const pair = await send('authRefresh', { body: { refresh: token } }, null);
      storeTokens(pair.access, pair.refresh);
      return 'ok';
    } catch (e) {
      if (e instanceof ApiFailure && e.error.status !== 0 && e.error.status < 500 && e.error.status !== 429) {
        endSession(); // badRefresh / refreshReuse / banned
        return 'invalid';
      }
      return 'network';
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function accessToken(): string | null {
  return useSessionStore.getState().accessToken;
}

function accessFresh(): boolean {
  const s = useSessionStore.getState();
  return s.accessToken !== null && s.accessExp - Date.now() > EXPIRY_SLACK_MS;
}

export async function apiFetch<K extends RouteKey>(key: K, init: ApiInit<K> = {}): Promise<RouteResponse<K>> {
  const needsAuth = ROUTES[key].auth !== 'none';
  if (!needsAuth) return send(key, init, null);
  if (!accessFresh() && hasRefreshToken()) await refreshSession();
  try {
    return await send(key, init, accessToken());
  } catch (e) {
    if (!(e instanceof ApiFailure) || e.error.status !== 401 || !hasRefreshToken()) throw e;
    const r = await refreshSession();
    if (r !== 'ok') throw e;
    try {
      return await send(key, init, accessToken());
    } catch (e2) {
      if (e2 instanceof ApiFailure && e2.error.status === 401) endSession();
      throw e2;
    }
  }
}

/** The `/login?next=` redirect for a loader. */
export function loginRedirect(request: Request): Response {
  const url = new URL(request.url);
  const next = `${url.pathname}${url.search}`;
  return redirect(`/login?next=${encodeURIComponent(next)}`);
}

/**
 * Loader helper: throws redirect('/login?next=<pathname>') when there is no refresh token (or it was
 * refused); otherwise resolves once a usable access token is in memory (refreshing if expired). A server
 * that cannot be reached is an ApiFailure 'network' for the route's error element, not a logout.
 */
export async function requireSession(request: Request): Promise<void> {
  if (!hasRefreshToken()) throw loginRedirect(request);
  if (accessFresh()) return;
  const r = await refreshSession();
  if (r === 'invalid') throw loginRedirect(request);
  if (r === 'network') throw new ApiFailure({ status: 0, code: 'network', detail: 'could not refresh the session' });
}

/** Test seam: forget the in-flight refresh (vitest isolates modules per file, this is for within-file resets). */
export function __resetApiForTests(): void {
  inflight = null;
}
