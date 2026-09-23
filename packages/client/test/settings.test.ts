// @vitest-environment jsdom
/**
 * §20.8.2 effective reduced effects — accessibility always wins — and the rest of the settings rules: the document
 * mirror (data-reduced, data-cb, --ui-scale), UI-scale clamping and key-remap validity.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEffectiveSettings, onEffectiveSettings, startApplySettings } from '../src/state/applySettings';
import { REDUCED_LOCKED, effectiveReduced, effectsFlags } from '../src/state/effective';
import { DEFAULT_KEYBINDS, DEFAULT_SETTINGS, bindingConflict, clampUiScale, isBindable, useSettingsStore } from '../src/state/settings';
import type { SettingsData } from '../src/state/settings';

const withA11y = (a: Partial<SettingsData['accessibility']>, g: Partial<SettingsData['graphics']> = {}): SettingsData => ({
  ...DEFAULT_SETTINGS,
  accessibility: { ...DEFAULT_SETTINGS.accessibility, ...a },
  graphics: { ...DEFAULT_SETTINGS.graphics, ...g },
});

describe('effectiveReduced', () => {
  it.each([
    ['on', false, false, true],
    ['on', true, false, true],
    ['off', true, false, false],
    ['off', false, false, false],
    ['system', true, false, true],
    ['system', false, false, false],
    ['off', false, true, true],
    ['system', false, true, true],
  ] as const)('reducedMotion=%s system=%s reducedEffects=%s → %s', (mode, sys, fx, expected) => {
    expect(effectiveReduced(withA11y({ reducedMotion: mode }, { reducedEffects: fx }), sys)).toBe(expected);
  });
});

describe('effectsFlags', () => {
  it('reduced wins over every graphics toggle except static bloom', () => {
    const all = withA11y({}, { dof: true, bloom: true, grain: true, chroma: true, shake: true, hitstop: true, slowmo: true });
    expect(effectsFlags(all, true)).toEqual({ dof: false, bloom: true, grain: false, chroma: false, shake: false, hitstop: false, slowmo: false, taa: true });
    for (const k of REDUCED_LOCKED) expect(effectsFlags(all, true)[k]).toBe(false);
  });

  it('follows the toggles when not reduced; TAA is always on', () => {
    const some = withA11y({}, { dof: false, bloom: false, grain: true, chroma: false, shake: true, hitstop: false, slowmo: true });
    expect(effectsFlags(some, false)).toEqual({ dof: false, bloom: false, grain: true, chroma: false, shake: true, hitstop: false, slowmo: true, taa: true });
  });
});

describe('applySettings mirrors onto :root and notifies part 2', () => {
  let stop: () => void = () => undefined;
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS });
    stop = startApplySettings();
  });
  afterEach(() => stop());

  it('data-reduced, data-cb and --ui-scale follow the store immediately', () => {
    const root = document.documentElement;
    expect(root.dataset['reduced']).toBe('0');
    useSettingsStore.getState().set('accessibility', { reducedMotion: 'on', colorblind: 'tritanopia', uiScale: 1.2 });
    expect(root.dataset['reduced']).toBe('1');
    expect(root.dataset['cb']).toBe('tritanopia');
    expect(root.style.getPropertyValue('--ui-scale')).toBe('1.2');
    expect(getEffectiveSettings().effects.shake).toBe(false);
    useSettingsStore.getState().set('accessibility', { colorblind: 'none' });
    expect(root.dataset['cb']).toBeUndefined();
  });

  it('onEffectiveSettings fires at once and on every change', () => {
    const seen: boolean[] = [];
    const off = onEffectiveSettings((e) => seen.push(e.reduced));
    useSettingsStore.getState().set('graphics', { reducedEffects: true });
    off();
    expect(seen).toEqual([false, true]);
  });
});

describe('ui scale and key remapping (§20.8.4/§20.8.5)', () => {
  it('clamps the UI scale to 0.9..1.4 in 0.05 steps', () => {
    expect(clampUiScale(2)).toBe(1.4);
    expect(clampUiScale(0.5)).toBe(0.9);
    expect(clampUiScale(1.12)).toBe(1.1);
  });

  it('refuses Escape/Enter/Tab and F-keys other than F1/F3', () => {
    for (const code of ['Escape', 'Enter', 'Tab', 'F2', 'F5', 'F12']) expect(isBindable(code)).toBe(false);
    for (const code of ['F1', 'F3', 'KeyW', 'Digit1', 'ShiftLeft']) expect(isBindable(code)).toBe(true);
  });

  it('reports a conflict with the action that holds the key', () => {
    expect(bindingConflict(DEFAULT_KEYBINDS, 'jump', 'KeyW')).toBe('forward');
    expect(bindingConflict(DEFAULT_KEYBINDS, 'forward', 'KeyW')).toBeNull();
    expect(bindingConflict(DEFAULT_KEYBINDS, 'jump', 'KeyZ')).toBeNull();
  });

  it('resetKeybinds restores the §20.4.5 table', () => {
    useSettingsStore.getState().set('keybinds', { jump: ['KeyZ'] });
    expect(useSettingsStore.getState().keybinds.jump).toEqual(['KeyZ']);
    useSettingsStore.getState().resetKeybinds();
    expect(useSettingsStore.getState().keybinds).toEqual(DEFAULT_KEYBINDS);
  });
});
