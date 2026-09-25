/** @ewa/asset-audit — SPEC §40.5 (dump rules + regression gate) and the §40.6 `--bytes` roll-up. */
export { loadDumps, readBaseline, readMaterialsManifest, runAudit } from './audit.js';
export type { AuditOptions, AuditReport, Baseline, RegressionRow } from './audit.js';
export { CEILINGS, LICENCES, MISC_DIRS, audioManifestBytes, dirBytes, runBytes } from './bytes.js';
export type { BytesLine, BytesReport } from './bytes.js';
export { COUNT_CAPS, HOUSING_MAX, MATERIALS_MAX, NON_SHADOW_LIGHTS_MAX, REGRESSION_PCT, SHADOW_DRAW_CALLS_MAX, SHADOW_LIGHTS_MAX, SPHERE_MIN_WIDTH_SEGMENTS } from './caps.js';
export { main, parseArgs } from './cli.js';
export { stableJson } from './json.js';
export { REGRESSION_METRICS, RULES, RULE_IDS } from './registry.js';
export type { AuditContext, LoadedDump, MaterialsManifestLike, RuleModule, Violation } from './types.js';
export { BACK_SIDE, DumpParseError, NEAREST_FILTER, parseZoneDump } from './zone-dump.js';
export type { BudgetCounts, DumpGeometry, DumpLight, DumpMaterial, DumpMaterialClass, DumpSprite, HarvestLevel, ZoneDump } from './zone-dump.js';
