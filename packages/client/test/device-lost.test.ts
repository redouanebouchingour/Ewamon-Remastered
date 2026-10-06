/**
 * Phase E6: a lost GPU device → World3D tears the renderer down, builds a new one and reloads the current zone at the
 * player's position with the boot overlay up; the session is never touched. The device is a fake whose `lost` promise
 * the test resolves; it is wired exactly as render wires it (`watchDeviceLost` → `onDeviceLost`) into the client's
 * `DeviceRecovery` (World3D's hooks are stood in by a fake world that records what happens).
 */
import { describe, expect, it } from 'vitest';
import { watchDeviceLost } from '@ewa/render';
import type { DeviceLostInfo } from '@ewa/render';
import { DEVICE_RECOVERY, DeviceRecovery } from '../src/scene/deviceRecovery';

interface FakeDevice { lost: Promise<{ reason?: string; message?: string }>; lose(reason: string, message: string): void; destroy(): void }

function fakeDevice(): FakeDevice {
  let resolve!: (i: { reason?: string; message?: string }) => void;
  const lost = new Promise<{ reason?: string; message?: string }>((r) => { resolve = r; });
  return { lost, lose: (reason, message) => resolve({ reason, message }), destroy: () => resolve({ reason: 'destroyed', message: '' }) };
}

const flush = async (): Promise<void> => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

/** A stand-in for World3D: one renderer per fake device, the zone the director loaded, the overlay, the session. */
class FakeWorld {
  readonly log: string[] = [];
  readonly devices: FakeDevice[] = [];
  overlay: { label: string | null; error: string | null } = { label: null, error: null };
  zone: { id: string; x: number; z: number } | null = null;
  readonly session = { room: 'zone:mirevale', disconnects: 0 };
  /** what the server has now: the player walked to (58, 0) before the loss */
  readonly server = { zone: 'mirevale', x: 58, z: 0 };
  failNextBuilds = 0;
  disposed = false;
  readonly recovery: DeviceRecovery;

  constructor() {
    this.recovery = new DeviceRecovery({
      teardown: () => { this.log.push(`teardown r${this.devices.length}`); this.zone = null; this.devices.at(-1)?.destroy(); },
      rebuild: async () => {
        if (this.failNextBuilds > 0) { this.failNextBuilds--; throw new Error('requestAdapter() returned null'); }
        if (this.disposed) return false;
        this.createRenderer();
        return true;
      },
      reload: async () => { this.zone = { id: this.server.zone, x: this.server.x, z: this.server.z }; this.log.push(`loadZone ${this.zone.id} @${this.zone.x},${this.zone.z}`); this.overlay = { label: null, error: null }; },
      overlay: (label, error) => { this.overlay = { label, error: error ?? null }; this.log.push(error !== undefined ? `error` : `overlay`); },
      wait: async () => undefined,
      now: () => 0,
      log: () => undefined,
    });
  }

  /** render's createRenderer: subscribes the device's `lost` to `onDeviceLost`. */
  createRenderer(): void {
    const d = fakeDevice();
    this.devices.push(d);
    this.log.push(`createRenderer r${this.devices.length}`);
    const disposedAt = this.devices.length;
    watchDeviceLost(d, (info: DeviceLostInfo) => void this.recovery.onLost(info), () => this.devices.length !== disposedAt);
  }
}

describe('E6 GPU device lost → renderer recreated, zone reloaded, session kept', () => {
  it('a lost device rebuilds the renderer and reloads the current zone at the current position behind the overlay', async () => {
    const w = new FakeWorld();
    w.createRenderer();
    w.zone = { id: 'mirevale', x: 0, z: 6 };
    w.devices[0]!.lose('unknown', 'D3D12: device removed');
    await flush();
    expect(w.log).toEqual(['createRenderer r1', 'overlay', 'teardown r1', 'createRenderer r2', 'loadZone mirevale @58,0']);
    expect(w.zone).toEqual({ id: 'mirevale', x: 58, z: 0 });
    expect(w.recovery.recoveries).toBe(1);
    expect(w.session).toEqual({ room: 'zone:mirevale', disconnects: 0 });
    // the old device's `destroyed` resolution after the teardown is not a second loss
    expect(w.devices.length).toBe(2);
  });

  it('the overlay label is up while the renderer is rebuilt', async () => {
    const w = new FakeWorld();
    w.createRenderer();
    let labelDuringBuild: string | null = null;
    const orig = w.createRenderer.bind(w);
    w.createRenderer = () => { labelDuringBuild = w.overlay.label; orig(); };
    w.devices[0]!.lose('unknown', 'reset');
    await flush();
    expect(labelDuringBuild).toBe(DEVICE_RECOVERY.label);
    expect(w.overlay.label).toBeNull();
  });

  it('retries a rebuild that throws (the GPU process restarting), then recovers', async () => {
    const w = new FakeWorld();
    w.createRenderer();
    w.failNextBuilds = 2;
    w.devices[0]!.lose('unknown', 'reset');
    await flush();
    expect(w.recovery.recoveries).toBe(1);
    expect(w.zone?.id).toBe('mirevale');
  });

  it('gives up with an error overlay after maxAttempts failed rebuilds', async () => {
    const w = new FakeWorld();
    w.createRenderer();
    w.failNextBuilds = DEVICE_RECOVERY.maxAttempts;
    w.devices[0]!.lose('unknown', 'reset');
    await flush();
    expect(w.overlay.error).toBe(DEVICE_RECOVERY.giveUp);
    expect(w.zone).toBeNull();
  });

  it('a second loss while recovering is folded in (one more rebuild), and a renderer disposed by the world stops it', async () => {
    const w = new FakeWorld();
    w.createRenderer();
    const p1 = w.recovery.onLost({ reason: 'unknown', message: 'a' });
    expect(await w.recovery.onLost({ reason: 'unknown', message: 'b' })).toBe('merged');
    expect(await p1).toBe('recovered');
    expect(w.log.filter((l) => l.startsWith('createRenderer')).length).toBe(3);
    w.disposed = true;
    expect(await w.recovery.onLost({ reason: 'unknown', message: 'c' })).toBe('disposed');
  });

  it('losses faster than the window allows end in the error overlay', async () => {
    const w = new FakeWorld();
    w.createRenderer();
    for (let i = 0; i <= DEVICE_RECOVERY.maxLosses; i++) await w.recovery.onLost({ reason: 'unknown', message: String(i) });
    expect(w.overlay.error).toBe(DEVICE_RECOVERY.giveUp);
  });
});
