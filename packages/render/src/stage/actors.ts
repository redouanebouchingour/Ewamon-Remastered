/**
 * SPEC §10.7.6 `ActorPool` and §10.7.7 characters (amended 2026-10-05): stylised 3D people — the KayKit
 * "Adventurers" set (`looks.ts`, `tools/model-pipeline`) — among 2D creature billboards.
 *
 * - Geometry: one `SkinnedMesh` per actor, cloned from its shape's template with `SkeletonUtils.clone` (own bones,
 *   the template's geometry shared per shape), at the manifest's one scale (a bare head at 1.55 m). A look may hold an
 *   accessory (mug, book, shield) parented to a hand-slot joint. Clones are recycled per shape on despawn.
 * - Material: ONE `'character'` material for every body and accessory (`characterMaterial.ts`); the look's atlas tile
 *   is the per-object `userData.ewaTile`, the DOF-sharp bit `userData.sharp`.
 * - Animation: one `AnimationMixer` per actor over the shared clips. Idle / walk / run are blended by the MEASURED
 *   ground speed and each gait clip plays at `speed / (clip ground speed × scale)` (the pipeline measures the planted
 *   toe), so planted feet move with the ground; emotes (spine §4.1) play a clip over the blend while standing.
 *   Facing is smoothed toward the actor's heading (shortest arc).
 * - Grounding: feet on the collider; one instanced contact decal for every actor (the §10.4.7 material) on the
 *   ground normal; real shadows from the nearest `shadowCasters` actors within `shadowRangeM` of the camera. Phase D8:
 *   on open water (`setGround`'s water probe: a surfer) the feet ride the sampler's water level and the contact decal
 *   gives way to an instanced ripple ring (two expanding rings, its own time uniform).
 * - LOD: beyond `accessoryRangeM` no accessory, beyond `shadowRangeM` no shadow, beyond `cullRangeM` hidden.
 * - Loading: while its shape (or the clips / atlas) loads an actor shows only its decal and nameplate; a look id the
 *   manifest lacks resolves to its base look, else to a deterministic base look (`resolveLook`).
 *
 * 48 rigs are preallocated (§10.7.6) and never grow; `setTransform` and `update` allocate nothing. Nameplates and emote
 * cards are the HUD's (§10.9), anchored at the head joint (`screenPositions` / `projectHead`).
 */
import {
  AnimationMixer, Bone, BufferAttribute, BufferGeometry, Euler, Group, InstancedMesh, LoopOnce, LoopRepeat, Matrix4, Mesh, MeshBasicNodeMaterial, PlaneGeometry,
  PropertyBinding, Quaternion, Skeleton, SkinnedMesh, Sphere, Vector3,
} from 'three/webgpu';
import type { AnimationAction, AnimationClip, MeshStandardNodeMaterial, Object3D, PerspectiveCamera, UniformNode } from 'three/webgpu';
import { abs, fract, length, oneMinus, smoothstep, uniform, uv, vec4 } from 'three/tsl';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { ActorDescriptor, ActorPool } from '../contracts.js';
import { LAYERS } from '../descriptors.js';
import { isDevBuild } from '../env.js';
import { createDecalMaterial, type BillboardUniforms } from '../sprites/billboard.js';
import { OVERLAY_ALPHA_CUT, overlayMrt } from '../sprites/overlayMrt.js';
import { BILLBOARD, hash01 } from '../sprites/tables.js';
import { createCharacterMaterial, type CharacterMaterial } from './characterMaterial.js';
import { resolveLook, type AccessoryTemplate, type CharacterSet, type CharacterSource, type LookRef, type ShapeTemplate } from './looks.js';

// ---- numbers ---------------------------------------------------------------------------------------------------

export const ACTOR_POOL_SIZE = 48;
export const EMOTE_MS = 2000;
/** Emote 7, the breakdance (client NPC-voice build, IMPLEMENTATION-NOTES "Breakdance"): longer than the 2 s cards. */
export const BREAKDANCE_EMOTE = 7;
export const BREAKDANCE_MS = 6000;
/** First person shows the emoting body headless (the eye sits in the head): the head joint's scale meanwhile. */
export const FP_HEADLESS_SCALE = 0.001;
/**
 * The emote wheel (IMPLEMENTATION-NOTES "Emote wheel"): 7 the breakdance, 8..14 high five, "you, me, battle", whip /
 * nae nae, dab, six seven, the bird, crying. Lengths match protocol `emoteLengthMs`.
 */
export const EMOTE_WHEEL_MS: readonly number[] = Object.freeze([0, EMOTE_MS, EMOTE_MS, EMOTE_MS, EMOTE_MS, EMOTE_MS, EMOTE_MS, BREAKDANCE_MS, 2600, 3400, 5200, 3000, 3600, 3600, 4200]);
/** How long an emote plays (ms). */
export function emoteMs(n: number): number {
  return EMOTE_WHEEL_MS[n] ?? EMOTE_MS;
}
/** Head-top anchor above the feet before a look resolves (m). */
export const HEAD_ANCHOR_M = 1.7;
export const CHARACTER = Object.freeze({
  /** A bare-headed character (the pipeline's CHARACTER_HEIGHT_M; the manifest's `heightM` wins). */
  heightM: 1.55,
  /** Nameplate / emote anchor: this much above the look's top (m). */
  headMarginM: 0.18,
  /** Contact decal diameter (m) (a creature's is `BILLBOARD.decalOfWidth` × its card width). */
  decalM: 0.85,
  /** Ground normal probe distance (m) for the decal. */
  normalProbeM: 0.3,
  /** Facing smoothing rate (1/s, exponential, shortest arc). */
  turnRate: 14,
  /** Idle / walk / run weight blend rate (1/s) and the emote fade rate (1/s). */
  gaitBlendRate: 10,
  emoteBlendRate: 8,
  /** Ground-speed smoothing time constant (s); a jump farther than `teleportM` in one update gives no speed. */
  speedTau: 0.1,
  teleportM: 3,
  /** Below this measured speed an actor stands (m/s). */
  standMps: 0.25,
  /** Walk → run blend band (m/s): the walk clip's natural speed is ≈ 0.55 m/s, the run's ≈ 2.3 m/s. */
  runFromMps: 1.1, runToMps: 1.7,
  /** Gait time-scale clamps (the clips stay readable at the protocol's 4.2 / 7 m/s: run × 1.8 / × 3.0). */
  walkScaleMax: 3.2, runScaleMax: 4,
  /** Shadow casters: the nearest N within the range (camera distance, m); accessories hidden beyond; culled beyond. */
  shadowCasters: 12,
  shadowRangeM: 45,
  accessoryRangeM: 45,
  cullRangeM: 140,
  /** Bounding sphere of a body in model units (centre y, radius), generous enough for every clip. */
  boundsCentreY: 1.1, boundsRadius: 1.75,
});

export type EmoteId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
/** spine §4.1: 1..6 = wave happy sad alert heart cool; 7.. = the emote wheel (not in the spine). */
export const EMOTE_NAMES: readonly string[] = Object.freeze([
  '', 'wave', 'happy', 'sad', 'alert', 'heart', 'cool', 'breakdance', 'highfive', 'battle', 'whip', 'dab', 'sixseven', 'bird', 'crying',
]);
/**
 * The clip each emote plays (§10.7.7). KayKit ships no wave and nothing downcast, so those two are procedural poses
 * over the idle (`EMOTE_POSES`): the right arm raised and waving, the head and chest bowed. Joy and the heart hop
 * (`cheer`), alert flinches, cool is the one-handed `use`.
 */
export const EMOTE_CLIPS: readonly (string | null)[] = Object.freeze([null, null, 'cheer', null, 'flinch', 'cheer', 'use', null, null, null, null, null, null, null, null]);
type EmotePose = 'wave' | 'bow' | 'breakdance' | 'highfive' | 'battle' | 'whip' | 'dab' | 'sixseven' | 'bird' | 'crying';
/** Procedural emotes (applied after the mixer, weighted by the emote fade). */
export const EMOTE_POSES: readonly (EmotePose | null)[] = Object.freeze([
  null, 'wave', null, 'bow', null, null, null, 'breakdance', 'highfive', 'battle', 'whip', 'dab', 'sixseven', 'bird', 'crying',
] as const);
/** Emotes that loop for their 2 s (the others play once and hold). */
const EMOTE_LOOPS: readonly boolean[] = Object.freeze([false, false, true, false, false, true, false, false]);
/** Procedural wave / bow numbers (root space: +x left, +y up, +z forward; radians, Hz). */
export const EMOTE_POSE = Object.freeze({
  /** Upper-arm direction of the wave (up and out to the right, a little forward). */
  waveUpper: Object.freeze([-0.84, 0.5, 0.18] as const),
  /** Forearm swing about vertical (rad) and rate (Hz). */
  waveSwing: 0.42, waveHz: 2.2,
  /** Bow: head and chest pitched forward (rad). */
  bowHead: 0.42, bowChest: 0.16,
});

/**
 * The breakdance (emote 7), all out, in seconds from its start: toprock (bouncing, arms pumping), windmill (body flat on
 * its side, spinning), headspin (upside down on the head), air flares (flips in the air) and a freeze. Heights (m),
 * spins (rev/s) and tilts (rad) apply to the actor root; the limbs are aimed in root space after the mixer.
 */
export const BREAKDANCE = Object.freeze({
  toprockEnd: 0.9, windmillEnd: 2.6, headspinEnd: 4.3, flaresEnd: 5.4,
  toprockHz: 3.2, toprockBounceM: 0.18, toprockSway: 0.3,
  windmillTilt: 1.35, windmillLiftM: 0.35, windmillRevS: 2.4,
  headspinLiftM: 1.5, headspinRevS: 3.6,
  flareHz: 2, flareJumpM: 0.95, flareRevS: 1.6,
  freezeTiltZ: 1.15, freezeTiltX: 0.35, freezeLiftM: 0.42,
  limbHz: 7,
});
/**
 * The wheel's silly ones (emotes 8..14), in seconds from their start. Directions are root space (+x left, +y up,
 * +z forward); a right-arm direction is mirrored (-x).
 */
export const SILLY = Object.freeze({
  /** High five: wind-up, the slap, the hold, then "OW OW OW" (hand flapping, hopping). */
  highFive: Object.freeze({ windEnd: 0.45, slapEnd: 0.6, holdEnd: 1.1, flapHz: 9, hopHz: 3, hopM: 0.14 }),
  /** You (point at the camera), me (thumbs at own chest), battle (boxing bob with alternating jabs). */
  battle: Object.freeze({ youEnd: 0.9, meEnd: 1.8, jabHz: 2.6, bobHz: 4, bobM: 0.08 }),
  /** Two whips (one per `whipS`), then the nae nae (hips swaying under a raised waving arm). */
  whip: Object.freeze({ whipEnd: 2.4, whipS: 1.2, naeHz: 1.1, waveHz: 2.2, bounceM: 0.06 }),
  /** Six snapping dabs (alternating sides), then one held, trembling with rage. */
  dab: Object.freeze({ count: 6, everyS: 0.32, snapS: 0.06, hopM: 0.16, finalHopM: 0.38, trembleHz: 23 }),
  /**
   * Six seven: palms up, the hands weighing "six" against "seven" faster and faster (`hzFrom` → `hzTo`) with shrugging
   * shoulders and a smug head wobble, then both arms flung up for the "SIX SEVEEEN" with a hip wiggle.
   */
  sixSeven: Object.freeze({ inEnd: 0.3, weighEnd: 2.9, hzFrom: 2, hzTo: 6, wiggleHz: 7 }),
  /**
   * The bird: the right fist out, the left hand cranking beside it like a music box while the finger "rises", the SNAP
   * up and a cocky hold, then the hands on the cheeks, peeking left and right (`peekHz`) with giggling shoulders.
   */
  bird: Object.freeze({ crankEnd: 1.3, crankHz: 2.4, popEnd: 1.45, holdEnd: 1.95, cheeksS: 0.25, peekHz: 0.9, peekRad: 0.75, giggleHz: 6 }),
  /** Crying: hands to the face, sobbing shoulders, and a wail (head thrown back, arms flung) every `wailEvery` s. */
  crying: Object.freeze({ faceEnd: 0.4, sobHz: 3.2, wailEvery: 1.3, wailS: 0.4 }),
});

/** Villagers dancing along: hop height (m) and rate (Hz). */
export const HOP = Object.freeze({ heightM: 0.28, hz: 2.4 });

/** Ground height sampler (the zone collider); flat 0 when unset. */
export type GroundSampler = (x: number, z: number) => number;
/** Phase D8: true on an open-water sample (the collider's `onWater`): the actor is surfing. */
export type WaterProbe = (x: number, z: number) => boolean;

/** Phase D8 ripple ring under a surfer (m, Hz, opacity). */
export const RIPPLE = Object.freeze({ sizeM: 1.6, hz: 0.7, width: 0.09, opacity: 0.55, liftM: 0.015 });

/**
 * Phase D8: two rings expanding from the centre and fading as they grow (time = `t` seconds). Additive white over the
 * water, depth-tested, no depth write; class 'decal' (no three-map audit). One program for every surfer.
 */
export function createRippleMaterial(t: UniformNode<'float', number>, harvestLevel: UniformNode<'float', number>): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial();
  const d = length(uv().sub(0.5)).mul(2);
  const h = harvestLevel.clamp(0, 2).div(2);
  const ring = (phase: number) => {
    const r = fract(t.mul(RIPPLE.hz).add(phase));
    return smoothstep(RIPPLE.width, 0, abs(d.sub(r))).mul(oneMinus(r));
  };
  m.colorNode = vec4(1, 1, 1, 1);
  m.opacityNode = ring(0).add(ring(0.5)).mul(RIPPLE.opacity).mul(oneMinus(h.mul(0.5)));
  m.transparent = true;
  m.depthWrite = false;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
  m.fog = false;
  m.mrtNode = overlayMrt(false);
  m.alphaTest = OVERLAY_ALPHA_CUT;
  m.name = 'ewa:surf-ripple';
  m.userData = { ewaClass: 'decal' };
  return m;
}

interface ActorUserData { sharp: number; ewaTile: number; ewaActor: string }
interface AccessoryUserData { sharp: number; ewaTile: number }

/** One cloned body (recycled per shape). */
interface Instance {
  readonly shape: string;
  readonly root: Object3D;
  readonly mesh: SkinnedMesh;
  readonly head: Object3D | null;
  readonly bones: ReadonlyMap<string, Object3D>;
  readonly mixer: AnimationMixer;
  readonly idle: AnimationAction | null;
  readonly walk: AnimationAction | null;
  readonly run: AnimationAction | null;
  /** By clip name. */
  readonly emotes: ReadonlyMap<string, AnimationAction>;
  /** Head joint y above the root in the bind pose (model units). */
  readonly headRestY: number;
  /** The head joint's bind-pose offset (model units) and rotation, both in root space (first person rides the head). */
  readonly headRest: Vector3;
  readonly headRestQ: Quaternion;
  /** The head joint is shrunk to `FP_HEADLESS_SCALE` (a first-person emote); restored before anyone else sees it. */
  headless: boolean;
}

interface Rig {
  readonly slot: number;
  readonly ud: ActorUserData;
  readonly accUd: AccessoryUserData;
  id: string | null;
  look: string;
  lookId: string | null;
  lookRef: LookRef | null;
  name: string;
  guildTag: string;
  isLocal: boolean;
  /** hidden by the client (the first-person view hides the player's own body) */
  hidden: boolean;
  readonly feet: Vector3;
  readonly groundN: Vector3;
  angle: number;
  yaw: number;
  hasYaw: boolean;
  moving: boolean;
  running: boolean;
  speed: number;
  lastX: number;
  lastZ: number;
  hasLast: boolean;
  idleW: number;
  walkW: number;
  runW: number;
  emote: EmoteId;
  emoteLeft: number;
  emoteW: number;
  /** hopping along to a breakdance (ms left) and the hop clock (s) */
  hopLeft: number;
  hopT: number;
  emoteAction: AnimationAction | null;
  inst: Instance | null;
  acc: Mesh | null;
  accId: string | null;
  dist2: number;
}

export interface ActorPoolOptions {
  readonly harvestLevel: UniformNode<'float', number>;
  readonly camera?: PerspectiveCamera;
  /** CSS viewport size for `screenPositions`. */
  readonly viewport?: () => { readonly w: number; readonly h: number };
  /** The KayKit set (`createGltfCharacterSource`); absent / null = no bodies (node tests: decals and anchors only). */
  readonly source?: CharacterSource | null;
  /** The sprite pool's uniforms (the decal material reads them); own ones when absent. */
  readonly uniforms?: BillboardUniforms;
  readonly warn?: (msg: string) => void;
}

const _p = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _v = new Vector3();
const _up = new Vector3(0, 1, 0);
const _qFlat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const ZERO_SCALE = new Matrix4().makeScale(0, 0, 0);
const TWO_PI = Math.PI * 2;

function wrapPi(a: number): number {
  let x = a % TWO_PI;
  if (x > Math.PI) x -= TWO_PI;
  else if (x <= -Math.PI) x += TWO_PI;
  return x;
}
const smooth01 = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export class CharacterPool implements ActorPool {
  readonly root = new Group();
  readonly material: MeshStandardNodeMaterial;
  readonly characterMaterial: CharacterMaterial;
  readonly uniforms: BillboardUniforms;
  /** Resolves true once the manifest, clips and atlas are bound (false without a source or on failure). */
  readonly ready: Promise<boolean>;
  private readonly source: CharacterSource | null;
  private readonly decalGeometry: PlaneGeometry;
  private readonly decalMaterial: MeshBasicNodeMaterial;
  private readonly decals: InstancedMesh;
  /** Phase D8: ripple rings under surfers (one instance slot per rig, zero-scaled off water) */
  private readonly rippleMaterial: MeshBasicNodeMaterial;
  private readonly ripples: InstancedMesh;
  private readonly rippleTime = uniform(0).setName('ewaRippleTime');
  private water: WaterProbe | null = null;
  private readonly wet = new Uint8Array(ACTOR_POOL_SIZE);
  /** Followers with field powers (§10.7.9): metres an actor's feet float above the ground (a glide), per slot */
  private readonly lift = new Float32Array(ACTOR_POOL_SIZE);
  private dirtyRipples = false;
  private readonly rigs: Rig[] = [];
  private readonly byId = new Map<string, Rig>();
  private set: CharacterSet | null = null;
  private clips: readonly AnimationClip[] = [];
  private readonly shapes = new Map<string, ShapeTemplate | null>();
  private readonly accessories = new Map<string, AccessoryTemplate | null>();
  private readonly pending = new Set<string>();
  private readonly freeInst = new Map<string, Instance[]>();
  private readonly freeAcc = new Map<string, Mesh[]>();
  private readonly order: number[] = [];
  private ground: GroundSampler | null = null;
  private camera: PerspectiveCamera | null;
  private readonly viewport: () => { readonly w: number; readonly h: number };
  private readonly warn: (msg: string) => void;
  private warm: Group | null = null;
  private dirtyDecals = false;
  private disposed = false;
  private shadowCount = 0;

  constructor(o: ActorPoolOptions) {
    this.root.name = 'ewa:actors';
    this.camera = o.camera ?? null;
    this.viewport = o.viewport ?? (() => ({ w: 1, h: 1 }));
    this.warn = o.warn ?? (() => undefined);
    this.uniforms = o.uniforms ?? {
      harvestLevel: o.harvestLevel,
      cameraYaw: uniform(0).setName('ewaCharYaw'),
      cameraLean: uniform(0).setName('ewaCharLean'),
      animTime: uniform(0).setName('ewaCharTime'),
    };
    this.characterMaterial = createCharacterMaterial(o.harvestLevel);
    this.material = this.characterMaterial.material;
    this.decalGeometry = new PlaneGeometry(1, 1);
    this.decalGeometry.name = 'ewa:character-decal';
    this.decalMaterial = createDecalMaterial(this.uniforms);
    this.decalMaterial.name = 'ewa:character-decal';
    this.decals = new InstancedMesh(this.decalGeometry, this.decalMaterial, ACTOR_POOL_SIZE);
    this.decals.name = 'ewa:character-decals';
    this.decals.userData = { shade: 1, ewaDecal: true };
    this.decals.renderOrder = BILLBOARD.decalRenderOrder;
    this.decals.layers.set(LAYERS.decals);
    this.decals.castShadow = false;
    this.decals.receiveShadow = false;
    this.decals.frustumCulled = false;
    for (let i = 0; i < ACTOR_POOL_SIZE; i++) this.decals.setMatrixAt(i, ZERO_SCALE);
    this.decals.count = 0;
    this.root.add(this.decals);
    this.rippleMaterial = createRippleMaterial(this.rippleTime, o.harvestLevel);
    this.ripples = new InstancedMesh(this.decalGeometry, this.rippleMaterial, ACTOR_POOL_SIZE);
    this.ripples.name = 'ewa:surf-ripples';
    this.ripples.userData = { ewaDecal: true };
    this.ripples.renderOrder = BILLBOARD.decalRenderOrder;
    this.ripples.layers.set(LAYERS.decals);
    this.ripples.castShadow = false;
    this.ripples.receiveShadow = false;
    this.ripples.frustumCulled = false;
    for (let i = 0; i < ACTOR_POOL_SIZE; i++) this.ripples.setMatrixAt(i, ZERO_SCALE);
    this.ripples.count = 0;
    this.root.add(this.ripples);
    for (let i = 0; i < ACTOR_POOL_SIZE; i++) { this.rigs.push(this.makeRig(i)); this.order.push(i); }

    this.source = o.source ?? null;
    const src = this.source;
    if (src === null) { this.ready = Promise.resolve(false); return; }
    const mat = this.characterMaterial;
    const warn = this.warn;
    this.ready = (async (): Promise<boolean> => {
      const set = await src.set();
      if (set === null || this.disposed) return false;
      const [clips, atlas] = await Promise.all([src.clips(), src.atlas()]);
      if (this.disposed) return false;
      if (atlas !== null) mat.setAtlas(atlas, set.atlas.columns, set.atlas.rows);
      else warn('character atlas unavailable: bodies draw the placeholder grey');
      this.set = set;
      this.clips = clips;
      for (const r of this.rigs) if (r.id !== null) this.bindLook(r);
      return true;
    })().catch((e: unknown) => { warn(`characters unavailable (${e instanceof Error ? e.message : String(e)})`); return false; });
  }

  /** `water` (Phase D8): the open-water probe; an actor on open water rides `g` (the surface level) with a ripple. */
  setGround(g: GroundSampler | null, water: WaterProbe | null = null): void {
    this.ground = g;
    this.water = water;
    for (const r of this.rigs) if (r.id !== null) this.place(r);
  }

  /** The ground the actors stand on at (x, z): the zone's surface (water level on open water); 0 without a zone. */
  groundAt(x: number, z: number): number {
    const g = this.ground;
    const y = g !== null ? g(x, z) : 0;
    return Number.isFinite(y) ? y : 0;
  }

  /**
   * Followers with field powers (§10.7.9): `id`'s feet float `m` metres above the ground (a glide off a cliff; 0 = on
   * the ground). The contact shadow stays on the ground; a lifted actor is no walker for the world effects (no dust
   * kicked up mid-air).
   */
  setLift(id: string, m: number): void {
    const r = this.byId.get(id);
    if (r === undefined) return;
    const v = Number.isFinite(m) && m > 0 ? m : 0;
    if (this.lift[r.slot] === v) return;
    this.lift[r.slot] = v;
    this.place(r);
  }

  /** `id`'s current `setLift` (m; 0 for an unknown id). */
  liftOf(id: string): number {
    const r = this.byId.get(id);
    return r === undefined ? 0 : this.lift[r.slot]!;
  }

  /** Phase D8: true while `id` stands on open water (tests, the client's ripple audio). */
  onWater(id: string): boolean {
    const r = this.byId.get(id);
    return r !== undefined && this.water !== null && this.water(r.feet.x, r.feet.z);
  }
  setCamera(c: PerspectiveCamera): void { this.camera = c; }

  // ---- §10.7.6 -------------------------------------------------------------------------------------------------

  spawn(id: string, d: ActorDescriptor): void {
    if (this.disposed) return;
    let r = this.byId.get(id);
    if (r === undefined) {
      r = this.rigs.find((x) => x.id === null);
      if (r === undefined) {
        const msg = `@ewa/render: ActorPool exhausted (${ACTOR_POOL_SIZE} rigs, §10.7.6)`;
        if (isDevBuild()) throw new RangeError(msg);
        console.error(msg);
        return;
      }
      r.id = id;
      this.byId.set(id, r);
      r.feet.set(0, 0, 0); r.groundN.set(0, 1, 0); r.angle = 0; r.yaw = 0; r.hasYaw = false; r.moving = false; r.running = false;
      r.speed = 0; r.hasLast = false; r.idleW = 1; r.walkW = 0; r.runW = 0; r.emote = 0; r.emoteLeft = 0; r.emoteW = 0; r.emoteAction = null;
      this.refreshCounts();
    }
    r.name = d.name; r.guildTag = d.guildTag; r.isLocal = d.isLocal; r.hidden = false;
    r.ud.sharp = d.isLocal ? 1 : 0;
    r.accUd.sharp = r.ud.sharp;
    r.ud.ewaActor = id;
    if (r.look !== d.look || r.lookRef === null) { r.look = d.look; this.bindLook(r); }
    this.place(r);
  }

  setTransform(id: string, x: number, z: number, angle: number, moving: boolean, running: boolean): void {
    const r = this.byId.get(id);
    if (r === undefined) return;
    r.feet.x = Number.isFinite(x) ? x : 0;
    r.feet.z = Number.isFinite(z) ? z : 0;
    r.angle = Number.isFinite(angle) ? angle : 0;
    if (!r.hasYaw) { r.yaw = r.angle; r.hasYaw = true; }
    r.moving = moving;
    r.running = running;
    this.place(r);
  }

  /** Hides (or shows again) one actor's body; its feet, decal and nameplate anchor stay. */
  setHidden(id: string, hidden: boolean): void {
    const r = this.byId.get(id);
    if (r !== undefined) r.hidden = hidden;
  }

  /** Hops the actor in place for `ms` (villagers dancing along to a breakdance); 0 stops. */
  setHop(id: string, ms: number): void {
    const r = this.byId.get(id);
    if (r === undefined) return;
    if (r.hopLeft <= 0) r.hopT = 0;
    r.hopLeft = Math.max(0, ms);
  }

  setEmote(id: string, n: EmoteId): void {
    const r = this.byId.get(id);
    if (r === undefined) return;
    r.emote = n;
    r.emoteLeft = n === 0 ? 0 : emoteMs(n);
    this.startEmote(r);
  }

  despawn(id: string): void {
    const r = this.byId.get(id);
    if (r === undefined) return;
    this.byId.delete(id);
    r.id = null;
    r.emote = 0; r.emoteLeft = 0; r.emoteW = 0; r.emoteAction = null;
    this.releaseAccessory(r);
    if (r.inst !== null) this.releaseInstance(r);
    r.lookRef = null; r.lookId = null; r.look = '';
    this.decals.setMatrixAt(r.slot, ZERO_SCALE);
    this.ripples.setMatrixAt(r.slot, ZERO_SCALE);
    this.wet[r.slot] = 0;
    this.lift[r.slot] = 0;
    this.dirtyDecals = true;
    this.dirtyRipples = true;
    this.refreshCounts();
  }

  feetOf(id: string, out: Vector3): Vector3 | null {
    const r = this.byId.get(id);
    return r === undefined ? null : out.copy(r.feet);
  }

  /** xy pairs (CSS px) of every live actor's head anchor, in pool-slot order; NaN when behind the camera. */
  screenPositions(out: Float32Array): number {
    let n = 0;
    for (let i = 0; i < this.rigs.length; i++) {
      const r = this.rigs[i]!;
      if (r.id === null) continue;
      if ((n + 1) * 2 > out.length) break;
      if (!this.projectAnchor(r, out, n * 2)) { out[n * 2] = Number.NaN; out[n * 2 + 1] = Number.NaN; }
      n++;
    }
    return n;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const r of this.rigs) { this.releaseAccessory(r); if (r.inst !== null) this.releaseInstance(r); r.id = null; }
    for (const list of this.freeInst.values()) for (const g of list) disposeInstance(g);
    this.freeInst.clear();
    this.freeAcc.clear();          // clones share the template geometry (disposed by the source) and the pool material
    this.byId.clear();
    this.source?.dispose();
    this.shapes.clear();
    this.accessories.clear();
    this.decals.removeFromParent();
    this.decals.dispose();
    this.ripples.removeFromParent();
    this.ripples.dispose();
    this.rippleMaterial.dispose();
    this.decalGeometry.dispose();
    this.decalMaterial.dispose();
    if (this.warm !== null) {
      this.warm.removeFromParent();
      this.warm.traverse((o) => {
        const m = o as SkinnedMesh;
        if (m.isMesh === true) m.geometry.dispose();
        if (m.isSkinnedMesh === true) m.skeleton.dispose();
      });
      this.warm = null;
    }
    this.characterMaterial.dispose();
    this.root.removeFromParent();
  }

  // ---- frame hook + extras ---------------------------------------------------------------------------------------

  /** Per frame (host step 3): speed, gait, facing, emotes, mixers, LOD and shadow casters. Zero allocation. */
  update(dtScaledMs: number): void {
    if (this.disposed) return;
    const dtMs = Number.isFinite(dtScaledMs) ? Math.max(0, dtScaledMs) : 0;
    const dt = dtMs / 1000;
    this.rippleTime.value = (this.rippleTime.value + dt) % 1000;
    const C = CHARACTER;
    const cam = this.camera;
    const kGait = 1 - Math.exp(-dt * C.gaitBlendRate);
    const kEmote = 1 - Math.exp(-dt * C.emoteBlendRate);
    const kTurn = 1 - Math.exp(-dt * C.turnRate);
    const kSpeed = dt > 0 ? 1 - Math.exp(-dt / C.speedTau) : 0;
    const set = this.set;
    const walkV = set !== null ? Math.max(0.05, set.animations.gaitSpeed.walk * set.scale) : 0.55;
    const runV = set !== null ? Math.max(0.05, set.animations.gaitSpeed.run * set.scale) : 2.3;
    for (let i = 0; i < this.rigs.length; i++) {
      const r = this.rigs[i]!;
      if (r.id === null) continue;
      // measured ground speed
      if (dt > 0) {
        if (r.hasLast) {
          const d = Math.hypot(r.feet.x - r.lastX, r.feet.z - r.lastZ);
          if (d < C.teleportM) r.speed += (d / dt - r.speed) * kSpeed;
        }
        r.lastX = r.feet.x; r.lastZ = r.feet.z; r.hasLast = true;
      }
      // the gait follows the MEASURED speed (feet must match the ground); the moving / running flags are hints only
      const locomote = r.speed > C.standMps;
      const s = r.speed;
      const runT = locomote ? smooth01(C.runFromMps, C.runToMps, s) : 0;
      r.idleW += ((locomote ? 0 : 1) - r.idleW) * kGait;
      r.walkW += ((locomote ? 1 - runT : 0) - r.walkW) * kGait;
      r.runW += ((locomote ? runT : 0) - r.runW) * kGait;
      // facing
      if (r.hasYaw) r.yaw = wrapPi(r.yaw + wrapPi(r.angle - r.yaw) * kTurn);
      // emote timer (an emote yields to walking)
      if (r.emoteLeft > 0) { r.emoteLeft = Math.max(0, r.emoteLeft - dtMs); if (r.emoteLeft === 0) r.emote = 0; }
      const emoting = r.emote !== 0 && r.emoteLeft > 0 && !locomote && (r.emoteAction !== null || EMOTE_POSES[r.emote] !== null);
      r.emoteW += ((emoting ? 1 : 0) - r.emoteW) * kEmote;
      // distance LOD
      r.dist2 = cam !== null ? cam.position.distanceToSquared(r.feet) : 0;
      const g = r.inst;
      if (g === null) continue;
      // a hidden body (first person) shows while it emotes, headless, so the player sees the hands move; it still poses
      // for the eye to ride its head (`emoteHead`)
      const fpEmote = r.hidden && r.emote !== 0 && r.emoteW > 0.002;
      const visible = (!r.hidden || fpEmote) && r.dist2 <= C.cullRangeM * C.cullRangeM;
      g.root.visible = visible;
      g.root.position.copy(r.feet);
      // x / z reset every frame: the breakdance tilts the root
      g.root.rotation.set(0, r.yaw, 0);
      if (r.hopLeft > 0) {
        r.hopLeft = Math.max(0, r.hopLeft - dtMs);
        r.hopT += dt;
        g.root.position.y += Math.abs(Math.sin(r.hopT * Math.PI * HOP.hz)) * HOP.heightM * Math.min(1, r.hopLeft / 250);
      }
      if (r.acc !== null) r.acc.visible = visible && r.dist2 <= C.accessoryRangeM * C.accessoryRangeM;
      if (!visible && !fpEmote) continue;
      // a clip emote replaces the gait; a procedural one (wave, bow) poses bones over it, so the gait keeps its full weight
      // (weights summing below 1 would blend the bind T-pose in)
      const base = r.emoteAction !== null ? 1 - r.emoteW : 1;
      const sum = Math.max(1e-6, r.idleW + r.walkW + r.runW);
      g.idle?.setEffectiveWeight((r.idleW / sum) * base);
      if (g.walk !== null) { g.walk.setEffectiveWeight((r.walkW / sum) * base); g.walk.setEffectiveTimeScale(Math.min(C.walkScaleMax, Math.max(0.4, s / walkV))); }
      if (g.run !== null) { g.run.setEffectiveWeight((r.runW / sum) * base); g.run.setEffectiveTimeScale(Math.min(C.runScaleMax, Math.max(0.4, s / runV))); }
      if (r.emoteAction !== null) r.emoteAction.setEffectiveWeight(r.emoteW);
      g.mixer.update(dt);
      if (r.emoteW > 0.002 && r.emote !== 0) {
        const pose = EMOTE_POSES[r.emote];
        const t = (emoteMs(r.emote) - r.emoteLeft) / 1000;
        if (pose === 'wave') this.poseWave(g, r.emoteW, t);
        else if (pose === 'bow') this.poseBow(g, r.emoteW);
        else if (pose === 'breakdance') this.poseBreakdance(g, r.emoteW, t);
        else if (pose === 'highfive') this.poseHighFive(g, r.emoteW, t);
        else if (pose === 'battle') this.poseBattle(g, r.emoteW, t);
        else if (pose === 'whip') this.poseWhip(g, r.emoteW, t);
        else if (pose === 'dab') this.poseDab(g, r.emoteW, t);
        else if (pose === 'sixseven') this.poseSixSeven(g, r.emoteW, t);
        else if (pose === 'bird') this.poseBird(g, r.emoteW, t);
        else if (pose === 'crying') this.poseCrying(g, r.emoteW, t);
      }
      // after the mixer (it skips a value that did not change, so the head's scale is restored here, not left to it)
      if (g.head !== null && fpEmote !== g.headless) { g.head.scale.setScalar(fpEmote ? FP_HEADLESS_SCALE : 1); g.headless = fpEmote; }
    }
    this.pickShadowCasters();
    if (this.dirtyDecals) { this.decals.instanceMatrix.needsUpdate = true; this.dirtyDecals = false; }
    if (this.dirtyRipples) { this.ripples.instanceMatrix.needsUpdate = true; this.dirtyRipples = false; }
  }

  /** Projects the head anchor of `id` to CSS px into `out[offset..offset+1]`; false when absent or behind the camera. */
  projectHead(id: string, out: Float32Array, offset = 0): boolean {
    const r = this.byId.get(id);
    return r !== undefined && this.projectAnchor(r, out, offset);
  }

  /** Live actor ids in slot order (the order `screenPositions` writes). */
  forEachLive(cb: (id: string, name: string, guildTag: string, emote: EmoteId, emoteT: number) => void): void {
    for (let i = 0; i < this.rigs.length; i++) { const r = this.rigs[i]!; if (r.id !== null) cb(r.id, r.name, r.guildTag, r.emote, r.emoteLeft / emoteMs(r.emote)); }
  }

  /**
   * World effects (§10.7.8): every live actor's slot, feet, ground normal, measured ground speed (m/s), facing and
   * squared camera distance, in slot order. The arguments are the rig's own vectors: read them, never keep them.
   */
  forEachWalker(visit: (slot: number, feet: Vector3, normal: Vector3, speed: number, yaw: number, dist2: number) => void): void {
    for (let i = 0; i < this.rigs.length; i++) {
      const r = this.rigs[i]!;
      if (r.id !== null && this.lift[r.slot]! < 0.2) visit(r.slot, r.feet, r.groundN, r.speed, r.yaw, r.dist2);
    }
  }

  /**
   * While the actor emotes: its head joint's world position, where that joint sits above the feet when upright
   * (world-sized, facing applied) and the head's rotation relative to its upright rest, eased in by the emote weight
   * (first person rides it). Returns that weight; 0 when not emoting. The camera updates before the pool, so this is
   * last frame's pose.
   */
  emoteHead(id: string, outHead: Vector3, outPivot: Vector3, outQ: Quaternion): number {
    const r = this.byId.get(id);
    const g = r?.inst ?? null;
    if (r === undefined || g === null || g.head === null || r.emote === 0 || r.emoteW <= 0.002) return 0;
    const w = Math.min(1, r.emoteW);
    g.head.getWorldPosition(outHead);
    _q.setFromAxisAngle(_up, r.yaw);
    outPivot.copy(g.headRest).multiplyScalar(g.root.scale.x).applyQuaternion(_q);
    // posed head × (upright head)⁻¹, the upright head being facing × bind rest
    g.head.getWorldQuaternion(outQ);
    outQ.multiply(_qd.copy(g.headRestQ).invert()).multiply(_q.invert());
    // (not `slerpQuaternions(identity, outQ, w)`: that copies the identity over its own target first)
    _qw.copy(outQ);
    outQ.identity().slerp(_qw, w);
    return w;
  }

  /** Current emote of an actor and its remaining fraction (0 = none). */
  emoteOf(id: string): { readonly n: EmoteId; readonly left: number } {
    const r = this.byId.get(id);
    return r === undefined ? { n: 0, left: 0 } : { n: r.emote, left: r.emoteLeft / emoteMs(r.emote) };
  }

  /**
   * The renderer's warm-up frame (§10.1.2 step 8): a 23-bone skinned body with the shipped GLBs' attribute formats
   * (int16 / uint16 normalized, uint8 joints and weights) and a rigid accessory, both on the character material and
   * casting shadows, so the beauty and shadow programs exist before the first character appears (never pooled).
   */
  warmupMesh(): Object3D {
    if (this.warm !== null) return this.warm;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Int16Array([0, 0, 0, 0, 16000, 0, 8000, 0, 0, 0, 0, 0]), 3, true));
    g.setAttribute('normal', new BufferAttribute(new Int16Array([0, 0, 32767, 0, 0, 32767, 0, 0, 32767, 0, 0, 32767]), 3, true));
    g.setAttribute('uv', new BufferAttribute(new Uint16Array([0, 0, 1000, 1000, 2000, 0, 0, 0]), 2, true));
    g.setAttribute('skinIndex', new BufferAttribute(new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]), 4));
    g.setAttribute('skinWeight', new BufferAttribute(new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0]), 4, true));
    g.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
    const bones: Bone[] = [];
    for (let i = 0; i < 23; i++) { const b = new Bone(); b.name = `warm${i}`; if (i > 0) { b.position.y = 0.05; bones[i - 1]!.add(b); } bones.push(b); }
    const body = new SkinnedMesh(g, this.material);
    body.add(bones[0]!);
    body.updateMatrixWorld(true);
    body.bind(new Skeleton(bones));
    body.castShadow = true;
    body.receiveShadow = true;
    body.layers.enable(LAYERS.dynamicShadow);
    body.frustumCulled = false;
    body.userData = { sharp: 1, ewaTile: 0, ewaActor: 'warmup' };
    body.name = 'ewa:actor-warmup';
    const ag = new BufferGeometry();
    ag.setAttribute('position', new BufferAttribute(new Int16Array([0, 0, 0, 0, 16000, 0, 8000, 0, 0]), 3, true));
    ag.setAttribute('normal', new BufferAttribute(new Int16Array([0, 0, 32767, 0, 0, 32767, 0, 0, 32767]), 3, true));
    ag.setAttribute('uv', new BufferAttribute(new Uint16Array([0, 0, 1000, 1000, 2000, 0]), 2, true));
    ag.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1));
    const acc = new Mesh(ag, this.material);
    acc.castShadow = true;
    acc.receiveShadow = true;
    acc.frustumCulled = false;
    acc.userData = { sharp: 0, ewaTile: 0 };
    acc.name = 'ewa:actor-warmup-accessory';
    acc.position.x = 0.4;
    const group = new Group();
    group.name = 'ewa:actor-warmup';
    group.add(body, acc);
    this.warm = group;
    return group;
  }

  has(id: string): boolean { return this.byId.has(id); }
  get liveCount(): number { return this.byId.size; }
  get capacity(): number { return this.rigs.length; }
  /** The instanced contact-decal mesh (one draw for every actor). */
  get decalMesh(): InstancedMesh { return this.decals; }
  /** Whether the character set (manifest, clips, atlas) is bound. */
  get setReady(): boolean { return this.set !== null; }
  /** The body an actor draws (null while its shape loads). */
  meshOf(id: string): SkinnedMesh | null { return this.byId.get(id)?.inst?.mesh ?? null; }
  /** The accessory an actor holds (null when none / beyond the LOD range is still the mesh, hidden). */
  accessoryOf(id: string): Mesh | null { return this.byId.get(id)?.acc ?? null; }
  /** Whether an actor's body is attached. */
  hasModel(id: string): boolean { return (this.byId.get(id)?.inst ?? null) !== null; }
  /** The resolved look an actor draws (`casual2_male:dusk`, a base look, or the hash pick), null before the manifest. */
  lookOf(id: string): string | null { return this.byId.get(id)?.lookId ?? null; }
  /** The actor's DOF-sharp bit (the local player: 1). */
  sharpOf(id: string): number { return this.byId.get(id)?.ud.sharp ?? 0; }
  /** Gait weights of an actor (sandbox, tests). */
  gaitOf(id: string): { readonly idle: number; readonly walk: number; readonly run: number; readonly emote: number; readonly speed: number; readonly yaw: number } | null {
    const r = this.byId.get(id);
    if (r === undefined) return null;
    const sum = Math.max(1e-6, r.idleW + r.walkW + r.runW);
    return { idle: r.idleW / sum, walk: r.walkW / sum, run: r.runW / sum, emote: r.emoteW, speed: r.speed, yaw: r.yaw };
  }
  /** Counts for the budget: live, attached bodies, visible bodies, shadow casters, visible accessories. */
  stats(): { readonly live: number; readonly bodies: number; readonly visible: number; readonly shadowCasters: number; readonly accessories: number } {
    let bodies = 0, visible = 0, acc = 0;
    for (const r of this.rigs) {
      if (r.id === null || r.inst === null) continue;
      bodies++;
      if (r.inst.root.visible) visible++;
      if (r.acc !== null && r.acc.visible && r.inst.root.visible) acc++;
    }
    return { live: this.byId.size, bodies, visible, shadowCasters: this.shadowCount, accessories: acc };
  }

  // ---- looks ------------------------------------------------------------------------------------------------------

  /** Resolves the rig's look and attaches its body (and accessory) when loaded, else requests them. */
  private bindLook(r: Rig): void {
    const set = this.set;
    if (set === null || r.id === null) return;
    const res = resolveLook(set, r.look);
    r.lookId = res.id;
    r.lookRef = res.look;
    r.ud.ewaTile = res.look.tile;
    r.accUd.ewaTile = res.look.accessoryTile ?? res.look.tile;
    if (r.inst !== null && r.inst.shape !== res.look.shape) { this.releaseAccessory(r); this.releaseInstance(r); }
    if (r.inst === null) {
      const t = this.shapes.get(res.look.shape);
      if (t === undefined) this.request('shape', res.look.shape);
      else if (t !== null) this.attachInstance(r, t);
    }
    if (r.inst !== null) {
      r.inst.root.scale.setScalar(res.look.scale);
      this.bindAccessory(r);
    }
  }

  private bindAccessory(r: Rig): void {
    const want = r.lookRef?.accessory ?? null;
    if (r.accId === want && (want === null || r.acc !== null)) return;
    this.releaseAccessory(r);
    if (want === null || r.inst === null) return;
    const t = this.accessories.get(want);
    if (t === undefined) { this.request('accessory', want); return; }
    if (t === null) return;
    const bone = r.inst.bones.get(PropertyBinding.sanitizeNodeName(t.bone));
    if (bone === undefined) { this.warn(`accessory '${want}': no joint ${t.bone}`); return; }
    const free = this.freeAcc.get(want);
    let m = free !== undefined && free.length > 0 ? free.pop()! : null;
    if (m === null) {
      // the template node carries the quantization transform (position / scale); the slot rotation turns it about the joint
      const item = t.mesh.clone();
      item.material = this.material;
      item.castShadow = false;
      item.receiveShadow = true;
      item.name = `ewa:accessory:${want}`;
      if (t.rotation) {
        // slot-frame rotation R on a node with the quantization T(p)·S: T(R·p)·R·S (the template has no rotation)
        const e = new Euler(t.rotation[0], t.rotation[1], t.rotation[2]);
        item.position.applyEuler(e);
        item.quaternion.setFromEuler(e).multiply(t.mesh.quaternion);
      }
      m = item;
    }
    m.userData = r.accUd as unknown as Record<string, unknown>;
    m.visible = true;
    bone.add(m);
    r.acc = m;
    r.accId = want;
  }

  private releaseAccessory(r: Rig): void {
    const m = r.acc;
    if (m !== null && r.accId !== null) {
      m.removeFromParent();
      let list = this.freeAcc.get(r.accId);
      if (list === undefined) { list = []; this.freeAcc.set(r.accId, list); }
      list.push(m);
    }
    r.acc = null;
    r.accId = null;
  }

  private request(kind: 'shape' | 'accessory', id: string): void {
    const key = `${kind}:${id}`;
    const src = this.source;
    if (src === null || this.pending.has(key)) return;
    this.pending.add(key);
    const done = (t: ShapeTemplate | AccessoryTemplate | null): void => {
      this.pending.delete(key);
      if (this.disposed) return;
      if (kind === 'shape') this.shapes.set(id, t as ShapeTemplate | null);
      else this.accessories.set(id, t as AccessoryTemplate | null);
      if (t === null) return;
      for (const r of this.rigs) if (r.id !== null && r.lookRef !== null) this.bindLook(r);
    };
    (kind === 'shape' ? src.shape(id) : src.accessory(id)).then(done, () => done(null));
  }

  private attachInstance(r: Rig, t: ShapeTemplate): void {
    const free = this.freeInst.get(t.id);
    const g = free !== undefined && free.length > 0 ? free.pop()! : this.createInstance(t);
    g.mesh.userData = r.ud as unknown as Record<string, unknown>;
    g.mesh.name = `ewa:actor:${r.id ?? ''}:${t.id}`;
    g.root.position.copy(r.feet);
    g.root.rotation.set(0, r.yaw, 0);
    g.root.visible = true;
    g.mixer.stopAllAction();
    g.idle?.reset().play();
    g.walk?.reset().play();
    g.run?.reset().play();
    // the cycle phase is per actor, so a crowd does not march in step
    const phase = hash01(r.id ?? '');
    if (g.walk !== null) g.walk.time = phase * g.walk.getClip().duration;
    if (g.run !== null) g.run.time = phase * g.run.getClip().duration;
    if (g.idle !== null) g.idle.time = phase * g.idle.getClip().duration;
    g.idle?.setEffectiveWeight(1); g.walk?.setEffectiveWeight(0); g.run?.setEffectiveWeight(0);
    if (g.root.parent !== this.root) this.root.add(g.root);
    r.inst = g;
    if (r.emote !== 0) this.startEmote(r);
  }

  private releaseInstance(r: Rig): void {
    const g = r.inst!;
    r.inst = null;
    r.emoteAction = null;
    g.mixer.stopAllAction();
    g.root.removeFromParent();
    g.root.visible = false;
    g.mesh.castShadow = false;
    let list = this.freeInst.get(g.shape);
    if (list === undefined) { list = []; this.freeInst.set(g.shape, list); }
    list.push(g);
  }

  private createInstance(t: ShapeTemplate): Instance {
    const root = cloneSkinned(t.scene);
    let mesh: SkinnedMesh | null = null;
    const bones = new Map<string, Object3D>();
    root.traverse((n) => {
      if ((n as SkinnedMesh).isSkinnedMesh === true && mesh === null) mesh = n as SkinnedMesh;
      else if ((n as Mesh).isMesh === true) n.visible = false;
      if ((n as Bone).isBone === true) bones.set(n.name, n);
    });
    if (mesh === null) throw new Error(`@ewa/render: shape '${t.id}' has no skinned mesh`);
    const m: SkinnedMesh = mesh;
    m.material = this.material;
    m.castShadow = false;
    m.receiveShadow = true;
    m.layers.enable(LAYERS.dynamicShadow);   // the sun's actor shadow map (lighting/sunShadow.ts)
    m.frustumCulled = true;
    m.boundingSphere = new Sphere(new Vector3(0, CHARACTER.boundsCentreY, 0), CHARACTER.boundsRadius);
    root.name = `ewa:actor-root:${t.id}`;
    const head = bones.get('head') ?? null;
    let headRestY = 1.24;
    const headRest = new Vector3(0, headRestY, 0);
    const headRestQ = new Quaternion();
    if (head !== null) {
      root.updateMatrixWorld(true);
      head.getWorldPosition(_v);
      root.getWorldPosition(_p);
      headRestY = _v.y - _p.y;
      root.worldToLocal(headRest.copy(_v));
      root.getWorldQuaternion(_q).invert();
      headRestQ.copy(_q).multiply(head.getWorldQuaternion(_qd));
    }
    const mixer = new AnimationMixer(root);
    const action = (name: string, loop: boolean): AnimationAction | null => {
      const clip = this.clips.find((c) => c.name === name);
      if (clip === undefined) return null;
      const a = mixer.clipAction(clip);
      a.enabled = true;
      a.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
      a.clampWhenFinished = !loop;
      a.setEffectiveWeight(0);
      return a;
    };
    const emotes = new Map<string, AnimationAction>();
    for (let e = 1; e < EMOTE_CLIPS.length; e++) {
      const name = EMOTE_CLIPS[e] ?? null;
      if (name === null || emotes.has(name)) continue;
      const a = action(name, false);
      if (a !== null) emotes.set(name, a);
    }
    return { shape: t.id, root, mesh: m, head, bones, mixer, idle: action('idle', true), walk: action('walk', true), run: action('run', true), emotes, headRestY, headRest, headRestQ, headless: false };
  }

  private startEmote(r: Rig): void {
    const g = r.inst;
    if (g === null) return;
    if (r.emoteAction !== null && r.emote === 0) { r.emoteAction = null; return; }
    const name = r.emote === 0 ? null : EMOTE_CLIPS[r.emote] ?? null;
    const a = name === null ? null : g.emotes.get(name) ?? null;
    if (r.emoteAction !== null && r.emoteAction !== a) r.emoteAction.setEffectiveWeight(0);
    r.emoteAction = a;
    if (a === null) return;
    const loop = EMOTE_LOOPS[r.emote] === true;
    a.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop;
    a.reset().play();
    a.setEffectiveWeight(r.emoteW);
  }

  // ---- procedural emotes (after the mixer; the mixer rewrites the bones next frame, so nothing accumulates) -------

  /** Wave: the right upper arm aimed up and out, the forearm swinging about vertical. Zero allocation. */
  private poseWave(g: Instance, w: number, t: number): void {
    const up = g.bones.get('upperarmr'), low = g.bones.get('lowerarmr'), hand = g.bones.get('handr');
    if (up === undefined || low === undefined || hand === undefined) return;
    const P = EMOTE_POSE;
    g.root.getWorldQuaternion(_qRoot);
    _t.set(P.waveUpper[0], P.waveUpper[1], P.waveUpper[2]).normalize();
    aimBone(up, low, _t.applyQuaternion(_qRoot), w);
    const s = Math.sin(t * Math.PI * 2 * P.waveHz) * P.waveSwing;
    _t.set(-0.2 + Math.sin(s), Math.cos(s), 0.12).normalize();
    aimBone(low, hand, _t.applyQuaternion(_qRoot), w);
  }

  /** Bow: head and chest pitched forward about the actor's right axis. */
  private poseBow(g: Instance, w: number): void {
    const head = g.bones.get('head'), chest = g.bones.get('chest');
    g.root.getWorldQuaternion(_qRoot);
    _t.set(1, 0, 0).applyQuaternion(_qRoot);
    if (chest !== undefined) tiltBone(chest, _t, EMOTE_POSE.bowChest * w);
    if (head !== undefined) tiltBone(head, _t, EMOTE_POSE.bowHead * w);
  }

  /**
   * Breakdance (emote 7): the root lifts, tilts and spins per phase (`BREAKDANCE`), the limbs flail in root space. The
   * mixer rewrites the bones and the frame start resets the root, so nothing accumulates. Zero allocation.
   */
  private poseBreakdance(g: Instance, w: number, t: number): void {
    const B = BREAKDANCE;
    const root = g.root;
    root.rotation.order = 'YXZ';
    const yaw = root.rotation.y;
    const TAU = Math.PI * 2;
    const f = Math.sin(t * TAU * B.limbHz);
    // arms (x: ±1 left / right), legs: root-space directions per phase
    let ax = 0.9, ay = 0.3, az = 0.2, lx = 0.25, ly = -1, lz = 0;
    if (t < B.toprockEnd) {
      const k = Math.sin(t * TAU * B.toprockHz);
      root.position.y += Math.abs(k) * B.toprockBounceM * w;
      root.rotation.set(0, yaw + k * B.toprockSway * w, k * 0.18 * w);
      ax = 0.5; ay = 0.6 + 0.5 * k; az = 0.5; lx = 0.3 + 0.2 * Math.abs(k); ly = -1; lz = 0.3 * k;
    } else if (t < B.windmillEnd) {
      root.position.y += B.windmillLiftM * w;
      root.rotation.set(0.25 * f * w, yaw + (t - B.toprockEnd) * TAU * B.windmillRevS * w, B.windmillTilt * w);
      ax = 1; ay = -0.1; az = 0.1 * f; lx = 0.9; ly = -0.25; lz = 0.6 * f;
    } else if (t < B.headspinEnd) {
      root.position.y += B.headspinLiftM * w;
      root.rotation.set(Math.PI * w, yaw + (t - B.windmillEnd) * TAU * B.headspinRevS * w, 0.12 * f * w);
      // upside down: root-space up is the ground — the hands brace, the legs open in a V to the sky
      ax = 0.45; ay = 1; az = 0.25; lx = 0.85; ly = -0.6; lz = 0.25 * f;
    } else if (t < B.flaresEnd) {
      const p = (t - B.headspinEnd) * B.flareHz;
      const hop = p - Math.floor(p);
      root.position.y += Math.sin(hop * Math.PI) * B.flareJumpM * w;
      root.rotation.set(hop * TAU * w, yaw + (t - B.headspinEnd) * TAU * B.flareRevS * w, 0.4 * f * w);
      ax = 1; ay = 0.4 * f; az = 0; lx = 1; ly = -0.3; lz = 0.4 * f;
    } else {
      root.position.y += B.freezeLiftM * w;
      root.rotation.set(B.freezeTiltX * w, yaw, B.freezeTiltZ * w);
      ax = 0.6; ay = 1; az = 0.1; lx = 0.7; ly = -0.4; lz = 0.6;
    }
    root.updateMatrixWorld(true);
    root.getWorldQuaternion(_qRoot);
    this.aimLimb(g, 'upperarml', 'lowerarml', ax, ay, az, w);
    this.aimLimb(g, 'upperarmr', 'lowerarmr', -ax, ay, -az, w);
    this.aimLimb(g, 'upperlegl', 'lowerlegl', lx, ly, lz, w);
    this.aimLimb(g, 'upperlegr', 'lowerlegr', -lx, ly, -lz, w);
  }

  // ---- the emote wheel's silly ones (8..14): root first, then chest / head turns, then limbs, all in root space ----

  /** Root lift (m), lean forward (rad, about x), extra yaw and roll (rad), all by the emote weight; then `_qRoot`. */
  private rootPose(g: Instance, w: number, liftM: number, lean: number, yaw: number, roll: number): void {
    const root = g.root;
    root.rotation.order = 'YXZ';
    root.position.y += liftM * w;
    root.rotation.set(lean * w, root.rotation.y + yaw * w, roll * w);
    root.updateMatrixWorld(true);
    root.getWorldQuaternion(_qRoot);
  }

  /** Turns a bone about a root-space axis (x: pitch forward, y: yaw to the left, z: roll to the right). */
  private turnBone(g: Instance, bone: string, x: number, y: number, z: number, angle: number): void {
    const b = g.bones.get(bone);
    if (b === undefined || angle === 0) return;
    _t.set(x, y, z).applyQuaternion(_qRoot);
    tiltBone(b, _t, angle);
  }

  /** One arm: the upper arm along (ux, uy, uz), the forearm along (fx, fy, fz); `side` 1 = left, -1 = right (x mirrored). */
  private arm(g: Instance, side: 1 | -1, ux: number, uy: number, uz: number, fx: number, fy: number, fz: number, w: number): void {
    const left = side === 1;
    this.aimLimb(g, left ? 'upperarml' : 'upperarmr', left ? 'lowerarml' : 'lowerarmr', ux * side, uy, uz, w);
    this.aimLimb(g, left ? 'lowerarml' : 'lowerarmr', left ? 'wristl' : 'wristr', fx * side, fy, fz, w);
  }

  /** High five (8): the wind-up, the SLAP, the proud hold, then the hand flapping in pain while hopping on one foot. */
  private poseHighFive(g: Instance, w: number, t: number): void {
    const H = SILLY.highFive;
    if (t < H.windEnd) {
      const k = ease(t / H.windEnd);
      this.rootPose(g, w, 0, -0.16 * k, 0.25 * k, 0);
      this.turnBone(g, 'head', 1, 0, 0, -0.2 * k * w);
      this.arm(g, -1, 0.45, 0.75, -0.45, 0.2, 0.6, -0.75, w);
    } else if (t < H.holdEnd) {
      const k = ease((t - H.windEnd) / (H.slapEnd - H.windEnd));
      const buzz = t > H.slapEnd ? Math.sin(t * 90) * 0.02 : 0;
      this.rootPose(g, w, 0.12 * Math.sin(Math.min(1, k) * Math.PI), 0.2 * k, 0.25 * (1 - k) + buzz, buzz);
      this.arm(g, -1, 0.25, 0.75, 0.6, 0.15, 0.85, 0.5, w);
    } else {
      const ph = t - H.holdEnd;
      const flap = Math.sin(ph * Math.PI * 2 * H.flapHz);
      this.rootPose(g, w, Math.abs(Math.sin(ph * Math.PI * H.hopHz)) * H.hopM, 0.1, 0.15 * Math.sin(ph * 5), 0.12 * Math.sin(ph * 7));
      this.turnBone(g, 'head', 1, 0, 0, -0.35 * w);
      this.turnBone(g, 'head', 0, 0, 1, 0.2 * Math.sin(ph * 11) * w);
      this.arm(g, -1, 0.55, -0.1, 0.8, 0.2 + 0.25 * flap, 0.6 * flap, 0.75, w);
      // the right leg pulled up: hopping on the left foot
      this.aimLimb(g, 'upperlegr', 'lowerlegr', -0.2, -0.45, 0.85, w);
      this.aimLimb(g, 'lowerlegr', 'footr', -0.1, -1, -0.15, w);
    }
    // the left hand on the hip throughout
    this.arm(g, 1, 0.75, -0.6, -0.1, -0.55, -0.45, 0.3, w);
  }

  /** "You, me, battle" (9): point at the camera, both thumbs at the own chest, then put 'em up and jab. */
  private poseBattle(g: Instance, w: number, t: number): void {
    const B = SILLY.battle;
    if (t < B.youEnd) {
      const poke = Math.max(0, Math.sin(t * Math.PI * 2 * 2.2)) * 0.12;
      this.rootPose(g, w, 0, 0.14 + poke, -0.1, 0);
      this.turnBone(g, 'head', 1, 0, 0, 0.12 * w);
      this.arm(g, -1, 0.15, 0.2, 1, 0.1, 0.25, 1, w);
      this.arm(g, 1, 0.3, -1, 0, 0.2, -1, 0.2, w);
    } else if (t < B.meEnd) {
      const k = (t - B.youEnd) / (B.meEnd - B.youEnd);
      this.rootPose(g, w, Math.sin(k * Math.PI) * 0.12, -0.2, 0, 0);
      this.turnBone(g, 'head', 1, 0, 0, -0.3 * w);
      this.arm(g, 1, 0.75, -0.2, 0.45, -0.7, 0.35, -0.55, w);
      this.arm(g, -1, 0.75, -0.2, 0.45, -0.7, 0.35, -0.55, w);
    } else {
      const ph = t - B.meEnd;
      const jab = Math.sin(ph * Math.PI * 2 * B.jabHz);
      const jl = Math.max(0, jab);
      const jr = Math.max(0, -jab);
      this.rootPose(g, w, Math.abs(Math.sin(ph * Math.PI * B.bobHz)) * B.bobM, 0.1, 0.18 * jab, 0.06 * jab);
      this.turnBone(g, 'head', 1, 0, 0, 0.15 * w);
      this.arm(g, 1, 0.35 - 0.2 * jl, -0.45 + 0.5 * jl, 0.6 + 0.4 * jl, 0.1, 0.85 - 0.75 * jl, 0.5 + 0.5 * jl, w);
      this.arm(g, -1, 0.35 - 0.2 * jr, -0.45 + 0.5 * jr, 0.6 + 0.4 * jr, 0.1, 0.85 - 0.75 * jr, 0.5 + 0.5 * jr, w);
      this.aimLimb(g, 'upperlegl', 'lowerlegl', 0.3, -1, 0.1, w);
      this.aimLimb(g, 'upperlegr', 'lowerlegr', -0.3, -1, -0.1, w);
    }
  }

  /** Whip / nae nae (10): two whips (the arm out, the forearm snapping across, a crouch), then the nae nae. */
  private poseWhip(g: Instance, w: number, t: number): void {
    const W = SILLY.whip;
    if (t < W.whipEnd) {
      const p = (t % W.whipS) / W.whipS;
      const snap = p < 0.4 ? 0 : p < 0.55 ? ease((p - 0.4) / 0.15) : 1 - ease((p - 0.55) / 0.45);
      this.rootPose(g, w, -0.04 * snap, 0.1 * snap, -0.4 * snap, -0.12 * snap);
      this.turnBone(g, 'head', 0, 1, 0, -0.35 * snap * w);
      this.arm(g, -1, 0.6 - 0.9 * snap, 0.15 + 0.15 * snap, 0.8, 0.6 - 1.1 * snap, 0.15 + 0.2 * snap, 0.8 - 0.3 * snap, w);
      this.arm(g, 1, 0.5, -0.65, 0.2, 0.1, -0.1, 1, w);
      this.aimLimb(g, 'upperlegl', 'lowerlegl', 0.25, -0.85, 0.45 * snap, w);
      this.aimLimb(g, 'lowerlegl', 'footl', 0.1, -1, -0.35 * snap, w);
    } else {
      const ph = t - W.whipEnd;
      const sway = Math.sin(ph * Math.PI * 2 * W.naeHz);
      const wave = Math.sin(ph * Math.PI * 2 * W.waveHz);
      this.rootPose(g, w, Math.abs(Math.sin(ph * Math.PI * 2 * W.naeHz)) * W.bounceM, 0.04, 0.28 * sway, 0.16 * sway);
      this.turnBone(g, 'chest', 0, 0, 1, -0.2 * sway * w);
      this.turnBone(g, 'head', 0, 0, 1, 0.25 * sway * w);
      this.arm(g, -1, 0.15, 1, 0.1, 0.15 + 0.4 * wave, 1, 0.15, w);
      this.arm(g, 1, 0.25, -1, 0.3 * sway, 0.2, -1, 0.4 + 0.3 * sway, w);
    }
  }

  /** DAB aggressively (11): six dabs snapping side to side, each with a hop, then one held and trembling with rage. */
  private poseDab(g: Instance, w: number, t: number): void {
    const D = SILLY.dab;
    const i = Math.min(D.count, Math.floor(t / D.everyS));
    const since = t - i * D.everyS;
    const side = i % 2 === 0 ? 1 : -1;
    const k = ease(Math.min(1, since / D.snapS));
    // the pose blends from the other side over the snap (the first dab from standing)
    const from = i === 0 ? 0 : -side;
    const s = from + (side - from) * k;
    const final = i >= D.count;
    const tremble = final ? Math.sin(t * Math.PI * 2 * D.trembleHz) * 0.05 : 0;
    const hop = Math.max(0, 1 - since / (final ? 0.35 : 0.2)) * (final ? D.finalHopM : D.hopM);
    this.rootPose(g, w, hop, 0.18 + tremble, 0.3 * s + tremble, -0.1 * s + tremble);
    this.turnBone(g, 'chest', 1, 0, 0, 0.2 * w);
    this.turnBone(g, 'head', 1, 0, 0, 0.55 * Math.abs(s) * w);
    this.turnBone(g, 'head', 0, 1, 0, 0.45 * s * w);
    // the far arm straight out and up toward the dab side; the near arm bent across the face, pointing the same way
    const far: 1 | -1 = s >= 0 ? 1 : -1;
    const a = Math.abs(s);
    this.arm(g, far, 0.85 * a + 0.3 * (1 - a), 0.5 * a - 0.9 * (1 - a), 0.15, 0.85 * a + 0.25 * (1 - a), 0.5 * a - 0.95 * (1 - a), 0.15, w);
    const near = (-far) as 1 | -1;
    this.arm(g, near, -0.55 * a + 0.3 * (1 - a), 0.45 * a - 0.9 * (1 - a), 0.7 * a, -0.9 * a + 0.25 * (1 - a), 0.45 * a - 0.95 * (1 - a), -0.1 * a, w);
  }

  /** Six seven (12): palms up, weighing six against seven ever faster, shrugging; then arms up for the SIX SEVEEEN. */
  private poseSixSeven(g: Instance, w: number, t: number): void {
    const S = SILLY.sixSeven;
    if (t < S.weighEnd) {
      const k = ease(Math.min(1, t / S.inEnd));
      // the weighing speeds up: phase is the integral of a rate ramping from hzFrom to hzTo
      const u = Math.max(0, t - S.inEnd), span = S.weighEnd - S.inEnd;
      const s = Math.sin(Math.PI * 2 * (S.hzFrom * u + ((S.hzTo - S.hzFrom) * u * u) / (2 * span))) * k;
      this.rootPose(g, w, Math.abs(s) * 0.05, 0.08 * k, 0.16 * s, 0.05 * s);
      this.turnBone(g, 'chest', 0, 0, 1, 0.14 * s * w);
      this.turnBone(g, 'head', 0, 0, 1, -0.28 * s * w);
      this.turnBone(g, 'head', 1, 0, 0, -0.12 * k * w);
      // upper arms down and a little forward, forearms forward with the palms up, bobbing in turn
      this.arm(g, 1, 0.3, -0.85 + 0.3 * k, 0.35 * k, 0.2, -1 + (1 + 0.5 * s) * k, k, w);
      this.arm(g, -1, 0.3, -0.85 + 0.3 * k, 0.35 * k, 0.2, -1 + (1 - 0.5 * s) * k, k, w);
      this.aimLimb(g, 'upperlegl', 'lowerlegl', 0.2, -1, 0.15 * Math.abs(s), w);
      this.aimLimb(g, 'upperlegr', 'lowerlegr', -0.2, -1, 0.15 * Math.abs(s), w);
    } else {
      const u = t - S.weighEnd;
      const k = ease(Math.min(1, u / 0.15));
      const wig = Math.sin(u * Math.PI * 2 * S.wiggleHz);
      this.rootPose(g, w, Math.sin(Math.min(1, u / 0.35) * Math.PI) * 0.3, -0.25 * k, 0.22 * wig * k, 0.1 * wig * k);
      this.turnBone(g, 'chest', 1, 0, 0, -0.15 * k * w);
      this.turnBone(g, 'head', 1, 0, 0, -0.45 * k * w);
      this.turnBone(g, 'head', 0, 0, 1, 0.15 * wig * w);
      this.arm(g, 1, 0.65, 0.7 * k - 0.3 * (1 - k), 0.15, 0.6, 0.8 * k, 0.2, w);
      this.arm(g, -1, 0.65, 0.7 * k - 0.3 * (1 - k), 0.15, 0.6, 0.8 * k, 0.2, w);
    }
  }

  /** The bird (13): crank the music box, the finger SNAPS up, then hands on the cheeks, peeking around naughtily. */
  private poseBird(g: Instance, w: number, t: number): void {
    const B = SILLY.bird;
    // the right arm thrust at the camera, the fist (the finger) up: the forearm rises with the crank, then snaps up
    const fist = (rise: number, push: number): void => {
      this.arm(g, -1, 0.2, -0.3 + 0.35 * rise, 0.9 + push, 0.05, -0.1 + 1.1 * rise, 1 - 0.75 * rise, w);
    };
    if (t < B.crankEnd) {
      const c = t * Math.PI * 2 * B.crankHz;
      const rise = 0.35 * (t / B.crankEnd);
      this.rootPose(g, w, Math.abs(Math.sin(c)) * 0.03, 0.12, -0.15, 0);
      this.turnBone(g, 'head', 1, 0, 0, 0.3 * w);
      this.turnBone(g, 'head', 0, 0, 1, 0.18 * w);
      fist(rise, 0);
      // the left hand turns a crank beside the right fist
      this.arm(g, 1, 0.05, -0.45, 0.9, -0.45 + 0.3 * Math.cos(c), 0.35 * Math.sin(c), 0.75, w);
    } else if (t < B.holdEnd) {
      // the snap up, then held there with the head cocked
      const k = ease(Math.min(1, (t - B.crankEnd) / (B.popEnd - B.crankEnd)));
      this.rootPose(g, w, 0, 0.12 + 0.06 * k, -0.15 * (1 - k), 0.06 * k);
      this.turnBone(g, 'head', 1, 0, 0, (0.3 - 0.4 * k) * w);
      this.turnBone(g, 'head', 0, 0, 1, (0.18 + 0.12 * k) * w);
      fist(0.35 + 0.65 * k, 0.15 * k);
      this.arm(g, 1, 0.6, -0.5 - 0.3 * k, 0.3 - 0.2 * k, 0.5, -0.6, 0.3, w);
    } else {
      // hands on the cheeks, hunched and giggling, peeking left and right: did anybody see that?
      const u = t - B.holdEnd;
      const k = ease(Math.min(1, u / B.cheeksS));
      const peek = Math.sin(u * Math.PI * 2 * B.peekHz) * k;
      const giggle = Math.sin(u * Math.PI * 2 * B.giggleHz) * k;
      this.rootPose(g, w, Math.abs(giggle) * 0.025 - 0.04 * k, 0.16 * k, 0.12 * peek, 0.06 * peek);
      this.turnBone(g, 'chest', 1, 0, 0, (0.12 + 0.04 * giggle) * k * w);
      this.turnBone(g, 'head', 0, 1, 0, B.peekRad * peek * w);
      this.turnBone(g, 'head', 1, 0, 0, 0.12 * k * w);
      this.turnBone(g, 'head', 0, 0, 1, -0.15 * peek * w);
      // blend from the bird / dangling arm to both palms on the cheeks
      const ux = 0.45, uy = -0.55 + 0.05 * giggle, uz = 0.55, fx = -0.4, fy = 0.85, fz = 0.25;
      this.arm(g, -1, 0.2 + (ux - 0.2) * k, 0.05 + (uy - 0.05) * k, 1.05 + (uz - 1.05) * k, 0.05 + (fx - 0.05) * k, 1 + (fy - 1) * k, 0.25, w);
      this.arm(g, 1, 0.6 + (ux - 0.6) * k, -0.8 + (uy + 0.8) * k, 0.1 + (uz - 0.1) * k, 0.5 + (fx - 0.5) * k, -0.6 + (fy + 0.6) * k, 0.3 + (fz - 0.3) * k, w);
    }
  }

  /** Crying (14): hands to the face, the shoulders heaving, and every so often a WAIL (head back, arms flung up). */
  private poseCrying(g: Instance, w: number, t: number): void {
    const C = SILLY.crying;
    const k = ease(Math.min(1, t / C.faceEnd));
    const sob = Math.sin(t * Math.PI * 2 * C.sobHz);
    const wp = t < C.faceEnd ? 1 : ((t - C.faceEnd) % C.wailEvery) / C.wailS;
    const wail = wp < 1 ? Math.sin(wp * Math.PI) : 0;
    this.rootPose(g, w, Math.abs(sob) * 0.03 * k, (0.12 + 0.04 * sob) * (1 - wail) - 0.18 * wail, 0, 0.05 * sob);
    this.turnBone(g, 'chest', 1, 0, 0, (0.22 + 0.08 * sob) * k * (1 - wail) * w);
    this.turnBone(g, 'head', 1, 0, 0, (0.4 * k * (1 - wail) - 0.6 * wail) * w);
    this.turnBone(g, 'head', 0, 0, 1, 0.15 * Math.sin(t * 4) * w);
    // blend of three arm poses: hanging (rest), hands on the face, flung up in the wail
    const face = (1 - wail) * k;
    const rest = 1 - face - wail;
    const ux = 0.3 * face + 0.7 * wail + 0.25 * rest, uy = 0.6 * wail - 0.1 * face - 0.9 * rest, uz = 0.85 * face + 0.2 * wail;
    const fx = -0.3 * face + 0.75 * wail + 0.2 * rest, fy = 0.85 * face + 0.65 * wail - 0.9 * rest, fz = 0.25 * face;
    this.arm(g, 1, ux, uy, uz, fx, fy, fz, w);
    this.arm(g, -1, ux, uy, uz, fx, fy, fz, w);
  }

  /** Aims a limb along a root-space direction (`_qRoot` holds the root's world rotation). */
  private aimLimb(g: Instance, upper: string, lower: string, x: number, y: number, z: number, w: number): void {
    const u = g.bones.get(upper), l = g.bones.get(lower);
    if (u === undefined || l === undefined) return;
    _t.set(x, y, z).normalize().applyQuaternion(_qRoot);
    aimBone(u, l, _t, w);
  }

  /** Shadows from the nearest `shadowCasters` visible bodies within `shadowRangeM`; accessories never cast. */
  private pickShadowCasters(): void {
    const C = CHARACTER;
    const o = this.order;
    // insertion sort of slot indices by camera distance (48 entries, no allocation)
    for (let i = 1; i < o.length; i++) {
      const v = o[i]!;
      const d = this.rigs[v]!.id === null ? Infinity : this.rigs[v]!.dist2;
      let j = i - 1;
      while (j >= 0) {
        const w = this.rigs[o[j]!]!;
        const dw = w.id === null ? Infinity : w.dist2;
        if (dw <= d) break;
        o[j + 1] = o[j]!;
        j--;
      }
      o[j + 1] = v;
    }
    let n = 0;
    const range2 = C.shadowRangeM * C.shadowRangeM;
    for (let i = 0; i < o.length; i++) {
      const r = this.rigs[o[i]!]!;
      if (r.id === null || r.inst === null) continue;
      const cast = n < C.shadowCasters && r.inst.root.visible && r.dist2 <= range2;
      r.inst.mesh.castShadow = cast;
      if (cast) n++;
    }
    this.shadowCount = n;
  }

  // ---- internals -------------------------------------------------------------------------------------------------

  /** Feet on the ground, the decal on the ground normal. */
  private place(r: Rig): void {
    const g = this.ground;
    const y = g !== null ? g(r.feet.x, r.feet.z) : 0;
    const lift = this.lift[r.slot]!;
    r.feet.y = (Number.isFinite(y) ? y : 0) + lift;
    if (g !== null) {
      const d = CHARACTER.normalProbeM;
      const hx = g(r.feet.x + d, r.feet.z) - g(r.feet.x - d, r.feet.z);
      const hz = g(r.feet.x, r.feet.z + d) - g(r.feet.x, r.feet.z - d);
      r.groundN.set(-hx, 2 * d, -hz);
      if (!Number.isFinite(r.groundN.x + r.groundN.z) || r.groundN.lengthSq() < 1e-8) r.groundN.set(0, 1, 0);
      r.groundN.normalize();
    }
    const wet = this.water !== null && this.water(r.feet.x, r.feet.z);
    if (wet) {
      // a surfer: flat on the level, a ripple instead of the contact shadow
      r.groundN.set(0, 1, 0);
      this.decals.setMatrixAt(r.slot, ZERO_SCALE);
      _s.set(RIPPLE.sizeM, RIPPLE.sizeM, 1);
      _p.copy(r.feet);
      _p.y += RIPPLE.liftM;
      _m.compose(_p, _qFlat, _s);
      this.ripples.setMatrixAt(r.slot, _m);
      this.wet[r.slot] = 1;
      this.dirtyRipples = true;
      this.dirtyDecals = true;
      if (r.inst !== null) r.inst.root.position.copy(r.feet);
      return;
    }
    if (this.wet[r.slot] === 1) { this.wet[r.slot] = 0; this.ripples.setMatrixAt(r.slot, ZERO_SCALE); this.dirtyRipples = true; }
    _q.setFromUnitVectors(_up, r.groundN).multiply(_qFlat);
    // a gliding actor's shadow stays on the ground, smaller the higher it flies
    const k = lift > 0 ? Math.max(0.45, 1 - lift / 12) : 1;
    _s.set(CHARACTER.decalM * k, CHARACTER.decalM * k, 1);
    _p.copy(r.feet);
    _p.y += 0.01 - lift;
    _m.compose(_p, _q, _s);
    this.decals.setMatrixAt(r.slot, _m);
    this.dirtyDecals = true;
    if (r.inst !== null) r.inst.root.position.copy(r.feet);
  }

  /** Decal instances drawn: up to the highest live slot (slots are reused lowest-first). */
  private refreshCounts(): void {
    let top = 0;
    for (const x of this.rigs) if (x.id !== null) top = x.slot + 1;
    this.decals.count = top;
    this.ripples.count = top;
  }

  /** The head anchor: the head joint's world position raised to the look's top (+ margin), projected. */
  private projectAnchor(r: Rig, out: Float32Array, offset: number): boolean {
    const g = r.inst;
    const top = r.lookRef?.heightM ?? HEAD_ANCHOR_M;
    if (g !== null && g.head !== null && g.root.visible) {
      g.head.updateWorldMatrix(true, false);
      g.head.getWorldPosition(_v);
      const scale = r.lookRef?.scale ?? 1;
      return this.projectPoint(_v.x, _v.y + (top - g.headRestY * scale) + CHARACTER.headMarginM, _v.z, out, offset);
    }
    return this.projectPoint(r.feet.x, r.feet.y + top + CHARACTER.headMarginM, r.feet.z, out, offset);
  }

  private projectPoint(x: number, y: number, z: number, out: Float32Array, offset: number): boolean {
    const cam = this.camera;
    if (cam === null) return false;
    _p.set(x, y, z).project(cam);
    if (_p.z < -1 || _p.z > 1) return false;
    const vp = this.viewport();
    out[offset] = (_p.x * 0.5 + 0.5) * vp.w;
    out[offset + 1] = (-_p.y * 0.5 + 0.5) * vp.h;
    return true;
  }

  private makeRig(i: number): Rig {
    return {
      slot: i, ud: { sharp: 0, ewaTile: 0, ewaActor: '' }, accUd: { sharp: 0, ewaTile: 0 }, id: null, look: '', lookId: null, lookRef: null,
      name: '', guildTag: '', isLocal: false, hidden: false, feet: new Vector3(), groundN: new Vector3(0, 1, 0), angle: 0, yaw: 0, hasYaw: false,
      moving: false, running: false, speed: 0, lastX: 0, lastZ: 0, hasLast: false, idleW: 1, walkW: 0, runW: 0, emote: 0, emoteLeft: 0,
      emoteW: 0, hopLeft: 0, hopT: 0, emoteAction: null, inst: null, acc: null, accId: null, dist2: 0,
    };
  }
}

const _qRoot = new Quaternion();
const _t = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _qd = new Quaternion();
const _qw = new Quaternion();
const _qp = new Quaternion();
const _qI = new Quaternion();

/** Smoothstep on 0..1 (clamped). */
function ease(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/** Rotates `bone` (in world space, by weight `w`) so the direction bone → `child` points along world `dir`. */
function aimBone(bone: Object3D, child: Object3D, dir: Vector3, w: number): void {
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  _b.sub(_a);
  if (_b.lengthSq() < 1e-12 || bone.parent === null) return;
  _qd.setFromUnitVectors(_b.normalize(), dir);
  _qI.identity().slerp(_qd, Math.min(1, Math.max(0, w)));
  bone.getWorldQuaternion(_qw);
  bone.parent.getWorldQuaternion(_qp).invert();
  bone.quaternion.copy(_qp.multiply(_qI.multiply(_qw)));
  bone.updateWorldMatrix(false, true);
}

/** Rotates `bone` by `angle` about the world `axis` (its children follow). */
function tiltBone(bone: Object3D, axis: Vector3, angle: number): void {
  if (bone.parent === null) return;
  _qd.setFromAxisAngle(axis, angle);
  bone.getWorldQuaternion(_qw);
  bone.parent.getWorldQuaternion(_qp).invert();
  bone.quaternion.copy(_qp.multiply(_qd.multiply(_qw)));
  bone.updateWorldMatrix(false, true);
}

function disposeInstance(g: Instance): void {
  g.mixer.stopAllAction();
  g.mixer.uncacheRoot(g.root);
  g.mesh.skeleton.dispose();
  g.root.removeFromParent();
}
