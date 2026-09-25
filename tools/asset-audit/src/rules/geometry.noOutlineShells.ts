/**
 * `geometry.noOutlineShells` (legacy-render-audit Q4): no `BackSide` scaled clone sharing a geometry — the legacy
 * outline trick. Two checks:
 *  1. `BackSide` materials are allowed only on `cls === 'sky'` (reads `materials[].side`, which §40.5.2 says the
 *     dump gains);
 *  2. with the optional `meshes[]` rows: no geometry `uuid` drawn by two meshes where one has a `BackSide`
 *     material and a scale > 1. (With only `geometries[].sharedBy`, a shared geometry under a non-sky `BackSide`
 *     material is already caught by check 1.)
 * A dump whose materials carry no `side` is unevaluated (render does not write the field yet).
 */
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import { BACK_SIDE } from '../zone-dump.js';
import type { ZoneDump } from '../zone-dump.js';

export const id = 'geometry.noOutlineShells';

export function evaluable(dump: ZoneDump): boolean {
  return dump.materials.length === 0 || dump.materials.some((m) => m.side !== undefined);
}

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  const out: Violation[] = [];
  const byUuid = new Map(dump.materials.map((m) => [m.uuid, m] as const));
  for (const m of dump.materials) {
    if (m.side === BACK_SIDE && m.cls !== 'sky') out.push(violation(id, dump, ctx, `material ${m.uuid} (${m.cls}) is BackSide; BackSide is allowed only on sky`, m));
  }
  if (dump.meshes) {
    const byGeo = new Map<string, { readonly material: string; readonly scale: number }[]>();
    for (const r of dump.meshes) {
      const l = byGeo.get(r.geometry) ?? [];
      l.push(r);
      byGeo.set(r.geometry, l);
    }
    for (const geo of [...byGeo.keys()].sort()) {
      const rows = byGeo.get(geo)!;
      if (rows.length < 2) continue;
      const shell = rows.find((r) => byUuid.get(r.material)?.side === BACK_SIDE && r.scale > 1);
      if (shell) out.push(violation(id, dump, ctx, `geometry ${geo} is shared by ${rows.length} meshes and one is a BackSide shell at scale ${shell.scale}`, { geometry: geo, meshes: rows }));
    }
  }
  return out;
}

export function measure(dump: ZoneDump, ctx: AuditContext): number {
  return rule(dump, ctx).length;
}
