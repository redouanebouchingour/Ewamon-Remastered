/**
 * Test support: A* over a zone's content heightfield whose every edge is accepted by the server's own movement
 * predicate (`segmentStandable`, the rule `validateInput` applies), so a walker following the result never sends an
 * `input` the room rejects as `unwalkable`. Used by the progression walk (progression-*.test.ts).
 */
import { playableBounds } from '@ewa/content';
import type { Heightfield, LinkDir, RectSolid, ZoneDef } from '@ewa/content';
import { NO_GATES, segmentStandable, standable } from '../src/rooms/movement';
import { HANDOVER_TRIGGER_M } from '../src/rooms/ZoneRoom';

export type Pt = readonly [number, number];

/** A goal: within `radius` of a point, or across the handover trigger line of one link side. */
export type Goal = { readonly kind: 'point'; readonly x: number; readonly z: number; readonly radius: number } | { readonly kind: 'edge'; readonly dir: LinkDir };

/** Metres inside the trigger line a walker aims for (the trigger is `HANDOVER_TRIGGER_M` from the playable edge). */
const EDGE_AIM_M = 0.75;
/** Nodes this close to a linked edge that is NOT the goal are avoided (no accidental handover). */
const EDGE_KEEP_OUT_M = HANDOVER_TRIGGER_M + 0.3;

class Heap {
  private readonly idx: number[] = [];
  private readonly key: number[] = [];
  get size(): number {
    return this.idx.length;
  }
  push(i: number, k: number): void {
    this.idx.push(i);
    this.key.push(k);
    let c = this.idx.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.key[p]! <= this.key[c]!) break;
      this.swap(c, p);
      c = p;
    }
  }
  pop(): number {
    const top = this.idx[0]!;
    const li = this.idx.pop()!;
    const lk = this.key.pop()!;
    if (this.idx.length > 0) {
      this.idx[0] = li;
      this.key[0] = lk;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1;
        const r = l + 1;
        let m = c;
        if (l < this.idx.length && this.key[l]! < this.key[m]!) m = l;
        if (r < this.idx.length && this.key[r]! < this.key[m]!) m = r;
        if (m === c) break;
        this.swap(c, m);
        c = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.idx[a], this.idx[b]] = [this.idx[b]!, this.idx[a]!];
    [this.key[a], this.key[b]] = [this.key[b]!, this.key[a]!];
  }
}

function inTrigger(zone: ZoneDef, h: Heightfield, x: number, z: number, dir: LinkDir, margin: number): boolean {
  const b = playableBounds(h);
  if (zone.links[dir] === undefined) return false;
  if (dir === 'e') return x >= b.maxX - margin;
  if (dir === 'w') return x <= b.minX + margin;
  if (dir === 's') return z >= b.maxZ - margin;
  return z <= b.minZ + margin;
}

/**
 * Shortest path from `from` to the goal as a list of sample centres (the first entry is `from` itself). Every
 * consecutive pair passes `segmentStandable` — with the player's closed interior gates (`gates`, Phase A: the room
 * refuses movement into them per player), so a path never runs through a gate the player has not opened. Hall
 * walls are stamped into the heightfield and need nothing extra. null when the goal is unreachable.
 */
export function findPath(zone: ZoneDef, h: Heightfield, from: Pt, goal: Goal, gates: readonly RectSolid[] = NO_GATES): Pt[] | null {
  const res = h.res;
  const step = h.step;
  const cx = (i: number): number => h.originX + (i % res) * step;
  const cz = (i: number): number => h.originZ + Math.floor(i / res) * step;
  const dirs = (['n', 'e', 's', 'w'] as const).filter((d) => zone.links[d] !== undefined && !(goal.kind === 'edge' && goal.dir === d));
  const b = playableBounds(h);
  const nodeOk = (x: number, z: number): boolean => {
    if (!standable(h, x, z, false, gates)) return false;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
    for (const d of dirs) if (inTrigger(zone, h, x, z, d, EDGE_KEEP_OUT_M)) return false;
    return true;
  };
  const isGoal = (x: number, z: number): boolean =>
    goal.kind === 'point' ? Math.hypot(x - goal.x, z - goal.z) <= goal.radius : inTrigger(zone, h, x, z, goal.dir, HANDOVER_TRIGGER_M - EDGE_AIM_M);
  const heur = (x: number, z: number): number => {
    if (goal.kind === 'point') return Math.max(0, Math.hypot(x - goal.x, z - goal.z) - goal.radius);
    const t = HANDOVER_TRIGGER_M - EDGE_AIM_M;
    if (goal.dir === 'e') return Math.max(0, b.maxX - t - x);
    if (goal.dir === 'w') return Math.max(0, x - (b.minX + t));
    if (goal.dir === 's') return Math.max(0, b.maxZ - t - z);
    return Math.max(0, z - (b.minZ + t));
  };
  // start: the nearest sample centres reachable in one legal segment from `from`
  const c0 = Math.round((from[0] - h.originX) / step);
  const r0 = Math.round((from[1] - h.originZ) / step);
  const g = new Float64Array(res * res).fill(Infinity);
  const came = new Int32Array(res * res).fill(-1);
  const closed = new Uint8Array(res * res);
  const open = new Heap();
  const START = -2;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = r0 + dr;
      const c = c0 + dc;
      if (r < 0 || c < 0 || r >= res || c >= res) continue;
      const i = r * res + c;
      const x = cx(i);
      const z = cz(i);
      if (!nodeOk(x, z) && !(standable(h, x, z, false, gates) && isGoal(x, z))) continue;
      const d = Math.hypot(x - from[0], z - from[1]);
      if (d > 0 && !segmentStandable(h, from[0], from[1], x, z, false, gates)) continue;
      if (d < g[i]!) {
        g[i] = d;
        came[i] = START;
        open.push(i, d + heur(x, z));
      }
    }
  }
  const NB: readonly (readonly [number, number, number])[] = [
    [0, 1, 1],
    [1, 0, 1],
    [0, -1, 1],
    [-1, 0, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  let found = -1;
  while (open.size > 0) {
    const i = open.pop();
    if (closed[i] === 1) continue;
    closed[i] = 1;
    const x = cx(i);
    const z = cz(i);
    if (isGoal(x, z)) {
      found = i;
      break;
    }
    const r = Math.floor(i / res);
    const c = i - r * res;
    for (const [dr, dc, cost] of NB) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= res || cc >= res) continue;
      const j = rr * res + cc;
      if (closed[j] === 1) continue;
      const nx = cx(j);
      const nz = cz(j);
      const goalNode = isGoal(nx, nz);
      if (!nodeOk(nx, nz) && !(goalNode && standable(h, nx, nz, false, gates))) continue;
      if (!segmentStandable(h, x, z, nx, nz, false, gates)) continue;
      const ng = g[i]! + cost * step;
      if (ng < g[j]!) {
        g[j] = ng;
        came[j] = i;
        open.push(j, ng + heur(nx, nz));
      }
    }
  }
  if (found === -1) return null;
  const out: Pt[] = [];
  for (let i = found; i !== START; i = came[i]!) out.push([cx(i), cz(i)]);
  out.push([from[0], from[1]]);
  out.reverse();
  return out;
}

/** Path length in metres. */
export function pathLength(p: readonly Pt[]): number {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
  return d;
}

/**
 * Merges consecutive path points into straight steps of at most `maxStep` metres, each accepted by
 * `segmentStandable` (checked, not assumed — a merged chord samples different points than its parts).
 */
export function steps(h: Heightfield, p: readonly Pt[], maxStep: number, gates: readonly RectSolid[] = NO_GATES): Pt[] {
  if (p.length === 0) return [];
  const out: Pt[] = [p[0]!];
  let i = 0;
  while (i < p.length - 1) {
    let j = i + 1;
    while (j + 1 < p.length) {
      const a = p[i]!;
      const c = p[j + 1]!;
      if (Math.hypot(c[0] - a[0], c[1] - a[1]) > maxStep || !segmentStandable(h, a[0], a[1], c[0], c[1], false, gates)) break;
      j++;
    }
    out.push(p[j]!);
    i = j;
  }
  return out;
}
