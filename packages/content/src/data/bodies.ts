/**
 * §3.12 bodies and titles, plus the character-look vocabulary every NpcDef/TrainerDef/LeagueTrainer `look`
 * must draw from. LOOKS are the snake_case stems of the 19 CC0 Quaternius characters in
 * assets-src/models/quaternius (40-pipelines.md §40.2.5 `models.manifest.json` `looks` keys).
 */
import type { BodyDef } from '../types';

export const LOOKS: readonly string[] = [
  'blue_soldier_male',
  'casual2_female',
  'casual2_male',
  'casual3_male',
  'casual_female',
  'casual_male',
  'cowboy_female',
  'cowboy_male',
  'doctor_female_young',
  'kimono_male',
  'knight_golden_male',
  'knight_male',
  'ninja_male',
  'old_classy_female',
  'old_classy_male',
  'pirate_male',
  'soldier_male',
  'suit_male',
  'viking_male',
];

/** ≥ 10 rows; 'ranger_m' is the persist default (players.body) and must exist. */
export const BODIES: readonly BodyDef[] = [
  { id: 'ranger_m', name: 'Ranger', look: 'casual_male', palette: null },
  { id: 'ranger_f', name: 'Ranger', look: 'casual_female', palette: null },
  { id: 'drifter_m', name: 'Drifter', look: 'casual2_male', palette: 'dusk' },
  { id: 'drifter_f', name: 'Drifter', look: 'casual2_female', palette: 'dusk' },
  { id: 'apprentice_m', name: 'Apprentice', look: 'casual3_male', palette: null },
  { id: 'scholar_m', name: 'Scholar', look: 'suit_male', palette: null },
  { id: 'scholar_f', name: 'Scholar', look: 'old_classy_female', palette: null },
  { id: 'fisher_m', name: 'Fisher', look: 'cowboy_male', palette: 'tide' },
  { id: 'fisher_f', name: 'Fisher', look: 'cowboy_female', palette: 'tide' },
  { id: 'healer_f', name: 'Healer', look: 'doctor_female_young', palette: null },
  { id: 'pilgrim_m', name: 'Pilgrim', look: 'kimono_male', palette: null },
  { id: 'warden_m', name: 'Warden', look: 'knight_male', palette: 'forge' },
  { id: 'duelist_m', name: 'Duelist', look: 'ninja_male', palette: null },
  { id: 'elder_m', name: 'Elder', look: 'old_classy_male', palette: null },
];

/** `POST /profile` accepts only these; 'Rookie Trainer' is the persist default. */
export const TITLES: readonly string[] = [
  'Rookie Trainer',
  'Witness',
  'Route-Walker',
  'Hedge Reader',
  'Badge Collector',
  'Attestor',
  'Holder',
  'Ledger Reader',
  "Warden's Friend",
  'Grove Restorer',
  'Champion',
  'Holder of the Name',
];
