/**
 * §20.5.5 BattleController: battleStart → the createBattle events play, then 'selecting'; submit validates locally,
 * sends `battleAction { turn: state.turn + 1 }` and computes the null-passing preview; a matching `battleEvents`
 * digest adopts the preview state (no desync), a mismatching one counts a desync and sends `battleResync` while the
 * server's events still play; HP bars follow `hpAfter`; `battleEnd` shows the result after the timeline and dismissing
 * it clears `ui.battle` and queues the evolve / learn-move prompts; nothing here writes the session. The seat-1 player
 * of a pvp battle sees their own creature at the near stage position with the numbered bar.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { digestBattleState, resolveTurn } from '@ewa/core';
import type { Action, BattleState } from '@ewa/core';
import type { ServerMessageOf } from '@ewa/protocol';
import { createBattleController } from '../src/battle/BattleController';
import type { BattleController, BattleView } from '../src/battle/BattleController';
import type { BattleHudModel } from '../src/battle/BattleHud';
import { STEP_MS } from '../src/battle/constants';
import { stageRef } from '../src/battle/TimelinePlayer';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { makeCreature, startBattle } from './battleFuzz';

const content = createContentIndex();

function setup() {
  const sent: { type: string; payload: unknown }[] = [];
  let hud: BattleHudModel | null = null;
  const calls: string[] = [];
  const view: BattleView = {
    enterBattle: () => calls.push('enter'), exitBattle: () => calls.push('exit'), setBattler: (r, c) => calls.push(`battler ${r.side} ${c?.speciesId ?? '-'}`),
    setPose: () => undefined, hurt: () => undefined, vfx: () => undefined, prewarm: (ids) => calls.push(`prewarm ${ids.length}`), syncFrom: () => calls.push('sync'),
    setWeather: () => undefined, cue: () => undefined, shake: () => undefined, setTimeScale: () => undefined, hitstopEnabled: () => true,
    slowmoEnabled: () => true, playSfx: () => undefined, setBattleHud: (m) => (hud = m), setThreat: () => undefined,
  };
  const c: BattleController = createBattleController({
    content, send: (type, payload) => sent.push({ type, payload }), reduced: () => false, instantText: () => true,
    selfPosition: () => ({ x: 1, z: 2 }), summaryAt: () => null, selfId: () => 'p0', raidId: () => null, view, defer: (fn) => fn(),
  });
  const playOut = (): void => {
    for (let i = 0; i < 2000 && c.player.isPlaying; i++) c.player.step(STEP_MS);
  };
  return { c, sent, calls, playOut, hud: () => hud };
}

function wild(): { state: BattleState; events: ServerMessageOf<'battleStart'>['events'] } {
  const me = makeCreature(content, content.species('bramblecub'), 12, 'mine-1', 'p0');
  const foe = makeCreature(content, content.species('mossling'), 5, 'wild-1', null);
  return startBattle(content, 77, 'wild', [me], [foe]);
}

function startMsg(state: BattleState, events: ServerMessageOf<'battleStart'>['events']): ServerMessageOf<'battleStart'> {
  return { type: 'battleStart', battleId: '00000000-0000-4000-8000-000000000001', format: 'wild', seat: 0, state, events, stateDigest: digestBattleState(state) };
}

beforeEach(() => {
  useUiStore.getState().reset();
  useNotificationsStore.getState().clear();
});

describe('BattleController', () => {
  it('battleStart dresses the battle, plays the switch-ins, then selecting', () => {
    const { c, calls, playOut, hud } = setup();
    const { state, events } = wild();
    c.onBattleStart(startMsg(state, events));
    expect(useUiStore.getState().battle?.phase).toBe('playing');
    expect(calls).toContain('enter');
    expect(calls).toContain('battler 0 bramblecub');
    expect(calls).toContain('battler 1 mossling');
    playOut();
    expect(useUiStore.getState().battle?.phase).toBe('selecting');
    expect(useUiStore.getState().battle?.turnLabel).toBe('Turn 1');
    expect(hud()?.bars[1]!.name).toBe('The wild Mossling');
  });

  it('Phase A: battleStart x / z / yaw (a hall arena) are the arena centre, ahead of the BattleSummary patch', () => {
    const entered: unknown[] = [];
    const view: BattleView = {
      enterBattle: (s) => entered.push(s), exitBattle: () => undefined, setBattler: () => undefined, setPose: () => undefined, hurt: () => undefined,
      vfx: () => undefined, prewarm: () => undefined, syncFrom: () => undefined, setWeather: () => undefined, cue: () => undefined, shake: () => undefined,
      setTimeScale: () => undefined, hitstopEnabled: () => true, slowmoEnabled: () => true, playSfx: () => undefined, setBattleHud: () => undefined,
      setThreat: () => undefined,
    };
    let summary: { x: number; z: number } | null = null;
    const c = createBattleController({
      content, send: () => undefined, reduced: () => false, instantText: () => true, selfPosition: () => ({ x: 1, z: 2 }),
      summaryAt: () => summary, selfId: () => 'p0', raidId: () => null, view, defer: (fn) => fn(),
    });
    const { state, events } = wild();
    c.onBattleStart({ ...startMsg(state, events), x: -51, z: -2.4, yaw: Math.PI / 2 });
    expect(entered.at(-1)).toMatchObject({ x: -51, z: -2.4, yaw: Math.PI / 2, foeId: null, foeNpc: null });
    // a re-attach (the renderer came back) keeps the message's arena even once the summary has arrived elsewhere
    summary = { x: 9, z: 9 };
    c.attach(view);
    expect(entered.at(-1)).toMatchObject({ x: -51, z: -2.4, yaw: Math.PI / 2 });
    c.reset();
    // without x / z (an older server): the summary, else the predicted self position; no hall yaw
    summary = null;
    c.onBattleStart(startMsg(state, events));
    expect(entered.at(-1)).toMatchObject({ x: 1, z: 2, yaw: null });
  });

  it('submit: local validation, battleAction with turn + 1, preview digest matches → authoritative adopted', () => {
    const { c, sent, playOut, hud } = setup();
    const { state, events } = wild();
    c.onBattleStart(startMsg(state, events));
    playOut();
    c.submit({ kind: 'move', move: 'Nope' } as Action);
    expect(sent).toHaveLength(0);
    expect(useNotificationsStore.getState().toasts.at(-1)?.text).toBe('Unknown move');
    const action: Action = { kind: 'move', move: state.sides[0].party[0]!.creature.moves[0]!.id };
    c.submit(action);
    expect(sent[0]).toEqual({ type: 'battleAction', payload: { battleId: '00000000-0000-4000-8000-000000000001', turn: state.turn + 1, action } });
    expect(useUiStore.getState().battle?.phase).toBe('submitted');
    expect(c.preview).not.toBeNull();
    // the server resolves the same turn
    const res = resolveTurn(state, [action, null], content);
    c.onBattleEvents({ type: 'battleEvents', battleId: '00000000-0000-4000-8000-000000000001', turn: res.state.turn, events: res.events, stateDigest: digestBattleState(res.state), rng: res.state.rng });
    expect(useUiStore.getState().battle?.desyncs).toBe(0);
    expect(sent.filter((s) => s.type === 'battleResync')).toHaveLength(0);
    expect(digestBattleState(useUiStore.getState().battle!.authoritative)).toBe(digestBattleState(res.state));
    playOut();
    // HP bars follow hpAfter: the last damage to side 1 is what the bar shows
    const lastFoeHit = [...res.events].reverse().find((e) => e.t === 'damage' && e.target.side === 1);
    if (lastFoeHit !== undefined && lastFoeHit.t === 'damage') expect(hud()?.bars[1]!.hp).toBe(lastFoeHit.hpAfter);
    const phase = useUiStore.getState().battle?.phase;
    expect(phase === 'selecting' || phase === 'ended').toBe(true);
  });

  it('a mismatching digest counts a desync, sends battleResync, and still plays the server events', () => {
    const { c, sent, playOut } = setup();
    const { state, events } = wild();
    c.onBattleStart(startMsg(state, events));
    playOut();
    const action: Action = { kind: 'move', move: state.sides[0].party[0]!.creature.moves[0]!.id };
    c.submit(action);
    const res = resolveTurn(state, [action, null], content);
    c.onBattleEvents({ type: 'battleEvents', battleId: '00000000-0000-4000-8000-000000000001', turn: res.state.turn, events: res.events, stateDigest: '00000000', rng: res.state.rng });
    expect(useUiStore.getState().battle?.desyncs).toBe(1);
    expect(sent.at(-1)).toEqual({ type: 'battleResync', payload: { battleId: '00000000-0000-4000-8000-000000000001' } });
    expect(c.player.isPlaying).toBe(true);
    c.onBattleResync({ type: 'battleResync', battleId: '00000000-0000-4000-8000-000000000001', state: res.state, stateDigest: digestBattleState(res.state) });
    expect(c.player.isPlaying).toBe(false);
    expect(useUiStore.getState().battle?.authoritative).toBe(res.state);
  });

  it('evolve / learn-move prompts from EVERY turn of the battle, own side only, deduplicated, queued after the card', () => {
    const { c, playOut } = setup();
    const { state, events } = wild();
    const id = '00000000-0000-4000-8000-000000000001';
    c.onBattleStart(startMsg(state, events));
    playOut();
    const mine = state.sides[0].party[0]!.creature.id;
    const A = { side: 0 as const, slot: 0 };
    const F = { side: 1 as const, slot: 0 };
    // turn 1 (not the last): a level-up that learns a move and reaches the evolution level — a trainer battle's
    // first KO; the foe's own learnMove is not the player's prompt
    const t1 = [
      { t: 'learnMove' as const, who: A, move: 'Leaf Blade', level: 6 },
      { t: 'evolveReady' as const, who: A, into: 'briarbear' },
      { t: 'learnMove' as const, who: F, move: 'Nature Drain', level: 6 },
      { t: 'turnEnd' as const, turn: 1 },
    ];
    c.onBattleEvents({ type: 'battleEvents', battleId: id, turn: 1, events: t1, stateDigest: '00000000', rng: state.rng });
    playOut();
    // turn 2 (the last): core repeats evolveReady on every exp gain past the level — one prompt, not two
    const t2 = [{ t: 'evolveReady' as const, who: A, into: 'briarbear' }, { t: 'turnEnd' as const, turn: 2 }];
    c.onBattleEvents({ type: 'battleEvents', battleId: id, turn: 2, events: t2, stateDigest: '00000000', rng: state.rng });
    c.onBattleEnd({ type: 'battleEnd', battleId: id, outcome: { winner: 0 }, rewards: { money: 0, items: {}, trainerExp: 10, ratingDelta: null, badge: null } });
    playOut();
    expect(useUiStore.getState().battle?.result?.prompts).toBe(2);
    expect(useUiStore.getState().prompts).toEqual([]); // nothing before the card is dismissed
    c.dismissResult();
    expect(useUiStore.getState().prompts).toEqual([
      { kind: 'learnMove', creatureId: mine, move: 'Leaf Blade' },
      { kind: 'evolve', creatureId: mine, into: 'briarbear' },
    ]);
  });

  it('battleEnd waits for the timeline, then the result card; dismiss clears ui.battle; no session write', () => {
    const { c, calls, playOut } = setup();
    const sessionBefore = useSessionStore.getState();
    const { state, events } = wild();
    c.onBattleStart(startMsg(state, events));
    playOut();
    const flee: Action = { kind: 'flee' };
    c.submit(flee);
    const res = resolveTurn(state, [flee, null], content);
    c.onBattleEvents({ type: 'battleEvents', battleId: '00000000-0000-4000-8000-000000000001', turn: res.state.turn, events: res.events, stateDigest: digestBattleState(res.state), rng: res.state.rng });
    c.onBattleEnd({ type: 'battleEnd', battleId: '00000000-0000-4000-8000-000000000001', outcome: res.state.ended ?? { winner: 'fled' }, rewards: { money: 0, items: {}, trainerExp: 0, ratingDelta: null, badge: null } });
    expect(useUiStore.getState().battle?.result).toBeNull();
    playOut();
    expect(useUiStore.getState().battle?.result).not.toBeNull();
    expect(useUiStore.getState().battle?.phase).toBe('ended');
    c.dismissResult();
    expect(useUiStore.getState().battle).toBeNull();
    expect(calls).toContain('exit');
    expect(useSessionStore.getState().inventory).toBe(sessionBefore.inventory);
    expect(useSessionStore.getState().progression).toBe(sessionBefore.progression);
  });

  it('a battleResync with no battle open restores the battle (reload mid-battle) without an intro', () => {
    const { c, calls } = setup();
    const { state } = wild();
    c.onBattleResync({ type: 'battleResync', battleId: '00000000-0000-4000-8000-000000000009', state, stateDigest: digestBattleState(state) });
    const b = useUiStore.getState().battle;
    expect(b?.battleId).toBe('00000000-0000-4000-8000-000000000009');
    expect(b?.phase).toBe('selecting');
    expect(calls).toContain('enter');
    expect(c.player.isPlaying).toBe(false);
  });

  it('pvp seat 1: own creature at the near stage position (render side 0) with the numbered bar', () => {
    const { c, calls, playOut, hud } = setup();
    const foe = makeCreature(content, content.species('bramblecub'), 8, 'foe-1', 'p0');
    const me = makeCreature(content, content.species('mossling'), 8, 'mine-1', 'p1');
    const { state, events } = startBattle(content, 5, 'pvp', [foe], [me]);
    c.onBattleStart({ ...startMsg(state, events), format: 'pvp', seat: 1 });
    expect(calls).toContain('battler 0 mossling');
    expect(calls).toContain('battler 1 bramblecub');
    playOut();
    const bars = hud()!.bars;
    expect(bars[0]!.who.side).toBe(0);
    expect(bars[0]!.name).toBe('Mossling');
    expect(bars[0]!.showNumbers).toBe(true);
    expect(bars[1]!.showNumbers).toBe(false);
    expect(stageRef({ side: 1, slot: 3 }, 1)).toEqual({ side: 0, slot: 0 });
    expect(stageRef({ side: 0, slot: 0 }, 1)).toEqual({ side: 1, slot: 0 });
    expect(stageRef({ side: 0, slot: 2 })).toEqual({ side: 0, slot: 0 });
  });
});
