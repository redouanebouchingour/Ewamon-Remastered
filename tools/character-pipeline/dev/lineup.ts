/** Dev-only: every look side by side, one facing per row. `tsx dev/lineup.ts <out.png> <scale> [state] [frame] [ids…]` */
import sharp from 'sharp';
import { CELL_H, CELL_W } from '../src/grid.js';
import { renderLook } from '../src/sheet.js';
import { allLooks } from '../src/looks.js';

const out = process.argv[2] ?? 'lineup.png';
const scale = Number(process.argv[3] ?? 4);
const state = process.argv[4] ?? 'idle';
const frame = Number(process.argv[5] ?? 0);
const ids = process.argv.slice(6);
const looks = allLooks().filter((l) => ids.length === 0 || ids.includes(l.id));
const facings = state === 'wave' || state === 'cheer' ? ['D'] : ['D', 'U', 'L', 'R'];
const frames = looks.map((l) => renderLook(l).filter((f) => f.state === state && f.index === frame));
const pad = 1;
const W = looks.length * (CELL_W + pad) * scale; const H = facings.length * (CELL_H + pad) * scale;
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { const y = Math.floor(i / W); const band = Math.floor(y / ((CELL_H + pad) * scale)) % 2; img[i * 4] = band ? 150 : 118; img[i * 4 + 1] = band ? 144 : 148; img[i * 4 + 2] = band ? 130 : 96; img[i * 4 + 3] = 255; }
frames.forEach((fs, c) => facings.forEach((facing, r) => {
  const f = fs.find((x) => x.facing === facing); if (!f) return;
  const ox = c * (CELL_W + pad) * scale; const oy = r * (CELL_H + pad) * scale;
  for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) {
    const s = (y * CELL_W + x) * 4; if (f.rgba[s + 3] === 0) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) { const i = ((oy + y * scale + dy) * W + ox + x * scale + dx) * 4; img[i] = f.rgba[s]!; img[i + 1] = f.rgba[s + 1]!; img[i + 2] = f.rgba[s + 2]!; }
  }
}));
await sharp(img, { raw: { width: W, height: H, channels: 4 } }).png().toFile(out);
console.log(out, W, H, looks.map((l) => l.id).join(' '));
