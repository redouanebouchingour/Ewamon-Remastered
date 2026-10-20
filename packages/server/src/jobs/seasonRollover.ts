/**
 * Ranked seasons (content seasons.ts): every minute, close each season that has ended and is not closed yet (its row
 * in `seasons` is the lock, so several processes never close one twice). Closing writes the final standings and
 * pulls every rating halfway back to the base; after a long outage only the last missed season resets.
 */
import { seasonAt, seasonByNumber } from '@ewa/content';
import type { Db, Repos } from '@ewa/persist';
import type { Logger } from '../log';

export const SEASON_ROLLOVER_MS = 60_000;

export interface SeasonRolloverDeps {
  readonly repos: Repos & { readonly db: Db };
  readonly clock: () => number;
  readonly log: Logger;
}

/** One run: closes every ended season after the last closed one. Returns the seasons this worker closed. */
export async function runSeasonRollover(deps: SeasonRolloverDeps, now: number = deps.clock()): Promise<number[]> {
  const { repos } = deps;
  const ended = seasonAt(now).number - 1;
  if (ended < 1) return [];
  const last = await repos.db.transaction((tx) => repos.seasons.lastClosed(tx));
  const closed: number[] = [];
  for (let n = Math.max(1, last + 1); n <= ended; n++) {
    const done = await repos.db.transaction((tx) => repos.seasons.close(tx, seasonByNumber(n), new Date(now), n === ended));
    if (done) closed.push(n);
  }
  return closed;
}

/** The 60 s loop started by `boot`; a run in flight is never overlapped by the next tick. */
export function startSeasonRollover(deps: SeasonRolloverDeps, intervalMs: number = SEASON_ROLLOVER_MS): { stop(): void } {
  let running = false;
  const run = (): void => {
    if (running) return;
    running = true;
    runSeasonRollover(deps)
      .then((n) => {
        if (n.length > 0) deps.log.info({ seasons: n }, 'season closed');
      })
      .catch((e: unknown) => deps.log.warn({ err: e }, 'season rollover failed'))
      .finally(() => {
        running = false;
      });
  };
  run();
  const t = setInterval(run, intervalMs);
  return { stop: () => clearInterval(t) };
}
