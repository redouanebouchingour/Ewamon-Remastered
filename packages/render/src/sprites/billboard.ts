/**
 * SPEC §10.4 (Pillars 5 and 6) — lit pixel-art creature billboards.
 *
 * - ONE `MeshStandardNodeMaterial` per atlas (§10.4.5); every per-creature value (atlas rect, size, pose, variant
 *   palette, hurt flash, dissolve, DOF-sharp bit, type colour, bob) is a `userData(name, type)` read on a
 *   preallocated per-object record, so a creature costs zero materials and zero programs.
 * - Shared `PlaneGeometry(1, 1)` quad (with a tangent attribute) shaped entirely in `positionNode`: foot-point
 *   anchoring, size, pose lift/squash, idle bob, a lean toward the camera, then a Y rotation by the per-frame
 *   `cameraYaw` uniform. The shadow pass falls back to `positionNode`, so the shadow silhouette is the same card
 *   (§10.4.4); `normalLocal`/`tangentLocal` are rotated with it so the derived normal map lights correctly.
 * - Alpha: binary albedo alpha, `alphaTest 0.5`, a faint dissolve that raises the cut and punches texel-sized holes
 *   (alpha stays binary, Pillar 6), and `maskShadowNode` so the shadow comes from the same alpha.
 * - Rim `typeColor · (1 − |N·V|)^3 · 0.6` on the normal-mapped normal + the emissive mask × 1.8 + the alpha shimmer.
 * - `mask` MRT: x = 1 (excluded from GTAO darkening), y = `sharp` (tilt-shift DOF mask, Pillar 1).
 * - Contact decal (§10.4.7): shared flat quad + one shared multiply-blended `MeshBasicNodeMaterial`.
 *
 * Corrections vs the SPEC text (three 0.186, recorded in IMPLEMENTATION-NOTES "Part 3"):
 * - `cameraYaw = atan2(camDir.x, camDir.z)` with `camDir` = camera forward turns the quad's +Z face AWAY from
 *   the camera (FrontSide would cull it); the yaw here is taken from the direction TOWARD the camera.
 * - `FrontSide` alone casts no shadow when the sun is on the camera's side: the shadow pass renders the flipped
 *   side (`Renderer._shadowSide[FrontSide] = BackSide`), so `shadowSide = DoubleSide`.
 * - `material.map` is NOT set: `Renderer._getShadowNodes` multiplies the shadow alpha by `map.a` sampled at the
 *   raw quad uv (the whole atlas), which would punch wrong holes in the shadow. The albedo is published as
 *   `material.userData.ewaAlbedo` for the audit instead.
 * - The shimmer clock is a pool uniform advanced by `dt × timeScale` (hitstop freezes it) rather than `time`.
 */
import {
  BufferAttribute, Color, DoubleSide, FrontSide, Group, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, MultiplyBlending,
  PlaneGeometry, Quaternion, Sphere, Box3, Vector2, Vector3, Vector4,
} from 'three/webgpu';
import type { Node, Object3D, PerspectiveCamera, Texture, UniformNode } from 'three/webgpu';
import {
  Fn, abs, cameraPosition, cos, dot, float, floor, hash, hue, length, mix, mrt, normalLocal, normalMap, normalView, normalWorld, oneMinus,
  positionLocal, positionWorld, pow, saturation, select, sin, smoothstep, tangentLocal, texture, uniform, userData, uv, vec2, vec3, vec4,
} from 'three/tsl';
import type { BattlerPose, SpriteDescriptor, SpriteFrame, TypeName, VariantKey } from '../contracts.js';
import type { HarvestLevel } from '../descriptors.js';
import { LAYERS } from '../descriptors.js';
import {
  AtlasCache, assertSingleBudget, browserDecoder, disposeAtlasTextures, loadAtlasTextures, loadSingleTextures, neutralAtlasTextures, singleKey,
  type AtlasDecoder, type AtlasSet, type AtlasTextures,
} from './atlas.js';
import { OVERLAY_ALPHA_CUT, overlayMrt } from './overlayMrt.js';
import {
  BILLBOARD, billboardDims, bobOffset, bobPhase, decayHurt, paletteFor, poseDurationMs, POSES, samplePose,
  type BillboardDims, type PaletteValues, type PoseSample,
} from './tables.js';
import { TYPE_COLORS, hexToLinearInto, validateTypeColorTable } from './typeColors.js';

// ---- §10.4.2 SpritePool (verbatim) ---------------------------------------------------------------------------

export interface SpritePool {
  bindAtlas(set: AtlasSet): Promise<void>;                 // fetches 3 maps × 4 levels (WebP), one MeshStandardNodeMaterial per atlas
  /** A party single: decodes only `frame.px` (and the matching cells of the mip files) of the creature's home atlas into a private 1024² set keyed `single:<set.id>:<frame.px>`. ≤ 6 live. */
  bindSingle(set: AtlasSet, frame: SpriteFrame): Promise<void>;
  releaseAtlas(id: string): void;                          // also releases singles keyed on it when no billboard uses them
  acquire(d: SpriteDescriptor): CreatureBillboard;
  readonly uniforms: { readonly harvestLevel: UniformNode<'float', number>; readonly cameraYaw: UniformNode<'float', number> };
  stats(): { readonly live: number; readonly atlases: number; readonly bytes: number };
  dispose(): void;
}

/** Pool uniforms: the verbatim two plus the lean and the scaled animation clock (documented additions). */
export interface BillboardUniforms {
  readonly harvestLevel: UniformNode<'float', number>;
  readonly cameraYaw: UniformNode<'float', number>;
  /** Lean of the card toward the camera (radians about the foot line), `leanFraction × camera pitch-down`. */
  readonly cameraLean: UniformNode<'float', number>;
  /** Seconds × timeScale (shimmer). */
  readonly animTime: UniformNode<'float', number>;
}

/** The per-object record `userData(name, type)` reads (§10.4.5; preallocated, scalar writes only). */
export interface BillboardUserData {
  readonly rect: Vector4;          // u0, v0, u1, v1
  readonly size: Vector2;          // width, height (m)
  footV: number;
  scaleY: number;
  lift: number;
  bob: number;
  hueShift: number;
  satMul: number;
  lightMul: number;
  alphaGlow: number;
  hurt: number;
  dissolve: number;
  sharp: number;
  /** Evolution glow 0..1 (white silhouette; §10.7.5 evolution sequence). */
  glow: number;
  readonly typeColor: Color;
  ewaBillboard: true;
}

interface DecalUserData { shade: number; ewaDecal: true }

// ---- graph -------------------------------------------------------------------------------------------------------

const B = BILLBOARD;

function f(name: string): Node<'float'> { return userData(name, 'float') as unknown as Node<'float'>; }

/**
 * The §10.4.4 vertex transform: foot-anchored, sized, posed quad → lean → yaw. Also rotates the local normal and
 * tangent (the same assignment pattern `SkinningNode` uses) so the tangent-space normal map lights the turned card.
 */
function billboardPosition(u: BillboardUniforms): Node<'vec3'> {
  return Fn(() => {
    const size = userData('size', 'vec2') as unknown as Node<'vec2'>;
    const x = positionLocal.x.mul(size.x);
    const y = positionLocal.y.add(0.5).sub(f('footV')).mul(size.y).mul(f('scaleY')).add(f('bob')).add(f('lift'));
    const cl = cos(u.cameraLean); const sl = sin(u.cameraLean);
    const cy = cos(u.cameraYaw); const sy = sin(u.cameraYaw);
    // lean about x (top away from the camera, which sits toward local +Z): (x, y, 0) → (x, y·cos λ, −y·sin λ);
    // then the §10.4.4 yaw: (x, y, z) → (x·c + z·s, y, z·c − x·s). Normal (0,0,1) → (cos λ·s, sin λ, cos λ·c),
    // tangent (1,0,0) → (c, 0, −s).
    const ly = y.mul(cl); const lz = y.mul(sl).negate();
    normalLocal.assign(vec3(cl.mul(sy), sl, cl.mul(cy)));
    tangentLocal.assign(vec3(cy, 0, sy.negate()));
    return vec3(x.mul(cy).add(lz.mul(sy)), ly, lz.mul(cy).sub(x.mul(sy)));
  })() as unknown as Node<'vec3'>;
}

/** §10.4.5 — one material per atlas. */
export function createBillboardMaterial(tex: AtlasTextures, u: BillboardUniforms, atlasId: string): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  const rect = userData('rect', 'vec4') as unknown as Node<'vec4'>;
  const uvRect = rect.xy.add(uv().mul(rect.zw.sub(rect.xy)));
  const a = texture(tex.albedo, uvRect);
  const n = texture(tex.normal, uvRect);
  const em = texture(tex.emissive, uvRect).r;
  const h = u.harvestLevel.clamp(0, 2).div(2);

  // variant palette — 4 per-object values (never re-baked pixels, Pillar 6)
  let c: Node<'vec3'> = hue(a.rgb, f('hueShift')) as unknown as Node<'vec3'>;
  c = saturation(c, f('satMul')) as unknown as Node<'vec3'>;
  c = c.mul(f('lightMul'));
  c = mix(c, vec3(1), f('hurt').mul(B.hurtFlashMix));

  // faint dissolve: texel-sized holes (alpha stays binary) and a raised cut
  const dissolve = f('dissolve');
  const cell = floor(uvRect.mul(B.dissolveCells));
  const holes = hash(cell.x.add(cell.y.mul(B.dissolveCells * 4))).lessThan(dissolve);
  const alpha = select(holes, float(0), a.a);
  const cut = float(B.alphaTest).add(dissolve.mul(0.5));

  // evolution glow: the card becomes a white silhouette of its own alpha (lit white + white emissive below)
  const glow = f('glow');
  m.colorNode = vec4(mix(mix(c, a.rgb, h), vec3(1), glow), alpha);
  m.normalNode = mix(normalMap(n.rgb, float(1)) as unknown as Node<'vec3'>, normalView, h).normalize();
  m.roughnessNode = float(B.roughness);
  m.metalnessNode = float(B.metalness);
  m.alphaTest = B.alphaTest;
  m.alphaTestNode = cut;
  m.maskShadowNode = alpha.greaterThan(cut);

  // rim + emissive
  const V = cameraPosition.sub(positionWorld).normalize();
  const rim = pow(oneMinus(abs(dot(normalWorld, V))), B.rimPower);
  const typeC = userData('typeColor', 'color') as unknown as Node<'vec3'>;
  const shimmer = f('alphaGlow').mul(B.shimmerAmp).mul(sin(u.animTime.mul(B.shimmerRate).add(uv().y.mul(B.shimmerBands))).mul(0.5).add(0.5));
  m.emissiveNode = typeC.mul(rim).mul(B.rimStrength).add(a.rgb.mul(em).mul(B.emissiveGain)).add(a.rgb.mul(shimmer)).mul(oneMinus(h))
    .add(vec3(glow.mul(B.glowGain)));

  m.mrtNode = mrt({ mask: vec2(1, f('sharp')) });   // x: exclude from GTAO darkening; y: DOF-sharp (§10.8.2)
  m.positionNode = billboardPosition(u);
  m.side = FrontSide;
  m.shadowSide = DoubleSide;
  m.transparent = false;
  m.depthWrite = true;
  m.name = `ewa:billboard:${atlasId}`;
  m.userData = { ewaClass: 'billboard', ewaAtlas: atlasId, ewaAlbedo: tex.albedo };
  return m;
}

/** §10.4.7 — the one contact-decal material shared by every billboard. */
export function createDecalMaterial(u: BillboardUniforms): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial();
  const h = u.harvestLevel.clamp(0, 2).div(2);
  m.colorNode = vec4(0, 0, 0, 1);
  m.opacityNode = smoothstep(B.decalOuter, B.decalInner, length(uv().sub(0.5))).mul(B.decalOpacity).mul(oneMinus(h)).mul(f('shade'));
  m.transparent = true;
  m.blending = MultiplyBlending;
  m.premultipliedAlpha = true;          // three 0.186: MultiplyBlending requires it on WebGPU
  m.depthWrite = false;
  m.polygonOffset = true;
  m.polygonOffsetFactor = B.decalPolygonOffset;
  m.polygonOffsetUnits = B.decalPolygonOffset;
  m.fog = false;                        // fog would tint the multiply factor
  m.mrtNode = overlayMrt(false);        // mask (1, 0); keeps its own (ground) normal + velocity — see overlayMrt.ts
  m.alphaTest = OVERLAY_ALPHA_CUT;      // transparent texels write no MRT channel
  m.name = 'ewa:contact-decal';
  m.userData = { ewaClass: 'decal' };
  return m;
}

// ---- pool --------------------------------------------------------------------------------------------------------

interface AtlasEntry { readonly textures: AtlasTextures; readonly material: MeshStandardNodeMaterial }

interface Rig {
  readonly group: Group;
  readonly quad: Mesh;
  readonly decal: Mesh;
  readonly ud: BillboardUserData;
  readonly dud: DecalUserData;
}

export interface BillboardPoolOptions {
  /** Fetch/decode seam (default: `fetch` + `createImageBitmap`). */
  readonly decoder?: AtlasDecoder;
  /** Share the material library's `harvestLevel` uniform (one write reaches every material, §10.0.3 rule 6). */
  readonly harvestLevel?: UniformNode<'float', number>;
  /** Eager GPU upload (`renderer.initTexture`) so the first frame after a bind uploads nothing. */
  readonly upload?: (t: Texture) => void;
  /** Camera whose direction drives `cameraYaw` / `cameraLean`. */
  readonly camera?: PerspectiveCamera;
}

const _dir = new Vector3();
const _up = new Vector3(0, 1, 0);
const _n = new Vector3();
const _qFlat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

function createQuadGeometry(): PlaneGeometry {
  const g = new PlaneGeometry(1, 1);
  const n = g.getAttribute('position').count;
  const t = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { t[i * 4] = 1; t[i * 4 + 3] = 1; }
  g.setAttribute('tangent', new BufferAttribute(t, 4));
  // Conservative bounds for the posed, scaled card (H ≤ 3.52 × 1.12 m, lunges ±0.9 m): culling stays correct
  // although the geometry is shaped in the vertex stage.
  g.boundingSphere = new Sphere(new Vector3(0, 1.9, 0), 3.2);
  g.boundingBox = new Box3(new Vector3(-2.3, -0.8, -2.3), new Vector3(2.3, 4.6, 2.3));
  g.name = 'ewa:billboard-quad';
  return g;
}

export class BillboardPool implements SpritePool {
  readonly uniforms: BillboardUniforms;
  readonly quadGeometry: PlaneGeometry;
  readonly decalGeometry: PlaneGeometry;
  readonly decalMaterial: MeshBasicNodeMaterial;
  private readonly neutral: AtlasEntry;
  private readonly cache: AtlasCache<AtlasEntry>;
  private readonly decoder: AtlasDecoder;
  private readonly upload: ((t: Texture) => void) | null;
  private camera: PerspectiveCamera | null;
  private readonly free: Rig[] = [];
  private readonly all: Rig[] = [];
  /** Live billboards (array, swap-remove: iterating a Set allocates an iterator per frame). */
  private readonly live: CreatureBillboard[] = [];
  private readonly waiting = new Map<string, CreatureBillboard[]>();
  private typeTable: Readonly<Record<TypeName, string>> = TYPE_COLORS;
  private warm: Rig | null = null;
  private disposed = false;

  constructor(o: BillboardPoolOptions = {}) {
    this.uniforms = {
      harvestLevel: o.harvestLevel ?? uniform(0).setName('ewaSpriteHarvest'),
      cameraYaw: uniform(0).setName('ewaCameraYaw'),
      cameraLean: uniform(0).setName('ewaCameraLean'),
      animTime: uniform(0).setName('ewaSpriteTime'),
    };
    this.decoder = o.decoder ?? browserDecoder();
    this.upload = o.upload ?? null;
    this.camera = o.camera ?? null;
    this.quadGeometry = createQuadGeometry();
    this.decalGeometry = new PlaneGeometry(1, 1);
    this.decalGeometry.name = 'ewa:contact-decal';
    this.decalMaterial = createDecalMaterial(this.uniforms);
    const nt = neutralAtlasTextures();
    this.neutral = { textures: nt, material: createBillboardMaterial(nt, this.uniforms, 'neutral') };
    this.cache = new AtlasCache<AtlasEntry>(
      (e) => { e.material.dispose(); disposeAtlasTextures(e.textures); },
      (e) => e.textures.bytes,
    );
  }

  setCamera(c: PerspectiveCamera): void { this.camera = c; }

  // ---- SpritePool ------------------------------------------------------------------------------------------

  bindAtlas(set: AtlasSet): Promise<void> {
    return this.cache.bind(set.id, () => this.load(set.id, loadAtlasTextures(set, this.decoder))).then((e) => { if (e) this.resolveWaiting(set.id); });
  }

  bindSingle(set: AtlasSet, frame: SpriteFrame): Promise<void> {
    const key = singleKey(set.id, frame.px);
    if (!this.cache.has(key)) assertSingleBudget(this.cache.countPrefix('single:'));
    return this.cache.bind(key, () => this.load(key, loadSingleTextures(set, frame, this.decoder))).then((e) => { if (e) this.resolveWaiting(key); });
  }

  releaseAtlas(id: string): void {
    this.cache.release(id);
    const prefix = `single:${id}:`;
    for (const k of [...this.cache.keys()]) if (k.startsWith(prefix) && this.cache.users(k) === 0) this.cache.releaseAll(k);
  }

  acquire(d: SpriteDescriptor): CreatureBillboard {
    if (this.disposed) throw new Error('@ewa/render: SpritePool used after dispose()');
    return new CreatureBillboard(this, d);
  }

  /** The live billboards (the pool's own array: read it, never keep or mutate it). Zero allocation. */
  liveBillboards(): readonly CreatureBillboard[] { return this.live; }

  stats(): { readonly live: number; readonly atlases: number; readonly bytes: number } {
    return { live: this.live.length, atlases: this.cache.loaded(), bytes: this.cache.bytes() };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (let i = this.live.length - 1; i >= 0; i--) this.live[i]!.dispose();
    for (const r of this.all) r.group.removeFromParent();
    this.cache.dispose();
    this.neutral.material.dispose();
    disposeAtlasTextures(this.neutral.textures);
    this.decalMaterial.dispose();
    this.quadGeometry.dispose();
    this.decalGeometry.dispose();
    this.waiting.clear();
  }

  // ---- frame hook ------------------------------------------------------------------------------------------

  /** Per frame (host step 3): camera yaw/lean uniforms, the scaled clock, every live billboard's animation. */
  update(dtScaledMs: number): void {
    if (this.disposed) return;
    const cam = this.camera;
    if (cam !== null) {
      cam.getWorldDirection(_dir);
      this.uniforms.cameraYaw.value = Math.atan2(-_dir.x, -_dir.z);      // toward the camera (see header)
      const pitchDown = Math.asin(Math.min(1, Math.max(-1, -_dir.y)));
      this.uniforms.cameraLean.value = B.leanFraction * Math.max(0, pitchDown);
    }
    this.uniforms.animTime.value += dtScaledMs / 1000;
    for (let i = 0; i < this.live.length; i++) this.live[i]!.update(dtScaledMs);
  }

  setHarvestLevel(l: HarvestLevel): void { this.uniforms.harvestLevel.value = l; }

  /** Colourblind palettes (20-client.md §20.8.3): re-colours every live rim. */
  setTypeColors(table: Readonly<Record<TypeName, string>>): void {
    this.typeTable = validateTypeColorTable(table);
    for (let i = 0; i < this.live.length; i++) this.live[i]!.refreshTypeColor();
  }

  typeColorHex(t: TypeName): string { return this.typeTable[t] ?? TYPE_COLORS[t]; }

  /** One billboard on the neutral set, for the §10.1.2 step-8 warm-up frame (never recycled). */
  warmupObject(): Group {
    if (this.warm === null) {
      this.warm = this.makeRig();
      const ud = this.warm.ud;
      ud.rect.set(0, 0, 1, 1); ud.size.set(1, 1.6); ud.footV = 0.08;
      this.warm.quad.material = this.neutral.material;
      this.warm.group.name = 'ewa:billboard-warmup';
    }
    return this.warm.group;
  }

  // ---- internals used by CreatureBillboard -----------------------------------------------------------------

  /** @internal */
  takeRig(): Rig { return this.free.pop() ?? this.makeRig(); }

  /** @internal */
  returnRig(r: Rig): void {
    r.group.removeFromParent();
    r.group.visible = true;
    r.quad.material = this.neutral.material;
    this.free.push(r);
  }

  /** @internal */
  addLive(b: CreatureBillboard): void { this.live.push(b); }

  /** @internal */
  removeLive(b: CreatureBillboard): void {
    const i = this.live.indexOf(b);
    if (i >= 0) { this.live[i] = this.live[this.live.length - 1]!; this.live.pop(); }
    for (const [k, list] of this.waiting) {
      const j = list.indexOf(b);
      if (j >= 0) { list.splice(j, 1); if (list.length === 0) this.waiting.delete(k); }
    }
  }

  /**
   * Resolves the material for `frame`: its atlas if bound, else a bound single (rect → the whole texture), else
   * the neutral material with `ready = false` (the billboard stays hidden and is re-pointed when the bind lands).
   * @internal
   */
  resolve(frame: SpriteFrame): { key: string; material: MeshStandardNodeMaterial; rect: readonly [number, number, number, number] | null; ready: boolean } {
    const atlas = this.cache.get(frame.atlas);
    if (atlas !== null) return { key: frame.atlas, material: atlas.material, rect: frame.rect, ready: true };
    const sk = singleKey(frame.atlas, frame.px);
    const single = this.cache.get(sk);
    if (single !== null) return { key: sk, material: single.material, rect: [0, 0, 1, 1], ready: true };
    return { key: this.cache.has(sk) ? sk : frame.atlas, material: this.neutral.material, rect: null, ready: false };
  }

  /** @internal */
  use(key: string): void { this.cache.use(key); }
  /** @internal */
  unuse(key: string): void { this.cache.unuse(key); }

  /** @internal */
  wait(key: string, b: CreatureBillboard): void {
    const list = this.waiting.get(key);
    if (list === undefined) this.waiting.set(key, [b]);
    else if (!list.includes(b)) list.push(b);
  }

  private async load(_key: string, p: Promise<AtlasTextures>): Promise<AtlasEntry> {
    const textures = await p;
    if (this.upload !== null) { this.upload(textures.albedo); this.upload(textures.normal); this.upload(textures.emissive); }
    return { textures, material: createBillboardMaterial(textures, this.uniforms, _key) };
  }

  private resolveWaiting(key: string): void {
    const list = this.waiting.get(key);
    if (list === undefined) return;
    this.waiting.delete(key);
    for (const b of list) b.rebind();
  }

  private makeRig(): Rig {
    const ud: BillboardUserData = {
      rect: new Vector4(0, 0, 1, 1), size: new Vector2(1, 1.6), footV: 0.08, scaleY: 1, lift: 0, bob: 0,
      hueShift: 0, satMul: 1, lightMul: 1, alphaGlow: 0, hurt: 0, dissolve: 0, sharp: 0, glow: 0, typeColor: new Color(1, 1, 1), ewaBillboard: true,
    };
    const quad = new Mesh(this.quadGeometry, this.neutral.material);
    quad.userData = ud as unknown as Record<string, unknown>;
    quad.castShadow = true;
    quad.receiveShadow = true;
    quad.layers.set(LAYERS.billboards);
    quad.name = 'ewa:billboard';
    const dud: DecalUserData = { shade: 1, ewaDecal: true };
    const decal = new Mesh(this.decalGeometry, this.decalMaterial);
    decal.userData = dud as unknown as Record<string, unknown>;
    decal.quaternion.copy(_qFlat);
    decal.renderOrder = B.decalRenderOrder;
    decal.layers.set(LAYERS.decals);
    decal.castShadow = false;
    decal.receiveShadow = false;
    decal.name = 'ewa:contact-decal';
    const group = new Group();
    group.name = 'ewa:creature';
    group.add(quad, decal);
    const r: Rig = { group, quad, decal, ud, dud };
    this.all.push(r);
    return r;
  }
}

/** SPEC §10.4.2 factory name used by the host wiring. */
export function createSpritePool(o: BillboardPoolOptions = {}): BillboardPool {
  return new BillboardPool(o);
}

// ---- CreatureBillboard (§10.4.2 verbatim surface + documented extras) ------------------------------------------

const _pal: PaletteValues = { hueShift: 0, satMul: 1, lightMul: 1, alphaGlow: 0, scale: 1 };

export class CreatureBillboard {
  readonly id: string;
  readonly object: Group;                                  // quad + contact decal; add to the zone/arena root
  private readonly pool: BillboardPool;
  private readonly rig: Rig;
  private readonly d: SpriteDescriptor;
  private side: 'front' | 'back' = 'front';
  private key: string | null = null;
  private ready = false;
  private readonly dims: BillboardDims = { heightM: 1.6, widthM: 1.6, yMin: 0, yMax: 1.6, decalM: 1.1 };
  private readonly phase: number;
  private clockS = 0;
  private pose: BattlerPose = 'idle';
  private poseElapsed = 0;
  private poseMs = 0;
  private readonly sample: PoseSample = { forward: 0, lift: 0, scaleY: 1, dissolve: Number.NaN };
  private readonly base = new Vector3();
  private axisX = 0;
  private axisZ = 1;
  private dissolveBase = 0;
  private variant: VariantKey;
  private isAlpha: boolean;
  private sizeMul = 1;
  private disposed = false;

  constructor(pool: SpritePool, d: SpriteDescriptor) {
    if (!(pool instanceof BillboardPool)) throw new TypeError('@ewa/render: CreatureBillboard needs the renderer\'s SpritePool');
    this.pool = pool;
    this.d = d;
    this.id = d.id;
    this.phase = bobPhase(d.id);
    this.variant = d.variant;
    this.isAlpha = d.isAlpha;
    this.rig = pool.takeRig();
    this.object = this.rig.group;
    this.object.name = `ewa:creature:${d.id}`;
    this.rig.ud.hurt = 0; this.rig.ud.dissolve = 0; this.rig.ud.sharp = 0; this.rig.ud.lift = 0; this.rig.ud.scaleY = 1; this.rig.ud.bob = 0; this.rig.ud.glow = 0;
    this.object.position.set(0, 0, 0);
    this.setVariant(d.variant, d.isAlpha);
    this.refreshTypeColor();
    this.bindSide();
    pool.addLive(this);
  }

  // ---- §10.4.2 -----------------------------------------------------------------------------------------------

  setPosition(x: number, y: number, z: number): void {
    this.base.set(x, y, z);
    this.applyTransform();
  }

  setFacing(side: 'front' | 'back'): void {
    if (side === this.side) return;
    this.side = side;
    this.bindSide();
  }

  setSharp(on: boolean): void { this.rig.ud.sharp = on ? 1 : 0; }

  setPose(p: BattlerPose, ms: number): void {
    const def = POSES[p] ?? POSES.idle;
    this.pose = p;
    this.poseElapsed = 0;
    this.poseMs = poseDurationMs(p, ms);
    if (def.flash) this.setHurt(1);
    this.applyPose();
  }

  setHurt(strength: number): void {
    const s = Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : 0;
    this.rig.ud.hurt = Math.max(this.rig.ud.hurt, s);
  }

  setFaint(progress: number): void {
    const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    if (!Number.isNaN(this.sample.dissolve)) { this.pose = 'idle'; this.poseMs = 0; samplePose('idle', 1, this.sample); }
    this.dissolveBase = p;
    this.applyPose();
  }

  setVariant(v: VariantKey, isAlpha: boolean): void {
    this.variant = v;
    this.isAlpha = isAlpha;
    paletteFor(v, isAlpha, _pal);
    const ud = this.rig.ud;
    ud.hueShift = _pal.hueShift; ud.satMul = _pal.satMul; ud.lightMul = _pal.lightMul; ud.alphaGlow = _pal.alphaGlow;
    this.applyDims();
  }

  /** Idle bob, flash decay, pose tween — scalar writes only. The pool calls it every frame. */
  update(dtMs: number): void {
    if (this.disposed) return;
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    this.clockS += dt / 1000;
    const ud = this.rig.ud;
    ud.bob = bobOffset(this.dims.heightM, this.clockS, this.phase);
    ud.hurt = decayHurt(ud.hurt, dt);
    if (this.poseMs > 0) {
      this.poseElapsed += dt;
      if (this.poseElapsed >= this.poseMs) this.poseElapsed = this.poseMs;
      this.applyPose();
      if (this.poseElapsed >= this.poseMs) this.poseMs = 0;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.key !== null && this.ready) this.pool.unuse(this.key);
    this.pool.removeLive(this);
    this.pool.returnRig(this.rig);
  }

  // ---- extras (documented in IMPLEMENTATION-NOTES "Part 3") -----------------------------------------------------

  /** Unit xz direction toward the foe: lunges move along it, recoils against it. */
  setPoseAxis(x: number, z: number): void {
    const l = Math.hypot(x, z);
    if (l < 1e-6) return;
    this.axisX = x / l; this.axisZ = z / l;
    this.applyTransform();
  }

  /** Terrain normal under the feet (`TerrainCollider.normal`): the contact decal lies on it. */
  setGroundNormal(nx: number, ny: number, nz: number): void {
    _n.set(nx, ny, nz);
    if (_n.lengthSq() < 1e-8) _n.set(0, 1, 0);
    _n.normalize();
    this.rig.decal.quaternion.setFromUnitVectors(_up, _n).multiply(_qFlat);
  }

  refreshTypeColor(): void {
    hexToLinearInto(this.pool.typeColorHex(this.d.types[0]), this.rig.ud.typeColor);
  }

  /** Evolution glow 0..1: a white silhouette of the card's own alpha (§10.7.5 evolution sequence). Scalar write. */
  setGlow(v: number): void { this.rig.ud.glow = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0; }

  /**
   * Shows / hides the card and its contact decal without touching the pose or the bind (the evolution sequence's
   * silhouette swaps): a visibility flag, so no program, material or binding changes.
   */
  setShown(on: boolean): void { this.object.visible = on; }

  /** Uniform scale of the card about its foot point (the evolution sequence's silhouette "pop"); 1 = the §10.4.3 size. */
  setSizeMul(k: number): void {
    const v = Number.isFinite(k) && k > 0 ? k : 1;
    if (v === this.sizeMul) return;
    this.sizeMul = v;
    this.applyDims();
  }

  get descriptor(): SpriteDescriptor { return this.d; }
  get heightM(): number { return this.dims.heightM; }
  /** Card width (m) at the §10.4.3 size (before `setSizeMul`). */
  get widthM(): number { return this.dims.widthM; }
  get facing(): 'front' | 'back' { return this.side; }
  get currentPose(): BattlerPose { return this.pose; }
  get isDisposed(): boolean { return this.disposed; }
  get dissolve(): number { return this.rig.ud.dissolve; }
  get userDataRecord(): Readonly<BillboardUserData> { return this.rig.ud; }
  /** Whether the atlas material is bound (false while the atlas bind is in flight; the card is hidden). */
  get bound(): boolean { return this.ready; }

  /** WORLD position of the top of the sprite (HUD bar anchor). Zero allocation. */
  topWorld(out: Vector3): Vector3 {
    this.object.getWorldPosition(out);
    out.y += this.dims.yMax + this.rig.ud.lift;
    return out;
  }

  /** Whether the billboard is in the scene and drawn: attached under a `Scene` with every ancestor visible. */
  isShown(): boolean {
    let o: Object3D | null = this.object;
    while (o !== null) {
      if (!o.visible) return false;
      if ((o as Object3D & { isScene?: boolean }).isScene === true) return true;
      o = o.parent;
    }
    return false;
  }

  /** WORLD position of the feet (the setPosition point in the parent's space, without pose offsets). */
  feet(out: Vector3): Vector3 {
    out.copy(this.base);
    const parent = this.object.parent;
    if (parent !== null) { parent.updateWorldMatrix(true, false); parent.localToWorld(out); }
    return out;
  }

  /** @internal re-point after an atlas bind landed. */
  rebind(): void { if (!this.disposed) this.bindSide(); }

  // ---- internals -----------------------------------------------------------------------------------------------

  private frame(): SpriteFrame { return this.side === 'front' ? this.d.front : this.d.back; }

  private bindSide(): void {
    const fr = this.frame();
    const r = this.pool.resolve(fr);
    if (this.key !== null && this.ready) this.pool.unuse(this.key);
    this.key = r.key;
    this.ready = r.ready;
    this.rig.quad.material = r.material;
    if (r.ready) {
      this.pool.use(r.key);
      const rect = r.rect ?? fr.rect;
      this.rig.ud.rect.set(rect[0], rect[1], rect[2], rect[3]);
    } else {
      this.pool.wait(r.key, this);
    }
    this.applyDims();
    this.applyVisibility();
  }

  private applyDims(): void {
    billboardDims(this.frame(), this.d.sizeScale, this.isAlpha, this.dims);
    const ud = this.rig.ud;
    ud.size.set(this.dims.widthM * this.sizeMul, this.dims.heightM * this.sizeMul);
    ud.footV = this.frame().footV;
    this.rig.decal.scale.set(this.dims.decalM, this.dims.decalM, 1);
  }

  private applyPose(): void {
    const t = this.poseMs > 0 ? this.poseElapsed / this.poseMs : 1;
    samplePose(this.pose, t, this.sample);
    const ud = this.rig.ud;
    ud.scaleY = this.sample.scaleY;
    ud.lift = this.sample.lift;
    if (!Number.isNaN(this.sample.dissolve)) this.dissolveBase = this.sample.dissolve;
    ud.dissolve = this.dissolveBase;
    this.rig.dud.shade = 1 - this.dissolveBase;
    this.applyTransform();
    this.applyVisibility();
  }

  private applyTransform(): void {
    const fw = this.sample.forward;
    this.object.position.set(this.base.x + this.axisX * fw, this.base.y, this.base.z + this.axisZ * fw);
  }

  private applyVisibility(): void {
    this.rig.quad.visible = this.ready && this.dissolveBase < 0.999;
    this.rig.decal.visible = this.ready && this.dissolveBase < 0.999;
  }
}
