import { describe, expect, it } from 'vitest';
import type { ManifestAtlasV2, SpriteManifestV2, SpriteRectV2 } from '../src/manifest.js';
import { manifestErrors, pxToUv, serializeManifest, validateManifest } from '../src/manifest.js';
import { MANIFEST_FOOT_V } from '../src/types.js';
import { ZONE_ORDER } from '../src/zones.js';

function rect(atlas: string, x: number, y: number): SpriteRectV2 {
  const px = [x, y, 1024, 1024] as const;
  return { atlas, px, uv: pxToUv(px, 2048), footV: MANIFEST_FOOT_V, aspect: 1, pixelScale: 1, source: 'front/x.png' };
}

function atlas(id: string, species: string[]): ManifestAtlasV2 {
  const map = (kind: string, codec: 'webp-lossy' | 'webp-lossless', quality: number | null) => ({
    url: `atlases/${id}.${kind}.webp`,
    mips: [1, 2, 3].map((l) => `atlases/${id}.${kind}.m${l}.webp`),
    codec,
    quality,
    bytes: 1000,
  });
  return { id, species, size: 2048, slots: species.length * 2, albedo: map('albedo', 'webp-lossy', 85), normal: map('normal', 'webp-lossy', 90), emissive: map('emissive', 'webp-lossless', null), normalScale: 0.5 };
}

function sample(): SpriteManifestV2 {
  const zones: Record<string, string[]> = {};
  for (const z of ZONE_ORDER) zones[z] = [];
  zones.mirevale = ['a-000'];
  return {
    version: 2,
    encoding: 'webp',
    spriteSize: 1024,
    pipelineVersion: '2',
    atlases: [atlas('a-000', ['aaa', 'bbb'])],
    zones,
    sprites: {
      aaa: { front: rect('a-000', 1024, 0), back: rect('a-000', 0, 0), sizeScale: 1, home: 'a-000', thumb: 'thumbs/aaa_front.webp' },
      bbb: { front: rect('a-000', 1024, 1024), back: rect('a-000', 0, 1024), sizeScale: 0.8, home: 'a-000', thumb: 'thumbs/bbb_front.webp' },
    },
    totalBytes: 3000,
  };
}

describe('manifest v2', () => {
  it('pxToUv flips v: the top-left cell maps to u 0..0.5, v 0.5..1', () => {
    expect(pxToUv([0, 0, 1024, 1024], 2048)).toEqual([0, 0.5, 0.5, 1]);
    expect(pxToUv([1024, 1024, 1024, 1024], 2048)).toEqual([0.5, 0, 1, 0.5]);
  });

  it('accepts a well-formed manifest and the exact species set', () => {
    const m = sample();
    expect(manifestErrors(m, { species: ['aaa', 'bbb'] })).toEqual([]);
    expect(validateManifest(m)).toBe(true);
  });

  it('rejects the species set mismatch, a bad footV, inconsistent uv, > 8 binds and an unresolved home', () => {
    expect(manifestErrors(sample(), { species: ['aaa'] }).join('\n')).toMatch(/sprites keys != species set/);
    const badFoot = sample();
    (badFoot.sprites.aaa!.front as { footV: number }).footV = 0.92;
    expect(manifestErrors(badFoot).join('\n')).toMatch(/footV/);
    const badUv = sample();
    (badUv.sprites.aaa!.front as { uv: number[] }).uv = [0, 0, 0.5, 0.5];
    expect(manifestErrors(badUv).join('\n')).toMatch(/uv inconsistent/);
    const tooMany = sample();
    (tooMany.zones as Record<string, string[]>).mirevale = Array(9).fill('a-000');
    expect(manifestErrors(tooMany).join('\n')).toMatch(/> 8/);
    const badHome = sample();
    (badHome.sprites.bbb as { home: string }).home = 'a-999';
    expect(manifestErrors(badHome).join('\n')).toMatch(/home a-999 unresolved/);
    const missingZone = sample();
    delete (missingZone.zones as Record<string, string[]>).the_rift;
    expect(manifestErrors(missingZone).join('\n')).toMatch(/the_rift missing/);
  });

  it('serialises with sorted keys, sorted atlases/zones and a trailing LF', () => {
    const m = sample();
    const shuffled: SpriteManifestV2 = { ...m, sprites: { bbb: m.sprites.bbb!, aaa: m.sprites.aaa! } };
    const text = serializeManifest(shuffled);
    expect(text.endsWith('\n')).toBe(true);
    expect(text).toBe(serializeManifest(m));
    const parsed = JSON.parse(text) as SpriteManifestV2;
    expect(Object.keys(parsed.sprites)).toEqual(['aaa', 'bbb']);
    expect(Object.keys(parsed.zones)).toEqual([...ZONE_ORDER].sort());
    expect(Object.keys(parsed)).toEqual(['version', 'encoding', 'spriteSize', 'pipelineVersion', 'atlases', 'zones', 'sprites', 'totalBytes']);
    expect('alt' in parsed.sprites.aaa!).toBe(false);
  });
});
