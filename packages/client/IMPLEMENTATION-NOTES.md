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

---

# Part 3 — the Act I slice loop (SPEC §50.5 M2: "Act I opening plays from STORY with the starter beat", "one clears Grove-Keeper Mira")

**Dialogue and beats (§20.4.7, §30.4.8 mirrored)** — `scene/dialogue.ts` gains pure interact plans used by
`World3D.activate`:
- **D17 — a beat with a battle, and a gym leader's challenge, send their `interact` on the last page.** A trainer's
  interact starts the battle at once (B11), so Sable's `mire_rival` lines — opened by `E` on him or on the story
  trainer beside him (rule 6) — were covered by the battle within a frame. `DialogueUi.onFinish` runs when the player
  pages past the last line (not on Escape = walk away, nothing sent); the beat's `storyBeat start` that follows is
  recognised (`readBeat`) and not reopened. Beats without a battle (Wynn's starter beat, `grove_stone`,
  `bloom_after`) still open and send together, as the spec reads.
- **D18 — the gym door.** `gymPlan` runs Mira's beats first exactly like the server (speaker = league id), then her
  `pre` lines (challenge on finish) when the server will let the player fight; a refusal the client can predict
  (badge held, the story gate, the previous badge) is sent at once for the server's toast. A won league battle opens
  the leader's `post` lines (the concession line is `post[1]`) once the result card is dismissed. The gym prompt
  names the leader ("Challenge Mira Thornwell"); dialogue speakers are "Mira Thornwell, Grove-Keeper of Mirevale".
- **D19 — the HUD hint follows the story.** `questHint` shows the beat the player can play next ("Talk to Prof.
  Wynn (Mirevale)", "Talk to Sable (Mire Route)", "Talk to Mira Thornwell (Mirevale)") before the active quest's
  objective, and "Challenge Mira Thornwell (Mirevale)" when no beat and no quest is left — a fresh account has no
  started quest, so the Act I opening had no pointer at all. Deviation from §20.6's "from the active quest" wording.
- **D20 — post-battle prompts from every turn.** `BattleController` collected evolve / learn-move prompts from the
  final turn's events only; in a trainer / league battle the level-up of the first KO happens turns earlier and its
  prompt was lost. Prompts are now gathered on every `battleEvents` for the player's own seat (the foe's are not
  theirs), deduplicated (core repeats `evolveReady` on every exp gain past the level), and shown after the result
  card — and after the beat's `after` / the leader's `post` lines (`PostBattlePrompts` waits for the dialogue).
- **D21 — the server's own toast is not doubled.** A league refusal is `toast` + `error { leagueLocked }`; the router
  no longer adds "That is not allowed right now. (leagueLocked)" under the explanation.

**Server findings of part 2, now fixed server-side (server Part 4 S14 / S15)**: `challengeResult.reason`
(`{ code, playerId }`) → `challengeResultText` says whose party / state stopped the battle ("Your party needs
healing before a battle." vs "The other trainer's party needs healing first."); `inventoryDelta.placement` is honoured
by `applyInventoryDelta` (the M3 trade inference stays only for a delta without it).

**Tests**: `dialogue-flow.test.tsx` (plans for Wynn / Sable / the story trainer / a plain trainer / the gym door in
each state, the story hint along the chain, DialogueBox `onFinish` on the last page only and not on Escape,
PostBattlePrompts waiting for the after-battle lines, the 5th-move forget flow), `battle-controller.test.ts`
(mid-battle learn-move + deduplicated evolve, foe prompts ignored), `session-part2.test.ts` (placement both ways,
challenge reasons, one toast for a league refusal); `collider.test.ts`'s control case now asserts render's fixed
`resolveMoveInto` (render Part 4 H9) never overshoots the step.

**Verified live (part 3)** — server + client build (`vite preview`), headless Chrome (WebGPU), fresh accounts; the
story account's party was levelled by a headless SDK player through the server's normal paths (zone/enter, 20 Hz
inputs, handover, engageSpawn, battleAction, `/heal`). Fresh spawn in Mirevale with "Talk to Prof. Wynn
(Mirevale)"; `E` at Wynn → `first_witness` lines from content in the DialogueBox, `met_wynn` + done flag via
`progressionDelta`, hint → Sable; the gym door before `grove_stone` → one toast "Mira Thornwell is not taking
challengers yet."; a wild win crossing L15 → "Cindercap wants to learn Fire Fang. Choose a move to forget" → forget
Growl → learned; Sable: lines, then the battle on the last page (lost twice to the Flash-Fire Coalette with fire
moves — the beat stayed open — then won with Tackle), his `after` lines; the door → `grove_stone`; Mira's `pre` lines
→ the league battle (her content team) → "Badge earned, +800 money" → her `post` lines → "Cindercap is ready to
evolve into Pyrecap" → evolved; `bloom_after`; "You already hold this badge."; harvest level 0 (intact) throughout.
Loss path (L9 grass starter): Mira's lines, defeat, no badge / money, party fainted. PvP start with the challenger's
party fainted: the accepter's toast "The other trainer's party needs healing first.", the challenger received
`reason { noUsableParty, playerId: <challenger> }`. A catch's delta carried `placement: party`; a traded Snapling
landed in the box (session store and the Box screen), the party unchanged.

---

# Part 4 — the measurement and screenshot harness (SPEC §50.2.3 `harness:budget`, §50.6.1 `harness:shots`)

```
pnpm --filter @ewa/client harness:shots  -- --zone mirevale --set M2      # 4 shots x 3 variants -> .screenshots/audit/M2/mirevale/
pnpm --filter @ewa/client harness:shots  -- --zone mire_route --set M2    # 2 shots x 3 variants -> .screenshots/audit/M2/mire_route/
pnpm --filter @ewa/client harness:budget -- --zone mirevale --shots all [--frames 600 --warmup 120 --diff-frames N --budget-ms 0|1 --report-only]
pnpm audit:assets -- --dump .screenshots/budget/mirevale.dump.json
```

Run from the repo root (relative `--out` / `--out-dir` resolve against `INIT_CWD`). Common flags: `--serve build|dev`
(default `build`: a `vite build` of `harness/index.html` only, into `dist/harness`, served with `public/` by a small
Node static server; `dev` = the Vite dev server with HMR and the watcher off), `--no-build`, `--width 1440 --height 900`,
`--headings words|rig` (shots). Chrome is launched by the script (`--headless=new --enable-unsafe-webgpu
--enable-webgpu-developer-features --enable-gpu --ignore-gpu-blocklist`, free debugging port from 9470, scratch profile)
and driven over CDP with Node's built-in `WebSocket` / `fetch` (no Playwright dependency); server and browser are
stopped on exit, error and SIGINT.

| File | Owns |
|---|---|
| `harness/index.html` | the separate Vite input (never part of the app's `index.html` bundle), served at `/harness/budget?zone=` and `/harness/shots?zone=` |
| `src/harness/HarnessWorld.ts` | offline world: `createRenderer({ trackTimestamp: true })` + the real SceneDirector, LocalPlayerController, RemoteInterpolator, InteractionTargets, HudWriter, SpawnViews, BattleController, silent AudioDirector; World3D's tick order at a fixed 16.667 ms dt; `drawMask()` |
| `src/harness/shotTable.ts`, `anchors.ts` | the §50.6.1 table as data; anchor resolution from content + the zone layout (rules below) |
| `src/harness/stage.ts` | stages one shot x variant (overworld settle; shot 5's scripted battle to turn 2's impact + 150 ms) |
| `src/harness/battleScript.ts` | shot 5's wild battle with `@ewa/core` (`createBattle` / `resolveTurn`), fed to the controller as `battleStart` / `battleEvents` |
| `src/harness/measure.ts`, `budgetRules.ts` | the §50.2.3 capture through the `BudgetProbe` only + the §50.2.1 / §50.2.2 assertions |
| `src/harness/main.tsx`, `HarnessOverlay.tsx`, `Harness.module.css` | entry, `window.__ewaHarness`, the DOM battle panel (BattleOverlay's panel + the real BattleMenu, no router blocker) |
| `scripts/harness/{common,shots,budget}.ts` | args, server, Chrome/CDP, PNG decode + checks, JSON writers |

**Outputs.** Shots: `<shotId>-<x>_<z>-<full|reduced|mask>.png` (x/z = the resolved anchor, cm), one sidecar
`<shotId>-<x>_<z>.json` per shot (table row, anchor + rule, `layoutSeed`, camera, post plan, counts, HUD / battle state,
notes, per-variant PNG checks: size, black share, greyscale share, mask coverage of the player / battler rects) and an
`index.json` per zone. The §50.6.1 file pattern has no slot for `layoutSeed`, so the seed is in the sidecar and index.
Budget: `.screenshots/budget/<zone>.json` = `{ machine, adapter, zone, shots: [{ id, counts, passMs, totalMs: { median,
p95 }, simMs }] }` + `violations`, `worst` and the full per-shot record under `detail` (counts max/min over the capture,
`withoutMs`, the per-context cross-check, CPU frame ms, sim ms, programs before/after), rewritten after every shot;
`<zone>.dump.json` = `dumpZone()` at the shot with the most draw calls. `.gitignore` now ignores `.screenshots/*` but
tracks `.screenshots/audit/` and `.screenshots/budget/` (SPEC §50.5 / §50.2.3 commit both).

## Anchor rules (committed data only; `test/harness-anchors.test.ts` pins them)

- **H1 — headings.** §50.6.1 says "0 = +z forward, 1 = +x, 2 = −z, 3 = −x"; the rig's heading k (§10.7.1: yaw −35° + 90°·k,
  camera at target + (sin yaw, cos yaw)·d) looks toward (−sin yaw, −cos yaw), so rig 0 looks roughly −z: the two differ
  by 180°. The harness follows the words (rig = `(h + 2) & 3`): only that reading frames the subjects (shot 2 looks at the
  gym door, shot 3 at the creature ahead in +x, shot 6 out over the east edge). Side effect: shot 1 at heading 0 looks
  south across the heart tree, whose crown hides the player standing at the spawn. `--headings rig` captures the
  literal-number reading into `headings-rig/`. A SPEC answer is needed (which convention §50.6.1 means).
- **H2 — door offsets are read in the door frame** (+z = the door's outward normal). The gym door faces +z, so (0, +8) is the
  same either way: (0, −18). Mirevale's shop door faces the plaza (normal (−0.30, −0.95)); the world-axis reading of
  (+4, +6) lands 0.08 m inside the shop's back wall (world (10.95, 28.16)); the door-frame reading is (1.34, 17.63).
- **H3 — the encounter spawn point.** The server draws spawn positions from a time-seeded rng (`ZoneRoom` `worldRng`), so no
  spawn point is committed. Rule: the table's first `common` slot (mire_route: mossling, level = `levelMin` 2) stands at the
  road-side edge of the layout's first tall-grass patch (`planLayout(spec).grassPatches[0]`, centre + (rz + 1.5 m) toward
  `roadZ`, just outside the builder's 0.9 m grass fringe): (−78.94, 2.30). A first capture used the patch centre, which
  buried the level-2 sprite in grass cards (useless for the §50.6.2 line-5 edge check); it is kept under
  `.screenshots/dbg/superseded/` (not tracked).
- **H4 — shot 5 position** = the engaging player's position (`BattleSummary.x/z` is `ps.x/z` in `ZoneRoom.engageSpawn`): from
  the shot-3 anchor toward the spawn, stopping 2.5 m away (inside `ENGAGE_RANGE_M` 3.0): (−80.32, 4.38). The pre-battle
  heading is shot 3's; SceneDirector then picks the least-occluded battle heading as it does online.
- **H5 — shot 6**: `edgePoint('town', 'e')` − `HANDOVER_INSET` = (58, 0). Neighbour streaming is NOT staged: the client has
  no neighbour prefetch (part 2 §20.10 row) and `Renderer.loadZone` rejects a second zone while one is loaded; the sidecar
  says so and the frame shows Mirevale's east edge only.

## Harness decisions

- **H6 — counts are read synchronously after `renderer.frame`.** three 0.186's own rAF loop runs `info.reset()` once per
  display frame, so a read after any `await` sees an empty frame (first run: `drawCalls 0`). The same holds for
  `dumpZone()` (its `counts` are `renderer.info`): the page ticks once and dumps in the same task. Render could snapshot
  `counts()` inside `frame()` step 6 instead (it already copies `RenderStats` there).
- **H7 — per-pass ms is differential.** The live per-context attribution (`RenderStats.passMs` via render's `PassTimer`)
  resolves every context to `opaque` (the uid → target lookup misses; the timed contexts print target `?`), so `passMs` is
  §50.2.3's differential (`T_all − T_without_p`, `opaque` the remainder, render's `computePassMs`); the per-context values
  stay in `detail[].passMsPerContext` / `contexts` as the cross-check. A toggled graph pass rebuilds the post chain, so
  every differential run re-settles (program count still for 30 frames) and re-warms first.
- **H8 — sim ms** is the harness's fixed step (input sample + prediction + remote interpolation + targeting + TimelinePlayer +
  audio step) without network input: a lower bound of the §50.2.1 `sim` row.
- **H9 — the mask variant** swaps the pipeline's output node for `renderOutput(vec4(vec3(mask.y), 1), NoToneMapping,
  LinearSRGB)` for one `post.render()` (no HUD overlay pass, DOM overlay hidden): grey = mask.y x 255, full effects
  otherwise, same frame state.
- **H10 — shot 5's moment.** Intro and turn 1 play in full through the real BattleController / TimelinePlayer; turn 2 runs
  until its first HP frame changes a bar (the impact: `impact` camera cue, hurt flash, drain start) plus 9 fixed steps
  (150 ms). Reduced effects rebuild the timeline with `ctx.reduced` (no shake / hitstop / slow-mo) at identical frame
  times. Seed = the first ≥ 1 whose turns 1 and 2 both carry a move `damage` and where nobody faints on turn 1.
- **H11 — HUD in the shots**: the canvas HUD (party strip, clock, nameplates ≤ 18 m, prompt, battle bars) and, in battle,
  the DOM panel with the last three log lines. §50.6.2 line 7's "type icons" do not exist on the canvas bars; the DOM menu
  shows move types only in its moves grid, which is closed while a turn plays.
- **H12 — frame counts for the M2 run on the dev iGPU.** A frame costs ≈ 240 ms of GPU time at 1440 x 900 on the Intel
  UHD (Gen-12) iGPU, so §50.2.3's 600 + 120 frames x 8 runs would take ≈ 25 min per shot position; the committed JSON was
  captured with `--frames 120 --warmup 60 --diff-frames 60` (recorded in `options`). The defaults stay 600 / 120 / 600
  for the reference machine.

---

# Part 5 — slice fixes from the M2 audit (2026-09-30; render IMPLEMENTATION-NOTES Part 5)

- **Compile progress (render T4 / T5).** `World3D` passes `onCompileProgress` to `createRenderer`.
  `bootProgress.WorldBoot` gains `compile: { loaded, total } | null` (the blocking phases: `'boot'` and a zone's phase
  1) and `background: { loaded, total } | null` (phase 2). `WorldBoot` shows "Compiling shaders n / m" / "Preparing
  <zone> n / m" with a real `ProgressBar` of compile units; `BackgroundCompile` (mounted beside it in `CanvasHost`) is a
  220 px corner pill, "Preparing distant scenery n / m", `pointer-events: none`, gone when the phase ends. Store writes
  happen in the compile callbacks, never in the tick.
- **Handover.** `enterZone` after the first frame puts the overlay back ("Travelling to <zone>", `ready: false`) until
  the new zone's first frame (`awaitingZoneFrame`), then the pill covers its background phase. The arrival position
  (`room.state.players.get(selfId)`) is `SceneDirector.loadZone`'s new `focus` → `renderer.loadZone(spec, { focus })`,
  so render compiles what the first view there draws before resolving (default: the zone spawn).
- **Battle framing (render T2).** `battle/panelInset.ts` is a tiny signal: `BattleOverlay` reports its section's top
  edge (ResizeObserver + resize) and clears it on unmount; `World3D.applyBattleInset` converts it to the panel's height
  over the canvas (`canvas bottom − panel top`) and calls `part3.setBattleInsets(0, px)` (null → render's SPEC default).
  `SceneDirector.FRAME_SHIFT_M` is 0: render frames the battlers above the real panel, which the 1.0 m look-at shift
  only approximated (and failed at the impact cue, audit M2-battle-5).
- **Type badges (M2-battle-7).** `BattleHud` bars carry `types`; `BattleController.typesOf` reads them from the species
  table on every `setBar`.
- **Budget rules (M2-gym-dusk-7).** `src/harness/budgetRules.ts` caps `counts.beautyDrawCalls` (beauty + post) at 400
  when render measures it, and `shadowDrawCalls` at 564 (§10.5.8); `countsMax.drawCalls` (a whole-frame total) is used
  only without the beauty count. Test: `harness-budget.test.ts`.
- **For the harness owner** (not changed here): renderers with `trackTimestamp` keep the single-phase compile by
  default, so captures stay fully compiled; §50.6.1's heading words now follow the rig (0 looks toward −z), so the
  `words` reading `(h + 2) & 3` must become the identity; `counts()` / `dumpZone()` can be read after an await (render
  B1); per-context `passMs` no longer collapses into `opaque` (render B1).

Checks: `tsc -b packages/client` clean, `eslint packages/client` clean, `vitest run packages/client` green
(`routes.test.tsx` is load-sensitive in the full parallel run and passes alone, as noted in part 2).

# Phase A interiors — pockets, themed gym halls, puzzles, hall arenas (2026-10-06)

Content places one POCKET per town building (a walled roofless hall in the zone's own outer band, `PlacedInterior`),
reached only by door warps; the server resolves door warps, gym trainers, switches and league trainers at their
`leaderAt`. The client half:

- **Render spec.** `zoneSpecFor` adds `interiors: interiorSpecsFor(zone.id)` (content's pockets flattened to render's
  `InteriorSpec`: local frames kept, gates as rect + id + style, switches id/kind/lx/lz, rooms id/arena/leaderAt/bounds,
  props; league ids and gate flags stay client-side). `[]` outside towns. Pocket door warps are NOT in `spec.warps`
  (those markers make render draw a "warp room"; the pocket is the room).
- **Interactables** (`scene/interiors.ts` `interiorInteractables`, registered with the zone's own): `<id>.in` / `.out`
  ('Enter Mirevale Gym' / 'Leave Mirevale Gym', kind `warp`); one `gym` per league trainer at its hall `leaderAt`
  (Solenne: Veil, Aurelia, Kirei, Zeon) — `LEAGUE_MARKER` (0, −26) and the `league[0]` pick are gone; gym trainers
  (`trainer`, disabled once `trainer:<id>:beaten` is held — the actor stays where it stands); switches (`switch`, prompt
  split from content's `label`: "Wake" + "the root-stone"; disabled once its flag is held unless it is a teleport tile);
  the shop keeper (`shop:<npc>`) and nurse (`healer:<npc>`, the league hall's nurse too) instead of the building door
  (the door fallback remains only for a shop / healer building without a pocket — none today); the healer's `pc` prop
  (`pc:<interior>`, new kind `pc` → `/play/box`); residents and guides (`npc`, client-local dialogue: `World3D.activate`
  falls back to `interiorNpcs` and opens the lines without an interact); hidden house items (`item`, same flag scheme).
- **Ranges** (`RANGE`): gym 3.5 (server 4 at `leaderAt`), shop / healer 3 (the keeper stands behind a counter, 2.1 m
  from the nearest floor; the server has no range for these), switch / pc 2.5 (server 3). `makeInteractable` takes an
  optional range.
- **Pocket tracking** (`SceneDirector.updatePocket`, every fixed step from `World3D.fixedStep`; `FloorIndex` is
  content's `onFloor` without allocation, so warps, switch teleports and server corrections are all covered without
  hooking each). Entering: `interiors.setActive(id)`, `camera.setYawBase(pocketYawDeg)`, `setHeading(0)`, `setView`, and
  the pocket's NPCs / gym trainers / leaders spawn (looks from content; leaders from the `LeagueTrainer`, facing the
  door). Leaving: `setActive(null)`, `setYawBase(null)`, the heading the player had outside, despawn. The yaw base is the
  pocket yaw itself: the rig's forward at yaw θ is (−sin θ, −cos θ) and a pocket's local +z (door side) is
  (sin yaw, cos yaw), so heading 0 looks from the door toward the far end (asserted in `interiors.test.ts`).
  `World3D.tick` forwards the rig's `dioramaYaw` to `syncView`, which calls `setView` only on change. Tracking pauses
  during a battle. `setYawBase` is called only when the rig has it (render's implementation was not in the tree yet).
- **Actor budget.** `remotes.cap` also reserves `pocketActorMax(zone)` (the most any one pocket spawns, ≤ 6).
- **Gates** (`GateSync`, created per zone load, synced on load and in `refreshFlags`): `gatesClosedFor(zone, flags)` →
  prediction blockers keyed by gate id with content's `.solid` (the capsule-grown centre-exclusion shape the server
  tests), plus `interiors.setGateOpen`; switch tiles → `setSwitchOn(id, flags.has(sets))` (flagless tiles stay off). Only
  changes are pushed. **Deviation:** render's `TerrainCollider.addBlocker` has no removal and render was off limits, so
  the removable blockers live in the client adapter (`collider.ts`: `addBlocker(id, solid)` / `removeBlocker(id)` /
  `blockerIds()` / `passable`); the solver runs on a view whose `passable` is `terrain.passable && !inside a closed
  gate` (resolveMoveInto tests centres only, like the server). The battle camera's `blocked()` does not see gates.
  Prediction is never looser than the server: a gate opens only after the server's flag reaches the client.
- **Hall battles.** `BattleController` keeps `battleStart.x / z / yaw` as the arena (the message arrives before the
  BattleSummary patch; summary, then the predicted self position, remain the fallbacks — a reload's `battleResync`
  carries none). `BattleView.enterBattle` gains `yaw` and `foeNpc` (an NPC / league side's content id). The director
  fights an arena that lies on a pocket floor along the hall axis (yaw base = pocket yaw, heading 0, no
  `pickBattleHeading`), passes `HallBounds` (floor centre, yaw, w/2, d/2) to `stage.dress`, and on exit restores the
  pocket camera (the in-hall heading) instead of the town default; every static actor's transform is restored. World3D
  restages the foe trainer actor (gym trainer / leader) behind its creature like a pvp foe (`isStaticActor`).
- **Dialogue.** `gymPlan` now covers the Wardens and the Champion, mirroring the server's `leagueRefusal` (Warden: not
  beaten, eight badges, previous Warden beaten; Champion: not beaten, every Warden beaten; story gate) — their `pre`
  lines open and the challenge is sent on the last page; a refused fight goes straight to the server for its toast.
- **Fixtures.** `test/zoneSpecFor.test.ts`: `interiors` is excluded from the R1 comparison like `plan`; the snapshot was
  re-baselined (every zone's digest changes with the new field); Solenne's `specFields` (warps, buildings, props,
  lights, actors) in `packages/content/test/fixtures/r1-pre-move.json` were re-captured (its plan changed deliberately;
  `about` says so); its `heightfieldDigest` keeps the pre-move value (the test asserts the stamped field differs). The
  gym-door test counts Solenne's league hall as its gym-slot building, and "authored points clear of buildings" is now
  `≥ 2 m`: Solenne's lectern (`lore_solenne_lectern`, (0, −24)) stands exactly 2.0 m in front of the league hall and
  0.93 m from its `Enter` warp (content placement — the nearer prompt wins; worth moving in content).
- **Not done / open.** Spectator arenas of other players' hall battles still use `dressSpectator(x, z)` without hall
  bounds (no contract for it). The pocket camera, `setView`, `setGateOpen` / `setSwitchOn` and hall dressing are coded
  against the contract with fakes only; the live render implementation was in progress, so nothing here was verified
  in a browser.

Tests: `test/interiors.test.ts` (7: Mirevale interactables, Solenne's four chambers, pocket tracking yaw base / heading
/ actors / setView, gates → blockers + renderer as flags change, a closed gate blocking predicted movement on the real
field, a hall battle, helpers), `battle-controller.test.ts` (+1: battleStart x / z / yaw as the arena),
`dialogue-flow.test.tsx` (+1: Wardens / Champion), `zoneSpecFor.test.ts` (+1: interiors flattened, deterministic,
pocket warps not in `spec.warps`), `scene-director.test.ts` (the gym at its `leaderAt`). Client: 23 files, 175 tests
green; `tsc` (client sources against the other packages' sources) clean; `eslint packages/client` clean.

# Phase B7 — battle presentation: visible opponent, VS intro card, victory / badge card, mid-battle leader lines (2026-10-06)

- **One foe actor** (`scene/foeActor.ts` `FoeActor`, `foeSpecOf`), reusable by raids and the post-game tower: `begin(spec)`
  picks `remote` (a pvp foe's avatar, restaged only while the interpolator has a rig), `static` (a director actor —
  route trainer, gym-hall trainer, league leader — restaged), `temporary` (no actor in the zone: a `battle:foe` actor is
  spawned with the content look — a story trainer fought from a beat in another zone) or `none` (wild / raid boss /
  legendary static: those sides carry no trainer). `stage(x, z, fx, fz, back)` every frame from `World3D.tick` (the far
  trainer slot, facing the player; allocation-free), `react(foeWon)` plays the result emote, `end()` stands a static back
  at its `restPose` (new `SceneDirector.staticPose(id)`; the director's own `restoreStatics` on exit still runs too) and
  despawns a temporary. World3D's `battleFoe` / `battleFoeStatic` fields are gone. The remote budget reserves one more
  rig for the temporary (`remotes.cap`).
- **Identity** (`battle/foe.ts`): `foeIdentity(trainerId, leadSpecies)` resolves LEAGUE → zone trainers → gym-hall
  trainers (name, title, type, look); a non-league trainer's "type" is its lead creature's primary type (TrainerDef has
  none). `foeOfState` reads the NPC side.
- **Emotes.** "cheer" / "sad" are render's emote ids 2 (`happy` → the `cheer` clip) and 3 (`sad` → the procedural bow;
  KayKit has no downcast clip). They fire when the result card appears (new optional `BattleView.ended(foeWon)`, called
  from `showResult` — after the final timeline, not at `battleEnd` message time, so the KO plays first). The player's
  own avatar emotes too (winner cheers, loser bows); caught / fled / draw play nothing.
- **VS intro card** (`battle/BattleIntroCard.tsx` + module): BattleController writes `ui.battleIntro` at `battleStart`
  for a trainer / league battle with an NPC trainer — never under effective reduced motion (`deps.reduced()`, the same
  flag the timeline uses), never on a resync restore. The card shows 1.8 s (`INTRO_MS`, the 600 ms push-in + lead
  switch-ins; exit in the last 240 ms) and clears the field. **Deviation:** no look thumbnail exists in the DOM (the
  looks are 3D atlases), so the emblem is the name's monogram on the type colour (`data-type` → `--tc`) plus a
  TypeBadge. Non-blocking, `role="status"`. It and the banner render beside — not inside — the battle panel (its
  `backdrop-filter` would be their containing block).
- **Result card**: a won badge shows its glyph, name and type colour (`badgeIcon.ts` gains `badgeDisplay(id)` — still the
  only file spelling badge ids); a won league battle shows the concession line. **Deviation:** `concessionLine` uses
  `post[1]` for gym leaders as asked (content documents it as the concession), but `post[0]` for the Wardens and the
  Champion — their `post[1]` sends the player on ("Aurelia keeps the count…", "Lean in…"), their concession is
  `post[0]`. The full `post` dialogue still opens after the card (unchanged), so that one line is seen twice.
- **Mid-battle lines**: content's `LeagueTrainer.mid { halfHp, lastStand }`. BattleController checks them as the
  timeline PLAYS (TimelinePlayer's `hp` / `enter` targets, i.e. the damage and switch-in frames), not at message time:
  `halfHp` once when the foe party's total displayed HP (`hpNow`, every member) is first ≤ 50 % of its total max HP;
  `lastStand` once when the entering foe creature is the only one with HP left (teams of ≥ 2) — it also retires a
  pending `halfHp`. The store write is deferred off the tick (`defer`). `ui.battleBanner` + `battleBannerQueue`
  (`pushBattleBanner` / `dismissBattleBanner` / `clearBattleBanners`): when both lines land close together the second
  waits for the first's 3 s instead of replacing it. `battle/BattleBanner.tsx` shows each for `BATTLE_BANNER_MS` 3 000
  between the top bar and the HUD turn-label band. A resync mid-battle re-arms nothing (the flags persist per battle).
- **Not verified live**: none of the above was driven in a browser this phase (unit / component tests only); the
  banner and card placement against the in-canvas battle bars at small viewports is unchecked.

Tests: `test/battle-presentation.test.tsx` (10: static restage + restore, temporary spawn + despawn + replacement,
remote rig gating + no foe for wild, identities + concession lines, intro for league with the card clearing itself,
intro for trainer and none for wild / reduced motion / resync, mid lines firing once each at the right frame with the
banner queue, a route trainer never bannering, result card badge + concession, no concession on a loss / Warden
post[0]); content `test/league-mid.test.ts` (3). Client + content: 36 files, 276 tests green; `pnpm typecheck` clean;
`eslint packages/client packages/content` clean.

## Phase B1–B3 (legendary statics, quest journal)

- **B1 legendary statics.** `scene/LegendaryViews.ts` owns the billboards (renderer sprite pool under the client
  group, the `SpawnViews` pattern) and the `static` interactables (`InteractableKind` gained `'static'`, range 2.5 inside
  the server's 3 m). `visibleStatics(zoneId, flags)`: a static stands when its gate flag is held (`badge:<id>` stays a
  badge flag; `flag:<f>` → `f`) and its `flag` is not, at `nearestWalkable(h, x, z, 8)` — the server's snap before its
  range check. Deviation: the SceneDirector does not touch sprites itself; it drives the views through a new optional
  dep `legendaries: () => { sync(zoneId | null, flags) } | null` (load → sync, `refreshFlags` → sync, unload →
  sync(null)), so its hunk stays three lines and its tests need no sprite pool. Interactable ids are
  `static:<species>` (spawn ids are server-generated); `E` sends `interact {kind:'static', targetId: species}` after
  the same party-can-battle check as a challenge. The win/catch flag arrives in a `progressionDelta`, the
  progression subscription calls `refreshFlags`, and the static despawns.
- **B3 quest journal.** `/play/quests` (`screens/QuestScreen.tsx` + module CSS, `questAction` in `app/actions.ts`,
  NAV entry "Quests" with a new `quest` icon and a ready-to-claim count). Model in `data/quests.ts` mirrors the server
  rules (active once every `requires` is claimed; count objectives `catchSpecies` / `winBattles`, others done on the
  first match; claimable when every objective is done). The server route `POST /quests/claim` already existed (server
  part 1) — no server change. Claim → `applyInventoryDelta` (inventory / money / creaturesAdded) +
  `applyProgressionDelta` with two REST-only additions: `ProgressionDelta.questClaimed` (appended to
  `questsClaimed`, deviation D4 pattern like `missionClaimed`) and the reward `flag` in `flags`. The trainer exp the
  server grants (`TRAINER_EXP.questComplete`) is not in `QuestClaimRes`, so it shows after the next GET /me.
- **Tracking.** `state/questTracking.ts` (zustand persist `ewa.questTrack`, storage failures fall back to memory) holds
  one tracked quest id; a claim untracks it. The HUD hint moved out of World3D into `scene/questHint.ts`
  (`questHintFor(progression, tracked)`): the tracked quest's first undone objective (`label (n/target)` for count
  objectives) or `Claim “Title” in Quests` once complete; otherwise the previous rule unchanged. World3D subscribes to
  the tracking store to rewrite the hint.
- **Not verified live** (unit / component tests only): the static billboards' scale and grounding in the real zones,
  and the journal's layout at small viewports.

Tests: `test/legendary-statics.test.ts` (4: gate flags, visible set at the snapped point for every static, views
spawn / prompt / despawn on the flag, director sync on load / refresh / unload); `test/quest-journal.test.tsx` (4:
status model, hint text, NAV, route render + mocked claim + Track); `routes.test.tsx` renders `/play/quests`.

## Phase C1 raids

- **Den** (`scene/RaidViews.ts`, `RaidDen`): while `room.state.raid` is open (phases 0–3) the boss stands at the
  hotspot `(x, z)` as a billboard with the renderer's alpha treatment (`descriptor(sp, key, 'normal', true)` →
  `alphaGlow`) at `RAID_DEN_SCALE` 1.8 × its size, inside a spectator ring (`stage.dressSpectator` — ring + the two
  glowing beacon pylons; `undressSpectator` on removal). No render change. A `raid` interactable (`InteractableKind`
  gains `'raid'`, `RANGE.raid` 8 = the server's `RAID_JOIN_RANGE_M`, from the same unsnapped hotspot point the server
  measures from) prompts "Join raid" in the lobby and "View raid" later (a new prompt object per phase). It goes at
  phase 4 or when the room drops the raid, and hides (billboard + ring) while the player's own raid battle is on.
  World3D drives it from its `onStateChange` handler (`syncRaid`: compares id / phase / hpPct, allocates only on a
  change; forced once after a zone load) — not from the tick.
- **E on the den**: phase 0 and not yet on the damage board → `raidJoin` (after the party-can-battle check), then
  `ui.openModal('raidLobby', { raidId })`; later phases open the modal as a read-only view.
- **Lobby** (`world/RaidLobby.tsx` + CSS module, mounted in PlayShell): all `room.state.raid` through `useRoomState`
  (boss, phase pill, countdown from `roundEndsInMs` — lobby 90 s / round 20 s / catch window 60 s —, shared HP,
  trainers = the damage board's keys, names from `state.players` when in AOI). Join → `raidJoin` (disabled with the
  hotspot's `minBadges` shown when short; full at 8); Ready up → `raidReady`; Leave → `raidLeave`. **Deviation:** the
  schema has no ready flags, so the modal keeps this player's own Ready in its payload (`{ raidId, ready: true }`);
  other trainers' readiness is not shown. The modal yields to the battle (`ui.battle !== null`; World3D also closes it
  on the fight-start `battleResync`).
- **Battle adapter** (BattleController, format 'raid'; the server half sends the resyncs): the fight-start
  `battleResync { battleId: raidId }` seeds the battle through the existing restore path (no battleStart / intro);
  `submit` sends `raidAction { raidId, round }` (validated locally, no preview, like pvp); Run is "Leave raid"
  (`raidLeave`, confirmed) → summary. `onRaidEvents` patches the state from the round's events (`patchFromEvents`),
  plays them, and advances the round (`raid.round = m.round + 1`; the round shown — turn label, `BattleUi.raid.round` —
  catches up when the timeline ends). The boss's bar and HP follow the shared `RaidState.hpPct` × its maxHp at each
  timeline end and on later hpPct patches (`onRaidState`, called by World3D) — a round's events only carry this
  player's turn, so other trainers' damage arrives that way. The enrage (`abilityTrigger … 'enraged'`) pushes a banner
  with the boss's name. The boss is named "the raid boss X" in bars and log lines (not "the wild X").
- **Catch window**: when the boss falls the second `battleResync` is held until the KO timeline has played, then
  restores the catch state: turn label "Catch window", the menu leaves only Orbs (one `raidCatch`) and Done (`check`
  disables the rest with "The boss is down — throw an orb"). A window without a catch try (no damage) goes straight to
  the summary; one arriving after a fainted player's summary was dismissed reopens the battle only when `canCatch`.
- **Summary card** (`battle/RaidSummaryCard.tsx` + CSS; `BattleResult.raid: RaidSummary`, BattleResultCard returns
  null for it): title Caught! / Raid cleared / Your party is out / You left the raid / The raid is over; your damage
  and place, the board (top 8, you marked), the catch line, and the rewards of `battleEnd { battleId: raidId }` (which
  now fill the card instead of the old toast; the toast remains for a battleEnd that arrives with no raid battle open).
  Shown after the catch roll's timeline, when the private battle ends against the player (party out), on Leave / Done,
  or when the raid ends (phase 4 / dropped — deferred until a playing timeline finishes). "Back to the world" closes the
  battle, then the evolve / learn-move prompts of the raid.
- **Raid panel** (`battle/RaidPanel.tsx` + CSS, in BattleOverlay for format 'raid' until the summary): boss + level,
  phase pill (Enraged in danger tone, the border too), shared HP bar + %, "Round n · Round ends in Ns" (or the catch
  window's countdown), damage board top 5 (+ you). Top-left under the HUD party strip.
- Foe actor: none for raids (the Phase B7 `FoeActor` gets `foeId`/`foeNpc` null → `none`); the music theme is `raid`.
- `messageRouter`: refusal details with their own copy (`tooFar`, `badges`, `full`, `started`, `noParty`, `noWindow`,
  `noOrb`) instead of "That is not allowed right now. (tooFar)".
- Model helpers in `battle/raid.ts` (`raidInfoOf`, `boardRows`, `boardFlat`/`unflattenBoard` for useRoomState,
  `countdownLine`, `raidMinBadges`, the mirrored `RAID_JOIN_RANGE_M` / `RAID_MAX_PLAYERS`).
- **Verified live** (isolated probe server on REST 4300 / WS 2867 + client 5194, headless Chrome 154 with WebGPU via
  Playwright; a scratch script booted the real server and called `room.openRaid` with a weak test boss next to the
  player, because the real hotspots only open in their UTC window and no dev route exists): den + ring + "Join raid"
  prompt within 8 m; E → lobby, joined (server toast), Ready up → fight start resync → raid battle with the panel;
  rounds through the battle menu (raidAction, events, panel HP / timer / board); boss down → catch window (Orbs + Done
  only, boss at 1 HP), a Spark Orb → the roll played → summary "Raid cleared", +100 money / +150 trainer EXP, money
  updated in the top bar; after dismiss the den stands again (phase 3). A first run with a stronger boss ended with the
  party fainting: the summary appeared but said "The raid is over" — the raid's phase 4 patch beat the timeline end;
  fixed (the fainted check now runs before the deferred-end check) and covered by a unit test, not re-run live.
  Not verified live: two players in one raid, the enrage banner, leaving mid-fight, a fainted player's catch-window
  reopen, the lobby at small viewports.

Tests: `test/raid.test.tsx` (8: model + board order; den appear / prompts / range / phase / hide / ring / gone;
lobby join → ready → yields to the battle; badge gate + dropped raid; controller fight start → raidAction → events →
hpPct bar → enrage banner; boss down → held catch resync → orbs only → raidCatch → summary with rewards → dismiss;
leave / ineligible window / reopen with a catch try / phase-4 summary / fainted party; raid panel from the room).

## Phase C3 — world map, HUD minimap, fast travel (2026-10-06)

- **`/play/map`** (`screens/MapScreen.tsx`, lazy route, NAV "Map" with a new `map` icon, key `M` — a new `map`
  `InputAction` defaulting to `KeyM`, in the Controls table and the shortcut hint bar). Zones sit on a gapless grid at
  content's `zoneMapPositions()` cells (148 × 168 px) so the SVG link layer, drawn in cell units with
  `vector-effect: non-scaling-stroke`, meets cell centres; the board scrolls sideways and opens centred on the current
  zone. Each node: name, kind, services (visited towns), the badge gate chip (earned / locked), "You are here", and a
  Travel button on visited towns other than the current one (`data/worldMap.ts`: `visitedSet` = the server's `visited:`
  flags plus the session zone; `canTravelTo`), hidden in battle. Travel sends `fastTravel { zoneId }` and closes the
  panel; the server answers with the ordinary `handover` (WorldSession's existing path) or a refusal toast —
  `messageRouter` skips the matching `error` (`FAST_TRAVEL_REFUSALS` join `EXPLAINED_DETAILS`).
- **HUD minimap** (`world/Minimap.tsx` + `world/minimapDraw.ts`): a DOM 2D `<canvas>` (168 CSS px, DPR ≤ 2), top-right
  under the canvas HUD's clock / quest hint, an `<aside>` of the shell so F1 hides it; not rendered while a panel is
  open, in battle, or without world capability (jsdom: `routes.test` still finds no canvas). Each view's base — the
  zone's playable square, or the hall the player stands in (`interiorAt`), drawn in the hall's own frame (placement
  yaw, door wall at the bottom) to match the hall camera — is rasterised once per view with `createImageData` /
  `putImageData` (never `getImageData`) from the heightfield's walkable / water bits, plus exits (centroid of the
  walkable samples on each linked playable edge) and gym / shop / healer door markers from `zonePlan`. A 4 Hz interval
  blits the base and draws the AOI's other players and the player (heading tick) from `room.state` — preallocated dots,
  no React state per tick; the HudWriter and render's `HudModel` are untouched (the minimap is not a canvas-HUD field).
  Roads are not distinguished from other walkable ground (the heightfield has no road bit).
- **Tests.** `test/world-map.test.tsx` (8): nodes = zones, links join neighbours; visited / travel rules; nav + `M`
  binding; the route renders 21 zones with their visited state and only "Travel to Cinderhold" for the fixture, which
  sends `fastTravel` and returns to `/play`; `M` opens the map; the minimap renders in jsdom without a context; the base
  draws once with `putImageData` and marks Mirevale's east exit + gym / healer; a hall view is centred on the hall with
  the way out bottom-centre.
- **Live (own dev server on alternate ports, headless Chrome over CDP, 1440 × 900):** minimap drawn in Mirevale (exits,
  gym / healer / shop, water, the player); walked into Mire Route (the minimap swapped zones); the map read "2 of 21
  explored" with Travel on Mirevale only; Travel → handover → standing at Mirevale's spawn (0, 6); entered the Mirevale
  healer → the minimap showed the hall in the camera's orientation. With Map the top bar has 11 links: they fit with
  labels at 1440 px but overlapped the money / account cluster by ~22 px at the 1280 px minimum, so under 1400 px the
  links show icons only (`TopBar.module.css` media query; the label stays for screen readers, `title` for the pointer)
  — checked live at 1280 × 800.

## Phase C4–C5 — rankings, history, profiles, bag (2026-10-06)

- **Routes** (lazy `/play/*` children, `router.tsx`): `/play/rankings` (`rankingsLoader` → GET /leaderboard?mode=&page=),
  `/play/history` (`historyLoader` → GET /history/battles or /history/trades by `?tab=`), `/play/profile`
  (`profileLoader` → the player's own GET /players/:me; `profileAction.save` → POST /profile), `/play/players/:username`
  (`playerLoader`; 404 / 400 → `pub: null` → "No trainer by that name" inside the panel), `/play/bag` (`bagAction`).
- **Top bar.** Bag joins NAV (12 links; the < 1400 px icon-only rule still fits at 1280 — checked live). Profile,
  Rankings and History live in the account menu (`ACCOUNT_LINKS`, new `user` / `trophy` / `clock` icons) above Log out.
- **Rankings** (`screens/RankingsScreen.tsx`): tabs Rating · Dex · Trainer level bound to `?mode=` (the default `rating`
  drops the param), the mode's metric column leads, rank 1–3 in the warm tone, the player's own row uses the Table's
  `selectedKey` highlight plus a "You" pill and a "You are #n on this board" line; every name links to the public
  profile. Pager Previous / Next (`?page=`) when a page is full (server page size 25). No client re-sorting.
- **History** (`screens/HistoryScreen.tsx`): battles (result pill, opponent + format + turns + "badge earned", rating
  delta signed, rewards line, relative time) and trades (partner linked to the profile, what went each way incl. money).
  **Server/protocol addition:** `TradeHistoryRow.partnerUsername` (optional, nullable — the row only carried
  `partnerId`); `GET /history/trades` resolves the page's partners with one `players.byIds` lookup
  (`server/src/rest/routes/catalog.ts`; `server/test/history-routes.test.ts`). No new route was needed.
- **Profile** (`screens/ProfileScreen.tsx`, shared pieces in `screens/TrainerCard.tsx`): identity card with an in-place
  editor (Title ∈ content `TITLES`, Look ∈ `BODIES` labelled "Ranger (f)" by id suffix, Motto ≤ 120), a live preview,
  Save / Reset; stats / badges / showcase come from the player's own public profile (what others see; badges from the
  session store, which only the server writes). A new session writer `applyProfile({ title, motto, body })` takes the
  POST /profile response (identity only — not progression or inventory, so `no-client-badge` still holds).
  **Achievements:** Phase D5 brings `QuestDef kind: 'achievement'`; until then `achievementQuests()` lists the quests
  no NPC gives (`q11_first_night`, `q12_first_morning`) with progress, or an empty state if none.
- **Bag** (`screens/BagScreen.tsx`, `data/bag.ts`): Consumables · Orbs · Held items · Key items (sections, not tabs, so
  everything carried is visible at once; empty groups say "None yet."). Use on a creature (potions, cures, revives, PP,
  Rare Candy with a quantity stepper) opens a party picker; creatures the server would refuse (`noEffect`) are disabled
  with the reason (`noEffectReason` mirrors party.ts's rules for display). Field items (repel, lure, escape rope) post
  `target: null` at once. Give a held item → picker → `POST /creature/:id/setup { ability: current, heldItem }` (the
  old held item returns server-side; `bagAction.give` reuses the `setup` handler and toasts). Held rows say who already
  holds one. Orbs say "Throw in battle", key items "Always with you", sell-only goods "Sell at a shop". The picker lists
  the party only (box creatures keep using their own panel). `presentItemUse` toasts "Used Repel." when there is no
  target creature.
- **`B` key** now opens `/play/bag` (it opened Party); the shortcut hint bar reads "B Bag".
- **Tests.** `test/rankings-profile.test.tsx` (6): account links; rankings default + own row + Dex tab refetch with
  `mode=dex` + column order + Trainer level "not on this page" + link → public profile; public card; public 404;
  history battles → trades tab with the partner link; profile edit → POST /profile → `applyProfile` + toast.
  `test/bag.test.tsx` (8): grouping; use kinds + no-effect reasons; NAV; route groups + actions + "Held by"; potion
  picker (full-HP disabled) → POST /item/use → inventory + creature + toast; repel with `target: null`; give → setup →
  heldItem + count; `B` opens and closes the bag and the hint says Bag. `routes.test` renders the five new routes.
  Server: `test/history-routes.test.ts` (4: trades partnerUsername, battles paging, leaderboard modes, POST /profile).
- **Live** (own server REST 4400 / WS 2967 + client 5195, headless Chrome 154 via Playwright, 1440 × 900 and 1280 × 800):
  account menu → Rankings (own row highlighted) → Dex tab → a second account's public card (title, motto, look, stats,
  badges, showcase) → unknown name → "No trainer by that name"; History empty states for both tabs; Profile title +
  motto saved (server's public profile read back "Witness | Count the morning."); `B` from the world → Bag; Use Potion
  picker with the full-HP starter disabled ("Already at full HP"); the 12-link top bar and the account menu at 1280 px.
  Not verified live: a successful item use / field item / give (fresh accounts have a full-HP starter and no held items),
  battle and trade rows (covered by the mocked tests), paging past 25 rows.

## Phase D2–D3 — Teach, tutors, stones, trade evolutions (2026-10-06)

- **Item lookups.** `data/content.ts` registers `KEY_ITEMS` (old_rod, TMs → Bag "Key items") and `EVOLUTION_STONES`
  (consumables; `CREATURE_ITEMS` includes them). Helpers: `stoneTarget`, `tradeEvolveTarget`, `ownedTmMoves`,
  `teachRefusal` (mirrors the server's checks for display only).
- **Teach** (`screens/TeachSection.tsx`, inside `CreatureDetail`, so Party and Box both have it): owned TMs (incompatible
  rows disabled with the reason) → `teach` intent → `POST /creature/:id/moves`; when the URL carries `?tutor=<npcId>` and
  that tutor stands in the session's zone, its moves at ₽3000 → `tutor` intent → `POST /creature/:id/tutor` (money +
  creature via the inventoryDelta body). Four known moves → a modal picks the move to forget. Rows are 1px-bordered
  cards (no accent stripe).
- **Tutor in the world.** World3D: interacting with an NPC that has `tutor` (and no story beat) shows its lines; paging
  past the last opens `/play/party?tutor=<npcId>` (Escape just closes). The interact is still sent (talkTo quests).
- **Stones.** Bag "Use" on a stone → party picker (creatures that do not react are disabled: "Does not react to it");
  the creature panel offers a stone only to a creature that reacts. `/item/use` answers `evolveReady { item }`;
  `presentItemUse` queues one evolve prompt with `item` and toasts "<name> reacts to the <stone>". The evolve modal says
  "Evolving uses one <stone>." and applies the response's optional `inventoryDelta`.
- **Trade evolutions.** `messageRouter` calls `queueTradeEvolutions(m.creaturesUpdated)` after every `inventoryDelta`:
  a creature carrying the trade marker whose species evolves by trade gets one evolve prompt (`trade: true`).
- Error copy for `noTutorHere`, `alreadyKnown`, `movesFull`, `notKnown`, `alreadyOwned`, `oneAtATime`.
- Not verified live in the browser (mocked tests only): `test/teach-evolve.test.tsx` (6).

## Phase D4/D5/D7 (2026-10-06)

- **D4 shinies.** `SpawnLike.isShiny?` → `descriptor(…, isShiny)` → `SpriteDescriptor.isShiny` (sparkling billboard); the
  spawn label reads `shiny …`. Battle: `TimelineCtx.shinyOf` (BattleController reads `creature.isShiny`) — a shiny's
  switch-in adds `shiny_sparkle` (`SHINY_MS 900`) and “… sparkles — it’s a shiny!”; `World3D.setBattler` passes the flag.
  Dex: `Progression.dexShiny?` (GET /dex `shiny`, REST-only like `dexAlpha`), a sparkle mark on the tile (shifted left of
  the alpha mark when both) and in the detail, the State filter gains `shiny` (`?state=shiny`). Market: `isShiny` filter
  (URL param, `MARKET_PARAMS`), `Shiny` pill in rows and the listing detail. `CreatureCard` badge `shiny`. Icon `sparkle`.
- **D5 achievements.** `data/quests.ts`: `objectiveTarget` covers the new kinds; `achievementQuests()` is now
  `kind === 'achievement'` only (the shrine's First Night / Morning are story quests again); `storyQuests()`,
  `achievementProgress()` (single objective → count/target, else objectives done/total). `QuestScreen`: Tabs Story /
  Achievements (`?tab=achievements`), ready achievements as Claim cards, the rest as progress rows, then Earned.
  `ProfileScreen`: earned-first list with `N of 30 earned`. `questHint`: achievements never drive the untracked hint.
- **D7 weather.** `SceneDirector` keeps the overworld weather (`setWeather`) and renders `none` inside a pocket and while
  a battle owns the stage; leaving either restores it (exitBattle used to force 'none' until the next schedule change).
  The timeline reads an ambient `weatherSet` (source null, turns 0) with the "continues" text.
- Tests: `test/achievements-shiny.test.tsx` (5), `interiors.test.ts` "Phase D7", `timeline.test.ts` (ambient text),
  `rankings-profile.test.tsx` (profile achievements updated). Mocked/jsdom only — not verified live in the browser.
