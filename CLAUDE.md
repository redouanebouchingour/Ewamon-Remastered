# CLAUDE.md — Ewamon Remastered

Start with `HANDOFF.md` (state, open items, dev tips), then `.design/SPEC.md` (binding contract).

## Commands

- `pnpm check` — typecheck + lint + lint-rule tests + all tests + build. Green before every commit to `main`.
- `pnpm test:progression` — the headless story walk (Acts I–III + all 12 league fights, ~41 min); not part of `pnpm test`.
- `pnpm --filter @ewa/content run validate` — the content gate (137/137 obtainable, 71 families, heightfields, interiors).
- `npx vitest run packages/<pkg>` — one package. Timing tests (`perf/tick`, `aoi-fanout`, some UI tests) can fail under
  a loaded machine and pass alone; re-run them alone before calling them broken.

## Laws (lint-enforced: `eslint.config.js`, `eslint/local-rules.js`)

- `@ewa/core` imports nothing and iterates deterministically; client preview and server truth run the same bytes.
- `@ewa/content` depends on `@ewa/core` and zod only. `@ewa/render` imports only `three`. The server never renders.
  The client never imports server or persist. No inline styles in the client (`ewa/no-inline-style`).
- `packages/core/test/fuzz-digests.json` (1,000-battle singles fuzz) must stay byte-identical: new battle inputs are
  optional with defaults. Doubles have their own digests file.

## Rules of the build

- Any change to `.design/spec/*.md` needs a `.design/spec/CHANGELOG.md` entry in the same commit, then
  `node .design/spec/assemble.mjs` (the `scripts/check-spec-changelog.mjs` gate).
- Each package records spec deviations in its `IMPLEMENTATION-NOTES.md`.
- Content additions never become story gates and must keep the progression fixtures valid. `ZoneDef` npcs, trainers,
  items, lore, warps and spawn feed the layout RNG and the heightfield: moving one reshuffles that zone (plan fixture
  `packages/content/test/fixtures/r1-pre-move.json`, walker fixtures). Interiors, obstacles and arrival points are
  separate layers for that reason.
- Live checks: the in-app Browser pane stops the game loop while hidden; use headless Chrome over CDP
  (`scripts/cdp.mjs`) and the isolated dev pair (`scripts/dev-alt.mjs`, `.claude/launch.json` `ewa-*-alt`).
  `window.__ewaWorld.walkTo(x, z)` / `.debug()` drive and inspect the real client.
- Downloading files from the internet (e.g. CC0 audio packs) needs the user's explicit approval in chat.
