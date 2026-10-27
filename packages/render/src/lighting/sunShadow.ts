/**
 * Cached sun shadows (performance addition 2026-10-27, render IMPLEMENTATION-NOTES "Cached sun shadows"; replaces the
 * 2-cascade CSM of §10.3.1 and its staggering).
 *
 * Most of a zone never moves, so the sun's shadow is two maps on the one `DirectionalLight` (sun by day, moon by night):
 * - the static map: a world-fixed square around the focus (`staticHalfM`), every caster except the moving ones. It
 *   re-renders only when it is due (`staticShadowDue`): the sun turned by `sunStepRad`, the focus walked `recenterM`
 *   from its centre, `maxAgeFrames` passed (so a door, a dressed arena or a compiled chunk shows up within a second), or
 *   `refresh()` was called (a zone, a resize of the map).
 * - the actor map: a small square around the focus (`actorHalfM`) holding only `LAYERS.dynamicShadow` (actor bodies,
 *   billboards), re-placed and re-rendered every frame. A few dozen small draws.
 * A fragment takes the darker of the two. Each map fades to lit over its last metres (horizontal distance from its
 * centre), so its edge never shows as a line. Both are placed on a texel grid in light space, so a re-centred map
 * does not shimmer.
 *
 * The static map's matrix stays paired with its texture between renders: three re-derives a shadow-casting light's
 * `shadow.matrix` only in `ShadowNode.renderShadow` (the same rule the CSM staggering leaned on).
 */
import { Matrix4, NodeUpdateType, Object3D, RedFormat, ShadowBaseNode, ShadowNode, UnsignedShortType, Vector2, Vector3 } from 'three/webgpu';
import type { DirectionalLight, DirectionalLightShadow, Light, Node, NodeBuilder, RenderTarget, Renderer } from 'three/webgpu';
import { Fn, float, length, min, mix, renderGroup, shadowPositionWorld, smoothstep, uniform } from 'three/tsl';
import { LAYERS } from '../descriptors.js';

export const SUN_SHADOW_CACHE = Object.freeze({
  /** Light-space half edge of the static map (m). */
  staticHalfM: 72,
  /** The static map is lit from this horizontal distance of its centre … */
  staticFadeFromM: 54,
  /** … to this one (8 m inside the edge: terrain above or below the centre lands off-centre in light space). */
  staticFadeToM: 64,
  /** The static map re-centres once the focus is this far from its centre (the diorama sees ≤ ~30 m around it). */
  recenterM: 16,
  /** Light-space half edge of the actor map (m). */
  actorHalfM: 36,
  actorFadeFromM: 26,
  actorFadeToM: 32,
  /** Each shadow light sits this far towards the sun from its centre; the ortho camera spans 0.5–500 m, as the CSM did. */
  depthM: 250,
  /** The static map re-renders at least this often (frames), whatever moved. */
  maxAgeFrames: 60,
});

/**
 * The sun turn (radians) the static map waits for. A caster `h` m tall throws its shadow tip `h / sin²(el)` m per radian
 * of elevation, so the step shrinks as the sun sets: ≤ ~10 cm of tip jump for a 10 m building, between 0.01° (the
 * horizon: every few frames) and 0.2° (noon: the age limit comes first). `sinEl` = the light direction's y.
 */
export function sunStepRad(sinEl: number): number {
  const s = Math.abs(sinEl);
  return Math.min(0.0035, Math.max(0.0002, 0.01 * s * s));
}

export interface StaticShadowState {
  /** Unit direction toward the sun / moon when the static map last rendered. */
  readonly dir: Vector3;
  /** The focus when it last rendered. */
  readonly center: Vector3;
  /** Frames since it last rendered. */
  readonly age: number;
  /** `refresh()` was called. */
  readonly stale: boolean;
}

/** Whether the static map re-renders this frame, given the light's unit direction toward the body and the focus. Pure. */
export function staticShadowDue(s: StaticShadowState, toSun: Vector3, focus: Vector3): boolean {
  if (s.stale || s.age >= SUN_SHADOW_CACHE.maxAgeFrames) return true;
  const dx = focus.x - s.center.x; const dz = focus.z - s.center.z;
  if (dx * dx + dz * dz > SUN_SHADOW_CACHE.recenterM * SUN_SHADOW_CACHE.recenterM) return true;
  const cos = Math.min(1, Math.max(-1, toSun.dot(s.dir)));
  return Math.acos(cos) > sunStepRad(toSun.y);
}

/** A shadow-casting stand-in for one map (CSMShadowNode's `LwLight`): a position, a target and a shadow. */
class MapLight extends Object3D {
  readonly target = new Object3D();
  constructor(readonly shadow: DirectionalLightShadow) { super(); this.castShadow = true; }
}

type RenderObjectFunction = (object: Object3D, ...rest: unknown[]) => void;
interface ShadowFrame { readonly renderer: Renderer; readonly scene: Object3D }
interface LodLike extends Object3D { readonly isLOD?: boolean; autoUpdate: boolean }
const baseRenderShadow = (ShadowNode.prototype as unknown as { renderShadow(frame: ShadowFrame): void }).renderShadow;
const baseSetupRenderTarget = (ShadowNode.prototype as unknown as {
  setupRenderTarget(shadow: DirectionalLightShadow, builder: NodeBuilder): { shadowMap: RenderTarget; depthTexture: unknown };
}).setupRenderTarget;

/**
 * A `ShadowNode` whose map has a one-channel colour target (three gives every shadow map an RGBA8 one that only the
 * `transmitted` mode reads: 64 MB at 4096², this way 16) and a 16-bit depth (the ortho camera spans 500 m: ~8 mm a
 * step, far under the 20 cm bias; 32 MB at 4096² instead of 64), and that can leave out the `LAYERS.dynamicShadow`
 * casters.
 * The static map also holds every `THREE.LOD` on the level the scene camera picked: three would otherwise pick it by the
 * shadow camera's distance (250 m: the last level, which some set-pieces do not cast from).
 */
class MapShadowNode extends ShadowNode {
  private inner: RenderObjectFunction | null = null;
  private readonly held: LodLike[] = [];
  private readonly skipDynamic = (object: Object3D, ...rest: unknown[]): void => {
    if ((object.layers.mask & DYNAMIC_MASK) === 0) this.inner!(object, ...rest);
  };

  constructor(light: MapLight, private readonly staticOnly: boolean) {
    super(light as unknown as Light, light.shadow);
  }

  setupRenderTarget(sh: DirectionalLightShadow, builder: NodeBuilder): { shadowMap: RenderTarget; depthTexture: unknown } {
    const out = baseSetupRenderTarget.call(this, sh, builder);
    out.shadowMap.texture.format = RedFormat;
    (out.depthTexture as { type: number }).type = UnsignedShortType;
    return out;
  }

  renderShadow(frame: ShadowFrame): void {
    if (!this.staticOnly) { baseRenderShadow.call(this, frame); return; }
    const r = frame.renderer as unknown as { getRenderObjectFunction(): RenderObjectFunction | null; setRenderObjectFunction(f: RenderObjectFunction | null): void };
    const held = this.held;
    frame.scene.traverse((o) => { const l = o as LodLike; if (l.isLOD === true && l.autoUpdate) { l.autoUpdate = false; held.push(l); } });
    this.inner = r.getRenderObjectFunction();
    r.setRenderObjectFunction(this.skipDynamic);
    try {
      baseRenderShadow.call(this, frame);
    } finally {
      r.setRenderObjectFunction(this.inner);
      this.inner = null;
      for (const l of held) l.autoUpdate = true;
      held.length = 0;
    }
  }
}

const DYNAMIC_MASK = 1 << LAYERS.dynamicShadow;
const UP = new Vector3(0, 1, 0);
const _toSun = new Vector3();
const _eye = new Vector3();
const _c = new Vector3();
const _m = new Matrix4();
const _mi = new Matrix4();

/** The sun's `shadow.shadowNode`: the static and actor maps, the darker of the two per fragment. */
export class SunShadowNode extends ShadowBaseNode {
  readonly staticLight: MapLight;
  readonly actorLight: MapLight;
  private readonly staticNode: MapShadowNode;
  private readonly actorNode: MapShadowNode;
  private readonly staticCenter = uniform(new Vector2()).setGroup(renderGroup);
  private readonly actorCenter = uniform(new Vector2()).setGroup(renderGroup);
  private readonly state = { dir: new Vector3(), center: new Vector3(), age: 0, stale: true };
  /** Static map renders requested so far (diagnostics, tests). */
  staticRenders = 0;

  constructor(readonly sun: DirectionalLight) {
    super(sun);
    this.updateBeforeType = NodeUpdateType.NONE;   // ShadowBaseNode's per-render hook: `track` places the maps instead
    const make = (half: number): MapLight => {
      const sh = sun.shadow.clone();   // bias, normal bias, radius, map size
      const cam = sh.camera;
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.near = 0.5; cam.far = SUN_SHADOW_CACHE.depthM * 2;
      cam.updateProjectionMatrix();
      return new MapLight(sh);
    };
    this.staticLight = make(SUN_SHADOW_CACHE.staticHalfM);
    this.staticLight.name = 'ewa:sun-static';
    this.staticLight.shadow.autoUpdate = false;
    this.staticLight.shadow.needsUpdate = true;
    this.actorLight = make(SUN_SHADOW_CACHE.actorHalfM);
    this.actorLight.name = 'ewa:sun-actors';
    this.actorLight.shadow.camera.layers.set(LAYERS.dynamicShadow);   // culls everything else before the shadow pass
    this.staticNode = new MapShadowNode(this.staticLight, true);
    this.actorNode = new MapShadowNode(this.actorLight, false);
  }

  override setup(builder: NodeBuilder): Node {
    const C = SUN_SHADOW_CACHE;
    return Fn(() => {
      this.setupShadowPosition(builder);
      const p = (shadowPositionWorld as unknown as Node<'vec3'>).xz;
      const s = mix(this.staticNode as unknown as Node<'float'>, float(1), smoothstep(C.staticFadeFromM, C.staticFadeToM, length(p.sub(this.staticCenter))));
      const a = mix(this.actorNode as unknown as Node<'float'>, float(1), smoothstep(C.actorFadeFromM, C.actorFadeToM, length(p.sub(this.actorCenter))));
      return min(s, a);
    })() as unknown as Node;
  }

  /** Map edges (texels): the static map's and the actor map's. A new size re-renders the static map. */
  setMapSizes(staticSize: number, actorSize: number): void {
    this.staticLight.shadow.mapSize.set(staticSize, staticSize);
    this.actorLight.shadow.mapSize.set(actorSize, actorSize);
    this.refresh();
  }

  mapSizes(): readonly [number, number] {
    return [this.staticLight.shadow.mapSize.x, this.actorLight.shadow.mapSize.x];
  }

  /** The static map re-renders on the next frame (new or removed static content). */
  refresh(): void { this.state.stale = true; }

  /**
   * Per frame, after the sun moved (`LightRig.applyDirectional`) and before the render: places the actor map on the
   * focus and, when due, the static one (and asks for its render). Zero allocation. (Not `update`: that is `Node`'s.)
   */
  track(): void {
    const sun = this.sun;
    const focus = sun.target.position;
    _toSun.subVectors(sun.position, focus);
    if (_toSun.lengthSq() === 0) return;
    _toSun.normalize();
    const st = this.state;
    st.age++;
    if (staticShadowDue(st, _toSun, focus)) {
      place(this.staticLight, focus, _toSun);
      st.dir.copy(_toSun); st.center.copy(focus); st.age = 0; st.stale = false;
      this.staticCenter.value.set(focus.x, focus.z);
      this.staticLight.shadow.needsUpdate = true;
      this.staticRenders++;
    }
    place(this.actorLight, focus, _toSun);
    this.actorCenter.value.set(focus.x, focus.z);
  }

  override dispose(): void {
    this.staticNode.dispose();
    this.actorNode.dispose();
    super.dispose();
  }
}

/** Puts a map light `depthM` toward the sun from `center`, snapped to the map's texel grid in light space. */
function place(l: MapLight, center: Vector3, toSun: Vector3): void {
  const cam = l.shadow.camera;
  const texel = (cam.right - cam.left) / l.shadow.mapSize.x;
  _m.lookAt(_eye.copy(center).add(toSun), center, UP);   // the shadow camera's rotation (it looks from the light at its target)
  _mi.copy(_m).transpose();
  _c.copy(center).applyMatrix4(_mi);
  _c.x = Math.floor(_c.x / texel) * texel;
  _c.y = Math.floor(_c.y / texel) * texel;
  _c.applyMatrix4(_m);
  l.target.position.copy(_c);
  l.position.copy(_c).addScaledVector(toSun, SUN_SHADOW_CACHE.depthM);
  l.updateMatrixWorld();
  l.target.updateMatrixWorld();
}
