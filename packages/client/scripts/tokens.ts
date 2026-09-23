/**
 * `pnpm --filter @ewa/client tokens` — runs the pure compiler in src/ui/gen-tokens.ts against the file
 * system: writes src/ui/tokens.css + src/ui/tokens.ts and exits non-zero on any design-system
 * violation (ΔE, font-size, spacing, stray custom property). `--check` writes nothing and fails when a
 * generated file is out of date (what CI runs).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTokenFiles } from '../src/ui/gen-tokens';
import type { SourceFile, TokenSource } from '../src/ui/gen-tokens';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'src');
const uiDir = join(src, 'ui');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.css') && name !== 'tokens.css') out.push(p);
  }
  return out;
}

const tokens = JSON.parse(readFileSync(join(uiDir, 'tokens.json'), 'utf8')) as TokenSource;
const css: SourceFile[] = walk(src).map((p) => ({ path: relative(root, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));
const build = buildTokenFiles(tokens, css);

const check = process.argv.includes('--check');
let stale = false;
for (const [file, text] of [
  ['tokens.css', build.css],
  ['tokens.ts', build.ts],
] as const) {
  const p = join(uiDir, file);
  let current = '';
  try {
    current = readFileSync(p, 'utf8');
  } catch (_e) {
    current = '';
  }
  if (current === text) continue;
  if (check) {
    stale = true;
    console.error(`src/ui/${file} is out of date — run pnpm --filter @ewa/client tokens`);
  } else {
    writeFileSync(p, text);
    console.log(`wrote src/ui/${file}`);
  }
}

for (const v of build.violations) console.error(`design-system: ${v.where}: ${v.message}`);
if (build.violations.length > 0 || stale) process.exit(1);
console.log(`tokens ok (${css.length} stylesheets checked)`);
