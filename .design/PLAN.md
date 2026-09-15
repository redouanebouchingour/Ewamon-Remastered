# Ewamon Remastered — Rebuild Plan

> Status: the approved plan. `.design/SPEC.md` is derived from it and is the binding
> implementation contract; where SPEC.md and this plan disagree, SPEC.md wins.

## Context

Ewamon (`C:\Users\Flowmatic - Redouane\Ewamon`) is a working creature-collector MMO — 226 commits, 42k lines, 130 species, 193 moves, a 21-zone Three.js overworld. It was built with earlier models and it shows. Three audits of the existing codebase found the ceiling is not the engine:

- **There is not one image texture in the entire 3D world.** `TextureLoader` is never called. Every surface is flat vertex colour on a `BoxGeometry`/`ConeGeometry(…,4)`/`IcosahedronGeometry(r,0)` primitive. Biomes differ only by a colour table.
- **No material reuse** — `new MeshStandardMaterial` per mesh across 122 call sites; outlines duplicate every mesh as a BackSide clone. A town is ~1,000–1,200 draw calls with no instancing, no LOD, no culling strategy.
- **One 2048² shadow map** over a single 92×92 ortho frustum. Nothing past ~46 units receives shadow. Lamps, lava, braziers and gym beacons are emissive materials — they cast no light at all.
- **Post stack is bloom plus a 15-line vignette shader.** No AO, IBL, SSR, TAA, DOF or volumetrics.
- **Battles are 2D PNGs on a PNG backdrop**, fully detached from the 3D world.
- Real defects: zone changes never dispose geometry (unbounded GPU leak), the HUD rebuilds its DOM inside the 60 Hz fixed step, badges are awarded **client-side** against the codebase's own server-authoritative invariant, and world presence is an untick'd relay whose fanout is 10·N·(N−1) msg/s.
- Whole subsystems are dead: quests, seasonal events, daily swarms and all 16 exploration hotspots are keyed to retired Kanto/TMJ zone ids (`pallet_town`, `bloom-route`) that no longer exist. They have never fired. 45 of 130 species appear nowhere in the world; `wraithtide`, `kygra`, `ripshell`, `bloomsprite` and `acier` are unobtainable.

The intent is a from-scratch rebuild at a genuinely high production bar, reusing the art (398 MB of consistent AI-generated creature illustrations, 4 rigged legendary GLBs) and the content data (species, moves, type chart), and rewriting everything else.

**Reference research.** The user's benchmark, `vibeslops.luckeysystems.com`, runs a hand-rolled WebGL2 renderer in a single ~104 KB inline script — no Three.js, no Babylon. Its AAA look comes from loading real AAA assets (`mtl_t6_wpn_ar_hk416_col/_nml`, `viewarm_usa_mp_fbi_*` — ripped Call of Duty albedo/normal/glow sets with JSON skeletal animation). The lever is art pipeline and lighting discipline, not engine choice. The user's own Table-Clash reached its bar through a *binding written spec* (`.design/SPEC.md`, 1133 lines: numbered art pillars, procedural PBR with channel-packed ORM, per-tier millisecond frame budgets, non-negotiables, and a "cut deliberately" list). **This plan follows that method.**

---

## Confirmed decisions

| | Decision |
|---|---|
| **Art direction** | HD-2D — 3D PBR environments, creatures as lit, shadow-casting pixel-art billboards |
| **Multiplayer** | True shared world: server-authoritative movement, AOI, shared spawns, shared raids, guilds |
| **Combat** | Turn-based, **repaired and deepened** — STAB, real accuracy rolls, all 24 effects, stat stages, weather |
| **Delivery** | Vertical slice first: Mirevale + Mire Route at 100 % final quality |
| **Story** | Completely new — new cosmology *and* new plot. Full story bible as a deliverable |
| **Platform** | Desktop only. No mobile concessions. WebGPU-first |
| **Audio** | AI-generated music + SFX via an API (user supplies key); pipeline build-step |
| **Stack** | New TypeScript pnpm monorepo, Colyseus + PostgreSQL + Drizzle, fresh DB, no migration |
| **Features** | Everything: core + social/guilds + economy/marketplace + live-ops/raids/battle pass |
| **Language** | English |
| **Location** | New local folder `Ewamon-Remastered`, fresh `git init`. GitHub later |
| **Roster** | All 130 obtainable, all 67 evolution lines completable |
| **Sprites** | Normalize + derive normal maps and emissive masks. 398 MB → ~30 MB |

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Renderer | **Three.js r186+ `WebGPURenderer`**, TSL shaders, `RenderPipeline` post stack | WebGPU is production-ready in 2026 (Safari 26 closed the last gap; ~95 % coverage, automatic WebGL2 fallback). Three.js development is now WebGPU-only; `WebGLRenderer` gets no new features. TSL compiles to WGSL or GLSL from one source |
| UI | **React + TypeScript**, one design system, zero inline styles | The old app ran four visual languages simultaneously |
| State | **Zustand** for UI, Colyseus schema for world state | Keep UI state and replicated state strictly separate |
| Multiplayer | **Colyseus** (rooms, schema delta-sync, matchmaking) + Redis presence | MIT, self-hostable, binary delta encoding, room model maps cleanly onto zones |
| Server | Node 22 + TypeScript, Fastify for REST | |
| Database | **PostgreSQL + Drizzle ORM** | The old fat Mongo player document caused `VersionError` races that forced retry wrappers and a rule that the renderer must not persist during battle. Normalized rows + row-level locking removes that class of bug |
| Build | **pnpm workspaces + Vite + `tsc -b`** | Mirrors Table-Clash, which works |
| Assets | glTF + **meshopt** + **KTX2/Basis** via `gltf-transform` | 4–6× VRAM reduction; the old build shipped 36 MB of pretty-printed base64 glTF and awaited all of it before first frame |
| Tests | **Vitest** across all packages, deterministic `core` sim tests | |

**Deliberately not chosen.** *Babylon.js* — heavier, and its tooling advantage does not pay for itself when the renderer is bespoke anyway. *PlayCanvas* — the cloud editor is its main draw and we are code-first. *Unity/Godot WebGL* — multi-megabyte runtimes, poor DOM/UI integration, and the existing content is JS data. *React Three Fiber* — reconciler overhead in the hot path of a 60 Hz world sim; React stays on the UI side of the canvas boundary. *MongoDB* — see above.

---

## Monorepo layout

```
Ewamon-Remastered/
├─ .design/               SPEC.md (binding), art-*.json, audits, story-bible.md, audio-bible.md
├─ packages/
│  ├─ core/               Deterministic game logic. Zero I/O, zero Three.js, zero React.
│  │                      Damage, stats, status, catch, EXP, evolution, type chart.
│  │                      Imported by BOTH client (preview) and server (truth).
│  ├─ content/            Species, moves, abilities, items, orbs, zones, encounters,
│  │                      league, quests, story beats, i18n. Typed + schema-validated at build.
│  ├─ protocol/           Wire schemas. Colyseus state classes + message types.
│  ├─ render/             Three.js: materials, lighting, post, sprite system, zone builder.
│  │                      No game rules, no network.
│  ├─ client/             React shell, UI, input, audio, scene orchestration.
│  ├─ server/             Colyseus rooms, Fastify REST, auth, matchmaking.
│  └─ persist/            Drizzle schema, migrations, repositories.
└─ tools/
   ├─ sprite-pipeline/    Normalize → alpha → normal map → emissive mask → KTX2.
   ├─ audio-pipeline/     Prompt → generate → normalize → loop-point → encode.
   └─ asset-audit/        Draw-call, triangle and texture-budget reporting.
```

The old `overworld.js` was 2,594 lines holding rendering, content, collision, camera, audio, story scripting, puzzles, networking, DOM journal HTML and minimap painting in one object literal. **The `core` / `render` / `client` boundary is the structural fix**; it is enforced by an ESLint import-boundary rule, not by convention.

---

## Art direction — the pillars

These go in `.design/SPEC.md` as binding. Where a later proposal disagrees with the spec, the spec wins.

**1. A diorama under a real lens.** A ~35 mm-equivalent camera at a fixed high three-quarter angle, physical tilt-shift so the focal plane cuts the play space and the world falls off into blur above and below it. Not a "zoomed-out RPG camera" — a *photograph of a model village*. Depth of field is the signature, and it is never allowed to touch the player's creature or the active battler.

**2. Every surface carries three maps.** Albedo (sRGB) + channel-packed ORM (AO in R, roughness in G, metalness in B, one texture bound to all three slots) + a normal derived by Sobel from a procedural heightfield. One texture unit, one fetch, three maps. Generated at build time into KTX2, not at runtime into `CanvasTexture`. This is the single biggest departure from the old world and the one that matters most.

**3. Nothing stays a primitive.** Rocks are lathed and fractured, tree trunks are tapered extrusions with root flares, building edges carry 3–5 cm chamfers that catch a moving specular line. A hard 90° edge catches one flat value; a chamfered edge catches a highlight that moves with the camera. Every biome gets its own geometry generators — not one `makeTree()` re-tinted eight times.

**4. Every light has a visible source.** Lamps, forge fires, gym beacons and lava are real lights with a visible emissive housing in frame. Night is a lighting change, not a global dimming. Four cascaded shadow maps so distance still reads. The old world's rule was the opposite and it is why it looks like a toy.

**5. The sprite is lit, not pasted.** A creature billboard receives the scene's lights through a derived normal map, casts a real shadow from its own alpha, takes a type-coloured rim light, and grounds with a contact shadow and a soft occlusion gradient at its feet. If you can tell it is a billboard from a still frame, it has failed.

**6. Pixels stay pixels.** Creature textures sample `NearestFilter` with no mipmap blur in the magnified case, and the anti-aliasing is TAA on the *scene*, never a bilinear smear on the sprite. A pixel-art creature that goes soft at the edges reads as a low-resolution JPEG, not as an art style.

**7. Battles happen where you are standing.** No screen transition to a 2D backdrop. The camera pushes in, the world dresses itself into an arena, and the same lights that lit the field light the fight. This is the change that makes the game feel like one product instead of two.

**8. Readability outranks atmosphere, and everything has an off switch.** Bloom threshold sits in the gap between the brightest environment pixel and a creature's brightest pixel. No effect may obscure an HP bar, a type icon or a move result. `prefers-reduced-motion` and an explicit reduced-effects toggle strip grain, aberration, camera shake and hitstop while the game plays identically.

---

## Sprite pipeline — `tools/sprite-pipeline/`

The existing 263 creature files range 256²–2048², 52 are non-square, and some (`abyssrake(front).png`) ship a white background instead of alpha. For billboards they must be uniform. Fully automated, no sprite redrawn:

1. **Alpha recovery** — border flood-fill + chroma-key, reusing the approach already proven in `scripts/sprite_postprocess.py`. Emit a QA contact sheet; anything the heuristic can't resolve gets flagged, not silently shipped.
2. **Normalize** — trim to content bounds, re-canvas to a uniform square, anchor the foot line at a fixed V so creatures of different `sizeScale` stand on the same ground plane, resample to 1024² with nearest-neighbour on integer factors to preserve pixel edges.
3. **Derive a normal map** — luminance → height → Sobel, with an alpha-edge bevel so silhouettes catch a rim. This is what makes pillar 5 work, and it is per-sprite and automatic.
4. **Derive an emissive mask** — threshold on saturation × luminance against the species' palette, so a creature's glowing lure or molten seams actually emit.
5. **Encode** — KTX2/UASTC for albedo + normal, packed into per-zone atlases so a route's spawn set is one texture bind. Target ~30 MB total, down from 398 MB.
6. **Variants as a shader, not as pixels.** The old game ran an HSL shift per pixel in JavaScript on a `<canvas>` for every variant sprite. The five palettes (`normal/dawn/dusk/verdant/ember`) plus the alpha modifier become four uniforms in the sprite material. Zero CPU cost, zero extra files.

Also preserved: `tmp/imagegen/*.jsonl` — the prompt recipes that produced the art. They are the only reproducible record of the style and they move into `.design/`.

**Carry forward the licences**: `public/models/CREDITS.txt` (Quaternius, CC0) and `assets/ranks/TABLER-LICENSE.txt` (Tabler Icons, **MIT — the notice is legally required**).
**Do not migrate**: `assets/trainers/npc/pokemon-world-people-overworld.png` and its 60 sliced children (a ripped Pokémon sheet, already dead code), and the `goku/ichigo/luffy/naruto` league icons.

---

## Rendering architecture

**Pipeline** (`WebGPURenderer` + `RenderPipeline`, desktop-only, one quality tier plus an accessibility strip):

```
depth+normal prepass → opaque → GTAO (half-res, 16 spp) → sprite pass (alpha-tested,
depth-sorted) → transparent/VFX → TAA → bloom (threshold above env, below creature) →
tilt-shift DOF (masked: never the active battler) → ACES → grade + vignette + grain
```

**Cut deliberately.** *SSR* — a second scene render for wet stone we can fake with a correct PMREM and clearcoat. *SSGI* — cost is not justified against a strong baked-AO + IBL baseline at this art scale. *Volumetric fog as raymarching* — height fog plus a handful of light-shaft billboards buys 80 % for 5 % of the cost. *Real-time GI* — the world is authored per zone and can bake.

**Lighting.** Sun + sky IBL from a physical sky model (not a 6-line gradient shader), 4-cascade shadows, a real-light budget of 8 shadow-casting and 24 non-shadowing per zone, and a day/night cycle that drives the IBL, not just a colour multiply.

**Materials.** Build-time procedural PBR — the Table-Clash approach, adapted: a heightfield callback per surface produces albedo + ORM + Sobel normal, baked to KTX2 at build, cached by content hash. Shared material instances keyed by `(surface, tier)`; a dev assertion fails the build if a zone exceeds its material count.

**Geometry & world.** Keep the old game's genuinely good authoring abstraction — a ~15-field `AREAS[id]` record plus layered lookup tables (biome → palette/props, terrain → silhouette, layout → town plan, signature → one unique set-piece per zone), deterministically seeded so a zone rebuilds identically — but put real generators behind it. Plus: `InstancedMesh` for all scatter, three LOD levels with an impostor tier, frustum + hierarchical occlusion culling, and **a disposal contract enforced by a leak test** (the old code called `areaGroup.remove()` in a loop and disposed nothing).

**The walkable-space fix.** The old world sculpted 226×226 units of terrain and then hard-clamped the player to a flat 76×76 patch — the scenery was unreachable. In the rebuild the terrain heightfield *is* the collision surface, and zones connect by streaming rather than fade-to-black.

**Frame budget** — 1440p/60 on a mid-range discrete GPU (RTX 3060 / RX 6600 class), i.e. a 16.6 ms frame with headroom to 12 ms. Exact per-pass numbers are set against a real capture during M2 and then become binding; the caps below are the design targets the spec is written to.

| | Target |
|---|---|
| Draw calls per zone | ≤ 400 (the old game: ~1,000–1,200) |
| Triangles | ≤ 2.5 M |
| Texture memory | ≤ 700 MB |
| Shadow-casting lights | 8 + sun (4 cascades) |
| Scene + sim | 6.0 ms |
| GTAO + TAA + bloom + DOF + grade | 4.0 ms |
| **Total** | **10.0 ms** (hard ceiling 13.5 ms) |

An accessibility strip (`prefers-reduced-motion` / reduced-effects) removes grain, aberration, shake, hitstop and DOF without changing gameplay, and always wins over any other setting.

---

## Combat

One implementation in `packages/core`, deterministic, seeded, imported by client (for preview and animation timing) and server (for truth). The old game had *two* divergent implementations with different crit rules, burn handling, immunity handling and two incompatible catch formulas.

**Repairs to the migrated formula:**

| Gap today | Fix |
|---|---|
| No STAB | ×1.5 when move type matches a species type |
| Accuracy never rolled — every move always hits | Real accuracy roll; the 4 sub-80 % moves finally matter |
| 9 of 24 effect keys unimplemented (`crit`, `heal`, `recoil`, `trap`, `drain`, `raise_all`, `weather`, `sun`, `lower_spAtk`) | All implemented; ~30 moves start working |
| Stat changes mutate `atk`/`def`/`spd` permanently | Proper −6..+6 stage system (the 3D client already had the table; the server never did) |
| Burn does not reduce damage | Burn halves physical output |
| `calcDamage` returns min 1 even at ×0 effectiveness | Immunity means zero |
| `lower_atk` lowers the **attacker's** own Atk in PvP (9 moves) | Lowers the defender, as the wild-battle path already did |
| `Intimidate` double-dips (×0.8 on switch-in *and* ×0.75 per calc) | Applied once |
| Loser *gains* +10 rating on a ranked loss (`Math.max(10, negative)`) | Correct Elo sign |
| `championCleared` checks `defeatedSet.has("goku")` | Checks `"zeon"` |
| Two catch formulas | One: the Gen-style curve with a status bonus, which is the better of the two |

Kept as-is: 4 base stats (no Sp.Atk/Sp.Def split), 19 types with the custom Cosmic type, 193 moves, 130 species, the `status` array allowing burn+confusion to coexist. Weather and terrain become real fields that move effects and abilities read.

**Presentation** (the "deepened" half): the camera pushes into an arena framing in-world, moves get per-move camera work from a registry, impacts get 3-frame hitstop, super-effective hits get a chromatic punch and a shake scaled to damage, crits slow-mo, KOs hold. The old `moveAnimationRegistry → buildTurnTimeline → useBattleTimeline → AnimationLayer` split was a good separation and the *concept* carries forward — retargeted from DOM divs to 3D.

---

## Multiplayer

**Rooms.** One Colyseus room per zone instance, sharded when a zone exceeds capacity, with a handover protocol that pre-subscribes the destination room so a border crossing has no visible hitch. Battles, raids and trades are sub-states of the zone room where they are spatially anchored, so a raid boss is visible to everyone in the zone rather than living in a disconnected namespace like today.

**Tick and sync.** 20 Hz server tick with Colyseus schema delta encoding. The local player is client-predicted and reconciled; remotes run a snapshot interpolation buffer instead of the old exponential smoothing that rubber-bands. Movement is validated server-side against a speed cap and the zone's collision heightfield — the old server clamped to ±128 while the walkable area was ±38, so a modified client could broadcast itself three times outside the playable zone.

**Interest management.** A uniform AOI grid with subscribe/unsubscribe on cell crossing. The old fanout was 10·N·(N−1) — 30 players in one area is ~8,700 msg/s, and the only mitigation was a client-side `REMOTE_CAP = 30` that dropped the 31st avatar *after* parsing its packets. AOI makes the cost linear in players × neighbours, not quadratic in zone population, which is what makes 200 per zone possible.

**Shared world state.** Wild spawns become server-owned with per-zone spawn tables and timers, identical for everyone. Engaging a spawn tags it for that player for the duration of the turn-based fight; it de-spawns for all on capture or flee-timeout. Raid bosses carry shared HP and a public damage board.

**Non-negotiable:** nothing that touches progression is client-authoritative. The old overworld awarded gym badges directly because "the server round-trip is unreliable", laundered through a `gymwin_<id>` flag. Badges, EXP, items, money, catches and rating are server-only, full stop.

**Preserved from the old design** (the parts that were genuinely careful): presence keyed by playerId not socketId so multi-tab collapses to one avatar; a pure, unit-testable presence store; the challenge handshake that re-checks presence *again* before creating the battle room; `toPublic()` as an explicit allow-list so new fields are private by default; `escapeRegex` on every user string reaching a query.

---

## Data model

PostgreSQL via Drizzle. Normalized where the old embedded document hurt: `creature_instances` as rows rather than an array inside the player document (this is what caused the `VersionError` races), `inventory_items`, `party_slots`, `box_slots`, `badges`, `story_flags`, `quest_objectives`, `friendships`, `messages`, `guilds`/`guild_members`, `listings`/`bids`, `battle_history`. Marketplace bids and cross-player transfers use row-level locking in a transaction instead of optimistic-concurrency retry wrappers.

**Content is not in the database.** Species, moves, zones, league rosters and story beats live in `packages/content` as typed data, schema-validated at build. A save references content by id.

---

## Story — new cosmology, new plot

The existing lore (Lumyth the Day-Mote, the First Dark, the Veins, the inverted rite) is replaced entirely. Full treatment ships as `.design/story-bible.md`; the premise:

**Ewa is not a world. It is something's memory of a world, and the memory is thinning.**

Ewamon are not animals. They are the world's recollections of animals, precipitated into bodies at the **Seams** — the places where the world's memory of itself runs thin enough to see through. That is what types are: the register a memory is held in. That is why they evolve — a memory becoming more certain of itself. That is why legendaries are almost impossible to find: they are memories of things that only ever happened once.

The antagonist is not a doom cult. It is **an institution** — a competent, well-regarded civil service that discovered a memory can be *spent*. Unmake an Ewamon back into raw recollection and you can buy anything: grain in a famine year, a harbour where there was no harbour, a cure. They are not hiding it. They ended a famine with it and the survivors are grateful. The cost is that whatever was spent is permanently gone from the world — not killed, *never-was* — and the places they have worked are visibly losing specificity: colour flattens, detail drops out, craftsmen forget their own trade, names slip.

That last point is the mechanic and the art direction fused: **a harvested zone renders as untextured, flat-shaded primitives.** The old game's look becomes the in-fiction visual language of a forgotten place, and restoring a zone visibly restores its materials, its geometry detail, its lighting. The player can see the damage in the render pipeline itself.

It makes the Dex load-bearing. Catching is not capture, it is **witnessing** — a creature you have recorded is one the world cannot quietly lose. Completing the Dex is not a completionist chore; it is the win condition of the theme.

Three acts, mapped onto the eight badges: **The Thinning** (something is wrong and nobody can name it) → **The Ledger** (you learn who is doing it, why it works, and that the rival is on their payroll for defensible reasons) → **What's Left** (the institution's final withdrawal: spending the memory of the world's own name to buy permanence, at the Celestial Spire and the Rift).

Roster anchors: `Lumyth` is the memory of the first morning; `Noxmyth` the first night; `Voidraxis` the memory of *before there was anything to remember* — which is why the Cosmic type has no body-bound weaknesses. The 21 zones and all 130 species keep their names.

**Roster coverage.** All spawn tables are rewritten across the 21 zones so 130/130 are obtainable and all 67 evolution families completable — including the currently unreachable `wraithtide`, `kygra`, `ripshell`, `bloomsprite` and `acier`. Quests, seasonal events and daily swarms are rewritten against real area ids so they fire at all.

---

## UI/UX

One design system, one token set, one font stack — the old app ran four visual languages at once (React "Void Cosmos" neon-violet glass, a cream-paper Trebuchet HUD inside the 3D world, a gold-bordered journal built with `style.cssText`, and an inline-styled challenge modal). Navigation gets real routing with URL state and back-button support instead of `useState("dashboard")`, and the 900 ms blocking clip-path transition on every tab change goes away.

In-world HUD is drawn in-canvas, not as DOM rebuilt 60×/sec. Typography is legible at reading size — the old UI set 5–8 px `Press Start 2P` for most labels. Every screen is designed for a 1440p desktop target with proper information hierarchy, and juice is applied deliberately: 1.05 hover / 0.95 press scales, hitstop on impact, shake scaled to event weight, and an accessibility path that removes all of it without changing what the game does.

---

## Audio

Zero audio files exist today — everything is a WebAudio chiptune synth. `tools/audio-pipeline/` becomes a real build step: a prompt manifest in `.design/audio-bible.md` (per-zone themes, battle/boss/victory cues, ambience beds, ~120 SFX), generation through an AI audio API, then normalize → loop-point detect → encode. **Open dependency: the user supplies the API key.** Engine side: FMOD-style layered adaptive music (stems that fade on threat/biome/time-of-day), 3D positional SFX, reverb zones, and ducking under dialogue.

---

## Milestones

**M0 — Foundation.** Monorepo, tooling, CI, import-boundary lint, `core` ported with every battle repair above and covered by deterministic tests, `content` migrated and schema-validated, Postgres schema + migrations. *Done when:* a headless battle between two seeded teams resolves identically on client and server 1,000 times.

**M1 — Sprite & asset pipeline.** `tools/sprite-pipeline` end-to-end over all 263 creature sprites. *Done when:* every species has a uniform, alpha-correct albedo + normal + emissive set in KTX2, total ≤ 35 MB, and a QA contact sheet shows no broken alpha.

**M2 — The vertical slice.** Mirevale + Mire Route at **final** quality: full render pipeline, real materials, cascaded shadows, real lights, HD-2D creature sprites, in-world battle staging with camera direction, one gym (Grove-Keeper Mira), ~15 species, the Act I opening, the full UI, and zone-room multiplayer with AOI. *Done when:* the slice hits the frame budget, the art pillars pass a hostile render audit, and two players can meet, chat, trade, battle and clear the gym.

**M3 — World rollout.** The remaining 19 zones against the M2 spec, all 130 species placed, the full league, story acts II–III.

**M4 — Systems.** Social/guilds, marketplace, raids, battle pass, quests, live-ops, ranked PvP.

**M5 — Audio, polish, launch.** Full audio pass, performance audit, accessibility pass, deploy.

The slice is the gate. If M2 does not look genuinely high-end, the spec is wrong and we fix the spec before multiplying it by 21.

---

## Verification

- **Determinism:** `core` battle sim replays identically from a seed across client/server; 1,000-battle fuzz run in CI.
- **Render budget:** an automated capture asserts draw calls, triangle count, texture memory and per-pass GPU time against the numbers in `.design/SPEC.md`. The build fails when a zone exceeds them.
- **Leak test:** load and unload every zone 50 times; asserts geometry/texture/material counts return to baseline. This is the explicit regression guard for the old game's unbounded GPU leak.
- **Netcode:** a headless bot harness spawns 50/100/200 clients in one zone and asserts the measured message rate matches the AOI model, not the old quadratic fanout.
- **Authority:** an adversarial client that fabricates badge/EXP/item/catch messages must gain nothing. Written as a test, not a review note.
- **Visual:** screenshot capture per zone at fixed camera positions, plus a hostile render audit per milestone in the Table-Clash style — a written document that attacks the current build's image and is answered in the spec.
- **Play:** the slice is driven end-to-end in the browser through the Browser pane, not validated by `npm run build` passing. The old project's changelog admits 12 separate times that a feature was shipped on a build check alone.

---

## Open dependencies

1. **AI audio API key** — required for M5; research callable providers and propose one before then.
2. **Image generation credits** — not required (no sprite is redrawn), but useful for UI art, zone key art and the ~30 lowest-resolution sprites if regenerated later.
3. **GitHub repo** — created when the user wants it; the plan starts with a local `git init`.
