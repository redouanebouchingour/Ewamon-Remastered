/**
 * Followers with field powers (SPEC §3.18): the party lead walks behind its trainer, and its types do things on the
 * sculpted terrain. Flying glides off a cliff, Fire lights the dark and burns brambles, Ground digs at the travellers'
 * camps, Psychic senses ghost trainers, Water dives at dark-water spots. Pure and deterministic, shared by the server's
 * validation and the client's prediction. Never a story gate: every spot is optional, a glide only ever lands on ground
 * the zone's spawn already reaches, and the existing Cut / Strength obstacles, surfing and fishing are untouched.
 *
 * The spots are their own layer (`data/fieldPowers.ts`), never `ZoneDef`: a bramble is a per-player blocker like a hall
 * gate (a `RectSolid` the server checks in movement validation while the server env FIELD_POWERS is on), not a stamp in
 * the heightfield, so no zone's heightfield digest moves.
 */
import { createRng, formsOf, heldForm } from '@ewa/core';
import type { SpeciesDef, TypeName } from '@ewa/core';
import { getHeightfield, isWalkable, isWater, obstacleAt, playableBounds, sampleHeight, walkableComponent } from './heightfield';
import type { Heightfield } from './heightfield';
import type { PlanEllipse, RectSolid } from './plan';
import { MOVER_RADIUS } from './plan';
import type { ZoneId } from './types';
import { ZONES } from './data/zones';
import { BRAMBLES, DIG_SPOTS, DIVE_SPOTS } from './data/fieldPowers';
import type { BrambleDef, FieldSpotDef } from './data/fieldPowers';

export type { BrambleDef, FieldSpotDef } from './data/fieldPowers';
export { BRAMBLES, DIG_SPOTS, DIVE_SPOTS, DIG_LOOT, DIVE_LOOT } from './data/fieldPowers';

// ─── powers ──────────────────────────────────────────────────────────────────

export type FieldPower = 'glide' | 'light' | 'dig' | 'sense' | 'dive';
export const FIELD_POWERS: readonly FieldPower[] = Object.freeze(['glide', 'light', 'dig', 'sense', 'dive']);

/** The type that gives each power (a dual type with two of these has both). */
export const FIELD_POWER_TYPE: Readonly<Record<FieldPower, TypeName>> = Object.freeze({
  glide: 'Flying',
  light: 'Fire',
  dig: 'Ground',
  sense: 'Psychic',
  dive: 'Water',
});

/** Short label and what it does (the party card and the hint chip). No em-dashes in player copy. */
export const FIELD_POWER_TEXT: Readonly<Record<FieldPower, { readonly label: string; readonly does: string }>> = Object.freeze({
  glide: { label: 'Glide', does: 'Step off a cliff edge to glide down' },
  light: { label: 'Light', does: 'Lights the dark and burns brambles' },
  dig: { label: 'Dig', does: 'Digs up buried items at the camps' },
  sense: { label: 'Sense', does: 'Shows where ghost trainers walk' },
  dive: { label: 'Dive', does: 'Dives at dark water for items' },
});

/** The powers of a creature with these types, in the order of its types. */
export function fieldPowersOf(types: readonly string[]): FieldPower[] {
  const out: FieldPower[] = [];
  for (const t of types) for (const p of FIELD_POWERS) if (FIELD_POWER_TYPE[p] === t && !out.includes(p)) out.push(p);
  return out;
}

/** The lead: the first party creature still standing (the one that walks behind its trainer); null when all fainted. */
export function fieldLead<C extends { readonly hp: number }>(party: readonly C[]): C | null {
  for (const c of party) if (c.hp > 0) return c;
  return null;
}

/**
 * How the lead walks: the types its powers come from and the 1-based slot in `formsOf` of the form its held item opens
 * (core `heldForm`: ravatar holding a relic walks in that form, with that form's types; 0 = the species' own look).
 * The server's lead and the client's chip read the same rule.
 */
export function leadLook(sp: SpeciesDef, heldItem: string | null): { readonly types: readonly TypeName[]; readonly form: number } {
  const f = heldForm(sp, heldItem);
  return f === null ? { types: sp.types, form: 0 } : { types: f.types ?? sp.types, form: formsOf(sp).indexOf(f) + 1 };
}

/** Interact ranges (m) of the targeted powers, measured from the server's accepted position. */
export const FIELD_INTERACT_M = Object.freeze({ burn: 3, dig: 3, dive: 3 });

// ─── spots ───────────────────────────────────────────────────────────────────

/** A bramble patch's blocker half-size (m): the bush (1.1 m) grown by the movement capsule. */
export const BRAMBLE_RADIUS = 1.1;
export const BRAMBLE_SOLID_HALF = BRAMBLE_RADIUS + MOVER_RADIUS;

export const BRAMBLE_PREFIX = 'burnt:';
export const DIG_PREFIX = 'dug:';
export const DIVE_PREFIX = 'dove:';

export function brambleFlag(zoneId: ZoneId, id: string): string {
  return `${BRAMBLE_PREFIX}${zoneId}:${id}`;
}
/** A camp's dig flag: re-armed each UTC day (the flag's set time says when it was last dug). */
export function digFlag(zoneId: ZoneId, id: string): string {
  return `${DIG_PREFIX}${zoneId}:${id}`;
}
export function diveFlag(zoneId: ZoneId, id: string): string {
  return `${DIVE_PREFIX}${zoneId}:${id}`;
}

export function bramblesFor(zoneId: ZoneId): readonly BrambleDef[] {
  return BRAMBLES[zoneId] ?? [];
}
export function digSpotsFor(zoneId: ZoneId): readonly FieldSpotDef[] {
  return DIG_SPOTS[zoneId] ?? [];
}
export function diveSpotsFor(zoneId: ZoneId): readonly FieldSpotDef[] {
  return DIVE_SPOTS[zoneId] ?? [];
}

/** The square blocker of a bramble patch (centre-exclusion shape, the same test as a hall gate's). */
export function brambleSolid(b: { readonly x: number; readonly z: number }): RectSolid {
  return { kind: 'rect', x: b.x, z: b.z, hw: BRAMBLE_SOLID_HALF, hd: BRAMBLE_SOLID_HALF, yaw: 0 };
}

/** The blockers of the brambles in `zoneId` that `flags` says this player has not burnt. */
export function brambleSolidsFor(zoneId: ZoneId, flags: ReadonlySet<string>): RectSolid[] {
  const out: RectSolid[] = [];
  for (const b of bramblesFor(zoneId)) if (!flags.has(brambleFlag(zoneId, b.id))) out.push(brambleSolid(b));
  return out;
}

/** The UTC day key (YYYY-MM-DD) a time falls on: digs and dives re-arm when it turns. */
export function fieldDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whether a spot dug / dived at `setAtMs` (null: never) can be used again at `nowMs` (a new UTC day). */
export function fieldSpotReady(setAtMs: number | null, nowMs: number): boolean {
  return setAtMs === null || fieldDayKey(setAtMs) !== fieldDayKey(nowMs);
}

/** A weighted loot table row. */
export interface FieldLoot { readonly item: string; readonly qty: number; readonly weight: number }

/** The item a dig / dive finds: one draw from `table`, seeded by player, spot and day (the same answer on a retry). */
export function fieldLoot(table: readonly FieldLoot[], seed: string): FieldLoot {
  const rng = createRng(seed);
  let total = 0;
  for (const r of table) total += r.weight;
  let roll = rng.next() * total;
  for (const r of table) {
    roll -= r.weight;
    if (roll < 0) return r;
  }
  return table[table.length - 1]!;
}

// ─── Flying: the glide ───────────────────────────────────────────────────────

export const GLIDE = Object.freeze({
  /** the farthest a glide carries (horizontal m) */
  maxRunM: 24,
  /** metres flown per metre lost: the flier sinks along this line and touches down where it meets the ground */
  ratio: 3,
  /** within this of the line counts as touching down (m) */
  touchM: 0.15,
  /** a landing at least this far below the take-off (m) */
  minDropM: 1.5,
  /** the ray is sampled at this spacing (m) */
  sampleM: 0.25,
  /** standable ground may lie this far ahead of the take-off before the cliff starts (the capsule stops short of it) */
  edgeM: 1.0,
  /** the flight never meets ground higher than the take-off plus this (a wall stops a glide before it starts) */
  climbM: 0.25,
  /** horizontal speed (m/s): protocol MOVEMENT.runSpeed, so the server's run cap covers a glide */
  speedMps: 7.0,
  /** the visual arc's hump over the straight line (m) and its clearance over the ground below it */
  humpM: 0.8,
  clearM: 0.35,
  /** the server's lateral tolerance on the glide line (m) */
  laneM: 0.3,
});

/** A planned glide: from the take-off along the unit direction to the landing `dist` m away. */
export interface GlidePlan {
  readonly x0: number;
  readonly z0: number;
  readonly dx: number;
  readonly dz: number;
  readonly dist: number;
  readonly topY: number;
  readonly landY: number;
}

const MAX_SLOPE2 = 0.7002 * 0.7002;

/**
 * A sample the glide may pass over: inside the playable bounds, not walkable, not water, not a Cut / Strength stamp,
 * and steeper than the walkable limit (the reason it is unwalkable is the cliff, not a house or a trunk on flat ground).
 */
export function cliffSample(h: Heightfield, x: number, z: number): boolean {
  const col = Math.round((x - h.originX) / h.step);
  const row = Math.round((z - h.originZ) / h.step);
  if (col < 1 || row < 1 || col >= h.res - 1 || row >= h.res - 1) return false;
  const b = playableBounds(h);
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
  const i = row * h.res + col;
  if (h.walkable[i] === 1 || h.water[i] === 1) return false;
  if (obstacleAt(h, x, z) !== null) return false;
  const hx = (h.heights[i + 1]! - h.heights[i - 1]!) / (2 * h.step);
  const hz = (h.heights[i + h.res]! - h.heights[i - h.res]!) / (2 * h.step);
  return hx * hx + hz * hz > MAX_SLOPE2;
}

const REACH = new Map<ZoneId, Uint8Array>();

/** The walkable ground the zone's spawn reaches (memoised): a glide only ever lands on it, so it can never strand. */
export function reachFromSpawn(zoneId: ZoneId): Uint8Array {
  let r = REACH.get(zoneId);
  if (r === undefined) {
    const z = ZONES.find((x) => x.id === zoneId);
    const h = getHeightfield(zoneId);
    r = z === undefined ? new Uint8Array(h.res * h.res) : walkableComponent(h, z.spawn.x, z.spawn.z);
    REACH.set(zoneId, r);
  }
  return r;
}

function reached(h: Heightfield, reach: Uint8Array, x: number, z: number): boolean {
  const col = Math.round((x - h.originX) / h.step);
  const row = Math.round((z - h.originZ) / h.step);
  if (col < 0 || row < 0 || col >= h.res || row >= h.res) return false;
  return reach[row * h.res + col] === 1;
}

/**
 * The glide from (x0, z0) along (dx, dz), or null when there is none. The take-off must be standable and at most
 * `GLIDE.edgeM` of standable ground may lie ahead before the drop starts. The flier then sinks along a line of
 * `GLIDE.ratio` metres flown per metre lost, over cliff samples, over the ground below the cliff and over walkable specks
 * the spawn does not reach, and lands where that line meets standable ground the spawn reaches (at least `minDropM`
 * below the take-off), within `maxRunM`. Anything else in the way (a house, water for a non-surfer, the margin, ground
 * rising above the line) ends the flight early at the last landing that qualified, or refuses it. `standable` is the
 * mover's own rule (the server's `standable`, the client collider's `passable`), so a closed gate or an unburnt bramble
 * never becomes a landing.
 */
export function planGlide(
  h: Heightfield,
  x0: number,
  z0: number,
  dirX: number,
  dirZ: number,
  standable: (x: number, z: number) => boolean,
  reach: Uint8Array,
): GlidePlan | null {
  const len = Math.hypot(dirX, dirZ);
  if (!(len > 1e-6) || !Number.isFinite(x0) || !Number.isFinite(z0)) return null;
  const dx = dirX / len;
  const dz = dirZ / len;
  if (!standable(x0, z0)) return null;
  const topY = sampleHeight(h, x0, z0);
  if (!Number.isFinite(topY)) return null;
  let sawDrop = false;
  let landD = -1;
  let landY = 0;
  const n = Math.floor(GLIDE.maxRunM / GLIDE.sampleM);
  for (let k = 1; k <= n; k++) {
    const d = k * GLIDE.sampleM;
    const x = x0 + dx * d;
    const z = z0 + dz * d;
    const gy = sampleHeight(h, x, z);
    if (!Number.isFinite(gy)) break;
    const line = topY - d / GLIDE.ratio;
    const stand = standable(x, z);
    if (!sawDrop) {
      if (gy > topY + GLIDE.climbM) return null;
      if (stand && gy > topY - GLIDE.minDropM) {
        if (d > GLIDE.edgeM) return null;
        continue;
      }
      if (!stand && !isWalkable(h, x, z) && !cliffSample(h, x, z)) return null;
      sawDrop = true;
    }
    if (gy > line + GLIDE.climbM) break; // the ground rises into the flight
    if (stand && isWalkable(h, x, z) && reached(h, reach, x, z)) {
      if (topY - gy >= GLIDE.minDropM) {
        landD = d;
        landY = gy;
      }
      if (gy >= line - GLIDE.touchM) break; // the line meets the ground: touch down
      continue;
    }
    if (stand || isWalkable(h, x, z) || cliffSample(h, x, z)) continue; // a cliff face, a speck, a bramble flown over
    break; // a house, open water, the margin
  }
  return landD < 0 ? null : { x0, z0, dx, dz, dist: landD, topY, landY };
}

/** Where along the plan a point lies: distance along the line and off it (m). */
export function glideProgress(p: GlidePlan, x: number, z: number): { readonly t: number; readonly off: number } {
  const rx = x - p.x0;
  const rz = z - p.z0;
  return { t: rx * p.dx + rz * p.dz, off: Math.abs(rx * p.dz - rz * p.dx) };
}

/**
 * The flier's height at `t` m along the plan (visual): the straight line from the take-off to the landing with a
 * gentle hump, never closer than `clearM` to the ground under it, settling onto the landing.
 */
export function glideAltitude(h: Heightfield, p: GlidePlan, t: number): number {
  const u = p.dist > 0 ? Math.min(1, Math.max(0, t / p.dist)) : 1;
  const line = p.topY + (p.landY - p.topY) * u + 4 * GLIDE.humpM * u * (1 - u);
  const gy = sampleHeight(h, p.x0 + p.dx * t, p.z0 + p.dz * t);
  if (!Number.isFinite(gy)) return line;
  const clear = GLIDE.clearM * Math.min(1, (1 - u) * 6);
  return Math.max(line, gy + clear);
}

// ─── Psychic: ghost haunts ───────────────────────────────────────────────────

/** A ghost walks its haunt at this pace (m/s), looping through a few of the zone's tall-grass patches. */
export const HAUNT = Object.freeze({ speedMps: 0.6, patches: 3, senseRangeM: 90, nearM: 14, senseMs: 12_000, cooldownMs: 6_000 });

function fnv(s: string): number {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) | 0;
  }
  return h >>> 0;
}

/**
 * A ghost's haunt in a zone: a closed loop through `HAUNT.patches` of the zone's tall-grass patches (they step out of
 * the grass), picked from its key (the owner's id) and the zone, so every room and every client agrees. Empty when
 * the zone has no grass.
 */
export function hauntPath(key: string, zoneId: ZoneId, patches: readonly PlanEllipse[]): (readonly [number, number])[] {
  if (patches.length === 0) return [];
  const n = Math.min(HAUNT.patches, patches.length);
  const order = patches.map((_, i) => i);
  let s = fnv(`${zoneId}:${key}`);
  for (let i = order.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) >>> 0;
    const j = s % (i + 1);
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
  }
  const out: (readonly [number, number])[] = [];
  for (let k = 0; k < n; k++) {
    const p = patches[order[k]!]!;
    out.push([Math.round(p.x * 2) / 2, Math.round(p.z * 2) / 2]);
  }
  return out;
}

/** Where on its loop a ghost walks at `atMs` (the loop's first point when it has one point; null when empty). */
export function hauntPosition(path: readonly (readonly [number, number])[], atMs: number): readonly [number, number] | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0]!;
  let total = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!;
    const b = path[(i + 1) % path.length]!;
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  if (!(total > 0)) return path[0]!;
  let d = ((atMs / 1000) * HAUNT.speedMps) % total;
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!;
    const b = path[(i + 1) % path.length]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l && l > 0) return [a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l];
    d -= l;
  }
  return path[0]!;
}

// ─── Fire: dark places ───────────────────────────────────────────────────────

/** Zones dark at any hour: the rift and the story's shrines and observatory (the caves of this world). */
export const DARK_ZONES: ReadonlySet<ZoneId> = new Set<ZoneId>(['the_rift', 'eclipse_shrine', 'umbral_observatory']);

/**
 * Whether a Fire lead's light shows: a dark zone, night (`daylight` < 0.35, render's day cycle), or a zone the honor
 * shadow has darkened to level 3 or more.
 */
export function isDarkHere(zoneId: ZoneId, daylight: number, shadow: number): boolean {
  return DARK_ZONES.has(zoneId) || daylight < 0.35 || shadow >= 3;
}

/** Biomes whose water is lava (the server's `LAVA_BIOMES`): nobody dives there. */
export const LAVA_BIOMES: ReadonlySet<string> = new Set(['cinder']);

/** Open water a diver can go down in (not a boardwalk; lava zones carry no dive spots). */
export function diveWater(h: Heightfield, x: number, z: number): boolean {
  return isWater(h, x, z) && !isWalkable(h, x, z);
}
