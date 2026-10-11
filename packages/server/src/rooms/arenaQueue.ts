/**
 * Arena PvP queue (protocol arena.ts) — `ArenaQueue`, the out-of-world matcher.
 *
 * Presence-keyed like the Phase D13 ranked queue (matchQueue.ts), but one hash per mode: `ewa:arena:queue:<mode>`
 * (field = playerId, value = {playerId, name, rating, joinedAt}). A player is in at most one mode: joining another
 * mode moves them (the new entry starts a fresh wait); a second join of the same mode keeps the first entry and its
 * wait. One matcher runs cluster-wide: every process ticks every `ARENA_TICK_MS` and only the holder of the
 * `ewa:arena:leader` lease (5 s, refreshed by the tick) pairs players.
 *
 * Pairing per mode (`pairArena`): Ranked uses the ranked window (`pairUp`: ±100 widening to ±400, closest rating
 * first); Standard / Level 50 / Cup pair the two longest-waiting players. Each pass drops entries whose player has no
 * presence (silently) and entries older than `ARENA_QUEUE_TIMEOUT_MS` (`timedOut` → `arenaStatus idle / timeout`).
 * A pair is removed from the queue and handed to `match` (ArenaLobby: busy re-check, the arena room, the seats, the
 * `matched` pushes), which returns the entries to put back (the side that was still free when the other was not).
 *
 * Structural presence type (`ArenaKV`), no Colyseus import: the pure parts are unit-tested.
 */
import { randomUUID } from 'node:crypto';
import { ARENA_MODES, ARENA_QUEUE_TIMEOUT_MS } from '@ewa/protocol';
import type { ArenaMode } from '@ewa/protocol';
import { pairUp } from './matchQueue';
import type { RankedEntry, RankedKV } from './matchQueue';

export const ARENA_QUEUE_PREFIX = 'ewa:arena:queue:';
export const ARENA_LEADER_KEY = 'ewa:arena:leader';
export const ARENA_LEADER_TTL_S = 5;
export const ARENA_TICK_MS = 1_000;

/** The presence hash of one mode's queue. */
export function arenaQueueKey(mode: ArenaMode): string {
  return `${ARENA_QUEUE_PREFIX}${mode}`;
}

/** The per-player push topic (payload: a ServerMessage) — every room holding the player forwards it (zone or arena). */
export function arenaTopic(playerId: string): string {
  return `ewa:arena:${playerId}`;
}

/** A queue entry (the ranked entry's shape). */
export type ArenaEntry = RankedEntry;

/** The slice of Colyseus `Presence` the queue uses (LocalPresence and RedisPresence both fit). */
export type ArenaKV = RankedKV;

/**
 * The pairs one pass makes for `mode` (deterministic for a given input). Ranked: `pairUp` (within both players'
 * ranked windows). Every other mode: the two longest-waiting players, then the next two, and so on.
 */
export function pairArena(mode: ArenaMode, entries: readonly ArenaEntry[], now: number): [ArenaEntry, ArenaEntry][] {
  if (mode === 'ranked') return pairUp(entries, now);
  const queue = [...entries].sort((a, b) => a.joinedAt - b.joinedAt || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
  const out: [ArenaEntry, ArenaEntry][] = [];
  for (let i = 0; i + 1 < queue.length; i += 2) out.push([queue[i]!, queue[i + 1]!]);
  return out;
}

export interface ArenaQueueDeps {
  readonly clock: () => number;
  /** false → the entry is stale (its player left without a leave) and is dropped */
  readonly isOnline: (playerId: string) => Promise<boolean>;
  /** a pair left the queue: start it; resolves to the entries to put back into `mode` (their wait kept) */
  readonly match: (mode: ArenaMode, a: ArenaEntry, b: ArenaEntry) => Promise<readonly ArenaEntry[]>;
  /** an entry was dropped after `ARENA_QUEUE_TIMEOUT_MS` */
  readonly timedOut: (mode: ArenaMode, entry: ArenaEntry) => void;
}

function parseEntry(raw: unknown): ArenaEntry | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const v = JSON.parse(raw) as Partial<ArenaEntry>;
    if (typeof v.playerId !== 'string' || typeof v.name !== 'string' || typeof v.rating !== 'number' || typeof v.joinedAt !== 'number') return null;
    return { playerId: v.playerId, name: v.name, rating: v.rating, joinedAt: v.joinedAt };
  } catch (_e) {
    return null;
  }
}

export class ArenaQueue {
  /** this process's lease token */
  private readonly token = randomUUID();
  private ticking = false;

  constructor(
    private readonly kv: ArenaKV,
    private readonly deps: ArenaQueueDeps,
  ) {}

  /** Adds the player to `mode` (leaving any other mode). The same mode twice keeps the first entry and its wait. */
  async join(mode: ArenaMode, entry: ArenaEntry): Promise<ArenaEntry> {
    for (const m of ARENA_MODES) {
      if (m === mode) continue;
      if ((await this.get(m, entry.playerId)) !== null) await this.kv.hdel(arenaQueueKey(m), entry.playerId);
    }
    const prev = await this.get(mode, entry.playerId);
    if (prev !== null) return prev;
    await this.kv.hset(arenaQueueKey(mode), entry.playerId, JSON.stringify(entry));
    return entry;
  }

  /** Removes the player from whichever mode holds them; the mode it was in, or null. */
  async leave(playerId: string): Promise<ArenaMode | null> {
    const found = await this.find(playerId);
    if (found === null) return null;
    await this.kv.hdel(arenaQueueKey(found.mode), playerId);
    return found.mode;
  }

  async get(mode: ArenaMode, playerId: string): Promise<ArenaEntry | null> {
    return parseEntry(await this.kv.hget(arenaQueueKey(mode), playerId));
  }

  /** The mode and entry of a queued player, or null. */
  async find(playerId: string): Promise<{ readonly mode: ArenaMode; readonly entry: ArenaEntry } | null> {
    for (const mode of ARENA_MODES) {
      const entry = await this.get(mode, playerId);
      if (entry !== null) return { mode, entry };
    }
    return null;
  }

  async entries(mode: ArenaMode): Promise<ArenaEntry[]> {
    const all = (await this.kv.hgetall(arenaQueueKey(mode))) ?? {};
    const out: ArenaEntry[] = [];
    for (const raw of Object.values(all)) {
      const e = parseEntry(raw);
      if (e !== null) out.push(e);
    }
    return out;
  }

  /**
   * One matcher pass (leader only; never re-entered): per mode, drops stale and timed-out entries, pairs the rest,
   * removes each pair and hands it to `match` (re-adding what it returns). Returns how many pairs were handed over.
   */
  async tick(): Promise<number> {
    if (this.ticking) return 0;
    this.ticking = true;
    try {
      if (!(await this.lead())) return 0;
      let made = 0;
      for (const mode of ARENA_MODES) {
        const now = this.deps.clock();
        const live: ArenaEntry[] = [];
        for (const e of await this.entries(mode)) {
          if (!(await this.deps.isOnline(e.playerId))) {
            await this.kv.hdel(arenaQueueKey(mode), e.playerId);
          } else if (now - e.joinedAt >= ARENA_QUEUE_TIMEOUT_MS) {
            await this.kv.hdel(arenaQueueKey(mode), e.playerId);
            this.deps.timedOut(mode, e);
          } else {
            live.push(e);
          }
        }
        for (const [a, b] of pairArena(mode, live, now)) {
          // a leave racing this pass wins: re-check both before removing them
          if ((await this.get(mode, a.playerId)) === null || (await this.get(mode, b.playerId)) === null) continue;
          await this.kv.hdel(arenaQueueKey(mode), a.playerId);
          await this.kv.hdel(arenaQueueKey(mode), b.playerId);
          made += 1;
          const back = await this.deps.match(mode, a, b).catch(() => [] as readonly ArenaEntry[]);
          for (const e of back) await this.kv.hset(arenaQueueKey(mode), e.playerId, JSON.stringify(e));
        }
      }
      return made;
    } finally {
      this.ticking = false;
    }
  }

  private async lead(): Promise<boolean> {
    const cur = await this.kv.get(ARENA_LEADER_KEY);
    if (typeof cur === 'string' && cur.length > 0 && cur !== this.token) return false;
    await this.kv.setex(ARENA_LEADER_KEY, this.token, ARENA_LEADER_TTL_S);
    return (await this.kv.get(ARENA_LEADER_KEY)) === this.token;
  }
}
