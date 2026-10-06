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

**Colour** — the dark palette is derived from the grove biome (legacy Mirevale `ground #5f7e44`, `ground2 #48632f`, `sky #86946e`, `vein #7be08a`). Every neutral is a desaturated tint of the grove ground; the accent is the vein colour.

| Token | Value | Use | Contrast note |
|---|---|---|---|
| `--bg-0` | `#0b100c` | page ground behind the canvas, modal scrim base | |
| `--bg-1` | `#121a13` | panel surface | |
| `--bg-2` | `#1a251b` | card surface on a panel | |
| `--bg-3` | `#24321f` | hover / raised surface | |
| `--line-1` | `#2f4029` | hairlines, dividers | |
| `--line-2` | `#48632f` | focus ring base, active tab underline | |
| `--text-hi` | `#eef3e6` | headings, values | 15.9:1 on `--bg-1` |
| `--text-1` | `#c7d1bd` | body | 11.3:1 on `--bg-1` |
| `--text-2` | `#8c9a83` | captions, labels | 5.4:1 on `--bg-1` (≥ 4.5 required at 12 px) |
| `--accent` | `#7be08a` | primary action, selection, links | 9.7:1 on `--bg-1` |
| `--accent-hi` | `#a4f0ad` | primary hover | |
| `--on-accent` | `#0b100c` | text on accent | 9.7:1 |
| `--warn` | `#e0b35a` | caution, low PP | |
| `--danger` | `#e06a5a` | destructive, HP < 20 % | |
| `--info` | `#6ab4e0` | neutral notices | |
| `--hp-hi` / `--hp-mid` / `--hp-lo` | `#7be08a` / `#e0b35a` / `#e06a5a` | HP bar at > 50 % / 20–50 % / < 20 % | |
| `--scrim` | `rgb(11 16 12 / 0.72)` | behind modals | |

Type colours (19, in `TYPE_NAMES` order) are **one table**, `10-render.md` §10.4.6 `typeColors.ts` (the legacy `TYPE_COLORS`), copied verbatim into `tokens.json` `typeColors.default` and asserted equal by `design-system.test.ts`: Normal `#a8a290`, Fire `#ee6f4a`, Water `#4aa3d6`, Grass `#6fae5a`, Electric `#f4cf3f`, Ice `#8fd6e8`, Fighting `#c0492f`, Poison `#9a5bb0`, Ground `#c9a24a`, Flying `#8aa6e0`, Psychic `#e06fa0`, Bug `#9aa83a`, Rock `#b09a6f`, Ghost `#6a5b9a`, Dragon `#6a52d0`, Steel `#9aa6b0`, Fairy `#f0a6d0`, Dark `#5b4b66`, Cosmic `#7be0d0`. Used by `TypeBadge`, the sprite rim light and the gym beacons, so a type reads the same in the DOM and in the world. Colourblind palettes in §20.8.3 override this table (and are passed to render through `stage.setTypeColors`); the badge always carries its 2-letter glyph, so colour is never the only signal. <!-- reconciled 2026-09-18: this file carried a second, different hex table -->

**Space** (px): `--s-1 2`, `--s-2 4`, `--s-3 8`, `--s-4 12`, `--s-5 16`, `--s-6 24`, `--s-7 32`, `--s-8 48`, `--s-9 64`. Nothing else is permitted as a margin/padding/gap value.

**Radius**: `--r-1 4` (inputs, badges), `--r-2 8` (cards, buttons), `--r-3 12` (panels, modals), `--r-pill 999`.

**Type scale** (px / line-height), all in `rem` at the 16 px root and multiplied by `--ui-scale` (§20.8.4):

| Token | Size | Line | Face | Use |
|---|---|---|---|---|
| `--t-caption` | 12 | 16 | text | labels, table headers, timestamps — **the minimum anywhere** |
| `--t-body` | 14 | 20 | text | default body — **the minimum for running text** |
| `--t-body-lg` | 16 | 24 | text | dialogue, descriptions |
| `--t-h3` | 20 | 28 | display | card titles |
| `--t-h2` | 24 | 32 | display | panel titles |
| `--t-h1` | 32 | 40 | display | screen titles |
| `--t-display` | 48 | 56 | display | zone banner, battle result |
| `--t-mono` | 14 | 20 | mono | numbers in tables, seeds, digests, admin |

Number columns use `font-variant-numeric: tabular-nums`. No text below 12 px exists; the ESLint rule cannot see CSS, so `gen-tokens.ts` also greps `src/**/*.module.css` for `font-size` values not equal to a `--t-*` token and fails.

**Fonts** — three faces, all SIL Open Font License 1.1, self-hosted as `woff2` in `packages/client/public/fonts/` (latin + latin-ext subsets only), declared with `@font-face` in `fonts.css` with `font-display: swap`, and preloaded in `index.html` with `<link rel="preload" as="font" type="font/woff2" crossorigin>`:

| Role | Family | File | Fallback stack |
|---|---|---|---|
| display | **Bricolage Grotesque** (variable, wght 200–800) | `BricolageGrotesque[opsz,wdth,wght].woff2` | `'Bricolage Grotesque', 'Segoe UI', system-ui, sans-serif` |
| text | **Inter** (variable, wght 100–900) | `InterVariable.woff2` | `Inter, 'Segoe UI', system-ui, sans-serif` |
| mono | **JetBrains Mono** (variable, wght 100–800) | `JetBrainsMono[wght].woff2` | `'JetBrains Mono', Consolas, monospace` |

Total ≤ 360 KB. `HudLayer` (§20.6) draws with the same families; `AudioDirector`-independent boot waits on `document.fonts.load('14px Inter')` and `document.fonts.load('24px "Bricolage Grotesque"')` before the first HUD draw (cap 1 000 ms, then draw with fallbacks).

**Motion tokens**: `--motion-fast 80ms`, `--motion-ui 160ms`, `--motion-panel 160ms`, `--motion-slow 240ms`, `--motion-banner 400ms`; easings `--ease-out cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-in-out cubic-bezier(0.65, 0, 0.35, 1)`. Under effective reduced motion every `--motion-*` is `0ms` (set on `:root[data-reduced="1"]`).

**Interaction scales**: hover `transform: scale(1.05)`, press `scale(0.95)`, both over `--motion-fast`, applied by `Button`, `CreatureCard`, `MoveButton`, `Tabs` triggers only. Focus: 2 px `--accent` ring at 2 px offset, `:focus-visible` only.

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
export interface TypeBadgeProps { readonly type: TypeName; readonly size?: 'sm' | 'md' }   // renders glyph + name; glyph is the 2-letter code from TYPE_GLYPHS
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

export const TYPE_GLYPHS: Readonly<Record<TypeName, string>>; // 'NO','FI','WA','GR','EL','IC','FT','PO','GD','FL','PS','BU','RO','GH','DR','ST','FA','DK','CO'
```

`HpBar` widths are `--hp` custom properties (0..1) set via `cssVars`; the colour switches at 0.5 and 0.2 by a CSS `@container style()`-free approach: three classes chosen in TS. `MoveButton` shows the effectiveness chevrons (`▲▲` ×4, `▲` ×2, `▼` ×0.5, `▼▼` ×0.25, `✕` ×0) only after the player has *seen* the target species (dex `seen`); otherwise nothing — the dex is load-bearing (§20.9.5).

### 20.2.5 Component states

Every interactive component implements exactly: `default`, `hover` (1.05), `active` (0.95), `focus-visible` (ring), `disabled` (opacity 0.45, no scale), and where applicable `busy` and `selected`. Storybook is not used; `src/ui/Gallery.tsx` renders every component in every state at `/__gallery` in dev builds only (`import.meta.env.DEV`), and the Playwright visual test screenshots it at 1440p.

### 20.2.6 Motion inventory

| Motion | Duration | Reduced |
|---|---|---|
| Panel open/close (opacity 0→1, translateX 8 px→0) | 160 ms `--ease-out` | 0 |
| Modal (scrim 0→0.72, dialog scale 0.98→1) | 160 ms | 0 |
| Toast enter/exit (translateY 8 px) | 160 ms / 80 ms | 0 |
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
| `BattleUi.authoritative` | `BattleController.applyServer` | `battleStart`; `battleEvents` — when the preview's digest matches `stateDigest`, the preview state **is** the server's state and becomes `authoritative`; without a preview (pvp, raid, a turn the client did not submit) the state is patched from the events (`hpAfter`, pp, status, actives, turn) and the next digest check decides; `battleResync` |
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
Renderer.stage: BattleStage;     // dress(at, terrain, participants), dressSpectator(x, z), undress(ms), setBattler(ref, d), setPose(ref, pose, ms), hurt, faint, setWeather, vfx(id, from, to, ms), prewarm(ids), syncFrom(hp), setTypeColors(table), inspect(d)
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

### 20.4.5 `LocalPlayerController` — input and prediction

**Bindings** (defaults; remappable §20.8.5; `KeyboardEvent.code` values):

| Action | Default | Sends |
|---|---|---|
| move forward/back/strafe | `KeyW KeyS KeyA KeyD`, `ArrowUp ArrowDown` (fwd/back), `ArrowLeft ArrowRight` (strafe) | `input` |
| run | `ShiftLeft` (hold) | `input.running` |
| interact | `KeyE`, `Enter` | `interact { targetId, kind }` or `engageSpawn { spawnId }` |
| jump | `Space` | nothing — local cosmetic hop (0.6 u, 420 ms); never on the wire |
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
  accel: 40,             // units / s^2 toward target velocity
  turnRate: 12,          // rad / s toward input heading
  radius: 0.35,          // capsule radius for edge/collider tests (= 10-render.md MOVER.capsuleRadius)
  stepMs: 1000 / 60,     // 16.667: client fixed step
  sendHz: 20,            // input messages per second
  maxDtMs: 100,          // matches InputMsg.dtMs max
} as const;

export interface MoveInput { readonly ax: number; readonly az: number; readonly running: boolean } // ax/az in [-1,1], normalised by the caller
export interface MovePose { x: number; z: number; angle: number; vx: number; vz: number }   // mutable scratch — the ONLY mutable type in protocol
export interface Collider { resolve(pose: MovePose, radius: number): void }                    // heightfield + blockers; pushes the pose out in place

/** Advances pose in place by dtMs. Deterministic for identical inputs; allocation-free. */
export function stepMovement(pose: MovePose, input: MoveInput, dtMs: number, collider: Collider): void;
```

The client's `Collider` is a 12-line adapter over `ZoneHandle.collider` + `resolveMove` (`10-render.md` §10.6.2): `resolve(pose, radius)` calls `resolveMove(collider, fromX, fromZ, pose.x − fromX, pose.z − fromZ)` and writes the result back into `pose`. `resolveMove` never returns an unwalkable position, and the server accepts only `walkable = 1` positions, so prediction and truth agree on where a player may stand.

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

### 20.4.6 `RemoteInterpolator`

For each other `PlayerState` in view, a ring of 8 samples `{ t, x, z, angle, moving, running }` where `t = tick * 50` ms (server time; spine: 20 Hz). Server-time offset = the median of the last 32 `(performance.now() - tick*50)` observations, updated on every `room.onStateChange`. Render time = `serverNow - 100` ms (the interpolation delay). Each step finds the two samples bracketing render time and **linearly** interpolates position and shortest-arc angle; if render time is past the newest sample it extrapolates with the last velocity for at most 100 ms, then holds still with `moving = false`. There is no `pos += (target - pos) * k` anywhere; the lint fixture `test/no-exp-smoothing.test.ts` greps `src/scene/**` for `\*\s*0\.\d+\s*\)?\s*;?\s*$` patterns on assignment to `x|z` and fails on a hit. Nearest-N rendering: at most 48 remote actors get a render actor (sorted by distance once per 500 ms); others are tracked but not spawned. Emote: `listen(player, 'emote', …)` → `actors.setEmote(id, n)`; the server clears it after 2 s. Chat: the `ServerMessage` variant `chat { id, name, text }` (spine §4.4; AOI-scoped by the server, `30-server-netcode.md` §30.6.5); the client appends `{ name, text, at }` to the HUD chat log (§20.6). <!-- reconciled 2026-09-18: `chat` is a spine variant now -->

### 20.4.7 Interaction targeting

Once per fixed step the controller scans a preallocated array of interactables (static actors from the `ZoneSpec` + spawns from `getStateCallbacks(room).onAdd('spawns')` + remote players) and keeps the nearest within range: NPC/trainer/tablet/pickup/building 2.5 u; spawn 1.2 u; link edge 1.5 u (auto-triggers `handover` on the server side — the client just walks); player 6 u (for `C`). The prompt text is written to the HUD only when the nearest target id changes. `E` sends the corresponding `interact`. NPC dialogue is **content, not wire**: on `interact { kind: 'npc' }` the client immediately opens the DOM `DialogueBox` with the lines it computes from content and its own flags — `nextStoryBeat(zone, flags)?.speaker === npcId ? beat.lines : (the first `react` whose `when` flag is held, else `NpcDef.lines`)` — while the server, for the same interact, replies with nothing (plain NPC), `storyBeat { beatId, phase: 'start' }` (confirms the beat; the client keeps the lines it already shows), `battleStart` (trainer/gym/static/beat battle), `inventoryDelta` (pickup), `progressionDelta` (flags) or `toast`. `storyBeat { phase: 'complete' }` opens the beat's `after` lines. A `start` for a beat the client did not predict (flags changed under it) replaces the open dialogue. <!-- reconciled 2026-09-18: this file expected a `dialogue` message that no section defined; 30-server-netcode.md §30.4.6 says lines are content; the spine's `storyBeat` variant bridges the two -->

---

## §20.5 BATTLE PRESENTATION

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

Every `vfx` value in `MOVE_ANIMS`/`DEFAULT_BY_TYPE`, and every `vfx` id the builder emits for non-move events, is one of the 47 `VFX_IDS` of `10-render.md` §10.7.5; `timeline.test.ts` asserts the set difference is empty. `Keyframe.pose` values map 1:1 onto render's `BattlerPose` (`recoil` and `celebrate` included) and `Keyframe.camera.shot` onto `CameraRig.cue` kinds (`throw` included). <!-- reconciled 2026-09-18 -->

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

### 20.5.5 `BattleController` and the local preview

```ts
// packages/client/src/battle/BattleController.ts
export interface BattleController {
  onBattleStart(m: Extract<ServerMessage, { type: 'battleStart' }>): void;   // director.enterBattle; stage.setBattler for both leads; play(createBattle events); phase 'selecting'
  submit(action: Action): void;                                                // validateAction locally first (error -> toast, no send); send battleAction { battleId, turn, action }; phase 'submitted'; preview()
  onBattleEvents(m: Extract<ServerMessage, { type: 'battleEvents' }>): void;  // digest check; apply hpAfter to authoritative; play(buildTimeline(m.events)); phase from last event
  onBattleResync(m: Extract<ServerMessage, { type: 'battleResync' }>): void;  // replace authoritative; stage.syncFrom(state); phase 'selecting' | 'replacement'
  onBattleEnd(m: Extract<ServerMessage, { type: 'battleEnd' }>): void;        // BattleResultCard (DOM) with m.rewards; after dismiss: director.exitBattle; ui.battle = null
  readonly preview: { state: BattleState; digest: string } | null;
}
```

**Preview rule.** On `submit`, when the opposing side is `wild`/`npc` (formats `wild`, `trainer`, `league`), the client computes `preview = resolveTurn(authoritative, seat === 0 ? [action, null] : [null, action], content)` — the same null-passing convention the server uses (spine §2.10), so the NPC choice comes from the same rng stream and the digest can match. For `pvp` and `raid` no preview is computed (the other action is unknown). The preview is used for exactly three things: (1) `renderer.stage.prewarm(vfxIdsIn(preview.events))` so shaders/particles for the likely VFX are resident before the server message lands; (2) `expectedDurationMs = buildTimeline(preview.events).durationMs` to size the input-lock and the "waiting" indicator; (3) `digestBattleState(preview.state)` compared with `battleEvents.stateDigest`. **No preview frame is ever rendered**: `TimelinePlayer.play` is only ever called with a timeline built from `m.events`. On mismatch: `console.warn('battle desync', battleId, turn)`, `ui.battle.desyncs += 1`, `send('battleResync', { battleId })`, and the server's events are still played (they are authoritative regardless). The `battleEvents.rng` field replaces the local `authoritative.rng` after every turn so the next preview starts from the server's stream. On a digest **match** the preview state replaces `authoritative` wholesale: an `authoritative` updated only from `hpAfter` (the draft's §20.3.2 rule) would diverge from the server at the first stage, status, PP or weather change, and every later preview would mismatch and request a resync. <!-- amended 2026-09-25: client BattleController.ts header, the implemented rule -->

**HP is never computed locally.** The HUD bar targets are `damage.hpAfter`/`heal.hpAfter`; `authoritative.sides[i].party[j].creature.hp` is overwritten from those same fields as events are applied.

### 20.5.6 Battle menu (DOM) and in-canvas elements

Amended 2026-09-30 (render Part 5 T2; audit M2-battle-5 / -6): `BattleOverlay` reports the panel's measured top edge; World3D hands render the panel's height over the canvas (`part3.setBattleInsets(0, px)`), and render's battle camera frames both battlers — and the far battler's HP bar — above it, while the HUD keeps both bars off it. The client's former 1.0 m look-at shift toward the camera (`FRAME_SHIFT_M`) is 0. `BattleHud` fills each bar's `types` from the species table for the plate's type badges.

DOM (`BattleOverlay`, bottom 28 % of the viewport, `Panel` without title): root menu `Fight · Party · Bag · Orbs · Run/Forfeit` (hotkeys `1–5`), moves grid of 4 `MoveButton`s (hotkeys `1–4`, `Escape` back), party list of `CreatureCard variant="row"` (switch), bag list filtered by `usableInBattle`, orbs list. Disabled reasons come from `validateAction` (`ActionError` → label table, e.g. `noPp → 'No PP'`, `choiceLocked → 'Choice-locked'`, `trapped → 'Trapped'`). The last 3 log lines render in the DOM panel's left third with `--t-body-lg`.

In-canvas (render `HudLayer`, spine Pillar 8: never covered by an effect): both active battlers' HP bars anchored above the billboards with name, level, HP numbers (own side only), status glyph, stage arrows (▲/▼ per stat with count); the turn label; the orb shake counter. The `BattleResultCard` (DOM modal) shows `RewardsSummary` and, for `battleEnd` with `evolveReady`/`learnMove` events in the last turn, the `evolve`/`learnMove` modals queued in order, each an explicit REST call (`POST /creature/:id/evolve`, `POST /creature/:id/moves`) — never automatic.

**The evolution sequence** (amended 2026-10-05; client IMPLEMENTATION-NOTES Part 6, render §10.7.5). Every evolve path — the post-battle prompt, the Party screen's Rare Candy (the server's `evolveReady` item event queues the same prompt, §20.9.3), and later stones and trades — calls `app/evolution.ts` `evolveCreature(creature, into)`: **server truth first** — `POST /creature/:id/evolve` answers, the returned creature goes through the one inventory writer, and only then `playEvolution` stages the response's species; a failed call plays nothing (the `danger` toast names the error code and the prompt stays). The prompt starts binding the new form's atlas when it opens (`preloadEvolution`). World3D registers the player (`scene/EvolutionDirector.ts`): render's `stage.evolve({ from, to, at: the player's feet, reduced: effective reduced effects, cheer: the local player })`. While it plays, `ui.evolution` is set: movement is off and every world action is blocked (`worldBlocked`), the shell hotkeys are ignored, the canvas HUD is hidden (restored to the F1 state after), the open panel and the shortcut hint step aside (§20.9.2), the queued prompts wait, and the avatar faces the creature. A primary click or `Space` / `Enter` / `Escape` skips to the reveal, then to the exit (the keys are swallowed; others pass). Render's phase callbacks arrive from its frame hook and are deferred off the tick (`setTimeout(0)`): `reveal` shows the DOM `EvolutionBanner` — an eyebrow "Evolution" and "<Name> evolved into <Species>!" in the display face (`--t-h2`), bottom-centre over the canvas like a game text box, `role="status"` — replacing the old success toast; `exit` fades it (`--motion-banner`); the end restores the input (unless a battle took over) and clears `ui.evolution`. While the sequence builds up, a caption pill reads "Space or click to skip". Without a world (no zone, a battle) the banner alone shows for 2.6 s. A battle starting cancels the sequence (render's `dress`). <!-- amended 2026-10-05: client IMPLEMENTATION-NOTES Part 6 -->

---

## §20.6 IN-WORLD HUD

`HudLayer` (render) draws in-canvas at the end of the frame with the token fonts. The client owns `HudWriter`, which keeps a `HudModel` and calls `renderer.hud.set(partial)` with **only the fields that changed since the last flush** (a per-field dirty bitmask; `flush()` is a no-op when the mask is 0 — this is the "HUD dirty-flag" rule of §20.10).

```ts
// packages/client/src/scene/HudWriter.ts
export interface HudModel {
  readonly party: readonly { readonly speciesId: string; readonly variantKey: VariantKey; readonly hpFrac: number; readonly status: string | null; readonly fainted: boolean }[]; // ≤ 6; top-left strip, 48 px thumbs
  readonly zoneName: string | null;            // display face 48 px, centre-top, banner timing §20.2.6; null after the banner
  readonly timeOfDay: number;                  // 0..1 -> sun/moon glyph + hh:mm in the top-right
  readonly questHint: string | null;           // one line ≤ 60 chars, below the time; from the active quest's first undone objective label
  readonly chat: readonly { readonly name: string; readonly text: string; readonly at: number }[]; // last 6 lines, bottom-left, each fades 8 s after `at`
  readonly prompt: { readonly key: string; readonly verb: string; readonly target: string } | null; // "E — Talk to Fenkeeper", bottom-centre
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
  readonly accessibility: { readonly reducedMotion: 'system' | 'on' | 'off'; readonly colorblind: Colorblind; readonly uiScale: number /* 0.9..1.4 step 0.05 */; readonly battleTextSpeed: 'normal' | 'fast' | 'instant'; readonly screenFlash: boolean };
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

Three full 19-entry alternates in `tokens.json` under `typeColors.deuteranopia|protanopia|tritanopia`, chosen so every adjacent pair in `TYPE_NAMES` order differs by ≥ 40 in CIELAB ΔE under the respective simulation (checked by `gen-tokens.ts` with the Machado 2009 matrices; the build fails otherwise). Independent of colour, the badge always shows `TYPE_GLYPHS[type]`, and the effectiveness chevrons in `MoveButton` are shape-coded (`▲▲ ▲ ▼ ▼▼ ✕`), so no gameplay information is colour-only.

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

**20.9.1 Auth** (`/login`, `/register`). Full-bleed static key-art (`public/keyart/mirevale.ktx2`-derived JPEG, 1440p) with a 420 px `Card` centred-right. Primary: username + password (+ email + starter picker on register). The starter picker is three `CreatureCard variant="showcase"` for `bramblecub / glimfin / cindercap` with type badges and a two-line flavour each; the selection is the largest element on the register form. Secondary: the switch link (login ↔ register). Errors from the action render inline under the field they concern (`username taken`, `bad credentials`); network errors as a single `danger` line above the button. No password rules beyond 8..128 are displayed until violated.

**20.9.2 World** (`/play`). The canvas is the screen. HUD per §20.6. DOM elements present: a 56 px top bar with the nav (`Party · Box · Dex · Shop · Social · Guild · Market · Pass · Settings`, `NavLink`s with unread counts), the money counter (mono, tabular), the trainer level pip; the chat input (hidden until `T`); toasts bottom-right; `DialogueBox` bottom-centre (`--t-body-lg`, speaker in display face, `Enter`/`E` advances, ≤ 3 lines visible, remaining count shown). Empty: a zone with no other players shows nothing extra. Loading: `BootScreen` (§20.10.4) only before the first `/me`; a zone change shows only the banner. Error: `ConnectionOverlay` after 2 s disconnected (§20.3.4). Evolution (amended 2026-10-05, §20.5.6): while the sequence plays, an open `/play/*` panel and the shortcut hint fade out (`visibility: hidden`, so nothing in them takes focus or clicks) and come back where they were; the `EvolutionBanner` sits bottom-centre over the canvas (`--z-toast`, no pointer events).

**20.9.3 Party** (`/play/party`). Left 60 %: six `CreatureCard variant="row"` in slot order (sprite, name/nickname, level, `HpBar`, status, held item icon), keyboard-reorderable (`Alt+↑/↓`) and pointer-draggable; reorder commits with `POST /party/reorder` on drop (optimistic order, revert on error). Right 40 %: the selected creature's detail — stats (`calcStat` from core for display, marked "at level"), four `MoveButton`s with PP, ability + held item selects (`POST /creature/:id/setup`), nickname (`POST /creature/:id/nickname`), favourite/lock toggles (`POST /creature/:id/flags`), release (`danger`, confirm modal, refused when locked). Empty: impossible (party ≥ 1). Loading: none (store). Error: toast. Field items (amended 2026-10-05): the detail's "Use an item" section uses Rare Candy and the other field items through `POST /item/use`; an `evolveReady` event in the answer queues the explicit evolve prompt (§20.5.6), and accepting it plays the evolution sequence in the world behind the panel, which steps aside until it ends (§20.9.2).

**20.9.4 Box** (`/play/box`). A 10-column tile grid (`CreatureCard variant="tile"`, 72 px) paged 60 per page (`?page=`), with a sticky filter row (search by name/species, type, sort by level/dex/recent). The party strip is pinned at the top of the panel so deposit/withdraw is one drag or two clicks (`POST /party/withdraw`/`deposit`, `POST /party/swap` when the party is full and a slot is targeted). Selecting a tile shows the same detail column as Party. Empty: "Your box is empty — creatures you catch with a full party arrive here." Loading: skeleton grid. Error: toast + retry button in the panel header.

**20.9.5 Dex** (`/play/dex`) — *witnessing framing*. Header: "Witnessed **N / 130**" in display face with a segmented bar (caught solid, seen-only hatched, unknown empty) — this is the theme's win condition, so it is the largest number in the UI. Below: a 6-column grid in `dexNumber` order; unknown species render as a dark silhouette with `#???`; seen species show the sprite desaturated with the name; caught species show full colour with variant chips (up to 4 palette dots) and an alpha mark. Filters in the URL (`?type=&state=caught|seen|unknown&q=`). Selecting an entry opens a right detail: flavour text, types, evolution chain (arrows; unknown stages silhouetted), zones where recorded (from `dexEntries` caught zone), and the line "Recorded — this one cannot be quietly lost." for caught entries versus "Seen, not yet recorded." for seen. Empty: never (130 rows). Loading: skeleton grid. Error: panel retry.

**20.9.6 Shop** (`/play/shop`). Two tabs (`?tab=buy|sell`). Buy: a `Table` of stock (icon, name, one-line effect, price mono) with a quantity stepper (1..99) and a running total against the money counter; the row's buy button is disabled with the caption "Not enough" when `qty × price > money`. Sell: the inventory filtered to `sellPrice > 0`. Each transaction is one `useFetcher` action; the response is applied through `applyInventoryDelta`. Empty: "Nothing to sell." Loading: skeleton table. Error: 404 → "There is no shop here" (the panel still opens, so the URL is honest); other → retry.

**20.9.7 Social / DM** (`/play/social`, `/play/social/:username`). Left 320 px: three tabs (`Friends · Requests (n) · Nearby`); friends show online state (from `GET /friends`, refreshed on focus) and unread DM counts; each row has `Message · Challenge · Trade` (the latter two enabled only when the player is in this zone: `room.state.players.has(id)`, read via `useRoomState`). Right: the DM thread (`GET /messages/:username?limit=50`, older loaded on scroll-top with `?before=`), composer at the bottom (`POST /messages/:username`, 1..300 chars, counter visible from 250). Incoming DMs arrive as the `30-server-netcode.md` room message `dm` → `notifications.unreadDm` + thread append when open. Empty: friends "No friends yet — add someone by username" with the request field focused; thread "Say hello." Loading: skeleton rows. Error: retry.

**20.9.8 Guild** (`/play/guild`). No guild: search (`?q=`) + create form (name 3..24, tag `[A-Z0-9]{3,4}` validated live, the 5 000 founding cost shown on the button and disabled with "Not enough" below it) side by side. <!-- reconciled 2026-09-18: tag {3,4}, cost 5000 --> In a guild: header (name, tag, member count, MOTD editable by leader/officers), a `Table` of members (name, role, trainer level, last seen) with role actions gated by the viewer's role (`kick`/`promote`), and a `Leave` button (`danger`, confirm; leaders must promote first). Empty search: "No guilds match." Loading: skeleton. Error: retry.

**20.9.9 Marketplace** (`/play/market`, `/play/market/:listingId`). Filter bar bound to URL params (`search, variant, isAlpha, levelMin, levelMax, sort, page`); results as `Table` rows (sprite, species/level, variant/alpha chips, current bid, buy-now, time left mono, seller). Tabs `Browse · My listings · My bids`. The detail route shows the creature card, full bid history, a bid field pre-filled with `max(startingBid, currentBid + 50)` and buttons `Bid` / `Buy now` / (own) `Cancel`; list-from-box modal picks a box creature, starting bid ≥ 100, optional buy-now, duration `12 | 24 | 48` h; fee 5 % shown before confirm. Rate-limit responses (`5/h list`, `30/h bid`) render as the exact remaining-time caption. Empty: "No listings match — widen the filters." Loading: skeleton rows; the previous page stays visible under a 0.6 opacity while a new page loads. Error: retry.

**20.9.10 Battle Pass** (`/play/pass`). Header: trainer level (display face) and a progress bar to the next 1 000 exp with the exact `exp / 1000` in mono. A horizontal track of 100 reward tiles (virtualised, 10 visible), each `claimable · claimed · locked`; claimable tiles pulse once (160 ms) on entry. Level 50 shows the mythical choice as two `CreatureCard variant="showcase"` (`lumyth / noxmyth`) with "Choose once" — `POST /battle-pass/mythical-choice`. Claim → `POST /battle-pass/claim` → `applyInventoryDelta`. Empty: never. Loading: skeleton track. Error: retry.

**20.9.11 Settings** (`/play/settings`). Five tabs (`?tab=graphics|audio|accessibility|controls|social`). Every control is a `Toggle`/`Slider`/`Table` from §20.2.4 bound to `useSettingsStore`; changes apply immediately (no Save button) and the graphics tab shows the live `renderer.stats()` (draw calls, GPU ms) under the toggles. Accessibility tab first item: the reduced-motion tri-state with the current system value shown. Controls: the remap table (§20.8.5). Empty/loading: none. Error: none (local).

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
| 3 creature atlases for Mirevale's bind set (`manifest.zones.mirevale`: 2 atlases, 0.544 MB each with mips) + party singles' home atlases + the player body GLB; amended 2026-10-06: + the flipbooks of the zone's legendary statics and of animated party members (0.64–1.81 MB per side, `40-pipelines.md` §40.1.8; none for Mirevale) | ≤ 4 MB (Mirevale ≈ 1.1 MB + singles + GLB; an 8-atlas zone is 4.35 MB before singles — `40-pipelines.md` §40.6, recommendation R12; `galvan_route`'s two legendary statics add ≈ 4.7 MB of flipbooks) | 2 350 ms |
| **first frame** (zone built, DOF/bloom compiled, HUD fonts ready) | | **≤ 2 500 ms** |
| 4 (after first frame) audio manifest + zone theme stems + ui sfx | ≤ 5 MB | music starts ≤ 4 000 ms; the world is silent, not blocked |
| 5 (idle) **`hero` tier** of the current zone's `hero: true` surfaces (`renderer.materials.preloadHero`, ≤ 12 MB, swapped in place), then the neighbouring zone (`mire_route`) field materials + atlases | ≤ 22 MB | streamed at ≤ 2 MB/s in 256 KB `fetch` ranges so it never competes with a handover |

<!-- reconciled 2026-09-18: 40-pipelines.md OQ-2 — phase 2 keeps its 6 MB by loading the field tier; hero textures arrive in phase 5 -->
<!-- amended 2026-09-25: phase 2/3 figures replaced by the shipped manifests (material-bake manifest fieldBytes; creatures.manifest.json zones + totalBytes); Mirevale hero measured 7.71 MB of phase 5's 12 -->

Rules: phases 2–3 are issued as parallel `fetch`es with `priority: 'high'`; phase 4–5 with `priority: 'low'`. A phase exceeding 2× its budget logs a `warn` toast in dev. `BootScreen` shows the phase name and a real byte-progress bar (from `Content-Length`), display face, no fake progress. Handover to a preloaded zone (phase 5 complete) must render its first frame within 250 ms of `handoverAck`; to a non-preloaded zone within 1 500 ms, with the HUD banner and the old zone still visible under the camera's 600 ms travel (spine §4.6 "no visible hitch" is measured as: no frame > 33 ms during the crossing).

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
