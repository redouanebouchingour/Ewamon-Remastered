/**
 * Game constants persist needs for its invariants. Copied from the spine so persist has no runtime
 * dependency on @ewa/content (which does not exist yet).
 *
 * TODO(content): once @ewa/content ships `MARKET` (§3.8) and @ewa/core ships `RANK_TIERS`,
 * `tierFor`, `trainerLevelFor` (§2.17, §2.18), re-point these at the real exports.
 */

/** §3.8 MARKET. */
export const MARKET = {
  listMaxPerHour: 5,
  bidMaxPerHour: 30,
  durationsHours: [12, 24, 48] as const,
  minStartingBid: 100,
  feePercent: 5,
} as const;

/** §5.2 placeBid: amount >= max(startingBid, currentBid + 50). */
export const MIN_BID_INCREMENT = 50;

/** §5.2 guilds: membership limit enforced under a lock on the guild row. */
export const GUILD_MAX_MEMBERS = 50;

/** Default guild founding fee, charged in the same transaction as the insert (callers may override). */
export const GUILD_CREATE_COST = 5000;

/** §4.7: refresh tokens live 30 days. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** §2.17 RANK_TIERS. */
export const RANK_TIERS: readonly { readonly key: string; readonly label: string; readonly minRating: number }[] = [
  { key: 'bronze', label: 'Bronze', minRating: 0 },
  { key: 'silver', label: 'Silver', minRating: 1100 },
  { key: 'gold', label: 'Gold', minRating: 1250 },
  { key: 'platinum', label: 'Platinum', minRating: 1400 },
  { key: 'diamond', label: 'Diamond', minRating: 1600 },
  { key: 'master', label: 'Master', minRating: 1800 },
];

export function tierFor(rating: number): (typeof RANK_TIERS)[number] {
  let best = RANK_TIERS[0]!;
  for (const tier of RANK_TIERS) if (rating >= tier.minRating) best = tier;
  return best;
}

/** §2.18: level = min(100, floor(exp / 1000) + 1). */
export function trainerLevelFor(exp: number): number {
  return Math.min(100, Math.floor(Math.max(0, exp) / 1000) + 1);
}

/** Party slots are 0..5; the reorder staging band sits at +PARTY_REORDER_OFFSET (see creatures repo). */
export const PARTY_MAX = 6;
export const PARTY_REORDER_OFFSET = 100;
