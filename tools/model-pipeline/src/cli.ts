/**
 * `pnpm models` → `tsx src/cli.ts build [--force] [--webp] [--out <dir>]`
 *
 * Exit 0 = every model written and the manifest updated; 1 = a missing/unresolvable input (the offending id is in
 * the message), a missing licence, or an encoder failure.
 */
import { resolve } from 'node:path';
import { runBuild } from './build.js';

async function main(argv: readonly string[]): Promise<number> {
  const cmd = argv[0];
  if (cmd !== 'build') {
    console.log('usage: tsx src/cli.ts build [--force] [--webp] [--out <dir>]');
    return 2;
  }
  let force = false;
  let textures: 'auto' | 'webp' | 'ktx2' = 'auto';
  let outDir: string | undefined;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--') continue;
    else if (a === '--force') force = true;
    else if (a === '--webp') textures = 'webp';
    else if (a === '--ktx2') textures = 'ktx2';
    else if (a === '--out') { outDir = resolve(process.env.INIT_CWD ?? process.cwd(), argv[++i] ?? '.'); }
    else { console.log(`unknown argument ${a}`); return 2; }
  }
  const t0 = Date.now();
  const r = await runBuild({ force, textures, ...(outDir ? { outDir } : {}) });
  const MiB = 1024 * 1024;
  const leg = Object.values(r.manifest.legendaries);
  const chars = [...r.files.entries()].filter(([rel]) => rel.startsWith('characters/')).reduce((s, [, d]) => s + d.byteLength, 0);
  console.log(`model-pipeline: ${r.inputs} inputs, ${r.cacheHits} cache hits, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(`  legendaries ${(leg.reduce((s, e) => s + e.bytes, 0) / MiB).toFixed(2)} MB LOD0 (+ LOD1), characters ${(chars / MiB).toFixed(2)} MB (${Object.keys(r.manifest.looks).length} looks), public/models ${(r.manifest.totalBytes / MiB).toFixed(2)} MB, textures ${r.qa.textures}`);
  for (const f of r.qa.flags) console.log(`  qa ${f.flag} ${f.id}: ${f.detail}`);
  for (const w of r.qa.warnings) console.log(`  warning: ${w}`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (e: unknown) => { console.error((e as Error).message); process.exitCode = 1; },
);
