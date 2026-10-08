/**
 * `creatures/` budget and manifest-shape assertions (spec §40.1.4, §40.1.5, §40.6 and
 * 50-verification-budget §50.4.8), run against the REAL output under
 * `packages/client/public/creatures/`; skipped when it is absent.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALBEDO_LADDER, NORMAL_LADDER } from '../src/encode.js';
import { loadLegacySpecies } from '../src/legacy.js';
import type { SpriteManifestV2 } from '../src/manifest.js';
import { MANIFEST_FILE, manifestErrors, serializeManifest, staticManifest } from '../src/manifest.js';
import { dirBytes, staticDirBytes } from '../src/pipeline.js';
import type { QaReport } from '../src/qa.js';
import { ANIM_BUDGET_BYTES, ANIM_DIR, CREATURES_BUDGET_BYTES, MANIFEST_FOOT_V, MAX_ATLASES_PER_ZONE, MAX_DUPLICATED_SPECIES, THUMB_MAX_BYTES } from '../src/types.js';
import { ZONE_ORDER } from '../src/zones.js';
import { LEGACY_DIR, REAL_OUT_DIR, REAL_QA_DIR } from './helpers.js';

const MANIFEST_PATH = path.join(REAL_OUT_DIR, MANIFEST_FILE);
const REPORT_PATH = path.join(REAL_QA_DIR, 'qa-report.json');
// sprite entries: the 130 species of ewamon.js + the post-legacy additions (.design/additions/species.js, 1 today)
// + their battle forms under `<species>_<form>` (hollowmane_rage)
const SPECIES_COUNT = 132;

function listFiles(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    const r = rel ? `${rel}/${f}` : f;
    if (statSync(p).isDirectory()) out.push(...listFiles(p, r));
    else out.push(r);
  }
  return out;
}

describe.skipIf(!existsSync(MANIFEST_PATH))('creatures/ budget (real output)', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as SpriteManifestV2;
  const size = (rel: string): number => statSync(path.join(REAL_OUT_DIR, rel)).size;

  it(`totalBytes ≤ ${CREATURES_BUDGET_BYTES} (35 MiB) and equals the bytes on disk`, () => {
    expect(manifest.totalBytes).toBeLessThanOrEqual(CREATURES_BUDGET_BYTES);
    // everything outside anim/, minus the bytes the manifest's anim fields add (charged to the anim line, §40.6)
    const share = Buffer.byteLength(serializeManifest(manifest)) - Buffer.byteLength(serializeManifest(staticManifest(manifest)));
    expect(staticDirBytes(REAL_OUT_DIR) - share).toBe(manifest.totalBytes);
    expect(staticDirBytes(REAL_OUT_DIR)).toBeLessThanOrEqual(CREATURES_BUDGET_BYTES);
    expect(dirBytes(REAL_OUT_DIR)).toBe(manifest.totalBytes + (manifest.animTotalBytes ?? 0));
  });

  it(`anim/: animTotalBytes ≤ ${ANIM_BUDGET_BYTES} (24 MiB) = the anim files + the manifest's anim share`, () => {
    expect(manifest.animTotalBytes).toBeDefined();
    expect(manifest.animTotalBytes!).toBeLessThanOrEqual(ANIM_BUDGET_BYTES);
    const share = Buffer.byteLength(serializeManifest(manifest)) - Buffer.byteLength(serializeManifest(staticManifest(manifest)));
    expect(dirBytes(path.join(REAL_OUT_DIR, ANIM_DIR)) + share).toBe(manifest.animTotalBytes);
    // the file on disk is exactly the pipeline's serialisation
    expect(readFileSync(MANIFEST_PATH, 'utf8')).toBe(serializeManifest(manifest));
  });

  it('is a valid v2 manifest for exactly the 131 species of ewamon.js + additions and the hollowmane_rage form', () => {
    const ids = Object.keys(manifest.sprites);
    expect(ids.length).toBe(SPECIES_COUNT);
    expect(ids).toEqual([...ids].sort());
    // @ewa/content does not export SPECIES yet (spec OQ-4): the legacy ewamon.js is the species source.
    const species = existsSync(LEGACY_DIR) ? [...loadLegacySpecies(LEGACY_DIR).keys()].sort() : ids;
    expect(species.length).toBe(SPECIES_COUNT);
    expect(ids).toEqual(species);
    expect(manifestErrors(manifest, { species, budgetBytes: CREATURES_BUDGET_BYTES, animBudgetBytes: ANIM_BUDGET_BYTES })).toEqual([]);
    expect(manifest.version).toBe(2);
    expect(manifest.encoding).toBe('webp');
    expect(manifest.spriteSize).toBe(1024);
    expect(ids.some((id) => id.includes('@'))).toBe(false);
    expect(ids).toContain('hollowmane_rage');
  });

  it(`atlases ≤ 68, every sprite stored once (+ duplicates ≤ ${MAX_DUPLICATED_SPECIES}), 2048² cells, half-res normals`, () => {
    expect(manifest.atlases.length).toBeLessThanOrEqual(68);
    const placements = manifest.atlases.reduce((n, a) => n + a.species.length, 0);
    const duplicated = placements - SPECIES_COUNT;
    expect(duplicated).toBeGreaterThanOrEqual(0);
    expect(duplicated).toBeLessThanOrEqual(MAX_DUPLICATED_SPECIES);
    const slots = manifest.atlases.reduce((n, a) => n + a.slots, 0);
    expect(slots).toBe(2 * SPECIES_COUNT + 2 * duplicated);
    for (const a of manifest.atlases) {
      expect(a.size).toBe(2048);
      expect(a.slots).toBe(a.species.length * 2);
      expect(a.normalScale).toBe(0.5);
      expect(a.albedo.codec).toBe('webp-lossy');
      expect(a.normal.codec).toBe('webp-lossy');
      expect(a.emissive.codec).toBe('webp-lossless');
      expect(ALBEDO_LADDER).toContain(a.albedo.quality);
      expect(NORMAL_LADDER).toContain(a.normal.quality);
    }
  });

  it(`every zone is present and binds ≤ ${MAX_ATLASES_PER_ZONE} atlases`, () => {
    expect(Object.keys(manifest.zones).sort()).toEqual([...ZONE_ORDER].sort());
    for (const z of ZONE_ORDER) {
      const list = manifest.zones[z]!;
      expect(list.length, z).toBeLessThanOrEqual(MAX_ATLASES_PER_ZONE);
      for (const a of list) expect(manifest.atlases.some((x) => x.id === a), `${z} -> ${a}`).toBe(true);
    }
    // A zone with a spawn table binds something; a town whose league team is placed binds its gym atlases.
    expect(manifest.zones.mire_route!.length).toBeGreaterThan(0);
    expect(manifest.zones.solenne!.length).toBeGreaterThan(0);
  });

  it(`every sprite has front/back rects (footV ${MANIFEST_FOOT_V}, aspect 1), a home atlas and a thumb ≤ ${THUMB_MAX_BYTES} B`, () => {
    for (const [id, s] of Object.entries(manifest.sprites)) {
      for (const side of ['front', 'back'] as const) {
        const r = s[side];
        expect(r.footV, `${id}.${side}`).toBe(MANIFEST_FOOT_V);
        expect(r.aspect, `${id}.${side}`).toBe(1);
        expect(r.px[2], `${id}.${side}`).toBe(1024);
        expect(r.px[3], `${id}.${side}`).toBe(1024);
        expect(r.atlas, `${id}.${side}`).toBe(s.home);
      }
      expect(manifest.atlases.some((a) => a.id === s.home), `${id}.home`).toBe(true);
      expect(s.thumb).toBe(`thumbs/${id}_front.webp`);
      expect(existsSync(path.join(REAL_OUT_DIR, s.thumb)), s.thumb).toBe(true);
      expect(size(s.thumb), s.thumb).toBeLessThanOrEqual(THUMB_MAX_BYTES);
      expect(typeof s.sizeScale).toBe('number');
    }
  });

  it('every referenced file exists with the recorded byte count, and nothing else is shipped', () => {
    const referenced = new Set<string>([MANIFEST_FILE]);
    for (const a of manifest.atlases) {
      for (const k of ['albedo', 'normal', 'emissive'] as const) {
        const files = [a[k].url, ...a[k].mips];
        expect(files.length).toBe(4);
        let bytes = 0;
        for (const f of files) {
          expect(existsSync(path.join(REAL_OUT_DIR, f)), f).toBe(true);
          bytes += size(f);
          referenced.add(f);
        }
        expect(bytes, `${a.id}.${k}.bytes`).toBe(a[k].bytes);
      }
    }
    for (const s of Object.values(manifest.sprites)) referenced.add(s.thumb);
    for (const a of manifest.animAtlases ?? []) {
      for (const k of ['albedo', 'normal', 'emissive'] as const) {
        const files = [a[k].url, ...a[k].mips];
        let bytes = 0;
        for (const f of files) {
          expect(f.startsWith(`${ANIM_DIR}/`), f).toBe(true);
          expect(existsSync(path.join(REAL_OUT_DIR, f)), f).toBe(true);
          bytes += size(f);
          referenced.add(f);
        }
        expect(bytes, `${a.id}.${k}.bytes`).toBe(a[k].bytes);
      }
    }
    const onDisk = listFiles(REAL_OUT_DIR);
    expect(onDisk.filter((f) => !referenced.has(f))).toEqual([]);
    expect([...referenced].filter((f) => !onDisk.includes(f))).toEqual([]);
    expect(onDisk.some((f) => f.startsWith('animations/'))).toBe(false);
  });

  describe.skipIf(!existsSync(REPORT_PATH))('qa-report.json', () => {
    const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as QaReport;

    it('has 0 actionable flags over the 264 sprites, lists the excluded alternate-style files, and no unresolved flag kinds', () => {
      expect(report.total).toBe(2 * SPECIES_COUNT);
      expect(report.actionable).toBe(0);
      for (const e of report.flagged) expect(e.actionable, `${e.species}/${e.side}`).toEqual([]);
      expect(report.excluded.map((e) => e.file).sort()).toEqual([
        'back/yaschamp(back)(fighterstyle).png',
        'front/yaschamp(front)(boxingstyle).png',
        'front/yaschamp(front)(fighterstyle).png',
      ]);
      for (const e of report.excluded) expect(e.reason).toBe('alternate-style');
      for (const flag of ['fallback-source', 'missing-side', 'leak', 'empty']) expect(report.counts[flag], flag).toBeUndefined();
      expect(report.counts.multiframe).toBe(20);
      expect(report.accepted.map((a) => `${a.species}/${a.flag}`)).toEqual(['malice/coverage']);
    });

    it('records the plan and the encoding rung that shipped', () => {
      expect(Object.keys(report.bindStats).sort()).toEqual([...ZONE_ORDER].sort());
      for (const z of ZONE_ORDER) expect(report.bindStats[z]!.atlases).toBe(manifest.zones[z]!.length);
      expect(report.totalBytes).toBe(manifest.totalBytes);
      expect(report.encoding).not.toBeNull();
      expect(report.encoding!.albedoQuality).toBe(manifest.atlases[0]!.albedo.quality);
      expect(report.encoding!.normalQuality).toBe(manifest.atlases[0]!.normal.quality);
      expect(report.encoding!.rungsTried.at(-1)!.totalBytes).toBe(manifest.totalBytes);
      expect(report.encoding!.thumbs.count).toBe(SPECIES_COUNT);
    });
  });
});
