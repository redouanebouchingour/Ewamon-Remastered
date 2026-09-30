/**
 * `budget.counts.drawCalls`: beauty + post draw calls ≤ 400 (SPEC §10.5.8, §50.2.2; amended 2026-09-30). The cap
 * never included the shadow-map passes (§10.5.8: "reported separately in `dumpZone()`; the ≤ 400 cap applies to the
 * beauty pass and the post quads"), but `counts.drawCalls` is `renderer.info.render.drawCalls`, which does. So the
 * rule measures `counts.drawCalls − shadowDrawCalls` (render writes the measured shadow-map draw calls into the dump
 * since render Part 5 B2; the shadow passes have their own rule, `shadows.drawCalls` ≤ 564).
 */
import { COUNT_CAPS } from '../caps.js';
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import type { ZoneDump } from '../zone-dump.js';

export const id = 'budget.counts.drawCalls';

export function measure(dump: ZoneDump): number {
  return Math.max(0, dump.counts.drawCalls - Math.max(0, dump.shadowDrawCalls));
}

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  const v = measure(dump);
  const cap = COUNT_CAPS.drawCalls;
  return v > cap
    ? [violation(id, dump, ctx, `beauty + post draw calls ${v} (counts.drawCalls ${dump.counts.drawCalls} − shadowDrawCalls ${dump.shadowDrawCalls}) > ${cap}`, { metric: 'drawCalls', value: v, cap })]
    : [];
}
