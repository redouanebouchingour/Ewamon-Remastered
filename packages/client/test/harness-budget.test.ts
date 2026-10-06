/**
 * SPEC §50.2 as harness assertions (`src/harness/budgetRules.ts`) and the shot-5 battle script
 * (`src/harness/battleScript.ts`): the numbers are the §50.2.1 table, the count caps render's `COUNT_CAPS`; the scripted
 * battle is deterministic and has a damaging turn 2.
 */
import { describe, expect, it } from 'vitest';
import { digestBattleState, resolveTurn } from '@ewa/core';
import { COUNT_CAPS } from '@ewa/render';
import type { BudgetCounts, BudgetPass } from '@ewa/render';
import { PASS_TABLE, countViolations, msViolations, percentile, stat } from '../src/harness/budgetRules';
import type { ShotBudgetLike } from '../src/harness/budgetRules';
import { scriptWildBattle } from '../src/harness/battleScript';
import { content } from '../src/data/content';

const counts = (over: Partial<BudgetCounts> = {}): BudgetCounts => ({
  drawCalls: 300, triangles: 700_000, texturesSize: 400 * 2 ** 20, textures: 90, geometries: 400, programs: 110, renderTargets: 34,
  attributes: 900, attributesSize: 50 * 2 ** 20, materials: 40, shadowLights: 3, nonShadowLights: 15, ...over,
});

const passes = (v: number): Record<BudgetPass, number | null> => ({ opaque: v, sprites: v, shadows: v, gtao: v, traa: v, bloom: v, dof: v, grade: v });

const row = (over: Partial<ShotBudgetLike> = {}): ShotBudgetLike => ({
  id: 'spawn-noon', counts: counts(), countsMax: null, passMs: passes(0.3), totalMs: { median: 8, p95: 11, n: 600 }, simMs: { median: 0.3, p95: 0.6, n: 600 }, ...over,
});

describe('§50.2 budget rules', () => {
  it('carries the §50.2.1 table', () => {
    expect(PASS_TABLE.total).toEqual({ target: 10, ceiling: 13.5 });
    expect(PASS_TABLE.sim).toEqual({ target: 0.6, ceiling: 1.0 });
    expect(PASS_TABLE.opaque.target + PASS_TABLE.sprites.target + PASS_TABLE.shadows.target + PASS_TABLE.gtao.target + PASS_TABLE.traa.target
      + PASS_TABLE.dof.target + PASS_TABLE.grade.target + PASS_TABLE.sim.target).toBeCloseTo(10 - 0.7, 6);
  });

  it('a row within every cap and row passes', () => {
    expect(countViolations(row())).toEqual([]);
    expect(msViolations(row())).toEqual([]);
  });

  it('flags each count cap (as amended: render targets 41, programs 128) and the worst frame', () => {
    expect(COUNT_CAPS.renderTargets).toBe(41);
    expect(COUNT_CAPS.programs).toBe(128);
    const v = countViolations(row({ counts: counts({ renderTargets: 42, programs: 129, materials: 49 }), countsMax: { drawCalls: 401, triangles: 1 } }));
    expect(v.map((x) => x.metric).sort()).toEqual(['drawCalls', 'materials', 'programs', 'renderTargets']);
  });

  it('caps beauty + post draw calls at 400 when render measures them, shadow-map draws at 564 (§10.5.8)', () => {
    // M2 lamps-night: 408 total = 160 beauty + post + 248 shadow → passes; the worst total frame no longer fails it
    expect(countViolations(row({ counts: counts({ drawCalls: 408, beautyDrawCalls: 160, shadowDrawCalls: 248 }), countsMax: { drawCalls: 420, triangles: 1 } }))).toEqual([]);
    const v = countViolations(row({ counts: counts({ drawCalls: 1000, beautyDrawCalls: 401, shadowDrawCalls: 599 }) }));
    expect(v.map((x) => x.metric).sort()).toEqual(['drawCalls', 'shadowDrawCalls']);
  });

  it('asserts total = T_all + sim (median ≤ target, p95 ≤ ceiling) and each pass against its target', () => {
    const v = msViolations(row({ totalMs: { median: 9.8, p95: 13.2, n: 600 }, simMs: { median: 0.3, p95: 0.2, n: 600 }, passMs: { ...passes(0.1), shadows: 2.1 } }));
    expect(v.map((x) => x.metric).sort()).toEqual(['shadows.median', 'total.median']);
    expect(msViolations(row({ passMs: null, totalMs: null })).length).toBe(0);
  });

  it('percentiles are nearest-rank', () => {
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(xs, 95)).toBe(95);
    expect(stat(xs)).toEqual({ median: 50.5, p95: 95, n: 100 });
  });
});

describe('shot-5 scripted wild battle', () => {
  const o = { playerId: 'harness-player', playerSpecies: 'bramblecub', playerLevel: 5, wildSpecies: 'mossling', wildLevel: 2, zoneId: 'mire_route', terrain: 'grove' as const };

  it('is deterministic and damaging on turns 1 and 2, nobody faints on turn 1', () => {
    const a = scriptWildBattle(content(), o);
    const b = scriptWildBattle(content(), o);
    expect(a.seed).toBe(b.seed);
    expect(a.turns[1].digest).toBe(b.turns[1].digest);
    for (const t of a.turns) expect(t.events.some((e) => e.t === 'damage' && e.cause === 'move')).toBe(true);
    expect(a.turns[0].events.some((e) => e.t === 'faint')).toBe(false);
    expect(a.turns[0].state.ended).toBeNull();
  });

  it('matches what the BattleController previews (the digest the client compares)', () => {
    const s = scriptWildBattle(content(), o);
    const t1 = resolveTurn(s.start.state, [s.turns[0].action, null], content());
    expect(digestBattleState(t1.state)).toBe(s.turns[0].digest);
    const t2 = resolveTurn(t1.state, [s.turns[1].action, null], content());
    expect(digestBattleState(t2.state)).toBe(s.turns[1].digest);
  });
});

describe('shot-5 scripted wild battle in the M3 zones', () => {
  it('finds a script for the first common slot of every zone (another move or a higher wild level when needed; turn 2 may only use a move)', async () => {
    const { ZONES } = await import('@ewa/content');
    const { resolveAnchor, shotsForZone } = await import('../src/harness/anchors');
    const { zoneSpecFor } = await import('../src/scene/zoneSpecFor');
    for (const z of ZONES) {
      const a = resolveAnchor(shotsForZone(z.id, 'M3').find((s) => s.id === 'battle')!, zoneSpecFor(z, 'intact'));
      const s = scriptWildBattle(content(), { playerId: 'p', playerSpecies: 'bramblecub', playerLevel: 5, wildSpecies: a!.wild!.speciesId, wildLevel: a!.wild!.level, zoneId: z.id, terrain: 'grove' });
      expect(s.turns[0].events.some((e) => e.t === 'damage' && e.cause === 'move'), z.id).toBe(true);
      expect(s.turns[1].events.some((e) => e.t === 'moveUsed'), z.id).toBe(true);
      expect(s.wildLevel).toBeGreaterThan(0);
    }
  });
});
