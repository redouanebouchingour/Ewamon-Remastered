// @vitest-environment jsdom
/**
 * LLM feature 3, the commentary on screen: the commentator's lower third and the trainer's line show what the store
 * holds for this battle, clear themselves, stay away while switched off, behind a league banner or once the result
 * card is up; the result card carries the closing lines (the trainer's only without an authored concession).
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleState } from '@ewa/core';
import { BattleCommentary, CASTER_MS, ResultCommentary, TRAINER_MS } from '../src/battle/BattleCommentary';
import { showCaster, showTrainer, useCommentaryStore } from '../src/state/commentary';
import type { CasterLine, TrainerLine } from '../src/state/commentary';
import { DEFAULT_SETTINGS, useSettingsStore } from '../src/state/settings';
import { useUiStore } from '../src/state/ui';

const BID = '00000000-0000-4000-8000-0000000000c4';
const D = '\u2014';

const caster = (o: Partial<CasterLine> = {}): CasterLine => ({ id: 1, battleId: BID, kind: 'crit', side: 'own', head: 'Critical hit from Bramblecub!', text: `What a hit ${D} wow`, fromModel: false, ...o });
const trainer = (o: Partial<TrainerLine> = {}): TrainerLine => ({ id: 2, battleId: BID, kind: 'faint', speaker: 'Rook', text: 'Get up, Mossling!', fromModel: true, ...o });

function openBattle(): void {
  useUiStore.getState().setBattle({
    battleId: BID, format: 'trainer', seat: 0, authoritative: {} as BattleState, phase: 'selecting', menu: 'root', turnLabel: 'Turn 1', log: [], desyncs: 0, result: null,
    expectedMs: 0, deadlineAt: null,
  });
}

beforeEach(() => {
  useUiStore.getState().reset();
  useSettingsStore.setState({ accessibility: DEFAULT_SETTINGS.accessibility });
  useCommentaryStore.setState({ caster: null, trainer: null, finalCaster: null, finalTrainer: null });
  openBattle();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BattleCommentary', () => {
  it('shows the caption (headline and colour, em-dashes out) and the trainer’s line, then clears each in its time', () => {
    vi.useFakeTimers();
    render(<BattleCommentary />);
    act(() => {
      showCaster(caster());
      showTrainer(trainer());
    });
    const cap = screen.getByTestId('battle-commentary');
    expect(cap.getAttribute('data-kind')).toBe('crit');
    expect(cap.textContent).toContain('Critical hit from Bramblecub!');
    expect(cap.textContent).toContain('What a hit, wow');
    expect(cap.textContent).not.toContain(D);
    expect(screen.getByTestId('battle-banter').textContent).toContain('Rook');
    expect(screen.getByTestId('battle-banter').textContent).toContain('Get up, Mossling!');
    act(() => {
      vi.advanceTimersByTime(TRAINER_MS);
    });
    expect(screen.queryByTestId('battle-banter')).toBeNull();
    expect(screen.queryByTestId('battle-commentary')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(CASTER_MS - TRAINER_MS);
    });
    expect(screen.queryByTestId('battle-commentary')).toBeNull();
  });

  it('a newer line replaces the one showing and gets its own full time', () => {
    vi.useFakeTimers();
    render(<BattleCommentary />);
    act(() => showCaster(caster()));
    act(() => {
      vi.advanceTimersByTime(CASTER_MS - 100);
    });
    act(() => showCaster(caster({ id: 3, kind: 'knockout', head: 'Down goes Mossling!' })));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('battle-commentary').textContent).toContain('Down goes Mossling!');
  });

  it('nothing while switched off, for another battle, behind a league banner (the trainer) or under the result card', () => {
    render(<BattleCommentary />);
    act(() => {
      useSettingsStore.getState().set('accessibility', { battleCommentary: false, trainerBanter: false });
      showCaster(caster());
      showTrainer(trainer());
    });
    expect(screen.queryByTestId('battle-commentary')).toBeNull();
    expect(screen.queryByTestId('battle-banter')).toBeNull();
    act(() => useSettingsStore.getState().set('accessibility', { battleCommentary: true, trainerBanter: true }));
    expect(screen.queryByTestId('battle-commentary')).not.toBeNull();
    act(() => useUiStore.getState().pushBattleBanner({ id: 9, speaker: 'Mira', text: 'Not yet!' }));
    expect(screen.queryByTestId('battle-banter')).toBeNull();
    expect(screen.queryByTestId('battle-commentary')).not.toBeNull();
    act(() => {
      const b = useUiStore.getState().battle!;
      useUiStore.getState().setBattle({ ...b, phase: 'ended', result: { outcome: { winner: 0 }, rewards: { money: 0, trainerExp: 0, items: {}, badge: null, ratingDelta: null } as never, prompts: 0 } });
    });
    expect(screen.queryByTestId('battle-commentary')).toBeNull();
    act(() => showCaster(caster({ id: 5, battleId: 'another' })));
    expect(screen.queryByTestId('battle-commentary')).toBeNull();
  });
});

describe('ResultCommentary', () => {
  it('carries the closing call and the trainer’s last word; an authored concession keeps the trainer quiet', () => {
    act(() => {
      showCaster(caster({ id: 7, kind: 'win', head: 'Victory for Ash!', text: 'Take a bow!' }));
      showTrainer(trainer({ id: 8, kind: 'loss', text: 'This loss stings.' }));
    });
    const { rerender } = render(<ResultCommentary concession={false} />);
    expect(screen.getByTestId('battleresult-commentary').textContent).toContain('Victory for Ash!');
    expect(screen.getByTestId('battleresult-banter').textContent).toContain('This loss stings.');
    rerender(<ResultCommentary concession />);
    expect(screen.queryByTestId('battleresult-banter')).toBeNull();
    expect(screen.queryByTestId('battleresult-commentary')).not.toBeNull();
  });

  it('a mid-battle line never reaches the result card', () => {
    act(() => showCaster(caster()));
    render(<ResultCommentary concession={false} />);
    expect(screen.queryByTestId('battleresult-commentary')).toBeNull();
  });
});
