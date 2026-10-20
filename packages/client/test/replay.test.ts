/**
 * Battle replays (battle/replay.ts): a shared battle is re-simulated with core and checked against its final digest
 * (a tampered or out-of-date replay plans to null); played through the real BattleController it shows the replay bar
 * state step by step, ends on the result card, sends nothing to the server and leaves no prompt; it is refused over an
 * open battle; Exit closes it; a wild side is named after its creature.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { createBattle, createRng, digestBattleState, projectBattler, resolveTurn } from '@ewa/core';
import type { Action, CreateBattleOpts, SideChoice } from '@ewa/core';
import { REPLAY_BATTLE_ID } from '@ewa/protocol';
import type { ReplayData, ServerMessage } from '@ewa/protocol';
import { createBattleController } from '../src/battle/BattleController';
import type { BattleController } from '../src/battle/BattleController';
import { STEP_MS } from '../src/battle/constants';
import { battleActions, setBattleActions } from '../src/battle/controllerRef';
import { isReplayBattle, planReplay, replayLabels, startReplay, stopReplay, useReplayStore } from '../src/battle/replay';
import { useNotificationsStore } from '../src/state/notifications';
import { useUiStore } from '../src/state/ui';
import { makeCreature } from './battleFuzz';

const content = createContentIndex();
const TOKEN = 'AbCdEf_-1234';

/** A wild battle the side-0 player wins by repeating its strongest move, as a shared (anonymised) replay. */
function sharedWild(): ReplayData {
  const me = makeCreature(content, content.species('bramblecub'), 16, 'r:0:0', null);
  const foe = makeCreature(content, content.species('mossling'), 4, 'r:1:0', null);
  const seed = createRng(91).snapshot();
  const start = {
    zoneId: 'mirevale',
    terrain: 'grove',
    sides: [
      { kind: 'player' as const, party: [projectBattler(me, content)], active: 0, trainerId: 'r:0', canFlee: true, canCatch: true },
      { kind: 'wild' as const, party: [projectBattler(foe, content)], active: 0, trainerId: null, canFlee: false, canCatch: false },
    ],
  };
  const opts: CreateBattleOpts = { id: REPLAY_BATTLE_ID, format: 'wild', zoneId: start.zoneId, terrain: 'grove', seed, sides: start.sides };
  let state = createBattle(opts, content).state;
  const strongest = [...me.moves].sort((a, b) => content.move(b.id).power - content.move(a.id).power)[0]!.id;
  const actions: [SideChoice, SideChoice][] = [];
  for (let i = 0; i < 40 && state.ended === null; i++) {
    const a: Action = { kind: 'move', move: strongest };
    actions.push([a, null]);
    state = resolveTurn(state, [a, null], content).state;
  }
  expect(state.ended).not.toBeNull();
  return {
    token: TOKEN, format: 'wild', seat: 0, labels: ['ash', null], result: 'win', turns: state.turn,
    happenedAt: '2026-10-20T10:00:00.000Z', seed: [...seed] as ReplayData['seed'], start: start as unknown as ReplayData['start'],
    actions: actions as unknown as ReplayData['actions'], finalDigest: digestBattleState(state),
  };
}

function controller(): { c: BattleController; sent: string[]; playOut: () => void; inject: (m: ServerMessage) => void; defer: (fn: () => void) => void; flush: () => void } {
  const sent: string[] = [];
  // the replay delivers each message on a later task: a manual queue the test drains
  const queue: (() => void)[] = [];
  const defer = (fn: () => void): void => void queue.push(fn);
  const flush = (): void => {
    while (queue.length > 0) queue.shift()!();
  };
  const c = createBattleController({
    content, send: (type) => sent.push(type), reduced: () => false, instantText: () => true, selfPosition: () => ({ x: 0, z: 0 }),
    summaryAt: () => null, selfId: () => 'viewer', raidId: () => null, view: null, defer: (fn) => fn(),
  });
  setBattleActions({ submit: (a) => c.submit(a), check: (a) => c.check(a), dismissResult: () => c.dismissResult() });
  const inject = (m: ServerMessage): void => {
    if (m.type === 'battleStart') c.onBattleStart(m);
    else if (m.type === 'battleEvents') c.onBattleEvents(m);
    else if (m.type === 'battleEnd') c.onBattleEnd(m);
  };
  const playOut = (): void => {
    for (let i = 0; i < 4000 && c.player.isPlaying; i++) c.player.step(STEP_MS);
  };
  return { c, sent, playOut, inject, defer, flush };
}

beforeEach(() => {
  stopReplay();
  useUiStore.getState().reset();
  useNotificationsStore.getState().clear();
});

describe('battle replays', () => {
  it('plans a shared battle to its final digest; a tampered digest or action plans to null', () => {
    const data = sharedWild();
    const plan = planReplay(data, content);
    expect(plan).not.toBeNull();
    expect(plan!.battleId).toBe(`replay:${TOKEN}`);
    expect(isReplayBattle(plan!.battleId)).toBe(true);
    expect(plan!.steps).toHaveLength(data.actions.length);
    expect(plan!.steps.at(-1)!.digest).toBe(data.finalDigest);
    expect(planReplay({ ...data, finalDigest: '00000000' }, content)).toBeNull();
    expect(planReplay({ ...data, actions: [[{ kind: 'move', move: 'not_a_move' }, null]] }, content)).toBeNull();
    expect(replayLabels(data, plan!, (id) => content.species(id).name)).toEqual(['ash', `Wild ${content.species('mossling').name}`]);
  });

  it('plays every step through the controller, then the result card; nothing is sent, no prompt queued', () => {
    const data = sharedWild();
    const { sent, playOut, inject, defer, flush } = controller();
    expect(startReplay(data, { content, inject, defer, speciesName: (id) => content.species(id).name })).toBe(true);
    expect(useUiStore.getState().battle?.battleId).toBe(`replay:${TOKEN}`);
    expect(useReplayStore.getState().replay).toMatchObject({ shown: 0, total: data.actions.length, labels: ['ash', `Wild ${content.species('mossling').name}`] });
    for (let i = 0; i < 100 && useUiStore.getState().battle?.result == null; i++) {
      playOut();
      // the last step's timeline plays in full before the result card (the battleEnd waits for it)
      if (useUiStore.getState().battle?.result != null) break;
      flush();
    }
    const b = useUiStore.getState().battle!;
    expect(b.result).not.toBeNull();
    expect(b.result!.outcome.winner).toBe(0);
    expect(b.log.some((l) => /fainted/i.test(l.text))).toBe(true);
    expect(useReplayStore.getState().replay?.shown).toBe(data.actions.length);
    expect(sent).toEqual([]);
    expect(b.result!.prompts).toBe(0);
    // Back to the world: the battle closes and the replay is over
    battleActions()!.dismissResult();
    expect(useUiStore.getState().battle).toBeNull();
    expect(useReplayStore.getState().replay).toBeNull();
    expect(useUiStore.getState().prompts).toEqual([]);
  });

  it('pause holds the next step until resumed; Exit closes the battle', () => {
    const data = sharedWild();
    const { playOut, inject, defer, flush } = controller();
    startReplay(data, { content, inject, defer, speciesName: (id) => content.species(id).name });
    useReplayStore.getState().set({ ...useReplayStore.getState().replay!, paused: true });
    playOut();
    flush();
    expect(useReplayStore.getState().replay?.shown).toBe(0);
    useReplayStore.getState().set({ ...useReplayStore.getState().replay!, paused: false });
    expect(useReplayStore.getState().replay?.shown).toBe(0);
    flush();
    expect(useReplayStore.getState().replay?.shown).toBe(1);
    stopReplay();
    expect(useUiStore.getState().battle).toBeNull();
    expect(useReplayStore.getState().replay).toBeNull();
  });

  it('is refused while a battle is open, and when the replay does not reproduce', () => {
    const data = sharedWild();
    const { inject } = controller();
    expect(startReplay({ ...data, finalDigest: 'ffffffff' }, { content, inject, speciesName: (id) => id })).toBe(false);
    expect(useUiStore.getState().battle).toBeNull();
    expect(startReplay(data, { content, inject, speciesName: (id) => id })).toBe(true);
    expect(startReplay(data, { content, inject, speciesName: (id) => id })).toBe(false);
    expect(useNotificationsStore.getState().toasts.at(-1)?.text).toBe('Finish the battle first.');
    expect(startReplay(data, { content, inject: undefined, speciesName: (id) => id })).toBe(false);
  });
});
