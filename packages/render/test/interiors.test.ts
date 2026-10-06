/**
 * Phase A interiors (node, no GPU): every pocket of every town builds its hall (4 outer walls, internal solids, gates,
 * switches), the live controls change only transforms / visibility (no geometry or material churn), no scatter
 * instance stands inside a pocket footprint, a battle dressed at a hall arena stays on the floor, and the rig's yaw
 * base drives `dioramaYaw`.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Group, Mesh, PerspectiveCamera, Scene, Texture, Vector3 } from 'three/webgpu';
import type { BufferGeometry, Material, Object3D } from 'three/webgpu';
import { ZONES, type ZoneId } from '@ewa/content';
import type { HallBounds, InteriorSpec } from '../src/contracts.js';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { DioramaRig, YAW_BASE, headingYaw, HEADING_TURN_MS } from '../src/camera/rig.js';
import { forwardOfYaw } from '../src/camera/battle.js';
import { BasicDioramaRig } from '../src/defaults.js';
import { createMaterialLibraryWith } from '../src/materials/library.js';
import { BillboardPool } from '../src/sprites/billboard.js';
import type { AtlasDecoder } from '../src/sprites/atlas.js';
import { VfxSystem } from '../src/stage/vfx.js';
import { CharacterPool } from '../src/stage/actors.js';
import { STAGE, Stage, inHall } from '../src/stage/battleStage.js';
import { LightRig } from '../src/lighting/rig.js';
import { buildZone, loadZone, zoneSurfaces } from '../src/zone/builder.js';
import { BIOME_GENERATORS } from '../src/zone/generators/index.js';
import { INTERIOR, buildInterior } from '../src/zone/generators/interiors.js';
import { paletteFor } from '../src/zone/palettes.js';
import { createSplatContext, layoutOf, splatAt } from '../src/zone/layout.js';
import { MockGpu, interiorSpecsFor, mockLibrary, realSpec } from './zone-helpers.js';

beforeAll(() => { const w = vi.spyOn(console, 'warn').mockImplementation(() => {}); return () => w.mockRestore(); });

const TOWNS = ZONES.filter((z) => z.kind === 'town').map((z) => z.id as ZoneId);

function byName(root: Object3D, name: string): Object3D | undefined {
  let hit: Object3D | undefined;
  root.traverse((o) => { if (hit === undefined && o.name === name) hit = o; });
  return hit;
}

/** Every mesh under `root` with its geometry and material refs (the "no churn" snapshot). */
function snapshot(root: Object3D): Map<Mesh, { geometry: BufferGeometry; materials: string }> {
  const out = new Map<Mesh, { geometry: BufferGeometry; materials: string }>();
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const mats: Material[] = Array.isArray(o.material) ? o.material : [o.material];
    out.set(o, { geometry: o.geometry, materials: mats.map((m) => m.uuid).join(',') });
  });
  return out;
}

function hallOf(sp: InteriorSpec, room: InteriorSpec['rooms'][number]): HallBounds {
  const c = Math.cos(sp.yaw); const s = Math.sin(sp.yaw);
  const { lx, lz } = room.bounds;
  return { x: sp.x + c * lx + s * lz, z: sp.z - s * lx + c * lz, yaw: sp.yaw, hw: room.bounds.hw, hd: room.bounds.hd };
}

function arenaOf(sp: InteriorSpec, room: InteriorSpec['rooms'][number]): { x: number; z: number } {
  const c = Math.cos(sp.yaw); const s = Math.sin(sp.yaw);
  return { x: sp.x + c * room.arena.lx + s * room.arena.lz, z: sp.z - s * room.arena.lx + c * room.arena.lz };
}

describe('Phase A: every pocket of every town builds', () => {
  it('a group per pocket with 4 outer walls, its internal solids, gates and switches; themes cover the 8 gyms + league + shop + healer + house', async () => {
    const lib = await mockLibrary();
    const themes = new Set<string>();
    let pockets = 0;
    for (const id of TOWNS) {
      const z = ZONES.find((q) => q.id === id)!;
      const set = BIOME_GENERATORS[z.biome];
      const palette = paletteFor(z.palette, z.biome);
      const specs = interiorSpecsFor(id);
      expect(specs.length, id).toBeGreaterThan(0);
      const spec = realSpec(id);
      await lib.preload(zoneSurfaces(spec));
      for (const sp of specs) {
        const geometries: BufferGeometry[] = []; const views: BufferGeometry[] = [];
        const b = buildInterior(sp, { zoneSet: set, palette, heightfield: spec.heightfield, material: (s) => lib.get(s), geometries, views });
        pockets++;
        themes.add(sp.theme);
        expect(b.root.name).toBe(`ewa:interior:${sp.id}`);
        expect(b.walls.map((w) => w.side).sort()).toEqual(['back', 'front', 'left', 'right']);
        for (const side of ['back', 'front', 'left', 'right']) expect(byName(b.root, `ewa:interior:${sp.id}:wall:${side}`), `${sp.id} ${side}`).toBeDefined();
        expect(b.innerWalls, sp.id).toBe(sp.walls.length);
        expect(b.gates.map((g) => g.id)).toEqual(sp.gates.map((g) => g.id));
        for (const g of sp.gates) expect(byName(b.hall, `ewa:interior:${sp.id}:gate:${g.id}`), g.id).toBeDefined();
        expect(b.switches.map((s) => s.id)).toEqual(sp.switches.map((s) => s.id));
        for (const s of b.switches) { expect(s.glow, s.id).not.toBeNull(); expect(s.glow!.visible).toBe(false); }
        expect(b.hall.visible).toBe(false);
        expect(b.canopy.visible).toBe(true);
        expect(b.canopyLod?.levels.length).toBe(3);
        expect(b.rim).not.toBeNull();
        // the gym halls carry their dressing (statues, pillars, banners, braziers …)
        if (sp.template === 'gym_hall') expect(b.props).toBeGreaterThan(8);
        // the outer walls' outward normals are unit and match the yaw
        for (const w of b.walls) expect(Math.hypot(w.nx, w.nz)).toBeCloseTo(1, 9);
        const front = b.walls.find((w) => w.side === 'front')!;
        expect(front.nx).toBeCloseTo(Math.sin(sp.yaw), 9); expect(front.nz).toBeCloseTo(Math.cos(sp.yaw), 9);
        // collider footprints: 4 outer walls + every solid internal wall
        expect(b.footprints.length).toBe(4 + sp.walls.filter((w) => w.style !== 'channel' && w.style !== 'chasm').length);
        for (const g of [...geometries, ...views]) g.dispose();
      }
    }
    expect(pockets).toBeGreaterThan(30);
    expect([...themes].sort()).toEqual(['cinder', 'forge', 'grove', 'healer', 'house', 'league', 'marrow', 'salt', 'shop', 'sky', 'storm', 'vesper']);
    lib.disposeAll();
  }, 120_000);
});

describe('Phase A: live controls (mirevale)', () => {
  it('setActive / setView / setGateOpen / setSwitchOn change only transforms and visibility — no geometry or material churn', async () => {
    const lib = await mockLibrary();
    const spec = realSpec('mirevale');
    await lib.preload(zoneSurfaces(spec));
    const h = buildZone(spec, { materials: lib, lighting: null, scene: null });
    const sys = h.interiors!;
    expect(sys).toBeDefined();
    expect(sys.pockets.length).toBe(spec.interiors!.length);
    const before = snapshot(h.group);
    const childCount = (() => { let n = 0; h.group.traverse(() => { n++; }); return n; })();
    const gym = spec.interiors!.find((p) => p.template === 'gym_hall')!;
    const b = sys.pockets.find((p) => p.id === gym.id)!;

    // outside: every hall hidden, every canopy shown
    for (const p of sys.pockets) { expect(p.hall.visible).toBe(false); expect(p.canopy.visible).toBe(true); }
    sys.setActive(gym.id);
    for (const p of sys.pockets) { expect(p.hall.visible).toBe(p.id === gym.id); expect(p.canopy.visible).toBe(p.id !== gym.id); }

    // the camera looking down the hall axis from the door side: the front (+z) wall faces it and drops to the kerb
    sys.setView(gym.yaw);
    sys.settle();
    const kerb = INTERIOR.kerbH / INTERIOR.wallH;
    for (const w of b.walls) expect(w.object.scale.y, w.side).toBeCloseTo(w.side === 'front' ? kerb : 1, 9);
    // the default diagonal: two walls face the camera
    sys.setView(gym.yaw + (-35 * Math.PI) / 180);
    sys.settle();
    expect(b.walls.filter((w) => w.object.scale.y < 0.5).map((w) => w.side).sort()).toEqual(['front', 'left']);   // camera on local (sin −35°, cos −35°): −x and +z

    // gates: open moves them away (down or aside) and hides them; closing brings them back
    for (const g of b.gates) {
      const rest = g.object.position.clone();
      sys.setGateOpen(g.id, true);
      sys.settle();
      expect(g.object.position.distanceTo(rest), g.id).toBeGreaterThan(1.5);
      expect(g.object.visible).toBe(false);
      sys.setGateOpen(g.id, false);
      sys.settle();
      expect(g.object.position.distanceTo(rest)).toBeLessThan(1e-9);
      expect(g.object.visible).toBe(true);
    }
    // switches: glow on, the moving part at its "on" transform
    for (const s of b.switches) {
      const y0 = s.moving!.position.y;
      sys.setSwitchOn(s.id, true);
      sys.settle();
      expect(s.glow!.visible).toBe(true);
      expect(s.moving!.position.y).not.toBeCloseTo(y0, 6);
      expect(sys.switchState(s.id)).toBe(1);
    }
    sys.setGateOpen('nope', true); sys.setSwitchOn('nope', true); sys.setActive('nope');   // unknown ids are ignored
    expect(sys.active).toBeNull();
    sys.setActive(gym.id);
    // leaving: the walls of the pocket stand up again
    sys.setActive(null);
    for (const w of b.walls) expect(w.object.scale.y).toBe(1);

    const after = snapshot(h.group);
    expect(after.size).toBe(before.size);
    for (const [m, v] of before) {
      const a = after.get(m);
      expect(a, m.name).toBeDefined();
      expect(a!.geometry).toBe(v.geometry);
      expect(a!.materials).toBe(v.materials);
    }
    let n = 0; h.group.traverse(() => { n++; });
    expect(n).toBe(childCount);
    h.dispose();
    lib.disposeAll();
  }, 60_000);

  it('a hall shown, rendered and unloaded returns the mock GPU to baseline (no leak through the pockets)', async () => {
    const gpu = new MockGpu();
    const lib = await mockLibrary(gpu);
    const scene = new Scene();
    const rig = new LightRig(scene);
    gpu.render(scene);
    const base = gpu.memory();
    const spec = realSpec('mirevale');
    for (let i = 0; i < 2; i++) {
      const h = await loadZone(spec, { materials: lib, lighting: rig, scene });
      gpu.render(scene);
      for (const p of spec.interiors!) { h.interiors!.setActive(p.id); gpu.render(scene); }
      h.dispose();
      expect(gpu.memory()).toEqual(base);
    }
    rig.dispose(); lib.disposeAll();
  }, 120_000);
});

describe('Phase A: no scatter inside a pocket', () => {
  it.each(['mirevale', 'cinderhold', 'saltmourn'] as const)('%s: 0 scatter instances centred inside any pocket footprint; the floors are paved', async (id) => {
    const lib = await mockLibrary();
    const spec = realSpec(id);
    await lib.preload(zoneSurfaces(spec));
    const h = buildZone(spec, { materials: lib, lighting: null, scene: null });
    let total = 0; let inside = 0;
    for (const s of h.scatterInstances()) {
      const m = s.matrices;
      for (let i = 0; i < m.length; i += 16) {
        total++;
        const x = m[i + 12]!; const z = m[i + 14]!;
        if (spec.interiors!.some((p) => Math.abs(x - p.footprint.x) < p.footprint.hw && Math.abs(z - p.footprint.z) < p.footprint.hd)) inside++;
      }
    }
    expect(total).toBeGreaterThan(1000);
    expect(inside).toBe(0);
    // the splat paves every pocket floor (+ walls) with a crisp edge; the screen band outside is not paved
    const ctx = createSplatContext(layoutOf(spec), spec.buildings, spec.seed, spec.interiors);
    const f = { plaza: 0, path: 0, detail: 0 };
    for (const p of spec.interiors!) {
      const c = Math.cos(p.yaw); const sn = Math.sin(p.yaw);
      for (const [lx, lz] of [[0, 0], [p.w / 2 - 0.1, p.d / 2 - 0.1], [-p.w / 2 + 0.1, 0]] as const) {
        expect(splatAt(ctx, p.x + c * lx + sn * lz, p.z - sn * lx + c * lz, f).plaza, p.id).toBeGreaterThan(0);
      }
      const ox = p.w / 2 + 1.5;
      if (!spec.plan.plaza || Math.hypot(p.x + c * ox - spec.plan.plaza.x, p.z - sn * ox - spec.plan.plaza.z) > spec.plan.plaza.r + 1) {
        expect(splatAt(ctx, p.x + c * ox, p.z - sn * ox, f).plaza, p.id).toBeLessThan(0);
      }
    }
    h.dispose();
    lib.disposeAll();
  }, 60_000);
});

// ---- the battle stage in a hall ------------------------------------------------------------------------------------

async function makeStage() {
  const lib = createMaterialLibraryWith({ baseUrl: '/m/', source: { load: async () => new Texture() }, fetchJson: async () => { throw new Error('none'); } });
  await lib.ready;
  const scene = new Group();
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  const decoder: AtlasDecoder = { decode: async (_url, crop) => ({ width: crop ? crop[2] : 2048, height: crop ? crop[3] : 2048, close: () => {} }) };
  const sprites = new BillboardPool({ decoder, camera: cam });
  const vfx = new VfxSystem();
  const actors = new CharacterPool({ harvestLevel: lib.uniforms.harvestLevel, camera: cam, viewport: () => ({ w: 1280, h: 720 }) });
  scene.add(actors.root);
  const rig = new DioramaRig(cam, { effects: () => ALL_EFFECTS, feet: (aid, out) => actors.feetOf(aid, out) });
  const stage = new Stage({ parent: scene, sprites, vfx, rig, actors, materials: lib, effects: () => ALL_EFFECTS, harvestLevel: () => 0, camera: cam, viewport: () => ({ w: 1280, h: 720 }) });
  return { lib, stage, rig, actors };
}

const _w = new Vector3();

describe('Phase A: BattleStage.dress(…, hall)', () => {
  it('at every hall arena of every town (hall axis yaw, all 4 headings), ring, posts, pylons, spectators and both trainer slots stay on the floor', async () => {
    const { stage, rig, actors } = await makeStage();
    let checked = 0;
    for (const id of TOWNS) {
      for (const sp of interiorSpecsFor(id)) {
        for (const room of sp.rooms) {
          const hall = hallOf(sp, room);
          for (const k of [0, 1, 2, 3] as const) {
            rig.setYawBase((sp.yaw * 180) / Math.PI);
            rig.setHeading(k);
            rig.update(HEADING_TURN_MS + 10);
            stage.dress(arenaOf(sp, room), 'grove', ['p1', 'p2'], hall);
            const c = stage.arenaCenter;
            const m = STAGE.hallMarginM;
            // the ring + curb
            expect(inHall(hall, c.x, c.z, STAGE.curbOuter + m), `${sp.id}/${room.id} ring`).toBe(true);
            // both trainer slots
            for (const side of [0, 1] as const) {
              stage.trainerSpot(side, _w);
              expect(inHall(hall, _w.x, _w.z, STAGE.trainerR), `${sp.id}/${room.id} trainer ${side}`).toBe(true);
            }
            stage.arenaRoot.updateMatrixWorld(true);
            // visible posts and pylon bodies
            const posts = stage.arenaRoot.getObjectByName('ewa:arena-main:posts')!;
            for (const p of posts.children.slice(0, STAGE.postCount)) {
              if (!p.visible) continue;
              p.getWorldPosition(_w);
              expect(inHall(hall, _w.x, _w.z, 0.075), `${sp.id} post`).toBe(true);
            }
            const pylons = stage.arenaRoot.getObjectByName('ewa:arena-main:beacons')!;
            for (const p of pylons.children) {
              if (!p.visible) continue;
              p.getWorldPosition(_w);
              expect(inHall(hall, _w.x, _w.z, 0.26), `${sp.id} pylon`).toBe(true);
            }
            // spectators
            for (const sid of stage.spectatorIds) {
              expect(actors.feetOf(sid, _w)).not.toBeNull();
              expect(inHall(hall, _w.x, _w.z, 0.3), `${sp.id} spectator`).toBe(true);
            }
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(30);
    // the gym leader chamber (20 × 15) holds the whole dressing: nothing hidden, the centre unmoved, 6 spectators
    const gym = interiorSpecsFor('mirevale').find((p) => p.template === 'gym_hall')!;
    const room = gym.rooms[0]!;
    rig.setYawBase((gym.yaw * 180) / Math.PI); rig.setHeading(0); rig.update(HEADING_TURN_MS + 10);
    stage.dress(arenaOf(gym, room), 'grove', ['p1'], hallOf(gym, room));
    const at = arenaOf(gym, room);
    expect(stage.arenaCenter.x).toBeCloseTo(at.x, 6); expect(stage.arenaCenter.z).toBeCloseTo(at.z, 6);
    expect(stage.spectatorIds.length).toBe(6);
    // the battle axis runs along the hall: battlers face along local z
    forwardOfYaw(rig.dioramaYaw, _w);
    expect(Math.abs(_w.x * Math.sin(gym.yaw) + _w.z * Math.cos(gym.yaw))).toBeCloseTo(1, 6);
    stage.dispose();
  }, 60_000);

  it('a hall too small for the full dressing pulls the ring in and hides what cannot stand', async () => {
    const { stage, rig } = await makeStage();
    rig.update(0);
    const hall: HallBounds = { x: 0, z: 0, yaw: 0, hw: 4.6, hd: 6.5 };
    stage.dress({ x: 1.5, z: 3 }, 'grove', ['a'], hall);
    const c = stage.arenaCenter;
    expect(inHall(hall, c.x, c.z, STAGE.curbOuter)).toBe(true);
    const posts = stage.arenaRoot.getObjectByName('ewa:arena-main:posts')!;
    stage.arenaRoot.updateMatrixWorld(true);
    for (const p of posts.children.slice(0, STAGE.postCount)) if (p.visible) { p.getWorldPosition(_w); expect(inHall(hall, _w.x, _w.z, 0.075)).toBe(true); }
    // open ground afterwards: the full dressing again
    stage.dress({ x: 30, z: 30 }, 'grove', ['a']);
    expect(posts.children.every((p) => p.visible)).toBe(true);
    expect(posts.scale.x).toBe(1);
    stage.dispose();
  });
});

describe('Phase A: CameraRig.setYawBase', () => {
  it('DioramaRig: headings become base + 90°·k, dioramaYaw follows; null restores −35°', () => {
    const r = new DioramaRig(new PerspectiveCamera(28, 16 / 9, 0.5, 220), { effects: () => ALL_EFFECTS });
    r.update(0);
    expect(r.dioramaYaw).toBeCloseTo(headingYaw(0), 12);
    r.setYawBase(90);
    r.update(HEADING_TURN_MS + 10);
    expect(Math.cos(r.dioramaYaw - (90 * Math.PI) / 180)).toBeCloseTo(1, 9);
    expect(Math.cos(r.orbit.yaw - (90 * Math.PI) / 180)).toBeCloseTo(1, 9);
    r.setHeading(1);
    r.update(HEADING_TURN_MS + 10);
    expect(Math.cos(r.dioramaYaw - (180 * Math.PI) / 180)).toBeCloseTo(1, 9);
    r.setYawBase(null);
    r.update(HEADING_TURN_MS + 10);
    expect(Math.cos(r.dioramaYaw - headingYaw(1))).toBeCloseTo(1, 9);
    expect(r.yawBaseDeg).toBe(YAW_BASE);
  });

  it('BasicDioramaRig implements it too', () => {
    const r = new BasicDioramaRig(new PerspectiveCamera(28, 16 / 9, 0.5, 220), () => ALL_EFFECTS);
    expect(r.dioramaYaw).toBeCloseTo(headingYaw(0), 12);
    r.setYawBase(0);
    expect(r.dioramaYaw).toBeCloseTo(0, 12);
    r.setYawBase(null);
    expect(r.dioramaYaw).toBeCloseTo(headingYaw(0), 12);
  });
});
