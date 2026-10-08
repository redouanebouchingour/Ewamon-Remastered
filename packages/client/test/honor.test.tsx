// @vitest-environment jsdom
/**
 * The honor ledger on the client (core honor.ts, dustcub's line):
 * - the evolve prompt names the branch the creature's ledger picks now (the ledger can move after the battle event
 *   that queued the prompt; the server resolves the same branch) and tells where its honor stands;
 * - a second prompt for a creature that already evolved is dropped, never sent;
 * - the creature detail's meter sits between Outlaw and Lawman and names the form it becomes.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CreatureInstance } from '@ewa/core';
import { species } from '../src/data/content';
import { HonorLedger } from '../src/screens/CreatureDetail';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { PostBattlePrompts, promptTarget } from '../src/world/PostBattlePrompts';
import { creature, meFixture } from './fixtures';

const cub = (over: Partial<CreatureInstance> = {}): CreatureInstance => creature('dustcub', { level: 30, ability: 'Sand Veil', ...over });
const ask = (into: string) => ({ kind: 'evolve' as const, creatureId: 'x', into });

afterEach(cleanup);
beforeEach(() => {
  useUiStore.getState().reset();
  useSessionStore.getState().clearSession();
});

describe('the honor split on the client', () => {
  it('promptTarget follows the ledger at the split level, keeps other targets, and drops a stale prompt', () => {
    expect(promptTarget(ask('badlander'), cub({ honor: 3 }))).toBe('lawlander');
    expect(promptTarget(ask('badlander'), cub())).toBe('lawlander'); // absent = 0: the lawman's road
    expect(promptTarget(ask('lawlander'), cub({ honor: -1 }))).toBe('badlander');
    expect(promptTarget(ask('badlander'), cub({ level: 29, honor: 5 }))).toBe('badlander');
    expect(promptTarget(ask('badlander'), creature('lawlander', { level: 30 }))).toBeNull();
    expect(promptTarget(ask('bloomduck'), creature('smellduck', { level: 20 }))).toBe('bloomduck');
  });

  it('the evolve prompt names the ledger’s branch and its honor', () => {
    const c = cub({ honor: 4 });
    useSessionStore.getState().hydrateFromMe(meFixture({ party: [c] }));
    useUiStore.getState().enqueuePrompt({ kind: 'evolve', creatureId: c.id, into: 'badlander' });
    render(<PostBattlePrompts />);
    const text = screen.getByTestId('evolveprompt').textContent ?? '';
    expect(text).toContain('ready to evolve into Lawlander');
    expect(text).toContain('Its honor stands at +4: it walks the lawman');
  });

  it('a prompt for a creature that already evolved is dropped', async () => {
    const c = creature('badlander', { level: 31 });
    useSessionStore.getState().hydrateFromMe(meFixture({ party: [c] }));
    useUiStore.getState().enqueuePrompt({ kind: 'evolve', creatureId: c.id, into: 'lawlander' });
    render(<PostBattlePrompts />);
    await Promise.resolve();
    expect(screen.queryByTestId('evolveprompt')).toBeNull();
    expect(useUiStore.getState().prompts).toEqual([]);
  });

  it('the detail meter shows the ledger between Outlaw and Lawman and the form it becomes', () => {
    render(<HonorLedger creature={cub({ level: 24, honor: -3 })} sp={species('dustcub')!} />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('-3');
    expect(meter.getAttribute('aria-valuemin')).toBe('-10');
    expect(meter.getAttribute('aria-valuemax')).toBe('10');
    expect(screen.getByLabelText('Honor').textContent).toContain('At level 30 it becomes Badlander.');
  });
});
