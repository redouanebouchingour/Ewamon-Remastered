// @vitest-environment jsdom
/**
 * The bounty board on the client: the poster, post, claim and cost lines; the Wanted screen's posters (the board's,
 * a trainer's, the player's own nemesis), the Lawlander strip, a Badlander posting on a picked ghost (money applied),
 * the Marshal's refusal without a Badlander, a refused post's words; the Marshal opens the board; the history line.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOUNTY_REFUSAL_TEXT, interiorNpcs } from '@ewa/content';
import type { BountiesView, BountyPosterView } from '@ewa/protocol';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});
vi.mock('react-router', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, useNavigate: () => () => undefined };
});

import { apiFetch } from '../src/net/api';
import { ApiFailure } from '../src/net/apiError';
import { interiorInteractables } from '../src/scene/interiors';
import { BountyScreen, claimLine, postCostLine, postStatusLine, postedByLine, recordLine } from '../src/screens/BountyScreen';
import { eventLine } from '../src/screens/CreatureHistory';
import { useSessionStore } from '../src/state/session';
import { creature, meFixture } from './fixtures';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;
const SOON = new Date(Date.now() + 2 * 3_600_000).toISOString();
const AGO = new Date(Date.now() - 3_600_000).toISOString();

const poster = (over: Partial<BountyPosterView> = {}): BountyPosterView => ({
  id: 'b1',
  kind: 'game',
  target: 'kestrel',
  speciesId: 'badlander',
  level: 34,
  zoneId: 'deepcut_route',
  wins: 40,
  rank: null,
  reward: 5_000,
  withLawlander: 6_250,
  postedBy: null,
  postedAt: AGO,
  expiresAt: SOON,
  mine: false,
  ...over,
});
const view = (over: Partial<BountiesView> = {}): BountiesView => ({
  enabled: true,
  nextPostingAt: SOON,
  wanted: [poster(), poster({ id: 'b2', kind: 'player', reward: 800, withLawlander: 1_000, postedBy: 'outlaw', wins: 2 })],
  personal: [poster({ id: 'n1', kind: 'nemesis', target: 'Murkjaw the Drowned', speciesId: 'dustcub', wins: null, rank: 3, reward: 1_200, withLawlander: 1_500, expiresAt: null })],
  posted: [{ id: 'p1', target: 'wren', reward: 600, fee: 150, status: 'expired', claimedBy: null, postedAt: AGO, expiresAt: AGO }],
  claims: [{ kind: 'player', target: 'kestrel', claimedBy: 'marshal_mo', payout: 1_000, bonus: true, zoneId: 'deepcut_route', at: AGO }],
  ghosts: [
    { name: 'kestrel', zoneId: 'deepcut_route', speciesId: 'badlander', level: 34, wins: 40, wanted: true },
    { name: 'wren', zoneId: 'mire_route', speciesId: 'bramblecub', level: 12, wins: 0, wanted: false },
  ],
  you: { badlander: true, lawlander: true, open: 0, claimsToday: 1, atBoard: true },
  money: 9_000,
  ...over,
});

beforeEach(() => {
  api.mockReset();
  useSessionStore.getState().hydrateFromMe(meFixture({ party: [creature('badlander', { id: 'c-bad' })] }));
});
afterEach(cleanup);

describe('the bounty board on the client', () => {
  it('reads its lines', () => {
    expect(recordLine(poster())).toBe('Beat 40 trainers this week.');
    expect(recordLine(poster({ wins: 1 }))).toBe('Beat 1 trainer this week.');
    expect(recordLine(poster({ kind: 'nemesis', rank: 3 }))).toContain('Rank 3 nemesis');
    expect(postedByLine(poster())).toBe('Posted by the board');
    expect(postedByLine(poster({ kind: 'player', postedBy: 'outlaw' }))).toBe('Posted by outlaw');
    expect(postedByLine(poster({ kind: 'player', mine: true }))).toBe('Your poster');
    expect(postStatusLine({ id: 'p', target: 'wren', reward: 600, fee: 150, status: 'expired', claimedBy: null, postedAt: AGO, expiresAt: AGO })).toBe('Came down unclaimed. 750 went back to you.');
    expect(postStatusLine({ id: 'p', target: 'wren', reward: 600, fee: 150, status: 'claimed', claimedBy: 'mo', postedAt: AGO, expiresAt: AGO })).toBe('Brought in by mo.');
    expect(claimLine(view().claims[0]!)).toBe('marshal_mo brought in kestrel on Deepcut: 1,000 with a Lawlander.');
    expect(postCostLine(800)).toContain('Costs 1,000: the 800 bounty and the board\'s 200 cut');
    for (const line of [recordLine(poster()), postCostLine(800), claimLine(view().claims[0]!)]) expect(line).not.toMatch(/—/);
  });

  it('shows the posters, the nemesis wanted by you alone, the Lawlander strip, your posters and the claims', async () => {
    api.mockResolvedValue(view());
    render(<BountyScreen />);
    const board = await screen.findByTestId('bounty-board');
    const posters = screen.getAllByTestId('bounty-poster');
    expect(posters).toHaveLength(3);
    expect(posters[0]!.textContent).toContain('kestrel');
    expect(posters[0]!.textContent).toContain('5,000');
    expect(posters[0]!.textContent).toContain('6,250 with a Lawlander');
    expect(posters[0]!.getAttribute('data-type')).toBe('Ground');
    expect(posters[2]!.textContent).toContain('Wanted by you');
    expect(posters[2]!.textContent).toContain('Murkjaw the Drowned');
    expect(board.textContent).toContain('A Lawlander rides with you');
    expect(board.textContent).toContain('1 of 3 claims today');
    expect(board.textContent).toContain('750 went back to you');
    expect(board.textContent).toContain('marshal_mo brought in kestrel');
    expect(api).toHaveBeenCalledWith('bounties', expect.anything());
  });

  it('a Badlander picks a ghost and posts: the money comes off', async () => {
    api.mockResolvedValueOnce(view());
    render(<BountyScreen />);
    await screen.findByTestId('bounty-board');
    const post = screen.getByRole('button', { name: 'Pick a ghost' }) as HTMLButtonElement;
    expect(post.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /wren/i }));
    fireEvent.change(screen.getByLabelText('Bounty'), { target: { value: '800' } });
    expect(screen.getByTestId('bounty-board').textContent).toContain('Costs 1,000');
    api.mockResolvedValueOnce(view({ money: 8_000, you: { badlander: true, lawlander: true, open: 1, claimsToday: 1, atBoard: true } }));
    fireEvent.click(screen.getByRole('button', { name: 'Post on wren' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('bountyPost', { body: { target: 'wren', reward: 800 } }));
    await waitFor(() => expect(useSessionStore.getState().inventory?.money).toBe(8_000));
  });

  it("a refused post says why in the Marshal's words; without a Badlander he says who may post", async () => {
    api.mockResolvedValueOnce(view());
    render(<BountyScreen />);
    await screen.findByTestId('bounty-board');
    fireEvent.click(screen.getByRole('button', { name: /kestrel/i }));
    api.mockRejectedValueOnce(new ApiFailure({ status: 409, code: 'alreadyPosted', detail: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Post on kestrel' }));
    expect(await screen.findByText(BOUNTY_REFUSAL_TEXT.alreadyPosted)).toBeTruthy();
    cleanup();
    api.mockResolvedValueOnce(view({ you: { badlander: false, lawlander: false, open: 0, claimsToday: 0, atBoard: true } }));
    render(<BountyScreen />);
    expect(await screen.findByText(BOUNTY_REFUSAL_TEXT.noBadlander)).toBeTruthy();
    expect(screen.getByTestId('bounty-board').textContent).toContain('No Lawlander in your party');
  });

  it('the Marshal stands in every town and talks before the board opens; the history line', () => {
    const m = interiorNpcs('mirevale').find((n) => n.role === 'bounty')!;
    expect(m.name).toBe('Marshal');
    expect(interiorInteractables('mirevale', new Set(), 'E').find((e) => e.id === m.id)).toMatchObject({ kind: 'npc', prompt: { verb: 'Talk to', target: 'Marshal' } });
    expect(eventLine({ kind: 'bounty', at: AGO, target: 'kestrel', targetKind: 'ghost', reward: 6_250, zoneId: 'deepcut_route' })).toBe('Brought in kestrel on Deepcut for a 6,250 bounty.');
    expect(eventLine({ kind: 'bounty', at: AGO, target: 'Murkjaw the Drowned', targetKind: 'nemesis', reward: 800, zoneId: 'mire_route' })).toBe('Brought in Murkjaw the Drowned, a nemesis, on Mire Route for a 800 bounty.');
  });
});
