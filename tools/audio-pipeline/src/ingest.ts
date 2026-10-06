/**
 * Phase E4 `ingest` — CC0 source files → the raw cache `process` already reads. For every job `sources.json`
 * covers (directly, as a derived theme layer, or as a pitch-shifted sfx sibling) it decodes the source with ffmpeg
 * (wav / ogg / mp3 / flac — anything ffmpeg reads) to 48 kHz float, applies trim + gain, shapes it the way the
 * provider contract shapes a generated clip, and writes `rawWavPath(cache, requestHash)` with a `cc0` record in
 * `.cache/audio/jobs.json`. `requestHash` carries the source salt (`sources.ts`), so `process --provider cc0`
 * finds exactly these WAVs and runs loop detection, loudness, Opus/AAC and `manifest.json` unchanged.
 *
 * Shaping per kind:
 *   - theme stem: the region (`trim`, default the whole file) is taken as one seamless loop (`crossfadeSec` bakes
 *     a seam fade when it is not), time-stretched with ffmpeg `atempo` onto the theme's nominal loop
 *     `bars × 240 / bpm` when within ±6 %, and laid out like a generated stem: 0.5 s of the loop's tail as a
 *     head, the loop, then the loop again up to `(bars + 2) × 240 / bpm + 2` s — periodic by construction, so
 *     the autocorrelation finder locks onto it with a score of ≈ 1.
 *   - derived layers (a theme with only a base track): threat / biome / night are ffmpeg-filtered copies of the
 *     same periodic signal (warm-up period discarded, so the filters are in steady state and the copies stay
 *     periodic and sample-aligned), level-set below base (see `LAYER_RECIPES`); `process` keeps their gain linked
 *     to base so those relative levels survive normalisation.
 *   - ambience: trimmed, cut to the bed's `durationSec` (process bakes the 2 s loop cross-fade).
 *   - sfx / ui: mono, trimmed, faded to fit the id's `durationSec`; a missing variant is a sibling's clip
 *     pitch-shifted (`asetrate` + `aresample`, `VARIANT_PITCH`).
 * Missing files are reported (qa/ingest-report.json + the log), never thrown.
 */
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { writeCredits } from './credits.js';
import { checkFfmpeg, decodeToPcm, filterWav } from './ffmpeg.js';
import type { CacheRecord, CacheSource, PlannedJob } from './jobs.js';
import { expandJobs, isCached, readCacheIndex, writeCacheIndex } from './jobs.js';
import { writeJson } from './json.js';
import { bakeSeamCrossfade } from './loop.js';
import type { IngestPaths, PipelinePaths } from './paths.js';
import { FfmpegMissingError } from './process.js';
import type { AudioSourceManifest, StemLayer } from './schema.js';
import type { Cc0Resolution, Coverage, LoadedSources, SourceEntry } from './sources.js';
import { CC0_PROVIDER, loadSources, resolveCc0, themeTarget } from './sources.js';
import { encodeWav } from './wav.js';

export const INGEST_RATE = 48000;
/** Largest tempo correction `atempo` is trusted with; beyond it the source must declare its own bpm/bars. */
export const MAX_STRETCH = 0.06;
/** Seconds of the loop's tail laid before loopStart (inside the finder's [0.25, 1.0] s start window). */
export const STEM_LEAD_SEC = 0.5;
/** Derived-layer filters must reach steady state before the kept window starts. */
export const LAYER_WARMUP_SEC = 8;
/** Ambience shorter than this cannot carry process's 2 s cross-fade loop. */
export const AMBIENCE_MIN_SEC = 6.5;
/** sfx longer than their `durationSec` fade out over this much (capped at 30 % of the clip) before the cut. */
export const SFX_FIT_FADE_SEC = 0.25;

export type DerivedLayer = Exclude<StemLayer, 'base'>;

/**
 * What each derived layer becomes, in the roles of audio-bible §3.1 (all layers play on top of base):
 *   - threat — "rhythm and tension": the 110 Hz–7 kHz band through a slow-attack compressor (transients punch
 *     through), gated by a decaying eighth-note pulse locked to the loop's downbeat; −6 dB under base. Heard in
 *     battle / when spotted, it adds drive without a new melody.
 *   - biome — "the signature, bright upper register": everything above 2.2 kHz (two poles), widened, with eighth +
 *     quarter-note echoes; −10 dB. The harvested 1 200 Hz low-pass removes it entirely, as the bible intends.
 *   - night — "sparse and quiet, lots of air": the track below 1 kHz (two poles), widened, with 1-, 2- and 3-beat
 *     echoes as a soft wash; −9 dB. At night the theme gets warmer and more diffuse.
 */
export const LAYER_RECIPES: Readonly<Record<DerivedLayer, { readonly relDb: number; readonly filter: (beatMs: number) => string; readonly pulse: boolean }>> = {
  threat: { relDb: -6, pulse: true, filter: () => 'highpass=f=110,lowpass=f=7000,acompressor=threshold=0.0631:ratio=5:attack=25:release=140:makeup=2' },
  biome: { relDb: -10, pulse: false, filter: (b) => `highpass=f=2200,highpass=f=2200,extrastereo=m=2,aecho=1:0.8:${ms(b / 2)}|${ms(b)}:0.35|0.2` },
  night: { relDb: -9, pulse: false, filter: (b) => `lowpass=f=1000,lowpass=f=1000,extrastereo=m=1.6,aecho=1:0.75:${ms(b)}|${ms(2 * b)}|${ms(3 * b)}:0.45|0.3|0.18` },
};
/** threat pulse: eighth notes, gain (1 − depth) + depth · e^(−decay · φ) over each eighth's phase φ ∈ [0, 1). */
export const THREAT_PULSE = { depth: 0.65, decay: 5 } as const;

const ms = (x: number): string => (Math.round(x * 10) / 10).toString();

// ─── DSP helpers (pure) ─────────────────────────────────────────────────────

type Chans = Float32Array[];

export function trimAndGain(chs: readonly Float32Array[], sr: number, e: Pick<SourceEntry, 'trim' | 'gainDb' | 'crossfadeSec'>): Chans {
  const n = chs[0]?.length ?? 0;
  let start = 0;
  let end = n;
  if (e.trim !== undefined) {
    start = Math.min(n, Math.round(e.trim[0] * sr));
    end = Math.min(n, Math.round(e.trim[1] * sr));
  }
  let src: readonly Float32Array[] = chs;
  if (e.crossfadeSec !== undefined && e.crossfadeSec > 0 && end > start) src = bakeSeamCrossfade(chs, start, end, Math.round(e.crossfadeSec * sr));
  const g = e.gainDb !== undefined ? 10 ** (e.gainDb / 20) : 1;
  return src.map((c) => {
    const out = c.slice(start, end);
    if (g !== 1) for (let i = 0; i < out.length; i++) out[i] = Math.fround(out[i]! * g);
    return out;
  });
}

/** `unit` repeated to `length` frames (periodic tiling). */
export function tile(unit: readonly Float32Array[], length: number): Chans {
  return unit.map((u) => {
    const out = new Float32Array(length);
    for (let i = 0; i < length; i += u.length) out.set(u.subarray(0, Math.min(u.length, length - i)), i);
    return out;
  });
}

export function rms(chs: readonly Float32Array[], start = 0, end = chs[0]?.length ?? 0): number {
  let s = 0;
  let k = 0;
  for (const c of chs) {
    for (let i = start; i < end; i++) s += c[i]! * c[i]!;
    k += end - start;
  }
  return k > 0 ? Math.sqrt(s / k) : 0;
}

/** The decaying eighth-note gate of the threat layer; `period` = loop frames, `eighths` per loop. */
export function applyPulse(chs: Chans, period: number, eighths: number): void {
  const eighth = period / eighths;
  const { depth, decay } = THREAT_PULSE;
  for (const c of chs) {
    for (let i = 0; i < c.length; i++) {
      const pos = i % period;
      const phi = (pos % eighth) / eighth;
      c[i] = Math.fround(c[i]! * (1 - depth + depth * Math.exp(-decay * phi)));
    }
  }
}

/** Fit an sfx clip into `maxSec` after its leading silence (−50 dBFS): fade out over the tail, then cut. */
export function fitSfx(chs: readonly Float32Array[], sr: number, maxSec: number): Chans {
  const n = chs[0]?.length ?? 0;
  const thr = 10 ** (-50 / 20);
  let first = 0;
  outer: for (let i = 0; i < n; i++) for (const c of chs) if (Math.abs(c[i]!) >= thr) {
    first = i;
    break outer;
  }
  const max = Math.round(maxSec * sr);
  if (n - first <= max) return chs.map((c) => c.slice());
  const end = first + max;
  const fade = Math.max(1, Math.round(Math.min(SFX_FIT_FADE_SEC, 0.3 * maxSec) * sr));
  return chs.map((c) => {
    const out = c.slice(0, end);
    for (let k = 0; k < fade; k++) {
      const i = end - fade + k;
      out[i] = Math.fround(out[i]! * (1 - (k + 1) / fade));
    }
    return out;
  });
}

// ─── ffmpeg-backed steps ────────────────────────────────────────────────────

async function filterPcm(work: string, tag: string, chs: readonly Float32Array[], af: string): Promise<Chans> {
  const a = path.join(work, `${tag}.in.wav`);
  const b = path.join(work, `${tag}.out.wav`);
  writeFileSync(a, encodeWav({ sampleRate: INGEST_RATE, channels: chs }, 32));
  await filterWav(a, b, af, INGEST_RATE, chs.length);
  const out = await decodeToPcm(b, INGEST_RATE, chs.length);
  rmSync(a, { force: true });
  rmSync(b, { force: true });
  return out;
}

/**
 * Conform a seamless loop region of `S` frames onto exactly `N` frames: identical lengths pass through; a
 * difference ≤ `MAX_STRETCH` is time-stretched with `atempo` over three tiled periods (the middle one is kept,
 * so the stretched loop joins itself); a larger one throws with the fix in the message.
 */
export async function conformLoop(region: readonly Float32Array[], N: number, work: string, tag: string): Promise<{ unit: Chans; ratio: number }> {
  const S = region[0]?.length ?? 0;
  if (S === 0) throw new Error('empty loop region');
  if (Math.abs(S - N) <= 2) {
    const unit = region.map((c) => {
      const out = new Float32Array(N);
      out.set(c.subarray(0, Math.min(N, c.length)));
      if (c.length < N) out.fill(c[c.length - 1] ?? 0, c.length);
      return out;
    });
    return { unit, ratio: 1 };
  }
  const ratio = S / N;
  if (Math.abs(ratio - 1) > MAX_STRETCH) {
    throw new Error(
      `loop region ${(S / INGEST_RATE).toFixed(3)} s cannot fit the theme loop ${(N / INGEST_RATE).toFixed(3)} s (stretch ${((ratio - 1) * 100).toFixed(1)} % > ${MAX_STRETCH * 100} %): set "trim" to whole bars, or declare the track's "bpm"/"bars"`,
    );
  }
  const stretched = await filterPcm(work, `${tag}.stretch`, tile(region, 3 * S), `atempo=${ratio.toFixed(6)}`);
  const unit = stretched.map((c) => {
    const out = new Float32Array(N);
    out.set(c.subarray(N, Math.min(c.length, 2 * N)));
    return out;
  });
  return { unit, ratio };
}

/** A stem from a loop unit: [tail of the loop as a head][loop][loop …] up to `totalFrames`. */
export function stemFromUnit(unit: readonly Float32Array[], totalFrames: number, leadFrames: number): { chs: Chans; offset: number } {
  const N = unit[0]!.length;
  const lead = Math.min(leadFrames, N - 1);
  const offset = N - lead; // start inside the first period so the head is the loop's own tail
  const tiled = tile(unit, offset + totalFrames);
  return { chs: tiled.map((c) => c.slice(offset, offset + totalFrames)), offset };
}

/** threat / biome / night from the loop unit, sample-aligned with `stemFromUnit`'s base. */
export async function deriveLayer(unit: readonly Float32Array[], layer: DerivedLayer, bpm: number, bars: number, totalFrames: number, leadFrames: number, work: string, tag: string): Promise<Chans> {
  const N = unit[0]!.length;
  const lead = Math.min(leadFrames, N - 1);
  let offset = N - lead;
  while (offset < LAYER_WARMUP_SEC * INGEST_RATE) offset += N; // discard filter warm-up; keep the phase
  const recipe = LAYER_RECIPES[layer];
  const filtered = await filterPcm(work, `${tag}.${layer}`, tile(unit, offset + totalFrames), recipe.filter(60000 / bpm));
  const len = offset + totalFrames;
  const q = filtered.map((c) => {
    if (c.length >= len) return c;
    const out = new Float32Array(len);
    out.set(c);
    return out;
  });
  if (recipe.pulse) applyPulse(q, N, bars * 8);
  return q.map((c) => c.slice(offset, offset + totalFrames));
}

// ─── the command ────────────────────────────────────────────────────────────

export interface IngestOptions {
  /** the validated source manifest (tempo overrides are applied here from sources.json) */
  readonly manifest: AudioSourceManifest;
  readonly paths: PipelinePaths;
  readonly ingest: IngestPaths;
  readonly log?: (line: string) => void;
  /** only jobs whose id starts with one of these */
  readonly only?: readonly string[];
  /** also write CREDITS.md + public/audio/CREDITS.txt (default true) */
  readonly credits?: boolean;
}

export interface IngestReport {
  readonly ok: boolean;
  readonly sourcesFile: string;
  readonly sourcesExist: boolean;
  readonly entries: number;
  readonly problems: readonly string[];
  readonly coverage: Coverage;
  readonly ingested: readonly string[];
  readonly cached: readonly string[];
  readonly missing: readonly { readonly id: string; readonly file: string }[];
  /** derived jobs whose base / sibling source is missing */
  readonly blocked: readonly string[];
  readonly failed: readonly { readonly id: string; readonly reason: string }[];
  /** themes re-timed to their track's declared bpm/bars */
  readonly overrides: Readonly<Record<string, { readonly bpm: number; readonly bars: number }>>;
  /** jobId → atempo ratio applied (themes only, ≠ 1) */
  readonly stretched: Readonly<Record<string, number>>;
}

export interface IngestResult {
  readonly report: IngestReport;
  readonly resolution: Cc0Resolution;
}

/** Load sources.json and resolve it against the manifest (no ffmpeg; `plan`/`process --provider cc0` use this). */
export function prepareCc0(manifest: AudioSourceManifest, ingest: Pick<IngestPaths, 'sources' | 'cc0Dir'>): Cc0Resolution {
  const sources: LoadedSources = loadSources(ingest.sources, manifest);
  return resolveCc0(manifest, sources, ingest.cc0Dir);
}

export async function runIngest(opts: IngestOptions): Promise<IngestResult> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const ff = checkFfmpeg();
  if (!ff.ok) throw new FfmpegMissingError(ff.reason);
  const { paths, ingest } = opts;
  const res = prepareCc0(opts.manifest, ingest);
  const m = res.manifest;
  const jobs = expandJobs(m, CC0_PROVIDER, paths.cache, {}, res.salts);
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const index = readCacheIndex(paths.cache);
  const records: Record<string, CacheRecord> = { ...index.jobs };
  const work = path.join(paths.cache, 'ingest-work');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const wanted = (id: string): boolean => opts.only === undefined || opts.only.length === 0 || opts.only.some((p) => id.startsWith(p));

  const ingested: string[] = [];
  const cached: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  const stretched: Record<string, number> = {};
  const missingIds = new Set(res.missing.map((x) => x.id));
  const blocked = res.classified.filter((c) => (c.role.kind === 'layer' || c.role.kind === 'variant') && missingIds.has(c.role.from)).map((c) => c.id);
  const ready = (id: string): boolean => res.salts[id] !== undefined && wanted(id);
  const sourceOf = (id: string): SourceEntry => {
    const c = res.classified.find((x) => x.id === id)!;
    return c.role.kind === 'direct' ? c.role.entry : sourceOf(c.role.kind === 'none' ? id : c.role.from);
  };
  const write = (job: PlannedJob, chs: readonly Float32Array[], src: Omit<CacheSource, 'file' | 'sha256'>, file: string): void => {
    mkdirSync(path.dirname(job.outWav), { recursive: true });
    writeFileSync(job.outWav, encodeWav({ sampleRate: INGEST_RATE, channels: chs }, 32));
    records[job.requestHash] = { id: job.id, kind: job.kind, provider: CC0_PROVIDER, bytes: statSync(job.outWav).size, source: { file, sha256: res.hashes[job.id]!, ...src } };
    ingested.push(job.id);
  };
  const save = (): void => writeCacheIndex(paths.cache, { version: 1, jobs: sortRecord(records) });
  const decode = async (e: SourceEntry, channels: number): Promise<Chans> => trimAndGain(await decodeToPcm(path.join(ingest.cc0Dir, e.file), INGEST_RATE, channels), INGEST_RATE, e);
  const safe = (id: string): string => id.replace(/[^a-z0-9_]/gi, '_');

  // ── themes: every directly mapped stem; a base also produces its derived layers ──
  for (const t of m.themes) {
    const target = themeTarget(t, res.sources.entries);
    const N = Math.round(((target.bars * 240) / target.bpm) * INGEST_RATE);
    for (const c of res.classified.filter((x) => x.id.startsWith(`themes/${t.id}/`) && x.role.kind === 'direct')) {
      if (!ready(c.id) || c.role.kind !== 'direct') continue;
      const job = byId.get(c.id)!;
      const isBase = job.meta.layer === 'base';
      const layers = isBase ? res.classified.filter((x) => x.role.kind === 'layer' && x.role.from === c.id && res.salts[x.id] !== undefined) : [];
      const group = [job, ...layers.map((x) => byId.get(x.id)!)];
      if (group.every((j) => isCached(j, index))) {
        cached.push(...group.map((j) => j.id));
        continue;
      }
      try {
        const e = c.role.entry;
        const region = await decode(e, 2);
        const { unit, ratio } = await conformLoop(region, N, work, safe(c.id));
        if (ratio !== 1) stretched[c.id] = Math.round(ratio * 1e6) / 1e6;
        const total = Math.round(job.prompt.durationSec * INGEST_RATE);
        const lead = Math.round(STEM_LEAD_SEC * INGEST_RATE);
        const base = stemFromUnit(unit, total, lead).chs;
        write(job, base, { role: 'direct' }, e.file);
        const baseRms = rms(base, lead, Math.min(total, lead + N));
        for (const lc of layers) {
          if (lc.role.kind !== 'layer') continue;
          const lj = byId.get(lc.id)!;
          const chs = await deriveLayer(unit, lc.role.layer, target.bpm, target.bars, total, lead, work, safe(lc.id));
          const r = rms(chs, lead, Math.min(total, lead + N));
          const g = r > 0 ? (baseRms * 10 ** (LAYER_RECIPES[lc.role.layer].relDb / 20)) / r : 0;
          write(lj, chs.map((ch) => ch.map((v) => Math.fround(v * g))), { role: 'layer', from: c.id }, e.file);
        }
        save();
        log(`  ingested ${c.id}${layers.length > 0 ? ` + ${layers.length} derived layer(s)` : ''}${ratio !== 1 ? ` (stretched ×${ratio.toFixed(4)})` : ''}`);
      } catch (err) {
        for (const j of group) failed.push({ id: j.id, reason: (err as Error).message });
        log(`  FAILED ${c.id}: ${(err as Error).message}`);
      }
    }
  }

  // ── ambience ──
  for (const a of m.ambience) {
    const id = `ambience/${a.biome}`;
    const c = res.classified.find((x) => x.id === id);
    if (c === undefined || c.role.kind !== 'direct' || !ready(id)) continue;
    const job = byId.get(id)!;
    if (isCached(job, index)) {
      cached.push(id);
      continue;
    }
    try {
      const chs = await decode(c.role.entry, 2);
      const n = chs[0]!.length;
      if (n < AMBIENCE_MIN_SEC * INGEST_RATE) throw new Error(`ambience source is ${(n / INGEST_RATE).toFixed(2)} s; needs ≥ ${AMBIENCE_MIN_SEC} s for the 2 s loop cross-fade`);
      const max = Math.round(a.prompt.durationSec * INGEST_RATE);
      write(job, n > max ? chs.map((ch) => ch.slice(0, max)) : chs, { role: 'direct' }, c.role.entry.file);
      save();
      log(`  ingested ${id}`);
    } catch (err) {
      failed.push({ id, reason: (err as Error).message });
      log(`  FAILED ${id}: ${(err as Error).message}`);
    }
  }

  // ── sfx + ui: direct clips first (kept in memory for their derived siblings), then variants ──
  const sfxAudio = new Map<string, Chans>();
  const sfxDirect = res.classified.filter((x) => (x.kind === 'sfx' || x.kind === 'ui') && x.role.kind === 'direct');
  const sfxVariants = res.classified.filter((x) => (x.kind === 'sfx' || x.kind === 'ui') && x.role.kind === 'variant');
  const directAudio = async (id: string): Promise<Chans> => {
    const hit = sfxAudio.get(id);
    if (hit !== undefined) return hit;
    const job = byId.get(id)!;
    const chs = fitSfx(await decode(sourceOf(id), 1), INGEST_RATE, job.prompt.durationSec);
    sfxAudio.set(id, chs);
    return chs;
  };
  for (const c of sfxDirect) {
    if (!ready(c.id) || c.role.kind !== 'direct') continue;
    const job = byId.get(c.id)!;
    if (isCached(job, index)) {
      cached.push(c.id);
      continue;
    }
    try {
      write(job, await directAudio(c.id), { role: 'direct' }, c.role.entry.file);
    } catch (err) {
      failed.push({ id: c.id, reason: (err as Error).message });
      log(`  FAILED ${c.id}: ${(err as Error).message}`);
    }
  }
  for (const c of sfxVariants) {
    if (!ready(c.id) || c.role.kind !== 'variant') continue;
    const job = byId.get(c.id)!;
    if (isCached(job, index)) {
      cached.push(c.id);
      continue;
    }
    try {
      const from = await directAudio(c.role.from);
      const shifted = await filterPcm(work, safe(c.id), from, `asetrate=${Math.round(INGEST_RATE * c.role.ratio)},aresample=${INGEST_RATE}`);
      write(job, fitSfx(shifted, INGEST_RATE, job.prompt.durationSec), { role: 'variant', from: c.role.from }, sourceOf(c.role.from).file);
    } catch (err) {
      failed.push({ id: c.id, reason: (err as Error).message });
      log(`  FAILED ${c.id}: ${(err as Error).message}`);
    }
  }
  save();
  rmSync(work, { recursive: true, force: true });

  const overrides: Record<string, { bpm: number; bars: number }> = {};
  for (const t of opts.manifest.themes) {
    const target = themeTarget(t, res.sources.entries);
    if (target.overridden) overrides[t.id] = { bpm: target.bpm, bars: target.bars };
  }
  const report: IngestReport = {
    ok: res.sources.problems.length === 0 && res.missing.length === 0 && failed.length === 0,
    sourcesFile: res.sources.file,
    sourcesExist: res.sources.exists,
    entries: Object.keys(res.sources.entries).length,
    problems: res.sources.problems,
    coverage: res.coverage,
    ingested: [...ingested].sort(),
    cached: [...cached].sort(),
    missing: res.missing,
    blocked: blocked.sort(),
    failed: failed.sort((a, b) => (a.id < b.id ? -1 : 1)),
    overrides,
    stretched: sortRecord(stretched),
  };
  writeJson(path.join(paths.qa, 'ingest-report.json'), report);
  logReport(report, log);
  if (opts.credits !== false) {
    const out = writeCredits(res.sources.entries, res.classified, ingest, paths.out);
    log(`  wrote ${out.markdown} and ${out.text}`);
  }
  return { report, resolution: res };
}

function logReport(r: IngestReport, log: (l: string) => void): void {
  const c = r.coverage;
  const pct = (x: number): string => `${(x * 100).toFixed(1)} %`;
  if (!r.sourcesExist) log(`audio-pipeline ingest: ${r.sourcesFile} does not exist — nothing mapped (write it from .design/audio/sources.candidates.md once the packs are downloaded)`);
  for (const p of r.problems) log(`  sources.json problem: ${p}`);
  for (const x of r.missing) log(`  MISSING ${x.id}: ${x.file} is not in the cc0 directory`);
  if (r.blocked.length > 0) log(`  ${r.blocked.length} derived job(s) blocked by a missing source (first: ${r.blocked.slice(0, 3).join(', ')})`);
  log(
    `audio-pipeline ingest: ${r.ingested.length} ingested, ${r.cached.length} cached, ${r.missing.length} missing, ${r.failed.length} failed; ` +
      `coverage ${c.covered}/${c.total} jobs (${pct(c.fraction)}): stems ${c.byKind.stem.direct}+${c.byKind.stem.derived} derived/${c.byKind.stem.total}, ` +
      `ambience ${c.byKind.ambience.direct}/${c.byKind.ambience.total}, sfx ${c.byKind.sfx.direct}+${c.byKind.sfx.derived}/${c.byKind.sfx.total}, ui ${c.byKind.ui.direct}+${c.byKind.ui.derived}/${c.byKind.ui.total}`,
  );
  if (c.covered < c.total) log(`  unmapped jobs fall back to placeholders with: process --provider cc0 --placeholders`);
}

function sortRecord<T>(r: Readonly<Record<string, T>>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of Object.keys(r).sort()) out[k] = r[k]!;
  return out;
}

