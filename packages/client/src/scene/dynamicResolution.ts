/**
 * Dynamic resolution (Settings › Graphics, performance addition 2026-10-27): steps the drawing buffer's scale down while
 * the GPU misses the frame budget and back up when it keeps it, on top of the user's render scale. Pure; World3D feeds
 * it one sample per drawn frame and applies `scale` through the renderer's pixel ratio.
 *
 * - The signal is the interval between drawn frames (what the player sees), judged over a window of `WINDOW` frames.
 *   A slow window steps down only when the main thread is not the bottleneck (its tick took under `CPU_SHARE` of the
 *   interval): a smaller buffer does not help a CPU-bound frame.
 * - Under vsync a frame that keeps its budget shows exactly the budget, so headroom cannot be seen: the scale tries a
 *   step up after `UP_WAIT_MS` of good windows. A step up that is followed by a step down within `UP_FAIL_MS` doubles
 *   that wait (up to `UP_WAIT_MAX_MS`), so a GPU that sits between two steps settles on the lower one instead of
 *   bouncing. Each change re-allocates the post targets, so changes are at least `CHANGE_GAP_MS` apart.
 */

/** Scales of the requested pixel ratio, best first. */
export const DYN_RES_STEPS: readonly number[] = Object.freeze([1, 0.85, 0.75, 0.65, 0.55]);

const WINDOW = 30;
const SLOW = 1.12;
const GOOD = 1.04;
const CPU_SHARE = 0.8;
const CHANGE_GAP_MS = 600;
const UP_WAIT_MS = 2500;
const UP_WAIT_MAX_MS = 40_000;
const UP_FAIL_MS = 4000;
/** A gap this long (a hidden tab, a load) is not a frame. */
const MAX_INTERVAL_MS = 250;

export class DynamicResolution {
  private level = 0;
  private n = 0;
  private intervalSum = 0;
  private cpuSum = 0;
  private lastChange = -Infinity;
  private lastUp = -Infinity;
  private upWait = UP_WAIT_MS;

  /** The current factor on the requested pixel ratio. */
  get scale(): number {
    return DYN_RES_STEPS[this.level]!;
  }

  /** Back to full scale with a fresh window (switched off, a quality change). */
  reset(): void {
    this.level = 0;
    this.upWait = UP_WAIT_MS;
    this.lastUp = -Infinity;
    this.clearWindow();
  }

  /**
   * One drawn frame: `intervalMs` since the previous one, `cpuMs` the main thread's tick, `budgetMs` the frame budget
   * (1000 / the target rate). True when `scale` changed.
   */
  sample(nowMs: number, intervalMs: number, cpuMs: number, budgetMs: number): boolean {
    if (!(intervalMs > 0) || intervalMs > MAX_INTERVAL_MS) return false;
    // one hitch must not decide a window
    this.intervalSum += Math.min(intervalMs, budgetMs * 3);
    this.cpuSum += cpuMs;
    if (++this.n < WINDOW) return false;
    const interval = this.intervalSum / this.n;
    const cpu = this.cpuSum / this.n;
    this.clearWindow();
    if (nowMs - this.lastChange < CHANGE_GAP_MS) return false;
    if (interval > budgetMs * SLOW) {
      if (this.level >= DYN_RES_STEPS.length - 1 || cpu > interval * CPU_SHARE) return false;
      if (nowMs - this.lastUp < UP_FAIL_MS) this.upWait = Math.min(UP_WAIT_MAX_MS, this.upWait * 2);
      this.level++;
      this.lastChange = nowMs;
      return true;
    }
    if (interval <= budgetMs * GOOD && this.level > 0 && nowMs - this.lastChange >= this.upWait) {
      this.level--;
      this.lastChange = nowMs;
      this.lastUp = nowMs;
      return true;
    }
    return false;
  }

  private clearWindow(): void {
    this.n = 0;
    this.intervalSum = 0;
    this.cpuSum = 0;
  }
}
