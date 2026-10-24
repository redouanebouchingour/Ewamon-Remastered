/**
 * Camp bases (SPEC §10.7.10): the trophies an owner sets round a travellers' camp's fire and the banner the camp flies,
 * built from the biome set's own prop builders and surfaces (no new asset). One silhouette per trophy kind:
 *
 * - `legend` a legendary caught: the crystal on its carved stand (the crystal housing, its own glow)
 * - `medal` the Champion's medal or a ranked tier: a lit brazier, the victor's flame
 * - `achievement`: a post lantern, lit
 * - `bounty` a bounty brought in: a wanted board (two posts, a plank, pinned notices) with a crate at its foot
 * - `scar` a nemesis scar: a standing stone gouged by three glowing claw marks
 * - the banner: a pole with a crossbar, a cloth flag and a metal finial
 */
import type { SurfaceId } from '../../materials/surfaces.js';
import { Parts, beam, box, lathe, propGeo } from '../geo.js';
import { createPrng } from '../prng.js';
import type { PropGeo } from '../types.js';
import { buildBrazier, buildCrate, buildCrystal, buildLantern } from './props.js';
import type { PropStyle } from './props.js';

export type TrophyKind = 'scar' | 'legend' | 'medal' | 'achievement' | 'bounty';
export const TROPHY_KINDS: readonly TrophyKind[] = Object.freeze(['scar', 'legend', 'medal', 'achievement', 'bounty']);

function tiered(build: (p: Parts, tier: number) => void, order?: readonly SurfaceId[]): PropGeo {
  const t = [new Parts(), new Parts(), new Parts()];
  for (let k = 0; k < 3; k++) build(t[k]!, k);
  return propGeo(t[0]!, t[1]!, t[2]!, null, order);
}

/** A wanted board: two posts, a plank, three pinned notices. */
function buildWantedBoard(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  return tiered((parts, tier) => {
    for (const s of [-1, 1]) box(parts, st.wood, s * 0.55, -0.2, 0, 0.1, 1.95, 0.1, 0, 0.02);
    box(parts, st.wood, 0, 0.75, 0, 1.3, 0.8, 0.06, 0, 0.015);
    box(parts, st.wood, 0, 1.6, 0, 1.4, 0.08, 0.14, 0, 0.012);
    if (tier < 2) {
      for (let k = 0; k < 3; k++) {
        const x = -0.38 + k * 0.38 + (p.next() - 0.5) * 0.06;
        box(parts, st.cloth, x, 0.85 + (p.next() - 0.5) * 0.1, 0.035, 0.3, 0.4, 0.012, (p.next() - 0.5) * 0.12, 0.002);
      }
    }
  }, [st.wood, st.cloth]);
}

/** A standing stone with three glowing claw marks across its face. */
function buildScarStone(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  const lean = (p.next() - 0.5) * 0.08;
  return tiered((parts, tier) => {
    lathe(parts, st.stone, [[0.5, -0.2], [0.5, 0.0], [0.001, 0.02]], { segments: tier === 0 ? 10 : 6, smooth: false });
    box(parts, st.stone, 0, -0.05, 0, 0.62, 1.45, 0.28, lean, tier === 0 ? 0.08 : 0.03);
    box(parts, st.stone, 0, 1.38, 0, 0.5, 0.18, 0.24, lean, 0.06);
    for (let k = 0; k < 3; k++) {
      const x = -0.16 + k * 0.16;
      beam(parts, st.glow, [x - 0.12, 1.15 - k * 0.04, 0.15], [x + 0.12, 0.45 - k * 0.04, 0.15], 0.045, 0.02, 0.004, [0, 0, 1]);
    }
  }, [st.stone, st.glow]);
}

/** The camp's banner: a pole, a crossbar, a cloth flag, a metal finial. */
export function buildCampBanner(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  const sway = (p.next() - 0.5) * 0.06;
  return tiered((parts, tier) => {
    lathe(parts, st.stone, [[0.3, -0.2], [0.3, 0.05], [0.12, 0.12], [0.001, 0.13]], { segments: tier === 0 ? 8 : 6, smooth: false });
    beam(parts, st.wood, [0, -0.1, 0], [0, 3.2, 0], 0.09, 0.09, 0.015);
    beam(parts, st.wood, [-0.55, 3.0, 0.05], [0.55, 3.0, 0.05], 0.06, 0.06, 0.01);
    box(parts, st.cloth, 0, 1.55, 0.06, 1.0, 1.42, 0.035, sway, 0.006);
    if (tier < 2) {
      box(parts, st.metal, 0, 1.5, 0.06, 1.04, 0.06, 0.045, sway, 0.004);
      box(parts, st.glow, 0, 2.2, 0.085, 0.26, 0.26, 0.012, Math.PI / 4, 0.003);
    }
    lathe(parts, st.metal, [[0.001, 3.2], [0.07, 3.24], [0.05, 3.36], [0.001, 3.48]], { segments: 6, smooth: false });
  }, [st.wood, st.cloth, st.metal, st.stone, st.glow]);
}

/** A piece of a trophy and where it stands in the trophy's frame (x, z, yaw, scale; local +z faces the fire). */
export interface TrophyPiece {
  readonly geo: PropGeo;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly scale: number;
}

const at = (geo: PropGeo, x = 0, z = 0, yaw = 0, scale = 1): TrophyPiece => ({ geo, x, z, yaw, scale });

/** The pieces of one trophy of `kind`, built for the zone's set. */
export function buildTrophy(st: PropStyle, kind: TrophyKind, seed: number): TrophyPiece[] {
  switch (kind) {
    case 'legend':
      return [at(buildCrystal(st, seed))];
    case 'medal':
      return [at(buildBrazier(st, seed))];
    case 'achievement':
      return [at(buildLantern(st, seed))];
    case 'bounty':
      return [at(buildWantedBoard(st, seed)), at(buildCrate(st, seed ^ 0x2f), 0.95, -0.25, 0.4, 0.8)];
    case 'scar':
      return [at(buildScarStone(st, seed))];
  }
}
