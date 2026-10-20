/**
 * Battle replays: a replay's battle id is `replay:<token>` (`battle/replay.ts`). Its own module so the session and
 * the battle UI can tell a replay apart without importing the replay driver.
 */
export const REPLAY_PREFIX = 'replay:';

export function isReplayBattle(battleId: string | null | undefined): boolean {
  return typeof battleId === 'string' && battleId.startsWith(REPLAY_PREFIX);
}
