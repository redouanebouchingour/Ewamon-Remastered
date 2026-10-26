/**
 * §3.11 Heightfield — the walkable surface, built once from ZoneDef.layoutSeed, sampled by everyone.
 *
 * Pure and deterministic: the only randomness is core's `createRng(zone.layoutSeed)`; every arithmetic step is
 * IEEE double +, −, ×, ÷ and Math.floor/round (no transcendental functions), and every stored height is a
 * multiple of 1/64 m, which Float32 represents exactly — so the digest is identical in Node and in a browser.
 *
 * Layout = value-noise fbm (biome amplitude) + a kind feature (town plaza · route road · story platform) + biome
 * ponds (the `water` mask; each pond carries a boardwalk that is both walkable and water) + a flat, dry clearing
 * around every authored coordinate of the zone (npcs, trainers, items, lore, warps, spawn) so authored points are
 * walkable by construction. `walkable = 0` in the 16 m margin, where the slope exceeds 35°, on open water, and on
 * every footprint of the zone plan (`plan.ts`: buildings, the solid set-piece core, props, lamp posts, tree trunks,
 * big rocks — door approaches and water samples excepted), so the server sees houses and trunks as the client does.
 */
import { createRng } from '@ewa/core';
import type { Rng } from '@ewa/core';
import type { Biome, ZoneDef, ZoneId, ZoneKind } from './types';
import { ZONE_MARGIN, ZONE_SIZE } from './types';
import { ZONES } from './data/zones';
import { planZone, stampFootprints } from './plan';
import type { FootprintStamp, ZonePlan } from './plan';
import { planInteriors, stampInteriors } from './interiors';
import type { InteriorPlan, PlacedInterior } from './interiors';
import { stampObstacles } from './obstacles';
import { stampHideouts } from './data/hideouts';
import { applySculpt, sampleSpline } from './sculpt';
import type { SculptResult, ZoneSculpt } from './sculpt';
import { SCULPTS } from './data/sculpts';
import { LEGENDARY_STATICS } from './data/statics';
import { RAID_HOTSPOTS } from './data/liveops';

export interface Heightfield {
  readonly zoneId: ZoneId;
  /** metres per side (square). town 160 · route 240 · story 200 (§3.1 extents) */
  readonly size: number;
  /** metres between samples */
  readonly step: 0.5;
  /** samples per side = size / step + 1 (town 321, route 481, story 401) */
  readonly res: number;
  /** world x of sample column 0 = -size / 2 */
  readonly originX: number;
  /** world z of sample row 0 = -size / 2 */
  readonly originZ: number;
  /** res * res, index = row * res + col, metres; row ↔ z, col ↔ x */
  readonly heights: Float32Array;
  /** res * res; 1 = walkable */
  readonly walkable: Uint8Array;
  /** res * res; 1 = water surface. A sample may be both walkable and water (boardwalk) */
  readonly water: Uint8Array;
  /** fnv1a32 over the little-endian bytes of `heights`, then `walkable`, then `water`; 8 hex chars */
  readonly digest: string;
}

export const HEIGHTFIELD_STEP = 0.5 as const;
/** tan(35°) — slopes steeper than this are not walkable. */
const MAX_SLOPE = 0.7002;
/** Heights are quantised to this grid (exact in Float32). */
const Q = 64;

export function zoneSizeFor(kind: ZoneKind): number {
  return ZONE_SIZE[kind];
}
export function heightfieldResFor(kind: ZoneKind): number {
  return ZONE_SIZE[kind] / HEIGHTFIELD_STEP + 1;
}

// ─── biome parameters ────────────────────────────────────────────────────────

interface BiomeParams {
  /** fbm amplitude of the base octave, metres */
  readonly amplitude: number;
  /** base octave wavelength, metres */
  readonly wavelength: number;
  /** ponds: count and radius range */
  readonly ponds: number;
  readonly pondRadius: readonly [number, number];
  /** pond depth, metres */
  readonly pondDepth: number;
}

const BIOME: Readonly<Record<Biome, BiomeParams>> = {
  grove: { amplitude: 1.1, wavelength: 36, ponds: 2, pondRadius: [7, 10], pondDepth: 1.2 },
  cinder: { amplitude: 1.8, wavelength: 30, ponds: 1, pondRadius: [5, 7], pondDepth: 0.8 },
  salt: { amplitude: 0.7, wavelength: 40, ponds: 2, pondRadius: [14, 22], pondDepth: 1.5 },
  storm: { amplitude: 1.4, wavelength: 34, ponds: 1, pondRadius: [9, 12], pondDepth: 1.2 },
  marrow: { amplitude: 2.2, wavelength: 28, ponds: 0, pondRadius: [0, 0], pondDepth: 0 },
  vesper: { amplitude: 1.3, wavelength: 32, ponds: 1, pondRadius: [9, 12], pondDepth: 1.4 },
  forge: { amplitude: 1.4, wavelength: 30, ponds: 0, pondRadius: [0, 0], pondDepth: 0 },
  sky: { amplitude: 2.6, wavelength: 34, ponds: 1, pondRadius: [10, 14], pondDepth: 1.6 },
  capital: { amplitude: 0.6, wavelength: 40, ponds: 1, pondRadius: [9, 12], pondDepth: 1.0 },
  shrine: { amplitude: 1.2, wavelength: 34, ponds: 0, pondRadius: [0, 0], pondDepth: 0 },
  rift: { amplitude: 1.9, wavelength: 30, ponds: 2, pondRadius: [12, 16], pondDepth: 2.0 },
};

// ─── value noise ─────────────────────────────────────────────────────────────

interface Noise {
  readonly perm: Uint8Array;
  readonly vals: Float64Array;
  readonly offsets: readonly number[];
}

function makeNoise(rng: Rng): Noise {
  const ids: number[] = [];
  for (let i = 0; i < 256; i++) ids.push(i);
  const perm = new Uint8Array(rng.shuffle(ids));
  const vals = new Float64Array(256);
  for (let i = 0; i < 256; i++) vals[i] = Math.floor(rng.next() * 2048) / 1024 - 1; // [-1, 1), 1/1024 grid
  const offsets: number[] = [];
  for (let i = 0; i < 8; i++) offsets.push(Math.floor(rng.next() * 4096) / 16); // [0, 256), 1/16 grid
  return { perm, vals, offsets };
}

function lattice(n: Noise, ix: number, iz: number): number {
  const a = n.perm[ix & 255]!;
  const b = n.perm[(a + iz) & 255]!;
  return n.vals[b]!;
}

/** Smooth value noise in [-1, 1] with a cubic fade. */
function noise2(n: Noise, x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = lattice(n, ix, iz);
  const b = lattice(n, ix + 1, iz);
  const c = lattice(n, ix, iz + 1);
  const d = lattice(n, ix + 1, iz + 1);
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return top + (bot - top) * v;
}

function fbm(n: Noise, x: number, z: number, amplitude: number, wavelength: number, octaves: number): number {
  let h = 0;
  let amp = amplitude;
  let wl = wavelength;
  for (let o = 0; o < octaves; o++) {
    const ox = n.offsets[(o * 2) & 7]!;
    const oz = n.offsets[(o * 2 + 1) & 7]!;
    h += amp * noise2(n, x / wl + ox, z / wl + oz);
    amp *= 0.5;
    wl *= 0.5;
  }
  return h;
}

// ─── layout ──────────────────────────────────────────────────────────────────

interface Pond {
  readonly cx: number;
  readonly cz: number;
  readonly r: number;
}

function smooth01(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

function authoredPoints(zone: ZoneDef): readonly (readonly [number, number])[] {
  const pts: (readonly [number, number])[] = [[zone.spawn.x, zone.spawn.z]];
  for (const n of zone.npcs) pts.push([n.x, n.z]);
  for (const t of zone.trainers) pts.push([t.x, t.z]);
  for (const i of zone.items) pts.push([i.x, i.z]);
  for (const l of zone.lore) pts.push([l.x, l.z]);
  for (const w of zone.warps) {
    pts.push([w.x, w.z]);
    pts.push([w.toX, w.toZ]);
  }
  return pts;
}

/** A closed polygon's outline sampled every `step` metres along its edges. */
function outline(poly: readonly (readonly [number, number])[], step: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!; const b = poly[(i + 1) % poly.length]!;
    const dx = b[0] - a[0]; const dz = b[1] - a[1];
    const n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dz * dz) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (dx * k) / n, a[1] + (dz * k) / n]);
  }
  return out;
}

/** 16 unit directions (cos, sin of k·22.5°), exact enough for a keep-dry ring. */
const RING: readonly (readonly [number, number])[] = [
  [1, 0], [0.9239, 0.3827], [0.7071, 0.7071], [0.3827, 0.9239], [0, 1], [-0.3827, 0.9239], [-0.7071, 0.7071], [-0.9239, 0.3827],
  [-1, 0], [-0.9239, -0.3827], [-0.7071, -0.7071], [-0.3827, -0.9239], [0, -1], [0.3827, -0.9239], [0.7071, -0.7071], [0.9239, -0.3827],
];

function placePonds(rng: Rng, zone: ZoneDef, half: number, points: readonly (readonly [number, number])[], sculpt: ZoneSculpt | undefined): Pond[] {
  const p = BIOME[zone.biome];
  const ponds: Pond[] = [];
  const count = sculpt?.ponds ?? p.ponds;
  // a sculpted zone keeps its ponds off its roads, rivers and lakes
  const keepDry: (readonly (readonly [number, number])[])[] = [];
  for (const r of sculpt?.roads ?? []) keepDry.push(sampleSpline(r.points, 4));
  for (const r of sculpt?.rivers ?? []) keepDry.push(sampleSpline(r.points, 4));
  for (const l of sculpt?.lakes ?? []) keepDry.push(l.poly);
  // … and off the lifts' edges (a pond dug into a cliff reads as a bite out of it)
  for (const l of sculpt?.lifts ?? []) {
    if (l.poly !== undefined) keepDry.push(outline(l.poly, 4));
    else if (l.line !== undefined) keepDry.push(sampleSpline(l.line.points, 4));
    else if (l.circle !== undefined) { const c = l.circle; const ring: [number, number][] = []; for (let k = 0; k < 16; k++) ring.push([c.x + c.r * RING[k]![0], c.z + c.r * RING[k]![1]]); keepDry.push(ring); }
  }
  const sculptedRoute = zone.kind === 'route' && (sculpt?.roads ?? []).some((r) => r.id === 'road_main');
  const inner = half - ZONE_MARGIN;
  // towns are the small fields: scale the biome's pond radius down so a harbour still fits beside the plaza
  const scale = zone.kind === 'town' ? 0.6 : 1;
  const featureR = zone.kind === 'town' ? 22 : zone.kind === 'story' ? 26 : 0;
  for (let i = 0; i < count; i++) {
    const r = Math.max(4, Math.round(scale * (p.pondRadius[0] + Math.floor(rng.next() * (p.pondRadius[1] - p.pondRadius[0] + 1)))));
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const lim = inner - r - 4;
      const cx = Math.floor((rng.next() * 2 - 1) * lim);
      const cz = Math.floor((rng.next() * 2 - 1) * lim);
      // keep the kind feature (plaza / road / platform) and every authored point dry
      const nearCentre = zone.kind === 'route' ? !sculptedRoute && Math.abs(cz) < r + 12 : cx * cx + cz * cz < (r + featureR) * (r + featureR);
      if (nearCentre) continue;
      let wet = false;
      for (const line of keepDry) {
        for (const [qx, qz] of line) {
          const dx = qx - cx; const dz = qz - cz;
          if (dx * dx + dz * dz < (r + 10) * (r + 10)) { wet = true; break; }
        }
        if (wet) break;
      }
      if (wet) continue;
      let clash = false;
      for (const [px, pz] of points) {
        const dx = px - cx;
        const dz = pz - cz;
        if (dx * dx + dz * dz < (r + 5) * (r + 5)) {
          clash = true;
          break;
        }
      }
      for (const q of ponds) {
        const dx = q.cx - cx;
        const dz = q.cz - cz;
        if (dx * dx + dz * dz < (q.r + r + 8) * (q.r + r + 8)) clash = true;
      }
      if (clash) continue;
      ponds.push({ cx, cz, r });
      placed = true;
    }
  }
  return ponds;
}

/** A zone's heightfield together with the plan whose footprints it carries. */
export interface ZoneSurface {
  readonly heightfield: Heightfield;
  readonly plan: ZonePlan;
  readonly footprints: FootprintStamp;
  /** the town's pockets (one per building), placed after the plan; [] outside towns */
  readonly interiors: readonly PlacedInterior[];
  readonly interiorPlan: InteriorPlan;
  /** Phase D10: sample index → the obstacle whose stamp made it unwalkable (empty in zones without obstacles) */
  readonly obstacleCells: ReadonlyMap<number, string>;
}

/** Deterministic from zone.layoutSeed, zone.kind and zone.biome (value noise + the layout's footprints). */
export function buildHeightfield(zone: ZoneDef): Heightfield {
  return buildZoneSurface(zone).heightfield;
}

/**
 * The terrain field (steps 1–5 below), the zone plan laid out on it (`planZone`), then the plan's footprints
 * stamped into `walkable` (`stampFootprints`) and the digest taken over the result.
 */
export function buildZoneSurface(zone: ZoneDef): ZoneSurface {
  const { field: base, sculpted } = buildTerrainField(zone);
  const plan = planZone(zone, base, sculpted);
  const interiorPlan = planInteriors(zone, plan, base);
  const dropped = new Set(interiorPlan.droppedSolids);
  const footprints = stampFootprints(base, dropped.size === 0 ? plan : { solids: plan.solids.filter((_, i) => !dropped.has(i)), doors: plan.doors });
  stampInteriors(base, interiorPlan.interiors, MAX_SLOPE);
  // Phase D10: Cut / Strength obstacles last (a no-op without `zone.obstacles`, so other digests are unchanged)
  const obstacleCells = stampObstacles(base, zone.obstacles);
  // hideout buildings (data/hideouts.ts) after them (a no-op in zones without one)
  stampHideouts(base, zone.id);
  const digest = digestHeightfield(base.heights, base.walkable, base.water);
  return { heightfield: { ...base, digest }, plan, footprints, interiors: interiorPlan.interiors, interiorPlan, obstacleCells };
}

/** Terrain only: noise, kind feature, sculpt, ponds, clearings; walkable = margin, slope and open water. `digest` is ''. */
function buildTerrainField(zone: ZoneDef): { field: Heightfield; sculpted: SculptResult } {
  const size = ZONE_SIZE[zone.kind];
  const half = size / 2;
  const res = size / HEIGHTFIELD_STEP + 1;
  const originX = -half;
  const originZ = -half;
  const n2 = res * res;
  const heights = new Float32Array(n2);
  const walkable = new Uint8Array(n2);
  const water = new Uint8Array(n2);
  const boardwalk = new Uint8Array(n2);

  const rng = createRng(zone.layoutSeed);
  const noise = makeNoise(rng);
  const sculpt = SCULPTS[zone.id];
  const biome = BIOME[zone.biome];
  const params = sculpt?.rough !== undefined ? { ...biome, amplitude: biome.amplitude * sculpt.rough } : biome;
  const points = authoredPoints(zone);
  const ponds = placePonds(rng, zone, half, points, sculpt);
  const sculptedRoute = zone.kind === 'route' && (sculpt?.roads ?? []).some((r) => r.id === 'road_main');

  const raw = new Float64Array(n2);
  const base = (x: number, z: number): number => fbm(noise, x, z, params.amplitude, params.wavelength, 4);
  const coarse = (x: number, z: number): number => fbm(noise, x, z, params.amplitude, params.wavelength, 1);

  // 1. base terrain + kind feature
  const featureR = zone.kind === 'town' ? 22 : zone.kind === 'story' ? 26 : 0;
  const featureH = coarse(0, 0);
  for (let row = 0; row < res; row++) {
    const z = originZ + row * HEIGHTFIELD_STEP;
    for (let col = 0; col < res; col++) {
      const x = originX + col * HEIGHTFIELD_STEP;
      let h = base(x, z);
      if (sculptedRoute) {
        // the sculpt's own road does the flattening
      } else if (zone.kind === 'route') {
        // a road along z ≈ 0, flattened toward the coarse profile along x
        const t = smooth01((Math.abs(z) - 7) / 6);
        h = coarse(x, 0) + (h - coarse(x, 0)) * t;
      } else {
        const d = Math.floor(Math.sqrt(x * x + z * z) * 64) / 64;
        const t = smooth01((d - featureR) / 12);
        h = featureH + (h - featureH) * t;
      }
      raw[row * res + col] = h;
    }
  }

  // 1b. the zone's sculpt: lifts, hills, lakes, rivers, then its roads (ramps through cliffs, bridges over water)
  const sculpted: SculptResult = sculpt !== undefined
    ? applySculpt({ res, originX, originZ, step: HEIGHTFIELD_STEP }, raw, water, boardwalk, sculpt, (x, z) => noise2(noise, x, z), [
      ...points,
      ...LEGENDARY_STATICS.filter((st) => st.zoneId === zone.id && st.interior === undefined).map((st) => [st.x, st.z] as const),
      ...RAID_HOTSPOTS.filter((rh) => rh.zoneId === zone.id).map((rh) => [rh.x, rh.z] as const),
    ])
    : { roads: [], bridges: [], crags: [], structures: [] };

  // 2. ponds: bowl depression + water mask; a boardwalk strip from the centre to the east rim
  for (const p of ponds) {
    const rimH = raw[Math.round((p.cz - originZ) / HEIGHTFIELD_STEP) * res + Math.round((p.cx - originX) / HEIGHTFIELD_STEP)]!;
    const c0 = Math.max(0, Math.floor((p.cx - p.r - 4 - originX) / HEIGHTFIELD_STEP));
    const c1 = Math.min(res - 1, Math.ceil((p.cx + p.r + 4 - originX) / HEIGHTFIELD_STEP));
    const r0 = Math.max(0, Math.floor((p.cz - p.r - 4 - originZ) / HEIGHTFIELD_STEP));
    const r1 = Math.min(res - 1, Math.ceil((p.cz + p.r + 4 - originZ) / HEIGHTFIELD_STEP));
    for (let row = r0; row <= r1; row++) {
      const z = originZ + row * HEIGHTFIELD_STEP;
      for (let col = c0; col <= c1; col++) {
        const x = originX + col * HEIGHTFIELD_STEP;
        const dx = x - p.cx;
        const dz = z - p.cz;
        const d2 = dx * dx + dz * dz;
        const outer = p.r + 4;
        if (d2 >= outer * outer) continue;
        const i = row * res + col;
        const d = Math.floor(Math.sqrt(d2) * 64) / 64;
        // blend to the rim height, then dig the bowl
        const t = smooth01((d - p.r) / 4);
        let h = rimH + (raw[i]! - rimH) * t;
        if (d < p.r) {
          const u = d / p.r;
          h -= params.pondDepth * (1 - u * u);
          if (d < p.r * 0.82) water[i] = 1;
        }
        if (dz >= -1.5 && dz <= 1.5 && dx >= 0 && dx <= p.r * 0.82 + 1) {
          boardwalk[i] = 1;
          h = rimH;
        }
        raw[i] = h;
      }
    }
  }

  // 3. clearings around authored points: flat within 4 m, blended to 8 m, dry
  for (const [px, pz] of points) {
    const pc = Math.round((px - originX) / HEIGHTFIELD_STEP);
    const pr = Math.round((pz - originZ) / HEIGHTFIELD_STEP);
    if (pc < 0 || pr < 0 || pc >= res || pr >= res) continue;
    const ph = raw[pr * res + pc]!;
    const R = 8;
    const c0 = Math.max(0, pc - R * 2);
    const c1 = Math.min(res - 1, pc + R * 2);
    const r0 = Math.max(0, pr - R * 2);
    const r1 = Math.min(res - 1, pr + R * 2);
    for (let row = r0; row <= r1; row++) {
      const z = originZ + row * HEIGHTFIELD_STEP;
      for (let col = c0; col <= c1; col++) {
        const x = originX + col * HEIGHTFIELD_STEP;
        const dx = x - px;
        const dz = z - pz;
        const d2 = dx * dx + dz * dz;
        if (d2 > R * R) continue;
        const i = row * res + col;
        const d = Math.floor(Math.sqrt(d2) * 64) / 64;
        const t = smooth01((d - 4) / 4);
        raw[i] = ph + (raw[i]! - ph) * t;
        if (d < 4) {
          water[i] = 0;
          boardwalk[i] = 0;
        }
      }
    }
  }

  // 4. quantise to 1/64 m (exact in Float32); `k === 0` guards against -0, whose Float32 bits differ from +0
  for (let i = 0; i < n2; i++) {
    const k = Math.round(raw[i]! * Q);
    heights[i] = k === 0 ? 0 : k / Q;
  }

  // 5. walkable: margin, slope, open water
  const innerLo = ZONE_MARGIN / HEIGHTFIELD_STEP; // first interior sample index
  const innerHi = res - 1 - innerLo; // last interior sample index
  for (let row = 0; row < res; row++) {
    for (let col = 0; col < res; col++) {
      const i = row * res + col;
      if (row <= innerLo || row >= innerHi || col <= innerLo || col >= innerHi) {
        walkable[i] = 0;
        continue;
      }
      const hx = (heights[i + 1]! - heights[i - 1]!) / (2 * HEIGHTFIELD_STEP);
      const hz = (heights[i + res]! - heights[i - res]!) / (2 * HEIGHTFIELD_STEP);
      const slope2 = hx * hx + hz * hz;
      if (slope2 > MAX_SLOPE * MAX_SLOPE) {
        walkable[i] = 0;
        continue;
      }
      if (water[i] === 1 && boardwalk[i] === 0) {
        walkable[i] = 0;
        continue;
      }
      walkable[i] = 1;
    }
  }

  return { field: { zoneId: zone.id, size, step: HEIGHTFIELD_STEP, res, originX, originZ, heights, walkable, water, digest: '' }, sculpted };
}

// ─── digest ──────────────────────────────────────────────────────────────────

function fnvBytes(h: number, bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length; i++) {
    h = (h ^ bytes[i]!) | 0;
    h = Math.imul(h, 0x01000193) | 0;
  }
  return h;
}

/** Little-endian bytes of a Float32Array regardless of the host's endianness. */
export function float32ToLeBytes(a: Float32Array): Uint8Array {
  const out = new Uint8Array(a.length * 4);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < a.length; i++) dv.setFloat32(i * 4, a[i]!, true);
  return out;
}

export function digestHeightfield(heights: Float32Array, walkable: Uint8Array, water: Uint8Array): string {
  let h = 0x811c9dc5 | 0;
  h = fnvBytes(h, float32ToLeBytes(heights));
  h = fnvBytes(h, walkable);
  h = fnvBytes(h, water);
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ─── memo ────────────────────────────────────────────────────────────────────

const ZONE_BY_ID: ReadonlyMap<ZoneId, ZoneDef> = new Map(ZONES.map((z) => [z.id, z]));
const cache = new Map<ZoneId, ZoneSurface>();

/** memoised buildZoneSurface (one build per zone serves getHeightfield and zonePlan) */
export function getZoneSurface(zoneId: ZoneId): ZoneSurface {
  const hit = cache.get(zoneId);
  if (hit !== undefined) return hit;
  const zone = ZONE_BY_ID.get(zoneId);
  if (zone === undefined) throw new RangeError(`unknown zone '${zoneId}'`);
  const s = buildZoneSurface(zone);
  cache.set(zoneId, s);
  return s;
}

/** memoised buildHeightfield */
export function getHeightfield(zoneId: ZoneId): Heightfield {
  return getZoneSurface(zoneId).heightfield;
}

/** The zone's plan (roads, buildings with doors, lights, props, footprints) — the one `getHeightfield` carries. Memoised. */
export function zonePlan(zoneId: ZoneId): ZonePlan {
  return getZoneSurface(zoneId).plan;
}

// ─── sampling ────────────────────────────────────────────────────────────────

function inField(h: Heightfield, x: number, z: number): boolean {
  return x >= h.originX && x <= h.originX + h.size && z >= h.originZ && z <= h.originZ + h.size;
}

/** Bilinear over the 4 surrounding samples. Returns NaN when (x, z) is outside [origin, origin + size]. */
export function sampleHeight(h: Heightfield, x: number, z: number): number {
  if (!inField(h, x, z)) return NaN;
  const fx = (x - h.originX) / h.step;
  const fz = (z - h.originZ) / h.step;
  let c0 = Math.floor(fx);
  let r0 = Math.floor(fz);
  if (c0 >= h.res - 1) c0 = h.res - 2;
  if (r0 >= h.res - 1) r0 = h.res - 2;
  const u = fx - c0;
  const v = fz - r0;
  const i = r0 * h.res + c0;
  const a = h.heights[i]!;
  const b = h.heights[i + 1]!;
  const c = h.heights[i + h.res]!;
  const d = h.heights[i + h.res + 1]!;
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return top + (bot - top) * v;
}

function nearestIndex(h: Heightfield, x: number, z: number): number {
  const col = Math.round((x - h.originX) / h.step);
  const row = Math.round((z - h.originZ) / h.step);
  return row * h.res + col;
}

/** Nearest sample. false outside the field. */
export function isWalkable(h: Heightfield, x: number, z: number): boolean {
  if (!inField(h, x, z)) return false;
  return h.walkable[nearestIndex(h, x, z)] === 1;
}

export function isWater(h: Heightfield, x: number, z: number): boolean {
  if (!inField(h, x, z)) return false;
  return h.water[nearestIndex(h, x, z)] === 1;
}

/**
 * Phase D10: the obstacle whose stamp covers the nearest sample of (x, z), or null — the samples a player who cleared
 * it may stand on again. Only meaningful for the zone's own memoised field (a synthetic test field answers null
 * unless its zone has obstacles).
 */
export function obstacleAt(h: Heightfield, x: number, z: number): string | null {
  if (!inField(h, x, z) || !ZONE_BY_ID.has(h.zoneId)) return null;
  const cells = getZoneSurface(h.zoneId).obstacleCells;
  if (cells.size === 0) return null;
  return cells.get(nearestIndex(h, x, z)) ?? null;
}

/** Nearest walkable sample centre within `radius` metres (spiral, 0.5 m ring step); null when none. */
export function nearestWalkable(h: Heightfield, x: number, z: number, radius: number): readonly [number, number] | null {
  const col0 = Math.round((x - h.originX) / h.step);
  const row0 = Math.round((z - h.originZ) / h.step);
  const K = Math.ceil(radius / h.step);
  let best: readonly [number, number] | null = null;
  let bestD2 = radius * radius;
  const consider = (row: number, col: number): void => {
    if (row < 0 || col < 0 || row >= h.res || col >= h.res) return;
    if (h.walkable[row * h.res + col] !== 1) return;
    const sx = h.originX + col * h.step;
    const sz = h.originZ + row * h.step;
    const d2 = (sx - x) * (sx - x) + (sz - z) * (sz - z);
    if (d2 <= bestD2 && (best === null || d2 < bestD2)) {
      bestD2 = d2;
      best = [sx, sz];
    }
  };
  for (let k = 0; k <= K; k++) {
    if (best !== null && (k - 1) * h.step > Math.sqrt(bestD2)) break; // no later ring can be closer
    if (k === 0) {
      consider(row0, col0);
      continue;
    }
    for (let d = -k; d <= k; d++) {
      consider(row0 - k, col0 + d);
      consider(row0 + k, col0 + d);
    }
    for (let d = -k + 1; d <= k - 1; d++) {
      consider(row0 + d, col0 - k);
      consider(row0 + d, col0 + k);
    }
  }
  return best;
}

/** The playable interior: field extent shrunk by the 16 m margin (§3.1). */
export function playableBounds(h: Heightfield): {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
} {
  return {
    minX: h.originX + ZONE_MARGIN,
    maxX: h.originX + h.size - ZONE_MARGIN,
    minZ: h.originZ + ZONE_MARGIN,
    maxZ: h.originZ + h.size - ZONE_MARGIN,
  };
}

/**
 * The walkable samples connected (4-neighbour) to the nearest walkable sample within 8 m of (x, z): 1 = in the
 * component. All zeros when nothing within 8 m is walkable. Diagonal steps are not counted — a straight move across a
 * shared sample corner is not guaranteed to stay on walkable samples — so this is the conservative reach.
 */
export function walkableComponent(h: Heightfield, x: number, z: number): Uint8Array {
  const out = new Uint8Array(h.res * h.res);
  const p = nearestWalkable(h, x, z, 8);
  if (p === null) return out;
  const start = Math.round((p[1] - h.originZ) / h.step) * h.res + Math.round((p[0] - h.originX) / h.step);
  const stack = [start];
  out[start] = 1;
  while (stack.length > 0) {
    const i = stack.pop()!;
    const row = Math.floor(i / h.res);
    const col = i - row * h.res;
    if (col > 0 && out[i - 1] === 0 && h.walkable[i - 1] === 1) { out[i - 1] = 1; stack.push(i - 1); }
    if (col < h.res - 1 && out[i + 1] === 0 && h.walkable[i + 1] === 1) { out[i + 1] = 1; stack.push(i + 1); }
    if (row > 0 && out[i - h.res] === 0 && h.walkable[i - h.res] === 1) { out[i - h.res] = 1; stack.push(i - h.res); }
    if (row < h.res - 1 && out[i + h.res] === 0 && h.walkable[i + h.res] === 1) { out[i + h.res] = 1; stack.push(i + h.res); }
  }
  return out;
}

/** True when some sample of `component` lies within `radius` m of (x, z) — a player there can interact at that range. */
export function reachableWithin(h: Heightfield, component: Uint8Array, x: number, z: number, radius: number): boolean {
  const c0 = Math.max(0, Math.ceil((x - radius - h.originX) / h.step));
  const c1 = Math.min(h.res - 1, Math.floor((x + radius - h.originX) / h.step));
  const r0 = Math.max(0, Math.ceil((z - radius - h.originZ) / h.step));
  const r1 = Math.min(h.res - 1, Math.floor((z + radius - h.originZ) / h.step));
  for (let row = r0; row <= r1; row++) {
    const sz = h.originZ + row * h.step;
    for (let col = c0; col <= c1; col++) {
      const sx = h.originX + col * h.step;
      if ((sx - x) * (sx - x) + (sz - z) * (sz - z) <= radius * radius && component[row * h.res + col] === 1) return true;
    }
  }
  return false;
}

/** Fraction of all res² samples that are walkable (§3.10 rule 12: ≥ 0.45). */
export function walkableRatio(h: Heightfield): number {
  let n = 0;
  for (let i = 0; i < h.walkable.length; i++) n += h.walkable[i]!;
  return n / h.walkable.length;
}

export function waterRatio(h: Heightfield): number {
  let n = 0;
  for (let i = 0; i < h.water.length; i++) n += h.water[i]!;
  return n / h.water.length;
}

// ─── compact JSON form (dist/heightfields/<zone>.json) ──────────────────────

/**
 * On-disk shape. `heights` are the exact 1/64-m integers, row-major, delta-coded against the previous sample,
 * zig-zag varint packed and base64'd — decoding through `k / 64` reproduces the Float32 bit for bit (every k/64
 * is exact in Float32), so the digest round-trips. `walkable`/`water` are run-length encoded as alternating run
 * lengths starting with a run of 0s.
 */
export interface HeightfieldJson {
  readonly zoneId: ZoneId;
  readonly size: number;
  readonly step: 0.5;
  readonly res: number;
  readonly originX: number;
  readonly originZ: number;
  readonly digest: string;
  readonly encoding: 'q64-delta-varint-b64+rle';
  readonly heights: string;
  readonly walkable: readonly number[];
  readonly water: readonly number[];
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(n >>> 18) & 63]! + B64[(n >>> 12) & 63]! + B64[(n >>> 6) & 63]! + B64[n & 63]!;
  }
  if (i < bytes.length) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const n = (b0 << 16) | (b1 << 8);
    out += B64[(n >>> 18) & 63]! + B64[(n >>> 12) & 63]!;
    out += i + 1 < bytes.length ? B64[(n >>> 6) & 63]! : '=';
    out += '=';
  }
  return out;
}

function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64.indexOf(clean[i]!);
    if (v < 0) throw new RangeError('bad base64');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >>> bits) & 255;
    }
  }
  return out;
}

function rleEncode(a: Uint8Array): number[] {
  const runs: number[] = [];
  let cur = 0;
  let len = 0;
  for (let i = 0; i < a.length; i++) {
    const v = a[i]!;
    if (v === cur) len++;
    else {
      runs.push(len);
      cur = v;
      len = 1;
    }
  }
  runs.push(len);
  return runs;
}

function rleDecode(runs: readonly number[], n: number): Uint8Array {
  const out = new Uint8Array(n);
  let i = 0;
  let v = 0;
  for (const len of runs) {
    if (v === 1) out.fill(1, i, i + len);
    i += len;
    v ^= 1;
  }
  if (i !== n) throw new RangeError(`rle length ${i} !== ${n}`);
  return out;
}

/** Row-major deltas of the 1/64-m integers, zig-zag varint packed. */
function packHeights(heights: Float32Array): Uint8Array {
  const out: number[] = [];
  let prev = 0;
  for (let i = 0; i < heights.length; i++) {
    const k = Math.round(heights[i]! * Q);
    if (k < -2147483648 || k > 2147483647) throw new RangeError(`height ${heights[i]} out of range`);
    const d = k - prev;
    prev = k;
    let z = ((d << 1) ^ (d >> 31)) >>> 0; // zig-zag
    while (z >= 0x80) {
      out.push((z & 0x7f) | 0x80);
      z >>>= 7;
    }
    out.push(z);
  }
  return new Uint8Array(out);
}

function unpackHeights(bytes: Uint8Array, n2: number): Float32Array {
  const heights = new Float32Array(n2);
  let prev = 0;
  let p = 0;
  for (let i = 0; i < n2; i++) {
    let z = 0;
    let shift = 0;
    for (;;) {
      if (p >= bytes.length) throw new RangeError('heights varint stream truncated');
      const b = bytes[p++]!;
      z |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    z >>>= 0;
    const d = (z >>> 1) ^ -(z & 1); // un-zig-zag
    const k = prev + d;
    prev = k;
    heights[i] = k === 0 ? 0 : k / Q;
  }
  if (p !== bytes.length) throw new RangeError(`heights varint stream has ${bytes.length - p} trailing bytes`);
  return heights;
}

export function encodeHeightfield(h: Heightfield): HeightfieldJson {
  return {
    zoneId: h.zoneId,
    size: h.size,
    step: h.step,
    res: h.res,
    originX: h.originX,
    originZ: h.originZ,
    digest: h.digest,
    encoding: 'q64-delta-varint-b64+rle',
    heights: bytesToBase64(packHeights(h.heights)),
    walkable: rleEncode(h.walkable),
    water: rleEncode(h.water),
  };
}

export function decodeHeightfield(j: HeightfieldJson): Heightfield {
  const n2 = j.res * j.res;
  if (j.encoding !== 'q64-delta-varint-b64+rle') throw new RangeError(`unknown heightfield encoding ${String(j.encoding)}`);
  const heights = unpackHeights(base64ToBytes(j.heights), n2);
  const walkable = rleDecode(j.walkable, n2);
  const water = rleDecode(j.water, n2);
  const digest = digestHeightfield(heights, walkable, water);
  if (digest !== j.digest) throw new RangeError(`digest mismatch for ${j.zoneId}: ${digest} !== ${j.digest}`);
  return {
    zoneId: j.zoneId,
    size: j.size,
    step: 0.5,
    res: j.res,
    originX: j.originX,
    originZ: j.originZ,
    heights,
    walkable,
    water,
    digest,
  };
}
