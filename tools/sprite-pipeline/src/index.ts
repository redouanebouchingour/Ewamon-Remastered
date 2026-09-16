/**
 * @ewa/sprite-pipeline — public surface.
 *
 * The client only needs the manifest types; everything else is exported for tests and for
 * other build tools (asset audit, CI checks) that want to reuse a stage.
 */
export type { SpriteManifest, SpriteRect, ManifestAtlas, ManifestSprite, ManifestAnimation, ManifestEncoding } from './manifest.js';
export { MANIFEST_FILE, serializeManifest, validateManifest } from './manifest.js';

export type { QaFlag, AlphaResult } from './alpha.js';
export { recoverAlpha, hasMeaningfulAlpha, floodBackground, defringe, alphaBbox, isMagenta, isNearWhite, INFORMATIONAL_FLAGS } from './alpha.js';

export type { Placement, ResampleKernel, NormalizeResult } from './normalize.js';
export { computePlacement, chooseKernel, normalizeSprite } from './normalize.js';

export type { NormalMapOptions } from './normalmap.js';
export { deriveNormalMap, DEFAULT_NORMAL_OPTIONS } from './normalmap.js';

export { deriveEmissive, saturationTimesLightness, DEFAULT_EMISSIVE_THRESHOLD } from './emissive.js';
export type { EmissiveOverride } from './emissive-overrides.js';
export { EMISSIVE_OVERRIDES } from './emissive-overrides.js';

export type { Rect } from './pack.js';
export { MaxRectsPacker, packSquares, rectsOverlap } from './pack.js';

export type { AtlasGroup, AtlasPlan } from './groups.js';
export { buildGroups, planAtlases, STARTER_ROOTS } from './groups.js';

export type { TextureEncoder, EncodingRequest, TextureKind } from './encode.js';
export { createWebpEncoder, createKtx2Encoder, selectEncoding, probeKtx2, decodeToRgba } from './encode.js';

export type { SpriteSource, SourceResolution } from './sources.js';
export { resolveSources, normalizeName, parseFormFile } from './sources.js';

export type { LegacyData, LegacySpecies } from './legacy.js';
export { loadLegacyData, withEvolutions } from './legacy.js';

export type { BuildOptions, BuildResult, ProcessedSprite, InheritedSide } from './pipeline.js';
export { runBuild, processSprite, spriteCacheKey, findMissingSides, dirBytes } from './pipeline.js';

export type { QaEntry, QaReport, ContactSheetItem } from './qa.js';
export { buildQaReport, renderContactSheet } from './qa.js';

export type { RgbaImage, GrayImage, Bbox, SpriteSide } from './types.js';
export { PIPELINE_VERSION, DEFAULT_SPRITE_SIZE, DEFAULT_ATLAS_SIZE, FOOT_V, FILL_FRACTION, createRgba, createGray } from './types.js';
