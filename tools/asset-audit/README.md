# @ewa/asset-audit

SPEC §40.5 (dump rules + regression gate) and the §40.6 budget roll-up. Headless and GPU-free; the tool itself
imports nothing but `node:*` (asserted by `test/rules.test.ts`).

```
pnpm audit:assets -- --dump <file.json | dir>            # ZoneDump(s) against the §50.4.6 rules
                     [--baseline <file>] [--write-baseline] # §40.5.3 regression gate
                     [--report <file>] [--materials <materials.manifest.json>]
pnpm audit:assets -- --bytes [--public <dir>]            # §40.6 ceilings over packages/client/public
```

Paths are relative to the directory you run `pnpm` in. Exit 0 = pass, 1 = a violation (rule id, shot and the
offending dump row are printed), 2 = bad input (unreadable or malformed dump — the JSON path of the bad field is
named).

## `--dump`

Input is `ZoneDump` JSON as written by `@ewa/render`'s `dumpZone()` (`packages/render/src/stats.ts`), one file per
camera shot; a directory is read recursively. The shape is mirrored in `src/zone-dump.ts` (the tool may not import
`@ewa/render`, §40.0.2 rule 5) and validated field by field; `test/zone-dump.test.ts` runs render's real `dumpZone()`
on a small scene and asserts the mirror parses it, so a new render field fails that test until it is mirrored.

One file per rule under `src/rules/`, named by rule id; each exports `id`, `rule(dump, ctx) => Violation[]`, and
optionally `measure` (the per-shot number `report.json` keeps the worst of) and `evaluable`.

| Rule | Assertion |
|---|---|
| `budget.counts.drawCalls` / `.triangles` / `.texturesSize` / `.renderTargets` / `.programs` | ≤ 400 / 2 500 000 / 734 003 200 / 24 / 96 |
| `materials.count` | distinct non-`debug` material uuids (and `counts.materials`) ≤ 48 |
| `materials.threeMaps` | `standard`/`physical`/`card` at harvest 0 have albedo + ORM + normal |
| `materials.albedoCeiling` | every referenced surface has `albedoClampedPct` in `materials.manifest.json` |
| `textures.ktx2Only` | `standard`/`physical`/`card`/`water`/`emissive` are KTX2 |
| `geometry.noPrimitives` | no Box/Cone/Icosahedron, no sphere under 24 width segments, at harvest 0 |
| `geometry.noOutlineShells` | `BackSide` only on `sky`; no shared geometry drawn as a scaled BackSide shell |
| `scatter.instanced` | scatter geometries are InstancedMesh; each scatter kind has lod0/lod1/lod2/impostor |
| `lights.count` | shadow-casting ≤ 8, others ≤ 24 |
| `lights.housing` | every light within 0.6 of a housing; every `lightSource` emissive within 0.6 of a light |
| `sprites.nearest` | `magFilter === 1003`, `anisotropy === 1` |
| `shadows.drawCalls` | ≤ 564 |
| `harvest.same` | harvest 0 and 2 dumps of the same shot have the same material-class multiset |

A rule whose input fields the dump does not carry is listed as **unevaluated** (never a silent pass). Today's render
dumps lack `materials[].side`, `geometries[].kind / tier / instancedMesh` and `lightSources[]` — the fields §40.5.2
says "the dump gains" — so `geometry.noOutlineShells` and `scatter.instanced` report unevaluated on them and
`lights.housing` checks one direction. `harvest.same` pairs dumps by zone and shot key: `dump.shot` if present, else
the file name with a trailing `-h0` / `_h2` / `.harvest2` removed.

`fixtures/empty-zone.json` passes every rule, all evaluated.

### Regression gate (§40.5.3)

Every `--dump` run writes `report.json` (default `tools/asset-audit/.audit/report.json`, git-ignored):
`{ zone, dumps, worst, worstShot, unevaluated, regressions, violations }`. `--write-baseline` writes
`{ zone, worst, worstShot }` to `--baseline` (default `tools/asset-audit/.audit/baseline.json`, meant to be
committed). With `--baseline`, `drawCalls`, `triangles`, `texturesSize` or `materials.count` growing more than 5 % over
the baseline's worst shot fails as `regression.<metric> +N %` even under the cap.

## `--bytes`

| Line | Ceiling | Number held to it |
|---|---|---|
| `creatures/` | 36 700 160 B | max(`creatures.manifest.json totalBytes`, bytes on disk) |
| `models/` | 12 MiB | max(`models.manifest.json totalBytes`, disk) |
| `materials/` | 90 MiB | max(`materials.manifest.json totalBytes`, disk) |
| `audio/` | 80 MiB | max(Σ clip `bytes` in `audio/manifest.json`, disk) |
| `basis/ + icons/ + fonts/ + keyart/` | 2 MiB | disk |
| total `public/` | 219 MiB | Σ lines + anything outside them |

§40.6's MB are MiB (it writes 35 MB as 36 700 160 B). `models/CREDITS.txt` and `icons/TABLER-LICENSE.txt` must exist.
A missing creatures/models/materials manifest fails; a missing audio manifest is a warning until the audio pipeline
ships (OQ-6).

Current tree (2026-09-25): creatures 34.52 MB, models 8.58 MB, materials 55.73 MB, audio 0, misc 0.56 MB,
total 99.40 MB — all within ceilings.

## Tests

`pnpm exec vitest run tools/asset-audit` — `rules.test.ts` (one violating fixture per rule, the empty zone, CLI exit
codes, regression gate, every `--bytes` ceiling, the real `public/` tree, the `node:*`-only import rule) and
`zone-dump.test.ts` (render's `dumpZone()` → JSON → the mirror). The drift test imports `@ewa/render` and `three`
from the test file only; they are devDependencies.

Deviations from the SPEC: `IMPLEMENTATION-NOTES.md`.
