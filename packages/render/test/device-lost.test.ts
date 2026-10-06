/**
 * Phase E6: `GPUDevice.lost` → the renderer's `onDeviceLost` callback (`watchDeviceLost`, renderer.ts). A fake device
 * whose `lost` promise the test resolves stands in for WebGPU (node has no GPU).
 */
import { describe, expect, it } from 'vitest';
import { watchDeviceLost, type DeviceLostInfo } from '../src/renderer.js';

interface LostInfo { reason?: string | null; message?: string }

function fakeDevice(): { device: { lost: Promise<LostInfo> }; lose(info: LostInfo): void } {
  let resolve!: (i: LostInfo) => void;
  const lost = new Promise<LostInfo>((r) => { resolve = r; });
  return { device: { lost }, lose: (i) => resolve(i) };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('E6 watchDeviceLost', () => {
  it('calls back once with the reason and message when the device is lost', async () => {
    const f = fakeDevice();
    const seen: DeviceLostInfo[] = [];
    expect(watchDeviceLost(f.device, (i) => seen.push(i), () => false)).toBe(true);
    await flush();
    expect(seen).toEqual([]);
    f.lose({ reason: 'unknown', message: 'D3D12 device removed' });
    await flush();
    expect(seen).toEqual([{ reason: 'unknown', message: 'D3D12 device removed' }]);
  });

  it('ignores the loss its own dispose causes (reason "destroyed")', async () => {
    const f = fakeDevice();
    const seen: DeviceLostInfo[] = [];
    watchDeviceLost(f.device, (i) => seen.push(i), () => false);
    f.lose({ reason: 'destroyed', message: '' });
    await flush();
    expect(seen).toEqual([]);
  });

  it('ignores a loss that resolves after the renderer was disposed', async () => {
    const f = fakeDevice();
    let disposed = false;
    const seen: DeviceLostInfo[] = [];
    watchDeviceLost(f.device, (i) => seen.push(i), () => disposed);
    disposed = true;
    f.lose({ reason: 'unknown', message: 'late' });
    await flush();
    expect(seen).toEqual([]);
  });

  it('fills a missing reason / message', async () => {
    const f = fakeDevice();
    const seen: DeviceLostInfo[] = [];
    watchDeviceLost(f.device, (i) => seen.push(i), () => false);
    f.lose({});
    await flush();
    expect(seen).toEqual([{ reason: null, message: 'GPU device lost' }]);
  });

  it('does not subscribe without a lost promise (WebGL2 backend, no device)', () => {
    expect(watchDeviceLost(undefined, () => undefined, () => false)).toBe(false);
    expect(watchDeviceLost({}, () => undefined, () => false)).toBe(false);
  });
});
