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

The 130 species of `.design/legacy/ewamon.js` (keys that carry `frontSprite`) plus the post-legacy rows of `.design/additions/species.js` (`EWAMON_SPECIES_ADDITIONS`; 144 today: `hollowmane`, `dustcub`, `badlander`, `veilpup`, `hollowolf`, `castlemaw`, `lawlander`, `hyoryu`, `cryptorb`, `ultraze`, `vysion`, `elemutt`, `katamute`, `ravatar`), plus one entry `<species>_<form>` per `battleForm` (and per entry of a row's `battleForms`, ravatar's five relic forms) (battle-only, in no zone): the rage forms and `badlander_majin` / `lawlander_tenjin` from `species.js`, and, since 2026-10-11, the legacy species' Majin / Tenjin forms that `.design/additions/patches.js` (`EWAMON_SPECIES_PATCHES`) declares (`infernomorel`, `toxshade`, `necrogeist`, `zenryu` `_majin`; `thornback`, `abysspark`, `gemknight`, `glimmereen`, `solpyre` `_tenjin`), with the legacy species' sizeScale (`legacy.ts`); with `hyoryu_majin` (2026-10-13) 152 entries, with `cryptorb`, `ultraze` and `vysion` (2026-10-24) 155; with the Elemutt line (2026-10-25) 163. `hollowmane`'s sources were delivered as 1024² WebP on a flat grey background; the background was keyed to real alpha (border flood within 24 of the border mean, plus a two-pass defringe of the anti-aliased rim) and saved as `hollowmane(front|back).png` before import, because stage 1's near-white keying would have reached into the white mane. `dustcub` and `badlander` came the same way (1024² WebP, grey background, plus a ground shadow and dirt specks): keyed by a border flood within 22 of the border mean, the shadow flooded as low-chroma grey in the bottom 16 %, enclosed background holes ≥ 60 px cleared (the lasso coils), every component but the creature dropped, binary alpha; `dustcub(front)` is mirrored so it faces left like every front sprite. `veilpup` and `hollowolf` likewise: border flood within 90 (summed RGB) of the border mean, the ground shadow and its anti-aliased rim flooded from the background as colours within 16 of the shadow→background grey line in the bottom 18 %, leftover specks under 200 px there dropped, binary alpha; both fronts mirrored. `castlemaw` and `castlemaw_rage` came as 1024² WebP on flat grey (no shadow): border flood within 24 (max channel) of the border mean, enclosed low-chroma holes ≥ 60 px cleared, a two-pass rim defringe, binary alpha; the creature's component kept, plus, on the rage sprites, every ember and smoke wisp ≥ 30 px or clearly coloured; both backs mirrored so they face right like every back sprite (the fronts already faced left). `hyoryu` and `hyoryu_majin` (2026-10-13) came as 1024² WebP on flat grey (no shadow), keyed like castlemaw's: border flood within 24 (max channel) of the border median, enclosed low-chroma holes ≥ 60 px cleared, a two-pass rim un-mix (within 3 px of the background, alpha = distance / 56), every component ≥ 30 px or clearly coloured kept (the ice spray), binary alpha; on the Majin art the red glow's halo over the grey is background too (pixels on the grey-to-(170, 45, 62) line below 0.8 of the way, flooded from the border), so no brown fringe is left; both backs mirrored so they face right (the fronts already faced left). `cryptorb`, `ultraze` (both on flat dark grey, (31, 35, 37)) and `vysion` (flat grey 62) (2026-10-24) came as 1024² WebP, no shadow: border flood within 9 (max channel; 10 for vysion) of the border median, so the near-black outlines and dark metal, darker than the background but close to it, stay; enclosed regions within 5 of the background and ≥ 200 px cleared (the gaps in cryptorb's swirl, between ultraze's limbs); a rim un-mix within 3 px of the background (alpha = distance / 22 on the dark ones, / 56 on vysion's grey, so its gold cape edges lose their grey blend); specks under 30 px (12 on cryptorb and vysion, for the code digits and motes) dropped unless clearly coloured; binary alpha; `ultraze(back)` and `cryptorb(back)` mirrored so they face right (the fronts already faced left, vysion's back already faced right). The 11 Majin / Tenjin form sprites (2026-10-11) came as 1024² opaque PNG on flat magenta (gemknight, glimmereen and necrogeist on flat green), with soft Gemini edges, glows and loose motes; they were keyed by `scripts/key-forms.ts` (`pnpm exec tsx tools/sprite-pipeline/scripts/key-forms.ts [--only key] [--sheet DIR]`, reads `assets-src/forms-pending/`, writes `assets-src/creatures/`): a key strength k from the chroma excess (magenta min(R, B) − G, green G − max(R, B), over the border median's), a background flood over k ≥ 0.5 from the border and every k ≥ 0.7 pixel, specks under 6 px dropped (motes kept), then every rim pixel (4 px) and every chroma-tinted pixel joined to it un-mixed from the background — as a blend of its nearest clean colour where that fits, else by k with the clean colour's hue — and its spill clamped; binary alpha, orientation as delivered. Per-image overrides in the script: `toxshade_majin` (purple-pink spikes on magenta are art), `lawlander_tenjin` (pink gaps inside its glowing loops). Files are matched by lower-casing and stripping `()_- ` and the extension. The four `yaschamp` alternate-style files are not species: they are listed under `excluded` in `qa-report.json` and not processed. `yaschamp(back).png` is the canonical back sprite (renamed from the boxing-style file, §40.1.1).

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

The ladder encodes the whole set at the top rung and steps down (albedo q88 → q85 → q82 → q80, then normal q92 → q90 → q85) until the directory is ≤ `CREATURES_BUDGET_BYTES`: 41 156 608 bytes (39.25 MiB) since 2026-10-11, 36 700 160 (35 MiB) before. It never steps up and fails below the bottom rung.

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

2026-10-08: with `hollowmane` (#131) and its rage form (`hollowmane_rage`, a battle-form entry: `.design/additions/species.js` `battleForm.frontSprite/backSprite`, keyed like the species art) the build is 132 entries / 264 sprites, **66 atlases**, **34.13 MB** (34 134 598 B), albedo q88 / normal q92 (top rung), 0 actionable flags; the anim set is unchanged.

2026-10-08: with `dustcub` (#132) and `badlander` (#133) the build is 134 entries / 268 sprites, **67 atlases**, **34.71 MB** (34 714 778 B), albedo q88 / normal q92 (top rung), 0 actionable flags; the co-occurrence planner re-paired the atlases again (`dustcub` binds into deepcut_route from `a-027`), the anim set is unchanged.

2026-10-08: with `veilpup` (#134) and `hollowolf` (#135) the build is 136 entries / 272 sprites, **68 atlases** (the `budget.test.ts` cap), **35.24 MB** (35 240 384 B), albedo q88 / normal q92 (top rung), 0 actionable flags, no duplicates; `veilpup` binds into skyrend from `a-042`, the anim set is unchanged. On ascent_route (the first choice) the co-occurrence pairing needed 6 duplicated species in the_rift and 71 atlases.

2026-10-08: with `castlemaw` (#136) and its rage form (`castlemaw_rage`) the build is 138 entries / 276 sprites, **69 atlases** (`budget.test.ts` cap raised to 69), **35.93 MB** (35 930 846 B, 0.77 MB under the ceiling), albedo q88 / normal q92 (top rung), 0 actionable flags, no duplicates, the anim set unchanged. Placed on umbral_observatory: siege_route (the first choice) gave 73 atlases with 8 duplicated species, ascent_route 72 / 6, every other zone 69 / 0. The re-pairing put `hollowmane_rage` beside `hollowolf` (`a-061`), an atlas mean band luma error of 38.8 over the §40.1.6.4 test 7 bound of 35; measured per sprite the worst is `hollowmane_rage` front at 43.1 (its thin white mane strands), so the bound is now 45, over the worst sprite and independent of the pairing.

2026-10-08: with `lawlander` (#137, dustcub's High Honor branch; grey-background sources keyed like dustcub's, front already facing left) the build is 139 entries / 278 sprites, **70 atlases**, **36.32 MB** (36 317 929 B), albedo q88 / normal q92 (top rung), 0 actionable flags, no duplicated species; 0.38 MB of headroom is left before the ladder steps down.

2026-10-11: with the 11 Majin / Tenjin form entries (`patches.js` forms now join the sprite set) the build is 150 entries / 300 sprites, **75 atlases**, **40.64 MB** (40 637 140 B), albedo q88 / normal q92 (top rung), 0 actionable flags (new informational: `zenryu_majin` front and back `clipped`, the hair touches the source canvas), no duplicated species, every zone ≤ 8 atlases, the anim set unchanged (24 487 809 B). The 11 entries cost 4.32 MB (0.39 MB each: dense, nearly canvas-filling art) against the 0.38 MB left, so the ladder would have dropped every sprite a rung; the ceiling was raised instead, from 35 MiB (36 700 160 B) to **39.25 MiB (41 156 608 B)**, 0.52 MB over this build (`types.ts` `CREATURES_BUDGET_BYTES`, `tools/asset-audit` `CEILINGS.creatures`), and the `budget.test.ts` atlas cap from 70 to 75. The re-pairing put `thundrix` beside `thornback_tenjin` (`a-071`; zoneless entries pair in id order), an atlas whose flat normal texels are 20.4 % beyond ± 2 after the q92 encode, over the §40.1.6.4 test 5 share of 20 % (thundrix's own: 29 %; with starwhim the atlas stayed under); `encoding.test.ts` now allows 22 %. The public/ total stays far under its 243 MiB line. Spec §40.6 / §40.1 still say 35 MiB until amended.

2026-10-13: with `hyoryu` (#138) and `hyoryu_majin` the build is 152 entries / 304 sprites, **76 atlases**, **41.59 MB** (top rung, albedo q88 / normal q92), 0 actionable flags, no duplicated species, the anim set unchanged (hyoryu has still art only). The two entries cost 0.95 MB against 0.52 MB of headroom, so the ladder would have stepped every sprite down to q85 (38.53 MB); the ceiling went to **40 MiB (41 943 040 B)** instead (`types.ts`, `tools/asset-audit`, spec §40.6) and the `budget.test.ts` cap to 76. Its static was placed on eclipse_shrine: on ascent_route the co-occurrence pairing duplicated 6 species in the_rift (79 atlases), siege_route 8 (80); every other zone planned 76 with none. The pairing put `hyoryu_majin` beside `ignispectre` (`a-065`), whose half-res normals decode at a 6.22° mean error (the dense crystal spikes), over test 5's 6°; `encoding.test.ts` and spec §40.1.6.4 now allow 6.5°.

2026-10-24: with `cryptorb` (#139), `ultraze` (#140) and `vysion` (#141) the build is 155 entries / 310 sprites, **78 atlases**, **42.65 MB** (42 646 746 B, top rung, albedo q88 / normal q92), 0 actionable flags, no duplicated species, the anim set unchanged (still art only). The three entries cost 1.06 MB against 0.35 MB of headroom, so the ladder would have stepped every sprite down to q85 (39.51 MB); the user chose to raise the ceiling to **41 MiB (42 991 616 B)** instead (`types.ts`, `tools/asset-audit`, spec §40.6) and the `budget.test.ts` cap went to 78. cryptorb spawns on ash_route (night rare): galvan_route also planned 78 with none duplicated but moved rimeidol's and wooltug's atlases out of their ecosystem migration targets; ash_route keeps every migration route drawable.
2026-10-25: with the Elemutt line, `elemutt` (#142), `katamute` (#143), `ravatar` (#144) and ravatar's five relic forms (`ravatar_water`, `_earth`, `_fire`, `_air`, `_avatar`), the build is 163 entries / 326 sprites, **82 atlases**, **45.50 MB** (45 503 822 B, top rung, albedo q88 / normal q92), 0 actionable flags, no duplicated species, the anim set unchanged. The eight entries cost about 2.86 MB; the user chose a raise over a lower rung, and the ceiling went to **44 MiB (46 137 344 B)**, the smallest whole MiB that keeps the top rung (`types.ts`, `tools/asset-audit`, spec §40.6), the `budget.test.ts` cap to 82. The line is a quest family (q13) with no spawn zone, so its entries pair zoneless in id order (reshuffling the zoneless atlases a-048 and a-050 onward). The sources were Gemini JPEGs (2752 × 1536, the backs on two labelled sheets) on flat grey 72 to 83: each figure cropped from its image (sheet cells by component centroid, the label text dropped), border flood within 11 (max channel) of the border median, enclosed regions within 6 of it and at least 3 000 px cleared (a lower floor took ravatar's grey swirl tattoos), a rim un-mix within 3 px (alpha = distance / 22), specks under 60 px dropped, binary alpha; on the Avatar State the glow's grey-to-blue blend is background too (low chroma, within -8..+56 of the grey, grown at most 18 px from the flood, plus enclosed pockets that are true grey, chroma under 14), so the lavender spirit clouds stay. Then each crop was centred on a square canvas; orientation as delivered.

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
- **Pending spec amendment (2026-10-11):** the static `creatures/` ceiling is 39.25 MiB (41 156 608 B), not §40.6's 35 MiB, so the 11 Majin / Tenjin form entries ship at the top rung (see Output).
- **Fixed 2026-10-06 (`SPRITE_STAGE_VERSION` 4, `PIPELINE_VERSION` 6, CHANGELOG 2026-10-06):** until then `cache.ts` wrote the sprite cache with `png({ compressionLevel: 6, effort: 4 })`; sharp's `effort` implies `palette: true`, so every cached albedo and normal was a ≤ 256-colour dithered palette PNG and the 65 static atlases of v2–v5 were composed from those copies. Measured on four front sprites, cache vs stage output: 254–255 distinct RGBA values vs 15 k–198 k, RGB PSNR on opaque texels 32.9 (lumyth) – 48.1 dB (umbrit). Both caches now write `losslessPng`; `test/cache.test.ts` holds the round trip bit-exact. The emissive mask is two-valued and came through the palette unchanged (its 260 files are byte-identical across the rebuild); the flipbooks never went through it (their 240 files are byte-identical too).
