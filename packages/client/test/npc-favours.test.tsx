// @vitest-environment jsdom
/**
 * NPC side quests in the journal (Favours tab, `FavourList`): the open favours from `GET /npc/quests` with who asked
 * and where, the progress and the reward; Drop abandons an accepted one and the list reloads; the handed-in ones
 * follow; the server refusing (NPC talk off) shows an empty state; a favour turning done is toasted with who to go
 * back to (`watchNpcQuests`).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NpcQuestView } from '@ewa/protocol';
import { FavourList } from '../src/screens/FavourList';
import { useNotificationsStore } from '../src/state/notifications';
import { stopWatchingNpcQuests, watchNpcQuests } from '../src/state/npcQuests';
import { toProgressionDelta, useSessionStore } from '../src/state/session';

const AT = '2026-10-24T12:00:00.000Z';
const q = (id: string, over: Partial<NpcQuestView>): NpcQuestView => ({
  id: `00000000-0000-4000-8000-00000000000${id}`,
  npcId: 'mirevale.archivist',
  npcName: 'Hessa Dunmore, town archivist',
  zoneId: 'mirevale',
  status: 'active',
  objective: { kind: 'defeat', zoneId: 'mire_route', count: 3 },
  reward: { money: 250, item: null },
  target: 3,
  progress: 1,
  ready: false,
  offeredAt: AT,
  closedAt: null,
  ...over,
});
const open = [q('1', {}), q('2', { npcId: 'mirevale.child', npcName: 'a child', objective: { kind: 'catch', species: 'mossling', zoneId: 'mire_route' }, target: 1, progress: 1, ready: true, reward: { money: 180, item: { id: 'potion', qty: 1 } } })];
const done = [q('3', { status: 'claimed', objective: { kind: 'visit', zoneId: 'mire_route' }, target: 1, progress: 1, closedAt: AT })];

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

const flush = async (ms = 30): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  stopWatchingNpcQuests();
});
beforeEach(() => {
  useSessionStore.setState({ accessToken: 'token', accessExp: Date.now() + 3_600_000 });
  useNotificationsStore.setState({ toasts: [] } as never);
});

describe('journal favours', () => {
  it('lists the open favours and the handed-in ones; Drop abandons one', async () => {
    const calls: Call[] = [];
    let list = { open, done };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, method: init.method ?? 'GET', body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
        if (url.endsWith('/npc/quests/answer')) {
          list = { open: open.slice(1), done };
          return Response.json({ ...open[0]!, status: 'abandoned', closedAt: AT });
        }
        return Response.json(list);
      }),
    );
    render(<FavourList />);
    await flush();
    const cards = screen.getAllByTestId('favour');
    expect(cards).toHaveLength(2);
    expect(cards[0]!.textContent).toContain('Beat 3 wild Ewamon on Mire Route');
    expect(cards[0]!.textContent).toContain('For Hessa Dunmore, Mirevale');
    expect(cards[0]!.textContent).toContain('Reward: 250 coins');
    expect(cards[1]!.textContent).toContain('Hand in');
    expect(cards[1]!.textContent).toContain('180 coins and a Potion');
    expect(screen.getByText('Go to Mire Route')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Drop Beat 3 wild Ewamon on Mire Route' }));
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(calls.find((c) => c.url.endsWith('/npc/quests/answer'))?.body).toEqual({ questId: open[0]!.id, answer: 'abandon' });
    expect(screen.getAllByTestId('favour')).toHaveLength(1);
  });

  it('shows an empty state when the server refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'npcToolsOff' }, { status: 409 })));
    render(<FavourList />);
    await flush();
    expect(screen.getByText('Favours are unavailable')).toBeTruthy();
  });

  it('toasts a favour that turns done, with who to go back to', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ open, done: [] })));
    useSessionStore.setState({ progression: { badges: [], trainerExp: 0, trainerLevel: 1, rating: 1000, dexSeen: [], dexCaught: [], dexVariants: {}, dexAlpha: [], dexShiny: [], flags: [], quests: {}, questsClaimed: [], missions: [] } as never });
    watchNpcQuests();
    act(() => useSessionStore.getState().applyProgressionDelta(toProgressionDelta({ questProgress: [{ questId: `npc:${open[0]!.id}`, objectiveId: 'main', count: 3, done: true }] })));
    await flush();
    expect(JSON.stringify(useNotificationsStore.getState().toasts)).toContain('Favour done: Beat 3 wild Ewamon on Mire Route. Go back to Hessa Dunmore in Mirevale.');
  });
});
