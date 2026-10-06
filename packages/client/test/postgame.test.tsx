// @vitest-environment jsdom
/**
 * Phase D14 — post-game in the client. League rematches: `gymPlan` offers the rematch's lines after the Champion (and
 * not before), `rematchOfBattle` recognises a rematch team, `leaguePostDialogue` says the rematch's own lines. The
 * battle tower: the attendant is a `tower` interactable in Solenne's league hall; the picker takes three party
 * creatures (a fourth click is ignored, a second click un-picks) and sends `tower start`; `towerState` routing opens /
 * closes the modal; between fights Next / Retire send `tower next` / `quit`; a lost run shows its summary.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POSTGAME_FLAG, TOWER, createContentIndex, leagueRematch } from '@ewa/content';
import { createBattle, projectBattler } from '@ewa/core';
import type { ServerMessageOf } from '@ewa/protocol';
import { routeServerMessage } from '../src/net/messageRouter';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession } from '../src/net/WorldSession';
import { gymPlan, leaguePostDialogue, rematchOfBattle, rematchOffer } from '../src/scene/dialogue';
import { interiorInteractables } from '../src/scene/interiors';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { TowerModal, TowerStreak, togglePick, towerFightLabel } from '../src/world/TowerModal';
import { makeCreature } from './battleFuzz';
import { meFixture } from './fixtures';

const content = createContentIndex();
const ALL_BADGES = ['bloom', 'ember', 'current', 'circuit', 'fault', 'wraith', 'anvil', 'ascend'] as const;

describe('D14 league rematch dialogue', () => {
  it('a beaten gym leader offers the rematch lines only after the Champion', () => {
    const before = new Set(['saw_thinning', 'bloom_spoken', 'beat:grove_stone:done', 'beat:bloom_after:done', 'badge:bloom']);
    expect(rematchOffer('verdant_gym', before, ['bloom'])).toBeNull();
    expect(gymPlan('mirevale', 'verdant_gym', before, ['bloom']).dialogue).toBeNull();
    const after = new Set([...before, POSTGAME_FLAG]);
    const plan = gymPlan('mirevale', 'verdant_gym', after, ['bloom']);
    expect(plan.dialogue?.lines).toEqual(leagueRematch('verdant_gym').pre);
    expect(plan.sendOnFinish).toBe(true);
    // a gym whose badge the player lacks is no rematch
    expect(rematchOffer('blaze_gym', after, ['bloom'])).toBeNull();
  });

  it('Wardens and the Champion: a rematch once their flags are held', () => {
    const flags = new Set(['elite:veil:beaten', 'elite:aurelia:beaten', 'elite:kirei:beaten', POSTGAME_FLAG]);
    for (const id of ['veil', 'aurelia', 'kirei', 'zeon']) expect(rematchOffer(id, flags, [...ALL_BADGES])?.leagueId).toBe(id);
    expect(rematchOffer('zeon', new Set(['elite:veil:beaten']), [...ALL_BADGES])).toBeNull();
  });

  it('recognises a rematch battle by its team and says the rematch post lines', () => {
    const rm = leagueRematch('tidal_gym');
    const npc = rm.team.map((m, i) => projectBattler(makeCreature(content, content.species(m.species), m.level, `npc:${i}`, null), content));
    const mine = [projectBattler(makeCreature(content, content.species('moblaze'), 80, 'p0', 'me'), content)];
    const st = createBattle(
      {
        id: 'b',
        format: 'league',
        zoneId: 'saltmourn',
        terrain: 'salt',
        seed: 1,
        sides: [
          { kind: 'player', party: mine, active: 0, trainerId: 'me', canFlee: false, canCatch: false },
          { kind: 'npc', party: npc, active: 0, trainerId: 'tidal_gym', canFlee: false, canCatch: false },
        ],
      },
      content,
    ).state;
    expect(rematchOfBattle(st, 0)?.leagueId).toBe('tidal_gym');
    expect(leaguePostDialogue('tidal_gym', rematchOfBattle(st, 0))?.lines).toEqual(rm.post);
    expect(leaguePostDialogue('tidal_gym')?.lines[0]).toBe('The Current Badge. You rode it.');
  });
});

describe('D14 battle tower', () => {
  const sent: { type: string; payload: unknown }[] = [];
  const ws = {
    room: null,
    selfId: 'me',
    zoneId: 'solenne',
    send: (type: string, payload: unknown) => void sent.push({ type, payload }),
    onMessage: () => () => undefined,
    subscribeState: () => () => undefined,
    onRoom: () => () => undefined,
    onReconnected: () => () => undefined,
    handover: async () => undefined,
    enter: async () => undefined,
    leave: async () => undefined,
  } as unknown as WorldSession;
  const party = ['moblaze', 'thornback', 'kygra', 'rambull'].map((sp, i) => makeCreature(content, content.species(sp), 60, `c${i}`, 'me'));

  beforeEach(() => {
    sent.length = 0;
    __setWorldSessionForTests(ws);
    useUiStore.getState().reset();
    useSessionStore.getState().hydrateFromMe(meFixture({ party: party as never, box: [] as never, flags: [POSTGAME_FLAG] }));
  });
  afterEach(() => cleanup());

  it('the attendant is a tower interactable in Solenne', () => {
    const t = interiorInteractables('solenne', new Set(), 'E').find((e) => e.id === TOWER.attendantId);
    expect(t?.kind).toBe('tower');
    expect(t?.prompt.target).toBe('Tower Attendant');
  });

  it('togglePick keeps at most three, in click order; a second click removes', () => {
    let p: readonly string[] = [];
    for (const id of ['a', 'b', 'c', 'd']) p = togglePick(p, id);
    expect(p).toEqual(['a', 'b', 'c']);
    expect(togglePick(p, 'b')).toEqual(['a', 'c']);
    expect(towerFightLabel({ set: 2, fight: 3 })).toBe('Set 2 · fight 3 of 7');
  });

  it('the picker sends tower start with the three chosen party creatures', () => {
    act(() => useUiStore.getState().openModal('tower'));
    render(<TowerModal />);
    const modal = screen.getByTestId('towermodal');
    expect(modal.dataset['state']).toBe('pick');
    const cards = within(modal).getAllByTestId('creaturecard');
    expect(cards).toHaveLength(4);
    const start = (): HTMLElement => screen.getByRole('button', { name: /Start run|Pick \d more/ });
    expect((start() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(cards[2]!);
    fireEvent.click(cards[0]!);
    fireEvent.click(cards[3]!);
    fireEvent.click(cards[1]!); // a fourth pick is ignored
    expect(screen.getByText('3 of 3 chosen')).toBeTruthy();
    fireEvent.click(start());
    expect(sent).toEqual([{ type: 'tower', payload: { action: 'start', picks: ['c2', 'c0', 'c3'] } }]);
  });

  it('towerState: a fight closes the modal and shows the counter; a win reopens it with Next / Retire', () => {
    act(() => useUiStore.getState().openModal('tower'));
    const base: ServerMessageOf<'towerState'> = { type: 'towerState', phase: 'fighting', streak: 6, runWins: 6, best: 6, set: 1, fight: 7, picks: ['c0', 'c1', 'c2'], reward: null };
    act(() => routeServerMessage(base, ws));
    expect(useUiStore.getState().modal).toBe('none');
    expect(useUiStore.getState().tower?.phase).toBe('fighting');
    act(() => useUiStore.getState().setBattle({ battleId: 'b' } as never));
    render(
      <>
        <TowerModal />
        <TowerStreak />
      </>,
    );
    expect(screen.getByTestId('towerstreak').textContent).toContain('Set 1 · fight 7 of 7');
    expect(screen.queryByTestId('towermodal')).toBeNull();
    act(() => routeServerMessage({ ...base, phase: 'won', streak: 7, runWins: 7, best: 7, reward: { money: 2500, items: { rarecandy: 1 } } }, ws));
    expect(useUiStore.getState().modal).toBe('tower');
    // waits under the battle's result card
    expect(screen.queryByTestId('towermodal')).toBeNull();
    act(() => useUiStore.getState().setBattle(null));
    const modal = screen.getByTestId('towermodal');
    expect(modal.dataset['state']).toBe('won');
    expect(within(modal).getByText(/Set 1 complete/)).toBeTruthy();
    expect(within(modal).getByText(/2,500 money/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next fight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retire' }));
    expect(sent.map((x) => x.payload)).toEqual([{ action: 'next' }, { action: 'quit' }]);
  });

  it('a lost run shows its summary; Close clears the run', () => {
    act(() => routeServerMessage({ type: 'towerState', phase: 'lost', streak: 0, runWins: 3, best: 9, set: 1, fight: 4, picks: ['c0', 'c1', 'c2'], reward: null }, ws));
    render(<TowerModal />);
    const modal = screen.getByTestId('towermodal');
    expect(modal.dataset['state']).toBe('lost');
    expect(within(modal).getByText(/This run: 3 wins/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(useUiStore.getState().tower).toBeNull();
    expect(useUiStore.getState().modal).toBe('none');
  });
});
