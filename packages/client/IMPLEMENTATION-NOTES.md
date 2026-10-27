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


---

# Part 6 — the evolution sequence (2026-10-05; render IMPLEMENTATION-NOTES Part 7)

Evolving was a confirm modal → `POST /creature/:id/evolve` → a toast; the creature just swapped. Now every evolve path
plays render's evolution sequence (`stage.evolve`) after the server confirmed it. SPEC: §20.5.6, §20.9.2, §20.9.3
(CHANGELOG 2026-10-05).

| File | What |
|---|---|
| `src/app/evolution.ts` | the DOM-side seam (no scene import): `evolveCreature(c, into)` (REST → the one inventory writer → `playEvolution`), `playEvolution(req)` (sets `ui.evolution` for the whole sequence, serialises sequences, banner-only fallback without a world), `preloadEvolution(species)`, `setEvolutionPlayer` |
| `src/scene/EvolutionDirector.ts` | the world side (World3D's `EvolutionPlayer`): descriptors from the sprite catalog, both species' atlases asked for, `stage.evolve`, the input lock, the skip capture, the facing, the restore |
| `src/world/EvolutionBanner.tsx` + `.module.css` | the DOM banner ("Evolution" / "<Name> evolved into <Species>!", `role="status"`) and the "Space or click to skip" pill |
| `src/state/ui.ts` | `evolution: EvolutionUi | null` (`playing` → `revealed` → `leaving`) + `setEvolution` |
| `src/world/PostBattlePrompts.tsx` | Evolve calls `evolveCreature`; preloads the new form when the prompt opens; the queue waits while `ui.evolution` is set |
| `src/scene/World3D.ts` | builds the director at boot and registers it; `worldBlocked` includes `ui.evolution`; the tick faces the avatar toward the creature; dispose cancels |
| `src/app/PlayShell.tsx` + `.module.css` | mounts the banner; `data-evolving` fades the panel slot and the hint out (`visibility: hidden`); the shell hotkeys ignore keys while evolving |
| `src/harness/{HarnessWorld.ts,HarnessOverlay.tsx,main.tsx}` | the harness builds the same director and shows the banner; `__ewaHarness.evolve(from, to, reduced)`, `step(ms)`, `evolution()` |
| `test/evolution.test.tsx` | 6 tests (below) |

**V1 — server truth first.** `evolveCreature` awaits the REST answer, writes the returned creature through
`applyInventoryDelta`, and only then calls `playEvolution` with the RESPONSE's `speciesId` / variant / alpha; a
failure throws before anything plays (the prompt's `danger` toast names the code, the prompt stays). The success toast
is replaced by the banner. The Rare Candy path is the same component: `presentItemUse` queues the explicit evolve prompt
from the server's `evolveReady` item event, and the prompt shows over the Party screen.

**V2 — one sequence at a time, prompts after it.** `ui.evolution` is set synchronously by `playEvolution` (before the
prompt calls `shiftPrompt`), so `PostBattlePrompts` renders nothing until it clears: a learn-move prompt queued behind
the evolve prompt opens after the banner. A second `playEvolution` waits for the first.

**V3 — the input lock** (`EvolutionDirector`): at start `input.setEnabled(false)` and `hud.setVisible(false)`; every
world action is gated by `worldBlocked()` (now including `ui.evolution`), the shell hotkeys check it, the panel slot is
hidden (`visibility`, so nothing in it takes focus or a click). `Space` / `Enter` / `NumpadEnter` / `Escape` and a
primary click (window capture phase) call `handle.skip()` — the keys are `preventDefault` + `stopImmediatePropagation`
(Escape would otherwise open Settings, Space is the jump bind), a held key skips once, other keys pass through to the
(blocked) capture. At the end: listeners removed, the HUD back to the F1 state, input back on unless a battle took
over (render's `dress` cancels the sequence; `inputAfter` reads `ui.battle` / `director.inBattle`).

**V4 — off the tick.** Render calls `onPhase` from its frame hook (inside `renderer.frame`); the director defers the
`reveal` / `exit` callbacks with `setTimeout(0)` before they write the store (B8). The tick adds one branch (the
avatar's heading toward the creature, `atan2` on numbers) — no allocation, no React.

**V5 — atlases.** The prompt binds the new species when it opens (`preloadEvolution` → `ensureSpecies`); the director
asks again for both forms at the start (a no-op when bound); render's sequence waits for both binds (≤ 8 s).

**V6 — the banner.** Bottom-centre over the canvas like a game text box (the close-up frames the creature and its
trainer in the upper four fifths; a top banner covered the trainer's head in the harness shots), `--glass` with the
eyebrow in `--accent-hi`, the line in the display face at `--t-h2`, the species in `--accent-hi`; it fades in / out over
`--motion-banner` (0 ms under reduced motion), `--z-toast`, no pointer events. Without a world (no zone, a battle) the
banner alone shows for `BANNER_ONLY_MS` 2.6 s.

**Verified in the harness** (client dev server on :5182, `/harness/index.html?zone=mirevale`, headless Chrome over CDP,
`__ewaHarness.evolve('bramblecub', 'briarbear')`, 150 ms steps): the whole sequence through the real seam, director,
stage and banner, full and reduced; the banner appears at the reveal frame and fades at the exit; the trainer stands
beside the creature, both in frame. The live game (ports 4000 / 2567 / 5173) was not touched.

**Tests** (`test/evolution.test.tsx`, 6): a refused evolve plays nothing and keeps the prompt, a confirmed one plays the
response's species strictly after the response, writes the inventory, holds the next prompt, shows / fades the banner
and opens the next prompt at the end; Rare Candy (`presentItemUse` → prompt → Evolve → sequence); post-battle (the
prompt behind the result card plays once the battle UI is gone); the banner-only fallback; `EvolutionDirector` locks
input and the HUD during the sequence and restores them after (and keeps input locked when a battle cancels it), skips
on Space / Enter / Escape / click only (KeyW passes, a repeat skips once), defers phase callbacks, removes its
listeners; it refuses to play (null, nothing locked) without a zone or a sprite. Client total: 23 files, 171 tests
(+ the harness-free suites unchanged); `perf/tick` passes in the full run.

---

# Part 7 — the animated legendaries' flipbooks (2026-10-06; render IMPLEMENTATION-NOTES Part 8)

The sprite pipeline ships every page of the 10 legendaries / mythicals as flipbooks (40-pipelines.md §40.1.8) and the
billboard plays them (10-render.md §10.4.5). The client's part is the adapter and the binds.

| File | What |
|---|---|
| `scene/spriteCatalog.ts` | `sprites[id].anim.<side>` → `SpriteFrame.anim` (`frames → rects`, `delays → delaysMs`, `staticFrame`); `animAtlases` → render `AnimAtlasSet`s (`animAtlas(id)`, `animAtlasesOf(species)`, front first); `bytesOf` covers both kinds; a flipbook whose atlas the manifest does not list stays static. `speciesAtlases(cat, sp)` = static atlases + flipbooks; `bindCatalogAtlas(pool, cat, id)` routes an id to `bindAtlas` / `bindAnimAtlas`. |
| `scene/World3D.ts` | `bindZoneAtlases`: the zone set + the flipbooks of the zone's legendary statics (content `staticsFor(zoneId)`) + the party's species with their flipbooks; `ensureSpecies` (spawns, battles, evolution, trades) binds a species' flipbooks with its static atlas. The static frame shows until a flipbook lands. |
| `harness/HarnessWorld.ts`, `harness/main.tsx` | the harness binds the same way; dev hooks `__ewaHarness.world` (the HarnessWorld, for CDP drivers: `setWild`, `place`, `script`, `startBattle`, `runWhile`) and `__ewaHarness.billboards()` (id, side, `animated`, page, `paused`, `bound`) |
| `test/spriteCatalog.test.ts` | 4 tests: the mapping on an inline manifest, an unlisted flipbook stays static, `bindCatalogAtlas` routing, and on the shipped manifest exactly the 10 animated species animate on both sides with 512² cells and their source delays |

Measured in the harness (`/harness/shots?zone=galvan_route`, served by `scripts/harness/common.ts` `serveDev` on its own
port, headless Chrome over CDP): raikitsune placed as a wild spawn 4 m in front of the player plays its front flipbook
(SpawnViews → `ensureSpecies` → static + flipbooks), then as the battle foe of the scripted wild battle (the lead
bramblecub stays static); programs 103 at boot, 103 with the flipbook, 101 in battle. Shots:
`.screenshots/anim-legends/harness/` (gitignored).

Open: thumbnails stay static by design; the client never releases an atlas (pre-existing), so flipbooks accumulate
GPU memory (≈ 100–150 MB per animated species, both sides) over a session — render Part 8, open item 1. Client total: 24
files, 175 tests.

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

## Phase D6 — doubles battles in the client (2026-10-06)

- **Addressing.** Core refs stay party indices everywhere (timeline frames, HUD callbacks). Stage refs are
  `{ side: side ^ seat, slot: field position }`. `TimelinePlayer.play(tl, seat, actives)` seeds a party → position map per
  side from the starting state's `actives`; the `enter` pose frame of a `switchIn { pos }` carries `pos` (the only new
  keyframe field, absent in singles) and moves the map. `positionOf(side, slot)` (-1 = off the field) routes hp / status /
  stage / enter in the controller, whose `displayed` is now per side × position. Singles: position 0, byte-identical.
- **Timeline.** `TimelineCtx.activesOf` / `standing` (doubles only). Idles and the winner's celebrate address every
  standing field battler; a drain points at whoever the drainer last hit (no source on `heal`); a spread move draws one
  move VFX per `targets` entry (the 8-emitter pool recycles, never grows); a per-target `moveFailed { target }` immune line
  names the target. Existing singles timeline tests are unchanged and green.
- **Selection: collect, then send.** The controller owns `ui.battle.pick { pos, picks }`: `submit` records the choosing
  position's action and moves on (`requiredPositions`); `undoPick` (menu "Back to X") re-opens the earlier position; when
  the last required position picks, `validateSideChoice`, then one `battleAction { pos }` per position in position order,
  then the `[[a0, a1], null]` preview (trainer / league; pvp none). Chosen over send-as-you-go so the first pick can be
  undone without a server round trip and the preview always sees both actions. A forfeit fills every required position.
  The cross-position rule "two switches to the same creature" is pre-checked in `check` ("Already chosen").
- **Targets.** Single-target = `!isSpread(def) && (power > 0 || target === 'foe')`. Candidates: standing foes (position
  order), then the standing ally; never the user. One candidate → taken without asking. The target is a `FieldRef`
  (position), not a party index.
- **HUD.** `BattleHud.setLayout(doubles)` rebuilds the double buffer once per battle with four bars (near 0, near 1,
  far 0, far 1); setters take the position as a trailing default-0 argument; stage arrows are kept per bar. The bars are
  canvas (render `HudLayer`, which places ≤ 16 bars without overlap), so the CSS module only gained the target list.
- **Label.** `ACTION_ERROR_LABEL.badTarget` = "Not a target".
- **Wiring.** `BattleActions.undoPick?` (World3D and HarnessWorld pass `battle.undoPick`).
- Tests: `test/doubles.test.tsx` (8): four stage battlers + four bars (two in singles); pick 0 → Back → pick 0 → pick 1 →
  two `battleAction { pos }` + matching preview digest; same-switch refusal; replacement phase (one pick, `pos: 1`);
  timeline addressing (damage on foe party 2 at position 1 hurts stage `{1,1}`, switch-in at pos 1 swaps slot 1, bar 4
  follows); `buildTimeline` doubles frames; the menu's target list (3 targets for Tackle, none for Rock Slide / Bulk Up),
  Back, and Party ("In battle" ×2, "Already chosen"). Not verified live (no server doubles encounter was available).

## Phase D8–D11 — world systems (2026-10-06)

- **Surf prediction.** `StepCollider.setSurf(on)` / `surfing` / `onWater`; the solver view passes `surf` through and
  `height` is `surfaceY`. World3D sets surf every fixed step: HM Surf held, zone biome not cinder (lava), bike folded.
  The render actor pool rides the level for everyone (local and remote) with the ripple.
- **Fishing.** `scene/fishing.ts` `FishingController` (pure; 1.2–3.2 s wait, 700 ms bite window, 1 000 ms under reduced
  motion, 900 ms 'missed'), `waterAhead`; `state/fishing.ts` (phase store + reel / cancel actions); `world/FishingPrompt.tsx`
  + CSS module (a button card: bobbing float / pulsing "!" / "It got away."; frozen under `data-reduced='1'`), mounted in
  PlayShell after the dialogue box; it owns E / Enter / Space / Escape (window capture) while up. A dynamic 'fish'
  interactable rides the first water sample ahead (allocation-free per step) when the rod is held, outdoors, on foot.
  A landed bite sends `fish { angle }`. `worldBlocked()` includes an active cast; a battle start / zone change cancels.
- **Obstacles.** `zoneSpecFor` passes `obstacles` only where content has some (the snapshot changed for exactly the five
  obstacle zones; the R1 test excludes the key like `interiors`). SceneDirector: an 'obstacle' interactable per obstacle
  ('Cut the small tree' / 'Push the boulder') enabled until its flag; `syncObstacles` pushes `ObstaclesHandle.setCleared`
  and `ObstacleSink.setObstacles(lookup = content obstacleAt, cleared)` on load and when the cleared set changes (new dep
  `obstacles`, World3D passes its `StepCollider`). `activate` pre-checks `obstacleRefusal` and toasts content's text.
- **Bike.** `InputAction 'bike'`, default `KeyV` (free), label "Bicycle (ride / fold)", `InputCallbacks.toggleBike`.
  `LocalPlayerController.setBike/biking`: the step ring stores the gait 0 / 1 / 2 (bike), a message carries `bike` when
  any step of its window was ridden. World3D mounts only when owned, outside a pocket and not on open water (toasts say
  why), folds it in a pocket or when the item is gone (toast deferred off the tick); the avatar shows the run gait.
- Not done: a bicycle mesh and a surf pose (no model in the KayKit set; the rider runs, the surfer stands on the water
  with the ripple). Not verified live in a browser this phase (unit + server integration tests only).
- Tests: `test/world-systems.test.ts` (10); `test/zoneSpecFor.test.ts` (R1 excludes `obstacles`, asserts them; snapshot).

## Phase D12–D13 — tutorial and ranked queue (2026-10-06)

- **Tutorial (D12).** `state/tutorial.ts`: seven steps (move 8 m → `met_wynn` → party panel → wild battle → catch →
  win → heal), events latched per account in a persisted zustand store `ewa.tutorial` (deviation: its own store, not a
  `SettingsData` section — progress is per account and the settings blob is per browser; same `persist` + safe
  storage pattern). `pastOpening` = any badge or a flag set by a story beat other than first_witness / mire_rival (from
  content `STORY`) → marked done on sight. `world/TutorialCard.tsx` (mounted in PlayShell under `worldCapability()`, like
  the minimap): the tracker reads the own `PlayerState` through `WorldSession.subscribeState` (`MoveMeter`, jumps over
  6 m and room changes ignored), session flags / dexCaught, the location (`/play/party`) and `ui.battle`
  (format / result); heals call `noteTutorialEvent('healed')` from `app/actions.ts` and `scene/World3D.ts`. Hidden under
  battles, dialogue, panels and with the HUD off; reduced motion drops the entry slide (`:root[data-reduced='1']`).
- **Ranked (D13).** `state/ranked.ts` (written only by `messageRouter` from `rankedStatus`; reset by
  `installMessageRouter`'s new `onRoom(null)` hook), `screens/RankedPanel.tsx` at the top of `RankingsScreen` (Find a
  match / elapsed + window / Leave queue / matched). A 'matched' older than 30 s with no battle shows idle again.
- Not verified live in a browser this phase (unit tests + the server integration tests).
- Tests: `test/tutorial-ranked.test.tsx` (13).

## Phase D14 — post-game (2026-10-06)

- **Rematches.** `scene/dialogue.ts`: `rematchOffer` (mirrors the server's `leagueBeaten`), `gymPlan` opens the rematch's
  `pre` lines after the Champion (the cooldown is server-side only: a too-early ask pages through the line, then gets the
  server's toast), `rematchOfBattle(state, seat)` (NPC party = rematch team), `leaguePostDialogue(id, rematch)`.
  World3D shows the rematch `post` lines after a won rematch; `BattleResultCard`'s concession is the rematch `post[0]`.
- **Tower.** `InteractableKind` `tower` (range 2.5) for the attendant (`scene/interiors.ts`); World3D: attendant lines
  before the Champion, after it the lines then `ui.modal 'tower'` (or straight to the modal mid-run). `state/ui.ts`
  `tower: TowerUi | null` + `setTower`; `messageRouter` writes `towerState` (fighting closes the modal, the rest open it).
  `world/TowerModal.tsx` (picker / between fights / summary; `togglePick`, `towerFightLabel`, `towerRewardLine`) and
  `TowerStreak` (top-left counter during a tower fight), mounted in `PlayShell`; CSS `TowerModal.module.css` (tokens only).
  `battle/foe.ts` names the tower opponent `TOWER.trainerName`.
- **Rankings.** Fourth tab "Tower" (`?mode=towerStreak`, leading column Streak = `towerBest`).
- Not verified live in a browser this phase (unit tests + the server integration tests).
- Tests: `test/postgame.test.tsx` (8); `dialogue-flow.test.tsx` (Zeon after the title offers the rematch);
  `rankings-profile.test.tsx` (Tower tab).

## Phase E3 — sprite-edge scan, neighbour skirt + prefetch, handover-hitch, harness programs (2026-10-06)

### Sprite-edge scan (audit M2-sprite-edge-5)

The `sprite-edge` shot of `harness:shots` now ends with the §50.1 #6 edge scan. Pixels are read only in the Node runner, never in the client runtime.

**Page side** (`src/harness/stage.ts` `stageEdgeScan`):
- Places the player at the shot-3 anchor at noon and calls `stage.inspect` on the shot's wild creature.
- Narrows the camera's vertical FOV until one level-0 texel covers 1.35 screen px. The camera distance and the sampler are left alone. For reference, the stock 4 m inspector gives 0.38× on mossling's 1024² frame at 900 px.
- Hides the zone root (the probe's `opaque` switch) and the player's figure (`isolateInspector`), so the inspected billboard is the only DOF-sharp object left.
- Draws the scene pass's `mask.y` (pre-TRAA).

**Runner side** (`scripts/harness/shots.ts`):
- Captures `<stem>-edgemask.png`.
- `src/harness/edgeScan.ts` `scanSpriteEdges` (pure) samples 200 straight-edge pixels evenly. Each sample's 3×3 neighbourhood, and every pixel of the billboard's rect, must hold no value strictly between 0 and 255.
- Then captures the same frame's `output` MRT (`<stem>-output.png`) and records `edgeScan` in the sidecar (magnification, stock magnification, FOV, distance, counts, checks). A failed check fails the run.

The mask proves the absence of intermediate alpha because blending applies to every colour attachment: an alpha-blended or alpha-to-coverage sprite would leave intermediate values in `mask.y` along its edge.

Result (`.screenshots/audit/M2-E3/mire_route/sprite-edge--80.94_5.3-{edgemask,output}.png` and `.json`): mossling at ×1.349 (stock ×0.384; FOV 28° → 8.11°). 200 / 200 sampled straight-edge pixels (of 6 412 straight, 6 867 edge) show 0 intermediate values, and the rect holds 0 → **PASS**. A first run without the isolation also passed, but its samples included fence and grass occluder edges; that is why the zone root and the player are now hidden. The magnified frame (1 382 px quad) is taller than the 900 px viewport, so the creature's feet are outside the capture. The scan needs edges, not the whole silhouette.

Test: `test/harness-edge-scan.test.ts` (4) uses synthetic silhouettes. A nearest-magnified alpha-tested silhouette passes; a blended edge fails; a sprite too small to give 200 straight-edge pixels fails.

### Harness programs (render Part 6 Open 1 / audit M2-gym-dusk-8)

`drawMask` and `drawOutput` now sample `scenePass.getTexture(…)` as plain textures, so they show the last full frame without re-rendering the scene pass.

The old path rendered the scene without TRAA at another render-call depth, which built a second program for every visible material: +31, alive for the rest of the run. Shots run on mirevale, programs per shot (full / reduced / mask): 109 / 144 / 144 / 144 before, 109 / 113 / 113 / 113 after. The render notes, Phase E3, give the breakdown.

`__ewaHarness.programNames()` was added as a diagnostic.

### Neighbour skirt and prefetch

**Skirt.** `scene/zoneSpecFor.ts` gains `neighbourSpecsFor(zone)` and `withNeighbours(spec, zone)`; render's `ZoneSpec.neighbours` is described in render IMPLEMENTATION-NOTES Phase E3. The SceneDirector builds every zone `withNeighbours`. `zoneSpecFor` and its snapshot are unchanged.

**Handover keep.** Before the old zone's dispose, the SceneDirector calls `renderer.prepareHandover(spec)` whenever a zone is loaded.

**Prefetch** (`scene/prefetch.ts`, the second half of §20.10.3 phase 5):
- `neighbourPrefetchPlan` (pure) lists the linked zones' surfaces that the current zone does not bind, plus every file of their unbound atlases (mips included).
- `runPrefetch` fetches them into the HTTP cache: materials first, through `renderer.materials.prefetch`, then atlases. Fetches run one at a time, paced to ≤ 2 MiB/s, and a token cancels the run.
- World3D starts it after the hero tier and after every handover's first frame. Dev builds log the bytes.

Not measured in a browser: the harness page server sends `cache-control: no-store`, so the prefetch cannot help there. The handover spec's "preloaded" case therefore makes the next zone's field sets and atlases resident instead.

Test: `test/neighbour-prefetch.test.ts` (4).

### handover-hitch.spec.ts (§50.4.7)

The spec builds and serves the harness page itself (`buildHarness` + `serveBuild` on a free port) and opens `/harness/shots?zone=mirevale&bg=1`. With `bg=1` the background compile is on, as in the client; the harness otherwise compiles zones fully.

It calls `__ewaHarness.handover('mire_route', { preload })` (`HarnessWorld.handover`). The player stands 6 m inside the east edge; `director.loadZone(to, …, arrival)` runs with the arrival 8 m inside mire_route's west edge. A requestAnimationFrame loop ticks the world throughout and records every frame gap until 120 frames after the first destination frame.

The SPEC thresholds (≤ 250 ms preloaded and no frame over 33 ms; ≤ 1 500 ms cold) are asserted only with `EWA_REFERENCE_GPU=1`. On this machine the numbers are attached and annotated.

Measured here: `npx playwright test packages/client/test/handover-hitch.spec.ts --trace off`, 2 passed (4.5 min) on the Intel Gen-12 iGPU:

| | first destination frame (SPEC) | `director.loadZone` | frame gaps (max / p95) | frames > 33 ms | programs after |
|---|---|---|---|---|---|
| preloaded | **14 472 ms** (≤ 250) | 14 437 ms | 2 379 / 299 ms | 196 of 201 | 123 |
| not preloaded | **17 908 ms** (≤ 1 500) | 17 526 ms | 3 369 / 426 ms | 205 of 211 | 113 |

Preloading saves about 3.4 s, but the crossing stays far from the SPEC on this machine. Almost all of the time is mire_route's phase-1 compile: the zone's light set is part of every lit program, so a zone with a different light count recompiles every lit structure. The frame gaps come from three's synchronous node builds and the zone build. The harness also renders an empty scene between the old zone's dispose and the new one's phase 1 (no fade element; World3D shows its "Travelling to …" overlay there).

What would close the gap: a fixed light-slot layout shared by all zones, so that every zone's lit programs are identical and a handover compiles nothing; or two zone roots during a handover. Both are architectural changes outside this phase. A first run hit a Playwright trace-artifact `ENOENT` (`out/playwright` was being cleaned by a parallel run); `--trace off --output <dir>` avoids that.

## Phase E6 — GPU device lost (2026-10-06)

`scene/deviceRecovery.ts` `DeviceRecovery` holds the order and the retry policy; World3D supplies the hooks. Every renderer World3D creates passes `onDeviceLost: (info) => void this.recovery.onLost(info)`.

**On a loss:**
1. **Overlay.** The overlay goes up: "Restoring the renderer (the graphics device was reset)".
2. **Teardown** (`teardownRenderer`):
   - runs the renderer-bound subscriptions (`rendererOffs`: the settings → renderer push, the ResizeObserver, the battle-panel inset, render scale) and clears the step collider;
   - clears the spawn, legendary and raid views and the bound-atlas set;
   - unloads the zone and disposes the renderer, both guarded because a dead device may throw.
3. **Rebuild.** `bootRenderer(null, false)` creates the new renderer and everything bound to it: SceneDirector, HUD binding, fonts, size observer, settings push, client creature group and sprite views. The catalog that was already read is reused.
4. **Reload.** `detachRoom()` + `attachRoom(room)` re-create remotes, spawns and statics from the live schema. Then `enterZone(room, zoneId, 'Restoring <zone>')` loads the current zone at the server's current pose, with the overlay up until its first frame. An open battle is re-dressed by `battle.attach` at the end of `enterZone`.

**What is never touched:** the WorldSession (socket, room, stores), the battle controller, input, audio and React (GameCanvas stays mounted; `worldHost` is not involved).

**Retries.** A rebuild that throws is retried 3 times, 1 s apart. After that, or after more than 3 losses within 60 s, the overlay shows "The graphics device keeps resetting. Reload the page to continue." A loss during a recovery makes it start over once.

`boot()` is now overlay labels + `bootRenderer(manifest, true)` + audio + ready. Its behaviour is unchanged; only the renderer part moved.

**Test.** `test/device-lost.test.ts` (6) wires a fake device through render's `watchDeviceLost` into `DeviceRecovery` with a fake world. It checks:
- the order: overlay → teardown → new renderer → `loadZone` at the current server position;
- the overlay is up during the rebuild;
- the session is untouched;
- retries, then giving up;
- folding in a second loss, and stopping when the world is disposed;
- the loss-rate limit.

**Not verified live:** the full client + server path. A real device loss can only be forced with `chrome://gpucrash`.

## Phase E5 — the §50.4.7 test files (2026-10-06)

- `test/no-getimagedata.test.ts` (vitest, 7 tests). Static scan of `client/src` and `render/src`, comments stripped:
  - no `getImageData` anywhere;
  - `putImageData` / `createImageData` / `new ImageData` only in the allow-listed `world/minimapDraw.ts`, which paints
    the minimap base from the heightfield (no sprite import);
  - `getContext('2d')` only in the HUD layer and the minimap;
  - no sprite / atlas module draws to a 2D context or reads an RGBA-stride element. Writes from constants are allowed:
    the 4×4 neutral placeholder and the quad tangent attribute.
  - At runtime, a `BillboardPool` with a fake decoder: every variant / alpha combination shares one material and one
    texture, and the 4 palette values (`hueShift`, `satMul`, `lightMul`, `alphaGlow`) are per-object scalars equal
    to `VARIANT_UNIFORMS`.
- Playwright: the root config gains the additive `client-e2e` project; the `chrome` project ignores those specs.
  `playwright.e2e.config.ts` runs the same project without the fuzz `webServer`, whose fixed port 4179 another run may
  hold. The `client-e2e` Chrome flags:
  - WebGPU;
  - no background throttling — two pages run at once;
  - a 1280×800 viewport.
- `test/e2e/stack.ts` boots a real server and client, on free ports and never the shared ones:
  - server: `src/main.ts` through tsx, PGlite in a fresh temp `DATA_DIR`, `WORLD_WEATHER=off`, `SERVER_SEED=e2e`;
  - client: the in-process Vite dev server, HMR and the watcher off; or, for `first-frame`, `vite build` served
    statically with an `/api` proxy and `public/` served in place;
  - `stop()` kills the server's process tree and removes the temp dir.
- `test/e2e/game.ts`: register through the form, `__ewaWorld.debug()` polling, `walkTo`, `/me` over an independent REST
  login (never the page's token family), and an A* `planPath` / `walkPath` over the zone's content walkable field.
  `walkTo` is a straight-line autopilot, and the plaza blocks the straight line from the spawn to Wynn.
- `slice-e2e.spec.ts`:
  - two contexts register through the form;
  - each sees the other as a spawned remote;
  - a chat line reaches B once;
  - A's beat with `mirevale.wynn` writes `met_wynn`, checked over REST;
  - A enters the gym hall by its door warp, and Gardener Fen's battle reaches move selection, with the server's
    `inBattle` set.
  The trade, PvP and `verdant_gym` clear in the §50.4.7 row are not driven yet (spec row annotated).
- `no-dom-in-frame.spec.ts`: 0 mutations in 10 s of idle overworld play. While walking and chatting, mutations come only
  from the chat input and the notification host. Setup before the windows:
  - wait for the arrival toasts to expire and the background-compile pill (`WorldBoot`, a loading surface, ~15
    updates/s while it runs) to disappear;
  - skip the tutorial card, which advances on events.
- `first-frame.spec.ts`: a cold `/play` on the production build at 50 Mbit/s with the cache disabled.
  - Byte budgets before the mark (measured: field materials 4.46 MB, sprites + GLB 1.19 MB).
  - Hero tier and audio held unanswered until the mark, which still lands.
  - The 2.5 s limit is asserted only with `EWA_REFERENCE_GPU=1`; on the dev iGPU the mark lands at ≈ 46–48 s
    (synchronous shader warm-up, a HANDOFF open issue), annotated.
- `dof-mask.spec.ts` and the `test/dof-mask/` page (offline HarnessWorld on `mire_route`). The scene pass's `mask` MRT is
  read back exactly with `readRenderTargetPixelsAsync` (HalfFloat; rows padded to 256 bytes, except the last), with
  the reads awaited one by one because three resolves the copy later.
  - Silhouette per subject: forced-bit 1 / 0 re-renders at the tick frame's own TRAA jitter index (`_jitterIndex`
    pinned, then restored), eroded 1 px.
  - Frames: 300 overworld frames on the player's figure, 300 battle frames on both battlers.
  - Without the pinned jitter, 1–7 px per frame differed; those were jitter artefacts, not mask defects.
- **No client defects found.**

---

# Creature textures — residency, side binding, budget guard (2026-10-06; render IMPLEMENTATION-NOTES Part 9)

The flipbooks (Part 7) made a known hole expensive: the client bound a species' static atlas AND both flipbook sides
the first time it saw it, and never released a creature atlas. A flipbook side costs 50–75 MB of GPU memory (88–132 MB
as three counted it), so every legendary met or carried stayed bound for the session. Now every creature atlas has an
owner that releases it.

| File | What |
|---|---|
| `scene/creatureTextures.ts` (new) | `CreatureTextures` (holds / leases, refcounts, grace + idle LRU, budget guard), `BattleSprites` (the stage's slots), `sideFor` / `stageSide`, `creatureBudget`, `CREATURE_TEXTURES` |
| `scene/spriteCatalog.ts` | `sideAtlases(species, side)` → `{ atlas, anim }` of ONE side; `speciesAtlases` / `bindCatalogAtlas` stay for the harness's legacy replay only |
| `scene/SpawnViews.ts`, `RaidViews.ts`, `EvolutionDirector.ts` | the `ensureSpecies` dep is gone: `leaseSprites(species, side)` per view, released when the view goes (despawn, den cleared, sequence done) |
| `scene/LegendaryViews.ts` | a static leases its front's still part while it stands and its front flipbook only while the player is within 40 m (let go past 52 m): `setViewer(x, z)`, `setFlipbook` on the card |
| `scene/World3D.ts` | the zone hold (phase 3), the statics' near-arrival flipbook preload, `BattleSprites` on battleStart / resync / `setBattler` / exit, evolution leases + prompt prefetch, `setViewer` at the 2 Hz nameplate cadence, `refresh()` at 1 Hz, `debug().textures`; `bound` / `ensureSpecies` removed |
| `harness/HarnessWorld.ts`, `harness/main.tsx` | the same wiring; `?residency=legacy` replays the old binding for before / after runs; `loadZone`, `flags`, `party`, `legendaries`, `scriptBattle(mine, foe, level)`, `textureReadout()`; `evolutionPairs(n)` |
| `scripts/harness/textures.ts` (new, `pnpm harness:textures`) | the (a)–(d) runs below over CDP; `common.ts`: Chrome picks its own debugging port (see "Harness port race") and `openSession({ query })` |
| `test/creatureTextures.test.ts` (new) | 17 tests (below) |

## Design

**C1 — one side, one owner.** `CreatureTextures.show(species, side)` holds the side's static atlas and, for an animated
species, that side's flipbook — never the other side's. `sideFor(context)`: overworld spawns, legendary statics, the
raid den, remote players' creatures, the evolution and inspector close-ups and battle foes show the front; the
player's battlers the back. `stageSide(stageSlot)` maps render's stage side 0 (the near, viewer's slot — singles and
doubles) to the back, side 1 to the front (render `battleStage.setBattler`). A lease is taken before the billboard is
acquired, so the bind is already in flight when the card resolves its side; the card shows the static frame until the
flipbook lands and re-points once (render Part 8 F2) — no new pop. `show(…, 'still' | 'flipbook')` takes either part.

**C2 — refcounts.** One entry per atlas id; any number of holds on one side bind it once. Holds: every spawn / static /
den / evolution sequence (both forms' fronts) / battle slot (`BattleSprites.set` on `setBattler`, released on a switch
and at `exitBattle`), the battle's teams (`BattleSprites.begin`: both parties' static atlases, so a switch-in never
waits), the zone (its static set + the party's static atlases, §20.10.3 phase 3, for the zone's life). A hold that
replaces another (zone → zone, battle resync) takes the new refs first, then releases the old hold, then binds: an atlas
both zones show never idles; one only the old zone showed idles before anything new binds (and the guard may release
it for the new zone). Party flipbooks are no longer preloaded with the zone: a battle leases the back side it shows.

**C3 — grace and idle LRU.** When the last hold goes an entry idles: it stays bound `graceMs` = 20 s (re-showing the
same creature costs no upload), while at most `idleAnim` = 2 flipbooks and `idleStatic` = 4 static atlases idle (least
recently used released first); a timer at the earliest expiry releases the rest to render (`releaseAtlas`). An idle
entry a billboard still samples (`BillboardPool.atlasUsers` > 0) is never released; it is looked at again a second
later. `prefetch(species, side)` = bind and idle at once (the evolve prompt's preload).

**C4 — legendary statics play near the player only.** galvan_route's statics stand 222 m apart and the diorama camera's
ground footprint ends ≈ 24 m from the player (34 m, −52°, 28° FOV at the widest zoom stop): a far static is never on
screen. `LegendaryViews.setViewer` (World3D: the arrival point before the zone builds, then the 2 Hz nameplate pass)
leases a static's front flipbook within 40 m and lets it go past 52 m (`CreatureBillboard.setFlipbook(false)` first, so
render frees it). The zone's phase-3 preload binds the flipbooks of the statics near the arrival point only.

**C5 — budget guard.** Bound creature textures (GPU bytes, render's per-set estimate — what the corrected metric counts,
render Part 9 R1) stay under `creatureBudget(textureBytes, creatureBytes)` = the §50.2.2 cap (734 003 200 B) − every
other texture byte the renderer holds now (`RenderStats.textureBytes` − the sprite pool's own bytes) − 16 MiB headroom,
clamped to [128, 400] MiB (live: render targets grow with the drawing buffer, zone materials differ per zone). Before
a bind that would pass it, idle entries are released — flipbooks first, then static atlases, least recently used first,
never one a hold shows or a billboard samples. A flipbook that still does not fit is not bound: the card keeps its
static frame (render waits on the id) and the flipbook is retried whenever bytes are freed and on `refresh()` (World3D
1 Hz). A static atlas always binds (a creature is always drawn); an overrun is reported once per atlas.

**C6 — the battle's team hold is a reserve hold (2026-10-12).** A 3v3 of legendaries with Majin / Tenjin forms holds nine
32 MiB static sheets for the battle (front and back share a sheet, two species a sheet; the forms add their own), so
288 of the 400 MiB fit the two leads' flipbooks and nothing more: every switch-in of an animated creature was refused
(the old billboard still samples the outgoing flipbook at the moment the new one binds, then 337 + 64 MiB did not fit)
and stood on its static frame for the rest of the battle — "after a switch the battle breaks". `BattleSprites.begin`
now holds the teams with `hold(…, { reserve: true })`: a flipbook a view shows (`show`, held beyond reserve holds) that
still does not fit once the idle entries went releases static atlases ONLY reserve holds want (least recently used,
never one a billboard samples) and marks them `parked`; parked atlases rebind on `refresh()` / any release, where they
fit (idle entries make room; `bind(e, fitOnly)` never passes the budget for them). A benched creature whose sheet was
parked binds it when it is sent in (its slot's `show` is a full hold — the static-always-binds rule). A reserve-held
flipbook never displaces anything. Live (the isolated dev pair, two accounts, Arena Standard, zenryu / galaxion /
hollowmane vs voltaura / castlemaw / gemknight at L60, both bands): before, `anim-galaxion-back waits (static frame)`
on both clients for the rest of the battle; after, a 15-turn battle with six switches, two Majin transforms and every
signature cinematic shows each animated battler's flipbook within a second of its switch-in, no refusal.
`test/creatureTextures.test.ts` (+2).


## Measured (`pnpm harness:textures`, headless Chrome 154 over CDP, WebGPU, Intel UHD (i7-13620H), 1440 × 900, pr 1)

Both columns drive the same harness page (`HarnessWorld`: SceneDirector, SpawnViews, LegendaryViews, BattleController,
EvolutionDirector) on the rebuilt true-colour static atlases (manifest sha1 `8d89a623…`; the flipbooks are unchanged);
"before" is `?residency=legacy` (the binding this replaces: every atlas of a species, both flipbook sides, never
released), "after" the residency. Each cell: **raw** (three's `texturesSize` + the KTX2 bytes — the §50.2.2 metric as
measured until now) / **corrected** (render Part 9 R1: minus the level 0 three counts twice for creature atlases) in
MB, then the sprite pool's GPU bytes (atlases bound). Cap: 734.0 MB. "+ grace" = 25 s after leaving (the grace is 20 s).
Results: `.screenshots/textures/{legacy,managed}.{json,log}` (gitignored).

| Step | before: raw / corrected | sprites | after: raw / corrected | sprites |
|---|---|---|---|---|
| (a) Mirevale idle | 495.2 / 444.9 | 66.8 (2) | 495.2 / 444.9 | 66.8 (2) |
| (b) battle zenryu (back) vs raikitsune (front), Mirevale | **965.0** / 713.3 | 334.2 (8) | 789.2 / **613.1** | 234.0 (6) |
| (b) right after the battle | 965.0 / 713.3 | 334.2 (8) | 789.2 / 613.1 (all four idle) | 234.0 (6) |
| (b) + grace | 965.0 / 713.3 | 334.2 (8) | 496.3 / **445.9** | 66.8 (2) |
| (c) galvan_route, both statics standing, at its spawn | **1471.3** / 990.0 | 639.2 (16) | 878.1 / **651.6** | 300.8 (9) |
| (c) at raikitsune | 1471.3 / 990.0 | 639.2 (16) | 966.0 / **701.7** | 350.9 (10) |
| (c) at voltaura | 1471.3 / 990.0 | 639.2 (16) | 969.6 / **703.8** | 353.0 (10) |
| (c) back in Mirevale | **1498.6** / 1017.3 | 639.2 (16) | 495.2 / **444.9** | 66.8 (2) |
| (c) + grace | 1498.6 / 1017.3 | 639.2 (16) | 495.2 / 444.9 | 66.8 (2) |
| (d) 10 × (evolution + legendary battle): peak | **3938.4** / 2409.6 | 2030.5 (49) | 969.6 / **707.1** | 328.0 (8) |
| (d) after the 10th | 3938.4 / 2409.6 | 2030.5 (49) | 833.2 / 638.1 | 259.0 (6) |
| (d) + grace | **3938.4** / 2409.6 | 2030.5 (49) | 496.3 / **445.9** | 66.8 (2) |

- **Under the cap.** After: every step ≤ 707.1 MB corrected (the residency's budget read 338.1 MB in Mirevale, 366.5 MB
  in galvan_route: `creatureBudget` = 734.0 − the other textures − 16.8). Before: 27 of 32 steps over the cap by the
  corrected count, 30 of 32 by the raw one. By the raw count (if the correction is not approved) the after column is
  still over the cap in 25 of 32 steps (a legendary battle 789 MB, galvan_route 878–970 MB): the bytes it counts
  1.75 × are the same GPU bytes; the residency would then need a budget ≈ 1.75 × smaller (≈ 190 MB in Mirevale — one
  flipbook per battle at most, none in galvan_route).
- **Back to the baseline.** Leaving a battle, galvan_route or 10 evolution + battle cycles returns to the boot reading
  444.9 MB (+ 1.0 MB after the first battle in both columns: the stage's pooled battle textures, created once — not
  creature atlases); before, nothing ever came back (2030 MB of creature atlases after (d)).
- **Side binding.** In battle 2 flipbooks instead of 4 (`anim-zenryu-back`, `anim-raikitsune-front`); in galvan_route
  no flipbook at the spawn (both statics > 40 m away), one at a time beside a static (raikitsune's, then voltaura's
  while raikitsune's left — 222 m apart); never a flipbook refused (`waits 0` at every step: the near static fits).
- **The split of the 700 MiB cap** (corrected metric, this machine at 1440 × 900): render targets + zone materials +
  characters / HUD / VFX = 378.1 MB in Mirevale, 350.8 MB in galvan_route; 16.8 MB headroom; creatures get the rest —
  339.2 MB / 366.5 MB. galvan_route's static set + the party's atlas alone is 300.8 MB of it.
- Grace in action: right after the battle the four battle atlases idle (`idle a-024 a-023 anim-zenryu-back
  anim-raikitsune-front`), 25 s later they are gone. In (d) the idle LRU (≤ 2 flipbooks + 4 statics) carries one battle's
  atlases into the next evolution (the 707.1 MB peak = 2 zone + 2 evolution + 2 idle statics + 2 idle flipbooks), always
  inside the budget.
- An earlier pair of runs on the previous (palette) static atlases read the same numbers to 0.1 MB (same atlas sizes).

## Tests

`test/creatureTextures.test.ts` (17): the side per context and `stageSide`; a lease binds the shown side's static atlas
and flipbook, never the other side's flipbook; `BattleSprites` (near slot back, far slot front, doubles, a re-set of
the same battler leases nothing new, a switch moves the hold, `end` releases everything); the same side shown twice
binds once, the last release idles it and the grace period releases it once; re-showing within the grace costs no
upload; 100 show / hide cycles of spawns, statics, battles (switches included), evolutions and zone holds leave nothing
bound and release every bind exactly once; the idle LRU per kind (oldest first); a replacing hold never idles a shared
atlas; `ready` / `onSettled`; a failed bind holds no bytes and is never released to render; the guard releases idle
flipbooks first (LRU), then idle static atlases, never a held one or one a billboard samples; a flipbook that does not
fit waits (not bound) and binds once room frees up; a static atlas always binds (reported once); a 1-byte budget never
releases a held texture; the views (spawn, raid den, statics with the near / far flipbook and its hysteresis) lease the
side they show and release it; end to end on render's `BillboardPool` (fake decoder): still frame then the side's
flipbook, 100 cycles leave no atlas on the pool (≤ 28 binds thanks to the idle cache); an atlas a billboard still
samples outlives its release until the billboard goes. Updated: `evolution.test.tsx` (both forms' fronts leased before
the sequence, released after it), `legendary-statics.test.ts` / `raid.test.tsx` (the dep), `spriteCatalog.test.ts`
(`sideAtlases`). Render: `test/residency.test.ts` (render Part 9). Client total: 41 files, 321 tests; render 29 files,
264 tests (`pnpm exec vitest run packages/render packages/client`: 70 files, 585 tests, green).

## Harness port race (found while measuring; fixed)

`launchChrome` probed a "free" debugging port (from 9470) and then let Chrome bind it. Another session's
`harness:budget` (main checkout) launched its Chrome on 9470 in the same second: this run's Chrome lost the bind, the
`/json/list` poll reached the OTHER Chrome, and this run navigated that session's page to its own harness URL (its
forgewall M3 budget run, 09:19–09:28 UTC). The run was stopped as soon as it was noticed; the other session's budget
numbers from that window may be affected and are worth re-running. Fix: Chrome picks its own port
(`--remote-debugging-port=0`, read back from `DevToolsActivePort` in the run's unique profile) and only its own
`about:blank` target is taken; a Chrome that fails to start throws instead of borrowing a neighbour. The page server's
`freePort` probe stays (a lost race there is a bind error, never a wrong connection). The main checkout's copy of
`common.ts` still has the race.

## Open

1. **The metric change (render Part 9 R1) needs approval** — entry E1. Without it, three's count reads every creature
   byte 1.75 ×: the after-column's raw readings show where that leaves each step.
2. **8-atlas zones and higher resolutions.** galvan_route's static set alone is 268 MB of GPU memory; at 1440 × 900
   the creature share there is ≈ 366 MB, so one static flipbook plays at a time (the near one — by design they are
   222 m apart). At the §50.2 reference 2560 × 1440 the render targets grow (≈ 2.8 × the pixels) and the creature
   share shrinks with them: the guard keeps flipbooks inside it, but the non-creature part alone may crowd the 700 MB
   cap (§50.2.2's own R5 note). Not measured at 2560 × 1440 here.
3. The zone hold takes the party's static atlases at zone load; a creature caught or traded mid-zone binds per battle /
   evolution / view until the next zone load.
4. Not wired because the client does not use them yet: `stage.inspect` (lease `sideFor('inspect')` around it) and remote
   players' creatures (`sideFor('remote')`).
5. World3D's wiring was exercised through the harness (same views, controller, evolution director, residency) and by
   typecheck / review, not against a live server in this pass.

## SPEC CHANGELOG entries (§50.7 form; applied by the integrating session, 2026-10-06)

The render-side entries (the §50.2.2 metric correction, the `BillboardPool` / `CreatureBillboard` additions) are in
render IMPLEMENTATION-NOTES Part 9.

```
## 2026-10-06 — `20-client.md` §20.4.4 (new paragraph "Creature texture residency"), `50-verification-budget.md` §50.2.2 (the creature share of the texture cap) — every creature atlas has an owner that releases it; a view binds the ONE side it shows; 20 s grace, 2 flipbooks + 4 static atlases idle at most; a live creature budget = the cap − every other texture byte − 16 MiB
Why: the client bound a species' static atlas and BOTH flipbook sides the first time it saw it and never released a creature atlas; with the animated legendaries every legendary met or carried kept 100–150 MB of GPU memory for the session (measured: a Mirevale battle zenryu vs raikitsune 965 MB as three counted it, 10 legendary battles + 10 evolutions 3.9 GB, nothing returned on leaving). Sides: overworld spawns, legendary statics, the raid den, remote players' creatures, the evolution and inspector close-ups and battle foes show the front, the player's battlers the back; a legendary static plays its flipbook within 40 m of the player only (let go past 52 m; the diorama camera shows ≈ 24 m). Budget guard: idle flipbooks are released first, then idle static atlases, least recently used first, never one a view shows or a billboard samples; a flipbook that does not fit keeps the card on its static frame until room frees up; a static atlas always binds.
Evidence: client IMPLEMENTATION-NOTES "Creature textures" (harness before / after table, `pnpm harness:textures`); `packages/client/test/creatureTextures.test.ts` (17: refcounts, 100 show / hide cycles, side per context, grace, LRU, the guard, the views, end to end on render's pool); render `test/residency.test.ts`.
Affects: `packages/client/src/scene/{creatureTextures,SpawnViews,LegendaryViews,RaidViews,EvolutionDirector,World3D,spriteCatalog}.ts`, `src/harness/*`, `scripts/harness/{textures,common}.ts`; needs render's corrected metric (render Part 9 entry) for the budget to be in the cap's unit.

## 2026-10-06 — `20-client.md` §20.10.3 — phase 3 binds the zone's static set, the party's STATIC atlases and the FRONT flipbooks of the legendary statics standing within 40 m of the arrival point (supersedes today's earlier entry "phase 3 also loads the flipbooks of the zone's legendary statics and of animated party members")
Why: a party flipbook only ever shows its back, in battle (bound by the battle when it shows it); a static shows its front, and only near the player. Binding both sides of all of them at zone load was the bulk of the leak above.
Evidence: client IMPLEMENTATION-NOTES "Creature textures" (galvan_route loaded with both statics standing: 1471 → 878 MB raw, 990 → 652 MB corrected).
Affects: `packages/client/src/scene/World3D.ts` (`bindZoneAtlases`), `harness/HarnessWorld.ts`; galvan_route's phase-3 payload drops by the flipbooks of statics away from the arrival point (≈ 4.7 MB → 0–2.4 MB); Mirevale unchanged.
```

## Town arrival point (2026-10-06)

- The harness `spawn-noon` anchor (`src/harness/anchors.ts` `tableAnchor`) stands on content `arrivalPoint(zone)`:
  unchanged where it is the spawn (Mirevale `(0, 6)` with rule `ZoneDef.spawn`, so the committed M2 Mirevale shots stay
  valid; every route and story zone), and in the eight other towns their plaza-ring point (rule
  `arrivalPoint (plaza ring <deg>°, …)`, `base.name` `arrival`): `stormrook` / `marrowdig` `(0, 11)`, the other six
  `(5.5, 9.5)`. Shot headings are unchanged. The other fallbacks that read the spawn (`lamps-night` without a shop,
  the staged creature of `sprite-edge` / `battle` without a table) still do — they are outside this change.
- The committed M3 `spawn-noon` sidecars / PNGs of those eight towns (`spawn-noon--50_0*`, saltmourn `--50_-6*`) are
  stale until `pnpm --filter @ewa/client harness:shots -- --set M3 --zone <town>` re-runs (not re-shot here).
- Not touched: `HarnessWorld` still boots / loads a zone at `zone.spawn` before placing the player at the anchor, and
  the live `SceneDirector` load focus falls back to `zone.spawn` only without a focus; the server puts a fast-travel
  arrival on the arrival point and the client follows the authoritative pose.
- Test: `test/harness-anchors.test.ts` ("spawn-noon stands on the arrival point …").

## Handover prepare (2026-10-06)

Render's fixed light layout makes a compile done in one zone valid for the next. The render notes, "Handover: fixed
light layout", give the design and the numbers.

- **`SceneDirector.prepareZone(id, harvest, focus)`** passes `withNeighbours(zoneSpecFor(…))` to
  `renderer.prepareZone`. The crossing's `loadZone(id, …)` then adopts the prepared zone (same id, seed and harvest
  level).
- **World3D `prepareNearEdge`**, every 30 fixed steps, outside battles:
  - within 48 m of a link's edge point, it prepares that linked zone at the arrival 8 m inside its opposite edge;
  - one zone at a time; a zone change forgets it;
  - the build costs one long frame (about 1 s on the dev iGPU) while walking toward the edge, instead of the whole
    crossing.
- **Harness**: `handover(to, { preload: true })` also prepares, and `HandoverResult` gains `prepare` (ms, frame gaps),
  `programsBefore` and `programsSettled`.
- **Spec run options**: `EWA_HARNESS_BUILD_DIR` (common.ts) lets a second session build and serve its own bundle, and
  `EWA_HARNESS_NO_BUILD=1` makes `handover-hitch.spec.ts` serve it as is (A/B of two bundles).
- **Measured** (`handover-hitch.spec.ts`, dev iGPU): first destination frame preloaded 6.4–8.9 s → 68–196 ms; not
  preloaded 7.7–8.6 s → 3.7–4.7 s. `first-frame.spec.ts`: 34–64 s → 25–26 s.

## M3 review: framing, battle, harness (2026-10-06/07)

- **Headings (R-all-2 / M3-all-11, blocker; SPEC §50.6.1 amended 2026-10-06).** `src/harness/shotTable.ts` holds rig
  indices: spawn-noon 0 (the in-game arrival view), gym-dusk `faceSubject` (anchors `rigFacing`: the rig whose view is
  nearest anchor → door; 0 at Mirevale; the no-gym fallback faces its set-piece), sprite-edge 3, lamps-night 1,
  battle (the battle camera; walk-in at rig 3), link-east 3 (fallback edges: w 1, n 0, s 2). The 'words' convention,
  `setHeadingConvention` / `rigHeading`, `?headings=` and the runner's `--headings` / `headings-rig/` are gone; sidecars
  record `anchor.heading.convention: "rig"`. The non-spawn digits reproduce the committed frames (old words 1 → rig 3,
  3 → rig 1); every `spawn-noon` frame changes (180°) and must be re-shot with `harness:shots -- --set M3`.
- **Trainers beside their creatures (R-all-1, blocker).** SceneDirector `trainerPose(bf, side, out)` (render
  `trainerSlot`, facing the ring centre) replaces `TRAINER_BACK_M`; World3D / HarnessWorld place the avatar with it and
  `FoeActor.stage(x, z, angle)` takes the far slot. In a hall the battle frame is the stage's fitted ring centre
  (`fitCentre`), so the trainers stand around the ring the stage actually dressed.
- **Battle log (R-all-3).** `battle/timeline.ts` `abilityText(who, ability, detail)`: core `abilityTrigger.detail` hook
  ids (`endOfTurn`, `onContact`, `onStatLowered`, `onSwitchIn/Out`, `statusImmunity`, `typeImmunity`, `wonderGuard`,
  the raid's `enraged`, `<stat> cannot be lowered`) become sentences ("The wild Scalewisp’s Speed Boost activated!");
  an unknown camelCase id reads "activated!", never the id. Test: `timeline.test.ts` (the review's check
  `/— [a-z]+[A-Z]/` over every detail the core emits).

## Battle forms: the rage form on stage (2026-10-08)

- `formChange` → timeline: after the crossing hit's hp drain, a red flash, `form_rage` VFX, `raid_roar` sfx and a shake
  (not in reduced effects); at +40 % of `FORM_MS` (1 100 ms) a `form` keyframe; then "<Name>’s mask cracks — it flies into
  a rage!" (`FORM_VFX` / `FORM_TEXT` per form id; an unknown form gets the switch-in burst and a plain line). `form` is a
  state-bearing frame (`finishNow` applies it).
- `BattleView.setBattler(ref, c, key, spriteId?)`: a form shows the manifest entry `<species>_<form>`
  (`spriteCatalog.descriptor(..., spriteId)` keeps the species' types and size). `showBattler` reads the battler's
  `form` from the state it shows, so a resync, a reload or a re-entry shows the rage sprite; `onBattleStart` shows the
  field as it stood before the createBattle events' form changes (`beforeFormChanges`), so a lead already below half
  appears plain and swaps on its frame. `battleSpriteIds` adds `hollowmane_rage` to the battle's atlas hold whenever a
  hollowmane is in a party, so the swap never waits for an atlas.
- The 40-event timing snapshot is unchanged (its fixture leaves `formChange` out; the kind has its own test).

## Battle forms: the signature move in the menu (2026-10-08)

- `BattleMenu` shows `formMoveId(...)`'s MoveDef in the replaced slot (hollowmane in Rage Form: Hollow Crescent where
  Night Slash was) and still submits the slot's id; the server executes the signature. `MOVE_ANIMS['Hollow Crescent']`:
  a long windup, a lunge, the `form_rage` burst on the target, the impact camera. Test: `test/battle-forms.test.tsx`.

## Signature move cinematics (2026-10-08)

- **What.** A battle form's signature move (`BattleFormDef.signatureMove`) plays a DOM overlay over the arena:
  letterbox bars and a dim, a cut-in band (the form's portrait, an eye glint, the move's name), then the move's own
  SVG/CSS effect aimed from the attacker to the target: Hollow Crescent (a black crescent with a crimson edge, charged
  in a crimson aura, a hairline cut and a crescent wound) and Vendetta Volley (both cannons charge while a crosshair
  locks on, eight alternating tracers with muzzle flashes and shell casings, a fireball and a skull mark, embers). The
  3D stage plays the move underneath as before (poses, the `form_rage` burst, the hit, hitstop, the camera shake).
- **Data.** `battle/signatures.ts` `SIGNATURE_CINEMATICS` (move id → fx, portrait, name lines, kicker, glint, lead /
  windup / travel / total ms, cut-in sfx); `MOVE_ANIMS` takes a signature move's windup / travel from it (camera
  `wide`, so both battlers stay framed). Portraits: `public/signature/<species>_<form>.webp`, 256 px lossless,
  the source's full canvas, from `pnpm --filter @ewa/sprite-pipeline portraits <ids…>` (`tools/sprite-pipeline/src/portraits.ts`,
  stage 1's `recoverAlpha`). `signatures.test.tsx` fails when a content signature move has no cinematic or portrait.
- **Timeline (deviation from §20.5.1: a 19th keyframe kind).** `moveUsed` of a signature move pushes
  `cinematic { phase: 'start' }`, a `wide` camera cue and the cut-in sfx, spends the lead, pushes
  `cinematic { phase: 'aim' }`, then plays the move; its lead, windup and travel are `fixed` (never compressed), so the
  damage frame lands exactly on the overlay's impact beat (lead + windup + travel: 1780 / 1940 ms). A battler's first
  use in a battle is `full` (lead 1100 ms); later uses (`TimelineCtx.signatureSeen`, the controller's per-battle set,
  or a second use in the same events) are `short` (lead 250 ms, the overlay's clock starts 850 ms in). Reduced effects
  change no `at`.
- **Player / controller / overlay.** `TimelineTargets.cinematic?` (optional) gets 'start' / 'aim' and 'clear' when a
  timeline is cut short (`finishNow`, `stop`). BattleController projects both battlers through the optional
  `BattleView.project` (World3D / HarnessWorld: the billboard's top and feet through the battle camera, CSS px) and
  writes `battle/cinematic.ts` (`useCinematicStore`) off the tick; 'aim' re-reads the points once the camera settled.
  `SignatureCinematic` (mounted by BattleOverlay) is pure CSS animation keyed by the cue id; positions, the line angle /
  length, the scales and `--skip` reach the module CSS through `cssVars`; it clears its cue after its total. Under
  effective reduced motion the band fades in and out with the name, without the effect layer or the flash.
- **Verified live** (harness over CDP, WebGPU, mirevale, hollowmane vs castlemaw): both moves aimed at the projected
  battlers, the foe's Vendetta Volley mirrored (line angle 151°). The harness ticks slower than real time, so the
  overlay's wall-clock auto-clear fires early there; the capture re-showed the cue before seeking its animations.

## Signature move cinematics II: the legendaries and mythicals (2026-10-08)

- Ten more cinematics, one per legendary / mythical signature move (content: each is its owner's alone and known
  whenever it is met — `packages/content/IMPLEMENTATION-NOTES.md`): Cosmic Pyre, Sparking Grace, Sunbreaker Barrage,
  Foxfire Voltage, Kamehameha, Cosmic Miracle, Stellar Devour, Bankai Sever, Rift Collapse, Aurora Requiem.
  `SIGNATURE_CINEMATICS` entries now name their owner `species`, a `palette` and the 3D side (`anim`); MOVE_ANIMS takes
  every entry via `signatureAnims()`; a legendary's cut-in shows its own front sprite (portraits for all ten).
- The overlay is generic: the frame (dim, bars, band, glint, name, flash, tint) takes the move's palette, impact and
  total through `cssVars` (`--accent` / `--deep` / `--hot`, `--impact`, `--total`); each effect layer is its own
  component + module under `battle/sigfx/` (`SIG_FX`), drawn in the shared positioning groups of `sigfx/kit.ts`
  (`atA` / `atD` / `line` / `rot`, `vb` for local-origin transforms; the defaults sit in `:where(.fx) *`).
- Dev preview: `/sigfx/?move=<id>` (`sigfx/index.html`, `src/dev/sigfxPreview.tsx`, not a build input) plays one
  cinematic over a mock arena (`&side=far`, `&mode=short`, `&reduced=1`, `&t=<ms>` frozen; `window.__sigfx.seek`).
- `signatures.test.tsx` now asserts: every battle form's signature move and every legendary has a cinematic; a
  legendary's signature move is learned by its owner only (a form's by nobody); the portrait is the species (or the form).

## Move motion styles (2026-10-08)

- `battle/moveStyles.ts` `MOVE_STYLE`: every damaging move (166) → one of render's 14 motion styles (assigned from the
  move's name, contact and type, then reviewed one by one). `createMoveAnimRegistry` puts `style_<style>` in place of a
  type-default VFX (`type_*` / `impact_normal`); a hand-authored special effect (`drain`, `form_rage` …) stays, status
  moves keep theirs. The timeline's `vfx` keyframe already carried the move's `type`: `TimelineTargets.vfx`,
  `BattleView.vfx` and World3D / HarnessWorld now pass it to `BattleStage.vfx`, which colours the style.
  `moveStyles.test.ts` asserts every damaging move has a style and every style is a VFX id.

## Signature move sounds (2026-10-08)

- `SignatureCinematic.aimSfx` (`sig_*`, audio manifest): the move's own sound design, pushed at the cinematic's `aim`
  frame (the charge) in place of the type's move sfx, in full and short cues alike — its impact transient lands on the
  damage frame (tools/audio-pipeline IMPLEMENTATION-NOTES "Signature-move sound designs"). The cut-in still opens with
  `wind_gust` + the type's cry; the damage frame still plays its `hit_*`.

## Signature cinematics on the battle timeline's clock (2026-10-08)

- Bug (user report: "Kamehameha does not show the blast, Sparking Grace neither"): the overlay ran on the wall clock,
  the 3D move, the hit and the sounds on the battle timeline, which World3D steps at most `MAX_STEPS` (4) per frame —
  below ~15 fps the timeline falls behind real time. The overlay then played its beam and blast early and cleared
  itself after `totalMs` of wall time, before the 3D impact arrived. The harness never showed it: its checks seeked
  both clocks to the same instant.
- Fix: a cue carries `clock` = `TimelinePlayer.clock()` — the cursor's ms since the `start` frame (hitstop and crit
  slow-mo included), the wall clock once that timeline ends or another `play()` replaces it (`generation`), never
  rewound. `SignatureCinematic` holds every animation at `clock()` each frame (`pause` + `currentTime`) and clears
  the cue when the clock passes its length (a stalled clock ends after `4 × length + 5 s` of wall time). Without a
  clock (dev preview, tests) it runs on the wall clock as before.
- Verified in the harness with the world stepping slower than real time (16.5 s of wall time to 2 150 ms of
  timeline): no seek, the overlay sat at exactly 2 150 ms with Kamehameha's blast up; Sparking Grace's bloom at 1 900.

## Broadcast UI — tokens, fonts and base components (2026-10-11)

The user rejected the grove-green look and picked direction C, "Broadcast", from three mockups (design canvas
https://claude.ai/artifact/XXwEoFqjhEn53nXacE7v1L). SPEC §20.2.2 is amended (CHANGELOG 2026-10-11).

- **Tokens** (`tokens.json`): near-black carbon neutrals, paper `--text-hi #f5f3ee`, one accent `--accent #ff5b1f`
  that only ever means selected / primary / focus; HP high is paper, mid amber, low red. Radii 2 px (hard edges),
  `--r-pill` only for real circles. Shadows lost their inset light. New `--t-hero` (64/64) for the one big number or
  name of a screen. `design-system.test.ts` contrast floors follow the new table (accent 5.7:1 on `--bg-1`,
  on-accent 6.3:1 — both still AA).
- **Fonts**: Barlow Condensed 700/800/800 italic (display) and Barlow 400/500/700 (text), OFL 1.1
  (`public/fonts/Barlow-OFL.txt`), downloaded from Google Fonts with the user's approval in chat; 12 static woff2
  files, latin + latin-ext split by `unicode-range`, 223 KB. Only the latin files are preloaded
  (`vite.config.ts`). No `local()` for Barlow: an installed copy can miss a weight. The 600 weights still in some
  module CSS resolve to the 700 cut.
- **Base components**: `Button` draws its face as a skewed `::before` slab (label and focus ring stay upright), display
  face uppercase, primary 800 italic orange; `Tabs` — the selected tab is an orange slanted slab with black text;
  `Panel`/`Modal` titles are condensed italic uppercase (panel title `--t-display` with an orange slanted block in
  front), no accent washes; `HpBar`/`ProgressBar` tracks skew 12°, flat fills; `TypeBadge` flat type-colour
  rectangles in the display face; `CreatureSprite` sits on a flat slab of its type colour (no radial glow);
  `CreatureCard` selected = 1 px orange ring, showcase = a type-colour band instead of a glow; `Toast` a black slab
  with a square level block (success is paper now that green is gone); `EmptyState`, `Table` selection, `Field`
  segments and focus, `Slider` fill follow. The `/__gallery` route shows every state.

## Broadcast UI — shell and screens (2026-10-11)

The app shell (`src/app/*`) and every screen (`src/screens/*`) in the Broadcast direction
(`.screenshots/ui-revamp/BROADCAST.md`, mockups `C-World`, `C-Party`, `C-System`). Layouts and behaviour are unchanged
except where noted. Screenshots: `.screenshots/ui-revamp/shell/`.

- **Top bar** (`TopBar.tsx`): a carbon strip on a hairline. The brand is a black slab with an orange edge block. The
  zone name is condensed italic with a connection line under it; the connection dot is paper, amber or red, never
  orange. The nav is condensed uppercase; the active item is an orange slab skewed 12° with its label counter-skewed.
  Money (amber coin), trainer level (with a thin exp bar) and badges `n/8` are condensed tabular numbers separated by
  hairlines. The avatar is a paper square. Below 1400 px the zone's connection line and the username are hidden (the
  zone's `title` and the avatar button stay).
- **Five primary links + More** (the UX change approved in the mockups): Party, Bag, Dex, Map and Quests sit in the
  bar. Box, Shop, Social, Guild, Market, Pass and Settings sit behind a "More" disclosure: a button with
  `aria-expanded` / `aria-controls` and a list of real `NavLink`s, not `role="menu"`.
  - Opening moves focus to the first link. ↑/↓/Home/End move between the links. Escape closes the menu, returns focus
    to the button and does not reach the open panel's own Escape (capture listener + `stopPropagation`). A pointer
    press outside or a route change also closes it.
  - The More items' unread counts add up onto the More button. While a More panel is open, the button shows as the
    active slab, and its accessible name gains "(current: …)".
  - `NAV` keeps all 12 entries; each now has `primary` and an optional `action` (the hotkey). `NAV_PRIMARY` and
    `NAV_MORE` are derived from it. `ACCOUNT_LINKS` is unchanged.
  - The account menu gained Escape, outside-press closing and arrow keys. Mouse-leave no longer closes it.
- **Key chips**: paper squares with black display-face text; on the active slab the chip turns black with orange text.
  They come from the player's own bindings (`useSettingsStore` keybinds, spelled by `keyLabel` = TutorialCard
  `keyGlyph`): Party `party` (P), Bag `bag` (B), Dex `journal` (J), Map `map` (M), and in More, Settings `pause`
  (Esc, from the bare world). These are exactly the shortcuts `PlayShell`'s `useShellHotkeys` handles; Quests has no
  hotkey, so it has no chip.
- **World key legend** (`PlayShell` `WorldHint`): the C-World key legend, a black strip of paper key chips with
  condensed labels and hairlines between the keys. The `Shortcuts` landmark and its labels are unchanged.
- **Boot and error chrome**: `BootScreen` and `WorldBoot` show the brand lock-up (black slab, orange edge; paper
  "Remastered" strip) with a flat skewed activity bar. The gradient sweep and the text-shadow glow are gone.
  `ConnectionOverlay` lost its scrim blur; it is now a carbon card with a red (offline) or amber (reconnecting) top
  edge and square status icons. `PlayError` is a carbon card with a red edge and a `--t-display` italic title.
  `UnsupportedViewport` lost its blurred glass and gained an orange edge.
- **Party** (`PartyScreen`, the C-Party mockup inside the anchored panel):
  - **Lineup**: the six slots are now a row of cards. Each card has a type-colour slab with the sprite and a large
    slot number, then a condensed italic name, LV, a skewed HP bar (paper / amber / red at the HpBar thresholds) with
    the number, and status chips or "Fainted". Favourite, lock, alpha, shiny and held-item marks sit on the slab.
  - **Selected card**: an orange 2 px ring, an orange bar under it, and an 8 px lift. Each card is a real `<button>`
    with `aria-pressed`, labelled "name, level n, hp of max HP".
  - **Reordering**: drag reorder, `POST /party/reorder` and the optimistic revert are unchanged. Alt+↑/↓ still
    works, and Alt+←/→ now does the same along the row. The drop target shows an orange bar on its leading edge.
    Empty slots are numbered carbon placeholders.
  - **Header**: Avg lv, Types and Fainted sit in the panel header next to Heal party.
  - **Detail band** (`CreatureDetail layout="band"`):
    - Identity column: `Dex #nnn · Slot n` in orange (it belongs to the selection), a `--t-display` italic name,
      level, type badges, the species flavour text, and the HP bar.
    - Stats column: stats at level as `--t-h1` tabular numbers beside skewed paper bars of the base stat, the honor
      ledger when there is one, and an exp-to-next-level bar from core `expToLevel`.
    - Moves column: type-tagged rows (a type-colour edge, condensed italic name, type · power · PP; low PP in
      amber) and the actions.
    - Below the columns: Teach, Use an item, Setup and Identity are cards headed by paper label strips. Release sits
      in the Identity card.
  - **"Set lead"** is new. It reuses the reorder intent (moves the selected creature to slot 1); the creature already
    in slot 1 reads "Leads every battle" instead.
  - Every existing control is still there: Teach (TMs / tutor), items (Rare Candy ×5/×10, stones), ability / held
    item, nickname, favourite / lock, release with its confirm modal.
- **Box detail** (`CreatureDetail` default `column` layout): the type colour is a 6 px band on top (no tinted wash).
  Stats use the same big-number rows; moves stay `MoveButton`s.
- **`screens/layout.module.css`** (shared vocabulary):
  - `.sectionTitle` / `.kvLabel` are condensed 700 labels with wide tracking. `.h2` / `.h3` are condensed italic
    uppercase. `.kvValue` and `.mono` are display-face tabular numbers: `.mono` keeps its name, but no screen uses
    the monospace face any more.
  - New classes: `.labelStrip` (a paper slab label heading a card) and `.bigNum`.
  - `.statTrack` / `.statFill` are a skewed flat paper bar. `.detail` is carbon with a type band. `.notice` has a hard
    left edge.
- **Other screens** (visual pass only, CSS except the Pill tones below): Auth, Landing, AccountScreens, EmailNudge,
  Admin, BattlePass, Profile, TrainerCard, Rankings, RankedPanel, History, Bag, Box, Dex, Shop, Social, DmThread,
  Guild, Market, ListingDetail, Quests, Map, Settings, TeachSection.
  - Hard edges throughout; `--r-pill` only on real dots.
  - Removed: the radial accent washes (Landing, Auth, Admin, BattlePass hero, Quests), blurred glass, glows and text
    shadows, gradient fills, and the leftover green / orange decoration.
  - Titles, names and numbers are in the display face. The Dex "Witnessed N" is `--t-hero`, the largest number in
    the UI.
  - Pill tones moved from `accent` to `neutral` where orange was decoration or status: Profile "Earned", the
    TrainerCard tier, ListingDetail "Your listing", and a History win.
- **Deviations from the spec** (`20-client.md`; the lead amends the spec):
  - §20.9.2 lists the nav as nine flat `NavLink`s. It is now five primary links plus a More disclosure for the rest.
  - §20.9.2 says the money counter is "mono". Money, trainer level, battle-pass exp (§20.9.10) and ranked rating
    (§20.9.9b) now use the condensed display face with tabular numbers.
  - §20.9.3 describes the Party as "Left 60 %: six `CreatureCard variant="row"`" and "Right 40 %: … four
    `MoveButton`s". It is now a horizontal lineup of party-specific cards over a full-width detail band with
    type-tagged move rows. Alt+←/→ was added next to Alt+↑/↓, and so was "Set lead".
  - §20.9.2a / §20.9.9c still mention `--glass` cards. Those are TutorialCard and TowerStreak, both `world/` files and
    not in this pass.
- **Not in this pass**: `ui/KeyArt` (an orange moon halo, glowing veins and fireflies behind Landing / Auth / boot),
  the canvas HUD and the `world/` overlays (Minimap, TutorialCard, DialogueBox, …), `battle/*`.
- **Tests**: new `test/topbar-nav.test.tsx` (the nav model, key chip spelling, the More disclosure: counts roll-up,
  focus, Escape, navigation, and Escape not closing the panel). No existing test needed changing: the old ones read
  `NAV` / `ACCOUNT_LINKS` membership only.
- **Type icons instead of letter codes** (the user, 2026-10-11: "i dont wanna see GR or WA, i want icons"): 19
  24-unit stroke icons (`src/ui/typeIcons.ts`; flame, droplet, leaf, bolt, snowflake, fist, flask, hills, feather,
  spiral, beetle, stone, ghost, slit eye, hex nut, sparkle, moon, planet, ring) replace `TYPE_GLYPHS` in `TypeBadge`,
  stroked in the badge's `--tc-ink` on `--tc`, so the colourblind palettes still apply and colour is still never the
  only signal (each icon is distinct; compact badges keep the visually-hidden name). Render's battle plates draw the
  same table (`packages/render/src/hud/typeIcons.ts`); `design-system.test.ts` asserts the two equal by reading
  render's file as text (a test may not import another package by path).

## Broadcast UI — battle (2026-10-11)

The DOM battle UI restyled to the Broadcast direction (`.screenshots/ui-revamp/BROADCAST.md`, mockup
`canvas/project/C-Battle.dc.html`). Behaviour, hotkeys, accessibility and every test are unchanged; shots in
`.screenshots/ui-revamp/battle/` (taken in the offline harness page, `/harness/index.html?zone=mire_route`).

- **Command deck** (`BattleOverlay` + `BattleMenu`). The overlay keeps its box (bottom 28 vh, now
  `clamp(200px, 28vh, 280px)`, measured for the camera inset exactly as before) but has no panel of its own: no glass,
  blur, border or shadow. The deck's slabs sit on the arena. `BattleMenu` is a grid:
  - the **command rail** on the left: Fight · Party · Bag · Orbs · Run/Forfeit as slanted black slabs in the italic
    display face, each with a paper key chip 1–5. It **stays up in every menu**. The open menu is the orange slab with
    an inverted chip (`aria-current`). Clicking another slab goes straight there (Escape still goes back to the root).
    Outside the root the digits pick moves or targets, so the rail's chips step back to outlined. Keyboard focus turns
    a slab paper, because the slanted clip would cut an outline. A forfeit or leave waiting for its confirmation is a
    red slab. Outside `selecting` / `replacement` the rail stays visible but disabled. In the replacement phase only
    Party is live.
  - the **"Last turn" ticker** over the stage: a paper label slab, then the last 3 log lines in one strip
    (condensed uppercase, `--t-body-lg`, separated by "/", older lines truncate first). On the right are the keys
    that work in this menu as paper chips: `1–5 Command`; `1–4 Move · Esc Back`; `1–n Target · Esc Back`;
    `Esc Back`. Tones: bad news is `--danger`, good news paper, neutral `--text-2` (newest paper). Orange is no longer
    used for "good". The log has no damage numbers to colour: `timeline.ts` writes none.
  - the **turn tag** (`BattleOverlay`'s `p.turn`, hidden when empty): a black slab in the cell over the rail, level
    with the ticker. The harness's `HarnessOverlay` uses the same classes and keeps working.
  - the **stage**. At the root, the prompt ("What will X do?", "Waiting for the turn…") is a big italic lower third
    (`--t-display`). In a sub-menu, Back / "Back to X" (`Button` ghost) and the prompt sit on one small row over the
    content. Moves are 4 cards in a row (was a 2×2 grid). A disabled move's reason is a black label strip over the
    dimmed card. Party, bag and orbs are 3-column lists of slanted carbon slabs (italic name, big count). A party
    reason ("In battle", "Already chosen") is a paper corner tag on the `CreatureCard`. Doubles targets are three
    slabs: key chip, FOE / ALLY label (the ally's is outlined, so they differ by more than colour), name, HP. Empty
    lists read as a small slab.
- **`MoveButton`** gains an optional `size?: 'md' | 'lg'` prop. `'lg'` is the deck card: it fills its cell and the
  name is `--t-h1`, clamped to one line under 760 px of viewport height. An interactive move is a solid slab of its
  type colour (`--tc` / `--tc-ink`, so the colourblind palettes swap it) with a slanted right edge. It carries the key
  chip (black on the type colour), the type's name spelled out, the effectiveness in a black box (the shape-coded
  chevrons plus ×n; super-effective is paper ink, resisted or immune red), the name, POW and PP. Low or empty PP
  shows as an amber or red number in a black chip. `'md'` keeps the accuracy line. Hover and focus lift the card
  8 px and show the 6 px orange bar under it. The bar sits outside the clip, so it is never cut. Press is
  `translateY(-8px) scale(0.95)`; disabled is 0.45. The static form (party detail, `onClick` absent) is a carbon row
  with an 8 px type stripe, matching `C-Party`. `TypeBadge` is no longer used inside `MoveButton`.
- **Banner**: a black strip. The speaker sits on a paper label slab before the quote (Barlow `--t-body-lg`).
  **Intro card**: a black band reading "VS", then the opponent's type colour as a solid slanted slab carrying the
  monogram, then the title on a paper label strip over the name (`--t-h1`, league `--t-display`), then the
  `TypeBadge`. **Result card**: the badge is a type-colour slab with a "Badge earned" strip. Each reward is a tile
  with a big number over its label: "+800" / "money" (the text content still reads "+800 money"), and items read
  "×2" / name. **Raid panel**: a black card with the boss on a strip. The phase is a slab, red when Enraged and
  outlined otherwise, replacing the `Pill` (the `accent` tone for phase 3 was orange used as a status). The HP % is
  the big number and the board uses display figures. The player's row is a lighter step, no longer orange. **Raid
  summary**: damage and place are big italic numbers under paper label strips, and the rewards use the same tiles
  as the result card.
- **Deviations from the spec** (`20-client.md` §20.5.6, §20.2.4; the lead amends the spec):
  - §20.5.6 says the panel is "`Panel` without title" with the "root menu" as its own view. Now the panel has no
    `Panel` / backdrop. The root commands are a persistent rail beside every menu, and a click on a rail slab switches
    menus directly. The digit hotkeys are unchanged: 1–5 at the root only, 1–4 moves, 1–3 targets.
  - §20.5.6 says "The last 3 log lines render in the DOM panel's left third with `--t-body-lg`". They are now a
    one-line "Last turn" ticker across the top of the command area (still the last 3, still `--t-body-lg`).
  - §20.5.6 says "moves grid of 4 `MoveButton`s". They are 4 cards in one row (`size="lg"`).
  - §20.2.2 / §20.2.4 interaction scales: hover `scale(1.05)` on `MoveButton` is replaced by a lift
    (`translateY(-8px)`) plus the orange bar. Four cards in a row with an 8 px gap would overlap at 1.05. Press keeps
    `scale(0.95)`. The focus ring on the clipped slabs (move cards, rail, list rows) is the orange bar, the paper slab
    or an inset orange bottom bar instead of a 2 px outline at 2 px offset, which `clip-path` would cut.
  - §20.2.4 `MoveButtonProps` gains `size?: 'md' | 'lg'`.
- **Not in this pass**: `SignatureCinematic` / `sigfx` and `timeline.ts` (other sessions). The canvas HUD plates are
  render's. The doubles target list and the low / no-PP reasons inside the battle deck were not staged live; the
  states were checked in `/__gallery` and by the tests.

## Broadcast UI — world overlays (2026-10-11)

The DOM overlays over the live world (`src/world/*`) restyled to the Broadcast direction
(`.screenshots/ui-revamp/BROADCAST.md`, mockups `canvas/project/C-World.dc.html` / `C-System.dc.html`). No overlay
uses `--glass` or `backdrop-filter` any more, and there are no glows, gradient washes or shadow halos. The overlays
are black `--bg-0` slabs with `--line-1` hairlines, hard edges, label strips in the condensed display face, and paper
key chips. Behaviour, keys, ARIA and every test are unchanged. Shots are in `.screenshots/ui-revamp/world/`. The alt
dev pair was down, so they were taken by mounting the real components with the app's own modules and stores in the
5173 dev client over a world backdrop. The minimap and the raid lobby were fed a fake world session, as in
`test/raid.test.tsx`.

- **DialogueBox** is a lower third: an orange speaker strip (italic uppercase `--t-h3`, slanted right edge) on a
  black slab, the lines in the text face (`--t-body-lg`), and "n more" / "Close" with a paper `Enter` chip. The lines
  and button now sit in a `.slab` wrapper. The button's accessible name is still "n more — Enter" /
  "Close — Enter" (`aria-label`).
- **Minimap**: a black frame (2 px inset, hairline) with the map flush inside, and a label strip under it: the zone
  or hall name (`--text-2`) on the left, "Map" plus the player's own map key (`keybinds.map[0]` through `keyGlyph`) as
  a paper chip on the right. The strip is always rendered, with an empty name until the first tick. `minimapDraw.ts`
  (the canvas's own colours) is untouched.
- **ChatInput**: a black slab with a paper "Say" label block (slanted). While the field has focus, the slab gets the
  orange 2 px focus ring.
- **TutorialCard**: a paper label strip ("Prof. Wynn", "n of 7") heads a black slab. The title is italic uppercase
  `--t-h3`, the line is in the text face, and the key glyphs are paper chips. "Skip tutorial" sits under a hairline.
  The markup adds a `.body` wrapper.
- **FishingPrompt** follows the interact-prompt pattern: a 48 px square mark block, then a black slab with
  condensed uppercase `--t-h3` text and a slanted edge. The mark shows the float (a red-over-paper disc, still bobbing)
  while waiting and after a miss. On a bite the block turns orange with a black "!": the one moment to press. The
  mark is wrapped in a `.mark` span.
- **EvolutionBanner**: a paper "Evolution" label strip heads a black slab. The line is in the display face at
  `--t-h2`, uppercase, with the two names in heavy italic. The species is no longer orange: it was decoration. The
  status text, `role="status"`, the fades and the timings are unchanged. The skip hint is a black slab with a paper
  `Space` chip instead of a pill (spec §20.5.6 calls it "a caption pill").
- **TowerModal / TowerStreak**: the pick order is an orange chip, which marks a selection. Streak / best / run are
  `--t-display` condensed tabular numbers under small labels (`.statLabel`, replacing `m.caption` on the `dt`s),
  split by a hairline. The set reward is a black slab headed by a paper label (the amount is in `.rewardText`).
  `TowerStreak` is a black strip: a paper "Battle tower" block, the fight label, then "Streak" with a big number. The
  spec's `--glass` strip is gone.
- **RaidLobby**: the countdown is in the display face. Boss HP % is `--t-h1` tabular. The roster is a black slab: a
  paper "Trainers n / 8" header, hairline rows in condensed uppercase, damage as big tabular numbers, the own row
  marked with a 4 px paper edge (it was orange), and "Ready" as a paper label. The catch-window phase `Pill` is now
  `warn`, not `accent`, because orange is not a status colour.
- **WorldModals** (shared by the challenge, trade, evolve and learn-move prompts and the tower): headings are italic
  uppercase with a hairline under them. The money input is a black field with big tabular figures and an orange focus
  ring. The other side's offer is a black slab. "Confirmed" / "You confirmed" is a paper label, no longer orange text.

Spec text to amend (owned by the lead): §20.9.2a says "`--glass` card", and the card is now a black slab with a paper
label strip. §20.9.9c says "on a `--glass` strip", and the strip is now black with a paper label block; it also calls
the streak and best "(mono)", and they are now display-face tabular numbers. §20.5.6 says the skip hint is "a caption
pill", and it is now a black slab with a paper key chip. §20.9.2 (DialogueBox) is still accurate. You could add
"orange speaker strip, paper key chip".

## Battle-form auras (2026-10-11)

- `scene/spriteCatalog.ts`: `FORM_AURA` (`rage` → `majin`, `majin` → `majin`, `tenjin` → `tenjin`) and
  `auraOfSprite(speciesId, spriteId)`. `descriptor(…, spriteId)` sets `SpriteDescriptor.aura` when the sprite is a form
  of that species (`<species>_<form>`), so every path that already shows a form sprite (`BattleController.showBattler`
  → `World3D` / harness `setBattler`) gets the live aura with no other change. The shipped Rage Forms (hollowmane,
  castlemaw) are Majin forms and show the Majin aura from this change on.
- The aura starts when the form sprite appears (the timeline's `form` frame, after the `form_rage` burst) and ends
  with the faint, a resync to a formless battler, or the battle's end (render SPEC §10.7.5 "Battle-form auras").

## Majin / Tenjin in the client (2026-10-11)

The client side of the band gimmick (`.design/majin-tenjin.md` §3, §6, §8; core `transformError` / `formLineMet`).
Tests: `test/majin-tenjin.test.tsx` (16), `test/timeline.test.ts` (+2), `test/battle-forms.test.tsx` (adapted).

- **Labels**: `ACTION_ERROR_LABEL.cannotTransform` = "Can’t transform now". `timeline.ts` `healText(cause, itemName)`
  is an exhaustive switch over every `heal` cause; `'form'` (a Tenjin Form's heal on entering it) reads
  "<Name> is steadied and restored its HP!".
- **Timeline**: `FORM_VFX` / `FORM_TEXT` / `FORM_CUE` per form id. `rage` and `majin` are the same: the `form_rage`
  burst, a red flash, `raid_roar`, a shake, then "<Name> broke open into its Majin Form!" (this replaces "…’s mask
  cracks — it flies into a rage!", since the design renames Rage Form to Majin Form in the UI). `tenjin`: the new
  render VFX `form_tenjin`, a white-gold flash (#fff1c2), `bell_toll` (an existing approved id, no new audio), no
  shake, then "<Name> ascended into its Tenjin Form!". The `form` keyframe timing (`FORM_MS`) is unchanged. The
  design's dedicated sounds (crack + roar / bell + choir swell) are not made; the existing ids stand in.
- **Transform toggle** (`battle/transform.ts` `transformOffer`, `BattleMenu` `TransformToggle`): in the moves menu, at
  the end of the head row (after Back and the prompt). It shows when the player's side holds the band of the battler's
  form kind (`Side.bands`), the species has a form of that kind and the side has not transformed (`Side.transformed`).
  It is enabled when `transformError(...) === null`. Disabled, its reason is a caption beside it ("Majin needs HP below
  half." / "Tenjin needs HP at or above half." / "Already transformed this battle." / doubles, when the other position
  armed it this turn: "One transformation per battle."). The slab has a key chip **T**, the form sigil and
  "Majin" / "Tenjin". Armed, it is `aria-pressed` and the orange 'selected' slab (the sigil goes to `--on-accent`).
  While it is enabled, the ticker's key hints add "T Majin" / "T Tenjin". Picking a move while armed sends
  `moveAction(id, target?, true)` = `{ kind: 'move', move, target?, transform: true }`. This covers the doubles target
  list, which also gets the flag. It resets on a new turn, another doubles position, or any phase change, so it is
  off again after every submit. Doubles: the flag rides on the choosing position's pick only. Position 1's toggle is
  then disabled (core `validateSideChoice` rejects two anyway). T is free in battle: the world's chat key is blocked
  while `ui.battle` is set.
- **Coach mark**: the first time the toggle is enabled in the moves menu, one line under the head row
  (`role="status"`): "Majin ready — its HP is below half. One transformation per battle." / "Tenjin ready — its HP is
  at or above half. One transformation per battle." The toggle pulses 3× (no pulse under reduced motion). It shows once
  per kind per account (`state/bandTutorial.ts` `coached`) and is cleared when the phase leaves selecting. The design's
  first-time grey-out explanation is covered by the always-present disabled caption.
- **pvp patch**: `patchFromEvents` (formats without a preview) applies `formChange`: the battler's `form`, and
  `transformed: true` on a non-wild side, so the toggle hides after a pvp transformation as it does elsewhere.
- **Band cards** (`world/BandTutorialCard.tsx`, mounted in `PlayShell` beside `TutorialCard`, reusing its CSS module;
  state `state/bandTutorial.ts`, persisted per account under `ewa.bandTutorial`, apart from `ewa.tutorial`). A card runs
  while its band is in the inventory (`majin_band` / `tenjin_band`), Majin first when both are held, with 3 steps each:
  party opened (`/play/party`) → a creature of that form kind on the player's field in a battle
  (`ui.battle.authoritative`) → a transformation of that kind by the player (`sides[seat].transformed` + the battler in
  its form). A transformation completes the card. That is the "done on sight for accounts that already transformed"
  rule: the client has no server record of past transformations, so "already" means seen in a battle on this
  browser. Each card has a Skip. Like the opening card it hides during battles, dialogues and panels, but its tracker
  keeps running.
- **Form marks** (`ui/FormSigil.tsx`): `FormSigil` (24-unit stroke SVG: Majin = the cracked ring, crimson #ff3048;
  Tenjin = the whole ring + lens + ticks, gold #f5c84c; never orange), `FormMark` (a black chip with the sigil,
  `role="img"`, "Has a Majin Form"), `formKindOf`. Shown on `CreatureCard` row (after the badges) and tile (top-right),
  so the battle party list and the box get it. On the Party lineup card it joins the marks, and the button's label adds
  ", has a majin form". On the Dex grid (seen or caught; bottom-right; the label adds it) and in the Dex entry, a
  "Battle form" section: sigil, the form's name, "With the Majin Band, it breaks open below half HP. Once a battle." /
  "With the Tenjin Band, it ascends at or above half HP. Once a battle." The design's "form art in the Dex" is not done.
- **Spec to amend** (lead): §20.5.6 moves menu gains the transform toggle (key T, caption, coach line, ticker hint);
  §20.2.4 gains `FormSigil` / `FormMark`; §20.9.3 / §20.9.4 / §20.9.5 gain the form marks and the Dex "Battle form"
  line; §20.9.2a-style band card; the battle-text table gains the Majin / Tenjin lines and heal cause `form`; render
  §10.7.5 VfxId union +`form_tenjin` (64 ids).
- **Not verified live** (unit tests only): the toggle's layout next to a long prompt at 1280 px, the pulse, the band
  card in the world, and the `form_tenjin` burst on stage. A raid's player side would show the toggle if the server
  gave it bands (the client follows `Side.bands`).

## Majin / Tenjin bond cinematic, "Heartsync" (2026-10-11)

User request: a Mega-Evolution-like animation for the bond between trainer and Ewamon, with its own twist and sound.
`battle/bond.ts` (timing, palettes, store), `BondCinematic.tsx` + `.module.css`, mounted in `BattleOverlay` (and the
harness's `HarnessOverlay`). Design: `.design/majin-tenjin.md` §9.

- **Who plays it.** Only a trainer's transformation: `bandOf(state, ref)` (BattleController) = the species'
  `battleForm.kind` when the side is not wild and the battle is not a raid (the player, an NPC with bands, a pvp
  rival). A wild Majin keeps the plain burst. `TimelineCtx.bondOf` (optional; absent = no bond, every existing
  timeline unchanged).
- **Timeline.** `formChange` with a band: a `bond` frame + `bond_<kind>` sfx + camera `wide`, then `BOND_BURST_MS`
  (2 700 ms) spent uncompressed ('fixed'), then the existing flash / burst / shake / sprite swap / line. The form's
  own sound (raid_roar / bell_toll) is not played: the bond premix carries the roar / choir on the burst.
  `TimelinePlayer` forwards `bond(who: core Ref, kind, form)`; `cinematic('clear')` (a timeline cut short) clears the
  bond store too.
- **The overlay** (one clock from the frame; held at `TimelinePlayer.clock()` each frame like the signature
  cinematics): the trainer's wrist, cuff and lens (SVG) and the creature's portrait on two slanted slabs (mirrored when
  the foe transforms: the fist always reaches towards the creature); five heartbeats each (`BOND_BEATS`) speeding up and
  closing in — lens glow + ripple + a spark down the light thread / portrait thump + ripple — while SYNC counts to
  100 % (an `@property` integer counter); at the lock (2 400 ms) Majin strikes the ledger's "UNSAID" through, the strike
  cracks into crimson cracks across the screen, the cracked ring's halves fly apart, REFUSED; Tenjin cracks the screen
  and gold seams flow into every crack (kintsugi), the whole ring closes with its 12 ticks, HELD (+ "Held by <trainer>");
  the portrait becomes the form's. At 2 700 ms the slabs break off (Majin) / rise and burn white (Tenjin) over the 3D
  burst; gone by 3 300 ms. Reduced motion: still cards that fade and the stamp, no cracks, thread, ripples or flash.
- **Ends** when the battle clock passes `BOND_TOTAL_MS`, or when that clock has not moved for 5 s of wall time. (A
  wall-clock bound like the signature overlay's `4 × total + 5 s` cut it short in the headless harness, whose world
  stepped ~7× slower than real time.)
- **Names.** Player side: the session's username; an NPC: `foeIdentity(trainerId).name`; a pvp rival: "Rival".
- **Portraits.** `public/signature/<species>.webp` and `<species>_<form>.webp` for all 13 form species (23 new,
  `pnpm --filter @ewa/sprite-pipeline portraits …`, ~1.15 MB).
- **Dev preview:** `/bondfx/?species=toxshade&side=far&trainer=Reeve&t=2400` (`src/dev/bondfxPreview.tsx`,
  `window.__bondfx.seek(ms)`), not a build input.
- **Verified:** `test/bond.test.tsx` (9); the preview frame by frame in headless Chrome; the real battle in the harness
  over CDP (a scripted toxshade battle, a `formChange` injected): the overlay held on the timeline's clock to 3 300 ms,
  the 3D crimson burst under the breaking slabs. **Not verified:** the sounds by ear (checked numerically only), and a
  full server battle with a band.

## Arena PvP (2026-10-12)

Battles outside the world (protocol `arena.ts`, server `ArenaRoom`): Standard, Level 50, Ranked (Lv 50, the only mode
that moves the rating), the Weekly Cup, AI Training and friend challenges. The in-world PvP (walk-up challenge, the
Rankings screen's RankedPanel / Mirevale queue) is unchanged.

- **Session** (`net/WorldSession.ts`): one session holds the zone room OR one `arena` room (`kind`). `enterArena(seat)`
  retires the zone room (a consented leave: the server writes the position; it is in `retiring`, so no offline / kicked
  state), consumes the seat with `ArenaState` and wires it with the same `wire()` (every server message type). `room`
  stays the ZONE room (null in an arena), so every `ZoneState` reader (useRoomState, TopBar's ZoneChip, TutorialCard,
  Minimap, raid views) sees "no room" instead of a foreign state; `onRoom` fires null on entry; the new `onArena(room,
  inArena, closed)` drives the scene and the arena store. `returnToWorld()` leaves the arena and enters `homeZone` (the
  zone the player left; `wrongZone` retry as ever). A second `enterArena` from inside an arena (Queue again) hops rooms.
  `POST /zone/enter` → 409 `inArena` (a reload mid arena battle) → `POST /arena/rejoin` → the arena. While in an arena:
  `enter()` is a no-op (a shell remount must not forfeit a battle; with the arena socket gone it asks the server via
  rejoin, else goes home) and `send()` passes only `battleAction` / `battleResync` (`ARENA_SENDABLE`; prediction input,
  chat, interacts are dropped silently). An arena room that closes under the player is `onArena(null, true, closed)`:
  the arena flow sends them home unless the battle already ended (the result stays up until Back to world). Switches
  are serialised (`serial`); a handover that lands after an arena match took the player is discarded.
- **Arena flow** (`app/arena.ts`, store `state/arena.ts`): REST through `apiFetch` (not route actions — the calls move
  the session and must work from the HUD, the invite modal and the arena itself; deviation from §20.1.2's fetcher path).
  The message router hands it `arenaStatus` (queued: elapsed from `waitedMs`; matched: the seat → `enterArena` with a
  2.6 s "Match found" card; idle refusals toast, `cup` with the server's `detail`; `left` / `started` silent),
  `arenaInvite` (the modal), `arenaInviteResult` (toast + the PvP screen's outgoing line), `arenaState` (the match;
  `cancelled` toasts its reason and returns home after 1.2 s; the opponent's body via GET /players/:name for the foe
  stand-in) and observes `battleStart` / `battleResync` / `battleEvents` (the battle id) and `battleEnd` (the outcome
  and rating change for the result actions). Error copy for the server's codes (`busy`, `party`, `cup`, `notFriends`,
  `self`, `friendOffline`, `friendBusy`, `offline` = no presence, `NotFound` / `expired` invites).
- **Gates**: arena teams are healed copies, so only an EMPTY party blocks (a fainted one does not); also a battle, a
  trade, being in an arena, or offline. One queue at a time: while queued the other starts say "Leave the X queue
  first". The Weekly Cup is pre-checked with content `cupRefusal(party, weeklyCup(now))` (the server's rule) and shows
  why it is locked.
- **Scene** (`scene/World3D.ts`, `scene/arenaBackdrop.ts`): in an arena the zone is unloaded (statics, spawns, remotes,
  its atlas hold, a prepared neighbour), render's stadium (`createArenaBackdrop`, read through the namespace so a build
  without it links: sky only, ring terrain 'none') is added and registered as the zone root with `ARENA_LIGHTING` /
  `ARENA_GRADE` and `ARENA_BACKDROP.timeOfDay`; the ring dresses at the origin with `ARENA_BACKDROP.terrain`
  (`SceneDirector.enterBattle` gained an optional `terrain`); `update(scaled dt s)` per frame. The trainer waits at the
  near trainer slot; input stays off in the arena (`setInputEnabled` gated). The opponent is a temporary `battle:foe`
  stand-in (`FoeActor` `playerLook`: their body, the generic look until it arrives); a training partner gets a look per
  difficulty (`battle/foe.ts`, name from content `ARENA_TRAINING`). Music: gym theme between battles (elite for Ranked
  / Cup), battle theme in battle. The boot overlay covers both switches ("Entering the arena" / "Returning to the
  world"); the return reloads the zone through the normal `enterZone` (avatar where the player stood, remotes, spawns,
  minimap, HUD hint). A scene built after a reload's rejoin asks for a `battleResync` with the id the router saw (the
  server's resync can land before the World exists). `debug().arena` (dev) has a short event trace.
- **UI**: `/play/pvp` (lazy; More menu "PvP" + key K, `InputAction 'pvp'`; an "Open PvP" strip on Rankings): the rating
  strip (rating as the hero number, peak, ranked matches, the party's sprites), cards for Standard / Level 50 / Ranked
  (rating window while queued) / Weekly Cup / Training (levels × difficulty) / Challenge a friend (online friends).
  The top bar's queue chip (mode, elapsed, × leave) shows the queue anywhere; ZoneChip reads "Arena · Level 50" in an
  arena. In the arena (`world/ArenaOverlays.tsx`): a top-centre strip (Arena · mode · level · vs opponent), the waiting
  card, and after the result card (which gains the kind / level strips and says Continue) the result actions: Back to
  world, Queue again / Rematch / Challenge again (a re-queue shows its timer and Leave queue in place). The arena
  invite modal declines on its own with `allowChallenges` off or when busy. Minimap, key legend and tutorial cards hide
  in the arena; Map's fast travel is disabled there. History rows with `arena` read "Arena · <kind>".
- **Tests**: `test/arena.test.tsx` (session switch over a stubbed SDK incl. hop / 409 rejoin / closed room, the flow,
  gates, PvP screen, invite modal, arena HUD, the route). The other test fakes gained the arena seams.
- **Fixed (2026-10-12): the white world after "Back to world"** (was Open here, blamed on the beacon shadow maps). The
  zone room is joined with the renderer up, so `enterZone` ran before the room's first state patch: no local player in
  `players`, `loadZone` got no focus and predicted the first view at the zone's spawn (mire_route x −92; the player
  stood at 12, −9.5). Render's T4 phase 1 compiled that view; the real one stayed gated (invisible) until the background
  phase reached it (nearest the wrong focus first: 15–45 s), so the frame showed the sky through it — white by day, a
  blue haze by night. The beacon toggles only "fixed" it by recompiling for seconds while the background caught up
  (measured: with the beacons' castShadow off the frame stayed white; hiding the sky alone turned it dark). Now
  `enterZone` waits (≤ 3 s, `scene/arrival.ts` `awaitArrival`) for the patch carrying the player. Measured over 5 live
  returns (forced daytime): the first playable frame is the world every time (canvas luminance 74–75; before: 252–254 for
  8–45 s after the load in all 7 per-frame-logged returns); `loadZone` focus = the player's position. Test: `test/arrival.test.ts`. Palette,
  grade, exposure, fog and time of day come back with the zone (ZoneSystem's palette look + the room's `timeOfDay`), the
  backdrop is removed + disposed and `setZoneRoot(null)` clears it, the stage is undressed (beacons 0, shadows idle).

## The party strip follows the battle (2026-10-12)

The HUD party strip was built from the session party only (`inventory.party`). A world battle writes the party's hp
every turn (`inventoryDelta`, so the strip moved, but at commit, ahead of the timeline's HP bars); an Arena match fights
healed synthetic copies (`arenaCopies`) and writes nothing, so the strip kept showing the world party's hp and a fainted
arena creature stayed at 100 %. `World3D.writeBattleParty` (a `useUiStore` `battle` subscription): while the battle UI
is open the strip shows `authoritative.sides[seat].party` (each battler's own `maxHp`, so a Level 50 copy reads right)
from the start state, then after each turn's timeline (a `playing` phase never rewrites it, so the strip never runs ahead
of the bars); the session-party subscription stays quiet meanwhile. When `ui.battle` clears, the session party is
written back. Live on the isolated dev pair (Arena Standard): voltaura's card went 52 % → 5 % → KO a turn at a time
with the session party still full, and both players' strips returned to the session party after the result card.

## Trainer sight: the "!" and the walk-up (2026-10-20)

The server's `trainerSpotted` (SPEC §30.3 trainer sight) holds the player until the trainer's fight starts. World3D locks
input, cancels a cast, closes any dialogue, plays the existing `spotted` sfx (in the audio manifest, unused until now)
and runs `TrainerApproach` (`scene/trainerApproach.ts`) on the trainer's director actor: actor emote 4 (the HUD's "!"
card) while it turns to the player, 900 ms standing, a 3.2 m/s walk that stops 1.6 m short (at most 3 s), the local
avatar turned toward it each frame (a branch beside the evolution one in `tick`). On arrival the trainer's lines open
(`trainerPlan`'s beat for a story trainer, else `TrainerDef.lines`) as an `obligatory` dialogue: Escape skips to the end
and runs `onFinish` instead of walking away. `onFinish` sends `interact { kind: 'npc' }`; `battleStart` lets go of the
actor (the foe actor restages it and puts it back after). No battle within 6 s: the trainer goes back to its spot and
input returns. With the server's `WILD_ENCOUNTERS=grass` there are no spawn views to engage; nothing in the client
changed for that. Live (own pair, headless Chrome over CDP, act1 fixture, tide_route at night): Swimmer Cael saw the
player at 5.8 m, the "!" rose over him, he walked up, his line opened and Enter started the battle; earlier a walk in the
patch at (-40, 7) started "The wild Mossling appeared!" with `spawns: 0`. Test: `test/trainer-approach.test.tsx` (3).

## Switching: every turn plays in full (2026-10-20)

"After a switch the move animations don't show" (AI training, and every battle). Live on the isolated pair with per-frame
samples of the stage (pose, dissolve, flipbook page, live VFX emitters), two causes:

- **The resync cut the playing turn.** An NPC's replacement switch-in is not previewed; `patchFromEvents` kept hp, pp,
  status and actives but no volatile, so a switch-in's Intimidate never reached the client's state. The next turn's
  preview then mismatched, the client asked for a resync, and its answer landed ~100 ms into that turn's timeline:
  `restoreFrom` → `player.stop()`, the lunge cut off, no hit, no log line. Now `replayFromEvents` resolves an
  unpreviewed (or mismatched) singles turn again from the actions its events show (`actionCandidates`: a switch, an
  item, a catch, flee, forfeit, else each move with pp, with and without the transform; NPC / wild sides pass null like
  the server) and keeps the result only on a digest match. A pvp turn is replayed the same way. When nothing matches
  the state is patched and a `battleResync` requested (pvp doubles: patched without one, as before); a resync that
  arrives while a timeline plays is held (`pendingResync`) and applied when the last queued timeline ends.
- **The replacement finished the KO turn.** The server resolves an NPC's replacement ~30 ms after the KO turn;
  `TimelinePlayer.play` finished the playing KO turn at once (state frames only), so the KO turn's moves, hits and
  faint never showed and the next creature simply appeared. A `battleEvents` that arrives while a timeline plays is now
  queued (`waiting`, with the state it starts from) and played when the current one ends. `TimelinePlayer.step`
  returns when the `end` callback already started the next timeline.

Also: a voluntary switch-out gets a camera `attacker` shot over the switch (the user: "switch should be seen as a move
used"; a replacement after a faint gets none), and singles no longer push the turn end's idle pose onto a fainted
battler (it stood back up at 74 % dissolve, a ghost until the replacement). Live after the fix, 17 AI-training turns
with 6 switches and 4 KO + replacement pairs: 0 desyncs (before: one on the turn after every Intimidate switch-in),
every KO turn shows the lunge, the hit and the faint before the next creature enters. Tests:
`test/battle-controller.test.ts` (+2; the replacement test fails without the replay and without the queue),
`test/timeline.test.ts` (+2).

## Battle replays (2026-10-20)

- `battle/replay.ts`: `planReplay` re-simulates a `ReplayRes` with core `replayBattle` and refuses it (null) unless it
  ends on its `finalDigest`; `startReplay` injects `battleStart`, then one `battleEvents` per step whenever the
  controller leaves `playing` (selecting / replacement / submitted), then `battleEnd` with no rewards right behind the
  last step, as the server does. The battle id is `replay:<token>` (`battle/replayId.ts`). `WorldSession.inject`
  (optional on the interface, so the test fakes need nothing) dispatches a client-made message to the listeners.
- Nothing reaches the server: `WorldSession.send` drops any payload whose `battleId` is a replay's, and the
  controller's `submit` ignores a replay. The replay's creatures have `ownerId: null`, so `promptsFrom` queues nothing.
- `ReplayBar` takes the menu's place (the exported `Ticker` over a slab: names, `Step n of N`, Pause / Resume, Copy
  link, Exit). Exit (`stopReplay`) dismisses the battle through `battleActions().dismissResult()`. The result card
  says "End of the replay." and "A replay changes nothing in your game." and goes Back to the world.
- `/play/replay/:token` (`screens/ReplayScreen.tsx`, `replayLoader`): Watch navigates to `/play` first (an open battle
  blocks navigation) and then starts the replay. History rows: Watch / Link share first (`POST
  /history/battles/:battleId/share`, the same token every time) and toast a 409's reason. Icons `play`, `pause`, `link`.

## Creature history (2026-10-20)

- `screens/CreatureHistory.tsx` fetches `GET /creature/:id/history` when the creature is shown (aborted on change) and
  renders "Original trainer" and the events newest first; `eventLine` turns each event into its sentence (zone,
  badge and species names from content). Party's band gets it as a sixth tool card, Box's column after Identity, a
  listing above its bid history. The badge / Champion / legendary lines are paper bold: the accent means selected.

## The daily challenge (2026-10-20)

- `pvpLoader` also loads `GET /daily` (optional: a server without it shows no card) into `useArenaStore.daily`. The PvP
  card shows both teams, par, the best and its strip; Play / Try again → `startDaily()` (`ArenaLast { kind: 'daily' }`,
  so the arena's again action is "Try again"). `dailyShareText` is the clipboard text: number, turns, par and the strip,
  no team names. The arena result card refetches `GET /daily` (`DailyResult`) so the try just played counts.
- `foeIdentity('arena.daily')`: "Daily Rival", title "Daily challenge", look `suit_male`. Rankings: a Daily tab.

## Challenge modes (2026-10-20)

- Register sends `challenge` from a `Segmented` under the starters. `screens/ChallengeSection.tsx` (Profile) switches
  the run (`POST /challenge`, then GET /me through `hydrateFromMe`, so progression keeps one writer) and says why it is
  locked. `ChallengeChip` in the top bar. The fallen: the `fallen` CreatureBadge (card and Party marks), a Fallen note
  in place of Use an item, no Withdraw in the box. `BattleMenu` disables Bag in an active Hardcore run (Orbs already
  follows `canCatch`). Rankings: Nuzlocke and Hardcore tabs. Error copy for `fallen` and `badges`.

## Verified speedruns (2026-10-20)

- `accessibility.speedrunTimer` (default off; the persisted blob merges the default in). `SpeedrunChip` (TopBar)
  reads `GET /speedrun` on every (re)connect and counts on locally each second while the clock runs and the world is
  connected. `screens/SpeedrunSection.tsx` on Profile; `data/speedrun.ts` (`formatPlayMs`, `splitLabel`). Rankings:
  a Speedrun tab.

## Battle music mood (2026-10-20)

- `battle/mood.ts`: `battleMood(state, seat, hpOf)` from the player's active battler (the lowest of two in doubles)
  as the HP bars show it, and a Majin / Tenjin form it holds. `BattleController.updateMood` runs on the player
  side's `hp`, `form` and `enter` keyframes and at the start, and hands a changed mood to `BattleView.setMood`
  (optional; World3D wires it to `AudioDirector.setBattleMood`); `finish` clears it.
- `AudioDirector`: `stemLevel` and `musicLowpassHz` are pure (tested); `MIXER.battleMood` holds every number. The
  CC0 themes have no choir stem, so a Majin rise is the low-pass and the threat swell, not a new layer.

## Weather from real life (2026-10-20)

- Settings gains a World tab with `WeatherSection` (search through the server, pick, turn off). `realWeather` goes into
  `useRealWeatherStore` (messageRouter, reset when the world connection ends); World3D reads it wherever it set the
  zone's weather (join, `state.weather` changes) and on the message itself, null meaning the zone's again.
- Interiors still render none: the director owns that rule, the store only replaces the zone's value.

## Ranked seasons and watching live (2026-10-20)

- `battle/replay.ts` takes a `ReplaySource` (a shared replay or a live feed), `planReplay(.., live)` accepts a battle
  that has not ended, and `extendReplay` swaps in the longer plan (the shown steps are identical: same seed and
  actions) and continues. The battleEnd is sent when the plan has an outcome and every step was shown, so an outcome
  that arrives later still ends it. `battle/live.ts` polls every 2.5 s and stops on the outcome, a failed read, or
  when the replay is no longer on.
- The season panel sits on the Rating board only; the PvP screen's Watch live card polls every 10 s while open.
- A watched match plays from side 0's seat (the replay path), so the end line and the result card take the players'
  names from `spectatorNames` (a leaf map in `replayId.ts`, set while a live replay runs) instead of "You won / lost".

## Honor shapes the world (2026-10-20)

- World3D (shared file, small patch): listens to `shadow` (the director dims outdoors; a toast on arriving, rising
  or lifting) and adds `HOLLOWED_FLAG` to `flags()` at the highest level, which `npcDialogue` reads for Vesperveil's
  people. The World map reads `GET /world/shadow` once when opened.

## Majin vs Tenjin seasons (2026-10-20)

- `/play/factions` (More menu, and a link on the Rating board's season panel). The tug-of-war widths are flex grows
  passed through `cssVars`. In Solenne, World3D (small patch) asks `scene/factionSky.ts` once a season and the
  director renders the mood outdoors.

## One roaming legendary per season (2026-10-20)

- The map tags the roamer's route; the Dex entry of a roamer species shows where it roams and every season's first
  catcher (`RoamerNote`, one `GET /legends` per opened entry).

## Ghost trainers (2026-10-20)

- `foeIdentity` names `ghost:<username>` foes; the Profile's `GhostSection` reads `GET /ghost`.

## The encounter transition (2026-10-21)

SPEC §20.5.7. `battle/encounter.ts` (pure: the kind and the wipe record), `battle/EncounterWipe.tsx` (+ module css),
first child of `BattleOverlay`; `ui.encounterFx` written by `BattleController.onBattleStart` (not by `attach` or a
resync, not for a replay) and cleared by `reset`.
- `reduced` is carried in the record (the controller's `deps.reduced()`, like the VS card's), so the wipe never reads
  the live effective settings; the white flash follows `accessibility.screenFlash`.
- The shiny gold is two new tokens (`--shiny-gold`, `--shiny-light`, tokens.json → `pnpm --filter @ewa/client tokens`):
  the design-system test forbids custom properties anywhere else.
- World3D's battle view calls render `WorldFx.encounterAt(feet)` for a wild battle outside the arena (the grass
  bursts round the player, or the water sprays; render decides from the ground under the feet).
- Checked live on the second isolated client (the component mounted over the landing page through Vite's module
  URLs, each kind screenshotted mid-wipe).
- `SceneDirector.applyWeather` also calls `renderer.setAmbient?(pocket === null)` (render's ambient motes stay outdoors).

## Breeding (2026-10-21)

- The Daycare keeper is an interior NPC of kind `npc`; World3D's interior-NPC dialogue gains an `onFinish` that opens
  `/play/daycare` for role `daycare` (the only World3D change). `DaycareScreen`, `EggShelf` (Party: carried, Box:
  waiting) and `HatchReveal` read `state/daycare.ts`, refreshed from every action's response and after a hatch.
- The egg is drawn in CSS (`ui/Egg.tsx`), not a sprite: no atlas entry. The hatch reveal is a DOM overlay over the
  world (never over a battle) and plays the existing `ui_evolve_start` / `ui_evolve_done` cues through the running
  world's audio director when there is one.

## The hit callout (2026-10-21)

SPEC §20.5.8. A `callout` keyframe at the impact (`calloutsOf`), `TimelineTargets.callout?` (optional: recorders skip it),
`ui.battleCallout`, `battle/BattleCallout.tsx` (+ module css) in `BattleOverlay`. The committed timeline timing snapshot
gained one `callout` line per crit / super-effective hit in the fixture; the durations are unchanged. Checked live on
the second isolated client (the component over the landing page: the foe and own placements).

## Nemeses (2026-10-21)

- `battle/NemesisTaunt.tsx` reads `state/nemesis.ts` (its own small store, so `state/ui.ts` is untouched) and shows
  only over the battle whose id the `nemesisAmbush` names; it waits 700 ms for the encounter wipe, holds 6.5 s. It sits
  above the command deck using the deck's own height (`clamp(200px, 28vh, 280px)` + `--s-6`), as BattleOverlay lays it.
- `nemesisNews` bumps the store's `version` (the Profile's `NemesesSection` reloads on it) and is an 8 s toast; while the
  battle UI is open it waits (the server sends it right after `battleEnd`, before the timeline and the result card
  play; found live: a 6 s toast had expired before the result card) and is told when `ui.battle` clears.
- A caught nemesis's scar is read from its `nemesis-scar:` ribbon (`ScarNote` in the creature detail); the ribbon
  stays out of the card badges.

## A living ecosystem (2026-10-21)

- `screens/EcosystemPanel.tsx` (+ module css) sits in the Dex between the witnessed count and the grid; its words live
  in `data/ecosystem.ts` (pure, tested). The Dex is the species view, so the panel takes a zone picker over the
  visited zones with wild creatures instead of living on the map (whose nodes are too small for four columns).
- An unseen creature shows as a silhouette and ??? so the panel never spoils the Dex; it cannot be picked.
- `test/ecosystem-sprites.test.ts` is the migration safety check against the shipped manifest (see content's notes).

## The bounty board (2026-10-21)

- `screens/BountyScreen.tsx` (+ module css) at `/play/bounties`, opened by paging past the Marshal's lines (World3D's
  interior NPC case maps role `bounty` to the route, as it does the Daycare keeper). Its lines are pure exports (tested).
  A refused post shows the Marshal's words: `net/errors.ts` spreads content's `BOUNTY_REFUSAL_TEXT` into the messages.
- The claim needs no new client code: its payout is in the battle's rewards and its toast is a plain server `toast`.
- The poster's eyebrow names the zone the player stands in (a town when opened from the Marshal).

## NPC talk (2026-10-22)

- Over any person's dialogue (not a sign: `DialogueUi.noTalk`, set for lore), C (or the Chat button) opens a text
  field in the box; the player types English and Enter sends. The dialogue's keys ignore events aimed at a text field,
  so E / Space / H / K type normally there. `talk/npcChat.ts` streams the reply from LM
  Studio (`qwen3.5-0.8b`) in two passes: the talk pass streams the NPC's words with reasoning off and no tools;
  then the tool pass (same model) reads the exchange and must call at least one tool (`tool_choice: required`,
  reasoning off, token-capped since gemma sometimes drifts into reasoning anyway: no call = nothing).
  Measured: reply starts ~130 ms, completes < 1 s; the tool pass 0.3–1 s. Free choice without reasoning never called a
  tool; with reasoning it was right but took 5–7 s. qwen3.5-0.8b as the talk pass was first dropped (fast but
  incoherent in Dutch, and it would not give in to a robbery); since the talk went English (2026-10-22) it is the talk
  pass again by choice, rough dialogue accepted. It is the tool pass too, behind a word guard (`guardCalls`): bare it
  mixed up give and take and acted on threats (9/20 right on unseen exchanges; gemma-4-e4b-it-qat 18/20 at ~380 ms).
  The guard drops a call the NPC's words do not mention or only threaten, and turns give / take round when the
  wording points the other way: 14/20, ~200 ms, most misses an action dropped rather than a wrong one. The patterns
  are English only. `VITE_NPC_TOOL_MODEL=gemma-4-e4b-it-qat` brings gemma back (the guard still runs). `stripThink` drops a stray `<think>` block.
  `state/npcTalk.ts` holds the conversation; the DialogueBox shows it as a scrolling log (every line said and every reply, the streaming one last).
- Client-only and local: Vite proxies `/npc/llm` → `EWA_LLM_TARGET` (default http://localhost:1234), in dev and
  preview. `VITE_NPC_LLM_URL`, `VITE_NPC_LLM_MODEL` / `VITE_NPC_LLM_REASONING` (talk pass), `VITE_NPC_TOOL_MODEL` / `VITE_NPC_TOOL_REASONING` (tool
  pass; reasoning = an Llama.cpp `reasoning_effort` or `default`) override; `VITE_NPC_TALK=0` hides it. Not in the SPEC; the story never sees it.
- Speech input (hold V, MediaRecorder → whisper.cpp's `whisper-server`, `/voice/stt`) was removed (2026-10-22): too
  slow. Typing is the only way to talk.
- Tools: after each reply the tool pass calls what the NPC does: `slap_user`, `kick_user`, `give_money` / `take_money`
  (`amount` ≤ 1 000), `give_ewamon`, `take_ewamon`, or `do_nothing` (capped at 120 tokens). `state/npcTalk.runTools`
  plays the hits first, then the rest through `POST /npc/act` (server notes: NPC wallet, gift cooldown, a taken
  creature is released for good, never the last or a locked one), applies the delta and toasts. What happened (or
  was refused) is recorded on the turn in English (`ChatTurn.events`) and told to the talk pass in square brackets at
  the start of the next user turn.
  The tool pass runs in the background (2026-10-22): the phase is idle once the words are in, so the player can talk
  again at once. Tool passes queue one after another (hits and money in the order the NPC said them) and write their
  events onto their own reply, found by identity; a reply that starts before the previous tool pass is done does not
  hear its events yet. Back keeps them running (the NPC said it); closing the dialogue aborts them.
- Slap / kick (`scene/npcStrike.ts`, `state/npcFx.ts`, `world/NpcStrikeFx.tsx`): the NPC's actor runs at the player
  and walks back (the rigs have no strike clip), the player turns to it; at contact a hit sound, a camera shake and a
  comic burst ("SMACK!" / "WHAM!") with a red edge flash. A kick also knocks the player back:
  `LocalPlayerController.shove` runs them away from the NPC for 260 ms through the real prediction and wire (it
  overrides the dialogue's key block). An NPC without an actor here (a beat speaker) only gets the burst.
- The player can hit back: H slaps and K kicks the NPC in the dialogue (or the Slap / Kick buttons). `PlayerStrike`
  (render only; the simulation stands still) runs the player's actor at the NPC and back; a kick throws the NPC's actor
  `KNOCK_M` back and it walks home. Same sound / shake / burst at contact. The hit then becomes a user turn
  (`playerHitTurn`: a narration for the models, `shown` for the dialogue), so the NPC answers it and its tool pass may
  hit back or grab something.
- Villagers are no longer written as hot-headed in the prompt (2026-10-22): each gets one temperament from its name
  (`temperamentOf`), all friendly to a friendly player; slaps, grabs and gifts happen when the NPC says them.
- One conversation per dialogue: E on a person opens the dialogue and a new conversation; every typed line and
  hit while it stays open is added to it. A conversation never pages the lines: Enter / E / Escape / Back go back to
  them (`leaveTalk`: in-flight work aborted, a line still waiting for its answer dropped, the turns kept), and the next
  line resumes it, so a beat's `onFinish` (a battle, a gym challenge, the tutor screen) still runs only by paging past
  the scripted lines. Closing the dialogue (paging past the last line, a battle) ends the talk (`endTalk`).
- The talk system prompt is five sentences of instructions (2026-10-23): who the NPC is (name + role + place, a
  villager in Ewamon, "a game like Pokémon"), its temperament, what it can do ("slap or kick the traveller, give them
  money or take theirs, give them an Ewamon or take one of theirs: to do it, just say it"; the tool pass carries it
  out), fury when slapped, kicked or insulted ("yell, curse and swear at them with foul words, insult them back and
  threaten them"), and "Otherwise chat and answer
  any question, whatever the subject, with only the words you say out loud" (gemma3-1b wrote `*my voice higher than
  usual*` and other role-play). Longer prompts made the villagers worse. The conversation is a plain user / assistant
  message log (`chatMessages`), not part of the prompt: the scripted lines open it as the NPC's reply to a "Hello.",
  tool events go in brackets on the next user turn, and same-role turns are merged and the log starts on a user turn,
  which gemma3's template requires. Explaining the brackets in the prompt made it answer with `[asides]`, so it is
  left out; `tidyReply` drops round and square brackets, `stripThink` a single-asterisk span of three words or more
  (keeping `a *beautiful* city`) and emoji.
- Provoked (2026-10-23): a slap, a kick or a line with a rude word (`INSULT`, `provoked`) gets `[You are furious.]` in
  its user turn: with the rule only in the prompt, most hits and insults drew a mild "Watch it!". The NPC hitting back
  is the tool pass's job: gemma3-1b never says the slap unless given the exact words, and then it parrots them ("Take
  this slap!" on every reply, friendly ones too). The tool pass is told that a provoked NPC hits back, and `guardCalls`
  keeps a hit after a provocation even when the reply only yells. Measured on 32 live exchanges: 8/8 slaps and kicks
  and 5/8 insults hit back, 0/16 friendly or begging lines did.
- Swearing back (2026-10-23): with an uncensored gemma4-e2b, the fury rule and the marker say to swear
  (`[You are furious: swear at them and insult them back.]`). Checked live: insults and a slap drew foul-mouthed replies
  ("you little shit", "you miserable wanker"), and a friendly line stayed friendly.
- Villager battles (2026-10-23): a `start_battle` tool, and "battle them with your Ewamon" among what the NPC can do. A
  line that challenges the NPC (`challenged`: battle / duel / fight / challenge, not turned down) gets `[You accept the
  challenge: …]` (it wins over the fury note) and `guardCalls` starts the battle whatever the tool pass called, so a
  challenge is never talked away; a battle the NPC offers on its own needs a battle word and must not be only a
  threat. `runTools` plays it last through `POST /npc/act battle` and closes the dialogue (which ends the talk); the
  zone room opens the battle. `foeIdentity` names a `villager:<npc id>` foe after the NPC, with its look. Live on
  gemma4-e2b: 3/3 challenges ("I challenge you to a battle!", "Let's fight, you idiot.", "Wanna have an Ewamon
  duel?") were accepted and called `start_battle` without the guard's help; a friendly question called nothing.
- Docker splits the passes over two llama.cpp servers (one model each): gemma3-1b talks (`/npc/llm`), qwen3.5-0.8b
  calls the tools (`/npc/tools`, `VITE_NPC_TOOL_URL`; unset = the talk URL, as with Llama.cpp). Measured 2026-10-22:
  on 84 replies gemma stayed short and in character (0 third person, 0 loops, p90 2.8 s) where qwen rambled (2, 1,
  4.3 s); gemma3-1b's template has no tool support, so llama.cpp drops the tools and it never calls one (8/24 labelled
  exchanges, only the do-nothing ones; 15/24 even forced through a JSON schema) against qwen's 19/24 guarded.
- One model since 2026-10-23: gemma4-e2b does both passes on the one llama.cpp server (`/npc/llm`; `llm-tools` and
  `/npc/tools` are gone, `TOOL_MODEL` / `TOOL_BASE` default to the talk pass's). It needs `enable_thinking: false` in
  the request (the client's default `none` reasoning; the Docker build no longer sets `default`): without it the
  reply was its reasoning ("The user asked… Plan: …"), `--reasoning-budget 0` alone does not stop that, and unlike
  qwen it still enforces `tool_choice: required`. Measured on 8 live replies and 8 labelled tool exchanges: in
  character and on topic, talk 0.5–1.7 s, tools 8/8 right at 0.4–0.6 s. The rest of this section was written against
  gemma3-1b / qwen3.5-0.8b; the prompt, the tidying and the guard are unchanged.
- Robbery (2026-10-23): a player line that names money and demands it (`robbed`: "give me your money", "empty your
  pockets", "hand over your coins or else") gets `[You are scared and you give in: say how many coins you hand over.]`
  instead of the furious note. Without it gemma4-e2b paid 1 of 12 live robberies (it refused or changed the subject);
  with it 18 of 24 paid (amounts the NPC names, mostly 3–100 coins). After a robbery `guardCalls` turns any money call
  into `give_money`: the tool pass read "Here, take these" as `take_money` half the time.
- The talk pass samples like gemma3-1b recommends: temperature 1.0, top_p 0.95, top_k 64, min_p 0 (qwen at 0.7 looped a
  sentence until the token cap now and then; a presence or repeat penalty changed nothing for gemma). The tool pass
  stays at temperature 0.
- No example turns: gemma took them for the real conversation ("What did I just say?" → a line from the examples) and
  wrote whole "Traveller: … / You: …" scripts when they sat in the system prompt. Naming robots / AIs in the prompt
  ("laugh it off") made it bring them up unasked (6/90), so it is left out. The reply is tidied, not the prompt: it
  stops after 6 sentences (was 3) within 320 tokens (was 200), and only a round or square bracket not right after a word is dropped as
  a stage direction, so `print(e)` in a code answer stays (2026-10-22). History is capped at 32 messages (was 8, 2026-10-22: a conversation read as forgotten after four exchanges).

## First-person view (2026-10-22, not in the SPEC)

- `state/view.ts` (remembered per browser in localStorage) and the toggle under the minimap (`Minimap.tsx`
  `ViewToggle`, also F when not typing). World3D's `syncFirstPerson` runs every frame: first person is on when chosen
  and the world is free-roaming (no battle, arena or evolution); entering looks the way the diorama faced.
- On: the rig's `setFirstPerson` gets the look; `cameraYaw()` returns the look yaw, so WASD walks where you look
  (the same camera-relative `LocalPlayerController` path); the player's own body is hidden (re-applied each frame, a
  zone handover respawns the actor) and faces the look; the diorama's tilt-shift DOF is off (it blurred everything
  past a few metres); wheel zoom and the Q / R heading turns do nothing. In a hall `syncView(null)` stands every wall
  (render `setView(null)`); render turns the occluder fade off by itself (2026-10-25).
- Looking: a left-button drag over the canvas (`InputCallbacks.look`, 0.0042 rad per px, pitch ±1.35 rad). In the
  diorama `look` declines and the drag turns the heading as before.

## Breakdance (2026-10-22, not in the SPEC)

- A Dance button in the key legend (`PlayShell` `WorldHint`) and G (`useShellHotkeys`, not a remappable binding) call
  `state/dance.ts`; World3D sends emote 7 and plays it on the player's own actor at once (the server does not echo a
  player's own emote), with the trainer-victory fanfare. First person stays on while it plays and the eye rides the dancing body (render `bodyTilt`): the view spins, flips and goes upside down with it.
- Any player's breakdance (own, or a remote's `emote` change to 7) makes every NPC / trainer actor within 30 m hop
  along (`SceneDirector.forEachStatic`, `actors.setHop`). Walking ends the dance (emotes yield to locomotion).

## Graphics quality and frame cap (2026-10-23, not in the SPEC)

- `GraphicsSettings.quality` (`'auto' | 'low' | 'medium' | 'high'`, default `'auto'`: render's `recommendedQuality`, low
  on integrated Intel GPUs) goes to `createRenderer({ quality })` and live to `renderer.setQuality`. Settings › Graphics
  shows it as a segmented control. Persisted blobs without it merge the default in.
- `GraphicsSettings.frameCap` (`0 | 30 | 60`, default 60; 0 = the display's rate): World3D's rAF callback skips display
  frames until the next slot on a fixed 1000 / cap ms grid (1 ms slack), so 120 / 144 Hz displays do half the work and
  the simulation still steps by real elapsed time. The hidden-tab 250 ms loop is unchanged.
- `FRAME_CAP_UNLIMITED` (−1, "Unlimited"): rAF never fires faster than the display, so `scheduleUnlimited` posts the
  next frame through a `MessageChannel` once the PREVIOUS frame's `device.queue.onSubmittedWorkDone()` resolved (two
  frames in flight, as under rAF; at once on WebGL2). With one frame in flight (the first cut) the CPU waited for the GPU
  to drain and the GPU for the CPU to encode, so on a GPU-bound scene Unlimited fell below the Display rate (2026-10-25).
  `loopGen` drops a frame posted before a stop or a visibility change. Frames beyond the refresh rate are never shown: a
  benchmark mode. Live check (dev-alt, headless Chrome at 60 Hz): 60 / Display ≈ 60 fps, Unlimited ≈ 74 fps, a 0 ms timeout
  still fires in ≈ 5 ms (p50) in all three.
- `GraphicsSettings.showFps` (default false): Settings › Graphics › Show FPS puts a mono readout ("58 fps", `FpsChip`)
  in the top bar beside the speedrun clock. World3D's once-a-second `onSecond` writes the drawn frames to
  `useUiStore.fps` when it is on (dev builds always did); with a frame cap the count is the capped rate.

## Smooth diorama drag (2026-10-23, deviates from §20.4.5)

- §20.4.5 turns the heading by 90° per 80 px of horizontal drag. A drag over the canvas now orbits the diorama camera
  continuously instead, at the first-person look rate (`LOOK_RAD_PER_PX`, drag right looks right): `InputCallbacks.orbit`
  → render `CameraRig.orbitBy`. The rotate keys still step 90° (from the nearest heading); without `orbit` the input
  capture falls back to the 80 px step.

## Shared LLM plumbing and NPC memory (2026-10-24, not in the SPEC)

- `talk/llm.ts` holds what every LLM feature shares: the endpoints and model names (env overrides unchanged), the
  reasoning switch, `streamChat` (SSE, stop early), `chatOnce` (one call: tools and `tool_choice`, JSON output as
  `json_object` or a JSON schema, a timeout on top of the caller's signal), `stripThink`, `parseSse` and `noDashes`
  (em-dashes to commas, a colon before a list, dropped at an end; also the horizontal bar and a spaced ` -- `).
  `npcChat.ts` keeps its exports (re-exported) and runs both passes through it. Both NPC prompts end with "Never use
  em-dashes." and every reply shown goes through `noDashes`.
- NPC memory (`talk/npcMemory.ts`, `state/npcTalk.ts`): opening a person's dialogue (`openTalk`, signed in only)
  fetches `GET /npc/memory/:npcId` once; the first reply waits for it at most 600 ms. The memory, the town's gossip and
  how to feel go as one bracketed note after the player's first line (`chatMessages`' `memory`), fixed for the
  conversation. Measured on gemma4-e2b with the warm-and-chatty temperament: as a system-prompt sentence 0 of 9 replies
  used it, as a note on the opening "Hello." 0 of 9. On the player's first line, feeling and instruction first and the
  memory last ("You know this traveller and you do not trust them. Tell them why, coldly. What you remember of them:
  ...") a slapped NPC named the slap in 12 of 12, a friend brought up last time in 6 of 6, a stranger passed on the
  gossip in 6 of 6; with the memory first and the instruction after, the slap came up in only 2 of 6.
- When a conversation with at least one reply ends (`endTalk`: dialogue closed, target changed, a battle taking the
  screen), the NPC's summary (one call, temperature 0.2, 90 tokens, first person; 10 of 10 test transcripts gave a
  usable one or two sentences, 11 of 11 with a live slap, at 2.6 to 9 s on the shared docker model) and the talk deeds go to `POST /npc/memory` in
  the background. A failed or junk summary falls back to a templated one from the deeds and the tool events. The deeds
  come from what happened, never from the model: H / K = `hit`, `robbed`, an insult (`provoked`), a threat regex,
  kind words (thanks, an apology, a compliment aimed at the NPC; "nice day" is not one) only in a conversation without
  any of those.
- Live check (alt2 pair, headless Chrome, the docker model): a new account met the archivist ("Mirevale · Neutral"),
  slapped her (she swore back), closed the dialogue; on the next visit the tag read "Mirevale · Wary" and she answered
  "Hello again" with "You stopped to waste time. Then you struck me."; the child, never slapped, greeted the traveller
  with "Hessa Dunmore said you hit her!" under the same Wary tag.
- The DialogueBox shows the town's standing as a small carbon tag beside the speaker strip ("Mirevale · Wary"; wary in
  the warn tone, hostile in the danger tone, liked / trusted in paper white). Signed out, nothing is fetched or shown.

## Followers with field powers (2026-10-21)

- `scene/FollowerViews.ts` feeds render's `FollowerPool` from `PlayerState.lead` / `leadFlags` (listened per player).
  Residency: the player's own follower holds its species' static atlas (front and back, `'still'`); a remote's shows at
  once on an atlas already bound, else takes a front-only party single (`bindSingle`, at most `FOLLOWER_SINGLES` 3, two
  of one species share one), else has no follower: the fallback is "no follower", never a whole 2048² atlas per
  passer-by. Re-chosen at 2 Hz with the nameplates (the nearest remotes with a rig).
- The glide in `LocalPlayerController`: a blocked step whose 0.6 m probe is not passable asks the glider (content
  `planGlide` over the collider's `passable`); glide steps are gait 3, replayed along the line; a glide window's message
  is a second payload object with `glide`. The probe must stay blocked 6 steps before it asks (a push, not a slide along a
  ledge: the live check's autopilot, threading a one-sample ledge with a Flying lead, slid into accidental take-offs). Any
  correction mid-glide ends the glide and rests take-offs for 3 s (the server takes every on-line position of a glide it
  planned, so a correction is a refusal; replaying the glide would only be refused again); a probe with no plan rests
  0.2 s. The probe and plan allocate only at a
  take-off. Remote gliders are not lifted (no glide state on the wire): they slide down the face under interpolation.
- `scene/fieldPowers.ts` (`FieldPowerSystem`): targets, bramble blockers and render obstacles, the power key, the
  server's answers, the Fire light level, the dark-water marks and the sense trails; it subscribes to the session's party
  and progression itself, so World3D only wires it (`bootFollowers`, `stepFollowers`, `syncFollowers`).
- `world/FieldPowerChip.tsx` under the minimap; `state/fieldPowers.ts` written only when what it shows changes. The party
  card's field power line and the "Walks with you" tag; the power key `fieldPower` (F) in the controls.
- `zoneSpecFor` appends the brambles to `obstacles` (`bramble:<id>`): the zone snapshot moved for the 8 routes and the
  rift only.

## Camp bases (2026-10-22)

- `scene/CampViews.ts` (owned by World3D, created with the interaction targets): the fire's `camp` target, the render's
  `ZoneHandle.camps.set` and `state/camp.ts`; World3D only listens to the three `ZoneState` camp fields and routes `E`
  to `/play/camp`. A state for a zone other than the shown one waits (a handover's room can attach first).
- `screens/CampScreen.tsx` sends `camp { action }` through the world session and re-reads `GET /camps` when the camp
  store changes (a claim or a takeover arrives as zone state, an edit as the REST answer).
- `zoneSpecFor` adds `spec.camps` on the 8 routes: the snapshot moved for them only.

## NPC side quests (2026-10-24, not in the SPEC)

- A villager asks the traveller for a favour while they chat. The server draws it (`GET /npc/quests/:npcId` → `next`,
  fetched by `openTalk` beside the memory); `talk/npcQuest.ts` words it for the talk pass (`askNote`: "You need help:
  ask the traveller to catch a Mossling for you, it lives on Mire Route. Promise them three hundred coins and a Potion
  when it is done.") on the player's line that asks for work, or unprompted on their second line to an NPC that is
  neutral or better, once per conversation and never on a slap, insult, robbery or challenge (`shouldAsk`). The note
  rides that user turn (`ChatTurn.nudge`, `asks`), like the memory note.
- The tool pass gets `offer_quest` only on that exchange (`judgeTools` / `judgeMessages` with `offer`); `guardCalls`
  keeps it when the NPC's words ask for something (`guardOffer`), adds it when they do and the call is missing, and on
  that exchange drops money and battle calls (the coins are a promise). Then `POST /npc/quests/offer` stores the
  server's own draw, and the DialogueBox shows the favour (`world/NpcQuestCard.tsx`: a carbon row, a paper FAVOUR chip,
  the sprite for a catch or the type icon for a show, Accept / Decline, later the progress and Hand in, orange only on
  the press buttons).
- Answering: Accept / Decline / Hand in say a line for the player ("Yes, I will do it.", "Sorry, not now.", "I did what
  you asked."), and a typed yes / no to an open offer or "I did it" to an accepted favour does the same (`answerOf`,
  `saysDone`): the server call happens first (`state/npcQuests.ts`), then the NPC replies to the line with a note of
  what happened (`ACCEPTED`, `DECLINED`, `claimedNote` with the reward in words, `NOT_DONE` when the server does not
  call it ready). The hand-in lands the money and the items in the session, toasts the reward and refetches the memory
  (the standing moved by the `helped` deed).
- A favour turning done elsewhere (a catch, a wild win, a crossing) reaches the session as a `questProgress` entry
  `npc:<id>`; `watchNpcQuests` (started by the DialogueBox) toasts "Favour done: <objective>. Go back to <NPC> in
  <town>." The journal has a third tab, Favours (`screens/FavourList.tsx`, `GET /npc/quests`): the open favours with
  who asked and where, the progress, the reward and Drop (abandon) on an accepted one, then the last ones handed in.
- Measured on the docker model (talk/npcQuest.ts header): the first wording ("Offer 300 coins") made NPCs pay on the
  spot and the tool pass move money; "Promise them ... when it is done" stopped that but the amounts came out garbled
  ("thirty hundred coins") in 14 of 30; with the amount in words (`numberWords`) 28 of 30 replies asked, 26 named the
  right amount, none garbled it, and `offer_quest` fired on 27 of 28 asks and 0 of 9 small-talk replies.
  End to end with the shipped code (12 server draws for six Mirevale and Saltmourn NPCs): 12 offers stored, 11 replies
  said the task with the right amount, no money or battle call.
- Live check (alt2 pair, headless Chrome, the docker model): a new account asked the archivist "Do you need any help
  with something?"; she answered "Beat four wild Ewamon on Mire Route for you and you will get two hundred and forty
  coins. Deal?", the card showed "Beat 4 wild Ewamon on Mire Route · Reward 240 coins" with Accept / Decline; Accept
  turned it to 0 / 4 and she replied "Good. Now go and do it. And when you are done, come back to me."; the journal's
  Favours tab listed it with Drop. Completing and handing in was not driven live (the server tests cover it).
- Signed out, nothing is fetched and no card shows; with the server's `NPC_TOOLS` off the fetch fails and the NPC never
  asks; the model down means no ask (the talk pass errors as before), the card and the journal still work.

## Battle commentator and trainer banter (2026-10-24, not in the SPEC)

- Client only, words over the battle: `battle/moments.ts` reads each timeline's core events (as the timeline starts)
  into moments (crit, super effective, knockout, comeback: the attacker at 20 % HP or less lands the knockout, status,
  a Majin / Tenjin transform, a last creature sent out, a catch or a break-out, the win, the loss; the opening from the
  leads). `battle/commentator.ts` says them when that timeline has played (`BattleController.onTimelineEnd` →
  `commentary.played()`): the highest one as the commentator's caption, throttled (`createThrottle`: majors always, a
  minor 7 s after the last line and never the same minor twice running), and the trainer's reaction (its end, its last
  creature, one of its creatures fainting, the start). A timeline cut short (a resync) never says its moments; nothing
  queues. `BattleControllerDeps.commentary` is optional (World3D passes one; the harness and the tests do not); the
  controller only hands it events and calls it, so battle state, timing and input are the same with or without it
  (`battle-commentary.test.ts` compares both).
- Words: a caption is a headline (a template filled with the facts, so the model never says who did what) and a colour
  line; the trainer speaks a line. Templates for every moment (three or more each, `createPicker`: seeded by the battle
  id, never the same line back to back) speak at once and whenever the model is down. At the start of a battle (not a
  replay) two structured calls run in the background, one after the other: the trainer's bank (five moments x 2 lines
  in its voice; a villager's `GET /npc/memory` folded in as feature 1 does, feeling first, memory last) and the
  commentator's name-free colour bank (9 moments; super effective, knockout and status stay templates). Both are
  JSON-schema calls validated with zod (`@ewa/protocol` `CasterBankSchema`, `TrainerBankSchema`) and line by line
  (`cleanLine`: `noDashes`, length, names, sides, types; `WRONG_WAY` for a trainer's outcome said backwards). Whatever
  is back by a moment is used; a bank that answers after the battle is dropped. Measurements in `talk/commentary.ts`.
- Authored lines win: a league trainer gets no start banter (its pre-battle lines and the VS card), no last-creature
  line when it has `mid.lastStand`, no line on losing when it has a concession line; a faint line stands aside while a
  league banner is up. A villager's start template names what it remembers ("You hit me last time. Try that now.").
  Raids and spectated matches get no commentary.
- UI (`battle/BattleCommentary.tsx`): the caption is a lower third bottom right above the command deck (LIVE paper
  tag, the headline in the italic display face on carbon, the colour line on a glass strip under it), 5.2 s; the
  trainer speaks top right under the HUD clock (name on a paper slab, the line on carbon), 4.2 s. A newer line replaces
  the one showing. The closing lines (the commentator's win / loss / catch, the trainer's last word unless a concession
  is authored) go on the result card (`ResultCommentary`), since the caption would sit under the modal's scrim. Reduced
  motion: the slide uses the --motion-* tokens, 0 ms then. All text through `noDashes`.
- Settings › Accessibility: "Battle commentator" and "Trainer banter" (`accessibility.battleCommentary` /
  `trainerBanter`, default on; off also skips that bank's call).
- Live check (alt2 pair, headless Chrome, the docker model, Arena training at level 50): the opening caption "It is
  Bramblecub versus Cirrileap / And we are under way!" and the partner's "Prepare for the Ewamon onslaught now." (the
  trainer bank was back within the 11 s the start took), then "Super effective from Cirrileap! / That is going to
  sting.", and on the result card "It is over for <player>! / The battle ends in defeat." with the partner's "Your
  journey ends with my victory." (both bank lines). A first run that acted at once spoke only templates. Neither
  covered the HP plates or the deck at 1440 x 900. Not driven live: a villager, a league trainer or a wild catch (the
  unit tests cover them).

## Shop haggling (2026-10-24, not in the SPEC)

- In a town whose shop has a keeper (every shop hall; Saltmourn and Skyrend sell from a stall without one), the shop
  screen has Haggle (shown when `GET /shop` brings a `keeper`, i.e. `NPC_TOOLS` is on, and the talk is not switched off
  with `VITE_NPC_TALK=0`). It opens the keeper's dialogue in haggle mode (`DialogueUi.haggle`, `state/haggle.ts`
  `openHaggle`): the box sits bottom-left beside the panel (`data-side='left'`), the text field is open at once, the
  speaker is "Juniper, Shopkeeper" (`shopkeeperName`: content calls them all "Shopkeeper").
- The talk (talk/haggle.ts, the shop branch of talk/npcChat.ts): the persona carries `shop` (the stock with its
  prices), so the system prompt is the keeper's ("the traveller haggles with you"); each typed line is read as a move
  (`haggleMove`: bulk offer, flattery, a plain ask / argument / plea, rudeness, a threat) and gets a bracketed note
  with the percent the server's cap allows (`haggleNote`; refusals when the cap is 0, during the cooldown, or after a
  deal in this conversation; a markup for rudeness). The tool pass in a shop has `give_discount` / `raise_prices`,
  `slap_user`, `kick_user` and `do_nothing` only (no money, Ewamon or battle tools; a robbery or a challenge there is
  only words), and `guardHaggleExchange` checks it against the words (`guardHaggle`). Measurements in the header of
  talk/haggle.ts: on 60 exchanges against the docker model the guarded result was right 59 times and never wrong.
- What the tools did goes to `POST /shop/haggle` (`haggleAct`); the answer's deal and keeper land in `useHaggleStore`,
  a toast says the deal ("Juniper's deal: 10% off for 10 minutes", the danger tone for a markup), and the keeper hears
  what really happened (a cut: "You gave the traveller ten percent off, not the twenty you said"). One discount per
  conversation (`dealt` in state/npcTalk.ts).
- The shop screen reads the store, so its prices move the moment a deal lands: a carbon strip over the table with a
  paper "Deal" tag (warn for "Markup"), each moved price after its struck-through base, the totals and the "Not enough"
  check on the deal price; the sell tab shows `dealSellPrice`. The strip's minutes tick every 5 s and the deal drops
  when it lapses. The shop loader fills the store (deal, keeper, the stock for the persona).
- Tests: `test/haggle.test.ts` (moves, notes, percents in words and digits, the guard, the keeper prompts and tools,
  the store with `fetch` mocked), `test/shop-haggle-screen.test.tsx` (the strip and prices, Haggle opening the talk,
  a bulk offer's deal landing on the open screen with a toast, a markup, no keeper no button).
- Live (2026-10-24, the alt2 pair at 1440 x 900, the docker model behind `EWA_LLM_TARGET=http://localhost:8080/npc/llm`
  since port 1234 is not published): a fresh player in Mirevale opened the shop, Haggle opened "Juniper, Shopkeeper"
  beside it; "I'd like to buy twenty Potions. Can you do me a better price?" got "Ten percent off for ten minutes for
  you" (neutral cap 10), the strip and toast "Juniper's deal: 10% off for 10 minutes", Potion 150 → 135 and a buy
  charged 135; "your prices are a rip-off, you crook" got "I'll raise the prices by ten percent for these ten
  minutes", the strip turned to "Juniper's prices: 10% up for 10 minutes", Potion 165. At 1440 px the box covers the
  left edge of the panel's item column (the descriptions); the item names stay readable above it.

## Prof. Wynn: Ask the Professor and "Why did I lose?" (2026-10-24, not in the SPEC)

- Client only, no server change. `/play/professor` (`screens/ProfessorScreen.tsx`, the More menu's "Professor", the new
  `professor` binding, L by default: L was free in the world, the shell and the dialogue) asks Prof. Wynn about the
  player's own save: a typed question or one of four suggestion chips. The answer shows at once as the facts (a terse
  list, the species' sprites and the type icons it is about); the professor's words come over them when the model has
  them, the facts then muted under a hairline. Model down, slow (20 s), off (`VITE_NPC_TALK=0`) or wrong: the facts
  alone. The panel keeps the last six questions; a new question cancels the one still thinking.
- The facts (`talk/professorFacts.ts`, pure, deterministic): a snapshot of the session (`saveOf`: party, box with
  levels, moves and the honor of an honor-split species, badges, flags, dex, zone, bag) and ten lookups over content:
  species, evolution (level, item with where it is sold, trade, the honor split with what moves honor and the player's
  own ledger), where to find a species (wild spots with levels, time of day and water, open zones first, the badge a
  closed one needs; else the pre-evolution, a quest reward or a legendary's spot) or a type, type matchups (only the
  side asked: `typeView`), the player's team (coverage, the shared weakness), the next step (the HUD's `storyHint`) and
  the next league fight, a league trainer's team, the player's party against one (who answers whom with which move,
  the best pick when nothing is super effective, the trainer's moves at their levels as the server builds them, the
  level gap, a box creature or a wild one of the right type), an item, a place. `routeQuestion` picks the lookup from
  the names in the question (species, nicknames, trainers by name, first name, "Cinderhold gym", "fire gym" or badge,
  items, zones, types) and a few keywords. Spoilers: legendary spots only when asked for by name, never in a type
  search; a league team not reached and not named shows its type and top level only; the story's next step only.
- The words (`talk/professor.ts`): one call per answer, a neutral system prompt (the feature 3 finding), the facts and
  the question in the user turn, temperature 0.2, 160 tokens. `checkedAnswer` keeps the words only when every game name
  and number is in the facts, "your <species>" is the player's, and no type claim contradicts the chart
  (`ungrounded`, `wrongTypeClaims`); `tidy` drops repeated sentences. A tool loop (the lookups as OpenAI tools) was
  measured against this deterministic retrieval and lost (wrong lookups on 3 of 14, two calls, 3 to 12 s); numbers in
  the module header.
- "Why did I lose?": World3D tees a battle logger (`createBattleLogger`, state/professor.ts) beside the commentator, so
  it gets the battle's start and every timeline's events through the existing `commentary` dependency (BattleController
  is untouched); `end` drops the log. On a lost battle (not a replay, not a watched match, at least one landed hit) the
  result card offers the button (`battle/LossReview.tsx`). `battle/lossFacts.ts` reads the events: the opponent's
  creature and move that hurt most (and on whom it was super effective), super-effective hits taken and landed, the
  player's move the other side resisted, the level gap, the knockouts, and what to bring (the attacking types that hit
  most of the creatures the opponent sent out; the player's own creature of those types, box first, else a wild one).
  Only creatures the opponent actually sent out count. Shown: the facts (the top two and the advice) at once, the
  coaching when back, and a "Bring next time" strip of type icons and sprites. The facts say "the opponent's
  Caldermole", not "their": with "their" the model wrote "Your Caldermole" in every trainer loss.
- Tests: `test/professor-facts.test.ts` (20 question / fact fixtures over three saves, content cross-checks, spoilers,
  parsing, the guards), `test/professor.test.ts` (prompts, tidy, checks, the store with the model mocked, off or down,
  `lossReport` on a scripted battle, the logger and the review), `test/professor-screen.test.tsx` (the panel, the
  result card's button on a loss only, the hotkey and the More entry). `topbar-nav.test.tsx` counts the new entry.
- Live (2026-10-24, the alt2 pair, the docker model behind `EWA_LLM_TARGET=http://localhost:8080/npc/llm`, the act1
  seed: three badges, on Tide Route): L opened the panel; "Is my team good against the next gym?" answered in 7.2 s
  "Your Infernomorel's Solar Flare is super effective on their Ampmite and Luxtrik. Your Geoboxer's Earthquake is super
  effective on their Raidori and Flowbot." over the facts (Zia Volt, level 27 against 35, the two threats), "How do I
  evolve Shiveruff?" "at level 22 ... 8 levels to go" (4.2 s), "Where do I find a ghost type?" three night spots (8.2 s).
  An arena training battle forfeited after two turns showed "Why did I lose?"; the coaching read "You lost because the
  opponent's Thundrix hurt you most with Aerial Ace ... Next time bring Ice and Rock moves: Shiveruff in your party has
  the type." with the Ice / Rock icons and Shiveruff's sprite. In the level 50 arena the facts give the save's levels
  ("Geoboxer (level 25)"), not the arena's.

## Talk to your own Ewamon (2026-10-24, not in the SPEC)

- Client only, no server route, no migration, nothing written to the save. The player talks with a party creature:
  the `buddyTalk` key (Y by default: Y was free; listed in the field power chip under the lead as "Y Talk with
  Geoboxer") opens the talk with the lead walking behind them, and the party detail band's Talk opens it with the
  selected creature (the panel closes, the talk sits over the world). `world/BuddyTalk.tsx` reuses the DialogueBox
  lower-third classes (orange speaker strip, carbon slab, log, typed field, paper key chips) with a portrait column:
  the creature's real sprite, its type icons, a shiny / alpha mark, and its level as a carbon tag by the name. The
  creature greets first; Enter sends a line; Escape or Close ends it; a battle, a dialogue or an evolution taking the
  screen ends it too. While it is open the world's keys and the shell's hotkeys wait (`worldBlocked`, PlayShell).
- The facts (`talk/buddyFacts.ts`, pure): "you" sentences from the creature (species and types, nickname, level, HP
  and status as a mood, shiny, alpha, a Majin / Tenjin form, bandborn, the honor ledger of an honor-split species), its
  history (`GET /creature/:id/history`, fetched once a session per creature and waited for 1.5 s: how it was met,
  caught where and at what level, hatched, traded or gifted, how many days together, its last evolution, badges, the
  Champion, a nemesis it struck down), the session's memories of it and where the player is (zone, day or night, the
  weather). The game has no nature and no friendship value: the voice is a temperament and two creature sounds (its
  species' first syllable doubled, "Moss moss", and its type's sound, "blub") seeded by the creature's id, and the bond
  is what the save already holds (days together, badges, this session's battles).
- The memories (`state/buddy.ts` `createBuddyLogger`): a third Commentator teed beside the commentator and the battle
  logger in World3D (BattleController untouched) reads each battle's events into at most 8 memories per creature: won
  (with its best, super-effective-first move), lost, fainted, a knockout with the move, a level, a move learned, ready
  to evolve, a catch it helped with, a run. Foes are said in full ("a wild Ampmite", "the opponent's Ampmite", the
  trainer's name), feature 5's finding. In memory for the session only, on purpose: the durable story is the server's
  creature history, and the memories are a few minutes' colour; no new table.
- The words (`talk/buddy.ts`): one call per line, a neutral system prompt, the facts, the voice, the trainer's last
  four lines (not the creature's own: with them the model said its greeting again in 5 of 8 live answers; a sentence it
  already said is cut and a line that still repeats gets one warmer try) and the trainer's words in the user turn, "You are the creature: say I and my about yourself", temperature 0.7, 70
  tokens, 15 s. `checkBuddyLine` drops a line that calls itself another species, claims a type it does not have ("I am
  a Fire type", "my fire"), promises something ("I can give you a Potion"), holds a game name or number neither the
  facts nor the trainer's line hold, or a type-chart claim the chart contradicts (feature 5's `ungrounded` /
  `wrongTypeClaims`); then a seeded template for its mood speaks. Every line gets the creature's sound if it lacks one
  (`voiced`) and goes through `noDashes`. Measured numbers are in the module header (40 real calls: 36 kept, 0 wrong
  names / types / levels shown, one swapped role; 0.5 to 3.7 s).
- Ambient lines (`talk/buddyAmbient.ts`, `scene/buddyWatch.ts`, `world/BuddyBubble.tsx`): World3D hands a snapshot at
  2 Hz (the zone, the clock, the lead and its HP, rare / shiny / alpha wild creatures within 20 m, open water within
  2.5 m); the lead remarks on a new zone (once a session each), a notable spawn (once each), low HP after a battle,
  night falling, or a place that suits its type (a Water type at the water, a Fire type in a cinder zone: the region's
  gym type). Nothing in the first 20 s, at most one line per 2 minutes, a kind at most once per 10 minutes, nothing
  while a battle, a dialogue, a panel, the talk, an evolution, the arena or an interior has the screen, and what
  happened then is not said late. The template is always there; the model words it when it answers within 4 s. The
  bubble is a DOM overlay (render untouched): paper white, carbon ink, a square tail, `position: fixed` at the
  follower's head, which World3D projects from the follower billboard every rendered frame while a line shows
  (`setBubbleAnchor` writes only on a pixel's move); off screen it sits over the player. 3.5 to 7 s by length. Reduced
  motion: no pop. Settings › Accessibility "Follower chatter" (default on) turns the lines off.
- Tests: `test/buddy.test.ts` (facts, voice, history, memories, mood, templates, prompts, the checker, the reply and
  ambient wording with the model injected, the ambient trigger and throttle, the world snapshot, the battle logger,
  the talk and bubble stores with `fetch` mocked), `test/buddy-talk.test.tsx` (the panel, the bubble, the chip's key,
  the party card's Talk, the binding and the setting).
- Live (2026-10-24, the alt2 pair at 1440 x 900, the docker model behind `EWA_LLM_TARGET`, the act1 seed on Tide
  Route): Y opened "Geoboxer · Lv 25" with its sprite and type icons; it greeted in 6 s ("Hello trainer. My feelings
  are calm.") and answered "Who are you, and where did we meet?" in 5 s with "I am Geoboxer. We met in Ash Route."
  (its `caughtAt` is ash_route); Escape closed it. Two later four-turn talks (after the repeat fix) answered "How long
  have we been together?" with "four days" and "Are you a Water type?" with "My type is Fighting and Ground", 4 to 6 s
  a line. The party card's Talk on Bloomduck closed the panel and opened the
  talk ("Talking with Bloomduck"). A bubble over the follower anchored at its head and cleared itself; an ambient step
  for a new zone was worded by the model in 3.4 s. A natural trigger (walking into a new zone, nightfall) was not
  driven live; the unit tests cover them.

## A recurring rival (2026-10-24, LLM feature 7, not in the SPEC)

- The server's `rival` message drives it (World3D): `near` stores the view (`state/rival.ts`) and starts the model's
  taunt while the player walks the last metres; `approach` spawns the rival's actor (`rival:actor`, its look from the
  view) where it stepped out and plays trainer sight's approach on it (the "!", the `spotted` sting, the walk-up); on
  arrival its taunt opens as an obligatory dialogue (no NPC talk on it), and paging past it sends the interact for
  `rival:<name>`. The battle's foe actor stands in during the fight (`foeIdentity` knows `rival:` ids: name from the id,
  look from the view, a stand-in look after a reload). After the battle, once the result card is dismissed, the rival
  stands before the player (`partingStand`), says its parting line and walks off (`scene/rivalExit.ts`); the line goes
  to `POST /rival/words` for the Profile.
- The words (`talk/rival.ts`): facts in the rival's voice ("my Cindercap", "your Bramblecub", the last battle from
  both sides, the record), its feeling by arc stage and an angle per stage for the taunt and the parting line; a
  neutral system prompt with everything in the user turn (feature 3's finding). `checkRivalLine` keeps a line only when
  feature 5's `ungrounded` and `wrongTypeClaims` pass, `whoseMixups` finds every "my X" the rival's and every "your X"
  the player's (lists and nicknames included), `pastClaimsWrong` finds no past the record contradicts, and a parting
  line has the result the right way round. Templates per arc stage (`TAUNTS`, `PARTINGS`, and `RIVAL_START` for the
  battle's first line) speak at once and whenever the model is down, slow or wrong. The measurements are in the
  module header (24 calls on the shipped prompts: 24 kept, 0 fact errors or mix-ups among them, median 1.3 s).
- Live check (alt2 pair, `RIVAL=always`, the act1 fixture with 3 badges, the docker model): on Tide Route the rival
  (Milo, showy, Glimfin line at Voltide L36 against the player's Cindercap line) stepped out, walked up and battled;
  the record moved 1-0, 1-1, 2-1 over three meetings, the arc went cocky, frustrated, cocky as it should, the Profile
  section showed it with the parting words. What it found: `rival near` sent during the join never reached the client
  (the server now sends it with the first move), a taunt pre-written before the session's party was in hand was
  checked against an empty party (the cache key now holds the party), the cocky parting example came back garbled 4
  of 4 times (changed, see the module header), and the trainer bank's win line "Your victory is temporary, traveler."
  passed feature 3's outcome guard (`WRONG_WAY.win` now drops "your victory / win"). After the fixes the third meeting
  used the model for both lines: "You remember who won our last battle. Your team is not very impressive." and "That
  was luck. My Ewamon will beat you next time."
- A beaten player meets no rival until they heal: a party with nothing standing makes the rival stay away for that
  visit (like trainer sight's look-away).
- The battle banter is feature 3's trainer bank: `personaOf` gives a rival "Corin, the traveller's rival, loud and
  brash" with its arc and record as the memory (`rivalPersona`).
- The model for the rival follows Settings › Accessibility "Trainer banter" (off: templates only, no call), like the
  in-battle lines; no new switch.
- Profile: `screens/RivalSection.tsx` (Broadcast: the signature creature on its type colour, the name in the display
  face, the arc on a paper tag, the record as a scoreboard, the last meeting, the parting words as a pull quote, the
  team it brought with sprites). It reloads after every meeting and is absent with the server's `RIVAL=off`.
- Tests: `test/rival.test.ts` (facts, prompts, checks, templates, the model call mocked, the taunt and parting timing,
  the rival as a foe and as a persona, the exit walk) and `test/rival-section.test.tsx`.

## The rumour board (2026-10-24, LLM feature 8, not in the SPEC)

- `/play/rumours` (`screens/RumoursScreen.tsx`): a town's board. The town crier (content `withTownCrier`, beside the
  Marshal) opens it with `?town=` when the player pages past its lines (World3D, like the Marshal's Wanted board); the
  More menu opens it too (the town the player stands in, else the last one they stood in: World3D notes it on every
  zone change, else the town next to the route). A picker switches between the towns the player's badges open.
  Broadcast: a masthead ("The Mirevale Crier", the UTC day), each rumour a carbon row with a slanted slab in its type
  colour (the creature's sprite, else the type icon, else a kind icon: no letter codes), a paper kind tag and the zone,
  the player's gossip apart under "About you". Orange only on the selected town and focus.
- `talk/rumours.ts`: one call per fact (neutral system prompt; the fact, the town and the crier in the user turn),
  checked against the fact: feature 5's `ungrounded` and `wrongTypeClaims`, no other capitalised name, no number word
  the fact lacks, one of the fact's names or numbers kept, the time kept, the turn kept (up stays up, robbed stays
  robbed). `RumourCache` keeps the words per UTC day and town in memory and localStorage (wrapped: a blocked or full
  store keeps them in memory; other days are dropped). Templates: a crier's lead-in picked by the fact id, then the
  fact. Measurements in the module header (34 of 34 kept on the shipped prompt, median 1.3 s a fact).
- `state/rumours.ts`: the facts show at once in their templates; the model writes the unwritten ones one at a time (one
  call in flight), each replacing its template as it comes back checked; closing the screen or switching towns stops
  the writing (what was written stays). `VITE_NPC_TALK=0` keeps the templates. 409 `npcToolsOff`: "The crier has the
  day off."
- Live check (alt2 pair on a fresh database, the docker model): the board from the More menu showed six facts at once
  and their words in 12.8 s; in Mirevale's Healer the crier spoke its lines and paging past them opened
  `/play/rumours?town=mirevale` with the day's words from the cache at once. Found on the way: from the mirrored spot
  the Healer's PC won the E prompt in front of the crier (moved, see content).
- Tests: `test/rumours.test.ts` (prompt, checks, tidy, template, the day cache, one call, the store) and
  `test/rumours-screen.test.tsx` (the panel, the words replacing templates, About you, the picker, off, the More menu).

## The adventure journal (2026-10-24, LLM feature 9, not in the SPEC)

- `/play/journal` (`screens/JournalScreen.tsx`, the More menu): today's page first (Day N, "Today" and the UTC date,
  the page, the day's facts as chips, Copy, Rewrite today), then the earlier pages newest first under a paper rule.
  Chips: the creature's real sprite, else the type icon, else a kind icon, a short label, the fact's words on hover and
  for screen readers. When more happened since today's page was written, the screen says so and Rewrite today turns
  orange. Copy puts the page on the clipboard (a toast either way). Broadcast, no inline styles.
- `talk/journal.ts`: one call per page (neutral system prompt; the day's facts, "Day N:" and "as I" in the user turn),
  checked against the facts: feature 5's `ungrounded` and `wrongTypeClaims`, feature 8's `strangeNames` (mid-sentence
  capitals only: a diary starts sentences with any word) and `strangeNumbers`, `resultFlips` (no win turned into a loss
  or back), at least two facts told, "Day N:" set right. The template is "Day N:" and the first five facts as they are.
  Measurements in the module header (23 of 24 kept, median 2.7 s).
- `state/journal.ts`: opening the screen reads `GET /journal`, then writes what is missing one page at a time (today's
  when the day has facts, then each unwritten day before it): the model's words when they hold, else the template;
  stored with `POST /journal/day/:day` and shown at once. Rewrite today reads today again first. Closing the screen
  stops the writing. `VITE_NPC_TALK=0` writes the templates.
- `talk/rumours.ts`: `strangeNames` takes `sentenceStarts: false` for the journal.
- Live check (alt2 pair on a fresh database, the docker model): Day 1 written on open from four facts in 3.8 s (the
  model gave the facts back almost word for word); a new deed made the page stale and Rewrite today wrote the new
  page in 6.8 s; the chip for kind words first read "had" (fixed: "Kind words", "Gift").
- Tests: `test/journal.test.ts` (prompt, tidy, checks, template, one call, the store with its calls injected) and
  `test/journal-screen.test.tsx` (the page written on open, chips, earlier pages, Copy, Rewrite today, an empty day,
  off, the More menu).

## Voice talk, opt-in (2026-10-24, LLM feature 10, not in the SPEC)

- Client only, no server change, nothing downloaded. Every part is off by default (Settings › Audio, a "Voices"
  section under the sliders): `audio.npcVoices` "NPC voices", `audio.battleVoices` "Voice the battle",
  `audio.voices` "Voice volume" (0.8), `audio.speechInput` "Speak to NPCs (sends your voice to Google for
  recognition)". NPC voices stay off by default although they are local: a game that was silent suddenly reading
  every reply aloud in a system voice would surprise the player.
- NPC voices (`voice/`): the browser's `speechSynthesis` behind `SpeechEngine` (`speech.ts`; a fake in
  `test/voiceFakes.ts`). `bindVoices.ts` (`startVoices`, PlayShell) follows the stores: an NPC's reply is spoken
  sentence by sentence while it streams (`speakable.ts`: a sentence is complete when a space follows its end;
  abbreviations, initials and decimals do not end one; a run over 180 characters is cut at a comma), the buddy's
  lines and the lead's bubble, the rival's walk-up taunt and parting line (the dialogue on `RIVAL_ACTOR_ID`), and with
  "Voice the battle" the commentator's caption and the trainer's lines (queued behind each other, a newer one
  replacing one still waiting). Scripted lines and signs are not read.
- The text is tidied for the ear: `noDashes`, then bracketed notes (`[...]`, `(...)`, `{...}`, `<...>`, `*...*`),
  emoji, markdown marks and links go; an aside still open while streaming is held back.
- Voices (`voices.ts`): local voices only (`localService`). Chrome's "Google ..." voices synthesize on Google's
  servers, so they are never used, and with no local voice nothing is said rather than fall back to the browser's
  default voice (which may be one of them); the setting then says so and is disabled. English first, else any local
  voice. A speaker's voice is a pure function of its key (`npc:<id>`, `creature:<id>`, `person:<name>`, `caster`) and
  the voices on offer, in any listing order. Pitch / rate are seeded per key; a creature's pitch follows its species'
  `sizeScale` (0.5 squeaks at ~1.6, 2.2 rumbles at ~0.6).
- Interruptions: a new reply, the player's line to the buddy, the dialogue closing or changing target, going back to
  the scripted lines, the buddy talk closing, a battle opening (world speech) or closing (battle speech), pressing
  push-to-talk, a setting turned off, master or voice volume at 0, the tab hidden with "Mute when the tab is hidden".
  The speaker keeps its own queue and gives the engine one sentence at a time (Chrome cannot drop one waiting line and
  stalls on long utterances), and waits 60 ms after a cancel (Chrome drops a `speak()` right after `cancel()`).
- Volume: perceptual(master) × perceptual(voice volume), the utterance's `volume`. Speech synthesis does not pass
  through the AudioDirector's WebAudio graph: the compressor and the dialogue duck do not apply to it.
- Push-to-talk (`voice/listen.ts`, `world/MicButton.tsx`): Web Speech `SpeechRecognition` (en-US, continuous,
  interim results). With "Speak to NPCs" on and a browser that has it, a mic button sits in the DialogueBox (people
  only, not signs) and in the buddy talk; hold it, or the new `pushToTalk` binding (backquote: free in the world and
  types nothing a player needs; caught before the talk field while the button is up, types normally otherwise), to
  speak: the field opens and fills with the live words, release sends them as the typed line (a reply still on its
  way leaves them in the field for Enter). A tap under 250 ms sends nothing; a hold is released after 20 s; a
  recognizer that ends by itself while held leaves the words unsent. Errors: blocked mic, no mic, no service (Brave,
  offline) show a note under the button; pressing again retries; nothing starts the mic but a press. No recognition
  (Firefox): no button, the setting disabled with a line saying so. Typed chat is unchanged.
- The earlier speech input (MediaRecorder → whisper.cpp, removed 2026-10-22 as too slow) is not revived: the browser's
  recognizer streams and answers within the hold, at the cost of sending the audio to its maker's service, which the
  setting says plainly.
- Live check (alt2 pair, headless Chrome 155 on Windows, the docker model): the real voice list held only Google
  network voices plus one local voice, "Microsoft Frank" (nl-NL), so with NPC voices on the reply was spoken in that
  Dutch voice (no English local voice: any local one), never a Google one. With a stand-in local voice spied on, a
  four-sentence reply was spoken sentence by sentence while it streamed (first sentence 1.7 s before the reply was
  in), the buddy's greeting in three sentences at a higher pitch, and closing the dialogue after the first sentence
  cancelled it and spoke nothing more. The mic button pressed in headless Chrome (no microphone, no permission)
  turned to "Mic blocked" with its note; the field stayed usable. Not verified: real audio output, a real microphone,
  Google's recognition returning words (no mic in headless Chrome), Safari / Firefox.
- Tests: `test/voice-speech.test.ts` (tidying, sentence chunks, voice picking, the speaker's queue and interruptions,
  gating, the binding to the stores), `test/voice-listen.test.ts` (the push-to-talk machine with a fake recognizer),
  `test/voice-mic.test.tsx` (the mic button's states in the DialogueBox and the buddy talk, the key, the settings
  section).

## The Elemutt line in the client (2026-10-25)

- `battleSpriteIds` preloads every battle form (`formsOf`), and `descriptor` takes a form sprite's types from the
  matching form, so ravatar's five relic forms show their own sprite and types. `FORM_AURA.avatar` is `tenjin`: the
  Avatar State shines; the four elemental forms carry their element in the art itself and get no aura (Majin's
  crimson flames would fight the water, stone and wind).
- The battle menu resolves a slot through core `formMove`, so Cosmic Convergence reads (and is scored against the
  foe as) Water in Water Form, Ground in Earth Form, Psychic in the Avatar State.
- The dex shows a "Relic forms" section: each form, the relic it needs (and the Avatar State's hp line) and its types.
- Cosmic Convergence: a `convergence` sigfx layer (four element orbs wheel in and fuse, the sphere crosses on its trail,
  a flash and four element rings), portrait `ravatar`, premix `sig_cosmic_convergence`, move style `orb`. The
  signature test now asks a signature of every fully evolved legendary / mythical (the Elemutt line's is ravatar's).
  `spriteCatalog.test` lists the line with hyoryu as stills.

## Relic forms outside a battle (2026-10-25)

- Giving ravatar a relic changes its form at once, outside a battle too. Nothing is stored: `wornForm(c)` (core
  `heldForm`) derives it from the held item, so every view follows the party store as the setup response lands.
  `CreatureSprite` takes `form` (the `<species>_<form>` thumb, falling back to the species' own), and the creature
  card, party lineup, creature detail (types, a form pill, atk / def / spd through `statsOf`), the bag's party picker,
  the HUD party strip (`partyStrip`) and the field-power chip all show the worn form. `typesOf(c)` is the types they show.
- The follower reads the form from `leadFlags` bits 5..7 (`followerSprite`) and draws that manifest entry; the zone
  load preloads a worn form's atlas with the party's. The chip's powers come from the form's types (content `leadLook`,
  the same rule as the server's lead): Water dives, Earth digs, Fire lights, Air glides. The Vial's Avatar State keeps
  its hp line and opens only in a battle. The setup action toasts "Ravatar took its Fire Form." / "returned to its own
  form." when the form changed.
- Live check (alt pair, headless Chrome, an act3c account with ravatar leading): Save setup with each relic switched
  the party card, detail, HUD strip, chip and the follower (`debug().followers.selfSprite` `ravatar_fire` /
  `ravatar_water` / `ravatar`) and the chip's power (Light / Dive / none) without a reload; a fresh page load came up
  in the held form. Battles are unchanged.
- Tests: `test/relics.test.tsx` (worn form, types, stats, the card), `test/followers.test.tsx` (follower sprite and
  descriptor types, the strip, the chip lead's form and powers).

## The Dex upgrade (2026-10-26)

- `data/dexInfo.ts` holds what an entry shows, from content alone: habitats per zone (merged slots: level range,
  day / night, land / water, tier, alpha), the other ways to get a species, the evolution tree with a condition per edge
  (`evoLabel`, `evoSentence`), defensive matchups, level-up / TM / tutor learnsets and `dexAccess` (what a seen,
  recorded or researched entry opens). The professor's matchup lookups moved here.
- Deviation from §20.9.5 before this change: an open entry folds the 6-column grid into a 280 px rail of rows beside
  a wide entry (a 380 px aside had no room for tabs); the header shrinks to one line while an entry is open, and the
  ecosystem board hides then.
- Filters, sort, density, view, tab and compare all live in the URL (`screens/dex/dexList.ts` reads them); the stamp
  look is a per-device choice in localStorage (`state/dexPrefs.ts`). Research data is optional: without `research`
  from GET /dex a recorded entry shows everything but the gold frame, and the Research tab, research sort / filter and
  the Rewards view hide.
- Listen (`audio/dexVoice.ts`) plays the first type's cry through a plain audio element (the AudioDirector is private
  to World3D) and reads the entry with its own speaker; it ignores the NPC-voices toggle (a press is the player asking)
  but not master / voices at 0.
- Reveal moments read `entries[id].viewedAt` against `seenAt` / `caughtAt` (`screens/dex/reveal.ts`) and post
  `/dex/viewed` once per opening.
- jsdom: a test that navigates with `setSearchParams` needs the `Request` patch the other router tests use (jsdom's
  AbortSignal is not undici's); without it the navigation is dropped silently.
- Live check: the alt pair with an act3c account holding every species and an act2 account; screenshots of tiles,
  list, every entry tab (dustcub's split, hyoryu's Majin Form, ravatar's relic forms, a seen-only gated entry), the
  habitat atlas, compare, and the rewards view.

## Load time and Docker CPU (2026-10-25)

- `World3D.prepareBootZone` (`createRenderer`'s `beforeWarmUp`): prepares the zone the player will enter
  (`roomZone ?? session zoneId`, which `/me` fills before `PlayShell` mounts) with `eager: true` during the boot shader
  compile. The spec is `withNeighbours(zoneSpecFor(z, harvestStateFor(id, flags)), z)`, what `SceneDirector.doLoad`
  builds, so `loadZone` adopts it (`sameZone`: id, seed, harvest level). Focus is the room's player position if known,
  else the zone spawn (doLoad's own fallback); it only steers the eager first-view compile. Skipped in an arena or
  without progression. Device-loss recovery runs it again.
- Harness: `?bootprep=1` (`HarnessWorld.bootPrepare`) for A/B: compare `?zone=mirevale&bg=1` with `…&bg=1&bootprep=1`,
  reading `renderer ready` and `zone mirevale loaded`, alternating runs.
- Docker dev watchers: `tsx watch` polls at `CHOKIDAR_INTERVAL` 1000 ms (was chokidar's 100 ms, ~55 % of a core); Vite
  polls sources every 1000 ms (was 300 ms, ~40 %) and no longer polls `public/` (an edited asset needs a page reload, a
  new one `docker compose restart client`). Apply the compose change with `docker compose up -d server`.

## astaroth and the Sunken Crypt in the client (2026-10-26)

- `zoneSpecFor` adds the zone's hideout buildings (content `hideoutsFor` → `hideoutBuilding`) after the plan's, for
  the zone and its neighbours' skirts.
- `LegendaryViews`: a static that waits in a hall (`LegendaryStatic.interior`) shows its card only while the player
  stands in that hall (halls are roofless; a 1.5-scale legendary would otherwise show over the wall).
- Demon Lord's Descent cinematic (`battle/sigfx/Descent.tsx`): Astaroth dissolves into smoke, its eyes flare, a
  five-leaf clover sigil draws under the foe with a crimson pillar, it drops with both blades and leaves an X (stone
  greatsword arc, red katana arc), red cracks, a black shockwave and black feathers. Lead 1100, windup 640, travel
  300 (impact at 2040), total 3200 ms; premix `sig_demon_lords_descent`; portrait `public/signature/astaroth.webp`.

## True creature heights (2026-10-27)

- The sprite catalog passes `heightM` (the form's when the battle form names one, else the species') and the manifest's
  per-side `bodyV` to the renderer; a stray manifest entry no species names falls back to its legacy `sizeScale` × 1.376 m.
- The dex entry shows the height next to the rarity (the viewed form's, × 1.12 for an Alpha).
- A creature's voice pitch follows `heightM` (0.3 m squeaks at 1.6, 3 m and taller rumbles at 0.6).
- The raid den's boss is 1.8 × its true height.
- `BACK_FULL_HEIGHT` (astaroth): the species' back stands its full height although its art is drawn wider than the
  front, at the user's call (2026-10-27); every other back keeps the front's scale when it is wider.

## Animated followers (2026-10-27)

- A lead with flipbooks (the 11 animated legendaries / mythicals) plays them while it follows, front and back
  (`FollowerViews.stepFlipbooks`, per frame from `stepFollowers`). Until now a follower held only its static atlas
  (`'still'`), so no creature's back ever moved outside a battle.
- One side at a time: the follower leases the flipbook of the side its card faces (`show(…, side, 'flipbook')`). A turn
  moves the lease only once the card has faced the new side for `FOLLOWER_FLIP_SETTLE_MS` = 1.2 s (live, a player
  pushing against a wall flipped the card several times a second, and each flip swapped a 48 MiB flipbook); the new
  side shows its static frame meanwhile. The new side's lease comes before the old one goes; the old side idles through
  the grace period, so turning round again soon costs no upload when the budget has room for both. A card whose
  flipbook is not bound yet shows its static frame and re-points once.
- The zone's phase-3 hold is now two holds: the zone's static set (firm) and the party's static atlases (`partyHold`, a
  reserve hold like a battle's teams). Live in an Act I zone the two held 12 sheets, 383 of the 400 MiB budget, so no
  flipbook fit and the guard refused the follower's; now a shown flipbook parks a benched party member's sheet (never
  one a billboard samples, the follower's own is a firm hold) and the sheet rebinds once bytes free up.
- At most `FOLLOWER_FLIPBOOKS` = 3 followers animate (the player's own, then the nearest by the 2 Hz `sync` order); the
  rest keep their static frame. A hidden follower lets its flipbook go, and so does every follower while the player's
  own is hidden (battle, arena, evolution, a walk-up, a hall), so no follower flipbook competes with a battle's or parks
  a battle's reserve atlases. The budget guard may still refuse one (static frame, retried as bytes free up).
- Test: `test/followers.test.tsx` (the side it faces, the settle delay, the cap, hidden and paused).

## Graphics: dynamic resolution, detail 'auto', graphics API (2026-10-27, not in the SPEC)

- `scene/dynamicResolution.ts`: steps the render scale through 1 / 0.85 / 0.75 / 0.65 / 0.55 from the interval between
  drawn frames (30-frame windows, budget 1000 / 60, or / 30 under the 30 cap). Down when a window is 12 % over budget
  and the tick's main thread used under 80 % of it (a CPU-bound frame keeps its resolution); up after 2.5 s of good
  windows, the wait doubling (to 40 s) when a step up is undone within 4 s. Settings › Graphics › Dynamic resolution,
  default on. Applied with the render scale through `Renderer.setResolutionScale` (after the preset's pixel-ratio cap).
- `graphics.detailDistance` gains `'auto'` (default): medium on the `low` preset, else max. Settings persist v2 migrates a
  stored `'max'` (the old default) to `'auto'`.
- Settings › Graphics shows the graphics API (WebGPU / WebGL 2.0) and the adapter, from `useUiStore.renderApi` written
  when the renderer boots.
- WebGL2 context loss goes through the E6 `DeviceRecovery` too. three's `dispose` calls `WEBGL_lose_context.loseContext()`
  (async, after its other cleanup), so before a rebuild `restoreWebGLContext` waits 250 ms, then calls `restoreContext()`
  on the extension taken at boot and waits for `webglcontextrestored` (max 5 s). Checked headless (Chrome on macOS,
  WebGPU hidden): a forced loss in Tide Route rebuilt and reloaded the zone, no failed attempt.
- Dynamic resolution is forced off on the WebGL2 fallback (`dynamicResolutionOn`; the setting shows disabled there): in a
  playtest on an Intel iGPU under WebGL2 the context kept getting lost after opening a menu, and the resolution steps
  (every render target re-created) are the suspect.

## The dex moves (2026-10-27)

- `CreatureSprite animated`: where the sprite's front plays a flipbook (manifest `sprites[id].anim.front`, the 11
  animated legendaries / mythicals), the image is `public/dex-anim/<id>.webp`, a looping animated WebP cut from that
  flipbook (sprite pipeline `dex-anim`), in place of the still thumb. Never for a silhouette; a form without a flipbook
  (zenryu's Majin form) keeps its own still; a file that fails to load falls back to the still.
- `data/thumbs.ts` reads the animated set from the manifest it already fetches (`animatedFronts`,
  `useAnimatedThumbSet`, `animatedThumbUrl`).
- The dex passes `animated` on the entry's hero, its evolution chain and forms card, the tiles, the list rows and the
  compare cards. Everywhere else (party, HUD, battle menus) keeps the still.
- Live (the isolated dev pair, headless Chrome): all 11 entries load their animated file and six screenshots of the
  hero 250 ms apart differ every time. Test: `test/dexAnim.test.tsx` (every animated front has its file with one page
  per flipbook page, still species have none; the component's choices and its fallback).
