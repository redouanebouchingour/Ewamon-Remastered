// @vitest-environment jsdom
/**
 * Phase B3 — the quest journal (`/play/quests`): the route renders the story quests grouped by act from content +
 * the session's progression; Claim → POST /quests/claim (mocked) → the grants and `questsClaimed` land through the
 * two writers and the quest moves to the claimed list; Track drives the HUD quest hint (`questHintFor`).
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import { QUESTS } from '@ewa/content';
import { routes } from '../src/app/router';
import { NAV } from '../src/app/TopBar';
import { objectivesOf, questStatus, readyCount, trackedHint } from '../src/data/quests';
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

const Q01 = QUESTS.find((q) => q.id === 'q01_first_witness')!;
const Q02 = QUESTS.find((q) => q.id === 'q02_thin_hedgerow')!;

const ME_QUESTS = [
  {
    id: Q01.id,
    progress: [
      { questId: Q01.id, objectiveId: 'reach_mire', count: 1, done: true },
      { questId: Q01.id, objectiveId: 'witness_3', count: 3, done: true },
    ],
    claimed: false,
  },
];

const claims: unknown[] = [];

function respond(url: string, init?: RequestInit): Response {
  const path = url.replace(/^\/api/, '').split('?')[0]!;
  if (path === '/me') return json(meFixture({ quests: ME_QUESTS }));
  if (path === '/auth/refresh') return json({ access: makeJwt(inOneHour()), refresh: 'r2' });
  if (path === '/quests/claim' && init?.method === 'POST') {
    claims.push(JSON.parse(String(init.body)));
    return json({
      inventory: { potion: 8, spark_orb: 10, crest_orb: 3 },
      money: 3600,
      creaturesAdded: [],
      questProgress: ME_QUESTS[0]!.progress,
    });
  }
  return json({ message: 'Route not found', error: 'Not Found', statusCode: 404 }, 404);
}

function progression(over: Partial<Progression> = {}): Progression {
  return {
    badges: [], trainerExp: 0, trainerLevel: 1, rating: 1000, dexSeen: [], dexCaught: [], dexVariants: {}, dexAlpha: [], flags: [],
    quests: {}, questsClaimed: [], missions: [],
    ...over,
  };
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

describe('quest model', () => {
  it('status: active without progress, ready when every objective is done, locked behind requires, claimed', () => {
    expect(questStatus(Q01, progression())).toBe('active');
    expect(questStatus(Q02, progression())).toBe('locked');
    const p = progression({ quests: { [Q01.id]: { reach_mire: { count: 1, done: true }, witness_3: { count: 3, done: true } } } });
    expect(questStatus(Q01, p)).toBe('ready');
    expect(readyCount(p)).toBe(1);
    const c = progression({ questsClaimed: [Q01.id] });
    expect(questStatus(Q01, c)).toBe('claimed');
    expect(questStatus(Q02, c)).toBe('active');
    expect(objectivesOf(Q01, progression({ quests: { [Q01.id]: { witness_3: { count: 2, done: false } } } })).map((o) => `${o.id} ${o.count}/${o.target}`)).toEqual(['reach_mire 0/1', 'witness_3 2/3']);
  });

  it('hint: the tracked quest first undone objective (with a count), then claim, else the default hint', () => {
    const p = progression({ quests: { [Q01.id]: { reach_mire: { count: 1, done: true }, witness_3: { count: 1, done: false } } } });
    expect(trackedHint(Q01, p)).toBe('Witness 3 species (1/3)');
    expect(questHintFor(p, Q01.id)).toBe('Witness 3 species (1/3)');
    const ready = progression({ quests: { [Q01.id]: { reach_mire: { count: 1, done: true }, witness_3: { count: 3, done: true } } } });
    expect(questHintFor(ready, Q01.id)).toBe('Claim “First Witness” in Quests');
    // a locked / claimed / unknown tracked id falls back to the untracked hint
    expect(questHintFor(p, Q02.id)).toBe(questHintFor(p, null));
    expect(questHintFor(p, 'nope')).toBe(questHintFor(p, null));
    expect(questHintFor(null, Q01.id)).toBeNull();
  });

  it('the nav lists the journal', () => {
    expect(NAV.map((n) => n.to)).toContain('/play/quests');
  });
});

describe('/play/quests', () => {
  it('renders the journal by act; Claim posts once and moves the quest to Claimed; Track drives the hint', async () => {
    const router = createMemoryRouter(routes as RouteObject[], { initialEntries: ['/play/quests'] });
    render(<RouterProvider router={router} />);
    const panel = await screen.findByTestId('panel', {}, { timeout: 15000 });
    expect(within(panel).getByText('Quests')).toBeTruthy();
    expect(within(panel).getByRole('region', { name: 'Act I' })).toBeTruthy();
    expect(within(panel).getByText('1 ready to claim')).toBeTruthy();
    const card = within(panel).getByRole('listitem', { name: 'First Witness, ready to claim' });
    expect(within(card).getByText('Reach Mire Route')).toBeTruthy();
    expect(within(card).getByText('3 / 3')).toBeTruthy();
    // q02 waits for q01
    expect(within(panel).getByRole('listitem', { name: 'The Thin Hedgerow, locked' })).toBeTruthy();

    fireEvent.click(within(card).getByRole('button', { name: 'Claim' }));
    await waitFor(() => expect(useSessionStore.getState().progression?.questsClaimed).toContain(Q01.id));
    expect(claims).toEqual([{ questId: Q01.id }]);
    expect(useSessionStore.getState().inventory?.money).toBe(3600);
    expect(useSessionStore.getState().inventory?.items['crest_orb']).toBe(3);
    const claimedList = await within(panel).findByRole('region', { name: 'Claimed' });
    expect(within(claimedList).getByText('First Witness')).toBeTruthy();
    expect(useNotificationsStore.getState().toasts.some((t) => t.text === 'First Witness complete. Rewards claimed.')).toBe(true);

    // q02 is now open: track it and the hint follows its first objective
    const q02 = await within(panel).findByRole('listitem', { name: 'The Thin Hedgerow, in progress' });
    await act(async () => {
      fireEvent.click(within(q02).getByRole('button', { name: 'Track The Thin Hedgerow' }));
    });
    expect(useQuestTracking.getState().tracked).toBe(Q02.id);
    expect(within(q02).getByRole('button', { name: 'Untrack The Thin Hedgerow' }).getAttribute('aria-pressed')).toBe('true');
    expect(questHintFor(useSessionStore.getState().progression, useQuestTracking.getState().tracked)).toBe('Witness a seedrift (day)');
  });
});
