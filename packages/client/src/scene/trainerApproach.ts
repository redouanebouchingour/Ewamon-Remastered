/**
 * Trainer sight, the client half (2026-10-20). The server's `trainerSpotted` holds the player; this plays the old games'
 * approach on the trainer's director actor: the "!" card over its head (actor emote 4) while it turns to the player, a
 * beat, then it walks up to them. `onArrive` hands over to the trainer's lines (World3D), whose last page sends the
 * interact that starts the fight. A battle restages the actor and puts it back at its own spot afterwards, so `end()`
 * only lets go of it.
 */

/** The actor-pool calls the approach needs (render `ActorPool`). */
export interface ApproachActors {
  setTransform(id: string, x: number, z: number, angle: number, moving: boolean, running: boolean): void;
  setEmote(id: string, n: 0 | 1 | 2 | 3 | 4 | 5 | 6): void;
}

/** The "!" stands alone this long before the trainer walks. */
export const ALERT_MS = 900;
/** The trainer's walk (m/s): brisk, never a run. */
export const WALK_SPEED_MPS = 3.2;
/** The trainer stops this far from the player. */
export const STOP_M = 1.6;
/** The walk never takes longer than this (a far spot ends at the stop distance at once). */
export const WALK_MAX_MS = 3_000;
/** Actor emote 4 is the "!" card (render hud `EMOTE_GLYPHS`). */
export const EXCLAIM_EMOTE = 4;

type Phase = 'alert' | 'walk' | 'arrived';

export class TrainerApproach {
  private id: string | null = null;
  private phase: Phase = 'arrived';
  private t = 0;
  private x = 0;
  private z = 0;
  private px = 0;
  private pz = 0;
  private angle = 0;
  private onArrive: (() => void) | null = null;

  constructor(private readonly actors: ApproachActors) {}

  /** A trainer is approaching or waiting by the player (input stays locked). */
  get active(): boolean {
    return this.id !== null;
  }

  get trainerId(): string | null {
    return this.id;
  }

  /** The trainer at `from` saw the player at (px, pz): the "!" now, the walk after ALERT_MS. */
  start(id: string, from: { readonly x: number; readonly z: number }, px: number, pz: number, onArrive: () => void): void {
    this.id = id;
    this.phase = 'alert';
    this.t = 0;
    this.x = from.x;
    this.z = from.z;
    this.px = px;
    this.pz = pz;
    this.angle = Math.atan2(px - from.x, pz - from.z);
    this.onArrive = onArrive;
    this.actors.setTransform(id, this.x, this.z, this.angle, false, false);
    this.actors.setEmote(id, EXCLAIM_EMOTE);
  }

  /** Per frame. Allocation-free. */
  update(dtMs: number): void {
    if (this.id === null || this.phase === 'arrived') return;
    this.t += dtMs;
    if (this.phase === 'alert') {
      if (this.t < ALERT_MS) return;
      this.phase = 'walk';
      this.t = 0;
    }
    const dx = this.px - this.x;
    const dz = this.pz - this.z;
    const d = Math.hypot(dx, dz);
    const stepM = (WALK_SPEED_MPS * dtMs) / 1000;
    if (d - STOP_M <= stepM || this.t >= WALK_MAX_MS) {
      if (d > STOP_M) {
        this.x += (dx / d) * (d - STOP_M);
        this.z += (dz / d) * (d - STOP_M);
      }
      this.actors.setTransform(this.id, this.x, this.z, this.angle, false, false);
      this.phase = 'arrived';
      const cb = this.onArrive;
      this.onArrive = null;
      cb?.();
      return;
    }
    this.x += (dx / d) * stepM;
    this.z += (dz / d) * stepM;
    this.actors.setTransform(this.id, this.x, this.z, this.angle, true, false);
  }

  /** The heading that turns the player toward the trainer (the actor pool's atan2(dx, dz) convention). */
  facePlayer(px: number, pz: number): number {
    return Math.atan2(this.x - px, this.z - pz);
  }

  /** Lets go of the actor (the battle restages it; `restore` puts it back at `home` when no battle came). */
  end(restore?: { readonly x: number; readonly z: number; readonly angle: number }): void {
    if (this.id !== null && restore !== undefined) {
      this.actors.setEmote(this.id, 0);
      this.actors.setTransform(this.id, restore.x, restore.z, restore.angle, false, false);
    }
    this.id = null;
    this.phase = 'arrived';
    this.onArrive = null;
  }
}
