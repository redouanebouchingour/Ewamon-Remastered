/**
 * Battle replays (client IMPLEMENTATION-NOTES "Battle replays"): a shared battle (GET /replay/:token) is re-simulated
 * with core (`replayBattle`, the server's own input) and played through the scene's normal battle path as if the server
 * sent it: `battleStart`, then one `battleEvents` per recorded step each time the previous step's timeline has played
 * (the controller leaves 'playing'), then `battleEnd`. Nothing is sent to the server; the replay's creatures have no
 * owner, so no evolve / learn-move prompt is queued. The battle id is `replay:<token>` (`isReplayBattle`).
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
  readonly outcome: BattleOutcome;
}

/**
 * The replay's states and events, or null when it does not reproduce its recorded final digest (made with other game
 * data than this client's, or tampered with) or never ends.
 */
export function planReplay(data: ReplayData, content: ContentIndex): ReplayPlan | null {
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
  if (run.finalDigest !== data.finalDigest || last.ended === null) return null;
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
  data: ReplayData,
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

let running: { plan: ReplayPlan; next: number; pending: boolean; stop: () => void } | null = null;

/**
 * Starts a replay through `inject` (WorldSession.inject). Refused (false, with a toast) while a battle is open or when
 * the replay does not reproduce.
 */
export function startReplay(
  data: ReplayData,
  deps: {
    readonly content: ContentIndex;
    readonly inject: ((m: ServerMessage) => void) | undefined;
    readonly speciesName: (id: string) => string;
    /** runs a delivery on a later task (default setTimeout 0; tests pass their own queue) */
    readonly defer?: (fn: () => void) => void;
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
  const plan = planReplay(data, deps.content);
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
    });

  // every message is delivered on its own task, as a socket would: never from inside the controller's own callback
  // (the phase change that asks for the next step), and the battleEnd a task after the last battleEvents
  const defer = deps.defer ?? ((fn: () => void) => void setTimeout(fn, 0));
  const ready = (r: NonNullable<typeof running>): boolean => {
    const ui = useReplayStore.getState().replay;
    const b = useUiStore.getState().battle;
    if (running !== r || ui === null || ui.paused || b === null || b.battleId !== r.plan.battleId) return false;
    return (b.phase === 'selecting' || b.phase === 'replacement' || b.phase === 'submitted') && r.next < r.plan.steps.length;
  };
  const feed = (): void => {
    const r = running;
    if (r === null || r.pending || !ready(r)) return;
    r.pending = true;
    defer(() => {
      r.pending = false;
      if (!ready(r)) return;
      const step = r.plan.steps[r.next]!;
      r.next += 1;
      const last = r.next === r.plan.steps.length;
      const ui = useReplayStore.getState().replay;
      if (ui !== null) useReplayStore.getState().set({ ...ui, shown: r.next });
      inject({ type: 'battleEvents', battleId: r.plan.battleId, turn: step.state.turn, events: step.events, stateDigest: step.digest, rng: step.state.rng });
      // the server's battleEnd follows the last battleEvents; the controller shows it once the timeline has played
      if (last) defer(() => running === r && inject({ type: 'battleEnd', battleId: r.plan.battleId, outcome: r.plan.outcome, rewards: NO_REWARDS }));
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
  useReplayStore.getState().set(null);
  if (useUiStore.getState().battle?.battleId === r.plan.battleId) battleActions()?.dismissResult();
}
