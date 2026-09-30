/**
 * SPEC §10.2.4 — the one material graph, `buildSurfaceGraph(def, maps, params, u)`, plus the §10.5.6
 * water variant (class 'water' is a library material too: builders never construct materials,
 * §10.0.3 rule 3).
 *
 * Deviations from the SPEC's TSL block, each recorded in IMPLEMENTATION-NOTES.md:
 *
 * 1. Per-surface numbers are UNIFORMS, not constants. three 0.186 dedupes GPU programs by WGSL source
 *    (`Pipelines.programs.{vertex,fragment}` keyed by shader text) and TSL inlines constants into the
 *    text, so `color(def.albedo)` / `float(def.roughness)` would compile one program per surface
 *    (83 + shadow variants > the 96-program cap, §50.2.2). With uniforms, surfaces of the same
 *    *structure* (class × triplanar × wind × wetness × alphaTest × clearcoat × emissive) share code.
 * 2. `colorNode` is `vec4(rgb, alb.a)`, not a vec3: alpha testing reads `diffuseColor.a` and the shadow
 *    pass multiplies by `colorNode.a` (`Renderer._getShadowNodes`), so cards need the albedo alpha.
 * 3. The level-2 normal is `normalView` (view space), not `normalGeometry` (object space):
 *    `normalMap()` returns a view-space normal and `NodeMaterial.normalNode` is consumed in view space.
 * 4. Albedo / roughness / metalness are `map × scale + bias` with per-material uniforms. While the
 *    neutral placeholder is bound the scale is 0 and the bias is the SurfaceDef value (the placeholder
 *    renders as the surface's base colour/roughness); once the baked set is bound the scale is 1 and
 *    the bias 0 (the bake writes absolute values, §40.3.6). The SPEC's `alb × color(def.albedo)` and
 *    `orm.g × def.roughness × 2` would double-apply the base values to baked maps. Re-binding writes
 *    uniforms only: no new program.
 * 5. UV tiling: the builder emits UVs in metres (cards: 0..1 over the card, metres = 1); the shader
 *    multiplies by `tileScale = 1 / metres` from the manifest, which makes UV tiling world-constant like
 *    the triplanar path (§40.3.2 "repeat is world-constant in the shader").
 * 6. Cheap feature flags are uniforms too (wetness response, emissive / emissive-from-albedo, forced
 *    harvest level, clearcoat values, card wind amplitude, card back-face tint), so the program set is
 *    one per `surfaceStructure()` — {standard, physical, card, water} × triplanar × trunk wind — not one
 *    per feature combination. Measured in the sandbox: this halves the library's programs.
 */
import { Color, DoubleSide, FrontSide, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, Vector3 } from 'three/webgpu';
import type { Node, TextureNode, UniformNode } from 'three/webgpu';
import {
  attribute, bool, float, frontFacing, max, mix, normalMap, normalView, oneMinus, positionLocal, texture, uniform, uv, vec2, vec4, vertexColor,
} from 'three/tsl';
import { harvestBlend, type SharedUniforms } from './harvest.js';
import { occlusionKeep } from './occlusion.js';
import type { SurfaceDef, SurfaceExtras } from './surfaces.js';
import { triplanarSample } from './triplanar.js';
import { windDisplace, type WindParams } from './wind.js';

export type SurfaceMaterial = MeshStandardNodeMaterial | MeshPhysicalNodeMaterial;

/** The material's three base texture nodes; the library re-points them by assigning `.value`. */
export interface SurfaceMaps {
  readonly albedo: TextureNode;
  readonly orm: TextureNode;
  readonly normal: TextureNode;
}

/** Per-material uniforms (see deviations 1, 4 and 6 in the header). */
export interface SurfaceParams {
  readonly albedoScale: UniformNode<'vec3', Vector3>;
  readonly albedoBias: UniformNode<'vec3', Vector3>;
  readonly roughScale: UniformNode<'float', number>;
  readonly roughBias: UniformNode<'float', number>;
  readonly metalScale: UniformNode<'float', number>;
  readonly metalBias: UniformNode<'float', number>;
  readonly tileScale: UniformNode<'float', number>;
  /** Linear emissive colour × intensity; (0,0,0) for non-emissive surfaces. */
  readonly emissive: UniformNode<'vec3', Vector3>;
  /** 1 → emissive is `albedo × emissive` (stained glass per-texel mask); 0 → constant emissive. */
  readonly emissiveFromAlbedo: UniformNode<'float', number>;
  /** 1 when the surface responds to weather wetness (`SurfaceDef.wetness`), else 0. */
  readonly wetResponse: UniformNode<'float', number>;
  /** 1 → always render at harvest level 2 (`unmade_stone`), else 0. */
  readonly forceHarvest: UniformNode<'float', number>;
  /** Clearcoat base / wet / roughness (physical graph only; zeros when the def has no clearcoat). */
  readonly clearcoat: { readonly base: UniformNode<'float', number>; readonly wet: UniformNode<'float', number>; readonly roughness: UniformNode<'float', number> };
  /** Cards always carry wind (amplitude 0 when the def has none); standard surfaces only when the def has trunk wind. */
  readonly wind: WindParams | null;
  readonly transmission: UniformNode<'float', number> | null;
  /** Card back-face multiplier; (1,1,1) = no tint. */
  readonly backTint: UniformNode<'vec3', Vector3>;
}

export type GraphKind = 'standard' | 'physical' | 'card' | 'water';

/** The only surface properties that change the generated program (everything else is a uniform). */
export interface SurfaceStructure { readonly kind: GraphKind; readonly triplanar: boolean; readonly trunkWind: boolean }

export function surfaceStructure(def: SurfaceDef): SurfaceStructure {
  const kind: GraphKind = def.cls === 'water' ? 'water'
    : def.cls === 'card' ? 'card'
      : (def.clearcoat !== null || def.cls === 'physical') ? 'physical' : 'standard';
  const solid = kind === 'standard' || kind === 'physical';
  return {
    kind,
    triplanar: solid && def.triplanar,
    trunkWind: solid && def.wind !== null && !def.wind.stiffnessFromUv,
  };
}

export function structureKey(s: SurfaceStructure): string {
  return `${s.kind}${s.triplanar ? '+tri' : ''}${s.trunkWind ? '+wind' : ''}`;
}

/** Default tile size in metres when the manifest does not (yet) provide `metres` (§40.3.6 values). */
export function defaultMetres(def: SurfaceDef): number {
  if (def.triplanar) return 3;
  if (def.cls === 'card' || def.cls === 'emissive') return 1;
  if (def.cls === 'water') return 4;
  return 2;
}

const _c = new Color();

/** sRGB hex → linear working-space RGB (ColorManagement converts on `setStyle`). */
export function linearRgb(hex: string, out: Vector3 = new Vector3()): Vector3 {
  _c.set(hex);
  return out.set(_c.r, _c.g, _c.b);
}

export function createSurfaceParams(def: SurfaceDef, extras: SurfaceExtras): SurfaceParams {
  const s = surfaceStructure(def);
  const emissiveColor = def.emissive
    ? (extras.emissiveFromAlbedo
      ? new Vector3(def.emissive.intensity, def.emissive.intensity, def.emissive.intensity)
      : linearRgb(def.emissive.color).multiplyScalar(def.emissive.intensity))
    : new Vector3(0, 0, 0);
  const cc = def.clearcoat ?? { base: 0, wet: 0, roughness: 0 };
  const wind: WindParams | null = s.kind === 'card'
    ? { amplitude: uniform(def.wind?.amplitude ?? 0), frequency: uniform(def.wind?.frequency ?? 1.9), stiffnessFromUv: true }
    : s.trunkWind && def.wind
      ? { amplitude: uniform(def.wind.amplitude), frequency: uniform(def.wind.frequency), stiffnessFromUv: false }
      : null;
  return {
    albedoScale: uniform(new Vector3(0, 0, 0)),
    albedoBias: uniform(linearRgb(def.albedo)),
    roughScale: uniform(0),
    roughBias: uniform(def.roughness),
    metalScale: uniform(0),
    metalBias: uniform(def.metalness),
    tileScale: uniform(1 / defaultMetres(def)),
    emissive: uniform(emissiveColor),
    emissiveFromAlbedo: uniform(extras.emissiveFromAlbedo ? 1 : 0),
    wetResponse: uniform(def.wetness ? 1 : 0),
    forceHarvest: uniform(extras.alwaysHarvested ? 1 : 0),
    clearcoat: { base: uniform(cc.base), wet: uniform(cc.wet), roughness: uniform(cc.roughness) },
    wind,
    transmission: s.kind === 'water' ? uniform(extras.transmission ?? 0.6) : null,
    backTint: uniform(extras.backfaceTint && def.doubleSide ? linearRgb(extras.backfaceTint).multiplyScalar(2.2) : new Vector3(1, 1, 1)),
  };
}

/** Uniform values while the neutral placeholder set is bound (deviation 4). */
export function applyPlaceholderParams(p: SurfaceParams, def: SurfaceDef): void {
  p.albedoScale.value.set(0, 0, 0);
  linearRgb(def.albedo, p.albedoBias.value);
  p.roughScale.value = 0; p.roughBias.value = def.roughness;
  p.metalScale.value = 0; p.metalBias.value = def.metalness;
}

/** Uniform values once the baked set is bound (deviation 4); `metres` from the manifest entry. */
export function applyBakedParams(p: SurfaceParams, def: SurfaceDef, metres: number): void {
  p.albedoScale.value.set(1, 1, 1);
  p.albedoBias.value.set(0, 0, 0);
  p.roughScale.value = 1; p.roughBias.value = 0;
  p.metalScale.value = def.metalness > 0 ? 1 : 0; p.metalBias.value = 0;   // §10.2.4: orm.b × (metal > 0 ? 1 : 0)
  p.tileScale.value = 1 / (metres > 0 ? metres : defaultMetres(def));
}

/** §10.2.4, the one graph for classes standard / physical / card / emissive. */
export function buildSurfaceGraph(def: SurfaceDef, _extras: SurfaceExtras, maps: SurfaceMaps, p: SurfaceParams, u: SharedUniforms): SurfaceMaterial {
  const st = surfaceStructure(def);
  if (st.kind === 'water') return buildWaterGraph(def, maps, p, u);

  const m: SurfaceMaterial = st.kind === 'physical' ? new MeshPhysicalNodeMaterial() : new MeshStandardNodeMaterial();

  const h: Node<'float'> = max(harvestBlend(u) as Node<'float'>, p.forceHarvest);
  const uvN = uv().mul(p.tileScale);
  const sample = (base: TextureNode): Node<'vec4'> => (st.triplanar ? triplanarSample(base, p.tileScale) : texture(base, uvN)) as Node<'vec4'>;
  const alb = sample(maps.albedo);
  const orm = sample(maps.orm);
  const nrm = sample(maps.normal);

  // Pillar 2 vs harvested: the SAME graph, blended by one uniform.
  let rgb: Node<'vec3'> = alb.rgb.mul(p.albedoScale).add(p.albedoBias);
  if (st.kind === 'card') rgb = frontFacing.select(rgb, rgb.mul(p.backTint)) as Node<'vec3'>;       // leaf subsurface tint (§10.2.2)
  m.colorNode = vec4(mix(rgb, vertexColor().rgb, h), alb.a);                                        // level 2 = flat vertex colour
  m.normalNode = mix(tangentNormal(nrm.rgb, float(1)), normalView, h).normalize();                  // level 2 = geometry normal (flat when unwelded)
  const rough = mix(orm.g.mul(p.roughScale).add(p.roughBias), float(0.95), h);                    // level 2 = flat rough
  m.roughnessNode = rough.mul(mix(float(1), float(0.45), u.wetness.mul(p.wetResponse)));          // wet → × 0.45
  m.metalnessNode = mix(orm.b.mul(p.metalScale).add(p.metalBias), float(0), h);
  m.aoNode = mix(orm.r, float(1), h);
  m.emissiveNode = mix(p.emissive, alb.rgb.mul(p.emissive), p.emissiveFromAlbedo).mul(oneMinus(h)); // level 2: no light sources (Pillar 4 off)
  if (m instanceof MeshPhysicalNodeMaterial) {
    m.clearcoatNode = mix(p.clearcoat.base, p.clearcoat.wet, u.wetness).mul(oneMinus(h));
    m.clearcoatRoughnessNode = p.clearcoat.roughness;
  }
  if (p.wind !== null) m.positionNode = windDisplace(positionLocal, p.wind, u);                      // §10.2.5
  if (st.kind === 'card') {
    m.alphaTest = def.alphaTest ?? 0.5;
    m.maskShadowNode = alb.a.greaterThan(def.alphaTest ?? 0.5);
  }
  // M2-spawn-noon-9: everything above the ground can be dithered out between the diorama camera and the player
  if (u.occlusion !== undefined && !def.triplanar) {
    m.maskNode = occlusionKeep(u.occlusion);
    // the shadow pass uses `maskShadowNode || maskNode`: shadows never fade, so solids get a constant mask there and
    // their shadow programs stay independent of the fade graph (cards keep their alpha mask)
    if (m.maskShadowNode === null) m.maskShadowNode = bool(true);
  }
  m.side = def.doubleSide ? DoubleSide : FrontSide;
  m.transparent = false;
  m.depthWrite = true;
  return m;
}

/** Name of the per-vertex attribute holding the terrain depth below the water surface (§10.5.6). */
export const WATER_DEPTH_ATTRIBUTE = 'depthBelow';

/**
 * §10.5.6 water: `MeshPhysicalNodeMaterial` with transmission, two scrolling normal samples, a depth
 * tint from a build-time vertex attribute (no depth-buffer read), flattened at harvest level 2.
 */
function buildWaterGraph(def: SurfaceDef, maps: SurfaceMaps, p: SurfaceParams, u: SharedUniforms): MeshPhysicalNodeMaterial {
  const m = new MeshPhysicalNodeMaterial();
  const h = harvestBlend(u) as Node<'float'>;
  const t = u.windTime;
  const uv0 = uv().mul(p.tileScale);
  const n1 = texture(maps.normal, uv0.add(vec2(t.mul(0.012), t.mul(0.007))));
  const n2 = texture(maps.normal, uv0.mul(0.7).sub(vec2(t.mul(0.009), t.mul(0.011))));
  const nrm = n1.rgb.add(n2.rgb).mul(0.5);
  const alb = texture(maps.albedo, uv0);
  const base = alb.rgb.mul(p.albedoScale).add(p.albedoBias);
  const depth = attribute(WATER_DEPTH_ATTRIBUTE, 'float') as Node<'float'>;
  const tint = mix(base.mul(1.35), base.mul(0.55), depth.div(2.5).saturate());
  m.colorNode = vec4(mix(tint, vertexColor().rgb, h), 1);
  m.normalNode = mix(tangentNormal(nrm, float(0.35)), normalView, h).normalize();
  m.roughnessNode = mix(p.roughBias, float(0.95), h);   // §10.5.6 roughness 0.05 (the def value)
  m.metalnessNode = float(0);
  const tr = p.transmission ?? uniform(0.6);
  m.transmission = tr.value;                            // > 0 enables the transmission path at build time
  m.transmissionNode = tr.mul(oneMinus(h));
  m.ior = 1.333;
  m.side = def.doubleSide ? DoubleSide : FrontSide;
  m.transparent = false;
  return m;
}

/** `normalMap()` typed as the view-space vec3 it produces (the `@types/three` return type is `NormalMapNode`). */
function tangentNormal(n: Node<'vec3'>, scale: Node<'float'>): Node<'vec3'> {
  return normalMap(n, scale) as unknown as Node<'vec3'>;
}
