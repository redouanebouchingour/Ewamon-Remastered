import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeshPhysicalNodeMaterial, Texture } from 'three/webgpu';
import { createMaterialLibraryWith } from '../src/materials/library.js';
import { SURFACE_IDS, SURFACES } from '../src/materials/surfaces.js';
import { createWaterBackdrop, setWaterBackdrop, waterBackdropOn } from '../src/materials/waterBackdrop.js';
import { QUALITY_PROFILES } from '../src/quality.js';

afterEach(() => { vi.restoreAllMocks(); });

const waterIds = SURFACE_IDS.filter((id) => SURFACES[id].cls === 'water');

async function library() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});   // "materials manifest unavailable": no manifest in tests
  const lib = createMaterialLibraryWith({ baseUrl: '/m/', source: { load: async () => new Texture() }, fetchJson: async () => { throw new Error('none'); } });
  await lib.ready;
  return lib;
}

describe('water backdrop (IMPLEMENTATION-NOTES "Water backdrop without transmission")', () => {
  it('water materials take three\'s backdrop hook, not its transmission path, and stay opaque', async () => {
    const lib = await library();
    expect(waterIds.length).toBeGreaterThan(0);
    for (const id of waterIds) {
      const m = lib.get(id) as MeshPhysicalNodeMaterial;
      expect(m).toBeInstanceOf(MeshPhysicalNodeMaterial);
      expect(m.transmission).toBe(0);              // no `viewportMipTexture` copy + bicubic sample in PhysicalLightingModel
      expect(m.transmissionNode).toBeNull();
      expect(m.backdropNode).not.toBeNull();
      expect(m.backdropAlphaNode).not.toBeNull();
      expect(m.transparent).toBe(false);
      expect(m.ior).toBeCloseTo(1.333, 6);
    }
    lib.disposeAll();
  });

  it('every water material reads the library\'s one shared copy', async () => {
    const lib = await library();
    const bd = lib.uniforms.waterBackdrop!;
    expect(bd).toBeDefined();
    const bases = new Set<unknown>();
    for (const id of waterIds) {
      (lib.get(id).backdropNode as unknown as { traverse(cb: (n: { isOutputTextureNode?: boolean; getBase(): unknown }) => void): void })
        .traverse((n) => { if (n.isOutputTextureNode === true) bases.add(n.getBase()); });
    }
    expect([...bases]).toEqual([bd.node]);
    lib.disposeAll();
  });

  it('the switch writes a uniform and a flag, and an off copy never reaches copyFramebufferToTexture', () => {
    const bd = createWaterBackdrop();
    expect(waterBackdropOn(bd)).toBe(true);
    expect(bd.weight.value).toBe(1);
    const copy = vi.fn();
    const frame = { renderer: { getRenderTarget: () => null, getCanvasTarget: () => null, getDrawingBufferSize: (v: { set(w: number, h: number): unknown }) => v.set(64, 32), copyFramebufferToTexture: copy } };
    const clone = bd.node.sample(bd.node.uvNode!);   // what the graph holds: a clone whose base carries the switch
    setWaterBackdrop(bd, false);
    expect(bd.weight.value).toBe(0);
    clone.updateBefore(frame as never);
    expect(copy).not.toHaveBeenCalled();
    setWaterBackdrop(bd, true);
    clone.updateBefore(frame as never);
    expect(copy).toHaveBeenCalledTimes(1);
  });

  it('only high shows the backdrop', () => {
    expect(QUALITY_PROFILES.high.waterBackdrop).toBe(true);
    expect(QUALITY_PROFILES.medium.waterBackdrop).toBe(false);
    expect(QUALITY_PROFILES.low.waterBackdrop).toBe(false);
  });
});
