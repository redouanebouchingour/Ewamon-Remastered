/**
 * Maps species ids to the raw files under `assets-src/creatures/{front,back}`.
 *
 * Legacy file names are inconsistent (`smellduckfront.png`, `bloomduck(front).png`,
 * `bankaiser(front).webp`, `galaxion(front).gif`), so matching normalises both sides:
 * lower-case, extension and every `()_- ` character removed. PNG, WebP and GIF are
 * accepted (GIFs contribute their first frame). Files no species claims are kept as "forms":
 * `yaschamp(front)(boxingstyle).png` becomes the pseudo-species `yaschamp@boxingstyle`,
 * so every input file ships and nothing is dropped silently.
 */
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { LegacySpecies } from './legacy.js';
import type { SpriteSide } from './types.js';

export interface SpriteSource {
  /** Species id (or `<species>@<form>` for unclaimed form files). */
  id: string;
  side: SpriteSide;
  /** Path relative to the assets dir, forward slashes, e.g. `front/abyssrake(front).png`. */
  file: string;
  abs: string;
  sizeScale: number;
  /** Set when the canonical file was missing and another file of the same species was used. */
  fallback: boolean;
}

export interface SourceResolution {
  sources: SpriteSource[];
  /** Species ids with no usable file for a side. Build refuses to ship without them. */
  missing: Array<{ id: string; side: SpriteSide; wanted: string }>;
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

/** Parses an unclaimed file name into `{ id, form }` or null when it has no recognisable shape. */
export function parseFormFile(name: string, side: SpriteSide): { id: string; form: string } | null {
  const base = name.replace(IMAGE_RE, '').toLowerCase();
  const m =
    base.match(/^([a-z0-9]+)\((front|back)\)\(([a-z0-9]+)\)$/) ??
    base.match(/^([a-z0-9]+)[_-]?(front|back)[_-]([a-z0-9]+)$/);
  if (!m || m[2] !== side) return null;
  return { id: m[1]!, form: m[3]! };
}

export function compareSources(a: { id: string; side: SpriteSide }, b: { id: string; side: SpriteSide }): number {
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return a.side === b.side ? 0 : a.side === 'back' ? -1 : 1;
}

export function resolveSources(assetsDir: string, species: Map<string, LegacySpecies>): SourceResolution {
  const sources: SpriteSource[] = [];
  const missing: SourceResolution['missing'] = [];
  const claimed = new Set<string>();

  for (const side of ['front', 'back'] as const) {
    const files = listSide(assetsDir, side);
    const byNorm = new Map<string, string>();
    for (const f of files) byNorm.set(normalizeName(f), f);

    for (const id of [...species.keys()].sort()) {
      const sp = species.get(id)!;
      const wanted = side === 'front' ? sp.frontSprite : sp.backSprite;
      let file = byNorm.get(normalizeName(wanted)) ?? byNorm.get(`${id}${side}`);
      let fallback = false;
      if (!file) {
        // Any file of this species and side (e.g. a form variant) beats shipping nothing.
        const candidates = files.filter((f) => {
          const n = normalizeName(f);
          return n.startsWith(id) && n.includes(side) && !claimed.has(`${side}/${f}`);
        });
        file = candidates[0];
        fallback = file !== undefined;
      }
      if (!file) {
        missing.push({ id, side, wanted });
        continue;
      }
      claimed.add(`${side}/${file}`);
      sources.push(makeSource(assetsDir, id, side, file, sp.sizeScale, fallback));
    }

    for (const f of files) {
      if (claimed.has(`${side}/${f}`)) continue;
      const parsed = parseFormFile(f, side);
      const id = parsed ? `${parsed.id}@${parsed.form}` : `unmapped@${normalizeName(f)}`;
      const sizeScale = parsed ? (species.get(parsed.id)?.sizeScale ?? 1) : 1;
      claimed.add(`${side}/${f}`);
      sources.push(makeSource(assetsDir, id, side, f, sizeScale, false));
    }
  }

  sources.sort(compareSources);
  return { sources, missing };
}

function makeSource(
  assetsDir: string,
  id: string,
  side: SpriteSide,
  file: string,
  sizeScale: number,
  fallback: boolean,
): SpriteSource {
  return { id, side, file: `${side}/${file}`, abs: path.join(assetsDir, side, file), sizeScale, fallback };
}
