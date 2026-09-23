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

Flags: `--only a,b` restricts to species, `--limit N`, `--force` ignores the sprite cache, `--jobs N` sets stage workers (output-neutral). A build exits with code 3 when `qa-report.json` has an actionable flag, and fails outright when a source is missing, a multiframe source has no `frame-select.json` entry, or the output would exceed the budget.

## The species set

Exactly the 130 species of `.design/legacy/ewamon.js` (keys that carry `frontSprite`). Files are matched by lower-casing and stripping `()_- ` and the extension. The four `yaschamp` alternate-style files are not species: they are listed under `excluded` in `qa-report.json` and not processed. `yaschamp(back).png` is the canonical back sprite (renamed from the boxing-style file, §40.1.1).

## Stages

| # | Stage | File | What it does |
|---|---|---|---|
| 1 | Alpha recovery | `alpha.ts` | Keeps real alpha (≥ 3 % translucent pixels, transparent border). Otherwise floods from the border against the border-mean colour (summed RGB tolerance 114), also keying connected magenta and near-white. Defringes translucent pixels from the nearest opaque colour within 8 px. Transparent pixels within 2 px of opaque take the nearest opaque RGB; all others become black, so filters never read white or magenta fringes. |
| 2 | Normalize | `normalize.ts` | Trims to the alpha bbox, scales the longest side to 881 px (0.86 × 1024), centres horizontally, puts the feet at y = 942 (manifest `footV` 0.08 from the bottom). Nearest-neighbour on integer factors, lanczos3 otherwise. |
| 3 | Normal map | `normalmap.ts` | Luminance height, Gaussian σ 1.2, Sobel strength 0.55, plus a 6 px outward alpha-edge bevel (strength 0.85) so silhouettes catch a rim light. OpenGL +Y. |
| 4 | Emissive mask | `emissive.ts` | HSL saturation × lightness ≥ 0.72, eroded 1 px, per-species overrides in `emissive-overrides.ts`. Two-valued. |
| 5 | Plan + pack | `plan.ts`, `pack.ts`, `zones.ts` | Every species stored once. A global sequence walks the zones in `ZONE_ORDER` (encounter tables, legendary statics, trainers, league), then the species in no zone. Consecutive pairs form 2048² atlases of four 1024² cells (front + back of two species). Each zone binds at most 8 atlases; the planner duplicates species only when a zone would exceed that. |
| 6 | Rasters + encode | `pipeline.ts`, `mips.ts`, `encode.ts` | Composites the atlas maps, forces binary alpha, builds mips 1–3 (premultiplied box filter, coverage-preserving, normals renormalised, mask stays two-valued), encodes WebP under the budget ladder, writes thumbnails, the manifest and QA artifacts. |

Every per-sprite result is cached under `.cache/sprites/<hash>/` keyed by the source bytes, `SPRITE_STAGE_VERSION`, sprite size, normal and emissive options, the frame-select entry and the alpha override. Encoded atlas files are cached under `.cache/atlases/<hash>.webp` keyed by `PIPELINE_VERSION`, the encoder settings, the level and the member hashes with placements. A rerun over unchanged inputs does no image work. The cache is gitignored; the output is committed.

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

`packages/client/public/creatures/` after the 2026-09-24 build (`PIPELINE_VERSION` 4):

| Item | Value |
|---|---|
| Species | 130 (260 sprites), 3 alternate-style files excluded |
| Atlases | 65 × 2048², no planner duplicates, at most 8 per zone |
| Rung shipped | albedo q88, normal q92 (the top rung) |
| Albedo, all levels | 25.46 MB |
| Normal, all levels | 9.46 MB |
| Emissive, all levels | 0.46 MB |
| Thumbs + manifest | 0.87 MB |
| **Total** | **36.25 MB** of the 36.70 MB (35 MiB) budget |

Layout: `creatures.manifest.json` (v2), `atlases/a-NNN.{albedo,normal,emissive}[.mipN].webp`, `thumbs/<id>_front.webp`. A clean rebuild with a warm sprite cache takes about 4–6 minutes; a cold run about 25 minutes.

Measured quality at the shipped rung (acceptance test 4–7 inputs): whole-sprite albedo PSNR median 35.8 dB (min 30.7), worst-edge luma error max 37.6, half-res normal mean angular error median 3.3° (max 5.9°), mip coverage exact per cell.

## QA

`qa/qa-report.json` lists every flag. `clipped`, `nonsquare`, `multiframe` (with a `frame-select.json` entry) and `sidemismatch` are informational. `coverage` needs a reviewed `qa-accept.json` entry (`malice` front is a small creature on a large canvas). `leak` and `empty` can never be accepted; fix the source or add an `alpha-overrides.json` entry. The M1 release rule is `actionable === 0`. `qa/contact-sheet.png` shows every species front and back on the shared ground line.

## Deviations from SPEC §40.1

- Binary alpha in every atlas map and `SPRITE_STAGE_VERSION` for the per-sprite cache key (CHANGELOG 2026-09-24).
- The §40.1.6.3 byte arithmetic is replaced by the measured table above (same CHANGELOG entry).
