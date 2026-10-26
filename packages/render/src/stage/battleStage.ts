/**
 * SPEC §10.7.5 `BattleStage` (Pillar 7: battles happen where you are standing).
 *
 * `dress(at, terrain, participants)` raises an arena out of the ground at (x, z) — no screen transition, no scene
 * unload: a 7 m plinth ring in the biome's stone (library surface, metre UVs, a stone curb), eight lathed rope posts
 * with sagging ropes, two lathed beacon pylons whose emissive housings take the zone's accent type colour and carry
 * the two RESERVED shadow-casting spot lights, and ≤ 6 spectators (procedural characters from the actor pool)
 * on the far half. The arena root is a child of the scene, never of the zone root, so the zone's light list and
 * graph are identical before and during a battle (Pillar 7 test, §50.4.6). The two beacon lights exist from
 * `createRenderer` on (warm-up light set, C13: a light appearing mid-battle would recompile every lit program);
 * undressed they sit at intensity 0 with `shadow.autoUpdate = false` (no shadow-map cost).
 *
 * Battlers are `CreatureBillboard`s from the shared `SpritePool`: side 0 (the player's) on the near half showing its
 * back sprite, side 1 on the far half showing its front, 5.5 m apart along the heading's view axis (§10.7.4
 * interpretation P5), all DOF-sharp. Phase D6 doubles: a side holding two battlers (render `BattlerRef.slot` = the field
 * position 0 / 1) spreads them `SLOT_SPACING` across the battle axis (`battlerSlot`), mirrored per side, every foot
 * disc (`STAGE.battlerFootR`) inside the ring top; `fitCentre` keeps those four discs on a hall floor too. VFX spawn between battler anchors; `impact_crit` flashes the target white;
 * impacts pulse the beacons. `undress(ms)` sinks and hides the dressing and releases the battlers; it disposes
 * nothing shared (library materials, the sprite pool, the actor pool stay).
 */
import {
  BufferAttribute, CatmullRomCurve3, Color, Group, LatheGeometry, Mesh, MeshStandardNodeMaterial, Object3D, SpotLight, TubeGeometry, Vector2,
  Vector3,
} from 'three/webgpu';
import type { BufferGeometry, Material, PerspectiveCamera, UniformNode } from 'three/webgpu';
import { float, uniform, vec4 } from 'three/tsl';
import type { BattlerPose, BattlerRef, BattleStage, EvolutionHandle, EvolutionRequest, HallBounds, SpriteDescriptor, Terrain, TypeName, VfxId } from '../contracts.js';
import type { EffectsFlags, HarvestLevel, WeatherKind } from '../descriptors.js';
import type { MaterialLibrary } from '../materials/library.js';
import type { SurfaceId } from '../materials/surfaces.js';
import { paintSurfaceColor } from '../materials/library.js';
import { BATTLER_SEPARATION, INSPECT_AIM, INSPECT_OFFSET, RING_DIAMETER, SLOT_SPACING, TRAINER_SLOT_M, battlerSlot, forwardOfYaw, trainerSlot } from '../camera/battle.js';
import type { DioramaRig } from '../camera/rig.js';
import type { BillboardPool, CreatureBillboard } from '../sprites/billboard.js';
import { TYPE_COLORS, hexToLinearInto, validateTypeColorTable } from '../sprites/typeColors.js';
import { AuraSystem } from './aura.js';
import type { CharacterPool } from './actors.js';
import { EvolutionSequence } from './evolution.js';
import { isVfxId, type VfxAnchor, type VfxSystem } from './vfx.js';

// ---- numbers -------------------------------------------------------------------------------------------------------

export const STAGE = Object.freeze({
  ringRadius: RING_DIAMETER / 2,
  ringTop: 0.06,
  ringChamfer: 0.04,
  ringSkirt: 0.45,
  ringSegments: 64,
  curbInner: 3.5, curbOuter: 3.85, curbHeight: 0.16,
  postRadius: 4.35, postCount: 8, postHeight: 0.85, ropeSag: 0.14, ropeRadius: 0.022, ropeHeights: [0.42, 0.74] as const,
  beaconRadius: 4.7, beaconHeight: 2.3, beaconAzimuthDeg: 40, beaconWhiteMix: 0.55,
  beaconIntensity: 90, beaconRange: 18, beaconAngle: 0.8, beaconPenumbra: 0.6, beaconDecay: 2, beaconShadowMap: 512,
  beaconBias: -0.0006, beaconNormalBias: 0.03,
  housingEmissive: 3.2,
  pulseMs: 260, pulseGain: 0.9,
  spectatorRadius: 5.9, spectatorAnglesDeg: [28, -28, 58, -58, 88, -88] as const,
  dressMs: 450, sinkM: 0.7,
  inspectExitMs: 350,
  /**
   * Ground cover under a dressed arena (IMPLEMENTATION-NOTES Part 5, T1): grass / tufts / flowers are hidden inside
   * `coverHideM` (the ring, curb, posts and beacon pylons) and grow back by `coverOuterM`; small props (bushes, small
   * rocks, stumps, logs) and big rocks are hidden inside `propHideM` with a hard edge. Trees stay (the camera avoids
   * their crowns, H11).
   */
  coverHideM: 4.9, coverOuterM: 6.6, propHideM: 5.0,
  /**
   * Ground samples on the ring's rim and the curb's outer edge the arena is seated on. With a terrain pad (the zone is
   * loaded) the seat is the lowest that the 0.45 m skirt still closes on the downhill side (never above the highest
   * sample) and the pad cuts everything above it; without one the highest sample wins, capped by the skirt.
   */
  seatSamples: 24,
  /** M3 review R-forgewall-2: the terrain above the seat is levelled inside `padInnerM` (ring, curb, posts, pylons) and eases back by `padOuterM`. */
  padInnerM: 5.0, padOuterM: 7.0,
  /** Arenas whose ground cover is masked (main + 3 spectator arenas; 2 mask slots each, slots 0..7). */
  coverArenas: 4,
  /**
   * The evolution sequence's site (main-arena slots, free while undressed): grass hidden inside 1.3 m of the creature
   * (back by 2.3 m), small props inside 1.6 m, merged static props within 1.9 m of a point 1 m toward the camera.
   */
  evoCoverInnerM: 1.3, evoCoverOuterM: 2.3, evoPropHideM: 1.6, evoCutM: 1.9,
  /** Warm-up: the beacons render their shadow maps for the first N frames (the boot frame and the warm-group frame), from here. */
  warmShadowFrames: 2, warmShadowHeightM: 4, warmShadowBackM: 4,
  /**
   * Phase A halls (`dress(…, hall)`): the trainers stand this far from the centre (camera/battle.ts `trainerSlot`:
   * `TRAINER_SIDE_DEG` off the battle axis since the M3 review R-all-1; content `ARENA_SLOT_M`); everything keeps `hallMarginM`
   * (+ its own radius) from the hall's floor edge. The rope posts may pull in to `postMinScale` of their radius, the
   * pylons to `pylonMinRadius`, the spectators to `spectatorMinRadius`; what still does not fit is not shown.
   */
  trainerSlotM: TRAINER_SLOT_M, trainerR: 0.4, ringFitR: 4.0, hallMarginM: 0.1,
  postMinScale: 0.92, postR: 0.1, pylonMinRadius: 4.05, pylonR: 0.3, spectatorMinRadius: 4.9, spectatorR: 0.45, fitStep: 0.1,
  /**
   * Phase D6: the foot disc of a battler (the contact-shadow decal of a size-1 creature, `BILLBOARD.decalSizeM` / 2).
   * A doubles battler's feet stand hypot(BATTLER_SEPARATION / 2, SLOT_SPACING / 2) ≈ 2.89 m from the centre, so the disc
   * stays on the 3.5 m ring top; `fitCentre` checks the four discs against the hall floor.
   */
  battlerFootR: 0.55,
});

/** Ground-cover mask the stage writes (the zone's `ScatterMask`; IMPLEMENTATION-NOTES Part 5, T1). */
export interface GroundCoverMask {
  set(slot: number, x: number, z: number, inner: number, outer: number, floor: number, classes: number): void;
  clear(slot: number): void;
}
/** Static props inside a ring (the zone's merged prop meshes; stage/propCutaway.ts, M2-battle-8). */
export interface PropCutawayLike { hide(slot: number, x: number, z: number, r: number): void; restore(slot: number): void }
/** The level pad under a ring (the zone's terrain chunks; stage/terrainPad.ts, M3 review R-forgewall-2). */
export interface TerrainPadLike { level(slot: number, x: number, z: number, y: number, inner: number, outer: number): void; restore(slot: number): void }
/** `COVER` bits (zone/scatter.ts), repeated so the stage does not import the zone builder. */
const COVER_GROUND = 1; const COVER_SMALL = 2; const COVER_LARGE = 4;
/** Mask slots owned by the stage (the rest are the creature reveal's, stage/groundCover.ts). */
export const STAGE_COVER_SLOTS = 8;

/** "the biome's plaza stone" per battle terrain (cobble is the shared default). */
export const TERRAIN_SURFACE: Readonly<Record<Terrain, SurfaceId>> = Object.freeze({
  none: 'cobble', grove: 'cobble', cinder: 'cinder_basalt', salt: 'wet_rock', storm: 'wet_flagstone', marrow: 'marrow_sandstone',
  vesper: 'lichen_stone', forge: 'castle_granite', sky: 'cloud_stone', shrine: 'eclipse_stone', rift: 'void_floor',
});

/** Accent type per terrain when the zone's `accentType` was not supplied (`setAccentType`). */
export const TERRAIN_ACCENT: Readonly<Record<Terrain, TypeName>> = Object.freeze({
  none: 'Normal', grove: 'Grass', cinder: 'Fire', salt: 'Water', storm: 'Electric', marrow: 'Ground', vesper: 'Ghost', forge: 'Steel',
  sky: 'Flying', shrine: 'Psychic', rift: 'Cosmic',
});

// ---- deps ------------------------------------------------------------------------------------------------------------

/** Terrain queries the stage needs (the zone's `TerrainCollider` satisfies it). */
export interface StageGround {
  sample(x: number, z: number): number;
  normal?(x: number, z: number, out: Vector3): Vector3;
  /** Footprints / blockers (camera occluders): the evolution sequence picks a clear spot for the creature. */
  blocked?(x: number, z: number): boolean;
  /** What a creature may stand on (walkable, not blocked). */
  passable?(x: number, z: number): boolean;
  /** Phase D8: feet height with open water at its level (the zone collider); actors use it when present */
  surfaceY?(x: number, z: number): number;
  /** Phase D8: open water (a surfer stands here) */
  onWater?(x: number, z: number): boolean;
}

export interface StageDeps {
  readonly parent: Object3D;
  readonly sprites: BillboardPool;
  readonly vfx: VfxSystem;
  readonly rig: DioramaRig;
  readonly actors: CharacterPool;
  readonly materials: MaterialLibrary;
  readonly effects: () => EffectsFlags;
  readonly harvestLevel: () => HarvestLevel;
  readonly camera: PerspectiveCamera;
  readonly viewport: () => { readonly w: number; readonly h: number };
  /** Arena-local weather (host day cycle + precipitation). */
  readonly weather?: (w: WeatherKind) => void;
  /** The validated type colour table (colourblind modes) for the HUD's type badges (M2-battle-7). */
  readonly typeColors?: (t: Readonly<Record<TypeName, string>>) => void;
  /** Post exposure / vignette: the evolution sequence dims the world around the creature (restored exactly). */
  readonly post?: { readonly exposure: UniformNode<'float', number>; readonly vignette: UniformNode<'float', number> } | null;
}

interface Battler { readonly ref: BattlerRef; bb: CreatureBillboard; id: string; hpFrac: number }

interface Arena {
  readonly root: Group;
  readonly ring: Mesh;
  readonly curb: Mesh;
  readonly posts: Group;
  readonly pylons: Group;
  readonly center: Vector3;
  dressed: boolean;
  /** 0 = sunk/hidden … 1 = up. */
  rise: number;
  riseTarget: number;
  riseMs: number;
}

const _v = new Vector3();
const _w = new Vector3();
const _n = new Vector3();
const _fwd = new Vector3();
const DEG = Math.PI / 180;

function refKey(r: BattlerRef): string { return `${r.side}:${r.slot}`; }

const _fitOut: [number, number] = [0, 0];
const _slotOut: [number, number] = [0, 0];

/** Whether a disc of radius `r` at world (x, z) lies on the hall's floor rectangle. */
export function inHall(h: HallBounds, x: number, z: number, r: number): boolean {
  const dx = x - h.x; const dz = z - h.z;
  const c = Math.cos(h.yaw); const s = Math.sin(h.yaw);
  const lx = c * dx - s * dz; const lz = s * dx + c * dz;
  return Math.abs(lx) <= h.hw - r + 1e-9 && Math.abs(lz) <= h.hd - r + 1e-9;
}

/**
 * Phase A: the arena centre nearest (x, z) that keeps the ring (+ curb) and both trainer slots (`trainerSlot` for the
 * battle axis of diorama yaw `yaw`, point-symmetric about the centre) on the hall floor; per hall axis the feasible interval is intersected, and an
 * axis too short for all of them takes the interval's middle. World (x, z) into `out`.
 * Phase D6: the four doubles battler foot discs (±BATTLER_SEPARATION / 2 along the axis, ±SLOT_SPACING / 2 across it,
 * radius `battlerFootR`) are part of the need list. They lie inside the ring-fit disc (2.89 + 0.55 < 4.0), so they
 * never move the centre today; listing them keeps the guarantee if the ring or the spacing changes.
 */
export function fitCentre(h: HallBounds, x: number, z: number, yaw: number, out: [number, number]): [number, number] {
  const c = Math.cos(h.yaw); const s = Math.sin(h.yaw);
  const dx = x - h.x; const dz = z - h.z;
  let lx = c * dx - s * dz; let lz = s * dx + c * dz;
  const fx = -Math.sin(yaw); const fz = -Math.cos(yaw);                       // the battle axis (world) → hall local
  // the two trainer slots (point-symmetric about the centre), world offsets → hall local
  const t = trainerSlot(0, 0, fx, fz, 0, _slotOut);
  const ox = c * t[0] - s * t[1]; const oz = s * t[0] + c * t[1];
  const m = STAGE.hallMarginM;
  const need: (readonly [number, number, number])[] = [[0, 0, STAGE.ringFitR + m], [ox, oz, STAGE.trainerR + m], [-ox, -oz, STAGE.trainerR + m]];
  // Phase D6: the doubles battlers' feet (the battle axis and its right-hand normal, in hall local)
  const rx = Math.cos(yaw); const rz = -Math.sin(yaw);
  const ax = (c * fx - s * fz) * (BATTLER_SEPARATION / 2); const az = (s * fx + c * fz) * (BATTLER_SEPARATION / 2);
  const bx = (c * rx - s * rz) * (SLOT_SPACING / 2); const bz = (s * rx + c * rz) * (SLOT_SPACING / 2);
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) need.push([sa * ax + sb * bx, sa * az + sb * bz, STAGE.battlerFootR + m]);
  const fit = (v: number, half: number, axis: 0 | 1): number => {
    let lo = -Infinity; let hi = Infinity;
    for (const n of need) { lo = Math.max(lo, -half + n[2] - n[axis]); hi = Math.min(hi, half - n[2] - n[axis]); }
    return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
  };
  lx = fit(lx, h.hw, 0); lz = fit(lz, h.hd, 1);
  out[0] = h.x + c * lx + s * lz; out[1] = h.z - s * lx + c * lz;
  return out;
}

function sameFrame(a: SpriteDescriptor['front'], b: SpriteDescriptor['front']): boolean {
  return a.atlas === b.atlas && a.rect[0] === b.rect[0] && a.rect[1] === b.rect[1] && a.rect[2] === b.rect[2] && a.rect[3] === b.rect[3]
    && a.anim?.atlas === b.anim?.atlas;
}

/** Same sprite frames and size (variant / alpha may differ: those are uniform writes). */
function sameSprite(a: SpriteDescriptor, b: SpriteDescriptor): boolean {
  return a === b || (sameFrame(a.front, b.front) && sameFrame(a.back, b.back) && a.sizeScale === b.sizeScale && a.types[0] === b.types[0]);
}

// ---- geometry (built once; shared by every arena instance) ------------------------------------------------------------

function latheFrom(points: readonly (readonly [number, number])[], segments: number): LatheGeometry {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), segments);
}

/** Planar metre UVs (x, z) — library surfaces tile world-constant (IMPLEMENTATION-NOTES M3). */
function metreUvs(g: BufferGeometry): BufferGeometry {
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}

function ringGeometry(): BufferGeometry {
  const S = STAGE;
  const r = S.ringRadius;
  return metreUvs(latheFrom([[0.001, -S.ringSkirt], [r, -S.ringSkirt], [r, S.ringTop - S.ringChamfer], [r - S.ringChamfer, S.ringTop], [0.001, S.ringTop]], S.ringSegments));
}

function curbGeometry(): BufferGeometry {
  const S = STAGE;
  const c = S.ringChamfer;
  return metreUvs(latheFrom([
    [S.curbOuter, -S.ringSkirt], [S.curbOuter, S.curbHeight - c], [S.curbOuter - c, S.curbHeight], [S.curbInner + c, S.curbHeight],
    [S.curbInner, S.curbHeight - c], [S.curbInner, S.ringTop - 0.01],
  ], S.ringSegments));
}

function postGeometry(): BufferGeometry {
  const h = STAGE.postHeight;
  return latheFrom([[0.001, -0.2], [0.075, -0.2], [0.075, h - 0.08], [0.09, h - 0.05], [0.07, h], [0.001, h + 0.02]], 10);
}

function pylonGeometry(): BufferGeometry {
  const h = STAGE.beaconHeight;
  return latheFrom([[0.001, -0.2], [0.26, -0.2], [0.26, 0.12], [0.16, 0.2], [0.11, h - 0.35], [0.17, h - 0.3], [0.17, h - 0.26], [0.001, h - 0.26]], 12);
}

function housingGeometry(): BufferGeometry {
  const h = STAGE.beaconHeight;
  return latheFrom([[0.001, h - 0.26], [0.13, h - 0.24], [0.16, h - 0.1], [0.12, h + 0.02], [0.001, h + 0.05]], 8);
}

function capGeometry(): BufferGeometry {
  const h = STAGE.beaconHeight;
  return latheFrom([[0.001, h + 0.04], [0.2, h + 0.05], [0.05, h + 0.2], [0.001, h + 0.22]], 8);
}

/** Rope segments between adjacent posts: tubes along a sagging curve, merged per height into one geometry. */
function ropeGeometry(height: number): BufferGeometry {
  const S = STAGE;
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < S.postCount; i++) {
    const a0 = (i / S.postCount) * Math.PI * 2; const a1 = ((i + 1) / S.postCount) * Math.PI * 2;
    const p0 = new Vector3(Math.cos(a0) * S.postRadius, height, Math.sin(a0) * S.postRadius);
    const p1 = new Vector3(Math.cos(a1) * S.postRadius, height, Math.sin(a1) * S.postRadius);
    const mid = p0.clone().add(p1).multiplyScalar(0.5); mid.y -= S.ropeSag;
    parts.push(new TubeGeometry(new CatmullRomCurve3([p0, mid, p1]), 8, S.ropeRadius, 5, false).toNonIndexed());
  }
  let n = 0;
  for (const g of parts) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3); const nor = new Float32Array(n * 3); const uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    const P = g.getAttribute('position'); const N = g.getAttribute('normal'); const U = g.getAttribute('uv');
    for (let i = 0; i < P.count; i++, o++) {
      pos.set([P.getX(i), P.getY(i), P.getZ(i)], o * 3); nor.set([N.getX(i), N.getY(i), N.getZ(i)], o * 3);
      uv.set([U.getX(i) * 1.2, U.getY(i) * 0.15], o * 2);
    }
    g.dispose();
  }
  const out = new LatheGeometry([new Vector2(0, 0), new Vector2(0, 1)], 3);   // typed shell, attributes replaced below
  out.setIndex(null);
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nor, 3));
  out.setAttribute('uv', new BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

// ---- the stage ----------------------------------------------------------------------------------------------------------

export class Stage implements BattleStage {
  readonly root = new Group();
  /** Battle-form auras (`SpriteDescriptor.aura`): flames, a floor sigil and a rim glow per battler holding a form. */
  readonly aura: AuraSystem;
  readonly beaconLights: readonly SpotLight[];
  private readonly beaconTargets: readonly Object3D[];
  private readonly housingColor: UniformNode<'vec3', Vector3>;
  private readonly housingMaterial: MeshStandardNodeMaterial;
  private readonly geo: { ring: Map<SurfaceId, BufferGeometry>; curb: BufferGeometry; post: BufferGeometry; pylon: BufferGeometry; housing: BufferGeometry; cap: BufferGeometry; ropes: BufferGeometry[] };
  private readonly main: Arena;
  private readonly spectatorArenas: Arena[] = [];
  private readonly battlers = new Map<string, Battler>();
  private readonly battlerList: Battler[] = [];
  private readonly spectators: string[] = [];
  private inspected: CreatureBillboard | null = null;
  private terrain: Terrain = 'none';
  private accent: TypeName | null = null;
  private typeTable: Readonly<Record<TypeName, string>> = TYPE_COLORS;
  private ground: StageGround | null = null;
  private cover: GroundCoverMask | null = null;
  private cut: PropCutawayLike | null = null;
  private pad: TerrainPadLike | null = null;
  private hall: HallBounds | null = null;
  private beaconLevel = 0;         // 0..1 fade
  private beaconTarget = 0;
  private beaconFadeMs: number = STAGE.dressMs;
  private pulse = 0;
  private evo: EvolutionSequence | null = null;
  /** Frames the beacons still render their shadow maps for the step-8 warm-up (`armWarmupShadows`). */
  private warmShadowFrames = 0;
  private disposed = false;

  constructor(private readonly d: StageDeps) {
    this.root.name = 'ewa:arena';
    d.parent.add(this.root);
    this.aura = new AuraSystem({ parent: this.root, clock: d.vfx.clock, sizeScale: d.vfx.sizeScale });
    this.geo = {
      ring: new Map(), curb: curbGeometry(), post: postGeometry(), pylon: pylonGeometry(), housing: housingGeometry(), cap: capGeometry(),
      ropes: STAGE.ropeHeights.map((h) => ropeGeometry(h)),
    };
    paintSurfaceColor(this.geo.curb, 'stone_wall');
    paintSurfaceColor(this.geo.post, 'timber');
    paintSurfaceColor(this.geo.pylon, 'lantern_metal');
    paintSurfaceColor(this.geo.cap, 'lantern_metal');
    for (const r of this.geo.ropes) paintSurfaceColor(r, 'rope');
    paintSurfaceColor(this.geo.housing, 'glass_warm');

    this.housingColor = uniform(new Vector3(1, 1, 1));
    const hm = new MeshStandardNodeMaterial();
    const hl = uniform(0).setName('ewaBeaconHarvest');
    hm.colorNode = vec4(this.housingColor.mul(0.35), 1);
    hm.roughnessNode = float(0.2);
    hm.metalnessNode = float(0);
    hm.emissiveNode = this.housingColor.mul(STAGE.housingEmissive).mul(float(1).sub(hl.clamp(0, 2).div(2)));
    hm.name = 'ewa:beacon-housing';
    hm.userData = { ewaClass: 'emissive', ewaHousing: true, lightSource: true, harvest: hl };
    this.housingMaterial = hm;

    this.main = this.makeArena('ewa:arena-main');
    // the two reserved beacon lights (exist from construction; intensity 0 until dressed)
    const lights: SpotLight[] = []; const targets: Object3D[] = [];
    for (let i = 0; i < 2; i++) {
      const L = new SpotLight(0xffffff, 0, STAGE.beaconRange, STAGE.beaconAngle, STAGE.beaconPenumbra, STAGE.beaconDecay);
      L.castShadow = true;
      L.shadow.mapSize.set(STAGE.beaconShadowMap, STAGE.beaconShadowMap);
      L.shadow.bias = STAGE.beaconBias;
      L.shadow.normalBias = STAGE.beaconNormalBias;
      L.shadow.autoUpdate = false;
      L.name = `ewa:arena-beacon-light:${i}`;
      L.userData = { ewaLightId: `arena_beacon_${i}`, ewaLightKind: 'beacon', ewaReserved: true };
      const t = new Object3D();
      t.name = `ewa:arena-beacon-target:${i}`;
      L.target = t;
      this.root.add(L, t);   // always in a visible hierarchy: an invisible parent would drop the light from the light set (C13)
      lights.push(L); targets.push(t);
    }
    this.beaconLights = lights;
    this.beaconTargets = targets;
    this.refreshAccent();
    this.main.root.visible = false;
  }

  setGround(g: StageGround | null): void { this.ground = g; }

  /**
   * The loaded zone's ground-cover mask (null when no zone is loaded). A dressed arena hides the grass and small props
   * inside its ring through it — per-instance scale in the zone's instance buffers, never a rebuild (T1, Pillar 7).
   */
  setGroundCover(m: GroundCoverMask | null, cut: PropCutawayLike | null = null, pad: TerrainPadLike | null = null): void {
    if (m === this.cover && cut === this.cut && pad === this.pad) return;
    this.cover = m;
    this.cut = cut;
    this.pad = pad;
    if (m === null) return;
    this.coverArena(this.main, this.main.rise > 0 || this.main.dressed);
    this.spectatorArenas.forEach((a) => this.coverArena(a, a.rise > 0 || a.dressed));
  }
  /** The zone's `accentType` (gym beacon + arena ring colour); null = derive from the battle terrain. */
  setAccentType(t: TypeName | null): void { this.accent = t; this.refreshAccent(); }

  // ---- §10.7.5 -----------------------------------------------------------------------------------------------------

  dress(at: { readonly x: number; readonly z: number }, terrain: Terrain, participants: readonly string[], hall?: HallBounds): void {
    if (this.disposed) return;
    this.cancelEvolution();            // a battle owns the camera, the beacons and the VFX pool
    this.terrain = terrain;
    this.refreshAccent();
    const yaw = this.d.rig.dioramaYaw;
    // Phase A: inside a hall the ring centre is pulled in (if needed) so the ring and both trainer slots stay on the floor
    this.hall = hall ?? null;
    const c = this.hall !== null ? fitCentre(this.hall, at.x, at.z, yaw, _fitOut) : null;
    this.placeArena(this.main, c ? c[0] : at.x, c ? c[1] : at.z, terrain);
    // beacons: key lights from the audience (camera) side, ±40° off the view axis, aimed at the ring centre, so the
    // battlers' visible faces are lit (placed laterally they only grazed the cards and left them silhouetted at dusk)
    this.placePylons(this.main, yaw);
    if (this.hall !== null) this.fitToHall(this.main, this.hall);
    for (let i = 0; i < 2; i++) {
      const L = this.beaconLights[i]!;
      const c = this.main.center;
      const p = this.main.pylons.children[i * 3]!.position;
      L.position.set(c.x + p.x, c.y + STAGE.beaconHeight, c.z + p.z);
      this.beaconTargets[i]!.position.copy(c);
      L.shadow.autoUpdate = true;
    }
    this.beaconTarget = 1;
    this.beaconFadeMs = STAGE.dressMs;
    this.spawnSpectators(participants, this.main.center.x, this.main.center.z, yaw);
    this.d.rig.setCueTarget('attacker', this.main.center);
    this.d.rig.setCueTarget('defender', this.main.center);
  }

  dressSpectator(x: number, z: number): void {
    if (this.disposed) return;
    let a = this.spectatorArenas.find((s) => !s.dressed && s.rise <= 0);
    if (a === undefined) { a = this.makeArena(`ewa:arena-spectator:${this.spectatorArenas.length}`); this.spectatorArenas.push(a); }
    this.placeArena(a, x, z, this.terrain);
    this.placePylons(a, this.d.rig.dioramaYaw);
  }

  /** Beacon pylons at ±`beaconAzimuthDeg` from the toward-camera axis (3 meshes per pylon: body, housing, cap). */
  private placePylons(a: Arena, yaw: number): void {
    const tx = Math.sin(yaw); const tz = Math.cos(yaw);        // toward the camera
    const rx = Math.cos(yaw); const rz = -Math.sin(yaw);       // right
    const ca = Math.cos(STAGE.beaconAzimuthDeg * DEG); const sa = Math.sin(STAGE.beaconAzimuthDeg * DEG);
    a.pylons.children.forEach((p, i) => {
      const s = Math.floor(i / 3) === 0 ? 1 : -1;
      p.position.set((tx * ca + s * rx * sa) * STAGE.beaconRadius, 0, (tz * ca + s * rz * sa) * STAGE.beaconRadius);
    });
  }

  /**
   * Phase A: pulls the rope posts in (or hides those that still cross the hall's floor edge, and the ropes with them)
   * and walks each beacon pylon in along its bearing until it stands on the floor (else hides it). Transforms only.
   */
  private fitToHall(a: Arena, hall: HallBounds): void {
    const S = STAGE;
    const cx = a.center.x; const cz = a.center.z;
    const posts = a.posts.children;
    const postIn = (k: number, scale: number): boolean => {
      const ang = (k / S.postCount) * Math.PI * 2;
      return inHall(hall, cx + Math.cos(ang) * S.postRadius * scale, cz + Math.sin(ang) * S.postRadius * scale, S.postR + S.hallMarginM);
    };
    const allIn = (sc: number): boolean => { for (let k = 0; k < S.postCount; k++) if (!postIn(k, sc)) return false; return true; };
    let scale = 1;
    while (!allIn(scale) && scale - 0.02 >= S.postMinScale - 1e-9) scale -= 0.02;
    const fits = allIn(scale);
    if (!fits) scale = 1;
    a.posts.scale.set(scale, 1, scale);
    // ropes (children after the posts) only when every post stands
    for (let k = 0; k < posts.length; k++) posts[k]!.visible = k < S.postCount ? fits || postIn(k, scale) : fits;
    for (let i = 0; i < 2; i++) {
      const body = a.pylons.children[i * 3]!;
      const px = body.position.x; const pz = body.position.z;
      const r0 = Math.hypot(px, pz) || 1;
      let r = r0;
      while (r >= S.pylonMinRadius && !inHall(hall, cx + (px / r0) * r, cz + (pz / r0) * r, S.pylonR + S.hallMarginM)) r -= S.fitStep;
      const ok = r >= S.pylonMinRadius;
      for (let j = 0; j < 3; j++) {
        const o = a.pylons.children[i * 3 + j]!;
        if (ok) o.position.set((px / r0) * r, 0, (pz / r0) * r);
        o.visible = ok;
      }
    }
  }

  /**
   * Where trainer `side` stands (camera/battle.ts `trainerSlot`: beside and behind its battler, out of the battle
   * camera's ray to it — M3 review R-all-1): world xz into `out`, y = the arena centre's.
   */
  trainerSpot(side: 0 | 1, out: Vector3): Vector3 {
    forwardOfYaw(this.d.rig.dioramaYaw, _fwd);
    const c = this.main.center;
    const t = trainerSlot(c.x, c.z, _fwd.x, _fwd.z, side, _slotOut);
    return out.set(t[0], c.y, t[1]);
  }

  /** The hall the main arena was last dressed in (null = open ground). */
  get hallBounds(): HallBounds | null { return this.hall; }

  /** Extra: removes the spectator arena dressed nearest (x, z). */
  undressSpectator(x: number, z: number, ms: number = STAGE.dressMs): void {
    let best: Arena | null = null; let bd = Number.POSITIVE_INFINITY;
    for (const a of this.spectatorArenas) {
      if (!a.dressed) continue;
      const d = Math.hypot(a.center.x - x, a.center.z - z);
      if (d < bd) { bd = d; best = a; }
    }
    if (best !== null) this.sinkArena(best, ms);
  }

  undress(ms: number): void {
    if (this.main.dressed) {
      this.sinkArena(this.main, ms);
      this.beaconTarget = 0;
      this.beaconFadeMs = Math.max(1, ms);
      for (const b of this.battlerList) b.bb.dispose();
      this.battlers.clear();
      this.battlerList.length = 0;
      for (const id of this.spectators) this.d.actors.despawn(id);
      this.spectators.length = 0;
      this.d.vfx.clear();
      this.aura.clear();
      return;
    }
    for (const a of this.spectatorArenas) if (a.dressed) this.sinkArena(a, ms);
  }

  setBattler(ref: BattlerRef, desc: SpriteDescriptor | null): void {
    if (this.disposed) return;
    const key = refKey(ref);
    const have = this.battlers.get(key);
    if (desc === null) {
      if (have !== undefined) { have.bb.dispose(); this.battlers.delete(key); this.removeFromList(have); this.layoutSide(ref.side); }
      this.aura.set(key, null, null);
      return;
    }
    if (have !== undefined && have.id === desc.id && sameSprite(have.bb.descriptor, desc)) {
      // the same creature (the client rebuilds descriptor objects): keep the billboard, refresh the palette
      have.bb.setVariant(desc.variant, desc.isAlpha, desc.isShiny === true, desc.shinyPalette ?? null);
      this.aura.set(key, have.bb, desc.aura ?? null);
      return;
    }
    if (have !== undefined) { have.bb.dispose(); this.removeFromList(have); }
    const bb = this.d.sprites.acquire(desc);
    bb.setFacing(ref.side === 0 ? 'back' : 'front');
    bb.setSharp(true);                      // active battlers are DOF-sharp (Pillar 1)
    this.main.root.add(bb.object);
    const b: Battler = { ref: { side: ref.side, slot: ref.slot }, bb, id: desc.id, hpFrac: 1 };
    this.battlers.set(key, b);
    this.battlerList.push(b);
    this.layoutSide(ref.side);
    this.aura.set(key, bb, desc.aura ?? null);
  }

  setPose(ref: BattlerRef, pose: BattlerPose, ms: number): void {
    const b = this.battlers.get(refKey(ref));
    if (b === undefined) return;
    b.bb.setPose(pose, ms);
    if (pose === 'lunge' || pose === 'windup') this.d.rig.setCueTarget('attacker', b.bb.feet(_v));
    else if (pose === 'hurt' || pose === 'recoil') this.d.rig.setCueTarget('defender', b.bb.feet(_v));
    else if (pose === 'faint') this.d.rig.setCueTarget('ko', b.bb.feet(_v));
  }

  hurt(ref: BattlerRef, strength: number): void {
    const b = this.battlers.get(refKey(ref));
    if (b === undefined) return;
    b.bb.setHurt(strength);
    this.d.rig.setCueTarget('defender', b.bb.feet(_v));
  }

  faint(ref: BattlerRef, ms: number): void {
    const b = this.battlers.get(refKey(ref));
    if (b === undefined) return;
    b.bb.setPose('faint', ms);
    b.hpFrac = 0;
    this.aura.set(refKey(ref), null, null);   // a fainted battler's form is over
    this.d.rig.setCueTarget('ko', b.bb.feet(_v));
  }

  setWeather(w: WeatherKind): void { this.d.weather?.(w); }

  vfx(id: VfxId, from: BattlerRef | null, to: BattlerRef | null, ms: number, type?: TypeName): void {
    if (this.disposed) return;
    if (!isVfxId(id)) throw new RangeError(`@ewa/render: unknown VfxId '${String(id)}'`);
    const fb = from !== null ? this.battlers.get(refKey(from)) ?? null : null;
    const tb = to !== null ? this.battlers.get(refKey(to)) ?? null : null;
    const fa = fb !== null ? this.anchorOf(fb, this.anchorA) : null;
    const ta = tb !== null ? this.anchorOf(tb, this.anchorB) : null;
    const center = this.main.dressed ? this.main.center : this.d.rig.focus;
    const r = this.d.vfx.spawn(id, fa, ta, center, ms, type ?? null);
    if (fb !== null) this.d.rig.setCueTarget('attacker', fb.bb.feet(_v));
    if (tb !== null) { this.d.rig.setCueTarget('defender', tb.bb.feet(_v)); if (id === 'orb_throw') this.d.rig.setCueTarget('throw', tb.bb.feet(_v)); }
    if (r.flash > 0 && tb !== null) tb.bb.setHurt(r.flash);   // impact_crit: white flash on the target (hurt 1.0)
    if (r.beaconPulse > 0 && this.main.dressed) this.pulse = Math.max(this.pulse, r.beaconPulse);
  }

  prewarm(ids: readonly VfxId[]): void { this.d.vfx.prewarm(ids); }

  syncFrom(hp: readonly { readonly ref: BattlerRef; readonly hpFrac: number }[]): void {
    for (const e of hp) {
      const b = this.battlers.get(refKey(e.ref));
      if (b === undefined) continue;
      b.hpFrac = e.hpFrac;
      b.bb.setPose('idle', 0);
      b.bb.setFaint(e.hpFrac <= 0 ? 1 : 0);
      if (e.hpFrac <= 0) this.aura.set(refKey(e.ref), null, null);
    }
    this.d.vfx.clear();
  }

  setTypeColors(table: Readonly<Record<TypeName, string>>): void {
    this.typeTable = validateTypeColorTable(table);
    this.d.sprites.setTypeColors(this.typeTable);
    this.d.vfx.setTypeColors(this.typeTable);
    this.d.typeColors?.(this.typeTable);
    this.refreshAccent();
  }

  /** The inspector's billboard while `inspect` is active (the capture harness's sprite-edge scan reads its rect; E3). */
  get inspectedBillboard(): CreatureBillboard | null { return this.inspected; }

  inspect(desc: SpriteDescriptor | null): void {
    if (this.disposed) return;
    this.cancelEvolution();
    if (this.inspected !== null) { this.inspected.dispose(); this.inspected = null; }
    if (desc === null) { this.d.rig.release(STAGE.inspectExitMs); return; }
    const bb = this.d.sprites.acquire(desc);
    bb.setFacing('front');
    bb.setSharp(true);
    forwardOfYaw(this.d.rig.dioramaYaw, _fwd);
    const f = this.d.rig.focus;
    const x = f.x - _fwd.x * INSPECT_OFFSET; const z = f.z - _fwd.z * INSPECT_OFFSET;
    const y = this.groundAt(x, z);
    bb.setPosition(x, y, z);
    this.d.parent.add(bb.object);
    this.inspected = bb;
    _w.set(x, y + bb.heightM * INSPECT_AIM, z);
    this.d.rig.inspect(_w, STAGE.inspectExitMs);
  }

  /**
   * §10.7.5 evolution sequence (amended 2026-10-05; `stage/evolution.ts`): the creature appears beside the trainer under
   * the inspector camera, glows, alternates between its old and new silhouettes and is revealed in a light burst
   * (reduced effects: a gentle cross-fade). The caller plays it only after the server confirmed the evolution. A
   * running sequence is cancelled by a new one, `dress`, `inspect` and `dispose`.
   */
  evolve(r: EvolutionRequest): EvolutionHandle {
    this.cancelEvolution();
    if (this.disposed) return { phase: 'done', done: Promise.resolve('cancelled'), skip: () => undefined, cancel: () => undefined };
    if (this.inspected !== null) { this.inspected.dispose(); this.inspected = null; }   // the sequence takes the inspector shot over
    // a main arena still sinking after a battle goes at once: the sequence borrows its beacon and its ground-cover slots
    if (!this.main.dressed && this.main.rise > 0) { this.main.rise = 0; this.main.riseTarget = 0; this.hideArena(this.main); }
    if (!this.main.dressed) { this.beaconLevel = 0; this.beaconTarget = 0; }
    const g = this.ground;
    const seq = new EvolutionSequence({
      sprites: this.d.sprites, vfx: this.d.vfx, rig: this.d.rig, actors: this.d.actors, parent: this.d.parent,
      light: this.beaconLights[0]!, lightTarget: this.beaconTargets[0]!, ground: (x, z) => this.groundAt(x, z), effects: this.d.effects,
      post: this.d.post ?? null,
      occluded: g !== null && g.blocked !== undefined ? (x, z) => g.blocked!(x, z) : null,
      standable: g !== null && g.passable !== undefined ? (x, z) => g.passable!(x, z) : null,
      clearSite: (on, x, z, cx, cz) => this.evolutionSite(on, x, z, cx, cz),
    }, r);
    this.evo = seq;
    return seq;
  }

  /** The running evolution sequence (null when none). */
  get evolution(): EvolutionSequence | null { return this.evo !== null && !this.evo.isFinished ? this.evo : null; }

  /**
   * The evolution sequence's site (the main arena's two ground-cover slots and prop-cutaway slot, free while no battle
   * is dressed): grass and small props around the creature, and merged static props between it and the camera.
   */
  private evolutionSite(on: boolean, x: number, z: number, cx: number, cz: number): void {
    const m = this.cover;
    if (!on) { m?.clear(0); m?.clear(1); this.cut?.restore(0); return; }
    if (this.main.dressed) return;
    m?.set(0, x, z, STAGE.evoCoverInnerM, STAGE.evoCoverOuterM, 0, COVER_GROUND);
    m?.set(1, x, z, STAGE.evoPropHideM, STAGE.evoPropHideM + 0.05, 0, COVER_SMALL | COVER_LARGE);
    this.cut?.hide(0, cx, cz, STAGE.evoCutM);
  }

  private cancelEvolution(): void {
    if (this.evo === null) return;
    this.evo.cancel();
    this.evo = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancelEvolution();
    this.disposed = true;
    this.aura.dispose();
    for (const b of this.battlerList) b.bb.dispose();
    this.battlers.clear(); this.battlerList.length = 0;
    this.inspected?.dispose(); this.inspected = null;
    for (const id of this.spectators) this.d.actors.despawn(id);
    this.spectators.length = 0;
    this.coverArena(this.main, false);
    this.spectatorArenas.forEach((a) => this.coverArena(a, false));
    this.cover = null;
    this.cut = null;
    for (const L of this.beaconLights) { L.removeFromParent(); L.dispose(); }
    this.root.removeFromParent();
    for (const g of this.geo.ring.values()) g.dispose();
    this.geo.curb.dispose(); this.geo.post.dispose(); this.geo.pylon.dispose(); this.geo.housing.dispose(); this.geo.cap.dispose();
    for (const r of this.geo.ropes) r.dispose();
    this.housingMaterial.dispose();   // the stage's own material; library materials are never disposed here (§10.0.3 rule 3)
  }

  // ---- frame hook + HUD anchors --------------------------------------------------------------------------------------

  /** Per frame: arena rise/sink, beacon fade + pulse, harvest. Zero allocation. */
  update(dtScaledMs: number, dtRealMs: number): void {
    if (this.disposed) return;
    this.stepArena(this.main, dtRealMs);
    for (let i = 0; i < this.spectatorArenas.length; i++) this.stepArena(this.spectatorArenas[i]!, dtRealMs);
    const k = Math.min(1, dtRealMs / Math.max(1, this.beaconFadeMs));
    this.beaconLevel += (this.beaconTarget > this.beaconLevel ? 1 : -1) * Math.min(Math.abs(this.beaconTarget - this.beaconLevel), k);
    this.pulse = Math.max(0, this.pulse - dtScaledMs / STAGE.pulseMs);
    const harvest = this.d.harvestLevel();
    const on = harvest < 2 ? 1 : 0;
    const I = STAGE.beaconIntensity * this.beaconLevel * (1 + this.pulse * STAGE.pulseGain) * on;
    for (let i = 0; i < this.beaconLights.length; i++) {
      const L = this.beaconLights[i]!;
      L.intensity = I;
      if (this.beaconLevel <= 0 && this.beaconTarget === 0) L.shadow.autoUpdate = this.warmShadowFrames > 0;
    }
    if (this.warmShadowFrames > 0) this.warmShadowFrames--;
    this.aura.update(dtScaledMs, dtRealMs, this.d.camera);
    (this.housingMaterial.userData.harvest as UniformNode<'float', number>).value = harvest;
    // the evolution sequence borrows beacon 0 (written after the arena's own beacon values) and restores it at its end
    if (this.evo !== null) {
      this.evo.update(dtRealMs);
      if (this.evo.isFinished) this.evo = null;
    }
  }

  /** Projects battler `ref`'s sprite top to CSS px (HUD bar anchor). */
  projectBattler(ref: BattlerRef, out: Float32Array, offset = 0): boolean {
    const b = this.battlers.get(refKey(ref));
    if (b === undefined || b.bb.dissolve >= 1) return false;
    b.bb.topWorld(_v).project(this.d.camera);
    if (_v.z < -1 || _v.z > 1) return false;
    const vp = this.d.viewport();
    out[offset] = (_v.x * 0.5 + 0.5) * vp.w;
    out[offset + 1] = (-_v.y * 0.5 + 0.5) * vp.h;
    return true;
  }

  /**
   * §10.1.2 step 8: the two reserved beacons render their shadow maps (at intensity 0) during the warm-up frames,
   * aimed at the warm-up group, so the spot-shadow pass programs (the generic shadow material, the billboard's
   * positionNode / alpha-mask variant, skinned bodies) exist before the first battle or evolution needs them.
   */
  armWarmupShadows(): void {
    this.warmShadowFrames = STAGE.warmShadowFrames;
    for (let i = 0; i < this.beaconLights.length; i++) {
      this.beaconLights[i]!.position.set(0, STAGE.warmShadowHeightM, STAGE.warmShadowBackM);
      this.beaconTargets[i]!.position.set(0, 0, -1);
    }
  }

  /** A housing mesh for the renderer's warm-up frame (compiles the beacon housing material). */
  warmupHousing(): Mesh {
    const m = new Mesh(this.geo.housing, this.housingMaterial);
    m.name = 'ewa:beacon-housing-warmup';
    m.userData = { ewaCompileDeferred: true };      // T4: needed by a battle, not by a zone's first frame (background phase)
    return m;
  }

  get dressed(): boolean { return this.main.dressed; }
  get arenaCenter(): Readonly<Vector3> { return this.main.center; }
  get arenaRoot(): Group { return this.main.root; }
  battler(ref: BattlerRef): CreatureBillboard | null { return this.battlers.get(refKey(ref))?.bb ?? null; }
  get battlerCount(): number { return this.battlerList.length; }
  get spectatorIds(): readonly string[] { return this.spectators; }
  get spectatorArenaCount(): number { return this.spectatorArenas.filter((a) => a.dressed).length; }
  get beaconIntensity(): number { return this.beaconLights[0]?.intensity ?? 0; }
  /** Whether the beacon shadow maps are being rendered (false when undressed). */
  get beaconShadowsLive(): boolean { return this.beaconLights[0]?.shadow.autoUpdate ?? false; }

  // ---- internals ---------------------------------------------------------------------------------------------------

  private readonly anchorFeetA = new Vector3();
  private readonly anchorFeetB = new Vector3();
  private readonly anchorA: { feet: Vector3; height: number } = { feet: this.anchorFeetA, height: 1.6 };
  private readonly anchorB: { feet: Vector3; height: number } = { feet: this.anchorFeetB, height: 1.6 };

  private anchorOf(b: Battler, out: { feet: Vector3; height: number }): VfxAnchor {
    b.bb.feet(out.feet);
    out.height = b.bb.heightM;
    return out;
  }

  private groundAt(x: number, z: number): number {
    const y = this.ground?.sample(x, z) ?? 0;
    return Number.isFinite(y) ? y : 0;
  }

  private removeFromList(b: Battler): void {
    const i = this.battlerList.indexOf(b);
    if (i >= 0) this.battlerList.splice(i, 1);
  }

  /** Positions every battler of `side` (slot spread depends on how many the side holds). */
  private layoutSide(side: 0 | 1): void {
    let count = 0;
    for (const b of this.battlerList) if (b.ref.side === side) count = Math.max(count, b.ref.slot + 1);
    const yaw = this.d.rig.dioramaYaw;
    forwardOfYaw(yaw, _fwd);
    for (const b of this.battlerList) {
      if (b.ref.side !== side) continue;
      battlerSlot(this.main.center, yaw, side, b.ref.slot, count, _v);
      // relative to the arena root (the ring centre): the feet stand on the flat ring top and rise with the arena
      b.bb.setPosition(_v.x - this.main.center.x, STAGE.ringTop, _v.z - this.main.center.z);
      b.bb.setPoseAxis(side === 0 ? _fwd.x : -_fwd.x, side === 0 ? _fwd.z : -_fwd.z);
      b.bb.setGroundNormal(0, 1, 0);
    }
    // T2: the battle framing fits the tallest creature of each side above the DOM panel
    let near = 0; let far = 0;
    for (const b of this.battlerList) { if (b.ref.side === 0) near = Math.max(near, b.bb.heightM); else far = Math.max(far, b.bb.heightM); }
    this.d.rig.setBattleSubjects(near, far);
  }

  private spawnSpectators(participants: readonly string[], x: number, z: number, yaw: number): void {
    for (const id of this.spectators) this.d.actors.despawn(id);
    this.spectators.length = 0;
    forwardOfYaw(yaw, _fwd);
    const seed = participants.join('|');
    const hall = this.hall;
    STAGE.spectatorAnglesDeg.forEach((deg, i) => {
      const a = Math.atan2(_fwd.x, _fwd.z) + deg * DEG;   // the far half, fanned out
      let r: number = STAGE.spectatorRadius;
      // Phase A: in a hall a spectator steps in toward the ring until on the floor, or stays away
      if (hall !== null) {
        while (r >= STAGE.spectatorMinRadius && !inHall(hall, x + Math.sin(a) * r, z + Math.cos(a) * r, STAGE.spectatorR + STAGE.hallMarginM)) r -= STAGE.fitStep;
        if (r < STAGE.spectatorMinRadius) return;
      }
      const sx = x + Math.sin(a) * r; const sz = z + Math.cos(a) * r;
      const id = `ewa:spectator:${i}`;
      this.d.actors.spawn(id, { look: `spectator_${seed}_${i}`, name: '', guildTag: '', isLocal: false });
      this.d.actors.setTransform(id, sx, sz, Math.atan2(x - sx, z - sz), false, false);
      this.spectators.push(id);
    });
  }

  private makeArena(name: string): Arena {
    const root = new Group();
    root.name = name;
    const ring = new Mesh(this.ringFor('cobble'), this.d.materials.get('cobble'));
    ring.receiveShadow = true; ring.castShadow = false; ring.name = `${name}:ring`;
    const curb = new Mesh(this.geo.curb, this.d.materials.get('stone_wall'));
    curb.receiveShadow = true; curb.castShadow = true; curb.name = `${name}:curb`;
    const posts = new Group();
    posts.name = `${name}:posts`;
    const timber = this.d.materials.get('timber');
    for (let i = 0; i < STAGE.postCount; i++) {
      const a = (i / STAGE.postCount) * Math.PI * 2;
      const p = new Mesh(this.geo.post, timber);
      p.position.set(Math.cos(a) * STAGE.postRadius, 0, Math.sin(a) * STAGE.postRadius);
      p.castShadow = true; p.receiveShadow = true;
      posts.add(p);
    }
    const rope = this.d.materials.get('rope');
    for (const g of this.geo.ropes) { const m = new Mesh(g, rope); m.castShadow = true; m.receiveShadow = true; posts.add(m); }
    const pylons = new Group();
    pylons.name = `${name}:beacons`;
    const metal = this.d.materials.get('lantern_metal');
    for (let i = 0; i < 2; i++) {
      const body = new Mesh(this.geo.pylon, metal); body.castShadow = true; body.receiveShadow = true;
      const housing = new Mesh(this.geo.housing, this.housingMaterial as Material); housing.castShadow = false;
      const cap = new Mesh(this.geo.cap, metal); cap.castShadow = true;
      pylons.add(body, housing, cap);
    }
    root.add(ring, curb, posts, pylons);
    root.visible = false;
    this.root.add(root);
    return { root, ring, curb, posts, pylons, center: new Vector3(), dressed: false, rise: 0, riseTarget: 0, riseMs: STAGE.dressMs };
  }

  private ringFor(surface: SurfaceId): BufferGeometry {
    let g = this.geo.ring.get(surface);
    if (g === undefined) { g = ringGeometry(); paintSurfaceColor(g, surface); this.geo.ring.set(surface, g); }
    return g;
  }

  private placeArena(a: Arena, x: number, z: number, terrain: Terrain): void {
    // seated against the slope: the ring and the curb's outer edge are sampled. With the terrain pad (a zone is loaded)
    // the seat is the lowest the 0.45 m skirt still closes downhill and the pad levels the uphill side to it (M3 review
    // R-forgewall-2: capped at centre + skirt, the uphill terrain rose through the ring floor). Without a pad the
    // highest sample wins, capped by the skirt (the Part 5 rule).
    const c = this.groundAt(x, z);
    let hi = c; let lo = c;
    for (let k = 0; k < STAGE.seatSamples; k++) {
      const ang = (k / STAGE.seatSamples) * Math.PI * 2;
      for (const r of [STAGE.ringRadius, STAGE.curbOuter]) {
        const g = this.groundAt(x + Math.cos(ang) * r, z + Math.sin(ang) * r);
        hi = Math.max(hi, g); lo = Math.min(lo, g);
      }
    }
    const y = this.pad !== null ? Math.min(hi, lo + STAGE.ringSkirt - 0.05) : Math.min(hi, c + STAGE.ringSkirt - 0.05);
    a.center.set(x, y, z);
    const surface = TERRAIN_SURFACE[terrain];
    a.ring.geometry = this.ringFor(surface);
    a.ring.material = this.d.materials.get(surface);
    void this.d.materials.preload([surface, 'stone_wall', 'timber', 'rope', 'lantern_metal']).catch(() => undefined);
    a.posts.scale.set(1, 1, 1);
    for (const o of a.posts.children) o.visible = true;
    for (const o of a.pylons.children) o.visible = true;
    a.dressed = true;
    a.riseTarget = 1;
    a.riseMs = STAGE.dressMs;
    a.root.visible = true;
    a.root.position.set(x, y - STAGE.sinkM * (1 - a.rise), z);
    this.coverArena(a, true);
  }

  private sinkArena(a: Arena, ms: number): void {
    a.dressed = false;
    a.riseTarget = 0;
    a.riseMs = Math.max(1, ms);
  }

  private stepArena(a: Arena, dtMs: number): void {
    if (a.rise === a.riseTarget) { if (a.rise <= 0 && a.root.visible && !a.dressed) this.hideArena(a); return; }
    const k = dtMs / Math.max(1, a.riseMs);
    a.rise = a.riseTarget > a.rise ? Math.min(a.riseTarget, a.rise + k) : Math.max(a.riseTarget, a.rise - k);
    const e = a.rise * a.rise * (3 - 2 * a.rise);
    a.root.position.y = a.center.y - STAGE.sinkM * (1 - e);
    if (a.rise <= 0 && !a.dressed) this.hideArena(a);
  }

  /** The sunk arena disappears and the ground cover under it comes back (undress, T1). */
  private hideArena(a: Arena): void {
    a.root.visible = false;
    this.coverArena(a, false);
  }

  /** Writes (or clears) the two mask discs of arena `a`: ground cover eased at the ring's edge, props hidden inside. */
  private coverArena(a: Arena, on: boolean): void {
    const m = this.cover;
    if (m === null) return;
    const i = a === this.main ? 0 : this.spectatorArenas.indexOf(a) + 1;
    if (i < 0 || i >= STAGE.coverArenas) return;
    const s = i * 2;
    if (!on) { m.clear(s); m.clear(s + 1); this.cut?.restore(i); this.pad?.restore(i); return; }
    this.cut?.hide(i, a.center.x, a.center.z, STAGE.propHideM);
    this.pad?.level(i, a.center.x, a.center.z, a.center.y, STAGE.padInnerM, STAGE.padOuterM);
    m.set(s, a.center.x, a.center.z, STAGE.coverHideM, STAGE.coverOuterM, 0, COVER_GROUND);
    m.set(s + 1, a.center.x, a.center.z, STAGE.propHideM, STAGE.propHideM + 0.05, 0, COVER_SMALL | COVER_LARGE);
  }

  private refreshAccent(): void {
    const t = this.accent ?? TERRAIN_ACCENT[this.terrain];
    const c = hexToLinearInto(this.typeTable[t] ?? TYPE_COLORS[t], new Color());
    this.housingColor.value.set(c.r, c.g, c.b);
    // the housing glows the pure accent; the light it throws is tinted, not saturated, so creature colours read true
    const k = STAGE.beaconWhiteMix;
    for (const L of this.beaconLights ?? []) L.color.setRGB(c.r + (1 - c.r) * k, c.g + (1 - c.g) * k, c.b + (1 - c.b) * k);
  }
}
