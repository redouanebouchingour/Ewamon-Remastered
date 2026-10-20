/**
 * SPEC §20.7.2 — the mixer table, every value the engine ships. Pure numbers + the two pure curves the director
 * uses (night stem gain over timeOfDay, perceptual bus gain); asserted by audio.test.ts.
 */

export const dbToGain = (db: number): number => 10 ** (db / 20);

export const MIXER = {
  master: 1.0,
  compressor: { threshold: -12, knee: 6, ratio: 4, attack: 0.003, release: 0.25 },
  music: dbToGain(-6),   // 0.501
  sfx: dbToGain(-3),     // 0.708
  ui: dbToGain(-8),      // 0.398
  /** music while a dialogue or modal is open: −9 dB relative, 250 ms attack, 600 ms release, linear ramps */
  duck: { db: -9, attackMs: 250, releaseMs: 600 },
  /** world ↔ battle theme crossfade */
  battleSwapMs: 400,
  threatRampMs: 400,
  handoverCrossfadeMs: 400,
  /** harvested zone: every stem low-passed */
  harvestLowpass: { hz: 1200, q: 0.7 },
  /**
   * Music that follows the battle (`setBattleMood`): the player's active battler at or under `lowAt` of its max hp
   * thins the biome stem, at or under `criticalAt` drops it and thins the base under a louder threat; a Majin form
   * low-passes every stem at `majinLowpassHz` with the threat swelled, a Tenjin form swells the biome stem. Gains
   * are multipliers of the stem's usual level; every change ramps over `rampMs`.
   */
  battleMood: {
    lowAt: 0.5,
    criticalAt: 0.25,
    rampMs: 900,
    low: { biome: 0.45 },
    critical: { base: 0.55, biome: 0, threat: 1.2 },
    majin: { threat: 1.3, lowpassHz: 1400 },
    tenjin: { biome: 1.25 },
  },
  panner: { panningModel: 'HRTF' as PanningModelType, distanceModel: 'inverse' as DistanceModelType, refDistance: 4, maxDistance: 60, rolloffFactor: 1.5 },
  reverbSend: { outdoor: 0.12, plaza: 0.18, interior: 0.35, cave: 0.5 },
  /** algorithmic IR lengths (s): exponentially decaying white noise generated once at boot */
  irSeconds: { outdoor: 0.5, plaza: 0.5, interior: 1.2, cave: 2.4 },
  voices: 24,
  perIdCooldownMs: 40,
  perIdConcurrency: 4,
  uiSfxDb: { hover: 0, click: -14, error: -10, toast: -12 },
  ambienceDb: -12,
  /** stems are scheduled this far ahead of their loop point (two alternating sources, never loop = true) */
  scheduleAheadS: 0.2,
  /** all four stems of a theme start together at currentTime + this */
  startOffsetS: 0.05,
  /** document.hidden → music suspends after this (sfx already stop) */
  hiddenSuspendMs: 2000,
} as const;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Night stem gain = smoothstep(0.78, 0.82, t) · (1 − smoothstep(0.20, 0.24, t)), wrapping so night is [0.80, 0.22).
 * Written as the max of the two halves of the wrapped window (the literal product is 0 everywhere: the two factors
 * are never both non-zero on a single [0, 1) day), which is what "wrapping" asks for.
 */
export function nightGain(t01: number): number {
  const t = ((t01 % 1) + 1) % 1;
  const evening = smoothstep(0.78, 0.82, t);
  const morning = 1 - smoothstep(0.2, 0.24, t);
  return t >= 0.5 ? evening : morning;
}

/** Settings sliders are linear 0..1, applied as gain² (perceptual). */
export function perceptual(gain01: number): number {
  const g = Math.min(1, Math.max(0, gain01));
  return g * g;
}

/** The reverb kind of a zone: story zones are caves / shrines, towns have a plaza, routes are outdoor. */
export function reverbKindFor(kind: 'town' | 'route' | 'story', biome: string): 'outdoor' | 'plaza' | 'interior' | 'cave' {
  if (kind === 'story' || biome === 'shrine' || biome === 'rift') return 'cave';
  return kind === 'town' ? 'plaza' : 'outdoor';
}
