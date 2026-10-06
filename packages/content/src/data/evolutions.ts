/**
 * Phase D3 — the nine families moved from level evolution to a stone or a trade. The generated `species.ts` carries
 * these values (the generator `scripts/migrate-legacy.ts` applies this table over the legacy level, keeping the
 * legacy level for learnset spacing so every learnset is unchanged); `test/evolutions.test.ts` asserts both agree.
 *
 * Chosen away from every species the progression walker trains or fixtures hold and every league team, so the
 * story walk evolves exactly as before. Each stone is sold in later towns (`PROGRESSION_STOCK`) — validate checks it.
 */
import type { Evolution } from '@ewa/core';

export const STONE_AND_TRADE_EVOLUTIONS: Readonly<Record<string, Exclude<Evolution, null>>> = {
  embrock: { kind: 'item', item: 'ember_stone', into: 'magmolith' },
  flampling: { kind: 'item', item: 'ember_stone', into: 'solpyre' },
  stormchick: { kind: 'item', item: 'storm_stone', into: 'thundrix' },
  mossling: { kind: 'item', item: 'tide_stone', into: 'verdatide' },
  seedrift: { kind: 'item', item: 'verdant_stone', into: 'blossomsail' },
  berkest: { kind: 'item', item: 'moon_stone', into: 'clementar' },
  hexroach: { kind: 'item', item: 'dusk_stone', into: 'blighthex' },
  glowtent: { kind: 'trade', into: 'toxiveil' },
  resilith: { kind: 'trade', into: 'resilithorn' },
};
