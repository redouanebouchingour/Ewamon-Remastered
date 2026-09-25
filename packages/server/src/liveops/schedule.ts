/**
 * §30.9.2 seasonal variant schedule, swarms, hotspots — pure functions of (zoneId, now). All schedules are UTC:
 * "day" = UTC calendar day, "week" = ISO week (Monday 00:00 UTC).
 *
 * - `WEEKDAY_VARIANT[weekday]` → `LiveOpsMods.variantPool` (null → the 4 non-normal keys)
 * - `SEASONAL_EVENTS` active at `now` for zones in `featuredZones` → alpha/variant bonuses; `featuredSpecies` get
 *   +0.025 variant / +0.01 alpha when rolled (legacy constants, kept) — `LiveOpsMods.featuredSpecies` (Q12)
 * - `DAILY_SWARMS[weekday]` → swarmSpecies + swarmWeightBoost for that zone only
 * - `RAID_HOTSPOTS` whose UTC window is open at `now`
 */
import { DAILY_SWARMS, RAID_HOTSPOTS, SEASONAL_EVENTS, WEEKDAY_VARIANT } from '@ewa/content';
import type { RaidHotspot, SeasonalEvent, Weekday, ZoneId } from '@ewa/content';
import { DEFAULT_LIVE_OPS, NON_NORMAL_VARIANTS } from '../rooms/spawnDirector';
import type { LiveOpsMods } from '../rooms/spawnDirector';
import { WEEKLY_GOALS, dailyMissionsFor } from './missions';

export { FEATURED_ALPHA_BONUS, FEATURED_VARIANT_BONUS } from '../rooms/spawnDirector';

export const DAY_MS = 86_400_000;

/** UTC calendar day key `YYYY-MM-DD`. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** ISO week key `YYYY-Www` (Monday 00:00 UTC). */
export function weekKey(ms: number): string {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function weekdayOf(ms: number): Weekday {
  return new Date(ms).getUTCDay() as Weekday;
}

export function activeEvents(ms: number): readonly SeasonalEvent[] {
  return SEASONAL_EVENTS.filter((e) => Date.parse(e.startsAt) <= ms && ms < Date.parse(e.endsAt));
}

/** The spawn director's mods for one zone at `ms` (re-derived at every UTC day rollover). */
export function liveOpsModsFor(zoneId: ZoneId, ms: number): LiveOpsMods {
  const weekday = weekdayOf(ms);
  const variant = WEEKDAY_VARIANT[weekday];
  let alphaBonus = DEFAULT_LIVE_OPS.alphaBonus;
  let variantBonus = DEFAULT_LIVE_OPS.variantBonus;
  const featured: string[] = [];
  for (const e of activeEvents(ms)) {
    if (!e.featuredZones.includes(zoneId)) continue;
    alphaBonus += e.alphaBonus;
    variantBonus += e.variantBonus;
    for (const sp of e.featuredSpecies) if (!featured.includes(sp)) featured.push(sp);
  }
  const swarm = DAILY_SWARMS[weekday];
  const swarmHere = swarm !== undefined && swarm.zoneId === zoneId;
  return {
    alphaBonus,
    variantBonus,
    swarmSpecies: swarmHere ? [...swarm.species] : [],
    swarmWeightBoost: swarmHere ? swarm.weightBoost : 1,
    variantPool: variant === null ? NON_NORMAL_VARIANTS : [variant],
    featuredSpecies: featured,
  };
}

/** Minutes since UTC midnight for the window arithmetic. */
function minuteOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Is the hotspot's daily UTC window `[utcHour:00, utcHour:00 + minutes)` open at `ms`? (wraps midnight) */
export function hotspotOpen(h: RaidHotspot, ms: number): boolean {
  const start = h.window.utcHour * 60;
  const end = start + h.window.minutes;
  const m = minuteOfDay(ms);
  if (end <= 1440) return m >= start && m < end;
  return m >= start || m < end - 1440;
}

/** ms at which the current window of `h` closes (only meaningful while open). */
export function hotspotClosesAt(h: RaidHotspot, ms: number): number {
  const d = new Date(ms);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const startToday = midnight + h.window.utcHour * 60_000 * 60;
  const start = ms >= startToday ? startToday : startToday - DAY_MS;
  return start + h.window.minutes * 60_000;
}

/** The day key a window belongs to (the day its start falls on) — the raid election key `ewa:raid:<id>:<dayKey>`. */
export function hotspotDayKey(h: RaidHotspot, ms: number): string {
  return dayKey(hotspotClosesAt(h, ms) - h.window.minutes * 60_000);
}

export function hotspotsFor(zoneId: ZoneId): readonly RaidHotspot[] {
  return RAID_HOTSPOTS.filter((h) => h.zoneId === zoneId);
}

/** `GET /me.liveOps` (spine LiveOpsSummary is open — loose schema): the §30.9 summary for the client. */
export function liveOpsSummary(ms: number, loginStreak: number) {
  const weekday = weekdayOf(ms);
  const swarm = DAILY_SWARMS[weekday] ?? null;
  return {
    dayKey: dayKey(ms),
    weekKey: weekKey(ms),
    weekdayVariant: WEEKDAY_VARIANT[weekday],
    loginStreak,
    dailyMissions: dailyMissionsFor(dayKey(ms)).map((m) => ({ id: m.id, title: m.title, metric: m.metric, target: m.target, reward: m.reward })),
    weeklyGoals: WEEKLY_GOALS.map((m) => ({ id: m.id, title: m.title, metric: m.metric, target: m.target, reward: m.reward })),
    swarm: swarm === null ? null : { zoneId: swarm.zoneId, species: [...swarm.species], weightBoost: swarm.weightBoost },
    events: activeEvents(ms).map((e) => ({ id: e.id, name: e.name, endsAt: e.endsAt, featuredZones: [...e.featuredZones], featuredSpecies: [...e.featuredSpecies] })),
    raids: RAID_HOTSPOTS.map((h) => ({ id: h.id, zoneId: h.zoneId, x: h.x, z: h.z, boss: h.boss.species, level: h.boss.level, minBadges: h.minBadges, utcHour: h.window.utcHour, minutes: h.window.minutes, open: hotspotOpen(h, ms) })),
  };
}
