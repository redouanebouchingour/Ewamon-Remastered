// Field patches to LEGACY species rows, applied by the content generator after the legacy rows load.
//
// `.design/legacy/ewamon.js` stays a verbatim copy of the old game (core's fuzz reads only it), so a change to a legacy
// species' moves lives here. A patch replaces whole fields of the row (`moves`, `learnableMoves`) or pins learnable
// moves to a level (`learnLevels`, left out of the generator's even spacing), or gives a legacy single stage an evolution
// (`evolvesInto` + `evolvesAt`, kygra → kykaiser); the generator throws on an unknown species or field.
// Post-legacy species (species.js) are edited in place instead.
//
// Dependency-free CommonJS, evaluated the same way as ewamon.js.

const EWAMON_SPECIES_PATCHES = {
  // Majin / Tenjin battle forms (.design/majin-tenjin.md): Majin +28 atk / -18 def / +28 spd and lowers a foe stat;
  // Tenjin +10 / +30 / +10, cures its status and heals a fifth. Sprites: assets-src/creatures/{front,back}/<id>_<form>(...).png.
  infernomorel: {
    battleForm: { id: "majin", name: "Majin Form", kind: "majin", hpBelowPct: 50, baseAtk: 146, baseDef: 66, baseSpd: 130, onEnter: { clearNegativeStages: true, lowerFoes: { stat: "spd", stages: 1 } }, frontSprite: "infernomorel_majin(front).png", backSprite: "infernomorel_majin(back).png" },
  },
  toxshade: {
    battleForm: { id: "majin", name: "Majin Form", kind: "majin", hpBelowPct: 50, baseAtk: 140, baseDef: 56, baseSpd: 134, onEnter: { clearNegativeStages: true, lowerFoes: { stat: "def", stages: 1 } }, frontSprite: "toxshade_majin(front).png", backSprite: "toxshade_majin(back).png" },
  },
  necrogeist: {
    battleForm: { id: "majin", name: "Majin Form", kind: "majin", hpBelowPct: 50, baseAtk: 166, baseDef: 94, baseSpd: 130, onEnter: { clearNegativeStages: true, lowerFoes: { stat: "atk", stages: 1 } }, frontSprite: "necrogeist_majin(front).png", backSprite: "necrogeist_majin(back).png" },
  },
  thornback: {
    battleForm: { id: "tenjin", name: "Tenjin Form", kind: "tenjin", hpBelowPct: 50, baseAtk: 122, baseDef: 132, baseSpd: 80, onEnter: { clearNegativeStages: true, lowerFoes: null, cureStatus: true, healFraction: 0.2 }, frontSprite: "thornback_tenjin(front).png", backSprite: "thornback_tenjin(back).png" },
  },
  abysspark: {
    battleForm: { id: "tenjin", name: "Tenjin Form", kind: "tenjin", hpBelowPct: 50, baseAtk: 102, baseDef: 114, baseSpd: 126, onEnter: { clearNegativeStages: true, lowerFoes: null, cureStatus: true, healFraction: 0.2 }, frontSprite: "abysspark_tenjin(front).png", backSprite: "abysspark_tenjin(back).png" },
  },
  gemknight: {
    battleForm: { id: "tenjin", name: "Tenjin Form", kind: "tenjin", hpBelowPct: 50, baseAtk: 118, baseDef: 142, baseSpd: 86, onEnter: { clearNegativeStages: true, lowerFoes: null, cureStatus: true, healFraction: 0.2 }, frontSprite: "gemknight_tenjin(front).png", backSprite: "gemknight_tenjin(back).png" },
  },
  glimmereen: {
    battleForm: { id: "tenjin", name: "Tenjin Form", kind: "tenjin", hpBelowPct: 50, baseAtk: 70, baseDef: 110, baseSpd: 100, onEnter: { clearNegativeStages: true, lowerFoes: null, cureStatus: true, healFraction: 0.2 }, frontSprite: "glimmereen_tenjin(front).png", backSprite: "glimmereen_tenjin(back).png" },
  },
  solpyre: {
    battleForm: { id: "tenjin", name: "Tenjin Form", kind: "tenjin", hpBelowPct: 50, baseAtk: 120, baseDef: 105, baseSpd: 115, onEnter: { clearNegativeStages: true, lowerFoes: null, cureStatus: true, healFraction: 0.2 }, frontSprite: "solpyre_tenjin(front).png", backSprite: "solpyre_tenjin(back).png" },
  },
  // 2026-10-26: the storm lion as the calm at the centre of the storm (gpt-image art, .design/imagegen/concepts/raidori-tenjin/)
  raidori: {
    battleForm: { id: "tenjin", name: "Tenjin Form", kind: "tenjin", hpBelowPct: 50, baseAtk: 130, baseDef: 135, baseSpd: 110, onEnter: { clearNegativeStages: true, lowerFoes: null, cureStatus: true, healFraction: 0.2 }, frontSprite: "raidori_tenjin(front).png", backSprite: "raidori_tenjin(back).png" },
  },
  // 2026-10-26: the made thing that hit back, its plates split crimson and its blades red-hot; breaks foes' guard (def)
  acier: {
    battleForm: { id: "majin", name: "Majin Form", kind: "majin", hpBelowPct: 50, baseAtk: 123, baseDef: 92, baseSpd: 88, onEnter: { clearNegativeStages: true, lowerFoes: { stat: "def", stages: 1 } }, frontSprite: "acier_majin(front).png", backSprite: "acier_majin(back).png" },
  },
  // 2026-10-27: the orchard guardian gone feral, thorn roots up its legs and blood oranges split crimson; roots bind foes (spd)
  clementar: {
    battleForm: { id: "majin", name: "Majin Form", kind: "majin", hpBelowPct: 50, baseAtk: 160, baseDef: 94, baseSpd: 110, onEnter: { clearNegativeStages: true, lowerFoes: { stat: "spd", stages: 1 } }, frontSprite: "clementar_majin(front).png", backSprite: "clementar_majin(back).png" },
  },
  // Every legendary's / mythical's signature move is its own (client battle/signatures.ts): Bankai Sever is
  // bankaiser's, so ironcarab's L39 finisher becomes Six-Blade Storm.
  ironcarab: {
    learnableMoves: ["X-Scissor", "Steel Slash", "Iron Defense", "Megahorn", "Signal Beam", "Flash Cannon", "Smart Strike", "Gyro Ball", "Bug Bite", "Six-Blade Storm"],
  },

  // A legendary / mythical knows its signature move whenever it is met (wild statics, league teams, rewards): the move
  // leaves the level-1 defaults and is pinned as its newest learnable move (`learnLevels`, at or below the lowest
  // level it is ever met at), so the server's last-four rule (movesAtLevel) always keeps it. The other levels do not move.
  // glacinid's is new: Aurora Requiem (moves.js).
  glacinid: {
    learnableMoves: ["Frost Bite", "Glacier Crash", "Dragon Rush", "Sky Pierce", "Frozen Tempest", "Draco Impact", "Aurora Requiem"],
    learnLevels: { "Aurora Requiem": 39 },
  },
  galaxion: {
    moves: ["Mind Crush", "Spectral Burn", "Shadow Ball"],
    learnLevels: { "Cosmic Pyre": 39 },
  },
  voltaura: {
    moves: ["Thunder Claw", "Volt Crash", "Fairy Wind"],
    learnLevels: { "Sparking Grace": 39 },
  },
  sunjaw: {
    moves: ["Champion Punch", "Flare Blitz", "Mach Punch"],
    learnLevels: { "Sunbreaker Barrage": 39 },
  },
  raikitsune: {
    moves: ["Volt Crash", "Thunder Claw", "Flame Dash"],
    learnLevels: { "Foxfire Voltage": 27 }, // met at L30 (galvan_route)
  },
  zenryu: {
    battleForm: { id: "majin", name: "Majin Form", kind: "majin", hpBelowPct: 50, baseAtk: 176, baseDef: 94, baseSpd: 158, onEnter: { clearNegativeStages: true, lowerFoes: { stat: "def", stages: 1 } }, frontSprite: "zenryu_majin(front).png", backSprite: "zenryu_majin(back).png" },
    moves: ["Celestial Burst", "Draco Impact", "Mach Punch"],
    learnLevels: { "Kamehameha": 39 },
  },
  lumyth: {
    moves: ["Starfall", "Psych Wave", "Calm Mind"],
    learnLevels: { "Cosmic Miracle": 39 },
  },
  noxmyth: {
    moves: ["Eclipse Void", "Dark Pulse", "Nasty Plot"],
    learnLevels: { "Stellar Devour": 39 },
  },
  bankaiser: {
    moves: ["Steel Slash", "Shadow Strike", "Shadow Sneak"],
    learnLevels: { "Bankai Sever": 39 },
  },
  voidraxis: {
    moves: ["Eclipse Void", "Dragon Rush", "Draco Impact"],
    learnLevels: { "Rift Collapse": 39 },
  },

  // Kygra evolves into Kykaiser (species.js) at 45. Its learnset keeps the legacy levels: an evolution level would
  // otherwise re-space them up to 45.
  kygra: {
    evolvesInto: "kykaiser", evolvesAt: 45,
    learnLevels: { "Hydro Crush": 6, "Ocean Crash": 39 },
  },
};

module.exports = { EWAMON_SPECIES_PATCHES };
