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
