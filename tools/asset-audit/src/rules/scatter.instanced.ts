/**
 * `scatter.instanced` (legacy-render-audit Q19): every geometry whose `kind` is a scatter kind is drawn by an
 * `InstancedMesh`; every TREE kind (`tree_*`) lists lod0, lod1, lod2 + `impostor` (§10.5.7: 0–40 / 40–90 / 90–160 m,
 * impostor beyond), every other kind lists at least lod0 + lod1 — small kinds are not drawn beyond 90 m and only trees
 * get impostor cards (render Part 2 Z2; SPEC §40.5.2 amended 2026-09-30, P4-C1). Before the amendment every kind
 * needed all four tiers, which every real dump failed by design.
 *
 * Reads the optional `geometries[].kind / tier / instancedMesh` (§40.5.2: the dump gains the scatter kind). A
 * geometry with a non-null `kind` is a scatter geometry — the §10.5.4 kinds (`tree_*`, `rock_*`, `bush`,
 * `flower_patch`, `tall_grass` for grove; the other biome sets follow the same shape). When `instancedMesh` is
 * absent the SPEC's literal `instanced ≥ 1` is the test. A dump with no `kind` field at all is unevaluated.
 */
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import type { ScatterTier, ZoneDump } from '../zone-dump.js';

export const id = 'scatter.instanced';

export const REQUIRED_TIERS: readonly ScatterTier[] = [0, 1, 2, 3];
/** Non-tree kinds: the tiers they are drawn at, at least (P4-C1). */
export const REQUIRED_TIERS_SMALL: readonly ScatterTier[] = [0, 1];

/** Tree kinds (`tree_oak`, `tree_willow`, …) carry impostors; everything else stops at its last drawn tier. */
export function requiredTiers(kind: string): readonly ScatterTier[] {
  return kind.startsWith('tree') ? REQUIRED_TIERS : REQUIRED_TIERS_SMALL;
}
const TIER_NAME: Readonly<Record<ScatterTier, string>> = { 0: 'lod0', 1: 'lod1', 2: 'lod2', 3: 'impostor' };

export function evaluable(dump: ZoneDump): boolean {
  return dump.geometries.length === 0 || dump.geometries.some((g) => g.kind !== undefined);
}

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  const out: Violation[] = [];
  const tiers = new Map<string, Set<ScatterTier>>();
  for (const g of dump.geometries) {
    if (g.kind === undefined || g.kind === null) continue;
    const instanced = g.instancedMesh === undefined ? g.instanced >= 1 : g.instancedMesh;
    if (!instanced) out.push(violation(id, dump, ctx, `scatter geometry ${g.uuid} (${g.kind}) is not an InstancedMesh`, g));
    const s = tiers.get(g.kind) ?? new Set<ScatterTier>();
    if (g.tier === undefined) out.push(violation(id, dump, ctx, `scatter geometry ${g.uuid} (${g.kind}) has no LOD tier`, g));
    else s.add(g.tier);
    tiers.set(g.kind, s);
  }
  for (const kind of [...tiers.keys()].sort()) {
    const have = tiers.get(kind)!;
    const need = requiredTiers(kind);
    const missing = need.filter((t) => !have.has(t)).map((t) => TIER_NAME[t]);
    if (missing.length) out.push(violation(id, dump, ctx, `scatter kind ${kind} lacks ${missing.join(', ')} (needs ${need.map((t) => TIER_NAME[t]).join(', ')})`, { kind, tiers: [...have].sort().map((t) => TIER_NAME[t]) }));
  }
  return out;
}

export function measure(dump: ZoneDump, ctx: AuditContext): number {
  return rule(dump, ctx).length;
}
