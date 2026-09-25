# @ewa/client — implementation notes (part 1: shell, state, net, design system, screens)

Binding spec: `.design/SPEC.md` §20 (+ spine §3.12, §4.3/§4.4/§4.7, §50.4.7). The spec was not edited. Part 2
(the 3D scene — §20.4–§20.7) plugs into the seams listed at the end.

## Run it

```
pnpm --filter @ewa/server start      # REST :4000 + Colyseus :2567 (PGlite in packages/server/.data; first boot ~30 s)
pnpm --filter @ewa/client dev        # http://localhost:5173  (Vite proxies /api → :4000, stripping /api)
pnpm --filter @ewa/client tokens     # regenerate src/ui/tokens.css + tokens.ts from tokens.json (+ design checks)
pnpm --filter @ewa/client tokens:check
```

Env: `VITE_API_URL` (default `/api`), `VITE_WS_URL` (default `ws://localhost:2567`); for the dev proxy targets
`EWA_API_TARGET` / `EWA_WS_TARGET`. `EWA_BUNDLE_STRICT=1 vite build` turns the §20.10.2 bundle budget into a failure.

## Deviations (each is small and deliberate)

- **D1 — router factory.** `router.tsx` exports `routes` and `createAppRouter()`; `main.tsx` calls it once. A
  module-level `export const router = createBrowserRouter(routes)` would start a browser router whenever a test
  imported `routes`.
- **D2 — `apiFetch(key, init)`.** Routes are addressed by protocol's `RouteKey` (the typed `ROUTES` table protocol
  already ships, whose zod schemas parse every 200 body) instead of a `RestRoute<T>` object. `init.params` are
  path params, `init.query` the search params. Network error *and* timeout are `{ status: 0, code: 'network' }`
  (timeout carries `detail: 'timeout'`).
- **D3 — `requireSession` + child loaders.** On a direct load of `/play/<child>` React Router runs the child
  loader in parallel with `/play`'s; loaders that touch the session (`dex` delta, `shop` zoneId, `pass`) first
  await `sessionReady()` (the first `hydrateFromMe`). A refresh that fails with 401/400 ends the session and
  redirects to `/login?next=`; a network failure is a route error ("Server unreachable"), not a logout.
- **D4 — delta literals carry two REST-only extras.** The wire `inventoryDelta` has no slot for a party reorder or
  a party↔box move, and `progressionDelta` none for GET /dex's `variants`/`alpha`. `InventoryDelta` therefore
  allows optional full `party`/`box` arrays and `ProgressionDelta` optional `dexVariants`/`dexAlpha`, set only by
  route actions/loaders. The single-writer rule is intact (still only the two functions write those slices).
  Semantics: items merge with absolute counts (REST full maps send 0 for vanished keys), money absolute,
  creatures by id; `badges` replace; `flags`/`dexSeen`/`dexCaught` union (the server sends only new entries —
  union is idempotent either way); quests upsert per objective.
- **D5 — reconnect uses the SDK's built-in reconnection.** `@colyseus/sdk 0.18` reconnects internally on
  1001/1005/1006/4010; a second hand-rolled `client.reconnect()` loop would race it. `room.reconnection` is
  configured to the spec schedule (1, 2, 4, 8, 8, 8 s, 6 attempts); `ui.connection` and the attempt counter
  follow it, and `onReconnect` re-reads `/me` through `hydrateFromMe`.
- **D6 — fonts.** The three OFL faces are declared (`src/ui/fonts.css`, `local()` first, then
  `/fonts/*.woff2`) but the woff2 files are not in the repo and no download was made. The token stacks fall back
  to Bahnschrift / Segoe UI Variable / Cascadia Mono / Consolas on Windows (added in front of the spec's
  `Segoe UI` fallbacks). `vite.config.ts` injects `<link rel="preload" as="font">` only for files that exist in
  `public/fonts/`, so dropping `BricolageGrotesque[opsz,wdth,wght].woff2`, `InterVariable.woff2` and
  `JetBrainsMono[wght].woff2` there activates them with no code change.
- **D7 — tokens.** `tokens.json` adds, inside the one set, alpha tints (`accent-a08/16/32`, `warn/danger/info-a16`,
  `glass`, `glass-line`, `shade-a40`, `light-a06`), sizes (`topbar-h`, `panel-max`, `control-sm/md/lg`,
  `modal-sm/md/lg`, `auth-card`, `focus-ring`), shadows and z-layers. `--type-<name>-ink` (readable text colour on
  each type colour) and `[data-type="<Type>"] { --tc, --tc-ink }` are generated so components never declare custom
  properties themselves (§50.1 #14). `gen-tokens.ts` is pure (it lives in `src/` as named and must obey the
  client's no-node-builtins lint); the file-system runner is `scripts/tokens.ts`.
- **D8 — bundle budget is reported, strict on demand.** Every screen, loader and action is a `lazy` route module
  (§20.10.2 rule 7); the shell entry is **113 KB gzip** (budget 180), the largest lazy chunks are content 65 KB and
  WorldSession (+sdk/protocol) 26 KB. `vite.config.ts` gzips every chunk and reports it against 180 KB (entry) /
  900 KB (others); `EWA_BUNDLE_STRICT=1` turns an overrun into a build failure (not the default, so a part-2 render
  import cannot silently break `pnpm build` before its own split lands). Error/boot/fallback elements stay static
  in the shell (`RouteError`, `PlayError`, `BootScreen`) — hence `net/apiError.ts` + `net/sessionEnd.ts` are split out
  of `api.ts`, and the SessionKeeper imports `api.ts` lazily.
- **D9 — colourblind palettes.** One lightness-alternating palette (L* 86 / 30 in TYPE_NAMES order, hue kept per
  type) is used for all three modes; `colorblindViolations` verifies ≥ 40 ΔE (CIE76, Machado 2009 severity 1.0)
  between adjacent types under each simulation — measured minimum 54.3.
- **D10 — keybind labels.** Bindings are stored as `KeyboardEvent.code` (AZERTY works by position); the label is
  derived from the code (`KeyW` → `W`, `ArrowUp` → `↑`, `ShiftLeft` → `Left Shift`) rather than stored from the
  capture event's `key`, so settings stay one `code[]` per action as §20.8.1 types them.
- **D11 — Box grid.** 10 columns as specified; 6 while the selected creature's detail column is open (the panel is
  1 120 px wide at most, so 10 × 72 px + the detail column does not fit). Dex likewise: 6 → 4 with its detail.
- **D12 — register card width.** 580 px instead of 420 px on `/register` so the three starter showcase cards stay
  the largest element at a readable size; `/login` keeps 420 px.
- **D13 — `ewa/no-inline-style` is slightly stricter than listed:** besides JSX `style`, `el.style.cssText = …`
  and `setAttribute('style', …)`, it reports any assignment through `x.style.*` and `Object.assign(el.style, …)`,
  and checks that an object literal passed to `cssVars` only has `--` keys. `style.setProperty('--ui-scale', v)`
  (applySettings, §20.8.4) stays legal.
- **D14 — store selector lint.** The §20.3.1 `no-restricted-syntax` selector
  (`CallExpression[callee.name=/^use\w+Store$/][arguments.length=0]`) is enabled in the `ewa/client` block.
- **D15 — thumbnails.** DOM sprites read `public/creatures/creatures.manifest.json` once; species without a thumb
  (all of them until the pipeline writes `public/creatures/`) render a type-tinted monogram instead of 130 404s.
- **D16 — key art.** `public/keyart/*.jpg` does not exist; Landing/Auth/Boot draw an SVG scene coloured only by
  tokens (`src/ui/KeyArt.tsx`), deterministic (fixed LCG, no `Math.random`).

## Server findings (not fixed here — server is committed and out of scope)

1. `POST /creature/:id/setup` equips from / returns to the inventory (server S6) but answers only the
   `CreatureInstance`: the client's item counts go stale until the next `/me`. It should also return `inventory`
   (or send an `inventoryDelta` to the room).
2. `POST /guilds` charges 5 000 money and `POST /marketplace/list` escrows a creature, but their responses
   (`GuildView`, `ListingView`) carry neither `money` nor the removed creature id — the same stale-slice problem
   once those routes land (part 2). Suggest `{ …view, money }` / `creaturesRemoved`.
3. `GET /me` has no dex fields and no guild id/tag, so the Dex needs its own `GET /dex` and the Guild screen cannot
   know "my guild" (§20.9.8's member view) without a `GET /guilds/mine` or `me.guildId`.
4. `POST /zone/enter` answers 409 `inBattle` during a battle, so a reload mid-battle cannot rejoin the room to
   receive `battleResync` (§20.3.4 / CUT: "refresh during a battle re-joins via battleResync"). The seat should be
   issued and the battle resynced on join.
5. Close-code collision: protocol `CLOSE_CODES.replaced = 4001` is also Colyseus `CloseCode.SERVER_SHUTDOWN`
   (`@colyseus/shared-types` 0.18.2), so a server restart looks exactly like "a newer tab took over". The overlay copy
   covers both ("…from another tab or device, or the server restarted") until the protocol moves `replaced` to a free
   code (e.g. 4101–4199) — a protocol + server change, not made here.

Verified live (server + `pnpm --filter @ewa/client dev`, headless Chrome at 1440×900): register (field errors, starter
pick) → `/play` boots through BootScreen, `/me` hydrates (money, level, party), the WorldSession joins Mirevale via
`/zone/enter` + `consumeSeatReservation` ("Connected"); every panel renders; claim pass reward / buy / rename apply
through the delta writers; login errors inline; logout clears the refresh key; stopping the server shows
"Reconnecting… attempt n of 6" after 2 s, then "Connection lost" with Try again, which rejoins after a restart;
`/admin` renders for an admin (metrics live, stats/players "not live yet") and redirects a non-admin.

## Seams for part 2 (the scene)

| File | Interface |
|---|---|
| `src/scene/worldHost.ts` | `setWorldFactory((canvas) => WorldInstance \| Promise<WorldInstance>)`, `WorldInstance { start(); stop(); dispose() }`. GameCanvas already calls `acquireWorld(canvas)` / `releaseWorld()` with the refcount + `setTimeout(0)` dispose; `worldCapability()` / `setWorldCapabilityOverride()` gate WebGPU/WebGL2. Register the factory from a lazily imported `src/scene/World3D.ts`. |
| `src/net/WorldSession.ts` | `getWorldSession()`: `room`, `selfId`, `zoneId`, `send(type, payload)` (validated with `CLIENT_MESSAGES`), `onMessage(cb)` (battle*/chat/storyBeat/raidEvents are left to part 2 — the DOM router ignores them), `onRoom(cb)` (join/handover/leave → SceneDirector.loadZone/unloadZone, `getStateCallbacks(room)`), `onReconnected(cb)` (clear prediction/remote buffers), `handover(m)` (already wired from the `handover` message). |
| `src/state/ui.ts` | `setBattle(BattleUi \| null)` (BattleController.applyServer), `setDialogue`, `setChatOpen`, `openModal/closeModal`, `setFps` (1 Hz dev). |
| `src/state/applySettings.ts` | `onEffectiveSettings(cb)` → `{ reduced, effects: EffectsFlags, uiScale, colorblind }` for `renderer.setEffects`, `hud.setScale`, `TimelineCtx.reduced`, `stage.setTypeColors(TYPE_COLORS[colorblind])`. |
| `src/state/session.ts` | subscribe (`useSessionStore.subscribe(selector, cb)`) for HudWriter.party / questHint and `harvestStateFor(zone, flags)` → `SceneDirector.setHarvest`. |
| `src/ui/tokens.ts` | `COLOR`, `TYPE_COLORS`, `TYPE_SCALE`, `FONT`, `MOTION_MS`, `SPACE` numbers for the canvas HUD/timeline. |
| `src/battle/BattleOverlay.tsx` | owns the nav blocker + the anchored container; render `BattleMenu` / `BattleResultCard` inside. |
| `src/app/bootProgress.ts` | `setBootPhase({ label, loadedBytes, totalBytes })` for the §20.10.3 preload phases. |

Not created on purpose: `src/scene/zoneSpecFor.ts` + `test/zoneSpecFor.test.ts` (owned by the render zone-builder
agent), `World3D`, `SceneDirector`, `LocalPlayerController`, `RemoteInterpolator`, `HudWriter`, `battle/*` except the
overlay shell, `AudioDirector`, `DialogueBox`, chat input, trade/challenge/evolve/learn-move modals.

## Dev extras

- `/__gallery` (dev builds only, §20.2.5): every component in every state (`src/ui/Gallery.tsx`).
- `.claude/launch.json` gained `ewa-server` / `ewa-client` entries (next to the render sandbox) for preview tooling.

## Tests (part 1 subset of §50.4.7)

`pnpm exec vitest run packages/client` — `routes.test.tsx` (jsdom), `store.test.ts`, `design-system.test.ts`,
`no-client-badge.test.ts`, `api.test.ts`, `settings.test.ts`; plus the lint-rule fixtures in
`eslint/local-rules.test.js` (`pnpm test:lint-rules`).

---

# Part 2 — the in-world game (§20.0, §20.3.3–4, §20.4, §20.5, §20.6, §20.7, §20.8.2, §20.10)

Binding spec unchanged. Part 2 plugs into part 1's seams (`setWorldFactory`, `getWorldSession`, the stores' single
writers, `onEffectiveSettings`, `BattleOverlay`, `bootProgress`) and consumes `@ewa/render` through `createRenderer`,
`part3Of(renderer)` (sprite pool, stage extras) and the zone adapter. No server / persist / protocol file was edited;
one surgical render fix (the follow spring's integration step, render bug 1 below, with a test) — everything else in
render is reported, not changed.

## Layout

| File | Owns |
|---|---|
| `src/scene/World3D.ts` | §20.4.2 the world instance: boot (renderer → atlases → zone → first frame), the tick (sample → fixed steps → HUD flush → one `renderer.frame`), hidden-tab 250 ms stepping, room / message wiring, interaction activation, the `BattleView` binding, dev handle `window.__ewaWorld` (dev builds or `?dev=1`: `debug()`, `walkTo(x, z)`, `lastSecond`) |
| `src/scene/registerWorld.ts` | lazy `import('./World3D')` + `setWorldFactory` (GameCanvas calls it; `/login` and jsdom never load three) |
| `src/scene/SceneDirector.ts` | §20.4.3 zone lifecycle, static actors, interactables, banner, theme; Pillar 7 `enterBattle` / `exitBattle`, battle heading choice |
| `src/scene/LocalPlayerController.ts` | §20.4.5 sampling, prediction (`stepMovement`), 20 Hz inputs, reconciliation |
| `src/scene/RemoteInterpolator.ts` | §20.4.6 100 ms linear interpolation, ≤ 100 ms extrapolation, median server-time offset, nearest-N actors |
| `src/scene/HudWriter.ts` | §20.6 the HudModel + per-field dirty mask, one allocation-free `flush` |
| `src/scene/interaction.ts`, `dialogue.ts` | §20.4.7 targeting (ranges, prompt per target), NPC dialogue from content + flags, beat lines |
| `src/scene/SpawnViews.ts` | wild spawns as creature billboards + `spawn` interactables |
| `src/scene/spriteCatalog.ts` | `creatures.manifest.json` v2 → `AtlasSet` / `SpriteDescriptor` (§40.1.5: `uv → rect`, `px`, `footV`, `aspect`, maps + mips, `normalScale`) |
| `src/scene/collider.ts`, `input.ts` | the protocol `Collider` over `resolveMoveInto`; DOM key / wheel / drag capture |
| `src/battle/constants.ts`, `moveAnims.ts`, `timeline.ts`, `TimelinePlayer.ts` | §20.5.2–§20.5.4 |
| `src/battle/BattleController.ts`, `BattleHud.ts`, `labels.ts`, `controllerRef.ts` | §20.5.5, the canvas battle bars, `ActionError` labels |
| `src/battle/BattleMenu.tsx`, `BattleResultCard.tsx` | §20.5.6 DOM |
| `src/audio/AudioDirector.ts`, `mixer.ts`, `manifest.ts` | §20.7 graph, mixer table, director, manifest loader (silent path) |
| `src/world/*` | DialogueBox, ChatInput, ChallengePrompt, TradeModal, PostBattlePrompts (evolve / learn-move) |
| `src/app/WorldBoot.tsx`, `navigation.ts` | the world boot overlay; a navigate seam for world code |

## Deviations (part 2)

**World / boot**
- **W1 — the world subscribes before the renderer exists.** `createWorld3D` constructs the world (WorldSession
  message / room / reconnect subscriptions, BattleController, HudWriter, input capture) synchronously, then awaits
  `createRenderer`. A `battleResync` sent on rejoin (server part 2 P3), chat and the join itself are never lost while
  the ~16 s shader warm-up blocks the main thread; the battle is dressed when the renderer attaches.
- **W2 — the boot overlay is DOM, not the canvas HUD.** `app/WorldBoot.tsx` covers the canvas from mount to the
  first zone frame (literal labels: "Starting the renderer", "Compiling shaders (first start can take ~20 s on
  integrated GPUs)", "Loading creature sprites a / b MB" with a real byte bar from the manifest sizes, "Building
  Mirevale"), then fades over `--motion-banner`. §20.10.4 wants the post-/me fade drawn by the canvas HUD, which cannot
  draw before the renderer exists; the label is painted (two rAFs) before the synchronous compile and the CSS sweep
  keeps animating on the compositor, so the canvas never looks broken.
- **L1 — the canvas starts under the 56 px top bar** (`CanvasHost.module.css`): render's HUD anchors the party strip,
  clock and zone banner to the canvas' top edge, which the bar covered. The shortcut hint moved to bottom-centre (the
  canvas chat log owns bottom-left).
- **L3 — top bar links use `--s-2` padding** so the nine links and the money / level / account cluster fit at the
  1 280 px minimum (they overlapped by ~60 px).

**Prediction (§20.4.5)**
- **P1 — "the server agrees" compares the ack with the pose SENT under that seq** (a 32-entry sent-pose ring beside
  the spec's pending ring). The server echoes the client's own positions, so comparing the *current* predicted pose
  with an older ack would disagree on every ack while moving.
- **P2 — a correction rebases, dropping the in-flight steps.** The server validates each message's absolute position
  against its last *accepted* one; after a rejection every message already in flight was computed from the rejected
  base and will be rejected too. Replaying those steps (the spec's "re-run every remaining pending entry") re-sends
  movement the server cannot accept and cascades rejections for as long as the player keeps moving. The client
  replays only the unsent steps and expects the stale acks to report the rebase pose. The §20.4.5 harness
  (`prediction.test.ts`: 2 000 inputs, 80–200 ms, 2 % loss) converges within 0.01 u with corrections > 0 and no
  rubber-band.
- **P3 — pending entries are per fixed step**, tagged with the seq of the message that carries them (the spec's
  `{ seq, ax, az, running, dtMs }` layout, `Float32Array(64*4)` + `Uint32Array(64)`), so a replay reproduces the
  prediction exactly; one message covers three steps.
- **P4 — no input message while standing still** (pose / running unchanged since the last send); the server's
  `moving` flag clears itself after 250 ms (server S8).
- **P5 — jump is a stub**: the ActorPool has no vertical offset (`setTransform` takes x/z/angle only), so the
  cosmetic 0.6 u hop cannot be drawn. `Space` is bound and does nothing.
- **P6 — every predicted step is clamped to the length it asked for** (`scene/collider.ts`): render's `resolveMoveInto`
  corner probes land a capsule radius (0.35 m) around the target and a blocked start escapes up to 4 m, so a step
  against a trunk could move ~0.37 m in 16.7 ms (22 m/s). The server caps each message at 8.05 m/s and kicks after 30
  `speed` rejections in 10 s — observed live before the clamp (`rejectedInputs.speed 30, kicks 1` for a player walking
  through Mire Route trees). A stuck avatar still walks out at ≤ 0.07 m / step. `collider.test.ts` shows both.
- **P7 — `running` in an input message is "any step of the window ran"**: the server applies the walk cap to a
  message flagged walking; releasing Shift (or the harness autopilot slowing down) mid-window sent a run-speed
  displacement under the walk cap.
- **P8 — NaN never survives**: the render pose is the pose when no blend is running (never `pose + off · 0`, which
  keeps a NaN offset forever), a non-finite correction error snaps, the collider refuses a non-finite step, and the
  audio listener ignores a non-finite camera. Found live: the follow spring diverged at ~4 fps (render bug 1), the
  camera went NaN and a player's canvas stayed black (`AudioParam … non-finite` in the console).

**Remotes / HUD**
- **R1 — the remote cap is the actor pool's remainder**: 48 rigs total (render §10.7.6) hold the zone's NPCs and
  trainers, the local avatar and the arena's 6 spectators first, so ≤ 48 − 7 − statics remotes get an actor (the pool
  throws when exhausted in dev builds).
- **R2 — one sample per remote per applied patch**, changed or not, so a standing player keeps fresh samples and the
  interpolation never extrapolates a stale segment.
- **H1 — HudLayer detects changes by reference** (`v === model[f]`), so every changed value is a new reference (the
  battle bars alternate two preallocated buffers); `flush` fills one preallocated partial whose clean fields are
  `undefined` (HudLayer skips them) and calls `hud.set` once.
- **H2 — chat `at` is a per-line sequence number**: render keys its fade bookkeeping on `at` and times the fade with
  its own clock.
- **H3 — nameplates include NPCs within 18 m** (their names are the only way to find Prof. Wynn), then spawned
  remotes, nearest first, ≤ 16, rebuilt every 500 ms and written only when the list changed.
- **H4 — F1** hides the canvas HUD fields (party, banner, quest, chat, prompt, nameplates, dev); battle bars and the
  connection pill stay.

**Battle (§20.5)**
- **B1 — timeline time vs real time.** `at` is timeline time; `time` frames never move the cursor (a hitstop freezes
  the player's cursor for its real ms, a crit slow-mo advances it at 0.35×), so `durationMs` = last `at` + 50 per
  hitstop + 400 × 0.65 per crit, and the reduced timeline has the same `at` for every other frame. A faint waits for
  its HP bar's nominal drain in both modes.
- **B2 — `TimelineCtx` gains optional `nameOf`, `maxHpOf` (heal events carry no maxHp), `activeOf`, `seat`,
  `instantText`** (§20.8.6 'instant': LOG_DWELL_MIN and HP_DRAIN 0).
- **B3 — compression is solved, not a single ratio.** `9000 / duration` applied to the compressible segments alone
  leaves the total above 9 000; the builder lowers the recover / status / stage / log-dwell factor until the turn fits
  (floor 0.5×), then the other unprotected segments (windup, travel, switch, weather) the same way. Hitstop, KO_HOLD
  and ORB_* never compress. Every turn of the 1 000 fuzz battles fits.
- **B4 — `chroma` frames are delivered by render**: the `impact_super` VFX recipe requests the same 0.012 / 120 ms
  (gated by `effects.chroma`); the player does not write post uniforms.
- **B5 — one battler per side on the stage (ref slot 0)**; core refs name party slots, so a `pose: 'enter'` frame for
  another slot swaps the displayed creature and resets its bar from the HP the timeline has reached.
- **B6 — after a digest match the preview state becomes `authoritative`** (it is byte-identical to the server's); pvp /
  raid (no preview) patch `authoritative` from the events (hpAfter, pp, status, actives, turn, mustSwitch).
- **B7 — the TimelinePlayer is stepped with real time and owns the time scale**: hitstop / slow-mo drive
  `renderer.setTimeScale` (render coerces them to 1 when the flag is off); `battle.player.step(16.667 × timeScale)`
  would never leave a scale-0 hitstop.
- **B8 — store writes stay off the tick**: the phase change at a timeline's end is deferred with `setTimeout(0)` and the
  log is flushed by a 600 ms interval (≤ 1 / LOG_DWELL_MIN) while a battle is open.
- **B9 — battle framing** (Pillar 7 kept: the arena dresses at the BattleSummary point, nothing unloads): the camera
  heading is switched to the least-occluded of the four for the battle (prop blockers sampled on the camera→battler
  ground lines — a trunk inside the view hid the foe in the first live run) and restored after; the push-in look-at
  sits 1.0 m toward the camera so the near battler and its bar clear the bottom-28 % DOM battle panel while the far
  battler's bar (anchored above a tall species' head) stays below the canvas top; the trainer stands behind their own
  creature, facing the foe, and a pvp opponent's avatar behind theirs (`foeId` from the battle state — the
  BattleSummary patch can arrive after `battleStart`).
- **B12 — seat-relative stage.** Render's stage side 0 is the near (player's) position; core sides are absolute. The
  TimelinePlayer (`stageRef(r, seat)`), the BattleHud bars (`setSeat`) and the controller's `setBattler` / `syncFrom`
  map `side ^ seat`, so the pvp accepter (seat 1) sees their own creature near with the numbered bar — before this,
  seat 1 saw the challenger's perspective (found live in the first two-player pvp).
- **B10 — the canvas turn label is left empty** (`CANVAS_TURN_LABEL = false`): render draws it at a fixed y (16 + 137
  px) where the near battler's anchored bar lands, and they overprint ("BramblecubTurn 11"). The DOM panel shows the
  same "Turn n". Flip the constant once render moves the label (render bug 2 below).
- **B11 — trainer lines**: a trainer's `interact` starts the battle at once, so its first line is a toast rather than a
  DialogueBox the battle would cover.

**World objects / audio / screens**
- **S1 — wild spawns are client billboards** from the renderer's sprite pool (`part3Of(renderer).sprites`) under one
  client group in the scene; render has no world-creature API beyond `CreatureBillboard.object` ("add to the zone /
  arena root"), and the zone root's dispose would take the shared quad geometry with it. Engaged spawns are hidden.
- **S3 — each spawn has its own field listener** (`$(spawn).onChange`, dropped with the spawn): a Colyseus
  collection's `onChange` fires for adds / removals only, so a wandering spawn's `x` / `z` and its `engagedBy` never
  reached the billboard or the interactable. Found live: creatures stayed where they first appeared (targeting too,
  so `E` at the creature did nothing) and an engaged creature stayed visible beside its own arena.
- **S2 — healer / shop doors**: `E` at the healer calls `POST /heal` (the server's `interact healer` is a no-op) and at
  the shop opens `/play/shop`; the gym target sits at the server's league marker (0, −26).
- **A1 — night stem**: the literal `smoothstep(0.78, 0.82, t) · (1 − smoothstep(0.20, 0.24, t))` is 0 on every day
  (the two factors are never both non-zero); "wrapping so night is [0.80, 0.22)" is implemented as the evening ramp for
  t ≥ 0.5 and the morning ramp below.
- **A2 — silent path**: without `public/audio/manifest.json` (404 or the dev server's HTML fallback) the director keeps
  theme / threat / night / duck / bus / reverb state and answers every call, fetching and playing nothing; the
  AudioContext is still created on the first gesture (graph, compressor, algorithmic IRs).
- **M1 — daily missions / weekly goals** (server part 2 Q11) render on `/play/pass`; a claim is
  `POST /quests/claim { questId, objectiveId: missionId }` → `applyInventoryDelta` + `applyProgressionDelta` (with a
  REST-only `missionClaimed` extra, like D4's dex extras). `Progression.missions` is written by `hydrateFromMe` only.
- **M3 — traded creatures land in the box**: the wire `inventoryDelta` has no slot, and the server's `completeTrade`
  transfers into the receiver's box while a catch joins the party when it has room. The router marks the delta that
  follows `tradeUpdate complete` (`addedTo: 'box'`, a REST-only-style extra like D4). Found live: the traded Mossling
  showed in the party, a pvp accept then failed with "That trainer is unavailable" (server `noUsableParty`: the party's
  only creature had fainted) and the Mossling was in the box after a reload.
- **M4 — a fully fainted party cannot battle**: `C` toasts "Your party needs healing before a battle." instead of
  sending a challenge, and the challenge prompt's Accept is disabled with the reason (`partyCanBattle`), because the
  server answers such an accept with `challengeResult 'unavailable'`, which reads as the *other* trainer's problem.
- **M2 — server part 2 hand-off**: `CLOSE_CODES.replaced` (4101) → "Playing somewhere else?", Colyseus 4001 →
  "The world server restarted"; `inventoryDelta` bodies of creature setup / guild create / marketplace mutations go
  through the inventory writer; `streak:*` flags are dropped from `me.flags` and progression deltas; a `battleEnd`
  whose id is the open raid's is a toast summary.
- **E1 — eslint `ewa/client-60hz`** (root `eslint.config.js`): §20.10.2 rule 1's scoped `no-restricted-imports` for
  `src/scene/**/*.ts`, `src/battle/TimelinePlayer.ts`, `src/audio/**` (react, react-dom, react-router), repeating the
  client list because a later block's rule replaces the earlier one.

## Spec coverage (part 2)

| Section | State |
|---|---|
| §20.0 five rules | canvas once (part 1); stores via the single writers only (no-client-badge green); tick React-free (`perf/tick` import check + eslint `ewa/client-60hz`) and allocation-free (`perf/alloc`); reduced effects win (`timeline` reduced test, `effectsFlags` → `renderer.setEffects`) |
| §20.3.3 / §20.3.4 | room state read in place (`getStateCallbacks` in World3D; `useRoomState` for the trade modal / social); reconnect clears prediction + remote buffers; 4101 / 4001 split (M2) |
| §20.4.1–§20.4.2 | done — `World3D` + tick order, hidden-tab 250 ms stepping, `performance.mark('ewa:first-frame')` |
| §20.4.3 SceneDirector | done — load / unload / enter / exit battle, spectator arenas for battles ≤ 40 u, harvest per player; handover is unload → load (render's `loadZone` refuses while a zone is loaded), so the old zone is not kept under the camera travel |
| §20.4.4 adapter | unchanged (`zoneSpecFor.test.ts` snapshot green) |
| §20.4.5 prediction | done (P1–P8); jump stubbed (P5) |
| §20.4.6 remotes | done (R1, R2) |
| §20.4.7 targeting + dialogue | done — ranges, prompts, NPC lines from content + flags + `storyBeat`, pickups / lore / warp / gym / healer / shop, `C` challenge |
| §20.5.1–§20.5.4 | done (B1–B4, B7) |
| §20.5.5 BattleController | done (B5, B6, B8, B12); raids: `battleEnd` for the raid is a toast, `raidEvents` are not animated (no raid UI yet) |
| §20.5.6 menu / HUD / result | done (B9–B11); evolve / learn-move modals queued after the card |
| §20.6 HUD | done (H1–H4); dev HUD on F3 in dev builds or `?dev=1` |
| §20.7 audio | graph, mixer, director, manifest + dev validation done; silent path (A2) — no assets exist |
| §20.8.2 effects | done — flags from settings → `renderer.setEffects`; `TimelineCtx.reduced`; `stage.setTypeColors` per colourblind mode |
| §20.10 perf | rules 1–3 tested; bundle: shell 113.9 KB gz, World3D chunk 463.1 KB gz (budgets 180 / 900, the build's `ewa:bundle-budget` report); preload phases 1–3 + first frame + phase 5 hero textures; phase 5's neighbour-zone prefetch not done (atlases cost ~33 MB GPU each set) |
| §20.10.4 BootScreen / dev HUD | W2; dev HUD fields fps / draws / GPU ms / desyncs / rubber-bands (the HudModel's set) |
| Modals | DialogueBox, chat input (T), challenge prompt, trade modal, evolve + learn-move prompts |

## Tests (part 2): 11 new files, 47 new tests (client total 18 files, 134 tests, all green) + 1 render test

`timeline.test.ts` (35 kinds, 1 000 fuzz battles ≤ 9 000 ms / sorted / end / known ids / hp = hpAfter, reduced identity,
crit extension, committed timing snapshot, ≥ 40 MOVE_ANIMS, 19 DEFAULT_BY_TYPE, VFX set difference empty) ·
`prediction.test.ts` (prediction, 20 Hz messages, zero-correction ack, rebase + unsent replay, snap, the 2 000-input
harness, remote interpolation / extrapolation cap / 100 ms jitter without reversal) · `no-exp-smoothing.test.ts`
(detector fixtures + `src/scene` clean) · `perf/tick.test.ts` (≤ 1.5 ms p95, ≤ 3.0 ms p99.9 over 600 frames with 48
remotes and a battle turn; the 60 Hz path imports no React) · `perf/alloc.test.ts` (hot bodies + ≤ 64 KB heap growth
between forced GCs) · `hud-dirty.test.ts` (600 idle frames → 0 `hud.set`; only dirty fields; walking ≤ 2 prompt writes/s
+ 2 Hz nameplates) · `battle-controller.test.ts` (start → selecting, local validation, turn + 1, preview digest match
adopts, mismatch → desync + resync, result after the timeline, dismiss, rejoin resync, pvp seat 1 staged near) ·
`scene-director.test.ts` (load, statics for flags, gym marker, banner, theme, Pillar 7 enter / exit, one setHarvest on
a restore beat, battle heading choice, crowns + margin forest) · `collider.test.ts` (render probe overshoot control +
the clamp over 10 000 steps) · `audio.test.ts` (mixer table, night curve, perceptual gain, silent path, gesture arm,
manifest validation) · `session-part2.test.ts` (streak flags ignored, missions + claim, traded creature → box / caught →
party, `partyCanBattle`). Render: `camera-rig.test.ts` "long frames stay stable" (render bug 1). `routes.test.tsx`'s
first lazy route waits up to 15 s (cold transform of PlayShell's module graph took > 4 s in the parallel full run).

Scoped checks: `pnpm exec tsc -b packages/client` clean · `pnpm exec eslint packages/client` clean ·
`pnpm exec vitest run packages/client` 18 files / 134 tests passed.

## Render bugs (part 2) — reported; #1 fixed surgically in render with a test

1. **Follow spring diverges on long frames — FIXED** (`packages/render/src/camera/rig.ts` `springStep`, was lines
   82–89). Semi-implicit Euler on the critically damped spring (ω = 1/τ = 8.33 s⁻¹) is stable only for dt < τ =
   0.12 s; `renderer.frame(dt)` receives up to 250 ms when a page stalls (shader compiles, a starved tab). Measured
   live at ~4 fps: the camera target flew to x = 203, −270, … and then went NaN — a black canvas that never recovered
   and an `AudioParam … non-finite` exception per frame. Fix: `springStep` integrates a long frame in equal sub-steps
   of ≤ `SPRING_MAX_STEP_S` (1/60 s, its own constants region); bit-identical at ≤ 1/60 s.
   `render/test/camera-rig.test.ts` "long frames stay stable" (40 × 250 ms steps converge without overshoot; one
   16.7 ms step equals the plain Euler step). The client also guards against NaN on its side (P8).
2. **`resolveMoveInto` moves farther than the step** (`packages/render/src/terrain/collider.ts:191–206` corner
   probes at `MOVER.capsuleRadius` around the *target*, `:210` `nearestPassable(from, 4)` escape): a 0.117 m step
   against a trunk can return a point 0.35–4 m away, which the server's per-message speed cap rejects (30 rejections
   = kick). Suggest probing on a circle of radius `len` around the start (or scaling the chosen probe to `len`) and
   bounding the escape per call. Clamped client-side (P6, `collider.test.ts` has the control case).
3. **Turn label overprints the near battler's bar** (`packages/render/src/hud/layer.ts:801–806`: fixed
   `y = margin + displayPx + 89`). Suggest placing it in a reserved band under the clock, or skipping it when it
   intersects an anchored bar box. Client leaves it empty (B10).
4. **Anchored battle bars are not kept on screen** (`hud/layer.ts:777`: `y = ay − barLift − h`, no clamp): a tall far
   battler puts its bar above the canvas top (name row cut off). Suggest `y = clamp(y, margin, H − h − margin)` (and
   the same for x). Client framing mitigates (B9, 1.0 m shift).
5. **Zone programs compile lazily after the first frame** (`packages/render/src/renderer.ts:455–467` `loadZone`
   resolves before the zone's instanced / variant programs exist): on a fresh profile the first ~50 s after the
   first frame run at ~1 fps while pipelines compile one by one (measured twice). Suggest
   `await this.renderer.compileAsync(handle.group, this.camera, this.scene)` before `loadZone` resolves (the boot
   overlay already covers that window, W2).
6. **No occluder data for crowns / the margin forest** (`packages/render/src/zone/builder.ts:653`: trunk blockers
   only `inPlay`; the 16 m margin band is dense trees with no blockers and crowns have no query). The battle camera
   landed inside a crown twice live; the client scores crowns from trunk rings and the margin band from the zone size
   (B9). Suggest a `ZoneHandle.occluded(x, z, y)` / crown-circle list, or camera collision for the battle pose.
7. Minor, unchanged from before: the ActorPool has no vertical offset (jump stub, P5); no world-creature API (S1);
   HudLayer change detection is by reference (H1).

## Server findings (part 2)

1. **A failed pvp start only tells the accepter** (`packages/server/src/rooms/ZoneRoom.ts:1279–1291`): when
   `startPvp` returns `noUsableParty` / `busy`, the accepter gets `challengeResult 'unavailable'` (so the UI can only
   say "That trainer is unavailable" — even when it is the accepter's own fainted party) and the challenger gets
   nothing. Suggest sending the result to both with the reason. The client now refuses early (M4).
2. **Trade placement is not on the wire**: `completeTrade` puts received creatures in the box, but `inventoryDelta`
   has no slot, so a client that mirrors catch placement puts them in the party (M3 infers it from the preceding
   `tradeUpdate complete`). Suggest a `box: true` / slot on `creaturesAdded`, or the full `party` ids in the delta.

## Verified live (part 2)

Setup: the committed server (`pnpm --filter @ewa/server start`, REST :4000 / rooms :2567, already running), the
client's production build served by `vite preview` on :5174 (the dev server's HMR reloaded the harness pages on every
edit), headless Chrome with WebGPU (Intel Gen-12LP iGPU, `ktx2: bc7`, timestamp queries) at 1 280 × 720, one isolated
browser context per player, driven over CDP (keys, clicks, and the `?dev=1` handle `window.__ewaWorld` for
`debug()` / `walkTo`). Two test accounts were created through REST by the harness (not through a browser form). The
machine was shared the whole time — two other agents' WebGPU Chromes and ~100 % CPU — so every frame rate below is a
lower bound, and two pages at once ran at ~4 fps.

- **Boot**: the WorldBoot overlay walks "Starting the renderer" → "Compiling shaders…" → "Loading creature sprites
  a / b MB" → "Building Mirevale"; `ewa:first-frame` at 42.4 s after navigation (46–48 s in earlier runs). Render bug
  5: the next ~30–50 s run at ~1 fps while zone programs compile.
- **Walking / prediction**: autopilot and keyboard walks through the real input path; 0 rubber-bands, the server's
  acks agree with the sent poses; after the P6 clamp no `speed` rejections (before it: 30 rejections → kick).
  Handovers Mirevale ⇄ Mire Route both ways, many times (the camera re-follows on the new zone).
- **Two players**: both see each other ("2 here", 1 remote actor each); B's interpolated view of A trails by ~100 ms
  while walking and settles at error 0.000; chat both ways (canvas chat log + T input).
- **Wild battle + catch** (Pillar 7, in place): arena dressed at the spawn, trainer behind the creature, canvas bars +
  DOM menu, ~3 s / turn, desyncs 0; "Gotcha! The wild Mossling was caught!" (+85 trainer EXP, party
  `bramblecub L5, mossling L3`), later "Gotcha! The wild Dreambud was caught!" and `/play/party` shows
  "2 / 6 slots — Bramblecub Lv 5 28/31, Dreambud Lv 3 18/26" (screenshot `s14-party`). An engaged spawn's billboard is
  hidden during its battle; run (5) ends it.
- **Trade**: Social › Nearby › Trade → B accepts → A offers Mossling → Update offer → Confirm × 2 → "Trade complete."
  on both; the Mossling is B's (in the box after M3).
- **PvP**: A presses C next to B → B's prompt "catcher_… wants to battle you." → Accept → both battles open; B (seat 1)
  sees their own Bramblecub near with the numbered bar (`bars [[0,'Bramblecub',true],[1,'The foe’s Bramblecub',false]]`),
  the opponent's avatar behind the far creature; replacement after a faint ("Choose your next creature." / "The
  opponent is choosing…"); result A: win, +60 trainer EXP, rating +15; B: +20, rating −15. No console exception on
  either page after P8 / render bug 1.
- **Heal**: Party › Heal party in Mirevale (`POST /heal`) restores the party through the inventory writer.
- **Frame cost** (one page, default quality, Mirevale, steady): 4–5 fps (GPU-bound on the shared iGPU), tick CPU
  (sample → steps → HUD → `renderer.frame` submission) 20–32 ms avg / 27–50 ms max, `renderer.frame` CPU 16–50 ms,
  240–248 draw calls, 640–651 k triangles, 102 programs; GPU ms not reported (`gpuMs` null). Battle frames: 464–473
  draws. Earlier dev-build sample in Mirevale: ~430 draws, 677 k triangles, 110 programs.
- Not exercised live: NPC dialogue with Prof. Wynn through `E` (targeting prompt seen; the DialogueBox is unit-level
  only), evolve / learn-move prompts (no level-up that learns a move happened), raids.

**Blockers for the two-player slice**: none on the client. Performance on this machine is far below 60 fps
(GPU-bound; render bugs 5 and the shared iGPU), and the far battler's bar still depends on the client framing until
render clamps anchored bars (bug 4).
