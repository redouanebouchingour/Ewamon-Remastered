/**
 * The PvP arena backdrop (stage/arenaBackdrop.ts), node / no GPU: it builds, keeps the floor inside the parapet flat and
 * empty for the stage, never crosses the battle camera's view of the battlers at any heading / cue / framing distance,
 * stays inside its draw budget, and `dispose` releases every geometry and material it made.
 */
import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three/webgpu';
import type { BufferGeometry, InstancedMesh, Material, Mesh, Object3D } from 'three/webgpu';
import {
  ARENA_BACKDROP, ARENA_CAMERA_MAX_DISTANCE, createArenaBackdrop, crowdSeats, tierFront, tierY,
} from '../src/stage/arenaBackdrop.js';
import { BATTLE_DISTANCE, BATTLE_PITCH, BATTLE_YAW_OFFSET, CAMERA_WORK, battlerSlot, orbitPosition, trainerSlot } from '../src/camera/battle.js';
import { STAGE } from '../src/stage/battleStage.js';
import { currentZoneRoot } from '../src/renderer.js';
import type { ZoneHandle } from '../src/contracts.js';

const DEG = Math.PI / 180;

function drawables(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => { if ((o as Mesh).isMesh) out.push(o as Mesh); });
  return out;
}

/** Every world-space point of the static meshes (instances excluded). */
function staticPoints(root: Object3D, fn: (x: number, y: number, z: number) => void): void {
  for (const m of drawables(root)) {
    if ((m as InstancedMesh).isInstancedMesh) continue;
    const p = m.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) fn(p.getX(i), p.getY(i), p.getZ(i));
  }
}

/**
 * The bowl as a radial envelope (it is rotationally symmetric apart from the masts and screens far outside the camera):
 * per 0.25 m radius bin, the highest solid point below the canopy (crowd heads at the top of the wave included) and the
 * lowest point of anything above (the canopy's underside).
 */
function envelope(root: Object3D): { floor: (r: number) => number; ceiling: (r: number) => number } {
  const BIN = 0.25; const N = Math.ceil(120 / BIN);
  const lo = new Float64Array(N).fill(-Infinity); const hi = new Float64Array(N).fill(Infinity);
  const ceilingFrom = ARENA_BACKDROP.backWallTop - 0.5;
  const add = (r: number, y: number): void => {
    const b = Math.min(N - 1, Math.floor(r / BIN));
    if (y < ceilingFrom) lo[b] = Math.max(lo[b]!, y); else hi[b] = Math.min(hi[b]!, y);
  };
  staticPoints(root, (x, y, z) => add(Math.hypot(x, z), y));
  const seats = crowdSeats();
  const top = ARENA_BACKDROP.figureHeight * 1.06 + ARENA_BACKDROP.waveLift + ARENA_BACKDROP.bobLift;   // largest instance scale
  for (let i = 0; i < seats.length; i += 4) {
    const r = Math.hypot(seats[i]!, seats[i + 2]!);
    for (const dr of [-0.2, 0, 0.2]) add(r + dr, seats[i + 1]! + top);    // head and torso depth either side of the seat
  }
  const at = (a: Float64Array, r: number, pick: (u: number, v: number) => number): number => {
    const b = Math.floor(r / BIN);
    return pick(a[Math.max(0, b - 1)]!, pick(a[b]!, a[Math.min(N - 1, b + 1)]!));
  };
  return { floor: (r) => at(lo, r, Math.max), ceiling: (r) => at(hi, r, Math.min) };
}

describe('arena backdrop', () => {
  it('builds without a GPU: 5 meshes (one instanced crowd), node materials, a bounded triangle count', () => {
    const b = createArenaBackdrop();
    const meshes = drawables(b.root);
    expect(meshes.length).toBeLessThanOrEqual(6);
    const crowd = meshes.filter((m) => (m as InstancedMesh).isInstancedMesh) as InstancedMesh[];
    expect(crowd).toHaveLength(1);
    expect(crowd[0]!.count).toBeGreaterThan(1500);
    expect(crowd[0]!.count).toBeLessThan(3000);
    expect(crowd[0]!.castShadow).toBe(false);
    let tris = 0;
    for (const m of meshes) {
      const n = m.geometry.getAttribute('position').count / 3;
      tris += (m as InstancedMesh).isInstancedMesh ? n * (m as InstancedMesh).count : n;
      expect((m.material as Material & { isNodeMaterial?: boolean }).isNodeMaterial).toBe(true);
    }
    expect(tris).toBeLessThan(200_000);
    // the only shadow caster is the structure (one mesh × the sun's cascades)
    expect(meshes.filter((m) => m.castShadow)).toHaveLength(1);
    // no punctual lights: the arena's light is the stage's beacons + emissive strips
    let lights = 0;
    b.root.traverse((o) => { if ((o as { isLight?: boolean }).isLight) lights++; });
    expect(lights).toBe(0);
    b.dispose();
  });

  it('the floor inside the parapet is flat and empty for the stage (ring, pylons, trainers, spectators)', () => {
    const b = createArenaBackdrop();
    const A = ARENA_BACKDROP;
    let bad = 0; let minR = Infinity;
    staticPoints(b.root, (x, y, z) => {
      const r = Math.hypot(x, z);
      minR = Math.min(minR, r);
      if (r < A.clearRadius - 0.01 && y > 0.02) bad++;
    });
    expect(bad).toBe(0);
    expect(minR).toBeGreaterThanOrEqual(STAGE.ringRadius);     // nothing under the ring top
    // the stage's furthest dressing stands inside the clear disc: spectators (5.9 m + 0.45), pylons, trainers
    expect(STAGE.spectatorRadius + STAGE.spectatorR).toBeLessThan(A.clearRadius);
    expect(STAGE.beaconRadius + STAGE.pylonR).toBeLessThan(A.clearRadius);
    const t = trainerSlot(0, 0, 0, -1, 0, [0, 0]);
    expect(Math.hypot(t[0], t[1]) + STAGE.trainerR).toBeLessThan(A.clearRadius);
    // and the crowd sits on the tiers, behind the parapet
    const seats = crowdSeats();
    for (let i = 0; i < seats.length; i += 4) expect(Math.hypot(seats[i]!, seats[i + 2]!)).toBeGreaterThan(A.clearRadius + A.parapetDepth);
    b.dispose();
  });

  it('never crosses the battle camera → battler corridor (any heading, every cue orbit, push-in to the widest framing)', () => {
    const b = createArenaBackdrop();
    const env = envelope(b.root);
    const center = new Vector3(0, 0, 0);
    const pose = { center, yaw: 0, pitch: BATTLE_PITCH * DEG, distance: 0 };
    const cam = new Vector3(); const feet = new Vector3(); const p = new Vector3();
    const orbits = [0, ...Object.values(CAMERA_WORK).map((w) => w.orbit?.deg ?? 0)];
    const pushes = Object.values(CAMERA_WORK).map((w) => w.push?.distance ?? 0);
    const distances = [BATTLE_DISTANCE - Math.max(...pushes), BATTLE_DISTANCE, 15, 18, ARENA_CAMERA_MAX_DISTANCE];
    expect(ARENA_CAMERA_MAX_DISTANCE).toBe(25);
    let worstBelow = Infinity; let worstAbove = Infinity; let clearBelow = Infinity; let clearAbove = Infinity; let checks = 0;
    for (let yd = 0; yd < 360; yd += 15) {
      const yaw = yd * DEG;
      for (const orbit of orbits) {
        pose.yaw = yaw + (BATTLE_YAW_OFFSET + orbit) * DEG;
        for (const d of distances) {
          pose.distance = d;
          orbitPosition(pose, cam);
          // the camera itself: clear of the crowd below and the canopy above by more than its near plane (0.5 m)
          const rc = Math.hypot(cam.x, cam.z);
          worstBelow = Math.min(worstBelow, cam.y - env.floor(rc));
          worstAbove = Math.min(worstAbove, env.ceiling(rc) - cam.y);
          // singles and doubles slots, feet and the top of a 3 m creature
          for (const count of [1, 2]) {
            for (const side of [0, 1] as const) {
              for (let slot = 0; slot < count; slot++) {
                battlerSlot(center, yaw, side, slot, count, feet);
                for (const h of [0, 3]) {
                  for (let k = 0; k <= 40; k++) {
                    p.copy(cam).lerp(feet.set(feet.x, h, feet.z), k / 40);
                    const r = Math.hypot(p.x, p.z);
                    if (r < ARENA_BACKDROP.clearRadius) continue;          // the stage's own floor
                    clearBelow = Math.min(clearBelow, p.y - env.floor(r));
                    clearAbove = Math.min(clearAbove, env.ceiling(r) - p.y);
                    checks++;
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(checks).toBeGreaterThan(1000);
    expect(clearBelow).toBeGreaterThan(0.3);     // over the crowd at the top of the wave
    expect(clearAbove).toBeGreaterThan(0.3);     // under the canopy
    expect(worstBelow).toBeGreaterThan(1.0);
    expect(worstAbove).toBeGreaterThan(0.6);
    b.dispose();
  });

  it('the tiers follow the camera cone: the crowd stays `cameraClearM` below every camera position over it', () => {
    const A = ARENA_BACKDROP;
    const slope = Math.tan(-BATTLE_PITCH * DEG);
    expect(A.tierRise / A.tierDepth).toBeCloseTo(slope, 6);
    for (let i = 0; i < A.tierCount; i++) {
      const rBack = tierFront(i) + A.tierDepth;
      const head = tierY(i) + A.benchHeight - 0.42 + A.figureHeight;
      expect(slope * tierFront(i) - head).toBeGreaterThanOrEqual(A.cameraClearM - 0.05);
      expect(rBack).toBeLessThan(A.outerRadius);
    }
    // the farthest camera sits inside the bowl's back wall
    const rCam = ARENA_CAMERA_MAX_DISTANCE * Math.cos(-BATTLE_PITCH * DEG);
    expect(tierFront(A.tierCount) + A.concourseDepth).toBeGreaterThan(rCam + 1.5);
  });

  it('dispose releases every geometry and material once, detaches the root, and is idempotent', () => {
    const parent = new Group();
    const b = createArenaBackdrop();
    parent.add(b.root);
    const geos = new Set<BufferGeometry>(); const mats = new Set<Material>();
    for (const m of drawables(b.root)) { geos.add(m.geometry); mats.add(m.material as Material); }
    const disposed = new Map<object, number>();
    const listen = (o: BufferGeometry | Material): void => { o.addEventListener('dispose', () => disposed.set(o, (disposed.get(o) ?? 0) + 1)); };
    geos.forEach(listen); mats.forEach(listen);
    let instDisposed = 0;
    const crowd = drawables(b.root).find((m) => (m as InstancedMesh).isInstancedMesh)!;
    crowd.addEventListener('dispose', () => instDisposed++);
    b.update(0.016);
    b.dispose();
    b.dispose();
    expect(b.root.parent).toBeNull();
    expect(geos.size).toBe(5);
    expect(mats.size).toBe(5);
    for (const g of geos) expect(disposed.get(g)).toBe(1);
    for (const m of mats) expect(disposed.get(m)).toBe(1);
    expect(instDisposed).toBe(1);
    expect(() => b.update(0.016)).not.toThrow();
  });

  it('registered as the zone root while no zone is loaded: a disposed zone handle no longer shadows it', () => {
    const scene = new Group();
    const zoneGroup = new Group(); scene.add(zoneGroup);
    const zone = { group: zoneGroup } as unknown as ZoneHandle;
    const b = createArenaBackdrop();
    expect(currentZoneRoot(zone, null)).toBe(zoneGroup);                  // a loaded zone wins
    expect(currentZoneRoot(zone, b.root as Group)).toBe(zoneGroup);
    zoneGroup.removeFromParent();                                         // unloaded (its handle lingers until the next load)
    scene.add(b.root);
    expect(currentZoneRoot(zone, b.root as Group)).toBe(b.root);
    (zone as unknown as { disposed: boolean }).disposed = true; scene.add(zoneGroup);
    expect(currentZoneRoot(zone, b.root as Group)).toBe(b.root);
    expect(currentZoneRoot(null, b.root as Group)).toBe(b.root);
    expect(currentZoneRoot(zone, null)).toBeNull();
    b.dispose();
  });
});
