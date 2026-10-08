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
      id: "rage", name: "Rage Form",
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
    evolvesInto: "badlander", evolvesAt: 30,
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
    learnableMoves: ["Quick Attack", "Brain Pulse", "Future Sight", "Eclipse Void", "Rift Collapse"],
    abilities: ["Levitate", "Keen Eye"],
    role: "Special Attacker",
    frontSprite: "hollowolf(front).png",
    backSprite: "hollowolf(back).png",
    habitat: [],
    evolvesFrom: "veilpup",
  },
};

module.exports = { EWAMON_SPECIES_ADDITIONS };
