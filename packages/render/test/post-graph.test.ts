/**
 * §50.4.6 `post-graph.test.ts`: the §10.8.1 order with the stated parameters; with each EffectsFlags member
 * false the corresponding node is absent from the graph, not zeroed. Uses the REAL `three/tsl` graph (node
 * construction needs no GPU) rather than a mock, and checks order by graph ancestry.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import BloomNode from 'three/addons/tsl/display/BloomNode.js';
import ChromaticAberrationNode from 'three/addons/tsl/display/ChromaticAberrationNode.js';
import DepthOfFieldNode from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { GrainNode, grainChannel } from '../src/post/grain.js';
import GTAONode from 'three/addons/tsl/display/GTAONode.js';
import SMAANode from 'three/addons/tsl/display/SMAANode.js';
import TRAANode from 'three/addons/tsl/display/TRAANode.js';
import { ALL_EFFECTS, type EffectsFlags } from '../src/descriptors.js';
import { applyReducedEffects } from '../src/post/effects.js';
import {
  ALL_PASSES_ON, POST_PARAMS, buildPostOutput, createPostUniforms, createScenePass, planPostGraph, renderTargetsOf, stageTargets, tiltPlaneNormal,
} from '../src/post/pipeline.js';

// SMAANode builds its lookup textures from DOM `Image`s; node has none, and graph construction only needs the object.
beforeAll(() => {
  const g = globalThis as unknown as { Image?: unknown };
  if (g.Image === undefined) g.Image = class { src = ''; onload: (() => void) | null = null; width = 1; height = 1; };
});

function graphOf(f: EffectsFlags, backend: 'webgpu' | 'webgl2' = 'webgpu', passes = ALL_PASSES_ON) {
  const camera = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  const nodes = createScenePass(new Scene(), camera);
  const plan = planPostGraph(f, backend, passes);
  const { outputNode } = buildPostOutput(nodes, camera, createPostUniforms(), plan);
  return { outputNode, plan };
}

function collect(root: Node): Node[] {
  const seen = new Set<Node>(); const out: Node[] = []; const stack: Node[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n)) continue;
    seen.add(n); out.push(n);
    for (const c of (n as Node & { getChildren(): Iterable<Node> }).getChildren()) stack.push(c);
  }
  return out;
}
function find<T>(all: Node[], cls: abstract new (...a: never[]) => T): T[] {
  return all.filter((n) => n instanceof (cls as unknown as abstract new (...a: never[]) => object)) as unknown as T[];
}
const contains = (root: Node, target: Node): boolean => collect(root).includes(target);

describe('§10.8.1 order, realised as one graph', () => {
  it('plans scene → gtao → traa → bloom → dof → chroma → aces → grade → vignette → grain → output', () => {
    expect(planPostGraph(ALL_EFFECTS, 'webgpu').map((s) => s.id)).toEqual(
      ['scene', 'gtao', 'traa', 'bloom', 'dof', 'chroma', 'aces', 'grade', 'vignette', 'grain', 'output']);
  });

  it('the real TSL graph nests the stages in that order (each stage consumes the previous)', () => {
    const { outputNode } = graphOf(ALL_EFFECTS);
    const all = collect(outputNode);
    const [gtao] = find(all, GTAONode); const [traa] = find(all, TRAANode); const [bloom] = find(all, BloomNode);
    const [dof] = find(all, DepthOfFieldNode); const [ca] = find(all, ChromaticAberrationNode); const [film] = find(all, GrainNode);
    for (const n of [gtao, traa, bloom, dof, ca, film]) expect(n).toBeDefined();
    expect(contains(film!.inputNode as Node, ca as unknown as Node)).toBe(true);
    expect(contains(ca!.textureNode as Node, dof as unknown as Node)).toBe(true);
    expect(contains(dof!.textureNode as Node, bloom as unknown as Node)).toBe(true);
    expect(contains(bloom!.inputNode as Node, traa as unknown as Node)).toBe(true);
    expect(contains(traa!.beautyNode as Node, gtao as unknown as Node)).toBe(true);
    expect(contains(gtao as unknown as Node, dof as unknown as Node)).toBe(false);
  });

  it('carries the §10.8.3 numbers', () => {
    const { outputNode, plan } = graphOf(ALL_EFFECTS);
    const all = collect(outputNode);
    const [gtao] = find(all, GTAONode);
    expect(gtao!.resolutionScale).toBe(0.5);
    expect(gtao!.samples.value).toBe(16);
    expect(gtao!.radius.value).toBe(0.9);
    expect(gtao!.thickness.value).toBe(0.6);
    expect(gtao!.useTemporalFiltering).toBe(true);
    const [bloom] = find(all, BloomNode);
    expect((bloom!.strength as unknown as { value: number }).value).toBe(0.35);
    expect((bloom!.radius as unknown as { value: number }).value).toBe(0.6);
    expect((bloom!.threshold as unknown as { value: number }).value).toBe(1.15);
    expect(bloom!.smoothWidth.value).toBe(0.05);
    const [dof] = find(all, DepthOfFieldNode);
    expect((dof!.focalLengthNode as unknown as { value: number }).value).toBe(6);
    expect(POST_PARAMS.dof.tiltDeg).toBe(24);
    expect(POST_PARAMS.dof.bokehPx).toBe(6);
    expect(plan.find((s) => s.id === 'vignette')!.params.strength).toBe(0.22);
    expect(plan.find((s) => s.id === 'grain')!.params.intensity).toBe(0.052);
  });

  it('grain is zero-mean and luminance-weighted (§10.8.2 as amended 2026-10-06; audit M2-spawn-noon-13)', () => {
    const k = POST_PARAMS.grain;
    // mean over a uniform hash n ∈ [0, 1) is the input: full and reduced effects agree in exposure
    for (const c of [0.05, 0.2, 0.5, 0.8]) {
      let sum = 0; const N = 1000;
      for (let i = 0; i < N; i++) sum += grainChannel(c, c, k, (i + 0.5) / N);
      expect(sum / N).toBeCloseTo(c, 9);
    }
    // blacks stay black, whites stay white; mid-grey swings ±k/2 (σ ≈ k / √12 ≈ 1.5 %)
    expect(grainChannel(0, 0, k, 1)).toBe(0);
    expect(grainChannel(1, 1, k, 0)).toBe(1);
    expect(grainChannel(0.5, 0.5, k, 1) / 0.5 - 1).toBeCloseTo(k / 2, 9);
    expect(k / Math.sqrt(12)).toBeCloseTo(0.015, 3);
  });
});

describe('§10.8.4 ReducedEffects: absent, not zeroed', () => {
  const nodeCounts = (f: EffectsFlags, backend: 'webgpu' | 'webgl2' = 'webgpu') => {
    const all = collect(graphOf(f, backend).outputNode);
    return {
      gtao: find(all, GTAONode).length, traa: find(all, TRAANode).length, smaa: find(all, SMAANode).length,
      bloom: find(all, BloomNode).length, dof: find(all, DepthOfFieldNode).length, ca: find(all, ChromaticAberrationNode).length,
      film: find(all, GrainNode).length,
    };
  };

  it('all flags on → every node present once', () => {
    expect(nodeCounts(ALL_EFFECTS)).toEqual({ gtao: 1, traa: 1, smaa: 0, bloom: 1, dof: 1, ca: 1, film: 1 });
  });

  it.each([
    ['dof', { dof: 0 }], ['grain', { film: 0 }], ['chroma', { ca: 0 }], ['bloom', { bloom: 0 }], ['taa', { traa: 0, smaa: 1 }],
  ] as const)('flag %s = false removes its node', (flag, expected) => {
    const counts = nodeCounts({ ...ALL_EFFECTS, [flag]: false });
    expect(counts).toMatchObject(expected);
  });

  it('the reduced strip keeps bloom and TRAA, drops DOF / grain / chroma', () => {
    const f = applyReducedEffects(ALL_EFFECTS);
    expect(f).toMatchObject({ dof: false, grain: false, chroma: false, shake: false, hitstop: false, slowmo: false, bloom: true, taa: true });
    expect(nodeCounts(f)).toEqual({ gtao: 1, traa: 1, smaa: 0, bloom: 1, dof: 0, ca: 0, film: 0 });
  });

  it('webgl2 fallback swaps TRAA for SMAA and turns GTAO temporal filtering off', () => {
    expect(nodeCounts(ALL_EFFECTS, 'webgl2')).toMatchObject({ traa: 0, smaa: 1 });
    const gtao = planPostGraph(ALL_EFFECTS, 'webgl2').find((s) => s.id === 'gtao')!;
    expect(gtao.params.temporal).toBe(false);
  });

  it('BudgetProbe pass switches remove graph stages', () => {
    const plan = planPostGraph(ALL_EFFECTS, 'webgpu', { ...ALL_PASSES_ON, gtao: false, traa: false, bloom: false, dof: false, grade: false });
    expect(plan.map((s) => s.id)).toEqual(['scene', 'chroma', 'output']);
  });
});

describe('§10.7.3 tilt-shift focal plane', () => {
  it('pitch −52° gives n = (−0.2419·f_h, 0.9703)', () => {
    const pitch = -52 * Math.PI / 180;
    const fwd = new Vector3(0, Math.sin(pitch), -Math.cos(pitch));      // looking along −z, pitched down
    const n = tiltPlaneNormal(fwd, new Vector3());
    expect(n.y).toBeCloseTo(0.9703, 4);
    expect(n.z).toBeCloseTo(0.2419, 4);                                  // −0.2419 · f_h with f_h = (0, 0, −1)
    expect(n.x).toBeCloseTo(0, 9);
    // a prop 12 m nearer/farther along the ground is 2.90 m off-plane
    expect(12 * 0.2419).toBeCloseTo(2.90, 2);
  });
});

describe('R4 — the DOF CoC is zero under the sharp mask (IMPLEMENTATION-NOTES Part 4, H3)', () => {
  function dofOf(dofMaskedCoC?: boolean) {
    const camera = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
    const nodes = createScenePass(new Scene(), camera);
    const plan = planPostGraph(ALL_EFFECTS, 'webgpu');
    const { outputNode } = buildPostOutput(nodes, camera, createPostUniforms(), plan, dofMaskedCoC === undefined ? {} : { dofMaskedCoC });
    const [dof] = find(collect(outputNode), DepthOfFieldNode);
    return { dof: dof!, maskT: nodes.maskT as unknown as Node, depthT: nodes.scenePass.getTextureNode('depth') as unknown as Node };
  }

  it('viewZNode = −d · (1 − mask.y): the mask texture feeds the CoC, next to the depth reconstruction', () => {
    const { dof, maskT, depthT } = dofOf();
    type Op = Node & { op?: string; aNode?: Node; bNode?: Node; isVarNode?: boolean; node?: Node };
    let viewZ = dof.viewZNode as Op;
    while (viewZ.isVarNode === true) viewZ = viewZ.node as Op;   // TSL wraps a reused expression in a VarNode
    expect(viewZ.op).toBe('*');
    expect(contains(viewZ.aNode!, depthT)).toBe(true);        // −d (world position from depth, dotted with the plane)
    expect(contains(viewZ.aNode!, maskT)).toBe(false);
    expect(contains(viewZ.bNode!, maskT)).toBe(true);          // (1 − mask.y)
    expect(contains(viewZ.bNode!, depthT)).toBe(false);
  });

  it('the before-graph (dofMaskedCoC false) feeds −d alone', () => {
    const { dof, maskT, depthT } = dofOf(false);
    expect(contains(dof.viewZNode as Node, maskT)).toBe(false);
    expect(contains(dof.viewZNode as Node, depthT)).toBe(true);
  });
});

describe('per-context GPU timing: render target → §50.2.1 row (IMPLEMENTATION-NOTES Part 4, H6)', () => {
  it('maps the scene pass to opaque and every stage\'s own targets (incl. convertToTexture RTTs) to its row', () => {
    const camera = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
    const nodes = createScenePass(new Scene(), camera);
    const build = buildPostOutput(nodes, camera, createPostUniforms(), planPostGraph(ALL_EFFECTS, 'webgpu'));
    const map = stageTargets(nodes, build);
    const byPass: Record<string, number> = {};
    for (const p of map.values()) byPass[p] = (byPass[p] ?? 0) + 1;
    expect(map.get((nodes.scenePass as unknown as { renderTarget: never }).renderTarget)).toBe('opaque');
    const all = collect(build.outputNode);
    const [gtao] = find(all, GTAONode); const [traa] = find(all, TRAANode); const [bloom] = find(all, BloomNode); const [dof] = find(all, DepthOfFieldNode);
    for (const rt of renderTargetsOf(gtao as unknown as Node)) expect(map.get(rt)).toBe('gtao');
    for (const rt of renderTargetsOf(traa as unknown as Node)) expect(map.get(rt)).toBe('traa');
    for (const rt of renderTargetsOf(bloom as unknown as Node)) expect(map.get(rt)).toBe('bloom');
    for (const rt of renderTargetsOf(dof as unknown as Node)) expect(map.get(rt)).toBe('dof');
    // the counts the render-target cap derivation (§10.10.2) lists: bloom 11, DOF 6 + Gaussian 2 + input RTT 1,
    // TRAA 2 + input RTT 1, GTAO 1, chroma input RTT 1 (grade row), scene MRT 1
    expect(byPass).toEqual({ opaque: 1, gtao: 1, traa: 3, bloom: 11, dof: 9, grade: 1 });
    expect(build.stages.map((s) => s.pass)).toEqual(['gtao', 'traa', 'bloom', 'dof', 'grade']);
  });
});
