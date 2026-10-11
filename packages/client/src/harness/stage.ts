/**
 * Stages one §50.6.1 shot in the harness world and leaves the frame ready for `Page.captureScreenshot`:
 * - overworld shots: the player stands at the resolved anchor facing the camera, the rig at the anchor's heading (a
 *   rig index since the 2026-10-06 amendment, `anchors.ts`) and the shot's zoom stop, `timeOfDay` from the table; frames run until the heading /
 *   zoom eases, the follow spring, the IBL re-bake and every shader compile have settled;
 * - shot 5: the player engages the zone's first common creature from the resolved battle anchor; the scripted battle
 *   (`battleScript.ts`) plays through the real BattleController — intro, turn 1 — then turn 2 runs until its first HP
 *   frame (the impact: camera `impact` cue, hurt flash, bar drain start) and 9 more fixed steps (150 ms), i.e. the
 *   damage cue mid-flight. Reduced effects rebuild the timeline with `ctx.reduced` exactly as the client does;
 * - the `mask` variant renders the same moment with full effects, then draws `mask.y` as greyscale (`drawMask`).
 */
import { Vector3 } from 'three/webgpu';
import type { BattleUi } from '../state/ui';
import { useUiStore } from '../state/ui';
import { part3Of, rendererInternals } from '@ewa/render';
import type { BudgetCounts } from '@ewa/render';
import type { HarnessWorld } from './HarnessWorld';
import { yieldTask } from './HarnessWorld';
import { shotDef, viewForward } from './anchors';
import type { Heading, ResolvedAnchor, ShotDef, Variant } from './anchors';

export interface StageOptions {
  /** minimum settle frames before the program count must hold still (default 90) */
  readonly settleFrames?: number;
  /** fixed steps after the turn-2 impact frame (default 9 = 150 ms) */
  readonly afterImpactSteps?: number;
}

export interface StageResult {
  readonly shot: string;
  readonly variant: Variant;
  readonly anchor: ResolvedAnchor;
  readonly camera: {
    readonly rigHeading: Heading | null;
    readonly zoomStop: number | null;
    readonly mode: string | null;
    readonly position: readonly [number, number, number];
    readonly focus: readonly [number, number, number];
    readonly shotBlend: number | null;
  };
  readonly timeOfDay: number;
  readonly effects: Readonly<Record<string, boolean>>;
  readonly postPlan: readonly string[];
  readonly counts: BudgetCounts;
  readonly settle: { readonly frames: number; readonly stable: boolean; readonly programs: number };
  readonly rects: { readonly player: readonly [number, number, number, number] | null; readonly battlers: readonly { readonly side: 0 | 1; readonly rect: readonly [number, number, number, number] }[] };
  readonly hud: { readonly partySlots: number; readonly nameplates: readonly string[]; readonly prompt: string | null; readonly timeOfDay: number; readonly battleBars: readonly string[] | null };
  readonly battle: null | {
    readonly seed: number;
    readonly move: string;
    readonly turn: number;
    readonly phase: BattleUi['phase'] | null;
    readonly cursorMs: number;
    readonly timelineMs: number;
    readonly framesIntro: number;
    readonly framesTurn1: number;
    readonly framesToImpact: number;
    readonly afterImpactMs: number;
    readonly log: readonly string[];
    readonly turnLabel: string | null;
    readonly heading: Heading | null;
  };
  readonly notes: readonly string[];
  readonly frame: number;
}

const r3 = (v: number): number => Math.round(v * 1000) / 1000 + 0;
const vec = (v: { x: number; y: number; z: number }): readonly [number, number, number] => [r3(v.x), r3(v.y), r3(v.z)];

function facingCamera(rig: Heading): number {
  const [fx, fz] = viewForward(rig);
  return Math.atan2(-fx, -fz);
}

function barsOf(w: HarnessWorld): readonly string[] | null {
  const b = w.hud.current().battle;
  if (b === null) return null;
  return b.bars.map((x) => `${x.name} L${x.level} ${x.hp}/${x.maxHp}`);
}

function hpKey(w: HarnessWorld): string {
  const b = w.hud.current().battle;
  return b === null ? '' : b.bars.map((x) => x.hp).join(',');
}

const phase = (): BattleUi['phase'] | null => useUiStore.getState().battle?.phase ?? null;

/** E3 (audit M2-sprite-edge-5): the inspector close-up the sprite-edge scan reads. */
export interface EdgeStage {
  readonly species: string;
  /** CSS-px rect of the inspected billboard's quad (feet → top, ± half width), dpr 1 */
  readonly rect: readonly [number, number, number, number];
  /** level-0 texels of the frame's height (`SpriteFrame.px[3]`) */
  readonly frameTexels: number;
  /** screen px per level-0 texel (rect height / frameTexels) — §50.1 #6 asks ≥ 1.3 */
  readonly magnification: number;
  /** at the stock inspector distance and 28° (before the lens narrowing) */
  readonly magnificationStock: number;
  readonly cameraDistance: number;
  /** vertical fov used for the scan frame (28° narrowed until the magnification target is met) */
  readonly fovDeg: number;
  readonly frames: number;
}

/** Magnification the scan stages (margin over §50.1 #6's 1.3). */
export const EDGE_SCAN_MAGNIFICATION = 1.35;

const _feet = new Vector3();
const _top = new Vector3();

/**
 * E3: stages `stage.inspect` on the shot-3 wild creature (noon, at the sprite-edge anchor) and narrows the camera's
 * vertical fov — never its distance or the sampler — until one level-0 texel covers `EDGE_SCAN_MAGNIFICATION` screen
 * px (the stock 4 m inspector gives ≈ 1.1× on a 1024² frame at 900 px, audit M2-sprite-edge-5). Then draws the scene
 * pass's `mask.y` (the billboard is DOF-sharp in the inspector) for the Node-side scan. `restoreEdgeScan` undoes it.
 */
export async function stageEdgeScan(w: HarnessWorld, anchor: ResolvedAnchor): Promise<EdgeStage> {
  const wild = anchor.wild;
  if (wild === null) throw new Error(`shot ${anchor.shot} has no wild creature to inspect`);
  const p3 = part3Of(w.renderer);
  if (p3 === undefined || w.catalog === null) throw new Error('no stage / sprite catalog');
  w.restoreOutput();
  w.endBattle();
  w.setEffects(false);
  w.setWild(null);
  const rig = anchor.heading.rig ?? shotDef('sprite-edge').heading ?? 3;
  w.setView(rig, 1);
  w.place(anchor.x, anchor.z, facingCamera(rig));
  w.setTimeOfDay(0.5);
  await w.prepareSpecies([wild.speciesId]);
  const desc = w.catalog.descriptor(wild.speciesId, 'harness:edge-scan', 'normal', false);
  if (desc === null) throw new Error(`no sprite for ${wild.speciesId}`);
  w.renderer.stage.inspect(desc);
  const cam = w.renderer.camera.camera;
  const fov0 = cam.fov;
  let frames = await w.runWhile(() => ((w.renderer.camera as unknown as { shotBlend?: number }).shotBlend ?? 1) < 1, 240);
  frames += (await w.settle(20, 10, 300)).frames;
  const bb = p3.stage.inspectedBillboard;
  if (bb === null) throw new Error('inspector billboard missing');
  const texels = desc.front.px[3];
  const measure = (): { rect: readonly [number, number, number, number]; mag: number } => {
    bb.feet(_feet); bb.topWorld(_top);
    const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    const half = (bb.heightM * (desc.front.aspect || 1)) / 2;
    const rect = w.rectOfWorld([_feet.clone().addScaledVector(right, -half), _feet.clone().addScaledVector(right, half), _top.clone().addScaledVector(right, -half), _top.clone().addScaledVector(right, half)]);
    return { rect, mag: (rect[3] - rect[1]) / texels };
  };
  const stock = measure();
  if (stock.mag < EDGE_SCAN_MAGNIFICATION) {
    const k = stock.mag / EDGE_SCAN_MAGNIFICATION;
    cam.fov = (2 * Math.atan(Math.tan((fov0 * Math.PI) / 360) * k) * 180) / Math.PI;
    cam.updateProjectionMatrix();
    frames += await w.runWhile(() => true, 8);
  }
  const scan = measure();
  w.isolateInspector(true);
  frames += await w.runWhile(() => true, 4);
  await w.drawMask();
  w.edgeFov0 = fov0;
  return {
    species: wild.speciesId, rect: scan.rect, frameTexels: texels, magnification: Math.round(scan.mag * 1000) / 1000,
    magnificationStock: Math.round(stock.mag * 1000) / 1000, cameraDistance: Math.round(cam.position.distanceTo(_top.lerp(_feet, 0.5)) * 1000) / 1000,
    fovDeg: Math.round(cam.fov * 1000) / 1000, frames,
  };
}

/** E3: leaves the inspector, restores the fov and the output node. */
export async function restoreEdgeScan(w: HarnessWorld): Promise<void> {
  w.restoreOutput();
  w.isolateInspector(false);
  w.renderer.stage.inspect(null);
  const cam = w.renderer.camera.camera;
  if (w.edgeFov0 !== null) { cam.fov = w.edgeFov0; cam.updateProjectionMatrix(); w.edgeFov0 = null; }
  await w.runWhile(() => ((w.renderer.camera as unknown as { shotBlend?: number }).shotBlend ?? 0) > 0, 120);
}

export async function stageShot(w: HarnessWorld, anchor: ResolvedAnchor, variant: Variant, o: StageOptions = {}): Promise<StageResult> {
  const shot: ShotDef = shotDef(anchor.shot);
  const notes: string[] = [];
  w.restoreOutput();
  w.endBattle();
  const effects = w.setEffects(variant === 'reduced');
  const settleFrames = o.settleFrames ?? 90;
  let battleInfo: StageResult['battle'] = null;
  let settle = { frames: 0, stable: false, programs: 0 };

  if (shot.id !== 'battle') {
    const rig = anchor.heading.rig ?? shot.heading ?? 0;   // a faceSubject row or an M3 fallback may turn the view
    w.setWild(anchor.wild !== null && shot.id === 'sprite-edge' ? anchor.wild : null);
    w.setView(rig, shot.zoomStop);
    w.place(anchor.x, anchor.z, facingCamera(rig));
    w.setTimeOfDay(shot.timeOfDay);
    settle = await w.settle(settleFrames);
    if (shot.id === 'link-east') {
      notes.push(
        'neighbour skirt staged (render E3, audit M2-link-east-1): beyond the field edge on each linked side the skirt is the neighbour zone\'s own terrain — its heightfield and road / plaza layers at 2 m, no props — from `ZoneSpec.neighbours` (SceneDirector `withNeighbours`); the neighbour\'s props, actors and creatures stream in at the handover (Renderer.loadZone holds one zone)',
      );
    }
  } else {
    const wild = anchor.wild;
    if (wild === null) throw new Error('battle shot needs a wild slot');
    // the player arrives with shot 3's framing (rig 3 ≈ +x), stands 2.5 m from the creature, facing it
    const preHeading = shotDef('sprite-edge').heading ?? 3;
    w.setWild(wild);
    w.setView(preHeading, 1);
    w.place(anchor.x, anchor.z, Math.atan2(wild.x - anchor.x, wild.z - anchor.z));
    w.setTimeOfDay(shot.timeOfDay);
    await w.settle(30, 10, 600);
    const s = w.script(wild.speciesId, wild.level);
    w.setWild(wild, true);                       // engaged: hidden, its battle is on the arena (SpawnViews)
    w.startBattle(s);
    const framesIntro = await w.runWhile(() => phase() !== 'selecting', 1500);
    w.battle.submit(s.turns[0].action);
    await yieldTask();
    const framesTurn1 = await w.runWhile(() => phase() !== 'selecting', 1500);
    const before = hpKey(w);
    w.battle.submit(s.turns[1].action);
    await yieldTask();
    const framesToImpact = await w.runWhile(() => hpKey(w) === before, 1500);
    const after = o.afterImpactSteps ?? 9;
    await w.runWhile(() => true, after);
    w.battle.flushLog();
    await new Promise((res) => setTimeout(res, 120));   // React commits the log lines
    const ui = useUiStore.getState().battle;
    const rigNow = w.renderer.camera as unknown as { headingIndex?: Heading };
    battleInfo = {
      seed: s.seed, move: s.move, turn: 2, phase: phase(), cursorMs: r3(w.battle.player.cursorMs), timelineMs: r3(w.battle.player.expectedMs),
      framesIntro, framesTurn1, framesToImpact, afterImpactMs: r3((after * 1000) / 60),
      log: (ui?.log ?? []).slice(-3).map((l) => l.text), turnLabel: ui?.turnLabel ?? null, heading: rigNow.headingIndex ?? null,
    };
    if (hpKey(w) === before) notes.push('no HP frame was reached in turn 2 (capture is not at the impact)');
    settle = { frames: framesIntro + framesTurn1 + framesToImpact + after, stable: true, programs: w.renderer.renderer.info.memory.programs };
  }

  if (variant === 'mask') await w.drawMask();

  const cam = w.renderer.camera;
  const rig = cam as unknown as { headingIndex?: Heading; zoomStop?: number; currentMode?: string; shotBlend?: number };
  const host = rendererInternals(w.renderer);
  const hudModel = w.hud.current();
  return {
    shot: shot.id, variant, anchor,
    camera: {
      rigHeading: rig.headingIndex ?? null, zoomStop: rig.zoomStop ?? null, mode: rig.currentMode ?? null,
      position: vec(cam.camera.position), focus: vec(cam.focus), shotBlend: rig.shotBlend ?? null,
    },
    timeOfDay: shot.timeOfDay,
    effects: { ...effects },
    postPlan: host?.post.plan.map((p) => p.id) ?? [],
    counts: w.lastCounts ?? w.probe.counts(),
    settle,
    rects: { player: w.playerRect(), battlers: shot.id === 'battle' ? w.battlerRects() : [] },
    hud: {
      partySlots: hudModel.party.length, nameplates: hudModel.nameplates.map((n) => n.name),
      prompt: hudModel.prompt === null ? null : `${hudModel.prompt.key} ${hudModel.prompt.verb} ${hudModel.prompt.target}`,
      timeOfDay: hudModel.timeOfDay, battleBars: barsOf(w),
    },
    battle: battleInfo,
    notes,
    frame: w.frames,
  };
}
