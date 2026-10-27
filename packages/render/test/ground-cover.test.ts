/**
 * IMPLEMENTATION-NOTES Part 5: T1 (a dressed arena hides the ground cover and small props inside its ring through the
 * scatter mask, restored on undress — Pillar 7: the zone root, its children and the light list are unchanged), the
 * prop cutaway (M2-battle-8: posts / fences inside the ring), T3 (grass flattened round shown creatures near the
 * focus, not round distant ones), and the mask's bookkeeping (zero-scale / vertical scale, partial uploads, no
 * allocation after construction).
 */
import { describe, expect, it, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, Material, Mesh, PerspectiveCamera, PointLight, SpotLight, Texture, Vector3 } from 'three/webgpu';
import type { Object3D } from 'three/webgpu';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { createMaterialLibraryWith } from '../src/materials/library.js';
import { DioramaRig } from '../src/camera/rig.js';
import { BillboardPool } from '../src/sprites/billboard.js';
import type { AtlasDecoder } from '../src/sprites/atlas.js';
import { VfxSystem } from '../src/stage/vfx.js';
import { CharacterPool } from '../src/stage/actors.js';
import { STAGE, Stage } from '../src/stage/battleStage.js';
import { GroundCoverReveal, REVEAL } from '../src/stage/groundCover.js';
import { PropCutaway } from '../src/stage/propCutaway.js';
import { COVER, ChunkSet, MASK_HIDE_BELOW, ScatterField, ScatterMask, coverClassOf, scatterMaskFor, type Instance } from '../src/zone/scatter.js';
import { chunkGrid } from '../src/zone/lod.js';
import type { SpriteDescriptor } from '../src/contracts.js';

function cardGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 0.5, 0, 0, 0, 1, 0]), 3));
  return g;
}

/** A zone root with one tall-grass field (a 1 m grid over ±14 m), a rock field, a merged prop mesh and one light. */
function zone(kind = 'tall_grass') {
  const root = new Group(); root.name = 'ewa:zone:test';
  const chunks = new ChunkSet(chunkGrid(96));
  const inst: Instance[] = [];
  for (let x = -14; x <= 14; x++) for (let z = -14; z <= 14; z++) inst.push({ x: x + 0.25, y: 0, z: z + 0.25, yaw: 0.3, scale: 1, tint: 0 });
  const mat = new Material();
  const field = new ScatterField({ name: kind, tiers: [[{ geometry: cardGeometry(), cls: 1, casts: false }], null, null, null], materials: [mat], castShadow: false, shadowTierLimit: 0 }, inst, chunks, root, []);
  const rocks = new ScatterField({ name: 'rock_a', tiers: [[{ geometry: cardGeometry(), cls: 0, casts: true }], null, null, null], materials: [mat], castShadow: true, shadowTierLimit: 2 }, inst.slice(0, 50), chunks, root, []);
  // a merged prop chunk: two quads (a "fence post" at (1, 1) inside the ring and one at (20, 0) outside), indexed
  const pg = new BufferGeometry();
  pg.setAttribute('position', new BufferAttribute(new Float32Array([1, 0, 1, 1.2, 0, 1, 1, 1, 1, 20, 0, 0, 20.2, 0, 0, 20, 1, 0]), 3));
  pg.setIndex([0, 1, 2, 3, 4, 5]);
  const props = new Mesh(pg, mat); props.name = 'ewa:props:12:c:lod0';
  root.add(props);
  const light = new PointLight(0xffffff, 1); root.add(light);
  chunks.initVisibility();
  field.sync(chunks); rocks.sync(chunks);
  return { root, chunks, field, rocks, inst, props, pg };
}

function written(f: ScatterField, n: number): Float32Array[] {
  const out: Float32Array[] = [];
  for (let i = 0; i < n; i++) out.push(new Float32Array(f.writtenMatrix(i, new Float32Array(16))!));
  return out;
}

function fakeDecoder(): AtlasDecoder {
  return { decode: async (_url, crop) => ({ width: crop ? crop[2] : 2048, height: crop ? crop[3] : 2048, close: () => {} }) };
}

async function stageFor(root: Object3D) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const lib = createMaterialLibraryWith({ baseUrl: '/m/', source: { load: async () => new Texture() }, fetchJson: async () => { throw new Error('none'); } });
  await lib.ready;
  const scene = new Group();
  scene.add(root);
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  const sprites = new BillboardPool({ decoder: fakeDecoder(), camera: cam });
  const actors = new CharacterPool({ harvestLevel: lib.uniforms.harvestLevel, camera: cam, viewport: () => ({ w: 1280, h: 720 }) });
  const rig = new DioramaRig(cam, { effects: () => ALL_EFFECTS });
  const stage = new Stage({ parent: scene, sprites, vfx: new VfxSystem(), rig, actors, materials: lib, effects: () => ALL_EFFECTS, harvestLevel: () => 0, camera: cam, viewport: () => ({ w: 1280, h: 720 }) });
  return { lib, scene, stage, sprites, rig };
}

const lightIds = (o: Object3D): string[] => { const out: string[] = []; o.traverse((x) => { if (x instanceof PointLight || x instanceof SpotLight) out.push(x.uuid); }); return out; };

describe('T1 scatter mask', () => {
  it('cover classes follow the builder kinds', () => {
    expect(coverClassOf('tall_grass')).toBe(COVER.ground);
    expect(coverClassOf('grass_tuft')).toBe(COVER.ground);
    expect(coverClassOf('flower_patch')).toBe(COVER.ground);
    expect(coverClassOf('tree_willow')).toBe(COVER.tree);
    expect(coverClassOf('rock_a')).toBe(COVER.large);
    expect(coverClassOf('bush')).toBe(COVER.small);
  });

  it('a disc hides (zero 3×3) inside, eases the vertical scale at its edge, leaves the rest and restores byte-exactly', () => {
    const { field, chunks, inst, root } = zone();
    const before = written(field, inst.length);
    const mask = scatterMaskFor(root);
    expect(field.mask).toBe(mask);
    const gen0 = mask.generation;
    mask.set(0, 0, 0, 3, 5, 0, COVER.ground);
    expect(mask.generation).toBe(gen0 + 1);
    mask.set(0, 0.001, 0, 3, 5, 0, COVER.ground);              // < 1 cm: no change, no rewrite
    expect(mask.generation).toBe(gen0 + 1);
    field.sync(chunks);
    const after = written(field, inst.length);
    inst.forEach((it, i) => {
      const d = Math.hypot(it.x, it.z);
      const m = after[i]!;
      if (d <= 3) { for (let e = 0; e < 11; e++) expect(m[e]).toBe(0); expect(m[12]).toBe(before[i]![12]); }
      else if (d >= 5) expect(Array.from(m)).toEqual(Array.from(before[i]!));
      else {
        const t = (d - 3) / 2; const f = t * t * (3 - 2 * t);
        if (f <= MASK_HIDE_BELOW) expect(m[0]).toBe(0);
        else { expect(m[5]!).toBeCloseTo(before[i]![5]! * f, 5); expect(m[0]).toBe(before[i]![0]); }
      }
    });
    // the upload is partial: one range, covering only the touched chunk slices
    const attr = field.meshes[0]!.instanceMatrix;
    expect(attr.updateRanges.length).toBe(1);
    mask.clear(0);
    field.sync(chunks);
    expect(written(field, inst.length).map((m) => Array.from(m))).toEqual(before.map((m) => Array.from(m)));
  });

  it('a flatten disc (floor 0.2) scales height only; classes not in the disc are untouched', () => {
    const { field, rocks, chunks, inst, root } = zone();
    const mask = scatterMaskFor(root);
    const rocksBefore = written(rocks, 50);
    mask.set(3, 0.25, 0.25, 0.5, 1.3, 0.2, COVER.ground);
    field.sync(chunks); rocks.sync(chunks);
    const i = inst.findIndex((it) => it.x === 0.25 && it.z === 0.25);
    const m = field.writtenMatrix(i, new Float32Array(16))!;
    const orig = new Float32Array(16); orig.set([Math.cos(0.3), 0, -Math.sin(0.3), 0, 0, 1, 0, 0, Math.sin(0.3), 0, Math.cos(0.3), 0, 0.25, 0, 0.25, 1]);
    expect(m[5]).toBeCloseTo(0.2, 6);                           // height × 0.2
    expect(m[0]).toBeCloseTo(orig[0]!, 6);                      // width untouched
    expect(written(rocks, 50).map((x) => Array.from(x))).toEqual(rocksBefore.map((x) => Array.from(x)));   // large ≠ ground
    expect(MASK_HIDE_BELOW).toBeLessThan(0.2);
  });

  it('re-applies after a chunk rewrite (tier / frustum change) and nothing is allocated in steady syncs', () => {
    const { field, chunks, inst, root } = zone();
    const mask = scatterMaskFor(root);
    mask.set(0, 0, 0, 3, 5, 0, COVER.ground);
    field.sync(chunks);
    chunks.generation++;                                        // as a camera move does
    field.sync(chunks);
    const i = inst.findIndex((it) => it.x === 0.25 && it.z === 0.25);
    expect(field.writtenMatrix(i, new Float32Array(16))![0]).toBe(0);
    const heapish = (field as unknown as { spare: unknown[] }).spare.length;
    for (let k = 0; k < 100; k++) field.sync(chunks);        // unchanged: early return
    expect((field as unknown as { spare: unknown[] }).spare.length).toBe(heapish);
    expect(new ScatterMask().count).toBe(0);
  });
});

describe('T1 Pillar 7: the arena clears the ground cover and the props in its ring for its duration', () => {
  it('dress hides grass / props inside the ring through the zone mask; the root, its children and the lights stay; undress restores', async () => {
    const { root, field, rocks, chunks, inst, pg } = zone();
    const { stage, scene, lib } = await stageFor(root);
    const cut = new PropCutaway(); cut.setRoot(root);
    stage.setGroundCover(scatterMaskFor(root), cut);
    const children = [...root.children];
    const lights = lightIds(scene);
    const grassBefore = written(field, inst.length);
    const indexBefore = Array.from(pg.getIndex()!.array);
    stage.dress({ x: 0, z: 0 }, 'grove', ['p1']);
    for (let i = 0; i < 40; i++) stage.update(16, 16);
    field.sync(chunks); rocks.sync(chunks);
    const g = written(field, inst.length);
    inst.forEach((it, i) => { if (Math.hypot(it.x, it.z) < STAGE.coverHideM - 0.01) expect(g[i]![0]).toBe(0); });
    const idx = Array.from(pg.getIndex()!.array);
    expect(idx.slice(0, 3)).toEqual([0, 0, 0]);                  // the post inside the ring: degenerate
    expect(idx.slice(3)).toEqual([3, 4, 5]);                     // the one at 20 m: untouched
    expect(root.children).toEqual(children);                     // Pillar 7: nothing added / removed under the zone root
    expect(lightIds(scene)).toEqual(lights);                     // the light list is unchanged
    stage.undress(400);
    for (let i = 0; i < 40; i++) stage.update(16, 16);
    field.sync(chunks); rocks.sync(chunks);
    expect(written(field, inst.length).map((m) => Array.from(m))).toEqual(grassBefore.map((m) => Array.from(m)));
    expect(Array.from(pg.getIndex()!.array)).toEqual(indexBefore);
    expect(cut.cuts).toBe(0);
    expect(root.children).toEqual(children);
    lib.disposeAll();
  });
});

describe('T3 creature reveal', () => {
  const desc = (id: string): SpriteDescriptor => {
    const f = { atlas: 'a-001', rect: [0, 0.5, 0.5, 1] as const, px: [0, 0, 1024, 1024] as const, footV: 0.08, aspect: 1 };
    return { id, front: f, back: f, heightM: 1.376, types: ['Grass'], variant: 'normal', isAlpha: false };
  };

  it('flattens the grass round shown creatures near the focus, not round distant or hidden ones; stable slots', async () => {
    const { root, field, chunks, inst } = zone();
    const scene = new Group(); scene.add(root);
    (scene as unknown as { isScene: boolean }).isScene = true;
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    const near = pool.acquire(desc('near')); near.setPosition(2.25, 0, 2.25); scene.add(near.object);
    const far = pool.acquire(desc('far')); far.setPosition(REVEAL.rangeM + 6, 0, 0); scene.add(far.object);
    const hidden = pool.acquire(desc('hidden')); hidden.setPosition(-3.75, 0, -3.75); scene.add(hidden.object); hidden.object.visible = false;
    const focus = new Vector3(0, 0, 0);
    const reveal = new GroundCoverReveal(pool, () => focus);
    const mask = scatterMaskFor(root);
    reveal.setMask(mask);
    reveal.update(REVEAL.refreshMs);
    expect(reveal.revealed).toBe(1);
    field.sync(chunks);
    const at = (x: number, z: number): Float32Array => field.writtenMatrix(inst.findIndex((it) => it.x === x && it.z === z), new Float32Array(16))!;
    expect(at(2.25, 2.25)[5]).toBeCloseTo(REVEAL.floor, 6);      // under the near creature: flattened to the floor
    expect(at(-3.75, -3.75)[5]).toBeCloseTo(1, 6);              // the hidden creature (an engaged spawn): grass stays
    expect(at(12.25, 0.25)[5]).toBeCloseTo(1, 6);
    const gen = mask.generation;
    reveal.update(REVEAL.refreshMs);                             // nothing moved: no mask change, no rewrite
    expect(mask.generation).toBe(gen);
    focus.set(40, 0, 0);                                         // the player walks away: the grass closes again
    reveal.update(REVEAL.refreshMs);
    field.sync(chunks);
    expect(at(2.25, 2.25)[5]).toBeCloseTo(1, 6);
    reveal.dispose();
  });
});

describe('prop cutaway (M2-battle-8)', () => {
  it('non-indexed geometry: triangles inside the disc collapse onto their first vertex; restore is exact', () => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 10, 0, 0, 11, 0, 0, 10, 1, 0]), 3));
    const m = new Mesh(g, new Material()); m.name = 'ewa:props:1:n:lod1';
    const root = new Group(); root.add(m); root.updateMatrixWorld(true);
    const before = Array.from(g.getAttribute('position').array);
    const cut = new PropCutaway(); cut.setRoot(root);
    cut.hide(0, 0, 0, 2);
    const p = Array.from(g.getAttribute('position').array);
    expect(p.slice(0, 9)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(p.slice(9)).toEqual(before.slice(9));
    cut.restore(0);
    expect(Array.from(g.getAttribute('position').array)).toEqual(before);
  });
});
