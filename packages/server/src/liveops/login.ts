/**
 * §30.9.1 daily login: on the first `POST /auth/login` or room join of a UTC day, `addTrainerExp(dailyLogin)` and the
 * streak row for `min(streak, 7)`. The streak lives in `story_flags` (`streak:<n>` + `streak:last:<dayKey>`) — no
 * schema change. Runs inside the caller's transaction with the player row locked, so a login and a join racing on
 * the same day grant it once.
 */
import { TRAINER_EXP } from '@ewa/core';
import type { Repos, Tx } from '@ewa/persist';
import { streakReward } from './missions';
import { DAY_MS, dayKey } from './schedule';

export const STREAK_PREFIX = 'streak:';
export const STREAK_LAST_PREFIX = 'streak:last:';

/** The current streak encoded in a flag list (0 when none). */
export function streakFromFlags(flags: readonly string[]): number {
  let n = 0;
  for (const f of flags) {
    if (!f.startsWith(STREAK_PREFIX) || f.startsWith(STREAK_LAST_PREFIX)) continue;
    const v = Number(f.slice(STREAK_PREFIX.length));
    if (Number.isInteger(v) && v > n) n = v;
  }
  return n;
}

/** The streak a player shows at `nowMs`: kept when the last login was today or yesterday, else 0. */
export function liveStreak(flags: readonly string[], nowMs: number): number {
  const today = dayKey(nowMs);
  const yesterday = dayKey(nowMs - DAY_MS);
  if (flags.includes(`${STREAK_LAST_PREFIX}${today}`) || flags.includes(`${STREAK_LAST_PREFIX}${yesterday}`)) return streakFromFlags(flags);
  return 0;
}

export interface DailyLoginGrant {
  readonly streak: number;
  readonly money: number;
  readonly items: Readonly<Record<string, number>>;
  readonly trainerExp: number;
  readonly trainerLevel: number;
  /** absolute counts of the granted items */
  readonly inventory: Readonly<Record<string, number>>;
  readonly flags: readonly string[];
}

/** Grants today's login reward once; null when already granted today. */
export async function dailyLogin(tx: Tx, repos: Pick<Repos, 'players' | 'progress' | 'inventory' | 'audit'>, playerId: string, nowMs: number): Promise<DailyLoginGrant | null> {
  await repos.players.lock(tx, playerId);
  const flags = await repos.progress.flags(tx, playerId);
  const today = dayKey(nowMs);
  if (flags.includes(`${STREAK_LAST_PREFIX}${today}`)) return null;
  const continued = flags.includes(`${STREAK_LAST_PREFIX}${dayKey(nowMs - DAY_MS)}`);
  const streak = continued ? streakFromFlags(flags) + 1 : 1;
  const stale = flags.filter((f) => f.startsWith(STREAK_PREFIX));
  await repos.progress.clearFlags(tx, playerId, stale);
  const set = [`${STREAK_PREFIX}${streak}`, `${STREAK_LAST_PREFIX}${today}`];
  const now = new Date(nowMs);
  await repos.progress.setFlags(tx, playerId, set, now);
  const reward = streakReward(streak);
  const money = reward.money > 0 ? await repos.players.addMoney(tx, playerId, reward.money) : (await repos.players.byId(tx, playerId))!.money;
  const inventory = Object.keys(reward.items).length > 0 ? await repos.inventory.addMany(tx, playerId, reward.items) : {};
  const exp = await repos.players.addTrainerExp(tx, playerId, TRAINER_EXP.dailyLogin);
  await repos.audit.write(tx, { actorId: playerId, action: 'liveops.login', subject: today, detail: { streak } }, now);
  return { streak, money, items: reward.items, trainerExp: exp.trainerExp, trainerLevel: exp.trainerLevel, inventory, flags: set };
}
