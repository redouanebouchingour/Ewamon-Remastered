import { desc, eq } from 'drizzle-orm';
import type { Tx } from '../db';
import { seasonLegends } from '../schema/index';

export interface SeasonLegend {
  readonly season: number;
  readonly species: string;
  readonly playerName: string;
  readonly caughtAt: Date;
}

/** One roaming legendary per season (migration 0014): who caught each season's roamer first. */
export const legendRepo = {
  /** Records the season's first catch; false when someone was first already. */
  async claim(tx: Tx, season: number, species: string, playerId: string, playerName: string, now: Date): Promise<boolean> {
    const rows = await tx.insert(seasonLegends).values({ season, species, playerId, playerName, caughtAt: now }).onConflictDoNothing().returning({ season: seasonLegends.season });
    return rows.length > 0;
  },

  /** The season's first catch, or null while the roamer roams. */
  async of(tx: Tx, season: number): Promise<SeasonLegend | null> {
    const [r] = await tx.select().from(seasonLegends).where(eq(seasonLegends.season, season)).limit(1);
    return r === undefined ? null : { season: r.season, species: r.species, playerName: r.playerName, caughtAt: r.caughtAt };
  },

  /** Every season's first catch, newest first. */
  async all(tx: Tx, limit = 50): Promise<SeasonLegend[]> {
    const rows = await tx.select().from(seasonLegends).orderBy(desc(seasonLegends.season)).limit(Math.min(200, Math.max(1, limit)));
    return rows.map((r) => ({ season: r.season, species: r.species, playerName: r.playerName, caughtAt: r.caughtAt }));
  },
};

export type LegendRepo = typeof legendRepo;
