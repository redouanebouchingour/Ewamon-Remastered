/**
 * §4.2 AOI cell math — pure. Cell size 32 world units; a client sees the 3×3 block around its own
 * cell. The server's AoiGrid (30-server-netcode.md §30.2.5) and the client's interest tests both
 * derive from these functions so they can never disagree on which cell a coordinate is in.
 */

export const AOI_CELL = 32;
/** 3×3: one cell on each side of the viewer's own. */
export const AOI_RADIUS = 1;

export type Cell = readonly [number, number];

/** `[floor(x / 32), floor(z / 32)]`. NaN/±Infinity are clamped to cell 0 rather than poisoning a key. */
export function cellOf(x: number, z: number): Cell {
  return [cellIndex(x), cellIndex(z)];
}

/** Integer cell index along one axis. */
export function cellIndex(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.floor(v / AOI_CELL);
}

/** Stable string key for a cell (Map/Set friendly). */
export function cellKey(c: Cell): string {
  return c[0] + ',' + c[1];
}

export function sameCell(a: Cell | null, b: Cell | null): boolean {
  if (a === null || b === null) return a === b;
  return a[0] === b[0] && a[1] === b[1];
}

/** The 9 cells of the 3×3 block around `c`, sorted row-major (z-major, then x). */
export function neighbourCells(c: Cell): readonly Cell[] {
  const out: Cell[] = [];
  for (let dz = -AOI_RADIUS; dz <= AOI_RADIUS; dz++) {
    for (let dx = -AOI_RADIUS; dx <= AOI_RADIUS; dx++) out.push([c[0] + dx, c[1] + dz]);
  }
  return out;
}

/** True when `target` is inside the 3×3 block around `viewer` (Chebyshev distance ≤ 1). */
export function inNeighbourhood(viewer: Cell, target: Cell): boolean {
  return Math.abs(viewer[0] - target[0]) <= AOI_RADIUS && Math.abs(viewer[1] - target[1]) <= AOI_RADIUS;
}

/** True when the world position (x, z) is inside the 3×3 block around `viewer`. */
export function inView(viewer: Cell, x: number, z: number): boolean {
  return inNeighbourhood(viewer, cellOf(x, z));
}

/**
 * A viewer moved from `from` to `to` (or joined, `from === null`): the cells that entered its 3×3
 * and the cells that left it, each sorted row-major. Entities in `entered` get `view.add`, entities
 * in `left` get `view.remove` (§4.2). When `from` and `to` are equal both lists are empty.
 */
export function cellTransition(
  from: Cell | null,
  to: Cell,
): { readonly entered: readonly Cell[]; readonly left: readonly Cell[] } {
  const next = neighbourCells(to);
  if (from === null) return { entered: next, left: [] };
  if (sameCell(from, to)) return { entered: [], left: [] };
  const prev = neighbourCells(from);
  const entered = next.filter((c) => !inNeighbourhood(from, c));
  const left = prev.filter((c) => !inNeighbourhood(to, c));
  return { entered, left };
}
