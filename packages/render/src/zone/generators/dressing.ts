/**
 * Phase E1 — per-biome density pass (IMPLEMENTATION-NOTES "Phase E1–E2"). Render-only dressing that never changes what
 * a player can walk on: content's zone plan owns every solid (buildings, hand-placed props, light posts, the interior
 * trees / big rocks / willows mirrored by `planSolids`), and the server's heightfield is stamped from it. Everything
 * here is therefore one of
 *
 * - **walk-through ground cover** — bushes, flower patches, grass tufts, small stones, crystal shards (the same rule
 *   that already lets a player wade through `bush` / `flower_patch` / tall grass): road-side verge clusters, scree
 *   round the big rocks, free scree / shard clusters in the barren biomes;
 * - **wall-hugging house dressing** inside a building's collider footprint (the wall + 0.12 m + the 0.35 m capsule):
 *   flower boxes, firewood stacks, sacks, pots, small kegs — nothing deeper than `SKIRT_DEPTH_M` from the wall, and
 *   never in front of the door;
 * - **boundary dressing outside the playable square** (|x|, |z| ≥ the walkable edge): a per-biome wall / dyke / fence /
 *   crystal line with gate piers at the road exits.
 *
 * Pure placement maths + small prop builders; the zone builder feeds the results into its existing scatter kinds and
 * per-chunk static meshes, so the pass adds instances and merged triangles, not draw calls or materials (one optional
 * scatter kind, `crystal_shard`, in shrine / rift / marrow zones).
 */
import type { Biome, BuildingSpec } from '../../contracts.js';
import type { SurfaceId } from '../../materials/surfaces.js';
import { Parts, beam, box, card, lathe, propGeo, trs } from '../geo.js';
import { createPrng, hash2, valueNoise } from '../prng.js';
import type { PropGeo } from '../types.js';
import type { PropStyle } from './props.js';
import type { BiomeSet } from './set.js';

const TAU = Math.PI * 2;

/** House-skirt item kinds (all ≤ `SKIRT_DEPTH_M` deep). */
export type SkirtKind = 'flowerbox' | 'firewood' | 'sack' | 'pot' | 'keg' | 'crate_s';

export interface DressingStyle {
  /** Verge cluster rate per 1.4 m road step and side (0..1, modulated by noise). */
  readonly vergeRate: number;
  /** Per cluster: chance of a bush (when the set has a bush leaf), a flower patch (when it has flowers), small stones. */
  readonly vergeBush: number;
  readonly vergeFlower: number;
  readonly vergeStone: number;
  /** Tufts per verge cluster (min, max). */
  readonly vergeTufts: readonly [number, number];
  /** Small stones round each big rock (min, max), and tufts at its foot. */
  readonly screePerRock: readonly [number, number];
  /** Free scree clusters per m² of open ground inside the playable square (walk-through stones; barren biomes). */
  readonly screeDensity: number;
  /** Crystal shard clusters per m² (0 = none; the set's `props.crystal` surface). */
  readonly shardDensity: number;
  /** Ground-tuft tints (4, multiplied into the card texture): green in the grove, dry / ashen elsewhere. */
  readonly grassTints: readonly [string, string, string, string];
  /** Bush tint source: the palette's foliage tints or the dry grass tints above. */
  readonly bushTint: 'foliage' | 'grass';
  /**
   * Walk-through bush leaf for a set without `bushLeaf` (null = none) and its density per m² (the set's own
   * `density.bush` wins when non-zero). Kept out of `BiomeSet.bushLeaf` so the interior canopies (`foliageOf`) and
   * hand-placed `bush` props keep their look. Always a surface the set already binds.
   */
  readonly bush: SurfaceId | null;
  readonly bushDensity: number;
  /** House-skirt items (picked per slot), and the slots per building wall side (min, max). */
  readonly skirt: readonly SkirtKind[];
  readonly skirtPerSide: readonly [number, number];
  /** Town boundary outside the playable square (`BiomeSet.boundary` decides the build; this adds the gate piers). */
  readonly gatePiers: boolean;
}

const GREEN: DressingStyle['grassTints'] = ['#c9d49c', '#b9c78c', '#d6d9a2', '#c2cf95'];

/** Per-biome dressing. Rates are per verge step (1.4 m) and side; densities per m². */
export const DRESSING: Readonly<Record<Biome, DressingStyle>> = {
  grove: { vergeRate: 0.85, vergeBush: 0.45, vergeFlower: 0.55, vergeStone: 0.35, vergeTufts: [2, 4], screePerRock: [2, 4], screeDensity: 0.002, shardDensity: 0, grassTints: GREEN, bushTint: 'foliage', skirt: ['flowerbox', 'firewood', 'pot', 'flowerbox', 'keg', 'sack'], skirtPerSide: [2, 4], bush: null, bushDensity: 0, gatePiers: true },
  capital: { vergeRate: 0.8, vergeBush: 0.55, vergeFlower: 0.6, vergeStone: 0.2, vergeTufts: [2, 3], screePerRock: [1, 3], screeDensity: 0.001, shardDensity: 0, grassTints: GREEN, bushTint: 'foliage', skirt: ['flowerbox', 'pot', 'flowerbox', 'keg', 'crate_s'], skirtPerSide: [2, 4], bush: null, bushDensity: 0, gatePiers: true },
  vesper: { vergeRate: 0.8, vergeBush: 0.5, vergeFlower: 0, vergeStone: 0.4, vergeTufts: [2, 4], screePerRock: [2, 4], screeDensity: 0.003, shardDensity: 0, grassTints: ['#a8b296', '#9aa48a', '#b4b8a0', '#a2ab94'], bushTint: 'foliage', skirt: ['pot', 'firewood', 'sack', 'keg', 'pot'], skirtPerSide: [2, 4], bush: null, bushDensity: 0, gatePiers: true },
  salt: { vergeRate: 0.75, vergeBush: 0.5, vergeFlower: 0, vergeStone: 0.55, vergeTufts: [2, 4], screePerRock: [2, 5], screeDensity: 0.008, shardDensity: 0, grassTints: ['#d8d6a0', '#c8c890', '#e2dcae', '#cfd09a'], bushTint: 'grass', skirt: ['crate_s', 'keg', 'sack', 'firewood', 'crate_s'], skirtPerSide: [2, 4], bush: 'tall_grass', bushDensity: 0.01, gatePiers: true },
  storm: { vergeRate: 0.75, vergeBush: 0.5, vergeFlower: 0, vergeStone: 0.55, vergeTufts: [2, 3], screePerRock: [2, 5], screeDensity: 0.01, shardDensity: 0, grassTints: ['#b4c09a', '#a6b28e', '#bec6a2', '#aebb96'], bushTint: 'foliage', skirt: ['crate_s', 'keg', 'firewood', 'sack'], skirtPerSide: [2, 3], bush: 'pine_needle', bushDensity: 0.008, gatePiers: true },
  forge: { vergeRate: 0.7, vergeBush: 0.45, vergeFlower: 0, vergeStone: 0.6, vergeTufts: [1, 3], screePerRock: [2, 5], screeDensity: 0.01, shardDensity: 0, grassTints: ['#b8b490', '#aaa684', '#c2bc98', '#b2ae8c'], bushTint: 'foliage', skirt: ['firewood', 'crate_s', 'keg', 'sack', 'firewood'], skirtPerSide: [2, 4], bush: 'pine_needle', bushDensity: 0.006, gatePiers: true },
  sky: { vergeRate: 0.75, vergeBush: 0.5, vergeFlower: 0.45, vergeStone: 0.5, vergeTufts: [2, 3], screePerRock: [2, 4], screeDensity: 0.008, shardDensity: 0, grassTints: ['#c4d0a4', '#b6c498', '#d0d6b0', '#bccaa0'], bushTint: 'foliage', skirt: ['pot', 'firewood', 'flowerbox', 'sack'], skirtPerSide: [2, 3], bush: null, bushDensity: 0, gatePiers: true },
  cinder: { vergeRate: 0.75, vergeBush: 0.5, vergeFlower: 0, vergeStone: 0.75, vergeTufts: [1, 3], screePerRock: [3, 6], screeDensity: 0.022, shardDensity: 0, grassTints: ['#9c8466', '#8e785e', '#a88e70', '#94806a'], bushTint: 'grass', skirt: ['keg', 'sack', 'crate_s', 'firewood'], skirtPerSide: [2, 4], bush: 'tall_grass', bushDensity: 0.006, gatePiers: true },
  marrow: { vergeRate: 0.75, vergeBush: 0.5, vergeFlower: 0, vergeStone: 0.75, vergeTufts: [1, 3], screePerRock: [3, 6], screeDensity: 0.022, shardDensity: 0.005, grassTints: ['#c8b890', '#b8a882', '#d2c29c', '#c0b088'], bushTint: 'grass', skirt: ['crate_s', 'keg', 'sack', 'firewood'], skirtPerSide: [2, 4], bush: 'tall_grass', bushDensity: 0.006, gatePiers: true },
  shrine: { vergeRate: 0.8, vergeBush: 0, vergeFlower: 0, vergeStone: 0.85, vergeTufts: [0, 0], screePerRock: [3, 6], screeDensity: 0.03, shardDensity: 0.012, grassTints: GREEN, bushTint: 'grass', skirt: [], skirtPerSide: [0, 0], bush: null, bushDensity: 0, gatePiers: false },
  rift: { vergeRate: 0.8, vergeBush: 0, vergeFlower: 0, vergeStone: 0.85, vergeTufts: [0, 0], screePerRock: [3, 6], screeDensity: 0.032, shardDensity: 0.014, grassTints: GREEN, bushTint: 'grass', skirt: [], skirtPerSide: [0, 0], bush: null, bushDensity: 0, gatePiers: false },
};

export function dressingFor(biome: Biome): DressingStyle {
  return DRESSING[biome] ?? DRESSING.grove;
}

// ---- verge clusters (walk-through) -------------------------------------------------------------------------------

export type CoverKind = 'bush' | 'flower' | 'tuft' | 'stone' | 'shard';

export interface CoverPoint {
  readonly kind: CoverKind;
  readonly x: number;
  readonly z: number;
  /** 0..1 hash (yaw, tint and scale are derived from it, as the scatter's own kinds do) */
  readonly h: number;
  readonly scale: number;
}

export interface RoadLike { readonly points: readonly (readonly [number, number])[]; readonly width: number; readonly kind: string }

/**
 * Verge clusters along every road and lane (door paths at half the rate): every 1.4 m of centreline, on each side, a cluster with
 * probability `vergeRate × noise` 1.0–3.6 m past the road edge — a bush in the middle (when allowed), tufts round it,
 * a flower patch or small stones beside it. `clear(x, z, r)` is the builder's keep-clear test (plaza, roads, buildings,
 * authored points, water, set-piece, grass patches, pockets, props, lights, obstacles).
 */
export function vergeClusters(roads: readonly RoadLike[], style: DressingStyle, has: { readonly bush: boolean; readonly flower: boolean }, salt: number, clear: (x: number, z: number, r: number) => boolean): CoverPoint[] {
  const out: CoverPoint[] = [];
  if (style.vergeRate <= 0) return out;
  let ri = 0;
  for (const r of roads) {
    ri++;
    // door paths (1.6 m) get half the rate: a garden edge, not a hedge
    const rate = r.kind === 'path' ? style.vergeRate * 0.5 : style.vergeRate;
    for (let i = 0; i + 1 < r.points.length; i++) {
      const a = r.points[i]!; const b = r.points[i + 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-3) continue;
      const tx = (b[0] - a[0]) / len; const tz = (b[1] - a[1]) / len;
      const px = -tz; const pz = tx;
      const steps = Math.max(1, Math.floor(len / 1.4));
      for (let k = 0; k < steps; k++) {
        const t = (k + 0.5) * (len / steps);
        const cx0 = a[0] + tx * t; const cz0 = a[1] + tz * t;
        for (const side of [-1, 1] as const) {
          const hk = hash2(ri * 7919 + i * 131 + k, side, salt + 901);
          const n = (valueNoise(cx0 * 0.11, cz0 * 0.11, salt + 907 + (side > 0 ? 1 : 0)) + 1) / 2;   // 0..1
          if (hk > rate * (0.55 + 0.8 * n)) continue;
          const off = r.width / 2 + 1.0 + hash2(k, i + ri * 31, salt + 911 + side) * 2.6;
          const along = (hash2(i, k + ri * 17, salt + 913 + side) - 0.5) * 1.0;
          const cx = cx0 + px * side * off + tx * along; const cz = cz0 + pz * side * off + tz * along;
          const h1 = hash2(k + ri * 7, i, salt + 917 + side);
          const wantBush = has.bush && h1 < style.vergeBush && off > r.width / 2 + 1.5;
          if (wantBush && clear(cx, cz, 0.9)) {
            out.push({ kind: 'bush', x: cx, z: cz, h: hash2(k, i, salt + 919 + side), scale: 0.7 + h1 * 0.6 });
            // a second, smaller bush beside it half the time (clumps read as a planted verge, singles as noise)
            const a2 = hash2(k + 4, i, salt + 920) * TAU;
            const x2 = cx + Math.cos(a2) * 1.1; const z2 = cz + Math.sin(a2) * 1.1;
            if (hash2(i + 2, k, salt + 918 + side) < 0.5 && clear(x2, z2, 0.7)) out.push({ kind: 'bush', x: x2, z: z2, h: hash2(k, i + 1, salt + 916), scale: 0.5 + h1 * 0.35 });
          }
          const nt = style.vergeTufts[0] + Math.floor(hash2(i, k, salt + 921 + side) * (style.vergeTufts[1] - style.vergeTufts[0] + 1));
          for (let q = 0; q < nt; q++) {
            const ang = hash2(q, k + i * 13, salt + 923 + side) * TAU; const rr = (wantBush ? 0.9 : 0.25) + hash2(q, k, salt + 925) * 0.8;
            const x = cx + Math.cos(ang) * rr; const z = cz + Math.sin(ang) * rr;
            if (clear(x, z, 0.3)) out.push({ kind: 'tuft', x, z, h: hash2(q + 3, k + i, salt + 927), scale: 0.7 + hash2(q, i, salt + 929) * 0.55 });
          }
          if (has.flower && hash2(k, i + 5, salt + 931 + side) < style.vergeFlower) {
            const ang = hash2(k, i, salt + 933) * TAU;
            const x = cx + Math.cos(ang) * 1.1; const z = cz + Math.sin(ang) * 1.1;
            if (clear(x, z, 0.6)) out.push({ kind: 'flower', x, z, h: hash2(k + 9, i, salt + 935), scale: 0.7 + hash2(i, k + 2, salt + 937) * 0.5 });
          }
          if (hash2(k + 1, i, salt + 939 + side) < style.vergeStone) {
            const ns = 1 + Math.floor(hash2(k, i + 7, salt + 941) * 3);
            for (let q = 0; q < ns; q++) {
              const ang = hash2(q, k + i * 3, salt + 943 + side) * TAU; const rr = 0.5 + hash2(q, k, salt + 945) * 1.2;
              const x = cx + Math.cos(ang) * rr; const z = cz + Math.sin(ang) * rr;
              if (clear(x, z, 0.3)) out.push({ kind: 'stone', x, z, h: hash2(q + 5, k + i, salt + 947), scale: 0.22 + hash2(q, i + 3, salt + 949) * 0.3 });
            }
          }
        }
      }
    }
  }
  return out;
}

/**
 * Prop clusters round the big rocks (the solid half of the rock scatter, `rock_a`): small walk-through stones and
 * tufts at the foot, so a boulder reads as an outcrop instead of a single object on bare ground.
 */
export function rockClusters(rocks: readonly { readonly x: number; readonly z: number; readonly scale: number }[], style: DressingStyle, hasTuft: boolean, salt: number, clear: (x: number, z: number, r: number) => boolean): CoverPoint[] {
  const out: CoverPoint[] = [];
  rocks.forEach((rk, i) => {
    const n = style.screePerRock[0] + Math.floor(hash2(i, 1, salt + 951) * (style.screePerRock[1] - style.screePerRock[0] + 1));
    const base = 0.75 * rk.scale + 0.25;
    for (let q = 0; q < n; q++) {
      const ang = hash2(i, q, salt + 953) * TAU; const rr = base + 0.2 + hash2(q, i, salt + 955) * 1.4;
      const x = rk.x + Math.cos(ang) * rr; const z = rk.z + Math.sin(ang) * rr;
      if (clear(x, z, 0.3)) out.push({ kind: 'stone', x, z, h: hash2(q + 11, i, salt + 957), scale: 0.18 + hash2(i, q + 4, salt + 959) * 0.34 });
    }
    if (!hasTuft) return;
    for (let q = 0; q < 3; q++) {
      const ang = hash2(i + 3, q, salt + 961) * TAU; const rr = base + hash2(q + 2, i, salt + 963) * 0.6;
      const x = rk.x + Math.cos(ang) * rr; const z = rk.z + Math.sin(ang) * rr;
      if (clear(x, z, 0.3)) out.push({ kind: 'tuft', x, z, h: hash2(q, i + 9, salt + 965), scale: 0.65 + hash2(q, i, salt + 967) * 0.45 });
    }
  });
  return out;
}

/**
 * Free scree (and crystal-shard) clusters on open ground: one cluster centre per cell of `1/√density`, accepted by a
 * low-frequency noise so they gather in bands, each 3–7 small stones (or 2–4 shards with stones round them).
 */
export function screeClusters(half: number, style: DressingStyle, salt: number, clear: (x: number, z: number, r: number) => boolean): CoverPoint[] {
  const out: CoverPoint[] = [];
  const emit = (density: number, shard: boolean, s: number): void => {
    if (density <= 0) return;
    const cell = 1 / Math.sqrt(density);
    const n = Math.floor((2 * half) / cell);
    for (let gx = 0; gx < n; gx++) for (let gz = 0; gz < n; gz++) {
      const cx = -half + (gx + hash2(gx, gz, s + 1)) * cell; const cz = -half + (gz + hash2(gz, gx, s + 2)) * cell;
      if (valueNoise(cx * 0.05, cz * 0.05, s + 3) < -0.25) continue;     // banded: ≈ 65 % of the cells
      if (!clear(cx, cz, 1.0)) continue;
      const m = shard ? 2 + Math.floor(hash2(gx, gz, s + 4) * 3) : 3 + Math.floor(hash2(gx, gz, s + 4) * 5);
      for (let q = 0; q < m; q++) {
        const ang = hash2(q, gx * 97 + gz, s + 5) * TAU; const rr = Math.sqrt(hash2(gx * 31 + gz, q, s + 6)) * (shard ? 0.9 : 1.6);
        const x = cx + Math.cos(ang) * rr; const z = cz + Math.sin(ang) * rr;
        if (!clear(x, z, 0.3)) continue;
        out.push(shard
          ? { kind: 'shard', x, z, h: hash2(q, gx + gz * 7, s + 7), scale: 0.8 + hash2(gz, q, s + 8) * 0.9 }
          : { kind: 'stone', x, z, h: hash2(q, gx + gz * 7, s + 7), scale: 0.18 + hash2(gz, q, s + 8) * 0.5 });
      }
      if (shard) for (let q = 0; q < 3; q++) {
        const ang = hash2(q + 7, gx + gz, s + 9) * TAU; const rr = 0.9 + hash2(gx, gz + q, s + 10) * 0.8;
        const x = cx + Math.cos(ang) * rr; const z = cz + Math.sin(ang) * rr;
        if (clear(x, z, 0.3)) out.push({ kind: 'stone', x, z, h: hash2(q, gz, s + 11), scale: 0.2 + hash2(q, gx, s + 12) * 0.25 });
      }
    }
  };
  emit(style.screeDensity, false, salt + 971);
  emit(style.shardDensity, true, salt + 991);
  return out;
}

// ---- crystal shard (scatter kind) ---------------------------------------------------------------------------------

/** A cluster of 3–5 hexagonal shards leaning out from a common foot (lod0 6-sided, lod1 4-sided, lod2 one shard). */
export function buildShard(surface: SurfaceId, seed: number): PropGeo {
  const p = createPrng(seed);
  const t = [new Parts(), new Parts(), new Parts()];
  const n = 3 + Math.floor(p.next() * 3);
  for (let k = 0; k < n; k++) {
    const h = 0.35 + p.next() * 0.55; const r = 0.06 + p.next() * 0.06;
    const yaw = p.next() * TAU; const lean = k === 0 ? 0.05 : 0.25 + p.next() * 0.35;
    const prof: [number, number][] = [[r * 0.8, -0.05], [r, h * 0.15], [r, h * 0.78], [0.001, h]];
    const m = trs(Math.cos(yaw) * 0.06 * k, 0, Math.sin(yaw) * 0.06 * k, yaw);
    m.multiply(trs(0, 0, 0).makeRotationX(lean));
    lathe(t[0]!, surface, prof, { segments: 6, smooth: false, capBottom: false }, m);
    if (k < 3) lathe(t[1]!, surface, [prof[0]!, prof[2]!, prof[3]!], { segments: 4, smooth: false, capBottom: false }, m);
    if (k === 0) lathe(t[2]!, surface, [prof[0]!, prof[3]!], { segments: 4, smooth: false, capBottom: false }, m);
  }
  return propGeo(t[0]!, t[1]!, t[2]!, null, [surface]);
}

// ---- house skirt (inside the collider footprint) --------------------------------------------------------------------

/** Deepest a skirt item reaches from its wall (the footprint pad is 0.12 m + the 0.35 m capsule = 0.47 m). */
export const SKIRT_DEPTH_M = 0.46;

export interface SkirtPlacement {
  readonly kind: SkirtKind;
  /** world position on the ground and yaw (the item's local +z faces away from the wall) */
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly seed: number;
}

/**
 * Wall-hugging items round one building: the back and both side walls get `skirtPerSide` slots each, the front wall
 * gets slots only farther than 1.6 m from the door's centre line. Slots keep 0.5 m from the corners. `clear(x, z)`
 * rejects slots near hand-placed props / lights / warp points.
 */
export function skirtPlacements(b: Pick<BuildingSpec, 'id' | 'x' | 'z' | 'yaw' | 'w' | 'd' | 'kind' | 'seed'>, style: DressingStyle, clear: (x: number, z: number) => boolean): SkirtPlacement[] {
  const out: SkirtPlacement[] = [];
  if (style.skirt.length === 0 || b.kind === 'gym') return out;
  const p = createPrng((b.seed ^ 0x5c1e7) >>> 0);
  const c = Math.cos(b.yaw); const s = Math.sin(b.yaw);
  const world = (lx: number, lz: number): [number, number] => [b.x + c * lx + s * lz, b.z - s * lx + c * lz];
  // side: [wall-centre local x, z, along-axis (x or z), length, outward yaw offset]
  const sides: { readonly n: readonly [number, number]; readonly len: number; readonly front: boolean }[] = [
    { n: [0, -1], len: b.w, front: false },
    { n: [1, 0], len: b.d, front: false },
    { n: [-1, 0], len: b.d, front: false },
    { n: [0, 1], len: b.w, front: true },
  ];
  for (const side of sides) {
    const [nx, nz] = side.n;
    const count = style.skirtPerSide[0] + Math.floor(p.next() * (style.skirtPerSide[1] - style.skirtPerSide[0] + 1));
    for (let k = 0; k < count; k++) {
      const u = (p.next() - 0.5) * (side.len - 1.0);
      if (side.front && Math.abs(u) < 1.6) continue;
      const kind = style.skirt[Math.floor(p.next() * style.skirt.length)]!;
      const depth = skirtDepth(kind);
      // the wall plane in local coords: (±w/2, z) or (x, ±d/2)
      const lx = nx !== 0 ? nx * (b.w / 2 + depth / 2 + 0.02) : u;
      const lz = nz !== 0 ? nz * (b.d / 2 + depth / 2 + 0.02) : u;
      const [x, z] = world(lx, lz);
      if (!clear(x, z)) continue;
      const yaw = b.yaw + Math.atan2(nx, nz);
      out.push({ kind, x, z, yaw, seed: (p.next() * 4294967296) >>> 0 });
    }
  }
  return out;
}

function skirtDepth(kind: SkirtKind): number {
  switch (kind) {
    case 'flowerbox': return 0.34;
    case 'firewood': return 0.42;
    case 'sack': return 0.4;
    case 'pot': return 0.36;
    case 'keg': return 0.42;
    case 'crate_s': return 0.42;
  }
}

/** Builds one skirt item (local origin on the ground at the item's centre, +z away from the wall). */
export function buildSkirtItem(set: BiomeSet, kind: SkirtKind, seed: number): PropGeo {
  const st: PropStyle = set.props;
  const p = createPrng(seed);
  const t = [new Parts(), new Parts(), new Parts()];
  const bark = set.trees[0]?.bark ?? st.wood;
  const leaf = set.bushLeaf ?? st.leaf;
  switch (kind) {
    case 'flowerbox': {
      const w = 1.0 + p.next() * 0.5;
      for (const [k, parts] of t.entries()) {
        box(parts, st.wood, 0, 0, 0, w, 0.32, 0.32, 0, k === 0 ? 0.025 : 0.01);
        if (k < 2) box(parts, st.soil, 0, 0.3, 0, w - 0.08, 0.04, 0.24, 0, 0.01);
        const n = k === 0 ? Math.round(w * 5) : k === 1 ? 3 : 0;
        for (let q = 0; q < n; q++) {
          const x = -w / 2 + 0.12 + (q + 0.5) * ((w - 0.24) / n);
          card(parts, leaf, x, 0.26, 0, 0.34, 0.4, p.next() * TAU, -0.2, [x, 0.2, 0], 0.7, [0, 0, 1, 1], true);
        }
      }
      return propGeo(t[0]!, t[1]!, t[2]!, null, [st.wood, st.soil, leaf]);
    }
    case 'firewood': {
      const w = 0.9 + p.next() * 0.5; const rows = 3 + Math.floor(p.next() * 2);
      for (const [k, parts] of t.entries()) {
        if (k === 2) { box(parts, bark, 0, 0, 0, w, rows * 0.17, 0.38, 0, 0.02); continue; }
        for (let r = 0; r < rows; r++) {
          const n = Math.round(w / 0.17) - (r % 2);
          for (let q = 0; q < n; q += k === 0 ? 1 : 2) {
            const x = -w / 2 + 0.085 + (r % 2) * 0.085 + q * 0.17;
            const m = trs(x, 0.085 + r * 0.155, -0.19).multiply(trs(0, 0, 0).makeRotationX(Math.PI / 2));
            lathe(parts, bark, [[0.075, 0], [0.08, 0.04], [0.08, 0.34], [0.075, 0.38]], { segments: k === 0 ? 7 : 5, capTop: true, capBottom: true }, m);
          }
        }
        box(parts, st.wood, 0, 0, 0, w + 0.08, 0.05, 0.4, 0, 0.01);
      }
      return propGeo(t[0]!, t[1]!, t[2]!, null, [bark, st.wood]);
    }
    case 'sack': {
      const n = 1 + Math.floor(p.next() * 3);
      for (const [k, parts] of t.entries()) {
        for (let q = 0; q < (k === 2 ? 1 : n); q++) {
          const r = 0.17 + p.next() * 0.04; const h = 0.5 + p.next() * 0.12;
          lathe(parts, st.cloth, [[r * 0.7, 0], [r, h * 0.25], [r * 0.95, h * 0.7], [r * 0.45, h * 0.92], [0.04, h]], { segments: k === 0 ? 10 : 6, capBottom: false }, trs((q - (n - 1) / 2) * 0.38, 0, 0, p.next() * TAU));
        }
      }
      return propGeo(t[0]!, t[1]!, t[2]!, null, [st.cloth]);
    }
    case 'pot': {
      for (const [k, parts] of t.entries()) {
        lathe(parts, st.stone, [[0.12, 0], [0.17, 0.08], [0.18, 0.3], [0.16, 0.36]], { segments: k === 0 ? 12 : 7, capBottom: true }, trs(0, 0, 0));
        if (k < 2) lathe(parts, st.soil, [[0.15, 0.33], [0.001, 0.34]], { segments: k === 0 ? 10 : 6, smooth: false });
        const n = k === 0 ? 5 : k === 1 ? 3 : 1;
        for (let q = 0; q < n; q++) {
          const a = (q / n) * TAU + p.next();
          card(parts, leaf, Math.cos(a) * 0.03, 0.3, Math.sin(a) * 0.03, 0.27, 0.4, a, -0.25, [0, 0.3, 0], 0.7, [0, 0, 1, 1], true);
        }
      }
      return propGeo(t[0]!, t[1]!, t[2]!, null, [st.stone, st.soil, leaf]);
    }
    case 'keg': {
      const r = 0.2; const h = 0.55;
      for (const [k, parts] of t.entries()) {
        const seg = k === 0 ? 12 : 7;
        lathe(parts, st.wood, [[r * 0.86, 0], [r, h * 0.5], [r * 0.86, h]], { segments: seg, capTop: true, capBottom: true });
        if (k === 0) for (const y of [0.1, 0.9]) lathe(parts, st.metal, [[r * 0.9 + 0.01, h * y - 0.02], [r * 0.9 + 0.02, h * y], [r * 0.9 + 0.01, h * y + 0.02]], { segments: seg, smooth: false });
        if (p.next() < 0.5 && k < 2) lathe(parts, st.wood, [[r * 0.86, h], [r, h + h * 0.5], [r * 0.86, h * 2]], { segments: seg, capTop: true }, trs(0.02, 0.0, 0.01, 0.4));
      }
      return propGeo(t[0]!, t[1]!, t[2]!, null, [st.wood, st.metal]);
    }
    case 'crate_s': {
      const sz = 0.4;
      for (const [k, parts] of t.entries()) {
        box(parts, st.wood, 0, 0, 0, sz * 1.3, sz, sz, 0, k === 0 ? 0.02 : 0.01);
        if (k === 0) {
          box(parts, st.wood, 0, sz - 0.05, 0, sz * 1.3 + 0.02, 0.05, sz + 0.02, 0, 0.008);
          beam(parts, st.wood, [-sz * 0.6, 0.04, sz / 2 + 0.005], [sz * 0.6, sz - 0.06, sz / 2 + 0.005], 0.05, 0.02, 0.006, [0, 0, 1]);
        }
        if (p.next() < 0.45) box(parts, st.wood, 0.05, sz, 0, sz * 0.9, sz * 0.8, sz * 0.9, 0.3, k === 0 ? 0.02 : 0.01);
      }
      return propGeo(t[0]!, t[1]!, t[2]!, null, [st.wood]);
    }
  }
}

// ---- boundary outside the playable square --------------------------------------------------------------------------

/** One element of the boundary line (a run segment or a gate pier), in world space, built by the zone builder. */
export interface BoundaryPiece {
  readonly kind: 'run' | 'pier';
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly len: number;
  readonly seed: number;
}

/** Half width of a road gap in the boundary line (the old per-block rule: 3.8 m either side of the crossing). */
export const GATE_HALF_GAP_M = 3.8;

/**
 * The boundary line of a town at `ih` (just past the walkable edge), broken by a 7.6 m gap where a road crosses it,
 * with a pier either side of each gap. Each stretch between gaps is filled with runs of ≈ 2.8 m that abut each other
 * and the piers. `gaps` are (side, along) crossings (`exitGaps` in the builder).
 */
export function boundaryPieces(ih: number, gaps: readonly { readonly side: 'n' | 's' | 'e' | 'w'; readonly at: number }[], style: DressingStyle, salt: number): BoundaryPiece[] {
  const out: BoundaryPiece[] = [];
  for (const side of ['n', 's', 'e', 'w'] as const) {
    const sideGaps = gaps.filter((g) => g.side === side).map((g) => g.at).sort((a, b) => a - b);
    const at = (along: number): [number, number] => side === 'n' ? [along, -ih] : side === 's' ? [along, ih] : side === 'e' ? [ih, along] : [-ih, along];
    const yaw = side === 'n' || side === 's' ? 0 : Math.PI / 2;
    // stretches [a, b] of the side not inside any gap
    const cuts: [number, number][] = [];
    let a = -ih;
    for (const g of sideGaps) {
      if (g - GATE_HALF_GAP_M > a) cuts.push([a, g - GATE_HALF_GAP_M]);
      a = Math.max(a, g + GATE_HALF_GAP_M);
    }
    if (ih > a) cuts.push([a, ih]);
    let k = 0;
    for (const [s0, s1] of cuts) {
      const n = Math.max(1, Math.round((s1 - s0) / 2.8));
      const len = (s1 - s0) / n;
      for (let i = 0; i < n; i++) {
        const [x, z] = at(s0 + (i + 0.5) * len);
        out.push({ kind: 'run', x, z, yaw, len, seed: (salt + (k++) * 977 + side.charCodeAt(0) * 13) >>> 0 });
      }
    }
    if (!style.gatePiers) continue;
    for (const g of sideGaps) for (const d of [-1, 1]) {
      const [x, z] = at(g + d * GATE_HALF_GAP_M);
      out.push({ kind: 'pier', x, z, yaw, len: 0, seed: (salt + Math.round(g * 10) + d * 31) >>> 0 });
    }
  }
  return out;
}
