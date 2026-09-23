/**
 * SPEC §10.2.5 — wind vertex animation. The same `positionNode` feeds the shadow pass
 * (`Renderer._getShadowNodes` falls back to `positionNode`), so shadows sway with the geometry.
 *
 * Deviation from the SPEC's block (recorded in IMPLEMENTATION-NOTES.md): the SPEC writes
 * `Fn(([p, amp, freq, stiffUv], u) => …)`, but a TSL `Fn` callback's second argument is the
 * `NodeBuilder`, not user data. This is therefore a plain graph factory closing over the shared
 * uniforms, and `stiffnessFromUv` is resolved at graph-build time (a JS boolean) instead of a
 * runtime `select` — the two variants are different programs anyway.
 */
import type { Node, UniformNode } from 'three/webgpu';
import { modelWorldMatrix, mx_noise_float, sin, uv, vec3, vec4 } from 'three/tsl';
import type { SharedUniforms } from './harvest.js';

export interface WindParams {
  readonly amplitude: UniformNode<'float', number>;
  readonly frequency: UniformNode<'float', number>;
  /** Cards: weight by `uv.y` (0 at the stem). Trunks: weight by height / 6 m. */
  readonly stiffnessFromUv: boolean;
}

/** §10.2.5 amplitudes and frequencies (also carried by `SURFACES[id].wind`). */
export const WIND_TRUNK_HEIGHT_M = 6.0;

/**
 * Displaces a local-space position by the shared wind field. Returns the new local position.
 * `p` is normally `positionLocal`.
 */
export function windDisplace(p: Node, w: WindParams, u: SharedUniforms): Node {
  const pv = p as Node<'vec3'>;
  const wp = modelWorldMatrix.mul(vec4(pv, 1)).xyz;
  const phase = wp.x.mul(0.35).add(wp.z.mul(0.21)).add(u.windTime.mul(w.frequency));
  const gust = mx_noise_float(vec3(wp.xz.mul(0.05), u.windTime.mul(0.07))).mul(0.5).add(0.5);   // 0..1 slow gust field
  const sway = sin(phase).mul(0.7).add(sin(phase.mul(2.3).add(1.7)).mul(0.3));
  const weight = w.stiffnessFromUv ? uv().y : pv.y.div(WIND_TRUNK_HEIGHT_M).clamp(0, 1);
  const q = weight.mul(weight);                                                                // quadratic stiffness
  const d = vec3(u.windDir.x, 0, u.windDir.y).mul(sway.mul(w.amplitude).mul(gust).mul(q));
  return pv.add(d);
}
