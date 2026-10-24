// @vitest-environment jsdom
/**
 * LLM feature 9 on screen: the Journal panel (today's page written on open with the day's facts as chips: sprites, type
 * icons, kind icons; the earlier pages newest first; Copy; Rewrite today when the page is behind the day; an empty
 * day; the journal off) and its More menu entry.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { JournalEntryView, JournalFact, JournalView } from '@ewa/protocol';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { ApiFailure, apiFetch } from '../src/net/api';
import { NAV_MORE } from '../src/app/TopBar';
import { JournalScreen, chipLabel, pageDate } from '../src/screens/JournalScreen';
import { closeJournal, useJournalStore } from '../src/state/journal';
import { useNotificationsStore } from '../src/state/notifications';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const DASH = String.fromCharCode(0x2014);

const fact = (kind: JournalFact['kind'], text: string, over: Partial<JournalFact> = {}): JournalFact => ({ kind, text, speciesId: null, zoneId: null, type: null, count: 1, ...over });
const FACTS: JournalFact[] = [
  fact('badge', 'I won the Bloom Badge from Mira Thornwell!', { type: 'Grass' }),
  fact('caught', 'I caught 2 Mossling on Mire Route.', { speciesId: 'mossling', zoneId: 'mire_route', count: 2, type: 'Water' }),
  fact('zones', 'I was on Mire Route.', { zoneId: 'mire_route' }),
];
const page = (day: string, n: number, text: string, facts: JournalFact[] = FACTS): JournalEntryView => ({ day, dayNumber: n, text, facts, writtenAt: '2026-10-24T12:00:00.000Z' });

function model(line: string | null): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (!String(url).includes('/chat/completions')) return new Response('{}', { status: 404 });
      if (line === null) return new Response('down', { status: 503 });
      return Response.json({ choices: [{ message: { content: line } }] });
    }),
  );
}

function serve(view: JournalView, writes: [string, string][] = []): void {
  api.mockImplementation(async (key: string, init: { params?: { day: string }; body?: { text: string } }) => {
    if (key === 'journal') return view;
    if (key === 'journalDay') return { ...view.today, facts: FACTS };
    if (key === 'journalWrite') {
      writes.push([init.params!.day, init.body!.text]);
      return page(init.params!.day, 12, init.body!.text, FACTS);
    }
    throw new Error(key);
  });
}

function renderPanel(): void {
  const router = createMemoryRouter(
    [
      { path: '/play/journal', element: <JournalScreen /> },
      { path: '/play', element: <p>world</p> },
    ],
    { initialEntries: ['/play/journal'] },
  );
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  api.mockReset();
  useJournalStore.setState({ status: 'idle', view: null, writing: [] });
  useNotificationsStore.setState({ toasts: [] } as never);
});
afterEach(() => {
  closeJournal();
  cleanup();
  vi.unstubAllGlobals();
});

describe('the Journal panel', () => {
  it("writes today's page on open and shows it with the day's facts as chips, then the earlier pages", async () => {
    model(`Day 12: I won the Bloom Badge from Mira Thornwell ${DASH} at last! I caught 2 Mossling on Mire Route.`);
    const writes: [string, string][] = [];
    serve({ today: { day: '2026-10-24', dayNumber: 12, facts: FACTS, entry: null }, unwritten: [], entries: [page('2026-10-22', 10, 'Day 10: I caught a Glimfin.', [fact('caught', 'I caught a Glimfin.', { speciesId: 'glimfin' })])] }, writes);
    renderPanel();
    const today = await screen.findByRole('region', { name: 'Today' });
    await waitFor(() => expect(within(today).getByTestId('journal-page').textContent).toContain('Day 12: I won the Bloom Badge from Mira Thornwell, at last! I caught 2 Mossling on Mire Route.'));
    expect(writes).toEqual([['2026-10-24', 'Day 12: I won the Bloom Badge from Mira Thornwell, at last! I caught 2 Mossling on Mire Route.']]);
    expect(within(today).getByText(`Today · ${pageDate('2026-10-24')}`)).toBeTruthy();
    const chips = within(today).getAllByTestId('journal-chip');
    expect(chips.map((c) => c.getAttribute('data-kind'))).toEqual(['badge', 'caught', 'zones']);
    expect(chips[0]!.textContent).toContain('Bloom Badge');
    expect(within(chips[0]!).getByTestId('typebadge').getAttribute('data-type')).toBe('Grass');
    expect(chips[1]!.textContent).toContain('2× Mossling');
    expect(within(chips[2]!).getByTestId('icon')).toBeTruthy();
    const earlier = screen.getByRole('region', { name: 'Earlier days' });
    expect(within(earlier).getByTestId('journal-page').textContent).toContain('Day 10: I caught a Glimfin.');
    expect(screen.queryByRole('button', { name: 'Rewrite today' })).not.toBeNull();
  });

  it('copies a page, and rewrites today when the day moved on', async () => {
    model(null);
    const writes: [string, string][] = [];
    const behind = page('2026-10-24', 12, 'Day 12: I won the Bloom Badge.', FACTS.slice(0, 1));
    serve({ today: { day: '2026-10-24', dayNumber: 12, facts: FACTS, entry: behind }, unwritten: [], entries: [behind] }, writes);
    const clip = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: clip }, configurable: true });
    renderPanel();
    expect(await screen.findByText('More happened since this page was written.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(clip).toHaveBeenCalledWith('Day 12: I won the Bloom Badge.'));
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite today' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    // the model is down: the facts themselves
    expect(writes[0]![1]).toBe(`Day 12: ${FACTS.map((f) => f.text).join(' ')}`);
  });

  it('an empty day says so; the journal off says so; it is in the More menu', async () => {
    serve({ today: { day: '2026-10-24', dayNumber: 1, facts: [], entry: null }, unwritten: [], entries: [] });
    renderPanel();
    expect(await screen.findByText('Nothing in the journal yet today. Catch something, battle someone, help a villager.')).toBeTruthy();
    cleanup();
    api.mockImplementation(async () => {
      throw new ApiFailure({ status: 409, code: 'npcToolsOff', detail: null });
    });
    renderPanel();
    expect(await screen.findByText('The journal is closed on this server.')).toBeTruthy();
    expect(NAV_MORE.find((n) => n.label === 'Journal')?.to).toBe('/play/journal');
    expect(chipLabel(fact('deed', 'I insulted Pim.'))).toBe('insulted');
    expect(chipLabel(fact('deed', 'I had kind words for Pim.'))).toBe('Kind words');
    expect(chipLabel(fact('deed', 'Pim gave me a gift.'))).toBe('Gift');
  });
});
