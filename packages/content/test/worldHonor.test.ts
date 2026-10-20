/**
 * Honor shapes the world (worldHonor.ts): the shadow level from a season tally (too little history stays clear, then a
 * level per threshold of the shadow share); the deeds of a turn (a player's Dark move, a wild faint, a catch, a fair
 * win; nothing for an AI side's deeds); the Dark weight; what the player is told; the hollowed town's lines belong to
 * its people.
 */
import { describe, expect, it } from 'vitest';
import type { BattleEvent, TypeName } from '@ewa/core';
import {
  HOLLOWED_LINES,
  HOLLOWED_TOWN,
  LIGHT_POINTS,
  SHADOW_MIN_DEEDS,
  SHADOW_POINTS,
  deedsOf,
  shadowDarkWeight,
  shadowLevel,
  shadowNotice,
  zone,
} from '../src/index';

const ref = (side: 0 | 1) => ({ side, slot: 0 });
const damage = (source: 0 | 1, move: string): BattleEvent =>
  ({ t: 'damage', target: ref(source === 0 ? 1 : 0), amount: 10, hpAfter: 5, maxHp: 15, effectiveness: 1, crit: false, stab: false, cause: 'move', source: ref(source), move }) as BattleEvent;
const TYPES: Record<string, TypeName> = { bite: 'Dark', tackle: 'Normal' };
const typeOf = (id: string): TypeName | null => TYPES[id] ?? null;

describe('honor shapes the world', () => {
  it('a zone stays clear below the minimum; then each threshold of the shadow share is a level', () => {
    expect(shadowLevel(0, SHADOW_MIN_DEEDS - 1)).toBe(0);
    expect(shadowLevel(0, SHADOW_MIN_DEEDS)).toBe(4);
    expect(shadowLevel(50, 50)).toBe(0);
    expect(shadowLevel(45, 55)).toBe(1);
    expect(shadowLevel(35, 65)).toBe(2);
    expect(shadowLevel(25, 75)).toBe(3);
    expect(shadowLevel(15, 85)).toBe(4);
    expect(shadowLevel(100, 0)).toBe(0);
  });

  it("counts a player's Dark move, a wild faint, a catch and a fair win; an AI side's deeds count nothing", () => {
    const events: BattleEvent[] = [
      damage(0, 'bite'),
      damage(0, 'tackle'),
      damage(1, 'bite'),
      { t: 'faint', who: ref(1) },
      { t: 'catchResult', caught: true, target: ref(1), shakes: 4 },
      { t: 'catchResult', caught: false, target: ref(1), shakes: 1 },
    ];
    expect(deedsOf(events, [0], 1, typeOf, null)).toEqual({ light: LIGHT_POINTS.caught, shadow: SHADOW_POINTS.darkMove + SHADOW_POINTS.wildKo });
    // a trainer battle: no wild side; side 0 wins fair
    expect(deedsOf([damage(1, 'bite'), { t: 'faint', who: ref(1) }], [0], null, typeOf, 0)).toEqual({ light: LIGHT_POINTS.duelWon, shadow: 0 });
    // the AI side winning is nobody's fair win
    expect(deedsOf([], [0], null, typeOf, 1)).toEqual({ light: 0, shadow: 0 });
    // PvP: both sides are players
    expect(deedsOf([damage(1, 'bite')], [0, 1], null, typeOf, 1)).toEqual({ light: LIGHT_POINTS.duelWon, shadow: SHADOW_POINTS.darkMove });
    expect(deedsOf([damage(0, 'bite')], [], 1, typeOf, 0)).toEqual({ light: 0, shadow: 0 });
  });

  it('Dark slots weigh more per level; the notices name the zone; a shadow that only eases says nothing', () => {
    expect([0, 1, 2, 4, 9].map(shadowDarkWeight)).toEqual([1, 1.5, 2, 3, 3]);
    expect(shadowNotice('Mire Route', 0)).toBeNull();
    expect(shadowNotice('Mire Route', 1)).toMatch(/A shadow lies over Mire Route/);
    expect(shadowNotice('Mire Route', 3)).toMatch(/deep shadow/);
    expect(shadowNotice('Vesperveil', 4)).toMatch(/Hollowing/);
    expect(shadowNotice('Mire Route', 2, 3)).toBeNull();
    expect(shadowNotice('Mire Route', 0, 2)).toBe('The shadow over Mire Route has lifted.');
  });

  it("the hollowed town's lines belong to its own people", () => {
    const ids = new Set(zone(HOLLOWED_TOWN).npcs.map((n) => n.id));
    for (const [id, lines] of Object.entries(HOLLOWED_LINES)) {
      expect(ids.has(id)).toBe(true);
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) expect(l).not.toContain('—');
    }
  });
});
