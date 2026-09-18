/**
 * §2.15 — catch. Gen-3/4 curve. CATCH_B is a committed literal generated once by
 * scripts/gen-catch-table.ts (CATCH_B[a] = floor(65536 / (255 / a) ** 0.1875), CATCH_B[0] = 0);
 * Math.pow never runs at sim time.
 */
import { majorStatus } from './status';
import type { Battler, OrbDef, Rng, SpeciesDef } from './types';

export const CATCH_B: readonly number[] = [
  0, 23187, 26405, 28491, 30070, 31355, 32445, 33397, 34243, 35008, 35707, 36350, 36948, 37507, 38032, 38527,
  38996, 39442, 39867, 40273, 40662, 41036, 41395, 41742, 42076, 42400, 42713, 43016, 43310, 43596, 43874, 44145,
  44408, 44665, 44916, 45161, 45400, 45634, 45863, 46086, 46306, 46521, 46731, 46938, 47141, 47340, 47535, 47727,
  47916, 48102, 48284, 48464, 48641, 48815, 48986, 49155, 49321, 49485, 49647, 49806, 49963, 50119, 50272, 50423,
  50572, 50719, 50864, 51008, 51150, 51290, 51429, 51566, 51701, 51835, 51967, 52098, 52228, 52356, 52483, 52608,
  52733, 52856, 52977, 53098, 53217, 53335, 53453, 53568, 53683, 53797, 53910, 54022, 54133, 54243, 54351, 54459,
  54566, 54673, 54778, 54882, 54986, 55088, 55190, 55291, 55392, 55491, 55590, 55688, 55785, 55881, 55977, 56072,
  56167, 56260, 56353, 56446, 56537, 56628, 56719, 56809, 56898, 56987, 57075, 57162, 57249, 57335, 57421, 57506,
  57591, 57675, 57758, 57841, 57924, 58006, 58087, 58168, 58249, 58329, 58409, 58488, 58566, 58645, 58722, 58800,
  58877, 58953, 59029, 59105, 59180, 59255, 59329, 59403, 59477, 59550, 59622, 59695, 59767, 59839, 59910, 59981,
  60051, 60122, 60191, 60261, 60330, 60399, 60467, 60535, 60603, 60671, 60738, 60805, 60871, 60937, 61003, 61069,
  61134, 61199, 61264, 61328, 61392, 61456, 61520, 61583, 61646, 61708, 61771, 61833, 61895, 61956, 62018, 62079,
  62140, 62200, 62261, 62321, 62380, 62440, 62499, 62558, 62617, 62676, 62734, 62792, 62850, 62908, 62965, 63022,
  63079, 63136, 63193, 63249, 63305, 63361, 63417, 63472, 63527, 63582, 63637, 63692, 63746, 63800, 63854, 63908,
  63962, 64015, 64069, 64122, 64175, 64227, 64280, 64332, 64384, 64436, 64488, 64539, 64591, 64642, 64693, 64744,
  64795, 64845, 64896, 64946, 64996, 65046, 65095, 65145, 65194, 65244, 65293, 65342, 65390, 65439, 65487, 65536,
];

/** Orb multiplier against this wild battler: catchRate × bonus multiplier when the bonus matches. */
export function orbMultiplier(orb: OrbDef, wild: Battler, species: SpeciesDef): number {
  let m = orb.catchRate;
  if (orb.bonus === null) return m;
  if (orb.bonus.kind === 'type') {
    if (species.types.indexOf(orb.bonus.type) !== -1) m *= orb.bonus.multiplier;
  } else if (wild.creature.isAlpha || wild.creature.variantKey !== 'normal') {
    m *= orb.bonus.multiplier;
  }
  return m;
}

/** 2 for sleep/freeze, 1.5 for burn/poison/paralyze, 1 otherwise. */
export function catchStatusBonus(wild: Battler): number {
  const s = majorStatus(wild.creature.status);
  if (s === 'sleep' || s === 'freeze') return 2;
  if (s === null) return 1;
  return 1.5;
}

/** The `a` value of §2.15: floor((3M - 2H) * rate * orb * statusBonus / (3M)), min 1. */
export function catchValue(wild: Battler, species: SpeciesDef, orb: OrbDef): number {
  const M = wild.maxHp;
  const H = wild.creature.hp;
  let rate = species.catchRate;
  if (wild.creature.isAlpha) rate = Math.max(3, Math.floor(rate / 2));
  const a = Math.floor(((3 * M - 2 * H) * rate * orbMultiplier(orb, wild, species) * catchStatusBonus(wild)) / (3 * M));
  return Math.max(1, a);
}

export interface CatchRoll {
  readonly a: number;
  readonly caught: boolean;
  /** Raw 0..4; 4 = caught. */
  readonly shakes: 0 | 1 | 2 | 3 | 4;
}

/** a >= 255 → caught with 0 rng draws; otherwise up to 4 draws of rng.int(65536) against CATCH_B[a]. */
export function resolveCatch(wild: Battler, species: SpeciesDef, orb: OrbDef, rng: Rng): CatchRoll {
  const a = catchValue(wild, species, orb);
  if (a >= 255) return { a, caught: true, shakes: 4 };
  const b = CATCH_B[a]!;
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (rng.int(65536) < b) shakes++;
    else break;
  }
  return { a, caught: shakes === 4, shakes: shakes as 0 | 1 | 2 | 3 | 4 };
}
