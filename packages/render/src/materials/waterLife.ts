/**
 * World effects (SPEC §10.7.8): water that lives. Two terms of the §10.5.6 water graph, from its build-time
 * `depthBelow` attribute (level − terrain height):
 * - shore foam: a broken white band where the water meets the bank, breathing in and out with the clock;
 * - caustics: a moving net of light over the shallow bed, seen through the water (in the albedo, so the sun lights it
 *   and night hides it).
 * Each surface sets its own strengths (`SurfaceExtras.foam` / `.caustics`: the sea most, a pond less, the bog almost
 * none) as per-material uniforms: no program is added.
 */
import type { Node, UniformNode } from 'three/webgpu';
import { abs, float, max, mx_noise_float, oneMinus, positionWorld, pow, sin, smoothstep, vec3 } from 'three/tsl';

export const WATER_LIFE = Object.freeze({
  /** foam: band depth (m), breathing amplitude (m) and rate, noise scale, colour (linear) */
  foamDepthM: 0.28, foamBreathM: 0.05, foamHz: 0.2, foamScale: 2.2, foamColor: [0.86, 0.9, 0.92] as const,
  /** foam lines washing in parallel to the shore: spacing in depth (m), speed (m of depth / s) */
  lineDepthM: 0.09, lineSpeed: 0.05,
  /** caustics: shallow band (m), net scale, sharpness, brightness */
  causticsDeepM: 1.8, causticsScale: 0.62, causticsPower: 10, causticsGain: 0.16,
});

export interface WaterLife {
  /** 0..1 foam cover at this fragment */
  readonly foam: Node<'float'>;
  readonly foamColor: Node<'vec3'>;
  /** albedo added by the caustics */
  readonly caustics: Node<'float'>;
}

export function waterLife(depth: Node<'float'>, t: Node<'float'>, foamK: UniformNode<'float', number>, causticsK: UniformNode<'float', number>, h: Node<'float'>): WaterLife {
  const W = WATER_LIFE;
  const p = positionWorld.xz;
  const n = mx_noise_float(vec3(p.mul(W.foamScale), t.mul(0.35))).mul(0.5).add(0.5);
  const breathe = sin(t.mul(W.foamHz * 6.2832).add(n.mul(6))).mul(W.foamBreathM);
  const band = smoothstep(W.foamDepthM, 0, depth.add(breathe));
  // the lip at the bank, then thin lines washing in, all broken by the noise
  const lines = smoothstep(0.55, 0.95, sin(depth.div(W.lineDepthM).sub(t.mul(W.lineSpeed / W.lineDepthM)).mul(6.2832)).mul(0.5).add(0.5));
  const lip = smoothstep(0.6, 0.9, band);
  const foam = max(lip, lines.mul(band)).mul(smoothstep(0.4, 0.75, n.add(band.mul(0.25)))).mul(foamK).mul(oneMinus(h));
  // two drifting ridge nets, the brighter wins: the classic caustic web
  const q = p.mul(W.causticsScale);
  const r1 = pow(oneMinus(abs(mx_noise_float(vec3(q, t.mul(0.4))))), float(W.causticsPower));
  const r2 = pow(oneMinus(abs(mx_noise_float(vec3(q.mul(1.37).add(3.1), t.mul(0.31).add(7))))), float(W.causticsPower));
  const shallow = smoothstep(W.causticsDeepM, 0.3, depth).mul(smoothstep(0, 0.2, depth));
  const caustics = max(r1, r2).mul(shallow).mul(causticsK).mul(W.causticsGain).mul(oneMinus(h)).mul(oneMinus(foam));
  return { foam: foam as Node<'float'>, foamColor: vec3(...W.foamColor), caustics: caustics as Node<'float'> };
}
