/**
 * Phase D10 — Cut / Strength obstacles (`ZoneDef.obstacles`): the rules every package shares.
 *
 * - Footprint: a disc of `OBSTACLE_RADIUS[kind]` (the prop) grown by the 0.35 m capsule, stamped `walkable = 0` into
 *   the heightfield after the plan's footprints and the interiors (`stampObstacles`, nearest-sample semantics like
 *   every walkable test). Only samples that were walkable are stamped, and the stamp records which obstacle owns each
 *   one — a player who cleared an obstacle walks exactly those samples again (heightfield `obstacleAt`), never a
 *   slope, a pond or a house the disc happens to touch.
 * - Clearing: `interact { kind: 'obstacle' }` within `OBSTACLE_INTERACT_M` of its centre, with the HM in the bag
 *   (`OBSTACLE_HM`) and a party member of one of `OBSTACLE_TYPES[kind]`; the server writes `obstacle:<zone>:<id>` and
 *   grants the hidden item once. Per player: other players still see the tree / boulder.
 * - Placement: shortcuts and treasure only, never on a story path (validate keeps every authored point and link band
 *   reachable on the stamped field).
 *
 * Pure; imports nothing but types.
 */
import type { TypeName } from '@ewa/core';
import type { ObstacleDef, ObstacleKind, ZoneId } from './types';

/** The prop's own radius (m): a small tree's crown base / a boulder. */
export const OBSTACLE_RADIUS: Readonly<Record<ObstacleKind, number>> = { tree: 0.7, boulder: 0.95 };
/** protocol MOVEMENT.radius — the stamp grows the prop by the capsule so the walkable bits are centre-exclusion. */
export const OBSTACLE_CAPSULE_M = 0.35;
/** Server interact range from the obstacle's centre (the player stands outside the stamped disc). */
export const OBSTACLE_INTERACT_M = 3;
/** The key item each kind needs (content item ids, granted by story beats since Phase D1). */
export const OBSTACLE_HM: Readonly<Record<ObstacleKind, string>> = { tree: 'HM Cut', boulder: 'HM Strength' };
/**
 * The party types that can do the work. Cut: Grass (vines and blades of leaf), Bug (mandibles), Steel and Dark
 * (edges and claws). Strength: Fighting, Rock, Ground and Steel (mass and muscle).
 */
export const OBSTACLE_TYPES: Readonly<Record<ObstacleKind, readonly TypeName[]>> = {
  tree: ['Grass', 'Bug', 'Steel', 'Dark'],
  boulder: ['Fighting', 'Rock', 'Ground', 'Steel'],
};
export const OBSTACLE_PREFIX = 'obstacle:';

/** The per-player cleared flag. */
export function obstacleFlag(zoneId: ZoneId, id: string): string {
  return `${OBSTACLE_PREFIX}${zoneId}:${id}`;
}

/** Stamp radius: prop + capsule. */
export function obstacleStampRadius(kind: ObstacleKind): number {
  return OBSTACLE_RADIUS[kind] + OBSTACLE_CAPSULE_M;
}

export type ObstacleRefusal = 'needHm' | 'needType';

/**
 * Why `kind` cannot be cleared with this bag and party (null = it can). `partyTypes`: each party member's types
 * (fainted members count: the work is done outside battle).
 */
export function obstacleRefusal(kind: ObstacleKind, inventory: Readonly<Record<string, number>>, partyTypes: readonly (readonly string[])[]): ObstacleRefusal | null {
  if ((inventory[OBSTACLE_HM[kind]] ?? 0) <= 0) return 'needHm';
  const ok = OBSTACLE_TYPES[kind] as readonly string[];
  for (const types of partyTypes) for (const t of types) if (ok.includes(t)) return null;
  return 'needType';
}

/** The toast line for a refusal (client and server share it). */
export function obstacleRefusalText(kind: ObstacleKind, why: ObstacleRefusal): string {
  const what = kind === 'tree' ? 'A small tree blocks the way.' : 'A heavy boulder blocks the way.';
  const types = OBSTACLE_TYPES[kind].join(', ');
  if (why === 'needHm') return `${what} ${kind === 'tree' ? 'It looks like it could be cut.' : 'A strong Ewamon could shove it aside.'}`;
  return `${what} You have ${OBSTACLE_HM[kind]}, but no ${types}-type Ewamon in your party to use it.`;
}

/** The minimal field `stampObstacles` writes (content's Heightfield is structurally one). */
export interface StampField {
  readonly res: number;
  readonly step: number;
  readonly originX: number;
  readonly originZ: number;
  readonly walkable: Uint8Array;
}

/**
 * Sets `walkable = 0` on every walkable sample whose centre lies strictly inside an obstacle's stamp disc and returns
 * sample index → obstacle id (the first obstacle listed wins an overlap). A no-op (empty map) without obstacles, so
 * every other zone's digest is unchanged.
 */
export function stampObstacles(field: StampField, obstacles: readonly ObstacleDef[] | undefined): Map<number, string> {
  const cells = new Map<number, string>();
  if (obstacles === undefined || obstacles.length === 0) return cells;
  const { res, step, originX, originZ, walkable } = field;
  for (const o of obstacles) {
    const r = obstacleStampRadius(o.kind);
    const c0 = Math.max(0, Math.floor((o.x - r - originX) / step));
    const c1 = Math.min(res - 1, Math.ceil((o.x + r - originX) / step));
    const r0 = Math.max(0, Math.floor((o.z - r - originZ) / step));
    const r1 = Math.min(res - 1, Math.ceil((o.z + r - originZ) / step));
    for (let row = r0; row <= r1; row++) {
      const dz = originZ + row * step - o.z;
      for (let col = c0; col <= c1; col++) {
        const dx = originX + col * step - o.x;
        if (dx * dx + dz * dz >= r * r) continue;
        const i = row * res + col;
        if (walkable[i] !== 1 || cells.has(i)) continue;
        walkable[i] = 0;
        cells.set(i, o.id);
      }
    }
  }
  return cells;
}
