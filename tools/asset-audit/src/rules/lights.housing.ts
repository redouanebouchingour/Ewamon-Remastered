/**
 * `lights.housing` (Pillar 4, §50.4.6: ≤ 0.6 units, both directions): every light has a housing mesh within 0.6
 * units (`housingDistance`; `null` = render found no housing at all), and every `lightSource`-tagged emissive has a
 * light within 0.6 units (the optional `lightSources[]`; render does not write it yet, so only the first direction
 * is checked on today's dumps).
 */
import { HOUSING_MAX } from '../caps.js';
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import type { ZoneDump } from '../zone-dump.js';

export const id = 'lights.housing';

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  const out: Violation[] = [];
  for (const l of dump.lights) {
    const d = l.housingDistance;
    if (d === null || !(d <= HOUSING_MAX)) out.push(violation(id, dump, ctx, `light ${l.id} has no housing within ${HOUSING_MAX} (nearest ${d === null ? 'none' : d.toFixed(3)})`, l));
  }
  for (const s of dump.lightSources ?? []) {
    const d = s.lightDistance;
    if (d === null || !(d <= HOUSING_MAX)) out.push(violation(id, dump, ctx, `lightSource emissive ${s.id} has no light within ${HOUSING_MAX} (nearest ${d === null ? 'none' : d.toFixed(3)})`, s));
  }
  return out;
}

export function measure(dump: ZoneDump, ctx: AuditContext): number {
  return rule(dump, ctx).length;
}
