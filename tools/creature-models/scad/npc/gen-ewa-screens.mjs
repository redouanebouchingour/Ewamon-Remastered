// Writes _ewa_screens.scad: Red1's original 2022 Ewamon sprites (the HvA EWA course game) as pixel modules for the
// monitors of Team Ewamon HQ (ewa_desk.scad) and its logo sign (ewa_hq_front.scad). Reads the PNGs from the old repo once; the committed include means a
// build never needs that repo. Run from tools/creature-models:
//
//   node scad/npc/gen-ewa-screens.mjs [<sprite dir>]
//
// Per sprite: crop to the opaque box, downsample to SPRITES[].h pixels tall (each target pixel takes the majority
// palette colour of its source block, or stays empty when under ALPHA_MIN of the block is opaque), a small k-means
// palette per sprite, then same-colour horizontal runs merged into one cube and equal runs on consecutive rows merged
// into one rectangle. Module frame: 1 unit = 1 pixel, x right, y up, origin at the bottom left, z = 0..d; `a` is
// the colours' alpha marker (GLOW on a monitor, NOGLOW for paint).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ?? 'C:/Users/Flowmatic - Redouane/Ewamon/ewamon/frontend/ewamon-sprites/ewamon(front)';
const ALPHA_MIN = 0.42;
const SPRITES = [
  { name: 'kygra', file: 'kygra(front).png', h: 36, k: 12 },
  { name: 'raidori', file: 'raidori(front).png', h: 22, k: 10 },
  { name: 'moflame', file: 'moflame(front).png', h: 30, k: 12 },
  { name: 'darkone', file: 'darkone(front).png', h: 34, k: 10 },
  { name: 'resilian', file: 'resilian(front).png', h: 32, k: 10 },
  { name: 'yaschamp', file: 'yaschamp(front)(boxingstyle).png', h: 32, k: 10 },
  // the team's logo (their Discord and WhatsApp picture), sharper for the sign on Team Ewamon HQ (ewa_hq_front.scad)
  { name: 'logo', file: 'yaschamp(front)(boxingstyle).png', h: 48, k: 14 },
];

/** Deterministic k-means over [r, g, b] samples (farthest-point seeds). */
function palette(px, k) {
  const step = Math.max(1, Math.floor(px.length / 6000));
  const pts = px.filter((_, i) => i % step === 0);
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const mean = pts.reduce((m, p) => [m[0] + p[0], m[1] + p[1], m[2] + p[2]], [0, 0, 0]).map((v) => v / pts.length);
  let c = [pts.reduce((b, p) => (d2(p, mean) < d2(b, mean) ? p : b), pts[0])];
  while (c.length < k) {
    let best = pts[0];
    let bd = -1;
    for (const p of pts) { const d = Math.min(...c.map((q) => d2(p, q))); if (d > bd) { bd = d; best = p; } }
    if (bd < 1) break;
    c.push(best);
  }
  for (let it = 0; it < 24; it++) {
    const sum = c.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let j = 0;
      for (let i = 1; i < c.length; i++) if (d2(p, c[i]) < d2(p, c[j])) j = i;
      sum[j][0] += p[0]; sum[j][1] += p[1]; sum[j][2] += p[2]; sum[j][3]++;
    }
    c = c.map((q, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : q));
  }
  return c;
}

async function pixels({ file, h: H, k }) {
  const { data, info } = await sharp(join(SRC, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W0, height: H0 } = info;
  const at = (x, y) => data.subarray((y * W0 + x) * 4, (y * W0 + x) * 4 + 4);
  let [x0, y0, x1, y1] = [W0, H0, -1, -1];
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
    if (at(x, y)[3] >= 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const W = Math.max(1, Math.round((cw * H) / ch));
  const opaque = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const p = at(x, y); if (p[3] >= 128) opaque.push([p[0], p[1], p[2]]); }
  const pal = palette(opaque, k);
  const nearest = (p) => { let j = 0; let bd = Infinity; pal.forEach((q, i) => { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; j = i; } }); return j; };
  // grid[row][col], row 0 = the bottom (scad y up); -1 = empty
  const grid = [];
  for (let ty = 0; ty < H; ty++) {
    const row = [];
    const sy0 = y0 + Math.floor(((H - 1 - ty) * ch) / H);
    const sy1 = y0 + Math.max(Math.floor(((H - ty) * ch) / H), Math.floor(((H - 1 - ty) * ch) / H) + 1);
    for (let tx = 0; tx < W; tx++) {
      const sx0 = x0 + Math.floor((tx * cw) / W);
      const sx1 = x0 + Math.max(Math.floor(((tx + 1) * cw) / W), Math.floor((tx * cw) / W) + 1);
      const votes = new Map();
      let n = 0;
      let o = 0;
      for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
        n++;
        const p = at(x, y);
        if (p[3] < 128) continue;
        o++;
        const j = nearest(p);
        votes.set(j, (votes.get(j) ?? 0) + 1);
      }
      row.push(o / n < ALPHA_MIN ? -1 : [...votes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
    }
    grid.push(row);
  }
  return { W, H, pal, grid };
}

/** Same-colour runs per row, then equal runs on consecutive rows merged: [x, y, w, h, colour]. */
function rects({ W, H, grid }) {
  const open = new Map();
  const out = [];
  for (let y = 0; y < H; y++) {
    const runs = [];
    for (let x = 0; x < W;) {
      const c = grid[y][x];
      let e = x + 1;
      while (e < W && grid[y][e] === c) e++;
      if (c !== -1) runs.push(`${x},${e - x},${c}`);
      x = e;
    }
    const seen = new Set(runs);
    for (const [key, r] of open) if (!seen.has(key)) { out.push(r); open.delete(key); }
    for (const key of runs) {
      if (open.has(key)) open.get(key)[3]++;
      else { const [x, w, c] = key.split(',').map(Number); open.set(key, [x, y, w, 1, c]); }
    }
  }
  out.push(...open.values());
  return out;
}

const f3 = (v) => (Math.round(v * 1000) / 1000).toString();
const lines = [
  '// Generated by gen-ewa-screens.mjs from Red1\'s original 2022 Ewamon front sprites (the old repo, read-only). Do not',
  '// edit: rerun the generator. One module per sprite: 1 unit = 1 pixel, x right, y up, origin at the bottom left,',
  '// z = 0..d; `a` is the alpha marker (GLOW, the default, for a monitor; NOGLOW for paint, e.g. the logo sign).',
  '// EWA_<NAME> = [width, height] in pixels.',
  '',
];
let total = 0;
for (const s of SPRITES) {
  const px = await pixels(s);
  const rs = rects(px);
  total += rs.length;
  lines.push(`EWA_${s.name.toUpperCase()} = [${px.W}, ${px.H}];`);
  lines.push(`module ewa_${s.name}(d = 1, a = GLOW) {`);
  px.pal.forEach((c, i) => {
    const mine = rs.filter((r) => r[4] === i);
    if (mine.length === 0) return;
    lines.push(`  color([${c.map((v) => f3(v / 255)).join(', ')}, a]) {`);
    for (const [x, y, w, h] of mine) lines.push(`    translate([${x}, ${y}, 0]) cube([${w}, ${h}, d]);`);
    lines.push('  }');
  });
  lines.push('}', '');
  console.log(`${s.name}: ${px.W} x ${px.H} px, ${px.pal.length} colours, ${rs.length} cubes`);
}
writeFileSync(join(HERE, '_ewa_screens.scad'), lines.join('\n'));
console.log(`_ewa_screens.scad: ${total} cubes`);
