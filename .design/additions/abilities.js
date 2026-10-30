// Abilities added after the legacy migration: `{ name, desc, hooks }` with core `AbilityHook` rows (§2.5).
//
// `.design/legacy/ewamon.js` stays a verbatim copy of the old game (core's fuzz reads only its ABILITIES). The content
// generator (`packages/content/scripts/migrate-legacy.ts`) merges these after the legacy abilities; `abilities.ts` is
// sorted by id, so order here does not matter. There is no Sp. Atk or Sp. Def: a "special" move is one without contact.
//
// Dependency-free CommonJS, evaluated the same way as ewamon.js.

const EWAMON_ABILITY_ADDITIONS = {
  // elemutt: the four elements stir in it while it is unhurt
  "Inner Chi": {
    name: "Inner Chi",
    desc: "Non-contact moves deal 30% more damage while its HP is full.",
    hooks: [{ kind: "modifyDamage", side: "attacker", when: "fullHp", contact: false, mul: 1.3 }],
  },
  // katamute: every strike is also a stance
  "Stance Change": {
    name: "Stance Change",
    desc: "After hitting with a contact move, raises Defense by one stage; after a non-contact move, Speed. At most two stages each until it switches out.",
    hooks: [{ kind: "afterMoveUsed", contact: { stat: "def", stages: 1 }, nonContact: { stat: "spd", stages: 1 }, cap: 2 }],
  },
  // ravatar: the forms themselves are species data (`battleForms`); the ability names the rule for the player
  "Avatar Cycle": {
    name: "Avatar Cycle",
    desc: "Holding an Original Master Relic, it takes that element's form, type and signature-move type as it enters battle. The Vial of Spirit Water wakes the Avatar State below 30% HP.",
    hooks: [],
  },
  // kelvyre: the fire half cannot freeze, the ice half cannot burn, and the seam soaks up the extremes of both
  "Thermal Divide": {
    name: "Thermal Divide",
    desc: "Cannot be burned or frozen. Fire- and Ice-type moves deal half damage to it.",
    hooks: [
      { kind: "statusImmunity", statuses: ["burn", "freeze"] },
      { kind: "modifyDamage", side: "defender", moveTypes: ["Fire", "Ice"], mul: 0.5 },
    ],
  },
};

module.exports = { EWAMON_ABILITY_ADDITIONS };
