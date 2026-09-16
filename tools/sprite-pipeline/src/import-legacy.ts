/**
 * `tsx src/import-legacy.ts <path-to-old-repo-or-sprites-dir> [--assets DIR]`
 *
 * Copies the legacy creature art into `assets-src/creatures/{front,back,animations}`:
 *
 *   <old>/ewamon/frontend/ewamon-sprites/ewamon(front)/*       -> front/
 *   <old>/ewamon/frontend/ewamon-sprites/ewamon(back)/*        -> back/
 *   <old>/ewamon/frontend/ewamon-sprites/ewamon(animations)/*  -> animations/
 *
 * The argument may be the old repo root, its `ewamon/` or `frontend/` directory, or the
 * `ewamon-sprites/` directory itself. Idempotent: a destination file with identical bytes is
 * left alone, a differing one is overwritten (the source is the truth), nothing is deleted.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE_RE = /\.(png|webp|gif)$/i;

const FOLDERS: Array<{ legacy: string; dest: 'front' | 'back' | 'animations' }> = [
  { legacy: 'ewamon(front)', dest: 'front' },
  { legacy: 'ewamon(back)', dest: 'back' },
  { legacy: 'ewamon(animations)', dest: 'animations' },
];

export interface ImportSummary {
  copied: string[];
  unchanged: string[];
  /** Legacy folders that were not found under the given root. */
  missingFolders: string[];
}

/** Finds the `ewamon-sprites` directory from any of the accepted starting points. */
export function locateSpritesDir(input: string): string | null {
  const candidates = [
    input,
    path.join(input, 'ewamon-sprites'),
    path.join(input, 'frontend', 'ewamon-sprites'),
    path.join(input, 'ewamon', 'frontend', 'ewamon-sprites'),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(c, 'ewamon(front)')) || existsSync(path.join(c, 'ewamon(back)'))) return c;
  }
  return null;
}

export function importLegacySprites(spritesDir: string, assetsDir: string): ImportSummary {
  const summary: ImportSummary = { copied: [], unchanged: [], missingFolders: [] };
  for (const { legacy, dest } of FOLDERS) {
    const srcDir = path.join(spritesDir, legacy);
    if (!existsSync(srcDir) || !statSync(srcDir).isDirectory()) {
      summary.missingFolders.push(legacy);
      continue;
    }
    const dstDir = path.join(assetsDir, dest);
    mkdirSync(dstDir, { recursive: true });
    for (const file of readdirSync(srcDir).sort()) {
      if (!IMAGE_RE.test(file)) continue;
      const src = path.join(srcDir, file);
      if (!statSync(src).isFile()) continue;
      const dst = path.join(dstDir, file);
      const rel = `${dest}/${file}`;
      if (existsSync(dst) && readFileSync(dst).equals(readFileSync(src))) {
        summary.unchanged.push(rel);
        continue;
      }
      copyFileSync(src, dst);
      summary.copied.push(rel);
    }
  }
  return summary;
}

function main(argv: string[]): void {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const assetsFlag = argv.indexOf('--assets');
  const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const assetsDir = assetsFlag >= 0 && argv[assetsFlag + 1] ? path.resolve(argv[assetsFlag + 1]!) : path.resolve(pkgDir, '..', '..', 'assets-src', 'creatures');
  const input = positional[0];
  if (!input) {
    console.error('usage: tsx src/import-legacy.ts <old-repo-or-ewamon-sprites-dir> [--assets DIR]');
    process.exitCode = 2;
    return;
  }
  const spritesDir = locateSpritesDir(path.resolve(input));
  if (!spritesDir) {
    console.error(`no ewamon(front)/ewamon(back) folders found under ${input}`);
    process.exitCode = 2;
    return;
  }
  const s = importLegacySprites(spritesDir, assetsDir);
  console.log(`from ${spritesDir}`);
  console.log(`  copied ${s.copied.length}, unchanged ${s.unchanged.length} -> ${assetsDir}`);
  for (const f of s.copied) console.log(`  + ${f}`);
  if (s.missingFolders.length) console.log(`  not found: ${s.missingFolders.join(', ')}`);
}

const invokedDirectly = process.argv[1] !== undefined && existsSync(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main(process.argv.slice(2));
