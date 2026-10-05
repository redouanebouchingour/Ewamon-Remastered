# @ewa/model-pipeline

SPEC §40.2. Turns the 4 legendary GLBs and the KayKit "Adventurers 2.0" character pack (Kay Lousberg, CC0) in
`assets-src/models/` (git-ignored raw sources) into meshopt-compressed GLBs, KTX2 textures and `models.manifest.json`
(version 2) under `packages/client/public/models/` (committed, 7.1 MB).

```
pnpm models                     # = pnpm --filter @ewa/model-pipeline run build
pnpm --filter @ewa/model-pipeline run build -- --force   # ignore the cache (entries are rewritten)
pnpm --filter @ewa/model-pipeline run build -- --webp    # force the §40.2.4 WebP fallback
```

A rerun over unchanged inputs is ~3 s and reports `26 inputs, 26 cache hits`. A cold run is ~2 min (Basis UASTC
encoding of the legendary textures dominates; the whole character set is ~16 s).

## What it does

1. **Licences first** (§40.0.2 rule 6): `assets-src/licenses/KAYKIT-ADVENTURERS-LICENSE.txt` → `public/models/CREDITS.txt`
   under a credit line ("Kay Lousberg, www.kaylousberg.com", `creditsText`), `TABLER-LICENSE.txt` →
   `public/icons/TABLER-LICENSE.txt`. Either missing → exit 1 before any work.
2. **Sources** (`src/sets.ts`): `legendaries/{lumyth,noxmyth,voidraxis,zenryu}.glb`, and
   `kaykit-adventurers/{Characters,Animations,Assets}/gltf/…` as unpacked from the free 2.0 zip. The look table is
   validated against `@ewa/content`: its base looks must be exactly `LOOKS` (19) and its palette variants exactly the
   `look:palette` pairs `BODIES` uses (5). A missing or extra id fails the build.
3. **Legendaries** (`src/prepare.ts`, §40.2.3): 1 mesh / 1 skin / 1 clip, `Animation` → `idle`; textures classified
   by material slot; LOD1 by skinned simplification. Unchanged by the character work: their bytes are identical.
4. **Characters** (`src/characters.ts` the table, `src/kaykit.ts` geometry, `src/atlas.ts` the atlas,
   `src/buildCharacters.ts` the build):
   - **15 shapes**: parts of the six KayKit characters (all on the 23-joint `Rig_Medium`, identical bind pose,
     different joint order per file) merged into ONE skinned primitive with ONE material `character`, `JOINTS_0`
     remapped by joint name to one canonical order; a head may come from another character (heads only sample the
     universal skin / hair / eyes cells). Capes, hats, helmets, quivers and visors are in or out per shape.
   - **5 accessories** (mug, closed book, three shields): rigid, UVs kept, no image; a slot rotation in the manifest.
   - **1 animation file**: `idle walk run cheer flinch use` (from `Idle_A Walking_A Running_A Jump_Full_Short Hit_A
     Use_Item`) on a node-only rig; rest-pose tracks dropped; the walk and run ground speeds measured from the
     planted toe (`gaitSpeed`).
   - **1 atlas**: each look's copy of its body's 1024² swatch texture, recoloured cell by cell in OKLab (target hue
     and chroma, the gradient kept as a lightness offset), box-downscaled to a 256² tile; 24 look tiles + 2 source
     tiles (the mug's and an off-body book's) in a 2048 × 1024 UASTC KTX2 (RDO 1, zstd, no mips).
5. **Sequence** (`src/transform.ts`, §40.2.2): `dedup → flatten → join → prune → resample(1e-4) → weld →
   [simplify, LOD1] → reorder → quantize(14/10/12/8/8/12) → sparse → EXT_meshopt_compression (medium)`. Characters run
   it with `prune({ keepAttributes: true })`: their UVs have no image to reference them.
6. **Output** (`src/build.ts`): GLBs, textures, `CREDITS.txt`, `models.manifest.json`; stale files under
   `public/models/` are removed; `qa/qa-report.json` records sizes, triangle counts, LOD1 error, texture tiers and,
   per look, the mean colour of every recoloured slot.

## Output

```
packages/client/public/models/
├─ legendaries/<id>.glb, <id>.lod1.glb, <id>.{basecolor,normal,orm}.<hash8>.ktx2
├─ characters/<shape>.glb                     (15)
├─ characters/acc_<accessory>.glb             (5)
├─ characters/animations.glb
├─ characters/atlas.<hash8>.ktx2
├─ CREDITS.txt
└─ models.manifest.json                        (version 2)
```

`ModelsManifest` v2 is §40.2.5 verbatim (`src/manifest.ts`): `legendaries` (`ModelEntry`), `characters` (rig, the one
scale, `heightM`, animations with clip durations and gait speeds, the atlas grid, shapes, accessories) and `looks`
(`{ shape, tile, accessory, accessoryTile, scale, heightM }` for the 19 looks + 5 palette variants). Every `url` is
relative to `public/models/`; load as `/models/${url}?v=${hash.slice(0, 8)}`.

### The looks

| Look | Shape (parts) | Palette (recoloured slots) | Accessory |
|---|---|---|---|
| casual_male (ranger_m) | ranger_lad — Ranger body, cape, Knight head | blue scarf / cape, cream shirt, brown hair | — |
| casual_female (ranger_f) | ranger_lass — Ranger body, cape, Rogue head | rose scarf, cream shirt, denim trousers, auburn hair | — |
| casual2_male (+ :dusk) | rogue_lad — Rogue body, Knight head | moss tunic, mustard bandana (dusk: plum, sunset) | — |
| casual2_female (+ :dusk) | rogue_lass — Rogue | terracotta tunic, butter bandana (dusk: violet, peach) | — |
| casual3_male | ranger_plain — Ranger body, Knight head | red shirt, blond hair | mug |
| cowboy_male (+ :tide) | ranger_moustache — Ranger (moustache) | tan shirt, rust duster (tide: sea blue) | — |
| cowboy_female (+ :tide) | ranger_lass | cream shirt, rust duster, copper hair (tide: blue) | — |
| doctor_female_young | mage_lass — Mage coat, Rogue head | white coat, blue trim / scrubs, red satchel | book (red) |
| kimono_male | mage_hatted — Mage coat + hat, Knight head | indigo robe, straw hat, red obi | — |
| knight_golden_male | knight — Knight + helmet + cape | gold armour, white cape | round shield (gold) |
| knight_male (+ :forge) | knight | steel, red cape (forge: dark iron, ember cape) | badge shield |
| ninja_male | rogue_hooded — Rogue hooded + mask | black hood and wrap, red sash | — |
| old_classy_female | mage_long — Mage coat + long hair | mauve coat, lace trim, silver hair | book (blue) |
| old_classy_male | mage_moustache — Mage coat, Ranger head | tweed brown coat, white hair | book (maroon) |
| pirate_male | rogue_captain — Rogue + cape, Ranger head | red coat, black cape, gold buckles | mug |
| soldier_male | knight_trooper — Knight + helmet, no cape | steel, green rosette | round shield (green) |
| blue_soldier_male | knight_trooper | bright steel, blue rosette | square shield (blue) |
| suit_male | rogue_lad | charcoal suit, red cravat, white gloves | book |
| viking_male | barbarian — Barbarian + bear hat | ginger beard | mug |

### Sizes (targets are §40.2.6, MB = MiB)

| | Target | Now |
|---|---|---|
| legendary LOD0 (GLB + KTX2) | ≤ 1 258 291 B | lumyth 1 155 587 · noxmyth 1 139 569 · voidraxis 1 177 820 · zenryu 1 215 884 |
| legendary LOD1 GLB | ≤ 471 859 B | 220 080 · 230 940 · 220 492 · 247 552 (10 435–10 493 tris) |
| 4 legendaries (LOD0 + LOD1) | ≤ 6 815 744 B | 5 607 924 |
| one character file | ≤ 262 144 B | shapes 90 096 – 145 736 (5 288 – 9 651 tris) · accessories 6 552 – 8 280 · animations 83 216 · atlas 47 492 |
| the character set (`characters/`) | ≤ 5 242 880 B | 1 794 168 |
| `public/models/` | ≤ 12 582 912 B | 7 420 209 |

## Tests

`pnpm exec vitest run tools/model-pipeline`

- `budget.test.ts` — every §40.2.6 / §50.4.8 number over the committed tree, meshopt/quantization extensions,
  KTX2 container facts (legendaries: UASTC, zstd, full mips; the atlas: UASTC, zstd, level 0 only, sRGB), the shipped
  clips, the look table (a tile per look, accessory tiles, one scale, a chibi height), licences, no stale files, and
  the round trip (a shape, the animation file, a legendary LOD0 + LOD1 load back with the meshopt decoder).
- `characters.test.ts` — the look table against `@ewa/content`, OKLab recolour, downscale, atlas layout, the joint
  remap of a cross-character shape, the gait speeds.
- `determinism.test.ts` — two runs byte-identical (skinned fixture, a cross-character shape, a real legendary LOD0 /
  LOD1, the KTX2 encoder); a rerun is `cacheHits === inputs` and reproduces the committed bytes.
- `prepare.test.ts`, `io.test.ts` — legendary rules, rest-track pruning, GLB packing, source validation.

Tests that need `assets-src/models` skip when the (git-ignored) sources are absent. `dev/` holds the inspection
scripts used for the measurements in `IMPLEMENTATION-NOTES.md` (`peek.ts`, `swatches.ts`, `rigcheck2.ts`,
`anims2.ts`).

Deviations from the SPEC: `IMPLEMENTATION-NOTES.md`.
