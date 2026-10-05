/**
 * The character atlas (SPEC §40.2.4, amended 2026-10-05): every look's recoloured copy of its body's KayKit texture,
 * as one tile of ONE KTX2 atlas that every character shares (the runtime picks the tile per actor).
 *
 * KayKit textures are swatch palettes — 8 × 4 cells of 128 × 256 px, each a vertical gradient — and every face of
 * a model maps into the interior of one cell (`dev/swatches.ts`: the closest vertex UV is 4 % of a cell width from
 * its edge). A recolour therefore works per cell: the cell's pixels are moved to the target colour in OKLab, keeping
 * each pixel's lightness offset from the cell mean (the gradient's shading) and taking the target's hue and chroma.
 * Tiles are box-downscaled to `TILE_SIZE` (32 × 64 px per cell: the gradients are smooth, so nothing is lost at the
 * sizes a character reaches on screen) and laid out row-major in `ATLAS_COLUMNS` columns.
 */
import sharp from 'sharp';
import { SLOTS, SWATCH_COLUMNS, SWATCH_ROWS } from './characters.js';
import type { BaseTexture, Cell, Palette } from './characters.js';
import type { RgbaImage } from './ktx2.js';

/** Edge of one look's tile in the atlas (px). */
export const TILE_SIZE = 256;
export const ATLAS_COLUMNS = 8;
export const ATLAS_ROWS = 4;
/** Atlas KTX2 plan: UASTC + RDO + zstd, sRGB, NO mips (the runtime samples level 0, linear; see the render notes). */
export const ATLAS_KTX2 = Object.freeze({ srgb: true, normalMap: false, rdo: 1, pack: 0, mipmaps: false });

// ---- colour ------------------------------------------------------------------------------------------------------

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB 0–1 → OKLab. */
export function srgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → sRGB 0–1 (clamped). */
export function oklabToSrgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const c = (v: number): number => Math.min(1, Math.max(0, toSrgb(Math.min(1, Math.max(0, v)))));
  return [c(lr), c(lg), c(lb)];
}

export function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`[model-pipeline] colour ${hex} is not #rrggbb`);
  const v = parseInt(m[1]!, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// ---- images ------------------------------------------------------------------------------------------------------

export async function decodeRgba(png: Uint8Array): Promise<RgbaImage> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

function cellRect(img: RgbaImage, cell: Cell): { x0: number; y0: number; x1: number; y1: number } {
  const [c, r] = cell.split(',').map(Number) as [number, number];
  if (!(c >= 0 && c < SWATCH_COLUMNS && r >= 0 && r < SWATCH_ROWS)) throw new Error(`[model-pipeline] swatch cell ${cell} outside the ${SWATCH_COLUMNS}×${SWATCH_ROWS} grid`);
  const w = img.width / SWATCH_COLUMNS, h = img.height / SWATCH_ROWS;
  return { x0: Math.round(c * w), y0: Math.round(r * h), x1: Math.round((c + 1) * w), y1: Math.round((r + 1) * h) };
}

/**
 * Moves every pixel of `cell` to `target` (sRGB hex): OKLab lightness = target L + (pixel L − cell mean L), hue and
 * chroma = the target's. In place on `img`.
 */
export function recolourCell(img: RgbaImage, cell: Cell, target: string): void {
  const { x0, y0, x1, y1 } = cellRect(img, cell);
  const W = img.width, d = img.data;
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * W + x) * 4;
    sum += srgbToOklab(d[i]! / 255, d[i + 1]! / 255, d[i + 2]! / 255)[0];
    n++;
  }
  const mean = sum / n;
  const [tr, tg, tb] = parseHex(target);
  const [tL, ta, tb2] = srgbToOklab(tr, tg, tb);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * W + x) * 4;
    const L = srgbToOklab(d[i]! / 255, d[i + 1]! / 255, d[i + 2]! / 255)[0];
    const nl = Math.min(1, Math.max(0, tL + (L - mean)));
    // chroma follows lightness a little toward the ends so near-white / near-black stay clean
    const k = Math.min(1, Math.max(0, 1 - Math.max(0, nl - 0.92) * 8 - Math.max(0, 0.12 - nl) * 6));
    const [r, g, b] = oklabToSrgb(nl, ta * k, tb2 * k);
    d[i] = Math.round(r * 255); d[i + 1] = Math.round(g * 255); d[i + 2] = Math.round(b * 255);
  }
}

/** A copy of `src` with `palette` applied through `texture`'s slot table. Unknown slots throw. */
export function recolour(src: RgbaImage, texture: BaseTexture, palette: Palette): RgbaImage {
  const out: RgbaImage = { width: src.width, height: src.height, data: new Uint8Array(src.data) };
  const slots = SLOTS[texture];
  for (const slot of Object.keys(palette).sort()) {
    const cells = slots[slot];
    if (!cells) throw new Error(`[model-pipeline] ${texture} texture has no slot "${slot}" (slots: ${Object.keys(slots).join(', ')})`);
    for (const cell of cells) recolourCell(out, cell, palette[slot]!);
  }
  return out;
}

/** Box downscale by an integer factor (the KayKit textures are 1024², tiles 256²). */
export function downscale(src: RgbaImage, size: number): RgbaImage {
  if (src.width % size !== 0 || src.height % size !== 0 || src.width / size !== src.height / size) throw new Error(`[model-pipeline] cannot box-downscale ${src.width}×${src.height} to ${size}²`);
  const f = src.width / size;
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const acc = [0, 0, 0, 0];
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
      const i = ((y * f + dy) * src.width + (x * f + dx)) * 4;
      // average in linear light so a gradient's mid tones keep their brightness
      acc[0]! += toLinear(src.data[i]! / 255); acc[1]! += toLinear(src.data[i + 1]! / 255); acc[2]! += toLinear(src.data[i + 2]! / 255); acc[3]! += src.data[i + 3]!;
    }
    const o = (y * size + x) * 4, nn = f * f;
    out[o] = Math.round(toSrgb(acc[0]! / nn) * 255); out[o + 1] = Math.round(toSrgb(acc[1]! / nn) * 255); out[o + 2] = Math.round(toSrgb(acc[2]! / nn) * 255); out[o + 3] = Math.round(acc[3]! / nn);
  }
  return { width: size, height: size, data: out };
}

/** Lays `tiles` (each `TILE_SIZE`²) out row-major in an `ATLAS_COLUMNS × ATLAS_ROWS` atlas; empty slots are mid grey. */
export function composeAtlas(tiles: readonly RgbaImage[]): RgbaImage {
  if (tiles.length > ATLAS_COLUMNS * ATLAS_ROWS) throw new Error(`[model-pipeline] ${tiles.length} atlas tiles > ${ATLAS_COLUMNS * ATLAS_ROWS} slots`);
  const W = ATLAS_COLUMNS * TILE_SIZE, H = ATLAS_ROWS * TILE_SIZE;
  const out = new Uint8Array(W * H * 4).fill(128);
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  tiles.forEach((t, k) => {
    if (t.width !== TILE_SIZE || t.height !== TILE_SIZE) throw new Error(`[model-pipeline] atlas tile ${k} is ${t.width}×${t.height}, not ${TILE_SIZE}²`);
    const ox = (k % ATLAS_COLUMNS) * TILE_SIZE, oy = Math.floor(k / ATLAS_COLUMNS) * TILE_SIZE;
    for (let y = 0; y < TILE_SIZE; y++) out.set(t.data.subarray(y * TILE_SIZE * 4, (y + 1) * TILE_SIZE * 4), ((oy + y) * W + ox) * 4);
  });
  return { width: W, height: H, data: out };
}

/** Mean sRGB (0–255) of a cell, for the QA report and tests. */
export function cellMean(img: RgbaImage, cell: Cell): [number, number, number] {
  const { x0, y0, x1, y1 } = cellRect(img, cell);
  const s = [0, 0, 0];
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * img.width + x) * 4; s[0]! += img.data[i]!; s[1]! += img.data[i + 1]!; s[2]! += img.data[i + 2]!; n++; }
  return [Math.round(s[0]! / n), Math.round(s[1]! / n), Math.round(s[2]! / n)];
}
