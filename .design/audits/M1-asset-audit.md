# M1 asset audit

Dated records for the browser and visual steps of the M1 definition of done (`.design/SPEC.md` §50.5).

## Creature sprites

- 2026-09-24 — `tools/sprite-pipeline/qa/contact-sheet.png` reviewed at full size (two halves, 2048 × 1190 each). All 130 species are present front and back. Every pair stands on the shared ground line of its row. No white or magenta background residue is visible on any sprite. `malice` front is the one accepted `coverage` flag (small creature on a large canvas); its alpha is correct on the sheet.
- 2026-09-24 — `pnpm --filter @ewa/sprite-pipeline run build` then `run qa`: 65 atlases, 36 247 708 bytes (budget 36 700 160), albedo q88 / normal q92, `qa-report.json` actionable 0, 3 alternate-style files excluded.
- 2026-09-24 — `pnpm exec vitest run tools/sprite-pipeline`: 9 files, 57 tests, all passing, including `budget.test.ts` and the seven `encoding.test.ts` acceptance tests (thresholds as amended in `.design/spec/CHANGELOG.md` 2026-09-24).

## Materials

- 2026-09-24 — `tools/material-bake/qa/slice-sheet.png` reviewed: the 15 Mirevale surfaces read as distinct materials with normal and roughness response (bark with moss, leaf and grass cards with alpha, moss, gravel, cobble, plaster, timber, slate, thatch, pond ripples, ashlar wall, riveted lantern metal, warm glass panes, dirt). Open note for the M2 render audit: `cobble` reads as regular brick courses rather than rounded cobbles, and `plaster`'s edge darkening repeats every 2 m on long walls.
- 2026-09-24 — full bake: 83 surfaces (38 hero), 55.69 MB of the 90 MB ceiling; Mirevale field 3.71 MB of 6 MB.

## Not yet done for M1

- `tools/model-pipeline` (SPEC §40.2) does not exist yet; `pnpm models` and its tests are outstanding.
- `tools/asset-audit` rules (SPEC §40.5) are stubs.
