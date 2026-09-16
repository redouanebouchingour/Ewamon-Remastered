/**
 * MaxRects bin packer (best-short-side-fit, with free-rectangle splitting and pruning).
 * Deterministic: insertion order decides placement, no randomness.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export class MaxRectsPacker {
  private free: Rect[];
  readonly placed: Rect[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.free = [{ x: 0, y: 0, w: width, h: height }];
  }

  /** Places a w x h rect; returns its position or null when the bin is full. */
  insert(w: number, h: number): Rect | null {
    let best: Rect | null = null;
    let bestShort = Infinity;
    let bestLong = Infinity;
    for (const f of this.free) {
      if (f.w < w || f.h < h) continue;
      const leftoverH = f.w - w;
      const leftoverV = f.h - h;
      const short = Math.min(leftoverH, leftoverV);
      const long = Math.max(leftoverH, leftoverV);
      // Tie-break on position so equal fits resolve in a stable top-left order.
      if (short < bestShort || (short === bestShort && (long < bestLong || (long === bestLong && best && (f.y < best.y || (f.y === best.y && f.x < best.x)))))) {
        best = { x: f.x, y: f.y, w, h };
        bestShort = short;
        bestLong = long;
      }
    }
    if (!best) return null;
    this.split(best);
    this.prune();
    this.placed.push(best);
    return best;
  }

  private split(used: Rect): void {
    const next: Rect[] = [];
    for (const f of this.free) {
      if (!rectsOverlap(f, used)) {
        next.push(f);
        continue;
      }
      if (used.x > f.x) next.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h });
      if (used.x + used.w < f.x + f.w) next.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - (used.x + used.w), h: f.h });
      if (used.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y });
      if (used.y + used.h < f.y + f.h) next.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - (used.y + used.h) });
    }
    this.free = next;
  }

  private prune(): void {
    const keep: Rect[] = [];
    outer: for (let i = 0; i < this.free.length; i++) {
      const a = this.free[i]!;
      for (let j = 0; j < this.free.length; j++) {
        if (i === j) continue;
        const b = this.free[j]!;
        if (contains(b, a) && (j < i || !contains(a, b))) continue outer;
      }
      keep.push(a);
    }
    this.free = keep;
  }
}

/** Packs `count` equal squares of `size` into a `bin` x `bin` atlas; throws if they do not fit. */
export function packSquares(count: number, size: number, bin: number): Rect[] {
  const packer = new MaxRectsPacker(bin, bin);
  const out: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const r = packer.insert(size, size);
    if (!r) throw new Error(`packSquares: ${count} x ${size}px do not fit in ${bin}px`);
    out.push(r);
  }
  return out;
}
