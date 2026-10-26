/**
 * World effects (SPEC §10.7.8): weather that changes the ground. Two shared uniforms drive every library surface:
 * - `wetness` (§10.2.3, already ramped by the day cycle): wet ground darkens (a little everywhere, more on the
 *   surfaces that respond to wetness: roads, cobbles, flagstones, roofs) and, on those surfaces where they lie flat,
 *   puddles form in a slow noise field: dark, mirror-smooth, the geometry normal (so they reflect the sky);
 * - `frost` (addition, 0..1, ramped like wetness under hail): rime settles on upward faces, broken by noise, in a cool
 *   white.
 * Both are 0 in clear weather, where the colour, roughness and normal are exactly what they were.
 *
 * 2026-10-25 (performance, render IMPLEMENTATION-NOTES "Cheaper shadows and reflections"): the noise fields are only
 * evaluated while their uniform is up (`If` on a uniform: every fragment takes the same branch), so a dry, frost-free
 * frame runs none of the three Perlin noises it used to run on every lit fragment. The result is identical: below the
 * gate the old graph multiplied the noise by 0. The puddle and coarse frost fields are 2D noise (they were 3D at a
 * constant z; the pattern changes, not its scale or cover).
 */
import type { Node } from 'three/webgpu';
import { Fn, If, float, mix, mx_noise_float, normalWorld, oneMinus, positionWorld, smoothstep, step, vec2, vec3 } from 'three/tsl';
import type { SharedUniforms } from './harvest.js';

export const WEATHER_SURFACE = Object.freeze({
  /** albedo × at full wetness: every solid / on a wet-responding surface */
  wetDarkAll: 0.86, wetDarkResponse: 0.7,
  /** puddles: feature size (1 / m), how much of the flat wet ground they cover at full wetness, their albedo × and roughness */
  puddleScale: 0.32, puddleCover: 0.42, puddleDark: 0.5, puddleRough: 0.05,
  /** wetness below which the ground takes no puddle (the noise is skipped) */
  puddleGate: 0.02,
  /** flatness (normal.y) above which a puddle can lie */
  flatFrom: 0.9, flatTo: 0.97,
  /** frost: upward faces from / to, noise scale, colour (linear), and its most (a patchy rime, never a snowfield) */
  frostFrom: 0.55, frostTo: 0.85, frostScale: 4.5, frostCoarse: 0.35, frost: [0.78, 0.84, 0.92] as const, frostMax: 0.5,
});
/** Frost ramp: up over 6 s of hail, down over 20 s (s). */
export const FROST_RISE_S = 6;
export const FROST_FALL_S = 20;

/** Linear frost ramp toward `target` (0 or 1). Pure. */
export function stepFrost(current: number, target: number, dtS: number): number {
  if (!(dtS > 0)) return current;
  if (current < target) return Math.min(target, current + dtS / FROST_RISE_S);
  if (current > target) return Math.max(target, current - dtS / FROST_FALL_S);
  return current;
}

export interface WeatherSurface {
  /** colour multiplier and the frost blend: `rgb' = mix(rgb × dark, frostColour, frost)` */
  readonly dark: Node<'float'>;
  readonly frost: Node<'float'>;
  readonly frostColor: Node<'vec3'>;
  /** 0..1: how much of this fragment is puddle (roughness → `puddleRough`, normal → the geometry's) */
  readonly puddle: Node<'float'>;
}

/** The weather's hold on one fragment. `response` = the surface's wetness response (0 / 1); `h` the harvest blend. */
export function weatherSurface(u: SharedUniforms, response: Node<'float'>, h: Node<'float'>): WeatherSurface {
  const W = WEATHER_SURFACE;
  const wet = u.wetness.mul(oneMinus(h));
  const ny = normalWorld.y;
  const flat = smoothstep(W.flatFrom, W.flatTo, ny);
  // the puddle field only while the ground is wet (below the gate `step` zeroes the puddle anyway)
  const n = Fn(() => {
    const v = float(0).toVar();
    If(u.wetness.greaterThan(W.puddleGate), () => {
      v.assign(mx_noise_float(positionWorld.xz.mul(W.puddleScale).add(vec2(0.37, 0))).mul(0.5).add(0.5));
    });
    return v;
  })();
  // the puddle threshold falls as the ground soaks: dry → none, full wet → `puddleCover` of the flat ground
  const puddle = smoothstep(oneMinus(wet.mul(W.puddleCover)), oneMinus(wet.mul(W.puddleCover)).add(0.06), n).mul(flat).mul(response).mul(step(W.puddleGate, wet));
  const dark = mix(float(1), mix(float(W.wetDarkAll), float(W.wetDarkResponse), response), wet).mul(mix(float(1), float(W.puddleDark), puddle));
  const fu = u.frost === undefined ? float(0) : (u.frost as unknown as Node<'float'>);
  // a fine grain of rime, thicker and thinner over a soft coarse field (no hard-edged patches); only under frost
  const grain = Fn(() => {
    const v = float(0).toVar();
    If(fu.greaterThan(0), () => {
      const fine = mx_noise_float(vec3(positionWorld.xz.mul(W.frostScale), positionWorld.y.mul(2))).mul(0.5).add(0.5);
      const coarse = mx_noise_float(positionWorld.xz.mul(W.frostCoarse).add(vec2(2.3, 0))).mul(0.5).add(0.5);
      v.assign(smoothstep(0.3, 0.85, fine.mul(0.55).add(coarse.mul(0.45)).add(fu.mul(0.1))));
    });
    return v;
  })();
  const frost = fu.mul(W.frostMax).mul(smoothstep(W.frostFrom, W.frostTo, ny)).mul(grain).mul(oneMinus(h));
  return { dark: dark as Node<'float'>, frost: frost as Node<'float'>, frostColor: vec3(...W.frost), puddle: puddle as Node<'float'> };
}
