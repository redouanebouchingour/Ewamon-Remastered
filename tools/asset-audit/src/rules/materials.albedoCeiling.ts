/**
 * `materials.albedoCeiling` (§10.2.1, OQ-4): every `surface` a dump references resolves to a
 * `materials.manifest.json` entry that carries `albedoClampedPct` — the proof the 0.85 luminance ceiling was
 * applied at bake. A missing manifest fails every dump that references a surface.
 */
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import type { ZoneDump } from '../zone-dump.js';

export const id = 'materials.albedoCeiling';

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  const surfaces = [...new Set(dump.materials.map((m) => m.surface).filter((s): s is string => s !== null))].sort();
  if (surfaces.length === 0) return [];
  const man = ctx.materialsManifest;
  if (!man) return [violation(id, dump, ctx, `materials.manifest.json unavailable; ${surfaces.length} referenced surfaces are unverifiable`, { surfaces })];
  const out: Violation[] = [];
  for (const s of surfaces) {
    const e = Object.prototype.hasOwnProperty.call(man.surfaces, s) ? man.surfaces[s] : undefined;
    if (!e) out.push(violation(id, dump, ctx, `surface ${s} has no materials.manifest.json entry`, { surface: s }));
    else if (typeof e.albedoClampedPct !== 'number') out.push(violation(id, dump, ctx, `surface ${s}: manifest entry lacks albedoClampedPct (ceiling not applied at bake)`, { surface: s }));
  }
  return out;
}

export function measure(dump: ZoneDump, ctx: AuditContext): number {
  return rule(dump, ctx).length;
}
