/**
 * SPEC §10.4.3 / §10.4.6 / §10.4.7 numbers and the pure pose/animation math of `CreatureBillboard`.
 * No `three` import: node tests read these tables directly (`billboard.test.ts`).
 */
import type { BattlerPose, ShinyPalette, SpriteFrame, VariantKey } from '../contracts.js';

const DEG = Math.PI / 180;

// ---- §10.4.3 / §10.4.5 / §10.4.7 constants ------------------------------------------------------------------

export const BILLBOARD = Object.freeze({
  /**
   * The share of a 1024² frame the pipeline's normalisation fills (881 px over the longest side): the body height of an
   * upright sprite, used when a frame carries no measured `bodyV`.
   */
  bodyV: 0.86,
  /** Level-0 texels per metre (1024 texels over 1.6 m). */
  texelsPerMetre: 640,
  /** `isAlpha`: quad scale ×1.12, contact decal ×1.12, `alphaGlow 1`. */
  alphaScale: 1.12,
  alphaTest: 0.5,
  roughness: 0.85,
  metalness: 0,
  rimPower: 3.0,
  rimStrength: 0.6,
  /** §10.7.8 the sun's rim: edge power, the share it keeps when the sun is not behind the creature */
  sunRimPower: 3.4,
  sunRimSide: 0.3,
  /** §10.7.8 the contact shade at the feet: albedo × at the foot line, easing to 1 over this much of the card (uv) */
  footShade: 0.74,
  footShadeBand: 0.16,
  /** Creature emissive pixels output `1.8 × albedo` (≥ 1.35 scene-linear, above the 1.15 bloom threshold). */
  emissiveGain: 1.8,
  shimmerAmp: 0.25,
  shimmerRate: 3.0,
  shimmerBands: 8.0,
  /**
   * Phase D4 shiny sparkle: `alphaGlow` carries +2 for a shiny (alpha keeps its 0/1 in the remainder), so no
   * per-object field is added. Twinkle cells of 1/sparkleCells of the card re-hash sparkleRate times a second;
   * the top sparkleDensity of each draw lights at sparkleGain × a warm white.
   */
  shinyGlow: 2,
  sparkleCells: 14,
  sparkleRate: 5,
  sparkleDensity: 0.06,
  sparkleGain: 2.4,
  hurtFlashMix: 0.85,
  /**
   * Evolution glow (§10.7.5 evolution sequence): `glow` 0..1 mixes the lit albedo to white and adds `glow × glowGain`
   * white emissive (scene-linear, above the 1.15 bloom threshold), so the card reads as a glowing white silhouette of
   * its own alpha at any time of day. 0 for every other billboard (the term is in the one billboard program from boot).
   */
  glowGain: 1.3,
  /** Dissolve holes: `hash(floor(uvRect × dissolveCells))` — 1024 per uv unit on a 2048² atlas (and on a single). */
  dissolveCells: 1024,
  /**
   * Flipbooks (amended 2026-10-06): holes per anim cell edge, so a 512² anim cell gets 1-texel holes — the same share of
   * the creature (1/512 of the cell) as the 2-texel holes of a 1024² static cell; `dissolveCells` per object becomes
   * `512 / (rect width, height in uv)`.
   */
  dissolveCellsPerFrame: 512,
  /** §10.4.7 contact decal: this share of the card's width (1.1 m on the old 1.6 m card), opacity 0.55, radial smoothstep(0.5, 0.05). */
  decalOfWidth: 0.6875,
  decalOpacity: 0.55,
  decalInner: 0.05,
  decalOuter: 0.5,
  decalRenderOrder: 5,
  decalPolygonOffset: -2,
  /**
   * Implementation interpretation (IMPLEMENTATION-NOTES "Part 3" P3): the quad leans back toward the camera by
   * this fraction of the camera's downward pitch, about the foot line, so a vertical card seen from the −52°
   * diorama camera is not foreshortened to cos 52° = 0.62 of its height. It is a uniform written once per frame
   * like `cameraYaw` and read by the same `positionNode`, so the shadow pass sees the same geometry.
   */
  leanFraction: 0.5,
});

/** §10.4.6 animation rules. */
export const ANIM = Object.freeze({
  /** Idle bob: 0.015 · H · sin(2π · 0.5 · t + phase). */
  bobAmp: 0.015,
  bobHz: 0.5,
  /** Hurt flash: hurt *= exp(−dt / 70 ms); visible ≈ 220 ms. */
  hurtTauMs: 70,
  /** Below this the flash is written as exactly 0 (so an idle billboard writes a constant). */
  hurtFloor: 1e-3,
});

// ---- §10.4.6 variant palettes (spine §3.7 triples, hue in radians) --------------------------------------------

export interface VariantUniforms { readonly hueDeg: number; readonly hueShift: number; readonly satMul: number; readonly lightMul: number }

const v = (hueDeg: number, satMul: number, lightMul: number): VariantUniforms => Object.freeze({ hueDeg, hueShift: hueDeg * DEG, satMul, lightMul });

export const VARIANT_UNIFORMS: Readonly<Record<VariantKey, VariantUniforms>> = Object.freeze({
  normal: v(0, 1.0, 1.0),
  dawn: v(18, 1.08, 1.04),
  dusk: v(204, 1.1, 0.95),
  verdant: v(110, 1.12, 1.05),
  ember: v(-18, 1.15, 1.02),
});

export const VARIANT_KEYS: readonly VariantKey[] = Object.freeze(['normal', 'dawn', 'dusk', 'verdant', 'ember'] as const);

/** The four per-object palette values (`hueShift`, `satMul`, `lightMul`, `alphaGlow`) plus the quad scale. */
export interface PaletteValues { hueShift: number; satMul: number; lightMul: number; alphaGlow: number; scale: number }

/**
 * A shiny with a `shiny` palette (2026-10-26) wears it in place of the variant's: same three values, so a shiny never
 * adds a material, a uniform or a pixel; without one it keeps the variant's colours (the Phase D4 sparkle only).
 */
export function paletteFor(variant: VariantKey, isAlpha: boolean, out: PaletteValues, isShiny = false, shiny: ShinyPalette | null = null): PaletteValues {
  if (isShiny && shiny !== null) {
    out.hueShift = shiny.hue * DEG;
    out.satMul = shiny.saturation;
    out.lightMul = shiny.lightness;
  } else {
    const p = VARIANT_UNIFORMS[variant] ?? VARIANT_UNIFORMS.normal;
    out.hueShift = p.hueShift;
    out.satMul = p.satMul;
    out.lightMul = p.lightMul;
  }
  out.alphaGlow = (isAlpha ? 1 : 0) + (isShiny ? BILLBOARD.shinyGlow : 0);
  out.scale = isAlpha ? BILLBOARD.alphaScale : 1;
  return out;
}

// ---- §10.4.3 geometry and anchoring -------------------------------------------------------------------------

export interface BillboardDims { heightM: number; widthM: number; yMin: number; yMax: number; decalM: number }

/** A creature this tall (m) when its descriptor names no usable height. */
export const FALLBACK_HEIGHT_M = 1.2;

const usableBodyV = (v: number | undefined): number => (v !== undefined && v > 0 && v <= 1 ? v : BILLBOARD.bodyV);

/**
 * The body share a side's card is sized by: the front's own; the back's own, unless the back sprite is drawn lower and
 * wider than the front (astaroth's spread wings, kygra lying flat), when it takes the front's, so a creature never
 * draws bigger from behind than from the front (it then stands a little lower from behind, as its back art does).
 * `backFullHeight` (`SpriteDescriptor.backFullHeight`) opts out: the back keeps its own share and stands its full height.
 */
export function cardBodyV(front: Pick<SpriteFrame, 'bodyV'>, back: Pick<SpriteFrame, 'bodyV'>, side: 'front' | 'back', backFullHeight = false): number {
  const f = usableBodyV(front.bodyV);
  if (side === 'front') return f;
  return backFullHeight ? usableBodyV(back.bodyV) : Math.max(f, usableBodyV(back.bodyV));
}

/**
 * The card is sized so the creature in it stands `creatureM` tall (× 1.12 alpha): H = creatureM / bodyV, width = H ×
 * aspect; the local origin is the foot point. `heightM` here is the card's height, not the creature's. `bodyV` defaults
 * to the frame's own (`cardBodyV` picks it per side).
 */
export function billboardDims(frame: Pick<SpriteFrame, 'footV' | 'aspect' | 'bodyV'>, creatureM: number, isAlpha: boolean, out: BillboardDims, bodyV: number | undefined = frame.bodyV): BillboardDims {
  const k = isAlpha ? BILLBOARD.alphaScale : 1;
  const m = Number.isFinite(creatureM) && creatureM > 0 ? creatureM : FALLBACK_HEIGHT_M;
  const body = usableBodyV(bodyV);
  const H = (m / body) * k;
  out.heightM = H;
  out.widthM = H * (frame.aspect > 0 ? frame.aspect : 1);
  out.yMin = -frame.footV * H;
  out.yMax = (1 - frame.footV) * H;
  out.decalM = BILLBOARD.decalOfWidth * out.widthM;
  return out;
}

// ---- §10.4.6 idle bob / hurt decay --------------------------------------------------------------------------

/** FNV-1a 32 of a string → [0, 1). Deterministic phase so a party does not bob in unison. */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 4294967296;
}

export function bobPhase(id: string): number {
  return hash01(id) * 2 * Math.PI;
}

/** bob = 0.015 · H · sin(2π · 0.5 · t + phase), t in seconds. */
export function bobOffset(heightM: number, tSeconds: number, phase: number): number {
  return ANIM.bobAmp * heightM * Math.sin(2 * Math.PI * ANIM.bobHz * tSeconds + phase);
}

/** hurt *= exp(−dt / 70 ms), floored to exactly 0. */
export function decayHurt(hurt: number, dtMs: number): number {
  if (hurt <= 0) return 0;
  const h = hurt * Math.exp(-Math.max(0, dtMs) / ANIM.hurtTauMs);
  return h < ANIM.hurtFloor ? 0 : h;
}

// ---- §10.4.5 flipbook (amended 2026-10-06) -------------------------------------------------------------------------

/** Σ delays (ms): one loop of the flipbook. */
export function flipbookTotalMs(delaysMs: readonly number[]): number {
  let n = 0;
  for (let i = 0; i < delaysMs.length; i++) n += delaysMs[i]! > 0 ? delaysMs[i]! : 0;
  return n;
}

/**
 * The page shown at `tMs` on a looping flipbook with per-page `delaysMs` (`totalMs` = `flipbookTotalMs`). Pure,
 * allocation-free; O(pages). A degenerate flipbook (no positive delay) shows page 0.
 */
export function flipbookFrame(delaysMs: readonly number[], totalMs: number, tMs: number): number {
  if (!(totalMs > 0) || !Number.isFinite(tMs)) return 0;
  let t = tMs % totalMs;
  if (t < 0) t += totalMs;
  for (let i = 0; i < delaysMs.length; i++) {
    const d = delaysMs[i]! > 0 ? delaysMs[i]! : 0;
    if (t < d) return i;
    t -= d;
  }
  return delaysMs.length - 1;
}

/** Per-instance flipbook phase in [0, 1) (FNV of the id, salted so it is independent of the bob phase). */
export function flipbookPhase01(id: string): number {
  return hash01(`${id}#flipbook`);
}

// ---- §10.4.6 poses --------------------------------------------------------------------------------------------

/** One pose sample: every channel a pose may drive. */
export interface PoseSample {
  /** Metres toward the foe along the pose axis (negative = recoil). */
  forward: number;
  /** Metres added to the quad's y (sink < 0, hop > 0); the contact decal stays on the ground. */
  lift: number;
  scaleY: number;
  /** Dissolve 0..1, or NaN when the pose does not drive it. */
  dissolve: number;
}

interface PoseKey { readonly t: number; readonly forward?: number; readonly lift?: number; readonly scaleY?: number; readonly dissolve?: number }
export interface PoseDef {
  /** Default duration when `setPose(p, ms)` passes ms ≤ 0 (§10.4.6 values). */
  readonly defaultMs: number;
  readonly keys: readonly PoseKey[];
  /** Whether `hurt` starts a white flash (§10.4.6 "hurt: … + flash"). */
  readonly flash: boolean;
}

/**
 * §10.4.6 pose table as normalised keyframes (t ∈ 0..1 over the requested ms), smoothstep-eased per segment:
 * lunge +0.9 m over 120 ms, back over 180; windup scale y 0.94 then 1.04 over 250; hurt −0.3 m in 80 ms + flash;
 * recoil −0.25 m over 100, return over 150, no flash; enter/exit dissolve 1→0 / 0→1 over 450 / 350; faint
 * dissolve + 0.4 m sink; celebrate two 0.15 m hops over 600.
 */
export const POSES: Readonly<Record<BattlerPose, PoseDef>> = Object.freeze({
  idle: { defaultMs: 0, flash: false, keys: [{ t: 0, forward: 0, lift: 0, scaleY: 1 }, { t: 1, forward: 0, lift: 0, scaleY: 1 }] },
  lunge: { defaultMs: 300, flash: false, keys: [{ t: 0, forward: 0 }, { t: 0.4, forward: 0.9 }, { t: 1, forward: 0 }] },
  windup: { defaultMs: 250, flash: false, keys: [{ t: 0, scaleY: 1 }, { t: 0.45, scaleY: 0.94 }, { t: 0.85, scaleY: 1.04 }, { t: 1, scaleY: 1 }] },
  // §10.7.8 hit weight: knocked back and squashed on the hit, a small rebound, then settled
  hurt: {
    defaultMs: 260, flash: true,
    keys: [{ t: 0, forward: 0, scaleY: 1 }, { t: 50 / 260, scaleY: 0.86 }, { t: 90 / 260, forward: -0.38 }, { t: 150 / 260, scaleY: 1.05 }, { t: 1, forward: 0, scaleY: 1 }],
  },
  recoil: { defaultMs: 250, flash: false, keys: [{ t: 0, forward: 0 }, { t: 0.4, forward: -0.25 }, { t: 1, forward: 0 }] },
  enter: { defaultMs: 450, flash: false, keys: [{ t: 0, dissolve: 1 }, { t: 1, dissolve: 0 }] },
  exit: { defaultMs: 350, flash: false, keys: [{ t: 0, dissolve: 0 }, { t: 1, dissolve: 1 }] },
  faint: { defaultMs: 900, flash: false, keys: [{ t: 0, dissolve: 0, lift: 0 }, { t: 1, dissolve: 1, lift: -0.4 }] },
  celebrate: {
    defaultMs: 600, flash: false,
    keys: [{ t: 0, lift: 0 }, { t: 0.25, lift: 0.15 }, { t: 0.5, lift: 0 }, { t: 0.75, lift: 0.15 }, { t: 1, lift: 0 }],
  },
});

export const BATTLER_POSES: readonly BattlerPose[] = Object.freeze(['idle', 'lunge', 'windup', 'hurt', 'recoil', 'faint', 'enter', 'exit', 'celebrate'] as const);

function smooth(x: number): number { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); }

function channel(keys: readonly PoseKey[], name: 'forward' | 'lift' | 'scaleY' | 'dissolve', t: number, rest: number): number {
  let prev: PoseKey | null = null;
  for (const k of keys) {
    const val = k[name];
    if (val === undefined) continue;
    if (k.t >= t) {
      if (prev === null) return val;
      const pv = prev[name]!;
      const span = k.t - prev.t;
      return span <= 0 ? val : pv + (val - pv) * smooth((t - prev.t) / span);
    }
    prev = k;
  }
  return prev !== null ? prev[name]! : rest;
}

function drives(keys: readonly PoseKey[], name: 'dissolve'): boolean {
  for (const k of keys) if (k[name] !== undefined) return true;
  return false;
}

/** Samples `pose` at normalised time `t01` (clamped) into `out`. Pure, allocation-free. */
export function samplePose(pose: BattlerPose, t01: number, out: PoseSample): PoseSample {
  const def = POSES[pose] ?? POSES.idle;
  const t = Math.min(1, Math.max(0, Number.isFinite(t01) ? t01 : 1));
  out.forward = channel(def.keys, 'forward', t, 0);
  out.lift = channel(def.keys, 'lift', t, 0);
  out.scaleY = channel(def.keys, 'scaleY', t, 1);
  out.dissolve = drives(def.keys, 'dissolve') ? channel(def.keys, 'dissolve', t, 0) : Number.NaN;
  return out;
}

/** Duration actually used for `setPose(p, ms)`: the caller's ms, or the table default. */
export function poseDurationMs(pose: BattlerPose, ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? ms : (POSES[pose] ?? POSES.idle).defaultMs;
}
