/**
 * Stage 8 — QA artifacts: `contact-sheet.png` (every sprite at 128 px, 16 per row, on a
 * checkerboard, labelled with the built-in bitmap font) and `qa-report.json`.
 */
import sharp from 'sharp';
import type { QaFlag } from './alpha.js';
import { GLYPH_ADVANCE, GLYPH_H, drawText } from './font.js';
import type { RgbaImage, SpriteSide } from './types.js';
import { createRgba } from './types.js';

export interface QaEntry {
  species: string;
  side: SpriteSide;
  flags: QaFlag[];
  source: string;
}

export interface QaReport {
  total: number;
  flagged: QaEntry[];
  /** Per-flag counts, for a quick read of the report. */
  counts: Record<string, number>;
}

export function buildQaReport(entries: QaEntry[]): QaReport {
  const sorted = [...entries].sort((a, b) => (a.species === b.species ? a.side.localeCompare(b.side) : a.species < b.species ? -1 : 1));
  const flagged = sorted.filter((e) => e.flags.length > 0).map((e) => ({ ...e, flags: [...e.flags].sort() }));
  const counts: Record<string, number> = {};
  for (const e of flagged) for (const f of e.flags) counts[f] = (counts[f] ?? 0) + 1;
  const orderedCounts: Record<string, number> = {};
  for (const k of Object.keys(counts).sort()) orderedCounts[k] = counts[k]!;
  return { total: sorted.length, flagged, counts: orderedCounts };
}

export const CONTACT_CELL = 128;
export const CONTACT_COLUMNS = 16;
export const CONTACT_LABEL_H = GLYPH_H + 5;

export interface ContactSheetItem {
  label: string;
  /** Path to a PNG/WebP of the normalized albedo (any size; resized to CONTACT_CELL). */
  albedoPath: string;
  flagged: boolean;
}

export async function renderContactSheet(items: ContactSheetItem[]): Promise<Buffer> {
  const cols = CONTACT_COLUMNS;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const cellH = CONTACT_CELL + CONTACT_LABEL_H;
  const sheet = createRgba(cols * CONTACT_CELL, rows * cellH);
  drawCheckerboard(sheet, 8);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]!;
    const cx = (idx % cols) * CONTACT_CELL;
    const cy = Math.floor(idx / cols) * cellH;
    const { data, info } = await sharp(item.albedoPath)
      .ensureAlpha()
      .resize(CONTACT_CELL, CONTACT_CELL, { kernel: 'lanczos3', fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    compositeOver(sheet, new Uint8Array(data.buffer, data.byteOffset, data.byteLength), info.width, info.height, cx, cy);
    // Label strip.
    fillRect(sheet, cx, cy + CONTACT_CELL, CONTACT_CELL, CONTACT_LABEL_H, item.flagged ? [120, 30, 30] : [24, 24, 28]);
    const maxChars = Math.floor(CONTACT_CELL / GLYPH_ADVANCE);
    drawText(sheet.data, sheet.width, sheet.height, cx + 2, cy + CONTACT_CELL + 3, item.label.slice(0, maxChars), item.flagged ? [255, 200, 200] : [230, 230, 230]);
  }

  return sharp(Buffer.from(sheet.data.buffer, sheet.data.byteOffset, sheet.data.byteLength), {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png({ compressionLevel: 9, effort: 7, palette: false })
    .toBuffer();
}

function drawCheckerboard(img: RgbaImage, square: number): void {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const light = (Math.floor(x / square) + Math.floor(y / square)) % 2 === 0;
      const v = light ? 200 : 150;
      const i = (y * img.width + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
}

function fillRect(img: RgbaImage, x0: number, y0: number, w: number, h: number, rgb: [number, number, number]): void {
  for (let y = y0; y < y0 + h && y < img.height; y++) {
    for (let x = x0; x < x0 + w && x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
  }
}

/** Straight-alpha "over" composite of src onto dst at (left, top). */
function compositeOver(dst: RgbaImage, src: Uint8Array, w: number, h: number, left: number, top: number): void {
  for (let y = 0; y < h; y++) {
    const dy = top + y;
    if (dy < 0 || dy >= dst.height) continue;
    for (let x = 0; x < w; x++) {
      const dx = left + x;
      if (dx < 0 || dx >= dst.width) continue;
      const s = (y * w + x) * 4;
      const a = src[s + 3]! / 255;
      if (a === 0) continue;
      const d = (dy * dst.width + dx) * 4;
      dst.data[d] = Math.round(src[s]! * a + dst.data[d]! * (1 - a));
      dst.data[d + 1] = Math.round(src[s + 1]! * a + dst.data[d + 1]! * (1 - a));
      dst.data[d + 2] = Math.round(src[s + 2]! * a + dst.data[d + 2]! * (1 - a));
      dst.data[d + 3] = 255;
    }
  }
}
