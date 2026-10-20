/**
 * Majin vs Tenjin seasons (factions.ts): the winner of a season's totals (none on a tie); the Chronicle names the
 * winner with the score, or says the sky stayed its own; two sides with their words.
 */
import { describe, expect, it } from 'vitest';
import { FACTIONS, FACTION_LABELS, FACTION_POINTS, chronicleLine, factionWinner } from '../src/index';

describe('Majin vs Tenjin seasons', () => {
  it('the side with more points wins; a tie wins nothing', () => {
    expect(factionWinner({ majin: 10, tenjin: 9 })).toBe('majin');
    expect(factionWinner({ majin: 3, tenjin: 9 })).toBe('tenjin');
    expect(factionWinner({ majin: 4, tenjin: 4 })).toBeNull();
    expect(factionWinner({ majin: 0, tenjin: 0 })).toBeNull();
  });

  it('the Chronicle names the winner and the score, or a level or empty season', () => {
    expect(chronicleLine(2, 'tenjin', { majin: 40, tenjin: 52 })).toMatch(/^Season 2: the Tenjin held the sky, 52 to 40\. .*gold sky/);
    expect(chronicleLine(3, 'majin', { majin: 61, tenjin: 12 })).toMatch(/^Season 3: the Majin held the sky, 61 to 12\. .*red sky/);
    expect(chronicleLine(4, null, { majin: 0, tenjin: 0 })).toBe('Season 4: no side took the field. The sky over Solenne stayed its own.');
    expect(chronicleLine(5, null, { majin: 7, tenjin: 7 })).toMatch(/ended level at 7/);
  });

  it('two sides, each with a name, a motto and a creed; deeds are worth points', () => {
    expect(FACTIONS).toEqual(['majin', 'tenjin']);
    for (const f of FACTIONS) {
      const l = FACTION_LABELS[f];
      for (const t of [l.name, l.motto, l.creed]) {
        expect(t.length).toBeGreaterThan(0);
        expect(t).not.toContain('—');
      }
    }
    expect(FACTION_POINTS.rankedWin).toBeGreaterThan(FACTION_POINTS.raidClear);
    expect(FACTION_POINTS.raidClear).toBeGreaterThan(FACTION_POINTS.mission);
  });
});
