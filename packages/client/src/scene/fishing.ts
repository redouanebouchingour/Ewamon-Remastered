/**
 * Phase D9 — the Old Rod's timing prompt, pure (timers and randomness injected).
 *
 * `start()` casts: 'waiting' for a random 1.2–3.2 s, then 'bite' — the '!' window (700 ms; 1 000 ms under reduced
 * motion, where nothing on the overlay moves to catch the eye). `press()` during the window lands the catch
 * (`onCatch`: World3D sends `fish { angle }`, and the server rolls what bit); a press while waiting is too early, no
 * press in the window too late — both 'missed' for 900 ms, then idle. `cancel()` (Escape, a battle, a zone change)
 * drops everything silently. One cast at a time.
 */

export const FISHING = Object.freeze({ waitMinMs: 1200, waitMaxMs: 3200, biteMs: 700, reducedBiteMs: 1000, missedMs: 900 });

export type FishingPhase = 'idle' | 'waiting' | 'bite' | 'missed';
export type FishingMiss = 'early' | 'late';

export interface FishingDeps {
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** [0, 1) */
  random(): number;
  reduced(): boolean;
  onPhase(phase: FishingPhase): void;
  onCatch(): void;
  onMiss(why: FishingMiss): void;
}

export class FishingController {
  private current: FishingPhase = 'idle';
  private timer: unknown = null;

  constructor(private readonly d: FishingDeps) {}

  get phase(): FishingPhase {
    return this.current;
  }

  get active(): boolean {
    return this.current !== 'idle';
  }

  /** Casts the line; false while a cast is already in progress. */
  start(): boolean {
    if (this.current !== 'idle') return false;
    const wait = FISHING.waitMinMs + Math.floor(this.d.random() * (FISHING.waitMaxMs - FISHING.waitMinMs));
    this.set('waiting');
    this.after(wait, () => {
      this.set('bite');
      this.after(this.d.reduced() ? FISHING.reducedBiteMs : FISHING.biteMs, () => this.miss('late'));
    });
    return true;
  }

  /** The reel key (E / Enter / Space / a click on the prompt). */
  press(): void {
    if (this.current === 'waiting') {
      this.miss('early');
      return;
    }
    if (this.current !== 'bite') return;
    this.clear();
    this.set('idle');
    this.d.onCatch();
  }

  cancel(): void {
    if (this.current === 'idle') return;
    this.clear();
    this.set('idle');
  }

  private miss(why: FishingMiss): void {
    this.clear();
    this.set('missed');
    this.d.onMiss(why);
    this.after(FISHING.missedMs, () => this.set('idle'));
  }

  private after(ms: number, fn: () => void): void {
    this.clear();
    this.timer = this.d.setTimer(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  private clear(): void {
    if (this.timer !== null) this.d.clearTimer(this.timer);
    this.timer = null;
  }

  private set(p: FishingPhase): void {
    if (p === this.current) return;
    this.current = p;
    this.d.onPhase(p);
  }
}

/** The first water sample along `angle` from (x, z) within `reach` (0.5 m steps), or null. */
export function waterAhead(isWater: (x: number, z: number) => boolean, x: number, z: number, angle: number, reach: number): { readonly x: number; readonly z: number } | null {
  const dx = Math.sin(angle);
  const dz = Math.cos(angle);
  for (let d = 0.5; d <= reach + 1e-9; d += 0.5) {
    const wx = x + dx * d;
    const wz = z + dz * d;
    if (isWater(wx, wz)) return { x: wx, z: wz };
  }
  return null;
}
