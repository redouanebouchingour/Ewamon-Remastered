/**
 * Trainer banners: the card other trainers see when they inspect you in the world or open your profile. A banner is a
 * frame, a backdrop, up to three pins, up to three stat trackers and one featured creature. Frames, backdrops and pins
 * unlock from what the server counts for the trainer (`BannerStats`, server `game/banner.ts`), so a loud banner says
 * something true about who wears it. Pins climb tiers as the count grows; the tier shown is always the current one.
 * Everything here is pure: the server validates a save with `bannerRefusal`, the client shows the same locks.
 */
import type { TypeName } from '@ewa/core';
import { TYPE_NAMES } from '@ewa/core';
import { SPECIES } from './species';

export const BANNER_RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const;
export type BannerRarity = (typeof BANNER_RARITIES)[number];

/** What the server counts for one trainer. Every number is public except `typeCaught`, which only the owner reads. */
export interface BannerStats {
  readonly badges: number;
  readonly dexCaught: number;
  readonly trainerLevel: number;
  readonly rating: number;
  readonly peakRating: number;
  /** the battle tower's longest streak */
  readonly towerBest: number;
  /** shiny creatures the trainer owns now (party and box) */
  readonly shinies: number;
  /** legendary and mythical species caught (the dex) */
  readonly legendaries: number;
  /** won player battles (`battle_history` pvp wins: in-world duels, the arena) */
  readonly pvpWins: number;
  /** achievements claimed */
  readonly achievements: number;
  /** the Champion is beaten */
  readonly champion: boolean;
  /** the best finish in a closed ranked season: 1 = Champion, 2 to 8 a finalist, 0 = none */
  readonly seasonBest: number;
  /** caught species per type (either slot) */
  readonly typeCaught: Readonly<Partial<Record<TypeName, number>>>;
}

export type BannerCount = 'badges' | 'dexCaught' | 'trainerLevel' | 'rating' | 'peakRating' | 'towerBest' | 'shinies' | 'legendaries' | 'pvpWins' | 'achievements';

export type BannerUnlock =
  | { readonly kind: 'free' }
  | { readonly kind: 'count'; readonly stat: BannerCount; readonly atLeast: number }
  | { readonly kind: 'champion' }
  | { readonly kind: 'season'; readonly rankAtMost: number }
  | { readonly kind: 'type'; readonly type: TypeName; readonly atLeast: number };

export interface BannerFrameDef {
  readonly id: string;
  readonly name: string;
  readonly rarity: BannerRarity;
  readonly unlock: BannerUnlock;
}

export interface BannerBackdropDef {
  readonly id: string;
  readonly name: string;
  readonly rarity: BannerRarity;
  /** a type backdrop paints in that type's colour and carries its icon */
  readonly type: TypeName | null;
  readonly unlock: BannerUnlock;
}

export interface BannerPinDef {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /** ascending; the pin's tier is how many of these the trainer meets (0 = not earned) */
  readonly tiers: readonly BannerUnlock[];
}

export interface BannerTrackerDef {
  readonly id: BannerCount;
  readonly label: string;
}

export interface BannerChoice {
  readonly frame: string;
  readonly backdrop: string;
  readonly pins: readonly string[];
  readonly trackers: readonly string[];
  /** one of the trainer's creatures (party or box), or null for the lead of the party */
  readonly featuredId: string | null;
}

export const BANNER_PIN_SLOTS = 3;
export const BANNER_TRACKER_SLOTS = 3;

const free: BannerUnlock = { kind: 'free' };
const count = (stat: BannerCount, atLeast: number): BannerUnlock => ({ kind: 'count', stat, atLeast });

export const BANNER_FRAMES: readonly BannerFrameDef[] = [
  { id: 'standard', name: 'Standard Issue', rarity: 'common', unlock: free },
  { id: 'paperline', name: 'Paperline', rarity: 'common', unlock: free },
  { id: 'circuit', name: 'Gym Circuit', rarity: 'rare', unlock: count('badges', 4) },
  { id: 'field_notes', name: 'Field Notes', rarity: 'rare', unlock: count('dexCaught', 40) },
  { id: 'veteran', name: 'Veteran', rarity: 'rare', unlock: count('trainerLevel', 20) },
  { id: 'eight_crowns', name: 'Eight Crowns', rarity: 'epic', unlock: count('badges', 8) },
  { id: 'duelist', name: 'Duelist', rarity: 'epic', unlock: count('pvpWins', 25) },
  { id: 'spire', name: 'Spire', rarity: 'epic', unlock: count('towerBest', 21) },
  { id: 'platinum_edge', name: 'Platinum Edge', rarity: 'epic', unlock: count('peakRating', 1400) },
  { id: 'laurel', name: "Champion's Laurel", rarity: 'legendary', unlock: { kind: 'champion' } },
  { id: 'prismatic', name: 'Prismatic', rarity: 'legendary', unlock: count('shinies', 3) },
  { id: 'mythkeeper', name: 'Mythkeeper', rarity: 'legendary', unlock: count('legendaries', 5) },
  { id: 'finalist', name: "Finalist's Edge", rarity: 'legendary', unlock: { kind: 'season', rankAtMost: 8 } },
  { id: 'apex', name: 'Apex', rarity: 'mythic', unlock: { kind: 'season', rankAtMost: 1 } },
];

/** Five caught of a type, or every species of that type when it has fewer. */
function typeNeed(type: TypeName): number {
  let n = 0;
  for (const sp of SPECIES) if (sp.types.includes(type)) n++;
  return Math.max(1, Math.min(5, n));
}

const TYPE_BACKDROP_NAMES: Readonly<Record<TypeName, string>> = {
  Normal: 'Open Plains',
  Fire: 'Inferno',
  Water: 'Deep Tide',
  Grass: 'Overgrowth',
  Electric: 'Live Wire',
  Ice: 'Whiteout',
  Fighting: 'Dojo',
  Poison: 'Miasma',
  Ground: 'Badlands',
  Flying: 'Jetstream',
  Psychic: 'Mindscape',
  Bug: 'Hive',
  Rock: 'Monolith',
  Ghost: 'Haunt',
  Dragon: 'Dragonfire',
  Steel: 'Forge',
  Fairy: 'Glimmer',
  Dark: 'Nightfall',
  Cosmic: 'Event Horizon',
};

export const BANNER_BACKDROPS: readonly BannerBackdropDef[] = [
  { id: 'midnight', name: 'Midnight', rarity: 'common', type: null, unlock: free },
  { id: 'stadium', name: 'Stadium Lights', rarity: 'common', type: null, unlock: free },
  ...TYPE_NAMES.map(
    (t): BannerBackdropDef => ({ id: `type_${t.toLowerCase()}`, name: TYPE_BACKDROP_NAMES[t], rarity: 'rare', type: t, unlock: { kind: 'type', type: t, atLeast: typeNeed(t) } }),
  ),
  { id: 'aurora', name: 'Aurora', rarity: 'epic', type: null, unlock: count('legendaries', 3) },
  { id: 'eclipse', name: 'Eclipse', rarity: 'legendary', type: null, unlock: { kind: 'champion' } },
  { id: 'throne', name: 'Throne Room', rarity: 'mythic', type: null, unlock: { kind: 'season', rankAtMost: 1 } },
];

export const BANNER_PINS: readonly BannerPinDef[] = [
  { id: 'gym_conqueror', name: 'Gym Conqueror', blurb: 'Gym badges won', tiers: [count('badges', 2), count('badges', 4), count('badges', 6), count('badges', 8)] },
  { id: 'collector', name: 'Collector', blurb: 'Species caught', tiers: [count('dexCaught', 25), count('dexCaught', 60), count('dexCaught', 100), count('dexCaught', 150)] },
  { id: 'duelist', name: 'Duelist', blurb: 'Player battles won', tiers: [count('pvpWins', 5), count('pvpWins', 25), count('pvpWins', 100), count('pvpWins', 250)] },
  { id: 'ranked', name: 'Ranked', blurb: 'Peak ranked rating', tiers: [count('peakRating', 1100), count('peakRating', 1250), count('peakRating', 1400), count('peakRating', 1600), count('peakRating', 1800)] },
  { id: 'spire_climber', name: 'Spire Climber', blurb: 'Battle tower streak', tiers: [count('towerBest', 7), count('towerBest', 21), count('towerBest', 49), count('towerBest', 100)] },
  { id: 'shiny_hunter', name: 'Shiny Hunter', blurb: 'Shinies owned', tiers: [count('shinies', 1), count('shinies', 3), count('shinies', 10), count('shinies', 25)] },
  { id: 'legend_seeker', name: 'Legend Seeker', blurb: 'Legendaries and mythicals caught', tiers: [count('legendaries', 1), count('legendaries', 3), count('legendaries', 6), count('legendaries', 10)] },
  { id: 'veteran', name: 'Veteran', blurb: 'Trainer level', tiers: [count('trainerLevel', 10), count('trainerLevel', 25), count('trainerLevel', 50), count('trainerLevel', 75), count('trainerLevel', 100)] },
  { id: 'achiever', name: 'Achiever', blurb: 'Achievements claimed', tiers: [count('achievements', 5), count('achievements', 10), count('achievements', 20), count('achievements', 30)] },
  { id: 'champion', name: 'Champion', blurb: 'Beat the Champion', tiers: [{ kind: 'champion' }] },
  { id: 'season_finalist', name: 'Season Finalist', blurb: 'Top eight of a ranked season', tiers: [{ kind: 'season', rankAtMost: 8 }] },
  { id: 'season_champion', name: 'Season Champion', blurb: 'First in a ranked season', tiers: [{ kind: 'season', rankAtMost: 1 }] },
];

export const BANNER_TRACKERS: readonly BannerTrackerDef[] = [
  { id: 'rating', label: 'Rating' },
  { id: 'peakRating', label: 'Peak rating' },
  { id: 'dexCaught', label: 'Dex caught' },
  { id: 'badges', label: 'Badges' },
  { id: 'trainerLevel', label: 'Trainer level' },
  { id: 'pvpWins', label: 'PvP wins' },
  { id: 'towerBest', label: 'Tower best' },
  { id: 'shinies', label: 'Shinies' },
  { id: 'legendaries', label: 'Legendaries' },
  { id: 'achievements', label: 'Achievements' },
];

export const DEFAULT_BANNER: BannerChoice = { frame: 'standard', backdrop: 'midnight', pins: [], trackers: ['rating', 'dexCaught', 'badges'], featuredId: null };

export function bannerFrame(id: string): BannerFrameDef | undefined {
  return BANNER_FRAMES.find((f) => f.id === id);
}

export function bannerBackdrop(id: string): BannerBackdropDef | undefined {
  return BANNER_BACKDROPS.find((b) => b.id === id);
}

export function bannerPin(id: string): BannerPinDef | undefined {
  return BANNER_PINS.find((p) => p.id === id);
}

export function bannerTracker(id: string): BannerTrackerDef | undefined {
  return BANNER_TRACKERS.find((t) => t.id === id);
}

export function bannerUnlocked(u: BannerUnlock, s: BannerStats): boolean {
  switch (u.kind) {
    case 'free':
      return true;
    case 'count':
      return s[u.stat] >= u.atLeast;
    case 'champion':
      return s.champion;
    case 'season':
      return s.seasonBest > 0 && s.seasonBest <= u.rankAtMost;
    case 'type':
      return (s.typeCaught[u.type] ?? 0) >= u.atLeast;
  }
}

/** How far the trainer is toward an unlock, 0..1 (1 = unlocked); a yes/no unlock is 0 or 1. */
export function bannerProgress(u: BannerUnlock, s: BannerStats): number {
  switch (u.kind) {
    case 'count':
      return Math.min(1, s[u.stat] / u.atLeast);
    case 'type':
      return Math.min(1, (s.typeCaught[u.type] ?? 0) / u.atLeast);
    default:
      return bannerUnlocked(u, s) ? 1 : 0;
  }
}

const COUNT_HINT: Readonly<Record<BannerCount, (n: number) => string>> = {
  badges: (n) => `Win ${n} gym badges`,
  dexCaught: (n) => `Catch ${n} species`,
  trainerLevel: (n) => `Reach trainer level ${n}`,
  rating: (n) => `Hold a rating of ${n}`,
  peakRating: (n) => `Reach a ranked rating of ${n}`,
  towerBest: (n) => `Win ${n} in a row in the battle tower`,
  shinies: (n) => (n === 1 ? 'Own a shiny' : `Own ${n} shinies`),
  legendaries: (n) => (n === 1 ? 'Catch a legendary or mythical' : `Catch ${n} legendaries or mythicals`),
  pvpWins: (n) => `Win ${n} player battles`,
  achievements: (n) => `Claim ${n} achievements`,
};

export function bannerUnlockHint(u: BannerUnlock): string {
  switch (u.kind) {
    case 'free':
      return 'Yours from the start';
    case 'count':
      return COUNT_HINT[u.stat](u.atLeast);
    case 'champion':
      return 'Beat the Champion';
    case 'season':
      return u.rankAtMost === 1 ? 'Finish first in a ranked season' : `Finish in the top ${u.rankAtMost} of a ranked season`;
    case 'type':
      return `Catch ${u.atLeast} ${u.type}-type species`;
  }
}

export function pinTier(pin: BannerPinDef, s: BannerStats): number {
  let t = 0;
  for (const u of pin.tiers) {
    if (!bannerUnlocked(u, s)) break;
    t++;
  }
  return t;
}

/** Why a save is refused (null = it may be saved). The featured creature's ownership is the server's to check. */
export function bannerRefusal(c: BannerChoice, s: BannerStats): string | null {
  const frame = bannerFrame(c.frame);
  if (frame === undefined) return 'unknownFrame';
  if (!bannerUnlocked(frame.unlock, s)) return 'frameLocked';
  const backdrop = bannerBackdrop(c.backdrop);
  if (backdrop === undefined) return 'unknownBackdrop';
  if (!bannerUnlocked(backdrop.unlock, s)) return 'backdropLocked';
  if (c.pins.length > BANNER_PIN_SLOTS || new Set(c.pins).size !== c.pins.length) return 'pins';
  for (const id of c.pins) {
    const pin = bannerPin(id);
    if (pin === undefined) return 'unknownPin';
    if (pinTier(pin, s) === 0) return 'pinLocked';
  }
  if (c.trackers.length > BANNER_TRACKER_SLOTS || new Set(c.trackers).size !== c.trackers.length) return 'trackers';
  for (const id of c.trackers) if (bannerTracker(id) === undefined) return 'unknownTracker';
  return null;
}

/**
 * The choice as it may be shown today: anything no longer unlocked (a traded-away shiny takes Prismatic with it) falls
 * back to the default frame / backdrop, and a pin no longer earned drops out.
 */
export function bannerShown(c: BannerChoice, s: BannerStats): BannerChoice {
  const frame = bannerFrame(c.frame);
  const backdrop = bannerBackdrop(c.backdrop);
  return {
    frame: frame !== undefined && bannerUnlocked(frame.unlock, s) ? frame.id : DEFAULT_BANNER.frame,
    backdrop: backdrop !== undefined && bannerUnlocked(backdrop.unlock, s) ? backdrop.id : DEFAULT_BANNER.backdrop,
    pins: c.pins.filter((id) => {
      const pin = bannerPin(id);
      return pin !== undefined && pinTier(pin, s) > 0;
    }),
    trackers: c.trackers.filter((id) => bannerTracker(id) !== undefined),
    featuredId: c.featuredId,
  };
}
