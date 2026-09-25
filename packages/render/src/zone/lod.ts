/**
 * SPEC §10.5.7 — LOD tiers and scatter chunking (pure; no `three` construction).
 *
 * Tiers are chosen per chunk from the distance of the chunk centre to the camera: 0–40 m LOD0, 40–90 m LOD1,
 * 90–160 m LOD2, > 160 m impostor, with 4 m hysteresis (a chunk leaves its tier only 4 m past the boundary).
 */

export type Tier = 0 | 1 | 2 | 3;

/** Tier boundaries in metres (LOD0|LOD1, LOD1|LOD2, LOD2|impostor). */
export const LOD_DISTANCES: readonly [number, number, number] = [40, 90, 160];
export const LOD_HYSTERESIS = 4;
/** Scatter / static chunk edge (the AOI cell of spine §4.2). */
export const CHUNK_SIZE = 32;
/** `THREE.LOD` levels for buildings and set-pieces: `addLevel(lod0, 0), addLevel(lod1, 40, 0.1), addLevel(lod2, 90, 0.1)`. */
export const BUILDING_LOD_LEVELS: readonly { readonly distance: number; readonly hysteresis: number }[] = [
  { distance: 0, hysteresis: 0 }, { distance: 40, hysteresis: 0.1 }, { distance: 90, hysteresis: 0.1 },
];

/** Raw tier for a distance (no hysteresis). */
export function tierFor(distance: number): Tier {
  if (distance < LOD_DISTANCES[0]) return 0;
  if (distance < LOD_DISTANCES[1]) return 1;
  if (distance < LOD_DISTANCES[2]) return 2;
  return 3;
}

/**
 * Tier with hysteresis: moving outward, a boundary is crossed at `d ≥ boundary + h`; moving inward at
 * `d < boundary − h`. Between those the previous tier is kept.
 */
export function chooseTier(distance: number, prev: Tier, h = LOD_HYSTERESIS): Tier {
  const raw = tierFor(distance);
  if (raw === prev) return prev;
  if (raw > prev) {
    // outward: the boundary just past `prev` must be exceeded by h
    let t = prev;
    while (t < 3 && distance >= (LOD_DISTANCES as readonly number[])[t]! + h) t = (t + 1) as Tier;
    return t;
  }
  let t = prev;
  while (t > 0 && distance < LOD_DISTANCES[t - 1]! - h) t = (t - 1) as Tier;
  return t;
}

/** Chunk grid over a square field of `size` metres centred on the origin. */
export interface ChunkGrid { readonly size: number; readonly cells: number; readonly origin: number; readonly cell: number }

export function chunkGrid(fieldSize: number, cell = CHUNK_SIZE): ChunkGrid {
  const cells = Math.ceil(fieldSize / cell);
  return { size: fieldSize, cells, origin: -(cells * cell) / 2, cell };
}

/** Chunk index (row-major) of a world point, clamped into the grid. */
export function chunkOf(g: ChunkGrid, x: number, z: number): number {
  const cx = Math.min(g.cells - 1, Math.max(0, Math.floor((x - g.origin) / g.cell)));
  const cz = Math.min(g.cells - 1, Math.max(0, Math.floor((z - g.origin) / g.cell)));
  return cz * g.cells + cx;
}

/** World centre (x, z) of a chunk index. */
export function chunkCentre(g: ChunkGrid, i: number): readonly [number, number] {
  const cz = Math.floor(i / g.cells); const cx = i - cz * g.cells;
  return [g.origin + (cx + 0.5) * g.cell, g.origin + (cz + 0.5) * g.cell];
}
