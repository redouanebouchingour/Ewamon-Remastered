/**
 * §30.6.4 Rate limits — pure sliding windows with an injected clock. One table (`LIMITS`) holds every REST
 * and room limit. Room messages use a per-client `RateLimiterState` kept in `userData`; REST uses a
 * `RateLimiter` keyed by scope (ip or playerId): `localRateLimiter` in-process, `presenceRateLimiter`
 * cluster-wide through Colyseus `Presence` when Redis is configured.
 *
 * No Colyseus, DB or wall-clock import (NON-NEGOTIABLE 12): `Presence` is a structural type here.
 */

export interface Limit {
  readonly max: number;
  readonly windowMs: number;
}

export const LIMITS = {
  register: { max: 5, windowMs: 3_600_000 }, // per IP
  login: { max: 10, windowMs: 900_000 }, // per IP and per username_lower (both must pass)
  refresh: { max: 30, windowMs: 900_000 }, // per IP
  // Phase C6 email routes
  forgot: { max: 5, windowMs: 3_600_000 }, // POST /auth/forgot per IP (429 when exceeded)
  forgotEmail: { max: 3, windowMs: 3_600_000 }, // reset mails per address: over it the 204 is answered but nothing is sent
  emailToken: { max: 20, windowMs: 900_000 }, // POST /auth/reset + /auth/verify per IP
  resend: { max: 3, windowMs: 3_600_000 }, // POST /auth/resend per player
  listing: { max: 5, windowMs: 3_600_000 }, // per player (MARKET.listMaxPerHour)
  bid: { max: 30, windowMs: 3_600_000 }, // per player (MARKET.bidMaxPerHour)
  message: { max: 20, windowMs: 60_000 }, // DMs per player
  friendReq: { max: 20, windowMs: 3_600_000 },
  guildOp: { max: 10, windowMs: 60_000 },
  restRead: { max: 240, windowMs: 60_000 }, // every GET, per player
  restWrite: { max: 60, windowMs: 60_000 }, // every other POST, per player
  replay: { max: 60, windowMs: 60_000 }, // GET /replay/:token per IP (public, no account)
  weather: { max: 20, windowMs: 60_000 }, // GET /weather/cities per player (each one an Open-Meteo request)
  // room messages (per client), from the spine §4.3
  input: { max: 30, windowMs: 1_000 },
  emote: { max: 1, windowMs: 1_500 },
  chat: { max: 4, windowMs: 4_000 },
  interact: { max: 4, windowMs: 1_000 },
  engageSpawn: { max: 2, windowMs: 1_000 },
  battleAction: { max: 4, windowMs: 1_000 },
  /**
   * Phase D6: a doubles battle's position-1 `battleAction` counts in its own window, so the two per-turn actions a
   * client sends back to back (one burst, one timestamp) never starve each other. Used only when the sender is in a
   * doubles battle and names `pos: 1`; singles traffic stays on `battleAction` alone (4 / 1 s, unchanged).
   */
  battleActionPos1: { max: 4, windowMs: 1_000 },
  battleResync: { max: 4, windowMs: 1_000 },
  challenge: { max: 3, windowMs: 5_000 },
  tradeRequest: { max: 3, windowMs: 5_000 },
  raid: { max: 4, windowMs: 1_000 },
  /** Phase C3 fast travel (the 3 s server cooldown answers anything faster with `cooldown`) */
  fastTravel: { max: 4, windowMs: 1_000 },
  /** Phase D9: one Old Rod cast per 1.5 s (protocol CLIENT_MESSAGE_LIMITS.fish) */
  fish: { max: 1, windowMs: 1_500 },
  /** Phase D13: ranked queue join / leave (protocol CLIENT_MESSAGE_LIMITS.rankedQueue) */
  rankedQueue: { max: 4, windowMs: 5_000 },
  /** camp bases: a claim or a raid on the camp here, one per 2 s (protocol CLIENT_MESSAGE_LIMITS.camp) */
  camp: { max: 1, windowMs: 2_000 },
  /** every room message the spine gives no row (challengeReply, trade*, handoverAck): the generic 4 / 1 s of protocol's CLIENT_MESSAGE_LIMITS */
  roomOther: { max: 4, windowMs: 1_000 },
} as const satisfies Record<string, Limit>;

export type LimitKey = keyof typeof LIMITS;

export interface RateLimiterState {
  /** key -> sorted timestamps within the window */
  readonly windows: Map<string, number[]>;
  /** key -> timestamp of the last `rateLimited` notification (one per window) */
  readonly notified: Map<string, number>;
}

export function createLimiterState(): RateLimiterState {
  return { windows: new Map(), notified: new Map() };
}

function prune(ts: number[], now: number, windowMs: number): void {
  let drop = 0;
  while (drop < ts.length && ts[drop]! <= now - windowMs) drop++;
  if (drop > 0) ts.splice(0, drop);
}

/** true = allowed (timestamp recorded); false = over limit (not recorded). Prunes timestamps older than windowMs. */
export function allow(s: RateLimiterState, key: LimitKey, now: number, limit: Limit = LIMITS[key]): boolean {
  let ts = s.windows.get(key);
  if (ts === undefined) {
    ts = [];
    s.windows.set(key, ts);
  }
  prune(ts, now, limit.windowMs);
  if (ts.length >= limit.max) return false;
  ts.push(now);
  return true;
}

/**
 * After a refusal: true exactly once per window per key, so the room sends ONE `error { code: 'rateLimited' }`
 * per window and drops the rest silently (§30.6.4, NON-NEGOTIABLE 10).
 */
export function shouldNotify(s: RateLimiterState, key: LimitKey, now: number, limit: Limit = LIMITS[key]): boolean {
  const last = s.notified.get(key);
  if (last !== undefined && now - last < limit.windowMs) return false;
  s.notified.set(key, now);
  return true;
}

/** Remaining ms until the oldest timestamp leaves the window (for `retry-after`). */
export function retryAfterMs(s: RateLimiterState, key: LimitKey, now: number, limit: Limit = LIMITS[key]): number {
  const ts = s.windows.get(key);
  if (ts === undefined || ts.length === 0) return 0;
  return Math.max(0, ts[0]! + limit.windowMs - now);
}

export interface RateLimiter {
  /** scope = ip or playerId */
  allow(scope: string, key: LimitKey, now?: number): Promise<boolean>;
}

/** In-process `Map<scope, RateLimiterState>`, swept every 60 s by the caller (`sweep`). */
export function localRateLimiter(clock: () => number): RateLimiter & { sweep(now?: number): number; readonly size: number } {
  const scopes = new Map<string, RateLimiterState>();
  return {
    async allow(scope, key, now = clock()) {
      let s = scopes.get(scope);
      if (s === undefined) {
        s = createLimiterState();
        scopes.set(scope, s);
      }
      return allow(s, key, now);
    },
    /** Drops scopes whose every window is empty. Returns the number removed. */
    sweep(now = clock()) {
      let removed = 0;
      for (const [scope, s] of scopes) {
        let live = false;
        for (const [key, ts] of s.windows) {
          prune(ts, now, LIMITS[key as LimitKey]?.windowMs ?? 0);
          if (ts.length > 0) live = true;
        }
        if (!live) {
          scopes.delete(scope);
          removed++;
        }
      }
      return removed;
    },
    get size() {
      return scopes.size;
    },
  };
}

/** The slice of Colyseus `Presence` this module needs (structural — no Colyseus import). */
export interface CounterPresence {
  hincrbyex(key: string, field: string, value: number, expireInSeconds: number): Promise<number>;
  hgetall(key: string): Promise<{ [key: string]: string }>;
}

/**
 * Cluster-wide limiter: fixed 1 s sub-buckets in one hash per (scope, key), summed over the window.
 * Slightly more permissive than the sliding window at bucket edges (≤ 1 s of slack), which the spec accepts.
 */
export function presenceRateLimiter(p: CounterPresence, clock: () => number): RateLimiter {
  return {
    async allow(scope, key, now = clock()) {
      const limit = LIMITS[key];
      const hashKey = `ewa:rl:${scope}:${key}`;
      const bucket = Math.floor(now / 1000);
      const oldest = Math.floor((now - limit.windowMs) / 1000);
      const all = await p.hgetall(hashKey);
      let sum = 0;
      for (const [field, v] of Object.entries(all ?? {})) {
        if (Number(field) > oldest) sum += Number(v);
      }
      if (sum >= limit.max) return false;
      await p.hincrbyex(hashKey, String(bucket), 1, Math.ceil(limit.windowMs / 1000) + 1);
      return true;
    },
  };
}
