/**
 * SPEC §20.5.5 — BattleController: the one writer of `ui.battle` (BattleUi.authoritative included).
 *
 * - `onBattleStart`: director.enterBattle (Pillar 7 push-in, arena dressed in place), both leads on the stage, the
 *   createBattle events played; phase 'selecting' when they finish.
 * - `submit`: validateAction locally (error → toast, nothing sent); `battleAction { battleId, turn: state.turn + 1 }`;
 *   phase 'submitted'; for wild / trainer / league a PREVIEW `resolveTurn(authoritative, [action, null])` (the
 *   server's null-passing convention) used for exactly three things: stage.prewarm of its VFX, the expected
 *   duration, and the digest compared with `battleEvents.stateDigest`. No preview frame is ever rendered.
 * - `onBattleEvents`: digest check (match → the preview state IS the server's state and becomes authoritative;
 *   mismatch → console.warn, desyncs + 1, `battleResync`), then the server's events are played regardless. Without
 *   a preview (pvp, raid) the authoritative state is patched from the events (hpAfter, pp, status, actives, turn).
 *   `rng` replaces the local rng after every turn.
 * - `onBattleResync`: replaces authoritative, `stage.syncFrom`, phase 'selecting' | 'replacement' (also restores a
 *   battle after a reload: the server sends it unprompted on rejoin, server part 2 P3).
 * - `onBattleEnd`: the result card (rewards for display only; the server's progressionDelta / inventoryDelta already
 *   went through the session writers); on dismiss: director.exitBattle, ui.battle = null, then the evolve /
 *   learn-move modals of the final turn, in order. A battleEnd for the open raid goes to the raid summary instead.
 *
 * HP is never computed here: bars follow `damage.hpAfter` / `heal.hpAfter` (TimelinePlayer → BattleHud).
 * Store writes happen at message time or are deferred off the tick (setTimeout 0) — never from inside World3D.tick.
 */
import { digestBattleState, resolveTurn, validateAction } from '@ewa/core';
import type { Action, BattleEvent, BattleState, ContentIndex, CreatureInstance, Ref, StatusId } from '@ewa/core';
import type { ClientMessageType, ClientPayload, ServerMessageOf } from '@ewa/protocol';
import { useUiStore } from '../state/ui';
import type { BattleResult, BattleUi, QueuedPrompt } from '../state/ui';
import { toast } from '../state/notifications';
import { BattleHud, STAGE_REFS } from './BattleHud';
import type { BattleHudModel } from './BattleHud';
import { LOG_DWELL_MIN } from './constants';
import { actionErrorLabel } from './labels';
import { createMoveAnimRegistry } from './moveAnims';
import type { MoveAnimRegistry } from './moveAnims';
import { buildTimeline, statusGlyph, vfxIdsIn } from './timeline';
import type { LogTone, Timeline, TimelineCtx } from './timeline';
import { TimelinePlayer } from './TimelinePlayer';
import type { TimelineTargets } from './TimelinePlayer';

type StageRef = { readonly side: 0 | 1; readonly slot: number };
type Pose = Parameters<TimelineTargets['setPose']>[1];
type Cue = Parameters<TimelineTargets['cue']>[0];

/** The render/audio side of a battle. World3D binds it once the renderer exists; null parts are skipped. */
export interface BattleView {
  /** `foeId`: the other trainer's player uuid in a pvp battle (their avatar is restaged behind their creature), else null. */
  enterBattle(summary: { readonly battleId: string; readonly x: number; readonly z: number; readonly format: BattleState['format']; readonly foeId: string | null }): void;
  exitBattle(): void;
  /** `null` clears the position. `key` is unique per creature per battle. */
  setBattler(ref: StageRef, c: CreatureInstance | null, key: string): void;
  setPose(ref: StageRef, pose: Pose, ms: number): void;
  hurt(ref: StageRef, strength: number): void;
  vfx(id: string, from: StageRef | null, to: StageRef | null, ms: number): void;
  prewarm(ids: readonly string[]): void;
  syncFrom(hp: readonly { readonly ref: StageRef; readonly hpFrac: number }[]): void;
  setWeather(kind: string): void;
  cue(shot: Cue, ms: number): void;
  shake(amp: number, ms: number): void;
  setTimeScale(s: number): void;
  hitstopEnabled(): boolean;
  slowmoEnabled(): boolean;
  playSfx(id: string, at: StageRef | null): void;
  setBattleHud(m: BattleHudModel | null): void;
  setThreat(on: boolean): void;
}

export interface BattleControllerDeps {
  readonly content: ContentIndex;
  readonly send: <K extends ClientMessageType>(type: K, payload: ClientPayload<K>) => void;
  readonly reduced: () => boolean;
  readonly instantText: () => boolean;
  /** Where the local player stands (the arena's fallback centre). */
  readonly selfPosition: () => { readonly x: number; readonly z: number };
  /** `room.state.battles.get(id)` (x, z), when it has arrived. */
  readonly summaryAt: (battleId: string) => { readonly x: number; readonly z: number } | null;
  /** the local player's uuid (a resync carries no seat: the side whose trainerId is ours) */
  readonly selfId: () => string;
  /** `room.state.raid?.id` */
  readonly raidId: () => string | null;
  readonly view: BattleView | null;
  /** timers (tests inject a manual scheduler) */
  readonly defer?: (fn: () => void) => void;
}

export interface BattleController {
  onBattleStart(m: ServerMessageOf<'battleStart'>): void;
  submit(action: Action): void;
  onBattleEvents(m: ServerMessageOf<'battleEvents'>): void;
  onBattleResync(m: ServerMessageOf<'battleResync'>): void;
  onBattleEnd(m: ServerMessageOf<'battleEnd'>): void;
  readonly preview: { state: BattleState; digest: string } | null;
  // ---- additions ----
  readonly player: TimelinePlayer;
  /** Binds the render side (World3D, once the renderer is up). */
  attach(view: BattleView | null): void;
  /** BattleResultCard's "Continue". */
  dismissResult(): void;
  /** DOM menu → validate without sending (disabled reasons). */
  check(action: Action): string | null;
  /** Called at LOG_DWELL_MIN by an interval while a battle is open (off the tick). */
  flushLog(): void;
  /** Tear down (world disposed). */
  reset(): void;
  readonly active: boolean;
}

const TURN = (n: number): string => `Turn ${n}`;

/** The other side's player uuid when it is a player (pvp), else null. */
function foeOf(state: BattleState, seat: 0 | 1): string | null {
  const other = state.sides[seat === 0 ? 1 : 0];
  return other.kind === 'player' ? other.trainerId : null;
}

function sideName(state: BattleState, r: Ref, seat: 0 | 1, content: ContentIndex): string {
  const b = state.sides[r.side]?.party[r.slot];
  if (b === undefined) return 'It';
  let base = b.creature.nickname ?? b.creature.speciesId;
  if (b.creature.nickname === null) {
    try {
      base = content.species(b.creature.speciesId).name;
    } catch (_e) {
      // unknown species id: keep the raw id
    }
  }
  if (r.side === seat) return base;
  return state.sides[r.side]!.kind === 'wild' ? `the wild ${base}` : `the foe’s ${base}`;
}

/** Patches `state` from a turn's events for formats without a preview (pvp / raid). Presentation only. */
export function patchFromEvents(state: BattleState, events: readonly BattleEvent[], turn: number, rng: BattleState['rng']): BattleState {
  const sides = [state.sides[0], state.sides[1]].map((s) => ({ ...s, party: s.party.map((b) => ({ ...b, creature: { ...b.creature } })) }));
  const setCreature = (r: Ref, patch: Partial<CreatureInstance>): void => {
    const b = sides[r.side]?.party[r.slot];
    if (b === undefined) return;
    b.creature = { ...b.creature, ...patch };
  };
  let ended = state.ended;
  const mustSwitch: [boolean, boolean] = [false, false];
  for (const e of events) {
    switch (e.t) {
      case 'damage':
      case 'heal':
        setCreature(e.target, { hp: e.hpAfter });
        break;
      case 'faint':
        setCreature(e.who, { hp: 0 });
        break;
      case 'switchIn':
        sides[e.who.side]!.active = e.who.slot;
        break;
      case 'moveUsed': {
        const b = sides[e.who.side]?.party[e.who.slot];
        if (b !== undefined) setCreature(e.who, { moves: b.creature.moves.map((m) => (m.id === e.move ? { ...m, pp: e.ppLeft } : m)) });
        break;
      }
      case 'statusApplied': {
        const b = sides[e.target.side]?.party[e.target.slot];
        if (b !== undefined && !b.creature.status.includes(e.status)) setCreature(e.target, { status: [...b.creature.status, e.status] });
        break;
      }
      case 'statusCured': {
        const b = sides[e.target.side]?.party[e.target.slot];
        if (b !== undefined) setCreature(e.target, { status: b.creature.status.filter((s: StatusId) => s !== e.status) });
        break;
      }
      case 'switchRequired':
        mustSwitch[e.side] = true;
        break;
      case 'battleEnd':
        ended = e.outcome;
        break;
      default:
        break;
    }
  }
  const nextSides = sides.map((s, i) => ({ ...s, mustSwitch: mustSwitch[i]! })) as unknown as BattleState['sides'];
  return { ...state, sides: nextSides, turn, rng, ended };
}

export function createBattleController(deps: BattleControllerDeps): BattleController {
  const registry: MoveAnimRegistry = createMoveAnimRegistry();
  let view: BattleView | null = deps.view;
  const defer = deps.defer ?? ((fn: () => void) => setTimeout(fn, 0));
  const ui = (): ReturnType<typeof useUiStore.getState> => useUiStore.getState();

  let battleId: string | null = null;
  let seat: 0 | 1 = 0;
  let format: BattleState['format'] = 'wild';
  let state: BattleState | null = null;       // authoritative
  let preState: BattleState | null = null;    // the state the playing timeline starts from
  let preview: { state: BattleState; digest: string; turn: number } | null = null;
  let pendingEnd: ServerMessageOf<'battleEnd'> | null = null;
  let resultShown = false;
  let prompts: QueuedPrompt[] = [];
  let lastEvents: readonly BattleEvent[] = [];
  let logId = 0;
  const pendingLog: { text: string; tone: LogTone }[] = [];
  let logTimer: ReturnType<typeof setInterval> | null = null;
  /** displayed party slot per side, and the HP each party member shows at the current point of the timeline */
  const displayed: [number, number] = [-1, -1];
  let hpNow: number[][] = [[], []];

  const hud = new BattleHud((m) => view?.setBattleHud(m));

  const creatureAt = (st: BattleState, side: 0 | 1, slot: number): CreatureInstance | null => st.sides[side]?.party[slot]?.creature ?? null;

  const writeUi = (patch: Partial<BattleUi>): void => {
    const b = ui().battle;
    if (b === null || b.battleId !== battleId) return;
    ui().setBattle({ ...b, ...patch });
  };

  const barFor = (st: BattleState, side: 0 | 1): void => {
    const s = st.sides[side]!;
    const b = s.party[s.active];
    if (b === undefined) return;
    const hp = hpNow[side]?.[s.active] ?? b.creature.hp;
    hud.setBar(side, cap(sideName(st, { side, slot: s.active }, seat, deps.content)), b.creature.level, hp, b.maxHp, statusGlyph(majorOf(b.creature.status)), side === seat);
  };

  const showBattler = (st: BattleState, side: 0 | 1, slot: number): void => {
    const c = creatureAt(st, side, slot);
    displayed[side] = slot;
    // render's stage side 0 is the near (viewer's) position: core sides map through the seat
    view?.setBattler(STAGE_REFS[(side ^ seat) as 0 | 1], c, c === null ? '' : `battle:${battleId}:${side}:${c.id}`);
  };

  const resetHpTable = (st: BattleState): void => {
    hpNow = [st.sides[0].party.map((b) => b.creature.hp), st.sides[1].party.map((b) => b.creature.hp)];
  };

  const ctxFor = (st: BattleState): TimelineCtx => ({
    content: deps.content,
    registry,
    reduced: deps.reduced(),
    speciesOf: (r) => creatureAt(st, r.side, r.slot)?.speciesId ?? 'unknown',
    nameOf: (r) => sideName(st, r, seat, deps.content),
    maxHpOf: (r) => st.sides[r.side]?.party[r.slot]?.maxHp ?? 1,
    activeOf: (side) => st.sides[side].active,
    seat,
    instantText: deps.instantText(),
  });

  const phaseAfter = (st: BattleState): BattleUi['phase'] => {
    if (st.ended !== null) return 'ended';
    if (st.sides[seat].mustSwitch) return 'replacement';
    if (st.sides[seat === 0 ? 1 : 0].mustSwitch) return 'submitted';
    return 'selecting';
  };

  const targets: TimelineTargets = {
    setPose: (ref, pose, ms) => view?.setPose(ref, pose, ms),
    hurt: (ref, s) => view?.hurt(ref, s),
    vfx: (id, from, to, ms) => view?.vfx(id, from, to, ms),
    setWeather: (k) => view?.setWeather(k),
    cue: (shot, ms) => view?.cue(shot, ms),
    shake: (amp, ms) => view?.shake(amp, ms),
    setTimeScale: (s) => view?.setTimeScale(s),
    hitstopEnabled: () => view?.hitstopEnabled() ?? false,
    slowmoEnabled: () => view?.slowmoEnabled() ?? false,
    playSfx: (id, at) => view?.playSfx(id, at),
    hp: (who, to, max) => {
      const row = hpNow[who.side];
      if (row !== undefined) row[who.slot] = to;
      if (displayed[who.side] === who.slot) hud.setHp(who.side, to, max);
    },
    status: (who, s) => {
      if (displayed[who.side] === who.slot) hud.setStatus(who.side, s);
    },
    stage: (who, stat, delta) => {
      if (displayed[who.side] === who.slot) hud.addStage(who.side, stat, delta);
    },
    orb: (phase, n) => hud.setShakes(phase === 'throw' ? 0 : n),
    enter: (who) => {
      const st = preState ?? state;
      if (st === null) return;
      if (displayed[who.side] !== who.slot) showBattler(st, who.side, who.slot);
      const b = st.sides[who.side]!.party[who.slot];
      if (b !== undefined) {
        const hp = hpNow[who.side]?.[who.slot] ?? b.creature.hp;
        hud.setBar(who.side, cap(sideName(st, who, seat, deps.content)), b.creature.level, hp, b.maxHp, statusGlyph(majorOf(b.creature.status)), who.side === seat);
      }
    },
    log: (text, tone) => {
      if (pendingLog.length < 64) pendingLog.push({ text, tone }); // alloc-ok: ≤ 1 small record per log frame
    },
    inputLock: () => undefined,
    commit: () => hud.commit(),
    ended: () => defer(onTimelineEnd),
  };
  const player = new TimelinePlayer(targets);

  function onTimelineEnd(): void {
    const st = state;
    if (st === null || battleId === null) return;
    preState = st;
    resetHpTable(st);
    // align the bars with the authoritative state (levels after a level-up, the true active)
    for (const side of [0, 1] as const) {
      if (displayed[side] !== st.sides[side].active) showBattler(st, side, st.sides[side].active);
      barFor(st, side);
    }
    hud.setTurnLabel(TURN(st.turn + 1));
    hud.commit();
    flushLog();
    writeUi({ phase: phaseAfter(st), menu: 'root', turnLabel: TURN(st.turn + 1), authoritative: st });
    if (pendingEnd !== null) showResult();
  }

  function startLogTimer(): void {
    if (logTimer !== null) return;
    logTimer = setInterval(() => flushLog(), LOG_DWELL_MIN);
  }
  function stopLogTimer(): void {
    if (logTimer !== null) clearInterval(logTimer);
    logTimer = null;
  }

  function flushLog(): void {
    if (pendingLog.length === 0) return;
    const b = ui().battle;
    if (b === null || b.battleId !== battleId) {
      pendingLog.length = 0;
      return;
    }
    const add = pendingLog.splice(0, pendingLog.length).map((l) => ({ id: ++logId, text: l.text, tone: l.tone }));
    ui().setBattle({ ...b, log: [...b.log, ...add].slice(-40) });
  }

  function play(tl: Timeline): void {
    player.play(tl, seat);
  }

  function begin(m: { battleId: string; seat: 0 | 1; format: BattleState['format']; state: BattleState }): void {
    battleId = m.battleId;
    seat = m.seat;
    hud.setSeat(m.seat);
    format = m.format;
    state = m.state;
    preState = m.state;
    preview = null;
    pendingEnd = null;
    resultShown = false;
    prompts = [];
    pendingLog.length = 0;
    resetHpTable(m.state);
    const at = deps.summaryAt(m.battleId) ?? deps.selfPosition();
    view?.enterBattle({ battleId: m.battleId, x: at.x, z: at.z, format: m.format, foeId: foeOf(m.state, m.seat) });
    view?.setThreat(true);
    for (const side of [0, 1] as const) {
      showBattler(m.state, side, m.state.sides[side].active);
      barFor(m.state, side);
    }
    hud.setTurnLabel(TURN(m.state.turn + 1));
    hud.setShakes(0);
    hud.commit();
    startLogTimer();
  }

  const controller: BattleController = {
    get preview() {
      return preview === null ? null : { state: preview.state, digest: preview.digest };
    },
    get active() {
      return battleId !== null;
    },
    player,

    attach(v) {
      view = v;
      if (v === null || state === null || battleId === null) return;
      // a battle that started before the renderer existed (reload mid-battle): dress it now
      const at = deps.summaryAt(battleId) ?? deps.selfPosition();
      v.enterBattle({ battleId, x: at.x, z: at.z, format, foeId: foeOf(state, seat) });
      v.setThreat(true);
      for (const side of [0, 1] as const) showBattler(state, side, state.sides[side].active);
      hud.commit();
      v.setBattleHud(hud.current() as BattleHudModel | null);
    },

    onBattleStart(m) {
      if (battleId !== null && battleId !== m.battleId) controller.reset();
      begin(m);
      ui().setBattle({
        battleId: m.battleId, format: m.format, seat: m.seat, authoritative: m.state, phase: 'playing', menu: 'root',
        turnLabel: TURN(m.state.turn + 1), log: [], desyncs: 0, result: null, expectedMs: 0,
      });
      play(buildTimeline(m.events, ctxFor(m.state)));
    },

    check(action) {
      if (state === null) return 'No battle';
      return actionErrorLabel(validateAction(state, seat, action, deps.content));
    },

    submit(action) {
      if (state === null || battleId === null) return;
      const b = ui().battle;
      if (b === null || (b.phase !== 'selecting' && b.phase !== 'replacement')) return;
      const err = validateAction(state, seat, action, deps.content);
      if (err !== null) {
        toast('warn', actionErrorLabel(err) ?? 'Not allowed');
        return;
      }
      deps.send('battleAction', { battleId, turn: state.turn + 1, action });
      let expectedMs = 0;
      preview = null;
      if (format === 'wild' || format === 'trainer' || format === 'league') {
        try {
          const res = resolveTurn(state, seat === 0 ? [action, null] : [null, action], deps.content);
          preview = { state: res.state, digest: digestBattleState(res.state), turn: res.state.turn };
          const tl = buildTimeline(res.events, ctxFor(state));
          view?.prewarm(vfxIdsIn(tl));
          expectedMs = tl.durationMs;
        } catch (e) {
          console.warn('battle preview failed', e);
          preview = null;
        }
      }
      writeUi({ phase: 'submitted', expectedMs });
    },

    onBattleEvents(m) {
      if (battleId === null || m.battleId !== battleId || state === null) return;
      const before = state;
      let next: BattleState;
      if (preview !== null) {
        if (preview.digest === m.stateDigest) {
          next = { ...preview.state, rng: m.rng };
        } else {
          console.warn('battle desync', m.battleId, m.turn);
          const b = ui().battle;
          if (b !== null) ui().setBattle({ ...b, desyncs: b.desyncs + 1 });
          deps.send('battleResync', { battleId: m.battleId });
          next = patchFromEvents(before, m.events, m.turn, m.rng);
        }
      } else {
        next = patchFromEvents(before, m.events, m.turn, m.rng);
      }
      preview = null;
      state = next;
      preState = before;
      resetHpTable(before);
      lastEvents = m.events;
      writeUi({ phase: 'playing', authoritative: next, expectedMs: 0 });
      play(buildTimeline(m.events, ctxFor(before)));
    },

    onBattleResync(m) {
      if (battleId !== m.battleId) {
        // no battle UI yet (reload mid-battle, server part 2 P3): restore it without an intro
        const s = m.state;
        const mySeat: 0 | 1 = s.sides[1].kind === 'player' && s.sides[1].trainerId === deps.selfId() ? 1 : 0;
        begin({ battleId: m.battleId, seat: mySeat, format: s.format, state: s });
        ui().setBattle({
          battleId: m.battleId, format: s.format, seat: mySeat, authoritative: s, phase: phaseAfter(s), menu: 'root',
          turnLabel: TURN(s.turn + 1), log: [], desyncs: 0, result: null, expectedMs: 0,
        });
        return;
      }
      player.stop();
      state = m.state;
      preState = m.state;
      preview = null;
      resetHpTable(m.state);
      for (const side of [0, 1] as const) {
        showBattler(m.state, side, m.state.sides[side].active);
        barFor(m.state, side);
      }
      view?.syncFrom(
        ([0, 1] as const).map((side) => {
          const b = m.state.sides[side].party[m.state.sides[side].active];
          return { ref: STAGE_REFS[(side ^ seat) as 0 | 1], hpFrac: b === undefined ? 0 : b.creature.hp / Math.max(1, b.maxHp) };
        }),
      );
      hud.setTurnLabel(TURN(m.state.turn + 1));
      hud.commit();
      writeUi({ phase: phaseAfter(m.state), menu: 'root', authoritative: m.state, turnLabel: TURN(m.state.turn + 1) });
    },

    onBattleEnd(m) {
      if (battleId === null || m.battleId !== battleId) {
        if (m.battleId === deps.raidId()) {
          const r = m.rewards;
          toast('success', `Raid cleared! +${r.money} money, +${r.trainerExp} trainer EXP.`);
        }
        return;
      }
      pendingEnd = m;
      prompts = promptsFrom(lastEvents, state);
      if (!player.isPlaying) showResult();
    },

    dismissResult() {
      if (battleId === null) return;
      const queued = prompts;
      finish();
      for (const p of queued) ui().enqueuePrompt(p);
    },

    flushLog,

    reset() {
      finish();
    },
  };

  function showResult(): void {
    if (pendingEnd === null || resultShown) return;
    resultShown = true;
    flushLog();
    const result: BattleResult = { outcome: pendingEnd.outcome, rewards: pendingEnd.rewards, prompts: prompts.length };
    writeUi({ phase: 'ended', result });
  }

  function finish(): void {
    player.stop();
    stopLogTimer();
    if (battleId !== null) {
      view?.setThreat(false);
      view?.exitBattle();
    }
    hud.clear();
    battleId = null;
    state = null;
    preState = null;
    preview = null;
    pendingEnd = null;
    resultShown = false;
    prompts = [];
    displayed[0] = -1;
    displayed[1] = -1;
    pendingLog.length = 0;
    if (ui().battle !== null) ui().setBattle(null);
  }

  return controller;
}

function majorOf(status: readonly StatusId[]): StatusId | null {
  for (const s of status) if (s !== 'confuse') return s;
  return null;
}

function cap(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/** The evolve / learn-move prompts of the final turn (queued after the result card, each an explicit REST call). */
function promptsFrom(events: readonly BattleEvent[], st: BattleState | null): QueuedPrompt[] {
  const out: QueuedPrompt[] = [];
  if (st === null) return out;
  for (const e of events) {
    if (e.t !== 'evolveReady' && e.t !== 'learnMove') continue;
    const c = st.sides[e.who.side]?.party[e.who.slot]?.creature;
    if (c === undefined || c.ownerId === null) continue;
    if (e.t === 'evolveReady') out.push({ kind: 'evolve', creatureId: c.id, into: e.into });
    else out.push({ kind: 'learnMove', creatureId: c.id, move: e.move });
  }
  return out;
}
