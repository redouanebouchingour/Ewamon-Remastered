/**
 * Placeholder audio (`.design/audio-bible.md` §10): deterministic TypeScript synthesis of every job, so `process
 * --placeholders` can build a complete, valid `public/audio/` before a provider key exists. Placeholders obey the
 * same contract as generated audio — stems are exact `bars × 4` beat grids at the theme's bpm and key and repeat
 * after the loop length (so the autocorrelation finder locks onto them), beds are noise textures, sfx are short
 * families of blips/bursts/chirps — and are marked `placeholder: true` in `qa/process-report.json`.
 * Seeded from the job's requestHash (§40.0.2 rule 1: no Math.random).
 */
import type { PlannedJob } from './jobs.js';
import type { PcmAudio } from './wav.js';

export const PLACEHOLDER_RATE = 48000;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOTE: Readonly<Record<string, number>> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const MODES: Readonly<Record<string, readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

/** 'D major' → { root: 2, scale }. Unknown modes (e.g. 'E open fifth') fall back to a root–fifth–octave set. */
export function parseKey(key: string | undefined): { root: number; scale: readonly number[] } {
  const m = /^([A-G](?:#|b)?)\s*(\w+)?/.exec((key ?? 'C major').trim());
  const root = NOTE[m?.[1] ?? 'C'] ?? 0;
  const scale = MODES[(m?.[2] ?? 'major').toLowerCase()] ?? [0, 7, 12];
  return { root, scale };
}

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

function seedOf(job: PlannedJob): number {
  return Number.parseInt(job.requestHash.slice(0, 8), 16) >>> 0;
}

/** Add a decaying partial-sum tone into `out` (mono) starting at sample `at`. */
function tone(out: Float32Array, at: number, freq: number, amp: number, decaySec: number, sr: number, harmonics: readonly number[] = [1], lenSec = decaySec * 4): void {
  const n = Math.min(out.length - at, Math.round(lenSec * sr));
  const atk = Math.round(0.005 * sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = (i < atk ? i / atk : 1) * Math.exp(-t / decaySec);
    let v = 0;
    for (let h = 0; h < harmonics.length; h++) v += harmonics[h]! * Math.sin(2 * Math.PI * freq * (h + 1) * t);
    out[at + i]! += amp * env * v;
  }
}

function noiseBurst(out: Float32Array, at: number, amp: number, decaySec: number, sr: number, rnd: () => number, lowpass = 0.2): void {
  const n = Math.min(out.length - at, Math.round(decaySec * 5 * sr));
  let y = 0;
  for (let i = 0; i < n; i++) {
    y += lowpass * (rnd() * 2 - 1 - y);
    out[at + i]! += amp * Math.exp(-i / sr / decaySec) * y * 3;
  }
}

function stereo(mono: Float32Array, width: number): Float32Array[] {
  const l = new Float32Array(mono.length);
  const r = new Float32Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    l[i] = Math.fround(mono[i]! * (1 - width));
    r[i] = Math.fround(mono[i]! * (1 + width) * 0.98);
  }
  return [l, r];
}

function stem(job: PlannedJob, sr: number): PcmAudio {
  const bpm = job.prompt.bpm ?? 120;
  const beat = 60 / bpm;
  const total = Math.round(job.prompt.durationSec * sr);
  const loopBeats = (job.meta.bars ?? 16) * 4;
  const { root, scale } = parseKey(job.prompt.key);
  const rnd = mulberry32(seedOf(job));
  // one velocity/pitch table for the loop, replayed after it so the audio is periodic by construction
  const vel = Array.from({ length: loopBeats * 2 }, () => 0.45 + 0.55 * rnd());
  const deg = Array.from({ length: loopBeats * 2 }, () => Math.floor(rnd() * scale.length));
  const out = new Float32Array(total);
  const layer = job.meta.layer ?? 'base';
  const lead = 0.1; // first downbeat at 0.1 s, inside the finder's [0.25, 1.0] start window after the first beat
  const prog = [0, 5, 3, 4];
  for (let b = 0; lead + b * beat < job.prompt.durationSec; b++) {
    const i = b % loopBeats;
    const at = Math.round((lead + b * beat) * sr);
    const bar = Math.floor(i / 4);
    const chordDeg = prog[bar % prog.length]!;
    const pick = (d: number, oct: number): number => {
      const s = scale[(chordDeg + d) % scale.length]!;
      const wrap = Math.floor((chordDeg + d) / scale.length) * 12;
      return root + s + wrap + 12 * oct;
    };
    const v = vel[i]!;
    if (layer === 'base') {
      for (const d of [0, 2, 4]) tone(out, at, hz(pick(d, 4)), 0.05 * v, beat * 0.6, sr, [1, 0.3]);
      if (i % 4 === 0 || i % 4 === 2) tone(out, at, hz(pick(0, 2)), 0.16 * v, beat * 0.9, sr, [1, 0.5]);
    } else if (layer === 'threat') {
      noiseBurst(out, at, 0.12 * v, 0.03, sr, rnd, 0.15);
      tone(out, at, 55, 0.25 * v, 0.12, sr);
      tone(out, at + Math.round((beat / 2) * sr), hz(pick(0, 3)), 0.07 * vel[(i + 1) % loopBeats]!, beat * 0.25, sr, [1, 0.5, 0.25]);
    } else if (layer === 'biome') {
      tone(out, at, hz(root + scale[deg[i]!]! + 60), 0.12 * v, 0.3, sr, [1, 0.35]);
    } else {
      tone(out, at + Math.round((beat / 2) * sr), hz(root + scale[deg[i]!]! + 84), 0.06 * v, 0.5, sr, [1, 0.1]);
      if (i % 8 === 0) tone(out, at, hz(root + 48), 0.03, beat * 6, sr, [1, 0, 0.3], beat * 8);
    }
  }
  return { sampleRate: sr, channels: stereo(out, layer === 'night' ? 0.25 : 0.1) };
}

function ambience(job: PlannedJob, sr: number): PcmAudio {
  const n = Math.round(job.prompt.durationSec * sr);
  const rnd = mulberry32(seedOf(job));
  const { root } = parseKey(job.prompt.key);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  let yl = 0;
  let yr = 0;
  const f0 = hz(root + 36);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    yl += 0.02 * (rnd() * 2 - 1 - yl);
    yr += 0.02 * (rnd() * 2 - 1 - yr);
    const swell = 0.6 + 0.4 * Math.sin((2 * Math.PI * t) / 7.3);
    const drone = 0.03 * Math.sin(2 * Math.PI * f0 * t);
    l[i] = Math.fround(yl * 1.2 * swell + drone);
    r[i] = Math.fround(yr * 1.2 * swell + drone);
  }
  return { sampleRate: sr, channels: [l, r] };
}

function sfx(job: PlannedJob, sr: number): PcmAudio {
  const n = Math.max(1, Math.round(job.prompt.durationSec * sr));
  const out = new Float32Array(n);
  const rnd = mulberry32(seedOf(job));
  const id = job.meta.group;
  const pitch = 300 + (seedOf(job) % 900);
  if (id.startsWith('ui_stinger_')) {
    const { root, scale } = parseKey(job.prompt.key);
    const steps = 6;
    const dt = Math.min(0.25, (job.prompt.durationSec * 0.6) / steps);
    for (let k = 0; k < steps; k++) tone(out, Math.round((0.01 + k * dt) * sr), hz(root + 60 + scale[(k * 2) % scale.length]! + (k >= scale.length ? 12 : 0)), 0.2, 0.4, sr, [1, 0.3, 0.1]);
  } else if (id.startsWith('ui_')) {
    tone(out, 0, 900 + (pitch % 700), 0.3, 0.03, sr, [1, 0.2], Math.min(job.prompt.durationSec, 0.3));
  } else if (id.startsWith('step_')) {
    noiseBurst(out, 0, 0.5, 0.025, sr, rnd, 0.12 + 0.3 * rnd());
  } else if (id.startsWith('hit_') || id.startsWith('impact_') || id === 'faint') {
    noiseBurst(out, 0, 0.5, 0.06, sr, rnd, 0.3);
    tone(out, 0, 70 + (pitch % 60), 0.5, 0.12, sr);
  } else if (id.startsWith('cry_') || id.startsWith('hurt_')) {
    const len = Math.min(n, Math.round(job.prompt.durationSec * 0.8 * sr));
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const f = pitch * (1 + 0.25 * Math.sin(2 * Math.PI * 6 * t)) * (id.startsWith('hurt_') ? 1 - t : 1);
      out[i]! += 0.3 * Math.sin(2 * Math.PI * f * t) * Math.sin((Math.PI * i) / len);
    }
  } else {
    const len = Math.min(n, Math.round(job.prompt.durationSec * 0.9 * sr));
    let y = 0;
    for (let i = 0; i < len; i++) {
      y += (0.05 + (0.4 * i) / len) * (rnd() * 2 - 1 - y);
      out[i]! += 0.4 * y * Math.sin((Math.PI * i) / len);
    }
    tone(out, 0, pitch, 0.15, job.prompt.durationSec / 3, sr, [1, 0.5]);
  }
  return { sampleRate: sr, channels: [out] };
}

/** Synthesize the stand-in for one job at 48 kHz (stereo for stems/ambience, mono for sfx/ui). */
export function synthesizePlaceholder(job: PlannedJob, sr = PLACEHOLDER_RATE): PcmAudio {
  if (job.kind === 'stem') return stem(job, sr);
  if (job.kind === 'ambience') return ambience(job, sr);
  return sfx(job, sr);
}
