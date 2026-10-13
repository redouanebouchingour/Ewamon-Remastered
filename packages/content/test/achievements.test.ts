/**
 * Phase D5 — achievements as `QuestDef { kind: 'achievement' }`: 30 rows appended to QUESTS, auto-offered
 * (giver null, no requires), money/item rewards only, covering every milestone family the phase names.
 */
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS, LEAGUE, LEGENDARY_STATICS, QUESTS, QuestDefSchema, SPECIES, STORY_QUESTS, isAchievement, validate } from '../src/index';
import type { QuestObjective } from '../src/index';

const targets = (kind: QuestObjective['kind']): number[] =>
  ACHIEVEMENTS.flatMap((a) => a.objectives.map((o) => o.objective))
    .filter((o) => o.kind === kind)
    .map((o) => ('count' in o ? o.count : 'days' in o ? o.days : 1))
    .sort((a, b) => a - b);

describe('Phase D5 achievements', () => {
  it('30 rows, unique ids that fit quest_progress.quest_id (48), all kind achievement, ride QUESTS after the story', () => {
    expect(ACHIEVEMENTS).toHaveLength(30);
    expect(ACHIEVEMENT_IDS.size).toBe(30);
    for (const a of ACHIEVEMENTS) {
      expect(a.id.length).toBeLessThanOrEqual(48);
      expect(isAchievement(a)).toBe(true);
      expect(a.giver).toBeNull();
      expect(a.requires).toEqual([]);
      expect(a.rewards.creature).toBeNull();
      expect(a.rewards.flag).toBeNull();
      expect(a.rewards.money).toBeGreaterThan(0);
      expect(QuestDefSchema.safeParse(a).success).toBe(true);
    }
    expect(QUESTS.slice(-30).map((q) => q.id)).toEqual(ACHIEVEMENTS.map((a) => a.id));
    expect(STORY_QUESTS.every((q) => !isAchievement(q))).toBe(true);
    expect(STORY_QUESTS.length + ACHIEVEMENTS.length).toBe(QUESTS.length);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
  });

  it('covers dex 30/60/90/all 138, catches 10/50/200, wins 10/100/500, trades 1/10, raids 1/10, streaks 7/30', () => {
    expect(targets('dexCaught')).toEqual(expect.arrayContaining([30, 60, 90, 138]));
    expect(Math.max(...targets('dexCaught'))).toBe(SPECIES.length);
    expect(targets('catchSpecies')).toEqual(expect.arrayContaining([10, 50, 200]));
    const anyWins = ACHIEVEMENTS.flatMap((a) => a.objectives.map((o) => o.objective)).filter((o) => o.kind === 'winBattles' && o.format === 'any').map((o) => (o.kind === 'winBattles' ? o.count : 0));
    expect(anyWins).toEqual(expect.arrayContaining([10, 100, 500]));
    expect(targets('completeTrades')).toEqual(expect.arrayContaining([1, 10]));
    expect(targets('clearRaids')).toEqual(expect.arrayContaining([1, 10]));
    expect(targets('loginStreak')).toEqual(expect.arrayContaining([7, 30]));
  });

  it('all 9 statics and all 12 league trainers, by their content ids', () => {
    const statics = ACHIEVEMENTS.find((a) => a.id === 'ach_statics_all')!;
    expect(statics.objectives.map((o) => (o.objective.kind === 'flag' ? o.objective.flag : '')).sort()).toEqual(LEGENDARY_STATICS.map((s) => s.flag).sort());
    const league = ACHIEVEMENTS.find((a) => a.id === 'ach_league_all')!;
    expect(league.objectives.map((o) => (o.objective.kind === 'defeatTrainer' ? o.objective.trainerId : '')).sort()).toEqual(LEAGUE.map((l) => l.id).sort());
  });

  it('validate() stays green with the achievements in QUESTS', () => {
    const r = validate();
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
