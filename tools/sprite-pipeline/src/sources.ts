/**
 * Maps species ids to the raw files under `assets-src/creatures/{front,back}` (spec §40.1.1).
 *
 * Legacy file names are inconsistent (`smellduckfront.png`, `bloomduck(front).png`,
 * `bankaiser(front).webp`, `galaxion(front).gif`), so matching normalises both sides:
 * lower-case, extension and every `()_- ` character removed, first against
 * `frontSprite`/`backSprite` from `ewamon.js`, then against `<id><side>`.
 *
 * The species set is exactly the ids of `ewamon.js`. A file no species claims is NOT a
 * species: it is recorded in `excluded` (`reason: 'alternate-style'` when it parses as
 * `<id>(<side>)(<style>)` for a known species, `'unmapped'` otherwise) and never processed.
 * A species with no file for a side is an error, never a fallback.
 */
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { LegacySpecies } from './legacy.js';
import type { SpriteSide } from './types.js';

export interface SpriteSource {
  id: string;
  side: SpriteSide;
  /** Path relative to the assets dir, forward slashes, e.g. `front/abyssrake(front).png`. */
  file: string;
  abs: string;
  sizeScale: number;
}

export type ExclusionReason = 'alternate-style' | 'unmapped';

export interface ExcludedFile {
  /** Relative to the assets dir, e.g. `front/yaschamp(front)(boxingstyle).png`. */
  file: string;
  reason: ExclusionReason;
}

export interface SourceResolution {
  sources: SpriteSource[];
  /** Species ids with no usable file for a side. The build refuses to ship without them. */
  missing: Array<{ id: string; side: SpriteSide; wanted: string }>;
  excluded: ExcludedFile[];
}

const IMAGE_RE = /\.(png|webp|gif)$/i;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(IMAGE_RE, '')
    .replace(/[()_\-\s]/g, '');
}

function listSide(assetsDir: string, side: SpriteSide): string[] {
  const dir = path.join(assetsDir, side);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => IMAGE_RE.test(f))
    .sort();
}

/** `yaschamp(front)(boxingstyle).png` -> `{ id: 'yaschamp', style: 'boxingstyle' }`, else null. */
export function parseAlternateStyle(name: string, side: SpriteSide): { id: string; style: string } | null {
  const base = name.replace(IMAGE_RE, '').toLowerCase();
  const m = base.match(/^([a-z0-9]+)\((front|back)\)\(([a-z0-9]+)\)$/) ?? base.match(/^([a-z0-9]+)[_-]?(front|back)[_-]([a-z0-9]+)$/);
  if (!m || m[2] !== side) return null;
  return { id: m[1]!, style: m[3]! };
}

/** Sort: species id, then `back` before `front`. */
export function compareSources(a: { id: string; side: SpriteSide }, b: { id: string; side: SpriteSide }): number {
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return a.side === b.side ? 0 : a.side === 'back' ? -1 : 1;
}

export function resolveSources(assetsDir: string, species: Map<string, LegacySpecies>): SourceResolution {
  const sources: SpriteSource[] = [];
  const missing: SourceResolution['missing'] = [];
  const excluded: ExcludedFile[] = [];

  for (const side of ['front', 'back'] as const) {
    const files = listSide(assetsDir, side);
    const claimed = new Set<string>();
    const byNorm = new Map<string, string>();
    for (const f of files) byNorm.set(normalizeName(f), f);

    for (const id of [...species.keys()].sort()) {
      const sp = species.get(id)!;
      const wanted = side === 'front' ? sp.frontSprite : sp.backSprite;
      const file = (wanted ? byNorm.get(normalizeName(wanted)) : undefined) ?? byNorm.get(`${id}${side}`);
      if (!file) {
        missing.push({ id, side, wanted: wanted || `${id}${side}.*` });
        continue;
      }
      claimed.add(file);
      sources.push({ id, side, file: `${side}/${file}`, abs: path.join(assetsDir, side, file), sizeScale: sp.sizeScale });
    }

    for (const f of files) {
      if (claimed.has(f)) continue;
      const alt = parseAlternateStyle(f, side);
      excluded.push({ file: `${side}/${f}`, reason: alt && species.has(alt.id) ? 'alternate-style' : 'unmapped' });
    }
  }

  sources.sort(compareSources);
  excluded.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  return { sources, missing, excluded };
}
