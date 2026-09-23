/**
 * The 15 Mirevale-slice recipes (SPEC §40.3.6). `metres`, `hero`, `normalStrength` are fixed by the table;
 * pixel numbers are at the reference size (1024 for hero surfaces, 512 otherwise, see `refSize`).
 * Axis convention: u across, v along (v = 0 is the first texture row; for trunks and cards v = 0 is the base).
 */
import type { SurfaceRecipe } from '../recipe';
import { card, leafLayout, timberHeight } from './families';
import {
  TAU, aux, clamp, courses, crackWalk, each, hex, hueShift, makeAshlar, mix, mix3, normalize01, sat, scale3, sdRoundRect,
  setRgb, smoothstep, stamp, stroke, tiled, wrapDelta,
} from './lib';
import type { Vec3 } from './lib';

export const FILE = 'recipes/grove.ts';

// ─── grove_bark ─────────────────────────────────────────────────────────────────────────────────
const grove_bark: SurfaceRecipe = {
  id: 'grove_bark', hero: true, metres: 2, normalStrength: 0.7, wrap: 'repeat', rdo: 4,
  height(h, c) {
    // vertical fibre (the table's fbm2(x·2, y·18) with x = along the trunk), warped by one sine per tile
    const fib = tiled(c.noise, 18, 2);
    const fine = tiled(c.noise, 64, 6, 3);
    const wob = tiled(c.noise, 4, 2, 5);
    const crk = tiled(c.noise, 40, 3, 7);
    const cr = aux(h, 'crack');
    each(h, (u, v, i) => {
      const warp = Math.sin(v * TAU) * 0.012 + (wob.fbm(u, v, 3) - 0.5) * 0.02;
      const uu = u + warp;
      const fibre = fib.fbm(uu, v, 5);
      const grain = fine.fbm(uu, v, 3);
      const w = crk.worley(uu, v, 0.85);
      const edge = w.f2 - w.f1;                      // cell units across; cracks where f2 − f1 < 0.04 (× local width jitter)
      const crack = 1 - smoothstep(0.02, 0.1 + 0.08 * w.id, edge);
      const plate = 0.25 * w.id;                     // each bark plate sits at its own height
      h.data[i] = 0.35 + 0.45 * fibre + 0.12 * grain + plate - 0.6 * crack;
      cr[i] = crack;
    });
    normalize01(h.data);
  },
  albedo(rgb, h, c) {
    const base = hex('#5a4632'), moss = hex('#4a6b33');
    const m = tiled(c.noise, 3, 3, 11);
    const fuzz = tiled(c.noise, 90, 60, 12);
    const tone = tiled(c.noise, 6, 1, 13);
    const cr = aux(h, 'crack');
    each(rgb, (u, v, i) => {
      const hh = h.data[i]!;
      let col = scale3(base, (0.8 + 0.4 * hh) * (0.9 + 0.2 * tone.fbm(u, v, 2)) * (1 - 0.4 * cr[i]!));
      // moss in the lower 30 % of V; faded in at v = 0 too so the wrap seam holds
      const band = smoothstep(0.0, 0.06, v) * (1 - smoothstep(0.22, 0.3, v));
      const mm = smoothstep(0.58, 0.66, m.fbm(u, v, 3) + (fuzz.value(u, v) - 0.5) * 0.08) * band * (0.55 + 0.45 * hh);
      col = mix3(col, scale3(moss, 0.85 + 0.3 * hh), mm);
      setRgb(rgb, i, col);
    });
  },
  orm(o, h) {
    for (let i = 0; i < o.rough.length; i++) o.rough[i] = 0.78 + 0.14 * (1 - h.data[i]!);
  },
};

// ─── grove_leaf_canopy (card) ─────────────────────────────────────────────────────────────────
const grove_leaf_canopy: SurfaceRecipe = {
  id: 'grove_leaf_canopy', hero: false, metres: 1, normalStrength: 0.45, wrap: 'clamp', rdo: 4,
  height(h) {
    const leaves = leafLayout('grove_leaf_canopy', 3, 48, [0.09, 0.15]);
    const cov = aux(h, 'cov'), top = aux(h, 'top', -1), clusterCov = aux(h, 'ccov'), edge = aux(h, 'edge');
    let li = 0;
    for (const L of leaves) {
      const bit = 1 << L.cluster;
      // the ellipse frame: x along the leaf (−1 base … +1 tip), angle 0 = +v in stamp() terms
      stamp(h, L.cu, L.cv, L.wid / 2, L.len / 2, L.ang, false, (nx, ny, i) => {
        // leaf outline: pointed tip, rounded base (taper the half-width along the axis)
        const t = (ny + 1) / 2;                       // 0 base … 1 tip
        const halfW = Math.sin(Math.PI * Math.pow(t, 0.8)) * 1.0;
        if (Math.abs(nx) > halfW) return;
        const ax = Math.abs(nx) / Math.max(halfW, 1e-3);
        const dome = 0.45 + 0.25 * Math.sqrt(Math.max(0, 1 - ax * ax));
        const midrib = 0.18 * (1 - smoothstep(0, 0.1, ax));
        const veins = Math.abs(Math.sin(Math.atan2(nx, ny + 1) * 7)) * 0.3 * (1 - ax) * 0.5;
        h.data[i] = Math.min(1, dome + midrib + veins);
        cov[i] = cov[i]! + 1;
        clusterCov[i] = (clusterCov[i]! | bit);
        top[i] = li;
        edge[i] = ax;
      });
      li++;
    }
    aux(h, 'meta')[0] = leaves.length;
    const tones = aux(h, 'tones');
    leaves.forEach((L, k) => { if (k < tones.length) tones[k] = L.cluster + L.tone * 0.999; });
  },
  albedo(rgb, h) {
    const a = card(rgb);
    const base = hex('#4f7a3a');
    const top = aux(h, 'top', -1), tones = aux(h, 'tones'), edge = aux(h, 'edge');
    const hues = [-6, 1, 6];
    each(rgb, (_u, _v, i) => {
      const li = top[i]!;
      if (li < 0) { setRgb(rgb, i, scale3(base, 0.8)); a.alpha[i] = 0; return; }
      const tv = tones[li]!;
      const cluster = Math.floor(tv), tone = tv - cluster;
      let col = hueShift(base, hues[cluster]! + (tone - 0.5) * 4);
      col = scale3(col, 0.9 + 0.18 * tone);
      const hh = h.data[i]!;
      col = scale3(col, 0.8 + 0.35 * hh);
      col = mix3(col, hueShift(scale3(base, 1.08), 10), smoothstep(0.75, 1, edge[i]!) * 0.35); // yellower rims
      setRgb(rgb, i, col);
      a.alpha[i] = 1;
    });
  },
  orm(o, h) {
    const ccov = aux(h, 'ccov'), cov = aux(h, 'cov');
    for (let i = 0; i < o.ao.length; i++) {
      const bits = ccov[i]!;
      const clusters = (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
      o.ao[i] = clusters >= 2 ? 0.7 : cov[i]! >= 2 ? 0.85 : 1;
      o.rough[i] = 0.62;
    }
  },
};

// ─── grove_moss ─────────────────────────────────────────────────────────────────────────────────
const grove_moss: SurfaceRecipe = {
  id: 'grove_moss', hero: true, metres: 3, normalStrength: 0.55, wrap: 'repeat', rdo: 4,
  height(h, c) {
    const n = tiled(c.noise, 6, 6);
    each(h, (u, v, i) => { h.data[i] = n.fbm(u, v, 6) * 0.7; });
    const domes = aux(h, 'domes');
    const r = c.noise.rng('grove_moss');
    for (let k = 0; k < 3000; k++) {
      const cu = r(), cv = r(), rad = (4 + r() * 5) / 1024;
      stamp(h, cu, cv, rad, rad, 0, true, (nx, ny, i) => {
        const p = 0.5 * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        if (p > domes[i]!) domes[i] = p;
      });
    }
    for (let i = 0; i < h.data.length; i++) h.data[i] = h.data[i]! + domes[i]!;
    normalize01(h.data);
  },
  albedo(rgb, h, c) {
    const base = hex('#4a6b33');
    const tint = tiled(c.noise, 3, 3, 9);
    const patch = tiled(c.noise, 7, 7, 10);
    const tip = hueShift(scale3(base, 1.15), 14);
    each(rgb, (u, v, i) => {
      const hh = h.data[i]!;
      const valley = 0.8 + 0.2 * smoothstep(0.25, 0.6, hh);          // −20 % in the valleys
      const t = tint.fbm(u, v, 3), p = patch.fbm(u, v, 3);
      let col = hueShift(base, (t - 0.5) * 18);
      col = mix3(col, tip, smoothstep(0.62, 0.95, hh) * 0.6);
      setRgb(rgb, i, col, valley * (0.86 + 0.26 * t) * (0.9 + 0.2 * p));
    });
  },
  orm(o) { o.rough.fill(0.88); },
};

// ─── path_gravel ───────────────────────────────────────────────────────────────────────────────
const GRAVEL_CELLS = 71;          // 71² ≈ 5 000 pebbles
const path_gravel: SurfaceRecipe = {
  id: 'path_gravel', hero: true, metres: 3, normalStrength: 0.8, wrap: 'repeat', rdo: 4,
  height(h, c) {
    const cells = tiled(c.noise, GRAVEL_CELLS, GRAVEL_CELLS, 1);
    const sand = tiled(c.noise, 4, 4, 2);
    const grit = tiled(c.noise, 96, 96, 3);
    const fall = (3 / 1024) * GRAVEL_CELLS;                            // 3 px edge falloff in cell units
    const dens = tiled(c.noise, 3, 3, 6);
    const peb = aux(h, 'pebble'), pid = aux(h, 'pid');
    each(h, (u, v, i) => {
      const w = cells.worley(u, v, 0.9);
      const r = 0.35 * (0.8 + 0.4 * w.id) * (0.7 + 0.6 * dens.fbm(u, v, 3));   // sandier and stonier patches
      const t = r - w.f1;
      const hc = 0.4 + 0.6 * ((w.id * 7.31) % 1);
      const p = t > 0 ? hc * smoothstep(0, fall, t) * (0.8 + 0.2 * Math.sqrt(sat(t / r))) : 0;
      const s = sand.fbm(u, v, 4) * 0.3 + grit.value(u, v) * 0.05;
      h.data[i] = Math.max(s, 0.08 + p);
      peb[i] = smoothstep(0, fall, t);
      pid[i] = w.id;
    });
  },
  albedo(rgb, h, c) {
    const base = hex('#8d8272'), sandCol = scale3(hueShift(hex('#8d8272'), 8), 0.78);
    const mott = tiled(c.noise, 8, 8, 4);
    const peb = aux(h, 'pebble'), pid = aux(h, 'pid');
    each(rgb, (u, v, i) => {
      const id = pid[i]!;
      const jitter = (1 + (id - 0.5) * 0.24) * ((id * 31.3) % 1 < 0.15 ? 0.72 : 1);   // ±12 % per pebble, a few dark ones
      const hueJ = ((id * 13.7) % 1 - 0.5) * 22;
      const stone = scale3(hueShift(base, hueJ), jitter * (0.9 + 0.2 * mott.fbm(u, v, 2)));
      const s = scale3(sandCol, 0.85 + 0.3 * h.data[i]!);
      setRgb(rgb, i, mix3(s, stone, peb[i]!));
    });
  },
  orm(o, h) {
    const peb = aux(h, 'pebble');
    for (let i = 0; i < o.rough.length; i++) o.rough[i] = mix(0.92, 0.8, peb[i]!);
  },
};

// ─── cobble ────────────────────────────────────────────────────────────────────────────────────
const px1024 = (n: number): number => n / 1024;
const cobble: SurfaceRecipe = {
  id: 'cobble', hero: true, metres: 2, normalStrength: 0.85, wrap: 'repeat', rdo: 4,
  height(h, c) {
    const top = tiled(c.noise, 16, 16, 1);
    const wob = tiled(c.noise, 24, 24, 2);
    const mortarN = tiled(c.noise, 64, 64, 4);
    const prof = aux(h, 'stone'), sid = aux(h, 'sid');
    const mortar = px1024(6), corner = px1024(14), bevel = px1024(18);
    each(h, (u, v, i) => {
      const cc = courses(u, v, 8, 8, 0.5, 0, (a, b) => c.noise.hash21(a, b));
      const sz = 0.9 + 0.1 * ((cc.id * 3.7) % 1);                       // stones are not all the same size
      const ox = (((cc.id * 11.3) % 1) - 0.5) * px1024(8), oy = (((cc.id * 17.9) % 1) - 0.5) * px1024(8);
      const lx = (cc.cu - 0.5) * cc.w - ox, ly = (cc.cv - 0.5) * cc.h - oy;
      const irregular = (wob.fbm(u, v, 3) - 0.5) * px1024(9);
      const d = sdRoundRect(lx, ly, (cc.w / 2 - mortar / 2) * sz, (cc.h / 2 - mortar / 2) * sz, corner) + irregular;
      const p = d < 0 ? Math.pow(smoothstep(0, bevel, -d), 0.7) : 0;
      const tilt = ((cc.id * 5.3) % 1 - 0.5) * 0.12 * (cc.cu - 0.5) + ((cc.id * 9.1) % 1 - 0.5) * 0.12 * (cc.cv - 0.5);
      const r2 = Math.min(1, (lx / (cc.w / 2)) ** 2 + (ly / (cc.h / 2)) ** 2);
      const stoneTop = 0.72 + top.fbm(u, v, 4) * 0.2 + tilt + 0.1 * (1 - r2);   // domed, worn tops
      h.data[i] = clamp(0.1 + mortarN.value(u, v) * 0.04 + (stoneTop - 0.1) * p, 0, 1);
      prof[i] = p; sid[i] = cc.id;
    });
  },
  albedo(rgb, h, c) {
    const base = hex('#6f6a63'), mortarCol = hex('#4c4843');
    const mott = tiled(c.noise, 12, 12, 5);
    const prof = aux(h, 'stone'), sid = aux(h, 'sid');
    each(rgb, (u, v, i) => {
      const id = sid[i]!;
      const st = scale3(hueShift(base, ((id * 7.7) % 1 - 0.5) * 10), (1 + (id - 0.5) * 0.2) * (0.84 + 0.32 * mott.fbm(u, v, 4)));
      const edgeDark = 0.78 + 0.22 * prof[i]! * (0.8 + 0.2 * h.data[i]!);
      setRgb(rgb, i, mix3(mortarCol, scale3(st, edgeDark), smoothstep(0, 0.35, prof[i]!)));
    });
  },
  orm(o, h) {
    const prof = aux(h, 'stone');
    for (let i = 0; i < o.rough.length; i++) {
      const p = prof[i]!;
      o.rough[i] = mix(0.75, 0.55, p);
      o.ao[i] = mix(0.5, 1, smoothstep(0, 0.5, p));
    }
  },
};

// ─── plaster ───────────────────────────────────────────────────────────────────────────────────
const plaster: SurfaceRecipe = {
  id: 'plaster', hero: true, metres: 2, normalStrength: 0.35, wrap: 'repeat',
  height(h, c) {
    const trowel = tiled(c.noise, 12, 12);
    const sweep = tiled(c.noise, 5, 3, 2);
    each(h, (u, v, i) => { h.data[i] = 0.55 + trowel.fbm(u, v, 5) * 0.25 + (sweep.fbm(u, v, 3) - 0.5) * 0.12; });
    const crack = aux(h, 'crack');
    const r = c.noise.rng('plaster');
    for (let k = 0; k < 12; k++) crackWalk(crack, h.width, h.height, r, r(), r(), 120 + Math.floor(r() * 220), 1 / 1024, true, 0.5, 0.015);
    for (let i = 0; i < h.data.length; i++) h.data[i] = sat(h.data[i]! - 0.5 * crack[i]!);
  },
  albedo(rgb, h, c) {
    const base = hex('#d9cfbb');
    const n = tiled(c.noise, 4, 4, 3);
    const crack = aux(h, 'crack');
    each(rgb, (u, v, i) => { setRgb(rgb, i, base, (0.92 + 0.08 * n.fbm(u, v, 4)) * (1 - 0.18 * crack[i]!)); });
  },
  orm(o, h) {
    const crack = aux(h, 'crack');
    each(o, (u, v, i) => {
      const e = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2;
      o.ao[i] = (1 - 0.35 * smoothstep(0.85, 1, e)) * (1 - 0.3 * crack[i]!);
      o.rough[i] = 0.72;
    });
  },
};

// ─── timber ────────────────────────────────────────────────────────────────────────────────────
const timber: SurfaceRecipe = {
  id: 'timber', hero: true, metres: 2, normalStrength: 0.5, wrap: 'repeat',
  height(h, c) { timberHeight(h, c, 'timber', 4, 3, 1024); },
  albedo(rgb, h) {
    const base = hex('#6b4a2e');
    const pl = aux(h, 'plank'), gr = aux(h, 'grain'), kn = aux(h, 'knot');
    each(rgb, (_u, _v, i) => {
      const hh = h.data[i]!;
      let col = scale3(base, (0.85 + 0.3 * gr[i]!) * (0.92 + 0.16 * pl[i]!));
      col = scale3(col, 1 - 0.35 * kn[i]!);
      col = scale3(col, 0.45 + 0.55 * smoothstep(0, 0.3, hh));      // gaps read dark
      setRgb(rgb, i, col);
    });
  },
  orm(o, h) {
    const gr = aux(h, 'grain');
    for (let i = 0; i < o.rough.length; i++) o.rough[i] = 0.62 + 0.08 * gr[i]!;
  },
};

// ─── slate_roof ────────────────────────────────────────────────────────────────────────────────
const slate_roof: SurfaceRecipe = {
  id: 'slate_roof', hero: false, metres: 2, normalStrength: 0.75, wrap: 'repeat', rdo: 4,
  height(h, c) {
    const cleave = tiled(c.noise, 20, 3);
    const edgeN = tiled(c.noise, 48, 6, 2);
    const sid = aux(h, 'sid'), gapA = aux(h, 'gap');
    const step = 1.5 / 512;
    each(h, (u, v, i) => {
      const rows = 6;
      const ragged = (edgeN.fbm(u, v, 3) - 0.5) * 0.12;                 // chipped lower edges
      const cc = courses(u, v + 0.5 / rows - ragged / rows, rows, 6, 0.5, 0.12, (a, b) => c.noise.hash21(a, b));   // course edges off the tile edge
      const t = cc.cv;                                                   // 0 = exposed lower edge … 1 = under the next course
      const slope = 0.4 + 0.45 * (1 - t);
      const eu = Math.min(cc.cu, 1 - cc.cu) * cc.w;                      // distance to the vertical joint
      const joint = smoothstep(step * 0.5, step * 1.5, eu);
      const lowerLip = smoothstep(0, step, t * cc.h);                    // 1.5 px stepped edge
      const cl = cleave.fbm(u + cc.id * 3, v, 4) * 0.15;
      h.data[i] = clamp((slope + cl) * mix(0.55, 1, joint) * mix(0.47, 1, lowerLip), 0, 1);
      sid[i] = cc.id; gapA[i] = joint * lowerLip;
    });
  },
  albedo(rgb, h) {
    const base = hex('#3f444c');
    const sid = aux(h, 'sid'), gapA = aux(h, 'gap');
    each(rgb, (_u, _v, i) => {
      const id = sid[i]!;
      const col = hueShift(base, ((id * 3.3) % 1 - 0.5) * 6);
      setRgb(rgb, i, col, (1 + (id - 0.5) * 0.16) * (0.8 + 0.3 * h.data[i]!) * mix(0.6, 1, gapA[i]!));
    });
  },
  orm(o) { o.rough.fill(0.42); },
};

// ─── thatch ────────────────────────────────────────────────────────────────────────────────────
const thatch: SurfaceRecipe = {
  id: 'thatch', hero: false, metres: 2, normalStrength: 0.65, wrap: 'repeat', rdo: 4,
  height(h, c) {
    const tone = aux(h, 'tone', 1);
    const r = c.noise.rng('thatch');
    const acc = new Float32Array(h.data.length);
    for (let k = 0; k < 8000; k++) {
      const u0 = r(), v0 = r();
      const len = (40 + r() * 80) / 512, w = (1 + r()) / 512;
      const ang = Math.PI + (r() - 0.5) * (16 * Math.PI / 180);      // downward (−v) ±8°
      const tn = 0.85 + r() * 0.3;
      stroke(h, u0, v0, ang, len, w, w * 0.7, true, (_t, across, i) => {
        acc[i] = acc[i]! + 0.15 * (1 - across * across * 0.6);
        tone[i] = tn;
      });
    }
    const bind = tiled(c.noise, 64, 5, 2);
    each(h, (u, v, i) => {
      let hh = 1 - Math.exp(-acc[i]! * 1.3);                         // additive strokes, soft-clamped
      // 5 horizontal binding ridges at 0.9, twisted rope
      const bv = Math.abs(wrapDelta(v * 5 - 0.5)) / 5;              // distance to the nearest band centre
      const band = 1 - smoothstep(3 / 512, 5 / 512, bv);
      if (band > 0) {
        const twist = 0.85 + 0.15 * Math.sin((u * 5 * 64 + v * 5 * 40) * TAU / 5 + bind.value(u, v));
        hh = mix(hh, 0.9 * twist, band);
        tone[i] = mix(tone[i]!, 0.7, band);
      }
      h.data[i] = hh;
    });
  },
  albedo(rgb, h) {
    const base = hex('#a3813f');
    const tone = aux(h, 'tone', 1);
    each(rgb, (_u, _v, i) => { setRgb(rgb, i, base, tone[i]! * (0.45 + 0.6 * h.data[i]!)); });
  },
  orm(o) { o.rough.fill(0.95); },
};

// ─── water_pond ───────────────────────────────────────────────────────────────────────────────
const water_pond: SurfaceRecipe = {
  id: 'water_pond', hero: false, metres: 4, normalStrength: 0.35, wrap: 'repeat', rdo: 4,
  height(h, c) {
    const n1 = tiled(c.noise, 3, 3, 1), n2 = tiled(c.noise, 4, 4, 2);
    each(h, (u, v, i) => {
      const a = Math.sin(TAU * (7 * u + 2 * v) + n1.fbm(u, v, 3) * 2 * TAU * 0.35);
      const b = Math.sin(TAU * (-3 * u + 11 * v) + n2.fbm(u, v, 3) * 2 * TAU * 0.35);
      h.data[i] = 0.5 + 0.5 * (0.6 * a + 0.4 * b);
    });
  },
  albedo(rgb) {
    const base = hex('#2b5666');
    each(rgb, (_u, _v, i) => setRgb(rgb, i, base));
  },
  orm(o) { o.rough.fill(0.05); o.metal.fill(0); },
};

// ─── stone_wall ───────────────────────────────────────────────────────────────────────────────
const stone_wall: SurfaceRecipe = {
  id: 'stone_wall', hero: true, metres: 2, normalStrength: 0.8, wrap: 'repeat', rdo: 4,
  height(h, c) {
    const top = tiled(c.noise, 10, 10, 1);
    const pit = tiled(c.noise, 48, 48, 5);
    const wob = tiled(c.noise, 20, 20, 2);
    // 5 courses of irregular ashlar (course heights ±25 %, 2–3 stones per course ≈ 2:1, wandering joints)
    const layout = makeAshlar((a, b) => c.noise.hash21(a, b), 5, 2, 3, 0.25, 0.35);
    const prof = aux(h, 'stone'), sid = aux(h, 'sid');
    const mortar = px1024(5), bevel = px1024(16);
    each(h, (u, v, i) => {
      const cc = layout(u, v + 0.1);
      const irregular = (wob.fbm(u, v, 3) - 0.5) * px1024(10);
      const d = cc.edge - mortar / 2 + irregular;
      let p = d > 0 ? smoothstep(0, bevel, d) : 0;
      // chipped corners where hash21 > 0.8
      if (cc.id > 0.8 && p > 0) {
        const corner = Math.floor(((cc.id - 0.8) / 0.2) * 4);
        const du = corner & 1 ? 1 - cc.cu : cc.cu, dv = corner & 2 ? 1 - cc.cv : cc.cv;
        const chip = du * cc.w + dv * cc.h;
        if (chip < px1024(70)) p *= mix(0.5, 1, smoothstep(px1024(45), px1024(70), chip));
      }
      const stoneTop = 0.7 + (0.65 * top.fbm(u + cc.id * 5, v, 5) + 0.35 * pit.fbm(u, v, 3)) * 0.3;
      h.data[i] = 0.15 + (stoneTop - 0.15) * p;
      prof[i] = p; sid[i] = cc.id;
    });
  },
  albedo(rgb, h, c) {
    const base = hex('#7d7569'), mortarCol = hex('#5a544c');
    const mott = tiled(c.noise, 9, 9, 4);
    const prof = aux(h, 'stone'), sid = aux(h, 'sid');
    each(rgb, (u, v, i) => {
      const id = sid[i]!;
      const st = scale3(hueShift(base, ((id * 5.9) % 1 - 0.5) * 10), (1 + (id - 0.5) * 0.2) * (0.82 + 0.36 * mott.fbm(u, v, 4)) * (0.9 + 0.1 * h.data[i]!));
      setRgb(rgb, i, mix3(mortarCol, st, smoothstep(0, 0.3, prof[i]!)));
    });
  },
  orm(o, h) {
    const prof = aux(h, 'stone');
    for (let i = 0; i < o.rough.length; i++) {
      o.rough[i] = 0.7;
      o.ao[i] = mix(0.55, 1, smoothstep(0, 0.4, prof[i]!));
    }
  },
};

// ─── lantern_metal ────────────────────────────────────────────────────────────────────────────
const lantern_metal: SurfaceRecipe = {
  id: 'lantern_metal', hero: true, metres: 1, normalStrength: 0.4, wrap: 'repeat',
  height(h, c) {
    const streak = tiled(c.noise, 64, 2);
    const riv = aux(h, 'rivet');
    each(h, (u, v, i) => {
      let hh = 0.3 + streak.fbm(u, v, 3) * 0.2;
      // 24 rivet domes: 6 × 4 grid, r 10 px
      const gu = u * 6, gv = v * 4;
      const du = (gu - Math.floor(gu) - 0.5) / 6, dv = (gv - Math.floor(gv) - 0.5) / 4;
      const rr = Math.sqrt(du * du + dv * dv) / px1024(10);
      if (rr < 1) { const d = Math.sqrt(1 - rr * rr); hh = Math.max(hh, 0.3 + 0.7 * d); riv[i] = smoothstep(1, 0.8, rr); }
      h.data[i] = hh;
    });
  },
  albedo(rgb, h) {
    const base = hex('#2e2a26');
    const riv = aux(h, 'rivet');
    each(rgb, (_u, _v, i) => {
      const s = (h.data[i]! - 0.4) / 0.1;                                // streak value ±4 %
      setRgb(rgb, i, base, (1 + clamp(s, -1, 1) * 0.04) * (1 + 0.12 * riv[i]!));
    });
  },
  orm(o, h) {
    const riv = aux(h, 'rivet');
    for (let i = 0; i < o.rough.length; i++) { o.rough[i] = mix(0.45, 0.3, riv[i]!); o.metal[i] = 0.85; }
  },
};

// ─── glass_warm ────────────────────────────────────────────────────────────────────────────────
const glass_warm: SurfaceRecipe = {
  id: 'glass_warm', hero: true, metres: 1, normalStrength: 0.2, wrap: 'repeat',
  height(h, c) {
    const wav = tiled(c.noise, 6, 6);
    const fr = aux(h, 'frame');
    const half = px1024(12), bev = px1024(8);
    each(h, (u, v, i) => {
      // 2 × 2 panes: bars on the tile edges (wrapping to 24 px) and through the centre
      const du = Math.min(Math.abs(wrapDelta(u)), Math.abs(u - 0.5));
      const dv = Math.min(Math.abs(wrapDelta(v)), Math.abs(v - 0.5));
      const d = Math.min(du, dv);
      const f = 1 - smoothstep(half, half + bev, d);
      h.data[i] = mix(0.5 + (wav.fbm(u, v, 3) - 0.5) * 0.04, 1, f);
      fr[i] = 1 - smoothstep(half, half + 1 / 1024, d);
    });
  },
  albedo(rgb, h) {
    const glass = hex('#ffd9a0'), frame = hex('#3a332b');
    const fr = aux(h, 'frame');
    each(rgb, (_u, _v, i) => setRgb(rgb, i, mix3(glass, frame, fr[i]!)));
  },
  orm(o, h) {
    const fr = aux(h, 'frame');
    for (let i = 0; i < o.rough.length; i++) { const f = fr[i]!; o.rough[i] = mix(0.12, 0.5, f); o.metal[i] = mix(0, 0.8, f); }
  },
};

// ─── dirt ──────────────────────────────────────────────────────────────────────────────────────
const dirt: SurfaceRecipe = {
  id: 'dirt', hero: true, metres: 3, normalStrength: 0.6, wrap: 'repeat', rdo: 4,
  height(h, c) {
    const n = tiled(c.noise, 5, 5);
    each(h, (u, v, i) => { h.data[i] = 0.2 + n.fbm(u, v, 6) * 0.6; });
    const dep = aux(h, 'dep'), speck = aux(h, 'speck');
    const r = c.noise.rng('dirt');
    for (let k = 0; k < 400; k++) {
      const cu = r(), cv = r(), len = (30 + r() * 30) / 1024, ang = r() * TAU;
      stamp(h, cu, cv, len * 0.5, len * 0.32, ang, true, (nx, ny, i) => {
        const p = 1 - smoothstep(0.2, 1, Math.sqrt(nx * nx + ny * ny));
        if (p > dep[i]!) dep[i] = p;
      });
    }
    for (let k = 0; k < 2000; k++) {
      const cu = r(), cv = r(), rad = (1 + r()) / 1024;
      stamp(h, cu, cv, rad, rad, 0, true, (nx, ny, i) => {
        const p = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        if (p > speck[i]!) speck[i] = p;
      });
    }
    for (let i = 0; i < h.data.length; i++) h.data[i] = Math.max(sat(h.data[i]! - 0.3 * dep[i]!), 0.8 * speck[i]!);
  },
  albedo(rgb, h, c) {
    const base = hex('#6a5238'), grit: Vec3 = hex('#857a6c');
    const tint = tiled(c.noise, 4, 4, 3);
    const dep = aux(h, 'dep'), speck = aux(h, 'speck');
    each(rgb, (u, v, i) => {
      const t = tint.fbm(u, v, 4);
      let col = scale3(hueShift(base, (t - 0.5) * 10), (0.86 + 0.28 * t) * (0.9 + 0.2 * h.data[i]!));
      col = scale3(col, 1 - 0.15 * dep[i]!);                             // wet-look −15 %
      col = mix3(col, grit, speck[i]! * 0.8);
      setRgb(rgb, i, col);
    });
  },
  orm(o, h) {
    const speck = aux(h, 'speck');
    for (let i = 0; i < o.rough.length; i++) o.rough[i] = mix(0.9, 0.8, speck[i]!);
  },
};

// ─── tall_grass (card) ───────────────────────────────────────────────────────────────────────
const tall_grass: SurfaceRecipe = {
  id: 'tall_grass', hero: false, metres: 1, normalStrength: 0.5, wrap: 'clamp', rdo: 4,
  height(h, c) {
    const r = c.noise.rng('tall_grass');
    const bl = aux(h, 'blade', -1), bt = aux(h, 'bladeT'), tones: number[] = [];
    let id = 0;
    for (let cardI = 0; cardI < 3; cardI++) {
      for (let k = 0; k < 60; k++) {
        const colW = 1 / 3;
        const u0 = cardI * colW + colW * (0.08 + r() * 0.84);
        const height = 0.7 + r() * 0.3;
        let ang = (r() - 0.5) * 0.45;                                   // lean
        const bend = (r() - 0.5) * 0.5;
        const segs = 6;
        let su = u0, sv = 0.004;
        const segLen = (height - 0.01) / segs;
        const myId = id++;
        tones.push(r());
        for (let s = 0; s < segs; s++) {
          const t0 = s / segs, t1 = (s + 1) / segs;
          const w0 = mix(8, 1, t0) / 512, w1 = mix(8, 1, t1) / 512;
          stroke(h, su, sv, ang, segLen * 1.02, w0, w1, false, (t, across, i) => {
            h.data[i] = 0.35 + 0.25 * (1 - Math.abs(across));           // centre vein 0.6
            bl[i] = myId; bt[i] = mix(t0, t1, t);
          });
          su += Math.sin(ang) * segLen; sv += Math.cos(ang) * segLen;
          ang += bend / segs;
        }
      }
    }
    const tn = aux(h, 'tones');
    tones.forEach((t, k) => { tn[k] = t; });
  },
  albedo(rgb, h) {
    const a = card(rgb);
    const base = hex('#5f8a3c');
    const bl = aux(h, 'blade', -1), bt = aux(h, 'bladeT'), tn = aux(h, 'tones');
    each(rgb, (_u, v, i) => {
      const id = bl[i]!;
      if (id < 0) { setRgb(rgb, i, scale3(base, 0.8)); a.alpha[i] = 0; return; }
      const t = bt[i]!, tone = tn[id]!;
      let col = hueShift(base, (tone - 0.5) * 16);                       // ±8° per blade
      col = scale3(col, (0.75 + 0.25 * smoothstep(0, 0.5, v)) * (1 + 0.12 * smoothstep(0.6, 1, t)) * (0.85 + 0.3 * h.data[i]!));
      setRgb(rgb, i, col);
      a.alpha[i] = 1;
    });
  },
  orm(o, h) {
    const bl = aux(h, 'blade', -1);
    each(o, (_u, v, i) => {
      o.rough[i] = 0.75;
      o.ao[i] = bl[i]! < 0 ? 1 : 0.55 + 0.45 * smoothstep(0, 0.45, v);
    });
  },
};

export const GROVE_RECIPES: readonly SurfaceRecipe[] = [
  grove_bark, grove_leaf_canopy, grove_moss, path_gravel, cobble, plaster, timber, slate_roof, thatch, water_pond,
  stone_wall, lantern_metal, glass_warm, dirt, tall_grass,
];

