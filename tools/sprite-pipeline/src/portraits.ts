/**
 * Signature move cut-in portraits (client `battle/signatures.ts`): the front source sprite of a battle form, background
 * recovered like stage 1 (`recoverAlpha`), the FULL canvas kept (the cinematic's eye-glint coordinates are % of it),
 * resized to 256 px (nearest: the sources are 4× pixel art) and written as lossless WebP.
 *
 *   pnpm --filter @ewa/sprite-pipeline portraits hollowmane_rage castlemaw_rage
 *
 * Reads `assets-src/creatures/front/<id>(front).png`, writes `packages/client/public/signature/<id>.webp`.
 */
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { recoverAlpha } from './alpha.js';

export const PORTRAIT_SIZE = 256;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export async function buildPortrait(id: string, srcDir: string, outDir: string): Promise<string> {
  const src = path.join(srcDir, `${id}(front).png`);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { image, flags } = recoverAlpha({ width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) });
  if (flags.includes('empty')) throw new Error(`${id}: the background recovery left nothing`);
  const out = path.join(outDir, `${id}.webp`);
  await sharp(Buffer.from(image.data), { raw: { width: image.width, height: image.height, channels: 4 } })
    .resize(PORTRAIT_SIZE, PORTRAIT_SIZE, { kernel: 'nearest', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(out);
  return out;
}

async function main(): Promise<void> {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (ids.length === 0) throw new Error('usage: portraits <sprite id…> (e.g. hollowmane_rage)');
  const srcDir = path.join(root, 'assets-src', 'creatures', 'front');
  const outDir = path.join(root, 'packages', 'client', 'public', 'signature');
  mkdirSync(outDir, { recursive: true });
  for (const id of ids) {
    const out = await buildPortrait(id, srcDir, outDir);
    console.log(`${id} → ${path.relative(root, out)} (${statSync(out).size} B)`);
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
