/**
 * The rule set, in the order of SPEC §40.5.2 (the ids are exactly §50.4.6's names). One file per rule under
 * `src/rules/`, each exporting `id`, `rule(dump, ctx) => Violation[]`, optionally `measure` and `evaluable`.
 */
import * as drawCalls from './rules/budget.counts.drawCalls.js';
import * as triangles from './rules/budget.counts.triangles.js';
import * as texturesSize from './rules/budget.counts.texturesSize.js';
import * as renderTargets from './rules/budget.counts.renderTargets.js';
import * as programs from './rules/budget.counts.programs.js';
import * as materialsCount from './rules/materials.count.js';
import * as threeMaps from './rules/materials.threeMaps.js';
import * as albedoCeiling from './rules/materials.albedoCeiling.js';
import * as ktx2Only from './rules/textures.ktx2Only.js';
import * as noPrimitives from './rules/geometry.noPrimitives.js';
import * as noOutlineShells from './rules/geometry.noOutlineShells.js';
import * as scatterInstanced from './rules/scatter.instanced.js';
import * as lightsCount from './rules/lights.count.js';
import * as lightsHousing from './rules/lights.housing.js';
import * as spritesNearest from './rules/sprites.nearest.js';
import * as shadowsDrawCalls from './rules/shadows.drawCalls.js';
import * as harvestSame from './rules/harvest.same.js';
import type { RuleModule } from './types.js';

export const RULES: readonly RuleModule[] = Object.freeze([
  drawCalls, triangles, texturesSize, renderTargets, programs,
  materialsCount, threeMaps, albedoCeiling, ktx2Only,
  noPrimitives, noOutlineShells, scatterInstanced,
  lightsCount, lightsHousing, spritesNearest, shadowsDrawCalls, harvestSame,
]);

/** Every rule id, as §50.4.6 names them. */
export const RULE_IDS: readonly string[] = Object.freeze(RULES.map((r) => r.id));

/** Metrics the §40.5.3 regression gate compares against the baseline (rule id → short metric name). */
export const REGRESSION_METRICS: Readonly<Record<string, string>> = Object.freeze({
  'budget.counts.drawCalls': 'drawCalls',
  'budget.counts.triangles': 'triangles',
  'budget.counts.texturesSize': 'texturesSize',
  'materials.count': 'materials.count',
});
