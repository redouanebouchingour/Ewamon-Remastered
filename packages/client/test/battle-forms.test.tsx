// @vitest-environment jsdom
/**
 * Battle forms in the battle menu: while hollowmane holds its Rage Form the Fight grid shows its signature move,
 * Hollow Crescent, in Night Slash's slot (its type, power and accuracy; the slot's PP), and picking it sends the slot's
 * own move id — the server executes the signature, the moveset never changes. Before the form, Night Slash shows.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { digestBattleState } from '@ewa/core';
import type { BattleEvent, BattleState } from '@ewa/core';
import type { ServerMessageOf } from '@ewa/protocol';
import { createBattleController } from '../src/battle/BattleController';
import type { BattleView } from '../src/battle/BattleController';
import { BattleMenu } from '../src/battle/BattleMenu';
import { STEP_MS } from '../src/battle/constants';
import { setBattleActions } from '../src/battle/controllerRef';
import { useNotificationsStore } from '../src/state/notifications';
import { useUiStore } from '../src/state/ui';
import { makeCreature, startBattle } from './battleFuzz';

const content = createContentIndex();
const BID = '00000000-0000-4000-8000-0000000000f1';

function open(hp: number | null): { sent: { type: string; payload: unknown }[]; state: BattleState } {
  const sent: { type: string; payload: unknown }[] = [];
  const noop = (): undefined => undefined;
  const view: BattleView = {
    enterBattle: noop, exitBattle: noop, setBattler: noop, setPose: noop, hurt: noop, vfx: noop, prewarm: noop, syncFrom: noop,
    setWeather: noop, cue: noop, shake: noop, setTimeScale: noop, hitstopEnabled: () => false, slowmoEnabled: () => false,
    playSfx: noop, setBattleHud: noop, setThreat: noop,
  };
  const c = createBattleController({
    content, send: (type, payload) => sent.push({ type, payload }), reduced: () => false, instantText: () => true,
    selfPosition: () => ({ x: 0, z: 0 }), summaryAt: () => null, selfId: () => 'p0', raidId: () => null, view, defer: (fn) => fn(),
  });
  setBattleActions({ submit: (a) => c.submit(a), check: (a) => c.check(a), dismissResult: () => c.dismissResult(), undoPick: () => c.undoPick() });
  const base = makeCreature(content, content.species('hollowmane'), 58, 'mine-1', 'p0');
  const me = hp === null ? base : { ...base, hp };
  const foe = makeCreature(content, content.species('mossling'), 5, 'wild-1', null);
  const start = startBattle(content, 9, 'wild', [me], [foe]);
  const events = start.events;
  // Majin / Tenjin: hollowmane's rage form is a Majin form, so a PLAYER's hollowmane no longer changes on its own below
  // half — it transforms by the band. The menu test starts it in its form, as after its transformation.
  const state: BattleState = hp === null ? start.state : { ...start.state, sides: [{ ...start.state.sides[0], transformed: true, party: [{ ...start.state.sides[0].party[0]!, form: 'rage' }] }, start.state.sides[1]] };
  const msg: ServerMessageOf<'battleStart'> = { type: 'battleStart', battleId: BID, format: 'wild', seat: 0, state, events: [...events] as BattleEvent[], stateDigest: digestBattleState(state) };
  c.onBattleStart(msg);
  for (let i = 0; i < 4000 && c.player.isPlaying; i++) c.player.step(STEP_MS);
  render(<BattleMenu />);
  return { sent, state };
}

const labels = (): string[] => screen.getAllByTestId('movebutton').map((b) => b.textContent ?? '');

beforeEach(() => {
  useUiStore.getState().reset();
  useNotificationsStore.getState().clear();
});
afterEach(() => {
  cleanup();
  setBattleActions(null);
});

describe('battle forms in the battle menu', () => {
  it('before the Rage Form, Night Slash shows in its slot', () => {
    const { state } = open(null);
    expect(state.sides[0].party[0]!.form).toBeUndefined();
    expect(labels().some((l) => l.includes('Night Slash'))).toBe(true);
    expect(labels().some((l) => l.includes('Hollow Crescent'))).toBe(false);
  });

  it('in the Rage Form, Hollow Crescent shows in Night Slash’s slot; picking it sends Night Slash (the slot)', () => {
    const { sent, state } = open(20);
    expect(state.sides[0].party[0]!.form).toBe('rage');
    const all = labels();
    expect(all.some((l) => l.includes('Night Slash'))).toBe(false);
    const crescent = screen.getAllByTestId('movebutton').find((b) => b.textContent?.includes('Hollow Crescent'))!;
    expect(crescent.textContent).toContain('110');
    fireEvent.click(crescent);
    const action = sent.find((m) => m.type === 'battleAction')!.payload as { action: { kind: string; move: string } };
    expect(action.action).toEqual({ kind: 'move', move: 'Night Slash' });
  });
});
