/**
 * SPEC §20.4.4 — the content → render adapter. Pure: the same (zone, harvest) gives a byte-identical ZoneSpec
 * (snapshot + determinism test over all 21 zones × 3 harvest states in `test/zoneSpecFor.test.ts`).
 *
 * The field mapping is a table. Everything the adapter decides beyond the ZoneDef — building slots, lamp posts
 * within the Pillar-4 budget, hand-placed props, the primary water body — comes from render's pure layout planners
 * (`planLayout`, `planBuildings`, `planLights`, `planProps`; the same functions the zone builder re-runs, so the two
 * can never disagree) fed with forks of `createRng(zone.layoutSeed)`. Nothing here reads Math.random, Date, or the DOM.
 *
 * Notes (IMPLEMENTATION-NOTES.md in @ewa/render, Part 2): content's `ZoneDef.signature` strings (e.g.
 * 'grove_stone') are story names, not render `SetPieceId`s, so the set-piece is the SPEC §10.5.1 id of the zone's
 * slot in ZONE_ORDER (one per zone, same order); `ZoneSpec.warps` carries each warp door marker plus an arrival
 * marker `${id}:to` at (toX, toZ), because `Marker` has no destination field.
 */
import { createRng } from '@ewa/core';
import { getHeightfield } from '@ewa/content';
import type { HarvestState, LinkDir, ZoneDef, ZoneId } from '@ewa/content';
import {
  BIOME_ROOFS, INTERIOR_SIZE, edgePoint, planBuildings, planLayout, planLights, planProps, waterBodies,
} from '@ewa/render';
import type { Dir, Edge, HarvestLevel, Marker, SetPieceId, WaterSpec, ZoneSpec } from '@ewa/render';

/** SPEC §10.5.1 `SetPieceId`, one per zone, in ZONE_ORDER order. */
export const SET_PIECE_BY_ZONE: Readonly<Record<ZoneId, SetPieceId>> = {
  mirevale: 'grove_heart_tree', mire_route: 'mire_boardwalk', cinderhold: 'cinder_caldera', ash_route: 'ash_lava_bridge',
  saltmourn: 'salt_lighthouse', tide_route: 'tide_wreck', stormrook: 'storm_coil_tower', galvan_route: 'galvan_span',
  marrowdig: 'marrow_mineshaft', deepcut_route: 'deepcut_arch', vesperveil: 'vesper_witch_hut', hollow_route: 'hollow_lantern_road',
  forgewall: 'forge_great_gate', siege_route: 'siege_trebuchet', skyrend: 'sky_shrine', ascent_route: 'ascent_stair',
  solenne: 'solenne_cathedral', eclipse_shrine: 'eclipse_engine', umbral_observatory: 'umbral_dome', celestial_spire: 'celestial_spire',
  the_rift: 'rift_maw',
};

export const HARVEST_LEVEL: Readonly<Record<HarvestState, HarvestLevel>> = { intact: 0, thinning: 1, harvested: 2 };

/** The water kind a biome's heightfield water renders as. */
const WATER_KIND: Readonly<Record<ZoneDef['biome'], WaterSpec['kind']>> = {
  grove: 'pond', cinder: 'lava', salt: 'sea', storm: 'pond', marrow: 'pond', vesper: 'bog', forge: 'pond', sky: 'pond', capital: 'pond',
  shrine: 'pond', rift: 'bog',
};

const LINK_DIRS: readonly LinkDir[] = ['n', 'e', 's', 'w'];

/**
 * Pure. Same (zone, harvest) → byte-identical ZoneSpec. Everything beyond the ZoneDef is drawn from
 * `createRng(zone.layoutSeed)` forks (buildings, lights, props — in that order).
 */
export function zoneSpecFor(zone: ZoneDef, harvest: HarvestState): ZoneSpec {
  const heightfield = getHeightfield(zone.id);                        // spine §3.11: passed through unchanged
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

  const plan = planLayout({ seed, layout, heightfield, edges, actors, pickups, tablets, warps, tallGrass, setPiece });
  const rng = createRng(zone.layoutSeed);
  const buildingRng = rng.fork();
  const lightRng = rng.fork();
  const propRng = rng.fork();
  const roofs = BIOME_ROOFS[zone.biome] ?? BIOME_ROOFS.grove!;
  const buildings = planBuildings({ plan, zoneId: zone.id, gym: zone.gym !== null, shop: zone.shop !== null, healer: zone.healer, roofs: roofs.houses, landmarkRoof: roofs.landmark }, buildingRng);
  const lights = planLights({ plan, zoneId: zone.id, biome: zone.biome, heightfield, buildings, accentType: zone.type }, lightRng);
  const props = planProps({ plan, biome: zone.biome, buildings, lights }, propRng);

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
  };
}
