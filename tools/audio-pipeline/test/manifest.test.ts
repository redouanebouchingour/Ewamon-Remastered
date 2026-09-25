/**
 * The source manifest as a committed file: §40.0.2 rule 1 formatting, the bible ↔ JSON transcription, the fixed
 * id vocabularies, and the output manifest's §20.7.4 key sets.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../src/json.js';
import type { ProcessedClip } from '../src/output-manifest.js';
import { CLIP_REF_KEYS, MANIFEST_KEYS, STEM_REF_KEYS, assembleManifest, withoutBuiltAt } from '../src/output-manifest.js';
import { DEFAULT_PATHS, REPO_ROOT } from '../src/paths.js';
import { loadSourceManifest } from '../src/plan.js';
import { BIOME_IDS, CUE_THEME_IDS, SFX_MAX_SEC, requiredSfxIds, stemDurationSec } from '../src/schema.js';
import { TINY_VALIDATE, tinyManifest } from './helpers.js';

const raw = readFileSync(DEFAULT_PATHS.manifest, 'utf8');
const m = loadSourceManifest(DEFAULT_PATHS.manifest);
const BIBLE = path.join(REPO_ROOT, '.design', 'audio-bible.md');

describe('.design/audio/manifest.json as a file', () => {
  it('is sorted-key, 2-space, LF-terminated JSON (§40.0.2 rule 1)', () => {
    expect(raw).toBe(stableStringify(JSON.parse(raw)));
    expect(raw.includes('\r')).toBe(false);
    expect(raw.endsWith('}\n')).toBe(true);
  });

  it('arrays are sorted by id', () => {
    for (const arr of [m.themes, m.ambience, m.sfx]) {
      const ids = arr.map((x) => x.id);
      expect(ids).toEqual([...ids].sort());
    }
  });

  it('carries the 17 theme ids, 11 beds and every boot-validated sfx id', () => {
    expect(m.themes.map((t) => t.id).sort()).toEqual([...BIOME_IDS, ...CUE_THEME_IDS].sort());
    expect(m.ambience.map((a) => a.biome).sort()).toEqual([...BIOME_IDS].sort());
    const ids = new Set(m.sfx.map((s) => s.id));
    for (const id of requiredSfxIds()) expect(ids.has(id), id).toBe(true);
  });

  it('every stem prompt is whole bars + 2 s at its theme\'s bpm and key; sfx ≤ 4 s; seeds are uint32', () => {
    for (const t of m.themes) {
      const keys = new Set(Object.values(t.stems).map((p) => p.key));
      expect(keys.size, t.id).toBe(1);
      for (const p of Object.values(t.stems)) {
        expect(p.durationSec).toBe(stemDurationSec(t.bars, t.bpm));
        expect(p.text).toContain(`${t.bars} bars of 4/4 at ${t.bpm} BPM`);
      }
    }
    for (const s of m.sfx) {
      expect(s.prompt.durationSec).toBeLessThanOrEqual(SFX_MAX_SEC);
      expect(Number.isInteger(s.prompt.seed) && s.prompt.seed >= 0 && s.prompt.seed <= 0xffffffff).toBe(true);
    }
  });

  it('every prompt is instrumental and has a negative prompt', () => {
    const all = [...m.themes.flatMap((t) => Object.values(t.stems)), ...m.ambience.map((a) => a.prompt), ...m.sfx.map((s) => s.prompt)];
    for (const p of all) {
      expect(p.instrumental).toBe(true);
      expect(p.negative ?? '').not.toBe('');
    }
  });
});

describe('.design/audio-bible.md ↔ manifest.json', () => {
  it.skipIf(!existsSync(BIBLE))('the bible names every theme, bed and sfx id the JSON carries', () => {
    const bible = readFileSync(BIBLE, 'utf8');
    const missing: string[] = [];
    for (const t of m.themes) if (!bible.includes(`| \`${t.id}\` |`)) missing.push(`theme ${t.id}`);
    for (const a of m.ambience) if (!bible.includes(`| \`${a.biome}\` |`)) missing.push(`bed ${a.biome}`);
    for (const s of m.sfx) if (!bible.includes(`| \`${s.id}\` |`)) missing.push(`sfx ${s.id}`);
    expect(missing).toEqual([]);
  });
});

describe('output manifest (§20.7.4 shape)', () => {
  it('assembleManifest emits exactly the client\'s keys', () => {
    const src = tinyManifest();
    const clips = new Map<string, ProcessedClip>();
    const ref = { url: 'x.webm?v=00000000', urlFallback: 'x.m4a?v=00000000', durationSec: 1, bytes: 10, hash: '0'.repeat(64) };
    const loop = { loopStartSec: 0.05, loopEndSec: 9.65, lufs: -16 };
    for (const layer of ['base', 'threat', 'biome', 'night']) clips.set(`themes/grove/${layer}`, { id: layer, ref, loop });
    clips.set('ambience/grove', { id: 'ambience/grove', ref, loop });
    clips.set('sfx/hit_normal_1', { id: 'a', ref, loop: null });
    clips.set('sfx/hit_normal_2', { id: 'b', ref, loop: null });
    clips.set('sfx/ui_click_1', { id: 'c', ref, loop: null });
    void TINY_VALIDATE;
    const out = assembleManifest(src, clips, '2026-09-25T00:00:00.000Z');
    expect(Object.keys(out).sort()).toEqual([...MANIFEST_KEYS]);
    expect(out.version).toBe(1);
    expect(Object.keys(out.themes.grove!).sort()).toEqual(['bpm', 'stems']);
    expect(Object.keys(out.themes.grove!.stems).sort()).toEqual(['base', 'biome', 'night', 'threat']);
    expect(Object.keys(out.themes.grove!.stems.base).sort()).toEqual(STEM_REF_KEYS);
    expect(Object.keys(out.ambience.grove!).sort()).toEqual(STEM_REF_KEYS);
    expect(Object.keys(out.sfx.hit_normal!).sort()).toEqual(['bus', 'clips', 'gainDb', 'maxConcurrent']);
    expect(Object.keys(out.sfx.hit_normal!.clips[0]!).sort()).toEqual([...CLIP_REF_KEYS]);
    expect(out.sfx.ui_click!.bus).toBe('ui');
    expect(Object.keys(withoutBuiltAt(out))).not.toContain('builtAt');
  });

  it('refuses to assemble with a clip missing', () => {
    expect(() => assembleManifest(tinyManifest(), new Map(), 'x')).toThrow(/no processed clip/);
  });
});
