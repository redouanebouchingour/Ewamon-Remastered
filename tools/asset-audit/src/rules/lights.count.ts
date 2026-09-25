/**
 * `lights.count` (Pillar 4, §50.2.2): `castShadow` point/spot lights ≤ 8, others ≤ 24. Counted from `lights[]`
 * and from render's own `counts.shadowLights / nonShadowLights`; the larger of the two is held to the cap.
 */
import { NON_SHADOW_LIGHTS_MAX, SHADOW_LIGHTS_MAX } from '../caps.js';
import type { AuditContext, Violation } from '../types.js';
import { violation } from '../types.js';
import type { ZoneDump } from '../zone-dump.js';

export const id = 'lights.count';

export function tally(dump: ZoneDump): { shadow: number; nonShadow: number } {
  let shadow = 0;
  let nonShadow = 0;
  for (const l of dump.lights) if (l.castShadow) shadow++; else nonShadow++;
  return { shadow: Math.max(shadow, dump.counts.shadowLights), nonShadow: Math.max(nonShadow, dump.counts.nonShadowLights) };
}

export function rule(dump: ZoneDump, ctx: AuditContext): Violation[] {
  const t = tally(dump);
  const out: Violation[] = [];
  if (t.shadow > SHADOW_LIGHTS_MAX) out.push(violation(id, dump, ctx, `${t.shadow} shadow-casting lights > ${SHADOW_LIGHTS_MAX}`, { shadow: t.shadow, cap: SHADOW_LIGHTS_MAX }));
  if (t.nonShadow > NON_SHADOW_LIGHTS_MAX) out.push(violation(id, dump, ctx, `${t.nonShadow} non-shadowing lights > ${NON_SHADOW_LIGHTS_MAX}`, { nonShadow: t.nonShadow, cap: NON_SHADOW_LIGHTS_MAX }));
  return out;
}

export function measure(dump: ZoneDump): number {
  const t = tally(dump);
  return t.shadow + t.nonShadow;
}
