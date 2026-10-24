/**
 * A recurring rival (LLM feature 7): the rival's actor in the world. It walks up through trainer sight's
 * `TrainerApproach` (the "!" and the walk); this module stands it before the player for the parting line once a battle
 * with it is over, then walks it off and lets it go. Allocation-free per frame.
 */
import type { ApproachActors } from './trainerApproach';

/** The rival's actor (one rival per player, so one id). */
export const RIVAL_ACTOR_ID = 'rival:actor';
/** Where it stands for the parting line: this far in front of the player. */
export const PARTING_STAND_M = 2.4;
/** It walks off at this pace (m/s) for this long, then it is gone. */
export const EXIT_SPEED_MPS = 3.4;
export const EXIT_MS = 1_600;

export interface RivalActors extends ApproachActors {
  spawn(id: string, d: { readonly look: string; readonly name: string; readonly guildTag: string; readonly isLocal: boolean }): void;
  despawn(id: string): void;
}

/** Where the rival stands for its parting line: in front of the player (`angle` the player's heading), facing them. */
export function partingStand(px: number, pz: number, angle: number): { readonly x: number; readonly z: number; readonly angle: number } {
  const x = px + Math.sin(angle) * PARTING_STAND_M;
  const z = pz + Math.cos(angle) * PARTING_STAND_M;
  return { x, z, angle: Math.atan2(px - x, pz - z) };
}

export class RivalExit {
  private up = false;
  private leaving = false;
  private t = 0;
  private x = 0;
  private z = 0;
  private angle = 0;

  constructor(private readonly actors: RivalActors) {}

  /** The actor is in the world (standing or walking off). */
  get active(): boolean {
    return this.up;
  }

  /** Spawns the rival's actor standing at (x, z), facing `angle`. */
  stand(look: string, name: string, x: number, z: number, angle: number): void {
    this.actors.spawn(RIVAL_ACTOR_ID, { look, name, guildTag: '', isLocal: false });
    this.actors.setTransform(RIVAL_ACTOR_ID, x, z, angle, false, false);
    this.up = true;
    this.leaving = false;
    this.x = x;
    this.z = z;
    this.angle = angle;
  }

  /** Spawns the actor for the walk-up (TrainerApproach moves it from there). */
  spawnFor(look: string, name: string): void {
    this.actors.spawn(RIVAL_ACTOR_ID, { look, name, guildTag: '', isLocal: false });
    this.up = true;
    this.leaving = false;
  }

  /** It turns away from the player at (px, pz) and walks off. */
  leave(px: number, pz: number): void {
    if (!this.up) return;
    this.angle = Math.atan2(this.x - px, this.z - pz);
    this.leaving = true;
    this.t = 0;
  }

  /** Gone at once (a battle starts, the zone changes). */
  despawn(): void {
    if (this.up) this.actors.despawn(RIVAL_ACTOR_ID);
    this.up = false;
    this.leaving = false;
  }

  /** Per frame. */
  update(dtMs: number): void {
    if (!this.up || !this.leaving) return;
    this.t += dtMs;
    if (this.t >= EXIT_MS) return this.despawn();
    const step = (EXIT_SPEED_MPS * dtMs) / 1000;
    this.x += Math.sin(this.angle) * step;
    this.z += Math.cos(this.angle) * step;
    this.actors.setTransform(RIVAL_ACTOR_ID, this.x, this.z, this.angle, true, false);
  }
}
