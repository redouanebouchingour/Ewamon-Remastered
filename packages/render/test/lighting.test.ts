import { describe, expect, it, vi } from 'vitest';
import { Group, PointLight, Scene, SpotLight } from 'three/webgpu';
import type { LightSource } from '../src/descriptors.js';
import { LIGHT_BUDGET } from '../src/descriptors.js';
import {
  CASCADE_SPLITS_M, CSM_OPTIONS, LightRig, SPEC_LIGHT_UNIT, SPOT_PARAMS, SUN_SHADOW, assertLightBudget, cascadeBreaks, castsShadowMap,
  flickerFactor, lightTypeFor,
} from '../src/lighting/rig.js';
import { heightFogFactor } from '../src/lighting/fog.js';
import { weatherParams } from '../src/lighting/weather.js';
import { priorSkyLuminance, skyNormalization, SKY_MAX_GAIN, SKY_REFERENCE_RADIANCE } from '../src/lighting/sky.js';
import { stepWetness, toHarvestLevel, WETNESS_FALL_S, WETNESS_RISE_S } from '../src/materials/harvest.js';

const src = (id: string, castShadow: boolean, kind: LightSource['kind'] = 'lantern'): LightSource => ({
  id, kind, color: '#ffb35c', intensity: 10, position: [0, 2.5, 0], castShadow, range: 10,
  housing: { kind: 'generated', generator: 'lantern', seed: 1 }, flicker: null,
});

describe('§10.3.2 light budget', () => {
  it('is 8 shadow-casting + 24 non-shadowing', () => {
    expect(LIGHT_BUDGET).toEqual({ shadowCasters: 8, nonShadow: 24 });
  });

  it('accepts exactly the budget', () => {
    const list = [...Array.from({ length: 8 }, (_, i) => src(`s${i}`, true)), ...Array.from({ length: 24 }, (_, i) => src(`n${i}`, false))];
    expect(assertLightBudget(list)).toEqual({ shadow: 8, nonShadow: 24 });
  });

  it("throws RangeError('light budget') at the 9th shadow caster", () => {
    const list = Array.from({ length: 9 }, (_, i) => src(`s${i}`, true));
    expect(() => assertLightBudget(list)).toThrow(RangeError);
    expect(() => assertLightBudget(list)).toThrow('light budget');
  });

  it("throws RangeError('light budget') at the 25th non-shadow light", () => {
    const list = Array.from({ length: 25 }, (_, i) => src(`n${i}`, false));
    expect(() => assertLightBudget(list)).toThrow('light budget');
  });

  it('counts already-registered lights first (arena beacons are reserved slots)', () => {
    expect(() => assertLightBudget([src('a', true), src('b', true)], { shadow: 7, nonShadow: 0 })).toThrow('light budget');
    expect(assertLightBudget([src('a', true)], { shadow: 7, nonShadow: 3 })).toEqual({ shadow: 8, nonShadow: 3 });
  });

  it('maps kinds to Spot (−Y) vs Point lights, and only lava/fire point lights render shadow maps', () => {
    for (const k of ['lamp', 'lantern', 'beacon', 'window'] as const) expect(lightTypeFor(k)).toBe('SpotLight');
    for (const k of ['brazier', 'forge', 'lava', 'crystal', 'candle', 'fire'] as const) expect(lightTypeFor(k)).toBe('PointLight');
    expect(castsShadowMap({ kind: 'lantern', castShadow: true })).toBe(true);
    expect(castsShadowMap({ kind: 'lava', castShadow: true })).toBe(true);
    expect(castsShadowMap({ kind: 'brazier', castShadow: true })).toBe(false);
    expect(castsShadowMap({ kind: 'lantern', castShadow: false })).toBe(false);
  });

  it('flicker is deterministic and bounded by amplitude ≤ 0.15', () => {
    for (let t = 0; t < 10; t += 0.137) {
      const f = flickerFactor(0.5, 5, t);           // amplitude clamps to 0.15
      expect(f).toBeGreaterThanOrEqual(1 - 0.15 * 0.6 - 1e-9);
      expect(f).toBeLessThanOrEqual(1 + 0.15 * 0.6 + 0.15 * 0.4 + 1e-9);
      expect(flickerFactor(0.5, 5, t)).toBe(f);
    }
    expect(flickerFactor(0, 5, 3)).toBe(1);
  });
});

describe('§10.3.1 sun + 4 cascades', () => {
  it('splits at 14 / 34 / 72 / 160 m over a 160 m far', () => {
    expect(CASCADE_SPLITS_M).toEqual([14, 34, 72, 160]);
    expect(CSM_OPTIONS).toMatchObject({ cascades: 4, maxFar: 160, mode: 'custom', lightMargin: 60 });
    expect(cascadeBreaks(160, [])).toEqual([14 / 160, 34 / 160, 72 / 160, 1]);
    const b = [9, 9, 9, 9, 9];
    expect(cascadeBreaks(160, b)).toBe(b);
    expect(b.length).toBe(4);
    expect(SUN_SHADOW).toEqual({ mapSize: 2048, bias: -0.0004, normalBias: 0.02, radius: 2 });
    expect(SPOT_PARAMS).toMatchObject({ angle: 0.87, penumbra: 0.5, mapSize: 512, bias: -0.0006, normalBias: 0.03, radius: 2 });
  });

  it('builds a 4-cascade CSM on one directional light, and the far cascade texel ≤ 8 cm', () => {
    const scene = new Scene();
    const rig = new LightRig(scene);
    expect(rig.csm.cascades).toBe(4);
    expect(rig.sun.shadow.mapSize.x).toBe(2048);
    expect((rig.sun.shadow as unknown as { shadowNode: unknown }).shadowNode).toBe(rig.csm);
    expect((160 - 72) / 2048).toBeLessThanOrEqual(0.08);
    rig.updateFrustums();                         // guarded before the first render (no camera yet)
    rig.dispose();
    rig.dispose();                                // idempotent
  });

  it('writes the SPEC-unit intensity × π into the physical directional light', () => {
    const rig = new LightRig(new Scene());
    rig.applyDirectional([0, 1, 0], [1, 1, 1], 1);
    expect(rig.sun.intensity).toBeCloseTo(SPEC_LIGHT_UNIT, 12);
    expect(rig.sun.visible).toBe(true);
    rig.applyDirectional([0, 1, 0], [1, 1, 1], 0);
    expect(rig.sun.visible).toBe(true);           // never hidden: the lights set is part of every program key
    rig.dispose();
  });
});

describe('punctual lights (§10.3.2, §10.2.6)', () => {
  it('creates, multiplies, disables and releases (disposing) lights', () => {
    const rig = new LightRig(new Scene());
    const parent = new Group();
    const h = rig.createPunctuals([src('lamp', true), { ...src('fire', false, 'brazier'), intensity: 4, flicker: { amplitude: 0.1, hz: 5 } }], parent);
    expect(h[0]!.light).toBeInstanceOf(SpotLight);
    expect(h[1]!.light).toBeInstanceOf(PointLight);
    expect(h[0]!.target!.position.y).toBeCloseTo(1.5, 9);       // pointing −Y
    expect(parent.children.length).toBe(3);                       // 2 lights + 1 spot target
    expect(rig.counts()).toEqual({ shadow: 1, nonShadow: 1 });

    rig.setPunctualMultiplier(0.5);
    rig.update(0);
    expect(h[0]!.light.intensity).toBeCloseTo(5, 9);
    rig.setPunctualEnabled(false);                                // harvest level 2
    rig.update(1.3);
    expect(h[0]!.light.intensity).toBe(0);
    expect(h[1]!.light.intensity).toBe(0);
    expect(parent.children.length).toBe(3);                       // objects are not removed

    const spy = vi.spyOn(h[0]!.light, 'dispose');
    rig.releasePunctuals([h[0]!]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(parent.children.length).toBe(1);
    expect(rig.counts()).toEqual({ shadow: 0, nonShadow: 1 });
    rig.dispose();
  });

  it('refuses a 9th shadow caster in dev', () => {
    const rig = new LightRig(new Scene());
    rig.createPunctuals(Array.from({ length: 8 }, (_, i) => src(`s${i}`, true)), new Group());
    expect(() => rig.createPunctuals([src('extra', true)], new Group())).toThrow('light budget');
    rig.dispose();
  });
});

describe('§10.3.6 weather, §10.3.7 fog, IBL normalisation, wetness', () => {
  it('weather rows', () => {
    expect(weatherParams('rain')).toMatchObject({ cloudCoverage: 0.85, sunMul: 0.55, wetTarget: 1, precipitation: 'rain' });
    expect(weatherParams('sun')).toMatchObject({ cloudCoverage: 0.1, envMul: 1.1 });
    expect(weatherParams('sand')).toMatchObject({ fogDensityMul: 2.5, fogTint: '#c9a24a' });
    expect(weatherParams('hail').precipitation).toBe('hail');
    expect(weatherParams('none')).toMatchObject({ cloudCoverage: 0.35, wetTarget: 0, precipitation: 'none' });
  });

  it('height fog factor: 0 at the eye, rises with distance, decays above the base', () => {
    expect(heightFogFactor(0, 0, 0.018, 0, 0.35)).toBe(0);
    expect(heightFogFactor(26, 0, 0.018, 0, 0.35)).toBeCloseTo(1 - Math.exp(-0.468), 12);
    expect(heightFogFactor(26, 5, 0.018, 0, 0.35)).toBeCloseTo((1 - Math.exp(-0.468)) * Math.exp(-1.75), 12);
    expect(heightFogFactor(26, -3, 0.018, 0, 0.35)).toBeCloseTo(1 - Math.exp(-0.468), 12);
  });

  it('sky normalisation maps the measured sky level to the 0.3 reference with a clamped gain', () => {
    expect(skyNormalization(1)).toBeCloseTo(SKY_REFERENCE_RADIANCE, 12);
    expect(skyNormalization(0)).toBe(SKY_MAX_GAIN);
    expect(skyNormalization(1e-6)).toBe(SKY_MAX_GAIN);
    let prev = 0;
    for (let e = -20; e <= 90; e += 5) { const l = priorSkyLuminance(e); expect(l).toBeGreaterThanOrEqual(prev); prev = l; }
    expect(priorSkyLuminance(70)).toBeCloseTo(1.052, 6);
  });

  it('wetness ramps to 1 over 4 s and back over 12 s; harvest levels clamp', () => {
    let w = 0;
    for (let i = 0; i < 40; i++) w = stepWetness(w, 1, 0.1);
    expect(w).toBeCloseTo(1, 9);
    expect(stepWetness(0, 1, WETNESS_RISE_S / 2)).toBeCloseTo(0.5, 12);
    expect(stepWetness(1, 0, WETNESS_FALL_S / 4)).toBeCloseTo(0.75, 12);
    expect(toHarvestLevel(7)).toBe(2);
    expect(toHarvestLevel(-1)).toBe(0);
    expect(toHarvestLevel(1.2)).toBe(1);
    expect(toHarvestLevel(Number.NaN)).toBe(0);
  });
});
