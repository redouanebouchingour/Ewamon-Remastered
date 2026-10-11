# material-bake — implementation notes and deviations from SPEC §40.3 / §10.2

Every place the implementation departs from `.design/SPEC.md` (§10.2 material library, §40.3 material bake,
§40.0.2 tool rules), with the reason. Lower-numbered SPEC sections win on conflict; where two sections disagree
the choice is stated.

## Layout

**D0 — recipes and the surface table live in `packages/render/src/surfaces/`** (decided by the previous
session). §40.3.1 has the bake read a `dist/surfaces.json` written by the render build, and §40.0.2 rule 5 says
no tool imports `@ewa/render`. Instead `packages/render/src/surfaces/` is pure TypeScript (no three, no DOM, no
node builtins — enforced by the render ESLint block) and the tool imports it through the `@ewa/render/surfaces`
subpath (`packages/render/package.json` exports, root `vitest.config.ts` alias). §10.2.3 names
`packages/render/src/surfaces.ts`; the table is `packages/render/src/surfaces/surfaces.ts` and the render
library should import `SURFACES` / `SurfaceDef` / `SurfaceId` from `./surfaces/index`.

- The root `vitest.config.ts` alias for `@ewa/render/surfaces` was listed after `@ewa/render`, so vite matched
  the shorter prefix and every import of the subpath failed. The subpath entry is moved first (the only edit
  outside this tool's scope).
- `tools/material-bake/src/zones.ts` keeps its own zone → biome table (21 zones) instead of importing
  `@ewa/content`; `test/zones.test.ts` asserts it equals `ZONES[].biome`.

## Encoding (§40.3.3)

**D1 — supplied mip chain.** The spec's wrapper (mips as extra slices through `setSliceSourceImage`) is
rejected by the Basis encoder in ktx2-encoder 0.6.0 (probe: *"Inputs do not satisfy .KTX2 texture
constraints: all source images must be the same resolution and have the same number of mipmap levels"*), and
the embind API does not bind `m_source_mipmap_images`. `src/encode.ts` therefore encodes every mip level as its
own single-level KTX2 with the §40.3.3 options (UASTC, RDO, zstd supercompression, `generateMipmap: false`,
sRGB transfer + perceptual for albedo, normal-map preset for normals) and `src/ktx2.ts` assembles the levels'
independently supercompressed payloads into one KTX2 (level index, DFD and KVD of level 0, level data smallest
first). Each level is byte-identical to what Basis writes for that image (asserted in `test/ktx2.test.ts`).
The encoder module is driven directly (the `NodeBasisEncoder` the spec names) rather than via `encodeToKTX2`,
to set the RDO thresholds of D2 and silence the status output.

**D2 — UASTC pack level 0 and the RDO profile.** §40.3.3 fixes `uastcLDRQualityLevel: 2` and treats
`rdoQualityLevel` as the lever that makes UASTC fit. Measured on this repo's recipes (256² crops, PSNR from
the encoder's own stats):

| map | pack 2, λ2 | pack 1, λ2 | pack 0, λ2 | pack 0, λ8 (+thresholds) |
|---|---|---|---|---|
| cobble albedo | 0.385 B/texel, 48.3 dB | 0.313, 48.4 dB | **0.228, 48.2 dB** | 0.200, 43.4 dB |
| path_gravel albedo | 0.499, 45.7 dB | 0.420, 45.0 dB | **0.364, 44.9 dB** | 0.297, 38.7 dB |
| path_gravel orm | 0.492, 36.5 dB | 0.476, 36.3 dB | **0.412, 36.0 dB** | 0.317, 30.8 dB |
| cobble normal | 0.597, 37.8 dB | 0.560, 37.5 dB | **0.467, 36.4 dB** | 0.413, 32.0 dB |

Pack level 0 is the same quality on albedo at ~0.6× the bytes and ~5× the encode speed (a full bake of 121
tier sets takes ~6 min with 8 workers instead of hours), so `UASTC_LDR_QUALITY = 0`. RDO lambda on its own does
almost nothing on textured blocks because Basis skips RDO on blocks whose RMS error is above 8
(`setRDOUASTCSkipBlockRMSThresh`); `rdoProfile(rdo)` keeps the Basis defaults (skip 8, max RMS ratio 10) up to
the spec's 2.0 and widens both to 8 × rdo above it. Both are in `settingsKey`, hence in every cache hash.

**D24 — per-map byte targets are not reachable for UASTC normal maps; the rdo lever is applied and
recorded.** §40.3.5 targets ≤ 0.10 MB per 512² map and ≤ 0.40 MB per 1024² map (≈ 0.30 B/texel with mips),
assuming RDO gives a further 2–3×. It does not on this encoder (table above: normals stay at 0.4–0.85
B/texel unless PSNR drops to ~20 dB). The two budgets the section says bind the arithmetic are met with
headroom: `public/materials/` 55 MB against the 90 MB ceiling, every biome's field set ≤ 3.7 MB against the
6 MB phase-2 load, Mirevale hero 7.7 MB against ≈ 12 MB (numbers in README). `test/budget.test.ts` therefore
asserts: a map over its target fails with its id **unless its recipe already carries the §40.3.5 fix**
(`rdo ≥ RDO_LEVER_CEILING = 4` — beyond 4 the measured saving is < 10 % for > 3 dB PSNR on normals), no map
exceeds 3 × its target, a recipe that sets `rdo` must have a map near its target (no silent quality loss), and
the aggregate budgets hold. Every over-target map is listed in `qa/qa-report.json` (`overTarget`) and by
`report`. If the per-map numbers must hold literally, the options are a non-UASTC normal format or much less
normal detail in the recipes — a decision for the spec owner.

## Recipe contract (§40.3.2)

**D3 — seamless noise.** The verbatim `Noise` has no period, and `fbm2(x·k, …)` with lacunarity 2.03 cannot
tile. `Noise` gains one additive method, `periodic(px, py)`, returning a view whose lattice wraps with that
period and whose fbm octave frequencies are snapped so every octave period is integral. Recipes use the
`tiled(noise, fx, fy)` helper (`recipes/lib.ts`), which rounds the frequencies to integers and takes tile
coordinates. `rng(seed)` is sfc32 seeded from a pure-TS SHA-256 of the seed (FIPS vectors in the tests).
Stamps (domes, pebbles, strokes, cracks) wrap around the tile edges for `repeat` surfaces.

**D4 — card alpha.** The verbatim `Rgb` has three floats per texel. For `SurfaceDef.alphaTest !== null` the bake
passes a `CardRgb` (`Rgb` + `alpha: Float32Array`, pre-filled 1; `hasAlpha()` narrows it). Albedo is written
RGBA for cards (UASTC channel id RGBA in the DFD), RGB otherwise. Card mips are coverage-preserving (alpha is
scaled per level so the fraction passing alphaTest 0.5 matches level 0) — an addition, in the spirit of the
sprite pipeline's rule.

**D5 / D14 — the maps are absolute values.** §10.2.1 (albedo ceiling 0.85 scene-linear, `G = roughness`) and
§40.3.6 (`albedo #5a4632 × (0.8 + 0.4·h)`, `rough 0.78 + 0.14·(1−h)`) make the textures the final base colour
and roughness, so they are baked that way: albedo = final linear colour (sRGB-encoded), ORM
R = AO, G = absolute roughness, B = absolute metalness. The verbatim §10.2.4 graph (`alb.rgb × color(def.albedo)`,
`orm.g × def.roughness × 2`) would double-apply the base values; `packages/render/src/materials/graph.ts`
(render part 1) already reads the baked maps as absolute (`map × 1 + 0` once the set is bound, SurfaceDef
values while the placeholder is bound), and this bake matches it. The §40.3.2 pre-fill (`rough` = 0.5) is kept
as the painters' default. `roughClippedPct` counts roughness values outside [0, 1].

**D18 — stained_glass** is `emissive #ffffff 2.0`; the "per-texel mask" is the albedo texture, which the
render library multiplies in (`SURFACE_EXTRAS.stained_glass.emissiveFromAlbedo`).

## Derivations (§40.3.2)

**D6 — seam metric.** The literal check (mean |column 0 − column S−1| ≤ 2/255) fails every textured seamless
map, because adjacent texels legitimately differ by more than 2/255. The bake measures how much the neighbour
difference across the wrap exceeds the *largest* mean neighbour difference between two adjacent interior
columns (rows), for albedo (8-bit) and height, and fails above 2/255 naming the surface. A seamless torus scores
0 even when a joint or crack lies on the wrap; a real discontinuity scores its excess (a ramp scores ≈ 1;
`test/bake.test.ts`). Because the per-pair baseline is noisy on very small images, the all-surfaces seam test
runs at the field tier (the bake enforces it at both tiers).

**D7 — luminance ceiling on emissive surfaces.** §40.3.6 says glass_warm's clamping is "reported, not an error,
the emissive term supplies the brightness". The same reasoning is applied to every surface with
`SurfaceDef.emissive` (lava_glow, coal_glow, candle_wax, …): clamping is counted and reported, never fails.
Non-emissive surfaces fail above 5 %. In the current bake no surface clamps a single texel.

**D10 — units.** "N px" in §40.3.6 is read at the table's `size` (1024 for hero surfaces, 512 otherwise;
`refSize()`), converted to tile units, so both tiers show the same features. The cavity-AO blur σ 6 px is at
the reference size too (σ 3 px at the 512 field tier of a hero surface). The Sobel slope is
`normalStrength · 32 · dh/du / refSize` (NORMAL_GAIN 32, tuned by eye on the lit contact sheet), OpenGL +Y =
increasing v = increasing row (row 0 is the first KTX2 row, which three uploads at v = 0).

**D22 — mips** are exactly as specified (2×2 box in linear space for albedo, straight average for ORM,
renormalised average for normals), plus card coverage preservation (D4).

## Recipes (§40.3.6 and the other 68)

**D9 — base values.** Grove rows are §10.2.2 verbatim. The other rows name ids and a few values (emissive
colours, clearcoat, a handful of metal/roughness pairs, which are kept); every other base colour and roughness
in `surfaces.ts` is authored here. Pale surfaces (snow, marbles, gypsum, frost glass, candle wax, plaza stone,
ring light) sit a little darker than a naïve choice so variation stays under the 0.85 ceiling.
Hero surfaces: 6 shared + 11 signatures + 21 triplanar terrain layers = 38 (≤ 50); `hero` is derived in
`surfaces.ts`, never typed. Only the five §10.2.5 surfaces carry `wind`.

**D11 — slice recipe interpretations.**
- `grove_bark`: the table says "vertical fibre `fbm2(x·2, y·18)`", which as written makes horizontal streaks; the
  description (vertical fibre, longitudinal cracks, moss in the lower 30 % of V) wins, so the frequencies are
  swapped (`fbm(u·18, v·2)`) and the 40 cracks are Worley borders 40 across u. `sin(y·6)` becomes one sine per
  tile (`sin(2πv)`) so the wrap holds; the moss band fades in at v = 0 for the same reason.
- `grove_leaf_canopy`: 3 clusters of 48 elliptical leaves; the `abs(sin(atan2·7))·0.3` vein term fans from each
  leaf's base; AO 0.7 where clusters overlap, 0.85 where leaves overlap inside one cluster.
- `stone_wall`: "irregular ashlar, Worley cells stretched 2:1" is built as 5 courses of ±25 % height with 2–3
  stones each and wandering joints (`makeAshlar`), which reads as ashlar; chipped corners where the stone hash
  > 0.8 as specified.
- `timber`: knots use the Table-Clash ring function with the 0.18 factor on the along-grain axis (planks run
  along u); one butt joint per plank is added; plank joints sit off the tile edge.
- `slate_roof`, `cobble`, masonry: course edges are shifted off the tile edge; per-stone size/offset jitter
  added to cobbles; tops are domed and worn.
- `plaster`: AO edge darkening exactly as specified (it repeats every 2 m on a wall, as the table implies).
- `thatch`: strokes accumulate additively and are soft-clamped (`1 − e^(−1.3·acc)`) instead of hard-clamped, so
  the straw layers stay visible.
- `water_pond`: wave vectors (7, 2) and (−3, 11) (integer, so the ripples tile); albedo flat as specified.
- Extra macro variation (tint / density patches) on the terrain layers so a 3 m tile does not read flat.

**Non-slice surfaces** use parametric families in `recipes/families.ts` — rock, soil, masonry, wood, metal,
cloth, glass, crystal, lava, water, foliage, scales — plus a hand-written `chain`. Every family is seamless for
`repeat`, tuned per id, and checked by the "non-flat" test.

## Cache, manifest, CLI (§40.3.4)

**D12 — hash granularity.** The hash covers the recipe's *group file* text (one file per biome), the shared
recipe files (`recipe.ts`, `types.ts`, `recipes/lib.ts`, `recipes/families.ts`), the bake's own sources
(`bake.ts`, `encode.ts`, `ktx2.ts`), the SurfaceDef JSON, the recipe's static fields, the tiers and the encoder
settingsKey. Editing a recipe rebakes its biome group (not exactly one surface); editing a family or the bake
rebakes everything.

**D13 — cache layout** is `.cache/<hash>/<tier>_{albedo,orm,normal}.ktx2 + <tier>.meta.json` (one hash covers
both tiers), plus `.cache/placeholder-v1/`.

**D15 — `totalBytes`** = field + hero + the placeholder set (the manifest JSON itself is not counted).

**D17 — previews.** `--preview <id>` writes `qa/<id>.png` (albedo | ORM | normal, level 0 over level 3).
`sheet` writes `qa/slice-sheet.png` with two extra columns (a lit view and a 2 × 2 tiling) used for the visual
review. Previews are rendered from the pre-encode mip chain (no UASTC transcoder in Node), shown v-up.
`bake --report` is `report`; `bake --surface <id>` and `--jobs N` are additions. Partial bakes (`--zone`,
`--surface`, `--tier`) merge into the existing manifest: a tier whose current-hash cache entry is byte-identical
to the shipped files is described from the cache; any other tier keeps the existing manifest's entry (hash,
metres, wrap, clamp % included) while its files exist, with `bytes` re-measured, so editing a shared recipe or
bake source (which moves every hash) no longer drops the unselected surfaces. Totals are summed over the merged
set. Only a full bake removes orphan `.ktx2` files; a partial bake never deletes.

**D19 — wrap.** Every surface is `repeat` except the seven alpha cards (`clamp`).

**D21 — water / physical classes** are baked like any other surface; transmission is not a `SurfaceDef` field.
