// @vitest-environment jsdom
/**
 * §50.4.7 routes.test: every route in `routes` renders under createMemoryRouter with no thrown error; an unknown path
 * redirects to /play; back navigation restores the previous URL; no route mounts a renderer in jsdom (the world is
 * behind a capability check forced to false); the canvas host is a pathless layout above /play and survives a child
 * loader error and a /play loader error (rule 1). Servers routes that are not live (social, guilds, market) render
 * their "not live yet" state from the 404.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import { routes } from '../src/app/router';
import { __resetApiForTests, storeTokens } from '../src/net/api';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession } from '../src/net/WorldSession';
import { setWorldCapabilityOverride } from '../src/scene/worldHost';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { inOneHour, json, makeJwt, meFixture, publicProfileFixture } from './fixtures';

// jsdom's AbortSignal is not the one Node's Request accepts; React Router builds a Request per navigation.
beforeAll(() => {
  try {
    new Request('http://localhost/', { signal: new AbortController().signal });
  } catch (_e) {
    const Native = globalThis.Request;
    class PatchedRequest extends Native {
      constructor(input: RequestInfo | URL, init: RequestInit = {}) {
        const { signal, ...rest } = init;
        super(input, rest);
        Object.defineProperty(this, 'signal', { value: signal ?? new AbortController().signal });
      }
    }
    globalThis.Request = PatchedRequest as typeof Request;
  }
});

const fakeWorld: WorldSession = {
  room: null,
  selfId: '',
  zoneId: null,
  enter: vi.fn(async () => undefined),
  send: vi.fn(),
  onMessage: () => () => undefined,
  handover: async () => undefined,
  leave: vi.fn(async () => undefined),
  onRoom: () => () => undefined,
  onReconnected: () => () => undefined,
  // arena PvP seams (unused here)
  arenaRoom: null,
  kind: 'zone',
  homeZone: null,
  enterArena: async () => undefined,
  returnToWorld: async () => undefined,
  onArena: () => () => undefined,
  subscribeState: () => () => undefined,
};

const notFoundRoute = (): Response => json({ message: 'Route not found', error: 'Not Found', statusCode: 404 }, 404);
let overrides: Record<string, () => Response> = {};

function respond(url: string): Response {
  const path = url.replace(/^\/api/, '').split('?')[0]!;
  const o = overrides[path];
  if (o !== undefined) return o();
  if (path === '/me') return json(meFixture());
  if (path === '/dex') return json({ seen: ['glimfin'], caught: ['bramblecub'], variants: { bramblecub: ['normal'] }, alpha: [] });
  if (path === '/shop/mirevale') return json({ stock: ['potion', 'spark_orb'], prices: { potion: 150, spark_orb: 200 } });
  if (path === '/battle-pass') return json(meFixture().battlePass);
  if (path === '/leaderboard') return json({ rows: [] });
  if (path === '/history/battles' || path === '/history/trades') return json({ rows: [] });
  if (path === '/players/qa_tester') return json(publicProfileFixture());
  if (path === '/auth/refresh') return json({ access: makeJwt(inOneHour()), refresh: 'r2' });
  return notFoundRoute(); // friends, messages, guilds, marketplace, admin stats/players: server part 2
}

function mount(entries: string[]) {
  const router = createMemoryRouter(routes as RouteObject[], { initialEntries: entries });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  overrides = {};
  localStorage.clear();
  __resetApiForTests();
  useSessionStore.getState().clearSession();
  useNotificationsStore.getState().clear();
  setWorldCapabilityOverride(false);
  __setWorldSessionForTests(fakeWorld);
  storeTokens(makeJwt(inOneHour()), 'refresh-1');
  vi.stubGlobal('fetch', vi.fn(async (url: string) => respond(url)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const noErrors = (): void => {
  expect(screen.queryByTestId('playerror')).toBeNull();
  expect(screen.queryByText('This panel failed to load')).toBeNull();
};

describe('every route renders', () => {
  it.each([
    ['/play', 'playshell'],
    ['/play/party', 'panel'],
    ['/play/box', 'panel'],
    ['/play/dex', 'panel'],
    ['/play/shop', 'panel'],
    ['/play/social', 'panel'],
    ['/play/social/someone', 'panel'],
    ['/play/guild', 'panel'],
    ['/play/market', 'panel'],
    ['/play/market/44444444-4444-4444-8444-444444444444', 'panel'],
    ['/play/pass', 'panel'],
    ['/play/quests', 'panel'],
    ['/play/settings', 'panel'],
    ['/play/bag', 'panel'],
    ['/play/rankings', 'panel'],
    ['/play/history', 'panel'],
    ['/play/profile', 'panel'],
    ['/play/players/qa_tester', 'panel'],
  ])('%s', async (path, testId) => {
    mount([path]);
    // the first lazy route transforms PlayShell's whole module graph (part 2's world modals / battle DOM) on a cold
    // worker: > 4 s when the full suite runs in parallel
    await screen.findByTestId(testId, {}, { timeout: 15000 });
    await screen.findByTestId('topbar');
    noErrors();
    // the world view is capability-gated: no renderer canvas in jsdom
    expect(screen.getByTestId('gamecanvas-fallback')).toBeTruthy();
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('/login and /register render the auth card (no canvas host)', async () => {
    localStorage.clear();
    mount(['/login']);
    await screen.findByTestId('login');
    expect(screen.queryByTestId('canvashost')).toBeNull();
    cleanup();
    mount(['/register']);
    await screen.findByTestId('register');
    expect(screen.getAllByTestId('creaturecard')).toHaveLength(3);
  });

  it('/ shows the landing page without a session and redirects to /play with one', async () => {
    localStorage.clear();
    mount(['/']);
    await screen.findByTestId('landing');
    cleanup();
    storeTokens(makeJwt(inOneHour()), 'refresh-1');
    const router = mount(['/']);
    await waitFor(() => expect(router.state.location.pathname).toBe('/play'));
  });

  it('/admin sends a non-admin back to /play and renders for an admin', async () => {
    const router = mount(['/admin']);
    await waitFor(() => expect(router.state.location.pathname).toBe('/play'));
    cleanup();
    useSessionStore.getState().clearSession();
    overrides['/me'] = () => json(meFixture({ isAdmin: true }));
    overrides['/admin/metrics'] = () => json({ rooms: [], rest: {}, db: { txPerSec: 0, txP99Ms: 0, poolInUse: 0 }, presenceSize: 0, heapMb: 80 });
    mount(['/admin']);
    await screen.findByTestId('admin');
    expect(screen.getByText('Player search is not live yet')).toBeTruthy();
  });

  it('server routes that are not live render their unavailable state, not an error', async () => {
    mount(['/play/guild']);
    await screen.findByText('Guilds — not live yet');
    noErrors();
  });

  it('no refresh token → /play redirects to /login?next=', async () => {
    localStorage.clear();
    useSessionStore.getState().clearSession();
    const router = mount(['/play/dex']);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/play/dex')}`);
  });
});

describe('navigation', () => {
  it('an unknown path redirects to /play', async () => {
    const router = mount(['/definitely/not/a/route']);
    await waitFor(() => expect(router.state.location.pathname).toBe('/play'));
    await screen.findByTestId('playshell');
  });

  it('back navigation restores the previous URL (filters are URL state)', async () => {
    const router = mount(['/play/party']);
    await screen.findByTestId('panel');
    await act(() => router.navigate('/play/dex?type=Grass'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/play/dex'));
    await act(() => router.navigate('/play/settings?tab=audio'));
    await act(() => router.navigate(-1));
    await waitFor(() => expect(router.state.location.search).toBe('?type=Grass'));
    await act(() => router.navigate(-1));
    await waitFor(() => expect(router.state.location.pathname).toBe('/play/party'));
  });
});

describe('the canvas host (rule 1)', () => {
  it('is a pathless layout above /play', () => {
    const host = routes.find((r) => r.id === 'canvas-host')!;
    expect(host.path).toBeUndefined();
    expect(host.loader).toBeUndefined();
    expect(host.errorElement).toBeUndefined();
    expect(host.children?.[0]?.path).toBe('/play');
  });

  it('survives a child loader error: the same host node stays mounted', async () => {
    overrides['/dex'] = () => json({ code: 'internal' }, 500);
    const router = mount(['/play/party']);
    await screen.findByTestId('panel');
    const host = screen.getByTestId('canvashost');
    await act(() => router.navigate('/play/dex'));
    await screen.findByText('This panel failed to load');
    expect(screen.getByTestId('canvashost')).toBe(host);
    expect(screen.getByTestId('topbar')).toBeTruthy();
  });

  it('survives a /play loader error (PlayError replaces the panel host only)', async () => {
    overrides['/me'] = () => json({ code: 'internal' }, 500);
    mount(['/play']);
    await screen.findByTestId('playerror');
    expect(screen.getByTestId('canvashost')).toBeTruthy();
  });

  it('joins the world once per session through WorldSession.enter', async () => {
    mount(['/play/party']);
    await screen.findByTestId('panel');
    await waitFor(() => expect(fakeWorld.enter).toHaveBeenCalledWith('mirevale'));
  });
});
