// @vitest-environment jsdom
/**
 * Arena PvP on the client (IMPLEMENTATION-NOTES "Arena PvP"):
 * - the session's zone → arena → zone switch over a stubbed SDK: the zone room is retired (consented, never an
 *   offline / kicked state), the arena seat consumed and wired, only battle messages sent there, the return enters the
 *   zone the player left; a 409 `inArena` on `/zone/enter` rejoins the arena; `enter()` keeps a player in the arena;
 *   an arena room closing under the player is reported as `closed`;
 * - the arena store / flow: a matched status moves the player (seat → enterArena, "Match found"), queue refusals toast,
 *   a cancelled arena sends them back, battleEnd records the outcome;
 * - the PvP screen: the modes, the cup's lock reason (content `cupRefusal`), queue / leave, training straight into the
 *   arena, one queue at a time, an empty party; the invite modal (accept → arena, auto-decline); the routes.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { Client } from '@colyseus/sdk';
import type { ArenaStatus, SeatReservation, ServerMessageOf } from '@ewa/protocol';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { ApiFailure, apiFetch } from '../src/net/api';
import { CANCEL_RETURN_MS, dailyShareText, routeArenaMessage } from '../src/app/arena';
import { foeIdentity } from '../src/battle/foe';
import type { ArenaSession } from '../src/app/arena';
import { routes } from '../src/app/router';
import { createWorldSession, __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession } from '../src/net/WorldSession';
import { IDLE_STATUS, arenaBlockReason, arenaStatusText, cupLockReason, timeLeft, useArenaStore } from '../src/state/arena';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { useSettingsStore } from '../src/state/settings';
import { useUiStore } from '../src/state/ui';
import { PvpScreen } from '../src/screens/PvpScreen';
import { ArenaHud, ArenaInvitePrompt } from '../src/world/ArenaOverlays';
import { PLAYER_ID, creature, meFixture } from './fixtures';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const toasts = (): string[] => useNotificationsStore.getState().toasts.map((t) => t.text);

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

// ---- a stubbed SDK -------------------------------------------------------------------------------------------------

class FakeRoom {
  readonly handlers = new Map<string, (p: unknown) => void>();
  readonly leaveCbs: ((code: number) => void)[] = [];
  readonly sent: { type: string; payload: unknown }[] = [];
  left = false;
  readonly reconnection = { enabled: false, retryCount: 0 } as Record<string, unknown>;
  readonly connection = { isOpen: true };
  readonly state = { players: new Map() };
  readonly onStateChange = Object.assign((_cb: () => void) => undefined, { remove: (_cb: () => void) => undefined, once: (cb: () => void) => cb() });
  constructor(readonly roomId: string) {}
  onMessage(type: string, cb: (p: unknown) => void): () => void {
    this.handlers.set(type, cb);
    return () => this.handlers.delete(type);
  }
  onDrop(): void {}
  onReconnect(): void {}
  onLeave(cb: (code: number) => void): void {
    this.leaveCbs.push(cb);
  }
  async leave(): Promise<void> {
    this.left = true;
    this.connection.isOpen = false;
    for (const cb of this.leaveCbs) cb(4000);
  }
  /** the server closes it (not a consented leave) */
  close(code: number): void {
    this.connection.isOpen = false;
    for (const cb of this.leaveCbs) cb(code);
  }
  send(type: string, payload: unknown): void {
    this.sent.push({ type, payload });
  }
}

const seat = (roomId: string, name = 'zone'): SeatReservation => ({ name, sessionId: `s-${roomId}`, roomId });

function harness() {
  const rooms = new Map<string, FakeRoom>();
  const client = {
    auth: { token: '' },
    consumeSeatReservation: vi.fn(async (s: SeatReservation) => {
      const r = new FakeRoom(s.roomId);
      rooms.set(s.roomId, r);
      return r;
    }),
  };
  let zoneSeat = 0;
  const fetchSeat = vi.fn(async (_z: string) => seat(`zone-${++zoneSeat}`));
  const rejoinArena = vi.fn(async (): Promise<SeatReservation> => seat('arena-rejoined', 'arena'));
  const ws = createWorldSession({
    wsUrl: 'ws://test',
    createClient: () => client as unknown as Client,
    fetchSeat: fetchSeat as never,
    rejoinArena,
    refetchMe: async () => undefined,
    accessToken: () => 'token',
    selfId: () => PLAYER_ID,
    dev: true,
  });
  const roomEvents: string[] = [];
  const arenaEvents: string[] = [];
  ws.onRoom((r, z) => roomEvents.push(r === null ? 'null' : `${(r as unknown as FakeRoom).roomId}@${z}`));
  ws.onArena((r, inArena, closed) => arenaEvents.push(`${r === null ? 'null' : (r as unknown as FakeRoom).roomId}:${inArena}${closed ? ':closed' : ''}`));
  return { ws, rooms, client, fetchSeat, rejoinArena, roomEvents, arenaEvents };
}

beforeEach(() => {
  localStorage.clear();
  api.mockReset();
  useSessionStore.getState().hydrateFromMe(meFixture());
  useUiStore.getState().reset();
  useArenaStore.getState().reset();
  useNotificationsStore.getState().clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __setWorldSessionForTests(null);
  useSessionStore.getState().clearSession();
});

describe('WorldSession: zone → arena → zone', () => {
  it('retires the zone room, adopts the arena, sends only battle messages there, and returns to the zone it left', async () => {
    const h = harness();
    const connections: string[] = [];
    const off = useUiStore.subscribe((s) => connections.push(s.connection));
    await h.ws.enter('mirevale');
    expect(h.ws.kind).toBe('zone');
    expect(h.roomEvents).toEqual(['zone-1@mirevale']);
    const zone = h.rooms.get('zone-1')!;

    await h.ws.enterArena(seat('arena-1', 'arena'));
    expect(zone.left).toBe(true);
    expect(h.ws.kind).toBe('arena');
    expect(h.ws.room).toBeNull();
    expect(h.ws.zoneId).toBeNull();
    expect((h.ws.arenaRoom as unknown as FakeRoom).roomId).toBe('arena-1');
    expect(h.ws.homeZone).toBe('mirevale');
    expect(h.roomEvents).toEqual(['zone-1@mirevale', 'null']);
    expect(h.arenaEvents).toEqual(['arena-1:true']);

    const arena = h.rooms.get('arena-1')!;
    h.ws.send('chat', { text: 'hi' });
    h.ws.send('battleResync', { battleId: '33333333-3333-4333-8333-333333333333' });
    expect(arena.sent.map((m) => m.type)).toEqual(['battleResync']);
    // the arena's messages reach the dispatcher like a zone room's
    const got: string[] = [];
    h.ws.onMessage((m) => got.push(m.type));
    arena.handlers.get('toast')!({ type: 'toast', level: 'info', text: 'hello' });
    expect(got).toEqual(['toast']);
    // the shell's enter() (a remount) keeps the player in the arena
    await h.ws.enter('mirevale');
    expect(h.ws.kind).toBe('arena');
    expect(h.fetchSeat).toHaveBeenCalledTimes(1);

    await h.ws.returnToWorld();
    expect(arena.left).toBe(true);
    expect(h.ws.kind).toBe('zone');
    expect(h.fetchSeat).toHaveBeenLastCalledWith('mirevale');
    expect(h.roomEvents.at(-1)).toBe('zone-2@mirevale');
    expect(h.arenaEvents).toEqual(['arena-1:true', 'null:true', 'null:false']);
    off();
    expect(connections).not.toContain('offline');
    expect(connections).not.toContain('reconnecting');
  });

  it('hops from one arena to the next (Queue again) without touching the world', async () => {
    const h = harness();
    await h.ws.enter('mirevale');
    await h.ws.enterArena(seat('arena-1', 'arena'));
    await h.ws.enterArena(seat('arena-2', 'arena'));
    expect(h.rooms.get('arena-1')!.left).toBe(true);
    expect((h.ws.arenaRoom as unknown as FakeRoom).roomId).toBe('arena-2');
    expect(h.ws.homeZone).toBe('mirevale');
    expect(h.fetchSeat).toHaveBeenCalledTimes(1);
    await h.ws.returnToWorld();
    expect(h.fetchSeat).toHaveBeenLastCalledWith('mirevale');
  });

  it('a 409 inArena on /zone/enter rejoins the arena (a reload mid arena battle)', async () => {
    const h = harness();
    h.fetchSeat.mockRejectedValueOnce(new ApiFailure({ status: 409, code: 'inArena', detail: null, extra: { roomId: 'arena-x' } }));
    await h.ws.enter('ashgate');
    expect(h.rejoinArena).toHaveBeenCalledTimes(1);
    expect(h.ws.kind).toBe('arena');
    expect((h.ws.arenaRoom as unknown as FakeRoom).roomId).toBe('arena-rejoined');
    expect(h.ws.homeZone).toBe('ashgate');
    expect(useUiStore.getState().connection).toBe('connected');
  });

  it('an arena room closing under the player is reported as closed (no offline overlay)', async () => {
    const h = harness();
    await h.ws.enter('mirevale');
    await h.ws.enterArena(seat('arena-1', 'arena'));
    h.rooms.get('arena-1')!.close(1006);
    expect(h.arenaEvents.at(-1)).toBe('null:true:closed');
    expect(h.ws.kind).toBe('arena');
    expect(useUiStore.getState().connection).toBe('connected');
  });
});

// ---- the flow ------------------------------------------------------------------------------------------------------

function fakeSession(): ArenaSession & { enterArena: ReturnType<typeof vi.fn>; returnToWorld: ReturnType<typeof vi.fn> } {
  return { kind: 'zone', selfId: PLAYER_ID, enterArena: vi.fn(async () => undefined), returnToWorld: vi.fn(async () => undefined) };
}
const status = (over: Partial<ArenaStatus>): ServerMessageOf<'arenaStatus'> => ({ type: 'arenaStatus', ...IDLE_STATUS, ...over });

describe('arena flow', () => {
  it('a matched status moves the player into the arena with a Match found card', () => {
    const ws = fakeSession();
    const s = seat('arena-9', 'arena');
    routeArenaMessage(status({ state: 'queued', kind: 'level50', waitedMs: 4000 }), ws);
    expect(useArenaStore.getState().status.state).toBe('queued');
    expect(Date.now() - useArenaStore.getState().queuedAt).toBeGreaterThanOrEqual(4000);
    routeArenaMessage(status({ state: 'matched', kind: 'level50', opponent: { name: 'rival', rating: 1100 }, seat: s }), ws);
    expect(ws.enterArena).toHaveBeenCalledWith(s);
    expect(useArenaStore.getState().matchFound?.opponent?.name).toBe('rival');
    expect(useArenaStore.getState().status.seat).toBeNull();
  });

  it('queue refusals toast with the server detail; started / left are silent', () => {
    const ws = fakeSession();
    routeArenaMessage(status({ reason: 'cup', detail: 'The Fire type appears more than once in your party.' }), ws);
    routeArenaMessage(status({ reason: 'started' }), ws);
    expect(toasts()).toEqual(['The Fire type appears more than once in your party.']);
    expect(arenaStatusText({ ...IDLE_STATUS, reason: 'left' })).toBeNull();
  });

  it('a cancelled arena toasts and goes back to the world; battleEnd records the outcome', () => {
    vi.useFakeTimers();
    const ws = { ...fakeSession(), kind: 'arena' as const };
    useArenaStore.getState().setInArena(true);
    const base = { type: 'arenaState' as const, matchId: 'm1', kind: 'ranked' as const, level: 50, players: [{ playerId: PLAYER_ID, name: 'qa_tester', rating: 1000 }], foeName: null, cup: null, reason: null };
    routeArenaMessage({ ...base, phase: 'waiting' }, ws);
    routeArenaMessage({ ...base, phase: 'cancelled', reason: 'noShow' }, ws);
    expect(toasts()).toEqual(['Your opponent never arrived. Back to the world.']);
    vi.advanceTimersByTime(CANCEL_RETURN_MS + 10);
    expect(ws.returnToWorld).toHaveBeenCalledTimes(1);

    routeArenaMessage({ ...base, matchId: 'm2', phase: 'fighting' }, ws);
    useUiStore.getState().setBattle({ battleId: 'b1', seat: 1 } as never);
    routeArenaMessage({ type: 'battleEnd', battleId: 'b1', outcome: { winner: 1, turns: 7 }, rewards: { money: 0, items: {}, trainerExp: 0, ratingDelta: 16, badge: null } } as never, ws);
    expect(useArenaStore.getState().outcome).toEqual({ battleId: 'b1', won: true, ratingDelta: 16 });
  });

  it('gates and copy: an empty party blocks, a fainted one does not; cup lock; time left', () => {
    const base = { inBattle: false, trading: false, inArena: false, connected: true };
    expect(arenaBlockReason({ ...base, party: [] })).toMatch(/creature/);
    expect(arenaBlockReason({ ...base, party: [creature('bramblecub', { hp: 0 })] })).toBeNull();
    expect(arenaBlockReason({ ...base, party: [creature('bramblecub')], inBattle: true })).toMatch(/battle/);
    expect(cupLockReason([creature('bramblecub')], Date.now())).toMatch(/full party of 6/);
    expect(timeLeft(new Date(Date.UTC(2026, 9, 14, 6)).toISOString(), Date.UTC(2026, 9, 11, 3))).toBe('3d 3h');
  });
});

// ---- screens -------------------------------------------------------------------------------------------------------

const INFO = {
  rating: 1234, peakRating: 1300, rankedMatches: 9, level: 50,
  cup: { id: 'cup_mirror_clause', name: 'Mirror Clause Cup', description: 'No type may appear more than once across your party of six.', endsAt: new Date(Date.now() + 3 * 86_400_000).toISOString() },
  live: null,
};

function mountPvp(friends: unknown[] = []) {
  useArenaStore.getState().setInfo(INFO, IDLE_STATUS);
  const router = createMemoryRouter([{ path: '/play/pvp', element: <PvpScreen />, loader: () => ({ available: true, friends }) }, { path: '/play', element: <ArenaHud /> }], {
    initialEntries: ['/play/pvp'],
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('/play/pvp', () => {
  it('shows every mode, the rating and the cup with its lock reason', async () => {
    mountPvp();
    const screenEl = await screen.findByTestId('pvpscreen');
    for (const m of ['standard', 'level50', 'ranked', 'cup', 'training', 'friend']) expect(within(screenEl).getByTestId(`pvp-mode-${m}`)).toBeTruthy();
    expect(screenEl.textContent).toContain('1234');
    expect(screen.getByTestId('pvp-mode-cup').textContent).toContain('Mirror Clause Cup');
    const why = cupLockReason(useSessionStore.getState().inventory!.party, Date.now())!;
    expect(screen.getByTestId('pvp-cup-lock').textContent).toContain(why);
    const cupButton = within(screen.getByTestId('pvp-mode-cup')).getByRole('button', { name: /Find a match/ });
    expect((cupButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('queues (POST /arena/queue), shows the elapsed time, blocks the other starts and leaves', async () => {
    api.mockImplementation(async (key: string) => {
      if (key === 'arenaQueue') return { ...IDLE_STATUS, state: 'queued', kind: 'level50', waitedMs: 0 };
      if (key === 'arenaQueueLeave') return { ...IDLE_STATUS, reason: 'left' };
      throw new Error(key);
    });
    mountPvp();
    const card = await screen.findByTestId('pvp-mode-level50');
    await act(async () => fireEvent.click(within(card).getByRole('button', { name: /Find a match/ })));
    expect(api).toHaveBeenCalledWith('arenaQueue', { body: { mode: 'level50' } });
    await screen.findByTestId('pvp-elapsed-level50');
    const ranked = within(screen.getByTestId('pvp-mode-ranked')).getByRole('button', { name: /Find a match/ }) as HTMLButtonElement;
    expect(ranked.disabled).toBe(true);
    expect(screen.getByTestId('pvp-mode-ranked').textContent).toContain('Leave the Level 50 queue first.');
    await act(async () => fireEvent.click(within(card).getByRole('button', { name: /Leave queue/ })));
    expect(api).toHaveBeenCalledWith('arenaQueueLeave', { body: {} });
    await waitFor(() => expect(useArenaStore.getState().status.state).toBe('idle'));
  });

  it('Training posts the rules and difficulty and goes straight into the arena', async () => {
    const ws = { enterArena: vi.fn(async () => undefined) } as unknown as WorldSession;
    __setWorldSessionForTests(ws);
    const s = seat('arena-t', 'arena');
    api.mockImplementation(async (key: string) => {
      if (key === 'arenaTraining') return { seat: s };
      throw new Error(key);
    });
    mountPvp();
    const card = await screen.findByTestId('pvp-mode-training');
    fireEvent.click(within(card).getByRole('button', { name: 'Own levels' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Hard' }));
    await act(async () => fireEvent.click(within(card).getByRole('button', { name: /Start training/ })));
    expect(api).toHaveBeenCalledWith('arenaTraining', { body: { rules: 'standard', difficulty: 'hard' } });
    expect(ws.enterArena).toHaveBeenCalledWith(s);
    expect(useArenaStore.getState().last).toEqual({ kind: 'training', rules: 'standard', difficulty: 'hard' });
  });

  it('an empty party disables every start; a friend challenge posts the invite', async () => {
    api.mockImplementation(async (key: string) => {
      if (key === 'arenaInvite') return { inviteId: 'inv-1', expiresAt: Date.now() + 45_000 };
      throw new Error(key);
    });
    const friend = { id: '44444444-4444-4444-8444-444444444444', username: 'ace', title: '', body: 'ranger_f', online: true, zoneId: 'mirevale', inBattle: false, lastSeenAt: new Date().toISOString() };
    mountPvp([friend]);
    const card = await screen.findByTestId('pvp-mode-friend');
    await act(async () => fireEvent.click(within(card).getByRole('button', { name: /Challenge/ })));
    expect(api).toHaveBeenCalledWith('arenaInvite', { body: { username: 'ace', rules: 'level50' } });
    await screen.findByTestId('pvp-outgoing');
    cleanup();
    useSessionStore.getState().hydrateFromMe(meFixture({ party: [] }));
    mountPvp();
    const training = await screen.findByTestId('pvp-mode-training');
    expect((within(training).getByRole('button', { name: /Start training/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('pvpscreen').textContent).toContain('You need a creature in your party.');
  });
});

describe('the daily challenge', () => {
  const c = (speciesId: string) => ({ speciesId, level: 50, moves: ['tackle'], ability: 'Overgrow' });
  const DAILY = {
    dayKey: '2026-10-20', number: 1, endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    team: [c('bramblecub'), c('glimfin'), c('cindercap')], foe: [c('mossling'), c('glimp'), c('bramblecub')],
    foeName: 'Daily Rival', par: 7, best: null, attempts: 0, winners: 12,
  };

  it('the card shows both teams, par and the winners; Play starts the daily in the arena', async () => {
    const ws = { enterArena: vi.fn(async () => undefined) } as unknown as WorldSession;
    __setWorldSessionForTests(ws);
    const s = seat('arena-d', 'arena');
    api.mockImplementation(async (key: string) => {
      if (key === 'dailyStart') return { seat: s };
      throw new Error(key);
    });
    useArenaStore.getState().setDaily(DAILY);
    mountPvp();
    const card = await screen.findByTestId('pvp-mode-daily');
    expect(card.textContent).toContain('Daily challenge #1');
    expect(card.textContent).toContain('Par 7');
    expect(card.textContent).toContain('Won by 12');
    expect(within(card).queryByRole('button', { name: /Copy result/ })).toBeNull();
    await act(async () => fireEvent.click(within(card).getByRole('button', { name: /Play today/ })));
    expect(api).toHaveBeenCalledWith('dailyStart', { body: {} });
    expect(ws.enterArena).toHaveBeenCalledWith(s);
    expect(useArenaStore.getState().last).toEqual({ kind: 'daily' });
  });

  it('a best shows its strip and Try again; the share text has the number, turns, par and strip only', async () => {
    const won = { ...DAILY, best: { turns: 5, marks: '.K.KK', battleId: '00000000-0000-4000-8000-000000000001' }, attempts: 3 };
    useArenaStore.getState().setDaily(won);
    mountPvp();
    const card = await screen.findByTestId('pvp-mode-daily');
    expect(within(card).getByTestId('pvp-daily-strip').textContent).toBe('.K.KK');
    expect(within(card).getByRole('button', { name: /Try again/ })).toBeTruthy();
    expect(within(card).getByRole('button', { name: /Copy result/ })).toBeTruthy();
    expect(dailyShareText(won)).toBe('Ewamon Daily #1: won in 5 turns (par 7)\n.K.KK');
    expect(dailyShareText(DAILY)).toBeNull();
    expect(dailyShareText({ ...won, par: null, best: { ...won.best, turns: 1, marks: 'K' } })).toBe('Ewamon Daily #1: won in 1 turn\nK');
  });

  it("the daily's AI side is named and dressed", () => {
    expect(foeIdentity('arena.daily')).toMatchObject({ name: 'Daily Rival', title: 'Daily challenge', look: 'suit_male' });
  });
});

describe('the arena invite', () => {
  const invite = { inviteId: 'inv-7', fromId: 'f1', fromName: 'ace', rules: 'level50' as const, expiresAt: Date.now() + 40_000 };

  it('Accept replies and moves the player into the arena', async () => {
    const ws = { enterArena: vi.fn(async () => undefined) } as unknown as WorldSession;
    __setWorldSessionForTests(ws);
    const s = seat('arena-f', 'arena');
    api.mockResolvedValue({ seat: s });
    useArenaStore.getState().setInvite({ ...invite, expiresAt: Date.now() + 40_000 });
    render(<ArenaInvitePrompt />);
    expect(screen.getByTestId('arenainvite').textContent).toContain('ace');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Accept/ })));
    expect(api).toHaveBeenCalledWith('arenaInviteReply', { body: { inviteId: 'inv-7', accept: true } });
    expect(ws.enterArena).toHaveBeenCalledWith(s);
    expect(useArenaStore.getState().invite).toBeNull();
  });

  it('declines on its own when challenges are off', async () => {
    api.mockResolvedValue({ seat: null });
    useSettingsStore.getState().set('social', { allowChallenges: false });
    useArenaStore.getState().setInvite({ ...invite, expiresAt: Date.now() + 40_000 });
    render(<ArenaInvitePrompt />);
    expect(screen.queryByTestId('arenainvite')).toBeNull();
    await waitFor(() => expect(api).toHaveBeenCalledWith('arenaInviteReply', { body: { inviteId: 'inv-7', accept: false } }));
    useSettingsStore.getState().set('social', { allowChallenges: true });
  });
});

describe('the arena HUD', () => {
  it('after the battle: the outcome, the rating change and Queue again / Back to world', async () => {
    const ws = { returnToWorld: vi.fn(async () => undefined) } as unknown as WorldSession;
    __setWorldSessionForTests(ws);
    useArenaStore.getState().setInArena(true);
    useArenaStore.getState().setLast({ kind: 'queue', mode: 'ranked' });
    useArenaStore.getState().setMatch({
      matchId: 'm1', kind: 'ranked', level: 50, phase: 'ended', foeName: null, cup: null, reason: null,
      players: [{ playerId: PLAYER_ID, name: 'qa_tester', rating: 1000 }, { playerId: 'p2', name: 'rival', rating: 1010 }],
    });
    useArenaStore.getState().setOutcome({ battleId: 'b1', won: false, ratingDelta: -14 });
    render(<ArenaHud />);
    expect(screen.getByTestId('arenastrip').textContent).toContain('rival');
    const card = screen.getByTestId('arenaresult');
    expect(card.textContent).toContain('Defeat');
    expect(screen.getByTestId('arenaresult-rating').textContent).toContain('-14');
    expect(within(card).getByRole('button', { name: /Queue again/ })).toBeTruthy();
    await act(async () => fireEvent.click(within(card).getByRole('button', { name: /Back to world/ })));
    expect(ws.returnToWorld).toHaveBeenCalledTimes(1);
  });
});

describe('routing', () => {
  it('/play/pvp is a lazy child of /play', () => {
    const play = routes.flatMap((r) => r.children ?? []).find((r) => r.id === 'play');
    expect(play?.children?.some((c) => c.path === 'pvp' && typeof c.lazy === 'function')).toBe(true);
  });
});
