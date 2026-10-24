/**
 * §30.2.4 Movement validation — pure. The server never re-simulates; it validates each `input` against the
 * speed cap derived from protocol's MOVEMENT table, the dt budget, the content heightfield and the playable
 * bounds. No Colyseus, DB or clock import (NON-NEGOTIABLE 12).
 */
import { BIKE_ITEM, GLIDE, allZones, glideProgress, isWalkable, isWater, obstacleAt, planGlide, playableBounds, solidContains } from '@ewa/content';
import type { Biome, GlidePlan, Heightfield, RectSolid, ZoneId } from '@ewa/content';
import { MOVEMENT, MOVEMENT_VALIDATION, wrapAngle } from '@ewa/protocol';
import type { InputMsg } from '@ewa/protocol';
import type { z } from 'zod';

export const WALK_SPEED = MOVEMENT.walkSpeed; // 4.2 m/s
export const RUN_SPEED = MOVEMENT.runSpeed; // 7.0 m/s
export const SPEED_TOLERANCE = MOVEMENT_VALIDATION.speedTolerance; // +15 %
export const MAX_WALK_STEP = WALK_SPEED * SPEED_TOLERANCE; // 4.83 m/s
export const MAX_RUN_STEP = RUN_SPEED * SPEED_TOLERANCE; // 8.05 m/s
/** Phase D11: the bicycle (`InputMsg.bike`, granted only to an owner riding outdoors on land) */
export const BIKE_SPEED = MOVEMENT.bikeSpeed; // 10.5 m/s
export const MAX_BIKE_STEP = BIKE_SPEED * SPEED_TOLERANCE; // 12.075 m/s
export const BUDGET_MIN_MS = MOVEMENT_VALIDATION.budgetMinMs; // -100
export const BUDGET_MAX_MS = MOVEMENT_VALIDATION.budgetMaxMs; // 250
/** 0.02 m absorbs float32 quantisation on the wire */
export const QUANTISATION_SLACK = MOVEMENT_VALIDATION.quantisationSlack;
/** the prev → new segment is sampled at this spacing */
export const SEGMENT_SAMPLE_M = MOVEMENT_VALIDATION.segmentSampleM;
/** The key item that makes a water-only sample walkable for a player (§30.3 engage rules). */
export const SURF_ITEM = 'HM Surf';
/** Phase D11: the key item that unlocks the bike cap (content `BIKE_ITEM`). */
export { BIKE_ITEM };

export type RejectReason = 'staleSeq' | 'dtBudget' | 'speed' | 'unwalkable' | 'bounds' | 'inBattle';

export type InputVerdict =
  | {
      readonly ok: true; readonly x: number; readonly z: number; readonly angle: number; readonly running: boolean; readonly budgetMs: number; readonly bike: boolean;
      /** followers: the glide still in flight after this input (null: on the ground) */
      readonly glide: GlidePlan | null;
    }
  | { readonly ok: false; readonly reason: RejectReason; readonly budgetMs: number };

export interface MovePrev {
  readonly x: number;
  readonly z: number;
  readonly lastSeq: number;
  readonly budgetMs: number;
  readonly inBattle: boolean;
  /** inventory['HM Surf'] > 0 — a water-only sample is walkable for this player */
  readonly canSurf?: boolean;
  /**
   * Interior gates still shut for this player (content `gatesClosedFor(...)` `.solid`s, grown by the capsule radius):
   * unwalkable for this player only. Empty / absent in most zones.
   */
  readonly closedGates?: readonly RectSolid[];
  /**
   * Phase D10: ids of this zone's obstacles the player cleared (`obstacle:<zone>:<id>` flags): their stamped samples
   * (content `obstacleAt`) are standable for this player only. Absent / empty in most zones.
   */
  readonly clearedObstacles?: ReadonlySet<string>;
  /**
   * Phase D11: the player owns the bicycle (`inventory.bike > 0`) and stands outdoors (no interior hall): an input
   * flagged `bike` is checked against the bike cap, and its segment must stay on land (no surfing while riding).
   */
  readonly canBike?: boolean;
  /**
   * Followers with field powers (SPEC §3.18): the player may glide (FIELD_POWERS on, a Flying lead, outdoors). An input
   * carrying `glide` takes off along content's `planGlide`; positions on the plan's line are accepted until it lands.
   */
  readonly canGlide?: boolean;
  /** the glide in flight (accepted earlier), null / absent = on the ground */
  readonly glide?: GlidePlan | null;
  /** the walkable ground the zone's spawn reaches (content `reachFromSpawn`): where a glide may land */
  readonly reach?: Uint8Array;
}

export const NO_GATES: readonly RectSolid[] = [];
export const NO_CLEARED: ReadonlySet<string> = new Set<string>();

/** True when (x, z) lies inside one of the player's closed gate solids. */
export function inClosedGate(gates: readonly RectSolid[], x: number, z: number): boolean {
  for (let i = 0; i < gates.length; i++) if (solidContains(gates[i]!, x, z)) return true;
  return false;
}

/**
 * Biomes whose heightfield `water` is lava (SPEC §3.11: `water` covers pond, sea, bog and lava; the client renders
 * cinder water as lava — `zoneSpecFor` WATER_KIND). Content's heightfield has no per-sample water kind, so lava is
 * decided per zone (IMPLEMENTATION-NOTES S11, audit L2-25).
 */
export const LAVA_BIOMES: ReadonlySet<Biome> = new Set<Biome>(['cinder']);
const LAVA_ZONES: ReadonlySet<ZoneId> = new Set(allZones().filter((z) => LAVA_BIOMES.has(z.biome)).map((z) => z.id));

/** A water sample of a lava zone. Open lava is `walkable = 0` in content; HM Surf never makes it standable. */
export function isLava(h: Heightfield, x: number, z: number): boolean {
  return LAVA_ZONES.has(h.zoneId) && isWater(h, x, z);
}

/**
 * A sample is standable: walkable (content's boardwalk strip over a pond — a pier the render draws, lava pond or
 * not — included), a sample stamped by an obstacle this player cleared (Phase D10), or a water sample that is not
 * lava for a surfer; never inside one of the player's closed interior gates.
 */
export function standable(
  h: Heightfield,
  x: number,
  z: number,
  canSurf: boolean,
  gates: readonly RectSolid[] = NO_GATES,
  cleared: ReadonlySet<string> = NO_CLEARED,
): boolean {
  if (gates.length > 0 && inClosedGate(gates, x, z)) return false;
  if (isWalkable(h, x, z)) return true;
  if (cleared.size > 0) {
    const id = obstacleAt(h, x, z);
    if (id !== null && cleared.has(id)) return true;
  }
  return canSurf && isWater(h, x, z) && !isLava(h, x, z);
}

/** Every 0.25 m along prev → next (excluding prev, including next) is standable. */
export function segmentStandable(
  h: Heightfield,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  canSurf: boolean,
  gates: readonly RectSolid[] = NO_GATES,
  cleared: ReadonlySet<string> = NO_CLEARED,
): boolean {
  const dist = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.max(1, Math.ceil(dist / SEGMENT_SAMPLE_M));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!standable(h, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, canSurf, gates, cleared)) return false;
  }
  return true;
}

/** Phase D8: a water sample the walkable mask does not cover (open water, not a boardwalk) — the player is surfing. */
export function onOpenWater(h: Heightfield, x: number, z: number): boolean {
  return isWater(h, x, z) && !isWalkable(h, x, z);
}

export function inBounds(h: Heightfield, x: number, z: number): boolean {
  const b = playableBounds(h);
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

/**
 * Rules in order, first failure wins:
 * 1 staleSeq · 2 inBattle · 3 dtBudget · 4 speed · 5 bounds · 6 unwalkable (segment sampled) · 7 ok.
 *
 * Deviation (IMPLEMENTATION-NOTES S3): the spec lists `unwalkable` (5) before `bounds` (6). The 16 m margin
 * has `walkable = 0`, so with the spec order `bounds` could never be observed; checking bounds first keeps
 * the accept set identical and makes the reason precise.
 */
export function validateInput(prev: MovePrev, input: z.infer<typeof InputMsg>, h: Heightfield): InputVerdict {
  if (input.seq <= prev.lastSeq) return { ok: false, reason: 'staleSeq', budgetMs: prev.budgetMs };
  if (prev.inBattle) return { ok: false, reason: 'inBattle', budgetMs: prev.budgetMs };
  const budget = prev.budgetMs - input.dtMs;
  if (budget < BUDGET_MIN_MS) return { ok: false, reason: 'dtBudget', budgetMs: prev.budgetMs };
  const dist = Math.hypot(input.x - prev.x, input.z - prev.z);
  // Phase D11: the bike cap only for an owner outdoors; an unearned `bike` flag is checked against run / walk
  const bike = input.bike === true && prev.canBike === true;
  const cap = ((bike ? MAX_BIKE_STEP : input.running ? MAX_RUN_STEP : MAX_WALK_STEP) * input.dtMs) / 1000;
  if (!(dist <= cap + QUANTISATION_SLACK)) return { ok: false, reason: 'speed', budgetMs: budget };
  if (!inBounds(h, input.x, input.z)) return { ok: false, reason: 'bounds', budgetMs: budget };
  // a ridden segment never touches open water (no surfing on the bike)
  const canSurf = prev.canSurf === true && !bike;
  const gates = prev.closedGates ?? NO_GATES;
  const cleared = prev.clearedObstacles ?? NO_CLEARED;
  const ok = (glide: GlidePlan | null): InputVerdict => ({ ok: true, x: input.x, z: input.z, angle: wrapAngle(input.angle), running: input.running, budgetMs: budget, bike, glide });
  // followers: a Flying lead glides off a cliff (a take-off, or the glide already in flight)
  const canGlide = prev.canGlide === true && !bike && prev.reach !== undefined;
  let plan: GlidePlan | null = canGlide ? (prev.glide ?? null) : null;
  // a take-off point beyond this message's reach is a glide that already landed (its last window): ignored
  if (canGlide && input.glide !== undefined && Math.hypot(input.glide.x - prev.x, input.glide.z - prev.z) <= cap + QUANTISATION_SLACK) {
    const g = input.glide;
    const same = plan !== null && Math.abs(g.x - plan.x0) < 1e-3 && Math.abs(g.z - plan.z0) < 1e-3;
    if (!same) {
      // a take-off: reached over standable ground from the accepted position, inside this message's budget
      if (plan !== null) return { ok: false, reason: 'unwalkable', budgetMs: budget };
      if (!(Math.hypot(g.x - prev.x, g.z - prev.z) + Math.hypot(input.x - g.x, input.z - g.z) <= cap + QUANTISATION_SLACK + 0.05)) return { ok: false, reason: 'speed', budgetMs: budget };
      if (!standable(h, g.x, g.z, canSurf, gates, cleared) || !segmentStandable(h, prev.x, prev.z, g.x, g.z, canSurf, gates, cleared)) return { ok: false, reason: 'unwalkable', budgetMs: budget };
      plan = planGlide(h, g.x, g.z, g.dx, g.dz, (x, z) => standable(h, x, z, canSurf, gates, cleared), prev.reach!);
      if (plan === null) return { ok: false, reason: 'unwalkable', budgetMs: budget };
    }
  }
  if (plan !== null) {
    const at = glideProgress(plan, input.x, input.z);
    const from = glideProgress(plan, prev.x, prev.z);
    const lane = GLIDE.laneM;
    const onLine = at.off <= lane && at.t >= -lane && at.t <= plan.dist + lane && at.t >= Math.min(from.t, 0) - lane;
    if (onLine) {
      const landed = at.t >= plan.dist - lane && standable(h, input.x, input.z, canSurf, gates, cleared);
      return ok(landed ? null : plan);
    }
    // off the line: only an ordinary step from ground the player can stand on (it ends the glide)
  }
  if (!standable(h, input.x, input.z, canSurf, gates, cleared) || !segmentStandable(h, prev.x, prev.z, input.x, input.z, canSurf, gates, cleared)) {
    return { ok: false, reason: 'unwalkable', budgetMs: budget };
  }
  return ok(null);
}

/** The tick's refill (§30.2.8 step 2): +TICK_MS, clamped at BUDGET_MAX_MS. */
export function refillBudget(budgetMs: number, tickMs: number): number {
  return Math.min(BUDGET_MAX_MS, budgetMs + tickMs);
}
