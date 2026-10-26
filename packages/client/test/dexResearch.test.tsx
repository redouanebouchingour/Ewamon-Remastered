// @vitest-environment jsdom
/**
 * The Dex with research data (GET /dex `entries` / `research` / `rewards`): the Research tab with its tasks, the moves
 * locked below research 2 and open at 2, the Rewards view with a ready reward, and a NEW tag on an entry never opened.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { DEX_REWARDS } from '@ewa/content';
import { DexScreen } from '../src/screens/DexScreen';
import { useSessionStore } from '../src/state/session';
import { meFixture } from './fixtures';

// no server here: the ecosystem board and the viewed mark wait forever
vi.mock('../src/net/api', async (orig) => ({ ...(await orig<Record<string, unknown>>()), apiFetch: vi.fn(() => new Promise(() => undefined)) }));

vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));

// jsdom's AbortSignal is not undici's: the router's navigation Request needs the signal kept off the native init
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

afterEach(cleanup);

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/play/dex', element: <DexScreen /> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const at = '2026-10-20T10:00:00.000Z';
function withDex(research: Record<string, number>, caught: string[], viewed: string | null = at) {
  useSessionStore.getState().hydrateFromMe(meFixture());
  const p = useSessionStore.getState().progression!;
  const entries = Object.fromEntries(caught.map((id) => [id, { seenAt: at, caughtAt: at, counters: { seen: 1, caught: 1 }, firstSeenZone: null, viewedAt: viewed }]));
  useSessionStore.setState({ progression: { ...p, dexSeen: caught, dexCaught: caught, dexEntries: entries, dexResearch: research, dexRewards: [] } });
}

describe('the Dex with research', () => {
  it('shows the Research tab and keeps the moves locked below research level 2', async () => {
    withDex({ bramblecub: 1 }, ['bramblecub']);
    const router = renderAt('/play/dex?id=bramblecub&tab=research');
    expect(screen.getByTestId('dex-research').textContent).toContain('Times seen');
    fireEvent.click(screen.getByRole('tab', { name: 'Moves' }));
    await waitFor(() => expect(router.state.location.search).toContain('tab=moves'));
    expect((await screen.findByTestId('dex-locked')).textContent).toContain('research level 2');
    expect(screen.queryByTestId('dex-moves')).toBeNull();
  });

  it('opens the moves at research level 2', () => {
    withDex({ bramblecub: 2 }, ['bramblecub']);
    renderAt('/play/dex?id=bramblecub&tab=moves');
    expect(screen.getByTestId('dex-moves')).toBeTruthy();
  });

  it('lists a ready reward with Claim in the Rewards view', () => {
    const zone = DEX_REWARDS.find((r) => r.need.kind === 'zone')!;
    const ids = zone.need.kind === 'zone' ? [...zone.need.species] : [];
    withDex({}, ids);
    renderAt('/play/dex?view=rewards');
    const ready = screen.getByRole('region', { name: 'Ready to claim' });
    const row = within(ready).getByRole('listitem', { name: new RegExp(`^${zone.title}`) });
    expect(within(row).getByRole('button', { name: 'Claim' })).toBeTruthy();
  });

  it('tags an entry recorded but never opened as new', () => {
    withDex({ bramblecub: 1 }, ['bramblecub'], null);
    renderAt('/play/dex');
    const tile = screen.getByRole('button', { name: /^Bramblecub, recorded/ });
    expect(within(tile).getByText('New')).toBeTruthy();
  });
});
