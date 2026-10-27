/** `bodyVOf`: the share of a normalised cell's height its opaque texels span (the renderer sizes the card by it). */
import { describe, expect, it } from 'vitest';
import { bodyVOf } from '../src/pipeline.js';
import { createRgba } from '../src/types.js';

function cell(rows: readonly [number, number], alpha: number) {
  const img = createRgba(16, 100);
  for (let y = rows[0]; y <= rows[1]; y++) img.data[(y * 16 + 8) * 4 + 3] = alpha;
  return img;
}

describe('bodyVOf', () => {
  it('spans the opaque rows only (the atlas binarises alpha at 128)', () => {
    expect(bodyVOf(cell([10, 91], 255))).toBe(0.82);
    expect(bodyVOf(cell([10, 91], 127))).toBe(0);
    expect(bodyVOf(createRgba(16, 100))).toBe(0);
  });
});
