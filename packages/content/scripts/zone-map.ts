/**
 * Top-down debug maps of the zone sculpts (`src/sculpt.ts`, `src/data/sculpts.ts`): hillshade by height, water (blue),
 * bridge decks (brown), unwalkable samples (red tint), walkable but unreachable from the spawn (magenta), roads, door
 * paths and bridge centrelines, tall-grass patches (green), buildings, the set-piece (yellow), authored points (red),
 * the spawn (white), obstacles (cyan). Two pixels per sample.
 *
 *   npx tsx packages/content/scripts/zone-map.ts <out dir> [zone id ...]
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { ZONES } from '../src/data/zones';
import { getZoneSurface, walkableComponent } from '../src/heightfield';

const out = process.argv[2]!;
const ids = process.argv.slice(3);
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer): number => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const chunk = (t: string, d: Buffer): Buffer => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const z of ZONES) {
  if (ids.length > 0 && !ids.includes(z.id)) continue;
  const surf = getZoneSurface(z.id);
  const h = surf.heightfield; const plan = surf.plan;
  const n = h.res; const px = 2; const W = n * px;
  const img = new Uint8Array(W * W * 3);
  let lo = Infinity; let hi = -Infinity;
  for (const v of h.heights) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const reach = walkableComponent(h, z.spawn.x, z.spawn.z);
  const set = (x: number, y: number, r: number, g: number, b: number): void => { if (x < 0 || y < 0 || x >= W || y >= W) return; const i = (y * W + x) * 3; img[i] = r; img[i + 1] = g; img[i + 2] = b; };
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const i = row * n + col;
    const e = (h.heights[i]! - lo) / Math.max(1e-6, hi - lo);
    const hx = col > 0 && col < n - 1 ? h.heights[i + 1]! - h.heights[i - 1]! : 0;
    const hz = row > 0 && row < n - 1 ? h.heights[i + n]! - h.heights[i - n]! : 0;
    const shade = Math.max(0.35, Math.min(1.3, 1 - (hx + hz) * 0.9));
    let r = (90 + 120 * e) * shade; let g = (110 + 100 * e) * shade; let b = (70 + 60 * e) * shade;
    if (h.water[i] === 1) { r = 40; g = 90 + 40 * e; b = 170; if (h.walkable[i] === 1) { r = 150; g = 100; b = 50; } }
    else if (h.walkable[i] === 0) { r = r * 0.6 + 60; g *= 0.55; b *= 0.55; }
    else if (reach[i] === 0) { r = 200; g = 60; b = 200; }
    for (let a = 0; a < px; a++) for (let c = 0; c < px; c++) set(col * px + c, row * px + a, r, g, b);
  }
  const toPx = (x: number, zz: number): [number, number] => [Math.round(((x - h.originX) / h.step) * px), Math.round(((zz - h.originZ) / h.step) * px)];
  const dot = (x: number, zz: number, r: number, c: [number, number, number]): void => { const [cx, cy] = toPx(x, zz); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) set(cx + dx, cy + dy, ...c); };
  for (const rd of [...plan.roads, ...plan.doorPaths]) for (let k = 0; k + 1 < rd.points.length; k++) {
    const a = rd.points[k]!; const b = rd.points[k + 1]!; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t <= L; t += 0.5) { const x = a[0] + ((b[0] - a[0]) * t) / L; const zz = a[1] + ((b[1] - a[1]) * t) / L; const [cx, cy] = toPx(x, zz); set(cx, cy, 235, 225, 190); }
  }
  for (const e of plan.grassPatches) for (let a = 0; a < 360; a += 3) { const r = (a * Math.PI) / 180; const c = Math.cos(e.yaw); const s = Math.sin(e.yaw); const lx = Math.cos(r) * e.rx; const lz = Math.sin(r) * e.rz; dot(e.x + c * lx + s * lz, e.z - s * lx + c * lz, 1, [40, 220, 60]); }
  for (const b of plan.bridges) for (const [x, zz] of b.points) dot(x, zz, 2, [255, 140, 0]);
  for (const s of plan.solids) if (s.source === 'building') dot(s.shape.x, s.shape.z, 4, [60, 60, 60]);
  dot(plan.setPiece.x, plan.setPiece.z, 5, [255, 255, 0]);
  for (const [x, zz] of plan.points) dot(x, zz, 3, [255, 30, 30]);
  dot(z.spawn.x, z.spawn.z, 4, [255, 255, 255]);
  for (const o of z.obstacles ?? []) dot(o.x, o.z, 3, [0, 200, 255]);
  writeFileSync(`${out}/${z.id}.png`, png(W, W, img));
  let walk = 0; for (const v of h.walkable) walk += v;
  console.log(`${z.id}: h ${lo.toFixed(1)}..${hi.toFixed(1)} walk ${(walk / h.walkable.length).toFixed(2)} bridges ${plan.bridges.length} water ${plan.water.length}`);
}
