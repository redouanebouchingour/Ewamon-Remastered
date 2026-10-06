/**
 * Phase E3 (audit M2-sprite-edge-5): the harness's sprite-edge scan (`src/harness/edgeScan.ts`) on synthetic `mask.y`
 * captures — a nearest-magnified, alpha-tested silhouette passes; a blended (soft) edge or a sprite too small to give
 * 200 straight-edge pixels does not.
 */
import { describe, expect, it } from 'vitest';
import { scanSpriteEdges } from '../src/harness/edgeScan';
import type { ScanImage } from '../src/harness/edgeScan';

/** A 64×64-texel round creature silhouette magnified `mag`× with nearest sampling (a texel staircase), greyscale RGB. */
function silhouette(mag: number, soft: boolean, w = 400, h = 400): ScanImage {
  const data = new Uint8Array(w * h * 3);
  const tex = 64; const ox = 40; const oy = 40;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const tx = Math.floor((x - ox) / mag); const ty = Math.floor((y - oy) / mag);
    if (tx < 0 || ty < 0 || tx >= tex || ty >= tex) continue;
    const r = Math.hypot(tx + 0.5 - tex / 2, (ty + 0.5 - tex / 2) * 1.3);
    let v = r < 26 ? 255 : 0;
    if (soft && r >= 25 && r < 27.5) v = 128;           // a blended rim (alpha blending / bilinear alpha)
    const o = (y * w + x) * 3;
    data[o] = v; data[o + 1] = v; data[o + 2] = v;
  }
  return { width: w, height: h, channels: 3, data };
}

describe('E3 sprite-edge scan', () => {
  it('a nearest-magnified alpha-tested silhouette passes: ≥ 200 straight-edge pixels, no intermediate value', () => {
    const r = scanSpriteEdges(silhouette(4, false), [30, 30, 370, 370]);
    expect(r.sampled).toBe(200);
    expect(r.straightPx).toBeGreaterThan(200);
    expect(r.intermediateSampled).toBe(0);
    expect(r.intermediateInRect).toBe(0);
    expect(r.pass).toBe(true);
  });

  it('a blended edge fails', () => {
    const r = scanSpriteEdges(silhouette(4, true), [30, 30, 370, 370]);
    expect(r.intermediateInRect).toBeGreaterThan(0);
    expect(r.intermediateSampled).toBeGreaterThan(0);
    expect(r.pass).toBe(false);
  });

  it('a sprite too small for 200 straight-edge pixels does not pass', () => {
    const r = scanSpriteEdges(silhouette(0.6, false), [30, 30, 370, 370]);
    expect(r.sampled).toBeLessThan(200);
    expect(r.pass).toBe(false);
  });

  it('clamps the rect to the image', () => {
    const r = scanSpriteEdges(silhouette(4, false), [-50, -50, 9999, 9999]);
    expect(r.rect).toEqual([1, 1, 399, 399]);
  });
});
