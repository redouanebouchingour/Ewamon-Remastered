/**
 * MRT outputs for NON-opaque objects drawn inside the scene pass (contact decals §10.4.7, VFX §10.7.5).
 *
 * three 0.186 (`WebGPUPipelineUtils.createRenderPipeline`): the per-attachment blend state comes from the RENDERER's
 * MRT (`renderObject.context.mrt`, i.e. the scene pass's `mrt({ output, normal, velocity, mask })`), where only
 * `output` uses the material blending and every other attachment is `NoBlending`. Blend modes set on a material's
 * own `mrtNode` are merged into the shader outputs but never reach the pipeline. A transparent decal or particle
 * therefore OVERWRITES normal / velocity / mask wherever it rasterises (measured: a particle writing a zero normal
 * turned GTAO's result into NaN — black squares — in the sandbox).
 *
 * So these materials write VALID values into those targets and alpha-test at a tiny threshold (fully transparent
 * texels write nothing):
 * - normal: the object's own view normal (a decal lies on the ground: its normal is the ground's) or, for camera-
 *   facing particles, the view axis;
 * - velocity: the scene default (the object's own);
 * - mask, particles: (1, 0) — no GTAO darkening under a glow, never DOF-sharp (§10.7.5: "VFX never writes
 *   mask.y = 1");
 * - mask, decals: (0, 0) — deviation from §10.4.7 ("excluded from GTAO via the mask.x channel like sprites"): the
 *   decal covers GROUND pixels, and excluding them from GTAO removed the ground's own contact occlusion inside the
 *   decal disc, which read as a light halo around every creature's feet in the sandbox (IMPLEMENTATION-NOTES Q14).
 */
import type { MRTNode } from 'three/webgpu';
import { mrt, vec2, vec4 } from 'three/tsl';

/** Alpha below which an overlay texel is discarded (so it writes no MRT channel at all). */
export const OVERLAY_ALPHA_CUT = 0.004;

/**
 * `cameraFacing = true` (particles: no normal attribute) writes the view axis as the normal and mask (1, 0);
 * otherwise (decals) the scene's `normalView`/velocity of the object are kept and the mask is (0, 0).
 */
export function overlayMrt(cameraFacing: boolean): MRTNode {
  return cameraFacing
    ? mrt({ normal: vec4(0, 0, 1, 1), mask: vec2(1, 0) })
    : mrt({ mask: vec2(0, 0) });
}
