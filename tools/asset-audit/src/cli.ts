/**
 * `pnpm audit:assets -- --dump <file|dir> [--baseline <file>] [--write-baseline] [--report <file>] [--materials <file>]`
 * `pnpm audit:assets -- --bytes [--public <dir>]`
 *
 * Exit 0 = every rule / ceiling holds; 1 = a violation (rule id and offending object printed); 2 = bad input.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { loadDumps, readBaseline, readMaterialsManifest, runAudit } from './audit.js';
import type { AuditReport } from './audit.js';
import { runBytes } from './bytes.js';
import type { BytesReport } from './bytes.js';
import { stableJson } from './json.js';
import { DEFAULT_BASELINE, DEFAULT_REPORT, MATERIALS_MANIFEST, PUBLIC_DIR, REPO_ROOT, userPath } from './paths.js';
import { RULE_IDS } from './registry.js';

export interface CliArgs {
  readonly dump: string | null;
  readonly bytes: boolean;
  readonly baseline: string | null;
  readonly writeBaseline: boolean;
  readonly report: string;
  readonly materials: string;
  readonly publicDir: string;
}

const USAGE = [
  'usage: pnpm audit:assets -- --dump <file|dir> [--baseline <file>] [--write-baseline] [--report <file>] [--materials <file>]',
  '       pnpm audit:assets -- --bytes [--public <dir>]',
].join('\n');

export function parseArgs(argv: readonly string[]): CliArgs {
  let dump: string | null = null;
  let bytes = false;
  let baseline: string | null = null;
  let writeBaseline = false;
  let report = DEFAULT_REPORT;
  let materials = MATERIALS_MANIFEST;
  let publicDir = PUBLIC_DIR;
  const value = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new UsageError(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case '--': case 'report': break;                   // pnpm passes the separator through; 'report' is the legacy script verb
      case '--dump': dump = userPath(value(i, a)); i++; break;
      case '--bytes': bytes = true; break;
      case '--baseline': baseline = userPath(value(i, a)); i++; break;
      case '--write-baseline': writeBaseline = true; break;
      case '--report': report = userPath(value(i, a)); i++; break;
      case '--materials': materials = userPath(value(i, a)); i++; break;
      case '--public': publicDir = userPath(value(i, a)); i++; break;
      default: throw new UsageError(`unknown argument ${a}`);
    }
  }
  if (!dump && !bytes) throw new UsageError('nothing to do: pass --dump or --bytes');
  if (writeBaseline && !dump) throw new UsageError('--write-baseline needs --dump');
  return { dump, bytes, baseline, writeBaseline, report, materials, publicDir };
}

export class UsageError extends Error {}

const rel = (p: string): string => relative(REPO_ROOT, p).replace(/\\/g, '/') || '.';
const mb = (n: number): string => `${(n / (1024 * 1024)).toFixed(2)} MB`;
const clip = (s: string, n = 400): string => (s.length > n ? `${s.slice(0, n)}…` : s);

function printAudit(r: AuditReport, log: (s: string) => void): void {
  log(`asset-audit --dump: ${r.dumps} dump(s), zone ${r.zone || '(none)'}, ${RULE_IDS.length} rules`);
  const failed = new Set(r.violations.map((v) => v.rule));
  for (const id of RULE_IDS) {
    const status = failed.has(id) ? 'FAIL' : r.unevaluated[id] && r.worst[id] === undefined ? 'N/A ' : 'ok  ';
    const w = r.worst[id];
    log(`  ${status} ${id.padEnd(30)} worst ${w === undefined ? '-' : String(w)}${r.worstShot[id] ? `  (${r.worstShot[id]})` : ''}`);
  }
  for (const [id, shots] of Object.entries(r.unevaluated).sort()) {
    log(`  unevaluated: ${id} on ${shots.length} shot(s) — the dump lacks this rule's input fields (see README)`);
  }
  for (const g of r.regressions) log(`  regression check ${g.metric}: baseline ${g.baseline} → ${g.current} (${Number.isFinite(g.pct) ? g.pct.toFixed(1) : '∞'} %)`);
  for (const v of r.violations) {
    log(`FAIL ${v.rule} ${v.zone}/${v.shot}: ${v.message}`);
    if (v.object !== undefined) log(`     ${clip(JSON.stringify(v.object))}`);
  }
}

function printBytes(r: BytesReport, log: (s: string) => void): void {
  log(`asset-audit --bytes: ${rel(r.publicDir)}`);
  for (const l of r.lines) {
    log(`  ${l.ok ? 'ok  ' : 'FAIL'} ${l.line.padEnd(34)} ${mb(l.bytes).padStart(10)} / ${mb(l.ceiling).padStart(10)}  (manifest ${l.manifestBytes === null ? '-' : l.manifestBytes}, disk ${l.diskBytes})${l.note ? `  ${l.note}` : ''}`);
  }
  for (const w of r.warnings) log(`  warning: ${w}`);
  for (const e of r.errors) log(`FAIL ${e}`);
}

export function main(argv: readonly string[], log: (s: string) => void = console.log): number {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (e) {
    if (e instanceof UsageError) {
      log(`asset-audit: ${e.message}\n${USAGE}`);
      return 2;
    }
    throw e;
  }
  let code = 0;
  if (args.dump) {
    let report: AuditReport;
    try {
      const dumps = loadDumps(args.dump);
      const baseline = args.baseline && !args.writeBaseline ? readBaseline(args.baseline) : null;
      report = runAudit(dumps, { materialsManifest: readMaterialsManifest(args.materials), baseline });
    } catch (e) {
      log(`asset-audit: ${(e as Error).message}`);
      return 2;
    }
    printAudit(report, log);
    mkdirSync(dirname(args.report), { recursive: true });
    writeFileSync(args.report, stableJson(report));
    log(`  report → ${rel(args.report)}`);
    if (args.writeBaseline) {
      const file = args.baseline ?? DEFAULT_BASELINE;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, stableJson({ version: 1, zone: report.zone, worst: report.worst, worstShot: report.worstShot }));
      log(`  baseline → ${rel(file)} (commit it in the same PR; the reviewer sees the increase)`);
    }
    if (report.violations.length) code = 1;
  }
  if (args.bytes) {
    const r = runBytes(args.publicDir);
    printBytes(r, log);
    if (!r.ok) code = 1;
  }
  return code;
}

const invoked = process.argv[1] ?? '';
if (/[\\/]cli\.(ts|js)$/.test(invoked)) {
  process.exitCode = main(process.argv.slice(2));
}
