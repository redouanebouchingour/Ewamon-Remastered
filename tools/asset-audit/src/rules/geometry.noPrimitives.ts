/**
 * `geometry.noPrimitives` (Pillar 3): at `harvestLevel 0` no `BoxGeometry`, `ConeGeometry`, `IcosahedronGeometry`,
 * and no `SphereGeometry` with `parameters.widthSegments < 24` (a sphere whose segments are unknown fails too).
 */
import { SPHERE_MIN_WIDTH_SEGMENTS } from '../caps.js';
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import type { ZoneDump } from '../zone-dump.js';

export const id = 'geometry.noPrimitives';

export const BANNED_TYPES: ReadonlySet<string> = new Set(['BoxGeometry', 'ConeGeometry', 'IcosahedronGeometry']);

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  if (dump.harvestLevel !== 0) return [];
  const out: Violation[] = [];
  for (const g of dump.geometries) {
    if (BANNED_TYPES.has(g.type)) out.push(violation(id, dump, ctx, `geometry ${g.uuid} is a ${g.type}`, g));
    else if (g.type === 'SphereGeometry') {
      const ws = g.parameters?.widthSegments;
      if (ws === undefined || ws < SPHERE_MIN_WIDTH_SEGMENTS) {
        out.push(violation(id, dump, ctx, `geometry ${g.uuid} is a SphereGeometry with widthSegments ${ws ?? 'unknown'} < ${SPHERE_MIN_WIDTH_SEGMENTS}`, g));
      }
    }
  }
  return out;
}

export function measure(dump: ZoneDump, ctx: AuditContext): number {
  return rule(dump, ctx).length;
}
