/**
 * Recipe → Float32 heightfield → albedo → ORM at a tier size, plus the derivations the bake owns (SPEC
 * §40.3.2): Sobel normal (OpenGL +Y), cavity AO default, luminance ceiling 0.85, seam check for `repeat`,
 * linear-space mip chains. Pure computation; no I/O, no encoder.
 */
import { createNoise, hasAlpha, refSize } from '@ewa/render/surfaces';
import type { CardRgb, Orm, RecipeCtx, Rgb, ScalarField, SurfaceDef, SurfaceRecipe } from '@ewa/render/surfaces';
import type { Level } from './encode';

export const LUMINANCE_CEILING = 0.85;
/** Fail the build when more than this fraction of albedo texels had to be clamped (§40.3.2). */
export const CLAMP_FAIL_FRACTION = 0.05;
/** §40.3.2: mean abs difference across the wrap, in 8-bit units / 255. */
export const SEAM_TOLERANCE = 2 / 255;
/** Sobel slope gain at the reference size: slope = normalStrength · NORMAL_GAIN · dh/du / refSize. */
export const NORMAL_GAIN = 32;
/** Cavity AO blur σ at the reference size (px). */
export const CAVITY_SIGMA_PX = 6;

export type Tier = 'field' | 'hero';
export const TIER_SIZE: Readonly<Record<Tier, 512 | 1024>> = { field: 512, hero: 1024 };

export interface SeamReport { readonly albedo: number; readonly height: number }

export interface BakedTier {
  readonly id: string;
  /** null when baked at a non-tier size (tests). */
  readonly tier: Tier | null;
  readonly size: number;
  readonly albedo: readonly Level[];
  readonly orm: readonly Level[];
  readonly normal: readonly Level[];
  readonly alpha: boolean;
  readonly clamped: number;
  /** Percentage of albedo texels moved to the ceiling (0..100). */
  readonly clampedPct: number;
  /** null for `clamp` surfaces. */
  readonly seam: SeamReport | null;
  /** Percentage of texels whose roughness fell outside [0, 1] and was clamped. */
  readonly roughClippedPct: number;
  readonly aoDefault: boolean;
  readonly maxLuminance: number;
  readonly ms: number;
  /** Level-0 float fields, kept for tests and previews. */
  readonly fields: { readonly height: Float32Array; readonly albedoLinear: Float32Array; readonly alphaF: Float32Array | null };
}

export class BakeError extends Error {
  constructor(readonly surface: string, message: string) {
    super(`[material-bake] ${surface}: ${message}`);
  }
}

const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** 256-entry LUT is not enough for float input; a 4096-step LUT keeps the conversion fast and deterministic. */
const SRGB_LUT_N = 4096;
const SRGB_LUT = (() => {
  const t = new Uint8Array(SRGB_LUT_N + 1);
  for (let i = 0; i <= SRGB_LUT_N; i++) t[i] = Math.round(linearToSrgb(i / SRGB_LUT_N) * 255);
  return t;
})();

export function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}

/** Box blur, 3 passes (≈ Gaussian σ), torus or clamped. */
function blur3(src: Float32Array, S: number, sigma: number, wrap: boolean): Float32Array {
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  const n = 2 * r + 1;
  const a = Float32Array.from(src);
  const b = new Float32Array(src.length);
  const idx = (k: number): number => (wrap ? ((k % S) + S) % S : k < 0 ? 0 : k >= S ? S - 1 : k);
  for (let p = 0; p < 3; p++) {
    for (let y = 0; y < S; y++) {
      const row = y * S;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[row + idx(k)]!;
      for (let x = 0; x < S; x++) {
        b[row + x] = acc / n;
        acc += a[row + idx(x + r + 1)]! - a[row + idx(x - r)]!;
      }
    }
    for (let x = 0; x < S; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += b[idx(k) * S + x]!;
      for (let y = 0; y < S; y++) {
        a[y * S + x] = acc / n;
        acc += b[idx(y + r + 1) * S + x]! - b[idx(y - r) * S + x]!;
      }
    }
  }
  return a;
}

/**
 * Seam error: how much the mean neighbour difference across the wrap (column S−1 → 0, row S−1 → 0) exceeds the
 * largest mean neighbour difference between any two adjacent interior columns (rows). A seamless torus scores 0
 * (the wrap pair is just another pair of the same pattern, even when a crack or joint happens to lie on it); a
 * discontinuity scores its excess. §40.3.2 states the raw column-0-vs-column-(S−1) difference ≤ 2/255; on
 * textured content adjacent texels legitimately differ by more than that, so the interior pairs are the
 * baseline (IMPLEMENTATION-NOTES D6).
 */
export function seamError(data: ArrayLike<number>, S: number, channels: number, scale: number): number {
  const colD = new Float64Array(S);      // colD[x] = Σ |c(x) − c(x+1 mod S)|, x = S−1 is the wrap pair
  const rowD = new Float64Array(S);
  for (let y = 0; y < S; y++) {
    const yn = y === S - 1 ? 0 : y + 1;
    for (let x = 0; x < S; x++) {
      const xn = x === S - 1 ? 0 : x + 1;
      const i = (y * S + x) * channels;
      const ir = (y * S + xn) * channels, id = (yn * S + x) * channels;
      for (let c = 0; c < channels; c++) {
        const v = data[i + c]!;
        colD[x] = colD[x]! + Math.abs(v - data[ir + c]!);
        rowD[y] = rowD[y]! + Math.abs(v - data[id + c]!);
      }
    }
  }
  let colMax = 0, rowMax = 0;
  for (let k = 0; k < S - 1; k++) { if (colD[k]! > colMax) colMax = colD[k]!; if (rowD[k]! > rowMax) rowMax = rowD[k]!; }
  const n = S * channels;
  return Math.max(0, (colD[S - 1]! - colMax) / n, (rowD[S - 1]! - rowMax) / n) * scale;
}

/** Bake one tier of one surface. Throws BakeError on a ceiling or seam failure. */
export function bakeTier(recipe: SurfaceRecipe, def: SurfaceDef, tier: Tier): BakedTier {
  return bakeAt(recipe, def, TIER_SIZE[tier], tier);
}

/** Bake at any power-of-two size (tiers use 512 / 1024; tests use small sizes for coverage). */
export function bakeAt(recipe: SurfaceRecipe, def: SurfaceDef, S: number, tier: Tier | null = null, opts: { readonly seamCheck?: boolean } = {}): BakedTier {
  if (!(S >= 4 && (S & (S - 1)) === 0)) throw new BakeError(recipe.id, `size ${S} is not a power of two`);
  const t0 = performance.now();
  const N = S * S;
  const ref = refSize(recipe);
  const wrap = recipe.wrap === 'repeat';
  const card = def.alphaTest !== null;
  const ctx: RecipeCtx = { id: recipe.id, size: S, metres: recipe.metres, noise: createNoise(recipe.id), def };

  // 1. height
  const h: ScalarField = { width: S, height: S, data: new Float32Array(N) };
  recipe.height(h, ctx);
  for (let i = 0; i < N; i++) {
    const v = h.data[i]!;
    if (!Number.isFinite(v)) throw new BakeError(recipe.id, `height is not finite at texel ${i}`);
    h.data[i] = sat(v);
  }

  // 2. albedo (linear), alpha for cards
  const rgbData = new Float32Array(N * 3);
  const alphaF = card ? new Float32Array(N).fill(1) : null;
  const rgb: Rgb | CardRgb = alphaF ? { width: S, height: S, data: rgbData, alpha: alphaF } : { width: S, height: S, data: rgbData };
  recipe.albedo(rgb, h, ctx);
  if (card && !hasAlpha(rgb)) throw new BakeError(recipe.id, 'card surface lost its alpha channel');

  // 3. ORM
  const orm: Orm = {
    width: S, height: S, ao: new Float32Array(N).fill(1), rough: new Float32Array(N).fill(0.5), metal: new Float32Array(N).fill(0),
  };
  recipe.orm(orm, h, ctx);
  let aoTouched = false;
  for (let i = 0; i < N; i++) if (orm.ao[i] !== 1) { aoTouched = true; break; }
  if (!aoTouched) {
    const b = blur3(h.data, S, (CAVITY_SIGMA_PX * S) / ref, wrap);
    for (let i = 0; i < N; i++) orm.ao[i] = orm.ao[i]! * (1 - 0.6 * sat((b[i]! - h.data[i]!) * 4));
  }

  // 4. luminance ceiling
  let clamped = 0, maxLum = 0;
  for (let i = 0; i < N; i++) {
    let r = rgbData[i * 3]!, g = rgbData[i * 3 + 1]!, bb = rgbData[i * 3 + 2]!;
    if (!Number.isFinite(r + g + bb)) throw new BakeError(recipe.id, `albedo is not finite at texel ${i}`);
    r = Math.max(0, r); g = Math.max(0, g); bb = Math.max(0, bb);
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * bb;
    if (Y > LUMINANCE_CEILING) {
      const k = LUMINANCE_CEILING / Y;
      r *= k; g *= k; bb *= k;
      clamped++;
    }
    r = Math.min(1, r); g = Math.min(1, g); bb = Math.min(1, bb);
    rgbData[i * 3] = r; rgbData[i * 3 + 1] = g; rgbData[i * 3 + 2] = bb;
    const Y2 = 0.2126 * r + 0.7152 * g + 0.0722 * bb;
    if (Y2 > maxLum) maxLum = Y2;
  }
  const clampedPct = (clamped / N) * 100;
  // glass_warm (§40.3.6) and every emissive housing: clamping is reported, not an error (IMPLEMENTATION-NOTES D7)
  if (clamped / N > CLAMP_FAIL_FRACTION && def.emissive === null) {
    throw new BakeError(recipe.id, `${clampedPct.toFixed(2)} % of albedo texels exceeded luminance ${LUMINANCE_CEILING} (limit ${CLAMP_FAIL_FRACTION * 100} %); darken the recipe`);
  }

  // 5. normal (3×3 Sobel, OpenGL +Y = increasing v = increasing row)
  const gain = (recipe.normalStrength * NORMAL_GAIN * S) / (8 * ref);
  const nrm = sobelNormals(h.data, S, gain, wrap);

  // 6. level 0 → 8-bit, seam check
  const albedoLv: Level[] = [], ormLv: Level[] = [], nrmLv: Level[] = [];
  let roughClipped = 0;
  const ormF = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    // G is absolute roughness, as packages/render's graph reads it (roughScale 1, bias 0 once baked; IMPLEMENTATION-NOTES D5)
    const g = orm.rough[i]!;
    if (g < -1e-4 || g > 1.0001) roughClipped++;
    ormF[i * 3] = sat(orm.ao[i]!); ormF[i * 3 + 1] = sat(g); ormF[i * 3 + 2] = sat(orm.metal[i]!);
  }

  const a0 = toAlbedo8(rgbData, alphaF, S);
  albedoLv.push(a0); ormLv.push(toLinear8(ormF, S)); nrmLv.push(toNormal8(nrm, S));

  let seam: SeamReport | null = null;
  if (wrap) {
    const rgb8 = new Uint8Array(N * 3);
    for (let i = 0; i < N; i++) { rgb8[i * 3] = a0.data[i * 4]!; rgb8[i * 3 + 1] = a0.data[i * 4 + 1]!; rgb8[i * 3 + 2] = a0.data[i * 4 + 2]!; }
    seam = { albedo: seamError(rgb8, S, 3, 1 / 255), height: seamError(h.data, S, 1, 1) };
    if ((opts.seamCheck ?? true) && (seam.albedo > SEAM_TOLERANCE || seam.height > SEAM_TOLERANCE)) {
      throw new BakeError(recipe.id, `wrap seam error albedo ${(seam.albedo * 255).toFixed(2)}/255, height ${(seam.height * 255).toFixed(2)}/255 exceeds 2/255`);
    }
  }

  // 7. mip chains: albedo box in linear (alpha coverage-preserving for cards), ORM straight average, normal renormalised
  const coverage0 = alphaF ? coverage(alphaF, 0.5, 1) : 0;
  let lin: Float32Array = rgbData, al: Float32Array | null = alphaF, of: Float32Array = ormF, nf: Float32Array = nrm, s = S;
  while (s > 1) {
    const s2 = s >> 1;
    lin = down3(lin, s);
    of = down3(of, s);
    nf = down3(nf, s);
    for (let i = 0; i < s2 * s2; i++) {
      const x = nf[i * 3]!, y = nf[i * 3 + 1]!, z = nf[i * 3 + 2]!;
      const l = Math.sqrt(x * x + y * y + z * z) || 1;
      nf[i * 3] = x / l; nf[i * 3 + 1] = y / l; nf[i * 3 + 2] = z / l;
    }
    let alOut: Float32Array | null = null;
    if (al) {
      al = down1(al, s);
      alOut = preserveCoverage(al, coverage0);
    }
    s = s2;
    albedoLv.push(toAlbedo8(lin, alOut, s));
    ormLv.push(toLinear8(of, s));
    nrmLv.push(toNormal8(nf, s));
  }

  return {
    id: recipe.id, tier, size: S,
    albedo: albedoLv, orm: ormLv, normal: nrmLv,
    alpha: card,
    clamped, clampedPct,
    seam,
    roughClippedPct: (roughClipped / N) * 100,
    aoDefault: !aoTouched,
    maxLuminance: maxLum,
    ms: performance.now() - t0,
    fields: { height: h.data, albedoLinear: rgbData, alphaF },
  };
}

function wrapTable(S: number, wrap: boolean): Int32Array {
  const t = new Int32Array(S + 2);
  for (let k = -1; k <= S; k++) t[k + 1] = wrap ? ((k % S) + S) % S : k < 0 ? 0 : k >= S ? S - 1 : k;
  return t;
}

function sobelNormals(hd: Float32Array, S: number, gain: number, wrap: boolean): Float32Array {
  const nrm = new Float32Array(S * S * 3);
  const t = wrapTable(S, wrap);
  for (let y = 0; y < S; y++) {
    const ym = t[y]! * S, y0 = y * S, yp = t[y + 2]! * S;
    for (let x = 0; x < S; x++) {
      const xm = t[x]!, xp = t[x + 2]!;
      const gx = (hd[ym + xp]! + 2 * hd[y0 + xp]! + hd[yp + xp]!) - (hd[ym + xm]! + 2 * hd[y0 + xm]! + hd[yp + xm]!);
      const gy = (hd[yp + xm]! + 2 * hd[yp + x]! + hd[yp + xp]!) - (hd[ym + xm]! + 2 * hd[ym + x]! + hd[ym + xp]!);
      const nx = -gx * gain, ny = -gy * gain;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y0 + x) * 3;
      nrm[i] = nx * inv; nrm[i + 1] = ny * inv; nrm[i + 2] = inv;
    }
  }
  return nrm;
}

function toAlbedo8(lin: Float32Array, a: Float32Array | null, s: number): Level {
  const d = new Uint8Array(s * s * 4);
  const n = s * s;
  for (let i = 0; i < n; i++) {
    d[i * 4] = SRGB_LUT[Math.round(sat(lin[i * 3]!) * SRGB_LUT_N)]!;
    d[i * 4 + 1] = SRGB_LUT[Math.round(sat(lin[i * 3 + 1]!) * SRGB_LUT_N)]!;
    d[i * 4 + 2] = SRGB_LUT[Math.round(sat(lin[i * 3 + 2]!) * SRGB_LUT_N)]!;
    d[i * 4 + 3] = a ? Math.round(sat(a[i]!) * 255) : 255;
  }
  return { width: s, height: s, data: d };
}

function toLinear8(f: Float32Array, s: number): Level {
  const d = new Uint8Array(s * s * 4);
  const n = s * s;
  for (let i = 0; i < n; i++) {
    d[i * 4] = Math.round(sat(f[i * 3]!) * 255);
    d[i * 4 + 1] = Math.round(sat(f[i * 3 + 1]!) * 255);
    d[i * 4 + 2] = Math.round(sat(f[i * 3 + 2]!) * 255);
    d[i * 4 + 3] = 255;
  }
  return { width: s, height: s, data: d };
}

function toNormal8(f: Float32Array, s: number): Level {
  const d = new Uint8Array(s * s * 4);
  const n = s * s;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const v = Math.round(128 + f[i * 3 + c]! * 127);
      d[i * 4 + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    d[i * 4 + 3] = 255;
  }
  return { width: s, height: s, data: d };
}

function down3(src: Float32Array, s: number): Float32Array {
  const s2 = s >> 1;
  const out = new Float32Array(s2 * s2 * 3);
  for (let y = 0; y < s2; y++) {
    for (let x = 0; x < s2; x++) {
      const a = ((2 * y) * s + 2 * x) * 3, b = a + 3, c = a + s * 3, d = c + 3;
      const o = (y * s2 + x) * 3;
      for (let k = 0; k < 3; k++) out[o + k] = (src[a + k]! + src[b + k]! + src[c + k]! + src[d + k]!) * 0.25;
    }
  }
  return out;
}

function down1(src: Float32Array, s: number): Float32Array {
  const s2 = s >> 1;
  const out = new Float32Array(s2 * s2);
  for (let y = 0; y < s2; y++) {
    for (let x = 0; x < s2; x++) {
      const a = (2 * y) * s + 2 * x;
      out[y * s2 + x] = (src[a]! + src[a + 1]! + src[a + s]! + src[a + s + 1]!) * 0.25;
    }
  }
  return out;
}

function coverage(a: Float32Array, threshold: number, scale: number): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i]! * scale >= threshold) n++;
  return n / a.length;
}

/** Scale alpha so the fraction passing alphaTest 0.5 matches level 0 (keeps cards from thinning out in the mips). */
function preserveCoverage(a: Float32Array, target: number): Float32Array {
  if (target <= 0) return a;
  let lo = 0.5, hi = 8;
  for (let it = 0; it < 24; it++) {
    const mid = (lo + hi) / 2;
    if (coverage(a, 0.5, mid) < target) lo = mid; else hi = mid;
  }
  const k = (lo + hi) / 2;
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = sat(a[i]! * k);
  return out;
}
