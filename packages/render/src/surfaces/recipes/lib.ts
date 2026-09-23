/**
 * Shared painting helpers for recipes. Pure math over Float32Arrays, resolution-independent (tile units),
 * torus-aware when a surface wraps.
 */
import type { Noise, Orm, Rgb, ScalarField } from '../recipe';

export type Vec3 = readonly [number, number, number];
export const TAU = Math.PI * 2;

// ─── seamless noise in tile coordinates ─────────────────────────────────────────────────────────

/** Noise sampled in tile coordinates at an integer frequency per tile: seamless over u, v ∈ [0, 1). */
export interface TiledNoise {
  fbm(u: number, v: number, octaves: number, lacunarity?: number, gain?: number): number;
  value(u: number, v: number): number;
  worley(u: number, v: number, jitter?: number): { f1: number; f2: number; id: number };
  /** Hash of an integer cell (wrapped to the period). */
  hash(ix: number, iy: number): number;
  readonly fx: number; readonly fy: number;
}

/**
 * `tiled(n, 2, 24).fbm(u, v, 5)` ≡ `fbm2(u·2, v·24, 5)` on a torus. Frequencies are rounded to integers ≥ 1
 * (a non-integer frequency cannot tile). `salt` decorrelates two uses of the same frequency.
 */
export function tiled(n: Noise, fx: number, fy: number = fx, salt = 0): TiledNoise {
  const ix = Math.max(1, Math.round(fx)), iy = Math.max(1, Math.round(fy));
  const p = n.periodic(ix, iy);
  const ox = salt * ix, oy = salt * 7 * iy;   // integer lattice offsets keep the wrap exact
  return {
    fx: ix, fy: iy,
    fbm: (u, v, oct, lac, gain) => p.fbm2(u * ix + ox, v * iy + oy, oct, lac, gain),
    value: (u, v) => p.valueNoise2(u * ix + ox, v * iy + oy),
    worley: (u, v, j) => p.worley2(u * ix + ox, v * iy + oy, j),
    hash: (a, b) => p.hash21(a + ox, b + oy),
  };
}

// ─── scalar math ──────────────────────────────────────────────────────────────────────────────────

export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const fract = (x: number): number => x - Math.floor(x);
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = sat((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** Wrapped distance on the unit circle (torus coordinate difference), in [-0.5, 0.5). */
export const wrapDelta = (d: number): number => d - Math.round(d);

// ─── colour ───────────────────────────────────────────────────────────────────────────────────────

export const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linearToSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** '#rrggbb' → linear RGB. */
export function hex(h: string): Vec3 {
  const n = parseInt(h.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}

export const scale3 = (c: Vec3, k: number): Vec3 => [c[0] * k, c[1] * k, c[2] * k];
export const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** Rotate hue by `deg` (YIQ-style rotation around the grey axis, luminance-preserving to first order). */
export function hueShift(c: Vec3, deg: number): Vec3 {
  const a = (deg * Math.PI) / 180;
  const cosA = Math.cos(a), sinA = Math.sin(a);
  const k = 1 / 3, sq = Math.sqrt(1 / 3);
  const m00 = cosA + (1 - cosA) * k, m01 = k * (1 - cosA) - sq * sinA, m02 = k * (1 - cosA) + sq * sinA;
  const m10 = k * (1 - cosA) + sq * sinA, m11 = cosA + k * (1 - cosA), m12 = k * (1 - cosA) - sq * sinA;
  const m20 = k * (1 - cosA) - sq * sinA, m21 = k * (1 - cosA) + sq * sinA, m22 = cosA + k * (1 - cosA);
  return [
    Math.max(0, c[0] * m00 + c[1] * m01 + c[2] * m02),
    Math.max(0, c[0] * m10 + c[1] * m11 + c[2] * m12),
    Math.max(0, c[0] * m20 + c[1] * m21 + c[2] * m22),
  ];
}

export function setRgb(rgb: Rgb, i: number, c: Vec3, k = 1): void {
  rgb.data[i * 3] = c[0] * k;
  rgb.data[i * 3 + 1] = c[1] * k;
  rgb.data[i * 3 + 2] = c[2] * k;
}

// ─── iteration ────────────────────────────────────────────────────────────────────────────────────

/** Visit every texel with its tile coordinates (texel centres). */
export function each(f: { readonly width: number; readonly height: number }, fn: (u: number, v: number, i: number, x: number, y: number) => void): void {
  const W = f.width, H = f.height;
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let x = 0; x < W; x++) fn((x + 0.5) / W, v, y * W + x, x, y);
  }
}

export const fill = (a: Float32Array, value: number): void => { a.fill(value); };

/** Per-bake auxiliary buffers keyed by the heightfield object (height → albedo → orm share them). */
const AUX = new WeakMap<ScalarField, Map<string, Float32Array>>();
export function aux(h: ScalarField, key: string, init = 0): Float32Array {
  let m = AUX.get(h);
  if (!m) { m = new Map(); AUX.set(h, m); }
  let a = m.get(key);
  if (!a) { a = new Float32Array(h.width * h.height); if (init !== 0) a.fill(init); m.set(key, a); }
  return a;
}

// ─── stamps (torus-aware) ─────────────────────────────────────────────────────────────────────────

/**
 * Visit the texels of an (optionally rotated) ellipse centred at (cu, cv) with radii (ru, rv) in tile units.
 * `fn(nx, ny, i)` receives the texel's coordinates in the ellipse frame normalised by the radii (so
 * nx² + ny² ≤ 1 inside) and its index. With `wrap` the stamp wraps around the tile edges, else it clips.
 */
export function stamp(
  f: { readonly width: number; readonly height: number },
  cu: number, cv: number, ru: number, rv: number, angle: number, wrap: boolean,
  fn: (nx: number, ny: number, i: number) => void,
): void {
  const W = f.width, H = f.height;
  const c = Math.cos(angle), s = Math.sin(angle);
  const ext = Math.max(ru, rv);
  const ex = Math.abs(c) * ru + Math.abs(s) * rv, ey = Math.abs(s) * ru + Math.abs(c) * rv;
  const bu = Math.min(ext, ex), bv = Math.min(ext, ey);
  const x0 = Math.floor((cu - bu) * W - 0.5), x1 = Math.ceil((cu + bu) * W - 0.5);
  const y0 = Math.floor((cv - bv) * H - 0.5), y1 = Math.ceil((cv + bv) * H - 0.5);
  for (let py = y0; py <= y1; py++) {
    let yy = py;
    if (wrap) yy = ((py % H) + H) % H;
    else if (py < 0 || py >= H) continue;
    const dv = (py + 0.5) / H - cv;
    for (let px = x0; px <= x1; px++) {
      let xx = px;
      if (wrap) xx = ((px % W) + W) % W;
      else if (px < 0 || px >= W) continue;
      const du = (px + 0.5) / W - cu;
      const lx = (du * c + dv * s) / ru;
      const ly = (-du * s + dv * c) / rv;
      if (lx * lx + ly * ly <= 1) fn(lx, ly, yy * W + xx);
    }
  }
}

/**
 * Rasterise a tapered stroke from (u0, v0) along `angle` (radians, 0 = +v) of `len` tile units with widths
 * w0 → w1 (tile units). `fn(t, across, i)`: t ∈ [0,1] along, across ∈ [-1,1] normalised across.
 */
export function stroke(
  f: { readonly width: number; readonly height: number },
  u0: number, v0: number, angle: number, len: number, w0: number, w1: number, wrap: boolean,
  fn: (t: number, across: number, i: number) => void,
): void {
  const W = f.width, H = f.height;
  const du = Math.sin(angle), dv = Math.cos(angle);
  const wmax = Math.max(w0, w1) * 0.5 + 1 / W;
  const ue = u0 + du * len, ve = v0 + dv * len;
  const x0 = Math.floor((Math.min(u0, ue) - wmax) * W), x1 = Math.ceil((Math.max(u0, ue) + wmax) * W);
  const y0 = Math.floor((Math.min(v0, ve) - wmax) * H), y1 = Math.ceil((Math.max(v0, ve) + wmax) * H);
  for (let py = y0; py <= y1; py++) {
    let yy = py;
    if (wrap) yy = ((py % H) + H) % H;
    else if (py < 0 || py >= H) continue;
    const pv = (py + 0.5) / H - v0;
    for (let px = x0; px <= x1; px++) {
      let xx = px;
      if (wrap) xx = ((px % W) + W) % W;
      else if (px < 0 || px >= W) continue;
      const pu = (px + 0.5) / W - u0;
      const along = pu * du + pv * dv;
      if (along < 0 || along > len) continue;
      const t = along / len;
      const halfW = mix(w0, w1, t) * 0.5 + 0.5 / W;
      const across = pu * dv - pv * du;
      if (Math.abs(across) > halfW) continue;
      fn(t, across / halfW, yy * W + xx);
    }
  }
}

// ─── field operations ────────────────────────────────────────────────────────────────────────────

export function normalize01(a: Float32Array): void {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < a.length; i++) { const x = a[i]!; if (x < lo) lo = x; if (x > hi) hi = x; }
  const k = hi > lo ? 1 / (hi - lo) : 0;
  for (let i = 0; i < a.length; i++) a[i] = (a[i]! - lo) * k;
}

export function clampField(a: Float32Array): void {
  for (let i = 0; i < a.length; i++) a[i] = sat(a[i]!);
}

/** Separable box blur (radius in texels), torus or clamped; three passes ≈ Gaussian. */
export function blur(src: Float32Array, W: number, H: number, radius: number, wrap: boolean, passes = 3): Float32Array {
  let a = Float32Array.from(src);
  let b = new Float32Array(src.length);
  const r = Math.max(1, Math.round(radius));
  const n = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      const row = y * W;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[row + (wrap ? ((k % W) + W) % W : clamp(k, 0, W - 1))]!;
      for (let x = 0; x < W; x++) {
        b[row + x] = acc / n;
        const xo = x - r, xi = x + r + 1;
        acc -= a[row + (wrap ? ((xo % W) + W) % W : clamp(xo, 0, W - 1))]!;
        acc += a[row + (wrap ? xi % W : clamp(xi, 0, W - 1))]!;
      }
    }
    [a, b] = [b, a];
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[(wrap ? ((k % H) + H) % H : clamp(k, 0, H - 1)) * W + x]!;
      for (let y = 0; y < H; y++) {
        b[y * W + x] = acc / n;
        const yo = y - r, yi = y + r + 1;
        acc -= a[(wrap ? ((yo % H) + H) % H : clamp(yo, 0, H - 1)) * W + x]!;
        acc += a[(wrap ? yi % H : clamp(yi, 0, H - 1)) * W + x]!;
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

/** Fill ORM roughness from a function of (height, u, v, i). */
export function roughFrom(o: Orm, fn: (i: number) => number): void {
  for (let i = 0; i < o.rough.length; i++) o.rough[i] = fn(i);
}

/** Random-walk crack mask (1 px at the reference size) drawn into `mask` (max-combined). */
export function crackWalk(
  mask: Float32Array, W: number, H: number, r: () => number, u0: number, v0: number, steps: number,
  stepLen: number, wrap: boolean, turn = 0.45, branch = 0.02, depth = 1,
): void {
  let u = u0, v = v0, a = r() * TAU;
  for (let s = 0; s < steps; s++) {
    a += (r() - 0.5) * turn;
    u += Math.cos(a) * stepLen; v += Math.sin(a) * stepLen;
    let x = Math.floor(u * W), y = Math.floor(v * H);
    if (wrap) { x = ((x % W) + W) % W; y = ((y % H) + H) % H; }
    else if (x < 0 || y < 0 || x >= W || y >= H) break;
    const i = y * W + x;
    const d = depth * (1 - (s / steps) * 0.5);
    if (d > mask[i]!) mask[i] = d;
    if (branch > 0 && r() < branch && depth > 0.3) crackWalk(mask, W, H, r, u, v, Math.floor(steps * 0.3), stepLen, wrap, turn, 0, depth * 0.6);
  }
}

// ─── pattern primitives ──────────────────────────────────────────────────────────────────────────

/** Signed distance to a rounded rectangle centred at the origin (half extents bx, by; corner radius r). */
export function sdRoundRect(px: number, py: number, bx: number, by: number, r: number): number {
  const qx = Math.abs(px) - bx + r, qy = Math.abs(py) - by + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - r;
}

export interface CourseCell {
  /** Stable id of the stone/brick in [0, 1). */
  readonly id: number;
  /** Distance (tile units) from the texel to the nearest joint centre-line. */
  readonly edge: number;
  /** Row index and position inside the cell, 0..1 each. */
  readonly row: number; readonly cu: number; readonly cv: number;
  /** Cell size in tile units. */
  readonly w: number; readonly h: number;
}

/**
 * Running-bond courses: `rows` courses per tile, `cols` units per course, alternate courses offset by
 * `offset` of a unit; periodic in both axes. With `jitter` > 0 the joints wander (irregular ashlar): each
 * course gets its own per-joint offsets derived from `hash(row, k)`.
 */
export function courses(
  u: number, v: number, rows: number, cols: number, offset: number, jitter: number,
  hash: (a: number, b: number) => number,
): CourseCell {
  const fv = v * rows;
  const row = Math.floor(fv);
  const rr = ((row % rows) + rows) % rows;
  const cv = fv - row;
  const shift = (rr % 2) * offset + (jitter > 0 ? hash(rr, 991) * jitter : 0);
  const fu = u * cols - shift;
  let k = Math.floor(fu);
  // jittered joint positions: joint k sits at k + j(k)
  let left = k, right = k + 1;
  if (jitter > 0) {
    const jk = (kk: number): number => kk + (hash(rr, ((kk % cols) + cols) % cols) - 0.5) * jitter;
    left = jk(k); right = jk(k + 1);
    if (fu < left) { k -= 1; right = left; left = jk(k); }
    else if (fu >= right) { k += 1; left = right; right = jk(k + 1); }
  }
  const w = right - left;
  const cu = (fu - left) / w;
  const kk = ((k % cols) + cols) % cols;
  const eu = Math.min(fu - left, right - fu) / cols;
  const ev = Math.min(cv, 1 - cv) / rows;
  return { id: hash(rr * 131 + 7, kk * 17 + 3), edge: Math.min(eu, ev), row: rr, cu, cv, w: w / cols, h: 1 / rows };
}

/**
 * Irregular coursed stone: `rows` courses of varying height (±`rowJitter`), each with minCols…maxCols stones
 * of varying length; periodic in both axes. Built once per recipe and queried per texel.
 */
export function makeAshlar(
  hash: (a: number, b: number) => number, rows: number, minCols: number, maxCols: number, rowJitter: number, jointJitter: number,
): (u: number, v: number) => CourseCell {
  const hts: number[] = [];
  for (let r = 0; r < rows; r++) hts.push(1 + (hash(r, 401) - 0.5) * 2 * rowJitter);
  const tot = hts.reduce((a, b) => a + b, 0);
  const edges = [0];
  for (let r = 0; r < rows; r++) edges.push(edges[r]! + hts[r]! / tot);
  const joints: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const n = minCols + Math.floor(hash(r, 402) * (maxCols - minCols + 1));
    const shift = hash(r, 403);
    const js: number[] = [];
    for (let k = 0; k < n; k++) js.push((k + shift + (hash(r, 500 + k) - 0.5) * jointJitter) / n);
    joints.push(js);
  }
  return (u, v) => {
    const vv = v - Math.floor(v);
    let r = 0;
    while (r < rows - 1 && vv >= edges[r + 1]!) r++;
    const v0 = edges[r]!, v1 = edges[r + 1]!;
    const js = joints[r]!;
    const uu = u - Math.floor(u);
    let left = -Infinity, right = Infinity, kL = 0;
    for (let k = 0; k < js.length; k++) {
      for (let wk = -1; wk <= 1; wk++) {
        const j = js[k]! + wk;
        if (j <= uu && j > left) { left = j; kL = k; }
        if (j > uu && j < right) right = j;
      }
    }
    const w = right - left, h = v1 - v0;
    const edge = Math.min(uu - left, right - uu, vv - v0, v1 - vv);
    return { id: hash(r * 131 + 7, kL * 17 + 3), edge, row: r, cu: (uu - left) / w, cv: (vv - v0) / h, w, h };
  };
}
