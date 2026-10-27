/**
 * Phase D6 doubles on the battle stage (node, no GPU): four billboards — two per side, render `BattlerRef.slot` = the
 * field position — stand at distinct points, mirrored per side, on the ring top with their foot disc inside the ring;
 * in a narrow hall the fitted centre keeps all four foot discs on the floor; singles placement is unchanged (one
 * battler per side on the centre line). VFX resolve both positions of both sides.
 */
import { describe, expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Texture, Vector3 } from 'three/webgpu';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { createMaterialLibraryWith } from '../src/materials/library.js';
import { DioramaRig, headingYaw } from '../src/camera/rig.js';
import { BATTLER_SEPARATION, SLOT_SPACING, battlerSlot } from '../src/camera/battle.js';
import { BillboardPool } from '../src/sprites/billboard.js';
import type { AtlasDecoder, AtlasSet } from '../src/sprites/atlas.js';
import { VfxSystem } from '../src/stage/vfx.js';
import { CharacterPool } from '../src/stage/actors.js';
import { STAGE, Stage, fitCentre, inHall } from '../src/stage/battleStage.js';
import type { BattlerRef, HallBounds, SpriteDescriptor } from '../src/contracts.js';

const REFS: readonly BattlerRef[] = [{ side: 0, slot: 0 }, { side: 0, slot: 1 }, { side: 1, slot: 0 }, { side: 1, slot: 1 }];

function fakeDecoder(): AtlasDecoder {
  return { decode: async (_url, crop) => ({ width: crop ? crop[2] : 2048, height: crop ? crop[3] : 2048, close: () => {} }) };
}
function fakeSet(id: string): AtlasSet {
  const m = (k: string) => ({ url: `/c/${id}.${k}.webp`, mips: ['1', '2', '3'].map((i) => `/c/${id}.${k}.m${i}.webp`) });
  return { id, albedo: m('albedo'), normal: m('normal'), emissive: m('emissive'), size: 2048, normalScale: 0.5 };
}
function desc(id: string): SpriteDescriptor {
  const f = (x: number) => ({ atlas: 'a-001', rect: [x, 0.5, x + 0.5, 1] as const, px: [x * 2048, 0, 1024, 1024] as const, footV: 0.08, aspect: 1 });
  return { id, front: f(0.5), back: f(0), heightM: 1.376, types: ['Grass'], variant: 'normal', isAlpha: false };
}

async function makeStage() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const lib = createMaterialLibraryWith({ baseUrl: '/m/', source: { load: async () => new Texture() }, fetchJson: async () => { throw new Error('none'); } });
  await lib.ready;
  const scene = new Group();
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  const sprites = new BillboardPool({ decoder: fakeDecoder(), camera: cam });
  await sprites.bindAtlas(fakeSet('a-001'));
  const vfx = new VfxSystem();
  const actors = new CharacterPool({ harvestLevel: lib.uniforms.harvestLevel, camera: cam, viewport: () => ({ w: 1280, h: 720 }) });
  scene.add(actors.root);
  const rig = new DioramaRig(cam, { effects: () => ALL_EFFECTS, feet: (id, out) => actors.feetOf(id, out) });
  const stage = new Stage({
    parent: scene, sprites, vfx, rig, actors, materials: lib, effects: () => ALL_EFFECTS, harvestLevel: () => 0, camera: cam,
    viewport: () => ({ w: 1280, h: 720 }),
  });
  return { lib, stage, vfx, rig };
}

describe('Phase D6: battlerSlot for doubles', () => {
  it('four distinct feet, mirrored through the centre, each foot disc inside the ring; count 1 stays on the centre line', () => {
    const c = new Vector3(4, 0, -3);
    for (const yaw of [headingYaw(0), headingYaw(1), 0.37, -2.1]) {
      const pts = REFS.map((r) => battlerSlot(c, yaw, r.side, r.slot, 2, new Vector3()));
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(pts[i]!.distanceTo(pts[j]!)).toBeGreaterThan(SLOT_SPACING - 1e-9);
      // the two of a side stand SLOT_SPACING apart, the sides BATTLER_SEPARATION apart along the axis
      expect(pts[0]!.distanceTo(pts[1]!)).toBeCloseTo(SLOT_SPACING, 9);
      expect(pts[2]!.distanceTo(pts[3]!)).toBeCloseTo(SLOT_SPACING, 9);
      // point-symmetric: side 0 position p mirrors side 1 position p through the arena centre
      for (const p of [0, 1]) {
        const a = pts[p]!; const b = pts[2 + p]!;
        expect((a.x + b.x) / 2).toBeCloseTo(c.x, 9);
        expect((a.z + b.z) / 2).toBeCloseTo(c.z, 9);
      }
      for (const p of pts) {
        expect(p.y).toBe(c.y);
        expect(Math.hypot(p.x - c.x, p.z - c.z) + STAGE.battlerFootR).toBeLessThanOrEqual(STAGE.ringRadius);
      }
      // singles: one battler per side on the axis, BATTLER_SEPARATION apart (unchanged)
      const s0 = battlerSlot(c, yaw, 0, 0, 1, new Vector3()); const s1 = battlerSlot(c, yaw, 1, 0, 1, new Vector3());
      expect(s0.distanceTo(s1)).toBeCloseTo(BATTLER_SEPARATION, 9);
      expect((s0.x + s1.x) / 2).toBeCloseTo(c.x, 9);
      expect((s0.z + s1.z) / 2).toBeCloseTo(c.z, 9);
      expect(Math.hypot(s0.x - c.x, s0.z - c.z)).toBeCloseTo(BATTLER_SEPARATION / 2, 9);
    }
  });

  it('a narrow hall: after fitCentre all four foot discs (and the ring) stand on the floor, for every hall yaw / battle axis', () => {
    for (const hallYaw of [0, Math.PI / 2, 0.6]) {
      for (const along of [true, false]) {
        // the battle axis runs along the hall's long side (or across it, where the hall is wide enough)
        const hall: HallBounds = along ? { x: 2, z: -1, yaw: hallYaw, hw: 4.3, hd: 6.4 } : { x: 2, z: -1, yaw: hallYaw, hw: 6.4, hd: 4.3 };
        const yaw = hallYaw;          // diorama yaw = hall yaw → the battle axis is the hall's local z
        const out: [number, number] = [0, 0];
        fitCentre(hall, hall.x + 5, hall.z - 7, yaw, out);
        const c = new Vector3(out[0], 0, out[1]);
        expect(inHall(hall, c.x, c.z, STAGE.ringFitR)).toBe(true);
        for (const r of REFS) {
          const p = battlerSlot(c, yaw, r.side, r.slot, 2, new Vector3());
          expect(inHall(hall, p.x, p.z, STAGE.battlerFootR + STAGE.hallMarginM), `${hallYaw} ${along} ${r.side}:${r.slot}`).toBe(true);
        }
      }
    }
  });
});

describe('Phase D6: BattleStage with four battlers', () => {
  it('two per side on the ring top, distinct and inside the ring; VFX resolve every position; removing one re-centres its side', async () => {
    const { lib, stage, vfx } = await makeStage();
    stage.dress({ x: 6, z: 2 }, 'grove', []);
    for (let i = 0; i < 40; i++) stage.update(16, 16);
    for (const r of REFS) stage.setBattler(r, desc(`c${r.side}${r.slot}`));
    expect(stage.battlerCount).toBe(4);
    const c = stage.arenaCenter;
    const feet = REFS.map((r) => stage.battler(r)!.feet(new Vector3()));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(feet[i]!.distanceTo(feet[j]!)).toBeGreaterThan(1);
    for (const f of feet) {
      expect(Math.hypot(f.x - c.x, f.z - c.z) + STAGE.battlerFootR).toBeLessThanOrEqual(STAGE.ringRadius);
      expect(f.y).toBeCloseTo(c.y + STAGE.ringTop, 6);
    }
    for (const r of REFS) expect(stage.battler(r)!.facing).toBe(r.side === 0 ? 'back' : 'front');
    for (const r of REFS) expect(stage.battler(r)!.userDataRecord.sharp).toBe(1);
    // VFX between any two positions (ally → ally included) spawn from the right anchors
    // (the stage reuses its two anchor records: read them right after each spawn)
    const spawn = vi.spyOn(vfx, 'spawn');
    stage.vfx('type_fire', { side: 0, slot: 1 }, { side: 1, slot: 1 }, 500);
    const [, fa, ta] = spawn.mock.calls[0]!;
    expect(fa!.feet.distanceTo(feet[1]!)).toBeCloseTo(0, 6);
    expect(ta!.feet.distanceTo(feet[3]!)).toBeCloseTo(0, 6);
    stage.vfx('heal', { side: 1, slot: 0 }, { side: 1, slot: 1 }, 500);
    const [, fb, tb] = spawn.mock.calls[1]!;
    expect(fb!.feet.distanceTo(feet[2]!)).toBeCloseTo(0, 6);
    expect(tb!.feet.distanceTo(feet[3]!)).toBeCloseTo(0, 6);
    stage.vfx('impact_crit', { side: 0, slot: 0 }, { side: 1, slot: 1 }, 300);
    expect(stage.battler({ side: 1, slot: 1 })!.userDataRecord.hurt).toBe(1);
    expect(stage.battler({ side: 1, slot: 0 })!.userDataRecord.hurt).not.toBe(1);
    // singles layout returns when a side holds one battler
    stage.setBattler({ side: 1, slot: 1 }, null);
    const lone = stage.battler({ side: 1, slot: 0 })!.feet(new Vector3());
    const near = stage.battler({ side: 0, slot: 0 })!.feet(new Vector3());
    expect(Math.hypot(lone.x - c.x, lone.z - c.z)).toBeCloseTo(BATTLER_SEPARATION / 2, 6);
    expect(near.distanceTo(feet[0]!)).toBeCloseTo(0, 6);     // the other side is untouched
    stage.undress(0);
    stage.dispose();
    lib.disposeAll();
  });
});
