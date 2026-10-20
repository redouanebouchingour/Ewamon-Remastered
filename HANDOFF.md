# HANDOFF — Ewamon Remastered (as of 2026-10-12, after the finish plan's phases A–E and the post-plan additions)

This file is the single entry point for whoever continues the build. Read it, then
`.design/PLAN.md` (approved plan) and `.design/SPEC.md` (BINDING contract, assembled from
`.design/spec/*.md` by `node .design/spec/assemble.mjs`; any change to a part file needs a
`.design/spec/CHANGELOG.md` entry in the same commit).

## Working rules

- Repo: `C:\Users\Flowmatic - Redouane\Ewamon-Remastered`, branch `main`. **Work directly in the main checkout on
  `main`** (the user's call, 2026-10-08): no side worktrees or feature branches. When another session has uncommitted
  files, stage your own paths explicitly (never `git add -A`). From 2026-09-23 to 2026-10-06 work was done in the
  worktree `.claude/worktrees/wonderful-nightingale-29f3d5` (branch `claude/wonderful-nightingale-29f3d5`); it still
  exists but is stale (last commit `80571df`, 2026-10-06) and everything in it is on `main`.
- `assets-src/creatures`, `assets-src/models` and `tools/sprite-pipeline/.cache` are gitignored: they exist only in the
  main checkout. A worktree would need Windows directory junctions to them (`New-Item -ItemType Junction`).
- Old game (read-only reference): `C:\Users\Flowmatic - Redouane\Ewamon`. Legacy data copies: `.design/legacy/`.
  `.design/legacy/ewamon.js` stays verbatim: post-legacy species go in `.design/additions/species.js`, new moves in
  `.design/additions/moves.js`, legacy row patches (learn levels, signature moves, battle forms) in
  `.design/additions/patches.js`.
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
- The user's playtest server/client may be running on 4000 / 2567 / 5173. Use the isolated pair `node scripts/dev-alt.mjs
  server|client` (REST 4100, WS 2667, client 5174, PGlite `packages/server/.data-alt`; `.claude/launch.json`
  `ewa-server-alt` / `ewa-client-alt`).
- Dev accounts. PGlite allows **one writer**: stop the dev server first, or concurrent opens corrupt the WAL.
  - At any story point: `DATA_DIR=./.data-alt pnpm --filter @ewa/server seed:progression <act1|act2|act3a|act3b|act3c>
    <username> --password <pw>`.
  - A creature: `pnpm --filter @ewa/server grant:creature <username> <species> <level> [--moves ...] [--box] [--shiny]`
    (the moves it knows at that level, dex marked caught), or `grant:creature <username> all <level> [--missing]` (one of
    every species into the box).
  - An item: `pnpm --filter @ewa/server grant:item <username> <item> <qty> [--set]`.
- A new species can push the sprite planner over the atlas cap through its spawn zone (veilpup: ascent_route made it
  duplicate 6 species, skyrend did not). A signature move needs a cinematic entry and a portrait
  (`pnpm --filter @ewa/sprite-pipeline portraits`); `signatures.test` fails without them.


## Status (2026-10-11)

Everything below is on `main` at `5ec964f`; `pnpm check` is green (230 files / 2,110 tests; timing-sensitive tests can
fail under machine load and pass alone).

| Area | State | Proof |
|---|---|---|
| core | 1,000-battle singles fuzz byte-identical through every phase (battle forms, honor, Majin / Tenjin all optional with defaults); doubles behind `slots: 2` with their own fuzz; capLevel / noExp for the tower; battle forms (`formChange`, form signature moves, `Action.transform`); honor ledger (`honor` event, 37 event kinds) | `npx vitest run packages/core` |
| content | 138 species / 72 families obtainable (130 legacy + 8 post-legacy, see below); 197 moves; 21 zones; interiors for every town building (8 themed gym halls with puzzles, the 4-chamber league hall); 39 TMs, 6 stones, 30 achievements, 12 league rematch teams, Cut/Strength obstacles, water slots; town arrival points; 13 Majin / Tenjin species and the two bands in the story | `pnpm --filter @ewa/content run validate` |
| server | interiors (door warps, per-player gates, switches, hall arenas), story grants, quests incl. restoreZone / deliverItem, TMs / tutor / evolve (incl. the honor split, migration `0005_honor`), trade evolutions, shinies, achievements, weather, doubles, surf / fishing / obstacles / bike, raids resync, fast travel + visited flags, ranked queue, rematches, battle tower, password reset + email verification; denser wild spawns (80 / 20 / 36 alive on route / town / story) | `npx vitest run packages/server` |
| progression | Acts I–III + all 12 league fights headless, 0 desyncs, final `GET /me` has 8 badges + Wardens + Champion + 33 beats + 8 legendaries (legs act3b / act3c re-run 2026-10-13 with hyoryu, 0 desyncs; the full walk's last run: 2026-10-06, **before** the Majin / Tenjin story grants and trainer bands) | `pnpm test:progression` (~41 min) |
| client | every server system has UI. The **Broadcast UI** (2026-10-11): carbon panels, paper white, one hot orange for selected / press / focus, type colour as the hero, Barlow Condensed over Barlow, 19 type icons instead of letter codes, canvas HUD in the same language, battle command deck, five top-bar links + More, Party as a card row. Signature-move cinematics, the Majin / Tenjin bond cinematic + transform toggle + band tutorial, the honor meter | `npx vitest run packages/client`; Playwright `client-e2e` |
| render | interiors, doubles stage, shiny glow, surf ripple, weather, art pass, density dressing, neighbour skirt, fixed light layout + off-scene zone prepare, device-lost recovery; 14 move motion styles (63 → 64 VFX ids with `form_tenjin`); battle-form auras (flames / light, sigil ring, rim); M3 town art for Saltmourn, Skyrend, Cinderhold, Stormrook (`albedoCal`, `Palette.grassTone`, `lava_glow` emissive, plaza clutter) | `npx vitest run packages/render`; `.design/audits/M3-render-audit.md` |
| sprites | 152 sprite keys (138 species + battle forms), 76 atlases, creature byte ceiling 41,943,040 (40 MiB, raised 2026-10-13 for hyoryu) | `pnpm --filter @ewa/sprite-pipeline` tests |
| arena PvP | out-of-world battles: Standard, Level 50, Ranked (Lv 50, the only rated kind), Weekly Cup, friend invites, AI Training; healed copies (no hp / exp); a dedicated `arena` room + stadium; the in-world challenge and Mirevale ranked queue unchanged | `npx vitest run packages/server/test/arena.test.ts packages/client/test/arena.test.tsx`; SPEC §30.4.10, §20.9.9d |
| audio | 380 jobs (188 sfx ids) from the 58 user-approved CC0 downloads, no new downloads since; 73.33 MiB of 80; credits + licences shipped; 12 signature-move premixes (`sig_*`) and 2 bond sounds | `npx vitest run tools/audio-pipeline`; `IMPLEMENTATION-NOTES.md` "Phase E4 downloads" |

## Since 2026-10-06 (post-plan additions)

- **Species #131–137** (`.design/additions/species.js`, each from the user's reference art): hollowmane #131
  (Ghost/Fighting, the_rift night), dustcub #132 → badlander #133 (Ground → Ground/Dark, deepcut_route) or lawlander #137
  (Ground/Fighting), veilpup #134 → hollowolf #135 (Psychic → Psychic/Cosmic, skyrend), castlemaw #136 (Dark/Steel,
  umbral_observatory night).
- **hyoryu #138** (2026-10-13, inspired by Daiguren Hyorinmaru): an Ice/Dragon legendary, the ninth static (eclipse_shrine
  (-70, -70), L60, after the title; on ascent_route the sprite planner duplicated 6 species). Its Majin Form is the first
  form that changes types (Dragon/Dark: core `BattleFormDef.types` / `formTypes`, read by the type chart, STAB, status
  and weather immunity, the orb bonus, the battle plate, the move menu's effectiveness and the dex). Signature move
  Crimson Lotus Prison (Dragon 120, freeze) with its cinematic (`sigfx/Lotus.tsx`), portrait and `sig_crimson_lotus_prison`
  premix. Ships with still sprites only (the other legendaries animate). The creature byte ceiling went to 40 MiB and
  §40.1.6.4 test 5 to 6.5° to keep every sprite at the top rung.
- **Honor ledger**: `CreatureInstance.honor` (−10..10) moves in battle (Dark-type hit −1, wild KO −1, catch +1, won duel
  +2; never in the tower); dustcub evolves into lawlander (high) or badlander (low). Honor meter in the creature detail.
- **Signature moves**: one for every legendary and mythical plus hollowmane's Hollow Crescent and castlemaw's Vendetta
  Volley (12), each with an SVG/CSS cut-in cinematic synced to the battle timeline's clock and its own layered sound.
  A signature move belongs to its owner only and is pinned as the newest learnable move, so a met legendary knows it.
- **Move motion styles**: all 166 damaging moves get one of 14 3D particle motions in their type's colours.
- **Majin / Tenjin** (`.design/majin-tenjin.md`): a form change once per battle per trainer, with the Majin Band (below
  half hp; beat 19 `sables_turn`) or the Tenjin Band (at or above half; beat 21 `the_requisition`). 7 Majin species
  (incl. hollowmane and castlemaw, whose Rage Forms became Majin, and zenryu's Super Saiyan form) and 6 Tenjin. Wild
  Majin transform alone. Trainers use it: Hollis (debut, beat 22), Wardens Veil / Aurelia, Comptroller Varn, Champion Zeon.
  Not in the Battle Tower or raids.
- **Broadcast UI** (direction C, chosen from three mockups; see the auto-memory "Broadcast UI direction": no green,
  type icons not letter codes, real sprites not initials).
- **M3**: the independent review landed (2026-10-06, `c16d772`, section R of the audit); the four towns below the bar
  and the green tufts are answered "Fixed (to judge)" (2026-10-11).
- **Arena PvP** (2026-10-12, like the old game's battle page): `/play/pvp` (More → PvP, key K; "Open PvP" on Rankings).
  Queue Standard / Level 50 / Ranked / Weekly Cup from anywhere (a top-bar chip while queued), invite an online friend,
  or start AI Training. A match moves the player out of the zone into a fresh `arena` room (server `ArenaRoom` /
  `arenaQueue` / `arenaLobby`, REST `/arena/*`) rendered in render's stadium (`createArenaBackdrop`, sandbox
  `?demo=arena`); Back to world returns them where they stood. Teams are healed synthetic copies (`atLevel`), so nothing
  about a creature is written; only Ranked moves the rating. Weekly Cup rules rotate Monday 00:00 UTC (content
  `weeklyCup` / `cupRefusal`). A reload mid battle: `/zone/enter` 409 `inArena` → `/arena/rejoin`.
- **Old-game encounters** (2026-10-20, the user's call): no wild creature stands in the overworld any more; walking in
  tall grass (the zone plan's patches) or surfing rolls a random encounter, and an unbeaten trainer who sees the player
  (6 m, clear line) holds them: "!" over the trainer, it walks up, its lines, then the fight. Server env
  `WILD_ENCOUNTERS=grass|overworld` and `TRAINER_SIGHT=on|off` (defaults `grass` / `on`; `testEnv` keeps `overworld` /
  `off`). SPEC §30.3; `packages/server/src/rooms/encounters.ts`, client `scene/trainerApproach.ts`.
- **Tuning / dev**: denser wild spawns; `grant:creature` / `grant:item`; the tower test's Wonder Guard flake fixed.

## The finish plan

**A** interiors + themed gym halls + correct arenas → **B** story-complete → **C** missing UI → **D** systems →
**E** art, CC0 audio, release. A–D are DONE. E: E1–E7 DONE (E4 needs a human listen; the M3 audit is not yet answered).

## Open items, in order

1. **Re-run `pnpm test:progression`**: the last recorded run predates the Majin / Tenjin band grants (beats 19 / 21),
   the trainer bands, the denser spawns and the arena changes to the battle coordinator / zone room.
   The walker still runs with `testEnv`'s visible spawns and no trainer sight; to cover the new defaults it would
   train by walking grass patches and answer `trainerSpotted` while walking.
2. **Audio — a human listen**: nothing was auditioned by ear. In order: the grove, marrow and champion loop seams
   (non-repeating pieces joined with a 1.5–2 s fade; grove plays first), battle / victory seams, the short sky / elite /
   gym loops, derived threat / biome / night layers, creature cries, stinger starts, tiled ambience beds, arcade-ish
   synthetic Kenney sfx next to the orchestral music, the 12 `sig_*` premixes (played at +6 dB) and the 2 bond sounds.
   Raw downloads live in `assets-src/audio/cc0/` (gitignored).
3. **M3 audit**: the independent review is done; its R.6 lists what closes the box. Answered so far: R.5 blockers 3 and 4
   (the four towns, the tufts), pending the user's "as good as Mirevale" sign-off on the re-shot arrival views in
   `.screenshots/audit/M3/<zone>/` (the zones' `index.json` still lists the earlier run). Still open: blocker 1 (the
   player avatar hides the near battler), blocker 2 (explicit rig indices per row, §50.6.1 Spec answer + re-shoot),
   blocker 5 (41 unanswered M2 findings), blocker 6 (every M3-* / R-* id answered; per-zone format as a Spec amendment),
   and the majors in R.5 (e.g. terrain through forgewall's battle ring, eclipse_shrine and celestial_spire look the same,
   paved galvan wilderness, tall grass alike in every biome, unhoused lights in galvan_route / siege_route /
   umbral_observatory). The budget line (`--budget-ms 1` on the reference machine) is not met by iGPU files.
4. **Handover**: preloaded 42–46 ms, cold 0.69–0.74 s, prepare worst frame 67 ms (all within SPEC on the dev iGPU).
   Left: the prepare takes 3–4 s and starts 48 m from an edge — a bike can outrun it (short hitch at the crossing);
   `ScatterMesh` relies on two three internals (re-check on a three upgrade).
5. **First frame**: ~25 s on the dev iGPU (SPEC 2.5 s on the reference GPU) — mostly the synchronous shader warm-up.
6. Smaller: no bicycle model or surf pose; the DOF speckle in 4 m close-ups (custom DOF node); two trainers fighting
   as a doubles pair; a hall warp tile can be pressed through a wall (no line-of-sight rule); used email tokens are
   never purged; a tower run lives in server memory. Majin / Tenjin "later": a species with both forms, the mythical
   pair (Lumyth Tenjin, Noxmyth Majin).
7. Arena PvP left open: never run on Redis with several server processes (tests use local presence); "busy" does not
   see a tower run between fights or a crossing in progress (the arena start's transaction is the last guard); the
   battle camera's narrow framing shows mostly the arena floor (the bowl shows on cut-aways); no arena spectating or
   seasons; Weekly Cup wins earn nothing beyond pvp trainer exp (the old game's cup milestones were not carried).
8. Deployment is undecided (the user's call).
