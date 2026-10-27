/**
 * §10.5.4 natural generators shared by every biome set: trees (tapered lathed trunks with 5 root lobes and root
 * arms, lathed branches, alpha-card canopies with volume normals), fractured rocks (lathed 10-point profile, planar
 * cuts, fBm, unwelded), tall-grass tufts, ground tufts, bushes, flower heads, stumps and logs.
 */
import { Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { BufferAttribute, BufferGeometry } from 'three/webgpu';
import type { SurfaceId } from '../../materials/surfaces.js';
import { Parts, card, lathe, propGeo, trs } from '../geo.js';
import { createPrng, valueNoise, type Prng } from '../prng.js';
import type { GeoLod, PropGeo } from '../types.js';

const TAU = Math.PI * 2;

export interface TreeShape {
  /** Height multiplier on the spec's 6 m·s reference. */
  readonly height: number;
  /** Trunk radius multiplier. */
  readonly girth: number;
  readonly lean: number;
  readonly branches: readonly [number, number];
  readonly branchHeight: readonly [number, number];
  readonly branchPitch: readonly [number, number];
  readonly branchLength: readonly [number, number];
  readonly clumpRadius: readonly [number, number];
  /** Extra clumps around the crown besides one per branch. */
  readonly crownClumps: number;
  /** Cards per tier (lod0, lod1, lod2). */
  readonly cards: readonly [number, number, number];
  readonly cardSize: readonly [number, number];
  /** Willow-style hanging cards. */
  readonly droop: boolean;
  /** Conifer: stacked whorls of cards around the trunk instead of clumps. */
  readonly conifer: boolean;
  /** Root arms at the base. */
  readonly roots: number;
}

export const TREE_SHAPES = {
  oak: { height: 0.86, girth: 1.0, lean: 0.35, branches: [3, 4], branchHeight: [0.55, 0.7], branchPitch: [0.75, 1.05], branchLength: [1.5, 2.4], clumpRadius: [1.35, 1.9], crownClumps: 2, cards: [58, 18, 6], cardSize: [1.6, 2.4], droop: false, conifer: false, roots: 5 },
  birch: { height: 1.0, girth: 0.62, lean: 0.25, branches: [2, 3], branchHeight: [0.58, 0.72], branchPitch: [0.45, 0.7], branchLength: [0.9, 1.5], clumpRadius: [0.95, 1.35], crownClumps: 2, cards: [40, 14, 5], cardSize: [1.3, 1.9], droop: false, conifer: false, roots: 4 },
  willow: { height: 1.0, girth: 1.12, lean: 0.55, branches: [3, 4], branchHeight: [0.55, 0.68], branchPitch: [0.9, 1.2], branchLength: [1.8, 2.6], clumpRadius: [1.5, 2.0], crownClumps: 1, cards: [52, 18, 6], cardSize: [1.4, 2.2], droop: true, conifer: false, roots: 6 },
  pine: { height: 1.35, girth: 0.8, lean: 0.12, branches: [0, 0], branchHeight: [0.5, 0.6], branchPitch: [1.2, 1.4], branchLength: [1, 1.2], clumpRadius: [1.2, 1.6], crownClumps: 0, cards: [48, 16, 6], cardSize: [1.4, 2.0], droop: false, conifer: true, roots: 4 },
  dead: { height: 0.9, girth: 0.9, lean: 0.5, branches: [3, 5], branchHeight: [0.45, 0.75], branchPitch: [0.6, 1.0], branchLength: [1.2, 2.2], clumpRadius: [0, 0], crownClumps: 0, cards: [0, 0, 0], cardSize: [1, 1], droop: false, conifer: false, roots: 5 },
} as const satisfies Readonly<Record<string, TreeShape>>;

export type TreeShapeName = keyof typeof TREE_SHAPES;

const _v = new Vector3();
const _up = new Vector3(0, 1, 0);
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);

/**
 * A curved root arm: leaves the trunk at `origin` heading outward along `angle` (radians about +Y), dips `drop`
 * metres over its `length` into the ground (quadratic bend), tapering from `r` to a point.
 */
export function rootArm(parts: Parts, bark: SurfaceId, origin: readonly [number, number, number], angle: number, length: number, r: number, drop: number, seg = 7): void {
  const dir = new Vector3(Math.cos(angle), -0.08, Math.sin(angle)).normalize();
  const down = new Vector3(0, -1, 0).addScaledVector(dir, dir.y).normalize();
  const z = new Vector3().crossVectors(down, dir).normalize();
  const m = new Matrix4().makeBasis(down, dir, z).setPosition(origin[0], origin[1], origin[2]);
  const prof: [number, number][] = [[r, 0], [r * 0.78, length * 0.22], [r * 0.52, length * 0.5], [r * 0.28, length * 0.78], [r * 0.08, length * 0.95], [0.01, length]];
  lathe(parts, bark, prof, { segments: seg, axis: (y) => [drop * (y / length) * (y / length), 0], radial: (a) => 1 + 0.12 * Math.cos(2 * a) }, m);
}

/** Places a +Y-built part at `origin` pointing along `dir`. */
function orient(origin: readonly [number, number, number], dir: Vector3): Matrix4 {
  _q.setFromUnitVectors(_up, _v.copy(dir).normalize());
  return new Matrix4().compose(new Vector3(origin[0], origin[1], origin[2]), _q, _s);
}

/**
 * SPEC §10.5.4 `makeTree`: trunk lathe 12 radial, radius 0.32·s flaring to 0.50·s over 5 root lobes in the first
 * 0.6 m, tapering to 0.14·s at 6·s m; 2–4 lathed branches (8 radial) at 55–70 % height; canopy alpha cards
 * 1.6–2.4 m (lod0 / lod1 / lod2 counts from the shape); s = 0.8 + prng · 0.6.
 */
export function buildTree(bark: SurfaceId, leaf: SurfaceId, shape: TreeShape, seed: number): PropGeo {
  const p = createPrng(seed);
  const s = 0.8 + p.next() * 0.6;
  const H = 6 * s * shape.height;
  const g = shape.girth;
  const leanA = p.next() * TAU; const leanAmt = shape.lean * (0.5 + p.next());
  const lobePhase = p.next() * TAU;
  const axis = (y: number): readonly [number, number] => {
    const t = y / H;
    return [Math.cos(leanA) * leanAmt * t * t + Math.sin(t * 5 + leanA) * 0.06 * t, Math.sin(leanA) * leanAmt * t * t + Math.cos(t * 4 + leanA) * 0.06 * t];
  };
  const rAt = (y: number): number => {
    const r0 = 0.32 * s * g; const rTop = 0.14 * s * g;
    const t = Math.min(1, y / (6 * s));
    return r0 + (rTop - r0) * Math.pow(t, 0.8);
  };
  const trunkTop = shape.conifer ? H * 0.98 : H * 0.8;
  const rows = [0, 0.08, 0.2, 0.36, 0.6, 1.1, 1.9, 2.8, 3.8, 4.9, 6.0].map((f) => (f / 6) * trunkTop).filter((y, i, a) => i === 0 || y > a[i - 1]! + 0.02);
  const profile = rows.map((y) => [rAt(y), y] as const);
  const lobes = (a: number, _j: number, y: number): number => {
    const noise = 1 + 0.05 * Math.sin(a * 3 + y * 2.1 + lobePhase);
    if (y >= 0.6) return noise;
    const lobe = Math.pow(Math.max(0, Math.cos(5 * (a - lobePhase))), 2);
    const f = Math.pow(1 - y / 0.6, 1.6);
    return noise * (1 + (0.5 / 0.32 - 1) * f * (0.25 + 0.75 * lobe));
  };

  const tiers: Parts[] = [new Parts(), new Parts(), new Parts()];
  const radialByTier = [12, 8, 6];
  for (let t = 0; t < 3; t++) {
    const prof = t === 0 ? profile : profile.filter((_, i) => i % (t === 1 ? 2 : 3) === 0 || i === profile.length - 1);
    lathe(tiers[t]!, bark, prof, { segments: radialByTier[t]!, radial: lobes, axis, capTop: true, phase: lobePhase });
  }

  // root arms (lod0 only): curved, tapering, diving into the ground between the lobes' peaks
  for (let k = 0; k < shape.roots; k++) {
    const a = lobePhase + (k * TAU) / shape.roots + (p.next() - 0.5) * 0.3;
    const len = (0.8 + p.next() * 0.6) * s * g;
    rootArm(tiers[0]!, bark, [Math.cos(a) * 0.2 * s * g, 0.28 * s, Math.sin(a) * 0.2 * s * g], a, len, 0.15 * s * g, 0.3 * s, 6);
  }

  // branches + clump centres
  const clumps: [number, number, number, number][] = [];
  const nb = shape.branches[0] + Math.floor(p.next() * (shape.branches[1] - shape.branches[0] + 1));
  const ba = p.next() * TAU;
  for (let k = 0; k < nb; k++) {
    const hb = H * (shape.branchHeight[0] + p.next() * (shape.branchHeight[1] - shape.branchHeight[0]));
    const yaw = ba + (k * TAU) / nb + (p.next() - 0.5) * 0.7;
    const pitch = shape.branchPitch[0] + p.next() * (shape.branchPitch[1] - shape.branchPitch[0]);   // from vertical
    const len = s * (shape.branchLength[0] + p.next() * (shape.branchLength[1] - shape.branchLength[0]));
    const dir = new Vector3(Math.sin(pitch) * Math.cos(yaw), Math.cos(pitch), Math.sin(pitch) * Math.sin(yaw));
    const [ax, az] = axis(hb);
    const o: [number, number, number] = [ax, hb, az];
    const br = rAt(hb) * 0.55;
    const bprof: [number, number][] = [[br, 0], [br * 0.7, len * 0.45], [br * 0.4, len * 0.85], [0.015, len]];
    lathe(tiers[0]!, bark, bprof, { segments: 8, phase: yaw }, orient(o, dir));
    if (k < 2) lathe(tiers[1]!, bark, [[br, 0], [0.02, len]], { segments: 5, phase: yaw }, orient(o, dir));
    const tip: [number, number, number] = [o[0] + dir.x * len, o[1] + dir.y * len + 0.25, o[2] + dir.z * len];
    clumps.push([tip[0], tip[1], tip[2], s * (shape.clumpRadius[0] + p.next() * (shape.clumpRadius[1] - shape.clumpRadius[0]))]);
  }
  const [tx, tz] = axis(trunkTop);
  for (let k = 0; k < shape.crownClumps; k++) {
    const a = p.next() * TAU; const d = k === 0 ? 0 : 0.9 * s;
    clumps.push([tx + Math.cos(a) * d, trunkTop + (k === 0 ? 0.55 : 0.05) * s, tz + Math.sin(a) * d, s * (shape.clumpRadius[0] + p.next() * (shape.clumpRadius[1] - shape.clumpRadius[0])) * (k === 0 ? 1.15 : 1)]);
  }

  // canopy cards per tier
  const cardTier = (t: number, count: number, sizeMul: number): void => {
    if (count === 0) return;
    const cp = createPrng(seed ^ (0x9e37 + t * 7919));
    if (shape.conifer) {
      const whorls = t === 0 ? 7 : t === 1 ? 4 : 2;
      const per = Math.max(2, Math.round(count / whorls));
      for (let wv = 0; wv < whorls; wv++) {
        const f = wv / Math.max(1, whorls - 1);
        const y = H * (0.28 + 0.62 * f);
        const rad = s * (1.9 - 1.4 * f) * (t === 0 ? 1 : 1.1);
        const [cx, cz] = axis(y);
        for (let k = 0; k < per; k++) {
          const a = (k / per) * TAU + wv * 0.9 + cp.next() * 0.4;
          const w = rad * 1.25 * sizeMul; const h = rad * 1.05 * sizeMul;
          card(tiers[t]!, leaf, cx + Math.cos(a) * rad * 0.35, y - h * 0.35, cz + Math.sin(a) * rad * 0.35, w, h, Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI / 2, -1.0 - cp.next() * 0.3, [cx, y + 0.8, cz], 0.55);
        }
      }
      return;
    }
    if (clumps.length === 0) return;
    for (let k = 0; k < count; k++) {
      const c = clumps[k % clumps.length]!;
      // direction biased upward and outward from the trunk
      const u = cp.next(); const v = cp.next();
      const theta = u * TAU; const y = -0.35 + v * 1.25;
      const rr = Math.sqrt(Math.max(0, 1 - Math.min(1, y) * Math.min(1, y)));
      const dx = Math.cos(theta) * rr; const dz = Math.sin(theta) * rr; const dy = Math.min(1, y);
      const dist = c[3] * (0.45 + 0.55 * Math.sqrt(cp.next()));
      const px = c[0] + dx * dist; const py = c[1] + dy * dist * 0.8; const pz = c[2] + dz * dist;
      const size = (shape.cardSize[0] + cp.next() * (shape.cardSize[1] - shape.cardSize[0])) * Math.sqrt(s) * sizeMul;
      if (shape.droop && dy < 0.35) {
        const w = size * 0.7; const h = size * 1.35;
        card(tiers[t]!, leaf, px, py - h * 0.95, pz, w, h, theta + Math.PI / 2 + (cp.next() - 0.5) * 0.6, 0.12, [c[0], c[1] + 1, c[2]], 0.5, [0, 1, 1, 0]);
      } else {
        const yawOut = Math.atan2(dx, dz) + (cp.next() - 0.5) * 0.9;
        const tilt = -(0.25 + 0.75 * Math.max(0, dy)) - cp.next() * 0.25;
        card(tiers[t]!, leaf, px, py - size * 0.45, pz, size, size, yawOut, tilt, [c[0], c[1] - c[3] * 0.3, c[2]], 0.7);
      }
    }
  };
  cardTier(0, shape.cards[0], 1);
  cardTier(1, shape.cards[1], 1.45);
  cardTier(2, shape.cards[2], 2.1);
  return propGeo(tiers[0]!, tiers[1]!, tiers[2]!, shape.cards[0] > 0 ? 'tree_card' : null, [bark, leaf]);
}

// ---- rocks -------------------------------------------------------------------------------------------------

export interface RockShape { readonly size: number; readonly squash: number; readonly elongate: number; readonly cuts: readonly [number, number] }

/**
 * SPEC §10.5.4 `makeRock`: lathed 10-point profile (16 radial), 3–5 planar cuts with prng normals (vertices beyond a
 * cut plane are projected onto it), fBm displacement ±0.06 r; unwelded (flat facets). lod1 = 8 radial, lod2 = 6
 * radial without cuts. Bottom sunk 18 % below y = 0.
 */
export function buildRock(surface: SurfaceId, seed: number, shape: RockShape = { size: 1, squash: 0.62, elongate: 1.25, cuts: [3, 5] }): PropGeo {
  const p = createPrng(seed);
  const R = shape.size * (0.8 + p.next() * 0.4);
  const squash = shape.squash * (0.85 + p.next() * 0.3);
  const elong = 1 + (shape.elongate - 1) * p.next();
  const rot = p.next() * TAU;
  const prof: [number, number][] = [];
  for (let j = 0; j < 10; j++) {
    const t = j / 9;
    const a = -0.28 * Math.PI + t * 0.78 * Math.PI;      // from below the equator over the top
    prof.push([Math.max(0.02, Math.cos(a)) * R, Math.sin(a) * R * squash + R * squash * 0.1]);
  }
  prof[9] = [0.001, prof[9]![1]];
  const nc = shape.cuts[0] + Math.floor(p.next() * (shape.cuts[1] - shape.cuts[0] + 1));
  const cuts: [number, number, number, number][] = [];
  for (let k = 0; k < nc; k++) {
    const az = p.next() * TAU; const el = 0.1 + p.next() * 1.1;
    const nx = Math.cos(el) * Math.cos(az); const ny = Math.sin(el); const nz = Math.cos(el) * Math.sin(az);
    cuts.push([nx, ny, nz, R * (0.5 + p.next() * 0.3)]);
  }
  const salt = seed & 0xffff;
  const tier = (seg: number, doCuts: boolean): Parts => {
    const rows = prof.length; const cols = seg + 1;
    const pos = new Float32Array(rows * cols * 3);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = ((i % seg) / seg) * TAU;
        const [r, y] = prof[j]!;
        let x = Math.cos(a) * r * elong; let z = Math.sin(a) * r; let yy = y;
        const c = Math.cos(rot); const sn = Math.sin(rot);
        [x, z] = [c * x - sn * z, sn * x + c * z];
        const n = valueNoise(x * 2.1 + 3, z * 2.1 + yy * 1.7, salt) * 0.6 + valueNoise(x * 4.3, z * 4.3 + yy * 3.1, salt + 5) * 0.4;
        const len = Math.hypot(x, yy - R * squash * 0.3, z) || 1;
        const d = n * 0.06 * R * 1.6;
        x += (x / len) * d; yy += ((yy - R * squash * 0.3) / len) * d; z += (z / len) * d;
        if (doCuts) {
          for (const [nx, ny, nz, dd] of cuts) {
            const q = x * nx + (yy - R * squash * 0.3) * ny + z * nz - dd;
            if (q > 0) { x -= nx * q; yy -= ny * q; z -= nz * q; }
          }
        }
        const k = j * cols + i;
        pos[k * 3] = x; pos[k * 3 + 1] = yy - R * squash * 0.18; pos[k * 3 + 2] = z;
      }
    }
    const index: number[] = [];
    for (let j = 0; j + 1 < rows; j++) for (let i = 0; i < seg; i++) {
      const a = j * cols + i; const b = a + 1; const c = a + cols; const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    const uv = new Float32Array(rows * cols * 2);
    for (let k = 0; k < rows * cols; k++) { uv[k * 2] = pos[k * 3]! + pos[k * 3 + 2]! * 0.5; uv[k * 2 + 1] = pos[k * 3 + 1]!; }
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    g.setIndex(index);
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    const parts = new Parts().add(surface, flat);
    g.dispose(); flat.dispose();
    return parts;
  };
  return propGeo(tier(16, true), tier(8, true), tier(6, false), null, [surface]);
}

// ---- small flora -------------------------------------------------------------------------------------------

/** SPEC §10.5.4 `makeTallGrass`: one tuft = 3 crossed alpha cards 0.5–0.8 m (lod1 2, lod2 1). */
export function buildTallGrass(surface: SurfaceId, seed: number, size: readonly [number, number] = [0.5, 0.8]): GeoLod {
  const p = createPrng(seed);
  const tiers = [new Parts(), new Parts(), new Parts()];
  const counts = [3, 2, 1];
  const a0 = p.next() * Math.PI;
  const dims: [number, number][] = [];
  for (let k = 0; k < 3; k++) dims.push([size[0] + p.next() * (size[1] - size[0]), size[0] + p.next() * (size[1] - size[0])]);
  for (let t = 0; t < 3; t++) {
    for (let k = 0; k < counts[t]!; k++) {
      const [w, h] = dims[k]!;
      const a = a0 + (k * Math.PI) / counts[t]!;
      card(tiers[t]!, surface, Math.cos(a + 1.3) * 0.06, -0.03, Math.sin(a + 1.3) * 0.06, w * (t === 2 ? 1.3 : 1), h, a, (p.next() - 0.5) * 0.3, [0, -0.9, 0], 0.7, [0, 0, 1, 1], true);
    }
  }
  const g = propGeo(tiers[0]!, tiers[1]!, tiers[2]!, null, [surface]);
  return { lod0: g.lod0, lod1: g.lod1, lod2: g.lod2, impostorKind: null };
}

/**
 * A ground clump: 5 short two-sided cards fanned round a centre (0.55–0.85 m wide, 0.28–0.45 m tall), leaning back
 * 12–30° and sampling the dense lower band of the grass card (v 0..0.7), normals bent up so it lights like the lawn.
 * lod1 3 cards, lod2 2 (every other / every third card of the fan, widened to keep the clump's cover).
 */
export function buildGroundTuft(surface: SurfaceId, seed: number): PropGeo {
  const p = createPrng(seed);
  const tiers = [new Parts(), new Parts(), new Parts()];
  const n = 5;
  const a0 = p.next() * Math.PI;
  for (let k = 0; k < n; k++) {
    const w = 0.55 + p.next() * 0.3; const h = 0.28 + p.next() * 0.17;
    const a = a0 + (k * TAU) / n + (p.next() - 0.5) * 0.4;
    const lean = -0.2 - p.next() * 0.3;
    card(tiers[0]!, surface, Math.cos(a) * 0.12, -0.03, Math.sin(a) * 0.12, w, h, a + Math.PI / 2, lean, [0, -1.0, 0], 0.8, [0, 0, 1, 0.7], true);
    if (k % 2 === 0) card(tiers[1]!, surface, Math.cos(a) * 0.12, -0.03, Math.sin(a) * 0.12, w * 1.3, h, a + Math.PI / 2, lean, [0, -1.0, 0], 0.8, [0, 0, 1, 0.7], true);
    if (k % 3 === 0) card(tiers[2]!, surface, Math.cos(a) * 0.12, -0.03, Math.sin(a) * 0.12, w * 1.6, h, a + Math.PI / 2, lean, [0, -1.0, 0], 0.8, [0, 0, 1, 0.7], true);
  }
  return propGeo(tiers[0]!, tiers[1]!, tiers[2]!, null, [surface]);
}

/** A leafy bush: cards on a squashed half-sphere (lod0 16 / lod1 8 / lod2 3). */
export function buildBush(leaf: SurfaceId, seed: number, size = 1): PropGeo {
  const p = createPrng(seed);
  const R = size * (0.75 + p.next() * 0.45);
  const tiers = [new Parts(), new Parts(), new Parts()];
  const counts = [16, 8, 3];
  for (let t = 0; t < 3; t++) {
    const cp = createPrng(seed ^ (t * 104729 + 17));
    for (let k = 0; k < counts[t]!; k++) {
      const a = cp.next() * TAU; const e = cp.next() * 1.2;
      const dx = Math.cos(a) * Math.cos(e); const dz = Math.sin(a) * Math.cos(e); const dy = Math.sin(e);
      const d = R * (0.35 + 0.5 * cp.next());
      const sz = (1.0 + cp.next() * 0.5) * R * (t === 0 ? 1 : t === 1 ? 1.35 : 1.9);
      card(tiers[t]!, leaf, dx * d, R * 0.45 + dy * d * 0.7 - sz * 0.5, dz * d, sz, sz, Math.atan2(dx, dz), -(0.3 + dy * 0.6), [0, R * 0.2, 0], 0.72, [0, 0, 1, 1], true);
    }
  }
  return propGeo(tiers[0]!, tiers[1]!, tiers[2]!, null, [leaf]);
}

/** A patch of 5-petal flower heads (lod0 22 / lod1 9); tinted per instance. */
export function buildFlowers(petal: SurfaceId, seed: number): PropGeo {
  const p = createPrng(seed);
  const tiers = [new Parts(), new Parts(), new Parts()];
  const heads: [number, number, number, number, number][] = [];
  for (let k = 0; k < 30; k++) {
    const a = p.next() * TAU; const d = Math.sqrt(p.next()) * 0.95;
    heads.push([Math.cos(a) * d, 0.12 + p.next() * 0.26, Math.sin(a) * d, 0.085 + p.next() * 0.06, p.next() * TAU]);
  }
  const head = (parts: Parts, [x, y, z, r, rot]: [number, number, number, number, number]): void => {
    const tilt = 0.25;
    for (let k = 0; k < 5; k++) {
      const a0 = rot + (k * TAU) / 5; const a1 = a0 + TAU / 10; const a2 = a0 + TAU / 5;
      const P = (a: number, rr: number): [number, number, number] => [x + Math.cos(a) * rr, y + Math.sin(a) * rr * tilt, z + Math.sin(a) * rr];
      const c: [number, number, number] = [x, y + 0.012, z];
      const tip = P(a1, r); const l = P(a0, r * 0.35); const rr = P(a2, r * 0.35);
      parts.tri(petal, [...c, ...tip, ...l], [0, 1, 0], [0.5, 0.5, 0.5, 1, 0.3, 0.6]);
      parts.tri(petal, [...c, ...rr, ...tip], [0, 1, 0], [0.5, 0.5, 0.7, 0.6, 0.5, 1]);
    }
  };
  heads.forEach((h, k) => { head(tiers[0]!, h); if (k % 2 === 0) head(tiers[1]!, [h[0], h[1], h[2], h[3] * 1.4, h[4]]); });
  return propGeo(tiers[0]!, tiers[1]!, tiers[2]!, null, [petal]);
}

/** A cut stump: flared lathe with a cap. */
export function buildStump(bark: SurfaceId, top: SurfaceId, seed: number): PropGeo {
  const p = createPrng(seed);
  const r = 0.3 + p.next() * 0.2; const h = 0.35 + p.next() * 0.35;
  const phase = p.next() * TAU;
  const prof: [number, number][] = [[r * 1.5, -0.05], [r * 1.25, 0.08], [r * 1.05, 0.2], [r, h * 0.6], [r * 0.97, h]];
  const lobes = (a: number, _j: number, y: number): number => 1 + (y < 0.2 ? 0.25 * Math.pow(Math.max(0, Math.cos(5 * (a - phase))), 2) : 0) + 0.04 * Math.sin(a * 3 + y * 5);
  const tiers = [new Parts(), new Parts(), new Parts()];
  for (let t = 0; t < 3; t++) {
    lathe(tiers[t]!, bark, t === 0 ? prof : [prof[0]!, prof[2]!, prof[4]!], { segments: [12, 8, 6][t]!, radial: lobes, phase });
    lathe(tiers[t]!, top, [[r * 0.97, h], [0.001, h + 0.02]], { segments: [12, 8, 6][t]!, radial: lobes, phase, smooth: false });
  }
  return propGeo(tiers[0]!, tiers[1]!, tiers[2]!, null, [bark, top]);
}

/** A fallen log: lathe along X with cut ends. */
export function buildLog(bark: SurfaceId, top: SurfaceId, seed: number): PropGeo {
  const p = createPrng(seed);
  const r = 0.22 + p.next() * 0.14; const len = 2.4 + p.next() * 1.6;
  const tiers = [new Parts(), new Parts(), new Parts()];
  const m = new Matrix4().makeRotationZ(-Math.PI / 2).premultiply(new Matrix4().makeTranslation(-len / 2, r * 0.8, 0));
  for (let t = 0; t < 3; t++) {
    const seg = [12, 8, 6][t]!;
    const prof: [number, number][] = [[0.001, 0], [r * 0.96, 0.001], [r, 0.08], [r * 0.98, len * 0.5], [r * 0.92, len - 0.08], [r * 0.9, len - 0.001], [0.001, len]];
    lathe(tiers[t]!, bark, prof.slice(1, 6), { segments: seg, radial: (a, _j, y) => 1 + 0.05 * Math.sin(a * 4 + y * 3) }, m);
    lathe(tiers[t]!, top, [prof[0]!, prof[1]!], { segments: seg, smooth: false }, m);
    lathe(tiers[t]!, top, [prof[5]!, prof[6]!], { segments: seg, smooth: false, radial: () => 1 }, m);
  }
  return propGeo(tiers[0]!, tiers[1]!, tiers[2]!, null, [bark, top]);
}

/** Two crossed cards spanning a bounding box — the > 160 m impostor tier of a scatter kind (IMPLEMENTATION-NOTES). */
export function buildImpostorCards(leaf: SurfaceId, width: number, height: number, base: number): Parts {
  const parts = new Parts();
  for (const a of [0.3, 0.3 + Math.PI / 2]) card(parts, leaf, 0, base, 0, width, height - base, a, 0, [0, base + (height - base) / 2, 0], 0.6);
  return parts;
}

export function rngPick<T>(p: Prng, a: readonly T[]): T { return a[Math.floor(p.next() * a.length)]!; }

export { trs };
