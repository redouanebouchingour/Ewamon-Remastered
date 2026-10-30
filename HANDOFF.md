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
  server|client` (REST 4100, WS 2667, client 5174, database `ewa_alt` on the dev Postgres; `.claude/launch.json`
  `ewa-server-alt` / `ewa-client-alt`).
- Database: PostgreSQL only (PGlite was removed 2026-10-27). `docker compose up -d postgres` runs it on
  localhost:5432 (`ewa`/`ewa`); `pnpm dev`, the dev scripts and `pnpm test` (a scratch database per test file) all use
  it. Production sets `DATABASE_URL`.
- Dev accounts (the scripts take `DATABASE_URL`, default the dev database `ewa`; the alt pair's is `ewa_alt`):
  - At any story point: `DATABASE_URL=postgres://ewa:ewa@localhost:5432/ewa_alt pnpm --filter @ewa/server seed:progression <act1|act2|act3a|act3b|act3c>
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
| content | 179 species / 88 families obtainable (130 legacy + 49 post-legacy, see below); 199 moves; 21 zones; interiors for every town building (8 themed gym halls with puzzles, the 4-chamber league hall); 39 TMs, 6 stones, 30 achievements, 12 league rematch teams, Cut/Strength obstacles, water slots; town arrival points; 13 Majin / Tenjin species and the two bands in the story | `pnpm --filter @ewa/content run validate` |
| server | interiors (door warps, per-player gates, switches, hall arenas), story grants, quests incl. restoreZone / deliverItem, TMs / tutor / evolve (incl. the honor split, migration `0005_honor`), trade evolutions, shinies, achievements, weather, doubles, surf / fishing / obstacles / bike, raids resync, fast travel + visited flags, ranked queue, rematches, battle tower, password reset + email verification; denser wild spawns (80 / 20 / 36 alive on route / town / story) | `npx vitest run packages/server` |
| progression | Acts I–III + all 12 league fights headless, 0 desyncs, final `GET /me` has 8 badges + Wardens + Champion + 33 beats + 8 legendaries (full walk re-run and re-recorded 2026-10-20 on the sculpted terrain: 6/6 files in 2583 s, act1 563 s, act2 803 s, act3a 282 s, act3b 472 s, act3c 220 s, halls 9/9, 0 desyncs; `packages/server/test/fixtures/progression/PROGRESS.md`) | `pnpm test:progression` (~41 min) |
| client | every server system has UI. The **Broadcast UI** (2026-10-11): carbon panels, paper white, one hot orange for selected / press / focus, type colour as the hero, Barlow Condensed over Barlow, 19 type icons instead of letter codes, canvas HUD in the same language, battle command deck, five top-bar links + More, Party as a card row. Signature-move cinematics, the Majin / Tenjin bond cinematic + transform toggle + band tutorial, the honor meter | `npx vitest run packages/client`; Playwright `client-e2e` |
| render | interiors, doubles stage, shiny glow, surf ripple, weather, art pass, density dressing, neighbour skirt, fixed light layout + off-scene zone prepare, device-lost recovery; 14 move motion styles (63 → 64 VFX ids with `form_tenjin`); battle-form auras (flames / light, sigil ring, rim); M3 town art for Saltmourn, Skyrend, Cinderhold, Stormrook (`albedoCal`, `Palette.grassTone`, `lava_glow` emissive, plaza clutter) | `npx vitest run packages/render`; `.design/audits/M3-render-audit.md` |
| sprites | 199 sprite keys (180 species + battle forms), 100 atlases, creature byte ceiling 55,574,528 (53 MiB, raised 2026-10-27 for kykaiser_tenjin; 52 MiB from 2026-10-26 for the type-gap lines; 44 MiB from 2026-10-25, 41 MiB from 2026-10-24); 11 animated legendaries, 22 flipbook sides, anim ceiling 25 MiB (raised 2026-10-26 for astaroth) | `pnpm --filter @ewa/sprite-pipeline` tests |
| arena PvP | out-of-world battles: Standard, Level 50, Ranked (Lv 50, the only rated kind), Weekly Cup, friend invites, AI Training; healed copies (no hp / exp); a dedicated `arena` room + stadium; the in-world challenge and Mirevale ranked queue unchanged | `npx vitest run packages/server/test/arena.test.ts packages/client/test/arena.test.tsx`; SPEC §30.4.10, §20.9.9d |
| audio | 380 jobs (188 sfx ids) from the 58 user-approved CC0 downloads, no new downloads since; 73.33 MiB of 80; credits + licences shipped; 15 signature-move premixes (`sig_*`, `sig_thermal_shock` since 2026-10-30) and 2 bond sounds | `npx vitest run tools/audio-pipeline`; `IMPLEMENTATION-NOTES.md` "Phase E4 downloads" |

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
- **The Harmonic Cycle: elemutt #142 → katamute #143 → ravatar #144** (2026-10-25, the user's design and Gemini art):
  a mythical Normal line given early by quest q13 (Mirevale berry-gardener; win 3, witness 5; Lv 5), evolving at 16
  and 36. New abilities Inner Chi (non-contact ×1.3 at full hp) and Stance Change (contact: Def +1, non-contact: Spd
  +1, at most +2 each per switch-in): there is no Sp. Atk / Sp. Def, so "special" means non-contact. Ravatar's held
  relic opens a form as it lands (core `battleForms` + `heldItem`): Water, Earth (Ground/Rock), Fire, Air (Flying);
  the Vial of Spirit Water opens the Normal/Psychic Avatar State below 30% hp. Cosmic Convergence (100, non-contact)
  takes the form's type (`typeFromForm`, core `formMove`); in base form it has a 20% chance of raise_all. The four
  relics wait in shrines that take over one house hall each in saltmourn, marrowdig, cinderhold and skyrend (rune gate
  on the Champion, a Lv 68 to 72 guardian, rune gate on the guardian, the relic; `requires` on the trainer and the item
  because the interact range reaches past a gate; the fight forms at the door approach). Quest q14 (the Champion + the
  four guardians) gives the Vial. Stills only; the ravatar sources are git-ignored like all art, the keyed PNGs and
  the keying script are also in the user's `Downloads/avatar-postgame/keyed`.
- **Kykaiser #145** (2026-10-26, the user's art): kygra's evolution at 45, still Water (108 / 132 / 98 / 122, Swift
  Swim / Intimidate). Kygra is a legacy row, so the evolution is a `.design/additions/patches.js` patch (the generator
  now takes `evolvesInto` / `evolvesAt` there) with kygra's learn levels pinned. Evolution only, no table. The white
  backgrounds were keyed by border flood, the white claw tips that touch the background restored by hand; the back is
  mirrored to face right. 45.79 MB of the 44 MiB ceiling, top rung.
- **The type-gap lines #146 to #179** (2026-10-26): 14 families, 34 species aimed at the thinnest types and the
  missing combinations (concepts in `.design/type-gap-concepts.pdf`): five three-stage lines (puffinch, sproutgrub,
  tuskling, twinklit, burrowyrm), corvlet's honor split at 30 (augurvane Psychic/Flying or ravenmourne Dark/Flying, the
  meter reads Thief / Oracle) and eight two-stage lines. Comet Tap is the first 40-power Cosmic move. Every root spawns
  in one table (roster-coverage §6); the tables were chosen with the sprite planner so no zone duplicates an atlas and
  every ecosystem migration route stays drawable (galvan_route broke rimeidol, yaschamp and wooltug). The sprites are
  low-res pixel art from gpt-image (`.design/imagegen/PIXEL-STYLE.md`, tools in `pixel-tools/`): 128 px sources
  enlarged 8x nearest into `assets-src/creatures/`, copies of the 128 px files in `.design/imagegen/concepts/`.
  52.88 MB at the top rung: the creature ceiling went to 52 MiB (the user's call), and acceptance test 4 gives these
  34 pixel-art species an edge-share bound of 90 %. Existing moves and abilities otherwise; no signature moves.
- **kelvyre #181** (2026-10-30, inspired by Mewtwo with a twist): a Fire/Ice mythical made in a lab, its body split
  down the middle, one half living fire and the other glacial ice. Pixel-art stills (gpt-image, low budget; concept in
  `.design/imagegen/concepts/kelvyre/`), the new ability Thermal Divide (no burn or freeze, Fire and Ice moves deal
  half), the reward of the new postgame quest q15 The Divided Core (Forgewall: the Champion, 140 witnessed, 30 wins;
  L60). Signature move Thermal Shock (Ice 120, 30 % burn) with its cinematic (`sigfx/Thermal.tsx`: the fire half of
  its embers turns toward the target in both views), portrait and premix `sig_thermal_shock`. Atlas `a-104`, 54.84 of
  55.57 MB (0.73 MB left). No 3D model yet: it renders as a sprite where the others have rigs.
- **astaroth #180** (2026-10-26, inspired by Asta and the devils of Black Clover): a Dark/Ghost legendary, the tenth
  static (L60 after the title), animated front and back from the user's two videos (keyed loops, 32 and 18 pages).
  It waits in the **Sunken Crypt**, a hidden building of its own at the back of Vesperveil's graveyard (content
  `data/hideouts.ts`: a layer outside the zone plan, so nothing reshuffles; `LegendaryStatic.interior` puts the static
  in the crypt's hall). Inside: the warden Morwen, an anti-magic seal that opens on the Champion, the throne chamber
  in the new `abyss` theme with a five-leaf clover sigil under the arena. The gravetender points at it after the
  Champion. Signature move Demon Lord's Descent (Dark 120, flinch) with its cinematic, portrait and premix. The anim
  ceiling went to 25 MiB (the user's call). Progression act3b wins it.
- **The Dex upgrade** (2026-10-26): tabbed entries (Overview, Research, Moves, Matchups, Habitat, Evolution, Forms) with a
  form / variant / shiny / alpha viewer and split evolutions as branches with their conditions; sorting, a list view,
  more filters and arrow keys; a habitat atlas, compare, rewards; Listen (type cry + the entry read aloud); deep links
  from battle results, the professor, creature details and hatches. Research per species (content `data/research.ts`,
  server `game/research.ts`, migration 0025) gates moves at level 2 and matchups / compare at 3, gives a catch bonus
  from 3 and 1/256 shiny odds at 5; completion rewards (content `data/dexRewards.ts`) pay money, items, earned titles
  and stamp looks. SPEC §20.9.5, §30.9.4.
- **cryptorb #139 → ultraze #140 / vysion #141** (2026-10-24, inspired by Ultron and Vision, Marvel): an Electric/Ghost
  orb of unknown code (ash_route night rare L9–11) that splits by honor at 34 like dustcub: vysion (Steel/Psychic,
  High Honor) or ultraze (Steel/Dark, Low Honor). Existing moves and abilities only; still sprites.
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
- **Zone sculpts** (2026-10-20): every zone has its own hand-authored landform (content `sculpt.ts` + `data/sculpts.ts`,
  SPEC §3.11 "Zone sculpts", §10.5.5): cliffs, plateaus, terraces, ravines, rivers with bridges, lakes and coasts, crater
  rims, ramparts, walls and towers, rock spires, winding roads with ramps, authored tall grass (where the wild
  encounters are) and a travellers' camp on every route. Edit a shape, then `pnpm --filter @ewa/content zone-map <dir>
  <zone>` (top-down debug map: unreachable ground shows magenta) and `pnpm --filter @ewa/content validate` (rule 12
  proves reachability). The sandbox's `&far=<m>` gives a survey camera. A handover keeps the lateral coordinate, so
  where a neighbour's entry line is cut off the edge is closed with `shoulder` (SPEC §3.11 "Handover landings");
  `npx vitest run packages/server/test/handover-landing.test.ts` checks every link both ways in seconds.

## LLM features (branch `uniforcemusic/llm`, 2026-10-24)

A local model (`gemma4-e2b` under llama.cpp, docker service `llm`, reached at `/npc/llm/v1`) drives ten features, one
commit each after `2ac5de4`. The rules they share: the model only words things or picks from a fixed menu; every
effect on the save goes through a capped, audited server route; facts come from content and the save, and model output
is checked against them (`talk/professor.ts` checker); every feature has a template fallback when the model is down or
slow; LLM calls stay in the client (`packages/client/src/talk/llm.ts`: `chatOnce`, `streamChat`, `noDashes`), so server
tests never need a model. Each module's header comment records what was measured on the real model. Details per package
in the `IMPLEMENTATION-NOTES.md` sections dated 2026-10-24 (not in the SPEC: the NPC talk stack lives in the notes).

| # | Feature | Where | Gate / storage |
|---|---|---|---|
| 1 | NPCs remember you; town reputation and gossip | `talk/npcMemory.ts`, server `game/npcMemory.ts` | `NPC_TOOLS`; migration 0021 |
| 2 | Villager favours (server-generated, capped rewards) | `talk/npcQuest.ts`, server `game/npcQuests.ts` | `NPC_TOOLS`; 0022 |
| 3 | Battle commentator + trainer banter | `battle/commentator.ts`, `talk/commentary.ts` | settings toggles |
| 4 | Haggling with shopkeepers | `talk/haggle.ts`, server `game/haggle.ts` | `NPC_TOOLS`; deals in memory |
| 5 | Prof. Wynn (L) + "Why did I lose?" | `talk/professorFacts.ts`, `talk/professor.ts` | client only |
| 6 | Talk to your own Ewamon (Y), follower chatter | `talk/buddy*.ts`, `world/BuddyTalk.tsx` | client only |
| 7 | A recurring rival on the routes | server `game/rival.ts`, `talk/rival.ts` | `RIVAL=on|off|always` (off in testEnv); 0023 |
| 8 | Town crier + rumour board | server `game/rumours.ts`, `talk/rumours.ts` | cached per UTC day |
| 9 | Adventure journal | server `game/journal.ts`, `talk/journal.ts` | 0024 |
| 10 | Voices (local speech synthesis) + push-to-talk (backquote) | `packages/client/src/voice/` | both off by default; push-to-talk sends audio to Google, the setting says so |

- **Migrations:** main's `0020_camps` arrived with the merge `61f3049` after 0021 existed. A database that applied
  0021+ before the merge skips 0020 (drizzle only applies migrations newer than the last one): `.data-alt2` is such a
  database (no `camp_raids`); recreate it. The docker stack bakes `packages/persist/drizzle` into its image: rebuild it
  (`docker compose up -d --build`) so its server applies 0020 to 0024.
- **Known model weak spots:** villagers' faint lines sometimes read as if the player's creature fell (~5 in 24); the
  buddy's temperament barely shows in model wording (templates carry it); the frustrated rival copies its example;
  journal pages on quiet days read like the template. The commentator uses templates only for super-effective, KO and
  status moments, because the model stated wrong type facts there.

## The finish plan

**A** interiors + themed gym halls + correct arenas → **B** story-complete → **C** missing UI → **D** systems →
**E** art, CC0 audio, release. A–D are DONE. E: E1–E7 DONE (E4 needs a human listen; the M3 audit is not yet answered).

## Open items, in order

1. **Progression walker on the new defaults**: `pnpm test:progression` was re-run and re-recorded on 2026-10-20 on the
   sculpted terrain (every leg passes, 0 desyncs; the first try stranded the walker on a caldera rim and a pinnacle top
   after a handover, fixed in the sculpts, see PROGRESS.md session 3). It covers the Majin / Tenjin band grants, the
   trainer bands and the arena changes, but still runs with `testEnv`'s visible spawns and no trainer sight; to cover
   the new defaults it would train by walking grass patches and answer `trainerSpotted` while walking.
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
8. Deployment: a Strato VPS (4 cores, 8 GB, Ubuntu 26.04) with PostgreSQL, set up by hand (no Plesk); PGlite is
   gone from the repo. `LLM_THREADS` defaults to 2 so llama.cpp leaves cores for the 20 Hz tick.
