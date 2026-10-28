/**
 * Trainer banners (content `data/banners.ts`): the counts a trainer's unlocks are measured by, and the banner as other
 * trainers see it. Every count is the server's own (badges, the dex, the tower streak, closed seasons, claimed
 * achievements, owned shinies, won player battles), so a frame or a pin on someone's card is true. Read by
 * `GET/POST /banner` and `GET /players/:username`; the zone room reads the frame's rarity for the nameplate.
 */
import { ACHIEVEMENT_IDS, BANNER_TRACKERS, DEFAULT_BANNER, LEGENDARY_IDS, MAJIN_BAND, MYTHICAL_IDS, SPECIES, TENJIN_BAND, bannerFormRefusal, bannerFrame, bannerPin, bannerShown, pinTier } from '@ewa/content';
import type { BannerChoice, BannerCount, BannerStats } from '@ewa/content';
import type { BandKind, CreatureInstance, TypeName } from '@ewa/core';
import type { Repos, SavedBanner, Tx } from '@ewa/persist';
import { trainerLevelFor } from '@ewa/persist';
import type { BannerView } from '@ewa/protocol';
import { CHAMPION_FLAG, toInstance } from '../rooms/battleSession';

const typesOf = new Map(SPECIES.map((s) => [s.id, s.types]));
const LEGENDS = new Set([...LEGENDARY_IDS, ...MYTHICAL_IDS]);
const ACHIEVEMENTS = new Set(ACHIEVEMENT_IDS);

export function choiceOf(saved: SavedBanner | null): BannerChoice {
  return saved ?? DEFAULT_BANNER;
}

export async function bannerStatsOf(repos: Repos, tx: Tx, playerId: string): Promise<BannerStats | null> {
  const row = await repos.players.byId(tx, playerId);
  if (row === null) return null;
  const counts = await repos.banners.counts(tx, playerId);
  const typeCaught: Partial<Record<TypeName, number>> = {};
  let legendaries = 0;
  for (const id of counts.caughtSpecies) {
    for (const t of typesOf.get(id) ?? []) typeCaught[t] = (typeCaught[t] ?? 0) + 1;
    if (LEGENDS.has(id)) legendaries++;
  }
  const flags = await repos.progress.flags(tx, playerId);
  const seasons = await repos.seasons.titles(tx, playerId);
  const claimed = await repos.progress.claimedQuestIds(tx, playerId);
  const bag = await repos.inventory.all(tx, playerId);
  const bands: BandKind[] = [];
  if ((bag[MAJIN_BAND] ?? 0) > 0) bands.push('majin');
  if ((bag[TENJIN_BAND] ?? 0) > 0) bands.push('tenjin');
  return {
    badges: (await repos.progress.badges(tx, playerId)).length,
    dexCaught: counts.caughtSpecies.length,
    trainerLevel: trainerLevelFor(row.trainerExp),
    rating: row.rating,
    peakRating: row.peakRating,
    towerBest: (await repos.streaks.get(tx, playerId)).best,
    shinies: counts.shinies,
    legendaries,
    pvpWins: counts.pvpWins,
    achievements: claimed.filter((q) => ACHIEVEMENTS.has(q)).length,
    champion: flags.includes(CHAMPION_FLAG),
    seasonBest: seasons.reduce((best, t) => (best === 0 || t.rank < best ? t.rank : best), 0),
    typeCaught,
    bands,
  };
}

/** protocol `BannerView` before `out` copies it (core's readonly creature). */
export type BannerViewOut = Omit<BannerView, 'featured'> & { readonly featured: CreatureInstance | null };

/** The banner as other trainers see it: today's unlocks, pins at their tier, tracker values, the featured creature. */
export async function bannerViewOf(repos: Repos, tx: Tx, playerId: string): Promise<BannerViewOut | null> {
  const stats = await bannerStatsOf(repos, tx, playerId);
  if (stats === null) return null;
  const shown = bannerShown(choiceOf(await repos.banners.get(tx, playerId)), stats);
  // the featured creature while the trainer still owns it, else the party lead
  const picked = shown.featuredId === null ? null : await repos.creatures.byId(tx, shown.featuredId);
  const own = picked !== null && picked.ownerId === playerId;
  const featured = own ? picked : ((await repos.creatures.party(tx, playerId))[0] ?? null);
  // the chosen form while it is still the chosen creature's and the band is still held; the party lead shows its own look
  const form = own && shown.featuredForm !== null && bannerFormRefusal(picked.speciesId, shown.featuredForm, stats) === null ? shown.featuredForm : null;
  return {
    frame: shown.frame,
    backdrop: shown.backdrop,
    pins: shown.pins.map((id) => ({ id, tier: pinTier(bannerPin(id)!, stats) })),
    trackers: shown.trackers.map((id) => ({ id, value: trackerValue(stats, id as BannerCount) })),
    featured: featured === null ? null : { ...toInstance(featured), ownerId: null },
    featuredForm: form,
  };
}

function trackerValue(stats: BannerStats, id: BannerCount): number {
  return BANNER_TRACKERS.some((t) => t.id === id) ? stats[id] : 0;
}

/** The nameplate's flair: the saved frame's rarity, '' for a common one (or none saved). */
export function flairOf(saved: SavedBanner | null): string {
  const rarity = saved === null ? undefined : bannerFrame(saved.frame)?.rarity;
  return rarity === undefined || rarity === 'common' ? '' : rarity;
}
