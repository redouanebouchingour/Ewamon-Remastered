/**
 * Spectator mode: the arena's live matches, kept in the shared presence store so any process can list and serve them.
 *
 * An arena room with two players in a queued match (standard, Level 50, ranked, cup; never a friend battle, training
 * or the daily) publishes its battle as a replay that grows: the anonymised start, the seed and the turns played so far
 * minus the last `LIVE_DELAY_TURNS` (a watcher is a turn behind the players), with the digest the anonymised run
 * reaches after them. A watcher's client re-simulates it with core, exactly as a replay. When the battle ends the
 * whole fight is published with its outcome and kept a few minutes so watchers see the finish.
 */
import type { BattleOutcome, SideChoice } from '@ewa/core';
import type { BattleStartSnapshot, RngState } from '@ewa/persist';

export const LIVE_INDEX_KEY = 'ewa:live';
export const LIVE_DELAY_TURNS = 1;
/** A running match's feed outlives its last write by this long (a room that died stops being listed). */
export const LIVE_TTL_S = 600;
/** A finished match's feed stays this long, so watchers see the end. */
export const LIVE_ENDED_TTL_S = 180;

export const liveKey = (matchId: string): string => `ewa:live:${matchId}`;

export interface LivePlayer {
  readonly name: string;
  readonly rating: number;
}

export interface LiveSummary {
  readonly matchId: string;
  readonly kind: 'standard' | 'level50' | 'ranked' | 'cup';
  /** League Finals: a ranked match in Finals week between two of the season's top eight */
  readonly finals: boolean;
  readonly players: readonly [LivePlayer, LivePlayer];
  /** turns a watcher can see */
  readonly turn: number;
  readonly startedAt: number;
  readonly updatedAt: number;
}

export interface LiveFeed extends LiveSummary {
  /**
   * The fight so far as a replay (the shared replay's shape): side 0 seated, both players' names as labels, the
   * anonymised start, the seed, the shared turns and the digest the anonymised run reaches after them.
   */
  readonly replay: {
    readonly format: 'pvp';
    readonly seat: 0;
    readonly labels: readonly [string, string];
    readonly seed: RngState;
    readonly start: BattleStartSnapshot;
    readonly actions: readonly (readonly [SideChoice, SideChoice])[];
    readonly digest: string;
  };
  /** set once the battle is over (the replay then holds every turn) */
  readonly outcome: BattleOutcome | null;
}

/** The presence calls the board needs (Colyseus `Presence` structurally; tests pass a map). */
export interface LiveKV {
  hset(key: string, field: string, value: string): unknown;
  hdel(key: string, field: string): unknown;
  hgetall(key: string): Promise<Record<string, string> | null | undefined> | Record<string, string> | null | undefined;
  get(key: string): Promise<string | null | undefined> | string | null | undefined;
  setex(key: string, value: string, seconds: number): unknown;
}

const summaryOf = (f: LiveFeed): LiveSummary => ({
  matchId: f.matchId,
  kind: f.kind,
  finals: f.finals,
  players: f.players,
  turn: f.turn,
  startedAt: f.startedAt,
  updatedAt: f.updatedAt,
});

export class LiveBoard {
  constructor(
    private readonly kv: LiveKV,
    private readonly clock: () => number,
  ) {}

  /** A running match's feed (listed). */
  async publish(feed: LiveFeed): Promise<void> {
    await this.kv.setex(liveKey(feed.matchId), JSON.stringify(feed), LIVE_TTL_S);
    await this.kv.hset(LIVE_INDEX_KEY, feed.matchId, JSON.stringify(summaryOf(feed)));
  }

  /** The finished match: the whole fight, kept briefly for its watchers, no longer listed. */
  async finish(feed: LiveFeed): Promise<void> {
    await this.kv.setex(liveKey(feed.matchId), JSON.stringify(feed), LIVE_ENDED_TTL_S);
    await this.kv.hdel(LIVE_INDEX_KEY, feed.matchId);
  }

  /** A match that never started or was voided: gone. */
  async drop(matchId: string): Promise<void> {
    await this.kv.hdel(LIVE_INDEX_KEY, matchId);
  }

  /** The live matches: League Finals first, then the highest rated pairs, then the newest. Stale entries are swept. */
  async list(): Promise<LiveSummary[]> {
    const all = (await this.kv.hgetall(LIVE_INDEX_KEY)) ?? {};
    const now = this.clock();
    const out: LiveSummary[] = [];
    for (const [id, raw] of Object.entries(all)) {
      let s: LiveSummary | null = null;
      try {
        s = JSON.parse(raw) as LiveSummary;
      } catch (_e) {
        s = null;
      }
      if (s === null || now - s.updatedAt > LIVE_TTL_S * 1000) {
        await this.kv.hdel(LIVE_INDEX_KEY, id);
        continue;
      }
      out.push(s);
    }
    const weight = (s: LiveSummary): number => s.players[0].rating + s.players[1].rating;
    return out.sort((a, b) => Number(b.finals) - Number(a.finals) || weight(b) - weight(a) || b.startedAt - a.startedAt);
  }

  /** One match's feed (running or just finished), or null. */
  async feed(matchId: string): Promise<LiveFeed | null> {
    const raw = await this.kv.get(liveKey(matchId));
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as LiveFeed;
    } catch (_e) {
      return null;
    }
  }
}
