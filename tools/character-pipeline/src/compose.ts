/**
 * The paper doll: a look's parts → one 32 × 52 frame per facing × pose.
 *
 * Parts contribute templates to LAYER KINDS; each facing paints the kinds in its own back-to-front order (a cape
 * hangs behind the body facing the camera and over it facing away; the far arm is behind the torso in profile).
 * R is composed from the L templates mirrored part by part, so a part may override its R side (an eyepatch that
 * must stay on one eye). After painting:
 *   1. contact separation — where a part in front meets a part behind (an arm against the torso, the head over the
 *      collar, the torso over the belt line), the texel behind darkens to its deep tone, or to its line colour when
 *      both texels are the same material; this is what keeps a tee-shirt arm readable against a tee-shirt body;
 *   2. the selective outline (grid.ts `outline`);
 *   3. colour resolve (straight RGBA, binary alpha).
 */
import type { Ramp } from './color.js';
import { hexToRgb, makeRamp, pinnedRamp, type RampKind } from './color.js';
import {
  CELL_H, CELL_W, InkBuffer, LINE, mirrorTpl, outline, paint, resolve, type AuthoredFacing, type Facing, type RampTable, type Tpl,
} from './grid.js';
import type { Pose } from './poses.js';

export type LayerKind =
  | 'cape' | 'hairLong' | 'armFar' | 'pack' | 'legs' | 'lower' | 'torso' | 'torsoExtra' | 'arm' | 'shoulder'
  | 'head' | 'face' | 'faceExtra' | 'hair' | 'hat' | 'armRaised';

/** Back-to-front paint order per facing (R uses L's). */
export const ORDER: Readonly<Record<AuthoredFacing, readonly LayerKind[]>> = {
  D: ['cape', 'hairLong', 'pack', 'legs', 'lower', 'torso', 'torsoExtra', 'arm', 'shoulder', 'head', 'face', 'faceExtra', 'hair', 'hat', 'armRaised'],
  U: ['legs', 'lower', 'torso', 'torsoExtra', 'arm', 'shoulder', 'cape', 'pack', 'head', 'hair', 'hairLong', 'hat'],
  L: ['cape', 'armFar', 'legs', 'lower', 'torso', 'torsoExtra', 'pack', 'hairLong', 'head', 'face', 'faceExtra', 'hair', 'hat', 'arm', 'shoulder'],
};

/**
 * Templates are authored with the soles on row 42; every layer is painted 7 rows lower so the soles sit on cell
 * row 49 and their outline on 50, leaving rows 0–9 above the hair for hats, plumes and horns plus the 1-texel
 * walk bob and the 2-texel cheer hop (a plume never clips at the cell top).
 */
export const BASE_DY = 7;
/** The first row below the outlined soles: the foot line (manifest `footV = (CELL_H − FOOT_ROW) / CELL_H`). */
export const FOOT_ROW = 51;

/** Kinds that ride with the upper body (bob, breathing, lean); legs only follow the hop. */
const UPPER: ReadonlySet<LayerKind> = new Set<LayerKind>([
  'cape', 'hairLong', 'armFar', 'pack', 'lower', 'torso', 'torsoExtra', 'arm', 'shoulder', 'head', 'face', 'faceExtra', 'hair', 'hat', 'armRaised',
]);

/**
 * Contact separation: [front kind, behind kind, mode]. `all` darkens the behind texel on any 4-side contact;
 * `below` only when the front texel is directly above it (a chin over a collar, a hem over a belt).
 */
const SEPARATE: readonly (readonly [LayerKind, LayerKind, 'all' | 'below'])[] = [
  ['armRaised', 'hat', 'all'], ['armRaised', 'hair', 'all'], ['armRaised', 'head', 'all'], ['armRaised', 'torso', 'all'], ['armRaised', 'shoulder', 'all'],
  ['arm', 'torso', 'all'], ['arm', 'torsoExtra', 'all'], ['arm', 'lower', 'all'], ['arm', 'cape', 'all'], ['arm', 'hairLong', 'all'], ['arm', 'legs', 'all'],
  ['shoulder', 'torso', 'all'], ['shoulder', 'arm', 'below'],
  ['torso', 'armFar', 'all'], ['lower', 'armFar', 'all'], ['legs', 'armFar', 'all'],
  ['head', 'torso', 'below'], ['head', 'torsoExtra', 'below'], ['hair', 'torso', 'below'], ['faceExtra', 'torso', 'below'],
  ['hairLong', 'torso', 'all'],
  ['torso', 'legs', 'below'], ['torsoExtra', 'legs', 'below'], ['lower', 'legs', 'below'],
  ['hat', 'hair', 'below'], ['hat', 'head', 'below'], ['hair', 'head', 'below'],
];

export type TplSource = Tpl | ((pose: Pose) => Tpl | null) | null;
export interface ByFacing { readonly D?: TplSource; readonly U?: TplSource; readonly L?: TplSource; /** absent → L mirrored; null → nothing */ readonly R?: TplSource }

export interface PartDef {
  readonly kinds: Partial<Record<LayerKind, ByFacing>>;
}

export interface PartUse {
  readonly part: PartDef;
  /** Slot names bound to template slots A..D. */
  readonly slots: readonly string[];
}

export type RampSpec = { readonly base: string; readonly kind: RampKind } | { readonly pinned: readonly [string, string, string, string]; readonly line?: string; readonly lineLit?: string };

/** A look's resolved palette. The fixed slots (skin, eye, eyeHi, iris, mouth, blush) must be present. */
export class Palette implements RampTable {
  readonly ramps: Ramp[] = [];
  private readonly byName = new Map<string, number>();

  constructor(specs: Readonly<Record<string, RampSpec>>) {
    for (const name of Object.keys(specs).sort()) {
      const s = specs[name]!;
      this.byName.set(name, this.ramps.length);
      this.ramps.push('pinned' in s ? pinnedRamp(s.pinned, s.line, s.lineLit) : makeRamp(s.base, s.kind));
    }
    for (const f of ['skin', 'eye', 'eyeHi', 'iris', 'mouth', 'blush']) if (!this.byName.has(f)) throw new RangeError(`character-pipeline: palette lacks fixed slot '${f}'`);
  }

  index(slot: string): number {
    const i = this.byName.get(slot);
    if (i === undefined) throw new RangeError(`character-pipeline: palette has no slot '${slot}'`);
    return i;
  }

  has(slot: string): boolean { return this.byName.has(slot); }
}

/** The tag painted per kind (1-based index into `KIND_TAGS`), used by separation and the normal map. */
export const KIND_TAGS: readonly LayerKind[] = [
  'cape', 'hairLong', 'armFar', 'pack', 'legs', 'lower', 'torso', 'torsoExtra', 'arm', 'shoulder', 'head', 'face', 'faceExtra', 'hair', 'hat', 'armRaised',
];
export function tagOf(k: LayerKind): number { return KIND_TAGS.indexOf(k) + 1; }

function sourceFor(by: ByFacing, facing: Facing): { src: TplSource; mirror: boolean } {
  if (facing === 'R') {
    if (by.R !== undefined) return { src: by.R, mirror: false };
    return { src: by.L ?? null, mirror: true };
  }
  return { src: by[facing] ?? null, mirror: false };
}

export interface ComposedFrame {
  /** Straight RGBA, CELL_W × CELL_H, alpha 0 or 255. */
  readonly rgba: Uint8Array;
  /** Layer tag per texel after the outline (outline texels carry the tag of the texel they outline). */
  readonly tags: Uint8Array;
}

/** Composes one frame. Pure and deterministic. */
export function composeFrame(parts: readonly PartUse[], palette: Palette, facing: Facing, pose: Pose): ComposedFrame {
  const buf = new InkBuffer();
  const order = ORDER[facing === 'R' ? 'L' : facing];
  const leanDir = facing === 'L' ? -1 : facing === 'R' ? 1 : 0;
  for (const kind of order) {
    for (const use of parts) {
      const by = use.part.kinds[kind];
      if (by === undefined) continue;
      const { src, mirror } = sourceFor(by, facing);
      if (src === null) continue;
      // posed templates are authored for L; R mirrors the result
      let t = typeof src === 'function' ? src(pose) : src;
      if (t === null) continue;
      if (mirror) t = mirrorTpl(t);
      const upper = UPPER.has(kind);
      const dx = upper ? leanDir * pose.lean : 0;
      const dy = BASE_DY + pose.hop + (upper ? pose.body : 0);
      paint(buf, t, use.slots, palette, dx, dy, tagOf(kind), `${kind}/${facing}`);
    }
  }
  separate(buf, palette);
  const o = outline(buf, palette);
  const rgba = new Uint8Array(CELL_W * CELL_H * 4);
  resolve(o, palette, rgba, CELL_W, 0, 0);
  const tags = Uint8Array.from(buf.layer);
  // outline texels inherit the tag of the texel they outline (the same neighbour order as `outline`)
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      const p = y * CELL_W + x;
      if (o.tone[p] !== LINE || buf.ramp[p]! >= 0) continue;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (buf.filled(nx, ny)) { tags[p] = buf.layer[ny * CELL_W + nx]!; break; }
      }
    }
  }
  return { rgba, tags };
}

const SEP_BY_BEHIND = (() => {
  const m = new Map<number, { front: number; mode: 'all' | 'below' }[]>();
  for (const [front, behind, mode] of SEPARATE) {
    const b = tagOf(behind);
    let list = m.get(b);
    if (list === undefined) { list = []; m.set(b, list); }
    list.push({ front: tagOf(front), mode });
  }
  return m;
})();

const ARM_TAG = tagOf('arm');
const TORSO_TAG = tagOf('torso');
/** Cell row of the armpit (template row 24 + BASE_DY). */
const ARMPIT_ROW = 24 + BASE_DY;

/** Contact separation (see the header). Reads the painted state, writes tones; one pass. */
function separate(buf: InkBuffer, palette: Palette): void {
  const tone = Uint8Array.from(buf.tone);
  const skin = palette.index('skin');
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      const p = y * CELL_W + x;
      if (buf.ramp[p]! < 0) continue;
      const rules = SEP_BY_BEHIND.get(buf.layer[p]!);
      if (rules === undefined) continue;
      let hit = -1;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (!buf.filled(nx, ny)) continue;
        const q = ny * CELL_W + nx;
        const ft = buf.layer[q]!;
        for (const r of rules) {
          if (r.front !== ft) continue;
          if (r.mode === 'below' && !(dx === 0 && dy === -1)) continue;
          hit = q;
          break;
        }
        if (hit >= 0) break;
      }
      if (hit < 0) continue;
      // sleeves merge into the shoulders: an arm against the torso only separates below the armpit
      if (buf.layer[hit] === ARM_TAG && buf.layer[p] === TORSO_TAG && y < ARMPIT_ROW) continue;
      // the texel behind drops to its deep tone (skin behind skin — a hand on a face — only to its shadow);
      // a texel that already is a line stays one
      const t0 = buf.tone[p]!;
      tone[p] = t0 === LINE ? LINE : Math.max(t0, buf.ramp[p] === skin ? 2 : 3);
    }
  }
  buf.tone.set(tone);
}

/** Sanity: every template row fits the cell and uses only legend characters (tests call this over the library). */
export function assertTemplate(t: Tpl, where: string): void {
  const x0 = t.x ?? 0;
  t.rows.forEach((r, i) => {
    if (x0 + r.length > CELL_W) throw new RangeError(`${where}: row ${i} is ${x0 + r.length} wide (> ${CELL_W})`);
    if (t.y + i >= CELL_H) throw new RangeError(`${where}: row ${i} at y ${t.y + i} is outside the cell`);
  });
}

void hexToRgb;
