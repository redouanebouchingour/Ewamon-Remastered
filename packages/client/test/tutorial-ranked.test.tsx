// @vitest-environment jsdom
/**
 * Phase D12 — Prof. Wynn's tutorial: steps advance on real events (walked metres from the authoritative avatar,
 * `met_wynn`, the party panel, a wild battle, a catch, a win, a heal), the card hides under battles / panels, "Skip
 * tutorial" persists per account, and an account already past the opening (a badge) never sees it.
 * Phase D13 — the ranked panel: Find a match / Leave queue send `rankedQueue`, `rankedStatus` drives the panel (elapsed
 * time, the widening window, the opponent) and toasts; a fainted party cannot queue; the store resets when the world
 * connection ends.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { ServerMessageOf, ZoneId } from '@ewa/protocol';
import { installMessageRouter, routeServerMessage } from '../src/net/messageRouter';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession, ZoneRoom } from '../src/net/WorldSession';
import { useNotificationsStore } from '../src/state/notifications';
import { MATCHED_STALE_MS, formatElapsed, shownRankedState, useRankedStore } from '../src/state/ranked';
import { applyProgressionDelta, toProgressionDelta, useSessionStore } from '../src/state/session';
import { MoveMeter, TUTORIAL_STEPS, accountOf, currentStep, derivedEvents, noteTutorialEvent, pastOpening, useTutorialStore } from '../src/state/tutorial';
import { useUiStore } from '../src/state/ui';
import type { BattleUi } from '../src/state/ui';
import { RankedPanel } from '../src/screens/RankedPanel';
import { TutorialCard, keyGlyph } from '../src/world/TutorialCard';
import { PLAYER_ID, creature, meFixture } from './fixtures';

beforeAll(() => {
  // jsdom's Request rejects the router's AbortSignal (same patch as the other router tests)
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

// ---- a fake world: one avatar whose position the test moves, state listeners it fires ---------------------------

const sent: { type: string; payload: unknown }[] = [];
const stateListeners = new Set<() => void>();
const roomListeners = new Set<(room: ZoneRoom | null, zoneId: ZoneId | null) => void>();
const me = { x: 0, z: 6 };
const fakeRoom = { state: { players: { get: (id: string) => (id === PLAYER_ID ? me : undefined) } } } as unknown as ZoneRoom;
const fakeWorld: WorldSession = {
  room: fakeRoom,
  selfId: PLAYER_ID,
  zoneId: 'mirevale',
  enter: vi.fn(async () => undefined),
  send: vi.fn((type: string, payload: unknown) => void sent.push({ type, payload })) as WorldSession['send'],
  onMessage: () => () => undefined,
  handover: async () => undefined,
  leave: vi.fn(async () => undefined),
  onRoom: (cb) => {
    roomListeners.add(cb);
    return () => roomListeners.delete(cb);
  },
  onReconnected: () => () => undefined,
  // arena PvP seams (unused here)
  arenaRoom: null,
  kind: 'zone',
  homeZone: null,
  enterArena: async () => undefined,
  returnToWorld: async () => undefined,
  onArena: () => () => undefined,
  subscribeState: (cb) => {
    stateListeners.add(cb);
    return () => stateListeners.delete(cb);
  },
};

function walkTo(x: number, z: number): void {
  act(() => {
    me.x = x;
    me.z = z;
    for (const l of stateListeners) l();
  });
}

function renderAt(element: React.ReactElement, path = '/play') {
  const router = createMemoryRouter(
    [
      { path: '/play', element },
      { path: '/play/party', element },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function battle(over: Partial<BattleUi>): BattleUi {
  return { battleId: 'b1', format: 'wild', seat: 0, phase: 'selecting', menu: 'root', turnLabel: '', log: [], desyncs: 0, result: null, expectedMs: 0, ...over } as unknown as BattleUi;
}

const toasts = (): string[] => useNotificationsStore.getState().toasts.map((t) => t.text);

beforeEach(() => {
  localStorage.clear();
  sent.length = 0;
  me.x = 0;
  me.z = 6;
  __setWorldSessionForTests(fakeWorld);
  useSessionStore.getState().hydrateFromMe(meFixture());
  useTutorialStore.setState({ accounts: {} });
  useRankedStore.getState().reset();
  useUiStore.getState().reset();
  useNotificationsStore.getState().clear();
});
afterEach(() => {
  cleanup();
  __setWorldSessionForTests(null);
  useSessionStore.getState().clearSession();
});

describe('Phase D12 tutorial (pure)', () => {
  it('the current step is the first whose event has not happened; latched events skip ahead', () => {
    expect(currentStep([])?.id).toBe('move');
    expect(currentStep(['moved'])?.id).toBe('wynn');
    expect(currentStep(['moved', 'won', 'metWynn'])?.id).toBe('party');
    expect(currentStep(TUTORIAL_STEPS.map((s) => s.event))).toBeNull();
  });

  it('past the opening: any badge or a flag of a later beat; the opening flags are not', () => {
    expect(pastOpening({ badges: ['bloom'], flags: [] })).toBe(true);
    expect(pastOpening({ badges: [], flags: ['badge:bloom'] })).toBe(true);
    expect(pastOpening({ badges: [], flags: ['met_wynn', 'met_sable'] })).toBe(false);
    expect(pastOpening({ badges: [], flags: [] })).toBe(false);
  });

  it('derived events: met_wynn, and a second dex entry as the first catch', () => {
    expect(derivedEvents({ flags: ['met_wynn'], dexCaught: ['bramblecub'] })).toEqual(['metWynn']);
    expect(derivedEvents({ flags: [], dexCaught: ['bramblecub', 'mossling'] })).toEqual(['caught']);
  });

  it('MoveMeter sums walking and skips a teleport-sized jump and room changes', () => {
    const m = new MoveMeter();
    m.feed(0, 0);
    m.feed(3, 4); // 5
    m.feed(50, 4); // a jump: ignored
    expect(m.feed(50, 7)).toBe(8);
    m.reset();
    expect(m.feed(0, 0)).toBe(8);
  });

  it('key glyphs from KeyboardEvent codes', () => {
    expect(['KeyW', 'Digit1', 'ShiftLeft', 'ArrowUp', 'Escape'].map(keyGlyph)).toEqual(['W', '1', 'Shift', '↑', 'Esc']);
  });
});

describe('Phase D12 tutorial card', () => {
  it('advances on real events: walk, met_wynn, party panel, wild battle, catch (+ win), heal — then never again', () => {
    const router = renderAt(<TutorialCard />);
    expect(screen.getByRole('heading', { name: 'Find your feet' })).toBeTruthy();
    expect(screen.getByText('1 of 7')).toBeTruthy();
    // the movement glyphs come from the player's bindings
    expect(screen.getAllByText('W').length).toBeGreaterThan(0);
    expect(screen.getByText('Shift')).toBeTruthy();

    walkTo(0, 9);
    expect(screen.queryByRole('heading', { name: 'Come and find me' })).toBeNull(); // 3 m is not enough
    walkTo(0, 12);
    walkTo(2, 14); // ≥ 8 m in total
    expect(screen.getByRole('heading', { name: 'Come and find me' })).toBeTruthy();

    act(() => applyProgressionDelta(toProgressionDelta({ flags: ['met_wynn'] })));
    expect(screen.getByRole('heading', { name: 'Look at your partner' })).toBeTruthy();

    // the party panel completes the step; the card stays out of the way while a panel is open
    act(() => void router.navigate('/play/party'));
    expect(screen.queryByRole('complementary', { name: 'Tutorial' })).toBeNull();
    act(() => void router.navigate('/play'));
    expect(screen.getByRole('heading', { name: 'Mire Route' })).toBeTruthy();

    // a wild battle: the card hides under it; the catch also counts as the first win
    act(() => useUiStore.getState().setBattle(battle({})));
    expect(screen.queryByRole('complementary', { name: 'Tutorial' })).toBeNull();
    act(() => useUiStore.getState().setBattle(battle({ result: { outcome: { winner: 'caught', slot: 0 }, rewards: { money: 0, items: {}, trainerExp: 10, ratingDelta: null, badge: null }, prompts: 0 } })));
    act(() => useUiStore.getState().setBattle(null));
    expect(screen.getByRole('heading', { name: 'Rest them' })).toBeTruthy();
    expect(accountOf(useTutorialStore.getState(), PLAYER_ID).seen).toEqual(['moved', 'metWynn', 'openedParty', 'wildBattle', 'caught', 'won']);

    act(() => noteTutorialEvent('healed'));
    expect(screen.queryByRole('complementary', { name: 'Tutorial' })).toBeNull();
    expect(accountOf(useTutorialStore.getState(), PLAYER_ID).done).toBe(true);
    expect(toasts().some((t) => t.startsWith('Prof. Wynn'))).toBe(true);
    expect(localStorage.getItem('ewa.tutorial')).toContain('"done":true');
  });

  it('"Skip tutorial" ends it for this account and the choice persists', async () => {
    renderAt(<TutorialCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(screen.queryByRole('complementary', { name: 'Tutorial' })).toBeNull();
    expect(JSON.parse(localStorage.getItem('ewa.tutorial')!).state.accounts[PLAYER_ID]).toMatchObject({ done: true });
    cleanup();
    // a fresh load reads the persisted choice back
    const saved = localStorage.getItem('ewa.tutorial')!;
    useTutorialStore.setState({ accounts: {} });
    localStorage.setItem('ewa.tutorial', saved);
    await act(async () => {
      await useTutorialStore.persist.rehydrate();
    });
    renderAt(<TutorialCard />);
    expect(screen.queryByRole('complementary', { name: 'Tutorial' })).toBeNull();
    // the skip ended it without the closing line
    expect(toasts().some((t) => t.startsWith('Prof. Wynn'))).toBe(false);
  });

  it('never shows for an account that already holds a badge (and remembers it as done)', () => {
    useSessionStore.getState().hydrateFromMe(meFixture({ badges: ['bloom'], flags: ['met_wynn', 'badge:bloom'] }));
    renderAt(<TutorialCard />);
    expect(screen.queryByRole('complementary', { name: 'Tutorial' })).toBeNull();
    expect(accountOf(useTutorialStore.getState(), PLAYER_ID).done).toBe(true);
  });

  it('progress is per account', () => {
    useTutorialStore.getState().finish('someone-else');
    renderAt(<TutorialCard />);
    expect(screen.getByRole('heading', { name: 'Find your feet' })).toBeTruthy();
  });
});

describe('Phase D13 ranked panel', () => {
  const status = (over: Partial<ServerMessageOf<'rankedStatus'>>): ServerMessageOf<'rankedStatus'> => ({
    type: 'rankedStatus',
    state: 'idle',
    rating: 1000,
    waitedMs: 0,
    window: 0,
    opponent: null,
    reason: null,
    ...over,
  });

  it('Find a match → rankedQueue join; queued shows the elapsed time and the window; Leave queue → leave', () => {
    render(<RankedPanel />);
    expect(screen.getByText('1000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Find a match/ }));
    expect(sent).toEqual([{ type: 'rankedQueue', payload: { action: 'join' } }]);

    act(() => routeServerMessage(status({ state: 'queued', waitedMs: 21_000, window: 200 }), fakeWorld));
    expect(screen.getByTestId('ranked-elapsed').textContent).toBe('0:21');
    expect(screen.getByText('±200')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave queue' }));
    expect(sent.at(-1)).toEqual({ type: 'rankedQueue', payload: { action: 'leave' } });

    act(() => routeServerMessage(status({ reason: 'left' }), fakeWorld));
    expect(screen.getByRole('button', { name: /Find a match/ })).toBeTruthy();
  });

  it('match found: the opponent and a toast; cancelled and refusals toast; started is silent', () => {
    render(<RankedPanel />);
    act(() => routeServerMessage(status({ state: 'matched', opponent: { name: 'ace_rival', rating: 1040 } }), fakeWorld));
    expect(screen.getByText('ace_rival')).toBeTruthy();
    expect(toasts().at(-1)).toContain('Match found: ace_rival (1040)');
    act(() => routeServerMessage(status({ reason: 'cancelled' }), fakeWorld));
    expect(toasts().at(-1)).toContain('fell through');
    act(() => routeServerMessage(status({ reason: 'party' }), fakeWorld));
    expect(toasts().at(-1)).toContain('needs healing');
    const n = toasts().length;
    act(() => routeServerMessage(status({ reason: 'started' }), fakeWorld));
    expect(toasts()).toHaveLength(n);
  });

  it('a fainted party cannot queue', () => {
    useSessionStore.getState().hydrateFromMe(meFixture({ party: [creature('bramblecub', { hp: 0 })] }));
    render(<RankedPanel />);
    expect((screen.getByRole('button', { name: /Find a match/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Heal your party to queue.')).toBeTruthy();
  });

  it('a stale match reads as idle; the store resets when the world connection ends', () => {
    expect(shownRankedState({ state: 'matched', matchedAt: 0 }, MATCHED_STALE_MS + 1)).toBe('idle');
    expect(shownRankedState({ state: 'matched', matchedAt: 0 }, 1000)).toBe('matched');
    expect(formatElapsed(65_400)).toBe('1:05');
    const off = installMessageRouter(fakeWorld);
    useRankedStore.getState().apply(status({ state: 'queued', waitedMs: 0 }));
    for (const l of roomListeners) l(null, null);
    expect(useRankedStore.getState().state).toBe('idle');
    off();
  });
});
