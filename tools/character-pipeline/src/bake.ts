/**
 * Bake: every look's 44 frames → one atlas (albedo + derived normal map), WebP-encoded, plus
 * `characters.manifest.json` (per look, per facing, per state: the frame UV rects) and the QA contact sheet.
 *
 *   albedo   straight RGBA, binary alpha; transparent texels within 2 of an opaque one carry its RGB
 *            (so a minified sample never pulls black into the outline), all others (0, 0, 0, 0).
 *            Lossless WebP: flat pixel art codes to a few hundred KB losslessly, and lossy chroma
 *            subsampling would smear 1-texel colour edges that are magnified ≈ 4× on screen.
 *   normal   derived per frame exactly like the creatures' (`@ewa/sprite-pipeline` deriveNormalMap:
 *            luminance height + Sobel + an outward alpha-edge bevel), with the kernel scaled to pixel art
 *            (σ 0.6 instead of 1.2, a 2.5-texel bevel instead of 6: a creature is ~900 texels tall, a
 *            character 42). Alpha 255 everywhere and flat (128, 128, 255) outside the sprite (the albedo alpha
 *            cuts; a flat background codes to almost nothing). Lossless WebP.
 *   emissive none (the runtime binds a 4 × 4 black mask).
 *
 * Deterministic: integer rasters, sorted keys, `sharp` WebP lossless at a fixed effort. Content-hash cache:
 * the key is sha256(PIPELINE_VERSION, the bytes of every source file under src/, the encoder settings); a
 * rerun over unchanged sources copies the cached outputs and composes nothing (`cacheHit`).
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { deriveNormalMap, type NormalMapOptions, type RgbaImage } from '@ewa/sprite-pipeline';
import { BASE_DY, FOOT_ROW } from './compose.js';
import { CELL_H, CELL_W, type Facing } from './grid.js';
import { allLooks } from './looks.js';
import { CYCLE_M, FACINGS, FPS, STATES, frameOrder, type State } from './poses.js';
import { renderLook, type Frame, type LookDef } from './sheet.js';
import { renderContactSheet } from './qa.js';

export const PIPELINE_VERSION = '1';
export const MANIFEST_FILE = 'characters.manifest.json';
/** Atlas width in texels (64 cells); the height is the rows used × CELL_H. */
export const ATLAS_W = 2048;
/** The standing height (soles to crown, no hat) that maps to STAND_M. */
export const STAND_PX = 40;
/** World height of a standing character (m): 40 texels ≈ 1.7 m → 23.5 texels per metre. */
export const STAND_M = 1.7;
/** `packages/client/public/characters/` byte budget (SPEC §40.6 proposal). */
export const CHARACTERS_BUDGET_BYTES = 3 * 1024 * 1024;
export const NORMAL_OPTIONS: NormalMapOptions = { sigma: 0.6, strength: 0.35, bevelBand: 2.5, bevelStrength: 0.7 };
export const WEBP = Object.freeze({ lossless: true, effort: 6 });

// ---- manifest -----------------------------------------------------------------------------------------------

export type Rect = readonly [number, number, number, number];
export interface ManifestAtlas { readonly id: string; readonly width: number; readonly height: number; readonly albedo: string; readonly normal: string; readonly hash: string }
export interface ManifestLook {
  readonly atlas: string;
  /** Opaque rows above the foot line in the idle frame (the nameplate anchor): `(FOOT_ROW − topRow)` texels. */
  readonly heightPx: number;
  /** facing → state → frame rects (u0, v0, u1, v1; v up, like the creature manifest). Emotes exist for D only. */
  readonly frames: Readonly<Record<Facing, Partial<Record<State, readonly Rect[]>>>>;
}
export interface CharactersManifest {
  readonly version: 1;
  readonly cell: { readonly w: number; readonly h: number };
  /** 0..1 from the bottom of a cell to the foot line. */
  readonly footV: number;
  /** Texels per metre in the world (STAND_PX / STAND_M). */
  readonly pixelsPerMetre: number;
  /** World size of one cell (m). */
  readonly cellM: { readonly w: number; readonly h: number };
  readonly fps: Readonly<Record<State, number>>;
  /** Metres covered by one 4-frame cycle: the runtime plays walk/run at speed / cycleM × 4 fps. */
  readonly cycleM: Readonly<Record<'walk' | 'run', number>>;
  readonly atlases: readonly ManifestAtlas[];
  readonly looks: Readonly<Record<string, ManifestLook>>;
  readonly totalBytes: number;
}

// ---- rasters ----------------------------------------------------------------------------------------------------

interface Placed { readonly look: LookDef; readonly frames: Frame[]; readonly firstCell: number }

function createImage(w: number, h: number): RgbaImage { return { width: w, height: h, data: new Uint8Array(w * h * 4) }; }

function blitCell(dst: RgbaImage, src: Uint8Array, ox: number, oy: number): void {
  for (let y = 0; y < CELL_H; y++) {
    const s = y * CELL_W * 4;
    dst.data.set(src.subarray(s, s + CELL_W * 4), ((oy + y) * dst.width + ox) * 4);
  }
}

/** In place: transparent texels within `radius` (Chebyshev) of an opaque texel take its RGB (alpha stays 0). */
export function dilateRgb(img: Uint8Array, w: number, h: number, radius: number): void {
  const src = Uint8Array.from(img);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] !== 0) continue;
      let best = -1; let bd = Infinity;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx; const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = (ny * w + nx) * 4;
          if (src[j + 3] === 0) continue;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = j; }
        }
      }
      if (best >= 0) { img[i] = src[best]!; img[i + 1] = src[best + 1]!; img[i + 2] = src[best + 2]!; }
    }
  }
}

/** One frame's normal map (32 × 52), flat outside the sprite, alpha 255. */
export function frameNormal(rgba: Uint8Array): Uint8Array {
  const n = deriveNormalMap({ width: CELL_W, height: CELL_H, data: rgba }, NORMAL_OPTIONS);
  const out = n.data;
  for (let i = 0; i < CELL_W * CELL_H; i++) {
    if (rgba[i * 4 + 3] === 0) { out[i * 4] = 128; out[i * 4 + 1] = 128; out[i * 4 + 2] = 255; }
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Topmost opaque row of a frame (CELL_H when empty). */
export function topRow(rgba: Uint8Array): number {
  for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) if (rgba[(y * CELL_W + x) * 4 + 3] !== 0) return y;
  return CELL_H;
}

export interface Rasters {
  readonly albedo: RgbaImage;
  readonly normal: RgbaImage;
  readonly placed: readonly Placed[];
  readonly rows: number;
}

/** Composes every look into the atlas rasters (cells contiguous per look, 64 per atlas row). */
export function buildRasters(looks: readonly LookDef[]): Rasters {
  const perLook = frameOrder().length;
  const cols = ATLAS_W / CELL_W;
  const cells = looks.length * perLook;
  const rows = Math.ceil(cells / cols);
  const albedo = createImage(ATLAS_W, rows * CELL_H);
  const normal = createImage(ATLAS_W, rows * CELL_H);
  for (let i = 0; i < ATLAS_W * rows * CELL_H; i++) { normal.data[i * 4] = 128; normal.data[i * 4 + 1] = 128; normal.data[i * 4 + 2] = 255; normal.data[i * 4 + 3] = 255; }
  const placed: Placed[] = [];
  looks.forEach((look, li) => {
    const frames = renderLook(look);
    const firstCell = li * perLook;
    frames.forEach((f, fi) => {
      const cell = firstCell + fi;
      const ox = (cell % cols) * CELL_W; const oy = Math.floor(cell / cols) * CELL_H;
      const rgba = Uint8Array.from(f.rgba);
      const nrm = frameNormal(rgba);
      dilateRgb(rgba, CELL_W, CELL_H, 2);
      blitCell(albedo, rgba, ox, oy);
      blitCell(normal, nrm, ox, oy);
    });
    placed.push({ look, frames, firstCell });
  });
  return { albedo, normal, placed, rows };
}

function rectOf(cell: number, atlasH: number): Rect {
  const cols = ATLAS_W / CELL_W;
  const x = (cell % cols) * CELL_W; const y = Math.floor(cell / cols) * CELL_H;
  const r = (v: number): number => Math.round(v * 1e6) / 1e6;
  return [r(x / ATLAS_W), r(1 - (y + CELL_H) / atlasH), r((x + CELL_W) / ATLAS_W), r(1 - y / atlasH)];
}

export function buildManifest(r: Rasters, atlas: ManifestAtlas, totalBytes: number): CharactersManifest {
  const order = frameOrder();
  const looks: Record<string, ManifestLook> = {};
  for (const p of [...r.placed].sort((a, b) => (a.look.id < b.look.id ? -1 : a.look.id > b.look.id ? 1 : 0))) {
    const frames: Record<Facing, Partial<Record<State, Rect[]>>> = { D: {}, U: {}, L: {}, R: {} };
    order.forEach((o, i) => { (frames[o.facing][o.state] ??= []).push(rectOf(p.firstCell + i, atlas.height)); });
    const idle = p.frames.find((f) => f.facing === 'D' && f.state === 'idle' && f.index === 0)!;
    looks[p.look.id] = { atlas: atlas.id, heightPx: FOOT_ROW - topRow(idle.rgba), frames };
  }
  const ppm = STAND_PX / STAND_M;
  const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
  return {
    version: 1,
    cell: { w: CELL_W, h: CELL_H },
    footV: r6((CELL_H - FOOT_ROW) / CELL_H),
    pixelsPerMetre: r6(ppm),
    cellM: { w: r6(CELL_W / ppm), h: r6(CELL_H / ppm) },
    fps: { ...FPS },
    cycleM: { ...CYCLE_M },
    atlases: [atlas],
    looks,
    totalBytes,
  };
}

/**
 * Sorted keys, 2-space indent, trailing LF (SPEC §40.0.2 rule 1); arrays of numbers (the frame rects) stay on
 * one line, which keeps the 1 056 rects readable and the file ~3× smaller.
 */
export function serialize(v: unknown): string {
  const write = (x: unknown, ind: string): string => {
    if (Array.isArray(x)) {
      if (x.every((e) => typeof e === 'number')) return `[${x.join(', ')}]`;
      if (x.length === 0) return '[]';
      return `[\n${x.map((e) => `${ind}  ${write(e, `${ind}  `)}`).join(',\n')}\n${ind}]`;
    }
    if (x !== null && typeof x === 'object') {
      const keys = Object.keys(x as object).filter((k) => (x as Record<string, unknown>)[k] !== undefined).sort();
      if (keys.length === 0) return '{}';
      return `{\n${keys.map((k) => `${ind}  ${JSON.stringify(k)}: ${write((x as Record<string, unknown>)[k], `${ind}  `)}`).join(',\n')}\n${ind}}`;
    }
    return JSON.stringify(x);
  };
  return `${write(v, '')}\n`;
}

export async function encodeWebp(img: RgbaImage): Promise<Uint8Array> {
  const buf = await sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } })
    .webp({ lossless: WEBP.lossless, effort: WEBP.effort })
    .toBuffer();
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function sha256(...parts: (string | Uint8Array)[]): string {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex');
}

// ---- build ------------------------------------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOOL_DIR = path.resolve(HERE, '..');
export const REPO_DIR = path.resolve(TOOL_DIR, '..', '..');
export const REAL_OUT_DIR = path.join(REPO_DIR, 'packages', 'client', 'public', 'characters');
export const QA_DIR = path.join(TOOL_DIR, 'qa');

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) out.push(...listSources(p));
    else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** The cache key: PIPELINE_VERSION + every source file's bytes (templates, looks, stages) + encoder settings. */
export function sourceKey(): string {
  const files = listSources(HERE);
  return sha256(`v${PIPELINE_VERSION}`, JSON.stringify(WEBP), JSON.stringify(NORMAL_OPTIONS), ...files.flatMap((f) => [path.relative(HERE, f).replace(/\\/g, '/'), readFileSync(f)]));
}

export interface BuildOptions {
  readonly outDir?: string;
  readonly qaDir?: string;
  readonly cacheDir?: string;
  readonly force?: boolean;
  readonly log?: (msg: string) => void;
}

export interface BuildResult {
  readonly manifest: CharactersManifest;
  readonly cacheHit: boolean;
  readonly files: readonly string[];
}

/** Every output file of a build, relative to `outDir`. */
function outputFiles(atlasId: string): { albedo: string; normal: string } {
  return { albedo: `atlas/${atlasId}.albedo.webp`, normal: `atlas/${atlasId}.normal.webp` };
}

export async function runBuild(o: BuildOptions = {}): Promise<BuildResult> {
  const outDir = o.outDir ?? REAL_OUT_DIR;
  const qaDir = o.qaDir ?? QA_DIR;
  const cacheDir = o.cacheDir ?? path.join(TOOL_DIR, '.cache');
  const log = o.log ?? (() => undefined);
  const key = sourceKey();
  const cached = path.join(cacheDir, key);
  const atlasId = 'chars-0';
  const names = outputFiles(atlasId);
  const rel = [MANIFEST_FILE, names.albedo, names.normal];
  const qaFiles = ['contact-sheet.png'];

  if (o.force !== true && rel.every((f) => existsSync(path.join(cached, 'out', f))) && qaFiles.every((f) => existsSync(path.join(cached, 'qa', f)))) {
    rmSync(outDir, { recursive: true, force: true });
    for (const f of rel) { mkdirSync(path.dirname(path.join(outDir, f)), { recursive: true }); copyFileSync(path.join(cached, 'out', f), path.join(outDir, f)); }
    mkdirSync(qaDir, { recursive: true });
    for (const f of qaFiles) copyFileSync(path.join(cached, 'qa', f), path.join(qaDir, f));
    log(`cache hit ${key.slice(0, 12)}: no image work`);
    return { manifest: JSON.parse(readFileSync(path.join(outDir, MANIFEST_FILE), 'utf8')) as CharactersManifest, cacheHit: true, files: rel };
  }

  const looks = allLooks();
  const r = buildRasters(looks);
  log(`composed ${looks.length} looks × ${frameOrder().length} frames into ${ATLAS_W}×${r.rows * CELL_H}`);
  const [albedoBytes, normalBytes] = await Promise.all([encodeWebp(r.albedo), encodeWebp(r.normal)]);
  const atlas: ManifestAtlas = {
    id: atlasId, width: ATLAS_W, height: r.rows * CELL_H, albedo: names.albedo, normal: names.normal,
    hash: sha256(albedoBytes, normalBytes).slice(0, 16),
  };
  // the manifest's own size is part of totalBytes: iterate to a fixed point (the number's digits change the size)
  let total = albedoBytes.byteLength + normalBytes.byteLength;
  let text = '';
  for (let i = 0; i < 4; i++) {
    text = serialize(buildManifest(r, atlas, total));
    const next = albedoBytes.byteLength + normalBytes.byteLength + Buffer.byteLength(text);
    if (next === total) break;
    total = next;
  }
  const manifest = JSON.parse(text) as CharactersManifest;
  if (manifest.totalBytes > CHARACTERS_BUDGET_BYTES) throw new RangeError(`character-pipeline: ${manifest.totalBytes} B exceeds the ${CHARACTERS_BUDGET_BYTES} B budget`);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(path.join(outDir, 'atlas'), { recursive: true });
  writeFileSync(path.join(outDir, MANIFEST_FILE), text);
  writeFileSync(path.join(outDir, names.albedo), albedoBytes);
  writeFileSync(path.join(outDir, names.normal), normalBytes);
  mkdirSync(qaDir, { recursive: true });
  const sheet = await renderContactSheet(r.placed.map((p) => ({ id: p.look.id, frames: p.frames })));
  writeFileSync(path.join(qaDir, 'contact-sheet.png'), sheet);

  // cache
  mkdirSync(path.join(cached, 'out', 'atlas'), { recursive: true });
  mkdirSync(path.join(cached, 'qa'), { recursive: true });
  for (const f of rel) copyFileSync(path.join(outDir, f), path.join(cached, 'out', f));
  for (const f of qaFiles) copyFileSync(path.join(qaDir, f), path.join(cached, 'qa', f));
  log(`wrote ${rel.length} files, ${manifest.totalBytes} B (albedo ${albedoBytes.byteLength}, normal ${normalBytes.byteLength})`);
  return { manifest, cacheHit: false, files: rel };
}

/** Bytes of every file under `dir`. */
export function dirBytes(dir: string): number {
  let n = 0;
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = statSync(p);
    n += s.isDirectory() ? dirBytes(p) : s.size;
  }
  return n;
}

void BASE_DY; void FACINGS; void STATES;
