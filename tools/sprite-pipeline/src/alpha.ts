/**
 * Stage 1 — alpha recovery (spec §40.1.2 #1).
 *
 * Many legacy sprites ship a flat white or magenta background instead of transparency.
 * If the image already carries meaningful alpha we keep it. Otherwise we flood-fill from
 * every border pixel against the border-mean colour (tolerance 38/255 per channel, i.e.
 * sum of absolute RGB differences <= FLOOD_TOLERANCE 114), additionally accepting magenta
 * and near-white pixels connected to the border, then defringe partially transparent
 * pixels by copying the nearest opaque neighbour's colour.
 *
 * Transparent-RGB rule (v2): after defringe, every `a = 0` pixel within a 3-4 chamfer
 * distance <= TRANSPARENT_RGB_BAND (2 px) of an opaque pixel takes the nearest opaque RGB;
 * every other `a = 0` pixel is set to (0, 0, 0). The flood leaves white/magenta RGB under
 * transparent pixels, and both the premultiplied mip filter and bilinear minification
 * would otherwise read it.
 */
import { chamferDistance } from './normalmap.js';
import type { Bbox, RgbaImage } from './types.js';

export const FLOOD_TOLERANCE = 114; // 38 * 3
export const MEANINGFUL_ALPHA_FRACTION = 0.03;
export const COVERAGE_MIN = 0.12;
export const COVERAGE_MAX = 0.92;
export const DEFRINGE_RADIUS = 8;
export const TRANSPARENT_RGB_BAND = 2;
/** `sidemismatch`: |log2(front.pixelScale / back.pixelScale)| > log2(SIDE_MISMATCH_RATIO). */
export const SIDE_MISMATCH_RATIO = 1.2;

/**
 * QA flags (spec §40.1.3):
 *   clipped         the alpha bbox touches at least one edge of the SOURCE canvas      informational
 *   nonsquare       source is not square                                               informational
 *   multiframe      multi-page GIF / animated WebP; frame chosen by frame-select.json   informational
 *   sidemismatch    front/back source drawings differ in scale by > 20 %               informational
 *   coverage        opaque fraction of the source canvas outside [0.12, 0.92]           review (qa-accept.json)
 *   leak            the background flood reached the centre 20 % of the alpha bbox     must be resolved
 *   empty           nothing recoverable; the raw source was shipped                    must be resolved
 */
export type QaFlag = 'clipped' | 'nonsquare' | 'multiframe' | 'sidemismatch' | 'coverage' | 'leak' | 'empty';
export const INFORMATIONAL_FLAGS: ReadonlySet<QaFlag> = new Set<QaFlag>(['clipped', 'nonsquare', 'multiframe', 'sidemismatch']);
/** Flags that can never be accepted with a reason. */
export const NEVER_ACCEPTED_FLAGS: ReadonlySet<QaFlag> = new Set<QaFlag>(['leak', 'empty']);

/** Per-species tuning from `alpha-overrides.json` (`leak` remedy; never an acceptance). */
export interface AlphaOptions {
  /** Summed RGB distance to the border-mean colour that still counts as background. */
  tolerance?: number;
  /** Also key magenta pixels connected to the border (default true). */
  keyMagenta?: boolean;
  /** Also key near-white pixels connected to the border (default true). */
  keyWhite?: boolean;
}

export interface AlphaResult {
  image: RgbaImage;
  /** True when a background was removed (as opposed to the source alpha being kept). */
  recovered: boolean;
  bbox: Bbox | null;
  /** Fraction of the canvas whose alpha is >= 128 after recovery. */
  coverage: number;
  flags: QaFlag[];
}

export function isMagenta(r: number, g: number, b: number): boolean {
  return r >= 145 && b >= 115 && g <= 150 && r - g >= 25 && b - g >= 5;
}

export function isNearWhite(r: number, g: number, b: number): boolean {
  return Math.min(r, g, b) >= 236;
}

/** >= 3% of pixels with a < 250 AND most border pixels transparent. */
export function hasMeaningfulAlpha(img: RgbaImage): boolean {
  const { width, height, data } = img;
  const n = width * height;
  let soft = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 250) soft++;
  if (soft / n < MEANINGFUL_ALPHA_FRACTION) return false;
  let border = 0;
  let borderClear = 0;
  const visit = (x: number, y: number): void => {
    border++;
    if (data[(y * width + x) * 4 + 3]! < 16) borderClear++;
  };
  for (let x = 0; x < width; x++) {
    visit(x, 0);
    if (height > 1) visit(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    visit(0, y);
    if (width > 1) visit(width - 1, y);
  }
  return borderClear > border / 2;
}

/**
 * Flood-fills the background from the border. Returns the mask of removed pixels (1 = removed).
 * Mutates `img` alpha to 0 for removed pixels.
 */
export function floodBackground(img: RgbaImage, opts: AlphaOptions = {}): Uint8Array {
  const { width, height, data } = img;
  const n = width * height;
  const removed = new Uint8Array(n);
  if (n === 0) return removed;
  const tolerance = opts.tolerance ?? FLOOD_TOLERANCE;
  const keyMagenta = opts.keyMagenta ?? true;
  const keyWhite = opts.keyWhite ?? true;

  // Border-mean colour.
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  const addBorder = (x: number, y: number): void => {
    const i = (y * width + x) * 4;
    sr += data[i]!;
    sg += data[i + 1]!;
    sb += data[i + 2]!;
    count++;
  };
  for (let x = 0; x < width; x++) {
    addBorder(x, 0);
    if (height > 1) addBorder(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    addBorder(0, y);
    if (width > 1) addBorder(width - 1, y);
  }
  const mr = Math.round(sr / count);
  const mg = Math.round(sg / count);
  const mb = Math.round(sb / count);

  const isBackground = (p: number): boolean => {
    const i = p * 4;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (Math.abs(r - mr) + Math.abs(g - mg) + Math.abs(b - mb) <= tolerance) return true;
    return (keyMagenta && isMagenta(r, g, b)) || (keyWhite && isNearWhite(r, g, b));
  };

  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const seen = new Uint8Array(n);
  const push = (p: number): void => {
    if (seen[p]) return;
    seen[p] = 1;
    if (isBackground(p)) {
      removed[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (head < tail) {
    const p = queue[head++]!;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (y > 0) push(p - width);
    if (y < height - 1) push(p + width);
  }
  for (let p = 0; p < n; p++) if (removed[p]) data[p * 4 + 3] = 0;
  return removed;
}

/** Index of the nearest pixel with alpha >= `minAlpha` within `maxRadius` (Chebyshev rings, Euclidean tie-break), or -1. */
function nearestWithAlpha(src: Uint8Array, width: number, height: number, x: number, y: number, maxRadius: number, minAlpha: number): number {
  let found = -1;
  let bestD = Infinity;
  for (let r = 1; r <= maxRadius && found < 0; r++) {
    for (let dy = -r; dy <= r; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      const edge = Math.abs(dy) === r;
      const step = edge ? 1 : 2 * r;
      for (let dx = -r; dx <= r; dx += step) {
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        const j = (yy * width + xx) * 4;
        if (src[j + 3]! < minAlpha) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          found = j;
        }
      }
    }
  }
  return found;
}

/** For pixels with 0 < a < 255, replace RGB with the nearest fully opaque neighbour's colour. */
export function defringe(img: RgbaImage, maxRadius = DEFRINGE_RADIUS): void {
  const { width, height, data } = img;
  const src = data.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = src[i + 3]!;
      if (a === 0 || a === 255) continue;
      const found = nearestWithAlpha(src, width, height, x, y, maxRadius, 255);
      if (found >= 0) {
        data[i] = src[found]!;
        data[i + 1] = src[found + 1]!;
        data[i + 2] = src[found + 2]!;
      }
    }
  }
}

/**
 * Transparent-RGB rule: `a = 0` pixels within `band` px (3-4 chamfer) of a visible pixel copy
 * the nearest visible pixel's RGB (which defringe already made opaque-coloured); every other
 * `a = 0` pixel becomes (0, 0, 0). Returns the count of pixels that took a neighbour colour.
 */
export function cleanTransparentRgb(img: RgbaImage, band = TRANSPARENT_RGB_BAND): number {
  const { width, height, data } = img;
  const n = width * height;
  // Distance of transparent pixels to the nearest visible pixel: invert the alpha mask.
  const inv = new Uint8Array(n);
  for (let p = 0; p < n; p++) inv[p] = data[p * 4 + 3] === 0 ? 1 : 0;
  const dist = chamferDistance(inv, width, height, band + 1);
  const src = data.slice();
  let copied = 0;
  for (let p = 0; p < n; p++) {
    if (!inv[p]) continue;
    const i = p * 4;
    if (dist[p]! <= band) {
      const x = p % width;
      const y = (p - x) / width;
      const found = nearestWithAlpha(src, width, height, x, y, band + 1, 1);
      if (found >= 0) {
        data[i] = src[found]!;
        data[i + 1] = src[found + 1]!;
        data[i + 2] = src[found + 2]!;
        copied++;
        continue;
      }
    }
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
  }
  return copied;
}

export function alphaBbox(img: RgbaImage, threshold = 1): Bbox | null {
  const { width, height, data } = img;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! >= threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export function recoverAlpha(input: RgbaImage, opts: AlphaOptions = {}): AlphaResult {
  const image: RgbaImage = { width: input.width, height: input.height, data: input.data.slice() };
  const flags: QaFlag[] = [];
  const n = image.width * image.height;
  let recovered = false;
  let removed: Uint8Array | null = null;

  if (!hasMeaningfulAlpha(image)) {
    removed = floodBackground(image, opts);
    recovered = true;
    if (alphaBbox(image) === null) {
      // The flood ate everything (flat image?). Ship the untouched source rather than nothing.
      image.data.set(input.data);
      removed = null;
      recovered = false;
      flags.push('empty');
    }
  }
  defringe(image);
  cleanTransparentRgb(image);

  const bbox = alphaBbox(image);
  let opaque = 0;
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i]! >= 128) opaque++;
  const coverage = n ? opaque / n : 0;

  if (coverage < COVERAGE_MIN || coverage > COVERAGE_MAX) flags.push('coverage');
  if (bbox && removed) {
    const w = bbox.x1 - bbox.x0 + 1;
    const h = bbox.y1 - bbox.y0 + 1;
    const cx = bbox.x0 + w / 2;
    const cy = bbox.y0 + h / 2;
    const rx0 = Math.max(0, Math.floor(cx - w * 0.1));
    const rx1 = Math.min(image.width - 1, Math.ceil(cx + w * 0.1));
    const ry0 = Math.max(0, Math.floor(cy - h * 0.1));
    const ry1 = Math.min(image.height - 1, Math.ceil(cy + h * 0.1));
    let leak = false;
    for (let y = ry0; y <= ry1 && !leak; y++) {
      for (let x = rx0; x <= rx1; x++) {
        if (removed[y * image.width + x]) {
          leak = true;
          break;
        }
      }
    }
    if (leak) flags.push('leak');
  }
  if (bbox && (bbox.x0 === 0 || bbox.y0 === 0 || bbox.x1 === image.width - 1 || bbox.y1 === image.height - 1)) {
    flags.push('clipped');
  }
  if (image.width !== image.height) flags.push('nonsquare');

  return { image, recovered, bbox, coverage, flags };
}

/** `sidemismatch` on a species' two `pixelScale`s (spec §40.1.3). */
export function isSideMismatch(frontPixelScale: number, backPixelScale: number): boolean {
  if (frontPixelScale <= 0 || backPixelScale <= 0) return false;
  return Math.abs(Math.log2(frontPixelScale / backPixelScale)) > Math.log2(SIDE_MISMATCH_RATIO);
}
