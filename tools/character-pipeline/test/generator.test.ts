/**
 * The paper-doll generator: coverage of the content look vocabulary, frame table shape, pixel rules (binary
 * alpha, cell margins, the foot line, the selective outline), determinism, hue-shifted ramps, palette variants.
 */
import { describe, expect, it } from 'vitest';
import { BODIES, LOOKS } from '@ewa/content';
import { lightness, makeRamp, rgbToOklch } from '../src/color.js';
import { FOOT_ROW } from '../src/compose.js';
import { CELL_H, CELL_W } from '../src/grid.js';
import { LOOK_SPECS, allLooks, variantId } from '../src/looks.js';
import { FACINGS, frameOrder, posesFor } from '../src/poses.js';
import { renderLook, type Frame } from '../src/sheet.js';

const looks = allLooks();
const rendered = new Map(looks.map((l) => [l.id, renderLook(l)]));
const idleD = (id: string): Frame => rendered.get(id)!.find((f) => f.facing === 'D' && f.state === 'idle' && f.index === 0)!;
const opaque = (f: Frame, x: number, y: number): boolean => f.rgba[(y * CELL_W + x) * 4 + 3] === 255;

describe('look coverage', () => {
  it('every @ewa/content LOOK is an outfit, and nothing else', () => {
    expect(LOOK_SPECS.map((s) => s.id).sort()).toEqual([...LOOKS].sort());
  });

  it('every BODIES palette is a baked recolour `<look>:<palette>`', () => {
    const ids = new Set(looks.map((l) => l.id));
    for (const b of BODIES) {
      expect(ids.has(b.look)).toBe(true);
      if (b.palette !== null) expect(ids.has(variantId(b.look, b.palette))).toBe(true);
    }
  });

  it('variants recolour clothing only: skin, hair and the fixed face inks are the base look\'s', () => {
    for (const s of LOOK_SPECS) {
      for (const v of Object.keys(s.variants ?? {})) {
        const l = looks.find((x) => x.id === variantId(s.id, v))!;
        for (const slot of ['skin', 'hair', 'eye', 'eyeHi', 'iris', 'mouth', 'blush']) expect(l.palette[slot]).toEqual(s.palette[slot]);
        expect(Buffer.compare(Buffer.from(idleD(l.id).rgba), Buffer.from(idleD(s.id).rgba))).not.toBe(0);
      }
    }
  });
});

describe('frame table', () => {
  it('44 frames per look: D idle 2 walk 4 run 4 wave 2 cheer 2; U, L, R idle 2 walk 4 run 4', () => {
    expect(frameOrder()).toHaveLength(44);
    for (const f of FACINGS) {
      expect(posesFor(f, 'idle')).toHaveLength(2);
      expect(posesFor(f, 'walk')).toHaveLength(4);
      expect(posesFor(f, 'run')).toHaveLength(4);
      expect(posesFor(f, 'wave')).toHaveLength(f === 'D' ? 2 : 0);
      expect(posesFor(f, 'cheer')).toHaveLength(f === 'D' ? 2 : 0);
    }
    for (const fs of rendered.values()) expect(fs).toHaveLength(44);
  });
});

describe('pixel rules', () => {
  it('binary alpha, nothing on the side columns or bottom row of a cell, never an empty frame', () => {
    const bad: string[] = [];
    for (const [id, fs] of rendered) {
      for (const f of fs) {
        const where = `${id} ${f.facing} ${f.state} ${f.index}`;
        let n = 0; let soft = 0;
        for (let i = 3; i < f.rgba.length; i += 4) { if (f.rgba[i] === 255) n++; else if (f.rgba[i] !== 0) soft++; }
        if (soft > 0) bad.push(`${where}: ${soft} soft alpha texels`);
        if (n <= 300) bad.push(`${where}: only ${n} opaque texels`);
        for (let y = 0; y < CELL_H; y++) if (opaque(f, 0, y) || opaque(f, CELL_W - 1, y)) { bad.push(`${where}: side column at row ${y}`); break; }
        for (let x = 0; x < CELL_W; x++) if (opaque(f, x, CELL_H - 1)) { bad.push(`${where}: bottom row at column ${x}`); break; }
      }
    }
    expect(bad).toEqual([]);
  });

  it('standing frames touch the foot line: the lowest opaque row is FOOT_ROW − 1', () => {
    for (const [id, fs] of rendered) {
      for (const f of fs.filter((x) => x.state === 'idle' || x.state === 'wave')) {
        let low = -1;
        for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) if (opaque(f, x, y)) low = y;
        expect(low, `${id} ${f.facing} ${f.state}`).toBe(FOOT_ROW - 1);
      }
    }
  });

  it('the silhouette is outlined: every edge texel is darker than the texel it borders (selective outline, never black)', () => {
    for (const id of ['casual_male', 'knight_male', 'doctor_female_young']) {
      const f = idleD(id);
      let edges = 0; let black = 0;
      for (let y = 1; y < CELL_H - 1; y++) {
        for (let x = 1; x < CELL_W - 1; x++) {
          if (!opaque(f, x, y)) continue;
          const i = (y * CELL_W + x) * 4;
          const edge = !opaque(f, x - 1, y) || !opaque(f, x + 1, y) || !opaque(f, x, y - 1) || !opaque(f, x, y + 1);
          if (!edge) continue;
          edges++;
          if (f.rgba[i]! + f.rgba[i + 1]! + f.rgba[i + 2]! < 12) black++;
          expect(lightness([f.rgba[i]!, f.rgba[i + 1]!, f.rgba[i + 2]!])).toBeLessThan(0.56);
        }
      }
      expect(edges).toBeGreaterThan(100);
      expect(black).toBe(0);
    }
  });

  it('every base look has its own face-on silhouette or colouring (≥ 120 texels differ from every other)', () => {
    const base = LOOK_SPECS.map((s) => s.id);
    for (let a = 0; a < base.length; a++) {
      for (let b = a + 1; b < base.length; b++) {
        const fa = idleD(base[a]!); const fb = idleD(base[b]!);
        let d = 0;
        for (let i = 0; i < fa.rgba.length; i += 4) if (Math.abs(fa.rgba[i]! - fb.rgba[i]!) + Math.abs(fa.rgba[i + 1]! - fb.rgba[i + 1]!) + Math.abs(fa.rgba[i + 2]! - fb.rgba[i + 2]!) + Math.abs(fa.rgba[i + 3]! - fb.rgba[i + 3]!) > 24) d++;
        expect(d, `${base[a]} vs ${base[b]}`).toBeGreaterThanOrEqual(120);
      }
    }
  });

  it('is deterministic to the byte', () => {
    for (const l of looks.slice(0, 4)) {
      const again = renderLook(l);
      again.forEach((f, i) => expect(Buffer.compare(Buffer.from(f.rgba), Buffer.from(rendered.get(l.id)![i]!.rgba))).toBe(0));
    }
  });
});

describe('ramps', () => {
  it('four tones from light to dark, then the line; highlights warm, shadows cool (skin shadows rose)', () => {
    for (const [hex, kind] of [['#3c79b8', 'cloth'], ['#6e4428', 'hair'], ['#5f6f3b', 'cloth'], ['#a9b1bd', 'metal']] as const) {
      const r = makeRamp(hex, kind);
      const L = r.tones.map(lightness);
      expect(L[0]).toBeGreaterThan(L[1]!); expect(L[1]).toBeGreaterThan(L[2]!); expect(L[2]).toBeGreaterThan(L[3]!);
      expect(lightness(r.line)).toBeLessThan(L[3]!);
      const warmDist = (h: number): number => Math.abs(((h - 88 + 540) % 360) - 180);
      const coolDist = (h: number): number => Math.abs(((h - 282 + 540) % 360) - 180);
      if (rgbToOklch(r.tones[1]).c > 0.03) {
        expect(warmDist(rgbToOklch(r.tones[0]).h)).toBeLessThanOrEqual(warmDist(rgbToOklch(r.tones[1]).h) + 0.5);
        expect(coolDist(rgbToOklch(r.tones[3]).h)).toBeLessThanOrEqual(coolDist(rgbToOklch(r.tones[1]).h) + 0.5);
      }
    }
    const skin = makeRamp('#f0c39c', 'skin');
    const roseDist = (h: number): number => Math.abs(((h - 18 + 540) % 360) - 180);
    expect(roseDist(rgbToOklch(skin.tones[2]).h)).toBeLessThan(roseDist(rgbToOklch(skin.tones[1]).h));
  });
});
