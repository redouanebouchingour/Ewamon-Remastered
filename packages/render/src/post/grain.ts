/**
 * Film grain as a zero-mean, luminance-weighted modulation (SPEC §10.8.2 as amended 2026-09-30; audit M2-spawn-noon-13).
 *
 * three 0.186's `FilmNode` mixes `base` with `base + base · clamp(noise + 0.1, 0, 1)`: its noise is never negative, so
 * at intensity 0.035 it brightened every pixel by ≈ +2.1 % and toggling reduced effects changed the exposure, while the
 * grain itself stayed below a level of the 8-bit output. This node writes `c · (1 + k · (n − 0.5) · w(L))`: `n` is a
 * per-pixel, per-frame uniform hash (mean 0.5), `w(L) = 4 L (1 − L)` puts the grain in the mid-tones and keeps blacks
 * black and whites white, and `k = intensity` (0.052 → σ ≈ 1.5 % of the value at mid-grey). Mean-preserving, so full
 * and reduced effects agree in exposure. A `TempNode` class so the graph tests can find it (absent, not zeroed, when
 * `effects.grain` is false).
 */
import { TempNode } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { float, fract, hash, luminance, screenCoordinate, time, vec4 } from 'three/tsl';

export class GrainNode extends TempNode {
  static override get type(): string { return 'GrainNode'; }

  constructor(readonly inputNode: Node, readonly intensityNode: Node) {
    super('vec4');
  }

  override setup(): Node {
    const input = this.inputNode as Node<'vec4'>;
    const base = input.rgb;
    // decorrelated per pixel and per frame: the screen position plus a frame-varying offset (time advances per frame)
    const seed = screenCoordinate.x.floor().add(screenCoordinate.y.floor().mul(4096)).add(fract(time.mul(0.6180339887)).mul(65536).floor());
    const n = hash(seed);
    const l = luminance(base).clamp(0, 1);
    const w = l.mul(float(1).sub(l)).mul(4);
    const k = (this.intensityNode as Node<'float'>).mul(n.sub(0.5)).mul(w);
    return vec4(base.mul(k.add(1)), input.a);
  }
}

/** `grain(input, intensity)` — the post graph's grain stage. */
export function grain(input: Node, intensity: Node): GrainNode {
  return new GrainNode(input, intensity);
}

/** CPU mirror of the grain modulation for one pixel value (tests): `c · (1 + k · (n − 0.5) · 4L(1 − L))`. */
export function grainChannel(c: number, luma: number, k: number, n: number): number {
  const l = Math.min(1, Math.max(0, luma));
  return c * (1 + k * (n - 0.5) * 4 * l * (1 - l));
}
