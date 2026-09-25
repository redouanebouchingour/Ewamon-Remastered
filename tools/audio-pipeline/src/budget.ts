/**
 * SPEC §40.4.7 / §40.6 — `public/audio/` ≤ 80 MB (83 886 080 B, Σ webm + Σ m4a). Two views:
 *   - `estimateBytes(manifest)`: what the manifest will cost once encoded, from nominal lengths and the
 *     §40.4.5 bitrates (conservative: CBR-equivalent at the target bitrate + container overhead). `plan` prints
 *     it and `budget.test.ts` asserts it, so an over-budget bible fails before a single credit is spent.
 *   - `measureBytes(outDir)`: the real directory, once `process` has run.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { EncodeProfile } from './ffmpeg.js';
import { ENCODE } from './ffmpeg.js';
import type { AudioSourceManifest } from './schema.js';
import { loopSec } from './schema.js';

export const AUDIO_BUDGET_BYTES = 83_886_080;
/** Ambience seam: the bed's last 2 s are cross-faded into its head (loop.ts `bakeCrossfadeLoop`). */
export const AMBIENCE_FADE_SEC = 2;
/** Stems keep 50 ms of head before loopStart (room for the 10 ms seam fade) and 20 ms after loopEnd. */
export const STEM_HEAD_SEC = 0.05;
export const STEM_TAIL_SEC = 0.02;

/** measured on placeholder output: constrained-VBR Opus lands at +3.5 % over target incl. WebM framing; AAC +2 % */
const OVERHEAD = { webm: 1.04, m4a: 1.02 } as const;
const HEADER = { webm: 700, m4a: 1600 } as const;

export function clipBytes(profile: EncodeProfile, sec: number): { webm: number; m4a: number } {
  const p = ENCODE[profile];
  return {
    webm: Math.ceil(sec * p.opusKbps * 125 * OVERHEAD.webm + HEADER.webm),
    m4a: Math.ceil(sec * p.aacKbps * 125 * OVERHEAD.m4a + HEADER.m4a),
  };
}

export interface ByteEstimate {
  readonly stems: number;
  readonly ambience: number;
  readonly sfx: number;
  readonly webm: number;
  readonly m4a: number;
  readonly total: number;
  readonly budget: number;
  readonly seconds: { readonly stems: number; readonly ambience: number; readonly sfx: number };
}

export function encodedStemSec(bars: number, bpm: number): number {
  return loopSec(bars, bpm) + STEM_HEAD_SEC + STEM_TAIL_SEC;
}

export function estimateBytes(m: AudioSourceManifest): ByteEstimate {
  let webm = 0;
  let m4a = 0;
  const add = (profile: EncodeProfile, sec: number): number => {
    const b = clipBytes(profile, sec);
    webm += b.webm;
    m4a += b.m4a;
    return b.webm + b.m4a;
  };
  let stems = 0;
  let stemSec = 0;
  for (const t of m.themes) {
    const sec = encodedStemSec(t.bars, t.bpm);
    for (let i = 0; i < 4; i++) {
      stems += add('stem', sec);
      stemSec += sec;
    }
  }
  let ambience = 0;
  let ambSec = 0;
  for (const a of m.ambience) {
    const sec = a.prompt.durationSec - AMBIENCE_FADE_SEC;
    ambience += add('ambience', sec);
    ambSec += sec;
  }
  let sfx = 0;
  let sfxSec = 0;
  for (const s of m.sfx) {
    for (let i = 0; i < s.variants; i++) {
      sfx += add('sfx', s.prompt.durationSec);
      sfxSec += s.prompt.durationSec;
    }
  }
  const r = (x: number): number => Math.round(x * 1000) / 1000;
  return { stems, ambience, sfx, webm, m4a, total: webm + m4a, budget: AUDIO_BUDGET_BYTES, seconds: { stems: r(stemSec), ambience: r(ambSec), sfx: r(sfxSec) } };
}

/** Σ bytes of every .webm and .m4a under `dir` (recursive). */
export function measureBytes(dir: string): { webm: number; m4a: number; total: number; files: number } {
  let webm = 0;
  let m4a = 0;
  let files = 0;
  const walk = (d: string): void => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d).sort()) {
      const p = path.join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.webm')) {
        webm += st.size;
        files++;
      } else if (name.endsWith('.m4a')) {
        m4a += st.size;
        files++;
      }
    }
  };
  walk(dir);
  return { webm, m4a, total: webm + m4a, files };
}
