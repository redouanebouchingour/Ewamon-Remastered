// @vitest-environment jsdom
/**
 * Trainer banners: the card renders the frame's rarity, the pins at their tier and the trackers with their values; an
 * older server's profile (no `banner`) shows the default banner; every pin's top tier is the brightest metal.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PublicProfile } from '@ewa/protocol';
import { TrainerBanner, bannerModelOf, pinMetal } from '../src/screens/TrainerBanner';

afterEach(cleanup);

const pub = (over: Partial<PublicProfile> = {}): PublicProfile => ({
  id: '00000000-0000-4000-8000-000000000001',
  username: 'Ash',
  title: 'Champion',
  motto: '',
  body: 'ranger_m',
  rating: 1420,
  peakRating: 1500,
  tier: 'platinum',
  trainerLevel: 40,
  badges: ['bloom', 'ember'],
  guildTag: 'EWA',
  dexCaughtCount: 77,
  showcase: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

describe('TrainerBanner', () => {
  it('shows the frame, the pins at their tier and the trackers', () => {
    const model = bannerModelOf(
      pub({ banner: { frame: 'laurel', backdrop: 'type_fire', pins: [{ id: 'gym_conqueror', tier: 3 }, { id: 'champion', tier: 1 }], trackers: [{ id: 'pvpWins', value: 1234 }], featured: null } }),
    );
    render(<TrainerBanner model={model} />);
    const card = screen.getByTestId('trainerbanner');
    expect(card.dataset['rarity']).toBe('legendary');
    expect(card.dataset['type']).toBe('Fire');
    expect(card.getAttribute('aria-label')).toBe("Ash's banner, Champion's Laurel frame");
    const pins = within(screen.getByRole('list', { name: 'Pins' }));
    expect(pins.getByLabelText('Gym Conqueror III')).toBeTruthy();
    expect(pins.getByLabelText('Champion')).toBeTruthy();
    expect(within(screen.getByLabelText('Trackers')).getByText('1,234')).toBeTruthy();
    expect(screen.getByText('No partner')).toBeTruthy();
  });

  it('falls back to the default banner for a profile without one', () => {
    const m = bannerModelOf(pub());
    expect(m).toMatchObject({ frame: 'standard', backdrop: 'midnight', pins: [], featured: null });
    expect(m.trackers).toEqual([
      { id: 'rating', value: 1420 },
      { id: 'dexCaught', value: 77 },
      { id: 'badges', value: 2 },
    ]);
  });

  it('pin metals climb to the brightest at the top tier', () => {
    expect([1, 2, 3, 4].map((t) => pinMetal(4, t))).toEqual(['silver', 'gold', 'diamond', 'master']);
    expect([1, 5].map((t) => pinMetal(5, t))).toEqual(['bronze', 'master']);
    expect(pinMetal(1, 1)).toBe('master');
  });
});
