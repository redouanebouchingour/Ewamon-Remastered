/**
 * Voice talk (LLM feature 10): which of the browser's voices a speaker gets, at which pitch and rate.
 *
 * Only local voices (`localService`): Chrome also offers "Google ..." voices that synthesize on Google's servers, so
 * the line would leave the machine; they are never used. English voices first (every line is English); without one,
 * any local voice; without any local voice, none (the speaker then says nothing rather than fall back to the
 * browser's default voice, which may be a network one). A speaker's voice is a pure function of its key (an NPC id, a
 * creature id, a trainer's name) and the set of voices on offer, whatever order the browser lists them in, so a
 * villager sounds the same every visit.
 *
 * Pitch and rate: a villager or a trainer gets a seeded pitch (0.85..1.2) and rate (0.92..1.1); a creature's pitch
 * follows its species' size (`sizeScale` 0.5..2.2: a small one squeaks, a big one rumbles) with a little seeded
 * jitter; the commentator is fixed, a touch quick.
 */

export interface VoiceInfo {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
}

export type VoiceKind = 'npc' | 'creature' | 'caster';

export interface VoicePersona {
  /** what the voice is seeded by: `npc:<id>`, `creature:<id>`, `person:<name>` (the rival, a trainer), `caster` */
  readonly key: string;
  readonly kind: VoiceKind;
  /** a creature's species size (`sizeScale`, 0.5..2.2) */
  readonly size?: number;
}

export interface VoicePick {
  /** null: no local voice is listed, so the speaker says nothing */
  readonly voiceURI: string | null;
  readonly lang: string;
  readonly pitch: number;
  readonly rate: number;
}

/** FNV-1a, 32 bit: a stable seed per key. */
export function hashKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A second, independent number in [0, 1) from the same key. */
function unit(key: string, salt: string): number {
  return hashKey(`${salt}:${key}`) / 0x100000000;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** The voices a speaker may get: local only, English when there is one, in a fixed order. */
export function usableVoices(all: readonly VoiceInfo[]): readonly VoiceInfo[] {
  const local = all.filter((v) => v.localService);
  const english = local.filter((v) => /^en\b|^en[-_]/i.test(v.lang));
  const pool = english.length > 0 ? english : local;
  return [...pool].sort((a, b) => (a.voiceURI < b.voiceURI ? -1 : a.voiceURI > b.voiceURI ? 1 : 0));
}

/** A speaker's voice, pitch and rate. */
export function pickVoice(p: VoicePersona, all: readonly VoiceInfo[]): VoicePick {
  const pool = usableVoices(all);
  const v = pool.length === 0 ? null : pool[hashKey(p.key) % pool.length]!;
  const a = unit(p.key, 'pitch');
  const b = unit(p.key, 'rate');
  let pitch: number;
  let rate: number;
  switch (p.kind) {
    case 'caster':
      pitch = 1;
      rate = 1.08;
      break;
    case 'creature': {
      const size = clamp(p.size ?? 0.6 + a * 1.4, 0.5, 2.2);
      // 0.5 → 1.6, 2.2 → 0.6, then ±0.08 of seeded jitter
      pitch = clamp(1.6 - ((size - 0.5) / 1.7) * 1.0 + (a - 0.5) * 0.16, 0.5, 1.8);
      rate = 1.12 - ((size - 0.5) / 1.7) * 0.25 + (b - 0.5) * 0.08;
      break;
    }
    default:
      pitch = 0.85 + a * 0.35;
      rate = 0.92 + b * 0.18;
  }
  return { voiceURI: v?.voiceURI ?? null, lang: v?.lang ?? 'en-US', pitch: round2(pitch), rate: round2(rate) };
}
