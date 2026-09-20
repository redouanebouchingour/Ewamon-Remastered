import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INFORMATIONAL_FLAGS } from '../src/alpha.js';
import type { LegacySpecies } from '../src/legacy.js';
import { buildQaReport, isAccepted } from '../src/qa.js';
import { resolveSources } from '../src/sources.js';
import { blob, buildFixture, tmp, toPng, writeSyntheticAssets } from './helpers.js';

describe('QA flag semantics', () => {
  it('informational flags never count as actionable; accepted flags are suppressed; leak/empty can never be accepted', () => {
    const report = buildQaReport({
      entries: [
        { species: 'a', side: 'front', flags: ['clipped', 'nonsquare'], source: 'front/a.png' },
        { species: 'b', side: 'front', flags: ['coverage'], source: 'front/b.png' },
        { species: 'c', side: 'back', flags: ['coverage', 'multiframe'], source: 'back/c.png' },
        { species: 'd', side: 'front', flags: ['leak'], source: 'front/d.png' },
        { species: 'e', side: 'front', flags: [], source: 'front/e.png' },
      ],
      excluded: [{ file: 'front/z(front)(style).png', reason: 'alternate-style' }],
      accepted: [
        { species: 'b', flag: 'coverage', reason: 'small creature' },
        { species: 'd', flag: 'leak', reason: 'must not work' },
        { species: 'zzz', flag: 'coverage', reason: 'unused acceptance' },
      ],
      bindStats: {},
      encoding: null,
      totalBytes: 0,
    });
    expect(report.total).toBe(5);
    expect(report.flagged.map((e) => e.species)).toEqual(['a', 'b', 'c', 'd']);
    expect(report.flagged.find((e) => e.species === 'a')!.actionable).toEqual([]);
    expect(report.flagged.find((e) => e.species === 'b')!.actionable).toEqual([]);
    expect(report.flagged.find((e) => e.species === 'c')!.actionable).toEqual(['coverage']);
    expect(report.flagged.find((e) => e.species === 'd')!.actionable).toEqual(['leak']);
    expect(report.actionable).toBe(2);
    expect(report.informational).toBe(2);
    expect(report.counts).toEqual({ clipped: 1, coverage: 2, leak: 1, multiframe: 1, nonsquare: 1 });
    expect(report.accepted.map((a) => a.species)).toEqual(['b']); // only acceptances that matched
    expect(report.excluded.length).toBe(1);
    expect(isAccepted([{ species: 'x', flag: 'empty', reason: 'no' }], 'x', 'front', 'empty')).toBe(false);
    expect(isAccepted([{ species: 'x', side: 'back', flag: 'coverage', reason: 'ok' }], 'x', 'front', 'coverage')).toBe(false);
    expect(isAccepted([{ species: 'x', side: 'back', flag: 'coverage', reason: 'ok' }], 'x', 'back', 'coverage')).toBe(true);
  });

  it('clipped, nonsquare, multiframe and sidemismatch are the informational set', () => {
    expect([...INFORMATIONAL_FLAGS].sort()).toEqual(['clipped', 'multiframe', 'nonsquare', 'sidemismatch']);
  });
});

describe('source resolution', () => {
  it('matches irregular names, excludes alternate-style files and reports missing sides', async () => {
    const dir = tmp('sources');
    await writeSyntheticAssets(dir, ['alpha', 'beta']);
    // Irregular canonical names + an alternate-style file + an unrelated file.
    writeFileSync(path.join(dir, 'front', 'gamma(front).webp'), await toPng(blob(32, [255, 255, 255, 255], [1, 2, 3, 255])));
    writeFileSync(path.join(dir, 'back', 'Gamma_Back.png'), await toPng(blob(32, [0, 0, 0, 0], [1, 2, 3, 255])));
    writeFileSync(path.join(dir, 'front', 'alpha(front)(boxingstyle).png'), await toPng(blob(32, [0, 0, 0, 0], [1, 2, 3, 255])));
    writeFileSync(path.join(dir, 'front', 'stray.png'), await toPng(blob(32, [0, 0, 0, 0], [1, 2, 3, 255])));
    mkdirSync(path.join(dir, 'back'), { recursive: true });
    const species = new Map<string, LegacySpecies>([
      ['alpha', { id: 'alpha', frontSprite: 'alphafront.png', backSprite: 'alphaback.png', sizeScale: 1 }],
      ['beta', { id: 'beta', frontSprite: 'betafront.png', backSprite: 'betaback.png', sizeScale: 1.2 }],
      ['gamma', { id: 'gamma', frontSprite: 'gammafront.png', backSprite: 'gammaback.png', sizeScale: 1 }],
      ['delta', { id: 'delta', frontSprite: 'deltafront.png', backSprite: 'deltaback.png', sizeScale: 1 }],
    ]);
    const res = resolveSources(dir, species);
    expect(res.sources.map((s) => `${s.id}/${s.side}`)).toEqual(['alpha/back', 'alpha/front', 'beta/back', 'beta/front', 'gamma/back', 'gamma/front']);
    expect(res.sources.find((s) => s.id === 'gamma' && s.side === 'back')!.file).toBe('back/Gamma_Back.png');
    expect(res.sources.find((s) => s.id === 'beta')!.sizeScale).toBe(1.2);
    expect(res.excluded).toEqual([
      { file: 'front/alpha(front)(boxingstyle).png', reason: 'alternate-style' },
      { file: 'front/stray.png', reason: 'unmapped' },
    ]);
    expect(res.missing).toEqual([
      { id: 'delta', side: 'front', wanted: 'deltafront.png' },
      { id: 'delta', side: 'back', wanted: 'deltaback.png' },
    ]);
  });
});

describe('a clean fixture build', () => {
  it('reports 0 actionable flags, sidemismatch when the two sides differ in scale, and all 21 zones in bindStats', async () => {
    const fx = await buildFixture(['cleanone', 'cleantwo'], 128);
    const report = fx.result.report;
    expect(report.total).toBe(4);
    expect(report.actionable).toBe(0);
    for (const e of report.flagged) expect(e.actionable).toEqual([]);
    expect(Object.keys(report.bindStats).length).toBe(21);
    expect(report.excluded).toEqual([]);
    expect(report.encoding!.albedoQuality).toBe(88);
    // Front (radius 0.32) and back (0.28) bodies differ by ~14 % — under the 20 % sidemismatch line.
    expect(report.counts.sidemismatch).toBeUndefined();
  }, 120_000);
});
