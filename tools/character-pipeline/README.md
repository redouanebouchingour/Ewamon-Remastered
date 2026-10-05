# @ewa/character-pipeline — SUPERSEDED (2026-10-05)

> **Not shipped.** On 2026-10-05 the characters became stylised 3D people ("3D people with 2D creatures"): the KayKit
> "Adventurers 2.0" set built by `tools/model-pipeline` (`public/models/characters/`) and drawn by
> `packages/render/src/stage/actors.ts` (SPEC §10.7.6 / §10.7.7 / §40.2, CHANGELOG 2026-10-05). The pixel-art atlas
> (`public/characters/`) and its runtime (`sprites/characterAtlas.ts`, `sprites/characterAnim.ts`) are deleted, and the
> proposed SPEC entries of `IMPLEMENTATION-NOTES.md` are closed unapplied. The source stays for reference: it is no
> longer in the root `tsconfig.json` references, the default `pnpm test` run (`vitest.config.ts` excludes it) or any
> budget. Its own commands still work (`pnpm --filter @ewa/character-pipeline run build -- --out <dir>` to look at it;
> do not write into `public/`).

Procedural pixel-art characters for the HD-2D world: a deterministic paper-doll generator whose templates are
hand-authored in code, baked into one atlas (albedo + derived normal map) and `characters.manifest.json` under
`packages/client/public/characters/`. The runtime (`packages/render/src/stage/actors.ts`) draws every player and
NPC as a lit billboard of this atlas. Design notes, measurements and the proposed SPEC entries are in
`IMPLEMENTATION-NOTES.md`.

## Commands

```bash
pnpm --filter @ewa/character-pipeline run build -- --out <dir>           # compose + bake → <dir> + qa/contact-sheet.png
pnpm --filter @ewa/character-pipeline run build -- --out <dir> --force # ignore the content-hash cache
# tests: excluded from the root vitest config (superseded; the budget test reads the deleted public/characters)
pnpm exec tsx tools/character-pipeline/dev/lineup.ts <out.png> 5 idle 0 [look…]    # art review: looks × facings
pnpm exec tsx tools/character-pipeline/dev/gallery.ts <out.png> 5 hair|hats        # one part family on the base body
```

## Layout

| File | What |
|---|---|
| `src/grid.ts` | template legend, the ink buffer, painting, mirroring, overlay, the selective outline, colour resolve |
| `src/color.ts` | OKLCH hue-shifted 4-tone ramps + two outline colours per material; hand-pinned ramps |
| `src/compose.ts` | layer kinds, per-facing paint order, the upper-body offsets (bob / lean / hop), contact separation |
| `src/poses.ts` | the 44-frame table (facing × state × frame), fps, metres per gait cycle |
| `src/parts/body.ts` | head, faces, arms and legs for every pose |
| `src/parts/hair.ts` | 11 hair styles |
| `src/parts/hats.ts` | 10 headwear pieces |
| `src/parts/torso.ts` | 16 upper garments |
| `src/parts/wear.ts` | skirts, coat tails, robes, shoulder pieces, cape, scarf / bandana / pack, beards, eyepatch, spectacles |
| `src/looks.ts` | the 19 looks as outfits + the `BODIES` palette variants |
| `src/sheet.ts` | a look → its 44 RGBA frames |
| `src/bake.ts` | atlas rasters, normal maps, WebP, manifest, cache, budget |
| `src/qa.ts` | the contact sheet |

## Template legend

Rows are written as full 32-column strings so alignment is visible. `.` nothing · `X` erase · `1 2 3 4` / `0` slot A
highlight, base, shadow, deep / line · `a b c d` / `e` slot B · `f g h i` / `j` slot C · `k l m n` / `p` slot D ·
`K S s Z` / `z` skin · `E` eye · `W` eye highlight · `I` iris · `M` mouth · `B` blush. A part binds slots A–D to
palette slot names, so one template serves every colourway.

## Output

`characters.manifest.json` (v1: cell, footV, pixelsPerMetre, cellM, fps, cycleM, atlases, looks → facing → state →
frame UV rects, totalBytes) and `atlas/chars-0.{albedo,normal}.webp`. Budget: ≤ 3 MiB, asserted by
`test/budget.test.ts`.
