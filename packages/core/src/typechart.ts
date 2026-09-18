/** §2.2 — type names and the chart lookup. Core defines the shape; content supplies the values. */
import type { Effectiveness, TypeChart, TypeName } from './types';

export const TYPE_NAMES: readonly TypeName[] = [
  'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison',
  'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Steel',
  'Fairy', 'Dark', 'Cosmic',
];

/** Product over defender types; exact results in {0, 0.25, 0.5, 1, 2, 4}. */
export function typeMultiplier(
  chart: TypeChart,
  moveType: TypeName,
  defenderTypes: readonly TypeName[],
): Effectiveness {
  let mult = 1;
  const row = chart[moveType];
  for (let i = 0; i < defenderTypes.length; i++) {
    const v = row === undefined ? undefined : row[defenderTypes[i]!];
    mult *= v === undefined ? 1 : v;
  }
  // 0, 0.25, 0.5, 1, 2, 4 are all exact in binary floating point.
  return mult as Effectiveness;
}
