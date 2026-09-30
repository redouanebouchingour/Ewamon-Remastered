/**
 * IMPLEMENTATION-NOTES Part 5: T4 (which zone units the first view needs — phase 1 — and which compile in the
 * background), the occluder fade's graph + uniforms (M2-spawn-noon-9) and the battle plates' type badges (M2-battle-7).
 */
import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, InstancedMesh, LOD, Material, Mesh, PerspectiveCamera, PointLight, Texture, Vector3 } from 'three/webgpu';
import { COMPILE_PLAN, orderUnits, planZoneCompile } from '../src/compilePlan.js';
import { orbitPosition } from '../src/camera/battle.js';
import { DISTANCE, PITCH, headingYaw } from '../src/camera/rig.js';
import { OCCLUSION, createOcclusionUniforms, setOcclusion } from '../src/materials/occlusion.js';
import { createMaterialLibraryWith } from '../src/materials/library.js';
import { SURFACES } from '../src/materials/surfaces.js';
import { CanvasHudLayer, type HudSurface } from '../src/hud/layer.js';

function box(x: number, z: number, s = 2): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([x - s, 0, z - s, x + s, 0, z - s, x, s, z + s]), 3));
  return g;
}

function viewAt(fx: number, fz: number): { camera: PerspectiveCamera; focus: Vector3 } {
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  const focus = new Vector3(fx, 0, fz);
  orbitPosition({ center: focus, yaw: headingYaw(0), pitch: (PITCH * Math.PI) / 180, distance: DISTANCE[1] }, cam.position);
  cam.lookAt(focus);
  cam.updateMatrixWorld();
  return { camera: cam, focus };
}

describe('T4 two-phase compile plan', () => {
  it('phase 1 = what the predicted first view draws (+ the surroundings); the rest is background', () => {
    const m1 = new Material(); const m2 = new Material();
    const root = new Group();
    const near = new Mesh(box(2, 2), m1); near.name = 'ewa:terrain:0,0';
    const behind = new Mesh(box(0, 25), m2); behind.name = 'ewa:terrain:0,1';            // behind the camera, within no radius
    const around = new Mesh(box(-20, 0), m2); around.name = 'ewa:props:3:c:lod0';        // outside the view, inside surround? (20 m)
    const lod2 = new Mesh(box(1, 1), m1); lod2.name = 'ewa:props:3:c:lod2';
    const far = new Mesh(box(150, 150), m2); far.name = 'ewa:water:0';
    const tier0 = new InstancedMesh(box(0, 0, 0.3), m1, 4); tier0.userData = { ewaScatterKind: 'tall_grass', ewaScatterTier: 0 };
    const tier2 = new InstancedMesh(box(0, 0, 0.3), m1, 4); tier2.userData = { ewaScatterKind: 'tall_grass', ewaScatterTier: 2 };
    const house = new LOD(); house.position.set(4, 0, -6);
    const l0 = new Mesh(box(0, 0), m1); const l1 = new Mesh(box(0, 0), m1); const l2 = new Mesh(box(0, 0), m1);
    house.addLevel(l0, 0); house.addLevel(l1, 40); house.addLevel(l2, 90);
    const light = new PointLight();
    root.add(near, behind, around, lod2, far, tier0, tier2, house, light);
    const units = planZoneCompile(root, viewAt(0, 0));
    const of = (o: object) => units.find((u) => u.object === o)!;
    expect(units.some((u) => u.object === light)).toBe(false);            // lights stay in place, never a unit
    expect(of(near).near).toBe(true);
    expect(of(around).near).toBe(true);                                    // within the surroundings (heading turns)
    expect(of(lod2).near).toBe(false);                                     // chunk tier 2 is drawn ≥ 90 m from the camera
    expect(of(far).near).toBe(false);
    expect(of(tier0).near).toBe(true);
    expect(of(tier2).near).toBe(false);
    expect(of(l0).near).toBe(true);                                        // the level the view picks
    expect(of(l2).near).toBe(false);
    expect(of(behind).distance).toBeGreaterThan(0);
    expect(COMPILE_PLAN.nearScatterTier).toBe(1);
    // no view → everything is phase 1 (the Part 4 single-phase compile)
    expect(planZoneCompile(root, null).every((u) => u.near)).toBe(true);
    // queue order: a unit with a new material set first (it carries a pipeline nothing else compiles)
    const order = orderUnits(units.filter((u) => u.near));
    expect(new Set(order.slice(0, 2).map((u) => u.key)).size).toBe(2);
  });
});

describe('M2-spawn-noon-9 occluder fade', () => {
  it('library materials above the ground carry the mask; triplanar ground layers and water do not', async () => {
    const lib = createMaterialLibraryWith({ baseUrl: '/m/', source: { load: async () => new Texture() }, fetchJson: async () => { throw new Error('none'); } });
    await lib.ready;
    const ids = Object.keys(SURFACES) as (keyof typeof SURFACES)[];
    const card = ids.find((id) => SURFACES[id].cls === 'card')!;
    const solid = ids.find((id) => SURFACES[id].cls === 'standard' && !SURFACES[id].triplanar)!;
    const ground = ids.find((id) => SURFACES[id].triplanar)!;
    const water = ids.find((id) => SURFACES[id].cls === 'water')!;
    const mask = (id: keyof typeof SURFACES) => (lib.get(id) as unknown as { maskNode: unknown }).maskNode;
    expect(mask(card)).not.toBeNull();
    expect(mask(solid)).not.toBeNull();
    expect(mask(ground)).toBeNull();
    expect(mask(water)).toBeNull();
    lib.disposeAll();
  });

  it('the segment ends at the chest, the player\'s own metre is kept, and only the scene camera applies it', () => {
    const o = createOcclusionUniforms();
    const cam = new PerspectiveCamera(); const shadowCam = new PerspectiveCamera();
    o.camera = cam;
    setOcclusion(o, new Vector3(0, 20, 16), new Vector3(0, 0, 0), 1);
    expect(o.to.value.y).toBeCloseTo(OCCLUSION.chestM, 9);
    const len = new Vector3(0, 20, 16).distanceTo(new Vector3(0, OCCLUSION.chestM, 0));
    expect(o.tCut.value).toBeCloseTo(1 - OCCLUSION.clearM / len, 9);
    expect(o.strength.value).toBe(1);
    const pass = o.pass as unknown as { update(f: { camera: unknown }): void; value: number };
    pass.update({ camera: cam }); expect(pass.value).toBe(1);
    pass.update({ camera: shadowCam }); expect(pass.value).toBe(0);         // shadow maps keep the full occluder
    setOcclusion(o, new Vector3(0, 20, 16), new Vector3(0, 0, 0), Number.NaN);
    expect(o.strength.value).toBe(0);
    expect(OCCLUSION.keep).toBeLessThanOrEqual(0.2);                        // the audit's "≤ 20 % coverage"
  });
});

describe('M2-battle-7 type badges on the battle plates', () => {
  it('each bar draws its types as 3-letter badges (≥ 14 px text) in the type colour table', () => {
    const texts: { t: string; font: string }[] = [];
    let font = '';
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 8 }) : k === 'fillText' ? (s: string) => texts.push({ t: s, font }) : k === 'font' ? font : () => undefined),
      set: (_t, k, v) => { if (k === 'font') font = String(v); return true; },
    }) as never;
    const surface = (w: number, h: number): HudSurface => ({ canvas: { width: w, height: h }, ctx });
    const hud = new CanvasHudLayer({ surface, anchors: { nameplate: () => false, battler: (_r, out, o) => { out[o] = 600; out[o + 1] = 400; return true; } } });
    hud.resize(1440, 900, 1);
    hud.set({ battle: { bars: [{ who: { side: 1, slot: 0 }, name: 'Mossling', level: 2, hp: 9, maxHp: 12, status: null, stages: '', showNumbers: false, types: ['Grass', 'Poison'] }], turnLabel: '', shakes: 0 } });
    hud.tick(16);
    hud.drawIfDirty();
    const badges = texts.filter((x) => x.t === 'GRA' || x.t === 'POI');
    expect(badges.map((b) => b.t)).toEqual(['GRA', 'POI']);
    for (const b of badges) expect(Number(/(\d+)px/.exec(b.font)![1])).toBeGreaterThanOrEqual(14);
  });
});
