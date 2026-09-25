/** Shared types of the audit (SPEC §40.5). */
import type { ZoneDump } from './zone-dump.js';

/** One failed assertion. `object` is the offending dump row (or the numbers) so the CI log names the culprit. */
export interface Violation {
  readonly rule: string;
  readonly zone: string;
  readonly shot: string;
  readonly message: string;
  readonly object?: unknown;
}

/**
 * The subset of `packages/client/public/materials/materials.manifest.json` the audit reads (written by
 * `tools/material-bake`, SPEC §40.3.4): per surface, `albedoClampedPct` proves the albedo ceiling was applied.
 */
export interface MaterialsManifestLike {
  readonly surfaces: Readonly<Record<string, { readonly albedoClampedPct?: number | null }>>;
}

/** A dump plus where it came from. `shot` is `dump.shot`, else the file name without extension. */
export interface LoadedDump {
  readonly dump: ZoneDump;
  readonly source: string;
  readonly shot: string;
}

export interface AuditContext {
  /** `materials.manifest.json`, or null when it could not be read (then `materials.albedoCeiling` fails). */
  readonly materialsManifest: MaterialsManifestLike | null;
  /** Every dump of this audit run (for the pair rule `harvest.same`). */
  readonly peers: readonly LoadedDump[];
  /** The shot id of the dump under test. */
  readonly shot: string;
}

/**
 * One rule file = one module of this shape (SPEC §40.5.2: "each is one function `rule(dump) => Violation[]`").
 * `measure` is the per-shot number the report's `worst` records (the metric for count rules, else the number of
 * offending rows). `evaluable` says whether the dump carries the rule's input; false → reported as unevaluated.
 */
export interface RuleModule {
  readonly id: string;
  readonly rule: (dump: ZoneDump, ctx: AuditContext) => Violation[];
  readonly measure?: (dump: ZoneDump, ctx: AuditContext) => number;
  readonly evaluable?: (dump: ZoneDump, ctx: AuditContext) => boolean;
}

export function violation(rule: string, dump: ZoneDump, ctx: Pick<AuditContext, 'shot'>, message: string, object?: unknown): Violation {
  return object === undefined ? { rule, zone: dump.zone, shot: ctx.shot, message } : { rule, zone: dump.zone, shot: ctx.shot, message, object };
}
