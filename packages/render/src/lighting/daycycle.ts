/**
 * SPEC §10.3.4 (day/night driver) and §10.3.5 (colour-temperature table).
 *
 * The top half is pure math (node-tested): keyframe interpolation, sun/moon geometry, the PMREM
 * re-bake rule. The bottom half is `DayCycle`, which writes those numbers into the lighting rig, the
 * sky, the fog and the shared material uniforms once per frame — uniform writes only, plus at most one
 * PMREM bake per frame when due. No wall clock: time comes in through `update(realDtMs)`.
 */
import type { Vector3 } from 'three/webgpu';
import type { WeatherKind } from '../descriptors.js';
import type { SharedUniforms } from '../materials/harvest.js';
import { stepWetness } from '../materials/harvest.js';
import { FOG_START_M, GROVE_FOG_DENSITY, type HeightFog } from './fog.js';
import type { LightRig } from './rig.js';
import type { SkyController } from './sky.js';
import { weatherParams, type WeatherParams } from './weather.js';
import { hexToSrgb, srgbToLinear } from './color.js';

// ---- colour helpers (pure) --------------------------------------------------------------------------

export type Rgb = readonly [number, number, number];
export { hexToSrgb, srgbToLinear } from './color.js';

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

// ---- §10.3.5 table ----------------------------------------------------------------------------------

export type DayKey = 'night' | 'predawn' | 'golden_am' | 'noon' | 'golden_pm' | 'dusk';

export interface DayKeyframe {
  readonly key: DayKey;
  readonly t: number;
  readonly note: string;
  readonly srgb: string;
  /** Key-light intensity in SPEC light units (the `night` row: the moon's). */
  readonly sun: number;
  readonly env: number;
  /** Hemisphere fill in SPEC light units, applied to the hemisphere colours normalised to a unit sky (§10.3.3). */
  readonly hemi: number;
  readonly punctual: number;
}

/**
 * SPEC §10.3.5 as amended 2026-09-30 (the M2 re-light, audit M2-spawn-noon-2 / M2-gym-dusk-2 / M2-lamps-night-5): the
 * 6 keyframes (t ascending) keyed to the §10.3.4 sun path (sunrise 0.17, noon 0.50, sunset 0.83), so `dusk` (0.80) is
 * the golden hour with the sun 10° up. A warm key over a cool, low fill: noon key:fill ≥ 3:1. `night` is the moon row
 * (its own path, §10.3.4) at 0.30 over a 0.06 fill, so the moon casts readable shadows.
 */
export const DAY_KEYFRAMES: readonly DayKeyframe[] = Object.freeze([
  { key: 'night', t: 0.00, note: 'moon (look decision, not blackbody)', srgb: '#9fb4e6', sun: 0.30, env: 0.10, hemi: 0.06, punctual: 1.00 },
  { key: 'predawn', t: 0.15, note: '2400 K', srgb: '#ff9d3f', sun: 0.10, env: 0.18, hemi: 0.07, punctual: 0.80 },
  { key: 'golden_am', t: 0.22, note: '3000 K', srgb: '#ffbd7a', sun: 0.75, env: 0.32, hemi: 0.08, punctual: 0.15 },
  { key: 'noon', t: 0.50, note: '5200 K', srgb: '#fff0dc', sun: 1.00, env: 0.45, hemi: 0.08, punctual: 0.00 },
  { key: 'golden_pm', t: 0.74, note: '3600 K', srgb: '#ffd6a0', sun: 0.95, env: 0.38, hemi: 0.08, punctual: 0.10 },
  { key: 'dusk', t: 0.80, note: '2400 K, sun 10° up', srgb: '#ffa04c', sun: 0.85, env: 0.30, hemi: 0.09, punctual: 0.55 },
] as const);

export const MOON_ROW: DayKeyframe = DAY_KEYFRAMES[0]!;

/** Wraps any real number into [0, 1). */
export function wrapTime(t: number): number {
  if (!Number.isFinite(t)) return 0;
  const w = t - Math.floor(t);
  return w >= 1 ? 0 : w;
}

export interface DaySample {
  /** Interpolated keyframe colour, sRGB 0..1 (interpolated in sRGB, §10.3.5). */
  readonly srgb: [number, number, number];
  /** The same colour converted to linear (what the light gets). */
  readonly linear: [number, number, number];
  sun: number;
  env: number;
  hemi: number;
  punctual: number;
  /** Sun-elevation daylight factor 0..1 (`daylightAt`). */
  daylight: number;
  /** Golden-hour weight 0..1 (`goldenAt`). */
  golden: number;
  /** Bracketing keyframes and the blend factor, for inspection. */
  a: DayKey;
  b: DayKey;
  f: number;
}

export function createDaySample(): DaySample {
  return { srgb: [1, 1, 1], linear: [1, 1, 1], sun: 1, env: 1, hemi: 0.08, punctual: 0, daylight: 1, golden: 0, a: 'noon', b: 'noon', f: 0 };
}

const KEY_SRGB: readonly (readonly [number, number, number])[] = DAY_KEYFRAMES.map((k) => hexToSrgb(k.srgb));

/**
 * Samples the table at `t` (wrapped). Linear between neighbours; dusk (0.80) → night (1.00 ≡ 0.00).
 * Writes into `out` (no allocation).
 */
export function sampleDay(t: number, out: DaySample = createDaySample()): DaySample {
  const tw = wrapTime(t);
  const n = DAY_KEYFRAMES.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) { if (DAY_KEYFRAMES[k]!.t <= tw) i = k; else break; }
  const j = (i + 1) % n;
  const ka = DAY_KEYFRAMES[i]!;
  const kb = DAY_KEYFRAMES[j]!;
  const tb = j === 0 ? 1 : kb.t;
  const f = tb > ka.t ? (tw - ka.t) / (tb - ka.t) : 0;
  const ca = KEY_SRGB[i]!;
  const cb = KEY_SRGB[j]!;
  for (let c = 0; c < 3; c++) {
    const s = lerp(ca[c]!, cb[c]!, f);
    out.srgb[c] = s;
    out.linear[c] = srgbToLinear(s);
  }
  out.sun = lerp(ka.sun, kb.sun, f);
  out.env = lerp(ka.env, kb.env, f);
  out.hemi = lerp(ka.hemi, kb.hemi, f);
  out.punctual = lerp(ka.punctual, kb.punctual, f);
  out.daylight = daylightAt(tw);
  out.golden = goldenAt(tw);
  out.a = ka.key; out.b = kb.key; out.f = f;
  return out;
}

// ---- §10.3.4 geometry --------------------------------------------------------------------------------

/**
 * §10.3.4 as amended 2026-09-30: the sun is up from `SUNRISE_T` to `SUNSET_T` (a 0.66 day, symmetric about noon), so
 * t 0.80 is golden hour (10° up) instead of 21.6° below the horizon. The render-side sun is a look decision; the
 * server's gameplay day (`isDay`: 0.25 ≤ t < 0.75, spawn tables) is unchanged.
 */
export const SUNRISE_T = 0.17;
export const SUNSET_T = 0.83;
export const SUN_MAX_ELEVATION_DEG = 70;
/** Deepest sun elevation (midnight): only the sky model and the switch read it. */
export const SUN_MIN_ELEVATION_DEG = -60;
/** The moon's own path: highest at midnight, 40° up. */
export const MOON_MAX_ELEVATION_DEG = 40;

const DAY_SPAN = SUNSET_T - SUNRISE_T;

/** 0 at sunrise … 1 at sunset (outside [0, 1] at night). */
function dayFraction(t: number): number { return (wrapTime(t) - SUNRISE_T) / DAY_SPAN; }
/** 0 at sunset … 1 at the next sunrise (the night arc). */
function nightFraction(t: number): number { return wrapTime(wrapTime(t) - SUNSET_T) / (1 - DAY_SPAN); }
function isDayArc(t: number): boolean { const f = dayFraction(t); return f >= 0 && f <= 1; }

/** Sun elevation: `70 · sin(π · f)` over the day arc, `−60 · sin(π · g)` over the night arc. */
export function sunElevationDeg(t: number): number {
  if (isDayArc(t)) return SUN_MAX_ELEVATION_DEG * Math.sin(Math.PI * dayFraction(t));
  return SUN_MIN_ELEVATION_DEG * Math.sin(Math.PI * nightFraction(t));
}

/**
 * Sun azimuth: 150° at sunrise → 90° (+x) at noon → 30° at sunset (from +z toward +x: the default heading sees a
 * raking key from its right at dusk), and on round the far side through the night. Continuous.
 */
export function sunAzimuthDeg(t: number): number {
  if (isDayArc(t)) return 150 - 120 * dayFraction(t);
  return 30 - 240 * nightFraction(t);
}

/** Moon elevation: `40 · sin(π · g)` over the night arc (below the horizon by day). */
export function moonElevationDeg(t: number): number {
  if (isDayArc(t)) return -MOON_MAX_ELEVATION_DEG * Math.sin(Math.PI * dayFraction(t));
  return MOON_MAX_ELEVATION_DEG * Math.sin(Math.PI * nightFraction(t));
}

/** Moon azimuth: 300° at sunset → 360° at sunrise (from −x/+z: its shadows fall ≥ 110° from noon's). */
export function moonAzimuthDeg(t: number): number {
  if (isDayArc(t)) return 360 - 60 * dayFraction(t);
  return 300 + 60 * nightFraction(t);
}

export interface Vec3Like { x: number; y: number; z: number }

const DEG = Math.PI / 180;

/** Unit vector FROM the scene TOWARD a body at (elevation, azimuth) degrees: (cos el·sin az, sin el, cos el·cos az). */
export function directionFromAngles(elevationDeg: number, azimuthDeg: number, out: Vec3Like): Vec3Like {
  const el = elevationDeg * DEG;
  const az = azimuthDeg * DEG;
  out.x = Math.cos(el) * Math.sin(az);
  out.y = Math.sin(el);
  out.z = Math.cos(el) * Math.cos(az);
  return out;
}

export function sunDirection(t: number, out: Vec3Like): Vec3Like {
  return directionFromAngles(sunElevationDeg(t), sunAzimuthDeg(t), out);
}

/** The moon on its own path (§10.3.4 as amended): `moonElevationDeg`, `moonAzimuthDeg`. */
export function moonDirection(t: number, out: Vec3Like): Vec3Like {
  return directionFromAngles(moonElevationDeg(t), moonAzimuthDeg(t), out);
}

/** §10.3.4: below this sun elevation the one DirectionalLight becomes the moon. */
export const MOON_SWITCH_DEG = -4;

export function isMoonLight(t: number): boolean {
  return sunElevationDeg(t) < MOON_SWITCH_DEG;
}

/** Distance of the directional light from the focus (§10.3.4 `sun.position = focus + sunDir · 120`). */
export const SUN_DISTANCE = 120;

/** One full day = 48 real minutes (spine §4.1). The client drives `setTimeOfDay`; render never advances it. */
export const DAY_LENGTH_REAL_MS = 48 * 60 * 1000;

const smooth = (e0: number, e1: number, x: number): number => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};

export interface DirectionalState {
  readonly dir: [number, number, number];
  readonly linear: [number, number, number];
  intensity: number;
  isMoon: boolean;
}

export function createDirectionalState(): DirectionalState {
  return { dir: [0, 1, 0], linear: [1, 1, 1], intensity: 1, isMoon: false };
}

const _dir: Vec3Like = { x: 0, y: 1, z: 0 };
const MOON_LINEAR: [number, number, number] = hexToSrgb(MOON_ROW.srgb).map(srgbToLinear) as [number, number, number];

/**
 * The single directional light's direction/colour/intensity at `t` (§10.3.4–§10.3.5): the sun's intensity fades to
 * 0 over elevation [−4°, +2°] and the moon's over the moon's own elevation [+4°, +10°], so the switch at −4° — which
 * flips the light direction — happens at ~0 intensity instead of popping shadows.
 */
export function directionalAt(t: number, day: DaySample, out: DirectionalState = createDirectionalState()): DirectionalState {
  const el = sunElevationDeg(t);
  if (el < MOON_SWITCH_DEG) {
    moonDirection(t, _dir);
    out.isMoon = true;
    out.linear[0] = MOON_LINEAR[0]; out.linear[1] = MOON_LINEAR[1]; out.linear[2] = MOON_LINEAR[2];
    out.intensity = MOON_ROW.sun * smooth(4, 10, moonElevationDeg(t));
  } else {
    sunDirection(t, _dir);
    out.isMoon = false;
    out.linear[0] = day.linear[0]; out.linear[1] = day.linear[1]; out.linear[2] = day.linear[2];
    out.intensity = day.sun * smooth(-4, 2, el);
  }
  out.dir[0] = _dir.x; out.dir[1] = _dir.y; out.dir[2] = _dir.z;
  return out;
}

// ---- §10.3.3 re-bake rule ----------------------------------------------------------------------------

export const REBAKE_DEG = 2;
export const REBAKE_MS = 20_000;

export interface BakeState { lastElevationDeg: number; sinceBakeMs: number; baked: boolean; forced: boolean }

export function createBakeState(): BakeState {
  return { lastElevationDeg: 0, sinceBakeMs: 0, baked: false, forced: true };
}

/** Re-bake when |Δ sun elevation| ≥ 2° since the last bake OR 20 s of real time have passed (or forced). */
export function rebakeDue(s: BakeState, elevationDeg: number): boolean {
  return s.forced || !s.baked || Math.abs(elevationDeg - s.lastElevationDeg) >= REBAKE_DEG || s.sinceBakeMs >= REBAKE_MS;
}

export function markBaked(s: BakeState, elevationDeg: number): void {
  s.lastElevationDeg = elevationDeg; s.sinceBakeMs = 0; s.baked = true; s.forced = false;
}

// ---- palette (render-side lighting subset of §10.5.3 `Palette`) -------------------------------------

export interface LightingPalette {
  readonly skyZenith: string;
  readonly skyHorizon: string;
  readonly groundBounce: string;
  readonly fogColor: readonly [night: string, noon: string];
  readonly fogDensity: number;
  /** m of view depth before the fog starts (§10.3.7 as amended 2026-09-30); absent = `FOG_START_M`. */
  readonly fogStart?: number;
  readonly fogBase: number;
  readonly fogFalloff: number;
}

/** §10.3.7 grove values (fog) + provisional sky/bounce colours until the zone agent's PALETTES land. */
export const GROVE_LIGHTING: LightingPalette = Object.freeze({
  skyZenith: '#8fb3de',
  skyHorizon: '#dfe6d6',
  groundBounce: '#5d6b3f',
  fogColor: ['#1a2030', '#b9c7a8'] as const,
  fogDensity: GROVE_FOG_DENSITY,   // §10.3.7 as amended 2026-09-30: 0.00486 past 15 m (was 0.0068 from the eye)
  fogStart: FOG_START_M,
  fogBase: 0.0,
  fogFalloff: 0.35,
});

/** Night-side hemisphere colours the palette colours blend toward as daylight falls. */
const NIGHT_SKY = hexToSrgb('#1a2440');
const NIGHT_GROUND = hexToSrgb('#0c0f14');

/**
 * Daylight factor 0..1 used to blend the palette's night/noon pairs (hemisphere colours, fog colour, the grade's lift):
 * the sun's elevation, 0 at −8° (deep twilight) … 1 at +14° (§10.3.5 as amended 2026-09-30; it was the keyframe sun
 * intensity, which the moon row now shares).
 */
export function daylight(day: DaySample): number {
  return day.daylight;
}

/** `daylight` of a time of day. Pure. */
export function daylightAt(t: number): number {
  return smooth(-8, 14, sunElevationDeg(t));
}

/**
 * Golden-hour weight 0..1: 1 while the sun is between 2° and 16° up, easing out by 30° and to 0 at −3°. Tints the fog
 * toward the key colour (a warm haze at dusk and dawn).
 */
export function goldenAt(t: number): number {
  const el = sunElevationDeg(t);
  return smooth(-3, 2, el) * (1 - smooth(16, 30, el));
}

/** Blends two sRGB hex colours in sRGB and returns linear components (no allocation). */
export function mixSrgbToLinear(a: readonly number[], b: readonly number[], f: number, out: [number, number, number]): [number, number, number] {
  for (let c = 0; c < 3; c++) out[c] = srgbToLinear(lerp(a[c]!, b[c]!, f));
  return out;
}

// ---- the driver ---------------------------------------------------------------------------------------

export interface DayCycleTargets {
  readonly rig: LightRig;
  readonly sky: SkyController;
  readonly fog: HeightFog;
  readonly shared: SharedUniforms;
}

const _lin: [number, number, number] = [1, 1, 1];
const _sky: [number, number, number] = [1, 1, 1];
const _ground: [number, number, number] = [0, 0, 0];

/**
 * Owns time-of-day + weather state and writes it out each frame. The client calls `setTime` (from the
 * server clock) and `setWeather`; `update` does uniform writes and at most one PMREM bake.
 */
export class DayCycle {
  private t = 0.5;
  private palette: LightingPalette = GROVE_LIGHTING;
  private paletteSrgb = {
    zenith: hexToSrgb(GROVE_LIGHTING.skyZenith), ground: hexToSrgb(GROVE_LIGHTING.groundBounce),
    fogNight: hexToSrgb(GROVE_LIGHTING.fogColor[0]), fogNoon: hexToSrgb(GROVE_LIGHTING.fogColor[1]),
  };
  private weather: WeatherParams = weatherParams('none');
  private weatherKind: WeatherKind = 'none';
  private readonly day = createDaySample();
  private readonly dir = createDirectionalState();
  private readonly bake = createBakeState();
  private disposed = false;

  constructor(private readonly x: DayCycleTargets) {}

  get timeOfDay(): number { return this.t; }
  get currentWeather(): WeatherKind { return this.weatherKind; }
  get sample(): Readonly<DaySample> { return this.day; }
  get directional(): Readonly<DirectionalState> { return this.dir; }

  setTime(t: number): void {
    this.t = wrapTime(t);
  }

  setPalette(p: LightingPalette): void {
    this.palette = p;
    this.paletteSrgb = {
      zenith: hexToSrgb(p.skyZenith), ground: hexToSrgb(p.groundBounce),
      fogNight: hexToSrgb(p.fogColor[0]), fogNoon: hexToSrgb(p.fogColor[1]),
    };
  }

  setWeather(w: WeatherKind): void {
    this.weatherKind = w;
    this.weather = weatherParams(w);
    this.x.sky.setCloudCoverage(this.weather.cloudCoverage);
    this.bake.forced = true;                   // cloud cover changes the IBL
  }

  /** Forces a PMREM bake on the next update (harvest level / palette change). */
  invalidateEnvironment(): void { this.bake.forced = true; }

  /**
   * @param realDtMs  unscaled frame time (drives the 20 s re-bake timer)
   * @param scaledDtS frame time × timeScale in seconds (drives wetness / flicker clocks)
   * @param focus     the camera focus the sun follows (§10.3.1)
   */
  update(realDtMs: number, scaledDtS: number, focus: Vector3): void {
    if (this.disposed) return;
    const { rig, sky, fog, shared } = this.x;
    const day = sampleDay(this.t, this.day);
    const d = directionalAt(this.t, day, this.dir);
    const w = this.weather;

    shared.timeOfDay.value = this.t;
    shared.wetness.value = stepWetness(shared.wetness.value, w.wetTarget, scaledDtS);

    rig.setFocus(focus);
    rig.applyDirectional(d.dir, d.linear, d.intensity * w.sunMul);
    rig.setPunctualMultiplier(day.punctual);

    const lit = day.daylight;
    const p = this.paletteSrgb;
    // §10.3.3 as amended: the hemisphere colours are normalised to a unit sky (the ground keeps its ratio to the sky)
    // and the keyframe's `hemi` column carries the level, so the cool fill is a number of the table, not of the palette
    mixSrgbToLinear(NIGHT_SKY, p.zenith, lit, _sky);
    mixSrgbToLinear(NIGHT_GROUND, p.ground, lit, _ground);
    const top = Math.max(_sky[0], _sky[1], _sky[2], 1e-4);
    for (let c = 0; c < 3; c++) { _sky[c] = _sky[c]! / top; _ground[c] = _ground[c]! / top; }
    rig.setHemisphere(_sky, _ground, day.hemi * w.envMul);

    mixSrgbToLinear(p.fogNight, p.fogNoon, lit, _lin);
    // golden hours: the haze takes the low sun's colour (up to 45 % of the fog)
    if (day.golden > 0) {
      const g = day.golden * 0.45;
      const luma = 0.2126 * _lin[0] + 0.7152 * _lin[1] + 0.0722 * _lin[2];
      for (let c = 0; c < 3; c++) _lin[c] = lerp(_lin[c]!, day.linear[c]! * luma * 1.25, g);
    }
    if (w.fogTint !== null) {
      const tint = w.fogTintSrgb!;
      for (let c = 0; c < 3; c++) _lin[c] = lerp(_lin[c]!, srgbToLinear(tint[c]!), 0.6);
    }
    fog.uniforms.fogColor.value.setRGB(_lin[0], _lin[1], _lin[2]);
    fog.uniforms.fogDensity.value = this.palette.fogDensity * w.fogDensityMul;
    fog.uniforms.fogStart.value = (this.palette.fogStart ?? FOG_START_M) / Math.max(1, w.fogDensityMul);
    fog.uniforms.fogBase.value = this.palette.fogBase;
    fog.uniforms.fogFalloff.value = this.palette.fogFalloff;

    // Sky follows the real sun even below the horizon (§10.3.4).
    sunDirection(this.t, _dir);
    sky.setSunDirection(_dir.x, _dir.y, _dir.z);
    sky.setEnvironmentIntensity(day.env * w.envMul);

    this.bake.sinceBakeMs += realDtMs;
    const el = sunElevationDeg(this.t);
    if (rebakeDue(this.bake, el)) {
      sky.bake();
      markBaked(this.bake, el);
    }
  }

  /** §10.1.5 `daycycle.dispose()`: the PMREM generator + its target and the sky meshes. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.x.sky.dispose();
  }
}
