/**
 * Colour ramps for the character paper-doll (pixel-art craft rules, IMPLEMENTATION-NOTES "Art rules").
 *
 * Every material is a 4-tone ramp — highlight, base, shadow, deep — plus two line colours (the selective outline:
 * `line` on shadowed/bottom edges, `lineLit` on lit/top edges). Ramps are built in OKLCH so a lightness step
 * looks the same on every hue, and they are HUE-SHIFTED the way pixel artists do it: highlights turn warm
 * (toward yellow), shadows turn cool (toward blue-violet; skin shadows toward rose instead), and the line is a
 * dark, desaturated relative of the material, never black. A look may pin any ramp by hand (`[hl, base, sh, deep]`).
 *
 * Pure integer/float arithmetic, deterministic to the byte.
 */

export type Rgb = readonly [number, number, number];

/** 4 tones (0 = highlight … 3 = deep) + the two outline colours. */
export interface Ramp {
  readonly tones: readonly [Rgb, Rgb, Rgb, Rgb];
  readonly line: Rgb;
  readonly lineLit: Rgb;
}

export type RampKind = 'cloth' | 'skin' | 'hair' | 'metal' | 'gold' | 'leather' | 'white' | 'dark' | 'eye';

// ---- sRGB <-> OKLab ------------------------------------------------------------------------------------------

function toLinear(c: number): number { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }
function toSrgb(x: number): number {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

interface Lch { l: number; c: number; h: number }

export function rgbToOklch(rgb: Rgb): Lch {
  const r = toLinear(rgb[0]); const g = toLinear(rgb[1]); const b = toLinear(rgb[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

export function oklchToRgb(p: Lch): Rgb {
  const hr = (p.h * Math.PI) / 180;
  const A = p.c * Math.cos(hr); const B = p.c * Math.sin(hr);
  // reduce chroma until the colour is inside sRGB (keeps lightness and hue: no clipping shifts)
  for (let k = 0; k < 24; k++) {
    const c = k === 0 ? 1 : 1 - k / 24;
    const a = A * c; const b = B * c;
    const l = (p.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (p.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (p.l - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    const eps = 1e-4;
    if ((r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && bb >= -eps && bb <= 1 + eps) || k === 23) {
      return [toSrgb(Math.max(0, r)), toSrgb(Math.max(0, g)), toSrgb(Math.max(0, bb))];
    }
  }
  return [0, 0, 0];
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new RangeError(`character-pipeline: bad colour '${hex}'`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(c: Rgb): string {
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---- hue-shifted ramps ---------------------------------------------------------------------------------------

/** Moves hue `h` toward `target` by at most `deg` degrees along the short way round. */
function hueToward(h: number, target: number, deg: number): number {
  let d = target - h;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  const step = Math.sign(d) * Math.min(Math.abs(d), deg);
  const out = h + step;
  return out < 0 ? out + 360 : out >= 360 ? out - 360 : out;
}

interface RampRule {
  /** Lightness deltas (OKLab L) of highlight, shadow, deep. */
  readonly dl: readonly [number, number, number];
  /** Chroma multipliers of highlight, shadow, deep. */
  readonly cm: readonly [number, number, number];
  /** Hue targets for the warm highlight and the cool shadow, and the shift amounts (hl, sh, deep). */
  readonly warm: number; readonly cool: number; readonly shift: readonly [number, number, number];
  /** Line lightness = min(deep − lineDrop, lineMax); lit line = deep − litDrop. */
  readonly lineDrop: number; readonly lineMax: number; readonly litDrop: number;
  readonly lineChroma: number;
}

const WARM = 88;    // OKLCH hue of a warm yellow
const COOL = 282;   // OKLCH hue of a blue-violet
const ROSE = 18;    // skin shadows turn rose, not blue

const RULES: Readonly<Record<RampKind, RampRule>> = {
  cloth: { dl: [0.075, -0.085, -0.165], cm: [0.9, 1.05, 1.0], warm: WARM, cool: COOL, shift: [8, 10, 18], lineDrop: 0.13, lineMax: 0.33, litDrop: 0.05, lineChroma: 0.7 },
  leather: { dl: [0.07, -0.08, -0.15], cm: [0.9, 1.08, 1.05], warm: WARM, cool: 30, shift: [8, 8, 14], lineDrop: 0.12, lineMax: 0.28, litDrop: 0.05, lineChroma: 0.8 },
  skin: { dl: [0.055, -0.07, -0.14], cm: [0.85, 1.15, 1.25], warm: WARM, cool: ROSE, shift: [6, 12, 20], lineDrop: 0.2, lineMax: 0.38, litDrop: 0.08, lineChroma: 0.9 },
  hair: { dl: [0.09, -0.085, -0.16], cm: [0.9, 1.05, 1.0], warm: WARM, cool: COOL, shift: [10, 10, 18], lineDrop: 0.1, lineMax: 0.28, litDrop: 0.04, lineChroma: 0.7 },
  metal: { dl: [0.13, -0.11, -0.22], cm: [0.7, 1.2, 1.35], warm: WARM, cool: 255, shift: [6, 14, 22], lineDrop: 0.12, lineMax: 0.3, litDrop: 0.06, lineChroma: 1.0 },
  gold: { dl: [0.1, -0.1, -0.2], cm: [0.8, 1.05, 1.0], warm: 105, cool: 50, shift: [12, 14, 24], lineDrop: 0.12, lineMax: 0.33, litDrop: 0.05, lineChroma: 0.9 },
  white: { dl: [0.04, -0.07, -0.15], cm: [0.8, 1.6, 2.2], warm: WARM, cool: 265, shift: [6, 30, 40], lineDrop: 0.22, lineMax: 0.42, litDrop: 0.1, lineChroma: 1.5 },
  dark: { dl: [0.08, -0.05, -0.09], cm: [1.0, 1.1, 1.1], warm: WARM, cool: COOL, shift: [6, 12, 20], lineDrop: 0.05, lineMax: 0.2, litDrop: 0.03, lineChroma: 0.8 },
  eye: { dl: [0.1, -0.06, -0.12], cm: [1, 1, 1], warm: WARM, cool: COOL, shift: [0, 0, 0], lineDrop: 0.05, lineMax: 0.2, litDrop: 0.02, lineChroma: 0.8 },
};

/** A hue-shifted 4-tone ramp around `base` (the base tone is `base` exactly). */
export function makeRamp(base: string, kind: RampKind): Ramp {
  const rgb = hexToRgb(base);
  const p = rgbToOklch(rgb);
  const r = RULES[kind];
  const achromatic = p.c < 0.012;
  const tone = (dl: number, cm: number, target: number, deg: number): Rgb => oklchToRgb({
    l: Math.max(0.04, Math.min(0.98, p.l + dl)),
    c: achromatic ? Math.min(0.03, p.c * cm + (kind === 'white' || kind === 'metal' ? 0.012 : 0.004)) : p.c * cm,
    h: hueToward(p.h, target, deg),
  });
  const hl = tone(r.dl[0], r.cm[0], r.warm, r.shift[0]);
  const sh = tone(r.dl[1], r.cm[1], r.cool, r.shift[1]);
  const deep = tone(r.dl[2], r.cm[2], r.cool, r.shift[2]);
  const deepL = Math.max(0.04, p.l + r.dl[2]);
  const lineL = Math.max(0.1, Math.min(deepL - r.lineDrop, r.lineMax));
  const lineH = hueToward(p.h, kind === 'skin' ? ROSE : COOL, r.shift[2] + 8);
  const lineC = Math.min(0.09, (achromatic ? 0.02 : p.c) * r.lineChroma);
  const line = oklchToRgb({ l: lineL, c: lineC, h: lineH });
  const lineLit = oklchToRgb({ l: Math.max(lineL + 0.03, Math.min(deepL - r.litDrop, lineL + 0.1)), c: lineC * 1.1, h: lineH });
  return { tones: [hl, rgb, sh, deep], line, lineLit };
}

/** A hand-pinned ramp: 4 tones in order highlight, base, shadow, deep (+ optional line colours). */
export function pinnedRamp(tones: readonly [string, string, string, string], line?: string, lineLit?: string): Ramp {
  const t = tones.map(hexToRgb) as unknown as [Rgb, Rgb, Rgb, Rgb];
  const deep = rgbToOklch(t[3]);
  const l = line !== undefined ? hexToRgb(line) : oklchToRgb({ l: Math.max(0.1, Math.min(deep.l - 0.12, 0.3)), c: deep.c * 0.8, h: hueToward(deep.h, COOL, 12) });
  const ll = lineLit !== undefined ? hexToRgb(lineLit) : oklchToRgb({ l: Math.min(deep.l - 0.04, rgbToOklch(l).l + 0.08), c: deep.c * 0.9, h: deep.h });
  return { tones: t, line: l, lineLit: ll };
}

/** Perceptual lightness 0..1 (OKLab L) of an sRGB colour. */
export function lightness(c: Rgb): number { return rgbToOklch(c).l; }
