/**
 * `harvest.same` (`harvest.spec.ts`): for a pair of dumps of the same shot at `harvestLevel 0` and `2`, the
 * multiset of `materials[].cls` is identical (the degraded look is a uniform, not a material swap). The rule runs
 * on the level-2 dump and finds its level-0 partner among the run's dumps: same `zone`, same shot key
 * (`pairKey`). A level-2 dump without a partner is unevaluated.
 */
import type { AuditContext, LoadedDump, Violation } from '../types.js';
import { violation } from '../types.js';
import type { ZoneDump } from '../zone-dump.js';

export const id = 'harvest.same';

/** The shot key two harvest states share: the shot id with a trailing `-h0` / `_h2` / `.harvest2` marker removed. */
export function pairKey(shot: string): string {
  return shot.replace(/[-_.]?(?:h|harvest)[-_]?[0-2]$/i, '');
}

function partner(dump: ZoneDump, ctx: AuditContext): LoadedDump | undefined {
  if (dump.harvestLevel !== 2) return undefined;
  const key = pairKey(ctx.shot);
  return ctx.peers.find((p) => p.dump !== dump && p.dump.zone === dump.zone && p.dump.harvestLevel === 0 && pairKey(p.shot) === key);
}

export function evaluable(dump: ZoneDump, ctx: AuditContext): boolean {
  return dump.harvestLevel !== 2 || partner(dump, ctx) !== undefined;
}

function multiset(d: ZoneDump): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of d.materials) m.set(x.cls, (m.get(x.cls) ?? 0) + 1);
  return m;
}

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  const p = partner(dump, ctx);
  if (!p) return [];
  const a = multiset(p.dump);
  const b = multiset(dump);
  const diffs: { cls: string; harvest0: number; harvest2: number }[] = [];
  for (const cls of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const x = a.get(cls) ?? 0;
    const y = b.get(cls) ?? 0;
    if (x !== y) diffs.push({ cls, harvest0: x, harvest2: y });
  }
  return diffs.length
    ? [violation(id, dump, ctx, `material classes differ between harvest 0 (${p.shot}) and 2: ${diffs.map((d) => `${d.cls} ${d.harvest0}→${d.harvest2}`).join(', ')}`, { partner: p.source, diffs })]
    : [];
}

export function measure(dump: ZoneDump, ctx: AuditContext): number {
  return rule(dump, ctx).length;
}
