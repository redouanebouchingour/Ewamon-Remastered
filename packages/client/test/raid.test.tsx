// @vitest-environment jsdom
/**
 * Phase C1 — raids in the client. `raidInfoOf` reads `room.state.raid` (protocol RaidState) with the damage board
 * highest first; the den (`RaidDen`) stands while the raid is open, prompts "Join raid" within the server's 8 m and
 * "View raid" once the fight is on, and goes at phase 4 / when the raid is dropped; the lobby modal joins, readies and
 * shows the countdown and roster from a fake room; BattleController seeds a raid battle from `battleResync { battleId:
 * raidId }`, sends `raidAction` for the round, plays `raidEvents`, follows the shared hpPct on the boss bar, holds the
 * catch-window resync until the KO has played, then sends one `raidCatch` and closes with the raid summary card
 * (rewards from `battleEnd { battleId: raidId }`); the raid panel shows HP, round timer and board.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { calcMaxHp, createBattle, digestBattleState, projectBattler, resolveTurn } from '@ewa/core';
import type { Action, BattleState, Battler } from '@ewa/core';
import { PlayerState, RaidState, ZoneState } from '@ewa/protocol';
import type { ServerMessageOf } from '@ewa/protocol';
import type { CreatureBillboard, SpriteDescriptor } from '@ewa/render';
import { createBattleController } from '../src/battle/BattleController';
import type { BattleController, BattleView } from '../src/battle/BattleController';
import type { BattleHudModel } from '../src/battle/BattleHud';
import { STEP_MS } from '../src/battle/constants';
import { setBattleActions } from '../src/battle/controllerRef';
import { RAID_JOIN_RANGE_M, boardFlat, countdownLine, raidInfoOf, unflattenBoard } from '../src/battle/raid';
import type { RaidInfo } from '../src/battle/raid';
import { RaidPanel } from '../src/battle/RaidPanel';
import { RaidSummaryCard } from '../src/battle/RaidSummaryCard';
import { __setWorldSessionForTests } from '../src/net/WorldSession';
import type { WorldSession, ZoneRoom } from '../src/net/WorldSession';
import { InteractionTargets, RANGE } from '../src/scene/interaction';
import type { HudPrompt } from '../src/scene/HudWriter';
import { RAID_DEN_SCALE, RAID_PREFIX, RaidDen, raidTargetId } from '../src/scene/RaidViews';
import type { RaidDenDeps } from '../src/scene/RaidViews';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { RaidLobby } from '../src/world/RaidLobby';
import { makeCreature } from './battleFuzz';

const content = createContentIndex();
const SELF = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const RAID = '33333333-3333-4333-8333-333333333333';

// ─── a fake room ───────────────────────────────────────────────────────────────

function fakeRoom() {
  const state = new ZoneState();
  const listeners = new Set<() => void>();
  const sent: { type: string; payload: unknown }[] = [];
  const ws = {
    room: { state } as unknown as ZoneRoom,
    selfId: SELF,
    zoneId: 'mire_route',
    send: (type: string, payload: unknown) => void sent.push({ type, payload }),
    subscribeState: (cb: () => void) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    onMessage: () => () => undefined,
    onRoom: () => () => undefined,
    onReconnected: () => () => undefined,
  } as unknown as WorldSession;
  const patch = (): void => act(() => listeners.forEach((l) => l()));
  return { state, ws, sent, patch };
}

function openRaid(state: ZoneState, over: Partial<Pick<RaidState, 'phase' | 'hpPct' | 'roundEndsInMs'>> = {}): RaidState {
  const r = new RaidState();
  r.id = RAID;
  r.bossSpecies = 'thornback';
  r.bossLevel = 18;
  r.x = 60;
  r.z = -40;
  r.phase = over.phase ?? 0;
  r.hpPct = over.hpPct ?? 1;
  r.roundEndsInMs = over.roundEndsInMs ?? 90_000;
  state.raid = r;
  return r;
}

function addPlayer(state: ZoneState, id: string, name: string): void {
  const p = new PlayerState();
  p.id = id;
  p.name = name;
  state.players.set(id, p);
}

beforeEach(() => {
  useUiStore.getState().reset();
  useNotificationsStore.getState().clear();
  useSessionStore.getState().clearSession();
});

afterEach(() => {
  cleanup();
  setBattleActions(null);
  __setWorldSessionForTests(null);
});

// ─── model ─────────────────────────────────────────────────────────────────────

describe('raid model', () => {
  it('raidInfoOf: null without a raid; the board highest first with names (yours marked), hpPct clamped', () => {
    const { state } = fakeRoom();
    expect(raidInfoOf(state, SELF)).toBeNull();
    const r = openRaid(state, { phase: 1, hpPct: 0.62, roundEndsInMs: 14_000 });
    addPlayer(state, OTHER, 'Bryn');
    r.damageBoard.set(SELF, 120);
    r.damageBoard.set(OTHER, 340);
    const info = raidInfoOf(state, SELF)!;
    expect(info).toMatchObject({ id: RAID, phase: 1, bossSpecies: 'thornback', bossLevel: 18, x: 60, z: -40, roundEndsInMs: 14_000 });
    expect(info.hpPct).toBeCloseTo(0.62, 5);
    expect(info.board).toEqual([
      { playerId: OTHER, name: 'Bryn', damage: 340, self: false },
      { playerId: SELF, name: 'You', damage: 120, self: true },
    ]);
    expect(unflattenBoard(boardFlat(state, SELF, RAID))).toEqual(info.board);
    expect(boardFlat(state, SELF, 'another-raid')).toEqual([]);
    expect(countdownLine(0, 90_000)).toMatch(/^Starts in 1:30/);
    expect(countdownLine(2, 13_200)).toBe('Round ends in 14s');
  });
});

// ─── the den ───────────────────────────────────────────────────────────────────

function fakeDen() {
  const live = new Map<string, { visible: boolean; pos: [number, number, number] }>();
  const disposed: string[] = [];
  const prompts: (HudPrompt | null)[] = [];
  const targets = new InteractionTargets((p) => prompts.push(p));
  const descriptors: string[] = [];
  const rings: string[] = [];
  const scales: number[] = [];
  const deps: RaidDenDeps = {
    parent: { add: () => undefined } as unknown as RaidDenDeps['parent'],
    acquire: (d: SpriteDescriptor) => {
      const key = (d as unknown as { key: string }).key;
      scales.push(d.sizeScale);
      const rec = { visible: true, pos: [0, 0, 0] as [number, number, number] };
      live.set(key, rec);
      const object = {
        removeFromParent: () => live.delete(key),
        get visible() {
          return rec.visible;
        },
        set visible(v: boolean) {
          rec.visible = v;
        },
      };
      return { object, setFacing: () => undefined, setPosition: (x: number, y: number, z: number) => (rec.pos = [x, y, z]), dispose: () => disposed.push(key) } as unknown as CreatureBillboard;
    },
    descriptor: (sp, key) => {
      descriptors.push(`${sp} ${key}`);
      return { key, speciesId: sp, sizeScale: 1.25 } as unknown as SpriteDescriptor;
    },
    ensureSpecies: () => undefined,
    height: () => 1.5,
    targets,
    interactKey: () => 'E',
    dress: (x, z) => rings.push(`dress ${x} ${z}`),
    undress: (x, z) => rings.push(`undress ${x} ${z}`),
  };
  return { den: new RaidDen(deps), live, disposed, prompts, targets, descriptors, rings, scales };
}

/** what World3D.syncRaid hands the den */
function denInfo(state: ZoneState) {
  const r = state.raid;
  return r === null ? null : { id: r.id, bossSpecies: r.bossSpecies, bossLevel: r.bossLevel, phase: r.phase, x: r.x, z: r.z };
}

describe('raid den', () => {
  it('appears with state.raid at the hotspot, "Join raid" within 8 m, "View raid" in the fight, gone at phase 4 / null', () => {
    const { state } = fakeRoom();
    const { den, live, disposed, prompts, targets, descriptors, rings, scales } = fakeDen();
    den.sync(denInfo(state));
    expect(den.raidId).toBeNull();
    const r = openRaid(state);
    den.sync(denInfo(state));
    const key = `${RAID_PREFIX}${RAID}`;
    expect(descriptors).toEqual([`thornback ${key}`]);
    expect(live.get(key)).toEqual({ visible: true, pos: [60, 1.5, -40] });
    // the glowing boss stands larger than its species, inside the spectator ring + beacons
    expect(scales).toEqual([1.25 * RAID_DEN_SCALE]);
    expect(rings).toEqual(['dress 60 -40']);
    expect(den.dressed).toBe(true);
    const e = targets.dynamicEntry(key)!;
    expect(e).toMatchObject({ kind: 'raid', x: 60, z: -40, range: RAID_JOIN_RANGE_M, prompt: { key: 'E', verb: 'Join raid', target: 'Thornback Lv 18' } });
    expect(RANGE.raid).toBe(8);
    expect(raidTargetId(e.id)).toBe(RAID);
    targets.step(60 + 7.9, -40, false);
    expect(targets.current?.id).toBe(key);
    targets.step(60 + 8.2, -40, false);
    expect(targets.current).toBeNull();
    // the fight starts: same billboard, a new prompt
    r.phase = 1;
    den.sync(denInfo(state));
    expect(disposed).toEqual([]);
    expect(targets.dynamicEntry(key)!.prompt.verb).toBe('View raid');
    targets.step(60, -40 + 3, false);
    expect(prompts.at(-1)?.verb).toBe('View raid');
    // the player's own raid battle hides it; the battle's end shows it again
    den.setHidden(true);
    expect(live.get(key)!.visible).toBe(false);
    expect(den.visible).toBe(false);
    expect(rings.at(-1)).toBe('undress 60 -40');
    den.setHidden(false);
    expect(den.visible).toBe(true);
    expect(rings.at(-1)).toBe('dress 60 -40');
    // over: gone (billboard disposed, interactable dropped)
    r.phase = 4;
    den.sync(denInfo(state));
    expect(disposed).toEqual([key]);
    expect(targets.dynamicEntry(key)).toBeUndefined();
    expect(rings).toEqual(['dress 60 -40', 'undress 60 -40', 'dress 60 -40', 'undress 60 -40']);
    expect(den.dressed).toBe(false);
    // a new raid, then the room drops it
    openRaid(state);
    den.sync(denInfo(state));
    expect(den.raidId).toBe(RAID);
    state.raid = null;
    den.sync(denInfo(state));
    expect(den.raidId).toBeNull();
    expect(live.size).toBe(0);
  });
});

// ─── the lobby ─────────────────────────────────────────────────────────────────

describe('raid lobby', () => {
  it('Join → raidJoin; once on the board Ready → raidReady; countdown, roster and phase from the room; yields to the battle', () => {
    const { state, ws, sent, patch } = fakeRoom();
    __setWorldSessionForTests(ws);
    const r = openRaid(state);
    addPlayer(state, OTHER, 'Bryn');
    r.damageBoard.set(OTHER, 0);
    act(() => useUiStore.getState().openModal('raidLobby', { raidId: RAID }));
    render(<RaidLobby />);
    expect(screen.getByTestId('raidlobby').dataset['phase']).toBe('0');
    expect(screen.getByTestId('raidlobby-countdown').textContent).toMatch(/^Starts in 1:30/);
    expect(screen.getByTestId('raidlobby-roster').textContent).toContain('Bryn');
    expect(screen.getByText('1 / 8')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Join raid' }));
    expect(sent).toEqual([{ type: 'raidJoin', payload: { raidId: RAID } }]);
    // the server took us: the board lists us
    r.damageBoard.set(SELF, 0);
    r.roundEndsInMs = 61_000;
    patch();
    expect(screen.getByTestId('raidlobby').dataset['joined']).toBe('true');
    expect(screen.getByTestId('raidlobby-countdown').textContent).toMatch(/^Starts in 1:01/);
    expect(screen.getByTestId('raidlobby-roster').textContent).toContain('You (you)');
    fireEvent.click(screen.getByRole('button', { name: 'Ready up' }));
    expect(sent.at(-1)).toEqual({ type: 'raidReady', payload: { raidId: RAID } });
    const readyBtn = screen.getByRole('button', { name: 'Ready' }) as HTMLButtonElement;
    expect(readyBtn.disabled).toBe(true);
    // the fight starts: the battle (battleResync) takes over and the modal yields
    r.phase = 1;
    patch();
    act(() =>
      useUiStore.getState().setBattle({
        battleId: RAID, format: 'raid', seat: 0, authoritative: {} as BattleState, phase: 'selecting', menu: 'root', turnLabel: 'Round 1', log: [], desyncs: 0,
        result: null, expectedMs: 0, raid: { raidId: RAID, round: 1, catchWindow: false },
      }),
    );
    expect(screen.queryByTestId('raidlobby')).toBeNull();
  });

  it('a badge gate disables Join; a dropped raid says so', () => {
    const { state, ws, patch } = fakeRoom();
    __setWorldSessionForTests(ws);
    const r = openRaid(state);
    r.bossSpecies = 'moblaze'; // raid_ash_moblaze: minBadges 1
    r.x = -72;
    r.z = 36;
    act(() => useUiStore.getState().openModal('raidLobby', { raidId: RAID }));
    render(<RaidLobby />);
    const join = screen.getByRole('button', { name: 'Join raid' }) as HTMLButtonElement;
    expect(join.disabled).toBe(true);
    expect(screen.getByTestId('raidlobby').textContent).toContain('Needs 1 badge');
    state.raid = null;
    patch();
    expect(screen.getByTestId('raidlobby').dataset['state']).toBe('gone');
  });
});

// ─── the battle ────────────────────────────────────────────────────────────────

/** A participant's private raid battle as the server builds it (side 1 = the shared boss, maxHp scaled). */
function raidBattle(bossHp?: number): BattleState {
  const me = makeCreature(content, content.species('bramblecub'), 60, 'mine-1', SELF);
  const bossC = makeCreature(content, content.species('mossling'), 3, `raid:test`, null);
  const projected = projectBattler(bossC, content);
  const maxHp = calcMaxHp(content.species('mossling').baseHp, 3) * 40;
  const boss: Battler = { ...projected, maxHp, creature: { ...projected.creature, hp: bossHp ?? maxHp } };
  const { state } = createBattle(
    {
      id: `${RAID}:${SELF}`, format: 'raid', zoneId: 'mire_route', terrain: 'none', seed: 4242,
      sides: [
        { kind: 'player', party: [projectBattler(me, content)], active: 0, trainerId: SELF, canFlee: false, canCatch: false },
        { kind: 'wild', party: [boss], active: 0, trainerId: null, canFlee: false, canCatch: false },
      ],
    },
    content,
  );
  return state;
}

/** the server's catch-window state (RaidSession.catchState) */
function catchWindowOf(st: BattleState, canCatch: boolean): BattleState {
  const lead = st.sides[0].party.find((b) => b.creature.hp > 0) ?? st.sides[0].party[0]!;
  const boss = st.sides[1].party[0]!;
  return {
    ...st, ended: null,
    sides: [
      { ...st.sides[0], party: [{ ...lead, creature: { ...lead.creature, hp: lead.maxHp } }], active: 0, canCatch, mustSwitch: false },
      { ...st.sides[1], party: [{ ...boss, creature: { ...boss.creature, hp: 1 } }], active: 0, mustSwitch: false },
    ],
  };
}

function resync(state: BattleState): ServerMessageOf<'battleResync'> {
  return { type: 'battleResync', battleId: RAID, state, stateDigest: digestBattleState(state) };
}

function setupRaid() {
  const sent: { type: string; payload: unknown }[] = [];
  const calls: string[] = [];
  let hud: BattleHudModel | null = null;
  let info: RaidInfo | null = {
    id: RAID, phase: 1, hpPct: 1, bossSpecies: 'mossling', bossLevel: 3, roundEndsInMs: 20_000, x: 0, z: 0,
    board: [{ playerId: SELF, name: 'You', damage: 0, self: true }, { playerId: OTHER, name: 'Bryn', damage: 0, self: false }],
  };
  const view: BattleView = {
    enterBattle: (s) => calls.push(`enter ${s.format} ${s.foeId ?? '-'} ${s.foeNpc ?? '-'}`), exitBattle: () => calls.push('exit'), setBattler: () => undefined,
    setPose: () => undefined, hurt: () => undefined, vfx: () => undefined, prewarm: () => undefined, syncFrom: () => calls.push('sync'),
    setWeather: () => undefined, cue: () => undefined, shake: () => undefined, setTimeScale: () => undefined, hitstopEnabled: () => false,
    slowmoEnabled: () => false, playSfx: () => undefined, setBattleHud: (m) => (hud = m), setThreat: () => undefined, ended: (w) => calls.push(`ended ${String(w)}`),
  };
  const c: BattleController = createBattleController({
    content, send: (type, payload) => sent.push({ type, payload }), reduced: () => false, instantText: () => true,
    selfPosition: () => ({ x: 0, z: 0 }), summaryAt: () => null, selfId: () => SELF, raidId: () => info?.id ?? null,
    raidInfo: () => info, view, defer: (fn) => fn(),
  });
  setBattleActions({ submit: (a) => c.submit(a), check: (a) => c.check(a), dismissResult: () => c.dismissResult() });
  const playOut = (): void => {
    for (let i = 0; i < 4000 && c.player.isPlaying; i++) c.player.step(STEP_MS);
  };
  const setInfo = (patch: Partial<RaidInfo> | null): void => {
    info = patch === null ? null : { ...info!, ...patch };
  };
  return { c, sent, calls, playOut, hud: () => hud, setInfo };
}

const firstMove = (st: BattleState): Action => ({ kind: 'move', move: st.sides[0].party[0]!.creature.moves.find((m) => m.pp > 0)!.id });

describe('BattleController raids', () => {
  it('fight start resync → raid battle; raidAction for the round; raidEvents play; the boss bar follows hpPct; enrage banner', () => {
    const { c, sent, calls, playOut, hud, setInfo } = setupRaid();
    const st0 = raidBattle();
    c.onBattleResync(resync(st0));
    const b = useUiStore.getState().battle!;
    expect(b).toMatchObject({ battleId: RAID, format: 'raid', seat: 0, phase: 'selecting', turnLabel: 'Round 1', raid: { raidId: RAID, round: 1, catchWindow: false } });
    expect(calls).toContain('enter raid - -');
    // moves are validated locally and go out as raidAction for the round (no battleAction, no preview)
    const a = firstMove(st0);
    expect(c.check({ kind: 'catch', orb: 'spark_orb' })).not.toBeNull();
    c.submit(a);
    expect(sent).toEqual([{ type: 'raidAction', payload: { raidId: RAID, round: 1, action: a } }]);
    expect(c.preview).toBeNull();
    expect(useUiStore.getState().battle!.phase).toBe('submitted');
    // the round resolves (others hit the boss too): the events play, then round 2
    const res = resolveTurn(st0, [a, null], content);
    c.onRaidEvents({ type: 'raidEvents', raidId: RAID, round: 1, events: res.events, stateDigest: digestBattleState(res.state) });
    expect(useUiStore.getState().battle!.phase).toBe('playing');
    // the panel's round follows the screen: round 1 plays out before round 2 shows
    expect(useUiStore.getState().battle!.raid!.round).toBe(1);
    expect(hud()!.bars[1]!.name).toBe('The raid boss Mossling');
    setInfo({ hpPct: 0.5 });
    playOut();
    const after = useUiStore.getState().battle!;
    expect(after).toMatchObject({ phase: 'selecting', turnLabel: 'Round 2', raid: { round: 2 } });
    const maxHp = st0.sides[1].party[0]!.maxHp;
    expect(hud()!.bars[1]!.hp).toBe(Math.round(0.5 * maxHp));
    expect(after.authoritative.sides[1].party[0]!.creature.hp).toBe(Math.round(0.5 * maxHp));
    // a later hpPct patch moves the bar between rounds
    setInfo({ hpPct: 0.25, phase: 2 });
    c.onRaidState();
    expect(hud()!.bars[1]!.hp).toBe(Math.round(0.25 * maxHp));
    // round 2 carries the enrage: a banner names the boss
    const a2 = firstMove(after.authoritative);
    c.submit(a2);
    expect(sent.at(-1)).toEqual({ type: 'raidAction', payload: { raidId: RAID, round: 2, action: a2 } });
    c.onRaidEvents({ type: 'raidEvents', raidId: RAID, round: 2, events: [{ t: 'abilityTrigger', who: { side: 1, slot: 0 }, ability: st0.sides[1].party[0]!.creature.ability, detail: 'enraged' }], stateDigest: '00000000' });
    expect(useUiStore.getState().battleBanner).toMatchObject({ speaker: 'Mossling', text: expect.stringContaining('enraged') });
    playOut();
    expect(useUiStore.getState().battle!.turnLabel).toBe('Round 3');
    expect(sent.some((m) => m.type === 'battleAction' || m.type === 'battleResync')).toBe(false);
  });

  it('boss down → the catch-window resync waits for the KO, orbs only, one raidCatch, then the summary card with the rewards', () => {
    const { c, sent, calls, playOut, setInfo } = setupRaid();
    const st0 = raidBattle(1); // the others left it at 1 HP
    c.onBattleResync(resync(st0));
    const a = firstMove(st0);
    c.submit(a);
    const res = resolveTurn(st0, [a, null], content);
    expect(res.state.sides[1].party[0]!.creature.hp).toBe(0);
    c.onRaidEvents({ type: 'raidEvents', raidId: RAID, round: 1, events: res.events, stateDigest: digestBattleState(res.state) });
    // the catch window opens while the KO still plays: held
    const win = catchWindowOf(res.state, true);
    c.onBattleResync(resync(win));
    expect(useUiStore.getState().battle!.raid!.catchWindow).toBe(false);
    expect(c.player.isPlaying).toBe(true);
    // rewards ride battleEnd { battleId: raidId } — no result card
    c.onBattleEnd({ type: 'battleEnd', battleId: RAID, outcome: { winner: 0 }, rewards: { money: 150, items: {}, trainerExp: 150, ratingDelta: null, badge: null } });
    setInfo({ phase: 3, hpPct: 0, board: [{ playerId: OTHER, name: 'Bryn', damage: 900, self: false }, { playerId: SELF, name: 'You', damage: 1, self: true }] });
    playOut();
    const b = useUiStore.getState().battle!;
    expect(b).toMatchObject({ phase: 'selecting', turnLabel: 'Catch window', result: null, raid: { catchWindow: true } });
    expect(b.authoritative.sides[0].canCatch).toBe(true);
    expect(c.check(a)).toBe('The boss is down — throw an orb');
    expect(c.check({ kind: 'catch', orb: 'spark_orb' })).toBeNull();
    c.submit(a);
    expect(sent.filter((m) => m.type === 'raidAction')).toHaveLength(1);
    c.submit({ kind: 'catch', orb: 'spark_orb' });
    expect(sent.at(-1)).toEqual({ type: 'raidCatch', payload: { raidId: RAID, orb: 'spark_orb' } });
    expect(useUiStore.getState().battle!.phase).toBe('submitted');
    // the roll's events (catch-only resolveTurn on the window state) play, then the summary
    const roll = resolveTurn(win, [{ kind: 'catch', orb: 'spark_orb' }, null], content);
    const caught = roll.events.some((e) => e.t === 'catchResult' && e.caught);
    c.onRaidEvents({ type: 'raidEvents', raidId: RAID, round: 1, events: roll.events, stateDigest: digestBattleState(roll.state) });
    playOut();
    const result = useUiStore.getState().battle!.result!;
    expect(result.rewards.money).toBe(150);
    expect(result.raid).toMatchObject({ bossSpecies: 'mossling', bossLevel: 3, cleared: true, caught, damage: 1, rank: 2, fainted: false, left: false });
    expect(result.raid!.board.map((r) => r.name)).toEqual(['Bryn', 'You']);
    expect(calls).toContain('ended false');
    // the summary card renders it; Back to the world closes the battle
    render(<RaidSummaryCard />);
    expect(screen.getByRole('dialog').textContent).toContain(caught ? 'Caught!' : 'Raid cleared');
    expect(screen.getByTestId('raidsummary-rewards').textContent).toContain('+150 money');
    expect(screen.getByTestId('raidsummary').textContent).toContain('2 of 2');
    fireEvent.click(screen.getByRole('button', { name: /^(Back to the world|Continue)$/ }));
    expect(useUiStore.getState().battle).toBeNull();
    expect(calls.at(-1)).toBe('exit');
  });

  it('Leave raid → raidLeave + summary; a fainted party → summary; an ineligible catch window never reopens a closed battle', () => {
    const { c, sent, playOut, setInfo } = setupRaid();
    c.onBattleResync(resync(raidBattle()));
    expect(c.check({ kind: 'forfeit' })).toBeNull();
    c.submit({ kind: 'forfeit' });
    expect(sent).toEqual([{ type: 'raidLeave', payload: { raidId: RAID } }]);
    expect(useUiStore.getState().battle!.result!.raid).toMatchObject({ left: true, cleared: false, caught: null });
    c.dismissResult();
    expect(useUiStore.getState().battle).toBeNull();
    // the raid went on and the boss fell: a catch window without a catch (no damage) stays shut
    setInfo({ phase: 3, hpPct: 0 });
    c.onBattleResync(resync(catchWindowOf(raidBattle(0), false)));
    expect(useUiStore.getState().battle).toBeNull();
    // ...but one with a catch try reopens the battle in the window
    c.onBattleResync(resync(catchWindowOf(raidBattle(0), true)));
    expect(useUiStore.getState().battle).toMatchObject({ format: 'raid', turnLabel: 'Catch window', raid: { catchWindow: true } });
    // the window closes (phase 4) without a throw: the summary
    setInfo({ phase: 4 });
    c.onRaidState();
    expect(useUiStore.getState().battle!.result!.raid).toMatchObject({ cleared: true, caught: null });
    c.dismissResult();
    // a party that faints mid-raid: the private battle ends against us → summary (still on the board)
    setInfo({ phase: 1, hpPct: 1 });
    c.onBattleResync(resync(raidBattle()));
    c.onRaidEvents({ type: 'raidEvents', raidId: RAID, round: 1, events: [{ t: 'faint', who: { side: 0, slot: 0 } }, { t: 'battleEnd', outcome: { winner: 1 }, turns: 1 }], stateDigest: '00000000' });
    playOut();
    expect(useUiStore.getState().battle!.result!.raid).toMatchObject({ fainted: true, cleared: false, left: false });
  });

  it('the raid panel shows the boss, the shared HP, the round timer and the board from the room', () => {
    const { state, ws, patch } = fakeRoom();
    __setWorldSessionForTests(ws);
    const r = openRaid(state, { phase: 2, hpPct: 0.27, roundEndsInMs: 14_000 });
    addPlayer(state, OTHER, 'Bryn');
    r.damageBoard.set(SELF, 50);
    r.damageBoard.set(OTHER, 75);
    act(() =>
      useUiStore.getState().setBattle({
        battleId: RAID, format: 'raid', seat: 0, authoritative: {} as BattleState, phase: 'selecting', menu: 'root', turnLabel: 'Round 4', log: [], desyncs: 0,
        result: null, expectedMs: 0, raid: { raidId: RAID, round: 4, catchWindow: false },
      }),
    );
    render(<RaidPanel />);
    const panel = screen.getByTestId('raidpanel');
    expect(panel.dataset['phase']).toBe('2');
    expect(panel.textContent).toContain('Thornback');
    expect(panel.textContent).toContain('Enraged');
    expect(screen.getByTestId('raidpanel-hp').textContent).toBe('27%');
    expect(screen.getByTestId('raidpanel-timer').textContent).toBe('Round 4 · Round ends in 14s');
    expect(screen.getByTestId('raidpanel-board').textContent).toMatch(/Bryn.*75.*You \(you\).*50/);
    r.hpPct = 0.1;
    r.roundEndsInMs = 9_000;
    r.damageBoard.set(SELF, 120);
    patch();
    expect(screen.getByTestId('raidpanel-hp').textContent).toBe('10%');
    expect(screen.getByTestId('raidpanel-timer').textContent).toBe('Round 4 · Round ends in 9s');
    expect(screen.getByTestId('raidpanel-board').textContent).toMatch(/You \(you\).*120.*Bryn.*75/);
  });
});
