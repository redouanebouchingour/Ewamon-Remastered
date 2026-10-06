/**
 * Phase D14 — the battle tower streak (`player_streaks`, migration 0004). `current` counts the wins of the run in
 * progress and drops to 0 when the run ends (a loss, retiring, leaving); `best` is the longest streak ever and is
 * never lowered. Rows are created on the first write; a player without one reads `{ current: 0, best: 0 }`.
 */
import { and, asc, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { players, playerStreaks } from '../schema/index';
import type { PlayerRow } from '../schema/index';

export interface StreakState {
  readonly current: number;
  readonly best: number;
}

export interface StreakBoardRow {
  readonly player: PlayerRow;
  readonly current: number;
  readonly best: number;
}

const NONE: StreakState = Object.freeze({ current: 0, best: 0 });

export const streakRepo = {
  async get(tx: Tx, playerId: string): Promise<StreakState> {
    const [row] = await tx.select({ current: playerStreaks.current, best: playerStreaks.best }).from(playerStreaks).where(eq(playerStreaks.playerId, playerId)).limit(1);
    return row ?? NONE;
  },

  /** Streak rows for several players (leaderboard rows of the other modes); a missing id reads 0 / 0. */
  async byPlayers(tx: Tx, ids: readonly string[]): Promise<Map<string, StreakState>> {
    const out = new Map<string, StreakState>();
    if (ids.length === 0) return out;
    const rows = await tx
      .select({ playerId: playerStreaks.playerId, current: playerStreaks.current, best: playerStreaks.best })
      .from(playerStreaks)
      .where(inArray(playerStreaks.playerId, [...new Set(ids)]));
    for (const r of rows) out.set(r.playerId, { current: r.current, best: r.best });
    return out;
  },

  /** One more win in the run: current + 1, best = max(best, current + 1). Returns the new state. */
  async recordWin(tx: Tx, playerId: string, now: Date): Promise<StreakState> {
    const [row] = await tx
      .insert(playerStreaks)
      .values({ playerId, current: 1, best: 1, updatedAt: now })
      .onConflictDoUpdate({
        target: playerStreaks.playerId,
        set: {
          current: sql`${playerStreaks.current} + 1`,
          best: sql`greatest(${playerStreaks.best}, ${playerStreaks.current} + 1)`,
          updatedAt: now,
        },
      })
      .returning({ current: playerStreaks.current, best: playerStreaks.best });
    return row!;
  },

  /** The run ended: current = 0; best kept. Returns the new state. */
  async endRun(tx: Tx, playerId: string, now: Date): Promise<StreakState> {
    const [row] = await tx
      .insert(playerStreaks)
      .values({ playerId, current: 0, best: 0, updatedAt: now })
      .onConflictDoUpdate({ target: playerStreaks.playerId, set: { current: 0, updatedAt: now } })
      .returning({ current: playerStreaks.current, best: playerStreaks.best });
    return row!;
  },

  /**
   * `GET /leaderboard?mode=towerStreak`: players with a best streak > 0, best desc, then current desc, then
   * username_lower; banned excluded in SQL (pages stay full). pageSize clamped 1..100.
   */
  async leaderboard(tx: Tx, page: number, pageSize: number): Promise<StreakBoardRow[]> {
    const size = Math.min(100, Math.max(1, pageSize));
    const offset = Math.max(0, page - 1) * size;
    const rows = await tx
      .select({ player: players, current: playerStreaks.current, best: playerStreaks.best })
      .from(playerStreaks)
      .innerJoin(players, eq(players.id, playerStreaks.playerId))
      .where(and(isNull(players.bannedAt), gt(playerStreaks.best, 0)))
      .orderBy(desc(playerStreaks.best), desc(playerStreaks.current), asc(players.usernameLower))
      .limit(size)
      .offset(offset);
    return rows;
  },
};

export type StreakRepo = typeof streakRepo;
