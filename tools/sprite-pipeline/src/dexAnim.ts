/**
 * Animated dex thumbnails (client `CreatureSprite animated`): the front flipbook the game ships
 * (`creatures/anim/<id>-front.albedo.webp` + the manifest's frames and delays) cut into its pages, cropped to the union
 * of the pages' alpha (one framing for every page, so the creature never jumps), lanczos3 to `DEX_ANIM_SIZE` px on the
 * longest edge and written as one looping lossy animated WebP per species to `packages/client/public/dex-anim/<id>.webp`.
 *
 *   pnpm --filter @ewa/sprite-pipeline dex-anim            (every species with a front flipbook)
 *   pnpm --filter @ewa/sprite-pipeline dex-anim zenryu
 *
 * It reads only shipped files, so it reruns without `assets-src/`. Run it after a build that changes a flipbook. The
 * files live outside `creatures/` because a build rewrites that tree and its bytes count against the creature ceiling;
 * they count against the `total public/` line only.
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** the longest edge (px): the dex entry's hero box (client `CreatureSprite` size xxl) */
export const DEX_ANIM_SIZE = 176;
/** alpha above this counts toward the crop */
const ALPHA_CUT = 8;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

interface Manifest {
  readonly sprites: Record<string, { readonly anim?: { readonly front?: { readonly atlas: string; readonly frames: readonly (readonly [number, number, number, number])[]; readonly delays: readonly number[] } } }>;
  readonly animAtlases?: readonly { readonly id: string; readonly width: number; readonly height: number; readonly albedo: { readonly url: string } }[];
}

/** The species whose front plays a flipbook in the shipped manifest, in id order. */
export function animatedFronts(m: Manifest): string[] {
  return Object.keys(m.sprites).filter((id) => (m.sprites[id]!.anim?.front?.frames.length ?? 0) > 1).sort();
}

/** `[u0, v0, u1, v1]` (v up) of a `width × height` atlas → the level-0 rect `[x, y, w, h]` (y down). */
export function uvToPx(uv: readonly [number, number, number, number], width: number, height: number): [number, number, number, number] {
  const [u0, v0, u1, v1] = uv;
  return [Math.round(u0 * width), Math.round((1 - v1) * height), Math.round((u1 - u0) * width), Math.round((v1 - v0) * height)];
}

export async function buildDexAnim(id: string, m: Manifest, creaturesDir: string, outDir: string): Promise<{ file: string; pages: number; bytes: number }> {
  const side = m.sprites[id]?.anim?.front;
  if (side === undefined) throw new Error(`${id}: no front flipbook in the manifest`);
  const atlas = (m.animAtlases ?? []).find((a) => a.id === side.atlas);
  if (atlas === undefined) throw new Error(`${id}: anim atlas ${side.atlas} is not listed`);
  const src = await sharp(path.join(creaturesDir, atlas.albedo.url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (src.info.width !== atlas.width || src.info.height !== atlas.height) throw new Error(`${id}: ${atlas.albedo.url} is ${src.info.width}×${src.info.height}, the manifest says ${atlas.width}×${atlas.height}`);
  const rects = side.frames.map((uv) => uvToPx(uv, atlas.width, atlas.height));
  // the union of every page's alpha, in cell coordinates (the pipeline gives every page one transform)
  const cw = rects[0]![2];
  const ch = rects[0]![3];
  let x0 = cw;
  let y0 = ch;
  let x1 = -1;
  let y1 = -1;
  for (const [rx, ry] of rects) {
    for (let y = 0; y < ch; y++) {
      const row = ((ry + y) * atlas.width + rx) * 4;
      for (let x = 0; x < cw; x++) {
        if (src.data[row + x * 4 + 3]! <= ALPHA_CUT) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error(`${id}: every page is empty`);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const scale = DEX_ANIM_SIZE / Math.max(w, h);
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const pages: Buffer[] = [];
  for (const [rx, ry] of rects) {
    pages.push(
      await sharp(src.data, { raw: { width: atlas.width, height: atlas.height, channels: 4 } })
        .extract({ left: rx + x0, top: ry + y0, width: w, height: h })
        .resize(tw, th, { kernel: 'lanczos3', fit: 'fill' })
        .raw()
        .toBuffer(),
    );
  }
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${id}.webp`);
  await sharp(Buffer.concat(pages), { raw: { width: tw, height: th * pages.length, channels: 4, pageHeight: th } })
    .webp({ quality: 80, alphaQuality: 90, effort: 6, loop: 0, delay: side.delays.map((d) => Math.max(20, Math.round(d))) })
    .toFile(file);
  return { file, pages: pages.length, bytes: statSync(file).size };
}

async function main(): Promise<void> {
  const creaturesDir = path.join(root, 'packages', 'client', 'public', 'creatures');
  const outDir = path.join(root, 'packages', 'client', 'public', 'dex-anim');
  const m = JSON.parse(readFileSync(path.join(creaturesDir, 'creatures.manifest.json'), 'utf8')) as Manifest;
  const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const ids = asked.length > 0 ? asked : animatedFronts(m);
  let total = 0;
  for (const id of ids) {
    const r = await buildDexAnim(id, m, creaturesDir, outDir);
    total += r.bytes;
    console.log(`${id}: ${r.pages} pages, ${r.bytes} B -> ${path.relative(root, r.file)}`);
  }
  console.log(`${ids.length} animated dex thumbs, ${total} B`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
