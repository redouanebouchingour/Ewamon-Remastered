/**
 * Parametric recipe families for the 68 non-slice surfaces (rock / soil / masonry / wood / metal / cloth /
 * glass / crystal / lava / water / foliage cards), plus the helpers the slice recipes share. Every family is
 * seamless when `wrap: 'repeat'` (tiled noise, wrapped stamps) and tuned per id by its parameters, so nothing
 * bakes as a flat colour. Pixel parameters (`…Px`) are at the reference size (1024 hero, 512 field).
 */
import type { CardRgb, Noise, Rgb, ScalarField, SurfaceRecipe } from '../recipe';
import { hasAlpha, rng as rngOf } from '../recipe';
import {
  TAU, aux, clamp, courses, crackWalk, each, hex, hueShift, makeAshlar, mix, mix3, normalize01, sat, scale3, setRgb,
  smoothstep, stamp, stroke, tiled, wrapDelta,
} from './lib';
import type { CourseCell, Vec3 } from './lib';

// ─── shared helpers (used by grove.ts too) ─────────────────────────────────────────────────────

export const card = (rgb: Rgb): CardRgb => {
  if (!hasAlpha(rgb)) throw new Error('card recipe painted without an alpha channel');
  return rgb;
};

export interface Leaf { cu: number; cv: number; len: number; wid: number; ang: number; cluster: number; tone: number }
export function leafLayout(seed: string, clusters: number, perCluster: number, lenRange: readonly [number, number]): Leaf[] {
  const out: Leaf[] = [];
  const r = rngOf(seed);
  const centres: [number, number][] = [];
  for (let k = 0; k < clusters; k++) {
    const a = (k / clusters) * TAU + r() * 0.8;
    centres.push([0.5 + Math.cos(a) * 0.15, 0.5 + Math.sin(a) * 0.15]);
  }
  for (let k = 0; k < clusters; k++) {
    const [cx, cy] = centres[k]!;
    for (let j = 0; j < perCluster; j++) {
      const a = r() * TAU;
      const rad = Math.sqrt(r()) * 0.25;
      const len = lenRange[0] + r() * (lenRange[1] - lenRange[0]);
      out.push({
        cu: cx + Math.cos(a) * rad * 1.1, cv: cy + Math.sin(a) * rad * 0.85,
        len, wid: len * (0.36 + r() * 0.1), ang: a - Math.PI / 2 + (r() - 0.5) * 0.9, cluster: k, tone: r(),
      });
    }
  }
  return out;
}

interface Knot { u: number; v: number; ru: number; rv: number }
function knotsFor(seed: string, count: number, planks: number): Knot[] {
  const r = rngOf(seed);
  const ks: Knot[] = [];
  for (let k = 0; k < count; k++) {
    const plank = Math.floor(r() * planks);
    ks.push({ u: r(), v: (plank + 0.5) / planks + 1 / (planks * 2) + (r() - 0.5) * 0.08, ru: 0.09 + r() * 0.07, rv: 0.035 + r() * 0.02 });
  }
  return ks;
}

/**
 * Planks along u (`planks` per tile, joints off the tile edge), grain fbm(2, 24), one butt joint per plank, and
 * `knots` knots with the Table-Clash ring compression. Writes aux 'plank' (per-plank hash), 'grain', 'knot'.
 */
export function timberHeight(h: ScalarField, c: { readonly noise: Noise }, seed: string, planks: number, gapPx: number, ref: number, knots = 6, grainV = 24): void {
  const grain = tiled(c.noise, 2, grainV);
  const fine = tiled(c.noise, 3, grainV * 3.75, 2);
  const warpN = tiled(c.noise, 3, 6, 3);
  const ks = knotsFor(seed, knots, planks);
  const pl = aux(h, 'plank'), gr = aux(h, 'grain'), kn = aux(h, 'knot');
  const gap = gapPx / ref, bev = 2.5 / ref;
  each(h, (u, v, i) => {
    const pv = v * planks - 0.5;
    const k = Math.floor(pv);
    const kk = ((k % planks) + planks) % planks;
    const t = pv - k;
    const edgeDist = Math.min(t, 1 - t) / planks;
    const offset = c.noise.hash21(kk, 17) * 7;
    const butt = c.noise.hash21(kk, 29);
    const buttDist = Math.abs(wrapDelta(u - butt));
    const d = Math.min(edgeDist, buttDist);
    const warp = (warpN.fbm(u, v, 3) - 0.5) * 0.04;
    let g = grain.fbm(u + offset, v + warp, 5);
    g = 0.7 * g + 0.3 * fine.fbm(u + offset, v + warp, 3);
    let knot = 0;
    for (const K of ks) {
      const dx = wrapDelta(u - K.u), dy = wrapDelta(v - K.v);
      const e = Math.sqrt((dx / K.ru) ** 2 + (dy / K.rv) ** 2);
      if (e < 1) {
        const w = 1 - smoothstep(0.35, 1, e);
        const ring = Math.pow((Math.sqrt((0.18 * dx) ** 2 + dy * dy) * 26 * 6 + g * 2.4) % 1, 0.6);
        g = mix(g, ring, w * 0.85);
        knot = Math.max(knot, (1 - smoothstep(0.0, 0.3, e)) * 0.9 + w * 0.1);
      }
    }
    const body = 0.55 + 0.35 * g - 0.12 * knot;
    const edge = d < gap / 2 ? 0 : smoothstep(gap / 2, gap / 2 + bev, d);
    h.data[i] = body * edge;
    pl[i] = c.noise.hash21(kk, 5);
    gr[i] = g;
    kn[i] = knot;
  });
}

// ─── common parameter block ────────────────────────────────────────────────────────────────────

export interface Common {
  readonly id: string; readonly hero: boolean; readonly metres: number; readonly strength: number;
  readonly wrap?: 'repeat' | 'clamp'; readonly rdo?: number;
}
const px = (c: Common, n: number): number => n / (c.hero ? 1024 : 512);
function recipe(c: Common, body: Pick<SurfaceRecipe, 'height' | 'albedo' | 'orm'>): SurfaceRecipe {
  return {
    id: c.id, hero: c.hero, metres: c.metres, normalStrength: c.strength, wrap: c.wrap ?? 'repeat',
    ...(c.rdo !== undefined ? { rdo: c.rdo } : {}),
    ...body,
  };
}
const col = (s: string | undefined, fallback: Vec3): Vec3 => (s ? hex(s) : fallback);

// ─── rock ──────────────────────────────────────────────────────────────────────────────────────

export interface RockParams extends Common {
  readonly base: string; readonly dark?: string; readonly light?: string;
  readonly rough: readonly [number, number];          // [ridges, valleys]
  readonly metal?: number;
  readonly freq?: number;                               // macro fbm per tile (default 4)
  readonly cells?: number;                              // facet/plate cells per tile (0 = none)
  readonly cellAspect?: number;                         // cells stretched along u (>1) or v (<1)
  readonly crack?: number;                              // crack depth at facet borders
  readonly crackWidth?: number;                         // f2 − f1 threshold in cell units (default 0.06)
  readonly strata?: number;                             // horizontal layers per tile
  readonly strataAmp?: number;
  readonly pits?: number;                               // vesicle count
  readonly pitPx?: readonly [number, number];
  readonly speck?: number;                              // mineral speckle density 0..1
  readonly speckColor?: string;
  readonly tone?: number;                               // per-facet tone jitter (default 0.12)
  readonly detail?: number;                             // fine-detail weight (default 0.12)
  readonly lichen?: { readonly color: string; readonly amount: number };   // circular rosettes
  readonly barnacles?: number;                          // cone stamps
  readonly streaks?: { readonly color: string; readonly amount: number };  // vertical run-off streaks
}

export function rock(p: RockParams): SurfaceRecipe {
  const base = hex(p.base), dark = col(p.dark, scale3(base, 0.55)), light = col(p.light, scale3(base, 1.15));
  return recipe(p, {
    height(h, c) {
      const macro = tiled(c.noise, p.freq ?? 4, p.freq ?? 4, 1);
      const det = tiled(c.noise, (p.freq ?? 4) * 4, (p.freq ?? 4) * 4, 2);   // finest octave ≈ 4 px at 512² (no sub-texel noise)
      const cellsU = p.cells ? Math.max(1, Math.round(p.cells * (p.cellAspect ?? 1))) : 0;
      const cells = p.cells ? tiled(c.noise, cellsU, p.cells, 3) : null;
      const warp = tiled(c.noise, 2, 3, 4);
      const crack = aux(h, 'crack'), fid = aux(h, 'fid'), band = aux(h, 'band');
      const cw = p.crackWidth ?? 0.06;
      each(h, (u, v, i) => {
        let hh = 0.45 * macro.fbm(u, v, 6) + (p.detail ?? 0.12) * det.fbm(u, v, 3);
        if (cells) {
          const w = cells.worley(u, v, 0.9);
          const e = w.f2 - w.f1;
          const cr = 1 - smoothstep(cw * 0.3, cw, e);
          hh += 0.22 * w.id + 0.08 * smoothstep(0, 0.4, e) - (p.crack ?? 0.4) * cr;
          crack[i] = cr; fid[i] = w.id;
        }
        if (p.strata) {
          const lv = v * p.strata + (warp.fbm(u, v, 3) - 0.5) * 0.8;
          const f = lv - Math.floor(lv);
          hh += (p.strataAmp ?? 0.25) * (smoothstep(0, 0.12, f) - f * 0.6);
          band[i] = c.noise.hash21(((Math.floor(lv) % p.strata) + p.strata) % p.strata, 77);
        }
        h.data[i] = hh;
      });
      if (p.pits) {
        const r = c.noise.rng(`${p.id}:pits`);
        const pit = aux(h, 'pit');
        const [a, b] = p.pitPx ?? [3, 9];
        for (let k = 0; k < p.pits; k++) {
          const cu = r(), cv = r(), rad = px(p, a + r() * (b - a));
          stamp(h, cu, cv, rad, rad * (0.7 + r() * 0.3), r() * TAU, true, (nx, ny, i) => {
            const d = 1 - (nx * nx + ny * ny);
            if (d > pit[i]!) pit[i] = d;
          });
        }
        for (let i = 0; i < h.data.length; i++) h.data[i] = h.data[i]! - 0.35 * pit[i]!;
      }
      if (p.barnacles) {
        const r = c.noise.rng(`${p.id}:barnacles`);
        const bar = aux(h, 'barnacle');
        for (let k = 0; k < p.barnacles; k++) {
          const cu = r(), cv = r(), rad = px(p, 5 + r() * 9);
          stamp(h, cu, cv, rad, rad, 0, true, (nx, ny, i) => {
            const d = Math.sqrt(nx * nx + ny * ny);
            const cone = d < 0.35 ? 0.55 - 0.4 * (0.35 - d) / 0.35 : 1 - d;      // cone with a hollow top
            const val = 0.35 + 0.5 * cone;
            if (val > bar[i]!) bar[i] = val;
          });
        }
        for (let i = 0; i < h.data.length; i++) if (bar[i]! > 0) h.data[i] = Math.max(h.data[i]!, 0.3 + bar[i]!);
      }
      normalize01(h.data);
    },
    albedo(rgb, h, c) {
      const sp = tiled(c.noise, 160, 160, 5);
      const tint = tiled(c.noise, 3, 3, 6);
      const crack = aux(h, 'crack'), fid = aux(h, 'fid'), band = aux(h, 'band'), pit = aux(h, 'pit'), bar = aux(h, 'barnacle');
      const speckC = col(p.speckColor, scale3(base, 1.35));
      const lich = p.lichen ? tiled(c.noise, 9, 9, 7) : null;
      const lichC = p.lichen ? hex(p.lichen.color) : base;
      const strk = p.streaks ? tiled(c.noise, 24, 2, 8) : null;
      const strkC = p.streaks ? hex(p.streaks.color) : base;
      const tone = p.tone ?? 0.12;
      each(rgb, (u, v, i) => {
        const hh = h.data[i]!;
        let cc = mix3(dark, base, smoothstep(0.08, 0.6, hh));
        cc = mix3(cc, light, smoothstep(0.7, 1, hh) * 0.6);
        const t = tint.fbm(u, v, 3);
        let k = (1 + (fid[i]! - 0.5) * 2 * tone) * (0.9 + 0.2 * t) * (1 - 0.45 * crack[i]!) * (1 - 0.3 * pit[i]!);
        if (p.strata) k *= 0.88 + 0.24 * band[i]!;
        cc = scale3(hueShift(cc, (t - 0.5) * 10), k);
        if (p.speck) {
          const s = sp.value(u, v);
          if (s > 1 - p.speck * 0.25) cc = mix3(cc, speckC, 0.7);
          else if (s < p.speck * 0.12) cc = scale3(cc, 0.6);
        }
        if (lich && p.lichen) {
          // crusty irregular patches: a thresholded fbm broken up by fine noise, denser on the high faces
          const n = lich.fbm(u, v, 5) + (sp.value(u, v) - 0.5) * 0.08 + hh * 0.08;
          const m = smoothstep(1 - p.lichen.amount * 0.72, 1 - p.lichen.amount * 0.62, n);
          cc = mix3(cc, scale3(lichC, 0.8 + 0.35 * sp.value(v, u)), m * 0.9);
        }
        if (strk && p.streaks) cc = mix3(cc, strkC, smoothstep(0.55, 0.8, strk.fbm(u, v, 3)) * p.streaks.amount);
        if (bar[i]! > 0) cc = mix3(cc, hex('#b8b2a2'), smoothstep(0.3, 0.5, bar[i]!) * 0.8);
        setRgb(rgb, i, cc);
      });
    },
    orm(o, h) {
      const [r0, r1] = p.rough;
      for (let i = 0; i < o.rough.length; i++) {
        o.rough[i] = mix(r0, r1, 1 - h.data[i]!);
        if (p.metal) o.metal[i] = p.metal;
      }
    },
  });
}

// ─── soil (sand / ash / dust / snow) ───────────────────────────────────────────────────────────

export interface SoilParams extends Common {
  readonly base: string; readonly dark?: string; readonly light?: string;
  readonly rough: readonly [number, number];
  readonly ripple?: { readonly k: readonly [number, number]; readonly amp: number };
  readonly grain?: number;                              // fine grain amplitude
  readonly pebbles?: number; readonly pebbleColor?: string; readonly pebblePx?: readonly [number, number];
  readonly crust?: number;                              // cracked crust cells per tile
  readonly sparkle?: number;                            // bright specks (snow, salt)
  readonly embers?: { readonly color: string; readonly amount: number };
  /**
   * Organic albedo patches independent of the height (wind-laid pale ash over dark cinder): `cells` noise cells per
   * tile, `amount` the blend at the patch core. Absent = none (the other soils bake as before).
   */
  readonly drift?: { readonly color: string; readonly amount: number; readonly cells: number };
}

export function soil(p: SoilParams): SurfaceRecipe {
  const base = hex(p.base), dark = col(p.dark, scale3(base, 0.7)), light = col(p.light, scale3(base, 1.12));
  return recipe(p, {
    height(h, c) {
      const macro = tiled(c.noise, 4, 4, 1);
      const warp = tiled(c.noise, 3, 3, 2);
      const grain = tiled(c.noise, 96, 96, 3);
      const crust = p.crust ? tiled(c.noise, p.crust, p.crust, 4) : null;
      const cr = aux(h, 'crack');
      each(h, (u, v, i) => {
        let hh = 0.5 * macro.fbm(u, v, 5);
        if (p.ripple) {
          const [kx, ky] = p.ripple.k;
          const ph = TAU * (kx * u + ky * v) + warp.fbm(u, v, 3) * TAU * 0.8;
          const s = Math.sin(ph);
          hh += p.ripple.amp * (0.5 + 0.5 * (s > 0 ? Math.sqrt(s) : -Math.sqrt(-s)) * 0.8);   // sharp crests
        }
        hh += (p.grain ?? 0.06) * grain.value(u, v);
        if (crust) {
          const w = crust.worley(u, v, 0.85);
          const e = 1 - smoothstep(0.02, 0.07, w.f2 - w.f1);
          hh += 0.12 * w.id - 0.25 * e;
          cr[i] = e;
        }
        h.data[i] = hh;
      });
      if (p.pebbles) {
        const r = c.noise.rng(`${p.id}:pebbles`);
        const pb = aux(h, 'pebble');
        const [a, b] = p.pebblePx ?? [4, 10];
        for (let k = 0; k < p.pebbles; k++) {
          const cu = r(), cv = r(), rad = px(p, a + r() * (b - a)), tall = 0.4 + r() * 0.4;
          stamp(h, cu, cv, rad, rad * (0.6 + r() * 0.4), r() * TAU, true, (nx, ny, i) => {
            const d = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * tall;
            if (d > pb[i]!) pb[i] = d;
          });
        }
        for (let i = 0; i < h.data.length; i++) h.data[i] = Math.max(h.data[i]!, 0.35 + pb[i]!);
      }
      normalize01(h.data);
    },
    albedo(rgb, h, c) {
      const tint = tiled(c.noise, 3, 3, 5);
      const sp = tiled(c.noise, 220, 220, 6);
      const pb = aux(h, 'pebble'), cr = aux(h, 'crack');
      const pc = col(p.pebbleColor, scale3(base, 0.8));
      const ember = p.embers ? hex(p.embers.color) : base;
      const dn = p.drift ? tiled(c.noise, p.drift.cells, p.drift.cells, 7) : null;
      const dc = p.drift ? hex(p.drift.color) : base;
      each(rgb, (u, v, i) => {
        const hh = h.data[i]!;
        const t = tint.fbm(u, v, 4);
        let cc = mix3(dark, base, smoothstep(0.1, 0.55, hh));
        cc = mix3(cc, light, smoothstep(0.65, 1, hh) * 0.5);
        cc = scale3(hueShift(cc, (t - 0.5) * 8), (0.9 + 0.18 * t) * (1 - 0.35 * cr[i]!));
        if (dn && p.drift) cc = mix3(cc, scale3(dc, 0.92 + 0.16 * t), smoothstep(0.46, 0.68, dn.fbm(u, v, 5)) * p.drift.amount);
        if (pb[i]! > 0.02) cc = mix3(cc, scale3(pc, 0.8 + 0.4 * pb[i]!), smoothstep(0.02, 0.12, pb[i]!));
        const s = sp.value(u, v);
        if (p.sparkle && s > 1 - p.sparkle * 0.2) cc = mix3(cc, light, 0.8);
        if (p.embers && s < p.embers.amount * 0.1) cc = mix3(cc, ember, 0.8);
        setRgb(rgb, i, cc);
      });
    },
    orm(o, h) {
      const [r0, r1] = p.rough;
      for (let i = 0; i < o.rough.length; i++) o.rough[i] = mix(r0, r1, 1 - h.data[i]!);
    },
  });
}

// ─── masonry (bricks, blocks, slabs, flagstones, marble) ────────────────────────────────────────

export type MasonryLayout =
  | { readonly kind: 'courses'; readonly rows: number; readonly cols: number; readonly offset: number; readonly jitter?: number }
  | { readonly kind: 'ashlar'; readonly rows: number; readonly min: number; readonly max: number; readonly rowJitter: number; readonly jointJitter: number }
  | { readonly kind: 'polygon'; readonly cells: number };

export interface MasonryParams extends Common {
  readonly base: string; readonly mortar: string; readonly accent?: string;
  readonly rough: readonly [number, number];            // [stone, mortar]
  readonly layout: MasonryLayout;
  readonly mortarPx: number; readonly bevelPx: number;
  readonly face?: number;                               // face relief amplitude (default 0.25)
  readonly faceFreq?: number;
  readonly tone?: number;                               // per-block tone jitter (default 0.1)
  readonly accentShare?: number;                        // fraction of blocks in the accent colour (burnt bricks)
  readonly veins?: { readonly color: string; readonly freq: number; readonly amount: number };
  readonly speck?: { readonly color: string; readonly amount: number };
  readonly chip?: boolean;
  readonly dome?: number;
  readonly metal?: number;
  readonly moss?: { readonly color: string; readonly amount: number };  // growth in the joints
}

export function masonry(p: MasonryParams): SurfaceRecipe {
  const base = hex(p.base), mortar = hex(p.mortar), accent = col(p.accent, scale3(base, 0.7));
  return recipe(p, {
    height(h, c) {
      const face = tiled(c.noise, p.faceFreq ?? 10, p.faceFreq ?? 10, 1);
      const pit = tiled(c.noise, 64, 64, 2);
      const wob = tiled(c.noise, 20, 20, 3);
      const L = p.layout;
      const ash = L.kind === 'ashlar' ? makeAshlar((a, b) => c.noise.hash21(a, b), L.rows, L.min, L.max, L.rowJitter, L.jointJitter) : null;
      const poly = L.kind === 'polygon' ? tiled(c.noise, L.cells, L.cells, 4) : null;
      const prof = aux(h, 'stone'), sid = aux(h, 'sid');
      const mortarW = px(p, p.mortarPx), bevel = px(p, p.bevelPx);
      each(h, (u, v, i) => {
        let cell: CourseCell;
        if (L.kind === 'courses') cell = courses(u, v + 0.5 / L.rows, L.rows, L.cols, L.offset, L.jitter ?? 0, (a, b) => c.noise.hash21(a, b));
        else if (ash) cell = ash(u, v + 0.07);
        else {
          const w = poly!.worley(u, v, 0.85);
          const e = ((w.f2 - w.f1) / 2) / (L.kind === 'polygon' ? L.cells : 1);
          cell = { id: w.id, edge: e, row: 0, cu: 0.5, cv: 0.5, w: 1, h: 1 };
        }
        const irregular = (wob.fbm(u, v, 3) - 0.5) * px(p, 8);
        const d = cell.edge - mortarW / 2 + irregular;
        let pr = d > 0 ? smoothstep(0, bevel, d) : 0;
        if (p.chip && cell.id > 0.82 && pr > 0) {
          const corner = Math.floor(((cell.id - 0.82) / 0.18) * 4);
          const du = corner & 1 ? 1 - cell.cu : cell.cu, dv = corner & 2 ? 1 - cell.cv : cell.cv;
          const chip = du * cell.w + dv * cell.h;
          if (chip < px(p, 60)) pr *= mix(0.5, 1, smoothstep(px(p, 38), px(p, 60), chip));
        }
        const r2 = ((cell.cu - 0.5) * 2) ** 2 + ((cell.cv - 0.5) * 2) ** 2;
        const top = 0.72 + (p.face ?? 0.25) * (0.7 * face.fbm(u + cell.id * 3, v, 5) + 0.3 * pit.fbm(u, v, 3)) + (p.dome ?? 0) * (1 - Math.min(1, r2));
        h.data[i] = 0.12 + (top - 0.12) * pr;
        prof[i] = pr; sid[i] = cell.id;
      });
    },
    albedo(rgb, h, c) {
      const mott = tiled(c.noise, 9, 9, 5);
      const vein = p.veins ? tiled(c.noise, p.veins.freq, p.veins.freq, 6) : null;
      const vw = tiled(c.noise, 3, 3, 7);
      const sp = p.speck ? tiled(c.noise, 180, 180, 8) : null;
      const mossN = p.moss ? tiled(c.noise, 12, 12, 9) : null;
      const veinC = p.veins ? hex(p.veins.color) : base, speckC = p.speck ? hex(p.speck.color) : base;
      const mossC = p.moss ? hex(p.moss.color) : base;
      const prof = aux(h, 'stone'), sid = aux(h, 'sid');
      const tone = p.tone ?? 0.1;
      each(rgb, (u, v, i) => {
        const id = sid[i]!, pr = prof[i]!;
        const blockC = p.accentShare && ((id * 7.31) % 1) < p.accentShare ? accent : base;
        let st = scale3(hueShift(blockC, ((id * 5.9) % 1 - 0.5) * 8), (1 + (id - 0.5) * 2 * tone) * (0.86 + 0.28 * mott.fbm(u, v, 4)) * (0.9 + 0.1 * h.data[i]!));
        if (vein && p.veins) {
          const n = vein.fbm(u + id * 2, v + vw.fbm(u, v, 2) * 0.3, 4);
          const d = Math.abs(n - 0.5);
          const line = 1 - smoothstep(0.003, 0.016, d);                 // thin veins
          const cloud = 1 - smoothstep(0.0, 0.09, d);                   // soft halo around them
          st = mix3(st, veinC, (line * 0.85 + cloud * 0.2) * p.veins.amount);
        }
        if (sp && p.speck) {
          const s = sp.value(u, v);
          if (s > 1 - p.speck.amount * 0.3) st = mix3(st, speckC, 0.75);
        }
        let cc = mix3(mortar, st, smoothstep(0, 0.3, pr));
        if (mossN && p.moss) cc = mix3(cc, mossC, (1 - smoothstep(0, 0.35, pr)) * smoothstep(0.45, 0.65, mossN.fbm(u, v, 3)) * p.moss.amount);
        setRgb(rgb, i, cc);
      });
    },
    orm(o, h) {
      const prof = aux(h, 'stone');
      for (let i = 0; i < o.rough.length; i++) {
        const pr = prof[i]!;
        o.rough[i] = mix(p.rough[1], p.rough[0], smoothstep(0, 0.4, pr));
        o.ao[i] = mix(0.55, 1, smoothstep(0, 0.45, pr));
        if (p.metal) o.metal[i] = p.metal * smoothstep(0, 0.4, pr);
      }
    },
  });
}

// ─── wood (planks, beams, logs, bark) ───────────────────────────────────────────────────────────

export interface WoodParams extends Common {
  readonly kind: 'planks' | 'log' | 'bark';
  readonly base: string; readonly dark?: string;
  readonly rough: readonly [number, number];
  readonly planks?: number; readonly gapPx?: number; readonly knots?: number;
  readonly grainContrast?: number;                      // default 0.3
  readonly weather?: { readonly color: string; readonly amount: number };   // silvering
  readonly char?: number;                               // alligator char 0..1
  readonly nails?: boolean;
  readonly furrows?: number;                            // bark furrows across u
  readonly moss?: { readonly color: string; readonly amount: number };
}

export function wood(p: WoodParams): SurfaceRecipe {
  const base = hex(p.base), dark = col(p.dark, scale3(base, 0.45));
  const ref = p.hero ? 1024 : 512;
  return recipe(p, {
    height(h, c) {
      const charN = p.char ? tiled(c.noise, 14, 7, 11) : null;
      const chc = aux(h, 'char');
      if (p.kind === 'planks') timberHeight(h, c, p.id, p.planks ?? 4, p.gapPx ?? 3, ref, p.knots ?? 5);
      else if (p.kind === 'log') {
        const g = tiled(c.noise, 2, 30, 1), f = tiled(c.noise, 4, 120, 2), cr = tiled(c.noise, 6, 1, 3);
        const gr = aux(h, 'grain');
        each(h, (u, v, i) => {
          const gg = 0.65 * g.fbm(u, v, 5) + 0.35 * f.fbm(u, v, 3);
          const crack = 1 - smoothstep(0.0, 0.03, Math.abs(cr.fbm(u, v, 4) - 0.5));
          h.data[i] = 0.3 + 0.55 * gg - 0.3 * crack;
          gr[i] = gg;
        });
      } else {
        const fu = p.furrows ?? 14;
        const fib = tiled(c.noise, fu, 2, 1), plate = tiled(c.noise, fu, 3, 2), fine = tiled(c.noise, fu * 4, 8, 3);
        const gr = aux(h, 'grain');
        each(h, (u, v, i) => {
          const w = plate.worley(u, v, 0.85);
          const furrow = 1 - smoothstep(0.03, 0.18, w.f2 - w.f1);
          const gg = fib.fbm(u, v, 5);
          h.data[i] = 0.35 + 0.35 * gg + 0.15 * fine.fbm(u, v, 3) + 0.2 * w.id - 0.65 * furrow;
          gr[i] = furrow;
        });
      }
      if (charN) {
        each(h, (u, v, i) => {
          const w = charN.worley(u, v, 0.8);
          const e = 1 - smoothstep(0.03, 0.1, w.f2 - w.f1);
          const blk = smoothstep(0.0, 0.5, w.f2 - w.f1);
          const amt = p.char!;
          h.data[i] = mix(h.data[i]!, h.data[i]! * 0.6 + 0.3 * blk - 0.4 * e, amt);
          chc[i] = e * amt;
        });
      }
      if (p.nails) {
        const nl = aux(h, 'nail');
        const planks = p.planks ?? 4;
        for (let k = 0; k < planks; k++) {
          for (const uu of [0.12, 0.62]) {
            for (const dv of [-0.18, 0.18]) {
              const cu = uu + c.noise.hash21(k, 3) * 0.2, cv = (k + 1) / planks + dv / planks;
              stamp(h, cu, cv, px(p, 5), px(p, 5), 0, true, (nx, ny, i) => { nl[i] = Math.max(nl[i]!, 1 - Math.sqrt(nx * nx + ny * ny)); });
            }
          }
        }
        for (let i = 0; i < h.data.length; i++) if (nl[i]! > 0) h.data[i] = mix(h.data[i]!, 0.75, smoothstep(0, 0.3, nl[i]!));
      }
      normalize01(h.data);
    },
    albedo(rgb, h, c) {
      const tint = tiled(c.noise, 3, 2, 12);
      const mossN = p.moss ? tiled(c.noise, 4, 4, 13) : null;
      const mossC = p.moss ? hex(p.moss.color) : base;
      const weatherC = p.weather ? hex(p.weather.color) : base;
      const gr = aux(h, 'grain'), pl = aux(h, 'plank'), kn = aux(h, 'knot'), chc = aux(h, 'char'), nl = aux(h, 'nail');
      const gc = p.grainContrast ?? 0.3;
      each(rgb, (u, v, i) => {
        const hh = h.data[i]!;
        const t = tint.fbm(u, v, 3);
        let cc: Vec3;
        if (p.kind === 'bark') cc = mix3(dark, scale3(base, 0.8 + 0.4 * hh), 1 - gr[i]! * 0.8);
        else cc = scale3(base, (1 - gc / 2 + gc * gr[i]!) * (0.92 + 0.16 * pl[i]!) * (1 - 0.35 * kn[i]!));
        cc = scale3(cc, (0.9 + 0.2 * t) * (0.5 + 0.5 * smoothstep(0, 0.25, hh)));
        if (p.weather) cc = mix3(cc, scale3(weatherC, 0.8 + 0.3 * hh), p.weather.amount * (0.6 + 0.4 * t));
        if (p.char) cc = mix3(cc, scale3(hex('#141110'), 0.8 + 0.5 * hh), clamp(p.char * 0.85 + chc[i]! * 0.3, 0, 1));
        if (mossN && p.moss) cc = mix3(cc, mossC, smoothstep(0.55, 0.7, mossN.fbm(u, v, 3)) * p.moss.amount);
        if (nl[i]! > 0) cc = mix3(cc, hex('#3a3633'), smoothstep(0.1, 0.4, nl[i]!));
        setRgb(rgb, i, cc);
      });
    },
    orm(o, h) {
      const nl = aux(h, 'nail');
      for (let i = 0; i < o.rough.length; i++) {
        o.rough[i] = mix(p.rough[0], p.rough[1], 1 - h.data[i]!);
        if (nl[i]! > 0.1) { o.metal[i] = 0.8; o.rough[i] = 0.5; }
      }
    },
  });
}

// ─── metal (plates, rivets, brushed, hammered, patina, rust, grates, windings) ──────────────────

export interface MetalParams extends Common {
  readonly base: string;
  readonly metal: number;
  readonly rough: readonly [number, number];            // [polished, worn/recess]
  readonly panels?: readonly [number, number];          // cols, rows
  readonly seamPx?: number;
  readonly rivets?: { readonly perEdge: number; readonly rPx: number };
  readonly brushed?: { readonly dir: 'u' | 'v'; readonly amount: number };
  readonly hammered?: number;                           // dimple amplitude
  readonly patina?: { readonly color: string; readonly amount: number };  // oxide in recesses (non-metal)
  readonly rust?: { readonly color: string; readonly amount: number };
  readonly grate?: { readonly cols: number; readonly rows: number; readonly bar: number };
  readonly windings?: number;                           // parallel coil grooves along v per tile
  readonly specks?: { readonly color: string; readonly amount: number };  // star iron
  readonly leafSquares?: number;                        // gold leaf: overlapping squares per tile
  readonly tone?: number;
}

export function metal(p: MetalParams): SurfaceRecipe {
  const base = hex(p.base);
  return recipe(p, {
    height(h, c) {
      const br = tiled(c.noise, p.brushed?.dir === 'v' ? 96 : 2, p.brushed?.dir === 'v' ? 2 : 96, 1);
      const ham = tiled(c.noise, 22, 22, 2);
      const mac = tiled(c.noise, 4, 4, 3);
      const rustN = tiled(c.noise, 6, 6, 4);
      const recess = aux(h, 'recess'), riv = aux(h, 'rivet'), pid = aux(h, 'pid'), rust = aux(h, 'rust');
      const seam = px(p, p.seamPx ?? 4);
      each(h, (u, v, i) => {
        let hh = 0.55 + 0.1 * mac.fbm(u, v, 4);
        let rec = 0;
        if (p.brushed) hh += p.brushed.amount * (br.fbm(u, v, 3) - 0.5);
        if (p.hammered) { const w = ham.worley(u, v, 0.9); hh += p.hammered * (w.f1 * w.f1 - 0.25); }
        if (p.panels) {
          const [pc, pr] = p.panels;
          const cc = courses(u, v + 0.5 / pr, pr, pc, 0.5, 0, (a, b) => c.noise.hash21(a, b));
          const e = smoothstep(seam * 0.5, seam * 1.5, cc.edge);
          hh = mix(0.2, hh + 0.05 * (cc.id - 0.5), e);
          rec = Math.max(rec, 1 - e);
          pid[i] = cc.id;
          if (p.rivets) {
            const n = p.rivets.perEdge, rr = px(p, p.rivets.rPx), inset = seam * 2 + rr * 1.8;
            const lu = cc.cu * cc.w, lv = cc.cv * cc.h;
            const du = Math.min(lu, cc.w - lu), dv = Math.min(lv, cc.h - lv);
            const stepU = cc.w / n, stepV = cc.h / n;
            const nearU = Math.abs(((lu + stepU / 2) % stepU) - stepU / 2), nearV = Math.abs(((lv + stepV / 2) % stepV) - stepV / 2);
            const dd = Math.min(Math.hypot(nearU, dv - inset), Math.hypot(du - inset, nearV));
            if (dd < rr) { const d = Math.sqrt(1 - (dd / rr) ** 2); hh = Math.max(hh, 0.55 + 0.4 * d); riv[i] = d; }
          }
        }
        if (p.grate) {
          const { cols, rows, bar } = p.grate;
          const gu = Math.abs(wrapDelta(u * cols)), gv = Math.abs(wrapDelta(v * rows));
          const bu = smoothstep(bar * 0.5, bar * 0.5 + 0.06, gu), bv = smoothstep(bar * 0.5, bar * 0.5 + 0.06, gv);
          const hole = Math.min(bu, bv);
          hh = mix(hh, 0.02, hole);
          rec = Math.max(rec, hole);
        }
        if (p.windings) {
          const ph = v * p.windings;
          const f = ph - Math.floor(ph);
          const groove = Math.sin(f * Math.PI);
          hh = 0.3 + 0.55 * Math.sqrt(Math.max(0, groove)) + 0.05 * (br.fbm(u, v, 2) - 0.5);
          rec = Math.max(rec, 1 - smoothstep(0.0, 0.25, groove));
        }
        if (p.leafSquares) {
          const n = p.leafSquares;
          const cc = courses(u + 0.013, v + 0.021, n, n, 0.37, 0.2, (a, b) => c.noise.hash21(a, b));
          const edge = 1 - smoothstep(px(p, 1), px(p, 3), cc.edge);
          hh += 0.05 * edge + 0.04 * (cc.id - 0.5);
          rec = Math.max(rec, edge * 0.6);
          pid[i] = cc.id;
        }
        recess[i] = rec;
        rust[i] = p.rust ? smoothstep(0.5, 0.75, rustN.fbm(u, v, 5) + rec * 0.25) : 0;
        h.data[i] = hh;
      });
      normalize01(h.data);
    },
    albedo(rgb, h, c) {
      const tint = tiled(c.noise, 5, 5, 6);
      const sp = p.specks ? tiled(c.noise, 170, 170, 7) : null;
      const recess = aux(h, 'recess'), riv = aux(h, 'rivet'), pid = aux(h, 'pid'), rust = aux(h, 'rust');
      const pat = p.patina ? hex(p.patina.color) : base, rst = p.rust ? hex(p.rust.color) : base;
      const spk = p.specks ? hex(p.specks.color) : base;
      const tone = p.tone ?? 0.06;
      each(rgb, (u, v, i) => {
        const t = tint.fbm(u, v, 4);
        let cc = scale3(base, (1 + (pid[i]! - 0.5) * 2 * tone) * (0.9 + 0.2 * t) * (0.88 + 0.2 * h.data[i]!) * (1 + 0.1 * riv[i]!));
        cc = scale3(cc, 1 - 0.45 * recess[i]!);
        if (p.patina) cc = mix3(cc, scale3(pat, 0.85 + 0.3 * t), clamp(p.patina.amount * (0.5 + 0.5 * recess[i]!) * (0.3 + 1.4 * t), 0, 1));
        if (p.rust) cc = mix3(cc, scale3(rst, 0.8 + 0.4 * t), rust[i]! * p.rust.amount);
        if (sp && p.specks && sp.value(u, v) > 1 - p.specks.amount * 0.2) cc = mix3(cc, spk, 0.85);
        setRgb(rgb, i, cc);
      });
    },
    orm(o, h, c) {
      const recess = aux(h, 'recess'), riv = aux(h, 'rivet'), rust = aux(h, 'rust');
      const tint = tiled(c.noise, 5, 5, 6);
      each(o, (u, v, i) => {
        const worn = Math.max(recess[i]!, rust[i]! * (p.rust?.amount ?? 0));
        o.rough[i] = mix(p.rough[0], p.rough[1], clamp(worn + (tint.fbm(u, v, 3) - 0.5) * 0.3, 0, 1)) - 0.08 * riv[i]!;
        const patinaCover = p.patina ? clamp(p.patina.amount * (0.5 + 0.5 * recess[i]!) * (0.3 + 1.4 * tint.fbm(u, v, 4)), 0, 1) : 0;
        o.metal[i] = p.metal * (1 - patinaCover * 0.8) * (1 - rust[i]! * (p.rust?.amount ?? 0));
        o.ao[i] = 1 - 0.5 * recess[i]!;
      });
    },
  });
}

// ─── cloth / rope ───────────────────────────────────────────────────────────────────────────────

export interface ClothParams extends Common {
  readonly kind: 'weave' | 'rope';
  readonly base: string; readonly accent?: string;
  readonly rough: number;
  readonly weave?: readonly [number, number];           // threads per tile (u, v)
  readonly seams?: number;                              // panel seams along v
  readonly card?: 'sail' | 'banner' | 'flags';
  readonly strands?: number;                            // rope strands per tile along v
}

export function cloth(p: ClothParams): SurfaceRecipe {
  const base = hex(p.base), accent = col(p.accent, hueShift(scale3(base, 1.1), 30));
  return recipe(p, {
    height(h, c) {
      const mac = tiled(c.noise, 3, 3, 1), fz = tiled(c.noise, 64, 64, 2);
      const shape = aux(h, 'alpha', 1), stripe = aux(h, 'stripe'), flag = aux(h, 'flag', -1);
      const [wu, wv] = p.weave ?? [160, 160];
      each(h, (u, v, i) => {
        let hh: number;
        if (p.kind === 'rope') {
          const n = p.strands ?? 6;
          const ph = (((v * n + u * 3) % 1) + 1) % 1;
          const s = Math.sin(ph * Math.PI);
          hh = 0.2 + 0.7 * Math.sqrt(Math.max(0, s)) + 0.1 * fz.fbm(u, v, 3);
          hh += 0.06 * (Math.sin((v * n * 9 + u * 27) * TAU) * 0.5 + 0.5);
          stripe[i] = 1 - s;
        } else {
          const tu = Math.sin(u * wu * Math.PI), tv = Math.sin(v * wv * Math.PI);
          const over = ((Math.floor(u * wu) + Math.floor(v * wv)) & 1) === 0;
          const thread = over ? Math.abs(tu) : Math.abs(tv);
          hh = 0.45 + 0.25 * thread + 0.2 * mac.fbm(u, v, 4) + 0.06 * fz.fbm(u, v, 2);
          if (p.seams) {
            const sd = Math.abs(wrapDelta(v * p.seams - 0.5)) / p.seams;
            hh += 0.18 * (1 - smoothstep(px(p, 2), px(p, 5), sd)) - 0.1 * (1 - smoothstep(0, px(p, 2), sd));
          }
        }
        if (p.card === 'sail') {
          const edge = Math.min(u, 1 - u, v, 1 - v);
          shape[i] = edge < 0.012 + 0.01 * fz.fbm(u, v, 3) ? 0 : 1;
          if (edge < 0.04) { hh += 0.15; stripe[i] = 1; }
        } else if (p.card === 'banner') {
          const tail = v < 0.18 ? Math.abs(u - 0.5) * 2 < (0.18 - v) / 0.18 : false;   // swallowtail notch at the bottom (v = 0)
          shape[i] = tail || u < 0.08 || u > 0.92 || v > 0.95 ? 0 : 1;
          const border = Math.min(u - 0.08, 0.92 - u, 0.95 - v) < 0.035;
          const r = Math.hypot(u - 0.5, (v - 0.58) * 1.1);
          stripe[i] = border || (r < 0.14 && r > 0.1) ? 1 : 0;
        } else if (p.card === 'flags') {
          const cordV = 0.9 + 0.03 * Math.sin(u * Math.PI);
          const onCord = Math.abs(v - cordV) < 0.006;
          const k = Math.floor(u * 5), fu = u * 5 - k;
          const bottom = cordV - 0.55 - 0.05 * Math.sin(k * 2.1);
          const inFlag = fu > 0.1 && fu < 0.9 && v < cordV && v > bottom;
          shape[i] = onCord || inFlag ? 1 : 0;
          flag[i] = inFlag ? k : -1;
          if (onCord) hh = 0.8;
        }
        h.data[i] = clamp(hh, 0, 1);
      });
    },
    albedo(rgb, h, c) {
      const card0 = p.card ? card(rgb) : null;
      const tint = tiled(c.noise, 4, 4, 5);
      const shape = aux(h, 'alpha', 1), stripe = aux(h, 'stripe'), flag = aux(h, 'flag', -1);
      const flagHue = [0, 38, 95, 205, 0];
      each(rgb, (u, v, i) => {
        const t = tint.fbm(u, v, 3);
        let cc = scale3(base, (0.82 + 0.3 * h.data[i]!) * (0.9 + 0.2 * t));
        if (p.kind === 'rope') cc = scale3(cc, 1 - 0.4 * stripe[i]!);
        else if (stripe[i]! > 0.5) cc = scale3(accent, 0.85 + 0.25 * h.data[i]!);
        const f = flag[i]!;
        if (f >= 0) cc = f === 4 ? scale3(hex('#d8d2c2'), 0.8 + 0.25 * h.data[i]!) : hueShift(cc, flagHue[f]!);
        setRgb(rgb, i, cc);
        if (card0) card0.alpha[i] = shape[i]!;
      });
    },
    orm(o) { o.rough.fill(p.rough); },
  });
}

// ─── glass / wax / obsidian (smooth, low-rough) ─────────────────────────────────────────────────

export interface GlassParams extends Common {
  readonly pattern: 'frost' | 'mist' | 'ribbed' | 'fulgurite' | 'stained' | 'rings' | 'obsidian' | 'wax';
  readonly base: string; readonly accent?: string;
  readonly rough: readonly [number, number];            // [glass, frame/matte]
  readonly frameMetal?: number;
  readonly cells?: number;
  readonly palette?: readonly string[];
}

export function glass(p: GlassParams): SurfaceRecipe {
  const base = hex(p.base), accent = col(p.accent, scale3(base, 1.2));
  return recipe(p, {
    height(h, c) {
      const n1 = tiled(c.noise, 6, 6, 1), n2 = tiled(c.noise, 24, 24, 2), cellsN = tiled(c.noise, p.cells ?? 6, p.cells ?? 6, 3);
      const drips = tiled(c.noise, 9, 1, 4);
      const frame = aux(h, 'frame'), feat = aux(h, 'feat'), cid = aux(h, 'cid');
      each(h, (u, v, i) => {
        let hh = 0.5, fr = 0, ft = 0;
        switch (p.pattern) {
          case 'frost': {
            // feathery ice: ridged noise at two scales, gathered along crystal-cell borders
            const w = cellsN.worley(u, v, 0.9);
            const r1 = 1 - Math.abs(n2.fbm(u, v, 3) - 0.5) * 2, r2 = 1 - Math.abs(n1.fbm(u + 0.4, v, 4) - 0.5) * 2;
            const border = 1 - smoothstep(0.0, 0.25, w.f2 - w.f1);
            ft = clamp(smoothstep(0.75, 0.97, r1) * (0.4 + 0.6 * border) + 0.5 * smoothstep(0.85, 0.98, r2), 0, 1);
            hh = 0.45 + 0.3 * ft;
            break;
          }
          case 'mist': {
            const du = Math.abs(wrapDelta(u)), dv = Math.abs(wrapDelta(v));
            fr = 1 - smoothstep(px(p, 10), px(p, 16), Math.min(du, dv));
            ft = n1.fbm(u + n2.fbm(u, v, 2) * 0.2, v, 5);
            hh = mix(0.5 + 0.1 * ft, 1, fr);
            break;
          }
          case 'ribbed': {
            const r = Math.sin(v * 12 * TAU);
            hh = 0.5 + 0.35 * r + 0.03 * n2.fbm(u, v, 2);
            ft = 0.5 + 0.5 * r;
            break;
          }
          case 'fulgurite': {
            const a = Math.abs(n1.fbm(u, v, 4) - 0.5), b = Math.abs(n2.fbm(u + 0.3, v, 3) - 0.5);
            ft = (1 - smoothstep(0.0, 0.04, a)) + 0.6 * (1 - smoothstep(0.0, 0.03, b));
            hh = 0.55 - 0.3 * Math.min(1, ft) + 0.05 * n2.fbm(u, v, 3);
            break;
          }
          case 'stained': {
            const w = cellsN.worley(u, v, 0.9);
            fr = 1 - smoothstep(0.04, 0.08, w.f2 - w.f1);
            hh = mix(0.5 + 0.06 * n2.fbm(u, v, 3), 0.9, fr);
            cid[i] = w.id;
            break;
          }
          case 'rings': {
            const d = Math.hypot(wrapDelta(u), wrapDelta(v));
            const r = Math.sin(d * 18 * TAU);
            ft = smoothstep(0.6, 1, r);
            hh = 0.5 + 0.25 * r;
            break;
          }
          case 'obsidian': {
            const w = cellsN.worley(u, v, 1);
            const conch = Math.sin(w.f1 * 22 + n1.fbm(u, v, 3) * 4);
            hh = 0.5 + 0.12 * conch * (1 - w.f1) + 0.25 * w.id - 0.3 * (1 - smoothstep(0.01, 0.05, w.f2 - w.f1));
            ft = w.id;
            break;
          }
          case 'wax': {
            const drip = smoothstep(0.45, 0.7, drips.fbm(u, v, 3));
            hh = 0.4 + 0.4 * drip + 0.12 * n1.fbm(u, v, 4);
            ft = drip;
            break;
          }
        }
        h.data[i] = clamp(hh, 0, 1);
        frame[i] = fr; feat[i] = clamp(ft, 0, 1);
      });
    },
    albedo(rgb, h, c) {
      const tint = tiled(c.noise, 3, 3, 5);
      const frame = aux(h, 'frame'), feat = aux(h, 'feat'), cid = aux(h, 'cid');
      const pal = (p.palette ?? []).map(hex);
      const frameC = hex('#2a2622');
      each(rgb, (u, v, i) => {
        const t = tint.fbm(u, v, 3);
        let cc = scale3(base, 0.92 + 0.16 * t);
        if (p.pattern === 'stained' && pal.length) cc = scale3(pal[Math.floor(cid[i]! * pal.length) % pal.length]!, 0.9 + 0.2 * t);
        cc = mix3(cc, accent, feat[i]! * (p.pattern === 'obsidian' ? 0.25 : 0.5));
        cc = mix3(cc, frameC, frame[i]!);
        setRgb(rgb, i, cc);
      });
    },
    orm(o, h) {
      const frame = aux(h, 'frame'), feat = aux(h, 'feat');
      for (let i = 0; i < o.rough.length; i++) {
        const f = frame[i]!;
        o.rough[i] = mix(p.rough[0], p.rough[1], Math.max(f, p.pattern === 'frost' ? feat[i]! * 0.7 : 0));
        o.metal[i] = (p.frameMetal ?? 0) * f;
      }
    },
  });
}

// ─── crystal / ore ─────────────────────────────────────────────────────────────────────────────

export interface CrystalParams extends Common {
  readonly kind: 'blades' | 'shards' | 'ore';
  readonly base: string; readonly light: string; readonly dark: string;
  readonly rough: readonly [number, number];
  readonly cells: number;
}

export function crystal(p: CrystalParams): SurfaceRecipe {
  const base = hex(p.base), light = hex(p.light), dark = hex(p.dark);
  return recipe(p, {
    height(h, c) {
      const aspect = p.kind === 'blades' ? 4 : 1;
      const cellsN = tiled(c.noise, p.cells, p.cells * aspect, 1);
      const n1 = tiled(c.noise, 5, 5, 2), vein = tiled(c.noise, 4, 4, 3), det = tiled(c.noise, 40, 40, 4);
      const feat = aux(h, 'feat'), fid = aux(h, 'fid');
      each(h, (u, v, i) => {
        if (p.kind === 'ore') {
          const vv = 1 - smoothstep(0.004, 0.03, Math.abs(vein.fbm(u, v, 4) - 0.5));   // thin ridged veins
          h.data[i] = 0.35 + 0.35 * n1.fbm(u, v, 5) + 0.12 * det.fbm(u, v, 3) + 0.25 * vv;
          feat[i] = vv;
          return;
        }
        const w = cellsN.worley(u, v, 0.95);
        const e = w.f2 - w.f1;
        h.data[i] = 0.35 + 0.45 * smoothstep(0, 0.6, e) + 0.2 * w.id + 0.04 * det.fbm(u, v, 2);
        feat[i] = 1 - smoothstep(0.0, 0.08, e);
        fid[i] = w.id;
      });
      normalize01(h.data);
    },
    albedo(rgb, h, c) {
      const tint = tiled(c.noise, 4, 4, 5);
      const feat = aux(h, 'feat'), fid = aux(h, 'fid');
      each(rgb, (u, v, i) => {
        const t = tint.fbm(u, v, 3), hh = h.data[i]!;
        let cc = mix3(dark, base, smoothstep(0.15, 0.75, hh));
        cc = scale3(hueShift(cc, (fid[i]! - 0.5) * 16), 0.88 + 0.24 * t);
        cc = mix3(cc, light, feat[i]! * (p.kind === 'ore' ? 0.95 : 0.7));
        setRgb(rgb, i, cc);
      });
    },
    orm(o, h) {
      const feat = aux(h, 'feat');
      for (let i = 0; i < o.rough.length; i++) {
        o.rough[i] = p.kind === 'ore' ? mix(p.rough[1], p.rough[0], feat[i]!) : mix(p.rough[0], p.rough[1], 1 - h.data[i]!);
      }
    },
  });
}

// ─── lava / coal ───────────────────────────────────────────────────────────────────────────────

export interface LavaParams extends Common {
  readonly kind: 'crust' | 'molten' | 'coal';
  readonly crust: string; readonly hot: string;
  readonly rough: readonly [number, number];            // [crust, hot]
  readonly cells: number;
}

export function lava(p: LavaParams): SurfaceRecipe {
  const crust = hex(p.crust), hot = hex(p.hot);
  return recipe(p, {
    height(h, c) {
      const cellsN = tiled(c.noise, p.cells, p.cells, 1), n1 = tiled(c.noise, 6, 6, 2), det = tiled(c.noise, 48, 48, 3), flow = tiled(c.noise, 3, 3, 4);
      const heat = aux(h, 'heat');
      each(h, (u, v, i) => {
        const w = cellsN.worley(u + (flow.fbm(u, v, 3) - 0.5) * 0.15, v, 0.9);
        const e = w.f2 - w.f1;
        let hh: number, ht: number;
        if (p.kind === 'crust') {
          ht = 1 - smoothstep(0.02, 0.12, e);
          hh = 0.55 + 0.2 * w.id + 0.15 * n1.fbm(u, v, 5) + 0.1 * det.fbm(u, v, 3) - 0.5 * ht;
        } else if (p.kind === 'molten') {
          const island = smoothstep(0.12, 0.3, e + 0.3 * (n1.fbm(u, v, 4) - 0.5)) * (w.id > 0.3 ? 1 : 0);
          const streak = flow.fbm(u * 1, v, 4);
          ht = (1 - island) * (0.75 + 0.25 * Math.sin((u * 3 + streak * 2) * TAU * 2));
          hh = 0.3 + 0.15 * n1.fbm(u, v, 4) + 0.4 * island + 0.08 * det.fbm(u, v, 3);
        } else {
          const lump = Math.sqrt(sat(1 - w.f1 * 1.4));
          ht = 1 - smoothstep(0.0, 0.25, lump);
          hh = 0.1 + 0.8 * lump + 0.08 * det.fbm(u, v, 3);
        }
        h.data[i] = clamp(hh, 0, 1);
        heat[i] = ht;
      });
    },
    albedo(rgb, h, c) {
      const tint = tiled(c.noise, 5, 5, 5);
      const heat = aux(h, 'heat');
      each(rgb, (u, v, i) => {
        const t = tint.fbm(u, v, 3);
        setRgb(rgb, i, mix3(scale3(crust, (0.7 + 0.5 * h.data[i]!) * (0.9 + 0.2 * t)), scale3(hot, 0.85 + 0.3 * t), heat[i]!));
      });
    },
    orm(o, h) {
      const heat = aux(h, 'heat');
      for (let i = 0; i < o.rough.length; i++) o.rough[i] = mix(p.rough[0], p.rough[1], heat[i]!);
    },
  });
}

// ─── water ─────────────────────────────────────────────────────────────────────────────────────

export interface WaterParams extends Common {
  readonly base: string;
  readonly rough: number;
  readonly waves: readonly (readonly [number, number, number])[];   // [kx, ky, weight], integer wave vectors
  readonly chop?: number;
  readonly scum?: { readonly color: string; readonly amount: number };
}

export function water(p: WaterParams): SurfaceRecipe {
  const base = hex(p.base);
  return recipe(p, {
    height(h, c) {
      const warp = tiled(c.noise, 3, 3, 1), chop = tiled(c.noise, 16, 16, 2);
      const tot = p.waves.reduce((a, w) => a + w[2], 0);
      each(h, (u, v, i) => {
        let s = 0;
        for (let k = 0; k < p.waves.length; k++) {
          const [kx, ky, wt] = p.waves[k]!;
          s += wt * Math.sin(TAU * (kx * u + ky * v) + warp.fbm(u + k * 0.37, v, 3) * TAU * 0.7);
        }
        h.data[i] = clamp(0.5 + 0.45 * (s / tot) + (p.chop ?? 0) * (chop.fbm(u, v, 3) - 0.5), 0, 1);
      });
    },
    albedo(rgb, h, c) {
      const sc = p.scum ? tiled(c.noise, 10, 10, 3) : null;
      const scC = p.scum ? hex(p.scum.color) : base;
      const tint = tiled(c.noise, 2, 2, 4);
      each(rgb, (u, v, i) => {
        let cc = scale3(base, 0.96 + 0.08 * tint.fbm(u, v, 2));
        if (sc && p.scum) cc = mix3(cc, scC, smoothstep(0.58, 0.68, sc.fbm(u, v, 4)) * p.scum.amount);
        setRgb(rgb, i, cc);
      });
    },
    orm(o, _h, c) {
      const sc = p.scum ? tiled(c.noise, 10, 10, 3) : null;
      each(o, (u, v, i) => {
        o.rough[i] = sc && p.scum ? mix(p.rough, 0.8, smoothstep(0.58, 0.68, sc.fbm(u, v, 4)) * p.scum.amount) : p.rough;   // matte scum
      });
    },
  });
}

// ─── foliage cards and hedges ───────────────────────────────────────────────────────────────────

export interface FoliageParams extends Common {
  readonly kind: 'willow' | 'pine' | 'hedge';
  readonly base: string;
  readonly rough: number;
  readonly count: number;
}

export function foliage(p: FoliageParams): SurfaceRecipe {
  const base = hex(p.base);
  const isCard = p.kind !== 'hedge';
  return recipe({ ...p, wrap: isCard ? 'clamp' : 'repeat' }, {
    height(h, c) {
      const r = c.noise.rng(`${p.id}:foliage`);
      const top = aux(h, 'leaf', -1), tone = aux(h, 'tone'), ax = aux(h, 'ax');
      const wrap = !isCard;
      let id = 0;
      const leaf = (cu: number, cv: number, len: number, wid: number, ang: number): void => {
        const my = id++;
        const tn = r();
        if (my < tone.length) tone[my] = tn;
        stamp(h, cu, cv, wid / 2, len / 2, ang, wrap, (nx, ny, i) => {
          const t = (ny + 1) / 2;
          const halfW = Math.sin(Math.PI * Math.pow(t, 0.85));
          if (Math.abs(nx) > halfW) return;
          const a = Math.abs(nx) / Math.max(halfW, 1e-3);
          h.data[i] = Math.min(1, 0.45 + 0.3 * Math.sqrt(Math.max(0, 1 - a * a)) + 0.15 * (1 - smoothstep(0, 0.12, a)));
          top[i] = my; ax[i] = a;
        });
      };
      if (p.kind === 'willow') {
        for (let s = 0; s < p.count; s++) {
          const u0 = 0.05 + r() * 0.9, len = 0.5 + r() * 0.45;
          let su = u0, sv = 0.99;
          const steps = 26;
          for (let k = 0; k < steps; k++) {
            const nu = su + (r() - 0.5) * 0.01, nv = sv - len / steps;
            stroke(h, su, sv, Math.PI + Math.atan2(nu - su, sv - nv), len / steps, px(p, 2), px(p, 2), false, (_t, _a, i) => { h.data[i] = 0.5; top[i] = -2; });
            if (k % 2 === 0) {
              const side = k % 4 === 0 ? 1 : -1;
              const ll = 0.05 + r() * 0.03;
              leaf(su + side * ll * 0.3, sv - ll * 0.35, ll, ll * 0.22, Math.PI + side * 0.5);
            }
            su = nu; sv = nv;
          }
        }
      } else if (p.kind === 'pine') {
        for (let b = 0; b < p.count; b++) {
          const v0 = 0.1 + r() * 0.8, ang = Math.PI / 2 + (r() - 0.5) * 0.4;
          const len = 0.6 + r() * 0.35;
          const my = id++;
          tone[my] = r();
          stroke(h, 0.02, v0, ang, len, px(p, 5), px(p, 2), false, (_t, _a, i) => { h.data[i] = 0.55; top[i] = -2; });
          for (let k = 0; k < 60; k++) {
            const t = k / 60, bu = 0.02 + Math.sin(ang) * len * t, bv = v0 + Math.cos(ang) * len * t;
            for (const side of [-1, 1]) {
              const nl = (0.07 + r() * 0.03) * (1 - 0.4 * t);
              const na = ang + side * (0.9 + r() * 0.3);
              stroke(h, bu, bv, na, nl, px(p, 1.6), px(p, 0.8), false, (_tt, a, i) => {
                h.data[i] = 0.5 + 0.2 * (1 - Math.abs(a)); top[i] = my; ax[i] = Math.abs(a);
              });
            }
          }
        }
      } else {
        const bg = tiled(c.noise, 8, 8, 1);
        each(h, (u, v, i) => { h.data[i] = 0.15 * bg.fbm(u, v, 4); });
        for (let k = 0; k < p.count; k++) {
          const len = 0.035 + r() * 0.03;
          leaf(r(), r(), len, len * 0.42, r() * TAU);
        }
      }
    },
    albedo(rgb, h, c) {
      const cardRgb = isCard ? card(rgb) : null;
      const tint = tiled(c.noise, 3, 3, 2);
      const top = aux(h, 'leaf', -1), tone = aux(h, 'tone'), ax = aux(h, 'ax');
      const stem = scale3(hueShift(base, 25), 0.6);
      each(rgb, (u, v, i) => {
        const li = top[i]!;
        const t = tint.fbm(u, v, 3);
        if (li === -1) {
          setRgb(rgb, i, scale3(base, isCard ? 0.8 : 0.3 + 0.3 * t));
          if (cardRgb) cardRgb.alpha[i] = 0;
          return;
        }
        let cc: Vec3;
        if (li === -2) cc = stem;
        else {
          const tn = tone[li]!;
          cc = scale3(hueShift(base, (tn - 0.5) * 14), (0.85 + 0.3 * tn) * (0.75 + 0.4 * h.data[i]!));
          cc = mix3(cc, hueShift(scale3(base, 1.1), 12), smoothstep(0.8, 1, ax[i]!) * 0.3);
        }
        setRgb(rgb, i, cc);
        if (cardRgb) cardRgb.alpha[i] = 1;
      });
    },
    orm(o, h) {
      const top = aux(h, 'leaf', -1);
      for (let i = 0; i < o.rough.length; i++) {
        o.rough[i] = p.rough;
        o.ao[i] = top[i]! === -1 ? (isCard ? 1 : 0.45) : 1;
      }
    },
  });
}

// ─── scales (dragon tiles) ─────────────────────────────────────────────────────────────────────

export interface ScaleParams extends Common {
  readonly base: string; readonly edge: string;
  readonly rough: readonly [number, number];
  readonly rows: number; readonly cols: number;
}

export function scales(p: ScaleParams): SurfaceRecipe {
  const base = hex(p.base), edge = hex(p.edge);
  return recipe(p, {
    height(h, c) {
      const det = tiled(c.noise, 40, 40, 1);
      const sid = aux(h, 'sid'), rim = aux(h, 'rim');
      each(h, (u, v, i) => {
        // overlapping round scales, rows offset by half; the scale of the higher row lies on top
        let best = -Infinity, bid = 0, brim = 1, bd = 1;
        const fv = v * p.rows;
        const r0 = Math.floor(fv);
        for (let dr = -1; dr <= 1; dr++) {
          const row = r0 + dr;
          const rr = ((row % p.rows) + p.rows) % p.rows;
          const fu = u * p.cols - (rr % 2) * 0.5;
          for (let dc = -1; dc <= 1; dc++) {
            const cc = Math.floor(fu) + dc;
            const du = cc + 0.5 - fu, dv = (row + 1 - fv) * 1.15;
            const d = Math.hypot(du, dv);
            if (d < 0.7 && dv >= -0.05 && row > best) {
              best = row;
              bid = c.noise.hash21(((cc % p.cols) + p.cols) % p.cols, rr);
              brim = smoothstep(0.52, 0.7, d);
              bd = d;
            }
          }
        }
        h.data[i] = clamp(0.35 + 0.5 * (1 - bd / 0.7) + 0.05 * det.fbm(u, v, 2) + 0.08 * bid, 0, 1);
        sid[i] = bid; rim[i] = brim;
      });
    },
    albedo(rgb, h) {
      const sid = aux(h, 'sid'), rim = aux(h, 'rim');
      each(rgb, (_u, _v, i) => {
        const id = sid[i]!;
        const cc = mix3(scale3(hueShift(base, (id - 0.5) * 16), 0.85 + 0.3 * id), edge, rim[i]! * 0.8);
        setRgb(rgb, i, scale3(cc, 0.8 + 0.3 * h.data[i]!));
      });
    },
    orm(o, h) {
      const rim = aux(h, 'rim');
      for (let i = 0; i < o.rough.length; i++) {
        o.rough[i] = mix(p.rough[0], p.rough[1], rim[i]!);
        o.ao[i] = 1 - 0.4 * rim[i]!;
      }
    },
  });
}

export { crackWalk };
