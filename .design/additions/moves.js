// Moves added after the legacy migration, in the legacy `MOVES` row shape (power, type, pp, effect, accuracy). An addition
// may also set `effectChance`, `contact`, `typeFromForm`, `effectOnlyBaseForm` and `description` (core MoveDef).
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
  // hyoryu's signature move (pinned as its newest learnable move): ice petals open across the sky around the foe and
  // close into a crimson lotus of ice. Dragon, so it keeps its STAB in the Dragon/Dark Majin form. Learned by hyoryu only.
  "Crimson Lotus Prison": { power: 120, type: "Dragon", pp: 5, effect: "freeze", accuracy: 90 },
  // ravatar's signature move (pinned as its newest learnable move): the energy of every past life, drawn in at once.
  // Its type follows the relic form it holds (`typeFromForm`); in its base form (no relic) it has a 20% chance to raise
  // Attack, Defense and Speed (`effectOnlyBaseForm`). Non-contact, so it counts as a "special" move. Learned by ravatar only.
  "Cosmic Convergence": {
    power: 100, type: "Normal", pp: 5, effect: "raise_all", accuracy: 100,
    effectChance: 20, contact: false, typeFromForm: true, effectOnlyBaseForm: true,
    description: "Takes the type of Ravatar's relic form, Normal in its base form; 100 power; 100% accuracy; 5 PP. In its base form, 20% chance to raise the user's Attack, Defense and Speed by one stage each.",
  },
  // The first low-power Cosmic attack (2026-10-26): Twinklit and Meteorb start with it, so a Cosmic line has STAB
  // before Starfall (90). Plain damage, no effect.
  "Comet Tap": { power: 40, type: "Cosmic", pp: 30, effect: null, accuracy: 100, contact: false },
  // astaroth's signature move (pinned as its newest learnable move): the demon lord dissolves into smoke, a five-leaf
  // clover sigil flares under the foe and it drops onto it with both blades. Learned by astaroth only.
  "Demon Lord's Descent": { power: 120, type: "Dark", pp: 5, effect: "flinch", accuracy: 90 },
};

module.exports = { EWAMON_MOVE_ADDITIONS };
