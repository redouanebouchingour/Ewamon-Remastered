// @vitest-environment jsdom
/**
 * Phase D4 + D5 on the client: the Dex shiny marker and `?state=shiny` filter (GET /dex `shiny` → the session's
 * `dexShiny`), the shiny sparkle in the battle timeline, and the quest journal's Achievements tab (ready → Claim →
 * POST /quests/claim, the rest as progress rows) with the achievement model helpers.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import { createContentIndex } from '@ewa/content';
import type { Ref } from '@ewa/core';
import { routes } from '../src/app/router';
import { createMoveAnimRegistry } from '../src/battle/moveAnims';
import { buildTimeline } from '../src/battle/timeline';
import { achievementProgress, achievementQuests, objectiveTarget, questById, storyQuests } from '../src/data/quests';
import { __resetApiForTests, storeTokens } from '../src/net/api';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession } from '../src/net/WorldSession';
import { questHintFor } from '../src/scene/questHint';
import { setWorldCapabilityOverride } from '../src/scene/worldHost';
import { useNotificationsStore } from '../src/state/notifications';
import { useQuestTracking } from '../src/state/questTracking';
import { useSessionStore } from '../src/state/session';
import type { Progression } from '../src/state/session';
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

const CONTENT = createContentIndex();
const name = (id: string) => CONTENT.species(id);

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

const ME_QUESTS = [
  { id: 'ach_trade_1', progress: [{ questId: 'ach_trade_1', objectiveId: 'trade', count: 1, done: true }], claimed: false },
  { id: 'ach_dex_30', progress: [{ questId: 'ach_dex_30', objectiveId: 'dex', count: 12, done: false }], claimed: false },
];
const claims: unknown[] = [];

function respond(url: string, init?: RequestInit): Response {
  const path = url.replace(/^\/api/, '').split('?')[0]!;
  if (path === '/me') return json(meFixture({ quests: ME_QUESTS }));
  if (path === '/auth/refresh') return json({ access: makeJwt(inOneHour()), refresh: 'r2' });
  if (path === '/dex') return json({ seen: ['glimfin', 'mossling', 'bramblecub'], caught: ['glimfin', 'mossling', 'bramblecub'], variants: {}, alpha: ['glimfin'], shiny: ['mossling', 'glimfin'] });
  if (path === '/quests/claim' && init?.method === 'POST') {
    claims.push(JSON.parse(String(init.body)));
    return json({ inventory: { potion: 8, spark_orb: 10 }, money: 3500, creaturesAdded: [], questProgress: ME_QUESTS[0]!.progress });
  }
  return json({ message: 'Route not found', error: 'Not Found', statusCode: 404 }, 404);
}

beforeEach(() => {
  claims.length = 0;
  localStorage.clear();
  __resetApiForTests();
  useSessionStore.getState().clearSession();
  useNotificationsStore.getState().clear();
  useQuestTracking.getState().setTracked(null);
  setWorldCapabilityOverride(false);
  __setWorldSessionForTests(fakeWorld);
  storeTokens(makeJwt(inOneHour()), 'refresh-1');
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => respond(url, init)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function progression(over: Partial<Progression> = {}): Progression {
  return { badges: [], trainerExp: 0, trainerLevel: 1, rating: 1000, dexSeen: [], dexCaught: [], dexVariants: {}, dexAlpha: [], flags: [], quests: {}, questsClaimed: [], missions: [], ...over };
}

describe('Phase D5 achievement model', () => {
  it('31 achievements apart from the 15 story quests; targets and one progress figure each', () => {
    expect(achievementQuests()).toHaveLength(31);
    expect(storyQuests()).toHaveLength(15);
    expect(objectiveTarget({ kind: 'dexCaught', count: 60 })).toBe(60);
    expect(objectiveTarget({ kind: 'loginStreak', days: 30 })).toBe(30);
    expect(objectiveTarget({ kind: 'clearRaids', count: 10 })).toBe(10);
    const dex30 = questById('ach_dex_30')!;
    expect(achievementProgress(dex30, progression({ quests: { ach_dex_30: { dex: { count: 12, done: false } } } }))).toEqual({ value: 12, target: 30 });
    const badges = questById('ach_badges_8')!;
    expect(achievementProgress(badges, progression({ quests: { ach_badges_8: { bloom: { count: 1, done: true }, ember: { count: 1, done: true } } } }))).toEqual({ value: 2, target: 8 });
  });

  it('achievements never drive the untracked HUD hint', () => {
    const p = progression({ quests: { ach_dex_30: { dex: { count: 12, done: false } } }, questsClaimed: [] });
    expect(questHintFor(p, null)).not.toBe('Record 30 species');
    // tracked explicitly, it does
    expect(questHintFor(p, 'ach_dex_30')).toBe('Record 30 species (12/30)');
  });
});

describe('Phase D4 shiny sparkle in the battle timeline', () => {
  it("a shiny's switch-in adds the shiny_sparkle burst and a line; a plain one does not", () => {
    const ctx = (shiny: boolean) => ({ content: CONTENT, registry: createMoveAnimRegistry(), reduced: false, speciesOf: () => 'mossling', shinyOf: (_r: Ref) => shiny });
    const ev = [{ t: 'switchIn' as const, who: { side: 1 as const, slot: 0 } }];
    const shiny = buildTimeline(ev, ctx(true)).frames;
    expect(shiny.some((f) => f.k === 'vfx' && f.id === 'shiny_sparkle')).toBe(true);
    expect(shiny.some((f) => f.k === 'log' && f.text.includes('a shiny'))).toBe(true);
    expect(buildTimeline(ev, ctx(false)).frames.some((f) => f.k === 'vfx' && f.id === 'shiny_sparkle')).toBe(false);
  });
});

describe('/play/dex shiny marker + filter (Phase D4)', () => {
  it('marks shiny catches and ?state=shiny lists only them', async () => {
    const router = createMemoryRouter(routes as RouteObject[], { initialEntries: ['/play/dex'] });
    render(<RouterProvider router={router} />);
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    await waitFor(() => expect(useSessionStore.getState().progression?.dexShiny).toEqual(['mossling', 'glimfin']));
    const moss = name('mossling');
    const entry = await within(panel).findByRole('button', { name: `${moss.name}, recorded` });
    expect(within(entry).getByRole('img', { name: 'Shiny recorded' })).toBeTruthy();
    const bramble = within(panel).getByRole('button', { name: `${name('bramblecub').name}, recorded` });
    expect(within(bramble).queryByRole('img', { name: 'Shiny recorded' })).toBeNull();
    fireEvent.click(within(panel).getByRole('radio', { name: 'Shiny' }));
    await waitFor(() => expect(router.state.location.search).toBe('?state=shiny'));
    await waitFor(() => expect(within(screen.getByTestId('panel')).queryByRole('button', { name: /Bramblecub|bramblecub/ })).toBeNull());
    const names = within(screen.getByTestId('panel')).getAllByRole('button', { name: /, recorded$/ }).map((b) => b.getAttribute('aria-label'));
    expect(names.sort()).toEqual([`${name('glimfin').name}, recorded`, `${moss.name}, recorded`].sort());
  });
});

describe('/play/quests?tab=achievements (Phase D5)', () => {
  it('lists ready achievements with Claim (POST /quests/claim) and the rest as progress rows', async () => {
    const router = createMemoryRouter(routes as RouteObject[], { initialEntries: ['/play/quests'] });
    render(<RouterProvider router={router} />);
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    // the story tab holds no achievement
    expect(within(panel).queryByText('Fair Exchange')).toBeNull();
    fireEvent.click(within(panel).getByRole('tab', { name: /Achievements/ }));
    await waitFor(() => expect(router.state.location.search).toBe('?tab=achievements'));
    const ready = await within(screen.getByTestId('panel')).findByRole('region', { name: 'Ready to claim' });
    const card = within(ready).getByRole('listitem', { name: 'Fair Exchange, ready to claim' });
    const progress = within(screen.getByTestId('panel')).getByRole('region', { name: 'In progress' });
    expect(within(progress).getByRole('listitem', { name: 'A Field Notebook, 12 of 30' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Claim' }));
    await waitFor(() => expect(useSessionStore.getState().progression?.questsClaimed).toContain('ach_trade_1'));
    expect(claims).toEqual([{ questId: 'ach_trade_1' }]);
    const earned = await within(screen.getByTestId('panel')).findByRole('region', { name: 'Earned' });
    expect(within(earned).getByText('Fair Exchange')).toBeTruthy();
  });
});
