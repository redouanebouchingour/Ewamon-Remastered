import { and, asc, eq, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { ecoTakes } from '../schema/index';

export interface EcoTake {
  readonly speciesId: string;
  readonly caught: number;
  readonly ko: number;
}

/** A living ecosystem (migration 0018): each zone's weekly catches and knockouts per species. */
export const ecosystemRepo = {
  /** Adds to a species' tally in a zone's week (one upsert; nothing when both are zero). */
  async add(tx: Tx, zoneId: string, week: number, speciesId: string, caught: number, ko: number): Promise<void> {
    const c = Math.max(0, Math.trunc(caught));
    const k = Math.max(0, Math.trunc(ko));
    if (c <= 0 && k <= 0) return;
    await tx
      .insert(ecoTakes)
      .values({ zoneId, week, speciesId, caught: c, ko: k })
      .onConflictDoUpdate({
        target: [ecoTakes.zoneId, ecoTakes.week, ecoTakes.speciesId],
        set: { caught: sql`${ecoTakes.caught} + ${c}`, ko: sql`${ecoTakes.ko} + ${k}` },
      });
  },

  /** One zone's tallies for a week, by species id. */
  async week(tx: Tx, zoneId: string, week: number): Promise<EcoTake[]> {
    const rows = await tx
      .select()
      .from(ecoTakes)
      .where(and(eq(ecoTakes.zoneId, zoneId), eq(ecoTakes.week, week)))
      .orderBy(asc(ecoTakes.speciesId));
    return rows.map((r) => ({ speciesId: r.speciesId, caught: r.caught, ko: r.ko }));
  },
};

export type EcosystemRepo = typeof ecosystemRepo;
