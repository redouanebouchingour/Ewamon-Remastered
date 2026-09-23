/**
 * Builds all 21 heightfields (§3.11) and writes dist/heightfields/<zoneId>.json in the compact
 * `i16x64-b64+rle` form (see heightfield.ts encodeHeightfield). Prints size, walkable and water ratios.
 * Run with `pnpm --filter @ewa/content run heightfields`. The files are committed (spine §3.10).
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZONES, decodeHeightfield, encodeHeightfield, getHeightfield, walkableRatio, waterRatio } from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../dist/heightfields');
mkdirSync(OUT, { recursive: true });

let total = 0;
let minWalk = 1;
for (const zone of ZONES) {
  const t0 = Date.now();
  const h = getHeightfield(zone.id);
  const built = Date.now() - t0;
  const json = encodeHeightfield(h);
  // round-trip guard: the decoded field must reproduce the digest bit for bit
  const back = decodeHeightfield(json);
  if (back.digest !== h.digest) throw new Error(`${zone.id}: round-trip digest mismatch`);
  const file = resolve(OUT, `${zone.id}.json`);
  writeFileSync(file, JSON.stringify(json) + '\n', 'utf8');
  const bytes = statSync(file).size;
  total += bytes;
  const wr = walkableRatio(h);
  minWalk = Math.min(minWalk, wr);
  console.log(
    `${zone.id.padEnd(19)} ${String(h.res).padStart(3)}² ${(bytes / 1024).toFixed(0).padStart(4)} KB  walkable ${(wr * 100).toFixed(1).padStart(5)}%  water ${(waterRatio(h) * 100).toFixed(1).padStart(4)}%  digest ${h.digest}  ${built} ms`,
  );
}
console.log(`total ${(total / 1024).toFixed(0)} KB · min walkable ${(minWalk * 100).toFixed(1)}% → dist/heightfields/`);
if (minWalk < 0.45) {
  console.error('FAIL: a zone is below the 45% walkable floor (§3.10 rule 12)');
  process.exit(1);
}
