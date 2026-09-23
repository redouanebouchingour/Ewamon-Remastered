/**
 * Every SurfaceId (SPEC §10.2.2), grouped by biome row. The 6 shared ids live in the grove row (Mirevale slice
 * order, the order the audit prints them) and are bound by every zone.
 */

export const GROVE_IDS = [
  'grove_bark', 'grove_leaf_canopy', 'grove_moss', 'path_gravel', 'cobble', 'plaster', 'timber', 'slate_roof',
  'thatch', 'water_pond', 'stone_wall', 'lantern_metal', 'glass_warm', 'dirt', 'tall_grass',
] as const;
export const CINDER_IDS = [
  'cinder_basalt', 'cinder_ash_soil', 'cinder_scoria', 'lava_crust', 'lava_glow', 'obsidian', 'charred_timber',
  'iron_grate', 'forge_brick',
] as const;
export const SALT_IDS = [
  'salt_sand', 'wet_rock', 'barnacle_stone', 'driftwood', 'rope', 'sailcloth', 'harbour_plank', 'sea_water', 'tide_pool',
] as const;
export const STORM_IDS = [
  'storm_slate', 'copper_oxide', 'coil_brass', 'insulator_glass', 'lightning_glass', 'tower_stone', 'wet_flagstone',
] as const;
export const MARROW_IDS = [
  'marrow_sandstone', 'bone_chalk', 'ore_vein', 'mine_timber', 'rail_iron', 'canyon_dust', 'gypsum_crystal',
] as const;
export const VESPER_IDS = [
  'vesper_bark_black', 'grave_moss', 'wrought_iron', 'candle_wax', 'mist_glass', 'willow_leaf', 'bog_water', 'lichen_stone',
] as const;
export const FORGE_IDS = [
  'forge_steel_plate', 'rivet_iron', 'anvil_black', 'coal_glow', 'castle_granite', 'banner_cloth', 'chain',
] as const;
export const SKY_IDS = [
  'sky_marble', 'cloud_stone', 'gold_leaf', 'prayer_silk', 'dragon_scale_tile', 'frost_glass', 'pine_needle', 'snow',
] as const;
export const CAPITAL_IDS = [
  'sun_marble', 'gilt_bronze', 'stained_glass', 'plaza_pale_stone', 'fountain_water', 'laurel_leaf',
] as const;
export const SHRINE_IDS = ['void_glass', 'star_iron', 'eclipse_stone', 'ring_light'] as const;
export const RIFT_IDS = ['rift_shard', 'unmade_stone', 'void_floor'] as const;

export const SURFACE_IDS = [
  ...GROVE_IDS, ...CINDER_IDS, ...SALT_IDS, ...STORM_IDS, ...MARROW_IDS, ...VESPER_IDS, ...FORGE_IDS, ...SKY_IDS,
  ...CAPITAL_IDS, ...SHRINE_IDS, ...RIFT_IDS,
] as const;

/** Union of every id in §10.2.2 (83). */
export type SurfaceId = (typeof SURFACE_IDS)[number];

/** Bound by every zone (§10.2.2). */
export const SHARED_SURFACE_IDS = ['cobble', 'plaster', 'timber', 'stone_wall', 'lantern_metal', 'glass_warm'] as const satisfies readonly SurfaceId[];

export type Biome = 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'capital' | 'shrine' | 'rift';

/** The biome rows of §10.2.2 WITHOUT the shared ids (grove keeps its 15, which already include them). */
export const BIOME_ROWS: Readonly<Record<Biome, readonly SurfaceId[]>> = {
  grove: GROVE_IDS,
  cinder: CINDER_IDS,
  salt: SALT_IDS,
  storm: STORM_IDS,
  marrow: MARROW_IDS,
  vesper: VESPER_IDS,
  forge: FORGE_IDS,
  sky: SKY_IDS,
  capital: CAPITAL_IDS,
  shrine: SHRINE_IDS,
  rift: RIFT_IDS,
};

/** A biome's bound set: its row plus the 6 shared ids, sorted by id (the manifest `byBiome` value). */
export function biomeSurfaceSet(biome: Biome): readonly SurfaceId[] {
  const set = new Set<SurfaceId>([...BIOME_ROWS[biome], ...SHARED_SURFACE_IDS]);
  return [...set].sort();
}

/**
 * Signature surface per biome (§40.3.5 named hero list). Together with the 6 shared ids and every triplanar
 * terrain layer these are the `hero: true` surfaces.
 */
export const SIGNATURE_SURFACES: Readonly<Record<Biome, SurfaceId>> = {
  grove: 'grove_bark',
  cinder: 'lava_crust',
  salt: 'wet_rock',
  storm: 'copper_oxide',
  marrow: 'marrow_sandstone',
  vesper: 'vesper_bark_black',
  forge: 'forge_steel_plate',
  sky: 'sky_marble',
  capital: 'sun_marble',
  shrine: 'void_glass',
  rift: 'rift_shard',
};

export function isSurfaceId(id: string): id is SurfaceId {
  return (SURFACE_IDS as readonly string[]).includes(id);
}
