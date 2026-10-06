/**
 * Phase D13 ranked queue — `MatchQueue` (the queue + the matcher) and `RankedArena` (the arena room's pending matches).
 *
 * The queue is presence-keyed, not room-keyed: every entry lives in the Colyseus presence hash `ewa:ranked:queue`
 * (field = playerId), so a queued player keeps their place across zone crossings and shards, and any process's room
 * can add or drop an entry. One matcher runs cluster-wide: each process ticks every `RANKED_TICK_MS`, and only the
 * holder of the `ewa:ranked:leader` lease (5 s, refreshed by the tick) pairs players — the raid hotspot owner pattern.
 *
 * A match picks the arena room (the lowest open shard of `RANKED_ARENA.zoneId`), tells it first
 * (`ewa:ranked:arena:<roomId>`), then broadcasts `ewa:ranked:match`: the room hosting each player moves them there
 * through the ordinary handover path (or teleports them when they already stand in that room). The arena room starts
 * the `pvp` battle once both have arrived (handover acked), and cancels the match after `RANKED_ARRIVAL_MS`.
 *
 * Structural presence type (`RankedKV`), no Colyseus import: the pure parts (`pairUp`, `RankedArena`) are unit-tested.
 */
import { randomUUID } from 'node:crypto';
import { getHeightfield, isWalkable, nearestWalkable, zone as zoneById } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { rankedWindow } from '@ewa/protocol';

export const RANKED_QUEUE_KEY = 'ewa:ranked:queue';
export const RANKED_LEADER_KEY = 'ewa:ranked:leader';
export const RANKED_LEADER_TTL_S = 5;
/** broadcast to every room: the hosting room of each player moves them to the arena */
export const RANKED_MATCH_TOPIC = 'ewa:ranked:match';
/** broadcast: a match fell through (`playerId` is the side that stopped it) */
export const RANKED_CANCEL_TOPIC = 'ewa:ranked:cancel';
export const RANKED_TICK_MS = 1_000;
/** both players must reach the arena (handover acked) within this long, else the match is cancelled */
export const RANKED_ARRIVAL_MS = 20_000;
/**
 * The ranked arena: an open stretch of Mirevale's east green (no NPC, no interior, no link edge). Mirevale is the one
 * town without a badge gate, so every player can be seated there. The two players stand `spread` m either side of it.
 */
export const RANKED_ARENA = { zoneId: 'mirevale' as ZoneId, x: 22, z: 16, spread: 3 } as const;

export function rankedArenaTopic(roomId: string): string {
  return `ewa:ranked:arena:${roomId}`;
}

export interface RankedEntry {
  readonly playerId: string;
  readonly name: string;
  readonly rating: number;
  /** server clock ms */
  readonly joinedAt: number;
}

export interface RankedSeat {
  readonly playerId: string;
  readonly name: string;
  readonly rating: number;
  /** the arena spot this player is moved to */
  readonly x: number;
  readonly z: number;
}

export interface RankedMatch {
  readonly matchId: string;
  readonly zoneId: ZoneId;
  readonly arenaRoomId: string;
  /** side 0 = the longer-waiting player (the pvp "challenger") */
  readonly players: readonly [RankedSeat, RankedSeat];
  readonly expiresAt: number;
}

export interface RankedCancel {
  readonly matchId: string;
  /** the side that stopped it (already told `busy` / `party` by its own room) */
  readonly playerId: string;
  readonly players: readonly [string, string];
}

/**
 * Pairs queued players, oldest entry first: each takes the unpaired player with the smallest rating gap that lies
 * within BOTH players' windows (`rankedWindow(waited)` — ±100, +50 every 10 s, ≤ 400). Deterministic for a given input.
 */
export function pairUp(entries: readonly RankedEntry[], now: number): [RankedEntry, RankedEntry][] {
  const queue = [...entries].sort((a, b) => a.joinedAt - b.joinedAt || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
  const used = new Set<string>();
  const out: [RankedEntry, RankedEntry][] = [];
  for (const a of queue) {
    if (used.has(a.playerId)) continue;
    const wa = rankedWindow(now - a.joinedAt);
    let best: RankedEntry | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const b of queue) {
      if (b.playerId === a.playerId || used.has(b.playerId)) continue;
      const gap = Math.abs(a.rating - b.rating);
      if (gap > Math.min(wa, rankedWindow(now - b.joinedAt))) continue;
      if (gap < bestGap) {
        best = b;
        bestGap = gap;
      }
    }
    if (best !== null) {
      used.add(a.playerId);
      used.add(best.playerId);
      out.push([a, best]);
    }
  }
  return out;
}

let spotsCache: readonly [{ x: number; z: number }, { x: number; z: number }] | null = null;

/** The two arena spots, snapped to walkable ground (computed once). */
export function rankedArenaSpots(): readonly [{ readonly x: number; readonly z: number }, { readonly x: number; readonly z: number }] {
  if (spotsCache !== null) return spotsCache;
  const h = getHeightfield(RANKED_ARENA.zoneId);
  const spawn = zoneById(RANKED_ARENA.zoneId).spawn;
  const snap = (x: number, z: number): { x: number; z: number } => {
    if (isWalkable(h, x, z)) return { x, z };
    const p = nearestWalkable(h, x, z, 8) ?? nearestWalkable(h, spawn.x, spawn.z, 8);
    return p === null ? { x: spawn.x, z: spawn.z } : { x: p[0], z: p[1] };
  };
  spotsCache = [snap(RANKED_ARENA.x - RANKED_ARENA.spread, RANKED_ARENA.z), snap(RANKED_ARENA.x + RANKED_ARENA.spread, RANKED_ARENA.z)];
  return spotsCache;
}

/** The slice of Colyseus `Presence` the queue uses (structural; LocalPresence and RedisPresence both fit). */
export interface RankedKV {
  hset(key: string, field: string, value: string): unknown;
  hget(key: string, field: string): Promise<string | null | undefined> | string | null | undefined;
  hdel(key: string, field: string): Promise<boolean | number> | boolean | number;
  hgetall(key: string): Promise<Record<string, string> | null | undefined> | Record<string, string> | null | undefined;
  get(key: string): Promise<string | null | undefined> | string | null | undefined;
  setex(key: string, value: string, seconds: number): unknown;
  publish(topic: string, data: unknown): unknown;
}

export interface MatchQueueDeps {
  readonly clock: () => number;
  /** the arena room to seat a new match in (the lowest open shard of RANKED_ARENA.zoneId) */
  readonly arenaRoom: () => Promise<{ readonly roomId: string }>;
  /** false → the entry is stale (its process died without a leave) and is dropped */
  readonly isOnline: (playerId: string) => Promise<boolean>;
}

function parseEntry(raw: unknown): RankedEntry | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const v = JSON.parse(raw) as Partial<RankedEntry>;
    if (typeof v.playerId !== 'string' || typeof v.name !== 'string' || typeof v.rating !== 'number' || typeof v.joinedAt !== 'number') return null;
    return { playerId: v.playerId, name: v.name, rating: v.rating, joinedAt: v.joinedAt };
  } catch (_e) {
    return null;
  }
}

export class MatchQueue {
  /** this process's lease token */
  private readonly token = randomUUID();
  private ticking = false;

  constructor(
    private readonly kv: RankedKV,
    private readonly deps: MatchQueueDeps,
  ) {}

  /** Adds the player (idempotent: a second join keeps the first entry and its wait). Returns the stored entry. */
  async join(entry: RankedEntry): Promise<RankedEntry> {
    const prev = await this.get(entry.playerId);
    if (prev !== null) return prev;
    await this.kv.hset(RANKED_QUEUE_KEY, entry.playerId, JSON.stringify(entry));
    return entry;
  }

  /** true when the player was queued. */
  async leave(playerId: string): Promise<boolean> {
    if ((await this.get(playerId)) === null) return false;
    await this.kv.hdel(RANKED_QUEUE_KEY, playerId);
    return true;
  }

  async get(playerId: string): Promise<RankedEntry | null> {
    return parseEntry(await this.kv.hget(RANKED_QUEUE_KEY, playerId));
  }

  async entries(): Promise<RankedEntry[]> {
    const all = (await this.kv.hgetall(RANKED_QUEUE_KEY)) ?? {};
    const out: RankedEntry[] = [];
    for (const raw of Object.values(all)) {
      const e = parseEntry(raw);
      if (e !== null) out.push(e);
    }
    return out;
  }

  /**
   * One matcher pass (leader only; never re-entered): drops stale entries, pairs the rest, removes each pair from the
   * queue and announces it (arena room first, then the broadcast). Returns the matches it made.
   */
  async tick(): Promise<readonly RankedMatch[]> {
    if (this.ticking) return [];
    this.ticking = true;
    try {
      if (!(await this.lead())) return [];
      const now = this.deps.clock();
      const live: RankedEntry[] = [];
      for (const e of await this.entries()) {
        if (await this.deps.isOnline(e.playerId)) live.push(e);
        else await this.kv.hdel(RANKED_QUEUE_KEY, e.playerId);
      }
      const pairs = pairUp(live, now);
      if (pairs.length === 0) return [];
      const arena = await this.deps.arenaRoom();
      const [s0, s1] = rankedArenaSpots();
      const out: RankedMatch[] = [];
      for (const [a, b] of pairs) {
        // a leave racing this pass wins: re-check both before removing them
        if ((await this.get(a.playerId)) === null || (await this.get(b.playerId)) === null) continue;
        await this.kv.hdel(RANKED_QUEUE_KEY, a.playerId);
        await this.kv.hdel(RANKED_QUEUE_KEY, b.playerId);
        const match: RankedMatch = {
          matchId: randomUUID(),
          zoneId: RANKED_ARENA.zoneId,
          arenaRoomId: arena.roomId,
          players: [
            { playerId: a.playerId, name: a.name, rating: a.rating, x: s0.x, z: s0.z },
            { playerId: b.playerId, name: b.name, rating: b.rating, x: s1.x, z: s1.z },
          ],
          expiresAt: now + RANKED_ARRIVAL_MS,
        };
        await this.kv.publish(rankedArenaTopic(arena.roomId), match);
        await this.kv.publish(RANKED_MATCH_TOPIC, match);
        out.push(match);
      }
      return out;
    } finally {
      this.ticking = false;
    }
  }

  private async lead(): Promise<boolean> {
    const cur = await this.kv.get(RANKED_LEADER_KEY);
    if (typeof cur === 'string' && cur.length > 0 && cur !== this.token) return false;
    await this.kv.setex(RANKED_LEADER_KEY, this.token, RANKED_LEADER_TTL_S);
    return (await this.kv.get(RANKED_LEADER_KEY)) === this.token;
  }
}

/** One match the arena room is waiting on. */
export interface PendingRanked {
  readonly match: RankedMatch;
  /** `startPvp` is in flight */
  starting: boolean;
  /** a `RANKED_CANCEL_TOPIC` (or a leave) stopped it: present players are told `cancelled`, then it is dropped */
  cancelled: boolean;
  /** players already told the match is off */
  readonly notified: Set<string>;
}

/** The arena room's pending ranked matches (pure; the room's tick drives it). */
export class RankedArena {
  private readonly pending = new Map<string, PendingRanked>();

  add(match: RankedMatch): void {
    if (!this.pending.has(match.matchId)) this.pending.set(match.matchId, { match, starting: false, cancelled: false, notified: new Set() });
  }

  /** Marks the match cancelled; `byPlayerId` (the side that stopped it) is not told again. null when unknown here. */
  cancel(matchId: string, byPlayerId: string | null): PendingRanked | null {
    const p = this.pending.get(matchId);
    if (p === undefined || p.starting) return null;
    p.cancelled = true;
    if (byPlayerId !== null) p.notified.add(byPlayerId);
    return p;
  }

  /** The not-yet-started match this player belongs to, if any. */
  involving(playerId: string): PendingRanked | null {
    for (const p of this.pending.values()) if (p.match.players.some((s) => s.playerId === playerId)) return p;
    return null;
  }

  delete(matchId: string): void {
    this.pending.delete(matchId);
  }

  list(): readonly PendingRanked[] {
    return [...this.pending.values()];
  }

  get size(): number {
    return this.pending.size;
  }
}
