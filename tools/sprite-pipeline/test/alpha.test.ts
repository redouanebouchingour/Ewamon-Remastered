import { describe, expect, it } from 'vitest';
import {
  TRANSPARENT_RGB_BAND,
  alphaBbox,
  cleanTransparentRgb,
  defringe,
  floodBackground,
  hasMeaningfulAlpha,
  isSideMismatch,
  recoverAlpha,
} from '../src/alpha.js';
import { createRgba } from '../src/types.js';
import { alphaAt, blob, opaqueFraction, texturedBlob } from './helpers.js';

function borderZeroFraction(img: ReturnType<typeof blob>): number {
  let n = 0;
  let zero = 0;
  const visit = (x: number, y: number): void => {
    n++;
    if (alphaAt(img, x, y) === 0) zero++;
  };
  for (let x = 0; x < img.width; x++) {
    visit(x, 0);
    visit(x, img.height - 1);
  }
  for (let y = 1; y < img.height - 1; y++) {
    visit(0, y);
    visit(img.width - 1, y);
  }
  return zero / n;
}

describe('alpha recovery', () => {
  it('a white background yields >= 99 % transparent border pixels and keeps the body', () => {
    const src = blob(96, [255, 255, 255, 255], [40, 120, 200, 255]);
    const res = recoverAlpha(src);
    expect(res.recovered).toBe(true);
    expect(borderZeroFraction(res.image)).toBeGreaterThanOrEqual(0.99);
    expect(alphaAt(res.image, 48, 52)).toBe(255);
    expect(res.flags).not.toContain('leak');
    expect(res.flags).not.toContain('empty');
    // The body is an ellipse of ~0.3 * 0.36 * PI of the canvas.
    expect(opaqueFraction(res.image)).toBeGreaterThan(0.25);
    expect(opaqueFraction(res.image)).toBeLessThan(0.4);
  });

  it('a magenta key background is removed even when it is not the border mean', () => {
    const src = blob(64, [255, 0, 255, 255], [20, 200, 20, 255]);
    // Paint a white frame so the border mean is white, not magenta: magenta must still key.
    for (let x = 0; x < 64; x++) for (const y of [0, 63]) src.data.set([255, 255, 255, 255], (y * 64 + x) * 4);
    for (let y = 0; y < 64; y++) for (const x of [0, 63]) src.data.set([255, 255, 255, 255], (y * 64 + x) * 4);
    const res = recoverAlpha(src);
    expect(alphaAt(res.image, 4, 4)).toBe(0);
    expect(alphaAt(res.image, 32, 35)).toBe(255);
  });

  it('a source with meaningful alpha is kept as is', () => {
    const src = blob(64, [0, 0, 0, 0], [200, 50, 50, 255]);
    expect(hasMeaningfulAlpha(src)).toBe(true);
    const res = recoverAlpha(src);
    expect(res.recovered).toBe(false);
    for (let i = 3; i < src.data.length; i += 4) expect(res.image.data[i]).toBe(src.data[i]);
  });

  it('flags `leak` when the flood reaches the centre of the bbox', () => {
    // A ring with a gap: the background floods into the hollow centre.
    const size = 96;
    const img = createRgba(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - 48;
        const dy = y - 48;
        const r = Math.hypot(dx, dy);
        const ring = r > 20 && r < 34 && !(dx > 0 && Math.abs(dy) < 3);
        img.data.set(ring ? [90, 40, 160, 255] : [255, 255, 255, 255], (y * size + x) * 4);
      }
    }
    const res = recoverAlpha(img);
    expect(res.flags).toContain('leak');
  });

  it('flags `clipped` when the drawing touches the source edge, `nonsquare` when the canvas is not square', () => {
    const img = createRgba(80, 50);
    for (let y = 0; y < 50; y++) for (let x = 0; x < 80; x++) img.data.set(x < 40 && y < 50 ? [10, 10, 10, 255] : [255, 255, 255, 255], (y * 80 + x) * 4);
    const res = recoverAlpha(img);
    expect(res.flags).toContain('clipped');
    expect(res.flags).toContain('nonsquare');
  });

  it('defringe copies the nearest opaque colour under soft edge pixels', () => {
    const img = blob(32, [0, 0, 0, 0], [200, 100, 50, 255], 0.3);
    // Make a soft pixel just outside the body with the wrong colour.
    const bbox = alphaBbox(img)!;
    const x = bbox.x1 + 1;
    const y = 17;
    img.data.set([255, 255, 255, 120], (y * 32 + x) * 4);
    defringe(img);
    expect([...img.data.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 3)]).toEqual([200, 100, 50]);
  });

  it('transparent RGB rule: a = 0 within 2 px copies the nearest opaque RGB, farther becomes black', () => {
    const size = 64;
    const img = createRgba(size, size);
    // Opaque square 20..43 (green) on a white, already transparent background.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const inside = x >= 20 && x <= 43 && y >= 20 && y <= 43;
        img.data.set(inside ? [30, 200, 60, 255] : [255, 255, 255, 0], (y * size + x) * 4);
      }
    }
    cleanTransparentRgb(img, TRANSPARENT_RGB_BAND);
    const rgb = (x: number, y: number): number[] => [...img.data.subarray((y * size + x) * 4, (y * size + x) * 4 + 3)];
    expect(rgb(19, 30)).toEqual([30, 200, 60]); // 1 px out
    expect(rgb(18, 30)).toEqual([30, 200, 60]); // 2 px out
    expect(rgb(16, 30)).toEqual([0, 0, 0]); // 4 px out
    expect(rgb(2, 2)).toEqual([0, 0, 0]);
    expect(alphaAt(img, 18, 30)).toBe(0); // alpha untouched
    expect(alphaAt(img, 30, 30)).toBe(255);
  });

  it('recoverAlpha leaves no white RGB under transparent pixels of a recovered sprite', () => {
    const res = recoverAlpha(texturedBlob(160, [255, 255, 255, 255], 7));
    let whiteUnderTransparent = 0;
    for (let p = 0; p < 160 * 160; p++) {
      const i = p * 4;
      if (res.image.data[i + 3] === 0 && res.image.data[i]! >= 250 && res.image.data[i + 1]! >= 250 && res.image.data[i + 2]! >= 250) whiteUnderTransparent++;
    }
    expect(whiteUnderTransparent).toBe(0);
  });

  it('floodBackground honours the tolerance override', () => {
    const img = blob(48, [200, 200, 200, 255], [190, 190, 190, 255]);
    const strict = floodBackground({ ...img, data: img.data.slice() }, { tolerance: 10 });
    const loose = floodBackground({ ...img, data: img.data.slice() }, { tolerance: 114 });
    const removed = (m: Uint8Array): number => m.reduce((n, v) => n + v, 0);
    expect(removed(loose)).toBe(48 * 48); // 30 summed difference -> everything is background
    expect(removed(strict)).toBeLessThan(48 * 48);
  });

  it('sidemismatch trips above a 20 % scale difference only', () => {
    expect(isSideMismatch(1, 1.1)).toBe(false);
    expect(isSideMismatch(1, 1.19)).toBe(false);
    expect(isSideMismatch(1, 1.25)).toBe(true);
    expect(isSideMismatch(2.5, 1)).toBe(true);
  });
});
