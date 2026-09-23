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
import FilmNode from 'three/addons/tsl/display/FilmNode.js';
import GTAONode from 'three/addons/tsl/display/GTAONode.js';
import SMAANode from 'three/addons/tsl/display/SMAANode.js';
import TRAANode from 'three/addons/tsl/display/TRAANode.js';
import { ALL_EFFECTS, type EffectsFlags } from '../src/descriptors.js';
import { applyReducedEffects } from '../src/post/effects.js';
import {
  ALL_PASSES_ON, POST_PARAMS, buildPostOutput, createPostUniforms, createScenePass, planPostGraph, tiltPlaneNormal,
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
    const [dof] = find(all, DepthOfFieldNode); const [ca] = find(all, ChromaticAberrationNode); const [film] = find(all, FilmNode);
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
    expect(plan.find((s) => s.id === 'grain')!.params.intensity).toBe(0.035);
  });
});

describe('§10.8.4 ReducedEffects: absent, not zeroed', () => {
  const nodeCounts = (f: EffectsFlags, backend: 'webgpu' | 'webgl2' = 'webgpu') => {
    const all = collect(graphOf(f, backend).outputNode);
    return {
      gtao: find(all, GTAONode).length, traa: find(all, TRAANode).length, smaa: find(all, SMAANode).length,
      bloom: find(all, BloomNode).length, dof: find(all, DepthOfFieldNode).length, ca: find(all, ChromaticAberrationNode).length,
      film: find(all, FilmNode).length,
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
