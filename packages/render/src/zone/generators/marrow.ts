/**
 * §10.5.4 — the `marrow` set (Marrowdig, Deepcut Route): sandstone miners' houses with mine-timber lintels and
 * iron-plate roofs, ore carts, sandstone boulders, bleached dead trees; set-pieces `marrow_mineshaft` (a timber
 * headframe with a lathed winding wheel over a shaft collar, two lanterns) and `deepcut_arch` (a natural sandstone
 * arch spanning the road, a lantern on its pier).
 */
import { Matrix4, Shape } from 'three/webgpu';
import { beam, box, extrude, lathe, trs } from '../geo.js';
import { createPrng } from '../prng.js';
import type { BuildingStyle } from './buildings.js';
import { addPropTier, disposeProp, finish, lanternAt, spLights, tiers3 } from './common.js';
import { TREE_SHAPES, buildRock } from './nature.js';
import type { PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

const TAU = Math.PI * 2;

export const MARROW_BUILDING: BuildingStyle = {
  wall: 'marrow_sandstone', upperWall: 'plaster', frame: 'mine_timber', plinth: 'bone_chalk', door: 'mine_timber', glass: 'mist_glass', litGlass: 'glass_warm',
  sill: 'bone_chalk', trim: 'mine_timber', chimney: 'marrow_sandstone', metal: 'rail_iron', greenery: null,
  roofs: { slate: 'slate_roof', thatch: 'mine_timber', tile: 'forge_brick', plate: 'rail_iron' },
  storey: 2.6, pitchDeg: 26, overhang: 0.3, stoneBand: 0,
};

export const MARROW_PROPS: PropStyle = {
  wood: 'mine_timber', metal: 'rail_iron', stone: 'marrow_sandstone', housingGlass: 'glass_warm', glow: 'ore_vein', crystal: 'gypsum_crystal', candle: 'glass_warm',
  cloth: 'mine_timber', soil: 'canyon_dust', leaf: 'tall_grass', rock: 'marrow_sandstone', water: 'water_pond',
};

/** `marrow_mineshaft`: shaft collar, A-frame headframe with a spoked winding wheel, ore cart on rails, two lanterns. */
function mineshaft(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const [L0, L1] = t;
  for (const parts of t) {
    box(parts, 'marrow_sandstone', 0, -0.4, 0, 4.2, 0.9, 4.2, 0, 0.06);
    box(parts, 'canyon_dust', 0, 0.44, 0, 2.8, 0.06, 2.8, 0, 0.02);
  }
  for (const parts of [L0, L1]) {
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]] as const) beam(parts, 'mine_timber', [x, 0.5, z], [x * 0.35, 7.2, z * 0.35], 0.26, 0.26, 0.04);
    beam(parts, 'mine_timber', [-1.8, 7.2, 0], [1.8, 7.2, 0], 0.3, 0.3, 0.04);
  }
  for (let y = 2.2; y < 6.5; y += 2.1) {
    beam(L0, 'mine_timber', [-1.6 + y * 0.18, y, -1.6 + y * 0.18], [1.6 - y * 0.18, y, -1.6 + y * 0.18], 0.16, 0.16, 0.03);
    beam(L0, 'mine_timber', [-1.6 + y * 0.18, y, 1.6 - y * 0.18], [1.6 - y * 0.18, y, 1.6 - y * 0.18], 0.16, 0.16, 0.03);
  }
  // winding wheel
  const wm = trs(0, 7.9, 0).multiply(new Matrix4().makeRotationX(Math.PI / 2));
  lathe(L0, 'rail_iron', [[1.4, -0.12], [1.55, -0.1], [1.55, 0.1], [1.4, 0.12], [1.4, -0.12]], { segments: 24, smooth: false }, wm);
  lathe(L0, 'rail_iron', [[0.25, -0.2], [0.25, 0.2]], { segments: 10, smooth: false, capTop: true, capBottom: true }, wm);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    beam(L0, 'rail_iron', [0, 7.9, 0], [Math.cos(a) * 1.42, 7.9 + Math.sin(a) * 1.42, 0], 0.06, 0.06, 0.012);
  }
  lathe(L1, 'rail_iron', [[1.5, -0.1], [1.5, 0.1]], { segments: 12, smooth: false }, wm);
  // rails and a cart
  for (const s of [-0.45, 0.45]) beam(L0, 'rail_iron', [s, 0.5, 2.1], [s, 0.25, 6.5], 0.06, 0.08, 0.01, [0, 1, 0]);
  box(L0, 'rail_iron', 0, 0.45, 4.6, 1.2, 0.7, 1.6, 0, 0.04);
  const ore = buildRock('ore_vein', ctx.seed, { size: 0.35, squash: 0.6, elongate: 1.3, cuts: [3, 4] });
  addPropTier(L0, ore, 0, trs(0, 1.1, 4.6));
  disposeProp(ore);
  for (const l of spLights('marrow_mineshaft')) lanternAt(t, ctx.set, l.x, l.y, l.z, ctx.ground(l.x, l.z), ctx.seed + Math.round(l.x * 7));
  return finish(t, ['marrow_sandstone', 'canyon_dust', 'mine_timber', 'rail_iron', 'ore_vein', 'lantern_metal', 'glass_warm']);
}

/** `deepcut_arch`: an eroded sandstone arch (extruded, layered) over the road with boulders at its feet and a lantern. */
function deepcutArch(ctx: SetPieceContext): PropGeo {
  const p = createPrng(ctx.seed);
  const t = tiers3();
  const span = 11; const h = 6.5;
  const arch = new Shape();
  arch.moveTo(-span / 2 - 2.2, -1); arch.lineTo(-span / 2 - 1.6, h * 0.55); arch.quadraticCurveTo(-span / 2 - 0.9, h + 1.6, 0, h + 1.9);
  arch.quadraticCurveTo(span / 2 + 0.9, h + 1.6, span / 2 + 1.6, h * 0.55); arch.lineTo(span / 2 + 2.2, -1);
  arch.lineTo(span / 2 - 0.1, -1); arch.quadraticCurveTo(span / 2, h, 0, h); arch.quadraticCurveTo(-span / 2, h, -span / 2 + 0.1, -1); arch.lineTo(-span / 2 - 2.2, -1);
  for (let layer = 0; layer < 3; layer++) {
    const z = -2.4 + layer * 1.6;
    const m = trs(0, 0, z).multiply(new Matrix4().makeScale(1 + (p.next() - 0.5) * 0.06, 1 - layer * 0.02, 1));
    extrude(t[0], 'marrow_sandstone', arch, 1.6, 0.12, m, { curveSegments: 10 });
    if (layer !== 1) extrude(t[1], 'marrow_sandstone', arch, 2.4, 0.08, trs(0, 0, z - 0.4), { curveSegments: 5 });
  }
  extrude(t[2], 'marrow_sandstone', arch, 4.8, 0.05, trs(0, 0, -2.4), { curveSegments: 4 });
  for (let k = 0; k < 6; k++) {
    const g = buildRock('marrow_sandstone', ctx.seed + k, { size: 0.8 + p.next() * 0.6, squash: 0.6, elongate: 1.3, cuts: [3, 5] });
    const x = (k < 3 ? -1 : 1) * (span / 2 + 2.6 + p.next() * 1.5);
    addPropTier(t[0], g, 0, trs(x, ctx.ground(x, 0), (p.next() - 0.5) * 5, p.next() * TAU));
    disposeProp(g);
  }
  for (const l of spLights('deepcut_arch')) lanternAt(t, ctx.set, l.x, l.y, l.z, ctx.ground(l.x, l.z), ctx.seed + 3);
  return finish(t, ['marrow_sandstone', 'lantern_metal', 'glass_warm']);
}

export const MARROW_SET: BiomeSet = {
  biome: 'marrow',
  building: MARROW_BUILDING,
  props: MARROW_PROPS,
  trees: [{ kind: 'tree_dead', shape: { ...TREE_SHAPES.dead, height: 0.8 }, bark: 'bone_chalk', leaf: 'tall_grass', weight: 1 }],
  rock: 'marrow_sandstone',
  tallGrass: 'tall_grass',
  tuft: 'tall_grass',
  bushLeaf: null,
  flower: null,
  density: { treeMargin: 0.006, treeInterior: 0.006, rock: 0.02, bush: 0, flower: 0, tuft: 0.1, tallGrass: 2.0 },
  boundary: 'rocks',
  accent: 'ore_vein',
  setPieces: { marrow_mineshaft: mineshaft, deepcut_arch: deepcutArch },
};
