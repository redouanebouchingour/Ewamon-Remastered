/**
 * The fixed light layout (handover; SPEC §10.3.2 as amended 2026-10-06, render IMPLEMENTATION-NOTES "Handover: fixed
 * light layout"). Installed as the renderer's `lighting` at §10.1.2 step 4.
 *
 * three 0.186's stock `LightsNode` emits one light node per scene light and puts every light's `id` into the cache key
 * of every lit render object, so each zone's own lights made every lit object a new node build (and, with a different
 * count or kind mix, new programs). `LayoutLightsNode` instead:
 * - loops over every non-shadow `PointLight` / `SpotLight` (no `map`, no `colorNode`) in ONE uniform array of
 *   `LOCAL_LIGHT_VEC4` vec4 per light, bounded by a uniform count (`LocalLightsNode`): the zone's lamps, windows,
 *   braziers and crystals change uniform values, never a program or a cache key;
 * - keeps the stock per-light path for everything else (the sun with its CSM, the hemisphere fill, the arena beacons
 *   and the rig's shadow slots), all persistent objects whose ids never change.
 *
 * One uniform buffer for all local lights: three's addon `DynamicLighting` keeps 3–4 arrays per light type (one
 * uniform buffer each), which took the lit fragment stages over WebGPU's 12-uniform-buffer limit (measured: 13).
 *
 * Shading is the stock spot/point math (`SpotLightNode` / `PointLightNode` in three 0.186): `getDistanceAttenuation`
 * on the view-space distance, and for a spot `smoothstep(cos(angle), cos(angle · (1 − penumbra)), dot(L, axis))`; a
 * point light is a spot whose cone factor is exactly 1 (cone cosines −2 / −1).
 */
import { Lighting, LightsNode, Node, Vector3, Vector4 } from 'three/webgpu';
import type { Light, NodeBuilder, NodeFrame, Object3D, PointLight, SpotLight } from 'three/webgpu';
import { Loop, NodeUpdateType, getDistanceAttenuation, positionView, renderGroup, smoothstep, uniform, uniformArray, vec3 } from 'three/tsl';

/** vec4 rows per local light: [view pos, cutoff] [view axis (target → light), decay] [colour × intensity, cos outer] [cos inner, –] */
export const LOCAL_LIGHT_VEC4 = 4;

type Punctual = PointLight | SpotLight;
type LightLike = Light & { readonly isNode?: boolean; readonly isPointLight?: boolean; readonly isSpotLight?: boolean; readonly map?: unknown; readonly colorNode?: { getCacheKey(): number } | null };

/** A light the layout loops over (everything else keeps its own light node, keyed by id). */
export function isLocalLight(l: Light): boolean {
  const x = l as LightLike;
  if (x.isNode === true || x.castShadow) return false;
  if (x.isPointLight === true) return true;
  return x.isSpotLight === true && (x.map ?? null) === null && x.colorNode == null;
}

const _p = new Vector3();
const _t = new Vector3();

/** The loop over the local lights: one uniform array + a uniform count, updated per render call (view space). */
export class LocalLightsNode extends Node {
  static get type(): string { return 'EwaLocalLightsNode'; }

  private lights: readonly Punctual[] = [];
  private readonly rows: Vector4[];
  private readonly dataNode;
  private readonly countNode;

  constructor(readonly maxCount: number) {
    super();
    this.rows = Array.from({ length: maxCount * LOCAL_LIGHT_VEC4 }, () => new Vector4());
    this.dataNode = uniformArray(this.rows, 'vec4').setGroup(renderGroup);
    this.countNode = uniform(0, 'int').setGroup(renderGroup);
    this.updateType = NodeUpdateType.RENDER;
  }

  setLights(lights: readonly Punctual[]): this {
    this.lights = lights;
    return this;
  }

  get count(): number { return Math.min(this.lights.length, this.maxCount); }

  override update(frame: NodeFrame): boolean | undefined {
    const camera = frame.camera;
    if (!camera) return undefined;
    const view = camera.matrixWorldInverse;
    const n = this.count;
    this.countNode.value = n;
    for (let i = 0; i < n; i++) {
      const l = this.lights[i]!;
      const r = this.rows;
      const k = i * LOCAL_LIGHT_VEC4;
      _p.setFromMatrixPosition(l.matrixWorld);
      const pos = _t.copy(_p).applyMatrix4(view);
      r[k]!.set(pos.x, pos.y, pos.z, l.distance);
      const s = l as SpotLight;
      if (s.isSpotLight === true) {
        _t.setFromMatrixPosition(s.target.matrixWorld);
        _p.sub(_t).transformDirection(view);
        r[k + 1]!.set(_p.x, _p.y, _p.z, l.decay);
        r[k + 2]!.set(l.color.r * l.intensity, l.color.g * l.intensity, l.color.b * l.intensity, Math.cos(s.angle));
        r[k + 3]!.set(Math.cos(s.angle * (1 - s.penumbra)), 0, 0, 0);
      } else {
        r[k + 1]!.set(0, 1, 0, l.decay);
        r[k + 2]!.set(l.color.r * l.intensity, l.color.g * l.intensity, l.color.b * l.intensity, -2);   // cone factor 1
        r[k + 3]!.set(-1, 0, 0, 0);
      }
    }
    return undefined;
  }

  override setup(builder: NodeBuilder): null {
    const ctx = builder.context as unknown as {
      positionView?: Node<'vec3'>;
      lightingModel: { direct(input: unknown, builder: NodeBuilder): void };
      reflectedLight: { directDiffuse: Node<'vec3'>; directSpecular: Node<'vec3'> };
    };
    const surface = ctx.positionView ?? positionView;
    const diffuse = vec3(0).toVar('ewaLocalDiffuse');
    const specular = vec3(0).toVar('ewaLocalSpecular');
    const data = this.dataNode;
    Loop(this.countNode, ({ i }: { i: Node<'int'> }) => {
      const k = i.mul(LOCAL_LIGHT_VEC4);
      const row = (j: number): Node<'vec4'> => data.element(j === 0 ? k : k.add(j)) as unknown as Node<'vec4'>;
      const r0 = row(0);
      const r1 = row(1);
      const r2 = row(2);
      const r3 = row(3);
      const lightVector = r0.xyz.sub(surface).toVar();
      const lightDirection = lightVector.normalize().toVar();
      const cone = smoothstep(r2.w, r3.x, lightDirection.dot(r1.xyz));
      const attenuation = getDistanceAttenuation({ lightDistance: lightVector.length(), cutoffDistance: r0.w, decayExponent: r1.w });
      const lightColor = r2.xyz.mul(cone).mul(attenuation).toVar();
      ctx.lightingModel.direct({ lightDirection, lightColor, lightNode: { light: {}, shadowNode: null }, reflectedLight: { directDiffuse: diffuse, directSpecular: specular } }, builder);
    });
    ctx.reflectedLight.directDiffuse.addAssign(diffuse);
    ctx.reflectedLight.directSpecular.addAssign(specular);
    return null;
  }
}

/** FNV-1a over numbers (the cache key needs no more than stable mixing). */
function mix(values: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) { h ^= v | 0; h = Math.imul(h, 0x01000193); h ^= (v / 4294967296) | 0; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

const LAYOUT_KEY = 0x45574131;   // 'EWA1'

/** The scene's lights node under the layout. */
export class LayoutLightsNode extends LightsNode {
  static get type(): string { return 'EwaLayoutLightsNode'; }

  readonly local: LocalLightsNode;
  /** one light node per own-path light, kept for the light's lifetime (as three's own `LightsNode` does) */
  private readonly perLight = new WeakMap<Light, Node>();

  constructor(maxLocal: number) {
    super();
    this.local = new LocalLightsNode(maxLocal);
  }

  private all(): Light[] { return (this as unknown as { _lights: Light[] })._lights; }

  /** Only the own-path lights' ids (the local lights are uniform data), so every zone keys like the boot. */
  override customCacheKey(): number {
    const v: number[] = [LAYOUT_KEY];
    for (const l of this.all()) {
      if (isLocalLight(l)) continue;
      const x = l as LightLike;
      v.push(l.id, l.castShadow ? 1 : 0);
      if (x.isSpotLight === true) v.push((x.map as { id?: number } | null | undefined)?.id ?? -1, x.colorNode ? x.colorNode.getCacheKey() : -1);
    }
    return mix(v);
  }

  override setupLightsNode(builder: NodeBuilder): never[] {
    const ctx = builder.context as unknown as { materialLightings?: Light[] };
    const lights = [...(ctx.materialLightings ?? []), ...this.all()].sort((a, b) => a.id - b.id);
    const library = (builder.renderer as unknown as { library: { getLightNodeClass(c: unknown): (new (l: Light) => Node) | null } }).library;
    const out: Node[] = [];
    for (const l of lights) {
      if ((l as LightLike).isNode === true) { out.push(l as unknown as Node); continue; }
      if (isLocalLight(l)) continue;
      let node = this.perLight.get(l);
      if (node === undefined) {
        const C = library.getLightNodeClass(l.constructor);
        if (C === null) continue;
        node = new C(l);
        this.perLight.set(l, node);
      }
      out.push(node);
    }
    out.push(this.local);
    return out as never[];
  }

  override setLights(lights: Light[]): this {
    super.setLights(lights);
    this.local.setLights(lights.filter(isLocalLight) as Punctual[]);
    return this;
  }

}

/** `renderer.lighting` for the layout: one `LayoutLightsNode` per scene (or group) rendered with lights. */
export class LightLayout extends Lighting {
  private readonly perScene = new WeakMap<object, LayoutLightsNode>();
  private readonly none = new LightsNode();

  constructor(readonly maxLocal: number) { super(); }

  override createNode(lights: Light[] = []): LightsNode {
    return new LayoutLightsNode(this.maxLocal).setLights(lights);
  }

  override getNode(scene: Object3D): LightsNode {
    const s = scene as Object3D & { isScene?: boolean; isGroup?: boolean };
    if (s.isScene !== true && s.isGroup !== true) return this.none;
    let node = this.perScene.get(scene);
    if (node === undefined) {
      node = this.createNode() as LayoutLightsNode;
      this.perScene.set(scene, node);
    }
    return node;
  }
}
