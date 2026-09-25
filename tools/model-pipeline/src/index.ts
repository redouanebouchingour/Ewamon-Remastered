/** @ewa/model-pipeline — SPEC §40.2: Quaternius looks + legendaries → meshopt GLBs + models.manifest.json. */
export { LICENCE_COPIES, finaliseManifest, runBuild } from './build.js';
export type { BuildOptions, BuildResult, ModelQa, QaReport } from './build.js';
export { restPoseBounds } from './bounds.js';
export type { Bounds } from './bounds.js';
export { PIPELINE_VERSION, hashKey } from './cache.js';
export { createIO, packGlb, readGlbJson, writeGlbExternalImages } from './glb.js';
export { ENCODER_VERSION, encodeKtx2, isKtx2, probeKtx2, rdoProfile, readKtx2Header, settingsKey } from './ktx2.js';
export type { Ktx2Header, Ktx2Options, RgbaImage } from './ktx2.js';
export { MANIFEST_FILE } from './manifest.js';
export type { ModelEntry, ModelsManifest } from './manifest.js';
export { DEFAULT_OUT_DIR, SRC_DIR } from './paths.js';
export { LOOK_MATERIAL, REST_TRACK_EPSILON, classifyLegendaryTextures, detachAnimation, normalLike, prepareLegendary, prepareLook, pruneRestTracks } from './prepare.js';
export type { QaFlag, TextureRole } from './prepare.js';
export { KEPT_CLIPS, KEPT_CLIP_NAMES, LEGENDARY_CLIP, LEGENDARY_IDS, listSources, lookIdFromStem } from './sets.js';
export type { LegendaryId, SourceFile } from './sets.js';
export { LOD1_SIMPLIFY, SIMPLIFY_ATTRIBUTES, simplifySkinned } from './simplify.js';
export { TEXTURE_PLAN, WEBP_FALLBACK_QUALITY, applyTextures, encodeTexture, textureUri } from './textures.js';
export { MESHOPT_LEVEL, QUANTIZE_BITS, RESAMPLE_TOLERANCE, SEQUENCE_KEY, meshoptCompression, runSequence } from './transform.js';
