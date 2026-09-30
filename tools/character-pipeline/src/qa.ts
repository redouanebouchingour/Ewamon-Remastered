/**
 * QA: the contact sheet — every look, every facing and state, at 4× nearest on a two-tone ground (grass /
 * cobble) so silhouettes and outlines can be judged against both, with the cell's foot line marked.
 *
 * The 5 × 7 label font is copied from `tools/sprite-pipeline/src/font.ts` (not exported by that package).
 */
import sharp from 'sharp';
import { CELL_H, CELL_W } from './grid.js';
import { FOOT_ROW } from './compose.js';
import { FACINGS, STATES } from './poses.js';
import type { Frame } from './sheet.js';

const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['....#', '....#', '....#', '....#', '#...#', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..###', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '###..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '@': ['.###.', '#...#', '....#', '.##.#', '#.#.#', '#.#.#', '.####'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['..#..', '.#...', '#....', '#....', '#....', '.#...', '..#..'],
  ')': ['..#..', '...#.', '....#', '....#', '....#', '...#.', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

const GLYPH_W = 5;
const GLYPH_H = 7;
const GLYPH_ADVANCE = 6;

function drawText(data: Uint8Array, width: number, height: number, x: number, y: number, text: string, rgb: readonly [number, number, number], scale = 1): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPHS[ch] ?? GLYPHS['?']!;
    for (let gy = 0; gy < GLYPH_H * scale; gy++) {
      const row = glyph[Math.floor(gy / scale)]!;
      for (let gx = 0; gx < GLYPH_W * scale; gx++) {
        if (row[Math.floor(gx / scale)] !== '#') continue;
        const px = cx + gx; const py = y + gy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const i = (py * width + px) * 4;
        data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
      }
    }
    cx += GLYPH_ADVANCE * scale;
  }
}

export interface ContactSheetItem { readonly id: string; readonly frames: readonly Frame[] }

/** Frames of one look in sheet order: D (idle walk run wave cheer), then U, L, R. */
function ordered(frames: readonly Frame[]): Frame[] {
  const out: Frame[] = [];
  for (const facing of FACINGS) for (const state of STATES) for (const f of frames) if (f.facing === facing && f.state === state) out.push(f);
  return out;
}

export const SHEET_SCALE = 4;

/** PNG bytes of the contact sheet. Deterministic. */
export async function renderContactSheet(items: readonly ContactSheetItem[], scale = SHEET_SCALE): Promise<Uint8Array> {
  const gap = 2;          // cells between facings
  const label = 22;       // label band: the look id, then the facing letters (texels, before scale)
  const perLook = Math.max(...items.map((i) => i.frames.length));
  const cols = perLook + gap * (FACINGS.length - 1);
  const W = (cols * CELL_W + 8) * scale;
  const rowH = (CELL_H + label) * scale;
  const H = items.length * rowH + 8 * scale;
  const img = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { img[i * 4] = 34; img[i * 4 + 1] = 36; img[i * 4 + 2] = 42; img[i * 4 + 3] = 255; }
  items.forEach((item, r) => {
    const oy = r * rowH + label * scale;
    drawText(img, W, H, 4 * scale, r * rowH + 3 * scale, item.id.replace(':', ' : '), [236, 232, 220], 2);
    let col = 0; let lastFacing = '';
    for (const f of ordered(item.frames)) {
      if (lastFacing !== '' && f.facing !== lastFacing) col += gap;
      if (f.facing !== lastFacing) drawText(img, W, H, (4 + col * CELL_W) * scale, r * rowH + 12 * scale, `${f.facing}`, [150, 200, 240], 2);
      lastFacing = f.facing;
      const ox = (4 + col * CELL_W) * scale;
      const ground = f.facing === 'D' || f.facing === 'L' ? [112, 146, 88] : [150, 142, 126];
      for (let y = 0; y < CELL_H; y++) {
        for (let x = 0; x < CELL_W; x++) {
          const s = (y * CELL_W + x) * 4;
          const on = f.rgba[s + 3] !== 0;
          const foot = y === FOOT_ROW;
          const c = on ? [f.rgba[s]!, f.rgba[s + 1]!, f.rgba[s + 2]!] : foot ? [ground[0]! - 30, ground[1]! - 30, ground[2]! - 30] : ground;
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const i = ((oy + y * scale + dy) * W + ox + x * scale + dx) * 4;
              img[i] = c[0]!; img[i + 1] = c[1]!; img[i + 2] = c[2]!;
            }
          }
        }
      }
      col++;
    }
  });
  const png = await sharp(Buffer.from(img.buffer), { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  return new Uint8Array(png.buffer, png.byteOffset, png.byteLength);
}
