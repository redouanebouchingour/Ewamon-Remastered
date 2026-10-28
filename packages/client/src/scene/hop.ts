/**
 * The jump key (SPEC §20.4.5): a local cosmetic hop, 2 m high over 780 ms (the 0.6 m /
 * 420 ms draft's gravity, ≈ 27 m/s², raised on playtest), never on the wire. The feet follow a
 * parabola through render's actor lift (the same channel a glide uses; the camera rides it); the pose underneath keeps predicting, so a hop
 * while walking carries forward. A press mid-hop is ignored. Allocation-free.
 */
export const HOP = Object.freeze({ heightM: 2, ms: 780 });

export class Hop {
  private startedAt: number | null = null;

  /** true when a hop starts (false mid-hop) */
  start(now: number): boolean {
    if (this.active(now)) return false;
    this.startedAt = now;
    return true;
  }

  active(now: number): boolean {
    return this.startedAt !== null && now - this.startedAt < HOP.ms;
  }

  /** the feet's height above the ground at `now` (m): 4h·t(1−t), 0 outside a hop */
  lift(now: number): number {
    if (this.startedAt === null) return 0;
    const t = (now - this.startedAt) / HOP.ms;
    if (!(t > 0 && t < 1)) {
      if (t >= 1) this.startedAt = null;
      return 0;
    }
    return 4 * HOP.heightM * t * (1 - t);
  }

  cancel(): void {
    this.startedAt = null;
  }
}
