/**
 * SPEC §10.7.5 — the evolution sequence (amended 2026-10-05): `stage.evolve(request)` plays a creature's evolution in
 * place, after the server confirmed it (the client calls it with the REST response's species, never before).
 *
 * Full path (≈ 9.5 s; `skip()` jumps to the reveal, a second `skip()` to the exit):
 *   stage     1100 ms  the camera pushes in on the inspector close-up (§10.7.4 inspector pose, distance fitted to the
 *                      taller form), the world dims (post exposure × 0.74, vignette 0.22 → 0.55), the old form
 *                      dissolves in beside the trainer, a soft light rises under it (reserved arena beacon 0)
 *   charge     900 ms  the old form turns into a glowing white silhouette (`glow`); sparkles start rising
 *   alternate 3600 ms  the white silhouettes alternate OLD ↔ NEW, slow → fast (0.7 → 2.4 Hz, never above 3 Hz:
 *                      WCAG 2.3.1), each incoming one popping from 0.88 × to full size; the camera dollies in 0.6 m
 *   peak       500 ms  the NEW silhouette held white while sparkles converge on it (a gap before the burst, so the
 *                      burst never makes a 4th flash inside any one second)
 *   reveal     900 ms  the light burst (beacon spike, star burst + ring cards, a 0.06 shake when `effects.shake`), the
 *                      glow fades into the new form's colours, the world brightens back; the trainer cheers (when
 *                      within 6 m) and the new form bounces (`celebrate`)
 *   hold      1800 ms  the new form idles (the client's DOM banner "<Name> evolved into <Species>!")
 *   exit       700 ms  the camera releases to the diorama pose, the creature dissolves out, the light fades
 * Reduced (effective reduced effects): `charge · alternate · peak` become one 2600 ms `fade` — the two forms cross-fade
 * through the dissolve dither under a gentle glow (≤ 0.35, one slow rise and fall), no swaps, no burst light, no ring
 * cards, no shake.
 *
 * Budgets: no new program (the `glow` term is in the one billboard program from boot; the light is the reserved beacon
 * 0 that exists from `createRenderer`, so the light set never changes; VFX are slices of the pooled emitters), no
 * allocation per frame (preallocated sample and scratch vectors), and the cleanup restores the beacon light (position,
 * target, colour, intensity, cone, range, shadow update), the post exposure / vignette and the sprite pool's bindings
 * (both billboards disposed) exactly.
 */
import { Vector3 } from 'three/webgpu';
import type { Color, Object3D, SpotLight, UniformNode } from 'three/webgpu';
import type { EvolutionHandle, EvolutionPhase, EvolutionRequest, TypeName } from '../contracts.js';
import type { EffectsFlags } from '../descriptors.js';
import { LAYERS } from '../descriptors.js';
import { INSPECT_AIM, INSPECT_DISTANCE, INSPECT_OFFSET } from '../camera/battle.js';
import type { DioramaRig } from '../camera/rig.js';
import type { BillboardPool, CreatureBillboard } from '../sprites/billboard.js';
import type { CharacterPool } from './actors.js';
import type { SequenceVfxRecipe, VfxAnchor, VfxPhase, VfxSystem } from './vfx.js';

// ---- numbers ---------------------------------------------------------------------------------------------------

export const EVOLUTION = Object.freeze({
  // timeline (ms)
  stageMs: 1100,
  /** The old form dissolves in over this, starting `appearAtMs` into the stage. */
  appearAtMs: 250, appearMs: 500,
  chargeMs: 900,
  alternateMs: 3600,
  peakMs: 500,
  /** Reduced effects: one cross-fade replaces charge + alternate + peak. */
  fadeMs: 2600,
  revealMs: 900,
  holdMs: 1800,
  exitMs: 700,
  /** The exit dissolve takes this share of the exit (the camera release takes all of it). */
  exitDissolveShare: 0.6,
  /** Alternation frequency (full cycles OLD → NEW → OLD per second), linear ramp; WCAG 2.3.1 cap. */
  pulseHzStart: 0.7, pulseHzEnd: 2.4, pulseHzMax: 3,
  /** An incoming silhouette pops from this size to 1 over `popMs` (ease-out). */
  popFrom: 0.88, popMs: 110,
  /** The burst holds the new silhouette white this long, then the glow fades (ease-out) over `revealGlowFadeMs`. */
  revealGlowHoldMs: 120, revealGlowFadeMs: 560,
  /** Reveal events (ms after the reveal starts). */
  cheerAtMs: 150, celebrateAtMs: 420, celebrateMs: 640,
  /** Reduced cross-fade: the glow's peak and the share of the fade the dissolve swap takes (centred). */
  reducedGlow: 0.35, crossfadeShare: 0.7,
  /** The atlases of both forms must be bound before the stage ends; the sequence waits at most this long. */
  bindWaitMaxMs: 8000,
  // placement: candidate spots (m toward the camera, m to screen-right of the trainer) in order of preference — the
  // inspector's 1.2 m in front, a little to the side so the trainer stays in view; the first clear one wins
  spots: Object.freeze([[INSPECT_OFFSET, 0.6], [INSPECT_OFFSET, -0.6], [1.5, 1.0], [1.5, -1.0], [0.9, 1.4], [0.9, -1.4], [2.0, 0.3], [2.0, -0.3], [INSPECT_OFFSET, 0]] as const),
  /** The creature stands at least half its card width + this from the trainer's line of sight (m). */
  trainerClearM: 0.3,
  /** A spot is scored by footprints under the creature (within `footM`) and on the ground line toward the camera (every `losStepM` up to `losM`). */
  footM: 0.45, losStepM: 0.5, losM: 3.5,
  /** The site is cleared (grass, small props; merged props `cutTowardCameraM` toward the camera) this far into the stage, restored halfway through the exit. */
  siteAtMs: 450, cutTowardCameraM: 1,
  /** The camera aims at `aim × taller height` and stands `max(4 m, k × taller height)` away. */
  aimFrac: INSPECT_AIM, distancePerHeightM: 2.6, dollyM: 0.6, minDistanceM: 3,
  /** At the reveal the camera eases back to `distance + revealPullM` over the reveal and half the hold (room for the banner, the whole new form). */
  revealPullM: 0.4,
  /** The trainer's half width (m, with a margin) for framing both; the creature + trainer span fills ≤ this share of the width. */
  trainerHalfM: 0.45, frameFill: 0.8,
  // world dimming (post uniforms, restored exactly)
  exposureDim: 0.74, vignetteDim: 0.55,
  // the soft light under the creature (reserved beacon 0)
  lightIntensity: 7, lightForwardM: 1.15, lightHeightM: 0.2, lightTargetFrac: 0.5, lightAngle: 0.6, lightPenumbra: 0.9, lightRangeM: 9,
  lightDecay: 2, lightColor: [1, 0.92, 0.78] as const,
  /** Light levels (× lightIntensity) per phase; the burst peaks at `lightBurst`, rising over `burstRiseMs`, decaying with `burstTauMs`. */
  lightStage: 0.45, lightCharge: 0.7, lightPeak: 1, lightPeakEnd: 1.15, lightBurst: 2.4, lightHold: 0.55, burstRiseMs: 70, burstTauMs: 220,
  shakeAmp: 0.06, shakeMs: 300,
  cheerRadiusM: 6,
});

const E = EVOLUTION;

/** One phase of the timeline: [start, end) in ms from the sequence start. */
export interface PhaseSpan { readonly phase: EvolutionPhase; readonly start: number; readonly end: number }

function spans(list: readonly (readonly [EvolutionPhase, number])[]): readonly PhaseSpan[] {
  let t = 0;
  return Object.freeze(list.map(([phase, ms]) => { const s: PhaseSpan = Object.freeze({ phase, start: t, end: t + ms }); t += ms; return s; }));
}

/** The two timelines (full and reduced). */
export const EVOLUTION_TIMELINE = Object.freeze({
  full: spans([['stage', E.stageMs], ['charge', E.chargeMs], ['alternate', E.alternateMs], ['peak', E.peakMs], ['reveal', E.revealMs], ['hold', E.holdMs], ['exit', E.exitMs]]),
  reduced: spans([['stage', E.stageMs], ['fade', E.fadeMs], ['reveal', E.revealMs], ['hold', E.holdMs], ['exit', E.exitMs]]),
});

function timeline(reduced: boolean): readonly PhaseSpan[] { return reduced ? EVOLUTION_TIMELINE.reduced : EVOLUTION_TIMELINE.full; }

/** Total length (ms) of a sequence that is not skipped. */
export function evolutionDurationMs(reduced: boolean): number { const t = timeline(reduced); return t[t.length - 1]!.end; }

/** The span of `phase` in a timeline (undefined for `done` and for phases the timeline lacks). */
export function evolutionPhaseAt(reduced: boolean, phase: EvolutionPhase): PhaseSpan | undefined {
  return timeline(reduced).find((s) => s.phase === phase);
}

/** Instantaneous alternation frequency (Hz) `tauMs` into the alternate phase: a linear ramp, capped at 3 Hz. */
export function alternationHz(tauMs: number): number {
  const k = Math.min(1, Math.max(0, tauMs / E.alternateMs));
  return Math.min(E.pulseHzMax, E.pulseHzStart + (E.pulseHzEnd - E.pulseHzStart) * k);
}

/** Cycles completed `tauMs` into the alternate phase (the integral of `alternationHz`). */
function alternationCycles(tauMs: number): number {
  const T = E.alternateMs / 1000; const t = Math.min(T, Math.max(0, tauMs / 1000));
  return E.pulseHzStart * t + (E.pulseHzEnd - E.pulseHzStart) * t * t / (2 * T);
}

function smooth(x: number): number { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); }
function lerp(a: number, b: number, k: number): number { return a + (b - a) * k; }

/** What the sequence shows at a time (pure; the runtime writes it to the billboards, the light and the post uniforms). */
export interface EvolutionSample {
  phase: EvolutionPhase;
  /** 0..1 through the phase. */
  k: number;
  /** ms into the phase. */
  tau: number;
  oldShown: boolean;
  newShown: boolean;
  /** Dissolve 0 (whole) … 1 (gone) of each form. */
  oldDissolve: number;
  newDissolve: number;
  glowOld: number;
  glowNew: number;
  /** × `EVOLUTION.lightIntensity`. */
  light: number;
  /** World dimming 0..1 (exposure and vignette toward their `*Dim` values). */
  dim: number;
  /** Alternation frequency (Hz) in the alternate phase, else 0. */
  pulseHz: number;
}

export function createEvolutionSample(): EvolutionSample {
  return { phase: 'stage', k: 0, tau: 0, oldShown: false, newShown: false, oldDissolve: 1, newDissolve: 1, glowOld: 0, glowNew: 0, light: 0, dim: 0, pulseHz: 0 };
}

/** Samples the sequence `tMs` after its start into `out`. Pure, allocation-free. */
export function sampleEvolution(tMs: number, reduced: boolean, out: EvolutionSample): EvolutionSample {
  const tl = timeline(reduced);
  const t = Number.isFinite(tMs) ? Math.max(0, tMs) : 0;
  let span: PhaseSpan | null = null;
  for (let i = 0; i < tl.length; i++) { if (t < tl[i]!.end) { span = tl[i]!; break; } }
  out.oldShown = false; out.newShown = false; out.oldDissolve = 1; out.newDissolve = 1; out.glowOld = 0; out.glowNew = 0;
  out.light = 0; out.dim = 0; out.pulseHz = 0;
  if (span === null) { out.phase = 'done'; out.k = 1; out.tau = 0; return out; }
  const tau = t - span.start;
  const k = tau / Math.max(1, span.end - span.start);
  out.phase = span.phase; out.k = k; out.tau = tau;
  switch (span.phase) {
    case 'stage':
      out.oldShown = true;
      out.oldDissolve = 1 - smooth((tau - E.appearAtMs) / E.appearMs);
      out.dim = smooth(k);
      out.light = E.lightStage * smooth(k);
      break;
    case 'charge':
      out.oldShown = true; out.oldDissolve = 0;
      out.glowOld = smooth(k);
      out.dim = 1;
      out.light = lerp(E.lightStage, E.lightCharge, smooth(k));
      break;
    case 'alternate': {
      const showNew = alternationCycles(tau) % 1 >= 0.5;
      out.oldShown = !showNew; out.newShown = showNew;
      out.oldDissolve = 0; out.newDissolve = 0; out.glowOld = 1; out.glowNew = 1;
      out.dim = 1;
      out.light = lerp(E.lightCharge, E.lightPeak, smooth(k));
      out.pulseHz = alternationHz(tau);
      break;
    }
    case 'peak':
      out.newShown = true; out.newDissolve = 0; out.glowNew = 1;
      out.dim = 1;
      out.light = lerp(E.lightPeak, E.lightPeakEnd, smooth(k));
      break;
    case 'fade': {
      const edge = (1 - E.crossfadeShare) / 2;
      const c = smooth((k - edge) / E.crossfadeShare);
      out.oldShown = c < 1; out.newShown = c > 0;
      out.oldDissolve = c; out.newDissolve = 1 - c;
      const g = E.reducedGlow * Math.sin(Math.PI * Math.min(1, Math.max(0, k)));
      out.glowOld = g; out.glowNew = g;
      out.dim = 1;
      out.light = lerp(E.lightStage, E.lightCharge, smooth(k));
      break;
    }
    case 'reveal':
      out.newShown = true; out.newDissolve = 0;
      out.dim = 1 - smooth(k);
      if (reduced) {
        out.light = lerp(E.lightCharge, E.lightHold, smooth(k));
      } else {
        // the colours come back fast after the burst, then settle (ease-out)
        const u = Math.min(1, Math.max(0, (tau - E.revealGlowHoldMs) / E.revealGlowFadeMs));
        out.glowNew = (1 - u) * (1 - u);
        const burst = tau < E.burstRiseMs ? tau / E.burstRiseMs : Math.exp(-(tau - E.burstRiseMs) / E.burstTauMs);
        out.light = E.lightHold + (E.lightBurst - E.lightHold) * burst;
      }
      break;
    case 'hold':
      out.newShown = true; out.newDissolve = 0;
      out.light = E.lightHold;
      break;
    case 'exit':
      out.newShown = true;
      out.newDissolve = smooth(k / E.exitDissolveShare);
      out.light = E.lightHold * (1 - smooth(k));
      break;
    default:
      break;
  }
  return out;
}

// ---- sequence effects (slices of the pooled VFX emitters; §10.7.5 VFX table, "sequence effects") ---------------

const P = (o: Partial<VfxPhase> & Pick<VfxPhase, 'motion' | 'anchor' | 'count' | 'color'>): VfxPhase => Object.freeze({
  intensity: 2.2, lifeMs: 500, spreadMs: 200, size: 0.18, sizeEnd: 0.4, speed: 3, gravity: 0, drag: 1.5, swirl: 0, radius: 0.3,
  height: 0.9, shape: 'disc', delay: 0, color2: undefined, ...o,
});

const R = (id: string, type: TypeName, phases: readonly VfxPhase[], defaultMs: number): SequenceVfxRecipe => Object.freeze({
  id, type, phases: Object.freeze(phases), chroma: null, flash: 0, beaconPulse: 0, defaultMs,
});

/**
 * The sequence effects for a new form of type `type` (its colour from the stage's type table): `motes` rise from the
 * creature's feet through the build-up, `converge` draws sparkles into it at the peak, `burst` is the reveal (stars +
 * ring cards + an afterglow of rising pixels). Reduced: fewer, slower motes, no converge, and the reveal is rising
 * sparkles only (no burst, no ring cards). Built once per sequence (not per frame).
 */
export function evolutionRecipes(type: TypeName, reduced: boolean): { readonly motes: SequenceVfxRecipe; readonly converge: SequenceVfxRecipe | null; readonly burst: SequenceVfxRecipe } {
  if (reduced) {
    return {
      motes: R('evolve_motes', type, [
        P({ motion: 'rise', anchor: 'to', count: 60, color: '#fff4d6', color2: '#ffffff', shape: 'star', size: 0.12, sizeEnd: 0.3, lifeMs: 1500, spreadMs: 2400, radius: 0.8, height: 0.02, gravity: -0.8, speed: 0.4, swirl: 0.8, intensity: 1.6 }),
        P({ motion: 'rise', anchor: 'to', count: 90, color: 'type', color2: '#ffffff', shape: 'pixel', size: 0.06, sizeEnd: 0.5, lifeMs: 1300, spreadMs: 2400, radius: 0.85, height: 0.02, gravity: -1.1, speed: 0.5, swirl: 1.0, intensity: 1.5 }),
      ], E.fadeMs),
      converge: null,
      burst: R('evolve_reveal', type, [
        P({ motion: 'rise', anchor: 'to', count: 110, color: '#ffffff', color2: '#fff0c8', shape: 'star', size: 0.12, sizeEnd: 0.25, lifeMs: 1400, spreadMs: 700, radius: 0.9, height: 0.05, gravity: -1.0, speed: 0.6, swirl: 0.9, intensity: 1.6 }),
      ], E.revealMs),
    };
  }
  return {
    motes: R('evolve_motes', type, [
      P({ motion: 'rise', anchor: 'to', count: 90, color: '#fff4d6', color2: '#ffffff', shape: 'star', size: 0.13, sizeEnd: 0.3, lifeMs: 1300, spreadMs: 4600, radius: 0.8, height: 0.02, gravity: -1.4, speed: 0.5, swirl: 1.1, intensity: 2.0 }),
      P({ motion: 'rise', anchor: 'to', count: 200, color: 'type', color2: '#fff6e0', shape: 'disc', size: 0.08, sizeEnd: 0.35, lifeMs: 1200, spreadMs: 4600, radius: 0.95, height: 0.02, gravity: -1.8, speed: 0.7, swirl: 1.5, intensity: 2.0 }),
    ], E.chargeMs + E.alternateMs + E.peakMs),
    converge: R('evolve_converge', type, [
      P({ motion: 'drain', anchor: 'to', count: 160, color: '#ffffff', color2: '#fff0c8', shape: 'star', size: 0.12, sizeEnd: 0.4, lifeMs: 400, spreadMs: 320, radius: 1.6, height: 0.55, drag: 0.001, speed: 0.2, intensity: 2.2 }),
    ], E.peakMs),
    burst: R('evolve_burst', type, [
      P({ motion: 'burst', anchor: 'to', count: 1, color: '#fff8ea', shape: 'disc', size: 2.4, sizeEnd: 0.3, lifeMs: 300, spreadMs: 0, speed: 0, height: 0.5, intensity: 0.9 }),
      P({ motion: 'burst', anchor: 'to', count: 130, color: '#ffffff', color2: '#ffd98a', shape: 'star', size: 0.22, sizeEnd: 0.06, lifeMs: 950, spreadMs: 60, speed: 6.5, drag: 1.6, height: 0.5, intensity: 3.0 }),
      P({ motion: 'ring', anchor: 'to', count: 2, color: '#fff1c0', shape: 'ring', size: 1.2, sizeEnd: 2.0, lifeMs: 520, spreadMs: 140, speed: 0, height: 0.5, intensity: 1.0 }),
      P({ motion: 'rise', anchor: 'to', count: 90, color: 'type', color2: '#fff4d6', shape: 'star', size: 0.1, sizeEnd: 0.2, lifeMs: 1300, spreadMs: 1000, radius: 1.0, height: 0.1, gravity: -1.2, speed: 0.7, swirl: 1.2, intensity: 2.0, delay: 0.15 }),
    ], E.revealMs),
  };
}

// ---- runtime -------------------------------------------------------------------------------------------------------

/** What the sequence drives (the stage passes its own subsystems). */
export interface EvolutionDeps {
  readonly sprites: BillboardPool;
  readonly vfx: VfxSystem;
  readonly rig: DioramaRig;
  readonly actors: CharacterPool;
  /** Where the creature billboards are added (the scene). */
  readonly parent: Object3D;
  /** The reserved beacon light the sequence borrows (it exists from `createRenderer`; the light set never changes). */
  readonly light: SpotLight;
  readonly lightTarget: Object3D;
  readonly ground: (x: number, z: number) => number;
  readonly effects: () => EffectsFlags;
  /** Post exposure / vignette (absent in node tests without a post stack). */
  readonly post?: { readonly exposure: UniformNode<'float', number>; readonly vignette: UniformNode<'float', number> } | null;
  /** Footprints (buildings, props, trunks): the creature's spot avoids them under it and between it and the camera. */
  readonly occluded?: ((x: number, z: number) => boolean) | null;
  /** Ground a creature may stand on. */
  readonly standable?: ((x: number, z: number) => boolean) | null;
  /**
   * Clears (on) / restores (off) the site: grass and small props around the creature at (x, z), merged static props
   * around (cx, cz) toward the camera (the stage's ground-cover mask and prop cutaway).
   */
  readonly clearSite?: ((on: boolean, x: number, z: number, cx: number, cz: number) => void) | null;
}

/** Score of a creature spot (lower is better): footprints under it, then footprints on the ground line to the camera. */
export function spotScore(x: number, z: number, towardX: number, towardZ: number, occluded: ((x: number, z: number) => boolean) | null, standable: ((x: number, z: number) => boolean) | null): number {
  let n = 0;
  if (standable !== null && !standable(x, z)) n += 100;
  if (occluded !== null) {
    if (occluded(x, z)) n += 40;
    const f = E.footM;
    if (occluded(x + f, z)) n += 10; if (occluded(x - f, z)) n += 10; if (occluded(x, z + f)) n += 10; if (occluded(x, z - f)) n += 10;
    for (let d = E.losStepM; d <= E.losM + 1e-6; d += E.losStepM) if (occluded(x + towardX * d, z + towardZ * d)) n += 2;
  }
  return n;
}

interface SavedLight {
  readonly position: Vector3; readonly target: Vector3; readonly color: Color;
  intensity: number; angle: number; penumbra: number; distance: number; decay: number; autoUpdate: boolean; layers: number;
}

const _fwd = new Vector3();

/**
 * One running evolution (owned by the stage, which calls `update(dtReal)` from its frame hook after the beacon writes).
 * Implements the contract's `EvolutionHandle`.
 */
export class EvolutionSequence implements EvolutionHandle {
  readonly done: Promise<'done' | 'cancelled'>;
  readonly reduced: boolean;
  /** The two forms (exposed for tests and the sandbox). */
  readonly oldForm: CreatureBillboard;
  readonly newForm: CreatureBillboard;
  /** Feet of the creature, the camera aim, the shot distance. */
  readonly feet = new Vector3();
  readonly aim = new Vector3();
  readonly distance: number;
  private readonly sample = createEvolutionSample();
  private readonly tl: readonly PhaseSpan[];
  private readonly revealAt: number;
  private readonly exitAt: number;
  private readonly stageEnd: number;
  private readonly anchor: VfxAnchor;
  private readonly recipes: ReturnType<typeof evolutionRecipes>;
  private readonly saved: SavedLight;
  private readonly savedExposure: number;
  private readonly savedVignette: number;
  private resolve!: (r: 'done' | 'cancelled') => void;
  private t = 0;
  private elapsed = 0;
  private current: EvolutionPhase = 'stage';
  private finished = false;
  private skipped = false;
  private cheered = false;
  private celebrated = false;
  private lastOldDissolve = Number.NaN;
  private lastNewDissolve = Number.NaN;
  private lastShowNew = false;
  private popLeft = 0;
  private popOld = false;
  private siteCleared = false;
  private readonly cutX: number;
  private readonly cutZ: number;

  constructor(private readonly d: EvolutionDeps, private readonly req: EvolutionRequest) {
    this.reduced = req.reduced;
    this.tl = timeline(this.reduced);
    this.revealAt = evolutionPhaseAt(this.reduced, 'reveal')!.start;
    this.exitAt = evolutionPhaseAt(this.reduced, 'exit')!.start;
    this.stageEnd = this.tl[0]!.end;
    this.done = new Promise((res) => { this.resolve = res; });

    // the two forms (atlases may still be binding: a billboard stays hidden until its bind lands); placed below
    this.oldForm = this.acquire(req.from);
    this.newForm = this.acquire(req.to);
    const h = Math.max(this.oldForm.heightM, this.newForm.heightM);
    const w = Math.max(this.oldForm.widthM, this.newForm.widthM);

    // placement: in front of the trainer (toward the camera), to one side by at least half the wider form + a margin
    // (a big creature does not hide its trainer); the first clear candidate wins
    const rig = d.rig;
    rig.dioramaForward(_fwd);                       // camera → scene, horizontal
    const at = req.at ?? rig.focus;
    const rx = -_fwd.z; const rz = _fwd.x;          // screen right on the ground
    const minSide = 0.5 * w + E.trainerClearM;
    let x = at.x; let z = at.z; let best = Number.POSITIVE_INFINITY; let lateral = 0;
    for (const [ahead, side0] of E.spots) {
      // at least half the wider card + a margin to the side (a big creature never hides its trainer); 0 stays centred
      const side = side0 === 0 ? 0 : Math.sign(side0) * Math.max(Math.abs(side0), minSide);
      const cx = at.x - _fwd.x * ahead + rx * side; const cz = at.z - _fwd.z * ahead + rz * side;
      const sc = spotScore(cx, cz, -_fwd.x, -_fwd.z, d.occluded ?? null, d.standable ?? null);
      if (sc < best) { best = sc; x = cx; z = cz; lateral = side; }
      if (sc === 0) break;
    }
    this.cutX = x - _fwd.x * E.cutTowardCameraM; this.cutZ = z - _fwd.z * E.cutTowardCameraM;
    const gy = d.ground(x, z);
    const y = Number.isFinite(gy) ? gy : 0;
    this.feet.set(x, y, z);
    this.oldForm.setPosition(x, y, z);
    this.newForm.setPosition(x, y, z);
    this.anchor = { feet: this.feet, height: h };
    // frame the creature AND its trainer: aim at the middle of the span from the creature's far edge to the trainer's
    // outer edge (along the screen's horizontal), and stand far enough back for that span to fill ≤ `frameFill` of the width
    const latAbs = Math.abs(lateral); const toward = lateral > 0 ? -1 : 1;     // the trainer is on the other side
    const shift = latAbs > 0 ? Math.max(0, (latAbs + E.trainerHalfM - 0.5 * w) / 2) : 0;
    this.aim.set(x + rx * toward * shift, y + h * E.aimFrac, z + rz * toward * shift);
    const cam = rig.camera;
    const tanHalfW = Math.tan((cam.fov * Math.PI) / 360) * (cam.aspect > 0 ? cam.aspect : 16 / 9);
    const halfSpan = (latAbs + E.trainerHalfM + 0.5 * w) / 2;
    this.distance = Math.max(INSPECT_DISTANCE, E.distancePerHeightM * h, halfSpan / (tanHalfW * E.frameFill));
    this.recipes = evolutionRecipes(req.to.types[0], this.reduced);

    // borrow beacon 0 (saved exactly, restored at the cleanup)
    const L = d.light;
    this.saved = {
      position: L.position.clone(), target: d.lightTarget.position.clone(), color: L.color.clone(),
      intensity: L.intensity, angle: L.angle, penumbra: L.penumbra, distance: L.distance, decay: L.decay, autoUpdate: L.shadow.autoUpdate,
      layers: L.shadow.camera.layers.mask,
    };
    L.position.set(x - _fwd.x * E.lightForwardM, y + E.lightHeightM, z - _fwd.z * E.lightForwardM);
    d.lightTarget.position.set(x, y + h * E.lightTargetFrac, z);
    L.color.setRGB(E.lightColor[0], E.lightColor[1], E.lightColor[2]);
    L.angle = E.lightAngle; L.penumbra = E.lightPenumbra; L.distance = E.lightRangeM; L.decay = E.lightDecay;
    L.intensity = 0;
    L.shadow.autoUpdate = true;
    // only the creature cards cast into this light's shadow map: its one shadow-pass program (the billboard's) is
    // compiled at boot (`Stage.armWarmupShadows`), whatever props or trees stand in the cone
    L.shadow.camera.layers.set(LAYERS.billboards);
    this.savedExposure = d.post?.exposure.value ?? 1;
    this.savedVignette = d.post?.vignette.value ?? 0;

    rig.inspect(this.aim, E.stageMs, this.distance);
    this.apply();
    req.onPhase?.('stage');
  }

  // ---- EvolutionHandle ----------------------------------------------------------------------------------------

  get phase(): EvolutionPhase { return this.finished ? 'done' : this.current; }
  get isFinished(): boolean { return this.finished; }
  /** ms since the start on the sequence clock (held while waiting for an atlas; jumps on skip). */
  get clock(): number { return this.t; }
  /** Whether both forms' atlases are bound. */
  get bound(): boolean { return this.oldForm.bound && this.newForm.bound; }
  /** The last sample written (tests, sandbox). */
  get lastSample(): Readonly<EvolutionSample> { return this.sample; }

  skip(): void {
    if (this.finished) return;
    if (this.t < this.revealAt) { this.skipped = true; this.t = this.revealAt; this.step(0); return; }
    if (this.t < this.exitAt) { this.t = this.exitAt; this.step(0); }
  }

  cancel(): void { this.finish('cancelled'); }

  /** Per frame (real ms; the stage's hook, after its beacon writes). Zero allocation. */
  update(dtRealMs: number): void {
    if (this.finished) return;
    const dt = Number.isFinite(dtRealMs) && dtRealMs > 0 ? dtRealMs : 0;
    this.elapsed += dt;
    let t = this.t + dt;
    // the swap needs both atlases: hold just before the stage's end until they are bound; when the wait runs out with
    // the new form still unbound, go straight to the reveal (the new form shows the moment its bind lands)
    if (!this.skipped && this.t < this.stageEnd && t >= this.stageEnd && !this.bound) {
      if (this.elapsed < this.stageEnd + E.bindWaitMaxMs) t = this.stageEnd - 1e-3;
      else if (!this.newForm.bound) { this.skipped = true; t = this.revealAt; }
    }
    this.t = t;
    this.step(dt);
  }

  // ---- internals ----------------------------------------------------------------------------------------------------

  private acquire(desc: EvolutionRequest['from']): CreatureBillboard {
    const bb = this.d.sprites.acquire(desc);
    bb.setFacing('front');
    bb.setSharp(true);
    bb.setPosition(this.feet.x, this.feet.y, this.feet.z);
    bb.setFaint(1);
    bb.setShown(false);
    this.d.parent.add(bb.object);
    return bb;
  }

  private step(dt: number): void {
    sampleEvolution(this.t, this.reduced, this.sample);
    const ph = this.sample.phase;
    if (ph !== this.current) this.enter(ph);
    if (this.finished) return;
    // reveal events
    if (ph === 'reveal' || ph === 'hold') {
      const since = this.t - this.revealAt;
      if (!this.cheered && since >= E.cheerAtMs) { this.cheered = true; this.cheer(); }
      if (!this.celebrated && since >= E.celebrateAtMs) { this.celebrated = true; this.newForm.setPose('celebrate', E.celebrateMs); }
    }
    if (this.popLeft > 0) this.popLeft = Math.max(0, this.popLeft - dt);
    // the site: cleared while the camera pushes in, restored while it pulls back
    if (!this.siteCleared && ph !== 'exit' && (ph !== 'stage' || this.sample.tau >= E.siteAtMs)) this.site(true);
    else if (this.siteCleared && ph === 'exit' && this.sample.k >= 0.5) this.site(false);
    this.apply();
  }

  private site(on: boolean): void {
    if (on === this.siteCleared) return;
    this.siteCleared = on;
    this.d.clearSite?.(on, this.feet.x, this.feet.z, this.cutX, this.cutZ);
  }

  private enter(ph: EvolutionPhase): void {
    this.current = ph;
    const d = this.d;
    switch (ph) {
      case 'charge':
        d.vfx.spawnRecipe(this.recipes.motes, null, this.anchor, this.feet, this.recipes.motes.defaultMs);
        break;
      case 'fade':
        d.vfx.spawnRecipe(this.recipes.motes, null, this.anchor, this.feet, this.recipes.motes.defaultMs);
        break;
      case 'alternate':
        d.rig.dollyShot(Math.max(E.minDistanceM, this.distance - E.dollyM), E.alternateMs + E.peakMs);
        break;
      case 'peak':
        if (this.recipes.converge !== null) d.vfx.spawnRecipe(this.recipes.converge, this.anchor, this.anchor, this.feet, E.peakMs);
        break;
      case 'reveal':
        if (!this.reduced || this.skipped) d.vfx.clear();   // the build-up's motes end with the burst (a skip lands here too)
        d.rig.dollyShot(this.distance + E.revealPullM, E.revealMs + E.holdMs / 2);
        d.vfx.spawnRecipe(this.recipes.burst, null, this.anchor, this.feet, E.revealMs);
        if (!this.reduced) d.rig.shake(E.shakeAmp, E.shakeMs);   // the rig returns at once when effects.shake is off
        break;
      case 'exit':
        if (d.rig.currentMode === 'inspect') d.rig.release(E.exitMs);
        break;
      case 'done':
        this.finish('done');
        return;
      default:
        break;
    }
    this.req.onPhase?.(ph);
  }

  private cheer(): void {
    const id = this.req.cheer;
    if (id === null || id === undefined || !this.d.actors.has(id)) return;
    const f = this.d.actors.feetOf(id, _fwd);
    if (f === null || Math.hypot(f.x - this.feet.x, f.z - this.feet.z) > E.cheerRadiusM) return;
    this.d.actors.setEmote(id, 2);                       // happy → the `cheer` clip (§10.7.7)
  }

  /** Writes the current sample: visibility, dissolve, glow, pop, the light and the post uniforms. Zero allocation. */
  private apply(): void {
    const s = this.sample;
    const o = this.oldForm; const n = this.newForm;
    // a swap: the incoming silhouette pops (full path only — the reduced cross-fade shows both)
    if (!this.reduced && (s.phase === 'alternate' || s.phase === 'peak')) {
      if (s.newShown !== this.lastShowNew) { this.popLeft = E.popMs; this.popOld = !s.newShown; }
    }
    this.lastShowNew = s.newShown;
    const pop = this.popLeft > 0 ? E.popFrom + (1 - E.popFrom) * (1 - (this.popLeft / E.popMs) ** 2) : 1;
    o.setShown(s.oldShown); n.setShown(s.newShown);
    o.setSizeMul(this.popOld ? pop : 1); n.setSizeMul(this.popOld ? 1 : pop);
    if (s.oldDissolve !== this.lastOldDissolve) { this.lastOldDissolve = s.oldDissolve; o.setFaint(s.oldDissolve); }
    if (s.newDissolve !== this.lastNewDissolve) { this.lastNewDissolve = s.newDissolve; n.setFaint(s.newDissolve); }
    o.setGlow(s.glowOld); n.setGlow(s.glowNew);
    const L = this.d.light;
    L.intensity = E.lightIntensity * s.light;
    L.shadow.autoUpdate = true;
    const post = this.d.post;
    if (post) {
      post.exposure.value = this.savedExposure * lerp(1, E.exposureDim, s.dim);
      post.vignette.value = lerp(this.savedVignette, Math.max(this.savedVignette, E.vignetteDim), s.dim);
    }
  }

  private finish(reason: 'done' | 'cancelled'): void {
    if (this.finished) return;
    this.finished = true;
    this.current = 'done';
    const d = this.d;
    this.oldForm.dispose();
    this.newForm.dispose();
    this.site(false);
    const L = d.light; const sv = this.saved;
    L.position.copy(sv.position); d.lightTarget.position.copy(sv.target); L.color.copy(sv.color);
    L.intensity = sv.intensity; L.angle = sv.angle; L.penumbra = sv.penumbra; L.distance = sv.distance; L.decay = sv.decay;
    L.shadow.autoUpdate = sv.autoUpdate;
    L.shadow.camera.layers.mask = sv.layers;
    if (d.post) { d.post.exposure.value = this.savedExposure; d.post.vignette.value = this.savedVignette; }
    if (reason === 'cancelled') {
      d.vfx.clear();
      if (d.rig.currentMode === 'inspect') d.rig.release(E.exitMs);   // a battle's push-in owns the camera: left alone
    }
    if (reason === 'done') this.req.onPhase?.('done');
    this.resolve(reason);
  }
}
