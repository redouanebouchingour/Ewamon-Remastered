/**
 * §20.7 audio: the mixer table's numbers, the night-stem curve over the wrapped night window [0.80, 0.22), the
 * perceptual bus gain, and the director's silent path (no manifest / no AudioContext: every call is valid, state is
 * kept, nothing plays); the manifest validator lists missing zone themes and sfx ids.
 */
import { describe, expect, it } from 'vitest';
import { ZONE_ORDER } from '@ewa/content';
import { createAudioDirector } from '../src/audio/AudioDirector';
import { validateAudioManifest } from '../src/audio/manifest';
import type { AudioManifest } from '../src/audio/manifest';
import { MIXER, dbToGain, nightGain, perceptual, reverbKindFor } from '../src/audio/mixer';
import { TIMELINE_SFX } from '../src/battle/timeline';

describe('mixer (§20.7.2)', () => {
  it('ships the table values', () => {
    expect(MIXER.master).toBe(1);
    expect(MIXER.music).toBeCloseTo(0.501, 3);
    expect(MIXER.sfx).toBeCloseTo(0.708, 3);
    expect(MIXER.ui).toBeCloseTo(0.398, 3);
    expect(MIXER.compressor).toEqual({ threshold: -12, knee: 6, ratio: 4, attack: 0.003, release: 0.25 });
    expect(MIXER.duck).toEqual({ db: -9, attackMs: 250, releaseMs: 600 });
    expect(MIXER.panner).toMatchObject({ panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 4, maxDistance: 60, rolloffFactor: 1.5 });
    expect(MIXER.reverbSend).toEqual({ outdoor: 0.12, plaza: 0.18, interior: 0.35, cave: 0.5 });
    expect(MIXER.irSeconds).toMatchObject({ outdoor: 0.5, interior: 1.2, cave: 2.4 });
    expect([MIXER.voices, MIXER.perIdCooldownMs, MIXER.perIdConcurrency]).toEqual([24, 40, 4]);
    expect(MIXER.harvestLowpass).toEqual({ hz: 1200, q: 0.7 });
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
  });

  it('night stem: 1 across [0.82, 0.20], 0 across [0.24, 0.78], smooth ramps in between (wrapping)', () => {
    for (const t of [0.83, 0.9, 0.99, 0, 0.1, 0.19]) expect(nightGain(t), `t=${t}`).toBeCloseTo(1, 6);
    for (const t of [0.25, 0.4, 0.5, 0.7, 0.77]) expect(nightGain(t), `t=${t}`).toBeCloseTo(0, 6);
    expect(nightGain(0.8)).toBeCloseTo(0.5, 6);
    expect(nightGain(0.22)).toBeCloseTo(0.5, 6);
    expect(nightGain(1.9)).toBeCloseTo(nightGain(0.9), 9);
  });

  it('bus sliders are perceptual (gain²); reverb kinds follow the zone', () => {
    expect(perceptual(0.5)).toBeCloseTo(0.25, 9);
    expect(perceptual(2)).toBe(1);
    expect(reverbKindFor('town', 'grove')).toBe('plaza');
    expect(reverbKindFor('route', 'grove')).toBe('outdoor');
    expect(reverbKindFor('story', 'vesper')).toBe('cave');
  });
});

describe('AudioDirector silent path', () => {
  it('answers every call without a manifest or a context, keeping state', async () => {
    const d = createAudioDirector({ createContext: () => null });
    await d.init(null);
    expect(d.state.silent).toBe(true);
    d.setTheme('grove', 400);
    d.setThreat(true);
    d.setNight(0.9);
    d.setHarvested(true);
    d.duck(true);
    d.setBus('music', 0.5);
    d.setReverbZone('cave');
    d.play('hit_super', { x: 1, y: 0, z: 2 });
    d.play('ui_click', null);
    d.setListener(0, 10, 0, 0, -1, 0);
    for (let i = 0; i < 60; i++) d.step();
    d.suspend();
    d.resume();
    expect(d.state).toMatchObject({ theme: 'grove', threat: true, night: 0.9, harvested: true, ducked: true, reverb: 'cave', played: 0, voices: 0, contextReady: false });
    expect(d.state.buses.music).toBe(0.5);
    expect(d.themeFor('mirevale', 'grove')).toBe('grove');
    d.dispose();
  });

  it('the gesture arm creates nothing without an AudioContext and removes its listeners', () => {
    const listeners = new Map<string, () => void>();
    const target = {
      addEventListener: (t: string, f: () => void) => listeners.set(t, f),
      removeEventListener: (t: string) => listeners.delete(t),
    } as unknown as Window;
    const d = createAudioDirector({ createContext: () => null });
    d.armOnGesture(target);
    expect([...listeners.keys()].sort()).toEqual(['keydown', 'pointerdown']);
    listeners.get('pointerdown')!();
    expect(listeners.size).toBe(0);
    expect(d.state.contextReady).toBe(false);
  });
});

describe('manifest validation (dev boot)', () => {
  it('lists missing zone themes and sfx ids', () => {
    const m: AudioManifest = { version: 1, builtAt: '2026-09-25T00:00:00Z', themes: {}, sfx: { hit_normal: { clips: [], gainDb: 0, bus: 'sfx', maxConcurrent: 4 } }, ambience: {}, zoneThemes: { mirevale: 'grove', nowhere: 'x' } };
    const problems = validateAudioManifest(m, TIMELINE_SFX);
    expect(problems).toContain("zoneThemes: 'nowhere' is not a ZoneId");
    expect(problems.filter((p) => p.startsWith('zoneThemes') && p.endsWith('missing'))).toHaveLength(ZONE_ORDER.length - 1);
    expect(problems).not.toContain("sfx: 'hit_normal' missing");
    expect(problems).toContain("sfx: 'faint' missing");
  });
});
