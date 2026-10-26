/**
 * World effects (SPEC §10.7.8): cloud shadows. Every library surface (terrain, props, buildings, scatter, water) is
 * darkened under a slow noise field that drifts with the wind, so shadows of clouds sweep over the sculpted ground and
 * the cliffs and terraces read by their light. One shared uniform (`SharedUniforms.clouds`: strength, coverage,
 * scale, drift); strength 0 leaves the colour exactly as it was (night, the harvested look, an interior).
 * 2026-10-25 (performance): the two noise octaves run only while the strength is above 0 (`If` on the uniform), so a
 * night, an overcast sky or an interior pays nothing for them.
 */
import type { Node, UniformNode, Vector4 } from 'three/webgpu';
import { Fn, If, float, mx_noise_float, oneMinus, positionWorld, smoothstep, vec2, vec3 } from 'three/tsl';
import type { SharedUniforms } from './harvest.js';

/** Cloud field defaults: a 1 / scale m feature size, the drift speed (m/s) along the wind. */
export const CLOUDS = Object.freeze({ scale: 0.024, driftMps: 2.2, edge: 0.12 });

/**
 * The colour multiplier under the clouds at this fragment: 1 − strength × cover, where cover eases from 0 to 1
 * around the coverage threshold of a two-octave noise drifting along `windDir`. `h` is the harvest blend (level 2
 * draws no cloud shadow).
 */
export function cloudShade(u: SharedUniforms, h: Node<'float'>): Node<'float'> {
  const c = u.clouds;
  if (c === undefined) return float(1);
  const cv = c as unknown as Node<'vec4'>;
  const drift = vec2(u.windDir.x, u.windDir.y).mul(u.windTime.mul(cv.w));
  const p = positionWorld.xz.sub(drift).mul(cv.z);
  const cover = Fn(() => {
    const v = float(0).toVar();
    If(cv.x.greaterThan(0), () => {
      const n = mx_noise_float(vec3(p, u.windTime.mul(0.004))).mul(0.65)
        .add(mx_noise_float(vec3(p.mul(2.7), u.windTime.mul(0.009).add(5.1))).mul(0.35))
        .mul(0.5).add(0.5);
      // coverage 0.35 (the clear default) shades about a third of the ground
      const t = oneMinus(cv.y);
      v.assign(smoothstep(t.sub(CLOUDS.edge), t.add(CLOUDS.edge), n));
    });
    return v;
  })();
  return float(1).sub(cv.x.mul(cover).mul(oneMinus(h)));
}

/** Writes the cloud uniform: strength 0..1 (0 = none), coverage 0..1, the field's scale and drift. */
export function setClouds(u: UniformNode<'vec4', Vector4> | undefined, strength: number, coverage: number): void {
  if (u === undefined) return;
  u.value.set(Math.max(0, Math.min(1, strength)), Math.max(0, Math.min(1, coverage)), CLOUDS.scale, CLOUDS.driftMps);
}
