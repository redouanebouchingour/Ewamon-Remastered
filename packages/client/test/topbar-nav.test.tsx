// @vitest-environment jsdom
/**
 * Broadcast top bar (2026-10-11): five primary links (Party · Bag · Dex · Map · Quests) with their key chips, the
 * rest behind a "More" disclosure whose button carries the rolled-up counts; Escape closes it (focus back on the
 * button, an open panel stays open), choosing a link navigates and closes it.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import { routes } from '../src/app/router';
import { NAV, NAV_MORE, NAV_PRIMARY, keyLabel } from '../src/app/TopBar';
import { __resetApiForTests, storeTokens } from '../src/net/api';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession } from '../src/net/WorldSession';
import { setWorldCapabilityOverride } from '../src/scene/worldHost';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { DEFAULT_SETTINGS, useSettingsStore } from '../src/state/settings';
import { useUiStore } from '../src/state/ui';
import { inOneHour, json, makeJwt, meFixture } from './fixtures';

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
  send: vi.fn() as WorldSession['send'],
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

function respond(url: string): Response {
  const path = url.replace(/^\/api/, '').split('?')[0]!;
  if (path === '/me') return json(meFixture({}));
  if (path === '/auth/refresh') return json({ access: makeJwt(inOneHour()), refresh: 'r2' });
  return json({ message: 'Route not found', error: 'Not Found', statusCode: 404 }, 404);
}

beforeEach(() => {
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

function mount(path: string) {
  const router = createMemoryRouter(routes as RouteObject[], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('nav model', () => {
  it('five primary links, twelve behind More, every panel reachable once', () => {
    expect(NAV_PRIMARY.map((n) => n.label)).toEqual(['Party', 'Bag', 'Dex', 'Map', 'Quests']);
    expect(NAV_MORE.map((n) => n.label)).toEqual(['PvP', 'Professor', 'Rumours', 'Journal', 'Factions', 'Box', 'Shop', 'Social', 'Guild', 'Market', 'Pass', 'Settings']);
    expect(new Set(NAV.map((n) => n.to)).size).toBe(17);
  });

  it('key chips spell codes as the tutorial card does', () => {
    expect(['KeyP', 'Escape', 'Digit1', undefined].map(keyLabel)).toEqual(['P', 'Esc', '1', '']);
  });
});

describe('the top bar', () => {
  it('shows the primary links with key chips; More discloses the rest with the rolled-up count', { timeout: 30_000 }, async () => {
    const router = mount('/play');
    const bar = await screen.findByTestId('topbar', {}, { timeout: 15000 });
    // once /me hydrated the store (hydration seeds the counts from the profile, so seed after it)
    await waitFor(() => expect(useSessionStore.getState().profile).not.toBeNull());
    act(() => useNotificationsStore.getState().seed({ unreadDm: { ace: 2 }, friendRequests: 1, pendingBattlePassClaims: 4 }));
    const nav = within(bar).getByRole('navigation', { name: 'Menus' });
    const party = within(nav).getByRole('link', { name: /Party/ });
    expect(party.textContent).toContain('P');
    expect(within(nav).queryByRole('link', { name: /Shop/ })).toBeNull();

    const more = within(nav).getByRole('button', { name: /More/ });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    // Social 2 + 1, Pass 4
    await waitFor(() => expect(within(more).getByLabelText('7 new')).toBeTruthy());

    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    const list = within(nav).getByRole('list', { name: 'More menus' });
    expect(within(list).getAllByRole('link').map((a) => a.textContent?.replace(/\d+|Esc|[KL]$/g, '').trim())).toEqual(NAV_MORE.map((n) => n.label));
    expect(document.activeElement).toBe(within(list).getAllByRole('link')[0]);

    // Escape closes it and gives focus back to the button
    fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(more);

    // choosing a link navigates and closes; the button then marks the current panel
    fireEvent.click(more);
    await act(async () => {
      fireEvent.click(within(within(nav).getByRole('list', { name: 'More menus' })).getByRole('link', { name: /Shop/ }));
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/play/shop'));
    // the closed menu and the current-panel mark land with the route's commit (slow under a loaded full run)
    await waitFor(() => expect(within(nav).queryByRole('list', { name: 'More menus' })).toBeNull(), { timeout: 5000 });
    await waitFor(() => expect(within(nav).getByRole('button', { name: /More/ }).textContent).toContain('current: Shop'), { timeout: 5000 });
  });

  it('Escape with the menu open keeps the panel open', async () => {
    const router = mount('/play/party');
    await screen.findByTestId('panel', {}, { timeout: 15000 });
    const more = within(screen.getByTestId('topbar')).getByRole('button', { name: /More/ });
    fireEvent.click(more);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(router.state.location.pathname).toBe('/play/party');
  });
});

describe('the fps chip', () => {
  afterEach(() => useSettingsStore.getState().set('graphics', { showFps: DEFAULT_SETTINGS.graphics.showFps }));

  it('shows the last second\'s frames only while Settings › Graphics › Show FPS is on', { timeout: 30_000 }, async () => {
    mount('/play');
    const bar = await screen.findByTestId('topbar', {}, { timeout: 15000 });
    expect(within(bar).queryByTestId('fps-chip')).toBeNull();
    act(() => {
      useSettingsStore.getState().set('graphics', { showFps: true });
      useUiStore.getState().setFps(58);
    });
    expect(within(bar).getByTestId('fps-chip').textContent).toBe('58 fps');
    act(() => useSettingsStore.getState().set('graphics', { showFps: false }));
    expect(within(bar).queryByTestId('fps-chip')).toBeNull();
  });
});
