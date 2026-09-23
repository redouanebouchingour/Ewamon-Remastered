/**
 * SurfaceRecipe contract (SPEC §40.3.2, verbatim) plus the deterministic noise the recipes paint with.
 *
 * Pure TypeScript: no three, no DOM, no node builtins. The Node bake (`tools/material-bake`) imports this
 * through the `@ewa/render/surfaces` subpath; the browser never executes a recipe.
 *
 * Coordinates: every recipe works in tile units (u, v ∈ [0, 1)); a texel (x, y) of a `size`-square buffer is
 * sampled at ((x + 0.5) / size, (y + 0.5) / size). Row 0 is v ≈ 0 (the first row in the KTX2 file, which three
 * uploads at v = 0 because compressed textures are never flipped).
 */
import type { SurfaceDef } from './types';

// ─── §40.3.2 verbatim ────────────────────────────────────────────────────────────────────────────

export interface ScalarField { readonly width: number; readonly height: number; readonly data: Float32Array }      // row-major, 0..1, pre-zeroed
export interface Rgb   { readonly width: number; readonly height: number; readonly data: Float32Array }      // 3 floats per texel, linear 0..1 (converted to sRGB on write)
export interface Orm   { readonly width: number; readonly height: number; readonly ao: Float32Array; readonly rough: Float32Array; readonly metal: Float32Array }  // pre-filled 1 / 0.5 / 0

export interface Noise {
  hash21(x: number, y: number): number;                          // deterministic, [0,1)
  valueNoise2(x: number, y: number): number;
  fbm2(x: number, y: number, octaves: number, lacunarity?: number, gain?: number): number;   // defaults 2.03 / 0.5
  worley2(x: number, y: number, jitter?: number): { f1: number; f2: number; id: number };   // cells, for stone/scale
  rng(seed: string): () => number;                               // sfc32 seeded from sha256(seed); the only randomness
  /**
   * Additive to the verbatim interface (IMPLEMENTATION-NOTES D3): a view of the same noise whose lattice wraps
   * with period (px, py) in the caller's noise-space units, so `periodic(6, 18).fbm2(u·6, v·18, 5)` over
   * u, v ∈ [0, 1) is seamless. fbm octave frequencies are snapped so every octave's period is integral.
   */
  periodic(px: number, py?: number): Noise;
}

/** `SURFACES[id]` as plain JSON (the bake passes the same object the manifest hashes). */
export type SurfaceDefJson = SurfaceDef;

export interface RecipeCtx {
  readonly id: string; readonly size: number;                    // 512 (field) | 1024 (hero) — the recipe is resolution-independent; every coordinate is in tile units
  readonly metres: number;                                       // physical tile size the texture covers (u = v); repeat is world-constant in the shader
  readonly noise: Noise;
  readonly def: SurfaceDefJson;                                  // SURFACES[id] from packages/render dist/surfaces.json
}

export interface SurfaceRecipe {
  readonly id: string;
  readonly hero: boolean;                                        // = SurfaceDef.hero; true → bake both tiers (512² + 1024²), false → 512² only
  readonly metres: number;                                       // e.g. 3 for terrain (10-render.md §10.2.4 triplanar 1/3.0), 2 for walls, 1 for small props
  /** Always called first. Writes the heightfield the normal is derived from and that the other two painters may read. */
  height(h: ScalarField, c: RecipeCtx): void;
  /** Paints linear RGB. May read h. The bake clamps luminance to ≤ 0.85 after painting and reports how many texels it clamped. */
  albedo(rgb: Rgb, h: ScalarField, c: RecipeCtx): void;
  /** Writes AO / roughness / metalness in place. May read h. AO defaults to a cavity term derived from h if the recipe leaves `ao` untouched. */
  orm(o: Orm, h: ScalarField, c: RecipeCtx): void;
  /** Sobel gain for normalFromHeight. 0.35 fine pores … 0.9 deep relief. */
  readonly normalStrength: number;
  /** 'repeat' (seamless: the painters are written on a torus, the bake asserts the wrap seam error) or 'clamp'. */
  readonly wrap: 'repeat' | 'clamp';
  /** §40.3.5: per-surface RDO quality scalar when a map is over its byte target (default 2.0). */
  readonly rdo?: number;
}

// ─── additive (IMPLEMENTATION-NOTES D4) ──────────────────────────────────────────────────────────

/** For card surfaces (`SurfaceDef.alphaTest !== null`) the bake passes an Rgb that also carries alpha (pre-filled 1). */
export interface CardRgb extends Rgb { readonly alpha: Float32Array }
export function hasAlpha(rgb: Rgb): rgb is CardRgb {
  return (rgb as Partial<CardRgb>).alpha instanceof Float32Array;
}

/**
 * The pixel size a recipe's "N px" numbers refer to (SPEC §40.3.6 `size` column): 1024 for hero surfaces, 512
 * otherwise. `px(n) = n / refSize` tile units, so a 6 px mortar joint is 6 px at 1024² and 3 px at 512².
 */
export function refSize(r: Pick<SurfaceRecipe, 'hero'>): number {
  return r.hero ? 1024 : 512;
}

// ─── SHA-256 (pure TS; used for rng seeds and noise seeds) ──────────────────────────────────────

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

/** SHA-256 of a string (UTF-8) or bytes, as 8 big-endian words. */
export function sha256Words(input: string | Uint8Array): Uint32Array {
  const msg = typeof input === 'string' ? utf8(input) : input;
  const bitLen = msg.length * 8;
  const padded = new Uint8Array((((msg.length + 9 + 63) >> 6) << 6));
  padded.set(msg);
  padded[msg.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);
  dv.setUint32(padded.length - 4, bitLen >>> 0, false);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const w15 = W[t - 15]!, w2 = W[t - 2]!;
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[t] = (W[t - 16]! + s0 + W[t - 7]! + s1) >>> 0;
    }
    let a = H[0]!, b = H[1]!, c = H[2]!, d = H[3]!, e = H[4]!, f = H[5]!, g = H[6]!, h = H[7]!;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K256[t]! + W[t]!) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0]! + a) >>> 0; H[1] = (H[1]! + b) >>> 0; H[2] = (H[2]! + c) >>> 0; H[3] = (H[3]! + d) >>> 0;
    H[4] = (H[4]! + e) >>> 0; H[5] = (H[5]! + f) >>> 0; H[6] = (H[6]! + g) >>> 0; H[7] = (H[7]! + h) >>> 0;
  }
  return H;
}

export function sha256Hex(input: string | Uint8Array): string {
  let s = '';
  for (const w of sha256Words(input)) s += w.toString(16).padStart(8, '0');
  return s;
}

// ─── sfc32 ───────────────────────────────────────────────────────────────────────────────────────

/** sfc32 seeded from the first 128 bits of sha256(seed); 12 warm-up rounds. Returns [0, 1). */
export function rng(seed: string): () => number {
  const w = sha256Words(seed);
  let a = w[0]!, b = w[1]!, c = w[2]!, d = w[3]!;
  const next = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

// ─── value / fbm / worley noise with optional torus wrap ─────────────────────────────────────────

/** 32-bit integer hash of a lattice point (lowbias32-style avalanche); returns [0, 1). */
function hashInt(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ seed) | 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;
const quintic = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

class NoiseImpl implements Noise {
  /** Lattice periods (integers ≥ 1) or 0 for no wrap. */
  constructor(private readonly seed: number, private readonly px: number, private readonly py: number) {}

  hash21(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    return hashInt(this.px > 0 ? mod(ix, this.px) : ix, this.py > 0 ? mod(iy, this.py) : iy, this.seed);
  }

  /** Value noise at a lattice with explicit periods (0 = no wrap). */
  private value(x: number, y: number, px: number, py: number, salt: number): number {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = quintic(x - x0), fy = quintic(y - y0);
    let xa = x0, xb = x0 + 1, ya = y0, yb = y0 + 1;
    if (px > 0) { xa = mod(xa, px); xb = mod(xb, px); }
    if (py > 0) { ya = mod(ya, py); yb = mod(yb, py); }
    const s = this.seed ^ salt;
    const a = hashInt(xa, ya, s), b = hashInt(xb, ya, s), c = hashInt(xa, yb, s), d = hashInt(xb, yb, s);
    const top = a + (b - a) * fx;
    const bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
  }

  valueNoise2(x: number, y: number): number {
    return this.value(x, y, this.px, this.py, 0);
  }

  fbm2(x: number, y: number, octaves: number, lacunarity = 2.03, gain = 0.5): number {
    let sum = 0, amp = 1, norm = 0, f = 1;
    const n = Math.max(1, Math.floor(octaves));
    for (let i = 0; i < n; i++) {
      let fx = f, fy = f, ppx = 0, ppy = 0;
      if (this.px > 0) { ppx = Math.max(1, Math.round(this.px * f)); fx = ppx / this.px; }
      if (this.py > 0) { ppy = Math.max(1, Math.round(this.py * f)); fy = ppy / this.py; }
      // integer per-octave lattice offsets decorrelate octaves and keep the wrap exact
      sum += amp * this.value(x * fx + i * 17, y * fy + i * 31, ppx, ppy, Math.imul(i + 1, 0x9e3779b1));
      norm += amp;
      amp *= gain;
      f *= lacunarity;
    }
    return sum / norm;
  }

  worley2(x: number, y: number, jitter = 1): { f1: number; f2: number; id: number } {
    const cx = Math.floor(x), cy = Math.floor(y);
    let f1 = 1e9, f2 = 1e9, id = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const gx = cx + ox, gy = cy + oy;
        const hx = this.px > 0 ? mod(gx, this.px) : gx;
        const hy = this.py > 0 ? mod(gy, this.py) : gy;
        const jx = hashInt(hx, hy, this.seed ^ 0x51ed27);
        const jy = hashInt(hx, hy, this.seed ^ 0x2c1b3c6d);
        const dx = gx + 0.5 + (jx - 0.5) * jitter - x;
        const dy = gy + 0.5 + (jy - 0.5) * jitter - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < f1) { f2 = f1; f1 = d; id = hashInt(hx, hy, this.seed ^ 0x68e31da4); }
        else if (d < f2) f2 = d;
      }
    }
    return { f1, f2, id };
  }

  rng(seed: string): () => number {
    return rng(seed);
  }

  periodic(px: number, py: number = px): Noise {
    return new NoiseImpl(this.seed, Math.max(1, Math.round(px)), Math.max(1, Math.round(py)));
  }
}

/** The bake creates one Noise per surface, seeded from sha256(id); both tiers see the same noise. */
export function createNoise(seed: string): Noise {
  return new NoiseImpl(sha256Words(`noise:${seed}`)[0]! | 0, 0, 0);
}
