import { and, asc, eq, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { worldHonor } from '../schema/index';

export interface ZoneHonor {
  readonly zoneId: string;
  readonly light: number;
  readonly shadow: number;
}

/** Honor shapes the world (migration 0012): each zone's season tally of light and shadow points. */
export const worldHonorRepo = {
  /** Adds a turn's deeds to the zone's tally (one upsert; nothing for an empty turn). */
  async add(tx: Tx, season: number, zoneId: string, light: number, shadow: number): Promise<void> {
    if (light <= 0 && shadow <= 0) return;
    await tx
      .insert(worldHonor)
      .values({ season, zoneId, light: Math.max(0, light), shadow: Math.max(0, shadow) })
      .onConflictDoUpdate({
        target: [worldHonor.season, worldHonor.zoneId],
        set: { light: sql`${worldHonor.light} + ${Math.max(0, light)}`, shadow: sql`${worldHonor.shadow} + ${Math.max(0, shadow)}` },
      });
  },

  /** One zone's tally this season (zero when nothing happened there yet). */
  async of(tx: Tx, season: number, zoneId: string): Promise<ZoneHonor> {
    const [r] = await tx.select().from(worldHonor).where(and(eq(worldHonor.season, season), eq(worldHonor.zoneId, zoneId))).limit(1);
    return { zoneId, light: r?.light ?? 0, shadow: r?.shadow ?? 0 };
  },

  /** Every zone with a tally this season. */
  async season(tx: Tx, season: number): Promise<ZoneHonor[]> {
    const rows = await tx.select().from(worldHonor).where(eq(worldHonor.season, season)).orderBy(asc(worldHonor.zoneId));
    return rows.map((r) => ({ zoneId: r.zoneId, light: r.light, shadow: r.shadow }));
  },
};

export type WorldHonorRepo = typeof worldHonorRepo;
