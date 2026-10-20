/**
 * Phase D14 — the battle tower (post-game, Solenne). One run per player, in memory, owned by the zone room:
 *
 *   tower { action: 'start', picks: [3 party creature ids] }   near the attendant, champion flag held, not busy
 *     → the streak's `current` is reset (a run starts at 0), fight 1 starts at once
 *   each fight: the three picks capped at `TOWER.levelCap` and fully healed (`capLevel`, synthetic `tower:` ids — the
 *     stored creatures are never written), against a team generated from `TOWER.pools[towerTier(wins)]` with a seed
 *     derived from (player, run, wins); `noExp`; no items
 *   battle end (BattleCoordinator end transaction): a win → `player_streaks.current + 1` (best kept as the max) and,
 *     every `TOWER.setLength` wins, `towerSetReward(set)` (money + items) in the same transaction; a loss or a draw →
 *     current 0 and the run is over
 *   tower { action: 'next' } → the next fight; tower { action: 'quit' } → the run ends (current 0, best kept)
 *   leaving the room (or a void / abandoned battle) ends the run the same way
 *
 * Every state change reaches the client as `towerState`. Refusals are `error { code, detail: TowerRefusal }` with a
 * toast. No Colyseus import: the room is a `TowerHost`.
 */
import { randomUUID } from 'node:crypto';
import { POSTGAME_FLAG, TOWER, interiorNpcs, towerTier, isFallen } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { capLevel, createRng } from '@ewa/core';
import type { BattleOutcome, ContentIndex, CreatureInstance } from '@ewa/core';
import type { ServerMessage, TowerRefusal } from '@ewa/protocol';
import type { Db, Repos } from '@ewa/persist';
import type { Logger } from '../log';
import { newCreature, withSyntheticId } from '../game/creatures';
import type { BattleAt, BattleCoordinator, BattleSession, PlayerSeat } from './battleSession';
import { toInstance } from './battleSession';

/** The NPC side's `trainerId` in every tower fight (the client names it from content's `TOWER.trainerName`). */
export const TOWER_TRAINER_ID = TOWER.trainerId;
/** `start` must be within this of the attendant (the interior NPC range of the client's prompt is 2.5 m). */
export const TOWER_RANGE_M = 3;
/** `next` may be sent from a little further (the player may step aside between fights). */
export const TOWER_NEXT_RANGE_M = 8;

export interface TowerDeps {
  readonly repos: Repos & { readonly db: Db };
  readonly content: ContentIndex;
  readonly clock: () => number;
  readonly log: Logger;
  readonly zoneId: ZoneId;
  readonly battles: BattleCoordinator;
  readonly send: (playerId: string, msg: ServerMessage) => void;
}

/** What the room knows about the asking player. */
export interface TowerAsker {
  readonly seat: PlayerSeat;
  readonly flags: ReadonlySet<string>;
  readonly x: number;
  readonly z: number;
  /** in a battle or a trade */
  readonly busy: boolean;
  /** where a fight forms (the room's `battleAt`) */
  readonly at: BattleAt;
}

interface Run {
  readonly id: string;
  readonly picks: readonly string[];
  /** wins in this run (= player_streaks.current while the run lives) */
  wins: number;
  best: number;
  battleId: string | null;
}

/** The attendant's world position in this zone, or null (no tower here). */
export function towerAttendant(zoneId: ZoneId): { readonly x: number; readonly z: number } | null {
  const n = interiorNpcs(zoneId).find((x) => x.id === TOWER.attendantId);
  return n === undefined ? null : { x: n.x, z: n.z };
}

/**
 * The generated opponents for the fight after `wins` wins: `TOWER.teamSize` distinct species from the streak tier's
 * pool, each at `TOWER.levelCap` with its level-up moves and a seeded ability. Pure and deterministic in `seed`.
 */
export function towerTeam(seed: string, wins: number, content: ContentIndex): CreatureInstance[] {
  const rng = createRng(seed);
  const pool = rng.shuffle(TOWER.pools[towerTier(wins)]!);
  const out: CreatureInstance[] = [];
  for (let i = 0; i < TOWER.teamSize && i < pool.length; i++) {
    const sp = content.species(pool[i]!);
    const ability = sp.abilities[rng.int(sp.abilities.length)]!;
    out.push(withSyntheticId(newCreature(content, sp.id, TOWER.levelCap, { ability }), `tower:foe:${i}`));
  }
  return out;
}

/** A run's position: `set` (1-based) and `fight` within it (1..setLength) for the fight after `wins` wins. */
export function towerPosition(wins: number): { readonly set: number; readonly fight: number } {
  return { set: Math.floor(wins / TOWER.setLength) + 1, fight: (wins % TOWER.setLength) + 1 };
}

export class TowerSessions {
  private readonly runs = new Map<string, Run>();

  constructor(private readonly deps: TowerDeps) {}

  /** The player's run, for tests and the room's busy checks. */
  runOf(playerId: string): { readonly wins: number; readonly best: number; readonly picks: readonly string[]; readonly battleId: string | null } | null {
    return this.runs.get(playerId) ?? null;
  }

  get size(): number {
    return this.runs.size;
  }

  async start(a: TowerAsker, picks: readonly string[]): Promise<void> {
    const pid = a.seat.playerId;
    const where = towerAttendant(this.deps.zoneId);
    if (where === null) return this.refuse(pid, 'tooFar', 'There is no battle tower here.');
    if (!a.flags.has(POSTGAME_FLAG)) return this.refuse(pid, 'locked', 'The battle tower opens to the Champion.');
    if (this.runs.has(pid)) return this.refuse(pid, 'running', 'You are already on a tower run.');
    if (a.busy) return this.refuse(pid, 'inBattle', 'Finish what you are doing first.');
    if (Math.hypot(a.x - where.x, a.z - where.z) > TOWER_RANGE_M) return this.refuse(pid, 'tooFar', 'Talk to the Tower Attendant to start a run.');
    if (new Set(picks).size !== TOWER.teamSize || picks.length !== TOWER.teamSize) return this.refuse(pid, 'badPicks', `Choose ${TOWER.teamSize} different creatures.`);
    const { repos, clock } = this.deps;
    const r = await repos.db.transaction(async (tx) => {
      const party = await repos.creatures.party(tx, pid);
      // a fallen creature (challenge modes) never fights again, not even as a tower copy
      if (!picks.every((id) => party.some((c) => c.id === id && !isFallen(c)))) return null;
      return repos.streaks.endRun(tx, pid, new Date(clock()));
    });
    if (r === null) return this.refuse(pid, 'badPicks', `Choose ${TOWER.teamSize} creatures from your party.`);
    if (this.runs.has(pid)) return this.refuse(pid, 'running', 'You are already on a tower run.');
    const run: Run = { id: randomUUID(), picks: [...picks], wins: 0, best: r.best, battleId: null };
    this.runs.set(pid, run);
    await this.fight(pid, run, a);
  }

  async next(a: TowerAsker): Promise<void> {
    const pid = a.seat.playerId;
    const run = this.runs.get(pid);
    if (run === undefined) return this.refuse(pid, 'noRun', 'You are not on a tower run.');
    if (run.battleId !== null || a.busy) return this.refuse(pid, 'inBattle', 'Finish this fight first.');
    const where = towerAttendant(this.deps.zoneId);
    if (where === null || Math.hypot(a.x - where.x, a.z - where.z) > TOWER_NEXT_RANGE_M) return this.refuse(pid, 'tooFar', 'Go back to the Tower Attendant.');
    await this.fight(pid, run, a);
  }

  /** Retire between fights: the run ends (current 0, best kept). */
  async quit(playerId: string): Promise<void> {
    const run = this.runs.get(playerId);
    if (run === undefined) return this.refuse(playerId, 'noRun', 'You are not on a tower run.');
    if (run.battleId !== null) return this.refuse(playerId, 'inBattle', 'Finish this fight first.');
    await this.end(playerId, run, 'ended');
  }

  /** The player left the room: the run ends quietly. */
  async onLeave(playerId: string): Promise<void> {
    const run = this.runs.get(playerId);
    if (run === undefined) return;
    await this.end(playerId, run, null);
  }

  /**
   * The room's `onEnd` for a tower battle. A finished fight already wrote the streak in its end transaction
   * (`session.towerResult`); a void / abandoned one wrote nothing and ends the run here.
   */
  async onBattleEnd(session: BattleSession, outcome: BattleOutcome | 'void' | 'playerLeft'): Promise<void> {
    const pid = session.seats[0].playerId;
    if (pid === null) return;
    const run = this.runs.get(pid);
    if (run === undefined || run.battleId !== session.id) return;
    run.battleId = null;
    const res = session.towerResult;
    if (outcome === 'void' || outcome === 'playerLeft' || res === undefined) {
      await this.end(pid, run, 'lost');
      return;
    }
    run.best = res.streak.best;
    if (!res.won) {
      this.runs.delete(pid);
      this.state(pid, run, 'lost', null);
      return;
    }
    run.wins = res.streak.current;
    this.state(pid, run, 'won', res.reward);
  }

  dispose(): void {
    this.runs.clear();
  }

  // ─── internals ──────────────────────────────────────────────────────────────

  private async fight(pid: string, run: Run, a: TowerAsker): Promise<void> {
    const { repos, content } = this.deps;
    const party = await repos.db.transaction((tx) => repos.creatures.party(tx, pid));
    const mine = run.picks.map((id) => party.find((c) => c.id === id));
    if (mine.some((c) => c === undefined)) {
      // a pick left the party (released, traded, boxed) between fights: the run cannot go on
      this.deps.send(pid, { type: 'toast', level: 'warn', text: 'One of your tower creatures has left your party. The run is over.' });
      await this.end(pid, run, 'ended');
      return;
    }
    const picks = mine.map((c) => withSyntheticId(capLevel(toInstance(c!), TOWER.levelCap, content), `tower:${c!.id}`));
    const foes = towerTeam(`${run.id}:${run.wins}`, run.wins, content);
    const res = this.deps.battles.startTower(a.seat, picks, foes, TOWER_TRAINER_ID, a.at);
    if (!res.ok) {
      this.deps.send(pid, { type: 'error', code: res.code, detail: res.detail });
      return;
    }
    run.battleId = res.session.id;
    this.state(pid, run, 'fighting', null);
  }

  private async end(pid: string, run: Run, phase: 'ended' | 'lost' | null): Promise<void> {
    this.runs.delete(pid);
    const { repos, clock, log } = this.deps;
    const r = await repos.db.transaction((tx) => repos.streaks.endRun(tx, pid, new Date(clock()))).catch((e: unknown) => {
      log.error({ err: e, playerId: pid }, 'tower endRun failed');
      return null;
    });
    if (r !== null) run.best = r.best;
    if (phase !== null) this.state(pid, run, phase, null);
  }

  /**
   * `towerState`: `set` / `fight` name the fight starting ('fighting'), just won ('won'), lost ('lost') or next in line
   * ('ended'); `streak` is player_streaks.current after the event (0 once the run is over), `runWins` the run's wins.
   */
  private state(pid: string, run: Run, phase: 'fighting' | 'won' | 'lost' | 'ended', reward: { readonly money: number; readonly items: Readonly<Record<string, number>> } | null): void {
    const pos = towerPosition(phase === 'won' ? run.wins - 1 : run.wins);
    this.deps.send(pid, {
      type: 'towerState',
      phase,
      streak: phase === 'lost' || phase === 'ended' ? 0 : run.wins,
      runWins: run.wins,
      best: run.best,
      set: pos.set,
      fight: pos.fight,
      picks: [...run.picks],
      reward: reward === null ? null : { money: reward.money, items: { ...reward.items } },
    });
  }

  private refuse(pid: string, detail: TowerRefusal, text: string): void {
    this.deps.send(pid, { type: 'toast', level: 'warn', text });
    this.deps.send(pid, { type: 'error', code: 'notAllowed', detail });
  }
}
