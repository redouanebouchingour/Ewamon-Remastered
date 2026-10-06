/**
 * SPEC §40.4.3–40.4.6 — `process`: every cached WAV → loop points → static-gain loudness normalisation →
 * Opus/WebM + AAC/M4A → `public/audio/manifest.json` (§20.7.4 shape) + `qa/process-report.json`.
 *
 * Per theme (all four layers together, because AudioDirector schedules them from one loop point):
 *   1. decode each layer to 48 kHz stereo float (ffmpeg's resampler — providers deliver 44.1 or 48 kHz)
 *   2. `findLoop` per layer (§40.4.4); reject a layer whose score < 0.6 or |L − nominal| > 1 %
 *   3. layers must agree on L within 5 ms; the base layer's (start, L) becomes the theme's loop
 *   4. nudge threat/biome/night towards base (`alignLag`, ± ⅛ beat) — independently generated layers do not
 *      share a downbeat — then bake a 10 ms seam cross-fade at loopEnd on every layer
 * Ambience: baked 2 s equal-power cross-fade loop. Sfx: lead-in trim, cap at the requested length, fade-out.
 * Loudness (§40.4.3): integrated LUFS by loudnorm's measuring pass, static gain to −16 (stems/ambience) or −20
 * (sfx/ui), true peak by ebur128 — a clip whose post-gain peak would exceed −1 / −3 dBTP is rejected and re-rolled
 * (seed + 1000) up to twice; after that (and always for placeholders) the gain is clamped to the ceiling and the
 * clip is flagged. Output bytes are deterministic (bitexact encoders, fixed parameters, sorted writes).
 *
 * Phase E4 (CC0 ingest): a cached WAV whose record names provider 'cc0' is a *fixed* source — it cannot be
 * re-rolled, so a loop or true-peak rejection is flagged (gain clamped) instead of queued. A stem layer the ingest
 * derived from its theme's base track is already sample-aligned (no `alignLag`) and takes the base layer's static
 * gain, so the level relations the ingest set between the layers survive; the theme lists such layers in the output
 * manifest's optional `derived` field.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { AUDIO_BUDGET_BYTES, AMBIENCE_FADE_SEC, STEM_HEAD_SEC, STEM_TAIL_SEC, measureBytes } from './budget.js';
import type { EncodeProfile } from './ffmpeg.js';
import { FFMPEG_MISSING_MESSAGE, checkFfmpeg, decodeToPcm, encodeM4a, encodeWebm, measureLoudness, opusPreSkip } from './ffmpeg.js';
import type { JobSalts, PlannedJob, Rerolls } from './jobs.js';
import { MAX_REROLLS, expandJobs, isCached, readCacheIndex, readRerolls, writeRerolls } from './jobs.js';
import { sha256Bytes, writeJson } from './json.js';
import { alignLag, bakeCrossfadeLoop, bakeSeamCrossfade, findLoop, shiftChannels, trimSfx } from './loop.js';
import type { AudioManifest, ProcessedClip } from './output-manifest.js';
import { assembleManifest, writeManifest } from './output-manifest.js';
import type { PipelinePaths } from './paths.js';
import { synthesizePlaceholder } from './placeholder.js';
import type { AudioSourceManifest, StemLayer, ThemeSpec } from './schema.js';
import { STEM_LAYERS } from './schema.js';
import type { PcmAudio } from './wav.js';
import { encodeWav, frames, mixdown } from './wav.js';

export const SAMPLE_RATE = 48000;
export const TARGET_LUFS = { stem: -16, ambience: -16, sfx: -20, ui: -20 } as const;
export const TP_CEILING = { stem: -1, ambience: -1, sfx: -3, ui: -3 } as const;
/** §40.4.4: stems of one theme agree on L within 5 ms. */
export const LAYER_AGREE_SEC = 0.005;
export const SEAM_FADE_SEC = 0.01;
/**
 * Layers are aligned to base within ± ⅛ beat (a 32nd note): enough to remove a flam between independently generated
 * layers, too little to drag an intentionally off-beat or syncopated layer onto the beat. Larger offsets (a whole or
 * half beat) are invisible to onset correlation and are a QA listening item (bible §3.4).
 */
export const ALIGN_MAX_BEATS = 0.125;

export class FfmpegMissingError extends Error {
  constructor(reason: string | null) {
    super(`${FFMPEG_MISSING_MESSAGE}${reason !== null && reason !== 'ffmpeg/ffprobe not found on PATH' ? ` [${reason}]` : ''}`);
    this.name = 'FfmpegMissingError';
  }
}

export interface ProcessOptions {
  readonly manifest: AudioSourceManifest;
  readonly providerName: string;
  readonly paths: PipelinePaths;
  /** synthesize a placeholder for every job without a cached WAV (bible §10) */
  readonly placeholders?: boolean;
  /** injectable for tests; defaults to now */
  readonly builtAt?: string;
  readonly jobs?: number;
  readonly log?: (line: string) => void;
  /** prefix of every clip url; the client fetches urls as written and loads the manifest from /audio/ */
  readonly urlBase?: string;
  /** Phase E4: per-job source salts (provider 'cc0', from `resolveCc0`) so the salted cache hashes match */
  readonly salts?: JobSalts;
}

/** Where `public/audio/` is served from (`packages/client/src/audio/manifest.ts` AUDIO_MANIFEST_URL = '/audio/manifest.json'). */
export const DEFAULT_URL_BASE = '/audio/';

export interface Rejection {
  readonly id: string;
  readonly reason: string;
  readonly attempt: number;
}

export interface ProcessReport {
  readonly ok: boolean;
  readonly clips: number;
  readonly placeholders: readonly string[];
  readonly rejected: readonly Rejection[];
  readonly flagged: readonly { readonly id: string; readonly reason: string }[];
  readonly themes: Readonly<Record<string, { readonly loopStartSec: number; readonly loopSec: number; readonly nominalSec: number; readonly scores: Readonly<Record<StemLayer, number>>; readonly align: Readonly<Record<StemLayer, number>> }>>;
  readonly bytes: { readonly webm: number; readonly m4a: number; readonly total: number; readonly budget: number };
}

export interface ProcessResult {
  readonly report: ProcessReport;
  readonly manifest: AudioManifest | null;
}

interface Source {
  readonly job: PlannedJob;
  readonly wav: string;
  readonly placeholder: boolean;
  /** a CC0 file (or derived from one): no re-roll exists */
  readonly fixed: boolean;
  /** a theme layer derived from the theme's base track by the ingest */
  readonly derived: boolean;
}

/** A rejected clip is re-rolled only when it is provider-generated and has re-rolls left. */
function rerollable(src: Source): boolean {
  return !src.placeholder && !src.fixed && src.job.meta.attempt < MAX_REROLLS;
}

async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

const round = (x: number, d: number): number => Math.round(x * 10 ** d) / 10 ** d;

/** Static-gain normalisation of one clip (§40.4.3). Writes the gained float WAV to `outWav`. */
export async function normaliseClip(
  audio: PcmAudio,
  kind: keyof typeof TARGET_LUFS,
  workWav: string,
  outWav: string,
  clampOnOvershoot: boolean,
  /** Phase E4: apply this gain instead of the measured one (a derived layer takes its base layer's gain) */
  fixedGainDb?: number,
): Promise<{ gainDb: number; lufs: number; truePeakDb: number; overshoot: boolean; clamped: boolean }> {
  writeFileSync(workWav, encodeWav(audio, 32));
  const target = TARGET_LUFS[kind];
  const ceiling = TP_CEILING[kind];
  const pre = await measureLoudness(workWav, target);
  if (!Number.isFinite(pre.integrated) && fixedGainDb === undefined) throw new Error(`audio-pipeline: ${path.basename(outWav)} measures as silence`);
  let gainDb = fixedGainDb ?? target - pre.integrated;
  const overshoot = pre.truePeak + gainDb > ceiling;
  let clamped = false;
  if (overshoot) {
    if (!clampOnOvershoot) return { gainDb, lufs: NaN, truePeakDb: pre.truePeak + gainDb, overshoot, clamped };
    gainDb = ceiling - pre.truePeak;
    clamped = true;
  }
  const g = Math.fround(10 ** (gainDb / 20));
  const gained: PcmAudio = { sampleRate: audio.sampleRate, channels: audio.channels.map((ch) => ch.map((v) => Math.fround(v * g))) };
  writeFileSync(outWav, encodeWav(gained, 32));
  const post = await measureLoudness(outWav, target);
  return { gainDb: round(gainDb, 3), lufs: round(post.integrated, 2), truePeakDb: round(post.truePeak, 2), overshoot, clamped };
}

/**
 * §40.4.5 shifts loop points by the Opus pre-skip. Measured in Chrome (Phase E4, headless, the shipped webm files):
 * `decodeAudioData` already trims the pre-skip (a 60 s bed decodes to exactly 2 880 000 frames), so the shifted
 * loopEnd fell 6.5 ms past the buffer end on every bed. WebM `CodecDelay` is honoured by Chrome and Firefox and the
 * m4a fallback has no shift, so loop points are written unshifted (IMPLEMENTATION-NOTES D14).
 */
export const LOOP_POINTS_INCLUDE_PRESKIP = false;

async function encodeClip(finalWav: string, outDir: string, relBase: string, profile: EncodeProfile, urlBase: string): Promise<{ webmBytes: Uint8Array; hash: string; url: string; urlFallback: string; preSkip: number }> {
  const webm = path.join(outDir, `${relBase}.webm`);
  const m4a = path.join(outDir, `${relBase}.m4a`);
  mkdirSync(path.dirname(webm), { recursive: true });
  await encodeWebm(finalWav, webm, profile);
  await encodeM4a(finalWav, m4a, profile);
  const webmBytes = readFileSync(webm);
  const hash = sha256Bytes(webmBytes);
  const v = hash.slice(0, 8);
  const preSkip = profile === 'sfx' ? 0 : await opusPreSkip(webm);
  return { webmBytes, hash, url: `${urlBase}${relBase}.webm?v=${v}`, urlFallback: `${urlBase}${relBase}.m4a?v=${v}`, preSkip };
}

function cleanOutputs(outDir: string): void {
  for (const sub of ['themes', 'ambience', 'sfx']) {
    const d = path.join(outDir, sub);
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
}

export async function runProcess(opts: ProcessOptions): Promise<ProcessResult> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const ff = checkFfmpeg();
  if (!ff.ok) throw new FfmpegMissingError(ff.reason);
  const { manifest, paths } = opts;
  const urlBase = opts.urlBase ?? DEFAULT_URL_BASE;
  const rerolls: Record<string, number> = { ...readRerolls(paths.cache) };
  const jobs = expandJobs(manifest, opts.providerName, paths.cache, rerolls as Rerolls, opts.salts);
  const index = readCacheIndex(paths.cache);

  // ── resolve a WAV per job ──
  const sources = new Map<string, Source>();
  const missing: string[] = [];
  for (const job of jobs) {
    if (isCached(job, index)) {
      const rec = index.jobs[job.requestHash];
      sources.set(job.id, { job, wav: job.outWav, placeholder: false, fixed: rec?.source !== undefined || rec?.provider === 'cc0', derived: rec?.source?.role === 'layer' });
    } else if (opts.placeholders === true) {
      const f = path.join(paths.cache, 'placeholder', `${job.requestHash}.wav`);
      if (!existsSync(f)) {
        mkdirSync(path.dirname(f), { recursive: true });
        writeFileSync(f, encodeWav(synthesizePlaceholder(job), 32));
      }
      sources.set(job.id, { job, wav: f, placeholder: true, fixed: false, derived: false });
    } else missing.push(job.id);
  }
  if (missing.length > 0) {
    throw new Error(`audio-pipeline: ${missing.length} job(s) have no generated WAV (first: ${missing.slice(0, 5).join(', ')}); run generate, or process --placeholders`);
  }

  const work = path.join(paths.cache, 'work');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  cleanOutputs(paths.out);
  const limit = opts.jobs ?? Math.max(1, Math.min(8, availableParallelism() - 1));
  const clips = new Map<string, ProcessedClip>();
  const rejected: Rejection[] = [];
  const flagged: { id: string; reason: string }[] = [];
  const themeReport: Record<string, ProcessReport['themes'][string]> = {};
  const themeDerived: Record<string, StemLayer[]> = {};
  const reject = (src: Source, reason: string): void => {
    const attempt = src.job.meta.attempt;
    if (!rerollable(src)) {
      flagged.push({ id: src.job.id, reason: `${reason} (accepted after ${attempt} re-roll(s)${src.placeholder ? ', placeholder' : ''}${src.fixed ? ', fixed CC0 source' : ''})` });
      return;
    }
    rejected.push({ id: src.job.id, reason, attempt });
    rerolls[src.job.id] = attempt + 1;
  };
  const safe = (id: string): string => id.replace(/[^a-z0-9_]/gi, '_');

  // ── themes ──
  await mapPool(manifest.themes, Math.max(1, Math.floor(limit / 2)), async (t: ThemeSpec) => {
    const srcs = STEM_LAYERS.map((layer) => sources.get(`themes/${t.id}/${layer}`)!);
    const decoded = await Promise.all(srcs.map((s) => decodeToPcm(s.wav, SAMPLE_RATE, 2)));
    const monos = decoded.map((chs) => mixdown({ sampleRate: SAMPLE_RATE, channels: chs }));
    const loops = monos.map((m) => findLoop(m, SAMPLE_RATE, { bpm: t.bpm, bars: t.bars }));
    let fail = false;
    loops.forEach((l, i) => {
      if (!l.ok) {
        const src = srcs[i]!;
        if (rerollable(src)) fail = true;
        reject(src, `loop: ${l.reason ?? 'rejected'}`);
      }
    });
    const base = loops[0]!;
    loops.forEach((l, i) => {
      if (i > 0 && Math.abs(l.lengthSec - base.lengthSec) > LAYER_AGREE_SEC) {
        const src = srcs[i]!;
        if (rerollable(src)) fail = true;
        reject(src, `loop: L ${l.lengthSec.toFixed(4)} s disagrees with base ${base.lengthSec.toFixed(4)} s by > 5 ms`);
      }
    });
    if (fail) return;
    const beatSec = 60 / t.bpm;
    // keep only STEM_HEAD_SEC before the loop start: the head is heard once, the budget pays for it 68 times
    const drop = Math.max(0, base.startSample - Math.round(STEM_HEAD_SEC * SAMPLE_RATE));
    const start = base.startSample - drop;
    const end = base.endSample - drop;
    const scores = {} as Record<StemLayer, number>;
    const align = {} as Record<StemLayer, number>;
    const finals: PcmAudio[] = [];
    for (let i = 0; i < STEM_LAYERS.length; i++) {
      const layer = STEM_LAYERS[i]!;
      let chs = decoded[i]!;
      let lag = 0;
      if (i > 0 && !srcs[i]!.derived) {
        const maxLag = ALIGN_MAX_BEATS * beatSec;
        const a = alignLag(monos[0]!, monos[i]!, SAMPLE_RATE, base.startSec, base.lengthSec, maxLag);
        lag = a.lagSamples;
        // a best shift on the window edge means the real offset is probably larger than ⅛ beat
        if (Math.abs(lag) >= Math.round((maxLag - 0.002) * SAMPLE_RATE)) {
          flagged.push({ id: srcs[i]!.job.id, reason: `phase alignment hit the ±⅛-beat limit (${(lag / SAMPLE_RATE).toFixed(3)} s); listen for a flam or a beat offset` });
        }
        chs = shiftChannels(chs, lag);
      }
      if (drop > 0) chs = chs.map((c) => c.subarray(drop));
      scores[layer] = round(loops[i]!.score, 3);
      align[layer] = round(lag / SAMPLE_RATE, 4);
      const need = end + Math.round(STEM_TAIL_SEC * SAMPLE_RATE);
      chs = chs.map((c) => {
        if (c.length >= need) return c;
        const padded = new Float32Array(need);
        padded.set(c);
        return padded;
      });
      const seamed = bakeSeamCrossfade(chs, start, end, Math.round(SEAM_FADE_SEC * SAMPLE_RATE));
      // keep a short tail after loopEnd (never played, guards the decoder's last frame)
      const tail = chs.map((c, k) => {
        const out = new Float32Array(need);
        out.set(seamed[k]!);
        out.set(c.subarray(end, need), end);
        return out;
      });
      finals.push({ sampleRate: SAMPLE_RATE, channels: tail });
    }
    const finish = async (i: number, fixedGainDb?: number): Promise<number | null> => {
        const audio = finals[i]!;
        const src = srcs[i]!;
        const layer = STEM_LAYERS[i]!;
        const w = path.join(work, `${safe(src.job.id)}.pre.wav`);
        const f = path.join(work, `${safe(src.job.id)}.wav`);
        const n = await normaliseClip(audio, 'stem', w, f, !rerollable(src), fixedGainDb);
        if (n.overshoot && !n.clamped) {
          reject(src, `true peak ${n.truePeakDb.toFixed(2)} dBTP after gain > ${TP_CEILING.stem}`);
          return null;
        }
        if (n.clamped) flagged.push({ id: src.job.id, reason: `gain clamped to the ${TP_CEILING.stem} dBTP ceiling; lufs ${n.lufs}` });
        const enc = await encodeClip(f, paths.out, `themes/${t.id}/${layer}`, 'stem', urlBase);
        const shift = LOOP_POINTS_INCLUDE_PRESKIP ? enc.preSkip / SAMPLE_RATE : 0;
        clips.set(src.job.id, {
          id: src.job.id,
          ref: { url: enc.url, urlFallback: enc.urlFallback, durationSec: round(frames(audio) / SAMPLE_RATE, 3), bytes: enc.webmBytes.byteLength, hash: enc.hash },
          loop: { loopStartSec: round(start / SAMPLE_RATE + shift, 6), loopEndSec: round(end / SAMPLE_RATE + shift, 6), lufs: n.lufs },
        });
        return n.gainDb;
    };
    const derived = STEM_LAYERS.filter((_, i) => srcs[i]!.derived);
    if (derived.length === 0) {
      await Promise.all(finals.map((_, i) => finish(i)));
    } else {
      // derived layers share the base layer's static gain (their level under base was set by the ingest)
      const baseGain = await finish(0);
      await Promise.all(finals.map((_, i) => (i === 0 ? null : finish(i, srcs[i]!.derived && baseGain !== null ? baseGain : undefined))));
      themeDerived[t.id] = derived;
    }
    themeReport[t.id] = { loopStartSec: round(base.startSec, 6), loopSec: round(base.lengthSec, 6), nominalSec: round(base.nominalSec, 6), scores, align };
  });

  // ── ambience ──
  await mapPool(manifest.ambience, limit, async (a) => {
    const src = sources.get(`ambience/${a.biome}`)!;
    const chs = await decodeToPcm(src.wav, SAMPLE_RATE, 2);
    const looped = bakeCrossfadeLoop(chs, Math.round(AMBIENCE_FADE_SEC * SAMPLE_RATE));
    const audio: PcmAudio = { sampleRate: SAMPLE_RATE, channels: looped };
    const w = path.join(work, `${safe(src.job.id)}.pre.wav`);
    const f = path.join(work, `${safe(src.job.id)}.wav`);
    const n = await normaliseClip(audio, 'ambience', w, f, !rerollable(src));
    if (n.overshoot && !n.clamped) {
      reject(src, `true peak ${n.truePeakDb.toFixed(2)} dBTP after gain > ${TP_CEILING.ambience}`);
      return;
    }
    if (n.clamped) flagged.push({ id: src.job.id, reason: `gain clamped to the ${TP_CEILING.ambience} dBTP ceiling; lufs ${n.lufs}` });
    const enc = await encodeClip(f, paths.out, `ambience/${a.biome}`, 'ambience', urlBase);
    const shift = LOOP_POINTS_INCLUDE_PRESKIP ? enc.preSkip / SAMPLE_RATE : 0;
    const len = frames(audio) / SAMPLE_RATE;
    clips.set(src.job.id, {
      id: src.job.id,
      ref: { url: enc.url, urlFallback: enc.urlFallback, durationSec: round(len, 3), bytes: enc.webmBytes.byteLength, hash: enc.hash },
      loop: { loopStartSec: round(shift, 6), loopEndSec: round(len + shift, 6), lufs: n.lufs },
    });
  });

  // ── sfx + ui ──
  const sfxJobs = jobs.filter((j) => j.kind === 'sfx' || j.kind === 'ui');
  await mapPool(sfxJobs, limit, async (job) => {
    const src = sources.get(job.id)!;
    const chs = await decodeToPcm(src.wav, SAMPLE_RATE, 1);
    const audio: PcmAudio = { sampleRate: SAMPLE_RATE, channels: trimSfx(chs, SAMPLE_RATE, job.prompt.durationSec) };
    const kind = job.kind === 'ui' ? 'ui' : 'sfx';
    const w = path.join(work, `${safe(job.id)}.pre.wav`);
    const f = path.join(work, `${safe(job.id)}.wav`);
    const n = await normaliseClip(audio, kind, w, f, !rerollable(src));
    if (n.overshoot && !n.clamped) {
      reject(src, `true peak ${n.truePeakDb.toFixed(2)} dBTP after gain > ${TP_CEILING[kind]}`);
      return;
    }
    if (n.clamped && !src.placeholder) flagged.push({ id: job.id, reason: `gain clamped to the ${TP_CEILING[kind]} dBTP ceiling; lufs ${n.lufs}` });
    const enc = await encodeClip(f, paths.out, job.id, 'sfx', urlBase);
    clips.set(job.id, { id: job.id, ref: { url: enc.url, urlFallback: enc.urlFallback, durationSec: round(frames(audio) / SAMPLE_RATE, 3), bytes: enc.webmBytes.byteLength, hash: enc.hash }, loop: null });
  });

  rmSync(work, { recursive: true, force: true });
  writeRerolls(paths.cache, sortRecord(rerolls));
  const bytes = measureBytes(paths.out);
  const sortedRejected = [...rejected].sort((a, b) => (a.id < b.id ? -1 : 1));
  const sortedFlagged = [...flagged].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.reason < b.reason ? -1 : 1));
  const placeholders = [...sources.values()].filter((s) => s.placeholder).map((s) => s.job.id).sort();
  let manifestOut: AudioManifest | null = null;
  const complete = sortedRejected.length === 0 && clips.size === jobs.length;
  if (complete) {
    manifestOut = assembleManifest(manifest, clips, opts.builtAt ?? new Date().toISOString(), themeDerived);
    writeManifest(path.join(paths.out, 'manifest.json'), manifestOut);
  }
  const report: ProcessReport = {
    ok: complete && bytes.total <= AUDIO_BUDGET_BYTES,
    clips: clips.size,
    placeholders,
    rejected: sortedRejected,
    flagged: sortedFlagged,
    themes: sortRecord(themeReport),
    bytes: { webm: bytes.webm, m4a: bytes.m4a, total: bytes.total, budget: AUDIO_BUDGET_BYTES },
  };
  writeJson(path.join(paths.qa, 'process-report.json'), report);
  log(
    `audio-pipeline: processed ${clips.size}/${jobs.length} clips (${placeholders.length} placeholder), ${sortedRejected.length} rejected for re-roll, ${sortedFlagged.length} flagged; ` +
      `${(bytes.total / 1048576).toFixed(2)} MiB of ${(AUDIO_BUDGET_BYTES / 1048576).toFixed(0)} MiB`,
  );
  if (!complete) log(`audio-pipeline: manifest not written — ${sortedRejected.length} clip(s) await re-roll; run generate then process again`);
  return { report, manifest: manifestOut };
}

function sortRecord<T>(r: Readonly<Record<string, T>>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of Object.keys(r).sort()) out[k] = r[k]!;
  return out;
}

/** Every file under `dir`, relative, sorted — for the determinism test. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string, prefix: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p, `${prefix}${name}/`);
      else out.push(`${prefix}${name}`);
    }
  };
  if (existsSync(dir)) walk(dir, '');
  return out;
}
