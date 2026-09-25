/**
 * §30.9 `liveOpsRollover` — every 60 s: when the UTC day (or ISO week) key changes, publish
 * `ewa:liveops { dayKey, weekKey }` so every room re-derives `spawns.setLiveOps(liveOpsModsFor(zone, now))`, and
 * delete synthetic daily/weekly quest rows older than 14 days.
 */
import type { Db, Repos } from '@ewa/persist';
import type { EventBus } from '../deps';
import type { Logger } from '../log';
import { DAILY_PREFIX, WEEKLY_PREFIX } from './missions';
import { DAY_MS, dayKey, weekKey } from './schedule';

export const ROLLOVER_CHECK_MS = 60_000;
export const SYNTHETIC_RETENTION_DAYS = 14;

export interface RolloverDeps {
  readonly repos: Repos & { readonly db: Db };
  readonly clock: () => number;
  readonly log: Logger;
  readonly bus: EventBus;
}

/** Deletes daily/weekly rows older than the retention window. Returns the number removed. */
export async function pruneSynthetic(deps: RolloverDeps, nowMs: number): Promise<number> {
  const cutoff = nowMs - SYNTHETIC_RETENTION_DAYS * DAY_MS;
  return deps.repos.db.transaction(async (tx) => {
    const d = await deps.repos.progress.pruneSyntheticQuests(tx, DAILY_PREFIX, dayKey(cutoff));
    const w = await deps.repos.progress.pruneSyntheticQuests(tx, WEEKLY_PREFIX, weekKey(cutoff));
    return d + w;
  });
}

/** One check: returns true when the day/week changed since `last` (and did the rollover work). */
export async function rolloverTick(deps: RolloverDeps, last: { dayKey: string; weekKey: string }): Promise<boolean> {
  const now = deps.clock();
  const dk = dayKey(now);
  const wk = weekKey(now);
  if (dk === last.dayKey && wk === last.weekKey) return false;
  last.dayKey = dk;
  last.weekKey = wk;
  deps.bus.publish('ewa:liveops', { dayKey: dk, weekKey: wk });
  const removed = await pruneSynthetic(deps, now);
  deps.log.info({ dayKey: dk, weekKey: wk, pruned: removed }, 'live-ops rollover');
  return true;
}

export function startLiveOpsRollover(deps: RolloverDeps, intervalMs: number = ROLLOVER_CHECK_MS): { stop(): void } {
  const now = deps.clock();
  const last = { dayKey: dayKey(now), weekKey: weekKey(now) };
  let running = false;
  const t = setInterval(() => {
    if (running) return;
    running = true;
    rolloverTick(deps, last)
      .catch((e: unknown) => deps.log.error({ err: e }, 'live-ops rollover failed'))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  t.unref();
  return { stop: () => clearInterval(t) };
}
