/**
 * SPEC §50.2.1 per-pass table + §50.2.2 count caps as assertions over one `harness:budget` shot row. Pure (no DOM, no
 * three) so the page, the Node runner and `test/harness-budget.test.ts` share it. The count caps are render's
 * `COUNT_CAPS` (as amended 2026-09-25: render targets ≤ 41, programs ≤ 128); the millisecond rows are §50.2.1.
 */
import { BUDGET_PASSES, COUNT_CAPS } from '@ewa/render';
import type { BudgetCounts, BudgetPass } from '@ewa/render';

export interface Row { readonly target: number; readonly ceiling: number }

/** §50.2.1, ms (GPU unless marked CPU). Keys are unquoted on purpose: a quoted pass name can spell a badge id. */
export const PASS_TABLE = Object.freeze({
  sim: { target: 0.6, ceiling: 1.0 },
  opaque: { target: 2.6, ceiling: 3.4 },
  sprites: { target: 0.8, ceiling: 1.2 },
  shadows: { target: 2.0, ceiling: 2.6 },
  gtao: { target: 1.2, ceiling: 1.6 },
  traa: { target: 0.7, ceiling: 1.0 },
  bloom: { target: 0.7, ceiling: 1.0 },
  dof: { target: 0.9, ceiling: 1.3 },
  grade: { target: 0.5, ceiling: 0.7 },
  total: { target: 10.0, ceiling: 13.5 },
} satisfies Record<BudgetPass | 'sim' | 'total', Row>);

export interface Stat { readonly median: number; readonly p95: number; readonly n: number }

export interface ShotBudgetLike {
  readonly id: string;
  readonly counts: BudgetCounts;
  /** worst frame of the capture (draw calls / triangles vary with TRAA-jittered culling) */
  readonly countsMax?: Pick<BudgetCounts, 'drawCalls' | 'triangles'> | null;
  /** §50.2.3 differential medians; null = not measured (no timestamp-query) */
  readonly passMs: Readonly<Record<BudgetPass, number | null>> | null;
  readonly totalMs: Stat | null;
  readonly simMs: Stat;
}

export interface Violation { readonly shot: string; readonly metric: string; readonly value: number; readonly limit: number; readonly kind: 'count' | 'ms' }

/** §50.2.2: every cap, always. `countsMax` (if present) is checked for draw calls / triangles. */
export function countViolations(s: ShotBudgetLike): Violation[] {
  const out: Violation[] = [];
  for (const k of Object.keys(COUNT_CAPS) as (keyof typeof COUNT_CAPS)[]) {
    let v = s.counts[k];
    if ((k === 'drawCalls' || k === 'triangles') && s.countsMax) v = Math.max(v, s.countsMax[k]);
    if (v > COUNT_CAPS[k]) out.push({ shot: s.id, metric: k, value: v, limit: COUNT_CAPS[k], kind: 'count' });
  }
  return out;
}

/**
 * §50.2.1 "median ≤ target and p95 ≤ hard ceiling" for the total (T_all + simMs) and sim; each differential pass
 * (a median by construction) against its target and ceiling. A pass under its row does not buy another pass headroom.
 */
export function msViolations(s: ShotBudgetLike): Violation[] {
  const out: Violation[] = [];
  const push = (metric: string, value: number, limit: number): void => {
    if (Number.isFinite(value) && value > limit) out.push({ shot: s.id, metric, value, limit, kind: 'ms' });
  };
  const sim = PASS_TABLE.sim;
  push('sim.median', s.simMs.median, sim.target);
  push('sim.p95', s.simMs.p95, sim.ceiling);
  if (s.totalMs !== null) {
    push('total.median', s.totalMs.median + s.simMs.median, PASS_TABLE.total.target);
    push('total.p95', s.totalMs.p95 + s.simMs.p95, PASS_TABLE.total.ceiling);
  }
  if (s.passMs !== null) {
    for (const p of BUDGET_PASSES) {
      const v = s.passMs[p];
      if (v === null) continue;
      push(`${p}.median`, v, PASS_TABLE[p].target);
    }
  }
  return out;
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Nearest-rank percentile (the same definition render's `percentile` uses). */
export function percentile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i]!;
}

export function stat(xs: readonly number[]): Stat {
  return { median: round3(median(xs)), p95: round3(percentile(xs, 95)), n: xs.length };
}

export function round3(v: number): number {
  return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v;
}
