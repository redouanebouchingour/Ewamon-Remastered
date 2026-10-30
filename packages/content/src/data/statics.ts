/**
 * §3.2 LEGENDARY_STATICS: exactly 10 rows (the 8 legacy legendaries plus the post-legacy hyoryu and astaroth): roster-coverage.md §7 coordinates/levels with the gates of
 * story-bible.md §7.2 (galaxion `flag:ledger_read` replaces roster's `badge:anvil` placeholder — spec CHANGELOG).
 * Coordinates are authored inside the playable interior and snapped with nearestWalkable(h, x, z, 8) at validate;
 * `voidraxis` (0, 84) sits exactly on the interior boundary of a story zone and snaps inward.
 */
import type { LegendaryStatic } from '../types';
import { CRYPT_STATIC_AT, SUNKEN_CRYPT } from './hideouts';

export const LEGENDARY_STATICS: readonly LegendaryStatic[] = [
  { species: 'raikitsune', level: 30, zoneId: 'galvan_route', x: -84, z: 96, flag: 'leg_raikitsune', when: 'badge:circuit' },
  { species: 'bankaiser', level: 42, zoneId: 'forgewall', x: 52, z: -60, flag: 'leg_bankaiser', when: 'badge:anvil' },
  { species: 'galaxion', level: 45, zoneId: 'umbral_observatory', x: 0, z: -72, flag: 'leg_galaxion', when: 'flag:ledger_read' },
  { species: 'sunjaw', level: 55, zoneId: 'ash_route', x: 96, z: -88, flag: 'leg_sunjaw', when: 'flag:champion:zeon:beaten' },
  { species: 'glacinid', level: 55, zoneId: 'ascent_route', x: -96, z: -96, flag: 'leg_glacinid', when: 'flag:champion:zeon:beaten' },
  { species: 'voltaura', level: 55, zoneId: 'galvan_route', x: 92, z: -40, flag: 'leg_voltaura', when: 'flag:champion:zeon:beaten' },
  { species: 'zenryu', level: 60, zoneId: 'eclipse_shrine', x: 0, z: -80, flag: 'leg_zenryu', when: 'flag:champion:zeon:beaten' },
  { species: 'voidraxis', level: 65, zoneId: 'the_rift', x: 0, z: 84, flag: 'leg_voidraxis', when: 'flag:champion:zeon:beaten' },
  // post-legacy (#138): the frozen terrace at the head of the Ascent, after the title. Not on ascent_route itself: there the
  // sprite planner's pairing duplicates 6 species in the_rift (79 atlases); most other zones plan 76 atlases, none duplicated
  { species: 'hyoryu', level: 60, zoneId: 'eclipse_shrine', x: -70, z: -70, flag: 'leg_hyoryu', when: 'flag:champion:zeon:beaten' },
  // post-legacy (#180): inside the Sunken Crypt behind Vesperveil's graveyard (data/hideouts.ts), before an empty throne;
  // x / z are the crypt outside, `interior` the spot in its hall (content `staticsFor` resolves it)
  { species: 'astaroth', level: 60, zoneId: 'vesperveil', x: -50, z: 35, flag: 'leg_astaroth', when: 'flag:champion:zeon:beaten', interior: { building: SUNKEN_CRYPT, ...CRYPT_STATIC_AT } },
];

/** The 10 non-mythical legendaries (rule 7, hyoryu and astaroth post-legacy); the two mythicals are quest rewards / the battle-pass 50 choice. */
export const LEGENDARY_IDS: readonly string[] = [
  'raikitsune',
  'bankaiser',
  'galaxion',
  'sunjaw',
  'glacinid',
  'voltaura',
  'zenryu',
  'voidraxis',
  'hyoryu',
  'astaroth',
];
// the Elemutt line (the Harmonic Cycle): a mythical family; elemutt comes from quest q13 and evolves into the other two.
// kelvyre (Fire/Ice, post-legacy) is the reward of quest q15.
export const MYTHICAL_IDS: readonly string[] = ['lumyth', 'noxmyth', 'elemutt', 'katamute', 'ravatar', 'kelvyre'];
/** The battle pass level 50 choice: the two single mythicals (the Elemutt line is a quest family). */
export const BATTLE_PASS_MYTHICALS: readonly string[] = ['lumyth', 'noxmyth'];
