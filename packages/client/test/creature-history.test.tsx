// @vitest-environment jsdom
/**
 * Creature history on the client: every event kind reads as one sentence (zone, badge and species names from
 * content); the section shows the original trainer and the events newest first; an older creature says nothing was
 * recorded; a failed load says so.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatureEvent } from '@ewa/protocol';
import { badgeDisplay } from '../src/data/badgeIcon';
import { speciesName, zoneName } from '../src/data/content';
import { __resetApiForTests } from '../src/net/api';
import { CreatureHistory, eventLine } from '../src/screens/CreatureHistory';
import { useSessionStore } from '../src/state/session';

const at = '2026-10-20T10:00:00.000Z';
const CID = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c';

function stub(status: number, body: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })));
}

beforeEach(() => {
  __resetApiForTests();
  useSessionStore.setState({ accessToken: 'test-access', accessExp: Date.now() + 3_600_000 });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('creature history', () => {
  it('reads every event kind as a sentence', () => {
    const lines = ([
      { kind: 'met', at, how: 'caught', speciesId: 'glimfin', level: 7, zoneId: 'mire_route', trainer: 'ash' },
      { kind: 'met', at, how: 'received', speciesId: 'glimfin', level: 5, zoneId: null, trainer: 'ash' },
      { kind: 'traded', at, from: 'ash', to: 'misty' },
      { kind: 'sold', at, from: 'misty', to: 'brock' },
      { kind: 'gift', at, from: 'brock', to: 'ash' },
      { kind: 'evolved', at, from: 'bramblecub', into: 'thornbear' },
      { kind: 'badge', at, badge: 'bloom' },
      { kind: 'champion', at },
      { kind: 'legendary', at, species: 'hyoryu', caught: true },
      { kind: 'legendary', at, species: 'hyoryu', caught: false },
    ] satisfies CreatureEvent[]).map(eventLine);
    expect(lines).toEqual([
      `Caught by ash on ${zoneName('mire_route')} at level 7.`,
      'Received by ash at level 5.',
      'Traded from ash to misty.',
      'Sold by misty to brock on the market.',
      'Given by brock to ash.',
      `Evolved from ${speciesName('bramblecub')} into ${speciesName('thornbear')}.`,
      `In the party that won the ${badgeDisplay('bloom')!.name} Badge.`,
      'In the party that beat the Champion.',
      `In the party that caught ${speciesName('hyoryu')}.`,
      `In the party that defeated ${speciesName('hyoryu')}.`,
    ]);
  });

  it('shows the original trainer and the events newest first', async () => {
    stub(200, { originalTrainer: 'ash', events: [{ kind: 'met', at: '2026-10-01T10:00:00.000Z', how: 'received', speciesId: 'glimfin', level: 5, zoneId: null, trainer: 'ash' }, { kind: 'traded', at, from: 'ash', to: 'misty' }] });
    render(<CreatureHistory creatureId={CID} />);
    await waitFor(() => expect(screen.getByText('ash', { selector: 'span' })).toBeTruthy());
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('span')!.textContent)).toEqual(['Traded from ash to misty.', 'Received by ash at level 5.']);
  });

  it('an older creature says nothing was recorded; a failed load says so', async () => {
    stub(200, { originalTrainer: null, events: [] });
    render(<CreatureHistory creatureId={CID} />);
    await waitFor(() => expect(screen.getByText('Not recorded')).toBeTruthy());
    expect(screen.getByText(/older than the history/)).toBeTruthy();
    cleanup();
    stub(404, { code: 'notFound' });
    render(<CreatureHistory creatureId={CID} />);
    await waitFor(() => expect(screen.getByText('The history could not be loaded.')).toBeTruthy());
  });
});
