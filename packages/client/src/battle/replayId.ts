/**
 * Battle replays: a replay's battle id is `replay:<token>` (`battle/replay.ts`). Its own module so the session and
 * the battle UI can tell a replay apart without importing the replay driver.
 */
export const REPLAY_PREFIX = 'replay:';

export function isReplayBattle(battleId: string | null | undefined): boolean {
  return typeof battleId === 'string' && battleId.startsWith(REPLAY_PREFIX);
}

/** Spectator mode: the two players' names of a live match being watched, by its battle id (set by battle/replay.ts). */
const spectating = new Map<string, readonly [string, string]>();

export function setSpectating(battleId: string, names: readonly [string, string] | null): void {
  if (names === null) spectating.delete(battleId);
  else spectating.set(battleId, names);
}

/** The players' names when `battleId` is a live match being watched (the end names its winner), else null. */
export function spectatorNames(battleId: string | null | undefined): readonly [string, string] | null {
  return typeof battleId === 'string' ? (spectating.get(battleId) ?? null) : null;
}
