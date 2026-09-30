/**
 * SPEC §10.7.6 `ActorPool` and §10.7.7 character models.
 *
 * Looks come from `models.manifest.json` (`looks.ts`, IMPLEMENTATION-NOTES Part 4, H7): one GLB per look, loaded once
 * and cloned per actor (own bones, shared geometry, the pool's one `'character'` material, one draw), animated by an
 * `AnimationMixer` (idle / walk / run blended by the gait weights, emotes on victory / defeat / standup). While a look
 * loads, when the manifest does not list it or when it fails, the actor is the procedural fallback below: a clean
 * stylised figure (big-headed, 1.7 m) built ONCE per look as a single merged geometry with
 * six flat vertex colours (the same shape the model pipeline produces: `COLOR_0`, one primitive, one material) and
 * rigid skin weights on a 7-bone skeleton (hips, spine, head, 2 arms, 2 legs). Every actor is one `SkinnedMesh`
 * (one draw, `castShadow`), all sharing ONE `'character'`-class `MeshStandardNodeMaterial` (vertex colour albedo,
 * roughness 0.6, metalness 0, geometry normal; flat-shaded at harvest level 2). The local player's mesh writes
 * `mask.y = 1` (DOF-sharp, §10.7.3).
 *
 * Animation is procedural bone rotation (idle breathing, walk and run cycles blended by the `moving`/`running`
 * flags, the wave emote), advanced by `dt × timeScale` — the `AnimationMixer` clip set of §10.7.7 arrives with the
 * GLBs. Nameplates and emote cards are drawn by the HUD (§10.9: "Nameplates are HUD, never Sprites"; the HUD's
 * canvas is the package's only CanvasTexture), anchored through `screenPositions` / `projectHead`.
 *
 * 48 rigs are preallocated (§10.7.6) and never grow; `setTransform` and `update` allocate nothing.
 */
import {
  AnimationMixer, Bone, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, LatheGeometry, Matrix4, MeshStandardNodeMaterial,
  Quaternion, Skeleton, SkinnedMesh, SphereGeometry, Vector2, Vector3,
} from 'three/webgpu';
import type { AnimationAction, Node, Object3D, PerspectiveCamera, UniformNode } from 'three/webgpu';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { LookSource, LookTemplate } from './looks.js';
import { float, mix, mrt, normalFlat, normalView, userData, vec2, vec4, vertexColor } from 'three/tsl';
import type { ActorDescriptor, ActorPool } from '../contracts.js';
import { isDevBuild } from '../env.js';
import { hash01 } from '../sprites/tables.js';

// ---- numbers ---------------------------------------------------------------------------------------------------

export const ACTOR_POOL_SIZE = 48;
export const EMOTE_MS = 2000;
/** Head-top anchor above the feet for nameplates / emote cards (m). */
export const HEAD_ANCHOR_M = 1.95;
export const CHARACTER = Object.freeze({ roughness: 0.6, metalness: 0, heightM: 1.7 });
/** Stride rates (cycles per second) and swing amplitudes (rad). */
export const GAIT = Object.freeze({
  walkHz: 1.7, runHz: 2.6, walkLeg: 0.55, runLeg: 0.95, walkArm: 0.45, runArm: 0.9, runLean: 0.18, blendRate: 8,
  idleHz: 0.35, bobWalk: 0.025, bobRun: 0.05,
});

export type EmoteId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** spine §4.1: 1..6 = wave happy sad alert heart cool. */
export const EMOTE_NAMES: readonly string[] = Object.freeze(['', 'wave', 'happy', 'sad', 'alert', 'heart', 'cool']);
/** The look clip each emote plays on a GLB look (the pipeline keeps no dedicated emote clips). */
export const EMOTE_CLIPS: readonly (string | null)[] = Object.freeze([null, 'victory', 'victory', 'defeat', 'standup', 'victory', 'victory']);
/** Emote clip fade in / out rate (1/s, exponential). */
export const EMOTE_BLEND_RATE = 10;

// ---- looks -------------------------------------------------------------------------------------------------------

export type HairStyle = 'short' | 'long' | 'bun' | 'hat';
export interface LookDef {
  readonly skin: string; readonly hair: string; readonly top: string; readonly bottom: string; readonly shoes: string; readonly accent: string;
  readonly hairStyle: HairStyle; readonly backpack: boolean;
}

const SKINS = ['#f1c9a5', '#e0ac85', '#c68863', '#9c6644', '#6f4a33'];
const HAIRS = ['#2b2118', '#4a3222', '#7a4b2a', '#c9a060', '#1d1d24', '#a0452c', '#d8d0c0'];
const TOPS = ['#3f6ea8', '#b84a3c', '#4f8a4a', '#d8b04a', '#6a4f9a', '#2f7f86', '#e8e2d4', '#8a5a3a'];
const BOTTOMS = ['#3a3f4a', '#5a4632', '#2c3e5a', '#6b6356', '#4a3a52', '#28302a'];
const SHOES = ['#2a2420', '#5a3a26', '#e8e4dc', '#3a2c52'];
const ACCENTS = ['#e0b040', '#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#8e44ad'];

function pick<T>(list: readonly T[], seed: string, salt: string): T {
  return list[Math.floor(hash01(`${seed}:${salt}`) * list.length) % list.length]!;
}

/** Deterministic procedural look for any look id (keywords steer the silhouette: female/_f → long hair, ranger → hat). */
export function lookFor(look: string): LookDef {
  const l = look.toLowerCase();
  const style: HairStyle = /ranger|hiker|trainer|hat/.test(l) ? 'hat'
    : /female|_f\b|girl|woman|lass/.test(l) ? (hash01(`${look}:bun`) < 0.4 ? 'bun' : 'long')
      : /male|_m\b|boy|man/.test(l) ? 'short'
        : (['short', 'long', 'bun', 'hat'] as const)[Math.floor(hash01(`${look}:style`) * 4) % 4]!;
  return {
    skin: pick(SKINS, look, 'skin'), hair: pick(HAIRS, look, 'hair'), top: pick(TOPS, look, 'top'), bottom: pick(BOTTOMS, look, 'bottom'),
    shoes: pick(SHOES, look, 'shoes'), accent: pick(ACCENTS, look, 'accent'), hairStyle: style,
    backpack: /ranger|hiker|explorer|scout/.test(l) || hash01(`${look}:pack`) < 0.3,
  };
}

// ---- skeleton ------------------------------------------------------------------------------------------------------

/** Bone indices and rest positions (world, feet at the origin, facing +Z). */
export const BONES = Object.freeze({ hips: 0, spine: 1, head: 2, armL: 3, armR: 4, legL: 5, legR: 6 });
const BONE_REST: readonly (readonly [number, number, number, number])[] = [
  // [x, y, z, parent]
  [0, 0.95, 0, -1],     // hips
  [0, 1.05, 0, 0],      // spine
  [0, 1.44, 0, 1],      // head (neck pivot)
  [0.21, 1.37, 0, 1],   // armL (shoulder)
  [-0.21, 1.37, 0, 1],  // armR
  [0.095, 0.9, 0, 0],   // legL (hip joint)
  [-0.095, 0.9, 0, 0],  // legR
];

function makeBones(): Bone[] {
  const bones = BONE_REST.map(() => new Bone());
  BONE_REST.forEach(([x, y, z, parent], i) => {
    const b = bones[i]!;
    if (parent < 0) b.position.set(x, y, z);
    else { const [px, py, pz] = BONE_REST[parent]!; b.position.set(x - px, y - py, z - pz); bones[parent]!.add(b); }
    b.name = Object.keys(BONES)[i]!;
  });
  return bones;
}

// ---- procedural geometry ----------------------------------------------------------------------------------------

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _c = new Color();

interface Part { readonly geo: BufferGeometry; readonly bone: number; readonly color: string }

function place(g: BufferGeometry, x: number, y: number, z: number, rx = 0, sx = 1, sy = 1, sz = 1): BufferGeometry {
  _q.setFromAxisAngle(_s.set(1, 0, 0), rx);
  _m.compose(new Vector3(x, y, z), _q, new Vector3(sx, sy, sz));
  g.applyMatrix4(_m);
  return g;
}

function lathe(points: readonly (readonly [number, number])[], segments: number): BufferGeometry {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), segments);
}

/** Merges parts into one non-indexed geometry with `color`, `skinIndex`, `skinWeight` (rigid weights). */
function mergeParts(parts: readonly Part[]): BufferGeometry {
  const flat = parts.map((p) => ({ g: p.geo.index ? p.geo.toNonIndexed() : p.geo, p }));
  let n = 0;
  for (const f of flat) n += f.g.getAttribute('position').count;
  const pos = new Float32Array(n * 3); const nor = new Float32Array(n * 3); const col = new Float32Array(n * 3);
  const si = new Uint16Array(n * 4); const sw = new Float32Array(n * 4);
  let o = 0;
  for (const { g, p } of flat) {
    const P = g.getAttribute('position'); const N = g.getAttribute('normal');
    _c.set(p.color);   // sRGB hex → linear working space
    for (let i = 0; i < P.count; i++, o++) {
      pos[o * 3] = P.getX(i); pos[o * 3 + 1] = P.getY(i); pos[o * 3 + 2] = P.getZ(i);
      nor[o * 3] = N.getX(i); nor[o * 3 + 1] = N.getY(i); nor[o * 3 + 2] = N.getZ(i);
      col[o * 3] = _c.r; col[o * 3 + 1] = _c.g; col[o * 3 + 2] = _c.b;
      si[o * 4] = p.bone; sw[o * 4] = 1;
    }
    if (g !== p.geo) g.dispose();
    p.geo.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nor, 3));
  out.setAttribute('color', new BufferAttribute(col, 3));
  out.setAttribute('skinIndex', new BufferAttribute(si, 4));
  out.setAttribute('skinWeight', new BufferAttribute(sw, 4));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** The procedural character of one look, in bind pose (feet at the origin, facing +Z). */
export function buildCharacterGeometry(look: LookDef): BufferGeometry {
  const B = BONES;
  const parts: Part[] = [];
  const add = (geo: BufferGeometry, bone: number, color: string): void => { parts.push({ geo, bone, color }); };
  // legs + shoes
  for (const [side, bone] of [[1, B.legL], [-1, B.legR]] as const) {
    add(place(lathe([[0.001, 0], [0.058, 0.02], [0.062, 0.45], [0.074, 0.8], [0.07, 0.9], [0.001, 0.91]], 12), side * 0.095, 0.02, 0), bone, look.bottom);
    add(place(lathe([[0.001, 0], [0.06, 0.01], [0.065, 0.06], [0.05, 0.1], [0.001, 0.11]], 12), side * 0.095, 0, 0.035, 0, 1, 1, 1.55), bone, look.shoes);
  }
  // pelvis + torso
  add(lathe([[0.001, 0.84], [0.15, 0.85], [0.165, 0.95], [0.155, 1.02], [0.001, 1.03]], 16), B.hips, look.bottom);
  add(place(lathe([[0.001, 0.98], [0.15, 0.99], [0.175, 1.16], [0.2, 1.33], [0.16, 1.4], [0.06, 1.43], [0.001, 1.44]], 16), 0, 0, 0, 0, 1, 1, 0.78), B.spine, look.top);
  // belt (accent)
  add(place(new CylinderGeometry(0.162, 0.162, 0.04, 16, 1, true), 0, 0.99, 0, 0, 1, 1, 0.8), B.hips, look.accent);
  // arms: sleeve + forearm + hand
  for (const [side, bone] of [[1, B.armL], [-1, B.armR]] as const) {
    add(place(lathe([[0.001, 1.13], [0.05, 1.14], [0.058, 1.3], [0.064, 1.38], [0.001, 1.42]], 10), side * 0.23, 0, 0), bone, look.top);
    add(place(lathe([[0.001, 0.93], [0.042, 0.94], [0.047, 1.1], [0.05, 1.16], [0.001, 1.17]], 10), side * 0.235, 0, 0), bone, look.skin);
    add(place(new SphereGeometry(0.052, 12, 8), side * 0.235, 0.91, 0.01), bone, look.skin);
  }
  // neck + head + eyes
  add(place(new CylinderGeometry(0.05, 0.055, 0.1, 10), 0, 1.47, 0), B.head, look.skin);
  add(place(new SphereGeometry(0.165, 24, 16), 0, 1.62, 0.005), B.head, look.skin);
  for (const side of [1, -1]) add(place(new SphereGeometry(0.02, 8, 6), side * 0.058, 1.63, 0.152), B.head, '#1b1a22');
  // hair
  add(place(new SphereGeometry(0.175, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), 0, 1.635, -0.012), B.head, look.hair);
  if (look.hairStyle === 'long') add(place(new CylinderGeometry(0.16, 0.14, 0.34, 16, 1, true, Math.PI * 0.62, Math.PI * 0.76), 0, 1.5, -0.03), B.head, look.hair);
  if (look.hairStyle === 'bun') add(place(new SphereGeometry(0.075, 12, 8), 0, 1.76, -0.13), B.head, look.hair);
  if (look.hairStyle === 'hat') {
    add(place(new CylinderGeometry(0.25, 0.25, 0.022, 24), 0, 1.74, 0), B.head, look.accent);
    add(place(lathe([[0.001, 0], [0.16, 0], [0.155, 0.11], [0.12, 0.14], [0.001, 0.145]], 16), 0, 1.745, 0), B.head, look.accent);
  }
  // backpack
  if (look.backpack) add(place(lathe([[0.001, 0], [0.12, 0.01], [0.13, 0.2], [0.11, 0.3], [0.001, 0.31]], 12), 0, 1.02, -0.2, 0, 1, 1, 0.55), B.spine, look.accent);
  return mergeParts(parts);
}

// ---- the shared 'character' material -----------------------------------------------------------------------------

/** §10.7.7: vertex-colour albedo, placeholder ORM (ao 1, roughness 0.6, metalness 0), geometry normal; harvest-flattened. */
export function createCharacterMaterial(harvestLevel: UniformNode<'float', number>): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  const h = harvestLevel.clamp(0, 2).div(2) as unknown as Node<'float'>;
  m.colorNode = vec4(vertexColor().rgb, 1);
  m.roughnessNode = float(CHARACTER.roughness);
  m.metalnessNode = float(CHARACTER.metalness);
  m.normalNode = mix(normalView, normalFlat, h).normalize();
  m.mrtNode = mrt({ mask: vec2(0, userData('sharp', 'float') as unknown as Node<'float'>) });
  m.name = 'ewa:character';
  m.userData = { ewaClass: 'character' };
  return m;
}

// ---- the pool ---------------------------------------------------------------------------------------------------

interface ActorUserData { sharp: number; ewaActor: string }

/** One GLB look instance (cloned from its template; recycled per look on despawn). */
interface GlbInstance {
  readonly look: string;
  readonly root: Object3D;
  readonly mesh: SkinnedMesh;
  readonly mixer: AnimationMixer;
  readonly idle: AnimationAction | null;
  readonly walk: AnimationAction | null;
  readonly run: AnimationAction | null;
  /** Indexed by emote id (0 unused). */
  readonly emotes: readonly (AnimationAction | null)[];
}

interface Rig {
  readonly mesh: SkinnedMesh;
  readonly bones: Bone[];
  readonly ud: ActorUserData;
  id: string | null;
  look: string;
  name: string;
  guildTag: string;
  isLocal: boolean;
  readonly feet: Vector3;
  angle: number;
  moving: boolean;
  running: boolean;
  walkW: number;
  runW: number;
  phase: number;
  clock: number;
  emote: EmoteId;
  emoteLeft: number;
  emoteW: number;
  /** The GLB look shown instead of `mesh` once its template loaded; null = procedural. */
  glb: GlbInstance | null;
}

/** Ground height sampler (the zone collider); flat 0 when unset. */
export type GroundSampler = (x: number, z: number) => number;

export interface ActorPoolOptions {
  readonly harvestLevel: UniformNode<'float', number>;
  readonly camera?: PerspectiveCamera;
  /** CSS viewport size for `screenPositions`. */
  readonly viewport?: () => { readonly w: number; readonly h: number };
  /** GLB looks (`createGlbLookSource`); absent = every look procedural. */
  readonly looks?: LookSource;
}

const _p = new Vector3();

export class CharacterPool implements ActorPool {
  readonly root = new Group();
  readonly material: MeshStandardNodeMaterial;
  private readonly rigs: Rig[] = [];
  private readonly byId = new Map<string, Rig>();
  private readonly geometries = new Map<string, BufferGeometry>();
  private ground: GroundSampler | null = null;
  private camera: PerspectiveCamera | null;
  private readonly looks: LookSource | null;
  /** Loaded templates by look (null = no model / failed: procedural). */
  private readonly templates = new Map<string, LookTemplate | null>();
  private readonly pendingLooks = new Set<string>();
  private readonly freeGlb = new Map<string, GlbInstance[]>();
  private readonly viewport: () => { readonly w: number; readonly h: number };
  private disposed = false;

  constructor(o: ActorPoolOptions) {
    this.root.name = 'ewa:actors';
    this.material = createCharacterMaterial(o.harvestLevel);
    this.camera = o.camera ?? null;
    this.viewport = o.viewport ?? (() => ({ w: 1, h: 1 }));
    this.looks = o.looks ?? null;
    for (let i = 0; i < ACTOR_POOL_SIZE; i++) this.rigs.push(this.makeRig(i));
  }

  setGround(g: GroundSampler | null): void { this.ground = g; }
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
      r.feet.set(0, 0, 0); r.angle = 0; r.moving = false; r.running = false; r.walkW = 0; r.runW = 0;
      r.phase = hash01(id) * Math.PI * 2; r.clock = 0; r.emote = 0; r.emoteLeft = 0; r.emoteW = 0;
    }
    r.look = d.look; r.name = d.name; r.guildTag = d.guildTag; r.isLocal = d.isLocal;
    r.ud.sharp = d.isLocal ? 1 : 0;
    r.ud.ewaActor = id;
    r.mesh.geometry = this.geometryFor(d.look);
    r.mesh.name = `ewa:actor:${id}`;
    this.attachLook(r);
    this.pose(r);
  }

  setTransform(id: string, x: number, z: number, angle: number, moving: boolean, running: boolean): void {
    const r = this.byId.get(id);
    if (r === undefined) return;
    const y = this.ground !== null ? this.ground(x, z) : 0;
    r.feet.set(x, Number.isFinite(y) ? y : 0, z);
    r.angle = angle;
    r.moving = moving;
    r.running = running;
    r.mesh.position.copy(r.feet);
    r.mesh.rotation.y = angle;
    if (r.glb !== null) { r.glb.root.position.copy(r.feet); r.glb.root.rotation.y = angle; }
  }

  setEmote(id: string, n: 0 | 1 | 2 | 3 | 4 | 5 | 6): void {
    const r = this.byId.get(id);
    if (r === undefined) return;
    r.emote = n;
    r.emoteLeft = n === 0 ? 0 : EMOTE_MS;
  }

  despawn(id: string): void {
    const r = this.byId.get(id);
    if (r === undefined) return;
    this.byId.delete(id);
    r.id = null;
    r.mesh.visible = false;
    r.mesh.removeFromParent();
    if (r.glb !== null) this.releaseGlb(r);
    r.emote = 0; r.emoteLeft = 0; r.emoteW = 0;
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
      if (!this.projectPoint(r.feet.x, r.feet.y + HEAD_ANCHOR_M, r.feet.z, out, n * 2)) { out[n * 2] = Number.NaN; out[n * 2 + 1] = Number.NaN; }
      n++;
    }
    return n;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const r of this.rigs) { r.mesh.removeFromParent(); r.mesh.skeleton.dispose(); if (r.glb !== null) this.releaseGlb(r); }
    for (const list of this.freeGlb.values()) for (const g of list) disposeGlb(g);
    this.freeGlb.clear();
    (this.looks as (LookSource & { dispose?: () => void }) | null)?.dispose?.();
    this.templates.clear();
    this.byId.clear();
    for (const g of this.geometries.values()) g.dispose();
    this.geometries.clear();
    this.material.dispose();
    this.root.removeFromParent();
  }

  // ---- frame hook + extras ---------------------------------------------------------------------------------------

  /** Per frame: gait blend, bone poses, emote timers (dt × timeScale). Zero allocation. */
  update(dtScaledMs: number): void {
    if (this.disposed) return;
    const dt = Math.max(0, dtScaledMs);
    for (let i = 0; i < this.rigs.length; i++) {
      const r = this.rigs[i]!;
      if (r.id === null) continue;
      const k = Math.min(1, dt / 1000 * GAIT.blendRate);
      r.walkW += ((r.moving ? 1 : 0) - r.walkW) * k;
      r.runW += ((r.moving && r.running ? 1 : 0) - r.runW) * k;
      const hz = GAIT.walkHz + (GAIT.runHz - GAIT.walkHz) * r.runW;
      r.phase += (dt / 1000) * hz * Math.PI * 2 * Math.max(0.0001, r.walkW);
      r.clock += dt / 1000;
      if (r.emoteLeft > 0) { r.emoteLeft = Math.max(0, r.emoteLeft - dt); if (r.emoteLeft === 0) r.emote = 0; }
      if (r.glb !== null) this.animateGlb(r, dt); else this.pose(r);
    }
  }

  /** Projects the head anchor of `id` to CSS px into `out[offset..offset+1]`; false when absent or behind the camera. */
  projectHead(id: string, out: Float32Array, offset = 0): boolean {
    const r = this.byId.get(id);
    return r !== undefined && this.projectPoint(r.feet.x, r.feet.y + HEAD_ANCHOR_M, r.feet.z, out, offset);
  }

  /** Live actor ids in slot order (the order `screenPositions` writes). */
  forEachLive(cb: (id: string, name: string, guildTag: string, emote: EmoteId, emoteT: number) => void): void {
    for (let i = 0; i < this.rigs.length; i++) { const r = this.rigs[i]!; if (r.id !== null) cb(r.id, r.name, r.guildTag, r.emote, r.emoteLeft / EMOTE_MS); }
  }

  /** Current emote of an actor and its remaining fraction (0 = none). */
  emoteOf(id: string): { readonly n: EmoteId; readonly left: number } {
    const r = this.byId.get(id);
    return r === undefined ? { n: 0, left: 0 } : { n: r.emote, left: r.emoteLeft / EMOTE_MS };
  }

  /** A standalone skinned character for the renderer's warm-up frame (never pooled). */
  warmupMesh(): SkinnedMesh {
    const bones = makeBones();
    const mesh = new SkinnedMesh(this.geometryFor('default'), this.material);
    mesh.add(bones[0]!);
    mesh.updateMatrixWorld(true);
    mesh.bind(new Skeleton(bones));
    mesh.castShadow = true;
    mesh.userData = { sharp: 1, ewaActor: 'warmup' };
    mesh.name = 'ewa:actor-warmup';
    return mesh;
  }

  has(id: string): boolean { return this.byId.has(id); }
  get liveCount(): number { return this.byId.size; }
  get capacity(): number { return this.rigs.length; }
  /** The mesh that draws the actor (the GLB look once loaded, else the procedural figure). */
  meshOf(id: string): SkinnedMesh | null { const r = this.byId.get(id); return r === undefined ? null : r.glb?.mesh ?? r.mesh; }
  /** Whether the actor currently shows its GLB look. */
  hasModel(id: string): boolean { return (this.byId.get(id)?.glb ?? null) !== null; }

  // ---- GLB looks (H7) ----------------------------------------------------------------------------------------

  /** Shows the rig's look: its GLB instance when the template is loaded, else the procedural mesh (and a load request). */
  private attachLook(r: Rig): void {
    if (r.glb !== null && r.glb.look === r.look) return;
    if (r.glb !== null) this.releaseGlb(r);
    const t = this.templates.get(r.look);
    if (t === undefined) this.requestLook(r.look);
    if (t) {
      const g = this.acquireGlb(t, r);
      r.glb = g;
      r.mesh.visible = false;
      r.mesh.removeFromParent();
      g.root.position.copy(r.feet);
      g.root.rotation.y = r.angle;
      g.root.visible = true;
      if (g.root.parent !== this.root) this.root.add(g.root);
      return;
    }
    r.mesh.visible = true;
    if (r.mesh.parent !== this.root) this.root.add(r.mesh);
  }

  private requestLook(look: string): void {
    if (this.looks === null || this.pendingLooks.has(look) || this.templates.has(look)) return;
    this.pendingLooks.add(look);
    this.looks(look).then((t) => {
      this.pendingLooks.delete(look);
      if (this.disposed) return;
      this.templates.set(look, t);
      if (t === null) return;
      for (const r of this.rigs) if (r.id !== null && r.look === look && r.glb === null) this.attachLook(r);
    }, () => { this.pendingLooks.delete(look); this.templates.set(look, null); });
  }

  private acquireGlb(t: LookTemplate, r: Rig): GlbInstance {
    const free = this.freeGlb.get(t.look);
    const g = free !== undefined && free.length > 0 ? free.pop()! : createGlb(t, this.material);
    g.mesh.userData = r.ud as unknown as Record<string, unknown>;   // `sharp` (DOF mask) of this rig
    g.mesh.name = `ewa:actor:${r.id ?? ''}:${t.look}`;
    return g;
  }

  private releaseGlb(r: Rig): void {
    const g = r.glb!;
    r.glb = null;
    g.root.removeFromParent();
    g.root.visible = false;
    let list = this.freeGlb.get(g.look);
    if (list === undefined) { list = []; this.freeGlb.set(g.look, list); }
    list.push(g);
  }

  /** Per frame (GLB): gait weights onto idle / walk / run, the emote clip over them, then the mixer. Zero allocation. */
  private animateGlb(r: Rig, dtMs: number): void {
    const g = r.glb!;
    const k = Math.min(1, (dtMs / 1000) * EMOTE_BLEND_RATE);
    const emoting = r.emote !== 0 && r.emoteLeft > 0 && (g.emotes[r.emote] ?? null) !== null;
    r.emoteW += ((emoting ? 1 : 0) - r.emoteW) * k;
    const base = 1 - r.emoteW;
    g.idle?.setEffectiveWeight((1 - r.walkW) * base);
    g.walk?.setEffectiveWeight(r.walkW * (1 - r.runW) * base);
    g.run?.setEffectiveWeight(r.walkW * r.runW * base);
    for (let e = 1; e < g.emotes.length; e++) g.emotes[e]?.setEffectiveWeight(0);
    if (r.emote !== 0) g.emotes[r.emote]?.setEffectiveWeight(r.emoteW);
    g.mixer.update(dtMs / 1000);
  }

  // ---- internals -------------------------------------------------------------------------------------------------

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

  private geometryFor(look: string): BufferGeometry {
    let g = this.geometries.get(look);
    if (g === undefined) {
      g = buildCharacterGeometry(lookFor(look));
      g.name = `ewa:look:${look}`;
      this.geometries.set(look, g);
    }
    return g;
  }

  private makeRig(i: number): Rig {
    const bones = makeBones();
    const g = this.geometryFor('default');
    const mesh = new SkinnedMesh(g, this.material);
    mesh.add(bones[0]!);
    mesh.updateMatrixWorld(true);
    mesh.bind(new Skeleton(bones));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.frustumCulled = false;   // skinned bounds follow the bones; 48 rigs max
    mesh.name = `ewa:actor-slot:${i}`;
    const ud: ActorUserData = { sharp: 0, ewaActor: '' };
    mesh.userData = ud as unknown as Record<string, unknown>;
    return {
      mesh, bones, ud, id: null, look: 'default', name: '', guildTag: '', isLocal: false, feet: new Vector3(), angle: 0,
      moving: false, running: false, walkW: 0, runW: 0, phase: 0, clock: 0, emote: 0, emoteLeft: 0, emoteW: 0, glb: null,
    };
  }

  /** Procedural pose: idle breathing + walk/run swing + wave emote. */
  private pose(r: Rig): void {
    const b = r.bones;
    const s = Math.sin(r.phase);
    const legAmp = GAIT.walkLeg + (GAIT.runLeg - GAIT.walkLeg) * r.runW;
    const armAmp = GAIT.walkArm + (GAIT.runArm - GAIT.walkArm) * r.runW;
    const w = r.walkW;
    const breathe = Math.sin(r.clock * Math.PI * 2 * GAIT.idleHz);
    b[BONES.legL]!.rotation.x = s * legAmp * w;
    b[BONES.legR]!.rotation.x = -s * legAmp * w;
    b[BONES.armL]!.rotation.x = -s * armAmp * w;
    b[BONES.armR]!.rotation.x = s * armAmp * w;
    b[BONES.armL]!.rotation.z = 0.08 + breathe * 0.015 * (1 - w);
    b[BONES.armR]!.rotation.z = -0.08 - breathe * 0.015 * (1 - w);
    b[BONES.spine]!.rotation.x = GAIT.runLean * r.runW + breathe * 0.012 * (1 - w);
    b[BONES.head]!.rotation.y = Math.sin(r.clock * 0.7 + r.phase * 0.1) * 0.08 * (1 - w);
    const bob = Math.abs(Math.cos(r.phase)) * (GAIT.bobWalk + (GAIT.bobRun - GAIT.bobWalk) * r.runW) * w;
    b[BONES.hips]!.position.y = BONE_REST[0]![1] + bob;
    if (r.emote === 1 && r.emoteLeft > 0) {   // wave: right arm up, waving
      b[BONES.armR]!.rotation.z = -2.6;
      b[BONES.armR]!.rotation.x = Math.sin(r.clock * 14) * 0.35;
    } else if (r.emote === 2 && r.emoteLeft > 0) {   // happy: little hop
      b[BONES.hips]!.position.y += Math.abs(Math.sin(r.clock * 9)) * 0.06;
    }
  }
}

/** A GLB instance of a template: cloned bones, the template's geometry, the pool's material, one mixer, looping clips at weight 0. */
function createGlb(t: LookTemplate, material: MeshStandardNodeMaterial): GlbInstance {
  const root = cloneSkinned(t.scene);
  let found: SkinnedMesh | null = null;
  root.traverse((n) => {
    if ((n as SkinnedMesh).isSkinnedMesh === true && found === null) found = n as SkinnedMesh;
    else if ((n as { isMesh?: boolean }).isMesh === true) n.visible = false;   // a look is one primitive (§10.7.7): nothing else draws
  });
  if (found === null) throw new Error(`@ewa/render: look '${t.look}' has no skinned mesh`);
  const mesh: SkinnedMesh = found;
  mesh.material = material;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;   // skinned bounds follow the bones; 48 rigs max
  root.scale.setScalar(t.scale);
  const mixer = new AnimationMixer(root);
  const action = (name: string | null): AnimationAction | null => {
    if (name === null) return null;
    const clip = t.clips.find((c) => c.name === name);
    if (clip === undefined) return null;
    const a = mixer.clipAction(clip);
    a.enabled = true;
    a.setEffectiveWeight(0);
    a.play();
    return a;
  };
  const idle = action('idle');
  idle?.setEffectiveWeight(1);
  const emotes = EMOTE_CLIPS.map((c) => action(c));
  return { look: t.look, root, mesh, mixer, idle, walk: action('walk'), run: action('run'), emotes };
}

function disposeGlb(g: GlbInstance): void {
  g.mixer.stopAllAction();
  g.mixer.uncacheRoot(g.root);
  g.mesh.skeleton.dispose();
  g.root.removeFromParent();
}
