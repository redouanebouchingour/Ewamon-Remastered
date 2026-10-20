// @vitest-environment jsdom
/**
 * Majin vs Tenjin seasons on the client: the Factions screen shows the score, both sides with their best, who holds
 * Solenne's sky and the Chronicle, and the choice before a side is taken (POST /factions/join, then the player's
 * side); the sky mood is asked only in Solenne and once a season.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import type { FactionsView } from '@ewa/protocol';
import { apiFetch } from '../src/net/api';
import { __resetFactionSkyForTests, factionSkyFor } from '../src/scene/factionSky';
import { FactionsScreen } from '../src/screens/FactionsScreen';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;

// jsdom's AbortSignal is not undici's: a router loader's Request needs the same patch the other route tests use
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

const VIEW: FactionsView = {
  season: 2,
  endsAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  mine: null,
  points: { majin: 40, tenjin: 52 },
  members: { majin: 4, tenjin: 5 },
  top: { majin: [{ username: 'ash', points: 12 }], tenjin: [{ username: 'gary', points: 15 }] },
  sky: 'majin',
  chronicle: [{ season: 1, winner: 'majin', line: 'Season 1: the Majin held the sky, 30 to 20.' }],
};

function mount(view: FactionsView) {
  const router = createMemoryRouter([{ path: '/play/factions', element: <FactionsScreen />, loader: () => ({ view }) }], { initialEntries: ['/play/factions'] });
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  api.mockReset();
  __resetFactionSkyForTests();
});
afterEach(cleanup);

describe('the Factions screen', () => {
  it('shows the score, both sides, the sky and the Chronicle; a side is taken once and shown as yours', async () => {
    api.mockResolvedValue({ ...VIEW, mine: { side: 'tenjin', points: 0 }, members: { majin: 4, tenjin: 6 } });
    mount(VIEW);
    const standings = await screen.findByTestId('factions-standings');
    expect(standings.textContent).toContain('Majin 40');
    expect(standings.textContent).toContain('52 Tenjin');
    expect(standings.textContent).toContain('The Majin hold the sky over Solenne this season.');
    expect(within(screen.getByTestId('faction-majin')).getByText('ash')).toBeTruthy();
    expect(screen.getByTestId('factions-chronicle').textContent).toContain('Season 1: the Majin held the sky, 30 to 20.');
    fireEvent.click(within(screen.getByTestId('faction-tenjin')).getByRole('button', { name: 'Side with the Tenjin' }));
    await waitFor(() => expect(within(screen.getByTestId('faction-tenjin')).getByText(/Your side/)).toBeTruthy());
    expect(api).toHaveBeenCalledWith('factionJoin', { body: { side: 'tenjin' } });
    expect(screen.queryByRole('button', { name: /Side with the/ })).toBeNull();
  });

  it('before any season ended the Chronicle says so', async () => {
    mount({ ...VIEW, sky: null, chronicle: [], mine: { side: 'majin', points: 3 } });
    expect((await screen.findByTestId('factions-chronicle')).textContent).toContain('No season has ended yet');
    expect(screen.getByTestId('factions-standings').textContent).not.toContain('hold the sky');
    expect(within(screen.getByTestId('faction-majin')).getByText('Your side · 3 points')).toBeTruthy();
  });
});

describe("Solenne's sky", () => {
  it('is asked only in Solenne, once a season; a failed ask is no mood', async () => {
    api.mockResolvedValue({ sky: 'tenjin' });
    expect(await factionSkyFor('mire_route')).toBeNull();
    expect(api).not.toHaveBeenCalled();
    expect(await factionSkyFor('solenne')).toBe('tenjin');
    expect(await factionSkyFor('solenne')).toBe('tenjin');
    expect(api).toHaveBeenCalledTimes(1);
    __resetFactionSkyForTests();
    api.mockRejectedValue(new Error('offline'));
    expect(await factionSkyFor('solenne')).toBeNull();
  });
});
