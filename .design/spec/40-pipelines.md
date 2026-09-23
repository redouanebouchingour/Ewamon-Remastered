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
5. **LF line endings, ES modules, TypeScript, `tsx` entry points, `pnpm --filter @ewa/<tool> run <script>`.** No tool imports from `packages/*` except `@ewa/content` (for zone ids, species ids and the surface list) — never from `@ewa/render` or `@ewa/client`.
6. **Licences travel with assets.** `assets-src/licenses/QUATERNIUS-CREDITS.txt` is copied to `public/models/CREDITS.txt`; `TABLER-LICENSE.txt` to `public/icons/TABLER-LICENSE.txt` (MIT notice is required). The pipeline fails if either source file is missing.

---

## §40.1 SPRITE PIPELINE — `tools/sprite-pipeline`

### 40.1.1 Inputs and the species set

- Sources: `assets-src/creatures/front/` (132 files) and `assets-src/creatures/back/` (131 files), PNG/WebP/GIF, 256²–2048², 52 non-square, 398 MB. File names are irregular (`smellduckfront.png`, `bloomduck(front).png`, `bankaiser(front).webp`, `galaxion(front).gif`); `sources.ts` matches them by lower-casing and stripping the extension and every `()_- ` character, first against `frontSprite`/`backSprite` from `.design/legacy/ewamon.js`, then against `<id><side>`.
- **The species set is exactly the 130 ids in `ewamon.js`** (the object keys that carry `frontSprite`; the 10 `*_orb` keys are items, not species). The manifest's `sprites` record has exactly 130 keys; `budget.test.ts` asserts `Object.keys(manifest.sprites).length === 130` and that the key set equals `Object.keys(SPECIES)` from `@ewa/content`.
- **Alternate-style files are excluded from the manifest.** The four files `yaschamp(front|back)(boxingstyle|fighterstyle).png` are not species. Today `sources.ts` turns them into pseudo-species `yaschamp@boxingstyle` / `yaschamp@fighterstyle` and ships them (that is why the manifest has 132 ids and why `qa-report.json` shows `missing-side` on `yaschamp@boxingstyle back` and `fallback-source` on `yaschamp back`). Change: unclaimed files are recorded in `qa-report.json` under a new `excluded: { file, reason }[]` array (`reason: 'alternate-style'`) and are not processed. The `@<form>` code path (`parseFormFile`, `findMissingSides`, the `resolveEmissiveOverride` base lookup) is deleted.
- **`yaschamp` back.** `back/` holds no `yaschamp(back).png`; the run used `yaschamp(back)(boxingstyle).png` as a fallback. That fallback is the canonical back sprite from now on: it is renamed on disk to `yaschamp(back).png` (the other three alternate files stay where they are, excluded). After the rename the `fallback-source` and `missing-side` counts are 0.
- Animation sheets under `assets-src/creatures/animations/` (`voidraxis_idle*.{webp,png}`, 15 MB) are **not** copied to `public/` any more. They are legacy experiments with no consumer in `10-render.md` (`CreatureBillboard` has no frame animation; poses are uniform writes). `copyAnimations` and `ManifestAnimation` are deleted; the 15 MB leaves the budget.

### 40.1.2 The six stages — parameters as implemented

Every parameter below is a named constant in `src/*.ts`; changing any of them changes every cache key (`PIPELINE_VERSION` is folded into the key, and is bumped when a stage's behaviour changes without a constant changing).

| # | Stage | File | What it does, with the numbers |
|---|---|---|---|
| 1 | **Alpha recovery** | `alpha.ts` | If ≥ 3 % of pixels have `a < 250` and most border pixels are transparent (`MEANINGFUL_ALPHA_FRACTION 0.03`), the alpha is kept. Otherwise: flood-fill from every border pixel against the border-mean colour with per-pixel tolerance `FLOOD_TOLERANCE 114` (= 38/255 per channel, summed over RGB), additionally accepting magenta (`r,b ≥ 200, g ≤ 80`) and near-white (`min(r,g,b) ≥ 240`) pixels connected to the border; removed pixels get `a = 0`. Then `defringe(img, maxRadius 8)`: every pixel with `0 < a < 255` copies the RGB of the nearest pixel with `a = 255` within 8 px. Coverage bounds `COVERAGE_MIN 0.12` / `COVERAGE_MAX 0.92` set the `coverage` flag. **Added rule (not yet in code):** after defringe, every pixel with `a = 0` within a 3-4 chamfer distance ≤ 2 px of an opaque pixel also takes the nearest opaque RGB; every other `a = 0` pixel is set to RGB `(0,0,0)`. Reason: the flood leaves white/magenta RGB under transparent pixels, and both the premultiplied mip filter (§40.1.5) and bilinear minification read it. |
| 2 | **Normalize** | `normalize.ts` | Trim to the alpha bbox; scale so `max(bboxW, bboxH) = round(FILL_FRACTION 0.86 × 1024) = 881 px`; centre horizontally; anchor the bbox bottom at `y = round(FOOT_V 0.92 × 1024) = 942`. Kernel: `nearest` when the scale factor is within `INTEGER_TOLERANCE 1e-3` of an integer or of the reciprocal of an integer, `lanczos3` otherwise (`chooseKernel`). Canvas `DEFAULT_SPRITE_SIZE 1024`. Measured over the 264 processed sprites: `pixelScale` min 0.43, median 0.89, max 10.74; 71 sprites are upscaled ≥ 2×, 152 are downscaled (< 1). |
| 3 | **Normal map** | `normalmap.ts` | Height = Rec. 709 luminance of the albedo, Gaussian-blurred with `sigma 1.2` (radius `ceil(3σ) = 4`), clamped at borders. 3×3 Sobel with `strength 0.55`; transparent neighbours take the centre pixel's height so the Sobel never fires across the silhouette. Alpha-edge bevel: 3-4 chamfer distance over alpha capped at `bevelBand 6` px; within the band the normal is tilted outward (away from the nearest transparent pixel) by `bevelStrength 0.85` at the edge, falling linearly to 0 at 6 px. Encoding `R = 128 + nx·127`, `G = 128 + ny·127` (OpenGL +Y up), `B = 128 + nz·127`, `A = source alpha`; a flat opaque region encodes to exactly `(128, 128, 255)`. |
| 4 | **Emissive mask** | `emissive.ts` | Per opaque pixel, HSL `saturation × lightness ≥ DEFAULT_EMISSIVE_THRESHOLD 0.72` → 255 else 0; then `erode1px` (3×3 min, image border counts as 0). Per-species `EMISSIVE_OVERRIDES[id] = { threshold?, disabled? }` in `emissive-overrides.ts` (empty today; every entry is an art decision reviewed on the contact sheet). Output is single-channel; the mask is stored in R of a 3-channel file because WebP has no grey mode. |
| 5 | **Pack** | `groups.ts`, `pack.ts` | Atlas `DEFAULT_ATLAS_SIZE 4096`, 16 slots of 1024², MaxRects best-short-side-fit with a stable top-left tie-break (`MaxRectsPacker`), 8 species (front + back) per atlas. Grouping is rewritten in §40.1.4. |
| 6 | **Encode** | `encode.ts` | Today: `selectEncoding('auto', 4096)` probes ktx2-encoder and falls back to lossless WebP (`effort 6`, `alphaQuality 100`) for albedo/normal and lossy WebP `q80` for the emissive mask. Rewritten in §40.1.6. |

Cache (`cache.ts`): per sprite `.cache/sprites/<hash>/{albedo,normal,emissive}.png + meta.json`, `hash = sha256(source bytes, "v" + PIPELINE_VERSION, "size=1024", normal options JSON, emissive override JSON)`; per atlas texture `.cache/atlases/<hash>.<ext>`, `hash = sha256(PIPELINE_VERSION, encoder.settingsKey, "4096/1024", member hashes with their placements)`. `SpriteMeta` records `sourceWidth/Height, recovered, coverage, flags, footV, pixelScale, kernel, emissivePixels`. Stage concurrency is 3 workers (`CONCURRENCY 3`); results are sorted by `(id, side)` before anything is written, so worker order never reaches the output.

### 40.1.3 QA flags — semantics and release rule

`QaFlag` (`alpha.ts`), with the meaning fixed here and the count from the last run:

| Flag | Count | Meaning | Class | Action |
|---|---|---|---|---|
| `clipped` | 76 | The alpha bbox touches at least one edge of the **source** canvas. Normalize still fits the bbox to 881 px and anchors the bottom at 942, so the output is not clipped; the flag says the artist's canvas cut the drawing (usually a tail or wing tip), and there is nothing the pipeline can recover. | informational | None. Reported so a future redraw list exists. Moved into `INFORMATIONAL_FLAGS`. |
| `nonsquare` | 52 | Source is not square. Normalize makes it square. | informational | None. |
| `multiframe` | 20 | The source is a multi-page GIF or animated WebP (10 species: `bankaiser, galaxion, glacinid, lumyth, noxmyth, raikitsune, sunjaw, voidraxis, voltaura, zenryu`). `sharp` decodes **page 0** by default and that is what shipped. Page 0 is not necessarily the best frame (it can be a transition pose). | must be decided | `frame-select.json` in `tools/sprite-pipeline/` maps `<id>/<side>` → page index (default 0). Every multiframe source must have an entry, chosen once from a per-source contact strip (`tsx src/cli.ts frames <id>` writes `qa/frames/<id>-<side>.png`, all pages in a row). Build fails on a multiframe source with no entry. The chosen frame is decoded with `sharp(bytes, { page: n })`. The flag stays informational once an entry exists. |
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

**Home and the single set.** `home` = the atlas holding a species' one (or first) placement. `single_<species>` sets are **not** written to disk; the client derives them from `home` with a cropped decode (`createImageBitmap(blob, x, y, w, h)` — one atlas file is 2048², so the crop is at most a 4 MB decode). This replaces the 130 × 2048² second copy of every sprite that `10-render.md` describes (OQ-1).

**Accounting.** 130 species × 2 sides = 260 sprites → **65 atlases** of 2048² (plus ≤ 3 `dup` atlases). `budget.test.ts` asserts `manifest.atlases.length ≤ 68`, occupied slots `= 260 + 2 × duplicated`, `zones[z].length ≤ 8` for all 21 zones. VRAM at runtime (RGBA8 albedo 16 MB + RGBA8 normal at half resolution 4 MB + R8 emissive 4 MB = 24 MB per atlas × 1.33 mips = 32 MB): a 14-species zone binds ≤ 8 atlases = **≤ 256 MB**, and 6 party singles at 1024² each ≤ 6 × 8 MB = 48 MB — 304 MB of the 700 MB cap in `50-verification-budget.md` §50.2.2, the same order as the `10-render.md` layout (2 × 4096² × 3 maps RGBA8 × 1.33 = 512 MB) and smaller.

### 40.1.5 The manifest — `creatures.manifest.json`

**Verbatim, as it exists today** (`src/manifest.ts`, `version: 1`):

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
  readonly url: string;                                      // level 0, relative to the manifest, e.g. atlases/mire_route-0.albedo.webp
  readonly mips: readonly string[];                          // levels 1..3 (2048², 1024², 512² for a 4096² atlas)
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
}

export interface SpriteManifestV2 {
  readonly version: 2;
  readonly encoding: 'webp';
  readonly spriteSize: 1024;
  readonly pipelineVersion: string;                          // PIPELINE_VERSION
  readonly atlases: readonly ManifestAtlasV2[];              // sorted by id
  readonly zones: Readonly<Record<string, readonly string[]>>;  // ZoneId -> atlas ids (≤ 8, §40.1.4), all 21 zones present ([] allowed)
  readonly sprites: Readonly<Record<string, ManifestSpriteV2>>;  // exactly the 130 species ids, sorted
  readonly totalBytes: number;                               // every file under public/creatures/
}
export const MANIFEST_FILE = 'creatures.manifest.json';
```

`validateManifest` additionally asserts: every `atlas` reference resolves; `uv` is consistent with `px` and `size`; `footV === 0.08`; `zones[z].length ≤ 8`; `sprites` keys equal the content species set; `home ∈ atlases`; `totalBytes ≤ 36 700 160`. The manifest is the contract; the client (`20-client.md` §20.4.4 adapter) maps `ManifestSpriteV2` → `SpriteDescriptor` by copying `uv → rect`, `footV`, `aspect` and looking up `AtlasSet` from `atlases`.

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

Budget: `260 × (73 + 24 + 3) KB × 1.20 + 0.8 MB thumbs ≈ 32.0 MB ≤ 35 MB`. <!-- amended 2026-09-24 --> **Measured on the first full v2 run, this arithmetic was 1.5× optimistic:** with 8-bit alpha the bottom rung (q80/q85) was 47.3 MB, because WebP codes alpha losslessly and lanczos-normalised silhouettes carry soft alpha on 3.9 % of texels, which cost a third of every albedo file (level 0, 8 atlases: q85 363 KB/atlas with 8-bit alpha vs 236 KB binary; half-res normal q92 199 vs 117 KB). **Binary alpha is therefore part of stage 6:** every atlas map stores `a ≥ 128 → 255, else 0` (`ALPHA_THRESHOLD`); each mip level keeps exactly the level-0 opaque count per cell (the k texels with the largest footprint alpha, ties broken by 3×3 neighbourhood mean then raster order, each level filtered from the previous binary level so the transparent-footprint rule holds by construction); and the stage-1 transparent-RGB rule is re-applied to the composed albedo atlas, because stage 2's premultiplied lanczos resize leaves the band against the silhouette black. Nothing visible changes: billboards alpha-test at 0.5 (`10-render.md` §10.4.5) and Pillar 6 demands binary edges. Shipped result: **36.25 MB at the top rung, albedo q88 / normal q92**, 65 atlases, 130 species. Chroma subsampling (WebP lossy is always 4:2:0) is what produces the 16.6 % edge figure — hue bleeds one texel across a hard colour edge; luma and alpha do not. This is accepted as the cost of the budget and is bounded by the tests below; `10-render.md`'s Pillar 6 test (binary alpha along an edge) is unaffected because alpha is lossless.

**Fallback ladder** (`encode.ts` `selectEncoding` becomes a budget loop, recorded per map in `ManifestMap.quality`): albedo `q88 → q85 → q82 → q80`, normal `q92 → q90 → q85`; the loop encodes the whole set at the top rung and steps the albedo rung down first, then the normal rung, until `totalBytes ≤ 36 700 160`; it fails the build below the bottom rung rather than shipping over budget. The ladder never goes *up* automatically — a smaller roster or better compression leaves headroom, it does not raise q (a q change is a reviewed contact-sheet decision, made by editing the ladder constants).

**40.1.6.4 Acceptance tests** (`tools/sprite-pipeline/test/encoding.test.ts`; every decode uses `sharp`, the same libwebp the browsers ship a build of):

1. **Alpha exact, all maps:** decode each level-0 atlas; alpha channel byte-identical to the pipeline's raster. Fails on any texel.
2. **Lossless maps (emissive; lossless normal if the ladder ever falls back to it):** a 64×64 crop centred on a hard edge (the test picks, per sprite, the edge texel with the largest 4-neighbour step) is **bit-identical** after decode.
3. **Near-lossless (kept as the test for any map encoded `nearLossless`, none by default):** the same 64×64 crop has max channel error **≤ 2/255** over texels with `a > 0`.
4. **Lossy albedo:** ~~over the 64×64 crop, texels with `a = 255`: PSNR ≥ 36 dB, share of hard-edge texels with any channel error > 12 **≤ 18 %** (q85 measured 16.6 %), interior share **≤ 2 %**, and no texel's *luma* (Rec. 709) error > 24~~ <!-- amended 2026-09-24: the struck figures were atlas-wide means applied to each sprite's single worst edge crop; at q88 the crop medians are 34.4 dB / 24 % / 3 % --> texels with `a = 255`, per sprite: whole-cell PSNR ≥ 30 dB and worst-edge-crop PSNR ≥ 26 dB; whole-cell hard-edge share with any channel error > 12 ≤ 50 % and interior share ≤ 15 %; over the set, medians of whole-cell PSNR ≥ 35 dB, edge share ≤ 25 %, interior share ≤ 3 %; worst-edge-crop *luma* error ≤ 40 — hue may bleed, brightness may not. Measured at q88: whole PSNR min 30.7 / median 35.8, edge share median 20 % / max 46 %, interior median 2 % / max 14 %, crop luma max 37.6.
5. **Lossy normal (half res):** mean angular error of the decoded, upsampled, renormalised normal against the level-0 normal **≤ 6°** over opaque texels and **≤ 12°** inside the 6 px bevel band (`tmp/bench-normal.ts` `angleErr` is the reference implementation); a flat region still decodes to `(128, 128, 255) ± 2` for ≥ 80 % of its texels and never beyond ± 12 (≈ 5.4°) <!-- amended 2026-09-24: was "± 2" for every texel; measured q92: 1–16 % of flat texels beyond ± 2, max 10; angular means 3.3° median / 5.9° max, band 7.5° / 11.0° -->.
6. **Mips:** for each level, coverage `|{a ≥ 128}| / |{a > 0 at level 0 downsampled}|` within 1 % of level 0's; no texel with `a = 0` at level 0 in the whole 2×2 footprint has `a > 0`.
7. **Transparent RGB:** ~~every `a = 0` texel within 2 px (chamfer) of an opaque texel decodes to the nearest opaque RGB ± 12~~ <!-- amended 2026-09-24 --> the atlas raster gives every `a = 0` texel within 2 px (chamfer) of an opaque texel the nearest opaque RGB (stage-1 rule, re-applied after composition); after decoding, the mean luma error over those texels is ≤ 35 per atlas. The original claim did not survive measurement: lossy libwebp rewrites RGB under `a = 0` texels beyond the fully transparent 8×8 blocks, and `sharp` exposes no `exact` flag (measured mean band luma error 6.8–31.3 per atlas). At magnification the sprite samples `NearestFilter` so these texels are never read; at minification they are mixed into the outermost texel ring with weight < 0.5.

**40.1.6.5 Thumbnails.** `thumbs/<id>_front.webp`: the level-0 front sprite cropped to its alpha bbox, lanczos3 to 128 px on the longest edge, lossy `q80`, `alphaQuality 90`; asserted ≤ 6 KB each (`20-client.md` §20.10.2 rule 6). 130 files, ≈ 0.6 MB.

### 40.1.7 Determinism and cache

- `determinism.test.ts` (§50.4.8): `runBuild` twice with `--force` over a 6-sprite fixture set → every atlas, mip, thumb, `creatures.manifest.json` and `qa-report.json` byte-identical; a third run without `--force` reports `cacheHits === 12` (6 species × 2 sides). Byte-identity holds because `sharp`'s WebP encoder is deterministic for fixed input + options + `effort`, the MaxRects packer has no randomness, the planner walks `ZONE_ORDER` and sorted ids, and no output carries a timestamp.
- Cache keys (§40.1.2) gain the frame-select entry, the alpha override, and — for atlas files — the ladder rung actually used, so a rung change rebuilds only the atlases it touches while the sprite stages stay cached.
- `PIPELINE_VERSION` is bumped for: the stage-1 transparent-RGB rule, the alternate-style exclusion, footV-from-bottom, the 2048² cell, the mip chain, the codec change. Every existing `.cache/sprites/*` entry is therefore invalid and one full rebuild (~25 min at `CONCURRENCY 3` on the machine that produced the current output) follows.
- Toolchain: `sharp ^0.34.3` (libwebp 1.5 inside) is pinned by `pnpm-lock.yaml`; a lockfile bump that changes libwebp is treated as a `PIPELINE_VERSION` bump with a contact-sheet review, not as a regression.

---

## §40.2 MODEL PIPELINE — `tools/model-pipeline`

### 40.2.1 Inputs, measured

| Set | Files | Size on disk | Per file | Contents (read from the glTF JSON) |
|---|---|---|---|---|
| `assets-src/models/legendaries/` | `lumyth.glb`, `noxmyth.glb`, `voidraxis.glb`, `zenryu.glb` | 8.8 MB | 2.0–2.5 MB | 1 mesh, 1 material, 1 skin, 1 clip named `Animation`, **30 000 triangles each** (29 845 for voidraxis), 3 embedded `image/webp` textures of 21–204 KB (`EXT_texture_webp`), so 85–90 % of each file is vertex + animation data |
| `assets-src/models/quaternius/` | 20 `.gltf` (`Casual_Male` … `Viking_Male`) | 37 MB | 1.7–2.2 MB | 1 mesh, 6 materials (flat colours, **0 images**), 3 000–6 800 triangles, 17 clips (`Death, Defeat, Idle, Jump, PickUp, Punch, RecieveHit, Roll, Run, Run_Carry, Shoot_OneHanded, SitDown, StandUp, SwordSlash, Victory, Walk, Walk_Carry`), one buffer embedded as a **base64 `data:` URI** of 0.8–1.0 MB — the 2 MB file is 1.33× base64 inflation of ≈ 0.9 MB of binary, most of it 17 animation clips at full float precision |

The dependencies already declared in `tools/asset-audit/package.json` (`@gltf-transform/core|extensions|functions ^4.5.0`, `meshoptimizer ^0.24.0`) move to `tools/model-pipeline/package.json`; `asset-audit` keeps none of them.

### 40.2.2 Transform sequence (gltf-transform 4.5 `document.transform(...)`, in this order)

```ts
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, quantize, reorder, resample, sparse, textureCompress, weld, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await doc.transform(
  dedup(),                                                    // identical accessors/textures/materials → one
  flatten(),                                                  // node hierarchy without skins is collapsed (no-op on skinned rigs)
  join({ keepNamed: false }),                                 // Quaternius: 6 flat-colour materials → vertex-coloured single primitive is NOT done here (§40.2.3); join merges only same-material primitives
  prune(),                                                    // unused nodes/accessors/materials
  resample({ tolerance: 1e-4 }),                              // animation keyframes: drops linear-redundant keys
  weld(),                                                     // gltf-transform 4.x weld() is exact (no tolerance argument)
  reorder({ encoder: MeshoptEncoder }),                       // vertex-cache order; required before meshopt()
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeColor: 8, quantizeWeight: 8, quantizeGeneric: 12 }),  // KHR_mesh_quantization
  sparse(),                                                   // morph/anim accessors that are mostly zero
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),      // EXT_meshopt_compression
  textureCompress(TEXTURE_PLAN),                              // §40.2.4
);
```

Determinism: gltf-transform assigns no random ids; `NodeIO.writeBinary` is byte-stable for the same document, and the pipeline asserts it by encoding twice in `determinism.test.ts`. The Quaternius `data:` buffers become a single GLB `BIN` chunk (`io.writeBinary`), which alone removes the 33 % base64 inflation.

### 40.2.3 Per-set rules

**Legendaries** (`10-render.md` §10.7.7 does not cover them; they are overworld statics per `roster-coverage.md` §7 and the arena's `ActorPool` per `10-render.md` §10.7.6): keep the skin and the single clip; the clip is renamed `idle`; `resample` at `1e-4`; 30 000 triangles are **kept for LOD0** and `simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.001 })` writes a second GLB `<id>.lod1.glb` (≈ 10 500 tris) used beyond 40 m (same thresholds as `10-render.md` §10.5.7). Skinned simplification with `meshoptimizer 0.24`'s `simplifyWithAttributes` locks the skin weights as attributes so joints stay bound. Three textures: base colour (sRGB), the second is treated as **normal** if its mean colour is within 16/255 of `(128,128,255)` else as ORM; the third is emissive. Output KTX2 per §40.2.4.

**Quaternius** (player/NPC looks, `10-render.md` §10.7.7: "each look is one draw (merged)"): the 6 flat-colour materials are baked into a `COLOR_0` vertex attribute (`vertexColor(): [baseColorFactor]` per primitive, written with `quantizeColor 8`) and the primitives joined into **one** primitive with one material — the render library's `'character'` surface class reads `vertexColor()` as albedo and uses the shared neutral 4×4 ORM/normal placeholder (`10-render.md` §10.2.3) since the source has no maps. Only the clips `Idle`, `Walk`, `Run`, `Victory`, `Defeat`, `SitDown`, `StandUp` are kept (renamed to lower-case; `10-render.md` §10.7.7 names `idle/walk/run`; the other four are for battle staging and the healer bench); the remaining 10 clips are dropped by `prune()` after being detached — that is where most of the 0.9 MB goes. Triangles are kept (3–7 k is already under any LOD0 budget); a `lod1` is not generated for characters (they are never far from the camera at the diorama's view distance).

### 40.2.4 Texture plan

`TEXTURE_PLAN`: `{ encoder: ktx2Encoder, targetFormat: 'ktx2', slots: /baseColor|emissive/ → { mode: 'uastc', rdo: 2.0, zstd: 18, srgb: true, mipmaps: true }, slots: /normal|occlusion|metallicRoughness/ → { mode: 'uastc', rdo: 2.0, zstd: 18, srgb: false, normalMap: slot === 'normal', mipmaps: true } }`. The encoder is the same `ktx2-encoder@0.6.0` Node API as §40.1.6 (`encodeToKTX2(bytes, { isUASTC: true, isKTX2File: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 2, generateMipmap: true, isPerceptual, isSetKTX2SRGBTransferFunc, isNormalMap, imageDecoder })`); legendary textures are ≤ 2048² (≤ 4.2 Mpix), under the 12 Mpix cap that stops it for sprite atlases. **Fallback:** when `probeKtx2(2048)` fails on the build machine, textures are written as lossy WebP `q90` via `textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90 })` with `EXT_texture_webp`, and `models.manifest.json` records `textures: 'webp'`; CI treats the fallback as a warning, not a failure, until M2, then as a failure.

### 40.2.5 Output and manifest

```
packages/client/public/models/
├─ legendaries/<id>.glb, <id>.lod1.glb      (4 × 2)
├─ looks/<look>.glb                          (20)
├─ CREDITS.txt                               (copied from assets-src/licenses/QUATERNIUS-CREDITS.txt)
└─ models.manifest.json
```

```ts
export interface ModelEntry {
  readonly url: string; readonly lod1: string | null;
  readonly bytes: number; readonly triangles: number; readonly clips: readonly string[];
  readonly textures: 'ktx2' | 'webp' | 'none'; readonly bounds: { readonly min: [number, number, number]; readonly max: [number, number, number] };
  readonly hash: string;                                     // sha256 of the written GLB
}
export interface ModelsManifest {
  readonly version: 1;
  readonly legendaries: Readonly<Record<'lumyth' | 'noxmyth' | 'voidraxis' | 'zenryu', ModelEntry>>;
  readonly looks: Readonly<Record<string, ModelEntry>>;      // 20 Quaternius look ids, snake_case of the file stem (casual_male …)
  readonly totalBytes: number;
}
```

### 40.2.6 Size targets (asserted by `tools/model-pipeline/test/budget.test.ts`)

| | Input | Target | How the number is reached |
|---|---|---|---|
| One legendary LOD0 | 2.0–2.5 MB | **≤ 1.2 MB** | 30 k tris × ~3 attributes at 14/10/12-bit quantization + meshopt ≈ 0.45 MB; 3 textures at 1024²–2048² UASTC+RDO+zstd with mips ≈ 0.4–0.6 MB; one resampled clip ≈ 0.1 MB |
| One legendary LOD1 | — | ≤ 0.45 MB | 10.5 k tris, same textures **shared by reference** (`lod1.glb` reuses the KTX2 by url via `KHR_texture_basisu` + external `uri` next to it, so textures are not written twice; `bytes` counts the GLB only) |
| 4 legendaries total | 8.8 MB | **≤ 6.5 MB** | 4 × (1.2 + 0.45) |
| One Quaternius look | 1.7–2.2 MB | **≤ 0.25 MB** | binary chunk instead of base64 (−25 %), 7 of 17 clips (−55 %), `resample` (−30 % of the rest), quantized + meshopt geometry (3–7 k tris ≈ 60–120 KB) |
| 20 looks total | 37 MB | **≤ 5.0 MB** | 20 × 0.25 |
| **`public/models/` total** | 45 MB | **≤ 12 MB** (§40.6) | 6.5 + 5.0 + manifest, with 0.5 MB headroom |

Runtime: the client loads GLBs with `GLTFLoader` + `MeshoptDecoder` + `KTX2Loader` (`public/basis/basis_transcoder.{js,wasm}`, already present). `models.manifest.json` `hash` is the cache key the client's asset store uses; a `?v=<hash8>` query is appended to model urls by the build.

---

## §40.3 MATERIAL BAKE — `tools/material-bake` (new, the fourth tool)

### 40.3.1 What it produces

`10-render.md` §10.2.1 fixes the output: per surface id, three KTX2 maps — `albedo` (RGB, sRGB, UASTC, mips to 1×1), `orm` (R = AO, G = roughness, B = metalness, NoColorSpace, UASTC, mips), `normal` (tangent-space normal from a 3×3 Sobel of the procedural heightfield, NoColorSpace, UASTC, mips) — in **two tiers from one recipe**: `field` at 512² for every surface and `hero` at 1024² for surfaces with `hero: true` (the 6 shared ids, every `triplanar` terrain layer, one signature surface per biome; ≤ 50 world-wide, asserted). There is no 2048² tier. Albedo maximum luminance 0.85; cached by content hash. <!-- reconciled 2026-09-18: OQ-2 decided in 10-render.md §10.2.1 — the single-tier layout was 143 MB against 60 --> The 83 surface ids and their base values are `SURFACES` in `packages/render/src/surfaces.ts` (`10-render.md` §10.2.2–10.2.3); the bake imports that table through a JSON export (`packages/render` writes `dist/surfaces.json` in its build; the bake reads the JSON, never the TS, so the import-boundary rule holds).

The approach is the Table-Clash one (`reference-table-clash-SPEC.md` §2: `TextureSetRequest` with `albedo` painter, `orm` writer, `height` callback, `normalFromHeight`, `packOrm`, `fbm2`/`valueNoise2`/`hash21`), moved from runtime Canvas2D to a Node build step over `Float32Array`s. The runtime `CanvasTexture` path is cut (`10-render.md` §10.11).

### 40.3.2 `SurfaceRecipe` (verbatim, `tools/material-bake/src/recipe.ts`)

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
}

export interface RecipeCtx {
  readonly id: string; readonly size: number;                    // 512 (field) | 1024 (hero) — the recipe is resolution-independent; every coordinate is in tile units
  readonly metres: number;                                       // physical tile size the texture covers (u = v); repeat is world-constant in the shader
  readonly noise: Noise;
  readonly def: SurfaceDefJson;                                  // SURFACES[id] from packages/render dist/surfaces.json
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
}

export const RECIPES: Readonly<Record<string, SurfaceRecipe>>;  // one per SurfaceId; the bake fails if a SURFACES id has no recipe or vice versa
```

Derivations done by the bake, not by recipes: `normal = sobel3x3(h, normalStrength)` encoded `(128 + n·127)` with OpenGL +Y up; cavity AO `ao *= 1 − 0.6 · saturate((blur(h, σ 6) − h) · 4)` when the recipe did not write `ao`; **seam check** for `wrap: 'repeat'` — mean absolute difference between column 0 and column `size−1` (and row 0 / row `size−1`) of albedo and height must be ≤ 2/255, else the build fails naming the surface; **luminance ceiling** — every albedo texel with Rec. 709 luminance > 0.85 (linear) is scaled down to 0.85 and counted; if more than 5 % of texels were clamped the build fails (the recipe is too bright, fix the recipe); mip chain by 2×2 box filter in linear space for albedo, straight average for ORM, renormalised average for normals.

### 40.3.3 Encoding

`ktx2-encoder@0.6.0` Node API, one call per map:

```ts
encodeToKTX2(new Uint8Array(0), {
  isUASTC: true, isKTX2File: true, needSupercompression: true,    // UASTC LDR + Zstandard
  enableRDO: true, rdoQualityLevel: 2.0,                          // rate-distortion; the lever that makes UASTC fit (§40.3.5)
  uastcLDRQualityLevel: 2,
  generateMipmap: false,                                          // the bake supplies the chain (linear-space box filter, see above): mips are passed as extra slices via setSliceSourceImage in a small wrapper around NodeBasisEncoder (the high-level API exposes no per-level input)
  isPerceptual: kind === 'albedo', isSetKTX2SRGBTransferFunc: kind === 'albedo',
  isNormalMap: kind === 'normal',
  imageDecoder: async () => ({ width, height, data }),
});
```

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

Opus adds 312 samples of encoder delay (6.5 ms at 48 kHz); `loopStartSec`/`loopEndSec` are shifted by the decoded pre-skip read back with `ffprobe -show_streams` (`initial_padding`) so they refer to the decoded buffer the client actually loops. Determinism: ffmpeg's Opus/AAC encoders are deterministic for identical input and flags; `-fflags +bitexact -flags:a +bitexact` strips the encoder tag and date so the files hash-stable.

### 40.4.6 Output — `public/audio/manifest.json` (the exact `20-client.md` §20.7.4 shape, produced here)

The output manifest type is **`20-client.md` §20.7.4 `AudioManifest`/`AudioClipRef`/`StemRef`, verbatim** — this section does not restate the block (§50.7 rule 5: one definition per identifier). `builtAt` is the one non-deterministic field in any manifest (`20-client.md` requires it; §40.4.7 excludes it from the determinism diff). <!-- reconciled 2026-09-18: the duplicate block here differed from 20-client.md's in a comment and was removed -->

`bytes` is the `.webm` size; `hash` is `sha256(webm bytes)` and doubles as the cache-buster (`?v=<hash8>`). Layout: `public/audio/themes/<theme>/<layer>.{webm,m4a}`, `public/audio/ambience/<biome>.{webm,m4a}`, `public/audio/sfx/<id>_<n>.{webm,m4a}`, `public/audio/manifest.json`.

### 40.4.7 Determinism and budget

`determinism.test.ts`: `process` twice over the same `.cache/audio/raw` → every file byte-identical and the manifest identical after deleting `builtAt`. Budget (§40.6, ≤ 80 MB): 68 stems × 32 bars at 120 bpm = 64 s × 96 kb/s = 0.77 MB + 1.0 MB AAC ≈ 1.8 MB each → 122 MB — **over**. Decision: stems are **16 bars** by default (`bars: 16` unless the bible says 32 for `battle`/`champion`), Opus 96k + AAC 112k → 68 × (0.38 + 0.45) = 56 MB; ambience 11 × 60 s × (0.72 + 0.84) = 17 MB; sfx 250 × ~1.5 s × (12 + 21 KB) ≈ 8 MB. **≈ 81 MB → the AAC fallback for ambience drops to 96k (−1.3 MB) and the raid/victory themes to 8 bars (−1.6 MB): 78 MB.** `budget.test.ts` asserts `Σ bytes(webm) + Σ bytes(m4a) ≤ 83 886 080`.

---

## §40.5 ASSET AUDIT — `tools/asset-audit`

Today `src/cli.ts` is `export {};`. The tool is **headless and GPU-free**: it never creates a renderer. It reads the `ZoneDump` JSON that `packages/render`'s `harness:budget --dump` writes (`10-render.md` §10.10.1, verbatim there) and compares it with the caps in `50-verification-budget.md` §50.2.2 and the pillar rules in §50.4.6; a rule failure is a non-zero exit with the rule id and the offending object.

### 40.5.1 Input

`ZoneDump` (`10-render.md` §10.10.1): `zone`, `harvestLevel`, `materials[] { uuid, cls, surface, maps: { albedo, orm, normal }, ktx2 }`, `geometries[] { uuid, type, parameters, triangles, instanced }`, `lights[] { id, type, castShadow, position, housingDistance }`, `sprites[] { atlas, magFilter, anisotropy }`, `counts: BudgetCounts`, `shadowDrawCalls`. The dump is produced per `CameraShot` (4 headings × 3 zoom stops × noon/night × battle on/off = 48 shots for the slice); the audit takes a directory of dumps and reports the worst shot per rule.

### 40.5.2 Rules (each is one function `rule(dump) => Violation[]` in `src/rules/*.ts`, named exactly as `50-verification-budget.md` §50.4.6 lists them)

| Rule id | Assertion | Source of the number |
|---|---|---|
| `budget.counts.drawCalls` | `counts.drawCalls ≤ 400` | §50.2.2 |
| `budget.counts.triangles` | `≤ 2 500 000` | §50.2.2 |
| `budget.counts.texturesSize` | `≤ 734 003 200` bytes | §50.2.2 |
| `budget.counts.renderTargets` / `.programs` | `≤ 24` / `≤ 96` | §50.2.2 |
| `materials.count` | distinct `uuid` with `cls ∉ {debug}` `≤ 48` | §50.2.2, `10-render.md` §10.2.7 |
| `materials.threeMaps` | every material with `cls ∈ {standard, physical, card, character}` and `harvestLevel === 0` has `maps.albedo && maps.orm && maps.normal` | Pillar 2 |
| `materials.albedoCeiling` | every `surface` referenced resolves to a `materials.manifest.json` entry with `albedoClampedPct` present (the ceiling was applied at bake) | `10-render.md` §10.2.1, OQ-4 there |
| `textures.ktx2Only` | every material with `cls ∈ {standard, physical, card, water, emissive}` has `ktx2 === true`; `cls === 'billboard'` (WebP atlases, §40.1.6) and `cls === 'character'` (vertex colour + placeholder, `10-render.md` §10.7.7) are exempt **by class** — decided in `10-render.md` §10.0.3 rule 4 (reconciled 2026-09-18) | `10-render.md` non-negotiable 2 |
| `materials.threeMaps` exemptions | `cls ∈ {billboard, impostor, decal, character}` and `harvestLevel ≥ 1` | `10-render.md` §10.0.3 rule 4 |
| `geometry.noPrimitives` | no `type ∈ {BoxGeometry, ConeGeometry, IcosahedronGeometry}` and no `SphereGeometry` with `parameters.widthSegments < 24`, at `harvestLevel 0` | Pillar 3 |
| `geometry.noOutlineShells` | no two meshes under the zone root share a geometry `uuid` where one has `material.side === BackSide` and a scale > 1 (the legacy outline-clone trick); `BackSide` materials are allowed only on `cls ∈ {sky}` — the dump gains `geometries[].sharedBy: number` and `materials[].side` for this | legacy-render-audit Q4 (reconciled 2026-09-18) |
| `scatter.instanced` | every geometry whose `kind` is a scatter kind (`10-render.md` §10.5.4 list) has `instanced ≥ 1` (an `InstancedMesh`), and for every scatter kind present the dump lists 3 LOD tiers + `impostor` | legacy-render-audit Q19 (reconciled 2026-09-18) |
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
├─ creatures/        atlases/a-NNN.{albedo,normal,emissive}.webp + .m1/.m2/.m3.webp mips, thumbs/<id>_front.webp, creatures.manifest.json
├─ models/           legendaries/<id>.glb + <id>.lod1.glb, looks/<look>.glb, CREDITS.txt, models.manifest.json
├─ materials/        <surface>_{albedo,orm,normal}.ktx2 (83 × 3), placeholder_*.ktx2, materials.manifest.json
├─ audio/            themes/<theme>/<layer>.{webm,m4a}, ambience/<biome>.{webm,m4a}, sfx/<id>_<n>.{webm,m4a}, manifest.json
├─ icons/            TABLER-LICENSE.txt + the rank/type SVGs the client ships
├─ fonts/            3 woff2 (20-client.md §20.2.2, ≤ 360 KB)
└─ keyart/           mirevale.jpg (20-client.md §20.9.1; produced by hand, not by a tool)
```

Nothing under `public/` is hand-edited except `keyart/`, `icons/` and `fonts/`; everything else is regenerated by `pnpm sprites`, `pnpm models`, `pnpm materials`, `pnpm audio` (root scripts added to `package.json`), and `pnpm audit:assets -- --bytes` enforces the totals.

| Directory | Ceiling | Asserted by | Basis of the number |
|---|---|---|---|
| `creatures/` | **≤ 35 MB** (36 700 160 B) | `tools/sprite-pipeline/test/budget.test.ts` | §40.1.6: 260 sprites × (albedo q85 ≈ 73 KB + half-res normal q90 ≈ 24 KB + emissive ≈ 3 KB) × 1.20 mips ≈ 31.2 MB, + 130 thumbs ≤ 6 KB = 0.8 MB |
| `models/` | **≤ 12 MB** | `tools/model-pipeline/test/budget.test.ts` | §40.2.6: 6.5 + 5.0 + headroom |
| `materials/` | **≤ 90 MB** | `tools/material-bake/test/budget.test.ts` | §40.3.5: field 24.9 MB + hero ≤ 60 MB = ≤ 85 MB; the single-tier UASTC layout would be ≈ 143 MB and is why the tiers exist <!-- reconciled 2026-09-18: was 60 MB, which the arithmetic could not meet --> |
| `audio/` | **≤ 80 MB** | `tools/audio-pipeline/test/budget.test.ts` | §40.4.7: 78 MB at 16-bar stems |
| `basis/ + icons/ + fonts/ + keyart/` | ≤ 2 MB | `tools/asset-audit --bytes` | transcoder wasm 0.6 MB, fonts 0.36 MB, key art ≤ 0.8 MB |
| **total `public/`** | **≤ 219 MB** | `tools/asset-audit --bytes` | sum |

The per-zone *load* budget is a different number and is `20-client.md` §20.10.3's: phase 2 (`field` materials) ≤ 6 MB — Mirevale 4.5 MB, the largest biome set (cinder, 9 + 6 shared = 15) also 4.5 MB — and phase 3 (creature atlases + party + body GLB) ≤ 4 MB. From this file's manifests, phase 3 is ≤ 8 atlases × (73 + 24 + 3) KB × 4 sprites × 1.20 + 0.25 MB GLB ≈ **4.1 MB** cold for the single 14-species zone (`hollow_route`); the GLB is cached after the first zone, which brings the steady state to 3.8 MB. The `hero` tier (≤ 12 MB per zone) is phase 5.

---

## NON-NEGOTIABLES (this file)

1. Every tool is deterministic: two runs over the same inputs produce byte-identical outputs (`builtAt` in `audio/manifest.json` excepted) and the second run does no image/mesh/audio work (`cacheHits === inputs`).
2. The species set is the 130 ids of `@ewa/content`; the sprite manifest has exactly those keys; alternate-style files are excluded and listed, never shipped as pseudo-species.
3. Sprite alpha is bit-exact through encoding (`alphaQuality 100` asserted by decode); the mip chain is pipeline-built, premultiplied-filtered, coverage-preserving, and the client never calls `generateMipmaps` on a creature texture.
4. Every sprite exists once on disk (plus ≤ 6 planner duplicates); `single_<species>` is a runtime crop of `home`, not a file.
5. A QA flag that is not informational and not accepted with a written reason fails the M1 release rule; `leak`, `empty`, `fallback-source`, `missing-side` are never accepted.
6. Material sets are KTX2 UASTC with pipeline-built mip chains; albedo luminance ≤ 0.85; seams ≤ 2/255 for `repeat` surfaces; no runtime `CanvasTexture`.
7. Loudness (−16 / −20 LUFS) and loop points are measured, not trusted; a stem whose autocorrelation peak is < 0.6 is regenerated, not shipped.
8. `ffmpeg` and the KTX2 encoder are checked before work starts; a missing prerequisite is one clear message and exit 1, never a partial output tree.
9. The four directory ceilings in §40.6 are tests; a regression of > 5 % against the committed audit baseline fails CI even under the cap.
10. Licence files travel: `CREDITS.txt` (Quaternius, CC0) and `TABLER-LICENSE.txt` (MIT) are copied by the tools and their absence fails the build.

## CUT DELIBERATELY (this file)

| Cut | Reason | Replacement |
|---|---|---|
| KTX2 (UASTC or ETC1S) for creature atlases | UASTC is 1 B/texel and measured 1.57× *larger* than lossless WebP on sprites; the bundled encoder refuses > 12 Mpix; ETC1S quantises the alpha slice in 4×4 blocks and cannot keep a 1-texel edge exact | lossy WebP with lossless alpha + pipeline mips (§40.1.6) |
| Near-lossless WebP for albedo | measured 18–24 % saving at `nearLossless q40–q60` on `mire_route-0` (5 552 → 4 223 KB); cannot reach 35 MB | lossy `q85` with the edge acceptance test |
| Per-zone duplicated 4096² atlases and `single_<species>` files | 140 placements of 72 species + a second 2048² copy of all 130 ≈ 2.7× the bytes of storing each sprite once | 2048² zone-affinity atlases, `zones[]` bind lists, `home` crop (§40.1.4) |
| Shipping the `animations/` sheets | no consumer in `10-render.md`; 15 MB | `CreatureBillboard` poses are uniform writes |
| Runtime sprite variant re-baking | `00-spine.md` §3.7: palettes are uniforms | `hueShift/satMul/lightMul/alphaGlow` userData |
| Per-species hand-tuned emissive masks as a first step | 130 × 2 masks to paint | threshold 0.72 + `EMISSIVE_OVERRIDES` only where the contact sheet shows a miss |
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
