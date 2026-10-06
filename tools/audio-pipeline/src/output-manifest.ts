/**
 * SPEC §40.4.6 — `public/audio/manifest.json`, the exact §20.7.4 shape the client consumes.
 *
 * The interfaces below mirror `packages/client/src/audio/manifest.ts` (§20.7.4) field for field. They are
 * restated here only because a tool may not import `@ewa/client` (§40.0.2 rule 5); `output-manifest.test` in
 * `plan.test.ts` pins the key sets so a drift fails a test rather than a boot.
 */
import { writeJson } from './json.js';
import type { AudioSourceManifest, StemLayer } from './schema.js';

export interface AudioClipRef {
  readonly url: string;
  readonly urlFallback: string;
  readonly durationSec: number;
  readonly bytes: number;
  readonly hash: string;
} // url = .webm (Opus), urlFallback = .m4a (AAC)
export interface StemRef extends AudioClipRef {
  readonly loopStartSec: number;
  readonly loopEndSec: number;
  readonly lufs: number;
}
export interface AudioManifest {
  readonly version: 1;
  readonly builtAt: string; // ISO-8601
  readonly themes: Readonly<Record<string, ThemeEntry>>;
  readonly sfx: Readonly<Record<string, { readonly clips: readonly AudioClipRef[]; readonly gainDb: number; readonly bus: 'sfx' | 'ui'; readonly maxConcurrent: number }>>;
  readonly ambience: Readonly<Record<string, StemRef>>;
  readonly zoneThemes: Readonly<Record<string, string>>;
}

/**
 * One theme. `derived` (Phase E4 addition, optional, absent for provider-generated themes) lists the layers the CC0
 * ingest derived from the theme's base track: they are filtered copies of base, sample-aligned and level-set under
 * it, and share base's static gain — the client plays them exactly like generated layers.
 */
export interface ThemeEntry {
  readonly stems: { readonly base: StemRef; readonly threat: StemRef; readonly biome: StemRef; readonly night: StemRef };
  readonly bpm: number;
  readonly derived?: readonly StemLayer[];
}

export const CLIP_REF_KEYS = ['bytes', 'durationSec', 'hash', 'url', 'urlFallback'] as const;
export const STEM_REF_KEYS = [...CLIP_REF_KEYS, 'loopEndSec', 'loopStartSec', 'lufs'].sort();
export const MANIFEST_KEYS = ['ambience', 'builtAt', 'sfx', 'themes', 'version', 'zoneThemes'] as const;

/** A processed clip, keyed by job id (`themes/<t>/<layer>`, `ambience/<biome>`, `sfx/<id>_<n>`). */
export interface ProcessedClip {
  readonly id: string;
  readonly ref: AudioClipRef;
  readonly loop: { readonly loopStartSec: number; readonly loopEndSec: number; readonly lufs: number } | null;
}

export function assembleManifest(src: AudioSourceManifest, clips: ReadonlyMap<string, ProcessedClip>, builtAt: string, derived: Readonly<Record<string, readonly StemLayer[]>> = {}): AudioManifest {
  const need = (id: string): ProcessedClip => {
    const c = clips.get(id);
    if (c === undefined) throw new Error(`audio-pipeline: no processed clip for '${id}'`);
    return c;
  };
  const stem = (id: string): StemRef => {
    const c = need(id);
    if (c.loop === null) throw new Error(`audio-pipeline: '${id}' has no loop points`);
    return { ...c.ref, ...c.loop };
  };
  const themes: Record<string, { stems: Record<StemLayer, StemRef>; bpm: number; derived?: StemLayer[] }> = {};
  for (const t of src.themes) {
    themes[t.id] = {
      bpm: t.bpm,
      stems: {
        base: stem(`themes/${t.id}/base`),
        threat: stem(`themes/${t.id}/threat`),
        biome: stem(`themes/${t.id}/biome`),
        night: stem(`themes/${t.id}/night`),
      },
    };
    const d = derived[t.id];
    if (d !== undefined && d.length > 0) themes[t.id]!.derived = [...d];
  }
  const ambience: Record<string, StemRef> = {};
  for (const a of src.ambience) ambience[a.biome] = stem(`ambience/${a.biome}`);
  const sfx: Record<string, { clips: AudioClipRef[]; gainDb: number; bus: 'sfx' | 'ui'; maxConcurrent: number }> = {};
  for (const s of src.sfx) {
    const refs: AudioClipRef[] = [];
    for (let i = 1; i <= s.variants; i++) refs.push(need(`sfx/${s.id}_${i}`).ref);
    sfx[s.id] = { clips: refs, gainDb: s.gainDb, bus: s.bus, maxConcurrent: s.maxConcurrent };
  }
  return { version: 1, builtAt, themes, sfx, ambience, zoneThemes: { ...src.zoneThemes } };
}

export function writeManifest(file: string, m: AudioManifest): void {
  writeJson(file, m);
}

/** The determinism view (§40.4.7): the manifest minus `builtAt`. */
export function withoutBuiltAt(m: AudioManifest): Omit<AudioManifest, 'builtAt'> {
  const { builtAt: _drop, ...rest } = m;
  return rest;
}
