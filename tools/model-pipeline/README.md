# @ewa/model-pipeline

SPEC §40.2. Turns the 4 legendary GLBs and the 19 Quaternius characters in `assets-src/models/` (git-ignored raw
sources, 45 MB) into meshopt-compressed GLBs, KTX2 textures and `models.manifest.json` under
`packages/client/public/models/` (committed, 8.6 MB).

```
pnpm models                     # = pnpm --filter @ewa/model-pipeline run build
pnpm --filter @ewa/model-pipeline run build -- --force   # ignore the cache (entries are rewritten)
pnpm --filter @ewa/model-pipeline run build -- --webp    # force the §40.2.4 WebP fallback
```

A rerun over unchanged inputs is ~2 s and reports `23 inputs, 23 cache hits`. A cold run is ~2 min (Basis
UASTC encoding of the legendary textures dominates).

## What it does

1. **Licences first** (§40.0.2 rule 6): `assets-src/licenses/QUATERNIUS-CREDITS.txt` → `public/models/CREDITS.txt`,
   `TABLER-LICENSE.txt` → `public/icons/TABLER-LICENSE.txt`. Either missing → exit 1 before any work.
2. **Sources** (`src/sets.ts`): `legendaries/{lumyth,noxmyth,voidraxis,zenryu}.glb` and every
   `quaternius/*.gltf`, look ids = snake_case stems, validated against `@ewa/content` `LOOKS`. A missing or extra
   file fails with its id.
3. **Per-set rules** (`src/prepare.ts`, §40.2.3)
   - legendaries: 1 mesh / 1 skin / 1 clip, `Animation` → `idle`; textures classified by material slot.
   - looks: each flat-colour material baked into `COLOR_0`, the primitives merged into one primitive with one
     `character` material; clips `Idle Walk Run Victory Defeat SitDown StandUp` kept (lower-cased), the other 10
     detached.
   - both: tracks that hold the rest pose in every clip are dropped (lossless, see IMPLEMENTATION-NOTES M8).
4. **Sequence** (`src/transform.ts`, §40.2.2): `dedup → flatten → join → prune → resample(1e-4) → weld →
   [simplify, LOD1] → reorder → quantize(14/10/12/8/8/12) → sparse → EXT_meshopt_compression (medium)`.
5. **Textures** (`src/textures.ts` + `src/ktx2.ts`, §40.2.4): UASTC + RDO λ2 + zstd + Basis mips via
   `ktx2-encoder@0.6.0`; sRGB for base colour/emissive, the normal preset for normals. Written **external**
   (`legendaries/<id>.<role>.<hash8>.ktx2`), referenced by both LOD0 and LOD1 through `KHR_texture_basisu`, so
   they are stored once. Resolution comes from a fixed ladder: each legendary gets the first tier whose LOD0 fits
   the 1.2 MB line.
6. **LOD1** (`src/simplify.ts`): `simplifyWithAttributes` (normals, UVs, skin weights weighted), ratio 0.35.
7. **Output** (`src/build.ts`): GLBs, textures, `CREDITS.txt`, `models.manifest.json`; stale files under
   `public/models/` are removed; `qa/qa-report.json` records per-model sizes, triangle counts, LOD1 error, texture
   tier/sizes/means and flags.

## Output

```
packages/client/public/models/
├─ legendaries/<id>.glb, <id>.lod1.glb, <id>.{basecolor,normal,orm}.<hash8>.ktx2
├─ looks/<look>.glb                                   (19)
├─ CREDITS.txt
└─ models.manifest.json
```

`ModelEntry` is §40.2.5 verbatim (`src/manifest.ts`). Conventions:

- `url` / `lod1` are relative to `public/models/`; load as `/models/${url}?v=${hash.slice(0, 8)}`.
- `bytes` of a legendary = LOD0 GLB **+ its three KTX2 files**; a look's = its GLB.
- `triangles` is LOD0's; `clips` sorted; `bounds` is the pose three.js shows before any clip plays (node TRS as
  stored, linear-blend skinned) — the Quaternius rigs are ~3.1 units tall, the legendaries ~2.0.
- `totalBytes` = every file under `public/models/`, the manifest included.

Client loading: `GLTFLoader` + `MeshoptDecoder` + `KTX2Loader` (`/basis/`). The legendary GLBs resolve their
textures relative to the GLB url, so keep them in the same directory.

### Sizes (targets are §40.2.6, MB = MiB)

| | Target | Now |
|---|---|---|
| legendary LOD0 (GLB + KTX2) | ≤ 1 258 291 B | lumyth 1 155 587 · noxmyth 1 139 569 · voidraxis 1 177 820 · zenryu 1 215 884 |
| legendary LOD1 GLB | ≤ 471 859 B | 220 080 · 230 940 · 220 492 · 247 552 (10 435–10 493 tris) |
| 4 legendaries (LOD0 + LOD1) | ≤ 6 815 744 B | 5 607 924 |
| one look | ≤ 262 144 B | 149 532 – 216 540 |
| 19 looks | ≤ 5 242 880 B | 3 378 112 |
| `public/models/` | ≤ 12 582 912 B | 8 999 685 |

## Tests

`pnpm exec vitest run tools/model-pipeline`

- `budget.test.ts` — every §40.2.6 / §50.4.8 number over the committed tree, meshopt/quantization extensions,
  KTX2 container facts (UASTC, zstd, full mip chain, sRGB vs linear), clips, licences, no stale files, and the
  round trip: a look and a legendary (LOD0 + LOD1) are loaded back with gltf-transform + the meshopt decoder.
- `determinism.test.ts` — two runs byte-identical (synthetic look, real legendary LOD0/LOD1, KTX2 encoder); a
  rerun is `cacheHits === inputs` and reproduces the committed bytes.
- `prepare.test.ts`, `io.test.ts` — per-set rules, rest-track pruning, GLB packing, source validation.

Tests that need `assets-src/models` skip when the (git-ignored) sources are absent.

Deviations from the SPEC: `IMPLEMENTATION-NOTES.md`.
