/**
 * @ewa/sprite-pipeline — public surface.
 *
 * The client only needs the manifest types; everything else is exported for tests and for
 * other build tools (asset audit, CI checks) that want to reuse a stage.
 */
export type {
  SpriteManifestV2,
  SpriteRectV2,
  ManifestAtlasV2,
  ManifestMap,
  ManifestSpriteV2,
  ManifestAnimAtlas,
  ManifestAnimSide,
  ManifestAnimSprite,
  SpriteCodec,
  ValidateOptions,
} from './manifest.js';
export { MANIFEST_FILE, serializeManifest, staticManifest, validateManifest, manifestErrors, pxToUv } from './manifest.js';

export type { AnimMasterPlacement, AnimGrid, AnimSideMeta, AnimFrameRasters, AnimSideContext, ProcessedAnimSide, AnimAtlasRasters, AnimJob, AnimEncodeResult } from './anim.js';
export {
  AnimCache,
  ANIM_EXTRA_RUNGS,
  animLadderRungs,
  animMasterPlacement,
  animGrid,
  animFramePx,
  animAtlasId,
  animFileName,
  animCell,
  pxToUvRect,
  unionBbox,
  displayDelays,
  processAnimSide,
  buildAnimAtlasRasters,
  withAnim,
} from './anim.js';

export type { QaFlag, AlphaResult, AlphaOptions } from './alpha.js';
export {
  recoverAlpha,
  hasMeaningfulAlpha,
  floodBackground,
  defringe,
  cleanTransparentRgb,
  alphaBbox,
  isMagenta,
  isNearWhite,
  isSideMismatch,
  INFORMATIONAL_FLAGS,
  NEVER_ACCEPTED_FLAGS,
  FLOOD_TOLERANCE,
  MEANINGFUL_ALPHA_FRACTION,
  COVERAGE_MIN,
  COVERAGE_MAX,
  DEFRINGE_RADIUS,
  TRANSPARENT_RGB_BAND,
  SIDE_MISMATCH_RATIO,
} from './alpha.js';

export type { Placement, ResampleKernel, NormalizeResult } from './normalize.js';
export { computePlacement, chooseKernel, normalizeSprite, blit, INTEGER_TOLERANCE } from './normalize.js';

export type { NormalMapOptions } from './normalmap.js';
export { deriveNormalMap, chamferDistance, gaussianBlur, luminance, DEFAULT_NORMAL_OPTIONS } from './normalmap.js';

export { deriveEmissive, erode1px, emissiveScore, resolveEmissiveOverride, EMISSIVE_MIN_VALUE, EMISSIVE_MIN_CHROMA, EMISSIVE_MAX_COVERAGE } from './emissive.js';
export type { EmissiveOverride } from './emissive-overrides.js';
export { EMISSIVE_OVERRIDES } from './emissive-overrides.js';

export type { FloatAlphaImage } from './mips.js';
export {
  binarizeAlpha,
  toFloatAlpha,
  boxDownPremultiplied,
  coverageFraction,
  coverageScale,
  quantize,
  buildAlphaMipChain,
  buildNormalMipChain,
  buildMaskMipChain,
  renormalize,
  halfResolutionNormal,
} from './mips.js';

export type { Rect } from './pack.js';
export { MaxRectsPacker, packSquares, rectsOverlap } from './pack.js';

export type { AtlasPlan, ZonePlan, BindStat } from './plan.js';
export { planAtlases, speciesSequence, atlasId } from './plan.js';

export type { ZoneId, ZoneSets, ZoneInputs, RosterTables, ZoneSetInput } from './zones.js';
export { ZONE_ORDER, isZoneId, parseRosterTables, loadRosterTables, buildZoneSets, buildZoneInputs } from './zones.js';

export type { TextureKind, MapEncodeSettings, Rung, ThumbRung } from './encode.js';
export {
  ALBEDO_LADDER,
  NORMAL_LADDER,
  MIP_QUALITY_DROP,
  WEBP_EFFORT,
  THUMB_QUALITY,
  THUMB_LADDER,
  THUMB_ALPHA_QUALITY,
  thumbRungKey,
  quantizeAlpha,
  ladderRungs,
  settingsFor,
  settingsKey,
  encodeRgbaWebp,
  encodeMaskWebp,
  encodeThumb,
  decodeToRgba,
  decodeRaw,
  pageCount,
  mipLevels,
  probeKtx2,
  encodeKtx2Rgba,
  transcodeKtx2ToRgba,
} from './encode.js';

export type { Crop, ErrorStats, AngularStats } from './metrics.js';
export { errorStats, hardestEdgeCrop, angularError, isHardEdge, luma, HARD_EDGE_STEP, BAD_ERROR } from './metrics.js';

export type { SpriteSource, SourceResolution, ExcludedFile, ExclusionReason } from './sources.js';
export { resolveSources, normalizeName, parseAlternateStyle, compareSources } from './sources.js';

export type { LegacyData, LegacySpecies, LegacyTeam } from './legacy.js';
export { loadLegacyData, loadLegacySpecies, parseSpecies } from './legacy.js';

export type { SpriteMeta, SpriteArtifacts } from './cache.js';
export { SpriteCache, sha256 } from './cache.js';

export type { BuildOptions, BuildResult, ProcessedSprite, ProcessContext, FrameSelect, AlphaOverrides, AtlasRasters } from './pipeline.js';
export { runBuild, processSprite, spriteCacheKey, buildAtlasRasters, atlasFileKey, atlasFileName, thumbFileName, resolveAlphaOverride, dirBytes, staticDirBytes } from './pipeline.js';

export type { QaEntry, QaReport, QaAcceptance, QaEncodingSummary, ContactSheetItem } from './qa.js';
export { buildQaReport, serializeQaReport, isAccepted, renderContactSheet, renderFrameStrip, renderAnimSheet } from './qa.js';

export type { RgbaImage, GrayImage, Bbox, SpriteSide } from './types.js';
export {
  PIPELINE_VERSION,
  SPRITE_STAGE_VERSION,
  ALPHA_THRESHOLD,
  DEFAULT_SPRITE_SIZE,
  DEFAULT_ATLAS_SIZE,
  ATLAS_SLOTS,
  FOOT_V,
  MANIFEST_FOOT_V,
  FILL_FRACTION,
  NORMAL_SCALE,
  MIP_LEVELS,
  CREATURES_BUDGET_BYTES,
  MAX_ATLASES_PER_ZONE,
  MAX_DUPLICATED_SPECIES,
  THUMB_SIZE,
  THUMB_MAX_BYTES,
  CONCURRENCY,
  ANIM_CELL_DIVISOR,
  ANIM_STAGE_VERSION,
  ANIM_BUDGET_BYTES,
  ANIM_MAX_EDGE,
  ANIM_DIR,
  createRgba,
  createGray,
  compareStrings,
} from './types.js';
