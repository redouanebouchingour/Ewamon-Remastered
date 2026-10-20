/**
 * Honor shapes the world: a zone's shadow level dims the sun and the sky light and thickens the fog towards violet, a
 * step per level (lighting/weather.ts `shadowParams`, DayCycle `setShadow`); level 0 writes exactly what it did before.
 */
import { describe, expect, it } from 'vitest';
import type { Vector3 } from 'three/webgpu';
import { DayCycle } from '../src/lighting/daycycle.js';
import type { DayCycleTargets } from '../src/lighting/daycycle.js';
import { shadowParams } from '../src/lighting/weather.js';

function rig() {
  const out = { sun: 0, hemi: 0, env: 0, fogDensity: 0, fog: [0, 0, 0] as number[] };
  const targets = {
    rig: {
      setFocus: () => undefined,
      applyDirectional: (_d: unknown, _c: unknown, intensity: number) => {
        out.sun = intensity;
      },
      setPunctualMultiplier: () => undefined,
      setHemisphere: (_s: unknown, _g: unknown, level: number) => {
        out.hemi = level;
      },
    },
    sky: {
      setCloudCoverage: () => undefined,
      setSunDirection: () => undefined,
      setEnvironmentIntensity: (v: number) => {
        out.env = v;
      },
      bake: () => undefined,
      dispose: () => undefined,
    },
    fog: {
      uniforms: {
        fogColor: { value: { setRGB: (r: number, g: number, b: number) => void (out.fog = [r, g, b]) } },
        fogDensity: {
          get value() {
            return out.fogDensity;
          },
          set value(v: number) {
            out.fogDensity = v;
          },
        },
        fogStart: { value: 0 },
        fogBase: { value: 0 },
        fogFalloff: { value: 0 },
      },
    },
    shared: { timeOfDay: { value: 0 }, wetness: { value: 0 } },
  } as unknown as DayCycleTargets;
  return { day: new DayCycle(targets), out };
}

const focus = { x: 0, y: 0, z: 0 } as unknown as Vector3;

describe('the shadow over a zone', () => {
  it('params: a step per level, clamped to 0..4', () => {
    expect(shadowParams(0)).toEqual({ sunMul: 1, envMul: 1, fogMix: 0, fogDensityMul: 1 });
    expect(shadowParams(4)).toEqual({ sunMul: 1 - 0.48, envMul: 1 - 0.4, fogMix: 0.56, fogDensityMul: 1.8 });
    expect(shadowParams(9)).toEqual(shadowParams(4));
    expect(shadowParams(-2)).toEqual(shadowParams(0));
  });

  it('dims the sun, the sky and the fill, thickens the fog towards violet, and level 0 restores it exactly', () => {
    const { day, out } = rig();
    day.setTime(0.5);
    day.update(16, 0.016, focus);
    const clear = { ...out, fog: [...out.fog] };
    day.setShadow(4);
    day.update(16, 0.016, focus);
    expect(out.sun).toBeCloseTo(clear.sun * 0.52, 9);
    expect(out.hemi).toBeCloseTo(clear.hemi * 0.6, 9);
    expect(out.env).toBeCloseTo(clear.env * 0.6, 9);
    expect(out.fogDensity).toBeCloseTo(clear.fogDensity * 1.8, 9);
    // the noon fog is a pale green-grey; the shadow pulls it darker, and blue above green
    expect(out.fog[1]!).toBeLessThan(clear.fog[1]!);
    expect(out.fog[2]! - out.fog[1]!).toBeGreaterThan(clear.fog[2]! - clear.fog[1]!);
    day.setShadow(0);
    day.update(16, 0.016, focus);
    expect(out).toEqual(clear);
  });
});
