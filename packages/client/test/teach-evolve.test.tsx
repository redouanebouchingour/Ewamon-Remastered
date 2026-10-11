// @vitest-environment jsdom
/**
 * Phase D2/D3 in the client: the Teach section of the party detail (owned TMs → POST /creature/:id/moves; a tutor's
 * moves when opened from it → POST /creature/:id/tutor), evolution stones from the bag (the evolve prompt carries the
 * stone) and the trade-evolution prompt queued from a trade's creaturesUpdated. Fetch is mocked.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import { MOVE_TUTOR_PRICE, TRADE_EVOLVE_RIBBON, tmItemId } from '@ewa/content';
import { presentItemUse } from '../src/app/itemUseFeedback';
import { routes } from '../src/app/router';
import { bagUse, noEffectReason } from '../src/data/bag';
import { ownedTmMoves, stoneTarget, teachRefusal, tradeEvolveTarget } from '../src/data/content';
import { routeServerMessage } from '../src/net/messageRouter';
import { __resetApiForTests, storeTokens } from '../src/net/api';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession } from '../src/net/WorldSession';
import { setWorldCapabilityOverride } from '../src/scene/worldHost';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { creature, inOneHour, json, makeJwt, meFixture } from './fixtures';

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

const GHOST = creature('nerohat', { nickname: 'Hatty', ability: 'Levitate', moves: [{ id: 'Lick', pp: 30, ppMax: 30 }, { id: 'Tackle', pp: 35, ppMax: 35 }] });
const INVENTORY = { [tmItemId('Shadow Ball')]: 1, [tmItemId('Ice Beam')]: 1, potion: 1 };
const calls: { path: string; body: unknown }[] = [];

function respond(url: string, init?: RequestInit): Response {
  const path = url.replace(/^\/api/, '').split('?')[0]!;
  const method = init?.method ?? 'GET';
  const body = method === 'POST' ? (JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>) : {};
  if (method === 'POST') calls.push({ path, body });
  if (path === '/me') return json(meFixture({ zoneId: 'vesperveil', presence: { roomId: null, zoneId: 'vesperveil', shard: 0 }, money: 5000, party: [GHOST] as never, inventory: INVENTORY }));
  if (path === '/auth/refresh') return json({ access: makeJwt(inOneHour()), refresh: 'r2' });
  if (path === `/creature/${GHOST.id}/moves`) {
    const moves = (body['moves'] as string[]).map((id) => ({ id, pp: 10, ppMax: 10 }));
    return json({ ...GHOST, moves });
  }
  if (path === `/creature/${GHOST.id}/tutor`) {
    const next = { ...GHOST, moves: [...GHOST.moves, { id: String(body['move']), pp: 30, ppMax: 30 }] };
    return json({ ...next, inventoryDelta: { items: {}, money: 5000 - MOVE_TUTOR_PRICE, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [next] } });
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
  localStorage.clear();
  __resetApiForTests();
  useSessionStore.getState().clearSession();
  useNotificationsStore.getState().clear();
  useUiStore.setState({ prompts: [] });
  setWorldCapabilityOverride(false);
  __setWorldSessionForTests(fakeWorld);
  storeTokens(makeJwt(inOneHour()), 'refresh-1');
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => respond(url, init)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('display helpers', () => {
  it('owned TMs, teach refusals, stone targets and trade targets mirror the server rules', () => {
    expect(ownedTmMoves(INVENTORY)).toEqual(['Ice Beam', 'Shadow Ball']); // TM order
    expect(teachRefusal(GHOST, 'Shadow Ball')).toBeNull(); // Ghost move, Ghost species
    expect(teachRefusal(GHOST, 'Ice Beam')).toBe('Needs a Ice-type');
    expect(teachRefusal(GHOST, 'Body Slam')).toBeNull(); // Normal: anyone
    expect(teachRefusal(GHOST, 'Lick')).toBe('Already known');
    const embrock = creature('embrock');
    expect(stoneTarget('ember_stone', embrock)).toBe('magmolith');
    expect(stoneTarget('tide_stone', embrock)).toBeNull();
    expect(bagUse('ember_stone')).toBe('creature');
    expect(noEffectReason('ember_stone', embrock)).toBeNull();
    expect(noEffectReason('ember_stone', GHOST)).toBe('Does not react to it');
    expect(bagUse(tmItemId('Shadow Ball'))).toBe('none');
    const glowtent = creature('glowtent');
    expect(tradeEvolveTarget(glowtent)).toBeNull();
    expect(tradeEvolveTarget({ ...glowtent, ribbons: [TRADE_EVOLVE_RIBBON] })).toBe('toxiveil');
  });
});

describe('evolve prompts', () => {
  it('a stone from /item/use queues one evolve prompt carrying the stone (nothing spent yet)', () => {
    const embrock = creature('embrock');
    presentItemUse('ember_stone', 1, embrock, [{ t: 'evolveReady', into: 'magmolith', item: 'ember_stone' }]);
    presentItemUse('ember_stone', 1, embrock, [{ t: 'evolveReady', into: 'magmolith', item: 'ember_stone' }]);
    expect(useUiStore.getState().prompts).toEqual([{ kind: 'evolve', creatureId: embrock.id, into: 'magmolith', item: 'ember_stone' }]);
  });

  it("a trade's creaturesUpdated with the trade marker queues the trade-evolution prompt", () => {
    useSessionStore.getState().hydrateFromMe(meFixture());
    const got = creature('glowtent', { ribbons: [TRADE_EVOLVE_RIBBON] });
    const plain = creature('glimp');
    routeServerMessage(
      { type: 'inventoryDelta', items: {}, money: null, creaturesAdded: [got, plain], creaturesRemoved: [], creaturesUpdated: [got], placement: { [got.id]: 'box', [plain.id]: 'box' } },
      { handover: async () => undefined, selfId: 'me' },
    );
    expect(useUiStore.getState().prompts).toEqual([{ kind: 'evolve', creatureId: got.id, into: 'toxiveil', trade: true }]);
    expect(useSessionStore.getState().inventory?.box.map((c) => c.id)).toEqual([got.id, plain.id]);
  });
});

describe('/play/party Teach', () => {
  it('lists owned TMs (incompatible ones disabled) and teaches one through POST /creature/:id/moves', async () => {
    mount('/play/party');
    const teach = await screen.findByRole('region', { name: 'Teach' }, { timeout: 15000 });
    const tms = within(teach).getByRole('list', { name: 'Your TMs' });
    expect(within(tms).getByRole('button', { name: 'Teach Ice Beam to Hatty' }).hasAttribute('disabled')).toBe(true);
    await act(async () => {
      fireEvent.click(within(tms).getByRole('button', { name: 'Teach Shadow Ball to Hatty' }));
    });
    await waitFor(() => expect(calls).toEqual([{ path: `/creature/${GHOST.id}/moves`, body: { moves: ['Lick', 'Tackle', 'Shadow Ball'] } }]));
    await waitFor(() => expect(useSessionStore.getState().inventory?.party[0]?.moves.map((m) => m.id)).toEqual(['Lick', 'Tackle', 'Shadow Ball']));
    expect(useSessionStore.getState().inventory?.items[tmItemId('Shadow Ball')]).toBe(1); // TMs are kept
    expect(useNotificationsStore.getState().toasts.some((t) => t.text === 'Hatty learned Shadow Ball!')).toBe(true);
  });

  it("opened from the Vesperveil tutor it lists the tutor's moves and pays through POST /creature/:id/tutor", async () => {
    mount('/play/party?tutor=vesperveil.lantern_maker');
    const teach = await screen.findByRole('region', { name: 'Teach' }, { timeout: 15000 });
    const tutorList = within(teach).getByRole('list', { name: 'Moves a lantern-maker teaches' });
    await act(async () => {
      fireEvent.click(within(tutorList).getByRole('button', { name: 'Teach Shadow Sneak to Hatty (tutor)' }));
    });
    await waitFor(() => expect(calls).toEqual([{ path: `/creature/${GHOST.id}/tutor`, body: { move: 'Shadow Sneak', forget: null } }]));
    await waitFor(() => expect(useSessionStore.getState().inventory?.money).toBe(5000 - MOVE_TUTOR_PRICE));
    expect(useSessionStore.getState().inventory?.party[0]?.moves.map((m) => m.id)).toContain('Shadow Sneak');
  });

  it('a tutor id from another zone shows no tutor list', async () => {
    mount('/play/party?tutor=skyrend.roost_keeper');
    const teach = await screen.findByRole('region', { name: 'Teach' }, { timeout: 15000 });
    expect(within(teach).queryByRole('list', { name: /teaches/ })).toBeNull();
    expect(within(teach).getByRole('list', { name: 'Your TMs' })).toBeTruthy();
  });
});
