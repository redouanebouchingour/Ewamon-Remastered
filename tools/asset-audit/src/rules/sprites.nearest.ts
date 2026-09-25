/** `sprites.nearest` (Pillar 6): every `sprites[]` entry has `magFilter === 1003` (NearestFilter) and `anisotropy === 1`. */
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import { NEAREST_FILTER } from '../zone-dump.js';
import type { ZoneDump } from '../zone-dump.js';

export const id = 'sprites.nearest';

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  const out: Violation[] = [];
  for (const s of dump.sprites) {
    if (s.magFilter !== NEAREST_FILTER || s.anisotropy !== 1) {
      out.push(violation(id, dump, ctx, `sprite atlas ${s.atlas || '(unnamed)'} has magFilter ${s.magFilter} (need ${NEAREST_FILTER}) / anisotropy ${s.anisotropy} (need 1)`, s));
    }
  }
  return out;
}

export function measure(dump: ZoneDump, ctx: AuditContext): number {
  return rule(dump, ctx).length;
}
