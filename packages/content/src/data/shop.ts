/** §3.8 Shop and marketplace constants. */

/** Legacy SHOP_STOCK with the two misspellings (`hyperpotion`, `fullheal`) corrected to the canonical consumable ids. */
export const SHOP_STOCK_DEFAULT: readonly string[] = [
  'potion',
  'superpotion',
  'hyper_potion',
  'full_heal',
  'revive',
  'spark_orb',
  'crest_orb',
  'prism_orb',
  'dusk_orb',
];

export const MARKET = {
  listMaxPerHour: 5,
  bidMaxPerHour: 30,
  durationsHours: [12, 24, 48] as const,
  minStartingBid: 100,
  feePercent: 5,
} as const;
