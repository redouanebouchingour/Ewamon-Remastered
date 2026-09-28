/**
 * `pnpm --filter @ewa/client harness:budget -- --zone mirevale --shots all --frames 600 --warmup 120 --out .screenshots/budget/mirevale.json`
 * — SPEC §50.2.3. Loads `/harness/budget?zone=<id>` (the offline HarnessWorld: renderer + SceneDirector + scripted camera,
 * no network), and for every §50.6.1 shot position of the zone runs the differential procedure through the
 * `BudgetProbe` (`measure.ts` in the page). Writes `{ machine, adapter, zone, shots: [{ id, counts, passMs,
 * totalMs: { median, p95 }, simMs }] }` (+ the full per-shot record under `detail`) and `<out>.dump.json`
 * (`dumpZone()` at the shot with the most draw calls — the input of `pnpm audit:assets -- --dump`). The report is
 * rewritten after every shot, so an interrupted run keeps what it measured.
 *
 * Exit code 1 on any §50.2.2 count-cap violation, and — unless `--budget-ms 0` — on any §50.2.1 millisecond row;
 * `--report-only` always exits 0 (violations are still listed in the JSON).
 *
 * Options: `--shots all|<id,id>` · `--frames 600` · `--warmup 120` · `--diff-frames <n>` (default = frames) ·
 * `--no-diff` (T_all only) · `--budget-ms 0|1` (default 1) · `--report-only` · `--out <file>` (default
 * `.screenshots/budget/<zone>.json`) · `--no-dump` · `--width 1440 --height 900` · `--serve build|dev` · `--no-build`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AUDIT_SHOTS } from '../../src/harness/shotTable';
import { PASS_TABLE, countViolations, msViolations } from '../../src/harness/budgetRules';
import type { Violation } from '../../src/harness/budgetRules';
import type { ShotBudget } from '../../src/harness/measure';
import { argNum, argStr, evaluate, log, machine, openSession, parseArgs, userPath } from './common';

interface DumpLike { readonly counts: { readonly drawCalls: number } }

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const zone = argStr(args, 'zone', '');
  if (zone === '') throw new Error('--zone <id> is required');
  const frames = argNum(args, 'frames', 600);
  const warmup = argNum(args, 'warmup', 120);
  const diffFrames = argNum(args, 'diff-frames', frames);
  const differential = args['no-diff'] !== true;
  const budgetMs = argNum(args, 'budget-ms', 1) !== 0;
  const reportOnly = args['report-only'] === true;
  const writeDump = args['no-dump'] !== true;
  const width = argNum(args, 'width', 1440);
  const height = argNum(args, 'height', 900);
  const out = userPath(argStr(args, 'out', `.screenshots/budget/${zone}.json`));
  const dumpOut = out.replace(/\.json$/i, '') + '.dump.json';
  const want = argStr(args, 'shots', 'all');
  const tableShots = AUDIT_SHOTS.filter((s) => s.zone === zone);
  const shots = want === 'all' ? tableShots : tableShots.filter((s) => want.split(',').includes(s.id));
  if (shots.length === 0) throw new Error(`no §50.6.1 shot position belongs to zone ${zone}`);

  const t0 = Date.now();
  const session = await openSession({ zone, route: 'budget', width, height, serve: argStr(args, 'serve', 'build') === 'dev' ? 'dev' : 'build', build: args['no-build'] !== true });
  const results: Omit<ShotBudget, 'dump'>[] = [];
  let dump: DumpLike | null = null;
  let dumpAt: string | null = null;
  let pageLog: string[] = [];
  let violations: Violation[] = [];

  const writeReport = (complete: boolean): void => {
    violations = [];
    for (const r of results) {
      violations.push(...countViolations(r));
      if (budgetMs) violations.push(...msViolations(r));
    }
    const worstBy = (f: (r: Omit<ShotBudget, 'dump'>) => number): string | null => {
      let best: Omit<ShotBudget, 'dump'> | null = null;
      for (const r of results) if (best === null || f(r) > f(best)) best = r;
      return best?.id ?? null;
    };
    const json = {
      machine: { ...machine(), chrome: session.browser.version, resolution: { width, height, devicePixelRatio: 1 }, note: 'dev machine; the §50.2 reference machine is 2560x1440 on an RTX 3060 / RX 6600' },
      adapter: { ...(session.info['caps'] as Record<string, unknown>), info: session.info['adapterInfo'] ?? null },
      zone,
      layoutSeed: session.info['layoutSeed'],
      generatedAt: new Date().toISOString(),
      complete,
      options: { frames, warmup, diffFrames, differential, budgetMs, reportOnly, shots: shots.map((s) => s.id) },
      table: PASS_TABLE,
      baseline: session.info['baseline'] ?? null,
      shots: results.map((r) => ({
        id: r.id,
        counts: r.counts,
        passMs: r.passMs,
        totalMs: r.totalMs === null ? null : { median: r.totalMs.median, p95: r.totalMs.p95 },
        simMs: r.simMs.median,
      })),
      worst: { totalMs: worstBy((r) => r.totalMs?.median ?? -1), drawCalls: worstBy((r) => r.countsMax.drawCalls), triangles: worstBy((r) => r.countsMax.triangles) },
      violations,
      dump: dump === null || !writeDump ? null : { file: dumpOut.replace(/\\/g, '/').split('/').pop(), at: dumpAt },
      detail: results,
      pageLog,
      bootMs: session.bootMs,
      wallMs: Date.now() - t0,
    };
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(json, null, 2)}\n`);
    if (dump !== null && writeDump) writeFileSync(dumpOut, `${JSON.stringify(dump, null, 2)}\n`);
  };

  try {
    const cdp = session.browser.cdp;
    for (const shot of shots) {
      log(`${shot.id}: measuring (${frames} frames, warm-up ${warmup}, differential ${differential ? `${diffFrames} frames x 7 passes` : 'off'})`);
      const full = await evaluate<ShotBudget>(cdp, `window.__ewaHarness.measure(${JSON.stringify(shot.id)}, ${JSON.stringify({ frames, warmup, diffFrames, differential })})`, 6 * 60 * 60_000);
      const { dump: d, ...r } = full;
      results.push(r);
      log(`${shot.id}: draws ${r.counts.drawCalls} (max ${r.countsMax.drawCalls}), tris ${r.counts.triangles}, tex ${(r.counts.texturesSize / 2 ** 20).toFixed(1)} MB, materials ${r.counts.materials}, lights ${r.counts.shadowLights}+${r.counts.nonShadowLights}, GPU ${r.totalMs === null ? 'n/a' : `${r.totalMs.median} / p95 ${r.totalMs.p95}`} ms, CPU frame ${r.cpuFrameMs.median} ms, sim ${r.simMs.median} ms (${Math.round(r.wallMs / 1000)} s)`);
      if (dump === null || d.counts.drawCalls > dump.counts.drawCalls) {
        dump = d;
        dumpAt = shot.id;
      }
      pageLog = await evaluate<string[]>(cdp, 'window.__ewaHarness.log').catch(() => pageLog);
      writeReport(false);
    }
  } finally {
    pageLog = await evaluate<string[]>(session.browser.cdp, 'window.__ewaHarness.log').catch(() => pageLog);
    await session.close();
  }
  writeReport(true);
  log(`wrote ${out}${dump !== null && writeDump ? ` and ${dumpOut} (at ${dumpAt})` : ''}`);
  const counts = violations.filter((v) => v.kind === 'count');
  const ms = violations.filter((v) => v.kind === 'ms');
  log(`violations: ${counts.length} count cap(s), ${ms.length} millisecond row(s)${budgetMs ? '' : ' (ms not asserted: --budget-ms 0)'}`);
  for (const v of violations) log(`  ${v.shot} ${v.metric} ${v.value} > ${v.limit}`);
  if (violations.length > 0 && !reportOnly) process.exitCode = 1;
}

main().catch((e: unknown) => {
  log(`FAILED: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exit(1);
});
