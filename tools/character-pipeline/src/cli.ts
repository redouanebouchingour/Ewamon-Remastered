/**
 * `pnpm --filter @ewa/character-pipeline run build` → packages/client/public/characters/ + qa/contact-sheet.png
 * `… run build -- --force` ignores the cache.
 */
import { runBuild } from './bake.js';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'build';
if (cmd !== 'build' && cmd !== 'qa') {
  console.error(`usage: cli.ts build|qa [--force]`);
  process.exit(2);
}
const t0 = Date.now();
const r = await runBuild({ force: args.includes('--force') || cmd === 'qa', log: (m) => console.log(`[characters] ${m}`) });
console.log(`[characters] ${Object.keys(r.manifest.looks).length} looks, ${r.manifest.totalBytes} B, ${r.cacheHit ? 'cache hit' : 'built'} in ${Date.now() - t0} ms`);
