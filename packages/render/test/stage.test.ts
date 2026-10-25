/**
 * §10.7.5 / §10.7.6 (node, no GPU): the VFX id table (exactly 47, one recipe each, pooled and fixed-capacity),
 * battle-stage dress/undress bookkeeping (Pillar 7: the reserved beacon lights never change the light set, the zone
 * root is untouched, shared materials are never disposed), battlers, and the actor pool.
 */
import { describe, expect, it, vi } from 'vitest';
import { Group, Material, PerspectiveCamera, PointLight, SpotLight, Texture, Vector3 } from 'three/webgpu';
import type { Object3D } from 'three/webgpu';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { createMaterialLibraryWith } from '../src/materials/library.js';
import { DioramaRig } from '../src/camera/rig.js';
import { BATTLER_SEPARATION } from '../src/camera/battle.js';
import { BillboardPool } from '../src/sprites/billboard.js';
import type { AtlasDecoder, AtlasSet } from '../src/sprites/atlas.js';
import { TYPE_NAMES } from '../src/sprites/typeColors.js';
import { CAPACITY, EMITTERS, MAX_PARTICLES, MOVE_STYLES, VFX_IDS, VFX_IMPACT_IDS, VFX_MISC_IDS, VFX_ORB_IDS, VFX_STAT_IDS, VFX_STATUS_IDS, VFX_STYLE_IDS, VFX_TABLE, VFX_TYPE_IDS, VFX_WEATHER_IDS, VfxSystem } from '../src/stage/vfx.js';
import { ACTOR_POOL_SIZE, CharacterPool, EMOTE_MS } from '../src/stage/actors.js';
import { STAGE, Stage } from '../src/stage/battleStage.js';
import type { SpriteDescriptor, VfxId } from '../src/contracts.js';

describe('§10.7.5 VFX id table', () => {
  it('a style_* effect takes the colours of the type passed to spawn; a type_* keeps its own', () => {
    const colours = (id: VfxId, type: 'Fire' | 'Water' | null): string => {
      const sys = new VfxSystem();
      sys.spawn(id, { feet: new Vector3(0, 0, 0), height: 1 }, { feet: new Vector3(5, 0, 0), height: 1 }, new Vector3(), 300, type);
      const a = (sys as unknown as { aColor: { array: Float32Array } }).aColor.array;
      const out = Array.from(a.slice(0, 4 * 8)).map((x) => x.toFixed(3)).join();
      sys.dispose();
      return out;
    };
    expect(colours('style_beam', 'Fire')).not.toBe(colours('style_beam', 'Water'));
    expect(colours('style_beam', null)).not.toBe(colours('style_beam', 'Fire'));
    expect(colours('type_fire', 'Water')).toBe(colours('type_fire', null));
  });

  it('exactly 19 + 4 + 6 + 5 + 4 + 4 + 5 = 47 unique ids + the Phase D4 shiny burst + the two form bursts (Majin / rage, Tenjin) + 14 move styles = 64, the SPEC union, one recipe each', () => {
    expect(VFX_TYPE_IDS).toHaveLength(19);
    expect(VFX_TYPE_IDS).toEqual(TYPE_NAMES.map((t) => `type_${t.toLowerCase()}`));
    expect([VFX_IMPACT_IDS, VFX_STATUS_IDS, VFX_STAT_IDS, VFX_WEATHER_IDS, VFX_ORB_IDS, VFX_MISC_IDS].map((g) => g.length)).toEqual([4, 6, 5, 4, 4, 5]);
    expect(VFX_IDS).toHaveLength(64);
    expect(new Set(VFX_IDS).size).toBe(64);
    expect(VFX_IDS.slice(-17, -14)).toEqual(['shiny_sparkle', 'form_rage', 'form_tenjin']);
    expect(VFX_STYLE_IDS).toEqual(MOVE_STYLES.map((m) => `style_${m}`));
    expect(VFX_IDS.slice(-14)).toEqual(VFX_STYLE_IDS);
    expect(Object.keys(VFX_TABLE).sort()).toEqual([...VFX_IDS].sort());
    for (const id of VFX_IDS) {
      const r = VFX_TABLE[id];
      expect(r.id).toBe(id);
      expect(r.phases.length).toBeGreaterThan(0);
      for (const p of r.phases) {
        expect(p.count).toBeGreaterThan(0);
        expect(p.count).toBeLessThanOrEqual(MAX_PARTICLES);      // ≤ 512 per pooled cloud
        if (p.shape === 'ring' && p.size >= 0.8) expect(p.count).toBeLessThanOrEqual(8);   // card bursts ≤ 8
        expect(p.lifeMs).toBeGreaterThan(0);
      }
    }
    expect(VFX_TABLE.impact_super.chroma).toEqual({ amount: 0.012, ms: 120 });
    expect(VFX_TABLE.impact_crit.flash).toBe(1);
  });

  it('the pool is fixed-capacity (8 × 512), deterministic, never writes mask.y, and prewarm validates ids', () => {
    const a = new VfxSystem(); const b = new VfxSystem();
    expect(a.object.count).toBe(CAPACITY);
    expect(CAPACITY).toBe(EMITTERS * MAX_PARTICLES);
    const from = { feet: new Vector3(0, 0, 2.75), height: 1.6 }; const to = { feet: new Vector3(0, 0, -2.75), height: 1.6 };
    for (const id of ['type_fire', 'impact_super', 'heal', 'weather_rain'] as VfxId[]) { a.spawn(id, from, to, new Vector3(), 700); b.spawn(id, from, to, new Vector3(), 700); }
    const arr = (s: VfxSystem) => Array.from((s as unknown as { aOrigin: { array: Float32Array } }).aOrigin.array.slice(0, 4096));
    expect(arr(a)).toEqual(arr(b));
    expect(a.activeEmitters()).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) a.spawn('type_electric', from, to, new Vector3(), 500);   // more spawns than emitters: recycled, never grown
    expect(a.object.count).toBe(CAPACITY);
    expect(a.activeEmitters()).toBeLessThanOrEqual(EMITTERS);
    const mask = (a.material.mrtNode as unknown as { outputNodes: Record<string, unknown>; getBlendMode(n: string): { blendSrc: number; blendDst: number } });
    expect(Object.keys(mask.outputNodes).sort()).toEqual(['mask', 'normal']);
    expect(() => a.prewarm(['nope' as VfxId])).toThrow(RangeError);
    a.prewarm(['type_fire']);
    expect(a.isPrewarmed('type_fire')).toBe(true);
    const chroma = vi.fn();
    const c = new VfxSystem({ chroma });
    c.spawn('impact_super', from, to, new Vector3(), 300);
    expect(chroma).toHaveBeenCalledWith(0.012, 120);
    a.update(100, null);
    expect(a.now).toBeCloseTo(0.1, 9);
    a.clear();
    expect(a.object.visible).toBe(false);
    a.dispose(); a.dispose(); b.dispose(); c.dispose();
  });
});

// ---- stage fixtures -----------------------------------------------------------------------------------------------

function fakeDecoder(): AtlasDecoder {
  return { decode: async (url, crop) => ({ width: crop ? crop[2] : 2048, height: crop ? crop[3] : 2048, close: () => {} }) };
}
function fakeSet(id: string): AtlasSet {
  const m = (k: string) => ({ url: `/c/${id}.${k}.webp`, mips: ['1', '2', '3'].map((i) => `/c/${id}.${k}.m${i}.webp`) });
  return { id, albedo: m('albedo'), normal: m('normal'), emissive: m('emissive'), size: 2048, normalScale: 0.5 };
}
function desc(id: string): SpriteDescriptor {
  const f = (x: number) => ({ atlas: 'a-001', rect: [x, 0.5, x + 0.5, 1] as const, px: [x * 2048, 0, 1024, 1024] as const, footV: 0.08, aspect: 1 });
  return { id, front: f(0.5), back: f(0), sizeScale: 1, types: ['Grass'], variant: 'normal', isAlpha: false };
}

async function makeStage() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const lib = createMaterialLibraryWith({ baseUrl: '/m/', source: { load: async () => new Texture() }, fetchJson: async () => { throw new Error('none'); } });
  await lib.ready;
  const scene = new Group();
  const zoneRoot = new Group(); zoneRoot.name = 'zone';
  scene.add(zoneRoot);
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
  return { lib, scene, zoneRoot, cam, sprites, vfx, actors, rig, stage };
}

function lights(root: Object3D): (SpotLight | PointLight)[] {
  const out: (SpotLight | PointLight)[] = [];
  root.traverse((o) => { if (o instanceof SpotLight || o instanceof PointLight) out.push(o); });
  return out;
}

describe('§10.7.5 BattleStage bookkeeping', () => {
  it('dress → arena up, 2 reserved beacon lights lit, ≤ 6 spectators, battlers 5.5 m apart; undress → all released', async () => {
    const { lib, scene, zoneRoot, stage, sprites, actors, rig } = await makeStage();
    const lightsBefore = lights(scene).map((l) => l.uuid);
    expect(lightsBefore).toHaveLength(2);                      // the reserved slots exist from construction
    expect(stage.beaconIntensity).toBe(0);
    expect(lights(scene).every((l) => !l.castShadow)).toBe(true);
    const libDispose = vi.spyOn(Material.prototype, 'dispose');
    stage.dress({ x: 10, z: -4 }, 'grove', ['p1']);
    for (let i = 0; i < 40; i++) stage.update(16, 16);
    expect(stage.dressed).toBe(true);
    expect(stage.arenaRoot.visible).toBe(true);
    expect(stage.arenaRoot.position.y).toBeCloseTo(0, 6);     // fully risen
    expect(stage.beaconIntensity).toBeCloseTo(STAGE.beaconIntensity, 3);
    expect(lights(scene).map((l) => l.uuid)).toEqual(lightsBefore);   // same light set during the battle (Pillar 7)
    expect(stage.spectatorIds.length).toBeLessThanOrEqual(6);
    expect(actors.liveCount).toBe(stage.spectatorIds.length);
    stage.setBattler({ side: 0, slot: 0 }, desc('mine'));
    stage.setBattler({ side: 1, slot: 0 }, desc('foe'));
    expect(stage.battlerCount).toBe(2);
    const a = stage.battler({ side: 0, slot: 0 })!; const b = stage.battler({ side: 1, slot: 0 })!;
    expect(a.feet(new Vector3()).distanceTo(b.feet(new Vector3()))).toBeCloseTo(BATTLER_SEPARATION, 6);
    expect(a.facing).toBe('back');
    expect(b.facing).toBe('front');
    expect(a.userDataRecord.sharp).toBe(1);
    expect(b.userDataRecord.sharp).toBe(1);
    expect(sprites.stats().live).toBe(2);
    stage.setBattler({ side: 1, slot: 0 }, desc('foe'));       // same descriptor: kept
    expect(sprites.stats().live).toBe(2);
    stage.vfx('impact_crit', { side: 0, slot: 0 }, { side: 1, slot: 0 }, 300);
    expect(b.userDataRecord.hurt).toBe(1);                      // impact_crit: white flash on the target
    stage.faint({ side: 1, slot: 0 }, 900);
    expect(b.currentPose).toBe('faint');
    stage.undress(400);
    expect(sprites.stats().live).toBe(0);
    expect(actors.liveCount).toBe(0);
    for (let i = 0; i < 40; i++) stage.update(16, 16);
    expect(stage.arenaRoot.visible).toBe(false);
    expect(stage.beaconIntensity).toBe(0);
    expect(lights(scene).map((l) => l.uuid)).toEqual(lightsBefore);
    expect(zoneRoot.parent).toBe(scene);                        // the zone root is never touched
    expect(libDispose).not.toHaveBeenCalled();                  // nothing shared is disposed by undress
    libDispose.mockRestore();
    expect(rig.currentMode).toBe('diorama');                    // the stage never moves the camera itself
    lib.disposeAll();
  });

  it('spectator arenas: ring + beacons only, no battlers, no lights of their own; dispose is idempotent', async () => {
    const { scene, stage } = await makeStage();
    stage.dressSpectator(40, 40);
    stage.dressSpectator(-40, 40);
    for (let i = 0; i < 40; i++) stage.update(16, 16);
    expect(stage.spectatorArenaCount).toBe(2);
    expect(stage.battlerCount).toBe(0);
    expect(lights(scene)).toHaveLength(2);
    stage.undressSpectator(39, 41);
    for (let i = 0; i < 40; i++) stage.update(16, 16);
    expect(stage.spectatorArenaCount).toBe(1);
    stage.dispose(); stage.dispose();
    expect(lights(scene)).toHaveLength(0);
  });

  it('syncFrom resets poses: fainted battlers stay invisible, the rest idle', async () => {
    const { stage } = await makeStage();
    stage.dress({ x: 0, z: 0 }, 'none', []);
    stage.setBattler({ side: 0, slot: 0 }, desc('a'));
    stage.setBattler({ side: 1, slot: 0 }, desc('b'));
    stage.setPose({ side: 0, slot: 0 }, 'lunge', 300);
    stage.syncFrom([{ ref: { side: 0, slot: 0 }, hpFrac: 0.5 }, { ref: { side: 1, slot: 0 }, hpFrac: 0 }]);
    expect(stage.battler({ side: 0, slot: 0 })!.currentPose).toBe('idle');
    expect(stage.battler({ side: 1, slot: 0 })!.dissolve).toBe(1);
    expect(() => stage.vfx('nope' as VfxId, null, null, 0)).toThrow(RangeError);
  });
});

describe('§10.7.6 ActorPool', () => {
  it('48 preallocated rigs; spawn/setTransform/feetOf/emote/despawn; exhausting the pool throws in dev', async () => {
    const lib = createMaterialLibraryWith({ baseUrl: '/m/', source: { load: async () => new Texture() }, fetchJson: async () => { throw new Error('none'); } });
    const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
    cam.position.set(0, 20, 16); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
    const pool = new CharacterPool({ harvestLevel: lib.uniforms.harvestLevel, camera: cam, viewport: () => ({ w: 1280, h: 720 }) });
    expect(pool.capacity).toBe(ACTOR_POOL_SIZE);
    pool.setGround((x, z) => 0.1 * x + 0.05 * z);
    pool.spawn('me', { look: 'ranger_m', name: 'Rowan', guildTag: '', isLocal: true });
    pool.setTransform('me', 2, 4, 1.2, true, false);
    expect(pool.feetOf('me', new Vector3())!.toArray()).toEqual([2, 0.4, 4]);
    expect(pool.feetOf('ghost', new Vector3())).toBeNull();
    expect(pool.sharpOf('me')).toBe(1);   // the local character is DOF-sharp
    const xy = new Float32Array(96);
    expect(pool.screenPositions(xy)).toBe(1);
    expect(xy[0]).toBeGreaterThan(0); expect(xy[0]).toBeLessThan(1280);
    pool.setEmote('me', 1);
    pool.update(EMOTE_MS / 2);
    expect(pool.emoteOf('me').n).toBe(1);
    pool.update(EMOTE_MS);
    expect(pool.emoteOf('me').n).toBe(0);                     // a 2 s card
    for (let i = 1; i < ACTOR_POOL_SIZE; i++) pool.spawn(`a${i}`, { look: `npc_${i % 5}`, name: '', guildTag: '', isLocal: false });
    expect(() => pool.spawn('overflow', { look: 'x', name: '', guildTag: '', isLocal: false })).toThrow(RangeError);
    pool.despawn('a1');
    expect(pool.has('a1')).toBe(false);
    pool.spawn('late', { look: 'x', name: '', guildTag: '', isLocal: false });
    expect(pool.liveCount).toBe(ACTOR_POOL_SIZE);
    pool.dispose(); pool.dispose();
  });
});
