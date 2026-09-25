/**
 * `materials.count`: distinct `materials[].uuid` with `cls ∉ {debug}` ≤ 48 (SPEC §50.2.2, §10.2.7). The dump's
 * `counts.materials` (render's own count under the zone root) is held to the same cap, so a dump whose list and
 * count disagree cannot pass on the smaller number.
 */
import { MATERIALS_MAX } from '../caps.js';
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import type { ZoneDump } from '../zone-dump.js';

export const id = 'materials.count';

function distinct(dump: ZoneDump): number {
  const s = new Set<string>();
  for (const m of dump.materials) if (m.cls !== 'debug') s.add(m.uuid);
  return s.size;
}

export function measure(dump: ZoneDump): number {
  return Math.max(distinct(dump), dump.counts.materials);
}

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  const listed = distinct(dump);
  const n = Math.max(listed, dump.counts.materials);
  return n > MATERIALS_MAX
    ? [violation(id, dump, ctx, `${n} distinct materials > ${MATERIALS_MAX} (materials[] ${listed}, counts.materials ${dump.counts.materials})`, { listed, counted: dump.counts.materials, cap: MATERIALS_MAX })]
    : [];
}
