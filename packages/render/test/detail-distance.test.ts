import { afterEach, describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, Material, Vector3 } from 'three/webgpu';
import { DETAIL_DISTANCE_M, chunkInDetail, detailState, setDetailFocus, setDetailRadius, setLodScale } from '../src/zone/detail.js';
import { ChunkSet, ScatterField, type Instance } from '../src/zone/scatter.js';
import { chunkGrid } from '../src/zone/lod.js';
import { QUALITY_PROFILES } from '../src/quality.js';

afterEach(() => { setDetailRadius(Infinity); setDetailFocus(0, 0); setLodScale(1); });

describe('detail distance', () => {
  it('maps the settings to 4 / 8 / 16 m and unlimited', () => {
    expect(DETAIL_DISTANCE_M).toEqual({ close: 4, medium: 8, far: 16, max: Infinity });
  });

  it('writes the shader field: unlimited is a finite far radius', () => {
    setDetailRadius(8);
    expect(detailState.uniform.value.z).toBe(8);
    setDetailRadius(Infinity);
    expect(detailState.uniform.value.z).toBeGreaterThan(1e5);
    setDetailRadius(2);
    expect(detailState.uniform.value.w).toBe(1);   // the fade band is at most half the radius
  });

  it('a chunk is in range when any of it is within the radius of the focus', () => {
    setDetailFocus(0, 0);
    setDetailRadius(4);
    expect(chunkInDetail(0, 0, 16)).toBe(true);
    expect(chunkInDetail(19, 0, 16)).toBe(true);    // its edge is 3 m away
    expect(chunkInDetail(21, 0, 16)).toBe(false);   // 5 m
    setDetailRadius(Infinity);
    expect(chunkInDetail(1000, 1000, 16)).toBe(true);
  });

  it('ChunkSet flags chunks out of range and bumps its generation when one flips', () => {
    const set = new ChunkSet(chunkGrid(128));
    const near = set.at(0, 0); const far = set.at(60, 60);
    set.update(new Vector3(0, 20, 0), null);
    const g0 = set.generation;
    expect(near.detail && far.detail).toBe(true);
    setDetailRadius(4);
    set.update(new Vector3(0, 20, 0), null);
    expect(near.detail).toBe(true);
    expect(far.detail).toBe(false);
    expect(set.generation).toBeGreaterThan(g0);
  });

  it('the LOD scale pulls the tiers in; high keeps the SPEC distances', () => {
    expect(QUALITY_PROFILES.high.lodScale).toBe(1);
    expect(QUALITY_PROFILES.low.lodScale).toBeLessThan(QUALITY_PROFILES.medium.lodScale);
    const set = new ChunkSet(chunkGrid(256));
    const c = set.at(40, 0);   // centre (48, 16): ~50 m from a camera at the origin
    set.update(new Vector3(0, 0, 0), null);
    expect(c.tier).toBe(1);
    setLodScale(0.5);
    set.update(new Vector3(0, 0, 0), null);
    expect(c.tier).toBe(2);
  });

  it('foliage takes its tier per instance from the focus, and returns to the chunk tiers at max', () => {
    const geo = (): BufferGeometry => { const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(new Float32Array(9), 3)); return g; };
    const part = (): { geometry: BufferGeometry; cls: 1; casts: boolean } => ({ geometry: geo(), cls: 1, casts: false });
    const chunks = new ChunkSet(chunkGrid(128));
    const inst: Instance[] = [0, 3, 6, 10, 20].map((x) => ({ x, y: 0, z: 0.5, yaw: 0, scale: 1, tint: 0 }));
    const field = new ScatterField({ name: 'bush', tiers: [[part()], [part()], [part()], null], materials: [new Material()], castShadow: false, shadowTierLimit: 0 }, inst, chunks, new Group(), []);
    const drawn = (): number[] => [0, 1, 2].map((t) => field.meshes.filter((m) => m.userData.ewaScatterTier === t).reduce((a, m) => a + (m.visible ? m.instances : 0), 0));
    chunks.update(new Vector3(0, 20, 0), null);
    field.sync(chunks);
    expect(drawn()).toEqual([5, 0, 0]);
    setDetailFocus(0, 0);
    setDetailRadius(4);   // 0 and 3 m: lod0; 6 and 10 m: lod1; 20 m (past 4 × 4): lod2
    chunks.update(new Vector3(0, 20, 0), null);
    field.sync(chunks);
    expect(drawn()).toEqual([2, 2, 1]);
    setDetailFocus(8, 0);   // the player walked: 6 and 10 m are now near
    field.sync(chunks);
    expect(drawn()).toEqual([2, 3, 0]);
    setDetailRadius(Infinity);
    chunks.update(new Vector3(0, 20, 0), null);
    field.sync(chunks);
    expect(drawn()).toEqual([5, 0, 0]);
  });
});
