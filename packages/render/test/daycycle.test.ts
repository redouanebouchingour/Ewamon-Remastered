import { describe, expect, it } from 'vitest';
import {
  DAY_KEYFRAMES, MOON_SWITCH_DEG, SUNRISE_T, SUNSET_T, createBakeState, createDaySample, daylightAt, directionalAt, goldenAt, hexToSrgb,
  isMoonLight, markBaked, moonAzimuthDeg, moonDirection, moonElevationDeg, rebakeDue, sampleDay, srgbToLinear, sunAzimuthDeg, sunDirection,
  sunElevationDeg, wrapTime,
} from '../src/lighting/daycycle.js';

const close = (a: number, b: number, eps = 1e-6): void => { expect(Math.abs(a - b)).toBeLessThan(eps); };

describe('§10.3.5 colour-temperature table (as amended 2026-10-06, the M2 re-light)', () => {
  it('has the six keyframes in order with the SPEC values', () => {
    expect(DAY_KEYFRAMES.map((k) => k.key)).toEqual(['night', 'predawn', 'golden_am', 'noon', 'golden_pm', 'dusk']);
    expect(DAY_KEYFRAMES.map((k) => k.t)).toEqual([0, 0.15, 0.22, 0.5, 0.74, 0.8]);
    expect(DAY_KEYFRAMES.map((k) => k.srgb)).toEqual(['#9fb4e6', '#ff9d3f', '#ffbd7a', '#fff0dc', '#ffd6a0', '#ffa04c']);
    expect(DAY_KEYFRAMES.map((k) => k.sun)).toEqual([0.3, 0.1, 0.75, 1.0, 0.95, 0.85]);
    expect(DAY_KEYFRAMES.map((k) => k.env)).toEqual([0.1, 0.18, 0.32, 0.45, 0.38, 0.3]);
    expect(DAY_KEYFRAMES.map((k) => k.hemi)).toEqual([0.06, 0.07, 0.08, 0.08, 0.08, 0.09]);
    expect(DAY_KEYFRAMES.map((k) => k.punctual)).toEqual([1.0, 0.8, 0.15, 0.0, 0.1, 0.55]);
  });

  it('keeps a warm key over a cool, low fill: noon key:fill (sun : hemi) is at least 3:1 (audit M2-spawn-noon-2)', () => {
    const noon = DAY_KEYFRAMES.find((k) => k.key === 'noon')!;
    expect(noon.sun / noon.hemi).toBeGreaterThanOrEqual(3);
    expect(noon.env).toBeLessThanOrEqual(0.45);
    for (const k of DAY_KEYFRAMES) expect(k.hemi).toBeLessThanOrEqual(0.09);
  });

  it('returns each keyframe exactly at its t', () => {
    for (const k of DAY_KEYFRAMES) {
      const s = sampleDay(k.t);
      const [r, g, b] = hexToSrgb(k.srgb);
      close(s.srgb[0], r); close(s.srgb[1], g); close(s.srgb[2], b);
      close(s.sun, k.sun); close(s.env, k.env); close(s.hemi, k.hemi); close(s.punctual, k.punctual);
      expect(s.a).toBe(k.key);
    }
  });

  it('interpolates linearly in sRGB, then converts to linear', () => {
    // halfway between noon (0.50) and golden_pm (0.74)
    const s = sampleDay(0.62);
    const a = hexToSrgb('#fff0dc'); const b = hexToSrgb('#ffd6a0');
    for (let c = 0; c < 3; c++) {
      const srgb = (a[c]! + b[c]!) / 2;
      close(s.srgb[c]!, srgb, 1e-9);
      close(s.linear[c]!, srgbToLinear(srgb), 1e-9);
    }
    close(s.sun, (1.0 + 0.95) / 2, 1e-9);
    close(s.punctual, 0.05, 1e-9);
    expect(s.f).toBeCloseTo(0.5, 9);
  });

  it('wraps dusk (0.80) → night (1.00 ≡ 0.00)', () => {
    const s = sampleDay(0.9);
    expect(s.a).toBe('dusk'); expect(s.b).toBe('night');
    close(s.f, 0.5, 1e-9);
    close(s.sun, (0.85 + 0.3) / 2, 1e-9);
    close(s.punctual, (0.55 + 1.0) / 2, 1e-9);
    const late = sampleDay(0.9999);
    close(late.sun, 0.3, 1e-3);
  });

  it('wraps any real t into [0, 1) and writes into the passed record (no allocation)', () => {
    expect(wrapTime(1.25)).toBeCloseTo(0.25, 12);
    expect(wrapTime(-0.25)).toBeCloseTo(0.75, 12);
    expect(wrapTime(Number.NaN)).toBe(0);
    const out = createDaySample();
    expect(sampleDay(1.5, out)).toBe(out);
    close(out.sun, 1.0);
  });

  it('srgbToLinear matches the IEC curve at its breakpoints', () => {
    close(srgbToLinear(0), 0); close(srgbToLinear(1), 1);
    close(srgbToLinear(0.04045), 0.04045 / 12.92);
    close(srgbToLinear(0.5), 0.21404114, 1e-7);
  });
});

describe('§10.3.4 sun and moon (as amended 2026-10-06: sunrise 0.17, sunset 0.83, the moon on its own path)', () => {
  it('sun elevation = 70·sin(π·f) over the day arc, −60·sin(π·g) at night; azimuth 150° → 90° → 30°', () => {
    expect(SUNRISE_T).toBe(0.17); expect(SUNSET_T).toBe(0.83);
    close(sunElevationDeg(0.5), 70, 1e-9);
    close(sunElevationDeg(SUNRISE_T), 0, 1e-9);
    close(sunElevationDeg(SUNSET_T), 0, 1e-9);
    close(sunElevationDeg(0), -60, 1e-9);                     // midnight: the middle of the night arc
    close(sunAzimuthDeg(SUNRISE_T), 150, 1e-9);
    close(sunAzimuthDeg(0.5), 90, 1e-9);
    close(sunAzimuthDeg(SUNSET_T), 30, 1e-9);
    // §50.6.1 shot 2 (t 0.80) is golden hour: the sun ≈ 10° up, not below the horizon
    expect(sunElevationDeg(0.8)).toBeGreaterThan(9);
    expect(sunElevationDeg(0.8)).toBeLessThan(11);
    // continuous across sunset (the night arc starts where the day arc ends)
    close(sunAzimuthDeg(SUNSET_T - 1e-9), sunAzimuthDeg(SUNSET_T + 1e-9), 1e-5);
    close(sunElevationDeg(SUNSET_T - 1e-9), sunElevationDeg(SUNSET_T + 1e-9), 1e-5);
  });

  it('the sun stands high at +x at noon and rakes in low from +z+x at dusk; unit vectors', () => {
    const v = { x: 0, y: 0, z: 0 };
    sunDirection(0.5, v);
    close(v.y, Math.sin(70 * Math.PI / 180), 1e-9);
    expect(v.x).toBeGreaterThan(0);            // azimuth 90° at noon → +x
    sunDirection(0.8, v);
    expect(v.y).toBeGreaterThan(0.15);         // ≈ 10° up
    expect(v.z).toBeGreaterThan(0);            // azimuth ≈ 37° (from +z toward +x)
    close(Math.hypot(v.x, v.y, v.z), 1, 1e-9);
  });

  it('the moon follows its own path: 40° up at midnight, below the horizon by day, ≥ 110° from the noon sun', () => {
    close(moonElevationDeg(0), 40, 1e-9);
    expect(moonElevationDeg(0.5)).toBeLessThan(0);
    close(moonAzimuthDeg(0), 330, 1e-9);
    const m = { x: 0, y: 0, z: 0 };
    moonDirection(0, m);
    close(m.y, Math.sin(40 * Math.PI / 180), 1e-9);
    const s = { x: 0, y: 0, z: 0 };
    sunDirection(0.5, s);
    const ang = Math.acos((m.x * s.x + m.z * s.z) / (Math.hypot(m.x, m.z) * Math.hypot(s.x, s.z))) * 180 / Math.PI;
    expect(ang).toBeGreaterThanOrEqual(110);
  });

  it('becomes the moon below −4° and fades across the switch (no shadow pop)', () => {
    expect(MOON_SWITCH_DEG).toBe(-4);
    expect(isMoonLight(0)).toBe(true);
    expect(isMoonLight(0.5)).toBe(false);
    expect(isMoonLight(0.8)).toBe(false);      // dusk is daylight now
    const day = createDaySample();
    const night = directionalAt(0.0, sampleDay(0.0, day));
    expect(night.isMoon).toBe(true);
    close(night.intensity, 0.3, 1e-9);          // the moon row: readable moon shadows
    const noon = directionalAt(0.5, sampleDay(0.5, day));
    expect(noon.isMoon).toBe(false);
    close(noon.intensity, 1.0, 1e-9);
    // the switch after sunset: −60·sin(π·g) = −4
    const tSwitch = SUNSET_T + (Math.asin(4 / 60) / Math.PI) * (1 - (SUNSET_T - SUNRISE_T));
    close(sunElevationDeg(tSwitch), -4, 1e-6);
    const justAbove = directionalAt(tSwitch - 1e-6, sampleDay(tSwitch - 1e-6, day));
    const justBelow = directionalAt(tSwitch + 1e-6, sampleDay(tSwitch + 1e-6, day));
    expect(justAbove.isMoon).toBe(false); expect(justBelow.isMoon).toBe(true);
    expect(justAbove.intensity).toBeLessThan(1e-3);
    expect(justBelow.intensity).toBeLessThan(1e-3);
  });

  it('daylight follows the sun elevation (0 at −8°, 1 at +14°); golden hour peaks with the sun 2–16° up', () => {
    close(daylightAt(0.5), 1, 1e-9);
    close(daylightAt(0), 0, 1e-9);
    expect(daylightAt(0.8)).toBeGreaterThan(0.6);
    expect(daylightAt(0.8)).toBeLessThan(1);
    close(goldenAt(0.8), 1, 1e-9);
    close(goldenAt(0.5), 0, 1e-9);
    close(goldenAt(0), 0, 1e-9);
    const s = sampleDay(0.8);
    close(s.daylight, daylightAt(0.8), 1e-12); close(s.golden, goldenAt(0.8), 1e-12);
  });
});

describe('§10.3.3 PMREM re-bake rule', () => {
  it('bakes first, then on ≥ 2° elevation change or ≥ 20 s', () => {
    const s = createBakeState();
    expect(rebakeDue(s, 10)).toBe(true);
    markBaked(s, 10);
    expect(rebakeDue(s, 11.9)).toBe(false);
    expect(rebakeDue(s, 12)).toBe(true);
    s.sinceBakeMs = 19_999;
    expect(rebakeDue(s, 10.5)).toBe(false);
    s.sinceBakeMs = 20_000;
    expect(rebakeDue(s, 10.5)).toBe(true);
    markBaked(s, 10.5);
    s.forced = true;
    expect(rebakeDue(s, 10.5)).toBe(true);
  });
});
