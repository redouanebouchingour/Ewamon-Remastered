import { describe, expect, it } from 'vitest';
import {
  AOI_CELL,
  AOI_RADIUS,
  cellKey,
  cellOf,
  cellTransition,
  inNeighbourhood,
  inView,
  neighbourCells,
  sameCell,
} from '../src/index';

describe('§4.2 AOI cell math', () => {
  it('cells are 32 units, 3×3 neighbourhood', () => {
    expect(AOI_CELL).toBe(32);
    expect(AOI_RADIUS).toBe(1);
  });

  it('cellOf floors x/32 and z/32 (negatives round toward -∞)', () => {
    expect(cellOf(0, 0)).toEqual([0, 0]);
    expect(cellOf(31.999, 31.999)).toEqual([0, 0]);
    expect(cellOf(32, 0)).toEqual([1, 0]);
    expect(cellOf(-0.001, -32)).toEqual([-1, -1]);
    expect(cellOf(-32.5, 95.9)).toEqual([-2, 2]);
    expect(cellOf(104, -104)).toEqual([3, -4]); // route field edge
  });

  it('non-finite coordinates fall into cell 0 instead of poisoning a key', () => {
    expect(cellOf(Number.NaN, Number.POSITIVE_INFINITY)).toEqual([0, 0]);
    expect(cellKey(cellOf(Number.NaN, 5))).toBe('0,0');
  });

  it('neighbourCells returns the 9 cells sorted row-major', () => {
    const n = neighbourCells([2, -1]);
    expect(n).toHaveLength(9);
    expect(n).toEqual([
      [1, -2], [2, -2], [3, -2],
      [1, -1], [2, -1], [3, -1],
      [1, 0], [2, 0], [3, 0],
    ]);
    expect(new Set(n.map(cellKey)).size).toBe(9);
  });

  it('inNeighbourhood / inView are Chebyshev distance ≤ 1', () => {
    expect(inNeighbourhood([0, 0], [1, 1])).toBe(true);
    expect(inNeighbourhood([0, 0], [-1, 1])).toBe(true);
    expect(inNeighbourhood([0, 0], [2, 0])).toBe(false);
    expect(inNeighbourhood([0, 0], [0, -2])).toBe(false);
    expect(inView([0, 0], 63.9, -31.9)).toBe(true); // cell [1,-1]
    expect(inView([0, 0], 64, 0)).toBe(false); // cell [2,0]
  });

  it('sameCell handles null', () => {
    expect(sameCell(null, null)).toBe(true);
    expect(sameCell(null, [0, 0])).toBe(false);
    expect(sameCell([1, 2], [1, 2])).toBe(true);
    expect(sameCell([1, 2], [2, 1])).toBe(false);
  });

  it('cellTransition on join enters all 9 cells and leaves none', () => {
    const t = cellTransition(null, [0, 0]);
    expect(t.entered).toHaveLength(9);
    expect(t.left).toHaveLength(0);
  });

  it('cellTransition one step east enters the new column of 3 and leaves the old column of 3', () => {
    const t = cellTransition([0, 0], [1, 0]);
    expect(t.entered).toEqual([[2, -1], [2, 0], [2, 1]]);
    expect(t.left).toEqual([[-1, -1], [-1, 0], [-1, 1]]);
  });

  it('cellTransition diagonal step enters/leaves 5 cells each; same cell → nothing', () => {
    const t = cellTransition([0, 0], [1, 1]);
    expect(t.entered).toHaveLength(5);
    expect(t.left).toHaveLength(5);
    expect(t.entered.every((c) => !inNeighbourhood([0, 0], c) && inNeighbourhood([1, 1], c))).toBe(true);
    expect(t.left.every((c) => inNeighbourhood([0, 0], c) && !inNeighbourhood([1, 1], c))).toBe(true);
    expect(cellTransition([3, 3], [3, 3])).toEqual({ entered: [], left: [] });
  });

  it('a jump of two cells replaces the whole neighbourhood', () => {
    const t = cellTransition([0, 0], [3, 0]);
    expect(t.entered).toHaveLength(9);
    expect(t.left).toHaveLength(9);
  });
});
