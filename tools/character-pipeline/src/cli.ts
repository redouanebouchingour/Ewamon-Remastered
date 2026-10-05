/**
 * SUPERSEDED (2026-10-05, see README): the pixel-art characters are no longer shipped, so the CLI never writes into
 * `packages/client/public/` any more.
 *
 * `pnpm --filter @ewa/character-pipeline run build -- --out <dir>` → `<dir>/` + qa/contact-sheet.png
 * `… run build -- --out <dir> --force` ignores the cache.
 */
import path from 'node:path';
import { runBuild } from './bake.js';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'build';
if (cmd !== 'build' && cmd !== 'qa') {
  console.error('usage: cli.ts build|qa --out <dir> [--force]');
  process.exit(2);
}
const at = args.indexOf('--out');
const out = at >= 0 ? args[at + 1] : undefined;
if (out === undefined) {
  console.error('[characters] superseded by the KayKit 3D characters (tools/model-pipeline): pass --out <dir>; nothing is written into public/');
  process.exit(2);
}
const outDir = path.resolve(process.env.INIT_CWD ?? process.cwd(), out);
const t0 = Date.now();
const r = await runBuild({ outDir, force: args.includes('--force') || cmd === 'qa', log: (m) => console.log(`[characters] ${m}`) });
console.log(`[characters] ${Object.keys(r.manifest.looks).length} looks, ${r.manifest.totalBytes} B, ${r.cacheHit ? 'cache hit' : 'built'} in ${Date.now() - t0} ms → ${outDir}`);
