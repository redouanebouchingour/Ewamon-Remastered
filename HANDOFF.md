# HANDOFF — Ewamon Remastered (as of 2026-10-06)

This file is the single entry point for whoever continues the build. Read it, then
`.design/PLAN.md` (approved plan) and `.design/SPEC.md` (BINDING contract, assembled from
`.design/spec/*.md` by `node .design/spec/assemble.mjs`; any change to a part file needs a
`.design/spec/CHANGELOG.md` entry in the same commit).

## Working rules

- Repo: `C:\Users\Flowmatic - Redouane\Ewamon-Remastered`, branch `main`. Work from 2026-09-23 on was
  done in the worktree `.claude/worktrees/wonderful-nightingale-29f3d5` (branch
  `claude/wonderful-nightingale-29f3d5`) and fast-forwarded into `main` at each milestone.
- In a **git worktree**, `assets-src/creatures`, `assets-src/models` and `tools/sprite-pipeline/.cache`
  are gitignored and absent. Link them from the main checkout (Windows directory junctions,
  `New-Item -ItemType Junction`) and run `pnpm install`.
- Old game (read-only reference): `C:\Users\Flowmatic - Redouane\Ewamon`. Legacy data copies: `.design/legacy/`.
- Rate limit: the account's 5-hour session limit trips after roughly 1.5–2 M subagent tokens. Run
  **2–3 agents at a time**, tell them to save files incrementally, and `git commit` after each lands.
  When the limit trips mid-agent, WIP-commit what is on disk and resume the agent with SendMessage.
- Each package records spec deviations in `packages/<pkg>/IMPLEMENTATION-NOTES.md` (tools likewise).
- Architectural laws are lint rules (`eslint.config.js`, `eslint/local-rules.js`): `@ewa/core` imports
  nothing; `@ewa/render` imports only three; server never renders; client never imports server/persist;
  `ewa/no-inline-style` in the client. `pnpm check` = typecheck + lint + lint-rule tests + tests + build.
- Browser verification: the desktop app's Browser pane only draws frames while the session window is
  visible. When it is not, use a local headless Chrome over CDP (Chrome 153 has WebGPU headless on this
  machine): launch `chrome.exe --headless=new --remote-debugging-port=9444 --enable-unsafe-webgpu
  --enable-gpu --ignore-gpu-blocklist --user-data-dir=<scratch>` and drive it with a small CDP script
  (`Page.captureScreenshot`). The render sandbox is `pnpm --filter @ewa/render sandbox` (port 5180,
  `?zone=mirevale`, `?zone=mire_route`, `?demo=lineup`, `?demo=battle`, `window.__ewaSandbox`).

## Status by package

| Package / tool | State | Proof |
|---|---|---|
| foundation | DONE | `pnpm typecheck && pnpm lint && pnpm test:lint-rules` |
| `.design/` SPEC, story bible, roster coverage, audio bible | DONE; SPEC amended 2026-09-23..25 (see CHANGELOG) | `.design/SPEC.md`, `.design/audio-bible.md` |
| `@ewa/core` | DONE — 240 tests, 1,000-battle determinism fuzz | `pnpm exec vitest run packages/core` |
| `@ewa/content` | DONE — validate gate 130/130, 67 families, 21 zones + heightfields | `pnpm --filter @ewa/content run validate` |
| `@ewa/protocol` | DONE — 157 tests; `CLOSE_CODES.replaced` = 4101 | `pnpm exec vitest run packages/protocol` |
| `@ewa/persist` | DONE — PGlite + Postgres; migration `0001_battle_replay` | `pnpm exec vitest run packages/persist` |
| `@ewa/server` | DONE (parts 1 + 2) — ZoneRoom 20 Hz, movement validation, AOI, handover, spawns, battles, story beats, REST + JWT, trades, raids, social, guilds, marketplace, live-ops, metrics; AOI fanout 0.16–0.22 × quadratic at N = 50/100/200 | `pnpm exec vitest run packages/server` (with persist + protocol: 345 tests) |
| `@ewa/render` | DONE (parts 1–3) — host, KTX2 material library, CSM + sky/IBL + day-night, post (GTAO→TRAA→bloom→DOF→ACES→grade), zone builder (11 biome sets, 21 set-pieces), terrain collider, scatter/LOD, billboards, camera rig, battle stage + 47 VFX, actor pool, HUD | `pnpm exec vitest run packages/render`; sandbox |
| `@ewa/client` | part 1 DONE (shell, router, stores, WorldSession, design system, all screens); part 2 (3D scene, prediction, battles, HUD writer, audio director, modals) IN PROGRESS | `pnpm exec vitest run packages/client` |
| `tools/sprite-pipeline` | DONE (M1) — 130 species, 65 atlases, 36.20 MB ≤ 35 MiB, QA actionable 0, binary alpha, 59 tests | `pnpm sprites`; `.design/audits/M1-asset-audit.md` |
| `tools/material-bake` | DONE — 83 surfaces (38 hero), 55.7 MB ≤ 90 MB | `pnpm materials` |
| `tools/model-pipeline` | DONE — 4 legendaries + 19 looks, 8.58 MB ≤ 12 MB | `pnpm models` |
| `tools/asset-audit` | DONE — 17 rules; `--dump`, `--bytes`, baseline gate | `pnpm audit:assets -- --bytes` |
| `tools/audio-pipeline` | key-less half DONE — `plan`, `generate` refusal, `process`; 366 jobs; **needs the user's `EWA_AUDIO_API_KEY` (Stability Stable Audio 2.5 recommended, ≈ $73)** | `pnpm --filter @ewa/audio-pipeline plan` |

## The finish plan (2026-10-06)

The user approved a five-phase plan to finish the game end to end, committed to `main` as it goes, each phase green
and playable: **A** interiors + themed gym halls + correct arenas → **B** story-complete (Acts I–III and all 12
league fights pass headless) → **C** missing UI (raids, quest journal, world map + minimap + fast travel, rankings /
history / profile, bag, password reset) → **D** systems (TMs, evolution items, shinies, achievements, doubles, weather,
surf + fishing, Cut/Strength, bike, tutorial, ranked queue, post-game) → **E** art, CC0 audio, release.

| Phase | State | Proof |
|---|---|---|
| A — interiors, gym halls, puzzles, arenas | DONE (commit `d0f06d5` + polish) | `packages/{content,server,render,client}/test/interiors.test.ts`; live: entered the Mirevale gym, fought a gym trainer at the hall arena, healed at the nurse inside the healer |
| B — story-complete | next | — |

Dev tips learned in Phase A:
- Another session may hold ports 4000/2567/5173. `.claude/launch.json` has `ewa-server-alt` / `ewa-client-alt`
  (REST 4100, WS 2667, client 5174, PGlite in `packages/server/.data-alt`) launched through a small Node script.
- The Browser pane stops the game loop while hidden; drive a headless Chrome over CDP instead (`--headless=new
  --remote-debugging-port=… --enable-unsafe-webgpu`). `window.__ewaWorld.walkTo(x, z)` walks the real prediction +
  server path; `window.__ewaWorld.debug()` snapshots pose, server pose, target, battle, toasts and party.
- A lost battle leaves the party at 0 HP by design (spec §30: walk back to a healer).

## Known open issues (render)

- Shader programs 107 against the §50.2.2 cap of 96; render targets 34 against 24 (the stock post chain
  plus 4 cascades cannot meet 24 — spec amendment needed with the measured breakdown).
- Leak test: textures and render targets +1/+1 after the first unload (a lazily created object outside
  the zone); geometries/programs/attributes return to baseline exactly.
- `dumpZone()` lacks `materials[].side`, scatter kind/tier/instanced and `lightSources`; billboards
  keep their albedo in `userData.ewaAlbedo`, which `dumpZone` does not read yet.
- DOF composite leaves a soft halo around sharp sprites (fix: feed `planeDist * (1 − mask)` as DOF depth).
- Height fog still pales close-ups; first-frame shader warm-up is ≈ 16 s synchronous (use `compileAsync`).
- GPU cost on the dev iGPU (Intel Gen-12) is 35–95 ms per frame at 1440×900 with the full post chain;
  the budget target is an RTX 3060 class GPU. Per-pass `passMs` does not resolve yet.
- Actors are procedural figures; the Quaternius GLB looks now exist in `public/models/` (≈ 3.1 units tall,
  need scaling) and can replace them.
- Server heightfield does not mark building footprints unwalkable; the client collider blocks them.

## Next steps, in order

1. Land client part 2 and drive the Mirevale + Mire Route slice with two accounts (meet, chat, trade,
   battle, clear Grove-Keeper Mira).
2. Render hardening pass on the open issues above; then the six §50.6 shots per zone and the hostile
   render audit `.design/audits/M2-render-audit.md` by a reviewer who did not write render.
3. `harness:budget` / `harness:shots` in the client (§50.2.3, §50.6.1) and the Playwright suites of §50.4.6–7.
4. M3: all 21 zones through the audit + leak + shots; league battles per `LEAGUE` entry.
5. M5: generate audio with the user's key, then the accessibility and performance passes.
