/**
 * One roaming legendary per season on the client (data/legends.ts): the Dex entry of the season's roamer says where it
 * roams while uncaught, and every season's first catcher of that species; another species gets nothing.
 */
import { describe, expect, it } from 'vitest';
import type { LegendsView } from '@ewa/protocol';
import { roamerLines } from '../src/data/legends';

const at = '2026-10-20T10:00:00.000Z';

describe('the roamer in the Dex', () => {
  it('where it roams while uncaught, and every season it was caught first', () => {
    const view: LegendsView = { season: 3, species: 'voltaura', zoneId: 'tide_route', movesAt: at, caught: null, past: [{ season: 1, species: 'voltaura', username: 'ash', at }, { season: 2, species: 'sunjaw', username: 'gary', at }] };
    expect(roamerLines(view, 'voltaura', 'Voltaura')).toEqual([
      'Season 3: Voltaura roams the routes. Last seen on Tide Route. The first trainer to catch it is remembered.',
      'Season 1: first caught by ash.',
    ]);
    expect(roamerLines(view, 'sunjaw', 'Sunjaw')).toEqual(['Season 2: first caught by gary.']);
    expect(roamerLines(view, 'mossling', 'Mossling')).toEqual([]);
    const caught: LegendsView = { ...view, zoneId: null, movesAt: null, caught: { season: 3, species: 'voltaura', username: 'misty', at }, past: [{ season: 3, species: 'voltaura', username: 'misty', at }] };
    expect(roamerLines(caught, 'voltaura', 'Voltaura')).toEqual(['Season 3: first caught by misty.']);
  });
});
