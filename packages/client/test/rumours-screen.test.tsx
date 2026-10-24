// @vitest-environment jsdom
/**
 * LLM feature 8 on screen: the Rumours panel (the town's masthead and date, every fact at once in the crier's template
 * with its sprite or type icon, the model's words replacing a template as they come, the player's gossip apart under
 * "About you", the town picker, the board off with NPC_TOOLS=off) and its More menu entry.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RumoursView } from '@ewa/protocol';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { ApiFailure, apiFetch } from '../src/net/api';
import { NAV_MORE } from '../src/app/TopBar';
import { RumoursScreen, boardDate } from '../src/screens/RumoursScreen';
import { closeRumours, useRumoursStore } from '../src/state/rumours';
import { useSessionStore } from '../src/state/session';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const DASH = String.fromCharCode(0x2014);

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

const view = (town: string, name: string): RumoursView => ({
  zoneId: town,
  town: name,
  day: '2026-10-22',
  facts: [
    { id: 'raid:raid_mire_thornback', kind: 'raid', text: 'A level 18 Thornback raid opens on Mire Route at 17:00 UTC for 30 minutes.', zoneId: 'mire_route', speciesId: 'thornback', type: 'Grass' },
    { id: 'badge:ember', kind: 'badge', text: 'bram won the Ember Badge yesterday.', zoneId: null, speciesId: null, type: 'Fire' },
    { id: 'gossip:mirevale.archivist:hit', kind: 'gossip', text: 'redwolf hit Hessa Dunmore.', zoneId: town, speciesId: null, type: null },
  ],
});

function model(line: string | null): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (!String(url).includes('/chat/completions')) return new Response('{}', { status: 404 });
      if (line === null) return new Response('down', { status: 503 });
      const body = JSON.parse(String(init?.body ?? '{}')) as { messages: { content: string }[] };
      // only the raid gets words; the rest stray (an invented number) and keep their templates
      const said = body.messages[1]!.content.includes('Thornback') ? line : 'A level 99 rumour.';
      return Response.json({ choices: [{ message: { content: said } }] });
    }),
  );
}

function renderPanel(path = '/play/rumours?town=mirevale'): void {
  const router = createMemoryRouter(
    [
      { path: '/play/rumours', element: <RumoursScreen /> },
      { path: '/play', element: <p>world</p> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  localStorage.clear();
  api.mockReset();
  api.mockImplementation(async (_key: string, init: { params: { zoneId: string } }) => (init.params.zoneId === 'cinderhold' ? view('cinderhold', 'Cinderhold') : view('mirevale', 'Mirevale')));
  useRumoursStore.setState({ town: null, lastTown: null, status: 'idle', view: null, words: {}, writing: false });
  useSessionStore.setState({
    zoneId: 'mirevale',
    progression: { badges: ['bloom'], trainerExp: 0, trainerLevel: 1, rating: 1000, dexSeen: [], dexCaught: [], dexVariants: {}, dexAlpha: [], flags: [], quests: {}, questsClaimed: [], missions: [] },
  });
});
afterEach(() => {
  closeRumours();
  cleanup();
  vi.unstubAllGlobals();
});

describe('the Rumours panel', () => {
  it("shows the town's facts at once, then the crier's words for the ones the model got right", async () => {
    model(`Hear ye! A level 18 Thornback raid opens on Mire Route at 17:00 UTC ${DASH} for 30 minutes.`);
    renderPanel();
    expect(await screen.findByText('The Mirevale Crier')).toBeTruthy();
    expect(screen.getByText(boardDate('2026-10-22'))).toBeTruthy();
    expect(api).toHaveBeenCalledWith('worldRumours', expect.objectContaining({ params: { zoneId: 'mirevale' } }));
    const news = screen.getByRole('list', { name: 'The news' });
    const items = within(news).getAllByTestId('rumour');
    expect(items.map((i) => i.getAttribute('data-kind'))).toEqual(['raid', 'badge']);
    expect(items[1]!.textContent).toContain('bram won the Ember Badge yesterday.');
    expect(within(items[1]!).getAllByTestId('typebadge')[0]!.getAttribute('data-type')).toBe('Fire');
    await waitFor(() => expect(items[0]!.getAttribute('data-from')).toBe('model'));
    expect(items[0]!.textContent).toContain('Hear ye! A level 18 Thornback raid opens on Mire Route at 17:00 UTC, for 30 minutes.');
    expect(items[0]!.textContent?.includes(DASH)).toBe(false);
    await waitFor(() => expect(screen.getByTestId('rumour-status').textContent).toBe(''));
    expect(items[1]!.getAttribute('data-from')).toBe('template');
    const about = screen.getByRole('region', { name: 'About you' });
    expect(within(about).getByTestId('rumour').textContent).toContain('redwolf hit Hessa Dunmore.');
  });

  it('switches towns with the picker, and the board is off with NPC_TOOLS=off', async () => {
    model(null);
    useSessionStore.setState({ progression: { ...useSessionStore.getState().progression!, badges: ['bloom', 'ember'] } });
    renderPanel();
    expect(await screen.findByText('The Mirevale Crier')).toBeTruthy();
    const picker = screen.getByRole('group', { name: 'Town' });
    expect(within(picker).getByRole('button', { name: 'Mirevale' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(picker).getByRole('button', { name: 'Cinderhold' }));
    expect(await screen.findByText('The Cinderhold Crier')).toBeTruthy();
    expect(api).toHaveBeenLastCalledWith('worldRumours', expect.objectContaining({ params: { zoneId: 'cinderhold' } }));

    cleanup();
    api.mockImplementation(async () => {
      throw new ApiFailure({ status: 409, code: 'npcToolsOff', detail: null });
    });
    renderPanel();
    expect(await screen.findByText('The crier has the day off. The board is bare.')).toBeTruthy();
  });

  it('is in the More menu', () => {
    expect(NAV_MORE.find((n) => n.label === 'Rumours')?.to).toBe('/play/rumours');
  });
});
