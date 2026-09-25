/** Synthetic audio + fixture manifests shared by the audio-pipeline tests. No network, no provider, no key. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mulberry32 } from '../src/placeholder.js';
import type { PipelinePaths } from '../src/paths.js';
import { DEFAULT_PATHS } from '../src/paths.js';
import type { AudioSourceManifest, SfxSpec, ValidateOptions } from '../src/schema.js';
import { stemDurationSec } from '../src/schema.js';

export const SR = 48000;

/**
 * §50.4.8 fixture: a click track, `bars` × 4 beats at `bpm`, generated `+2 s` long like a stem (§40.4.4).
 * Each click is a 25 ms 1 kHz burst with an exponential decay; the downbeat of each bar is accented; a −60 dBFS
 * seeded noise floor keeps the signal from being digitally silent between clicks.
 */
export function clickTrack(bpm: number, bars: number, firstClickSec = 0.3, extraSec = 2): Float32Array {
  const loop = (bars * 4 * 60) / bpm;
  const n = Math.round((loop + extraSec) * SR);
  const out = new Float32Array(n);
  const rnd = mulberry32(0xc11c);
  for (let i = 0; i < n; i++) out[i] = (rnd() * 2 - 1) * 0.001;
  const beat = 60 / bpm;
  const burst = Math.round(0.025 * SR);
  for (let b = 0; firstClickSec + b * beat < loop + extraSec; b++) {
    const at = Math.round((firstClickSec + b * beat) * SR);
    const amp = b % 4 === 0 ? 0.9 : 0.5;
    for (let k = 0; k < burst && at + k < n; k++) out[at + k]! += amp * Math.sin((2 * Math.PI * 1000 * k) / SR) * Math.exp(-k / (0.006 * SR));
  }
  return out;
}

export function tempPaths(prefix = 'ewa-audio-'): PipelinePaths & { root: string; cleanup(): void } {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  return {
    root,
    manifest: DEFAULT_PATHS.manifest,
    cache: path.join(root, 'cache'),
    qa: path.join(root, 'qa'),
    out: path.join(root, 'out'),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

const prompt = (text: string, seed: number, durationSec: number, extra: { bpm?: number; key?: string } = {}) => ({ text, seed, durationSec, instrumental: true as const, ...extra });

/** A one-theme / one-bed / three-clip manifest small enough for `process` to run in a test. */
export function tinyManifest(): AudioSourceManifest {
  const bpm = 200;
  const bars = 8 as const;
  const d = stemDurationSec(bars, bpm);
  const stem = (layer: string, seed: number) => prompt(`Fixture ${layer} layer for the test theme, a simple loop at ${bpm} BPM.`, seed, d, { bpm, key: 'D major' });
  const sfx = (id: string, bus: 'sfx' | 'ui', variants: 1 | 2, sec: number): SfxSpec => ({ id, bus, variants, prompt: prompt(`Fixture sound effect ${id} for the determinism test.`, 7, sec), gainDb: -6, maxConcurrent: 2 });
  return {
    version: 1,
    themes: [{ id: 'grove', bpm, bars, timeSig: 4, stems: { base: stem('base', 1), threat: stem('threat', 2), biome: stem('biome', 3), night: stem('night', 4) } }],
    ambience: [{ id: 'grove', biome: 'grove', prompt: prompt('Fixture ambience bed, a soft noise texture that loops.', 9, 30, { key: 'D major' }) }],
    sfx: [sfx('hit_normal', 'sfx', 2, 0.45), sfx('ui_click', 'ui', 1, 0.15)],
    zoneThemes: { mirevale: 'grove' },
  };
}

export const TINY_VALIDATE: ValidateOptions = {
  zoneIds: ['mirevale'],
  zoneBiomes: { mirevale: 'grove' },
  themeIds: ['grove'],
  biomes: ['grove'],
  requiredSfx: [],
};

/** Capture log lines. */
export function logSink(): { lines: string[]; log: (l: string) => void } {
  const lines: string[] = [];
  return { lines, log: (l: string) => void lines.push(l) };
}
