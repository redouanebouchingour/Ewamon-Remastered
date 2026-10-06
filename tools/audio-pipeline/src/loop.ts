/**
 * SPEC §40.4.4 — loop points by autocorrelation, pure TypeScript (no ffmpeg, no native code).
 *
 *   1. mono downmix; onset envelope e[n] = half-wave-rectified first difference of the RMS over 10 ms hops
 *   2. candidate loop lengths L = nominal ± 2 %, one hop apart
 *   3. for each L and each start s ∈ [0.25 s, 1.0 s]: r(s, L) = Σ e[s+k]·e[s+L+k] / √(Σe[s+k]²·Σe[s+L+k]²),
 *      k over min(2 bars, the audio that exists after s+L) — stems are generated 2 bars + 2 s past the loop so the
 *      full 2 bars exist; keep the maximum (ties → the L nearest nominal)
 *   4. refine the 5 best coarse L peaks (30 ms RMS window) to 1 ms with a 1 ms-hop envelope and keep
 *      the best refined score — the true loop and its ± 1-beat aliases are all peaks, and a 10 ms grid alone can
 *      rank an alias first; then snap s and s+L to the nearest zero crossing within ±2 ms
 *   5. reject when the peak score < 0.6 or |L − nominal| > 1 %
 *
 * Plus two seam tools `process` uses: `bakeSeamCrossfade` (stems: the last few ms before loopEnd fade into the
 * audio just before loopStart, so a common theme-wide loopEnd is click-free on every layer) and
 * `bakeCrossfadeLoop` (ambience: beds have no pulse, so the loop is made rather than found).
 */

export const HOP_SEC = 0.01;
export const FINE_HOP_SEC = 0.001;
export const START_MIN_SEC = 0.25;
export const START_MAX_SEC = 1.0;
export const SEARCH_FRAC = 0.02;
export const REJECT_SCORE = 0.6;
export const REJECT_LEN_FRAC = 0.01;
export const SNAP_SEC = 0.002;
/** Shortest comparison window step 3 accepts when the generated tail is short. */
export const MIN_WINDOW_SEC = 0.5;
/** Coarse RMS window: wider than the 10 ms hop so an onset that falls between hops still correlates with itself. */
export const COARSE_WIN_SEC = 0.03;
/** How many coarse loop-length candidates (local maxima) are refined at 1 ms before one is chosen. */
export const REFINE_CANDIDATES = 5;

export interface LoopResult {
  readonly startSec: number;
  readonly endSec: number;
  readonly lengthSec: number;
  /** peak normalised autocorrelation, 0..1 */
  readonly score: number;
  readonly nominalSec: number;
  readonly ok: boolean;
  readonly reason: string | null;
  /** sample indices at `sampleRate` */
  readonly startSample: number;
  readonly endSample: number;
}

/** RMS per hop (window = hop, or `winSamples` centred-free trailing window when given), then rectified difference. */
export function onsetEnvelope(mono: Float32Array, sampleRate: number, hopSec = HOP_SEC, winSec = HOP_SEC): Float64Array {
  const hop = Math.max(1, Math.round(hopSec * sampleRate));
  const win = Math.max(hop, Math.round(winSec * sampleRate));
  const n = Math.floor(mono.length / hop);
  // prefix sums of squares for O(1) windowed RMS
  const sq = new Float64Array(mono.length + 1);
  for (let i = 0; i < mono.length; i++) sq[i + 1] = sq[i]! + mono[i]! * mono[i]!;
  const rms = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const end = Math.min(mono.length, j * hop + win);
    const start = end - win < 0 ? 0 : end - win;
    rms[j] = Math.sqrt((sq[end]! - sq[start]!) / Math.max(1, end - start));
  }
  const e = new Float64Array(n);
  for (let j = 1; j < n; j++) e[j] = Math.max(0, rms[j]! - rms[j - 1]!);
  return e;
}

function score(e: Float64Array, s: number, L: number, W: number): number {
  let num = 0;
  let a2 = 0;
  let b2 = 0;
  for (let k = 0; k < W; k++) {
    const a = e[s + k]!;
    const b = e[s + L + k]!;
    num += a * b;
    a2 += a * a;
    b2 += b * b;
  }
  const den = Math.sqrt(a2 * b2);
  return den > 0 ? num / den : 0;
}

interface Best {
  s: number;
  L: number;
  r: number;
}

/** Best start and score for every candidate L (coarse grid), so several L peaks can be refined. */
function scanLengths(e: Float64Array, sMin: number, sMax: number, lMin: number, lMax: number, wMax: number, wMin: number): Best[] {
  const out: Best[] = [];
  for (let L = lMin; L <= lMax; L++) {
    let best: Best = { s: sMin, L, r: -1 };
    for (let s = sMin; s <= sMax; s++) {
      const W = Math.min(wMax, e.length - (s + L));
      if (W < wMin) continue;
      const r = score(e, s, L, W);
      if (r > best.r + 1e-12) best = { s, L, r };
    }
    out.push(best);
  }
  return out;
}

function search(e: Float64Array, sMin: number, sMax: number, lMin: number, lMax: number, wMax: number, wMin: number, prefer: number): Best {
  let best: Best = { s: sMin, L: lMin, r: -1 };
  for (let L = lMin; L <= lMax; L++) {
    for (let s = sMin; s <= sMax; s++) {
      const W = Math.min(wMax, e.length - (s + L));
      if (W < wMin) continue;
      const r = score(e, s, L, W);
      // ties (within 1e-12) go to the L nearest nominal, then the earliest (s, L): deterministic
      if (r > best.r + 1e-12 || (Math.abs(r - best.r) <= 1e-12 && Math.abs(L - prefer) < Math.abs(best.L - prefer))) best = { s, L, r };
    }
  }
  return best;
}

/** Nearest index i within ±radius of `at` where the signal crosses zero (sign change between i-1 and i, or exact 0). */
export function nearestZeroCrossing(x: Float32Array, at: number, radius: number, rising?: boolean): number {
  const isCross = (i: number): boolean => {
    if (i <= 0 || i >= x.length) return false;
    const a = x[i - 1]!;
    const b = x[i]!;
    if (b === 0) return true; // silence and exact zeros are seams already
    const up = a < 0 && b > 0;
    const down = a > 0 && b < 0;
    if (rising === undefined) return up || down;
    return rising ? up : down;
  };
  for (let d = 0; d <= radius; d++) {
    if (isCross(at - d)) return at - d;
    if (isCross(at + d)) return at + d;
  }
  return at;
}

export interface FindLoopOptions {
  readonly bpm: number;
  readonly bars: number;
  readonly beatsPerBar?: number;
}

/**
 * Find the loop of a stem. `mono` is the summed signal at `sampleRate`. Deterministic: integer grids, fixed
 * iteration order, ties resolved to the earliest candidate.
 */
export function findLoop(mono: Float32Array, sampleRate: number, opts: FindLoopOptions): LoopResult {
  const bpb = opts.beatsPerBar ?? 4;
  const nominal = (opts.bars * bpb * 60) / opts.bpm;
  const barSec = (bpb * 60) / opts.bpm;

  // ── coarse: 10 ms hops, 30 ms RMS window; best start per candidate L ──
  const e = onsetEnvelope(mono, sampleRate, HOP_SEC, COARSE_WIN_SEC);
  const toHop = (sec: number): number => Math.round(sec / HOP_SEC);
  const sMin = toHop(START_MIN_SEC);
  const sMax = toHop(START_MAX_SEC);
  const lMin = toHop(nominal * (1 - SEARCH_FRAC));
  const lMax = toHop(nominal * (1 + SEARCH_FRAC));
  const perL = scanLengths(e, sMin, sMax, lMin, lMax, toHop(2 * barSec), toHop(MIN_WINDOW_SEC));
  if (!perL.some((b) => b.r >= 0)) {
    return reject(nominal, sampleRate, 0, 0, 0, 'audio too short for the loop search (needs the loop + 0.5 s after a start in [0.25, 1] s)');
  }
  // local maxima of the per-L score, best first (ties → nearest nominal): the true L and its ± beat aliases
  const peaks = perL
    .filter((b, i) => b.r >= 0 && b.r >= (perL[i - 1]?.r ?? -1) && b.r >= (perL[i + 1]?.r ?? -1))
    .sort((a, b) => b.r - a.r || Math.abs(a.L * HOP_SEC - nominal) - Math.abs(b.L * HOP_SEC - nominal))
    .slice(0, REFINE_CANDIDATES);
  // The nominal length is always refined too. Dense material can fill the five coarse slots with aliases whose
  // ±1.5-hop fine windows all miss the true L (seen on a CC0 arpeggio: coarse peak 2 hops off, fine window short
  // by 1 ms, so a 46 ms alias won at 0.73), and a CC0 stem is periodic at nominal by construction (ingest).
  const nominalHop = toHop(nominal);
  const atNominal = perL[nominalHop - lMin];
  if (atNominal !== undefined && atNominal.r >= 0 && !peaks.some((p) => p.L === nominalHop)) peaks.push(atNominal);

  // ── fine: 1 ms hops, 10 ms RMS window, ±1.5 coarse hops around each candidate; the best fine score wins ──
  const f = onsetEnvelope(mono, sampleRate, FINE_HOP_SEC, HOP_SEC);
  const ratio = Math.round(HOP_SEC / FINE_HOP_SEC);
  const span = Math.round(1.5 * ratio);
  let fine: Best = { s: 0, L: 0, r: -1 };
  for (const c of peaks) {
    const fs0 = c.s * ratio;
    const fl0 = c.L * ratio;
    const cand = search(
      f,
      Math.max(Math.round(START_MIN_SEC / FINE_HOP_SEC), fs0 - span),
      Math.min(Math.round(START_MAX_SEC / FINE_HOP_SEC), fs0 + span),
      fl0 - span,
      fl0 + span,
      Math.round((2 * barSec) / FINE_HOP_SEC),
      Math.round(MIN_WINDOW_SEC / FINE_HOP_SEC),
      nominal / FINE_HOP_SEC,
    );
    const nearer = Math.abs(cand.L * FINE_HOP_SEC - nominal) < Math.abs(fine.L * FINE_HOP_SEC - nominal);
    if (cand.r > fine.r + 1e-9 || (Math.abs(cand.r - fine.r) <= 1e-9 && nearer)) fine = cand;
  }
  const top = peaks[0]!;
  const useFine = fine.r >= 0;
  const sSec = useFine ? fine.s * FINE_HOP_SEC : top.s * HOP_SEC;
  const lSec = useFine ? fine.L * FINE_HOP_SEC : top.L * HOP_SEC;
  const r = useFine ? fine.r : top.r;

  // ── zero-crossing snap (±2 ms), end keeps the start's slope direction ──
  const radius = Math.round(SNAP_SEC * sampleRate);
  const s0 = Math.round(sSec * sampleRate);
  const start = nearestZeroCrossing(mono, s0, radius);
  const rising = start > 0 && start < mono.length && mono[start] !== 0 ? mono[start]! > mono[start - 1]! : undefined;
  const e0 = start + Math.round(lSec * sampleRate);
  const end = Math.min(mono.length, nearestZeroCrossing(mono, e0, radius, rising));
  const lengthSec = (end - start) / sampleRate;

  let reason: string | null = null;
  if (r < REJECT_SCORE) reason = `peak autocorrelation ${r.toFixed(3)} < ${REJECT_SCORE}`;
  else if (Math.abs(lengthSec - nominal) > REJECT_LEN_FRAC * nominal) reason = `loop ${lengthSec.toFixed(4)} s is more than 1 % from nominal ${nominal.toFixed(4)} s`;
  return {
    startSec: start / sampleRate,
    endSec: end / sampleRate,
    lengthSec,
    score: r,
    nominalSec: nominal,
    ok: reason === null,
    reason,
    startSample: start,
    endSample: end,
  };
}

function reject(nominal: number, sampleRate: number, start: number, end: number, r: number, reason: string): LoopResult {
  return { startSec: start / sampleRate, endSec: end / sampleRate, lengthSec: (end - start) / sampleRate, score: r, nominalSec: nominal, ok: false, reason, startSample: start, endSample: end };
}

/**
 * Phase alignment of independently generated layers (bible §4.4): the lag, in samples, that best lines the onset
 * envelope of `layer` up with `ref` over [refStart, refStart + refLen), searched within ±`maxLagSec` (coarse 10 ms,
 * refined to 1 ms). A positive lag means the layer's events arrive later than the reference's (trim its head);
 * negative means earlier (pad its head). Returns the normalised correlation as `score` for the QA report.
 */
export function alignLag(ref: Float32Array, layer: Float32Array, sampleRate: number, refStartSec: number, refLenSec: number, maxLagSec: number): { lagSamples: number; score: number } {
  const pass = (hopSec: number, center: number, radius: number): { lag: number; r: number } => {
    const a = onsetEnvelope(ref, sampleRate, hopSec, HOP_SEC);
    const b = onsetEnvelope(layer, sampleRate, hopSec, HOP_SEC);
    const s0 = Math.round(refStartSec / hopSec);
    const W = Math.min(Math.round(refLenSec / hopSec), a.length - s0);
    let best = { lag: center, r: -1 };
    for (let lag = center - radius; lag <= center + radius; lag++) {
      let num = 0;
      let a2 = 0;
      let b2 = 0;
      for (let k = 0; k < W; k++) {
        const j = s0 + k + lag;
        if (j < 0 || j >= b.length) continue;
        const x = a[s0 + k]!;
        const y = b[j]!;
        num += x * y;
        a2 += x * x;
        b2 += y * y;
      }
      const den = Math.sqrt(a2 * b2);
      const r = den > 0 ? num / den : 0;
      // prefer the smallest |lag| on ties (deterministic, and 0 for already-aligned material)
      if (r > best.r + 1e-12 || (Math.abs(r - best.r) <= 1e-12 && Math.abs(lag) < Math.abs(best.lag))) best = { lag, r };
    }
    return best;
  };
  const coarse = pass(HOP_SEC, 0, Math.round(maxLagSec / HOP_SEC));
  const ratio = Math.round(HOP_SEC / FINE_HOP_SEC);
  const fine = pass(FINE_HOP_SEC, coarse.lag * ratio, Math.round(Math.min(1.5 * ratio, maxLagSec / FINE_HOP_SEC)));
  const zero = pass(FINE_HOP_SEC, 0, 0);
  // keep the layer where it is unless the shift is clearly better (noise, sustained pads, syncopation)
  if (fine.r < zero.r * ALIGN_MIN_GAIN + 0.02) return { lagSamples: 0, score: Math.max(0, zero.r) };
  return { lagSamples: Math.round(fine.lag * FINE_HOP_SEC * sampleRate), score: Math.max(0, fine.r) };
}

/** A shift must beat the unshifted correlation by 10 % (+0.02) to be applied. */
export const ALIGN_MIN_GAIN = 1.1;

/** Shift channels by `lag` samples: positive drops the first `lag` frames, negative prepends |lag| frames of silence. */
export function shiftChannels(channels: readonly Float32Array[], lag: number): Float32Array[] {
  if (lag === 0) return channels.map((c) => c.slice());
  if (lag > 0) return channels.map((c) => c.slice(lag));
  return channels.map((c) => {
    const out = new Float32Array(c.length - lag);
    out.set(c, -lag);
    return out;
  });
}

/**
 * Sfx trim: drop leading silence (below `thresholdDb` dBFS, keeping `preRollSec`), cap at `maxSec` and apply a
 * short linear fade-out so a clip cut from a longer generation (providers have minimum lengths) ends cleanly.
 */
export function trimSfx(channels: readonly Float32Array[], sampleRate: number, maxSec: number, thresholdDb = -50, preRollSec = 0.005, fadeSec = 0.01): Float32Array[] {
  const thr = 10 ** (thresholdDb / 20);
  const n = channels[0]?.length ?? 0;
  let first = n;
  for (let i = 0; i < n && first === n; i++) for (const ch of channels) if (Math.abs(ch[i]!) >= thr) first = i;
  if (first === n) first = 0;
  const start = Math.max(0, first - Math.round(preRollSec * sampleRate));
  const end = Math.min(n, start + Math.round(maxSec * sampleRate));
  const fade = Math.min(Math.round(fadeSec * sampleRate), end - start);
  return channels.map((ch) => {
    const out = ch.slice(start, end);
    for (let k = 0; k < fade; k++) {
      const i = out.length - fade + k;
      out[i] = Math.fround(out[i]! * (1 - (k + 1) / fade));
    }
    return out;
  });
}

/**
 * Make the jump loopEnd → loopStart seamless on one channel set: the `fadeSamples` before `end` are
 * cross-faded (linear, the signals are correlated) into the `fadeSamples` before `start`, so the sample
 * played just before the jump continues into x[start]. Returns new arrays of length `end`; requires start ≥ fade.
 */
export function bakeSeamCrossfade(channels: readonly Float32Array[], start: number, end: number, fadeSamples: number): Float32Array[] {
  const c = Math.min(fadeSamples, start, end - start);
  return channels.map((ch) => {
    const out = ch.slice(0, end);
    for (let k = 0; k < c; k++) {
      const w = (k + 1) / (c + 1); // 0 → 1 across the fade: towards the pre-start audio
      const i = end - c + k;
      out[i] = Math.fround(ch[i]! * (1 - w) + ch[start - c + k]! * w);
    }
    return out;
  });
}

/**
 * Ambience: a baked equal-power cross-fade loop. From T frames and a fade of c frames, returns T − c frames
 * y where y[n] = x[n + c] except the last c frames, which blend the tail x[T−c..T) (fading out) with the head
 * x[0..c) (fading in); y's last frame therefore continues into y[0] = x[c]. Loop = [0, T − c).
 */
export function bakeCrossfadeLoop(channels: readonly Float32Array[], fadeSamples: number): Float32Array[] {
  return channels.map((ch) => {
    const T = ch.length;
    const c = Math.min(fadeSamples, Math.floor(T / 3));
    const out = new Float32Array(T - c);
    for (let n = 0; n < T - 2 * c; n++) out[n] = ch[n + c]!;
    for (let k = 0; k < c; k++) {
      const t = (k + 0.5) / c;
      const fadeIn = Math.sin((t * Math.PI) / 2);
      const fadeOut = Math.cos((t * Math.PI) / 2);
      out[T - 2 * c + k] = Math.fround(ch[T - c + k]! * fadeOut + ch[k]! * fadeIn);
    }
    return out;
  });
}
