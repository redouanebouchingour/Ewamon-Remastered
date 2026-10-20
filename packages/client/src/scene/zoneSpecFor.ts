/**
 * SPEC §20.4.4 — the content → render adapter. Pure: the same (zone, harvest) gives a byte-identical ZoneSpec
 * (snapshot + determinism test over all 21 zones × 3 harvest states in `test/zoneSpecFor.test.ts`).
 *
 * The field mapping is a table. Everything beyond the ZoneDef — roads, plaza, tall grass, building slots, lamp posts
 * within the Pillar-4 budget, hand-placed props — is content's zone plan (`zonePlan(zone.id)`, audit R1): the same
 * plan whose footprints `getHeightfield` stamps into `walkable`, so the server validates movement against exactly the
 * houses, trunks and rocks the builder draws. The adapter copies the plan into `spec.plan` / `buildings` / `props`,
 * composes `lights` from the plan's light positions with render's light tables (`lightsFromPlan`), and derives the
 * primary water body. Nothing here reads Math.random, Date, or the DOM.
 *
 * Notes (IMPLEMENTATION-NOTES.md in @ewa/render, Part 2): content's `ZoneDef.signature` strings (e.g.
 * 'grove_stone') are story names, not render `SetPieceId`s, so the set-piece is content's `SET_PIECE_BY_ZONE` (one
 * per zone, in ZONE_ORDER); `ZoneSpec.warps` carries each warp door marker plus an arrival marker `${id}:to` at
 * (toX, toZ), because `Marker` has no destination field.
 *
 * Phase A: `spec.interiors` is content's placed pockets flattened to render's `InteriorSpec` (`interiorSpecsFor`;
 * `[]` outside towns). The pockets' door warps (`<id>.in` / `<id>.out`) are NOT in `spec.warps` — those markers make
 * render draw a "warp room" at the destination; the pocket itself is the room.
 *
 * Phase D10: `spec.obstacles` is content's `ZoneDef.obstacles` (id, kind, x, z) — present only in zones that have
 * some, so every other zone's spec is unchanged. Which ones a player cleared is per player (`ObstaclesHandle`).
 */
import { SET_PIECE_BY_ZONE, getHeightfield, interiorsFor, zone as zoneDef, zonePlan } from '@ewa/content';
import type { HarvestState, LinkDir, ZoneDef, ZoneId } from '@ewa/content';
import { INTERIOR_SIZE, edgePoint, lightsFromPlan, waterBodies } from '@ewa/render';
import type { Dir, Edge, HarvestLevel, InteriorSpec, Marker, NeighbourSpec, WaterSpec, ZonePlanData, ZoneSpec } from '@ewa/render';

/** SPEC §10.5.1 `SetPieceId`, one per zone, in ZONE_ORDER order (content's table). */
export { SET_PIECE_BY_ZONE };

export const HARVEST_LEVEL: Readonly<Record<HarvestState, HarvestLevel>> = { intact: 0, thinning: 1, harvested: 2 };

/** The water kind a biome's heightfield water renders as. */
const WATER_KIND: Readonly<Record<ZoneDef['biome'], WaterSpec['kind']>> = {
  grove: 'pond', cinder: 'lava', salt: 'sea', storm: 'pond', marrow: 'pond', vesper: 'bog', forge: 'pond', sky: 'pond', capital: 'pond',
  shrine: 'pond', rift: 'bog',
};

const LINK_DIRS: readonly LinkDir[] = ['n', 'e', 's', 'w'];

/**
 * Pure. Same (zone, harvest) → byte-identical ZoneSpec. The layout, buildings, lights and props are content's plan
 * for the zone (seeded from `zone.layoutSeed`), passed through.
 */
export function zoneSpecFor(zone: ZoneDef, harvest: HarvestState): ZoneSpec {
  const heightfield = getHeightfield(zone.id);                        // spine §3.11: passed through unchanged
  const plan = zonePlan(zone.id);                                     // the plan whose footprints the field carries
  const layout = zone.kind;
  const interior = INTERIOR_SIZE[layout];
  const edges: Partial<Record<Dir, Edge>> = {};
  for (const d of LINK_DIRS) {
    const to = zone.links[d];
    if (to === undefined) continue;
    const [x, z] = edgePoint(layout, d);
    edges[d] = { toZone: to, x, z };
  }
  const warps: Marker[] = [];
  for (const w of zone.warps) {
    warps.push({ id: w.id, x: w.x, z: w.z });
    warps.push({ id: `${w.id}:to`, x: w.toX, z: w.toZ });
  }
  const actors = [
    ...zone.npcs.map((n) => ({ id: n.id, look: n.look, x: n.x, z: n.z, kind: 'npc' as const })),
    ...zone.trainers.map((t) => ({ id: t.id, look: t.look, x: t.x, z: t.z, kind: 'trainer' as const })),
  ];
  const pickups = zone.items.map((i) => ({ id: i.id, x: i.x, z: i.z }));
  const tablets = zone.lore.map((l) => ({ id: l.id, x: l.x, z: l.z }));
  const setPiece = SET_PIECE_BY_ZONE[zone.id];
  const tallGrass = zone.encounterTable !== null;
  const seed = zone.layoutSeed >>> 0;

  const buildings = plan.buildings.map((b) => ({ id: b.id, kind: b.kind, x: b.x, z: b.z, yaw: b.yaw, w: b.w, d: b.d, floors: b.floors, roof: b.roof, seed: b.seed }));
  const props = plan.props.map((p) => ({ kind: p.kind, x: p.x, z: p.z, yaw: p.yaw, scale: p.scale, seed: p.seed }));
  const lights = lightsFromPlan(plan.lights, zone.biome, setPiece, zone.type);
  const specPlan: ZonePlanData = {
    plaza: plan.plaza, roads: plan.roads, doorPaths: plan.doorPaths, roadMeander: plan.roadMeander, grassPatches: plan.grassPatches,
    clearings: plan.clearings, setPiece: plan.setPiece, points: plan.points, warpPairs: plan.warpPairs, bridges: plan.bridges, crags: plan.crags, structures: plan.structures,
  };

  // the primary water body (largest) as the WaterSpec; the builder renders every body of the heightfield mask
  let water: WaterSpec | null = null;
  const bodies = waterBodies(heightfield);
  if (bodies.length > 0) {
    let big = bodies[0]!;
    for (const b of bodies) if (b.samples > big.samples) big = b;
    const polygon: (readonly [number, number])[] = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      polygon.push([Math.round((big.cx + Math.cos(a) * big.r) * 100) / 100, Math.round((big.cz + Math.sin(a) * big.r) * 100) / 100]);
    }
    water = { kind: WATER_KIND[zone.biome], level: big.level, polygon };
  }

  return {
    id: zone.id,
    seed,
    biome: zone.biome,
    palette: zone.palette,
    generators: zone.biome,
    layout,
    size: { w: interior, d: interior },
    heightfield,
    warps,
    setPiece,
    edges,
    buildings,
    props,
    lights,
    actors,
    pickups,
    tablets,
    tallGrass,
    water,
    accentType: zone.type,
    harvestLevel: HARVEST_LEVEL[harvest],
    plan: specPlan,
    interiors: interiorSpecsFor(zone.id),
    ...(zone.obstacles !== undefined && zone.obstacles.length > 0 ? { obstacles: zone.obstacles.map((o) => ({ id: o.id, kind: o.kind, x: o.x, z: o.z })) } : {}),
  };
}

const OPPOSITE: Readonly<Record<LinkDir, LinkDir>> = { n: 's', s: 'n', e: 'w', w: 'e' };

/**
 * Phase E3 (audit M2-link-east-1): the linked neighbours' terrain for the skirt (render `ZoneSpec.neighbours`): per link
 * side, the neighbour's heightfield, layout plan, buildings and pockets, and its edge point on the shared link (its
 * playable-edge point on the opposite side). Pure (content's cached heightfields and plans). Kept out of `zoneSpecFor`
 * so its 63-spec snapshot and the geometry digest of a zone built without neighbours stay what they were; the
 * SceneDirector, the harness and the sandbox add it with `withNeighbours`.
 */
export function neighbourSpecsFor(zone: ZoneDef): Partial<Record<Dir, NeighbourSpec>> {
  const out: Partial<Record<Dir, NeighbourSpec>> = {};
  for (const d of LINK_DIRS) {
    const to = zone.links[d];
    if (to === undefined) continue;
    const nb = zoneDef(to);
    const plan = zonePlan(nb.id);
    const [ex, ez] = edgePoint(nb.kind, OPPOSITE[d]);
    out[d] = {
      id: nb.id,
      layout: nb.kind,
      seed: nb.layoutSeed >>> 0,
      heightfield: getHeightfield(nb.id),
      plan: {
        plaza: plan.plaza, roads: plan.roads, doorPaths: plan.doorPaths, roadMeander: plan.roadMeander, grassPatches: plan.grassPatches,
        clearings: plan.clearings, setPiece: plan.setPiece, points: plan.points, warpPairs: plan.warpPairs, bridges: plan.bridges, crags: plan.crags, structures: plan.structures,
      },
      buildings: plan.buildings.map((b) => ({ id: b.id, kind: b.kind, x: b.x, z: b.z, yaw: b.yaw, w: b.w, d: b.d, floors: b.floors, roof: b.roof, seed: b.seed })),
      interiors: interiorSpecsFor(nb.id),
      edge: { x: ex, z: ez },
    };
  }
  return out;
}

/** `spec` plus its zone's neighbours (E3). */
export function withNeighbours(spec: ZoneSpec, zone: ZoneDef): ZoneSpec {
  const neighbours = neighbourSpecsFor(zone);
  return Object.keys(neighbours).length > 0 ? { ...spec, neighbours } : spec;
}

/** Content's placed pockets → render `InteriorSpec` (local frames kept; league ids and flags stay client-side). Pure. */
export function interiorSpecsFor(zoneId: ZoneId): InteriorSpec[] {
  return interiorsFor(zoneId).map((p) => {
    const d = p.def;
    return {
      id: d.id,
      building: d.building,
      template: d.template,
      theme: d.theme,
      x: p.at.x,
      z: p.at.z,
      yaw: p.at.yaw,
      floorY: p.at.floorY,
      w: d.w,
      d: d.d,
      footprint: { x: p.footprint.x, z: p.footprint.z, hw: p.footprint.hw, hd: p.footprint.hd },
      entry: { lx: d.entry.lx, lz: d.entry.lz },
      exit: { lx: d.exit.lx, lz: d.exit.lz },
      walls: d.walls.map((w) => ({ lx: w.lx, lz: w.lz, hw: w.hw, hd: w.hd, style: w.style })),
      gates: d.gates.map((g) => ({ lx: g.rect.lx, lz: g.rect.lz, hw: g.rect.hw, hd: g.rect.hd, id: g.id, style: g.style })),
      switches: d.switches.map((s) => ({ id: s.id, kind: s.kind, lx: s.lx, lz: s.lz })),
      rooms: d.rooms.map((r) => ({
        id: r.id,
        arena: { lx: r.arena.lx, lz: r.arena.lz },
        leaderAt: r.leaderAt === null ? null : { lx: r.leaderAt.lx, lz: r.leaderAt.lz },
        bounds: { lx: r.bounds.lx, lz: r.bounds.lz, hw: r.bounds.hw, hd: r.bounds.hd },
      })),
      props: d.props.map((q) => ({ kind: q.kind, lx: q.lx, lz: q.lz, yaw: q.yaw, scale: q.scale })),
    };
  });
}
