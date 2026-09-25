/**
 * SPEC §50.4.8 `tools/audio-pipeline/test/plan.test.ts`:
 *   - `plan` produces one job per entry of `.design/audio/manifest.json` (17 themes × 4 stems + 11 ambiences +
 *     every sfx variant) and validates `zoneThemes` against `ZONE_ORDER`
 *   - loop-point detection on a synthetic 4-bar 120 bpm fixture returns L within ±5 ms of 8.000 s
 *   - normalisation to −16 LUFS ±1                                     (needs ffmpeg — skipped with a reason otherwise)
 *   - the generator step is skipped with the exact §40.4.2 message when EWA_AUDIO_API_KEY is unset
 *   - `process` output deterministic after deleting `builtAt`          (needs ffmpeg — skipped with a reason otherwise)
 *   - total ≤ 80 MB
 * No test here touches the network or reads a real key: the provider gets an injected empty env.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ZONE_ORDER } from '@ewa/content';
import { afterAll, describe, expect, it } from 'vitest';
import { AUDIO_BUDGET_BYTES, estimateBytes, measureBytes } from '../src/budget.js';
import { FFMPEG_MISSING_MESSAGE, checkFfmpeg, measureLoudness } from '../src/ffmpeg.js';
import { runGenerate, skipMessage } from '../src/generate.js';
import { expandJobs, expectedJobCount } from '../src/jobs.js';
import { findLoop } from '../src/loop.js';
import { withoutBuiltAt } from '../src/output-manifest.js';
import { DEFAULT_PATHS } from '../src/paths.js';
import { buildPlan, loadSourceManifest, runPlan } from '../src/plan.js';
import { FfmpegMissingError, listFiles, normaliseClip, runProcess } from '../src/process.js';
import { createProvider } from '../src/providers/index.js';
import { ManifestError, THEME_IDS, validateSourceManifest } from '../src/schema.js';
import { mulberry32 } from '../src/placeholder.js';
import { SR, TINY_VALIDATE, clickTrack, logSink, tempPaths, tinyManifest } from './helpers.js';

const FF = checkFfmpeg();
const FF_REASON = FF.ok ? '' : `ffmpeg unavailable (${FF.reason ?? 'unknown'}) — install ffmpeg ≥ 6.0 with libopus to run this test`;
if (!FF.ok) console.warn(`[audio-pipeline] skipping ffmpeg-dependent tests: ${FF_REASON}`);

const rawJson = (): Record<string, unknown> => JSON.parse(readFileSync(DEFAULT_PATHS.manifest, 'utf8')) as Record<string, unknown>;
const manifest = loadSourceManifest(DEFAULT_PATHS.manifest);
const cleanups: (() => void)[] = [];
afterAll(() => cleanups.forEach((c) => c()));

describe('plan — one job per manifest entry', () => {
  it('expands 17 themes × 4 stems + 11 ambience beds + every sfx variant', () => {
    const t = tempPaths();
    cleanups.push(t.cleanup);
    const sink = logSink();
    const report = runPlan({ paths: t, providerName: 'stable-audio', log: sink.log });
    const variants = manifest.sfx.reduce((n, s) => n + s.variants, 0);
    expect(manifest.themes).toHaveLength(17);
    expect(report.counts.stems).toBe(68);
    expect(manifest.ambience).toHaveLength(11);
    expect(report.total).toBe(68 + 11 + variants);
    expect(report.total).toBe(expectedJobCount(manifest));
    expect(report.jobs).toHaveLength(report.total);
    expect(new Set(report.jobs.map((j) => j.id)).size).toBe(report.total);
    expect(new Set(report.jobs.map((j) => j.requestHash)).size).toBe(report.total);
    expect(report.byKind.stem.jobs).toBe(68);
    expect(report.byKind.ambience.jobs).toBe(11);
    expect(report.byKind.sfx.jobs + report.byKind.ui.jobs).toBe(variants);
    // ≈ 250 variants per §40.4.2; the bible's count is stated in its §6.1
    expect(variants).toBeGreaterThanOrEqual(200);
    expect(variants).toBeLessThanOrEqual(320);
    // key-less: nothing cached in a fresh cache, a price from the rate card, the file written
    expect(report.cached).toBe(0);
    expect(report.toGenerate).toBe(report.total);
    expect(report.estimatedCost).toBeCloseTo(report.total * 0.2, 6);
    expect(JSON.parse(readFileSync(path.join(t.qa, 'plan.json'), 'utf8'))).toMatchObject({ total: report.total, cached: 0, toGenerate: report.total });
    expect(sink.lines[0]).toContain(`${report.total} jobs`);
  });

  it('job ids follow the §40.4.6 output layout and sfx variants re-roll the seed (seed + i)', () => {
    const jobs = expandJobs(manifest, 'stable-audio', '/c');
    const hit = manifest.sfx.find((s) => s.id === 'hit_normal')!;
    const v = jobs.filter((j) => j.meta.group === 'hit_normal');
    expect(v.map((j) => j.id)).toEqual(Array.from({ length: hit.variants }, (_, i) => `sfx/hit_normal_${i + 1}`));
    expect(v.map((j) => j.prompt.seed)).toEqual(Array.from({ length: hit.variants }, (_, i) => (hit.prompt.seed + i) >>> 0));
    for (const t of THEME_IDS) for (const layer of ['base', 'threat', 'biome', 'night']) expect(jobs.some((j) => j.id === `themes/${t}/${layer}`)).toBe(true);
    expect(jobs.filter((j) => j.kind === 'ambience').map((j) => j.id)).toEqual(manifest.ambience.map((a) => `ambience/${a.biome}`).sort());
  });

  it('requestHash is stable for an unchanged prompt and changes with provider, seed or wording', () => {
    const a = buildPlan(manifest, 'stable-audio', { cache: '/c' }).report.jobs;
    const b = buildPlan(manifest, 'stable-audio', { cache: '/c' }).report.jobs;
    expect(a.map((j) => j.requestHash)).toEqual(b.map((j) => j.requestHash));
    const other = buildPlan(manifest, 'elevenlabs', { cache: '/c' }).report.jobs;
    expect(other[0]!.requestHash).not.toBe(a[0]!.requestHash);
    const rerolled = expandJobs(manifest, 'stable-audio', '/c', { 'themes/grove/base': 1 }).find((j) => j.id === 'themes/grove/base')!;
    const orig = expandJobs(manifest, 'stable-audio', '/c').find((j) => j.id === 'themes/grove/base')!;
    expect(rerolled.prompt.seed).toBe((orig.prompt.seed + 1000) >>> 0);
    expect(rerolled.requestHash).not.toBe(orig.requestHash);
  });
});

describe('plan — zoneThemes validated against @ewa/content ZONE_ORDER', () => {
  it('maps exactly the 21 zones, each to its biome theme', () => {
    expect(Object.keys(manifest.zoneThemes).sort()).toEqual([...ZONE_ORDER].sort());
    expect(ZONE_ORDER).toHaveLength(21);
    for (const t of Object.values(manifest.zoneThemes)) expect(THEME_IDS).toContain(t);
    // 21 zones share 11 biome themes; the 6 cue themes are never a zone theme
    expect(new Set(Object.values(manifest.zoneThemes)).size).toBe(11);
  });

  it('a missing zone key fails plan with the zone id in the message', () => {
    const j = rawJson();
    const zt = { ...(j.zoneThemes as Record<string, string>) };
    delete zt.hollow_route;
    expect(() => validateSourceManifest({ ...j, zoneThemes: zt })).toThrow(ManifestError);
    expect(() => validateSourceManifest({ ...j, zoneThemes: zt })).toThrow(/hollow_route/);
  });

  it('an unknown theme id fails plan', () => {
    const j = rawJson();
    const zt = { ...(j.zoneThemes as Record<string, string>), mirevale: 'meadow' };
    expect(() => validateSourceManifest({ ...j, zoneThemes: zt })).toThrow(/unknown theme id 'meadow'/);
  });

  it('a zone that is not a ZoneId fails plan', () => {
    const j = rawJson();
    expect(() => validateSourceManifest({ ...j, zoneThemes: { ...(j.zoneThemes as object), atlantis: 'grove' } })).toThrow(/atlantis/);
  });

  it('a boot-validated sfx id missing from the manifest fails plan', () => {
    const j = rawJson();
    const sfx = (j.sfx as { id: string }[]).filter((s) => s.id !== 'orb_break');
    expect(() => validateSourceManifest({ ...j, sfx })).toThrow(/orb_break/);
  });
});

describe('loop detection (§40.4.4)', () => {
  it('finds L within ±5 ms of 8.000 s on a synthetic 4-bar 120 bpm click track', () => {
    const r = findLoop(clickTrack(120, 4), SR, { bpm: 120, bars: 4 });
    expect(r.ok).toBe(true);
    expect(Math.abs(r.lengthSec - 8)).toBeLessThanOrEqual(0.005);
    expect(r.startSec).toBeGreaterThanOrEqual(0.25 - 0.002);
    expect(r.startSec).toBeLessThanOrEqual(1.0 + 0.002);
    expect(r.score).toBeGreaterThanOrEqual(0.6);
  });

  it('still finds 8.000 s when the first click is off the hop grid', () => {
    const r = findLoop(clickTrack(120, 4, 0.4137), SR, { bpm: 120, bars: 4 });
    expect(Math.abs(r.lengthSec - 8)).toBeLessThanOrEqual(0.005);
  });
});

describe.skipIf(!FF.ok)(`normalisation to −16 LUFS ±1 (§40.4.3)${FF.ok ? '' : ` — SKIPPED: ${FF_REASON}`}`, () => {
  it('a quiet stereo fixture is gained to −16 LUFS integrated with a static gain', async () => {
    const t = tempPaths();
    cleanups.push(t.cleanup);
    const n = 10 * SR;
    const rnd = mulberry32(42);
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const tone = 0.02 * Math.sin((2 * Math.PI * 220 * i) / SR) + 0.01 * Math.sin((2 * Math.PI * 330 * i) / SR);
      l[i] = tone + (rnd() * 2 - 1) * 0.004;
      r[i] = tone + (rnd() * 2 - 1) * 0.004;
    }
    const outWav = path.join(t.root, 'norm.wav');
    const res = await normaliseClip({ sampleRate: SR, channels: [l, r] }, 'stem', path.join(t.root, 'pre.wav'), outWav, true);
    expect(res.gainDb).toBeGreaterThan(10);
    expect(Math.abs(res.lufs + 16)).toBeLessThanOrEqual(1);
    const again = await measureLoudness(outWav);
    expect(Math.abs(again.integrated + 16)).toBeLessThanOrEqual(1);
    expect(again.truePeak).toBeLessThanOrEqual(-1);
  });
});

describe('generate without a key', () => {
  it('prints the exact §40.4.2 line and exits 0', async () => {
    const t = tempPaths();
    cleanups.push(t.cleanup);
    const sink = logSink();
    const provider = createProvider('stable-audio', { env: {}, fetch: () => Promise.reject(new Error('network must not be touched')) });
    expect(provider.configured()).toBe(false);
    const r = await runGenerate({ paths: t, provider, log: sink.log });
    const total = expectedJobCount(manifest);
    expect(r.exitCode).toBe(0);
    expect(r.skipped).toBe(true);
    expect(sink.lines).toEqual([`audio-pipeline: EWA_AUDIO_API_KEY not set — skipping generation (${total} jobs pending); run plan to see them`]);
    expect(sink.lines[0]).toBe(skipMessage(total));
  });

  it('process refuses with the exact §40.4.5 line when ffmpeg is missing', () => {
    expect(FFMPEG_MISSING_MESSAGE).toBe('audio-pipeline: ffmpeg not found on PATH (need ≥ 6.0 with libopus and aac); install it and re-run');
    expect(new FfmpegMissingError('ffmpeg/ffprobe not found on PATH').message).toBe(FFMPEG_MISSING_MESSAGE);
  });

  it('treats a blank key as unset', () => {
    expect(createProvider('stable-audio', { env: { EWA_AUDIO_API_KEY: '   ' } }).configured()).toBe(false);
  });
});

describe.skipIf(!FF.ok)(`process determinism (§40.4.7)${FF.ok ? '' : ` — SKIPPED: ${FF_REASON}`}`, () => {
  it('two runs over the same inputs are byte-identical and the manifests match after deleting builtAt', async () => {
    const src = validateSourceManifest(tinyManifest(), TINY_VALIDATE);
    const a = tempPaths();
    const b = tempPaths();
    cleanups.push(a.cleanup, b.cleanup);
    const quiet = (): void => undefined;
    const ra = await runProcess({ manifest: src, providerName: 'stable-audio', paths: a, placeholders: true, builtAt: '2026-01-01T00:00:00.000Z', jobs: 4, log: quiet });
    const rb = await runProcess({ manifest: src, providerName: 'stable-audio', paths: b, placeholders: true, builtAt: '2026-09-25T12:00:00.000Z', jobs: 2, log: quiet });
    expect(ra.report.rejected).toEqual([]);
    expect(rb.report.rejected).toEqual([]);
    expect(ra.manifest).not.toBeNull();
    expect(rb.report.bytes).toEqual(ra.report.bytes);
    const fa = listFiles(a.out);
    expect(fa).toEqual(listFiles(b.out));
    // 4 stems + 1 bed + 3 sfx clips, two files each, + manifest.json
    expect(fa.filter((f) => f.endsWith('.webm'))).toHaveLength(8);
    expect(fa.filter((f) => f.endsWith('.m4a'))).toHaveLength(8);
    for (const f of fa.filter((x) => x !== 'manifest.json')) expect(readFileSync(path.join(b.out, f)).equals(readFileSync(path.join(a.out, f)))).toBe(true);
    const ma = JSON.parse(readFileSync(path.join(a.out, 'manifest.json'), 'utf8'));
    const mb = JSON.parse(readFileSync(path.join(b.out, 'manifest.json'), 'utf8'));
    expect(ma.builtAt).not.toBe(mb.builtAt);
    expect(withoutBuiltAt(ma)).toEqual(withoutBuiltAt(mb));
    // the §20.7.4 shape: loop points inside the clip, lufs at target, all four layers share one loop
    const stems = ma.themes.grove.stems;
    const starts = new Set(Object.values(stems).map((s) => (s as { loopStartSec: number }).loopStartSec));
    const ends = new Set(Object.values(stems).map((s) => (s as { loopEndSec: number }).loopEndSec));
    expect(starts.size).toBe(1);
    expect(ends.size).toBe(1);
    const base = stems.base as { loopStartSec: number; loopEndSec: number; lufs: number; durationSec: number; url: string };
    expect(Math.abs(base.loopEndSec - base.loopStartSec - (8 * 240) / 200)).toBeLessThanOrEqual(0.005);
    expect(Math.abs(base.lufs + 16)).toBeLessThanOrEqual(1);
    expect(base.url).toMatch(/^\/audio\/themes\/grove\/base\.webm\?v=[0-9a-f]{8}$/);
    expect(base.url.slice(-8)).toBe((base as unknown as { hash: string }).hash.slice(0, 8));
    expect(ma.sfx.hit_normal.clips).toHaveLength(2);
    expect(ma.zoneThemes).toEqual({ mirevale: 'grove' });
    expect(measureBytes(a.out).total).toBe(ra.report.bytes.total);
  }, 240_000);
});

describe('budget (≤ 80 MB, §40.4.7)', () => {
  it('the manifest\'s encoded-size estimate fits 83 886 080 bytes', () => {
    const e = estimateBytes(manifest);
    expect(e.total).toBeLessThanOrEqual(AUDIO_BUDGET_BYTES);
    expect(e.webm + e.m4a).toBe(e.total);
  });
});
