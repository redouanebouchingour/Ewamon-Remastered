/**
 * The fixed light layout (handover; SPEC §10.3.2 as amended 2026-10-06, render IMPLEMENTATION-NOTES "Handover: fixed
 * light layout"). three 0.186 keys every lit render object by the scene's lights node; with the stock `LightsNode`
 * that key holds every light's id, so a zone's own lights made every lit object a new node build and, with a
 * different count, new programs. With the layout (`createLightingLayout`: one looped uniform array for the non-shadow
 * lights; since 2026-10-25 no punctual light casts a shadow map), the key the boot compiles with is the key of every zone.
 */
import { describe, expect, it, vi } from 'vitest';
import { Group, LightsNode, Scene, SpotLight } from 'three/webgpu';
import type { Light, Object3D } from 'three/webgpu';
import type { ZoneId } from '@ewa/content';
import { LIGHT_LAYOUT, LightRig, createLightingLayout } from '../src/lighting/rig.js';
import type { LayoutLightsNode } from '../src/lighting/layout.js';
import { LOCAL_LIGHT_VEC4, isLocalLight } from '../src/lighting/layout.js';
import { countPunctualLights } from '../src/stats.js';
import { realSpec } from './zone-helpers.js';

/** The lights a render of `scene` sees (RenderList: visible lights in a visible chain). */
function sceneLights(scene: Object3D): Light[] {
  const out: Light[] = [];
  scene.traverseVisible((o) => { if ((o as Light).isLight === true) out.push(o as Light); });
  return out;
}

/** The arena's two reserved beacons (battleStage.ts), in the scene from boot (no shadow map since 2026-10-25). */
function beacons(scene: Scene): void {
  for (let i = 0; i < 2; i++) {
    const b = new SpotLight(0xffffff, 0);
    scene.add(b, b.target);
  }
}

const ZONES: readonly ZoneId[] = ['mirevale', 'mire_route', 'cinderhold', 'ash_route', 'saltmourn', 'the_rift'];

describe('fixed light layout (handover)', () => {
  it('every zone renders with the boot light key; the stock LightsNode key changes per zone (the cause)', () => {
    const scene = new Scene();
    const rig = new LightRig(scene);
    beacons(scene);
    const layout = createLightingLayout().getNode(scene) as LightsNode;
    const keyOf = (node: LightsNode): number => node.setLights(sceneLights(scene)).customCacheKey();
    const stockKey = (): number => keyOf(new LightsNode());
    const boot = keyOf(layout);
    const bootStock = stockKey();
    const stockKeys = new Set<number>([bootStock]);
    for (const id of ZONES) {
      const spec = realSpec(id);
      const root = new Group();
      scene.add(root);
      const h = rig.createPunctuals(spec.lights, root);
      expect(h.length).toBe(spec.lights.length);
      expect(keyOf(layout)).toBe(boot);
      stockKeys.add(stockKey());
      rig.releasePunctuals(h);
      root.removeFromParent();
      expect(keyOf(layout)).toBe(boot);
    }
    expect(stockKeys.size).toBe(ZONES.length + 1);   // without the layout each zone was a new light set
    rig.dispose();
  });

  it('no punctual light casts a shadow map: the lit programs carry only the sun\'s shadow (amended 2026-10-25)', () => {
    const scene = new Scene();
    const rig = new LightRig(scene);
    beacons(scene);
    expect(sceneLights(scene).filter((l) => l.castShadow).map((l) => l.name)).toEqual(['ewa:sun']);
    const spec = realSpec('mirevale');
    expect(spec.lights.some((l) => l.castShadow)).toBe(true);    // mirevale's plaza lantern was a shadow-map caster
    const h = rig.createPunctuals(spec.lights, (() => { const g = new Group(); scene.add(g); return g; })());
    for (const x of h) {
      expect(x.light.castShadow).toBe(false);
      expect(isLocalLight(x.light)).toBe(true);
      expect(x.light.position.toArray()).toEqual([...x.source.position]);
    }
    expect(countPunctualLights(scene, { shadow: 0, nonShadow: 0 })).toEqual({ shadow: 0, nonShadow: spec.lights.length + 2 });
    const layout = createLightingLayout().getNode(scene) as LayoutLightsNode;
    layout.setLights(sceneLights(scene));
    expect(layout.local.count).toBe(spec.lights.length + 2);     // the zone's lights and the beacons, all in the loop
    expect(layout.local.count).toBeLessThanOrEqual(LIGHT_LAYOUT.maxLocalLights);
    rig.releasePunctuals(h);
    rig.dispose();
  });
});

describe('the local-light loop (layout.ts)', () => {
  it('loops over exactly the non-shadow point / spot lights; writes view-space rows like three\'s own light nodes', async () => {
    const { PerspectiveCamera, PointLight, Scene: S } = await import('three/webgpu');
    const scene = new S();
    const spot = new SpotLight(0xff8800, 12, 9, 0.87, 0.5, 2);
    spot.position.set(1, 3, 2); spot.target.position.set(1, 2, 2);
    const point = new PointLight(0x3366ff, 5, 7, 2);
    point.position.set(-2, 1, 0);
    const shadow = new SpotLight(); shadow.castShadow = true;
    scene.add(spot, spot.target, point, shadow);
    scene.updateMatrixWorld(true);
    expect([spot, point, shadow].map(isLocalLight)).toEqual([true, true, false]);
    const node = createLightingLayout().getNode(scene) as LayoutLightsNode;
    node.setLights([spot, point, shadow]);
    expect(node.local.count).toBe(2);
    const camera = new PerspectiveCamera();
    camera.position.set(0, 5, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    node.local.update({ camera } as never);
    const rows = (node.local as unknown as { rows: { x: number; y: number; z: number; w: number }[] }).rows;
    const view = spot.position.clone().applyMatrix4(camera.matrixWorldInverse);
    expect(rows[0]!.x).toBeCloseTo(view.x, 9); expect(rows[0]!.z).toBeCloseTo(view.z, 9); expect(rows[0]!.w).toBe(9);
    expect(rows[1]!.w).toBe(2);
    expect(rows[2]!.x).toBeCloseTo(spot.color.r * 12, 9);
    expect(rows[2]!.w).toBeCloseTo(Math.cos(0.87), 12);
    expect(rows[3]!.x).toBeCloseTo(Math.cos(0.87 * 0.5), 12);
    expect(rows[LOCAL_LIGHT_VEC4 + 2]!.w).toBe(-2);                          // a point light: cone factor exactly 1
    expect(rows[LOCAL_LIGHT_VEC4 + 3]!.x).toBe(-1);
    expect(rows[LOCAL_LIGHT_VEC4]!.w).toBe(7);
    // adding / removing a local light keeps the key; a shadow-casting light's id is in it
    const k0 = node.customCacheKey();
    node.setLights([spot, shadow]);
    expect(node.customCacheKey()).toBe(k0);
    const other = new SpotLight(); other.castShadow = true;
    node.setLights([spot, point, other]);
    expect(node.customCacheKey()).not.toBe(k0);
  });

  it('packs only the lights that reach the view: dark lamps and lamps whose range is off-screen cost no loop iteration', async () => {
    const { PerspectiveCamera, PointLight } = await import('three/webgpu');
    const lamp = (x: number, z: number, intensity: number, range = 6): InstanceType<typeof PointLight> => {
      const p = new PointLight(0xffcc88, intensity, range, 2);
      p.position.set(x, 2, z);
      p.updateMatrixWorld(true);
      return p;
    };
    const near = lamp(1, 0, 8);
    const dark = lamp(-1, 0, 0);                  // a lamp by day (§10.3.5 multiplier 0)
    const behind = lamp(0, 60, 8);                // 50 m behind the camera, 6 m range
    const edge = lamp(14, 0, 8, 12);              // centre off-screen, range reaches into the view
    const endless = lamp(0, 80, 8, 0);            // no cutoff: always looped
    const node = createLightingLayout().getNode(new Scene()) as LayoutLightsNode;
    node.setLights([near, dark, behind, edge, endless]);
    const camera = new PerspectiveCamera(30, 16 / 9, 0.5, 400);
    camera.position.set(0, 8, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    node.local.update({ camera } as never);
    expect(node.local.count).toBe(5);
    expect(node.local.packedCount).toBe(3);
    const rows = (node.local as unknown as { rows: { x: number; y: number; z: number; w: number }[] }).rows;
    expect([0, 1, 2].map((i) => rows[i * LOCAL_LIGHT_VEC4]!.w)).toEqual([6, 12, 0]);   // near, edge, endless: in order
    near.intensity = 0; edge.intensity = 0;
    node.local.update({ camera } as never);
    expect(node.local.packedCount).toBe(1);
  });
});

describe('handover (b): ZoneSystem.prepare builds the next zone off the scene', () => {
  it('no root in the scene and no light until adopted; the current zone keeps its sets when a prepared zone is dropped', async () => {
    const { ZoneSystem } = await import('../src/zone/system.js');
    const { zoneSurfaces } = await import('../src/zone/builder.js');
    const { mockLibrary } = await import('./zone-helpers.js');
    const { createRenderStats } = await import('../src/stats.js');
    const lib = await mockLibrary();
    const scene = new Scene();
    const rig = new LightRig(scene);
    const palettes: unknown[] = [];
    const ctx = {
      materials: lib, lighting: rig, scene, statsRecord: createRenderStats(), gpu: {},
      setLightingPalette: (p: unknown) => { palettes.push(p); }, setGrade: () => undefined,
    } as unknown as ConstructorParameters<typeof ZoneSystem>[0];
    const sys = new ZoneSystem(ctx);
    const a = realSpec('mirevale');
    const b = realSpec('mire_route');
    const ha = await sys.load(a);
    expect(rig.counts().shadow + rig.counts().nonShadow).toBe(a.lights.length);
    const countsA = rig.counts();

    const evict = vi.spyOn(lib, 'evictExcept');
    const pz = await sys.prepare(b);
    expect(pz.handle.group.parent).toBeNull();                       // off the scene
    expect(rig.counts()).toEqual(countsA);                           // its lights wait for the adoption
    expect(sys.zone()).toBe(ha);
    pz.drop();                                                       // dropped while mirevale is current
    expect(evict).toHaveBeenCalledTimes(1);
    const kept = new Set(evict.mock.calls[0]![0]);
    for (const s of zoneSurfaces(a)) expect(kept.has(s)).toBe(true);
    pz.drop();                                                       // idempotent
    expect(evict).toHaveBeenCalledTimes(1);

    const pz2 = await sys.prepare(b);
    ha.dispose();                                                    // the crossing: the current zone goes first …
    const keptOnDispose = new Set(evict.mock.calls[1]![0]);
    for (const s of zoneSurfaces(b)) expect(keptOnDispose.has(s)).toBe(true);   // … keeping the prepared zone's sets
    expect(rig.counts()).toEqual({ shadow: 0, nonShadow: 0 });
    const hb = pz2.adopt();
    expect(hb.group.parent).toBe(scene);
    expect(sys.zone()).toBe(hb);
    expect(rig.counts().shadow + rig.counts().nonShadow).toBe(b.lights.length);
    expect(palettes.length).toBe(2);
    expect(() => pz2.adopt()).toThrow();
    pz2.drop();                                                      // adopted: drop is a no-op
    expect(hb.disposed).toBe(false);
    hb.dispose();
    expect(rig.counts()).toEqual({ shadow: 0, nonShadow: 0 });
    rig.dispose(); lib.disposeAll();
  }, 120_000);
});
