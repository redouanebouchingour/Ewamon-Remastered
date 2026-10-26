/**
 * Shiny palettes (spine §3.7a): derives one hue / saturation / lightness triple per evolution family from the
 * committed thumbnails and writes `packages/content/src/data/shinyDerived.ts`. Hand-tuning lives in content
 * `SHINY_TUNING`; this script never touches it.
 *
 *   pnpm --filter @ewa/sprite-pipeline shiny                 # write shinyDerived.ts
 *   pnpm --filter @ewa/sprite-pipeline shiny --sheet <dir>   # also contact sheets: normal | shader shiny | CSS shiny
 *   ... --no-write --sheet <dir> --only <id,root,...>          # re-check a few families after tuning
 *
 * Per family: a chroma-weighted hue histogram over every member's opaque pixels gives the dominant hue; the shift is
 * the one that carries it onto a target from `TARGETS`, kept ≥ MIN_GAP_DEG from every variant shift (a shiny never
 * reads as normal / dawn / dusk / verdant / ember), picked by a hash of the root among the eligible targets. A family
 * with little colour (mean chroma under GREY_CHROMA) also gets more saturation and a lightness step (lighter when
 * dark, darker when light), since a hue shift barely shows on it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SPECIES, SHINY_TUNING, VARIANT_PALETTES, evolutionRoot, shinyPaletteOf } from '@ewa/content';
import type { VariantPalette } from '@ewa/content';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const THUMBS = path.join(root, 'packages/client/public/creatures/thumbs');
const OUT = path.join(root, 'packages/content/src/data/shinyDerived.ts');

/** Shiny target hues (HSV degrees). */
export const TARGETS: readonly { readonly name: string; readonly hue: number }[] = [
  { name: 'gold', hue: 46 }, { name: 'lime', hue: 88 }, { name: 'jade', hue: 152 }, { name: 'cyan', hue: 186 },
  { name: 'azure', hue: 212 }, { name: 'violet', hue: 272 }, { name: 'magenta', hue: 302 }, { name: 'rose', hue: 335 },
];
export const MIN_GAP_DEG = 30;
export const GREY_CHROMA = 0.1;
/** A grey family: saturation up (its faint tints carry the shift), dark ones lighter and light ones darker. */
const GREY_SATURATION = 1.6;
const GREY_DARK_VALUE = 0.35;
const BINS = 360;
const SMOOTH = 12;

const norm = (deg: number): number => ((deg % 360) + 360) % 360;
const gap = (a: number, b: number): number => { const d = Math.abs(norm(a) - norm(b)); return Math.min(d, 360 - d); };
const VARIANT_SHIFTS: readonly number[] = Object.values(VARIANT_PALETTES).map((p) => (p === null ? 0 : p.hue));

/** A shift clear of every variant's (normal included). */
export function shiftAllowed(shiftDeg: number): boolean {
  return VARIANT_SHIFTS.every((v) => gap(shiftDeg, v) >= MIN_GAP_DEG);
}

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

interface Raw { readonly width: number; readonly height: number; readonly data: Uint8Array }

async function readThumb(id: string): Promise<Raw | null> {
  try {
    const { data, info } = await sharp(path.join(THUMBS, `${id}_front.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
  } catch {
    return null;
  }
}

interface Stats { readonly hist: Float64Array; chroma: number; value: number; opaque: number }

function accumulate(img: Raw, s: Stats): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 128) continue;
    const r = d[i]! / 255, g = d[i + 1]! / 255, b = d[i + 2]! / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
    s.opaque++;
    s.chroma += c;
    s.value += max;
    if (c < 0.08) continue;
    let h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
    h = norm(h * 60);
    s.hist[Math.floor(h) % BINS]! += c * c;
  }
}

function dominantHue(hist: Float64Array): number {
  let best = 0, bestV = -1;
  for (let h = 0; h < BINS; h++) {
    let v = 0;
    for (let k = -SMOOTH; k <= SMOOTH; k++) v += hist[(h + k + BINS) % BINS]!;
    if (v > bestV) { bestV = v; best = h; }
  }
  return best;
}

export interface Derived { readonly root: string; readonly members: readonly string[]; readonly dominant: number; readonly chroma: number; readonly value: number; readonly target: string; readonly palette: VariantPalette }

export function choose(rootId: string, dominant: number, chroma: number, value: number): { target: string; palette: VariantPalette } {
  const eligible = TARGETS.filter((t) => shiftAllowed(t.hue - dominant));
  const t = eligible.length > 0 ? eligible[fnv(rootId) % eligible.length]! : { name: 'fallback', hue: dominant + 160 };
  let hue = norm(t.hue - dominant);
  if (hue > 180) hue -= 360;
  if (chroma >= GREY_CHROMA) return { target: t.name, palette: { hue, saturation: 1.05, lightness: 1 } };
  return { target: t.name, palette: { hue, saturation: GREY_SATURATION, lightness: value < GREY_DARK_VALUE ? 1.3 : 0.85 } };
}

async function derive(): Promise<Derived[]> {
  const families = new Map<string, string[]>();
  for (const sp of [...SPECIES].sort((a, b) => a.dexNumber - b.dexNumber)) {
    const r = evolutionRoot(sp.id);
    const list = families.get(r) ?? [];
    list.push(sp.id);
    families.set(r, list);
  }
  const out: Derived[] = [];
  for (const [r, members] of families) {
    const s: Stats = { hist: new Float64Array(BINS), chroma: 0, value: 0, opaque: 0 };
    for (const id of members) {
      const img = await readThumb(id);
      if (img === null) { console.warn(`shiny: no thumb for ${id}`); continue; }
      accumulate(img, s);
    }
    if (s.opaque === 0) continue;
    const dominant = dominantHue(s.hist);
    const chroma = s.chroma / s.opaque, value = s.value / s.opaque;
    out.push({ root: r, members, dominant, chroma, value, ...choose(r, dominant, chroma, value) });
  }
  return out;
}

function writeDerived(rows: readonly Derived[]): void {
  const sorted = [...rows].sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0));
  const lines = sorted.map((d) => `  ${d.root}: { hue: ${d.palette.hue}, saturation: ${d.palette.saturation}, lightness: ${d.palette.lightness} }, // ${d.target} from ${d.dominant}°, chroma ${d.chroma.toFixed(2)}, value ${d.value.toFixed(2)}`);
  writeFileSync(OUT, [
    '// Generated by `pnpm --filter @ewa/sprite-pipeline shiny`; do not edit (tune in `shiny.ts` SHINY_TUNING).',
    "import type { VariantPalette } from '../types';",
    '',
    'export const SHINY_DERIVED: Readonly<Record<string, VariantPalette>> = {',
    ...lines,
    '};',
    '',
  ].join('\n'));
}

// ---- contact sheets ---------------------------------------------------------------------------------------------

const toLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (c: number): number => Math.min(1, Math.max(0, c));

/** The billboard's `hue()` (Rodrigues about the grey axis) → `saturation()` → `× lightMul`, in linear light. */
function shaderShift(r: number, g: number, b: number, p: VariantPalette): [number, number, number] {
  const a = (p.hue * Math.PI) / 180, k = 0.57735, cs = Math.cos(a), sn = Math.sin(a);
  const R = toLin(r), G = toLin(g), B = toLin(b);
  const dot = k * (R + G + B) * (1 - cs);
  let x = Math.max(0, R * cs + k * (B - G) * sn + k * dot);
  let y = Math.max(0, G * cs + k * (R - B) * sn + k * dot);
  let z = Math.max(0, B * cs + k * (G - R) * sn + k * dot);
  const L = 0.2126 * x + 0.7152 * y + 0.0722 * z;
  x = Math.max(0, L + (x - L) * p.saturation) * p.lightness;
  y = Math.max(0, L + (y - L) * p.saturation) * p.lightness;
  z = Math.max(0, L + (z - L) * p.saturation) * p.lightness;
  return [toSrgb(clamp01(x)), toSrgb(clamp01(y)), toSrgb(clamp01(z))];
}

/** CSS `hue-rotate() saturate() brightness()` (Filter Effects matrices, sRGB). */
function cssShift(r: number, g: number, b: number, p: VariantPalette): [number, number, number] {
  const a = (p.hue * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  let x = (0.213 + c * 0.787 - s * 0.213) * r + (0.715 - c * 0.715 - s * 0.715) * g + (0.072 - c * 0.072 + s * 0.928) * b;
  let y = (0.213 - c * 0.213 + s * 0.143) * r + (0.715 + c * 0.285 + s * 0.14) * g + (0.072 - c * 0.072 - s * 0.283) * b;
  let z = (0.213 - c * 0.213 - s * 0.787) * r + (0.715 - c * 0.715 + s * 0.715) * g + (0.072 + c * 0.928 + s * 0.072) * b;
  [x, y, z] = [clamp01(x), clamp01(y), clamp01(z)];
  const S = p.saturation;
  const sx = (0.213 + 0.787 * S) * x + (0.715 - 0.715 * S) * y + (0.072 - 0.072 * S) * z;
  const sy = (0.213 - 0.213 * S) * x + (0.715 + 0.285 * S) * y + (0.072 - 0.072 * S) * z;
  const sz = (0.213 - 0.213 * S) * x + (0.715 - 0.715 * S) * y + (0.072 + 0.928 * S) * z;
  return [clamp01(sx * p.lightness), clamp01(sy * p.lightness), clamp01(sz * p.lightness)];
}

function recolour(img: Raw, p: VariantPalette, fn: typeof shaderShift): Buffer {
  const out = Buffer.from(img.data);
  for (let i = 0; i < out.length; i += 4) {
    const [r, g, b] = fn(out[i]! / 255, out[i + 1]! / 255, out[i + 2]! / 255, p);
    out[i] = Math.round(r * 255); out[i + 1] = Math.round(g * 255); out[i + 2] = Math.round(b * 255);
  }
  return out;
}

const CELL_W = 3 * 192 + 24, CELL_H = 126 + 22, COLS = 2, ROWS = 8;

async function writeSheets(dir: string, only: readonly string[] | null): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const ids = [...SPECIES].sort((a, b) => a.dexNumber - b.dexNumber).map((s) => s.id).filter((id) => only === null || only.includes(id) || only.includes(evolutionRoot(id)));
  const per = COLS * ROWS;
  for (let page = 0; page * per < ids.length; page++) {
    const comps: sharp.OverlayOptions[] = [];
    const labels: string[] = [];
    const slice = ids.slice(page * per, (page + 1) * per);
    for (let i = 0; i < slice.length; i++) {
      const id = slice[i]!;
      const img = await readThumb(id);
      if (img === null) continue;
      const p = shinyPaletteOf(id);
      const x0 = (i % COLS) * CELL_W, y0 = Math.floor(i / COLS) * CELL_H;
      const raw = { width: img.width, height: img.height, channels: 4 as const };
      const big = (buf: Buffer | Uint8Array) => sharp(buf, { raw }).resize(192, 126, { kernel: 'nearest', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      comps.push({ input: await big(img.data), left: x0, top: y0 });
      comps.push({ input: await big(recolour(img, p, shaderShift)), left: x0 + 192, top: y0 });
      comps.push({ input: await big(recolour(img, p, cssShift)), left: x0 + 384, top: y0 });
      const tag = SHINY_TUNING[id] !== undefined || SHINY_TUNING[evolutionRoot(id)] !== undefined ? ' *' : '';
      labels.push(`<text x="${x0 + 4}" y="${y0 + 126 + 16}" font-family="sans-serif" font-size="14" fill="#ddd">${id} (${evolutionRoot(id)}) h${p.hue} s${p.saturation} l${p.lightness}${tag}</text>`);
    }
    const W = COLS * CELL_W, H = ROWS * CELL_H;
    comps.push({ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${labels.join('')}</svg>`), left: 0, top: 0 });
    const file = path.join(dir, `shiny-${page + 1}.png`);
    await sharp({ create: { width: W, height: H, channels: 4, background: { r: 46, g: 50, b: 58, alpha: 1 } } }).composite(comps).png().toFile(file);
    console.log(`sheet ${file}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const rows = await derive();
  for (const d of rows) console.log(`${d.root.padEnd(14)} dom ${String(d.dominant).padStart(3)}° chroma ${d.chroma.toFixed(2)} → ${d.target.padEnd(8)} hue ${d.palette.hue} (${d.members.join(', ')})`);
  if (!args.includes('--no-write')) { writeDerived(rows); console.log(`wrote ${path.relative(root, OUT)} (${rows.length} families)`); }
  const sheet = args.indexOf('--sheet');
  const only = args.indexOf('--only');
  if (sheet >= 0 && args[sheet + 1] !== undefined) await writeSheets(path.resolve(args[sheet + 1]!), only >= 0 && args[only + 1] !== undefined ? args[only + 1]!.split(',') : null);
}

await main();
