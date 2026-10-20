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
import { createBattleController, patchFromEvents } from '../src/battle/BattleController';
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
    enterBattle: () => calls.push('enter'), exitBattle: () => calls.push('exit'), setBattler: (r, c, _k, sprite) => calls.push(`battler ${r.side} ${c?.speciesId ?? '-'}${sprite !== undefined ? ` as ${sprite}` : ''}`),
    setPose: (r, p) => calls.push(`pose ${r.side} ${p}`), hurt: () => undefined, vfx: (id) => calls.push(`vfx ${id}`), prewarm: (ids) => calls.push(`prewarm ${ids.length}`), syncFrom: () => calls.push('sync'),
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
    // the resync's answer waits for the timeline: the turn's moves play in full, then the server's state is taken
    c.onBattleResync({ type: 'battleResync', battleId: '00000000-0000-4000-8000-000000000001', state: res.state, stateDigest: digestBattleState(res.state) });
    expect(c.player.isPlaying).toBe(true);
    expect(useUiStore.getState().battle?.authoritative).not.toBe(res.state);
    playOut();
    expect(c.player.isPlaying).toBe(false);
    expect(useUiStore.getState().battle?.authoritative).toBe(res.state);
    expect(useUiStore.getState().battle?.phase).toBe('selecting');
  });

  it('an NPC replacement switch-in (Intimidate) is replayed exactly: the next turn previews without a desync', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    // a turn that knocks the foe's lead out: the NPC's replacement then resolves on its own (core chooses), unpreviewed
    for (let seed = 1; seed < 40; seed++) {
      const { c, sent, calls, playOut } = setup();
      const me = makeCreature(content, content.species('bramblecub'), 40, 'mine-1', 'p0');
      const lead = makeCreature(content, content.species('mossling'), 2, 'foe-1', null);
      const back = { ...makeCreature(content, content.species('gustuff'), 30, 'foe-2', null), ability: 'Intimidate' };
      const { state, events } = startBattle(content, seed, 'trainer', [me], [lead, back]);
      c.onBattleStart({ ...startMsg(state, events), format: 'trainer' });
      playOut();
      const hit = state.sides[0].party[0]!.creature.moves.find((m) => content.move(m.id).power > 0)!;
      const action: Action = { kind: 'move', move: hit.id };
      const t1 = resolveTurn(state, [action, null], content);
      if (!t1.state.sides[1].mustSwitch) continue;
      c.submit(action);
      c.onBattleEvents({ type: 'battleEvents', battleId: id, turn: t1.state.turn, events: t1.events, stateDigest: digestBattleState(t1.state), rng: t1.state.rng });
      const t2 = resolveTurn(t1.state, [null, null], content);
      expect(t2.events.some((e) => e.t === 'statStage' && e.target.side === 0 && e.stat === 'atk')).toBe(true);
      // the events alone miss the Intimidate drop: patching them would drift from the server
      expect(digestBattleState(patchFromEvents(t1.state, t2.events, t2.state.turn, t2.state.rng))).not.toBe(digestBattleState(t2.state));
      // the replacement comes right behind the KO turn (the server resolves it at once): the KO turn plays in full first
      calls.length = 0;
      c.player.step(STEP_MS);
      c.onBattleEvents({ type: 'battleEvents', battleId: id, turn: t2.state.turn, events: t2.events, stateDigest: digestBattleState(t2.state), rng: t2.state.rng });
      expect(digestBattleState(useUiStore.getState().battle!.authoritative)).toBe(digestBattleState(t2.state));
      expect(c.player.isPlaying).toBe(true);
      playOut();
      const faintAt = calls.indexOf('pose 1 faint');
      const enterAt = calls.indexOf('pose 1 enter');
      expect(calls.filter((x) => x.startsWith('vfx impact_')).length).toBeGreaterThan(0);
      expect(faintAt).toBeGreaterThan(-1);
      expect(enterAt).toBeGreaterThan(faintAt);
      expect(useUiStore.getState().battle?.phase).toBe('selecting');
      c.submit(action);
      const t3 = resolveTurn(t2.state, [action, null], content);
      c.onBattleEvents({ type: 'battleEvents', battleId: id, turn: t3.state.turn, events: t3.events, stateDigest: digestBattleState(t3.state), rng: t3.state.rng });
      expect(useUiStore.getState().battle?.desyncs).toBe(0);
      expect(sent.filter((x) => x.type === 'battleResync')).toHaveLength(0);
      return;
    }
    throw new Error('no seed knocked the lead out in one turn');
  });

  it('a pvp turn (no preview) is replayed from its events: one side switches, the other attacks, no resync', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const { c, sent, playOut } = setup();
    const a = makeCreature(content, content.species('bramblecub'), 20, 'a-1', 'p0');
    const a2 = makeCreature(content, content.species('mossling'), 20, 'a-2', 'p0');
    const b = makeCreature(content, content.species('gustuff'), 20, 'b-1', 'p1');
    const { state, events } = startBattle(content, 9, 'pvp', [a, a2], [b]);
    c.onBattleStart({ ...startMsg(state, events), format: 'pvp' });
    playOut();
    const sw: Action = { kind: 'switch', to: 1 };
    c.submit(sw);
    expect(c.preview).toBeNull();
    const foeMove: Action = { kind: 'move', move: state.sides[1].party[0]!.creature.moves.at(-1)!.id };
    const t1 = resolveTurn(state, [sw, foeMove], content);
    c.onBattleEvents({ type: 'battleEvents', battleId: id, turn: t1.state.turn, events: t1.events, stateDigest: digestBattleState(t1.state), rng: t1.state.rng });
    expect(digestBattleState(useUiStore.getState().battle!.authoritative)).toBe(digestBattleState(t1.state));
    expect(useUiStore.getState().battle?.desyncs).toBe(0);
    expect(sent.filter((x) => x.type === 'battleResync')).toHaveLength(0);
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

  it('a battle form: a hollowmane entering below half swaps to its rage sprite on the form frame; a resync keeps it', () => {
    const { c, calls, playOut } = setup();
    const me = makeCreature(content, content.species('bramblecub'), 50, 'mine-1', 'p0');
    const foe = { ...makeCreature(content, content.species('hollowmane'), 58, 'wild-1', null), hp: 20 };
    const { state, events } = startBattle(content, 5, 'wild', [me], [foe]);
    expect(events.some((e) => e.t === 'formChange')).toBe(true);
    expect(state.sides[1].party[0]!.form).toBe('rage');
    c.onBattleStart(startMsg(state, events));
    expect(calls).toContain('battler 1 hollowmane');
    expect(calls).not.toContain('battler 1 hollowmane as hollowmane_rage');
    playOut();
    expect(calls).toContain('battler 1 hollowmane as hollowmane_rage');
    calls.length = 0;
    c.onBattleResync({ type: 'battleResync', battleId: '00000000-0000-4000-8000-000000000001', state, stateDigest: digestBattleState(state) });
    expect(calls).toContain('battler 1 hollowmane as hollowmane_rage');
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
