/**
 * The Original Master Relics: five held items that open ravatar's relic forms (`SpeciesDef.battleForms[].heldItem`,
 * core `checkBattleForm`). No hooks of their own and never sold. The four elemental relics wait in the postgame shrines
 * (data/shrines.ts); the Vial of Spirit Water is the reward of quest q14, once all four are found.
 */
import type { ItemDef } from '@ewa/core';

export const SPIRIT_KOI_SCALE = 'spirit_koi_scale';
export const BADGERMOLE_GEM = 'badgermole_gem';
export const SUN_DRAGON_EMBER = 'sun_dragon_ember';
export const SKY_BISON_WHISTLE = 'sky_bison_whistle';
export const SPIRIT_WATER_VIAL = 'spirit_water_vial';

const relic = (id: string, name: string, description: string): ItemDef => ({
  id,
  name,
  description,
  slot: 'held',
  fieldVerb: null,
  hooks: [],
  price: null,
});

export const RELICS: readonly ItemDef[] = [
  relic(SPIRIT_KOI_SCALE, 'Spirit Koi Scale', 'A shimmering scale from the northern spirit oasis. Held by Ravatar, it takes the Water Form as it enters battle.'),
  relic(BADGERMOLE_GEM, 'Badgermole Gem', 'A green crystal that hums with the slow pulse of the ground. Held by Ravatar, it takes the Ground/Rock Earth Form as it enters battle.'),
  relic(SUN_DRAGON_EMBER, 'Sun Dragon Ember', 'An ember that has never once gone cold. Held by Ravatar, it takes the Fire Form as it enters battle.'),
  relic(SKY_BISON_WHISTLE, 'Sky Bison Whistle', 'A carved wooden whistle that catches every passing draft. Held by Ravatar, it takes the Flying Air Form as it enters battle.'),
  relic(SPIRIT_WATER_VIAL, 'Vial of Spirit Water', 'Water drawn where every element meets. Held by Ravatar, it wakes the Normal/Psychic Avatar State when its HP drops below 30%.'),
];
