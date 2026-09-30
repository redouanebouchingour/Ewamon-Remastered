/**
 * Pixel templates and the paper-doll compositor.
 *
 * A template is rows of characters placed at cell row `y` (and column `x`, default 0 — most templates are written
 * as full 32-column rows so that alignment is visible in the source). Every character is one texel:
 *
 *   `.` or space      nothing (the layer below shows)
 *   `X`               erase (a cut-out through every layer below)
 *   `1 2 3 4` `0`     slot A: highlight, base, shadow, deep, line
 *   `a b c d` `e`     slot B
 *   `f g h i` `j`     slot C
 *   `k l m n` `p`     slot D
 *   `K S s Z` `z`     skin: highlight, base, shadow, deep, line
 *   `E` `W` `I`       eye dark, eye highlight (near white), iris (the look's eye colour)
 *   `M` `B`           mouth, blush
 *
 * A part binds its template to up to four slot names (A..D) that the look's palette resolves to ramps, so one
 * "long coat" template serves the pirate's red coat and the doctor's white one. The compositor paints parts
 * back to front into an ink buffer (ramp index + tone per texel, plus the part's layer id), then adds the
 * automatic 1-texel selective outline and resolves colours.
 */
import type { Ramp, Rgb } from './color.js';

export const CELL_W = 32;
export const CELL_H = 52;

export type Facing = 'D' | 'U' | 'L' | 'R';
/** Facings with authored templates; R is L mirrored (per part, so asymmetric parts can override it). */
export type AuthoredFacing = 'D' | 'U' | 'L';

export interface Tpl {
  readonly y: number;
  readonly x?: number;
  readonly rows: readonly string[];
}

/** Tone indices: 0..3 ramp tones, 4 line. */
export const LINE = 4;

/** Fixed (look-independent) slot names the legend refers to directly. */
export type FixedSlot = 'skin' | 'eye' | 'eyeHi' | 'iris' | 'mouth' | 'blush';

interface Ink { readonly group: number; readonly tone: number }

/** Character → (group, tone). Groups 0..3 are the part's slots A..D; negative groups are fixed slots. */
const LEGEND: ReadonlyMap<string, Ink> = (() => {
  const m = new Map<string, Ink>();
  const group = (chars: string, g: number): void => { for (let i = 0; i < 5; i++) m.set(chars[i]!, { group: g, tone: i }); };
  group('12340', 0);
  group('abcde', 1);
  group('fghij', 2);
  group('klmnp', 3);
  group('KSsZz', -1);          // skin
  m.set('E', { group: -2, tone: 1 });
  m.set('W', { group: -3, tone: 1 });
  m.set('I', { group: -4, tone: 1 });
  m.set('M', { group: -5, tone: 1 });
  m.set('B', { group: -6, tone: 1 });
  return m;
})();

const FIXED_BY_GROUP: Readonly<Record<number, FixedSlot>> = { [-1]: 'skin', [-2]: 'eye', [-3]: 'eyeHi', [-4]: 'iris', [-5]: 'mouth', [-6]: 'blush' };

export function isLegendChar(ch: string): boolean { return ch === '.' || ch === ' ' || ch === 'X' || LEGEND.has(ch); }

/** Mirrors a template across the cell's vertical centre line (x → CELL_W − 1 − x). */
export function mirrorTpl(t: Tpl): Tpl {
  const x0 = t.x ?? 0;
  return {
    y: t.y,
    x: 0,
    rows: t.rows.map((r) => {
      const full = (' '.repeat(x0) + r).padEnd(CELL_W, '.').slice(0, CELL_W);
      return [...full].reverse().join('');
    }),
  };
}

/** Overlays templates (later ones win where they are not `.`) into one full-width template. */
export function overlay(...ts: readonly Tpl[]): Tpl {
  const y0 = Math.min(...ts.map((t) => t.y));
  const y1 = Math.max(...ts.map((t) => t.y + t.rows.length));
  const rows: string[][] = [];
  for (let y = y0; y < y1; y++) rows.push(Array.from({ length: CELL_W }, () => '.'));
  for (const t of ts) {
    const x0 = t.x ?? 0;
    t.rows.forEach((r, i) => {
      for (let c = 0; c < r.length; c++) {
        const ch = r[c]!;
        if (ch === '.' || ch === ' ') continue;
        const x = x0 + c;
        if (x >= 0 && x < CELL_W) rows[t.y + i - y0]![x] = ch;
      }
    });
  }
  return { y: y0, x: 0, rows: rows.map((r) => r.join('')) };
}

/** A template shifted by (dx, dy). */
export function shiftTpl(t: Tpl, dx: number, dy: number): Tpl {
  return { y: t.y + dy, x: (t.x ?? 0) + dx, rows: t.rows };
}

// ---- the ink buffer ---------------------------------------------------------------------------------------------

/** Per-texel ink: ramp index (−1 empty) and tone; `layer` is the painting part's layer tag (normal map, QA). */
export class InkBuffer {
  readonly ramp = new Int16Array(CELL_W * CELL_H).fill(-1);
  readonly tone = new Uint8Array(CELL_W * CELL_H);
  readonly layer = new Uint8Array(CELL_W * CELL_H);

  clear(): void { this.ramp.fill(-1); this.tone.fill(0); this.layer.fill(0); }

  filled(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < CELL_W && y < CELL_H && this.ramp[y * CELL_W + x]! >= 0;
  }
}

/** Resolves slot names to indices into the look's ramp table. */
export interface RampTable {
  readonly ramps: readonly Ramp[];
  /** Ramp index of a slot name (throws on an unknown slot — a look must define every slot its parts use). */
  index(slot: string): number;
}

/**
 * Paints `t` into `buf` with slot bindings `slots` (A..D) at offset (dx, dy). Texels outside the cell are dropped.
 * `layerTag` marks the painted texels (1..255).
 */
export function paint(buf: InkBuffer, t: Tpl, slots: readonly string[], table: RampTable, dx: number, dy: number, layerTag: number, where: string): void {
  const x0 = (t.x ?? 0) + dx;
  const y0 = t.y + dy;
  const groupRamp: number[] = slots.map((s) => table.index(s));
  const fixed = (g: number): number => table.index(FIXED_BY_GROUP[g]!);
  for (let r = 0; r < t.rows.length; r++) {
    const row = t.rows[r]!;
    const y = y0 + r;
    if (y < 0 || y >= CELL_H) continue;
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]!;
      if (ch === '.' || ch === ' ') continue;
      const x = x0 + c;
      if (x < 0 || x >= CELL_W) continue;
      const p = y * CELL_W + x;
      if (ch === 'X') { buf.ramp[p] = -1; buf.tone[p] = 0; buf.layer[p] = 0; continue; }
      const ink = LEGEND.get(ch);
      if (ink === undefined) throw new RangeError(`character-pipeline: unknown template char '${ch}' in ${where} (row ${r})`);
      let ri: number;
      if (ink.group >= 0) {
        const gi = groupRamp[ink.group];
        if (gi === undefined) throw new RangeError(`character-pipeline: ${where} uses slot ${'ABCD'[ink.group]} ('${ch}') but binds only ${slots.length} slot(s)`);
        ri = gi;
      } else ri = fixed(ink.group);
      buf.ramp[p] = ri;
      buf.tone[p] = ink.tone;
      buf.layer[p] = layerTag;
    }
  }
}

/**
 * The selective outline: every empty texel 4-adjacent to ink becomes a line texel of the neighbouring material.
 * Texels below or right of the sprite (the shadowed sides, light from the upper left) take `line`; above or left,
 * `lineLit`. Neighbour preference: the texel above, then left, right, below (so a hat brim outlines as hat).
 */
export function outline(buf: InkBuffer, table: RampTable): { ramp: Int16Array; tone: Uint8Array; lit: Uint8Array } {
  const ramp = Int16Array.from(buf.ramp);
  const tone = Uint8Array.from(buf.tone);
  const lit = new Uint8Array(CELL_W * CELL_H);
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      const p = y * CELL_W + x;
      if (buf.ramp[p]! >= 0) continue;
      // [dx, dy, lit?] — the neighbour's position relative to this empty texel
      const order: readonly (readonly [number, number, boolean])[] = [[0, -1, false], [-1, 0, false], [1, 0, true], [0, 1, true]];
      for (const [dx, dy, isLit] of order) {
        const nx = x + dx; const ny = y + dy;
        if (!buf.filled(nx, ny)) continue;
        const q = ny * CELL_W + nx;
        let ri = buf.ramp[q]!;
        // an outline next to the eye/mouth/blush inks (never on the silhouette in practice) uses skin
        if (ri === table.index('eye') || ri === table.index('eyeHi') || ri === table.index('iris') || ri === table.index('mouth') || ri === table.index('blush')) ri = table.index('skin');
        ramp[p] = ri;
        tone[p] = LINE;
        lit[p] = isLit ? 1 : 0;
        break;
      }
    }
  }
  void table;
  return { ramp, tone, lit };
}

/** Resolves an outlined ink buffer into straight RGBA (binary alpha). */
export function resolve(o: { ramp: Int16Array; tone: Uint8Array; lit: Uint8Array }, table: RampTable, out: Uint8Array, stride: number, ox: number, oy: number): void {
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      const p = y * CELL_W + x;
      const ri = o.ramp[p]!;
      const i = ((oy + y) * stride + ox + x) * 4;
      if (ri < 0) { out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0; continue; }
      const r = table.ramps[ri]!;
      const t = o.tone[p]!;
      const c: Rgb = t === LINE ? (o.lit[p] === 1 ? r.lineLit : r.line) : r.tones[t as 0 | 1 | 2 | 3];
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
    }
  }
}
