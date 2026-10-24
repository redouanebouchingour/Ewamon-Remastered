import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { badges, campRaids, listings, nemeses, players, runSplits } from '../schema/index';

/**
 * The rumour board's reads (LLM feature 8, server game/rumours.ts): what happened in the world in a window, read-only
 * and across players. Only what is already public elsewhere is read with a name: usernames as the rankings and public
 * profiles show them (badges, the Champion split), a camp's new holder as its camp shows it, a nemesis by its own name
 * (never its trainer's). Banned players are left out. Every list is capped and ordered so the same rows come back in
 * the same order.
 */

export interface NewsBadge {
  readonly username: string;
  readonly badgeId: string;
  readonly at: Date;
}

export interface NewsSplit {
  readonly username: string;
  readonly at: Date;
}

export interface NewsCampTakeover {
  readonly zoneId: string;
  /** the raider who took it, as the camp now shows its owner */
  readonly holder: string;
  readonly at: Date;
}

export interface NewsNemesis {
  readonly name: string;
  readonly title: string;
  readonly speciesId: string;
  readonly level: number;
  readonly rank: number;
  readonly zoneId: string;
}

export interface NewsSale {
  readonly speciesId: string;
  readonly price: number;
  readonly at: Date;
}

const cap = (n: number, max: number): number => Math.min(max, Math.max(1, Math.trunc(n)));

export const worldNewsRepo = {
  /** Badges earned in [from, to), the earliest first. */
  async badgesBetween(tx: Tx, from: Date, to: Date, limit: number): Promise<NewsBadge[]> {
    const rows = await tx
      .select({ username: players.username, badgeId: badges.badgeId, at: badges.earnedAt })
      .from(badges)
      .innerJoin(players, eq(players.id, badges.playerId))
      .where(and(gte(badges.earnedAt, from), lt(badges.earnedAt, to), isNull(players.bannedAt)))
      .orderBy(asc(badges.earnedAt), asc(players.username), asc(badges.badgeId))
      .limit(cap(limit, 200));
    return rows;
  },

  /** Players who first reached `split` (a run split, e.g. `champion`) in [from, to), the earliest first. */
  async splitsBetween(tx: Tx, split: string, from: Date, to: Date, limit: number): Promise<NewsSplit[]> {
    return tx
      .select({ username: players.username, at: runSplits.at })
      .from(runSplits)
      .innerJoin(players, eq(players.id, runSplits.playerId))
      .where(and(eq(runSplits.split, split), gte(runSplits.at, from), lt(runSplits.at, to), isNull(players.bannedAt)))
      .orderBy(asc(runSplits.at), asc(players.username))
      .limit(cap(limit, 100));
  },

  /** Camps that changed hands in [from, to) (a won raid that took the camp over), the latest first. */
  async campTakeovers(tx: Tx, from: Date, to: Date, limit: number): Promise<NewsCampTakeover[]> {
    return tx
      .select({ zoneId: campRaids.zoneId, holder: campRaids.raiderName, at: campRaids.at })
      .from(campRaids)
      .where(and(eq(campRaids.tookOver, true), gte(campRaids.at, from), lt(campRaids.at, to)))
      .orderBy(desc(campRaids.at), asc(campRaids.zoneId))
      .limit(cap(limit, 50));
  },

  /** Active nemeses last seen in `zoneIds` from rank `minRank`, the strongest first. */
  async risingNemeses(tx: Tx, zoneIds: readonly string[], minRank: number, limit: number): Promise<NewsNemesis[]> {
    if (zoneIds.length === 0) return [];
    return tx
      .select({ name: nemeses.name, title: nemeses.title, speciesId: nemeses.speciesId, level: nemeses.level, rank: nemeses.rank, zoneId: nemeses.lastZone })
      .from(nemeses)
      .where(and(eq(nemeses.status, 'active'), inArray(nemeses.lastZone, [...zoneIds]), gte(nemeses.rank, minRank)))
      .orderBy(desc(nemeses.rank), desc(nemeses.level), asc(nemeses.name), asc(nemeses.id))
      .limit(cap(limit, 50));
  },

  /** Market sales resolved in [from, to) (a sold listing's price is its last bid), the earliest first. */
  async salesBetween(tx: Tx, from: Date, to: Date, limit: number): Promise<NewsSale[]> {
    const rows = await tx
      .select({ speciesId: listings.speciesId, price: sql<number>`coalesce(${listings.currentBid}, 0)`, at: listings.resolvedAt })
      .from(listings)
      .where(and(eq(listings.status, 'sold'), gte(listings.resolvedAt, from), lt(listings.resolvedAt, to)))
      .orderBy(asc(listings.resolvedAt), asc(listings.id))
      .limit(cap(limit, 2000));
    return rows.flatMap((r) => (r.at === null || Number(r.price) <= 0 ? [] : [{ speciesId: r.speciesId, price: Number(r.price), at: r.at }]));
  },
};

export type WorldNewsRepo = typeof worldNewsRepo;
