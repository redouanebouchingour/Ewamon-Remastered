/**
 * SPEC §50.6.1 — the six audit shots and how their anchors resolve from committed data alone (content zone defs,
 * encounter tables, the heightfield, and the zone layout `zoneSpecFor` + render's planners produce). Pure: no DOM, no
 * three construction, no clock — `test/harness-anchors.test.ts` pins every resolved position.
 *
 * Resolution rules (each is recorded in the shot sidecar as `anchor.rule`):
 * - `spawn-noon`: where a player arrives, content `arrivalPoint` — `ZoneDef.spawn` in Mirevale (`(0, 6)`, already on its
 *   plaza, so the committed M2 shots stand) and in every route and story zone; in the other eight towns a plaza-ring
 *   point (their `spawn` is on the west road at `(−50, 0)` / `(−50, −6)`, 50 m from the plaza, with nothing of the town
 *   in frame — M3 audit §1, M3-all-2).
 * - `gym-dusk`: the gym building's door (`doorOf`, the server's league marker `(0, −26)`) + `(0, +8)` in the DOOR frame
 *   (+z = the door's outward normal, +x = that normal turned −90° about y, so a door facing +z reads in world axes).
 * - `sprite-edge`: the encounter table's first `common` slot is the creature; its spawn point is the road-side edge of
 *   the zone layout's first tall-grass patch (`planLayout(spec).grassPatches[0]`): from the patch centre toward the
 *   road centreline (`plan.roadZ`) by `rz + 1.5` m (`SPAWN_EDGE_OUT_M`), i.e. just outside the builder's 0.9 m grass fringe,
 *   snapped to the heightfield (`nearestWalkable`, 8 m). The server draws spawn points from a time-seeded rng
 *   (`ZoneRoom` `worldRng`), so there is no committed spawn point; the patch is where the layout puts wild creatures,
 *   and its edge keeps the sprite out of the tall grass (the patch centre buried a level-2 mossling in grass cards,
 *   which defeats the edge audit). Anchor = spawn + `(−2, +3)` world.
 * - `lamps-night`: the shop building's door + `(+4, +6)` in the door frame. Read in world axes the offset lands inside
 *   the shop (mirevale: world (10.95, 28.16), 0.08 m inside the back wall), because this shop's door faces the plaza
 *   (−z), not +z as the table assumes.
 * - `battle`: the player's position at `battleStart` (`BattleSummary.x/z` = the engaging player's position,
 *   `ZoneRoom.engageSpawn`): the player walks from the `sprite-edge` anchor toward the spawn and engages at 2.5 m
 *   (inside `ENGAGE_RANGE_M` 3.0).
 * - `link-east`: `HANDOVER_INSET` (6 m) west of the `links.e` playable edge point (`edgePoint(layout, 'e')`).
 *
 * Headings: §50.6.1 words say heading 0 = +z forward, 1 = +x, 2 = −z, 3 = −x (the camera LOOKS that way). The rig's
 * heading k (§10.7.1, yaw −35° + 90°·k, camera at target + (sin yaw, cos yaw)·horizontal) looks toward
 * (−sin yaw, −cos yaw): k = 0 looks ≈ −z. The two disagree by 180°; the anchors only frame their subjects with the
 * words' reading (shot 2 looks at the gym, shot 3 at the creature ahead in +x, shot 6 at the east edge), so the
 * harness drives rig heading `(spec + 2) & 3` and records both.
 */
import { ENCOUNTER_TABLES, arrivalPoint, getHeightfield, isWalkable, isWater, nearestWalkable, zone as zoneDef } from '@ewa/content';
import type { EncounterSlot, ZoneDef, ZoneId } from '@ewa/content';
import { HANDOVER_INSET, doorOf, edgePoint, headingYaw, planLayout } from '@ewa/render';
import type { BuildingSpec, ZoneSpec } from '@ewa/render';
import { headingConvention, rigHeading, round2 } from './shotTable';
import type { Heading, ShotDef, ShotId } from './shotTable';

export { AUDIT_SHOTS, VARIANTS, coordTag, headingConvention, rigHeading, round2, setHeadingConvention, shotDef, shotFileStem, shotsForZone } from './shotTable';
export type { Heading, HeadingConvention, ShotDef, ShotId, Variant } from './shotTable';

/** Horizontal view direction (camera → scene) of a rig heading, rounded to 1e-4. */
export function viewForward(rig: Heading): readonly [number, number] {
  const yaw = headingYaw(rig);
  return [round4(-Math.sin(yaw)), round4(-Math.cos(yaw))];
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4 + 0;
}

/** `(dx, dz)` in a door's frame: +z = outward normal `n`, +x = `(n.z, −n.x)`. A door facing +z maps to world axes. */
export function doorFrameOffset(n: { readonly nx: number; readonly nz: number }, dx: number, dz: number): readonly [number, number] {
  return [dx * n.nz + dz * n.nx, dx * -n.nx + dz * n.nz];
}

export interface Snap {
  readonly x: number;
  readonly z: number;
  /** true when the raw point was not walkable and `nearestWalkable` moved it */
  readonly snapped: boolean;
  readonly raw: readonly [number, number];
}

function snapWalkable(z: ZoneDef, x: number, zz: number): Snap {
  const h = getHeightfield(z.id);
  if (isWalkable(h, x, zz)) return { x, z: zz, snapped: false, raw: [x, zz] };
  const p = nearestWalkable(h, x, zz, 8);
  if (p === null) return { x, z: zz, snapped: false, raw: [x, zz] };
  return { x: p[0], z: p[1], snapped: true, raw: [x, zz] };
}

/** How far outside the grass patch ellipse (along z, toward the road) the creature stands: past the 0.9 m fringe. */
export const SPAWN_EDGE_OUT_M = 1.5;

export interface EncounterAnchor {
  readonly slot: EncounterSlot;
  readonly slotIndex: number;
  readonly spawn: Snap;
}

/** The encounter table's first `common` slot and its spawn point (header rule). Null for a zone without a table. */
export function encounterAnchor(z: ZoneDef, spec: ZoneSpec): EncounterAnchor | null {
  if (z.encounterTable === null) return null;
  const table = ENCOUNTER_TABLES.find((t) => t.id === z.encounterTable);
  if (table === undefined) return null;
  const slotIndex = table.slots.findIndex((s) => s.tier === 'common');
  if (slotIndex < 0) return null;
  const slot = table.slots[slotIndex]!;
  const plan = planLayout({
    seed: spec.seed, layout: spec.layout, heightfield: spec.heightfield, edges: spec.edges, actors: spec.actors, pickups: spec.pickups,
    tablets: spec.tablets, warps: spec.warps, tallGrass: spec.tallGrass, setPiece: spec.setPiece,
  });
  const patch = plan.grassPatches[0];
  let cx = patch?.x ?? z.spawn.x;
  let cz = patch?.z ?? z.spawn.z;
  if (patch !== undefined) {
    const toward = Math.sign(plan.roadZ(patch.x) - patch.z) || -1;
    cz = patch.z + toward * (patch.rz + SPAWN_EDGE_OUT_M);
    cx = patch.x;
  }
  const h = getHeightfield(z.id);
  if ((slot.medium ?? 'land') === 'water') {
    return { slot, slotIndex, spawn: { x: cx, z: cz, snapped: false, raw: [cx, cz] } };
  }
  const spawn = isWater(h, cx, cz) ? snapWalkable(z, cx + 0.01, cz) : snapWalkable(z, cx, cz);
  return { slot, slotIndex, spawn };
}

export interface ResolvedAnchor {
  readonly shot: ShotId;
  readonly zone: ZoneId;
  readonly layoutSeed: number;
  /** where the player stands = the camera focus (the diorama follows the player's feet) */
  readonly x: number;
  readonly z: number;
  readonly snapped: boolean;
  readonly raw: readonly [number, number];
  /** one line: how the point was derived (goes into the sidecar) */
  readonly rule: string;
  /** the reference point before the §50.6.1 offset (door, spawn, edge …) */
  readonly base: { readonly name: string; readonly x: number; readonly z: number };
  readonly offset: { readonly dx: number; readonly dz: number; readonly frame: 'world' | 'door' } | null;
  /** sprite-edge / battle: the wild creature */
  readonly wild: { readonly speciesId: string; readonly level: number; readonly slotIndex: number; readonly x: number; readonly z: number } | null;
  /** world-axis reading of a door-frame offset, when it differs (reported, not used) */
  readonly worldReading: readonly [number, number] | null;
  readonly heading: { readonly spec: Heading | null; readonly rig: Heading | null; readonly viewForward: readonly [number, number] | null; readonly convention: 'words' | 'rig' };
}

function buildingOf(spec: ZoneSpec, kind: BuildingSpec['kind']): BuildingSpec | null {
  return spec.buildings.find((b) => b.kind === kind) ?? null;
}

/** 2.5 m: the engage distance the scripted player walks to (server ENGAGE_RANGE_M = 3.0). */
export const ENGAGE_AT_M = 2.5;

/**
 * Resolves one §50.6.1 anchor in `spec`'s zone: the table's rule, else (M3 onward, every zone takes all six rows) the
 * recorded fallback of `fallbackAnchor`. Returns null only when neither applies.
 */
export function resolveAnchor(shot: ShotDef, spec: ZoneSpec): ResolvedAnchor | null {
  return tableAnchor(shot, spec) ?? fallbackAnchor(shot, spec);
}

/** The table's own rule (§50.6.1, header comment). Null when the zone has no such subject. */
export function tableAnchor(shot: ShotDef, spec: ZoneSpec): ResolvedAnchor | null {
  const z = zoneDef(spec.id as ZoneId);
  const rigH = shot.heading === null ? null : rigHeading(shot.heading);
  const heading = { spec: shot.heading, rig: rigH, viewForward: rigH === null ? null : viewForward(rigH), convention: headingConvention() };
  const base = { layoutSeed: z.layoutSeed >>> 0, shot: shot.id, zone: z.id, heading };
  switch (shot.id) {
    case 'spawn-noon': {
      const arr = arrivalPoint(z.id);
      if (arr.rule === 'spawn') {
        const p = snapWalkable(z, z.spawn.x, z.spawn.z);
        return {
          ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw, rule: 'ZoneDef.spawn', base: { name: 'spawn', x: z.spawn.x, z: z.spawn.z },
          offset: null, wild: null, worldReading: null,
        };
      }
      const p = snapWalkable(z, arr.x, arr.z);
      return {
        ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw,
        rule: `arrivalPoint (${arr.rule}, facing the plaza centre; ZoneDef.spawn (${z.spawn.x}, ${z.spawn.z}) is on the road outside the town)`,
        base: { name: 'arrival', x: arr.x, z: arr.z }, offset: null, wild: null, worldReading: null,
      };
    }
    case 'gym-dusk':
    case 'lamps-night': {
      const kind = shot.id === 'gym-dusk' ? 'gym' : 'shop';
      const b = buildingOf(spec, kind);
      if (b === null) return null;
      const door = doorOf(b);
      const [dx, dz] = shot.id === 'gym-dusk' ? [0, 8] : [4, 6];
      const [ox, oz] = doorFrameOffset(door, dx, dz);
      const p = snapWalkable(z, door.x + ox, door.z + oz);
      const world: readonly [number, number] = [round2(door.x + dx), round2(door.z + dz)];
      const differs = Math.abs(world[0] - round2(door.x + ox)) > 0.01 || Math.abs(world[1] - round2(door.z + oz)) > 0.01;
      return {
        ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw,
        rule: `doorOf(${b.id}) + (${dx}, ${dz}) in the door frame (+z = outward normal (${round4(door.nx)}, ${round4(door.nz)}))`,
        base: { name: `${b.id} door`, x: door.x, z: door.z }, offset: { dx, dz, frame: 'door' }, wild: null,
        worldReading: differs ? world : null,
      };
    }
    case 'sprite-edge':
    case 'battle': {
      const e = encounterAnchor(z, spec);
      if (e === null) return null;
      const s = e.spawn;
      const wild = { speciesId: e.slot.species, level: e.slot.levelMin, slotIndex: e.slotIndex, x: s.x, z: s.z };
      const ax = s.x - 2;
      const az = s.z + 3;
      if (shot.id === 'sprite-edge') {
        const p = snapWalkable(z, ax, az);
        return {
          ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw,
          rule: `${z.encounterTable} slot ${e.slotIndex} (${e.slot.species}, first 'common') at the road-side edge of grassPatches[0] (centre + ${SPAWN_EDGE_OUT_M} m past rz toward roadZ)${s.snapped ? ' (snapped)' : ''} + (-2, +3) world`,
          base: { name: `${e.slot.species} spawn`, x: s.x, z: s.z }, offset: { dx: -2, dz: 3, frame: 'world' }, wild, worldReading: null,
        };
      }
      const len = Math.hypot(ax - s.x, az - s.z);
      const k = ENGAGE_AT_M / len;
      const p = snapWalkable(z, s.x + (ax - s.x) * k, s.z + (az - s.z) * k);
      return {
        ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw,
        rule: `BattleSummary.x/z = the engaging player's position: from the sprite-edge anchor toward the ${e.slot.species} spawn, stopping ${ENGAGE_AT_M} m from it (ENGAGE_RANGE_M 3.0)`,
        base: { name: `${e.slot.species} spawn`, x: s.x, z: s.z }, offset: null, wild, worldReading: null,
      };
    }
    case 'link-east': {
      if (spec.edges.e === undefined) return null;
      const [ex, ez] = edgePoint(spec.layout, 'e');
      const p = snapWalkable(z, ex - HANDOVER_INSET, ez);
      return {
        ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw,
        rule: `edgePoint(${spec.layout}, 'e') - ${HANDOVER_INSET} m along x (the links.e handover line, neighbour ${spec.edges.e.toZone})`,
        base: { name: `links.e edge (${spec.edges.e.toZone})`, x: ex, z: ez }, offset: { dx: -HANDOVER_INSET, dz: 0, frame: 'world' }, wild: null, worldReading: null,
      };
    }
  }
}

const EDGE_ORDER = ['e', 'w', 'n', 's'] as const;
/** §50.6.1 heading (words) that looks at each edge: e = 1 (+x), w = 3 (−x), n = 2 (−z), s = 0 (+z). */
const EDGE_HEADING: Readonly<Record<'e' | 'w' | 'n' | 's', Heading>> = { e: 1, w: 3, n: 2, s: 0 };

/**
 * M3 fallbacks where a zone lacks the table's subject (each recorded in `rule`, prefixed "fallback:"):
 * - `gym-dusk` without a gym: the zone's set-piece (its signature) + 8 m past its keep-clear extent along +z;
 * - `lamps-night` without a shop: the generated light nearest the spawn + (+2, +3) world;
 * - `sprite-edge` / `battle` without an encounter table (towns, story zones): the first `common` slot of the first
 *   neighbour (edge order e, w, n, s) that has a table, the creature staged 5 m from the spawn at (+4, +3), snapped;
 *   the player anchors follow the table rules from that point;
 * - `link-east` without an east link: the first other link (w, n, s), 6 m inside that edge, the heading turned to look
 *   at it.
 */
export function fallbackAnchor(shot: ShotDef, spec: ZoneSpec): ResolvedAnchor | null {
  const z = zoneDef(spec.id as ZoneId);
  const rigH = shot.heading === null ? null : rigHeading(shot.heading);
  const heading = { spec: shot.heading, rig: rigH, viewForward: rigH === null ? null : viewForward(rigH), convention: headingConvention() };
  const base = { layoutSeed: z.layoutSeed >>> 0, shot: shot.id, zone: z.id, heading };
  switch (shot.id) {
    case 'spawn-noon': return null;
    case 'gym-dusk': {
      const plan = planLayout({
        seed: spec.seed, layout: spec.layout, heightfield: spec.heightfield, edges: spec.edges, actors: spec.actors, pickups: spec.pickups,
        tablets: spec.tablets, warps: spec.warps, tallGrass: spec.tallGrass, setPiece: spec.setPiece,
      });
      const sp = plan.setPiece;
      const p = snapWalkable(z, sp.x, sp.z + Math.max(sp.hw, sp.hd) + 8);
      return {
        ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw,
        rule: `fallback: no gym — set-piece ${sp.id} + (0, ${round2(Math.max(sp.hw, sp.hd) + 8)}) world (its keep-clear extent + 8 m)`,
        base: { name: `${sp.id}`, x: sp.x, z: sp.z }, offset: { dx: 0, dz: round2(Math.max(sp.hw, sp.hd) + 8), frame: 'world' }, wild: null, worldReading: null,
      };
    }
    case 'lamps-night': {
      let best: { x: number; z: number; id: string } | null = null;
      let bd = Infinity;
      for (const l of spec.lights) {
        const d = Math.hypot(l.position[0] - z.spawn.x, l.position[2] - z.spawn.z);
        if (d < bd) { bd = d; best = { x: l.position[0], z: l.position[2], id: l.id }; }
      }
      if (best === null) return null;
      const p = snapWalkable(z, best.x + 2, best.z + 3);
      return {
        ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw, rule: `fallback: no shop — light ${best.id} (nearest the spawn) + (2, 3) world`,
        base: { name: best.id, x: best.x, z: best.z }, offset: { dx: 2, dz: 3, frame: 'world' }, wild: null, worldReading: null,
      };
    }
    case 'sprite-edge':
    case 'battle': {
      let slot: EncounterSlot | null = null; let slotIndex = -1; let from = '';
      for (const d of EDGE_ORDER) {
        const e = spec.edges[d];
        if (e === undefined) continue;
        const nz = zoneDef(e.toZone as ZoneId);
        const table = nz.encounterTable === null ? undefined : ENCOUNTER_TABLES.find((t) => t.id === nz.encounterTable);
        const i = table?.slots.findIndex((s) => s.tier === 'common' && (s.medium ?? 'land') === 'land') ?? -1;
        if (table !== undefined && i >= 0) { slot = table.slots[i]!; slotIndex = i; from = `${nz.id}:${table.id}`; break; }
      }
      if (slot === null) return null;
      const s = snapWalkable(z, z.spawn.x + 4, z.spawn.z + 3);
      const wild = { speciesId: slot.species, level: slot.levelMin, slotIndex, x: s.x, z: s.z };
      const ax = s.x - 2; const az = s.z + 3;
      if (shot.id === 'sprite-edge') {
        const p = snapWalkable(z, ax, az);
        return {
          ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw,
          rule: `fallback: no encounter table — ${from} slot ${slotIndex} (${slot.species}) staged at spawn + (4, 3)${s.snapped ? ' (snapped)' : ''}, + (-2, +3) world`,
          base: { name: `${slot.species} (staged)`, x: s.x, z: s.z }, offset: { dx: -2, dz: 3, frame: 'world' }, wild, worldReading: null,
        };
      }
      const len = Math.hypot(ax - s.x, az - s.z);
      const k = ENGAGE_AT_M / len;
      const p = snapWalkable(z, s.x + (ax - s.x) * k, s.z + (az - s.z) * k);
      return {
        ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw,
        rule: `fallback: no encounter table — ${from} slot ${slotIndex} (${slot.species}) staged at spawn + (4, 3); the player engages ${ENGAGE_AT_M} m from it`,
        base: { name: `${slot.species} (staged)`, x: s.x, z: s.z }, offset: null, wild, worldReading: null,
      };
    }
    case 'link-east': {
      for (const d of EDGE_ORDER) {
        const e = spec.edges[d];
        if (e === undefined || d === 'e') continue;
        const [ex, ez] = edgePoint(spec.layout, d);
        const [ix, iz] = d === 'w' ? [HANDOVER_INSET, 0] : d === 'n' ? [0, HANDOVER_INSET] : [0, -HANDOVER_INSET];
        const p = snapWalkable(z, ex + ix, ez + iz);
        const sh = EDGE_HEADING[d];
        const rh = rigHeading(sh);
        return {
          ...base, x: p.x, z: p.z, snapped: p.snapped, raw: p.raw,
          rule: `fallback: no east link — edgePoint(${spec.layout}, '${d}') ${HANDOVER_INSET} m inside (the links.${d} handover line, neighbour ${e.toZone}); heading turned to look at it`,
          base: { name: `links.${d} edge (${e.toZone})`, x: ex, z: ez }, offset: { dx: ix, dz: iz, frame: 'world' }, wild: null, worldReading: null,
          heading: { spec: sh, rig: rh, viewForward: viewForward(rh), convention: headingConvention() },
        };
      }
      return null;
    }
  }
}
