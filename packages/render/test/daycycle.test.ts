import { describe, expect, it } from 'vitest';
import {
  DAY_KEYFRAMES, MOON_SWITCH_DEG, createBakeState, createDaySample, directionalAt, hexToSrgb, isMoonLight, markBaked, moonDirection,
  rebakeDue, sampleDay, srgbToLinear, sunAzimuthDeg, sunDirection, sunElevationDeg, wrapTime,
} from '../src/lighting/daycycle.js';

const close = (a: number, b: number, eps = 1e-6): void => { expect(Math.abs(a - b)).toBeLessThan(eps); };

describe('§10.3.5 colour-temperature table', () => {
  it('has the six keyframes in order with the SPEC values', () => {
    expect(DAY_KEYFRAMES.map((k) => k.key)).toEqual(['night', 'predawn', 'golden_am', 'noon', 'golden_pm', 'dusk']);
    expect(DAY_KEYFRAMES.map((k) => k.t)).toEqual([0, 0.22, 0.3, 0.5, 0.72, 0.8]);
    expect(DAY_KEYFRAMES.map((k) => k.srgb)).toEqual(['#8fa6d8', '#ff9d3f', '#ffbb78', '#fff3ef', '#ffb46b', '#ff932c']);
    expect(DAY_KEYFRAMES.map((k) => k.sun)).toEqual([0.05, 0.15, 0.6, 1.0, 0.55, 0.12]);
    expect(DAY_KEYFRAMES.map((k) => k.env)).toEqual([0.12, 0.2, 0.5, 0.85, 0.45, 0.18]);
    expect(DAY_KEYFRAMES.map((k) => k.punctual)).toEqual([1.0, 0.8, 0.25, 0.0, 0.3, 0.9]);
  });

  it('returns each keyframe exactly at its t', () => {
    for (const k of DAY_KEYFRAMES) {
      const s = sampleDay(k.t);
      const [r, g, b] = hexToSrgb(k.srgb);
      close(s.srgb[0], r); close(s.srgb[1], g); close(s.srgb[2], b);
      close(s.sun, k.sun); close(s.env, k.env); close(s.punctual, k.punctual);
      expect(s.a).toBe(k.key);
    }
  });

  it('interpolates linearly in sRGB, then converts to linear', () => {
    // halfway between noon (0.50) and golden_pm (0.72)
    const s = sampleDay(0.61);
    const a = hexToSrgb('#fff3ef'); const b = hexToSrgb('#ffb46b');
    for (let c = 0; c < 3; c++) {
      const srgb = (a[c]! + b[c]!) / 2;
      close(s.srgb[c]!, srgb, 1e-9);
      close(s.linear[c]!, srgbToLinear(srgb), 1e-9);
    }
    close(s.sun, (1.0 + 0.55) / 2, 1e-9);
    close(s.punctual, 0.15, 1e-9);
    expect(s.f).toBeCloseTo(0.5, 9);
  });

  it('wraps dusk (0.80) → night (1.00 ≡ 0.00)', () => {
    const s = sampleDay(0.9);
    expect(s.a).toBe('dusk'); expect(s.b).toBe('night');
    close(s.f, 0.5, 1e-9);
    close(s.sun, (0.12 + 0.05) / 2, 1e-9);
    close(s.punctual, (0.9 + 1.0) / 2, 1e-9);
    const late = sampleDay(0.9999);
    close(late.sun, 0.05, 1e-3);
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

describe('§10.3.4 sun and moon', () => {
  it('elevation = 70·sin(2π(t − 0.25)), azimuth = 360t − 90', () => {
    close(sunElevationDeg(0.5), 70, 1e-9);
    close(sunElevationDeg(0), -70, 1e-9);
    close(sunElevationDeg(0.25), 0, 1e-9);
    close(sunElevationDeg(0.75), 0, 1e-9);
    close(sunAzimuthDeg(0.25), 0, 1e-9);
    close(sunAzimuthDeg(0.5), 90, 1e-9);
  });

  it('rises at +x (east) and sets at −x', () => {
    const v = { x: 0, y: 0, z: 0 };
    sunDirection(0.26, v);                     // just after sunrise: azimuth ≈ 3.6°, facing +z mostly … east component positive after 6 h
    sunDirection(0.5, v);
    close(v.y, Math.sin(70 * Math.PI / 180), 1e-9);
    expect(v.x).toBeGreaterThan(0);            // azimuth 90° at noon → +x
    sunDirection(0.74, v);
    expect(v.z).toBeLessThan(0);               // azimuth ≈ 176° late afternoon
    const len = Math.hypot(v.x, v.y, v.z);
    close(len, 1, 1e-9);
  });

  it('the moon is opposite in elevation and azimuth + 180', () => {
    const s = { x: 0, y: 0, z: 0 }; const m = { x: 0, y: 0, z: 0 };
    sunDirection(0.1, s); moonDirection(0.1, m);
    close(m.y, -s.y, 1e-9);
    close(m.x, -s.x, 1e-9);
    close(m.z, -s.z, 1e-9);
  });

  it('becomes the moon below −4° and fades across the switch (no shadow pop)', () => {
    expect(MOON_SWITCH_DEG).toBe(-4);
    expect(isMoonLight(0)).toBe(true);
    expect(isMoonLight(0.5)).toBe(false);
    const day = createDaySample();
    const night = directionalAt(0.0, sampleDay(0.0, day));
    expect(night.isMoon).toBe(true);
    close(night.intensity, 0.05, 1e-9);         // moon row
    const noon = directionalAt(0.5, sampleDay(0.5, day));
    expect(noon.isMoon).toBe(false);
    close(noon.intensity, 1.0, 1e-9);
    // at the switch elevation both sides are ~0
    const tSwitch = 0.25 - Math.asin(4 / 70) / (2 * Math.PI);
    const justAbove = directionalAt(tSwitch + 1e-6, sampleDay(tSwitch + 1e-6, day));
    const justBelow = directionalAt(tSwitch - 1e-6, sampleDay(tSwitch - 1e-6, day));
    expect(justAbove.intensity).toBeLessThan(1e-3);
    expect(justBelow.intensity).toBeLessThan(1e-3);
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
