/**
 * Battle replays (client IMPLEMENTATION-NOTES "Battle replays"): a shared battle (GET /replay/:token) is re-simulated
 * with core (`replayBattle`, the server's own input) and played through the scene's normal battle path as if the server
 * sent it: `battleStart`, then one `battleEvents` per recorded step each time the previous step's timeline has played
 * (the controller leaves 'playing'), then `battleEnd`. Nothing is sent to the server; the replay's creatures have no
 * owner, so no evolve / learn-move prompt is queued. The battle id is `replay:<token>` (`isReplayBattle`).
 *
 * Spectator mode (`battle/live.ts`) plays a live arena match the same way: its replay grows (`extendReplay`) as the
 * server shares more turns, and the battleEnd comes once the feed carries the outcome.
 */
import { create } from 'zustand';
import { replayBattle } from '@ewa/core';
import type {
  BattleEvent,
  BattleOutcome,
  BattleState,
  ContentIndex,
  CreateBattleOpts,
  SideChoice,
} from '@ewa/core';
import { REPLAY_BATTLE_ID } from '@ewa/protocol';
import type { ReplayData, ServerMessage } from '@ewa/protocol';
import { toast } from '../state/notifications';
import { useUiStore } from '../state/ui';
import { battleActions } from './controllerRef';
import { REPLAY_PREFIX } from './replayId';

export { REPLAY_PREFIX, isReplayBattle } from './replayId';
import { setSpectating } from './replayId';

/** What a replay is played from: a shared replay, or a live match's feed so far (`battle/live.ts`). */
export type ReplaySource = Pick<ReplayData, 'token' | 'format' | 'seat' | 'labels' | 'seed' | 'start' | 'actions' | 'finalDigest'>;

export interface ReplayPlan {
  readonly battleId: string;
  readonly format: ReplayData['format'];
  readonly seat: 0 | 1;
  readonly start: {
    readonly state: BattleState;
    readonly events: readonly BattleEvent[];
    readonly digest: string;
  };
  readonly steps: readonly {
    readonly state: BattleState;
    readonly events: readonly BattleEvent[];
    readonly digest: string;
  }[];
  /** null while a live match goes on */
  readonly outcome: BattleOutcome | null;
}

/**
 * The replay's states and events, or null when it does not reproduce its recorded final digest (made with other game
 * data than this client's, or tampered with) or, unless `live`, never ends.
 */
export function planReplay(data: ReplaySource, content: ContentIndex, live = false): ReplayPlan | null {
  const s = data.start;
  const opts: CreateBattleOpts = {
    id: REPLAY_BATTLE_ID,
    format: data.format,
    zoneId: s.zoneId,
    terrain: s.terrain as CreateBattleOpts['terrain'],
    seed: data.seed,
    sides: s.sides as unknown as CreateBattleOpts['sides'],
    ...(s.weather !== undefined
      ? { weather: s.weather as NonNullable<CreateBattleOpts['weather']> }
      : {}),
    ...(s.slots !== undefined ? { slots: s.slots } : {}),
    ...(s.noExp !== undefined ? { noExp: s.noExp } : {}),
    ...(s.catchBonus !== undefined ? { catchBonus: s.catchBonus } : {}),
  };
  let run: ReturnType<typeof replayBattle>;
  try {
    run = replayBattle(
      opts,
      data.actions as unknown as readonly (readonly [SideChoice, SideChoice])[],
      content,
    );
  } catch (_e) {
    return null;
  }
  const last = run.steps.length > 0 ? run.steps[run.steps.length - 1]!.state : run.start.state;
  if (run.finalDigest !== data.finalDigest || (!live && last.ended === null)) return null;
  return {
    battleId: `${REPLAY_PREFIX}${data.token}`,
    format: data.format,
    seat: data.seat,
    start: run.start,
    steps: run.steps.map((st) => ({ state: st.state, events: st.events, digest: st.digest })),
    outcome: last.ended,
  };
}

/** What the replay bar shows. */
export interface ReplayUi {
  readonly battleId: string;
  readonly token: string;
  readonly labels: readonly [string, string];
  readonly seat: 0 | 1;
  /** steps handed to the controller so far / in all */
  readonly shown: number;
  readonly total: number;
  readonly paused: boolean;
  /** spectator mode: the live match on show (null for a shared replay) */
  readonly live: { readonly matchId: string; readonly kind: string; readonly finals: boolean; readonly over: boolean } | null;
}

interface ReplayStore {
  readonly replay: ReplayUi | null;
  set(r: ReplayUi | null): void;
}

export const useReplayStore = create<ReplayStore>()((set) => ({
  replay: null,
  set: (replay) => set({ replay }),
}));

/** The names over the two sides: a player's username, an NPC side's label, the wild creature's species name. */
export function replayLabels(
  data: Pick<ReplaySource, 'labels'>,
  plan: ReplayPlan,
  speciesName: (id: string) => string,
): readonly [string, string] {
  const name = (i: 0 | 1): string => {
    const label = data.labels[i];
    if (label !== null) return label;
    const lead = plan.start.state.sides[i].party[0];
    return lead === undefined ? 'Wild creature' : `Wild ${speciesName(lead.creature.speciesId)}`;
  };
  return [name(0), name(1)];
}

const NO_REWARDS = { money: 0, items: {}, trainerExp: 0, ratingDelta: null, badge: null } as const;

let running: { plan: ReplayPlan; next: number; pending: boolean; ended: boolean; feed: () => void; stop: () => void } | null = null;

/**
 * Starts a replay through `inject` (WorldSession.inject). Refused (false, with a toast) while a battle is open or when
 * the replay does not reproduce.
 */
export function startReplay(
  data: ReplaySource,
  deps: {
    readonly content: ContentIndex;
    readonly inject: ((m: ServerMessage) => void) | undefined;
    readonly speciesName: (id: string) => string;
    /** runs a delivery on a later task (default setTimeout 0; tests pass their own queue) */
    readonly defer?: (fn: () => void) => void;
    /** spectator mode: the live match (its feed may not have ended) */
    readonly live?: { readonly matchId: string; readonly kind: string; readonly finals: boolean; readonly outcome: BattleOutcome | null };
  },
): boolean {
  if (deps.inject === undefined) {
    toast('warn', 'Replays play in the world. Enter the world first.');
    return false;
  }
  if (useUiStore.getState().battle !== null) {
    toast('warn', 'Finish the battle first.');
    return false;
  }
  const live = deps.live ?? null;
  const planned = planReplay(data, deps.content, live !== null);
  const plan = planned !== null && live !== null && live.outcome !== null ? { ...planned, outcome: live.outcome } : planned;
  if (plan === null) {
    toast(
      'warn',
      'This replay was recorded with another version of the game and cannot be played.',
    );
    return false;
  }
  stopReplay();
  const inject = deps.inject;
  const labels = replayLabels(data, plan, deps.speciesName);
  // a watcher is nobody's side: the end names the winner (a shared replay keeps its sharer's point of view)
  if (live !== null) setSpectating(plan.battleId, [labels[0], labels[1]]);
  useReplayStore
    .getState()
    .set({
      battleId: plan.battleId,
      token: data.token,
      labels,
      seat: plan.seat,
      shown: 0,
      total: plan.steps.length,
      paused: false,
      live: live === null ? null : { matchId: live.matchId, kind: live.kind, finals: live.finals, over: plan.outcome !== null },
    });

  // every message is delivered on its own task, as a socket would: never from inside the controller's own callback
  // (the phase change that asks for the next step), and the battleEnd a task after the last battleEvents
  const defer = deps.defer ?? ((fn: () => void) => void setTimeout(fn, 0));
  const ready = (r: NonNullable<typeof running>): boolean => {
    const ui = useReplayStore.getState().replay;
    const b = useUiStore.getState().battle;
    if (running !== r || ui === null || ui.paused || b === null || b.battleId !== r.plan.battleId) return false;
    // the next step, or (a live match that has ended since its last step was shown) the battleEnd
    const more = r.next < r.plan.steps.length || (r.plan.outcome !== null && !r.ended);
    return (b.phase === 'selecting' || b.phase === 'replacement' || b.phase === 'submitted') && more;
  };
  const feed = (): void => {
    const r = running;
    if (r === null || r.pending || !ready(r)) return;
    r.pending = true;
    defer(() => {
      r.pending = false;
      if (!ready(r)) return;
      const end = (): void => {
        if (running !== r || r.ended || r.plan.outcome === null) return;
        r.ended = true;
        inject({ type: 'battleEnd', battleId: r.plan.battleId, outcome: r.plan.outcome, rewards: NO_REWARDS });
      };
      if (r.next >= r.plan.steps.length) {
        end();
        return;
      }
      const step = r.plan.steps[r.next]!;
      r.next += 1;
      const last = r.next === r.plan.steps.length;
      const ui = useReplayStore.getState().replay;
      if (ui !== null) useReplayStore.getState().set({ ...ui, shown: r.next });
      inject({ type: 'battleEvents', battleId: r.plan.battleId, turn: step.state.turn, events: step.events, stateDigest: step.digest, rng: step.state.rng });
      // the server's battleEnd follows the last battleEvents; the controller shows it once the timeline has played
      if (last && r.plan.outcome !== null) defer(end);
    });
  };

  const offUi = useUiStore.subscribe((st, prev) => {
    const r = running;
    if (r === null) return;
    const b = st.battle;
    // the battle closed (the result card's button, a real battle took over): the replay is over
    if (b === null || b.battleId !== r.plan.battleId) {
      if (prev.battle?.battleId === r.plan.battleId || b !== null) stopReplay();
      return;
    }
    if (b.phase !== prev.battle?.phase) feed();
  });
  const offReplay = useReplayStore.subscribe((st, prev) => {
    if (st.replay !== null && prev.replay !== null && prev.replay.paused && !st.replay.paused)
      feed();
  });
  running = {
    plan,
    next: 0,
    pending: false,
    ended: false,
    feed,
    stop: () => {
      offUi();
      offReplay();
    },
  };
  inject({
    type: 'battleStart',
    battleId: plan.battleId,
    format: plan.format,
    seat: plan.seat,
    state: plan.start.state,
    events: plan.start.events,
    stateDigest: plan.start.digest,
  });
  return true;
}

/**
 * Spectator mode: the live match's feed has more turns (or its outcome). The longer replay is planned again (the turns
 * already shown play out the same) and the next steps follow when the view is ready. False when it does not reproduce
 * (the replay stops) or another replay is on.
 */
export function extendReplay(data: ReplaySource, content: ContentIndex, outcome: BattleOutcome | null): boolean {
  const r = running;
  if (r === null || r.plan.battleId !== `${REPLAY_PREFIX}${data.token}`) return false;
  const planned = planReplay(data, content, true);
  if (planned === null || planned.steps.length < r.plan.steps.length) {
    toast('warn', 'The live battle could not be followed. It may have been played with another version of the game.');
    stopReplay();
    return false;
  }
  r.plan = { ...planned, outcome };
  const ui = useReplayStore.getState().replay;
  if (ui !== null) useReplayStore.getState().set({ ...ui, total: planned.steps.length, ...(ui.live !== null ? { live: { ...ui.live, over: outcome !== null } } : {}) });
  r.feed();
  return true;
}

export function setReplayPaused(paused: boolean): void {
  const ui = useReplayStore.getState().replay;
  if (ui !== null && ui.paused !== paused) useReplayStore.getState().set({ ...ui, paused });
}

/** Ends the running replay: the battle view closes if it is still the replay's. */
export function stopReplay(): void {
  const r = running;
  running = null;
  if (r === null) return;
  r.stop();
  setSpectating(r.plan.battleId, null);
  useReplayStore.getState().set(null);
  if (useUiStore.getState().battle?.battleId === r.plan.battleId) battleActions()?.dismissResult();
}
