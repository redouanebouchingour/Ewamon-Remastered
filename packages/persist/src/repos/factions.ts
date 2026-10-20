import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { players, seasonFactions } from '../schema/index';
import type { PlayerRow } from '../schema/index';

export type FactionSide = 'majin' | 'tenjin';

export interface FactionTotals {
  readonly points: Readonly<Record<FactionSide, number>>;
  readonly members: Readonly<Record<FactionSide, number>>;
}

/** Majin vs Tenjin seasons (migration 0013): a trainer's side for a season, the points they earn it, the totals. */
export const factionRepo = {
  /** Takes a side for the season; a trainer who already has one keeps it. Returns the side they hold. */
  async join(tx: Tx, season: number, playerId: string, side: FactionSide, now: Date): Promise<FactionSide> {
    await tx.insert(seasonFactions).values({ season, playerId, side, joinedAt: now }).onConflictDoNothing();
    const [r] = await tx
      .select({ side: seasonFactions.side })
      .from(seasonFactions)
      .where(and(eq(seasonFactions.season, season), eq(seasonFactions.playerId, playerId)))
      .limit(1);
    return r!.side as FactionSide;
  },

  /** The trainer's side and points this season, or null before they chose. */
  async of(tx: Tx, season: number, playerId: string): Promise<{ side: FactionSide; points: number } | null> {
    const [r] = await tx
      .select({ side: seasonFactions.side, points: seasonFactions.points })
      .from(seasonFactions)
      .where(and(eq(seasonFactions.season, season), eq(seasonFactions.playerId, playerId)))
      .limit(1);
    return r === undefined ? null : { side: r.side as FactionSide, points: r.points };
  },

  /** Adds points for the trainer's side (nothing when they have not chosen). Returns the side, or null. */
  async award(tx: Tx, season: number, playerId: string, points: number): Promise<FactionSide | null> {
    if (points <= 0) return null;
    const rows = await tx
      .update(seasonFactions)
      .set({ points: sql`${seasonFactions.points} + ${points}` })
      .where(and(eq(seasonFactions.season, season), eq(seasonFactions.playerId, playerId)))
      .returning({ side: seasonFactions.side });
    return rows.length === 0 ? null : (rows[0]!.side as FactionSide);
  },

  /** Both sides' points and members this season (banned trainers' points still count; they were earned). */
  async totals(tx: Tx, season: number): Promise<FactionTotals> {
    const rows = await tx
      .select({ side: seasonFactions.side, points: sql<number>`coalesce(sum(${seasonFactions.points}), 0)::int`, members: sql<number>`count(*)::int` })
      .from(seasonFactions)
      .where(eq(seasonFactions.season, season))
      .groupBy(seasonFactions.side);
    const points = { majin: 0, tenjin: 0 };
    const members = { majin: 0, tenjin: 0 };
    for (const r of rows) {
      if (r.side !== 'majin' && r.side !== 'tenjin') continue;
      points[r.side] = Number(r.points);
      members[r.side] = Number(r.members);
    }
    return { points, members };
  },

  /** A side's best contributors this season (banned left out), most points first. */
  async top(tx: Tx, season: number, side: FactionSide, limit: number): Promise<{ player: PlayerRow; points: number }[]> {
    const rows = await tx
      .select({ player: players, points: seasonFactions.points })
      .from(seasonFactions)
      .innerJoin(players, eq(players.id, seasonFactions.playerId))
      .where(and(eq(seasonFactions.season, season), eq(seasonFactions.side, side), isNull(players.bannedAt)))
      .orderBy(desc(seasonFactions.points), seasonFactions.joinedAt)
      .limit(Math.min(50, Math.max(1, limit)));
    return rows.map((r) => ({ player: r.player, points: r.points }));
  },
};

export type FactionRepo = typeof factionRepo;
