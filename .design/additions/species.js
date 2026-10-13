// Species added after the legacy migration, in the legacy `EWAMON_SPECIES` row shape.
//
// `.design/legacy/ewamon.js` stays a verbatim copy of the old game: core's test content
// (`packages/core/test/fixtures/legacyContent.ts`) and its 1,000-battle fuzz digests read only that
// file. The content generator (`packages/content/scripts/migrate-legacy.ts`) and the sprite pipeline
// (`tools/sprite-pipeline/src/legacy.ts`) append these rows after the legacy ones, so the dex numbers
// continue at 131 in insertion order. Append new species at the end; never reorder.
//
// A row may carry `battleForm` (a mid-battle form, core `BattleFormDef`): the generator emits it with sprite ids
// `<id>_<form>_front|back`, and the sprite pipeline ships its `frontSprite` / `backSprite` under the key `<id>_<form>`.
//
// A row may split by honor (`splitEvolvesInto: [{ condition: "honor", value: <min ledger>, into }, { into }]`, dustcub):
// the creature keeps an honor ledger in battle and the ledger picks the branch at `evolvesAt` (core honor.ts).
//
// Dependency-free CommonJS, evaluated the same way as ewamon.js.

const EWAMON_SPECIES_ADDITIONS = {
  hollowmane: {
    id: "hollowmane", name: "Hollowmane",
    flavor: "Born where a warrior's soul was swallowed by its own hunger, it fights on instinct alone. The red core in its chest burns brighter with every wound, and it laughs through its bone mask at anything that hesitates.",
    type: ["Ghost", "Fighting"],
    baseHp: 98, baseAtk: 134, baseDef: 84, baseSpd: 122,
    rarity: "rare", catchRate: 6,
    sizeScale: 1.25,
    expYield: 240,
    moves: ["Shadow Sneak", "Low Kick", "Phantom Strike", "Bulk Up"],
    // Night Slash comes last (L39) so every wild one (L57–60, its last four moves) knows it: in Rage Form it is Hollow Crescent
    learnableMoves: ["Sucker Punch", "Crunch", "Close Combat", "Poltergeist", "Night Slash"],
    abilities: ["Hustle", "Guts"],
    role: "Physical Attacker",
    frontSprite: "hollowmane(front).png",
    backSprite: "hollowmane(back).png",
    habitat: ["The Rift"], evolvesInto: null, evolvesAt: null,
    // Rage Form: once per battle, the first time it is below half hp and still standing, the mask cracks. Max hp is
    // kept; it trades its guard for power and speed, sheds every weakening and roars the foes' attack down.
    battleForm: {
      // Majin form (.design/majin-tenjin.md): the trainer's Majin Band below half hp; a wild one rages on its own
      id: "rage", name: "Majin Form", kind: "majin",
      hpBelowPct: 50,
      baseAtk: 162, baseDef: 66, baseSpd: 150,
      onEnter: { clearNegativeStages: true, lowerFoes: { stat: "atk", stages: 1 } },
      // in Rage Form, Night Slash becomes Hollow Crescent (.design/additions/moves.js)
      signatureMove: { replaces: "Night Slash", move: "Hollow Crescent" },
      frontSprite: "hollowmane_rage(front).png",
      backSprite: "hollowmane_rage(back).png",
    },
  },

  // An outlaw line inspired by Arthur Morgan (Red Dead Redemption 2): a cowboy cub and the drifter it grows into.
  dustcub: {
    id: "dustcub", name: "Dustcub",
    flavor: "A scrappy badger cub that wanders into canyon camps chewing a stalk of wheat. It practises its lasso on fence posts all day and never backs down from a fight it picked.",
    type: ["Ground"],
    baseHp: 68, baseAtk: 70, baseDef: 58, baseSpd: 52,
    rarity: "uncommon", catchRate: 90,
    sizeScale: 0.78,
    expYield: 64,
    moves: ["Tackle", "Sand Attack", "Mud-Slap", "Dark Lasso"],
    learnableMoves: ["Bite", "Howl", "Bulldoze", "Night Slash", "Sucker Punch", "Crunch"],
    abilities: ["Sand Veil", "Guts"],
    role: "Physical Attacker",
    frontSprite: "dustcub(front).png",
    backSprite: "dustcub(back).png",
    habitat: ["Deepcut Route"],
    // the honor ledger decides at 30: honor ≥ 0 → lawlander (High Honor), below → badlander (Low Honor)
    splitEvolvesInto: [{ condition: "honor", value: 0, into: "lawlander" }, { into: "badlander" }], evolvesAt: 30,
  },

  badlander: {
    id: "badlander", name: "Badlander",
    flavor: "A weathered drifter of the badlands. It keeps a ledger of every debt it is owed and every debt it owes, and settles both. Its claws are quick, but its draw is quicker.",
    type: ["Ground", "Dark"],
    baseHp: 104, baseAtk: 118, baseDef: 88, baseSpd: 74,
    rarity: "rare", catchRate: 30,
    sizeScale: 1.1,
    expYield: 168,
    moves: ["Dark Lasso", "Night Slash", "Bulldoze", "Sucker Punch"],
    learnableMoves: ["Howl", "Bite", "Slash", "Crunch", "Sand Tomb", "Earthquake", "Double Edge", "Close Combat"],
    abilities: ["Intimidate", "Guts"],
    role: "Physical Attacker",
    frontSprite: "badlander(front).png",
    backSprite: "badlander(back).png",
    habitat: [],
    evolvesFrom: "dustcub",
    // Majin form (.design/majin-tenjin.md): the drifter gone feral. Majin template +28 atk / -18 def / +28 spd.
    battleForm: {
      id: "majin", name: "Majin Form", kind: "majin",
      hpBelowPct: 50,
      baseAtk: 146, baseDef: 70, baseSpd: 102,
      onEnter: { clearNegativeStages: true, lowerFoes: { stat: "atk", stages: 1 } },
      frontSprite: "badlander_majin(front).png",
      backSprite: "badlander_majin(back).png",
    },
  },

  // A blindfolded wolf line inspired by Gojo Satoru (Jujutsu Kaisen): a cocky pup and the untouchable sorcerer it grows into.
  veilpup: {
    id: "veilpup", name: "Veilpup",
    flavor: "A cocky pup that wears a strip of dark cloth over its eyes, because what it sees without it is too much. It still never bumps into anything, and it grins at every trainer as if it already knows how the fight ends.",
    type: ["Psychic"],
    baseHp: 64, baseAtk: 60, baseDef: 56, baseSpd: 84,
    rarity: "rare", catchRate: 45,
    sizeScale: 0.8,
    expYield: 72,
    moves: ["Quick Attack", "Confusion", "Bite", "Calm Mind"],
    learnableMoves: ["Psych Wave", "Extrasensory", "Starfall", "Mind Crush", "Future Sight"],
    abilities: ["Keen Eye", "Competitive"],
    role: "Special Attacker",
    frontSprite: "veilpup(front).png",
    backSprite: "veilpup(back).png",
    habitat: ["Ascent Route"],
    evolvesInto: "hollowolf", evolvesAt: 42,
  },

  hollowolf: {
    id: "hollowolf", name: "Hollowolf",
    flavor: "Nothing it does not allow can reach it: blows slow to a stop a hair from its fur. It holds a red spark that pushes and a blue one that pulls, and when it lets the two meet, what lies between them is simply gone.",
    type: ["Psychic", "Cosmic"],
    baseHp: 90, baseAtk: 122, baseDef: 80, baseSpd: 126,
    rarity: "rare", catchRate: 25,
    sizeScale: 1.2,
    expYield: 224,
    moves: ["Extrasensory", "Starfall", "Mind Crush", "Calm Mind"],
    // Rift Collapse is voidraxis's signature move (client battle/signatures.ts), never learned here
    learnableMoves: ["Quick Attack", "Brain Pulse", "Future Sight", "Eclipse Void"],
    abilities: ["Levitate", "Keen Eye"],
    role: "Special Attacker",
    frontSprite: "hollowolf(front).png",
    backSprite: "hollowolf(back).png",
    habitat: [],
    evolvesFrom: "veilpup",
  },

  // A lone vigilante inspired by the Punisher (Marvel): a honey badger in a long coat, a skull on its chest, cannon arms
  // and a belt of bone rounds.
  castlemaw: {
    id: "castlemaw", name: "Castlemaw",
    flavor: "A honey badger that wears the skull of the first thing that ever wronged it. It stalks the grounds of the old observatory at night with its cannon arms loaded and a belt of bone rounds, and it keeps a list. No one has ever seen it forgive.",
    type: ["Dark", "Steel"],
    baseHp: 112, baseAtk: 128, baseDef: 104, baseSpd: 76,
    rarity: "rare", catchRate: 8,
    sizeScale: 1.2,
    expYield: 236,
    moves: ["Bite", "Metal Burst", "Snarl", "Smart Strike"],
    // Flash Cannon comes at L24 and stays among the last four moves of every wild one (L44–48): in Rage Form it is Vendetta Volley
    learnableMoves: ["Iron Defense", "Sucker Punch", "Flash Cannon", "Crunch", "Iron Fist"],
    abilities: ["Intimidate", "Iron Barbs"],
    role: "Physical Attacker",
    frontSprite: "castlemaw(front).png",
    backSprite: "castlemaw(back).png",
    habitat: ["Umbral Observatory"], evolvesInto: null, evolvesAt: null,
    // Rage Form: once per battle, the first time it is below half hp and still standing, the skull ignites. Max hp is
    // kept; it trades guard for power and speed, sheds every weakening, and its glare cracks the foes' guard.
    battleForm: {
      // Majin form (.design/majin-tenjin.md): the trainer's Majin Band below half hp; a wild one rages on its own
      id: "rage", name: "Majin Form", kind: "majin",
      hpBelowPct: 50,
      baseAtk: 160, baseDef: 86, baseSpd: 104,
      onEnter: { clearNegativeStages: true, lowerFoes: { stat: "def", stages: 1 } },
      // in Rage Form, Flash Cannon becomes Vendetta Volley (.design/additions/moves.js)
      signatureMove: { replaces: "Flash Cannon", move: "Vendetta Volley" },
      frontSprite: "castlemaw_rage(front).png",
      backSprite: "castlemaw_rage(back).png",
    },
  },

  // dustcub's High Honor branch (the honor ledger at 30 is ≥ 0): the lawman to badlander's outlaw.
  lawlander: {
    id: "lawlander", name: "Lawlander",
    flavor: "A Dustcub that kept its word grows into a Lawlander, a weathered lawman of the badlands wearing a tin star nobody pinned on it. It never draws first, and it never misses second.",
    type: ["Ground", "Fighting"],
    baseHp: 110, baseAtk: 106, baseDef: 98, baseSpd: 70,
    rarity: "rare", catchRate: 30,
    sizeScale: 1.1,
    expYield: 168,
    moves: ["Bulldoze", "Counter", "Mach Punch", "Protect"],
    learnableMoves: ["Howl", "Bulk Up", "Power Jab", "Slash", "Iron Fist", "Earthquake", "Body Slam", "Close Combat"],
    abilities: ["Keen Eye", "Guts"],
    role: "Physical Defender",
    frontSprite: "lawlander(front).png",
    backSprite: "lawlander(back).png",
    habitat: [],
    evolvesFrom: "dustcub",
    // Tenjin form (.design/majin-tenjin.md): the lawman exalted. Tenjin template +10 atk / +30 def / +10 spd.
    battleForm: {
      id: "tenjin", name: "Tenjin Form", kind: "tenjin",
      hpBelowPct: 50,
      baseAtk: 116, baseDef: 128, baseSpd: 80,
      onEnter: { clearNegativeStages: true, lowerFoes: null, cureStatus: true, healFraction: 0.2 },
      frontSprite: "lawlander_tenjin(front).png",
      backSprite: "lawlander_tenjin(back).png",
    },
  },

  // A legendary ice dragon inspired by Daiguren Hyorinmaru (Bleach): a serpent of living ice on wings of frozen petals.
  hyoryu: {
    id: "hyoryu", name: "Hyoryu",
    flavor: "A dragon of living ice that coils through the high passes on wings of frozen petals. Where it flies the air goes still and flowers of ice open in the sky one by one. Old climbers say that when the last petal opens, the sky itself freezes.",
    type: ["Ice", "Dragon"],
    baseHp: 120, baseAtk: 144, baseDef: 110, baseSpd: 134,
    rarity: "legendary", catchRate: 3,
    sizeScale: 1.45,
    expYield: 330,
    moves: ["Ice Shard", "Dragon Breath", "Snarl"],
    // Crimson Lotus Prison is its signature move (client battle/signatures.ts): pinned as the newest move (L39) so the
    // static (L60) knows it, beside Glacier Crash, Crunch and Dragon Rush
    learnableMoves: ["Frost Bite", "Night Slash", "Dragon Claw", "Ice Beam", "Glacier Crash", "Crunch", "Dragon Rush", "Crimson Lotus Prison"],
    learnLevels: { "Crimson Lotus Prison": 39 },
    abilities: ["Thick Fat", "Intimidate"],
    role: "Physical Attacker",
    frontSprite: "hyoryu(front).png",
    backSprite: "hyoryu(back).png",
    habitat: [], evolvesInto: null, evolvesAt: null,
    // Majin form (.design/majin-tenjin.md): the ice turns crimson and the dragon turns on the sky it froze. The only form
    // that changes its types: Ice/Dragon becomes Dragon/Dark. Majin template +28 atk / -18 def / +28 spd.
    battleForm: {
      id: "majin", name: "Majin Form", kind: "majin",
      hpBelowPct: 50,
      types: ["Dragon", "Dark"],
      baseAtk: 172, baseDef: 92, baseSpd: 162,
      onEnter: { clearNegativeStages: true, lowerFoes: { stat: "spd", stages: 1 } },
      frontSprite: "hyoryu_majin(front).png",
      backSprite: "hyoryu_majin(back).png",
    },
  },
};

module.exports = { EWAMON_SPECIES_ADDITIONS };
