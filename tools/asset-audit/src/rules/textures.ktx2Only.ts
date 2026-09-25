/**
 * `textures.ktx2Only` (§10 non-negotiable 2): every material with `cls ∈ {standard, physical, card, water,
 * emissive}` has `ktx2 === true` — no `CanvasTexture`, no PNG albedo on a lit material. `billboard` (WebP atlases,
 * §40.1.6) and `character` (vertex colour + placeholder, §10.7.7) are exempt by class (§10.0.3 rule 4).
 */
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import type { DumpMaterialClass, ZoneDump } from '../zone-dump.js';

export const id = 'textures.ktx2Only';

export const ASSERTED: ReadonlySet<DumpMaterialClass> = new Set<DumpMaterialClass>(['standard', 'physical', 'card', 'water', 'emissive']);

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  const out: Violation[] = [];
  for (const m of dump.materials) {
    if (ASSERTED.has(m.cls) && m.ktx2 !== true) out.push(violation(id, dump, ctx, `material ${m.uuid} (${m.cls}, surface ${m.surface ?? 'none'}) is not KTX2`, m));
  }
  return out;
}

export function measure(dump: ZoneDump, ctx: AuditContext): number {
  return rule(dump, ctx).length;
}
