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
    moves: ["Shadow Sneak", "Night Slash", "Low Kick", "Phantom Strike"],
    learnableMoves: ["Bulk Up", "Sucker Punch", "Crunch", "Close Combat", "Poltergeist"],
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
      frontSprite: "hollowmane_rage(front).png",
      backSprite: "hollowmane_rage(back).png",
    },
  },
};

module.exports = { EWAMON_SPECIES_ADDITIONS };
