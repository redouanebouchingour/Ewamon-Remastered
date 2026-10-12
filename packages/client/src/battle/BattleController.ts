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
 * Phase C1 raids (format 'raid', battleId = the raid id): the server's `battleResync { battleId: raidId }` at the fight
 * start seeds the battle (no battleStart exists for a raid); `submit` sends `raidAction { raidId, round }` (no preview,
 * like pvp), `onRaidEvents` patches the state from each round's events and plays them, the boss bar follows the shared
 * `RaidState.hpPct` (`onRaidState`, at each timeline end). When the boss falls the second `battleResync` (the catch
 * window, held until the KO timeline has played) leaves only orbs (`raidCatch`, once) or Done; the raid summary card
 * (`BattleResult.raid`) closes it — after the catch roll, when the party is out, on leaving, or when the raid ends.
 * The raid's rewards (`battleEnd { battleId: raidId }`) fill the summary instead of a result card.
 *
 * Phase B7 presentation: `battleStart` of a trainer / league battle writes `ui.battleIntro` (the VS card; never under
 * reduced motion, never on a resync restore); a league trainer's `mid` lines are pushed as `ui.battleBanner` as the
 * timeline PLAYS — `halfHp` once when the foe team's total displayed HP first drops to half or below, `lastStand` once
 * when the foe's last standing creature enters; the result card's arrival calls `view.ended` (foe actor emotes).
 *
 * Phase D6 doubles (`state.slots === 2`; trainer / league / pvp only): two battlers per side on stage slots = field
 * positions 0 / 1 (`STAGE_REFS_DOUBLES`, four HUD bars). `submit` records the action of the position choosing now
 * (`ui.battle.pick`, validated with `validateAction(…, pos)` and the cross-position switch rule) and moves on to the next
 * required position (`requiredPositions`); `undoPick` (the menu's Back) re-opens the earlier one. Only when every
 * required position has picked does it validate the pair (`validateSideChoice`), send ONE `battleAction { pos }` PER
 * POSITION, and run the preview `resolveTurn(authoritative, [[a0, a1], null])` (pvp: none). A forfeit fills every
 * required position. Stage / HUD addressing goes through the player's party → position map (`positionOf`); the
 * displayed creature is tracked per position; `patchFromEvents` moves `actives` on `switchIn { pos }`.
 *
 * HP is never computed here: bars follow `damage.hpAfter` / `heal.hpAfter` (TimelinePlayer → BattleHud).
 * Store writes happen at message time or are deferred off the tick (setTimeout 0) — never from inside World3D.tick.
 */
import { digestBattleState, requiredPositions, resolveTurn, validateAction, validateSideChoice } from '@ewa/core';
import type { Action, BandKind, BattleEvent, BattleState, ContentIndex, CreatureInstance, Ref, StatusId } from '@ewa/core';
import type { ClientMessageType, ClientPayload, RewardsSummary, ServerMessageOf } from '@ewa/protocol';
import { OPEN_MENU, useUiStore } from '../state/ui';
import { useSessionStore } from '../state/session';
import type { BattleResult, BattleUi, DoublesPick, QueuedPrompt, RaidBattleUi, RaidSummary } from '../state/ui';
import { toast } from '../state/notifications';
import { BattleHud, STAGE_REFS, STAGE_REFS_DOUBLES } from './BattleHud';
import type { BattleHudModel } from './BattleHud';
import { LOG_DWELL_MIN } from './constants';
import { actionErrorLabel } from './labels';
import { foeIdentity, foeOfState } from './foe';
import type { FoeIdentity } from './foe';
import { useCinematicStore } from './cinematic';
import { useBondStore } from './bond';
import type { BondCue } from './bond';
import type { CinematicCue, CinematicPoint } from './cinematic';
import { createMoveAnimRegistry } from './moveAnims';
import type { MoveAnimRegistry } from './moveAnims';
import type { RaidInfo } from './raid';
import { buildTimeline, statusGlyph, vfxIdsIn } from './timeline';
import type { LogTone, Timeline, TimelineCtx } from './timeline';
import { TimelinePlayer } from './TimelinePlayer';
import type { TimelineTargets } from './TimelinePlayer';

type StageRef = { readonly side: 0 | 1; readonly slot: number };
type Pose = Parameters<TimelineTargets['setPose']>[1];
type Cue = Parameters<TimelineTargets['cue']>[0];

/** The render/audio side of a battle. World3D binds it once the renderer exists; null parts are skipped. */
export interface BattleView {
  /**
   * `foeId`: the other trainer's player uuid in a pvp battle (their avatar is restaged behind their creature), else null.
   * `foeNpc`: the content id of an NPC / league trainer foe (Phase B7: the world's FoeActor restages its actor, or spawns
   * a temporary one with the content look), else null.
   * `yaw`: the hall battle axis from `battleStart` (null outside a hall or when unknown, e.g. after a reload).
   */
  enterBattle(summary: {
    readonly battleId: string; readonly x: number; readonly z: number; readonly format: BattleState['format']; readonly foeId: string | null;
    readonly foeNpc: string | null; readonly yaw: number | null;
  }): void;
  exitBattle(): void;
  /**
   * `null` clears the position. `key` is unique per creature per battle. `spriteId` (a battle form) names the creature
   * manifest entry to show instead of the species' own (`<species>_<form>`); types and size stay the species'.
   */
  setBattler(ref: StageRef, c: CreatureInstance | null, key: string, spriteId?: string): void;
  setPose(ref: StageRef, pose: Pose, ms: number): void;
  hurt(ref: StageRef, strength: number): void;
  /** `type`: the colours of a `style_*` effect (render §10.7.5) */
  vfx(id: string, from: StageRef | null, to: StageRef | null, ms: number, type?: string): void;
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
  /**
   * A battler's sprite on screen, for the signature cinematic's aim: writes [top x, top y, feet x, feet y] in CSS px
   * (viewport) and returns true, or false when it is not on screen. Optional: without it the overlay uses its layout.
   */
  project?(ref: StageRef, out: Float32Array): boolean;
  /**
   * Phase B7: the result card is up (the final timeline has played). `foeWon`: true when the other side won, false
   * when the player did, null for no winner (caught, fled, draw). The world plays the cheer / sad emotes.
   */
  ended?(foeWon: boolean | null): void;
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
  /** Phase C1: the open raid (`room.state.raid` + player names), null without one */
  readonly raidInfo?: () => RaidInfo | null;
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
  /** Phase C1: one raid round's (or the catch roll's) events for this participant */
  onRaidEvents(m: ServerMessageOf<'raidEvents'>): void;
  /** Phase C1: `room.state.raid` changed (hpPct, phase, removed) — the scene calls it from its patch handler */
  onRaidState(): void;
  readonly preview: { state: BattleState; digest: string } | null;
  // ---- additions ----
  readonly player: TimelinePlayer;
  /** Binds the render side (World3D, once the renderer is up). */
  attach(view: BattleView | null): void;
  /** BattleResultCard's "Continue". */
  dismissResult(): void;
  /** DOM menu → validate without sending (disabled reasons). Doubles: for the position choosing now. */
  check(action: Action): string | null;
  /** Phase D6: the menu's Back in doubles — re-opens the previous position's choice (nothing was sent yet). */
  undoPick(): void;
  /** Called at LOG_DWELL_MIN by an interval while a battle is open (off the tick). */
  flushLog(): void;
  /** Tear down (world disposed). */
  reset(): void;
  readonly active: boolean;
}

const TURN = (n: number): string => `Turn ${n}`;
const NO_REWARDS: RewardsSummary = { money: 0, items: {}, trainerExp: 0, ratingDelta: null, badge: null };

/** Phase C1: the controller's private raid run (non-null iff the open battle is a raid). */
interface RaidRun {
  /** the round the next raidAction is for */
  round: number;
  /** the round on screen (`round` once the previous round's events have played) */
  shownRound: number;
  catchWindow: boolean;
  /** a raidCatch was sent (the roll's raidEvents follow) */
  attempted: boolean;
  caught: boolean | null;
  bossDown: boolean;
  fainted: boolean;
  left: boolean;
  rewards: RewardsSummary | null;
  /** the catch-window resync, held while the KO timeline plays */
  pendingResync: ServerMessageOf<'battleResync'> | null;
  /** the raid ended (phase 4 / dropped) while a timeline played: the summary waits for it */
  overPending: boolean;
  summaryShown: boolean;
  /** the last raid snapshot seen (the summary still has it after the room dropped the raid) */
  info: RaidInfo | null;
}

/** The other side's player uuid when it is a player (pvp), else null. */
function foeOf(state: BattleState, seat: 0 | 1): string | null {
  const other = state.sides[seat === 0 ? 1 : 0];
  return other.kind === 'player' ? other.trainerId : null;
}
function foeNpcOf(state: BattleState, seat: 0 | 1): string | null {
  const other = state.sides[seat === 0 ? 1 : 0];
  return other.kind === 'npc' ? other.trainerId : null;
}

/**
 * The field as it stood before `events` changed any battler's form: a battle form swaps its sprite on its own timeline
 * frame, so a battle that opens with one (a lead already below the line) shows the plain sprite until that frame plays.
 */
function beforeFormChanges(st: BattleState, events: readonly BattleEvent[]): BattleState {
  const changed = events.flatMap((e) => (e.t === 'formChange' ? [`${e.who.side}:${e.who.slot}`] : []));
  if (changed.length === 0) return st;
  const strip = (side: 0 | 1): BattleState['sides'][0] => ({
    ...st.sides[side],
    party: st.sides[side].party.map((b, slot) => (changed.includes(`${side}:${slot}`) ? { ...b, form: undefined } : b)),
  });
  return { ...st, sides: [strip(0), strip(1)] };
}

/** The battler's species types for its HUD plate (§50.1 #15); [] for an unknown species id. */
function typesOf(state: BattleState, r: Ref, content: ContentIndex): readonly string[] {
  const b = state.sides[r.side]?.party[r.slot];
  if (b === undefined) return [];
  try {
    return content.species(b.creature.speciesId).types;
  } catch (_e) {
    return [];
  }
}

/**
 * The band behind a battler's form change when its trainer chose it (the bond cinematic, bond.ts): any trainer's side
 * (the player, an NPC with bands, a pvp rival) whose species has a Majin / Tenjin form. A wild side's form breaks open
 * on its own and a raid boss is nobody's: null.
 */
export function bandOf(state: BattleState, r: Ref, content: ContentIndex): BandKind | null {
  const side = state.sides[r.side];
  const b = side?.party[r.slot];
  if (side === undefined || b === undefined || side.kind === 'wild' || state.format === 'raid') return null;
  try {
    return content.species(b.creature.speciesId).battleForm?.kind ?? null;
  } catch (_e) {
    return null;
  }
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
  // Phase C1: a raid's shared boss is no wild creature
  if (state.format === 'raid') return `the raid boss ${base}`;
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
      case 'switchIn': {
        const sd = sides[e.who.side]!;
        if (e.pos !== undefined && sd.actives !== undefined) {
          // Phase D6: the battler takes its field position; `active` mirrors position 0
          const a: [number, number] = [sd.actives[0], sd.actives[1]];
          a[e.pos] = e.who.slot;
          sd.actives = a;
          sd.active = a[0];
        } else sd.active = e.who.slot;
        break;
      }
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
      case 'formChange': {
        // Majin / Tenjin: the battler takes its form; a trainer's side has used its one transformation (a wild side's
        // automatic change uses none)
        const sd = sides[e.who.side];
        const b = sd?.party[e.who.slot];
        if (sd === undefined || b === undefined) break;
        sd.party[e.who.slot] = { ...b, form: e.form };
        if (sd.kind !== 'wild') sides[e.who.side] = { ...sd, transformed: true };
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
  /**
   * Where the arena forms: `battleStart.x / z / yaw` when the message carries them (Phase A — the server's hall arena;
   * `battleStart` arrives BEFORE the BattleSummary state patch, so the summary is not there yet), else the summary,
   * else the predicted self position.
   */
  let arena: { readonly x: number; readonly z: number; readonly yaw: number | null } | null = null;
  let seat: 0 | 1 = 0;
  let format: BattleState['format'] = 'wild';
  let state: BattleState | null = null;       // authoritative
  let preState: BattleState | null = null;    // the state the playing timeline starts from
  let preview: { state: BattleState; digest: string; turn: number } | null = null;
  let pendingEnd: ServerMessageOf<'battleEnd'> | null = null;
  let resultShown = false;
  /** every evolve / learn-move of the battle for the player's own side, in order (a trainer battle levels up mid-way) */
  let prompts: QueuedPrompt[] = [];
  let logId = 0;
  const pendingLog: { text: string; tone: LogTone }[] = [];
  let logTimer: ReturnType<typeof setInterval> | null = null;
  /**
   * displayed party slot per side and stage position (singles: position 0 only; Phase D6 doubles: both), and the HP each
   * party member shows at the current point of the timeline
   */
  const displayed: [[number, number], [number, number]] = [[-1, -1], [-1, -1]];
  let hpNow: number[][] = [[], []];

  const hud = new BattleHud((m) => view?.setBattleHud(m));
  /** Phase B7: the NPC trainer across the field (null for wild / pvp / raid) and which mid lines already played */
  let foe: FoeIdentity | null = null;
  let midHalfDone = false;
  let midLastDone = false;
  let bannerId = 0;
  let raid: RaidRun | null = null;
  /** `side:slot:move` of every signature move a battler used this battle: a later use plays the short cinematic */
  const sigUsed = new Set<string>();
  let cinematicId = 0;
  const projected = new Float32Array(4);
  const pointOf = (ref: StageRef | null): CinematicPoint | null => {
    if (ref === null || view?.project?.(ref, projected) !== true) return null;
    return { x: (projected[0]! + projected[2]!) / 2, y: (projected[1]! + projected[3]!) / 2, h: Math.max(1, projected[3]! - projected[1]!) };
  };

  const pushBanner = (text: string, speakerName?: string): void => {
    const speaker = speakerName ?? foe?.name ?? '';
    const id = ++bannerId;
    const forBattle = battleId;
    // the timeline plays inside World3D.tick: the store write is deferred off it
    defer(() => {
      if (battleId === forBattle) ui().pushBattleBanner({ id, speaker, text });
    });
  };

  /** `halfHp`: the foe team's total displayed HP first at or below half (any damage to any foe party member). */
  const checkHalfHp = (st: BattleState): void => {
    const mid = foe?.league?.mid;
    if (mid === undefined || midHalfDone) return;
    const side = (seat === 0 ? 1 : 0) as 0 | 1;
    const party = st.sides[side].party;
    const row = hpNow[side] ?? [];
    let hp = 0;
    let max = 0;
    for (let i = 0; i < party.length; i++) {
      hp += Math.max(0, row[i] ?? party[i]!.creature.hp);
      max += party[i]!.maxHp;
    }
    if (max <= 0 || hp * 2 > max) return;
    midHalfDone = true;
    pushBanner(mid.halfHp);
  };

  /** `lastStand`: the creature entering is the foe's only one still standing (a team of two or more). */
  const checkLastStand = (st: BattleState, slot: number): void => {
    const mid = foe?.league?.mid;
    if (mid === undefined || midLastDone) return;
    const side = (seat === 0 ? 1 : 0) as 0 | 1;
    const party = st.sides[side].party;
    if (party.length < 2) return;
    const row = hpNow[side] ?? [];
    for (let i = 0; i < party.length; i++) {
      const hp = row[i] ?? party[i]!.creature.hp;
      if (i === slot ? hp <= 0 : hp > 0) return;
    }
    midLastDone = true;
    midHalfDone = true; // the last stand says more; a late half-HP line would only repeat it
    pushBanner(mid.lastStand);
  };

  const creatureAt = (st: BattleState, side: 0 | 1, slot: number): CreatureInstance | null => st.sides[side]?.party[slot]?.creature ?? null;

  const raidUi = (): RaidBattleUi | undefined => (raid === null || battleId === null ? undefined : { raidId: battleId, round: raid.shownRound, catchWindow: raid.catchWindow });

  const writeUi = (patch: Partial<BattleUi>): void => {
    const b = ui().battle;
    if (b === null || b.battleId !== battleId) return;
    const r = raidUi();
    ui().setBattle(r === undefined ? { ...b, ...patch } : { ...b, ...patch, raid: r });
  };

  /** The turn label: `Turn n`, or for a raid `Round n` / `Catch window` (the raid's shown round catches up here). */
  const labelFor = (st: BattleState): string => {
    if (raid === null) return TURN(st.turn + 1);
    raid.shownRound = raid.round;
    return raid.catchWindow ? 'Catch window' : `Round ${raid.round}`;
  };

  const raidInfo = (): RaidInfo | null => {
    const info = deps.raidInfo?.() ?? null;
    const ok = info !== null && info.id === battleId ? info : null;
    if (raid !== null && ok !== null) raid.info = ok;
    return ok;
  };

  /** The boss's displayed HP := the shared hpPct x its maxHp (a raid round's events only carry this player's turn). */
  const syncBossHp = (st: BattleState): BattleState => {
    const info = raidInfo();
    if (info === null || raid === null || raid.catchWindow) return st;
    const side = (seat === 0 ? 1 : 0) as 0 | 1;
    const s1 = st.sides[side];
    const b = s1.party[s1.active];
    if (b === undefined) return st;
    const hp = info.hpPct <= 0 ? 0 : Math.max(1, Math.round(info.hpPct * b.maxHp));
    const row = hpNow[side];
    if (row !== undefined) row[s1.active] = hp;
    if (b.creature.hp === hp) return st;
    const party = s1.party.map((x, i) => (i === s1.active ? { ...x, creature: { ...x.creature, hp } } : x));
    const sides = (side === 1 ? [st.sides[0], { ...s1, party }] : [{ ...s1, party }, st.sides[1]]) as unknown as BattleState['sides'];
    return { ...st, sides };
  };

  /** The party index on each field position of `side`: [active] in singles, `actives` in doubles (Phase D6). */
  const fieldOf = (st: BattleState, side: 0 | 1): readonly number[] => {
    const s = st.sides[side];
    return st.slots === 2 && s.actives !== undefined ? s.actives : [s.active];
  };

  /** The stage ref of core `side`'s field position (render's stage side 0 is the near / viewer's position). */
  const stageAt = (side: 0 | 1, pos: number): StageRef => {
    const st = (side ^ seat) as 0 | 1;
    return hud.isDoubles ? STAGE_REFS_DOUBLES[st * 2 + (pos === 1 ? 1 : 0)]! : STAGE_REFS[st];
  };

  /** The field position a timeline frame's party slot stands on (singles: 0; doubles: the player's map, -1 = off). */
  const posFor = (side: 0 | 1, slot: number): number => (hud.isDoubles ? player.positionOf(side, slot) : 0);

  const barFor = (st: BattleState, side: 0 | 1, pos: 0 | 1 = 0): void => {
    const s = st.sides[side]!;
    const slot = fieldOf(st, side)[pos] ?? s.active;
    const b = s.party[slot];
    if (b === undefined) return;
    const hp = hpNow[side]?.[slot] ?? b.creature.hp;
    hud.setBar(side, cap(sideName(st, { side, slot }, seat, deps.content)), b.creature.level, hp, b.maxHp, statusGlyph(majorOf(b.creature.status)), side === seat, typesOf(st, { side, slot }, deps.content), pos);
  };

  const showBattler = (st: BattleState, side: 0 | 1, slot: number, pos: 0 | 1 = 0, form?: string): void => {
    const c = creatureAt(st, side, slot);
    displayed[side][pos] = slot;
    // a battle form shows its own sprite: the form the timeline just reached, else the one the state already holds
    const f = form ?? st.sides[side]?.party[slot]?.form;
    // render's stage side 0 is the near (viewer's) position: core sides map through the seat
    if (c !== null && f !== undefined) view?.setBattler(stageAt(side, pos), c, `battle:${battleId}:${side}:${c.id}`, `${c.speciesId}_${f}`);
    else view?.setBattler(stageAt(side, pos), c, c === null ? '' : `battle:${battleId}:${side}:${c.id}`);
  };

  /** Every field position of both sides on the stage and its HUD bar (battle start, timeline end, resync). */
  const showField = (st: BattleState, bars: boolean, onlyChanged: boolean): void => {
    for (const side of [0, 1] as const) {
      const f = fieldOf(st, side);
      for (let p = 0; p < f.length; p++) {
        const pos = p as 0 | 1;
        if (!onlyChanged || displayed[side][pos] !== f[p]) showBattler(st, side, f[p]!, pos);
        if (bars) barFor(st, side, pos);
      }
    }
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
    shinyOf: (r) => creatureAt(st, r.side, r.slot)?.isShiny === true,
    activesOf: (side) => (st.slots === 2 ? st.sides[side].actives : undefined),
    standing: (r) => (creatureAt(st, r.side, r.slot)?.hp ?? 0) > 0,
    signatureSeen: (r, move) => sigUsed.has(`${r.side}:${r.slot}:${move}`),
    bondOf: (r) => bandOf(st, r, deps.content),
    seat,
    instantText: deps.instantText(),
  });

  const phaseAfter = (st: BattleState): BattleUi['phase'] => {
    if (st.ended !== null) return 'ended';
    if (st.sides[seat].mustSwitch) return 'replacement';
    if (st.sides[seat === 0 ? 1 : 0].mustSwitch) return 'submitted';
    return 'selecting';
  };

  /** Phase D6: a fresh doubles pick (the first required position, nothing picked); {} in singles. */
  const pickFor = (st: BattleState): { pick?: DoublesPick } => {
    if (st.slots !== 2) return {};
    const req = st.ended === null ? requiredPositions(st, seat) : [];
    return { pick: { pos: req[0] ?? 0, picks: [null, null] } };
  };

  const targets: TimelineTargets = {
    setPose: (ref, pose, ms) => view?.setPose(ref, pose, ms),
    hurt: (ref, s) => view?.hurt(ref, s),
    vfx: (id, from, to, ms, type) => view?.vfx(id, from, to, ms, type),
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
      const pos = posFor(who.side, who.slot);
      if (pos >= 0 && displayed[who.side][pos] === who.slot) hud.setHp(who.side, to, max, pos as 0 | 1);
      if (who.side !== seat && foe !== null) {
        const st = preState ?? state;
        if (st !== null) checkHalfHp(st);
      }
    },
    status: (who, s) => {
      const pos = posFor(who.side, who.slot);
      if (pos >= 0 && displayed[who.side][pos] === who.slot) hud.setStatus(who.side, s, pos as 0 | 1);
    },
    stage: (who, stat, delta) => {
      const pos = posFor(who.side, who.slot);
      if (pos >= 0 && displayed[who.side][pos] === who.slot) hud.addStage(who.side, stat, delta, pos as 0 | 1);
    },
    orb: (phase, n) => hud.setShakes(phase === 'throw' ? 0 : n),
    form: (who, form) => {
      const st = preState ?? state;
      const p = posFor(who.side, who.slot);
      if (st === null || p < 0 || displayed[who.side][p] !== who.slot) return;
      showBattler(st, who.side, who.slot, p as 0 | 1, form);
      view?.setPose(stageAt(who.side, p), 'idle', 0);
    },
    enter: (who) => {
      const st = preState ?? state;
      if (st === null) return;
      const p = posFor(who.side, who.slot);
      if (p < 0) return;
      const pos = p as 0 | 1;
      if (displayed[who.side][pos] !== who.slot) showBattler(st, who.side, who.slot, pos);
      if (who.side !== seat && foe !== null) checkLastStand(st, who.slot);
      const b = st.sides[who.side]!.party[who.slot];
      if (b !== undefined) {
        const hp = hpNow[who.side]?.[who.slot] ?? b.creature.hp;
        hud.setBar(who.side, cap(sideName(st, who, seat, deps.content)), b.creature.level, hp, b.maxHp, statusGlyph(majorOf(b.creature.status)), who.side === seat, typesOf(st, who, deps.content), pos);
      }
    },
    log: (text, tone) => {
      if (pendingLog.length < 64) pendingLog.push({ text, tone }); // alloc-ok: ≤ 1 small record per log frame
    },
    inputLock: () => undefined,
    cinematic: (phase, move, from, to, mode) => {
      // the store writes are deferred off the World3D tick, like the banners
      if (phase === 'clear') {
        defer(() => {
          useCinematicStore.getState().clear();
          useBondStore.getState().clear();
        });
        return;
      }
      const a = pointOf(from);
      const d = pointOf(to);
      const forBattle = battleId;
      if (phase === 'start') {
        const cue: CinematicCue = { id: ++cinematicId, move, mode, fromNear: from?.side === 0, from: a, to: d, reduced: deps.reduced(), clock: player.clock() };
        defer(() => {
          if (battleId === forBattle) useCinematicStore.getState().show(cue);
        });
        return;
      }
      const id = cinematicId;
      defer(() => useCinematicStore.getState().aim(id, a, d));
    },
    bond: (who, kind, form) => {
      const st = preState ?? state;
      const b = st?.sides[who.side]?.party[who.slot];
      if (st === null || b === undefined) return;
      const side = st.sides[who.side];
      const trainer =
        who.side === seat
          ? (useSessionStore.getState().profile?.username ?? 'You')
          : side.kind === 'npc' && side.trainerId !== null
            ? foeIdentity(side.trainerId).name
            : 'Rival';
      const cue: BondCue = {
        id: ++cinematicId,
        kind,
        speciesId: b.creature.speciesId,
        form,
        name: cap(sideName(st, who, who.side, deps.content)),
        trainer,
        near: who.side === seat,
        reduced: deps.reduced(),
        clock: player.clock(),
      };
      const forBattle = battleId;
      defer(() => {
        if (battleId === forBattle) useBondStore.getState().show(cue);
      });
    },
    commit: () => hud.commit(),
    ended: () => defer(onTimelineEnd),
  };
  const player = new TimelinePlayer(targets);

  function onTimelineEnd(): void {
    if (state === null || battleId === null) return;
    if (raid !== null && raid.pendingResync !== null) {
      applyRaidResync(raid.pendingResync);
      return;
    }
    if (raid !== null) state = syncBossHp(state);
    const st = state;
    preState = st;
    resetHpTable(st);
    // align the bars with the authoritative state (levels after a level-up, the true active / actives)
    if (st.slots === 2) player.seedPositions([st.sides[0].actives, st.sides[1].actives]);
    showField(st, true, true);
    const label = labelFor(st);
    hud.setTurnLabel(label);
    hud.commit();
    flushLog();
    if (raid !== null) {
      raidAfterTimeline(st, label);
      return;
    }
    writeUi({ phase: phaseAfter(st), menu: OPEN_MENU, turnLabel: label, authoritative: st, ...pickFor(st) });
    if (pendingEnd !== null) showResult();
  }

  /** Phase C1: what a raid does once a timeline has played. */
  function raidAfterTimeline(st: BattleState, label: string): void {
    const r = raid!;
    // the private battle ended against us (the whole party fainted) — also when the raid ended meanwhile
    if (!r.catchWindow && !r.bossDown && st.ended !== null) r.fainted = true;
    if (r.overPending || r.fainted || (r.catchWindow && r.attempted)) {
      showRaidSummary();
      return;
    }
    if (r.catchWindow) {
      writeUi({ phase: 'selecting', menu: OPEN_MENU, turnLabel: label, authoritative: st });
      return;
    }
    if (r.bossDown) {
      // the boss fell: the catch window's battleResync follows (it is applied right away if it already came)
      writeUi({ phase: 'submitted', menu: 'root', turnLabel: label, authoritative: st, expectedMs: 0 });
      return;
    }
    writeUi({ phase: phaseAfter(st), menu: OPEN_MENU, turnLabel: label, authoritative: st });
  }

  /** Phase C1: the catch window's battleResync for the open raid battle. */
  function applyRaidResync(m: ServerMessageOf<'battleResync'>): void {
    const r = raid!;
    r.pendingResync = null;
    const canCatch = m.state.sides[seat].canCatch;
    r.catchWindow = true;
    r.bossDown = true;
    restoreFrom(m.state);
    if (!canCatch) showRaidSummary(); // no damage dealt (or the attempt is spent): nothing to throw
  }

  /** The summary card of a raid (BattleResult.raid); rewards arriving later refresh it. */
  function showRaidSummary(): void {
    const r = raid;
    if (r === null || battleId === null || state === null) return;
    r.overPending = false;
    r.summaryShown = true;
    player.stop();
    flushLog();
    raidInfo();
    const info = r.info;
    const selfId = deps.selfId();
    const board = info?.board ?? [];
    const at = board.findIndex((row) => row.self || row.playerId === selfId);
    const foeSide = (seat === 0 ? 1 : 0) as 0 | 1;
    const boss = state.sides[foeSide].party[0]?.creature;
    const cleared = r.bossDown || r.catchWindow || r.rewards !== null || (info !== null && info.phase === 3);
    const summary: RaidSummary = {
      bossSpecies: info?.bossSpecies ?? boss?.speciesId ?? 'unknown',
      bossLevel: info?.bossLevel ?? boss?.level ?? 1,
      cleared,
      caught: r.attempted ? r.caught : null,
      fainted: r.fainted,
      left: r.left,
      damage: at >= 0 ? board[at]!.damage : 0,
      rank: at >= 0 ? at + 1 : null,
      board: board.slice(0, RAID_BOARD_ROWS).map((row) => ({ playerId: row.playerId, name: row.name, damage: row.damage, self: row.self || row.playerId === selfId })),
    };
    const outcome: BattleResult['outcome'] = r.caught === true ? { winner: 'caught', slot: 0 } : { winner: cleared ? seat : foeSide };
    const result: BattleResult = { outcome, rewards: r.rewards ?? NO_REWARDS, prompts: prompts.length, raid: summary };
    writeUi({ phase: 'ended', result });
    if (!resultShown) {
      resultShown = true;
      view?.ended?.(cleared ? false : null);
    }
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

  /** Plays `tl`, which starts from `from` (doubles: the player's party → position map is seeded from its actives). */
  function play(tl: Timeline, from: BattleState): void {
    // the signature moves this timeline plays count as used (the next timeline's cinematics play short)
    for (const f of tl.frames) if (f.k === 'cinematic' && f.phase === 'start') sigUsed.add(`${f.who.side}:${f.who.slot}:${f.move}`);
    player.play(tl, seat, from.slots === 2 ? [from.sides[0].actives, from.sides[1].actives] : null);
  }

  function arenaFor(id: string): { readonly x: number; readonly z: number; readonly yaw: number | null } {
    if (arena !== null) return arena;
    const at = deps.summaryAt(id) ?? deps.selfPosition();
    return { x: at.x, z: at.z, yaw: null };
  }

  function begin(m: {
    battleId: string; seat: 0 | 1; format: BattleState['format']; state: BattleState;
    /** battleStart: the createBattle events about to play (a form they change shows plain until its frame) */
    events?: readonly BattleEvent[] | undefined;
    x?: number | undefined; z?: number | undefined; yaw?: number | null | undefined;
  }): void {
    battleId = m.battleId;
    sigUsed.clear();
    arena = m.x !== undefined && m.z !== undefined && Number.isFinite(m.x) && Number.isFinite(m.z) ? { x: m.x, z: m.z, yaw: m.yaw ?? null } : null;
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
    // Phase D6: four bars and the party → position map for a doubles battle
    hud.setLayout(m.state.slots === 2);
    displayed[0][0] = -1; displayed[0][1] = -1; displayed[1][0] = -1; displayed[1][1] = -1;
    if (m.state.slots === 2) player.seedPositions([m.state.sides[0].actives, m.state.sides[1].actives]);
    foe = foeOfState(m.state, m.seat);
    midHalfDone = false;
    midLastDone = false;
    const catchNow = m.format === 'raid' && m.state.sides[m.seat].canCatch;
    raid =
      m.format === 'raid'
        ? {
            round: m.state.turn + 1, shownRound: m.state.turn + 1, catchWindow: catchNow, attempted: false, caught: null, bossDown: catchNow, fainted: false, left: false, rewards: null,
            pendingResync: null, overPending: false, summaryShown: false, info: null,
          }
        : null;
    if (raid !== null) raidInfo();
    const at = arenaFor(m.battleId);
    view?.enterBattle({ battleId: m.battleId, x: at.x, z: at.z, format: m.format, foeId: foeOf(m.state, m.seat), foeNpc: foeNpcOf(m.state, m.seat), yaw: at.yaw });
    view?.setThreat(true);
    showField(m.events !== undefined ? beforeFormChanges(m.state, m.events) : m.state, true, false);
    hud.setTurnLabel(labelFor(m.state));
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
      const at = arenaFor(battleId);
      v.enterBattle({ battleId, x: at.x, z: at.z, format, foeId: foeOf(state, seat), foeNpc: foeNpcOf(state, seat), yaw: at.yaw });
      v.setThreat(true);
      showField(state, false, false);
      hud.commit();
      v.setBattleHud(hud.current() as BattleHudModel | null);
    },

    onBattleStart(m) {
      if (battleId !== null && battleId !== m.battleId) controller.reset();
      begin(m);
      ui().setBattle({
        battleId: m.battleId, format: m.format, seat: m.seat, authoritative: m.state, phase: 'playing', menu: OPEN_MENU,
        turnLabel: TURN(m.state.turn + 1), log: [], desyncs: 0, result: null, expectedMs: 0,
      });
      // Phase B7: the VS card over the push-in (a fresh trainer / league battle only — a resync restore has none)
      if (foe !== null && (m.format === 'trainer' || m.format === 'league') && !deps.reduced()) {
        ui().setBattleIntro({ battleId: m.battleId, name: foe.name, title: foe.title, type: foe.type, look: foe.look, league: foe.league !== null });
      } else if (ui().battleIntro !== null) ui().setBattleIntro(null);
      play(buildTimeline(m.events, ctxFor(m.state)), m.state);
    },

    check(action) {
      if (state === null) return 'No battle';
      if (raid !== null) return raidCheck(state, action);
      if (state.slots === 2) return doublesCheck(state, action, currentPick(state));
      return actionErrorLabel(validateAction(state, seat, action, deps.content));
    },

    undoPick() {
      if (state === null || state.slots !== 2) return;
      const b = ui().battle;
      if (b === null || (b.phase !== 'selecting' && b.phase !== 'replacement')) return;
      const pick = currentPick(state);
      const req = requiredPositions(state, seat);
      const at = req.indexOf(pick.pos);
      const prev = at > 0 ? req[at - 1]! : null;
      if (prev === null) return;
      const picks: [Action | null, Action | null] = [pick.picks[0], pick.picks[1]];
      picks[prev] = null;
      picks[pick.pos] = null;
      writeUi({ menu: OPEN_MENU, pick: { pos: prev, picks } });
    },

    submit(action) {
      if (state === null || battleId === null) return;
      const b = ui().battle;
      if (b === null || (b.phase !== 'selecting' && b.phase !== 'replacement')) return;
      if (raid !== null) {
        submitRaid(state, battleId, raid, action);
        return;
      }
      if (state.slots === 2) {
        submitDoubles(state, battleId, action);
        return;
      }
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
      for (const p of promptsFrom(m.events, next, seat)) if (!prompts.some((q) => samePrompt(q, p))) prompts.push(p);
      writeUi({ phase: 'playing', authoritative: next, expectedMs: 0 });
      play(buildTimeline(m.events, ctxFor(before)), before);
    },

    onBattleResync(m) {
      if (raid !== null && battleId === m.battleId) {
        // Phase C1: the catch window — after the KO timeline, never over it
        if (player.isPlaying) raid.pendingResync = m;
        else applyRaidResync(m);
        return;
      }
      if (battleId !== m.battleId) {
        const s = m.state;
        const mySeat: 0 | 1 = s.sides[1].kind === 'player' && s.sides[1].trainerId === deps.selfId() ? 1 : 0;
        if (s.format === 'raid') {
          // Phase C1: a raid seeds its battle from this resync (the fight start, or the catch window after a fainted
          // party's summary was dismissed). A catch window with nothing to throw, or one over another battle, stays shut.
          if (battleId !== null) return;
          if (!s.sides[mySeat].canCatch && (deps.raidInfo?.()?.phase ?? 0) >= 3) return;
        }
        // no battle UI yet (reload mid-battle, server part 2 P3): restore it without an intro
        begin({ battleId: m.battleId, seat: mySeat, format: s.format, state: s });
        const r = raidUi();
        ui().setBattle({
          battleId: m.battleId, format: s.format, seat: mySeat, authoritative: s, phase: phaseAfter(s), menu: OPEN_MENU,
          turnLabel: labelFor(s), log: [], desyncs: 0, result: null, expectedMs: 0, ...(r === undefined ? {} : { raid: r }), ...pickFor(s),
        });
        return;
      }
      restoreFrom(m.state);
    },

    onRaidEvents(m) {
      if (raid === null || battleId === null || m.raidId !== battleId || state === null || raid.summaryShown) return;
      const before = state;
      const foeSide = (seat === 0 ? 1 : 0) as 0 | 1;
      if (raid.catchWindow) {
        // the catch roll (catchThrow ... catchResult); the summary follows its timeline
        raid.attempted = true;
        raid.caught = m.events.some((e) => e.t === 'catchResult' && e.caught);
      } else {
        raid.round = m.round + 1;
        if (m.events.some((e) => e.t === 'abilityTrigger' && e.detail === 'enraged')) {
          const bossName = cap(sideName(before, { side: foeSide, slot: 0 }, foeSide, deps.content));
          pushBanner('is enraged — its attack rose sharply!', bossName);
        }
      }
      const next = patchFromEvents(before, m.events, before.turn + 1, before.rng);
      if (!raid.catchWindow && (next.sides[foeSide].party[0]?.creature.hp ?? 1) <= 0) raid.bossDown = true;
      preview = null;
      state = next;
      preState = before;
      resetHpTable(before);
      for (const p of promptsFrom(m.events, next, seat)) if (!prompts.some((q) => samePrompt(q, p))) prompts.push(p);
      writeUi({ phase: 'playing', authoritative: next, expectedMs: 0 });
      play(buildTimeline(m.events, ctxFor(before)), before);
    },

    onRaidState() {
      if (raid === null || battleId === null || state === null || raid.summaryShown) return;
      const info = raidInfo();
      if (info === null || info.phase === 4) {
        // the raid ended (window closed, everyone out, or the room dropped it): the summary, after a playing timeline
        if (player.isPlaying) raid.overPending = true;
        else showRaidSummary();
        return;
      }
      if (player.isPlaying || raid.catchWindow) return;
      state = syncBossHp(state);
      barFor(state, (seat === 0 ? 1 : 0) as 0 | 1);
      hud.commit();
    },

    onBattleEnd(m) {
      if (raid !== null && battleId === m.battleId) {
        // Phase C1: the raid's rewards ride battleEnd { battleId: raidId }: they fill the summary card
        raid.rewards = m.rewards;
        raid.bossDown = true;
        if (raid.summaryShown) showRaidSummary();
        return;
      }
      if (battleId === null || m.battleId !== battleId) {
        if (m.battleId === deps.raidId()) {
          const r = m.rewards;
          toast('success', `Raid cleared! +${r.money} money, +${r.trainerExp} trainer EXP.`);
        }
        return;
      }
      pendingEnd = m;
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

  /** Replaces the battle with a server state (resync): stage, bars and phase from it, the playing timeline dropped. */
  function restoreFrom(st: BattleState): void {
    player.stop();
    state = st;
    preState = st;
    preview = null;
    resetHpTable(st);
    if (st.slots === 2) player.seedPositions([st.sides[0].actives, st.sides[1].actives]);
    showField(st, true, false);
    view?.syncFrom(
      ([0, 1] as const).flatMap((side) =>
        fieldOf(st, side).map((slot, pos) => {
          const b = st.sides[side].party[slot];
          return { ref: stageAt(side, pos), hpFrac: b === undefined ? 0 : b.creature.hp / Math.max(1, b.maxHp) };
        }),
      ),
    );
    const label = labelFor(st);
    hud.setTurnLabel(label);
    hud.commit();
    writeUi({ phase: phaseAfter(st), menu: OPEN_MENU, authoritative: st, turnLabel: label, ...pickFor(st) });
  }

  /** Phase D6: the doubles pick in the store (a fresh one when the store has none). */
  function currentPick(st: BattleState): DoublesPick {
    const b = ui().battle;
    return b?.pick ?? pickFor(st).pick ?? { pos: 0, picks: [null, null] };
  }

  /** Phase D6: the disabled reason of `action` for the position choosing now (incl. the other position's switch). */
  function doublesCheck(st: BattleState, action: Action, pick: DoublesPick): string | null {
    const err = actionErrorLabel(validateAction(st, seat, action, deps.content, pick.pos));
    if (err !== null) return err;
    const other = pick.picks[pick.pos === 0 ? 1 : 0];
    if (action.kind === 'switch' && other !== null && other.kind === 'switch' && other.to === action.to) return 'Already chosen';
    return null;
  }

  /**
   * Phase D6: records the choosing position's action; once every required position has one, validates the pair, sends
   * one `battleAction { pos }` per position and runs the preview (not for pvp).
   */
  function submitDoubles(st: BattleState, id: string, action: Action): void {
    const pick = currentPick(st);
    const req = requiredPositions(st, seat);
    if (!req.includes(pick.pos)) return;
    const err = doublesCheck(st, action, pick);
    if (err !== null) {
      toast('warn', err);
      return;
    }
    const picks: [Action | null, Action | null] = [pick.picks[0], pick.picks[1]];
    if (action.kind === 'forfeit') for (const p of req) picks[p] = action;
    else picks[pick.pos] = action;
    const next = req.find((p) => picks[p] === null);
    if (next !== undefined) {
      writeUi({ menu: OPEN_MENU, pick: { pos: next, picks } });
      return;
    }
    const bad = validateSideChoice(st, seat, picks, deps.content);
    if (bad !== null) {
      toast('warn', actionErrorLabel(bad.code) ?? 'Not allowed');
      picks[bad.pos] = null;
      writeUi({ menu: OPEN_MENU, pick: { pos: bad.pos, picks } });
      return;
    }
    for (const p of req) deps.send('battleAction', { battleId: id, turn: st.turn + 1, action: picks[p]!, pos: p });
    let expectedMs = 0;
    preview = null;
    if (format === 'trainer' || format === 'league') {
      try {
        const res = resolveTurn(st, seat === 0 ? [picks, null] : [null, picks], deps.content);
        preview = { state: res.state, digest: digestBattleState(res.state), turn: res.state.turn };
        const tl = buildTimeline(res.events, ctxFor(st));
        view?.prewarm(vfxIdsIn(tl));
        expectedMs = tl.durationMs;
      } catch (e) {
        console.warn('battle preview failed', e);
        preview = null;
      }
    }
    writeUi({ phase: 'submitted', expectedMs, menu: 'root', pick: { pos: pick.pos, picks } });
  }

  /** Phase C1: the disabled reason of an action in a raid (catch window: orbs and Done only; leaving is always allowed). */
  function raidCheck(st: BattleState, action: Action): string | null {
    if (action.kind === 'forfeit') return null;
    if (raid?.catchWindow === true && action.kind !== 'catch') return 'The boss is down — throw an orb';
    return actionErrorLabel(validateAction(st, seat, action, deps.content));
  }

  /** Phase C1: raidAction for the current round, raidCatch in the window, raidLeave (or Done) for a forfeit. */
  function submitRaid(st: BattleState, id: string, r: RaidRun, action: Action): void {
    if (action.kind === 'forfeit') {
      if (!r.catchWindow) {
        deps.send('raidLeave', { raidId: id });
        r.left = true;
      }
      showRaidSummary();
      return;
    }
    const err = raidCheck(st, action);
    if (err !== null) {
      toast('warn', err);
      return;
    }
    if (r.catchWindow && action.kind === 'catch') deps.send('raidCatch', { raidId: id, orb: action.orb });
    else deps.send('raidAction', { raidId: id, round: r.round, action });
    preview = null;
    writeUi({ phase: 'submitted', expectedMs: 0 });
  }

  function showResult(): void {
    if (pendingEnd === null || resultShown) return;
    resultShown = true;
    flushLog();
    const result: BattleResult = { outcome: pendingEnd.outcome, rewards: pendingEnd.rewards, prompts: prompts.length };
    writeUi({ phase: 'ended', result });
    const w = pendingEnd.outcome.winner;
    view?.ended?.(typeof w === 'number' ? w !== seat : null);
  }

  function finish(): void {
    player.stop();
    stopLogTimer();
    if (battleId !== null) {
      view?.setThreat(false);
      view?.exitBattle();
    }
    hud.clear();
    sigUsed.clear();
    useCinematicStore.getState().clear();
    battleId = null;
    arena = null;
    state = null;
    preState = null;
    preview = null;
    pendingEnd = null;
    resultShown = false;
    prompts = [];
    displayed[0][0] = -1; displayed[0][1] = -1; displayed[1][0] = -1; displayed[1][1] = -1;
    pendingLog.length = 0;
    foe = null;
    midHalfDone = false;
    midLastDone = false;
    raid = null;
    if (ui().battleIntro !== null) ui().setBattleIntro(null);
    if (ui().battleBanner !== null || ui().battleBannerQueue.length > 0) ui().clearBattleBanners();
    if (ui().battle !== null) ui().setBattle(null);
  }

  return controller;
}

/** rows of the damage board the raid summary lists */
const RAID_BOARD_ROWS = 8;

function majorOf(status: readonly StatusId[]): StatusId | null {
  for (const s of status) if (s !== 'confuse') return s;
  return null;
}

function cap(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/**
 * The evolve / learn-move prompts in one turn's events for the player's own side (queued after the result card, each
 * an explicit REST call). Every turn counts, not only the last: in a trainer / league battle the level-up of the
 * first KO happens turns before the end (found live — the learn-move of a mid-battle level-up never showed).
 */
export function promptsFrom(events: readonly BattleEvent[], st: BattleState | null, seat: 0 | 1): QueuedPrompt[] {
  const out: QueuedPrompt[] = [];
  if (st === null) return out;
  for (const e of events) {
    if (e.t !== 'evolveReady' && e.t !== 'learnMove') continue;
    if (e.who.side !== seat) continue;
    const c = st.sides[e.who.side]?.party[e.who.slot]?.creature;
    if (c === undefined || c.ownerId === null) continue;
    if (e.t === 'evolveReady') out.push({ kind: 'evolve', creatureId: c.id, into: e.into });
    else out.push({ kind: 'learnMove', creatureId: c.id, move: e.move });
  }
  return out;
}

/** core emits evolveReady on every exp gain at or past the evolution level: one prompt per creature and target */
function samePrompt(a: QueuedPrompt, b: QueuedPrompt): boolean {
  if (a.kind !== b.kind || a.creatureId !== b.creatureId) return false;
  return a.kind === 'evolve' ? a.into === (b as typeof a).into : a.move === (b as typeof a).move;
}
