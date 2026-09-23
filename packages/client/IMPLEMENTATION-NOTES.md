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
