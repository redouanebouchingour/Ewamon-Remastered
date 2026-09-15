# TABLE CLASH — RENDER & UI IMPLEMENTATION SPEC v1.0

**Author:** Lead technical art director
**Status:** BINDING. This document is the contract. Where a design proposal in `.design/` disagrees with this file, this file wins.
**Direction:** Photoreal Tournament materials, Cinematic Broadcast framing.

Inputs synthesised: `art-photoreal.json`, `art-esports.json` (Cinematic Broadcast), `art-broadcast.md` (hostile render audit), `audit-render.json` (Premium Esports), `audit-ui.md` (controls design), `design-controls.md` (hostile UI audit). Screenshots: `base-side.jpg`, `06-final.jpg`.

Authoritative dimensions, read from config and never changed:
`halfLength 0.60`, `halfWidth 0.34`, `wallHeight 0.13`, `goalHalfWidth 0.1025`, `goalHeight 0.055`, `goalDepth 0.06`, `goalPostRadius 0.007`, `rodHubY 0.094`, `legLength 0.074`, `footRadius 0.018`, `figureHalfWidthZ 0.024`, `torsoRadius 0.017`, `ball.radius 0.0175`, `maxWindupAngle 1.95`, `windupPowerFloor 0.62`, `kickCooldownSec 0.11`, `maxSlideSpeed 2.4`, `slideAccel 42`, `maxAngularSpeed 26`, `angularAccel 560`.

---

## 1. ART DIRECTION

A real ITSF competition table standing on a wooden floor in a dark hall, shot on an 85 mm-equivalent lens from a three-quarter sideline position so the playfield fills 90% of the frame width. Two overhead bar fixtures are visible in shot, so every highlight on every rod, ball and laminate panel traces back to a source the player can point at. Sponsor boards, a dark crowd cylinder, a truss silhouette and exponential haze replace the black void. Every surface carries three procedural maps — albedo, a channel-packed ORM, and a Sobel-derived normal — so nothing is flat and everything has scale. Nothing stays a primitive: rails are extruded profiles with 4 mm fillets, footballers are one continuous lathe with an arm loop and a moulded boot, goal posts are cylinders, handles are turned and knurled. The image is finished with lens language, not effect language: SSAO, restrained bloom, halation, vignette, animated grain, ACES. And through all of it the ball stays the brightest object on screen and both goals stay in frame, because a 35 mm ball crosses this table in 0.1 s and an effect that costs a save is a bug.

**Pillar 1 — One visible light.** Two overhead bar housings at `y = 1.06`, `x = ±0.30`, each a dark-anodised box with a downward emissive panel at `emissiveIntensity 3.2`, present in the render scene AND in the PMREM env scene at matching positions. Every specular streak on the table has an on-screen source.

**Pillar 2 — Three maps, no exceptions.** Albedo (sRGB) + ORM (AO in R, roughness in G, metalness in B, one texture bound to `aoMap`/`roughnessMap`/`metalnessMap`) + normal (Sobel of a heightfield). One texture unit, one fetch, three maps. Clearcoat on laminate, wood and figure paint; KHR anisotropy on steel.

**Pillar 3 — Real silhouettes.** 4 mm quarter-round fillets on every rail top corner. 22-point lathe footballer with an arm loop and a boot. `CylinderGeometry` goal posts at the exact `goalPostRadius`. Lathed knurled handles. A hard 90° edge catches one flat value; a filleted edge catches a moving specular line.

**Pillar 4 — 30° lens, three-quarter sideline, 90% fill.** Distance solved from the projected playfield corners every resize, never hand-tuned. The default view sits 24.8° off the pure sideline normal so `|dot(cameraRight, +Z)| = 0.42` and the rod slide axis stays a readable screen axis — a *pure* side view is uncontrollable and is spectate-only.

**Pillar 5 — Darkness with air in it.** Venue floor at `y = −0.90`, graded backdrop cylinder, sponsor boards, crowd, truss, `FogExp2(0x080b0f, 0.085)`, a pool-of-light decal, faint volumetric cones. Absence is not darkness.

**Pillar 6 — Playability outranks atmosphere, and everything has an off switch.** Bloom threshold sits in the value gap between the brightest playfield pixel and the ball. No depth-of-field blur may ever touch the ball or a figure. Baked AO and contact-shadow decals exist on *every* preset including `low`, so grounding survives when GTAO does not. Four preset tiers plus `reducedEffects` strip the whole build back to a `MeshStandardMaterial`, no-composer, 2-light configuration that plays identically.

---

## 2. P1 — MATERIAL LIBRARY API

**Owner:** P1. **File:** NEW `packages/client/src/render/materials.ts`.

This is the only section the other eight packages code against. P1 implements these signatures **verbatim**; nobody else may change them. P1 imports nothing from `table.ts`, `rods.ts`, `ball.ts`, `environment.ts`, `effects.ts` or `scene.ts` — the dependency arrow points one way, into this file.

### 2.1 The full public interface

```ts
import type {
  Color, ColorRepresentation, DataTexture, Group, Material, Mesh,
  MeshPhysicalMaterial, MeshStandardMaterial, Scene, Texture, WebGLRenderer,
} from 'three';
import type { CompiledTable } from '@tc/core';

/* ------------------------------------------------------------------ *
 * QUALITY
 * ------------------------------------------------------------------ */

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface MaterialQuality {
  readonly tier: QualityTier;
  /** Hard ceiling on the longest edge of any generated map. 512 | 1024 | 2048 | 2048 */
  readonly maxTexel: number;
  /** When false every factory returns MeshStandardMaterial with map only. */
  readonly maps: boolean;
  /** When false the ORM texture is not generated; scalar roughness/metalness only. */
  readonly orm: boolean;
  /** When false no normal map is generated and no heightfield callback is invoked. */
  readonly normal: boolean;
  /** When false factories must not return MeshPhysicalMaterial (no clearcoat, no anisotropy). */
  readonly physical: boolean;
  /** Texture.anisotropy to stamp on every generated map. 1 | 4 | 8 | 16 */
  readonly filterAniso: number;
  /** Multiplies every factory's envMapIntensity. Table config `visual.envIntensity`. */
  readonly envIntensity: number;
}

/** The only constructor for MaterialQuality. envIntensity defaults to 1. */
export function qualityFor(tier: QualityTier, envIntensity?: number): MaterialQuality;

/* Canonical tiers, for reference and for tests:
 * low    { maxTexel:  512, maps:false, orm:false, normal:false, physical:false, filterAniso: 1 }
 * medium { maxTexel: 1024, maps:true,  orm:true,  normal:true,  physical:false, filterAniso: 4 }
 * high   { maxTexel: 2048, maps:true,  orm:true,  normal:true,  physical:true,  filterAniso: 8 }
 * ultra  { maxTexel: 2048, maps:true,  orm:true,  normal:true,  physical:true,  filterAniso:16 }
 */

/* ------------------------------------------------------------------ *
 * PROCEDURAL TEXTURE GENERATOR
 * ------------------------------------------------------------------ */

export type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface PaintTarget {
  readonly ctx: Canvas2D;
  /** Post-clamp pixel dimensions. ALWAYS read these, never the requested ones. */
  readonly width: number;
  readonly height: number;
  /** Pixels per metre on this surface, or 0 when the request carried no metres. */
  readonly ppm: number;
  /** Multiply a requested pixel count by this to survive the tier clamp. */
  readonly scale: number;
}

export interface HeightField {
  readonly width: number;
  readonly height: number;
  /** Row-major, length width*height, values 0..1. Pre-zeroed. */
  readonly data: Float32Array;
}

export interface OrmBuffers {
  readonly width: number;
  readonly height: number;
  /** Ambient occlusion, 0 = fully occluded, 1 = open. Pre-filled with 1. */
  readonly ao: Float32Array;
  /** Roughness 0..1. Pre-filled with 0.5. */
  readonly rough: Float32Array;
  /** Metalness 0..1. Pre-filled with 0. */
  readonly metal: Float32Array;
}

export interface TextureSetRequest {
  /**
   * Cache key. MUST uniquely identify the pixels. P1 appends `|${w}x${h}|${tier}`
   * internally, so callers must not encode resolution or tier themselves.
   */
  key: string;
  /** Requested pixels. Clamped to quality.maxTexel on the longest edge, aspect preserved. */
  width: number;
  height: number;
  quality: MaterialQuality;
  /** Physical extent of the mapped surface in metres. Drives PaintTarget.ppm and worldRepeat. */
  metres?: { u: number; v: number };
  /** Always called. Paint in sRGB. */
  albedo: (t: PaintTarget) => void;
  /** Called only when quality.orm. Write in place. */
  orm?: (b: OrmBuffers) => void;
  /** Called only when quality.normal. Write in place. */
  height?: (h: HeightField) => void;
  /** Sobel gain. Default 0.6. */
  normalStrength?: number;
  /** Default 'clamp'. 'clamp' is mandatory for anything with a painted border. */
  wrap?: 'repeat' | 'clamp';
  /** Bakes the V flip into the canvas. Never use negative repeat to mirror. */
  flipV?: boolean;
  /** Default true. Set false only for a texture that is never minified. */
  mipmaps?: boolean;
}

export interface TextureSet {
  /** sRGB colour space. */
  readonly map: Texture;
  /** NoColorSpace. Bind to aoMap AND roughnessMap AND metalnessMap. null when !quality.orm. */
  readonly orm: Texture | null;
  /** NoColorSpace tangent-space normal. null when !quality.normal. */
  readonly normal: Texture | null;
  readonly width: number;
  readonly height: number;
  /** Milliseconds of main-thread work this set cost to build. 0 on a cache hit. */
  readonly buildMs: number;
  retain(): void;
  release(): void;
}

/**
 * Returns a cached set or builds one. Synchronous. Module-level cache keyed by
 * `${key}|${w}x${h}|${tier}`; a hit increments the refcount and returns in O(1).
 * Uses OffscreenCanvas where available, HTMLCanvasElement otherwise.
 */
export function requestTextureSet(req: TextureSetRequest): TextureSet;

/**
 * Awaitable wrapper that yields to the event loop between the albedo, ORM and normal
 * stages. Callers that build more than ~15 ms of texture at match start MUST use this.
 */
export function requestTextureSetAsync(req: TextureSetRequest): Promise<TextureSet>;

/* ------------------------------------------------------------------ *
 * NOISE AND NORMAL HELPERS
 * ------------------------------------------------------------------ */

/** Deterministic 2D hash, [0,1). No allocation. */
export function hash21(x: number, y: number): number;

/** Bilinear value noise over hash21, [0,1). */
export function valueNoise2(x: number, y: number): number;

/** fBm over valueNoise2. Defaults: lacunarity 2.03, gain 0.5. Returns [0,1). */
export function fbm2(
  x: number, y: number, octaves: number, lacunarity?: number, gain?: number,
): number;

/**
 * 3x3 Sobel of a heightfield into a tangent-space normal DataTexture.
 * RGBAFormat, UnsignedByteType, NoColorSpace, mipmaps on,
 * minFilter LinearMipmapLinearFilter, magFilter LinearFilter.
 * `strength` scales the gradient before normalisation; 0.35 = fine pores, 0.9 = deep dimples.
 */
export function normalFromHeight(
  field: HeightField,
  strength: number,
  opts?: { wrap?: 'repeat' | 'clamp'; anisotropy?: number },
): DataTexture;

/**
 * Packs three 0..1 buffers into one RGBA DataTexture: AO->R, roughness->G, metalness->B,
 * A = 255. NoColorSpace, mipmaps on.
 */
export function packOrm(b: OrmBuffers, opts?: { wrap?: 'repeat' | 'clamp'; anisotropy?: number }): DataTexture;

/**
 * Sets texture.repeat from real metres so grain/scratch density is world-constant.
 * repeat = (metresU / texelMetres / tex.image.width, metresV / texelMetres / tex.image.height)
 * Mutates and returns the texture. Applies to every texture passed.
 */
export function worldRepeat(
  metresU: number, metresV: number, texelMetres: number, ...textures: Array<Texture | null>
): void;

/* ------------------------------------------------------------------ *
 * SHARED PMREM ENVIRONMENT
 * ------------------------------------------------------------------ */

/**
 * Builds a PMREM from a tiny scene. P1 owns the single PMREMGenerator instance and
 * disposes the previous result. sigma default 0.02. environment.ts calls this with its
 * env scene; nobody else calls it.
 */
export function pmremFromScene(
  renderer: WebGLRenderer, scene: Scene, sigma?: number,
): Texture;

/**
 * Publishes the venue environment to the material library. Every material already
 * created is retro-fitted (`envMap` stays null so `scene.environment` drives it, but
 * `envMapIntensity` is re-applied). Call once, from environment.ts, before the first frame.
 */
export function setEnvironment(tex: Texture | null): void;

/** The currently published environment, for scene.ts to assign to `scene.environment`. */
export function environment(): Texture | null;

/* ------------------------------------------------------------------ *
 * MATERIAL FACTORY RESULT
 * ------------------------------------------------------------------ */

export interface SurfaceMaterial {
  /** MeshPhysicalMaterial only when quality.physical, MeshStandardMaterial otherwise. */
  readonly material: MeshStandardMaterial | MeshPhysicalMaterial;
  readonly textures: TextureSet | null;
  /**
   * True when material.aoMap is non-null. The caller MUST then do
   * `geometry.setAttribute('uv1', geometry.attributes.uv)` or the AO will not appear.
   */
  readonly needsUv1: boolean;
  /** Decrements every refcount this factory took and disposes the material. Idempotent. */
  release(): void;
}

/* ------------------------------------------------------------------ *
 * NAMED MATERIAL FACTORIES — every one takes a MaterialQuality
 * ------------------------------------------------------------------ */

export interface PlayfieldOpts {
  quality: MaterialQuality;
  table: CompiledTable;
  /** Laminate base. Ignore `visual.fieldColor` #1d6b3a; pass '#2b5942'. */
  fieldColour: ColorRepresentation;
  lineColour: ColorRepresentation;
}
/**
 * Screen-printed ITSF laminate. clearcoat 0.55 / clearcoatRoughness 0.14 on physical,
 * roughness 0.42 flat on low. Aligned longitudinal micro-scratches, halftone dot grid,
 * ball-wear arcs, and a 22 mm baked cavity gradient on all four edges.
 * Markings are drawn from table.rodX / goalHalfWidth so they stay registered to the collider.
 */
export function playfieldLaminate(o: PlayfieldOpts): SurfaceMaterial;

export type WoodPart = 'rail' | 'body';
export interface WoodOpts {
  quality: MaterialQuality;
  part: WoodPart;
  /** Real extent of the mesh so grain density is world-constant. */
  metres: { u: number; v: number };
  /** Rotate the map 90 deg so grain runs lengthwise on end walls. */
  rotate?: boolean;
}
/**
 * 'rail'  -> oiled beech  #9c7548, roughness 0.34, clearcoat 0.40, clearcoatRoughness 0.16
 * 'body'  -> stained panel #3f2c20, roughness 0.55, clearcoat 0.15
 * Ring function h = fract(sqrt(x^2 + (0.18y)^2) * 26 + fbm2(3x,3y,4) * 2.4) shaped by pow(h,0.6),
 * 400 pore streaks, 8 knots with local ring compression. Normal strength 0.35, texel 0.36 mm.
 */
export function cabinetWood(o: WoodOpts): SurfaceMaterial;

export interface SteelOpts {
  quality: MaterialQuality;
  /** Rod length in metres, so the brush streak density is world-constant. */
  metres: { u: number; v: number };
}
/**
 * Brushed tournament steel. colour 0x9aa4ae, roughness 0.30, metalness 0.95,
 * envMapIntensity 1.15 * quality.envIntensity. On physical: anisotropy 0.62,
 * anisotropyRotation Math.PI/2 so the highlight is a longitudinal streak, not a clipped bar.
 * On non-physical: a 512x32 longitudinal roughnessMap banded 0.22..0.44 does the same job.
 */
export function brushedSteelRod(o: SteelOpts): SurfaceMaterial;

/** Polished chrome: 0xdfe6ef, roughness 0.14, metalness 1.0, envMapIntensity 1.35. Untextured. */
export function chrome(quality: MaterialQuality): SurfaceMaterial;

/** Dark anodised aluminium: 0x3a4352, roughness 0.42, metalness 0.90. Housings, escutcheons, collars. */
export function anodisedAluminium(quality: MaterialQuality): SurfaceMaterial;

export interface GripOpts {
  quality: MaterialQuality;
  /** Diamond knurl tiling. Default { u: 8, v: 2 }. */
  knurlRepeat?: { u: number; v: number };
}
/** Black tournament rubber grip: 0x1a1d22, roughness 0.88, 256^2 diamond-crosshatch normal at 0.55. */
export function rubberGrip(o: GripOpts): SurfaceMaterial;

export interface FigureKitOpts {
  quality: MaterialQuality;
  /** Team base colour. Callers pass the palette-corrected value, never a raw web hex. */
  colour: ColorRepresentation;
  /** 0 or 1. Selects which side the baked squad number faces. */
  team: 0 | 1;
}
/**
 * Painted die-cast kit plastic. roughness 0.30, metalness 0, clearcoat 0.45,
 * clearcoatRoughness 0.22. Baked mould seam, squad number, and 4% paint chipping on
 * boot and shoulder showing a grey substrate. Patched for instanced tint + rim (see 2.2).
 */
export function figureKitPlastic(o: FigureKitOpts): SurfaceMaterial;

/** Skin: 0xc9a380 (deliberately darker than today's 0xe8c9a6 so the head stops out-glowing the ball),
 *  roughness 0.62, plus a baked hair cap in the upper 45% of V. */
export function figureSkin(quality: MaterialQuality): SurfaceMaterial;

/** Boot rubber: 0x15181d, roughness 0.30, clearcoat 0.30, with a stud normal at 0.5 and a 3-stripe decal. */
export function bootRubber(quality: MaterialQuality): SurfaceMaterial;

export interface GoalMeshOpts {
  quality: MaterialQuality;
  /** Diamond pitch in metres. Default 0.004. */
  pitch?: number;
}
/**
 * Alpha-tested net. transparent true, alphaTest 0.35, side DoubleSide, depthWrite false,
 * colour 0xd8dee6, roughness 0.75. 256^2 diamond grid at 0.55 alpha on transparent.
 */
export function goalMesh(o: GoalMeshOpts): SurfaceMaterial;

/** Dark powder-coat for the goal recess lining: 0x14181d, roughness 0.78, 512^2 stipple normal at 0.5. */
export function powderCoat(quality: MaterialQuality): SurfaceMaterial;

export interface FloorOpts {
  quality: MaterialQuality;
  /** Plane extent in metres, for world-constant board width. Default { u: 14, v: 14 }. */
  metres?: { u: number; v: number };
}
/** Dark board floor: base 0x14100c, roughness 0.50, 1.4 m board seams, 6-octave mottling at 3%. */
export function venueFloor(o: FloorOpts): SurfaceMaterial;

export interface SponsorBoardOpts {
  quality: MaterialQuality;
  /** Invented marks only. Never a real brand. Default ['TABLE CLASH', 'ITSF', 'KICKOFF']. */
  marks?: readonly string[];
  metres: { u: number; v: number };
}
/** Tilted board face: alternating panels, faint horizontal brushed streak, roughness 0.38. */
export function sponsorBoard(o: SponsorBoardOpts): SurfaceMaterial;

export interface CrowdOpts {
  quality: MaterialQuality;
  /** Blob count. Default 4200 on high+, 1200 on medium, 0 on low (flat gradient only). */
  blobs?: number;
}
/**
 * Unlit MeshBasicMaterial, fog true, side BackSide. Dark stand gradient, muted blobs at
 * luminance 0.03..0.10, ~140 warm pinpricks at 0.35 alpha. Returns SurfaceMaterial whose
 * `material` is a MeshBasicMaterial cast into the union — never lit, never shadowed.
 */
export function crowd(o: CrowdOpts): SurfaceMaterial;

export interface EmissivePanelOpts {
  quality: MaterialQuality;
  colour?: ColorRepresentation;   // default 0xfff3dc
  intensity?: number;             // default 3.2
}
/** The downward face of a light-bar housing. toneMapped true. Also used in the PMREM env scene. */
export function emissivePanel(o: EmissivePanelOpts): SurfaceMaterial;

/* ------------------------------------------------------------------ *
 * INSTANCED TINT + RIM PATCH  (P3 and P7 depend on this)
 * ------------------------------------------------------------------ */

export interface InstancedPatch {
  /** Attribute names the caller must add to the InstancedMesh geometry. */
  readonly attributes: { readonly tint: 'aTint'; readonly rim: 'aRim' };
  /** vec3 attribute: per-instance multiplicative albedo tint. 1,1,1 = unchanged. */
  readonly tintItemSize: 3;
  /** float attribute: 0 = no rim, 1 = full Fresnel rim. */
  readonly rimItemSize: 1;
  /** Sets the rim colour uniform. Must be read from the same palette as the team colour. */
  setRimColour(c: Color): void;
  /** Sets the Fresnel exponent. Default 3.0. */
  setRimPower(p: number): void;
}

/**
 * Patches a material via onBeforeCompile to consume two InstancedBufferAttributes.
 * The injected fragment code is exactly:
 *   diffuseColor.rgb *= vTint;
 *   float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), uRimPower);
 *   totalEmissiveRadiance += uRimColor * vRim * f * 1.8;
 * Never a full-body emissive multiply — that destroys the form.
 */
export function patchInstancedTintAndRim(
  mat: MeshStandardMaterial | MeshPhysicalMaterial,
): InstancedPatch;

/* ------------------------------------------------------------------ *
 * ADDITIVE DECAL HELPER  (kills the four hand-tuned z-fight epsilons)
 * ------------------------------------------------------------------ */

export interface DecalOpts {
  quality: MaterialQuality;
  texture: Texture | null;
  colour?: ColorRepresentation;
  /** 'add' for indicators and trails, 'multiply' for contact shadows. */
  blend: 'add' | 'multiply';
  /** Explicit sort order. All decals sit at y = 0 exactly; polygonOffset does the rest. */
  renderOrder: number;
}
/**
 * MeshBasicMaterial, depthWrite false, polygonOffset true, polygonOffsetFactor -1,
 * polygonOffsetUnits -1, toneMapped false. Unlit and constant, so a contact shadow or a
 * ball marker cannot darken when it enters a shadow. NO y-epsilon is permitted anywhere.
 */
export function decalMaterial(o: DecalOpts): SurfaceMaterial;

/* ------------------------------------------------------------------ *
 * DISPOSE CONTRACT
 * ------------------------------------------------------------------ */

export interface MaterialStats {
  readonly cachedSets: number;
  readonly liveMaterials: number;
  readonly textureBytes: number;
  readonly totalBuildMs: number;
}
/** For the dev harness draw-call/asset assertions. */
export function materialStats(): MaterialStats;

/**
 * Tears the whole library down: disposes every cached TextureSet regardless of refcount,
 * the PMREM generator and its render target, and clears the caches. Only scene.ts's
 * dispose path may call this, and only after every TableMeshes/RodVisuals/BallVisuals/
 * Venue/Vfx dispose has run.
 */
export function disposeMaterialLibrary(): void;
```

### 2.2 Dispose contract, stated plainly

1. Every factory returns `SurfaceMaterial.release()`. Callers must call it exactly once, from their own `dispose()`. Calling it twice is a no-op, not an error.
2. `TextureSet` is **refcounted**, not owned. `requestTextureSet` returns a set with the count already incremented for the caller. `release()` decrements. A set reaching zero is **not** freed immediately — it stays in the cache so a rematch on the same table is free. It is freed only by `disposeMaterialLibrary()` or by cache eviction (LRU, ceiling 96 MB of texture bytes).
3. A caller must never call `.dispose()` on a `Texture` obtained from a `TextureSet`. That is a double-free.
4. Geometry disposal is the caller's business. P1 never creates geometry.
5. `disposeMaterialLibrary()` is called last, by `scene.ts`, once.

### 2.3 Startup cost budget

The full high/ultra set is 55–70 ms of Canvas2D and typed-array work. That is not optional to mitigate. `requestTextureSetAsync` yields between stages; `table.ts` and `rods.ts` must build behind the existing match-start countdown. Cache key includes `table.id`, so a rematch costs 0 ms. **Hard gate: no single synchronous `requestTextureSet` call may exceed 12 ms at `maxTexel 2048`;** the dev harness asserts this from `TextureSet.buildMs`.

---

## 3. WORK PACKAGES

### P2 — TABLE

**Owns:** `packages/client/src/render/table.ts`.

**Cabinet geometry.** Every one of the six wall `BoxGeometry` becomes an `ExtrudeGeometry` of a hand-authored `Shape`: 28 mm wide × `table.wallHeight` (0.13) tall, a 4 mm quarter-round fillet via `quadraticCurveTo` (4 segments) on both top corners, a 1.5 mm chamfer on the inner bottom, extruded along the rail axis with `{ bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, steps: 1 }`. End walls keep splitting around `table.goalHalfWidth` exactly as today, so the visible mouth is the collider mouth.

**Fix the floating goal box (audit finding #29).** Cabinet half-length becomes `halfLength + goalDepth + 0.022 = 0.682`, half-width `halfWidth + 0.028 = 0.368`, `CABINET_DEPTH` 0.16 → 0.20. Today the recess back wall at 0.66 hangs 32 mm past a 0.628 cabinet — that is the dark lozenge artefact in `base-side.jpg`.

**Materials.** Field: `playfieldLaminate({ fieldColour: '#2b5942', lineColour: '#dfe8e2', … })`, `PlaneGeometry(1.2, 0.68, 64, 36)`, `setAttribute('uv1', uv)`. Rails and top: `cabinetWood({ part: 'rail', metres: { u: length, v: wallHeight } })`. Cabinet body: `cabinetWood({ part: 'body', metres: { u: 1.364, v: 0.20 } })` — **two woods, never one shared material**. End walls pass `rotate: true`.

**Playfield texture.** PPM 900 → 1706 (2048×1160) on high/ultra, 853 (1024×580) on low/medium. Delete the centre white radial lift at `rgba(255,255,255,0.10)` entirely — brightness comes from lighting. Delete the football penalty boxes; no ITSF table has them. Keep, re-weighted: halfway line 4 mm @ 0.72 α, centre circle r 0.09 @ 0.62, centre spot, rod ticks 1.5 mm @ 0.22 and only 40 mm long at each rail, two serve rings 22 mm at (±0.30, ±0.34). All ink double-stroked with a 0.35 px feathered outer at 30% α and a 2% per-pixel alpha jitter. ORM: roughness 0.22 base, ~3000 longitudinal micro-scratches (1 px, 40–300 px long, ±2° off X, roughness +0.12), scuff patches at 0.45 in the traffic zones, AO ramping to 0.45 across a 22 mm band at every rail and post junction. Height: scratches at 0.15, printed ink standing 0.08 proud. `wrap: 'clamp'`, `flipV: true` — **delete the `repeat.set(1,-1)` / `offset.set(0,1)` mirror hack and the `RepeatWrapping`**, which currently bleeds the opposite edge one pixel all the way round. `minFilter` stays `LinearMipmapLinearFilter`; today's `LinearFilter` makes the `anisotropy = 8` a no-op and will moiré under the new framing.

**Goal mouth.** Posts: `BoxGeometry(goalPostRadius*2, …)` → `CylinderGeometry(0.007, 0.007, 0.055, 16)` — identical radius, honest silhouette, `chrome()`. Recess lined in `powderCoat()`, `receiveShadow` on every recess part, a box floor not a single-sided plane, a 3° sloped return floor, a 2 mm chrome lip, and a 5-plane `goalMesh()` net (back, two sides, top, floor). Lintel underside bevelled 2 mm.

**Cabinet furniture** (load-bearing under the new framing, not polish): four legs `CylinderGeometry(0.034, 0.028, 0.74, 4)` rotated 45° so the playfield sits 0.90 m over the venue floor; two 30×30 mm stretchers at `y = −0.55`; rubber levellers; a ball-return trough on each side rail (34 mm channel, opening at `x = ±0.42`); two abacus scoreboards as one 20-instance `InstancedMesh` of a lathed bead on a 6 mm chrome rod; a 100×140 mm brushed coin-door plate with four countersunk bolts; eight 26 mm rod-hole escutcheons in `anodisedAluminium()` where the bars exit the rails — **static children of `root`, never of a rod pivot**.

**Discipline.** All static wood merges into two `BufferGeometry` grouped by material. `root.matrixAutoUpdate = false` plus one `updateMatrixWorld()` after construction.

**ACCEPTANCE CRITERIA**
1. Zoom to any rail top corner: a continuous bright specular line runs along a visibly rounded 4 mm fillet. No 90° box corner is visible anywhere on the cabinet.
2. The cabinet fully encloses the goal recess from every angle. No dark rectangle or black stick protrudes past the cabinet end, and the artefact at `base-side.jpg` (~100,655) is gone.
3. Rails and cabinet body are visibly different woods — different hue, different gloss, different grain scale — and grain runs lengthwise on all four walls including the end walls.
4. The overhead bar reads as a long soft streak down the playfield, and the laminate shows directional scratches aligned with the long axis. There is no white blob in the centre of the field.
5. Both goal mouths show a round post, a visible diamond net, and a lit interior with depth. Neither is a flat black rectangle.
6. Legs, a trough, an abacus and a coin door are visible; the table stands on a floor rather than ending in air.

---

### P3 — RODS AND FIGURES

**Owns:** `packages/client/src/render/rods.ts`.

**Rods.** Bar radius 0.006 → **0.0075** (15 mm dia, tournament-correct), segments 14 → 20. Runtime assertion: `rodHubY - barRadius (0.0865) > ball.radius*2 + 0.002` — the ball can never reach the bar, so this is purely cosmetic. Material `brushedSteelRod()`. Bar extends 12 mm past each handle and gets a chrome end cap. `bar.castShadow = true` on high/ultra (currently hard-false — eight rods lying across a shadowed playfield casting nothing is a hard fake tell).

**Handles.** `CylinderGeometry(0.014,0.014,0.062)` → `LatheGeometry` from an 11-point profile, 26 mm waist flaring to 32 mm at both ends, 110 mm long, in `rubberGrip()` with the 8×2 diamond knurl. Rounded end cap carrying a debossed team mark.

**Fix the sliding collar (audit finding #43).** The collar torus is currently a child of `pivot`, so it slides from `slide ± 0.352` and buries itself in the rail — that is the dark lozenge with two specular pinpricks in `base-side.jpg`. Reparent to `root`. It becomes a static bearing boss: `CylinderGeometry(0.017, 0.019, 0.014, 16)` in `anodisedAluminium()` seated in the rail, plus a white nylon bushing `r 0.016` and a black rubber bumper `TorusGeometry(0.013, 0.005, 8, 20)` 8 mm outboard. All 16 merge into one geometry, one draw call.

**Footballer.** Replace the 6-primitive stack with **one merged geometry**:
- Body: `LatheGeometry` from a 22-point hand-authored profile, 20 radial segments — boot flare → ankle → shin → knee → thigh → hip → waist → chest → shoulder → neck → crown. One continuous silhouette, no intersection seams.
- Arm loop: `TorusGeometry(0.0105, 0.0032, 8, 20)` at shoulder height **in the XZ plane**, scaled so max |Z| extent = 0.0205 and max |X| extent = 0.014. This is the ruling that resolves the two proposals' conflict: arms are the single biggest silhouette win, and putting the loop inside `figureHalfWidthZ` (0.024) on Z and inside `footRadius` (0.018) on X means the arms can neither widen the block along the rod nor appear to strike before the collider does.
- Boot: the lathe's boot flare, plus a 0.006 m sole plate and a gloss toe cap, all inside the sphere of radius `footRadius`.
- Sock band, shorts value break and a diagonal sash baked into the kit texture — a sash reads at 30 px where a shirt number does not.

**HARD BUILD-TIME ASSERTIONS, throwing in dev, not comments:**
```
profileRadiusAt(-legLength) === table.footRadius            (tolerance 1e-9)
max(profileRadius) over the torso band <= table.torsoRadius * 1.05
max(|Z|) over ALL merged geometry <= table.figureHalfWidthZ  (0.024)
max(|X|) over ALL merged geometry <= table.footRadius        (0.018)
```

**Instancing.** 26 figures × 6 meshes ≈ 160 draw calls today. Collapse to **two `InstancedMesh`** (one per team, 13 instances) of the merged figure, composing `instanceMatrix` per frame from the existing pivot transforms. This change pays for GTAO, the venue and the volumetrics; it must land before the old figures are deleted. Instance attributes `aTint` (vec3, ±2% hue/value jitter so 13 men are not clones) and `aRim` (float), consumed by `patchInstancedTintAndRim`. `castShadow` on the InstancedMesh = 2 shadow draws instead of 156.

**Active-rod indicator — the decided compromise.** `setActiveRod` must stop reassigning `mesh.material` (that clone-and-compile is a guaranteed first-switch hitch, and it currently misses `head` and `foot`, making the active figure two-tone). Three layers instead:
1. **Rail LED bead**, 34 mm, recessed into both side rails at each rod's fixed `x`: active `emissiveIntensity 2.6`, owned-inactive 0.35, other 0. Hardware signalling, photoreal-correct.
2. **A narrow additive ground beam**, `PlaneGeometry(0.040, halfWidth*2)`, `decalMaterial({ blend: 'add', renderOrder: 10 })`, peak α **0.22**, falling to 0 at ±20 mm, team-coloured. Playability outranks atmosphere: a new control scheme is unlearnable without an on-field instrument, so the beam stays — but at a fifth of today's 0.42 and a third of its width. Owned-inactive rods get α 0.10. **`mesh.visible = alpha > 0`** — today 16 transparent planes are submitted every frame at α 0.
3. **Fresnel rim** on the active rod's figures via `aRim = 1`, not a 0.55 full-body emissive.
4. **Charge arc** for the new wind-up control: a 3 mm `RingGeometry` segment around the active collar, `thetaLength = windup / 1.95 * 2π*0.75`, colour lerped `0xffd980 → 0xff6a3a`. Read from `renderState.rodTheta`, so it is truthful.

Rim colour and bead colour must come from the **same palette source** as the team colour, or deuteranopia mode reintroduces a red/green collision on the highlight.

**ACCEPTANCE CRITERIA**
1. Rods show a longitudinal brushed streak with a value gradient along their length. No rod is a uniform clipped white bar, and no faceting is visible on the near rods.
2. Zoom to a footballer: one continuous moulded silhouette with a visible arm loop, a distinct boot, a sock band and a kit/shorts value break. No sphere-to-sphere seam and no bare cream head.
3. The 13 figures on a side are visibly not identical — the specular dot and the paint value differ per figure.
4. Rod shadows lie across the playfield alongside the figure shadows on high/ultra.
5. No collar, bushing or bumper moves when a rod slides, and nothing is half-buried in the rail at any slide position.
6. The active rod is identifiable in under 200 ms from a still frame, via the rail bead and a narrow beam — and the beam does not read as a white scuff painted on the pitch.

---

### P4 — VENUE / ENVIRONMENT

**Owns:** NEW `packages/client/src/render/environment.ts`.

Kill the void. `PLAYFIELD_HEIGHT = 0.90` — the venue floor sits at `y = −0.90`.

**Floor.** `PlaneGeometry(14, 14)` at `y = −0.90`, `venueFloor()`, `receiveShadow`. Plus a pool-of-light decal: `CircleGeometry(3.4, 64)` at the same y, `decalMaterial({ blend: 'add', renderOrder: 1 })`, peak α 0.35, falling to 0 at the rim.

**Backdrop.** Open-ended `CylinderGeometry(9, 9, 6, 48, 1, true)`, `side: BackSide`, 512×1024 vertical gradient `#0b0f14` top → `#141b24` at the floor. Unlit, fog-affected, one draw call.

**Crowd.** `CylinderGeometry(9.5, 9.5, 4.2, 48, 1, true)` inside the backdrop, `crowd()`, `BackSide`, unlit. detail ≥ 1.

**Sponsor boards.** Two 6.0 × 0.62 m boards at `z = ±2.1` and two 3.2 m end boards at `x = ±3.2`, tilted −6° toward the camera, `sponsorBoard()`. **Invented marks only.** detail ≥ 1. Boards and floor are ON at every preset including low — drop them and the black void returns.

**Truss.** Six `CylinderGeometry(0.05, 0.05, 7, 6)` bars at `y = 3.4` plus eight `SphereGeometry(0.09)` unlit lamp housings that exist to feed bloom. detail 2 only.

**Light-bar housings.** Two at `y = 1.06`, `x = ±0.30`: `BoxGeometry(0.62, 0.055, 0.10)` in `anodisedAluminium()` with an inner downward `PlaneGeometry(0.60, 0.085)` in `emissivePanel()`. These are the source of every highlight in the frame. Expose their positions via `barAnchors` so `scene.ts` places its SpotLights at exactly the housings the player can see.

**Atmosphere.** `scene.fog = new FogExp2(0x080b0f, 0.085)` — the current `Fog(0x0a0d12, 2.4, 6.5)` starts biting exactly at the far goal, which is why the far half of `base-side.jpg` is desaturated mush. Background `Color(0x070a0e)`.

**Volumetrics.** Two open-ended `ConeGeometry(0.92, 1.06, 28, 1, true)` under each housing, additive, `depthWrite false`, fading on `pow(1 - |dot(normal, viewDir)|, 2.2)` and on normalised height, peak α **0.045**, plus a soft depth fade so the cone does not hard-clip on the rails. ~60 haze motes as one additive `Points` cloud, size 0.004, drifting at 0.01 m/s. high/ultra, killed by `reducedEffects`.

**PMREM env scene.** A separate tiny `Scene`, never added to the render scene: inverted `BoxGeometry(16, 7, 16)` at 0.04 luminance, **two emissive strips at the exact `barAnchors` positions**, a warm `0x2a1c10` floor plate, four cool `0x14202e` wall cards. Pass to `materials.pmremFromScene(renderer, envScene, 0.02)`, then `materials.setEnvironment(tex)`. This replaces `RoomEnvironment` — a bright white demo box that is never visible in frame and is the single reason the chrome has no shape.

**Per-frame:** `update(timeSec)` scrolls the crowd LED ribbon offset and drifts the motes. **Zero allocation.** Everything else `matrixAutoUpdate = false`.

**ACCEPTANCE CRITERIA**
1. No frame contains pure black emptiness. Floor, backdrop, boards and a crowd suggestion are visible behind and below the table at every preset above `low`, and floor plus boards at `low`.
2. The table casts a real footprint shadow onto the floor, and the legs meet the floor.
3. Two light housings are visible in frame, and the specular streak on the rods and the laminate can be traced to them by eye.
4. The chrome and steel reflect a dark venue with directional structure, not a uniform pale white sheen.
5. There is no visible fog band across the venue or the far half of the playfield.
6. On high/ultra, faint light shafts are visible under the housings without washing out the playfield or the ball.

---

### P5 — SCENE, LIGHTING, POST, PRESETS

**Owns:** `packages/client/src/render/scene.ts`.

**Tone mapping: `ACESFilmicToneMapping` stays** (lead ruling — an AgX swap would invalidate every already-verified team, HUD and colourblind palette). `toneMappingExposure` 0.92 → **1.06** to carry the darker venue.

**Light rig.** Delete `AmbientLight(0xb9d4ff, 0.35)` — `scene.environment` already supplies the diffuse ambient term and adding a constant lift on top is precisely the "everything is the same brightness" look. Replace the key/fill pair with:
- `HemisphereLight(0x1c2836, 0x090b0e, 0.22)`
- Two overhead bars at the `Venue.barAnchors`: `SpotLight(0xffe9c8, 34, 3.2, 0.66, 0.90, 1.7)`, target `(x, 0, 0)`. **Only bar A casts shadow.**
- Cross-fills, neither casting: `DirectionalLight(0x3d5f8a, 0.35)` from `(2.2, 0.5, −1.8)`, `DirectionalLight(0x8a5f3d, 0.22)` from `(−2.0, 0.4, 1.6)`. Two low coloured rim kickers are what give every silhouette a lit edge.
- Floor bounce: `DirectionalLight(0x5a4632, 0.14)` from `(0, −1, 0.2)`.
- Goal lights, high+: `PointLight(teamColour, 0.9, 0.18, 2)` inside each recess.
- **No `RectAreaLight`.** It cannot cast shadows, so the shadow direction would have to come from a separate directional that never agrees with the visible source.

Live light counts: low 2, medium 4, high 7, ultra 7.

**Shadows.** One caster. Frustum tightened from `±1.1 × ±0.8` to `near 0.35, far 2.6`, fov derived from `angle 0.66`, `focus 1.0` — the far plane now reaches the venue floor so the table casts a ground shadow, and the texel drops from 1.07 mm to 0.72 mm for free. `bias −0.00035`, `normalBias 0.004` (today's 0.008 is 8 mm on an 18 mm foot and visibly detaches the boot from its shadow), `radius 3`, `blurSamples 12`. `mapSize` 2048 high/ultra, 1024 medium, off low. `PCFSoftShadowMap`.

**Contact-shadow decals.** One shared `PlaneGeometry(0.05)` + one `decalMaterial({ blend: 'multiply' })`, drawn as a 26-instance `InstancedMesh`, α `0.45 * clamp(1 - footHeight/0.05)`. **Present on ALL presets including low**, so grounding survives with shadows and GTAO off. (Geometry lives here; P3 feeds the matrices via the integration contract.)

**Post chain.** `RenderPass → GTAOPass (high half-res / ultra full-res) → AfterimagePass (ultra + motionBlur) → UnrealBloomPass → FilmicPass → SMAAPass → OutputPass`. Note SMAA moves **after** the grade so antialiasing runs on display-referred data — today it runs on linear HDR and the blended edge pixels get re-curved, which is the ropey silhouette on the bright rods in `06-final.jpg`.
- Bloom: `(0.22, 0.45, 0.97)` → **strength 0.34, radius 0.62, threshold 0.72**. 0.72 sits deliberately above the brightest laminate pixel and below the ball, so bloom is a readability tool that makes the ball glow. Construct with a real `Vector2`, and build the composer after the first `resize` — not at 1×1.
- GTAO: `radius 0.028 m`, `distanceExponent 1.6`, `thickness 0.02`, `scale 1.0`, `blendIntensity 0.9`, `samples 8` half-res on high, 16 full-res on ultra.
- `motionBlur` is currently a **dead toggle** plumbed all the way from the accessibility UI and never read. Wire it: `AfterimagePass({ damp: 0.78 })`, ultra only, off when the accessibility toggle is off.
- **No `BokehPass`.** A forward blur with no edge-aware guard can smear the ball's silhouette, and that is a gameplay regression. The DOF read comes from `FilmicPass`'s radial edge blur, which is confined to `r > 0.55` where no ball and no figure ever sits.

**`renderScale` fix.** Today `Math.min(devicePixelRatio, 2) * scale` **multiplies** DPR, so ultra on a 2× display renders at 2.5× — 6.25× the pixels, and it cannot hold 60 FPS. Replace with `renderer.setPixelRatio(clamp(dpr * scale, 0.5, 2))` and set **ultra `renderScale` to 1.0**, spending the budget on full-res GTAO instead.

**Preset gating.** `GraphicsSettings` gains: `shadowMapSize: 0 | 1024 | 2048`, `grade: boolean`, `ao: 'off' | 'half' | 'full'`, `materialTier: QualityTier`, `textureRes: 512 | 1024 | 2048`, `venueDetail: 0 | 1 | 2`, `volumetrics: boolean`, `extraLights: boolean`, `rodShadows: boolean`. `applyGraphics` hot-swaps the material tier through the P1 registry rather than rebuilding the scene, and pre-compiles both shadow variants with `renderer.compile()` behind the settings screen so flipping shadows mid-match does not recompile ~240 materials on the next frame.

**Auto-downgrade.** If `FrameStats.frameMs > 13` for 2 continuous seconds, step `ao` down one level, then `volumetrics` off, then `bloom` off. Log each step to the dev HUD.

Also: `preserveDrawingBuffer` gates on `?harness=1`, not on `DEV`. Assign `Layers` up front (0 table, 1 figures, 2 ball, 3 vfx, 4 backdrop) — a prerequisite for any future selective pass.

**ACCEPTANCE CRITERIA**
1. Every rail-to-playfield junction, every goal recess and every boot-to-laminate contact shows visible darkening on `high` — and still shows it on `low`, from baked AO and contact decals.
2. The ball is the brightest object in the frame and is the only object that blooms. Nothing else glows.
3. The image has visible corner falloff, film grain in the shadows, and a warm-highlight / cool-shadow split. It does not look like a raw framebuffer.
4. Turning `reducedEffects` on removes grain, aberration, halation, volumetrics and the split-tone while leaving the image correctly exposed and fully legible.
5. `low` runs with no composer, no shadows, two lights, and the table still reads as grounded and standing in a venue.
6. Ultra on a 2× display renders at 2× pixel ratio, not 2.5×, and no preset exceeds its stated frame budget in section 5.

---

### P6 — CAMERA

**Owns:** `packages/client/src/render/camera.ts`.

The user's complaint is one line of code: `behind` at `offset(-2.32, 1.88, 0)` puts the playfield at ~32% of a 1200 px frame with ~25% dead black above and below.

**Delete every hand-tuned magic offset.** Framing is solved, not tuned.

**`fitFrame(view, aspect)`:** project the 8 corners of the playfield-plus-rail box `(±0.628, 0..0.13, ±0.368)` into NDC along the view's unit direction, and binary-search the distance (2 iterations of secant, tolerance 0.5%) such that the projected bounds fill `fillWidth` of the frame width and no more than `fillHeight` of the height. Re-solve on every `resize` and on every FOV change. Then the framing is correct on every aspect ratio and every table.

**New default view `sideline`** — replaces `behind` as default:
- unit direction `normalize(-0.62, 0.72, -1.34)` = `(-0.3775, 0.4383, -0.8157)`
- `lookAt (0, 0.055, 0)`, `fov 30`, `fillWidth 0.90`, `fillHeight 0.92`
- solves at 16:9 to **distance 1.70 m**, position `(-0.642, 0.745, -1.387)`, elevation **26°**, an 85 mm-equivalent lens
- **`|dot(cameraRight, +Z)| = 0.42`**

That last number is the constraint the whole view exists to satisfy. A *pure* side view has `cameraRight ≈ (-1, 0, 0)`, so rod slide runs directly into the screen and the game is uncontrollable. **Hard rule: any view usable for play must keep `|dot(cameraRight, +Z)| ≥ 0.35`.** `sideline` sits at 0.42, a 24.8° yaw off the sideline normal — the table still fills the frame, and slide still maps to a screen axis.

Retain `behind`, `overhead`, `broadcast`, all re-solved through `fitFrame` with the same margins. Add `puresideline` flagged **spectate/replay only** and excluded from the in-match camera cycle.

**Clamp the FOV nudge to 24..40 on `sideline`** and re-solve distance from it, so the player's FOV setting is a *lens* choice that cannot break the fit. Today `blended = spec.fov * (next.fov / 46)` clamped 28..92 changes FOV without re-solving distance, which makes the slider a "zoom in and lose the far goal" control.

**Fix `recomputeBase`:** it scales `offset.z` by `halfWidth` and `x`/`y` by `halfLength`, so a sideline view's elevation is an accident of the table's aspect ratio. Scale all three by `halfLength`, or take a plain world offset.

**Frame-rate independence.** Every smoothing rate becomes `1 - Math.exp(-k * dt)`; the seven `Math.min(1, dt*k)` constants get names. Today the follow lag and shake frequency measurably differ at 30 and 240 FPS.

**Shake.** Apply as an explicit rotation offset plus a small roll **after** `lookAt`, not as a translation that `lookAt` then partially cancels. Add a one-frame FOV punch. Delete the dead `this.desired === this.base` ternary at line 194 — `desired` is assigned by `.copy()`, so that identity test is always false.

**Export, for the input layer:**
```ts
export function screenSlideSign(camera: PerspectiveCamera): number;
// right = column 0 of camera.matrixWorld; return |right.z| < 0.25 ? 0 : sign(right.z)
```
`recomputeBase` mirrors on X only, so for team B `behind` currently maps slide **backwards**. This function is the fix, and it is why the camera package owns it.

Also expose `readonly focusDistance: number` (camera → ball, or camera → lookAt when no ball), and `setAspect(aspect)`.

**Breathe:** `0.004 m` on `sin(t * 0.31)`, suppressed when `cameraShake` is off. `goalZoom`: fov 30 → 27 over 140 ms, hold 500 ms.

**ACCEPTANCE CRITERIA**
1. In the default view the playfield spans 88–92% of the frame width at 16:9, 21:9 and 4:3, with both goals fully visible in all three.
2. The far goal renders at ≥ 80% of the near goal's on-screen height (today it is 40%), and far-rod rotation is readable.
3. No frame has more than 8% of its height as empty background above the table.
4. Dragging the FOV slider across its whole range never crops a goal and never changes the fill fraction by more than 4%.
5. Slide input moves the rod in the direction the mouse moved, for **both** teams, in every playable view.
6. A goal impact reads as a camera hit with rotation and roll, not a lateral drift — and turning `cameraShake` off leaves the goal celebration fully present.

---

### P7 — BALL AND EFFECTS

**Owns:** `packages/client/src/render/ball.ts` + NEW `packages/client/src/render/effects.ts`.

**Ball.** `SphereGeometry(0.0175, 28, 20)` → `(0.0175, 40, 28)`. Radius stays exactly `CompiledBall.radius`. Material: `MeshPhysicalMaterial({ color: 0xf4f0e4, roughness: 0.30, clearcoat: 0.70, clearcoatRoughness: 0.22, envMapIntensity: 1.1, emissive: 0xfff4e0, emissiveIntensity: 0.08 })` — the emissive is a readability floor, not a look. The physical shader on at most 8 spheres is free.

**Ball texture.** Delete the six drawn circles (they distort into smeared arcs near the equirect poles). Build a 1024² set: ~6000 jittered-grid dimples (radius 3–5 px, height −0.4) → normal at strength 0.9; a mould seam ring; a faint two-line brand stamp; ORM with dimple floors at 0.42 and tops at 0.26.

**Trail.** The `Line` + `LineBasicMaterial` is a 1 px hairline on every WebGL implementation and will not survive the new framing. Replace with a **24-segment × 2-vertex camera-facing triangle strip**, half-width tapering from `1.9 * radius` at the head to 0 at the tail, custom additive `ShaderMaterial`, soft edge `1 - pow(|v|, 2.0)`, per-vertex alpha on `1 - t^1.6`, colour lerped warm-white → amber by speed. Built from the **same** `trailPositions` buffer and the **same** `strength = clamp01((speed/maxSpeed - 0.12) / 0.5)`, so the `showBallTrail` toggle behaves identically. Fix the frame-rate dependence: decimate on a fixed 8 ms interval keyed off the sim tick, not once per rendered frame — today the trail spans 0.1 s at 240 FPS and 0.8 s at 30 FPS. Name the two magic constants.

**Marker.** `MeshStandardMaterial` → `decalMaterial({ blend: 'add' })`. It is currently **lit**, so it darkens exactly when the ball enters a shadow and you most need it — that breaks the accessibility guarantee. Redraw at 256² as a 2 px double ring with four ticks, and drive radius by `1 + ballY * 5.5` and opacity by height (0.18 grounded → 0.55 airborne) so it doubles as an altitude read.

**Contact shadow.** Separate from the marker and **always on** — grounding, not an effect. `PlaneGeometry(radius * 4.2)`, `decalMaterial({ blend: 'multiply' })`, α `0.45 * clamp(1 - ballY/0.09)`. With a long lens flattening depth cues along the short axis, ball height must have two independent reads.

**Allocation.** Hoist the `new Quaternion()` currently allocated inside the per-ball per-frame loop (up to 8 per frame) next to the existing `axis`/`step` scratch vectors. **`void dt;` is deleted** — trail decimation, marker pulse and impact decay all become time-based.

**Delete every y-epsilon.** `0.0015`, `0.0012`, `0.0009`, `0.0005` across four files all become `y = 0` plus `decalMaterial`'s polygon offset and explicit `renderOrder`. At the new grazing angles those epsilons *will* z-fight.

**`effects.ts` — the VFX bus.** Today all four event kinds produce camera shake and nothing else: no particle, no flash, no decal, no light response anywhere in the renderer.
- `FilmicPass`: one fragment shader doing radial lateral chromatic aberration (R/B UV offset ±0.00055·r², only outside r > 0.35), vignette `pow(1 - 0.62·r², 1.35)` aspect-corrected, per-channel halation (3 taps, R 1.0 / G 0.72 / B 0.55 px × 2.4), animated hash grain at amplitude 0.018 scaled by `(1 - luma)` so it lives in shadows, lift/gamma/gain `(0.004 / 0.98 / 1.02)`, a 0.06 split-tone (shadows `0x0d1a24`, highlights `0xfff0d8`), and a radial edge blur at max 1.2 px confined to `r > 0.55`. One pass, ~0.25 ms at 1080p.
- Pooled particles: one additive `Points` with an instanced lifetime attribute. `EV_KICK` → 12 motes; `EV_FIGURE_HIT` → 6 scaled by magnitude; `EV_WALL_HIT` → 4. medium+.
- `EV_GOAL`: ramp the conceding goal's `PointLight` 0.9 → 14 over 90 ms, decay over 900 ms; ripple the net's texture V on a sin over 0.35 s; push bloom strength +0.3 for 400 ms; flash the rail LED beads to the scoring team's colour. **None of this is gated behind `cameraShake`** — the current code returns early from `addShake`/`addZoom` when reduced motion is on, which deletes the entire goal celebration.
- Scuff decals: a small ring buffer of 16 multiply decals where the ball hits hard. high+.

Everything pooled, everything scalar writes on pre-existing objects, **zero allocation per event**.

**ACCEPTANCE CRITERIA**
1. Zoom to the ball at rest: a dimpled semi-gloss tournament ball with a mould seam and one crisp specular hot spot. No polka dots, no smeared polar arcs.
2. At 10 m/s the trail is a tapered photographic streak, not a hairline, and its physical length is the same at 30 and 240 FPS.
3. The ground marker has identical brightness inside and outside a shadow, and visibly grows as the ball rises.
4. A goal produces a light flare in the mouth, a net ripple, a score reaction and a bloom pulse **with `reducedEffects` and `cameraShake` both off**.
5. No decal z-fights, shimmers or disappears at any camera angle or any ball position.
6. `EV_KICK`, `EV_FIGURE_HIT` and `EV_WALL_HIT` each produce a distinct visible response on `medium` and above, and the renderer's per-frame allocation count is zero.

---

### P8 — UI

**Owns:** `packages/client/src/ui/*.tsx` + `packages/client/src/styles.css`.

**Fonts first — the highest-leverage hour in the project.** `styles.css` declares Inter and JetBrains Mono; neither is loaded anywhere. `packages/client/public/` is empty. **Every character in the game currently renders in Segoe UI**, at `font-weight: 800`, on the title screen of a sports game. Add to `index.html <head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
```
Archivo (variable width) for the wordmark, headings and all numerals; Inter for body; JetBrains Mono for telemetry and keycaps. Delete weights 650, 750, 800 — they are not real static weights and render as two weights, not three. **400 / 600 / 900 only.**

**Tokens.** One spacing atom `--u: calc(4px * var(--ui-scale))` and everything derives from it. Seven radii → four (`--r-s/-m/-l/-pill`). Five hairline alphas → two tokens. **Nineteen hardcoded hexes and twenty-five rgba literals → tokens; no bare `px` outside the `:root` block, ever.** Five type sizes, not sixteen. Today `--ui-scale` scales type only while radii, shadows, `clamp()` floors and the HUD's `top: 22%` do not — it distorts rather than scales. Gate: verify at 0.8 / 1.0 / 1.25 / 1.5.

**Colour — the accent becomes the player's team.** The UI's amber `#ffc247` appears in zero pixels of gameplay, which is why the menu reads as a third brand. Invert it: `--accent` is set from `teamColors(colorMode)` for the local player's team, and amber becomes `--energy`, reserved for exactly three things — ball, power, goal/MVP. **Ship `accentSafe()`:** `highContrast` returns `['#ffffff', '#111318']`, and a white or near-black accent is unusable; fall back to a fixed `#4fa3ff`. Extend `teamColors()` to return per-team *ink* colours, which fixes the live accessibility bug where `.team-chip`'s hardcoded `color: #0b0e13` on team B in high contrast gives a 1.05:1 contrast ratio and an invisible letter "B".

**High contrast becomes a complete second palette** — the full ramp plus `--accent`, `--energy`, both hairlines, `--glass` and `--good/--warn/--bad`. Today it overrides six greys and nothing else.

**Three materials:** `.glass` (HUD chrome only, top edge hairline only), `.plate` (menu/lobby/results, with an inline SVG `feTurbulence` grain at 3.5% overlay), `.recess` (inputs, rows, empty slots, inset shadow, no outer border). Plus `.chamfer` via one `clip-path`, applied to exactly four things: hero CTA, score bug, MVP card, lobby code.

**Motion.** Token set: `--e-out cubic-bezier(.16,1,.3,1)`, `--e-snap cubic-bezier(.2,1.6,.4,1)`, durations 120 / 220 / 420 / 700 ms. Screen entrance = a 50 ms-staggered `rise` (never more than 12 px of travel). Wordmark = a tracking-in settle. Hover = `translateY(-1px)` + an accent ring + a cursor-tracking radial highlight (`--mx/--my` from one rAF-throttled listener on the menu root only, zero in-match cost) — not today's 6% lightness bump. Focus-visible = a double ring on `:where(button, input, [tabindex])`, so a gamepad can finally navigate the menu the settings already promise.

**`prefers-reduced-motion` substitutes, it does not delete.** Replace the `* { animation-duration: 0.01ms !important }` sledgehammer with token overrides plus `animation-name: fade` swaps. Reduced-motion players must still get acknowledgement for goals, countdowns and screen changes; today they get none.

**Main menu.** Not centred, not two cards in an auto-fit grid. An asymmetric rail: `grid-template-columns: minmax(360px, 38vw) 1fr`, left rail carrying a wordmark lockup, one chamfered hero CTA (`QUICK MATCH`, with `vs Normal AI · first to 5` rendered from live state on a second line so configuration moves *below* the CTA instead of gating it), then nav **rows** — not four identical buttons — with a scaleY accent bar, a chevron nudge and a crossfading one-line description. A config chip strip using `aria-pressed` (the current segmented control has no ARIA state at all, so no assistive tech can read the selected difficulty). A bottom legend bar with version, build hash and live keycap input hints. The right 62% is table: that asymmetry **is** the negative space.

**Live 3D backdrop.** A `GameView` in attract mode behind the menu: 30 FPS hard cap, `renderScale ≤ 0.85`, `view: 'broadcast'`, `followStrength 0`, no simulation, idle rod drift. **It must call `effectiveGraphics(settings)`** — hand-building a graphics object brings ultra's motion blur back for a player who disabled it for medical reasons. Gated off on `low`, under `reducedEffects`, under `prefers-reduced-motion`, and under 720 px. Fallback: gradients plus the plate grain. **The scrim is non-negotiable:** a hard left gradient plus a top radial, or text over live 3D becomes a legibility disaster.

**Copy.** Delete "server authoritative", the loopback-transport explanation, the `wss` upgrade policy and the `pnpm dev:server` instruction in `<code>` on the main menu of a sports game.

**HUD.** `.hud` becomes a three-row grid and **every absolute position inside it is deleted**, including `.phase-banner`'s `top: 22%`.
- **One score bug, top-centre**, `.glass .chamfer`, `grid-template-columns: 1fr auto 1fr` with `min-width` in `ch` so the clock never moves when a score changes. Team colour as a 4 px hard crest bar, not a rounded chip. The local player's side carries an `--accent` backplate and a `YOU` tag — today `[A] 3 : 2 [B]` gives the player no way to know which number is theirs.
- **Possession bar** and the general rule: **React writes CSS custom properties at 12.5 Hz; CSS `transition` interpolates. No `requestAnimationFrame` in any HUD component, ever.**
- **Four-slot rod chassis, always four**, with an `owned` flag instead of `continue` — which finally uses the `.rod-pill.unowned` rule that has been sitting in the stylesheet unemitted, and gives the strip a fixed width. Each slot gets a real keycap, the role, a **wind-up arc** (`conic-gradient` on a registered `@property --p`, from `rodTheta`) and a **cooldown wipe** (from `rodKickCooldown`). `SimState` already exposes `rodTheta`, `rodOmega`, `rodKickCooldown`, `rodLastKickPower` and the HUD snapshot currently throws all four away. This is the HUD half of the new-controls request: a new scheme is unlearnable without an instrument showing its state.
- **Goal gets a full second:** flash → letterbox bars → `GOAL` in the display face with a tracking settle, **in the scoring team's colour** (the payload knows; today it is always amber) → scorer line → score digit reaction → bars retract at 1000 ms. All CSS keyframes, keyed on goal count, zero per-frame JS.
- **Countdown** re-keyed per integer so its 400 ms pop restarts cleanly and the ±80 ms sampling jitter is invisible.
- **Telemetry recedes:** mono, `--t-xs`, 55% opacity, no borders, no backplates, bottom-right. Today ping and fps get the same bordered glass plate as the score.
- **Nothing may reflow.** `tabular-nums` plus `ch` min-widths everywhere; every conditional element reserves its box with `visibility: hidden` and never unmounts.
- `aria-live="off"` stays on the HUD; score changes announce through a separate `polite` node.

**Lobby / Results.** Sixteen underlined lowercase hyperlinks → one `+ Add player` popover per slot. Dashed empty-slot borders → `.recess`. Raw `classic-wood` IDs → `MODE_LABELS` / `TABLE_LABELS` in `game/labels.ts`. Ping as a four-bar signal glyph. Ready state as a full-row accent bar plus a `READY` tag, not a 9.6 px dot. Results sequenced in three beats with an MVP card as the hero object; **write the `.team-a` / `.team-b` rules** `Results.tsx` has been emitting into a void, so the final score digits finally carry team colour. Replace every invisible `<th title>` and disabled-button `title` with `<abbr>` and `aria-describedby`.

**UI sound.** `AudioSettings.sfx` currently controls nothing. Two procedural WebAudio cues, ~25 lines, no assets: hover 1180 Hz sine 18 ms at gain 0.05; select 620 Hz triangle plus a bandpassed noise burst 55 ms at gain 0.12. Both scaled by `audio.master * audio.sfx`, both respecting `muteWhenUnfocused`.

**Dead code to close:** `.overlay-error`, `.team-a`, `.team-b`, `.ball-speed`, `.settings` emitted-but-unstyled; `.rod-pill.unowned` styled-but-unemitted; `onSetRods` threaded through `Lobby.tsx` props and never used.

**ACCEPTANCE CRITERIA**
1. No screen renders in Segoe UI or Consolas. The wordmark is a lockup with a defined baseline relationship, not a heading with a coloured span.
2. Set `uiScale` to 1.5: type, spacing, radii, hairlines and every HUD anchor all scale together with no clipping, no overlap and no reflow.
3. Enable high contrast plus each colourblind palette in turn: every letter, chip and digit meets 4.5:1, the accent is neither white nor near-black, and the team-B chip letter is legible.
4. The main menu is not two centred cards. One action is unmistakably primary, and configuration sits below it rather than in front of it.
5. In-match, one score bug sits top-centre with a `YOU` marker; four rod slots are always present with a live wind-up arc and cooldown wipe; ping and fps are visibly subordinate. Nothing shifts position across a score change or a 12.5 Hz sample.
6. With `prefers-reduced-motion` on, a goal still produces a visible, colour-correct acknowledgement.

---

### P9 — INPUT AND SETTINGS

**Owns:** `packages/client/src/input/bindings.ts`, `packages/client/src/input/input-manager.ts`, `packages/client/src/settings/settings.ts`.

Full scheme in section 6. Implementation notes that are P9's and nobody else's:

- The distance budget is **open-loop** and stays only inside the `classicWheel` branch. `MAX_BUDGET_TICKS = 3.5` means the rod keeps travelling 58 ms after the hand stops.
- The servo closes the loop over `session.renderState` via a new `RodProbe`, so a snapshot correction is absorbed rather than baked in.
- `quantizeAxis` and the quantize-before-predict ordering are **untouched**. Online prediction must stay byte-identical to the server.
- `InputContext` becomes **per-rod**. It currently uses global `maxSlideSpeed`/`maxAngularSpeed` and ignores `rodSlideSpeed[r]` / `rodRotationTorque[r]`; under the servo that mis-scales the demand.
- `MIN_HOLD_AXIS = 2/127` is load-bearing and non-obvious: the sim applies `returnToNeutralTorque * sin(theta)` **only when `rotAxis === 0`**, so a hand held at −1.5 rad with a zero axis gets pulled to neutral. Emitting the smallest value that survives quantization keeps the sim on its active branch. Without this line the windup-hold gesture does not work at all.
- Clamp the **accumulator**, not the output. Push 3 cm past the wall, pull back 1 cm, and the rod must move 1 cm off the wall immediately. Clamping only the output banks phantom deflection and gives a dead zone on the reversal — the single most common way an absolute mapping ships broken.
- **End of travel deliberately bypasses the brake.** Otherwise `slideVel` never exceeds `ROD_LIMIT_SOUND_SPEED = 0.35`, `emitRodLimit` stops firing, and the rod-clunk sound is silently deleted.
- Pointer deltas: prefer `pointerrawupdate`, fall back to `pointermove`. Sum `getCoalescedEvents()` when non-empty **or** the event's own `movementX/Y`, never both — Chrome includes the event itself in the coalesced list (double count), Firefox reports 0 on coalesced entries.
- `requestPointerLock({ unadjustedMovement: true })` in a try/catch, retry bare, then fall back to `pointerMode: 'drag'` and tell the UI. Swallow the acquiring click (`suppressNextKick`) or taking control fires a kick. The game must never become uncontrollable.
- On lock, blur and refocus, **re-anchor the hand** and zero `handVel`.
- Unwrap the rod angle into the player frame before servoing. `wrapAngle` folds `theta` into `(−π, π]`; without unwrapping the first full spin slams the rod backwards.
- `settings.ts` `VERSION` 1 → 2 with an **explicit** `preset: 'classicWheel'` migration for stored v1 blobs. The loader's `{...base.input, ...stored.input}` merge means a v1 blob with no `preset` key would otherwise silently inherit `direct` with v1 sensitivities.

**ACCEPTANCE CRITERIA**
1. Under `direct`, a full-track flick on MID (152 mm) stops within 1 mm of the hand with no visible overshoot, and holding the hand at −1.5 rad for 60 ticks keeps the rod within 0.03 rad of it.
2. Switching rods never moves any rod: the first `sample()` after `setActiveRod` returns `slide === 0 && rotate === 0`.
3. A fixed wrist sweep crosses the full track of GK, DEF, MID and ATK identically under `slideMapping: 'normalized'` — the 2.6× spread between DEF and MID is gone.
4. `classicWheel` reproduces today's budget output **tick-for-tick**, locked by a regression test; a stored v1 settings blob loads into it automatically.
5. Slide moves the rod in the direction the mouse moved for both teams in every playable view, driven by `screenSlideSign`.
6. Esc releases the pointer and shows a "Click to take the rods" scrim; a second Esc leaves the match. Pointer lock failing at any point leaves the game fully playable in `drag` mode.
7. The 100 existing tests still pass, and `packages/core` is untouched.

---

## 4. INTEGRATION CONTRACT

Everything crossing a package boundary. The lead wires `game-view.ts` from this section alone.

```ts
/* ---- materials.ts (P1) ---- */
// See section 2 in full. The symbols game-view.ts touches:
export function qualityFor(tier: QualityTier, envIntensity?: number): MaterialQuality;
export function setEnvironment(tex: Texture | null): void;
export function environment(): Texture | null;
export function materialStats(): MaterialStats;
export function disposeMaterialLibrary(): void;

/* ---- environment.ts (P4) ---- */
export const PLAYFIELD_HEIGHT = 0.90;
export interface BarAnchor { readonly x: number; readonly y: number; readonly halfLength: number }
export interface VenueOptions {
  table: CompiledTable;
  visuals: TableVisuals;
  quality: MaterialQuality;
  renderer: WebGLRenderer;
  detail: 0 | 1 | 2;
  volumetrics: boolean;
}
export interface Venue {
  readonly root: Group;
  /** Never added to the render scene. scene.ts must not touch it. */
  readonly envScene: Scene;
  readonly barAnchors: readonly BarAnchor[];
  readonly fog: FogExp2;
  readonly background: Color;
  setDetail(detail: 0 | 1 | 2): void;
  setVolumetrics(on: boolean): void;
  /** Zero allocation. Called once per rendered frame from GameView.render. */
  update(timeSec: number): void;
  dispose(): void;
}
export function buildVenue(o: VenueOptions): Venue;

/* ---- scene.ts (P5) ---- */
export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';
export interface GraphicsSettings {
  preset: QualityPreset;
  shadows: boolean;
  shadowMapSize: 0 | 1024 | 2048;
  bloom: boolean;
  antialias: boolean;
  motionBlur: boolean;
  renderScale: number;
  fpsLimit: number | null;
  grade: boolean;
  ao: 'off' | 'half' | 'full';
  materialTier: QualityTier;
  textureRes: 512 | 1024 | 2048;
  venueDetail: 0 | 1 | 2;
  volumetrics: boolean;
  extraLights: boolean;
  rodShadows: boolean;
}
export const QUALITY_DEFAULTS: Record<QualityPreset, Omit<GraphicsSettings, 'preset' | 'fpsLimit'>>;

export interface SceneBundle {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  composer: EffectComposer | null;
  /** Material quality derived from the active preset. Pass to every builder. */
  readonly quality: MaterialQuality;
  /** scene.ts adds venue.root, assigns fog/background, places SpotLights at barAnchors,
   *  and calls materials.setEnvironment(pmremFromScene(renderer, venue.envScene)). */
  attachVenue(venue: Venue): void;
  /** scene.ts owns the FilmicPass; GameView drives its clock. */
  setFilmicTime(seconds: number): void;
  /** Contact-shadow decal instances. P3/P7 write matrices, scene.ts owns the mesh. */
  readonly contactDecals: InstancedMesh;
  resize(width: number, height: number): void;
  render(): void;
  applyGraphics(settings: GraphicsSettings): void;
  /** true when reducedEffects should zero grain/CA/halation/volumetrics. */
  setReducedEffects(on: boolean): void;
  dispose(): void;
}
export function createScene(canvas: HTMLCanvasElement, settings: GraphicsSettings): SceneBundle;

/* ---- camera.ts (P6) ---- */
export type CameraView = 'sideline' | 'behind' | 'overhead' | 'broadcast' | 'puresideline';
/** Views offered in the in-match cycle. Excludes 'puresideline'. */
export const PLAYABLE_VIEWS: readonly CameraView[];
export interface CameraSettings {
  view: CameraView; fov: number; followStrength: number;
  shake: boolean; goalZoom: boolean; mirrored: boolean;
}
export const DEFAULT_CAMERA: CameraSettings;   // view: 'sideline', fov: 30
export function screenSlideSign(camera: PerspectiveCamera): number;
export declare class CameraRig {
  constructor(camera: PerspectiveCamera, table: CompiledTable);
  applySettings(next: CameraSettings): void;
  getSettings(): Readonly<CameraSettings>;
  setAspect(aspect: number): void;
  readonly focusDistance: number;
  addShake(strength: number): void;
  addZoom(strength: number): void;
  update(dt: number, ballPosition: Vector3 | null): void;
  snap(): void;
}

/* ---- effects.ts (P7) ---- */
export interface FilmicAmounts {
  grain: number; aberration: number; vignette: number;
  halation: number; edgeBlur: number; splitTone: number;
}
export const FILMIC_FULL: FilmicAmounts;
export const FILMIC_REDUCED: FilmicAmounts;   // grain/CA/halation/edgeBlur 0, vignette 0.25
export interface FilmicPass extends Pass {
  setTime(seconds: number): void;
  setAmounts(a: FilmicAmounts): void;
}
export function createFilmicPass(a: FilmicAmounts, width: number, height: number): FilmicPass;

export interface VfxOptions {
  table: CompiledTable; visuals: TableVisuals; quality: MaterialQuality; reduced: boolean;
}
export interface Vfx {
  readonly root: Group;
  /** Goal-mouth PointLights, so scene.ts can register them in its light count. */
  readonly goalLights: readonly PointLight[];
  onKick(x: number, y: number, z: number, power: number): void;
  onFigureHit(x: number, y: number, z: number, magnitude: number): void;
  onWallHit(x: number, y: number, z: number, magnitude: number): void;
  onGoal(team: number, goalX: number): void;
  /** Zero allocation. Returns a 0..1 bloom-strength boost for scene.ts to add. */
  update(dt: number, timeSec: number): number;
  setQuality(quality: MaterialQuality, reduced: boolean): void;
  dispose(): void;
}
export function buildVfx(o: VfxOptions): Vfx;

/* ---- table.ts (P2) ---- */
export interface TableMeshes {
  root: Group;
  /** Static bearing bosses, escutcheons and bumpers — parented here, NOT to a rod pivot. */
  readonly hardware: Group;
  /** Net back planes, so effects.ts can ripple them on a goal. Indexed by team. */
  readonly netPlanes: readonly Mesh[];
  dispose(): void;
}
export function buildTable(table: CompiledTable, quality: MaterialQuality): TableMeshes;
export function readVisuals(table: CompiledTable): TableVisuals;   // unchanged

/* ---- rods.ts (P3) ---- */
export interface RodVisuals {
  root: Group;
  pivots: Group[];
  setActiveRod(rod: number): void;
  setOwnedRods(mask: number): void;
  /** Charge arc feed, from renderState.rodTheta(activeRod) * attackDir. 0..1. */
  setWindup(fraction: number): void;
  apply(state: SimState, alpha: number, previous: SimState | null): void;
  /** Writes the 26 contact-decal matrices into the mesh scene.ts owns. */
  writeContactDecals(target: InstancedMesh): void;
  dispose(): void;
}
export function buildRods(
  table: CompiledTable, visuals: TableVisuals, quality: MaterialQuality,
): RodVisuals;

/* ---- ball.ts (P7) ---- */
export interface BallIndicatorSettings { trail: boolean; groundMarker: boolean }
export interface BallVisuals {
  root: Group;
  objects: Mesh[];
  apply(state: SimState, alpha: number, previous: SimState | null, dt: number): void;
  setIndicators(settings: BallIndicatorSettings): void;
  positionOf(slot: number, out: Vector3): Vector3 | null;
  dispose(): void;
}
export function buildBalls(ball: CompiledBall, quality: MaterialQuality): BallVisuals;

/* ---- input (P9) ---- */
export type ControlPreset = 'direct' | 'classicWheel';
export type PointerMode = 'lock' | 'drag' | 'off';
export type SlideMapping = 'normalized' | 'uniform';
export interface RodProbe {
  slide(rod: number): number;
  theta(rod: number): number;
  kickCooldown(rod: number): number;
}
export interface InputContext {
  tickDt: number;
  maxSlideSpeed(rod: number): number;
  maxAngularSpeed(rod: number): number;
  slideLimit(rod: number): number;
  slideAccel: number;
  angularAccel: number;
  maxWindupAngle: number;
  attackDir(rod: number): number;
  kickCooldownSec: number;
}
// InputManager additions:
//   setProbe(probe: RodProbe): void
//   setAxisOrientation(o: { slideSign: number }): void
//   requestLock(): Promise<void>
//   releaseLock(): void
//   get pointerLocked(): boolean
export const CONTROL_PRESETS: Record<ControlPreset, Partial<InputSettings>>;
export function applyPreset(base: InputSettings, p: ControlPreset): InputSettings;
```

### WIRING NEEDED IN `game-view.ts` (LEAD ONLY)

1. Build order: `createScene` → `buildVenue({ renderer: scene.renderer, quality: scene.quality, … })` → `scene.attachVenue(venue)` → `buildTable(table, scene.quality)` → `buildRods(table, visuals, scene.quality)` → `buildBalls(ball, scene.quality)` → `buildVfx(...)`. The venue must be attached **before** any material factory runs, so `setEnvironment` has published before the first `MeshPhysicalMaterial` is created.
2. Per frame, in order: `rig.update(dt, ballPos)` → `rods.apply(...)` → `balls.apply(...)` → `rods.writeContactDecals(scene.contactDecals)` → `rods.setWindup(windupFraction)` → `venue.update(t)` → `bloomBoost = vfx.update(dt, t)` → `scene.setFilmicTime(t)` → `scene.render()`.
3. `handleEvents` fans out to **both** `rig` and `vfx`: `EV_GOAL → rig.addShake(0.85) + rig.addZoom(0.9) + vfx.onGoal(team, goalX)`; `EV_KICK → vfx.onKick(...)`; `EV_FIGURE_HIT → vfx.onFigureHit(...)`; `EV_WALL_HIT → vfx.onWallHit(...)`. The `vfx` calls must **not** be gated on `cameraShake` or `reducedEffects` — those gate the camera and the grain, not the celebration.
4. `applyGraphics` must additionally call `venue.setDetail(g.venueDetail)`, `venue.setVolumetrics(g.volumetrics)`, `vfx.setQuality(scene.quality, reduced)` and `scene.setReducedEffects(reduced)`.
5. `resize` must call `rig.setAspect(width / height)` so `fitFrame` re-solves.
6. `rodAtScreenX` is wrong in any sideline view (it maps normalised screen X onto table Z). Replace with: project each rod hub to NDC and take the nearest in screen space — view-agnostic, no raycast.
7. `for (let slot = 0; slot < 8; slot++)` must import `MAX_BALLS`.
8. `frameMs` must measure the full CPU update block plus submission, not just `scene.render()`.
9. `dispose()` order: `vfx` → `balls` → `rods` → `table` → `venue` → `scene` → `materials.disposeMaterialLibrary()` **last**.

---

## 5. NON-NEGOTIABLES AND PERFORMANCE BUDGET

**Non-negotiables.**
1. Physics dimensions are authoritative. Nothing in this spec changes a metre. Every gameplay dimension is read from `CompiledTable` / `CompiledBall` at build time.
2. Drawn geometry matches the collider. Goal mouth, foot radius, torso band, figure Z half-width and rod X all assert against `CompiledTable` and **throw in dev**, not comment.
3. `packages/core` is not touched. The 100 existing tests pass.
4. Procedural only. `three` + `react`. No downloaded assets, no CDN, no binary textures. Google Fonts CSS links are the sole exception, for UI typography.
5. Zero allocation in any per-frame path. Scratch objects hoisted. Dev harness asserts allocation count 0 over a 600-frame capture.
6. Accessibility is authoritative over the quality preset: `cameraShake`, `motionBlur`, `reducedEffects`, `showBallTrail`, `showBallMarker`, `colorMode`, `uiScale` and `prefers-reduced-motion` all route through `effectiveGraphics()` / `effectiveCamera()` and always win.
7. Ball readability is a hard gate. The ball is the brightest object in every frame, is the only object that blooms, is never blurred, and always carries two independent height cues (contact shadow + marker) so disabling one never removes the only read.
8. Both goals stay in frame in every playable view at every aspect ratio and every FOV setting.
9. `|dot(cameraRight, +Z)| ≥ 0.35` in every playable view.

**Frame budget, 1080p, mid-range GPU (Iris Xe / MX550 class), including simulation.** Baseline today: 8.5 ms at 1600×900.

| | low | medium | high | ultra |
|---|---|---|---|---|
| Render scale | 0.75 | 1.0 | 1.0 | **1.0** |
| Pixel ratio | `clamp(dpr*0.75, .5, 2)` | `clamp(dpr, .5, 2)` | `clamp(dpr, .5, 2)` | `clamp(dpr, .5, 2)` |
| Material tier | low | medium | high | ultra |
| Texture ceiling | 512 | 1024 | 2048 | 2048 |
| Real-time lights | 2 | 4 | 7 | 7 |
| Shadow map | off | 1024 | 2048 | 2048 |
| Rod shadows | — | — | yes | yes |
| Venue detail | 0 (floor + boards) | 1 (+ crowd + banners) | 2 (+ truss + lamps) | 2 |
| Volumetrics | — | — | yes | yes |
| GTAO | — | — | half-res, 8 spp | full-res, 16 spp |
| Bloom | — | — | yes | yes |
| FilmicPass | — | yes | yes | yes |
| SMAA | — | yes | yes | yes |
| Motion blur | — | — | — | yes (if toggled) |
| Draw calls | ≤ 26 | ≤ 44 | ≤ 70 | ≤ 78 |
| Triangles | ≤ 90 k | ≤ 140 k | ≤ 190 k | ≤ 190 k |
| **Scene + sim** | 3.2 ms | 4.6 ms | 5.4 ms | 5.6 ms |
| **GTAO** | — | — | 0.7 ms | 1.7 ms |
| **Bloom** | — | — | 0.9 ms | 0.9 ms |
| **Filmic** | — | 0.25 ms | 0.25 ms | 0.25 ms |
| **SMAA** | — | 0.55 ms | 0.55 ms | 0.55 ms |
| **Afterimage** | — | — | — | 0.30 ms |
| **TOTAL TARGET** | **3.2 ms** | **5.4 ms** | **7.8 ms** | **9.3 ms** |
| **Hard ceiling** | 6.0 ms | 9.0 ms | 12.0 ms | 14.5 ms |

**What each preset turns off.**
- **low:** the entire composer (OutputPass only — no bloom, no SMAA, no grade, no GTAO), all shadows, the crowd, the truss, volumetrics, the goal/ball lights, every normal and ORM map, `MeshPhysicalMaterial` in all forms, and the live menu backdrop. It **keeps** the floor, the sponsor boards, baked AO, contact-shadow decals, the ball marker and the ball trail.
- **medium:** GTAO, bloom, volumetrics, rod shadows, clearcoat and anisotropy, the truss.
- **high:** full-res GTAO and motion blur only.
- **ultra:** nothing.
- **`reducedEffects` (orthogonal to all four):** grain 0, chromatic aberration 0, halation 0, edge blur 0, vignette 0.25, split-tone 0, volumetrics off, particles off, live menu backdrop off, motion blur off. It does **not** remove goal lights, the net ripple, bloom, AO or the score reaction — a player who needs reduced effects still gets acknowledgement.

**Cut from the proposals, deliberately.**
- **Planar `Reflector` on the playfield.** A whole extra scene render, and the layer discipline it depends on is one careless `add()` away from doubling frame cost. Clearcoat plus a correct PMREM buys ~70% of it for zero passes.
- **`BokehPass` / true DOF.** No edge-aware guard, so it can smear the ball. The DOF read comes from `FilmicPass`'s radial edge blur confined to `r > 0.55`.
- **AgX tone mapping.** ACES stays. Swapping would invalidate every already-verified team, HUD and colourblind palette for a marginal gain, and re-verifying five palettes is not a cost this change has earned.
- **Near-black turf (`#0d1a14`).** The direction is photoreal tournament, not esports arena. The laminate is `#2b5942`.
- **`RectAreaLight` key.** Cannot cast shadows; the resulting light/shadow direction mismatch is visible.
- **Ultra `renderScale 1.25`.** It multiplies DPR. Fixed at 1.0.

---

## 6. THE NEW CONTROL SCHEME

**Decided default: `direct` — the pointer-locked hand servo.** One sentence: *the mouse is your hand, and your hand is bolted to the rod through a stiff spring.*

The enabling facts: rod travel is tiny and differs 2.6× between rods (GK 204 mm full, DEF 392 mm, MID 152 mm, ATK 162 mm), the velocity clamp almost never binds for a human hand, and **the sim already sources kick power from `theta`** (`windup = clamp(-attackDir*theta / 1.95, 0, 1)`, `scale = 0.62 + 0.38*windup`). Today the player has no way to *feel* where `theta` is, because right-drag is a relative velocity input and windup is an integral of history you must read off the 3D model mid-rally. That is the single biggest thing making the controls feel amateur.

**Mapping.** Mouse X → slide, absolute. Mouse Y → rotation, absolute over the windup arc; pull back to load, push past neutral for continuous forward spin. **Both axes live simultaneously** — the point of the whole scheme, and impossible today because right-drag owns the pointer while held. Left click = kick, unchanged, on the down edge. Right click = power-up. Digit row 1–4 = select by role (**primary**; numpad demoted — `bindings.ts`'s own comment already argues laptops have no numpad, and `labels.ts` already renders `1`–`4`). Q/E cycle, Shift precision, C camera, Tab scoreboard, F power-up. Wheel survives as a fine nudge: one notch = 6% of the current rod's travel. First Esc releases the pointer, second Esc leaves.

**The servo, per tick.** (1) Unwrap `theta` into the player frame — mandatory, or the first full spin slams the rod backwards. (2) Advance the hand from every device. (3) Clamp the hand to travel limits **and** to a spring slack against the real rod: `slackZ = vMaxZ * slideTau`, `slackW = vMaxW * rotateTau ≈ 0.75 rad`, with a hard back stop at `maxWindupAngle` and a **soft forward clutch** (`handLocal ≤ rodLocal + slackW`, no upper bound) that gives continuous spin with no mode and no timer. (4) Demand a velocity with feedforward plus a braking limit: `want = handVel + err/tau`, then `brake = sign(err)*sqrt(2*accel*|err|)`, clamped to `±vMax`, quantized, with `MIN_HOLD_AXIS = 2/127`.

Feedforward removes 10 mm of steady-state lag (13% of MID's half-track). The brake matters more than it looks: `vMax²/(2*slideAccel) = 69 mm`, nearly MID's entire half-track of overshoot without it. Worst-case lag is `tau = 20 ms`, bounded by construction.

**Rod switching re-anchors the hand** (`handZ = probe.slide(rod)`, `handLocal = probe.theta(rod) * attackDir`, velocities zeroed), so a switch can never move a rod. And gain normalises per rod — `metresPerUnit = 2*rodSlideLimit[rod] / slideSweep` — so a fixed wrist sweep spans every rod's full track and DEF and MID feel identical instead of 2.6× apart.

**Kick buffer.** `kickCooldownSec = 0.11` silently eats presses during a scramble. Latch the press and re-emit on the first tick where `rodKickCooldown(rod) <= tickDt`, within `kickBufferSec = 0.12`. The `<= tickDt` test guarantees it never delays a kick the cooldown would have accepted; `kickBufferSec = 0` restores today's behaviour exactly.

**No acceleration curve on either axis, ever.** Non-linear gain destroys the hand↔rod correspondence the scheme is built on. `unadjustedMovement: true` defeats OS acceleration for the same reason.

**Keyboard** drives the same hand instead of bypassing it with `±1`: `keySlideSweepSec = 0.42` (a 60 ms tap with Shift moves MID ~10 mm, versus 40 mm today) and `keyRotateSweepSec = 0.30`, which means **you can now tap S and hold a half windup** — the single biggest keyboard win. Stop emitting `BTN_SPIN_FWD/BACK` from the keyboard path; the graded axis is strictly more expressive.

**Gamepad** maps to the hand better than a mouse does, because a stick is already absolute: left stick X = slide, right stick Y = windup/swing over `[−1.95, +1.25]`, A/RT kick, X power-up, **analog** LT precision, LB/RB cycle, D-pad direct select. Two fixes: a **radial** deadzone (0.12) not per-axis, and arbitration **at the hand** with last-device-wins on a 250 ms lockout — `if (slideAxis === 0) slideAxis = pad.slide` is wrong with two absolute devices.

**The one alternate preset: `classicWheel`.** Exactly today's scheme, preserved bit-for-bit — wheel → distance budget, right-drag → rotate, no pointer lock, `MAX_BUDGET_TICKS = 3.5`, all four existing sliders — locked by a regression test that asserts tick-for-tick output equality. Anyone with muscle memory, or who cannot tolerate pointer lock, loses nothing. Presets are **seeds, not overlays**: picking one writes its fields into `settings.input` once, so later tweaks are never stomped.

**Exact settings keys.** `settings.input`, `VERSION` 1 → 2, stored v1 blobs seeded to `classicWheel`.

| Key | Type | Default |
|---|---|---|
| `preset` | `'direct' \| 'classicWheel'` | `'direct'` |
| `pointerMode` | `'lock' \| 'drag' \| 'off'` | `'lock'` |
| `rawPointer` | `boolean` | `true` |
| `slideSweep` | `number` (pointer units per full track) | `1100` |
| `rotateSweep` | `number` (pointer units per full arc) | `900` |
| `slideMapping` | `'normalized' \| 'uniform'` | `'normalized'` |
| `uniformSlideMetresPerUnit` | `number` | `1.8e-4` |
| `invertPointerX` | `boolean` | `false` |
| `invertPointerY` | `boolean` | `false` |
| `slideTau` | `number` (s) | `0.020` |
| `rotateTau` | `number` (s) | `0.028` |
| `forwardArc` | `number` (rad) | `1.25` |
| `keySlideSweepSec` | `number` | `0.42` |
| `keyRotateSweepSec` | `number` | `0.30` |
| `wheelNudge` | `number` (fraction of travel per notch) | `0.06` |
| `kickBufferSec` | `number` | `0.12` |
| `mirrorWithCamera` | `boolean` | `true` |
| `gamepadCurve` | `number` | `1.6` |
| `gamepadStickMode` | `'absolute' \| 'rate'` | `'absolute'` |
| `gamepadDeadzone` | `number` | `0.12` (was 0.16) |
| `dragIsToggle` | `boolean` | `false` |
| `precisionIsToggle` | `boolean` | `false` |

Every existing field is kept verbatim — `scrollSensitivity`, `invertScroll`, `dragRotateSensitivity`, `invertDragRotate`, `dragRotateButton`, `precisionScale`, `gamepadEnabled` — because `classicWheel` needs them unchanged. New `ActionId`s: `grabRods` (`KeyG`), `recenterHand` (`KeyZ`), both with full remapping through the existing `findConflict` path. `settings.gameplay` gains `showWindupMeter: true`, `showHandGhost: true`, `tutorialSeen: false`, `matchesPlayed: 0`.

**Honesty note, and do not "fix" it.** At the instant of a fast pull-and-click the hand can be up to `slackW ≈ 0.75 rad` further back than the rod, and the sim reads power from the rod. Show the truth instead: the HUD's wind-up arc is driven by `renderState.rodTheta(activeRod)`. The discrepancy lasts ~28 ms and teaches the mechanic in about four shots.
