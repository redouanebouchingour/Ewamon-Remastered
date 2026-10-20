/**
 * Old-game wild encounters and trainer sight (2026-10-20, the user's call). Pure: no Colyseus, no clock, no
 * Math.random; the room passes its own rng stream and positions.
 *
 * - Wild creatures no longer stand in the overworld (`WILD_ENCOUNTERS=grass`, the default): walking through a tall-grass
 *   patch of the zone plan (content `zonePlan(id).grassPatches`, the same ellipses render grows the grass in) rolls an
 *   encounter per metre walked, and so does surfing on open water (its `water` slots). The roll itself is the fishing
 *   bite's (`rollWild`).
 * - A trainer who has not been beaten sees a player within `SIGHT_M` with nothing solid between them
 *   (`TRAINER_SIGHT=on`, the default): the fight is not optional, the room holds the player until it starts.
 */
import type { RectSolid } from '@ewa/content';
import { isWalkable, isWater, solidContains } from '@ewa/content';
import type { Heightfield, PlanEllipse, TrainerDef } from '@ewa/content';

/** Chance of an encounter per metre walked in tall grass (about one every 14 m, ~3 s at a walk). */
export const GRASS_RATE_PER_M = 0.07;
/** Chance per metre surfed on open water. */
export const SURF_RATE_PER_M = 0.035;
/** A lure doubles the rate (a repel still refuses creatures below the lead's level). */
export const LURE_FACTOR = 2;
/** Metres walked after arriving or after a battle before the grass can roll again. */
export const ENCOUNTER_GRACE_M = 3;
/** Metres of quiet after a refused start (a fainted party): no database read per step. */
export const ENCOUNTER_REFUSED_GRACE_M = 12;

/** How far an unbeaten trainer sees (m). */
export const SIGHT_M = 6;
/** The sight line is sampled this often (m). */
export const SIGHT_SAMPLE_M = 0.5;
/** The room starts the fight itself when the client has not sent the trainer's interact by then. */
export const SPOT_TIMEOUT_MS = 45_000;
/** After a spotted fight could not start (no usable party), the trainer looks away this long. */
export const SPOT_QUIET_MS = 10_000;

/** True inside any tall-grass ellipse of the zone plan. */
export function inTallGrass(patches: readonly PlanEllipse[], x: number, z: number): boolean {
  for (const e of patches) {
    const dx = x - e.x;
    const dz = z - e.z;
    const c = Math.cos(e.yaw);
    const s = Math.sin(e.yaw);
    const lx = c * dx - s * dz;
    const lz = s * dx + c * dz;
    if ((lx * lx) / (e.rx * e.rx) + (lz * lz) / (e.rz * e.rz) <= 1) return true;
  }
  return false;
}

/** The chance that `metres` of movement at `ratePerM` rolls at least one encounter. */
export function encounterChance(metres: number, ratePerM: number): number {
  if (metres <= 0) return 0;
  return 1 - (1 - ratePerM) ** metres;
}

/**
 * Nothing solid between the two points: every sample along the segment is walkable or water (a trainer sees across a
 * pond, not through a wall, a cliff, a building or a gate still shut for this player).
 */
export function lineOfSight(h: Heightfield, closedGates: readonly RectSolid[], ax: number, az: number, bx: number, bz: number): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / SIGHT_SAMPLE_M));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    if (!isWalkable(h, x, z) && !isWater(h, x, z)) return false;
    for (const g of closedGates) if (solidContains(g, x, z)) return false;
  }
  return true;
}

/**
 * The nearest trainer of `trainers` that `eligible` accepts and that sees (x, z), or null. `sameRoom` keeps a hall's
 * trainers to their own hall (and the overworld's to the overworld).
 */
export function spotter(
  trainers: readonly TrainerDef[],
  eligible: (t: TrainerDef) => boolean,
  h: Heightfield,
  closedGates: readonly RectSolid[],
  x: number,
  z: number,
  sameRoom: (t: TrainerDef) => boolean,
): TrainerDef | null {
  let best: TrainerDef | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const t of trainers) {
    const d = Math.hypot(t.x - x, t.z - z);
    if (d > SIGHT_M || d >= bestD) continue;
    if (!eligible(t) || !sameRoom(t)) continue;
    if (!lineOfSight(h, closedGates, t.x, t.z, x, z)) continue;
    best = t;
    bestD = d;
  }
  return best;
}
