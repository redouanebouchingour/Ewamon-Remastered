/**
 * The Dex reads an entry aloud (2026-10-26): the species' cry, then its flavour text in the creature's voice. Outside
 * the world's AudioDirector (private to World3D), so the cry plays through a plain audio element at master x sfx and
 * the clip's own gain; the speech goes through its own speaker (voice/speaker.ts) with the same local-voice rule as
 * the rest of the game. A press is the player asking for it, so the NPC-voices toggle does not gate it; master or
 * voices at 0 does. Cries are per type (`cry_<type>_1|2`), one of the two picked by the dex number.
 */
import type { SpeciesDef } from '@ewa/core';
import { useSettingsStore } from '../state/settings';
import { creaturePersona, hushVoices } from '../voice/bindVoices';
import { createSpeaker } from '../voice/speaker';
import type { Speaker } from '../voice/speaker';
import { browserSpeech } from '../voice/speech';
import { loadAudioManifest } from './manifest';
import type { AudioManifest } from './manifest';
import { perceptual } from './mixer';

let manifest: Promise<AudioManifest | null> | null = null;
let speaker: Speaker | null = null;
let playing: HTMLAudioElement | null = null;

const settings = () => useSettingsStore.getState().audio;

/** The cry id and clip of a species: its first type's cry, variant by dex number. */
export function cryOf(sp: Pick<SpeciesDef, 'types' | 'dexNumber'>): { readonly id: string; readonly clip: 0 | 1 } {
  return { id: `cry_${sp.types[0].toLowerCase()}`, clip: (sp.dexNumber % 2) as 0 | 1 };
}

/** Plays the species' cry; resolves false when there is nothing to play (no manifest, muted, no audio element). */
export async function playCry(sp: Pick<SpeciesDef, 'types' | 'dexNumber'>): Promise<boolean> {
  const a = settings();
  const volume = perceptual(a.master) * perceptual(a.sfx);
  if (volume <= 0 || typeof Audio === 'undefined') return false;
  manifest ??= loadAudioManifest();
  const m = await manifest;
  const { id, clip } = cryOf(sp);
  const entry = m?.sfx[id];
  const ref = entry?.clips[clip] ?? entry?.clips[0];
  if (entry === undefined || ref === undefined) return false;
  playing?.pause();
  const el = new Audio();
  const webm = el.canPlayType('audio/webm; codecs="opus"') !== '';
  el.src = webm ? ref.url : ref.urlFallback;
  el.volume = Math.min(1, volume * 10 ** (entry.gainDb / 20));
  playing = el;
  try {
    await el.play();
    return true;
  } catch (_e) {
    return false;
  }
}

/** Reads the flavour text in the species' voice (after its cry). False when speech is off or unavailable. */
export function readEntry(sp: SpeciesDef): boolean {
  const a = settings();
  if (a.master <= 0 || a.voices <= 0) return false;
  if (speaker === null) {
    const engine = browserSpeech();
    if (engine === null) return false;
    speaker = createSpeaker({ engine, allowed: () => settings().master > 0 && settings().voices > 0, volume: () => perceptual(settings().master) * perceptual(settings().voices) });
  }
  hushVoices();
  speaker.say('world', creaturePersona(`dex:${sp.id}`, sp.id), `${sp.name}. ${sp.flavor}`);
  return true;
}

/** Stops the cry and the reading (the entry closed or changed). */
export function hushEntry(): void {
  playing?.pause();
  playing = null;
  speaker?.hush();
}
