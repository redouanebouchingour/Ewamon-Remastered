/**
 * Every number the audit asserts, with its SPEC source. `packages/render/src/stats.ts` `COUNT_CAPS` carries the
 * same §50.2.2 caps for the in-app overlay; `test/rules.test.ts` pins these literals so a change is reviewed.
 */
import type { BudgetCounts, ZoneDump } from './zone-dump.js';
import type { AuditContext, RuleModule, Violation } from './types.js';
import { violation } from './types.js';

/** §50.2.2 count caps. */
export const COUNT_CAPS = Object.freeze({
  drawCalls: 400,
  triangles: 2_500_000,
  texturesSize: 734_003_200,
  renderTargets: 24,
  programs: 96,
});

/** §50.2.2 / §10.2.7: distinct materials under the zone root, `debug` excluded. */
export const MATERIALS_MAX = 48;
/** §50.2.2 / Pillar 4: point + spot lights by `castShadow`. */
export const SHADOW_LIGHTS_MAX = 8;
export const NON_SHADOW_LIGHTS_MAX = 24;
/** Pillar 4: a light's housing mesh within 0.6 units (both directions, §50.4.6). */
export const HOUSING_MAX = 0.6;
/** §10.5.8: 4 cascades × (terrain 12 + buildings 29 + scatter 60 + billboards 40). */
export const SHADOW_DRAW_CALLS_MAX = 4 * (12 + 29 + 60 + 40);
/** Pillar 3: spheres below this segment count read as primitives. */
export const SPHERE_MIN_WIDTH_SEGMENTS = 24;
/** §40.5.3 regression gate: growth over the baseline's worst shot that fails even under the cap. */
export const REGRESSION_PCT = 5;

type CapMetric = keyof typeof COUNT_CAPS & keyof BudgetCounts;

/** A `budget.counts.<metric>` rule: `counts.<metric> ≤ cap`. */
export function countCapRule(metric: CapMetric): RuleModule {
  const id = `budget.counts.${metric}`;
  const cap = COUNT_CAPS[metric];
  return {
    id,
    rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
      const v = dump.counts[metric];
      return v > cap ? [violation(id, dump, ctx, `counts.${metric} ${v} > ${cap}`, { metric, value: v, cap })] : [];
    },
    measure: (dump) => dump.counts[metric],
  };
}
