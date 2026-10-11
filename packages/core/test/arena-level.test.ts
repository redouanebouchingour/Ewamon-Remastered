/**
 * Arena PvP — `atLevel`: a creature fights at exactly the arena level (raised or lowered), or at its own level when the
 * level is null; always fully healed, the stored instance untouched.
 */
import { describe, expect, it } from 'vitest';
import { atLevel, calcMaxHp, calcStat, expToLevel, projectBattler } from '../src/index';
import { content, creature } from './helpers';

describe('atLevel (arena PvP)', () => {
  it('raises a creature below the level: exp at that level, full hp at it, no status, full pp — the input untouched', () => {
    const c = creature({ species: 'bramblecub', level: 12, hp: 3, status: ['burn'], pp: 0 });
    const before = JSON.stringify(c);
    const up = atLevel(c, 50, content);
    expect(JSON.stringify(c)).toBe(before);
    const sp = content.species('bramblecub');
    expect(up.level).toBe(50);
    expect(up.exp).toBe(expToLevel(50));
    expect(up.hp).toBe(calcMaxHp(sp.baseHp, 50));
    expect(up.status).toEqual([]);
    expect(up.moves.every((m) => m.pp === m.ppMax)).toBe(true);
    expect(up.moves.map((m) => m.id)).toEqual(c.moves.map((m) => m.id));
    const b = projectBattler(up, content);
    expect([b.maxHp, b.atk, b.def, b.spd]).toEqual([calcMaxHp(sp.baseHp, 50), calcStat(sp.baseAtk, 50), calcStat(sp.baseDef, 50), calcStat(sp.baseSpd, 50)]);
  });

  it('lowers a creature above the level', () => {
    const c = creature({ species: 'mufflo', level: 80 });
    const down = atLevel(c, 50, content);
    expect(down.level).toBe(50);
    expect(down.exp).toBe(expToLevel(50));
    expect(down.hp).toBe(calcMaxHp(content.species('mufflo').baseHp, 50));
  });

  it('null keeps the own level and exp, and heals', () => {
    const c = creature({ species: 'mufflo', level: 30, hp: 1, exp: expToLevel(30) + 123, status: ['poison'] });
    const same = atLevel(c, null, content);
    expect(same.level).toBe(30);
    expect(same.exp).toBe(expToLevel(30) + 123);
    expect(same.hp).toBe(calcMaxHp(content.species('mufflo').baseHp, 30));
    expect(same.status).toEqual([]);
  });
});
