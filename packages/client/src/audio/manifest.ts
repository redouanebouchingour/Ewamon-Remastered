/**
 * SPEC §20.7.4 — the audio asset manifest the client consumes (`public/audio/manifest.json`, emitted by the audio
 * pipeline §40.4.6). The file does not exist yet: `loadAudioManifest()` resolves null on a 404 / parse failure and
 * the AudioDirector runs its silent path (every call valid, nothing fetched or played).
 */
import { ZONE_ORDER } from '@ewa/content';

/** url = .webm (Opus 96 kb/s), urlFallback = .m4a (AAC 128 kb/s); chosen once via canPlayType('audio/webm; codecs=opus') */
export interface AudioClipRef { readonly url: string; readonly urlFallback: string; readonly durationSec: number; readonly bytes: number; readonly hash: string }
export interface StemRef extends AudioClipRef { readonly loopStartSec: number; readonly loopEndSec: number; readonly lufs: number }
/**
 * Phase E4 (`40-pipelines.md` §40.4.8): layers the CC0 ingest derived from a theme's base track — filtered copies,
 * sample-aligned and level-set under base, sharing its gain. Played like any layer, but never without base.
 */
export type DerivedStem = 'threat' | 'biome' | 'night';
export interface AudioManifest {
  readonly version: 1;
  /** ISO-8601 */
  readonly builtAt: string;
  /** theme ids: one per biome (11) + battle, gym, elite, champion, raid, victory */
  readonly themes: Readonly<Record<string, { readonly stems: { readonly base: StemRef; readonly threat: StemRef; readonly biome: StemRef; readonly night: StemRef }; readonly bpm: number; readonly derived?: readonly DerivedStem[] }>>;
  /** clips.length 1..4 round-robin variants */
  readonly sfx: Readonly<Record<string, { readonly clips: readonly AudioClipRef[]; readonly gainDb: number; readonly bus: 'sfx' | 'ui'; readonly maxConcurrent: number }>>;
  /** per-biome bed, looped on the music bus at −12 dB */
  readonly ambience: Readonly<Record<string, StemRef>>;
  /** ZoneId -> theme id; all 21 present (validated at client boot in dev) */
  readonly zoneThemes: Readonly<Record<string, string>>;
}

export const AUDIO_MANIFEST_URL = '/audio/manifest.json';

export async function loadAudioManifest(url: string = AUDIO_MANIFEST_URL): Promise<AudioManifest | null> {
  try {
    const res = await fetch(url, { priority: 'low' } as RequestInit);
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null; // the dev server's index.html fallback
    const m = (await res.json()) as AudioManifest;
    return m !== null && typeof m === 'object' && m.version === 1 ? m : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Dev boot validation (§20.7.4): every zoneThemes key is a ZoneId, all 21 present, and every sfx id the engine can
 * emit exists. Returns the problems (the caller logs them with console.error and boots on silently for those ids).
 */
export function validateAudioManifest(m: AudioManifest, sfxIds: readonly string[]): string[] {
  const out: string[] = [];
  const zones = new Set<string>(ZONE_ORDER);
  for (const k of Object.keys(m.zoneThemes)) if (!zones.has(k)) out.push(`zoneThemes: '${k}' is not a ZoneId`);
  for (const z of ZONE_ORDER) if (m.zoneThemes[z] === undefined) out.push(`zoneThemes: '${z}' missing`);
  for (const id of sfxIds) if (m.sfx[id] === undefined) out.push(`sfx: '${id}' missing`);
  return out;
}
