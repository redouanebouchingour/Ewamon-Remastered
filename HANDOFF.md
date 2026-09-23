# HANDOFF — Ewamon Remastered (as of 2026-09-23)

This file is the single entry point for whoever continues the build. Read it, then
`.design/PLAN.md` (approved plan) and `.design/SPEC.md` (BINDING contract, 6,488 lines,
assembled from `.design/spec/*.md`; any change needs a `.design/spec/CHANGELOG.md` entry).

## Working rules

- Repo: `C:\Users\Flowmatic - Redouane\Ewamon-Remastered`, branch `main`, commits land on `main`.
  If you are running inside a **git worktree** of this repo, note that `assets-src/` (443 MB raw art),
  `node_modules/` and `tools/*/.cache/` are gitignored and therefore absent there. Either change your
  working directory to the main checkout above, or run `pnpm install` and copy `assets-src/` from it.
- Old game (read-only reference): `C:\Users\Flowmatic - Redouane\Ewamon`. Legacy data copies:
  `.design/legacy/`.
- Rate limit: the account's 5-hour session limit trips after roughly 1.5–2 M subagent tokens. Run
  **2–3 workflow agents at a time**, tell them to save files incrementally, and `git commit` after
  each lands. Every package records spec deviations in `packages/<pkg>/IMPLEMENTATION-NOTES.md`.
- Architectural laws are lint rules (`eslint.config.js`, `eslint/local-rules.js`): `@ewa/core`
  imports nothing and is deterministic; `@ewa/render` knows no rules/content/network; server never
  renders; client never imports server/persist. `pnpm check` = typecheck + lint + lint-rule tests +
  tests + build.
- Verify in the Browser pane (WebGPU works there: Chrome 152, Intel Gen-12 iGPU, `timestamp-query`
  and BC compression available), not by build-passing.

## Status by package

| Package / tool | State | Proof |
|---|---|---|
| foundation (pnpm, tsc -b, vitest, eslint boundaries, CI) | DONE | `pnpm typecheck && pnpm lint && pnpm test:lint-rules` |
| `.design/` SPEC + story bible + roster coverage + legacy audit | DONE | `.design/SPEC.md`, `.design/story-bible.md`, `.design/roster-coverage.md`, `.design/audits/` |
| `@ewa/core` | DONE — 19 files / 240 tests, 1,000-battle determinism fuzz, digests committed | `pnpm exec vitest run packages/core` |
| `@ewa/persist` | DONE — 55 tests on PGlite; also verified on Docker Postgres 17 | `pnpm exec vitest run packages/persist`; real pg: `DATABASE_URL=postgres://postgres:<pw>@127.0.0.1:54322/ewamon_persist_test` (pw via `docker inspect supabase-db`, Env `POSTGRES_PASSWORD`) |
| `@ewa/protocol` | DONE — 157 tests, AOI proven with real Encoder/StateView/Decoder | `pnpm exec vitest run packages/protocol` |
| `@ewa/content` | DONE — validate gate OK (130/130 obtainable, 67 families, 21 heightfields ≥ 61 % walkable), 49 tests | `pnpm --filter @ewa/content run validate`; `pnpm exec vitest run packages/content` |
| `tools/sprite-pipeline` | v2 code + 8 suites (41 pass); **output not regenerated** — `packages/client/public/creatures` is EMPTY | see "Next steps" 1 |
| `tools/material-bake` + `packages/render/src/surfaces` | scaffolded only (package.json/tsconfig, deps installed) | see "Next steps" 2 |
| `@ewa/render` | NOT STARTED (spec §10 complete) | — |
| `@ewa/server` | NOT STARTED (spec §30 complete) | — |
| `@ewa/client` | NOT STARTED (spec §20 complete) | — |
| `tools/asset-audit`, `tools/audio-pipeline` | stubs | spec §40.4/§40.5 |
| `.design/audio-bible.md` | NOT WRITTEN | prompt outline in the design workflow script (see below) |
| Spec adversarial verification (implementability / determinism-authority / art-bar lenses) | NOT RUN | protocol notes: §50.4.3 says 17 ServerMessage variants, §4.4 has 16 — stale count |

Client already holds the Basis transcoder at `packages/client/public/basis/` for `KTX2Loader`.

## Next steps, in order

1. **Finish M1 sprite output.** In `tools/sprite-pipeline`: one test file fails only because the output is
   missing. Run `pnpm --filter @ewa/sprite-pipeline run build` then `run qa` to regenerate the v2 output
   (manifest version 2, exactly the 130 species, 2048² zone-affinity WebP atlases with mips,
   `qa/contact-sheet.png`, `qa-report.json` with `actionable: 0`). Hard budget: `packages/client/public/creatures`
   ≤ 35 MB (SPEC §40.1 fallback ladder). Write `tools/sprite-pipeline/README.md`. Make
   `pnpm exec vitest run tools/sprite-pipeline`, `pnpm typecheck`, `pnpm lint` clean. Commit the output.
2. **Material baker (SPEC §40.3 + §10.2).** Implement `packages/render/src/surfaces/{recipe,surfaces,index}.ts`
   + `recipes/*` (pure TS, no three) for every SurfaceId in §10.2.2, and `tools/material-bake/src/*`
   (bake → Sobel normal → ORM → KTX2 UASTC via `ktx2-encoder` node API, 512² field / 1024² hero, albedo
   luminance ceiling 0.85 with `albedoClampedPct`, seam check, content-hash cache, `materials.manifest.json`)
   writing to `packages/client/public/materials/`. Start with the Mirevale slice (`bake:slice`), Read the
   preview sheet, then bake all.
3. **`@ewa/render` (SPEC §10).** Split across 3 agents on separate modules: (a) renderer host + material
   library + lighting rig (CSM 4 cascades, sky/IBL, day-night) + post stack (GTAO → TRAA → bloom → tilt-shift
   DOF → ACES → grade, `ReducedEffects`); (b) zone builder + biome generators + terrain from content's
   heightfield + InstancedMesh scatter + LOD + disposal contract + leak test; (c) creature billboard system
   (NearestFilter, normal-lit, alpha shadow, contact shadow, rim light, variant uniforms) + DioramaCamera +
   BattleStage + HudLayer. Verify every three.js API in `packages/render/node_modules/three` (0.186,
   `three/webgpu`, `three/tsl`, `examples/jsm/tsl/display/*`, `examples/jsm/csm/CSMShadowNode.js`).
4. **`@ewa/server` (SPEC §30)** — ZoneRoom (20 Hz, movement validation via content heightfield +
   protocol MOVEMENT, AOI StateView, handover), spawn director, battle sub-state using `@ewa/core`,
   Fastify REST + auth, persistence flows via `@ewa/persist`, authority adversarial suite, AOI fanout harness.
5. **`@ewa/client` (SPEC §20)** — React 19 + react-router 7 shell, one design system, Zustand UI state,
   Colyseus SDK world state, prediction/interpolation, SceneDirector, battle timeline → render BattleStage.
6. **Integrate the vertical slice** (Mirevale + Mire Route): run server + client, drive it in the Browser
   pane, capture the six §50.6 shots, write the hostile render audit, hit the §50.2 frame budget (record
   real numbers; the dev machine is an Intel iGPU, the budget target is RTX 3060 class).
7. Then M3 (19 zones), M4 (systems), M5 (audio — `.design/audio-bible.md` first; the AI audio API key is
   the user's open dependency).

## Useful paths

- Workflow scripts from the previous session (prompts worth reusing):
  `C:\Users\Flowmatic - Redouane\.claude\projects\C--Users-Flowmatic---Redouane-Ewamon\daaf83bf-e3eb-44dd-bcbd-370b16c4bb1d\workflows\scripts\` —
  `ewamon-material-bake-*.js`, `ewamon-m1-finish-3-*.js`, `ewamon-design-docs-*.js` (audio-bible prompt inside).
- Sprite raw inputs: `assets-src/creatures/{front,back,animations}`; models: `assets-src/models/`.
- Postgres for real-db tests: Docker container `supabase-db`, port 54322, throwaway db `ewamon_persist_test`.
