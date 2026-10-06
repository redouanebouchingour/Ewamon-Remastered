/**
 * The shipped flipbooks (spec §40.1.3 / §40.1.5 / §40.6 as amended 2026-10-06), read from the REAL output under
 * `packages/client/public/creatures/anim/` (skipped when absent): one atlas per animated side holding every source page
 * (the count and delays read back from the GIF / WebP when `assets-src/creatures` is present), binary alpha and the mip
 * chain in every map, the static frame on the static cell's foot line ± 1 texel, every page inside the one shared
 * placement, and the static frame overlaying the static cell (swapping shows no jump).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { alphaBbox } from '../src/alpha.js';
import { animLadderRungs, displayDelays } from '../src/anim.js';
import type { ManifestAnimAtlas, SpriteManifestV2 } from '../src/manifest.js';
import { MANIFEST_FILE } from '../src/manifest.js';
import type { Bbox, RgbaImage } from '../src/types.js';
import { ANIM_DIR, FOOT_V } from '../src/types.js';
import { REAL_OUT_DIR, REAL_QA_DIR, REPO_ROOT } from './helpers.js';

const MANIFEST_PATH = path.join(REAL_OUT_DIR, MANIFEST_FILE);
const manifest: SpriteManifestV2 | null = existsSync(MANIFEST_PATH) ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as SpriteManifestV2) : null;
const ANIMATED = ['bankaiser', 'galaxion', 'glacinid', 'lumyth', 'noxmyth', 'raikitsune', 'sunjaw', 'voidraxis', 'voltaura', 'zenryu'];
const ASSETS = path.join(REPO_ROOT, 'assets-src', 'creatures');
const REPORT = path.join(REAL_QA_DIR, 'anim-report.json');

interface ReportSide {
  species: string;
  side: 'front' | 'back';
  source: string;
  pages: number;
  master: { left: number; top: number; width: number; height: number };
}

async function decode(file: string, crop?: readonly number[]): Promise<RgbaImage> {
  let img = sharp(file).ensureAlpha();
  if (crop) img = img.extract({ left: crop[0]!, top: crop[1]!, width: crop[2]!, height: crop[3]! });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

function crop(img: RgbaImage, x: number, y: number, w: number, h: number): RgbaImage {
  const out = { width: w, height: h, data: new Uint8Array(w * h * 4) };
  for (let r = 0; r < h; r++) out.data.set(img.data.subarray(((y + r) * img.width + x) * 4, ((y + r) * img.width + x + w) * 4), r * w * 4);
  return out;
}

/** The static cell's alpha seen at the anim cell's resolution: 2×2 majority (≥ 2 of 4 opaque). */
function halfAlpha(img: RgbaImage): Uint8Array {
  const w = img.width >> 1;
  const out = new Uint8Array(w * (img.height >> 1));
  for (let y = 0; y < img.height >> 1; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) if (img.data[((2 * y + dy) * img.width + 2 * x + dx) * 4 + 3]! >= 128) n++;
      out[y * w + x] = n >= 2 ? 1 : 0;
    }
  }
  return out;
}

function framePx(a: ManifestAnimAtlas, uv: readonly number[]): [number, number, number, number] {
  return [Math.round(uv[0]! * a.width), Math.round((1 - uv[3]!) * a.height), a.cell, a.cell];
}

describe.skipIf(!manifest?.animAtlases)('anim/ flipbooks (real output)', () => {
  const m = manifest!;
  const atlases = new Map((m.animAtlases ?? []).map((a) => [a.id, a]));
  const report = existsSync(REPORT) ? (JSON.parse(readFileSync(REPORT, 'utf8')) as { rung: { albedo: number; normal: number }; sides: ReportSide[] }) : null;

  it('the 10 animated species, both sides, one atlas each, 512² cells, every map with 3 pipeline mips', () => {
    expect(Object.keys(m.sprites).filter((id) => m.sprites[id]!.anim).sort()).toEqual(ANIMATED);
    expect(m.animAtlases!.length).toBe(20);
    for (const a of m.animAtlases!) {
      expect(a.cell).toBe(512);
      expect(Math.max(a.width, a.height)).toBeLessThanOrEqual(8192);
      expect(a.albedo.codec).toBe('webp-lossy');
      expect(a.normal.codec).toBe('webp-lossy');
      expect(a.emissive.codec).toBe('webp-lossless');
      expect(animLadderRungs().some((r) => r.albedo === a.albedo.quality && r.normal === a.normal.quality), a.id).toBe(true);
    }
    if (report) for (const a of m.animAtlases!) expect([a.albedo.quality, a.normal.quality]).toEqual([report.rung.albedo, report.rung.normal]);
  });

  it.skipIf(!existsSync(ASSETS))('frame count and delays per side = the source pages (sharp metadata)', async () => {
    for (const id of ANIMATED) {
      for (const side of ['front', 'back'] as const) {
        const s = m.sprites[id]!.anim![side]!;
        const md = await sharp(path.join(ASSETS, s.source), { pages: -1 }).metadata();
        expect(s.frames.length, `${id}/${side}`).toBe(md.pages);
        expect(s.delays, `${id}/${side}`).toEqual(displayDelays(md.delay, md.pages ?? 1));
        expect(atlases.get(s.atlas)!.slots).toBe(md.pages);
      }
    }
  }, 120_000);

  it('binary alpha in every map and level; level sizes halve; normal at half resolution', async () => {
    for (const a of m.animAtlases!) {
      const files = [a.albedo.url, ...a.albedo.mips];
      for (let l = 0; l < files.length; l++) {
        const img = await decode(path.join(REAL_OUT_DIR, files[l]!));
        expect([img.width, img.height], `${a.id} L${l}`).toEqual([a.width >> l, a.height >> l]);
        let soft = 0;
        for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 0 && img.data[i] !== 255) soft++;
        expect(soft, `${a.id} L${l} soft alpha texels`).toBe(0);
      }
      const n0 = await sharp(path.join(REAL_OUT_DIR, a.normal.url)).metadata();
      expect([n0.width, n0.height]).toEqual([a.width / 2, a.height / 2]);
    }
  }, 300_000);

  it('static frame on the foot line ± 1 texel; every page inside the one shared placement; static ↔ anim aligned', async () => {
    const footRow = Math.round(FOOT_V * 512) - 1;
    const worst: string[] = [];
    for (const id of ANIMATED) {
      for (const side of ['front', 'back'] as const) {
        const s = m.sprites[id]!.anim![side]!;
        const a = atlases.get(s.atlas)!;
        const albedo = await decode(path.join(REAL_OUT_DIR, a.albedo.url));
        const boxes: Array<Bbox | null> = s.frames.map((uv) => {
          const [x, y, w, h] = framePx(a, uv);
          return alphaBbox(crop(albedo, x, y, w, h), 128);
        });
        // the static frame sits on the static cell's foot line
        const sb = boxes[s.staticFrame]!;
        expect(Math.abs(sb.y1 - footRow), `${id}/${side} static frame bottom ${sb.y1}`).toBeLessThanOrEqual(1);
        // one transform for every page: the pages' union fills exactly the placed union crop (÷ 2, ± 1 texel)
        const r = report?.sides.find((x) => x.species === id && x.side === side);
        if (r) {
          const u = boxes.reduce<Bbox | null>((acc, b) => (!b ? acc : !acc ? { ...b } : { x0: Math.min(acc.x0, b.x0), y0: Math.min(acc.y0, b.y0), x1: Math.max(acc.x1, b.x1), y1: Math.max(acc.y1, b.y1) }), null)!;
          const want = { x0: r.master.left / 2, y0: r.master.top / 2, x1: (r.master.left + r.master.width) / 2 - 1, y1: (r.master.top + r.master.height) / 2 - 1 };
          for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(Math.abs(u[k] - want[k]), `${id}/${side} union ${k}`).toBeLessThanOrEqual(1.5);
          expect(s.frames.length).toBe(r.pages);
        }
        // the static frame overlays the static cell: alpha IoU at the anim resolution, bbox within ± 1 texel
        const rect = m.sprites[id]![side];
        const sa = m.atlases.find((x) => x.id === rect.atlas)!;
        const staticCell = await decode(path.join(REAL_OUT_DIR, sa.albedo.url), rect.px);
        const ref = halfAlpha(staticCell);
        const [fx, fy] = framePx(a, s.frames[s.staticFrame]!);
        const cell = crop(albedo, fx, fy, 512, 512);
        let inter = 0;
        let uni = 0;
        for (let i = 0; i < ref.length; i++) {
          const p = ref[i]!;
          const q = cell.data[i * 4 + 3]! >= 128 ? 1 : 0;
          inter += p & q;
          uni += p | q;
        }
        const iou = inter / uni;
        worst.push(`${id}/${side} IoU ${iou.toFixed(4)}`);
        expect(iou, `${id}/${side}`).toBeGreaterThan(0.95);
        const st = alphaBbox(staticCell, 128)!;
        expect(Math.abs(sb.x0 - st.x0 / 2), `${id}/${side} x0`).toBeLessThanOrEqual(1);
        expect(Math.abs(sb.y0 - st.y0 / 2), `${id}/${side} y0`).toBeLessThanOrEqual(1);
        expect(Math.abs(sb.x1 - (st.x1 + 1) / 2 + 1), `${id}/${side} x1`).toBeLessThanOrEqual(1);
        expect(Math.abs(sb.y1 - (st.y1 + 1) / 2 + 1), `${id}/${side} y1`).toBeLessThanOrEqual(1);
      }
    }
    expect(worst.length).toBe(20);
  }, 600_000);

  it('the anim files live under anim/ only', () => {
    for (const a of m.animAtlases!) for (const k of ['albedo', 'normal', 'emissive'] as const) for (const f of [a[k].url, ...a[k].mips]) expect(f.startsWith(`${ANIM_DIR}/`)).toBe(true);
  });
});
