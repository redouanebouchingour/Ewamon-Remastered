// @vitest-environment jsdom
/**
 * The WebGL2 probe runs once and frees its context. The shell calls `worldCapability()` on every render; a live probe
 * context per call pushed the browser past its context cap, which drops the oldest context: the world's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('worldCapability on the WebGL2 fallback', () => {
  it('probes one context, releases it, and caches the answer', async () => {
    expect('gpu' in navigator).toBe(false);
    const loseContext = vi.fn();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => ({ getExtension: () => ({ loseContext }) }) as unknown as WebGL2RenderingContext);
    const { worldCapability } = await import('../src/scene/worldHost');
    for (let i = 0; i < 40; i++) expect(worldCapability()).toBe(true);
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('caches a missing WebGL2 too', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    const { worldCapability } = await import('../src/scene/worldHost');
    expect(worldCapability()).toBe(false);
    expect(worldCapability()).toBe(false);
    expect(getContext).toHaveBeenCalledTimes(1);
  });
});
