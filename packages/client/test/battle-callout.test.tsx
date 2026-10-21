// @vitest-environment jsdom
/**
 * §20.5.8 the hit callout: the kinds a move hit names (a crit, the type matchup), the `callout` keyframe beside the log
 * line in the full and the reduced timeline alike, and the BattleCallout lower-third that shows it and clears itself.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContentIndex } from '@ewa/content';
import type { BattleEvent } from '@ewa/core';
import { BattleCallout, CALLOUT_MS } from '../src/battle/BattleCallout';
import { buildTimeline, calloutsOf } from '../src/battle/timeline';
import { createMoveAnimRegistry } from '../src/battle/moveAnims';
import { useUiStore } from '../src/state/ui';

const content = createContentIndex();
/** a Fire move of the content (the callout takes the move's type) */
const FIRE_MOVE = 'Blaze Tackle';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  useUiStore.getState().reset();
});

describe('hit callouts (§20.5.8)', () => {
  it('names the matchup and the crit; a plain hit has none', () => {
    expect(calloutsOf(false, 1)).toEqual([]);
    expect(calloutsOf(false, 2)).toEqual(['super']);
    expect(calloutsOf(true, 4)).toEqual(['super', 'crit']);
    expect(calloutsOf(false, 0.5)).toEqual(['resist']);
    expect(calloutsOf(true, 1)).toEqual(['crit']);
    expect(calloutsOf(false, 0)).toEqual(['immune']);
  });

  it('a super-effective crit adds one callout frame on the target, in full and reduced timelines', () => {
    const hit: BattleEvent = {
      t: 'damage', target: { side: 1, slot: 0 }, source: { side: 0, slot: 0 }, amount: 30, hpAfter: 10, maxHp: 40, cause: 'move', move: FIRE_MOVE, crit: true, effectiveness: 2,
    } as BattleEvent;
    const ctx = { content, registry: createMoveAnimRegistry(), reduced: false, speciesOf: () => 'mossling' };
    for (const reduced of [false, true]) {
      const tl = buildTimeline([hit], { ...ctx, reduced });
      const c = tl.frames.filter((f) => f.k === 'callout');
      expect(c).toHaveLength(1);
      expect(c[0]).toMatchObject({ who: { side: 1, slot: 0 }, kinds: ['super', 'crit'], type: 'Fire' });
      const hitAt = tl.frames.find((f) => f.k === 'sfx')!.at;
      expect(c[0]!.at).toBe(hitAt);                    // with the impact, not the log line after it
    }
  });

  it('the lower-third stands on the hit side, carries the kinds and the type, and clears itself', () => {
    vi.useFakeTimers();
    useUiStore.getState().setBattleCallout({ id: 1, foe: true, kinds: ['super', 'crit'], type: 'Fire', reduced: false });
    render(<BattleCallout />);
    const el = screen.getByTestId('battlecallout');
    expect(el.getAttribute('data-kinds')).toBe('super crit');
    expect(el.getAttribute('data-type')).toBe('Fire');
    expect(el.textContent).toContain('Super effective');
    expect(el.textContent).toContain('Critical hit');
    act(() => {
      vi.advanceTimersByTime(CALLOUT_MS + 10);
    });
    expect(useUiStore.getState().battleCallout).toBeNull();
    expect(screen.queryByTestId('battlecallout')).toBeNull();
  });
});
