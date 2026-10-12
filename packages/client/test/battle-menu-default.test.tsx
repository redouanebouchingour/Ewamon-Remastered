// @vitest-environment jsdom
/**
 * SPEC §20.5.6 (amended 2026-10-12): a battle opens on the Fight menu — the moves — at every choice. Back / Escape from
 * Party, Bag or Orbs return to the moves; Escape on the moves shows the root (1–5 command hotkeys); the next turn opens
 * on the moves again.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { digestBattleState } from '@ewa/core';
import type { BattleEvent } from '@ewa/core';
import type { ServerMessageOf } from '@ewa/protocol';
import { createBattleController } from '../src/battle/BattleController';
import type { BattleView } from '../src/battle/BattleController';
import { BattleMenu } from '../src/battle/BattleMenu';
import { STEP_MS } from '../src/battle/constants';
import { setBattleActions } from '../src/battle/controllerRef';
import { useNotificationsStore } from '../src/state/notifications';
import { OPEN_MENU, useUiStore } from '../src/state/ui';
import { makeCreature, startBattle } from './battleFuzz';

const content = createContentIndex();
const BID = '00000000-0000-4000-8000-00000000d3f1';

beforeEach(() => {
  useUiStore.getState().reset();
  useNotificationsStore.getState().clear();
});
afterEach(() => {
  cleanup();
  setBattleActions(null);
});

function wildBattle() {
  const noop = (): undefined => undefined;
  const view: BattleView = {
    enterBattle: noop, exitBattle: noop, setBattler: noop, setPose: noop, hurt: noop, vfx: noop, prewarm: noop, syncFrom: noop,
    setWeather: noop, cue: noop, shake: noop, setTimeScale: noop, hitstopEnabled: () => false, slowmoEnabled: () => false,
    playSfx: noop, setBattleHud: noop, setThreat: noop,
  };
  const c = createBattleController({
    content, send: noop, reduced: () => false, instantText: () => true, selfPosition: () => ({ x: 0, z: 0 }), summaryAt: () => null,
    selfId: () => 'p0', raidId: () => null, view, defer: (fn) => fn(),
  });
  setBattleActions({ submit: (a) => c.submit(a), check: (a) => c.check(a), dismissResult: () => c.dismissResult(), undoPick: () => c.undoPick() });
  const me = makeCreature(content, content.species('bramblecub'), 20, 'mine-1', 'p0');
  const foe = makeCreature(content, content.species('mossling'), 5, 'wild-1', null);
  const r = startBattle(content, 7, 'wild', [me], [foe]);
  const msg: ServerMessageOf<'battleStart'> = {
    type: 'battleStart', battleId: BID, format: 'wild', seat: 0, state: r.state, events: [...r.events] as BattleEvent[], stateDigest: digestBattleState(r.state),
  };
  c.onBattleStart(msg);
  for (let i = 0; i < 4000 && c.player.isPlaying; i++) c.player.step(STEP_MS);
  render(<BattleMenu />);
}

const menuOf = (): string | null => screen.getByTestId('battlemenu').getAttribute('data-menu');

describe('battle menu default', () => {
  it('opens on the moves, with the four move cards and no Back button', () => {
    expect(OPEN_MENU).toBe('moves');
    wildBattle();
    expect(useUiStore.getState().battle?.phase).toBe('selecting');
    expect(menuOf()).toBe('moves');
    expect(screen.getAllByTestId('movebutton').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('Back from Party and Escape from Bag return to the moves; Escape on the moves shows the commands', () => {
    wildBattle();
    fireEvent.click(screen.getByRole('button', { name: /Party/ }));
    expect(menuOf()).toBe('party');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(menuOf()).toBe('moves');

    fireEvent.click(screen.getByRole('button', { name: /Bag/ }));
    act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
    expect(menuOf()).toBe('moves');

    act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
    expect(menuOf()).toBe('root');
    act(() => void fireEvent.keyDown(window, { key: '2' }));
    expect(menuOf()).toBe('party');
  });
});
