/**
 * §10.5.4 hand-placed props and light housings shared by every biome set: lantern (8-radial lathed post, bracket
 * scrolls, 6-sided chamfered cage around a `glass_warm` pane — the housing), brazier, beacon, crystal and candle
 * housings, fence (posts every 1.8 m, two chamfered rails), arched bridge (12 planks), well, bench, planter,
 * crate, barrel, cart, stall, signpost, garden plot, and the pond bank ring. Every housing is built so its glowing
 * part is centred on `HOUSING_LOCAL[generator]` — the light position the planner wrote into the spec.
 */
import { Matrix4, Shape, Vector3 } from 'three/webgpu';
import type { SurfaceId } from '../../materials/surfaces.js';
import { HOUSING_LOCAL } from '../layout.js';
import { Parts, beam, box, card, extrude, lathe, propGeo, trs, type V3 } from '../geo.js';
import { createPrng } from '../prng.js';
import type { PropGeo } from '../types.js';
import { buildRock } from './nature.js';

const TAU = Math.PI * 2;

export interface PropStyle {
  readonly wood: SurfaceId;
  readonly metal: SurfaceId;
  readonly stone: SurfaceId;
  readonly housingGlass: SurfaceId;
  readonly glow: SurfaceId;          // brazier coals / crystal
  readonly crystal: SurfaceId;
  readonly candle: SurfaceId;
  readonly cloth: SurfaceId;         // stall canopy / awnings (a roof surface)
  readonly soil: SurfaceId;
  readonly leaf: SurfaceId;
  readonly rock: SurfaceId;
  readonly water: SurfaceId | null;
}

/** Three tiers from one builder callback `(parts, tier)`. */
function tiered(build: (p: Parts, tier: number) => void, order?: readonly SurfaceId[]): PropGeo {
  const t = [new Parts(), new Parts(), new Parts()];
  for (let k = 0; k < 3; k++) build(t[k]!, k);
  return propGeo(t[0]!, t[1]!, t[2]!, null, order);
}

/** SPEC §10.5.4 `makeLantern`: post 8-radial lathe to 2.4 m, bracket scrolls, hexagonal chamfered cage (0.28 m) with an inner `glass_warm` pane. */
export function buildLantern(st: PropStyle, seed: number): PropGeo & { readonly housingLocal: readonly [number, number, number] } {
  const p = createPrng(seed);
  const hy = HOUSING_LOCAL.lantern[1];
  const g = tiered((parts, tier) => {
    const seg = tier === 0 ? 8 : 6;
    lathe(parts, st.metal, [[0.19, 0], [0.19, 0.08], [0.15, 0.12], [0.13, 0.3], [0.08, 0.36], [0.055, 0.42], [0.048, 2.2], [0.075, 2.26], [0.085, 2.33], [0.06, 2.38]], { segments: seg, smooth: tier > 0 ? false : true, capTop: true });
    // cage: bottom plate, 6 posts, top plate, roof, finial
    lathe(parts, st.metal, [[0.05, 2.38], [0.17, 2.41], [0.17, 2.45], [0.13, 2.46]], { segments: 6, smooth: false, phase: Math.PI / 6 });
    lathe(parts, st.housingGlass, [[0.001, hy - 0.17], [0.125, hy - 0.17], [0.13, hy + 0.17], [0.001, hy + 0.17]], { segments: 6, smooth: false, phase: Math.PI / 6 });
    if (tier < 2) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + Math.PI / 6;
        const x = Math.cos(a) * 0.145; const z = Math.sin(a) * 0.145;
        beam(parts, st.metal, [x, 2.44, z], [x, hy + 0.2, z], 0.03, 0.03, 0.008);
      }
    }
    lathe(parts, st.metal, [[0.13, hy + 0.18], [0.2, hy + 0.2], [0.21, hy + 0.23], [0.11, hy + 0.34], [0.04, hy + 0.42], [0.001, hy + 0.43]], { segments: 6, smooth: false, phase: Math.PI / 6 });
    if (tier === 0) {
      lathe(parts, st.metal, [[0.001, hy + 0.42], [0.035, hy + 0.45], [0.001, hy + 0.5]], { segments: 6, smooth: false });
      // bracket scrolls under the head (two S-scrolls)
      for (const s of [0, 1]) {
        const a = p.next() * 0 + s * Math.PI;
        const sh = new Shape();
        sh.moveTo(0, 0); sh.quadraticCurveTo(0.16, 0.02, 0.18, 0.14); sh.quadraticCurveTo(0.2, 0.2, 0.14, 0.2);
        sh.quadraticCurveTo(0.17, 0.12, 0.13, 0.08); sh.quadraticCurveTo(0.1, 0.04, 0, 0.035); sh.lineTo(0, 0);
        extrude(parts, st.metal, sh, 0.022, 0.004, trs(0, 2.18, 0, a).multiply(new Matrix4().makeTranslation(0.04, 0, -0.011)), { curveSegments: 5, bevelSegments: 1 });
      }
    }
  }, [st.metal, st.housingGlass]);
  return { ...g, housingLocal: HOUSING_LOCAL.lantern };
}

/** Brazier housing: tripod stand, lathed bowl, glowing coals at HOUSING_LOCAL.brazier. */
export function buildBrazier(st: PropStyle, _seed: number): PropGeo {
  const cy = HOUSING_LOCAL.brazier[1];
  return tiered((parts, tier) => {
    lathe(parts, st.metal, [[0.001, cy - 0.34], [0.12, cy - 0.34], [0.34, cy - 0.12], [0.44, cy - 0.02], [0.46, cy + 0.04], [0.4, cy + 0.02], [0.3, cy - 0.08]], { segments: tier === 0 ? 12 : 8, smooth: false });
    lathe(parts, st.glow, [[0.001, cy + 0.02], [0.34, cy - 0.06], [0.2, cy + 0.04], [0.001, cy + 0.09]], { segments: 8, smooth: false, phase: 0.3 });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU;
      beam(parts, st.metal, [Math.cos(a) * 0.12, cy - 0.3, Math.sin(a) * 0.12], [Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36], 0.05, 0.05, 0.012);
    }
    lathe(parts, st.stone, [[0.52, -0.2], [0.52, 0.06], [0.001, 0.07]], { segments: 10, smooth: false });
  }, [st.metal, st.glow]);
}

/** Beacon housing: a stone pillar with a caged lantern on top (HOUSING_LOCAL.beacon). */
export function buildBeacon(st: PropStyle, _seed: number): PropGeo {
  const hy = HOUSING_LOCAL.beacon[1];
  return tiered((parts, tier) => {
    box(parts, st.stone, 0, -0.3, 0, 0.78, 0.58, 0.78, 0, 0.05);
    box(parts, st.stone, 0, 0.28, 0, 0.52, hy - 0.62, 0.52, 0, 0.05);
    box(parts, st.stone, 0, hy - 0.34, 0, 0.7, 0.12, 0.7, 0, 0.03);
    lathe(parts, st.housingGlass, [[0.001, hy - 0.22], [0.2, hy - 0.2], [0.21, hy + 0.2], [0.001, hy + 0.22]], { segments: 8, smooth: false, phase: Math.PI / 8 });
    if (tier < 2) for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + Math.PI / 4;
      beam(parts, st.metal, [Math.cos(a) * 0.27, hy - 0.22, Math.sin(a) * 0.27], [Math.cos(a) * 0.27, hy + 0.24, Math.sin(a) * 0.27], 0.045, 0.045, 0.01);
    }
    lathe(parts, st.metal, [[0.34, hy + 0.22], [0.36, hy + 0.26], [0.1, hy + 0.5], [0.001, hy + 0.56]], { segments: 8, smooth: false, phase: Math.PI / 8 });
  }, [st.stone, st.housingGlass, st.metal]);
}

/** Crystal housing: a faceted crystal on a carved stone stand (HOUSING_LOCAL.crystal). */
export function buildCrystal(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  const cy = HOUSING_LOCAL.crystal[1];
  return tiered((parts) => {
    lathe(parts, st.stone, [[0.42, -0.2], [0.42, 0.1], [0.3, 0.2], [0.16, 0.3], [0.13, cy - 0.5], [0.24, cy - 0.38], [0.26, cy - 0.3], [0.001, cy - 0.28]], { segments: 8, smooth: false });
    lathe(parts, st.crystal, [[0.001, cy - 0.32], [0.14, cy - 0.12], [0.16, cy + 0.12], [0.001, cy + 0.42]], { segments: 5, smooth: false, phase: p.next() * TAU });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + p.next();
      const m = trs(Math.cos(a) * 0.12, cy - 0.28, Math.sin(a) * 0.12, a).multiply(new Matrix4().makeRotationZ(0.45));
      lathe(parts, st.crystal, [[0.001, 0], [0.05, 0.06], [0.05, 0.16], [0.001, 0.28]], { segments: 4, smooth: false }, m);
    }
  }, [st.stone, st.crystal]);
}

/** Candle housing: an iron stand with a lit candle cluster (HOUSING_LOCAL.candle). */
export function buildCandle(st: PropStyle, _seed: number): PropGeo {
  const cy = HOUSING_LOCAL.candle[1];
  return tiered((parts) => {
    lathe(parts, st.metal, [[0.22, 0], [0.22, 0.05], [0.05, 0.1], [0.035, cy - 0.2], [0.18, cy - 0.14], [0.2, cy - 0.1], [0.001, cy - 0.1]], { segments: 8, smooth: false });
    for (const [x, z, h] of [[0, 0, 0.24], [0.1, 0.04, 0.16], [-0.08, 0.07, 0.19], [0.02, -0.1, 0.13]] as const) {
      lathe(parts, st.candle, [[0.001, cy - 0.1], [0.04, cy - 0.1], [0.04, cy - 0.1 + h], [0.012, cy - 0.08 + h], [0.001, cy - 0.06 + h]], { segments: 8, smooth: false }, trs(x, 0, z));
    }
  }, [st.metal, st.candle]);
}

/** SPEC §10.5.4 `makeFence`: posts every 1.8 m along `path`, two chamfered rails; merged. */
export function buildFence(st: PropStyle, path: readonly (readonly [number, number])[], seed: number): PropGeo {
  const p = createPrng(seed);
  return tiered((parts, tier) => {
    for (let s = 0; s + 1 < path.length; s++) {
      const a = path[s]!; const b = path[s + 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 1.8));
      for (let k = 0; k <= n; k++) {
        if (k === n && s + 2 < path.length) continue;
        const t = k / n;
        const x = a[0] + (b[0] - a[0]) * t; const z = a[1] + (b[1] - a[1]) * t;
        const h = 1.05 + (p.next() - 0.5) * 0.08;
        box(parts, st.wood, x, -0.25, z, 0.13, h + 0.25, 0.13, Math.atan2(b[0] - a[0], b[1] - a[1]) + (p.next() - 0.5) * 0.12, 0.025);
        if (tier === 0) lathe(parts, st.wood, [[0.075, h], [0.05, h + 0.06], [0.001, h + 0.08]], { segments: 4, smooth: false, phase: Math.PI / 4 }, trs(x, 0, z, Math.atan2(b[0] - a[0], b[1] - a[1])));
      }
      if (tier < 2) {
        const face: V3 = [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len];
        for (const y of [0.42, 0.86]) beam(parts, st.wood, [a[0], y, a[1]], [b[0], y + (p.next() - 0.5) * 0.04, b[1]], 0.11, 0.06, 0.02, face);
      }
    }
  }, [st.wood]);
}

/** SPEC §10.5.4 `makeBridge`: arched deck of 12 planks (sagitta 0.35 m) from `a` to `b`, side rails, 4 posts. */
export function buildBridge(st: PropStyle, a: readonly [number, number], b: readonly [number, number], seed: number): PropGeo {
  const p = createPrng(seed);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
  const W = 2.4;
  return tiered((parts, tier) => {
    const m = trs(a[0], 0, a[1], yaw);
    const y = (t: number): number => 0.35 * 4 * t * (1 - t);
    for (let k = 0; k < 12; k++) {
      const t = (k + 0.5) / 12;
      const pl = len / 12;
      const mm = m.clone().multiply(trs(0, y(t) + 0.08, t * len)).multiply(new Matrix4().makeRotationX(-Math.atan(0.35 * 4 * (1 - 2 * t) / len)));
      box(parts, st.wood, (p.next() - 0.5) * 0.04, -0.06, 0, W, 0.08, pl - 0.03, 0, 0.015, mm);
    }
    for (const s of [-1, 1]) {
      for (let k = 0; k <= 3; k++) {
        const t = k / 3;
        box(parts, st.wood, s * (W / 2 - 0.05), -0.4, t * len, 0.14, y(t) + 1.35, 0.14, 0, 0.025, m);
      }
      if (tier < 2) for (const hy of [0.55, 1.0]) {
        for (let k = 0; k < 6; k++) {
          const t0 = k / 6; const t1 = (k + 1) / 6;
          const p0 = new Vector3(s * (W / 2 - 0.05), y(t0) + hy, t0 * len).applyMatrix4(m);
          const p1 = new Vector3(s * (W / 2 - 0.05), y(t1) + hy, t1 * len).applyMatrix4(m);
          beam(parts, st.wood, [p0.x, p0.y, p0.z], [p1.x, p1.y, p1.z], 0.1, 0.06, 0.018, [Math.cos(yaw) * s, 0, -Math.sin(yaw) * s]);
        }
      }
      // stringers under the deck
      for (let k = 0; k < 6; k++) {
        const t0 = k / 6; const t1 = (k + 1) / 6;
        const p0 = new Vector3(s * (W / 2 - 0.25), y(t0) - 0.08, t0 * len).applyMatrix4(m);
        const p1 = new Vector3(s * (W / 2 - 0.25), y(t1) - 0.08, t1 * len).applyMatrix4(m);
        beam(parts, st.wood, [p0.x, p0.y, p0.z], [p1.x, p1.y, p1.z], 0.18, 0.12, 0.02);
      }
    }
  }, [st.wood]);
}

/** Stone well with a timber roof frame, winch and bucket. */
export function buildWell(st: PropStyle, roofSurface: SurfaceId, seed: number): PropGeo {
  const p = createPrng(seed);
  return tiered((parts, tier) => {
    // stone ring: lathed wall with a lip, then a rough block course on top
    lathe(parts, st.stone, [[0.72, -0.3], [0.8, 0.02], [0.8, 0.72], [0.86, 0.76], [0.86, 0.84], [0.62, 0.84], [0.62, 0.3]], { segments: tier === 0 ? 20 : 12, smooth: false });
    lathe(parts, st.soil, [[0.62, 0.3], [0.001, 0.3]], { segments: 12, smooth: false });
    if (tier === 0) for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU + p.next() * 0.1;
      box(parts, st.stone, Math.cos(a) * 0.74, 0.84, Math.sin(a) * 0.74, 0.3, 0.1 + p.next() * 0.04, 0.24, -a, 0.03);
    }
    for (const s of [-1, 1]) box(parts, st.wood, s * 0.78, 0.2, 0, 0.14, 1.95, 0.14, 0, 0.025);
    beam(parts, st.wood, [-0.95, 1.55, 0], [0.95, 1.55, 0], 0.08, 0.08, 0.015);
    if (tier < 2) {
      lathe(parts, st.wood, [[0.001, -0.2], [0.13, -0.19], [0.14, 0.02], [0.001, 0.03]], { segments: 8, smooth: false }, trs(0.05, 1.0, 0));
      beam(parts, st.metal, [0.05, 1.03, 0], [0.05, 1.55, 0], 0.012, 0.012, 0.003);
    }
    // little gable roof
    for (const s of [-1, 1]) {
      const X = new Vector3(1, 0, 0); const Y = new Vector3(0, Math.sin(0.62), -Math.cos(0.62) * s); const Z = new Vector3().crossVectors(X, Y);
      const m = new Matrix4().makeBasis(X, Y, Z).setPosition(-1.05, 1.95, s * 0.95);
      extrude(parts, roofSurface, rectShapeLocal(0, 0, 2.1, 1.22), 0.07, 0.02, m);
    }
    beam(parts, st.wood, [-1.08, 2.63, 0], [1.08, 2.63, 0], 0.12, 0.12, 0.02, [0, Math.SQRT1_2, Math.SQRT1_2]);
  }, [st.stone, st.wood]);
}

function rectShapeLocal(x0: number, y0: number, x1: number, y1: number): Shape {
  const s = new Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0); return s;
}

export function buildBench(st: PropStyle, _seed: number): PropGeo {
  return tiered((parts, tier) => {
    for (const x of [-0.75, 0.75]) {
      box(parts, st.stone, x, -0.1, 0, 0.2, 0.52, 0.42, 0, 0.03);
      if (tier === 0) box(parts, st.wood, x, 0.42, -0.2, 0.08, 0.45, 0.08, 0, 0.015);
    }
    for (let k = 0; k < 3; k++) box(parts, st.wood, 0, 0.42, -0.14 + k * 0.14, 1.9, 0.05, 0.12, 0, 0.012);
    if (tier === 0) for (const y of [0.62, 0.78]) box(parts, st.wood, 0, y, -0.22, 1.85, 0.1, 0.04, 0, 0.012);
  }, [st.wood, st.stone]);
}

export function buildPlanter(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  return tiered((parts, tier) => {
    box(parts, st.stone, 0, -0.1, 0, 1.1, 0.58, 1.1, 0, 0.04);
    box(parts, st.soil, 0, 0.44, 0, 0.9, 0.06, 0.9, 0, 0.02);
    const n = tier === 0 ? 7 : tier === 1 ? 4 : 2;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + p.next();
      card(parts, st.leaf, Math.cos(a) * 0.22, 0.42, Math.sin(a) * 0.22, 0.75, 0.7, a, -0.35, [0, 0.4, 0], 0.7, [0, 0, 1, 1], true);
    }
  }, [st.stone, st.leaf]);
}

/**
 * A traveller's ridge tent (2.6 m along local x, 2.2 m wide, 1.6 m to the ridge): two cloth panels, closed gables, a
 * pole at each end and a ridge pole; the door gable (local +x) is drawn darker with an open flap.
 */
export function buildTent(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  const L = 2.4 + p.next() * 0.5; const W = 2.1 + p.next() * 0.3; const H = 1.5 + p.next() * 0.25;
  const slant = Math.hypot(W / 2, H);
  return tiered((parts, tier) => {
    for (const s of [-1, 1]) {
      const n: V3 = [0, (W / 2) / slant, (s * H) / slant];
      beam(parts, st.cloth, [-L / 2, H / 2, (s * W) / 4], [L / 2, H / 2, (s * W) / 4], slant + 0.08, 0.05, tier === 0 ? 0.015 : 0.005, n);
    }
    const tri = new Shape();
    tri.moveTo(-W / 2 + 0.04, 0); tri.lineTo(W / 2 - 0.04, 0); tri.lineTo(0, H - 0.04); tri.lineTo(-W / 2 + 0.04, 0);
    extrude(parts, st.cloth, tri, 0.04, 0, trs(-L / 2 + 0.02, 0, 0, Math.PI / 2), { curveSegments: 1 });
    if (tier < 2) {
      const flap = new Shape();
      flap.moveTo(0.05, 0); flap.lineTo(W / 2 - 0.06, 0); flap.lineTo(0.05, H * 0.92); flap.lineTo(0.05, 0);
      extrude(parts, st.cloth, flap, 0.04, 0, trs(L / 2 - 0.02, 0, 0, Math.PI / 2), { curveSegments: 1 });
      for (const x of [-L / 2 - 0.05, L / 2 + 0.05]) beam(parts, st.wood, [x, -0.1, 0], [x, H + 0.18, 0], 0.07, 0.07, 0.015);
      beam(parts, st.wood, [-L / 2 - 0.1, H + 0.02, 0], [L / 2 + 0.1, H + 0.02, 0], 0.06, 0.06, 0.012);
    }
  }, [st.cloth, st.wood]);
}

/** A campfire: a ring of hearth stones round crossed logs and glowing coals (the coals use the set's glow surface). */
export function buildCampfire(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  const rot = p.next() * TAU;
  return tiered((parts, tier) => {
    const n = tier === 0 ? 9 : 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + rot;
      box(parts, st.stone, Math.cos(a) * 0.55, -0.04, Math.sin(a) * 0.55, 0.26, 0.2 + (k % 3) * 0.03, 0.2, -a, tier === 0 ? 0.05 : 0.02);
    }
    lathe(parts, st.glow, [[0.001, 0.02], [0.36, 0.0], [0.22, 0.08], [0.001, 0.12]], { segments: tier === 0 ? 10 : 6, smooth: false });
    if (tier < 2) {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + rot;
        beam(parts, st.wood, [Math.cos(a) * 0.42, 0.04, Math.sin(a) * 0.42], [Math.cos(a) * -0.05, 0.34, Math.sin(a) * -0.05], 0.1, 0.1, 0.02);
      }
    }
  }, [st.stone, st.glow, st.wood]);
}

export function buildCrate(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  const s = 0.7 + p.next() * 0.25;
  return tiered((parts, tier) => {
    box(parts, st.wood, 0, 0, 0, s, s, s, 0, 0.03);
    if (tier === 0) {
      for (const [dx, dz, yaw] of [[0, s / 2, 0], [0, -s / 2, 0], [s / 2, 0, Math.PI / 2], [-s / 2, 0, Math.PI / 2]] as const) {
        const m = trs(dx, 0, dz, yaw);
        for (const y of [0.04, s - 0.12]) box(parts, st.wood, 0, y, 0, s + 0.02, 0.08, 0.04, 0, 0.012, m);
        beam(parts, st.wood, [-s / 2 + 0.06, 0.1, 0.01], [s / 2 - 0.06, s - 0.12, 0.01], 0.08, 0.035, 0.01, [0, 0, 1], m);
      }
    }
  }, [st.wood]);
}

export function buildBarrel(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  const h = 0.92 + p.next() * 0.12; const r = 0.3 + p.next() * 0.04;
  return tiered((parts, tier) => {
    const seg = tier === 0 ? 14 : 8;
    lathe(parts, st.wood, [[r * 0.84, 0], [r * 0.95, h * 0.2], [r, h * 0.5], [r * 0.95, h * 0.8], [r * 0.84, h]], { segments: seg, capTop: true, capBottom: true });
    if (tier < 2) for (const y of [0.12, 0.34, 0.66, 0.88]) {
      const rr = r * (y < 0.5 ? 0.84 + 0.16 * Math.sin(Math.PI * y) : 0.84 + 0.16 * Math.sin(Math.PI * y)) + 0.012;
      lathe(parts, st.metal, [[rr, h * y - 0.025], [rr + 0.008, h * y], [rr, h * y + 0.025]], { segments: seg, smooth: false });
    }
  }, [st.wood, st.metal]);
}

export function buildCart(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  return tiered((parts, tier) => {
    box(parts, st.wood, 0, 0.62, 0, 1.3, 0.08, 2.0, 0, 0.02);
    for (const s of [-1, 1]) {
      box(parts, st.wood, s * 0.62, 0.7, 0, 0.06, 0.42, 2.0, 0, 0.015);
      const wm = trs(s * 0.74, 0.5, -0.15).multiply(new Matrix4().makeRotationZ(Math.PI / 2));
      lathe(parts, st.wood, [[0.001, -0.05], [0.44, -0.05], [0.5, -0.03], [0.5, 0.03], [0.44, 0.05], [0.001, 0.05]], { segments: tier === 0 ? 16 : 8, smooth: false }, wm);
      if (tier === 0) lathe(parts, st.metal, [[0.5, -0.04], [0.52, 0], [0.5, 0.04]], { segments: 16, smooth: false }, wm);
      beam(parts, st.wood, [s * 0.35, 0.58, 1.0], [s * 0.3, 0.12, 2.3], 0.07, 0.07, 0.015);
    }
    for (const s of [-1, 1]) box(parts, st.wood, 0, 0.7, s * 0.98, 1.3, 0.42, 0.06, 0, 0.015);
    beam(parts, st.metal, [-0.8, 0.5, -0.15], [0.8, 0.5, -0.15], 0.05, 0.05, 0.01);
    if (tier === 0) for (let k = 0; k < 3; k++) {
      const m = trs((p.next() - 0.5) * 0.6, 0.7, (p.next() - 0.5) * 1.2, p.next() * TAU);
      lathe(parts, st.wood, [[0.2, 0], [0.24, 0.3], [0.2, 0.6]], { segments: 8, capTop: true }, m);
    }
  }, [st.wood, st.metal]);
}

export function buildStall(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  return tiered((parts, tier) => {
    for (const [x, z] of [[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.6], [1.3, 0.6]] as const) box(parts, st.wood, x, -0.1, z, 0.12, (z < 0 ? 2.5 : 2.1) + 0.1, 0.12, 0, 0.02);
    box(parts, st.wood, 0, 0.82, 0.2, 2.7, 0.08, 1.0, 0, 0.02);
    box(parts, st.wood, 0, 0, 0.62, 2.7, 0.84, 0.05, 0, 0.015);
    const X = new Vector3(1, 0, 0); const Y = new Vector3(0, -Math.sin(0.28), Math.cos(0.28)); const Z = new Vector3().crossVectors(X, Y);
    extrude(parts, st.cloth, rectShapeLocal(0, 0, 3.0, 1.75), 0.05, 0.015, new Matrix4().makeBasis(X, Y, Z).setPosition(-1.5, 2.6, -0.95));
    if (tier === 0) for (let k = 0; k < 5; k++) {
      const x = -1.0 + k * 0.5;
      lathe(parts, st.wood, [[0.16, 0], [0.19, 0.1], [0.16, 0.2]], { segments: 8, capTop: true }, trs(x, 0.86, 0.1 + (p.next() - 0.5) * 0.2));
      card(parts, st.leaf, x, 0.98, 0.1, 0.3, 0.25, p.next() * TAU, -0.8, [x, 0.9, 0.1], 0.5);
    }
  }, [st.wood, st.cloth]);
}

export function buildSign(st: PropStyle, _seed: number): PropGeo {
  return tiered((parts, tier) => {
    box(parts, st.wood, 0, -0.3, 0, 0.14, 2.05, 0.14, 0, 0.025);
    const board = new Shape();
    board.moveTo(-0.05, -0.16); board.lineTo(0.72, -0.16); board.lineTo(0.9, 0); board.lineTo(0.72, 0.16); board.lineTo(-0.05, 0.16); board.lineTo(-0.05, -0.16);
    extrude(parts, st.wood, board, 0.05, 0.012, trs(0.06, 1.45, 0.07));
    if (tier === 0) extrude(parts, st.wood, board, 0.05, 0.012, trs(-0.06, 1.12, -0.07, Math.PI));
    if (tier === 0) lathe(parts, st.wood, [[0.08, 1.75], [0.05, 1.8], [0.001, 1.83]], { segments: 4, smooth: false, phase: Math.PI / 4 });
  }, [st.wood]);
}

/** A fenced vegetable plot: soil bed, crop rows, low fence around (5.4 × 3.6 m). */
export function buildGarden(st: PropStyle, seed: number): PropGeo {
  const p = createPrng(seed);
  const W = 5.4; const D = 3.6;
  const fence = buildFence(st, [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [0.7, D / 2]], seed);
  const fence2 = buildFence(st, [[-0.7, D / 2], [-W / 2, D / 2], [-W / 2, -D / 2]], seed + 1);
  const t = [new Parts(), new Parts(), new Parts()];
  for (let k = 0; k < 3; k++) {
    const src = [fence, fence2];
    for (const f of src) t[k]!.add(st.wood, [f.lod0, f.lod1, f.lod2][k]!);
    box(t[k]!, st.soil, 0, -0.1, 0, W - 0.5, 0.2, D - 0.5, 0, 0.04);
    const rows = k === 0 ? 4 : 2;
    for (let r = 0; r < rows; r++) {
      const z = -D / 2 + 0.6 + (r * (D - 1.2)) / Math.max(1, rows - 1);
      const n = k === 0 ? 7 : 3;
      for (let c = 0; c < n; c++) {
        const x = -W / 2 + 0.7 + (c * (W - 1.4)) / Math.max(1, n - 1);
        card(t[k]!, st.leaf, x, 0.06, z, 0.5, 0.42, p.next() * TAU, -0.5, [x, 0.0, z], 0.7, [0, 0, 1, 1], true);
      }
    }
  }
  for (const f of [fence, fence2]) { f.lod0.dispose(); f.lod1.dispose(); f.lod2.dispose(); }
  return propGeo(t[0]!, t[1]!, t[2]!, null, [st.wood, st.soil, st.leaf]);
}

/** Pond bank: a ring of flat fractured stones round a water body (circle of radius r). */
export function buildPondBank(st: PropStyle, r: number, seed: number): PropGeo {
  const p = createPrng(seed);
  const t = [new Parts(), new Parts(), new Parts()];
  const n = Math.max(10, Math.round((TAU * r) / 0.85));
  const rocks = [buildRock(st.rock, seed + 11, { size: 0.42, squash: 0.45, elongate: 1.5, cuts: [3, 4] }), buildRock(st.rock, seed + 23, { size: 0.36, squash: 0.5, elongate: 1.3, cuts: [3, 4] })];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + (p.next() - 0.5) * 0.12;
    const rr = r + 0.15 + (p.next() - 0.5) * 0.3;
    const s = 0.8 + p.next() * 0.5;
    const m = trs(Math.cos(a) * rr, -0.05, Math.sin(a) * rr, -a + (p.next() - 0.5) * 0.4, s);
    const rk = rocks[k % 2]!;
    t[0]!.add(st.rock, rk.lod0, m); t[1]!.add(st.rock, rk.lod1, m);
    if (k % 2 === 0) t[2]!.add(st.rock, rk.lod2, m);
  }
  for (const rk of rocks) { rk.lod0.dispose(); rk.lod1.dispose(); rk.lod2.dispose(); }
  return propGeo(t[0]!, t[1]!, t[2]!, null, [st.rock]);
}
