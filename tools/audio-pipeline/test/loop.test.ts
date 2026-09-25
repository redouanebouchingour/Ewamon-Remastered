/** Pure-TS stages of `process`: loop finder rejections, seams, phase alignment, sfx trim, placeholders. No ffmpeg. */
import { describe, expect, it } from 'vitest';
import { expandJobs } from '../src/jobs.js';
import { alignLag, bakeCrossfadeLoop, bakeSeamCrossfade, findLoop, nearestZeroCrossing, shiftChannels, trimSfx } from '../src/loop.js';
import { mulberry32, parseKey, synthesizePlaceholder } from '../src/placeholder.js';
import { decodeWav, encodeWav, mixdown } from '../src/wav.js';
import { SR, clickTrack, tinyManifest } from './helpers.js';

describe('findLoop', () => {
  it('rejects white noise (no periodicity → score < 0.6)', () => {
    const rnd = mulberry32(7);
    const x = new Float32Array(10 * SR).map(() => (rnd() * 2 - 1) * 0.3);
    const r = findLoop(x, SR, { bpm: 120, bars: 4 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/autocorrelation/);
  });

  it('rejects audio too short to hold the loop', () => {
    const r = findLoop(clickTrack(120, 4, 0.3, 0.2), SR, { bpm: 120, bars: 4 });
    expect(r.ok).toBe(false);
  });

  it('is deterministic', () => {
    const x = clickTrack(96, 4);
    expect(findLoop(x, SR, { bpm: 96, bars: 4 })).toEqual(findLoop(x, SR, { bpm: 96, bars: 4 }));
  });

  it('locks onto every placeholder stem at the theme\'s nominal loop', () => {
    const jobs = expandJobs(tinyManifest(), 'stable-audio', '/c').filter((j) => j.kind === 'stem');
    expect(jobs).toHaveLength(4);
    for (const j of jobs) {
      const r = findLoop(mixdown(synthesizePlaceholder(j)), SR, { bpm: 200, bars: 8 });
      expect(r.ok, `${j.id}: ${r.reason ?? ''}`).toBe(true);
      expect(Math.abs(r.lengthSec - 9.6)).toBeLessThanOrEqual(0.005);
    }
  });
});

describe('seams', () => {
  it('nearestZeroCrossing finds the sign change within the radius', () => {
    const x = new Float32Array([0.5, 0.4, 0.2, -0.1, -0.3, -0.2, 0.1, 0.3]);
    expect(nearestZeroCrossing(x, 2, 2)).toBe(3);
    expect(nearestZeroCrossing(x, 5, 1)).toBe(6);
    expect(nearestZeroCrossing(x, 5, 2, false)).toBe(3);
  });

  it('bakeSeamCrossfade makes the sample before loopEnd continue into loopStart', () => {
    const n = 2000;
    const ch = new Float32Array(n).map((_, i) => Math.sin(i * 0.05));
    const start = 300;
    const end = 1700;
    const [out] = bakeSeamCrossfade([ch], start, end, 100);
    expect(out!.length).toBe(end);
    // the last output sample is (almost) the sample just before loopStart
    expect(Math.abs(out![end - 1]! - ch[start - 1]!)).toBeLessThan(0.02);
    expect(out![100]).toBe(ch[100]);
  });

  it('bakeCrossfadeLoop wraps continuously (ambience)', () => {
    const rnd = mulberry32(3);
    let y = 0;
    const ch = new Float32Array(SR * 4).map(() => (y += 0.01 * (rnd() * 2 - 1 - y)));
    const c = SR / 2;
    const [out] = bakeCrossfadeLoop([ch], c);
    expect(out!.length).toBe(ch.length - c);
    const jump = Math.abs(out![out!.length - 1]! - out![0]!);
    let typical = 0;
    for (let i = 1; i < out!.length; i++) typical = Math.max(typical, Math.abs(out![i]! - out![i - 1]!));
    expect(jump).toBeLessThanOrEqual(typical * 1.5);
  });
});

describe('alignLag / shiftChannels', () => {
  it('recovers a known offset between two layers', () => {
    const ref = clickTrack(120, 4, 0.3);
    const late = clickTrack(120, 4, 0.3 + 0.137);
    const { lagSamples, score } = alignLag(ref, late, SR, 0.3, 8, 1.0);
    expect(Math.abs(lagSamples / SR - 0.137)).toBeLessThanOrEqual(0.002);
    expect(score).toBeGreaterThan(0.6);
    const [shifted] = shiftChannels([late], lagSamples);
    expect(shifted!.length).toBe(late.length - lagSamples);
  });

  it('returns 0 for aligned material and pads for negative lags', () => {
    const ref = clickTrack(120, 4, 0.5);
    expect(alignLag(ref, ref, SR, 0.3, 8, 1.0).lagSamples).toBe(0);
    const [padded] = shiftChannels([new Float32Array([1, 2, 3])], -2);
    expect([...padded!]).toEqual([0, 0, 1, 2, 3]);
  });
});

describe('trimSfx', () => {
  it('drops leading silence, caps the length and fades out', () => {
    const x = new Float32Array(SR);
    for (let i = 4800; i < SR; i++) x[i] = 0.5;
    const [out] = trimSfx([x], SR, 0.2);
    expect(out!.length).toBe(Math.round(0.2 * SR));
    expect(out![0]).toBe(0);
    expect(out![Math.round(0.005 * SR) + 10]).toBeCloseTo(0.5, 5);
    expect(out![out!.length - 1]).toBe(0);
  });
});

describe('wav + placeholder helpers', () => {
  it('encodeWav/decodeWav round-trip float32 exactly and pcm16 within one step', () => {
    const ch = new Float32Array([0, 0.5, -0.5, 0.25, -1, 0.999]);
    const f = decodeWav(encodeWav({ sampleRate: SR, channels: [ch, ch] }, 32));
    expect([...f.channels[1]!]).toEqual([...ch]);
    const p = decodeWav(encodeWav({ sampleRate: 44100, channels: [ch] }, 16));
    expect(p.sampleRate).toBe(44100);
    for (let i = 0; i < ch.length; i++) expect(Math.abs(p.channels[0]![i]! - ch[i]!)).toBeLessThan(1 / 16384);
  });

  it('parseKey reads the bible\'s key strings', () => {
    expect(parseKey('D major')).toEqual({ root: 2, scale: [0, 2, 4, 5, 7, 9, 11] });
    expect(parseKey('F# phrygian').root).toBe(6);
    expect(parseKey('E open fifth').scale).toEqual([0, 7, 12]);
  });

  it('placeholders are deterministic and sized to the request', () => {
    const jobs = expandJobs(tinyManifest(), 'stable-audio', '/c');
    for (const j of jobs) {
      const a = synthesizePlaceholder(j);
      const b = synthesizePlaceholder(j);
      // Buffer.equals, not toEqual: a deep compare of multi-MB typed arrays is minutes, not milliseconds
      expect(Buffer.from(encodeWav(a, 32)).equals(Buffer.from(encodeWav(b, 32)))).toBe(true);
      expect(a.channels.length).toBe(j.kind === 'stem' || j.kind === 'ambience' ? 2 : 1);
      expect(a.channels[0]!.length).toBe(Math.max(1, Math.round(j.prompt.durationSec * SR)));
    }
  });
});
