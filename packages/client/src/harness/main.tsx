/**
 * Harness entry (`packages/client/harness/index.html`, served at `/harness/budget?zone=<id>` and
 * `/harness/shots?zone=<id>` by `scripts/harness/*` — a separate Vite input, never part of the app's `index.html`
 * bundle). Boots the offline HarnessWorld for one zone and exposes `window.__ewaHarness` for the CDP driver:
 * `stage(shotId, variant)`, `measure(shotId, options)`, `dump()`, `counts()`, `info()`, `overlay(on)`.
 */
import '../ui/fonts.css';
import '../ui/tokens.css';
import '../ui/global.css';
import { createRoot } from 'react-dom/client';
import { Vector2 } from 'three/webgpu';
import { harvestStateFor, zone as zoneDef } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { rendererInternals } from '@ewa/render';
import type { BudgetCounts, ZoneDump } from '@ewa/render';
import { headingConvention, resolveAnchor, setHeadingConvention, shotDef, shotsForZone } from './anchors';
import type { ResolvedAnchor, ShotId, Variant } from './anchors';
import { HarnessWorld } from './HarnessWorld';
import type { HandoverResult } from './HarnessWorld';
import { HarnessOverlay } from './HarnessOverlay';
import { measureShot } from './measure';
import type { MeasureOptions, ShotBudget } from './measure';
import { restoreEdgeScan, stageEdgeScan, stageShot } from './stage';
import { zoneSpecFor } from '../scene/zoneSpecFor';
import type { EdgeStage, StageOptions, StageResult } from './stage';
import s from './Harness.module.css';

interface HarnessApi {
  ready: boolean;
  error: string | null;
  readonly log: string[];
  readonly zone: string;
  info(): Record<string, unknown>;
  anchors(): readonly ResolvedAnchor[];
  stage(shot: ShotId, variant: Variant, o?: StageOptions): Promise<StageResult>;
  /** E3 sprite-edge scan: the inspector close-up on the shot's wild creature, `mask.y` drawn to the canvas */
  edgeScan(shot: ShotId): Promise<EdgeStage>;
  /** E3: the same frame's scene-pass `output` MRT (pre-TRAA) drawn to the canvas */
  edgeOutput(): Promise<void>;
  edgeRestore(): Promise<void>;
  /** E3 diagnostics: `stage:name` of every shader program three holds (multiset, sorted) */
  programNames(): string[];
  /** E3: a measured crossing into the linked zone `to` (`handover-hitch.spec.ts`); boot with `?bg=1` for the client's compile */
  handover(to: ZoneId, o: { readonly preload: boolean; readonly framesAfter?: number }): Promise<HandoverResult>;
  measure(shot: ShotId, o: Omit<MeasureOptions, 'onProgress'>): Promise<ShotBudget>;
  dump(): ZoneDump;
  counts(): BudgetCounts;
  overlay(on: boolean): void;
}

const params = new URLSearchParams(location.search);
const zoneId = (params.get('zone') ?? 'mirevale') as ZoneId;
// ?set=M3: every zone takes all six §50.6.1 rows (shotTable.ts `shotsForZone`); default M2 = the table's own zones
const auditSet = params.get('set') ?? 'M2';
// ?headings=rig: the §50.6.1 heading numbers straight to the rig (default: the table's words, anchors.ts)
setHeadingConvention(params.get('headings') === 'rig' ? 'rig' : 'words');
const log: string[] = [];
const say = (line: string): void => {
  log.push(`${(performance.now() / 1000).toFixed(1)}s ${line}`);
  console.info(`[harness] ${line}`);
};

const canvas = document.createElement('canvas');
canvas.className = s.canvas ?? '';
document.body.appendChild(canvas);
const layer = document.createElement('div');
layer.className = s.layer ?? '';
document.body.appendChild(layer);
createRoot(layer).render(<HarnessOverlay />);

const world = new HarnessWorld(canvas, say);
world.backgroundCompile = params.get('bg') === '1';

function anchors(): ResolvedAnchor[] {
  const out: ResolvedAnchor[] = [];
  for (const shot of shotsForZone(zoneId, auditSet)) {
    const a = resolveAnchor(shot, world.spec);
    if (a !== null) out.push(a);
  }
  return out;
}

function anchorOf(id: ShotId): ResolvedAnchor {
  const a = resolveAnchor(shotDef(id), world.spec);
  if (a === null) throw new Error(`shot ${id} has no anchor in ${zoneId}`);
  return a;
}

function info(): Record<string, unknown> {
  const r = world.renderer;
  const dev = (r.renderer.backend as unknown as { device?: { adapterInfo?: Record<string, unknown>; features?: Iterable<string> } }).device;
  const ai = dev?.adapterInfo;
  const host = rendererInternals(r) as unknown as { baseline?: BudgetCounts; compileStats?: unknown } | undefined;
  const size = r.renderer.getDrawingBufferSize(new Vector2());
  return {
    zone: zoneId,
    layoutSeed: zoneDef(zoneId).layoutSeed >>> 0,
    backend: r.backend,
    caps: r.caps,
    adapterInfo: ai === undefined ? null : { vendor: ai['vendor'], architecture: ai['architecture'], device: ai['device'], description: ai['description'] },
    features: dev?.features === undefined ? [] : [...dev.features].sort(),
    canvas: { cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, pixelRatio: r.renderer.getPixelRatio(), drawingBuffer: [size.x, size.y] },
    devicePixelRatio,
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    baseline: host?.baseline ?? null,
    compileStats: host?.compileStats ?? null,
    materialWarnings: r.materials.warnings(),
    harvest: world.harvest,
    headingConvention: headingConvention(),
    auditSet,
    shots: shotsForZone(zoneId, auditSet).map((x) => x.id),
  };
}

const api: HarnessApi = {
  ready: false,
  error: null,
  log,
  zone: zoneId,
  info,
  anchors,
  stage: async (id, variant, o) => {
    layer.hidden = variant === 'mask';
    return stageShot(world, anchorOf(id), variant, o);
  },
  edgeScan: async (id) => {
    layer.hidden = true;
    return stageEdgeScan(world, anchorOf(id));
  },
  edgeOutput: () => world.drawOutput(),
  handover: (to, o) => world.handover(to, o),
  programNames: () => {
    const p = (world.renderer.renderer as unknown as { _pipelines?: { programs?: { vertex: Map<string, { name: string }>; fragment: Map<string, { name: string }> } } })._pipelines?.programs;
    if (!p) return [];
    return [...[...p.vertex.values()].map((x) => `v:${x.name}`), ...[...p.fragment.values()].map((x) => `f:${x.name}`)].sort();
  },
  edgeRestore: async () => {
    await restoreEdgeScan(world);
    layer.hidden = false;
  },
  measure: async (id, o) => {
    layer.hidden = false;
    return measureShot(world, anchorOf(id), { ...o, onProgress: say });
  },
  // one frame first, read synchronously: the dump's `counts` are `renderer.info`, which three's rAF loop resets per display frame
  dump: () => {
    world.tick();
    return world.probe.dumpZone();
  },
  counts: () => world.probe.counts(),
  overlay: (on) => {
    layer.hidden = !on;
  },
};
(window as unknown as { __ewaHarness: HarnessApi }).__ewaHarness = api;

async function main(): Promise<void> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) say('navigator.gpu missing: three will fall back to WebGL2');
  const wild = new Set<string>();
  // the wild species of this zone's shots are bound before the zone is built (a species bound later pops in)
  const spec = zoneSpecFor(zoneDef(zoneId), harvestStateFor(zoneId, new Set()));
  for (const shot of shotsForZone(zoneId, auditSet)) {
    const a = resolveAnchor(shot, spec);
    if (a?.wild) wild.add(a.wild.speciesId);
  }
  await world.boot(zoneId, [...wild]);
  new ResizeObserver(() => world.resize()).observe(canvas);
  const settled = await world.settle(60, 30, 2400);
  say(`boot settle: ${settled.frames} frames, programs ${settled.programs}, stable ${settled.stable}`);
  api.ready = true;
}

main().catch((e: unknown) => {
  api.error = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : String(e);
  console.error(e);
});
