/**
 * Battle replays: a battle_history row made public. `shareableReplay` checks that the row still replays to its
 * recorded final digest (the content may have changed since), strips every player and creature uuid (core never
 * reads ids, so the battle plays out the same), and records the anonymised run's own final digest for the viewer to
 * check against. Pure over (row, sharer, content).
 */
import { replayBattle } from '@ewa/core';
import type { ContentIndex, CreateBattleOpts, SideChoice } from '@ewa/core';
import type { BattleHistoryRow, BattleStartSnapshot, SharedReplay } from '@ewa/persist';
import { REPLAY_BATTLE_ID } from '@ewa/protocol';

/** The createBattle input of a stored battle: exactly what BattleCoordinator.open passed (the arena kind is not an input). */
export function replayOpts(id: string, format: CreateBattleOpts['format'], seed: CreateBattleOpts['seed'], start: BattleStartSnapshot): CreateBattleOpts {
  return {
    id,
    format,
    zoneId: start.zoneId,
    terrain: start.terrain as CreateBattleOpts['terrain'],
    seed,
    sides: start.sides as unknown as CreateBattleOpts['sides'],
    ...(start.weather !== undefined ? { weather: start.weather as NonNullable<CreateBattleOpts['weather']> } : {}),
    ...(start.slots !== undefined ? { slots: start.slots } : {}),
    ...(start.noExp !== undefined ? { noExp: start.noExp } : {}),
  };
}

type Json = Record<string, unknown>;

/** The start snapshot with player trainers as `r:<side>`, every creature as `r:<side>:<i>` and every owner null. */
export function anonymiseStart(start: BattleStartSnapshot): BattleStartSnapshot {
  const copy = JSON.parse(JSON.stringify(start)) as BattleStartSnapshot;
  const sides = copy.sides.map((raw, i) => {
    const side = raw as Json;
    const party = Array.isArray(side['party']) ? (side['party'] as Json[]) : [];
    return {
      ...side,
      ...(side['kind'] === 'player' ? { trainerId: `r:${i}` } : {}),
      party: party.map((b, j) => ({ ...b, creature: { ...(b['creature'] as Json), id: `r:${i}:${j}`, ownerId: null } })),
    };
  });
  return { ...copy, sides: [sides[0], sides[1]] };
}

/** The sharer's side: the player side whose trainer is the sharer (side 0 when none matches). */
export function seatOf(start: BattleStartSnapshot, playerId: string): 0 | 1 {
  const s1 = start.sides[1] as Json;
  return s1['kind'] === 'player' && s1['trainerId'] === playerId ? 1 : 0;
}

export type ShareRefusal = 'notReplayable' | 'stale';

/**
 * The public replay of one history row, or why there is none: `notReplayable` for a row written before replays were
 * recorded (no start / final digest), `stale` when the row no longer replays to its own final digest.
 */
export function shareableReplay(row: BattleHistoryRow, sharer: string, content: ContentIndex): SharedReplay | ShareRefusal {
  if (row.start === null || row.finalDigest === null) return 'notReplayable';
  const actions = row.actions as unknown as readonly (readonly [SideChoice, SideChoice])[];
  let original: string;
  try {
    original = replayBattle(replayOpts(row.battleId, row.format, row.seed, row.start), actions, content).finalDigest;
  } catch (_e) {
    return 'stale';
  }
  if (original !== row.finalDigest) return 'stale';
  const start = anonymiseStart(row.start);
  const run = replayBattle(replayOpts(REPLAY_BATTLE_ID, row.format, row.seed, start), actions, content);
  const seat = seatOf(row.start, row.playerId);
  const label = (i: 0 | 1): string | null => {
    if (i === seat) return sharer;
    return (start.sides[i] as Json)['kind'] === 'wild' ? null : row.opponent;
  };
  return {
    format: row.format,
    seat,
    labels: [label(0), label(1)],
    result: row.result as SharedReplay['result'],
    turns: row.turns,
    happenedAt: row.happenedAt.toISOString(),
    seed: row.seed,
    start,
    actions: row.actions,
    finalDigest: run.finalDigest,
  };
}
