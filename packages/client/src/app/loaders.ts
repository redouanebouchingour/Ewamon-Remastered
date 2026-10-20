/**
 * Route loaders (SPEC §20.1.1 table). Each is REST only; every response that carries progression/inventory
 * goes through the session writers (dex → applyProgressionDelta). Routes the server has not shipped yet
 * (social, guilds, marketplace, admin stats/players — server part 2) resolve to `{ available: false }` from
 * their 404 so the screen renders a proper "not live yet" state instead of an error.
 */
import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { LEADERBOARD_MODES } from '@ewa/protocol';
import type { RouteKey, RouteResponse } from '@ewa/protocol';
import { ApiFailure, apiFetch, loginRedirect, requireSession } from '../net/api';
import type { ApiInit } from '../net/api';
import { isRouteUnavailable } from '../net/errors';
import { useNotificationsStore } from '../state/notifications';
import { useArenaStore } from '../state/arena';
import { toProgressionDelta, useSessionStore } from '../state/session';

export type Maybe<T> = { readonly available: true; readonly data: T } | { readonly available: false };

/** apiFetch for loaders: a 401 that survived the refresh becomes the /login redirect. */
export async function load<K extends RouteKey>(request: Request, key: K, init: Omit<ApiInit<K>, 'signal'> = {}): Promise<RouteResponse<K>> {
  try {
    return await apiFetch(key, { ...init, signal: request.signal } as ApiInit<K>);
  } catch (e) {
    if (e instanceof ApiFailure && e.error.status === 401) throw loginRedirect(request);
    throw e;
  }
}

/** Same, but a missing server route resolves to `{ available: false }`. */
export async function loadOptional<K extends RouteKey>(request: Request, key: K, init: Omit<ApiInit<K>, 'signal'> = {}): Promise<Maybe<RouteResponse<K>>> {
  try {
    return { available: true, data: await load(request, key, init) };
  } catch (e) {
    if (isRouteUnavailable(e)) return { available: false };
    throw e;
  }
}

/**
 * /play/* child loaders run in parallel with the /play loader on a direct load, so a child that reads or writes
 * the session (zoneId for the shop, the dex delta) first waits for the first hydrateFromMe. Rejects on abort
 * (the parent redirected) or after 15 s.
 */
export function sessionReady(signal: AbortSignal, timeoutMs = 15_000): Promise<void> {
  if (useSessionStore.getState().hydratedAt > 0) return Promise.resolve();
  // the /play loader of this same navigation is in flight: share its outcome (a /login redirect included), so a
  // logged-out direct load of /play/<child> redirects at once instead of waiting for a hydration that never comes
  if (playLoad !== null) return playLoad;
  return new Promise((resolve, reject) => {
    const done = (): void => {
      unsub();
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    };
    const unsub = useSessionStore.subscribe(
      (st) => st.hydratedAt,
      (at) => {
        if (at > 0) {
          done();
          resolve();
        }
      },
    );
    const onAbort = (): void => {
      done();
      reject(signal.reason ?? new DOMException('aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      done();
      reject(new ApiFailure({ status: 0, code: 'network', detail: 'profile did not load' }));
    }, timeoutMs);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

// ---- /play ------------------------------------------------------------------------------------------------

export function claimableLevels(bp: { readonly trainerLevel: number; readonly claimed: readonly number[]; readonly rewards: readonly { readonly level: number }[] }): number {
  const claimed = new Set(bp.claimed);
  return bp.rewards.filter((r) => r.level <= bp.trainerLevel && !claimed.has(r.level)).length;
}

/** The in-flight /play loader, shared with child loaders through sessionReady(). */
let playLoad: Promise<void> | null = null;

/** requireSession() → GET /me → hydrateFromMe(). Runs once per session (`shouldRevalidate: () => false`). */
export function playLoader({ request }: LoaderFunctionArgs): Promise<{ readonly zoneId: string }> {
  const run = (async () => {
    await requireSession(request);
    const me = await load(request, 'me');
    useSessionStore.getState().hydrateFromMe(me);
    useNotificationsStore.getState().seed({
      unreadDm: me.unreadDm,
      friendRequests: me.friendRequests,
      pendingBattlePassClaims: claimableLevels(me.battlePass),
    });
    return { zoneId: me.presence.zoneId };
  })();
  const shared = run.then(() => undefined);
  playLoad = shared;
  const clear = (): void => {
    if (playLoad === shared) playLoad = null;
  };
  shared.then(clear, clear);
  return run;
}

export async function dexLoader({ request }: LoaderFunctionArgs) {
  const [dex] = await Promise.all([load(request, 'dex'), sessionReady(request.signal)]);
  useSessionStore.getState().applyProgressionDelta(
    toProgressionDelta({ dexSeen: dex.seen, dexCaught: dex.caught, dexVariants: dex.variants, dexAlpha: dex.alpha, dexShiny: dex.shiny ?? [] }),
  );
  return dex;
}

export type ShopData =
  | { readonly kind: 'ok'; readonly zoneId: string; readonly stock: readonly string[]; readonly prices: Readonly<Record<string, number>> }
  | { readonly kind: 'noShop'; readonly zoneId: string | null };

export async function shopLoader({ request }: LoaderFunctionArgs): Promise<ShopData> {
  await sessionReady(request.signal);
  const zoneId = useSessionStore.getState().zoneId;
  if (zoneId === null) return { kind: 'noShop', zoneId: null };
  try {
    const res = await load(request, 'shop', { params: { zoneId } });
    return { kind: 'ok', zoneId, stock: res.stock, prices: res.prices };
  } catch (e) {
    // 30-server-netcode.md §30.6.3: 404 when the zone has no shop → "There is no shop here"
    if (e instanceof ApiFailure && e.error.status === 404) return { kind: 'noShop', zoneId };
    throw e;
  }
}

export async function friendsLoader({ request }: LoaderFunctionArgs) {
  return loadOptional(request, 'friends');
}

export async function dmLoader({ request, params }: LoaderFunctionArgs) {
  const username = params['username'] ?? '';
  const url = new URL(request.url);
  const before = url.searchParams.get('before');
  return {
    username,
    thread: await loadOptional(request, 'messagesThread', { params: { username }, query: { limit: 50, before } }),
  };
}

export async function guildLoader({ request }: LoaderFunctionArgs) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return { q, guilds: await loadOptional(request, 'guilds', { query: { search: q } }) };
}

export const MARKET_PARAMS = ['search', 'variant', 'isAlpha', 'isShiny', 'levelMin', 'levelMax', 'sort', 'page'] as const;
export type MarketTab = 'browse' | 'mine' | 'bids';

export async function marketLoader({ request }: LoaderFunctionArgs) {
  const sp = new URL(request.url).searchParams;
  const tab = (sp.get('tab') ?? 'browse') as MarketTab;
  if (tab === 'mine') return { tab, mine: await loadOptional(request, 'marketplaceMyActive') } as const;
  if (tab === 'bids') return { tab, mine: await loadOptional(request, 'marketplaceMyBids') } as const;
  const query: Record<string, string> = { pageSize: '20' };
  for (const k of MARKET_PARAMS) {
    const v = sp.get(k);
    if (v !== null && v !== '') query[k] = v;
  }
  return { tab: 'browse', search: await loadOptional(request, 'marketplace', { query }) } as const;
}

export async function listingLoader({ request, params }: LoaderFunctionArgs) {
  const id = params['listingId'] ?? '';
  try {
    return { id, listing: await loadOptional(request, 'marketplaceDetail', { params: { id } }), missing: false } as const;
  } catch (e) {
    if (e instanceof ApiFailure && (e.error.status === 404 || e.error.status === 400)) return { id, listing: { available: false } as const, missing: true } as const;
    throw e;
  }
}

export async function battlePassLoader({ request }: LoaderFunctionArgs) {
  const [bp] = await Promise.all([load(request, 'battlePass'), sessionReady(request.signal)]);
  useNotificationsStore.getState().setPendingClaims(claimableLevels(bp));
  return bp;
}

// ---- Phase C4: rankings / history / profiles ---------------------------------------------------------------

export type RankingMode = (typeof LEADERBOARD_MODES)[number];
export type HistoryTab = 'battles' | 'trades';

const pageOf = (sp: URLSearchParams): number => Math.max(1, Math.floor(Number(sp.get('page') ?? '1')) || 1);

/** `/play/rankings?mode=rating|dex|trainerLevel|towerStreak&page=` → GET /leaderboard (25 rows a page, banned players excluded). */
export async function rankingsLoader({ request }: LoaderFunctionArgs) {
  const sp = new URL(request.url).searchParams;
  const raw = sp.get('mode');
  const mode: RankingMode = (LEADERBOARD_MODES as readonly string[]).includes(raw ?? '') ? (raw as RankingMode) : 'rating';
  const page = pageOf(sp);
  const [res] = await Promise.all([load(request, 'leaderboard', { query: { mode, page } }), sessionReady(request.signal)]);
  return { mode, page, rows: res.rows };
}

/** `/play/history?tab=battles|trades&page=` → GET /history/battles or /history/trades (the caller's own, 25 a page). */
export async function historyLoader({ request }: LoaderFunctionArgs) {
  const sp = new URL(request.url).searchParams;
  const tab: HistoryTab = sp.get('tab') === 'trades' ? 'trades' : 'battles';
  const page = pageOf(sp);
  if (tab === 'trades') return { tab, page, trades: (await load(request, 'historyTrades', { query: { page } })).rows } as const;
  return { tab, page, battles: (await load(request, 'historyBattles', { query: { page } })).rows } as const;
}

/**
 * Battle replays `/play/replay/:token`: the shared battle (GET /replay/:token, no account needed), or null when the
 * token is unknown (404) or malformed (400).
 */
export async function replayLoader({ request, params }: LoaderFunctionArgs) {
  const token = params['token'] ?? '';
  try {
    const [replay] = await Promise.all([load(request, 'replay', { params: { token } }), sessionReady(request.signal)]);
    return { token, replay };
  } catch (e) {
    if (e instanceof ApiFailure && (e.error.status === 404 || e.error.status === 400)) return { token, replay: null };
    throw e;
  }
}

/**
 * Arena PvP `/play/pvp`: GET /arena into the arena store (rating, the week's cup, the queue) and the friend list for
 * Challenge a friend. A server without the arena routes renders the screen's "not live yet" state.
 */
export async function pvpLoader({ request }: LoaderFunctionArgs) {
  const [arena, friends] = await Promise.all([
    loadOptional(request, 'arena'),
    loadOptional(request, 'friends').catch(() => ({ available: false }) as const),
    sessionReady(request.signal),
  ]);
  if (arena.available) {
    const { status, ...info } = arena.data;
    useArenaStore.getState().setInfo(info, status);
  }
  return { available: arena.available, friends: friends.available ? friends.data.friends : [] };
}

/** A public profile, or `null` when the server answers 404 (unknown or banned) / 400 (not a username). */
async function publicProfile(request: Request, username: string) {
  try {
    return await load(request, 'playerPublic', { params: { username: username.toLowerCase() } });
  } catch (e) {
    if (e instanceof ApiFailure && (e.error.status === 404 || e.error.status === 400)) return null;
    throw e;
  }
}

/** `/play/profile`: the editable identity comes from the session; the stats, badges and showcase from GET /players/:me. */
export async function profileLoader({ request }: LoaderFunctionArgs) {
  await sessionReady(request.signal);
  const username = useSessionStore.getState().profile?.username ?? '';
  return { pub: username === '' ? null : await publicProfile(request, username) };
}

/** `/play/players/:username` → GET /players/:username; `pub: null` renders "No trainer by that name". */
export async function playerLoader({ request, params }: LoaderFunctionArgs) {
  const username = params['username'] ?? '';
  return { username, pub: await publicProfile(request, username) };
}

// ---- /admin -------------------------------------------------------------------------------------------------

/** Not a /play child: no canvas. Non-admins (and a 403) go back to /play. */
export async function adminLoader({ request }: LoaderFunctionArgs) {
  await requireSession(request);
  let profile = useSessionStore.getState().profile;
  if (profile === null) {
    useSessionStore.getState().hydrateFromMe(await load(request, 'me'));
    profile = useSessionStore.getState().profile;
  }
  if (profile === null || !profile.isAdmin) throw redirect('/play');
  const sp = new URL(request.url).searchParams;
  const q = sp.get('q') ?? '';
  const page = Number(sp.get('page') ?? '1') || 1;
  try {
    const [stats, players, metrics] = await Promise.all([
      loadOptional(request, 'adminStats'),
      loadOptional(request, 'adminPlayers', { query: { q, page } }),
      loadOptional(request, 'adminMetrics'),
    ]);
    return { q, page, stats, players, metrics };
  } catch (e) {
    if (e instanceof ApiFailure && e.error.status === 403) throw redirect('/play');
    throw e;
  }
}
