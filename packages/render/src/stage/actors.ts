/**
 * SPEC §10.7.6 `ActorPool` and §10.7.7 characters — HD-2D pixel-art sprites (proposed amendment, see
 * tools/character-pipeline/IMPLEMENTATION-NOTES.md): the GLB mannequins are gone; every player and NPC is a lit
 * billboard of the procedural character atlas (`public/characters/`, tools/character-pipeline).
 *
 * - Material: the creature billboard graph (§10.4.5) over the character atlas, instanced (`characterAtlas.ts`):
 *   derived-normal-map lighting, binary alpha with the shadow from the same alpha, `NearestFilter` magnification
 *   (Pillar 6), the §10.4.4 yaw + half-pitch lean, the DOF-sharp bit for the local player. ONE material and ONE
 *   instanced card for all 48 slots: the per-actor frame, feet and flags are instance attributes.
 * - Facing: the actor's heading relative to the camera heading, quantised to 4 with hysteresis
 *   (`characterAnim.ts`). Frames: idle breathing, walk / run advanced by the measured ground speed, wave / cheer
 *   emotes facing the camera.
 * - Grounding: one instanced contact decal for all slots (the §10.4.7 material), laid on the collider's normal.
 * - Draws for ANY number of live actors: 1 card draw in the beauty pass + 1 per shadow cascade + 1 decal draw
 *   (none at all with no live actor: an instance count of 0 issues no draw).
 *
 * 48 rigs are preallocated (§10.7.6) and never grow; `setTransform` and `update` allocate nothing. Nameplates and
 * emote cards are the HUD's (§10.9), anchored through `screenPositions` / `projectHead` at the leaned head top.
 */
import { Color, Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry, Quaternion, Vector3 } from 'three/webgpu';
import type { MeshBasicNodeMaterial, MeshStandardNodeMaterial, Object3D, PerspectiveCamera, Texture, UniformNode } from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { ActorDescriptor, ActorPool } from '../contracts.js';
import { LAYERS } from '../descriptors.js';
import { isDevBuild } from '../env.js';
import { browserDecoder, type AtlasDecoder } from '../sprites/atlas.js';
import { createDecalMaterial, type BillboardUniforms } from '../sprites/billboard.js';
import { BILLBOARD, hash01 } from '../sprites/tables.js';
import {
  assignCharacterImages, createCharacterInstances, createCharacterMaterial, createCharacterTextures, disposeCharacterTextures, loadCharacterSet,
  type CharacterFrames, type CharacterInstances, type CharacterTextures, type CharacterUniforms, type LookFrames,
} from '../sprites/characterAtlas.js';
import { STATE_KEYS, createCharAnim, frameIndex, resetCharAnim, stepCharAnim, type CharAnim } from '../sprites/characterAnim.js';

// ---- numbers ---------------------------------------------------------------------------------------------------

export const ACTOR_POOL_SIZE = 48;
export const EMOTE_MS = 2000;
/** Fallback head-top anchor above the feet (m) before the atlas loads. */
export const HEAD_ANCHOR_M = 1.95;
export const CHARACTER = Object.freeze({
  /** A standing character (no hat) in world metres — the pipeline's STAND_M. */
  heightM: 1.7,
  /** Nameplate / emote anchor: this much above the look's head top (m). */
  headMarginM: 0.16,
  /** Contact decal diameter (m) (the creature decal is 1.1 m × sizeScale). */
  decalM: 0.95,
  /** Rim colour (linear): the characters' stand-in for the creature type rim, a faint warm edge light. */
  rim: Object.freeze([0.09, 0.08, 0.07] as const),
  /** Ground normal probe distance (m) for the decal (central differences on the collider height). */
  normalProbeM: 0.3,
  /** Card size (m) and foot line before the manifest arrives (the pipeline's 32 × 52 cell at 40 texels / 1.7 m). */
  cellW: 32 / (40 / 1.7), cellH: 52 / (40 / 1.7), footV: 1 / 52,
});

export type EmoteId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** spine §4.1: 1..6 = wave happy sad alert heart cool. */
export const EMOTE_NAMES: readonly string[] = Object.freeze(['', 'wave', 'happy', 'sad', 'alert', 'heart', 'cool']);

/** Ground height sampler (the zone collider); flat 0 when unset. */
export type GroundSampler = (x: number, z: number) => number;

interface Rig {
  readonly slot: number;
  readonly anim: CharAnim;
  id: string | null;
  look: string;
  frames: LookFrames | null;
  name: string;
  guildTag: string;
  isLocal: boolean;
  readonly feet: Vector3;
  readonly groundN: Vector3;
  angle: number;
  moving: boolean;
  running: boolean;
  emote: EmoteId;
  emoteLeft: number;
}

export interface ActorPoolOptions {
  readonly harvestLevel: UniformNode<'float', number>;
  readonly camera?: PerspectiveCamera;
  /** CSS viewport size for `screenPositions`. */
  readonly viewport?: () => { readonly w: number; readonly h: number };
  /** Where `characters.manifest.json` and the atlas are served (`RendererOptions.charactersUrl`); null = none (tests: actors stay hidden). */
  readonly charactersUrl?: string | null;
  /** The sprite pool's uniforms (camera yaw / lean written once per frame for creatures and characters); own ones when absent. */
  readonly uniforms?: BillboardUniforms;
  readonly decoder?: AtlasDecoder;
  readonly fetchJson?: (url: string) => Promise<unknown>;
  /** Eager GPU upload once the atlas decoded (`renderer.initTexture`). */
  readonly upload?: (t: Texture) => void;
  readonly warn?: (msg: string) => void;
}

const _p = new Vector3();
const _dir = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _qFlat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const ZERO_SCALE = new Matrix4().makeScale(0, 0, 0);

export class CharacterPool implements ActorPool {
  readonly root = new Group();
  readonly material: MeshStandardNodeMaterial;
  readonly uniforms: BillboardUniforms;
  readonly characterUniforms: CharacterUniforms;
  /** Resolves true once the atlas is bound (false when there is none or it failed). */
  readonly ready: Promise<boolean>;
  private readonly textures: CharacterTextures;
  private readonly inst: CharacterInstances;
  private readonly cards: Mesh;
  private readonly decalGeometry: PlaneGeometry;
  private readonly decalMaterial: MeshBasicNodeMaterial;
  private readonly decals: InstancedMesh;
  private readonly ownsUniforms: boolean;
  private readonly rigs: Rig[] = [];
  private readonly byId = new Map<string, Rig>();
  private frames: CharacterFrames | null = null;
  private ground: GroundSampler | null = null;
  private camera: PerspectiveCamera | null;
  private readonly viewport: () => { readonly w: number; readonly h: number };
  private dirtyFeet = false;
  private dirtyRect = false;
  private dirtyMisc = false;
  private dirtyDecals = false;
  private warm: { mesh: Mesh; inst: CharacterInstances } | null = null;
  private disposed = false;

  constructor(o: ActorPoolOptions) {
    this.root.name = 'ewa:actors';
    this.camera = o.camera ?? null;
    this.viewport = o.viewport ?? (() => ({ w: 1, h: 1 }));
    this.ownsUniforms = o.uniforms === undefined;
    this.uniforms = o.uniforms ?? {
      harvestLevel: o.harvestLevel,
      cameraYaw: uniform(0).setName('ewaCharYaw'),
      cameraLean: uniform(0).setName('ewaCharLean'),
      animTime: uniform(0).setName('ewaCharTime'),
    };
    this.characterUniforms = {
      cellW: uniform(CHARACTER.cellW).setName('ewaCharCellW'),
      cellH: uniform(CHARACTER.cellH).setName('ewaCharCellH'),
      footV: uniform(CHARACTER.footV).setName('ewaCharFootV'),
      rim: uniform(new Color(CHARACTER.rim[0], CHARACTER.rim[1], CHARACTER.rim[2])).setName('ewaCharRim'),
    };
    this.textures = createCharacterTextures();
    this.material = createCharacterMaterial(this.textures, this.uniforms, this.characterUniforms);
    this.inst = createCharacterInstances(ACTOR_POOL_SIZE);
    this.cards = new Mesh(this.inst.geometry, this.material);
    this.cards.name = 'ewa:character-cards';
    this.cards.castShadow = true;
    this.cards.receiveShadow = true;
    this.cards.frustumCulled = false;   // instances span the zone; an instance count of 0 draws nothing
    this.cards.layers.set(LAYERS.billboards);
    this.root.add(this.cards);
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
    for (let i = 0; i < ACTOR_POOL_SIZE; i++) this.rigs.push(this.makeRig(i));

    const url = o.charactersUrl ?? null;
    if (url === null) { this.ready = Promise.resolve(false); return; }
    const fetchJson = o.fetchJson ?? (async (u: string) => { const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<unknown>; });
    this.ready = loadCharacterSet(url, o.decoder ?? browserDecoder(), fetchJson).then((set) => {
      if (this.disposed) { set.albedo.close?.(); set.normal.close?.(); return false; }
      assignCharacterImages(this.textures, set.albedo, set.normal);
      if (o.upload) { o.upload(this.textures.albedo); o.upload(this.textures.normal); }
      this.frames = set.frames;
      this.characterUniforms.cellW.value = set.frames.cellW;
      this.characterUniforms.cellH.value = set.frames.cellH;
      this.characterUniforms.footV.value = set.frames.footV;
      for (const r of this.rigs) if (r.id !== null) this.bindLook(r);
      this.flush();
      return true;
    }, (err: unknown) => {
      o.warn?.(`characters unavailable (${err instanceof Error ? err.message : String(err)}): actors stay hidden`);
      return false;
    });
  }

  setGround(g: GroundSampler | null): void { this.ground = g; for (const r of this.rigs) if (r.id !== null) this.place(r); }
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
      r.feet.set(0, 0, 0); r.groundN.set(0, 1, 0); r.angle = 0; r.moving = false; r.running = false; r.emote = 0; r.emoteLeft = 0;
      resetCharAnim(r.anim, hash01(id) * 2);
      this.refreshCounts();
    }
    r.look = d.look; r.name = d.name; r.guildTag = d.guildTag; r.isLocal = d.isLocal;
    this.inst.misc.setX(r.slot, d.isLocal ? 1 : 0);
    this.dirtyMisc = true;
    this.bindLook(r);
    this.place(r);
  }

  setTransform(id: string, x: number, z: number, angle: number, moving: boolean, running: boolean): void {
    const r = this.byId.get(id);
    if (r === undefined) return;
    r.feet.x = Number.isFinite(x) ? x : 0;
    r.feet.z = Number.isFinite(z) ? z : 0;
    r.angle = Number.isFinite(angle) ? angle : 0;
    r.moving = moving;
    r.running = running;
    this.place(r);
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
    r.frames = null;
    r.emote = 0; r.emoteLeft = 0;
    this.inst.misc.setXY(r.slot, 0, 0);
    this.dirtyMisc = true;
    this.decals.setMatrixAt(r.slot, ZERO_SCALE);
    this.dirtyDecals = true;
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
    this.byId.clear();
    this.cards.removeFromParent();
    this.inst.geometry.dispose();
    this.decals.removeFromParent();
    this.decals.dispose();
    this.decalGeometry.dispose();
    this.decalMaterial.dispose();
    if (this.warm !== null) { this.warm.mesh.removeFromParent(); this.warm.inst.geometry.dispose(); }
    this.material.dispose();
    disposeCharacterTextures(this.textures);
    this.root.removeFromParent();
  }

  // ---- frame hook + extras ---------------------------------------------------------------------------------------

  /** Per frame (host step 3, after the sprite pool wrote the camera uniforms): facing, frame, emote timers. Zero allocation. */
  update(dtScaledMs: number): void {
    if (this.disposed) return;
    const dt = Number.isFinite(dtScaledMs) ? Math.max(0, dtScaledMs) : 0;
    if (this.ownsUniforms && this.camera !== null) {
      this.camera.getWorldDirection(_dir);
      this.uniforms.cameraYaw.value = Math.atan2(-_dir.x, -_dir.z);
      this.uniforms.cameraLean.value = BILLBOARD.leanFraction * Math.max(0, Math.asin(Math.min(1, Math.max(-1, -_dir.y))));
    }
    const yaw = this.uniforms.cameraYaw.value;
    for (let i = 0; i < this.rigs.length; i++) {
      const r = this.rigs[i]!;
      if (r.id === null) continue;
      if (r.emoteLeft > 0) { r.emoteLeft = Math.max(0, r.emoteLeft - dt); if (r.emoteLeft === 0) r.emote = 0; }
      stepCharAnim(r.anim, dt, r.feet.x, r.feet.z, r.angle, r.moving, r.running, r.emoteLeft > 0 ? r.emote : 0, yaw);
      this.applyFrame(r);
    }
    this.flush();
  }

  /** Projects the head anchor of `id` to CSS px into `out[offset..offset+1]`; false when absent or behind the camera. */
  projectHead(id: string, out: Float32Array, offset = 0): boolean {
    const r = this.byId.get(id);
    return r !== undefined && this.projectAnchor(r, out, offset);
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

  /** One card on the character material for the renderer's warm-up frame: its own one-instance geometry (never pooled). */
  warmupMesh(): Object3D {
    if (this.warm === null) {
      const inst = createCharacterInstances(1);
      inst.rect.setXYZW(0, 0, 0, 1, 1);
      inst.misc.setXY(0, 1, 1);
      inst.geometry.instanceCount = 1;
      const mesh = new Mesh(inst.geometry, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.layers.set(LAYERS.billboards);
      mesh.name = 'ewa:actor-warmup';
      this.warm = { mesh, inst };
    }
    return this.warm.mesh;
  }

  has(id: string): boolean { return this.byId.has(id); }
  get liveCount(): number { return this.byId.size; }
  get capacity(): number { return this.rigs.length; }
  /** Whether the atlas is bound (actors are hidden until it is). */
  get atlasReady(): boolean { return this.frames !== null; }
  /** The one instanced card mesh every actor draws through. */
  get cardMesh(): Mesh { return this.cards; }
  /** The instanced contact-decal mesh (one draw for every actor). */
  get decalMesh(): InstancedMesh { return this.decals; }
  /** Whether an actor is drawn (atlas bound and look resolved). */
  isShown(id: string): boolean { const r = this.byId.get(id); return r !== undefined && this.inst.misc.getY(r.slot) === 1; }
  /** The actor's DOF-sharp bit (the local player: 1). */
  sharpOf(id: string): number { const r = this.byId.get(id); return r === undefined ? 0 : this.inst.misc.getX(r.slot); }
  /** The frame rect (u0, v0, u1, v1) an actor currently draws. */
  rectOf(id: string): readonly [number, number, number, number] | null {
    const r = this.byId.get(id);
    if (r === undefined) return null;
    const a = this.inst.rect;
    return [a.getX(r.slot), a.getY(r.slot), a.getZ(r.slot), a.getW(r.slot)];
  }
  /** The resolved atlas look an actor draws (`casual2_male:dusk`, a base look, or the hash pick), null before the atlas. */
  lookOf(id: string): string | null { return this.byId.get(id)?.frames?.id ?? null; }
  /** Current facing (D U L R), state and frame of an actor (sandbox, tests). */
  frameOf(id: string): { readonly facing: string; readonly state: string; readonly frame: number } | null {
    const r = this.byId.get(id);
    if (r === undefined || r.frames === null) return null;
    const k = r.anim.facing * STATE_KEYS.length + r.anim.state;
    return { facing: 'DULR'[r.anim.facing]!, state: STATE_KEYS[r.anim.state]!, frame: frameIndex(r.anim, r.frames.count[k]!) };
  }

  // ---- internals -------------------------------------------------------------------------------------------------

  private bindLook(r: Rig): void {
    const f = this.frames;
    r.frames = f === null ? null : f.resolve(r.look);
    this.inst.misc.setY(r.slot, r.frames !== null ? 1 : 0);
    this.dirtyMisc = true;
    if (r.frames !== null) this.applyFrame(r);
  }

  private applyFrame(r: Rig): void {
    const lf = r.frames;
    if (lf === null) return;
    const k = r.anim.facing * STATE_KEYS.length + r.anim.state;
    const i = (lf.first[k]! + frameIndex(r.anim, lf.count[k]!)) * 4;
    const q = lf.rects;
    const a = this.inst.rect;
    const s = r.slot;
    if (a.getX(s) !== q[i] || a.getY(s) !== q[i + 1] || a.getZ(s) !== q[i + 2] || a.getW(s) !== q[i + 3]) {
      a.setXYZW(s, q[i]!, q[i + 1]!, q[i + 2]!, q[i + 3]!);
      this.dirtyRect = true;
    }
  }

  /** Feet on the ground (the card's instance), the decal on the ground normal. */
  private place(r: Rig): void {
    const g = this.ground;
    const y = g !== null ? g(r.feet.x, r.feet.z) : 0;
    r.feet.y = Number.isFinite(y) ? y : 0;
    this.inst.feet.setXYZ(r.slot, r.feet.x, r.feet.y, r.feet.z);
    this.dirtyFeet = true;
    if (g !== null) {
      const d = CHARACTER.normalProbeM;
      const hx = g(r.feet.x + d, r.feet.z) - g(r.feet.x - d, r.feet.z);
      const hz = g(r.feet.x, r.feet.z + d) - g(r.feet.x, r.feet.z - d);
      r.groundN.set(-hx, 2 * d, -hz);
      if (!Number.isFinite(r.groundN.x + r.groundN.z) || r.groundN.lengthSq() < 1e-8) r.groundN.set(0, 1, 0);
      r.groundN.normalize();
    }
    _q.setFromUnitVectors(_up, r.groundN).multiply(_qFlat);
    _s.set(CHARACTER.decalM, CHARACTER.decalM, 1);
    _m.compose(r.feet, _q, _s);
    this.decals.setMatrixAt(r.slot, _m);
    this.dirtyDecals = true;
  }

  /** Uploads what changed this frame (a few hundred bytes at most). */
  private flush(): void {
    if (this.dirtyFeet) { this.inst.feet.needsUpdate = true; this.dirtyFeet = false; }
    if (this.dirtyRect) { this.inst.rect.needsUpdate = true; this.dirtyRect = false; }
    if (this.dirtyMisc) { this.inst.misc.needsUpdate = true; this.dirtyMisc = false; }
    if (this.dirtyDecals) { this.decals.instanceMatrix.needsUpdate = true; this.dirtyDecals = false; }
  }

  /** Instances drawn: up to the highest live slot (slots are reused lowest-first). */
  private refreshCounts(): void {
    let top = 0;
    for (const x of this.rigs) if (x.id !== null) top = x.slot + 1;
    this.inst.geometry.instanceCount = top;
    this.decals.count = top;
  }

  /** The head anchor on the LEANED card (§10.4.4): h·cos λ up and h·sin λ away from the camera, projected. */
  private projectAnchor(r: Rig, out: Float32Array, offset: number): boolean {
    const h = (r.frames?.heightM ?? HEAD_ANCHOR_M) + CHARACTER.headMarginM;
    const lean = this.uniforms.cameraLean.value;
    const yaw = this.uniforms.cameraYaw.value;
    const back = h * Math.sin(lean);
    return this.projectPoint(r.feet.x - Math.sin(yaw) * back, r.feet.y + h * Math.cos(lean), r.feet.z - Math.cos(yaw) * back, out, offset);
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
      slot: i, anim: createCharAnim(), id: null, look: '', frames: null, name: '', guildTag: '', isLocal: false,
      feet: new Vector3(), groundN: new Vector3(0, 1, 0), angle: 0, moving: false, running: false, emote: 0, emoteLeft: 0,
    };
  }
}
