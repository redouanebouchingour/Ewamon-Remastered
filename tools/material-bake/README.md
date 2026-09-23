# @ewa/material-bake

Build-time procedural PBR material baker (SPEC §40.3, §10.2). For each of the 83 `SurfaceId`s it runs the
surface's recipe (a pure-TS painter in `packages/render/src/surfaces/recipes/`) into Float32 fields, derives
the normal map, cavity AO, luminance ceiling and mip chains, encodes three KTX2 maps (UASTC + RDO + Zstandard)
per tier and writes `packages/client/public/materials/` plus `materials.manifest.json`.

- `field` tier: 512², every surface. `hero` tier: 1024², the 38 `hero: true` surfaces (6 shared + 11 biome
  signatures + 21 triplanar terrain layers).
- Maps: `albedo` (sRGB; RGBA for the 7 alpha cards), `orm` (R = AO, G = roughness, B = metalness, linear,
  absolute values), `normal` (3×3 Sobel of the heightfield, OpenGL +Y, linear). Full mip chain to 1×1, built by
  the bake (linear box filter / average / renormalised average; card alpha coverage-preserving).
- Albedo luminance ≤ 0.85 (Rec. 709, linear); `repeat` surfaces are seam-checked; everything is deterministic
  and cached by content hash.

Deviations from the SPEC and the reasons are in [IMPLEMENTATION-NOTES.md](./IMPLEMENTATION-NOTES.md).

## Commands

```sh
pnpm --filter @ewa/material-bake run bake          # all 83 surfaces, both tiers (≈ 6 min cold on 8 workers, seconds when cached)
pnpm --filter @ewa/material-bake run bake:slice    # Mirevale + mire_route (the 15 grove surfaces, ≈ 1 min cold)
pnpm --filter @ewa/material-bake run report        # per-surface bytes / clamp % / seam / timings + budget checks (exit 1 on a budget problem)

# direct CLI (tools/material-bake):
tsx src/cli.ts bake [--zone <zone|biome>]... [--surface <id>]... [--tier field|hero] [--force] [--jobs N]
tsx src/cli.ts --preview <id> [--tier field|hero]   # qa/<id>.png: albedo | ORM | normal, level 0 above level 3
tsx src/cli.ts sheet [--zone …] [--surface …] [--out qa/x.png]   # contact sheet; default qa/slice-sheet.png
```

`--zone` takes a zone id (`mirevale`, `cinderhold`, …) or a biome (`grove`, `cinder`, …) and bakes that biome's
row plus the 6 shared surfaces. Partial bakes merge into the existing manifest; a full bake also deletes
orphaned `.ktx2` files. `--force` ignores the cache. The encoder is probed before any work; if the Basis WASM
cannot initialise the bake stops with one message.

Outputs:

```
packages/client/public/materials/
  <surface>.field_{albedo,orm,normal}.ktx2      83 × 3
  <surface>.hero_{albedo,orm,normal}.ktx2       38 × 3
  placeholder_{albedo,orm,normal}.ktx2          4×4 neutral set (#808080 / (1, 0.5, 0) / (0.5, 0.5, 1))
  materials.manifest.json                       §40.3.4 shape, sorted keys, LF
tools/material-bake/qa/qa-report.json            per-surface flags (bytes, over-target maps, clamp %, seam), no timings
tools/material-bake/qa/slice-sheet.png           albedo | ORM | normal | lit | 2×2 tiling, 256 px per cell
tools/material-bake/.cache/<hash>/               git-ignored; <tier>_{albedo,orm,normal}.ktx2 + <tier>.meta.json
```

## How a surface is baked

1. `height(h, ctx)` → Float32 heightfield (clamped to 0..1).
2. `albedo(rgb, h, ctx)` → linear RGB (+ alpha for cards).
3. `orm(o, h, ctx)` → AO / roughness / metalness (pre-filled 1 / 0.5 / 0). If AO is left untouched the bake
   writes the cavity term `ao *= 1 − 0.6 · sat((blur(h, σ 6 px) − h) · 4)`.
4. Luminance ceiling 0.85: brighter texels are scaled down and counted; more than 5 % fails the bake (emissive
   housings are reported, not failed).
5. Normal = Sobel(h) × `normalStrength`, encoded `128 + n · 127`.
6. Seam check (`repeat` only): the neighbour difference across the wrap may not exceed the largest interior
   neighbour difference by more than 2/255 (albedo and height); failure names the surface.
7. Mip chains, then one KTX2 per map: each level is encoded by Basis (UASTC pack level 0, RDO from the
   recipe's `rdo`, zstd) and the levels are assembled into one file.

The cache key (and the manifest `hash`) is sha256 of the recipe's source file, the shared recipe files, the
bake's own sources, the SurfaceDef JSON, the recipe's static fields, the tiers and the encoder settings. A
rerun over unchanged inputs does no image work (`cacheHits === inputs`) and rewrites byte-identical files
(`test/cache.test.ts` also proves a fresh bake reproduces the committed bytes).

## Writing a recipe

Recipes live in `packages/render/src/surfaces/recipes/<biome>.ts` (grove = the 15 slice recipes, hand-written;
the others mostly instantiate the families in `families.ts`). The module is pure TypeScript: no three, no DOM,
no node builtins.

```ts
const cobble: SurfaceRecipe = {
  id: 'cobble', hero: true, metres: 2, normalStrength: 0.85, wrap: 'repeat', rdo: 4,
  height(h, c) {
    const top = tiled(c.noise, 16, 16, 1);                    // seamless fbm at 16 cycles per tile
    each(h, (u, v, i) => { h.data[i] = /* … */ top.fbm(u, v, 4); });
  },
  albedo(rgb, h, c) { each(rgb, (u, v, i) => setRgb(rgb, i, hex('#6f6a63'), 0.8 + 0.4 * h.data[i]!)); },
  orm(o, h) { for (let i = 0; i < o.rough.length; i++) o.rough[i] = 0.55 + 0.2 * (1 - h.data[i]!); },
};
```

Rules of thumb:

- **Work in tile units.** `each()` hands you `(u, v)` at texel centres in [0, 1); v = 0 is the first row (the
  base of trunks and cards). Pixel numbers from the SPEC table are at the reference size: `n / 1024` for hero
  surfaces, `n / 512` otherwise.
- **Seamless = integer frequencies.** Use `tiled(c.noise, fx, fy, salt)` (fbm / value / worley / hash on a
  torus) instead of calling `c.noise.fbm2` with scaled coordinates; `sin` terms need whole periods per tile
  (`sin(2π·k·u)`); stamps (`stamp`, `stroke`, `crackWalk`) take `wrap: true`; keep course/plank joints off the
  tile edge or centred on it. The bake refuses a visible seam.
- **Randomness** only through `c.noise.rng('<surface>:<purpose>')` (sfc32 from sha256) or the noise hashes —
  never `Math.random`.
- **Share per-texel data between painters** with `aux(h, 'name')` (a Float32Array keyed by the heightfield
  object, e.g. a stone id written in `height` and read in `albedo`).
- **Write absolute values**: albedo is the final linear colour (stay under 0.85 luminance; pale materials
  need headroom for their variation), roughness and metalness are the final values (the renderer reads the maps
  as-is once they are bound).
- **Cards** (`SurfaceDef.alphaTest !== null`) must be `wrap: 'clamp'`; call `card(rgb)` to get the alpha channel
  and fill transparent texels with a colour close to the leaves/cloth (mips bleed it).
- **Size**: sub-texel detail at 512² is noise that neither shows nor compresses. If `report` flags a map over
  its target, first remove detail finer than ~4 px at the field tier, then set `rdo: 4` on the recipe.
- Look at the result: `tsx src/cli.ts sheet --surface <id> --tier field --out qa/tmp.png`.

## Measured sizes (final bake, this machine)

Bytes are file sizes; MB = 2²⁰ B. Targets: 0.10 MB (102.4 KB) per field map, 0.40 MB per hero map.

| Set | Bytes | Budget |
|---|---|---|
| All 83 `field` sets (249 maps) | **21.92 MB** | SPEC estimate 24.9 MB |
| All 38 `hero` sets (114 maps) | **33.77 MB** | ≤ 60 MB |
| `public/materials/` total (+ placeholder) | **55.69 MB** | ceiling **90 MB** ✓ |
| Mirevale `field` (15 surfaces, phase 2) | **3.71 MB** | ≤ 6 MB ✓ (SPEC target 4.5 MB) |
| Mirevale `hero` (10 surfaces, phase 5) | **7.71 MB** | ≈ 12 MB ✓ |
| Largest biome `field` set | 3.71 MB (grove); cinder 3.68 MB | ≤ 6 MB ✓ |

Mirevale slice, per surface (albedo / orm / normal, KB):

| surface | field | hero |
|---|---|---|
| grove_bark | 84 / 89 / 171 (344) | 245 / 275 / 580 (1 097) |
| grove_leaf_canopy | 50 / 15 / 109 (174) | — |
| grove_moss | 89 / 115 / 216 (420) | 275 / 353 / 726 (1 354) |
| path_gravel | 111 / 133 / 265 (509) | 320 / 424 / 824 (1 568) |
| cobble | 74 / 48 / 148 (270) | 206 / 138 / 527 (871) |
| plaster | 42 / 15 / 89 (147) | 100 / 34 / 299 (432) |
| timber | 34 / 55 / 93 (182) | 88 / 152 / 342 (582) |
| slate_roof | 45 / 44 / 110 (199) | — |
| thatch | 114 / 105 / 238 (457) | — |
| water_pond | 1 / 44 / 120 (165) | — |
| stone_wall | 63 / 16 / 134 (214) | 176 / 41 / 492 (708) |
| lantern_metal | 6 / 35 / 48 (88) | 14 / 84 / 145 (243) |
| glass_warm | 1 / 5 / 3 (9) | 2 / 9 / 6 (16) |
| dirt | 84 / 66 / 163 (313) | 256 / 196 / 570 (1 022) |
| tall_grass | 117 / 12 / 192 (321) | — |

The aggregate budgets hold with room to spare, but 122 of 363 maps (mostly normal maps of detailed surfaces)
remain above the per-map targets even with `rdo: 4`; UASTC + zstd does not reach ~0.3 B/texel on textured
normals at usable quality. `test/budget.test.ts` accepts an over-target map only when its recipe carries the
rdo lever, never beyond 3× the target, and `qa/qa-report.json` lists every one (IMPLEMENTATION-NOTES D24).

## Tests

`pnpm exec vitest run tools/material-bake packages/render/test/surfaces`

- `packages/render/test/surfaces.test.ts` — the 83 ids and their §10.2.2 values, hero set (≤ 50, = shared ∪
  triplanar ∪ signatures), §40.3.6 slice parameters, SURFACES ↔ RECIPES bijection, every recipe deterministic
  and non-flat, SHA-256 vectors, sfc32, exact torus wrap of the noise.
- `test/bake.test.ts` — bake determinism, mip chains, ceiling on every surface, seam check on every repeat
  surface, the failure modes (too bright, seamed), cavity AO, ORM / normal conventions.
- `test/ktx2.test.ts` — container round trip, UASTC/zstd/DFD per map kind, supplied levels survive assembly.
- `test/manifest.test.ts` — manifest shape / sorted keys / LF, every referenced file exists with matching bytes,
  no orphans, KTX2 header of every shipped file (identifier, vkFormat 0, level count, UASTC DFD, transfer
  function, RGBA only for cards).
- `test/budget.test.ts` — per-map targets (with the rdo-lever rule), phase-2 6 MB per biome, Mirevale hero,
  90 MB ceiling, ≤ 50 hero surfaces.
- `test/cache.test.ts` — byte-identical rebuild from cache, fresh bake = committed bytes, hash sensitivity.
- `test/zones.test.ts` — the tool's zone → biome table equals `@ewa/content`.

The output tests read the committed `public/materials/`; rerun `bake` after changing a recipe.
