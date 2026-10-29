// @vitest-environment jsdom
/**
 * The Mire Route foosball club's banter (state/foosballBanter.ts, world/FoosballBanter.tsx): the clock walks the lines
 * while the player is near, rests after the last, resets when they walk away and freezes while busy; the bubble shows
 * only with an anchor on screen.
 */
import { FOOSBALL_CLUB } from '@ewa/content';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BANTER_GAP_MS, BANTER_LEAD_MS, BANTER_REST_MS, banterLineMs, clearBanterLine, createBanterClock, setBanterAnchor, showBanterLine } from '../src/state/foosballBanter';
import { FoosballBanter } from '../src/world/FoosballBanter';

const lines = FOOSBALL_CLUB.banter;

describe('foosball banter clock', () => {
  it('says every line in order, then rests and starts over', () => {
    const clock = createBanterClock();
    expect(clock.step(BANTER_LEAD_MS - 1, true, false, lines)).toBeNull();
    expect(clock.step(1, true, false, lines)).toBe(0);
    for (let i = 0; i < lines.length; i++) {
      expect(clock.step(banterLineMs(lines[i]!.text) - 1, true, false, lines)).toBe(i);
      const gap = i === lines.length - 1 ? BANTER_REST_MS : BANTER_GAP_MS;
      expect(clock.step(1, true, false, lines)).toBeNull();
      expect(clock.step(gap, true, false, lines)).toBe(i === lines.length - 1 ? 0 : i + 1);
    }
  });

  it('walking away resets it; busy freezes it', () => {
    const clock = createBanterClock();
    clock.step(BANTER_LEAD_MS + banterLineMs(lines[0]!.text) + BANTER_GAP_MS, true, false, lines);
    expect(clock.step(0, true, false, lines)).toBe(1);
    expect(clock.step(60_000, true, true, lines)).toBeNull();
    expect(clock.step(0, true, false, lines)).toBe(1);
    expect(clock.step(16, false, false, lines)).toBeNull();
    expect(clock.step(BANTER_LEAD_MS, true, false, lines)).toBe(0);
  });
});

describe('FoosballBanter', () => {
  afterEach(() => act(() => clearBanterLine()));

  it('draws the line over the speaker only while their head is on screen', () => {
    render(<FoosballBanter />);
    act(() => showBanterLine('mire_route.foosball_mercedes', 'If this is how you wanna win? Fine.'));
    expect(screen.queryByTestId('foosball-banter')).toBeNull();
    act(() => setBanterAnchor({ x: 300, y: 200 }));
    const b = screen.getByTestId('foosball-banter');
    expect(b.textContent).toBe('If this is how you wanna win? Fine.');
    expect(b.dataset.by).toBe('mire_route.foosball_mercedes');
    act(() => setBanterAnchor(null));
    expect(screen.queryByTestId('foosball-banter')).toBeNull();
  });
});
