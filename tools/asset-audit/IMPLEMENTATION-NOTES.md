# asset-audit — implementation notes and deviations from SPEC §40.5 / §40.6 / §50.4.6

## Input

**A1 — the mirrored `ZoneDump`.** `src/zone-dump.ts` mirrors `packages/render/src/stats.ts` `ZoneDump` (with
`BudgetCounts`/`HarvestLevel` from `descriptors.ts`, `MaterialClass` from `surfaces/types.ts`) field for field, and
`parseZoneDump` validates every field with its JSON path in the error. Three differences, each documented in the
file:
- `lights[].housingDistance` is `number | null`: render computes `+Infinity` when a zone has no housing mesh and
  `JSON.stringify(Infinity)` is `null`; the audit reads it as "no housing" (a `lights.housing` failure — tested
  with a real render dump).
- `cls` also admits `'sky'` and `'debug'`, the classes §40.5.2 names (`BackSide` only on sky, `materials.count`
  excludes debug) that render does not emit.
- Optional fields §40.5.2 says the dump "gains" but render does not write yet: `materials[].side`,
  `geometries[].sharedBy / kind / tier / instancedMesh`, `lightSources[]`, `meshes[]`, `shot`. Rules that need them
  report **unevaluated** on dumps without them (`report.json` `unevaluated`, printed by the CLI) instead of passing
  silently. Render follow-up: `dumpZone()` should write `side`, the scatter `kind` + tier + `isInstancedMesh`
  (the `ewa:scatter:<kind>:t<tier>` mesh names already carry them) and the `lightSource`-tagged emissives.

**A2 — the drift test uses render's real `dumpZone()`.** §40.0.2 rule 5 keeps `@ewa/render` out of the tool; the
test that "a fixture produced from the render type parses" runs `dumpZone()` on a small three.js scene in node and
feeds the JSON to the mirror. `@ewa/render` and `three` are therefore **devDependencies** (test-only; the package has
no runtime dependencies, asserted together with a grep that every `src/` import is relative or `node:*`). There is
no `harness:budget` yet (M2), so no real zone dump exists to audit; `fixtures/empty-zone.json` is the M1 fixture.

## Rules

**A3 — rule signature.** §40.5.2: "one function `rule(dump) => Violation[]`". Each file exports
`rule(dump, ctx)` — callable as `rule(dump)` in spirit, but two rules need more than one dump's worth of input:
`materials.albedoCeiling` reads `materials.manifest.json` (`ctx.materialsManifest`, default
`packages/client/public/materials/materials.manifest.json`, `--materials` overrides), and `harvest.same` compares a
pair of dumps (`ctx.peers`). Files are named by rule id (`src/rules/materials.count.ts`); `src/registry.ts` lists
them in §40.5.2 order.

**A4 — `materials.threeMaps` and `character`.** §40.5.2's assertion row lists `cls ∈ {standard, physical, card,
character}`, its exemption row and §50.4.6 exempt `character` by class. The exemption wins: asserted classes are
`standard`, `physical`, `card` (looks are vertex-coloured with the shared placeholder ORM/normal, §10.7.7).

**A5 — `textures.ktx2Only` is literal.** Every `standard/physical/card/water/emissive` material must report
`ktx2 === true`; an untextured emissive (render classifies it `ktx2: false`) fails. That is the SPEC's wording; if
render ships untextured emissives the rule will name them.

**A6 — counts cross-checked.** `materials.count` holds max(distinct listed uuids, `counts.materials`) to 48, and
`lights.count` holds max(`lights[]` tally, `counts.shadowLights / nonShadowLights`) to 8 / 24, so a dump whose list
and counter disagree cannot pass on the smaller number.

**A7 — `geometry.noPrimitives`:** a `SphereGeometry` whose `widthSegments` is absent from `parameters` fails (cannot
be shown to be ≥ 24).

**A8 — `geometry.noOutlineShells`:** check 1 — `side === BackSide` only on `sky`; check 2 (with `meshes[]`) — a
geometry drawn by ≥ 2 meshes where one uses a BackSide material at scale > 1. With only `sharedBy` the shell trick is
already caught by check 1 (the clone's material must be BackSide and it is not sky).

**A9 — `scatter.instanced`:** render's `instanced` is `InstancedMesh.count` for instanced meshes and **1** for plain
meshes, so the literal "`instanced ≥ 1`" is always true. The rule uses the optional `instancedMesh` flag when
present (falling back to the literal test), and requires tiers 0/1/2/3 (3 = impostor) per scatter kind. A geometry
is a scatter geometry when it carries a non-null `kind`.

**A10 — `lights.housing`, both directions (§50.4.6):** `lights[].housingDistance ≤ 0.6` and, when the dump carries
`lightSources[]`, each tagged emissive's `lightDistance ≤ 0.6`.

**A11 — `harvest.same` pairing:** the dump has no shot id, so a dump's shot is `dump.shot` if present, else its file
name; a level-2 dump is paired with the level-0 dump of the same zone whose shot key matches after removing a
trailing `-h0` / `_h2` / `.harvest2` marker. Unpaired level-2 dumps are unevaluated.

## Regression gate

**A12:** the baseline is a previous report's `worst` record (`--write-baseline` writes `{ zone, worst, worstShot }`);
default paths `tools/asset-audit/.audit/baseline.json` (commit it) and `.audit/report.json` (git-ignored). A metric
whose baseline worst is 0 regresses on any growth (+∞ %). CLI paths resolve against `INIT_CWD` (pnpm runs the
script inside `tools/asset-audit/`, but `pnpm audit:assets -- --dump tools/…` is typed at the repo root).

## `--bytes`

**A13 — manifest or disk, whichever is larger.** Each line holds max(manifest total, bytes on disk) to its ceiling:
`materials.manifest.json totalBytes` excludes the manifest itself (58 393 677 vs 58 439 151 on disk) and the audio
manifest's `bytes` count only the `.webm` (the ceiling is webm + m4a), so disk is the stricter number there; a stale
manifest cannot hide stray files and vice versa. The total line is Σ lines + bytes outside every listed directory.

**A14 — MiB.** §40.6 writes 35 MB as 36 700 160 B (and §50.2.2 700 MB as 734 003 200 B), so all ceilings are MiB.

**A15 — optional audio.** `audio/manifest.json` does not exist (the audio bible is unwritten, OQ-6); its absence is a
printed warning, not a failure. A missing creatures/models/materials manifest fails. Licence files
(`models/CREDITS.txt`, `icons/TABLER-LICENSE.txt`, §40.0.2 rule 6 / non-negotiable 10) are required; the model
pipeline writes both.

## Package

The `@gltf-transform/*` + `meshoptimizer` dependencies and the `models` script moved to `tools/model-pipeline`
(§40.0.1); the `@ewa/content` project reference was dropped (nothing imports it). `report` runs `tsx src/cli.ts`.
