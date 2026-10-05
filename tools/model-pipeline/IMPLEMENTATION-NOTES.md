# model-pipeline — implementation notes and deviations from SPEC §40.2 / §40.0

Every place the implementation departs from `.design/SPEC.md` §40.2 (and the §40.0.2 tool rules), with the
measurement behind it. Library APIs were read from `node_modules` (gltf-transform 4.5.0, meshoptimizer 0.24.0,
ktx2-encoder 0.6.0 with its Basis Universal 2.5 WASM, sharp 0.35.4).

> **2026-10-05:** the Quaternius looks are replaced by the KayKit "Adventurers 2.0" character set (section K at the
> end). M0, M5 and the look half of M8 describe the removed Quaternius path and are kept as history; the legendary
> notes are current and the legendary outputs are byte-identical across the change.

## Inputs

**M0 — 19 looks, not 20 (historical: Quaternius).** §40.2.1 / §40.2.5 say 20 Quaternius characters; `assets-src/models/quaternius` holds 19
and `@ewa/content` `LOOKS` lists the same 19. The pipeline validates the directory against `LOOKS` (a missing or
unknown look fails with its id). Budgets are unaffected (19 × ≤ 0.25 MB).

## Textures and the LOD0 budget

**M1 — texture resolution ladder.** §40.2.6 budgets one legendary LOD0 at ≤ 1.2 MB with "3 textures at
1024²–2048² UASTC+RDO+zstd with mips ≈ 0.4–0.6 MB" and geometry ≈ 0.45 MB. Measured on these sources:

| lumyth / zenryu maps (base + normal + ORM) | bytes |
|---|---|
| 1024², pack 0, λ 2 | 1.91 MB / — |
| 1024², pack 2, λ 2 | 2.31 MB / — |
| 1024², pack 0, λ 4 (widened RDO thresholds) | — / 2.20 MB |
| 1024², pack 0, λ 8 (widened RDO thresholds) | — / 2.02 MB |
| 768², pack 0, λ 2 | — / 1.49 MB |
| 512², pack 0, λ 2 | 0.57 MB / 0.75 MB |

and the geometry after the §40.2.2 sequence is 0.53–0.64 MB (30 k tris, 29–35 k vertices; NORMAL at 10 bits is the
largest stream, ~0.2 MB after meshopt). 1024² UASTC cannot fit at any RDO setting, so each legendary takes the first
tier of `TEXTURE_TIERS` (`src/textures.ts`) whose GLB + textures ≤ 1 258 291 B:

| tier | base | normal | ORM |
|---|---|---|---|
| 0 | 512 | 512 | 512 |
| 1 | 512 | 512 | 256 |
| 2 | 512 | 512 | 128 |
| 3 | 512 | 256 | 128 |
| 4 | 256 | 256 | 128 |

Result: lumyth and voidraxis tier 0, noxmyth tier 1, zenryu tier 2 (tier 1 missed by 167 B). The ladder gives up
roughness/metal first (low-frequency; the least visible loss), normal detail next, base colour last. The choice
depends only on the input bytes (deterministic) and is recorded in `qa/qa-report.json` (`textureTier`, flag
`texture-tier`). If no tier fits the build fails with the tried sizes. A budget or quality decision above this
(e.g. 1024² base colour with a 1.8 MB LOD0 line, or ETC1S for base/ORM) belongs to the SPEC owner.

**M2 — no `textureCompress({ targetFormat: 'ktx2' })`.** gltf-transform 4.5's `textureCompress` supports
`jpeg | png | webp | avif` only (`TEXTURE_COMPRESS_SUPPORTED_FORMATS`). The texture plan is therefore its own step
(`encodeTexture` + `applyTextures`): sharp decodes and fits the image (Lanczos3), `ktx2.ts` encodes it, the texture
gets `image/ktx2`, `KHR_texture_basisu` (required) and an external uri. The WebP fallback uses sharp `webp q90`
directly (what `textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90 })` does) under
`EXT_texture_webp`; it is selected when `probeKtx2(2048)` fails and prints a warning (§40.2.4).

**M7 — encoder driven directly; no zstd level.** `ktx2-encoder`'s `encodeToKTX2` wrapper sets exactly the Basis
calls §40.2.4 lists but leaves Basis' status printer on (hundreds of stdout lines per texture). `ktx2.ts` drives the
same `BasisEncoder` with the same options plus `setStatusOutput(false)`. The embind prototype (listed) has no
Zstandard-level setter, so §40.2.4's `zstd: 18` is Basis' default level. Re-compressing the UASTC levels at zstd 18
with Node's `zlib.zstdCompressSync` was measured at −1.0 % over all 12 maps — not worth a container rewrite.
UASTC pack level 0, as `tools/material-bake` D2 (pack 2 is larger and 4× slower on these maps). Basis generates
the mip chain (`generateMipmap: true` in the SPEC), so every KTX2 has log2(size)+1 levels.

**M6 — texture roles come from the material slots.** §40.2.3's heuristic — "the second texture is normal if its
mean colour is within 16/255 of (128,128,255), else ORM; the third is emissive" — mis-reads these files: their
normal maps average (127, 127, 234) (B is 21/255 below 255 on every source, as any tangent-space map with tilt is)
and the third texture is the metallic-roughness map (mean (254, 28, 1)); there is no emissive map. The sources bind
`baseColorTexture`, `normalTexture` and `metallicRoughnessTexture` explicitly, so the binding is used; the mean
colour is a cross-check (`normalLike`: R, G within 16 of 128 and B ≥ 160) that flags `normal-suspect` in the QA
report. No legendary is flagged.

**M9 — textures external for LOD0 as well.** §40.2.6 says LOD1 "reuses the KTX2 by url … so textures are not
written twice". For that to hold the KTX2 files must exist as files, so LOD0 references the same external files
(`NodeIO.writeBinary` embeds every image, so `glb.ts` writes through `writeJSON({ format: GLTF })` and packs the
GLB itself; with no textures the result is byte-identical to `writeBinary`, asserted). The file names carry the
content hash (`<id>.<role>.<hash8>.ktx2`) so a changed texture is a new url (the GLB's `?v=` cache-buster covers
its own bytes only). `ModelEntry.bytes` for a legendary = LOD0 GLB + its three textures (the §40.2.6 1.2 MB line
counts the textures); LOD1's GLB size is asserted separately.

## Sequence

**M3 — `meshopt()` without its second reorder + quantize.** gltf-transform's `meshopt()` is "a thin wrapper around
reorder, quantize and EXTMeshoptCompression": after the SPEC's explicit `quantize(14/10/12/…)` it would run
`reorder()` and `quantize()` again with its defaults — re-quantizing the 14-bit positions (an `Int16` component is
wider than 14 bits, so gltf-transform does not skip it) and cloning the skin's inverse-bind matrices again.
`meshoptCompression()` (`src/transform.ts`) is exactly the tail of `meshopt({ level: 'medium' })`: the required
`EXT_meshopt_compression` extension with the `QUANTIZE` encoder method. The SPEC's order and bits are otherwise
unchanged; `reorder` gets `target: 'size'` as `meshopt()` would pass.

**M4 — LOD1 simplification.** gltf-transform 4.5's `simplify()` calls the position-only `simplifier.simplify`;
§40.2.3 wants `simplifyWithAttributes` with the skin weights locked in. `simplifySkinned` feeds NORMAL (weight
0.5), TEXCOORD_0 (1.0) and WEIGHTS_0 (1.0) to `MeshoptSimplifier.simplifyWithAttributes`, then compacts the
primitive; surviving vertices keep their JOINTS/WEIGHTS, so the skin stays bound. The error bound is **0.01**, not
0.001: measured, 0.001 (2 mm on a 2 m creature) stops the simplifier at 24 000–28 900 of 30 000 triangles
(position-only and attribute-weighted alike) and the LOD1 GLBs come out at 505–619 KB against the 0.45 MB line.
At 0.01 all four reach the ratio (10 435–10 493 tris, the SPEC's "≈ 10 500") with an actual error of
0.0045–0.0081 of the extent (0.9–1.6 cm, about a pixel at the 40 m LOD1 distance); LOD1 GLBs are 220–248 KB. The
achieved error is in the QA report.

**M5 — the look merge is `joinPrimitives`, not `join()` (historical: Quaternius).** `join()` skips skinned nodes (`if (node.getSkin())
continue;`), and every Quaternius primitive is skinned, so `join({ keepNamed: false })` is a no-op there. After the
colours are baked into `COLOR_0` (VEC3 float, quantized to 8-bit by the sequence) and all primitives share the one
`character` material, `prepareLook` merges them with `joinPrimitives`. `join()` still runs in the sequence as the
SPEC orders it.

**M8 — dropped clips are detached; rest-pose tracks are dropped.**
- `Animation.dispose()` leaves the clip's samplers alive and pointing at their keyframe accessors, so `prune()`
  keeps them — measured: the 10 dropped Quaternius clips stayed in the file (1 136 accessors instead of 440, looks
  at 400–460 KB). `detachAnimation` disposes channels and samplers first; `prune()` then drops the keyframes as the
  SPEC intends.
- Even so one look was over 0.25 MB (doctor_female_young 268 804 B): 7 clips × 69 tracks, most of them constant,
  each costing a sampler, a channel and two accessors of JSON after `resample()`. `pruneRestTracks` drops every
  (node, path) track that holds the node's rest value (±1e-5, q ≡ −q) in **every** clip of the file. That is
  lossless in three.js — a bone without a track keeps its transform, which is the rest pose because no clip ever
  moves it, so cross-fades are unchanged. It removes 287 of 483 tracks per look (−52 KB each; looks now 150–217 KB,
  total 3.38 MB) and 21–23 of 36 per legendary.

**M10 — bounds.** `ModelEntry.bounds` is measured before quantization (afterwards a skinned mesh's positions live in
the quantization volume): linear-blend skinning of the node TRS as stored — the pose three.js shows before a clip
plays. For the Quaternius files that pose is not the T-pose (≈ 3.1 units tall); rounded to 1e-4.

## Rules of §40.0.2

- Determinism: asserted by `test/determinism.test.ts` (look path, legendary LOD0/LOD1 path, KTX2 encoder, full
  cache replay against the committed tree). `qa-report.json` holds no run-dependent field.
- Cache: `.cache/tex/<key>.{bin,json}` and `.cache/model/<key>/{lod0.glb,lod1.glb,meta.json}`, keys over source bytes,
  `PIPELINE_VERSION`, sequence/plan parameters and the text of every byte-shaping source file. A rerun reports
  `cacheHits === inputs` (23).
- `sharp` is `^0.35.4`, not the `^0.34.3` the other tools use: gltf-transform's functions load `ndarray-pixels`,
  which loads sharp 0.35; two libvips copies in one process crash (`VipsInterpretation … colourspace: parameter
  space not set`). Using the same sharp as ndarray-pixels avoids it.
- `@ewa/content` is the only workspace import (for `LOOKS`), as rule 5 allows.

## K — the KayKit character set (2026-10-05)

Sources: `assets-src/models/kaykit-adventurers` (the free 2.0 zip as downloaded; CC0, Kay Lousberg). Measured with the
scripts in `dev/` (`peek.ts` structure, `swatches.ts` per-part swatch usage, `rigcheck2.ts` rig equality, `anims2.ts`
clip foot speeds).

**K1 — one rig, six joint orders.** All six characters and both animation files carry `Rig_Medium`: the same 23 joint
names with identical rest TRS and inverse bind matrices (max difference 5e-12), but every file lists the joints in a
different order (`Knight.glb`: root hips spine chest upperarm.l …; `Mage.glb`: root hips upperleg.r …). A shape that
takes a head from another character therefore cannot be a `joinPrimitives` of two files' primitives. `kaykit.ts`
writes ONE canonical rig (Knight's order, `RIG_JOINTS`) and appends each part's vertices with `JOINTS_0` remapped by
joint name (`assertSameRig` checks the rest pose and IBMs per joint first). The result is what `joinPrimitives` gives
for one file: one primitive, one material `character`.

**K2 — heads move between bodies.** Every KayKit texture is the same 8 × 4 grid of 128 × 256 gradient swatches, and
every head part samples only the universal cells skin 0,0 / hair 1,0 / eyes 2,0 (the rogue's earring adds metal
3,0, grey in every texture). So a Knight head (clean-shaven, short hair) on a Ranger body samples the Ranger tile's
skin and hair: 15 shapes from 6 characters, for the 19 looks.

**K3 — prune keeps the UVs.** gltf-transform's `prune()` defaults to `keepAttributes: false` and drops vertex
attributes no material texture references. A shape ships its UVs without an image (the runtime's atlas samples them),
so its TEXCOORD_0 was removed (measured: shapes 70–110 KB with no UVs, the runtime drew one flat colour). Characters
run the sequence with `prune({ keepAttributes: true })` (`SequenceOptions.keepAttributes`); the legendaries keep the
plain `prune()` and their bytes are unchanged (the internal prunes of `join`, `reorder` and `quantize` already keep
attributes). Shapes are 90–146 KB with UVs.

**K4 — recolour per swatch cell, in OKLab.** Every face maps into the interior of one cell (closest vertex UV 4 % of a
cell width from its edge, `dev/swatches.ts`), so a palette is "slot → cells" (`SLOTS`, named from each cell's parts,
vertex centroid and colour). A cell moves to the target's OKLab hue and chroma and keeps each pixel's lightness offset
from the cell mean, so the KayKit shading gradient survives; chroma fades within 0.08 of white / black so white coats
and black hoods stay clean. Palette variants may not touch skin, hair or beard (asserted).

**K5 — the atlas: 256² tiles, level 0 only.** A 256² tile is 32 × 64 px per cell; the cells are 4-px block aligned
(no BC7 block straddles two swatches) and a vertex UV is at least 0.6 px from a cell edge, so linear filtering never
mixes neighbours. Mips would (a 4 × 4 level spans 32 swatches), and a gradient atlas needs none: one swatch interior
maps to a face, so minification cannot shimmer. 24 look tiles + the barbarian (mug) and mage (book) source tiles in
an 8 × 4 grid → 2048 × 1024 UASTC, RDO 1, zstd: **47.5 KB** (lossless PNG of the same atlas 116 KB; 2 MB of BC7 on the
GPU after transcoding). A KTX2 is kept over the tiny PNG so the character material is a KTX2 like every lit one
(`textures.ktx2Only`), and it is half the PNG's bytes.

**K6 — clips and gait speeds.** Kept: `Idle_A Walking_A Running_A Jump_Full_Short Hit_A Use_Item` → `idle walk run cheer
flinch use`; the rest (deaths, other hits, jumps, spawns, T-poses, the alternative walks / runs, `Interact`, `Throw`,
`PickUp`, `Idle_B`) are not copied. The clips are in place (no root motion; `rootMove 0`). `gaitSpeed` is the mean
backward speed of a toe while it is within 1.5 cm of its lowest point: walk **0.808**, run **3.367** model units / s
(at the one scale 0.6819: 0.55 and 2.30 m/s). Rest-pose tracks are dropped across the file (`pruneRestTracks`, 307 of
the kept tracks); the file is 83 KB.

**K7 — one scale.** `scale = 1.55 m / median(bare-head top of the 15 shapes)` = 1.55 / 2.273 = **0.6819**; headwear
(helmet, bear hat, straw hat, hood mask) is excluded from the median and included in each look's `heightM` (1.47–1.81 m).

**K8 — accessories.** Rigid meshes from `Assets/gltf` (their UVs address their own class texture: the mug the
barbarian's, the book the mage's, shields the knight's). An accessory samples its look's own tile when it shares the
body's texture (a soldier's shield follows the soldier's recolour) and its source texture's tile otherwise. KayKit
hand slots are built for blades (idle pose: +Y forward along the forearm, +Z sideways, +X down on the right, up on the
left), so a mug lay on its side: each accessory carries a slot `rotation` (a quarter turn about Z: +Y to world up, the
face still outward), measured in the sandbox. No weapon ships; townsfolk hold a mug or a book, soldiers a shield.
