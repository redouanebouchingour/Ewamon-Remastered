// How well a built model's silhouette matches its sprite, from the front and the back preview angles (the camera
// build.mjs uses for previews/<id>.png): the model's GLB is projected in software and compared with the art's alpha
// mask, both trimmed and scaled to the same height, centred on their boxes.
//
//   node src/compare.mjs <id …> [--ground <z>]   prints "front IoU 0.71 (missing 18 %, extra 11 %, width x1.05) back …"
//                                    per id and writes .cache/compare/<id>.png: sprite-only red, model-only blue, both
//                                    grey, plus a table of the cells (5 sheet units) where the art has mass the model
//                                    lacks ("-") or the model has mass the art lacks ("+"). --ground <z> cuts the art
//                                    off below sheet z (a rock or puddle the model does without; measure.mjs units).
//
// It is a guide, not a gate: the sprite is a drawn three-quarter view, the model an orthographic render, so 0.8 is
// excellent and 0.65 means a part is the wrong size or in the wrong place (look at the overlay to see which).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { PKG, ROOT, readManifest, staticGlb } from './paths.mjs';

const OUT = join(PKG, '.cache/compare');
const S = 400;            // mask height in px
const PITCH = 10;         // the preview camera looks 10° down (OpenSCAD rot x 80)
const YAW = { front: -30, back: 150 };   // the preview's rot z 30 / -150: the face to the viewer's left, the back turned right

const argv = process.argv.slice(2);
const GROUND = argv.includes('--ground') ? Number(argv[argv.indexOf('--ground') + 1]) : 0;
const ids = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--ground');
if (process.argv[1].endsWith('compare.mjs')) {
  if (ids.length === 0) throw new Error('usage: compare.mjs <id …>');
  mkdirSync(OUT, { recursive: true });
  const manifest = readManifest();
  for (const id of ids) {
    const r = await compare(id, manifest, GROUND);
    const f = (x) => `IoU ${x.iou.toFixed(2)} (missing ${(x.missing * 100).toFixed(0)} %, extra ${(x.extra * 100).toFixed(0)} %, width x${x.widthRatio.toFixed(2)})`;
    console.log(`${id}: front ${f(r.front)}  back ${f(r.back)}  -> ${r.png}`);
    for (const side of ['front', 'back']) {
      const cells = r[side].cells.filter((c) => c.missing > 0.012 || c.extra > 0.012).sort((a, b) => (b.missing + b.extra) - (a.missing + a.extra)).slice(0, 10);
      if (cells.length) console.log(`  ${side} worst cells (sheet x, z; share of the art's area): ${cells.map((c) => `[${c.x}..${c.x + 5}, ${c.z}..${c.z + 5}] ${c.missing > c.extra ? '-' : '+'}${((c.missing > c.extra ? c.missing : c.extra) * 100).toFixed(1)} %`).join('  ')}`);
    }
  }
}

export async function compare(id, manifest = readManifest(), ground = 0) {
  const entry = manifest.sprites[id];
  if (!entry) throw new Error(`unknown creature ${id}`);
  const mesh = await readGlb(staticGlb(id));
  const out = { png: join(OUT, `${id}.png`) };
  const tiles = [];
  for (const side of ['front', 'back']) {
    const art = await artMask(manifest, entry[side], ground);
    const model = projectMask(mesh, YAW[side]);
    const a = fit(art), m = fit(model);
    let inter = 0, union = 0, onlyA = 0, onlyM = 0, areaA = 0;
    const W = Math.max(a.w, m.w);
    const rgb = Buffer.alloc(W * S * 3, 255);
    const ax = Math.round((W - a.w) / 2), mx = Math.round((W - m.w) / 2);
    // 5-unit cells in sheet coordinates (the art's box is 40 units tall, centred at x = 0)
    const unit = S / 40;
    const cellMap = new Map();
    const cell = (x, y, key) => {
      const cx = Math.floor((x - W / 2) / unit / 5) * 5, cz = Math.floor((S - 1 - y) / unit / 5) * 5;
      const k = `${cx},${cz}`;
      const c = cellMap.get(k) ?? (cellMap.set(k, { x: cx, z: cz, missing: 0, extra: 0 }), cellMap.get(k));
      c[key]++;
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < W; x++) {
      const ia = x - ax, im = x - mx;
      const A = ia >= 0 && ia < a.w ? a.m[y * a.w + ia] : 0;
      const M = im >= 0 && im < m.w ? m.m[y * m.w + im] : 0;
      if (A) areaA++;
      if (A && M) { inter++; union++; rgb.fill(96, (y * W + x) * 3, (y * W + x) * 3 + 3); }
      else if (A) { union++; onlyA++; rgb.set([230, 60, 60], (y * W + x) * 3); cell(x, y, 'missing'); }
      else if (M) { union++; onlyM++; rgb.set([60, 90, 230], (y * W + x) * 3); cell(x, y, 'extra'); }
    }
    const cells = [...cellMap.values()].map((c) => ({ ...c, missing: c.missing / (areaA || 1), extra: c.extra / (areaA || 1) }));
    out[side] = { iou: inter / (union || 1), missing: onlyA / (areaA || 1), extra: onlyM / (areaA || 1), widthRatio: m.w / a.w, cells };
    tiles.push(await sharp(rgb, { raw: { width: W, height: S, channels: 3 } }).extend({ top: 24, bottom: 8, left: 8, right: 8, background: '#fff' }).png().toBuffer());
  }
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const width = metas.reduce((s, x) => s + x.width, 0);
  const height = Math.max(...metas.map((x) => x.height));
  let left = 0;
  const comps = tiles.map((t, i) => { const c = { input: t, left, top: 0 }; left += metas[i].width; return c; });
  const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="10" y="17" font-size="14" font-family="sans-serif" fill="#000">${id} · red = sprite only, blue = model only, grey = both · front IoU ${out.front.iou.toFixed(2)} · back IoU ${out.back.iou.toFixed(2)}</text></svg>`;
  comps.push({ input: Buffer.from(label), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: '#fff' } }).composite(comps).png().toFile(out.png);
  return out;
}

/** The model's positions (GLB frame: Y up, faces +Z) and triangle indices. */
async function readGlb(file) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(file);
  const node = doc.getRoot().listNodes().find((x) => x.getMesh() !== null);
  if (!node) throw new Error('no mesh');
  const prim = node.getMesh().listPrimitives()[0];
  const m = node.getWorldMatrix();
  const P = prim.getAttribute('POSITION');
  const n = P.getCount();
  const pos = new Float64Array(n * 3);
  const v = [];
  for (let i = 0; i < n; i++) {
    P.getElement(i, v);
    pos[i * 3] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
    pos[i * 3 + 1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
    pos[i * 3 + 2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
  }
  return { pos, idx: prim.getIndices().getArray() };
}

/** Orthographic silhouette of the mesh turned `yaw` degrees about Y, seen from +Z, PITCH degrees above level. */
function projectMask(mesh, yaw) {
  const n = mesh.pos.length / 3;
  const a = (yaw * Math.PI) / 180;
  const p = (PITCH * Math.PI) / 180;
  const sx = new Float64Array(n), sy = new Float64Array(n);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = mesh.pos[i * 3], y = mesh.pos[i * 3 + 1], z = mesh.pos[i * 3 + 2];
    const xr = x * Math.cos(a) + z * Math.sin(a);
    const zr = -x * Math.sin(a) + z * Math.cos(a);
    sx[i] = xr;
    sy[i] = y * Math.cos(p) - zr * Math.sin(p);
    x0 = Math.min(x0, xr); x1 = Math.max(x1, xr); y0 = Math.min(y0, sy[i]); y1 = Math.max(y1, sy[i]);
  }
  const k = (S - 1) / (y1 - y0);
  const W = Math.max(1, Math.ceil((x1 - x0) * k) + 1);
  const m = new Uint8Array(W * S);
  const px = (i) => (sx[i] - x0) * k;
  const py = (i) => (y1 - sy[i]) * k;
  for (let t = 0; t < mesh.idx.length; t += 3) {
    const [i, j, l] = [mesh.idx[t], mesh.idx[t + 1], mesh.idx[t + 2]];
    const ax = px(i), ay = py(i), bx = px(j), by = py(j), cx = px(l), cy = py(l);
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue;
    const xa = Math.max(0, Math.floor(Math.min(ax, bx, cx))), xb = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const ya = Math.max(0, Math.floor(Math.min(ay, by, cy))), yb = Math.min(S - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const w0 = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / area;
      const w1 = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= -1e-3 && w1 >= -1e-3 && w2 >= -1e-3) m[y * W + x] = 1;
    }
  }
  return { m, w: W, h: S };
}

/** The art's alpha mask; with `ground` > 0 everything below that sheet z (40 units over the art's box) is cleared. */
async function artMask(manifest, s, ground = 0) {
  const atlas = manifest.atlases.find((a) => a.id === s.atlas) ?? manifest.atlases[s.atlas];
  const [x, y, w, h] = s.px;
  const al = await sharp(join(ROOT, 'packages/client/public/creatures', atlas.albedo.url)).extract({ left: x, top: y, width: w, height: h }).ensureAlpha().raw().toBuffer();
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = al[i * 4 + 3] >= 128 ? 1 : 0;
  if (ground > 0) {
    let y0 = h, y1 = -1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (m[j * w + i]) { y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
    const cut = y1 - (ground / 40) * (y1 - y0 + 1);
    for (let j = Math.max(0, Math.ceil(cut)); j < h; j++) for (let i = 0; i < w; i++) m[j * w + i] = 0;
  }
  return { m, w, h };
}

/** Trims a mask to its box and scales it to S px tall (nearest). */
function fit(mask) {
  let x0 = mask.w, y0 = mask.h, x1 = -1, y1 = -1;
  for (let j = 0; j < mask.h; j++) for (let i = 0; i < mask.w; i++) if (mask.m[j * mask.w + i]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const k = S / h;
  const W = Math.max(1, Math.round(w * k));
  const m = new Uint8Array(W * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(x1, x0 + Math.floor(x / k)), sy = Math.min(y1, y0 + Math.floor(y / k));
    m[y * W + x] = mask.m[sy * mask.w + sx];
  }
  return { m, w: W, h: S };
}
