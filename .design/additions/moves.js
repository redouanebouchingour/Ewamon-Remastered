// Moves added after the legacy migration, in the legacy `MOVES` row shape (power, type, pp, effect, accuracy).
//
// `.design/legacy/ewamon.js` stays a verbatim copy of the old game (core's fuzz reads only it). The content generator
// (`packages/content/scripts/migrate-legacy.ts`) merges these rows into the legacy moves; `moves.ts` is sorted by id,
// so order here does not matter.
//
// Dependency-free CommonJS, evaluated the same way as ewamon.js.

const EWAMON_MOVE_ADDITIONS = {
  // hollowmane's Rage Form signature move (SpeciesDef.battleForm.signatureMove): in Rage Form, Night Slash becomes this.
  // Learned by no species; the replaced slot pays the PP.
  "Hollow Crescent": { power: 110, type: "Ghost", pp: 5, effect: "crit", accuracy: 95 },
  // castlemaw's Rage Form signature move: in Rage Form, Flash Cannon becomes this. Learned by no species.
  "Vendetta Volley": { power: 110, type: "Steel", pp: 5, effect: "burn", accuracy: 90 },
  // glacinid's signature move (a default move, patches.js): the frost dragon draws an aurora across a calm winter sky
  // and seals the foe in ice. Learned by glacinid only.
  "Aurora Requiem": { power: 130, type: "Ice", pp: 5, effect: "freeze", accuracy: 90 },
};

module.exports = { EWAMON_MOVE_ADDITIONS };
