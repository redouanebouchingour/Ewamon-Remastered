/**
 * §4.7 REST — request/response schemas + types for every route, and the typed route table both the
 * Fastify server and the client's `apiFetch` import. Fastify 5, bearer = `@fastify/jwt` access
 * token (15 min); `admin` = bearer + `is_admin`.
 *
 * Wire conventions: timestamps are ISO-8601 strings (persist's `Date` columns serialise through
 * JSON); ids are uuids; 204 responses have `response: null`.
 */
import { z } from 'zod';
import { BADGE_IDS, MYTHICAL_CHOICES, STARTERS, ZONE_IDS } from './types';
import {
  BadgeIdSchema,
  BattleFormatSchema,
  BattleOutcomeSchema,
  CreatureInstanceSchema,
  ItemCounts,
  RewardsSummarySchema,
  RngStateSchema,
  Uuid,
  VariantKeySchema,
} from './messages/common';
import { InventoryDeltaMsg, NEMESIS_SCAR_IDS, QuestProgressEntrySchema } from './messages/server';
import { SeatReservationSchema } from './messages/common';
import {
  ArenaInfoRes,
  ArenaKindSchema,
  ArenaInviteReplyReq,
  ArenaInviteReplyRes,
  ArenaInviteReq,
  ArenaInviteRes,
  ArenaModeSchema,
  ArenaQueueReq,
  ArenaSeatRes,
  ArenaStatusBody,
  ArenaTrainingReq,
  DailyRes,
} from './arena';

// ---- primitives ----------------------------------------------------------------------------------------

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const GUILD_TAG_RE = /^[A-Z0-9]{3,4}$/;

export const Username = z.string().regex(USERNAME_RE);
export const Password = z.string().min(8).max(128);
export const Email = z.email().max(254);
export const ZoneIdSchema = z.enum(ZONE_IDS);
export const IsoDate = z.iso.datetime({ offset: true });
export const Money = z.number().int().min(0);
export const Qty = z.number().int().min(1).max(99);
export const ItemId = z.string().min(1).max(40);
export const Page = z.coerce.number().int().min(1).default(1);
export const PageSize = z.coerce.number().int().min(1).max(50).default(20);
const StringList = z.array(z.string());
const Nothing = z.object({}).optional();

// ---- shared views ----------------------------------------------------------------------------------------

/**
 * TODO(spec): `PlayerProfile` is named by §4.7 (`/auth/*`, `GET /me`, `POST /profile`) but no
 * section lists its fields; this is the self-view of the `players` row (§5.1) minus secrets.
 */
export const PlayerProfileSchema = z.object({
  id: Uuid,
  username: Username,
  email: Email,
  title: z.string().max(40),
  motto: z.string().max(120),
  body: z.string().min(1).max(32),
  money: Money,
  rating: z.number().int(),
  peakRating: z.number().int(),
  rankedMatches: z.number().int().min(0),
  tier: z.string(),
  trainerExp: z.number().int().min(0),
  trainerLevel: z.number().int().min(1).max(100),
  isAdmin: z.boolean(),
  zoneId: ZoneIdSchema,
  createdAt: IsoDate,
  /** Phase C6: `players.email_verified_at` is set. Absent (older server) = unknown; verification never gates play. */
  emailVerified: z.boolean().optional(),
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

/** §5.3 allow-list, in PUBLIC_PROFILE_KEYS order. */
export const PublicProfileSchema = z.object({
  id: Uuid,
  username: Username,
  title: z.string(),
  motto: z.string(),
  body: z.string(),
  rating: z.number().int(),
  peakRating: z.number().int(),
  tier: z.string(),
  trainerLevel: z.number().int().min(1),
  badges: z.array(BadgeIdSchema),
  guildTag: z.string().regex(GUILD_TAG_RE).nullable(),
  dexCaughtCount: z.number().int().min(0),
  showcase: z.array(CreatureInstanceSchema).max(3),
  createdAt: IsoDate,
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

export const LISTING_STATUSES = ['active', 'sold', 'expired', 'cancelled'] as const;
export const MARKET_SORTS = ['endingSoon', 'newest', 'priceAsc', 'priceDesc', 'levelDesc'] as const;
export const ListingViewSchema = z.object({
  id: Uuid,
  sellerId: Uuid,
  creatureId: Uuid,
  speciesId: z.string(),
  level: z.number().int().min(1).max(100),
  variantKey: VariantKeySchema,
  isAlpha: z.boolean(),
  /** Phase D4 */
  isShiny: z.boolean().optional(),
  startingBid: Money,
  currentBid: Money.nullable(),
  currentBidderId: Uuid.nullable(),
  buyNowPrice: Money.nullable(),
  status: z.enum(LISTING_STATUSES),
  createdAt: IsoDate,
  expiresAt: IsoDate,
  resolvedAt: IsoDate.nullable(),
});
export type ListingView = z.infer<typeof ListingViewSchema>;
export const BidViewSchema = z.object({ id: z.number().int(), listingId: Uuid, bidderId: Uuid, amount: Money, placedAt: IsoDate });
export type BidView = z.infer<typeof BidViewSchema>;

/** 30-server-netcode.md §30.7.1 — online/zoneId/inBattle come from PresenceStore, never the DB. */
export const FriendViewSchema = z.object({
  id: Uuid,
  username: Username,
  title: z.string(),
  body: z.string(),
  online: z.boolean(),
  zoneId: ZoneIdSchema.nullable(),
  inBattle: z.boolean(),
  lastSeenAt: IsoDate,
});
export type FriendView = z.infer<typeof FriendViewSchema>;
export const FriendListsSchema = z.object({
  friends: z.array(FriendViewSchema),
  incoming: z.array(FriendViewSchema),
  outgoing: z.array(FriendViewSchema),
});

export const MessageViewSchema = z.object({
  id: z.number().int(),
  fromId: Uuid,
  toId: Uuid,
  text: z.string().min(1).max(300),
  sentAt: IsoDate,
  readAt: IsoDate.nullable(),
});
export type MessageView = z.infer<typeof MessageViewSchema>;

export const GUILD_ROLES = ['leader', 'officer', 'member'] as const;
export const GuildViewSchema = z.object({
  id: Uuid,
  name: z.string().min(3).max(24),
  tag: z.string().regex(GUILD_TAG_RE),
  leaderId: Uuid,
  motd: z.string().max(200),
  memberCount: z.number().int().min(0).max(50),
  createdAt: IsoDate,
});
export type GuildView = z.infer<typeof GuildViewSchema>;
export const GuildMemberViewSchema = z.object({ playerId: Uuid, username: Username, role: z.enum(GUILD_ROLES), joinedAt: IsoDate });
export type GuildMemberView = z.infer<typeof GuildMemberViewSchema>;

/** Phase D14 adds `towerStreak` (best battle tower streak; only players with one); the daily challenge adds `daily` (today's best wins, fewest turns first); challenge modes add `nuzlocke` / `hardcore` (cleared runs first, then going, then failed, by badges); verified speedruns add `speedrun` (the Champion's split on the play clock, fastest first). */
export const LEADERBOARD_MODES = ['rating', 'dex', 'trainerLevel', 'towerStreak', 'daily', 'nuzlocke', 'hardcore', 'speedrun'] as const;
/** TODO(spec): `LeaderboardRow` has no field list in the spec; these are the columns §30.6.3 sorts on plus the showcase-card fields. */
export const LeaderboardRowSchema = z.object({
  rank: z.number().int().min(1),
  id: Uuid,
  username: Username,
  title: z.string(),
  body: z.string(),
  rating: z.number().int(),
  tier: z.string(),
  trainerLevel: z.number().int().min(1),
  dexCaughtCount: z.number().int().min(0),
  guildTag: z.string().nullable(),
  /** Phase D14: battle tower streak — best ever and the run in progress (0 / 0 for a player who never ran it) */
  towerBest: z.number().int().min(0).optional(),
  towerCurrent: z.number().int().min(0).optional(),
  /** verified speedruns (`mode=speedrun`): the play-clock time at the Champion split */
  speedrunMs: z.number().int().min(0).optional(),
  /** challenge modes (`mode=nuzlocke|hardcore`): the run's badges and where it stands */
  challengeBadges: z.number().int().min(0).optional(),
  challengeState: z.enum(['active', 'cleared', 'failed']).optional(),
  /** the daily challenge (`mode=daily`): today's best win in turns and its per-turn marks */
  dailyTurns: z.number().int().min(1).optional(),
  dailyMarks: z.string().max(200).optional(),
});
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;

export const BATTLE_RESULTS = ['win', 'loss', 'draw', 'fled', 'caught'] as const;
export const BattleHistoryRowSchema = z.object({
  id: z.number().int(),
  battleId: Uuid,
  opponent: z.string().max(64),
  format: BattleFormatSchema,
  result: z.enum(BATTLE_RESULTS),
  turns: z.number().int().min(0),
  ratingDelta: z.number().int().nullable(),
  rewards: RewardsSummarySchema,
  happenedAt: IsoDate,
  /** arena PvP: the kind of arena battle (from the start snapshot); absent / null for every other battle */
  arena: ArenaKindSchema.nullable().optional(),
});
export type BattleHistoryRow = z.infer<typeof BattleHistoryRowSchema>;
const TradedCreature = z.object({ id: Uuid, speciesId: z.string(), level: z.number().int().min(1).max(100) });
export const TradeHistoryRowSchema = z.object({
  id: z.number().int(),
  tradeId: Uuid,
  partnerId: Uuid,
  /** Phase C4 (client history screen): the partner's current username; null once that account is gone */
  partnerUsername: Username.nullable().optional(),
  sent: z.array(TradedCreature),
  received: z.array(TradedCreature),
  moneySent: Money,
  moneyReceived: Money,
  completedAt: IsoDate,
});
export type TradeHistoryRow = z.infer<typeof TradeHistoryRowSchema>;

export const BattlePassRewardSchema = z.object({
  level: z.number().int().min(1).max(100),
  label: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary', 'mythical', 'epic']),
  money: Money,
  items: ItemCounts,
  creature: z.object({ species: z.string(), level: z.number().int().min(1).max(100) }).nullable(),
  mythicalChoice: z.array(z.string()).nullable(),
});
export const BattlePassStateSchema = z.object({
  trainerExp: z.number().int().min(0),
  trainerLevel: z.number().int().min(1).max(100),
  claimed: z.array(z.number().int().min(1).max(100)),
  mythicalChoice: z.string().nullable(),
  rewards: z.array(BattlePassRewardSchema),
});
export type BattlePassState = z.infer<typeof BattlePassStateSchema>;

/** See types.ts `LiveOpsSummary` (TODO(spec)); loose so the server may grow it. */
export const LiveOpsSummarySchema = z.looseObject({
  dayKey: z.string(),
  weekKey: z.string(),
  weekdayVariant: VariantKeySchema.nullable(),
  loginStreak: z.number().int().min(0),
});

/** A quest as `GET /me` lists it: the definition id + the player's progress rows + claim state. */
export const QuestViewSchema = z.looseObject({
  id: z.string().min(1),
  progress: z.array(QuestProgressEntrySchema),
  claimed: z.boolean(),
});
export type QuestView = z.infer<typeof QuestViewSchema>;

/**
 * An `inventoryDelta`-shaped body (§4.4 `inventoryDelta` minus `type`: absolute item counts, absolute money or
 * null, creatures added / removed / updated). REST routes whose side effect moves items, money or creatures
 * return it next to their view so the client applies it through its one inventory writer instead of going
 * stale until the next `GET /me` (server IMPLEMENTATION-NOTES part 2, P1).
 */
export const InventoryDeltaBodySchema = InventoryDeltaMsg.omit({ type: true });
export type InventoryDeltaBody = z.infer<typeof InventoryDeltaBodySchema>;

// ---- error envelope ------------------------------------------------------------------------------------------

/** Domain errors (persist §5.5) map to 409 `{ code }`; `RateLimited` → 429; zod → 400 `invalidPayload`; JWT → 401; else 500 `internal`. */
export const RestErrorSchema = z.object({
  code: z.string().min(1),
  detail: z.string().nullable().optional(),
  /** `POST /zone/enter` 403 `gated` names the missing badge */
  badge: z.enum(BADGE_IDS).optional(),
});
export type RestError = z.infer<typeof RestErrorSchema>;

// ---- auth --------------------------------------------------------------------------------------------------------

/** Challenge modes (content challenge.ts): a run chosen at registration (absent = a normal game). */
export const CHALLENGE_MODE_IDS = ['nuzlocke', 'hardcore'] as const;
export const RegisterReq = z.object({ username: Username, email: Email, password: Password, starter: z.enum(STARTERS), challenge: z.enum(CHALLENGE_MODE_IDS).optional() });
export const LoginReq = z.object({ username: z.string().min(1).max(20), password: z.string().min(1).max(128) });
export const RefreshReq = z.object({ refresh: z.string().min(1) });
export const LogoutReq = RefreshReq;
export const AuthRes = z.object({ access: z.string().min(1), refresh: z.string().min(1), player: PlayerProfileSchema });
export const RefreshRes = z.object({ access: z.string().min(1), refresh: z.string().min(1) });
/** Phase C6 — the opaque single-use token from an emailed link (32 random bytes, base64url). */
export const EmailToken = z.string().min(16).max(128);
/** Phase C6 `POST /auth/forgot` — always 204 (no account enumeration). */
export const ForgotReq = z.object({ email: Email });
/** Phase C6 `POST /auth/reset` — 204; every refresh token of the account is revoked. */
export const ResetReq = z.object({ token: EmailToken, password: Password });
/** Phase C6 `POST /auth/verify` — 204; idempotent for an already-verified account only through a fresh token. */
export const VerifyReq = z.object({ token: EmailToken });
/** Phase C6: 400 body of `/auth/reset` and `/auth/verify` for a token that is unknown, expired or already used. */
export const BadTokenErr = z.object({ code: z.literal('badToken'), reason: z.enum(['unknown', 'expired', 'used']) });

// ---- me / zone / profile / quests --------------------------------------------------------------------------------

export const MeRes = PlayerProfileSchema.extend({
  party: z.array(CreatureInstanceSchema).min(1).max(6),
  box: z.array(CreatureInstanceSchema),
  inventory: ItemCounts,
  badges: z.array(BadgeIdSchema),
  flags: StringList,
  quests: z.array(QuestViewSchema),
  battlePass: BattlePassStateSchema,
  presence: z.object({ roomId: z.string().nullable(), zoneId: ZoneIdSchema, shard: z.number().int().min(0) }),
  unreadDm: z.record(z.string(), z.number().int().min(0)),
  friendRequests: z.number().int().min(0),
  liveOps: LiveOpsSummarySchema,
});
export type MeResponse = z.infer<typeof MeRes>;

export const ZoneEnterReq = z.object({ zoneId: ZoneIdSchema });
export const ZoneEnterRes = z.object({ seat: SeatReservationSchema });
/** 403 body when the zone's `gate` badge is missing. */
export const ZoneGatedErr = z.object({ code: z.literal('gated'), badge: BadgeIdSchema });

/**
 * Base shape only: `title ∈ TITLES` and `body ∈ BODIES` are content lists (§3.12) that protocol
 * may not import as values — the server refines with `profileRequestFor(TITLES, BODIES)`.
 */
export const ProfileReq = z.object({
  title: z.string().min(1).max(40).optional(),
  motto: z.string().max(120).optional(),
  body: z.string().min(1).max(32).optional(),
});
export type ProfileRequest = z.infer<typeof ProfileReq>;
export function profileRequestFor(titles: readonly string[], bodies: readonly string[]) {
  return ProfileReq.superRefine((v, ctx) => {
    if (v.title !== undefined && !titles.includes(v.title)) ctx.addIssue({ code: 'custom', path: ['title'], message: 'title not in TITLES' });
    if (v.body !== undefined && !bodies.includes(v.body)) ctx.addIssue({ code: 'custom', path: ['body'], message: 'body not in BODIES' });
  });
}

/** daily/weekly ids `daily:<dayKey>` / `weekly:<weekKey>` use `objectiveId` (the mission id). */
export const QuestClaimReq = z.object({ questId: z.string().min(1).max(64), objectiveId: z.string().min(1).max(64).optional() });
export const QuestClaimRes = z.object({
  inventory: ItemCounts,
  money: Money,
  creaturesAdded: z.array(CreatureInstanceSchema),
  questProgress: z.array(QuestProgressEntrySchema),
});

// ---- party / creature / items ----------------------------------------------------------------------------------

const Party = z.array(CreatureInstanceSchema).min(1).max(6);
const Box = z.array(CreatureInstanceSchema);
export const PartyRes = z.object({ party: Party });
export const PartyBoxRes = z.object({ party: Party, box: Box });

export const PartyReorderReq = z.object({
  order: z
    .array(Uuid)
    .min(1)
    .max(6)
    .refine((ids) => new Set(ids).size === ids.length, 'duplicate creature id'),
});
export const PartySwapReq = z.object({ partyId: Uuid, boxId: Uuid });
export const CreatureIdReq = z.object({ id: Uuid });
export const CreatureParams = z.object({ id: Uuid });

export const NicknameReq = z.object({ nickname: z.string().min(1).max(16).nullable() });
export const MovesReq = z.object({
  moves: z
    .array(ItemId)
    .min(1)
    .max(4)
    .refine((m) => new Set(m).size === m.length, 'duplicate move'),
});
export const SetupReq = z.object({ ability: z.string().min(1).max(40), heldItem: ItemId.nullable() });
/** `CreatureInstance` (spine §4.7) + the held-item inventory counts it touched (P1). */
export const CreatureSetupRes = CreatureInstanceSchema.extend({ inventoryDelta: InventoryDeltaBodySchema });
export const EvolveReq = z.object({ into: z.string().min(1).max(40) });
/**
 * Phase D3: the evolved creature, plus — for a stone evolution — the stone count it spent (and the creature in
 * creaturesUpdated). Optional: a level or trade evolution touches no item.
 */
export const CreatureEvolveRes = CreatureInstanceSchema.extend({ inventoryDelta: InventoryDeltaBodySchema.optional() });
/** Phase D2 move tutor: `move` from a tutor NPC in the player's zone; `forget` names the slot it replaces (required when 4 are known). */
export const TutorReq = z.object({ move: ItemId, forget: ItemId.nullable() });
export const CreatureFlagsReq = z.object({ favorite: z.boolean().optional(), locked: z.boolean().optional() });

export const ItemUseReq = z.object({ item: ItemId, target: Uuid.nullable(), qty: Qty });
export const ItemUseRes = z.object({
  inventory: ItemCounts,
  creaturesUpdated: z.array(CreatureInstanceSchema),
  events: z.array(z.looseObject({ t: z.string() })),
});

// ---- dex / shop ----------------------------------------------------------------------------------------------------

export const DexRes = z.object({
  seen: StringList,
  caught: StringList,
  variants: z.record(z.string(), z.array(VariantKeySchema)),
  alpha: StringList,
  /** Phase D4: species of which a shiny was caught */
  shiny: StringList.optional(),
});
export const ShopParams = z.object({ zoneId: ZoneIdSchema });
export const ShopRes = z.object({ stock: StringList, prices: z.record(z.string(), Money) });
export const ShopTradeReq = z.object({ item: ItemId, qty: Qty });
export const InventoryMoneyRes = z.object({ inventory: ItemCounts, money: Money });

// ---- marketplace -----------------------------------------------------------------------------------------------------

const QueryBool = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
export const MarketQuery = z.object({
  search: z.string().max(40).optional(),
  variant: VariantKeySchema.optional(),
  isAlpha: QueryBool.optional(),
  /** Phase D4 */
  isShiny: QueryBool.optional(),
  levelMin: z.coerce.number().int().min(1).max(100).optional(),
  levelMax: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(MARKET_SORTS).default('endingSoon'),
  page: Page,
  pageSize: PageSize,
});
export type MarketQueryParams = z.input<typeof MarketQuery>;
export const MarketSearchRes = z.object({ listings: z.array(ListingViewSchema), total: z.number().int().min(0) });
export const ListingListRes = z.array(ListingViewSchema);
export const ListingDetailRes = ListingViewSchema.extend({ bids: z.array(BidViewSchema) });
export const ListingParams = z.object({ id: Uuid });
export const MARKET_DURATIONS = [12, 24, 48] as const;
export const ListCreateReq = z
  .object({
    creatureId: Uuid,
    startingBid: z.number().int().min(100),
    buyNowPrice: z.number().int().min(1).nullable(),
    durationHours: z.union([z.literal(12), z.literal(24), z.literal(48)]),
  })
  .refine((v) => v.buyNowPrice === null || v.buyNowPrice > v.startingBid, {
    path: ['buyNowPrice'],
    message: 'buyNowPrice must exceed startingBid',
  });
export const BidReq = z.object({ amount: z.number().int().min(1) });
/** `ListingView` (spine §4.7) + the caller's money / creature changes of list, bid, buy-now and cancel (P1). */
export const ListingMutationRes = ListingViewSchema.extend({ inventoryDelta: InventoryDeltaBodySchema });

// ---- friends / messages ------------------------------------------------------------------------------------------

export const UsernameReq = z.object({ username: Username });
export const UsernameParams = z.object({ username: Username });
export const MessagesQuery = z.object({ before: IsoDate.optional(), limit: z.coerce.number().int().min(1).max(50).default(50) });
export const MessagesRes = z.object({ messages: z.array(MessageViewSchema) });
export const SendMessageReq = z.object({ text: z.string().min(1).max(300) });

// ---- guilds -------------------------------------------------------------------------------------------------------------

export const GuildsQuery = z.object({ search: z.string().max(24).optional() });
export const GuildParams = z.object({ id: Uuid });
export const GuildCreateReq = z.object({ name: z.string().min(3).max(24), tag: z.string().regex(GUILD_TAG_RE) });
export const GuildMemberReq = z.object({ playerId: Uuid.optional() });
export const GuildListRes = z.array(GuildViewSchema);
export const GuildDetailRes = GuildViewSchema.extend({ members: z.array(GuildMemberViewSchema) });
/** `GuildView` (spine §4.7) + the founder's money after the 5 000 charge (P1). */
export const GuildCreateRes = GuildViewSchema.extend({ inventoryDelta: InventoryDeltaBodySchema });

// ---- leaderboard / players / battle pass / history ----------------------------------------------------------------

export const LeaderboardQuery = z.object({ mode: z.enum(LEADERBOARD_MODES).default('rating'), page: Page });
export const LeaderboardRes = z.object({ rows: z.array(LeaderboardRowSchema) });

export const BattlePassClaimReq = z.object({ level: z.number().int().min(1).max(100) });
export const BattlePassClaimRes = z.object({
  claimed: z.array(z.number().int()),
  inventory: ItemCounts,
  money: Money,
  creaturesAdded: z.array(CreatureInstanceSchema),
});
export const MythicalChoiceReq = z.object({ species: z.enum(MYTHICAL_CHOICES) });
export const CreaturesAddedRes = z.object({ creaturesAdded: z.array(CreatureInstanceSchema) });

/**
 * Creature history: the original trainer (null for a creature older than the history) and what happened to it, oldest
 * first. Names are as they were at the time. `met` how its first owner got it; `traded` / `sold` (the marketplace) /
 * `gift` a change of hands; `evolved`; `badge` / `champion` / `legendary`: it was in the party that won it; `hatched`
 * (breeding) in place of `met`.
 */
export const CREATURE_EVENT_KINDS = ['met', 'traded', 'sold', 'gift', 'evolved', 'badge', 'champion', 'legendary', 'hatched', 'nemesis', 'bounty'] as const;
const Name = z.string().max(20);
export const CreatureEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('met'), at: IsoDate, how: z.enum(['caught', 'received']), speciesId: z.string().max(32), level: z.number().int().min(1).max(100), zoneId: z.string().max(32).nullable(), trainer: Name }),
  z.object({ kind: z.enum(['traded', 'sold', 'gift']), at: IsoDate, from: Name, to: Name }),
  z.object({ kind: z.literal('evolved'), at: IsoDate, from: z.string().max(32), into: z.string().max(32) }),
  z.object({ kind: z.literal('badge'), at: IsoDate, badge: z.string().max(32) }),
  z.object({ kind: z.literal('champion'), at: IsoDate }),
  z.object({ kind: z.literal('legendary'), at: IsoDate, species: z.string().max(32), caught: z.boolean() }),
  // breeding: how a hatchling's first owner got it (in place of `met`)
  z.object({ kind: z.literal('hatched'), at: IsoDate, speciesId: z.string().max(32), zoneId: z.string().max(32), parents: z.tuple([z.string().max(40), z.string().max(40)]), trainer: Name }),
  // nemeses: `beaten` this creature landed the blow that ended the nemesis `name`; `caught` it was that nemesis
  z.object({ kind: z.literal('nemesis'), at: IsoDate, how: z.enum(['beaten', 'caught']), name: z.string().max(60), speciesId: z.string().max(32), rank: z.number().int().min(1).max(5), zoneId: z.string().max(32) }),
  // the bounty board: this creature led the party that brought in `target` (a ghost trainer or a nemesis) for `reward`
  z.object({ kind: z.literal('bounty'), at: IsoDate, target: z.string().max(64), targetKind: z.enum(['ghost', 'nemesis']), reward: z.number().int().min(0), zoneId: z.string().max(32) }),
]);
export type CreatureEvent = z.infer<typeof CreatureEventSchema>;
export const CreatureHistoryRes = z.object({ originalTrainer: Name.nullable(), events: z.array(CreatureEventSchema).max(200) });
export type CreatureHistory = z.infer<typeof CreatureHistoryRes>;

/**
 * Challenge modes: change the run (`normal` ends it) while the player has no badge and nothing has fallen (409
 * `badges` / `fallen`; `inBattle` in a battle). Every `challenge:` flag is cleared first, so a new run starts fresh.
 */
export const ChallengeReq = z.object({ mode: z.enum(['normal', ...CHALLENGE_MODE_IDS]) });
export const ChallengeRes = z.object({ flags: z.array(z.string().max(64)) });

/**
 * Verified speedruns: the server's play clock (it runs only while a zone or arena room holds the player) and the
 * splits written against it (`beat:<id>`, `badge:<id>`, `champion`). `counted`: the run holds the first beat's split,
 * so it is on the board once it reaches `champion` (`finishMs`).
 */
export const SpeedrunSplitSchema = z.object({ split: z.string().max(48), playMs: z.number().int().min(0), at: IsoDate });
export const SpeedrunRes = z.object({
  username: Username,
  playMs: z.number().int().min(0),
  running: z.boolean(),
  counted: z.boolean(),
  finishMs: z.number().int().min(0).nullable(),
  splits: z.array(SpeedrunSplitSchema).max(200),
});
export type SpeedrunView = z.infer<typeof SpeedrunRes>;

/**
 * Weather from real life: a place (Open-Meteo geocoding, coordinates rounded to 0.1°) the player may pick; the
 * server keeps it on the player and looks its weather up (`realWeather`). `city: null` turns it off.
 */
export const WeatherCitySchema = z.object({
  name: z.string().min(1).max(60),
  /** the province or state, when known (same-named places differ by it) */
  region: z.string().max(60).optional(),
  country: z.string().max(60),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type WeatherCityView = z.infer<typeof WeatherCitySchema>;
export const WeatherKindSchema = z.enum(['none', 'sun', 'rain', 'sand', 'hail']);
export const WeatherCitiesQuery = z.object({ q: z.string().trim().min(2).max(60) });
export const WeatherCitiesRes = z.object({ cities: z.array(WeatherCitySchema).max(5) });
export const WeatherCityReq = z.object({ city: WeatherCitySchema.nullable() });
export const RealWeatherRes = z.object({ city: WeatherCitySchema.nullable(), kind: WeatherKindSchema.nullable() });

export const PageQuery = z.object({ page: Page });
export const BattleHistoryRes = z.object({ rows: z.array(BattleHistoryRowSchema) });
export const TradeHistoryRes = z.object({ rows: z.array(TradeHistoryRowSchema) });

/**
 * Battle replays: a share token (12 url-safe characters) for one of the player's history rows, and the public replay
 * behind it. The replay is anonymised (player sides' trainers `r:<side>`, creatures `r:<side>:<i>`, owners null), so
 * `createBattle({ id: REPLAY_BATTLE_ID, format, seed, ...start })` + `resolveTurn` over `actions` ends on
 * `finalDigest`. `seat` is the sharer's side; `labels` a player side's username, an NPC side's trainer id, null for wild.
 */
export const REPLAY_BATTLE_ID = 'replay';
export const ShareToken = z.string().regex(/^[A-Za-z0-9_-]{8,16}$/);
export const BattleShareParams = z.object({ battleId: Uuid });
export const BattleShareRes = z.object({ token: ShareToken });
export const ReplayParams = z.object({ token: ShareToken });
export const ReplayStartSchema = z.object({
  zoneId: z.string().max(64),
  terrain: z.string().max(32),
  sides: z.tuple([z.unknown(), z.unknown()]),
  weather: z.string().max(16).optional(),
  slots: z.literal(2).optional(),
  noExp: z.literal(true).optional(),
  arena: ArenaKindSchema.optional(),
});
export const ReplayRes = z.object({
  token: ShareToken,
  format: BattleFormatSchema,
  seat: z.union([z.literal(0), z.literal(1)]),
  labels: z.tuple([z.string().max(64).nullable(), z.string().max(64).nullable()]),
  result: z.enum(BATTLE_RESULTS),
  turns: z.number().int().min(0),
  happenedAt: IsoDate,
  seed: RngStateSchema,
  start: ReplayStartSchema,
  actions: z.array(z.tuple([z.unknown(), z.unknown()])).max(2000),
  finalDigest: z.string().regex(/^[0-9a-f]{8}$/),
});
export type ReplayData = z.infer<typeof ReplayRes>;

/**
 * Ranked seasons (content seasons.ts): four weeks each, the last one League Finals week. A row is a place in the
 * standings (`title`: champion for the first, finalist for the top eight). `current.top`: the standings so far;
 * `past`: the latest closed seasons' top eight, newest first.
 */
export const SeasonTitleSchema = z.enum(['champion', 'finalist']);
export const SeasonRowSchema = z.object({
  rank: z.number().int().min(1),
  username: Username,
  rating: z.number().int(),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  title: SeasonTitleSchema.nullable(),
});
export type SeasonRowView = z.infer<typeof SeasonRowSchema>;
export const SeasonInfoSchema = z.object({ season: z.number().int().min(1), startsAt: IsoDate, endsAt: IsoDate, finalsAt: IsoDate });
export const SeasonsRes = z.object({
  current: SeasonInfoSchema.extend({ finals: z.boolean(), top: z.array(SeasonRowSchema).max(8) }),
  past: z.array(SeasonInfoSchema.extend({ top: z.array(SeasonRowSchema).max(8) })).max(6),
});
export type SeasonsView = z.infer<typeof SeasonsRes>;
export const SeasonParams = z.object({ season: z.coerce.number().int().min(1).max(100_000) });
export const SeasonStandingsRes = z.object({ season: z.number().int().min(1), rows: z.array(SeasonRowSchema).max(100) });
export const SeasonTitlesRes = z.object({
  username: Username,
  titles: z.array(z.object({ season: z.number().int().min(1), rank: z.number().int().min(1), title: SeasonTitleSchema })).max(500),
});

/**
 * Spectator mode: the arena's live queued matches (never a friend battle, training or the daily) and one match's feed.
 * The feed is the fight so far as a replay a turn behind the players (side 0 seated, both names as labels, anonymised
 * like a shared replay): `createBattle({ id: REPLAY_BATTLE_ID, format, seed, ...start })` + `resolveTurn` over
 * `actions` ends on `digest`. `outcome` is set once the battle is over (the replay then holds every turn). `finals`:
 * a ranked match in Finals week between two of the season's top eight.
 */
export const LivePlayerSchema = z.object({ name: Username, rating: z.number().int() });
export const LiveMatchSchema = z.object({
  matchId: Uuid,
  kind: ArenaModeSchema,
  finals: z.boolean(),
  players: z.tuple([LivePlayerSchema, LivePlayerSchema]),
  turn: z.number().int().min(0),
  startedAt: IsoDate,
});
export type LiveMatchView = z.infer<typeof LiveMatchSchema>;
export const LiveListRes = z.object({ matches: z.array(LiveMatchSchema).max(50) });
export const LiveParams = z.object({ matchId: Uuid });
export const LiveFeedRes = LiveMatchSchema.extend({
  replay: z.object({
    format: z.literal('pvp'),
    seat: z.literal(0),
    labels: z.tuple([z.string().max(64), z.string().max(64)]),
    seed: RngStateSchema,
    start: ReplayStartSchema,
    actions: z.array(z.tuple([z.unknown(), z.unknown()])).max(2000),
    digest: z.string().regex(/^[0-9a-f]{8}$/),
  }),
  outcome: BattleOutcomeSchema.nullable(),
});
export type LiveFeedView = z.infer<typeof LiveFeedRes>;

/**
 * Honor shapes the world (content worldHonor.ts): the zones a shadow lies over this season, their level 1..4 and the
 * tally behind it. A zone not listed is clear.
 */
export const ZoneShadowSchema = z.object({
  zoneId: z.string().max(32),
  level: z.number().int().min(1).max(4),
  light: z.number().int().min(0),
  shadow: z.number().int().min(0),
});
export type ZoneShadowView = z.infer<typeof ZoneShadowSchema>;
export const WorldShadowRes = z.object({ season: z.number().int(), zones: z.array(ZoneShadowSchema).max(64) });

/**
 * A living ecosystem (content ecosystem.ts): "This week on <zone>". Whether it runs at all (server env ECOSYSTEM; off:
 * every list empty), the ranked season and its week (1..4) and when the week ends, this week's catches and knockouts in
 * the zone and whether that is enough history to judge. Each listed species: its weight this week over the authored
 * one (`factor`), why (`cause`), what it hunts and what hunts it here, this week's catches and knockouts. Surging,
 * scarce, tilted by the zone's honor (shadow: Dark and Ghost; light: rare slots), and this season's migrants in and out.
 */
export const ECO_CAUSES = ['hunted', 'feeding', 'shadow', 'light', 'migrant', 'away'] as const;
export const EcoSpeciesSchema = z.object({
  speciesId: z.string().max(32),
  factor: z.number().min(0).max(8),
  cause: z.enum(ECO_CAUSES).nullable(),
  caught: z.number().int().min(0),
  ko: z.number().int().min(0),
  preyOn: z.array(z.string().max(32)).max(24),
  huntedBy: z.array(z.string().max(32)).max(24),
});
export type EcoSpeciesView = z.infer<typeof EcoSpeciesSchema>;
export const EcoParams = z.object({ zoneId: ZoneIdSchema });
export const EcosystemRes = z.object({
  zoneId: ZoneIdSchema,
  enabled: z.boolean(),
  season: z.number().int(),
  week: z.number().int().min(1).max(4),
  endsAt: IsoDate,
  takes: z.number().int().min(0),
  judged: z.boolean(),
  surging: z.array(EcoSpeciesSchema).max(40),
  scarce: z.array(EcoSpeciesSchema).max(40),
  tilted: z.array(EcoSpeciesSchema).max(40),
  migrantsIn: z.array(z.object({ speciesId: z.string().max(32), from: ZoneIdSchema })).max(8),
  migrantsOut: z.array(z.object({ speciesId: z.string().max(32), to: ZoneIdSchema })).max(8),
  shadow: z.number().int().min(0).max(4),
  light: z.number().int().min(0).max(4),
});
export type EcosystemView = z.infer<typeof EcosystemRes>;

/**
 * The bounty board (content bounties.ts). A poster: the game's own on a ghost that keeps winning, a trainer's escrow on
 * a ghost, or (only its trainer sees it) a nemesis. `target` is the ghost trainer's name or the nemesis's full name;
 * `zoneId` where the ghost haunts now (or the nemesis was last met); `wins` the different trainers the ghost beat this
 * week (since its last bounty was claimed); `rank` the nemesis's; `withLawlander` the payout for a party holding a
 * Lawlander; `postedBy` null for the board; `mine` the caller posted it.
 */
export const BOUNTY_KINDS = ['game', 'player', 'nemesis'] as const;
export const BOUNTY_STATUSES = ['open', 'claimed', 'expired'] as const;
export const BountyPosterSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(BOUNTY_KINDS),
  target: z.string().min(1).max(64),
  speciesId: z.string().max(32),
  level: z.number().int().min(1).max(100),
  zoneId: z.string().max(32),
  wins: z.number().int().min(0).nullable(),
  rank: z.number().int().min(1).max(5).nullable(),
  reward: Money,
  withLawlander: Money,
  postedBy: Name.nullable(),
  postedAt: IsoDate,
  expiresAt: IsoDate.nullable(),
  mine: z.boolean(),
});
/** One of the caller's own posts, whatever became of it (an expired one's escrow went back). */
export const BountyPostSchema = z.object({
  id: z.string().min(1).max(64),
  target: z.string().min(1).max(64),
  reward: Money,
  fee: Money,
  status: z.enum(BOUNTY_STATUSES),
  claimedBy: Name.nullable(),
  postedAt: IsoDate,
  expiresAt: IsoDate,
});
/** A claim on the board (the latest, newest first). */
export const BountyClaimSchema = z.object({
  kind: z.enum(BOUNTY_KINDS),
  target: z.string().min(1).max(64),
  claimedBy: Name,
  payout: Money,
  bonus: z.boolean(),
  zoneId: z.string().max(32),
  at: IsoDate,
});
/** A ghost haunting now that a bounty can be posted on (never the caller's own). */
export const BountyGhostSchema = z.object({
  name: Name,
  zoneId: z.string().max(32),
  speciesId: z.string().max(32),
  level: z.number().int().min(1).max(100),
  wins: z.number().int().min(0),
  wanted: z.boolean(),
});
export const BountiesRes = z.object({
  /** false while the server runs without the board (env BOUNTIES=off): the lists are empty */
  enabled: z.boolean(),
  /** when the board posts its next game bounties */
  nextPostingAt: IsoDate,
  wanted: z.array(BountyPosterSchema).max(40),
  personal: z.array(BountyPosterSchema).max(10),
  posted: z.array(BountyPostSchema).max(10),
  claims: z.array(BountyClaimSchema).max(10),
  ghosts: z.array(BountyGhostSchema).max(30),
  you: z.object({
    badlander: z.boolean(),
    lawlander: z.boolean(),
    open: z.number().int().min(0),
    claimsToday: z.number().int().min(0),
    atBoard: z.boolean(),
  }),
  money: Money,
});
export const BountyPostReq = z.object({ target: z.string().min(1).max(20), reward: z.number().int().min(1).max(1_000_000) });
export type BountyPosterView = z.infer<typeof BountyPosterSchema>;
export type BountyPostView = z.infer<typeof BountyPostSchema>;
export type BountyClaimView = z.infer<typeof BountyClaimSchema>;
export type BountyGhostView = z.infer<typeof BountyGhostSchema>;
export type BountiesView = z.infer<typeof BountiesRes>;

/**
 * Camp bases (content camps.ts, SPEC §3.19). `CAMP_TROPHY_KINDS` mirrors content's `TROPHY_KINDS` (protocol does not
 * import content). A camp as the caller sees it: its owner, banner and trophies, its guard (the party snapshot that
 * fights raiders), and for someone else's camp whether a raid could go ahead now: `ownerOnline` (the guard rests),
 * `raidedToday` (the caller's daily cut is spent), `cut` (what a win would take now), `inactive` (the owner has been away
 * long enough that a raider who wins takes the camp over).
 */
export const CAMP_TROPHY_KINDS = ['scar', 'legend', 'medal', 'achievement', 'bounty'] as const;
export const CampTrophySchema = z.object({ id: z.string().min(3).max(80), kind: z.enum(CAMP_TROPHY_KINDS), label: z.string().min(1).max(64) });
export const CampGuardSchema = z.object({ speciesId: z.string().max(32), level: z.number().int().min(1).max(100), isShiny: z.boolean() });
export const CampViewSchema = z.object({
  zoneId: z.string().max(32),
  owner: Name,
  name: z.string().min(1).max(24),
  trophies: z.array(CampTrophySchema).max(3),
  guard: z.array(CampGuardSchema).max(6),
  claimedAt: IsoDate,
  mine: z.boolean(),
  ownerOnline: z.boolean(),
  ownerInRun: z.boolean(),
  inactive: z.boolean(),
  raidedToday: z.boolean(),
  cut: Money,
});
/** One raid in the owner's camp log, with the line the game words it in. */
export const CampLogSchema = z.object({
  zoneId: z.string().max(32),
  raider: Name,
  won: z.boolean(),
  cut: Money,
  tookOver: z.boolean(),
  line: z.string().min(1).max(160),
  at: IsoDate,
});
export const CampsRes = z.object({
  /** false while the server runs without camps (env CAMPS=off): nothing can be claimed, raided or edited */
  enabled: z.boolean(),
  /** the travellers' camp of the zone the caller stands in (null: none there), and who holds it (null: free) */
  here: z.object({ zoneId: z.string().max(32), camp: CampViewSchema.nullable() }).nullable(),
  mine: CampViewSchema.nullable(),
  /** the trophies the caller has earned, to pick from */
  earned: z.array(CampTrophySchema).max(80),
  log: z.array(CampLogSchema).max(20),
  /** every held camp in the world */
  camps: z.array(z.object({ zoneId: z.string().max(32), owner: Name, name: z.string().min(1).max(24) })).max(32),
  you: z.object({ inRun: z.boolean(), money: Money }),
});
/** A new banner name and / or trophy pick (ids from `earned`, at most 3, in slot order). */
export const CampEditReq = z
  .object({ name: z.string().min(1).max(24).optional(), trophies: z.array(z.string().min(3).max(80)).max(3).optional() })
  .refine((b) => b.name !== undefined || b.trophies !== undefined, { message: 'name or trophies' });
export type CampTrophyView = z.infer<typeof CampTrophySchema>;
export type CampView = z.infer<typeof CampViewSchema>;
export type CampLogView = z.infer<typeof CampLogSchema>;
export type CampsView = z.infer<typeof CampsRes>;

/**
 * Majin vs Tenjin seasons (content factions.ts): the season's two sides (points, members, best contributors), the
 * caller's side and points (null before choosing), the side holding Solenne's sky (last season's winner) and the
 * Chronicle of the latest closed seasons, newest first. POST /factions/join takes a side for the season; a trainer
 * who already holds the other one gets 409 `alreadyJoined`.
 */
export const FactionSchema = z.enum(['majin', 'tenjin']);
export const FactionContributorSchema = z.object({ username: Username, points: z.number().int().min(0) });
export const FactionsRes = z.object({
  season: z.number().int(),
  endsAt: IsoDate,
  mine: z.object({ side: FactionSchema, points: z.number().int().min(0) }).nullable(),
  points: z.object({ majin: z.number().int().min(0), tenjin: z.number().int().min(0) }),
  members: z.object({ majin: z.number().int().min(0), tenjin: z.number().int().min(0) }),
  top: z.object({ majin: z.array(FactionContributorSchema).max(5), tenjin: z.array(FactionContributorSchema).max(5) }),
  sky: FactionSchema.nullable(),
  chronicle: z.array(z.object({ season: z.number().int().min(1), winner: FactionSchema.nullable(), line: z.string().max(400) })).max(6),
});
export type FactionsView = z.infer<typeof FactionsRes>;
export const FactionJoinReq = z.object({ side: FactionSchema });
export const FactionSkyRes = z.object({ sky: FactionSchema.nullable() });

/**
 * One roaming legendary per season (content roamer.ts): the season's roamer, the route it is on and when it moves on
 * (null once caught), its first catcher this season, and every season's first catcher, newest first.
 */
export const LegendCatchSchema = z.object({ season: z.number().int().min(1), species: z.string().max(32), username: z.string().max(20), at: IsoDate });
export const LegendsRes = z.object({
  season: z.number().int(),
  species: z.string().max(32),
  zoneId: z.string().max(32).nullable(),
  movesAt: IsoDate.nullable(),
  caught: LegendCatchSchema.nullable(),
  past: z.array(LegendCatchSchema).max(50),
});
export type LegendsView = z.infer<typeof LegendsRes>;

/**
 * Ghost trainers (content ghosts.ts): where the caller's ghost haunts (the zone they last left, with the party it
 * fights with; null before they ever left, or once it faded) and the fights other trainers had with it.
 */
export const GhostFightSchema = z.object({ challenger: z.string().max(20), zoneId: z.string().max(32), won: z.boolean(), at: IsoDate });
export const GhostRes = z.object({
  haunting: z
    .object({
      zoneId: z.string().max(32),
      leftAt: IsoDate,
      party: z.array(z.object({ speciesId: z.string().max(32), level: z.number().int().min(1).max(100) })).max(6),
    })
    .nullable(),
  won: z.number().int().min(0),
  lost: z.number().int().min(0),
  fights: z.array(GhostFightSchema).max(20),
});
export type GhostView = z.infer<typeof GhostRes>;

/**
 * Nemeses (content nemesis.ts): the caller's active nemeses, newest first (at most `max`): name and title, species and
 * level, the scar, the move it gained, its rank, where it rose and where it was last met (and when), and what it
 * remembers of the last fight.
 */
export const NemesisMemorySchema = z.object({
  how: z.enum(['ko', 'breakout']),
  zoneId: z.string().max(32),
  foeSpecies: z.string().max(32),
  foeName: z.string().max(16).nullable(),
  move: z.string().max(32).nullable(),
  orb: z.string().max(32).nullable(),
});
export const NemesisViewSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(16),
  title: z.string().min(1).max(32),
  speciesId: z.string().max(32),
  level: z.number().int().min(1).max(100),
  isShiny: z.boolean(),
  scar: z.enum(NEMESIS_SCAR_IDS),
  move: z.string().max(32).nullable(),
  rank: z.number().int().min(1).max(5),
  bornZone: z.string().max(32),
  lastZone: z.string().max(32),
  lastSeenAt: IsoDate,
  memory: NemesisMemorySchema,
});
export const NemesesRes = z.object({ nemeses: z.array(NemesisViewSchema).max(10), max: z.number().int().min(1) });
export type NemesisView = z.infer<typeof NemesisViewSchema>;
export type NemesesView = z.infer<typeof NemesesRes>;

/**
 * Breeding (content daycare.ts). The Daycare: the creatures left there (in the order they were left, at most two),
 * whether they can breed (`refusal` when not), what would hatch and whether it is bandborn, when the next egg is ready
 * (`eggAt`, null while they cannot breed) and the trainer's eggs (carried ones count steps; the species stays a
 * surprise until it hatches). Every action answers with the Daycare and the party and box after it.
 */
export const BREED_REFUSALS = ['legendary', 'unrelated'] as const;
export const EGG_PLACES = ['party', 'box'] as const;
export const EggSchema = z.object({
  id: Uuid,
  place: z.enum(EGG_PLACES),
  stepsTotal: z.number().int().min(1),
  stepsWalked: z.number().int().min(0),
  bandborn: z.boolean(),
  /** the parents' names as they were (nickname, else species name) */
  parents: z.tuple([z.string().min(1).max(40), z.string().min(1).max(40)]),
  zoneId: z.string().max(32),
  laidAt: IsoDate,
});
export type EggView = z.infer<typeof EggSchema>;
export const DaycareRes = z.object({
  zoneId: z.string().max(32),
  pair: z.array(CreatureInstanceSchema).max(2),
  refusal: z.enum(BREED_REFUSALS).nullable(),
  hatches: z.string().max(32).nullable(),
  bandborn: z.boolean(),
  eggAt: IsoDate.nullable(),
  eggReady: z.boolean(),
  eggs: z.array(EggSchema).max(64),
  carryMax: z.number().int().min(1),
  eggMax: z.number().int().min(1),
});
export type DaycareView = z.infer<typeof DaycareRes>;
export const DaycareActionRes = z.object({ daycare: DaycareRes, party: Party, box: Box });
export const EggParams = z.object({ id: Uuid });
export const EggMoveReq = z.object({ place: z.enum(EGG_PLACES) });

// ---- admin / health -----------------------------------------------------------------------------------------------------

/** TODO(spec): `/admin/stats` has no listed body; these are the legacy counters carried over. */
export const AdminStatsRes = z.looseObject({
  total: z.number().int().min(0),
  banned: z.number().int().min(0),
  online: z.number().int().min(0),
});
export const AdminPlayersQuery = z.object({ q: z.string().max(20).optional(), page: Page });
export const AdminPlayerRowSchema = z.object({
  id: Uuid,
  username: Username,
  email: Email,
  isAdmin: z.boolean(),
  bannedAt: IsoDate.nullable(),
  banReason: z.string().nullable(),
  createdAt: IsoDate,
  lastSeenAt: IsoDate,
});
export const AdminPlayersRes = z.object({ rows: z.array(AdminPlayerRowSchema), total: z.number().int().min(0) });
export const BanReq = z.object({ username: Username, reason: z.string().min(1).max(200) });
export const UnbanReq = z.object({ username: Username, reason: z.string().min(1).max(200).optional() });
/** 30-server-netcode.md §30.10.2 — loose: an observability shape the client only displays. */
export const ProcessMetricsSchema = z.looseObject({
  rooms: z.array(z.looseObject({ roomId: z.string(), zoneId: ZoneIdSchema, shard: z.number().int().min(0), players: z.number().int().min(0) })),
  rest: z.record(z.string(), z.looseObject({ count: z.number(), p50Ms: z.number(), p99Ms: z.number(), s4xx: z.number(), s5xx: z.number() })),
  db: z.looseObject({ txPerSec: z.number(), txP99Ms: z.number(), poolInUse: z.number() }),
  presenceSize: z.number().int().min(0),
  heapMb: z.number(),
});
export const HealthRes = z.object({ status: z.literal('ok'), time: z.number().int().min(0) });

// ---- the route table -----------------------------------------------------------------------------------------------------

export type HttpMethod = 'GET' | 'POST';
export type RouteAuth = 'none' | 'bearer' | 'admin';

export interface RouteDef {
  readonly method: HttpMethod;
  readonly path: string;
  readonly auth: RouteAuth;
  /** `:param` segments */
  readonly params?: z.ZodType;
  readonly query?: z.ZodType;
  readonly request?: z.ZodType;
  /** `null` = 204 No Content */
  readonly response: z.ZodType | null;
  /** 30-server-netcode.md §30.6.4 key, when the route has a dedicated limit (else restRead/restWrite). */
  readonly limit?: 'register' | 'login' | 'refresh' | 'listing' | 'bid' | 'message' | 'friendReq' | 'guildOp' | 'forgot' | 'emailToken' | 'resend' | 'replay' | 'weather';
}

const route = <const R extends RouteDef>(r: R): R => r;

export const ROUTES = {
  authRegister: route({ method: 'POST', path: '/auth/register', auth: 'none', request: RegisterReq, response: AuthRes, limit: 'register' }),
  authLogin: route({ method: 'POST', path: '/auth/login', auth: 'none', request: LoginReq, response: AuthRes, limit: 'login' }),
  authRefresh: route({ method: 'POST', path: '/auth/refresh', auth: 'none', request: RefreshReq, response: RefreshRes, limit: 'refresh' }),
  authLogout: route({ method: 'POST', path: '/auth/logout', auth: 'bearer', request: LogoutReq, response: null }),
  authForgot: route({ method: 'POST', path: '/auth/forgot', auth: 'none', request: ForgotReq, response: null, limit: 'forgot' }),
  authReset: route({ method: 'POST', path: '/auth/reset', auth: 'none', request: ResetReq, response: null, limit: 'emailToken' }),
  authVerify: route({ method: 'POST', path: '/auth/verify', auth: 'none', request: VerifyReq, response: null, limit: 'emailToken' }),
  authResend: route({ method: 'POST', path: '/auth/resend', auth: 'bearer', request: Nothing, response: null, limit: 'resend' }),
  me: route({ method: 'GET', path: '/me', auth: 'bearer', response: MeRes }),
  zoneEnter: route({ method: 'POST', path: '/zone/enter', auth: 'bearer', request: ZoneEnterReq, response: ZoneEnterRes }),
  profile: route({ method: 'POST', path: '/profile', auth: 'bearer', request: ProfileReq, response: PlayerProfileSchema }),
  questsClaim: route({ method: 'POST', path: '/quests/claim', auth: 'bearer', request: QuestClaimReq, response: QuestClaimRes }),
  partyReorder: route({ method: 'POST', path: '/party/reorder', auth: 'bearer', request: PartyReorderReq, response: PartyRes }),
  partySwap: route({ method: 'POST', path: '/party/swap', auth: 'bearer', request: PartySwapReq, response: PartyBoxRes }),
  partyWithdraw: route({ method: 'POST', path: '/party/withdraw', auth: 'bearer', request: CreatureIdReq, response: PartyBoxRes }),
  partyDeposit: route({ method: 'POST', path: '/party/deposit', auth: 'bearer', request: CreatureIdReq, response: PartyBoxRes }),
  creatureNickname: route({ method: 'POST', path: '/creature/:id/nickname', auth: 'bearer', params: CreatureParams, request: NicknameReq, response: CreatureInstanceSchema }),
  creatureMoves: route({ method: 'POST', path: '/creature/:id/moves', auth: 'bearer', params: CreatureParams, request: MovesReq, response: CreatureInstanceSchema }),
  creatureSetup: route({ method: 'POST', path: '/creature/:id/setup', auth: 'bearer', params: CreatureParams, request: SetupReq, response: CreatureSetupRes }),
  creatureEvolve: route({ method: 'POST', path: '/creature/:id/evolve', auth: 'bearer', params: CreatureParams, request: EvolveReq, response: CreatureEvolveRes }),
  creatureTutor: route({ method: 'POST', path: '/creature/:id/tutor', auth: 'bearer', params: CreatureParams, request: TutorReq, response: CreatureSetupRes }),
  creatureRelease: route({ method: 'POST', path: '/creature/:id/release', auth: 'bearer', params: CreatureParams, request: Nothing, response: null }),
  creatureFlags: route({ method: 'POST', path: '/creature/:id/flags', auth: 'bearer', params: CreatureParams, request: CreatureFlagsReq, response: CreatureInstanceSchema }),
  creatureHistory: route({ method: 'GET', path: '/creature/:id/history', auth: 'bearer', params: CreatureParams, response: CreatureHistoryRes }),
  challenge: route({ method: 'POST', path: '/challenge', auth: 'bearer', request: ChallengeReq, response: ChallengeRes }),
  speedrun: route({ method: 'GET', path: '/speedrun', auth: 'bearer', response: SpeedrunRes }),
  speedrunOf: route({ method: 'GET', path: '/speedrun/:username', auth: 'bearer', params: UsernameParams, response: SpeedrunRes }),
  // weather from real life: find a city, pick it (or null), read the player's
  weatherCities: route({ method: 'GET', path: '/weather/cities', auth: 'bearer', query: WeatherCitiesQuery, response: WeatherCitiesRes, limit: 'weather' }),
  weatherCity: route({ method: 'POST', path: '/weather/city', auth: 'bearer', request: WeatherCityReq, response: RealWeatherRes }),
  weather: route({ method: 'GET', path: '/weather', auth: 'bearer', response: RealWeatherRes }),
  itemUse: route({ method: 'POST', path: '/item/use', auth: 'bearer', request: ItemUseReq, response: ItemUseRes }),
  heal: route({ method: 'POST', path: '/heal', auth: 'bearer', request: Nothing, response: PartyRes }),
  dex: route({ method: 'GET', path: '/dex', auth: 'bearer', response: DexRes }),
  shop: route({ method: 'GET', path: '/shop/:zoneId', auth: 'bearer', params: ShopParams, response: ShopRes }),
  shopBuy: route({ method: 'POST', path: '/shop/buy', auth: 'bearer', request: ShopTradeReq, response: InventoryMoneyRes }),
  shopSell: route({ method: 'POST', path: '/shop/sell', auth: 'bearer', request: ShopTradeReq, response: InventoryMoneyRes }),
  marketplace: route({ method: 'GET', path: '/marketplace', auth: 'bearer', query: MarketQuery, response: MarketSearchRes }),
  marketplaceMyActive: route({ method: 'GET', path: '/marketplace/my/active', auth: 'bearer', response: ListingListRes }),
  marketplaceMyBids: route({ method: 'GET', path: '/marketplace/my/bids', auth: 'bearer', response: ListingListRes }),
  marketplaceDetail: route({ method: 'GET', path: '/marketplace/:id', auth: 'bearer', params: ListingParams, response: ListingDetailRes }),
  marketplaceList: route({ method: 'POST', path: '/marketplace/list', auth: 'bearer', request: ListCreateReq, response: ListingMutationRes, limit: 'listing' }),
  marketplaceBid: route({ method: 'POST', path: '/marketplace/:id/bid', auth: 'bearer', params: ListingParams, request: BidReq, response: ListingMutationRes, limit: 'bid' }),
  marketplaceBuyNow: route({ method: 'POST', path: '/marketplace/:id/buy-now', auth: 'bearer', params: ListingParams, request: Nothing, response: ListingMutationRes }),
  marketplaceCancel: route({ method: 'POST', path: '/marketplace/:id/cancel', auth: 'bearer', params: ListingParams, request: Nothing, response: ListingMutationRes }),
  friends: route({ method: 'GET', path: '/friends', auth: 'bearer', response: FriendListsSchema }),
  friendsRequest: route({ method: 'POST', path: '/friends/request', auth: 'bearer', request: UsernameReq, response: FriendListsSchema, limit: 'friendReq' }),
  friendsAccept: route({ method: 'POST', path: '/friends/accept', auth: 'bearer', request: UsernameReq, response: FriendListsSchema }),
  friendsDecline: route({ method: 'POST', path: '/friends/decline', auth: 'bearer', request: UsernameReq, response: FriendListsSchema }),
  friendsRemove: route({ method: 'POST', path: '/friends/remove', auth: 'bearer', request: UsernameReq, response: FriendListsSchema }),
  messagesThread: route({ method: 'GET', path: '/messages/:username', auth: 'bearer', params: UsernameParams, query: MessagesQuery, response: MessagesRes }),
  messagesSend: route({ method: 'POST', path: '/messages/:username', auth: 'bearer', params: UsernameParams, request: SendMessageReq, response: MessageViewSchema, limit: 'message' }),
  messagesRead: route({ method: 'POST', path: '/messages/read', auth: 'bearer', request: UsernameReq, response: null }),
  guilds: route({ method: 'GET', path: '/guilds', auth: 'bearer', query: GuildsQuery, response: GuildListRes }),
  guildDetail: route({ method: 'GET', path: '/guilds/:id', auth: 'bearer', params: GuildParams, response: GuildDetailRes }),
  guildCreate: route({ method: 'POST', path: '/guilds', auth: 'bearer', request: GuildCreateReq, response: GuildCreateRes, limit: 'guildOp' }),
  guildJoin: route({ method: 'POST', path: '/guilds/:id/join', auth: 'bearer', params: GuildParams, request: GuildMemberReq, response: GuildViewSchema, limit: 'guildOp' }),
  guildLeave: route({ method: 'POST', path: '/guilds/:id/leave', auth: 'bearer', params: GuildParams, request: GuildMemberReq, response: GuildViewSchema, limit: 'guildOp' }),
  guildKick: route({ method: 'POST', path: '/guilds/:id/kick', auth: 'bearer', params: GuildParams, request: GuildMemberReq, response: GuildViewSchema, limit: 'guildOp' }),
  guildPromote: route({ method: 'POST', path: '/guilds/:id/promote', auth: 'bearer', params: GuildParams, request: GuildMemberReq, response: GuildViewSchema, limit: 'guildOp' }),
  leaderboard: route({ method: 'GET', path: '/leaderboard', auth: 'bearer', query: LeaderboardQuery, response: LeaderboardRes }),
  playerPublic: route({ method: 'GET', path: '/players/:username', auth: 'bearer', params: UsernameParams, response: PublicProfileSchema }),
  battlePass: route({ method: 'GET', path: '/battle-pass', auth: 'bearer', response: BattlePassStateSchema }),
  battlePassClaim: route({ method: 'POST', path: '/battle-pass/claim', auth: 'bearer', request: BattlePassClaimReq, response: BattlePassClaimRes }),
  battlePassMythical: route({ method: 'POST', path: '/battle-pass/mythical-choice', auth: 'bearer', request: MythicalChoiceReq, response: CreaturesAddedRes }),
  historyBattles: route({ method: 'GET', path: '/history/battles', auth: 'bearer', query: PageQuery, response: BattleHistoryRes }),
  historyTrades: route({ method: 'GET', path: '/history/trades', auth: 'bearer', query: PageQuery, response: TradeHistoryRes }),
  // battle replays: a share token for one of the player's battles, and the public replay behind it
  historyShare: route({ method: 'POST', path: '/history/battles/:battleId/share', auth: 'bearer', params: BattleShareParams, request: Nothing, response: BattleShareRes }),
  replay: route({ method: 'GET', path: '/replay/:token', auth: 'none', params: ReplayParams, response: ReplayRes, limit: 'replay' }),
  // arena PvP (arena.ts): out-of-world queues, AI training, friend invites, the reload rejoin
  arena: route({ method: 'GET', path: '/arena', auth: 'bearer', response: ArenaInfoRes }),
  arenaQueue: route({ method: 'POST', path: '/arena/queue', auth: 'bearer', request: ArenaQueueReq, response: ArenaStatusBody }),
  arenaQueueLeave: route({ method: 'POST', path: '/arena/queue/leave', auth: 'bearer', request: Nothing, response: ArenaStatusBody }),
  arenaTraining: route({ method: 'POST', path: '/arena/training', auth: 'bearer', request: ArenaTrainingReq, response: ArenaSeatRes }),
  arenaInvite: route({ method: 'POST', path: '/arena/invite', auth: 'bearer', request: ArenaInviteReq, response: ArenaInviteRes, limit: 'friendReq' }),
  arenaInviteReply: route({ method: 'POST', path: '/arena/invite/reply', auth: 'bearer', request: ArenaInviteReplyReq, response: ArenaInviteReplyRes }),
  arenaRejoin: route({ method: 'POST', path: '/arena/rejoin', auth: 'bearer', request: Nothing, response: ArenaSeatRes }),
  // the daily challenge (arena.ts): today's puzzle and best, and the start (an arena seat)
  daily: route({ method: 'GET', path: '/daily', auth: 'bearer', response: DailyRes }),
  // ranked seasons: the season now and the latest closed ones, one closed season's standings, a trainer's titles
  seasons: route({ method: 'GET', path: '/seasons', auth: 'bearer', response: SeasonsRes }),
  seasonStandings: route({ method: 'GET', path: '/seasons/:season', auth: 'bearer', params: SeasonParams, query: PageQuery, response: SeasonStandingsRes }),
  seasonTitles: route({ method: 'GET', path: '/seasons/titles/:username', auth: 'bearer', params: UsernameParams, response: SeasonTitlesRes }),
  // spectator mode: the live arena matches and one match's feed (a turn behind)
  arenaLive: route({ method: 'GET', path: '/arena/live', auth: 'bearer', response: LiveListRes }),
  arenaLiveFeed: route({ method: 'GET', path: '/arena/live/:matchId', auth: 'bearer', params: LiveParams, response: LiveFeedRes }),
  // honor shapes the world: the zones under a shadow this season
  worldShadow: route({ method: 'GET', path: '/world/shadow', auth: 'bearer', response: WorldShadowRes }),
  // a living ecosystem: this week on a zone (surging, scarce, migrants, the honor tilt)
  worldEcosystem: route({ method: 'GET', path: '/world/ecosystem/:zoneId', auth: 'bearer', params: EcoParams, response: EcosystemRes }),
  // the bounty board: the Wanted posters, the caller's posts and the latest claims; posting one on a ghost
  bounties: route({ method: 'GET', path: '/bounties', auth: 'bearer', response: BountiesRes }),
  bountyPost: route({ method: 'POST', path: '/bounties', auth: 'bearer', request: BountyPostReq, response: BountiesRes }),
  // camp bases: the camp here, your camp, the trophies you earned and the camp log; renaming / decorating, abandoning
  camps: route({ method: 'GET', path: '/camps', auth: 'bearer', response: CampsRes }),
  campEdit: route({ method: 'POST', path: '/camps/edit', auth: 'bearer', request: CampEditReq, response: CampsRes }),
  campAbandon: route({ method: 'POST', path: '/camps/abandon', auth: 'bearer', request: Nothing, response: CampsRes }),
  // Majin vs Tenjin seasons: the standings and the Chronicle, taking a side, the side holding Solenne's sky
  factions: route({ method: 'GET', path: '/factions', auth: 'bearer', response: FactionsRes }),
  factionJoin: route({ method: 'POST', path: '/factions/join', auth: 'bearer', request: FactionJoinReq, response: FactionsRes }),
  factionSky: route({ method: 'GET', path: '/factions/sky', auth: 'bearer', response: FactionSkyRes }),
  // one roaming legendary per season: where it roams and who caught it first
  legends: route({ method: 'GET', path: '/legends', auth: 'bearer', response: LegendsRes }),
  // ghost trainers: where your ghost haunts and how it fared
  ghost: route({ method: 'GET', path: '/ghost', auth: 'bearer', response: GhostRes }),
  // nemeses: the wild creatures that beat or escaped you and rose against you
  nemeses: route({ method: 'GET', path: '/nemeses', auth: 'bearer', response: NemesesRes }),
  // breeding: the Daycare (leave / take back a creature, collect the egg) and moving an egg between the party and the box
  daycare: route({ method: 'GET', path: '/daycare', auth: 'bearer', response: DaycareRes }),
  daycareLeave: route({ method: 'POST', path: '/daycare/leave', auth: 'bearer', request: CreatureIdReq, response: DaycareActionRes }),
  daycareTake: route({ method: 'POST', path: '/daycare/take', auth: 'bearer', request: CreatureIdReq, response: DaycareActionRes }),
  daycareCollect: route({ method: 'POST', path: '/daycare/collect', auth: 'bearer', request: Nothing, response: DaycareActionRes }),
  eggMove: route({ method: 'POST', path: '/eggs/:id/move', auth: 'bearer', params: EggParams, request: EggMoveReq, response: DaycareActionRes }),
  dailyStart: route({ method: 'POST', path: '/daily/start', auth: 'bearer', request: Nothing, response: ArenaSeatRes }),
  adminStats: route({ method: 'GET', path: '/admin/stats', auth: 'admin', response: AdminStatsRes }),
  adminPlayers: route({ method: 'GET', path: '/admin/players', auth: 'admin', query: AdminPlayersQuery, response: AdminPlayersRes }),
  adminMetrics: route({ method: 'GET', path: '/admin/metrics', auth: 'admin', response: ProcessMetricsSchema }),
  adminBan: route({ method: 'POST', path: '/admin/ban', auth: 'admin', request: BanReq, response: null }),
  adminUnban: route({ method: 'POST', path: '/admin/unban', auth: 'admin', request: UnbanReq, response: null }),
  health: route({ method: 'GET', path: '/health', auth: 'none', response: HealthRes }),
} as const satisfies Record<string, RouteDef>;

export type RouteKey = keyof typeof ROUTES;
export type Route<K extends RouteKey> = (typeof ROUTES)[K];
type Infer<S> = S extends z.ZodType ? z.infer<S> : never;
type Input<S> = S extends z.ZodType ? z.input<S> : never;
/** The validated request body of a route (`never` for GETs). */
export type RouteRequest<K extends RouteKey> = Route<K> extends { request: infer S } ? Infer<S> : never;
/** What the client sends (before defaults/coercion). */
export type RouteRequestInput<K extends RouteKey> = Route<K> extends { request: infer S } ? Input<S> : never;
export type RouteQuery<K extends RouteKey> = Route<K> extends { query: infer S } ? Input<S> : never;
export type RouteParams<K extends RouteKey> = Route<K> extends { params: infer S } ? Infer<S> : never;
/** The 200 body (`void` for 204 routes). */
export type RouteResponse<K extends RouteKey> = Route<K> extends { response: infer S } ? (S extends null ? void : Infer<S>) : never;

export const ROUTE_KEYS = Object.freeze(Object.keys(ROUTES) as RouteKey[]);

/** Substitute `:param` segments — `routePath('shop', { zoneId: 'mirevale' })` → `/shop/mirevale`. */
export function routePath<K extends RouteKey>(key: K, params?: Readonly<Record<string, string>>): string {
  return ROUTES[key].path.replace(/:([a-zA-Z]+)/g, (_m, name: string) => {
    const v = params?.[name];
    if (v === undefined) throw new RangeError(`route ${key}: missing param :${name}`);
    return encodeURIComponent(v);
  });
}
