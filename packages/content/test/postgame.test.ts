/**
 * Phase D14 — post-game content: one `LEAGUE_REMATCH` row per league trainer (Lv 65–75, reward ×1.5, no legendary
 * the original team lacks), the battle tower's pools (non-legendary finals, big enough for distinct teams) and set
 * rewards, and the Tower Attendant in Solenne's league hall foyer. Nothing post-game gates the story: rematches and
 * the tower read `champion:zeon:beaten` and set only server bookkeeping (`league:<id>:rematchAt`, the streak table).
 */
import { describe, expect, it } from 'vitest';
import {
  LEAGUE,
  LEAGUE_REMATCH,
  LEAGUE_REMATCH_LEVELS,
  LEGENDARY_IDS,
  MYTHICAL_IDS,
  POSTGAME_FLAG,
  QUESTS,
  SPECIES,
  STORY,
  TOWER,
  interiorNpcs,
  leagueRematchFlag,
  towerSetReward,
  towerTier,
} from '../src/index';

describe('D14 post-game content', () => {
  it('LEAGUE_REMATCH: one row per league trainer, Lv 65–75, reward ×1.5, legendaries only from the original team', () => {
    expect(LEAGUE_REMATCH.map((r) => r.leagueId).sort()).toEqual(LEAGUE.map((l) => l.id).sort());
    const legendary = new Set([...LEGENDARY_IDS, ...MYTHICAL_IDS]);
    for (const r of LEAGUE_REMATCH) {
      const lt = LEAGUE.find((l) => l.id === r.leagueId)!;
      expect(r.reward).toBe(Math.round(lt.reward * 1.5));
      expect(r.pre.length).toBeGreaterThan(0);
      expect(r.post.length).toBeGreaterThan(0);
      for (const m of r.team) {
        expect(m.level).toBeGreaterThanOrEqual(LEAGUE_REMATCH_LEVELS.min);
        expect(m.level).toBeLessThanOrEqual(LEAGUE_REMATCH_LEVELS.max);
        if (legendary.has(m.species)) expect(lt.team.map((o) => o.species)).toContain(m.species);
      }
    }
  });

  it('post-game flags never gate the story: no beat or quest needs the rematch flags; the champion flag gates only post-game', () => {
    const rematchFlags = new Set(LEAGUE.map((l) => leagueRematchFlag(l.id)));
    for (const b of STORY) for (const f of b.need) expect(rematchFlags.has(f)).toBe(false);
    for (const q of QUESTS) for (const o of q.objectives) if (o.objective.kind === 'flag') expect(rematchFlags.has(o.objective.flag)).toBe(false);
    expect(POSTGAME_FLAG).toBe('champion:zeon:beaten');
  });

  it('the tower: pools of non-legendary fully evolved species per tier; rewards grow per set; the attendant stands in the league hall', () => {
    for (const pool of TOWER.pools) {
      expect(pool.length).toBeGreaterThanOrEqual(TOWER.teamSize * 2);
      for (const id of pool) {
        const sp = SPECIES.find((s) => s.id === id)!;
        expect(sp.legendary).toBe(false);
        expect(sp.evolution).toBeNull();
      }
    }
    expect([0, 6, 7, 13, 14, 21, 99].map(towerTier)).toEqual([0, 0, 1, 1, 2, 3, 3]);
    expect(towerSetReward(1)).toEqual({ money: 2500, items: { rarecandy: 1 } });
    expect(towerSetReward(2).money).toBeGreaterThan(towerSetReward(1).money);
    expect(towerSetReward(100).money).toBe(15_000);
    const npc = interiorNpcs('solenne').find((n) => n.id === TOWER.attendantId);
    expect(npc?.role).toBe('tower');
    expect(npc?.interior).toBe('solenne.league');
  });
});
