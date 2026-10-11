/**
 * M3 independent review R-forgewall-2 (`forgewall/battle--47.39_5.08-full.png`: the uphill terrain crossed the ring
 * floor and buried the rope posts). A dressed ring levels a pad into the slope (`stage/terrainPad.ts`): no terrain
 * above the ring's seat inside the ring, curb, posts and pylons; the 0.45 m skirt closes the downhill side; the actors
 * stand on the cut ground; undressing writes the terrain back exactly.
 */
import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, Texture, Vector3 } from 'three/webgpu';
import { getHeightfield } from '@ewa/content';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { DioramaRig } from '../src/camera/rig.js';
import { createMaterialLibraryWith } from '../src/materials/library.js';
import { BillboardPool, type AtlasDecoder } from '../src/sprites/billboard.js';
import { VfxSystem } from '../src/stage/vfx.js';
import { CharacterPool } from '../src/stage/actors.js';
import { STAGE, Stage } from '../src/stage/battleStage.js';
import { TERRAIN_MESH_PREFIX, TerrainPad } from '../src/stage/terrainPad.js';
import { TerrainCollider } from '../src/terrain/collider.js';

/** A terrain chunk like terrain/mesh.ts builds (world positions, 0.5 m grid, indexed) from a height function. */
function chunk(x0: number, z0: number, size: number, h: (x: number, z: number) => number): Mesh {
  const n = Math.round(size / 0.5) + 1;
  const pos = new Float32Array(n * n * 3); const nrm = new Float32Array(n * n * 3);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c; const x = x0 + c * 0.5; const z = z0 + r * 0.5;
    pos[i * 3] = x; pos[i * 3 + 1] = h(x, z); pos[i * 3 + 2] = z;
    nrm[i * 3] = 0.3; nrm[i * 3 + 1] = 0.9; nrm[i * 3 + 2] = 0.1;
  }
  const idx: number[] = [];
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const a = r * n + c; idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1); }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nrm, 3));
  g.setIndex(idx);
  const m = new Mesh(g, new MeshBasicNodeMaterial());
  m.name = `${TERRAIN_MESH_PREFIX}0,0`;
  return m;
}

const slope = (x: number, z: number): number => 0.12 * x + 0.05 * z;

describe('R-forgewall-2: the terrain pad under a ring', () => {
  it('levels only what is above the seat inside `inner`, eases out by `outer`, and restores the terrain exactly', () => {
    const root = new Group();
    const m = chunk(-12, -12, 24, slope);
    root.add(m);
    root.updateMatrixWorld(true);
    const pos = m.geometry.getAttribute('position') as BufferAttribute;
    const before = (pos.array as Float32Array).slice();
    const nBefore = ((m.geometry.getAttribute('normal') as BufferAttribute).array as Float32Array).slice();
    const pad = new TerrainPad();
    pad.setRoot(root);
    const v0 = pos.version;
    pad.level(0, 0, 0, -0.1, 5, 7);
    expect(pos.version).toBeGreaterThan(v0);                       // uploaded
    const a = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const x = a[i * 3]!; const y = a[i * 3 + 1]!; const z = a[i * 3 + 2]!; const y0 = before[i * 3 + 1]!;
      const d = Math.hypot(x, z);
      expect(y).toBeLessThanOrEqual(y0 + 1e-6);                    // only ever lowered
      if (d <= 5) expect(y).toBeLessThanOrEqual(-0.1 + 1e-6);      // the pad
      if (d >= 7 || y0 <= -0.1) expect(y).toBeCloseTo(y0, 6);      // outside / below: untouched
      expect(pad.adjust(x, z, y0)).toBeCloseTo(y, 5);              // the actors' sampler agrees with the mesh
    }
    // a second pad composes; removing the first leaves the second cut
    pad.level(1, 6, 0, 0.2, 2, 3);
    pad.restore(0);
    for (let i = 0; i < pos.count; i++) {
      const x = a[i * 3]!; const z = a[i * 3 + 2]!; const y0 = before[i * 3 + 1]!;
      if (Math.hypot(x, z) <= 5 && Math.hypot(x - 6, z) > 3) expect(a[i * 3 + 1]).toBeCloseTo(y0, 6);
      if (Math.hypot(x - 6, z) <= 2) expect(a[i * 3 + 1]).toBeLessThanOrEqual(Math.max(0.2, Math.min(y0, 0.2)) + 1e-6);
    }
    pad.restore(1);
    expect(Array.from(a)).toEqual(Array.from(before));
    expect(Array.from((m.geometry.getAttribute('normal') as BufferAttribute).array as Float32Array)).toEqual(Array.from(nBefore));
    expect(pad.active).toBe(false);
    expect(pad.adjust(0, 0, 1.5)).toBe(1.5);
  });

  it('forgewall battle anchor (−47.39, 5.08): no terrain above the ring floor inside the rim, the skirt closes downhill, the trainer stands on the pad', async () => {
    const lib = createMaterialLibraryWith({ baseUrl: '/m/', source: { load: async () => new Texture() }, fetchJson: async () => { throw new Error('none'); } });
    await lib.ready;
    const scene = new Group();
    const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
    const decoder: AtlasDecoder = { decode: async (_url, crop) => ({ width: crop ? crop[2] : 2048, height: crop ? crop[3] : 2048, close: () => {} }) };
    const sprites = new BillboardPool({ decoder, camera: cam });
    const actors = new CharacterPool({ harvestLevel: lib.uniforms.harvestLevel, camera: cam, viewport: () => ({ w: 1280, h: 720 }) });
    const rig = new DioramaRig(cam, { effects: () => ALL_EFFECTS });
    const stage = new Stage({ parent: scene, sprites, vfx: new VfxSystem(), rig, actors, materials: lib, effects: () => ALL_EFFECTS, harvestLevel: () => 0, camera: cam, viewport: () => ({ w: 1280, h: 720 }) });
    const col = new TerrainCollider(getHeightfield('forgewall' as never));
    const cx = -47.39; const cz = 5.08;
    const root = new Group();
    const m = chunk(cx - 10, cz - 10, 20, (x, z) => col.sample(x, z));
    root.add(m);
    root.updateMatrixWorld(true);
    const pad = new TerrainPad();
    pad.setRoot(root);
    stage.setGround(col);
    stage.setGroundCover({ set: () => undefined, clear: () => undefined }, null, pad);
    stage.dress({ x: cx, z: cz }, 'forge', ['p1']);
    const seat = stage.arenaCenter.y;
    // the pre-fix seat (highest rim sample capped at centre + 0.4) left the uphill ground 0.3 m above the ring top
    let hiRim = -Infinity; let loRim = Infinity;
    for (let k = 0; k < 64; k++) {
      const ang = (k / 64) * Math.PI * 2;
      for (const r of [STAGE.ringRadius, STAGE.curbOuter]) {
        const g = col.sample(cx + Math.cos(ang) * r, cz + Math.sin(ang) * r);
        hiRim = Math.max(hiRim, g); loRim = Math.min(loRim, g);
      }
    }
    expect(hiRim - (col.sample(cx, cz) + STAGE.ringSkirt - 0.05 + STAGE.ringTop)).toBeGreaterThan(0.1);   // the slope is real
    expect(loRim).toBeGreaterThanOrEqual(seat - STAGE.ringSkirt - 0.02);          // the skirt reaches the downhill ground
    const a = (m.geometry.getAttribute('position') as BufferAttribute).array as Float32Array;
    let inside = 0;
    for (let i = 0; i < a.length / 3; i++) {
      const d = Math.hypot(a[i * 3]! - cx, a[i * 3 + 2]! - cz);
      if (d > STAGE.padInnerM) continue;
      inside++;
      expect(a[i * 3 + 1]).toBeLessThanOrEqual(seat + 1e-5);                       // no terrain inside the rim above the floor
    }
    expect(inside).toBeGreaterThan(300);
    // the trainer slot and every post stand on the cut ground (what the actor pool samples)
    const t = stage.trainerSpot(0, new Vector3());
    expect(pad.adjust(t.x, t.z, col.sample(t.x, t.z))).toBeLessThanOrEqual(seat + 1e-6);
    stage.undress(0);
    stage.update(16, 16);
    stage.update(16, 16);
    expect(pad.active).toBe(false);
    for (let i = 0; i < a.length / 3; i++) expect(a[i * 3 + 1]).toBeCloseTo(col.sample(a[i * 3]!, a[i * 3 + 2]!), 4);
  });
});
