/** Dev-only: a gallery of one part family on the base body. `tsx dev/gallery.ts <out.png> <scale> <hair|hats> [idle|walk]` */
import sharp from 'sharp';
import { CELL_H, CELL_W } from '../src/grid.js';
import { renderLook, type Frame, type LookDef } from '../src/sheet.js';
import type { PartDef, PartUse, RampSpec } from '../src/compose.js';
import { ARMS, FACE_F, FACE_M, HEAD, LEGS } from '../src/parts/body.js';
import * as H from '../src/parts/hair.js';
import * as HATS from '../src/parts/hats.js';
import { TEE } from '../src/parts/torso.js';

const out = process.argv[2] ?? 'gallery.png';
const scale = Number(process.argv[3] ?? 6);
const family = process.argv[4] ?? 'hair';
const set = process.argv[5] ?? 'idle';
const FIXED: Record<string, RampSpec> = {
  eye: { base: '#2b2233', kind: 'eye' }, eyeHi: { base: '#fbf7ee', kind: 'eye' }, iris: { base: '#3f5f8f', kind: 'eye' },
  mouth: { base: '#8c3f3a', kind: 'skin' }, blush: { base: '#ec9d8e', kind: 'skin' },
};
const colors = ['#6e4428', '#2a2430', '#c9a25a', '#9a3b2a', '#4a3226', '#d8d4cc', '#3a2a22', '#e0c070', '#b0b0b8', '#7a5a3a', '#5a3a2a'];
const hatColors = ['#7a5232', '#c23b3b', '#2a2630', '#9aa4b0', '#d8a93a', '#56603a', '#2e3f73', '#8a8f98', '#23263a', '#2a2628'];
const use = (part: PartDef, ...slots: string[]): PartUse => ({ part, slots });
const base = (i: number): Record<string, RampSpec> => ({
  ...FIXED, skin: { base: '#f0c39c', kind: 'skin' }, hair: { base: colors[i % colors.length]!, kind: 'hair' }, accent: { base: '#c8404a', kind: 'cloth' },
  shirt: { base: '#5a8a4a', kind: 'cloth' }, pants: { base: '#40485a', kind: 'cloth' }, shoe: { base: '#6a4430', kind: 'leather' },
  hat: { base: hatColors[i % hatColors.length]!, kind: i === 3 || i === 7 ? 'metal' : i === 4 ? 'gold' : 'cloth' }, band: { base: '#d8b04a', kind: 'gold' }, emblem: { base: '#ece6d6', kind: 'white' }, plume: { base: '#c83a3a', kind: 'cloth' },
});
const body = (i: number): PartUse[] => [use(HEAD), use(i % 2 ? FACE_F : FACE_M), use(TEE, 'shirt'), use(ARMS, 'shirt', 'skin', 'skin'), use(LEGS, 'pants', 'pants', 'shoe')];
const looks: LookDef[] = family === 'hats'
  ? Object.entries(HATS).map(([name, part], i) => ({ id: name, palette: base(i), parts: [...body(i), use(H.HAIR_CROP, 'hair', 'accent'), use(part as PartDef, 'hat', 'band', 'emblem', 'plume')] }))
  : Object.entries(H).map(([name, part], i) => ({ id: name, palette: base(i), parts: [...body(i), use(part as PartDef, 'hair', 'accent')] }));
const SETS: Record<string, (f: Frame) => boolean> = { idle: (f) => f.state === 'idle' && f.index === 0 && f.facing !== 'R', walk: (f) => f.state === 'walk' && f.facing === 'L', r: (f) => f.state === 'idle' && f.index === 0 && f.facing === 'R' };
const cols = looks.length; const rowsSel = looks.map((l) => renderLook(l).filter(SETS[set]!));
const nrows = Math.max(...rowsSel.map((r) => r.length));
const pad = 2;
const W = cols * (CELL_W + pad) * scale; const Hh = nrows * (CELL_H + pad) * scale;
const img = Buffer.alloc(W * Hh * 4);
for (let i = 0; i < W * Hh; i++) { img[i * 4] = 128; img[i * 4 + 1] = 150; img[i * 4 + 2] = 110; img[i * 4 + 3] = 255; }
rowsSel.forEach((fr, c) => fr.forEach((f, r) => {
  const ox = c * (CELL_W + pad) * scale; const oy = r * (CELL_H + pad) * scale;
  for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) {
    const s = (y * CELL_W + x) * 4; if (f.rgba[s + 3] === 0) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) { const i = ((oy + y * scale + dy) * W + ox + x * scale + dx) * 4; img[i] = f.rgba[s]!; img[i + 1] = f.rgba[s + 1]!; img[i + 2] = f.rgba[s + 2]!; }
  }
}));
await sharp(img, { raw: { width: W, height: Hh, channels: 4 } }).png().toFile(out);
console.log(out, W, Hh, looks.map((l) => l.id).join(' '));
