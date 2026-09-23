/** @ewa/material-bake — SPEC §40.3. */
export { BakeError, LUMINANCE_CEILING, SEAM_TOLERANCE, TIER_SIZE, bakeTier, seamError } from './bake';
export type { BakedTier, SeamReport, Tier } from './bake';
export { PIPELINE_VERSION, readTierMeta, surfaceHash, tiersFor } from './cache';
export type { TierMeta } from './cache';
export { DEFAULT_RDO, encodeKtx2, probeEncoder, settingsKey } from './encode';
export type { Level, MapKind } from './encode';
export { isKtx2, readDfd, readKtx2, writeKtx2 } from './ktx2';
export { MANIFEST_FILE, stableJson, validateManifest } from './manifest';
export type { MaterialSetEntry, MaterialTier, MaterialsManifest } from './manifest';
export { DEFAULT_CACHE_DIR, DEFAULT_OUT_DIR } from './paths';
export { analyse, printReport, readManifest } from './report';
export { FIELD_MAP_TARGET, HERO_MAP_TARGET, MATERIALS_CEILING, assertRecipeTable, runBake, selectIds } from './run';
export type { BakeOptions, BakeResult } from './run';
export { ZONE_BIOME } from './zones';
