/**
 * QA artifacts (spec §40.1.3): `qa-report.json`, `contact-sheet.png` (every sprite at 128 px,
 * 16 per row, on a checkerboard, labelled with the built-in bitmap font) and the per-source
 * frame strips `qa/frames/<id>-<side>.png` used to fill `frame-select.json`.
 *
 * Flag semantics: `INFORMATIONAL_FLAGS` never block a release; a flag listed in
 * `qa-accept.json` with a reason is suppressed for that sprite; everything else is
 * actionable. Release rule for M1: `actionable === 0`.
 */
import sharp from 'sharp';
import type { QaFlag } from './alpha.js';
import { INFORMATIONAL_FLAGS, NEVER_ACCEPTED_FLAGS } from './alpha.js';
import { GLYPH_ADVANCE, GLYPH_H, drawText } from './font.js';
import type { BindStat } from './plan.js';
import type { ExcludedFile } from './sources.js';
import type { RgbaImage, SpriteSide } from './types.js';
import { compareStrings, createRgba } from './types.js';

export interface QaEntry {
  species: string;
  side: SpriteSide;
  flags: QaFlag[];
  source: string;
  /** Flags that are neither informational nor accepted. */
  actionable: QaFlag[];
}

export interface QaAcceptance {
  species: string;
  /** Omit to accept the flag on both sides. */
  side?: SpriteSide;
  flag: QaFlag;
  reason: string;
}

export interface QaEncodingSummary {
  albedoQuality: number;
  normalQuality: number;
  /** Rungs tried, top first; the last one is the one shipped. */
  rungsTried: Array<{ albedo: number; normal: number; totalBytes: number }>;
  /** Thumbnail ladder outcome: rung label (`q80/aq90`, `q80/aq100/a8`, …) -> species count. */
  thumbs: { count: number; bytes: number; rungs: Record<string, number> };
}

export interface QaReport {
  /** Sprites processed (130 species × 2 sides = 260). */
  total: number;
  /** Sprites carrying at least one actionable flag. Release rule: 0. */
  actionable: number;
  /** Sprites whose flags are all informational or accepted. */
  informational: number;
  /** Files under the source folders that are not species sprites. */
  excluded: ExcludedFile[];
  /** Flags suppressed by `qa-accept.json`. */
  accepted: QaAcceptance[];
  /** Per-flag counts over `flagged` (informational flags included). */
  counts: Record<string, number>;
  /** Every sprite with at least one flag, informational flags included, sorted by (species, side). */
  flagged: QaEntry[];
  /** Zone -> atlases bound and species duplicated for it (spec §40.1.4). */
  bindStats: Record<string, BindStat>;
  encoding: QaEncodingSummary | null;
  totalBytes: number;
}

export interface QaReportInput {
  entries: Array<Omit<QaEntry, 'actionable'>>;
  excluded: ExcludedFile[];
  accepted: QaAcceptance[];
  bindStats: Record<string, BindStat>;
  encoding: QaEncodingSummary | null;
  totalBytes: number;
}

export function isAccepted(accepted: readonly QaAcceptance[], species: string, side: SpriteSide, flag: QaFlag): boolean {
  if (NEVER_ACCEPTED_FLAGS.has(flag)) return false;
  return accepted.some((a) => a.species === species && a.flag === flag && (a.side === undefined || a.side === side));
}

export function compareEntries(a: { species: string; side: SpriteSide }, b: { species: string; side: SpriteSide }): number {
  return compareStrings(a.species, b.species) || compareStrings(a.side, b.side);
}

export function buildQaReport(input: QaReportInput): QaReport {
  const sorted = [...input.entries].sort(compareEntries);
  const flagged: QaEntry[] = sorted
    .filter((e) => e.flags.length > 0)
    .map((e) => {
      const flags = [...new Set(e.flags)].sort(compareStrings);
      const actionable = flags.filter((f) => !INFORMATIONAL_FLAGS.has(f) && !isAccepted(input.accepted, e.species, e.side, f));
      return { species: e.species, side: e.side, flags, source: e.source, actionable };
    });
  const counts: Record<string, number> = {};
  for (const e of flagged) for (const f of e.flags) counts[f] = (counts[f] ?? 0) + 1;
  const orderedCounts: Record<string, number> = {};
  for (const k of Object.keys(counts).sort(compareStrings)) orderedCounts[k] = counts[k]!;
  const actionable = flagged.filter((e) => e.actionable.length > 0).length;
  const bindStats: Record<string, BindStat> = {};
  for (const z of Object.keys(input.bindStats).sort(compareStrings)) bindStats[z] = input.bindStats[z]!;
  // Only acceptances that actually suppressed a flag are reported as used: a `leak` / `empty`
  // entry never does (NEVER_ACCEPTED_FLAGS), so it is not listed even when the sprite is flagged.
  const accepted = input.accepted
    .filter((a) => flagged.some((e) => e.species === a.species && e.flags.includes(a.flag) && isAccepted([a], e.species, e.side, a.flag)))
    .sort((a, b) => compareStrings(a.species, b.species) || compareStrings(a.flag, b.flag));
  return {
    total: sorted.length,
    actionable,
    informational: flagged.length - actionable,
    excluded: [...input.excluded].sort((a, b) => compareStrings(a.file, b.file)),
    accepted,
    counts: orderedCounts,
    flagged,
    bindStats,
    encoding: input.encoding,
    totalBytes: input.totalBytes,
  };
}

export function serializeQaReport(r: QaReport): string {
  return `${JSON.stringify(r, null, 2)}\n`;
}

// ---- contact sheet ---------------------------------------------------------------------------

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
    fillRect(sheet, cx, cy + CONTACT_CELL, CONTACT_CELL, CONTACT_LABEL_H, item.flagged ? [120, 30, 30] : [24, 24, 28]);
    const maxChars = Math.floor(CONTACT_CELL / GLYPH_ADVANCE);
    drawText(sheet.data, sheet.width, sheet.height, cx + 2, cy + CONTACT_CELL + 3, item.label.slice(0, maxChars), item.flagged ? [255, 200, 200] : [230, 230, 230]);
  }
  return encodePng(sheet);
}

/** All pages of a multiframe source in a row, each `cell` px, labelled with its page index. */
export function renderFrameStrip(pages: RgbaImage[], cell = 256): Promise<Buffer> {
  const labelH = GLYPH_H + 5;
  const strip = createRgba(Math.max(1, pages.length) * cell, cell + labelH);
  drawCheckerboard(strip, 16);
  pages.forEach((page, i) => {
    const scale = cell / Math.max(page.width, page.height);
    const w = Math.max(1, Math.round(page.width * scale));
    const h = Math.max(1, Math.round(page.height * scale));
    const resized = nearestResize(page, w, h);
    compositeOver(strip, resized.data, w, h, i * cell + ((cell - w) >> 1), (cell - h) >> 1);
    fillRect(strip, i * cell, cell, cell, labelH, [24, 24, 28]);
    drawText(strip.data, strip.width, strip.height, i * cell + 2, cell + 3, `PAGE ${i}`, [230, 230, 230]);
  });
  return encodePng(strip);
}

function nearestResize(src: RgbaImage, w: number, h: number): RgbaImage {
  const out = createRgba(w, h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / w));
      out.data.set(src.data.subarray((sy * src.width + sx) * 4, (sy * src.width + sx) * 4 + 4), (y * w + x) * 4);
    }
  }
  return out;
}

function encodePng(img: RgbaImage): Promise<Buffer> {
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: { width: img.width, height: img.height, channels: 4 },
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
