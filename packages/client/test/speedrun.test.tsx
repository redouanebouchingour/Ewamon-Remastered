// @vitest-environment jsdom
/**
 * Verified speedruns on the client: the clock's format; split names (a beat and where it happens, a badge, the
 * Champion); the Profile section shows the server's time, whether the run counts, and the splits in order.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BADGES, STORY, beatDoneFlag, zone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { apiFetch } from '../src/net/api';
import { formatPlayMs, splitLabel } from '../src/data/speedrun';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { SpeedrunSection } from '../src/screens/SpeedrunSection';
import { useSessionStore } from '../src/state/session';
import { meFixture } from './fixtures';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const at = '2026-10-20T10:00:00.000Z';

beforeEach(() => api.mockReset());
afterEach(cleanup);

describe('verified speedruns on the client', () => {
  it('formats the clock and names the splits; the timer is off by default', () => {
    expect(formatPlayMs(0)).toBe('0:00');
    expect(formatPlayMs(61_999)).toBe('1:01');
    expect(formatPlayMs(3_725_000)).toBe('1:02:05');
    const beat = STORY[0]!;
    expect(splitLabel(`beat:${beat.id}`)).toContain(zone(beat.zoneId as ZoneId).name);
    expect(splitLabel(`badge:${BADGES[0]!.id}`)).toBe(`${BADGES[0]!.name} Badge`);
    expect(splitLabel('champion')).toBe('Champion');
    expect(DEFAULT_SETTINGS.accessibility.speedrunTimer).toBe(false);
  });

  it('the Profile section shows the finish time and the splits; an uncounted run says why', async () => {
    api.mockResolvedValue({ username: 'ash', playMs: 9_000_000, running: false, counted: true, finishMs: 8_000_000, splits: [{ split: `beat:${STORY[0]!.id}`, playMs: 12_000, at }, { split: 'champion', playMs: 8_000_000, at }] });
    render(<SpeedrunSection />);
    await waitFor(() => expect(screen.getAllByText('2:13:20')).toHaveLength(2));
    expect(screen.getByText('to the Champion')).toBeTruthy();
    const rows = within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent);
    expect(rows).toEqual([`${splitLabel(`beat:${STORY[0]!.id}`)}0:12`, 'Champion2:13:20']);
    cleanup();
    api.mockResolvedValue({ username: 'ash', playMs: 5_000, running: true, counted: false, finishMs: null, splits: [] });
    render(<SpeedrunSection />);
    await waitFor(() => expect(screen.getByText(/The run starts with the first story beat/)).toBeTruthy());
    expect(screen.getByText('played so far')).toBeTruthy();
    cleanup();
    useSessionStore.getState().hydrateFromMe(meFixture({ flags: [beatDoneFlag(STORY[0]!.id)] }));
    render(<SpeedrunSection />);
    await waitFor(() => expect(screen.getByText(/not on the board/)).toBeTruthy());
    useSessionStore.getState().clearSession();
  });
});
