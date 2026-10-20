import { digestBattleState } from './digest';
import { createBattle, resolveTurn } from './turn';
import type { BattleEvent, BattleState, ContentIndex, CreateBattleOpts, SideChoice } from './types';

/** One resolved step of a replay: the choices fed to resolveTurn and what they produced. */
export interface ReplayStep {
  readonly choices: readonly [SideChoice, SideChoice];
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
  readonly digest: string;
}

export interface ReplayRun {
  readonly start: { readonly state: BattleState; readonly events: readonly BattleEvent[]; readonly digest: string };
  /** one entry per resolveTurn call (a replacement phase is its own step, so steps can outnumber `turn`) */
  readonly steps: readonly ReplayStep[];
  /** the digest of the last state (the start's when there are no steps) */
  readonly finalDigest: string;
}

/**
 * §2.21 Replays: a battle from its createBattle input and the recorded choices, step by step. Pure: the same opts,
 * choices and content always give the same states, events and digests (the server's `battle_history` row replays
 * alone). Throws what createBattle / resolveTurn throw (an invalid choice, a choice after the battle ended).
 */
export function replayBattle(opts: CreateBattleOpts, choices: readonly (readonly [SideChoice, SideChoice])[], content: ContentIndex): ReplayRun {
  const created = createBattle(opts, content);
  const start = { state: created.state, events: created.events, digest: digestBattleState(created.state) };
  const steps: ReplayStep[] = [];
  let state = created.state;
  for (const c of choices) {
    const r = resolveTurn(state, c, content);
    state = r.state;
    steps.push({ choices: c, state: r.state, events: r.events, digest: digestBattleState(r.state) });
  }
  return { start, steps, finalDigest: steps.length === 0 ? start.digest : steps[steps.length - 1]!.digest };
}
