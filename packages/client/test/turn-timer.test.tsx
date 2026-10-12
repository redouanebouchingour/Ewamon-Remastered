// @vitest-environment jsdom
/**
 * SPEC §20.5.6 turn timer (2026-10-12): the turn tag counts down the server's `deadlineMs` while the player chooses or
 * waits; warn under 10 s, danger under 5 s; hidden while the turn plays, at the end, without a deadline, and in raids.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleState } from '@ewa/core';
import { TurnTimer, turnTimerText } from '../src/battle/TurnTimer';
import { useUiStore } from '../src/state/ui';
import type { BattleUi } from '../src/state/ui';

function battle(over: Partial<BattleUi>): void {
  useUiStore.getState().setBattle({
    battleId: 'b1', format: 'wild', seat: 0, authoritative: {} as BattleState, phase: 'selecting', menu: 'moves', turnLabel: 'Turn 1',
    log: [], desyncs: 0, result: null, expectedMs: 0, ...over,
  } as BattleUi);
}

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.getState().reset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('turn timer', () => {
  it('formats m:ss, rounding up and never below zero', () => {
    expect(turnTimerText(60_000)).toBe('1:00');
    expect(turnTimerText(59_001)).toBe('1:00');
    expect(turnTimerText(41_200)).toBe('0:42');
    expect(turnTimerText(-500)).toBe('0:00');
  });

  it('counts down while choosing, turns warn under 10 s and danger under 5 s', () => {
    battle({ deadlineAt: performance.now() + 60_000 });
    render(<TurnTimer />);
    const timer = (): HTMLElement => screen.getByTestId('turn-timer');
    expect(timer().textContent).toBe('1:00');
    expect(timer().className).not.toMatch(/timerWarn|timerDanger/);
    act(() => vi.advanceTimersByTime(51_000));
    expect(timer().textContent).toBe('0:09');
    expect(timer().className).toMatch(/timerWarn/);
    act(() => vi.advanceTimersByTime(5_000));
    expect(timer().className).toMatch(/timerDanger/);
    expect(timer().getAttribute('aria-label')).toBe('4 seconds left to choose');
  });

  it('is hidden while the turn plays, without a deadline, and in a raid', () => {
    battle({ deadlineAt: performance.now() + 60_000, phase: 'playing' });
    render(<TurnTimer />);
    expect(screen.queryByTestId('turn-timer')).toBeNull();
    act(() => battle({ deadlineAt: null }));
    expect(screen.queryByTestId('turn-timer')).toBeNull();
    act(() => battle({ deadlineAt: performance.now() + 60_000, raid: { raidId: 'r', round: 1, catchWindow: false } }));
    expect(screen.queryByTestId('turn-timer')).toBeNull();
    act(() => battle({ deadlineAt: performance.now() + 60_000, phase: 'submitted' }));
    expect(screen.getByTestId('turn-timer').textContent).toBe('1:00');
  });
});
