/**
 * Mirrors SettingsState onto the document and the renderer (SPEC §20.8.2–§20.8.4):
 *   :root[data-reduced="1"]   every --motion-* token is 0ms (tokens.css)
 *   :root[data-cb="<mode>"]   the colourblind type palette (tokens.css)
 *   --ui-scale                the one permitted programmatic style write (§20.8.4)
 * and notifies subscribers (part 2: renderer.setEffects, renderer.hud.setScale, TimelineCtx.reduced) through
 * `onEffectiveSettings`. `prefers-reduced-motion` changes re-apply immediately.
 */
import { useSyncExternalStore } from 'react';
import type { EffectsFlags } from '@ewa/render';
import { effectiveReduced, effectsFlags } from './effective';
import { useSettingsStore } from './settings';
import type { Colorblind } from './settings';

export interface EffectiveSettings {
  readonly reduced: boolean;
  readonly systemPrefersReduced: boolean;
  readonly effects: EffectsFlags;
  readonly uiScale: number;
  readonly colorblind: Colorblind;
}

type Listener = (e: EffectiveSettings) => void;

const listeners = new Set<Listener>();
let systemPrefersReduced = false;
let current: EffectiveSettings = compute();
let started = false;

function compute(): EffectiveSettings {
  const s = useSettingsStore.getState();
  const reduced = effectiveReduced(s, systemPrefersReduced);
  return {
    reduced,
    systemPrefersReduced,
    effects: effectsFlags(s, reduced),
    uiScale: s.accessibility.uiScale,
    colorblind: s.accessibility.colorblind,
  };
}

function writeDocument(e: EffectiveSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset['reduced'] = e.reduced ? '1' : '0';
  if (e.colorblind === 'none') delete root.dataset['cb'];
  else root.dataset['cb'] = e.colorblind;
  root.style.setProperty('--ui-scale', String(e.uiScale));
}

function apply(): void {
  current = compute();
  writeDocument(current);
  for (const l of listeners) l(current);
}

/** Idempotent; main.tsx calls it once before the first render. Returns a stop function (tests). */
export function startApplySettings(): () => void {
  if (started) return () => undefined;
  started = true;
  let mq: MediaQueryList | null = null;
  const onMq = (ev: MediaQueryListEvent): void => {
    systemPrefersReduced = ev.matches;
    apply();
  };
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    systemPrefersReduced = mq.matches;
    mq.addEventListener('change', onMq);
  }
  const unsub = useSettingsStore.subscribe(apply);
  apply();
  return () => {
    started = false;
    unsub();
    mq?.removeEventListener('change', onMq);
  };
}

export function getEffectiveSettings(): EffectiveSettings {
  return current;
}

/** Part 2 seam: renderer.setEffects / hud.setScale / timeline reduced flag. Fires once immediately. */
export function onEffectiveSettings(l: Listener): () => void {
  listeners.add(l);
  l(current);
  return () => listeners.delete(l);
}

function subscribe(cb: () => void): () => void {
  const l: Listener = () => cb();
  listeners.add(l);
  return () => listeners.delete(l);
}

/** React read of the effective settings (Settings screen captions, reduced-motion caption). */
export function useEffectiveSettings(): EffectiveSettings {
  return useSyncExternalStore(subscribe, getEffectiveSettings, getEffectiveSettings);
}
