import { describe, expect, it } from 'vitest';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { applyReducedEffects, coerceTimeScale, effectsEqual, isReduced, shakeAllowed } from '../src/post/effects.js';
import { gradeChannel, vignetteFactor, GROVE_GRADE } from '../src/post/grade.js';
import { CAMERA_LAYERS, CAMERA_PARAMS, MIN_MAX_TEXTURE_SIZE, chooseKtx2Target, clampPixelRatio } from '../src/renderer.js';
import { BasicDioramaRig } from '../src/defaults.js';
import { PerspectiveCamera } from 'three/webgpu';

describe('§10.1.3 pixel-ratio policy: pr = min(requested, 1.5, 3840 / cssWidth)', () => {
  it('caps a 2560-wide canvas at 1.5 (3840×2160 drawing buffer)', () => {
    expect(clampPixelRatio(2, 2560)).toBe(1.5);
    expect(clampPixelRatio(1.5, 2560) * 2560).toBe(3840);
  });
  it('caps a 3840-wide canvas at 1.0', () => { expect(clampPixelRatio(2, 3840)).toBe(1); });
  it('never raises the requested ratio', () => {
    expect(clampPixelRatio(1, 1280)).toBe(1);
    expect(clampPixelRatio(1.25, 1920)).toBe(1.25);
  });
  it('limits very wide canvases below 1', () => { expect(clampPixelRatio(1, 5120)).toBe(0.75); });
  it('falls back safely on invalid input', () => {
    expect(clampPixelRatio(Number.NaN, 1920)).toBe(1);
    expect(clampPixelRatio(0, 1920)).toBe(1);
    expect(clampPixelRatio(2, 0)).toBe(1.5);
  });
});

describe('§10.1.2 construction constants', () => {
  it('KTX2 transcode target preference astc > bc7 > etc2 > rgba8', () => {
    expect(chooseKtx2Target({ astcSupported: true, bptcSupported: true })).toBe('astc');
    expect(chooseKtx2Target({ bptcSupported: true, etc2Supported: true })).toBe('bc7');
    expect(chooseKtx2Target({ etc2Supported: true })).toBe('etc2');
    expect(chooseKtx2Target({})).toBe('rgba8');
    expect(chooseKtx2Target(null)).toBe('rgba8');
  });
  it('camera 28° / 0.5 / 220 and the 8192 texture floor', () => {
    expect(CAMERA_PARAMS).toEqual({ fovV: 28, near: 0.5, far: 220 });
    expect(MIN_MAX_TEXTURE_SIZE).toBe(8192);
    expect(CAMERA_LAYERS).toEqual([0, 27, 28, 29, 30]);
  });
});

describe('§10.8.4 ReducedEffects resolution', () => {
  it('the strip switches off exactly dof/grain/chroma/shake/hitstop/slowmo', () => {
    const r = applyReducedEffects(ALL_EFFECTS);
    expect(r).toEqual({ dof: false, bloom: true, grain: false, chroma: false, shake: false, hitstop: false, slowmo: false, taa: true });
    expect(isReduced(r)).toBe(true);
    expect(isReduced(ALL_EFFECTS)).toBe(false);
    expect(effectsEqual(r, applyReducedEffects(r))).toBe(true);
    expect(shakeAllowed(r)).toBe(false);
  });

  it('coerces time scales ≠ 1 when their flag is off; reduced ⇒ always 1', () => {
    const reduced = applyReducedEffects(ALL_EFFECTS);
    for (const s of [0, 0.35, 0.5, 2]) expect(coerceTimeScale(s, reduced)).toBe(1);
    expect(coerceTimeScale(0, ALL_EFFECTS)).toBe(0);
    expect(coerceTimeScale(0.35, ALL_EFFECTS)).toBe(0.35);
    expect(coerceTimeScale(0, { ...ALL_EFFECTS, hitstop: false })).toBe(1);
    expect(coerceTimeScale(0.35, { ...ALL_EFFECTS, hitstop: false })).toBe(0.35);
    expect(coerceTimeScale(0.35, { ...ALL_EFFECTS, slowmo: false })).toBe(1);
    expect(coerceTimeScale(Number.NaN, ALL_EFFECTS)).toBe(1);
    expect(coerceTimeScale(-1, ALL_EFFECTS)).toBe(1);
  });

  it('the placeholder camera rig refuses shake when effects.shake is false (Pillar 8)', () => {
    let flags = applyReducedEffects(ALL_EFFECTS);
    const rig = new BasicDioramaRig(new PerspectiveCamera(28, 16 / 9, 0.5, 220), () => flags);
    rig.shake(0.5, 300);
    for (let i = 0; i < 60; i++) { rig.update(16.7); expect(rig.shakeOffset).toBe(0); }
    flags = ALL_EFFECTS;
    rig.shake(0.5, 300);
    expect(rig.shakeOffset).toBeGreaterThan(0);
  });

  it('the placeholder rig holds the §10.7.1 pose: 20.49 m up, 16.01 m back at zoom stop 1', () => {
    const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
    const rig = new BasicDioramaRig(cam, () => ALL_EFFECTS);
    rig.update(0);
    expect(cam.position.y).toBeCloseTo(20.49, 2);
    expect(Math.hypot(cam.position.x, cam.position.z)).toBeCloseTo(16.01, 2);
  });
});

describe('§10.8.2 grade and vignette', () => {
  it('lift/gamma/gain: out = (in·gain + lift)^(1/gamma), clamped', () => {
    expect(gradeChannel(0.5, 0, 1, 1)).toBeCloseTo(0.5, 12);
    expect(gradeChannel(0.5, 0.01, 0.98, 1.02)).toBeCloseTo(Math.pow(0.5 * 1.02 + 0.01, 1 / 0.98), 12);
    expect(gradeChannel(2, 0, 1, 1)).toBe(1);
    expect(gradeChannel(-1, 0, 1, 1)).toBe(0);
    expect(GROVE_GRADE.lift).toEqual([0.01, 0.012, 0.0]);
  });

  it('vignette 0.22 darkens the 16:9 far corner by ≈ 9.3 % (the SPEC text says 8 %: smoothstep(0.35, 0.85, 0.574) is 0.42, not 0.36)', () => {
    expect(vignetteFactor(0.5, 0.5, 0.22, 0.5625)).toBe(1);
    const r = 0.5 * Math.sqrt(1 + 0.5625 ** 2);
    expect(r).toBeCloseTo(0.574, 3);
    expect(1 - vignetteFactor(0, 0, 0.22, 0.5625)).toBeCloseTo(0.0929, 3);
  });
});
