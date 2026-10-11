// @vitest-environment jsdom
/**
 * Phase C5 — `/play/bag`: items grouped consumables / orbs / held / key; Use on a creature → party picker →
 * POST /item/use { item, target, qty } (no-effect creatures disabled with the reason); a field item uses at once with
 * target null; Give a held item → POST /creature/:id/setup { ability, heldItem }; the `B` key opens the Bag (not Party)
 * and the hint bar says "Bag". Fetch is mocked; every result lands through the one inventory writer.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import { routes } from '../src/app/router';
import { NAV } from '../src/app/TopBar';
import { bagUse, groupBag, noEffectReason } from '../src/data/bag';
import { maxHpOf } from '../src/data/content';
import { __resetApiForTests, storeTokens } from '../src/net/api';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession } from '../src/net/WorldSession';
import { setWorldCapabilityOverride } from '../src/scene/worldHost';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
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

const HURT = creature('bramblecub', { hp: 5, nickname: 'Bramble' });
const FULL = creature('glimfin', { ability: 'Torrent', heldItem: 'Charcoal' });
const FULL_HP = { ...FULL, hp: maxHpOf(FULL) };
const INVENTORY = { potion: 3, repel: 1, spark_orb: 10, Charcoal: 1, 'Oran Berry': 2, 'HM Surf': 1 };

const calls: { path: string; method: string; body: unknown }[] = [];

function respond(url: string, init?: RequestInit): Response {
  const path = url.replace(/^\/api/, '').split('?')[0]!;
  const method = init?.method ?? 'GET';
  if (method === 'POST') calls.push({ path, method, body: JSON.parse(String(init?.body ?? '{}')) });
  if (path === '/me') return json(meFixture({ party: [HURT, FULL_HP] as never, inventory: INVENTORY }));
  if (path === '/auth/refresh') return json({ access: makeJwt(inOneHour()), refresh: 'r2' });
  if (path === '/item/use') {
    const b = JSON.parse(String(init?.body)) as { item: string; target: string | null };
    if (b.target === null) return json({ inventory: { ...INVENTORY, [b.item]: 0 }, creaturesUpdated: [], events: [{ t: 'itemUsed', item: b.item, target: null, qty: 1 }] });
    return json({ inventory: { ...INVENTORY, potion: 2 }, creaturesUpdated: [{ ...HURT, hp: 25 }], events: [{ t: 'itemUsed', item: b.item, target: b.target, qty: 1 }] });
  }
  if (path === `/creature/${HURT.id}/setup`) {
    const b = JSON.parse(String(init?.body)) as { ability: string; heldItem: string | null };
    const next = { ...HURT, ability: b.ability, heldItem: b.heldItem };
    return json({ ...next, inventoryDelta: { items: { 'Oran Berry': 1 }, money: null, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [next] } });
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
  setWorldCapabilityOverride(false);
  __setWorldSessionForTests(fakeWorld);
  storeTokens(makeJwt(inOneHour()), 'refresh-1');
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => respond(url, init)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('bag model', () => {
  it('groups owned items by kind, sorted by name, and skips empty stacks', () => {
    const g = groupBag({ ...INVENTORY, superpotion: 0 });
    expect(g.consumable.map((r) => r.info.id)).toEqual(['potion', 'repel']);
    expect(g.orb.map((r) => r.info.id)).toEqual(['spark_orb']);
    expect(g.held.map((r) => r.info.id)).toEqual(['Charcoal', 'Oran Berry']);
    expect(g.key.map((r) => r.info.id)).toEqual(['HM Surf']);
    expect(g.consumable[0]!.count).toBe(3);
  });

  it('how each item is used, and the no-effect reasons the server would answer', () => {
    expect(['potion', 'repel', 'escape_rope', 'spark_orb', 'Charcoal', 'HM Surf', 'nugget', 'rarecandy'].map(bagUse)).toEqual(['creature', 'field', 'field', 'none', 'give', 'none', 'none', 'creature']);
    expect(noEffectReason('potion', HURT)).toBeNull();
    expect(noEffectReason('potion', FULL_HP)).toBe('Already at full HP');
    expect(noEffectReason('potion', { ...HURT, hp: 0 })).toBe('Fainted');
    expect(noEffectReason('revive', HURT)).toBe('Not fainted');
    expect(noEffectReason('revive', { ...HURT, hp: 0 })).toBeNull();
    expect(noEffectReason('antidote', HURT)).toBe('No status to cure');
    expect(noEffectReason('antidote', { ...HURT, status: ['poison'] })).toBeNull();
    expect(noEffectReason('full_heal', { ...HURT, status: ['sleep'] })).toBeNull();
    expect(noEffectReason('rarecandy', { ...HURT, level: 100 })).toBe('Already level 100');
  });

  it('the nav lists the Bag', () => {
    expect(NAV.map((n) => n.to)).toContain('/play/bag');
  });
});

describe('/play/bag', () => {
  it('renders the four groups with their rows and actions', async () => {
    mount('/play/bag');
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    const consumables = await within(panel).findByRole('region', { name: 'Consumables' });
    expect(within(consumables).getByRole('listitem', { name: 'Potion ×3' })).toBeTruthy();
    expect(within(consumables).getByRole('button', { name: 'Use Repel' })).toBeTruthy();
    const orbs = within(panel).getByRole('region', { name: 'Orbs' });
    expect(within(orbs).getByText('Throw in battle')).toBeTruthy();
    const held = within(panel).getByRole('region', { name: 'Held items' });
    expect(within(held).getByRole('button', { name: 'Give Oran Berry' })).toBeTruthy();
    // who already holds a Charcoal is shown on its row
    expect(within(within(held).getByRole('listitem', { name: 'Charcoal ×1' })).getByText('Held by Glimfin')).toBeTruthy();
    const key = within(panel).getByRole('region', { name: 'Key items' });
    expect(within(key).getByRole('listitem', { name: 'HM Surf ×1' })).toBeTruthy();
    expect(within(key).queryByRole('button')).toBeNull();
  });

  it('Use a potion: the picker disables a full-HP creature and posts the target; the inventory and creature update', async () => {
    mount('/play/bag');
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Use Potion' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Use Potion on Glimfin' }).hasAttribute('disabled')).toBe(true);
    expect(within(dialog).getByText('Already at full HP')).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Use Potion on Bramble' }));
    });
    await waitFor(() => expect(useSessionStore.getState().inventory?.items['potion']).toBe(2));
    expect(calls).toEqual([{ path: '/item/use', method: 'POST', body: { item: 'potion', target: HURT.id, qty: 1 } }]);
    expect(useSessionStore.getState().inventory?.party.find((c) => c.id === HURT.id)?.hp).toBe(25);
    expect(useNotificationsStore.getState().toasts.some((t) => t.text === 'Used Potion on Bramble.')).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Use a field item (Repel) posts at once with no target; the row leaves the bag', async () => {
    mount('/play/bag');
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    await act(async () => {
      fireEvent.click(await within(panel).findByRole('button', { name: 'Use Repel' }));
    });
    await waitFor(() => expect(useSessionStore.getState().inventory?.items['repel']).toBeUndefined());
    expect(calls).toEqual([{ path: '/item/use', method: 'POST', body: { item: 'repel', target: null, qty: 1 } }]);
    expect(useNotificationsStore.getState().toasts.some((t) => t.text === 'Used Repel.')).toBe(true);
    await waitFor(() => expect(within(screen.getByTestId('panel')).queryByRole('listitem', { name: /Repel/ })).toBeNull());
  });

  it('Give a held item: POST /creature/:id/setup with the current ability; the creature holds it', async () => {
    mount('/play/bag');
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Give Oran Berry' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Holds nothing')).toBeTruthy();
    expect(within(dialog).getByText('Holds Charcoal')).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Give Oran Berry to Bramble' }));
    });
    await waitFor(() => expect(useSessionStore.getState().inventory?.party.find((c) => c.id === HURT.id)?.heldItem).toBe('Oran Berry'));
    expect(calls).toEqual([{ path: `/creature/${HURT.id}/setup`, method: 'POST', body: { ability: HURT.ability, heldItem: 'Oran Berry' } }]);
    expect(useSessionStore.getState().inventory?.items['Oran Berry']).toBe(1);
    expect(useNotificationsStore.getState().toasts.some((t) => t.text === 'Oran Berry given to Bramble.')).toBe(true);
  });
});

describe('the B key', () => {
  it('opens the Bag (not the Party) and closes it again; the hint bar says Bag', async () => {
    const router = mount('/play');
    await screen.findByTestId('playshell', {}, { timeout: 15000 });
    const hint = screen.getByRole('complementary', { name: 'Shortcuts' });
    expect(within(hint).getByText('Bag')).toBeTruthy();
    expect(within(hint).queryByText('Items')).toBeNull();
    fireEvent.keyDown(window, { code: 'KeyB', key: 'b' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/play/bag'));
    await screen.findByRole('region', { name: 'Consumables' }, { timeout: 15000 });
    fireEvent.keyDown(window, { code: 'KeyB', key: 'b' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/play'));
  });
});
