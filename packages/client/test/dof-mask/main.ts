/**
 * §50.1 #7 / §50.4.7 `dof-mask.spec.ts` page (test-only; never part of an app bundle): the offline HarnessWorld on
 * `mire_route` with a per-frame readback of the scene pass's `mask` MRT (y = DOF-sharp, §10.8.2) — the target the DOF
 * node reads its CoC through.
 *
 * Each checked frame: one World3D-order tick (the frame under test), then the mask over each subject's screen rect is
 * read back exactly (HalfFloat, `readRenderTargetPixelsAsync`). The subject's visible silhouette S is found by two
 * extra renders of the same moment with its DOF-sharp bit forced to 1 and to 0 (the pixels that follow the bit),
 * eroded by `ERODE` px; every re-render reuses the tick frame's TRAA jitter offset so the silhouettes line up. A pixel of S whose natural mask reads < 1.0 fails the frame
 * unless it is explained: it reads 1.0 again in an immediate re-render with the natural bits (something drifted across
 * it only in the tick frame), or — for a billboard, which writes mask.x = 1 wherever it draws — the frame did not draw
 * the billboard there at all (mask.x 0: an interior alpha-test hole caught by that render's jitter, terrain behind).
 * Explained pixels are counted as `transient` and reported. Subjects: the local player's figure in the overworld; both
 * active battlers during the scripted battle.
 */
import { harvestStateFor, zone as zoneDef } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { part3Of, rendererInternals } from '@ewa/render';
import { HarnessWorld, SELF_ID } from '../../src/harness/HarnessWorld';
import { resolveAnchor, shotDef } from '../../src/harness/anchors';
import { stageShot } from '../../src/harness/stage';
import { useUiStore } from '../../src/state/ui';
import { zoneSpecFor } from '../../src/scene/zoneSpecFor';

type Rect = readonly [number, number, number, number];

interface Subject {
  readonly name: string;
  /** billboards write mask.x = 1 on every pixel they draw (actors write 0), so x tells a billboard pixel from a hole */
  readonly billboard: boolean;
  rect(): Rect | null;
  /** current natural bit */
  bit(): number;
  /** force the bit (0 / 1) or restore the natural value (null) */
  force(v: 0 | 1 | null): void;
}

export interface FrameRecord {
  readonly frame: number;
  readonly phase: 'overworld' | 'battle';
  readonly subjects: readonly { readonly name: string; readonly bit: number; readonly silhouette: number; readonly rectPx: number; readonly bad: number; readonly transient: number; readonly minMask: number; readonly samples: readonly string[] }[];
}

export interface DofReport {
  readonly ok: boolean;
  readonly zone: string;
  readonly frames: number;
  readonly checked: readonly FrameRecord[];
  readonly failures: readonly string[];
  readonly log: readonly string[];
}

const ZONE: ZoneId = 'mire_route';
const log: string[] = [];
const say = (s: string): void => {
  log.push(`${(performance.now() / 1000).toFixed(1)}s ${s}`);
  console.info(`[dof] ${s}`);
};

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const world = new HarnessWorld(canvas, say);

function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * 2 ** -14 * (f / 1024);
  if (e === 0x1f) return f ? NaN : (s ? -1 : 1) * Infinity;
  return (s ? -1 : 1) * 2 ** (e - 15) * (1 + f / 1024);
}

interface MaskTarget { readonly rt: unknown; readonly index: number; readonly width: number; readonly height: number }

function maskTarget(): MaskTarget {
  const host = rendererInternals(world.renderer);
  if (host === undefined) throw new Error('no renderer internals');
  const sp = (host.post as unknown as { nodes: { scenePass: { renderTarget: { textures: { name: string }[]; width: number; height: number } } } }).nodes.scenePass;
  const rt = sp.renderTarget;
  let index = rt.textures.findIndex((t) => t.name === 'mask');
  if (index < 0) index = 3; // MRT order: output, normal, velocity, mask
  return { rt, index, width: rt.width, height: rt.height };
}

/** mask.y (and mask.x) over a CSS-px rect as row-major Float32Arrays plus the pixel rect it covers. */
async function readMask(t: MaskTarget, rect: Rect): Promise<{ y: Float32Array; x: Float32Array; x0: number; y0: number; w: number; h: number }> {
  const k = t.width / canvas.clientWidth;
  const x0 = Math.max(0, Math.floor(rect[0] * k));
  const y0 = Math.max(0, Math.floor(rect[1] * k));
  const x1 = Math.min(t.width, Math.ceil(rect[2] * k));
  const y1 = Math.min(t.height, Math.ceil(rect[3] * k));
  const w = Math.max(0, x1 - x0);
  const h = Math.max(0, y1 - y0);
  const out = new Float32Array(w * h);
  const outX = new Float32Array(w * h);
  if (w === 0 || h === 0) return { y: out, x: outX, x0, y0, w, h };
  const gpu = world.renderer.renderer as unknown as { readRenderTargetPixelsAsync(rt: unknown, x: number, y: number, w: number, h: number, index: number): Promise<ArrayLike<number>> };
  const buf = await gpu.readRenderTargetPixelsAsync(t.rt, x0, y0, w, h, t.index);
  // 4 channels per texel; WebGPU pads every row but the last to 256 bytes (copyTextureToBuffer's bytesPerRow)
  const half = buf instanceof Uint16Array;
  const rowLen = h > 1 ? (buf.length - w * 4) / (h - 1) : w * 4;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * rowLen + c * 4;
      const vx = buf[i]!;
      const v = buf[i + 1]!;
      out[r * w + c] = half ? halfToFloat(v) : v;
      outX[r * w + c] = half ? halfToFloat(vx) : vx;
    }
  }
  return { y: out, x: outX, x0, y0, w, h };
}

/** TRAANode's Halton jitter index (three 0.186: `_jitterIndex` over 32 offsets, advanced once per render). */
const HALTON = 32;
function traaNode(): { _jitterIndex: number } | null {
  const host = rendererInternals(world.renderer);
  const stages = (host?.post as unknown as { current?: { stages: { pass: string; node: unknown }[] } } | undefined)?.current?.stages ?? [];
  const n = stages.find((x) => x.pass === 'traa')?.node as { _jitterIndex?: number } | undefined;
  return n !== undefined && typeof n._jitterIndex === 'number' ? (n as { _jitterIndex: number }) : null;
}

/** Re-renders the current state; `jitter` pins TRAA's sub-pixel offset (the natural frame's) so silhouettes line up. */
function render(jitter: number | null = null): void {
  const host = rendererInternals(world.renderer);
  const t = traaNode();
  if (t !== null && jitter !== null) t._jitterIndex = jitter;
  (host!.post as unknown as { render(): void }).render();
}

/**
 * Erosion (px) of the forced silhouette before the natural mask is compared. The re-renders reuse the frame's TRAA
 * jitter offset (`render(jit)`), so silhouettes line up to the pixel; the 1 px margin only absorbs what still moves
 * between renders tens of ms apart (wind-animated grass at the feet). Interior pixels have no excuse.
 */
const ERODE = 1;

async function checkFrame(t: MaskTarget, subjects: readonly Subject[], phase: FrameRecord['phase']): Promise<FrameRecord> {
  const rects = subjects.map((s) => s.rect());
  const bits = subjects.map((s) => s.bit());
  // the natural mask is the tick's own frame; each forced render is read back before the next (three resolves the copy
  // asynchronously, so a later render would overwrite an un-copied target)
  const read = (): Promise<(Awaited<ReturnType<typeof readMask>> | null)[]> => Promise.all(rects.map((r) => (r === null ? null : readMask(t, r))));
  const natural = await read();
  // every re-render reuses the tick frame's TRAA jitter offset; the sequence then continues where the tick left it
  const traa = traaNode();
  const next = traa?._jitterIndex ?? null;
  const jit = next === null ? null : (next + HALTON - 1) % HALTON;
  for (const s of subjects) s.force(1);
  render(jit);
  const on = await read();
  for (const s of subjects) s.force(0);
  render(jit);
  const off = await read();
  for (const s of subjects) s.force(null);
  // the same state once more with the natural bits: a pixel that reads < 1 in the tick frame AND here is a confirmed
  // miss; one that reads 1 here was covered only transiently in the tick frame (an ambient particle drifting by)
  render(jit);
  const again = await read();
  if (traa !== null && next !== null) traa._jitterIndex = next;
  const out: FrameRecord['subjects'][number][] = [];
  subjects.forEach((s, i) => {
    const n = natural[i];
    const a = on[i];
    const b = off[i];
    const g = again[i];
    if (n == null || a == null || b == null || g == null) {
      out.push({ name: s.name, bit: bits[i]!, silhouette: 0, rectPx: 0, bad: 0, transient: 0, minMask: 1, samples: [] });
      return;
    }
    const { w, h } = n;
    const inS = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < w && r < h && a.y[r * w + c]! >= 0.999 && b.y[r * w + c]! <= 0.001;
    let sil = 0;
    let bad = 0;
    let transient = 0;
    let minMask = 1;
    const samples: string[] = [];
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        // eroded silhouette: every pixel within ERODE px (a square) follows the forced bit
        let core = true;
        for (let dr = -ERODE; dr <= ERODE && core; dr++) for (let dc = -ERODE; dc <= ERODE && core; dc++) core = inS(c + dc, r + dr);
        if (!core) continue;
        sil++;
        const v = n.y[r * w + c]!;
        if (v >= 0.999) continue;
        // a billboard pixel the frame did not draw (an interior alpha-test hole that this render's TRAA jitter put a pixel
        // centre into: mask.x 0 = the terrain behind shows through) is not the battler
        if (s.billboard && n.x[r * w + c]! < 0.5) {
          transient++;
          continue;
        }
        if (g.y[r * w + c]! >= 0.999) {
          transient++;
          continue;
        }
        if (v < minMask) minMask = v;
        bad++;
        if (samples.length < 4) samples.push(`(${n.x0 + c}, ${n.y0 + r}) y ${v.toFixed(3)} x ${n.x[r * w + c]!.toFixed(3)} again ${g.y[r * w + c]!.toFixed(3)}`);
      }
    }
    out.push({ name: s.name, bit: bits[i]!, silhouette: sil, rectPx: w * h, bad, transient, minMask, samples });
  });
  return { frame: world.frames, phase, subjects: out };
}

function playerSubject(): Subject {
  const actors = world.renderer.actors as unknown as { byId: Map<string, { ud: { sharp: number }; accUd: { sharp: number } }>; sharpOf(id: string): number };
  let saved: number | null = null;
  return {
    name: 'player',
    billboard: false,
    rect: () => world.playerRect(),
    bit: () => actors.sharpOf(SELF_ID),
    force: (v) => {
      const rec = actors.byId.get(SELF_ID);
      if (rec === undefined) return;
      if (v === null) {
        if (saved !== null) { rec.ud.sharp = saved; rec.accUd.sharp = saved; }
        saved = null;
        return;
      }
      if (saved === null) saved = rec.ud.sharp;
      rec.ud.sharp = v;
      rec.accUd.sharp = v;
    },
  };
}

function battlerSubject(side: 0 | 1): Subject {
  const bb = () => part3Of(world.renderer)?.stage.battler({ side, slot: 0 }) ?? null;
  let saved: number | null = null;
  const ud = () => (bb() as unknown as { rig?: { ud: { sharp: number } } } | null)?.rig?.ud ?? null;
  return {
    name: side === 0 ? 'battler-player' : 'battler-foe',
    billboard: true,
    rect: () => world.battlerRects().find((r) => r.side === side)?.rect ?? null,
    bit: () => ud()?.sharp ?? -1,
    force: (v) => {
      const u = ud();
      if (u === null) return;
      if (v === null) {
        if (saved !== null) u.sharp = saved;
        saved = null;
        return;
      }
      if (saved === null) saved = u.sharp;
      u.sharp = v;
    },
  };
}

async function run(o: { overworldFrames: number; battleFrames: number }): Promise<DofReport> {
  const failures: string[] = [];
  const checked: FrameRecord[] = [];
  const t = maskTarget();
  const wild = resolveAnchor(shotDef('battle'), world.spec);
  if (wild === null || wild.wild === null) throw new Error('no battle anchor in mire_route');

  // overworld: the player at a new walkable point every 60 frames, the camera following
  const player = playerSubject();
  world.setTimeOfDay(0.5);
  world.setView(0, 1);
  const pts = [[wild.x, wild.z], [wild.x + 6, wild.z], [wild.x, wild.z + 6], [wild.x - 6, wild.z - 3], [wild.x + 3, wild.z - 6]] as const;
  for (let f = 0; f < o.overworldFrames; f++) {
    if (f % 60 === 0) {
      const [x, z] = pts[(f / 60) % pts.length]!;
      world.place(x, z, (f / 60) * 1.3);
      for (let k = 0; k < 20; k++) world.tick(); // the follow spring settles
      await world.gpuIdle();
    }
    world.tick();
    await world.gpuIdle();
    checked.push(await checkFrame(t, [player], 'overworld'));
  }

  // battle: the §50.6.1 shot-5 staging (scripted wild battle to the turn-2 impact), then the timeline plays on
  const staged = await stageShot(world, wild, 'full');
  say(`battle staged: ${JSON.stringify(staged.battle)}`);
  const script = world.script(wild.wild.speciesId, wild.wild.level);
  let nextTurn = 2;
  const battlers = [battlerSubject(0), battlerSubject(1)];
  for (let f = 0; f < o.battleFrames; f++) {
    const ui = useUiStore.getState().battle;
    if (ui?.phase === 'selecting' && nextTurn < script.turns.length) {
      world.battle.submit(script.turns[nextTurn]!.action);
      nextTurn++;
    }
    world.tick();
    await world.gpuIdle();
    checked.push(await checkFrame(t, battlers, 'battle'));
  }

  for (const r of checked) {
    for (const s of r.subjects) {
      const where = `frame ${r.frame} (${r.phase}) ${s.name}`;
      if (s.bit !== 1) failures.push(`${where}: DOF-sharp bit ${s.bit}`);
      if (s.bad > 0) failures.push(`${where}: ${s.bad}/${s.silhouette} silhouette px below 1.0 in the frame and its re-render (min ${s.minMask.toFixed(4)}; ${s.samples.join('; ')})`);
    }
  }
  // the probe must actually have seen the subjects (a silhouette of 0 px proves nothing)
  const seen = (name: string): number => checked.filter((r) => r.subjects.some((s) => s.name === name && s.silhouette >= 50)).length;
  for (const name of ['player', 'battler-player', 'battler-foe']) {
    const n = seen(name);
    const total = checked.filter((r) => r.subjects.some((s) => s.name === name)).length;
    if (n < total * 0.9) failures.push(`${name}: silhouette visible (≥ 50 px) in only ${n}/${total} frames`);
  }
  return { ok: failures.length === 0, zone: ZONE, frames: checked.length, checked, failures: failures.slice(0, 50), log };
}

/** Diagnostics for the readback (target size, attachment names, the player's rect and its mask under each forcing). */
async function probe(): Promise<Record<string, unknown>> {
  const t = maskTarget();
  const rt = t.rt as { textures: { name: string; type: number; format: number }[] };
  const p = playerSubject();
  world.tick();
  await world.gpuIdle();
  const rect = p.rect();
  const center = async (): Promise<number[]> => {
    if (rect === null) return [];
    const m = await readMask(t, rect);
    return [m.w, m.h, m.y.reduce((a, v) => Math.max(a, v), 0), m.y.reduce((a, v) => a + (v >= 0.999 ? 1 : 0), 0)];
  };
  const natural = await center();
  p.force(1); render(); const on = await center();
  p.force(0); render(); const off = await center();
  p.force(null);
  const gpu = world.renderer.renderer as unknown as { readRenderTargetPixelsAsync(rt: unknown, x: number, y: number, w: number, h: number, index: number): Promise<ArrayLike<number> & { constructor: { name: string } }> };
  const raw = await gpu.readRenderTargetPixelsAsync(t.rt, 0, 0, 4, 4, t.index);
  return {
    width: t.width, height: t.height, index: t.index, client: [canvas.clientWidth, canvas.clientHeight],
    textures: rt.textures.map((x) => ({ name: x.name, type: x.type, format: x.format })),
    rect, bit: p.bit(), natural, on, off, rawType: raw.constructor.name, rawLength: raw.length,
  };
}

interface DofApi { ready: boolean; error: string | null; run: typeof run; probe: typeof probe; log: string[] }
const api: DofApi = { ready: false, error: null, run, probe, log };
(window as unknown as { __dof: DofApi }).__dof = api;

async function main(): Promise<void> {
  const spec = zoneSpecFor(zoneDef(ZONE), harvestStateFor(ZONE, new Set()));
  const a = resolveAnchor(shotDef('battle'), spec);
  await world.boot(ZONE, a?.wild ? [a.wild.speciesId] : []);
  new ResizeObserver(() => world.resize()).observe(canvas);
  const s = await world.settle(60, 30, 2400);
  say(`settled: ${s.frames} frames, programs ${s.programs}, stable ${s.stable}`);
  api.ready = true;
}

main().catch((e: unknown) => {
  api.error = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : String(e);
  console.error(e);
});
