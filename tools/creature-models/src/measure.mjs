// A measured reference sheet for modelling a creature against its sprite: `.cache/measure/<id>.png` (the front and
// back art under a grid in scad units, with the sprite's palette) and `.cache/measure/<id>.txt` (the same numbers as
// text: palette colours as scad vectors with their share and extent, the big colour regions with bounding boxes and
// centroids, and with --trace their outlines as scad `polygon()` points for flat parts: wings, fins, flames, leaves).
//
//   node src/measure.mjs <id …> | --all   [--trace]   [--zoom x0,z0,x1,z1]
//   --zoom writes .cache/measure/<id>_zoom.png: that sheet-units window of the front art at 6x (tiny parts: an eye,
//   a claw, a spike; read the exact pixels instead of guessing from the sheet)
//
// Units: the front art's trimmed height is UNITS (40) scad units, feet on z = 0, the art's horizontal centre at x = 0.
// Model to that frame and the build's 1 m normalisation gives the sprite's proportions. In the FRONT panel +X (the
// creature's own left) is the viewer's right, as in the scad; in the BACK panel the viewer sees the creature from
// behind, so +X is on the viewer's LEFT (the axis labels say so). Depth (y) is not in the art: pick it so the sides
// read right (a creature is usually as deep as it is wide at the body, flatter at wings and fins).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { PKG, ROOT, readManifest } from './paths.mjs';

export const UNITS = 40;
const OUT = join(PKG, '.cache/measure');
const PANEL_H = 800;          // px for UNITS units
const MARGIN = 70;
const K = 16;                 // palette size before merging
const MIN_SHARE = 0.004;      // drop palette colours under this share of the opaque pixels
const MIN_REGION = 0.004;     // regions smaller than this share of the opaque area are not listed
const TRACE_EPS = 0.35;       // polygon simplification, scad units

const argv = process.argv.slice(2);
const TRACE = argv.includes('--trace');
const ZOOM = argv.includes('--zoom') ? argv[argv.indexOf('--zoom') + 1].split(',').map(Number) : null;
const args = argv.filter((a, i) => (!a.startsWith('--') || a === '--all') && argv[i - 1] !== '--zoom');
if (import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href || process.argv[1].endsWith('measure.mjs')) {
  const manifest = readManifest();
  const ids = args[0] === '--all' ? Object.keys(manifest.sprites) : args;
  if (ids.length === 0) throw new Error('usage: measure.mjs <id …> | --all [--trace]');
  mkdirSync(OUT, { recursive: true });
  for (const id of ids) {
    const r = await measure(id, manifest, { trace: TRACE });
    console.log(`measure ${id}: ${r.palette.length} colours, front ${r.front.wUnits.toFixed(1)} x ${UNITS} units -> ${r.png}`);
    if (ZOOM) console.log(`  zoom -> ${await zoom(id, r.front, ZOOM)}`);
  }
}

/** Measures one creature; returns { png, txt, palette, front, back }. */
export async function measure(id, manifest = readManifest(), { trace = false } = {}) {
  const entry = manifest.sprites[id];
  if (!entry) throw new Error(`unknown creature ${id}`);
  const sides = {};
  for (const side of ['front', 'back']) sides[side] = await loadSide(manifest, entry[side]);
  const palette = buildPalette(sides.front, sides.back);
  const materials = groupMaterials(palette);
  for (const side of ['front', 'back']) sides[side].regions = regions(sides[side], palette, materials, trace);

  const lines = [];
  lines.push(`# ${id}: measured against the sprite. Units: front height = ${UNITS} (feet z = 0), x = 0 at the art's centre.`);
  lines.push(`front: ${sides.front.wUnits.toFixed(1)} units wide x ${UNITS} tall (${sides.front.w} x ${sides.front.h} px, 1 unit = ${(sides.front.h / UNITS).toFixed(1)} px)`);
  lines.push(`back:  ${sides.back.wUnits.toFixed(1)} units wide x ${(sides.back.h * sides.front.u).toFixed(1)} tall at the front's scale (shown at its own height = ${UNITS})`);
  lines.push("All x below are SCREEN x of that panel (the viewer's right positive). Front: scad x = (sx - 0.5 y) / 0.866 (lib.scad fromSheet). Back: the creature's own +X is on the viewer's LEFT, so scad x = -(sx + 0.5 y) / 0.866 roughly; back outlines go in ppBack().");
  lines.push('');
  lines.push('## Palette (share of the opaque pixels, front + back; scad colour vectors; extent in the front view)');
  for (const p of palette) {
    const ext = p.front ? `front x ${fmt(p.front.x0)}..${fmt(p.front.x1)}, z ${fmt(p.front.z0)}..${fmt(p.front.z1)}` : 'front: absent';
    const tags = [p.outline ? 'OUTLINE (ink line, not a part)' : '', p.glow ? 'GLOWS (emissive in the sprite)' : ''].filter(Boolean).join(', ');
    lines.push(`- ${p.hex}  ${(p.share * 100).toFixed(1).padStart(5)} %  [${p.rgb.map((v) => v.toFixed(2)).join(', ')}]  ${ext}${tags ? '  ' + tags : ''}`);
  }
  lines.push('');
  lines.push('## Materials (the palette grouped by hue: one scad colour per part, its shades listed; use the mid shade, the sprite shading is light, not paint)');
  for (const m of materials) {
    lines.push(`- M${m.index} ${m.hex} ${(m.share * 100).toFixed(1).padStart(5)} %  [${m.rgb.map((v) => v.toFixed(2)).join(', ')}]  shades: ${m.members.map((p) => p.hex).join(' ')}${m.glow ? '  GLOWS' : ''}`);
  }
  for (const side of ['front', 'back']) {
    lines.push('');
    lines.push(`## ${side} regions (connected patches of one material, >= ${(MIN_REGION * 100).toFixed(1)} % of the art; each with ITS OWN mean colour; x = ${side} screen x; polygons are [x, z] outlines for ${side === 'front' ? 'pp()' : 'ppBack()'})`);
    for (const r of sides[side].regions) {
      lines.push(`- M${r.k} ${r.hex} [${r.rgb.map((v) => v.toFixed(2)).join(', ')}] ${(r.share * 100).toFixed(1).padStart(4)} %  box x ${fmt(r.x0)}..${fmt(r.x1)}  z ${fmt(r.z0)}..${fmt(r.z1)}  centre (${fmt(r.cx)}, ${fmt(r.cz)})`);
      if (r.poly) lines.push(`    polygon([${r.poly.map(([x, z]) => `[${fmt(x)}, ${fmt(z)}]`).join(', ')}])`);
    }
  }
  if (trace) {
    lines.push('');
    lines.push('## Whole silhouette (front), as a polygon in [x, z]');
    lines.push(`polygon([${sides.front.outline.map(([x, z]) => `[${fmt(x)}, ${fmt(z)}]`).join(', ')}])`);
  }
  const txt = join(OUT, `${id}.txt`);
  writeFileSync(txt, lines.join('\n') + '\n');
  const png = join(OUT, `${id}.png`);
  await sheet(id, sides, palette, png);
  return { png, txt, palette, materials, front: sides.front, back: sides.back };
}

/** Palette colours grouped by hue (shades of one part): a material is the share-weighted mean, named by its index. */
function groupMaterials(palette) {
  const hsl = (rgb) => {
    const mx = Math.max(...rgb), mn = Math.min(...rgb), l = (mx + mn) / 2, c = mx - mn;
    let h = 0;
    if (c > 1e-6) h = mx === rgb[0] ? ((rgb[1] - rgb[2]) / c + 6) % 6 : mx === rgb[1] ? (rgb[2] - rgb[0]) / c + 2 : (rgb[0] - rgb[1]) / c + 4;
    return { h: h * 60, s: c, l };
  };
  const groups = [];
  for (const p of palette) {
    if (p.outline) continue;
    const a = hsl(p.rgb);
    const g = groups.find((G) => {
      const b = hsl(G.rgb);
      const grey = a.s < 0.1 && b.s < 0.1;
      const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
      return grey ? Math.abs(a.l - b.l) < 0.25 : a.s >= 0.1 && b.s >= 0.1 && dh < 22 && Math.abs(a.l - b.l) < 0.34;
    });
    if (g) {
      const w = g.share + p.share;
      g.rgb = g.rgb.map((v, i) => (v * g.share + p.rgb[i] * p.share) / w);
      g.share = w;
      g.members.push(p);
    } else groups.push({ rgb: p.rgb.slice(), share: p.share, members: [p] });
  }
  groups.sort((a, b) => b.share - a.share);
  groups.forEach((g, i) => {
    g.index = i;
    // the representative colour: the member nearest the group's mean (a real sprite colour, not a blend)
    const rep = g.members.reduce((best, p) => (dist(p.rgb, g.rgb) < dist(best.rgb, g.rgb) ? p : best), g.members[0]);
    g.rgb = rep.rgb;
    g.hex = rep.hex;
    g.glow = g.members.some((p) => p.glow && p.share > g.share * 0.3);
    for (const p of g.members) p.material = i;
  });
  return groups;
}

function fmt(v) { return (Math.round(v * 10) / 10).toString(); }

/** The art of one side, trimmed to its alpha box: raw RGBA + emissive, size, and the unit scale. */
async function loadSide(manifest, s) {
  const atlas = manifest.atlases.find((a) => a.id === s.atlas) ?? manifest.atlases[s.atlas];
  const [x, y, w0, h0] = s.px;
  const cut = (url) => sharp(join(ROOT, 'packages/client/public/creatures', url)).extract({ left: x, top: y, width: w0, height: h0 });
  const rgba = await cut(atlas.albedo.url).ensureAlpha().raw().toBuffer();
  const em = await cut(atlas.emissive.url).greyscale().raw().toBuffer();
  let x0 = w0, y0 = h0, x1 = -1, y1 = -1;
  for (let j = 0; j < h0; j++) for (let i = 0; i < w0; i++) if (rgba[(j * w0 + i) * 4 + 3] >= 128) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
  if (x1 < 0) throw new Error('empty sprite');
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const px = Buffer.alloc(w * h * 4);
  const glow = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const src = ((j + y0) * w0 + (i + x0));
    px.set(rgba.subarray(src * 4, src * 4 + 4), (j * w + i) * 4);
    glow[j * w + i] = em[src] > 127 ? 1 : 0;
  }
  // scad units: UNITS over the trimmed height, x = 0 at the centre column
  const u = UNITS / h;
  return { w, h, px, glow, u, wUnits: w * u, toX: (i) => (i + 0.5 - w / 2) * u, toZ: (j) => (h - (j + 0.5)) * u };
}

/** K-means over the opaque pixels of both sides, merged and sorted by share; each colour gets its front extent. */
function buildPalette(front, back) {
  const samples = [];
  const take = (side, step) => { for (let j = 0; j < side.h; j += step) for (let i = 0; i < side.w; i += step) { const o = (j * side.w + i) * 4; if (side.px[o + 3] >= 200) samples.push([side.px[o] / 255, side.px[o + 1] / 255, side.px[o + 2] / 255]); } };
  const step = Math.max(1, Math.round(Math.sqrt((front.w * front.h) / 60000)));
  take(front, step);
  take(back, step);
  // init: the most populated 4-bit bins
  const bins = new Map();
  for (const c of samples) { const k = c.map((v) => Math.min(15, Math.floor(v * 16))).join(','); bins.set(k, (bins.get(k) ?? 0) + 1); }
  let centres = [...bins.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k.split(',').map((v) => (+v + 0.5) / 16));
  // spread the seeds: skip a bin too close to a chosen one
  const seeds = [];
  for (const c of centres) { if (seeds.every((s) => dist(s, c) > 0.12)) seeds.push(c); if (seeds.length === K) break; }
  centres = seeds;
  for (let it = 0; it < 10; it++) {
    const acc = centres.map(() => [0, 0, 0, 0]);
    for (const c of samples) { const k = nearest(c, centres); acc[k][0] += c[0]; acc[k][1] += c[1]; acc[k][2] += c[2]; acc[k][3]++; }
    centres = acc.map((a, i) => (a[3] > 0 ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : centres[i]));
  }
  // merge near twins, count shares
  const merged = [];
  for (const c of centres) { const m = merged.find((x) => dist(x, c) < 0.05); if (!m) merged.push(c); }
  const counts = merged.map(() => 0);
  const glowCount = merged.map(() => 0);
  const ext = merged.map(() => null);
  let total = 0;
  for (const [side, isFront] of [[front, true], [back, false]]) {
    for (let j = 0; j < side.h; j++) for (let i = 0; i < side.w; i++) {
      const o = (j * side.w + i) * 4;
      if (side.px[o + 3] < 128) continue;
      const k = nearest([side.px[o] / 255, side.px[o + 1] / 255, side.px[o + 2] / 255], merged);
      counts[k]++; total++;
      if (side.glow[j * side.w + i]) glowCount[k]++;
      if (isFront) {
        const X = side.toX(i), Z = side.toZ(j);
        const e = ext[k] ?? (ext[k] = { x0: X, x1: X, z0: Z, z1: Z });
        e.x0 = Math.min(e.x0, X); e.x1 = Math.max(e.x1, X); e.z0 = Math.min(e.z0, Z); e.z1 = Math.max(e.z1, Z);
      }
    }
  }
  const darkest = Math.min(...merged.map((c) => Math.max(...c)));
  const pal = merged.map((rgb, k) => ({
    rgb, hex: hex(rgb), share: counts[k] / total, front: ext[k], glow: glowCount[k] > counts[k] * 0.5,
    outline: Math.max(...rgb) < 0.24 && Math.max(...rgb) <= darkest + 0.05,
  })).filter((p) => p.share >= MIN_SHARE).sort((a, b) => b.share - a.share);
  pal.forEach((p, i) => { p.index = i; });
  return pal;
}

function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function nearest(c, centres) { let k = 0; let bd = Infinity; for (let i = 0; i < centres.length; i++) { const d = dist(c, centres[i]); if (d < bd) { bd = d; k = i; } } return k; }
function hex(rgb) { return `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`; }

/** Connected regions per palette colour (4-connected, on a <= 256 px wide grid), biggest first; traced when asked. */
function regions(side, palette, materials, trace) {
  const ds = Math.max(1, Math.ceil(Math.max(side.w, side.h) / 256));
  const W = Math.ceil(side.w / ds);
  const H = Math.ceil(side.h / ds);
  const label = new Int16Array(W * H).fill(-1);   // material index per cell, -1 transparent, -2 outline ink
  const cols = palette.map((p) => p.rgb);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const o = ((Math.min(side.h - 1, j * ds + (ds >> 1))) * side.w + Math.min(side.w - 1, i * ds + (ds >> 1))) * 4;
    if (side.px[o + 3] < 128) continue;
    const p = palette[nearest([side.px[o] / 255, side.px[o + 1] / 255, side.px[o + 2] / 255], cols)];
    label[j * W + i] = p.outline ? -2 : p.material;
  }
  // outline ink joins the material most of its neighbours have, so a line through a part does not split it
  for (let pass = 0; pass < 3; pass++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (label[j * W + i] !== -2) continue;
    const votes = new Map();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const v = label[nj * W + ni];
      if (v >= 0) votes.set(v, (votes.get(v) ?? 0) + 1);
    }
    if (votes.size) label[j * W + i] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  for (let s = 0; s < W * H; s++) if (label[s] === -2) label[s] = -1;
  const opaque = label.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0);
  const seen = new Uint8Array(W * H);
  const out = [];
  const toX = (i) => side.toX((i + 0.5) * ds - 0.5);
  const toZ = (j) => side.toZ((j + 0.5) * ds - 0.5);
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || label[s] < 0) continue;
    const k = label[s];
    const stack = [s];
    seen[s] = 1;
    const cells = [];
    while (stack.length) {
      const c = stack.pop();
      cells.push(c);
      const ci = c % W, cj = (c - ci) / W;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = nj * W + ni;
        if (!seen[n] && label[n] === k) { seen[n] = 1; stack.push(n); }
      }
    }
    if (cells.length < opaque * MIN_REGION) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, sx = 0, sz = 0;
    const mean = [0, 0, 0];
    for (const c of cells) {
      const i = c % W, j = (c - i) / W; const X = toX(i), Z = toZ(j); x0 = Math.min(x0, X); x1 = Math.max(x1, X); z0 = Math.min(z0, Z); z1 = Math.max(z1, Z); sx += X; sz += Z;
      const o = ((Math.min(side.h - 1, j * ds + (ds >> 1))) * side.w + Math.min(side.w - 1, i * ds + (ds >> 1))) * 4;
      mean[0] += side.px[o] / 255; mean[1] += side.px[o + 1] / 255; mean[2] += side.px[o + 2] / 255;
    }
    const rgb = mean.map((v) => v / cells.length);
    const r = { k, hex: hex(rgb), rgb, share: cells.length / opaque, x0, x1, z0, z1, cx: sx / cells.length, cz: sz / cells.length };
    if (trace) r.poly = tracePoly(cells, W, H, toX, toZ, TRACE_EPS);
    out.push(r);
  }
  out.sort((a, b) => b.share - a.share);
  if (trace) {
    const all = [];
    for (let s = 0; s < W * H; s++) if (label[s] >= 0) all.push(s);
    side.outline = tracePoly(all, W, H, toX, toZ, TRACE_EPS);
  }
  return out;
}

/** Outline of a set of grid cells as a simplified polygon in scad [x, z] (Moore-neighbour tracing on a padded mask). */
function tracePoly(cells, W, H, toX, toZ, eps) {
  const PW = W + 2, PH = H + 2;
  const m = new Uint8Array(PW * PH);
  for (const c of cells) { const i = c % W, j = (c - i) / W; m[(j + 1) * PW + (i + 1)] = 1; }
  // start: the first set cell in scan order (its top-left corner); trace the boundary cells clockwise
  let start = -1;
  for (let s = 0; s < PW * PH; s++) if (m[s]) { start = s; break; }
  if (start < 0) return [];
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];   // clockwise from east (y down)
  const path = [];
  let cur = start;
  let back = 6;   // we "came from" the west side: start searching from north-west going clockwise
  const maxSteps = PW * PH * 4;
  for (let steps = 0; steps < maxSteps; steps++) {
    path.push(cur);
    const ci = cur % PW, cj = (cur - ci) / PW;
    let found = -1;
    for (let t = 0; t < 8; t++) {
      const d = (back + 1 + t) % 8;
      const ni = ci + dirs[d][0], nj = cj + dirs[d][1];
      if (ni < 0 || nj < 0 || ni >= PW || nj >= PH) continue;
      if (m[nj * PW + ni]) { found = d; break; }
    }
    if (found < 0) break;   // a single cell
    cur = (cj + dirs[found][1]) * PW + (ci + dirs[found][0]);
    back = (found + 4) % 8;
    if (cur === start && path.length > 2) break;
  }
  const pts = path.map((c) => { const i = c % PW - 1, j = (c - c % PW) / PW - 1; return [toX(i), toZ(j)]; });
  const simplified = douglasPeucker(pts, eps);
  // thin the result to at most 60 points by dropping the least significant corners
  while (simplified.length > 60) {
    let worst = 1, wd = Infinity;
    for (let i = 1; i < simplified.length - 1; i++) { const d = segDist(simplified[i], simplified[i - 1], simplified[i + 1]); if (d < wd) { wd = d; worst = i; } }
    simplified.splice(worst, 1);
  }
  return simplified;
}

function segDist(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
}
function douglasPeucker(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let idx = 0, dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], pts[0], pts[pts.length - 1]); if (d > dmax) { dmax = d; idx = i; } }
  if (dmax > eps) {
    const a = douglasPeucker(pts.slice(0, idx + 1), eps);
    const b = douglasPeucker(pts.slice(idx), eps);
    return [...a.slice(0, -1), ...b];
  }
  return [pts[0], pts[pts.length - 1]];
}

/** The sheet: front and back panels under a grid, the palette legend below. */
async function sheet(id, sides, palette, file) {
  const panels = [];
  for (const side of ['front', 'back']) {
    const s = sides[side];
    const pxPerUnit = PANEL_H / UNITS;
    const scale = (PANEL_H / s.h);
    const W = Math.round(s.w * scale);
    const art = await sharp(s.px, { raw: { width: s.w, height: s.h, channels: 4 } }).resize(W, PANEL_H, { kernel: 'nearest' }).png().toBuffer();
    const PW = W + MARGIN * 2, PH = PANEL_H + MARGIN * 2;
    const gx = (x) => MARGIN + W / 2 + x * pxPerUnit;   // screen x in both panels
    const gz = (z) => MARGIN + PANEL_H - z * pxPerUnit;
    const xMax = Math.ceil(s.wUnits / 2 / 5) * 5;
    const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}">`, `<rect width="${PW}" height="${PH}" fill="#ffffff"/>`];
    for (let z = 0; z <= UNITS; z += 2) {
      const major = z % 10 === 0;
      svg.push(`<line x1="${MARGIN - (major ? 8 : 3)}" y1="${gz(z)}" x2="${MARGIN + W}" y2="${gz(z)}" stroke="${major ? '#000' : '#999'}" stroke-opacity="${major ? 0.55 : 0.28}" stroke-width="${major ? 1.4 : 0.7}"/>`);
      if (major) svg.push(`<text x="${MARGIN - 12}" y="${gz(z) + 5}" font-size="15" font-family="sans-serif" text-anchor="end" fill="#000">z ${z}</text>`);
    }
    for (let x = -xMax; x <= xMax; x += 2) {
      const major = x % 10 === 0;
      const X = gx(x);
      if (X < MARGIN - 1 || X > MARGIN + W + 1) continue;
      svg.push(`<line x1="${X}" y1="${MARGIN}" x2="${X}" y2="${MARGIN + PANEL_H + (major ? 8 : 3)}" stroke="${x === 0 ? '#d00' : major ? '#000' : '#999'}" stroke-opacity="${x === 0 ? 0.8 : major ? 0.55 : 0.28}" stroke-width="${x === 0 ? 1.6 : major ? 1.4 : 0.7}"/>`);
      if (major) svg.push(`<text x="${X}" y="${MARGIN + PANEL_H + 24}" font-size="15" font-family="sans-serif" text-anchor="middle" fill="#000">${x > 0 ? '+' : ''}${x}</text>`);
    }
    const title = side === 'front'
      ? `${id} · FRONT · ${s.wUnits.toFixed(1)} x ${UNITS} units · sheet x (scad x = (sx - 0.5 y) / 0.866)`
      : `${id} · BACK · screen x (the creature's own +X is to the LEFT here) · height shown as ${UNITS}`;
    svg.push(`<text x="${MARGIN}" y="${MARGIN - 28}" font-size="18" font-family="sans-serif" font-weight="bold" fill="#000">${esc(title)}</text>`);
    svg.push('</svg>');
    const panel = await sharp(Buffer.from(svg.join(''))).png().toBuffer();
    // the grid under the art, then the grid lines faintly over it so edges stay measurable
    const over = svg.map((l) => (l.startsWith('<rect') ? '' : l.replace(/stroke-opacity="[0-9.]+"/g, (m) => m.replace(/"[0-9.]+"/, (v) => `"${(+v.slice(1, -1) * 0.5).toFixed(2)}"`)))).join('');
    const buf = await sharp(panel).composite([{ input: art, left: MARGIN, top: MARGIN }, { input: Buffer.from(over), left: 0, top: 0 }]).png().toBuffer();
    panels.push({ buf, w: PW, h: PH });
  }
  // palette legend
  const rowH = 30;
  const legendW = panels.reduce((a, p) => a + p.w, 0);
  const legendH = rowH * (palette.length + 1) + 20;
  const lg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${legendW}" height="${legendH}">`, `<rect width="${legendW}" height="${legendH}" fill="#ffffff"/>`,
    `<text x="20" y="22" font-size="16" font-family="sans-serif" font-weight="bold" fill="#000">Palette (material, share of pixels, scad colour, front extent)</text>`];
  palette.forEach((p, i) => {
    const y = 34 + i * rowH;
    lg.push(`<rect x="20" y="${y}" width="60" height="${rowH - 6}" fill="${p.hex}" stroke="#000" stroke-width="0.6"/>`);
    const ext = p.front ? `x ${fmt(p.front.x0)}..${fmt(p.front.x1)}  z ${fmt(p.front.z0)}..${fmt(p.front.z1)}` : 'not in front';
    const tags = [p.outline ? 'outline ink' : '', p.glow ? 'GLOWS' : ''].filter(Boolean).join(' · ');
    lg.push(`<text x="92" y="${y + 17}" font-size="15" font-family="monospace" fill="#000">${esc(`${p.material === undefined ? '  ' : 'M' + p.material}  ${p.hex}  ${(p.share * 100).toFixed(1).padStart(5)} %  [${p.rgb.map((v) => v.toFixed(2)).join(', ')}]   ${ext}   ${tags}`)}</text>`);
  });
  lg.push('</svg>');
  const legend = await sharp(Buffer.from(lg.join(''))).png().toBuffer();
  const totalH = Math.max(...panels.map((p) => p.h)) + legendH;
  let left = 0;
  const comps = panels.map((p) => { const c = { input: p.buf, left, top: 0 }; left += p.w; return c; });
  comps.push({ input: legend, left: 0, top: Math.max(...panels.map((p) => p.h)) });
  await sharp({ create: { width: legendW, height: totalH, channels: 3, background: '#ffffff' } }).composite(comps).png().toFile(file);
}

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/** A 6x nearest crop of the front art over the sheet window [x0, z0, x1, z1] (units), with its own grid. */
async function zoom(id, s, [x0, z0, x1, z1]) {
  const pxPerUnit = s.h / UNITS;
  const left = Math.max(0, Math.floor(s.w / 2 + x0 * pxPerUnit));
  const right = Math.min(s.w, Math.ceil(s.w / 2 + x1 * pxPerUnit));
  const top = Math.max(0, Math.floor(s.h - z1 * pxPerUnit));
  const bottom = Math.min(s.h, Math.ceil(s.h - z0 * pxPerUnit));
  const w = right - left, h = bottom - top;
  if (w <= 0 || h <= 0) throw new Error('zoom window is outside the art');
  const Z = 6;
  const art = await sharp(s.px, { raw: { width: s.w, height: s.h, channels: 4 } }).extract({ left, top, width: w, height: h }).resize(w * Z, h * Z, { kernel: 'nearest' }).png().toBuffer();
  const g = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w * Z}" height="${h * Z}">`];
  for (let x = Math.ceil(x0); x <= x1; x++) {
    const X = (s.w / 2 + x * pxPerUnit - left) * Z;
    g.push(`<line x1="${X}" y1="0" x2="${X}" y2="${h * Z}" stroke="#000" stroke-opacity="${x % 5 === 0 ? 0.6 : 0.25}" stroke-width="1"/>`);
    if (x % 5 === 0) g.push(`<text x="${X + 3}" y="14" font-size="13" font-family="sans-serif" fill="#000">x ${x}</text>`);
  }
  for (let z = Math.ceil(z0); z <= z1; z++) {
    const Y = (s.h - z * pxPerUnit - top) * Z;
    g.push(`<line x1="0" y1="${Y}" x2="${w * Z}" y2="${Y}" stroke="#000" stroke-opacity="${z % 5 === 0 ? 0.6 : 0.25}" stroke-width="1"/>`);
    if (z % 5 === 0) g.push(`<text x="3" y="${Y - 3}" font-size="13" font-family="sans-serif" fill="#000">z ${z}</text>`);
  }
  g.push('</svg>');
  const file = join(OUT, `${id}_zoom.png`);
  await sharp({ create: { width: w * Z, height: h * Z, channels: 3, background: '#ffffff' } }).composite([{ input: art, left: 0, top: 0 }, { input: Buffer.from(g.join('')), left: 0, top: 0 }]).png().toFile(file);
  return file;
}
