const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { START_POSITION, WORLD_ID, MAP_NAMES } = require("../data/worldImported");
const { getDefaultPvpRank, normalizePvpRank } = require("../utils/rankUtils");
const { LEGACY_ORB_ID_MAP } = require("../data/ewamon");

const EwamonInstanceSchema = new mongoose.Schema({
  speciesId: { type: String, required: true }, // e.g. "moflame"
  nickname: String,
  level: { type: Number, default: 5 },
  hp: Number,
  maxHp: Number,
  atk: Number,
  def: Number,
  spd: Number,
  exp: { type: Number, default: 0 },
  expToNext: { type: Number, default: 500 },
  moves: [String],
  pp: { type: Map, of: Number },
  // Multiple statuses can co-exist (e.g. burn + confusion). Major statuses
  // (burn/poison/paralyze/sleep/freeze) are mutually exclusive — enforced by
  // the `addStatus` helper in the battle resolvers, not at the schema layer.
  status: { type: [String], default: [] },
  caughtAt: { type: Date, default: Date.now },
  isFavorite: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  selectedAbility: { type: String, default: null }, // chosen ability from species.abilities
  heldItem: { type: String, default: null }, // held item from ITEMS catalog
  variantKey: { type: String, default: "normal" },
  isAlpha: { type: Boolean, default: false },
  caughtZoneId: { type: String, default: null },
  caughtMapId: { type: String, default: null },
  caughtEventId: { type: String, default: null },
  ribbons: { type: [String], default: [] },
  battleStats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    friendWins: { type: Number, default: 0 },
    cupWins: { type: Number, default: 0 },
  },
});

const TrainerIdentitySchema = new mongoose.Schema({
  title: { type: String, default: "Rookie Trainer" },
  motto: { type: String, default: "" },
  spriteSlot: { type: String, default: "trainer" },
  // 3D-overworld body the player walks around as (drives the CC0 GLB character
  // others see in multiplayer presence). Distinct from the 2D `spriteSlot`.
  worldBody: { type: String, enum: ["male", "female"], default: "male" },
  avatarEwamon: { type: String, default: null },
  cosmetics: {
    palette: { type: String, default: "forest" },
    frame: { type: String, default: "sprout" },
    flair: { type: String, default: "spark" },
    backgroundTheme: { type: String, default: "frontier" },
    accentColor: { type: String, default: "fern" },
    nameplateStyle: { type: String, default: "pixel" },
    badgeLayout: { type: String, default: "grid" },
    effectStyle: { type: String, default: "none" },
  },
  showcaseTeam: { type: [String], default: [] },
  featuredAchievements: { type: [String], default: [] },
}, { _id: false });

const TradeHistoryEntrySchema = new mongoose.Schema({
  tradeId: String,
  partnerUsername: String,
  sentSpeciesId: String,
  sentNickname: String,
  sentLevel: Number,
  receivedSpeciesId: String,
  receivedNickname: String,
  receivedLevel: Number,
  completedAt: { type: Date, default: Date.now },
}, { _id: false });

const PrivateMessageSchema = new mongoose.Schema({
  conversationKey: { type: String, required: true },
  partnerUsername: { type: String, required: true },
  fromUsername: { type: String, required: true },
  toUsername: { type: String, required: true },
  text: { type: String, required: true, maxlength: 300 },
  sentAt: { type: Date, default: Date.now },
  readAt: { type: Date, default: null },
}, { _id: false });

const BattleHistoryEntrySchema = new mongoose.Schema({
  roomId: String,
  opponentUsername: String,
  result: { type: String, enum: ["win", "loss"], required: true },
  mode: { type: String, default: "standard" },
  reason: { type: String, default: "combat" },
  rewardMoney: { type: Number, default: 0 },
  rewardExp: { type: Number, default: 0 },
  ratingBefore: { type: Number, default: null },
  ratingAfter: { type: Number, default: null },
  ratingDelta: { type: Number, default: 0 },
  tierBefore: { type: String, default: null },
  tierAfter: { type: String, default: null },
  turnCount: { type: Number, default: 0 },
  highlights: { type: [String], default: [] },
  happenedAt: { type: Date, default: Date.now },
}, { _id: false });

const MarketplaceHistoryEntrySchema = new mongoose.Schema({
  listingId:             { type: String, default: null },
  type:                  { type: String, enum: ["sold", "bought", "cancelled", "expired_refund"], required: true },
  speciesId:             { type: String, default: null },
  nickname:              { type: String, default: null },
  finalPrice:            { type: Number, default: 0 },
  counterpartyUsername:  { type: String, default: null },
  resolvedAt:            { type: Date, default: Date.now },
}, { _id: false });

const PvpRankSchema = new mongoose.Schema({
  rating: { type: Number, default: getDefaultPvpRank().rating },
  peakRating: { type: Number, default: getDefaultPvpRank().peakRating },
  lastDelta: { type: Number, default: 0 },
  tierKey: { type: String, default: getDefaultPvpRank().tierKey },
  tierLabel: { type: String, default: getDefaultPvpRank().tierLabel },
}, { _id: false });

const QuestStateSchema = new mongoose.Schema({
  activeQuestId: { type: String, default: "ch1_bloom_call" },
  completedQuestIds: { type: [String], default: [] },
  objectives: { type: Map, of: Boolean, default: {} },
  rewardClaims: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const LeagueProgressSchema = new mongoose.Schema({
  defeatedTrainerIds: { type: [String], default: [] },
  lastClearedAt: { type: Date, default: null },
}, { _id: false });

const PlayerSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  password: { type: String, required: true },
  email: { type: String, trim: true, lowercase: true, default: null, sparse: true },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: null },
  emailVerificationExpiry: { type: Date, default: null },
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null },
  trainerLevel: { type: Number, default: 1 },
  trainerExp: { type: Number, default: 0 },
  money: { type: Number, default: 1000 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  pvpRank: { type: PvpRankSchema, default: () => getDefaultPvpRank() },
  party: { type: [EwamonInstanceSchema], default: [], validate: v => v.length <= 6 },
  box: { type: [EwamonInstanceSchema], default: [] },       // PC storage
  collection: { type: [String], default: [] },              // species IDs caught
  seen: { type: [String], default: [] },                    // species IDs encountered (seen but not necessarily caught)
  defeatedMapEvents: { type: [String], default: [] },
  inventory: {
    type: Map,
    of: Number,
    default: { potion: 3, spark_orb: 5 },
  },
  mapPosition: {
    x: { type: Number, default: START_POSITION.x },
    y: { type: Number, default: START_POSITION.y },
    // mapId is a canonical 3D-world area id (e.g. "mirevale", "mire_route").
    // Legacy values from the retired 2D world (e.g. "bloom-town") or numeric
    // ids are coerced to the start area the first time the player loads
    // (migrateLegacyMapPosition).
    mapId: { type: String, default: START_POSITION.mapId },
  },
  mapState: {
    worldId: { type: String, default: WORLD_ID },
  },
  // Overworld traversal state persisted per player.
  // clearedCuts: keys are "<mapId>:<x>,<y>" strings; presence means the player
  // has used Cut on that tree and can now pass through it on subsequent visits.
  overworldState: {
    clearedCuts: { type: Map, of: Boolean, default: () => new Map() },
    // pushedBoulders: keys "<mapId>:<origX>,<origY>" -> "<dx>,<dy>" offset from origin.
    pushedBoulders: { type: Map, of: String, default: () => new Map() },
    // HM field abilities. Surf unlocks walking onto water tiles; Cut/Strength
    // are authored hooks for existing cut-tree and boulder mechanics.
    hmFlags: {
      surf:     { type: Boolean, default: false },
      cut:      { type: Boolean, default: false },
      strength: { type: Boolean, default: false },
    },
  },
  // 3D campaign progression. `badges` holds the 8 gym badge ids
  // (bloom/ember/current/circuit/fault/wraith/anvil/ascend). `storyFlags`
  // holds Eclipse-Order story + beat + lore + legendary-catch flags
  // (done_intro, saw_order, gymwin_*, champion, leg_*, lore_*, done_<beat>).
  badges: { type: [String], default: [] },
  storyFlags: { type: Map, of: Boolean, default: () => new Map() },
  visitedMaps: { type: [Number], default: [] },
  repelSteps: { type: Number, default: 0 },
  lureSteps:  { type: Number, default: 0 },
  online: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
  onboarding: {
    tutorialCompleted: { type: Boolean, default: false },
    starterChoice: { type: String, default: null },
    firstLoginAt: { type: Date, default: null },
  },
  friends: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], default: [] },
  incomingFriendRequests: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], default: [] },
  outgoingFriendRequests: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], default: [] },
  privateMessages: { type: [PrivateMessageSchema], default: [] },
  trainerIdentity: { type: TrainerIdentitySchema, default: () => ({}) },
  tradeHistory: { type: [TradeHistoryEntrySchema], default: [] },
  battleHistory: { type: [BattleHistoryEntrySchema], default: [] },
  marketplaceHistory: { type: [MarketplaceHistoryEntrySchema], default: [] },
  questState: { type: QuestStateSchema, default: () => ({}) },
  leagueProgress: { type: LeagueProgressSchema, default: () => ({}) },
  battlePassClaims:        { type: [Number], default: [] },
  battlePassMythicalChoice: { type: String, default: null },
  liveOps: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  achievementState: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  unlockState: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  socialBonusState: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  rematchState: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  recentRewardLog: { type: [mongoose.Schema.Types.Mixed], default: [] },
  settings: {
    showOnlineStatus:    { type: Boolean, default: true },
    allowFriendRequests: { type: Boolean, default: true },
    allowTrades:         { type: Boolean, default: true },
    allowChallenges:     { type: Boolean, default: true },
    showInLeaderboard:   { type: Boolean, default: true },
    mapChatEnabled:      { type: Boolean, default: true },
  },
  isAdmin: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
}, {
  suppressReservedKeysWarning: true,
  // Mongoose 8 ships with optimistic concurrency disabled by default. Without
  // this, two concurrent saves silently last-write-win — meaning the
  // withVersionRetry helper has been a no-op for Player documents. Turning it
  // on makes save() throw VersionError on conflicting writes, which the
  // retry helper then handles correctly.
  optimisticConcurrency: true,
});

// Indexes for leaderboard and frequent lookups
// username has an implicit index from unique:true — no duplicate needed
PlayerSchema.index({ "pvpRank.rating": -1 });
PlayerSchema.index({ wins: -1 });
PlayerSchema.index({ trainerLevel: -1 });
// email index is created implicitly by `sparse: true` on the field def above —
// no explicit schema.index() needed (duplicate would log a Mongoose warning).
// collection is an array; MongoDB can sort by its computed size via aggregation
// but adding an index on the array itself speeds up $size queries and updates
PlayerSchema.index({ collection: 1 });
// Online-presence and leaderboard queries — added in the 10/10 hardening pass.
PlayerSchema.index({ online: 1, lastActive: -1 });
PlayerSchema.index({ trainerLevel: -1, wins: -1 });

// Hash password before save
PlayerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

PlayerSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

function normalizeMapsDeep(value) {
  if (value instanceof Map) return normalizeMapsDeep(Object.fromEntries(value));
  if (Array.isArray(value)) return value.map(normalizeMapsDeep);
  if (value != null && typeof value === "object") {
    if (value._bsontype === "ObjectId") return value.toString();
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeMapsDeep(nestedValue)])
    );
  }
  return value;
}

// Fields that are safe to ship back to the authenticated user themselves.
// Anything not on this list is stripped, including future-added fields — that
// way a new sensitive field can never leak by accident (the previous deny-list
// missed resetToken/isAdmin/etc. and shipped to every client).
const PUBLIC_FIELDS = Object.freeze([
  "_id",
  "username",
  "email",
  "emailVerified",
  "trainerLevel",
  "trainerExp",
  "money",
  "wins",
  "losses",
  "pvpRank",
  "party",
  "box",
  "collection",
  "seen",
  "defeatedMapEvents",
  "inventory",
  "mapPosition",
  "mapState",
  "overworldState",
  "badges",
  "storyFlags",
  "visitedMaps",
  "repelSteps",
  "lureSteps",
  "online",
  "lastActive",
  "onboarding",
  "friends",
  "incomingFriendRequests",
  "outgoingFriendRequests",
  "privateMessages",
  "trainerIdentity",
  "tradeHistory",
  "battleHistory",
  "marketplaceHistory",
  "questState",
  "leagueProgress",
  "battlePassClaims",
  "battlePassMythicalChoice",
  "liveOps",
  "achievementState",
  "unlockState",
  "socialBonusState",
  "rematchState",
  "recentRewardLog",
  "settings",
  "createdAt",
]);
PlayerSchema.statics.PUBLIC_FIELDS = PUBLIC_FIELDS;

PlayerSchema.methods.toPublic = function () {
  const raw = normalizeMapsDeep(this.toObject());
  const out = {};
  for (const key of PUBLIC_FIELDS) {
    if (key in raw) out[key] = raw[key];
  }
  out.pvpRank = normalizePvpRank(out.pvpRank);
  return out;
};

// Migrate legacy capture-item inventory keys (ewamon_ball, great_ball, ultra_ball,
// master_ball, ultraball) onto the new orb IDs whenever a Player document is
// loaded. The post('init') hook normalizes in memory so all read paths see the
// new keys; the pre('save') hook strips any stale legacy keys before persist.
function migrateLegacyOrbInventory(doc) {
  if (!doc?.inventory) return false;
  if (!(doc.inventory instanceof Map)) {
    doc.inventory = new Map(Object.entries(doc.inventory || {}));
  }
  let changed = false;
  for (const [legacy, modern] of Object.entries(LEGACY_ORB_ID_MAP)) {
    if (!doc.inventory.has(legacy)) continue;
    const legacyQty = Number(doc.inventory.get(legacy) || 0);
    if (legacyQty > 0) {
      const merged = Number(doc.inventory.get(modern) || 0) + legacyQty;
      doc.inventory.set(modern, merged);
    }
    doc.inventory.delete(legacy);
    changed = true;
  }
  return changed;
}

// Normalize any pre-array-status Ewamon documents loaded from Mongo. Older
// rows may have `status: "burn"` (scalar) or `status: null`; the schema now
// expects `[String]`. This is done in-memory on init so all read paths see
// the array shape consistently. A one-off migration in
// scripts/migrate-status-array.js persists the change.
function migrateLegacyStatusArray(doc) {
  const fixOne = (e) => {
    if (!e) return;
    const s = e.status;
    if (Array.isArray(s)) {
      // Filter out null/empty strings just in case.
      const cleaned = s.filter(Boolean);
      if (cleaned.length !== s.length) e.status = cleaned;
      return;
    }
    if (typeof s === "string" && s) e.status = [s];
    else if (s == null) e.status = [];
  };
  if (Array.isArray(doc?.party)) doc.party.forEach(fixOne);
  if (Array.isArray(doc?.box)) doc.box.forEach(fixOne);
}

// Coerce any mapPosition.mapId left over from the retired 2D world (e.g.
// "bloom-town") or from a now-removed area onto the canonical start area, so a
// player never loads into a map that no longer exists. Runs on every load.
function migrateLegacyMapPosition(doc) {
  const pos = doc?.mapPosition;
  if (!pos) return false;
  if (typeof pos.mapId === "string" && MAP_NAMES.includes(pos.mapId)) return false;
  pos.mapId = START_POSITION.mapId;
  pos.x = START_POSITION.x;
  pos.y = START_POSITION.y;
  return true;
}

PlayerSchema.post("init", function () {
  migrateLegacyOrbInventory(this);
  migrateLegacyStatusArray(this);
  migrateLegacyMapPosition(this);
});

PlayerSchema.pre("save", function (next) {
  if (migrateLegacyOrbInventory(this)) this.markModified("inventory");
  if (migrateLegacyMapPosition(this)) this.markModified("mapPosition");
  next();
});

module.exports = mongoose.model("Player", PlayerSchema);
module.exports.EwamonInstanceSchema = EwamonInstanceSchema;
