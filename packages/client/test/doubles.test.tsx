// @vitest-environment jsdom
/**
 * Phase D6 doubles in the client:
 * - the controller: four battlers on the stage (render slot = field position) and four HUD bars (two in singles);
 *   position 0 then position 1 pick (recorded, Back re-opens position 0), then two `battleAction` messages with
 *   `pos` 0 and 1 and the `[[a0, a1], null]` preview whose digest the server's events match;
 * - the timeline: a core ref (party index) reaches the stage at its field position — damage on the foe party index
 *   standing on position 1 hurts stage ref { side 1, slot 1 } and moves bar 4; a switch-in at position 1 swaps the
 *   creature shown at stage slot 1 and later frames for it address slot 1;
 * - the menu: a single-target move opens target selection (both foes and the ally, never the user), a spread move
 *   does not; the prompt names the creature choosing.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { createBattle, digestBattleState, projectBattler, resolveTurn } from '@ewa/core';
import type { Action, BattleEvent, BattleFormat, BattleState, CreatureInstance } from '@ewa/core';
import type { ServerMessageOf } from '@ewa/protocol';
import { createBattleController } from '../src/battle/BattleController';
import type { BattleController, BattleView } from '../src/battle/BattleController';
import type { BattleHudModel } from '../src/battle/BattleHud';
import { BattleMenu } from '../src/battle/BattleMenu';
import { STEP_MS } from '../src/battle/constants';
import { setBattleActions } from '../src/battle/controllerRef';
import { buildTimeline } from '../src/battle/timeline';
import { createMoveAnimRegistry } from '../src/battle/moveAnims';
import { useNotificationsStore } from '../src/state/notifications';
import { useUiStore } from '../src/state/ui';
import { makeCreature, startBattle } from './battleFuzz';

const content = createContentIndex();
const BID = '00000000-0000-4000-8000-0000000000d6';
const MOVES = ['Tackle', 'Rock Slide', 'Growl', 'Bulk Up'];

function mon(species: string, level: number, id: string, owner: string | null): CreatureInstance {
  const c = makeCreature(content, content.species(species), level, id, owner);
  return { ...c, moves: MOVES.map((m) => ({ id: m, pp: content.move(m).pp, ppMax: content.move(m).pp })) };
}

/** A doubles trainer battle: three of ours vs three NPC creatures; side 1 leads with party 0 and 2 (actives [0, 2]). */
function doubles(format: BattleFormat = 'trainer'): { state: BattleState; events: readonly BattleEvent[] } {
  const p0 = [mon('bramblecub', 30, 'm-0', 'p0'), mon('mossling', 30, 'm-1', 'p0'), mon('bramblecub', 28, 'm-2', 'p0')];
  const p1 = [mon('mossling', 20, 'f-0', null), mon('bramblecub', 20, 'f-1', null), mon('mufflo', 20, 'f-2', null)];
  const side = (party: CreatureInstance[], kind: 'player' | 'npc', id: string, actives: [number, number]) => ({
    kind, party: party.map((c) => projectBattler(c, content)), active: actives[0], actives, trainerId: id, canFlee: false, canCatch: false,
  });
  const r = createBattle(
    { id: 'd6', format, zoneId: 'mirevale', terrain: 'grove', seed: 606, slots: 2, sides: [side(p0, 'player', 'p0', [0, 1]), side(p1, 'npc', 'npc_trainer', [0, 2])] },
    content,
  );
  return { state: r.state, events: r.events };
}

function startMsg(state: BattleState, events: readonly BattleEvent[], format: BattleFormat = 'trainer'): ServerMessageOf<'battleStart'> {
  return { type: 'battleStart', battleId: BID, format, seat: 0, state, events: [...events], stateDigest: digestBattleState(state) };
}

function setup() {
  const sent: { type: string; payload: unknown }[] = [];
  const calls: string[] = [];
  let hud: BattleHudModel | null = null;
  const ref = (r: { side: number; slot: number } | null): string => (r === null ? '-' : `${r.side}:${r.slot}`);
  const view: BattleView = {
    enterBattle: () => calls.push('enter'), exitBattle: () => calls.push('exit'),
    setBattler: (r, c) => calls.push(`battler ${ref(r)} ${c?.id ?? '-'}`),
    setPose: (r, p) => calls.push(`pose ${ref(r)} ${p}`), hurt: (r) => calls.push(`hurt ${ref(r)}`),
    vfx: (id, f, t) => calls.push(`vfx ${id} ${ref(f)} ${ref(t)}`), prewarm: () => undefined, syncFrom: (hp) => calls.push(`sync ${hp.map((h) => ref(h.ref)).join(',')}`),
    setWeather: () => undefined, cue: () => undefined, shake: () => undefined, setTimeScale: () => undefined, hitstopEnabled: () => false,
    slowmoEnabled: () => false, playSfx: () => undefined, setBattleHud: (m) => (hud = m), setThreat: () => undefined,
  };
  const c: BattleController = createBattleController({
    content, send: (type, payload) => sent.push({ type, payload }), reduced: () => false, instantText: () => true,
    selfPosition: () => ({ x: 0, z: 0 }), summaryAt: () => null, selfId: () => 'p0', raidId: () => null, view, defer: (fn) => fn(),
  });
  setBattleActions({ submit: (a) => c.submit(a), check: (a) => c.check(a), dismissResult: () => c.dismissResult(), undoPick: () => c.undoPick() });
  const playOut = (): void => {
    for (let i = 0; i < 4000 && c.player.isPlaying; i++) c.player.step(STEP_MS);
  };
  return { c, sent, calls, playOut, hud: () => hud };
}

beforeEach(() => {
  useUiStore.getState().reset();
  useNotificationsStore.getState().clear();
});
afterEach(() => {
  cleanup();
  setBattleActions(null);
});

describe('Phase D6 BattleController (doubles)', () => {
  it('four battlers on the stage and four HUD bars; singles keeps two', () => {
    const { c, calls, playOut, hud } = setup();
    const { state, events } = doubles();
    c.onBattleStart(startMsg(state, events));
    // stage slot = field position: side 1 shows party 0 on slot 0 and party 2 on slot 1
    expect(calls).toContain('battler 0:0 m-0');
    expect(calls).toContain('battler 0:1 m-1');
    expect(calls).toContain('battler 1:0 f-0');
    expect(calls).toContain('battler 1:1 f-2');
    playOut();
    const bars = hud()!.bars;
    expect(bars).toHaveLength(4);
    expect(bars.map((b) => `${b.who.side}:${b.who.slot}`)).toEqual(['0:0', '0:1', '1:0', '1:1']);
    expect(bars.map((b) => b.showNumbers)).toEqual([true, true, false, false]);
    expect(bars[1]!.name).toBe('Mossling');
    expect(bars[3]!.name).toBe('The foe’s Mufflo');
    expect(useUiStore.getState().battle).toMatchObject({ phase: 'selecting', pick: { pos: 0, picks: [null, null] } });

    // singles: two bars, no pick
    const s = setup();
    const me = makeCreature(content, content.species('bramblecub'), 12, 'mine-1', 'p0');
    const foe = makeCreature(content, content.species('mossling'), 5, 'wild-1', null);
    const single = startBattle(content, 77, 'wild', [me], [foe]);
    s.c.onBattleStart({ ...startMsg(single.state, single.events, 'wild'), format: 'wild' });
    s.playOut();
    expect(s.hud()!.bars).toHaveLength(2);
    expect(useUiStore.getState().battle!.pick).toBeUndefined();
  });

  it('position 0 then 1: recorded, Back re-opens position 0, then two battleAction { pos } and the [[a0, a1], null] preview', () => {
    const { c, sent, playOut } = setup();
    const { state, events } = doubles();
    c.onBattleStart(startMsg(state, events));
    playOut();
    const a0: Action = { kind: 'move', move: 'Tackle', target: { side: 1, pos: 1 } };
    const a1: Action = { kind: 'move', move: 'Rock Slide' };
    // a move aimed at its own user is refused locally
    expect(c.check({ kind: 'move', move: 'Tackle', target: { side: 0, pos: 0 } })).toBe('Not a target');
    c.submit(a0);
    expect(sent).toHaveLength(0);
    expect(useUiStore.getState().battle).toMatchObject({ phase: 'selecting', pick: { pos: 1, picks: [a0, null] } });
    // Back: position 0 picks again
    c.undoPick();
    expect(useUiStore.getState().battle!.pick).toEqual({ pos: 0, picks: [null, null] });
    c.submit(a0);
    // the other position may not switch to the creature position 0 already chose
    const sw: Action = { kind: 'switch', to: 2 };
    expect(c.check(sw)).toBeNull();
    c.submit(a1);
    expect(sent).toEqual([
      { type: 'battleAction', payload: { battleId: BID, turn: state.turn + 1, action: a0, pos: 0 } },
      { type: 'battleAction', payload: { battleId: BID, turn: state.turn + 1, action: a1, pos: 1 } },
    ]);
    expect(useUiStore.getState().battle!.phase).toBe('submitted');
    expect(c.preview).not.toBeNull();
    const res = resolveTurn(state, [[a0, a1], null], content);
    expect(c.preview!.digest).toBe(digestBattleState(res.state));
    c.onBattleEvents({ type: 'battleEvents', battleId: BID, turn: res.state.turn, events: res.events, stateDigest: digestBattleState(res.state), rng: res.state.rng });
    expect(useUiStore.getState().battle!.desyncs).toBe(0);
    expect(sent.filter((m) => m.type === 'battleResync')).toHaveLength(0);
    playOut();
    expect(useUiStore.getState().battle!.authoritative.turn).toBe(1);
  });

  it('two switches to the same creature are refused for the second position', () => {
    const { c, sent, playOut } = setup();
    const { state, events } = doubles();
    c.onBattleStart(startMsg(state, events));
    playOut();
    c.submit({ kind: 'switch', to: 2 });
    expect(c.check({ kind: 'switch', to: 2 })).toBe('Already chosen');
    c.submit({ kind: 'switch', to: 2 });
    expect(sent).toHaveLength(0);
    expect(useUiStore.getState().battle!.pick!.pos).toBe(1);
  });

  it('replacement phase: one pick per required position — only the fainted position 1 picks, one battleAction { pos: 1 }', () => {
    const { c, sent, playOut, calls } = setup();
    const { state, events } = doubles();
    c.onBattleStart(startMsg(state, events));
    playOut();
    // position 1 (party 1) fainted; the bench (party 2) must replace it
    const s0 = state.sides[0];
    const party = s0.party.map((b, i) => (i === 1 ? { ...b, creature: { ...b.creature, hp: 0 } } : b));
    const down: BattleState = { ...state, sides: [{ ...s0, party, mustSwitch: true }, state.sides[1]] };
    calls.length = 0;
    c.onBattleResync({ type: 'battleResync', battleId: BID, state: down });
    expect(calls).toContain('sync 0:0,0:1,1:0,1:1');
    expect(useUiStore.getState().battle).toMatchObject({ phase: 'replacement', pick: { pos: 1, picks: [null, null] } });
    expect(c.check({ kind: 'move', move: 'Tackle' })).not.toBeNull();
    c.submit({ kind: 'switch', to: 2 });
    expect(sent).toEqual([{ type: 'battleAction', payload: { battleId: BID, turn: state.turn + 1, action: { kind: 'switch', to: 2 }, pos: 1 } }]);
    expect(c.preview).not.toBeNull();
    expect(c.preview!.state.sides[0].actives).toEqual([0, 2]);
  });

  it('timeline: party index → field position — damage on the foe at position 1 hurts stage {1,1}; a switch-in at pos 1 swaps slot 1', () => {
    const { c, calls, playOut, hud } = setup();
    const { state, events } = doubles('pvp');
    c.onBattleStart({ ...startMsg(state, events, 'pvp'), format: 'pvp' });
    playOut();
    calls.length = 0;
    const foe2 = state.sides[1].party[2]!;
    const turn: BattleEvent[] = [
      { t: 'turnStart', turn: 1 },
      { t: 'moveUsed', who: { side: 0, slot: 0 }, move: 'Tackle', target: { side: 1, slot: 2 }, ppLeft: 34 },
      { t: 'damage', target: { side: 1, slot: 2 }, amount: 5, hpAfter: foe2.creature.hp - 5, maxHp: foe2.maxHp, effectiveness: 1, crit: false, stab: false, cause: 'move', source: { side: 0, slot: 0 }, move: 'Tackle' },
      { t: 'switchOut', who: { side: 1, slot: 2 }, reason: 'action', pos: 1 },
      { t: 'switchIn', who: { side: 1, slot: 1 }, pos: 1 },
      { t: 'damage', target: { side: 1, slot: 1 }, amount: 3, hpAfter: state.sides[1].party[1]!.creature.hp - 3, maxHp: state.sides[1].party[1]!.maxHp, effectiveness: 1, crit: false, stab: false, cause: 'move', source: { side: 0, slot: 1 }, move: 'Tackle' },
      { t: 'turnEnd', turn: 1 },
    ];
    c.onBattleEvents({ type: 'battleEvents', battleId: BID, turn: 1, events: turn, stateDigest: '00000000', rng: state.rng });
    for (let i = 0; i < 40 && !calls.includes('hurt 1:1'); i++) c.player.step(STEP_MS);
    // the first damage (party 2, standing on position 1) is drawn on stage slot 1 and moves the 4th bar
    expect(calls).toContain('vfx impact_normal 0:0 1:1');
    expect(calls).toContain('hurt 1:1');
    expect(calls).not.toContain('hurt 1:0');
    playOut();
    // the switch-in at position 1 replaced the creature shown there; the later hit on party 1 also lands on slot 1
    expect(calls).toContain('battler 1:1 f-1');
    expect(calls.filter((x) => x === 'hurt 1:1').length).toBeGreaterThanOrEqual(2);
    expect(calls.filter((x) => x.startsWith('battler 1:0'))).toHaveLength(0);
    const bars = hud()!.bars;
    expect(bars[3]!.name).toBe('The foe’s Bramblecub');
    expect(bars[3]!.hp).toBe(state.sides[1].party[1]!.creature.hp - 3);
    expect(bars[2]!.hp).toBe(state.sides[1].party[0]!.creature.hp);
    // pvp: no preview; the patched state moved actives with the switch-in
    expect(useUiStore.getState().battle!.authoritative.sides[1].actives).toEqual([0, 1]);
  });

  it('buildTimeline (doubles): idles address both standing positions; a switch-in pose carries its pos; singles frames have no pos', () => {
    const { state, events } = doubles();
    const ctx = {
      content, registry: createMoveAnimRegistry(), reduced: false,
      speciesOf: (r: { side: 0 | 1; slot: number }) => state.sides[r.side].party[r.slot]!.creature.speciesId,
      activesOf: (side: 0 | 1) => state.sides[side].actives,
    };
    const tl = buildTimeline(events, ctx);
    const enters = tl.frames.filter((f) => f.k === 'pose' && f.pose === 'enter');
    expect(enters.map((f) => (f.k === 'pose' ? `${f.who.side}:${f.who.slot}@${String(f.pos)}` : ''))).toEqual(['0:0@0', '0:1@1', '1:0@0', '1:2@1']);
    const idle = buildTimeline([{ t: 'turnStart', turn: 1 }], ctx).frames.filter((f) => f.k === 'pose');
    expect(idle.map((f) => (f.k === 'pose' ? `${f.who.side}:${f.who.slot}` : ''))).toEqual(['0:0', '0:1', '1:0', '1:2']);
    const me = makeCreature(content, content.species('bramblecub'), 12, 'mine-1', 'p0');
    const foe = makeCreature(content, content.species('mossling'), 5, 'wild-1', null);
    const single = startBattle(content, 77, 'wild', [me], [foe]);
    const st = buildTimeline(single.events, { content, registry: createMoveAnimRegistry(), reduced: false, speciesOf: (r) => single.state.sides[r.side].party[r.slot]!.creature.speciesId });
    for (const f of st.frames) if (f.k === 'pose') expect('pos' in f).toBe(false);
  });
});

describe('Phase D6 BattleMenu (doubles)', () => {
  function open() {
    const t = setup();
    const { state, events } = doubles();
    t.c.onBattleStart(startMsg(state, events));
    t.playOut();
    render(<BattleMenu />);
    return { ...t, state };
  }

  it('a single-target move asks for a target (both foes + the ally); a spread move does not; Back to position 0', () => {
    const { sent } = open();
    expect(screen.getByTestId('battlemenu').textContent).toContain('What will Bramblecub do? (1/2)');
    fireEvent.click(screen.getByRole('button', { name: /Fight/ }));
    const moveButton = (id: string): HTMLElement => screen.getAllByTestId('movebutton').find((b) => b.textContent?.includes(id))!;
    // Tackle: target selection — two foes and the ally, never the user
    fireEvent.click(moveButton('Tackle'));
    const list = screen.getByTestId('battle-targets');
    const rows = list.querySelectorAll('button');
    expect(rows).toHaveLength(3);
    expect(list.textContent).toContain('Mossling');
    expect(list.textContent).toContain('Mufflo');
    expect(list.textContent).toContain('Ally');
    expect(sent).toHaveLength(0);
    // Escape → back to the moves; a spread move (Rock Slide) goes straight through, no target list
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByTestId('battle-targets')).toBeNull();
    fireEvent.click(moveButton('Rock Slide'));
    expect(screen.queryByTestId('battle-targets')).toBeNull();
    expect(useUiStore.getState().battle!.pick).toEqual({ pos: 1, picks: [{ kind: 'move', move: 'Rock Slide' }, null] });
    expect(screen.getByTestId('battlemenu').textContent).toContain('What will Mossling do? (2/2)');
    // the self move (Bulk Up) needs no target either — but first Back to position 0 and re-pick it there
    fireEvent.click(screen.getByRole('button', { name: 'Back to Bramblecub' }));
    expect(useUiStore.getState().battle!.pick).toEqual({ pos: 0, picks: [null, null] });
    fireEvent.click(screen.getByRole('button', { name: /Fight/ }));
    fireEvent.click(moveButton('Bulk Up'));
    expect(screen.queryByTestId('battle-targets')).toBeNull();
    // position 1: Tackle at the foe on position 1 → both actions go out
    fireEvent.click(screen.getByRole('button', { name: /Fight/ }));
    fireEvent.click(moveButton('Tackle'));
    const foeRow = [...screen.getByTestId('battle-targets').querySelectorAll('button')].find((b) => b.textContent?.includes('Mufflo'))!;
    fireEvent.click(foeRow);
    expect(sent.map((m) => (m.payload as { pos: number; action: Action }).pos)).toEqual([0, 1]);
    expect((sent[1]!.payload as { action: Action }).action).toEqual({ kind: 'move', move: 'Tackle', target: { side: 1, pos: 1 } });
    expect(useUiStore.getState().battle!.phase).toBe('submitted');
  });

  it('Party in doubles: both field creatures are in battle; the bench creature switches the choosing position, then is taken', () => {
    const { sent } = open();
    fireEvent.click(screen.getByRole('button', { name: /Party/ }));
    const rows = () => within(screen.getByRole('list', { name: 'Switch' })).getAllByRole('listitem');
    expect(rows()[0]!.textContent).toContain('In battle');
    expect(rows()[1]!.textContent).toContain('In battle');
    expect(rows()[2]!.textContent).not.toContain('In battle');
    fireEvent.click(screen.getByRole('button', { name: 'Bramblecub, level 28' }));
    expect(sent).toHaveLength(0);
    expect(useUiStore.getState().battle!.pick).toEqual({ pos: 1, picks: [{ kind: 'switch', to: 2 }, null] });
    // position 1: the bench creature is already chosen by position 0 — not clickable
    fireEvent.click(screen.getByRole('button', { name: /Party/ }));
    expect(rows()[2]!.textContent).toContain('Already chosen');
    expect(screen.queryByRole('button', { name: 'Bramblecub, level 28' })).toBeNull();
  });
});
