/**
 * Structural copies of @ewa/core / @ewa/content types that persist needs to round-trip.
 *
 * TODO(core): re-point every alias below at `import type { … } from '@ewa/core'` once core exports
 * them (another workflow is implementing core right now; persist must not block on it). The shapes
 * are copied verbatim from `.design/spec/00-spine.md` §2.1, §2.8, §2.10, §3.1, §4.4 so the switch is
 * a pure re-export with no behavioural change.
 */

// ---- §2.8 CreatureInstance ----------------------------------------------------------------

export type VariantKey = 'normal' | 'dawn' | 'dusk' | 'verdant' | 'ember';
export const VARIANT_KEYS: readonly VariantKey[] = ['normal', 'dawn', 'dusk', 'verdant', 'ember'];

export type MajorStatus = 'burn' | 'poison' | 'paralyze' | 'sleep' | 'freeze';
export type StatusId = MajorStatus | 'confuse';

export interface MoveSlot {
  readonly id: string;
  readonly pp: number;
  readonly ppMax: number;
}

export interface CreatureInstance {
  readonly id: string;
  readonly ownerId: string | null;
  readonly speciesId: string;
  readonly nickname: string | null;
  readonly level: number;
  readonly exp: number;
  readonly hp: number;
  readonly moves: readonly MoveSlot[];
  readonly status: readonly StatusId[];
  readonly ability: string;
  readonly heldItem: string | null;
  readonly variantKey: VariantKey;
  readonly isAlpha: boolean;
  /** Phase D4: present (true) only on a shiny; absent = not shiny */
  readonly isShiny?: boolean;
  readonly caughtAt: { readonly zoneId: string; readonly at: number } | null;
  /** the honor ledger (core honor.ts); absent = 0 */
  readonly honor?: number;
  /** breeding: hatched from a Majin-form and a Tenjin-form parent; absent = not bandborn */
  readonly bandborn?: true;
  readonly ribbons: readonly string[];
  readonly favorite: boolean;
  readonly locked: boolean;
}

// ---- §2.1 Rng ------------------------------------------------------------------------------

export type RngState = readonly [number, number, number, number];

// ---- §2.10 Action --------------------------------------------------------------------------

export type Action =
  // Phase D6: `target` = a doubles field position (absent in singles)
  | { readonly kind: 'move'; readonly move: string; readonly target?: { readonly side: 0 | 1; readonly pos: 0 | 1 } }
  | { readonly kind: 'switch'; readonly to: number }
  | { readonly kind: 'item'; readonly item: string; readonly target?: number }
  | { readonly kind: 'catch'; readonly orb: string }
  | { readonly kind: 'flee' }
  | { readonly kind: 'forfeit' };

/** Phase D6: one side's entry in a replay's action log — singles: an Action / null; doubles: one per field position. */
export type ReplayChoice = Action | null | readonly [Action | null, Action | null];

// ---- §3.1 content ids -----------------------------------------------------------------------

export type ZoneId =
  | 'mirevale'
  | 'mire_route'
  | 'cinderhold'
  | 'ash_route'
  | 'saltmourn'
  | 'tide_route'
  | 'stormrook'
  | 'galvan_route'
  | 'marrowdig'
  | 'deepcut_route'
  | 'vesperveil'
  | 'hollow_route'
  | 'forgewall'
  | 'siege_route'
  | 'skyrend'
  | 'ascent_route'
  | 'solenne'
  | 'eclipse_shrine'
  | 'umbral_observatory'
  | 'celestial_spire'
  | 'the_rift';

export type BadgeId = 'bloom' | 'ember' | 'current' | 'circuit' | 'fault' | 'wraith' | 'anvil' | 'ascend';

// ---- §4.4 RewardsSummary ---------------------------------------------------------------------

export interface RewardsSummary {
  readonly money: number;
  readonly items: Readonly<Record<string, number>>;
  readonly trainerExp: number;
  readonly ratingDelta: number | null;
  readonly badge: BadgeId | null;
}

// ---- persist-owned view types -----------------------------------------------------------------

export type SlotKind = 'party' | 'box' | 'listing' | 'trade_escrow' | 'daycare';
export type ListingStatus = 'active' | 'sold' | 'expired' | 'cancelled';
export type FriendshipStatus = 'pending' | 'accepted';
export type GuildRole = 'leader' | 'officer' | 'member';
export type BattleFormat = 'wild' | 'trainer' | 'league' | 'pvp' | 'raid';
export type BattleResult = 'win' | 'loss' | 'draw' | 'fled' | 'caught';

/** §5.3 — built by naming fields, never by deleting them. Key order is asserted in tests. */
export interface PublicProfile {
  readonly id: string;
  readonly username: string;
  readonly title: string;
  readonly motto: string;
  readonly body: string;
  readonly rating: number;
  readonly peakRating: number;
  readonly tier: string;
  readonly trainerLevel: number;
  readonly badges: readonly BadgeId[];
  /** null when the player is in no guild. */
  readonly guildTag: string | null;
  readonly dexCaughtCount: number;
  readonly showcase: readonly CreatureInstance[];
  readonly createdAt: Date;
}

export interface ListingView {
  readonly id: string;
  readonly sellerId: string;
  readonly creatureId: string;
  readonly speciesId: string;
  readonly level: number;
  readonly variantKey: VariantKey;
  readonly isAlpha: boolean;
  /** Phase D4 */
  readonly isShiny: boolean;
  readonly startingBid: number;
  readonly currentBid: number | null;
  readonly currentBidderId: string | null;
  readonly buyNowPrice: number | null;
  readonly status: ListingStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly resolvedAt: Date | null;
}

export interface BidView {
  readonly id: number;
  readonly listingId: string;
  readonly bidderId: string;
  readonly amount: number;
  readonly placedAt: Date;
}

export type MarketSort = 'endingSoon' | 'newest' | 'priceAsc' | 'priceDesc' | 'levelDesc';

export interface MarketQuery {
  /** Species id prefix/substring; goes through escapeLike. */
  readonly search?: string;
  readonly variant?: VariantKey;
  readonly isAlpha?: boolean;
  /** Phase D4 */
  readonly isShiny?: boolean;
  readonly levelMin?: number;
  readonly levelMax?: number;
  readonly sort?: MarketSort;
  /** 1-based. */
  readonly page?: number;
  /** Clamped to 1..50. */
  readonly pageSize?: number;
  /** Listings are shown while active; the caller passes its clock so "active" has one meaning per request. */
  readonly now: Date;
}

export interface FriendView {
  readonly id: string;
  readonly username: string;
  readonly since: Date;
}

export interface MessageView {
  readonly id: number;
  readonly fromId: string;
  readonly toId: string;
  readonly text: string;
  readonly sentAt: Date;
  readonly readAt: Date | null;
}

export interface GuildView {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly leaderId: string;
  readonly motd: string;
  readonly memberCount: number;
  readonly createdAt: Date;
}

export interface GuildMemberView {
  readonly playerId: string;
  readonly username: string;
  readonly role: GuildRole;
  readonly joinedAt: Date;
}

/**
 * battle_history.start — everything `createBattle` needs besides the seed, captured at battle start (server
 * IMPLEMENTATION-NOTES part 2, P6): `zoneId`, `terrain` and both sides exactly as passed to core (projected
 * battlers). Opaque to persist (core's Side shape is the server's business), so a database-only replay is
 * `createBattle({ id: battleId, format, seed, ...start })` + `resolveTurn` over `actions`.
 */
export interface BattleStartSnapshot {
  readonly zoneId: string;
  readonly terrain: string;
  readonly sides: readonly [unknown, unknown];
  /** Phase D7: the ambient zone weather passed to createBattle; absent = none */
  readonly weather?: string;
  /** Phase D6: 2 for a doubles battle (createBattle `slots`); absent = singles */
  readonly slots?: 2;
  /** Phase D14: true for a battle tower fight (createBattle `noExp`); absent otherwise */
  readonly noExp?: true;
  /** Arena PvP: the arena battle's kind (protocol ArenaKind — 'standard' | 'level50' | 'ranked' | 'cup' | 'friend' | 'training'); absent otherwise */
  readonly arena?: string;
}

/**
 * battle_shares.replay: a battle_history row made public (migration 0006). Ids are anonymised (`r:<side>` trainers of
 * player sides, `r:<side>:<i>` creatures, owners null), which core never reads, so `start` + `seed` + `actions`
 * replay to `finalDigest` (the anonymised state's digest). `labels`: a player side's username, an NPC side's content
 * trainer id, null for a wild side. Opaque to persist like BattleStartSnapshot.
 */
export interface SharedReplay {
  readonly format: BattleFormat;
  /** the sharer's side */
  readonly seat: 0 | 1;
  readonly labels: readonly [string | null, string | null];
  /** the sharer's result */
  readonly result: BattleResult;
  readonly turns: number;
  /** ISO time the battle ended */
  readonly happenedAt: string;
  readonly seed: RngState;
  readonly start: BattleStartSnapshot;
  readonly actions: readonly (readonly [ReplayChoice, ReplayChoice])[];
  readonly finalDigest: string;
}

/**
 * Creature history (migration 0007, `creature_events`): one event's kind and fields. Names are stored as they were.
 * `met`: how the first owner got it (`caught` in `zoneId`, or `received`: a starter or a gift); `traded` / `sold` /
 * `gift`: an ownership change (`sold` = the marketplace); `evolved`; `badge`: in the party that won it; `champion`: in
 * the party that beat the Champion; `legendary`: in the party that caught or defeated a legendary; `hatched`: how a
 * hatchling's first owner got it (in place of `met`); `nemesis`: it ended a nemesis, or was one.
 */
export type CreatureEventDetail =
  | { readonly kind: 'met'; readonly how: 'caught' | 'received'; readonly speciesId: string; readonly level: number; readonly zoneId: string | null; readonly trainer: string }
  | { readonly kind: 'traded' | 'sold' | 'gift'; readonly from: string; readonly to: string }
  | { readonly kind: 'evolved'; readonly from: string; readonly into: string }
  | { readonly kind: 'badge'; readonly badge: string }
  | { readonly kind: 'champion' }
  | { readonly kind: 'legendary'; readonly species: string; readonly caught: boolean }
  /** breeding: hatched from an egg laid at the Daycare in `zoneId`; `parents` are the parents' names as they were */
  | { readonly kind: 'hatched'; readonly speciesId: string; readonly zoneId: string; readonly parents: readonly [string, string]; readonly trainer: string }
  /**
   * nemeses: `beaten`: this creature landed the blow that ended the nemesis `name` (its full name as it was);
   * `caught`: this creature was that nemesis, caught at `rank`
   */
  | { readonly kind: 'nemesis'; readonly how: 'beaten' | 'caught'; readonly name: string; readonly speciesId: string; readonly rank: number; readonly zoneId: string };

export type CreatureEventKind = CreatureEventDetail['kind'];

export interface CreatureEvent {
  readonly detail: CreatureEventDetail;
  readonly at: Date;
}

export interface CreatureHistory {
  /** null for a creature that predates the history */
  readonly originalTrainer: string | null;
  readonly events: readonly CreatureEvent[];
}

/** Weather from real life (migration 0010, `players.weather_city`): a place the player picked, rounded to 0.1°. */
export interface WeatherCity {
  readonly name: string;
  /** the province or state, when the geocoder names one (tells same-named places apart) */
  readonly region?: string;
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
}

export interface TradedCreatureSummary {
  readonly id: string;
  readonly speciesId: string;
  readonly level: number;
}
