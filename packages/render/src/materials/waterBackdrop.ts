/**
 * The water's backdrop (IMPLEMENTATION-NOTES "Water backdrop without transmission", deviation from §10.5.6's
 * `MeshPhysicalNodeMaterial` with transmission). What the water shows of the bed and the bank under it.
 *
 * three 0.186's transmission (`PhysicalLightingModel`, `getIBLVolumeRefraction`) samples `viewportOpaqueMipTexture()`.
 * It copies the scene pass's colour target and builds its whole mip chain once per render, then reads it with a
 * two-level bicubic filter. Measured, the cost is the copy itself: `Renderer.copyFramebufferToTexture` ends the scene
 * pass (4 HalfFloat MRT targets + depth) and reopens it with `loadOp: load` (`WebGPUBackend.copyFramebufferToTexture`).
 * A copy of one pixel costs as much as the full-size one.
 *
 * So the water keeps three's own backdrop hook instead (`NodeMaterial.backdropNode` / `backdropAlphaNode`: `LightsNode`
 * mixes the diffuse toward it exactly as it does for transmission). It reads ONE shared copy with a single trilinear
 * tap, nudged by the water normal like a refraction. `setWaterBackdrop(b, false)` (the `medium` / `low` presets) zeroes
 * the weight and stops the copy: `updateBefore` returns before `copyFramebufferToTexture`, so the scene pass is never
 * split. Both are runtime switches on one program.
 */
import { FramebufferTexture, LinearFilter, LinearMipmapLinearFilter, ViewportTextureNode } from 'three/webgpu';
import type { Node, NodeFrame, UniformNode } from 'three/webgpu';
import {
  EnvironmentBRDF, diffuseContribution, float, log2, normalView, normalViewGeometry, oneMinus, positionViewDirection, roughness, screenSize, screenUV,
  specularColorBlended, specularF90, uniform,
} from 'three/tsl';

export const WATER_BACKDROP = Object.freeze({
  /**
   * Build the copy's mip chain (one extra small pass per level) so a rough water (the harvest blend raises roughness
   * to 0.95) still sees a blurred bed, as with three's transmission.
   */
  mips: true,
  /** three's `applyIorToRoughness` factor for the water's IOR 1.333: clamp(2 × ior − 2, 0, 1). */
  iorRough: 0.666,
  /** refraction: screen-UV shift per unit of view-space normal tilt, reached at `refractDeepM` of water (0 at the bank) */
  refractUv: 0.012,
  refractDeepM: 1,
});

/** A `ViewportTextureNode` whose copy can be switched off; clones (`.sample()`, `.level()`) read the switch on their base. */
class WaterBackdropNode extends ViewportTextureNode {
  on = true;

  override updateBefore(frame: NodeFrame): boolean | undefined {
    if (!(this.getBase() as WaterBackdropNode).on) return undefined;   // no copy: the scene pass stays one pass
    super.updateBefore(frame);
    return undefined;
  }
}

export interface WaterBackdrop {
  /** The shared copy: one per render target per render, however many water materials read it. */
  readonly node: ViewportTextureNode;
  /** 1 = the backdrop is mixed in, 0 = tint, caustics and foam only (`setWaterBackdrop`). */
  readonly weight: UniformNode<'float', number>;
}

export function createWaterBackdrop(): WaterBackdrop {
  const tex = new FramebufferTexture(1, 1);   // resized to the drawing buffer by the first copy
  tex.magFilter = LinearFilter;
  tex.minFilter = WATER_BACKDROP.mips ? LinearMipmapLinearFilter : LinearFilter;
  const node = new WaterBackdropNode(screenUV, null, tex);
  node.generateMipmaps = WATER_BACKDROP.mips;
  return { node, weight: uniform(1).setName('ewaWaterBackdrop') };
}

/** Quality switch (`QualityProfile.waterBackdrop`): writes a uniform and a flag, compiles nothing. */
export function setWaterBackdrop(b: WaterBackdrop, on: boolean): void {
  (b.node as WaterBackdropNode).on = on;
  b.weight.value = on ? 1 : 0;
}

export function waterBackdropOn(b: WaterBackdrop): boolean {
  return (b.node as WaterBackdropNode).on;
}

/**
 * three's `getIBLVolumeRefraction` with the water's zero thickness (the refracted ray ends where it starts): the
 * backdrop under the fragment × the diffuse colour × (1 − the environment Fresnel). Read by `LightsNode` inside the
 * lighting stack, so the property nodes hold this fragment's values. `depth` is the water's `depthBelow` (m).
 */
export function waterBackdropColor(b: WaterBackdrop, depth: Node<'float'>): Node<'vec3'> {
  const W = WATER_BACKDROP;
  const dotNV = normalView.dot(positionViewDirection).clamp();
  const fresnel = EnvironmentBRDF({ dotNV, specularColor: specularColorBlended, specularF90, roughness }) as unknown as Node<'vec3'>;
  const shift = normalView.sub(normalViewGeometry).xy.mul(depth.div(W.refractDeepM).saturate().mul(W.refractUv));
  const lod = W.mips ? log2(screenSize.x).mul(roughness).mul(W.iorRough) : float(0);
  const seen = b.node.sample(screenUV.add(shift)).level(lod);
  return oneMinus(fresnel).mul(diffuseContribution).mul(seen.rgb) as unknown as Node<'vec3'>;
}
