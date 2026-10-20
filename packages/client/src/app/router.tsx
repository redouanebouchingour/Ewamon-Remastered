/**
 * SPEC §20.1.1 — one `createBrowserRouter` over the route table below; main.tsx mounts `<RouterProvider>`.
 * No <BrowserRouter>, no <Routes>, no framework mode.
 *
 * The `/play` entry is wrapped in a pathless layout route whose element is CanvasHost (no loader, no errorElement):
 * the canvas therefore survives /play loader errors, child errors and the BootScreen, and unmounts only when the URL
 * leaves /play (logout / 401 → /login).
 *
 * §20.10.2 rule 7: every screen, loader and action arrives through a `lazy` route module, so the shell chunk holds
 * React, the router, the stores and the error/boot elements only — `/login` costs no world, and the world
 * (content + protocol + sdk, later @ewa/render) loads with `/play`. Error and fallback elements stay static so they
 * render even when a chunk fails to load.
 */
import { createBrowserRouter, redirect } from 'react-router';
import type { RouteObject } from 'react-router';
import { hasRefreshToken } from '../net/tokens';
import { BootScreen } from './BootScreen';
import { PlayError } from './PlayError';
import { RouteError } from './RouteError';

const actions = () => import('./actions');
const loaders = () => import('./loaders');

const child = <R extends RouteObject>(r: R): R => ({ errorElement: <RouteError />, ...r });

/** What a loader-bearing top-level route shows during the very first load (the body is already --bg-0). */
function Blank() {
  return <div aria-busy="true" />;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    loader: () => (hasRefreshToken() ? redirect('/play') : null),
    hydrateFallbackElement: <Blank />,
    lazy: async () => ({ Component: (await import('../screens/LandingPage')).LandingPage }),
  },
  {
    path: '/login',
    hydrateFallbackElement: <Blank />,
    lazy: async () => {
      const [{ AuthScreen }, a] = await Promise.all([import('../screens/AuthScreen'), actions()]);
      return { element: <AuthScreen mode="login" />, action: a.loginAction };
    },
  },
  {
    path: '/register',
    hydrateFallbackElement: <Blank />,
    lazy: async () => {
      const [{ AuthScreen }, a] = await Promise.all([import('../screens/AuthScreen'), actions()]);
      return { element: <AuthScreen mode="register" />, action: a.registerAction };
    },
  },
  // Phase C6: password reset and email verification (the links in the emails); no session needed
  {
    path: '/forgot',
    hydrateFallbackElement: <Blank />,
    lazy: async () => {
      const m = await import('../screens/AccountScreens');
      return { Component: m.ForgotScreen, action: m.forgotAction };
    },
  },
  {
    path: '/reset',
    hydrateFallbackElement: <Blank />,
    lazy: async () => {
      const m = await import('../screens/AccountScreens');
      return { Component: m.ResetScreen, action: m.resetAction };
    },
  },
  {
    path: '/verify',
    hydrateFallbackElement: <Blank />,
    lazy: async () => {
      const m = await import('../screens/AccountScreens');
      return { Component: m.VerifyScreen, loader: m.verifyLoader };
    },
  },
  {
    id: 'canvas-host',
    // no loader, no errorElement (rule 1); the boot screen covers the moment its module is still loading
    hydrateFallbackElement: <BootScreen />,
    lazy: async () => ({ Component: (await import('./CanvasHost')).CanvasHost }),
    children: [
      {
        id: 'play',
        path: '/play',
        shouldRevalidate: () => false, // the canvas layout never re-runs its loader on child navigation
        hydrateFallbackElement: <BootScreen />, // shown only before the FIRST /me resolves
        errorElement: <PlayError />, // replaces PanelHost only; the canvas is CanvasHost's
        lazy: async () => {
          const [{ PlayShell }, l] = await Promise.all([import('./PlayShell'), loaders()]);
          return { Component: PlayShell, loader: l.playLoader }; // requireSession() then GET /me then hydrateFromMe()
        },
        children: [
          child({
            path: 'party',
            lazy: async () => {
              const [{ PartyScreen }, a] = await Promise.all([import('../screens/PartyScreen'), actions()]);
              return { Component: PartyScreen, action: a.partyAction };
            },
          }),
          child({
            path: 'box',
            lazy: async () => {
              const [{ BoxScreen }, a] = await Promise.all([import('../screens/BoxScreen'), actions()]);
              return { Component: BoxScreen, action: a.boxAction };
            },
          }),
          child({
            path: 'dex',
            lazy: async () => {
              const [{ DexScreen }, l] = await Promise.all([import('../screens/DexScreen'), loaders()]);
              return { Component: DexScreen, loader: l.dexLoader };
            },
          }),
          child({
            path: 'shop',
            lazy: async () => {
              const [{ ShopScreen }, l, a] = await Promise.all([import('../screens/ShopScreen'), loaders(), actions()]);
              return { Component: ShopScreen, loader: l.shopLoader, action: a.shopAction };
            },
          }),
          child({
            path: 'social',
            lazy: async () => {
              const [{ SocialScreen }, l, a] = await Promise.all([import('../screens/SocialScreen'), loaders(), actions()]);
              return { Component: SocialScreen, loader: l.friendsLoader, action: a.socialAction };
            },
            children: [
              child({
                path: ':username',
                lazy: async () => {
                  const [{ DmThread }, l, a] = await Promise.all([import('../screens/DmThread'), loaders(), actions()]);
                  return { Component: DmThread, loader: l.dmLoader, action: a.socialAction };
                },
              }),
            ],
          }),
          child({
            path: 'guild',
            lazy: async () => {
              const [{ GuildScreen }, l, a] = await Promise.all([import('../screens/GuildScreen'), loaders(), actions()]);
              return { Component: GuildScreen, loader: l.guildLoader, action: a.guildAction };
            },
          }),
          child({
            path: 'market',
            lazy: async () => {
              const [{ MarketScreen }, l, a] = await Promise.all([import('../screens/MarketScreen'), loaders(), actions()]);
              return { Component: MarketScreen, loader: l.marketLoader, action: a.marketAction };
            },
            children: [
              child({
                path: ':listingId',
                lazy: async () => {
                  const [{ ListingDetail }, l, a] = await Promise.all([import('../screens/ListingDetail'), loaders(), actions()]);
                  return { Component: ListingDetail, loader: l.listingLoader, action: a.marketAction };
                },
              }),
            ],
          }),
          child({
            path: 'pass',
            lazy: async () => {
              const [{ BattlePassScreen }, l, a] = await Promise.all([import('../screens/BattlePassScreen'), loaders(), actions()]);
              return { Component: BattlePassScreen, loader: l.battlePassLoader, action: a.passAction };
            },
          }),
          child({
            path: 'quests',
            lazy: async () => {
              const [{ QuestScreen }, a] = await Promise.all([import('../screens/QuestScreen'), actions()]);
              return { Component: QuestScreen, action: a.questAction };
            },
          }),
          child({
            path: 'map',
            lazy: async () => ({ Component: (await import('../screens/MapScreen')).MapScreen }),
          }),
          // Phase C5: the bag (key B)
          child({
            path: 'bag',
            lazy: async () => {
              const [{ BagScreen }, a] = await Promise.all([import('../screens/BagScreen'), actions()]);
              return { Component: BagScreen, action: a.bagAction };
            },
          }),
          // Phase C4: rankings, history, the own profile and public profiles
          child({
            path: 'rankings',
            lazy: async () => {
              const [{ RankingsScreen }, l] = await Promise.all([import('../screens/RankingsScreen'), loaders()]);
              return { Component: RankingsScreen, loader: l.rankingsLoader };
            },
          }),
          // arena PvP: queues, the Weekly Cup, AI training and friend challenges (battles outside the world)
          child({
            path: 'pvp',
            lazy: async () => {
              const [{ PvpScreen }, l] = await Promise.all([import('../screens/PvpScreen'), loaders()]);
              return { Component: PvpScreen, loader: l.pvpLoader };
            },
          }),
          child({
            path: 'history',
            lazy: async () => {
              const [{ HistoryScreen }, l] = await Promise.all([import('../screens/HistoryScreen'), loaders()]);
              return { Component: HistoryScreen, loader: l.historyLoader };
            },
          }),
          child({
            path: 'profile',
            lazy: async () => {
              const [{ ProfileScreen }, l, a] = await Promise.all([import('../screens/ProfileScreen'), loaders(), actions()]);
              return { Component: ProfileScreen, loader: l.profileLoader, action: a.profileAction };
            },
          }),
          child({
            path: 'players/:username',
            lazy: async () => {
              const [{ PlayerScreen }, l] = await Promise.all([import('../screens/PlayerScreen'), loaders()]);
              return { Component: PlayerScreen, loader: l.playerLoader };
            },
          }),
          child({
            path: 'replay/:token',
            lazy: async () => {
              const [{ ReplayScreen }, l] = await Promise.all([import('../screens/ReplayScreen'), loaders()]);
              return { Component: ReplayScreen, loader: l.replayLoader };
            },
          }),
          child({
            path: 'settings',
            lazy: async () => ({ Component: (await import('../screens/SettingsScreen')).SettingsScreen }),
          }),
        ],
      },
    ],
  },
  {
    path: '/admin',
    errorElement: <RouteError />,
    hydrateFallbackElement: <Blank />,
    lazy: async () => {
      const [{ AdminScreen }, l, a] = await Promise.all([import('../screens/AdminScreen'), loaders(), actions()]);
      return { Component: AdminScreen, loader: l.adminLoader, action: a.adminAction };
    },
  },
  // §20.2.5: every component in every state, dev builds only
  ...(import.meta.env.DEV ? [{ path: '/__gallery', hydrateFallbackElement: <Blank />, lazy: async () => ({ Component: (await import('../ui/Gallery')).Gallery }) } satisfies RouteObject] : []),
  { path: '*', element: <Blank />, loader: () => redirect('/play'), hydrateFallbackElement: <Blank /> },
];

/**
 * Deviation D1: the router is created by a function (main.tsx calls it once) rather than a module-level
 * `export const router`, so importing `routes` (tests, createMemoryRouter) never starts a browser router.
 */
export function createAppRouter(): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter(routes);
}
