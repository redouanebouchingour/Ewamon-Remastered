/**
 * `BIOME_GENERATORS` (keys = `Biome`, SPEC §10.5.1 `GeneratorSet`) and the set-piece registry (21 ids; "only the id
 * decides which sub-generator runs", §10.5.4), plus the hand-placed prop registry shared by every set.
 */
import type { GeneratorSet, SetPieceId } from '../../contracts.js';
import type { SurfaceId } from '../../materials/surfaces.js';
import type { PropGeo } from '../types.js';
import { buildBush, buildFlowers, buildLog, buildRock, buildStump, buildTree, TREE_SHAPES } from './nature.js';
import {
  buildBarrel, buildBeacon, buildBench, buildBrazier, buildCandle, buildCart, buildCrate, buildCrystal, buildFence, buildGarden, buildLantern,
  buildPlanter, buildSign, buildStall, buildWell,
} from './props.js';
import { GROVE_SET } from './grove.js';
import { OTHER_SETS } from './biomes.js';
import type { BiomeSet, SetPieceBuilder } from './set.js';

export const BIOME_GENERATORS: Readonly<Record<GeneratorSet, BiomeSet>> = { grove: GROVE_SET, ...OTHER_SETS };

/** Every set-piece builder, from whichever set owns it. */
export const SET_PIECE_BUILDERS: Readonly<Partial<Record<SetPieceId, SetPieceBuilder>>> = Object.assign({}, ...Object.values(BIOME_GENERATORS).map((s) => s.setPieces));

/**
 * Footprint radius (m, before the capsule radius) of a hand-placed prop kind (0 = walk-through, or a rectangle:
 * garden, bench, fence). Content's `PROP_SOLID_RADIUS` is the same table — it stamps these footprints into the
 * heightfield's `walkable`; `packages/client/test/footprints.test.ts` asserts the builder's footprints equal content's.
 */
export const PROP_BLOCKER: Readonly<Record<string, number>> = {
  well: 1.25, cart: 1.1, stall: 1.4, bench: 0.7, planter: 0.75, barrel: 0.4, crate: 0.5, sign: 0.2, rock_l: 1.0, rock_m: 0.65, rock_s: 0,
  tree_oak: 0.5, tree_birch: 0.35, tree_willow: 0.55, stump: 0.45, log: 0.6, bush: 0, flower_patch: 0, fence: 0, garden: 0,
};
/** A fence run's footprint half extents (`buildFence` below: 0.13 m posts every 1.8 m over local x ∈ [−1.8, 1.8]). */
export const FENCE_FOOTPRINT = { hw: 1.865, hd: 0.065 } as const;

/** Builds one hand-placed prop kind with the set's surfaces (null = unknown kind). */
export function buildPropKind(set: BiomeSet, kind: string, seed: number): PropGeo | null {
  const st = set.props;
  const tree = (name: string): PropGeo => {
    const t = set.trees.find((x) => x.kind === name) ?? set.trees[0]!;
    return buildTree(t.bark, t.leaf, t.shape, seed);
  };
  switch (kind) {
    case 'tree_oak': case 'tree_birch': case 'tree_willow': case 'tree_pine': case 'tree_dead': return tree(kind);
    case 'rock_s': return buildRock(set.rock, seed, { size: 0.45, squash: 0.6, elongate: 1.3, cuts: [3, 5] });
    case 'rock_m': return buildRock(set.rock, seed, { size: 0.8, squash: 0.62, elongate: 1.3, cuts: [3, 5] });
    case 'rock_l': return buildRock(set.rock, seed, { size: 1.4, squash: 0.7, elongate: 1.25, cuts: [3, 5] });
    case 'stump': return buildStump(set.trees[0]?.bark ?? st.wood, st.wood, seed);
    case 'log': return buildLog(set.trees[0]?.bark ?? st.wood, st.wood, seed);
    case 'bush': return buildBush(set.bushLeaf ?? st.leaf, seed);
    case 'flower_patch': return buildFlowers(set.flower ?? 'plaster', seed);
    case 'sign': return buildSign(st, seed);
    case 'well': return buildWell(st, set.building.roofs.slate, seed);
    case 'cart': return buildCart(st, seed);
    case 'crate': return buildCrate(st, seed);
    case 'barrel': return buildBarrel(st, seed);
    case 'bench': return buildBench(st, seed);
    case 'planter': return buildPlanter(st, seed);
    case 'stall': return buildStall(st, seed);
    case 'garden': return buildGarden(st, seed);
    case 'fence': return buildFence(st, [[-1.8, 0], [1.8, 0]], seed);
    default: return null;
  }
}

/** A generated light housing (`LightSource.housing.generator`). */
export function buildHousing(set: BiomeSet, generator: 'lantern' | 'brazier' | 'beacon' | 'window' | 'crystal' | 'candle', seed: number): PropGeo {
  switch (generator) {
    case 'brazier': return buildBrazier(set.props, seed);
    case 'beacon': return buildBeacon(set.props, seed);
    case 'crystal': return buildCrystal(set.props, seed);
    case 'candle': return buildCandle(set.props, seed);
    default: return buildLantern(set.props, seed);
  }
}

export { TREE_SHAPES };
export type { BiomeSet, SurfaceId };
