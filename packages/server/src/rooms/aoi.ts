/**
 * §30.2.5 AOI grid — pure. 32-unit cells, 3×3 neighbourhood (spine §4.2). No Colyseus import: `Viewer` is
 * structural (a `StateView` satisfies it). The cell math is protocol's (`cellOf`, `neighbourCells`), so the
 * server and the client can never disagree on which cell a coordinate is in.
 *
 * The grid indexes two populations:
 *   - entities (players and spawns) by the cell they were last `place`d in;
 *   - viewers (one per client, id = player uuid) by the cell of their last `moveViewer`.
 * A viewer sees an entity iff the entity's cell is inside the viewer's 3×3. A viewer never "sees" its own
 * entity through the grid (own `PlayerState` is added once at join and never removed by AOI).
 */
import { AOI_CELL, cellKey, cellOf as protocolCellOf, inNeighbourhood, neighbourCells, sameCell } from '@ewa/protocol';
import type { Cell } from '@ewa/protocol';

export { AOI_CELL };
export type { Cell };

export interface Viewer {
  add(e: object): unknown;
  remove(e: object): unknown;
}

export interface AoiEntity {
  readonly id: string;
  x: number;
  z: number;
}

/** [Math.floor(x / AOI_CELL), Math.floor(z / AOI_CELL)] */
export function cellOf(x: number, z: number): Cell {
  return protocolCellOf(x, z);
}

/** The 9 cells, sorted row-major. */
export function neighbours(c: Cell): readonly Cell[] {
  return neighbourCells(c);
}

interface Placed<E> {
  readonly e: E;
  cell: Cell;
}

export class AoiGrid<E extends AoiEntity> {
  private readonly entities = new Map<string, Placed<E>>();
  private readonly entityCells = new Map<string, Set<string>>();
  private readonly viewers = new Map<string, Cell>();
  private readonly viewerCells = new Map<string, Set<string>>();

  private static addTo(index: Map<string, Set<string>>, c: Cell, id: string): void {
    const k = cellKey(c);
    let s = index.get(k);
    if (s === undefined) {
      s = new Set();
      index.set(k, s);
    }
    s.add(id);
  }

  private static removeFrom(index: Map<string, Set<string>>, c: Cell, id: string): void {
    const k = cellKey(c);
    const s = index.get(k);
    if (s === undefined) return;
    s.delete(id);
    if (s.size === 0) index.delete(k);
  }

  /** Viewer ids whose 3×3 contains cell `c` (i.e. viewers standing in one of c's 9 neighbours). */
  private viewersOf(c: Cell, exceptId: string): Set<string> {
    const out = new Set<string>();
    for (const n of neighbourCells(c)) {
      const s = this.viewerCells.get(cellKey(n));
      if (s === undefined) continue;
      for (const v of s) if (v !== exceptId) out.add(v);
    }
    return out;
  }

  /** Entity moved or was created: updates its cell; returns the viewers whose 3x3 it entered/left. */
  place(e: E): { readonly entered: readonly string[]; readonly left: readonly string[] } {
    const to = cellOf(e.x, e.z);
    const prev = this.entities.get(e.id);
    if (prev === undefined) {
      this.entities.set(e.id, { e, cell: to });
      AoiGrid.addTo(this.entityCells, to, e.id);
      return { entered: [...this.viewersOf(to, e.id)].sort(), left: [] };
    }
    if (sameCell(prev.cell, to)) return { entered: [], left: [] };
    const before = this.viewersOf(prev.cell, e.id);
    const after = this.viewersOf(to, e.id);
    AoiGrid.removeFrom(this.entityCells, prev.cell, e.id);
    AoiGrid.addTo(this.entityCells, to, e.id);
    prev.cell = to;
    const entered: string[] = [];
    const left: string[] = [];
    for (const v of after) if (!before.has(v)) entered.push(v);
    for (const v of before) if (!after.has(v)) left.push(v);
    return { entered: entered.sort(), left: left.sort() };
  }

  /** Viewers that could see it (the caller calls `view.remove` on each before deleting it from the map). */
  removeEntity(e: E | { readonly id: string }): readonly string[] {
    const prev = this.entities.get(e.id);
    if (prev === undefined) return [];
    const seenBy = this.viewersOf(prev.cell, e.id);
    AoiGrid.removeFrom(this.entityCells, prev.cell, e.id);
    this.entities.delete(e.id);
    return [...seenBy].sort();
  }

  /** Viewer moved (or joined, `from === null`): entities newly inside / no longer inside its 3x3. */
  moveViewer(viewerId: string, from: Cell | null, to: Cell): { readonly show: readonly E[]; readonly hide: readonly E[] } {
    const current = this.viewers.get(viewerId) ?? null;
    const origin = from ?? current;
    if (current !== null) AoiGrid.removeFrom(this.viewerCells, current, viewerId);
    this.viewers.set(viewerId, to);
    AoiGrid.addTo(this.viewerCells, to, viewerId);
    if (origin !== null && sameCell(origin, to)) return { show: [], hide: [] };
    const show: E[] = [];
    const hide: E[] = [];
    for (const n of neighbourCells(to)) {
      if (origin !== null && inNeighbourhood(origin, n)) continue;
      const s = this.entityCells.get(cellKey(n));
      if (s === undefined) continue;
      for (const id of s) if (id !== viewerId) show.push(this.entities.get(id)!.e);
    }
    if (origin !== null) {
      for (const n of neighbourCells(origin)) {
        if (inNeighbourhood(to, n)) continue;
        const s = this.entityCells.get(cellKey(n));
        if (s === undefined) continue;
        for (const id of s) if (id !== viewerId) hide.push(this.entities.get(id)!.e);
      }
    }
    return { show, hide };
  }

  removeViewer(viewerId: string): void {
    const c = this.viewers.get(viewerId);
    if (c === undefined) return;
    AoiGrid.removeFrom(this.viewerCells, c, viewerId);
    this.viewers.delete(viewerId);
  }

  /** The cell a viewer was last moved to, or null. */
  viewerCell(viewerId: string): Cell | null {
    return this.viewers.get(viewerId) ?? null;
  }

  /** 3x3 union, for interact/engage range checks. */
  entitiesNear(c: Cell): readonly E[] {
    const out: E[] = [];
    for (const n of neighbourCells(c)) {
      const s = this.entityCells.get(cellKey(n));
      if (s === undefined) continue;
      for (const id of s) out.push(this.entities.get(id)!.e);
    }
    return out;
  }

  /** True when entity `id` is inside the 3x3 around `c`. */
  isNear(c: Cell, id: string): boolean {
    const p = this.entities.get(id);
    return p !== undefined && inNeighbourhood(c, p.cell);
  }

  /** Viewer ids whose 3x3 contains the given world position (chat fan-out: viewers that can see the sender). */
  viewersAt(x: number, z: number): readonly string[] {
    return [...this.viewersOf(cellOf(x, z), '')].sort();
  }

  get stats(): { cells: number; entities: number; viewers: number } {
    return { cells: this.entityCells.size, entities: this.entities.size, viewers: this.viewers.size };
  }
}
