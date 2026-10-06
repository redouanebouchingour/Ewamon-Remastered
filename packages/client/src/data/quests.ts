/**
 * Phase B3 — the story quests (and, Phase D5, the achievements) as the journal and the HUD hint read them: content `QUESTS` + the player's
 * `progression.quests` (questId → objectiveId → {count, done}) and `questsClaimed`. Mirrors the server's rules
 * (`game/quests.ts`): a quest is active once every `requires` is claimed; count objectives (`catchSpecies`,
 * `winBattles`) need `count`, every other kind is done on its first match; a quest is claimable when every
 * objective is done (POST /quests/claim re-checks).
 */
import { QUESTS, zone as zoneDef } from '@ewa/content';
import type { Act, QuestDef, QuestObjective, ZoneId } from '@ewa/content';
import type { Progression } from '../state/session';
import { itemInfo, speciesName, zoneName } from './content';

export type QuestStatus = 'locked' | 'active' | 'ready' | 'claimed';

export function objectiveTarget(o: QuestObjective): number {
  switch (o.kind) {
    case 'catchSpecies':
    case 'winBattles':
    case 'dexCaught':
    case 'catchTier':
    case 'completeTrades':
    case 'clearRaids':
      return o.count;
    case 'loginStreak':
      return o.days;
    default:
      return 1;
  }
}

export interface ObjectiveView {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly target: number;
  readonly done: boolean;
}

type QuestProgress = Pick<Progression, 'quests' | 'questsClaimed'>;

export function objectivesOf(q: QuestDef, p: QuestProgress | null): ObjectiveView[] {
  const rows = p?.quests[q.id];
  return q.objectives.map((o) => {
    const target = objectiveTarget(o.objective);
    const row = rows?.[o.id];
    const done = row?.done ?? false;
    return { id: o.id, label: o.label, target, done, count: done ? target : Math.min(target, row?.count ?? 0) };
  });
}

export function questStatus(q: QuestDef, p: QuestProgress | null): QuestStatus {
  const claimed = p?.questsClaimed ?? [];
  if (claimed.includes(q.id)) return 'claimed';
  if (!q.requires.every((r) => claimed.includes(r))) return 'locked';
  return objectivesOf(q, p).every((o) => o.done) ? 'ready' : 'active';
}

export function questById(id: string): QuestDef | undefined {
  return QUESTS.find((q) => q.id === id);
}

/** Story quests whose rewards are ready to claim (the nav count). */
export function readyCount(p: QuestProgress | null): number {
  if (p === null) return 0;
  let n = 0;
  for (const q of QUESTS) if (questStatus(q, p) === 'ready') n++;
  return n;
}

/** "Prof. Hessa · Mirevale" — the giver (an NPC name from the zone) and where the quest is given. */
export function questOrigin(q: QuestDef): string {
  const where = zoneName(q.zoneId);
  if (q.giver === null) return where;
  const npc = zoneDef(q.zoneId as ZoneId).npcs.find((n) => n.id === q.giver);
  return npc === undefined ? where : `${npc.name} · ${where}`;
}

export function rewardSummary(q: QuestDef, formatMoney: (n: number) => string): string {
  const r = q.rewards;
  const parts: string[] = [];
  if (r.money > 0) parts.push(formatMoney(r.money));
  for (const [id, n] of Object.entries(r.items)) parts.push(`${itemInfo(id).name} ×${n}`);
  if (r.creature !== null) parts.push(`${speciesName(r.creature.species)} Lv ${r.creature.level}`);
  return parts.join(' · ');
}

export const ACT_LABEL: Readonly<Record<Act, string>> = { 1: 'Act I', 2: 'Act II', 3: 'Act III' };

/** The tracked quest's line for the HUD: its first undone objective (with a count when it needs more than one). */
export function trackedHint(q: QuestDef, p: QuestProgress | null): string | null {
  const status = questStatus(q, p);
  if (status === 'ready') return `Claim “${q.title}” in Quests`;
  if (status !== 'active') return null;
  const o = objectivesOf(q, p).find((x) => !x.done);
  if (o === undefined) return null;
  return o.target > 1 ? `${o.label} (${o.count}/${o.target})` : o.label;
}

/** Phase D5 — the achievements (`QuestDef kind: 'achievement'`, content order). */
export function achievementQuests(): readonly QuestDef[] {
  return QUESTS.filter((q) => q.kind === 'achievement');
}

/** Phase D5 — the story quests the journal's Story tab lists (everything but the achievements). */
export function storyQuests(): readonly QuestDef[] {
  return QUESTS.filter((q) => q.kind !== 'achievement');
}

/**
 * Phase D5 — one progress figure per achievement: a single-objective milestone reads its count against its target
 * (12 / 30 species), a multi-objective one the objectives done (5 / 8 badges).
 */
export function achievementProgress(q: QuestDef, p: QuestProgress | null): { readonly value: number; readonly target: number } {
  const objectives = objectivesOf(q, p);
  if (objectives.length === 1) return { value: objectives[0]!.count, target: objectives[0]!.target };
  return { value: objectives.filter((o) => o.done).length, target: objectives.length };
}
