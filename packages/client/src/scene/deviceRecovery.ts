/**
 * Phase E6 — recovery from a lost GPU device (render `RendererOptions.onDeviceLost`, fed by `GPUDevice.lost`).
 *
 * A lost device cannot be revived: every buffer, texture and pipeline of the old `WebGPURenderer` is gone. World3D
 * therefore tears down the renderer and everything bound to it (zone, sprite views, size observers), creates a new
 * renderer on the same canvas and re-runs the current zone's `director.loadZone` at the player's current position,
 * with the world-boot overlay up meanwhile. The React tree (GameCanvas stays mounted), the WorldSession (room, socket,
 * stores) and the battle controller are untouched — only the 3D side is rebuilt.
 *
 * This class is the ordering + retry policy (pure, tested with fakes in `test/device-lost.test.ts`); World3D supplies
 * the hooks. A loss during a recovery is folded into it; a rebuild that throws (the GPU process may still be
 * restarting) is retried after `retryMs`; after `maxAttempts` failed rebuilds, or `maxLosses` losses inside
 * `lossWindowMs`, the overlay shows an error that asks for a reload.
 */
import type { DeviceLostInfo } from '@ewa/render';

export interface DeviceRecoveryHooks {
  /** Dispose the dead renderer and everything bound to it. Must not throw (wrap three calls on a dead device). */
  teardown(): void;
  /** Create a new renderer and its views; resolves false when the world was disposed meanwhile (stop quietly). */
  rebuild(): Promise<boolean>;
  /** Re-run the current zone's load at the player's current position (no-op when no room is joined yet). */
  reload(): Promise<void>;
  /** The boot overlay: a label while recovering (the world lifts it on the reloaded zone's first frame); `error` = give up. */
  overlay(label: string | null, error?: string): void;
  /** Wait before a retry (tests pass a resolved promise). */
  wait(ms: number): Promise<void>;
  /** Milliseconds clock (loss-rate window). */
  now(): number;
  /** Diagnostics (console in the app). */
  log(message: string): void;
}

export const DEVICE_RECOVERY = Object.freeze({
  /** Rebuild attempts per loss before giving up. */
  maxAttempts: 3,
  /** Delay between rebuild attempts (the browser restarts the GPU process). */
  retryMs: 1000,
  /** More than this many losses inside `lossWindowMs` → give up (a GPU that keeps resetting). */
  maxLosses: 3,
  lossWindowMs: 60_000,
  label: 'Restoring the renderer (the graphics device was reset)',
  giveUp: 'The graphics device keeps resetting. Reload the page to continue.',
});

export type RecoveryOutcome = 'recovered' | 'disposed' | 'failed' | 'merged';

export class DeviceRecovery {
  private running: Promise<RecoveryOutcome> | null = null;
  private again = false;
  private readonly losses: number[] = [];
  /** Completed recoveries (dev diagnostics, tests). */
  recoveries = 0;

  constructor(private readonly h: DeviceRecoveryHooks, private readonly cfg = DEVICE_RECOVERY) {}

  get recovering(): boolean { return this.running !== null; }

  /** The renderer's `onDeviceLost`. A loss while a recovery runs makes it start over once it settles ('merged'). */
  onLost(info: DeviceLostInfo): Promise<RecoveryOutcome> {
    this.h.log(`GPU device lost (${info.reason ?? 'no reason'}): ${info.message}`);
    const t = this.h.now();
    this.losses.push(t);
    while (this.losses.length > 0 && t - this.losses[0]! > this.cfg.lossWindowMs) this.losses.shift();
    if (this.running !== null) { this.again = true; return Promise.resolve('merged'); }
    this.running = this.run().finally(() => { this.running = null; });
    return this.running;
  }

  private async run(): Promise<RecoveryOutcome> {
    for (;;) {
      this.again = false;
      if (this.losses.length > this.cfg.maxLosses) { this.h.teardown(); this.h.overlay(null, this.cfg.giveUp); return 'failed'; }
      this.h.overlay(this.cfg.label);
      this.h.teardown();
      let built: boolean | null = null;
      for (let attempt = 1; attempt <= this.cfg.maxAttempts && built === null; attempt++) {
        try {
          built = await this.h.rebuild();
        } catch (e) {
          this.h.log(`renderer rebuild ${attempt}/${this.cfg.maxAttempts} failed: ${e instanceof Error ? e.message : String(e)}`);
          if (attempt < this.cfg.maxAttempts) await this.h.wait(this.cfg.retryMs);
        }
      }
      if (built === null) { this.h.overlay(null, this.cfg.giveUp); return 'failed'; }
      if (!built) return 'disposed';
      if (this.again) continue;          // the new device was lost while it was being created: start over
      await this.h.reload();
      if (this.again) continue;
      this.recoveries++;
      return 'recovered';
    }
  }
}
