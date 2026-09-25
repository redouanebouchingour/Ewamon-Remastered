/**
 * Quest objective advancement (§3.4, §30.4.3 step 3g, §30.4.8 step 4) — one code path for every trigger.
 * Runs inside the caller's transaction; returns the touched entries for `progressionDelta.questProgress`.
 *
 * Active quests: every `QUESTS` row whose `requires` are all claimed and which is not claimed itself.
 * Count objectives (`catchSpecies`, `winBattles`) accumulate; every other kind is done on its first match.
 * `deliverItem` / `restoreZone` need flows owned by part 2 (NPC delivery, zone restoration) and are not
 * advanced here.
 *
 * §30.9.1 (part 2): the same call also advances today's daily missions (`daily:<dayKey>`) and this week's goals
 * (`weekly:<weekKey>`) — synthetic quest ids whose objective ids are mission ids — "one code path".
 */
import { QUESTS } from '@ewa/content';
import type { BadgeId, QuestDef, QuestObjective, ZoneId } from '@ewa/content';
import type { BattleFormat } from '@ewa/core';
import type { QuestProgressEntry } from '@ewa/protocol';
import type { Repos, Tx } from '@ewa/persist';
import { WEEKLY_GOALS, dailyMissionsFor, dailyQuestId, weeklyQuestId } from '../liveops/missions';
import type { DailyMetric, DailyMission } from '../liveops/missions';
import { dayKey, weekKey } from '../liveops/schedule';

export type QuestEvent =
  | { readonly kind: 'catch'; readonly species: string }
  | { readonly kind: 'win'; readonly format: BattleFormat }
  | { readonly kind: 'defeatTrainer'; readonly trainerId: string }
  | { readonly kind: 'flags'; readonly flags: readonly string[] }
  | { readonly kind: 'badge'; readonly badge: BadgeId }
  | { readonly kind: 'reachZone'; readonly zoneId: ZoneId }
  | { readonly kind: 'talkTo'; readonly npcId: string }
  /** an ended battle the player fought, any result (live-ops `pvpBattles`) */
  | { readonly kind: 'battle'; readonly format: BattleFormat }
  /** a species NEW to the player's dex (live-ops `newSpeciesSeen`) */
  | { readonly kind: 'seen'; readonly species: string }
  /** a completed trade (live-ops `tradesCompleted`) */
  | { readonly kind: 'trade' };

/** The live-ops metric an event counts toward (§30.9.1 DailyMetric), or null. */
export function metricOf(e: QuestEvent): DailyMetric | null {
  switch (e.kind) {
    case 'catch':
      return 'catches';
    case 'win':
      return e.format === 'wild' ? 'wildWins' : e.format === 'trainer' || e.format === 'league' ? 'trainerWins' : null;
    case 'battle':
      return e.format === 'pvp' ? 'pvpBattles' : null;
    case 'seen':
      return 'newSpeciesSeen';
    case 'reachZone':
      return 'zonesVisited';
    case 'trade':
      return 'tradesCompleted';
    default:
      return null;
  }
}

function target(o: QuestObjective): number {
  if (o.kind === 'catchSpecies' || o.kind === 'winBattles') return o.count;
  return 1;
}

function matches(o: QuestObjective, e: QuestEvent): boolean {
  switch (o.kind) {
    case 'catchSpecies':
      return e.kind === 'catch';
    case 'catchSpecific':
      return e.kind === 'catch' && e.species === o.species;
    case 'winBattles':
      return e.kind === 'win' && (o.format === 'any' || o.format === e.format);
    case 'defeatTrainer':
      return e.kind === 'defeatTrainer' && e.trainerId === o.trainerId;
    case 'flag':
      return e.kind === 'flags' && e.flags.includes(o.flag);
    case 'earnBadge':
      return e.kind === 'badge' && e.badge === o.badge;
    case 'reachZone':
      return e.kind === 'reachZone' && e.zoneId === o.zoneId;
    case 'talkTo':
      return e.kind === 'talkTo' && e.npcId === o.npcId;
    default:
      return false;
  }
}

/** Quest ids whose every objective is claimed. */
function claimedSet(all: Record<string, { claimedAt: Date | null }[]>): Set<string> {
  const out = new Set<string>();
  for (const [qid, rows] of Object.entries(all)) {
    if (rows.length > 0 && rows.every((r) => r.claimedAt !== null)) out.add(qid);
  }
  return out;
}

export function activeQuests(claimed: ReadonlySet<string>): readonly QuestDef[] {
  return QUESTS.filter((q) => !claimed.has(q.id) && q.requires.every((r) => claimed.has(r)));
}

export async function advanceQuests(tx: Tx, repos: Pick<Repos, 'progress'>, playerId: string, events: readonly QuestEvent[], nowMs: number = Date.now()): Promise<QuestProgressEntry[]> {
  if (events.length === 0) return [];
  const all = await repos.progress.allQuests(tx, playerId);
  const claimed = claimedSet(all);
  const touched: QuestProgressEntry[] = [];
  for (const q of activeQuests(claimed)) {
    const rows = all[q.id] ?? [];
    for (const obj of q.objectives) {
      const row = rows.find((r) => r.objectiveId === obj.id);
      if (row?.done === true || row?.claimedAt != null) continue;
      let count = row?.count ?? 0;
      let hit = false;
      for (const e of events) {
        if (!matches(obj.objective, e)) continue;
        hit = true;
        count += 1;
      }
      if (!hit) continue;
      const need = target(obj.objective);
      const done = count >= need;
      const clamped = Math.min(count, need);
      await repos.progress.advance(tx, playerId, q.id, obj.id, clamped, done);
      touched.push({ questId: q.id, objectiveId: obj.id, count: clamped, done });
    }
  }
  // §30.9.1 daily missions + weekly goals
  const synthetic: [string, readonly DailyMission[]][] = [
    [dailyQuestId(dayKey(nowMs)), dailyMissionsFor(dayKey(nowMs))],
    [weeklyQuestId(weekKey(nowMs)), WEEKLY_GOALS],
  ];
  for (const [questId, missions] of synthetic) {
    const rows = all[questId] ?? [];
    for (const m of missions) {
      const row = rows.find((r) => r.objectiveId === m.id);
      if (row?.done === true || row?.claimedAt != null) continue;
      let hits = 0;
      for (const e of events) if (metricOf(e) === m.metric) hits++;
      if (hits === 0) continue;
      const count = Math.min((row?.count ?? 0) + hits, m.target);
      const done = count >= m.target;
      await repos.progress.advance(tx, playerId, questId, m.id, count, done);
      touched.push({ questId, objectiveId: m.id, count, done });
    }
  }
  return touched;
}
