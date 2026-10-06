/**
 * Phase D6 — authored doubles and the curated spread list: draco_gym + aurelia and five Act II/III route trainers fight
 * 2-on-2 (optional, never story trainers / gates); SPREAD_MOVES rides MOVES and the ContentIndex; validate refuses a
 * doubles row with one creature and a spread id that is not a foe-targeted move.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_TABLES, LEAGUE, MOVES, SPREAD_MOVES, STORY, ZONES, createContentIndex, validate } from '../src/index';

const ROUTE_DOUBLES = ['galvan_route.rocker', 'deepcut_route.digger', 'hollow_route.medium', 'siege_route.engineer', 'ascent_route.tamer'];

describe('Phase D6 content', () => {
  it('draco_gym and aurelia are doubles; the other ten league rows are not', () => {
    expect(LEAGUE.filter((l) => l.doubles === true).map((l) => l.id)).toEqual(['draco_gym', 'aurelia']);
    for (const l of LEAGUE) if (l.doubles === true) expect(l.team.length).toBeGreaterThanOrEqual(2);
  });

  it('five Act II/III route trainers fight doubles; none is a story trainer; the key is absent elsewhere', () => {
    const all = ZONES.flatMap((z) => z.trainers.map((t) => ({ z, t })));
    const dbl = all.filter((x) => x.t.doubles === true);
    expect(dbl.map((x) => x.t.id).sort()).toEqual([...ROUTE_DOUBLES].sort());
    const story = new Set(STORY.filter((b) => b.battle !== null).map((b) => b.battle!.trainerId));
    for (const { z, t } of dbl) {
      expect(z.kind).toBe('route');
      expect(t.team.length).toBeGreaterThanOrEqual(2);
      expect(story.has(t.id)).toBe(false);
    }
    for (const { t } of all) if (t.doubles !== true) expect('doubles' in t).toBe(false);
  });

  it('SPREAD_MOVES is applied to MOVES and the ContentIndex (same objects); everything else has no spread key', () => {
    const idx = createContentIndex();
    expect(Object.keys(SPREAD_MOVES).length).toBe(16);
    for (const m of MOVES) {
      expect(idx.move(m.id)).toBe(m);
      if (SPREAD_MOVES[m.id] === undefined) expect('spread' in m).toBe(false);
      else expect(m.spread).toBe(SPREAD_MOVES[m.id]);
    }
    expect(idx.move('Earthquake').spread).toBe('all');
    expect(idx.move('Rock Slide').spread).toBe('foes');
  });

  it('validate: a doubles trainer with one creature and a spread on a self-targeted move are refused', () => {
    const zones = DEFAULT_TABLES.zones.map((z) => (z.id !== 'galvan_route' ? z : { ...z, trainers: z.trainers.map((t) => (t.id === 'galvan_route.rocker' ? { ...t, team: t.team.slice(0, 1) } : t)) }));
    const r1 = validate({ skipHeightfields: true }, { ...DEFAULT_TABLES, zones });
    expect(r1.errors.some((e) => e.includes('galvan_route.rocker: doubles needs a team of 2+'))).toBe(true);
    const moves = DEFAULT_TABLES.moves.map((m) => (m.id === 'Earthquake' ? { ...m, target: 'self' as const } : m));
    const r2 = validate({ skipHeightfields: true }, { ...DEFAULT_TABLES, moves });
    expect(r2.errors.some((e) => e.includes("SPREAD_MOVES: 'Earthquake'"))).toBe(true);
  });
});
