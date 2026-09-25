/** `shadows.drawCalls` (§10.5.8): `shadowDrawCalls ≤ 4 × (12 + 29 + 60 + 40) = 564`. */
import { SHADOW_DRAW_CALLS_MAX } from '../caps.js';
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import type { ZoneDump } from '../zone-dump.js';

export const id = 'shadows.drawCalls';

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  return dump.shadowDrawCalls > SHADOW_DRAW_CALLS_MAX
    ? [violation(id, dump, ctx, `shadowDrawCalls ${dump.shadowDrawCalls} > ${SHADOW_DRAW_CALLS_MAX}`, { value: dump.shadowDrawCalls, cap: SHADOW_DRAW_CALLS_MAX })]
    : [];
}

export function measure(dump: ZoneDump): number {
  return dump.shadowDrawCalls;
}
