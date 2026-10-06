/**
 * Phase E4 — CC0 ingest. Every source file here is synthesised in the test (no downloads): a seamless music loop
 * 2 % longer than the theme's nominal loop (so it is time-stretched), an ambience bed transcoded to Ogg, a hit
 * longer than its id's duration (faded to fit) and a click transcoded to FLAC.
 *   - sources.json validation, job classification, coverage, salts and tempo overrides (pure)
 *   - ingest writes cache WAVs + 'cc0' records; derived layers are 4 equal-length, periodic, level-set stems
 *   - re-ingest is a cache hit; changing a source's bytes re-ingests exactly the jobs made from it
 *   - a missing file is reported (and blocks its derived siblings), never thrown
 *   - credits; and `process --provider cc0` builds a complete manifest from the ingested cache
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { renderCreditsMarkdown, renderCreditsText, creditRows } from '../src/credits.js';
import { checkFfmpeg, decodeToPcm } from '../src/ffmpeg.js';
import { LAYER_RECIPES, MAX_STRETCH, conformLoop, deriveLayer, fitSfx, prepareCc0, rms, runIngest, stemFromUnit } from '../src/ingest.js';
import type { CacheIndex } from '../src/jobs.js';
import { expandJobs, rawWavPath, requestHash } from '../src/jobs.js';
import { canonicalJson, sha256Hex } from '../src/json.js';
import type { IngestPaths } from '../src/paths.js';
import { runProcess } from '../src/process.js';
import { mulberry32 } from '../src/placeholder.js';
import type { AudioSourceManifest } from '../src/schema.js';
import { loopSec, stemDurationSec, validateSourceManifest } from '../src/schema.js';
import { CC0_PROVIDER, applySourceOverrides, classifyJobs, coverageOf, resolveCc0, validateSources } from '../src/sources.js';
import { encodeWav } from '../src/wav.js';
import { SR, TINY_VALIDATE, logSink, tempPaths, tinyManifest } from './helpers.js';

const FF = checkFfmpeg();
const FF_REASON = FF.ok ? '' : ` — SKIPPED: ffmpeg unavailable (${FF.reason ?? 'unknown'})`;
const cleanups: (() => void)[] = [];
afterAll(() => cleanups.forEach((c) => c()));

const manifest: AudioSourceManifest = validateSourceManifest(tinyManifest(), TINY_VALIDATE);
const theme = manifest.themes[0]!; // grove, 200 bpm, 8 bars → 9.6 s loop, 14 s stem
const NOMINAL = loopSec(theme.bars, theme.bpm);
const credit = { licence: 'CC0-1.0', author: 'Test Author', url: 'https://example.org/pack' };

/** A seamless loop of `sec` seconds: a chord, a bass note and accented clicks on 32 beats (one period). */
function musicLoop(sec: number, seed = 1): Float32Array[] {
  const n = Math.round(sec * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const rnd = mulberry32(seed);
  const beat = n / 32;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // integer cycles per loop for every partial, so the loop joins itself
    const f = (hz: number): number => Math.round(hz * sec) / sec;
    const pad = 0.05 * Math.sin(2 * Math.PI * f(220) * t) + 0.04 * Math.sin(2 * Math.PI * f(277.2) * t) + 0.08 * Math.sin(2 * Math.PI * f(110) * t);
    const k = i % beat;
    const accent = Math.floor(i / beat) % 4 === 0 ? 0.25 : 0.15;
    const click = k < 0.03 * SR ? accent * Math.exp(-k / (0.006 * SR)) * Math.sin((2 * Math.PI * 3000 * k) / SR) : 0;
    const air = (rnd() * 2 - 1) * 0.004;
    l[i] = pad + click + air;
    r[i] = pad * 0.9 + click + air;
  }
  return [l, r];
}

function noise(sec: number, seed: number, amp = 0.2): Float32Array[] {
  const rnd = mulberry32(seed);
  const n = Math.round(sec * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  let yl = 0;
  let yr = 0;
  for (let i = 0; i < n; i++) {
    yl += 0.05 * (rnd() * 2 - 1 - yl);
    yr += 0.05 * (rnd() * 2 - 1 - yr);
    l[i] = yl * amp * 4;
    r[i] = yr * amp * 4;
  }
  return [l, r];
}

function burst(sec: number, hz: number, seed: number): Float32Array[] {
  const n = Math.round(sec * SR);
  const out = new Float32Array(n);
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) out[i] = (0.5 * Math.sin((2 * Math.PI * hz * i) / SR) + 0.2 * (rnd() * 2 - 1)) * Math.exp(-i / (0.25 * SR));
  return [out];
}

function writeWav(file: string, chs: Float32Array[]): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, encodeWav({ sampleRate: SR, channels: chs }, 16));
}

function transcode(from: string, to: string, codec: string[]): void {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', from, ...codec, to], { windowsHide: true });
  rmSync(from);
}

interface Fixture {
  root: string;
  paths: ReturnType<typeof tempPaths>;
  ingest: IngestPaths;
  writeSources(map: Record<string, unknown>): void;
}

function fixture(): Fixture {
  const paths = tempPaths('ewa-audio-ingest-');
  cleanups.push(paths.cleanup);
  const ingest: IngestPaths = {
    sources: path.join(paths.root, 'sources.json'),
    cc0Dir: path.join(paths.root, 'cc0'),
    licences: path.join(paths.root, 'licenses'),
    credits: path.join(paths.root, 'CREDITS.md'),
  };
  return { root: paths.root, paths, ingest, writeSources: (map) => writeFileSync(ingest.sources, JSON.stringify(map, null, 2)) };
}

/** The four synthetic packs: music (wav), ambience (ogg), a hit (wav) and a click (flac). */
function writePacks(f: Fixture): void {
  const d = f.ingest.cc0Dir;
  writeWav(path.join(d, 'music', 'grove_loop.wav'), musicLoop(NOMINAL * 1.02));
  writeWav(path.join(d, 'amb', 'grove.wav'), noise(20, 5));
  transcode(path.join(d, 'amb', 'grove.wav'), path.join(d, 'amb', 'grove.ogg'), ['-c:a', 'libopus', '-b:a', '96k']);
  writeWav(path.join(d, 'sfx', 'hit.wav'), burst(0.8, 180, 7));
  writeWav(path.join(d, 'sfx', 'click.wav'), burst(0.1, 2000, 8));
  transcode(path.join(d, 'sfx', 'click.wav'), path.join(d, 'sfx', 'click.flac'), ['-c:a', 'flac']);
}

const FULL_SOURCES = {
  'themes/grove/base': { file: 'music/grove_loop.wav', title: 'Grove Loop', ...credit },
  'ambience/grove': { file: 'amb/grove.ogg', title: 'Forest Bed', ...credit, author: 'Bed Maker' },
  'sfx/hit_normal_1': { file: 'sfx/hit.wav', ...credit },
  'sfx/ui_click_1': { file: 'sfx/click.flac', ...credit, url: 'https://example.org/ui' },
};

// ─── pure ───────────────────────────────────────────────────────────────────

describe('sources.json validation and classification', () => {
  it('accepts CC0 entries and reports non-CC0 licences, unknown job ids and misplaced theme fields', () => {
    const r = validateSources(
      {
        $comment: 'ignored',
        'themes/grove/base': { file: 'a.ogg', ...credit, bpm: 96, bars: 16 },
        'themes/grove/night': { file: 'b.ogg', ...credit, bpm: 96 },
        'sfx/hit_normal_1': { file: 'c.wav', ...credit, licence: 'CC-BY-4.0' },
        'sfx/nope_1': { file: 'd.wav', ...credit },
        'ambience/grove': { file: '../escape.wav', ...credit },
      },
      manifest,
    );
    expect(Object.keys(r.entries)).toEqual(['themes/grove/base']);
    expect(r.problems.some((p) => p.startsWith('sfx/hit_normal_1.licence') && p.includes('CC0-1.0'))).toBe(true);
    expect(r.problems.some((p) => p.startsWith('sfx/nope_1') && p.includes('not a job id'))).toBe(true);
    expect(r.problems.some((p) => p.startsWith('themes/grove/night') && p.includes('base entry'))).toBe(true);
    expect(r.problems.some((p) => p.startsWith('ambience/grove.file'))).toBe(true);
  });

  it('classifies direct sources, derived theme layers, pitch-shifted sfx siblings and unmapped jobs; coverage counts them', () => {
    const c = classifyJobs(manifest, validateSources(FULL_SOURCES, manifest).entries);
    const role = (id: string): string => c.find((x) => x.id === id)!.role.kind;
    expect(role('themes/grove/base')).toBe('direct');
    for (const l of ['threat', 'biome', 'night']) expect(role(`themes/grove/${l}`)).toBe('layer');
    expect(role('sfx/hit_normal_2')).toBe('variant');
    const v = c.find((x) => x.id === 'sfx/hit_normal_2')!.role;
    expect(v.kind === 'variant' && v.from === 'sfx/hit_normal_1' && v.ratio !== 1).toBe(true);
    const cov = coverageOf(c);
    expect(cov).toMatchObject({ total: 8, covered: 8, fraction: 1 });
    expect(cov.byKind.stem).toEqual({ total: 4, direct: 1, derived: 3, unmapped: 0 });
    const partial = coverageOf(classifyJobs(manifest, validateSources({ 'sfx/ui_click_1': FULL_SOURCES['sfx/ui_click_1'] }, manifest).entries));
    expect(partial.covered).toBe(1);
    expect(partial.byKind.stem.unmapped).toBe(4);
    // derive: false leaves the other layers unmapped
    const noDerive = classifyJobs(manifest, validateSources({ 'themes/grove/base': { ...FULL_SOURCES['themes/grove/base'], derive: false } }, manifest).entries);
    expect(noDerive.find((x) => x.id === 'themes/grove/night')!.role.kind).toBe('none');
  });

  it('salts: unsalted hashes are unchanged, a content change re-hashes the job and everything derived from it, salted jobs ignore re-rolls', () => {
    const job = expandJobs(manifest, 'stable-audio', '/c')[0]!;
    expect(job.requestHash).toBe(sha256Hex('stable-audio', job.kind, canonicalJson(job.prompt)));
    const loaded = validateSources(FULL_SOURCES, manifest);
    const hashes: Record<string, string> = { 'music/grove_loop.wav': 'a', 'amb/grove.ogg': 'b', 'sfx/hit.wav': 'c', 'sfx/click.flac': 'd' };
    const one = resolveCc0(manifest, { ...loaded, file: 'x', exists: true }, '/cc0', (f) => hashes[path.relative('/cc0', f).split(path.sep).join('/')] ?? null);
    hashes['sfx/hit.wav'] = 'c2';
    const two = resolveCc0(manifest, { ...loaded, file: 'x', exists: true }, '/cc0', (f) => hashes[path.relative('/cc0', f).split(path.sep).join('/')] ?? null);
    const changed = Object.keys(one.salts).filter((k) => one.salts[k] !== two.salts[k]);
    expect(changed).toEqual(['sfx/hit_normal_1', 'sfx/hit_normal_2']);
    expect(Object.keys(one.salts)).toHaveLength(8);
    const a = expandJobs(manifest, CC0_PROVIDER, '/c', {}, one.salts).find((j) => j.id === 'themes/grove/base')!;
    const b = expandJobs(manifest, CC0_PROVIDER, '/c', { 'themes/grove/base': 2 }, one.salts).find((j) => j.id === 'themes/grove/base')!;
    expect(b.requestHash).toBe(a.requestHash);
    expect(a.requestHash).toBe(requestHash(CC0_PROVIDER, a.kind, a.prompt, one.salts['themes/grove/base']));
    // attribution edits do not re-process; a trim does
    const retitled = resolveCc0(manifest, { ...validateSources({ ...FULL_SOURCES, 'sfx/ui_click_1': { ...FULL_SOURCES['sfx/ui_click_1'], author: 'Someone Else' } }, manifest), file: 'x', exists: true }, '/cc0', () => 'h');
    const retrimmed = resolveCc0(manifest, { ...validateSources({ ...FULL_SOURCES, 'sfx/ui_click_1': { ...FULL_SOURCES['sfx/ui_click_1'], trim: [0, 0.05] } }, manifest), file: 'x', exists: true }, '/cc0', () => 'h');
    const base = resolveCc0(manifest, { ...loaded, file: 'x', exists: true }, '/cc0', () => 'h');
    expect(retitled.salts['sfx/ui_click_1']).toBe(base.salts['sfx/ui_click_1']);
    expect(retrimmed.salts['sfx/ui_click_1']).not.toBe(base.salts['sfx/ui_click_1']);
  });

  it('a base source that declares bpm/bars re-times its theme (bpm, bars, every stem prompt)', () => {
    const entries = validateSources({ 'themes/grove/base': { file: 'a.ogg', ...credit, bpm: 120, bars: 12 } }, manifest).entries;
    const m = applySourceOverrides(manifest, entries);
    const t = m.themes[0]!;
    expect([t.bpm, t.bars]).toEqual([120, 12]);
    for (const p of Object.values(t.stems)) expect([p.bpm, p.durationSec]).toEqual([120, stemDurationSec(12, 120)]);
    expect(applySourceOverrides(manifest, {})).toBe(manifest);
  });

  it('credits list one row per source file with title, author, url, licence and the jobs it fills', () => {
    const entries = validateSources(FULL_SOURCES, manifest).entries;
    const rows = creditRows(entries, classifyJobs(manifest, entries));
    expect(rows.map((r) => r.author)).toEqual(['Bed Maker', 'Test Author', 'Test Author', 'Test Author']);
    const grove = rows.find((r) => r.file === 'music/grove_loop.wav')!;
    expect(grove).toMatchObject({ title: 'Grove Loop', licence: 'CC0-1.0', url: 'https://example.org/pack', direct: ['themes/grove/base'] });
    expect(grove.derived).toEqual(['themes/grove/biome', 'themes/grove/night', 'themes/grove/threat']);
    expect(rows.find((r) => r.file === 'sfx/hit.wav')!.title).toBe('hit');
    const md = renderCreditsMarkdown(rows, ['CC0-1.0.txt']);
    expect(md).toContain('| Grove Loop | Test Author | CC0-1.0 | <https://example.org/pack> | `music/grove_loop.wav` | `themes/grove/base` (+3 derived) |');
    expect(md).toContain('[`licenses/CC0-1.0.txt`](licenses/CC0-1.0.txt)');
    const txt = renderCreditsText(rows);
    expect(txt).toContain('Forest Bed - Bed Maker');
    expect(txt).toContain('https://example.org/ui');
    expect(renderCreditsText([])).toContain('No third-party audio');
  });

  it('a premix is credited through its parts (one row each, its jobs and derived siblings included); parts never change the salt', () => {
    const premix = {
      'sfx/hit_normal_1': {
        file: 'mix/hit.wav', licence: 'CC0-1.0', author: 'Kenney (kenney.nl); rubberduck', url: 'https://example.org/a', title: 'Premix: hit',
        parts: [
          { file: 'packs/a/punch.ogg', author: 'Part A', url: 'https://example.org/a', title: 'Punch' },
          { file: 'packs/b/crack.ogg', author: 'Part B', url: 'https://example.org/b', licenceFile: 'B-License.txt' },
        ],
      },
    };
    const loaded = validateSources(premix, manifest);
    expect(loaded.problems).toEqual([]);
    const rows = creditRows(loaded.entries, classifyJobs(manifest, loaded.entries));
    expect(rows.map((r) => [r.file, r.author, r.title, r.licenceFile])).toEqual([
      ['packs/a/punch.ogg', 'Part A', 'Punch', null],
      ['packs/b/crack.ogg', 'Part B', 'crack', 'B-License.txt'],
    ]);
    expect(rows[0]!.direct).toEqual(['sfx/hit_normal_1']);
    expect(rows[0]!.derived.length).toBeGreaterThan(0); // hit_normal_2/_3 are pitch-shifted from the premix
    const bare = { 'sfx/hit_normal_1': { ...premix['sfx/hit_normal_1'], parts: undefined } };
    const hashes: Record<string, string> = { 'mix/hit.wav': 'f'.repeat(64) };
    const salt = (s: object): string | undefined =>
      resolveCc0(manifest, { ...validateSources(s, manifest), file: 'x', exists: true }, '/cc0', (f) => hashes[path.relative('/cc0', f).split(path.sep).join('/')] ?? null).salts['sfx/hit_normal_1'];
    expect(salt(premix)).toBe(salt(bare));
    expect(validateSources({ 'sfx/hit_normal_1': { ...premix['sfx/hit_normal_1'], parts: [{ file: '../x.ogg', author: 'a', url: 'https://e.org' }] } }, manifest).problems.length).toBe(1);
  });
});

// ─── ffmpeg ─────────────────────────────────────────────────────────────────

describe.skipIf(!FF.ok)(`stem shaping and layer derivation${FF_REASON}`, () => {
  it('conformLoop stretches a 2 % long loop onto the nominal length and refuses more than 6 %', async () => {
    const f = fixture();
    const N = Math.round(NOMINAL * SR);
    const { unit, ratio } = await conformLoop(musicLoop(NOMINAL * 1.02), N, f.root, 't');
    expect(unit[0]!.length).toBe(N);
    expect(ratio).toBeCloseTo(1.02, 3);
    await expect(conformLoop(musicLoop(NOMINAL * (1 + MAX_STRETCH + 0.04)), N, f.root, 'u')).rejects.toThrow(/bpm"\/"bars/);
  });

  it('derived layers: 4 equal-length stems, periodic over the loop, level-set under base', async () => {
    const f = fixture();
    const N = Math.round(NOMINAL * SR);
    const unit = musicLoop(NOMINAL);
    const total = Math.round(stemDurationSec(theme.bars, theme.bpm) * SR);
    const lead = Math.round(0.5 * SR);
    const base = stemFromUnit(unit, total, lead).chs;
    const layers = await Promise.all((['threat', 'biome', 'night'] as const).map((l) => deriveLayer(unit, l, theme.bpm, theme.bars, total, lead, f.root, l)));
    for (const chs of [base, ...layers]) {
      expect(chs).toHaveLength(2);
      for (const c of chs) expect(c.length).toBe(total);
    }
    // base is the loop itself, starting 0.5 s before its downbeat
    expect(base[0]![lead]).toBe(unit[0]![0]);
    expect(base[0]![lead + N]).toBe(unit[0]![0]);
    // every layer repeats after one loop (filters in steady state) and differs from base
    for (const chs of layers) {
      let num = 0;
      let a2 = 0;
      let b2 = 0;
      for (let i = lead; i + N < total; i++) {
        num += chs[0]![i]! * chs[0]![i + N]!;
        a2 += chs[0]![i]! ** 2;
        b2 += chs[0]![i + N]! ** 2;
      }
      expect(num / Math.sqrt(a2 * b2)).toBeGreaterThan(0.999);
      expect(rms(chs)).toBeGreaterThan(0);
      expect(chs[0]![lead + 100]).not.toBe(base[0]![lead + 100]);
    }
  });

  it('fitSfx fades a long clip out and cuts it at the id duration after its leading silence', () => {
    const pre = new Float32Array(Math.round(0.1 * SR));
    const long = burst(1, 300, 3)[0]!;
    const joined = new Float32Array(pre.length + long.length);
    joined.set(long, pre.length);
    const out = fitSfx([joined], SR, 0.45)[0]!;
    expect(out.length).toBe(pre.length + Math.round(0.45 * SR));
    expect(Math.abs(out[out.length - 1]!)).toBeLessThan(1e-3);
  });
});

describe.skipIf(!FF.ok)(`ingest → cache → process --provider cc0${FF_REASON}`, () => {
  const f = fixture();

  it('writes a 48 kHz WAV per covered job at rawWavPath with a cc0 record, derived layers included, and the credits', async () => {
    writePacks(f);
    f.writeSources(FULL_SOURCES);
    mkdirSync(f.ingest.licences, { recursive: true });
    writeFileSync(path.join(f.ingest.licences, 'CC0-1.0.txt'), 'CC0 1.0 Universal\n');
    const sink = logSink();
    const { report, resolution } = await runIngest({ manifest, paths: f.paths, ingest: f.ingest, log: sink.log });
    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.failed).toEqual([]);
    expect(report.ingested).toEqual(['ambience/grove', 'sfx/hit_normal_1', 'sfx/hit_normal_2', 'sfx/ui_click_1', 'themes/grove/base', 'themes/grove/biome', 'themes/grove/night', 'themes/grove/threat']);
    expect(report.coverage.fraction).toBe(1);
    expect(report.stretched['themes/grove/base']).toBeCloseTo(1.02, 3);
    const index = JSON.parse(readFileSync(path.join(f.paths.cache, 'jobs.json'), 'utf8')) as CacheIndex;
    const jobs = expandJobs(resolution.manifest, CC0_PROVIDER, f.paths.cache, {}, resolution.salts);
    for (const j of jobs) {
      expect(existsSync(rawWavPath(f.paths.cache, j.requestHash)), j.id).toBe(true);
      const rec = index.jobs[j.requestHash]!;
      expect(rec).toMatchObject({ id: j.id, provider: 'cc0', kind: j.kind });
      expect(rec.source!.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    const rec = (id: string) => index.jobs[jobs.find((j) => j.id === id)!.requestHash]!.source!;
    expect(rec('themes/grove/night')).toMatchObject({ role: 'layer', from: 'themes/grove/base', file: 'music/grove_loop.wav' });
    expect(rec('sfx/hit_normal_2')).toMatchObject({ role: 'variant', from: 'sfx/hit_normal_1' });
    // the four stems decode to the same length at 48 kHz; layer levels sit where the recipes put them
    const wav = (id: string) => decodeToPcm(rawWavPath(f.paths.cache, jobs.find((j) => j.id === id)!.requestHash), SR, 2);
    const stems = await Promise.all(['base', 'threat', 'biome', 'night'].map((l) => wav(`themes/grove/${l}`)));
    const total = Math.round(stemDurationSec(theme.bars, theme.bpm) * SR);
    for (const s of stems) expect(s[0]!.length).toBe(total);
    const loopRms = (chs: Float32Array[]) => rms(chs, Math.round(0.5 * SR), Math.round((0.5 + NOMINAL) * SR));
    for (const [i, l] of (['threat', 'biome', 'night'] as const).entries()) {
      expect(20 * Math.log10(loopRms(stems[i + 1]!) / loopRms(stems[0]!))).toBeCloseTo(LAYER_RECIPES[l].relDb, 0);
    }
    // the hit was 0.8 s, its id allows 0.45 s
    const hit = await decodeToPcm(rawWavPath(f.paths.cache, jobs.find((j) => j.id === 'sfx/hit_normal_1')!.requestHash), SR, 1);
    expect(hit[0]!.length).toBe(Math.round(0.45 * SR));
    // credits
    const md = readFileSync(f.ingest.credits, 'utf8');
    expect(md).toContain('| Grove Loop | Test Author | CC0-1.0 | <https://example.org/pack> |');
    expect(md).toContain('licenses/CC0-1.0.txt');
    expect(readFileSync(path.join(f.paths.out, 'CREDITS.txt'), 'utf8')).toContain('Forest Bed - Bed Maker');
    expect(existsSync(path.join(f.paths.qa, 'ingest-report.json'))).toBe(true);
  }, 120_000);

  it('re-ingest is a cache hit', async () => {
    const { report } = await runIngest({ manifest, paths: f.paths, ingest: f.ingest, log: () => undefined, credits: false });
    expect(report.ingested).toEqual([]);
    expect(report.cached).toHaveLength(8);
  }, 60_000);

  it('changing a source file re-ingests exactly the jobs made from it', async () => {
    writeWav(path.join(f.ingest.cc0Dir, 'sfx', 'hit.wav'), burst(0.6, 240, 99));
    const { report } = await runIngest({ manifest, paths: f.paths, ingest: f.ingest, log: () => undefined, credits: false });
    expect(report.ingested).toEqual(['sfx/hit_normal_1', 'sfx/hit_normal_2']);
    expect(report.cached).toHaveLength(6);
  }, 60_000);

  it('process --provider cc0 builds the manifest from the ingested cache: one shared loop, derived layers flagged', async () => {
    const res = prepareCc0(manifest, f.ingest);
    const r = await runProcess({ manifest: res.manifest, salts: res.salts, providerName: CC0_PROVIDER, paths: f.paths, builtAt: '2026-10-06T00:00:00.000Z', jobs: 4, log: () => undefined });
    expect(r.report.placeholders).toEqual([]);
    expect(r.report.rejected).toEqual([]);
    expect(r.manifest).not.toBeNull();
    const t = r.manifest!.themes.grove!;
    expect(t.derived).toEqual(['threat', 'biome', 'night']);
    const loops = Object.values(t.stems).map((s) => [s.loopStartSec, s.loopEndSec].join(','));
    expect(new Set(loops).size).toBe(1);
    expect(Math.abs(t.stems.base.loopEndSec - t.stems.base.loopStartSec - NOMINAL)).toBeLessThanOrEqual(0.005);
    expect(r.report.themes.grove!.scores.base).toBeGreaterThan(0.95);
    // at −16 LUFS, or clamped to the −1 dBTP ceiling and flagged (a fixed source cannot be re-rolled)
    const clamped = r.report.flagged.some((x) => x.id === 'themes/grove/base' && x.reason.includes('clamped'));
    expect(Math.abs(t.stems.base.lufs + 16) <= 1 || clamped).toBe(true);
    // linked gain: derived layers stay below base after normalisation
    expect(t.stems.threat.lufs).toBeLessThan(t.stems.base.lufs - 3);
    expect(r.manifest!.sfx.hit_normal!.clips).toHaveLength(2);
    expect(r.manifest!.ambience.grove).toBeDefined();
  }, 240_000);
});

describe.skipIf(!FF.ok)(`missing source files${FF_REASON}`, () => {
  it('are reported with their derived siblings blocked; the rest is ingested and nothing throws', async () => {
    const f = fixture();
    writePacks(f);
    rmSync(path.join(f.ingest.cc0Dir, 'sfx', 'hit.wav'));
    f.writeSources({ ...FULL_SOURCES, 'sfx/ui_click_1': { ...FULL_SOURCES['sfx/ui_click_1'], file: 'sfx/not-downloaded-yet.ogg' } });
    const sink = logSink();
    const { report } = await runIngest({ manifest, paths: f.paths, ingest: f.ingest, log: sink.log, credits: false });
    expect(report.ok).toBe(false);
    expect(report.missing).toEqual([
      { id: 'sfx/hit_normal_1', file: 'sfx/hit.wav' },
      { id: 'sfx/ui_click_1', file: 'sfx/not-downloaded-yet.ogg' },
    ]);
    expect(report.blocked).toEqual(['sfx/hit_normal_2']);
    expect(report.ingested).toEqual(['ambience/grove', 'themes/grove/base', 'themes/grove/biome', 'themes/grove/night', 'themes/grove/threat']);
    expect(sink.lines.some((l) => l.includes('MISSING sfx/ui_click_1') && l.includes('not-downloaded-yet.ogg'))).toBe(true);
  }, 120_000);

  it('an absent sources.json is an empty mapping with a clear line', async () => {
    const f = fixture();
    const sink = logSink();
    const { report } = await runIngest({ manifest, paths: f.paths, ingest: f.ingest, log: sink.log });
    expect(report.sourcesExist).toBe(false);
    expect(report.coverage.covered).toBe(0);
    expect(sink.lines[0]).toContain('does not exist');
    expect(readFileSync(f.ingest.credits, 'utf8')).toContain('No third-party audio is mapped yet');
  });
});
