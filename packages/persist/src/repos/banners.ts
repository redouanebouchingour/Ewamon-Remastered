import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { battleHistory, creatureInstances, dexEntries, playerBanners } from '../schema/index';

/** A trainer's saved banner (migration 0027); content ids, unchecked here. */
export interface SavedBanner {
  readonly frame: string;
  readonly backdrop: string;
  readonly pins: readonly string[];
  readonly trackers: readonly string[];
  readonly featuredId: string | null;
}

/** The counts behind a banner that no other repo reads (the server adds badges, flags, streaks, seasons, quests). */
export interface BannerCounts {
  readonly caughtSpecies: readonly string[];
  readonly shinies: number;
  readonly pvpWins: number;
}

/** Trainer banners: the saved pick and the counts its unlocks are measured by. */
export const bannerRepo = {
  async get(tx: Tx, playerId: string): Promise<SavedBanner | null> {
    const [r] = await tx.select().from(playerBanners).where(eq(playerBanners.playerId, playerId)).limit(1);
    return r === undefined ? null : { frame: r.frame, backdrop: r.backdrop, pins: [...r.pins], trackers: [...r.trackers], featuredId: r.featuredId };
  },

  async set(tx: Tx, playerId: string, b: SavedBanner, now: Date): Promise<void> {
    const row = { frame: b.frame, backdrop: b.backdrop, pins: [...b.pins], trackers: [...b.trackers], featuredId: b.featuredId, updatedAt: now };
    await tx
      .insert(playerBanners)
      .values({ playerId, ...row })
      .onConflictDoUpdate({ target: playerBanners.playerId, set: row });
  },

  async counts(tx: Tx, playerId: string): Promise<BannerCounts> {
    const caught = await tx.select({ s: dexEntries.speciesId }).from(dexEntries).where(and(eq(dexEntries.playerId, playerId), isNotNull(dexEntries.caughtAt)));
    const [shiny] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(creatureInstances)
      .where(and(eq(creatureInstances.ownerId, playerId), eq(creatureInstances.isShiny, true)));
    const [wins] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(battleHistory)
      .where(and(eq(battleHistory.playerId, playerId), eq(battleHistory.format, 'pvp'), eq(battleHistory.result, 'win')));
    return { caughtSpecies: caught.map((r) => r.s), shinies: Number(shiny?.n ?? 0), pvpWins: Number(wins?.n ?? 0) };
  },
};

export type BannerRepo = typeof bannerRepo;
