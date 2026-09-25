/**
 * §10.5.4 — the `salt` set (Saltmourn, Tide Route): whitewashed plaster cottages framed in driftwood on barnacled
 * stone, harbour-plank doors, wet rocks, dune grass, driftwood snags; set-pieces `salt_lighthouse` (a lathed
 * tower with a lamp room — the light housing at 12.4 m) and `tide_wreck` (a half-sunk hull of ribs and planks with
 * a lantern on its broken mast).
 */
import { Matrix4, Shape } from 'three/webgpu';
import { beam, box, extrude, lathe } from '../geo.js';
import { createPrng } from '../prng.js';
import type { BuildingStyle } from './buildings.js';
import { blockRing, finish, hangingLantern, spLights, tiers3, tower } from './common.js';
import { TREE_SHAPES } from './nature.js';
import type { PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

export const SALT_BUILDING: BuildingStyle = {
  wall: 'plaster', upperWall: 'plaster', frame: 'driftwood', plinth: 'barnacle_stone', door: 'harbour_plank', glass: 'mist_glass', litGlass: 'glass_warm',
  sill: 'driftwood', trim: 'harbour_plank', chimney: 'barnacle_stone', metal: 'lantern_metal', greenery: null,
  roofs: { slate: 'slate_roof', thatch: 'thatch', tile: 'slate_roof', plate: 'harbour_plank' },
  storey: 2.6, pitchDeg: 40, overhang: 0.3, stoneBand: 0.7,
};

export const SALT_PROPS: PropStyle = {
  wood: 'harbour_plank', metal: 'lantern_metal', stone: 'barnacle_stone', housingGlass: 'glass_warm', glow: 'glass_warm', crystal: 'glass_warm', candle: 'glass_warm',
  cloth: 'sailcloth', soil: 'salt_sand', leaf: 'tall_grass', rock: 'wet_rock', water: 'sea_water',
};

/** `salt_lighthouse`: stone base, whitewashed lathed tower, gallery with rail, glass lamp room (housing at 12.4 m), cap. */
function lighthouse(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const [L0] = t;
  for (const [k, parts] of t.entries()) {
    const seg = k === 0 ? 24 : 12;
    tower(parts, 'plaster', 'barnacle_stone', 2.3, 10.8, seg);
    lathe(parts, 'harbour_plank', [[2.7, 11.3], [2.7, 11.45], [0.001, 11.46]], { segments: seg, smooth: false });
    lathe(parts, 'glass_warm', [[1.15, 11.5], [1.15, 13.2]], { segments: 8, smooth: false, capTop: false });
    lathe(parts, 'lantern_metal', [[1.35, 13.2], [1.4, 13.35], [0.6, 14.2], [0.08, 14.6], [0.001, 14.7]], { segments: 8, smooth: false });
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    beam(L0, 'lantern_metal', [Math.cos(a) * 2.6, 11.45, Math.sin(a) * 2.6], [Math.cos(a) * 2.6, 12.4, Math.sin(a) * 2.6], 0.05, 0.05, 0.01);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    beam(L0, 'lantern_metal', [Math.cos(a) * 1.18, 11.5, Math.sin(a) * 1.18], [Math.cos(a) * 1.18, 13.2, Math.sin(a) * 1.18], 0.07, 0.07, 0.015);
  }
  // a door and two slit windows
  box(L0, 'harbour_plank', 0, 0.5, 2.34, 1.0, 2.0, 0.12, 0, 0.02);
  for (const y of [4.5, 7.6]) box(L0, 'mist_glass', 0, y, 2.12, 0.4, 0.9, 0.1, 0, 0.02);
  blockRing(L0, 'barnacle_stone', 3.4, -0.2, 22, 0.9, 0.45, 0.7, ctx.seed);
  return finish(t, ['plaster', 'barnacle_stone', 'harbour_plank', 'glass_warm', 'lantern_metal', 'mist_glass']);
}

/** `tide_wreck`: a hull (extruded rib profiles + plank strakes) listing in the sand, a broken mast with a lantern. */
function wreck(ctx: SetPieceContext): PropGeo {
  const p = createPrng(ctx.seed);
  const t = tiers3();
  const [L0, L1, L2] = t;
  const len = 14; const beamW = 4.2;
  const list = new Matrix4().makeRotationZ(0.22).premultiply(new Matrix4().makeTranslation(0, -0.9, 0));
  // ribs
  for (let i = 0; i <= 12; i++) {
    const x = -len / 2 + (i * len) / 12;
    const taper = Math.sin((Math.PI * i) / 12) * 0.85 + 0.15;
    const rib = new Shape();
    const w = (beamW / 2) * taper;
    rib.moveTo(-w, 2.6); rib.quadraticCurveTo(-w * 1.05, 0.2, 0, 0); rib.quadraticCurveTo(w * 1.05, 0.2, w, 2.6);
    rib.lineTo(w - 0.16, 2.6); rib.quadraticCurveTo(w * 0.9, 0.35, 0, 0.18); rib.quadraticCurveTo(-w * 0.9, 0.35, -w + 0.16, 2.6); rib.lineTo(-w, 2.6);
    const m = list.clone().multiply(new Matrix4().makeRotationY(Math.PI / 2)).multiply(new Matrix4().makeTranslation(0, 0, x - 0.08));
    if (i % 2 === 0 || i < 3) extrude(L0, 'driftwood', rib, 0.16, 0.02, m, { curveSegments: 6 });
    if (i % 3 === 0) extrude(L1, 'driftwood', rib, 0.2, 0.02, m, { curveSegments: 3 });
  }
  // strakes on the near side, broken off unevenly
  for (let s = 0; s < 6; s++) {
    const y = 0.4 + s * 0.38;
    const x1 = len / 2 - p.next() * 5;
    const w = (beamW / 2) * (0.6 + s * 0.07);
    const A: [number, number, number] = [-len / 2 + 1.5, y, w]; const B: [number, number, number] = [x1, y, w];
    beam(L0, 'harbour_plank', A, B, 0.34, 0.07, 0.02, [0, 0, 1], list);
    if (s % 2 === 0) beam(L1, 'harbour_plank', A, B, 0.6, 0.08, 0.02, [0, 0, 1], list);
  }
  box(L2, 'driftwood', 0, -0.5, 0, len * 0.9, 1.6, beamW * 0.8, 0.1, 0.1);
  // keel
  beam(L0, 'driftwood', [-len / 2 - 0.5, 0.1, 0], [len / 2 + 0.3, 0.1, 0], 0.3, 0.4, 0.04, undefined, list);
  // broken mast with the lantern hanging from a yard arm (the table's light point)
  const l = spLights('tide_wreck')[0]!;
  const mx = l.x - 1.0;
  for (const parts of [L0, L1]) beam(parts, 'driftwood', [mx - 0.2, -0.5, l.z], [mx, l.y + 1.0, l.z], 0.28, 0.28, 0.04);
  beam(L0, 'driftwood', [mx, l.y + 0.8, l.z], [l.x + 0.15, l.y + 0.8, l.z], 0.09, 0.09, 0.02);
  hangingLantern(t, ctx.set, l.x, l.y, l.z, l.y + 0.8);
  return finish(t, ['driftwood', 'harbour_plank', 'lantern_metal', 'glass_warm']);
}

export const SALT_SET: BiomeSet = {
  biome: 'salt',
  building: SALT_BUILDING,
  props: SALT_PROPS,
  trees: [
    { kind: 'tree_pine', shape: { ...TREE_SHAPES.pine, height: 1.1 }, bark: 'driftwood', leaf: 'pine_needle', weight: 0.55 },
    { kind: 'tree_dead', shape: TREE_SHAPES.dead, bark: 'driftwood', leaf: 'pine_needle', weight: 0.45 },
  ],
  rock: 'wet_rock',
  tallGrass: 'tall_grass',
  tuft: 'tall_grass',
  bushLeaf: null,
  flower: null,
  density: { treeMargin: 0.012, treeInterior: 0.012, rock: 0.01, bush: 0, flower: 0, tuft: 0.18, tallGrass: 2.2 },
  boundary: 'fence',
  accent: null,
  setPieces: { salt_lighthouse: lighthouse, tide_wreck: wreck },
};
