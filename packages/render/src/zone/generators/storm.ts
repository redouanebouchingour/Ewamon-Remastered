/**
 * §10.5.4 — the `storm` set (Stormrook, Galvan Route): squat stone houses under slate and verdigris roofs, brass
 * fittings, crystal lamps, slate outcrops, wind-bent pines; set-pieces `storm_coil_tower` (a stone tower wound with
 * brass coils under a lightning-glass crown — the light at 9.2 m) and `galvan_span` (a copper truss bridge on two
 * pylons capped with crystal insulators).
 */
import { Matrix4 } from 'three/webgpu';
import { beam, box, lathe, trs } from '../geo.js';
import type { BuildingStyle } from './buildings.js';
import { finish, spLights, tiers3, tower } from './common.js';
import { TREE_SHAPES } from './nature.js';
import type { PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

export const STORM_BUILDING: BuildingStyle = {
  wall: 'tower_stone', upperWall: 'tower_stone', frame: null, plinth: 'storm_slate', door: 'harbour_plank', glass: 'insulator_glass', litGlass: 'glass_warm',
  sill: 'storm_slate', trim: 'copper_oxide', chimney: 'tower_stone', metal: 'coil_brass', greenery: null,
  roofs: { slate: 'storm_slate', thatch: 'storm_slate', tile: 'copper_oxide', plate: 'copper_oxide' },
  storey: 2.6, pitchDeg: 34, overhang: 0.25, stoneBand: 0,
};

export const STORM_PROPS: PropStyle = {
  wood: 'harbour_plank', metal: 'coil_brass', stone: 'tower_stone', housingGlass: 'lightning_glass', glow: 'lightning_glass', crystal: 'lightning_glass', candle: 'lightning_glass',
  cloth: 'copper_oxide', soil: 'storm_slate', leaf: 'pine_needle', rock: 'storm_slate', water: 'water_pond',
};

/** `storm_coil_tower`: tower, three brass coil rings, copper cap, a lightning-glass crown (the housing, light at 9.2 m). */
function coilTower(_ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const l = spLights('storm_coil_tower')[0]!;
  for (const [k, parts] of t.entries()) {
    const seg = k === 0 ? 20 : 10;
    tower(parts, 'tower_stone', 'storm_slate', 2.0, 7.4, seg);
    for (const y of [2.6, 4.4, 6.2]) lathe(parts, 'coil_brass', [[1.95, y - 0.16], [2.15, y - 0.1], [2.18, y], [2.15, y + 0.1], [1.95, y + 0.16]], { segments: seg, smooth: true });
    lathe(parts, 'copper_oxide', [[2.2, 8.0], [1.3, 8.4], [0.5, 8.6]], { segments: seg, smooth: false });
    lathe(parts, 'lightning_glass', [[0.001, l.y - 0.7], [0.42, l.y - 0.25], [0.38, l.y + 0.35], [0.001, l.y + 1.1]], { segments: 6, smooth: false });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    beam(t[0], 'coil_brass', [Math.cos(a) * 0.5, 8.5, Math.sin(a) * 0.5], [Math.cos(a) * 0.15, l.y + 0.9, Math.sin(a) * 0.15], 0.06, 0.06, 0.015);
  }
  box(t[0], 'harbour_plank', 0, 0.5, 2.05, 1.0, 2.0, 0.12, 0, 0.02);
  return finish(t, ['tower_stone', 'storm_slate', 'coil_brass', 'copper_oxide', 'lightning_glass', 'harbour_plank']);
}

/** `galvan_span`: two lattice pylons with crystal insulators (the lights) carrying a copper truss over the road. */
function galvanSpan(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const [L0, L1] = t;
  const lights = spLights('galvan_span');
  for (const l of lights) {
    const g = ctx.ground(l.x, l.z);
    for (const parts of [L0, L1]) {
      box(parts, 'storm_slate', l.x, g - 0.3, l.z, 1.6, 0.8, 1.6, 0, 0.05);
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as const) beam(parts, 'copper_oxide', [l.x + dx, g + 0.4, l.z + dz], [l.x + dx * 0.3, l.y - 0.6, l.z + dz * 0.3], 0.12, 0.12, 0.02);
    }
    for (let y = g + 1.2; y < l.y - 0.8; y += 0.9) {
      const f = (y - g) / (l.y - g);
      const w = 0.5 - f * 0.35;
      beam(L0, 'copper_oxide', [l.x - w, y, l.z - w], [l.x + w, y + 0.9, l.z + w], 0.05, 0.05, 0.01);
      beam(L0, 'copper_oxide', [l.x + w, y, l.z - w], [l.x - w, y + 0.9, l.z + w], 0.05, 0.05, 0.01);
    }
    for (const parts of t) lathe(parts, 'lightning_glass', [[0.001, l.y - 0.55], [0.28, l.y - 0.3], [0.3, l.y + 0.3], [0.001, l.y + 0.5]], { segments: 6, smooth: false });
    lathe(L0, 'insulator_glass', [[0.2, l.y - 0.75], [0.3, l.y - 0.68], [0.2, l.y - 0.6], [0.3, l.y - 0.52]], { segments: 10, smooth: true });
  }
  // the truss between the pylon heads
  const [a, b] = lights as [typeof lights[0], typeof lights[0]];
  for (const dz of [-0.6, 0.6]) {
    beam(L0, 'copper_oxide', [a.x, a.y - 0.9, dz], [b.x, b.y - 0.9, dz], 0.14, 0.14, 0.02);
    beam(L0, 'copper_oxide', [a.x, a.y - 1.9, dz], [b.x, b.y - 1.9, dz], 0.14, 0.14, 0.02);
    beam(L1, 'copper_oxide', [a.x, a.y - 1.4, dz], [b.x, b.y - 1.4, dz], 0.3, 0.3, 0.02);
    for (let x = a.x + 1; x < b.x - 0.5; x += 1.4) beam(L0, 'copper_oxide', [x, a.y - 1.9, dz], [x + 1.4, a.y - 0.9, dz], 0.07, 0.07, 0.012);
  }
  void trs; void Matrix4;
  return finish(t, ['storm_slate', 'copper_oxide', 'lightning_glass', 'insulator_glass']);
}

export const STORM_SET: BiomeSet = {
  biome: 'storm',
  building: STORM_BUILDING,
  props: STORM_PROPS,
  trees: [{ kind: 'tree_pine', shape: { ...TREE_SHAPES.pine, lean: 0.4 }, bark: 'grove_bark', leaf: 'pine_needle', weight: 1 }],
  rock: 'storm_slate',
  tallGrass: 'tall_grass',
  tuft: 'tall_grass',
  bushLeaf: null,
  flower: null,
  density: { treeMargin: 0.02, treeInterior: 0.02, rock: 0.012, bush: 0, flower: 0, tuft: 0.2, tallGrass: 2.2 },
  boundary: 'rocks',
  accent: 'lightning_glass',
  setPieces: { storm_coil_tower: coilTower, galvan_span: galvanSpan },
};
