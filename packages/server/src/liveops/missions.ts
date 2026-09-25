/**
 * §30.9.1 daily / weekly rewards — the shapes the spec places in `packages/content/src/liveops.ts`. Content does not
 * ship them yet (and is owned by another agent), so the DATA lives here until it moves (IMPLEMENTATION-NOTES part 2,
 * Q11). Adapted from the legacy liveOps.js pools (STANDARD_DAILY_POOLS, WEEKLY_GOALS) onto the spec's DailyMetric set;
 * legacy rewards were items only, the spec's reward shape adds money.
 *
 * Pure: day/week keys in, missions out. `dailyMissionsFor(dayKey)` = 3 distinct picks by fnv1a32(dayKey) % pool.
 */
import { fnv1a32 } from '@ewa/core';

export type DailyMetric = 'catches' | 'wildWins' | 'trainerWins' | 'pvpBattles' | 'newSpeciesSeen' | 'zonesVisited' | 'tradesCompleted';

export interface DailyMission {
  readonly id: string;
  readonly title: string;
  readonly metric: DailyMetric;
  readonly target: number;
  readonly reward: { readonly money: number; readonly items: Readonly<Record<string, number>> };
}

/** The rotating pool (3 picked per UTC day). */
export const DAILY_MISSIONS: readonly DailyMission[] = [
  { id: 'daily-catch-one', title: 'Catch 1 creature', metric: 'catches', target: 1, reward: { money: 100, items: { spark_orb: 1 } } },
  { id: 'daily-catch-two', title: 'Catch 2 creatures', metric: 'catches', target: 2, reward: { money: 150, items: { spark_orb: 2 } } },
  { id: 'daily-wild-wins', title: 'Win 3 wild battles', metric: 'wildWins', target: 3, reward: { money: 150, items: { potion: 2 } } },
  { id: 'daily-trainer-win', title: 'Win 1 trainer battle', metric: 'trainerWins', target: 1, reward: { money: 200, items: { potion: 1 } } },
  { id: 'daily-pvp', title: 'Fight 1 PvP battle', metric: 'pvpBattles', target: 1, reward: { money: 200, items: { crest_orb: 1 } } },
  { id: 'daily-sightings', title: 'Register 2 new sightings', metric: 'newSpeciesSeen', target: 2, reward: { money: 100, items: { spark_orb: 1 } } },
  { id: 'daily-zone-scout', title: 'Visit 2 zones', metric: 'zonesVisited', target: 2, reward: { money: 100, items: { potion: 1 } } },
  { id: 'daily-trade', title: 'Complete 1 trade', metric: 'tradesCompleted', target: 1, reward: { money: 150, items: { crest_orb: 1 } } },
];

/** Exactly 3, fixed (legacy WEEKLY_GOALS on the spec's metrics). */
export const WEEKLY_GOALS: readonly DailyMission[] = [
  { id: 'weekly-frontier-haul', title: 'Catch 5 creatures this week', metric: 'catches', target: 5, reward: { money: 500, items: { crest_orb: 2, potion: 2 } } },
  { id: 'weekly-challenger', title: 'Win 2 trainer or league battles', metric: 'trainerWins', target: 2, reward: { money: 600, items: { prism_orb: 1, superpotion: 1 } } },
  { id: 'weekly-competitive', title: 'Fight 3 PvP battles', metric: 'pvpBattles', target: 3, reward: { money: 800, items: { prism_orb: 2 } } },
];

/** 7 rows; day 7 repeats for every streak ≥ 7. */
export const LOGIN_STREAK: readonly { readonly day: number; readonly money: number; readonly items: Readonly<Record<string, number>> }[] = [
  { day: 1, money: 100, items: {} },
  { day: 2, money: 150, items: { potion: 1 } },
  { day: 3, money: 200, items: { spark_orb: 3 } },
  { day: 4, money: 250, items: { potion: 2 } },
  { day: 5, money: 300, items: { crest_orb: 1 } },
  { day: 6, money: 350, items: { superpotion: 1 } },
  { day: 7, money: 500, items: { prism_orb: 1 } },
];

export const DAILY_PICKS = 3;
export const DAILY_PREFIX = 'daily:';
export const WEEKLY_PREFIX = 'weekly:';

/** 3 distinct missions for a UTC day: start at fnv1a32(dayKey) % pool, then walk the pool with a key-derived stride. */
export function dailyMissionsFor(dayKey: string): readonly DailyMission[] {
  const n = DAILY_MISSIONS.length;
  const h = fnv1a32(dayKey);
  const out: DailyMission[] = [];
  let i = h % n;
  // stride coprime with n (n = 8: any odd stride) so the walk visits distinct entries
  const stride = ((h >>> 8) % (n - 1)) | 1;
  for (let step = 0; step < 2 * n && out.length < Math.min(DAILY_PICKS, n); step++) {
    const m = DAILY_MISSIONS[i]!;
    if (!out.includes(m)) out.push(m);
    i = (i + stride) % n;
  }
  // a pool size sharing a factor with the stride could cycle early: fill in pool order
  for (const m of DAILY_MISSIONS) if (out.length < Math.min(DAILY_PICKS, n) && !out.includes(m)) out.push(m);
  return out;
}

export function dailyQuestId(dayKey: string): string {
  return `${DAILY_PREFIX}${dayKey}`;
}

export function weeklyQuestId(weekKey: string): string {
  return `${WEEKLY_PREFIX}${weekKey}`;
}

/** The mission set a synthetic quest id stands for (null for an id that is not daily/weekly). */
export function missionsForQuest(questId: string): readonly DailyMission[] | null {
  if (questId.startsWith(DAILY_PREFIX)) return dailyMissionsFor(questId.slice(DAILY_PREFIX.length));
  if (questId.startsWith(WEEKLY_PREFIX)) return WEEKLY_GOALS;
  return null;
}

export function streakReward(streak: number): (typeof LOGIN_STREAK)[number] {
  return LOGIN_STREAK[Math.min(Math.max(streak, 1), LOGIN_STREAK.length) - 1]!;
}
