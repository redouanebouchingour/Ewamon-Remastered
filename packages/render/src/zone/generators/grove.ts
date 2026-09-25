/**
 * §10.5.4 — the `grove` generator set, in full (Mirevale + Mire Route, the slice). Timber-framed plaster houses
 * with slate or thatch roofs and chamfered stone plinths, lichen boulders, oaks / birches / willows by the water,
 * leafy bushes, tall-grass tufts, meadow flowers; set-pieces `grove_heart_tree` (the town's great tree in a stone
 * ring, hung with lanterns) and `mire_boardwalk` (a planked causeway over the mire with reed beds and lanterns).
 */
import { Matrix4, Vector3 } from 'three/webgpu';
import { SET_PIECE_EXTENT } from '../layout.js';
import type { Parts} from '../geo.js';
import { beam, box, card, lathe } from '../geo.js';
import { createPrng } from '../prng.js';
import type { BuildingStyle } from './buildings.js';
import { blockRing, finish, hangingLantern, lanternAt, spLights, tiers3 } from './common.js';
import { TREE_SHAPES, rootArm } from './nature.js';
import type { PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

const TAU = Math.PI * 2;

export const GROVE_BUILDING: BuildingStyle = {
  wall: 'plaster', upperWall: 'plaster', frame: 'timber', plinth: 'stone_wall', door: 'timber', glass: 'mist_glass', litGlass: 'glass_warm', sill: 'stone_wall',
  trim: 'timber', chimney: 'stone_wall', metal: 'lantern_metal', greenery: 'grove_leaf_canopy',
  roofs: { slate: 'slate_roof', thatch: 'thatch', tile: 'forge_brick', plate: 'slate_roof' },
  storey: 2.7, pitchDeg: 38, overhang: 0.35, stoneBand: 0,
};

export const GROVE_PROPS: PropStyle = {
  wood: 'timber', metal: 'lantern_metal', stone: 'stone_wall', housingGlass: 'glass_warm', glow: 'glass_warm', crystal: 'glass_warm', candle: 'glass_warm',
  cloth: 'thatch', soil: 'dirt', leaf: 'grove_leaf_canopy', rock: 'lichen_stone', water: 'water_pond',
};

/** `grove_heart_tree`: a ~10 m tree with 7 root lobes and curved roots in a raised stone ring, seven great limbs, three hanging lanterns. */
function heartTree(ctx: SetPieceContext): PropGeo {
  const set = ctx.set;
  const p = createPrng(ctx.seed);
  const t = tiers3();
  const [L0, L1, L2] = t;
  const bark = 'grove_bark'; const leaf = 'grove_leaf_canopy'; const stone = 'stone_wall'; const moss = 'grove_moss';
  // raised ring planter (seat height) with a block cap, moss inside
  for (const [k, parts] of t.entries()) {
    lathe(parts, stone, [[3.55, -0.4], [3.55, 0.42], [4.35, 0.42], [4.35, -0.4]], { segments: k === 0 ? 48 : 24, smooth: false });
    lathe(parts, moss, [[3.56, 0.36], [0.001, 0.36]], { segments: k === 0 ? 24 : 12, smooth: false });
  }
  blockRing(L0, stone, 3.95, 0.42, 30, 0.86, 0.12, 0.92, ctx.seed + 3);
  blockRing(L0, stone, 3.95, -0.25, 34, 0.74, 0.3, 0.84, ctx.seed + 5);
  // trunk: short and massive, twisting, flaring into seven root lobes; the crown spreads wide and low so the
  // steep diorama camera sees it (a tall crown near the focus sits above the frame's top edge)
  const phase = p.next() * TAU;
  const trunkTop = 5.6;
  const rAt = (y: number): number => 1.0 + (0.4 - 1.0) * Math.pow(Math.min(1, y / trunkTop), 0.65);
  const axis = (y: number): readonly [number, number] => [Math.sin(y * 0.45 + phase) * 0.22 * (y / trunkTop), Math.cos(y * 0.38 + phase) * 0.16 * (y / trunkTop)];
  const lobes = (a: number, _j: number, y: number): number => {
    const twist = a + y * 0.22;
    const ridges = 1 + 0.07 * Math.cos(9 * twist) + 0.05 * Math.sin(4 * twist + phase);
    if (y > 1.6) return ridges;
    const lobe = Math.pow(Math.max(0, Math.cos(3.5 * (a - phase))), 2);
    return ridges * (1 + 0.85 * Math.pow(1 - y / 1.6, 1.7) * (0.3 + 0.7 * lobe));
  };
  const prof = [0.3, 0.5, 0.75, 1.05, 1.45, 2.1, 2.9, 3.7, 4.5, 5.3, 5.9, trunkTop].map((y) => [rAt(y), y] as const);
  lathe(L0, bark, prof, { segments: 22, radial: lobes, axis, capTop: true, phase });
  lathe(L1, bark, prof.filter((_, i) => i % 2 === 0), { segments: 12, radial: lobes, axis, capTop: true, phase });
  lathe(L2, bark, prof.filter((_, i) => i % 3 === 0), { segments: 8, radial: lobes, axis, capTop: true, phase });
  const orient = (o: readonly [number, number, number], d: Vector3): Matrix4 => {
    const m = new Matrix4();
    const up = new Vector3(0, 1, 0);
    const dir = d.clone().normalize();
    const ax = new Vector3().crossVectors(up, dir);
    const ang = Math.acos(Math.min(1, Math.max(-1, up.dot(dir))));
    if (ax.lengthSq() > 1e-8) m.makeRotationAxis(ax.normalize(), ang);
    m.setPosition(o[0], o[1], o[2]);
    return m;
  };
  // curved root arms over the moss and across the ring
  for (let k = 0; k < 7; k++) {
    const a = phase + (k * TAU) / 7 + (p.next() - 0.5) * 0.35;
    const len = 3.0 + p.next() * 1.4;
    rootArm(L0, bark, [Math.cos(a) * 0.7, 0.95, Math.sin(a) * 0.7], a, len, 0.5, 0.75 + p.next() * 0.3, 9);
    rootArm(L1, bark, [Math.cos(a) * 0.7, 0.95, Math.sin(a) * 0.7], a, len, 0.48, 0.85, 5);
  }
  // limbs + clumps
  const clumps: [number, number, number, number][] = [];
  for (let k = 0; k < 7; k++) {
    const yaw = phase * 0.7 + (k * TAU) / 7 + (p.next() - 0.5) * 0.45;
    const hb = 3.2 + p.next() * 1.8;
    const pitch = 1.08 + p.next() * 0.28;
    const len = 2.6 + p.next() * 1.1;
    const dir = new Vector3(Math.sin(pitch) * Math.cos(yaw), Math.cos(pitch), Math.sin(pitch) * Math.sin(yaw));
    const [ax, az] = axis(hb);
    const o: [number, number, number] = [ax, hb, az];
    const r0 = 0.38;
    lathe(L0, bark, [[r0, 0], [r0 * 0.78, len * 0.3], [r0 * 0.55, len * 0.65], [0.1, len * 0.92], [0.02, len]], { segments: 10, phase: yaw }, orient(o, dir));
    lathe(L1, bark, [[r0, 0], [0.12, len * 0.8], [0.02, len]], { segments: 6, phase: yaw }, orient(o, dir));
    const tip: [number, number, number] = [o[0] + dir.x * len, o[1] + dir.y * len, o[2] + dir.z * len];
    const dir2 = new Vector3(dir.x * 0.6 + Math.cos(yaw + 1.2) * 0.5, 0.75, dir.z * 0.6 + Math.sin(yaw + 1.2) * 0.5).normalize();
    const mid: [number, number, number] = [o[0] + dir.x * len * 0.55, o[1] + dir.y * len * 0.55, o[2] + dir.z * len * 0.55];
    lathe(L0, bark, [[0.17, 0], [0.09, 1.2], [0.02, 2.0]], { segments: 7, phase: yaw }, orient(mid, dir2));
    clumps.push([tip[0], tip[1] + 0.7, tip[2], 1.9 + p.next() * 0.6]);
    clumps.push([mid[0] + dir2.x * 1.6, mid[1] + dir2.y * 1.6 + 0.6, mid[2] + dir2.z * 1.6, 1.7 + p.next() * 0.4]);
  }
  clumps.push([0, trunkTop + 1.4, 0, 2.7]);
  clumps.push([0.9, trunkTop + 2.4, -0.7, 2.1]);
  const cardsFor = (parts: Parts, count: number, sizeMul: number, salt: number): void => {
    const cp = createPrng(ctx.seed ^ salt);
    for (let k = 0; k < count; k++) {
      const c = clumps[k % clumps.length]!;
      const th = cp.next() * TAU; const y = -0.4 + cp.next() * 1.3;
      const yy = Math.min(1, y); const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      const dx = Math.cos(th) * rr; const dz = Math.sin(th) * rr;
      const dist = c[3] * (0.4 + 0.6 * Math.sqrt(cp.next()));
      const size = (1.8 + cp.next() * 0.9) * sizeMul;
      card(parts, leaf, c[0] + dx * dist, c[1] + yy * dist * 0.75 - size * 0.45, c[2] + dz * dist, size, size, Math.atan2(dx, dz) + (cp.next() - 0.5) * 0.8, -(0.3 + 0.7 * Math.max(0, yy)) - cp.next() * 0.2, [c[0], c[1] - c[3] * 0.3, c[2]], 0.72);
    }
  };
  cardsFor(L0, 210, 1, 0x51);
  cardsFor(L1, 80, 1.5, 0x52);
  cardsFor(L2, 26, 2.2, 0x53);
  // hanging lanterns at the table's light points
  for (const l of spLights('grove_heart_tree')) hangingLantern(t, set, l.x, l.y, l.z, l.y + 1.9);
  return finish(t, [stone, moss, bark, leaf, 'lantern_metal', 'glass_warm']);
}

/** `mire_boardwalk`: a 30 m planked causeway along x on sleepers and posts, rope-and-post rails, reed beds, two lanterns. */
function mireBoardwalk(ctx: SetPieceContext): PropGeo {
  const set = ctx.set;
  const p = createPrng(ctx.seed);
  const t = tiers3();
  const [L0, L1, L2] = t;
  const ext = SET_PIECE_EXTENT.mire_boardwalk;
  const half = ext.hw - 1;
  const W = 3.1;
  const wood = 'timber';
  // deck height follows the ground (never below it), 12 cm over the mud
  const deckY = (x: number): number => Math.max(ctx.ground(x, -W / 2), ctx.ground(x, 0), ctx.ground(x, W / 2)) + 0.12;
  for (let x = -half; x <= half; x += 0.34) {
    const y = deckY(x);
    const jitter = (p.next() - 0.5) * 0.03;
    box(L0, wood, x, y - 0.06, jitter, 0.3, 0.06, W - (p.next() * 0.12), (p.next() - 0.5) * 0.03, 0.012);
    if (Math.round(x / 0.34) % 2 === 0) box(L1, wood, x, y - 0.06, 0, 0.66, 0.06, W, 0, 0.012);
  }
  box(L2, wood, 0, deckY(0) - 0.08, 0, 2 * half, 0.08, W, 0, 0.02);
  // stringers + sleepers
  for (const s of [-1, 1]) {
    for (let x = -half; x < half; x += 4) {
      beam(L0, wood, [x, deckY(x) - 0.12, s * (W / 2 - 0.3)], [x + 4, deckY(x + 4) - 0.12, s * (W / 2 - 0.3)], 0.14, 0.12, 0.02);
    }
  }
  // posts every 2 m with rope rails (timber rails)
  const posts: [number, number, number][] = [];
  for (let x = -half; x <= half + 0.01; x += 2.1) {
    for (const s of [-1, 1]) {
      const z = s * (W / 2 + 0.08);
      const g = Math.min(ctx.ground(x, z), deckY(x) - 0.12);
      const top = deckY(x) + 0.95 + (p.next() - 0.5) * 0.06;
      for (const parts of [L0, L1]) box(parts, wood, x, g - 0.35, z, 0.16, top - g + 0.35, 0.16, (p.next() - 0.5) * 0.15, 0.03);
      posts.push([x, top, z]);
    }
  }
  for (let i = 0; i + 2 < posts.length; i++) {
    const a = posts[i]!; const b = posts[i + 2]!;
    for (const dy of [-0.08, -0.5]) beam(L0, wood, [a[0], a[1] + dy, a[2]], [b[0], b[1] + dy, b[2]], 0.09, 0.06, 0.015, [0, 0, Math.sign(a[2])]);
  }
  // lanterns (housing at the table's light points)
  for (const l of spLights('mire_boardwalk')) lanternAt(t, set, l.x, l.y, l.z, deckY(l.x), ctx.seed + Math.round(l.x * 10));
  // reed beds and bulrushes along both sides
  const reed = 'tall_grass';
  for (let k = 0; k < 90; k++) {
    const x = -half - 1 + p.next() * (2 * half + 2);
    const s = p.next() < 0.5 ? -1 : 1;
    const z = s * (W / 2 + 0.5 + p.next() * 2.6);
    const g = ctx.ground(x, z);
    const h = 0.9 + p.next() * 0.7;
    for (let c = 0; c < 2; c++) card(L0, reed, x, g - 0.05, z, 0.8, h, p.next() * Math.PI, (p.next() - 0.5) * 0.25, [x, g - 0.9, z], 0.6, [0, 0, 1, 1], true);
    if (k % 3 === 0) card(L1, reed, x, g - 0.05, z, 1.1, h, p.next() * Math.PI, 0, [x, g - 0.9, z], 0.6, [0, 0, 1, 1], true);
    if (k % 7 === 0) {
      // bulrush heads on thin stalks
      beam(L0, 'grove_bark', [x + 0.1, g, z], [x + 0.12, g + h + 0.35, z], 0.018, 0.018, 0.004);
      lathe(L0, 'grove_bark', [[0.001, 0], [0.035, 0.03], [0.035, 0.2], [0.001, 0.24]], { segments: 6 }, new Matrix4().makeTranslation(x + 0.12, g + h + 0.3, z));
    }
  }
  return finish(t, [wood, 'lantern_metal', 'glass_warm', reed, 'grove_bark', 'stone_wall']);
}

export const GROVE_SET: BiomeSet = {
  biome: 'grove',
  building: GROVE_BUILDING,
  props: GROVE_PROPS,
  trees: [
    { kind: 'tree_oak', shape: TREE_SHAPES.oak, bark: 'grove_bark', leaf: 'grove_leaf_canopy', weight: 0.62 },
    { kind: 'tree_birch', shape: TREE_SHAPES.birch, bark: 'grove_bark', leaf: 'grove_leaf_canopy', weight: 0.38 },
    { kind: 'tree_willow', shape: TREE_SHAPES.willow, bark: 'grove_bark', leaf: 'grove_leaf_canopy', weight: 0, nearWater: true },
  ],
  rock: 'lichen_stone',
  tallGrass: 'tall_grass',
  tuft: 'tall_grass',
  bushLeaf: 'grove_leaf_canopy',
  flower: 'plaster',
  density: { treeMargin: 0.028, treeInterior: 0.045, rock: 0.006, bush: 0.02, flower: 0.012, tuft: 0.24, tallGrass: 2.2 },
  boundary: 'wall',
  accent: null,
  setPieces: { grove_heart_tree: heartTree, mire_boardwalk: mireBoardwalk },
};
