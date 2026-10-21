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
import { abs, float, length, max, modelWorldMatrix, mx_noise_float, sin, smoothstep, uv, vec2, vec3, vec4 } from 'three/tsl';
import type { SharedUniforms } from './harvest.js';

export interface WindParams {
  readonly amplitude: UniformNode<'float', number>;
  readonly frequency: UniformNode<'float', number>;
  /** Cards: weight by `uv.y` (0 at the stem). Trunks: weight by height / 6 m. */
  readonly stiffnessFromUv: boolean;
  /**
   * World effects (§10.7.8, addition): 1 when walkers push this card aside (tall grass), else 0. Cards only; the
   * pushers are the shared `push` uniforms. A uniform, so every card keeps one program.
   */
  readonly push?: UniformNode<'float', number>;
}

/** How far a pusher bends a blade tip sideways and presses it down (m at full strength, × the card's stiffness). */
export const PUSH_BEND_M = 0.5;
export const PUSH_PRESS_M = 0.32;

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
  let d: Node<'vec3'> = vec3(u.windDir.x, 0, u.windDir.y).mul(sway.mul(w.amplitude).mul(gust).mul(q));
  if (w.push !== undefined && u.push !== undefined) d = d.add(pushDisplace(wp, u.push).mul(q.mul(w.push)));
  return pv.add(d);
}

/**
 * World effects (§10.7.8): blades bend away from each pusher (x, z, radius, strength) and press down, full inside a
 * quarter of the radius and nothing at it. A negative strength (the spring-back after a walker left) bends them back
 * the other way. Returns the displacement at full stiffness.
 */
export function pushDisplace(wp: Node<'vec3'>, push: readonly UniformNode<'vec4', unknown>[]): Node<'vec3'> {
  let bend: Node<'vec2'> = vec2(0, 0);
  let press: Node<'float'> = float(0);
  for (const p of push) {
    const pv = p as unknown as Node<'vec4'>;
    const dxz = wp.xz.sub(pv.xy);
    const dist = max(length(dxz), float(0.05));
    const f = smoothstep(pv.z, pv.z.mul(0.25), dist).mul(pv.w);
    bend = bend.add(dxz.div(dist).mul(f));
    press = press.add(abs(f));
  }
  return vec3(bend.x.mul(PUSH_BEND_M), press.min(1).mul(-PUSH_PRESS_M), bend.y.mul(PUSH_BEND_M));
}
