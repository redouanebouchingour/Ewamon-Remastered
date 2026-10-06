/**
 * Phase E4 — CC0 sources. `.design/audio/sources.json` maps job ids (`themes/<t>/<layer>`, `ambience/<biome>`,
 * `sfx/<id>_<n>`) onto files under `assets-src/audio/cc0/`, with their attribution:
 *
 *   { "themes/grove/base": { "file": "pack/forest.ogg", "licence": "CC0-1.0", "author": "…", "url": "…",
 *                            "title"?: "…", "trim"?: [startSec, endSec], "gainDb"?: n,
 *                            "bpm"?: n, "bars"?: n, "crossfadeSec"?: n, "derive"?: true } }
 *
 * This module is pure (plus file hashing): it validates the file, classifies every manifest job (a direct source, a
 * stem layer derived from its theme's base track, a pitch-shifted sibling of a mapped sfx variant, or unmapped),
 * applies the tempo overrides a source declares to the manifest, and computes the per-job salt that `requestHash`
 * folds in — the source file's sha256 plus its processing settings plus the recipe version — so a swapped file,
 * a new trim or a new derivation recipe is a new job, and an unchanged one is a cache hit.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { canonicalJson, sha256Hex } from './json.js';
import type { JobSalts, PlannedJob } from './jobs.js';
import { expandJobs } from './jobs.js';
import type { AudioKind, AudioSourceManifest, StemLayer, ThemeSpec } from './schema.js';
import { STEM_LAYERS, stemDurationSec } from './schema.js';

/** The provider name CC0 clips are recorded under (cache records, `requestHash`). */
export const CC0_PROVIDER = 'cc0';
/** The only licence accepted (user decision, Phase E4). */
export const CC0_LICENCE = 'CC0-1.0';
/** Bump when the decode/trim/conform steps change: every ingested job re-processes. */
export const INGEST_RECIPE = 'ingest-v1';
/** Bump when a derived layer's filter chain changes. */
export const DERIVE_RECIPE = 'derive-v1';
/** Pitch ratios for derived sfx variants (index 0 is the mapped clip itself): ±1 semitone, then ±2. */
export const VARIANT_PITCH = [1, 1.0595, 0.9439, 1.1225, 0.8909] as const;

// ─── schema ─────────────────────────────────────────────────────────────────

export interface SourceEntry {
  /** path under the cc0 directory (forward slashes, no `..`) */
  readonly file: string;
  readonly licence: string;
  readonly author: string;
  /** the page the file was downloaded from (credited) */
  readonly url: string;
  readonly title?: string;
  /** a licence text under `assets-src/audio/licenses/`, e.g. the pack's own License.txt */
  readonly licenceFile?: string;
  /** seconds [start, end) of the source to use; themes: the musical loop region */
  readonly trim?: readonly [number, number];
  readonly gainDb?: number;
  /** themes (base only): the region's real tempo and length in bars; overrides the manifest theme */
  readonly bpm?: number;
  readonly bars?: number;
  /** themes: bake a seam cross-fade of this length into the region (uses the audio just before trim[0]) */
  readonly crossfadeSec?: number;
  /** themes (base only): derive the unmapped threat/biome/night layers from this track (default true) */
  readonly derive?: boolean;
  /** free text, ignored by the pipeline */
  readonly note?: string;
}

export type SourcesFile = Readonly<Record<string, SourceEntry>>;

const RelPath = z
  .string()
  .min(1)
  .refine((p) => !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..'), 'must be a relative path under the cc0 directory without ..');

export const SourceEntrySchema: z.ZodType<SourceEntry> = z.strictObject({
  file: RelPath,
  licence: z.string().refine((v) => v === CC0_LICENCE, `only ${CC0_LICENCE} sources are accepted (Phase E4 decision)`),
  author: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1).optional(),
  licenceFile: RelPath.optional(),
  trim: z
    .tuple([z.number().min(0), z.number().positive()])
    .refine(([a, b]) => b > a, 'trim end must be after its start')
    .optional(),
  gainDb: z.number().min(-40).max(24).optional(),
  bpm: z.number().min(30).max(260).optional(),
  bars: z.number().int().min(2).max(64).optional(),
  crossfadeSec: z.number().min(0).max(4).optional(),
  derive: z.boolean().optional(),
  note: z.string().optional(),
});

export interface LoadedSources {
  readonly file: string;
  readonly exists: boolean;
  /** valid entries (entries with problems are dropped and listed in `problems`) */
  readonly entries: SourcesFile;
  readonly problems: readonly string[];
}

/** Read and validate sources.json. A missing file is an empty mapping; malformed JSON throws (a config error). */
export function loadSources(file: string, manifest: AudioSourceManifest): LoadedSources {
  if (!existsSync(file)) return { file, exists: false, entries: {}, problems: [] };
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`audio-pipeline: cannot parse ${file}: ${(err as Error).message}`);
  }
  return validateSources(json, manifest, file);
}

export function validateSources(json: unknown, manifest: AudioSourceManifest, file = 'sources.json'): LoadedSources {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) throw new Error(`audio-pipeline: ${file} must be a JSON object of jobId → source`);
  const ids = new Set(expandJobs(manifest, CC0_PROVIDER, '').map((j) => j.id));
  const entries: Record<string, SourceEntry> = {};
  const problems: string[] = [];
  for (const [id, raw] of Object.entries(json as Record<string, unknown>)) {
    if (id.startsWith('$')) continue; // "$comment", "$schema"
    const parsed = SourceEntrySchema.safeParse(raw);
    if (!parsed.success) {
      problems.push(...parsed.error.issues.map((i) => `${id}${i.path.length > 0 ? `.${i.path.join('.')}` : ''}: ${i.message}`));
      continue;
    }
    const e = parsed.data;
    const local: string[] = [];
    if (!ids.has(id)) local.push(`${id}: not a job id of the manifest (themes/<t>/<layer>, ambience/<biome>, sfx/<id>_<n>)`);
    const isTheme = id.startsWith('themes/');
    const isBase = isTheme && id.endsWith('/base');
    if (!isBase && (e.bpm !== undefined || e.bars !== undefined)) local.push(`${id}: bpm/bars belong on the theme's base entry`);
    if (!isBase && e.derive !== undefined) local.push(`${id}: derive belongs on the theme's base entry`);
    if (!isTheme && e.crossfadeSec !== undefined) local.push(`${id}: crossfadeSec is for theme stems (ambience loops are cross-faded by process)`);
    if (local.length > 0) problems.push(...local);
    else entries[id] = e;
  }
  return { file, exists: true, entries: sortRecord(entries), problems };
}

// ─── tempo overrides ────────────────────────────────────────────────────────

/** The bpm/bars a theme's base source declares (absent = the manifest's). */
export function themeTarget(t: ThemeSpec, sources: SourcesFile): { bpm: number; bars: number; overridden: boolean } {
  const e = sources[`themes/${t.id}/base`];
  const bpm = e?.bpm ?? t.bpm;
  const bars = e?.bars ?? t.bars;
  return { bpm, bars, overridden: bpm !== t.bpm || bars !== t.bars };
}

/**
 * The manifest with every theme whose base source declares `bpm`/`bars` re-timed to the track's own tempo: theme
 * bpm/bars and every stem prompt's bpm + durationSec. `process` finds the loop and writes the output `bpm` from
 * this, so a CC0 track is never forced onto the bible's tempo when it was written at another.
 */
export function applySourceOverrides(m: AudioSourceManifest, sources: SourcesFile): AudioSourceManifest {
  let changed = false;
  const themes = m.themes.map((t) => {
    const target = themeTarget(t, sources);
    if (!target.overridden) return t;
    changed = true;
    const durationSec = stemDurationSec(target.bars, target.bpm);
    const stems = {} as Record<StemLayer, ThemeSpec['stems'][StemLayer]>;
    for (const layer of STEM_LAYERS) stems[layer] = { ...t.stems[layer], bpm: Math.round(target.bpm), durationSec };
    // bars outside 8|16|32 are allowed for a CC0 track (the client reads loop points, not bars)
    return { ...t, bpm: target.bpm, bars: target.bars as ThemeSpec['bars'], stems };
  });
  return changed ? { ...m, themes } : m;
}

// ─── classification ─────────────────────────────────────────────────────────

export type IngestRole =
  | { readonly kind: 'direct'; readonly entry: SourceEntry }
  | { readonly kind: 'layer'; readonly from: string; readonly layer: Exclude<StemLayer, 'base'> }
  | { readonly kind: 'variant'; readonly from: string; readonly ratio: number }
  | { readonly kind: 'none' };

export interface ClassifiedJob {
  readonly id: string;
  readonly kind: AudioKind;
  readonly role: IngestRole;
}

/** Every manifest job with how the ingest fills it. Sorted by id. */
export function classifyJobs(m: AudioSourceManifest, sources: SourcesFile): ClassifiedJob[] {
  const jobs = expandJobs(m, CC0_PROVIDER, '');
  const byGroup = new Map<string, PlannedJob[]>();
  for (const j of jobs) if (j.kind === 'sfx' || j.kind === 'ui') byGroup.set(j.meta.group, [...(byGroup.get(j.meta.group) ?? []), j]);
  const out: ClassifiedJob[] = [];
  for (const j of jobs) {
    const direct = sources[j.id];
    if (direct !== undefined) {
      out.push({ id: j.id, kind: j.kind, role: { kind: 'direct', entry: direct } });
      continue;
    }
    if (j.kind === 'stem' && j.meta.layer !== null && j.meta.layer !== 'base') {
      const baseId = `themes/${j.meta.group}/base`;
      const base = sources[baseId];
      if (base !== undefined && base.derive !== false) {
        out.push({ id: j.id, kind: j.kind, role: { kind: 'layer', from: baseId, layer: j.meta.layer } });
        continue;
      }
    }
    if (j.kind === 'sfx' || j.kind === 'ui') {
      const siblings = byGroup.get(j.meta.group) ?? [];
      const mapped = siblings.filter((s) => sources[s.id] !== undefined);
      if (mapped.length > 0) {
        const unmapped = siblings.filter((s) => sources[s.id] === undefined);
        const k = unmapped.findIndex((s) => s.id === j.id);
        const from = mapped[k % mapped.length]!;
        const ratio = VARIANT_PITCH[Math.min(VARIANT_PITCH.length - 1, 1 + Math.floor(k / mapped.length))]!;
        out.push({ id: j.id, kind: j.kind, role: { kind: 'variant', from: from.id, ratio } });
        continue;
      }
    }
    out.push({ id: j.id, kind: j.kind, role: { kind: 'none' } });
  }
  return out;
}

// ─── salts ──────────────────────────────────────────────────────────────────

/** sha256 of a file's bytes, or null when it does not exist. */
export function fileSha256(file: string): string | null {
  if (!existsSync(file)) return null;
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** The entry fields that change the produced audio (attribution fields do not re-process). */
export function processingFields(e: SourceEntry): Record<string, unknown> {
  return { trim: e.trim, gainDb: e.gainDb, bpm: e.bpm, bars: e.bars, crossfadeSec: e.crossfadeSec };
}

export interface Cc0Resolution {
  /** the manifest with source tempo overrides applied */
  readonly manifest: AudioSourceManifest;
  readonly sources: LoadedSources;
  readonly classified: readonly ClassifiedJob[];
  /** jobId → salt, for every job whose source (or base / sibling source) exists */
  readonly salts: JobSalts;
  /** jobId → source sha256 of the file it is made from */
  readonly hashes: Readonly<Record<string, string>>;
  /** mapped jobs whose file is missing, and the jobs derived from them */
  readonly missing: readonly { readonly id: string; readonly file: string }[];
  readonly coverage: Coverage;
}

export interface KindCoverage {
  readonly total: number;
  readonly direct: number;
  readonly derived: number;
  readonly unmapped: number;
}
export interface Coverage {
  readonly total: number;
  readonly covered: number;
  /** covered / total, 0..1 */
  readonly fraction: number;
  readonly byKind: Readonly<Record<AudioKind, KindCoverage>>;
}

export function coverageOf(classified: readonly ClassifiedJob[]): Coverage {
  const byKind: Record<AudioKind, { total: number; direct: number; derived: number; unmapped: number }> = {
    stem: { total: 0, direct: 0, derived: 0, unmapped: 0 },
    ambience: { total: 0, direct: 0, derived: 0, unmapped: 0 },
    sfx: { total: 0, direct: 0, derived: 0, unmapped: 0 },
    ui: { total: 0, direct: 0, derived: 0, unmapped: 0 },
  };
  for (const c of classified) {
    const k = byKind[c.kind];
    k.total++;
    if (c.role.kind === 'direct') k.direct++;
    else if (c.role.kind === 'none') k.unmapped++;
    else k.derived++;
  }
  const covered = classified.filter((c) => c.role.kind !== 'none').length;
  return { total: classified.length, covered, fraction: classified.length === 0 ? 0 : covered / classified.length, byKind };
}

/** Classify, hash every referenced source file and compute the salts. `hash` is injectable for tests. */
export function resolveCc0(manifest: AudioSourceManifest, sources: LoadedSources, cc0Dir: string, hash: (file: string) => string | null = fileSha256): Cc0Resolution {
  const m = applySourceOverrides(manifest, sources.entries);
  const classified = classifyJobs(m, sources.entries);
  const fileHash = new Map<string, string | null>();
  const hashOf = (rel: string): string | null => {
    if (!fileHash.has(rel)) fileHash.set(rel, hash(path.join(cc0Dir, rel)));
    return fileHash.get(rel)!;
  };
  const salts: Record<string, string> = {};
  const hashes: Record<string, string> = {};
  const missing: { id: string; file: string }[] = [];
  const directSalt = (id: string, e: SourceEntry): string | null => {
    const h = hashOf(e.file);
    if (h === null) return null;
    hashes[id] = h;
    return sha256Hex(CC0_PROVIDER, INGEST_RECIPE, h, canonicalJson(processingFields(e)));
  };
  // direct first: layers and variants salt off their source's salt
  for (const c of classified) {
    if (c.role.kind !== 'direct') continue;
    const s = directSalt(c.id, c.role.entry);
    if (s === null) missing.push({ id: c.id, file: c.role.entry.file });
    else salts[c.id] = s;
  }
  for (const c of classified) {
    if (c.role.kind === 'layer') {
      const from = salts[c.role.from];
      if (from !== undefined) {
        salts[c.id] = sha256Hex(from, 'layer', c.role.layer, DERIVE_RECIPE);
        hashes[c.id] = hashes[c.role.from]!;
      }
    } else if (c.role.kind === 'variant') {
      const from = salts[c.role.from];
      if (from !== undefined) {
        salts[c.id] = sha256Hex(from, 'variant', c.role.ratio.toFixed(4));
        hashes[c.id] = hashes[c.role.from]!;
      }
    }
  }
  return { manifest: m, sources, classified, salts: sortRecord(salts), hashes: sortRecord(hashes), missing: missing.sort((a, b) => (a.id < b.id ? -1 : 1)), coverage: coverageOf(classified) };
}

function sortRecord<T>(r: Readonly<Record<string, T>>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of Object.keys(r).sort()) out[k] = r[k]!;
  return out;
}
