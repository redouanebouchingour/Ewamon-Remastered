// Field patches to LEGACY species rows, applied by the content generator after the legacy rows load.
//
// `.design/legacy/ewamon.js` stays a verbatim copy of the old game (core's fuzz reads only it), so a change to a legacy
// species' moves lives here. A patch replaces whole fields of the row (`moves`, `learnableMoves`) or pins learnable
// moves to a level (`learnLevels`, left out of the generator's even spacing); the
// generator throws on an unknown species or field. Post-legacy species (species.js) are edited in place instead.
//
// Dependency-free CommonJS, evaluated the same way as ewamon.js.

const EWAMON_SPECIES_PATCHES = {
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
};

module.exports = { EWAMON_SPECIES_PATCHES };
