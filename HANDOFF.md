# HANDOFF — Ewamon Remastered (as of 2026-10-06, after the finish plan's phases A–E)

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
  visible. Use headless Chrome over CDP instead: `chrome.exe --headless=new --remote-debugging-port=9446
  --enable-unsafe-webgpu --enable-gpu --ignore-gpu-blocklist --window-size=1440,900 --user-data-dir=<scratch>` and
  `node scripts/cdp.mjs <steps.mjs> --shots <dir>` (eval / screenshot / keys / navigate). In the client,
  `window.__ewaWorld.walkTo(x, z)` walks the real prediction + server path and `.debug()` snapshots pose, server
  pose, target, dialogue, battle, toasts and party. The render sandbox is `pnpm --filter @ewa/render sandbox`
  (port 5180; `?zone=<id>`, `&interior=<pocket id>&at=arena`, `?demo=battle`, `window.__ewaSandbox`).
- Another Claude session (the user's playtest session) works in the worktree `claude/wonderful-nightingale-29f3d5`
  and runs the playtest server/client on 4000 / 2567 / 5173. Use the isolated pair `node scripts/dev-alt.mjs
  server|client` (REST 4100, WS 2667, client 5174, PGlite `packages/server/.data-alt`; `.claude/launch.json`
  `ewa-server-alt` / `ewa-client-alt`). Coordinate file ownership with that session before big edits.
- A dev account at any story point: stop the PGlite server, then `DATA_DIR=./.data-alt pnpm --filter @ewa/server
  seed:progression <act1|act2|act3a|act3b|act3c> <username> --password <pw>`.


## Status (2026-10-06)

Everything below is on `main`; `pnpm check` is green (timing-sensitive tests can fail under machine load and pass alone).

| Area | State | Proof |
|---|---|---|
| core | 1,000-battle singles fuzz byte-identical through every phase; doubles behind `slots: 2` with their own fuzz; capLevel / noExp for the tower | `npx vitest run packages/core` |
| content | 131 species / 68 families obtainable (130 legacy + post-legacy additions in `.design/additions/species.js`, e.g. hollowmane #131); 21 zones; interiors for every town building (8 themed gym halls with puzzles, the 4-chamber league hall); 39 TMs, 6 stones, 30 achievements, 12 league rematch teams, Cut/Strength obstacles, water slots; town arrival points | `pnpm --filter @ewa/content run validate` |
| server | interiors (door warps, per-player gates, switches, hall arenas), story grants, quests incl. restoreZone / deliverItem, TMs / tutor / evolve, trade evolutions, shinies, achievements, weather, doubles, surf / fishing / obstacles / bike, raids resync, fast travel + visited flags, ranked queue, rematches, battle tower, password reset + email verification | `npx vitest run packages/server` |
| progression | Acts I–III + all 12 league fights headless, 0 desyncs, final `GET /me` has 8 badges + Wardens + Champion + 33 beats + 8 legendaries | `pnpm test:progression` (~41 min) |
| client | every server system has UI: halls, quest journal, map + minimap + travel, raids, rankings / history / profiles, bag, password reset, tutorial, ranked, tower, doubles menu, fishing prompt, evolution sequence | `npx vitest run packages/client`; Playwright `client-e2e` |
| render | interiors, doubles stage, shiny glow, surf ripple, weather, art pass (golden-hour dusk, moon shadows, grain), density dressing, neighbour skirt, fixed light layout + off-scene zone prepare (preloaded handover 68–196 ms), device-lost recovery | `npx vitest run packages/render`; `.design/audits/M3-render-audit.md` |
| audio | all 366 jobs built from 58 user-approved CC0 downloads (72.73 MiB of 80); credits + licences shipped; helper scripts in `tools/audio-pipeline/cc0-tools/` | `npx vitest run tools/audio-pipeline`; `IMPLEMENTATION-NOTES.md` "Phase E4 downloads" |

## The finish plan

**A** interiors + themed gym halls + correct arenas → **B** story-complete → **C** missing UI → **D** systems →
**E** art, CC0 audio, release. A–D are DONE. E: E1–E7 DONE (E4 needs a human listen; the M3 audit needs its independent review).

## Open items, in order

1. **Audio — a human listen**: nothing was auditioned by ear. In order: the grove, marrow and champion loop seams
   (non-repeating pieces joined with a 1.5–2 s fade; grove plays first), battle / victory seams, the short sky / elite /
   gym loops, derived threat / biome / night layers, creature cries, stinger starts, tiled ambience beds, arcade-ish
   synthetic Kenney sfx next to the orchestral music. Raw downloads live in `assets-src/audio/cc0/` (gitignored).
2. **Handover**: preloaded 42–46 ms, cold 0.69–0.74 s, prepare worst frame 67 ms (all within SPEC on the dev iGPU).
   Left: the prepare takes 3–4 s and starts 48 m from an edge — a bike can outrun it (short hitch at the crossing);
   `ScatterMesh` relies on two three internals (re-check on a three upgrade).
3. **M3 audit**: re-shoot the eight towns' "spawn" shots (they now stand on the plaza arrival point:
   `pnpm --filter @ewa/client harness:shots -- --set M3 --zone <town>`), then an independent reviewer pass (§50.6
   requires one who did not write render). Known weak spots: grass tufts stay green on sand/snow (needs per-biome
   tuft textures), tall grass looks alike in every biome, noon highlights are dim, three zones fail the asset audit's
   light-housing rule (galvan_route, siege_route, umbral_observatory).
4. **First frame**: ~25 s on the dev iGPU (SPEC 2.5 s on the reference GPU) — mostly the synchronous shader warm-up.
5. Smaller: no bicycle model or surf pose; the DOF speckle in 4 m close-ups (custom DOF node); two trainers fighting
   as a doubles pair; a hall warp tile can be pressed through a wall (no line-of-sight rule); used email tokens are
   never purged; a tower run lives in server memory.
6. Deployment is undecided (the user's call).
