const { EWAMON_SPECIES } = require("../data/ewamon");
const { MAP_INTERACTIONS } = require("../data/mapInteractions");
const {
  ensureExplorationState,
  buildPlayerExplorationPayload,
} = require("./explorationDirector");

const BASE_PROFILE_OPTIONS = {
  titles: [
    "Rookie Trainer",
    "Grass Scout",
    "Arena Regular",
    "Collection Keeper",
    "Trade Whisperer",
    "Badge Hunter",
    "Champion Aspirant",
    "Trail Walker",
    "League Vanguard",
    "Guildheart",
    "Ewa Archivist",
  ],
  palettes: ["forest", "sunset", "ocean", "midnight", "aurora", "ember"],
  frames: ["sprout", "bronze", "crystal", "royal", "champion", "obsidian"],
  flairs: ["spark", "leaf", "flame", "bolt", "tide", "crown"],
  backgroundThemes: ["frontier", "sunrise", "tidal", "starlit", "nebula", "prism", "volcanic", "champion"],
  accentColors: ["fern", "gold", "sky", "rose", "ember", "amethyst"],
  nameplateStyles: ["pixel", "ribbon", "league", "champion"],
  badgeLayouts: ["grid", "stack", "marquee", "trophy"],
  effectStyles: ["none", "sparkle", "scanline", "shimmer", "orbit", "glow", "aura"],
};

const GIFTABLE_ITEMS = ["potion", "spark_orb", "crest_orb"];
const EARLY_GAME_ZONES = new Set(["pallet_town", "route_1", "route_21"]);
const STARTER_ROOTS = new Set(["yahit", "fennorange", "resilian"]);

const VARIANT_PALETTES = {
  normal: null,
  dawn: { hue: 18, saturation: 1.08, lightness: 1.04 },
  dusk: { hue: 204, saturation: 1.1, lightness: 0.95 },
  verdant: { hue: 110, saturation: 1.12, lightness: 1.05 },
  ember: { hue: -18, saturation: 1.15, lightness: 1.02 },
};

const WEEKDAY_VARIANT_SCHEDULE = {
  1: ["dawn"],     // Monday
  2: ["dusk"],     // Tuesday
  3: ["verdant"],  // Wednesday
  4: ["ember"],    // Thursday
};

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SEASONAL_EVENTS = [
  {
    id: "starfall_surge",
    name: "Starfall Surge",
    description: "Celestial static sharpens rare encounters and emboldens alpha sightings near the ruins.",
    alphaBonus: 0.018,
    variantBonus: 0.03,
    featuredZones: ["victory_road", "cerulean_city"],
    featuredSpecies: ["raidori", "kygra", "alloylark"],
  },
  {
    id: "verdant_bloom",
    name: "Verdant Bloom",
    description: "The frontier canopy flares green. Early routes teem with colorful variants and fresh captures.",
    alphaBonus: 0.008,
    variantBonus: 0.04,
    featuredZones: ["pallet_town", "route_1", "route_2"],
    featuredSpecies: ["smellduck", "resilian", "budwing", "bramblecub", "nettlewisp"],
  },
  {
    id: "tideglass_festival",
    name: "Tideglass Festival",
    description: "Coastal routes glimmer with swarm activity and polished ocean-born variants.",
    alphaBonus: 0.012,
    variantBonus: 0.028,
    featuredZones: ["route_21", "cerulean_city"],
    featuredSpecies: ["glimfin", "shiveruff", "brookrawl", "kygra", "rimeidol"],
  },
];

const DAILY_SWARMS = [
  { id: "swarm-pallet",      zoneId: "pallet_town",   speciesIds: ["smellduck", "budwing", "resilian"] },
  { id: "swarm-route1",      zoneId: "route_1",        speciesIds: ["ampmite", "gustuff", "glimp"] },
  { id: "swarm-route21",     zoneId: "route_21",       speciesIds: ["shiveruff", "glimfin", "brookrawl"] },
  { id: "swarm-route2",      zoneId: "route_2",        speciesIds: ["nettlewisp", "hexroach", "pebblit"] },
  { id: "swarm-cerulean",    zoneId: "cerulean_city",  speciesIds: ["kygra", "glimfin", "raidori"] },
  { id: "swarm-safari",      zoneId: "safari_zone",    speciesIds: ["darkone", "serpyre", "coalette"] },
  { id: "swarm-victory",     zoneId: "victory_road",   speciesIds: ["raidori", "ripshell", "serpyre"] },
];

const WEEKLY_CUPS = [
  {
    id: "cup-no-duplicates",
    name: "Mirror Clause Cup",
    description: "No type may appear more than once across your full party.",
    ruleType: "no_duplicate_types",
    forceLevel: 50,
  },
  {
    id: "cup-starter-bond",
    name: "Starter Bond Cup",
    description: "Bring at least two Ewamon from the frontier starter lines.",
    ruleType: "starter_line_bonus",
    forceLevel: 50,
  },
  {
    id: "cup-zone-origin",
    name: "Origin Grounds Cup",
    description: "Bring at least three Ewamon caught in the featured frontier zone.",
    ruleType: "zone_origin_cup",
    forceLevel: 50,
    featuredZone: "route_2",
  },
  {
    id: "cup-mono-type",
    name: "Mono Pulse Cup",
    description: "Every party member must share at least one common type.",
    ruleType: "mono_type_cup",
    forceLevel: 50,
  },
];

const BEGINNER_DAILY_MISSIONS = [
  {
    id: "starter-catch",
    title: "Catch 1 Ewamon",
    metric: "dailyCatches",
    target: 1,
    reward: { items: { spark_orb: 1 } },
  },
  {
    id: "starter-heal",
    title: "Heal your party once",
    metric: "dailyHeals",
    target: 1,
    reward: { items: { potion: 1 } },
  },
  {
    id: "starter-trainer",
    title: "Win 1 trainer battle",
    metric: "dailyTrainerWins",
    target: 1,
    reward: { items: { crest_orb: 1 } },
  },
];

const STANDARD_DAILY_POOLS = {
  explore: [
    { id: "daily-zone-scout", title: "Visit 2 zones", metric: "dailyZoneVisits", target: 2, reward: { items: { potion: 1 } } },
    { id: "daily-map-scout", title: "Visit 2 maps", metric: "dailyMapVisits", target: 2, reward: { items: { spark_orb: 1 } } },
  ],
  catch: [
    { id: "daily-catch-two", title: "Catch 2 Ewamon", metric: "dailyCatches", target: 2, reward: { items: { spark_orb: 2 } } },
    { id: "daily-new-species", title: "Catch 1 new species", metric: "dailyNewSpeciesCaught", target: 1, reward: { items: { crest_orb: 1 } } },
  ],
  battle: [
    { id: "daily-trainer-win", title: "Win 1 trainer battle", metric: "dailyTrainerWins", target: 1, reward: { items: { potion: 1 } } },
    { id: "daily-cup-win", title: "Win 1 PvP or Cup battle", metric: "dailyCompetitiveWins", target: 1, reward: { items: { crest_orb: 1 } } },
  ],
  socialDex: [
    { id: "daily-gift", title: "Send 1 gift to a friend", metric: "dailyGiftsSent", target: 1, reward: { items: { potion: 1 } } },
    { id: "daily-sightings", title: "Register 2 new sightings", metric: "dailyNewSpeciesSeen", target: 2, reward: { items: { spark_orb: 1 } } },
  ],
};

const WEEKLY_GOALS = [
  {
    id: "weekly-frontier-haul",
    title: "Catch 5 Ewamon this week",
    metric: "weeklyCatches",
    target: 5,
    reward: { items: { crest_orb: 2, potion: 2 } },
  },
  {
    id: "weekly-challenger",
    title: "Win 2 rematches or 1 league fight",
    metric: "weeklyLeagueRematchScore",
    target: 2,
    reward: { items: { prism_orb: 1, superpotion: 1 } },
  },
  {
    id: "weekly-competitive",
    title: "Win 3 PvP or Cup battles",
    metric: "weeklyCompetitiveWins",
    target: 3,
    reward: { items: { prism_orb: 2 } },
  },
];

const STARTER_SPRINT = [
  { id: "catch-first", title: "Catch your first wild Ewamon", metric: "lifetimeCatches", target: 1 },
  { id: "heal-once", title: "Heal your team once", metric: "lifetimeHeals", target: 1 },
  { id: "trainer-win", title: "Win a trainer fight", metric: "lifetimeTrainerWins", target: 1 },
  { id: "visit-league", title: "Visit the league ladder", metric: "lifetimeLeagueVisits", target: 1 },
  { id: "daily-complete", title: "Complete any daily mission", metric: "lifetimeDailyMissionCompletions", target: 1 },
];

const CUP_MILESTONES = [
  { wins: 3, reward: { items: { crest_orb: 2 }, profileBadge: "Cup Scout" } },
  { wins: 7, reward: { items: { prism_orb: 2 }, flair: "tide" } },
  { wins: 12, reward: { items: { rarecandy: 1 }, frame: "champion" } },
];

const MASTERY_CHAINS = {
  collector: {
    label: "Collector",
    levels: [
      { threshold: 3, reward: { title: "Grass Scout" } },
      { threshold: 8, reward: { title: "Collection Keeper" } },
      { threshold: 16, reward: { profileBadge: "Field Collector" } },
      { threshold: 28, reward: { profileBadge: "Variant Warden" } },
      { threshold: 40, reward: { title: "Ewa Archivist" } },
    ],
  },
  explorer: {
    label: "Explorer",
    levels: [
      { threshold: 2, reward: { palette: "aurora" } },
      { threshold: 4, reward: { palette: "ember" } },
      { threshold: 5, reward: { profileBadge: "Trail Seeker", backgroundTheme: "starlit" } },
      { threshold: 7, reward: { profileBadge: "Frontier Mapper", accentColor: "sky", effectStyle: "shimmer" } },
      { threshold: 9, reward: { title: "Trail Walker" } },
    ],
  },
  battler: {
    label: "Battler",
    levels: [
      { threshold: 5, reward: { flair: "tide" } },
      { threshold: 12, reward: { flair: "crown", effectStyle: "glow" } },
      { threshold: 25, reward: { frame: "champion", nameplateStyle: "league" } },
      { threshold: 45, reward: { frame: "obsidian", backgroundTheme: "prism" } },
      { threshold: 70, reward: { title: "Badge Hunter" } },
    ],
  },
  league: {
    label: "League",
    levels: [
      { threshold: 1, reward: { title: "Champion Aspirant" } },
      { threshold: 3, reward: { title: "League Vanguard" } },
      { threshold: 6, reward: { frame: "champion", badgeLayout: "marquee" } },
      { threshold: 10, reward: { flair: "crown", accentColor: "amethyst", backgroundTheme: "nebula" } },
      { threshold: 16, reward: { profileBadge: "Champion Circuit", backgroundTheme: "champion", nameplateStyle: "champion", badgeLayout: "trophy", effectStyle: "aura" } },
    ],
  },
  social: {
    label: "Social",
    levels: [
      { threshold: 1, reward: { title: "Trade Whisperer" } },
      { threshold: 5, reward: { title: "Guildheart" } },
      { threshold: 12, reward: { ribbonUnlock: "Social Star", accentColor: "rose" } },
      { threshold: 20, reward: { profileBadge: "Friend Bond", backgroundTheme: "sunrise" } },
      { threshold: 35, reward: { profileBadge: "Kindred Circle" } },
    ],
  },
};

function toUtcDate(value = new Date()) {
  return value instanceof Date ? value : new Date(value);
}

function getDayIndex(now = new Date()) {
  const date = toUtcDate(now);
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
}

function getDailyResetKey(now = new Date()) {
  const date = toUtcDate(now);
  return date.toISOString().slice(0, 10);
}

function getWeeklyResetKey(now = new Date()) {
  const date = toUtcDate(now);
  const weekday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - weekday));
  return monday.toISOString().slice(0, 10);
}

function getNextDailyResetAt(now = new Date()) {
  const date = toUtcDate(now);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)).toISOString();
}

function getNextWeeklyResetAt(now = new Date()) {
  const date = toUtcDate(now);
  const weekday = (date.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + (7 - weekday))).toISOString();
}

function cloneObject(value, fallback) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...fallback };
  return value;
}

function pushUnique(list, value) {
  const normalized = Array.isArray(list) ? list : [];
  if (!normalized.includes(value)) normalized.push(value);
  return normalized;
}

function incCounter(bucket, key, amount = 1) {
  if (!bucket || !key) return;
  bucket[key] = Number(bucket[key] || 0) + amount;
}

function getCounter(bucket, key) {
  return Number(bucket?.[key] || 0);
}

function getEvolutionRoot(speciesId) {
  let current = speciesId;
  let safety = 0;
  while (EWAMON_SPECIES[current]?.evolvesFrom && safety < 8) {
    current = EWAMON_SPECIES[current].evolvesFrom;
    safety += 1;
  }
  return current;
}

function getFeaturedRematchIds(now = new Date()) {
  const trainerIds = MAP_INTERACTIONS.filter(entry => entry.type === "trainer").map(entry => entry.id);
  if (!trainerIds.length) return [];
  const weekIndex = Math.floor(getDayIndex(now) / 7);
  const first = trainerIds[weekIndex % trainerIds.length];
  const second = trainerIds[(weekIndex + 3) % trainerIds.length];
  return [...new Set([first, second])];
}

function getActiveSeasonalEvent(now = new Date()) {
  return SEASONAL_EVENTS[Math.floor(getDayIndex(now) / 7) % SEASONAL_EVENTS.length];
}

function getActiveSwarm(now = new Date()) {
  return DAILY_SWARMS[getDayIndex(now) % DAILY_SWARMS.length];
}

function getActiveWeeklyCup(now = new Date()) {
  const base = WEEKLY_CUPS[Math.floor(getDayIndex(now) / 7) % WEEKLY_CUPS.length];
  const swarm = getActiveSwarm(now);
  if (base.ruleType === "zone_origin_cup") {
    return {
      ...base,
      featuredZone: base.featuredZone || swarm.zoneId,
    };
  }
  return base;
}

function ensureLiveOpsState(player, now = new Date()) {
  const dailyKey = getDailyResetKey(now);
  const weeklyKey = getWeeklyResetKey(now);

  player.liveOps = cloneObject(player.liveOps, {});
  player.liveOps.dailyStats = cloneObject(player.liveOps.dailyStats, {});
  player.liveOps.weeklyStats = cloneObject(player.liveOps.weeklyStats, {});
  player.liveOps.lifetimeStats = cloneObject(player.liveOps.lifetimeStats, {});
  player.liveOps.dailyMissionClaims = Array.isArray(player.liveOps.dailyMissionClaims) ? player.liveOps.dailyMissionClaims : [];
  player.liveOps.weeklyGoalClaims = Array.isArray(player.liveOps.weeklyGoalClaims) ? player.liveOps.weeklyGoalClaims : [];
  player.liveOps.cupMilestoneClaims = Array.isArray(player.liveOps.cupMilestoneClaims) ? player.liveOps.cupMilestoneClaims : [];
  player.liveOps.starterSprintCompleted = Array.isArray(player.liveOps.starterSprintCompleted) ? player.liveOps.starterSprintCompleted : [];
  player.liveOps.dailyVisitedZones = Array.isArray(player.liveOps.dailyVisitedZones) ? player.liveOps.dailyVisitedZones : [];
  player.liveOps.weeklyVisitedZones = Array.isArray(player.liveOps.weeklyVisitedZones) ? player.liveOps.weeklyVisitedZones : [];
  player.liveOps.dailyVisitedMaps = Array.isArray(player.liveOps.dailyVisitedMaps) ? player.liveOps.dailyVisitedMaps : [];
  player.liveOps.weeklyVisitedMaps = Array.isArray(player.liveOps.weeklyVisitedMaps) ? player.liveOps.weeklyVisitedMaps : [];
  player.liveOps.variantSeen = Array.isArray(player.liveOps.variantSeen) ? player.liveOps.variantSeen : [];
  player.liveOps.variantCaught = Array.isArray(player.liveOps.variantCaught) ? player.liveOps.variantCaught : [];
  player.liveOps.allVisitedZones = Array.isArray(player.liveOps.allVisitedZones) ? player.liveOps.allVisitedZones : [];
  player.liveOps.allVisitedMaps = Array.isArray(player.liveOps.allVisitedMaps) ? player.liveOps.allVisitedMaps : [];
  ensureExplorationState(player);

  player.achievementState = cloneObject(player.achievementState, {});
  player.achievementState.masteryClaims = Array.isArray(player.achievementState.masteryClaims) ? player.achievementState.masteryClaims : [];

  player.unlockState = cloneObject(player.unlockState, {});
  player.unlockState.titles = Array.isArray(player.unlockState.titles) ? player.unlockState.titles : ["Rookie Trainer"];
  player.unlockState.palettes = Array.isArray(player.unlockState.palettes) ? player.unlockState.palettes : ["forest", "sunset", "ocean", "midnight"];
  player.unlockState.frames = Array.isArray(player.unlockState.frames) ? player.unlockState.frames : ["sprout", "bronze", "crystal", "royal"];
  player.unlockState.flairs = Array.isArray(player.unlockState.flairs) ? player.unlockState.flairs : ["spark", "leaf", "flame", "bolt"];
  player.unlockState.backgroundThemes = Array.isArray(player.unlockState.backgroundThemes) ? player.unlockState.backgroundThemes : ["frontier", "sunrise", "tidal", "starlit", "nebula"];
  player.unlockState.accentColors = Array.isArray(player.unlockState.accentColors) ? player.unlockState.accentColors : ["fern", "gold", "sky", "rose"];
  player.unlockState.nameplateStyles = Array.isArray(player.unlockState.nameplateStyles) ? player.unlockState.nameplateStyles : ["pixel", "ribbon", "league"];
  player.unlockState.badgeLayouts = Array.isArray(player.unlockState.badgeLayouts) ? player.unlockState.badgeLayouts : ["grid", "stack"];
  player.unlockState.effectStyles = Array.isArray(player.unlockState.effectStyles) ? player.unlockState.effectStyles : ["none", "sparkle", "scanline", "shimmer"];
  player.unlockState.profileBadges = Array.isArray(player.unlockState.profileBadges) ? player.unlockState.profileBadges : [];
  player.unlockState.ribbons = Array.isArray(player.unlockState.ribbons) ? player.unlockState.ribbons : [];

  player.socialBonusState = cloneObject(player.socialBonusState, {});
  player.rematchState = cloneObject(player.rematchState, {});
  player.recentRewardLog = Array.isArray(player.recentRewardLog) ? player.recentRewardLog : [];

  if (player.liveOps.dailyKey !== dailyKey) {
    player.liveOps.dailyKey = dailyKey;
    player.liveOps.dailyStats = {};
    player.liveOps.dailyMissionClaims = [];
    player.liveOps.dailyVisitedZones = [];
    player.liveOps.dailyVisitedMaps = [];
    player.liveOps.dailyBoardCleared = false;
    player.socialBonusState.dailyKey = dailyKey;
    player.socialBonusState.giftsSentToday = 0;
    player.socialBonusState.friendBattleBonusClaimed = false;
    player.rematchState.dailyKey = dailyKey;
    player.rematchState.usedTrainerIds = [];
  }

  if (player.liveOps.weeklyKey !== weeklyKey) {
    player.liveOps.weeklyKey = weeklyKey;
    player.liveOps.weeklyStats = {};
    player.liveOps.weeklyGoalClaims = [];
    player.liveOps.weeklyVisitedZones = [];
    player.liveOps.weeklyVisitedMaps = [];
    player.liveOps.weeklyBoardCleared = false;
    player.liveOps.cupMilestoneClaims = [];
  }

  return player;
}

function markLiveOpsModified(player) {
  if (!player?.markModified) return;
  [
    "liveOps",
    "achievementState",
    "unlockState",
    "socialBonusState",
    "rematchState",
    "recentRewardLog",
  ].forEach(path => player.markModified(path));
}

function getProfileOptions(player) {
  ensureLiveOpsState(player);
  return {
    titles: BASE_PROFILE_OPTIONS.titles.filter(value => player.unlockState.titles.includes(value)),
    palettes: BASE_PROFILE_OPTIONS.palettes.filter(value => player.unlockState.palettes.includes(value)),
    frames: BASE_PROFILE_OPTIONS.frames.filter(value => player.unlockState.frames.includes(value)),
    flairs: BASE_PROFILE_OPTIONS.flairs.filter(value => player.unlockState.flairs.includes(value)),
    backgroundThemes: BASE_PROFILE_OPTIONS.backgroundThemes.filter(value => player.unlockState.backgroundThemes.includes(value)),
    accentColors: BASE_PROFILE_OPTIONS.accentColors.filter(value => player.unlockState.accentColors.includes(value)),
    nameplateStyles: BASE_PROFILE_OPTIONS.nameplateStyles.filter(value => player.unlockState.nameplateStyles.includes(value)),
    badgeLayouts: BASE_PROFILE_OPTIONS.badgeLayouts.filter(value => player.unlockState.badgeLayouts.includes(value)),
    effectStyles: BASE_PROFILE_OPTIONS.effectStyles.filter(value => player.unlockState.effectStyles.includes(value)),
    profileBadges: [...player.unlockState.profileBadges],
    ribbons: [...player.unlockState.ribbons],
  };
}

function buildRewardSummary(reward = {}) {
  const parts = [];
  if (reward.money) parts.push(`${reward.money}G`);
  Object.entries(reward.items || {}).forEach(([itemId, quantity]) => parts.push(`${quantity}x ${itemId.replace(/_/g, " ")}`));
  ["title", "palette", "frame", "flair", "profileBadge", "ribbonUnlock"].forEach(key => {
    if (reward[key]) parts.push(reward[key]);
  });
  ["backgroundTheme", "accentColor", "nameplateStyle", "badgeLayout", "effectStyle"].forEach(key => {
    if (reward[key]) parts.push(reward[key]);
  });
  return parts.join(", ");
}

function addItems(player, items = {}) {
  if (!items || typeof items !== "object") return;
  if (!(player.inventory instanceof Map)) {
    player.inventory = new Map(Object.entries(player.inventory || {}));
  }
  Object.entries(items).forEach(([itemId, quantity]) => {
    if (!quantity) return;
    player.inventory.set(itemId, Number(player.inventory.get(itemId) || 0) + Number(quantity));
  });
}

function grantReward(player, reward, sourceLabel, now = new Date()) {
  if (!reward || typeof reward !== "object") return null;
  ensureLiveOpsState(player, now);
  if (reward.money) player.money = Number(player.money || 0) + Number(reward.money);
  addItems(player, reward.items);
  if (reward.title) pushUnique(player.unlockState.titles, reward.title);
  if (reward.palette) pushUnique(player.unlockState.palettes, reward.palette);
  if (reward.frame) pushUnique(player.unlockState.frames, reward.frame);
  if (reward.flair) pushUnique(player.unlockState.flairs, reward.flair);
  if (reward.backgroundTheme) pushUnique(player.unlockState.backgroundThemes, reward.backgroundTheme);
  if (reward.accentColor) pushUnique(player.unlockState.accentColors, reward.accentColor);
  if (reward.nameplateStyle) pushUnique(player.unlockState.nameplateStyles, reward.nameplateStyle);
  if (reward.badgeLayout) pushUnique(player.unlockState.badgeLayouts, reward.badgeLayout);
  if (reward.effectStyle) pushUnique(player.unlockState.effectStyles, reward.effectStyle);
  if (reward.profileBadge) pushUnique(player.unlockState.profileBadges, reward.profileBadge);
  if (reward.ribbonUnlock) pushUnique(player.unlockState.ribbons, reward.ribbonUnlock);

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: sourceLabel,
    summary: buildRewardSummary(reward),
    reward,
    createdAt: new Date(now).toISOString(),
  };
  player.recentRewardLog = [entry, ...(player.recentRewardLog || [])].slice(0, 20);
  markLiveOpsModified(player);
  return entry;
}

function getMetricValue(player, metric) {
  ensureLiveOpsState(player);
  switch (metric) {
    case "dailyCatches":
      return getCounter(player.liveOps.dailyStats, "catches");
    case "dailyHeals":
      return getCounter(player.liveOps.dailyStats, "heals");
    case "dailyTrainerWins":
      return getCounter(player.liveOps.dailyStats, "trainerWins");
    case "dailyZoneVisits":
      return player.liveOps.dailyVisitedZones.length;
    case "dailyMapVisits":
      return player.liveOps.dailyVisitedMaps.length;
    case "dailyNewSpeciesCaught":
      return getCounter(player.liveOps.dailyStats, "newSpeciesCaught");
    case "dailyCompetitiveWins":
      return getCounter(player.liveOps.dailyStats, "pvpWins") + getCounter(player.liveOps.dailyStats, "cupWins");
    case "dailyGiftsSent":
      return getCounter(player.liveOps.dailyStats, "giftsSent");
    case "dailyNewSpeciesSeen":
      return getCounter(player.liveOps.dailyStats, "newSpeciesSeen");
    case "weeklyCatches":
      return getCounter(player.liveOps.weeklyStats, "catches");
    case "weeklyLeagueRematchScore":
      return getCounter(player.liveOps.weeklyStats, "rematchWins") + (getCounter(player.liveOps.weeklyStats, "leagueWins") * 2);
    case "weeklyCompetitiveWins":
      return getCounter(player.liveOps.weeklyStats, "pvpWins") + getCounter(player.liveOps.weeklyStats, "cupWins");
    case "lifetimeCatches":
      return getCounter(player.liveOps.lifetimeStats, "catches");
    case "lifetimeHeals":
      return getCounter(player.liveOps.lifetimeStats, "heals");
    case "lifetimeTrainerWins":
      return getCounter(player.liveOps.lifetimeStats, "trainerWins");
    case "lifetimeLeagueVisits":
      return getCounter(player.liveOps.lifetimeStats, "leagueVisits");
    case "lifetimeDailyMissionCompletions":
      return getCounter(player.liveOps.lifetimeStats, "dailyMissionCompletions");
    default:
      return 0;
  }
}

function selectRotatingEntry(pool, offset) {
  if (!Array.isArray(pool) || !pool.length) return null;
  return pool[offset % pool.length];
}

function buildDailyMissionBoard(player, now = new Date()) {
  ensureLiveOpsState(player, now);
  const beginnerBoard = !player.onboarding?.tutorialCompleted || Number(player.trainerLevel || 1) < 8;
  const dayIndex = getDayIndex(now);
  const missions = beginnerBoard
    ? BEGINNER_DAILY_MISSIONS
    : [
        selectRotatingEntry(STANDARD_DAILY_POOLS.explore, dayIndex),
        selectRotatingEntry(STANDARD_DAILY_POOLS.catch, dayIndex + 1),
        selectRotatingEntry(STANDARD_DAILY_POOLS.battle, dayIndex + 2),
        selectRotatingEntry(STANDARD_DAILY_POOLS.socialDex, dayIndex + 3),
      ].filter(Boolean);

  return missions.map(mission => {
    const progress = Math.min(mission.target, getMetricValue(player, mission.metric));
    return {
      ...mission,
      cadence: "daily",
      progress,
      completed: progress >= mission.target,
      claimed: player.liveOps.dailyMissionClaims.includes(mission.id),
    };
  });
}

function buildWeeklyGoalBoard(player, now = new Date()) {
  ensureLiveOpsState(player, now);
  return WEEKLY_GOALS.map(goal => {
    const progress = Math.min(goal.target, getMetricValue(player, goal.metric));
    return {
      ...goal,
      cadence: "weekly",
      progress,
      completed: progress >= goal.target,
      claimed: player.liveOps.weeklyGoalClaims.includes(goal.id),
    };
  });
}

function buildStarterSprintBoard(player) {
  ensureLiveOpsState(player);
  return STARTER_SPRINT.map(item => {
    const progress = Math.min(item.target, getMetricValue(player, item.metric));
    return {
      ...item,
      progress,
      completed: player.liveOps.starterSprintCompleted.includes(item.id) || progress >= item.target,
    };
  });
}

function getMasteryProgress(player, chainId) {
  ensureLiveOpsState(player);
  switch (chainId) {
    case "collector":
      return player.collection?.length || 0;
    case "explorer":
      return player.liveOps.allVisitedZones.length + Math.floor(getCounter(player.liveOps.lifetimeStats, "mapVisits") / 3);
    case "battler":
      return getCounter(player.liveOps.lifetimeStats, "trainerWins") + getCounter(player.liveOps.lifetimeStats, "pvpWins") + getCounter(player.liveOps.lifetimeStats, "cupWins");
    case "league":
      return (player.leagueProgress?.defeatedTrainerIds || []).length + (getCounter(player.liveOps.lifetimeStats, "rematchWins") * 2);
    case "social":
      return getCounter(player.liveOps.lifetimeStats, "giftsSent") + getCounter(player.liveOps.lifetimeStats, "friendBattles") + Math.floor(((player.tradeHistory || []).length || 0) / 2);
    default:
      return 0;
  }
}

function buildMasteryChains(player) {
  ensureLiveOpsState(player);
  return Object.entries(MASTERY_CHAINS).map(([id, chain]) => {
    const progress = getMasteryProgress(player, id);
    const claimed = player.achievementState.masteryClaims.filter(entry => entry.startsWith(`${id}:`));
    const level = claimed.length;
    const nextLevel = chain.levels[level] || null;
    return {
      id,
      label: chain.label,
      level,
      progress,
      nextTarget: nextLevel?.threshold ?? null,
      maxLevel: chain.levels.length,
      rewards: chain.levels.map((entry, index) => ({
        level: index + 1,
        threshold: entry.threshold,
        reward: entry.reward,
        claimed: player.achievementState.masteryClaims.includes(`${id}:${index + 1}`),
      })),
    };
  });
}

function evaluateMissionRewards(player, now = new Date()) {
  const newRewards = [];
  const dailyBoard = buildDailyMissionBoard(player, now);
  dailyBoard.forEach(mission => {
    if (mission.completed && !mission.claimed) {
      pushUnique(player.liveOps.dailyMissionClaims, mission.id);
      incCounter(player.liveOps.lifetimeStats, "dailyMissionCompletions");
      const rewardEntry = grantReward(player, mission.reward, `Daily Mission: ${mission.title}`, now);
      if (rewardEntry) newRewards.push(rewardEntry);
    }
  });

  if (!player.liveOps.dailyBoardCleared && dailyBoard.length && dailyBoard.every(mission => mission.completed)) {
    player.liveOps.dailyBoardCleared = true;
    incCounter(player.liveOps.lifetimeStats, "dailyBoardsCleared");
  }

  const weeklyGoals = buildWeeklyGoalBoard(player, now);
  weeklyGoals.forEach(goal => {
    if (goal.completed && !goal.claimed) {
      pushUnique(player.liveOps.weeklyGoalClaims, goal.id);
      incCounter(player.liveOps.lifetimeStats, "weeklyGoalCompletions");
      const rewardEntry = grantReward(player, goal.reward, `Weekly Goal: ${goal.title}`, now);
      if (rewardEntry) newRewards.push(rewardEntry);
    }
  });

  if (!player.liveOps.weeklyBoardCleared && weeklyGoals.length && weeklyGoals.every(goal => goal.completed)) {
    player.liveOps.weeklyBoardCleared = true;
    incCounter(player.liveOps.lifetimeStats, "weeklyBoardsCleared");
  }

  return newRewards;
}

function evaluateStarterSprint(player, now = new Date()) {
  const newRewards = [];
  const board = buildStarterSprintBoard(player);
  board.forEach(item => {
    if (item.progress >= item.target && !player.liveOps.starterSprintCompleted.includes(item.id)) {
      pushUnique(player.liveOps.starterSprintCompleted, item.id);
    }
  });

  if (
    board.length
    && board.every(item => player.liveOps.starterSprintCompleted.includes(item.id))
    && !player.liveOps.starterSprintRewarded
  ) {
    player.liveOps.starterSprintRewarded = true;
    const rewardEntry = grantReward(player, { title: "Trail Walker", profileBadge: "Starter Sprint" }, "Starter Sprint", now);
    if (rewardEntry) newRewards.push(rewardEntry);
  }
  return newRewards;
}

function evaluateCupMilestones(player, now = new Date()) {
  const newRewards = [];
  CUP_MILESTONES.forEach(milestone => {
    const claimKey = String(milestone.wins);
    if (getCounter(player.liveOps.weeklyStats, "cupWins") >= milestone.wins && !player.liveOps.cupMilestoneClaims.includes(claimKey)) {
      pushUnique(player.liveOps.cupMilestoneClaims, claimKey);
      const rewardEntry = grantReward(player, milestone.reward, `Weekly Cup ${milestone.wins} Wins`, now);
      if (rewardEntry) newRewards.push(rewardEntry);
    }
  });
  return newRewards;
}

function evaluateMasteryRewards(player, now = new Date()) {
  const newRewards = [];
  Object.entries(MASTERY_CHAINS).forEach(([id, chain]) => {
    const progress = getMasteryProgress(player, id);
    chain.levels.forEach((level, index) => {
      const claimKey = `${id}:${index + 1}`;
      if (progress >= level.threshold && !player.achievementState.masteryClaims.includes(claimKey)) {
        pushUnique(player.achievementState.masteryClaims, claimKey);
        const rewardEntry = grantReward(player, level.reward, `${chain.label} Mastery ${index + 1}`, now);
        if (rewardEntry) newRewards.push(rewardEntry);
      }
    });
  });
  return newRewards;
}

function trackZoneVisit(player, zoneId) {
  if (!zoneId) return;
  if (!player.liveOps.dailyVisitedZones.includes(zoneId)) {
    player.liveOps.dailyVisitedZones.push(zoneId);
  }
  if (!player.liveOps.weeklyVisitedZones.includes(zoneId)) {
    player.liveOps.weeklyVisitedZones.push(zoneId);
  }
  if (!player.liveOps.allVisitedZones.includes(zoneId)) {
    player.liveOps.allVisitedZones.push(zoneId);
  }
}

function trackMapVisit(player, mapId) {
  if (mapId === undefined || mapId === null) return;
  const key = String(mapId);
  if (!player.liveOps.dailyVisitedMaps.includes(key)) {
    player.liveOps.dailyVisitedMaps.push(key);
    incCounter(player.liveOps.dailyStats, "mapVisits");
  }
  if (!player.liveOps.weeklyVisitedMaps.includes(key)) {
    player.liveOps.weeklyVisitedMaps.push(key);
    incCounter(player.liveOps.weeklyStats, "mapVisits");
  }
  if (!player.liveOps.allVisitedMaps.includes(key)) {
    player.liveOps.allVisitedMaps.push(key);
    incCounter(player.liveOps.lifetimeStats, "mapVisits");
  }
}

function buildVariantDexKey({ speciesId, variantKey = "normal", isAlpha = false }) {
  return `${speciesId}:${variantKey}:${isAlpha ? "alpha" : "base"}`;
}

function applyLiveOpsEvent(player, eventType, payload = {}, now = new Date()) {
  ensureLiveOpsState(player, now);
  const beforeRewardCount = player.recentRewardLog.length;

  switch (eventType) {
    case "zone_visit":
      trackZoneVisit(player, payload.zoneId);
      break;
    case "map_visit":
      trackMapVisit(player, payload.mapId);
      break;
    case "see_species":
      if (payload.newSpeciesSeen) {
        incCounter(player.liveOps.dailyStats, "newSpeciesSeen");
        incCounter(player.liveOps.weeklyStats, "newSpeciesSeen");
        incCounter(player.liveOps.lifetimeStats, "newSpeciesSeen");
      }
      if (payload.zoneId) trackZoneVisit(player, payload.zoneId);
      if (payload.mapId !== undefined) trackMapVisit(player, payload.mapId);
      if (payload.speciesId) {
        pushUnique(player.liveOps.variantSeen, buildVariantDexKey(payload));
      }
      break;
    case "catch":
      incCounter(player.liveOps.dailyStats, "catches");
      incCounter(player.liveOps.weeklyStats, "catches");
      incCounter(player.liveOps.lifetimeStats, "catches");
      if (payload.newSpeciesCaught) {
        incCounter(player.liveOps.dailyStats, "newSpeciesCaught");
        incCounter(player.liveOps.weeklyStats, "newSpeciesCaught");
      }
      if (payload.variantKey && payload.variantKey !== "normal") {
        incCounter(player.liveOps.lifetimeStats, "variantCaught");
      }
      if (payload.isAlpha) {
        incCounter(player.liveOps.lifetimeStats, "alphaCaught");
      }
      if (payload.zoneId) trackZoneVisit(player, payload.zoneId);
      if (payload.mapId !== undefined) trackMapVisit(player, payload.mapId);
      if (payload.speciesId) {
        pushUnique(player.liveOps.variantCaught, buildVariantDexKey(payload));
      }
      break;
    case "heal":
      incCounter(player.liveOps.dailyStats, "heals");
      incCounter(player.liveOps.weeklyStats, "heals");
      incCounter(player.liveOps.lifetimeStats, "heals");
      break;
    case "league_visit":
      incCounter(player.liveOps.lifetimeStats, "leagueVisits");
      break;
    case "trainer_win":
      incCounter(player.liveOps.dailyStats, "trainerWins");
      incCounter(player.liveOps.weeklyStats, "trainerWins");
      incCounter(player.liveOps.lifetimeStats, "trainerWins");
      if (payload.isRematch) {
        incCounter(player.liveOps.dailyStats, "rematchWins");
        incCounter(player.liveOps.weeklyStats, "rematchWins");
        incCounter(player.liveOps.lifetimeStats, "rematchWins");
      }
      if (payload.isLeague) {
        incCounter(player.liveOps.weeklyStats, "leagueWins");
        incCounter(player.liveOps.lifetimeStats, "leagueWins");
      }
      if (payload.zoneId) trackZoneVisit(player, payload.zoneId);
      break;
    case "pvp_win":
      if (payload.mode === "cup") {
        incCounter(player.liveOps.dailyStats, "cupWins");
        incCounter(player.liveOps.weeklyStats, "cupWins");
        incCounter(player.liveOps.lifetimeStats, "cupWins");
      } else {
        incCounter(player.liveOps.dailyStats, "pvpWins");
        incCounter(player.liveOps.weeklyStats, "pvpWins");
        incCounter(player.liveOps.lifetimeStats, "pvpWins");
      }
      break;
    case "friend_battle_complete":
      incCounter(player.liveOps.lifetimeStats, "friendBattles");
      if (!player.socialBonusState.friendBattleBonusClaimed) {
        player.socialBonusState.friendBattleBonusClaimed = true;
        grantReward(player, { items: { potion: 1 }, profileBadge: "Friend Spar" }, "Daily Friend Battle Bonus", now);
      }
      break;
    case "gift_sent":
      incCounter(player.liveOps.dailyStats, "giftsSent");
      incCounter(player.liveOps.weeklyStats, "giftsSent");
      incCounter(player.liveOps.lifetimeStats, "giftsSent");
      player.socialBonusState.giftsSentToday = Number(player.socialBonusState.giftsSentToday || 0) + Number(payload.quantity || 1);
      break;
    default:
      break;
  }

  const rewardEntries = [
    ...evaluateMissionRewards(player, now),
    ...evaluateStarterSprint(player, now),
    ...evaluateCupMilestones(player, now),
    ...evaluateMasteryRewards(player, now),
  ];

  markLiveOpsModified(player);
  return {
    rewardEntries: rewardEntries.length
      ? rewardEntries
      : player.recentRewardLog.slice(0, Math.max(0, player.recentRewardLog.length - beforeRewardCount)),
    summary: buildCompactLiveOpsSummary(player, now),
  };
}

function isTrainerEligibleForRematch(player, trainerId, now = new Date()) {
  ensureLiveOpsState(player, now);
  return !((player.rematchState.usedTrainerIds || []).includes(trainerId));
}

function markTrainerRematchUsed(player, trainerId, now = new Date()) {
  ensureLiveOpsState(player, now);
  pushUnique(player.rematchState.usedTrainerIds, trainerId);
  markLiveOpsModified(player);
}

function buildRematchBoard(player, now = new Date()) {
  ensureLiveOpsState(player, now);
  const featuredIds = new Set(getFeaturedRematchIds(now));
  const defeatedIds = new Set(player.defeatedMapEvents || []);
  return MAP_INTERACTIONS
    .filter(entry => entry.type === "trainer" && defeatedIds.has(entry.id))
    .map(entry => ({
      id: entry.id,
      title: entry.title,
      available: isTrainerEligibleForRematch(player, entry.id, now),
      featured: featuredIds.has(entry.id),
      rewardMoney: entry.rewardMoney || 0,
    }));
}

function buildCompactLiveOpsSummary(player, now = new Date()) {
  ensureLiveOpsState(player, now);
  const exploration = buildPlayerExplorationPayload(player, now);
  const daily = buildDailyMissionBoard(player, now);
  const weekly = buildWeeklyGoalBoard(player, now);
  const starterSprint = buildStarterSprintBoard(player);
  return {
    daily: {
      completed: daily.filter(item => item.completed).length,
      total: daily.length,
      missions: daily.map(item => ({
        id: item.id,
        title: item.title,
        progress: item.progress,
        target: item.target,
        completed: item.completed,
      })),
    },
    weekly: {
      completed: weekly.filter(item => item.completed).length,
      total: weekly.length,
      goals: weekly.map(item => ({
        id: item.id,
        title: item.title,
        progress: item.progress,
        target: item.target,
        completed: item.completed,
      })),
    },
    starterSprint: {
      completed: starterSprint.filter(item => item.completed).length,
      total: starterSprint.length,
      items: starterSprint,
    },
    activeEvent: getActiveSeasonalEvent(now),
    activeSwarm: getActiveSwarm(now),
    weeklyCup: getActiveWeeklyCup(now),
    giftsRemaining: Math.max(0, 3 - Number(player.socialBonusState.giftsSentToday || 0)),
    friendBattleBonusClaimed: Boolean(player.socialBonusState.friendBattleBonusClaimed),
    rewardLog: (player.recentRewardLog || []).slice(0, 5),
    unlocks: getProfileOptions(player),
    nextDailyResetAt: getNextDailyResetAt(now),
    nextWeeklyResetAt: getNextWeeklyResetAt(now),
    featuredZones: exploration.featuredZones,
    currentZoneThreat: exploration.currentZoneThreat,
    currentZoneHeat: exploration.currentZoneHeat,
    roamingRare: exploration.roamingRare,
    activeRaids: exploration.activeRaids,
    nextWorldRotationAt: exploration.nextWorldRotationAt,
    nextRaidRotationAt: exploration.nextRaidRotationAt,
  };
}

function buildLiveOpsPayload(player, now = new Date()) {
  ensureLiveOpsState(player, now);
  const exploration = buildPlayerExplorationPayload(player, now);
  return {
    summary: buildCompactLiveOpsSummary(player, now),
    dailyMissions: buildDailyMissionBoard(player, now),
    weeklyGoals: buildWeeklyGoalBoard(player, now),
    starterSprint: buildStarterSprintBoard(player),
    masteryChains: buildMasteryChains(player),
    rematches: buildRematchBoard(player, now),
    recentRewardLog: player.recentRewardLog || [],
    activeEvent: getActiveSeasonalEvent(now),
    activeSwarm: getActiveSwarm(now),
    dailySpawnInfo: buildDailySpawnInfo(now),
    weeklyCup: {
      ...getActiveWeeklyCup(now),
      wins: getCounter(player.liveOps.weeklyStats, "cupWins"),
      milestones: CUP_MILESTONES.map(entry => ({
        wins: entry.wins,
        reward: entry.reward,
        claimed: player.liveOps.cupMilestoneClaims.includes(String(entry.wins)),
      })),
    },
    unlocks: getProfileOptions(player),
    featuredRematchIds: getFeaturedRematchIds(now),
    variantDex: {
      seen: player.liveOps.variantSeen || [],
      caught: player.liveOps.variantCaught || [],
    },
    nextDailyResetAt: getNextDailyResetAt(now),
    nextWeeklyResetAt: getNextWeeklyResetAt(now),
    worldState: exploration.worldState,
    featuredZones: exploration.featuredZones,
    currentZoneThreat: exploration.currentZoneThreat,
    currentZoneHeat: exploration.currentZoneHeat,
    activeHotspots: exploration.activeHotspots,
    roamingRare: exploration.roamingRare,
    activeRaids: exploration.activeRaids,
    nextWorldRotationAt: exploration.nextWorldRotationAt,
    nextRaidRotationAt: exploration.nextRaidRotationAt,
  };
}

function getVariantPalette(variantKey = "normal") {
  return VARIANT_PALETTES[variantKey] || null;
}

function getWildVariantPool(now = new Date()) {
  const day = now.getDay();
  const allVariants = Object.keys(VARIANT_PALETTES).filter(key => key !== "normal");
  if (day === 0 || day === 5 || day === 6) return allVariants;
  return WEEKDAY_VARIANT_SCHEDULE[day] || [];
}

function buildDailySpawnInfo(now = new Date()) {
  const dayIndex = now.getDay();
  const variantPool = getWildVariantPool(now);
  return {
    dayIndex,
    dayLabel: WEEKDAY_LABELS[dayIndex] || "Unknown",
    variantPool,
    allVariantsActive: dayIndex === 0 || dayIndex === 5 || dayIndex === 6,
  };
}

function rollVariantAndAlpha({ zoneId, speciesId, now = new Date(), variantBonus = 0, alphaBonus = 0 }) {
  const event = getActiveSeasonalEvent(now);
  const swarm = getActiveSwarm(now);
  const species = EWAMON_SPECIES[speciesId] || {};
  const rarity = String(species.rarity || "common");
  const rarityAlphaBonus = rarity === "legendary" ? 0.02 : rarity === "epic" ? 0.012 : 0;
  let variantChance = 0.03 + (event.featuredZones.includes(zoneId) ? event.variantBonus : 0) + Number(variantBonus || 0);
  let alphaChance = 0.01 + (event.featuredZones.includes(zoneId) ? event.alphaBonus : 0) + rarityAlphaBonus + Number(alphaBonus || 0);

  if (swarm.zoneId === zoneId && swarm.speciesIds.includes(speciesId)) {
    variantChance += 0.04;
    alphaChance += 0.015;
  }
  if (event.featuredSpecies.includes(speciesId)) {
    variantChance += 0.025;
    alphaChance += 0.01;
  }

  const variantKeys = getWildVariantPool(now);
  const variantKey = variantKeys.length && Math.random() < variantChance
    ? variantKeys[Math.floor(Math.random() * variantKeys.length)]
    : "normal";
  const isAlpha = Math.random() < alphaChance;

  return {
    variantKey,
    isAlpha,
    activeEventId: event.id,
    swarmId: swarm.id,
  };
}

function applyEncounterBias(table, player, zoneId) {
  if (!Array.isArray(table) || !table.length) return table;
  if ((player.collection?.length || 0) >= 3 || !EARLY_GAME_ZONES.has(zoneId)) return table;
  return table.map(entry => {
    const species = EWAMON_SPECIES[entry.speciesId];
    const uncaughtCommon = !player.collection?.includes(entry.speciesId) && species?.rarity === "common";
    return {
      ...entry,
      weight: uncaughtCommon ? entry.weight * 2 : entry.weight,
    };
  });
}

function validateCupParty(party, cup) {
  const normalizedParty = Array.isArray(party) ? party : [];
  if (normalizedParty.length < 6) {
    return { ok: false, error: "Weekly Cup requires a full party of 6 Ewamon." };
  }
  switch (cup.ruleType) {
    case "no_duplicate_types": {
      const seenTypes = new Set();
      for (const member of normalizedParty) {
        const speciesTypes = EWAMON_SPECIES[member.speciesId]?.type || [];
        for (const type of speciesTypes) {
          if (seenTypes.has(type)) {
            return { ok: false, error: "Weekly Cup failed: no type can repeat across the party." };
          }
          seenTypes.add(type);
        }
      }
      return { ok: true };
    }
    case "starter_line_bonus": {
      const starterCount = normalizedParty.filter(member => STARTER_ROOTS.has(getEvolutionRoot(member.speciesId))).length;
      return starterCount >= 2
        ? { ok: true }
        : { ok: false, error: "Weekly Cup failed: bring at least 2 Ewamon from the starter lines." };
    }
    case "zone_origin_cup": {
      const zoneCount = normalizedParty.filter(member => member.caughtZoneId === cup.featuredZone).length;
      return zoneCount >= 3
        ? { ok: true }
        : { ok: false, error: "Weekly Cup failed: at least 3 Ewamon must come from the featured zone." };
    }
    case "mono_type_cup": {
      const typeSets = normalizedParty.map(member => new Set(EWAMON_SPECIES[member.speciesId]?.type || []));
      const firstTypes = [...(typeSets[0] || new Set())];
      const sharedType = firstTypes.find(type => typeSets.every(set => set.has(type)));
      return sharedType
        ? { ok: true }
        : { ok: false, error: "Weekly Cup failed: every Ewamon must share at least one type." };
    }
    default:
      return { ok: true };
  }
}

module.exports = {
  BASE_PROFILE_OPTIONS,
  GIFTABLE_ITEMS,
  VARIANT_PALETTES,
  getDailyResetKey,
  getWeeklyResetKey,
  getNextDailyResetAt,
  getNextWeeklyResetAt,
  ensureLiveOpsState,
  markLiveOpsModified,
  getProfileOptions,
  buildCompactLiveOpsSummary,
  buildLiveOpsPayload,
  buildDailySpawnInfo,
  applyLiveOpsEvent,
  getActiveSeasonalEvent,
  getActiveSwarm,
  getActiveWeeklyCup,
  getFeaturedRematchIds,
  isTrainerEligibleForRematch,
  markTrainerRematchUsed,
  buildRematchBoard,
  getVariantPalette,
  getWildVariantPool,
  rollVariantAndAlpha,
  applyEncounterBias,
  validateCupParty,
};
