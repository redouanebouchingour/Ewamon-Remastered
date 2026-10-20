import { and, asc, desc, eq, gte, isNotNull, isNull, lt, lte, max, ne, sql } from 'drizzle-orm';
import { SEASON_BASE_RATING, SEASON_FINALISTS } from '@ewa/content';
import type { Tx } from '../db';
import { battleHistory, players, seasonResults, seasons } from '../schema/index';
import type { PlayerRow } from '../schema/index';

export interface SeasonWindow {
  readonly number: number;
  readonly startsAt: number;
  readonly endsAt: number;
}

export interface SeasonStanding {
  readonly player: PlayerRow;
  readonly rank: number;
  readonly rating: number;
  readonly wins: number;
  readonly losses: number;
}

/** Everyone with a rated fight in [from, to): their rated wins and losses there, and their player row. */
async function participants(tx: Tx, from: number, to: number, limit: number | null): Promise<{ player: PlayerRow; wins: number; losses: number }[]> {
  const wins = sql<number>`count(*) filter (where ${battleHistory.result} = 'win')::int`;
  const losses = sql<number>`count(*) filter (where ${battleHistory.result} = 'loss')::int`;
  const q = tx
    .select({ player: players, wins, losses })
    .from(battleHistory)
    .innerJoin(players, eq(players.id, battleHistory.playerId))
    .where(
      and(
        isNotNull(battleHistory.ratingDelta),
        gte(battleHistory.happenedAt, new Date(from)),
        lt(battleHistory.happenedAt, new Date(to)),
        isNull(players.bannedAt),
      ),
    )
    .groupBy(players.id)
    .orderBy(desc(players.rating), desc(wins), asc(players.usernameLower));
  const rows = limit === null ? await q : await q.limit(limit);
  return rows.map((r) => ({ player: r.player, wins: Number(r.wins), losses: Number(r.losses) }));
}

/** Ranked seasons (migration 0011): closing a season, its final standings, and the standings so far. */
export const seasonRepo = {
  /** The highest closed season (0 before the first close). */
  async lastClosed(tx: Tx): Promise<number> {
    const [r] = await tx.select({ n: max(seasons.season) }).from(seasons);
    return r?.n ?? 0;
  },

  /**
   * Closes `season` once: its row is the lock (a second caller gets false). Writes the final standings (everyone with a
   * rated fight in it, by rating now) and, with `reset`, moves every rating halfway back to the base. Run as soon as
   * the season ends, so the ratings are the season's; a server that missed several closes resets only on the last.
   */
  async close(tx: Tx, season: SeasonWindow, now: Date, reset = true): Promise<boolean> {
    const taken = await tx.insert(seasons).values({ season: season.number, closedAt: now }).onConflictDoNothing().returning({ season: seasons.season });
    if (taken.length === 0) return false;
    const rows = await participants(tx, season.startsAt, season.endsAt, null);
    if (rows.length > 0) {
      await tx.insert(seasonResults).values(
        rows.map((r, i) => ({ season: season.number, playerId: r.player.id, rank: i + 1, rating: r.player.rating, wins: r.wins, losses: r.losses })),
      );
    }
    if (!reset) return true;
    // halfway back to the base; Postgres integer division truncates towards zero, like seasonResetRating
    await tx
      .update(players)
      .set({ rating: sql`${SEASON_BASE_RATING} + (${players.rating} - ${SEASON_BASE_RATING}) / 2` })
      .where(ne(players.rating, SEASON_BASE_RATING));
    return true;
  },

  /** A closed season's final standings, best first. */
  async standings(tx: Tx, season: number, page: number, pageSize: number): Promise<SeasonStanding[]> {
    const size = Math.min(100, Math.max(1, pageSize));
    const rows = await tx
      .select({ r: seasonResults, player: players })
      .from(seasonResults)
      .innerJoin(players, eq(players.id, seasonResults.playerId))
      .where(eq(seasonResults.season, season))
      .orderBy(asc(seasonResults.rank))
      .limit(size)
      .offset(Math.max(0, page - 1) * size);
    return rows.map(({ r, player }) => ({ player, rank: r.rank, rating: r.rating, wins: r.wins, losses: r.losses }));
  },

  /** The running season's standings so far (rated fights since `from`, by rating now), best first. */
  async current(tx: Tx, from: number, now: number, limit: number): Promise<SeasonStanding[]> {
    const rows = await participants(tx, from, now + 1, Math.min(100, Math.max(1, limit)));
    return rows.map((r, i) => ({ player: r.player, rank: i + 1, rating: r.player.rating, wins: r.wins, losses: r.losses }));
  },

  /** The Finalist and Champion places a player has earned (top `SEASON_FINALISTS`), newest season first. */
  async titles(tx: Tx, playerId: string): Promise<{ season: number; rank: number }[]> {
    const rows = await tx
      .select({ season: seasonResults.season, rank: seasonResults.rank })
      .from(seasonResults)
      .where(and(eq(seasonResults.playerId, playerId), lte(seasonResults.rank, SEASON_FINALISTS)))
      .orderBy(desc(seasonResults.season));
    return rows;
  },
};

export type SeasonRepo = typeof seasonRepo;
