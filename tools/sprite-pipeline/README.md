# @ewa/sprite-pipeline

Turns the 263 raw creature illustrations in `assets-src/creatures/` (398 MB, 256²–2048², PNG/WebP/GIF, 52 non-square, some on white or magenta backgrounds) into uniform, alpha-correct, lit-billboard-ready texture atlases in `packages/client/public/creatures/`. No sprite is redrawn. The binding contract is `.design/SPEC.md` §40.1; deviations are listed at the end of this file.

## Commands

```bash
pnpm --filter @ewa/sprite-pipeline run build     # every stage, writes public/creatures + qa/
pnpm --filter @ewa/sprite-pipeline run qa        # refresh qa/contact-sheet.png + qa/qa-report.json from the cache
pnpm exec tsx tools/sprite-pipeline/src/cli.ts frames --only lumyth   # page strips for frame-select.json
pnpm exec tsx tools/sprite-pipeline/src/cli.ts bench --count 4        # KTX2 vs WebP measurement
pnpm exec vitest run tools/sprite-pipeline                            # tests (budget + encoding read the real output)
```

Flags: `--only a,b` restricts to species, `--limit N`, `--force` ignores the sprite cache, `--jobs N` sets stage workers (output-neutral), `--no-anim` skips the flipbooks. A build exits with code 3 when `qa-report.json` has an actionable flag, and fails outright when a source is missing, a multiframe source has no `frame-select.json` entry, or the output would exceed the budget.

## The species set

Exactly the 130 species of `.design/legacy/ewamon.js` (keys that carry `frontSprite`). Files are matched by lower-casing and stripping `()_- ` and the extension. The four `yaschamp` alternate-style files are not species: they are listed under `excluded` in `qa-report.json` and not processed. `yaschamp(back).png` is the canonical back sprite (renamed from the boxing-style file, §40.1.1).

## Stages

| # | Stage | File | What it does |
|---|---|---|---|
| 1 | Alpha recovery | `alpha.ts` | Keeps real alpha (≥ 3 % translucent pixels, transparent border). Otherwise floods from the border against the border-mean colour (summed RGB tolerance 114), also keying connected magenta and near-white. Defringes translucent pixels from the nearest opaque colour within 8 px. Transparent pixels within 2 px of opaque take the nearest opaque RGB; all others become black, so filters never read white or magenta fringes. |
| 2 | Normalize | `normalize.ts` | Trims to the alpha bbox, scales the longest side to 881 px (0.86 × 1024), centres horizontally, puts the feet at y = 942 (manifest `footV` 0.08 from the bottom). Nearest-neighbour on integer factors, lanczos3 otherwise. |
| 3 | Normal map | `normalmap.ts` | Luminance height, Gaussian σ 1.2, Sobel strength 0.55, plus a 6 px outward alpha-edge bevel (strength 0.85) so silhouettes catch a rim light. OpenGL +Y. |
| 4 | Emissive mask | `emissive.ts` | Bright and vivid: HSV value ≥ 0.92 and chroma ≥ 0.4, capped at the most vivid 8 % of opaque texels, eroded 1 px, per-species overrides in `emissive-overrides.ts`. Two-valued. Pale fur never glows; flame creatures glow at accents only. |
| 5 | Plan + pack | `plan.ts`, `pack.ts`, `zones.ts` | Every species stored once. A global sequence walks the zones in `ZONE_ORDER` (encounter tables, legendary statics, trainers, league), then the species in no zone. Consecutive pairs form 2048² atlases of four 1024² cells (front + back of two species). Each zone binds at most 8 atlases; the planner duplicates species only when a zone would exceed that. |
| 6 | Rasters + encode | `pipeline.ts`, `mips.ts`, `encode.ts` | Composites the atlas maps, forces binary alpha, builds mips 1–3 (premultiplied box filter, coverage-preserving, normals renormalised, mask stays two-valued), encodes WebP under the budget ladder, writes thumbnails, the manifest and QA artifacts. |
| 7 | Flipbooks | `anim.ts` | Every page of the 20 multiframe sides (spec §40.1.8): stage 1 per page, the union crop resampled with the **static frame's own transform** onto the 1024² master (one crop, one size, one offset for every page: no jitter, and the static page lands where the static cell has it), stages 3–4 there, then a 2× reduction to the 512² anim cell. One atlas per side (6 × 4, 5 × 5 or 6 × 6 cells in page order), stage 6 as above, its own ladder (`ANIM_EXTRA_RUNGS`) under the 24 MiB anim budget. |

Every per-sprite result is cached under `.cache/sprites/<hash>/` keyed by the source bytes, `SPRITE_STAGE_VERSION`, sprite size, normal and emissive options, the frame-select entry and the alpha override. The stage rasters are stored as lossless true-colour PNG (`cache.ts` `losslessPng`: RGBA8 albedo and normal, 8-bit grey emissive), so a read returns exactly what the stages produced (`test/cache.test.ts`); the atlases are composed from those reads. Bump `SPRITE_STAGE_VERSION` when stages 1–4 or the stored form of their output change, and `PIPELINE_VERSION` when the atlas files change. Encoded atlas files are cached under `.cache/atlases/<hash>.webp` keyed by `PIPELINE_VERSION`, the encoder settings, the level and the member hashes with placements. A rerun over unchanged inputs does no image work. The cache is gitignored; the output is committed.

## Binary alpha

Every atlas map stores alpha as 0 or 255 (`ALPHA_THRESHOLD` 128). The billboard shader alpha-tests at 0.5 and Pillar 6 requires hard one-texel edges, so the soft edge values produced by lanczos resampling never reached the screen. Stored soft, they were only 3.9 % of texels but cost about a third of every albedo file, because WebP codes alpha losslessly. Mips are thresholded after the coverage-preserving scale, so the share of kept texels per cell still matches level 0 and creatures do not thin out at distance.

## Encoding

WebP only (KTX2 UASTC was measured 1.57× larger than lossless WebP on sprites and the bundled encoder refuses 4096² inputs; see §40.1.6.2).

| Map | Codec | Setting |
|---|---|---|
| albedo | lossy WebP | quality from the ladder, lossless binary alpha, smart subsampling, effort 6 |
| normal | lossy WebP | half resolution (1024² per atlas), quality from the ladder, lossless binary alpha |
| emissive | lossless WebP | mask replicated to RGB, read from R |
| mips 1–3 | same codec | lossy maps at quality − 10 |
| thumbs | lossy WebP | `thumbs/<id>_front.webp`, 128 px, ≤ 6 KB, own ladder in `encode.ts` |

The ladder encodes the whole set at the top rung and steps down (albedo q88 → q85 → q82 → q80, then normal q92 → q90 → q85) until the directory is ≤ 36 700 160 bytes (35 MiB). It never steps up and fails below the bottom rung.

Measured on 8 atlases (32 sprites), level 0 only, KB per atlas:

| Map | Setting | Soft 8-bit alpha | Binary alpha |
|---|---|---|---|
| albedo | q88 | 407 | 277 |
| albedo | q85 | 363 | 236 |
| albedo | q80 | 315 | 191 |
| normal (half res) | q92 | 199 | 117 |
| normal (half res) | q90 | 186 | 104 |

With soft alpha the bottom rung was 47.3 MB, over budget; the spec's 32 MB estimate assumed 73 KB of albedo per sprite and the real figure was about 130 KB with mips.

## Output

`packages/client/public/creatures/` after the 2026-10-06 build (`PIPELINE_VERSION` 6, `SPRITE_STAGE_VERSION` 4: atlases composed from the true-colour cache), with the 2026-09-25 build (`PIPELINE_VERSION` 5, composed from the palette cache) for comparison:

| Item | 2026-10-06 (v6) | 2026-09-25 (v5) |
|---|---|---|
| Species | 130 (260 sprites), 3 alternate-style files excluded | same |
| Atlases | 65 × 2048², no planner duplicates, at most 8 per zone | same |
| Rung shipped | albedo q88, normal q92 (the top rung) | same |
| Albedo, all levels | 22.61 MB | 25.46 MB |
| Normal, all levels | 9.50 MB | 9.46 MB |
| Emissive, all levels | 0.41 MB (byte-identical) | 0.41 MB |
| Thumbs | 0.70 MB | 0.69 MB |
| Manifest (static) | 0.18 MB | 0.18 MB |
| **Total** | **33.39 MB** (33 392 547 B) of the 36.70 MB (35 MiB) budget | 36.20 MB (36 197 860 B) |

The albedo is 11 % smaller in true colour: lossy WebP had been spending bits on the palette's dither noise. The ladder never steps up, so the 3.31 MB of headroom stays headroom.

Layout: `creatures.manifest.json` (v2), `atlases/a-NNN.{albedo,normal,emissive}[.mipN].webp`, `thumbs/<id>_front.webp`. A clean rebuild with a warm sprite cache takes about 4–6 minutes. The cold 2026-10-06 run took 47 min at `--jobs 6` (16 threads): stages 1–4 for 260 sprites ≈ 5 min, thumbs and the 65 static atlases ≈ 14 min, then the flipbooks ≈ 28 min (508 pages recomputed, seven anim ladder rungs encoded).

Measured quality at the shipped rung (acceptance test 4–7 inputs, against the true-colour stage raster): whole-sprite albedo PSNR median 38.9 dB (min 33.1), edge-bad median 5.5 % (max 34 %), interior-bad median 0.3 % (max 4.5 %), worst-edge luma error max 37.6, half-res normal mean angular error median 3.3° (max 5.98°, atlas a-050: 0.02° under the 6° bound; the v5 normal atlas measures the same against this reference), mip coverage exact per cell. The v5 figures (35.8 / 30.7 dB, edge 20 %, interior 2 %) were measured against the dithered palette cache they were built from.

### Flipbooks (2026-10-06)

| Item | Value |
|---|---|
| Sides / pages | 20 / 508 (7 WebP species × 2 × 24 at 125 ms; galaxion 2 × 36, glacinid and voltaura 2 × 25 at 100 ms) |
| Cell | 512² (spriteSize / 2): ≈ 1:1 with the legendaries' 430–561 px battle height |
| Atlases | 20 (`anim/<species>-<side>.*`, 240 files): 3072 × 2048 (24 pages), 2560² (25), 3072² (36) |
| Rung shipped | albedo q80, normal q80 (the static ladder's bottom, q80/q85, was 25.38 MB) |
| Albedo / normal / emissive, all levels | 19.73 / 4.11 / 0.55 MB |
| Manifest anim share | 0.10 MB (charged to the anim line; `totalBytes` is unchanged) |
| **Total** | **24.49 MB** (24 487 809 B, 23.35 MiB) of the 25.17 MB (24 MiB) anim budget |

Cache: `.cache/anim/<hash>/pNN.{albedo,normal,emissive}.png` + `meta.json` per side (the same `losslessPng` as the sprite cache); atlas files share `.cache/atlases/`. A rerun with a warm cache: 93 s for the whole build, 0 anim pages processed. QA: `qa/anim-sheet.png`, `qa/anim-report.json`.

## QA

`qa/qa-report.json` lists every flag. `clipped`, `nonsquare`, `multiframe` (with a `frame-select.json` entry) and `sidemismatch` are informational. `coverage` needs a reviewed `qa-accept.json` entry (`malice` front is a small creature on a large canvas). `leak` and `empty` can never be accepted; fix the source or add an `alpha-overrides.json` entry. The M1 release rule is `actionable === 0`. `qa/contact-sheet.png` shows every species front and back on the shared ground line.

## Deviations from SPEC §40.1

- Binary alpha in every atlas map and `SPRITE_STAGE_VERSION` for the per-sprite cache key (CHANGELOG 2026-09-24).
- The §40.1.6.3 byte arithmetic is replaced by the measured table above (same CHANGELOG entry).
- Stage 4 emissive rule replaced (CHANGELOG 2026-09-25).
- Multiframe sources ship as flipbooks (§40.1.8, CHANGELOG 2026-10-06); `frame-select.json` picks the static frame.
- **Fixed 2026-10-06 (`SPRITE_STAGE_VERSION` 4, `PIPELINE_VERSION` 6, CHANGELOG 2026-10-06):** until then `cache.ts` wrote the sprite cache with `png({ compressionLevel: 6, effort: 4 })`; sharp's `effort` implies `palette: true`, so every cached albedo and normal was a ≤ 256-colour dithered palette PNG and the 65 static atlases of v2–v5 were composed from those copies. Measured on four front sprites, cache vs stage output: 254–255 distinct RGBA values vs 15 k–198 k, RGB PSNR on opaque texels 32.9 (lumyth) – 48.1 dB (umbrit). Both caches now write `losslessPng`; `test/cache.test.ts` holds the round trip bit-exact. The emissive mask is two-valued and came through the palette unchanged (its 260 files are byte-identical across the rebuild); the flipbooks never went through it (their 240 files are byte-identical too).
