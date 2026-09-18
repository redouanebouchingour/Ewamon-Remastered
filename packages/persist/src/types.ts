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
  readonly caughtAt: { readonly zoneId: string; readonly at: number } | null;
  readonly ribbons: readonly string[];
  readonly favorite: boolean;
  readonly locked: boolean;
}

// ---- §2.1 Rng ------------------------------------------------------------------------------

export type RngState = readonly [number, number, number, number];

// ---- §2.10 Action --------------------------------------------------------------------------

export type Action =
  | { readonly kind: 'move'; readonly move: string }
  | { readonly kind: 'switch'; readonly to: number }
  | { readonly kind: 'item'; readonly item: string; readonly target?: number }
  | { readonly kind: 'catch'; readonly orb: string }
  | { readonly kind: 'flee' }
  | { readonly kind: 'forfeit' };

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

export type SlotKind = 'party' | 'box' | 'listing' | 'trade_escrow';
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

export interface TradedCreatureSummary {
  readonly id: string;
  readonly speciesId: string;
  readonly level: number;
}
