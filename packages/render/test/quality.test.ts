import { describe, expect, it } from 'vitest';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { ALL_PASSES_ON, planPostGraph } from '../src/post/pipeline.js';
import { QUALITY_PROFILES, isIntegratedIntel, recommendedQuality } from '../src/quality.js';
import { PIXEL_RATIO_CAP, clampPixelRatio } from '../src/renderer.js';
import { SUN_SHADOW } from '../src/lighting/rig.js';

describe('quality presets', () => {
  it('high is the SPEC graph; shadows and GTAO cheaper (IMPLEMENTATION-NOTES "Cheaper shadows and reflections")', () => {
    expect(planPostGraph(ALL_EFFECTS, 'webgpu', ALL_PASSES_ON, 'high')).toEqual(planPostGraph(ALL_EFFECTS, 'webgpu'));
    expect(QUALITY_PROFILES.high.pixelRatioCap).toBe(PIXEL_RATIO_CAP);
    expect(QUALITY_PROFILES.high.sunShadowMap).toBe(SUN_SHADOW.mapSize);
    expect(QUALITY_PROFILES.high).toMatchObject({ sunShadowMap: 1536, gtaoSamples: 8, gtaoScale: 0.25 });
    expect(QUALITY_PROFILES.medium.sunShadowMap).toBe(1024);
  });

  it('high and medium share the GTAO stage, so switching between them rebuilds no post graph', () => {
    const gtao = (q: 'high' | 'medium'): unknown => planPostGraph(ALL_EFFECTS, 'webgpu', ALL_PASSES_ON, q).find((s) => s.id === 'gtao');
    expect(gtao('high')).toEqual(gtao('medium'));
    expect(gtao('high')).toMatchObject({ params: { samples: 8, resolutionScale: 0.25 } });
  });

  it('medium keeps every stage with 8 GTAO samples', () => {
    const plan = planPostGraph(ALL_EFFECTS, 'webgpu', ALL_PASSES_ON, 'medium');
    expect(plan.map((s) => s.id)).toEqual(planPostGraph(ALL_EFFECTS, 'webgpu').map((s) => s.id));
    expect(plan.find((s) => s.id === 'gtao')!.params.samples).toBe(8);
  });

  it('low drops GTAO, DOF and bloom, keeps anti-aliasing and the grade', () => {
    expect(planPostGraph(ALL_EFFECTS, 'webgpu', ALL_PASSES_ON, 'low').map((s) => s.id)).toEqual(
      ['scene', 'traa', 'chroma', 'aces', 'grade', 'vignette', 'grain', 'output']);
  });

  it('the pixel-ratio cap follows the preset', () => {
    expect(clampPixelRatio(2, 1440, QUALITY_PROFILES.low.pixelRatioCap)).toBe(1);
    expect(clampPixelRatio(2, 1440, QUALITY_PROFILES.medium.pixelRatioCap)).toBe(1.25);
    expect(clampPixelRatio(0.75, 1440, QUALITY_PROFILES.low.pixelRatioCap)).toBe(0.75);
  });
});

describe('auto quality', () => {
  it('detects integrated Intel GPUs from WebGPU and WebGL2 adapter strings', () => {
    expect(isIntegratedIntel('intel gen-12lp')).toBe(true);
    expect(isIntegratedIntel('intel xe-lpg')).toBe(true);
    expect(isIntegratedIntel('ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(isIntegratedIntel('ANGLE (Intel Inc., Intel(R) Iris(TM) Plus Graphics 655, OpenGL 4.1)')).toBe(true);
    expect(isIntegratedIntel('intel xe-hpg')).toBe(false);
    expect(isIntegratedIntel('ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
    expect(isIntegratedIntel('apple metal-3')).toBe(false);
    expect(isIntegratedIntel('nvidia ampere')).toBe(false);
    expect(isIntegratedIntel(null)).toBe(false);
  });

  it('picks low on integrated Intel, medium on the WebGL2 fallback, else high', () => {
    expect(recommendedQuality({ adapter: 'intel gen-9', backend: 'webgpu' })).toBe('low');
    expect(recommendedQuality({ adapter: 'ANGLE (Intel, Intel(R) HD Graphics 520)', backend: 'webgl2' })).toBe('low');
    expect(recommendedQuality({ adapter: null, backend: 'webgl2' })).toBe('low');
    expect(recommendedQuality({ adapter: 'apple metal-3', backend: 'webgpu' })).toBe('high');
  });
});
