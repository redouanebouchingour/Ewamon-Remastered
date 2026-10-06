/**
 * Audit M2-sprite-edge-5 / SPEC §50.1 #6, §10.4.3: the sprite-edge scan. Pure (no DOM, no three): the Node runner
 * (`scripts/harness/shots.ts`) decodes the captured PNG of the scene pass's `mask.y` (the DOF-sharp bit the inspected
 * billboard writes wherever its alpha test passed, pre-TRAA, greyscale 0..255) and calls this; the client runtime never
 * reads pixels.
 *
 * Why the mask channel proves "no intermediate alpha": an alpha-tested billboard writes every attachment of a fragment
 * or none, so its silhouette in `mask.y` is exactly 0 / 255. An alpha-BLENDED (or alpha-to-coverage) sprite would blend
 * every colour attachment by its alpha, leaving intermediate values along the edge — which the scan counts. The
 * magnification (screen px per level-0 texel, ≥ 1.3 required) is measured by the page and recorded beside it.
 *
 * "Straight-edge pixels": silhouette pixels whose outside neighbour lies on the same side along a run of ≥ `minRun`
 * consecutive pixels in a row or column (the horizontal and vertical stretches of the texel staircase). `want` of them
 * (200, §50.1 #6) are sampled evenly; each sample and its 3×3 neighbourhood must hold no value strictly between 0 and
 * 255, and neither may any pixel of the scanned rect.
 */

export interface ScanImage { readonly width: number; readonly height: number; readonly channels: 3 | 4; readonly data: Uint8Array }

export interface EdgeScanResult {
  /** the scanned rect, clamped to the image (CSS px, dpr 1) */
  readonly rect: readonly [number, number, number, number];
  readonly silhouettePx: number;
  /** silhouette pixels with a 4-neighbour outside */
  readonly boundaryPx: number;
  /** boundary pixels on straight runs */
  readonly straightPx: number;
  readonly sampled: number;
  /** sampled pixels (3×3 neighbourhood) with 0 < v < 255 */
  readonly intermediateSampled: number;
  /** every pixel of the rect with 0 < v < 255 */
  readonly intermediateInRect: number;
  readonly want: number;
  readonly pass: boolean;
}

export function scanSpriteEdges(img: ScanImage, rect: readonly [number, number, number, number], want = 200, minRun = 4): EdgeScanResult {
  const x0 = Math.max(1, Math.floor(rect[0])); const y0 = Math.max(1, Math.floor(rect[1]));
  const x1 = Math.min(img.width - 1, Math.ceil(rect[2])); const y1 = Math.min(img.height - 1, Math.ceil(rect[3]));
  const v = (x: number, y: number): number => img.data[(y * img.width + x) * img.channels]!;
  const inside = (x: number, y: number): boolean => v(x, y) >= 128;
  const mid = (x: number, y: number): boolean => { const a = v(x, y); return a > 0 && a < 255; };
  let silhouette = 0; let boundary = 0; let midRect = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (mid(x, y)) midRect++;
    if (!inside(x, y)) continue;
    silhouette++;
    if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) boundary++;
  }
  // straight runs: rows (outside above / below) and columns (outside left / right)
  const straight = new Set<number>();
  const take = (run: number[]): void => { if (run.length >= minRun) for (const i of run) straight.add(i); run.length = 0; };
  const run: number[] = [];
  for (const dy of [-1, 1]) for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) { if (inside(x, y) && !inside(x, y + dy)) run.push(y * img.width + x); else take(run); }
    take(run);
  }
  for (const dx of [-1, 1]) for (let x = x0; x < x1; x++) {
    for (let y = y0; y < y1; y++) { if (inside(x, y) && !inside(x + dx, y)) run.push(y * img.width + x); else take(run); }
    take(run);
  }
  const list = [...straight].sort((a, b) => a - b);
  const n = Math.min(want, list.length);
  let midSampled = 0;
  for (let k = 0; k < n; k++) {
    const i = list[Math.floor((k * list.length) / n)]!;
    const x = i % img.width; const y = Math.floor(i / img.width);
    let bad = false;
    for (let oy = -1; oy <= 1 && !bad; oy++) for (let ox = -1; ox <= 1 && !bad; ox++) if (mid(x + ox, y + oy)) bad = true;
    if (bad) midSampled++;
  }
  return {
    rect: [x0, y0, x1, y1], silhouettePx: silhouette, boundaryPx: boundary, straightPx: list.length, sampled: n,
    intermediateSampled: midSampled, intermediateInRect: midRect, want, pass: n >= want && midSampled === 0 && midRect === 0,
  };
}
