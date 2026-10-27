/**
 * Battle-form auras (node, no GPU; stage/aura.ts): a battler whose descriptor carries `aura` gets the looping flames,
 * the floor sigil and the rim glow; the aura follows the battler through a form change, ends on a faint, a plain
 * sprite, `undress` and `dispose`; slots are fixed (no lights, no growth) and the rim colour is restored.
 */
import { describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, PointLight, Scene, SpotLight, Texture } from 'three/webgpu';
import type { Mesh, Object3D, Sprite } from 'three/webgpu';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { createMaterialLibraryWith } from '../src/materials/library.js';
import { DioramaRig } from '../src/camera/rig.js';
import { BillboardPool } from '../src/sprites/billboard.js';
import type { AtlasDecoder, AtlasSet } from '../src/sprites/atlas.js';
import { VfxSystem } from '../src/stage/vfx.js';
import { CharacterPool } from '../src/stage/actors.js';
import { Stage } from '../src/stage/battleStage.js';
import { AURA } from '../src/stage/aura.js';
import type { AuraKind, SpriteDescriptor } from '../src/contracts.js';

function fakeDecoder(): AtlasDecoder {
  return { decode: async (_url, crop) => ({ width: crop ? crop[2] : 2048, height: crop ? crop[3] : 2048, close: () => {} }) };
}
function fakeSet(id: string): AtlasSet {
  const m = (k: string) => ({ url: `/c/${id}.${k}.webp`, mips: ['1', '2', '3'].map((i) => `/c/${id}.${k}.m${i}.webp`) });
  return { id, albedo: m('albedo'), normal: m('normal'), emissive: m('emissive'), size: 2048, normalScale: 0.5 };
}
function desc(id: string, x = 0.5, aura?: AuraKind): SpriteDescriptor {
  const f = (u: number) => ({ atlas: 'a-001', rect: [u, 0.5, u + 0.5, 1] as const, px: [u * 2048, 0, 1024, 1024] as const, footV: 0.08, aspect: 1 });
  return { id, front: f(x), back: f(0), heightM: 1.376, types: ['Ghost'], variant: 'normal', isAlpha: false, ...(aura !== undefined ? { aura } : {}) };
}

async function makeStage() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const lib = createMaterialLibraryWith({ baseUrl: '/m/', source: { load: async () => new Texture() }, fetchJson: async () => { throw new Error('none'); } });
  await lib.ready;
  const scene = new Scene();
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  cam.position.set(0, 6, 12); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
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
  return { scene, stage, sprites, vfx };
}

function lights(root: Object3D): number {
  let n = 0;
  root.traverse((o) => { if (o instanceof SpotLight || o instanceof PointLight) n++; });
  return n;
}
function auraObjects(scene: Scene): { flames: Sprite[]; sigils: Mesh[] } {
  const flames: Sprite[] = []; const sigils: Mesh[] = [];
  scene.traverse((o) => {
    if (o.name.startsWith('ewa:aura-flames:')) flames.push(o as Sprite);
    if (o.name.startsWith('ewa:aura-sigil:')) sigils.push(o as Mesh);
  });
  return { flames, sigils };
}
const run = (stage: Stage, frames: number, ms = 16): void => { for (let i = 0; i < frames; i++) stage.update(ms, ms); };
const FOE = { side: 1 as const, slot: 0 };
const OWN = { side: 0 as const, slot: 0 };

describe('battle-form auras', () => {
  it('fixed slots from construction: 4 flames + 4 sigils, all hidden, one shared material each, no lights', async () => {
    const { scene, stage } = await makeStage();
    const before = lights(scene);
    const { flames, sigils } = auraObjects(scene);
    expect(flames).toHaveLength(AURA.slots);
    expect(sigils).toHaveLength(AURA.slots);
    expect(new Set(flames.map((f) => f.material)).size).toBe(1);
    expect(new Set(sigils.map((s) => s.material)).size).toBe(1);
    for (const f of flames) { expect(f.visible).toBe(false); expect(f.count).toBe(AURA.particles); }
    stage.dress({ x: 0, z: 0 }, 'grove', []);
    stage.setBattler(FOE, desc('hollowmane', 0.5, 'majin'));
    run(stage, 30);
    expect(lights(scene)).toBe(before);                 // an aura never adds a light (C13)
    expect(auraObjects(scene).flames).toHaveLength(AURA.slots);
    stage.dispose();
  });

  it('a Majin descriptor lights its aura: fades in, follows the battler, glows the rim crimson; a plain sprite ends it', async () => {
    const { scene, stage } = await makeStage();
    stage.dress({ x: 4, z: -2 }, 'grove', []);
    stage.setBattler(FOE, desc('hollowmane'));
    run(stage, 5);
    const bb = stage.battler(FOE)!;
    const typeRim = bb.userDataRecord.typeColor.clone();
    expect(stage.aura.kindOf('1:0')).toBeNull();
    expect(stage.aura.active).toBe(0);
    // the form change: the rage sprite with a Majin aura (a new billboard under the same ref)
    stage.setBattler(FOE, desc('hollowmane', 0, 'majin'));
    expect(stage.aura.kindOf('1:0')).toBe('majin');
    run(stage, 40);
    expect(stage.aura.active).toBe(1);
    const form = stage.battler(FOE)!;
    const rim = form.userDataRecord.typeColor;
    expect(rim.r).toBeGreaterThan(1);                    // HDR crimson: red dominates
    expect(rim.r).toBeGreaterThan(rim.g * 8);
    const { flames, sigils } = auraObjects(scene);
    const live = flames.find((f) => f.visible)!;
    expect(live.userData.auraLevel).toBeCloseTo(1, 5);
    expect(live.userData.auraDims.z).toBe(0);           // 0 = Majin
    const feet = form.object.getWorldPosition(live.userData.auraFeet.clone());
    expect(live.userData.auraFeet.distanceTo(feet)).toBeLessThan(1e-6);
    const sigil = sigils.find((s) => s.visible)!;
    expect(Math.hypot(sigil.position.x - feet.x, sigil.position.z - feet.z)).toBeLessThan(1e-6);
    expect(sigil.scale.x).toBeGreaterThanOrEqual(AURA.sigilMinM);
    // back to the plain sprite (a resync to a formless battler): the aura fades out and the type rim returns
    stage.setBattler(FOE, desc('hollowmane'));
    expect(stage.aura.kindOf('1:0')).toBeNull();
    run(stage, 40);
    expect(stage.aura.active).toBe(0);
    expect(stage.battler(FOE)!.userDataRecord.typeColor.equals(typeRim)).toBe(true);
    stage.dispose();
  });

  it('Tenjin is gold, re-setting the same aura keeps it running, and a faint ends it', async () => {
    const { scene, stage } = await makeStage();
    stage.dress({ x: 0, z: 0 }, 'grove', []);
    stage.setBattler(OWN, desc('thornback', 0.5, 'tenjin'));
    run(stage, 40);
    const bb = stage.battler(OWN)!;
    const rim = bb.userDataRecord.typeColor;
    expect(rim.r).toBeGreaterThan(1);
    expect(rim.g).toBeGreaterThan(rim.b * 1.5);         // gold: red ≥ green > blue
    const live = auraObjects(scene).flames.find((f) => f.visible)!;
    expect(live.userData.auraDims.z).toBe(1);           // 1 = Tenjin
    // the client rebuilds descriptor objects every update: the same creature keeps its billboard and its aura level
    stage.setBattler(OWN, desc('thornback', 0.5, 'tenjin'));
    expect(stage.battler(OWN)).toBe(bb);
    expect(live.userData.auraLevel).toBeCloseTo(1, 5);
    stage.faint(OWN, 600);
    expect(stage.aura.kindOf('0:0')).toBeNull();
    run(stage, 40);
    expect(stage.aura.active).toBe(0);
    stage.dispose();
  });

  it('Majin gold (zenryu): the Majin motion and cracked sigil with a gold rim and its own kind index', async () => {
    const { scene, stage } = await makeStage();
    stage.dress({ x: 0, z: 0 }, 'grove', []);
    stage.setBattler(FOE, desc('zenryu', 0.5, 'majin_gold'));
    run(stage, 40);
    expect(stage.aura.kindOf('1:0')).toBe('majin_gold');
    const rim = stage.battler(FOE)!.userDataRecord.typeColor;
    expect(rim.r).toBeGreaterThan(1);
    expect(rim.g).toBeGreaterThan(rim.b * 3);           // gold, not crimson (crimson has almost no green)
    expect(rim.g / rim.r).toBeGreaterThan(0.5);
    const { flames, sigils } = auraObjects(scene);
    expect(flames.find((f) => f.visible)!.userData.auraDims.z).toBe(2);
    expect(sigils.find((s) => s.visible)!.userData.auraKind).toBe(2);
    stage.dispose();
  });

  it('doubles: four field positions hold four auras at once; undress clears them all', async () => {
    const { stage } = await makeStage();
    stage.dress({ x: 0, z: 0 }, 'grove', []);
    const refs = [{ side: 0 as const, slot: 0 }, { side: 0 as const, slot: 1 }, { side: 1 as const, slot: 0 }, { side: 1 as const, slot: 1 }];
    refs.forEach((r, i) => stage.setBattler(r, desc(`c${i}`, 0.5, i % 2 === 0 ? 'majin' : 'tenjin')));
    run(stage, 30);
    expect(stage.aura.active).toBe(4);
    stage.undress(300);
    expect(stage.aura.active).toBe(0);
    for (const r of refs) expect(stage.aura.kindOf(`${r.side}:${r.slot}`)).toBeNull();
    stage.dispose();
  });

  it('hitstop freezes the flames (they run on the VFX clock); the warm-up objects compile both materials', async () => {
    const { stage, vfx } = await makeStage();
    stage.dress({ x: 0, z: 0 }, 'grove', []);
    stage.setBattler(FOE, desc('castlemaw', 0.5, 'majin'));
    const t0 = vfx.clock.value;
    for (let i = 0; i < 10; i++) { vfx.update(0, null); stage.update(0, 16); }   // timeScale 0: scaled dt is 0
    expect(vfx.clock.value).toBe(t0);
    const warm = stage.aura.warmupObjects();
    expect(warm).toHaveLength(2);
    expect((warm[0] as Sprite).material).toBe(stage.aura.flameMaterial);
    expect((warm[1] as Mesh).material).toBe(stage.aura.sigilMaterial);
    stage.dispose();
    stage.dispose();
  });
});
