/**
 * One-off import tool: keys flat-chroma battle-form art (Majin / Tenjin forms, `.design/majin-tenjin.md`) to real
 * alpha before it joins `assets-src/creatures/`, the way hollowmane / dustcub / castlemaw were keyed by hand (README
 * "The species set"). Stage 1's own keying is not used on these: its magenta rule would reach into pink and purple
 * art, and it keeps the anti-aliased chroma rim.
 *
 *   pnpm exec tsx tools/sprite-pipeline/scripts/key-forms.ts [--src DIR] [--out DIR] [--only a,b] [--sheet DIR]
 *
 * `--src` holds `front/<key>(front).png` and `back/<key>(back).png` (default `assets-src/forms-pending`), 1024²
 * opaque RGB on flat magenta (#FF00FF) or green (#00FF00); `--out` receives the keyed PNGs under the same names
 * (default `assets-src/creatures`); `--sheet` also writes one review sheet per key (front + back on a dark and a light
 * ground, plus a 3× crop of the busiest rim) and an `index.png` of every key.
 *
 * Per image:
 *  1. Background = the per-channel median of the 4 px border ring. Magenta or green is told from it.
 *  2. Key strength k per pixel = the chroma excess over the other channels, over the background's own excess:
 *     magenta min(R, B) − G, green G − max(R, B); clamped to [0, 1]. Foreground art reads k ≤ 0 (gold, teal, white,
 *     black), pink on green and purple on magenta read low; a 50 % blend into the background reads 0.5.
 *  3. Background = a flood across k ≥ FLOOD_K (0.5), seeded from the border and from every near-pure chroma pixel
 *     (k ≥ CORE_K 0.7), so enclosed gaps between feathers, legs and fins clear too.
 *  4. Foreground islands under MIN_ISLAND px (8-connected) are dropped; every larger one stays (motes, sparks and
 *     embers are part of the art).
 *  5. Pixels to defringe: the rim (within RIM_BAND px of the background) plus every pixel joined to it through
 *     chroma-tinted pixels (k ≥ artK, 4-connected: soft glows). Each is un-mixed from the background (step 7 below):
 *     as a blend of its nearest clean colour F (k < artK, CLEAN_DEPTH px inside, within CLEAN_RADIUS px) when that
 *     explains it, otherwise by its chroma excess, F's colour at its own luminance where F is in reach; the chroma
 *     spill is clamped against F. A pixel whose alpha comes out under 0.5 joins the background.
 *  6. Binary alpha (every atlas map is binary, README "Binary alpha"); transparent pixels store RGB 0.
 * Orientation is left as delivered (fronts face left, backs face right, checked against the base species).
 */
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const FLOOD_K = 0.5;
export const CORE_K = 0.7;
export const MIN_ISLAND = 6;
export const RIM_BAND = 4;
export const CLEAN_RADIUS = 8;
export const CLEAN_DEPTH = 2;
/** How far the un-mixed colour may stray from F, and how well the neutral-blend model must fit. */
export const BLEND_RESIDUAL = 24;
export const PURE_K = 0.02;
export const SPILL_SLACK = 16;

/** Per-image tuning. */
export interface KeyOptions {
  /** Pixels with k below this are art colours: the clean colours F, and the spill flood stops at them. */
  artK: number;
  /** Also start the spill flood from any pixel with k ≥ this (glow-tinted gaps the flood cannot reach); 1 = off. */
  spillSeedK: number;
  /** Largest distance between a pixel and the bg→F blend line that still counts as that blend. */
  blendFit: number;
}
export const DEFAULT_KEY_OPTIONS: KeyOptions = { artK: 0.1, spillSeedK: 1, blendFit: 40 };
/**
 * toxshade_majin has purple-pink spikes and crystals on magenta (k up to ~0.45): they are art, not spill, so only the
 * blend model may touch them, with a tighter fit (its purple sits 42 from a grey→magenta blend). lawlander_tenjin's
 * glowing lasso loops enclose narrow pink valleys (k 0.2–0.27, the magenta seen through the glow) that no flood from
 * the background reaches.
 */
export const KEY_OVERRIDES: Readonly<Record<string, Partial<KeyOptions>>> = {
  toxshade_majin: { artK: 0.5, blendFit: 24 },
  lawlander_tenjin: { spillSeedK: 0.2 },
};
const BORDER = 4;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

interface Keyed {
  width: number;
  height: number;
  rgba: Buffer;
  stats: { chroma: 'magenta' | 'green'; bg: [number, number, number]; opaque: number; islands: number; dropped: number; defringed: number; cut: number };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[s.length >> 1]!;
}

export function keyChroma(rgb: Buffer, width: number, height: number, opts: KeyOptions = DEFAULT_KEY_OPTIONS): Keyed {
  const n = width * height;
  const ring: [number[], number[], number[]] = [[], [], []];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= BORDER && y >= BORDER && x < width - BORDER && y < height - BORDER) continue;
      const i = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) ring[c]!.push(rgb[i + c]!);
    }
  }
  const bg: [number, number, number] = [median(ring[0]), median(ring[1]), median(ring[2])];
  const chroma = bg[1] > bg[0] && bg[1] > bg[2] ? 'green' : 'magenta';
  const excess = (r: number, g: number, b: number): number => (chroma === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g);
  const bgExcess = excess(bg[0], bg[1], bg[2]);
  if (bgExcess < 120) throw new Error(`background ${bg.join(',')} is not a flat magenta or green`);

  const k = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 3;
    k[p] = Math.min(1, Math.max(0, excess(rgb[i]!, rgb[i + 1]!, rgb[i + 2]!) / bgExcess));
  }

  // 3. background flood
  const isBg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let p = 0; p < n; p++) {
    const x = p % width;
    const y = (p / width) | 0;
    const onBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if ((onBorder && k[p]! >= FLOOD_K) || k[p]! >= CORE_K) {
      isBg[p] = 1;
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++]!;
    const x = p % width;
    const y = (p / width) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const q = ny * width + nx;
      if (isBg[q] || k[q]! < FLOOD_K) continue;
      isBg[q] = 1;
      queue[tail++] = q;
    }
  }

  // 4. drop specks
  const label = new Int32Array(n).fill(-1);
  let islands = 0;
  let dropped = 0;
  for (let s = 0; s < n; s++) {
    if (isBg[s] || label[s]! >= 0) continue;
    head = 0;
    tail = 0;
    queue[tail++] = s;
    label[s] = s;
    while (head < tail) {
      const p = queue[head++]!;
      const x = p % width;
      const y = (p / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (isBg[q] || label[q]! >= 0) continue;
          label[q] = s;
          queue[tail++] = q;
        }
      }
    }
    if (tail < MIN_ISLAND) {
      for (let j = 0; j < tail; j++) isBg[queue[j]!] = 1;
      dropped++;
    } else islands++;
  }

  // 5. the pixels to defringe: the rim (within RIM_BAND px of the background, 8-connected steps) and every pixel joined
  // to the background through chroma-tinted pixels (k ≥ artK: soft glows blended into the chroma), or to a pixel with
  // k ≥ spillSeedK
  const fix = new Uint8Array(n);
  const dist = new Uint8Array(n).fill(255);
  head = 0;
  tail = 0;
  for (let p = 0; p < n; p++) {
    if (isBg[p]) {
      dist[p] = 0;
      queue[tail++] = p;
    } else if (k[p]! >= opts.spillSeedK) {
      fix[p] = 1;
      dist[p] = RIM_BAND + 1;
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++]!;
    const x = p % width;
    const y = (p / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (isBg[q] || fix[q]) continue;
        const d = Math.min(255, dist[p]! + 1);
        if (d > RIM_BAND && k[q]! < opts.artK) continue;
        if (d > RIM_BAND && dx !== 0 && dy !== 0) continue; // the spill flood is 4-connected
        fix[q] = 1;
        dist[q] = d;
        queue[tail++] = q;
      }
    }
  }

  // 6. nearest clean colour within CLEAN_RADIUS steps of each pixel to fix: first from the pixels with k < artK at least
  // CLEAN_DEPTH steps from any pixel to fix; where none is in reach (thin strands, wisps and loops lie wholly in the rim band), from the pixels to fix
  // that carry no chroma at all (k < PURE_K)
  // A clean colour also lies CLEAN_DEPTH steps inside the pixels to fix: on gold and orange the chroma blend keeps
  // k ≈ 0 (their own excess is far below zero), so the pixels just past the spill flood can still be tinted.
  const depth = new Uint8Array(n).fill(255);
  head = 0;
  tail = 0;
  for (let p = 0; p < n; p++) {
    if (isBg[p] || fix[p]) {
      depth[p] = 0;
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++]!;
    if (depth[p]! >= CLEAN_DEPTH) continue;
    const x = p % width;
    const y = (p / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (depth[q]! <= depth[p]! + 1) continue;
        depth[q] = depth[p]! + 1;
        queue[tail++] = q;
      }
    }
  }
  const src = new Int32Array(n).fill(-1);
  const steps = new Uint8Array(n);
  for (const pass of [0, 1]) {
    head = 0;
    tail = 0;
    for (let p = 0; p < n; p++) {
      if (isBg[p] || src[p]! >= 0) continue;
      if (pass === 0 ? depth[p]! >= CLEAN_DEPTH && k[p]! < opts.artK : fix[p] && k[p]! < PURE_K) {
        src[p] = p;
        steps[p] = 0;
        queue[tail++] = p;
      }
    }
    while (head < tail) {
      const p = queue[head++]!;
      if (steps[p]! >= CLEAN_RADIUS) continue;
      const x = p % width;
      const y = (p / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (src[q]! >= 0 || isBg[q]) continue;
          src[q] = src[p]!;
          steps[q] = steps[p]! + 1;
          queue[tail++] = q;
        }
      }
    }
  }

  // 7. un-mix each pixel to fix from the background. (a) As a blend of its nearest clean colour F when that explains it
  // within blendFit (an anti-aliased rim: alpha = the projection on bg→F; the result kept within BLEND_RESIDUAL
  // of F, since 1 / alpha amplifies the residual). (b) Else, a pixel with k < artK is art and stays as it is, unless
  // un-mixing it by k leaves a neutral grey (a dark wisp's rim on magenta: R ≈ B, G ≈ 0), which it becomes. (c) Else by
  // its chroma excess (alpha = 1 − k: soft glows); with an F in reach the pixel then takes F's colour shifted to its own
  // luminance (a dark outline blended into the chroma, a glow-tinted gap). (d) Then, with an F, each chroma channel
  // (magenta R and B, green G) may exceed the other channel(s) by at most what it does in F + SPILL_SLACK (on gold and
  // orange a magenta blend stays k ≈ 0 but turns pink); without one, the chroma excess is clamped to 0.
  const rgba = Buffer.alloc(n * 4);
  let opaque = 0;
  let defringed = 0;
  let cut = 0;
  const lum = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;
  for (let p = 0; p < n; p++) {
    if (isBg[p]) continue;
    const i = p * 3;
    const o = p * 4;
    if (!fix[p]) {
      rgba[o] = rgb[i]!;
      rgba[o + 1] = rgb[i + 1]!;
      rgba[o + 2] = rgb[i + 2]!;
      rgba[o + 3] = 255;
      opaque++;
      continue;
    }
    const s = src[p]!;
    const f = s * 3;
    let alpha = 1 - k[p]!;
    let blend = false;
    if (s >= 0) {
      let num = 0;
      let den = 0;
      for (let c = 0; c < 3; c++) {
        num += (rgb[i + c]! - bg[c]!) * (rgb[f + c]! - bg[c]!);
        den += (rgb[f + c]! - bg[c]!) ** 2;
      }
      const a = den > 0 ? Math.min(1, Math.max(0, num / den)) : 1;
      let res = 0;
      for (let c = 0; c < 3; c++) res += (rgb[i + c]! - (a * rgb[f + c]! + (1 - a) * bg[c]!)) ** 2;
      if (Math.sqrt(res) <= opts.blendFit) {
        alpha = a;
        blend = true;
      }
    }
    if (!blend && k[p]! < opts.artK) {
      // art colour, unless it is a neutral (black / grey / white) blended into the chroma: un-mixed by k, its other
      // channels must then agree within BLEND_RESIDUAL
      const kp = k[p]!;
      const un = [0, 1, 2].map((c) => (rgb[i + c]! - kp * bg[c]!) / (1 - kp));
      const grey = (un[0]! + un[1]! + un[2]!) / 3;
      if (kp > 0 && Math.hypot(un[0]! - grey, un[1]! - grey, un[2]! - grey) * (1 - kp) <= BLEND_RESIDUAL) {
        if (1 - kp < 0.5) {
          cut++;
          continue;
        }
        const g = Math.round(Math.min(255, Math.max(0, grey)));
        rgba[o] = g;
        rgba[o + 1] = g;
        rgba[o + 2] = g;
        rgba[o + 3] = 255;
        defringed++;
        opaque++;
        continue;
      }
      rgba[o] = rgb[i]!;
      rgba[o + 1] = rgb[i + 1]!;
      rgba[o + 2] = rgb[i + 2]!;
      rgba[o + 3] = 255;
      opaque++;
      continue;
    }
    if (alpha < 0.5) {
      cut++;
      continue;
    }
    const out = [0, 1, 2].map((c) => (rgb[i + c]! - (1 - alpha) * bg[c]!) / alpha) as [number, number, number];
    if (blend) {
      const d = Math.hypot(out[0] - rgb[f]!, out[1] - rgb[f + 1]!, out[2] - rgb[f + 2]!);
      if (d > BLEND_RESIDUAL) for (let c = 0; c < 3; c++) out[c] = rgb[f + c]! + ((out[c]! - rgb[f + c]!) * BLEND_RESIDUAL) / d;
    } else if (s >= 0) {
      const shift = lum(out[0], out[1], out[2]) - lum(rgb[f]!, rgb[f + 1]!, rgb[f + 2]!);
      for (let c = 0; c < 3; c++) out[c] = rgb[f + c]! + shift;
    }
    if (s >= 0) {
      // spill clamp against F: each chroma channel may exceed the other channels by no more than it does in F (+ SPILL_SLACK)
      const F = [rgb[f]!, rgb[f + 1]!, rgb[f + 2]!];
      if (chroma === 'green') out[1] = Math.min(out[1], out[0] + F[1]! - F[0]! + SPILL_SLACK, out[2] + F[1]! - F[2]! + SPILL_SLACK);
      else {
        out[0] = Math.min(out[0], out[1] + F[0]! - F[1]! + SPILL_SLACK);
        out[2] = Math.min(out[2], out[1] + F[2]! - F[1]! + SPILL_SLACK);
      }
    } else {
      const over = excess(out[0], out[1], out[2]);
      if (over > 0) {
        if (chroma === 'green') out[1] -= over;
        else {
          out[0] -= over;
          out[2] -= over;
        }
      }
    }
    for (let c = 0; c < 3; c++) rgba[o + c] = Math.round(Math.min(255, Math.max(0, out[c]!)));
    rgba[o + 3] = 255;
    defringed++;
    opaque++;
  }
  return { width, height, rgba, stats: { chroma, bg, opaque, islands, dropped, defringed, cut } };
}

async function readRgb(file: string): Promise<{ rgb: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(file).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { rgb: data, width: info.width, height: info.height };
}

async function onGround(rgba: Buffer, width: number, height: number, ground: [number, number, number], size: number): Promise<Buffer> {
  const sprite = await sharp(rgba, { raw: { width, height, channels: 4 } }).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: { r: ground[0], g: ground[1], b: ground[2] } } })
    .composite([{ input: sprite }])
    .png()
    .toBuffer();
}

/** The 192² window around the foreground pixel with the most background within 4 px (the busiest rim). */
function busiestRim(rgba: Buffer, width: number, height: number): [number, number] {
  const W = 96;
  let best = -1;
  let at: [number, number] = [width / 2, height / 2];
  for (let cy = W; cy < height - W; cy += 32) {
    for (let cx = W; cx < width - W; cx += 32) {
      let edge = 0;
      for (let y = cy - W; y < cy + W; y += 2) {
        for (let x = cx - W + 2; x < cx + W; x += 2) {
          const a = rgba[(y * width + x) * 4 + 3]!;
          const b = rgba[(y * width + x - 2) * 4 + 3]!;
          if (a !== b) edge++;
        }
      }
      if (edge > best) {
        best = edge;
        at = [cx, cy];
      }
    }
  }
  return at;
}

async function reviewSheet(key: string, sides: Array<{ side: string; k: Keyed }>, file: string): Promise<void> {
  const S = 384;
  const tiles: sharp.OverlayOptions[] = [];
  let x = 0;
  for (const { k } of sides) {
    tiles.push({ input: await onGround(k.rgba, k.width, k.height, [24, 24, 28], S), left: x, top: 0 });
    tiles.push({ input: await onGround(k.rgba, k.width, k.height, [236, 236, 230], S), left: x, top: S });
    const [cx, cy] = busiestRim(k.rgba, k.width, k.height);
    const crop = await sharp(k.rgba, { raw: { width: k.width, height: k.height, channels: 4 } })
      .extract({ left: cx - 64, top: cy - 64, width: 128, height: 128 })
      .resize(S, S, { kernel: 'nearest' })
      .png()
      .toBuffer();
    const dark = await sharp({ create: { width: S, height: S, channels: 3, background: { r: 24, g: 24, b: 28 } } }).composite([{ input: crop }]).png().toBuffer();
    const light = await sharp({ create: { width: S, height: S, channels: 3, background: { r: 236, g: 236, b: 230 } } }).composite([{ input: crop }]).png().toBuffer();
    tiles.push({ input: dark, left: x + S, top: 0 });
    tiles.push({ input: light, left: x + S, top: S });
    x += 2 * S;
  }
  await sharp({ create: { width: x, height: 2 * S, channels: 3, background: { r: 128, g: 128, b: 128 } } }).composite(tiles).png().toFile(file);
  void key;
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const src = path.resolve(flag(argv, 'src') ?? path.join(REPO_ROOT, 'assets-src', 'forms-pending'));
  const out = path.resolve(flag(argv, 'out') ?? path.join(REPO_ROOT, 'assets-src', 'creatures'));
  const sheet = flag(argv, 'sheet');
  const only = flag(argv, 'only')?.split(',').filter(Boolean);
  const keys = readdirSync(path.join(src, 'front'))
    .map((f) => /^(.+)\(front\)\.png$/.exec(f)?.[1])
    .filter((k): k is string => k !== undefined && (only === undefined || only.includes(k)))
    .sort();
  if (sheet) mkdirSync(sheet, { recursive: true });
  const index: sharp.OverlayOptions[] = [];
  const T = 160;
  for (const [row, key] of keys.entries()) {
    const sides: Array<{ side: string; k: Keyed }> = [];
    for (const side of ['front', 'back']) {
      const file = path.join(src, side, `${key}(${side}).png`);
      if (!existsSync(file)) throw new Error(`missing ${file}`);
      const { rgb, width, height } = await readRgb(file);
      const k = keyChroma(rgb, width, height, { ...DEFAULT_KEY_OPTIONS, ...KEY_OVERRIDES[key] });
      mkdirSync(path.join(out, side), { recursive: true });
      await sharp(k.rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(out, side, `${key}(${side}).png`));
      const s = k.stats;
      console.log(
        `${key}(${side}): ${s.chroma} bg ${s.bg.join(',')}, ${((100 * s.opaque) / (width * height)).toFixed(1)} % opaque, ` +
          `${s.islands} islands kept, ${s.dropped} specks dropped, ${s.defringed} px un-mixed, ${s.cut} rim px cut`,
      );
      sides.push({ side, k });
    }
    if (sheet) {
      await reviewSheet(key, sides, path.join(sheet, `${key}.png`));
      for (const [j, { k }] of sides.entries()) {
        index.push({ input: await onGround(k.rgba, k.width, k.height, [24, 24, 28], T), left: j * 2 * T, top: row * T });
        index.push({ input: await onGround(k.rgba, k.width, k.height, [236, 236, 230], T), left: j * 2 * T + T, top: row * T });
      }
    }
  }
  if (sheet && index.length > 0) {
    await sharp({ create: { width: 4 * T, height: keys.length * T, channels: 3, background: { r: 128, g: 128, b: 128 } } })
      .composite(index)
      .png()
      .toFile(path.join(sheet, 'index.png'));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
