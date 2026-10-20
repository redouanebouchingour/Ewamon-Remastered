// @vitest-environment jsdom
/**
 * Ranked seasons and spectator mode on the client: the Rating board's season panel (the season, Finals week, the top
 * eight so far, the closed seasons' Champion and Finalists); the PvP screen's live list (Finals marked, Watch opens
 * `/play/watch/:matchId`, an empty list says so); a trainer's season titles.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { apiFetch } from '../src/net/api';
import { LiveMatches } from '../src/screens/LiveMatches';
import { SeasonSection } from '../src/screens/SeasonSection';
import { SeasonTitles, titleLabel } from '../src/screens/SeasonTitles';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const DAY = 86_400_000;
const iso = (ms: number): string => new Date(ms).toISOString();
const row = (rank: number, username: string, rating: number, title: 'champion' | 'finalist' | null) => ({ rank, username, rating, wins: 3, losses: 1, title });

beforeEach(() => {
  api.mockReset();
});
afterEach(cleanup);

describe('seasons on the client', () => {
  it('the season panel: number, Finals week, the top eight so far, past champions and finalists', async () => {
    const now = Date.now();
    api.mockResolvedValue({
      current: { season: 3, startsAt: iso(now - 22 * DAY), endsAt: iso(now + 6 * DAY), finalsAt: iso(now - DAY), finals: true, top: [row(1, 'ash', 1320, 'champion'), row(2, 'gary', 1290, 'finalist')] },
      past: [{ season: 2, startsAt: iso(now - 50 * DAY), endsAt: iso(now - 22 * DAY), finalsAt: iso(now - 29 * DAY), top: [row(1, 'misty', 1400, 'champion'), row(2, 'brock', 1350, 'finalist'), row(9, 'tracey', 1100, null)] }],
    });
    render(
      <MemoryRouter>
        <SeasonSection />
      </MemoryRouter>,
    );
    const section = await screen.findByTestId('season-section');
    expect(api).toHaveBeenCalledWith('seasons', expect.anything());
    expect(within(section).getByText('Season 3')).toBeTruthy();
    expect(within(section).getByText('League Finals week')).toBeTruthy();
    const top = within(section).getByRole('list', { name: 'Top eight so far' });
    expect(within(top).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['1ash1320 · 3-1', '2gary1290 · 3-1']);
    expect(within(section).getByText('Season 2: misty Champion (1400) · Finalists brock')).toBeTruthy();
  });

  it('titles read as places; a trainer without one shows nothing', async () => {
    expect(titleLabel({ season: 2, rank: 1, title: 'champion' })).toBe('Season 2 Champion');
    expect(titleLabel({ season: 1, rank: 3, title: 'finalist' })).toBe('Season 1 Finalist · 3rd');
    expect(titleLabel({ season: 1, rank: 2, title: 'finalist' })).toBe('Season 1 Finalist · 2nd');
    api.mockResolvedValue({ username: 'ash', titles: [{ season: 2, rank: 1, title: 'champion' }, { season: 1, rank: 4, title: 'finalist' }] });
    render(<SeasonTitles username="ash" />);
    const t = await screen.findByTestId('season-titles');
    expect(within(t).getAllByTestId('pill').map((p) => p.textContent)).toEqual(['Season 2 Champion', 'Season 1 Finalist · 4th']);
    expect(api).toHaveBeenCalledWith('seasonTitles', expect.objectContaining({ params: { username: 'ash' } }));
    cleanup();
    api.mockResolvedValue({ username: 'gary', titles: [] });
    render(<SeasonTitles username="gary" />);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('season-titles')).toBeNull();
  });
});

describe('the live list', () => {
  it('lists the matches (Finals marked) and Watch opens the match', async () => {
    api.mockResolvedValue({
      matches: [
        { matchId: '0b6f5a9e-4c1d-4f51-9a35-6a2f0c1d2e3f', kind: 'ranked', finals: true, players: [{ name: 'ash', rating: 1320 }, { name: 'gary', rating: 1290 }], turn: 4, startedAt: iso(Date.now()) },
        { matchId: '1b6f5a9e-4c1d-4f51-9a35-6a2f0c1d2e3f', kind: 'level50', finals: false, players: [{ name: 'misty', rating: 1000 }, { name: 'brock', rating: 990 }], turn: 0, startedAt: iso(Date.now()) },
      ],
    });
    render(
      <MemoryRouter initialEntries={['/play/pvp']}>
        <Routes>
          <Route path="/play/pvp" element={<LiveMatches />} />
          <Route path="/play/watch/:matchId" element={<p>watching</p>} />
        </Routes>
      </MemoryRouter>,
    );
    const rows = await screen.findAllByTestId('live-match');
    expect(rows.map((r) => r.textContent)).toEqual(['ash 1320 vs gary 1290League Finals · turn 4Watch', 'misty 1000 vs brock 990Level 50 · turn 0Watch']);
    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Watch' }));
    expect(await screen.findByText('watching')).toBeTruthy();
  });

  it('says when nothing is on', async () => {
    api.mockResolvedValue({ matches: [] });
    render(
      <MemoryRouter>
        <LiveMatches />
      </MemoryRouter>,
    );
    expect(await screen.findByText('No match is being played right now.')).toBeTruthy();
  });
});
