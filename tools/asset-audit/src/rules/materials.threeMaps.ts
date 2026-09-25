/**
 * `materials.threeMaps` (Pillar 2): at `harvestLevel === 0` every lit material has albedo + ORM + normal maps.
 * Asserted classes: `standard`, `physical`, `card`. Exempt by class: `billboard`, `impostor`, `decal`, `character`
 * (SPEC §50.4.6 and §40.5.2's exemption row; §40.5.2's assertion row also lists `character`, the exemption wins —
 * IMPLEMENTATION-NOTES A3). Exempt by state: `harvestLevel ≥ 1`.
 */
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import type { DumpMaterialClass, ZoneDump } from '../zone-dump.js';

export const id = 'materials.threeMaps';

export const ASSERTED: ReadonlySet<DumpMaterialClass> = new Set<DumpMaterialClass>(['standard', 'physical', 'card']);
export const EXEMPT: ReadonlySet<DumpMaterialClass> = new Set<DumpMaterialClass>(['billboard', 'impostor', 'decal', 'character']);

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  if (dump.harvestLevel >= 1) return [];
  const out: Violation[] = [];
  for (const m of dump.materials) {
    if (EXEMPT.has(m.cls) || !ASSERTED.has(m.cls)) continue;
    const missing = (['albedo', 'orm', 'normal'] as const).filter((k) => !m.maps[k]);
    if (missing.length) out.push(violation(id, dump, ctx, `material ${m.uuid} (${m.cls}, surface ${m.surface ?? 'none'}) lacks ${missing.join(' + ')}`, m));
  }
  return out;
}

export function measure(dump: ZoneDump, ctx: AuditContext): number {
  return rule(dump, ctx).length;
}
