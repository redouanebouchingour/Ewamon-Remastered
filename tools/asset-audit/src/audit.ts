/**
 * The dump audit (SPEC §40.5): load one dump or a directory of dumps, run every rule on every dump, keep the
 * worst shot per rule, apply the §40.5.3 regression gate against a baseline.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { REGRESSION_PCT } from './caps.js';
import { REGRESSION_METRICS, RULES } from './registry.js';
import type { AuditContext, LoadedDump, MaterialsManifestLike, RuleModule, Violation } from './types.js';
import { DumpParseError, parseZoneDump } from './zone-dump.js';

export interface RegressionRow {
  readonly metric: string;
  readonly baseline: number;
  readonly current: number;
  readonly pct: number;
}

/** `report.json` (§40.5.3: `{ zone, worst: Record<rule, number>, violations[] }`, plus where each worst came from). */
export interface AuditReport {
  readonly version: 1;
  readonly zone: string;
  readonly dumps: number;
  readonly worst: Readonly<Record<string, number>>;
  readonly worstShot: Readonly<Record<string, string>>;
  /** rule id → shots whose dump lacks the rule's input (the rule could not run there). */
  readonly unevaluated: Readonly<Record<string, readonly string[]>>;
  readonly regressions: readonly RegressionRow[];
  readonly violations: readonly Violation[];
}

export interface Baseline {
  readonly worst: Readonly<Record<string, number>>;
}

export interface AuditOptions {
  readonly materialsManifest: MaterialsManifestLike | null;
  readonly baseline?: Baseline | null;
}

/** Reads one `.json` dump or every `.json` under a directory (recursively, sorted by path). */
export function loadDumps(path: string): LoadedDump[] {
  if (!existsSync(path)) throw new Error(`[asset-audit] dump path not found: ${path}`);
  const files: string[] = [];
  const walk = (p: string): void => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const e of readdirSync(p).sort()) walk(join(p, e));
    } else if (p.toLowerCase().endsWith('.json')) {
      files.push(p);
    }
  };
  walk(path);
  if (files.length === 0) throw new Error(`[asset-audit] no .json dumps under ${path}`);
  const root = statSync(path).isDirectory() ? path : join(path, '..');
  return files.map((f) => {
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(f, 'utf8'));
    } catch (e) {
      throw new Error(`[asset-audit] ${f}: not JSON (${(e as Error).message})`);
    }
    try {
      const dump = parseZoneDump(json);
      return { dump, source: relative(root, f).replace(/\\/g, '/'), shot: dump.shot ?? basename(f, '.json') };
    } catch (e) {
      if (e instanceof DumpParseError) throw new Error(`[asset-audit] ${f}: ${e.message}`);
      throw e;
    }
  });
}

export function readMaterialsManifest(file: string): MaterialsManifestLike | null {
  if (!existsSync(file)) return null;
  const j = JSON.parse(readFileSync(file, 'utf8')) as { surfaces?: unknown };
  if (!j || typeof j !== 'object' || !j.surfaces || typeof j.surfaces !== 'object') {
    throw new Error(`[asset-audit] ${file}: no "surfaces" object — not a materials.manifest.json`);
  }
  return j as MaterialsManifestLike;
}

function measureOf(r: RuleModule, v: Violation[], d: LoadedDump, ctx: AuditContext): number {
  return r.measure ? r.measure(d.dump, ctx) : v.length;
}

/** Runs every rule over every dump. Pure: no I/O. */
export function runAudit(dumps: readonly LoadedDump[], opts: AuditOptions, rules: readonly RuleModule[] = RULES): AuditReport {
  const violations: Violation[] = [];
  const worst: Record<string, number> = {};
  const worstShot: Record<string, string> = {};
  const unevaluated: Record<string, string[]> = {};
  for (const d of dumps) {
    const ctx: AuditContext = { materialsManifest: opts.materialsManifest, peers: dumps, shot: d.shot };
    for (const r of rules) {
      if (r.evaluable && !r.evaluable(d.dump, ctx)) {
        (unevaluated[r.id] ??= []).push(d.shot);
        continue;
      }
      const v = r.rule(d.dump, ctx);
      violations.push(...v);
      const m = measureOf(r, v, d, ctx);
      if (worst[r.id] === undefined || m > worst[r.id]!) {
        worst[r.id] = m;
        worstShot[r.id] = d.shot;
      }
    }
  }
  const regressions: RegressionRow[] = [];
  if (opts.baseline) {
    for (const ruleId of Object.keys(REGRESSION_METRICS).sort()) {
      const metric = REGRESSION_METRICS[ruleId]!;
      const base = opts.baseline.worst[ruleId];
      const cur = worst[ruleId];
      if (base === undefined || cur === undefined) continue;
      const pct = base > 0 ? ((cur - base) / base) * 100 : cur > 0 ? Number.POSITIVE_INFINITY : 0;
      regressions.push({ metric, baseline: base, current: cur, pct: Number.isFinite(pct) ? Math.round(pct * 100) / 100 : pct });
      if (pct > REGRESSION_PCT) {
        const shot = worstShot[ruleId] ?? '';
        const zone = dumps.find((d) => d.shot === shot)?.dump.zone ?? '';
        violations.push({
          rule: `regression.${metric}`,
          zone,
          shot,
          message: `regression.${metric} +${Number.isFinite(pct) ? pct.toFixed(1) : '∞'} % (baseline worst ${base} → ${cur}; gate ${REGRESSION_PCT} %)`,
          object: { metric, baseline: base, current: cur },
        });
      }
    }
  }
  const zones = [...new Set(dumps.map((d) => d.dump.zone))].sort();
  return {
    version: 1,
    zone: zones.join(','),
    dumps: dumps.length,
    worst,
    worstShot,
    unevaluated,
    regressions,
    violations,
  };
}

/** A baseline is a previous report's `worst` (`--write-baseline` writes exactly that). */
export function readBaseline(file: string): Baseline {
  if (!existsSync(file)) throw new Error(`[asset-audit] baseline not found: ${file}`);
  const j = JSON.parse(readFileSync(file, 'utf8')) as { worst?: unknown };
  if (!j || typeof j.worst !== 'object' || j.worst === null) throw new Error(`[asset-audit] ${file}: no "worst" record — not an audit baseline`);
  return { worst: j.worst as Record<string, number> };
}
