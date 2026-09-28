/**
 * SPEC §50.2.3 — the budget capture of one shot position, coded against the `BudgetProbe` contract only
 * (`setPassEnabled`, `counts`, `gpuFrameMs`, `simMs` via `setSimMs`, `dumpZone`):
 *
 * 1. stage the shot (full effects), let every shader compile finish (program count still for 30 frames), then
 *    `warmup` frames with the GPU time resolved per frame;
 * 2. `T_all`: `frames` frames, each `tick()` (sim step + one `renderer.frame`) followed by `await gpuFrameMs()` —
 *    whole-frame GPU ms (`resolveTimestampsAsync(RENDER)`), CPU ms of `renderer.frame`, sim ms of the fixed step,
 *    worst draw calls / triangles;
 * 3. per pass `p` (every `BUDGET_PASSES` member but `opaque`): `setPassEnabled(p, false)`, settle + warm, `diffFrames`
 *    frames → `T_without_p` median, `setPassEnabled(p, true)`; `pass_ms(p) = T_all − T_without_p`, `opaque` the
 *    remainder `T_all − Σ others − simMs` (render's `computePassMs`);
 * 4. cross-check: the live per-render-context attribution (`RenderStats.passMs` from render's `PassTimer`, sprites
 *    inside the scene pass so always null) as medians, and the last frame's timed contexts.
 */
import { BUDGET_PASSES, computePassMs, rendererInternals } from '@ewa/render';
import type { BudgetCounts, BudgetPass, ZoneDump } from '@ewa/render';
import type { HarnessWorld } from './HarnessWorld';
import { median, round3, stat } from './budgetRules';
import type { Stat } from './budgetRules';
import type { ResolvedAnchor } from './anchors';
import { stageShot } from './stage';
import type { StageResult } from './stage';

export interface MeasureOptions {
  readonly frames: number;
  readonly warmup: number;
  /** frames per differential run (default = frames) */
  readonly diffFrames?: number;
  /** false = T_all only (no per-pass differential) */
  readonly differential?: boolean;
  readonly onProgress?: (line: string) => void;
}

export interface ShotBudget {
  readonly id: string;
  readonly anchor: ResolvedAnchor;
  readonly stage: Omit<StageResult, 'anchor'>;
  readonly counts: BudgetCounts;
  readonly countsMax: Pick<BudgetCounts, 'drawCalls' | 'triangles'>;
  readonly countsMin: Pick<BudgetCounts, 'drawCalls' | 'triangles'>;
  readonly passMs: Readonly<Record<BudgetPass, number | null>> | null;
  readonly passMsMethod: 'differential' | 'none';
  readonly withoutMs: Readonly<Partial<Record<BudgetPass, number>>>;
  readonly passMsPerContext: Readonly<Record<BudgetPass, number | null>> | null;
  readonly contexts: readonly { readonly target: string; readonly pass: string; readonly ms: number }[];
  readonly totalMs: Stat | null;
  readonly gpuMs: Stat | null;
  readonly cpuFrameMs: Stat;
  readonly simMs: Stat;
  readonly programsBefore: number;
  readonly programsAfter: number;
  readonly frames: number;
  readonly warmup: number;
  readonly diffFrames: number;
  readonly wallMs: number;
  /** `dumpZone()` right after the T_all capture (one tick, read synchronously), before any pass toggle */
  readonly dump: ZoneDump;
}

interface Run {
  gpu: number[];
  cpu: number[];
  sim: number[];
  perPass: Record<BudgetPass, number[]>;
  maxDraw: number; maxTri: number; minDraw: number; minTri: number;
}

async function run(w: HarnessWorld, frames: number, perContext: boolean): Promise<Run> {
  const out: Run = { gpu: [], cpu: [], sim: [], perPass: {} as Record<BudgetPass, number[]>, maxDraw: 0, maxTri: 0, minDraw: Infinity, minTri: Infinity };
  for (const p of BUDGET_PASSES) out.perPass[p] = [];
  for (let i = 0; i < frames; i++) {
    const t = w.tick();
    const c = w.lastCounts ?? w.probe.counts();
    const ms = await w.probe.gpuFrameMs();
    if (ms !== undefined && Number.isFinite(ms)) out.gpu.push(ms);
    out.cpu.push(t.frameMs);
    out.sim.push(t.simMs);
    out.maxDraw = Math.max(out.maxDraw, c.drawCalls);
    out.maxTri = Math.max(out.maxTri, c.triangles);
    out.minDraw = Math.min(out.minDraw, c.drawCalls);
    out.minTri = Math.min(out.minTri, c.triangles);
    if (perContext) {
      const pm = w.renderer.stats().passMs;
      for (const p of BUDGET_PASSES) { const v = pm[p]; if (v !== null && Number.isFinite(v)) out.perPass[p].push(v); }
    }
  }
  return out;
}

async function warm(w: HarnessWorld, warmup: number): Promise<void> {
  await w.settle(0, 30, 1500);
  for (let i = 0; i < warmup; i++) {
    w.tick();
    await w.probe.gpuFrameMs();
  }
}

export async function measureShot(w: HarnessWorld, anchor: ResolvedAnchor, o: MeasureOptions): Promise<ShotBudget> {
  const t0 = performance.now();
  const say = o.onProgress ?? (() => undefined);
  const staged = await stageShot(w, anchor, 'full');
  const programsBefore = w.renderer.renderer.info.memory.programs;
  await warm(w, o.warmup);
  say(`${anchor.shot}: T_all ${o.frames} frames`);
  const all = await run(w, o.frames, true);
  const counts = w.lastCounts ?? w.probe.counts();
  w.tick();
  const dump = w.probe.dumpZone();
  const host = rendererInternals(w.renderer) as unknown as { passTimer?: { last: readonly { target: string; pass: string; ms: number }[] } | null } | undefined;
  const contexts = (host?.passTimer?.last ?? []).map((c) => ({ target: c.target, pass: c.pass, ms: round3(c.ms) }));
  const hasGpu = all.gpu.length > 0;
  const simStat = stat(all.sim);
  const without: Partial<Record<BudgetPass, number>> = {};
  const diffFrames = o.diffFrames ?? o.frames;
  let passMs: Record<BudgetPass, number | null> | null = null;
  if (hasGpu && o.differential !== false) {
    for (const p of BUDGET_PASSES) {
      if (p === 'opaque') continue;
      w.probe.setPassEnabled(p, false);
      await warm(w, o.warmup);
      const r = await run(w, diffFrames, false);
      without[p] = round3(median(r.gpu));
      w.probe.setPassEnabled(p, true);
      say(`${anchor.shot}: without ${p} ${without[p]} ms (T_all ${round3(median(all.gpu))})`);
    }
    await w.settle(0, 30, 1500);
    const raw = computePassMs(median(all.gpu), without, simStat.median);
    passMs = {} as Record<BudgetPass, number | null>;
    for (const p of BUDGET_PASSES) { const v = raw[p]; passMs[p] = v === null ? null : round3(v); }
  }
  let perContext: Record<BudgetPass, number | null> | null = null;
  if (BUDGET_PASSES.some((p) => all.perPass[p].length > 0)) {
    perContext = {} as Record<BudgetPass, number | null>;
    for (const p of BUDGET_PASSES) perContext[p] = all.perPass[p].length > 0 ? round3(median(all.perPass[p])) : null;
  }
  const { anchor: _a, ...stageRest } = staged;
  return {
    id: anchor.shot, anchor, stage: stageRest, counts,
    countsMax: { drawCalls: all.maxDraw, triangles: all.maxTri },
    countsMin: { drawCalls: all.minDraw, triangles: all.minTri },
    passMs, passMsMethod: passMs === null ? 'none' : 'differential', withoutMs: without, passMsPerContext: perContext, contexts,
    totalMs: hasGpu ? stat(all.gpu) : null, gpuMs: hasGpu ? stat(all.gpu) : null,
    cpuFrameMs: stat(all.cpu), simMs: simStat,
    programsBefore, programsAfter: w.renderer.renderer.info.memory.programs,
    frames: o.frames, warmup: o.warmup, diffFrames, wallMs: Math.round(performance.now() - t0), dump,
  };
}
