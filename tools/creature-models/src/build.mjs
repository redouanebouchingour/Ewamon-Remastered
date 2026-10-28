// Builds creature models from scad/<id>.scad:
//   1. OpenSCAD (Manifold) exports a coloured 3MF (one base material per color() call).
//   2. The 3MF becomes a GLB: Z-up -> Y-up (faces +Z, three's front), 1 m tall, feet on y = 0, centred in x / z,
//      vertex colours (COLOR_0 rgb, linear; alpha = the glow mask, see glowColours), normals smoothed across edges under CREASE_DEG within one colour,
//      then weld -> reorder -> quantize -> EXT_meshopt_compression like tools/model-pipeline.
//      Written to packages/client/public/creature-models/<id>.glb.
//   3. previews/<id>.png: the sprite, the model from the front and from the back, side by side.
//
//   node src/build.mjs <id …>      build those
//   node src/build.mjs --all       build every scad/<id>.scad
//   node src/build.mjs --no-preview <id …> | --all   skip the preview renders
//   node src/build.mjs --glow-preview …     also .cache/glow/<id>.png: the sprite's glow mask | the model's glow
//   node src/build.mjs --index     rewrite creature-models/index.json from the GLBs on disk
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { OUT_DIR, PREVIEW_DIR, REF_DIR, ROOT, SCAD_DIR, WORK_DIR, readManifest } from './paths.mjs';

const CREASE_DEG = 55;
const MAX_TRIANGLES = 40000;
const GLOW_MIN_VALUE = 0.92;
const GLOW_MIN_CHROMA = 0.4;
const GLOW_MAX_COVERAGE = 0.08;
const OPENSCAD = process.env.OPENSCAD ?? 'openscad';

const NO_PREVIEW = process.argv.includes('--no-preview');
const GLOW_PREVIEW = process.argv.includes('--glow-preview');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--') || a === '--all' || a === '--index');
mkdirSync(WORK_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PREVIEW_DIR, { recursive: true });

if (args[0] === '--index') {
  writeIndex();
} else {
  const ids = args[0] === '--all'
    ? readdirSync(SCAD_DIR).filter((f) => f.endsWith('.scad') && f !== 'lib.scad').map((f) => f.slice(0, -5))
    : args;
  if (ids.length === 0) throw new Error('usage: build.mjs <id …> | --all | --index');
  let failed = 0;
  for (const id of ids) {
    try {
      await build(id);
    } catch (e) {
      failed++;
      console.error(`FAIL ${id}: ${e.message}`);
    }
  }
  writeIndex();
  if (failed > 0) process.exit(1);
}

async function build(id) {
  const scad = join(SCAD_DIR, `${id}.scad`);
  if (!existsSync(scad)) throw new Error(`no ${scad}`);
  const threeMf = join(WORK_DIR, `${id}.3mf`);
  runScad(['-o', threeMf, scad]);
  const mesh = read3mf(threeMf);
  if (mesh.tris.length / 3 > MAX_TRIANGLES) throw new Error(`${mesh.tris.length / 3} triangles (max ${MAX_TRIANGLES}): lower $fn`);
  if (mesh.colorOf.some((c) => c.default)) console.warn(`warn ${id}: some geometry has no color()`);
  const { bytes, glowShare, glowOn } = await toGlb(mesh);
  if (GLOW_PREVIEW) await glowPreview(id, mesh, glowOn);
  writeFileSync(join(OUT_DIR, `${id}.glb`), bytes);
  if (!NO_PREVIEW) await preview(id, scad);
  console.log(`ok ${id}: ${mesh.tris.length / 3} triangles, ${(bytes.length / 1024).toFixed(0)} KiB, glow ${(glowShare * 100).toFixed(1)} % -> previews/${id}.png`);
}

function runScad(extra) {
  try {
    execFileSync(OPENSCAD, ['--backend=Manifold', ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const log = `${e.stdout ?? ''}${e.stderr ?? ''}`.split('\n').filter((l) => /ERROR|WARNING|error/i.test(l)).slice(0, 6).join('\n');
    throw new Error(`openscad failed\n${log}`);
  }
}

/** Positions (flat xyz), triangle indices, and per-triangle colour index into colorOf. Item transforms applied. */
function read3mf(file) {
  const xml = execFileSync('unzip', ['-p', file, '3D/3dmodel.model'], { maxBuffer: 1 << 30 }).toString();
  const materials = new Map(); // pid -> [{ rgb, default }]
  for (const m of xml.matchAll(/<basematerials id="(\d+)">([\s\S]*?)<\/basematerials>/g)) {
    materials.set(m[1], [...m[2].matchAll(/<base name="([^"]*)" displaycolor="#([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?/g)]
      .map((b) => ({ rgb: hex(b[2]), glow: glowMark(b[3]), default: b[1] === 'Default' })));
  }
  for (const m of xml.matchAll(/<m:colorgroup id="(\d+)">([\s\S]*?)<\/m:colorgroup>/g)) {
    materials.set(m[1], [...m[2].matchAll(/color="#([0-9A-Fa-f]{6})/g)].map((b) => ({ rgb: hex(b[1]), glow: 'auto', default: false })));
  }
  const objects = new Map();
  for (const o of xml.matchAll(/<object id="(\d+)"([^>]*)>([\s\S]*?)<\/object>/g)) {
    const objPid = /pid="(\d+)"/.exec(o[2])?.[1];
    const objP = /pindex="(\d+)"/.exec(o[2])?.[1] ?? '0';
    const v = [...o[3].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].map((m) => [+m[1], +m[2], +m[3]]);
    const t = [...o[3].matchAll(/<triangle ([^>]*)\/>/g)].map((m) => {
      const a = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]+)"/g)].map((x) => [x[1], x[2]]));
      return [+a.v1, +a.v2, +a.v3, a.pid ?? objPid, a.p1 ?? objP];
    });
    objects.set(o[1], { v, t });
  }
  const items = [...xml.matchAll(/<item objectid="(\d+)"([^>]*)\/>/g)].map((m) => ({
    id: m[1],
    tf: /transform="([^"]+)"/.exec(m[2])?.[1].split(/\s+/).map(Number),
  }));
  const pos = [];
  const tris = [];
  const triColor = [];
  const colorOf = [];
  const colorKey = new Map();
  for (const item of items.length > 0 ? items : [...objects.keys()].map((id) => ({ id }))) {
    const obj = objects.get(item.id);
    if (!obj) continue;
    const base = pos.length / 3;
    for (const [x, y, z] of obj.v) {
      const f = item.tf;
      if (f) pos.push(x * f[0] + y * f[3] + z * f[6] + f[9], x * f[1] + y * f[4] + z * f[7] + f[10], x * f[2] + y * f[5] + z * f[8] + f[11]);
      else pos.push(x, y, z);
    }
    for (const [a, b, c, pid, p] of obj.t) {
      const mat = materials.get(pid)?.[+p] ?? { rgb: [0.98, 0.84, 0.17], default: true };
      const key = `${mat.rgb.join(',')}|${mat.glow}`;
      if (!colorKey.has(key)) { colorKey.set(key, colorOf.length); colorOf.push(mat); }
      tris.push(base + a, base + b, base + c);
      triColor.push(colorKey.get(key));
    }
  }
  if (tris.length === 0) throw new Error('empty model');
  return { pos, tris, triColor, colorOf };
}

/** lib.scad's colour alpha markers: GLOW (0.98 -> F9) always glows, NOGLOW (0.96 -> F4) never; opaque = the auto rule. */
function glowMark(aa) {
  const a = aa === undefined ? 255 : parseInt(aa, 16);
  if (a >= 0xfd) return 'auto';
  return a >= 0xf7 ? 'on' : 'off';
}

/**
 * Which colours glow (the vertex colour's alpha, read as the emissive mask in game). The sprite pipeline's rule
 * (`tools/sprite-pipeline/src/emissive.ts`) per colour instead of per texel: bright (HSV value >= 0.92) and vivid
 * (chroma >= 0.4), the most vivid first, until GLOW_MAX_COVERAGE of the surface glows; a colour that would push past
 * the cap is skipped. Marked colours (`glowMark`) are taken as they are and count against the cap.
 */
function glowColours(colorOf, area) {
  const total = area.reduce((a, b) => a + b, 0) || 1;
  const on = colorOf.map((c) => c.glow === 'on');
  let used = colorOf.reduce((a, c, i) => a + (on[i] ? area[i] : 0), 0) / total;
  const cand = colorOf.map((c, i) => {
    const mx = Math.max(...c.rgb);
    const chroma = mx - Math.min(...c.rgb);
    return { i, s: mx * chroma, ok: c.glow === 'auto' && mx >= GLOW_MIN_VALUE && chroma >= GLOW_MIN_CHROMA };
  }).filter((c) => c.ok).sort((a, b) => b.s - a.s);
  for (const c of cand) {
    const share = area[c.i] / total;
    if (used + share > GLOW_MAX_COVERAGE) continue;
    on[c.i] = true;
    used += share;
  }
  return { on, share: used };
}

function hex(h) {
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

async function toGlb({ pos, tris, triColor, colorOf }) {
  // Z-up -> Y-up: (x, y, z) -> (x, z, -y); the -Y-facing model then faces +Z.
  const n = pos.length / 3;
  const P = new Float64Array(pos.length);
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const v = [pos[i * 3], pos[i * 3 + 2], -pos[i * 3 + 1]];
    for (let k = 0; k < 3; k++) { P[i * 3 + k] = v[k]; min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
  }
  const s = 1 / (max[1] - min[1]);
  const off = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) P[i * 3 + k] = (P[i * 3 + k] - off[k]) * s;

  // Face normals (area-weighted) and, per position, the faces around it.
  const tCount = tris.length / 3;
  const fN = new Float64Array(tris.length);
  const keyOf = (i) => `${Math.round(P[i * 3] * 1e5)},${Math.round(P[i * 3 + 1] * 1e5)},${Math.round(P[i * 3 + 2] * 1e5)}`;
  const around = new Map();
  for (let t = 0; t < tCount; t++) {
    const [a, b, c] = [tris[t * 3], tris[t * 3 + 1], tris[t * 3 + 2]];
    const e1 = [0, 1, 2].map((k) => P[b * 3 + k] - P[a * 3 + k]);
    const e2 = [0, 1, 2].map((k) => P[c * 3 + k] - P[a * 3 + k]);
    fN[t * 3] = e1[1] * e2[2] - e1[2] * e2[1];
    fN[t * 3 + 1] = e1[2] * e2[0] - e1[0] * e2[2];
    fN[t * 3 + 2] = e1[0] * e2[1] - e1[1] * e2[0];
    for (const v of [a, b, c]) {
      const k = `${keyOf(v)}|${triColor[t]}`;
      if (!around.has(k)) around.set(k, []);
      around.get(k).push(t);
    }
  }
  const area = colorOf.map(() => 0);
  for (let t = 0; t < tCount; t++) area[triColor[t]] += Math.hypot(fN[t * 3], fN[t * 3 + 1], fN[t * 3 + 2]) / 2;
  const glow = glowColours(colorOf, area);
  if (process.env.COLORS === '1') {
    const total = area.reduce((x, y) => x + y, 0);
    const hx = (rgb) => `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
    for (const i of area.map((_, i) => i).sort((x, y) => area[y] - area[x])) {
      console.log(`  ${hx(colorOf[i].rgb)} ${((100 * area[i]) / total).toFixed(1).padStart(5)} % ${colorOf[i].glow}${glow.on[i] ? ' GLOWS' : ''}`);
    }
  }
  const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const cos = Math.cos((CREASE_DEG * Math.PI) / 180);
  const outP = new Float32Array(tris.length * 3);
  const outN = new Float32Array(tris.length * 3);
  const outC = new Float32Array(tris.length * 4);
  const linear = colorOf.map((c) => c.rgb.map(srgbToLinear));
  for (let t = 0; t < tCount; t++) {
    const me = unit(fN[t * 3], fN[t * 3 + 1], fN[t * 3 + 2]);
    for (let j = 0; j < 3; j++) {
      const v = tris[t * 3 + j];
      let acc = [0, 0, 0];
      for (const u of around.get(`${keyOf(v)}|${triColor[t]}`)) {
        const o = unit(fN[u * 3], fN[u * 3 + 1], fN[u * 3 + 2]);
        if (o[0] * me[0] + o[1] * me[1] + o[2] * me[2] >= cos) acc = [acc[0] + fN[u * 3], acc[1] + fN[u * 3 + 1], acc[2] + fN[u * 3 + 2]];
      }
      const nn = unit(...acc);
      const o = (t * 3 + j) * 3;
      for (let k = 0; k < 3; k++) {
        outP[o + k] = P[v * 3 + k];
        outN[o + k] = nn[k];
        outC[(t * 3 + j) * 4 + k] = linear[triColor[t]][k];
      }
      outC[(t * 3 + j) * 4 + 3] = glow.on[triColor[t]] ? 1 : 0;
    }
  }

  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(outP).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(outN).setBuffer(buffer))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(outC).setBuffer(buffer))
    .setMaterial(doc.createMaterial('creature').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.75).setMetallicFactor(0));
  const mesh = doc.createMesh('creature').addPrimitive(prim);
  doc.createScene().addChild(doc.createNode('creature').setMesh(mesh));

  await MeshoptEncoder.ready;
  await doc.transform(
    weld(),
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8 }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  return { bytes: Buffer.from(await io.writeBinary(doc)), glowShare: glow.share, glowOn: glow.on };
}

async function preview(id, scad) {
  const shots = [];
  // Gimbal camera: rot x 75 tilts down onto the model; rot z picks the side (sprite fronts face the viewer's left).
  for (const [name, rz] of [['front', 30], ['back', -150]]) {
    const png = join(WORK_DIR, `${id}_${name}.png`);
    runScad(['-o', png, '--render', '--imgsize=1024,1024', '--viewall', '--autocenter', '--projection=p',
      '--colorscheme=Tomorrow', `--camera=0,0,0,80,0,${rz},0`, scad]);
    shots.push(await sharp(png).resize(512, 512).flatten({ background: '#ffffff' }).png().toBuffer());
  }
  const ref = join(REF_DIR, `${id}_front.png`);
  const tiles = existsSync(ref) ? [await sharp(ref).resize(512, 512).png().toBuffer(), ...shots] : shots;
  await sharp({ create: { width: 512 * tiles.length, height: 512, channels: 3, background: '#ffffff' } })
    .composite(tiles.map((input, i) => ({ input, left: i * 512, top: 0 })))
    .png()
    .toFile(join(PREVIEW_DIR, `${id}.png`));
}

/**
 * Review image for the glow mask: the sprite with its emissive mask lit (everything else dimmed) beside a software
 * render of the model from the front three-quarter view, glowing colours at full brightness, the rest dimmed.
 */
async function glowPreview(id, { pos, tris, triColor, colorOf }, on) {
  const S = 384;
  const yaw = (30 * Math.PI) / 180;
  const pitch = (12 * Math.PI) / 180;
  const n = pos.length / 3;
  const V = new Float64Array(n * 3);
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    // scad Z-up, facing -Y; the camera looks from -Y turned by yaw, tilted down by pitch
    const x0 = pos[i * 3], y0 = pos[i * 3 + 1], z0 = pos[i * 3 + 2];
    const x1 = x0 * Math.cos(yaw) - y0 * Math.sin(yaw);
    const y1 = x0 * Math.sin(yaw) + y0 * Math.cos(yaw);
    const sy = z0 * Math.cos(pitch) - y1 * Math.sin(pitch);
    const depth = y1 * Math.cos(pitch) + z0 * Math.sin(pitch);
    V[i * 3] = x1; V[i * 3 + 1] = sy; V[i * 3 + 2] = depth;
    lo = [Math.min(lo[0], x1), Math.min(lo[1], sy)]; hi = [Math.max(hi[0], x1), Math.max(hi[1], sy)];
  }
  const k = (S * 0.9) / Math.max(hi[0] - lo[0], hi[1] - lo[1]);
  const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
  const px = (i) => S / 2 + (V[i * 3] - cx) * k;
  const py = (i) => S / 2 - (V[i * 3 + 1] - cy) * k;
  const zb = new Float64Array(S * S).fill(Infinity);
  const img = Buffer.alloc(S * S * 3, 255);
  for (let t = 0; t < tris.length / 3; t++) {
    const [a, b, c] = [tris[t * 3], tris[t * 3 + 1], tris[t * 3 + 2]];
    const ax = px(a), ay = py(a), bx = px(b), by = py(b), qx = px(c), qy = py(c);
    const area = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
    if (Math.abs(area) < 1e-9) continue;
    // shade: the face normal against a light from the camera's upper left
    const e1 = [0, 1, 2].map((j) => V[b * 3 + j] - V[a * 3 + j]);
    const e2 = [0, 1, 2].map((j) => V[c * 3 + j] - V[a * 3 + j]);
    const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...nn) || 1;
    const lam = Math.abs((nn[0] * -0.4 + nn[1] * 0.6 + nn[2] * -0.7) / l / 1.0198);
    const glowing = on[triColor[t]];
    const rgb = colorOf[triColor[t]].rgb.map((v) => (glowing ? Math.min(1, v * 1.15 + 0.1) : v * (0.12 + 0.18 * lam)));
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, qx))), x1 = Math.min(S - 1, Math.ceil(Math.max(ax, bx, qx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, qy))), y1 = Math.min(S - 1, Math.ceil(Math.max(ay, by, qy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const w0 = ((bx - x) * (qy - y) - (by - y) * (qx - x)) / area;
      const w1 = ((qx - x) * (ay - y) - (qy - y) * (ax - x)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * V[a * 3 + 2] + w1 * V[b * 3 + 2] + w2 * V[c * 3 + 2];
      const o = y * S + x;
      if (z >= zb[o]) continue;
      zb[o] = z;
      for (let j = 0; j < 3; j++) img[o * 3 + j] = Math.round(rgb[j] * 255);
    }
  }
  const model = await sharp(img, { raw: { width: S, height: S, channels: 3 } }).png().toBuffer();
  const tiles = [model];
  const m = readManifest();
  const f = m.sprites[id]?.front;
  if (f) {
    const atlas = m.atlases.find((a) => a.id === f.atlas);
    const [x, y, w, h] = f.px;
    const cut = (url) => sharp(join(ROOT, 'packages/client/public/creatures', url)).extract({ left: x, top: y, width: w, height: h }).resize(S, S);
    const al = await cut(atlas.albedo.url).ensureAlpha().raw().toBuffer();
    const em = await cut(atlas.emissive.url).greyscale().raw().toBuffer();
    const out = Buffer.alloc(S * S * 3, 255);
    for (let i = 0; i < S * S; i++) {
      if (al[i * 4 + 3] < 128) continue;
      const g = em[i] > 127;
      for (let j = 0; j < 3; j++) out[i * 3 + j] = g ? Math.min(255, al[i * 4 + j] * 1.15 + 25) : Math.round(al[i * 4 + j] * 0.25);
    }
    tiles.unshift(await sharp(out, { raw: { width: S, height: S, channels: 3 } }).png().toBuffer());
  }
  mkdirSync(join(WORK_DIR, '../glow'), { recursive: true });
  await sharp({ create: { width: S * tiles.length, height: S, channels: 3, background: '#fff' } })
    .composite(tiles.map((input, i) => ({ input, left: i * S, top: 0 })))
    .png()
    .toFile(join(WORK_DIR, '../glow', `${id}.png`));
}

function writeIndex() {
  const models = Object.fromEntries(readdirSync(OUT_DIR).filter((f) => f.endsWith('.glb')).sort()
    .map((f) => [f.slice(0, -4), { url: f, bytes: statSync(join(OUT_DIR, f)).size }]));
  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify({ version: 1, heightMeters: 1, facing: '+z', models }, null, 2)}\n`);
}
