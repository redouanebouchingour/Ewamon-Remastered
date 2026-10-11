/**
 * `@ewa/render` public surface (SPEC §10.0.2: re-exports the symbols named `export` in §10).
 * Part 1 (this foundation): renderer host §10.1, material library §10.2, lighting rig §10.3, post stack
 * §10.8, stats/budget §10.10. The §10.4–§10.7/§10.9 contracts are typed in `contracts.ts` and backed by
 * placeholders in `defaults.ts` until their agents land.
 */

// ---- descriptors (plain data) ----
export {
  ALL_EFFECTS, BUDGET_PASSES, LAYERS, LIGHT_BUDGET,
} from './descriptors.js';
export type {
  Backend, BudgetCounts, BudgetPass, EffectsFlags, HarvestLevel, HousingRef, LightKind, LightSource, RenderCaps, RenderStats, WeatherKind,
} from './descriptors.js';

// ---- §10.1 renderer host + §10.10 probe ----
export {
  CAMERA_LAYERS, CAMERA_PARAMS, COMPILE_CONCURRENCY, DEFAULT_SUBSYSTEMS, MAX_DRAWING_WIDTH, MIN_MAX_TEXTURE_SIZE, PIXEL_RATIO_CAP, RenderInitError,
  chooseKtx2Target, clampPixelRatio, createBudgetProbe, createRenderer, createZoneView, rendererInternals, watchDeviceLost,
} from './renderer.js';
export type {
  BudgetProbe, CameraShot, CompileProgress, DeviceLostInfo, DeviceLostSource, FrameHook, HostContext, HudBinding, PassMeasureOptions, Renderer, RendererOptions, RendererProbe,
  RendererSubsystems, RenderInitErrorCode, ZoneView, ZoneViewOptions,
} from './renderer.js';

// ---- §10.2 materials ----
export {
  BIOME_SURFACES, SHARED_SURFACES, SURFACES, SURFACE_EXTRAS, SURFACE_IDS, heroSurfaces, isSurfaceId, surfaceDef, surfaceExtras,
} from './materials/surfaces.js';
export type { BiomeName, MaterialClass, SurfaceDef, SurfaceExtras, SurfaceId } from './materials/surfaces.js';
export {
  MaterialBudget, countMaterials, createMaterialLibrary, createMaterialLibraryWith, paintSurfaceColor, stampTexture, textureBytes,
} from './materials/library.js';
export type { LibraryDeps, MaterialInfo, MaterialLibrary, SharedUniforms, SurfaceMaterial, TextureSet, TextureSource } from './materials/library.js';
export {
  DEFAULT_PLACEHOLDER, MANIFEST_FILE, PLACEHOLDER_TEXELS, parseMaterialsManifest, planTierUrls, placeholderUrls, resolveUrl,
} from './materials/manifest.js';
export type { MapName, MaterialSetEntry, MaterialsManifest, MaterialTier, ParsedManifest, TierName, TierUrls } from './materials/manifest.js';
export { WATER_DEPTH_ATTRIBUTE, buildSurfaceGraph } from './materials/graph.js';
export { windDisplace } from './materials/wind.js';
export type { WindParams } from './materials/wind.js';
export { triplanarSample } from './materials/triplanar.js';
export { createSharedUniforms, harvestBlend, stepWetness, toHarvestLevel } from './materials/harvest.js';

// ---- §10.3 lighting ----
export {
  CASCADE_SPLITS_M, CSM_OPTIONS, LIGHT_LAYOUT, LightRig, SPOT_PARAMS, SUN_SHADOW, assertLightBudget, castsShadowMap, createLightingLayout,
  flickerFactor, lightTypeFor,
} from './lighting/rig.js';
export type { LightCounts, PunctualHandle } from './lighting/rig.js';
export {
  DAY_KEYFRAMES, DAY_LENGTH_REAL_MS, DayCycle, GROVE_LIGHTING, MOON_SWITCH_DEG, directionalAt, isMoonLight, moonDirection, rebakeDue,
  sampleDay, sunAzimuthDeg, sunDirection, sunElevationDeg, wrapTime,
} from './lighting/daycycle.js';
export type { DayKey, DayKeyframe, DaySample, LightingPalette } from './lighting/daycycle.js';
export { SKY_HARVESTED, SKY_INTACT, SkyController } from './lighting/sky.js';
export { createHeightFog, heightFogFactor } from './lighting/fog.js';
export type { FogUniforms, HeightFog } from './lighting/fog.js';
export { PrecipitationSheet, weatherParams } from './lighting/weather.js';
export type { WeatherParams } from './lighting/weather.js';

// ---- §10.8 post ----
export {
  ALL_PASSES_ON, POST_PARAMS, PostStack, buildPostOutput, planPostGraph, tiltPlaneNormal,
} from './post/pipeline.js';
export type { PassSwitches, PostNodes, PostStage, PostStageId, PostUniforms } from './post/pipeline.js';
export { GROVE_GRADE, NEUTRAL_GRADE, gradeChannel, vignetteFactor } from './post/grade.js';
export type { GradePalette } from './post/grade.js';
export { REDUCED_OFF, applyReducedEffects, coerceTimeScale, effectsEqual, isReduced } from './post/effects.js';

// ---- §10.10 stats ----
export {
  COUNT_CAPS, HOUSINGS_KEY, PassTimer, aggregatePassMs, capViolations, computePassMs, createRenderStats, dumpZone, median, percentile, readBudgetCounts,
} from './stats.js';
export type { HousingTag, TimedContext, ZoneDump } from './stats.js';

// ---- §10.4–§10.9 contracts (implemented by later agents) + placeholders ----
// ---- §10.5 zone builder + §10.6 terrain = collision (part 2) ----
export { MOVER, TerrainCollider, resolveMove, resolveMoveInto } from './terrain/collider.js';
export type { Blocker, CircleBlocker, MoveResult, MoveResultMut, RectBlocker } from './terrain/collider.js';
export { FIELD_MARGIN, heightAt, heightClamped, playableBounds, walkableAt, waterAt, waterBodies } from './terrain/field.js';
export type { Bounds, WaterBody } from './terrain/field.js';
export { buildSkirt, buildTerrainChunks } from './terrain/mesh.js';
export { buildZone, loadZone, zoneSurfaces } from './zone/builder.js';
export type { ZoneBuildDeps, ZoneHandleImpl } from './zone/builder.js';
export { ZoneSystem, zoneSystemFor } from './zone/system.js';
export {
  BIOME_LIGHTS, DIRS, FIELD_SIZE, HANDOVER_INSET, HOUSING_LOCAL, INTERIOR_SIZE, LANTERN_HOUSING_LOCAL, ROUTE_LAYOUT, SET_PIECE_EXTENT,
  SET_PIECE_LIGHTS, STORY_LAYOUT, TOWN_LAYOUT, TYPE_ACCENT, ZONE_LIGHT_CAP, doorOf, edgePoint, footprintDistance, layoutOf, lightsFromPlan, planLayout,
  roadDistance, roadZAt, warpPairs,
} from './zone/layout.js';
export type { BiomeLightStyle, Circle, Ellipse, LayoutInput, PlanLightData, RngLike, Road, Vec2, ZoneLayoutPlan } from './zone/layout.js';
export { BUILDING_LOD_LEVELS, CHUNK_SIZE, LOD_DISTANCES, LOD_HYSTERESIS, chooseTier, chunkGrid, chunkOf, tierFor } from './zone/lod.js';
export type { ChunkGrid, Tier } from './zone/lod.js';
export { PALETTES, gradeOf, lightingPaletteOf, paletteFor } from './zone/palettes.js';
export { createPrng, fnv1a32 } from './zone/prng.js';
export type { Prng, PrngState } from './zone/prng.js';
export { BIOME_GENERATORS, SET_PIECE_BUILDERS } from './zone/generators/index.js';
export { generatorsFor } from './zone/generators/common.js';
export type { BiomeSet } from './zone/generators/set.js';
export type { BiomeGenerators, GeoLod, Palette, PropGeo, TreeKind } from './zone/types.js';

export type {
  ActorDescriptor, ActorPool, BattlerPose, BattlerRef, BattleStage, Biome, BuildingSpec, CameraRig, Dir, Edge, EvolutionHandle, EvolutionPhase,
  EvolutionRequest, GeneratorSet, HeightfieldData,
  HudLayer, HudModel, Layout, Marker, Pickup, PropPlacement, SetPieceId, SpriteAnim, SpriteDescriptor, AuraKind, SpriteFrame, Tablet, Terrain, TerrainColliderLike,
  TypeName, VariantKey, VfxId, WaterSpec, ZoneHandle, ZoneSpec, ActorSpawn, PlanRoadData, ZonePlanData,
  HallBounds, InteriorLocalPoint, InteriorLocalRect, InteriorSpec, InteriorTemplateId, InteriorThemeId, InteriorsHandle,
  ObstacleSpec, ObstaclesHandle, NeighbourSpec,
} from './contracts.js';
export { BasicDioramaRig, NullActorPool, NullBattleStage, NullHudLayer, unimplementedZoneLoader } from './defaults.js';
export type { ZoneLoader } from './defaults.js';

// ---- part 3: §10.4 creature sprites, §10.7 camera / stage / actors / VFX, §10.9 HUD ----
export {
  ATLAS_LEVELS, ATLAS_MAPS, AtlasCache, MAX_SINGLES, SINGLE_TEXELS, animAtlasSetBytes, atlasSetBytes, browserDecoder, chainBytes, chainBytesWH, cropForLevel,
  loadAnimAtlasTextures, loadAtlasTextures, loadSingleTextures, singleKey, stampAtlasTexture, textureFromLevels,
} from './sprites/atlas.js';
export type { AnimAtlasSet, AtlasDecoder, AtlasMap, AtlasMapName, AtlasSet, AtlasTextures, Crop, DecodedImage } from './sprites/atlas.js';
export { BillboardPool, CreatureBillboard, createBillboardMaterial, createDecalMaterial, createSpritePool } from './sprites/billboard.js';
export type { BillboardPoolOptions, BillboardUniforms, BillboardUserData, SpritePool } from './sprites/billboard.js';
export {
  ANIM, BATTLER_POSES, BILLBOARD, POSES, VARIANT_KEYS, VARIANT_UNIFORMS, billboardDims, bobOffset, bobPhase, decayHurt, flipbookFrame, flipbookPhase01,
  flipbookTotalMs, paletteFor as variantPaletteFor, poseDurationMs, samplePose,
} from './sprites/tables.js';
export type { BillboardDims, PaletteValues, PoseDef, PoseSample, VariantUniforms } from './sprites/tables.js';
export { TYPE_COLORS, TYPE_NAMES, hexToLinearInto, isTypeName, validateTypeColorTable } from './sprites/typeColors.js';
export {
  DEAD_ZONE, DEFAULT_ZOOM_STOP, DISTANCE, DioramaRig, FOV_V, HEADING_STEP, HEADING_TURN_MS, PITCH, SHAKE_AMP_MAX, SPRING_TAU, YAW_BASE, ZOOM_MS,
  dioramaOffset, headingYaw, springStep,
} from './camera/rig.js';
export type { DioramaRigOptions, FeetResolver } from './camera/rig.js';
export {
  BATTLE_DISTANCE, BATTLE_PITCH, BATTLE_YAW_OFFSET, BATTLER_SEPARATION, CAMERA_WORK, CUE_KINDS, INSPECT_DISTANCE, PILLAR7_RADIUS, PUSH_IN_MS,
  RELEASE_MS, RING_DIAMETER, TRAINER_SIDE_DEG, TRAINER_SLOT_M, battlePose, battlerSlot, orbitPosition, trainerSlot,
} from './camera/battle.js';
export type { CameraWork, CueKind, OrbitPose } from './camera/battle.js';
export { BOKEH_PX, FOCAL_LENGTH_M, TILT_DEG, TiltShiftDOF, circleOfConfusionPx, groundOffPlaneM } from './camera/dof.js';
export { CAPACITY as VFX_CAPACITY, EMITTERS as VFX_EMITTERS, MAX_PARTICLES as VFX_MAX_PARTICLES, VFX_IDS, VFX_TABLE, VfxSystem, isVfxId } from './stage/vfx.js';
export type { SequenceVfxRecipe, VfxAnchor, VfxPhase, VfxRecipe } from './stage/vfx.js';
export { ACTOR_POOL_SIZE, CHARACTER, CharacterPool, EMOTE_CLIPS, EMOTE_MS, EMOTE_NAMES, RIPPLE } from './stage/actors.js';
export type { ActorPoolOptions, EmoteId, GroundSampler } from './stage/actors.js';
export { CHARACTER_MATERIAL, createCharacterMaterial } from './stage/characterMaterial.js';
export type { CharacterMaterial, CharacterMaterialUniforms } from './stage/characterMaterial.js';
export { createGltfCharacterSource, disposeAccessory, disposeShape, parseCharacterSet, resolveLook } from './stage/looks.js';
export type {
  AccessoryRef, AccessoryTemplate, AnimationsRef, AtlasRef, CharacterFileRef, CharacterSet, CharacterSource, GltfCharacterSourceOptions, LookRef, ShapeRef,
  ShapeTemplate,
} from './stage/looks.js';
export { AURA, AuraSystem } from './stage/aura.js';
export { STAGE, Stage, TERRAIN_ACCENT, TERRAIN_SURFACE, fitCentre, inHall } from './stage/battleStage.js';
export {
  ARENA_BACKDROP, ARENA_CAMERA_MAX_DISTANCE, ARENA_COLORS, ARENA_GRADE, ARENA_LIGHTING, createArenaBackdrop, crowdSeats, tierFront, tierY,
} from './stage/arenaBackdrop.js';
export type { ArenaBackdrop } from './stage/arenaBackdrop.js';
export {
  EVOLUTION, EVOLUTION_TIMELINE, EvolutionSequence, alternationHz, evolutionDurationMs, evolutionPhaseAt, evolutionRecipes, sampleEvolution,
} from './stage/evolution.js';
export type { EvolutionDeps, EvolutionSample, PhaseSpan } from './stage/evolution.js';
export type { StageDeps, StageGround } from './stage/battleStage.js';
export { CanvasHudLayer, FIELD_REGION, HUD, HUD_FIELDS, HUD_REGIONS, browserSurface } from './hud/layer.js';
export type { HudAnchors, HudField, HudRegion, HudSurface, HudSurfaceFactory, Ref } from './hud/layer.js';
export { PART3_SUBSYSTEMS, part3For, part3Of } from './stage/wiring.js';
export type { Part3 } from './stage/wiring.js';
