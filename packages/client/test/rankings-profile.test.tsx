// @vitest-environment jsdom
/**
 * Phase C4 — `/play/rankings` (GET /leaderboard per mode, tabs bound to ?mode=, the player's own row marked, names link
 * to public profiles), `/play/history` (battles / trades tabs), `/play/profile` (POST /profile → applyProfile) and
 * `/play/players/:username` (public profile; a 404 renders "No trainer by that name"). Fetch is mocked.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import type { LeaderboardRow } from '@ewa/protocol';
import { routes } from '../src/app/router';
import { ACCOUNT_LINKS } from '../src/app/TopBar';
import { __resetApiForTests, storeTokens } from '../src/net/api';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession } from '../src/net/WorldSession';
import { setWorldCapabilityOverride } from '../src/scene/worldHost';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { PLAYER_ID, inOneHour, json, makeJwt, meFixture, publicProfileFixture } from './fixtures';

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
  subscribeState: () => () => undefined,
};

const OTHER_ID = '33333333-3333-4333-8333-333333333333';

function row(rank: number, id: string, username: string, over: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return { rank, id, username, title: 'Rookie Trainer', body: 'ranger_m', rating: 1000, tier: 'bronze', trainerLevel: 1, dexCaughtCount: 1, guildTag: null, ...over };
}

const BOARDS: Readonly<Record<string, LeaderboardRow[]>> = {
  rating: [row(1, OTHER_ID, 'ace_rival', { rating: 1320, tier: 'gold', guildTag: 'MIRE' }), row(2, PLAYER_ID, 'qa_tester')],
  dex: [row(1, PLAYER_ID, 'qa_tester', { dexCaughtCount: 12 }), row(2, OTHER_ID, 'ace_rival', { dexCaughtCount: 9 })],
  trainerLevel: [row(1, OTHER_ID, 'ace_rival', { trainerLevel: 7 })],
};

const calls: { url: string; method: string; body: unknown }[] = [];
let profileBody = { title: 'Rookie Trainer', motto: '', body: 'ranger_m' };

function respond(url: string, init?: RequestInit): Response {
  const [rawPath, search = ''] = url.replace(/^\/api/, '').split('?');
  const path = rawPath!;
  const method = init?.method ?? 'GET';
  calls.push({ url, method, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
  const q = new URLSearchParams(search);
  if (path === '/me') return json(meFixture({ ...profileBody }));
  if (path === '/auth/refresh') return json({ access: makeJwt(inOneHour()), refresh: 'r2' });
  if (path === '/leaderboard') return json({ rows: BOARDS[q.get('mode') ?? 'rating'] ?? [] });
  if (path === '/players/qa_tester') return json(publicProfileFixture({ ...profileBody, badges: ['bloom'], dexCaughtCount: 12 }));
  if (path === '/players/ace_rival') return json(publicProfileFixture({ id: OTHER_ID, username: 'ace_rival', title: 'Witness', motto: 'Never fold.', rating: 1320, peakRating: 1400, tier: 'gold', guildTag: 'MIRE' }));
  if (path.startsWith('/players/')) return json({ code: 'NotFound' }, 404);
  if (path === '/history/battles') {
    return json({
      rows: [
        { id: 1, battleId: '44444444-4444-4444-8444-444444444441', opponent: 'Grove-Keeper Mira', format: 'league', result: 'win', turns: 9, ratingDelta: null, rewards: { money: 1200, items: {}, trainerExp: 150, ratingDelta: null, badge: 'bloom' }, happenedAt: new Date(Date.now() - 3_600_000).toISOString() },
        { id: 2, battleId: '44444444-4444-4444-8444-444444444442', opponent: 'ace_rival', format: 'pvp', result: 'loss', turns: 14, ratingDelta: -16, rewards: { money: 0, items: {}, trainerExp: 20, ratingDelta: -16, badge: null }, happenedAt: new Date(Date.now() - 7_200_000).toISOString() },
      ],
    });
  }
  if (path === '/history/trades') {
    return json({
      rows: [
        { id: 7, tradeId: '55555555-5555-4555-8555-555555555555', partnerId: OTHER_ID, partnerUsername: 'ace_rival', sent: [{ id: '66666666-6666-4666-8666-666666666666', speciesId: 'glimfin', level: 8 }], received: [], moneySent: 0, moneyReceived: 500, completedAt: new Date(Date.now() - 86_400_000).toISOString() },
      ],
    });
  }
  if (path === '/profile' && method === 'POST') {
    const b = JSON.parse(String(init?.body)) as typeof profileBody;
    profileBody = { title: b.title, motto: b.motto, body: b.body };
    const me = meFixture({ ...profileBody });
    const { party: _p, box: _b, inventory: _i, badges: _bd, flags: _f, quests: _q, battlePass: _bp, presence: _pr, unreadDm: _u, friendRequests: _fr, liveOps: _l, ...profile } = me;
    return json(profile);
  }
  return json({ message: 'Route not found', error: 'Not Found', statusCode: 404 }, 404);
}

function mount(path: string) {
  const router = createMemoryRouter(routes as RouteObject[], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  calls.length = 0;
  profileBody = { title: 'Rookie Trainer', motto: '', body: 'ranger_m' };
  localStorage.clear();
  __resetApiForTests();
  useSessionStore.getState().clearSession();
  useNotificationsStore.getState().clear();
  setWorldCapabilityOverride(false);
  __setWorldSessionForTests(fakeWorld);
  storeTokens(makeJwt(inOneHour()), 'refresh-1');
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => respond(url, init)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('account menu', () => {
  it('lists Profile, Rankings and History', () => {
    expect(ACCOUNT_LINKS.map((a) => a.to)).toEqual(['/play/profile', '/play/rankings', '/play/history']);
  });
});

describe('/play/rankings', () => {
  it('rating by default; the own row says You; the Dex tab refetches with mode=dex and leads with Caught; names link to profiles', async () => {
    const router = mount('/play/rankings');
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    await within(panel).findByText('ace_rival');
    expect(calls.some((c) => c.url.includes('/leaderboard?') && c.url.includes('mode=rating'))).toBe(true);
    const mine = within(panel).getByRole('row', { name: /qa_tester/ });
    expect(within(mine).getByText('You')).toBeTruthy();
    expect(within(panel).getByText('You are #2 on this board.')).toBeTruthy();
    const rival = within(panel).getByRole('row', { name: /ace_rival/ });
    expect(within(rival).queryByText('You')).toBeNull();
    expect(within(rival).getByText('Gold')).toBeTruthy();
    expect(within(rival).getByText('[MIRE]')).toBeTruthy();
    expect(within(panel).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['#', 'Trainer', 'Tier', 'Rating', 'Caught', 'Level']);

    fireEvent.click(within(panel).getByRole('tab', { name: 'Dex' }));
    await waitFor(() => expect(router.state.location.search).toBe('?mode=dex'));
    await waitFor(() => expect(within(screen.getByTestId('panel')).getByText('You are #1 on this board.')).toBeTruthy());
    expect(calls.some((c) => c.url.includes('mode=dex'))).toBe(true);
    expect(within(screen.getByTestId('panel')).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['#', 'Trainer', 'Tier', 'Caught', 'Rating', 'Level']);
    expect(within(screen.getByTestId('panel')).getByRole('tab', { name: 'Dex' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(within(screen.getByTestId('panel')).getByRole('tab', { name: 'Trainer level' }));
    await waitFor(() => expect(router.state.location.search).toBe('?mode=trainerLevel'));
    await waitFor(() => expect(within(screen.getByTestId('panel')).getByText('You are not on this page.')).toBeTruthy());

    fireEvent.click(within(screen.getByTestId('panel')).getByRole('link', { name: 'ace_rival' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/play/players/ace_rival'));
    const pub = await screen.findByRole('heading', { name: 'ace_rival', level: 2 });
    expect(pub).toBeTruthy();
    expect(screen.getByText('“Never fold.”')).toBeTruthy();
  });
});

describe('/play/players/:username', () => {
  it('renders the public card: identity, stats, badges, showcase', async () => {
    mount('/play/players/ace_rival');
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    await within(panel).findByText('“Never fold.”');
    const stats = within(panel).getByRole('region', { name: 'Stats' });
    expect(within(stats).getByText('1400')).toBeTruthy();
    expect(within(panel).getByRole('list', { name: '0 of 8 badges' })).toBeTruthy();
    expect(within(panel).getAllByTestId('creaturecard')).toHaveLength(1);
  });

  it('a 404 renders "No trainer by that name", not an error', async () => {
    mount('/play/players/ghost_user');
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    await within(panel).findByText('No trainer by that name');
    expect(screen.queryByText('This panel failed to load')).toBeNull();
  });
});

describe('/play/history', () => {
  it('battles first (result, opponent, rating change, rewards), then the trades tab with the partner linked', async () => {
    const router = mount('/play/history');
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    await within(panel).findByText('Grove-Keeper Mira');
    const win = within(panel).getByRole('row', { name: /Grove-Keeper Mira/ });
    expect(within(win).getByText('Win')).toBeTruthy();
    expect(within(win).getByText(/badge earned/)).toBeTruthy();
    expect(within(win).getByText('+1,200 · +150 exp')).toBeTruthy();
    const loss = within(panel).getByRole('row', { name: /ace_rival/ });
    expect(within(loss).getByText('−16')).toBeTruthy();

    fireEvent.click(within(panel).getByRole('tab', { name: 'Trades' }));
    await waitFor(() => expect(router.state.location.search).toBe('?tab=trades'));
    const link = await within(screen.getByTestId('panel')).findByRole('link', { name: 'ace_rival' });
    expect(link.getAttribute('href')).toBe('/play/players/ace_rival');
    expect(within(screen.getByTestId('panel')).getByText('Glimfin Lv 8')).toBeTruthy();
    expect(within(screen.getByTestId('panel')).getByText('500')).toBeTruthy();
  });
});

describe('/play/profile', () => {
  it('edits title / look / motto and saves through POST /profile; the session profile follows', async () => {
    mount('/play/profile');
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    await within(panel).findByRole('region', { name: 'Stats' });
    expect(within(panel).getByRole('button', { name: 'Save profile' }).hasAttribute('disabled')).toBe(true);
    expect(within(panel).getByRole('list', { name: '0 of 8 badges' })).toBeTruthy();
    expect(within(panel).getByRole('region', { name: 'Achievements' })).toBeTruthy();
    expect(within(panel).getByRole('listitem', { name: /First Night/ })).toBeTruthy();

    fireEvent.change(within(panel).getByLabelText('Title'), { target: { value: 'Witness' } });
    fireEvent.change(within(panel).getByLabelText('Look'), { target: { value: 'fisher_f' } });
    fireEvent.change(within(panel).getByLabelText('Motto'), { target: { value: '  Count the morning.  ' } });
    // the identity preview follows the draft
    expect(within(panel).getByText('“Count the morning.”')).toBeTruthy();
    expect(within(panel).getByText('Unsaved changes')).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Save profile' }));
    });
    await waitFor(() => expect(useSessionStore.getState().profile?.title).toBe('Witness'));
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([{ title: 'Witness', motto: 'Count the morning.', body: 'fisher_f' }]);
    expect(useSessionStore.getState().profile).toMatchObject({ motto: 'Count the morning.', body: 'fisher_f' });
    expect(useNotificationsStore.getState().toasts.some((t) => t.text === 'Profile saved.')).toBe(true);
    await waitFor(() => expect(within(screen.getByTestId('panel')).getByText('Saved')).toBeTruthy());
  });
});
