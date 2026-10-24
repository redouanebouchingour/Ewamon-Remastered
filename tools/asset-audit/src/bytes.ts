/**
 * `--bytes`: the §40.6 budget roll-up over `packages/client/public/`. Reads the four manifests' totals
 * (`creatures`/`models`/`materials` `totalBytes`, `audio/manifest.json` summed over its clip `bytes`) and also
 * measures every directory on disk; the larger of the two is held to the ceiling, so neither a stale manifest nor
 * stray files can pass under it. Licences must travel (§40.0.2 rule 6, non-negotiable 10).
 *
 * `creatures/anim/` (amended 2026-10-06) is its own line: the animated legendaries' flipbooks, held to 24 MiB against
 * `animTotalBytes`. The manifest file lives in `creatures/`, but the bytes its anim fields add (measured here by
 * re-serialising it without them, exactly as the pipeline writes it) are charged to the anim line, so the static
 * `creatures/` line keeps measuring the static set.
 *
 * MB in §40.6 is MiB: the table itself writes 35 MB as 36 700 160 B (and §50.2.2 700 MB as 734 003 200 B).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MiB = 1024 * 1024;

/** §40.6 ceilings, bytes. */
export const CEILINGS = Object.freeze({
  creatures: 46_137_344, // 44 MiB since 2026-10-25 (the Elemutt line and ravatar's five relic forms); 41 MiB from 2026-10-24 (cryptorb, ultraze, vysion); 40 MiB from 2026-10-13 (hyoryu + its Majin form); 39.25 MiB from 2026-10-11 (Majin / Tenjin forms); 36 700 160 (35 MiB) before
  creaturesAnim: 24 * MiB,
  models: 12 * MiB,
  materials: 90 * MiB,
  audio: 80 * MiB,
  misc: 2 * MiB,
  total: 243 * MiB,
});

/** The flipbooks' subdirectory of `creatures/` (its own §40.6 line). */
export const CREATURES_ANIM_DIR = 'anim';

/** `basis/ + icons/ + fonts/ + keyart/` share one line of §40.6. */
export const MISC_DIRS: readonly string[] = ['basis', 'icons', 'fonts', 'keyart'];

/** §40.0.2 rule 6: these files must exist under `public/`. */
export const LICENCES: readonly string[] = ['models/CREDITS.txt', 'icons/TABLER-LICENSE.txt'];

type ManifestDir = 'creatures' | 'models' | 'materials' | 'audio';
const MANIFESTS: Readonly<Record<ManifestDir, string>> = {
  creatures: 'creatures/creatures.manifest.json',
  models: 'models/models.manifest.json',
  materials: 'materials/materials.manifest.json',
  audio: 'audio/manifest.json',
};
/** Directories whose manifest is optional today: the audio pipeline has not run (OQ-6, audio bible unwritten). */
export const OPTIONAL_MANIFESTS: ReadonlySet<ManifestDir> = new Set<ManifestDir>(['audio']);

export interface BytesLine {
  readonly line: string;
  readonly ceiling: number;
  /** Manifest total, or null when the line has no manifest / the manifest is absent. */
  readonly manifestBytes: number | null;
  readonly diskBytes: number;
  /** max(manifestBytes, diskBytes) — the number held to the ceiling. */
  readonly bytes: number;
  readonly ok: boolean;
  readonly note: string | null;
}

export interface BytesReport {
  readonly version: 1;
  readonly publicDir: string;
  readonly lines: readonly BytesLine[];
  readonly missingLicences: readonly string[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly ok: boolean;
}

export function dirBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) n += dirBytes(p);
    else if (e.isFile()) n += statSync(p).size;
  }
  return n;
}

/** Σ `bytes` over every `AudioClipRef` in a §20.7.4 `AudioManifest` (themes' stems, sfx clips, ambience). */
export function audioManifestBytes(m: unknown): number {
  let n = 0;
  const clip = (c: unknown): void => {
    if (c && typeof c === 'object' && typeof (c as { bytes?: unknown }).bytes === 'number') n += (c as { bytes: number }).bytes;
  };
  const o = (m ?? {}) as { themes?: Record<string, { stems?: Record<string, unknown> }>; sfx?: Record<string, { clips?: unknown[] }>; ambience?: Record<string, unknown> };
  for (const t of Object.values(o.themes ?? {})) for (const s of Object.values(t.stems ?? {})) clip(s);
  for (const s of Object.values(o.sfx ?? {})) for (const c of s.clips ?? []) clip(c);
  for (const a of Object.values(o.ambience ?? {})) clip(a);
  return n;
}

function manifestTotal(publicDir: string, dir: ManifestDir, errors: string[]): number | null {
  const f = join(publicDir, MANIFESTS[dir]);
  if (!existsSync(f)) return null;
  let j: unknown;
  try {
    j = JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    errors.push(`${MANIFESTS[dir]}: not JSON (${(e as Error).message})`);
    return null;
  }
  if (dir === 'audio') return audioManifestBytes(j);
  const t = (j as { totalBytes?: unknown }).totalBytes;
  if (typeof t !== 'number') {
    errors.push(`${MANIFESTS[dir]}: no numeric totalBytes`);
    return null;
  }
  return t;
}

/**
 * The anim extension of `creatures.manifest.json`: `animTotalBytes` (null when the manifest has none) and the bytes
 * its anim fields add to the file — the file's length minus the length of the same JSON without `sprites[*].anim`,
 * `animAtlases` and `animTotalBytes`, serialised as the pipeline does (2-space indent, trailing LF).
 */
export function creaturesAnimShare(publicDir: string): { animTotalBytes: number | null; share: number } {
  const f = join(publicDir, MANIFESTS.creatures);
  if (!existsSync(f)) return { animTotalBytes: null, share: 0 };
  const text = readFileSync(f, 'utf8');
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { animTotalBytes: null, share: 0 };
  }
  const t = j.animTotalBytes;
  const sprites = (j.sprites ?? {}) as Record<string, Record<string, unknown>>;
  let had = t !== undefined || j.animAtlases !== undefined;
  for (const s of Object.values(sprites)) {
    if (s && typeof s === 'object' && 'anim' in s) {
      delete s.anim;
      had = true;
    }
  }
  if (!had) return { animTotalBytes: null, share: 0 };
  delete j.animAtlases;
  delete j.animTotalBytes;
  const share = Buffer.byteLength(text, 'utf8') - Buffer.byteLength(`${JSON.stringify(j, null, 2)}\n`, 'utf8');
  return { animTotalBytes: typeof t === 'number' ? t : null, share: Math.max(0, share) };
}

export function runBytes(publicDir: string): BytesReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!existsSync(publicDir)) {
    return { version: 1, publicDir, lines: [], missingLicences: [...LICENCES], errors: [`public dir not found: ${publicDir}`], warnings, ok: false };
  }
  const lines: BytesLine[] = [];
  const anim = creaturesAnimShare(publicDir);
  const animDisk = dirBytes(join(publicDir, 'creatures', CREATURES_ANIM_DIR));
  for (const dir of ['creatures', 'models', 'materials', 'audio'] as const) {
    const manifestBytes = manifestTotal(publicDir, dir, errors);
    // creatures/: the static set (anim/ and the manifest's anim share go to the next line)
    const diskBytes = dir === 'creatures' ? dirBytes(join(publicDir, dir)) - animDisk - anim.share : dirBytes(join(publicDir, dir));
    let note: string | null = null;
    if (manifestBytes === null) {
      if (OPTIONAL_MANIFESTS.has(dir)) {
        note = `${MANIFESTS[dir]} absent (pipeline not run); disk bytes only`;
        warnings.push(`${dir}: ${note}`);
      } else {
        errors.push(`${dir}: ${MANIFESTS[dir]} missing — run the pipeline that owns it`);
        note = 'manifest missing';
      }
    }
    const bytes = Math.max(manifestBytes ?? 0, diskBytes);
    const ceiling = CEILINGS[dir];
    lines.push({ line: `${dir}/`, ceiling, manifestBytes, diskBytes, bytes, ok: bytes <= ceiling && note !== 'manifest missing', note });
    if (dir === 'creatures') {
      const disk = animDisk + anim.share;
      let animNote: string | null = null;
      if (anim.animTotalBytes === null && disk > 0) {
        animNote = 'anim files without animTotalBytes in creatures.manifest.json';
        errors.push(`creatures/anim/: ${animNote}`);
      }
      const b = Math.max(anim.animTotalBytes ?? 0, disk);
      lines.push({ line: 'creatures/anim/', ceiling: CEILINGS.creaturesAnim, manifestBytes: anim.animTotalBytes, diskBytes: disk, bytes: b, ok: b <= CEILINGS.creaturesAnim && animNote === null, note: animNote });
    }
  }
  const misc = MISC_DIRS.reduce((s, d) => s + dirBytes(join(publicDir, d)), 0);
  lines.push({ line: `${MISC_DIRS.map((d) => `${d}/`).join(' + ')}`, ceiling: CEILINGS.misc, manifestBytes: null, diskBytes: misc, bytes: misc, ok: misc <= CEILINGS.misc, note: null });
  // total = Σ lines (each already max(manifest, disk)) + whatever sits under public/ outside every line's directory.
  const total = dirBytes(publicDir);
  const covered = lines.reduce((s, l) => s + l.diskBytes, 0);
  const uncovered = Math.max(0, total - covered);
  const totalBytes = lines.reduce((s, l) => s + l.bytes, 0) + uncovered;
  lines.push({ line: 'total public/', ceiling: CEILINGS.total, manifestBytes: null, diskBytes: total, bytes: totalBytes, ok: totalBytes <= CEILINGS.total, note: uncovered ? `${uncovered} B outside the listed directories` : null });
  const missingLicences = LICENCES.filter((f) => !existsSync(join(publicDir, f)));
  for (const f of missingLicences) errors.push(`licence missing: public/${f} (SPEC §40.0.2 rule 6)`);
  const ok = errors.length === 0 && lines.every((l) => l.ok);
  return { version: 1, publicDir, lines, missingLicences, errors, warnings, ok };
}
