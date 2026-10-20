import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { dailyResults, players } from '../schema/index';
import type { DailyResultRow, PlayerRow } from '../schema/index';

export interface DailyBest {
  readonly turns: number;
  readonly marks: string;
  readonly battleId: string;
}

export interface DailyState {
  readonly attempts: number;
  readonly best: DailyBest | null;
}

function stateOf(row: DailyResultRow | undefined): DailyState {
  if (row === undefined) return { attempts: 0, best: null };
  const best = row.turns !== null && row.marks !== null && row.battleId !== null ? { turns: row.turns, marks: row.marks, battleId: row.battleId } : null;
  return { attempts: row.attempts, best };
}

export const dailyRepo = {
  async get(tx: Tx, playerId: string, dayKey: string): Promise<DailyState> {
    const [row] = await tx.select().from(dailyResults).where(and(eq(dailyResults.playerId, playerId), eq(dailyResults.dayKey, dayKey))).limit(1);
    return stateOf(row);
  },

  /**
   * One finished try: `attempts + 1`; a win (`won` set) replaces the best when it took fewer turns (a tie keeps the
   * earlier one). Returns the state after.
   */
  async record(tx: Tx, playerId: string, dayKey: string, won: DailyBest | null, now: Date): Promise<DailyState> {
    const [prev] = await tx
      .select()
      .from(dailyResults)
      .where(and(eq(dailyResults.playerId, playerId), eq(dailyResults.dayKey, dayKey)))
      .for('update')
      .limit(1);
    const better = won !== null && (prev === undefined || prev.turns === null || won.turns < prev.turns);
    const best = better ? { turns: won.turns, marks: won.marks, battleId: won.battleId, wonAt: now } : {};
    if (prev === undefined) {
      const [row] = await tx.insert(dailyResults).values({ playerId, dayKey, attempts: 1, ...best }).returning();
      return stateOf(row);
    }
    const [row] = await tx
      .update(dailyResults)
      .set({ attempts: sql`${dailyResults.attempts} + 1`, ...best })
      .where(and(eq(dailyResults.playerId, playerId), eq(dailyResults.dayKey, dayKey)))
      .returning();
    return stateOf(row);
  },

  /** How many players have won the day's daily (banned excluded, as on the leaderboard). */
  async winners(tx: Tx, dayKey: string): Promise<number> {
    const [r] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(dailyResults)
      .innerJoin(players, eq(players.id, dailyResults.playerId))
      .where(and(eq(dailyResults.dayKey, dayKey), isNotNull(dailyResults.turns), isNull(players.bannedAt)));
    return r?.n ?? 0;
  },

  /** `GET /leaderboard?mode=daily`: the day's winners, fewest turns first, then the earlier win; banned excluded. */
  async leaderboard(tx: Tx, dayKey: string, page: number, pageSize: number): Promise<{ player: PlayerRow; turns: number; marks: string }[]> {
    const size = Math.min(100, Math.max(1, pageSize));
    const rows = await tx
      .select({ player: players, turns: dailyResults.turns, marks: dailyResults.marks })
      .from(dailyResults)
      .innerJoin(players, eq(players.id, dailyResults.playerId))
      .where(and(eq(dailyResults.dayKey, dayKey), isNotNull(dailyResults.turns), isNull(players.bannedAt)))
      .orderBy(asc(dailyResults.turns), asc(dailyResults.wonAt), asc(players.usernameLower))
      .limit(size)
      .offset(Math.max(0, page - 1) * size);
    return rows.map((r) => ({ player: r.player, turns: r.turns!, marks: r.marks ?? '' }));
  },
};

export type DailyRepo = typeof dailyRepo;
