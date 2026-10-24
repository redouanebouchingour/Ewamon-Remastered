/**
 * Talk to your own Ewamon (LLM feature 6): World3D's side of the lead's ambient lines. Twice a second the world says
 * where the player is and what is around (`buddySnapshot`: the zone, the clock, the lead and its HP, a rare / shiny /
 * alpha wild creature within range, open water a step away); talk/buddyAmbient.ts decides whether the lead speaks.
 * While a line shows, `bubbleAnchor` projects the follower's head to the page every rendered frame for the bubble.
 */
import { fieldLead } from '@ewa/content';
import type { ZoneDef } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import type { CreatureBillboard } from '@ewa/render';
import type { Camera, Vector3 } from 'three/webgpu';
import { maxHpOf, species as speciesDef } from '../data/content';
import { AMBIENT_SPAWN_RANGE_M, notable } from '../talk/buddyAmbient';
import type { AmbientSnapshot, AmbientSpawn } from '../talk/buddyAmbient';

/** how far (m) open water may be for the lead to notice it */
export const WATER_NEAR_M = 2.5;

/** Open water within `WATER_NEAR_M` of (x, z): eight samples around the player and one under them. */
export function waterNear(water: (x: number, z: number) => boolean, x: number, z: number): boolean {
  if (water(x, z)) return true;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    if (water(x + Math.sin(a) * WATER_NEAR_M, z + Math.cos(a) * WATER_NEAR_M)) return true;
  }
  return false;
}

export interface SpawnLike {
  readonly id: string;
  readonly speciesId: string;
  readonly x: number;
  readonly z: number;
  readonly isShiny: boolean;
  readonly isAlpha: boolean;
  readonly engagedBy: string;
}

export interface BuddyWorld {
  readonly now: number;
  readonly zone: ZoneDef | null;
  readonly timeOfDay: number | null;
  readonly party: readonly CreatureInstance[];
  readonly x: number;
  readonly z: number;
  readonly inBattle: boolean;
  readonly busy: boolean;
  /** the terrain's water test, null when no terrain (a lava zone passes null: its water is lava) */
  readonly water: ((x: number, z: number) => boolean) | null;
  readonly spawns: Iterable<SpawnLike>;
}

/** The snapshot talk/buddyAmbient.ts reads. */
export function buddySnapshot(w: BuddyWorld): AmbientSnapshot {
  const lead = fieldLead(w.party);
  const sp = lead !== null ? speciesDef(lead.speciesId) : undefined;
  const spawns: AmbientSpawn[] = [];
  for (const s of w.spawns) {
    if (s.engagedBy !== '' || Math.hypot(s.x - w.x, s.z - w.z) > AMBIENT_SPAWN_RANGE_M) continue;
    if (notable(s.speciesId, s.isShiny, s.isAlpha)) spawns.push({ id: s.id, speciesId: s.speciesId, shiny: s.isShiny, alpha: s.isAlpha });
  }
  return {
    now: w.now,
    zoneId: w.zone?.id ?? null,
    timeOfDay: w.timeOfDay,
    lead: lead !== null && sp !== undefined ? { id: lead.id, speciesId: lead.speciesId, types: sp.types, hpFrac: Math.max(0, Math.min(1, lead.hp / Math.max(1, maxHpOf(lead)))) } : null,
    inBattle: w.inBattle,
    busy: w.busy,
    nearWater: w.water !== null && waterNear(w.water, w.x, w.z),
    spawns,
  };
}

/** The follower's head on the page (px), or null when it is not drawn or off screen. */
export function bubbleAnchor(bb: CreatureBillboard | null, camera: Camera, rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }, tmp: Vector3): { readonly x: number; readonly y: number } | null {
  if (bb === null) return null;
  const v = bb.topWorld(tmp).project(camera);
  if (v.z < -1 || v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) return null;
  return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
}
