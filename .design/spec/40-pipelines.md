# EWAMON REMASTERED — SPEC §40: tools/ PIPELINES AND ASSET FORMATS

**Status:** BINDING for `tools/sprite-pipeline`, `tools/model-pipeline`, `tools/material-bake`, `tools/audio-pipeline`, `tools/asset-audit` and for every file under `packages/client/public/`. Where this file disagrees with `00-spine.md`, `10-render.md`, `20-client.md` or `30-server-netcode.md`, the lower-numbered file wins; the disagreements found while writing it were listed under OPEN QUESTIONS at the end and are all resolved (reconciled 2026-09-18). Where it disagrees with `50-verification-budget.md`, this file wins.

Inputs, all read from disk for this section: `tools/sprite-pipeline/src/*.ts` (the pipeline that has already run once); its output `packages/client/public/creatures/` (66 atlas files, 196.6 MB of lossless WebP + 15 MB of animation sheets, 22 atlases, 132 sprite ids, manifest `version: 1`); `tools/sprite-pipeline/qa/qa-report.json` (264 sprites, `counts: { clipped: 76, coverage: 1, fallback-source: 1, missing-side: 1, multiframe: 20, nonsquare: 52 }`); `tools/sprite-pipeline/node_modules/ktx2-encoder@0.6.0` (`types/node/index.d.ts`, `types/type.d.ts`, `dist/node/*.js`); `tools/asset-audit/package.json` (`@gltf-transform/{core,extensions,functions} ^4.5.0`, `meshoptimizer ^0.24.0`); `assets-src/models/` (4 legendary GLBs, 20 Quaternius glTFs, 45 MB); `.design/legacy/ewamon.js` (130 species); `.design/roster-coverage.md` §6 (15 spawn tables, 140 species placements, 72 distinct species); `10-render.md` §10.2 and §10.4; `20-client.md` §20.7.4 and §20.10.3; `50-verification-budget.md` §50.4.8 and §50.5 M1.

Measured numbers quoted below come from two runs made while writing this file: `tsx src/cli.ts bench --count 4` (KTX2 vs WebP on four cached 1024² sprites, and the 4096² probe) and `tsx tmp/bench-webp.ts` over `mire_route-0.{albedo,normal,emissive}.webp` (eight WebP settings, size + edge error). Both commands exist in the repo; anyone can re-run them.

---

## §40.0 SCOPE, LAYOUT, RULES

40.0.1 Five tools, one output root:

```
tools/
├─ sprite-pipeline/    §40.1  assets-src/creatures  -> public/creatures/  (atlases + creatures.manifest.json + thumbs)
├─ model-pipeline/     §40.2  assets-src/models     -> public/models/     (meshopt GLBs + models.manifest.json)
├─ material-bake/      §40.3  packages/render/src/surfaces/recipes -> public/materials/ (KTX2 sets + materials.manifest.json)
├─ audio-pipeline/     §40.4  .design/audio-bible.md manifest -> public/audio/  (Opus/AAC + manifest.json)
└─ asset-audit/        §40.5  ZoneDump JSON -> pass/fail against 50-verification-budget.md §50.2.2
```

`tools/model-pipeline` and `tools/material-bake` are new packages. Today `tools/asset-audit/package.json` carries the `@gltf-transform/*` dependencies and a `models` script; those move to `tools/model-pipeline` (§40.2.1) so that `asset-audit` depends on nothing but `node:*`.

40.0.2 Rules that apply to every tool:

1. **Deterministic.** Same inputs, same bytes. No timestamps in any output except `audio/manifest.json`'s `builtAt`, which `20-client.md` §20.7.4 requires (and which is excluded from the determinism diff, §40.4.7). No `Math.random`; every stochastic step is seeded from the content hash of its input. Object keys are written sorted; arrays are sorted by id; JSON is 2-space indented with a trailing LF.
2. **Content-hash cache.** Every tool keeps `tools/<tool>/.cache/` keyed by `sha256(input bytes, PIPELINE_VERSION, stage parameters, encoder settingsKey)`. A rerun over unchanged inputs does no image/audio/mesh work and reports `cacheHits === inputs`. The cache directory is git-ignored; the outputs under `public/` are committed.
3. **Refuse to ship silently.** A missing or unresolvable input fails the build with the offending id in the message. Anything a heuristic guessed is flagged in the tool's `qa-report.json`; the release rule for each tool is in its section.
4. **Budgets are tests.** Every size number in §40.6 is asserted by a vitest file named in `50-verification-budget.md` §50.4.8 or added here; CI fails when a budget is exceeded.
5. **LF line endings, ES modules, TypeScript, `tsx` entry points, `pnpm --filter @ewa/<tool> run <script>`.** No tool imports from `packages/*` except `@ewa/content` (for zone ids, species ids and looks) and the pure subpath **`@ewa/render/surfaces`** (`packages/render/src/surfaces/`: the `SURFACES` table and the bake recipes, no three, no DOM, no node builtins — enforced by the render ESLint block), which `tools/material-bake` imports so the baked textures and the runtime graph cannot disagree — never the rest of `@ewa/render`, never `@ewa/client`. `tools/asset-audit` takes `@ewa/render` + `three` as **devDependencies** only, for the drift test that feeds a real `dumpZone()` to its `ZoneDump` mirror. <!-- amended 2026-09-25: material-bake IMPLEMENTATION-NOTES D0 (the `dist/surfaces.json` route was never built), asset-audit IMPLEMENTATION-NOTES A2 -->
6. **Licences travel with assets.** `assets-src/licenses/KAYKIT-ADVENTURERS-LICENSE.txt` is written to `public/models/CREDITS.txt` under a credit line ("Kay Lousberg, www.kaylousberg.com" — CC0, credit optional and given); `TABLER-LICENSE.txt` is copied to `public/icons/TABLER-LICENSE.txt` (MIT notice is required). The pipeline fails if either source file is missing. <!-- amended 2026-10-05: the Quaternius credits left with the Quaternius looks -->

---

## §40.1 SPRITE PIPELINE — `tools/sprite-pipeline`

### 40.1.1 Inputs and the species set

- Sources: `assets-src/creatures/front/` (140 files) and `assets-src/creatures/back/` (139 files), PNG/WebP/GIF, 256²–2048², 52 non-square, 398 MB. File names are irregular (`smellduckfront.png`, `bloomduck(front).png`, `bankaiser(front).webp`, `galaxion(front).gif`); `sources.ts` matches them by lower-casing and stripping the extension and every `()_- ` character, first against `frontSprite`/`backSprite` from `.design/legacy/ewamon.js`, then against `<id><side>`.
- **The species set is exactly the 130 ids in `ewamon.js`** (the object keys that carry `frontSprite`; the 10 `*_orb` keys are items, not species) **plus the post-legacy rows of `.design/additions/species.js`** (`EWAMON_SPECIES_ADDITIONS`, same shape; 49 today: `hollowmane`, `dustcub`, `badlander`, `veilpup`, `hollowolf`, `castlemaw`, `lawlander`, `hyoryu`, `cryptorb`, `ultraze`, `vysion`, `elemutt`, `katamute`, `ravatar`, `kykaiser`, and the 34 type-gap species `puffinch` … `mesadrake` (#146–179, low-resolution pixel art from `.design/imagegen/PIXEL-STYLE.md`, delivered as 128 px sprites enlarged 8× nearest-neighbour to 1024²) <!-- amended 2026-10-26: the type-gap lines (#146–179) --> <!-- amended 2026-10-13: hyoryu (#138) --> <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) --> <!-- amended 2026-10-25: the Elemutt line (#142–144) --> <!-- amended 2026-10-26: kykaiser (#145) -->) and their battle forms as one more entry each under `<species>_<form>` (`hollowmane_rage`, `castlemaw_rage`, from the row's `battleForm.frontSprite/backSprite`; zoneless, so it pairs into whichever atlas the planner leaves open) <!-- amended 2026-10-08: battle forms --> <!-- amended 2026-10-08: hollowmane (#131) --> <!-- amended 2026-10-08: dustcub, badlander (#132–133) --> <!-- amended 2026-10-08: veilpup, hollowolf (#134–135) --> <!-- amended 2026-10-08: castlemaw (#136) --> <!-- amended 2026-10-08: the honor ledger, lawlander (#137) -->. <!-- amended 2026-10-11: Majin / Tenjin forms --> Battle forms on LEGACY rows come from `.design/additions/patches.js` (`EWAMON_SPECIES_PATCHES[id].battleForm`, the legacy species' sizeScale, same collision check): the 11 Majin / Tenjin forms add `badlander_majin`, `lawlander_tenjin` (species.js) and `infernomorel_majin`, `toxshade_majin`, `necrogeist_majin`, `zenryu_majin`, `thornback_tenjin`, `abysspark_tenjin`, `gemknight_tenjin`, `glimmereen_tenjin`, `solpyre_tenjin` (patches.js), and since 2026-10-26 `raidori_tenjin` and `acier_majin` (patches.js) <!-- amended 2026-10-26: raidori_tenjin, acier_majin -->, and since 2026-10-27 `clementar_majin` (patches.js) <!-- amended 2026-10-27: clementar_majin -->; their art was generated, then chroma-keyed by `tools/sprite-pipeline/scripts/key-forms.ts`. A row's `battleForms` (ravatar's five relic forms) ship one entry per form. <!-- amended 2026-10-25: the Elemutt line (#142–144) --> The manifest's `sprites` record has exactly 164 keys (145 species + 19 forms <!-- amended 2026-10-26: kykaiser (#145) -->; 163 with 144 species + 19 forms <!-- amended 2026-10-25: the Elemutt line (#142–144) -->; 155 with 141 species + 14 forms <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) -->; 152 with `hyoryu` and `hyoryu_majin` <!-- amended 2026-10-13: hyoryu (#138) -->; 150 before, 139 before the forms); `budget.test.ts` asserts the count and that the key set equals `Object.keys(SPECIES)` from `@ewa/content`.
- **Alternate-style files are excluded from the manifest.** The four files `yaschamp(front|back)(boxingstyle|fighterstyle).png` are not species. Today `sources.ts` turns them into pseudo-species `yaschamp@boxingstyle` / `yaschamp@fighterstyle` and ships them (that is why the manifest has 132 ids and why `qa-report.json` shows `missing-side` on `yaschamp@boxingstyle back` and `fallback-source` on `yaschamp back`). Change: unclaimed files are recorded in `qa-report.json` under a new `excluded: { file, reason }[]` array (`reason: 'alternate-style'`) and are not processed. The `@<form>` code path (`parseFormFile`, `findMissingSides`, the `resolveEmissiveOverride` base lookup) is deleted.
- **`yaschamp` back.** `back/` holds no `yaschamp(back).png`; the run used `yaschamp(back)(boxingstyle).png` as a fallback. That fallback is the canonical back sprite from now on: it is renamed on disk to `yaschamp(back).png` (the other three alternate files stay where they are, excluded). After the rename the `fallback-source` and `missing-side` counts are 0.
- Animation sheets under `assets-src/creatures/animations/` (`voidraxis_idle*.{webp,png}`, 15 MB) are **not** copied to `public/` any more. They are legacy experiments with no consumer in `10-render.md` (`CreatureBillboard` has no frame animation; poses are uniform writes). `copyAnimations` and `ManifestAnimation` are deleted; the 15 MB leaves the budget. <!-- amended 2026-10-06 --> The legendaries' and mythicals' animation is restored from the **multiframe sources themselves** (every page of the 20 GIF / animated WebP sides, §40.1.8) under a separate budget line (§40.6); the legacy sheets stay unshipped.

### 40.1.2 The six stages — parameters as implemented

Every parameter below is a named constant in `src/*.ts`; changing any of them changes every cache key (`PIPELINE_VERSION` is folded into the key, and is bumped when a stage's behaviour changes without a constant changing).

| # | Stage | File | What it does, with the numbers |
|---|---|---|---|
| 1 | **Alpha recovery** | `alpha.ts` | If ≥ 3 % of pixels have `a < 250` and most border pixels are transparent (`MEANINGFUL_ALPHA_FRACTION 0.03`), the alpha is kept. Otherwise: flood-fill from every border pixel against the border-mean colour with per-pixel tolerance `FLOOD_TOLERANCE 114` (= 38/255 per channel, summed over RGB), additionally accepting magenta (`r,b ≥ 200, g ≤ 80`) and near-white (`min(r,g,b) ≥ 240`) pixels connected to the border; removed pixels get `a = 0`. Then `defringe(img, maxRadius 8)`: every pixel with `0 < a < 255` copies the RGB of the nearest pixel with `a = 255` within 8 px. Coverage bounds `COVERAGE_MIN 0.12` / `COVERAGE_MAX 0.92` set the `coverage` flag. **Added rule (not yet in code):** after defringe, every pixel with `a = 0` within a 3-4 chamfer distance ≤ 2 px of an opaque pixel also takes the nearest opaque RGB; every other `a = 0` pixel is set to RGB `(0,0,0)`. Reason: the flood leaves white/magenta RGB under transparent pixels, and both the premultiplied mip filter (§40.1.5) and bilinear minification read it. |
| 2 | **Normalize** | `normalize.ts` | Trim to the alpha bbox; scale so `max(bboxW, bboxH) = round(FILL_FRACTION 0.86 × 1024) = 881 px`; centre horizontally; anchor the bbox bottom at `y = round(FOOT_V 0.92 × 1024) = 942`. Kernel: `nearest` when the scale factor is within `INTEGER_TOLERANCE 1e-3` of an integer or of the reciprocal of an integer, `lanczos3` otherwise (`chooseKernel`). Canvas `DEFAULT_SPRITE_SIZE 1024`. Measured over the 264 processed sprites: `pixelScale` min 0.43, median 0.89, max 10.74; 71 sprites are upscaled ≥ 2×, 152 are downscaled (< 1). |
| 3 | **Normal map** | `normalmap.ts` | Height = Rec. 709 luminance of the albedo, Gaussian-blurred with `sigma 1.2` (radius `ceil(3σ) = 4`), clamped at borders. 3×3 Sobel with `strength 0.55`; transparent neighbours take the centre pixel's height so the Sobel never fires across the silhouette. Alpha-edge bevel: 3-4 chamfer distance over alpha capped at `bevelBand 6` px; within the band the normal is tilted outward (away from the nearest transparent pixel) by `bevelStrength 0.85` at the edge, falling linearly to 0 at 6 px. Encoding `R = 128 + nx·127`, `G = 128 + ny·127` (OpenGL +Y up), `B = 128 + nz·127`, `A = source alpha`; a flat opaque region encodes to exactly `(128, 128, 255)`. |
| 4 | **Emissive mask** | `emissive.ts` | <!-- amended 2026-09-25: was HSL saturation × lightness ≥ 0.72, which tends to 1 for faintly tinted near-whites (42–49 % of mufflo/dreambud glowed) and scores a pure saturated hue 0.5 --> Per opaque pixel: emits when HSV value `max(r,g,b) ≥ EMISSIVE_MIN_VALUE 0.92` and chroma `max − min ≥ EMISSIVE_MIN_CHROMA 0.4` (bright and vivid: a lure, a flame, molten seams — not pale fur). If more than `EMISSIVE_MAX_COVERAGE 0.08` of the opaque texels qualify, only the most vivid are kept (ranked by value × chroma, ties by raster order), so the mask stays an accent. Then `erode1px` (3×3 min, image border counts as 0). Per-species `EMISSIVE_OVERRIDES[id] = { minValue?, minChroma?, maxCoverage?, disabled? }` in `emissive-overrides.ts` (empty today; every entry is an art decision reviewed on the contact sheet). Output is single-channel; the mask is stored in R of a 3-channel file because WebP has no grey mode. |
| 5 | **Plan + pack** | `plan.ts`, `pack.ts`, `zones.ts` | *(As shipped since `PIPELINE_VERSION` 5; the draft's 4096² / 16-slot / 8-species-per-atlas packer is gone.)* One global sequence over `ZONE_ORDER` (§40.1.4); consecutive species pairs form 2048² atlases of four 1024² cells (`packSquares(4, 1024, 2048)`); ≤ 8 atlases per zone, duplicating only when a zone would exceed that (0 duplicates on the shipped roster); atlases of the previous manifest stay pinned (§40.1.4 Stability, amended 2026-10-26). |
| 6 | **Rasters + encode** | `pipeline.ts`, `mips.ts`, `encode.ts` | *(As shipped.)* Composites the atlas maps, forces binary alpha, builds mips 1–3, encodes WebP under the §40.1.6.3 budget ladder, writes thumbnails, the manifest and QA artifacts. |

<!-- amended 2026-09-25: rows 5 and 6 described the pre-v2 code ("Today: selectEncoding('auto', 4096) …"); tools/sprite-pipeline/README.md stages table -->

Cache (`cache.ts`): per sprite `.cache/sprites/<hash>/{albedo,normal,emissive}.png + meta.json`, `hash = sha256(source bytes, "v" + SPRITE_STAGE_VERSION, "size=1024", normal options JSON, emissive override JSON, frame-select entry, alpha override JSON)`; the three rasters are stored as **lossless true-colour PNG** (`losslessPng`: RGBA8 albedo and normal, 8-bit grey emissive; `palette: false`, and none of sharp's `effort` / `colours` / `dither` / `quality` PNG options, each of which switches libvips to a ≤ 256-colour dithered palette), so a cache read is bit-identical to the stage output (`test/cache.test.ts`) — every atlas is composed from cache reads, never from the in-memory stage output. Per atlas texture `.cache/atlases/<hash>.webp`, `hash = sha256(PIPELINE_VERSION, settingsKey, "2048/1024", kind, level, member hashes with their placements)`. <!-- amended 2026-10-06: the key named PIPELINE_VERSION and "4096/1024" (pre-v2 text); the stored format was unstated and was a dithered 256-colour palette until SPRITE_STAGE_VERSION 4 (§40.1.7) --> `SpriteMeta` records `sourceWidth/Height, recovered, coverage, flags, footV, pixelScale, kernel, emissivePixels`. Stage concurrency is 3 workers (`CONCURRENCY 3`); results are sorted by `(id, side)` before anything is written, so worker order never reaches the output.

### 40.1.3 QA flags — semantics and release rule

`QaFlag` (`alpha.ts`), with the meaning fixed here and the count from the last run:

| Flag | Count | Meaning | Class | Action |
|---|---|---|---|---|
| `clipped` | 76 | The alpha bbox touches at least one edge of the **source** canvas. Normalize still fits the bbox to 881 px and anchors the bottom at 942, so the output is not clipped; the flag says the artist's canvas cut the drawing (usually a tail or wing tip), and there is nothing the pipeline can recover. | informational | None. Reported so a future redraw list exists. Moved into `INFORMATIONAL_FLAGS`. |
| `nonsquare` | 52 | Source is not square. Normalize makes it square. | informational | None. |
| `multiframe` | 20 | The source is a multi-page GIF or animated WebP (10 species: `bankaiser, galaxion, glacinid, lumyth, noxmyth, raikitsune, sunjaw, voidraxis, voltaura, zenryu`). <!-- amended 2026-10-06 --> The source **is animated**: every page ships as a flipbook (§40.1.8), and `frame-select.json` picks the **static** frame — the page in the 1024² static cell, shown wherever no flipbook is bound (thumbnail, the first frames before the anim atlas lands, a client without it) and the anchor of the flipbook's shared normalisation. | must be decided | `frame-select.json` in `tools/sprite-pipeline/` maps `<id>/<side>` → page index (default 0; all 20 are 0). Every multiframe source must have an entry, chosen once from a per-source contact strip (`tsx src/cli.ts frames <id>` writes `qa/frames/<id>-<side>.png`, all pages in a row). Build fails on a multiframe source with no entry. The chosen frame is decoded with `sharp(bytes, { page: n })`. The flag stays informational once an entry exists. |
| `coverage` | 1 | Opaque fraction of the source canvas outside `[0.12, 0.92]` (`malice front`: a small creature on a large canvas). | review | Human looks at the contact sheet; if the alpha is right, add the id to `qa-accept.json` with a one-line reason; the flag is then suppressed. |
| `leak` | 0 | The border flood reached the centre 20 % of the alpha bbox (a hole in the outline let the background through). | must be resolved | Fix the source or add an `alpha-overrides.json` entry (`{ tolerance?, keyMagenta?, keyWhite? }`) for that id; never accepted. |
| `empty` | 0 | Nothing recoverable; the raw source was shipped. | must be resolved | Never accepted. |
| `fallback-source` | 1 | The canonical file was missing; another file of the species was used (`yaschamp back`). | must be resolved | Resolved by the rename in §40.1.1; a future occurrence is an error, not a flag. |
| `missing-side` | 1 | No file at all for a side (`yaschamp@boxingstyle back`). | must be resolved | Disappears with the alternate-style exclusion; a species with no file for a side is an error (the build already throws for real species). |

**Release rule for M1** (`50-verification-budget.md` §50.5): `qa-report.json` has `flagged.filter(e => e.flags.some(f => !INFORMATIONAL_FLAGS.has(f) && !accepted(e))).length === 0`. With `clipped`, `nonsquare` and `multiframe` (entries present) informational and `coverage` accepted for `malice`, the current inputs reach that state after the `yaschamp` rename. The report keeps the full flag list — informational flags are still printed — and adds `excluded` (§40.1.1) and `accepted: { species, side, flag, reason }[]`.

`qa-flags.test.ts` in §50.4.8 also names a flag for "front/back sizes differ by > 20 %": that is added as `sidemismatch`, computed on `pixelScale`: `|log2(front.pixelScale / back.pixelScale)| > log2(1.2)` → informational (both sides are normalised to the same 881 px, so the creature is the same height on both sides by construction; the flag records that the two source drawings were at different scales).

### 40.1.4 Atlas planning — every species once, packed by zone affinity

`10-render.md` §10.4.1's first draft said: atlases are per zone, a zone's spawn set is ≤ 2 atlases of 4096² (8192² only for `solenne`), and a creature not in the current zone's atlases binds its species' `single_<species>` 2048² set (it now states the layout below — reconciled 2026-09-18). `groups.ts` today groups by the *legacy* route tables plus `league`/`starters`/`misc` and pulls forward evolutions in. Both are replaced by the plan below; the reason is arithmetic (§40.1.6.2): the 35 MB budget is reachable only if **each of the 260 sprites is stored once**, and a literal per-zone layout stores the 72 table species 140 times.

**Zone set** `Z(zone)` for each of the 21 zones:

```
Z(zone) = species(ENCOUNTER_TABLES[enc_<zone>])            // 15 zones have a table; 5–14 distinct species (roster §13)
        ∪ { s.species : s ∈ LEGENDARY_STATICS, s.zoneId = zone }
        ∪ { t.species : t ∈ ZoneDef.trainers[*].team }
        ∪ { t.species : t ∈ LEAGUE, t.zoneId = zone }        // the town's gym / solenne's elite + champion
```

The 6 towns without a table (`mirevale, cinderhold, stormrook, marrowdig, vesperveil, forgewall`) get `Z(zone)` from the last three terms only, so a gym battle in Mirevale binds the gym team's atlases and nothing else.

**Cell and atlas.** The atlas is **2048²** holding **4 sprites = 2 species** (front + back each), not 4096² × 16. Same texel density, same VRAM per bound texel; the smaller unit is what lets a zone bind only the species it needs while every species exists once on disk. `solenne` needs no 8192² special case.

**Order.** Species are laid out in one global sequence: walk `ZONE_ORDER`; for each zone append the species of `Z(zone)` not yet placed, sorted by id; finally append every species in no zone set (`home` species: level-only evolutions, mythicals' quest forms), sorted by id. Consecutive pairs of the sequence form atlases `a-000, a-001, …`. Inside an atlas: species by id, sides `back` before `front` (`compareSources`), packed by `packSquares(4, 1024, 2048)` — 2×2, so `px` is always one of `(0,0) (1024,0) (0,1024) (1024,1024)`.

**Bind lists.** `zones[zoneId]` = sorted list of the atlases containing `Z(zone)`. Because a zone's *new* species are contiguous in the sequence, a zone binds `ceil(new/2) + (species already placed by earlier zones, each in its own earlier atlas)`. **Cap: 8 atlases per zone** (= 2 × 4096² in texels, the `10-render.md` figure). When a zone exceeds 8, the planner duplicates the *earliest-placed* species of that zone into a zone-local atlas `a-<zoneId>-dup-N` until the cap holds; the duplication count is printed and asserted `≤ 6` species over the whole world by `budget.test.ts` (the measured tables need 0: the largest, `hollow_route`, has 14 species, of which the ones shared with earlier zones are the Ghost line roots already placed in `vesperveil`'s gym set — the exact figure is computed by the planner and written to `qa-report.json` as `bindStats: Record<ZoneId, { atlases: number; duplicated: string[] }>`).

**Stability.** <!-- amended 2026-10-26: stable planning --> A build plans against the previous manifest (the one in the output directory, or `--baseline FILE`), so adding species does not re-encode the atlases already shipped; before this, one new species early in `ZONE_ORDER` re-paired every later atlas, and the 34 type-gap species re-encoded ≈ 690 existing atlas files (≈ 50 MB of git history for ≈ 9 MB of new art). Every `a-NNN` atlas of the baseline stays **pinned**: same id, the members still in the roster, each in the cell it had (cell order read from the home rects, so the "species by id" rule above holds only for a fresh atlas). Only species without a pinned home are matched, by the same co-occurrence weight as a fresh plan: with each other, or into the free cell of a pinned single-species atlas when they share a zone with its occupant (a fill re-encodes that atlas, so a zoneless newcomer opens a new one), the newcomer taking the cell after the occupant. New atlases take the ids of emptied baseline atlases first, then the next index after the highest. A rebuild that only adds species therefore leaves every existing atlas file byte-identical (the encoded-atlas cache keys on members and cells, §40.1.7), unless the budget ladder changes rung. **Stability against the cap:** when a zone would bind more than 8 atlases, the pinned atlases that zone binds are released and re-matched with the new species, repeated while any zone is over; a released pair that re-forms keeps its id, cells and bytes. If the result still duplicates species and releasing every atlas (a full re-plan that still reuses the ids of re-formed pairs) duplicates fewer, the full re-plan wins. The build log names the kept, changed, added, dropped and released atlases and the zones that forced a release; `cli.ts plan` prints the same without image work; `--replan` ignores the baseline. Duplicate atlases are re-derived every build, never pinned. Measured on the 2026-10-26 roster: a fresh plan reproduces the shipped atlases exactly; against the type-gap manifest, astaroth adds `a-099` and keeps the other 99 byte-identical; one more species in any zone adds one atlas, except in the zones already at 8 binds (`galvan_route`, `ascent_route`, `the_rift`: 1 or 2 released atlases re-pair) and `vesperveil` (it fills `a-099`'s free cell).

**Home and the single set.** `home` = the atlas holding a species' one (or first) placement. `single_<species>` sets are **not** written to disk; the client derives them from `home` with a cropped decode (`createImageBitmap(blob, x, y, w, h)` — one atlas file is 2048², so the crop is at most a 4 MB decode). This replaces the 130 × 2048² second copy of every sprite that `10-render.md` describes (OQ-1).

**Accounting.** <!-- amended 2026-10-27: clementar_majin --> 180 species + 22 battle forms = 202 entries × 2 sides = 404 sprites → **103 atlases** of 2048², none duplicated (`budget.test.ts` cap 103), 54.13 MB at the top rung; the form pairs zoneless into the new `a-102`. <!-- amended 2026-10-26: acier_majin --> 180 species + 21 battle forms = 201 entries × 2 sides = 402 sprites → **102 atlases** of 2048², none duplicated (`budget.test.ts` cap 102), 53.72 MB at the top rung; the form pairs zoneless into the new `a-101`. <!-- amended 2026-10-26: raidori_tenjin --> 180 species + 20 battle forms = 200 entries × 2 sides = 400 sprites → **101 atlases** of 2048², none duplicated (`budget.test.ts` cap 101), 53.36 MB at the top rung; the form pairs zoneless into the new `a-100`. <!-- amended 2026-10-26: astaroth (#180) --> 180 species + 19 battle forms = 199 entries × 2 sides = 398 sprites → **100 atlases** of 2048², none duplicated (`budget.test.ts` cap 100), 53 048 987 B at the top rung. <!-- amended 2026-10-26: the type-gap lines (#146–179) --> 179 species + 19 battle forms = 198 entries × 2 sides = 396 sprites → **99 atlases** of 2048², none duplicated (`budget.test.ts` cap 99), 52 878 152 B at the top rung; the 14 roots sit in tables chosen so no zone needs a duplicate and every ecosystem migration route stays drawable. <!-- amended 2026-10-26: kykaiser (#145) --> 145 species + 19 battle forms = 164 entries × 2 sides = 328 sprites → **82 atlases** of 2048², none duplicated (still the cap of 82; kykaiser, an evolution in no table, pairs zoneless). <!-- amended 2026-10-25: the Elemutt line (#142–144) --> 144 species + 19 battle forms = 163 entries × 2 sides = 326 sprites → **82 atlases** of 2048², none duplicated (`budget.test.ts` cap 82; the line is a quest family in no zone, so its entries pair zoneless). <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) --> 141 species + 14 battle forms = 155 entries × 2 sides = 310 sprites → **78 atlases** of 2048², none duplicated (`budget.test.ts` cap 78). <!-- amended 2026-10-13: hyoryu (#138) --> 138 species + 14 battle forms = 152 entries × 2 sides = 304 sprites → **76 atlases** of 2048², none duplicated (`budget.test.ts` cap 76; hyoryu's static is on eclipse_shrine because on ascent_route the pairing duplicated 6 species in the_rift, 79 atlases). <!-- amended 2026-10-11: Majin / Tenjin forms --> 137 species + 13 battle forms = 150 entries × 2 sides = 300 sprites → **75 atlases** of 2048² (was 139 / 278 / 70; `budget.test.ts` cap 75). Before the forms: 137 species + 2 battle forms (`hollowmane_rage`, `castlemaw_rage`) = 139 entries × 2 sides = 278 sprites → **70 atlases** of 2048² (the last holds one entry; no room for a `dup` atlas under the cap) <!-- amended 2026-10-08: hollowmane (#131) --> <!-- amended 2026-10-08: dustcub, badlander (#132–133) --> <!-- amended 2026-10-08: veilpup, hollowolf (#134–135) --> <!-- amended 2026-10-08: castlemaw (#136) --> <!-- amended 2026-10-08: the honor ledger, lawlander (#137) -->. `budget.test.ts` asserts `manifest.atlases.length ≤ 70`, occupied slots `= 278 + 2 × duplicated`, `zones[z].length ≤ 8` for all 21 zones. VRAM at runtime (RGBA8 albedo 16 MB + RGBA8 normal at half resolution 4 MB + R8 emissive 4 MB = 24 MB per atlas × 1.33 mips = 32 MB): a 14-species zone binds ≤ 8 atlases = **≤ 256 MB**, and 6 party singles at 1024² each ≤ 6 × 8 MB = 48 MB — 304 MB of the 700 MB cap in `50-verification-budget.md` §50.2.2, the same order as the `10-render.md` layout (2 × 4096² × 3 maps RGBA8 × 1.33 = 512 MB) and smaller.

### 40.1.5 The manifest — `creatures.manifest.json`

**Historical — the v1 shape this section replaced** (`src/manifest.ts` as it was when this section was written, `version: 1`; **not** in the code any more and not to be implemented — kept so the mismatch table below reads; amended 2026-09-25):

```ts
export type ManifestEncoding = 'ktx2-uastc' | 'webp';

export interface SpriteRect {
  /** Atlas id (see `atlases[].id`). */
  atlas: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Fraction of the sprite cell height at which the creature's feet sit (0.92). */
  footV: number;
  /** Output pixels per source pixel after normalisation. */
  pixelScale: number;
  /** Source file relative to `assets-src/creatures/`. */
  source: string;
}

export interface ManifestAtlas {
  id: string;
  albedo: string;
  normal: string;
  emissive: string;
  group: string;
}

export interface ManifestSprite {
  front: SpriteRect;
  back: SpriteRect;
  /** Legacy `sizeScale` — world-space scale the renderer applies on top of the uniform canvas. */
  sizeScale?: number;
}

export interface ManifestAnimation {
  species: string;
  /** Relative to the manifest, e.g. `animations/voidraxis_idle_sheet.png`. */
  file: string;
  frames?: number;
  fps?: number;
}

export interface SpriteManifest {
  version: 1;
  encoding: ManifestEncoding;
  atlasSize: number;
  spriteSize: number;
  atlases: ManifestAtlas[];
  sprites: Record<string, ManifestSprite>;
  animations: ManifestAnimation[];
}
```

**What `10-render.md` §10.4.1 consumes** is now the v2 shape below: `SpriteFrame { atlas, rect = uv, px, footV, aspect }` and `AtlasSet { id, albedo/normal/emissive: AtlasMap { url, mips }, size: 2048, normalScale }` — the earlier render-side draft (`rect` only, `AtlasSet.size: 4096 | 8192`, KTX2 urls) was replaced there on reconciliation, so the two files define one shape and this file is its source. <!-- reconciled 2026-09-18 -->

**Mismatches and the decision on each** — v2 below is the contract; `10-render.md` §10.4.1 now consumes it verbatim (`SpriteFrame` = `uv → rect` + `px` + `footV` + `aspect`; `AtlasSet` = `ManifestAtlasV2` maps). <!-- reconciled 2026-09-18: v2 wins, stated in all three sections -->

| # | v1 | §10.4.1 | Decision |
|---|---|---|---|
| 1 | `x, y, w, h` pixels, y down | `rect: [u0, v0, u1, v1]`, v **up** | v2 carries **both**: `px: [x, y, w, h]` (tooling, contact sheet, `createImageBitmap` crop) and `uv: [u0, v0, u1, v1]` with `u0 = x / size`, `v0 = 1 − (y + h) / size`, `u1 = (x + w) / size`, `v1 = 1 − y / size`. The client passes `uv` through unchanged as `rect`. |
| 2 | `footV 0.92` measured from the **top** | `footV` from the **bottom**, default 0.08 | v2 `footV` is from the bottom: `1 − FOOT_V = 0.08`. `stages.test.ts` ("foot line at the manifest's fixed V ± 1 texel") reads `round((1 − footV) × 1024) = 942`. |
| 3 | no `aspect` | `aspect` | v2 adds `aspect: 1` (every frame is a 1024² cell; a future non-square cell would set it). |
| 4 | `ManifestAtlas.group` = legacy route name | `AtlasSet.size: 4096 \| 8192`, atlases keyed by zone | v2: atlases are 2048² and zone-agnostic (`species[]`, `size: 2048`, `slots`); the per-zone view is the `zones` record (§40.1.4). `group` is dropped. **Decided** (OQ-1, `10-render.md` §10.4.1): `AtlasSet.size` is `2048`, and "≤ 2 atlases of 4096²" became "≤ 8 atlases of 2048²" — identical texel budget, 6 more shared materials. |
| 5 | `encoding: 'ktx2-uastc' \| 'webp'` (whole manifest) | `AtlasSet` urls described as KTX2 | v2 `encoding: 'webp'` only (§40.1.6); per-map `codec` records the lossy/lossless choice so the audit can check it. KTX2 for creatures is removed from the type. **Decided** (OQ-1): `AtlasSet` maps are WebP (`AtlasMap { url, mips }`), and `textures.ktx2Only` exempts class `'billboard'`. |
| 6 | one url per map | one url per map | v2 adds `mips: string[]` per map (levels 1..3, §40.1.6.3) because `10-render.md` §10.4.3 wants a pipeline-built, premultiplied-aware chain and `generateMipmaps = false`. |
| 7 | `sizeScale?` optional | `SpriteDescriptor.sizeScale` required | v2 `sizeScale: number` required, copied from `SpeciesDef.sizeScale` (0.45–1.5 in the legacy data). |
| 8 | `animations[]` | not consumed | dropped (§40.1.1). |
| 9 | no per-species home | `single_<species>` sets | v2 `home: atlasId` (§40.1.4). |

**Verbatim v2** (`src/manifest.ts` is rewritten to this; `validateManifest` and `serializeManifest` are kept and extended):

```ts
export type SpriteCodec = 'webp-lossy' | 'webp-lossless';

export interface SpriteRectV2 {
  readonly atlas: string;                                    // ManifestAtlasV2.id
  readonly px: readonly [number, number, number, number];    // x, y, w, h in level-0 texels, y down
  readonly uv: readonly [number, number, number, number];    // u0, v0, u1, v1, v up — 10-render.md SpriteFrame.rect
  readonly footV: number;                                    // from the bottom of the cell; 0.08
  readonly aspect: number;                                   // w / h; 1
  readonly pixelScale: number;                               // output px per source px (QA only)
  readonly source: string;                                   // relative to assets-src/creatures/ (QA only)
}

export interface ManifestMap {
  readonly url: string;                                      // level 0, relative to the manifest, e.g. atlases/a-000.albedo.webp
  readonly mips: readonly string[];                          // levels 1..3 (1024², 512², 256² for a 2048² atlas)
  readonly codec: SpriteCodec;
  readonly quality: number | null;                           // libwebp q for lossy, null for lossless
  readonly bytes: number;                                    // sum over url + mips
}

export interface ManifestAtlasV2 {
  readonly id: string;                                       // 'a-000' … 'a-064', or 'a-<zoneId>-dup-N' (§40.1.4)
  readonly species: readonly string[];                       // the 1–2 species packed here, sorted
  readonly size: 2048;                                       // level-0 texels per side
  readonly slots: number;                                    // occupied 1024² cells, 2 or 4
  readonly albedo: ManifestMap;                              // sRGB, straight alpha
  readonly normal: ManifestMap;                              // NoColorSpace; half resolution (normalScale 0.5 → a 1024² file)
  readonly emissive: ManifestMap;                            // mask in R
  readonly normalScale: 0.5 | 1;                             // normal atlas texels per albedo texel
}

export interface ManifestSpriteV2 {
  readonly front: SpriteRectV2;
  readonly back: SpriteRectV2;
  readonly sizeScale: number;                                // SpeciesDef.sizeScale
  readonly home: string;                                     // atlas id used for the runtime single set
  readonly thumb: string;                                    // thumbs/<id>_front.webp, 128 px (20-client.md §20.10.2 rule 6)
  readonly alt?: Readonly<Record<string, { readonly front: SpriteRectV2; readonly back: SpriteRectV2 }>>;   // only for a planner-duplicated species: its rects in each a-<zoneId>-dup-N atlas (absent in the shipped build: 0 duplicates)
  readonly anim?: ManifestAnimSprite;                        // amended 2026-10-06: only for a multiframe species (§40.1.8)
}

export interface ManifestAnimSprite {
  readonly front?: ManifestAnimSide;
  readonly back?: ManifestAnimSide;
}

export interface ManifestAnimSide {
  readonly atlas: string;                                    // ManifestAnimAtlas.id, 'anim-<species>-<side>'
  readonly frames: readonly (readonly [number, number, number, number])[];   // uv (u0, v0, u1, v1, v up) per source page, in page order
  readonly delays: readonly number[];                        // display ms per page (sharp `delay`; < 20 ms shows as 100 ms)
  readonly staticFrame: number;                              // the frame-select page: the static rect shows this frame
  readonly footV: number;                                    // 0.08, as the static rect
  readonly aspect: number;                                   // 1
  readonly pixelScale: number;                               // anim texels per source px (QA only)
  readonly source: string;                                   // relative to assets-src/creatures/ (QA only)
}

export interface ManifestAnimAtlas {
  readonly id: string;                                       // 'anim-<species>-<side>'
  readonly species: string;
  readonly side: 'front' | 'back';
  readonly width: number;                                    // level-0 texels (cols × cell)
  readonly height: number;                                   // rows × cell
  readonly cell: number;                                     // 512 = spriteSize / 2
  readonly slots: number;                                    // occupied cells = the side's page count
  readonly albedo: ManifestMap;                              // anim/<species>-<side>.albedo.webp + .m1..m3
  readonly normal: ManifestMap;                              // half resolution
  readonly emissive: ManifestMap;
  readonly normalScale: 0.5;
}

export interface SpriteManifestV2 {
  readonly version: 2;
  readonly encoding: 'webp';
  readonly spriteSize: 1024;
  readonly pipelineVersion: string;                          // PIPELINE_VERSION
  readonly atlases: readonly ManifestAtlasV2[];              // sorted by id
  readonly zones: Readonly<Record<string, readonly string[]>>;  // ZoneId -> atlas ids (≤ 8, §40.1.4), all 21 zones present ([] allowed)
  readonly sprites: Readonly<Record<string, ManifestSpriteV2>>;  // exactly the 130 species ids, sorted
  readonly totalBytes: number;                               // every static file under public/creatures/ (all but anim/) + the manifest without its anim fields (amended 2026-10-06)
  readonly animAtlases?: readonly ManifestAnimAtlas[];       // amended 2026-10-06: sorted by id; present iff some sprite has `anim`
  readonly animTotalBytes?: number;                          // every file under public/creatures/anim/ + the manifest bytes the anim fields add (§40.6 anim line)
}
export const MANIFEST_FILE = 'creatures.manifest.json';
```

`validateManifest` additionally asserts: every `atlas` reference resolves; `uv` is consistent with `px` and `size`; `footV === 0.08`; `zones[z].length ≤ 8`; `sprites` keys equal the content species set; `home ∈ atlases`; `totalBytes ≤ 41 156 608` (<!-- amended 2026-10-11: Majin / Tenjin forms --> was 36 700 160). The manifest is the contract; the client (`20-client.md` §20.4.4 adapter) maps `ManifestSpriteV2` → `SpriteDescriptor` by copying `uv → rect`, `footV`, `aspect` and looking up `AtlasSet` from `atlases`.

<!-- amended 2026-10-06 --> **The anim extension** (§40.1.8) is validated as strictly: `animAtlases` and `animTotalBytes` are present iff some sprite has `anim`; every anim atlas is `anim-<species>-<side>` of a known species, a grid of `spriteSize / 2` cells no larger than 8192 per edge whose last row is the only partial one, `normalScale 0.5`, maps under `anim/` with 3 mips each; it is referenced by exactly one sprite side, whose `frames` are the grid's cells in raster order (one per page, `slots` of them), with one positive integer delay per frame, a `staticFrame` among them, `footV 0.08` and `aspect 1`; `animTotalBytes ≤ 25 165 824`. The serialiser appends the extension after each sprite's existing keys and after `totalBytes`, so `serializeManifest(staticManifest(m))` is byte-identical to the manifest the pipeline wrote before animation existed, and its length is what `totalBytes` counts. The client adapter maps `anim.<side>` → `SpriteFrame.anim` (`frames → rects`, `delays → delaysMs`, `staticFrame`) and `animAtlases` → `AnimAtlasSet`s (`10-render.md` §10.4.1), and binds a species' flipbooks with its static atlas (the zone's legendary statics, the party, every species bound on demand).

### 40.1.6 Encoding decision for the ≤ 35 MB budget

**40.1.6.1 Measured.** `tsx src/cli.ts bench --count 4` (cached 1024² sprites, `ktx2-encoder@0.6.0` UASTC LDR effort 2 + Zstandard, no RDO, versus `sharp` lossless WebP effort 6):

| sprite | map | KTX2 UASTC+zstd | WebP lossless | KTX2 PSNR (opaque px) | KTX2 max err | edge px err > 16 |
|---|---|---|---|---|---|---|
| abysspark | albedo / normal | 231 / 217 KB | 145 / 161 KB | 38.2 / 35.4 dB | 80 / 96 | 17.7 / 31.1 % |
| abyssrake | albedo / normal | 358 / 335 KB | 202 / 237 KB | 41.3 / 40.3 dB | 81 / 99 | 10.5 / 10.9 % |
| acier | albedo / normal | 149 / 177 KB | 77 / 116 KB | 43.3 / 38.4 dB | 56 / 97 | 6.2 / 18.8 % |
| alloylark | albedo / normal | 253 / 241 KB | 148 / 166 KB | 39.1 / 37.2 dB | 72 / 90 | 24.6 / 24.7 % |
| **total** | | **1 961 KB** | **1 252 KB** | | | |

and the probe: `KTX2 at 4096px: unsupported — Total source texels 16777216 exceed the encoder limit of 12582912 (~12 Mpix across all 1 slice(s))`. Then `tsx tmp/bench-webp.ts` on the 16-sprite `mire_route-0` atlas (edge = a texel with a > 48/255 step to a 4-neighbour; "bad" = channel error > 12):

| map | setting | KB | PSNR | edge bad | interior bad |
|---|---|---|---|---|---|
| albedo | lossless e6 | 5 552 | ∞ | 0.0 % | 0.00 % |
| albedo | nearLossless q80 / q60 / q40 | 5 134 / 4 577 / 4 223 | 43.1 / 37.6 / 33.3 | 0.3 / 1.1 / 2.7 % | 0.05 / 0.14 / 0.30 % |
| albedo | lossy q95 / q90 / **q85** / q80, alphaQuality 100 | 1 957 / 1 414 / **1 168** / 1 021 | 40.5 / 38.5 / 37.6 / 36.8 | 8.2 / 13.6 / 16.6 / 20.6 % | 0.56 / 1.05 / 1.63 / 2.49 % |
| normal | lossless e6 | 4 852 | ∞ | 0.0 % | 0.00 % |
| normal | nearLossless q80 / q60 / q40 | 3 941 / 3 329 / 2 869 | 41.4 / 39.3 / 35.9 | 1.6 / 3.4 / 7.4 % | 0.05 / 0.10 / 0.29 % |
| normal | lossy q95 / q90 / q85 / q80 | 1 754 / 1 366 / 1 159 / 1 024 | 37.3 / 36.8 / 35.7 / 35.0 | 56.0 / 57.5 / 65.6 / 69.7 % | 1.12 / 1.38 / 3.05 / 4.53 % |

Whole set today: 196.6 MB lossless WebP for 264 sprites (§40.1.2 table: 482–1 112 KB per sprite for three maps).

**40.1.6.2 Option (a), KTX2 UASTC + zstd — rejected.** (i) The bundled Basis encoder refuses anything over 12 Mpix, so a 4096² atlas cannot be produced at all; 2048² atlases (4.2 Mpix) could. (ii) UASTC is a fixed 1 byte/texel; zstd only removes the transparent blocks. Measured, it is **1.57× larger than lossless WebP** (1 961 vs 1 252 KB), i.e. ≈ 300 MB for the set; RDO at `rdoQualityLevel 2–4` gives 2–3× on this kind of content, still ≥ 100 MB. (iii) Its edge error is already 6–31 % of edge texels at > 16/255 with no RDO. ETC1S was not measured: it stores alpha as a second ETC1S slice quantised in 4×4 blocks, so a 1-texel alpha edge cannot survive exactly, which fails the alpha test below by construction. KTX2 stays the format for **materials** (§40.3) and **model textures** (§40.2.4), where images are ≤ 4.2 Mpix and fully opaque tiles.

**40.1.6.3 Option (b), WebP — chosen, with these settings.**

| Map | Codec | Setting | Per sprite (measured ÷ 16, half-res scaled by the lossless ratio 4 852 → 1 366 / 3.5) | Why |
|---|---|---|---|---|
| albedo | `webp-lossy` | `quality 85, alphaQuality 100, smartSubsample true, effort 6` | 73 KB | near-lossless saves only 8–24 % (5 552 → 4 223 KB at q40) and cannot reach the budget; q85 is the highest q whose set total (§40.6 arithmetic) sits under 35 MB with 3 MB headroom |
| normal | `webp-lossy` | **half resolution** (1024² file for a 2048² atlas, `normalScale 0.5`, lanczos3 downsample of the level-0 normal then renormalised) `quality 90, alphaQuality 100, effort 6` | ≈ 24 KB | the normal's job is Pillar 5 shading plus the 6 px rim bevel (3 px at half res); full-res lossy normals cost as much as albedo (1 366 KB) for detail below the 111 px/m view scale |
| emissive | `webp-lossless` | `lossless true, effort 6`, mask replicated to RGB | ≤ 4 KB | measured on the shipped `mire_route-0` mask (already lossy-decoded, so it carries ringing values): lossy q80 181 KB, lossless 181 KB, 2-colour PNG 49 KB per 16 sprites; the pipeline's mask is exactly two-valued, so lossless WebP lands at or under the 2-colour figure (≈ 3 KB per sprite) and has no ringing — the shader's `em` multiplier stays exactly 0 or 1 |
| mips (all three) | same codec as level 0 | levels 1–3 (1024², 512², 256² for a 2048² atlas), lossy maps at `quality − 10` | ≈ +20 % | box filter in **premultiplied** space, un-premultiplied on write; alpha rescaled per level so that the fraction of texels with `a ≥ 0.5` equals level 0's within 1 % (coverage-preserving, so `alphaTest 0.5` does not thin creatures at distance); the normal chain renormalises |

Budget: `260 × (73 + 24 + 3) KB × 1.20 + 0.8 MB thumbs ≈ 32.0 MB ≤ 35 MB`. <!-- amended 2026-09-24 --> **Measured on the first full v2 run, this arithmetic was 1.5× optimistic:** with 8-bit alpha the bottom rung (q80/q85) was 47.3 MB, because WebP codes alpha losslessly and lanczos-normalised silhouettes carry soft alpha on 3.9 % of texels, which cost a third of every albedo file (level 0, 8 atlases: q85 363 KB/atlas with 8-bit alpha vs 236 KB binary; half-res normal q92 199 vs 117 KB). **Binary alpha is therefore part of stage 6:** every atlas map stores `a ≥ 128 → 255, else 0` (`ALPHA_THRESHOLD`); each mip level keeps exactly the level-0 opaque count per cell (the k texels with the largest footprint alpha, ties broken by 3×3 neighbourhood mean then raster order, each level filtered from the previous binary level so the transparent-footprint rule holds by construction); and the stage-1 transparent-RGB rule is re-applied to the composed albedo atlas, because stage 2's premultiplied lanczos resize leaves the band against the silhouette black. Nothing visible changes: billboards alpha-test at 0.5 (`10-render.md` §10.4.5) and Pillar 6 demands binary edges. Shipped result: **36.25 MB at the top rung, albedo q88 / normal q92**, 65 atlases, 130 species. <!-- amended 2026-10-06 --> Since `PIPELINE_VERSION` 6 (atlases composed from the true-colour sprite cache, §40.1.7): **33.39 MB at the same top rung** — albedo 22.61 MB (was 25.46; lossy WebP had been spending bits on the palette's dither noise), normal 9.50 (9.46), emissive 0.41 (byte-identical). Chroma subsampling (WebP lossy is always 4:2:0) is what produces the 16.6 % edge figure — hue bleeds one texel across a hard colour edge; luma and alpha do not. This is accepted as the cost of the budget and is bounded by the tests below; `10-render.md`'s Pillar 6 test (binary alpha along an edge) is unaffected because alpha is lossless.

**Fallback ladder** (`encode.ts` `selectEncoding` becomes a budget loop, recorded per map in `ManifestMap.quality`): albedo `q88 → q85 → q82 → q80`, normal `q92 → q90 → q85`; the loop encodes the whole set at the top rung and steps the albedo rung down first, then the normal rung, until `totalBytes ≤ 41 156 608` (<!-- amended 2026-10-11: Majin / Tenjin forms --> was 36 700 160); it fails the build below the bottom rung rather than shipping over budget. The ladder never goes *up* automatically — a smaller roster or better compression leaves headroom, it does not raise q (a q change is a reviewed contact-sheet decision, made by editing the ladder constants).

**40.1.6.4 Acceptance tests** (`tools/sprite-pipeline/test/encoding.test.ts`; every decode uses `sharp`, the same libwebp the browsers ship a build of):

1. **Alpha exact, all maps:** decode each level-0 atlas; alpha channel byte-identical to the pipeline's raster. Fails on any texel.
2. **Lossless maps (emissive; lossless normal if the ladder ever falls back to it):** a 64×64 crop centred on a hard edge (the test picks, per sprite, the edge texel with the largest 4-neighbour step) is **bit-identical** after decode.
3. **Near-lossless (kept as the test for any map encoded `nearLossless`, none by default):** the same 64×64 crop has max channel error **≤ 2/255** over texels with `a > 0`.
4. **Lossy albedo:** ~~over the 64×64 crop, texels with `a = 255`: PSNR ≥ 36 dB, share of hard-edge texels with any channel error > 12 **≤ 18 %** (q85 measured 16.6 %), interior share **≤ 2 %**, and no texel's *luma* (Rec. 709) error > 24~~ <!-- amended 2026-09-24: the struck figures were atlas-wide means applied to each sprite's single worst edge crop; at q88 the crop medians are 34.4 dB / 24 % / 3 % --> texels with `a = 255`, per sprite: whole-cell PSNR ≥ 30 dB and worst-edge-crop PSNR ≥ 26 dB; whole-cell hard-edge share with any channel error > 12 ≤ 50 % (≤ 90 % for the 34 pixel-art type-gap species, whose texels are nearly all hard edge: measured 0.39 to 0.85 at q88 <!-- amended 2026-10-26: the type-gap lines (#146–179) -->) and interior share ≤ 15 %; over the set, medians of whole-cell PSNR ≥ 35 dB, edge share ≤ 25 %, interior share ≤ 3 %; worst-edge-crop *luma* error ≤ 40 — hue may bleed, brightness may not. Measured at q88 (`PIPELINE_VERSION` 6, against the true-colour stage raster): whole PSNR min 33.1 / median 38.9, crop PSNR min 30.5 / median 38.0, edge share median 5.5 % / max 34 %, interior median 0.3 % / max 4.5 %, crop luma max 37.6. <!-- amended 2026-10-06: were whole PSNR min 30.7 / median 35.8, crop min 27.1, edge 20 % / 46 %, interior 2 % / 14 % — v5 atlases measured against the dithered palette cache they were built from; the v5 atlases against the true-colour raster measure 30.2 / 35.8 dB. Every bound above is unchanged; the margins grew -->
5. **Lossy normal (half res):** mean angular error of the decoded, upsampled, renormalised normal against the level-0 normal **≤ 6.5°** <!-- amended 2026-10-13: hyoryu (#138) --> (was ≤ 6°: hyoryu_majin's dense crystal spikes put a-065, with ignispectre, at 6.22°) over opaque texels and **≤ 12°** inside the 6 px bevel band (`tmp/bench-normal.ts` `angleErr` is the reference implementation); a flat region still decodes to `(128, 128, 255) ± 2` for ≥ 78 % of its texels (in an atlas with ≥ 1 000 flat texels <!-- amended 2026-10-13: hyoryu (#138) -->: a-065, hyoryu_majin + ignispectre, has 538, 33 % off, its crystal art nearly all edge; every other atlas has 870 to 98 033, at most 16.5 % off) and never beyond ± 12 (≈ 5.4°) <!-- amended 2026-10-11: Majin / Tenjin forms --> (was ≥ 80 %: the re-pairing put thundrix — 29 % of its own flat texels beyond ± 2 — with thornback_tenjin (11 %) in a-071, 20.4 % for the atlas; its old partner starwhim had kept it under 20 %. The angular bounds are unchanged; a re-pairing or an encoder change can restore 80 %) <!-- amended 2026-09-24: was "± 2" for every texel; measured q92: 1–16 % of flat texels beyond ± 2, max 10; angular means 3.3° median / 5.9° max, band 7.5° / 11.0° --> <!-- amended 2026-10-06: against the true-colour level-0 normal (PIPELINE_VERSION 6) 3.3° median / 5.98° max (a-050, starwhim + thundrix), band 7.3° / 11.3°; the v5 normal atlases measure the same 5.98° against it, so the 0.07° is the palette-quantised reference having hidden error, not the encode. The ≤ 6° bound holds with 0.02° of margin on that one atlas (next: 4.9°) -->.
6. **Mips:** for each level, coverage `|{a ≥ 128}| / |{a > 0 at level 0 downsampled}|` within 1 % of level 0's; no texel with `a = 0` at level 0 in the whole 2×2 footprint has `a > 0`.
7. **Transparent RGB:** ~~every `a = 0` texel within 2 px (chamfer) of an opaque texel decodes to the nearest opaque RGB ± 12~~ <!-- amended 2026-09-24 --> the atlas raster gives every `a = 0` texel within 2 px (chamfer) of an opaque texel the nearest opaque RGB (stage-1 rule, re-applied after composition); after decoding, the mean luma error over those texels is ≤ ~~35~~ 45 per atlas <!-- amended 2026-10-08: castlemaw (#136) -->. The original claim did not survive measurement: lossy libwebp rewrites RGB under `a = 0` texels beyond the fully transparent 8×8 blocks, and `sharp` exposes no `exact` flag (measured mean band luma error 6.8–31.3 per atlas; with 138 entries 6.8–38.8 per atlas and ≤ 43.1 per sprite, the worst `hollowmane_rage` front, whose thin white mane strands put the most bright texels on the band). An atlas mean never exceeds its worst sprite's, so the bound sits over the worst sprite and does not depend on which two species the planner pairs. At magnification the sprite samples `NearestFilter` so these texels are never read; at minification they are mixed into the outermost texel ring with weight < 0.5.

**40.1.6.5 Thumbnails.** `thumbs/<id>_front.webp`: the level-0 front sprite cropped to its alpha bbox, lanczos3 to 128 px on the longest edge, lossy `q80`, `alphaQuality 90`; asserted ≤ 6 KB each (`20-client.md` §20.10.2 rule 6). 130 files, ≈ 0.6 MB.

### 40.1.7 Determinism and cache

- `determinism.test.ts` (§50.4.8): `runBuild` twice with `--force` over a 6-sprite fixture set → every atlas, mip, thumb, `creatures.manifest.json` and `qa-report.json` byte-identical; a third run without `--force` reports `cacheHits === 12` (6 species × 2 sides). Byte-identity holds because `sharp`'s WebP encoder is deterministic for fixed input + options + `effort`, the MaxRects packer has no randomness, the planner walks `ZONE_ORDER` and sorted ids, and no output carries a timestamp.
- Cache keys (§40.1.2) gain the frame-select entry, the alpha override, and — for atlas files — the ladder rung actually used, so a rung change rebuilds only the atlases it touches while the sprite stages stay cached.
- `PIPELINE_VERSION` is bumped for: the stage-1 transparent-RGB rule, the alternate-style exclusion, footV-from-bottom, the 2048² cell, the mip chain, the codec change. Every existing `.cache/sprites/*` entry is therefore invalid and one full rebuild (~25 min at `CONCURRENCY 3` on the machine that produced the current output) follows.
- **Cache format; `SPRITE_STAGE_VERSION` 4, `PIPELINE_VERSION` 6** <!-- added 2026-10-06 -->. `SPRITE_STAGE_VERSION` (the per-sprite key and the anim side key) is bumped when stages 1–4 *or the stored form of their output* change; `PIPELINE_VERSION` (atlas file keys, `manifest.pipelineVersion`) when an atlas file changes. Sprite-cache versions 1–3 wrote `png({ compressionLevel: 6, effort: 4 })`; sharp's `effort` implies `palette: true`, so every cached albedo and normal was a ≤ 256-colour dithered palette copy of the stage output, and every static atlas of `PIPELINE_VERSION` 2–5 was composed from those copies under the lossy WebP. Measured on the front sprites of auroracle, lumyth, dreambud and umbrit: 254–255 distinct RGBA values in the cache vs 15 k–198 k in the stage output, RGB PSNR on opaque texels 36.1 / 32.9 / 38.6 / 48.1 dB; across the set the palette's alpha also moved 141 560 level-0 silhouette texels (0.16 %) across the 128 threshold. Both caches now write `losslessPng` (§40.1.2), and `test/cache.test.ts` asserts a bit-exact round trip. The 2026-10-06 cold rebuild (47 min at `--jobs 6` on 16 threads: ≈ 19 min static, ≈ 28 min flipbooks) shipped the static set at the same top rung, **33.39 MB** (was 36.20; §40.1.6.3); against the true-colour stage raster the shipped albedo's whole-cell PSNR is median 38.9 dB / min 33.1 (the v5 atlases: 35.8 / 30.2), better for 252 of 260 sprites (median +2.9 dB, up to +9.1 for zaptus front), and 0.05–1.9 dB lower for 8 flat-block pixel-art sprites (bogmaw, wooltug, kygra, acier, trenchtusk; lowest 36.4 dB) where libwebp's adaptive quantiser now spends fewer bits. The emissive mask is two-valued and came through the palette exactly: its 260 files are byte-identical across the rebuild. The flipbooks never went through the palette (§40.1.8); their side key folds in `SPRITE_STAGE_VERSION`, so all 508 pages were recomputed, pixel-identical, and the 240 anim files, `qa/anim-sheet.png` and `qa/anim-report.json` are byte-identical (24 487 809 B at q80 / q80).
- Toolchain: `sharp ^0.34.3` (libwebp 1.5 inside) is pinned by `pnpm-lock.yaml`; a lockfile bump that changes libwebp is treated as a `PIPELINE_VERSION` bump with a contact-sheet review, not as a regression.

### 40.1.8 Animated multiframe sources — flipbooks (added 2026-10-06)

The 10 legendaries and mythicals animated in the original game; the rebuild shipped only their frame-select page (§40.1.3). Every page of the 20 sides now ships as a flipbook next to the unchanged static set (the 65 static atlases, the thumbnails and the static manifest are byte-identical to the build before; `anim.ts`). <!-- amended 2026-10-06: the static set was since rebuilt from the true-colour sprite cache (PIPELINE_VERSION 6, §40.1.7); the flipbooks are byte-identical across that rebuild -->

**Sources** (20 sides, 508 pages): `bankaiser, lumyth, noxmyth, raikitsune, sunjaw, voidraxis, zenryu` — animated WebP, 24 pages, 584–640 px, 125 ms; `galaxion` — GIF, 36 pages, 478–498 × 516–566 px, 100 ms; `glacinid, voltaura` — GIF, 25 pages, 256 px, 100 ms. Delays are sharp's `delay` per page (a missing or < 20 ms delay shows for 100 ms, as browsers do); all sources keep their own alpha.

**One shared normalisation per side, anchored on the static frame.** Stage 1 runs per page at source resolution; the union U of the pages' alpha bboxes is the side's crop. The transform is the static cell's own — `computePlacement` on the frame-select page's bbox (same per-axis scale, horizontal centre and foot line) — applied to U: every page is cropped to U, resampled once to the same size and placed at the same offset on the 1024² master canvas, so a part that does not move in the source does not move by a texel (no jitter, no slide) and the frame-select page lands where the static cell has it (static ↔ flipbook swaps show no jump). Normalising U to its own 0.86 fill instead would have shrunk the creature by up to 11 % (galaxion back: union scale 0.888 × the static one) and lifted its feet, a visible jump on the swap. Under the static transform U fits the cell for all 20 sides (tightest: galaxion back's top at 0.2 texel of the 1024 canvas, sunjaw front's right edge at 989); a side whose U would not fit fails the build.

**Stages 3–4 and the reduction.** The normal and emissive maps run on the master canvas with the static parameters (the static frame's maps equal the static cell's); all three maps are then reduced 2× to the **512² anim cell**: albedo lanczos3 (premultiplied), normal `halfResolutionNormal`, emissive by 2×2 majority. The per-side cache (`.cache/anim/<hash>/pNN.*.png`, key: source bytes, `ANIM_STAGE_VERSION`, `SPRITE_STAGE_VERSION`, sizes, normal and emissive options, the static page, the alpha override) stores true-colour PNGs — a palette-quantised cache would re-dither every page differently and boil between frames. <!-- amended 2026-10-06: was "the static cache's png({ effort }) makes sharp quantise … (found here; the static set is left as it is)"; both caches now share `losslessPng` and the static set was rebuilt from true colour (§40.1.7) -->

**Why 512.** At the battle camera a `sizeScale 1` creature is 374 px tall (§10.4.3); the 10 animated species are `sizeScale` 1.15–1.5, i.e. 430–561 px, their content (0.86 of the card) 370–483 px. A 512 cell puts 440 texels on that: 0.91–1.19 texels per pixel, sharp without magnifying; the overworld (≈ 160 px × sizeScale) minifies it; only the 4 m inspector magnifies (`NearestFilter`, hard texels as Pillar 6 wants, 2 × the static cell's texel). The WebP sources' content is 547–628 px, so 512 keeps 75–83 % of their linear detail; the 256 px GIFs are upscaled 1.8–2.3×. 1024 would cost ≈ 4× the bytes; 448 would magnify the largest (voidraxis) in battle.

**Packing and stage 6.** One atlas per side, a cols × rows grid in page order with the fewest empty cells (24 pages → 6 × 4 = 3072 × 2048, 25 → 5 × 5 = 2560², 36 → 6 × 6 = 3072²), ≤ 8192 per edge (the minimum `maxTextureSize`, §10.1.1), so a playing animation never switches texture or material. Then exactly the static stage 6: binary alpha, the transparent-RGB rule re-applied, half-resolution normal (256² per cell), coverage-preserving mips 1–3 per cell, WebP (`anim/<species>-<side>.{albedo,normal,emissive}[.m1–3].webp`, 240 files).

**Ladder** (`ANIM_EXTRA_RUNGS`): the static ladder, then albedo / normal q80/q80, q78/q80, q75/q80, q75/q75, the first under the anim ceiling shipping. Measured (`qa/anim-report.json`): q88/q92 32.92 MB, q85/q92 30.27, q82/q92 28.68, q80/q92 27.61, q80/q90 26.84, q80/q85 25.38 (still over 24 MiB: 508 frames are twice the static sprite count and a 512² reduction keeps ≈ 45 % of a painted 1024² cell's bytes), **q80/q80 24.49 MB shipped** (<!-- amended 2026-10-26: astaroth (#180) --> with astaroth's two flipbooks, back 18 pages and front 32 from the user's videos: 22 sides, 558 frames, **25.64 MB** (25 639 308 B) at the same q80 / q80 rung, under the 25 MiB ceiling the user chose over a lower rung; astaroth's own share ≈ 1.15 MB; before it): albedo 19.73 MB + normal 4.11 + emissive 0.55 + the manifest's anim share 0.10 = 24 487 809 B (23.35 MiB). Per species (both sides): galaxion 3.53 MB, sunjaw 3.14, bankaiser 2.87, raikitsune 2.72, zenryu 2.62, glacinid 2.24, voltaura 2.02, voidraxis 1.91, lumyth 1.90, noxmyth 1.44. The normal map steps down first: it is seen only through lighting at half resolution, and q92 → q80 halves it.

**GPU memory** per bound side (RGBA8 albedo + RGBA8 half-resolution normal + R8 emissive, 4 levels, the `AtlasCache` estimate): ≈ 50 MB at 3072 × 2048, 52 MB at 2560², 75 MB at 3072² — a side costs about 1.5–2.4 static atlases. The client binds both sides of a species with its static atlas (§40.1.5); a zone with two legendary statics (`galvan_route`) adds ≈ 205 MB, and every animated party member ≈ 100–150 MB (the client never releases atlases, a pre-existing behaviour; see render IMPLEMENTATION-NOTES Part 8).

**QA**: `qa/anim-sheet.png` (every page of every side at 96 px, the shared foot line in red, the static page outlined) and `qa/anim-report.json` (pages, delays, crop, transform, grid, bytes, per-page foot rows). **Tests**: `anim.test.ts` (grid, delays, the transform; a fixture with an animated WebP and a GIF: pages per side, foot line ± 1 texel, zero jitter below a moving part, a bobbing page moves by exactly its source offset × the shared scale, static ↔ anim alignment IoU > 0.95, the static set byte-identical to a build without animation, budget accounting, determinism + full cache, the strict validator on 16 malformed variants), `anim-output.test.ts` (the shipped flipbooks: pages and delays = the sources', binary alpha and mip sizes in every level, the static page on the foot line ± 1 texel, the pages' union = the placed union crop ± 1.5 texels, static ↔ anim IoU > 0.95 on all 20 sides), `budget.test.ts` (both lines).

---

## §40.2 MODEL PIPELINE — `tools/model-pipeline`

### 40.2.1 Inputs, measured

| Set | Files | Size on disk | Per file | Contents (read from the glTF JSON) |
|---|---|---|---|---|
| `assets-src/models/legendaries/` | `lumyth.glb`, `noxmyth.glb`, `voidraxis.glb`, `zenryu.glb` | 8.8 MB | 2.0–2.5 MB | 1 mesh, 1 material, 1 skin, 1 clip named `Animation`, **30 000 triangles each** (29 845 for voidraxis), 3 embedded `image/webp` textures of 21–204 KB (`EXT_texture_webp`), so 85–90 % of each file is vertex + animation data |
| `assets-src/models/kaykit-adventurers/` (amended 2026-10-05; replaces `quaternius/`) | the KayKit "Adventurers 2.0" free pack as unzipped: `Characters/gltf/{Barbarian,Knight,Mage,Ranger,Rogue,Rogue_Hooded}.glb` + five `*_texture.png`, `Animations/gltf/Rig_Medium/Rig_Medium_{General,MovementBasic}.glb`, `Assets/gltf/*.gltf` (accessories and weapons) | 2.4 MB characters + 1.5 MB clips | 0.34–0.48 MB per character | 6–9 skinned parts per character (body, arms, legs, head, headwear, cape …), **one material and one 1024² gradient-swatch texture** (8 × 4 cells of 128 × 256 px) per character, all on the same 23-joint `Rig_Medium` (identical names, rest pose and inverse bind matrices; a different joint order in every file); 25 clips over the two animation files, in place (no root motion) |
| ~~`assets-src/models/quaternius/`~~ (historical) | **19** `.gltf` (`Casual_Male` … `Viking_Male`; amended 2026-09-25 — the draft said 20, the directory and `@ewa/content` `LOOKS` hold 19) | 36 MB | 1.7–2.2 MB | 1 mesh, 6 materials (flat colours, **0 images**), 3 000–6 800 triangles, 17 clips (`Death, Defeat, Idle, Jump, PickUp, Punch, RecieveHit, Roll, Run, Run_Carry, Shoot_OneHanded, SitDown, StandUp, SwordSlash, Victory, Walk, Walk_Carry`), one buffer embedded as a **base64 `data:` URI** of 0.8–1.0 MB — the 2 MB file is 1.33× base64 inflation of ≈ 0.9 MB of binary, most of it 17 animation clips at full float precision |

The dependencies already declared in `tools/asset-audit/package.json` (`@gltf-transform/core|extensions|functions ^4.5.0`, `meshoptimizer ^0.24.0`) move to `tools/model-pipeline/package.json`; `asset-audit` keeps none of them.

### 40.2.2 Transform sequence (gltf-transform 4.5 `document.transform(...)`, in this order)

```ts
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, quantize, reorder, resample, sparse, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await doc.transform(
  dedup(),                                                    // identical accessors/textures/materials → one
  flatten(),                                                  // node hierarchy without skins is collapsed (no-op on skinned rigs)
  join({ keepNamed: false }),                                 // merges same-material primitives only — and SKIPS skinned nodes (`if (node.getSkin()) continue;`, functions src/join.ts lines 177–178): the KayKit shapes are merged by name-remapped joints in §40.2.3
  prune(),                                                    // unused nodes/accessors/materials
  resample({ tolerance: 1e-4 }),                              // animation keyframes: drops linear-redundant keys
  weld(),                                                     // gltf-transform 4.x weld() is exact (no tolerance argument)
  // [LOD1 only] simplifySkinned(ratio 0.35, error 0.01) — §40.2.3
  reorder({ encoder: MeshoptEncoder, target: 'size' }),       // vertex-cache order
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeColor: 8, quantizeWeight: 8, quantizeGeneric: 12 }),  // KHR_mesh_quantization
  sparse(),                                                   // morph/anim accessors that are mostly zero
  meshoptCompression(),                                       // EXT_meshopt_compression, QUANTIZE method = the tail of meshopt({ level: 'medium' }) — NOT meshopt() itself
);
// textures: §40.2.4, applied after the sequence (gltf-transform's textureCompress has no KTX2 target)
```

<!-- amended 2026-09-25: model-pipeline IMPLEMENTATION-NOTES M2, M3, M5 -->
Three facts of gltf-transform 4.5.0 the first draft got wrong (paths relative to `node_modules/.pnpm/@gltf-transform+functions@4.5.0_*/node_modules/@gltf-transform/functions`): `meshopt()` is a wrapper that runs its own `reorder({ target: 'size' })` and `quantize()` before adding the extension (`src/meshopt.ts` lines 82–93), so after the explicit `quantize(14/10/12/…)` it would re-quantize the 14-bit positions and clone the skin's inverse-bind matrices again — the pipeline applies only its tail (`meshoptCompression()` in `src/transform.ts`); `textureCompress` supports `jpeg | png | webp | avif` only (`TEXTURE_COMPRESS_SUPPORTED_FORMATS`, `src/texture-compress.ts` line 24); and `join()` skips skinned nodes, which every Quaternius primitive is.

Determinism: gltf-transform assigns no random ids; `NodeIO.writeBinary` is byte-stable for the same document, and the pipeline asserts it by encoding twice in `determinism.test.ts`. Characters run the sequence with `prune({ keepAttributes: true })`: a shape ships its UVs without an image (the runtime's atlas samples them), and the default `prune()` drops attributes no texture references (amended 2026-10-05, model-pipeline IMPLEMENTATION-NOTES K3); the legendaries keep `prune()` and their bytes did not change.

### 40.2.3 Per-set rules

**Legendaries** (`10-render.md` §10.7.7 does not cover them; they are overworld statics per `roster-coverage.md` §7 and the arena's `ActorPool` per `10-render.md` §10.7.6): keep the skin and the single clip; the clip is renamed `idle`; `resample` at `1e-4`; 30 000 triangles are **kept for LOD0** and a skinned simplification writes a second GLB `<id>.lod1.glb` (≈ 10 500 tris) used beyond 40 m (same thresholds as `10-render.md` §10.5.7). gltf-transform 4.5's `simplify()` calls the **position-only** `simplifier.simplify` (`src/simplify.ts` lines 176–183), so the pipeline's `simplifySkinned` calls `meshoptimizer` 0.24's `MeshoptSimplifier.simplifyWithAttributes` directly (NORMAL weight 0.5, TEXCOORD_0 1.0, WEIGHTS_0 1.0) and compacts the primitive, so surviving vertices keep JOINTS/WEIGHTS and the skin stays bound. **Error bound 0.01, not 0.001**: at 0.001 (2 mm on a 2 m creature) the simplifier stops at 24 000–28 900 of 30 000 triangles and LOD1 comes out at 505–619 KB against the 0.45 MB line; at 0.01 all four reach 10 435–10 493 tris with an achieved error of 0.0045–0.0081 of the extent (≈ 1 px at 40 m), LOD1 220–248 KB. Texture roles come from the material slots the sources bind (`baseColorTexture`, `normalTexture`, `metallicRoughnessTexture`); the draft's mean-colour heuristic misreads them — the normals average (127, 127, 234) and the third texture is metallic-roughness (mean (254, 28, 1)), there is no emissive map — and survives only as a `normal-suspect` QA cross-check. Output KTX2 per §40.2.4. <!-- amended 2026-09-25: model-pipeline IMPLEMENTATION-NOTES M4, M6 -->

**KayKit characters** (player / NPC looks, `10-render.md` §10.7.7; amended 2026-10-05, replacing the Quaternius rule — model-pipeline IMPLEMENTATION-NOTES K1–K8):

- **Shapes** (`SHAPES`, 15): each a list of parts of up to two KayKit characters (`Knight` body + helmet + cape; a `Ranger` body with a `Knight` head; …), written as ONE skinned primitive with ONE material `character` (no image) on a canonical copy of the rig: every part's vertices are appended with `JOINTS_0` remapped **by joint name** to the canonical order (Knight's) after asserting each file's rig equals it (rest TRS, inverse bind matrices). `joinPrimitives` cannot merge parts of two files, whose joint orders differ. Heads move between bodies because every head samples only the universal skin / hair / eyes cells. Capes, quivers, hats, helmets and visors are in or out per shape.
- **Looks** (`LOOK_DEFS`, exactly `@ewa/content` `LOOKS`; `PALETTE_VARIANTS`, exactly the `look:palette` pairs of `BODIES`): a shape + a palette (named slots → swatch cells per texture, `SLOTS`) + an optional accessory. A palette variant may not recolour skin, hair or beard.
- **Accessories** (`ACCESSORIES`, 5: `mug_full`, `spellbook_closed`, three `shield_*_color`): one rigid mesh each, UVs kept, no image, a hand-slot joint and a slot rotation (KayKit slots point blades forward; a quarter turn about Z stands a mug or a shield upright). Townsfolk hold a mug or a book, soldiers a shield; no weapon ships.
- **Animations**: the clips `Idle_A Walking_A Running_A Jump_Full_Short Hit_A Use_Item` → `idle walk run cheer flinch use`, copied onto a node-only rig (no mesh, no skin: `AnimationMixer` binds tracks by joint name) and written as ONE file; the other 19 clips are not copied. Rest-pose tracks are dropped across the file; `resample` 1e-4. The walk and run **ground speeds** are measured from the planted toe (`gaitSpeed`: the mean backward speed of a toe within 1.5 cm of its lowest point) and written to the manifest.
- **Scale**: one factor for every look, `1.55 m / median(bare-head top of the shapes)` = 0.6819; each look's `heightM` includes its headwear.

### 40.2.4 Texture plan

`TEXTURE_PLAN` (its own step, `encodeTexture` + `applyTextures`, because `textureCompress` has no KTX2 target): sharp decodes and fits each image (Lanczos3); `/baseColor|emissive/` → UASTC, RDO 2.0, sRGB, mips; `/normal|occlusion|metallicRoughness/` → UASTC, RDO 2.0, linear, `isNormalMap` for the normal, mips; the texture gets `image/ktx2`, `KHR_texture_basisu` (required) and an **external** uri `<id>.<role>.<hash8>.ktx2` shared by LOD0 and LOD1. The encoder is the same `ktx2-encoder@0.6.0` Basis module as §40.3.3 with `uastcLDRQualityLevel 0` (pack 2 is larger and 4× slower on these maps) and Basis' own mip generation; it exposes **no Zstandard level** (supercompression is on/off), so the draft's `zstd: 18` is Basis' default level (re-compressing at level 18 measured −1.0 % over all 12 maps). **Resolution ladder** — 1024² UASTC does not fit the 1.2 MB LOD0 line at any RDO setting (lumyth/zenryu maps 1.91–2.31 MB at 1024²; geometry 0.53–0.64 MB), so each legendary takes the first tier whose GLB + textures ≤ 1 258 291 B: (512, 512, 512) → (512, 512, 256) → (512, 512, 128) → (512, 256, 128) → (256, 256, 128) for (base, normal, ORM); measured lumyth/voidraxis tier 0, noxmyth tier 1, zenryu tier 2; no tier fitting fails the build. **Fallback:** when `probeKtx2(2048)` fails on the build machine, textures are written as lossy WebP `q90` with sharp under `EXT_texture_webp`, and `models.manifest.json` records `textures: 'webp'`; CI treats the fallback as a warning, not a failure, until M2, then as a failure. <!-- amended 2026-09-25: model-pipeline IMPLEMENTATION-NOTES M1, M2, M7, M9; ktx2-encoder types/type.d.ts line 37 -->

**Character atlas** (amended 2026-10-05, K4–K5): per look, its body's 1024² swatch texture recoloured cell by cell in OKLab (the target's hue and chroma; each pixel keeps its lightness offset from the cell mean, so the painted gradient survives; chroma fades near white and black), box-downscaled in linear light to a 256² tile (32 × 64 px per cell, cells 4-px block aligned, every vertex UV ≥ 0.6 px inside its cell); the 24 look tiles plus the source tiles the mug and an off-body book need, row-major in an 8 × 4 grid, as ONE 2048 × 1024 UASTC KTX2 (RDO 1, zstd, sRGB, **level 0 only** — a mip would mix 32 swatches per texel and the gradients need none) named `characters/atlas.<hash8>.ktx2`: 47.5 KB (the same atlas as lossless PNG: 116 KB). The WebP fallback writes it lossless.

### 40.2.5 Output and manifest

```
packages/client/public/models/
├─ legendaries/<id>.glb, <id>.lod1.glb      (4 × 2) + <id>.{basecolor,normal,orm}.<hash8>.ktx2
├─ characters/<shape>.glb                    (15; amended 2026-10-05, replaces looks/<look>.glb)
├─ characters/acc_<accessory>.glb            (5)
├─ characters/animations.glb
├─ characters/atlas.<hash8>.ktx2
├─ CREDITS.txt                               (the KayKit licence under a credit line)
└─ models.manifest.json                      (version 2)
```

```ts
export interface ModelEntry {
  readonly url: string; readonly lod1: string | null;
  readonly bytes: number; readonly triangles: number; readonly clips: readonly string[];
  readonly textures: 'ktx2' | 'webp' | 'none'; readonly bounds: { readonly min: [number, number, number]; readonly max: [number, number, number] };
  readonly hash: string;                                     // sha256 of the written GLB
}
/** One written file of the character set (amended 2026-10-05: version 2, the KayKit set). */
export interface CharacterFile { readonly url: string; readonly bytes: number; readonly hash: string }
export interface ShapeEntry extends CharacterFile {
  readonly triangles: number;
  readonly texture: 'barbarian' | 'knight' | 'mage' | 'ranger' | 'rogue';   // the swatch layout its UVs address
  readonly bounds: { readonly min: [number, number, number]; readonly max: [number, number, number] };
}
export interface AccessoryEntry extends CharacterFile {
  readonly triangles: number;
  readonly texture: 'barbarian' | 'knight' | 'mage' | 'ranger' | 'rogue';
  readonly bone: 'handslot.l' | 'handslot.r';
  readonly rotation: readonly [number, number, number];                    // XYZ Euler (radians) in the slot's frame
}
export interface AnimationsEntry extends CharacterFile {
  readonly clips: readonly string[];
  readonly durations: Readonly<Record<string, number>>;
  readonly gaitSpeed: { readonly walk: number; readonly run: number };   // model units / s of the planted toe at time scale 1
}
export interface AtlasEntry extends CharacterFile {
  readonly textures: 'ktx2' | 'webp';
  readonly width: number; readonly height: number;
  readonly columns: number; readonly rows: number; readonly tileSize: number;
}
export interface CharactersEntry {
  readonly rig: 'Rig_Medium';
  readonly scale: number;                                    // world metres per model unit, one factor for every look
  readonly heightM: number;                                  // a bare-headed character's standing height (1.55)
  readonly animations: AnimationsEntry;
  readonly atlas: AtlasEntry;
  readonly shapes: Readonly<Record<string, ShapeEntry>>;
  readonly accessories: Readonly<Record<string, AccessoryEntry>>;
}
export interface LookEntry {
  readonly shape: string;
  readonly tile: number;                                     // atlas tile, row-major
  readonly accessory: string | null;
  readonly accessoryTile: number | null;                     // the look's own tile, or its accessory's source-texture tile
  readonly scale: number;
  readonly heightM: number;                                  // top of the look (headwear included), metres
}
export interface ModelsManifest {
  readonly version: 2;
  readonly legendaries: Readonly<Record<'lumyth' | 'noxmyth' | 'voidraxis' | 'zenryu', ModelEntry>>;
  readonly characters: CharactersEntry;
  readonly looks: Readonly<Record<string, LookEntry>>;      // the 19 @ewa/content LOOKS + the BODIES palette variants (`casual2_male:dusk` …)
  readonly totalBytes: number;
}
```

### 40.2.6 Size targets (asserted by `tools/model-pipeline/test/budget.test.ts`)

| | Input | Target | How the number is reached |
|---|---|---|---|
| One legendary LOD0 | 2.0–2.5 MB | **≤ 1.2 MB** (GLB + its three textures) | measured geometry 0.53–0.64 MB (30 k tris; NORMAL at 10 bits is the largest stream); textures from the §40.2.4 ladder at ≤ 512² (the draft's "1024²–2048² ≈ 0.4–0.6 MB" measured 1.91–2.31 MB at 1024²); one resampled clip |
| One legendary LOD1 | — | ≤ 0.45 MB | 10.5 k tris at error 0.01 (§40.2.3), measured 220–248 KB; same textures **shared by reference** (LOD0 and LOD1 both reference the external KTX2 files; `bytes` counts LOD1's GLB only) |
| 4 legendaries total | 8.8 MB | **≤ 6.5 MB** | 4 × (1.2 + 0.45) |
| One character file (amended 2026-10-05) | 0.34–0.48 MB per KayKit character | **≤ 0.25 MB** | measured: shapes 90–146 KB (5 288–9 651 tris; NORMAL 10 bit and the UVs are the largest streams), accessories 6.6–8.3 KB, the animation file 83 KB (6 clips), the atlas 47.5 KB |
| ~~One Quaternius look~~ (historical) | 1.7–2.2 MB | **≤ 0.25 MB** | binary chunk instead of base64 (−25 %), 7 of 17 clips (−55 %), `resample` (−30 % of the rest), rest-pose tracks dropped, quantized + meshopt geometry; measured 150–217 KB |
| The character set (`characters/`, 24 looks; amended 2026-10-05) | 3.9 MB of sources | **≤ 5.0 MB** | measured 1.79 MB (Quaternius looks were 3.38 MB) |
| **`public/models/` total** | 45 MB | **≤ 12 MB** (§40.6) | measured 7.42 MB (2026-10-05; 8.58 MB with the Quaternius looks, commit e2d6127) |

Runtime: the client loads GLBs with `GLTFLoader` + `MeshoptDecoder` + `KTX2Loader` (`public/basis/basis_transcoder.{js,wasm}`, already present); the character atlas through the same `KTX2Loader` (`10-render.md` §10.7.7). `models.manifest.json` `hash` is the cache key the client's asset store uses; a `?v=<hash8>` query is appended to model urls by the build.

---

## §40.3 MATERIAL BAKE — `tools/material-bake` (new, the fourth tool)

### 40.3.1 What it produces

`10-render.md` §10.2.1 fixes the output: per surface id, three KTX2 maps — `albedo` (RGB, sRGB, UASTC, mips to 1×1), `orm` (R = AO, G = roughness, B = metalness, NoColorSpace, UASTC, mips), `normal` (tangent-space normal from a 3×3 Sobel of the procedural heightfield, NoColorSpace, UASTC, mips) — in **two tiers from one recipe**: `field` at 512² for every surface and `hero` at 1024² for surfaces with `hero: true` (the 6 shared ids, every `triplanar` terrain layer, one signature surface per biome; ≤ 50 world-wide, asserted). There is no 2048² tier. Albedo maximum luminance 0.85; cached by content hash. <!-- reconciled 2026-09-18: OQ-2 decided in 10-render.md §10.2.1 — the single-tier layout was 143 MB against 60 --> The 83 surface ids and their base values are `SURFACES` in `packages/render/src/surfaces/surfaces.ts` (`10-render.md` §10.2.2–10.2.3); the bake imports that table and the recipes through the pure subpath `@ewa/render/surfaces` (§40.0.2 rule 5), and `packages/render/src/materials/surfaces.ts` re-exports the same leaf files. <!-- amended 2026-09-25: the `dist/surfaces.json` export was never built — material-bake IMPLEMENTATION-NOTES D0 -->

The approach is the Table-Clash one (`reference-table-clash-SPEC.md` §2: `TextureSetRequest` with `albedo` painter, `orm` writer, `height` callback, `normalFromHeight`, `packOrm`, `fbm2`/`valueNoise2`/`hash21`), moved from runtime Canvas2D to a Node build step over `Float32Array`s. The runtime `CanvasTexture` path is cut (`10-render.md` §10.11).

### 40.3.2 `SurfaceRecipe` (verbatim, `packages/render/src/surfaces/recipe.ts`, imported by the bake through `@ewa/render/surfaces`)

```ts
export interface ScalarField { readonly width: number; readonly height: number; readonly data: Float32Array }      // row-major, 0..1, pre-zeroed
export interface Rgb   { readonly width: number; readonly height: number; readonly data: Float32Array }      // 3 floats per texel, linear 0..1 (converted to sRGB on write)
export interface Orm   { readonly width: number; readonly height: number; readonly ao: Float32Array; readonly rough: Float32Array; readonly metal: Float32Array }  // pre-filled 1 / 0.5 / 0

export interface Noise {
  hash21(x: number, y: number): number;                          // deterministic, [0,1)
  valueNoise2(x: number, y: number): number;
  fbm2(x: number, y: number, octaves: number, lacunarity?: number, gain?: number): number;   // defaults 2.03 / 0.5
  worley2(x: number, y: number, jitter?: number): { f1: number; f2: number; id: number };   // cells, for stone/scale
  rng(seed: string): () => number;                               // sfc32 seeded from sha256(seed); the only randomness
  periodic(px: number, py?: number): Noise;                      // a view whose lattice wraps with period (px, py); fbm octave frequencies snapped to integral periods (seamless tiles)
}

export interface RecipeCtx {
  readonly id: string; readonly size: number;                    // 512 (field) | 1024 (hero) — the recipe is resolution-independent; every coordinate is in tile units
  readonly metres: number;                                       // physical tile size the texture covers (u = v); repeat is world-constant in the shader
  readonly noise: Noise;
  readonly def: SurfaceDefJson;                                  // SURFACES[id] from @ewa/render/surfaces
}

export interface SurfaceRecipe {
  readonly id: string;
  readonly hero: boolean;                                        // = SurfaceDef.hero; true → bake both tiers (512² + 1024²), false → 512² only
  readonly metres: number;                                       // e.g. 3 for terrain (10-render.md §10.2.4 triplanar 1/3.0), 2 for walls, 1 for small props
  /** Always called first. Writes the heightfield the normal is derived from and that the other two painters may read. */
  height(h: ScalarField, c: RecipeCtx): void;
  /** Paints linear RGB. May read h. The bake clamps luminance to ≤ 0.85 after painting and reports how many texels it clamped. */
  albedo(rgb: Rgb, h: ScalarField, c: RecipeCtx): void;
  /** Writes AO / roughness / metalness in place. May read h. AO defaults to a cavity term derived from h if the recipe leaves `ao` untouched. */
  orm(o: Orm, h: ScalarField, c: RecipeCtx): void;
  /** Sobel gain for normalFromHeight. 0.35 fine pores … 0.9 deep relief. */
  readonly normalStrength: number;
  /** 'repeat' (seamless: the painters are written on a torus, the bake asserts the wrap seam error) or 'clamp'. */
  readonly wrap: 'repeat' | 'clamp';
  /** §40.3.5: per-surface RDO quality scalar when a map is over its byte target (default 2.0). */
  readonly rdo?: number;
}
/** For card surfaces (`SurfaceDef.alphaTest !== null`) the bake passes an Rgb that also carries alpha (pre-filled 1). */
export interface CardRgb extends Rgb { readonly alpha: Float32Array }

export const RECIPES: Readonly<Record<string, SurfaceRecipe>>;  // one per SurfaceId; the bake fails if a SURFACES id has no recipe or vice versa
```

Derivations done by the bake, not by recipes: `normal = sobel3x3(h, normalStrength)` encoded `(128 + n·127)` with OpenGL +Y up; cavity AO `ao *= 1 − 0.6 · saturate((blur(h, σ 6) − h) · 4)` when the recipe did not write `ao`; **seam check** for `wrap: 'repeat'` — the mean absolute neighbour difference **across the wrap** (column `size−1` → column 0, row `size−1` → row 0) of albedo and height may exceed the *largest* mean neighbour difference between two adjacent interior columns (rows) by at most 2/255, else the build fails naming the surface. (The literal "column 0 vs column size−1 ≤ 2/255" fails every textured seamless map, because adjacent texels of a textured map legitimately differ by more than 2/255; a seamless torus scores 0 on the excess metric, a ramp ≈ 1.) The verbatim `Noise` gains `periodic(px, py)` (lattice wrapping with integral octave periods): `fbm2(x·k, …)` with lacunarity 2.03 cannot tile. <!-- amended 2026-09-25: material-bake IMPLEMENTATION-NOTES D3, D6 --> **luminance ceiling** — every albedo texel with Rec. 709 luminance > 0.85 (linear) is scaled down to 0.85 and counted; if more than 5 % of texels were clamped the build fails (the recipe is too bright, fix the recipe); mip chain by 2×2 box filter in linear space for albedo, straight average for ORM, renormalised average for normals.

### 40.3.3 Encoding

`ktx2-encoder@0.6.0` Node API, one call per map:

```ts
// src/encode.ts: encodeKtx2(levels, kind, rdo) calls encodeLevel(level, kind, rdo) once PER MIP LEVEL (each a
// single-level KTX2) with the Basis settings below, then src/ktx2.ts assembles the levels' independently
// supercompressed payloads into one KTX2 (level index, DFD and KVD of level 0, level data smallest first)
const settings = {
  isUASTC: true, isKTX2File: true, needSupercompression: true,    // UASTC LDR + Zstandard
  enableRDO: true, rdoQualityLevel: 2.0,                          // rate-distortion (§40.3.5; measured: not the lever it was assumed to be)
  uastcLDRQualityLevel: 0,                                        // pack level 0: same PSNR on albedo as 2 at ~0.6× the bytes and ~5× the speed
  generateMipmap: false,                                          // the bake supplies the chain (linear-space box filter, see above)
  isPerceptual: kind === 'albedo', isSetKTX2SRGBTransferFunc: kind === 'albedo',
  isNormalMap: kind === 'normal',
};
```

<!-- amended 2026-09-25: material-bake IMPLEMENTATION-NOTES D1, D2 -->
ktx2-encoder 0.6.0 has no per-level input: its only slice setter is `setSliceSourceImage(sliceIndex, …)` with no mip parameter, and Basis refuses mips passed as extra slices ("all source images must be the same resolution and have the same number of mipmap levels"); nor does it expose a Zstandard level (supercompression is on/off, `setKTX2UASTCSupercompression(boolean)`) or Basis' status printer (`setStatusOutput` exists in the wasm but not in `IBasisEncoder`) — so the bake drives the embind `BasisEncoder` directly, one single-level encode per mip, and assembles the container itself; each level is byte-identical to what Basis writes for that image. Basis skips RDO on blocks whose RMS error is above 8 (`setRDOUASTCSkipBlockRMSThresh`), so RDO λ alone barely moves textured maps; `rdoProfile(rdo)` keeps Basis' defaults up to 2.0 and widens the skip and max-RMS-ratio thresholds to 8 × rdo above it. Measured on this repo's recipes (256² crops): cobble albedo pack 2 λ2 0.385 B/texel 48.3 dB vs pack 0 λ2 0.228 B/texel 48.2 dB; cobble normal 0.597 → 0.467 B/texel. `node_modules/.pnpm/ktx2-encoder@0.6.0/node_modules/ktx2-encoder/types/type.d.ts` lines 16, 37, 176–258.

The sizes here (512² = 0.26 Mpix, 1024² = 1 Mpix) are under the 12 Mpix cap measured in §40.1.6.1, so KTX2 is available; there is no WebP fallback for materials — `10-render.md` non-negotiable 2 ("every lit opaque material carries albedo + ORM + normal from KTX2") and the `textures.ktx2Only` audit rule make a fallback pointless. If the encoder is unavailable on a machine the bake fails with the probe message.

### 40.3.4 Output, manifest, cache

```
packages/client/public/materials/
├─ <surface>.field_{albedo,orm,normal}.ktx2                                (83 × 3, 512²)
├─ <surface>.hero_{albedo,orm,normal}.ktx2                                 (≤ 50 × 3, 1024², hero: true only)
├─ placeholder_{albedo,orm,normal}.ktx2                                   (4×4 neutral set, 10-render.md §10.2.3: #808080 / (1, 0.5, 0) / (0.5, 0.5, 1))
└─ materials.manifest.json
```

```ts
export interface MaterialTier {
  readonly albedo: string; readonly orm: string; readonly normal: string;   // urls relative to the manifest
  readonly size: 512 | 1024;
  readonly bytes: number;                                                    // sum of the three files
}
export interface MaterialSetEntry {
  readonly field: MaterialTier;                                              // always present
  readonly hero: MaterialTier | null;                                        // null unless SurfaceDef.hero
  readonly metres: number; readonly wrap: 'repeat' | 'clamp';
  readonly hash: string;                                                     // sha256(recipe source, SurfaceDef JSON, tiers, encoder settingsKey) — the cache key and the client's cache-buster
  readonly albedoClampedPct: number;                                         // texels moved to the 0.85 ceiling (hero tier when present, else field)
}
export interface MaterialsManifest {
  readonly version: 2;
  readonly surfaces: Readonly<Record<string, MaterialSetEntry>>;             // every SurfaceId
  readonly byBiome: Readonly<Record<string, readonly string[]>>;             // 10-render.md §10.2.2 rows (each including the 6 shared ids), for 20-client.md §20.10.3 phase-2 preload
  readonly placeholder: { readonly albedo: string; readonly orm: string; readonly normal: string };
  readonly fieldBytes: number; readonly heroBytes: number; readonly totalBytes: number;
}
```
<!-- reconciled 2026-09-18: two tiers (OQ-2) -->

Cache: `.cache/<hash>/{albedo,orm,normal}.ktx2 + meta.json`. The recipe *source text* is part of the hash (`fs.readFileSync(recipeFile)`), so editing a recipe rebakes exactly that surface. `bake --report` prints per-surface bytes, clamped %, seam error and bake milliseconds; `bake --preview <id>` writes `qa/<id>.png` (albedo | ORM | normal side by side, level 0 and level 3) for the contact-sheet review.

### 40.3.5 Byte arithmetic and the two budgets that bind it

UASTC is 1 byte/texel; a 1024² map with a full mip chain is 1.40 MB before supercompression, a 512² map 0.35 MB. Measured on this repo's encoder for opaque sprite content (§40.1.6.1): zstd alone gives 0.6–0.75 of raw on textured regions. With RDO at `rdoQualityLevel 2.0` Basis documents 2–3× further reduction on tiling noise textures; the bake therefore targets **≤ 0.40 MB per 1024² (`hero`) map** and **≤ 0.10 MB per 512² (`field`) map**, asserted per surface and tier by `tools/material-bake/test/budget.test.ts` from the manifest (a map over target fails with its id; the fix is a higher `rdoQualityLevel` for that surface, recorded in the recipe as `rdo?: number`). <!-- amended 2026-09-24 --> **Measured, RDO does not deliver 2–3× on these maps:** detailed normals stay at 0.4–0.85 byte/texel until quality falls to ≈ 20 dB, so 122 of 363 maps exceed the per-map target. The per-map figures are therefore targets, not gates: a map may exceed its target only if its recipe already carries `rdo: 4` and it stays under 3× the target, and every such map is listed in `tools/material-bake/qa/qa-report.json`. The binding limits are the set budgets below (measured: Mirevale field 3.71 MB ≤ 6 MB, Mirevale hero 7.71 MB, all field 21.92 MB, all hero 33.77 MB, `public/materials/` 55.69 MB ≤ 90 MB).

<!-- reconciled 2026-09-18: OQ-2 decided (10-render.md §10.2.1, 20-client.md §20.10.3): field tier first, hero tier after the first frame; 2048² dropped; the materials ceiling in §40.6 is set from this arithmetic -->
| Set | Maps | Bytes |
|---|---|---|
| Single-tier layout this file replaced (12 terrain at 2048², 71 at 1024², mips) | 249 | 12 × 4.8 + 71 × 1.2 = **142.8 MB** — over every ceiling; the reason the tiers exist |
| Mirevale `field` (15 surfaces × 3 × 0.10) — `20-client.md` phase 2 | 45 | **4.5 MB** ≤ 6 MB |
| Mirevale `hero` (9 surfaces: 6 shared + 3 terrain layers, plus `grove_bark` as the biome signature = 10 × 3 × 0.40) — phase 5 | 30 | **12.0 MB** |
| All 83 `field` | 249 | 83 × 3 × 0.10 = **24.9 MB** |
| All `hero` (≤ 50 surfaces) | ≤ 150 | ≤ 50 × 3 × 0.40 = **60.0 MB** |
| **`public/materials/` total** | ≤ 399 | **≤ 85 MB** → ceiling **90 MB** (§40.6) |

Hero surfaces, world-wide: the 6 shared ids (`cobble plaster timber stone_wall lantern_metal glass_warm`), every `triplanar` terrain layer (≤ 3 per biome × 11 = 33), and one signature surface per biome (`grove_bark`, `lava_crust`, `wet_rock`, `copper_oxide`, `marrow_sandstone`, `vesper_bark_black`, `forge_steel_plate`, `sky_marble`, `sun_marble`, `void_glass`, `rift_shard`) = ≤ 50; `surfaces.ts` marks them `hero: true` and `budget.test.ts` asserts the count. At 3 m tiling, `field` 512² is 170 texel/m = 1.5 texels per screen pixel at the default 111 px/m view, so the first frame is fully textured; `hero` 1024² (341 texel/m) is for the battle push-in (386 px/m) and the 4 m inspector, and arrives in `20-client.md` phase 5 through `MaterialLibrary.preloadHero` — a map re-point on the same material, no new program, no visible pop beyond the mip-level change.

### 40.3.6 The 15 Mirevale-slice recipes (one line each; `metres`, `hero`, `normalStrength` fixed here)

The `size / m` column reads `hero-tier size / metres`; a `1024` surface is `hero: true` and also bakes the 512² field tier, a `512` surface bakes the field tier only. <!-- reconciled 2026-09-18: 2048² terrain → 1024² hero; non-hero props → 512² -->

| id | size / m | strength | Recipe |
|---|---|---|---|
| `grove_bark` | 1024 / 2 | 0.70 | height: vertical fibre `fbm2(x·2, y·18, 5)` warped by `sin(y·6)·0.15` + 40 longitudinal cracks (worley f2−f1 < 0.04 along x) at depth 0.6; albedo `#5a4632` × `(0.8 + 0.4·h)`, moss tint `#4a6b33` where `fbm2(x·3,y·3,3) > 0.62` in the lower 30 % of V; rough 0.78–0.92 = `0.78 + 0.14·(1−h)`; metal 0 |
| `grove_leaf_canopy` | 512 / 1 | 0.45 | 3 overlapping leaf clusters painted as elliptical alpha masks (alpha stored in albedo A; the bake keeps A for cards), vein height `abs(sin(atan2(dy,dx)·7))·0.3`; albedo `#4f7a3a` with per-cluster hue jitter ±6°; rough 0.62; AO 0.7 at the cluster overlaps |
| `grove_moss` | 1024 / 3 | 0.55 | height: `fbm2(x·6, y·6, 6)` + 3 000 small domes (`rng('grove_moss')`, r 4–9 px, h 0.5); albedo `#4a6b33` darkened 20 % in height valleys; rough 0.88; AO cavity default |
| `path_gravel` | 1024 / 3 | 0.80 | height: 5 000 worley pebbles (`f1 < 0.35`, per-cell height 0.4–1.0, edge falloff 3 px) over `fbm2(x·4,y·4,4)·0.3` sand; albedo `#8d8272` with per-pebble value jitter ±12 %; rough 0.80 pebbles / 0.92 sand; wetness handled by the shader |
| `cobble` | 1024 / 2 | 0.85 | height: 8×8 offset-row cobbles (rounded rectangles, corner r 14 px, 6 px mortar at h 0.1, stone top `0.8 + fbm2·0.2`); albedo `#6f6a63` per-stone jitter ±10 %, mortar `#4c4843`; rough 0.55 stone → 0.75 mortar; AO 0.5 in mortar |
| `plaster` | 1024 / 2 | 0.35 | height: `fbm2(x·12,y·12,5)·0.25` trowel texture + 12 hairline cracks (random walks, 1 px, depth 0.5); albedo `#d9cfbb` × `(0.92 + 0.08·fbm2)` (luminance sits at 0.62 linear, under the 0.85 ceiling); rough 0.72; **AO darkens toward the four edges** (`1 − 0.35·smoothstep(0.85, 1, max(|u−.5|,|v−.5|)·2)`) as §10.2.2 asks |
| `timber` | 1024 / 2 | 0.50 | height: planks 4 per tile with 3 px gaps at h 0, grain `fbm2(x·1.5, y·24, 5)` stretched along x, 6 knots with ring compression (the Table-Clash `cabinetWood` ring function, `h = fract(sqrt(dx²+(0.18dy)²)·26 + fbm2·2.4)^0.6`); albedo `#6b4a2e` × `(0.85 + 0.3·grain)`; rough 0.66 |
| `slate_roof` | 512 / 2 | 0.75 | height: 6 courses of overlapping slates (each course offset half a slate, 1.5 px stepped edge at 0.4), per-slate cleavage `fbm2(x·20, y·3, 4)·0.15`; albedo `#3f444c` per-slate value ±8 %, hue ±3°; rough 0.42 dry (shader: 0.18 wet) |
| `thatch` | 512 / 2 | 0.65 | height: 8 000 straw strokes (`rng('thatch')`, length 40–120 px, 1–2 px wide, downward ±8°, additive 0.15 each, clamped), 5 horizontal binding ridges at 0.9; albedo `#a3813f` stroke value jitter ±15 %; rough 0.95 |
| `water_pond` | 512 / 4 | 0.35 | height: two ripple fields `sin(k·x + fbm2·2)` at 7 and 11 waves per tile summed with weights 0.6/0.4 (the shader scrolls the map; §10.5.6); albedo `#2b5666` flat; rough 0.05; metal 0; `wrap: repeat`, seam-checked |
| `stone_wall` | 1024 / 2 | 0.80 | height: 5 courses of irregular ashlar (worley cells stretched 2:1, mortar 5 px at 0.15, stone tops `0.7 + fbm2·0.3`, chipped corners where `hash21 > 0.8`); albedo `#7d7569` per-stone ±10 %, mortar `#5a544c`; rough 0.70; AO 0.55 in mortar |
| `lantern_metal` | 1024 / 1 | 0.40 | height: 2 px brushed streaks along y (`fbm2(x·64, y·2, 3)·0.2`) + 24 rivet domes on a grid (r 10 px, h 1.0); albedo `#2e2a26` streak value ±4 %; rough 0.45, 0.30 on rivets; **metal 0.85** everywhere |
| `glass_warm` | 1024 / 1 | 0.20 | height: 4 pane bevels (frame 24 px at 1.0, glass 0.5, bevel 8 px); albedo `#ffd9a0` (clamped to 0.85 luminance by the bake — reported, not an error, the emissive term supplies the brightness); rough 0.12 glass / 0.5 frame; metal 0 / 0.8 frame |
| `dirt` | 1024 / 3 | 0.60 | height: `fbm2(x·5, y·5, 6)` + 400 footprint-scale depressions (ellipses 30–60 px, depth 0.3) + 2 000 grit specks (1–2 px, h 0.8); albedo `#6a5238` darker in depressions (wet-look −15 %); rough 0.90 |
| `tall_grass` | 512 / 1 | 0.50 | 3 blade cards painted into one sheet (alpha in albedo A): 60 blades per card as tapered quads (width 8 → 1 px, height 0.7–1.0 of the card), centre vein height 0.6; albedo `#5f8a3c` per-blade hue ±8°, tip lighter +12 %; rough 0.75; the shader adds `vertexColor` tint |

Card surfaces (`grove_leaf_canopy`, `tall_grass`) are the only recipes whose albedo carries alpha; the bake writes their albedo as RGBA UASTC (`alphaTest 0.5` in the shader) and the audit's `materials.threeMaps` still holds.

---

## §40.4 AUDIO PIPELINE — `tools/audio-pipeline`

Today `tools/audio-pipeline/src/cli.ts` is `export {};` with `plan` and `generate` scripts declared in `package.json` and no dependencies. Zero audio files exist (`PLAN.md` — the legacy game synthesised everything in WebAudio). `.design/audio-bible.md` does not exist yet; this section defines the JSON its manifest must be entered in so the bible is data the tool reads, not prose.

### 40.4.1 Source manifest — `.design/audio/manifest.json` (the shape `audio-bible.md` is transcribed into)

```ts
export type AudioKind = 'stem' | 'ambience' | 'sfx' | 'ui';
export type StemLayer = 'base' | 'threat' | 'biome' | 'night';

export interface AudioPrompt {
  readonly text: string;                                   // the generation prompt, plain English
  readonly negative?: string;
  readonly seed: number;                                   // uint32; passed to the provider when it supports one, otherwise folded into the request hash
  readonly durationSec: number;                            // requested length (stems: whole bars, §40.4.4)
  readonly bpm?: number; readonly key?: string;            // stems/ambience only
  readonly instrumental: true;                             // never lyrics
}

export interface ThemeSpec {
  readonly id: string;                                     // theme ids: grove cinder salt storm marrow vesper forge sky capital shrine rift (11 biomes) + battle gym elite champion raid victory
  readonly bpm: number; readonly bars: 8 | 16 | 32; readonly timeSig: 4;
  readonly stems: Readonly<Record<StemLayer, AudioPrompt>>; // 4 prompts sharing bpm/key/bars so the layers stay aligned (20-client.md §20.7.3 starts all four at the same time)
}
export interface SfxSpec {
  readonly id: string;                                     // hit_normal, hit_super, faint, switch, orb_throw, orb_shake, orb_catch, status_burn … ui_click, ui_confirm (the id list 20-client.md §20.7.4 validates at boot)
  readonly bus: 'sfx' | 'ui';
  readonly variants: 1 | 2 | 3 | 4;                        // round-robin clips; each variant re-rolls the seed (seed + i)
  readonly prompt: AudioPrompt;                            // durationSec ≤ 4
  readonly gainDb: number; readonly maxConcurrent: number; // copied to the output manifest
}
export interface AmbienceSpec { readonly id: string; readonly biome: string; readonly prompt: AudioPrompt }   // one per biome, 60 s, looped

export interface AudioSourceManifest {
  readonly version: 1;
  readonly themes: readonly ThemeSpec[];                   // 17
  readonly ambience: readonly AmbienceSpec[];              // 11
  readonly sfx: readonly SfxSpec[];                        // ~120
  readonly zoneThemes: Readonly<Record<string, string>>;   // ZoneId -> theme id, all 21 (validated against @ewa/content ZONE_ORDER)
}
```

`plan.test.ts` (`50-verification-budget.md` §50.4.8) reads this file, so its schema is enforced by zod in `src/schema.ts`; a missing `zoneThemes` key or an unknown theme id fails `plan`.

### 40.4.2 Provider adapter and the key-less `plan`

```ts
export interface GenerationJob { readonly id: string; readonly kind: AudioKind; readonly prompt: AudioPrompt; readonly outWav: string; readonly requestHash: string }
export interface AudioProvider {
  readonly name: string;                                   // e.g. 'elevenlabs-sfx' | 'stable-audio' | 'suno' — chosen in .design/audio-bible.md; PLAN.md open dependency 1
  readonly supports: { readonly seed: boolean; readonly bpm: boolean; readonly maxDurationSec: number };
  /** Reads its API key from process.env[envVar]; returns false (never throws) when it is unset. */
  configured(): boolean;
  /** Generates one WAV (48 kHz, stereo for stems/ambience, mono for sfx). Retries 3× with backoff on 429/5xx; throws on 4xx. */
  generate(job: GenerationJob, signal: AbortSignal): Promise<void>;
}
```

Commands (`tsx src/cli.ts <plan|generate|process|all>`):

- **`plan`** — needs no key. Expands the source manifest into the job list (one job per stem × theme = 68, one per ambience = 11, one per sfx variant ≈ 250), computes each `requestHash = sha256(provider.name, kind, JSON(prompt))`, diffs against `.cache/audio/jobs.json`, and writes `qa/plan.json` (`{ total, cached, toGenerate, estimatedSeconds, estimatedCost: null }`). Exit 0. This is the command CI runs; it proves the manifest is well-formed without spending anything.
- **`generate`** — runs the uncached jobs through the provider. When `provider.configured()` is false it prints `audio-pipeline: EWA_AUDIO_API_KEY not set — skipping generation (N jobs pending); run plan to see them` and exits 0 (the `50-verification-budget.md` test "skipped with a clear message when no API key is set" reads that line). Raw WAVs land in `.cache/audio/raw/<requestHash>.wav` and are never committed.
- **`process`** — §40.4.3–40.4.5 over every cached WAV; writes `public/audio/`. Needs `ffmpeg` (§40.4.5).

### 40.4.3 Normalise

Loudness is measured with ITU-R BS.1770-4 integrated LUFS (ffmpeg `loudnorm` first pass, `print_format=json`) and applied as a **static gain** (not the two-pass dynamic `loudnorm`, which alters the envelope and breaks loop points): stems and ambience to **−16 LUFS** integrated, sfx and ui to **−20 LUFS**; then true-peak is checked with `ebur128=peak=true` and a clip is rejected (job re-run with `seed + 1000`) when its true peak after the gain would exceed **−1 dBTP** for stems or **−3 dBTP** for sfx (`20-client.md` §20.7.2 "sfx peaks ≤ −3 dBTP"). The measured post-gain LUFS is written to the manifest as `lufs`; `plan.test.ts` asserts `|lufs + 16| ≤ 1` on a synthetic fixture.

### 40.4.4 Loop points by autocorrelation (stems and ambience)

Stems are generated a little longer than the loop (`durationSec = bars × 4 × 60 / bpm + 2`). The loop is found, not trusted:

1. Downmix to mono, 48 kHz; compute the onset envelope `e[n]` = half-wave-rectified first difference of the RMS over 10 ms hops.
2. Candidate loop lengths `L` = `bars × 4 × 60 / bpm` seconds ± 2 %, in 1-hop steps.
3. For each `L` and each start `s` in `[0.25 s, 1.0 s]`, score `r(s, L) = Σ e[s + k] · e[s + L + k]` over `k` covering 2 bars, normalised by the energies; pick the `(s, L)` with the maximum normalised autocorrelation.
4. Snap `s` and `s + L` to the nearest zero crossing of the summed stereo signal within ±2 ms, so the seam has no click.
5. Write `loopStartSec = s`, `loopEndSec = s + L`. Reject the stem (regenerate with `seed + 1000`, at most twice) when the peak normalised autocorrelation is < 0.6 or `|L − nominal| > 1 %`.

`plan.test.ts` asserts that on a synthetic 4-bar 120 bpm click-track fixture the detected `L` is within ±5 ms of 8.000 s. Stems of one theme must agree on `L` within 5 ms (they share `bpm`/`bars`); the theme fails otherwise, since `AudioDirector` schedules all four from one loop point.

### 40.4.5 Encode — ffmpeg is a checked prerequisite

`process` first runs `ffmpeg -version` and `ffprobe -version`; if either is missing it exits 1 with `audio-pipeline: ffmpeg not found on PATH (need ≥ 6.0 with libopus and aac); install it and re-run` — nothing else is attempted. (On this machine: `ffmpeg 8.1.2` at `…/WinGet/Packages/Gyan.FFmpeg_…/bin`.) Per clip, two files (`20-client.md` §20.7.4 `url`/`urlFallback`):

| Output | Command (essentials) | Why |
|---|---|---|
| `<id>.webm` | `ffmpeg -i in.wav -c:a libopus -b:a 96k -vbr on -application audio -frame_duration 20 -f webm` (sfx: `-b:a 64k -ac 1`) | Opus in WebM is what `canPlayType('audio/webm; codecs=opus')` tests; `.ogg` Opus is not accepted by Safari's `decodeAudioData`, so the container is WebM, not the task's `.ogg` — same codec |
| `<id>.m4a` | `ffmpeg -i in.wav -c:a aac -b:a 128k -movflags +faststart` | the fallback |

Opus adds 312 samples of encoder delay (6.5 ms at 48 kHz). Browsers trim that pre-skip in `decodeAudioData` (WebM `CodecDelay`), so the decoded buffer starts at the first input sample and `loopStartSec`/`loopEndSec` are written **unshifted**; the m4a fallback's AAC priming is removed by its edit list. <!-- amended 2026-10-06: Phase E4 measurement, see CHANGELOG --> Determinism: ffmpeg's Opus/AAC encoders are deterministic for identical input and flags; `-fflags +bitexact -flags:a +bitexact` strips the encoder tag and date so the files hash-stable.

### 40.4.6 Output — `public/audio/manifest.json` (the exact `20-client.md` §20.7.4 shape, produced here)

The output manifest type is **`20-client.md` §20.7.4 `AudioManifest`/`AudioClipRef`/`StemRef`, verbatim** — this section does not restate the block (§50.7 rule 5: one definition per identifier). `builtAt` is the one non-deterministic field in any manifest (`20-client.md` requires it; §40.4.7 excludes it from the determinism diff). <!-- reconciled 2026-09-18: the duplicate block here differed from 20-client.md's in a comment and was removed -->

`bytes` is the `.webm` size; `hash` is `sha256(webm bytes)` and doubles as the cache-buster (`?v=<hash8>`). Layout: `public/audio/themes/<theme>/<layer>.{webm,m4a}`, `public/audio/ambience/<biome>.{webm,m4a}`, `public/audio/sfx/<id>_<n>.{webm,m4a}`, `public/audio/manifest.json`.

### 40.4.7 Determinism and budget

`determinism.test.ts`: `process` twice over the same `.cache/audio/raw` → every file byte-identical and the manifest identical after deleting `builtAt`. Budget (§40.6, ≤ 80 MB): 68 stems × 32 bars at 120 bpm = 64 s × 96 kb/s = 0.77 MB + 1.0 MB AAC ≈ 1.8 MB each → 122 MB — **over**. Decision: stems are **16 bars** by default (`bars: 16` unless the bible says 32 for `battle`/`champion`), Opus 96k + AAC 112k → 68 × (0.38 + 0.45) = 56 MB; ambience 11 × 60 s × (0.72 + 0.84) = 17 MB; sfx 250 × ~1.5 s × (12 + 21 KB) ≈ 8 MB. **≈ 81 MB → the AAC fallback for ambience drops to 96k (−1.3 MB) and the raid/victory themes to 8 bars (−1.6 MB): 78 MB.** `budget.test.ts` asserts `Σ bytes(webm) + Σ bytes(m4a) ≤ 83 886 080`.

### 40.4.8 CC0 ingest — the provider-free source path <!-- amended 2026-10-06: Phase E4, see CHANGELOG -->

The game's audio comes from CC0 packs (user decision, Phase E4), mapped onto the unchanged source manifest of §40.4.1. A provider key is not needed. Nothing is downloaded by the tool: the packs are fetched by hand, with the user's approval per download, into `assets-src/audio/cc0/` (gitignored, like the other raw sources). The candidate list is `.design/audio/sources.candidates.md`.

**`.design/audio/sources.json`** maps job ids (§40.4.6 layout: `themes/<t>/<layer>`, `ambience/<biome>`, `sfx/<id>_<n>`) to one file each:

- **Required fields:** `file` (path under `assets-src/audio/cc0/`), `licence` (exactly `"CC0-1.0"`; anything else is refused), `author`, `url`.
- **Optional fields:** `title`, `licenceFile`, `trim: [startSec, endSec]`, `gainDb`, `note`, `parts`. A premix (several CC0 files mixed into one under `assets-src/audio/cc0/mix/` by a tool, because a job takes one file) lists its sources in `parts: [{ file, author, url, title?, licenceFile? }]`; the credits then show one row per part instead of the premix. Like the other attribution fields, `parts` never changes the request hash. <!-- amended 2026-10-06: Phase E4 downloads, see CHANGELOG -->
- **Theme-only fields:** `crossfadeSec` (theme entries), and `bpm`, `bars` and `derive` (base entries only).

Keys starting with `$` are comments. Invalid entries are reported and skipped.

**`ingest`** (new command; needs ffmpeg as in §40.4.5):
- For every covered job, it decodes the source (any format ffmpeg reads) to 48 kHz float, applies trim and gain, and writes `.cache/audio/raw/<requestHash>.wav`. The `jobs.json` record is `{ provider: 'cc0', source: { file, sha256, role: 'direct' | 'layer' | 'variant', from? } }`.
- `process --provider cc0` then runs §40.4.3–40.4.6 over these files unchanged, except for the three rules below.
- Coverage, cache hits, missing files, derived jobs blocked by a missing source, and failures go to `qa/ingest-report.json`. A missing file is reported, never thrown.

**Request hash.** `requestHash = sha256(provider.name, kind, JSON(prompt) [, salt])`. The salt exists only for CC0 jobs, so every provider-generated hash is unchanged. For a direct source it is `sha256('cc0', recipe version, sha256(file bytes), JSON(trim, gainDb, bpm, bars, crossfadeSec))`. Derived jobs salt off their source's salt. As a result:
- Swapping a file re-processes exactly the jobs made from it.
- Editing attribution fields re-processes nothing.
- Salted jobs are never re-rolled.

**Shaping:**

| Job | How a CC0 file becomes the §40.4.2 provider contract |
|---|---|
| theme stem | The `trim` region (default: the whole file) is one seamless loop; `crossfadeSec` bakes a seam fade. It is conformed to `bars × 240 / bpm`: time-stretched with ffmpeg `atempo` when within ±6 %, otherwise refused with a message. If the base entry declares `bpm`/`bars`, the theme is re-timed to them (theme `bpm`/`bars` and stem prompt durations; `bars` may be any integer 2–64, since the client reads loop points). The stem is laid out as 0.5 s of the loop's tail, then the loop, repeated to `(bars + 2) × 240 / bpm + 2` s, so §40.4.4 finds the loop with a score of ≈ 1. |
| derived layers | A theme with only a base source (`derive` defaults to true) gets `threat` / `biome` / `night` as ffmpeg-filtered copies of the same periodic signal. Filters are in steady state and the copies are sample-aligned and level-set by RMS under base:<br>• **threat:** the 110 Hz–7 kHz band, slow-attack compressed, gated by a decaying eighth-note pulse locked to the downbeat; −6 dB.<br>• **biome:** above 2.2 kHz, widened, eighth/quarter echoes; −10 dB. The harvested 1 200 Hz low-pass of §20.7.2 removes it.<br>• **night:** below 1 kHz, widened, 1–3-beat echoes; −9 dB. |
| ambience | Trimmed and cut to the bed's `durationSec` (≥ 6.5 s); the 2 s loop fade is §40.4.4's. |
| sfx / ui | Mono, trimmed, faded out to fit the id's `durationSec`. A missing variant of an id that has at least one mapped variant is a sibling pitch-shifted ±1, then ±2 semitones. |

**`process` rules for CC0 sources:**
1. A cached clip with a `cc0` record cannot be re-rolled. A loop or true-peak rejection is flagged and its gain clamped to the ceiling (as for placeholders).
2. A derived layer skips phase alignment and takes the **base layer's static gain**, so the relative levels survive the −16 LUFS normalisation (independent normalisation would lift the −10 dB biome layer into a +6 dB coherent doubling of base).
3. The theme lists those layers in the output manifest as `derived?: ('threat' | 'biome' | 'night')[]`. This is an optional addition to the `20-client.md` §20.7.4 theme entry: absent for generated themes, and ignored by any reader that predates it.

The `AudioDirector` plays derived layers like any layer, never plays a derived layer whose base failed to load, and starts whatever layers a theme ships. `--provider cc0` (or `EWA_AUDIO_PROVIDER=cc0`) changes the other commands:
- `plan` uses the salts and overrides and writes `qa/plan-cc0.json`.
- `generate` declines.
- `all` runs plan → ingest → process.

**Credits.**
- `credits` (also run by `ingest`) writes `assets-src/audio/CREDITS.md` from `sources.json`: one row per file, with title, author, licence, page URL and the jobs it fills, plus the licence texts in `assets-src/audio/licenses/`.
- It also writes `public/audio/CREDITS.txt`, which ships with the client and is linked from Settings → Audio. CC0 needs no attribution; the credits are a courtesy and a provenance record.
- `tools/audio-pipeline/test/ingest.test.ts` covers this section with synthetic fixtures only.

---

## §40.5 ASSET AUDIT — `tools/asset-audit`

Today `src/cli.ts` is `export {};`. The tool is **headless and GPU-free**: it never creates a renderer. It reads the `ZoneDump` JSON that `packages/render`'s `harness:budget --dump` writes (`10-render.md` §10.10.1, verbatim there) and compares it with the caps in `50-verification-budget.md` §50.2.2 and the pillar rules in §50.4.6; a rule failure is a non-zero exit with the rule id and the offending object.

### 40.5.1 Input

`ZoneDump` (`10-render.md` §10.10.1): `zone`, `harvestLevel`, `materials[] { uuid, cls, surface, maps: { albedo, orm, normal }, ktx2 }`, `geometries[] { uuid, type, parameters, triangles, instanced }`, `lights[] { id, type, castShadow, position, housingDistance }`, `sprites[] { atlas, magFilter, anisotropy }`, `counts: BudgetCounts`, `shadowDrawCalls`. The dump is produced per `CameraShot` (4 headings × 3 zoom stops × noon/night × battle on/off = 48 shots for the slice); the audit takes a directory of dumps and reports the worst shot per rule.

### 40.5.2 Rules (each is one function `rule(dump) => Violation[]` in `src/rules/*.ts`, named exactly as `50-verification-budget.md` §50.4.6 lists them)

| Rule id | Assertion | Source of the number |
|---|---|---|
| `budget.counts.drawCalls` | `counts.drawCalls − shadowDrawCalls ≤ 400` (beauty + post; the shadow maps have their own rule) <!-- amended 2026-09-30: audit M2-gym-dusk-7 --> | §50.2.2 |
| `budget.counts.triangles` | `≤ 2 500 000` | §50.2.2 |
| `budget.counts.texturesSize` | `≤ 734 003 200` bytes, read from `RenderStats.textureBytes` (KTX2 counted by level data, not three's 1-byte estimate) | §50.2.2 |
| `budget.counts.renderTargets` / `.programs` | `≤ 41` / `≤ 128` (amended 2026-09-25: 24 / 96 measured impossible) | §50.2.2 |
| `materials.count` | distinct `uuid` with `cls ∉ {debug}` `≤ 48` | §50.2.2, `10-render.md` §10.2.7 |
| `materials.threeMaps` | every material with `cls ∈ {standard, physical, card, character}` and `harvestLevel === 0` has `maps.albedo && maps.orm && maps.normal` | Pillar 2 |
| `materials.albedoCeiling` | every `surface` referenced resolves to a `materials.manifest.json` entry with `albedoClampedPct` present (the ceiling was applied at bake) | `10-render.md` §10.2.1, OQ-4 there |
| `textures.ktx2Only` | every material with `cls ∈ {standard, physical, card, water, emissive}` has `ktx2 === true`; `cls === 'billboard'` (WebP atlases, §40.1.6) and `cls === 'character'` (the KTX2 look atlas, or its 4 × 4 placeholder before it loads, `10-render.md` §10.7.7; amended 2026-10-05) are exempt **by class** — decided in `10-render.md` §10.0.3 rule 4 (reconciled 2026-09-18) | `10-render.md` non-negotiable 2 |
| `materials.threeMaps` exemptions | `cls ∈ {billboard, impostor, decal, character}` and `harvestLevel ≥ 1` | `10-render.md` §10.0.3 rule 4 |
| `geometry.noPrimitives` | no `type ∈ {BoxGeometry, ConeGeometry, IcosahedronGeometry}` and no `SphereGeometry` with `parameters.widthSegments < 24`, at `harvestLevel 0` | Pillar 3 |
| `geometry.noOutlineShells` | no two meshes under the zone root share a geometry `uuid` where one has `material.side === BackSide` and a scale > 1 (the legacy outline-clone trick); `BackSide` materials are allowed only on `cls ∈ {sky}` — the dump gains `geometries[].sharedBy: number` and `materials[].side` for this | legacy-render-audit Q4 (reconciled 2026-09-18) |
| `scatter.instanced` | every geometry whose `kind` is a scatter kind (`10-render.md` §10.5.4 list) has `instanced ≥ 1` (an `InstancedMesh`); every **tree** kind (`tree_*`) lists lod0, lod1, lod2 + `impostor`, every other kind lists the tiers it is drawn at, at least lod0 + lod1 (small kinds are not drawn beyond 90 m and only trees get impostor cards, §10.5.7) <!-- amended 2026-09-30: as written every real dump failed by design — render Part 4 H2, P4-C1 --> | legacy-render-audit Q19 (reconciled 2026-09-18) |
| `lights.count` | `castShadow` lights `≤ 8`, others `≤ 24` | Pillar 4 |
| `lights.housing` | every light has `housingDistance ≤ 0.6` | Pillar 4 |
| `sprites.nearest` | every `sprites[]` entry has `magFilter === 1003 (NearestFilter)` and `anisotropy === 1` | Pillar 6 |
| `shadows.drawCalls` | `shadowDrawCalls ≤ 4 × (12 + 29 + 60 + 40) = 564` | `10-render.md` §10.5.8 |
| `harvest.same` | for a pair of dumps of the same shot at `harvestLevel 0` and `2`, the multiset of `materials[].cls` is identical | `harvest.spec.ts` |

### 40.5.3 Regression gate

`pnpm audit:assets -- --dump <dir> [--baseline .audit/baseline.json] [--write-baseline]` also writes `report.json` `{ zone, worst: Record<rule, number>, violations[] }`. With a baseline present, CI fails on **regression** even under the cap: `drawCalls`, `triangles`, `texturesSize` or `materials.count` growing by more than **5 %** over the baseline's worst shot fails with `regression.<metric> +N %`; a deliberate increase is accepted by committing a new baseline in the same PR (`--write-baseline`), which the reviewer sees. `rules.test.ts` feeds one violating fixture per rule and asserts the rule id in the error; `fixtures/empty-zone.json` passes every rule (`50-verification-budget.md` §50.5 M1 last box).

`tools/asset-audit` also owns the **budget roll-up** over the four manifests (§40.6): `pnpm audit:assets -- --bytes` reads `creatures.manifest.json totalBytes`, `models.manifest.json totalBytes`, `materials.manifest.json totalBytes`, `audio/manifest.json` (summed) and fails on any §40.6 ceiling.

---

## §40.6 OUTPUT LAYOUT UNDER `packages/client/public/` AND THE SIZE BUDGET

```
packages/client/public/
├─ basis/            basis_transcoder.js, basis_transcoder.wasm, README.md   (present; KTX2Loader.setTranscoderPath('/basis/'))
├─ creatures/        atlases/a-NNN.{albedo,normal,emissive}.webp + .m1/.m2/.m3.webp mips, thumbs/<id>_front.webp, creatures.manifest.json,
│                    anim/<species>-<side>.{albedo,normal,emissive}.webp + mips (the 20 flipbooks, §40.1.8; amended 2026-10-06)
├─ models/           legendaries/<id>.glb + <id>.lod1.glb + KTX2, characters/ (15 shapes, 5 accessories, animations.glb, atlas KTX2), CREDITS.txt, models.manifest.json
├─ materials/        <surface>_{albedo,orm,normal}.ktx2 (83 × 3), placeholder_*.ktx2, materials.manifest.json
├─ audio/            themes/<theme>/<layer>.{webm,m4a}, ambience/<biome>.{webm,m4a}, sfx/<id>_<n>.{webm,m4a}, manifest.json
├─ icons/            TABLER-LICENSE.txt + the rank/type SVGs the client ships
├─ fonts/            3 woff2 (20-client.md §20.2.2, ≤ 360 KB)
└─ keyart/           mirevale.jpg (20-client.md §20.9.1; produced by hand, not by a tool)
```

Nothing under `public/` is hand-edited except `keyart/`, `icons/` and `fonts/`; everything else is regenerated by `pnpm sprites`, `pnpm models`, `pnpm materials`, `pnpm audio` (root scripts added to `package.json`), and `pnpm audit:assets -- --bytes` enforces the totals.

| Directory | Ceiling | Asserted by | Basis of the number |
|---|---|---|---|
| `creatures/` (all but `anim/`; amended 2026-10-06) | **≤ 52 MiB** (54 525 952 B; <!-- amended 2026-10-26: the type-gap lines (#146–179) --> 44 MiB / 46 137 344 B from 2026-10-25, <!-- amended 2026-10-25: the Elemutt line (#142–144) --> 41 MiB / 42 991 616 B from 2026-10-24, <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) --> 40 MiB / 41 943 040 B from 2026-10-13, <!-- amended 2026-10-13: hyoryu (#138) --> 39.25 MiB / 41 156 608 B from 2026-10-11, <!-- amended 2026-10-11: Majin / Tenjin forms --> was 35 MiB / 36 700 160 B) | `tools/sprite-pipeline/test/budget.test.ts` | measured (§40.1.6.3 as amended 2026-10-06, `PIPELINE_VERSION` 6): 65 atlases with binary alpha at albedo q88 / normal q92 — albedo 22.61 MB + normal 9.50 MB + emissive 0.41 MB (all levels) + thumbs 0.70 MB + manifest 0.18 MB = **33.39 MB** (33 392 547 B), 3.31 MB under the ceiling; with `hollowmane` and `hollowmane_rage` (2026-10-08): 66 atlases, **34.13 MB**, 2.57 MB under; with `dustcub` and `badlander` (2026-10-08): 67 atlases, **34.71 MB** (34 714 778 B), 1.99 MB under; with `veilpup` and `hollowolf` (2026-10-08): 68 atlases, **35.24 MB** (35 240 384 B), 1.46 MB under; with `castlemaw` and `castlemaw_rage` (2026-10-08): 69 atlases, **35.93 MB** (35 930 846 B), 0.77 MB under; with `lawlander` (2026-10-08): 70 atlases, **36.32 MB** (36 317 929 B), 0.38 MB under; <!-- amended 2026-10-11: Majin / Tenjin forms --> with the 11 Majin / Tenjin forms: 75 atlases, **40.64 MB** (40 637 140 B), 0.52 MB under the raised ceiling — every sprite stays at the top rung (q88 / q92; the 11 entries cost 4.32 MB, ≈ 0.39 MB each, so the user's request to finish without stepping in was met by raising the ceiling rather than dropping every sprite a rung). <!-- amended 2026-10-13: hyoryu (#138) --> With `hyoryu` and `hyoryu_majin`: 76 atlases, **41.59 MB**, 0.43 MB over 39.25 MiB, so the ladder would have dropped every sprite to q85 (38.53 MB); the ceiling was raised to 40 MiB instead, 0.35 MB over this build. <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) --> With `cryptorb`, `ultraze` and `vysion`: 78 atlases, **42.65 MB** (42 646 746 B), 0.71 MB over 40 MiB, so the ladder would have dropped every sprite to q85 (39.51 MB); the user chose to raise the ceiling to 41 MiB instead, 0.34 MB over this build. <!-- amended 2026-10-25: the Elemutt line (#142–144) --> With the Elemutt line (`elemutt`, `katamute`, `ravatar` and its five relic forms): 82 atlases, **45.50 MB** (45 503 822 B) at the top rung, 2.51 MB over 41 MiB; the user chose a raise, and the ceiling went to 44 MiB, the smallest whole MiB that keeps the top rung (0.63 MB over this build). <!-- amended 2026-10-26: kykaiser (#145) --> With `kykaiser`: 82 atlases, **45.79 MB** (45 788 935 B) at the top rung, 0.35 MB under 44 MiB. `public/` totals ≈ 208.8 MB of its 243 MiB line <!-- amended 2026-10-06: was PIPELINE_VERSION 5, albedo 25.46 + normal 9.46 + emissive 0.46 + thumbs and manifest 0.87 = 36.20 MB, built from the palette-dithered sprite cache (§40.1.7); the ladder does not step up, so the headroom is not spent -->. The draft's "73 + 24 + 3 KB × 1.20 ≈ 31.2 MB" was 1.5× optimistic <!-- amended 2026-09-25: stale basis after the 2026-09-24 amendment of §40.1.6.3 --> |
| `models/` | **≤ 12 MB** | `tools/model-pipeline/test/budget.test.ts` | §40.2.6: legendaries ≤ 6.5 + characters ≤ 5.0 + headroom; measured **7.42 MB** (2026-10-05): legendaries 5.61 MB + the KayKit set 1.79 MB (15 shapes 1.62 MB, animations 0.08, atlas 0.05, accessories 0.04) <!-- amended 2026-10-05: KayKit characters replace the Quaternius looks (3.38 MB) --> |
| `materials/` | **≤ 90 MB** | `tools/material-bake/test/budget.test.ts` | §40.3.5: field 24.9 MB + hero ≤ 60 MB = ≤ 85 MB; the single-tier UASTC layout would be ≈ 143 MB and is why the tiers exist <!-- reconciled 2026-09-18: was 60 MB, which the arithmetic could not meet --> |
| `audio/` | **≤ 80 MB** | `tools/audio-pipeline/test/budget.test.ts` | §40.4.7: 78 MB at 16-bar stems |
| `basis/ + icons/ + fonts/ + keyart/` | ≤ 2 MB | `tools/asset-audit --bytes` | transcoder wasm 0.6 MB, fonts 0.36 MB, key art ≤ 0.8 MB |
| `creatures/anim/` (added 2026-10-06) | **≤ 25 MiB** (26 214 400 B; <!-- amended 2026-10-26: astaroth (#180) --> 24 MiB / 25 165 824 B before) | `tools/sprite-pipeline/test/budget.test.ts`, `tools/asset-audit --bytes` | the user-approved separate budget for the animated legendaries (§40.1.8); measured **25.64 MB** with astaroth <!-- amended 2026-10-26: astaroth (#180) -->, **24.49 MB** before (23.35 MiB) at albedo q80 / normal q80: 20 sides, 508 frames — albedo 19.73 MB + normal 4.11 + emissive 0.55 + the manifest's anim share 0.10 (the bytes its anim fields add, counted here so the static line and `totalBytes` stay what they were) |
| **total `public/`** | **≤ 243 MB** (amended 2026-10-06: 219 + the anim line) | `tools/asset-audit --bytes` | sum |

The per-zone *load* budget is a different number and is `20-client.md` §20.10.3's: phase 2 (`field` materials) ≤ 6 MB — Mirevale 4.5 MB, the largest biome set (cinder, 9 + 6 shared = 15) also 4.5 MB — and phase 3 (creature atlases + party + body GLB) ≤ 4 MB. From the shipped manifest (32.52 MB of atlas maps over 65 atlases = **0.500 MB per atlas**, all levels; amended 2026-10-06, was 35.33 MB / 0.544 MB before the true-colour rebuild, §40.1.7), phase 3 is the bound atlases' bytes + the party singles' home atlases not already bound (≤ 6 × ≈ 0.5 MB) + the character set's first shapes, clips and atlas (≈ 0.25–0.5 MB; amended 2026-10-05, was one 0.15–0.22 MB body GLB): Mirevale binds 2 atlases (0.83 MB + GLB), well inside 4 MB; the 8-atlas zones are 3.75 MB (`galvan_route`) and 3.79 MB (`solenne`) before singles and GLB (were 4.15 / 4.17 MB; the earlier "4.35" was 8 × the mean) — 0.21–0.25 MB under the 4 MB phase-3 figure on their own atlases, so one party single or the character set takes them to or over it (it is asserted by `first-frame.spec.ts` on Mirevale only; recommendation R12). The draft's "≈ 4.1 MB cold for the 14-species `hollow_route`" used the pre-measurement 73 + 24 + 3 KB per sprite. The `hero` tier (≤ 12 MB per zone) is phase 5. <!-- amended 2026-09-25: stale arithmetic after §40.1.6.3's measured sizes; bind counts from packages/client/public/creatures/creatures.manifest.json `zones` -->

---

## NON-NEGOTIABLES (this file)

1. Every tool is deterministic: two runs over the same inputs produce byte-identical outputs (`builtAt` in `audio/manifest.json` excepted) and the second run does no image/mesh/audio work (`cacheHits === inputs`).
2. The species set is the 180 ids <!-- amended 2026-10-26: astaroth (#180) --> <!-- amended 2026-10-13: hyoryu (#138) --> <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) --> <!-- amended 2026-10-25: the Elemutt line (#142–144) --> <!-- amended 2026-10-26: kykaiser (#145) --> <!-- amended 2026-10-26: the type-gap lines (#146–179) --> of `@ewa/content` (130 legacy + `.design/additions/species.js`); the sprite manifest has exactly those keys; alternate-style files are excluded and listed, never shipped as pseudo-species.
3. Sprite alpha is bit-exact through encoding (`alphaQuality 100` asserted by decode); the mip chain is pipeline-built, premultiplied-filtered, coverage-preserving, and the client never calls `generateMipmaps` on a creature texture.
4. Every sprite exists once on disk (plus ≤ 6 planner duplicates); `single_<species>` is a runtime crop of `home`, not a file.
5. A QA flag that is not informational and not accepted with a written reason fails the M1 release rule; `leak`, `empty`, `fallback-source`, `missing-side` are never accepted.
6. Material sets are KTX2 UASTC with pipeline-built mip chains; albedo luminance ≤ 0.85; seams ≤ 2/255 for `repeat` surfaces; no runtime `CanvasTexture`.
7. Loudness (−16 / −20 LUFS) and loop points are measured, not trusted; a stem whose autocorrelation peak is < 0.6 is regenerated, not shipped.
8. `ffmpeg` and the KTX2 encoder are checked before work starts; a missing prerequisite is one clear message and exit 1, never a partial output tree.
9. The four directory ceilings in §40.6 are tests; a regression of > 5 % against the committed audit baseline fails CI even under the cap.
10. Licence files travel: `CREDITS.txt` (KayKit, CC0, crediting Kay Lousberg; amended 2026-10-05) and `TABLER-LICENSE.txt` (MIT) are written by the tools and their absence fails the build.

## CUT DELIBERATELY (this file)

| Cut | Reason | Replacement |
|---|---|---|
| KTX2 (UASTC or ETC1S) for creature atlases | UASTC is 1 B/texel and measured 1.57× *larger* than lossless WebP on sprites; the bundled encoder refuses > 12 Mpix; ETC1S quantises the alpha slice in 4×4 blocks and cannot keep a 1-texel edge exact | lossy WebP with lossless alpha + pipeline mips (§40.1.6) |
| Near-lossless WebP for albedo | measured 18–24 % saving at `nearLossless q40–q60` on `mire_route-0` (5 552 → 4 223 KB); cannot reach 35 MB | lossy `q85` with the edge acceptance test |
| Per-zone duplicated 4096² atlases and `single_<species>` files | 140 placements of 72 species + a second 2048² copy of all 130 ≈ 2.7× the bytes of storing each sprite once | 2048² zone-affinity atlases, `zones[]` bind lists, `home` crop (§40.1.4) |
| Shipping the `animations/` sheets | no consumer in `10-render.md`; 15 MB | `CreatureBillboard` poses are uniform writes; the legendaries animate from their multiframe sources instead (§40.1.8, amended 2026-10-06) |
| Runtime sprite variant re-baking | `00-spine.md` §3.7: palettes are uniforms | `hueShift/satMul/lightMul/alphaGlow` userData |
| Per-species hand-tuned emissive masks as a first step | 130 × 2 masks to paint | the §40.1.2 stage-4 rule (HSV value ≥ 0.92, chroma ≥ 0.4, 8 % cap; amended 2026-09-25 — was "threshold 0.72") + `EMISSIVE_OVERRIDES` only where the contact sheet shows a miss |
| Single-tier 1024²/2048² UASTC for all 83 surfaces | ≈ 143 MB against the ceiling | hero 1024² / field 512² tiers (§40.3.5), ≤ 85 MB |
| Two-pass dynamic `loudnorm` | alters the envelope, breaks loop seams | measured static gain |
| `.ogg` Opus container | Safari `decodeAudioData` rejects it | `.webm` Opus + `.m4a` AAC fallback (same codec as the task asked for, different container) |
| GPU in the audit | CI has no GPU | headless `ZoneDump` JSON |
| Pixel-diff gating of atlases across pipeline versions | codec version bumps (libwebp in sharp) would fail every atlas | determinism is asserted within one toolchain lockfile; a toolchain change is a `PIPELINE_VERSION` bump and a reviewed contact-sheet pass |

## OPEN QUESTIONS FOR OTHER SECTIONS — RESOLVED 2026-09-18

<!-- reconciled 2026-09-18: every OQ is decided in the named section; the table stays as the audit trail -->
| Id | To | Decision |
|---|---|---|
| **OQ-1** | `10-render.md` §10.4.1, §10.4.3, §10.0.3 rule 4; `50-verification-budget.md` §50.4.6 | **Accepted in full.** `AtlasSet` is `{ id, albedo/normal/emissive: AtlasMap { url, mips[] }, size: 2048, normalScale }`; ≤ 8 atlases per zone via `manifest.zones`; `SpritePool.bindSingle(set, frame)` crops the `home` atlas with `createImageBitmap`; emissive uploads as R8; `textures.ktx2Only`/`materials.threeMaps` exempt `cls 'billboard'` by class. Creature atlases are WebP because UASTC measured 1.57× larger than lossless WebP, the encoder refuses > 12 Mpix and ETC1S quantises the alpha slice; KTX2 stays for materials and model textures. |
| **OQ-2** | `10-render.md` §10.2.1/§10.2.3; `20-client.md` §20.10.3 | **Two tiers accepted; 2048² dropped.** `SurfaceDef.hero: boolean`; `field` 512² for all 83, `hero` 1024² for ≤ 50; phase 2 loads `field` (Mirevale 4.5 MB ≤ 6 MB), phase 5 loads `hero` through `MaterialLibrary.preloadHero`; `public/materials/` ceiling **90 MB** (§40.6). |
| **OQ-3** | `10-render.md` §10.4.3 | **Accepted.** Textures carry `mipmaps.length === 3`, so `lodMaxClamp` is 3. |
| **OQ-4** | `00-spine.md` §3.10 | **Accepted** as validate rule 11 (`|Z(zone)| ≤ 16`); `dist/content-report.json` carries `perZone` and the bind sets `Z(zone)` for the planner. |
| **OQ-5** | `20-client.md` §20.7.4 | **Accepted**; the client applies no pre-skip offset; stems 16 bars (32 battle/champion, 8 raid/victory). |
| **OQ-6** | `.design/audio-bible.md` (to be written) | **Open — not decidable here.** The bible does not exist; when written it is entered as `.design/audio/manifest.json` in the §40.4.1 shape, and the provider is an `AudioProvider` adapter reading `EWA_AUDIO_API_KEY` (`PLAN.md` open dependency 1). |
| **OQ-7** | `50-verification-budget.md` §50.4.8 | **Accepted**; the pipeline test rows are rewritten there (WebP, `totalBytes`, 68 atlases, `footV 0.08`, `sidemismatch`, model-pipeline and material-bake test files). |
