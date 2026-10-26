/**
 * The zone plan (audit recommendation R1, `.design/audits/spec-verification.md`): where a zone's layout puts its
 * roads, plaza, tall-grass patches, clearings, set-piece, buildings (with their doors and a walkable door approach),
 * lamp posts and hand-placed props — and every **solid** footprint (walls, solid set-piece cores, wells, stalls,
 * benches, gardens, carts, crates, barrels, signs, fences, lamp posts, tree trunks, big rocks) that
 * `buildHeightfield` marks `walkable = 0`, so the server's movement validation and spawn placement see houses and
 * trunks exactly as the client's collider does.
 *
 * Moved from `packages/render/src/zone/layout.ts` (`planLayout`, `planBuildings`, `planLights`, `planProps`,
 * `doorPaths`) and the solid half of `zone/builder.ts` (`buildScatter`'s trunk / willow / rock blockers). Render keeps
 * drawing from it (`zoneSpecFor` passes the plan through `ZoneSpec`) and mirrors the scatter solids exactly
 * (`packages/client/test/footprints.test.ts`). The zone sculpts (`sculpt.ts`) supply a zone's own roads, tall grass,
 * set-piece spot, fences, props, bridges, crags and structures; a route with a sculpted `road_main` has no meander.
 *
 * Pure: the only inputs are the `ZoneDef` and its base heightfield (heights, water, the terrain's walkable bits), and
 * the only randomness is core's `createRng(zone.layoutSeed)` plus stream-free integer hashes.
 */
import { createRng, fnv1a32 } from '@ewa/core';
import type { Rng, RngState } from '@ewa/core';
import type { Heightfield } from './heightfield';
import type { Biome, ZoneDef, ZoneId, ZoneKind } from './types';
import { ZONE_MARGIN, ZONE_SIZE } from './types';
import { LEAGUE } from './data/league';
import { SCULPTS } from './data/sculpts';
import type { SculptBridge, SculptCrag, SculptResult, SculptStructure, ZoneSculpt } from './sculpt';

// ─── types ───────────────────────────────────────────────────────────────────

export type Vec2 = readonly [number, number];
export type Dir = 'n' | 'e' | 's' | 'w';

/** The 21 set-piece ids (render SPEC §10.5.1 `SetPieceId`), one per zone. */
export type SetPieceId =
  | 'grove_heart_tree' | 'mire_boardwalk' | 'cinder_caldera' | 'ash_lava_bridge' | 'salt_lighthouse' | 'tide_wreck'
  | 'storm_coil_tower' | 'galvan_span' | 'marrow_mineshaft' | 'deepcut_arch' | 'vesper_witch_hut' | 'hollow_lantern_road'
  | 'forge_great_gate' | 'siege_trebuchet' | 'sky_shrine' | 'ascent_stair' | 'solenne_cathedral' | 'eclipse_engine'
  | 'umbral_dome' | 'celestial_spire' | 'rift_maw';

export interface PlanCircle { readonly x: number; readonly z: number; readonly r: number }
export interface PlanEllipse { readonly x: number; readonly z: number; readonly rx: number; readonly rz: number; readonly yaw: number }
export interface PlanRoad { readonly id: string; readonly kind: 'road' | 'lane' | 'path'; readonly width: number; readonly points: readonly Vec2[] }
/** A route's road centreline: `z(x) = amp·sin(2πx/λ + phase) + 0.5·sin(2πx/(0.37λ) + phase2)` (`roadZAt`). */
export interface RoadMeander { readonly amp: number; readonly wavelength: number; readonly phase: number; readonly phase2: number }
export interface PlanSetPiece { readonly id: SetPieceId; readonly x: number; readonly z: number; readonly yaw: number; readonly hw: number; readonly hd: number }
export interface Bounds { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }
/** Warp door marker → arrival point. */
export interface WarpPair { readonly id: string; readonly door: Vec2; readonly to: Vec2 | null }

/** One connected body of `water` samples (4-neighbour flood fill, row-major discovery order). */
export interface WaterBody {
  readonly id: number;
  readonly cx: number; readonly cz: number;
  /** Radius of the circle with the body's area. */
  readonly r: number;
  readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number;
  /** Surface height: the highest open-water sample + 4 cm, capped 3 cm under the lowest dry sample on the body's border. */
  readonly level: number;
  /** Lowest terrain sample under the body. */
  readonly floor: number;
  readonly samples: number;
  /** Extent of the samples that are both walkable and water (the boardwalk strip), or null. */
  readonly boardwalk: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number; readonly y: number } | null;
}

export type BuildingKind = 'house' | 'gym' | 'shop' | 'healer' | 'landmark' | 'crypt';
export type RoofKind = 'slate' | 'thatch' | 'tile' | 'plate';
/** A building (field for field render's `BuildingSpec`): centre, yaw (door = local +z), footprint w × d. */
export interface PlanBuilding {
  readonly id: string; readonly kind: BuildingKind; readonly x: number; readonly z: number; readonly yaw: number;
  readonly w: number; readonly d: number; readonly floors: 1 | 2; readonly roof: RoofKind; readonly seed: number;
}
/** World door position (front wall centre) and outward normal. */
export interface Door { readonly x: number; readonly z: number; readonly nx: number; readonly nz: number }

export type RectSolid = { readonly kind: 'rect'; readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly yaw: number };
export type CircleSolid = { readonly kind: 'circle'; readonly x: number; readonly z: number; readonly r: number };
/**
 * A footprint in the shape render's `TerrainCollider` blockers use: the space a player's CENTRE may not enter (the
 * object's extent grown by the capsule radius `MOVER_RADIUS`). A heightfield sample is inside when its centre is
 * strictly inside: circle `dx² + dz² < r²`; rect `|lx| < hw ∧ |lz| < hd` in the yawed frame.
 */
export type Solid = RectSolid | CircleSolid;
export type SolidSource = 'building' | 'setpiece' | 'prop' | 'housing' | 'tree' | 'willow' | 'rock';
export interface PlanSolid { readonly source: SolidSource; readonly ref: string; readonly shape: Solid }

/** A building's door and the strip in front of it that stays walkable (no other solid may seal a door). */
export interface DoorApproach { readonly building: string; readonly door: Door; readonly approach: RectSolid }

export type HousingGenerator = 'lantern' | 'brazier' | 'beacon' | 'crystal' | 'candle';
export type LightRole = 'setpiece' | 'plaza' | 'gym_beacon' | 'road' | 'door' | 'clearing';
/**
 * Where a light stands (appearance — kind, colour, intensity, range, flicker, the housing's height — is render's:
 * the adapter composes the `LightSource` with render's `lightsFromPlan`).
 */
export interface PlanLight {
  readonly id: string;
  readonly role: LightRole;
  /** World position, rounded to 1 mm (the `LightSource.position` x / z). */
  readonly x: number; readonly z: number;
  /** Terrain height under the light: at the unrounded post position, or at the set-piece origin for set-piece lights. */
  readonly ground: number;
  readonly castShadow: boolean;
  /** Generated post / stand kind; null for a light carried by the set-piece mesh. */
  readonly generator: HousingGenerator | null;
  /** Index into the set-piece's light table (set-piece lights only). */
  readonly slot: number | null;
  /** Housing seed (generated lights only). */
  readonly seed: number | null;
}
/** A hand-placed prop (field for field render's `PropPlacement`). */
export interface PlanProp { readonly kind: string; readonly x: number; readonly z: number; readonly yaw: number; readonly scale: number; readonly seed: number }

export interface ZonePlan {
  readonly zoneId: ZoneId;
  readonly layout: ZoneKind;
  /** `ZoneDef.layoutSeed >>> 0` */
  readonly seed: number;
  /** Half the field size (80 / 120 / 100). */
  readonly half: number;
  readonly interior: Bounds;
  readonly plaza: PlanCircle | null;
  readonly roads: readonly PlanRoad[];
  readonly roadMeander: RoadMeander | null;
  readonly grassPatches: readonly PlanEllipse[];
  readonly clearings: readonly PlanCircle[];
  readonly setPiece: PlanSetPiece;
  readonly water: readonly WaterBody[];
  /** Authored points the layout keeps clear (npcs, trainers, items, lore, warp doors and arrivals). */
  readonly points: readonly Vec2[];
  readonly warpPairs: readonly WarpPair[];
  readonly buildings: readonly PlanBuilding[];
  readonly doors: readonly DoorApproach[];
  /** 1.6 m paths from every door to the nearest road or the plaza rim. */
  readonly doorPaths: readonly PlanRoad[];
  readonly lights: readonly PlanLight[];
  readonly props: readonly PlanProp[];
  /** Every footprint `buildHeightfield` marks unwalkable, in render's blocker registration order. */
  readonly solids: readonly PlanSolid[];
  /** Where a sculpted road crosses water on a deck (render draws the bridge). */
  readonly bridges: readonly SculptBridge[];
  /** Rock spires / tors / columns of the sculpt (render dresses each with a faceted rock). */
  readonly crags: readonly SculptCrag[];
  /** The sculpt's curtain walls, palisades and towers (render builds them on their lifts). */
  readonly structures: readonly SculptStructure[];
}

// ─── tables ──────────────────────────────────────────────────────────────────

/** The movement capsule radius (protocol `MOVEMENT.radius`, render `MOVER.capsuleRadius`). Footprints grow by it. */
export const MOVER_RADIUS = 0.35;

/** Render SPEC §10.5.1 `SetPieceId` of each zone, by ZONE_ORDER slot (`ZoneDef.signature` holds story names). */
export const SET_PIECE_BY_ZONE: Readonly<Record<ZoneId, SetPieceId>> = {
  mirevale: 'grove_heart_tree', mire_route: 'mire_boardwalk', cinderhold: 'cinder_caldera', ash_route: 'ash_lava_bridge',
  saltmourn: 'salt_lighthouse', tide_route: 'tide_wreck', stormrook: 'storm_coil_tower', galvan_route: 'galvan_span',
  marrowdig: 'marrow_mineshaft', deepcut_route: 'deepcut_arch', vesperveil: 'vesper_witch_hut', hollow_route: 'hollow_lantern_road',
  forgewall: 'forge_great_gate', siege_route: 'siege_trebuchet', skyrend: 'sky_shrine', ascent_route: 'ascent_stair',
  solenne: 'solenne_cathedral', eclipse_shrine: 'eclipse_engine', umbral_observatory: 'umbral_dome', celestial_spire: 'celestial_spire',
  the_rift: 'rift_maw',
};

export const DIRS: readonly Dir[] = ['n', 'e', 's', 'w'];
/** Playable interior side (the field minus the 16 m margin on each side). */
export const INTERIOR_SIZE: Readonly<Record<ZoneKind, number>> = { town: 128, route: 208, story: 168 };

export const TOWN_LAYOUT = Object.freeze({
  plazaR: 14, ringMin: 22, ringMax: 30, gap: 4, roadWidth: 3.5, laneWidth: 3.0, pathWidth: 1.6,
  gymDoor: [0, -26] as Vec2, gymW: 14, gymD: 12, buildings: [6, 10] as const, pointClearance: 2.5,
});
export const ROUTE_LAYOUT = Object.freeze({
  corridorHalf: 6, roadWidth: 3.5, meanderAmp: 1.4, meanderWavelength: 52, patches: [3, 5] as const, patchRx: 8, patchRz: 5,
  clearings: [2, 3] as const, clearingR: [7, 10] as const,
});
export const STORY_LAYOUT = Object.freeze({ platformR: 14, roadWidth: 4 });
/** The server's handover trigger: 6 m inside the playable edge. */
export const HANDOVER_INSET = 6;

/** Keep-clear extent of each set-piece in its local frame (half width along x, half depth along z). */
export const SET_PIECE_EXTENT: Readonly<Record<SetPieceId, { readonly hw: number; readonly hd: number }>> = {
  grove_heart_tree: { hw: 5.2, hd: 5.2 }, mire_boardwalk: { hw: 15, hd: 4.5 }, cinder_caldera: { hw: 6.5, hd: 6.5 }, ash_lava_bridge: { hw: 11, hd: 5 },
  salt_lighthouse: { hw: 4.5, hd: 4.5 }, tide_wreck: { hw: 9, hd: 5 }, storm_coil_tower: { hw: 4.5, hd: 4.5 }, galvan_span: { hw: 12, hd: 4 },
  marrow_mineshaft: { hw: 6, hd: 5 }, deepcut_arch: { hw: 9, hd: 3.5 }, vesper_witch_hut: { hw: 5.5, hd: 5 }, hollow_lantern_road: { hw: 14, hd: 4 },
  forge_great_gate: { hw: 9, hd: 4 }, siege_trebuchet: { hw: 6, hd: 7 }, sky_shrine: { hw: 6, hd: 6 }, ascent_stair: { hw: 5, hd: 9 },
  solenne_cathedral: { hw: 8, hd: 8 }, eclipse_engine: { hw: 8, hd: 8 }, umbral_dome: { hw: 9, hd: 9 }, celestial_spire: { hw: 7, hd: 7 },
  rift_maw: { hw: 9, hd: 9 },
};

/** Where each set-piece's own lights stand (local x, z) and which cast shadows (render `SET_PIECE_LIGHTS`, positions only). */
export const SET_PIECE_LIGHT_SLOTS: Readonly<Record<SetPieceId, readonly { readonly x: number; readonly z: number; readonly castShadow: boolean }[]>> = {
  grove_heart_tree: [{ x: 2.9, z: 1.3, castShadow: false }, { x: -2.5, z: -1.9, castShadow: false }, { x: -0.9, z: 3.1, castShadow: false }],
  mire_boardwalk: [{ x: -7.4, z: 2.05, castShadow: true }, { x: 7.4, z: -2.05, castShadow: false }],
  cinder_caldera: [{ x: 0, z: 0, castShadow: false }],
  ash_lava_bridge: [{ x: -9.5, z: 2.6, castShadow: false }, { x: 9.5, z: -2.6, castShadow: false }],
  salt_lighthouse: [{ x: 0, z: 0, castShadow: false }],
  tide_wreck: [{ x: 3.2, z: 0.9, castShadow: false }],
  storm_coil_tower: [{ x: 0, z: 0, castShadow: false }],
  galvan_span: [{ x: -10.6, z: 0, castShadow: false }, { x: 10.6, z: 0, castShadow: false }],
  marrow_mineshaft: [{ x: -2.6, z: 3.4, castShadow: false }, { x: 2.6, z: 3.4, castShadow: false }],
  deepcut_arch: [{ x: -6.2, z: 1.4, castShadow: false }],
  vesper_witch_hut: [{ x: 2.2, z: 3.4, castShadow: false }],
  hollow_lantern_road: [{ x: -10, z: 2.6, castShadow: false }, { x: 0, z: -2.6, castShadow: false }, { x: 10, z: 2.6, castShadow: false }],
  forge_great_gate: [{ x: -6.4, z: 2.2, castShadow: false }, { x: 6.4, z: 2.2, castShadow: false }],
  siege_trebuchet: [{ x: 3.6, z: 4.4, castShadow: false }],
  sky_shrine: [{ x: -3.6, z: 3.6, castShadow: false }, { x: 3.6, z: 3.6, castShadow: false }],
  ascent_stair: [{ x: -2.4, z: 7.5, castShadow: false }],
  solenne_cathedral: [{ x: 0, z: 5.5, castShadow: false }],
  eclipse_engine: [{ x: 0, z: 0, castShadow: false }],
  umbral_dome: [{ x: 0, z: 6.2, castShadow: false }],
  celestial_spire: [{ x: 0, z: 0, castShadow: false }],
  rift_maw: [{ x: 0, z: 0, castShadow: false }],
};

/** House / landmark roof kinds per biome (first = most common). */
export const BIOME_ROOFS: Readonly<Record<Biome, { readonly houses: readonly RoofKind[]; readonly landmark: RoofKind }>> = {
  grove: { houses: ['thatch', 'slate'], landmark: 'slate' },
  cinder: { houses: ['tile', 'slate'], landmark: 'plate' },
  salt: { houses: ['slate', 'thatch'], landmark: 'slate' },
  storm: { houses: ['slate', 'plate'], landmark: 'plate' },
  marrow: { houses: ['tile', 'plate'], landmark: 'slate' },
  vesper: { houses: ['slate', 'thatch'], landmark: 'slate' },
  forge: { houses: ['plate', 'slate'], landmark: 'plate' },
  sky: { houses: ['tile', 'slate'], landmark: 'tile' },
  capital: { houses: ['tile', 'slate'], landmark: 'tile' },
  shrine: { houses: ['slate'], landmark: 'slate' },
  rift: { houses: ['slate'], landmark: 'slate' },
};

/** The lamp post each biome stands along its roads (render `BIOME_LIGHTS[biome].generator`). */
export const BIOME_LIGHT_GENERATOR: Readonly<Record<Biome, HousingGenerator>> = {
  grove: 'lantern', cinder: 'brazier', salt: 'lantern', storm: 'crystal', marrow: 'lantern', vesper: 'candle', forge: 'brazier',
  sky: 'lantern', capital: 'lantern', shrine: 'crystal', rift: 'crystal',
};

/** What a zone spends of the light budget: 1 shadow-casting light and ≤ 20 non-shadowing (render `ZONE_LIGHT_CAP`). */
export const ZONE_LIGHT_CAP = { shadow: 1, nonShadow: 20 } as const;

/** Solid radius (m, before the capsule radius) of each hand-placed prop kind; 0 = walk-through (render `PROP_BLOCKER`). */
export const PROP_SOLID_RADIUS: Readonly<Record<string, number>> = {
  well: 1.25, cart: 1.1, stall: 1.4, bench: 0.7, planter: 0.75, barrel: 0.4, crate: 0.5, sign: 0.2, rock_l: 1.0, rock_m: 0.65, rock_s: 0,
  tree_oak: 0.5, tree_birch: 0.35, tree_willow: 0.55, stump: 0.45, log: 0.6, bush: 0, flower_patch: 0, fence: 0, garden: 0,
  tent: 1.3, campfire: 0.7,
};
/**
 * A picket / wayside fence run (render `buildFence(st, [[-1.8, 0], [1.8, 0]])`: 0.13 m posts every 1.8 m along local
 * x, two rails): half extent along x to the outer post faces, half post depth.
 */
export const FENCE_HALF = { hw: 1.865, hd: 0.065 } as const;

/** Set-pieces a player cannot walk through: their core (60 % of the keep-clear extent) is solid. */
export const SOLID_SET_PIECES: ReadonlySet<SetPieceId> = new Set<SetPieceId>([
  'cinder_caldera', 'salt_lighthouse', 'storm_coil_tower', 'marrow_mineshaft', 'vesper_witch_hut', 'siege_trebuchet', 'sky_shrine',
  'solenne_cathedral', 'eclipse_engine', 'umbral_dome', 'celestial_spire', 'rift_maw', 'tide_wreck',
]);
/** The heart tree's trunk ring (Mirevale's plaza centre). */
export const HEART_TREE_RADIUS = 4.45;

/**
 * The solid half of each biome's scatter (render `BIOME_GENERATORS[biome].density` and whether a `nearWater` tree
 * rings the ponds): trees per m² in the margin and a route's interior, rocks per m².
 */
export const BIOME_SOLID_SCATTER: Readonly<Record<Biome, { readonly treeMargin: number; readonly treeInterior: number; readonly rock: number; readonly willows: boolean }>> = {
  grove: { treeMargin: 0.028, treeInterior: 0.045, rock: 0.006, willows: true },
  cinder: { treeMargin: 0.012, treeInterior: 0.01, rock: 0.012, willows: false },
  salt: { treeMargin: 0.012, treeInterior: 0.012, rock: 0.01, willows: false },
  storm: { treeMargin: 0.02, treeInterior: 0.02, rock: 0.012, willows: false },
  marrow: { treeMargin: 0.006, treeInterior: 0.006, rock: 0.02, willows: false },
  vesper: { treeMargin: 0.026, treeInterior: 0.03, rock: 0.008, willows: true },
  forge: { treeMargin: 0.018, treeInterior: 0.015, rock: 0.012, willows: false },
  sky: { treeMargin: 0.024, treeInterior: 0.02, rock: 0.012, willows: false },
  capital: { treeMargin: 0.024, treeInterior: 0.02, rock: 0.003, willows: false },
  shrine: { treeMargin: 0.004, treeInterior: 0.003, rock: 0.02, willows: false },
  rift: { treeMargin: 0.003, treeInterior: 0.002, rock: 0.024, willows: false },
};

const DIR_VEC: Readonly<Record<Dir, Vec2>> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

// ─── rng ─────────────────────────────────────────────────────────────────────

/**
 * Render's labelled fork (`Prng.fork(label)`, render SPEC §10.5.2): 4 draws seed the child — core's `fork()` rule —
 * and the label's FNV-1a hash is folded into the child's first word. `next() · 2³²` is the drawn uint32 exactly.
 */
export function forkLabelled(rng: Rng, label: string): Rng {
  const s: [number, number, number, number] = [rng.next() * 4294967296, rng.next() * 4294967296, rng.next() * 4294967296, rng.next() * 4294967296];
  s[0] = (s[0] ^ fnv1a32(label)) >>> 0;
  return createRng(s as RngState);
}

const u32 = (r: Rng): number => Math.floor(r.next() * 4294967296) >>> 0;
const snap = (v: number, q = 0.25): number => Math.round(v / q) * q;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

// ─── stream-free noise (render zone/prng.ts, verbatim) ───────────────────────

/** Deterministic hash of two integers + salt into [0, 1). */
export function hash2(x: number, z: number, salt = 0): number {
  let h = Math.imul((x | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul((z | 0) + 0x61c88647, 0x85ebca77) ^ Math.imul(salt | 0, 0xc2b2ae3d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, salt = 0): number {
  const ix = Math.floor(x); const iz = Math.floor(z);
  const fx = x - ix; const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx); const v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, salt); const b = hash2(ix + 1, iz, salt);
  const c = hash2(ix, iz + 1, salt); const d = hash2(ix + 1, iz + 1, salt);
  const top = a + (b - a) * u; const bot = c + (d - c) * u;
  return (top + (bot - top) * v) * 2 - 1;
}

function fbm2(x: number, z: number, octaves: number, salt = 0): number {
  let s = 0; let amp = 0.5; let f = 1; let norm = 0;
  for (let o = 0; o < octaves; o++) {
    s += amp * valueNoise(x * f, z * f, salt + o * 131);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return s / norm;
}

/** Render `zone/scatter.ts` `jitteredPoints`, verbatim: one jittered point per cell of `1/√density`, kept when `h < accept`. */
function jitteredPoints(x0: number, x1: number, z0: number, z1: number, density: number, salt: number, accept: (x: number, z: number, h: number) => number): { x: number; z: number; h: number }[] {
  const out: { x: number; z: number; h: number }[] = [];
  if (density <= 0) return out;
  const cell = 1 / Math.sqrt(density);
  const i0 = Math.floor(x0 / cell); const i1 = Math.ceil(x1 / cell);
  const j0 = Math.floor(z0 / cell); const j1 = Math.ceil(z1 / cell);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const x = (i + hash2(i, j, salt)) * cell;
      const z = (j + hash2(i, j, salt + 1)) * cell;
      if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
      const h = hash2(i, j, salt + 2);
      const a = accept(x, z, h);
      if (a <= 0 || h >= a) continue;
      out.push({ x, z, h: hash2(i, j, salt + 3) });
    }
  }
  return out;
}

// ─── field sampling (content's sampleHeight arithmetic) ──────────────────────

function heightAt(h: Heightfield, x: number, z: number): number {
  if (!(x >= h.originX && x <= h.originX + h.size && z >= h.originZ && z <= h.originZ + h.size)) return NaN;
  const fx = (x - h.originX) / h.step;
  const fz = (z - h.originZ) / h.step;
  let c0 = Math.floor(fx);
  let r0 = Math.floor(fz);
  if (c0 >= h.res - 1) c0 = h.res - 2;
  if (r0 >= h.res - 1) r0 = h.res - 2;
  const u = fx - c0;
  const v = fz - r0;
  const i = r0 * h.res + c0;
  const a = h.heights[i]!;
  const b = h.heights[i + 1]!;
  const c = h.heights[i + h.res]!;
  const d = h.heights[i + h.res + 1]!;
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return top + (bot - top) * v;
}

/** `sampleHeight` with (x, z) clamped into the field (never NaN). */
export function heightClamped(h: Heightfield, x: number, z: number): number {
  const cx = Math.min(h.originX + h.size, Math.max(h.originX, x));
  const cz = Math.min(h.originZ + h.size, Math.max(h.originZ, z));
  return heightAt(h, cx, cz);
}

/** Flood-fills the water mask into bodies (render `terrain/field.ts` `waterBodies`, verbatim). Pure; deterministic order. */
export function waterBodies(h: Pick<Heightfield, 'res' | 'originX' | 'originZ' | 'step' | 'heights' | 'walkable' | 'water'>): WaterBody[] {
  const res = h.res;
  const seen = new Uint8Array(res * res);
  const out: WaterBody[] = [];
  const stack: number[] = [];
  const push = (k: number): void => {
    if (h.water[k] === 1 && seen[k] === 0) { seen[k] = 1; stack.push(k); }
  };
  for (let i = 0; i < res * res; i++) {
    if (h.water[i] !== 1 || seen[i] === 1) continue;
    seen[i] = 1; stack.push(i);
    let n = 0; let sx = 0; let sz = 0;
    let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
    let level = -Infinity; let floor = Infinity;
    let bx0 = Infinity; let bx1 = -Infinity; let bz0 = Infinity; let bz1 = -Infinity; let by = -Infinity; let bn = 0;
    let shore = Infinity;
    while (stack.length > 0) {
      const j = stack.pop()!;
      const row = Math.floor(j / res); const col = j - row * res;
      const x = h.originX + col * h.step; const z = h.originZ + row * h.step;
      const y = h.heights[j]!;
      n++; sx += x; sz += z;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
      if (y < floor) floor = y;
      if (h.walkable[j] === 1) {
        bn++;
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (z < bz0) bz0 = z;
        if (z > bz1) bz1 = z;
        if (y > by) by = y;
      } else if (y > level) level = y;
      if (col > 0) push(j - 1);
      if (col < res - 1) push(j + 1);
      if (row > 0) push(j - res);
      if (row < res - 1) push(j + res);
      for (const k of [col > 0 ? j - 1 : -1, col < res - 1 ? j + 1 : -1, row > 0 ? j - res : -1, row < res - 1 ? j + res : -1]) {
        if (k >= 0 && h.water[k] !== 1 && h.heights[k]! < shore) shore = h.heights[k]!;
      }
    }
    if (level === -Infinity) level = floor;
    level = Math.min(level + 0.04, shore - 0.03) - 0.04;
    out.push({
      id: out.length, cx: sx / n, cz: sz / n, r: Math.sqrt((n * h.step * h.step) / Math.PI),
      x0, x1, z0, z1, level: level + 0.04, floor, samples: n,
      boardwalk: bn > 0 ? { x0: bx0, x1: bx1, z0: bz0, z1: bz1, y: by } : null,
    });
  }
  return out;
}

// ─── small geometry (render layout.ts, verbatim) ─────────────────────────────

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax; const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px; const qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz);
}

function distToPolyline(pts: readonly Vec2[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!; const b = pts[i + 1]!;
    const d = distToSegment(x, z, a[0], a[1], b[0], b[1]);
    if (d < best) best = d;
  }
  return best;
}

/** Signed distance to the nearest road edge (negative inside a road). */
export function roadDistance(roads: readonly PlanRoad[], x: number, z: number): number {
  let best = Infinity;
  for (const r of roads) {
    const d = distToPolyline(r.points, x, z) - r.width / 2;
    if (d < best) best = d;
  }
  return best;
}

/** World → yawed local frame (inverse rotation about +Y). */
function toLocal(b: { readonly x: number; readonly z: number; readonly yaw: number }, x: number, z: number): Vec2 {
  const dx = x - b.x; const dz = z - b.z;
  const c = Math.cos(b.yaw); const s = Math.sin(b.yaw);
  return [c * dx - s * dz, s * dx + c * dz];
}

/** Yawed local frame → world. */
export function toWorld(b: { readonly x: number; readonly z: number; readonly yaw: number }, lx: number, lz: number): Vec2 {
  const c = Math.cos(b.yaw); const s = Math.sin(b.yaw);
  return [b.x + c * lx + s * lz, b.z - s * lx + c * lz];
}

/** Distance from a point to a building footprint (0 inside). */
export function footprintDistance(b: Pick<PlanBuilding, 'x' | 'z' | 'yaw' | 'w' | 'd'>, x: number, z: number): number {
  const [lx, lz] = toLocal(b, x, z);
  const qx = Math.max(0, Math.abs(lx) - b.w / 2); const qz = Math.max(0, Math.abs(lz) - b.d / 2);
  return Math.sqrt(qx * qx + qz * qz);
}

/** A building's door (front wall centre, local +z) and the outward front normal. */
export function doorOf(b: Pick<PlanBuilding, 'x' | 'z' | 'yaw' | 'd'>): Door {
  const nx = Math.sin(b.yaw); const nz = Math.cos(b.yaw);
  return { x: b.x + nx * (b.d / 2), z: b.z + nz * (b.d / 2), nx, nz };
}

function rectsOverlap(a: Pick<PlanBuilding, 'x' | 'z' | 'yaw' | 'w' | 'd'>, b: Pick<PlanBuilding, 'x' | 'z' | 'yaw' | 'w' | 'd'>, pad: number): boolean {
  const corners = (r: typeof a): Vec2[] => {
    const hw = r.w / 2 + pad; const hd = r.d / 2 + pad;
    return [toWorld(r, -hw, -hd), toWorld(r, hw, -hd), toWorld(r, hw, hd), toWorld(r, -hw, hd)];
  };
  const ca = corners(a); const cb = corners(b);
  for (const r of [a, b]) {
    for (const [ax, az] of [[Math.cos(r.yaw), -Math.sin(r.yaw)], [Math.sin(r.yaw), Math.cos(r.yaw)]] as const) {
      let minA = Infinity; let maxA = -Infinity; let minB = Infinity; let maxB = -Infinity;
      for (const [x, z] of ca) { const p = x * ax + z * az; if (p < minA) minA = p; if (p > maxA) maxA = p; }
      for (const [x, z] of cb) { const p = x * ax + z * az; if (p < minB) minB = p; if (p > maxB) maxB = p; }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
}

/** Midpoint of the playable edge on side `dir` (the `ZoneSpec.edges` anchor). */
export function edgePoint(layout: ZoneKind, dir: Dir): Vec2 {
  const h = INTERIOR_SIZE[layout] / 2;
  switch (dir) {
    case 'n': return [0, -h];
    case 's': return [0, h];
    case 'e': return [h, 0];
    default: return [-h, 0];
  }
}

export function inEllipse(e: PlanEllipse, x: number, z: number, pad = 0): boolean {
  const dx = x - e.x; const dz = z - e.z;
  const c = Math.cos(e.yaw); const s = Math.sin(e.yaw);
  const lx = c * dx - s * dz; const lz = s * dx + c * dz;
  const rx = e.rx + pad; const rz = e.rz + pad;
  return (lx * lx) / (rx * rx) + (lz * lz) / (rz * rz) <= 1;
}

function inSetPiece(sp: PlanSetPiece, x: number, z: number, pad = 0): boolean {
  const [lx, lz] = toLocal(sp, x, z);
  return Math.abs(lx) < sp.hw + pad && Math.abs(lz) < sp.hd + pad;
}

/** A route's road centreline z at x (0 for towns and story zones). */
export function roadZAt(m: RoadMeander | null, x: number): number {
  if (m === null) return 0;
  return m.amp * Math.sin((2 * Math.PI * x) / m.wavelength + m.phase) + 0.5 * Math.sin((2 * Math.PI * x) / (m.wavelength * 0.37) + m.phase2);
}

/** True when the sample centre (x, z) is strictly inside `s` (render `TerrainCollider.blocked`'s test). */
export function solidContains(s: Solid, x: number, z: number): boolean {
  const dx = x - s.x; const dz = z - s.z;
  if (s.kind === 'circle') return dx * dx + dz * dz < s.r * s.r;
  const c = Math.cos(s.yaw); const sn = Math.sin(s.yaw);
  const lx = c * dx - sn * dz;
  const lz = sn * dx + c * dz;
  return Math.abs(lx) < s.hw && Math.abs(lz) < s.hd;
}

// ─── layout (render planLayout) ──────────────────────────────────────────────

interface LayoutCore {
  readonly half: number;
  readonly interior: Bounds;
  readonly plaza: PlanCircle | null;
  readonly roads: readonly PlanRoad[];
  readonly roadMeander: RoadMeander | null;
  readonly grassPatches: readonly PlanEllipse[];
  readonly clearings: readonly PlanCircle[];
  readonly setPiece: PlanSetPiece;
  readonly water: readonly WaterBody[];
  readonly points: readonly Vec2[];
  readonly warpPairs: readonly WarpPair[];
  /** A sculpted route's main road (its centreline replaces the meander's `z(x)`), else null. */
  readonly main: PlanRoad | null;
}

/** Distance from (x, z) to a route's road centreline: the sculpted main road's, or the meander's |z − z(x)|. */
export function routeCorridorDistance(main: PlanRoad | null, meander: RoadMeander | null, x: number, z: number): number {
  if (main !== null) return distToPolyline(main.points, x, z);
  return Math.abs(z - roadZAt(meander, x));
}

/** The point at arc length `s` along a polyline, with its unit tangent. */
function alongPolyline(pts: readonly Vec2[], s: number): { x: number; z: number; tx: number; tz: number } {
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!; const b = pts[i + 1]!;
    const len = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
    if (acc + len >= s || i + 2 === pts.length) {
      const t = len > 0 ? Math.min(1, Math.max(0, (s - acc) / len)) : 0;
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: len > 0 ? (b[0] - a[0]) / len : 1, tz: len > 0 ? (b[1] - a[1]) / len : 0 };
    }
    acc += len;
  }
  const p = pts[pts.length - 1] ?? [0, 0];
  return { x: p[0], z: p[1], tx: 1, tz: 0 };
}

function polylineLength(pts: readonly Vec2[]): number {
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) acc += Math.sqrt((pts[i + 1]![0] - pts[i]![0]) ** 2 + (pts[i + 1]![1] - pts[i]![1]) ** 2);
  return acc;
}

function pushOffWater(p: [number, number], water: readonly WaterBody[], perp: Vec2, clearance: number): void {
  for (let k = 0; k < 12; k++) {
    let hit: WaterBody | null = null;
    for (const w of water) if (Math.hypot(p[0] - w.cx, p[1] - w.cz) < w.r + clearance) { hit = w; break; }
    if (hit === null) return;
    const side = (p[0] - hit.cx) * perp[0] + (p[1] - hit.cz) * perp[1] >= 0 ? 1 : -1;
    p[0] += perp[0] * side * 1.5; p[1] += perp[1] * side * 1.5;
  }
}

/** A wiggling polyline from `a` to `b` (n segments), pushed away from water. */
function wigglePath(a: Vec2, b: Vec2, n: number, amp: number, rng: Rng, water: readonly WaterBody[], clearance: number): Vec2[] {
  const dx = b[0] - a[0]; const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const perp: Vec2 = [-dz / len, dx / len];
  const sign = rng.next() < 0.5 ? -1 : 1;
  const phase = rng.next() * Math.PI;
  const out: Vec2[] = [a];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const w = Math.sin(Math.PI * t) * amp * sign + Math.sin(t * 7 + phase) * amp * 0.25 * Math.sin(Math.PI * t);
    const p: [number, number] = [a[0] + dx * t + perp[0] * w, a[1] + dz * t + perp[1] * w];
    pushOffWater(p, water, perp, clearance);
    out.push(p);
  }
  out.push(b);
  return out;
}

/** Authored points in the adapter's order: npcs, trainers (the actors), items, lore, then each warp's door and arrival. */
function authoredPoints(zone: ZoneDef): Vec2[] {
  const out: Vec2[] = [];
  for (const n of zone.npcs) out.push([n.x, n.z]);
  for (const t of zone.trainers) out.push([t.x, t.z]);
  for (const i of zone.items) out.push([i.x, i.z]);
  for (const l of zone.lore) out.push([l.x, l.z]);
  for (const w of zone.warps) { out.push([w.x, w.z]); out.push([w.toX, w.toZ]); }
  return out;
}

/** The set-piece's spot: the sculpt's, else on the main road nearest x = 0, its local x along the road. */
function setPieceSpot(layout: ZoneKind, main: PlanRoad | null, sculpt: ZoneSculpt | undefined): { x: number; z: number; yaw: number } {
  if (sculpt?.setPiece !== undefined) return sculpt.setPiece;
  if (layout !== 'route' || main === null) return { x: 0, z: 0, yaw: 0 };
  let best = 0;
  for (let i = 0; i < main.points.length; i++) if (Math.abs(main.points[i]![0]) < Math.abs(main.points[best]![0])) best = i;
  const a = main.points[Math.max(0, best - 1)]!; const b = main.points[Math.min(main.points.length - 1, best + 1)]!;
  return { x: main.points[best]![0], z: main.points[best]![1], yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) };
}

/** z of the polyline point whose x is nearest `x`. */
function roadCentreZNear(pts: readonly Vec2[], x: number): number {
  let best = pts[0]!;
  for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
  return best[1];
}

function planLayout(zone: ZoneDef, seed: number, setPieceId: SetPieceId, water: readonly WaterBody[], sculpt: ZoneSculpt | undefined, sculpted: SculptResult | undefined, h: Heightfield): LayoutCore {
  const rng = forkLabelled(createRng(seed), 'layout');
  /** Water within `pad` of a disc of radius `r` at (x, z): ponds by their circle, everything else by the mask. */
  const wet = (x: number, z: number, r: number, pad: number): boolean =>
    water.some((w) => roundBody(w) && Math.hypot(w.cx - x, w.cz - z) < w.r + r + pad) || wetWithin(h, x, z, r + pad);
  // the sculpt's roads (sampled by the terrain pass): `road_main` / `road_<dir>` / `lane_s` replace the generated ones
  const sculptRoads = new Map<string, PlanRoad>();
  for (const r of sculpted?.roads ?? []) sculptRoads.set(r.id, { id: r.id, kind: r.kind, width: r.width, points: r.points });
  const used = new Set<string>();
  const sculptRoad = (id: string): PlanRoad | null => {
    const r = sculptRoads.get(id);
    if (r === undefined) return null;
    used.add(id);
    return r;
  };
  const layout = zone.kind;
  const half = ZONE_SIZE[layout] / 2;
  const ih = half - ZONE_MARGIN;
  const interior: Bounds = { minX: -ih, maxX: ih, minZ: -ih, maxZ: ih };
  const points = authoredPoints(zone);
  const tallGrass = zone.encounterTable !== null;
  const has = (d: Dir): boolean => zone.links[d] !== undefined;
  const roads: PlanRoad[] = [];
  const grassPatches: PlanEllipse[] = [];
  const clearings: PlanCircle[] = [];
  let plaza: PlanCircle | null = null;
  let roadMeander: RoadMeander | null = null;
  const T = TOWN_LAYOUT;

  if (layout === 'town') {
    plaza = { x: 0, z: 0, r: T.plazaR };
    for (const dir of DIRS) {
      if (!has(dir)) continue;
      const v = DIR_VEC[dir];
      const start: Vec2 = [v[0] * (T.plazaR - 0.6), v[1] * (T.plazaR - 0.6)];
      const end: Vec2 = [v[0] * half, v[1] * half];
      const own = sculptRoad(`road_${dir}`);
      if (own !== null) { roads.push(own); continue; }
      if (dir === 'n') {
        // detour west of the gym (footprint x ∈ [−7, 7], z ∈ [−38, −26])
        roads.push({ id: 'road_n', kind: 'road', width: T.roadWidth, points: [[-5.2, -12.9], [-10.4, -21], [-11.6, -30], [-11, -40], [-6.5, -50], [-1.5, -58], [0, -66], end] });
        continue;
      }
      roads.push({ id: `road_${dir}`, kind: 'road', width: T.roadWidth, points: wigglePath(start, end, 10, 2.2, rng, water, 5) });
    }
    if (!has('s')) {
      // the south lane the shop and healer flank; it ends at a south pond's bank when there is one
      const pond = water.find((w) => w.cz > 20 && w.cz < 60 && Math.abs(w.cx) < 20);
      const endZ = pond ? pond.cz - pond.r - 3.5 : T.plazaR + 22;
      const endX = pond ? pond.cx * 0.6 : 0;
      const own = sculptRoad('lane_s');
      if (own !== null) roads.push(own);
      else roads.push({ id: 'lane_s', kind: 'lane', width: T.laneWidth, points: wigglePath([0, T.plazaR - 0.6], [endX, endZ], 6, 0.8, rng, [], 0) });
    }
  } else if (layout === 'route') {
    const R = ROUTE_LAYOUT;
    const phase = rng.next() * Math.PI * 2;
    const phase2 = rng.next() * Math.PI * 2;
    const own = sculptRoad('road_main');
    const meander: RoadMeander | null = own === null ? { amp: R.meanderAmp, wavelength: R.meanderWavelength, phase, phase2 } : null;
    roadMeander = meander;
    const roadZ = (x: number): number => roadZAt(meander, x);
    if (own !== null) roads.push(own);
    else {
      const pts: Vec2[] = [];
      for (let x = -half; x <= half + 1e-6; x += 4) pts.push([x, roadZ(x)]);
      roads.push({ id: 'road_main', kind: 'road', width: R.roadWidth, points: pts });
    }
    const main = roads[0]!;
    for (const dir of ['n', 's'] as const) {
      if (!has(dir)) continue;
      const v = DIR_VEC[dir];
      const spur = sculptRoad(`road_${dir}`);
      roads.push(spur ?? { id: `road_${dir}`, kind: 'road', width: R.roadWidth, points: wigglePath([0, roadZ(0)], [v[0] * half, v[1] * half], 10, 3, rng, water, 5) });
    }
    const ext = SET_PIECE_EXTENT[setPieceId];
    const spot = own === null ? { x: 0, z: 0, yaw: 0 } : setPieceSpot('route', main, sculpt);
    const clearOfSetPiece = (x: number, z: number, rx: number, rz: number): boolean => {
      const [lx, lz] = toLocal(spot, x, z);
      const r = own === null ? 0 : Math.max(rx, rz);
      return !(Math.abs(lx) < ext.hw + (own === null ? rx : r) + 2 && Math.abs(lz) < ext.hd + (own === null ? rz : r) + 2);
    };
    if (tallGrass && sculpt?.grass !== undefined) {
      for (const g of sculpt.grass) grassPatches.push({ x: g.x, z: g.z, rx: g.rx, rz: g.rz, yaw: g.yaw ?? 0 });
    } else if (tallGrass && own !== null) {
      // along the sculpted road: alternate sides, set back from its edge
      const n = R.patches[1] - 1 + Math.floor(rng.next() * 2);
      let side = rng.next() < 0.5 ? 1 : -1;
      const total = polylineLength(main.points);
      for (let k = 0; k < n; k++) {
        const s0 = 40 + (k * (total - 80)) / Math.max(1, n - 1) + (rng.next() - 0.5) * 16;
        const rz = R.patchRz * (0.85 + rng.next() * 0.3);
        const rx = R.patchRx * (0.85 + rng.next() * 0.3);
        let placed: PlanEllipse | null = null;
        for (let attempt = 0; attempt < 16 && placed === null; attempt++) {
          const sAt = s0 + (attempt % 8 === 0 ? 0 : ((attempt % 2 === 0 ? 1 : -1) * Math.ceil((attempt % 8) / 2) * 6));
          const sd = attempt >= 8 ? -side : side;
          const q = alongPolyline(main.points, sAt);
          const off = main.width / 2 + 1.2 + rz;
          const x = q.x - q.tz * sd * off; const z = q.z + q.tx * sd * off;
          const e: PlanEllipse = { x, z, rx, rz, yaw: Math.atan2(-q.tz, q.tx) };
          if (Math.abs(x) + rx > ih - 4 || Math.abs(z) + rx > ih - 4) continue;
          if (wet(x, z, Math.max(rx, rz), 3)) continue;
          if (points.some(([px, pz]) => inEllipse(e, px, pz, 1.5))) continue;
          if (!clearOfSetPiece(x, z, rx, rz)) continue;
          placed = e;
        }
        if (placed !== null) grassPatches.push(placed);
        side = -side;
      }
    } else if (tallGrass) {
      const n = R.patches[1] - 1 + Math.floor(rng.next() * 2);   // 4–5 of the SPEC's 3–5: a 208 m route reads sparse with fewer
      let side = rng.next() < 0.5 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const baseX = -ih + 22 + (k * (2 * ih - 44)) / Math.max(1, n - 1) + (rng.next() - 0.5) * 16;
        const yaw = (rng.next() - 0.5) * 0.35;
        const rz = R.patchRz * (0.85 + rng.next() * 0.3);
        const rx = R.patchRx * (0.85 + rng.next() * 0.3);
        let placed: PlanEllipse | null = null;
        for (let attempt = 0; attempt < 16 && placed === null; attempt++) {
          const x = baseX + (attempt % 8 === 0 ? 0 : ((attempt % 2 === 0 ? 1 : -1) * Math.ceil((attempt % 8) / 2) * 6));
          const s = attempt >= 8 ? -side : side;
          const z = roadZ(x) + s * (R.roadWidth / 2 + 1.2 + rz);
          const e: PlanEllipse = { x, z, rx, rz, yaw };
          if (Math.abs(x) + rx > ih - 4) continue;
          if (wet(x, z, rx, 3)) continue;
          if (points.some(([px, pz]) => inEllipse(e, px, pz, 1.5))) continue;
          if (!clearOfSetPiece(x, z, rx, rz)) continue;
          placed = e;
        }
        if (placed !== null) grassPatches.push(placed);
        side = -side;
      }
    }
    const nc = R.clearings[0] + Math.floor(rng.next() * (R.clearings[1] - R.clearings[0] + 1));
    for (let k = 0; k < nc; k++) {
      const r = R.clearingR[0] + rng.next() * (R.clearingR[1] - R.clearingR[0]);
      for (let attempt = 0; attempt < 12; attempt++) {
        const x = -ih + 30 + ((k + 0.5) * (2 * ih - 60)) / nc + (rng.next() - 0.5) * 24;
        const z = (own === null ? 0 : roadCentreZNear(main.points, x)) + (rng.next() < 0.5 ? -1 : 1) * (18 + rng.next() * 26);
        if (Math.abs(x) > ih - r - 4 || Math.abs(z) > ih - r - 4) continue;
        if (wet(x, z, r, 3)) continue;
        if (grassPatches.some((e) => Math.hypot(e.x - x, e.z - z) < Math.max(e.rx, e.rz) + r + 2)) continue;
        if (own !== null && distToPolyline(main.points, x, z) < r + 4) continue;
        clearings.push({ x, z, r });
        break;
      }
    }
  } else {
    plaza = { x: 0, z: 0, r: STORY_LAYOUT.platformR };
    for (const dir of DIRS) {
      if (!has(dir)) continue;
      const v = DIR_VEC[dir];
      const own = sculptRoad(`road_${dir}`);
      if (own !== null) { roads.push(own); continue; }
      roads.push({ id: `road_${dir}`, kind: 'road', width: STORY_LAYOUT.roadWidth, points: wigglePath([v[0] * (STORY_LAYOUT.platformR - 0.6), v[1] * (STORY_LAYOUT.platformR - 0.6)], [v[0] * half, v[1] * half], 10, 2.5, rng, water, 5) });
    }
  }

  // the sculpt's other roads: lanes and trails (ramps, side paths, loops)
  for (const [id, r] of sculptRoads) if (!used.has(id)) roads.push(r);

  if (layout !== 'route' && tallGrass && sculpt?.grass !== undefined) {
    for (const g of sculpt.grass) grassPatches.push({ x: g.x, z: g.z, rx: g.rx, rz: g.rz, yaw: g.yaw ?? 0 });
  } else if (layout !== 'route' && tallGrass) {
    // towns / story zones with an encounter table: patches on the outskirts, away from roads and the gym
    const n = 3;
    const base = rng.next() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const a = base + (k * Math.PI * 2) / n + attempt * 0.37;
        const rr = (layout === 'town' ? 44 : 38) + rng.next() * 12;
        const x = Math.cos(a) * rr; const z = Math.sin(a) * rr;
        const e: PlanEllipse = { x, z, rx: ROUTE_LAYOUT.patchRx, rz: ROUTE_LAYOUT.patchRz, yaw: a + Math.PI / 2 };
        if (Math.abs(x) + 9 > ih - 3 || Math.abs(z) + 9 > ih - 3) continue;
        if (roadDistance(roads, x, z) < 10) continue;
        if (layout === 'town' && z < -20 && Math.abs(x) < 16) continue;
        if (wet(x, z, 8, 3)) continue;
        if (points.some(([px, pz]) => inEllipse(e, px, pz, 1.5))) continue;
        grassPatches.push(e);
        break;
      }
    }
  }

  const main = layout === 'route' && roadMeander === null ? roads[0]! : null;
  const sp = main !== null || sculpt?.setPiece !== undefined ? setPieceSpot(layout, main, sculpt) : layout === 'route' ? { x: 0, z: roadZAt(roadMeander, 0), yaw: 0 } : { x: 0, z: 0, yaw: 0 };
  const ext = SET_PIECE_EXTENT[setPieceId];
  const warpPairs: WarpPair[] = zone.warps.map((w) => ({ id: w.id, door: [w.x, w.z] as Vec2, to: [w.toX, w.toZ] as Vec2 }));
  return {
    half, interior, plaza, roads, roadMeander, grassPatches, clearings,
    setPiece: { id: setPieceId, x: sp.x, z: sp.z, yaw: sp.yaw, hw: ext.hw, hd: ext.hd },
    water, points, warpPairs, main,
  };
}

// ─── buildings (render planBuildings) ────────────────────────────────────────

function buildingFits(L: LayoutCore, b: PlanBuilding, placed: readonly PlanBuilding[], gap: number, h: Heightfield): boolean {
  const ih = L.half - ZONE_MARGIN;
  const hw = b.w / 2; const hd = b.d / 2;
  // on level, walkable ground: never astride a cliff, a crag or a bank (the plinth hides up to 1.2 m of fall)
  let lo = Infinity; let hi = -Infinity;
  for (let gx = -1; gx <= 1; gx += 0.5) {
    for (let gz = -1; gz <= 1; gz += 0.5) {
      const [x, z] = toWorld(b, gx * (hw + 0.5), gz * (hd + 0.5));
      if (!baseWalkable(h, x, z)) return false;
      const y = heightClamped(h, x, z);
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
  }
  if (hi - lo > 1.2) return false;
  for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as const) {
    const [x, z] = toWorld(b, lx, lz);
    if (Math.abs(x) > ih - 3 || Math.abs(z) > ih - 3) return false;
  }
  for (const [px, pz] of L.points) if (footprintDistance(b, px, pz) < TOWN_LAYOUT.pointClearance) return false;
  // roads: sample the footprint (inflated 1 m) on a grid
  for (let gx = -1; gx <= 1; gx += 0.25) {
    for (let gz = -1; gz <= 1; gz += 0.25) {
      const [x, z] = toWorld(b, gx * (hw + 1), gz * (hd + 1));
      if (roadDistance(L.roads, x, z) < 0.6) return false;
      if (L.plaza && Math.hypot(x - L.plaza.x, z - L.plaza.z) < L.plaza.r + 3) return false;
      for (const w of L.water) if (roundBody(w) && Math.hypot(x - w.cx, z - w.cz) < w.r + 3.5) return false;
      if (wetWithin(h, x, z, 3.5)) return false;
      if (inSetPiece(L.setPiece, x, z, 1)) return false;
    }
  }
  for (const p of placed) if (rectsOverlap(b, p, gap / 2)) return false;
  return true;
}

/** Faces the plaza centre: local +z (the door) points at (0, 0). */
function facingCentre(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

/**
 * Town buildings: the gym first (door exactly at world (0, −26), facing +z — the server's league marker), shop and
 * healer flanking the south road, then houses round the ring until 6–10 stand. Warp doors try a hut whose door is
 * the marker — which the 2.5 m point clearance (the marker is itself an authored point) always refuses, so no zone
 * has one; the seed draw is kept so the rest of the stream is unchanged.
 */
function planBuildings(zone: ZoneDef, L: LayoutCore, rng: Rng, h: Heightfield): PlanBuilding[] {
  const out: PlanBuilding[] = [];
  const T = TOWN_LAYOUT;
  const roofs = BIOME_ROOFS[zone.biome] ?? BIOME_ROOFS.grove;
  const houses = roofs.houses; const landmarkRoof = roofs.landmark;
  const pickRoof = (): RoofKind => (houses.length === 0 ? 'slate' : houses[Math.min(houses.length - 1, Math.floor(Math.pow(rng.next(), 1.3) * houses.length))]!);

  const clearOfPoints = (b: PlanBuilding): boolean => L.points.every(([px, pz]) => footprintDistance(b, px, pz) >= TOWN_LAYOUT.pointClearance + 0.1);
  for (const w of L.warpPairs) {
    const hall = /hall|league/i.test(w.id);
    const [dx, dz] = w.door;
    const len = Math.hypot(dx, dz) || 1;
    const base = Math.atan2(-dx / len, -dz / len);           // front faces the zone centre first
    const seed = u32(rng);
    let chosen: PlanBuilding | null = null;
    for (const shrink of [1, 0.85, 0.7]) {
      for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
        const yaw = base + turn;
        const wW = (hall ? 12 : 6.5) * shrink; const wD = (hall ? 10 : 5.5) * shrink;
        const nx = Math.sin(yaw); const nz = Math.cos(yaw);
        const b: PlanBuilding = { id: `${zone.id}.warp.${w.id}`, kind: hall ? 'landmark' : 'house', x: snap(dx - nx * wD / 2, 0.01), z: snap(dz - nz * wD / 2, 0.01), yaw, w: snap(wW), d: snap(wD), floors: hall ? 2 : 1, roof: hall ? landmarkRoof : 'slate', seed };
        if (clearOfPoints(b)) { chosen = b; break; }
      }
      if (chosen) break;
    }
    if (chosen) out.push({ ...chosen, roof: hall ? landmarkRoof : pickRoof() });
  }

  if (zone.kind !== 'town') return out;

  // the league hall (Wardens + Champion) stands in the gym slot of the town that hosts them (solenne)
  const leagueHall = zone.gym === null && LEAGUE.some((l) => l.zoneId === zone.id && l.stage !== 'gym');
  if (zone.gym !== null || leagueHall) {
    // the door is fixed (the server's (0, −26)); the hall shrinks until every authored point is clear of it
    const [gx, gz] = T.gymDoor;
    const seed = u32(rng);
    const id = leagueHall ? `${zone.id}.league` : `${zone.id}.gym`;
    let gym: PlanBuilding | null = null;
    for (let d = T.gymD; d >= 5 && gym === null; d -= 0.5) {
      for (let w = T.gymW; w >= 8 && gym === null; w -= 0.5) {
        const b: PlanBuilding = { id, kind: 'gym', x: gx, z: gz - d / 2, yaw: 0, w, d, floors: 2, roof: landmarkRoof, seed };
        if (clearOfPoints(b)) gym = b;
      }
    }
    out.push(gym ?? { id, kind: 'gym', x: gx, z: gz - T.gymD / 2, yaw: 0, w: T.gymW, d: T.gymD, floors: 2, roof: landmarkRoof, seed });
  }
  const lane = L.roads.find((r) => r.id === 'road_s' || r.id === 'lane_s');
  const flank = (kind: 'shop' | 'healer', side: -1 | 1): void => {
    const w = kind === 'shop' ? 9 : 10; const d = kind === 'shop' ? 7 : 8;
    for (let attempt = 0; attempt < 16; attempt++) {
      const r = T.ringMin + d / 2 + (attempt % 4) * 1.5;
      const off = (lane ? lane.width / 2 : 1.75) + T.gap / 2 + w / 2 + Math.floor(attempt / 4) * 1.5;
      const a = Math.PI / 2 + side * Math.atan2(off, r);
      const x = Math.cos(a) * Math.hypot(r, off); const z = Math.sin(a) * Math.hypot(r, off);
      const b: PlanBuilding = { id: `${zone.id}.${kind}`, kind, x: snap(x, 0.01), z: snap(z, 0.01), yaw: facingCentre(x, z), w, d, floors: kind === 'healer' ? 2 : 1, roof: 'tile', seed: u32(rng) };
      if (buildingFits(L, b, out, T.gap, h)) { out.push(b); return; }
    }
  };
  if (zone.shop !== null) flank('shop', -1);
  if (zone.healer) flank('healer', 1);

  const target = T.buildings[0] + Math.floor(rng.next() * (T.buildings[1] - T.buildings[0] + 1));
  const start = rng.next() * Math.PI * 2;
  let idx = 0;
  for (let step = 0; step < 240 && out.length < target; step++) {
    const a = start + (step * Math.PI * 2) / 120;
    const w = snap(7 + rng.next() * 2.5); const d = snap(5.5 + rng.next() * 1.75);
    const r = T.ringMin + rng.next() * (T.ringMax - T.ringMin);
    const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    const b: PlanBuilding = { id: `${zone.id}.house${idx}`, kind: 'house', x: snap(x, 0.01), z: snap(z, 0.01), yaw: facingCentre(x, z), w, d, floors: rng.next() < 0.45 ? 2 : 1, roof: pickRoof(), seed: u32(rng) };
    if (buildingFits(L, b, out, T.gap, h)) { out.push(b); idx++; }
  }
  return out;
}

/** Nearest point on a polyline to (x, z). */
function nearestOnPolyline(pts: readonly Vec2[], x: number, z: number): Vec2 {
  let best: Vec2 = pts[0]!; let bd = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!; const b = pts[i + 1]!;
    const dx = b[0] - a[0]; const dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a[0] + dx * t; const pz = a[1] + dz * t;
    const d = (px - x) * (px - x) + (pz - z) * (pz - z);
    if (d < bd) { bd = d; best = [px, pz]; }
  }
  return best;
}

/**
 * Door paths: a 1.6 m path from each building door to the nearest point of a road or of the plaza rim, leaving
 * the door straight out for 1.2 m first so it meets the step square-on.
 */
function planDoorPaths(L: LayoutCore, buildings: readonly PlanBuilding[]): PlanRoad[] {
  const out: PlanRoad[] = [];
  for (const b of buildings) {
    const d = doorOf(b);
    const sx = d.x + d.nx * 1.2; const sz = d.z + d.nz * 1.2;
    let target: Vec2 | null = null; let td = Infinity;
    for (const r of L.roads) {
      const q = nearestOnPolyline(r.points, sx, sz);
      const dist = Math.hypot(q[0] - sx, q[1] - sz);
      if (dist < td) { td = dist; target = q; }
    }
    if (L.plaza) {
      const dx = sx - L.plaza.x; const dz = sz - L.plaza.z;
      const l = Math.hypot(dx, dz) || 1;
      const q: Vec2 = [L.plaza.x + (dx / l) * (L.plaza.r - 0.4), L.plaza.z + (dz / l) * (L.plaza.r - 0.4)];
      const dist = Math.hypot(q[0] - sx, q[1] - sz);
      if (dist < td) { td = dist; target = q; }
    }
    const pts: Vec2[] = [[d.x - d.nx * 0.2, d.z - d.nz * 0.2], [sx, sz]];
    if (target !== null && td < 24) pts.push(target); else pts.push([d.x + d.nx * 6, d.z + d.nz * 6]);
    out.push({ id: `path_${b.id}`, kind: 'path', width: TOWN_LAYOUT.pathWidth, points: pts });
  }
  return out;
}

/** Length of the door approach beyond the building's own footprint (the door path's straight first run). */
export const DOOR_APPROACH_M = 1.2;
/** Buildings stand on a 12 cm plinth; their footprint is the plinth grown by the capsule radius. */
const PLINTH_M = 0.12;

/**
 * The strip in front of a door that stays walkable: door-path wide (1.6 m) and 1.2 m long, starting where the
 * building's own footprint ends (plinth + capsule radius), so a player walks right up to the door but never into
 * the wall — `isWalkable` reads the nearest sample, so carving the footprint band itself would admit centres up to
 * 0.23 m inside a rotated facade. No other footprint (fence, barrel, lamp, trunk) may cover the strip.
 */
function doorApproach(b: PlanBuilding): DoorApproach {
  const door = doorOf(b);
  const [x, z] = toWorld(b, 0, b.d / 2 + PLINTH_M + MOVER_RADIUS + DOOR_APPROACH_M / 2);
  return { building: b.id, door, approach: { kind: 'rect', x, z, hw: TOWN_LAYOUT.pathWidth / 2, hd: DOOR_APPROACH_M / 2, yaw: b.yaw } };
}

// ─── lights (render planLights, positions only) ──────────────────────────────

function planLights(zone: ZoneDef, L: LayoutCore, h: Heightfield, buildings: readonly PlanBuilding[], rng: Rng): PlanLight[] {
  const generator = BIOME_LIGHT_GENERATOR[zone.biome] ?? BIOME_LIGHT_GENERATOR.grove;
  const out: PlanLight[] = [];
  let shadow = 0; let nonShadow = 0;
  const taken: Vec2[] = [];
  const clear = (x: number, z: number): boolean => {
    for (const [px, pz] of L.points) if (Math.hypot(px - x, pz - z) < 1.8) return false;
    if (Math.hypot(zone.spawn.x - x, zone.spawn.z - z) < 1.8) return false;
    for (const b of buildings) if (footprintDistance(b, x, z) < 1.0) return false;
    for (const w of L.water) if (roundBody(w) && Math.hypot(w.cx - x, w.cz - z) < w.r + 1.5) return false;
    if (wetWithin(h, x, z, 1.5)) return false;
    for (const [tx, tz] of taken) if (Math.hypot(tx - x, tz - z) < 5) return false;
    if (inSetPiece(L.setPiece, x, z, 0.8)) return false;
    return Math.abs(x) < L.half - ZONE_MARGIN - 1 && Math.abs(z) < L.half - ZONE_MARGIN - 1;
  };
  const add = (id: string, role: LightRole, x: number, z: number, wantShadow: boolean, gen: HousingGenerator = generator): boolean => {
    const cast = wantShadow && shadow < ZONE_LIGHT_CAP.shadow;
    if (!cast && nonShadow >= ZONE_LIGHT_CAP.nonShadow) return false;
    if (!clear(x, z)) return false;
    const ground = heightClamped(h, x, z);
    out.push({ id: `${zone.id}.light.${id}`, role, x: round3(x), z: round3(z), ground, castShadow: cast, generator: gen, slot: null, seed: u32(rng) });
    taken.push([x, z]);
    if (cast) shadow++; else nonShadow++;
    return true;
  };

  // set-piece lights first (their housings are part of the set-piece geometry)
  const sp = L.setPiece;
  SET_PIECE_LIGHT_SLOTS[sp.id].forEach((l, k) => {
    const [wx, wz] = toWorld(sp, l.x, l.z);
    const ground = heightClamped(h, sp.x, sp.z);
    const cast = l.castShadow && shadow < ZONE_LIGHT_CAP.shadow;
    out.push({ id: `${zone.id}.light.setpiece${k}`, role: 'setpiece', x: round3(wx), z: round3(wz), ground, castShadow: cast, generator: null, slot: k, seed: null });
    if (cast) shadow++; else nonShadow++;
  });

  if (zone.kind === 'town' && L.plaza) {
    const base = Math.PI / 4 + (rng.next() - 0.5) * 0.2;
    for (let k = 0; k < 4; k++) {
      for (let t = 0; t < 5; t++) {
        const a = base + (k * Math.PI) / 2 + (t % 2 === 0 ? 1 : -1) * Math.ceil(t / 2) * 0.16;
        const r = L.plaza.r + 1.3;
        if (add(`plaza${k}`, 'plaza', Math.cos(a) * r, Math.sin(a) * r, k === 1 || k === 2)) break;
      }
    }
    for (const b of buildings) {
      const d = doorOf(b);
      const sx = d.nz; const sz = -d.nx;                        // along the front wall
      if (b.kind === 'gym') {
        for (const s of [-1, 1]) add(`gym_beacon${s < 0 ? 'L' : 'R'}`, 'gym_beacon', d.x + sx * s * 4.2 + d.nx * 1.6, d.z + sz * s * 4.2 + d.nz * 1.6, false, 'beacon');
      }
    }
  }
  // roads: every ~15 m, alternating sides, from the plaza / platform to 8 m inside the edge
  for (const road of L.roads) {
    if (road.kind === 'path') continue;
    let acc = 7; let side = rng.next() < 0.5 ? 1 : -1; let n = 0;
    const spacing = zone.kind === 'route' ? 42 : 15;
    for (let s = 0; s + 1 < road.points.length; s++) {
      const a = road.points[s]!; const b = road.points[s + 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (acc <= len) {
        const t = acc / len;
        const x = a[0] + (b[0] - a[0]) * t; const z = a[1] + (b[1] - a[1]) * t;
        const px = -(b[1] - a[1]) / len; const pz = (b[0] - a[0]) / len;
        const ox = x + px * side * (road.width / 2 + 1.1); const oz = z + pz * side * (road.width / 2 + 1.1);
        const inside = Math.max(Math.abs(ox), Math.abs(oz)) < L.half - ZONE_MARGIN - HANDOVER_INSET - 2;
        if (inside && (L.plaza === null || Math.hypot(ox, oz) > L.plaza.r + 4) && add(`${road.id}_${n}`, 'road', ox, oz, false)) { n++; side = -side; }
        acc += spacing;
      }
      acc -= len;
    }
  }
  if (zone.kind === 'town') {
    for (const b of buildings) {
      if (b.kind === 'gym') continue;
      if (b.kind === 'house' && rng.next() < 0.5) continue;
      const d = doorOf(b);
      const s = rng.next() < 0.5 ? -1 : 1;
      add(`door_${b.id.split('.').pop()}`, 'door', d.x + d.nx * 1.5 + d.nz * s * 1.9, d.z + d.nz * 1.5 - d.nx * s * 1.9, false);
    }
  }
  for (const c of L.clearings) add(`clearing_${Math.round(c.x)}`, 'clearing', c.x + c.r * 0.45, c.z, false);
  return out;
}

// ─── props (render planProps) ────────────────────────────────────────────────

/**
 * Hand-placed props: plaza benches and planters, a well, crates / barrels / a stall by the shop, barrels beside
 * houses, fenced garden plots, carts, signposts at every exit; logs, stumps and rocks at route clearings.
 */
function planProps(zone: ZoneDef, L: LayoutCore, buildings: readonly PlanBuilding[], lights: readonly PlanLight[], rng: Rng, h: Heightfield, sculpt: ZoneSculpt | undefined): PlanProp[] {
  const out: PlanProp[] = [];
  const clearOf = (x: number, z: number, r: number): boolean => {
    if (Math.max(Math.abs(x), Math.abs(z)) > L.half - ZONE_MARGIN - 1.5) return false;
    if (!baseWalkable(h, x, z)) return false;
    for (const [px, pz] of L.points) if (Math.hypot(px - x, pz - z) < 1.6 + r) return false;
    if (Math.hypot(zone.spawn.x - x, zone.spawn.z - z) < 1.6 + r) return false;
    for (const b of buildings) if (footprintDistance(b, x, z) < r + 0.3) return false;
    // never over a door approach (it stays walkable, so a footprint there would have a walkable hole)
    for (const b of buildings) {
      const ap = doorApproach(b).approach;
      if (footprintDistance({ x: ap.x, z: ap.z, yaw: ap.yaw, w: ap.hw * 2, d: ap.hd * 2 }, x, z) < r + MOVER_RADIUS + 0.1) return false;
    }
    for (const l of lights) if (Math.hypot(l.x - x, l.z - z) < r + 0.9) return false;
    for (const w of L.water) if (roundBody(w) && Math.hypot(w.cx - x, w.cz - z) < w.r + r + 1.2) return false;
    if (wetWithin(h, x, z, r + 1.2)) return false;
    for (const p of out) if (Math.hypot(p.x - x, p.z - z) < r + 0.9) return false;
    if (inSetPiece(L.setPiece, x, z, r)) return false;
    return true;
  };
  const put = (kind: string, x: number, z: number, yaw: number, r: number, scale = 1, needRoadClear = true): boolean => {
    if (!clearOf(x, z, r)) return false;
    // a fence run reaches 1.87 m along its axis: keep its whole length off the authored points
    if (kind === 'fence') for (const [px, pz] of L.points) if (Math.hypot(px - x, pz - z) < FENCE_HALF.hw + 1.6) return false;
    if (needRoadClear && roadDistance(L.roads, x, z) < r + 0.3) return false;
    out.push({ kind, x: round3(x), z: round3(z), yaw: round3(yaw), scale: round3(scale), seed: u32(rng) });
    return true;
  };

  if (zone.kind === 'town' && L.plaza) {
    const P = L.plaza;
    // benches facing the centre, planters between them
    const a0 = rng.next() * 0.4;
    for (let k = 0; k < 6; k++) {
      const a = a0 + (k * Math.PI * 2) / 6 + Math.PI / 6;
      const r = P.r - 1.6;
      const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      const yaw = Math.atan2(-x, -z) + Math.PI;               // seat faces the centre
      if (k % 2 === 0) put('bench', x, z, yaw, 1.1, 1, false); else put('planter', x, z, yaw, 0.9, 1, false);
    }
    // two market stalls on the plaza with crates and barrels round them
    for (let k = 0; k < 2; k++) {
      for (let t = 0; t < 6; t++) {
        const a = a0 + k * Math.PI + Math.PI / 2 + (t % 2 === 0 ? 1 : -1) * Math.ceil(t / 2) * 0.22;
        const r = P.r - 4.4;
        const x = Math.cos(a) * r; const z = Math.sin(a) * r;
        const yaw = Math.atan2(-x, -z);
        if (!put('stall', x, z, yaw, 1.8, 1, false)) continue;
        const sx = Math.cos(yaw); const sz = -Math.sin(yaw);
        for (let c = 0; c < 3; c++) put(rng.next() < 0.5 ? 'crate' : 'barrel', x + sx * (1.9 + c * 0.1) * (c === 1 ? -1 : 1) - Math.sin(yaw) * (0.9 + c * 0.35), z + sz * (1.9 + c * 0.1) * (c === 1 ? -1 : 1) - Math.cos(yaw) * (0.9 + c * 0.35), rng.next() * 6.28, 0.45, 1, false);
        break;
      }
    }
    // the well on the plaza street
    for (let t = 0; t < 16; t++) {
      const a = Math.PI * 1.15 + t * 0.4;
      if (put('well', Math.cos(a) * (P.r + 4.2), Math.sin(a) * (P.r + 4.2), rng.next() * Math.PI * 2, 1.4)) break;
    }
    for (const b of buildings) {
      const d = doorOf(b);
      const sx = d.nz; const sz = -d.nx;
      if (b.kind === 'shop') {
        const s = rng.next() < 0.5 ? -1 : 1;
        put('stall', d.x + d.nx * 3.2 + sx * s * 4.2, d.z + d.nz * 3.2 + sz * s * 4.2, b.yaw, 1.7);
        for (let k = 0; k < 3; k++) put('crate', d.x + d.nx * 0.9 - sx * s * (b.w / 2 - 0.6 - k * 0.8), d.z + d.nz * 0.9 - sz * s * (b.w / 2 - 0.6 - k * 0.8), b.yaw + (rng.next() - 0.5) * 0.6, 0.55);
        for (let k = 0; k < 2; k++) put('barrel', d.x + d.nx * 0.8 + sx * s * (b.w / 2 - 0.5 - k * 0.7), d.z + d.nz * 0.8 + sz * s * (b.w / 2 - 0.5 - k * 0.7), rng.next() * 6.28, 0.45);
      } else if (b.kind === 'house' || b.kind === 'healer') {
        // a front garden: two picket runs parallel to the facade either side of the door path, flowers inside
        if (b.kind === 'house' && rng.next() < 0.75) {
          for (const s2 of [-1, 1]) {
            const fx = d.x + d.nx * 2.9 + sx * s2 * 2.75; const fz = d.z + d.nz * 2.9 + sz * s2 * 2.75;
            put('fence', fx, fz, b.yaw, 0.3, 1, true);
            put('flower_patch', d.x + d.nx * 1.5 + sx * s2 * 2.2, d.z + d.nz * 1.5 + sz * s2 * 2.2, rng.next() * 6.28, 0.5, 1, true);
          }
        }
        // barrels / crates against a side wall
        if (rng.next() < 0.7) {
          const side = rng.next() < 0.5 ? -1 : 1;
          const [x, z] = toWorld(b, side * (b.w / 2 + 0.55), b.d / 2 - 1.0 - rng.next() * 1.5);
          put(rng.next() < 0.6 ? 'barrel' : 'crate', x, z, rng.next() * 6.28, 0.45);
          const [x2, z2] = toWorld(b, side * (b.w / 2 + 0.55), b.d / 2 - 2.2 - rng.next());
          if (rng.next() < 0.5) put('barrel', x2, z2, rng.next() * 6.28, 0.45);
        }
        // a fenced garden plot behind some houses
        if (b.kind === 'house' && rng.next() < 0.55) {
          const gw = 5.4; const gd = 3.6;
          const [cx, cz] = toWorld(b, (rng.next() - 0.5) * 1.5, -(b.d / 2 + 0.8 + gd / 2));
          const g = { x: cx, z: cz, yaw: b.yaw, w: gw, d: gd };
          let ok = true;
          for (let gx = -1; gx <= 1 && ok; gx += 0.5) for (let gz = -1; gz <= 1 && ok; gz += 0.5) {
            const [x, z] = toWorld(g, gx * (gw / 2 + 0.3), gz * (gd / 2 + 0.3));
            if (!clearOf(x, z, 0.2) || roadDistance(L.roads, x, z) < 0.5) ok = false;
          }
          if (ok) out.push({ kind: 'garden', x: round3(cx), z: round3(cz), yaw: round3(b.yaw), scale: 1, seed: u32(rng) });
        }
      }
    }
    // a cart and a woodpile by the roads
    for (const road of L.roads) {
      if (road.kind !== 'road') continue;
      const p = road.points[Math.min(road.points.length - 1, 3)]!;
      const q = road.points[Math.min(road.points.length - 1, 4)]!;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const px = -(q[1] - p[1]) / len; const pz = (q[0] - p[0]) / len;
      const yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
      if (!put('cart', p[0] + px * (road.width / 2 + 1.6), p[1] + pz * (road.width / 2 + 1.6), yaw + 0.2, 1.4)) put('cart', p[0] - px * (road.width / 2 + 1.6), p[1] - pz * (road.width / 2 + 1.6), yaw - 0.2, 1.4);
    }
  }
  // signposts at every exit (road ends, 9 m inside the playable edge)
  const ih = L.half - ZONE_MARGIN - 9;
  for (const road of L.roads) {
    if (road.kind !== 'road') continue;
    for (const fromEnd of [true, false]) {
      const pts = fromEnd ? road.points : [...road.points].reverse();
      if (Math.max(Math.abs(pts[pts.length - 1]![0]), Math.abs(pts[pts.length - 1]![1])) < ih) continue;   // this end is inside (plaza side)
      for (let s = pts.length - 1; s > 0; s--) {
        const p = pts[s]!; const q = pts[s - 1]!;
        if (Math.max(Math.abs(q[0]), Math.abs(q[1])) > ih) continue;
        const len = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
        const px = -(p[1] - q[1]) / len; const pz = (p[0] - q[0]) / len;
        const yaw = Math.atan2(p[0] - q[0], p[1] - q[1]);
        const side = rng.next() < 0.5 ? 1 : -1;
        if (!put('sign', q[0] + px * side * (road.width / 2 + 0.9), q[1] + pz * side * (road.width / 2 + 0.9), yaw, 0.6)) {
          put('sign', q[0] - px * side * (road.width / 2 + 0.9), q[1] - pz * side * (road.width / 2 + 0.9), yaw, 0.6);
        }
        break;
      }
    }
  }
  if (zone.kind === 'route') {
    for (const c of L.clearings) {
      put('log', c.x + (rng.next() - 0.5) * c.r, c.z + (rng.next() - 0.5) * c.r * 0.6, rng.next() * Math.PI, 1.8);
      put('stump', c.x + (rng.next() - 0.5) * c.r, c.z + (rng.next() - 0.5) * c.r, rng.next() * 6.28, 0.6);
      put('rock_m', c.x + (rng.next() - 0.5) * c.r * 1.2, c.z + (rng.next() - 0.5) * c.r, rng.next() * 6.28, 1.0);
    }
    // wayside fences along the road near both ends
    if (L.main === null) {
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const x = sx * (L.half - ZONE_MARGIN - 22 - k * 3.8);
          const zc = roadZAt(L.roadMeander, x);
          put('fence', x, zc + (rng.next() < 0.5 ? 1 : -1) * (ROUTE_LAYOUT.roadWidth / 2 + 1.4), Math.PI / 2, 0.4);
        }
      }
    } else {
      // a picket run along the verge at both ends of the sculpted road (the gate into the next place)
      const total = polylineLength(L.main.points);
      for (const atEnd of [false, true]) {
        const side = rng.next() < 0.5 ? 1 : -1;
        for (let k = 0; k < 4; k++) {
          const sAt = atEnd ? total - 26 - k * 3.73 : 26 + k * 3.73;
          const q = alongPolyline(L.main.points, sAt);
          const off = L.main.width / 2 + 1.4;
          put('fence', q.x - q.tz * side * off, q.z + q.tx * side * off, Math.atan2(-q.tz, q.tx), 0.4);
        }
      }
    }
  }
  // the sculpt's own fence runs and hand-placed props
  for (const run of sculpt?.fences ?? []) {
    for (let i = 0; i + 1 < run.length; i++) {
      const a = run[i]!; const b = run[i + 1]!;
      const len = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      const n = Math.max(1, Math.round(len / 3.73));
      const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        put('fence', a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, yaw, 0.3, 1, true);
      }
    }
  }
  for (const pp of sculpt?.props ?? []) put(pp.kind, pp.x, pp.z, pp.yaw ?? rng.next() * 6.28, PROP_SOLID_RADIUS[pp.kind] ?? 0.4, pp.scale ?? 1, true);
  return out;
}

/** The base field's walkable bit at the nearest sample (terrain only: margin, slope, open water). */
function baseWalkable(h: Heightfield, x: number, z: number): boolean {
  const col = Math.round((x - h.originX) / h.step); const row = Math.round((z - h.originZ) / h.step);
  if (col < 0 || row < 0 || col >= h.res || row >= h.res) return false;
  return h.walkable[row * h.res + col] === 1;
}

/** Terrain slope (rise per metre) at the nearest sample: central differences, 0 on the border. */
export function slopeAt(h: Pick<Heightfield, 'res' | 'originX' | 'originZ' | 'step' | 'heights'>, x: number, z: number): number {
  const col = Math.round((x - h.originX) / h.step); const row = Math.round((z - h.originZ) / h.step);
  if (col < 1 || row < 1 || col >= h.res - 1 || row >= h.res - 1) return 0;
  const i = row * h.res + col;
  const hx = (h.heights[i + 1]! - h.heights[i - 1]!) / (2 * h.step);
  const hz = (h.heights[i + h.res]! - h.heights[i - h.res]!) / (2 * h.step);
  return Math.sqrt(hx * hx + hz * hz);
}

/**
 * A water body the circle tests describe: a pond (small, about as wide as long). Rivers, lakes and seas are tested
 * against the water mask instead (`wetWithin`, `wetNear`): their area-equivalent circle would swallow the shore.
 * Render's `roundBody` is the same rule.
 */
export function roundBody(w: Pick<WaterBody, 'r' | 'x0' | 'x1' | 'z0' | 'z1'>): boolean {
  return w.r <= 18 && w.x1 - w.x0 < 2.6 * w.r && w.z1 - w.z0 < 2.6 * w.r;
}

/** 8 unit directions (cos, sin of k·45°). */
const DIR8: readonly (readonly [number, number])[] = [[1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]];

/** True when the water mask has a sample at (x, z) or on the rings of radius d and d / 2 round it (nearest samples). */
export function wetWithin(h: Pick<Heightfield, 'res' | 'originX' | 'originZ' | 'step' | 'water'>, x: number, z: number, d: number): boolean {
  const at = (px: number, pz: number): boolean => {
    const col = Math.round((px - h.originX) / h.step); const row = Math.round((pz - h.originZ) / h.step);
    return col >= 0 && row >= 0 && col < h.res && row < h.res && h.water[row * h.res + col] === 1;
  };
  if (at(x, z)) return true;
  for (const [cx, cz] of DIR8) if (at(x + cx * d, z + cz * d) || at(x + cx * d * 0.5, z + cz * d * 0.5)) return true;
  return false;
}

/** Scatter keeps off slopes steeper than this (cliff faces stay bare rock). */
export const SCATTER_MAX_SLOPE = 0.9;

/**
 * True when a water sample lies at (x, z) or `d` metres from it along ±x / ±z (nearest samples): the scatter's test
 * against rivers and lakes of any outline (render `wetNear`, the same five reads).
 */
export function wetNear(h: Pick<Heightfield, 'res' | 'originX' | 'originZ' | 'step' | 'water'>, x: number, z: number, d: number): boolean {
  for (const [ox, oz] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]] as const) {
    const col = Math.round((x + ox - h.originX) / h.step); const row = Math.round((z + oz - h.originZ) / h.step);
    if (col < 0 || row < 0 || col >= h.res || row >= h.res) continue;
    if (h.water[row * h.res + col] === 1) return true;
  }
  return false;
}

// ─── solids ──────────────────────────────────────────────────────────────────

/**
 * Every solid footprint, in the order render's zone builder registers its collider footprints: buildings,
 * set-piece core, hand-placed props, generated light posts, then the scatter's interior tree trunks, pond willows and
 * big rocks (render `buildScatter`: the same jittered grids, hashes and acceptance, playable interior only — the
 * 16 m margin forest is unwalkable anyway).
 */
function planSolids(zone: ZoneDef, L: LayoutCore, buildings: readonly PlanBuilding[], doorPaths: readonly PlanRoad[], lights: readonly PlanLight[], props: readonly PlanProp[], scatterSalt: number, h: Heightfield): PlanSolid[] {
  const R = MOVER_RADIUS;
  const out: PlanSolid[] = [];
  for (const b of buildings) out.push({ source: 'building', ref: b.id, shape: { kind: 'rect', x: b.x, z: b.z, hw: b.w / 2 + 0.12 + R, hd: b.d / 2 + 0.12 + R, yaw: b.yaw } });
  const sp = L.setPiece;
  if (sp.id === 'grove_heart_tree') out.push({ source: 'setpiece', ref: sp.id, shape: { kind: 'circle', x: sp.x, z: sp.z, r: HEART_TREE_RADIUS + R } });
  else if (SOLID_SET_PIECES.has(sp.id)) out.push({ source: 'setpiece', ref: sp.id, shape: { kind: 'rect', x: sp.x, z: sp.z, hw: sp.hw * 0.6, hd: sp.hd * 0.6, yaw: sp.yaw } });
  props.forEach((pp, k) => {
    const ref = `${pp.kind}#${k}`;
    const r = PROP_SOLID_RADIUS[pp.kind] ?? 0;
    if (pp.kind === 'garden') out.push({ source: 'prop', ref, shape: { kind: 'rect', x: pp.x, z: pp.z, hw: 2.7 + R, hd: 1.8 + R, yaw: pp.yaw } });
    else if (pp.kind === 'bench') out.push({ source: 'prop', ref, shape: { kind: 'rect', x: pp.x, z: pp.z, hw: 1.0 + R, hd: 0.25 + R, yaw: pp.yaw } });
    else if (pp.kind === 'fence') out.push({ source: 'prop', ref, shape: { kind: 'rect', x: pp.x, z: pp.z, hw: FENCE_HALF.hw + R, hd: FENCE_HALF.hd + R, yaw: pp.yaw } });
    else if (r > 0) out.push({ source: 'prop', ref, shape: { kind: 'circle', x: pp.x, z: pp.z, r: r + R } });
  });
  for (const l of lights) {
    if (l.generator === null) continue;
    out.push({ source: 'housing', ref: l.id, shape: { kind: 'circle', x: l.x, z: l.z, r: (l.generator === 'beacon' ? 0.45 : 0.22) + R } });
  }

  // scatter (render buildScatter): the splat context's roads are the layout roads plus the door paths
  const roads = [...L.roads, ...doorPaths];
  const scatterClear = (x: number, z: number, r: number, allowPatches: boolean): boolean => {
    if (L.plaza && Math.hypot(x - L.plaza.x, z - L.plaza.z) < L.plaza.r + r + 0.8) return false;
    if (roadDistance(roads, x, z) < r + 0.4) return false;
    for (const b of buildings) if (footprintDistance(b, x, z) < r + 1.0) return false;
    for (const [px, pz] of L.points) if (Math.hypot(px - x, pz - z) < r + 1.5) return false;
    for (const w of L.water) if (roundBody(w) && Math.hypot(w.cx - x, w.cz - z) < w.r * 1.05 + r + 0.6) return false;
    if (inSetPiece(L.setPiece, x, z, r)) return false;
    if (!allowPatches) for (const e of L.grassPatches) if (inEllipse(e, x, z, r + 0.5)) return false;
    if (wetNear(h, x, z, r + 0.6)) return false;
    return true;
  };
  const dens = BIOME_SOLID_SCATTER[zone.biome] ?? BIOME_SOLID_SCATTER.grove;
  const half = L.half;
  const ih = half - ZONE_MARGIN;
  const reachTrees = 26;
  const salt = scatterSalt & 0x7fffffff;
  const inPlay = (x: number, z: number): boolean => Math.abs(x) < ih && Math.abs(z) < ih;
  const clumpy = (x: number, z: number, s: number): number => fbm2(x * 0.045, z * 0.045, 3, salt + s);
  const route = zone.kind === 'route';

  // trees: interior acceptance only (the margin forest and the skirt treeline carry no footprint)
  const interiorDensity = route ? dens.treeInterior : zone.kind === 'town' ? 0.009 : 0.012;
  const marginDensity = Math.max(dens.treeMargin, route ? dens.treeInterior : dens.treeMargin);
  const treeAccept = (x: number, z: number): number => {
    if (!scatterClear(x, z, 1.4, false)) return 0;
    if (roadDistance(roads, x, z) < 3.2) return 0;
    if (slopeAt(h, x, z) > SCATTER_MAX_SLOPE) return 0;
    for (const c of L.clearings) if (Math.hypot(c.x - x, c.z - z) < c.r) return 0;
    if (route) {
      if (routeCorridorDistance(L.main, L.roadMeander, x, z) < 9) return 0.08;
      const n = clumpy(x, z, 11);
      return n > 0.05 ? 1 : 0.18;
    }
    return 1;
  };
  for (const p of jitteredPoints(-half - reachTrees, half + reachTrees, -half - reachTrees, half + reachTrees, marginDensity, salt + 101, (x, z) => {
    if (!inPlay(x, z)) return 0;
    const a = treeAccept(x, z);
    if (a <= 0) return 0;
    return a * (interiorDensity / marginDensity);
  })) {
    const s = 0.85 + hash2(Math.round(p.x * 8), Math.round(p.z * 8), salt + 3) * 0.35;
    out.push({ source: 'tree', ref: `tree@${p.x.toFixed(2)},${p.z.toFixed(2)}`, shape: { kind: 'circle', x: p.x, z: p.z, r: 0.42 * s + R } });
  }
  // willows ring the ponds (biomes whose tree set has a waterside kind)
  if (dens.willows && L.water.length > 0) {
    for (const body of L.water) {
      const n = Math.max(2, Math.round(body.r * 0.6));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + hash2(k, body.id, salt + 41) * 0.8;
        if (body.boardwalk && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.6) continue;
        const rr = body.r * 1.25 + 2.2 + hash2(k, body.id, salt + 42) * 2.5;
        const x = body.cx + Math.cos(a) * rr; const z = body.cz + Math.sin(a) * rr;
        if (!scatterClear(x, z, 1.2, true) || roadDistance(roads, x, z) < 2.5) continue;
        if (slopeAt(h, x, z) > SCATTER_MAX_SLOPE) continue;
        if (inPlay(x, z)) out.push({ source: 'willow', ref: `willow@${body.id}.${k}`, shape: { kind: 'circle', x, z, r: 0.5 + R } });
      }
    }
  }
  // big rocks
  for (const p of jitteredPoints(-half - 20, half + 20, -half - 20, half + 20, dens.rock * 1.6, salt + 201, (x, z) => {
    if (!inPlay(x, z)) return 0;
    return scatterClear(x, z, 1.2, false) && roadDistance(roads, x, z) > 1.5 && slopeAt(h, x, z) <= SCATTER_MAX_SLOPE ? 0.6 : 0;
  })) {
    const big = p.h < 0.45;
    const s = big ? 0.7 + p.h * 1.5 : 0.6 + p.h * 0.8;
    if (big && s > 0.8) out.push({ source: 'rock', ref: `rock@${p.x.toFixed(2)},${p.z.toFixed(2)}`, shape: { kind: 'circle', x: p.x, z: p.z, r: 0.75 * s + R * 0.6 } });
  }
  return out;
}

// ─── the plan ────────────────────────────────────────────────────────────────

/**
 * The zone's plan from its `ZoneDef` and its base heightfield (terrain, water and slope only — the plan is what
 * `buildHeightfield` then stamps into `walkable`). Rng streams, as render and the adapter drew them: the layout from
 * `fork('layout')` of `createRng(layoutSeed)`, the scatter salt from `fork('scatter')` after it; buildings, lights and
 * props from three unlabelled `fork()`s of a second `createRng(layoutSeed)`, in that order.
 */
export function planZone(zone: ZoneDef, base: Heightfield, sculpted?: SculptResult): ZonePlan {
  const seed = zone.layoutSeed >>> 0;
  const setPieceId = SET_PIECE_BY_ZONE[zone.id];
  const water = waterBodies(base);
  const sculpt = SCULPTS[zone.id];
  const L = planLayout(zone, seed, setPieceId, water, sculpt, sculpted, base);
  const rng = createRng(zone.layoutSeed);
  const buildingRng = rng.fork();
  const lightRng = rng.fork();
  const propRng = rng.fork();
  const buildings = planBuildings(zone, L, buildingRng, base);
  const lights = planLights(zone, L, base, buildings, lightRng);
  const props = planProps(zone, L, buildings, lights, propRng, base, sculpt);
  const doorPaths = planDoorPaths(L, buildings);
  const scatter = createRng(seed);
  forkLabelled(scatter, 'layout');
  const scatterSalt = (forkLabelled(scatter, 'scatter').next() * 4294967296) >>> 0;
  const solids = planSolids(zone, L, buildings, doorPaths, lights, props, scatterSalt, base);
  return {
    zoneId: zone.id, layout: zone.kind, seed,
    half: L.half, interior: L.interior, plaza: L.plaza, roads: L.roads, roadMeander: L.roadMeander, grassPatches: L.grassPatches,
    clearings: L.clearings, setPiece: L.setPiece, water: L.water, points: L.points, warpPairs: L.warpPairs,
    buildings, doors: buildings.map(doorApproach), doorPaths, lights, props, solids, bridges: sculpted?.bridges ?? [], crags: sculpted?.crags ?? [], structures: sculpted?.structures ?? [],
  };
}

/** The building footprints alone (walls grown by the capsule radius), with each building's door approach. */
export function buildingFootprints(plan: ZonePlan): readonly { readonly building: PlanBuilding; readonly footprint: RectSolid; readonly door: DoorApproach }[] {
  return plan.buildings.map((b, i) => ({ building: b, footprint: plan.solids[i]!.shape as RectSolid, door: plan.doors[i]! }));
}

// ─── stamping into the heightfield ───────────────────────────────────────────

/** What stamping a plan's footprints did to a field. */
export interface FootprintStamp {
  /** walkable samples before stamping */
  readonly baseWalkable: number;
  /** samples the footprints turned unwalkable */
  readonly stamped: number;
  /** samples inside a footprint left as they were because they are water (open water or a boardwalk pier) */
  readonly waterSkipped: number;
  /** samples inside a footprint kept walkable because a door approach covers them */
  readonly approachKept: number;
}

function forEachSampleIn(h: Pick<Heightfield, 'res' | 'originX' | 'originZ' | 'step'>, s: Solid, fn: (i: number) => void): void {
  const reach = s.kind === 'circle' ? s.r : Math.hypot(s.hw, s.hd);
  const c0 = Math.max(0, Math.ceil((s.x - reach - h.originX) / h.step));
  const c1 = Math.min(h.res - 1, Math.floor((s.x + reach - h.originX) / h.step));
  const r0 = Math.max(0, Math.ceil((s.z - reach - h.originZ) / h.step));
  const r1 = Math.min(h.res - 1, Math.floor((s.z + reach - h.originZ) / h.step));
  for (let row = r0; row <= r1; row++) {
    const z = h.originZ + row * h.step;
    for (let col = c0; col <= c1; col++) {
      if (solidContains(s, h.originX + col * h.step, z)) fn(row * h.res + col);
    }
  }
}

/**
 * Marks every sample whose centre lies inside a solid `walkable = 0`, except water samples (the water mask, the
 * boardwalk piers and the water bodies derived from them stay exactly as the terrain made them) and samples inside a
 * door approach. Writes `walkable` in place.
 */
export function stampFootprints(h: Pick<Heightfield, 'res' | 'originX' | 'originZ' | 'step' | 'walkable' | 'water'>, plan: Pick<ZonePlan, 'solids' | 'doors'>): FootprintStamp {
  const n2 = h.res * h.res;
  const mask = new Uint8Array(n2);
  for (const s of plan.solids) forEachSampleIn(h, s.shape, (i) => { mask[i] = 1; });
  let approachKept = 0;
  for (const d of plan.doors) forEachSampleIn(h, d.approach, (i) => { if (mask[i] === 1) { mask[i] = 2; } });
  let baseWalkable = 0; let stamped = 0; let waterSkipped = 0;
  for (let i = 0; i < n2; i++) {
    if (h.walkable[i] === 1) baseWalkable++;
    const m = mask[i]!;
    if (m === 0) continue;
    if (h.water[i] === 1) { waterSkipped++; continue; }
    if (m === 2) { if (h.walkable[i] === 1) approachKept++; continue; }
    if (h.walkable[i] === 1) { h.walkable[i] = 0; stamped++; }
  }
  return { baseWalkable, stamped, waterSkipped, approachKept };
}
