/**
 * Phase A interiors — one POCKET per town building: a roofless walled hall standing in the zone's own outer band,
 * reached only through door warps (content `interiors.ts`). The heightfield already carries the pocket (flat floor at
 * `floorY`, walls + a 2 m screen band unwalkable); this module draws it.
 *
 * Per pocket a `Group` `ewa:interior:<id>` at the local origin (floor centre, door in the middle of the local +z wall;
 * `rotation.y = yaw` reproduces content's `toWorld`) holding:
 *
 * - `:hall` (shown only while the local player is inside — `InteriorsHandle.setActive`): the themed floor slab, four
 *   separate outer wall meshes (`:wall:back|front|left|right`, 2.4 m, 0.4 m thick, a door opening in the +z wall —
 *   `setView` drops the ones facing the camera to a 0.5 m kerb by `scale.y`), the internal solids by style, the
 *   per-player gates (`:gate:<id>`, opened by a transform: down into the floor or aside), the switches
 *   (`:switch:<id>`, a moving part by transform and an emissive part shown when on) and the props by kind, merged
 *   per pocket per material (one `Parts` → one geometry with a group per surface).
 * - `:canopy` (hidden while active): a wooded knoll over the floor + walls (a mound blending into the terrain at the
 *   footprint edge, crowned with the zone's trees, or rocks in barren biomes), a `THREE.LOD` of three tiers.
 * - `:rim` (always shown): bushes / stones along the screen band, so the hall reads as a clearing in a thicket.
 *
 * Only library materials are bound (no per-pocket material): switch glows and lava are library emissive surfaces
 * toggled by visibility. Unknown prop / wall / gate / switch kinds draw nothing (walls and gates fall back to a plain
 * block so the solid stays visible).
 */
import { BufferAttribute, BufferGeometry, Group, LOD, Matrix4, Mesh, Vector3 } from 'three/webgpu';
import type { Material, Object3D } from 'three/webgpu';
import type { HeightfieldData, InteriorLocalRect, InteriorSpec, InteriorThemeId } from '../../contracts.js';
import { WATER_DEPTH_ATTRIBUTE, linearRgb } from '../../materials/graph.js';
import { SURFACES, surfaceDef, type SurfaceId } from '../../materials/surfaces.js';
import { heightClamped } from '../../terrain/field.js';
import type { RectBlocker } from '../../terrain/collider.js';
import { Parts, beam, box, card, lathe, trs } from '../geo.js';
import { BUILDING_LOD_LEVELS } from '../lod.js';
import { createPrng, hash2, valueNoise } from '../prng.js';
import { CARD_RENDER_ORDER, splitByClass } from '../split.js';
import type { Palette, PropGeo } from '../types.js';
import { addPropTier, disposeProp } from './common.js';
import { BIOME_GENERATORS } from './index.js';
import { buildBush, buildFlowers, buildRock, buildTree } from './nature.js';
import { buildBarrel, buildBench, buildBrazier, buildCandle, buildCrate, buildCrystal, buildPlanter, type PropStyle } from './props.js';
import type { BiomeSet } from './set.js';

const TAU = Math.PI * 2;

/** Pocket numbers (content `INTERIOR_WALL_T`, `INTERIOR_WALL_H`, `INTERIOR_SCREEN_M`) and the drawing choices. */
export const INTERIOR = Object.freeze({
  wallT: 0.4, wallH: 2.4, screenM: 2,
  /** A camera-facing outer wall drops to this height (`setView`). */
  kerbH: 0.5,
  /** Top of the themed floor slab above `floorY` (the arena ring and actors stand on `floorY`; 3 cm is invisible). */
  floorTop: 0.03,
  innerWallH: 2.0, hedgeH: 1.9, boulderH: 1.5, counterH: 1.0, railH: 1.0, gateH: 2.1,
  doorW: { hall: 2.6, room: 1.5 },
  /** Ease of a wall drop / raise (ms), a gate opening (ms), a switch throw (ms). */
  wallMs: 220, gateMs: 900, switchMs: 320,
  /** A wall drops when its outward normal · the camera's horizontal direction exceeds this. */
  facingDot: 0.2,
  /** Knoll height over the floor, tree spacing on it, rim spacing in the screen band (m). */
  canopyTop: 2.7, canopyTreeSpacing: 3.6, rimSpacing: 1.9,
});

/**
 * Prop kinds tall enough to cast a shadow worth its draws (every casting surface group costs one draw per shadow
 * cascade); the rest of the dressing is merged into a non-casting mesh.
 */
const CASTING_PROPS: ReadonlySet<string> = new Set(['pillar', 'statue', 'banner', 'coil', 'forge', 'throne', 'shelf', 'bookshelf', 'weapon_rack', 'mirror', 'spectators', 'anchor']);

// ---- themes ----------------------------------------------------------------------------------------------------

/** The surfaces a hall is dressed with. Every id comes from the theme's biome row or the shared row (or the zone set). */
export interface ThemeKit {
  readonly theme: InteriorThemeId;
  readonly floor: SurfaceId; readonly border: SurfaceId; readonly runner: SurfaceId;
  readonly wall: SurfaceId; readonly trim: SurfaceId; readonly cloth: SurfaceId;
  readonly wood: SurfaceId; readonly metal: SurfaceId; readonly stone: SurfaceId;
  readonly glow: SurfaceId; readonly accent: SurfaceId; readonly crystal: SurfaceId; readonly candle: SurfaceId;
  readonly glass: SurfaceId; readonly rock: SurfaceId; readonly soil: SurfaceId;
  /** Alpha-card foliage (hedges, plants); null in barren themes. */
  readonly leaf: SurfaceId | null;
  readonly hedgeCore: SurfaceId; readonly dark: SurfaceId; readonly cloud: SurfaceId; readonly water: SurfaceId;
  readonly flower: SurfaceId | null;
  /**
   * The rug's field (2026-10-06, live report: the league foyer's `sun_marble` runner rug read as a flat white slab at
   * dusk): a muted surface the theme already binds, never an alpha card (the cloth surfaces are banner / sail / flag
   * cards) — the row's `rug`, else the row's runner; the zone-set themes (shop / healer / house) take the zone's cloth,
   * else its wood.
   */
  readonly rug: SurfaceId;
  readonly style: PropStyle;
}

interface ThemeRow {
  readonly set: keyof typeof BIOME_GENERATORS;
  readonly floor: SurfaceId; readonly border: SurfaceId; readonly runner: SurfaceId; readonly wall: SurfaceId; readonly trim: SurfaceId;
  readonly cloth: SurfaceId; readonly hedgeCore: SurfaceId; readonly cloud: SurfaceId;
  /** rug field when the runner is too pale / not a textile (default: the runner) */
  readonly rug?: SurfaceId;
}

/** The 8 gym dressings + the league hall (fixed sets); shop / healer / house dress in the zone's own set. */
const THEME_ROWS: Readonly<Partial<Record<InteriorThemeId, ThemeRow>>> = {
  grove: { set: 'grove', floor: 'path_gravel', border: 'stone_wall', runner: 'grove_moss', wall: 'stone_wall', trim: 'timber', cloth: 'plaster', hedgeCore: 'grove_moss', cloud: 'plaster', rug: 'thatch' },
  cinder: { set: 'cinder', floor: 'cinder_basalt', border: 'obsidian', runner: 'cinder_scoria', wall: 'forge_brick', trim: 'cinder_basalt', cloth: 'obsidian', hedgeCore: 'cinder_ash_soil', cloud: 'cinder_ash_soil' },
  salt: { set: 'salt', floor: 'harbour_plank', border: 'barnacle_stone', runner: 'driftwood', wall: 'barnacle_stone', trim: 'driftwood', cloth: 'sailcloth', hedgeCore: 'salt_sand', cloud: 'salt_sand' },
  storm: { set: 'storm', floor: 'wet_flagstone', border: 'storm_slate', runner: 'copper_oxide', wall: 'tower_stone', trim: 'copper_oxide', cloth: 'storm_slate', hedgeCore: 'storm_slate', cloud: 'tower_stone' },
  marrow: { set: 'marrow', floor: 'marrow_sandstone', border: 'bone_chalk', runner: 'mine_timber', wall: 'marrow_sandstone', trim: 'mine_timber', cloth: 'bone_chalk', hedgeCore: 'canyon_dust', cloud: 'bone_chalk' },
  vesper: { set: 'vesper', floor: 'lichen_stone', border: 'wrought_iron', runner: 'grave_moss', wall: 'lichen_stone', trim: 'wrought_iron', cloth: 'vesper_bark_black', hedgeCore: 'grave_moss', cloud: 'mist_glass' },
  forge: { set: 'forge', floor: 'castle_granite', border: 'rivet_iron', runner: 'forge_steel_plate', wall: 'castle_granite', trim: 'forge_steel_plate', cloth: 'banner_cloth', hedgeCore: 'castle_granite', cloud: 'castle_granite', rug: 'charred_timber' },
  sky: { set: 'sky', floor: 'sky_marble', border: 'gold_leaf', runner: 'cloud_stone', wall: 'cloud_stone', trim: 'gold_leaf', cloth: 'prayer_silk', hedgeCore: 'snow', cloud: 'snow', rug: 'dragon_scale_tile' },
  league: { set: 'capital', floor: 'plaza_pale_stone', border: 'gilt_bronze', runner: 'sun_marble', wall: 'sun_marble', trim: 'gilt_bronze', cloth: 'banner_cloth', hedgeCore: 'laurel_leaf', cloud: 'sun_marble', rug: 'grove_moss' },
};

function isCard(s: SurfaceId): boolean { return SURFACES[s].cls === 'card'; }

/** A set's card foliage (its bushes, else its first tree with card leaves other than dry grass), or null. */
export function foliageOf(set: BiomeSet): SurfaceId | null {
  if (set.bushLeaf && isCard(set.bushLeaf)) return set.bushLeaf;
  const t = set.trees.find((x) => isCard(x.leaf) && x.leaf !== 'tall_grass' && x.kind !== 'tree_dead');
  return t ? t.leaf : null;
}

export function themeKit(theme: InteriorThemeId, zoneSet: BiomeSet): ThemeKit {
  const row = THEME_ROWS[theme];
  const set = row ? (BIOME_GENERATORS[row.set] ?? zoneSet) : zoneSet;
  const b = set.building; const p = set.props;
  const zb = zoneSet.building; const zp = zoneSet.props;
  const base = row ?? (theme === 'shop'
    ? { floor: zp.wood, border: zb.trim, runner: 'cobble' as SurfaceId, wall: zb.wall, trim: zb.trim, cloth: zp.cloth, hedgeCore: zp.soil, cloud: 'plaster' as SurfaceId }
    : theme === 'healer'
      ? { floor: 'plaster' as SurfaceId, border: zb.trim, runner: 'cobble' as SurfaceId, wall: zb.wall, trim: 'stone_wall' as SurfaceId, cloth: 'plaster' as SurfaceId, hedgeCore: zp.soil, cloud: 'plaster' as SurfaceId }
      : { floor: zp.wood, border: zb.trim, runner: zp.cloth, wall: zb.wall, trim: zb.trim, cloth: zp.cloth, hedgeCore: zp.soil, cloud: 'plaster' as SurfaceId });
  const leaf = foliageOf(set) ?? (row ? null : foliageOf(zoneSet));
  const kit = {
    theme,
    floor: base.floor, border: base.border, runner: base.runner, wall: base.wall, trim: base.trim, cloth: base.cloth,
    wood: p.wood, metal: p.metal, stone: p.stone, glow: p.glow, accent: set.accent ?? p.glow, crystal: p.crystal, candle: p.candle,
    glass: b.glass, rock: set.rock, soil: p.soil, leaf, hedgeCore: base.hedgeCore, dark: 'lantern_metal' as SurfaceId, cloud: base.cloud,
    water: zp.water ?? 'water_pond', flower: set.flower,
    // never an alpha-card cloth (banner / sail / flag shapes would tile as cut-outs): the first non-card candidate
    rug: [...(row ? [row.rug, row.runner] : [zp.cloth, zp.wood]), base.floor].find((x): x is SurfaceId => x !== undefined && !isCard(x))!,
  };
  const style: PropStyle = {
    wood: kit.wood, metal: kit.metal, stone: kit.stone, housingGlass: 'glass_warm', glow: kit.glow, crystal: kit.crystal, candle: kit.candle,
    cloth: kit.cloth, soil: kit.soil, leaf: kit.leaf ?? p.leaf, rock: kit.rock, water: kit.water,
  };
  return { ...kit, style };
}

/** Every surface the pockets of a zone may bind (added to the zone's preload set). */
export function interiorSurfaces(specs: readonly InteriorSpec[], zoneSet: BiomeSet, palette: Palette): SurfaceId[] {
  const out = new Set<SurfaceId>();
  if (specs.length === 0) return [];
  for (const sp of specs) {
    const k = themeKit(sp.theme, zoneSet);
    for (const s of [k.floor, k.border, k.runner, k.wall, k.trim, k.cloth, k.wood, k.metal, k.stone, k.glow, k.accent, k.crystal, k.candle, k.glass, k.rock, k.soil, k.hedgeCore, k.dark, k.cloud, k.water, k.rug, 'glass_warm' as SurfaceId]) out.add(s);
    if (k.leaf) out.add(k.leaf);
    if (k.flower) out.add(k.flower);
    if (k.style.leaf) out.add(k.style.leaf);
  }
  // canopy: the zone's ground layer, its trees (or rock) and its foliage
  out.add(palette.terrainLayers[0]);
  out.add(zoneSet.rock);
  const tree = canopyTree(zoneSet);
  if (tree) { out.add(tree.bark); out.add(tree.leaf); }
  const leaf = foliageOf(zoneSet);
  if (leaf) out.add(leaf);
  return [...out].sort();
}

function canopyTree(set: BiomeSet): BiomeSet['trees'][number] | null {
  return set.trees.find((t) => isCard(t.leaf) && t.leaf !== 'tall_grass' && t.kind !== 'tree_dead') ?? null;
}

// ---- build output ----------------------------------------------------------------------------------------------

export type WallSide = 'back' | 'front' | 'left' | 'right';
export interface WallRec { readonly side: WallSide; readonly object: Object3D; /** world outward normal (x, z) */ readonly nx: number; readonly nz: number }
export interface GateRec {
  readonly id: string; readonly style: string; readonly object: Object3D;
  readonly mode: 'down' | 'aside';
  /** hall-local rest position and the open displacement (hall-local, metres) */
  readonly rest: readonly [number, number, number]; readonly delta: readonly [number, number, number];
  /** roll (rad) about the gate's own z at full open (boulders) */
  readonly roll: number;
}
export interface SwitchRec {
  readonly id: string; readonly kind: string; readonly holder: Object3D;
  readonly moving: Object3D | null; readonly glow: Object3D | null;
  /** the moving part's off / on transforms: rotation about x (rad) and y offset (m) */
  readonly off: readonly [number, number]; readonly on: readonly [number, number];
}
export interface BuiltInterior {
  readonly id: string;
  readonly root: Group;
  readonly hall: Group;
  readonly canopy: Group;
  readonly canopyLod: LOD | null;
  readonly rim: Object3D | null;
  readonly walls: readonly WallRec[];
  readonly gates: readonly GateRec[];
  readonly switches: readonly SwitchRec[];
  /** Internal solids drawn (furniture rects covered by their prop count once). */
  readonly innerWalls: number;
  readonly props: number;
  /** World footprints of the outer walls and the internal solids (collider shape queries). */
  readonly footprints: readonly RectBlocker[];
}

export interface InteriorBuildDeps {
  readonly zoneSet: BiomeSet;
  readonly palette: Palette;
  readonly heightfield: HeightfieldData;
  readonly material: (id: SurfaceId) => Material;
  /** Every geometry created (the zone records them in build order and disposes them). */
  readonly geometries: BufferGeometry[];
  /** Class-split views (disposed with the zone). */
  readonly views: BufferGeometry[];
}

// ---- mesh helpers --------------------------------------------------------------------------------------------

/** One Parts → one geometry (a group per surface) → a Mesh, or a Group of meshes split by alpha / shadow class. */
function meshOf(parts: Parts, name: string, cast: boolean, d: InteriorBuildDeps): Object3D | null {
  if (parts.isEmpty()) return null;
  const b = parts.build();
  d.geometries.push(b.geometry);
  const mats = b.surfaces.map((s) => d.material(s));
  const split = splitByClass(b.geometry, mats);
  for (const v of split.views) d.views.push(v);
  const make = (g: BufferGeometry, cls: 0 | 1, casts: boolean, k: number): Mesh => {
    const m = new Mesh(g, mats.length === 1 ? mats[0]! : mats);
    m.name = `${name}${split.parts.length > 1 ? `:c${k}` : ''}`;
    m.renderOrder = cls === 1 ? CARD_RENDER_ORDER : 0;
    m.castShadow = cast && casts; m.receiveShadow = true;
    return m;
  };
  if (split.parts.length === 1) { const p = split.parts[0]!; return make(p.geometry, p.cls, p.casts, 0); }
  const g = new Group();
  g.name = name;
  split.parts.forEach((p, k) => g.add(make(p.geometry, p.cls, p.casts, k)));
  return g;
}

/** Adds a PropGeo's lod0 into `parts` under `m` and disposes it. */
function addGeo(parts: Parts, geo: PropGeo, m?: Matrix4, tier: 0 | 1 | 2 = 0): void {
  addPropTier(parts, geo, tier, m);
  disposeProp(geo);
}

function seedOf(s: string): number {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < s.length; i++) { h = (h ^ s.charCodeAt(i)) | 0; h = Math.imul(h, 0x01000193) | 0; }
  return h >>> 0;
}



// ---- the hall ---------------------------------------------------------------------------------------------------

/** Wall styles drawn as a full-height partition (others have their own drawing). */
type Kit = ThemeKit;

function floorAndBorder(F: Parts, spec: InteriorSpec, kit: Kit): void {
  const top = INTERIOR.floorTop;
  const hw = spec.w / 2; const hd = spec.d / 2;
  box(F, kit.floor, 0, top - 0.12, 0, spec.w + 0.1, 0.12, spec.d + 0.1, 0, 0.015);
  const bw = 0.42;
  for (const [x, z, w, d] of [[0, -hd + bw / 2, spec.w, bw], [0, hd - bw / 2, spec.w, bw], [-hw + bw / 2, 0, bw, spec.d - 2 * bw], [hw - bw / 2, 0, bw, spec.d - 2 * bw]] as const) {
    box(F, kit.border, x, top - 0.1, z, w, 0.112, d, 0, 0.012);
  }
  // runner from the door into the hall (gyms and the league hall: to the arena), a mat inside small rooms
  const big = spec.template === 'gym_hall' || spec.template === 'league_hall';
  const runnerEnd = big ? (spec.rooms[0]?.arena.lz ?? 0) + 4 : hd - 2.2;
  const len = hd - 0.42 - runnerEnd;
  if (len > 0.5) box(F, kit.runner, 0, top - 0.1, hd - 0.42 - len / 2, big ? 2.2 : 1.3, 0.115, len, 0, 0.012);
  // arena inlay rings: where the battle ring forms (hidden under its curb when dressed)
  for (const r of spec.rooms) {
    lathe(F, kit.border, [[3.62, top - 0.05], [3.62, top + 0.008], [3.36, top + 0.008], [3.36, top - 0.05]], { segments: 48, smooth: false }, trs(r.arena.lx, 0, r.arena.lz));
    lathe(F, kit.runner, [[0.001, top + 0.006], [1.1, top + 0.006], [1.1, top - 0.05], [0.001, top - 0.05]], { segments: 24, smooth: false }, trs(r.arena.lx, 0, r.arena.lz));
  }
}

/** The four outer walls, each its own Parts (so each can drop to a kerb); the +z wall has the door opening. */
function outerWalls(spec: InteriorSpec, kit: Kit): Record<WallSide, Parts> {
  const T = INTERIOR.wallT; const H = INTERIOR.wallH;
  const hw = spec.w / 2; const hd = spec.d / 2;
  const big = spec.template === 'gym_hall' || spec.template === 'league_hall';
  const door = big ? INTERIOR.doorW.hall : INTERIOR.doorW.room;
  const out: Record<WallSide, Parts> = { back: new Parts(), front: new Parts(), left: new Parts(), right: new Parts() };
  const run = (p: Parts, x: number, z: number, len: number, yaw: number, inX: number, inZ: number): void => {
    box(p, kit.wall, x, -0.25, z, len, H + 0.25, T, yaw, 0.04);
    box(p, kit.wall, x, -0.05, z, len + 0.02, 0.32, T + 0.08, yaw, 0.03);                // plinth band
    box(p, kit.wall, x, H - 0.02, z, len + 0.06, 0.14, T + 0.12, yaw, 0.03);             // coping
    // pilasters on the inner face every ~4.5 m (halls only)
    if (big && len > 6) {
      const n = Math.max(1, Math.round(len / 4.5));
      for (let k = 1; k < n; k++) {
        const t = -len / 2 + (k * len) / n;
        const ax = Math.cos(yaw); const az = -Math.sin(yaw);
        box(p, kit.wall, x + ax * t + inX * (T / 2 + 0.06), -0.05, z + az * t + inZ * (T / 2 + 0.06), 0.42, H + 0.05, 0.14, yaw, 0.03);
      }
    }
  };
  run(out.back, 0, -hd - T / 2, spec.w + 2 * T, 0, 0, 1);
  run(out.left, -hw - T / 2, 0, spec.d, Math.PI / 2, 1, 0);
  run(out.right, hw + T / 2, 0, spec.d, Math.PI / 2, -1, 0);
  // front: two runs either side of the door, door posts, a lintel and a dark doorway (the way back out)
  const seg = (spec.w + 2 * T - door) / 2;
  const zf = hd + T / 2;
  run(out.front, -(door / 2 + seg / 2), zf, seg, 0, 0, -1);
  run(out.front, door / 2 + seg / 2, zf, seg, 0, 0, -1);
  for (const s of [-1, 1]) box(out.front, kit.wall, s * (door / 2 + 0.16), -0.05, zf, 0.34, H + 0.32, T + 0.2, 0, 0.04);
  box(out.front, kit.wall, 0, H + 0.02, zf, door + 0.7, 0.3, T + 0.2, 0, 0.04);
  box(out.front, kit.dark, 0, -0.02, zf + 0.12, door + 0.02, H, 0.06, 0, 0.01);
  return out;
}

/** True when a furniture prop stands inside rect `w` (its own prop draws it). */
function propsIn(spec: InteriorSpec, w: InteriorLocalRect): InteriorSpec['props'][number][] {
  return spec.props.filter((p) => Math.abs(p.lx - w.lx) <= w.hw + 0.05 && Math.abs(p.lz - w.lz) <= w.hd + 0.05);
}

/** An internal solid by style into the static parts (S casts, F flat). Returns false when nothing was drawn. */
function innerWall(S: Parts, F: Parts, W: WaterAcc, spec: InteriorSpec, w: InteriorSpec['walls'][number], kit: Kit, seed: number): boolean {
  const top = INTERIOR.floorTop;
  const along = w.hw >= w.hd;
  const L = 2 * Math.max(w.hw, w.hd); const Tk = 2 * Math.min(w.hw, w.hd);
  const yaw = along ? 0 : Math.PI / 2;
  const m = trs(w.lx, top, w.lz, yaw);
  const p = createPrng(seed);
  switch (w.style) {
    case 'wall': case 'counter': {
      const inside = propsIn(spec, w);
      if (inside.length > 0) {
        // furniture: its prop draws it; a run of several props (shelves) gets a low back counter
        const single = inside.length === 1 && Math.abs(inside[0]!.lx - w.lx) < 0.3 && Math.abs(inside[0]!.lz - w.lz) < 0.3;
        if (single) return true;
        box(S, kit.wood, 0, 0, 0, L - 0.04, 0.9, Tk - 0.04, 0, 0.03, m);
        box(S, kit.trim, 0, 0.9, 0, L, 0.06, Tk + 0.04, 0, 0.015, m);
        return true;
      }
      if (w.style === 'counter') {
        box(S, kit.wood, 0, 0, 0, L - 0.04, INTERIOR.counterH - 0.06, Tk - 0.04, 0, 0.03, m);
        box(S, kit.trim, 0, INTERIOR.counterH - 0.06, 0, L + 0.06, 0.06, Tk + 0.06, 0, 0.015, m);
        return true;
      }
      const H = INTERIOR.innerWallH;
      box(S, kit.wall, 0, -0.05, 0, L, H + 0.05, Tk, 0, 0.04, m);
      box(S, kit.wall, 0, H - 0.02, 0, L + 0.06, 0.12, Tk + 0.1, 0, 0.03, m);
      box(S, kit.wall, 0, -0.03, 0, L + 0.03, 0.22, Tk + 0.06, 0, 0.02, m);
      return true;
    }
    case 'hedge': {
      hedgeBlock(S, kit, L, Tk, INTERIOR.hedgeH, m, seed);
      return true;
    }
    case 'grate': case 'iron': {
      const H = w.style === 'iron' ? INTERIOR.innerWallH : INTERIOR.innerWallH - 0.2;
      if (Tk > 0.9 && L < 2 * Tk) {
        // a pier (coil plinth / column block)
        box(S, kit.metal, 0, -0.05, 0, L, 0.5, Tk, 0, 0.04, m);
        box(S, kit.trim, 0, 0.45, 0, L - 0.2, 0.12, Tk - 0.2, 0, 0.03, m);
        return true;
      }
      box(S, kit.trim, 0, -0.05, 0, L, 0.28, Tk, 0, 0.03, m);
      const n = Math.max(2, Math.round(L / 0.24));
      for (let k = 0; k <= n; k++) {
        const x = -L / 2 + 0.06 + (k * (L - 0.12)) / n;
        const t = new Matrix4().copy(m);
        beam(S, kit.metal, [x, 0.2, 0], [x, H, 0], 0.055, 0.055, 0.01, undefined, t);
      }
      for (const y of [0.9, H - 0.12]) box(S, kit.metal, 0, y, 0, L, 0.1, 0.12, 0, 0.015, m);
      if (w.style === 'iron') for (let x = -L / 2 + 0.1; x <= L / 2; x += Math.max(1.2, L / Math.max(1, Math.round(L / 2.4)))) box(S, kit.trim, x, -0.05, 0, 0.18, H + 0.15, 0.18, 0, 0.03, m);
      return true;
    }
    case 'boulder': {
      const n = Math.max(1, Math.round(L / 1.6));
      for (let k = 0; k < n; k++) {
        const x = -L / 2 + (k + 0.5) * (L / n);
        const size = Math.min(Tk * 0.9 + 0.35, L / n * 0.7) * (0.85 + p.next() * 0.3);
        const geo = buildRock(kit.rock, seed + k * 31, { size, squash: 0.9, elongate: 1.2, cuts: [3, 5] });
        addGeo(S, geo, m.clone().multiply(trs(x, -0.1, (p.next() - 0.5) * 0.2, p.next() * TAU, 1)));
      }
      return true;
    }
    case 'channel': {
      // coping along both long edges; the water plane is its own mesh (W)
      for (const s of [-1, 1]) box(F, kit.border, 0, -0.04, s * (Tk / 2 - 0.09), L, 0.17, 0.2, 0, 0.02, m);
      for (const s of [-1, 1]) box(F, kit.border, s * (L / 2 - 0.09), -0.04, 0, 0.2, 0.17, Tk, 0, 0.02, m);
      waterQuad(W, L - 0.36, Tk - 0.36, m, top + 0.02);
      return true;
    }
    case 'chasm': {
      // a dark void with a stone lip and cloud wisps drifting in it
      box(F, kit.dark, 0, -0.02, 0, L - 0.1, 0.07, Tk - 0.1, 0, 0.01, m);
      const rim = (x: number, z: number, ww: number, dd: number): void => box(F, kit.trim, x, -0.03, z, ww, 0.12, dd, 0, 0.02, m);
      rim(0, -Tk / 2, L, 0.22); rim(0, Tk / 2, L, 0.22); rim(-L / 2, 0, 0.22, Tk); rim(L / 2, 0, 0.22, Tk);
      const n = Math.max(3, Math.round((L * Tk) / 6));
      for (let k = 0; k < n; k++) {
        const x = (p.next() - 0.5) * (L - 1.2); const z = (p.next() - 0.5) * (Tk - 1.2);
        puff(S, kit.cloud, m.clone().multiply(trs(x, -0.25 + p.next() * 0.2, z, p.next() * TAU, 0.6 + p.next() * 0.6)), seed + k);
      }
      return true;
    }
    case 'rail': {
      box(S, kit.trim, 0, INTERIOR.railH - 0.08, 0, L, 0.08, 0.12, 0, 0.015, m);
      for (let x = -L / 2 + 0.05; x <= L / 2; x += Math.max(0.8, L / Math.max(1, Math.round(L / 1.2)))) box(S, kit.metal, x, -0.05, 0, 0.08, INTERIOR.railH, 0.08, 0, 0.012, m);
      return true;
    }
    default: {
      box(S, kit.wall, 0, -0.05, 0, L, INTERIOR.innerWallH, Tk, 0, 0.04, m);
      return true;
    }
  }
}

function hedgeBlock(P: Parts, kit: Kit, L: number, Tk: number, H: number, m: Matrix4, seed: number): void {
  box(P, kit.hedgeCore, 0, -0.05, 0, L - 0.08, H - 0.15, Math.max(0.3, Tk - 0.12), 0, 0.08, m);
  if (!kit.leaf) return;
  const p = createPrng(seed);
  const t = new Parts();
  const n = Math.max(3, Math.round(L / 0.55));
  for (let k = 0; k < n; k++) {
    const x = -L / 2 + (k + 0.5) * (L / n);
    for (const s of [-1, 1]) {
      card(t, kit.leaf, x + (p.next() - 0.5) * 0.2, 0.15 + p.next() * 0.3, s * (Tk / 2 - 0.02), 0.9, H - 0.25, s > 0 ? 0 : Math.PI, -0.08, [x, H * 0.5, 0], 0.6, [0, 0, 1, 1], false);
    }
    card(t, kit.leaf, x, H - 0.35, (p.next() - 0.5) * 0.15, 0.85, 0.6, p.next() * TAU, -1.2, [x, H * 0.3, 0], 0.6, [0, 0, 1, 1], true);
  }
  P.addParts(t, m);
}

/** A cloud wisp: a few flattened lathed puffs. */
function puff(P: Parts, surface: SurfaceId, m: Matrix4, seed: number): void {
  const p = createPrng(seed);
  for (let k = 0; k < 3; k++) {
    const r = 0.35 + p.next() * 0.3;
    const prof: [number, number][] = [];
    for (let j = 0; j <= 5; j++) { const a = -Math.PI / 2 + (j / 5) * Math.PI; prof.push([Math.max(0.001, Math.cos(a) * r), Math.sin(a) * r * 0.55]); }
    lathe(P, surface, prof, { segments: 8, smooth: true }, m.clone().multiply(trs((k - 1) * r * 1.1, 0.2 + p.next() * 0.1, (p.next() - 0.5) * 0.3)));
  }
}

/** Flat water rectangles of a hall (one mesh per pocket, the library water graph's `depthBelow` attribute). */
interface WaterAcc { readonly pos: number[]; readonly dep: number[] }

function waterQuad(W: WaterAcc, L: number, Tk: number, m: Matrix4, y: number): void {
  const c = [[-L / 2, -Tk / 2], [L / 2, -Tk / 2], [L / 2, Tk / 2], [-L / 2, Tk / 2]].map(([x, z]) => new Vector3(x!, 0, z!).applyMatrix4(m));
  for (const [a, b, cc] of [[0, 2, 1], [0, 3, 2]] as const) for (const k of [a, b, cc]) { W.pos.push(c[k]!.x, y, c[k]!.z); W.dep.push(0.6); }
}

function waterMesh(W: WaterAcc, surface: SurfaceId, name: string, d: InteriorBuildDeps): Mesh | null {
  if (W.pos.length === 0) return null;
  const n = W.pos.length / 3;
  const geo = new BufferGeometry();
  const col = new Float32Array(n * 3); const nrm = new Float32Array(n * 3); const uv = new Float32Array(n * 2);
  const c = new Vector3();
  linearRgb(surfaceDef(surface).albedo, c);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.x; col[i * 3 + 1] = c.y; col[i * 3 + 2] = c.z;
    nrm[i * 3 + 1] = 1;
    uv[i * 2] = W.pos[i * 3]!; uv[i * 2 + 1] = W.pos[i * 3 + 2]!;
  }
  geo.setAttribute('position', new BufferAttribute(new Float32Array(W.pos), 3));
  geo.setAttribute('normal', new BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setAttribute(WATER_DEPTH_ATTRIBUTE, new BufferAttribute(new Float32Array(W.dep), 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  d.geometries.push(geo);
  const mesh = new Mesh(geo, d.material(surface));
  mesh.name = name;
  mesh.castShadow = false; mesh.receiveShadow = true;
  return mesh;
}

// ---- props ---------------------------------------------------------------------------------------------------------

/**
 * One prop by kind into `t` in its own frame (y = 0 on the floor slab, +z its front). `size` is the half extents of
 * the solid rect the prop stands on (bed, table, counter …) in the prop's frame, null = the kind's default size.
 * Returns false for an unknown kind (nothing drawn).
 */
function propInto(t: Parts, kind: string, kit: Kit, size: readonly [number, number] | null, seed: number): boolean {
  const p = createPrng(seed);
  const st = kit.style;
  const W = (dflt: number): number => size ? size[0] * 2 : dflt;
  const D = (dflt: number): number => size ? size[1] * 2 : dflt;
  switch (kind) {
    case 'counter': {
      const w = W(5.2); const d = D(0.9);
      box(t, kit.wood, 0, 0, 0, w - 0.06, 0.94, d - 0.06, 0, 0.03);
      box(t, kit.trim, 0, 0.94, 0, w + 0.08, 0.07, d + 0.1, 0, 0.015);
      for (let x = -w / 2 + 0.6; x < w / 2 - 0.3; x += 1.2) box(t, kit.trim, x, 0.08, d / 2 - 0.01, 0.9, 0.7, 0.04, 0, 0.01);
      box(t, kit.glow, w / 2 - 0.6, 0.98, 0, 0.36, 0.22, 0.28, 0.2, 0.02);       // the till's lit display
      return true;
    }
    case 'shelf': case 'bookshelf': {
      const shelf = kind === 'shelf';
      const w = shelf ? 2.7 : W(2.4); const d = shelf ? 0.6 : 0.42; const h = shelf ? 1.9 : 2.0;
      box(t, kit.wood, -w / 2 + 0.04, 0, 0, 0.08, h, d, 0, 0.015); box(t, kit.wood, w / 2 - 0.04, 0, 0, 0.08, h, d, 0, 0.015);
      box(t, kit.wood, 0, 0, -d / 2 + 0.02, w, h, 0.04, 0, 0.01);
      const rows = shelf ? 4 : 5;
      const fill = [kit.cloth, kit.trim, kit.stone, kit.glass, kit.wood];
      for (let r = 0; r < rows; r++) {
        const y = 0.06 + (r * (h - 0.1)) / rows;
        box(t, kit.wood, 0, y, 0, w - 0.1, 0.05, d - 0.04, 0, 0.01);
        for (let x = -w / 2 + 0.2; x < w / 2 - 0.2;) {
          const bw = shelf ? 0.22 + p.next() * 0.2 : 0.05 + p.next() * 0.05;
          const bh = shelf ? 0.18 + p.next() * 0.16 : 0.24 + p.next() * 0.1;
          const s = fill[Math.floor(p.next() * fill.length)]!;
          if (p.next() < 0.88) box(t, s, x + bw / 2, y + 0.05, 0.02, bw, bh, d * 0.7, 0, 0.01);
          x += bw + 0.03;
        }
      }
      box(t, kit.trim, 0, h, 0, w + 0.06, 0.06, d + 0.06, 0, 0.01);
      return true;
    }
    case 'cabinet': {
      const w = 1.5; const d = 0.6;
      box(t, kit.wood, 0, 0, 0, w, 1.0, d, 0, 0.02);
      box(t, kit.glass, 0, 1.0, -0.05, w - 0.1, 0.9, d - 0.15, 0, 0.01);
      box(t, kit.trim, 0, 1.9, 0, w + 0.04, 0.06, d + 0.04, 0, 0.01);
      for (let k = 0; k < 4; k++) lathe(t, k % 2 ? kit.glow : kit.cloth, [[0.001, 0], [0.05, 0], [0.05, 0.16], [0.02, 0.2], [0.001, 0.22]], { segments: 6, smooth: false }, trs(-0.5 + k * 0.33, 1.05, 0));
      return true;
    }
    case 'pc': {
      box(t, kit.metal, 0, 0, 0, 0.9, 0.85, 0.6, 0, 0.03);
      box(t, kit.metal, 0, 0.85, -0.1, 0.8, 0.6, 0.12, 0, 0.02);
      box(t, kit.glow, 0, 0.92, -0.035, 0.66, 0.44, 0.02, 0, 0.005);
      box(t, kit.trim, 0, 0.86, 0.18, 0.6, 0.04, 0.22, 0, 0.008);
      return true;
    }
    case 'bed': {
      const w = W(1.8); const d = D(2.3);
      box(t, kit.wood, 0, 0, 0, w, 0.42, d, 0, 0.03);
      box(t, 'plaster', 0, 0.42, 0.05, w - 0.12, 0.16, d - 0.2, 0, 0.05);
      box(t, kit.cloth, 0, 0.5, 0.25, w - 0.06, 0.12, d * 0.62, 0, 0.04);
      box(t, 'plaster', 0, 0.56, -d / 2 + 0.3, w * 0.6, 0.12, 0.34, 0, 0.05);
      box(t, kit.wood, 0, 0, -d / 2 + 0.04, w + 0.04, 1.0, 0.08, 0, 0.02);
      return true;
    }
    case 'table': {
      const w = W(1.5); const d = D(1.1);
      box(t, kit.wood, 0, 0.72, 0, w, 0.06, d, 0, 0.015);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(t, kit.wood, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), 0.08, 0.72, 0.08, 0, 0.012);
      lathe(t, kit.candle, [[0.001, 0.78], [0.04, 0.78], [0.04, 0.95], [0.001, 0.97]], { segments: 6, smooth: false });
      return true;
    }
    case 'chair': {
      box(t, kit.wood, 0, 0.42, 0, 0.46, 0.05, 0.44, 0, 0.01);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(t, kit.wood, sx * 0.19, 0, sz * 0.18, 0.05, 0.42, 0.05, 0, 0.008);
      box(t, kit.wood, 0, 0.45, -0.2, 0.46, 0.5, 0.05, 0, 0.01);
      return true;
    }
    case 'rug': {
      // a woven field in the theme's rug surface, a narrow border and two inner bands in the trim, fringe at the ends;
      // 2.4 × 1.6 m before the prop's scale (the league foyer's 1.4 gives 3.4 × 2.2 m; it was 4.2 × 2.8 m of pale marble)
      box(t, kit.trim, 0, -0.022, 0, 2.5, 0.03, 1.7, 0, 0.008);
      box(t, kit.rug, 0, -0.02, 0, 2.4, 0.034, 1.6, 0, 0.01);
      for (const sz of [-1, 1]) box(t, kit.trim, 0, -0.019, sz * 0.58, 2.1, 0.034, 0.06, 0, 0.004);
      for (const sx of [-1, 1]) for (let k = 0; k < 9; k++) box(t, kit.trim, sx * 1.27, -0.022, -0.72 + k * 0.18, 0.1, 0.012, 0.025, 0, 0.002);
      return true;
    }
    case 'plant': {
      lathe(t, kit.stone, [[0.001, 0], [0.18, 0], [0.24, 0.42], [0.26, 0.46], [0.001, 0.44]], { segments: 10, smooth: false });
      const leaf = kit.leaf ?? st.leaf;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + p.next(); card(t, leaf, Math.cos(a) * 0.08, 0.4, Math.sin(a) * 0.08, 0.6, 0.75, a, -0.3, [0, 0.5, 0], 0.7, [0, 0, 1, 1], true); }
      return true;
    }
    case 'lamp': {
      lathe(t, kit.metal, [[0.001, 0], [0.18, 0], [0.18, 0.04], [0.03, 0.08], [0.025, 1.45], [0.001, 1.46]], { segments: 8, smooth: false });
      lathe(t, 'glass_warm', [[0.12, 1.32], [0.2, 1.36], [0.14, 1.62], [0.001, 1.64]], { segments: 8, smooth: false });
      return true;
    }
    case 'bench': addGeo(t, buildBench(st, seed)); return true;
    case 'crate': addGeo(t, buildCrate(st, seed)); return true;
    case 'barrel': addGeo(t, buildBarrel(st, seed)); return true;
    case 'planter': addGeo(t, buildPlanter(st, seed)); return true;
    case 'brazier': addGeo(t, buildBrazier(st, seed)); return true;
    case 'crystal': addGeo(t, buildCrystal({ ...st, crystal: kit.accent }, seed)); return true;
    case 'candles': {
      for (const [x, z] of [[-0.35, 0], [0.35, 0.1], [0, -0.35]] as const) addGeo(t, buildCandle(st, seed + 1), trs(x, 0, z, 0, x === 0 ? 1.1 : 0.85));
      return true;
    }
    case 'statue': {
      box(t, kit.stone, 0, 0, 0, 1.1, 0.9, 1.1, 0, 0.05);
      box(t, kit.trim, 0, 0.88, 0, 1.2, 0.08, 1.2, 0, 0.02);
      lathe(t, kit.stone, [[0.001, 0.96], [0.36, 0.96], [0.3, 1.4], [0.4, 1.9], [0.28, 2.3], [0.16, 2.55], [0.22, 2.75], [0.001, 2.95]], { segments: 10, smooth: true });
      for (const s of [-1, 1]) lathe(t, kit.stone, [[0.001, 0], [0.08, 0.02], [0.05, 0.42], [0.001, 0.45]], { segments: 6, smooth: false }, rotZ(s * 0.24, 2.55, 0, -s * 0.5));
      return true;
    }
    case 'pillar': {
      box(t, kit.trim, 0, -0.02, 0, 0.9, 0.3, 0.9, 0, 0.04);
      lathe(t, kit.stone, [[0.36, 0.28], [0.3, 0.42], [0.28, 2.9], [0.32, 3.0]], { segments: 14, smooth: true });
      box(t, kit.trim, 0, 3.0, 0, 0.86, 0.22, 0.86, 0, 0.04);
      return true;
    }
    case 'banner': {
      beam(t, kit.metal, [0, -0.05, 0], [0, 3.1, 0], 0.08, 0.08, 0.015);
      beam(t, kit.metal, [-0.6, 3.0, 0], [0.6, 3.0, 0], 0.05, 0.05, 0.01);
      if (isCard(kit.cloth)) card(t, kit.cloth, 0, 0.9, 0.06, 1.1, 2.05, 0, 0, undefined, 0.65, [0, 0, 1, 1], true);
      else box(t, kit.cloth, 0, 0.9, 0.06, 1.1, 2.05, 0.04, 0, 0.01);
      box(t, kit.accent, 0, 2.2, 0.1, 0.42, 0.42, 0.02, 0, 0.006);
      return true;
    }
    case 'spectators': {
      // three tiers of bench seating (the crowd itself is the client's actors)
      for (let k = 0; k < 3; k++) {
        box(t, kit.stone, 0, -0.05, -0.55 * k, 4.4, 0.45 + 0.42 * k, 0.6, 0, 0.03);
        box(t, kit.wood, 0, 0.4 + 0.42 * k, -0.55 * k + 0.05, 4.3, 0.06, 0.42, 0, 0.012);
      }
      return true;
    }
    case 'flowerbed': {
      box(t, kit.border, 0, -0.02, 0, 2.6, 0.24, 1.2, 0, 0.03);
      box(t, kit.soil, 0, 0.2, 0, 2.4, 0.04, 1.0, 0, 0.01);
      const petal = kit.flower ?? kit.leaf;
      if (petal) for (let k = 0; k < 4; k++) addGeo(t, buildFlowers(petal, seed + k), trs(-0.9 + k * 0.6, 0.2, (p.next() - 0.5) * 0.3, p.next() * TAU, 0.55));
      return true;
    }
    case 'lava_channel': {
      // two glowing lava runnels along the lane's edges (the lane between stays walkable)
      for (const s of [-1, 1]) {
        box(t, kit.border, s * 2.6, -0.03, 0, 0.62, 0.12, 12.6, 0, 0.02);
        box(t, kit.accent, s * 2.6, 0.06, 0, 0.36, 0.04, 12.2, 0, 0.01);
      }
      return true;
    }
    case 'anchor': {
      beam(t, kit.metal, [0, 0.05, 0], [0, 1.9, 0], 0.16, 0.16, 0.03);
      beam(t, kit.metal, [-0.5, 1.6, 0], [0.5, 1.6, 0], 0.1, 0.12, 0.02);
      lathe(t, kit.metal, [[0.1, -0.06], [0.16, 0], [0.1, 0.06], [0.05, 0]], { segments: 10, smooth: false }, rotX(0, 2.05, 0, Math.PI / 2));
      for (const s of [-1, 1]) beam(t, kit.metal, [0, 0.12, 0], [s * 0.7, 0.55, 0], 0.14, 0.12, 0.02);
      lathe(t, 'rope', [[0.5, -0.02], [0.56, 0.04], [0.5, 0.1], [0.44, 0.04]], { segments: 12, smooth: true });
      return true;
    }
    case 'coil': {
      lathe(t, kit.metal, [[0.001, 0.45], [0.42, 0.45], [0.36, 0.6], [0.16, 0.7], [0.14, 2.2], [0.001, 2.2]], { segments: 12, smooth: false });
      for (let k = 0; k < 9; k++) lathe(t, 'lantern_metal', [[0.17, 0.8 + k * 0.15], [0.2, 0.85 + k * 0.15], [0.17, 0.9 + k * 0.15]], { segments: 12, smooth: false });
      lathe(t, kit.glass, [[0.001, 2.2], [0.3, 2.3], [0.42, 2.45], [0.3, 2.6], [0.001, 2.65]], { segments: 12, smooth: true });
      lathe(t, kit.glow, [[0.001, 2.62], [0.12, 2.7], [0.001, 2.86]], { segments: 8, smooth: true });
      return true;
    }
    case 'light_path': {
      for (let k = 0; k < 8; k++) {
        const z = -3.5 + k;
        box(t, kit.border, 0, -0.02, z, 0.9, 0.06, 0.7, 0, 0.01);
        box(t, kit.glow, 0, 0.03, z, 0.6, 0.012, 0.42, 0, 0.004);
      }
      return true;
    }
    case 'minecart': {
      for (const s of [-1, 1]) box(t, 'lantern_metal', s * 0.45, -0.02, 0, 0.08, 0.06, 3.4, 0, 0.01);
      for (let z = -1.5; z <= 1.5; z += 0.5) box(t, kit.wood, 0, -0.03, z, 1.2, 0.04, 0.16, 0, 0.01);
      box(t, kit.metal, 0, 0.28, 0, 1.0, 0.62, 1.4, 0, 0.04);
      box(t, kit.dark, 0, 0.84, 0, 0.84, 0.04, 1.24, 0, 0.01);
      for (let k = 0; k < 5; k++) addGeo(t, buildRock(kit.rock, seed + k, { size: 0.22, squash: 0.7, elongate: 1.2, cuts: [3, 4] }), trs((p.next() - 0.5) * 0.6, 0.86, (p.next() - 0.5) * 0.9, p.next() * TAU));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lathe(t, kit.metal, [[0.001, -0.06], [0.2, -0.06], [0.2, 0.06], [0.001, 0.06]], { segments: 10, smooth: false }, rotZ(sx * 0.52, 0.22, sz * 0.45, Math.PI / 2));
      return true;
    }
    case 'mirror': {
      box(t, kit.trim, 0, 0, 0, 1.3, 2.3, 0.16, 0, 0.03);
      box(t, kit.glass, 0, 0.15, 0.06, 1.05, 2.0, 0.04, 0, 0.005);
      box(t, kit.trim, 0, 2.3, 0, 0.7, 0.3, 0.16, Math.PI / 4, 0.03);
      return true;
    }
    case 'forge': {
      box(t, kit.wall, 0, -0.05, 0, 2.2, 0.95, 1.4, 0, 0.04);
      box(t, kit.dark, 0, 0.88, 0, 1.6, 0.06, 0.9, 0, 0.01);
      box(t, kit.glow, 0, 0.92, 0, 1.3, 0.05, 0.7, 0, 0.01);
      box(t, kit.metal, 0, 1.9, -0.2, 1.8, 0.4, 1.0, 0, 0.03);
      box(t, kit.wall, 0, 2.3, -0.3, 0.7, 1.6, 0.7, 0, 0.03);
      box(t, kit.metal, 1.5, 0, 0.3, 0.5, 0.5, 0.35, 0, 0.02);
      return true;
    }
    case 'weapon_rack': {
      box(t, kit.wood, 0, 0, -0.1, 2.0, 0.1, 0.4, 0, 0.012);
      for (const y of [0.9, 1.6]) box(t, kit.wood, 0, y, -0.15, 2.0, 0.08, 0.1, 0, 0.012);
      for (const s of [-1, 1]) box(t, kit.wood, s * 0.95, 0, -0.15, 0.1, 1.8, 0.1, 0, 0.012);
      for (let k = 0; k < 5; k++) {
        const x = -0.72 + k * 0.36;
        beam(t, kit.metal, [x, 0.12, -0.05], [x + (p.next() - 0.5) * 0.08, 1.75, -0.08], 0.05, 0.02, 0.005);
        box(t, kit.trim, x, 0.3, -0.05, 0.16, 0.04, 0.05, 0, 0.005);
      }
      return true;
    }
    case 'bridge': {
      const L = 14; const w = 3.4;
      for (let z = -L / 2; z < L / 2; z += 0.4) box(t, kit.wood, (p.next() - 0.5) * 0.04, -0.04, z + 0.2, w, 0.08, 0.36, (p.next() - 0.5) * 0.02, 0.01);
      for (const s of [-1, 1]) {
        box(t, kit.trim, s * (w / 2 - 0.05), 0.95, 0, 0.08, 0.06, L, 0, 0.01);
        for (let z = -L / 2 + 0.3; z <= L / 2; z += 1.6) box(t, kit.trim, s * (w / 2 - 0.05), -0.05, z, 0.1, 1.0, 0.1, 0, 0.012);
        if (isCard(kit.cloth)) for (let z = -L / 2 + 1.1; z < L / 2; z += 3.2) card(t, kit.cloth, s * (w / 2 + 0.02), 0.45, z, 0.5, 0.45, Math.PI / 2, 0, undefined, 0.6, [0, 0, 1, 1], true);
      }
      return true;
    }
    case 'cloud': {
      for (let k = 0; k < 3; k++) puff(t, kit.cloud, trs((p.next() - 0.5) * 2.4, -0.2 + p.next() * 0.3, (p.next() - 0.5) * 2.4, p.next() * TAU, 0.8 + p.next() * 0.6), seed + k * 7);
      return true;
    }
    case 'throne': {
      box(t, kit.trim, 0, -0.05, 0, 3.2, 0.32, 2.2, 0, 0.04);
      box(t, kit.stone, 0, 0.27, -0.1, 2.6, 0.22, 1.8, 0, 0.04);
      box(t, kit.stone, 0, 0.49, -0.2, 1.3, 0.5, 0.9, 0, 0.04);
      box(t, kit.cloth, 0, 0.99, -0.15, 1.1, 0.08, 0.75, 0, 0.03);
      box(t, kit.stone, 0, 0.49, -0.6, 1.3, 2.2, 0.2, 0, 0.04);
      box(t, kit.trim, 0, 2.6, -0.6, 1.45, 0.16, 0.26, 0, 0.03);
      for (const s of [-1, 1]) box(t, kit.trim, s * 0.62, 0.99, -0.2, 0.14, 0.4, 0.8, 0, 0.02);
      box(t, kit.accent, 0, 2.0, -0.48, 0.36, 0.36, 0.03, Math.PI / 4, 0.006);
      return true;
    }
    default: return false;
  }
}

function rotZ(x: number, y: number, z: number, a: number): Matrix4 { return new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationZ(a)); }
function rotX(x: number, y: number, z: number, a: number): Matrix4 { return new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationX(a)); }

// ---- gates ---------------------------------------------------------------------------------------------------------

/** A gate in its own frame (long axis along x, centred, y = 0 on the floor slab). */
function gateGeometry(t: Parts, style: string, kit: Kit, L: number, Tk: number, seed: number): void {
  const H = INTERIOR.gateH;
  switch (style) {
    case 'hedge': hedgeBlock(t, kit, L, Tk, INTERIOR.hedgeH, new Matrix4(), seed); return;
    case 'boulder': {
      const geo = buildRock(kit.rock, seed, { size: L * 0.42, squash: Math.min(1, (INTERIOR.boulderH + 0.3) / (L * 0.84)), elongate: 1.15, cuts: [3, 5] });
      addGeo(t, geo, trs(0, -0.1, 0));
      return;
    }
    case 'sluice': {
      box(t, kit.wood, 0, -0.4, 0, L - 0.12, 1.25, 0.16, 0, 0.02);
      for (let x = -L / 2 + 0.3; x < L / 2; x += 0.7) box(t, kit.metal, x, -0.4, 0.09, 0.08, 1.25, 0.04, 0, 0.01);
      for (const y of [-0.2, 0.6]) box(t, kit.metal, 0, y, 0.09, L - 0.2, 0.08, 0.04, 0, 0.01);
      return;
    }
    case 'barrier': {
      for (let k = 0; k < 6; k++) box(t, kit.glow, 0, 0.25 + k * 0.33, 0, L - 0.3, 0.06, 0.05, 0, 0.01);
      for (let x = -L / 2 + 0.4; x < L / 2 - 0.2; x += 0.5) box(t, kit.glow, x, 0.2, 0, 0.03, H - 0.2, 0.03, 0, 0.005);
      return;
    }
    case 'rune': {
      const th = Math.max(0.3, Tk - 0.1);
      box(t, kit.stone, 0, -0.05, 0, L - 0.08, H, th, 0, 0.05);
      for (const s of [-1, 1]) {
        box(t, kit.glow, 0, 0.9, s * (th / 2 + 0.006), 0.6, 0.6, 0.012, 0, 0.004);
        box(t, kit.glow, 0, 0.45, s * (th / 2 + 0.006), Math.min(L - 0.5, 2.2), 0.05, 0.012, 0, 0.004);
      }
      return;
    }
    default: {
      // 'grate' / 'portcullis' (and any unknown style): iron bars
      const heavy = style === 'portcullis';
      const n = Math.max(3, Math.round(L / (heavy ? 0.3 : 0.22)));
      for (let k = 0; k <= n; k++) {
        const x = -L / 2 + 0.08 + (k * (L - 0.16)) / n;
        beam(t, kit.metal, [x, 0, 0], [x, H, 0], heavy ? 0.08 : 0.055, heavy ? 0.08 : 0.055, 0.012);
        if (heavy) lathe(t, kit.metal, [[0.001, -0.18], [0.05, 0.02], [0.001, 0.02]], { segments: 4, smooth: false }, trs(x, 0, 0));
      }
      for (const y of heavy ? [0.5, 1.1, 1.7, H - 0.06] : [0.35, H - 0.06]) box(t, kit.metal, 0, y, 0, L - 0.04, heavy ? 0.09 : 0.07, 0.1, 0, 0.012);
      return;
    }
  }
}

/** The static jambs either side of a gate (gate frame `m`). */
function gateFrame(S: Parts, style: string, kit: Kit, L: number, Tk: number, m: Matrix4): void {
  if (style === 'hedge' || style === 'boulder') return;
  const H = INTERIOR.gateH;
  const post = style === 'barrier' ? kit.metal : kit.trim;
  for (const s of [-1, 1]) {
    box(S, post, s * (L / 2 + 0.12), -0.05, 0, 0.26, H + 0.25, Math.max(0.36, Tk + 0.1), 0, 0.04, m);
    if (style === 'barrier') lathe(S, kit.glow, [[0.001, 0], [0.09, 0.02], [0.09, 0.14], [0.001, 0.16]], { segments: 8, smooth: false }, m.clone().multiply(trs(s * (L / 2 + 0.12), H + 0.2, 0)));
  }
}

// ---- switches ------------------------------------------------------------------------------------------------------

interface SwitchParts {
  readonly base: Parts; readonly moving: Parts; readonly glow: Parts;
  /** where the moving part's frame sits (its geometry is built around it) */
  readonly pivot: readonly [number, number, number];
  /** [rotation about x (rad), y offset (m)] of the moving part when off / on */
  readonly off: readonly [number, number]; readonly on: readonly [number, number];
}

/** A switch by kind in its own frame (+z faces the approach, y = 0 on the floor slab). */
function switchGeometry(kind: string, kit: Kit, seed: number): SwitchParts {
  const base = new Parts(); const moving = new Parts(); const glow = new Parts();
  const p = createPrng(seed);
  switch (kind) {
    case 'rootstone': {
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + p.next(); addGeo(base, buildRock(kit.rock, seed + k, { size: 0.32, squash: 0.5, elongate: 1.3, cuts: [3, 4] }), trs(Math.cos(a) * 0.75, -0.05, Math.sin(a) * 0.75, a)); }
      lathe(moving, kit.stone, [[0.001, -0.3], [0.42, -0.3], [0.38, 0.4], [0.3, 1.2], [0.16, 1.55], [0.001, 1.62]], { segments: 7, smooth: false, phase: p.next() });
      if (kit.leaf) for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; card(moving, kit.leaf, Math.cos(a) * 0.3, 0.0, Math.sin(a) * 0.3, 0.5, 0.5, a, -0.4, [0, 0.3, 0], 0.6, [0, 0, 1, 1], true); }
      lathe(glow, kit.glow, [[0.395, 0.55], [0.4, 0.62], [0.36, 0.95], [0.355, 0.88]], { segments: 7, smooth: false });
      // the stone rises out of the ground when woken; its glow band rises with it (glow is in the holder: offset it)
      return { base, moving, glow, pivot: [0, 0, 0], off: [0, -0.22], on: [0, 0] };
    }
    case 'furnace': {
      box(base, kit.wall, 0, -0.05, 0, 1.6, 1.3, 1.2, 0, 0.05);
      box(base, kit.dark, 0, 0.25, 0.56, 0.8, 0.6, 0.1, 0, 0.02);
      box(base, kit.trim, 0, 1.22, 0, 1.75, 0.14, 1.35, 0, 0.03);
      box(base, kit.wall, 0, 1.3, -0.2, 0.6, 1.2, 0.6, 0, 0.03);
      lathe(glow, kit.accent, [[0.001, 0.3], [0.32, 0.3], [0.22, 0.48], [0.001, 0.56]], { segments: 7, smooth: false }, trs(0, 0, 0.42));
      box(glow, kit.accent, 0, 2.45, -0.2, 0.42, 0.05, 0.42, 0, 0.01);
      box(moving, kit.metal, 0, 0, 0, 0.84, 0.64, 0.05, 0, 0.01);          // the furnace door, hinged at its foot
      return { base, moving, glow, pivot: [0, 0.25, 0.64], off: [0, 0], on: [1.2, 0] };
    }
    case 'breaker': {
      box(base, kit.metal, 0, 0.1, -0.15, 0.9, 1.5, 0.35, 0, 0.03);
      box(base, kit.trim, 0, -0.05, -0.15, 1.0, 0.18, 0.45, 0, 0.02);
      for (const s of [-1, 1]) beam(base, 'lantern_metal', [s * 0.3, 1.6, -0.15], [s * 0.3, 2.3, -0.15], 0.05, 0.05, 0.01);
      lathe(glow, kit.glow, [[0.001, 0], [0.09, 0.02], [0.09, 0.12], [0.001, 0.14]], { segments: 8, smooth: false }, trs(0, 1.38, 0.06));
      box(moving, kit.dark, 0, -0.05, 0, 0.08, 0.5, 0.08, 0, 0.01);
      box(moving, kit.glow, 0, 0.42, 0, 0.16, 0.12, 0.16, 0, 0.02);
      return { base, moving, glow, pivot: [0, 0.8, 0.1], off: [0.6, 0], on: [-0.6, 0] };
    }
    case 'lever': {
      box(base, kit.stone, 0, -0.05, 0, 0.7, 0.35, 0.5, 0, 0.03);
      box(base, kit.metal, 0, 0.3, 0, 0.36, 0.3, 0.3, 0, 0.02);
      beam(base, kit.metal, [0.3, 0.3, 0], [0.3, 1.5, 0], 0.08, 0.08, 0.01);
      lathe(glow, kit.glow, [[0.001, 0], [0.11, 0.03], [0.12, 0.16], [0.001, 0.22]], { segments: 8, smooth: true }, trs(0.3, 1.5, 0));
      beam(moving, kit.metal, [0, 0, 0], [0, 0.85, 0], 0.06, 0.06, 0.01);
      lathe(moving, kit.dark, [[0.001, 0.8], [0.07, 0.82], [0.07, 0.98], [0.001, 1.0]], { segments: 8, smooth: true });
      return { base, moving, glow, pivot: [0, 0.5, 0], off: [0.6, 0], on: [-0.6, 0] };
    }
    case 'keystone': {
      box(base, kit.stone, 0, -0.05, 0, 1.0, 0.95, 1.0, 0, 0.05);
      box(base, kit.trim, 0, 0.88, 0, 1.12, 0.1, 1.12, 0, 0.02);
      box(base, kit.dark, 0, 0.9, 0, 0.42, 0.1, 0.42, 0, 0.01);
      box(moving, kit.rock, 0, 0, 0, 0.36, 0.5, 0.36, Math.PI / 4, 0.04);
      lathe(glow, kit.glow, [[0.5, 0.985], [0.56, 0.985], [0.56, 1.0], [0.5, 1.0]], { segments: 4, smooth: false, phase: Math.PI / 4 });
      return { base, moving, glow, pivot: [0, 0.98, 0], off: [0, 0.35], on: [0, -0.2] };
    }
    case 'tile': {
      box(base, kit.border, 0, -0.05, 0, 1.5, 0.08, 1.5, 0, 0.02);
      box(moving, kit.stone, 0, 0, 0, 1.2, 0.07, 1.2, 0, 0.015);
      box(glow, kit.glow, 0, 0.065, 0, 0.7, 0.012, 0.7, Math.PI / 4, 0.004);
      box(glow, kit.glow, 0, 0.065, 0, 0.9, 0.012, 0.08, 0, 0.003);
      return { base, moving, glow, pivot: [0, 0, 0], off: [0, 0], on: [0, -0.03] };
    }
    case 'anvil': {
      lathe(base, kit.wood, [[0.001, -0.05], [0.4, -0.05], [0.38, 0.55], [0.001, 0.56]], { segments: 10, smooth: true });
      box(base, 'lantern_metal', 0, 0.55, 0, 0.36, 0.22, 0.3, 0, 0.02);
      box(base, 'lantern_metal', 0, 0.77, 0, 0.8, 0.18, 0.34, 0, 0.03);
      lathe(base, 'lantern_metal', [[0.001, 0], [0.15, 0], [0.001, 0.35]], { segments: 6, smooth: false }, rotZ(0.4, 0.86, 0, -Math.PI / 2));
      box(glow, kit.accent, 0, 0.95, 0, 0.36, 0.06, 0.12, 0.3, 0.01);
      beam(moving, kit.wood, [0, 0, 0], [0, 0, 0.55], 0.05, 0.05, 0.01);
      box(moving, kit.metal, 0, -0.08, 0.55, 0.14, 0.16, 0.24, 0, 0.02);
      return { base, moving, glow, pivot: [0.15, 1.15, -0.3], off: [-0.7, 0], on: [0.25, 0] };
    }
    default: {
      box(base, kit.stone, 0, -0.05, 0, 0.7, 0.9, 0.7, 0, 0.04);
      box(glow, kit.glow, 0, 0.85, 0, 0.4, 0.04, 0.4, 0, 0.01);
      return { base, moving, glow, pivot: [0, 0, 0], off: [0, 0], on: [0, 0] };
    }
  }
}

// ---- canopy ---------------------------------------------------------------------------------------------------------

/** The knoll's surface height (m above floorY) at a local point, `ground` = terrain − floorY there. */
function knoll(lx: number, lz: number, fhw: number, fhd: number, ground: number, salt: number): number {
  const e = Math.min(fhw - Math.abs(lx), fhd - Math.abs(lz));
  const reach = INTERIOR.screenM + INTERIOR.wallT;
  const u = Math.max(0, Math.min(1, e / reach));
  const t = u * u * (3 - 2 * u);
  const top = INTERIOR.canopyTop + valueNoise(lx * 0.3, lz * 0.3, salt) * 0.45;
  return (ground - 0.12) * (1 - t) + top * t;
}

/** The knoll as a smooth-normal grid over the footprint (local frame), metre UVs. */
function moundParts(P: Parts, surface: SurfaceId, fhw: number, fhd: number, step: number, ground: (lx: number, lz: number) => number, salt: number): void {
  const nx = Math.max(2, Math.ceil((2 * fhw) / step)); const nz = Math.max(2, Math.ceil((2 * fhd) / step));
  const sx = (2 * fhw) / nx; const sz = (2 * fhd) / nz;
  const ys = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = -fhw + i * sx; const z = -fhd + j * sz; ys[j * (nx + 1) + i] = knoll(x, z, fhw, fhd, ground(x, z), salt); }
  const y = (i: number, j: number): number => ys[Math.min(nz, Math.max(0, j)) * (nx + 1) + Math.min(nx, Math.max(0, i))]!;
  const n = (i: number, j: number): [number, number, number] => {
    const gx = (y(i + 1, j) - y(i - 1, j)) / (2 * sx); const gz = (y(i, j + 1) - y(i, j - 1)) / (2 * sz);
    const l = Math.hypot(gx, 1, gz);
    return [-gx / l, 1 / l, -gz / l];
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x0 = -fhw + i * sx; const x1 = x0 + sx; const z0 = -fhd + j * sz; const z1 = z0 + sz;
      const a = [x0, y(i, j), z0] as const; const b = [x1, y(i + 1, j), z0] as const;
      const c = [x0, y(i, j + 1), z1] as const; const e = [x1, y(i + 1, j + 1), z1] as const;
      const na = n(i, j); const nb = n(i + 1, j); const nc = n(i, j + 1); const ne = n(i + 1, j + 1);
      P.tri(surface, [...a, ...c, ...b], [...na, ...nc, ...nb], [a[0], a[2], c[0], c[2], b[0], b[2]]);
      P.tri(surface, [...b, ...c, ...e], [...nb, ...nc, ...ne], [b[0], b[2], c[0], c[2], e[0], e[2]]);
    }
  }
}

// ---- the pocket -----------------------------------------------------------------------------------------------------

/** Builds one pocket (`ewa:interior:<id>`): the hall (hidden), the canopy (shown) and the rim. */
export function buildInterior(spec: InteriorSpec, d: InteriorBuildDeps): BuiltInterior {
  const kit = themeKit(spec.theme, d.zoneSet);
  const id = spec.id;
  const seed = seedOf(id);
  const top = INTERIOR.floorTop;
  const T = INTERIOR.wallT;
  const root = new Group();
  root.name = `ewa:interior:${id}`;
  root.position.set(spec.x, spec.floorY, spec.z);
  root.rotation.y = spec.yaw;
  const hall = new Group();
  hall.name = `ewa:interior:${id}:hall`;
  hall.visible = false;
  root.add(hall);
  const cs = Math.cos(spec.yaw); const sn = Math.sin(spec.yaw);
  const toW = (lx: number, lz: number): [number, number] => [spec.x + cs * lx + sn * lz, spec.z - sn * lx + cs * lz];
  const ground = (lx: number, lz: number): number => { const [x, z] = toW(lx, lz); return heightClamped(d.heightfield, x, z) - spec.floorY; };
  const footprints: RectBlocker[] = [];
  const rectW = (lx: number, lz: number, hw: number, hd: number): void => {
    const [x, z] = toW(lx, lz);
    footprints.push({ kind: 'rect', x, z, hw, hd, yaw: spec.yaw });
  };

  // floor, outer walls -----------------------------------------------------------------------------------------
  // F flat (no shadow), S casting statics (inner walls, tall props), P small dressing (no shadow), W water
  const F = new Parts(); const S = new Parts(); const P = new Parts(); const W: WaterAcc = { pos: [], dep: [] };
  floorAndBorder(F, spec, kit);
  const walls: WallRec[] = [];
  const wp = outerWalls(spec, kit);
  const normals: Record<WallSide, readonly [number, number]> = { back: [0, -1], front: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const side of ['back', 'front', 'left', 'right'] as const) {
    const o = meshOf(wp[side], `ewa:interior:${id}:wall:${side}`, true, d);
    if (!o) continue;
    hall.add(o);
    const [nx, nz] = normals[side];
    walls.push({ side, object: o, nx: cs * nx + sn * nz, nz: -sn * nx + cs * nz });
  }
  rectW(0, -spec.d / 2 - T / 2, spec.w / 2 + T, T / 2);
  rectW(0, spec.d / 2 + T / 2, spec.w / 2 + T, T / 2);
  rectW(-spec.w / 2 - T / 2, 0, T / 2, spec.d / 2);
  rectW(spec.w / 2 + T / 2, 0, T / 2, spec.d / 2);

  // internal solids, props ----------------------------------------------------------------------------------------
  let innerWalls = 0;
  spec.walls.forEach((w, k) => {
    if (innerWall(S, F, W, spec, w, kit, seed + 101 * (k + 1))) innerWalls++;
    if (w.style !== 'channel' && w.style !== 'chasm') rectW(w.lx, w.lz, w.hw, w.hd);
  });
  let props = 0;
  spec.props.forEach((pp, k) => {
    const t = new Parts();
    // a prop standing on a solid rect is sized to it (beds, tables, counters, bookshelves)
    const solid = spec.walls.find((w) => (w.style === 'wall' || w.style === 'counter') && Math.abs(pp.lx - w.lx) <= w.hw + 0.05 && Math.abs(pp.lz - w.lz) <= w.hd + 0.05);
    const quarter = Math.abs(Math.sin(pp.yaw)) > 0.7;
    const size: [number, number] | null = solid ? (quarter ? [solid.hd, solid.hw] : [solid.hw, solid.hd]) : null;
    if (!propInto(t, pp.kind, kit, size, seed + 7919 * (k + 1))) return;
    const flat = pp.kind === 'rug' || pp.kind === 'light_path' || pp.kind === 'lava_channel';
    (flat ? F : CASTING_PROPS.has(pp.kind) ? S : P).addParts(t, trs(pp.lx, top, pp.lz, pp.yaw, pp.scale > 0 ? pp.scale : 1));
    props++;
  });

  // gates --------------------------------------------------------------------------------------------------------
  const gates: GateRec[] = [];
  spec.gates.forEach((g, k) => {
    const along = g.hw >= g.hd;
    const L = 2 * Math.max(g.hw, g.hd); const Tk = 2 * Math.min(g.hw, g.hd);
    const yawG = along ? 0 : Math.PI / 2;
    const t = new Parts();
    gateGeometry(t, g.style, kit, L, Tk, seed + 503 * (k + 1));
    gateFrame(S, g.style, kit, L, Tk, trs(g.lx, top, g.lz, yawG));
    const o = meshOf(t, `ewa:interior:${id}:gate:${g.id}:mesh`, false, d);   // transient: no shadow draws
    if (!o) return;
    const holder = new Group();
    holder.name = `ewa:interior:${id}:gate:${g.id}`;
    holder.position.set(g.lx, top, g.lz);
    holder.rotation.y = yawG;
    holder.add(o);
    hall.add(holder);
    const aside = g.style === 'hedge' || g.style === 'boulder';
    const ax = Math.cos(yawG); const az = -Math.sin(yawG);               // the gate's long axis in the hall frame
    const pos = along ? g.lx : g.lz;
    const dir = pos > 0.01 ? -1 : 1;                                     // slide toward the centre line, into the wall beside it
    const travel = aside ? L + 0.2 : INTERIOR.gateH + 0.3;
    gates.push({
      id: g.id, style: g.style, object: holder, mode: aside ? 'aside' : 'down',
      rest: [g.lx, top, g.lz], delta: aside ? [ax * dir * travel, 0, az * dir * travel] : [0, -travel, 0],
      roll: g.style === 'boulder' ? -dir * (travel / Math.max(0.5, L * 0.42)) : 0,
    });
  });

  // switches ----------------------------------------------------------------------------------------------------
  const switches: SwitchRec[] = [];
  spec.switches.forEach((s, k) => {
    const sp = switchGeometry(s.kind, kit, seed + 307 * (k + 1));
    // face the approach: a switch by a side wall faces the hall's centre line, the rest face the door
    const nearSide = Math.abs(s.lx) > spec.w / 2 - 2;
    const yawS = nearSide ? (s.lx > 0 ? -Math.PI / 2 : Math.PI / 2) : 0;
    P.addParts(sp.base, trs(s.lx, top, s.lz, yawS));
    const holder = new Group();
    holder.name = `ewa:interior:${id}:switch:${s.id}`;
    holder.position.set(s.lx, top, s.lz);
    holder.rotation.y = yawS;
    let moving: Object3D | null = null;
    const mv = meshOf(sp.moving, `ewa:interior:${id}:switch:${s.id}:moving`, false, d);
    if (mv) {
      const pivot = new Group();
      pivot.name = `ewa:interior:${id}:switch:${s.id}:pivot`;
      pivot.position.set(sp.pivot[0], sp.pivot[1] + sp.off[1], sp.pivot[2]);
      pivot.rotation.x = sp.off[0];
      pivot.add(mv);
      holder.add(pivot);
      moving = pivot;
    }
    const gl = meshOf(sp.glow, `ewa:interior:${id}:switch:${s.id}:glow`, false, d);
    if (gl) { gl.visible = false; holder.add(gl); }
    hall.add(holder);
    switches.push({ id: s.id, kind: s.kind, holder, moving, glow: gl, off: [sp.off[0], sp.pivot[1] + sp.off[1]], on: [sp.on[0], sp.pivot[1] + sp.on[1]] });
  });

  // merged statics ------------------------------------------------------------------------------------------------
  const flatMesh = meshOf(F, `ewa:interior:${id}:floor`, false, d);
  if (flatMesh) hall.add(flatMesh);
  const stat = meshOf(S, `ewa:interior:${id}:static`, true, d);
  if (stat) hall.add(stat);
  const dress = meshOf(P, `ewa:interior:${id}:dressing`, false, d);
  if (dress) hall.add(dress);
  const water = waterMesh(W, kit.water, `ewa:interior:${id}:water`, d);
  if (water) hall.add(water);

  // canopy (a LOD of three tiers) + rim ------------------------------------------------------------------------------
  const ac = Math.abs(cs) > 0.5;
  const fhw = ac ? spec.footprint.hw : spec.footprint.hd; const fhd = ac ? spec.footprint.hd : spec.footprint.hw;
  const canopy = new Group();
  canopy.name = `ewa:interior:${id}:canopy`;
  root.add(canopy);
  const tree = canopyTree(d.zoneSet);
  const tiers = [new Parts(), new Parts(), new Parts()];
  const mounds = [new Parts(), new Parts()];
  const salt = seed & 0xffff;
  const groundLayer = tree ? d.palette.terrainLayers[0] : d.zoneSet.rock;
  mounds.forEach((M, k) => moundParts(M, groundLayer, fhw, fhd, k === 1 ? 2 : 1, ground, salt));
  const ihw = spec.w / 2 + T + 0.6; const ihd = spec.d / 2 + T + 0.6;
  const spacing = tree ? INTERIOR.canopyTreeSpacing : 3.2;
  const kinds: PropGeo[] = tree
    ? [0, 1, 2].map((k) => buildTree(tree.bark, tree.leaf, tree.shape, (seed ^ 0x7ee5) + k * 977))
    : [0, 1, 2].map((k) => buildRock(d.zoneSet.rock, (seed ^ 0x40c1) + k * 31, { size: 1.5, squash: 0.75, elongate: 1.3, cuts: [3, 5] }));
  const nxT = Math.max(1, Math.round((2 * ihw) / spacing)); const nzT = Math.max(1, Math.round((2 * ihd) / spacing));
  for (let j = 0; j < nzT; j++) for (let i = 0; i < nxT; i++) {
    const h1 = hash2(i, j, seed); const h2 = hash2(i, j, seed + 1);
    const lx = -ihw + ((i + 0.25 + h1 * 0.5) * 2 * ihw) / nxT; const lz = -ihd + ((j + 0.25 + h2 * 0.5) * 2 * ihd) / nzT;
    const y = knoll(lx, lz, fhw, fhd, ground(lx, lz), salt) - (tree ? 0.5 : 0.6);
    const m = trs(lx, y, lz, h1 * TAU, tree ? 0.85 + h2 * 0.25 : 0.9 + h1 * 0.8);
    const g = kinds[(i * 7 + j) % 3]!;
    tiers.forEach((Tp, k) => addPropTier(Tp, g, k as 0 | 1 | 2, m));
  }
  for (const g of kinds) disposeProp(g);
  // undergrowth: bushes packed over the knoll so it reads as a thicket, not a bald hump (same leaf surface: no extra draw)
  const under = foliageOf(d.zoneSet);
  if (tree && under) {
    const bushes = [0, 1, 2].map((k) => buildBush(under, (seed ^ 0xb0b) + k, 1.5));
    const bs = 1.9;
    const nxB = Math.max(1, Math.round((2 * ihw) / bs)); const nzB = Math.max(1, Math.round((2 * ihd) / bs));
    for (let j = 0; j < nzB; j++) for (let i = 0; i < nxB; i++) {
      const h1 = hash2(i, j, seed + 5); const h2 = hash2(i, j, seed + 6);
      const lx = -ihw + ((i + 0.15 + h1 * 0.7) * 2 * ihw) / nxB; const lz = -ihd + ((j + 0.15 + h2 * 0.7) * 2 * ihd) / nzB;
      const m = trs(lx, knoll(lx, lz, fhw, fhd, ground(lx, lz), salt) - 0.35, lz, h2 * TAU, 0.85 + h1 * 0.5);
      tiers.forEach((Tp, k) => { if (k < 2 || (i + j) % 2 === 0) addPropTier(Tp, bushes[(i + 2 * j) % 3]!, k as 0 | 1 | 2, m); });
    }
    for (const g of bushes) disposeProp(g);
  }
  let canopyLod: LOD | null = null;
  // each level: the knoll (no shadow; lod2 a coarser grid) + the crowns (casting at lod0 only)
  const moundMeshes = mounds.map((M, k) => meshOf(M, `ewa:interior:${id}:canopy:mound${k}`, false, d));
  const levels = tiers.map((Tp, k) => {
    const crowns = meshOf(Tp, `ewa:interior:${id}:canopy:lod${k}`, k === 0, d);
    const mound = moundMeshes[k === 2 ? 1 : 0] ?? null;
    if (!crowns || !mound) return null;
    const lv = new Group();
    lv.name = `ewa:interior:${id}:canopy:level${k}`;
    lv.add(k === 1 ? mound.clone(true) : mound, crowns);
    return lv;
  });
  if (levels.every((o) => o !== null)) {
    const lod = new LOD();
    lod.name = `ewa:interior:${id}:canopy:lod`;
    lod.autoUpdate = false;
    levels.forEach((o, k) => lod.addLevel(o!, BUILDING_LOD_LEVELS[k]!.distance, BUILDING_LOD_LEVELS[k]!.hysteresis));
    canopy.add(lod);
    canopyLod = lod;
  }
  // rim: bushes (or stones) along the screen band, always shown — the hall reads as a clearing in a thicket
  const R = new Parts();
  const leaf = foliageOf(d.zoneSet);
  const rimGeo = leaf
    ? [0, 1].map((k) => buildBush(leaf, (seed ^ 0xb005) + k, 1.15))
    : [0, 1].map((k) => buildRock(d.zoneSet.rock, (seed ^ 0x40c2) + k, { size: 0.6, squash: 0.6, elongate: 1.4, cuts: [3, 5] }));
  const off = T + 1.05;
  const ring: [number, number][] = [];
  const run = (x0: number, z0: number, x1: number, z1: number): void => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / INTERIOR.rimSpacing));
    for (let k = 0; k <= n; k++) ring.push([x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n]);
  };
  const rx = spec.w / 2 + off; const rz = spec.d / 2 + off;
  run(-rx, -rz, rx, -rz); run(rx, -rz + INTERIOR.rimSpacing, rx, rz); run(-rx, -rz + INTERIOR.rimSpacing, -rx, rz);
  run(-rx + INTERIOR.rimSpacing, rz, -1.8, rz); run(1.8, rz, rx - INTERIOR.rimSpacing, rz);
  ring.forEach(([lx, lz], k) => {
    const h = hash2(k, 3, seed);
    addPropTier(R, rimGeo[k % 2]!, 0, trs(lx + (h - 0.5) * 0.4, ground(lx, lz) - 0.06, lz + (hash2(k, 4, seed) - 0.5) * 0.4, h * TAU, 0.85 + h * 0.4));
  });
  for (const g of rimGeo) disposeProp(g);
  const rim = meshOf(R, `ewa:interior:${id}:rim`, false, d);
  if (rim) root.add(rim);

  root.userData.ewaInterior = { id, template: spec.template, theme: spec.theme, innerWalls, gates: gates.length, switches: switches.length, props };
  return { id, root, hall, canopy, canopyLod, rim, walls, gates, switches, innerWalls, props, footprints };
}
