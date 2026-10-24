# EWAMON REMASTERED — SPEC §20: @ewa/client

**Status:** BINDING, subordinate to `00-spine.md`. This file codes against the spine's interfaces (`BattleEvent`, `BattleState`, `ServerMessage`, `CLIENT_MESSAGES`, `ZoneState`, `ZoneDef`, REST table §4.7) and never redefines them. It names render-side symbols (`createRenderer`, `ZoneSpec`, `BattleStage`, `HudLayer`, `CameraRig`) that `10-render.md` owns; §20.4.1 lists the exact surface the client consumes so the reconciler can check the two files agree.

Inputs: `00-spine.md`; `PLAN.md` (UI/UX, multiplayer, combat presentation paragraphs); `eslint.config.js` (`ewa/client` block: the client may import `@ewa/core`, `@ewa/content`, `@ewa/protocol`, `@ewa/render`, `react`, `react-dom`, `react-router`, `zustand`, `@colyseus/sdk`, `@colyseus/schema`; never `@ewa/server`, `@ewa/persist`, `colyseus`, `@colyseus/core`, `pg`, `drizzle-orm`, node builtins). Every library name below was read from `packages/client/node_modules`:

- `react-router` (the lockfile resolves **7.18.4**, re-verified 2026-09-25; the symbols below are unchanged since 7.9) (`dist/development/index.d.mts`): `createBrowserRouter`, `RouterProvider`, `Outlet`, `Link`, `NavLink`, `useLoaderData`, `useRouteLoaderData`, `useFetcher`, `useBlocker`, `useNavigation`, `useNavigate`, `useSearchParams`, `useRouteError`, `isRouteErrorResponse`, `redirect`, `data`, `RouteObject` (with `loader`, `action`, `lazy`, `HydrateFallback` / `hydrateFallbackElement`, `shouldRevalidate`), `LoaderFunctionArgs`, `ActionFunctionArgs`, `ShouldRevalidateFunction`.
- `@colyseus/sdk 0.18.2` (`build/Client.d.ts`, `build/Room.d.ts`, `build/index.d.ts`): `Client` (`joinOrCreate`, `joinById`, `reconnect(reconnectionToken)`, `consumeSeatReservation(reservation)`), `Room` (`state`, `sessionId`, `roomId`, `reconnectionToken`, `onStateChange`, `onMessage(type, cb): () => void`, `send(type, payload)`, `onLeave`, `onError`, `onDrop`, `onReconnect`, `leave(consented)`, `removeAllListeners()`), `getStateCallbacks(room)` returning `SchemaCallbackProxy<T>` with `listen` / `onAdd` / `onRemove` / `onChange`.
- `zustand 5` (`vanilla.d.ts`, `react.d.ts`, `middleware/*.d.ts`): `create`, `createStore`, `useStore`, `useShallow`, `persist` + `createJSONStorage`, `subscribeWithSelector`.
- `react 19.2` (`@types/react`): `useSyncExternalStore`, `useTransition`, `useId`; `react-dom/client`: `createRoot`.
- `vite 7.3`: CSS Modules are built in (`*.module.css`), no plugin.

---

## §20.0 THE FIVE RULES OF THE CLIENT

1. **The canvas is mounted once per session and never by a route.** `GameCanvas` lives in the `/play` layout element; every `/play/*` child renders through `<Outlet/>` beside it. No route transition, loader, error boundary or Suspense boundary sits above the canvas.
2. **Two kinds of state, two owners.** Replicated world state is `room.state` (Colyseus schema) and is read in place; UI state is four Zustand stores. Nothing from `room.state` is copied into a store except a derived scalar for a menu (§20.3.3).
3. **Progression has one writer per slice.** `applyProgressionDelta` and `applyInventoryDelta` in `session.ts` are the only functions that assign badges, trainer exp, rating, dex, flags, quests, items, money, party or box. `hydrateFromMe` runs once at session start. A `BattleEvent` never writes state.
4. **The 60 Hz path is React-free and allocation-free.** Input, prediction, remote interpolation, the timeline player, the HUD writer and the audio director run inside `World3D.tick` (§20.4) and touch no React state, no `setState`, no `new`.
5. **Accessibility always wins.** The effective reduced-effects flag (§20.8.2) removes grain, chromatic aberration, camera shake, hitstop, slow-motion and DOF regardless of any other setting, and `resolveTurn` output is unaffected (spine Pillar 8 test).

---

## §20.1 APP SHELL AND ROUTES

### 20.1.1 Route table

`packages/client/src/app/router.tsx` builds one `createBrowserRouter` (through `createAppRouter()`) and `main.tsx` mounts `<RouterProvider router={createAppRouter()}/>` under `createRoot(document.getElementById('root')!)`. No `<BrowserRouter>`, no `<Routes>` tree, no React Router framework mode.

| Path | Element | Loader (REST, spine §4.7) | Notes |
|---|---|---|---|
| `/` | `LandingPage` | — | Redirects to `/play` when a refresh token exists |
| `/login` | `AuthScreen mode="login"` | — | `action`: `POST /auth/login` |
| `/register` | `AuthScreen mode="register"` | — | `action`: `POST /auth/register` |
| `/forgot` | `ForgotScreen` (Phase C6) | — | `action`: `POST /auth/forgot`; always the same "if an account uses it, a link is on its way" confirmation |
| `/reset?token=` | `ResetScreen` (Phase C6) | — | `action`: `POST /auth/reset` (new password twice); success ends this browser's session (the server revoked every refresh token) |
| `/verify?token=` | `VerifyScreen` (Phase C6) | `POST /auth/verify` once per navigation | confirmed / `badToken` reason; never gates play |
| `/play` | `PlayShell` (layout: `GameCanvas` + `Outlet` + `NotificationHost`) | `requireSession()` → `GET /me` | `shouldRevalidate: () => false`; `hydrateFallbackElement: <BootScreen/>` |
| `/play/party` | `PartyScreen` | none (reads store) | actions via `useFetcher` |
| `/play/box` | `BoxScreen` | none (reads store; box pages from `/me`) | |
| `/play/dex` | `DexScreen` | `GET /dex` | URL state: `?q=&type=&caught=` |
| `/play/shop` | `ShopScreen` | `GET /shop/:zoneId` (zoneId from `useSessionStore.getState().zoneId`) | 404 from server when the zone has no shop (30-server-netcode.md §30.6.3) → "There is no shop here" state <!-- reconciled 2026-09-18: was 403 --> |
| `/play/social` | `SocialScreen` | `GET /friends` | `?dm=<username>` opens a thread; thread loader `GET /messages/:username?limit=50` |
| `/play/guild` | `GuildScreen` | `GET /guilds/:id` or `GET /guilds?search=` | |
| `/play/market` | `MarketScreen` | `GET /marketplace?<request.url searchParams>` | every filter is a URL param; back button restores it |
| `/play/pass` | `BattlePassScreen` | `GET /battle-pass` | |
| `/play/settings` | `SettingsScreen` | none | |
| `/admin` | `AdminScreen` | `GET /admin/stats` | 403 → `redirect('/play')` |

The battle UI is **not** a route. It is a `BattleOverlay` rendered by `PlayShell` whenever `useUiStore(s => s.battle !== null)`; the URL stays on whatever `/play/*` the player was on, and opening a `/play/*` panel during a battle is blocked (§20.1.3).

```ts
// packages/client/src/app/router.tsx — the shape, verbatim; element components live in src/screens/*
import { createBrowserRouter, redirect } from 'react-router';
import type { LoaderFunctionArgs, RouteObject } from 'react-router';

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage/>, loader: () => (hasRefreshToken() ? redirect('/play') : null) },
  { path: '/login', element: <AuthScreen mode="login"/>, action: loginAction },
  { path: '/register', element: <AuthScreen mode="register"/>, action: registerAction },
  {
    path: '/play',
    element: <PlayShell/>,
    loader: playLoader,                       // requireSession() then GET /me then hydrateFromMe()
    shouldRevalidate: () => false,            // the canvas layout never re-runs its loader on child navigation
    hydrateFallbackElement: <BootScreen/>,    // shown only before the FIRST /me resolves
    errorElement: <PlayError/>,               // renders INSIDE PlayShell's chrome; the canvas is not a child of this boundary
    children: [
      { path: 'party', element: <PartyScreen/> },
      { path: 'box', element: <BoxScreen/> },
      { path: 'dex', element: <DexScreen/>, loader: dexLoader },
      { path: 'shop', element: <ShopScreen/>, loader: shopLoader },
      { path: 'social', element: <SocialScreen/>, loader: friendsLoader,
        children: [{ path: ':username', element: <DmThread/>, loader: dmLoader }] },
      { path: 'guild', element: <GuildScreen/>, loader: guildLoader },
      { path: 'market', element: <MarketScreen/>, loader: marketLoader,
        children: [{ path: ':listingId', element: <ListingDetail/>, loader: listingLoader }] },
      { path: 'pass', element: <BattlePassScreen/>, loader: battlePassLoader },
      { path: 'settings', element: <SettingsScreen/> },
    ],
  },
  { path: '/admin', element: <AdminScreen/>, loader: adminLoader },
  { path: '*', loader: () => redirect('/play') },
];
/** Called once by main.ts. A module-level `createBrowserRouter(routes)` would start a browser router in every test that imports `routes` (amended 2026-09-25, client IMPLEMENTATION-NOTES D1). */
export function createAppRouter(): ReturnType<typeof createBrowserRouter>;
```

`PlayError` is the `errorElement` of `/play`, but `GameCanvas` is rendered by `PlayShell`, which is the route *element*; when the element throws, React Router swaps element for errorElement. To keep rule 1 true under an error, `PlayShell` is split: `PlayShell = <CanvasHost/> + <PanelHost/>`, where `CanvasHost` is rendered by a **parent pathless layout route** with no loader and no errorElement, and `/play`'s element/errorElement only own `PanelHost`. Concretely the `/play` entry above is wrapped: `{ element: <CanvasHost/>, children: [ { path: '/play', … } ] }`. The canvas therefore survives loader errors, child errors and 401 redirects to `/login` (the pathless layout matches `/play*` only; `/login` unmounts it — logging out is the one legal canvas unmount).

### 20.1.2 Loaders, actions, `apiFetch`

```ts
// packages/client/src/net/api.ts
export interface ApiError { readonly status: number; readonly code: string; readonly detail: string | null }
export class ApiFailure extends Error { constructor(readonly error: ApiError) { super(error.code); } }

/**
 * fetch() wrapper for spine §4.7. Base URL from import.meta.env.VITE_API_URL (default '/api').
 * - Adds `Authorization: Bearer <access>` from useSessionStore.getState().accessToken.
 * - On 401 with a refresh token: POST /auth/refresh ONCE, store the rotated pair, retry ONCE. A second 401 → clearSession() and throw.
 * - Parses the response with the zod schema named in @ewa/protocol/rest for that route; a parse failure is ApiFailure { status: 0, code: 'badResponse' }.
 * - Timeout 10_000 ms via AbortSignal.timeout; network error → { status: 0, code: 'network' }.
 * - Concurrent refreshes are coalesced: one in-flight refresh promise, shared.
 */
export function apiFetch<K extends RouteKey>(key: K, init?: ApiInit<K>): Promise<RouteResponse<K>>;   // routes addressed by @ewa/protocol's RouteKey (the typed ROUTES table); ApiInit = { body?, params? (path), query?, signal? } — amended 2026-09-25: `RestRoute<T>` was defined nowhere (client IMPLEMENTATION-NOTES D2)

/** Loader helper: throws redirect('/login?next=<pathname>') when there is no refresh token; otherwise resolves the access token (refreshing if expired). */
export function requireSession(request: Request): Promise<void>;
```

Refresh token storage: `localStorage['ewa.refresh.v1']` (opaque string). Access token: memory only (`useSessionStore`), expiry decoded from the JWT `exp` claim and refreshed 60 s early by a timer in `SessionKeeper`. On `storage` events for the refresh key from another tab (logout elsewhere), `clearSession()` runs here too.

Actions: mutations from screens go through `useFetcher()` with `fetcher.submit(payload, { method: 'post', encType: 'application/json', action: '/play/<screen>' })`; the route's `action` reads `await request.json()`, calls `apiFetch`, then maps the response into `applyInventoryDelta` / `applyProgressionDelta` (§20.3.2) and returns `data(result)` or `data({ error }, { status })`. Screens render `fetcher.state === 'submitting'` as the pressed/disabled button state (§20.2.5), never as a spinner overlay.

### 20.1.3 No blocking transitions

- No route element is wrapped in `<Suspense>` that covers the canvas. Panels may use `useNavigation().state === 'loading'` to render their own `Skeleton` (§20.9.13) for at most the loader's duration.
- Panel open/close is a 160 ms opacity + 8 px translate (§20.2.6 `--motion-panel`), CSS-only, on the panel element. The old 900 ms clip-path transition does not exist.
- Loader budget: a `/play/*` loader must resolve in ≤ 400 ms p95 on the slice (server-side p95 ≤ 150 ms + network). Above 400 ms the skeleton shows; there is no other intermediate state.
- `useBlocker` is used in exactly two places: (a) `BattleOverlay` blocks navigation away from `/play/*` while `ui.battle !== null` and shows the "Finish the battle first" toast; (b) `TradeModal` blocks while a trade is `open`/`confirming`. Nothing else blocks.
- Back button: every filter, tab and selected item that survives a reload is a URL param (`?tab=`, `?q=`, `/market/:listingId`). Modal open state is not URL state.

---

## §20.2 DESIGN SYSTEM

### 20.2.1 Styling technology: CSS Modules

**Decision: CSS Modules (`*.module.css`), not vanilla-extract.** Reasons, each checkable: (1) Vite 7 compiles CSS Modules with zero additional dependencies; vanilla-extract is not in `node_modules` and would add a Vite plugin plus build-time TS evaluation for every style file. (2) Tokens must be readable by the canvas HUD as numbers (§20.6) and by CSS as custom properties; a JSON source compiled to both is simpler than a TS-first system whose output is CSS only. (3) Class-name typing is provided by a checked-in `src/ui/css-modules.d.ts` (`declare module '*.module.css' { const c: Readonly<Record<string, string>>; export default c }`) plus the `typecheck` script; no generated `.d.ts` per file.

**Zero inline styles.** A local ESLint rule `ewa/no-inline-style` is added to `eslint/local-rules.js` and enabled for `packages/client/src/**`: it reports any JSX `style` attribute, any `element.style.cssText = …`, and any `element.setAttribute('style', …)`. The single exception is `style={cssVars({ '--hp': 0.42 })}` where `cssVars` (in `src/ui/cssVars.ts`) accepts only keys beginning with `--`; the rule checks the callee name. Dynamic values (HP width, progress, sprite palette) flow through custom properties consumed by module CSS. Tests: the rule's vitest file has one passing and three failing fixtures.

### 20.2.2 Tokens — the one set

Source of truth: `packages/client/src/ui/tokens.json`. `pnpm --filter @ewa/client tokens` (a 60-line script, `src/ui/gen-tokens.ts`) emits `tokens.css` (custom properties on `:root`) and `tokens.ts` (typed constants for the HUD and the timeline). Both generated files are committed; CI fails if regenerating changes them.

**Colour** — amended 2026-10-11 (the Broadcast UI; client IMPLEMENTATION-NOTES "Broadcast UI"): the user rejected the grove-green palette and chose the "Broadcast" direction from three mockups. Neutrals are near-black carbon greys with a paper white; **one** accent, a hot orange, means only "selected / press this / focus" — never status or decoration. A creature's type colour is the hero of any card about it. HP high is paper (no green). <!-- amended 2026-10-11: Broadcast UI -->

| Token | Value | Use | Contrast note |
|---|---|---|---|
| `--bg-0` | `#0d0d0f` | page ground behind the canvas, modal scrim base, key-chip ink | |
| `--bg-1` | `#18181c` | panel surface | |
| `--bg-2` | `#202025` | card surface on a panel | |
| `--bg-3` | `#2a2a31` | hover / raised surface, bar tracks | |
| `--line-1` | `#2e2e35` | hairlines, dividers | |
| `--line-2` | `#4a4a54` | hover hairline | |
| `--text-hi` | `#f5f3ee` | headings, values, key chips | 16.0:1 on `--bg-1` |
| `--text-1` | `#d6d4ce` | body | 11.9:1 on `--bg-1` |
| `--text-2` | `#a3a3ad` | captions, labels | 7.1:1 on `--bg-1` (≥ 4.5 required at 12 px) |
| `--accent` | `#ff5b1f` | selected / primary action / focus — nothing else | 5.7:1 on `--bg-1` |
| `--accent-hi` | `#ff7a45` | primary hover | |
| `--on-accent` | `#0d0d0f` | text on accent | 6.3:1 |
| `--warn` | `#ffb020` | caution, low PP | |
| `--danger` | `#ff4b3e` | destructive, HP < 20 % | |
| `--info` | `#7cb7ff` | neutral notices | |
| `--hp-hi` / `--hp-mid` / `--hp-lo` | `#f5f3ee` / `#ffb020` / `#ff4b3e` | HP bar at > 50 % / 20–50 % / < 20 % | |
| `--scrim` | `rgb(13 13 15 / 0.76)` | behind modals | |

Type colours (19, in `TYPE_NAMES` order) are **one table**, `10-render.md` §10.4.6 `typeColors.ts` (the legacy `TYPE_COLORS`), copied verbatim into `tokens.json` `typeColors.default` and asserted equal by `design-system.test.ts`: Normal `#a8a290`, Fire `#ee6f4a`, Water `#4aa3d6`, Grass `#6fae5a`, Electric `#f4cf3f`, Ice `#8fd6e8`, Fighting `#c0492f`, Poison `#9a5bb0`, Ground `#c9a24a`, Flying `#8aa6e0`, Psychic `#e06fa0`, Bug `#9aa83a`, Rock `#b09a6f`, Ghost `#6a5b9a`, Dragon `#6a52d0`, Steel `#9aa6b0`, Fairy `#f0a6d0`, Dark `#5b4b66`, Cosmic `#7be0d0`. Used by `TypeBadge`, the sprite rim light and the gym beacons, so a type reads the same in the DOM and in the world. Colourblind palettes in §20.8.3 override this table (and are passed to render through `stage.setTypeColors`); the badge always carries its type icon (amended 2026-10-11: 19 stroke icons in `ui/typeIcons.ts`, the same table render's battle plates draw — the 2-letter glyphs are gone at the user's request), so colour is never the only signal. <!-- reconciled 2026-09-18: this file carried a second, different hex table -->

**Space** (px): `--s-1 2`, `--s-2 4`, `--s-3 8`, `--s-4 12`, `--s-5 16`, `--s-6 24`, `--s-7 32`, `--s-8 48`, `--s-9 64`. Nothing else is permitted as a margin/padding/gap value.

**Radius** (amended 2026-10-11, Broadcast: hard edges): `--r-1 2` (inputs, badges), `--r-2 2` (cards, buttons), `--r-3 2` (panels, modals), `--r-pill 999` (true circles and dots only). Buttons, tabs, HP and progress bars slant 12° (`skewX(-12deg)`; a button's slab is its `::before`, so the label and the focus ring stay upright).

**Type scale** (px / line-height), all in `rem` at the 16 px root and multiplied by `--ui-scale` (§20.8.4):

| Token | Size | Line | Face | Use |
|---|---|---|---|---|
| `--t-caption` | 12 | 16 | text | labels, table headers, timestamps — **the minimum anywhere** |
| `--t-body` | 14 | 20 | text | default body — **the minimum for running text** |
| `--t-body-lg` | 16 | 24 | text | dialogue, descriptions |
| `--t-h3` | 20 | 28 | display | card titles |
| `--t-h2` | 24 | 32 | display | panel titles |
| `--t-h1` | 32 | 40 | display | screen titles |
| `--t-display` | 48 | 56 | display | zone banner, battle result, panel titles (amended 2026-10-11) |
| `--t-hero` | 64 | 64 | display | the one big number or name of a screen (amended 2026-10-11) |
| `--t-mono` | 14 | 20 | mono | numbers in tables, seeds, digests, admin |

Number columns use `font-variant-numeric: tabular-nums`. No text below 12 px exists; the ESLint rule cannot see CSS, so `gen-tokens.ts` also greps `src/**/*.module.css` for `font-size` values not equal to a `--t-*` token and fails.

**Fonts** — three families, all SIL Open Font License 1.1, self-hosted as `woff2` in `packages/client/public/fonts/` (latin + latin-ext subsets only, split by `unicode-range`), declared with `@font-face` in `fonts.css` with `font-display: swap`; the latin files are preloaded (`vite.config.ts` injects `<link rel="preload" as="font" type="font/woff2" crossorigin>`), latin-ext loads on demand. Amended 2026-10-11 (Broadcast UI): the display face is Barlow Condensed (names, titles, labels, numbers and buttons set uppercase, 800 italic for the big moments), the text face Barlow; both are static cuts, 223 KB for the 12 files.

| Role | Family | File | Fallback stack |
|---|---|---|---|
| display | **Barlow Condensed** (700, 800, 800 italic) | `BarlowCondensed-<w>-<subset>.woff2` | `'Barlow Condensed', 'Bahnschrift Condensed', 'Arial Narrow', sans-serif` |
| text | **Barlow** (400, 500, 700) | `Barlow-<w>-<subset>.woff2` | `Barlow, 'Segoe UI', system-ui, sans-serif` |
| mono | **JetBrains Mono** (variable, wght 100–800) | `JetBrainsMono[wght].woff2` | `'JetBrains Mono', Consolas, monospace` |

Total ≤ 360 KB. `HudLayer` (§20.6) draws with the same families; `AudioDirector`-independent boot waits on `document.fonts.load('14px Inter')` and `document.fonts.load('24px "Bricolage Grotesque"')` before the first HUD draw (cap 1 000 ms, then draw with fallbacks). Since 2026-10-11 those loads name the token families (`14px Barlow`, `24px "Barlow Condensed"`).

**Motion tokens**: `--motion-fast 80ms`, `--motion-ui 160ms`, `--motion-panel 160ms`, `--motion-slow 240ms`, `--motion-banner 400ms`; easings `--ease-out cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-in-out cubic-bezier(0.65, 0, 0.35, 1)`. Under effective reduced motion every `--motion-*` is `0ms` (set on `:root[data-reduced="1"]`).

**Interaction scales**: hover `transform: scale(1.05)`, press `scale(0.95)`, both over `--motion-fast`, applied by `Button`, `CreatureCard`, `MoveButton`, `Tabs` triggers only — except the battle deck's `MoveButton size="lg"` cards, which lift 8 px with a 6 px `--accent` bar under them on hover/focus (1.05 would make the four cards overlap). Focus: 2 px `--accent` ring at 2 px offset, `:focus-visible` only; on slanted slabs (the battle rail, the top bar's active item) the ring would be cut by the slant, so focus shows as the `--accent` bar or an inset ring instead. <!-- amended 2026-10-11: Broadcast UI -->

### 20.2.3 Layout targets

Designed at **2560×1440**; minimum supported **1280×720**. Panels are anchored, not full-screen: a `/play/*` panel is `min(1120px, 100vw - 2*var(--s-7))` wide, right-aligned, full height minus a `--s-6` inset, so the world stays visible on the left. Below 1280 px width the app renders `UnsupportedViewport` (a static message) — desktop only per `PLAN.md`; no responsive breakpoints exist.

### 20.2.4 Component inventory — `packages/client/src/ui/*`

Every component is a function component with a `.module.css` beside it, forwards `className`, and has a `data-testid` equal to its name in lowercase. Props are verbatim:

```ts
import type { ReactNode } from 'react';
import type { TypeName, StatusId, CreatureInstance, MoveDef } from '@ewa/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export interface ButtonProps {
  readonly variant?: ButtonVariant;           // default 'secondary'
  readonly size?: 'sm' | 'md' | 'lg';         // heights 28 / 36 / 44 px
  readonly disabled?: boolean;
  readonly busy?: boolean;                    // fetcher.state === 'submitting': keeps width, shows a 3-dot mark, disables
  readonly onClick?: () => void;
  readonly type?: 'button' | 'submit';
  readonly children: ReactNode;
  readonly className?: string;
}
export interface CardProps { readonly selected?: boolean; readonly interactive?: boolean; readonly onClick?: () => void; readonly children: ReactNode; readonly className?: string }
export interface PanelProps { readonly title: string; readonly subtitle?: string; readonly actions?: ReactNode; readonly onClose?: () => void; readonly children: ReactNode; readonly className?: string }
export interface TabsProps<K extends string> {
  readonly tabs: readonly { readonly key: K; readonly label: string; readonly count?: number }[];
  readonly value: K;
  readonly onChange: (k: K) => void;          // callers bind this to a ?tab= search param
}
export interface ModalProps {
  readonly open: boolean; readonly title: string; readonly onClose: () => void;
  readonly size?: 'sm' | 'md' | 'lg';          // widths 420 / 640 / 920 px
  readonly children: ReactNode; readonly footer?: ReactNode;
}
export interface ToastProps { readonly id: string; readonly level: 'info' | 'success' | 'warn' | 'danger'; readonly text: string; readonly ttlMs: number }
export interface HpBarProps { readonly hp: number; readonly maxHp: number; readonly animateMs?: number; readonly showNumbers?: boolean; readonly status?: readonly StatusId[] }
export interface TypeBadgeProps { readonly type: TypeName; readonly size?: 'sm' | 'md'; readonly compact?: boolean }   // renders the type icon + name (compact: icon only, name visually hidden); amended 2026-10-11
export interface CreatureCardProps {
  readonly creature: CreatureInstance;
  readonly variant?: 'row' | 'tile' | 'showcase';
  readonly selected?: boolean; readonly draggable?: boolean;
  readonly onClick?: () => void;
  readonly badges?: readonly ('favorite' | 'locked' | 'alpha' | 'listed')[];
}
export interface MoveButtonProps { readonly move: MoveDef; readonly pp: number; readonly ppMax: number; readonly effectiveness?: 0 | 0.25 | 0.5 | 1 | 2 | 4 | null; readonly disabled?: boolean; readonly onClick?: () => void; readonly hotkey?: '1' | '2' | '3' | '4' }
export interface SliderProps { readonly value: number; readonly min: number; readonly max: number; readonly step: number; readonly label: string; readonly format?: (v: number) => string; readonly onChange: (v: number) => void }
export interface ToggleProps { readonly checked: boolean; readonly label: string; readonly description?: string; readonly onChange: (v: boolean) => void; readonly disabled?: boolean }
export interface TableColumn<Row> { readonly key: string; readonly header: string; readonly width?: number; readonly align?: 'start' | 'end'; readonly render: (row: Row) => ReactNode; readonly sortValue?: (row: Row) => number | string }
export interface TableProps<Row> { readonly columns: readonly TableColumn<Row>[]; readonly rows: readonly Row[]; readonly rowKey: (r: Row) => string; readonly sort?: { readonly key: string; readonly dir: 'asc' | 'desc' }; readonly onSort?: (key: string) => void; readonly empty: ReactNode; readonly onRowClick?: (r: Row) => void }

export const TYPE_ICON_PATHS: Readonly<Record<TypeName, string>>; // 24-unit SVG path data per type (ui/typeIcons.ts; render hud/typeIcons.ts verbatim) — replaced TYPE_GLYPHS 2026-10-11
```

`HpBar` widths are `--hp` custom properties (0..1) set via `cssVars`; the colour switches at 0.5 and 0.2 by a CSS `@container style()`-free approach: three classes chosen in TS. `MoveButton` shows the effectiveness chevrons (`▲▲` ×4, `▲` ×2, `▼` ×0.5, `▼▼` ×0.25, `✕` ×0) only after the player has *seen* the target species (dex `seen`); otherwise nothing — the dex is load-bearing (§20.9.5).

`TooltipHost` (mounted once in `main.tsx`, beside the router) is the client's only tooltip: no call site uses a tooltip component; every `title` attribute is shown as a Broadcast slab instead of the browser's box. On hover (380 ms; immediate within 300 ms of another tip hiding) or `:focus-visible` focus, the nearest `[title]` element's text is shown and the attribute is moved aside until the tip hides (pointer leave, pointer down, Escape, scroll, focus out), then restored — accessible names keep working. The slab is `--bg-0` with a 1 px `--line-2` edge, a 3 px left bar in `--text-hi` (the anchor's type colour when it carries a `data-type`) and a 10 px pointer at the anchor; above the anchor, below when the top edge is within 8 px, clamped to the viewport, max 280 px wide, `role="tooltip"`, `--z-overlay`, no pointer events. <!-- amended 2026-10-12: custom tooltips -->

### 20.2.5 Component states

Every interactive component implements exactly: `default`, `hover` (1.05), `active` (0.95), `focus-visible` (ring), `disabled` (opacity 0.45, no scale), and where applicable `busy` and `selected`. Storybook is not used; `src/ui/Gallery.tsx` renders every component in every state at `/__gallery` in dev builds only (`import.meta.env.DEV`), and the Playwright visual test screenshots it at 1440p.

### 20.2.6 Motion inventory

| Motion | Duration | Reduced |
|---|---|---|
| Panel open/close (opacity 0→1, translateX 8 px→0) | 160 ms `--ease-out` | 0 |
| Modal (scrim 0→0.72, dialog scale 0.98→1) | 160 ms | 0 |
| Toast enter/exit (translateY 8 px) | 160 ms / 80 ms | 0 |
| Tooltip fade-in (after a 380 ms hover delay) | 80 ms | 0 (delay kept) |
| Tab underline slide | 160 ms | 0 |
| Zone banner (display text fade + 12 px rise, 2 s hold) | 400 ms in, 2 000 hold, 400 out | hold only |
| HpBar drain | 350 + 650 × damageFraction ms, max 1 000 | 0 (jumps) |
| Level-up counter roll | 600 ms | 0 |

---

## §20.3 STATE BOUNDARY

### 20.3.1 Four stores — `packages/client/src/state/*`

All four are `create<T>()(subscribeWithSelector(...))`; `settings` additionally wraps `persist`. Stores hold **UI-owned** data only. `room.state` is never assigned into any of them.

```ts
import type { BadgeId, ZoneId } from '@ewa/content';
import type { CreatureInstance, VariantKey, BattleState, BattleEvent, BattleFormat } from '@ewa/core';
import type { ServerMessage, TradeOffer } from '@ewa/protocol';

export interface Profile { readonly id: string; readonly username: string; readonly title: string; readonly motto: string; readonly body: string; readonly isAdmin: boolean; readonly createdAt: number }
export interface Progression {
  readonly badges: readonly BadgeId[]; readonly trainerExp: number; readonly trainerLevel: number; readonly rating: number;
  readonly dexSeen: readonly string[]; readonly dexCaught: readonly string[]; readonly dexVariants: Readonly<Record<string, readonly VariantKey[]>>; readonly dexAlpha: readonly string[];
  readonly flags: readonly string[];
  readonly quests: Readonly<Record<string, Readonly<Record<string, { readonly count: number; readonly done: boolean }>>>>; // questId -> objectiveId
}
export interface Inventory { readonly items: Readonly<Record<string, number>>; readonly money: number; readonly party: readonly CreatureInstance[]; readonly box: readonly CreatureInstance[] }

export interface SessionState {
  readonly accessToken: string | null; readonly accessExp: number; // unix ms
  readonly profile: Profile | null; readonly progression: Progression | null; readonly inventory: Inventory | null;
  readonly zoneId: ZoneId | null;                                  // last known; written by WorldSession on join/handover only
  readonly hydratedAt: number;                                     // performance.now() of the last hydrateFromMe
  hydrateFromMe(me: MeResponse): void;                             // the ONLY full write; runs once per session + after reconnect
  applyProgressionDelta(d: Extract<ServerMessage, { type: 'progressionDelta' }>): void; // the ONLY writer of Progression fields (null fields untouched)
  applyInventoryDelta(d: Extract<ServerMessage, { type: 'inventoryDelta' }>): void;     // the ONLY writer of Inventory fields; items/money absolute; creatures by id
  setTokens(access: string, accessExp: number): void;
  clearSession(): void;
}

export interface BattleUi {
  readonly battleId: string; readonly format: BattleFormat; readonly seat: 0 | 1;
  readonly authoritative: BattleState;                             // last server state (from battleStart/battleResync + applied events' hpAfter)
  readonly phase: 'selecting' | 'submitted' | 'playing' | 'replacement' | 'ended';
  readonly menu: 'root' | 'moves' | 'party' | 'bag' | 'orbs';
  readonly turnLabel: string;                                      // 'Turn 3'
  readonly log: readonly { readonly id: number; readonly text: string; readonly tone: 'neutral' | 'good' | 'bad' }[]; // last 40 lines
  readonly desyncs: number;
}
export interface UiState {
  readonly battle: BattleUi | null;
  readonly dialogue: { readonly speaker: string; readonly lines: readonly string[]; readonly index: number; readonly targetId: string } | null;
  readonly chatOpen: boolean;
  readonly modal: 'none' | 'evolve' | 'learnMove' | 'trade' | 'challenge' | 'raidLobby' | 'nickname' | 'release' | 'listing';
  readonly modalPayload: unknown;                                  // narrowed by the modal component through a zod schema
  readonly trade: { readonly tradeId: string; readonly phase: 'requested' | 'open' | 'confirming' | 'complete' | 'cancelled'; readonly offers: readonly [TradeOffer, TradeOffer]; readonly offerHash: string } | null;
  readonly challenge: { readonly fromId: string; readonly fromName: string; readonly expiresAt: number } | null;
  readonly hudVisible: boolean;                                    // F1 toggles; screenshots
  readonly connection: 'connected' | 'reconnecting' | 'offline';
  readonly fps: number;                                            // dev HUD only, written at 1 Hz
}

export interface NotificationsState {
  readonly toasts: readonly { readonly id: string; readonly level: 'info' | 'success' | 'warn' | 'danger'; readonly text: string; readonly ttlMs: number; readonly at: number }[]; // max 4 visible, FIFO
  readonly unreadDm: Readonly<Record<string, number>>;             // username -> count
  readonly friendRequests: number;
  readonly pendingBattlePassClaims: number;
  push(t: Omit<NotificationsState['toasts'][number], 'id' | 'at'>): void;
  dismiss(id: string): void;
}
```

`SettingsState` is in §20.8.1. Selectors in components always pass a selector (`useSessionStore(s => s.inventory?.money ?? 0)`) or `useShallow` for tuples; a bare `useSessionStore()` call is forbidden (ESLint `no-restricted-syntax` selector `CallExpression[callee.name=/^use\w+Store$/][arguments.length=0]`).

### 20.3.2 What writes what

| Data | Only writer | Trigger |
|---|---|---|
| `Progression.*` | `applyProgressionDelta` | room message `progressionDelta`; REST responses that return badges/dex/quests are converted to a `progressionDelta` literal by the route action and passed through the same function |
| `Inventory.items/money/party/box` | `applyInventoryDelta` | room message `inventoryDelta`; REST `{ inventory, money, party, box, creaturesUpdated }` responses converted to an `inventoryDelta` literal by the action |
| everything in `SessionState` | `hydrateFromMe` | `/play` loader; `WorldSession.onReconnected` (re-GET `/me`) |
| `BattleUi.authoritative` | `BattleController.applyServer` | `battleStart`; `battleEvents`: when the preview's digest matches `stateDigest`, the preview state **is** the server's state and becomes `authoritative`; without a preview (pvp, an NPC's replacement switch-in, a turn the client did not submit) or on a mismatch, singles resolve the turn again from the actions its events show and keep the result when its digest is `stateDigest`; otherwise the state is patched from the events (`hpAfter`, pp, status, actives, turn) and a `battleResync` is requested (pvp doubles and raids patch without one); `battleResync` (held while a timeline plays) |
| `zoneId` | `WorldSession` | `join` resolved / `handover` acked |

A `BattleEvent` of `expGain`, `levelUp`, `catchResult` or `battleEnd` changes nothing in `SessionState`. The rewards arrive as `progressionDelta`/`inventoryDelta` sent by the server after `battleEnd`; the `BattleResultCard` reads `RewardsSummary` from the `battleEnd` message for display only.

### 20.3.3 Replicated state — `useRoomState`

```ts
// packages/client/src/net/useRoomState.ts
import { useSyncExternalStore } from 'react';
import type { ZoneState } from '@ewa/protocol';

/**
 * Reads room.state through a selector. Subscribes with room.onStateChange (fires once per applied patch, ≤ 20 Hz).
 * The selector MUST return a primitive, or an array/object of primitives; the hook keeps the last result and returns
 * it unchanged when shallowEqual(prev, next), so React re-renders only when the selected value changed.
 * Never returns a Schema instance: schema objects are mutated in place by the decoder and cannot be React snapshots.
 * Returns `fallback` while there is no room.
 */
export function useRoomState<T extends Primitive | readonly Primitive[] | Readonly<Record<string, Primitive>>>(
  selector: (state: ZoneState, selfId: string) => T, fallback: T,
): T;
type Primitive = string | number | boolean | null;

// Examples the screens use — the complete list of replicated reads that reach React:
//   useRoomState((s) => s.timeOfDay, 0)                                   -> Settings preview, zone banner glyph
//   useRoomState((s) => s.players.size, 0)                                -> Social "N here"
//   useRoomState((s, me) => s.players.get(me)?.inBattle ?? false, false)  -> nav lock
//   useRoomState((s) => s.raid?.phase ?? -1, -1)                          -> RaidLobby modal
//   useRoomState((s) => [...s.players.keys()].sort(), [])                 -> Social "nearby" list (sorted, so it is stable)
```

Everything else about the replicated state — avatar positions, spawns, emotes, chat — is consumed inside `World3D.tick` from `room.state` and from `getStateCallbacks(room)` `onAdd`/`onRemove` (for creating/destroying render actors), never through React.

### 20.3.4 Connection lifecycle — `WorldSession`

```ts
// packages/client/src/net/WorldSession.ts
import { Client, type Room } from '@colyseus/sdk';
import { ZoneState, type ServerMessage, type ClientMessageType, CLIENT_MESSAGES } from '@ewa/protocol';

export interface WorldSession {
  readonly room: Room<unknown, ZoneState> | null;
  readonly selfId: string;                                          // player uuid (room.state.players key), not sessionId
  /**
   * First join / rejoin after reload: `POST /zone/enter { zoneId }` (spine §4.7) returns the SeatReservation of the shard the server picked
   * (403 `gated` → toast + stay); then `client.consumeSeatReservation(seat)` with the access token as the auth token. The client never calls
   * joinOrCreate: shard selection is the server's (30-server-netcode.md §30.2.6). `GET /me`.presence.zoneId is the zone to enter after a reload.
   */
  enter(zoneId: ZoneId): Promise<void>;
  /** Validates payload with CLIENT_MESSAGES[type].parse (throws in dev, drops + console.error in prod), then room.send. */
  send<K extends ClientMessageType>(type: K, payload: z.infer<(typeof CLIENT_MESSAGES)[K]>): void;
  onMessage(cb: (m: ServerMessage) => void): () => void;            // one dispatcher; fan-out inside the client
  /** Handover (spine §4.6): client.consumeSeatReservation(m.seat) on the destination (m.seat IS the ISeatReservation object), wait for its first onStateChange, send('handoverAck', { roomId: m.roomId, seat: m.seat.sessionId }) there, then leave(source, true) with code 4002. */
  handover(m: Extract<ServerMessage, { type: 'handover' }>): Promise<void>;
  leave(): Promise<void>;
}
```
<!-- reconciled 2026-09-18: join goes through POST /zone/enter (30-server-netcode.md §30.2.6, OQ 3); handover.seat is the typed SeatReservation (spine §4.4) -->

Message routing: `room.onMessage('*', (type, payload) => …)` is **not** used; every `ServerMessage.type` string is registered once with `room.onMessage(type, cb)` at join, and the returned disposers are collected and called in `leave()`. Reconnect: on `onDrop` (unconsented, code ≠ 1000) `ui.connection = 'reconnecting'`, `ConnectionOverlay` appears after 2 000 ms. `@colyseus/sdk` 0.18.2 reconnects **internally** on 1001/1005/1006/4010 (`src/Room.ts` lines 166–173; defaults 15 retries, `src/Reconnection.ts` lines 68–82), so the client configures `room.reconnection` to the schedule 1, 2, 4, 8, 8, 8 s (`maxRetries 6`) instead of running its own `client.reconnect(room.reconnectionToken)` loop, which would race the SDK's; after the last attempt the SDK fires `onLeave(4003)` → `'offline'` and a "Return to login" button. <!-- amended 2026-09-25: client IMPLEMENTATION-NOTES D5 --> On `onReconnect`: `hydrateFromMe(await GET /me)`, prediction buffer cleared, remote buffers cleared. Multi-tab: the server keys by player uuid, so a second tab's join replaces the first; the first receives `onLeave` code `4101` (`CLOSE_CODES.replaced`, 30-server-netcode.md §30.2.2) and shows "Playing in another tab"; 4001 is Colyseus' `SERVER_SHUTDOWN` and is treated as a restart/reconnect case.

---

## §20.4 SCENE ORCHESTRATION

### 20.4.1 The render surface the client consumes

`10-render.md` **defines** these (`§10.1.1 RendererOptions/EffectsFlags/Renderer/RenderStats`, `§10.5.1 ZoneSpec/ZoneHandle/HeightfieldData`, `§10.7.2 CameraRig`, `§10.7.5 BattleStage/VfxId/VFX_IDS`, `§10.7.6 ActorPool/ActorDescriptor`, `§10.9 HudLayer`, `§10.4.1 SpriteDescriptor/SpriteFrame/AtlasSet`); the client uses nothing else from that package and this block is the **consumed subset**, not a definition. <!-- reconciled 2026-09-18: 10-render.md OQ 1 — the definitions are render's; the members the client actually calls are listed -->

```ts
// From @ewa/render (owned by 10-render.md); the members the client calls.
createRenderer({ canvas, pixelRatio, effects, transcoderPath?: '/basis/' });       // forceWebGL/trackTimestamp are harness-only
Renderer.loadZone(spec: ZoneSpec): Promise<ZoneHandle>;                            // rejects if a zone is loaded and not disposed
Renderer.camera: CameraRig;      // setHeading(0|1|2|3), setZoomStop(0|1|2), follow(actorId), pushIn(target, ms), release(ms), shake(amp, ms), cue(kind, ms), focus
Renderer.stage: BattleStage;     // dress(at, terrain, participants), dressSpectator(x, z), undress(ms), setBattler(ref, d), setPose(ref, pose, ms), hurt, faint, setWeather, vfx(id, from, to, ms, type?), prewarm(ids), syncFrom(hp), setTypeColors(table), inspect(d)
Renderer.hud: HudLayer;          // set(partial: HudModel), setFonts(body, display), setScale(uiScale)
Renderer.actors: ActorPool;      // spawn(id, { look, name, guildTag, isLocal }), setTransform(id, x, z, angle, moving, running), setEmote(id, n), despawn(id), feetOf(id, out), screenPositions(out)
Renderer.materials.preloadHero(ids);                                                // §20.10.3 phase 5 only; never awaited before the first frame
Renderer.setTimeOfDay(t); setWeather(w); setHarvestLevel(0 | 1 | 2); setEffects(f); setPixelRatio(r); resize(w, h); setTimeScale(s); frame(dtMs); stats(); dispose();
ZoneHandle.id; ZoneHandle.collider; ZoneHandle.bounds; ZoneHandle.geometryDigest; ZoneHandle.dispose();   // collider → the protocol Collider adapter (§20.4.5)
```

### 20.4.2 `GameCanvas` and the tick loop

`GameCanvas` (`src/scene/GameCanvas.tsx`) renders one `<canvas>` and in a single `useEffect` calls `acquireWorld(canvas)`; the cleanup calls `releaseWorld()`. `World3D` is a module singleton with a refcount; `releaseWorld` schedules `dispose()` on a `setTimeout(…, 0)` that a re-acquire cancels, so React 19 StrictMode's synthetic unmount/remount in dev costs nothing and the WebGPU device is created once.

```ts
// packages/client/src/scene/World3D.ts
export interface World3D {
  readonly renderer: Renderer;
  readonly director: SceneDirector;
  readonly input: LocalPlayerController;
  readonly remotes: RemoteInterpolator;
  readonly battle: BattleController;
  readonly audio: AudioDirector;
  readonly hudWriter: HudWriter;
  start(): void; stop(): void;
  /** Fixed 60 Hz simulation (16.667 ms steps, max 4 steps per frame, remainder carried), then ONE renderer.frame(frameDt). */
  tick(nowMs: number): void;
}
```

`tick` order, every frame: (1) `input.sample()` — read the key/mouse state captured by DOM listeners into the preallocated `InputFrame`; (2) for each fixed step: `input.step(16.667)` (prediction), `remotes.step()`, `battle.player.step(16.667 * timeScale)`, `audio.step()`; (3) `hudWriter.flush()` — writes only changed fields; (4) `renderer.frame(frameDt)`. The loop is `requestAnimationFrame`; when `document.hidden` it switches to a 250 ms `setTimeout` that steps simulation without rendering, so prediction and audio stay coherent. Nothing in `tick` calls a Zustand `setState` except `ui.fps` at 1 Hz in dev builds.

**A lost GPU device** (amended 2026-10-06, Phase E6). The renderer's `onDeviceLost` (`10-render.md` §10.1.2) starts `DeviceRecovery` (`src/scene/deviceRecovery.ts`). It puts the world-boot overlay up ("Restoring the renderer"), tears down the renderer and everything bound to it, then creates a new renderer on the same canvas: SceneDirector, HUD binding, size and settings observers, sprite views, bound-atlas set. It re-attaches the room's state, so remotes, spawns and statics are re-created from the live schema. Last, it re-runs `enterZone`: `director.loadZone` for the current zone at the position the server holds now, with the overlay saying "Restoring <zone>" until that zone's first frame. An open battle is re-dressed by `battle.attach`. React, the WorldSession (socket, room, stores) and the battle controller are untouched. A rebuild that throws is retried 3 times, 1 s apart. After 3 failed rebuilds, or more than 3 losses within 60 s, the overlay shows "The graphics device keeps resetting. Reload the page to continue." Test: `packages/client/test/device-lost.test.ts` (a fake device whose `lost` resolves). <!-- amended 2026-10-06: Phase E6 -->

### 20.4.3 `SceneDirector`

```ts
// packages/client/src/scene/SceneDirector.ts
export interface SceneDirector {
  /** zoneSpecFor(content.zone(id), harvestStateFor(id, flags)) -> renderer.loadZone; registers static actors (npcs, trainers, items, lore, warps, links, gym/shop/healer) from the spec; plays the zone banner; starts the zone theme. Rejects if a zone is already loading (handover serialises). `harvestState` is the PLAYER's (spine §3.5 harvestStateFor over Progression.flags), never room.state.harvestState, which is only the content default. */
  loadZone(id: ZoneId, harvestState: HarvestState): Promise<void>;
  /** Despawns every actor, disposes the ZoneHandle, drops the audio stems, clears remote buffers. Idempotent. */
  unloadZone(): void;
  /** Pillar 7: camera.pushIn over 600 ms to the BattleSummary (x, z); stage.dress(terrainFor(zone.biome)); no scene unload. */
  enterBattle(summary: { readonly battleId: string; readonly x: number; readonly z: number; readonly format: BattleFormat }): Promise<void>;
  /** stage.undress(400); camera.release(600); input re-enabled after the camera settles. */
  exitBattle(): Promise<void>;
  setTimeOfDay(t: number): void;              // forwards to renderer + audio.night; called from room.state.timeOfDay listener (≤ 20 Hz)
  setWeather(w: WeatherKind): void;
  setHarvest(h: HarvestState): void;          // intact 0, thinning 1, harvested 2; called with harvestStateFor(currentZone, flags) whenever applyProgressionDelta changes `flags` (a restore beat re-textures the zone in place — one uniform, 10-render.md §10.2.6)
  readonly currentZone: ZoneId | null;
}
```
<!-- reconciled 2026-09-18: harvest is per player (spine §3.5/§4.1); the room's harvestState is not subscribed -->

Battles that are **not** the local player's (a `BattleSummary` appears in `room.state.battles` for another participant within 40 units) dress a *spectator* arena at that position with `stage.dressSpectator(x, z)` — the ring and lights only, no battlers, no camera move. Removed when the summary is removed.

### 20.4.4 The content → render adapter

```ts
// packages/client/src/scene/zoneSpecFor.ts
import { createRng } from '@ewa/core';
import type { ZoneDef, HarvestState } from '@ewa/content';
import type { ZoneSpec } from '@ewa/render';

/**
 * Pure. Same (zone, harvest) -> byte-identical ZoneSpec (asserted by a snapshot test over all 21 zones × 3 states).
 * Everything the adapter decides beyond the ZoneDef (scatter density jitter, prop variant picks, lamp count within the
 * pillar-4 budget) is drawn from createRng(zone.layoutSeed), so every client builds the same zone. Nothing here reads
 * Math.random, Date, or the DOM.
 */
export function zoneSpecFor(zone: ZoneDef, harvest: HarvestState): ZoneSpec;
```

Field mapping (the adapter is a table, not logic; target names are `10-render.md` §10.5.1 `ZoneSpec`): `zone.id → spec.id`; `zone.layoutSeed → spec.seed`; `zone.biome → spec.biome` and `spec.generators = biome` (`GeneratorSet` keys = `Biome`); `zone.palette → spec.palette`; `zone.kind → spec.layout` (`town` = plaza + 6–10 buildings, `route` = corridor with tall-grass patches, `story` = the signature only) and `spec.size` (the playable interior: town 128×128, route 208×208, story 168×168); `getHeightfield(zone.id) → spec.heightfield` **unchanged** (spine §3.11; the 160/240/200 m field whose 16 m margin is unwalkable scenery); `zone.signature → spec.setPiece`; `zone.links` → `spec.edges[dir] = { toZone, x, z }` at the interior-boundary midpoints; `zone.npcs/trainers` → `spec.actors[] = { id, look, x, z, kind: 'npc' | 'trainer' }` (`look` = `BODIES`/NPC look ids, spine §3.12); `zone.items` → `spec.pickups[]`; `zone.lore` → `spec.tablets[]`; `zone.warps` → `spec.warps[]`; `zone.gym/shop/healer` → `spec.buildings[]` with `kind` (positions from the layout table, seeded); `spec.props`, `spec.lights` (≤ 8 shadow + ≤ 24 non-shadow, drawn from `createRng(zone.layoutSeed).fork()` per the biome's light table) and `spec.water` (from the layout's water polygon when the heightfield has `water` samples) are the adapter's seeded decisions; `zone.encounterTable !== null` → `spec.tallGrass = true`; `harvest` → `spec.harvestLevel 0|1|2`; `zone.type` → `spec.accentType` (the sprite rim/gym beacon colour). The AOI cell of 32 units (spine §4.2) covers a town's field in 5×5 = 25 cells. <!-- reconciled 2026-09-18: bounds were ±64 / 128×64 / ±48 here, 128×128 / 256×128 / 96×96 in 10-render.md and 160 / 240 / 200 fields in 30-server-netcode.md; the spine §3.1 extents table is now the one source -->

**Creature texture residency** <!-- amended 2026-10-06 --> (`scene/creatureTextures.ts`). Every creature atlas has an owner that releases it, and a view binds only the ONE side it shows: overworld spawns, legendary statics, the raid den, remote players' creatures, the evolution and inspector close-ups and battle foes show the front; the player's battlers (doubles included) the back. Owners release on despawn, battle end, sequence end or zone unload; the zone holds its static set and the party's static atlases for its life. Released atlases stay bound for a 20 s grace with at most 2 flipbook sides and 4 static atlases idle, so re-showing a creature does not reload it. A live creature budget = the 700 MB cap − every other texture byte − 16 MiB: when over, idle flipbooks are evicted first, then idle static atlases; nothing a view holds or a billboard samples is ever evicted, and a flipbook that does not fit waits on the still frame. A legendary static plays its flipbook only within 40 m of the player (let go past 52 m; the diorama camera shows ≈ 24 m). Measured (1440 × 900, corrected metric): Mirevale idle 444.9 MB; a battle zenryu vs raikitsune 613.1 MB; galvan_route beside a static 703.8 MB; 10 evolutions + legendary battles peak 707.1 MB; every step returns to its baseline after leaving.

### 20.4.5 `LocalPlayerController` — input and prediction

**Bindings** (defaults; remappable §20.8.5; `KeyboardEvent.code` values):

| Action | Default | Sends |
|---|---|---|
| move forward/back/strafe | `KeyW KeyS KeyA KeyD`, `ArrowUp ArrowDown` (fwd/back), `ArrowLeft ArrowRight` (strafe) | `input` |
| run | `ShiftLeft` (hold) | `input.running` |
| interact | `KeyE`, `Enter` | `interact { targetId, kind }` or `engageSpawn { spawnId }` |
| jump | `Space` | nothing — local cosmetic hop (0.6 u, 420 ms); never on the wire |
| bike | `KeyV` | Phase D11: mounts / folds the Bicycle (owned, outdoors, not on open water — else a toast says why); `input.bike` while riding; it folds itself in a hall or when the item is gone |
| chat | `KeyT` | opens the DOM chat input; `Enter` sends `chat { text }`; `Escape` closes |
| emote 1–6 | `Digit1`…`Digit6` | `emote { emote }` |
| challenge | `KeyC` | `challenge { targetId }` for the nearest player within 6 u, not `inBattle` |
| rotate camera | `KeyQ` / `KeyR`, or mouse drag ≥ 80 px horizontal | `camera.setHeading((h ± 1) & 3)`; local only |
| zoom | wheel | `camera.setZoomStop` between 3 stops (20 / 26 / 34 m, `10-render.md` §10.7.1 `DISTANCE`; amended 2026-09-25 — this row said 14 / 18 / 24, which contradicted render's table); local only |
| party / bag / journal / pause | `KeyP` / `KeyB` / `KeyJ` / `Escape` | `navigate('/play/party')` etc.; local only |
| toggle HUD | `F1` | local |

While a DOM input/textarea has focus, or `ui.battle !== null`, or `ui.dialogue !== null`, or any `ui.modal !== 'none'`, movement keys are ignored (the controller checks `document.activeElement` and the store once per frame via `getState()`; no subscription).

**Movement model** — one constants table shared with the server. It lives in `@ewa/protocol` (`packages/protocol/src/movement.ts`; protocol may import core) because `@ewa/core`'s export list is closed by the spine. The client predicts with `stepMovement`; the server does **not** re-simulate — it validates each `input` against a speed cap derived from these constants (`MOVEMENT.runSpeed × SPEED_TOLERANCE`), the dt budget and the heightfield (`30-server-netcode.md` §30.2.4, whose `WALK_SPEED`/`RUN_SPEED` are re-exports of the values below). <!-- reconciled 2026-09-18: this file had 4.5 / 8.0 / radius 0.4 and "validates against exactly this function"; 30-server-netcode.md had 4.2 / 7.0 and a cap check; 10-render.md §10.6.2 MOVER had capsuleRadius 0.35. One table, the server's speeds, render's radius -->

```ts
// packages/protocol/src/movement.ts
export const MOVEMENT = {
  walkSpeed: 4.2,        // units / s  (= 30-server-netcode.md WALK_SPEED)
  runSpeed: 7.0,         //            (= RUN_SPEED)
  bikeSpeed: 10.5,       //            Phase D11 (= BIKE_SPEED; MoveInput.bike, running ignored)
  accel: 40,             // units / s^2 toward target velocity
  turnRate: 12,          // rad / s toward input heading
  radius: 0.35,          // capsule radius for edge/collider tests (= 10-render.md MOVER.capsuleRadius)
  stepMs: 1000 / 60,     // 16.667: client fixed step
  sendHz: 20,            // input messages per second
  maxDtMs: 100,          // matches InputMsg.dtMs max
} as const;

export interface MoveInput { readonly ax: number; readonly az: number; readonly running: boolean; readonly bike?: boolean } // ax/az in [-1,1], normalised by the caller; bike: Phase D11
export interface MovePose { x: number; z: number; angle: number; vx: number; vz: number }   // mutable scratch — the ONLY mutable type in protocol
export interface Collider { resolve(pose: MovePose, radius: number): void }                    // heightfield + blockers; pushes the pose out in place

/** Advances pose in place by dtMs. Deterministic for identical inputs; allocation-free. */
export function stepMovement(pose: MovePose, input: MoveInput, dtMs: number, collider: Collider): void;
```

The client's `Collider` is a 12-line adapter over `ZoneHandle.collider` + `resolveMove` (`10-render.md` §10.6.2): `resolve(pose, radius)` calls `resolveMove(collider, fromX, fromZ, pose.x − fromX, pose.z − fromZ)` and writes the result back into `pose`. `resolveMove` never returns an unwalkable position, and the server accepts only `walkable = 1` positions, so prediction and truth agree on where a player may stand. Phase D8–D11 <!-- amended 2026-10-06: Phase D8–D11 world systems -->: the adapter's `setSurf(on)` (HM Surf held, water not lava, bike folded — World3D sets it every fixed step) resolves in render's surf mode and `height` is `surfaceY`; `setObstacles(lookup, cleared)` (the SceneDirector, on load and on every flag change) re-opens the stamped samples of the obstacles this player cleared — content `obstacleAt`, the exact set the server's `standable` accepts. A ridden step is stored in the pending ring as gait 2 (0 walk / 1 run) so a replay rides too, and a message carries `bike: true` when any step of its window was ridden.

**Prediction and reconciliation**:

```ts
// packages/client/src/scene/LocalPlayerController.ts
export interface LocalPlayerController {
  readonly pose: MovePose;                    // predicted, authoritative for rendering the local avatar
  sample(): void;                             // DOM key state -> InputFrame (no allocation)
  step(dtMs: number): void;                   // stepMovement(pose, …) + push to pending ring; every 50 ms accumulated: send('input', …)
  /** Called from getStateCallbacks(room).listen(players.get(selfId), 'seq', …) when the server acks a newer seq. */
  reconcile(serverX: number, serverZ: number, serverAngle: number, ackedSeq: number): void;
  setEnabled(on: boolean): void;              // false during battles/dialogue/modals; zeroes velocity
}
```

Rules with numbers: input `seq` is a `uint32` starting at 1, incremented per **sent** message (not per step). Messages are sent every 50 ms (`sendHz` 20) with `dtMs` = the sum of fixed steps since the last send (≤ 100), plus the predicted `x, z, angle` and `running`. The pending ring buffer holds 64 `{ seq, ax, az, running, dtMs }` entries, allocated once (`Float32Array(64*4)` + `Uint32Array(64)`); overflow drops the oldest. On `reconcile(sx, sz, sa, ackedSeq)`: drop entries with `seq <= ackedSeq`; compute `err = hypot(pose.x - sx, pose.z - sz)`; if `err < 0.01` return; set the pose to the server values and re-run `stepMovement` for every remaining pending entry in order; if `err > 4.0` the avatar snaps (this is also logged to the dev HUD as a "rubber-band"); otherwise the *render offset* (a separate `renderX/renderZ` pair) is blended from the old to the new pose linearly over 100 ms — simulation state is never blended. Test: a headless harness feeds 2 000 random inputs through client `stepMovement` and a mirrored server loop with 80–200 ms simulated latency and 2 % loss; the final positions agree within 0.01 u and no reconcile exceeds 4.0 u.

**Fishing** (Phase D9) <!-- amended 2026-10-06: Phase D8–D11 world systems --> — with the Old Rod in the bag, outdoors and on foot, a 'fish' interactable (2.6 u) rides the first water sample within `FISH_REACH_M` (2.5 m) along the player's heading (allocation-free, each fixed step), prompting "E — Fish in the water". `E` starts `FishingController` (`scene/fishing.ts`, pure): 'waiting' 1.2–3.2 s, then 'bite' — the "!" window of 700 ms (1 000 ms under reduced motion) — a press inside it sends `fish { angle: pose.angle }`, a press while waiting (early) or none in the window (late) is 'missed' for 900 ms. `world/FishingPrompt.tsx` draws the card bottom centre (a bobbing float / a pulsing "!" / "It got away."; nothing moves under `:root[data-reduced='1']`) and owns `E` / `Enter` / `Space` (reel) and `Escape` (reel in empty) while it is up; movement is blocked meanwhile. A battle start or a zone change cancels the cast. The server rolls the bite (`30-server-netcode.md` §30.3 Fishing) and answers with a `battleStart` or a refusal toast.

**Obstacles** (Phase D10) — a Cut tree / Strength boulder is an interactable ("Cut the small tree" / "Push the boulder", 2.6 u) until its `obstacle:<zone>:<id>` flag arrives; `E` checks content `obstacleRefusal(kind, items, party types)` first (the refusal text is content's `obstacleRefusalText`, the same the server toasts) and sends `interact { kind: 'obstacle' }` only when it would pass. On the flag the director swaps the prop (`ObstaclesHandle.setCleared`) and re-opens the collider.

### 20.4.6 `RemoteInterpolator`

For each other `PlayerState` in view, a ring of 8 samples `{ t, x, z, angle, moving, running }` where `t = tick * 50` ms (server time; spine: 20 Hz). Server-time offset = the median of the last 32 `(performance.now() - tick*50)` observations, updated on every `room.onStateChange`. Render time = `serverNow - 100` ms (the interpolation delay). Each step finds the two samples bracketing render time and **linearly** interpolates position and shortest-arc angle; if render time is past the newest sample it extrapolates with the last velocity for at most 100 ms, then holds still with `moving = false`. There is no `pos += (target - pos) * k` anywhere; the lint fixture `test/no-exp-smoothing.test.ts` greps `src/scene/**` for `\*\s*0\.\d+\s*\)?\s*;?\s*$` patterns on assignment to `x|z` and fails on a hit. Nearest-N rendering: at most 48 remote actors get a render actor (sorted by distance once per 500 ms); others are tracked but not spawned. Emote: `listen(player, 'emote', …)` → `actors.setEmote(id, n)`; the server clears it after 2 s. Chat: the `ServerMessage` variant `chat { id, name, text }` (spine §4.4; AOI-scoped by the server, `30-server-netcode.md` §30.6.5); the client appends `{ name, text, at }` to the HUD chat log (§20.6). <!-- reconciled 2026-09-18: `chat` is a spine variant now -->

### 20.4.7 Interaction targeting

Once per fixed step the controller scans a preallocated array of interactables (static actors from the `ZoneSpec` + spawns from `getStateCallbacks(room).onAdd('spawns')` + remote players) and keeps the nearest within range: NPC/trainer/tablet/pickup/building 2.5 u; spawn 1.2 u; link edge 1.5 u (auto-triggers `handover` on the server side — the client just walks); player 6 u (for `C`). The prompt text is written to the HUD only when the nearest target id changes. `E` sends the corresponding `interact`. NPC dialogue is **content, not wire**: on `interact { kind: 'npc' }` the client immediately opens the DOM `DialogueBox` with the lines it computes from content and its own flags — `nextStoryBeat(zone, flags)?.speaker === npcId ? beat.lines : (the first `react` whose `when` flag is held, else `NpcDef.lines`)` — while the server, for the same interact, replies with nothing (plain NPC), `storyBeat { beatId, phase: 'start' }` (confirms the beat; the client keeps the lines it already shows), `battleStart` (trainer/gym/static/beat battle), `inventoryDelta` (pickup), `progressionDelta` (flags) or `toast`. `storyBeat { phase: 'complete' }` opens the beat's `after` lines. A `start` for a beat the client did not predict (flags changed under it) replaces the open dialogue. <!-- reconciled 2026-09-18: this file expected a `dialogue` message that no section defined; 30-server-netcode.md §30.4.6 says lines are content; the spine's `storyBeat` variant bridges the two -->

### 20.4.8 Followers and field powers <!-- added 2026-10-21: followers with field powers (spine §3.18) -->

- **Followers** (`scene/FollowerViews.ts`): every player's lead comes from the room (`PlayerState.lead` / `leadFlags`,
  listened per player; the AOI view keeps it to the trainers near). The player's own follower holds its species' static
  atlas, both sides (`CreatureTextures.show(…, 'still')`; the zone load already holds the party's), so it always shows.
  Another trainer's follower shows at once when its species' static atlas is already bound (the zone's set, the
  player's party, an idle battle sheet), held while it walks there; otherwise it takes a party single (render
  `bindSingle`: the front cell only, front-facing) while fewer than `FOLLOWER_SINGLES` 3 are out; beyond that it has no
  follower (the graceful fallback: no whole atlas bound per passer-by). At most `FOLLOWER.max` 16, the player's own first,
  then the nearest remotes with a rig, re-chosen at 2 Hz with the nameplates. Hidden: the player's own in a battle, the
  arena, a trainer's walk-up, an evolution or a hall pocket; a remote's in battle or inside a hall. It walks while biking.
- **Glide** (`LocalPlayerController.glider`, set on every zone change from `FieldPowerSystem`): a push whose probe 0.6 m
  ahead stays blocked for `GLIDE_INTENT_STEPS` 6 steps (0.1 s: an intent, not a slide along a ledge) asks content's `planGlide` over the collider's `passable` (FIELD_POWERS on in this room, a Flying
  lead, outdoors, on foot); with a plan the controller glides at `GLIDE.speedMps` along it whatever the keys say, each step
  recorded as gait 3 (a replay glides), and every message of a glide window carries `glide { x, z, dx, dz }`. The server
  accepts every position on a glide it planned too, so any correction mid-glide is a refusal: the glide ends, the replay
  walks, and take-offs rest `GLIDE_REST_STEPS` 180 steps (3 s), so a refusal never loops (and never piles up rejections). World3D lifts the avatar (`CharacterPool.setLift`) along `glideAltitude` and plays a gust at the take-off.
- **Field powers** (`scene/fieldPowers.ts`, `FieldPowerSystem`): the lead is `fieldLead` of the session party. A zone's
  spots are dynamic targets, enabled only for a lead with the power while `state.fieldPowers`: "E Burn the brambles"
  (2.6 m), "E Dig by the campfire" (2.5 m), "E Dive into the dark water" (2.6 m; on land: "Swim out over the dark water
  first", nothing sent). Unburnt brambles are prediction blockers (`addBlocker('bramble:<id>', brambleSolid)`) and render
  obstacles `bramble:<id>` (zoneSpecFor appends them after the Cut / Strength obstacles); burnt, or with the switch off,
  they are gone. The power key (`fieldPower`, default F, rebindable, "Lead's field power"): a Psychic lead sends `sense`;
  another lead is told what it does. The server's `fieldPower` plays the flames (and hides the patch), the soil, the spray,
  or, for `sense`, the haunts: a mote every 1.6 m round each loop, the points within 36 m of the player lit in turn (a
  third of them every 110 ms, so the near trail glows steadily), and a ring where it walks every 0.9 s, for 12 s (wanted ghosts in the hot orange). A Fire lead's follower carries render's light in dark places
  (`isDarkHere`; 0.85 in a dark zone by day, the night ramp, 1 under a deep shadow). Dark-water spots within 45 m breathe
  (`diveMark` every 1.5 s) while the switch is on. Refusal details (`FIELD_POWER_REFUSALS`) are explained by the server's
  own toast (the message router does not toast them twice).
- **The hint chip** (`world/FieldPowerChip.tsx`, under the minimap, an `<aside>` of the shell so F1 hides it; hidden
  with a panel open, in battle and in the arena): "Walking with you", the lead's sprite, name and type icons, then one line
  per power (its type icon, the label, what it does here, dimmed when there is nothing for it in this zone, the power key
  on a paper chip for the sense); "No field power. Lead with a Flying, Fire, Ground, Psychic or Water type." or "Field
  powers rest on this server". Fed by `state/fieldPowers.ts`, written only when what it shows changes (1 Hz check).
- **The party screen**: each card has a field power line (the power's label on its type colour, or "No field power"), and
  the creature walking with the player is tagged "Walks with you".

### 20.4.9 Camp bases <!-- added 2026-10-22: camp bases (spine §3.19) -->

`scene/CampViews.ts` (`CampViews`, owned by the world): on a route the campfire is a dynamic `camp` target (range
`CAMP_PROMPT_M` 4 m): "E Visit the travellers' camp", or the held camp's banner name; `E` opens `/play/camp`. The zone
room's `campOwner` / `campName` / `campTrophies` (listened to on every room) go to the render's `ZoneHandle.camps.set`
(the banner and the trophy kinds, nothing for a free camp), the prompt and `state/camp.ts` (the Camp screen re-reads when
they change). A state for another zone than the one shown (a handover in flight) waits until that zone is the one shown.
`zoneSpecFor` adds `spec.camps` on routes only (content `campOf`).

---

## §20.5 BATTLE PRESENTATION


**Trainer sight** <!-- amended 2026-10-20: old-game trainer battles, 30-server-netcode.md §30.3 -->: on `trainerSpotted` World3D locks input, cancels a cast, closes any dialogue and plays `TrainerApproach` (`scene/trainerApproach.ts`) on the trainer's director actor: the `spotted` sfx and the "!" emote card (actor emote 4) while it turns to the player, `ALERT_MS` 900 ms standing, then a walk at 3.2 m/s that stops `STOP_M` 1.6 m short of the player (at most 3 s), the local avatar turned toward it meanwhile. Then the trainer's lines open (`trainerPlan`'s beat for a story trainer, else `TrainerDef.lines`) as an **obligatory** dialogue (`DialogueUi.obligatory`: Escape skips to the end instead of walking away) whose `onFinish` sends `interact { kind: 'npc', targetId }`. The battle restages the actor and puts it back afterwards; if no battle opens within 6 s the trainer is set back at its spot and input returns. With `WILD_ENCOUNTERS = 'grass'` the spawn targets above are simply absent (`state.spawns` stays empty).

### 20.5.1 Pipeline

```
ServerMessage battleEvents.events : BattleEvent[]
   -> TimelineBuilder.build(events, ctx) : Timeline          (pure; content + registry lookups; no DOM)
   -> TimelinePlayer.play(timeline)                          (inside World3D.tick; drives stage, camera, hud, audio, timeScale)
   -> on complete: BattleController.phase = 'selecting' | 'replacement' | 'ended'
```

```ts
// packages/client/src/battle/timeline.ts
import type { BattleEvent, Ref, TypeName } from '@ewa/core';

export type Keyframe =
  | { readonly at: number; readonly k: 'pose'; readonly who: Ref; readonly pose: 'idle' | 'windup' | 'lunge' | 'recoil' | 'hurt' | 'faint' | 'enter' | 'exit' | 'celebrate' }
  | { readonly at: number; readonly k: 'flash'; readonly who: Ref; readonly color: string; readonly ms: number }
  | { readonly at: number; readonly k: 'vfx'; readonly id: string; readonly from: Ref | null; readonly to: Ref | null; readonly ms: number; readonly type: TypeName }
  | { readonly at: number; readonly k: 'camera'; readonly shot: 'wide' | 'attacker' | 'defender' | 'impact' | 'ko' | 'throw'; readonly ms: number }
  | { readonly at: number; readonly k: 'shake'; readonly amp: number; readonly ms: number }           // amp in world units
  | { readonly at: number; readonly k: 'time'; readonly scale: number; readonly ms: number }          // 0 = hitstop, 0.35 = crit slow-mo
  | { readonly at: number; readonly k: 'chroma'; readonly amount: number; readonly ms: number }       // 0..0.02 screen-space offset
  | { readonly at: number; readonly k: 'hp'; readonly who: Ref; readonly to: number; readonly max: number; readonly ms: number }
  | { readonly at: number; readonly k: 'status'; readonly who: Ref; readonly status: string | null }
  | { readonly at: number; readonly k: 'stage'; readonly who: Ref; readonly stat: string; readonly delta: number }
  | { readonly at: number; readonly k: 'form'; readonly who: Ref; readonly form: string }   // <!-- amended 2026-10-08: battle forms (hollowmane's rage form) --> `formChange`: after the hit drains, a red flash + `form_rage` + `raid_roar` sfx + shake; the stage shows `<species>_<form>` at +40 % of FORM_MS (1 100 ms), then the line
  | { readonly at: number; readonly k: 'log'; readonly text: string; readonly tone: 'neutral' | 'good' | 'bad' }
  | { readonly at: number; readonly k: 'sfx'; readonly id: string; readonly at3d: Ref | null }
  | { readonly at: number; readonly k: 'weather'; readonly kind: string }
  | { readonly at: number; readonly k: 'orb'; readonly phase: 'throw' | 'shake' | 'catch' | 'break'; readonly n: number }
  | { readonly at: number; readonly k: 'inputLock'; readonly locked: boolean }
  | { readonly at: number; readonly k: 'end' };

export interface Timeline { readonly frames: readonly Keyframe[]; readonly durationMs: number } // frames sorted by `at`, stable
export interface TimelineCtx { readonly content: ContentIndex; readonly registry: MoveAnimRegistry; readonly reduced: boolean; readonly speciesOf: (r: Ref) => string }
export function buildTimeline(events: readonly BattleEvent[], ctx: TimelineCtx): Timeline;
```

`buildTimeline` is pure and tested by snapshot: the 1 000 fuzz battles from spine §2.20 are replayed and every turn's timeline is asserted to (a) be sorted, (b) end with `end`, (c) have `durationMs ≤ 9 000` after compression (§20.5.3), (d) contain zero `shake`/`time`/`chroma` frames when `ctx.reduced` is true.

**Doubles timeline** <!-- amended 2026-10-06 Phase D6 -->. Keyframe refs stay core refs (party indices). With `TimelineCtx.activesOf` (both sides' `actives`; doubles only) `buildTimeline` tracks the party index on each field position: a `switchIn { pos }` moves it and its `enter` pose frame carries that `pos`; turn-start / turn-end idles and the winner's celebrate address every standing field battler (`TimelineCtx.standing` skips one fainted in place); a drain VFX points at the battler the drainer last hit; a spread `moveUsed { targets }` draws its move VFX to each target; a per-target `moveFailed { target }` names it. Without `activesOf` (singles) the output is byte-identical to pre-D6.

### 20.5.2 Move animation registry

```ts
// packages/client/src/battle/moveAnims.ts
export interface MoveAnimDef {
  readonly windupMs: number;          // default 250
  readonly travelMs: number;          // default 200; 0 for self/field moves
  readonly recoverMs: number;         // default 300
  readonly vfx: string;               // render VFX id (10-render.md VFX table); default `type_${type.toLowerCase()}`
  readonly camera: 'attacker' | 'defender' | 'impact' | 'wide'; // default 'impact' for power > 0, 'attacker' for self, 'wide' for field
  readonly sfx: string;               // default `move_${type.toLowerCase()}`
  readonly attackerPose: 'lunge' | 'windup' | 'idle';           // default: contact ? 'lunge' : 'windup'
}
export interface MoveAnimRegistry { get(moveId: string, move: MoveDef): MoveAnimDef } // per-move entry if present, else DEFAULT_BY_TYPE[move.type] merged with defaults
export const MOVE_ANIMS: Readonly<Record<string, Partial<MoveAnimDef>>>;   // keyed by move id ('Vine Lash'); hand-authored; ≥ 40 entries on the slice
export const DEFAULT_BY_TYPE: Readonly<Record<TypeName, Partial<MoveAnimDef>>>; // all 19 present; validate.ts-style test asserts coverage
```

Every `vfx` value in `MOVE_ANIMS`/`DEFAULT_BY_TYPE`, and every `vfx` id the builder emits for non-move events, is one of the `VFX_IDS` of `10-render.md` §10.7.5; `timeline.test.ts` asserts the set difference is empty. <!-- amended 2026-10-08: move motion styles --> Every damaging move also has a motion style (`MOVE_STYLE`, `battle/moveStyles.ts`, asserted complete by `moveStyles.test.ts`): the registry puts `style_<style>` in place of a type-default VFX (`type_*` / `impact_normal`) — a hand-authored special effect stays — and the timeline's `vfx` keyframe hands its `type` (the move's) to `BattleStage.vfx`, which draws the style in that type's colours. `Keyframe.pose` values map 1:1 onto render's `BattlerPose` (`recoil` and `celebrate` included) and `Keyframe.camera.shot` onto `CameraRig.cue` kinds (`throw` included). <!-- reconciled 2026-09-18 -->

### 20.5.3 Timing constants (ms unless stated) — `packages/client/src/battle/constants.ts`

| Constant | Value | Where it applies |
|---|---|---|
| `HITSTOP_FRAMES` | 3 (= 50 ms at 60 Hz, `time { scale: 0 }`) | every `damage` with `cause: 'move'` and `amount > 0` |
| `CHROMA_SUPER` | amount 0.012, 120 ms, ease-out | `damage.effectiveness >= 2` |
| `SHAKE_AMP(frac)` | `min(0.5, 0.08 + 0.6 * frac)` u, 180 ms, where `frac = amount / maxHp` | every `damage` with `cause: 'move'` |
| `CRIT_SLOWMO` | `time { scale: 0.35, ms: 400 }` starting at impact | `damage.crit` |
| `KO_HOLD` | 900 (camera `ko`, `pose: 'faint'` at 0, next frame at +900) | `faint` |
| `HP_DRAIN(frac)` | `min(1000, 350 + 650 * frac)` | every `damage`/`heal` |
| `SWITCH_MS` | 800 (exit 350, enter 450) | `switchOut`+`switchIn` |
| `STATUS_MS` | 500 | `statusApplied`/`statusCured`/`statusTick` |
| `STAGE_MS` | 400 | `statStage` |
| `LOG_DWELL_MIN` | 600 | every `log` frame keeps the line visible ≥ 600 before the next log frame |
| `ORB_THROW` / `ORB_SHAKE` / `ORB_GAP` / `ORB_RESULT` | 600 / 700 / 400 / 900 | `catchThrow`, each `catchShake`, `catchResult` |
| `WEATHER_MS` | 700 | `weatherSet`/`weatherEnd` |
| `TURN_BUDGET` | 9 000 | if the built duration exceeds it, every `recoverMs`, `STATUS_MS`, `STAGE_MS` and `LOG_DWELL_MIN` is scaled by `9000 / duration` down to a floor of 0.5×; hitstop, `KO_HOLD` and `ORB_*` never compress |
| `PUSH_IN` / `RELEASE` | 600 / 600 | `SceneDirector.enterBattle`/`exitBattle` (spine Pillar 7) |

Under effective reduced effects (§20.8.2) the builder emits no `shake`, `time`, or `chroma` frames and `HP_DRAIN` becomes 0; every other frame is identical, so the timeline's *event content* is byte-identical between modes except for those three kinds (test in §20.5.1 (d)).

### 20.5.4 `TimelinePlayer`

Runs inside `World3D.tick` at the simulation step. Holds `cursor` (ms), applies every frame with `at <= cursor` in order, then advances `cursor += 16.667 * currentTimeScale` where `currentTimeScale` is 1 unless a `time` frame is active. A `time { scale: 0 }` frame with `ms: 50` freezes `cursor` for 3 real steps (the hitstop is real-time, not timeline-time). `camera` frames call `renderer.camera.*`; `shake` → `camera.shake`; `chroma` → `renderer.setEffects` transient; `hp` → HUD battle bar tween (canvas); `log` → `ui.battle.log` **batched**: log lines are pushed to a preallocated array and flushed to the store at most once per `LOG_DWELL_MIN` — the one place the timeline touches React state, at ≤ 2 Hz. `sfx` → `audio.play(id, at3d)`. `inputLock` frames bracket the whole timeline; the battle menu (DOM) reads `phase` from the store.

**Doubles addressing** <!-- amended 2026-10-06 Phase D6 -->. `play(tl, seat, actives)` seeds a party index → field position map per side from the starting state's `actives`; an `enter` pose frame with `pos` moves it (whoever held that position leaves the map). Every pose / hurt / flash / VFX `from`·`to` / sfx anchor goes to stage ref `{ side: side ^ seat, slot: position }`; `positionOf(side, slot)` (-1 = off the field) is what the controller uses to route `hp` / `status` / `stage` / `enter` to the right bar and stage slot. Singles keeps stage slot 0 per side.

### 20.5.5 `BattleController` and the local preview

```ts
// packages/client/src/battle/BattleController.ts
export interface BattleController {
  onBattleStart(m: Extract<ServerMessage, { type: 'battleStart' }>): void;   // director.enterBattle; stage.setBattler for both leads; play(createBattle events); phase 'selecting'
  submit(action: Action): void;                                                // validateAction locally first (error -> toast, no send); send battleAction { battleId, turn, action }; phase 'submitted'; preview()
  onBattleEvents(m: Extract<ServerMessage, { type: 'battleEvents' }>): void;  // digest check; apply hpAfter to authoritative; play(buildTimeline(m.events)); phase from last event
  onBattleResync(m: Extract<ServerMessage, { type: 'battleResync' }>): void;  // replace authoritative; stage.syncFrom(state); phase 'selecting' | 'replacement'; held until a playing timeline ends
  onBattleEnd(m: Extract<ServerMessage, { type: 'battleEnd' }>): void;        // BattleResultCard (DOM) with m.rewards; after dismiss: director.exitBattle; ui.battle = null
  readonly preview: { state: BattleState; digest: string } | null;
}
```

**Preview rule.** On `submit`, when the opposing side is `wild`/`npc` (formats `wild`, `trainer`, `league`), the client computes `preview = resolveTurn(authoritative, seat === 0 ? [action, null] : [null, action], content)` — the same null-passing convention the server uses (spine §2.10), so the NPC choice comes from the same rng stream and the digest can match. For `pvp` and `raid` no preview is computed (the other action is unknown). The preview is used for exactly three things: (1) `renderer.stage.prewarm(vfxIdsIn(preview.events))` so shaders/particles for the likely VFX are resident before the server message lands; (2) `expectedDurationMs = buildTimeline(preview.events).durationMs` to size the input-lock and the "waiting" indicator; (3) `digestBattleState(preview.state)` compared with `battleEvents.stateDigest`. **No preview frame is ever rendered**: `TimelinePlayer.play` is only ever called with a timeline built from `m.events`. On mismatch: `console.warn('battle desync', battleId, turn)`, `ui.battle.desyncs += 1`, `send('battleResync', { battleId })`, and the server's events are still played (they are authoritative regardless). The `battleEvents.rng` field replaces the local `authoritative.rng` after every turn so the next preview starts from the server's stream. On a digest **match** the preview state replaces `authoritative` wholesale: an `authoritative` updated only from `hpAfter` (the draft's §20.3.2 rule) would diverge from the server at the first stage, status, PP or weather change, and every later preview would mismatch and request a resync. <!-- amended 2026-09-25: client BattleController.ts header, the implemented rule -->

**Every turn plays in full.** A turn the client did not preview is resolved again from the actions its events show (a switch, an item, a catch, flee, forfeit, else each move with pp, with and without the transform; an NPC side passes null like the server) and that state is kept only when its digest is `stateDigest`: patching alone misses every volatile (a switch-in's Intimidate, a switch-out's reset stages), so the next preview mismatched and its resync stopped the playing turn. A `battleEvents` that arrives while a timeline plays (an NPC's replacement switch-in, resolved ~30 ms after the KO turn) is queued behind it instead of finishing it without its moves, hits and faint, and a `battleResync` that arrives while one plays is applied when the last queued timeline ends. <!-- amended 2026-10-20: switch-ins cut the moves' animations; client BattleController.ts header -->

**Doubles submit** <!-- amended 2026-10-06 Phase D6 -->. In a doubles battle (`state.slots === 2`; trainer / league / pvp) `submit(action)` records the action for the position choosing now (`ui.battle.pick = { pos, picks }`; `check` = `validateAction(state, seat, a, content, pos)` plus "no switch to the creature the other position already chose"), then moves to the next position `requiredPositions(state, seat)` lists; `undoPick()` re-opens the earlier one. Nothing is sent until the last required position has picked: then `validateSideChoice` on the pair, ONE `battleAction { battleId, turn, action, pos }` per required position, and (trainer / league) the preview `resolveTurn(authoritative, seat === 0 ? [[a0, a1], null] : [null, [a0, a1]], content)` with the usual digest check (pvp: no preview). A forfeit fills every required position. In the replacement phase only the fainted positions the bench can fill pick (a switch each). The stage shows four battlers (`STAGE_REFS_DOUBLES`), the displayed creature is tracked per position, `patchFromEvents` moves `actives` on `switchIn { pos }`, and `syncFrom` lists all four.

**HP is never computed locally.** The HUD bar targets are `damage.hpAfter`/`heal.hpAfter`; `authoritative.sides[i].party[j].creature.hp` is overwritten from those same fields as events are applied.

### 20.5.6 Battle menu (DOM) and in-canvas elements

**Majin / Tenjin** <!-- amended 2026-10-11: Majin / Tenjin --> (`.design/majin-tenjin.md`; spine §2.10 `Action.transform`). The Fight menu's row with Back carries a transform toggle (key **T**, `aria-pressed`, the form's sigil + "Majin" / "Tenjin") shown only when the player's side holds the band of the active battler's form kind and has not transformed; it is enabled only when core `transformError` is null, and disabled shows its reason as a caption ("Majin needs HP below half." / "Tenjin needs HP at or above half." / "Already transformed this battle."; doubles: "One transformation per battle." once another position armed it). Armed it takes the `--accent` (selected) look and the next move is sent with `transform: true` (doubles: one position only); it resets on a new turn, another position or a phase change. The Last-turn ticker shows "T Majin" / "T Tenjin" while it is enabled. The first time it is enabled per kind, a coach line ("Majin ready — its HP is below half. One transformation per battle." / the Tenjin line) and a short pulse (none under reduced motion). Timeline: a `formChange` to `rage` / `majin` plays `form_rage` + `raid_roar` + a shake and logs "<Name> broke open into its Majin Form!"; to `tenjin` plays `form_tenjin` + `bell_toll`, a white-gold flash, no shake, "<Name> ascended into its Tenjin Form!"; a `heal` with cause `'form'` logs "<Name> is steadied and restored its HP!". The form sprite and its live aura follow from the descriptor (render §10.7.5). Errors: `cannotTransform` → "Can’t transform now".

Amended 2026-09-30 (render Part 5 T2; audit M2-battle-5 / -6): `BattleOverlay` reports the panel's measured top edge; World3D hands render the panel's height over the canvas (`part3.setBattleInsets(0, px)`), and render's battle camera frames both battlers — and the far battler's HP bar — above it, while the HUD keeps both bars off it. The client's former 1.0 m look-at shift toward the camera (`FRAME_SHIFT_M`) is 0. `BattleHud` fills each bar's `types` from the species table for the plate's type badges.

DOM (`BattleOverlay`, the bottom `clamp(200px, 28vh, 280px)` of the viewport, no `Panel` — amended 2026-10-11, Broadcast UI: a command deck): a command rail on the left, `Fight · Party · Bag · Orbs · Run/Forfeit` as slanted slabs with key chips (hotkeys `1–5` at the root), which stays visible beside every sub-menu (the open one is the `--accent` slab); the turn tag above the rail carries the turn timer at its right (amended 2026-10-12; `battle/TurnTimer.tsx`): the `m:ss` left before the server's deadline auto-acts (§30.4.3, 60 s a turn, 20 s for a replacement), counted down from the last battle message's `deadlineMs` while the player chooses or waits for the other side, `--warn` under 10 s and a `--danger` block under 5 s, hidden while a turn plays, after the end and in raids (whose round timer is the raid panel's); every choice opens on the Fight menu (the moves) — amended 2026-10-12 — so Back / `Escape` from Party, Bag or Orbs return to the moves, `Escape` on the moves shows the root and its `1–5` hotkeys, and a raid's catch window opens on the root (only Orbs is live); a "Last turn" ticker across the top of the deck; moves as 4 cards in one row (`MoveButton size="lg"`: a slab of the move's type colour, key chip, type, shape-coded effectiveness, name, POW, PP; hotkeys `1–4`, `Escape` back), party list of `CreatureCard variant="row"` (switch), bag list filtered by `usableInBattle`, orbs list. Disabled reasons come from `validateAction` (`ActionError` → label table, e.g. `noPp → 'No PP'`, `choiceLocked → 'Choice-locked'`, `trapped → 'Trapped'`). The last 3 log lines render in the deck's "Last turn" ticker with `--t-body-lg` (bad news in `--danger`, the rest paper). Key hints name only the keys live in the open menu. <!-- amended 2026-10-11: Broadcast UI -->

In-canvas (render `HudLayer`, spine Pillar 8: never covered by an effect): both active battlers' HP bars anchored above the billboards with name, level, HP numbers (own side only), status glyph, stage arrows (▲/▼ per stat with count); the turn label; the orb shake counter. The `BattleResultCard` (DOM modal) shows `RewardsSummary` and, for `battleEnd` with `evolveReady`/`learnMove` events in the last turn, the `evolve`/`learnMove` modals queued in order, each an explicit REST call (`POST /creature/:id/evolve`, `POST /creature/:id/moves`) — never automatic.

**The evolution sequence** (amended 2026-10-05; client IMPLEMENTATION-NOTES Part 6, render §10.7.5). Every evolve path — the post-battle prompt, the Party screen's Rare Candy (the server's `evolveReady` item event queues the same prompt, §20.9.3), and later stones and trades — calls `app/evolution.ts` `evolveCreature(creature, into)`: **server truth first** — `POST /creature/:id/evolve` answers, the returned creature goes through the one inventory writer, and only then `playEvolution` stages the response's species; a failed call plays nothing (the `danger` toast names the error code and the prompt stays). The prompt starts binding the new form's atlas when it opens (`preloadEvolution`). World3D registers the player (`scene/EvolutionDirector.ts`): render's `stage.evolve({ from, to, at: the player's feet, reduced: effective reduced effects, cheer: the local player })`. While it plays, `ui.evolution` is set: movement is off and every world action is blocked (`worldBlocked`), the shell hotkeys are ignored, the canvas HUD is hidden (restored to the F1 state after), the open panel and the shortcut hint step aside (§20.9.2), the queued prompts wait, and the avatar faces the creature. A primary click or `Space` / `Enter` / `Escape` skips to the reveal, then to the exit (the keys are swallowed; others pass). Render's phase callbacks arrive from its frame hook and are deferred off the tick (`setTimeout(0)`): `reveal` shows the DOM `EvolutionBanner` — an eyebrow "Evolution" and "<Name> evolved into <Species>!" in the display face (`--t-h2`), bottom-centre over the canvas like a game text box, `role="status"` — replacing the old success toast; `exit` fades it (`--motion-banner`); the end restores the input (unless a battle took over) and clears `ui.evolution`. While the sequence builds up, a black slab with a paper `Space` key chip reads "Space or click to skip" (amended 2026-10-11; was a caption pill). Without a world (no zone, a battle) the banner alone shows for 2.6 s. A battle starting cancels the sequence (render's `dress`). <!-- amended 2026-10-05: client IMPLEMENTATION-NOTES Part 6 -->

**Doubles menu and plates** <!-- amended 2026-10-06 Phase D6 -->. The menu picks per field position — position 0, then position 1 — and its prompt names the creature choosing (`What will X do? (1/2)`); "Back to X" re-opens position 0 before anything is sent (choice: collect both, then send — so a mistaken first pick costs nothing). A single-target move (power > 0 or target `'foe'`, not spread) opens a target list: each standing foe, then the standing ally (never the user), hotkeys `1–3`, `Escape` back to the moves; when only one candidate stands it is taken directly. Spread, self and field moves skip it. Party switches the choosing position's creature; both field creatures read "In battle" ("Fainted" for one fainted in place) and a creature the other position already chose this turn is disabled ("Already chosen"); the replacement phase asks once per required position. Orbs and Run (flee) do not exist in doubles; Forfeit forfeits for both positions. In-canvas: four HP plates (`BattleHud.setLayout(true)`; bar order near 0, near 1, far 0, far 1, numbers on the viewer's two), each anchored over its own battler by render's `HudLayer` (which already places up to 16 bars without overlap); singles keeps two.

### 20.5.7 The encounter transition <!-- amended 2026-10-21 -->

A fresh `battleStart` (never a resync restore, never a replay) writes `ui.encounterFx` = `{ kind, type, reduced }` (`battle/encounter.ts`): the kind from the format and the foe's lead (`wild`, `shiny` for a shiny lead, `legendary` for a legendary or mythical lead, `trainer`, `league`, `pvp`, `raid`), the type the lead's primary type, `reduced` the controller's effective reduced motion. `EncounterWipe` (first child of `BattleOverlay`, `--z-overlay`, pointer-events none, aria-hidden: the panel announces the battle) plays it over the 600 ms push-in and clears it after `ENCOUNTER_MS[kind]`:

- **wild** (760 ms): three slanted slabs sweep the screen left to right in the type colour, carbon and the type's ink;
- **shiny** (1 000 ms): the sweep in shiny gold and the type colour (`--shiny-gold`, `--shiny-light`, tokens.json) with 12 twinkling sparkles;
- **trainer / pvp** (720 ms), **league** (820 ms): carbon shutters close from top and bottom on a seam drawn left to right (hot orange; gold for the league) and open again, the VS card (§20.5.6) following;
- **legendary / raid** (1 300 ms): the world closes to a small iris ringed in the type colour, holds, and opens;
- a white flash opens every kind except under `accessibility.screenFlash = false`; under reduced motion every kind is a 320 ms dark dip instead.

The scene director's weather pass also calls `renderer.setAmbient?(pocket === null)`: render's ambient motes (§10.7.8) stay outdoors. World3D's battle view also calls render's `WorldFx.encounterAt(feet)` for a wild battle outside the arena (render §10.7.8): the tall grass bursts and shakes round the player, or the water sprays.

### 20.5.8 The hit callout <!-- amended 2026-10-21 -->

A move hit that lands in a way worth naming adds a `callout` keyframe (`{ who, kinds, type }`) at the impact, beside the log line: `calloutsOf(crit, effectiveness)` gives `super` (× 2 or more), `resist` (under × 1), `immune` (a move that does not affect the target) and `crit`; a plain hit has none. It is text, not motion: the reduced timeline keeps it. `TimelineTargets.callout?` → `ui.battleCallout` (`{ id, foe, kinds, type, reduced }`, deferred off the tick like the banners, cleared by `reset`) → `BattleCallout` in `BattleOverlay`: a Broadcast lower-third on the hit battler's side (high right for the opponent, low left for the viewer's own): the matchup on a slab in the move's type colour ("Super effective"; carbon for "Not very effective" and "No effect"), a crit as a paper chip ("Critical hit"), in the italic display face, sliding in and out over `CALLOUT_MS` 1 100 ms (appearing and fading without the slide under reduced motion); a new hit replaces it. Decorative (the log says the same): aria-hidden, pointer-events none.

---

## §20.6 IN-WORLD HUD

`HudLayer` (render) draws in-canvas at the end of the frame with the token fonts. The client owns `HudWriter`, which keeps a `HudModel` and calls `renderer.hud.set(partial)` with **only the fields that changed since the last flush** (a per-field dirty bitmask; `flush()` is a no-op when the mask is 0 — this is the "HUD dirty-flag" rule of §20.10).

```ts
// packages/client/src/scene/HudWriter.ts
export interface HudModel {
  readonly party: readonly { readonly speciesId: string; readonly variantKey: VariantKey; readonly hpFrac: number; readonly status: string | null; readonly fainted: boolean }[]; // ≤ 6; top-left strip of 56×76 px cards with the creature's thumbnail sprite (amended 2026-10-11)
  readonly zoneName: string | null;            // display face 48 px, a centre-top lower-third (2026-10-11), banner timing §20.2.6; null after the banner
  readonly timeOfDay: number;                  // 0..1 -> sun/moon glyph + hh:mm in the top-right
  readonly questHint: string | null;           // one line ≤ 60 chars, below the time; from the active quest's first undone objective label
  readonly chat: readonly { readonly name: string; readonly text: string; readonly at: number }[]; // last 6 lines, bottom-left, each fades 8 s after `at`
  readonly prompt: { readonly key: string; readonly verb: string; readonly target: string } | null; // drawn "E" chip + "TALK TO FENKEEPER", bottom-centre (uppercase since 2026-10-11)
  readonly nameplates: readonly { readonly id: string; readonly name: string; readonly guildTag: string; readonly inBattle: boolean }[]; // ≤ 16 nearest; render positions them over actors
  readonly battle: { readonly bars: readonly { readonly who: Ref; readonly name: string; readonly level: number; readonly hp: number; readonly maxHp: number; readonly status: string | null; readonly stages: string; readonly showNumbers: boolean; readonly types?: readonly TypeName[] }[]; readonly turnLabel: string; readonly shakes: number } | null;   // types: amended 2026-09-30 (M2-battle-7)
  readonly connection: 'connected' | 'reconnecting' | 'offline';
  readonly dev: { readonly fps: number; readonly drawCalls: number; readonly gpuMs: number; readonly desyncs: number; readonly rubberBands: number } | null; // F3 in dev builds
}
```

Write cadence: `party` on `applyInventoryDelta` (store subscription → writer field, not React); `zoneName` on `loadZone`; `timeOfDay` at ≤ 1 Hz (rounded to 1/1440 of a day, so the glyph changes once per in-game minute); `questHint` on `applyProgressionDelta`; `chat` on each chat message; `prompt` only when the nearest target id changes; `nameplates` every 500 ms with the nearest-N sort; `battle` from `TimelinePlayer` frames; `dev` at 1 Hz. **DOM is used only for menus, panels, modals, the dialogue box, the chat input and toasts.** No DOM node is created, removed or restyled from `World3D.tick`.

---

## §20.7 AUDIO

### 20.7.1 Graph

```
AudioBufferSourceNode (stem) ─┐
AudioBufferSourceNode (stem) ─┼─> GainNode(stem) ─> GainNode(music) ─────────────────────────────┐
...                            ┘                                                                    │
AudioBufferSourceNode (sfx) ─> GainNode(voice) ─> PannerNode(HRTF) ─┬─> GainNode(sfx) ───────────┼─> GainNode(master) ─> DynamicsCompressorNode ─> destination
                                                                    └─> GainNode(reverbSend) ─> ConvolverNode(zoneIR) ─> GainNode(sfx)
AudioBufferSourceNode (ui) ─> GainNode(ui) ─────────────────────────────────────────────────────────┘
```

All nodes are standard WebAudio (`AudioContext`, `GainNode`, `PannerNode`, `ConvolverNode`, `DynamicsCompressorNode`, `AudioBufferSourceNode`); no library. The context is created on first user gesture (`pointerdown`/`keydown`, once) and `resume()`d; before that every `play()` is a no-op.

### 20.7.2 Mixer table — every value the engine ships

| Bus / parameter | Value |
|---|---|
| master | 0 dB (gain 1.0); compressor threshold −12 dB, knee 6, ratio 4, attack 0.003 s, release 0.25 s |
| music | −6 dB (0.501) |
| sfx | −3 dB (0.708) |
| ui | −8 dB (0.398) |
| duck target (music while `ui.dialogue !== null` or a modal is open) | −9 dB relative; attack 250 ms, release 600 ms, linear ramps |
| battle music swap | world theme fades out 400 ms, battle theme fades in 400 ms, crossfaded; victory cue plays on the ui bus |
| stem `threat` | gain 0 in world, 1 in battle (400 ms ramp); 1 in raid phase ≥ 1 |
| stem `night` | gain = `smoothstep(0.78, 0.82, t) * (1 - smoothstep(0.20, 0.24, t))` over `timeOfDay t`, wrapping so night is `[0.80, 0.22)`; ≈ 115 real seconds per ramp |
| stem `biome` | 1 in the zone's own biome theme; 0 during the 400 ms handover crossfade |
| stem `base` | 1 |
| harvested zone | every stem low-passed at 1 200 Hz (`BiquadFilterNode`, Q 0.7) and `night` forced 0 — the audio equivalent of the flat-shaded look |
| battle mood <!-- added 2026-10-20: music that follows the battle --> | the player's active battler (the lowest of two in doubles) as the timeline's HP bars show it: at or under ½ max hp the `biome` stem × 0.45; at or under ¼ `biome` 0, `base` × 0.55, `threat` × 1.2; a Majin form low-passes every stem at 1 400 Hz (the lower of it and the harvest filter) with `threat` × 1.3; a Tenjin form `biome` × 1.25 (not when critical); every change ramps 900 ms; neutral outside a battle (`stemLevel`, `musicLowpassHz`, `MIXER.battleMood`) |
| panner | `panningModel 'HRTF'`, `distanceModel 'inverse'`, `refDistance 4`, `maxDistance 60`, `rolloffFactor 1.5`, cone omnidirectional |
| listener | position = camera position; forward = camera forward; up = (0,1,0); updated once per rendered frame |
| reverb send | outdoor 0.12, town plaza 0.18, interior (gym/shop/healer) 0.35, cave/shrine/rift 0.50; IR = algorithmic exponentially decaying white noise, 0.5 s outdoor / 1.2 s interior / 2.4 s cave, generated once at boot into `AudioBuffer`s (no IR files) |
| polyphony | 24 simultaneous sfx voices; per-id cooldown 40 ms; per-id concurrency ≤ 4; the quietest (by distance) voice is stolen |
| ui sfx | non-positional; hover 0, click −14 dB, error −10 dB, toast −12 dB |
| loudness target | stems −16 LUFS integrated, sfx peaks ≤ −3 dBTP (enforced by `40-pipelines.md`'s normalise step; the engine trusts the manifest `lufs`) |

### 20.7.3 `AudioDirector`

```ts
// packages/client/src/audio/AudioDirector.ts
export interface AudioDirector {
  init(manifest: AudioManifest): Promise<void>;          // decodes ui + the current zone's sfx set; music stems stream-decoded lazily per theme
  setTheme(themeId: string, crossfadeMs: number): void;  // world theme per zone; 'battle' | 'gym' | 'elite' | 'champion' | 'raid' by format/opponent
  setThreat(on: boolean): void; setNight(t01: number): void; setHarvested(on: boolean): void;
  setBattleMood(mood: { hp: 'steady' | 'low' | 'critical'; form: 'none' | 'majin' | 'tenjin' } | null): void;   // added 2026-10-20: BattleController via BattleView.setMood (battle/mood.ts); null when the battle closes
  duck(on: boolean): void;
  play(sfxId: string, at: { x: number; y: number; z: number } | null): void;   // null = non-positional (ui bus if id starts with 'ui_', else sfx bus centred)
  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number): void;
  setBus(bus: 'master' | 'music' | 'sfx' | 'ui', gain01: number): void;        // from SettingsState.audio, linear 0..1 → applied as gain^2 (perceptual)
  setReverbZone(kind: 'outdoor' | 'plaza' | 'interior' | 'cave'): void;
  step(): void;                                                                  // per fixed step: ramps, voice GC, stem loop scheduling 200 ms ahead
  suspend(): void; resume(): void;                                               // document.hidden → suspend after 2 s; music only, sfx already stop
}
```

Stems loop with two alternating `AudioBufferSourceNode`s scheduled from `loopStartSec`/`loopEndSec` 200 ms ahead of the loop point (no `loop = true` on the source, so the four stems stay sample-aligned). All four stems of a theme start at the same `context.currentTime + 0.05`.

### 20.7.4 Asset manifest — the shape the client consumes (`40-pipelines.md` emits it as `public/audio/manifest.json`)

```ts
// packages/client/src/audio/manifest.ts
export interface AudioClipRef { readonly url: string; readonly urlFallback: string; readonly durationSec: number; readonly bytes: number; readonly hash: string } // url = .webm (Opus 96 kb/s), urlFallback = .m4a (AAC 128 kb/s); chosen once via HTMLMediaElement.canPlayType('audio/webm; codecs=opus')
export interface StemRef extends AudioClipRef { readonly loopStartSec: number; readonly loopEndSec: number; readonly lufs: number }
export interface AudioManifest {
  readonly version: 1;
  readonly builtAt: string;                                                      // ISO-8601
  readonly themes: Readonly<Record<string, { readonly stems: { readonly base: StemRef; readonly threat: StemRef; readonly biome: StemRef; readonly night: StemRef }; readonly bpm: number }>>; // theme ids: one per biome (11) + battle, gym, elite, champion, raid, victory
  readonly sfx: Readonly<Record<string, { readonly clips: readonly AudioClipRef[]; readonly gainDb: number; readonly bus: 'sfx' | 'ui'; readonly maxConcurrent: number }>>; // clips.length 1..4 round-robin variants
  readonly ambience: Readonly<Record<string, StemRef>>;                          // per-biome bed, looped on the music bus at −12 dB
  readonly zoneThemes: Readonly<Record<string, string>>;                         // ZoneId -> theme id; all 21 present (validated at client boot in dev)
}
```

Boot validation (dev only): every `zoneThemes` key is a `ZoneId`; every `MOVE_ANIMS` / `DEFAULT_BY_TYPE` `sfx` id and every `sfx` id the timeline can emit (`hit_*`, `faint`, `switch`, `orb_*`, `status_*`, `stage_up`, `stage_down`, `weather_*`, `ui_*`) exists in `manifest.sfx`. Missing → `console.error` list, boot continues silently for those ids.

`loopStartSec`/`loopEndSec` already include the Opus pre-skip correction (`40-pipelines.md` §40.4.5); the client schedules them against the decoded buffer as-is and applies no offset of its own. Stems are 16 bars by default (32 for `battle`/`champion`, 8 for `raid`/`victory`), so a theme loop is 16–64 s. <!-- reconciled 2026-09-18: 40-pipelines.md OQ-5 -->

---

## §20.8 SETTINGS AND ACCESSIBILITY

### 20.8.1 `SettingsState` (persisted; `persist({ name: 'ewa.settings', version: 1, storage: createJSONStorage(() => localStorage) })`)

```ts
export type Colorblind = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
export type InputAction = 'forward' | 'back' | 'left' | 'right' | 'run' | 'interact' | 'jump' | 'chat' | 'emote1' | 'emote2' | 'emote3' | 'emote4' | 'emote5' | 'emote6' | 'challenge' | 'rotateLeft' | 'rotateRight' | 'party' | 'bag' | 'journal' | 'pause' | 'toggleHud';
export interface SettingsState {
  readonly graphics: { readonly reducedEffects: boolean; readonly renderScale: 0.75 | 1; readonly dof: boolean; readonly bloom: boolean; readonly grain: boolean; readonly chroma: boolean; readonly shake: boolean; readonly hitstop: boolean; readonly slowmo: boolean };
  readonly accessibility: { readonly reducedMotion: 'system' | 'on' | 'off'; readonly colorblind: Colorblind; readonly uiScale: number /* 0.9..1.4 step 0.05 */; readonly battleTextSpeed: 'normal' | 'fast' | 'instant'; readonly screenFlash: boolean; readonly speedrunTimer: boolean /* added 2026-10-20: verified speedruns, default false */ };
  readonly audio: { readonly master: number; readonly music: number; readonly sfx: number; readonly ui: number; readonly muteWhenHidden: boolean }; // 0..1
  readonly keybinds: Readonly<Record<InputAction, readonly string[]>>;         // KeyboardEvent.code values, 1..2 per action
  readonly social: { readonly showChat: boolean; readonly allowChallenges: boolean; readonly allowTrades: boolean; readonly allowDmsFrom: 'everyone' | 'friends' };
  set<K extends keyof SettingsState>(k: K, v: Partial<SettingsState[K]>): void;
  resetKeybinds(): void;
}
```

### 20.8.2 Effective reduced effects — accessibility always wins

```ts
export function effectiveReduced(s: SettingsState, systemPrefersReduced: boolean): boolean {
  return s.accessibility.reducedMotion === 'on' || (s.accessibility.reducedMotion === 'system' && systemPrefersReduced) || s.graphics.reducedEffects;
}
export function effectsFlags(s: SettingsState, reduced: boolean): EffectsFlags {
  return reduced
    ? { dof: false, bloom: s.graphics.bloom, grain: false, chroma: false, shake: false, hitstop: false, slowmo: false, taa: true }
    : { dof: s.graphics.dof, bloom: s.graphics.bloom, grain: s.graphics.grain, chroma: s.graphics.chroma, shake: s.graphics.shake, hitstop: s.graphics.hitstop, slowmo: s.graphics.slowmo, taa: true };
}
```

`systemPrefersReduced` comes from `matchMedia('(prefers-reduced-motion: reduce)')` with a `change` listener; a change re-applies immediately (`renderer.setEffects`, `:root[data-reduced]`, `TimelineCtx.reduced`). Bloom stays available under reduced motion because it is static (Pillar 8 lists grain, aberration, shake, hitstop). Graphics toggles for `dof/grain/chroma/shake/hitstop/slowmo` render disabled with the caption "Off: reduced motion" while `reduced` is true. Test: with `reducedMotion: 'on'` the 600-frame capture of spine Pillar 8 shows zero shake offsets and zero `timeScale !== 1` frames.

### 20.8.3 Colourblind palettes for `TypeBadge` (and the sprite rim through the descriptor)

Three full 19-entry alternates in `tokens.json` under `typeColors.deuteranopia|protanopia|tritanopia`, chosen so every adjacent pair in `TYPE_NAMES` order differs by ≥ 40 in CIELAB ΔE under the respective simulation (checked by `gen-tokens.ts` with the Machado 2009 matrices; the build fails otherwise). Independent of colour, the badge always shows the type's icon (`TYPE_ICON_PATHS[type]`, stroked in the colourblind table's ink; amended 2026-10-11), and the effectiveness chevrons in `MoveButton` are shape-coded (`▲▲ ▲ ▼ ▼▼ ✕`), so no gameplay information is colour-only.

### 20.8.4 UI scale

`accessibility.uiScale` sets `document.documentElement.style.setProperty('--ui-scale', v)` (the one permitted programmatic style write, in `applySettings.ts`) and `renderer.hud.setScale(v)`. Every `--t-*` token is `calc(<px>/16 * 1rem * var(--ui-scale))`. At 1.4 on 1280×720 the panel width formula (§20.2.3) still leaves ≥ 160 px of world visible; the Settings screen previews the scale live.

### 20.8.5 Key remapping

The Settings › Controls table lists every `InputAction` with up to two bindings. Rebinding captures the next `keydown` `code` (`Escape` cancels; `Backspace` clears). Conflicts are rejected with the caption "Already bound to <action>". `Escape`, `Enter`, `Tab`, `F1`–`F12` other than `F1`/`F3`, and browser-reserved combinations are not bindable. `resetKeybinds()` restores the §20.4.5 table. Bindings are stored as `code` strings so layouts (AZERTY) work by physical position; the label shown uses `KeyboardEvent.key` from the capture event.

### 20.8.6 Other accessibility rules

- Every interactive element is reachable by `Tab` in DOM order; panels trap focus while open and return it on close; modals are `role="dialog"` with `aria-modal`, `aria-labelledby`.
- `screenFlash: false` removes the white impact `flash` frames' screen component (the billboard flash remains).
- `battleTextSpeed: 'instant'` sets `LOG_DWELL_MIN` to 0 and `HP_DRAIN` to 0 without touching any other frame.
- Chat and DM text render at `--t-body` minimum; usernames never below `--t-caption`.
- No information is conveyed by motion alone; every animated change also leaves a static result (HP number, log line, badge).

---

## §20.9 SCREENS

Each screen: information hierarchy in one paragraph, then its states. All `/play/*` screens render as the anchored right panel (§20.2.3) over the live world.

**20.9.1 Auth** (`/login`, `/register`). Full-bleed static key-art (`public/keyart/mirevale.ktx2`-derived JPEG, 1440p) with a 420 px `Card` centred-right. Primary: username + password (+ email + starter picker on register). The starter picker is three `CreatureCard variant="showcase"` for `bramblecub / glimfin / cindercap` with type badges and a two-line flavour each; the selection is the largest element on the register form. Secondary: the switch link (login ↔ register). Errors from the action render inline under the field they concern (`username taken`, `bad credentials`); network errors as a single `danger` line above the button. No password rules beyond 8..128 are displayed until violated. The login card links "Forgot your password?" to `/forgot`; `/forgot`, `/reset` and `/verify` reuse this layout (key art, story column, card). While `PlayerProfile.emailVerified === false` the settings panel shows a one-line, non-blocking "Confirm your email" notice with "Resend link" (`POST /auth/resend`) (Phase C6).

**20.9.2 World** (`/play`). The canvas is the screen. HUD per §20.6. DOM elements present: a 56 px top bar with the nav — amended 2026-10-11 (Broadcast UI): five primary `NavLink`s `Party · Bag · Dex · Map · Quests` with the player's own hotkey chips, and a "More" menu (`Box · Shop · Social · Guild · Market · Pass · Settings`, real links; unread counts roll up onto More; focus moves into it on open, arrow keys move, `Escape` closes it and returns focus without closing an open panel) — the money counter (display face, tabular), the trainer level, the badges `n/8`; the chat input (hidden until `T`); toasts bottom-right; `DialogueBox` bottom-centre (a lower-third: black slab, the speaker on an `--accent` strip in the display face — amended 2026-10-11 — `--t-body-lg`, `Enter`/`E` advances, ≤ 3 lines visible, remaining count shown). Empty: a zone with no other players shows nothing extra. Loading: `BootScreen` (§20.10.4) only before the first `/me`; a zone change shows only the banner. Error: `ConnectionOverlay` after 2 s disconnected (§20.3.4). Evolution (amended 2026-10-05, §20.5.6): while the sequence plays, an open `/play/*` panel and the shortcut hint fade out (`visibility: hidden`, so nothing in them takes focus or clicks) and come back where they were; the `EvolutionBanner` sits bottom-centre over the canvas (`--z-toast`, no pointer events).

**20.9.2a Tutorial** (Phase D12) <!-- amended 2026-10-06: Phase D12 -->. Prof. Wynn's step card (`world/TutorialCard.tsx`) over the live world, left edge under the HUD party strip, a black slab headed by a paper label strip with the step count (`n of 7`; amended 2026-10-11, Broadcast UI — was a `--glass` card), a title, her line, the step's key glyphs from the player's own bindings (`kbd`), and a ghost "Skip tutorial". Steps, each completed by a real event the client already sees, latched whenever it happens (a step done early is ticked off when it comes up): walk 8 m (the own `PlayerState` across state patches; jumps over 6 m and room changes do not count) → `met_wynn` (the first_witness beat) → the party panel opened → a wild battle started → a catch (`outcome.winner === 'caught'`, or a second `dexCaught` entry) → a win (`caught` or the player's side) → a heal (`POST /heal` from the party screen or the healer). The card is never modal and takes no keys; it hides while a battle, dialogue or `/play/*` panel is up or the HUD is off; it enters with a 180 ms slide that reduced motion removes. Progress persists per account under `ewa.tutorial` (zustand `persist`, localStorage); finishing the last step (one closing toast) or skipping sets `done` and it never shows again for that account. An account already past the opening — any badge, or a flag set by a story beat after `mire_rival` — is marked done on sight. No story beat, flag or message changes.

**20.9.2b Band tutorial** <!-- amended 2026-10-11: Majin / Tenjin -->. The same card (`world/BandTutorialCard.tsx`), started the first time a Majin Band or Tenjin Band is in the inventory (Majin first when both): three steps each, ticked by real events — the party panel opened, a battle with a creature of that form kind on the player's field, a transformation of that kind by the player. Skippable; a transformation completes it. Persisted per account under `ewa.bandTutorial`, separate from `ewa.tutorial`.

**20.9.3 Party** (`/play/party`). Amended 2026-10-11 (Broadcast UI): a row of six cards in slot order (a slab of the lead type's colour with the sprite and slot number, name/nickname, level, a skewed HP bar with the number, status, held item), keyboard-reorderable (`Alt+↑/↓`, and `Alt+←/→` along the row; "Set lead" reuses the reorder request) and pointer-draggable; reorder commits with `POST /party/reorder` on drop (optimistic order, revert on error). Below the row, a full-width detail band for the selected creature — identity and flavour; stats as big numbers with skewed bars (`calcStat` from core for display, marked "at level"); moves as type-tagged rows with PP, ability + held item selects (`POST /creature/:id/setup`), nickname (`POST /creature/:id/nickname`), favourite/lock toggles (`POST /creature/:id/flags`), release (`danger`, confirm modal, refused when locked). Empty: impossible (party ≥ 1). Loading: none (store). Error: toast. Field items (amended 2026-10-05): the detail's "Use an item" section uses Rare Candy and the other field items through `POST /item/use`; an `evolveReady` event in the answer queues the explicit evolve prompt (§20.5.6), and accepting it plays the evolution sequence in the world behind the panel, which steps aside until it ends (§20.9.2).

**20.9.4 Box** (`/play/box`). A 10-column tile grid (`CreatureCard variant="tile"`, 72 px) paged 60 per page (`?page=`), with a sticky filter row (search by name/species, type, sort by level/dex/recent). The party strip is pinned at the top of the panel so deposit/withdraw is one drag or two clicks (`POST /party/withdraw`/`deposit`, `POST /party/swap` when the party is full and a slot is targeted). Selecting a tile shows the same detail column as Party. Empty: "Your box is empty — creatures you catch with a full party arrive here." Loading: skeleton grid. Error: toast + retry button in the panel header.

**Form marks** <!-- amended 2026-10-11: Majin / Tenjin -->: `ui/FormSigil.tsx` (`FormSigil`, `FormMark`) — a crimson cracked ring (Majin) or a gold ring with a lens (Tenjin), labelled "Has a Majin Form" / "Has a Tenjin Form" — on creature rows and box tiles (so the battle party list too), the Party lineup card and the Dex grid; a Dex entry of such a species gets a short "Battle form" section (the form's name and its one-line rule).

**20.9.5 Dex** (`/play/dex`) — *witnessing framing*. Header: "Witnessed **N / 141**" <!-- amended 2026-10-13: hyoryu (#138) --> <!-- amended 2026-10-24: cryptorb, ultraze, vysion (#139–141) --> in display face with a segmented bar (caught solid, seen-only hatched, unknown empty) — this is the theme's win condition, so it is the largest number in the UI. Below: a 6-column grid in `dexNumber` order; unknown species render as a dark silhouette with `#???`; seen species show the sprite desaturated with the name; caught species show full colour with variant chips (up to 4 palette dots) and an alpha mark, plus a sparkle mark for a shiny catch (Phase D4, GET /dex `shiny` → `Progression.dexShiny`). Filters in the URL (`?type=&state=caught|seen|unknown|shiny&q=`; `shiny` = species with a shiny catch). Selecting an entry opens a right detail: flavour text, types, evolution chain (arrows; unknown stages silhouetted), zones where recorded (from `dexEntries` caught zone), and the line "Recorded — this one cannot be quietly lost." for caught entries versus "Seen, not yet recorded." for seen. Empty: never (130 rows). Loading: skeleton grid. Error: panel retry.

**20.9.6 Shop** (`/play/shop`). Two tabs (`?tab=buy|sell`). Buy: a `Table` of stock (icon, name, one-line effect, price mono) with a quantity stepper (1..99) and a running total against the money counter; the row's buy button is disabled with the caption "Not enough" when `qty × price > money`. Sell: the inventory filtered to `sellPrice > 0`. Each transaction is one `useFetcher` action; the response is applied through `applyInventoryDelta`. Empty: "Nothing to sell." Loading: skeleton table. Error: 404 → "There is no shop here" (the panel still opens, so the URL is honest); other → retry.

**20.9.7 Social / DM** (`/play/social`, `/play/social/:username`). Left 320 px: three tabs (`Friends · Requests (n) · Nearby`); friends show online state (from `GET /friends`, refreshed on focus) and unread DM counts; each row has `Message · Challenge · Trade` (the latter two enabled only when the player is in this zone: `room.state.players.has(id)`, read via `useRoomState`). Right: the DM thread (`GET /messages/:username?limit=50`, older loaded on scroll-top with `?before=`), composer at the bottom (`POST /messages/:username`, 1..300 chars, counter visible from 250). Incoming DMs arrive as the `30-server-netcode.md` room message `dm` → `notifications.unreadDm` + thread append when open. Empty: friends "No friends yet — add someone by username" with the request field focused; thread "Say hello." Loading: skeleton rows. Error: retry.

**20.9.8 Guild** (`/play/guild`). No guild: search (`?q=`) + create form (name 3..24, tag `[A-Z0-9]{3,4}` validated live, the 5 000 founding cost shown on the button and disabled with "Not enough" below it) side by side. <!-- reconciled 2026-09-18: tag {3,4}, cost 5000 --> In a guild: header (name, tag, member count, MOTD editable by leader/officers), a `Table` of members (name, role, trainer level, last seen) with role actions gated by the viewer's role (`kick`/`promote`), and a `Leave` button (`danger`, confirm; leaders must promote first). Empty search: "No guilds match." Loading: skeleton. Error: retry.

**20.9.9 Marketplace** (`/play/market`, `/play/market/:listingId`). Filter bar bound to URL params (`search, variant, isAlpha, isShiny, levelMin, levelMax, sort, page`; `isShiny` Phase D4); results as `Table` rows (sprite, species/level, variant/alpha/shiny chips, current bid, buy-now, time left mono, seller). Tabs `Browse · My listings · My bids`. The detail route shows the creature card, full bid history, a bid field pre-filled with `max(startingBid, currentBid + 50)` and buttons `Bid` / `Buy now` / (own) `Cancel`; list-from-box modal picks a box creature, starting bid ≥ 100, optional buy-now, duration `12 | 24 | 48` h; fee 5 % shown before confirm. Rate-limit responses (`5/h list`, `30/h bid`) render as the exact remaining-time caption. Empty: "No listings match — widen the filters." Loading: skeleton rows; the previous page stays visible under a 0.6 opacity while a new page loads. Error: retry.

**20.9.9a Quest journal and achievements** (`/play/quests`, Phase B3 + D5). Two tabs (`?tab=` absent = Story, `achievements`). Story: the `STORY_QUESTS` grouped by act (cards with objectives, rewards, Track, Claim), claimed ones in a compact list. Achievements: the `ACHIEVEMENTS` rows — ready ones as cards with Claim (`POST /quests/claim`, the same route action), the rest as one row each (title, summary, a bar and `value / target`: a single-objective milestone reads its count, a multi-objective one the objectives done), then the earned list. The tab labels carry the ready counts; the panel eyebrow sums both. Achievements never drive the untracked HUD hint (a tracked one does). The profile (`/play/profile`) lists the same rows earned-first with `N of 30 earned`. Shinies (Phase D4): a shiny spawn's billboard sparkles (`SpriteDescriptor.isShiny`), its label reads `shiny …`, a shiny battler's switch-in plays `shiny_sparkle` with the line “… sparkles — it’s a shiny!”, and `CreatureCard` shows a sparkle badge.

**20.9.9b Rankings and the ranked queue** (`/play/rankings`, Phase C4 + D13) <!-- amended 2026-10-06: Phase D13 -->. Above the leaderboard tabs, the ranked block (`screens/RankedPanel.tsx`): heading "Ranked battle" with the player's rating (display face, tabular — amended 2026-10-11; from the session), then one of three states driven only by the server's `rankedStatus` (`state/ranked.ts`, written by the message router, reset when the world connection ends): idle — one line of copy and a primary "Find a match" (`rankedQueue { join }`), disabled with a caption in a battle, with no creature able to battle, or offline; queued — "Searching" elapsed `m:ss` (counted locally from `waitedMs`) and "Rating window ±N" (`rankedWindow(elapsed)`), and "Leave queue" (`rankedQueue { leave }`); matched — "Match found: <name> (<rating>). Heading to the arena." (a match that has not become a battle after 30 s reads as idle again). Toasts: match found (success), `busy` / `party` refusals (warn), `cancelled` (info); `left` and `started` are silent. The battle itself is the normal pvp battle (§20.5).

**20.9.9c Post-game: league rematches and the battle tower** (Phase D14) <!-- amended 2026-10-06: Phase D14 -->. Rematches: `scene/dialogue.ts` `rematchOffer(leagueId, flags, badges)` mirrors the server's `leagueBeaten` (the champion flag held and the trainer beaten — gym: its badge; Warden / Champion: its `setsFlags`, plus the champion flag for Zeon); `gymPlan` then opens the rematch's `pre` lines and challenges on finish (the client cannot see the 1-day cooldown — a rematch asked too soon is refused by the server's toast after the lines). A won rematch (`rematchOfBattle(state, seat)`: the NPC party equals the `LEAGUE_REMATCH` team) shows the rematch's `post` lines after the result card, and the result card's concession line is `post[0]`; no badge glyph. The tower: the league hall foyer's Tower Attendant is a `tower` interactable (range 2.5); before the Champion it only talks; after, paging past its line opens `ui.modal 'tower'` (`world/TowerModal.tsx`, rendered only while no battle is open). With no run (`ui.tower null`) it is the picker — the party as `CreatureCard` rows, three picks in click order (a numbered corner tag; a fourth click is ignored, a second click un-picks), "Start run" sends `tower { start, picks }`. The message router writes every `towerState` to `ui.tower`: `fighting` closes the modal (the battle covers the world), `won` / `lost` / `ended` open it — between fights it shows the streak and best (display face, tabular — amended 2026-10-11), the fight just cleared ("Set s · fight f of 7"), the set reward when one was paid, the tower team, and Next fight (`tower next`) / Retire (`tower quit`); a lost or retired run shows its summary (run wins, best) and Close clears `ui.tower`. During a tower fight `TowerStreak` sits top-left under the top bar: "Battle tower · Set s · fight f of 7 · Streak n" on a black strip with a paper "Battle tower" block and the streak as a big number (amended 2026-10-11; was a `--glass` strip), no motion. The NPC side's name is `TOWER.trainerName`. Rankings (§20.9.9b) gain a fourth tab, Tower (`?mode=towerStreak`), whose leading column is the best streak (`towerBest`).

**20.9.9d Arena PvP — battles outside the world** (`/play/pvp`; 30-server-netcode.md §30.4.10) <!-- amended 2026-10-12: arena PvP -->. Entry: "PvP" in the More menu (key `K`, `InputAction 'pvp'`, rebindable) and an "Open PvP" strip on Rankings; the in-world PvP (walk-up challenge, §20.9.9b's ranked block) is unchanged. The screen (`screens/PvpScreen.tsx`, data `GET /arena`): a rating strip (rating as the hero number, peak, ranked matches, the party as sprites), then cards — Standard (own levels), Level 50, Ranked (Lv 50; the rating window while queued), Weekly Cup (this week's cup, its rule and time left; pre-checked with content `cupRefusal(party, weeklyCup(now))` and showing why it is locked), Training (levels own / Lv 50 × difficulty easy / normal / hard → `POST /arena/training` → straight into the arena), Challenge a friend (online friends from `GET /friends`, levels → `POST /arena/invite`; pending / declined / expired). Gates: an empty party, a battle, a trade, being in an arena, offline (a fainted party may enter: arena teams are healed copies). One queue at a time; while queued the player may close the screen and walk on — a top-bar chip shows the mode, elapsed time and × (leave). `arenaStatus matched` → a 2.6 s "Match found" card and the switch. A friend's `arenaInvite` opens a modal with a countdown to `expiresAt` (Accept / Decline → `POST /arena/invite/reply`; it declines itself when `allowChallenges` is off or the player is busy); `arenaInviteResult` toasts for the inviter.

**20.9.9d+ The daily challenge** <!-- added 2026-10-20 -->. A card on the PvP screen (data `GET /daily`, loaded with the screen; a server without it shows no card): "Daily challenge #N", Lv 50, the two teams as sprites with "vs" between, then Par, your best (or "not won yet"), tries, how many have won today and when the next daily comes; a best shows its strip (`K` / `L` / `X` / `.` per turn, mono, wide tracking). "Play today's daily" ("Try again" after the first try) → `POST /daily/start` → the arena; Copy result copies "Ewamon Daily #N: won in T turns (par P)" and the strip, nothing that names the teams. In the arena the strip says Daily challenge · Lv 50 · vs Daily Rival (content `ARENA_DAILY`, a `suit_male` stand-in); the result card refetches `GET /daily` and shows today's best against par with Copy result; its again action is "Try again". Rankings gains a Daily tab (`?mode=daily`) whose leading column is the turns with the strip beside it.

**The switch** (`net/WorldSession.ts`, `app/arena.ts`, `state/arena.ts`): one session holds the zone room or one `arena` room (`kind`). `enterArena(seat)` retires the zone room (a consented leave — the server writes the position; no offline / kicked state), consumes the seat with `ArenaState` and wires every server message as before; `room` stays the zone room only (null in an arena), so no `ZoneState` reader sees a foreign state. In an arena `send()` passes only `battleAction` / `battleResync`, and `enter()` is a no-op (a shell remount must not forfeit). `returnToWorld()` leaves the arena and enters the zone the player left. A reload mid arena: `POST /zone/enter` 409 `inArena` → `POST /arena/rejoin` → the arena; a scene built after the rejoin asks for its own `battleResync`. Queue again from inside an arena hops rooms.

**The scene** (`scene/World3D.ts`): the zone is unloaded and render's stadium (§10.7.5a) is the zone root with `ARENA_LIGHTING` / `ARENA_GRADE` and `ARENA_BACKDROP.timeOfDay`; the ring dresses at the origin with `ARENA_BACKDROP.terrain`; the player's trainer waits at the near slot; the opponent is a `FoeActor` stand-in with the other player's body (Training: a look per difficulty, name from `ARENA_TRAINING`). Gym theme between battles (elite for Ranked / Cup), battle theme in battle. The boot overlay covers both switches. Minimap, key legend and tutorial cards hide; Map fast travel is disabled. HUD (`world/ArenaOverlays.tsx`): a top-centre strip (Arena · kind · level · vs opponent), a waiting card until both trainers arrive, and after the result card (which gains the kind / level) the actions Back to world and Queue again / Rematch (Training) / Challenge again (friend). `arenaState cancelled` toasts its reason and returns home. History rows with `arena` read "Arena · <kind>".

**20.9.9f Creature history** <!-- added 2026-10-20: creature history -->. The creature detail (Party's band: a sixth tool card; Box's column: after Identity) and a marketplace listing ("The creature's history", above the bid history) show `screens/CreatureHistory.tsx` (data `GET /creature/:id/history`, fetched when the creature is shown): "Original trainer" and the name in the display face ("Not recorded" for a creature older than the history), then the events newest first on a left rule, each a sentence with a relative time: "Caught by <trainer> on <zone> at level <n>." / "Received by <trainer> at level <n>.", "Traded from <a> to <b>.", "Sold by <a> to <b> on the market.", "Given by <a> to <b>.", "Evolved from <x> into <y>.", and in paper bold (the accent stays selection only) "In the party that won the <badge> Badge.", "In the party that beat the Champion.", "In the party that caught / defeated <legendary>." Empty: "Nothing recorded yet: this creature is older than the history." Loading: skeleton rows. Error: one caption line.

**20.9.9g Challenge modes** <!-- added 2026-10-20 -->. Register gains "Challenge run" (Normal / Nuzlocke / Hardcore, a `Segmented` under the starters, the chosen mode's rules in one caption, sent as `challenge`). Profile gains a Challenge run section (`screens/ChallengeSection.tsx`): the same switch while the run can change (`POST /challenge`, then GET /me refreshes the session), else the mode and where it stands with the reason it is locked ("Your first badge locked the run." / "A creature has fallen: the run is locked."). The top bar shows the run as a pill beside the zone chip ("Nuzlocke", "Hardcore · Cleared", "Nuzlocke · Failed" in the danger tone). A fallen creature carries the "Fallen in the run" mark (CreatureCard, Party), its detail replaces Use an item with a Fallen note, and the box offers no Withdraw for it. In battle Orbs is disabled once the zone's first encounter is spent (`canCatch`), and Bag is disabled in an active Hardcore run. Rankings gains Nuzlocke and Hardcore tabs ("Cleared · n badges" / "Failed · n badges" / "n badges").

**20.9.9s Camp bases** <!-- added 2026-10-22 -->. The campfire's target opens `/play/camp` (`screens/CampScreen.tsx`, `GET /camps`), a `Panel` titled "Camp" with "<route> · Travellers' camp" above. This camp: a free one says "Nobody holds this camp" with "Claim this camp" (sends `camp { action: 'claim' }`; disabled with the reason when the player holds one or is on a challenge run); someone else's is a camp card (a paper strip "Held by <owner>", the banner name in the big italic display face, the route and when it was claimed, its trophies as small labelled plates, the guard as sprites on their type-colour slabs with levels), the stakes in words ("A win takes 120 from bh_outlaw. A loss takes nothing. Raiding costs your lead 1 honor and darkens the route.", with ", and the camp itself" for an owner long away) and "Raid the camp" (sends `camp { action: 'raid' }` and closes the panel for the battle) or why not (the owner is in the world, on a challenge run, raided today, the player on a run). Your camp: the same card with a Banner field ("Raise banner"), the earned trophies to pick (up to three, the picked ones ringed in the hot orange, "n of 3"), "Set trophies" (`POST /camps/edit`; a refusal shows under the field, e.g. a blocked word) and "Abandon camp" (asks again: "Break camp for good"; `POST /camps/abandon`). The camp log (each raid's line and when) and Camps held (every banner in the world with its route and owner). With camps off the screen says the camps are quiet. The camp guard's battle identity is "<owner>'s guard" (title "Camp guard"); the raid's toll and the camp log come as toasts from the server.

**20.9.9r The bounty board** <!-- added 2026-10-21 -->. The Marshal (an interior "Talk to" NPC in each town's office hall, spine §3.17) pages through his two lines, then opens `/play/bounties` (`screens/BountyScreen.tsx`, `GET /bounties`), a `Panel` titled "Wanted" with "<town> · Marshal" above. A strip says whether a Lawlander rides with the party ("every bounty pays a quarter more") with when the board posts again and "n of 3 claims today". On the board: one poster per bounty, a carbon card under a paper "Wanted" strip (nemeses: "Wanted by you"), the creature on a slanted slab in its type colour, the target in the big italic display face, species, level and where it haunts, the record ("Beat n trainers this week." / "Rank n nemesis."), the reward in big tabular numbers with "n with a Lawlander" (brighter when the party holds one), who posted it ("Posted by the board", "Posted by <name>", "Your poster") and when it comes down. Wanted by you: the player's own nemeses from rank 2, with "Nobody else can see these posters". Post a bounty: without a Badlander, the Marshal's line; outside a town, where to post; else the ghosts haunting now (sprite on its type edge, name, zone, level, wins, "wanted"; the picked one ringed in the hot orange), a Bounty field with the cost in words ("Costs 1,000: the 800 bounty and the board's 200 cut, held until it is claimed. Unclaimed after 72 hours, all of it comes back."), "Post on <name>" and "n of 3 posters up"; a refusal shows under the field in the Marshal's words (`BOUNTY_REFUSAL_TEXT`), a post applies the money. Your posters (up until, brought in by, came down with the refund) and Brought in (the latest claims). The claim itself is a toast after the battle; the history line: "Brought in <target> on <zone> for a n bounty." (", a nemesis," for one).

**20.9.9q A living ecosystem** <!-- added 2026-10-21 -->. The Dex opens with "This week on <zone>" (`screens/EcosystemPanel.tsx`, `GET /world/ecosystem/:zoneId`) between the witnessed count and the grid: a carbon board headed by a paper "This week on" strip and the zone in the big italic display face, "Season n · week n of 4 · until <date>", and a zone picker over the zones with wild creatures the player has been to (`data/ecosystem.ts` `ecoZones`; where they stand first, else the last one visited). One line says how many catches and knockouts the zone saw this week and whether that is enough to judge ("Quiet so far: below 12, nothing is scarce yet."). Four columns (the client is desktop only, 1280 px and up): Surging (the predators feeding on overhunted prey, a paper "+n%" tag with an up arrow, "Hunts <prey>"), Scarce (overhunted, a graphite "-n%" tag, "n caught · n knocked out this week", or "Gone to <zone> for the season"), Migrated in (a hot "New" tag, "From <zone>, for the season") and Honor tilt (the shadow or light line, "Clear: ..." when neither, and the creatures drawn by it). Each creature sits on a slanted slab in its type colour; one the player has not seen is a silhouette named "???" and cannot be picked; picking one opens its Dex entry. Nothing shows before the server answers, while it runs without the ecosystem, or before the player has been to a zone with wild creatures.

**20.9.9p Nemeses** <!-- added 2026-10-21 -->. `nemesisAmbush` stores the taunt (`state/nemesis.ts`); `battle/NemesisTaunt.tsx` shows it over the battle it opened (never another; dropped when that battle is gone) as a broadcast lower third bottom left, above the command deck: the hot "Nemesis" slab, "Rank n" on black, the scar on a paper strip; the plate with its sprite on a slanted slab in its type colour, the name in the big italic display face and the title under it; the taunt on a paper strip. It enters after the encounter wipe (700 ms), holds 6.5 s, slides out; non-blocking, announced once as a status (name, title, rank and taunt). `nemesisNews` is a toast, held while the battle UI is open and told once the player is back in the world: "The <Species> got away. It will remember you: <name> <title>.", "<name> <title> got away again. It is rank n now.", "... is beaten. Your creature keeps the trophy.", "You caught ... It keeps its name and its scar.", "... has faded. A newer nemesis took its place.". The Profile adds Nemeses (`screens/NemesesSection.tsx`, `GET /nemeses`, reloaded on each news): one carbon row per nemesis with its sprite on its type colour, name and title, the hot Rank tag, the paper scar tag, species, level and the move it gained, what it remembers ("Knocked out your <creature> with <move> on <zone>." / "Broke out of your <orb> in front of <creature> on <zone>."), "Last seen on <zone> <when>" and where it rose; with none, how one rises. A caught nemesis's detail shows its scar (`ScarNote`: the scar's tag, its line, "A mark from its days as a nemesis."). History lines: "Struck down <name>, a rank n nemesis <Species>, on <zone>. A trophy." and "Once <name>, a rank n nemesis, caught on <zone>."

**20.9.9o Breeding** <!-- added 2026-10-21 -->. The Daycare keeper in Mirevale's house 1 is a "Talk to" interior NPC; paging past her lines opens `/play/daycare` (`screens/DaycareScreen.tsx`, `GET /daycare`): "Left with the keeper" as two slots (sprite, name, level, the first marked "its family hatches", Take back); the keeper's verdict strip (the egg drawn when they get along, "They get along. Their eggs hatch into <species>." or the refusal's line, the Bandborn tag, "The next egg in about n min", a ready egg turns the strip's edge orange with "Take the egg"); Your eggs; Leave one (party and box, fallen left out, the last party member disabled). The Party screen shows the carried eggs ("Eggs you carry", n / 3 carried) and the Box the waiting ones (`screens/EggShelf.tsx`): a drawn egg (`ui/Egg.tsx`: paper shell, carbon zigzag band; bandborn: gold band, crimson crack), "<parent> × <parent>", a steps bar with "n steps to go", To box / Carry. `eggHatched` queues the hatch reveal (`world/HatchReveal.tsx`, never over a battle): the egg rocks, cracks, a paper flash, then the hatchling's sprite and the broadcast banner "Hatched / <Species> hatched!", its parents, Shiny / Bandborn tags and where it went; Space / click skips, Continue closes; the world's `ui_evolve_start` / `ui_evolve_done` cues. A bandborn's detail says so (`BandbornNote`); its transform toggle offers the band whose line is met (`battle/transform.ts` over core `bandsFor`). The history line: "Hatched by <trainer> at <town> from <parent> and <parent>."

**20.9.9n Ghost trainers** <!-- added 2026-10-20 -->. A ghost foe (`ghost:<username>`) is shown as "<username>'s ghost", title "Ghost trainer" (`battle/foe.ts`). The Profile adds Your ghost (`screens/GhostSection.tsx`, `GET /ghost`) once the player has a ghost or fights: what a ghost is; "It haunts <zone> since you left <when>." with the party's sprites; "Record: n won, n lost."; the latest fights as "Won / Lost against <name> on <zone>, <when>". The report on coming back is the server's toast.

**20.9.9m One roaming legendary per season** <!-- added 2026-10-20 -->. The World map reads `GET /legends` and tags the route the roamer is on "<species> seen here" (accent outline), with a hover line; the Dex entry of a roamer species (seen or caught) adds a Roaming legend section (`screens/RoamerNote.tsx`, `data/legends.ts`): "Season n: <species> roams the routes. Last seen on <route>. The first trainer to catch it is remembered." while it roams, and "Season n: first caught by <name>." for every season it was caught first. The first catcher's toast comes from the server.

**20.9.9l Majin vs Tenjin seasons** <!-- added 2026-10-20 -->. `/play/factions` (More menu "Factions", and a "Majin vs Tenjin" link on the Rating board's season panel; `screens/FactionsScreen.tsx`, data `GET /factions`): the score as "Majin n" against "n Tenjin" over a tug-of-war bar (Fire crimson against warn gold, widths by points), members and what earns points, who holds Solenne's sky; one card per side with its name, motto, creed and best five, the player's own marked "Your side · n points"; before a side is taken each card has "Side with the <side>" (`POST /factions/join`, then a toast) and a line that the side holds until the season ends; the Chronicle of closed seasons, or that none has ended. In Solenne the scene asks `GET /factions/sky` once a season (`scene/factionSky.ts`) and renders the side's sky (`SceneDirector.setSkyMood`, outdoors; render §10.3.7).

**20.9.9k Honor shapes the world** <!-- added 2026-10-20 -->. The scene renders `ZoneState.shadow` outdoors (`SceneDirector.setShadow` → `renderer.setShadow`, 0 in a pocket; render §10.3.7). Arriving in a shadowed zone, or its level rising, toasts `shadowNotice` ("A shadow lies over <zone>. Catch, spare and win fair to lift it.", a deeper line at 3, the Hollowing at 4); the shadow lifting toasts "The shadow over <zone> has lifted."; easing says nothing. At level 4 the client adds `HOLLOWED_FLAG` to its flag set, and in Vesperveil (`HOLLOWED_TOWN`) its people say `HOLLOWED_LINES` (after any story beat, before their reactions). The World map reads `GET /world/shadow` and tags each shadowed zone "Shadow n" ("Hollowed" at 4) in the Dark type's colour, with a hover line saying why, and its legend explains it.

**20.9.9j Seasons and watching live** <!-- added 2026-10-20 -->. The Rating board heads its table with the season (`screens/SeasonSection.tsx`, `GET /seasons`): "Season N", "League Finals week" (accent) or when it starts, when the season ends, a line on what the end does, the top eight so far as numbered rows (name, rating, wins-losses; the leader's number in the accent) and one line per closed season ("Season N: <name> Champion (<rating>) · Finalists ..."). Profiles (own and public) show Season titles as pills (`SeasonTitles`, the Champion pill in the accent: "Season 2 Champion", "Season 1 Finalist · 4th"); nothing without one. PvP ends with a Watch live card (`screens/LiveMatches.tsx`, `GET /arena/live` every 10 s while open): one row per match, both names with ratings, the mode or "League Finals" (accent) and the turn, and Watch, which opens `/play/watch/:matchId` (`screens/WatchScreen.tsx`, data `GET /arena/live/:matchId`: who plays whom, Live match or League Finals, mode, ratings, turn, and Watch; a gone match or one this client cannot reproduce says so). Watch follows the match in the world through the replay path (`battle/live.ts`): the feed plays as a replay with battle id `replay:live:<matchId>`, every 2.5 s the feed is read again and `extendReplay` plans the longer replay and plays the new turns; the feed's outcome brings the `battleEnd`. A feed that stops reproducing ends the watching with a toast. The `ReplayBar` reads Live (red tag) then Final, marks League Finals, counts `Turn n` and its Copy link copies `<origin>/play/watch/<matchId>`. A watcher is nobody's side (`spectatorNames`, battle/replayId.ts): the battle's last line reads "<name> won the battle!" and the result card "<name> wins", "End of the match.", "Watching changes nothing in your game." (a shared replay keeps its sharer's point of view).

**20.9.9i Weather from real life** <!-- added 2026-10-20 -->. Settings gains a World tab (`?tab=world`) with one section (`screens/WeatherSection.tsx`): what it does and that only the place goes to Open-Meteo; the picked city with its weather now ("Rain there right now.") and Turn off, or "Off: the world follows each zone's own weather"; a search field (2+ letters, `GET /weather/cities`) whose places are buttons that pick (`POST /weather/city`). `realWeather` from the server goes into `useRealWeatherStore` (messageRouter; reset when the world connection ends) and World3D renders it instead of `ZoneState.weather` (null: the zone's again).

**20.9.9h Verified speedruns** <!-- added 2026-10-20 -->. Settings (Accessibility) gains "Show the speedrun timer" (`accessibility.speedrunTimer`, default off): the top bar then shows the play clock beside the zone chip, read from `GET /speedrun` on every (re)connect and counted on each second while it runs and the world is connected (the Champion time once reached). Profile gains a Speedrun section (`screens/SpeedrunSection.tsx`): the time in the display face ("to the Champion" / "played so far" / "played"), a line saying it is timed by the server (or that the run starts with the first story beat, or that this account was already past it), and the splits as name / time rows (a beat by its id and zone, a badge by name, Champion). Rankings gains a Speedrun tab (h:mm:ss).

**20.9.9e Battle replays** (`/play/replay/:token`) <!-- added 2026-10-20: battle replays -->. History's battle rows end with Watch and Link: each first shares the battle (`POST /history/battles/:battleId/share`; a 409 toasts why there is no replay); Watch opens `/play/replay/:token`, Link copies `<origin>/play/replay/<token>`. The replay panel (`screens/ReplayScreen.tsx`, data `GET /replay/:token`, which needs no account; a signed-out visitor goes through `/login?next=`) names both sides (a wild side as "Wild <species>"), the format, turns and when, says the sharer's result, and offers Watch (disabled in a battle) and Copy link. An unknown token says "No replay here"; a replay that does not reach its `finalDigest` with this client's core and content says it was recorded with another version. Watch closes the panel and plays the battle in the world (`battle/replay.ts`): core `replayBattle` gives every step, and the session's `inject` hands the scene `battleStart`, then one `battleEvents` each time the previous step's timeline has played (the controller leaves `playing`), then `battleEnd` (no rewards), as the server would. The battle id is `replay:<token>`: `WorldSession.send` drops anything for it, the controller's `submit` ignores it, and the replay's creatures have no owner, so no evolve / learn-move prompt is queued. In place of the menu the `ReplayBar` shows the "Last turn" ticker over a slab with "Replay", both names, `Step n of N`, Pause / Resume, Copy link and Exit; the result card reads "End of the replay." and "A replay changes nothing in your game."

**20.9.10 Battle Pass** (`/play/pass`). Header: trainer level (display face) and a progress bar to the next 1 000 exp with the exact `exp / 1000` in the display face, tabular (amended 2026-10-11). A horizontal track of 100 reward tiles (virtualised, 10 visible), each `claimable · claimed · locked`; claimable tiles pulse once (160 ms) on entry. Level 50 shows the mythical choice as two `CreatureCard variant="showcase"` (`lumyth / noxmyth`) with "Choose once" — `POST /battle-pass/mythical-choice`. Claim → `POST /battle-pass/claim` → `applyInventoryDelta`. Empty: never. Loading: skeleton track. Error: retry.

**20.9.11 Settings** (`/play/settings`). Six tabs (`?tab=graphics|audio|accessibility|controls|social|world`; World added 2026-10-20, §20.9.9i). Every control is a `Toggle`/`Slider`/`Table` from §20.2.4 bound to `useSettingsStore`; changes apply immediately (no Save button) and the graphics tab shows the live `renderer.stats()` (draw calls, GPU ms) under the toggles. Accessibility tab first item: the reduced-motion tri-state with the current system value shown. Controls: the remap table (§20.8.5). Empty/loading: none. Error: none (local).

**20.9.12 Admin** (`/admin`). Not a `/play` child (no canvas; admins moderate from a plain page). Stats cards (total, banned, verified, online), a player search `Table` (`?q=&page=`) with `Ban`/`Unban` actions requiring a reason (1..200 chars). 403 → redirect to `/play`. Empty: "No players match." Loading: skeleton. Error: retry.

**20.9.13 Empty, loading and error states — the shared vocabulary**

| State | Component | Rule |
|---|---|---|
| Loading (first) | `Skeleton` blocks matching the final layout (rows/tiles/table), `--bg-2` with a 1.2 s shimmer (0 under reduced motion) | Shown only when `useNavigation().state === 'loading'` and no prior data; never a spinner overlay; never over the canvas |
| Loading (refresh) | previous content at opacity 0.6 | Filter/page changes |
| Empty | `EmptyState { icon, title, hint, action? }` — title `--t-h3`, hint `--t-body` in `--text-2`, one optional `Button` | Every list/table/grid passes `empty` explicitly; no silent blank panels |
| Error (route) | `RouteError` — title from `isRouteErrorResponse(err) ? err.status : 'Something broke'`, detail line, `Retry` (`useRevalidator().revalidate()`), `Back to world` | Rendered by the child route's `errorElement`, inside the panel |
| Error (action) | inline line under the control or a `danger` toast (`ttlMs` 6 000) | Field-specific when the server names a field |
| Offline | `ConnectionOverlay` (full-panel scrim, not over the canvas HUD) | After 2 000 ms in `'reconnecting'`; attempt counter visible |

---

## §20.10 PERFORMANCE RULES

### 20.10.1 Client-owned frame budget (main thread, ms per frame at 60 Hz; render's own 10.0 ms budget is in `PLAN.md`/`50-verification-budget.md`)

| Stage | Budget | Measured how |
|---|---|---|
| `input.sample + step` (prediction, ring buffer, message send every 3rd step) | 0.30 | `performance.now()` bracket, dev HUD p95 |
| `remotes.step` (≤ 48 actors interpolated) | 0.25 | same |
| `battle.player.step` | 0.30 | same |
| `audio.step` | 0.10 | same |
| `hudWriter.flush` (dirty fields only) | 0.20; 0.00 when the mask is 0 | same |
| React commit work on the 60 Hz path | **0.00** — asserted | `React.Profiler` in dev: any commit whose trigger stack includes `World3D.tick` fails the perf test |
| **Total client-owned** | **≤ 1.5 ms p95**, ≤ 3.0 ms p99.9 | `test/perf/tick.test.ts` over a 600-frame headless run with 48 remotes and a battle turn playing |

### 20.10.2 Rules

1. **No React on the 60 Hz path.** `World3D.tick` and everything it calls may not import `react`, `react-dom`, `react-router` or any `use*Store` hook (ESLint `no-restricted-imports` block scoped to `src/scene/**`, `src/battle/TimelinePlayer.ts`, `src/audio/**`). Stores are read via `getState()` and written only at the cadences named in §20.3–§20.6 (log ≤ 2 Hz, fps 1 Hz, connection on change).
2. **No per-frame allocation in input/prediction/interpolation.** `LocalPlayerController`, `RemoteInterpolator`, `HudWriter.flush` and `TimelinePlayer.step` are covered by `test/perf/alloc.test.ts`: a 600-step run with `--expose-gc` measures `process.memoryUsage().heapUsed` deltas between forced GCs and asserts ≤ 64 KB total growth (jitter allowance), and the source files are grepped for `new `, `[]`, `{}`, `.map(`, `.filter(`, `...` inside functions named `step|sample|flush|reconcile` — a hit fails the test unless the line carries `// alloc-ok: <reason>` (≤ 3 such lines per file).
3. **HUD dirty-flag.** `HudWriter.flush` calls `renderer.hud.set` with a partial containing only fields whose dirty bit is set; the render side redraws only those regions. Test: 600 idle frames (no input, no chat, no timeOfDay tick) produce exactly 0 `hud.set` calls; walking produces ≤ 2 per second (prompt changes) + nameplates at 2 Hz.
4. **Selectors return primitives.** `useRoomState` and every Zustand selector return primitives or shallow tuples; a Schema instance or store slice object is never returned (rule in §20.3.1/§20.3.3).
5. **Loaders are cheap or skeletons.** ≤ 400 ms p95 (§20.1.3); `shouldRevalidate: () => false` on `/play`; child loaders revalidate only on their own navigation or explicit `useRevalidator`.
6. **Images and sprites for the DOM** (`CreatureCard` thumbnails, dex grid) are the pipeline's 128 px WebP thumbnails from `40-pipelines.md` (`public/creatures/thumbs/<id>_front.webp` = `ManifestSpriteV2.thumb`, ≤ 6 KB each), `loading="lazy"`, `decoding="async"`; never the game atlases. <!-- reconciled 2026-09-18: path per 40-pipelines.md §40.6 -->
7. **Bundle**: the `/play` route imports `@ewa/render` and `three/webgpu` through `lazy` route modules so `/login` costs no Three.js. Shell (React + router + zustand + stores + ui) ≤ 180 KB gzipped; `/play` chunk (render + content + core + protocol + sdk) ≤ 900 KB gzipped; `vite build` fails via `build.chunkSizeWarningLimit` treated as an error in `vite.config.ts` when exceeded.

### 20.10.3 Chunked asset preload — first-frame budget 2.5 s on the slice

Target: a fresh `/play` load on Mirevale, cold cache, 50 Mbit/s, RTX 3060-class desktop, reaches the **first rendered world frame at ≤ 2 500 ms** from navigation start (`performance.mark('ewa:first-frame')` in `World3D.tick` after the first `renderer.frame`). The Playwright budget test asserts it on every CI run against the built client + a local server.

| Phase | Payload | Budget (cumulative) |
|---|---|---|
| 0 HTML + shell JS + `tokens.css` + 3 fonts (preloaded) | ≤ 180 KB + 360 KB | 450 ms |
| 1 `/play` chunk + `GET /me`, then `POST /zone/enter` + `consumeSeatReservation` (§20.3.4) | ≤ 900 KB JS; three round trips, the last two overlapping phase 2 | 1 100 ms |
| 2 zone materials for Mirevale — the **`field` tier** (512² KTX2 albedo/ORM/normal per surface, `10-render.md` §10.2.1) | ≤ 6 MB (Mirevale measured 3.71 MB) | 1 900 ms |
| 3 creature atlases for Mirevale's bind set (`manifest.zones.mirevale`: 2 atlases, 0.83 MB together with mips; amended 2026-10-06, was "0.544 MB each" before the true-colour rebuild, `40-pipelines.md` §40.1.7) + party singles' home atlases + the player body GLB; amended 2026-10-06: + the flipbooks of the zone's legendary statics and of animated party members (0.64–1.81 MB per side, `40-pipelines.md` §40.1.8; none for Mirevale) | ≤ 4 MB (Mirevale 0.83 MB + singles + GLB; the 8-atlas zones are 3.75 / 3.79 MB before singles, so one party single takes them over — `40-pipelines.md` §40.6, recommendation R12; `galvan_route`'s two legendary statics add ≈ 4.7 MB of flipbooks) | 2 350 ms |
| **first frame** (zone built, DOF/bloom compiled, HUD fonts ready) | | **≤ 2 500 ms** |
| 4 (after first frame) audio manifest + zone theme stems + ui sfx | ≤ 5 MB | music starts ≤ 4 000 ms; the world is silent, not blocked |
| 5 (idle) **`hero` tier** of the current zone's `hero: true` surfaces (`renderer.materials.preloadHero`, ≤ 12 MB, swapped in place), then the neighbouring zone (`mire_route`) field materials + atlases | ≤ 22 MB | streamed at ≤ 2 MB/s in 256 KB `fetch` ranges so it never competes with a handover |

<!-- reconciled 2026-09-18: 40-pipelines.md OQ-2 — phase 2 keeps its 6 MB by loading the field tier; hero textures arrive in phase 5 -->
<!-- amended 2026-09-25: phase 2/3 figures replaced by the shipped manifests (material-bake manifest fieldBytes; creatures.manifest.json zones + totalBytes); Mirevale hero measured 7.71 MB of phase 5's 12 -->

Rules: phases 2–3 are issued as parallel `fetch`es with `priority: 'high'`; phase 4–5 with `priority: 'low'`. A phase exceeding 2× its budget logs a `warn` toast in dev. `BootScreen` shows the phase name and a real byte-progress bar (from `Content-Length`), display face, no fake progress. Handover to a preloaded zone (phase 5 complete) must render its first frame within 250 ms of `handoverAck`; to a non-preloaded zone within 1 500 ms, with the HUD banner and the old zone still visible under the camera's 600 ms travel (spine §4.6 "no visible hitch" is measured as: no frame > 33 ms during the crossing). Phase 5's neighbour half (amended 2026-10-06, Phase E3) is `src/scene/prefetch.ts`. After the hero tier, and after every handover's first frame, the linked zones' field-tier files (the surfaces the current zone does not bind, through `renderer.materials.prefetch`) and their unbound creature atlases (every file, mips included) are fetched into the HTTP cache. Fetches go one at a time at `priority: 'low'`, paced to ≤ 2 MiB/s, with no transcode and no GPU memory, and a zone change cancels the run. The handover itself calls `renderer.prepareHandover(next)` before the old zone's dispose, so the shared texture sets stay resident. The old zone still disappears before the new one's phase 1 (`Renderer.loadZone` holds one zone), and World3D covers that with the "Travelling to …" overlay. The 250 ms / 1 500 ms / 33 ms targets are measured by `handover-hitch.spec.ts` (`50-verification-budget.md` §50.4.7). <!-- amended 2026-10-06: Phase E3 -->

**Handover prepare** (amended 2026-10-06, handover; `10-render.md` §10.1.2 "Handover prepare"): within 48 m of a link's edge point (checked every 30 fixed steps, outside battles) World3D asks the SceneDirector to `prepareZone` that linked zone at the arrival 8 m inside its opposite edge; the crossing's `loadZone` then adopts it — "a preloaded zone" in the rule above is a prepared one. One zone is prepared at a time; a zone change forgets it. <!-- amended 2026-10-06: handover fixed light layout — render IMPLEMENTATION-NOTES "Handover: fixed light layout" -->

**Phase 3 and the flipbooks** <!-- amended 2026-10-06; supersedes the same-day entry that loaded both flipbook sides of the zone's statics and party -->: phase 3 binds the zone's static set, the party's STATIC atlases and the FRONT flipbooks of the legendary statics standing within 40 m of the arrival point; a party flipbook only ever shows its back, in battle, and is bound by the battle when shown (§20.4.4 residency).

### 20.10.4 `BootScreen` and the dev HUD

Amended 2026-09-30 (render Part 5 T4 / T5): the world boot overlay shows the renderer's real compile progress — `onCompileProgress` phase `'boot'` ("Compiling shaders n / m") and a zone's phase 1 ("Preparing <zone> n / m") as a bar of compile units — and comes back for the blocking part of a zone handover ("Travelling to <zone>") until the new zone's first frame. The background phase that follows (`'background'`) is a small non-blocking corner pill ("Preparing distant scenery n / m") that never takes input and disappears when the phase ends. World3D passes the arrival position as `loadZone`'s `focus`.

`BootScreen` is the `hydrateFallbackElement` of `/play`: key art, the phase label (`Waking the grove…` is not permitted — labels are literal: "Loading materials 3.1 / 6.0 MB"), the byte bar. It is replaced by the canvas the moment `/me` resolves; phases 2–3 continue behind a 400 ms fade of the same screen drawn *by the canvas HUD* so the DOM boot screen is gone before the first frame. The dev HUD (`F3`, `import.meta.env.DEV` or `?dev=1`) shows fps, frame ms p95, draw calls, GPU ms, texture MB, remote count, prediction error, rubber-bands, desync counter, audio voices, heap MB.

---

## NON-NEGOTIABLES (this file)

1. `GameCanvas` mounts once per session in a pathless layout above `/play`; no route, loader, error boundary or Suspense sits between it and the router root.
2. `applyProgressionDelta` and `applyInventoryDelta` are the only writers of progression and inventory; REST responses are mapped into those two shapes; `BattleEvent`s write nothing.
3. `room.state` is read in place via `useRoomState` (primitives only) or inside `World3D.tick`; it is never copied into a Zustand store.
4. Only authoritative `battleEvents.events` are ever played; the local `resolveTurn` preview is prewarm + digest only; a digest mismatch sends `battleResync`.
5. HP shown anywhere comes from `hpAfter`; the client never computes damage.
6. `World3D.tick` performs no React state write above the cadences in §20.3–§20.6 and no allocation in `step/sample/flush/reconcile`.
7. Remote avatars are interpolated from a 100 ms buffer with linear interpolation; exponential smoothing does not exist in `src/scene`.
8. Effective reduced motion removes shake, hitstop, slow-mo, chroma, grain and DOF and cannot be overridden; timelines differ between modes only in those frame kinds.
9. One token set, three self-hosted OFL fonts, 12 px caption / 14 px body minimums, zero inline styles (`ewa/no-inline-style`), CSS Modules only.
10. Every screen has explicit empty, loading and error states; no spinner ever covers the canvas.

## CUT DELIBERATELY (this file)

- **React Three Fiber / any React reconciler over the scene.** React ends at the canvas element.
- **vanilla-extract, Tailwind, styled-components.** Not installed; CSS Modules cover the need with zero dependencies.
- **URL state for modals and the battle.** Modals are `ui.modal`; a battle is `ui.battle`; refresh during a battle re-joins via `battleResync`, not via a `/battle/:id` route.
- **Mobile layouts, touch controls, responsive breakpoints.** Desktop only; below 1280 px the app shows a static message.
- **Client-side damage, catch, exp or badge logic.** `core` runs on the client for validation (`validateAction`) and preview digests only.
- **Custom smoothing/"rubber-band" heuristics.** Snap above 4 u, replay otherwise, 100 ms render blend; nothing else.
- **Per-frame HUD rebuilds and DOM HUDs.** The HUD is canvas, written through a dirty mask.
- **Music `loop = true` on sources.** Stems are double-scheduled to stay sample-aligned.
- **Voice-over, dialogue audio, lip sync.** Ducking exists for future VO and for modal focus; no VO ships.
- **Service worker / offline mode.** Preload is `fetch` with priority hints and the browser cache; no SW.

## OPEN QUESTIONS FOR OTHER SECTIONS — RESOLVED 2026-09-18

<!-- reconciled 2026-09-18: each question is answered in the named section; the list stays as the audit trail -->
1. `10-render.md` → **done**: it defines every symbol in §20.4.1 (§10.1.1, §10.5.1, §10.7.2, §10.7.5 incl. the 47 `VFX_IDS`, §10.7.6, §10.9); `HudLayer.set` accepts exactly the §20.6 `HudModel` names (§10.9 says so); `BattlerPose` gained `recoil`/`celebrate` and `CameraRig.cue` gained `throw` to match §20.5.1.
2. `30-server-netcode.md` → **done**: the server validates against a cap derived from `@ewa/protocol` `MOVEMENT` (4.2 / 7.0 m/s, §30.2.4 re-exports them) rather than re-running `stepMovement`; the join is `POST /zone/enter` + `consumeSeatReservation` (§20.3.4, §30.2.6); `handover.seat` is a typed `SeatReservation` (spine §4.4); `chat` and `dm` are spine `ServerMessage` variants, `dialogue` does not exist — NPC lines are content and `storyBeat` confirms beats (§20.4.7, §30.4.8); leave codes 4000/4101/4002/4003 are §30.2.2's (4001 → 4101 amended 2026-09-25: 4001 is Colyseus' `SERVER_SHUTDOWN`).
3. `40-pipelines.md` → **done**: `public/audio/manifest.json` is §40.4.6 = §20.7.4 (with the pre-skip note above); thumbnails are `public/creatures/thumbs/` (§40.1.6.5); phase 2/3/5 sizes are §20.10.3's, recomputed against the `field`/`hero` material tiers and the 2048² atlases.
4. `50-verification-budget.md` → **done**: §50.4.7 now lists `prediction.test.ts` (harness + jitter), `no-exp-smoothing.test.ts`, `timeline.test.ts` over the fuzz corpus, `perf/tick.test.ts` + `perf/alloc.test.ts`, `hud-dirty.test.ts`, `first-frame.spec.ts`, `design-system.test.ts` (contrast, ΔE, type-colour table equality).
