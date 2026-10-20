/**
 * Pure heightfield sampling shared by the collider (§10.6.1), the layout planners (§10.5.5) and the terrain mesh.
 * No `three` import: node tests and the client adapter call these directly. The arithmetic of `heightAt`,
 * `walkableAt` and `waterAt` is content's `sampleHeight` / `isWalkable` / `isWater` (spine §3.11), statement for
 * statement, so the results are bit-identical.
 */
import type { HeightfieldData } from '../contracts.js';

/** The 16 m unwalkable margin of every field (spine §3.1 extents). */
export const FIELD_MARGIN = 16;

export interface Bounds { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }

export function inField(h: HeightfieldData, x: number, z: number): boolean {
  return x >= h.originX && x <= h.originX + h.size && z >= h.originZ && z <= h.originZ + h.size;
}

/** Bilinear over the 4 surrounding samples. NaN outside the field. */
export function heightAt(h: HeightfieldData, x: number, z: number): number {
  if (!inField(h, x, z)) return NaN;
  const fx = (x - h.originX) / h.step;
  const fz = (z - h.originZ) / h.step;
  let c0 = Math.floor(fx);
  let r0 = Math.floor(fz);
  if (c0 >= h.res - 1) c0 = h.res - 2;
  if (r0 >= h.res - 1) r0 = h.res - 2;
  const u = fx - c0;
  const v = fz - r0;
  const i = r0 * h.res + c0;
  const a = h.heights[i]!;
  const b = h.heights[i + 1]!;
  const c = h.heights[i + h.res]!;
  const d = h.heights[i + h.res + 1]!;
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return top + (bot - top) * v;
}

/** `heightAt` with (x, z) clamped into the field (never NaN). */
/** Scatter keeps off slopes steeper than this, so cliff faces stay bare rock (content `SCATTER_MAX_SLOPE`). */
export const SCATTER_MAX_SLOPE = 0.9;

/** Terrain slope (rise per metre) at the nearest sample by central differences, 0 on the border (content `slopeAt`). */
export function slopeAt(h: HeightfieldData, x: number, z: number): number {
  const col = Math.round((x - h.originX) / h.step); const row = Math.round((z - h.originZ) / h.step);
  if (col < 1 || row < 1 || col >= h.res - 1 || row >= h.res - 1) return 0;
  const i = row * h.res + col;
  const hx = (h.heights[i + 1]! - h.heights[i - 1]!) / (2 * h.step);
  const hz = (h.heights[i + h.res]! - h.heights[i - h.res]!) / (2 * h.step);
  return Math.sqrt(hx * hx + hz * hz);
}

/** A water sample at (x, z) or `d` m from it along ±x / ±z (nearest samples): content `wetNear`, the same five reads. */
export function wetNear(h: HeightfieldData, x: number, z: number, d: number): boolean {
  for (const [ox, oz] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]] as const) {
    const col = Math.round((x + ox - h.originX) / h.step); const row = Math.round((z + oz - h.originZ) / h.step);
    if (col < 0 || row < 0 || col >= h.res || row >= h.res) continue;
    if (h.water[row * h.res + col] === 1) return true;
  }
  return false;
}

export function heightClamped(h: HeightfieldData, x: number, z: number): number {
  const cx = Math.min(h.originX + h.size, Math.max(h.originX, x));
  const cz = Math.min(h.originZ + h.size, Math.max(h.originZ, z));
  return heightAt(h, cx, cz);
}

export function nearestIndex(h: HeightfieldData, x: number, z: number): number {
  const col = Math.round((x - h.originX) / h.step);
  const row = Math.round((z - h.originZ) / h.step);
  return row * h.res + col;
}

/** Nearest sample's walkable bit; false outside. */
export function walkableAt(h: HeightfieldData, x: number, z: number): boolean {
  if (!inField(h, x, z)) return false;
  return h.walkable[nearestIndex(h, x, z)] === 1;
}

/** Nearest sample's water bit; false outside. */
export function waterAt(h: HeightfieldData, x: number, z: number): boolean {
  if (!inField(h, x, z)) return false;
  return h.water[nearestIndex(h, x, z)] === 1;
}

/** The playable interior: field extent shrunk by the 16 m margin. */
export function playableBounds(h: HeightfieldData): Bounds {
  return { minX: h.originX + FIELD_MARGIN, maxX: h.originX + h.size - FIELD_MARGIN, minZ: h.originZ + FIELD_MARGIN, maxZ: h.originZ + h.size - FIELD_MARGIN };
}

/** One connected body of `water` samples (4-neighbour flood fill, row-major discovery order). */
export interface WaterBody {
  readonly id: number;
  readonly cx: number; readonly cz: number;
  /** Radius of the circle with the body's area. */
  readonly r: number;
  readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number;
  /** Surface height: the highest open-water sample + 4 cm, capped 3 cm under the lowest dry sample on the body's border (the shoreline is the mask edge). */
  readonly level: number;
  /** Lowest terrain sample under the body. */
  readonly floor: number;
  readonly samples: number;
  /** Extent of the samples that are both walkable and water (content's boardwalk strip), or null. */
  readonly boardwalk: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number; readonly y: number } | null;
}

/**
 * Flood-fills the water mask into bodies. Pure; deterministic order. `labels` (Phase D8, optional, length res²) receives
 * each water sample's body id (−1 elsewhere) — the collider's per-sample water level.
 */
export function waterBodies(h: HeightfieldData, labels?: Int32Array): WaterBody[] {
  const res = h.res;
  const seen = new Uint8Array(res * res);
  const out: WaterBody[] = [];
  const stack: number[] = [];
  if (labels !== undefined) labels.fill(-1);
  for (let i = 0; i < res * res; i++) {
    if (h.water[i] !== 1 || seen[i] === 1) continue;
    seen[i] = 1; stack.push(i);
    let n = 0; let sx = 0; let sz = 0;
    let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
    let level = -Infinity; let floor = Infinity;
    let bx0 = Infinity; let bx1 = -Infinity; let bz0 = Infinity; let bz1 = -Infinity; let by = -Infinity; let bn = 0;
    let shore = Infinity;
    while (stack.length > 0) {
      const j = stack.pop()!;
      if (labels !== undefined) labels[j] = out.length;
      const row = Math.floor(j / res); const col = j - row * res;
      const x = h.originX + col * h.step; const z = h.originZ + row * h.step;
      const y = h.heights[j]!;
      n++; sx += x; sz += z;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
      if (y < floor) floor = y;
      if (h.walkable[j] === 1) {
        bn++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (z < bz0) bz0 = z; if (z > bz1) bz1 = z; if (y > by) by = y;
      } else if (y > level) level = y;
      if (col > 0) push(j - 1); if (col < res - 1) push(j + 1);
      if (row > 0) push(j - res); if (row < res - 1) push(j + res);
      for (const k of [col > 0 ? j - 1 : -1, col < res - 1 ? j + 1 : -1, row > 0 ? j - res : -1, row < res - 1 ? j + res : -1]) {
        if (k >= 0 && h.water[k] !== 1 && h.heights[k]! < shore) shore = h.heights[k]!;
      }
    }
    if (level === -Infinity) level = floor;
    // the plane sits just under the lowest dry sample bordering the body, so the visible shoreline is the mask edge
    level = Math.min(level + 0.04, shore - 0.03) - 0.04;
    out.push({
      id: out.length, cx: sx / n, cz: sz / n, r: Math.sqrt((n * h.step * h.step) / Math.PI),
      x0, x1, z0, z1, level: level + 0.04, floor, samples: n,
      boardwalk: bn > 0 ? { x0: bx0, x1: bx1, z0: bz0, z1: bz1, y: by } : null,
    });
  }
  return out;

  function push(k: number): void {
    if (h.water[k] === 1 && seen[k] === 0) { seen[k] = 1; stack.push(k); }
  }
}
