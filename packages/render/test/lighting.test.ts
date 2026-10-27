import { describe, expect, it, vi } from 'vitest';
import { Group, PointLight, Scene, SpotLight, Vector3 } from 'three/webgpu';
import type { LightSource } from '../src/descriptors.js';
import { LAYERS, LIGHT_BUDGET } from '../src/descriptors.js';
import {
  LIGHT_LAYOUT, LightRig, SPEC_LIGHT_UNIT, SPOT_PARAMS, SUN_SHADOW, assertLightBudget, flickerFactor, lightTypeFor,
} from '../src/lighting/rig.js';
import { SUN_SHADOW_CACHE, SunShadowNode, staticShadowDue, sunStepRad } from '../src/lighting/sunShadow.js';
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

  it('maps kinds to Spot (−Y) vs Point lights', () => {
    for (const k of ['lamp', 'lantern', 'beacon', 'window'] as const) expect(lightTypeFor(k)).toBe('SpotLight');
    for (const k of ['brazier', 'forge', 'lava', 'crystal', 'candle', 'fire'] as const) expect(lightTypeFor(k)).toBe('PointLight');
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

describe('§10.3.1 cached sun shadows (IMPLEMENTATION-NOTES "Cached sun shadows", 2026-10-27)', () => {
  it('a static map and an actor map on the one directional light; the actor map sees only the dynamic layer', () => {
    const rig = new LightRig(new Scene());
    expect(SUN_SHADOW).toEqual({ mapSize: 4096, bias: -0.0004, normalBias: 0.02, radius: 2 });
    expect(SPOT_PARAMS).toEqual({ angle: 0.87, penumbra: 0.5 });
    expect(rig.sunShadow).toBeInstanceOf(SunShadowNode);
    expect((rig.sun.shadow as unknown as { shadowNode: unknown }).shadowNode).toBe(rig.sunShadow);
    const st = rig.sunShadow.staticLight.shadow; const ac = rig.sunShadow.actorLight.shadow;
    expect(st.camera.right - st.camera.left).toBe(2 * SUN_SHADOW_CACHE.staticHalfM);
    expect(ac.camera.right - ac.camera.left).toBe(2 * SUN_SHADOW_CACHE.actorHalfM);
    expect(st.bias).toBe(SUN_SHADOW.bias);
    expect(st.autoUpdate).toBe(false);
    expect(ac.autoUpdate).toBe(true);
    expect(ac.camera.layers.mask).toBe(1 << LAYERS.dynamicShadow);
    rig.setShadowMaps(2048, 1024);
    expect(rig.sunShadow.mapSizes()).toEqual([2048, 1024]);
    // the fades end inside each map, and the static map covers what the diorama sees after walking up to a re-centre
    expect(SUN_SHADOW_CACHE.staticFadeToM).toBeLessThan(SUN_SHADOW_CACHE.staticHalfM);
    expect(SUN_SHADOW_CACHE.actorFadeToM).toBeLessThan(SUN_SHADOW_CACHE.actorHalfM);
    expect(SUN_SHADOW_CACHE.recenterM + 30).toBeLessThanOrEqual(SUN_SHADOW_CACHE.staticFadeFromM);
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

  it('the sun step shrinks toward the horizon, where shadows are long', () => {
    expect(sunStepRad(1)).toBe(0.0035);
    expect(sunStepRad(Math.sin(30 * Math.PI / 180))).toBeCloseTo(0.0025, 10);
    expect(sunStepRad(0)).toBe(0.0002);
    for (const el of [5, 10, 20, 40, 60]) {
      const s = Math.sin(el * Math.PI / 180);
      const tipJumpM = (10 / (s * s)) * sunStepRad(s);              // a 10 m caster's shadow tip, per step
      if (sunStepRad(s) > 0.0002) expect(tipJumpM).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('re-renders the static map when stale, old, re-centred or the sun turned; the actor map follows every frame', () => {
    const dir = new Vector3(0.3, 0.8, 0.2).normalize();
    const center = new Vector3(10, 0, 10);
    const base = { dir, center, age: 0, stale: false };
    expect(staticShadowDue(base, dir, center)).toBe(false);
    expect(staticShadowDue({ ...base, stale: true }, dir, center)).toBe(true);
    expect(staticShadowDue({ ...base, age: SUN_SHADOW_CACHE.maxAgeFrames }, dir, center)).toBe(true);
    expect(staticShadowDue(base, dir, new Vector3(10 + SUN_SHADOW_CACHE.recenterM - 0.1, 5, 10))).toBe(false);
    expect(staticShadowDue(base, dir, new Vector3(10 + SUN_SHADOW_CACHE.recenterM + 0.1, 0, 10))).toBe(true);
    const turned = dir.clone().applyAxisAngle(new Vector3(0, 1, 0).cross(dir).normalize(), sunStepRad(dir.y) * 1.5);
    expect(staticShadowDue(base, dir.clone().applyAxisAngle(new Vector3(0, 1, 0).cross(dir).normalize(), sunStepRad(dir.y) * 0.5), center)).toBe(false);
    expect(staticShadowDue(base, turned, center)).toBe(true);

    const rig = new LightRig(new Scene());
    const n = rig.sunShadow;
    const focus = new Vector3(0, 2, 0);
    rig.setFocus(focus);
    rig.applyDirectional([dir.x, dir.y, dir.z], [1, 1, 1], 1);
    rig.scheduleShadows();
    expect(n.staticRenders).toBe(1);                                // the first frame renders it
    expect(n.staticLight.shadow.needsUpdate).toBe(true);
    n.staticLight.shadow.needsUpdate = false;                       // (three clears it once rendered)
    for (let f = 0; f < 30; f++) {
      focus.x += 0.08;                                              // walking: ~5 m/s at 60 fps
      rig.setFocus(focus);
      rig.applyDirectional([dir.x, dir.y, dir.z], [1, 1, 1], 1);
      rig.scheduleShadows();
    }
    expect(n.staticRenders).toBe(1);
    // the actor map sits on the focus (within a texel), toward the sun
    const ac = n.actorLight;
    const toLight = ac.position.clone().sub(ac.target.position);
    expect(toLight.length()).toBeCloseTo(SUN_SHADOW_CACHE.depthM, 6);
    expect(toLight.normalize().dot(dir)).toBeCloseTo(1, 9);
    const texel = (2 * SUN_SHADOW_CACHE.actorHalfM) / ac.shadow.mapSize.x;
    const off = ac.target.position.clone().sub(focus);
    expect(off.sub(dir.clone().multiplyScalar(off.dot(dir))).length()).toBeLessThan(texel * Math.SQRT2 + 1e-9);
    for (let f = 0; f < SUN_SHADOW_CACHE.maxAgeFrames; f++) rig.scheduleShadows();
    expect(n.staticRenders).toBe(2);                                // the age limit
    rig.refreshShadows();
    rig.scheduleShadows();
    expect(n.staticRenders).toBe(3);
    rig.applyDirectional([-dir.x, dir.y, -dir.z], [1, 1, 1], 1);    // a sun / moon swap
    rig.scheduleShadows();
    expect(n.staticRenders).toBe(4);
    rig.dispose();
  });
});

describe('punctual lights (§10.3.2, §10.2.6)', () => {
  it('creates, multiplies, disables and releases lights; a castShadow source is a looped light too (amended 2026-10-25)', () => {
    const rig = new LightRig(new Scene());
    const parent = new Group();
    const h = rig.createPunctuals([src('lamp', true), { ...src('fire', false, 'brazier'), intensity: 4, flicker: { amplitude: 0.1, hz: 5 } }], parent);
    expect(h[0]!.light).toBeInstanceOf(SpotLight);
    expect(h[1]!.light).toBeInstanceOf(PointLight);
    for (const x of h) expect(x.light.castShadow).toBe(false);    // looped by the layout: no shadow map, no per-light code
    expect(h[0]!.light.parent).toBe(parent);
    expect(h[0]!.target!.position.y).toBeCloseTo(1.5, 9);       // pointing −Y
    expect(parent.children.length).toBe(3);                       // the lamp, its target and the brazier
    expect(rig.counts()).toEqual({ shadow: 1, nonShadow: 1 });    // the content budget still counts the source

    rig.setPunctualMultiplier(0.5);
    rig.update(0);
    expect(h[0]!.light.intensity).toBeCloseTo(5, 9);
    rig.setPunctualEnabled(false);                                // harvest level 2
    rig.update(1.3);
    expect(h[0]!.light.intensity).toBe(0);
    expect(h[1]!.light.intensity).toBe(0);
    expect(parent.children.length).toBe(3);                       // objects are not removed

    const lampDispose = vi.spyOn(h[0]!.light, 'dispose');
    rig.releasePunctuals([h[0]!]);
    expect(lampDispose).toHaveBeenCalledTimes(1);
    expect(parent.children.length).toBe(1);
    expect(rig.counts()).toEqual({ shadow: 0, nonShadow: 1 });
    rig.releasePunctuals([h[1]!]);
    expect(parent.children.length).toBe(0);
    rig.dispose();
  });

  it('enforces the content budget in dev: 8 castShadow + 24 other sources', () => {
    const rig = new LightRig(new Scene());
    rig.createPunctuals(Array.from({ length: 8 }, (_, i) => src(`s${i}`, true)), new Group());
    expect(() => rig.createPunctuals([src('extra', true)], new Group())).toThrow('light budget');
    rig.createPunctuals(Array.from({ length: 24 }, (_, i) => src(`n${i}`, false)), new Group());
    expect(() => rig.createPunctuals([src('n24', false)], new Group())).toThrow('light budget');
    expect(LIGHT_LAYOUT.maxLocalLights).toBeGreaterThanOrEqual(8 + 24 + 2 + 1);   // + the arena's beacons + the follower
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

describe('§10.3.7 fog as amended 2026-10-06 (the M2 re-light: a 15 m clear zone, density 0.00486 past it)', () => {
  it('the zone-less default is the grove palette density; feet at 26 m are 5.2 % fogged, the skirt hills at 60–150 m 20–48 %', async () => {
    const { GROVE_LIGHTING } = await import('../src/lighting/daycycle.js');
    const { FOG_START_M, GROVE_FOG_DENSITY, createHeightFog } = await import('../src/lighting/fog.js');
    const { PALETTES, lightingPaletteOf } = await import('../src/zone/palettes.js');
    expect(FOG_START_M).toBe(15);
    expect(GROVE_FOG_DENSITY).toBeCloseTo(0.00486, 6);
    expect(GROVE_LIGHTING.fogDensity).toBe(GROVE_FOG_DENSITY);
    expect(GROVE_LIGHTING.fogStart).toBe(FOG_START_M);
    expect(PALETTES.grove_mirevale!.fogDensity).toBeCloseTo(GROVE_FOG_DENSITY, 12);
    expect(lightingPaletteOf(PALETTES.grove_mirevale!).fogStart).toBe(FOG_START_M);
    const fog = createHeightFog();
    expect(fog.uniforms.fogDensity.value).toBe(GROVE_FOG_DENSITY);
    expect(fog.uniforms.fogStart.value).toBe(FOG_START_M);
    expect(heightFogFactor(26, 0, GROVE_FOG_DENSITY, 0, 0.35, FOG_START_M)).toBeCloseTo(0.052, 3);
    expect(heightFogFactor(60, 0, GROVE_FOG_DENSITY, 0, 0.35, FOG_START_M)).toBeCloseTo(0.196, 3);
    expect(heightFogFactor(150, 0, GROVE_FOG_DENSITY, 0, 0.35, FOG_START_M)).toBeCloseTo(0.481, 3);
    expect(heightFogFactor(14, 0, GROVE_FOG_DENSITY, 0, 0.35, FOG_START_M)).toBe(0);   // inside the clear zone
  });
});
