import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { players, runSplits } from '../schema/index';
import type { PlayerRow } from '../schema/index';

/** The play clock now: the banked time plus the running session, in SQL (one expression, any transaction). */
function clockNow(now: Date) {
  return sql<number>`(${players.playMs} + coalesce(greatest(0, floor(extract(epoch from (${now.toISOString()}::timestamptz - ${players.playStartedAt})) * 1000)), 0))::bigint`;
}

export interface RunSplit {
  readonly split: string;
  readonly playMs: number;
  readonly at: Date;
}

/** Verified speedruns (migration 0009): the server's play clock and the splits written against it. */
export const runRepo = {
  /** A room took the player: the clock runs (an already running clock keeps its start, e.g. across a handover). */
  async start(tx: Tx, playerId: string, now: Date): Promise<void> {
    await tx.update(players).set({ playStartedAt: sql`coalesce(${players.playStartedAt}, ${now.toISOString()}::timestamptz)` }).where(eq(players.id, playerId));
  },

  /** The player left the world: the running session is banked and the clock stops. */
  async stop(tx: Tx, playerId: string, now: Date): Promise<void> {
    await tx
      .update(players)
      .set({ playMs: clockNow(now), playStartedAt: null })
      .where(and(eq(players.id, playerId), isNotNull(players.playStartedAt)));
  },

  /** The clock now and whether it runs; null for an unknown player. */
  async clock(tx: Tx, playerId: string, now: Date): Promise<{ playMs: number; running: boolean } | null> {
    const [r] = await tx.select({ playMs: clockNow(now), started: players.playStartedAt }).from(players).where(eq(players.id, playerId)).limit(1);
    return r === undefined ? null : { playMs: Number(r.playMs), running: r.started !== null };
  },

  /**
   * After a restart no room holds anyone, so every running clock is stale: it stops without banking the gap (the
   * player's time is never charged for a server outage). Returns how many were stopped.
   */
  async stopAll(tx: Tx): Promise<number> {
    const rows = await tx.update(players).set({ playStartedAt: null }).where(isNotNull(players.playStartedAt)).returning({ id: players.id });
    return rows.length;
  },

  /** Records `split` at the clock now, the first time only. */
  async split(tx: Tx, playerId: string, split: string, now: Date): Promise<void> {
    await tx.execute(sql`
      insert into ${runSplits} (player_id, split, play_ms, at)
      select ${players.id}, ${split}, ${clockNow(now)}, ${now.toISOString()}::timestamptz from ${players} where ${players.id} = ${playerId}
      on conflict (player_id, split) do nothing`);
  },

  async splits(tx: Tx, playerId: string): Promise<RunSplit[]> {
    const rows = await tx.select().from(runSplits).where(eq(runSplits.playerId, playerId)).orderBy(asc(runSplits.playMs), asc(runSplits.split));
    return rows.map((r) => ({ split: r.split, playMs: Number(r.playMs), at: r.at }));
  },

  /**
   * The board: players who reached `finish` in a run that holds `start` too (an account already past the start when
   * the clock arrived is not a run), fastest first; banned excluded.
   */
  async board(tx: Tx, start: string, finish: string, page: number, pageSize: number): Promise<{ player: PlayerRow; playMs: number }[]> {
    const size = Math.min(100, Math.max(1, pageSize));
    const rows = await tx
      .select({ player: players, playMs: runSplits.playMs })
      .from(runSplits)
      .innerJoin(players, eq(players.id, runSplits.playerId))
      .where(
        and(
          eq(runSplits.split, finish),
          isNull(players.bannedAt),
          sql`exists (select 1 from ${runSplits} s0 where s0.player_id = ${players.id} and s0.split = ${start})`,
        ),
      )
      .orderBy(asc(runSplits.playMs), asc(players.usernameLower))
      .limit(size)
      .offset(Math.max(0, page - 1) * size);
    return rows.map((r) => ({ player: r.player, playMs: Number(r.playMs) }));
  },
};

export type RunRepo = typeof runRepo;
