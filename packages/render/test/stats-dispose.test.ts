import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, MeshStandardNodeMaterial, PerspectiveCamera, PlaneGeometry, PointLight, Scene, SpotLight, Vector3 } from 'three/webgpu';
import type { Node, WebGPURenderer } from 'three/webgpu';
import { ALL_EFFECTS, BUDGET_PASSES, type BudgetPass } from '../src/descriptors.js';
import {
  COUNT_CAPS, PassTimer, aggregatePassMs, capViolations, computePassMs, copyInfo, countPunctualLights, createRenderStats, median, percentile, readBudgetCounts,
} from '../src/stats.js';
import { applyReducedEffects } from '../src/post/effects.js';
import { PostStack } from '../src/post/pipeline.js';
import { SkyController } from '../src/lighting/sky.js';
import { DayCycle } from '../src/lighting/daycycle.js';
import { LightRig, SPEC_LIGHT_UNIT } from '../src/lighting/rig.js';
import { createHeightFog } from '../src/lighting/fog.js';
import { createSharedUniforms } from '../src/materials/harvest.js';

const info = (o: Partial<{ drawCalls: number; triangles: number; textures: number; texturesSize: number; programs: number; renderTargets: number }> = {}) => ({
  render: { drawCalls: o.drawCalls ?? 120, triangles: o.triangles ?? 50_000 },
  memory: {
    textures: o.textures ?? 40, texturesSize: o.texturesSize ?? 1_000_000, geometries: 12, programs: o.programs ?? 60, renderTargets: o.renderTargets ?? 20,
    attributes: 30, attributesSize: 4096, total: 2_000_000,
  },
});

describe('§10.10 stats record and counts', () => {
  it('is preallocated with passMs all null, and copyInfo writes in place', () => {
    const s = createRenderStats();
    expect(Object.keys(s.passMs).sort()).toEqual([...BUDGET_PASSES].sort());
    for (const p of BUDGET_PASSES) expect(s.passMs[p]).toBeNull();
    expect(s.gpuMs).toBeNull();
    const passMs = s.passMs;
    copyInfo(info({ drawCalls: 7 }), s);
    expect(s.drawCalls).toBe(7);
    expect(s.textureBytes).toBe(1_000_000);
    expect(s.passMs).toBe(passMs);
    copyInfo(info(), s, 46_000_000);                          // KTX2 sets: three's Info counts each compressed texture as 1 byte
    expect(s.textureBytes).toBe(47_000_000);
    expect(readBudgetCounts(info(), 0, 0, 0, 46_000_000).texturesSize).toBe(47_000_000);
  });

  it('reads BudgetCounts and flags the §50.2.2 caps', () => {
    const c = readBudgetCounts(info({ programs: 129, renderTargets: 42 }), 49, 9, 24);
    expect(c).toMatchObject({ drawCalls: 120, programs: 129, renderTargets: 42, materials: 49, shadowLights: 9, nonShadowLights: 24, attributesSize: 4096 });
    expect(capViolations(c).map((v) => v.metric).sort()).toEqual(['materials', 'programs', 'renderTargets', 'shadowLights']);
    // §50.2.2 as amended 2026-09-25: render targets ≤ 41, programs ≤ 128 (the old 24 / 96 were measured impossible)
    expect(COUNT_CAPS).toEqual({ drawCalls: 400, triangles: 2_500_000, texturesSize: 734_003_200, materials: 48, shadowLights: 8, nonShadowLights: 24, renderTargets: 41, programs: 128 });
    // the measured slice numbers (34 render targets, 107 programs with Mirevale loaded) are inside the caps
    expect(capViolations(readBudgetCounts(info({ programs: 107, renderTargets: 34 }), 18, 3, 17))).toEqual([]);
    expect(capViolations(readBudgetCounts(info({ programs: 128, renderTargets: 41 }), 48, 8, 24))).toEqual([]);
  });

  it('computes per-pass ms differentially: T_all − T_without, opaque as the remainder', () => {
    const r = computePassMs(10, { sprites: 9.2, shadows: 8, gtao: 8.9, traa: 9.3, bloom: 9.4, dof: 9.1, grade: 9.6 }, 0.6);
    expect(r.shadows).toBeCloseTo(2, 9);
    expect(r.gtao).toBeCloseTo(1.1, 9);
    const others = 0.8 + 2 + 1.1 + 0.7 + 0.6 + 0.9 + 0.4;
    expect(r.opaque).toBeCloseTo(10 - others - 0.6, 9);
    const partial = computePassMs(10, { bloom: 10.3 }, 0);
    expect(partial.bloom).toBe(0);            // noise clamps to 0
    expect(partial.dof).toBeNull();
  });

  it('median / percentile', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(Number.isNaN(median([]))).toBe(true);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
  });

  it('counts punctual lights by castShadow, skipping the debug layer', () => {
    const root = new Group();
    const a = new SpotLight(); a.castShadow = true;
    const b = new PointLight(); const c = new PointLight();
    const dbg = new Group(); dbg.layers.set(31); dbg.add(new PointLight());
    root.add(a, b, c, dbg);
    expect(countPunctualLights(root, { shadow: 0, nonShadow: 0 })).toEqual({ shadow: 1, nonShadow: 2 });
  });
});

/** Minimal renderer stand-in: RenderPipeline / PMREMGenerator constructors only read these fields. */
const fakeRenderer = (): WebGPURenderer => ({ toneMapping: 0, outputColorSpace: 'srgb', xr: { enabled: false } }) as unknown as WebGPURenderer;

describe('dispose bookkeeping (mocked GPU)', () => {
  it('PostStack.rebuild disposes the retired display nodes; dispose() frees everything once', () => {
    const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
    const post = new PostStack(fakeRenderer(), new Scene(), cam, 'webgpu', ALL_EFFECTS);
    const owned1 = (post as unknown as { owned: Node[] }).owned;
    expect(owned1.length).toBeGreaterThanOrEqual(5);          // GTAO, TRAA, Bloom, DOF + the RTTs convertToTexture made
    const spies1 = owned1.map((n) => vi.spyOn(n, 'dispose'));
    const pipelineSpy = vi.spyOn(post.pipeline, 'dispose');
    const passSpy = vi.spyOn(post.nodes.scenePass, 'dispose');

    post.rebuild(applyReducedEffects(ALL_EFFECTS));
    for (const s of spies1) expect(s).toHaveBeenCalledTimes(1);
    expect(passSpy).not.toHaveBeenCalled();                   // the scene pass (and its MRT) persists
    expect(post.plan.map((s) => s.id)).not.toContain('dof');
    expect(post.pipeline.needsUpdate).toBe(true);

    const owned2 = (post as unknown as { owned: Node[] }).owned;
    const spies2 = owned2.map((n) => vi.spyOn(n, 'dispose'));
    post.dispose();
    post.dispose();
    for (const s of spies2) expect(s).toHaveBeenCalledTimes(1);
    expect(passSpy).toHaveBeenCalledTimes(1);
    expect(pipelineSpy).toHaveBeenCalledTimes(1);
  });

  it('DayCycle writes the SPEC-unit sun, punctual multiplier and fog; dispose() frees the sky once', () => {
    const scene = new Scene();
    const rig = new LightRig(scene);
    const sky = new SkyController(fakeRenderer(), scene);
    const bake = vi.spyOn(sky, 'bake').mockImplementation(() => {});
    const skyDispose = vi.spyOn(sky, 'dispose');
    const fog = createHeightFog();
    const shared = createSharedUniforms();
    const day = new DayCycle({ rig, sky, fog, shared });
    day.setTime(0.5);
    day.update(16, 0.016, new Vector3(3, 0, 4));
    expect(bake).toHaveBeenCalledTimes(1);                    // first update always bakes
    expect(rig.sun.intensity).toBeCloseTo(1.0 * SPEC_LIGHT_UNIT, 9);
    expect(rig.sun.target.position.toArray()).toEqual([3, 0, 4]);
    expect(rig.sun.position.y).toBeCloseTo(120 * Math.sin(70 * Math.PI / 180), 6);
    expect(shared.timeOfDay.value).toBe(0.5);
    expect(fog.uniforms.fogDensity.value).toBeCloseTo(0.018, 12);
    day.update(16, 0.016, new Vector3(3, 0, 4));
    expect(bake).toHaveBeenCalledTimes(1);                    // no re-bake without 2° / 20 s
    day.setWeather('sand');
    day.update(16, 0.016, new Vector3());
    expect(bake).toHaveBeenCalledTimes(2);                    // weather forces a re-bake
    expect(fog.uniforms.fogDensity.value).toBeCloseTo(0.018 * 2.5, 12);
    day.dispose();
    day.dispose();
    expect(skyDispose).toHaveBeenCalledTimes(1);
    rig.dispose();
  });

  it('harvest level 2 switches every punctual light to 0 without removing it', () => {
    const scene = new Scene();
    const rig = new LightRig(scene);
    const root = new Group();
    scene.add(root);
    rig.createPunctuals([{ id: 'l', kind: 'lantern', color: '#fff', intensity: 30, position: [0, 3, 0], castShadow: true, range: 10, housing: { kind: 'generated', generator: 'lantern', seed: 1 }, flicker: null }], root);
    root.add(new Mesh(new PlaneGeometry(1, 1), new MeshStandardNodeMaterial()));
    rig.setPunctualMultiplier(1);
    rig.update(0);
    expect(rig.handlesList()[0]!.light.intensity).toBe(30);
    rig.setPunctualEnabled(false);
    rig.update(0);
    expect(rig.handlesList()[0]!.light.intensity).toBe(0);
    expect(countPunctualLights(scene, { shadow: 0, nonShadow: 0 })).toEqual({ shadow: 1, nonShadow: 0 });
    rig.dispose();
  });
});

describe('per-context GPU timing → passMs (IMPLEMENTATION-NOTES Part 4, H6)', () => {
  it('sums the last resolved frame by row; unknown contexts count as opaque; sprites stays null; absent rows 0', () => {
    const uidPass = new Map<string, { pass: BudgetPass; target: string }>([
      ['r:1:7:f10', { pass: 'opaque', target: 'scene' }],
      ['r:1:7:f11', { pass: 'opaque', target: 'scene' }],
      ['r:2:9:f11', { pass: 'shadows', target: 'ShadowMap' }],
      ['r:3:9:f11', { pass: 'shadows', target: 'ShadowMap' }],
      ['r:4:12:f11', { pass: 'bloom', target: 'UnrealBloomPass.h0' }],
      ['r:5:1:f11', { pass: 'grade', target: 'canvas' }],
    ]);
    const timestamps = new Map<string, number>([
      ['r:1:7:f10', 9], ['r:1:7:f11', 3], ['r:2:9:f11', 0.5], ['r:3:9:f11', 0.25], ['r:4:12:f11', 0.4], ['r:5:1:f11', 0.1], ['r:6:3:f11', 0.2],
    ]);
    const out = createRenderStats().passMs as Record<BudgetPass, number | null>;
    const rows = aggregatePassMs({ timestamps, frames: [10, 11] }, uidPass, out)!;
    expect(out.opaque).toBeCloseTo(3.2, 9);            // scene pass 3 + the unattributed context 0.2 (PMREM / probe rule)
    expect(out.shadows).toBeCloseTo(0.75, 9);
    expect(out.bloom).toBeCloseTo(0.4, 9);
    expect(out.grade).toBeCloseTo(0.1, 9);
    expect(out.gtao).toBe(0);
    expect(out.sprites).toBeNull();
    expect(rows).toHaveLength(6);
    expect(aggregatePassMs({ timestamps: new Map(), frames: [] }, uidPass, out)).toBeNull();
  });

  it('PassTimer classifies each beginRender and forgets the resolved batch', () => {
    const t = new PassTimer((rt) => (rt === null ? 'grade' : 'dof'));
    t.beginRender('r:1:1:f5', new Scene(), new PerspectiveCamera(), null);
    t.beginRender('r:2:2:f5', new Scene(), new PerspectiveCamera(), { width: 4, height: 4, texture: { name: 'DepthOfField.Composite' } } as never);
    const out = createRenderStats().passMs as Record<BudgetPass, number | null>;
    expect(t.collect({ timestamps: new Map([['r:1:1:f5', 0.3], ['r:2:2:f5', 0.9]]), frames: [5] }, out)).toBe(true);
    expect(out.grade).toBeCloseTo(0.3, 9);
    expect(out.dof).toBeCloseTo(0.9, 9);
    expect(t.last.map((r) => r.target).sort()).toEqual(['DepthOfField.Composite', 'canvas']);
    expect(t.collect(null, out)).toBe(false);
  });
});
