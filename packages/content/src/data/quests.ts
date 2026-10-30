/**
 * §3.4 QUESTS — the 14 rows of .design/roster-coverage.md §12.1, with the giver NpcDefs authored in zones.ts
 * and the `requires` chain in list order (q11/q12 chain on the mythical flags, not on q10).
 */
import type { QuestDef } from '../types';
import { SPIRIT_WATER_VIAL } from './relics';
import { SHRINES, shrineGuardianId } from './shrines';
import { interiorTrainerFlag } from './interiors';
import { ACHIEVEMENTS } from './achievements';

export const QUESTS: readonly QuestDef[] = [
  {
    id: 'q01_first_witness',
    title: 'First Witness',
    summary: 'Hessa wants a record, not a hobby: walk to Mire Route and witness three species.',
    giver: 'mirevale.archivist',
    zoneId: 'mirevale',
    act: 1,
    requires: [],
    objectives: [
      { id: 'reach_mire', label: 'Reach Mire Route', objective: { kind: 'reachZone', zoneId: 'mire_route' } },
      { id: 'witness_3', label: 'Witness 3 species', objective: { kind: 'catchSpecies', count: 3 } },
    ],
    rewards: { money: 600, items: { potion: 3, crest_orb: 3 }, creature: null, flag: null },
  },
  {
    id: 'q02_thin_hedgerow',
    title: 'The Thin Hedgerow',
    summary: 'Odd Pell keeps two rosters for one hedge. Witness a seedrift by day and a snapling after dark.',
    giver: 'mire_route.forager',
    zoneId: 'mire_route',
    act: 1,
    requires: ['q01_first_witness'],
    objectives: [
      { id: 'seedrift', label: 'Witness a seedrift (day)', objective: { kind: 'catchSpecific', species: 'seedrift' } },
      { id: 'snapling', label: 'Witness a snapling (night)', objective: { kind: 'catchSpecific', species: 'snapling' } },
    ],
    rewards: { money: 900, items: { verdant_orb: 2, superpotion: 2 }, creature: null, flag: null },
  },
  {
    id: 'q03_ember_yard',
    title: 'The Ember Yard',
    summary: 'Brann Sorrel calls you useful if you beat the kindler on the road, witness a fennorange and take the Ember Badge.',
    giver: 'cinderhold.yardmaster',
    zoneId: 'cinderhold',
    act: 1,
    requires: ['q02_thin_hedgerow'],
    objectives: [
      { id: 'kindler', label: 'Defeat Kindler Ysolde on Ash Route', objective: { kind: 'defeatTrainer', trainerId: 'ash_route.kindler' } },
      { id: 'fennorange', label: 'Witness a fennorange', objective: { kind: 'catchSpecific', species: 'fennorange' } },
      { id: 'ember', label: 'Earn the Ember Badge', objective: { kind: 'earnBadge', badge: 'ember' } },
    ],
    rewards: { money: 1400, items: { ember_orb: 3, revive: 1 }, creature: null, flag: null },
  },
  {
    id: 'q04_drowned_harbour',
    title: 'The Drowned Harbour',
    summary: 'Maren wants the mudflat held somewhere he can point at. Witness the wraithtide on the sunk quay and win ten wild battles.',
    giver: 'saltmourn.harbourmaster',
    zoneId: 'saltmourn',
    act: 1,
    requires: ['q03_ember_yard'],
    objectives: [
      { id: 'wraithtide', label: 'Witness a wraithtide at the sunk quay', objective: { kind: 'catchSpecific', species: 'wraithtide' } },
      { id: 'wild_10', label: 'Win 10 wild battles', objective: { kind: 'winBattles', format: 'wild', count: 10 } },
    ],
    rewards: { money: 2500, items: { tide_orb: 3, phantom_orb: 2 }, creature: null, flag: 'harbour_witness' },
  },
  {
    id: 'q05_static_at_midnight',
    title: 'Static at Midnight',
    summary: 'Dov Marrat wants the two things that chew insulation: a darkone from the span after dark and an ampmite from the substation.',
    giver: 'stormrook.linekeeper',
    zoneId: 'stormrook',
    act: 1,
    requires: ['q04_drowned_harbour'],
    objectives: [
      { id: 'darkone', label: 'Witness a darkone (night)', objective: { kind: 'catchSpecific', species: 'darkone' } },
      { id: 'ampmite', label: 'Witness an ampmite', objective: { kind: 'catchSpecific', species: 'ampmite' } },
      { id: 'circuit', label: 'Earn the Circuit Badge', objective: { kind: 'earnBadge', badge: 'circuit' } },
    ],
    rewards: { money: 2200, items: { dusk_orb: 3, hyper_potion: 2, 'tm:Cross Poison': 1 }, creature: null, flag: null },
  },
  {
    id: 'q06_the_deep_cut',
    title: 'The Deep Cut',
    summary: 'Foreman Grell is counting. Reach Deepcut, witness a yahit in the lower cut, and bring your count to thirty.',
    giver: 'marrowdig.foreman',
    zoneId: 'marrowdig',
    act: 2,
    requires: ['q05_static_at_midnight'],
    objectives: [
      { id: 'reach_deepcut', label: 'Reach Deepcut', objective: { kind: 'reachZone', zoneId: 'deepcut_route' } },
      { id: 'yahit', label: 'Witness a yahit', objective: { kind: 'catchSpecific', species: 'yahit' } },
      { id: 'witness_30', label: 'Witness 30 species', objective: { kind: 'catchSpecies', count: 30 } },
    ],
    rewards: { money: 3000, items: { prism_orb: 3, rarecandy: 1, 'tm:Giga Drain': 1 }, creature: null, flag: null },
  },
  {
    id: 'q07_lens_and_latch',
    title: 'Lens and Latch',
    summary: 'Nyx hears a room a mile east. Stand in it, witness a miscarmen, and bring your count to forty-five.',
    giver: 'vesperveil.medium',
    zoneId: 'vesperveil',
    act: 2,
    requires: ['q06_the_deep_cut'],
    objectives: [
      { id: 'reach_observatory', label: 'Reach the Umbral Observatory', objective: { kind: 'reachZone', zoneId: 'umbral_observatory' } },
      { id: 'miscarmen', label: 'Witness a miscarmen (night)', objective: { kind: 'catchSpecific', species: 'miscarmen' } },
      { id: 'witness_45', label: 'Witness 45 species', objective: { kind: 'catchSpecies', count: 45 } },
    ],
    rewards: { money: 4000, items: { phantom_orb: 3, full_heal: 3, 'tm:Shadow Ball': 1 }, creature: null, flag: null },
  },
  {
    id: 'q08_anvil_debt',
    title: 'Anvil Debt',
    summary: 'Sef Anvard counts you one of Forgewall\'s for three full heals, an acier from the road and the Anvil Badge.',
    giver: 'forgewall.quartermaster',
    zoneId: 'forgewall',
    act: 2,
    requires: ['q07_lens_and_latch'],
    objectives: [
      { id: 'deliver', label: 'Deliver 3 Full Heals to the quartermaster', objective: { kind: 'deliverItem', item: 'full_heal', qty: 3, npcId: 'forgewall.quartermaster' } },
      { id: 'acier', label: 'Witness an acier', objective: { kind: 'catchSpecific', species: 'acier' } },
      { id: 'anvil', label: 'Earn the Anvil Badge', objective: { kind: 'earnBadge', badge: 'anvil' } },
    ],
    rewards: { money: 5000, items: { mythos_orb: 1, prism_orb: 3 }, creature: null, flag: null },
  },
  {
    id: 'q09_thin_air',
    title: 'Thin Air',
    summary: 'Rowan Vane opens the upper room to a holder with a serpyre, sixty species and the Ascend Badge.',
    giver: 'skyrend.shrinekeeper',
    zoneId: 'skyrend',
    act: 2,
    requires: ['q08_anvil_debt'],
    objectives: [
      { id: 'serpyre', label: 'Witness a serpyre', objective: { kind: 'catchSpecific', species: 'serpyre' } },
      { id: 'witness_60', label: 'Witness 60 species', objective: { kind: 'catchSpecies', count: 60 } },
      { id: 'ascend', label: 'Earn the Ascend Badge', objective: { kind: 'earnBadge', badge: 'ascend' } },
    ],
    rewards: { money: 6000, items: { mythos_orb: 2, rarecandy: 2 }, creature: null, flag: null },
  },
  {
    id: 'q10_restore_the_grove',
    title: 'Restore the Grove',
    summary: 'After the Permanence notice, Hessa asks for the first settled Seam in forty-one years to come back — yours.',
    giver: 'mirevale.archivist',
    zoneId: 'mirevale',
    act: 3,
    requires: ['q09_thin_air'],
    objectives: [
      { id: 'act3', label: 'Hear the Permanence notice in Solenne', objective: { kind: 'flag', flag: 'act3_started' } },
      { id: 'restore', label: 'Re-remember Mire Route', objective: { kind: 'restoreZone', zoneId: 'mire_route' } },
      { id: 'witness_80', label: 'Witness 80 species', objective: { kind: 'catchSpecies', count: 80 } },
    ],
    rewards: { money: 8000, items: { aether_orb: 1 }, creature: null, flag: 'grove_restored' },
  },
  {
    id: 'q11_first_night',
    title: 'First Night',
    summary: 'The shrine counts the holder when the count is reached: the title, a hundred witnessed, five PvP wins.',
    giver: null,
    zoneId: 'eclipse_shrine',
    act: 3,
    requires: [],
    objectives: [
      { id: 'champion', label: 'Beat Champion Zeon', objective: { kind: 'flag', flag: 'champion:zeon:beaten' } },
      { id: 'witness_100', label: 'Witness 100 species', objective: { kind: 'catchSpecies', count: 100 } },
      { id: 'pvp_5', label: 'Win 5 PvP battles', objective: { kind: 'winBattles', format: 'pvp', count: 5 } },
    ],
    rewards: { money: 10000, items: {}, creature: { species: 'noxmyth', level: 60 }, flag: 'mythical_night' },
  },
  {
    id: 'q12_first_morning',
    title: 'First Morning',
    summary: 'The first morning comes to be counted last of all: the first night held, a hundred and twenty witnessed, twenty wins.',
    giver: null,
    zoneId: 'celestial_spire',
    act: 3,
    requires: ['q11_first_night'],
    objectives: [
      { id: 'night_held', label: 'Hold the first night', objective: { kind: 'flag', flag: 'mythical_night' } },
      { id: 'witness_120', label: 'Witness 120 species', objective: { kind: 'catchSpecies', count: 120 } },
      { id: 'wins_20', label: 'Win 20 battles of any kind', objective: { kind: 'winBattles', format: 'any', count: 20 } },
    ],
    rewards: { money: 15000, items: {}, creature: { species: 'lumyth', level: 60 }, flag: 'mythical_morning' },
  },
  // The Harmonic Cycle: the mythical Elemutt line. Early, the berry-gardener trusts you with the pup that sneezes sparks
  // in her hedge; after the Champion, the four relic shrines (data/shrines.ts) and the Vial that wakes the Avatar State.
  {
    id: 'q13_unaligned_pup',
    title: 'The Unaligned Pup',
    summary: 'A pup in the berry hedge barks embers and sneezes puddles. The gardener will trust it to someone who can win a fight or three.',
    giver: 'mirevale.gardener',
    zoneId: 'mirevale',
    act: 1,
    requires: ['q01_first_witness'],
    objectives: [
      { id: 'wins_3', label: 'Win 3 battles', objective: { kind: 'winBattles', format: 'any', count: 3 } },
      { id: 'witness_5', label: 'Witness 5 species', objective: { kind: 'catchSpecies', count: 5 } },
    ],
    rewards: { money: 500, items: {}, creature: { species: 'elemutt', level: 5 }, flag: null },
  },
  {
    id: 'q14_harmonic_cycle',
    title: 'The Harmonic Cycle',
    summary: 'Four shrines keep the relics of the old masters. Beat the Champion, then prove yourself to each guardian; the Vial of Spirit Water is for whoever holds all four.',
    giver: null,
    zoneId: 'saltmourn',
    act: 3,
    requires: [],
    objectives: [
      { id: 'champion', label: 'Beat Champion Zeon', objective: { kind: 'flag', flag: 'champion:zeon:beaten' } },
      ...SHRINES.map((s) => ({
        id: s.relic,
        label: `Prove yourself in ${s.label}`,
        objective: { kind: 'flag' as const, flag: interiorTrainerFlag(shrineGuardianId(s)) },
      })),
    ],
    rewards: { money: 20000, items: { [SPIRIT_WATER_VIAL]: 1 }, creature: null, flag: null },
  },
  // Kelvyre, the divided mythical: a core of fire and a core of ice forced into one body in Forgewall's old foundry
  // laboratory. It answers only a trainer who has seen almost everything the world has to show.
  {
    id: 'q15_divided_core',
    title: 'The Divided Core',
    summary: 'Something in the sealed foundry lab burns on one side and freezes on the other. It will only come out for the Champion who has witnessed nearly every species and won thirty fights.',
    giver: null,
    zoneId: 'forgewall',
    act: 3,
    requires: [],
    objectives: [
      { id: 'champion', label: 'Beat Champion Zeon', objective: { kind: 'flag', flag: 'champion:zeon:beaten' } },
      { id: 'witness_140', label: 'Witness 140 species', objective: { kind: 'catchSpecies', count: 140 } },
      { id: 'wins_30', label: 'Win 30 battles of any kind', objective: { kind: 'winBattles', format: 'any', count: 30 } },
    ],
    rewards: { money: 20000, items: {}, creature: { species: 'kelvyre', level: 60 }, flag: 'mythical_divided' },
  },
  // Phase D5: the achievements (kind 'achievement', giver null) ride the same list, so they auto-progress and claim
  ...ACHIEVEMENTS,
];
