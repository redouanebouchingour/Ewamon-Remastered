// League roster — CANONICAL to the 3D "Ewa" world (src/world3d/world.js GYMS /
// ELITE / CHAMPION). 8 gyms → 3 Vanguard Wardens (stage "big3") → Champion Zeon.
// `awardBadge` is the 3D badge ID (bloom/ember/.../ascend) pushed into
// `player.badges` on first clear — distinct from `badgeName` (display string) —
// and is what the 3D overworld's travel gating reads. `awardFlags` are story
// flags set in `player.storyFlags` on first clear. Both are applied server-side
// in wildBattleService.finalizeTrainerVictory.
const LEAGUE_TRAINERS = [
  {
    id: "verdant_gym",
    stage: "gym",
    order: 1,
    name: "Mira Thornwell",
    title: "Grove-Keeper of Mirevale",
    specialtyType: "Grass",
    badgeName: "Bloom Badge",
    awardBadge: "bloom",
    awardFlags: ["gymwin_verdant"],
    rewardMoney: 800,
    tagline: "You feel the dimming too, don't you?",
    portrait: { kind: "asset", src: "/assets/league/verdant_gym.png" },
    team: [
      { speciesId: "bramblecub", level: 11, nickname: "Thornling" },
      { speciesId: "smellduck",  level: 12, nickname: "Petalquack" },
      { speciesId: "briarbear",  level: 14, nickname: "Mossclaw" },
    ],
  },
  {
    id: "blaze_gym",
    stage: "gym",
    order: 2,
    name: "Karn Emberlitt",
    title: "Ash-Forge Master",
    specialtyType: "Fire",
    badgeName: "Ember Badge",
    awardBadge: "ember",
    awardFlags: ["gymwin_blaze"],
    rewardMoney: 1100,
    tagline: "I need someone who won't melt.",
    portrait: { kind: "asset", src: "/assets/league/blaze_gym.png" },
    team: [
      { speciesId: "cindercap", level: 15, nickname: "Kindlecap" },
      { speciesId: "moflame",   level: 16, nickname: "Embermane" },
      { speciesId: "pyrecap",   level: 18, nickname: "Torchveil" },
    ],
  },
  {
    id: "tidal_gym",
    stage: "gym",
    order: 3,
    name: "Captain Maren",
    title: "Drowned-Harbor Master",
    specialtyType: "Water",
    badgeName: "Current Badge",
    awardBadge: "current",
    awardFlags: ["gymwin_tidal"],
    rewardMoney: 1500,
    tagline: "Read the wave, then own it.",
    portrait: { kind: "asset", src: "/assets/league/tidal_gym.png" },
    team: [
      { speciesId: "glimfin",   level: 19, nickname: "Ripplefin" },
      { speciesId: "tidespine", level: 20, nickname: "Tidecrest" },
      { speciesId: "voltide",   level: 22, nickname: "Breaker" },
    ],
  },
  {
    id: "volt_gym",
    stage: "gym",
    order: 4,
    name: "Zia Volt",
    title: "Storm-Grid Keeper",
    specialtyType: "Electric",
    badgeName: "Circuit Badge",
    awardBadge: "circuit",
    awardFlags: ["gymwin_volt"],
    rewardMoney: 1900,
    tagline: "Fast hands, faster voltage.",
    portrait: { kind: "asset", src: "/assets/league/volt_gym.png" },
    team: [
      { speciesId: "ampmite",  level: 24, nickname: "Buzzscale" },
      { speciesId: "raidori",  level: 25, nickname: "Ampclaw" },
      { speciesId: "luxtrik",  level: 26, nickname: "Neon Bolt" },
      { speciesId: "flowbot",  level: 27, nickname: "Overclock" },
    ],
  },
  {
    id: "stone_gym",
    stage: "gym",
    order: 5,
    name: "Petra Stonewright",
    title: "Mine-Boss of Marrowdig",
    specialtyType: "Rock",
    badgeName: "Fault Badge",
    awardBadge: "fault",
    awardFlags: ["gymwin_stone"],
    rewardMoney: 2300,
    tagline: "Break yourself on the wall, or climb it.",
    portrait: { kind: "asset", src: "/assets/league/stone_gym.png" },
    team: [
      { speciesId: "pebblit",    level: 28, nickname: "Pebblehorn" },
      { speciesId: "lithokrysm", level: 29, nickname: "Shardlord" },
      { speciesId: "thornback",  level: 31, nickname: "Basaltusk" },
      { speciesId: "prismolith", level: 32, nickname: "Prismwall" },
    ],
  },
  {
    id: "phantom_gym",
    stage: "gym",
    order: 6,
    name: "Nyx Hollow",
    title: "Medium of Vesperveil",
    specialtyType: "Ghost",
    badgeName: "Wraith Badge",
    awardBadge: "wraith",
    awardFlags: ["gymwin_phantom"],
    rewardMoney: 2700,
    tagline: "A clean mind still loses to a haunted field.",
    portrait: { kind: "asset", src: "/assets/league/phantom_gym.png" },
    team: [
      { speciesId: "nerohat",    level: 32, nickname: "Velvet Hex" },
      { speciesId: "miscarmen",  level: 33, nickname: "Haunted Veil" },
      { speciesId: "nettlewisp", level: 34, nickname: "Phantom Nett" },
      { speciesId: "fedoraith",  level: 35, nickname: "Last Bow" },
      { speciesId: "mismagmen",  level: 37, nickname: "Mindveil" },
    ],
  },
  {
    id: "iron_gym",
    stage: "gym",
    order: 7,
    name: "Marshal Rell",
    title: "Warden of Forgewall",
    specialtyType: "Steel",
    badgeName: "Anvil Badge",
    awardBadge: "anvil",
    awardFlags: ["gymwin_iron"],
    rewardMoney: 3200,
    tagline: "Soft teams don't leave this room.",
    portrait: { kind: "asset", src: "/assets/league/iron_gym.png" },
    team: [
      { speciesId: "scraphog",   level: 36, nickname: "Iron Tusker" },
      { speciesId: "alloylark",  level: 37, nickname: "Sky Rivet" },
      { speciesId: "rivetalon",  level: 39, nickname: "Spike Wing" },
      { speciesId: "trenchtusk", level: 40, nickname: "Earthplate" },
      { speciesId: "acier",      level: 42, nickname: "Zangrift" },
    ],
  },
  {
    id: "draco_gym",
    stage: "gym",
    order: 8,
    name: "Sylvane",
    title: "Keeper of the Sky-Shrine",
    specialtyType: "Dragon",
    badgeName: "Ascend Badge",
    awardBadge: "ascend",
    awardFlags: ["gymwin_draco"],
    rewardMoney: 4000,
    tagline: "Every final test should feel unfair.",
    portrait: { kind: "asset", src: "/assets/league/draco_gym.png" },
    team: [
      { speciesId: "serpyre",    level: 39, nickname: "Drake Fang" },
      { speciesId: "budwing",    level: 40, nickname: "Skybud" },
      { speciesId: "bloomdrake", level: 42, nickname: "Canopymaw" },
      { speciesId: "glacinid",   level: 44, nickname: "Rimefang" },
      { speciesId: "pyrothal",   level: 46, nickname: "Solwyrm" },
    ],
  },
  {
    id: "veil",
    stage: "big3",
    order: 9,
    name: "Warden Veil",
    title: "Vanguard Warden",
    specialtyType: "Ghost",
    badgeName: "Warden's Seal",
    awardBadge: null,
    awardFlags: ["elitewin_veil"],
    rewardMoney: 6000,
    tagline: "Show me you survived the eclipse for a reason.",
    portrait: { kind: "asset", src: "/assets/league/veil.png" },
    signatureSpeciesId: "bankaiser",
    signatureLevel: 54,
    team: [
      { speciesId: "mismagmen", level: 48, nickname: "Veilwhisper" },
      { speciesId: "fedoraith", level: 49, nickname: "Final Bow" },
      { speciesId: "voidraith", level: 50, nickname: "Nullshade" },
      { speciesId: "toxshade",  level: 51, nickname: "Blightveil" },
      { speciesId: "bankaiser", level: 54, nickname: "Bankaiser" },
    ],
  },
  {
    id: "aurelia",
    stage: "big3",
    order: 10,
    name: "Warden Aurelia",
    title: "Vanguard Warden",
    specialtyType: "Fairy",
    badgeName: "Warden's Seal",
    awardBadge: null,
    awardFlags: ["elitewin_aurelia"],
    rewardMoney: 7000,
    tagline: "I keep Lumyth's light. Prove you can wield it.",
    portrait: { kind: "asset", src: "/assets/league/aurelia.png" },
    signatureSpeciesId: "voltaura",
    signatureLevel: 54,
    team: [
      { speciesId: "glimmereen", level: 48, nickname: "Lightmote" },
      { speciesId: "cirrileap",  level: 49, nickname: "Skyleap" },
      { speciesId: "starwhim",   level: 50, nickname: "Wishfall" },
      { speciesId: "gemknight",  level: 51, nickname: "Prismguard" },
      { speciesId: "voltaura",   level: 54, nickname: "Voltaura" },
    ],
  },
  {
    id: "kirei",
    stage: "big3",
    order: 11,
    name: "Warden Kirei",
    title: "Vanguard Warden",
    specialtyType: "Psychic",
    badgeName: "Warden's Seal",
    awardBadge: null,
    awardFlags: ["elitewin_kirei"],
    rewardMoney: 8000,
    tagline: "I study the rifts so they never open again.",
    portrait: { kind: "asset", src: "/assets/league/kirei.png" },
    signatureSpeciesId: "galaxion",
    signatureLevel: 55,
    team: [
      { speciesId: "nebucloak",  level: 48, nickname: "Duskveil" },
      { speciesId: "auroracle",  level: 49, nickname: "Foreseer" },
      { speciesId: "archonosis", level: 51, nickname: "Mindarch" },
      { speciesId: "mismagmen",  level: 52, nickname: "Echoeye" },
      { speciesId: "galaxion",   level: 55, nickname: "Galaxion" },
    ],
  },
  {
    id: "zeon",
    stage: "champion",
    order: 12,
    name: "Champion Zeon",
    title: "The Last Warden of Ewa",
    specialtyType: "Dragon",
    badgeName: "Champion Crown",
    awardBadge: null,
    awardFlags: ["champion"],
    rewardMoney: 20000,
    tagline: "You broke the Long Eclipse. Now break me.",
    portrait: { kind: "asset", src: "/assets/league/zeon.png" },
    signatureSpeciesId: "zenryu",
    signatureLevel: 60,
    team: [
      { speciesId: "florasage", level: 55, nickname: "Verdant Sage" },
      { speciesId: "blizzraak", level: 55, nickname: "Rimecaller" },
      { speciesId: "abyssrake", level: 56, nickname: "Deepfang" },
      { speciesId: "rexaloft",  level: 57, nickname: "Skytyrant" },
      { speciesId: "pyrothal",  level: 58, nickname: "Solwyrm" },
      { speciesId: "zenryu",    level: 60, nickname: "Zenryu" },
    ],
  },
];

const TRAINER_BY_ID = new Map(LEAGUE_TRAINERS.map(trainer => [trainer.id, trainer]));

function normalizeDefeatedTrainerIds(player) {
  const raw = player?.leagueProgress?.defeatedTrainerIds;
  if (!raw) return [];
  const values = Array.isArray(raw)
    ? raw
    : typeof raw.values === "function"
      ? Array.from(raw.values())
      : [];
  return values
    .map(value => String(value))
    .filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function getLeagueProgress(player) {
  return {
    defeatedTrainerIds: normalizeDefeatedTrainerIds(player),
    lastClearedAt: player?.leagueProgress?.lastClearedAt || null,
  };
}

function getLeagueTrainer(trainerId) {
  return TRAINER_BY_ID.get(String(trainerId)) || null;
}

function isTrainerUnlocked(trainerId, defeatedTrainerIds) {
  const defeatedSet = defeatedTrainerIds instanceof Set
    ? defeatedTrainerIds
    : new Set(defeatedTrainerIds || []);
  const trainerIndex = LEAGUE_TRAINERS.findIndex(entry => entry.id === String(trainerId));
  if (trainerIndex === -1) return false;
  if (trainerIndex === 0) return true;
  return LEAGUE_TRAINERS
    .slice(0, trainerIndex)
    .every(entry => defeatedSet.has(entry.id));
}

function buildLeagueState(player) {
  const progress = getLeagueProgress(player);
  const defeatedSet = new Set(progress.defeatedTrainerIds);
  const nextTrainer = LEAGUE_TRAINERS.find(entry => !defeatedSet.has(entry.id)) || null;

  return {
    progress,
    summary: {
      totalCleared: progress.defeatedTrainerIds.length,
      totalTrainers: LEAGUE_TRAINERS.length,
      gymsCleared: LEAGUE_TRAINERS.filter(entry => entry.stage === "gym" && defeatedSet.has(entry.id)).length,
      big3Cleared: LEAGUE_TRAINERS.filter(entry => entry.stage === "big3" && defeatedSet.has(entry.id)).length,
      championCleared: defeatedSet.has("goku"),
      nextTrainerId: nextTrainer?.id || null,
    },
    trainers: LEAGUE_TRAINERS.map(trainer => {
      const levels = trainer.team.map(member => member.level);
      const defeated = defeatedSet.has(trainer.id);
      const unlocked = isTrainerUnlocked(trainer.id, defeatedSet);
      return {
        id: trainer.id,
        stage: trainer.stage,
        order: trainer.order,
        name: trainer.name,
        title: trainer.title,
        specialtyType: trainer.specialtyType,
        badgeName: trainer.badgeName,
        rewardMoney: trainer.rewardMoney,
        tagline: trainer.tagline,
        portrait: trainer.portrait,
        signatureSpeciesId: trainer.signatureSpeciesId || null,
        signatureLevel: trainer.signatureLevel || null,
        teamSize: trainer.team.length,
        levelRange: {
          min: Math.min(...levels),
          max: Math.max(...levels),
        },
        team: trainer.team.map(member => ({
          speciesId: member.speciesId,
          level: member.level,
          nickname: member.nickname,
        })),
        defeated,
        unlocked,
        available: unlocked && !defeated,
      };
    }),
  };
}

function markLeagueTrainerDefeated(player, trainerId) {
  const trainer = getLeagueTrainer(trainerId);
  if (!trainer) return false;

  const defeatedTrainerIds = normalizeDefeatedTrainerIds(player);
  if (defeatedTrainerIds.includes(trainer.id)) return false;

  player.leagueProgress = {
    defeatedTrainerIds: [...defeatedTrainerIds, trainer.id],
    lastClearedAt: new Date(),
  };
  return true;
}

module.exports = {
  LEAGUE_TRAINERS,
  buildLeagueState,
  getLeagueProgress,
  getLeagueTrainer,
  isTrainerUnlocked,
  markLeagueTrainerDefeated,
};
