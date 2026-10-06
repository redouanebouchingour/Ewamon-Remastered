/**
 * SPEC §40.4.3 + §40.4.5 — every call into ffmpeg/ffprobe. ffmpeg is a checked prerequisite: `checkFfmpeg()`
 * runs `ffmpeg -version` and `ffprobe -version` and `process` refuses with `FFMPEG_MISSING_MESSAGE` otherwise.
 * Arguments are passed as arrays (`execFile`, no shell), so paths with spaces are safe on Windows.
 */
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export const FFMPEG_MISSING_MESSAGE = 'audio-pipeline: ffmpeg not found on PATH (need ≥ 6.0 with libopus and aac); install it and re-run';

export interface FfmpegInfo {
  readonly ok: boolean;
  readonly version: string | null;
  readonly major: number | null;
  readonly hasLibopus: boolean;
  readonly reason: string | null;
}

let cached: FfmpegInfo | null = null;

/** Synchronous so test files can decide `describe.skipIf` at collection time. Cached per process. */
export function checkFfmpeg(): FfmpegInfo {
  if (cached !== null) return cached;
  try {
    const v = execFileSync('ffmpeg', ['-hide_banner', '-version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    execFileSync('ffprobe', ['-hide_banner', '-version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    const m = /ffmpeg version (\S+)/.exec(v);
    const version = m?.[1] ?? null;
    const majorM = version !== null ? /^n?(\d+)/.exec(version) : null;
    const major = majorM ? Number(majorM[1]) : null;
    const hasLibopus = v.includes('--enable-libopus');
    let reason: string | null = null;
    if (!hasLibopus) reason = 'ffmpeg was built without libopus';
    else if (major !== null && major < 6) reason = `ffmpeg ${version ?? '?'} is older than 6.0`;
    cached = { ok: reason === null, version, major, hasLibopus, reason };
  } catch {
    cached = { ok: false, version: null, major: null, hasLibopus: false, reason: 'ffmpeg/ffprobe not found on PATH' };
  }
  return cached;
}

async function run(bin: 'ffmpeg' | 'ffprobe', args: readonly string[]): Promise<{ stdout: Buffer; stderr: string }> {
  try {
    const r = await execFileP(bin, args as string[], { encoding: 'buffer', maxBuffer: 1 << 30, windowsHide: true });
    return { stdout: r.stdout, stderr: r.stderr.toString('utf8') };
  } catch (err) {
    const e = err as { stderr?: Buffer; message?: string };
    const tail = e.stderr ? e.stderr.toString('utf8').split('\n').slice(-8).join('\n') : (e.message ?? String(err));
    throw new Error(`audio-pipeline: ${bin} failed (${args.slice(0, 6).join(' ')} …):\n${tail}`);
  }
}

/** Decode any input to planar float32 at `sampleRate` with `channels` channels (ffmpeg's resampler; deterministic). */
export async function decodeToPcm(file: string, sampleRate: number, channels: number): Promise<Float32Array[]> {
  const { stdout } = await run('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', String(channels), '-ar', String(sampleRate), 'pipe:1']);
  const n = Math.floor(stdout.byteLength / (4 * channels));
  const dv = new DataView(stdout.buffer, stdout.byteOffset, stdout.byteLength);
  const out = Array.from({ length: channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) out[c]![i] = dv.getFloat32((i * channels + c) * 4, true);
  return out;
}

export interface Loudness {
  /** integrated LUFS (ITU-R BS.1770-4), -Infinity for silence */
  readonly integrated: number;
  /** true peak, dBTP */
  readonly truePeak: number;
}

const num = (s: string | undefined): number => (s === undefined ? NaN : s.trim() === '-inf' ? -Infinity : s.trim() === 'inf' ? Infinity : Number(s));

/**
 * §40.4.3: integrated loudness from the `loudnorm` first pass (`print_format=json`), true peak from
 * `ebur128=peak=true`. Clips shorter than 1 s are measured with trailing silence padded to 1 s (`apad`), which
 * the BS.1770 gate ignores, so a 0.3 s footstep gets a defined integrated value.
 */
export async function measureLoudness(file: string, targetI = -16): Promise<Loudness> {
  const pad = 'apad=whole_dur=1';
  const ln = await run('ffmpeg', ['-hide_banner', '-nostdin', '-nostats', '-i', file, '-af', `${pad},loudnorm=I=${targetI}:TP=-1:LRA=11:print_format=json`, '-f', 'null', '-']);
  const json = /\{[\s\S]*?"input_i"[\s\S]*?\}/.exec(ln.stderr);
  if (!json) throw new Error(`audio-pipeline: loudnorm printed no JSON for ${file}`);
  const parsed = JSON.parse(json[0]) as Record<string, string>;
  const integrated = num(parsed.input_i);
  const eb = await run('ffmpeg', ['-hide_banner', '-nostdin', '-nostats', '-i', file, '-af', `${pad},ebur128=peak=true:framelog=quiet`, '-f', 'null', '-']);
  const tp = /True peak:\s*[\r\n]+\s*Peak:\s*(-?inf|-?[\d.]+)\s*dBFS/.exec(eb.stderr);
  const truePeak = tp ? num(tp[1]) : num(parsed.input_tp);
  return { integrated, truePeak };
}

/**
 * Run an ffmpeg audio filter graph over a WAV and write a float32 WAV at `sampleRate` / `channels` (Phase E4 ingest:
 * time-stretch, layer derivation, variant pitch shifts). Bitexact flags keep the bytes stable.
 */
export async function filterWav(inWav: string, outWav: string, af: string, sampleRate: number, channels: number): Promise<void> {
  await run('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-i', inWav, '-af', af, '-ar', String(sampleRate), '-ac', String(channels), '-c:a', 'pcm_f32le', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-map_metadata', '-1', '-f', 'wav', outWav]);
}

export type EncodeProfile = 'stem' | 'ambience' | 'sfx';

/**
 * §40.4.5 + §40.4.7 bitrates. Opus runs constrained VBR (the §40.4.5 table says `-vbr on`; unconstrained VBR measured
 * 123 kb/s on tonal material at a 96 k target, which the 80 MB budget cannot absorb — IMPLEMENTATION-NOTES D4).
 * `-fflags +bitexact -flags:a +bitexact` so the bytes are hash-stable.
 */
export const ENCODE: Readonly<Record<EncodeProfile, { readonly opusKbps: number; readonly aacKbps: number; readonly channels: 1 | 2 }>> = {
  stem: { opusKbps: 96, aacKbps: 112, channels: 2 },
  ambience: { opusKbps: 80, aacKbps: 96, channels: 2 },
  sfx: { opusKbps: 64, aacKbps: 80, channels: 1 },
};

const BITEXACT = ['-fflags', '+bitexact', '-flags:a', '+bitexact', '-map_metadata', '-1'];

export async function encodeWebm(inWav: string, outWebm: string, profile: EncodeProfile): Promise<void> {
  const p = ENCODE[profile];
  await run('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-i', inWav, '-ac', String(p.channels), '-c:a', 'libopus', '-b:a', `${p.opusKbps}k`, '-vbr', 'constrained', '-application', 'audio', '-frame_duration', '20', ...BITEXACT, '-f', 'webm', outWebm]);
}

export async function encodeM4a(inWav: string, outM4a: string, profile: EncodeProfile): Promise<void> {
  const p = ENCODE[profile];
  await run('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-i', inWav, '-ac', String(p.channels), '-c:a', 'aac', '-b:a', `${p.aacKbps}k`, '-movflags', '+faststart', ...BITEXACT, '-f', 'mp4', outM4a]);
}

/** Opus pre-skip in samples at 48 kHz, read back from the encoded file (§40.4.5). */
export async function opusPreSkip(webm: string): Promise<number> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=initial_padding', '-of', 'json', webm]);
  const parsed = JSON.parse(stdout.toString('utf8')) as { streams?: { initial_padding?: number }[] };
  return parsed.streams?.[0]?.initial_padding ?? 0;
}
