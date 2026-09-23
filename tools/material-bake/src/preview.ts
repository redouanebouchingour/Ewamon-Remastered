/**
 * QA previews (SPEC §40.3.4 `--preview <id>`, and the slice contact sheet). Rendered from the baked mip chain
 * before encoding (Node has no UASTC transcoder here), displayed v-up (row 0 at the bottom, as in-game).
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';
import type { BakedTier } from './bake';
import type { Level } from './encode';

const CELL = 256;

/** Nearest mip at or above `px`, box-resampled to exactly px × px, flipped v-up, alpha composited on a checker. */
function tile(levels: readonly Level[], px: number, kind: 'albedo' | 'orm' | 'normal', repeat = 1): Uint8Array {
  const out = new Uint8Array(px * px * 3);
  const want = px / repeat;
  let lv = levels[0]!;
  for (const l of levels) if (l.width >= want) lv = l;
  const s = lv.width;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const sx = Math.floor(((x % want) / want) * s);
      const syTop = Math.floor(((y % want) / want) * s);
      const sy = s - 1 - syTop;                       // v-up
      const i = (sy * s + sx) * 4;
      let r = lv.data[i]!, g = lv.data[i + 1]!, b = lv.data[i + 2]!;
      if (kind === 'albedo') {
        const a = lv.data[i + 3]! / 255;
        if (a < 1) {
          const check = ((x >> 3) + (y >> 3)) & 1 ? 150 : 110;
          r = Math.round(r * a + check * (1 - a)); g = Math.round(g * a + check * (1 - a)); b = Math.round(b * a + check * (1 - a));
        }
      }
      const o = (y * px + x) * 3;
      out[o] = r; out[o + 1] = g; out[o + 2] = b;
    }
  }
  return out;
}

/** Simple lit view: albedo × (ambient + N·L) from a low sun at the upper left, to judge the normal map. */
function lit(t: BakedTier, px: number): Uint8Array {
  const alb = tile(t.albedo, px, 'albedo'), nrm = tile(t.normal, px, 'normal');
  const out = new Uint8Array(px * px * 3);
  const L = [-0.55, 0.55, 0.63];
  const ll = Math.hypot(L[0]!, L[1]!, L[2]!);
  for (let i = 0; i < px * px; i++) {
    const nx = (nrm[i * 3]! - 128) / 127, ny = (nrm[i * 3 + 1]! - 128) / 127, nz = (nrm[i * 3 + 2]! - 128) / 127;
    const d = Math.max(0, (nx * L[0]! + ny * L[1]! + nz * L[2]!) / ll);
    const k = 0.35 + 0.9 * d;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.min(255, Math.round(alb[i * 3 + c]! * k));
  }
  return out;
}

function blit(dst: Uint8Array, dw: number, src: Uint8Array, sw: number, sh: number, ox: number, oy: number): void {
  for (let y = 0; y < sh; y++) dst.set(src.subarray(y * sw * 3, (y + 1) * sw * 3), ((oy + y) * dw + ox) * 3);
}

/**
 * Contact sheet: one row per surface — albedo | ORM | normal | lit | albedo tiled 2×2 — 256 px cells.
 * (The spec's sheet is the first three columns; lit and 2×2 are added to judge relief and seams.)
 */
export async function writeSheet(tiers: readonly BakedTier[], file: string): Promise<void> {
  const cols = 5, W = cols * CELL, H = tiers.length * CELL;
  const img = new Uint8Array(W * H * 3);
  tiers.forEach((t, row) => {
    blit(img, W, tile(t.albedo, CELL, 'albedo'), CELL, CELL, 0, row * CELL);
    blit(img, W, tile(t.orm, CELL, 'orm'), CELL, CELL, CELL, row * CELL);
    blit(img, W, tile(t.normal, CELL, 'normal'), CELL, CELL, 2 * CELL, row * CELL);
    blit(img, W, lit(t, CELL), CELL, CELL, 3 * CELL, row * CELL);
    blit(img, W, tile(t.albedo, CELL, 'albedo', 2), CELL, CELL, 4 * CELL, row * CELL);
  });
  mkdirSync(dirname(file), { recursive: true });
  await sharp(Buffer.from(img), { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toFile(file);
}

/** `--preview <id>`: albedo | ORM | normal side by side at level 0 (top row) and level 3 (bottom row). */
export async function writePreview(t: BakedTier, file: string): Promise<void> {
  const S = t.size, W = S * 3, H = S * 2;
  const img = new Uint8Array(W * H * 3);
  const full = (levels: readonly Level[], kind: 'albedo' | 'orm' | 'normal'): Uint8Array => tile(levels, S, kind);
  const lv3 = (levels: readonly Level[], kind: 'albedo' | 'orm' | 'normal'): Uint8Array => tile(levels.slice(3), S, kind);
  blit(img, W, full(t.albedo, 'albedo'), S, S, 0, 0);
  blit(img, W, full(t.orm, 'orm'), S, S, S, 0);
  blit(img, W, full(t.normal, 'normal'), S, S, 2 * S, 0);
  blit(img, W, lv3(t.albedo, 'albedo'), S, S, 0, S);
  blit(img, W, lv3(t.orm, 'orm'), S, S, S, S);
  blit(img, W, lv3(t.normal, 'normal'), S, S, 2 * S, S);
  mkdirSync(dirname(file), { recursive: true });
  await sharp(Buffer.from(img), { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toFile(file);
}
