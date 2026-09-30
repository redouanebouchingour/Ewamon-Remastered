/**
 * SPEC §20.4.5 — the client's protocol `Collider`: a small adapter over the zone's `TerrainCollider` +
 * `resolveMoveInto` (render §10.6.2). `stepMovement` integrates the pose and then calls `resolve`; the adapter
 * resolves the step from the position recorded by `begin()` (the pose before the step) to the integrated one and
 * writes the accepted point back. `resolveMove` never returns an unwalkable position. Building, prop, trunk and rock
 * footprints are content's (`walkable = 0` in the heightfield the server validates with, audit R1), so a predicted
 * step lands exactly where `validateInput` accepts it; only extra client-side blockers (`addBlocker`, none in a
 * built zone) could make prediction stricter than the server, never looser. Allocation-free.
 */
import type { Collider, MovePose } from '@ewa/protocol';
import { resolveMoveInto } from '@ewa/render';
import type { MoveResultMut, TerrainCollider } from '@ewa/render';

/** A stuck avatar (spawned inside a blocker) walks out at ≤ this per step (≈ 4.2 m/s at 60 Hz). */
export const ESCAPE_STEP_M = 0.07;

export interface StepCollider extends Collider {
  /** Records the pre-step position (the controller calls it before every stepMovement). */
  begin(x: number, z: number): void;
  /** Ground height for rendering / audio. */
  height(x: number, z: number): number;
  readonly terrain: TerrainCollider | null;
}

export function createStepCollider(terrain: TerrainCollider | null): StepCollider {
  const out: MoveResultMut = { x: 0, z: 0, y: 0, blocked: false, slid: false };
  let fromX = 0;
  let fromZ = 0;
  return {
    terrain,
    begin(x, z) {
      fromX = x;
      fromZ = z;
    },
    resolve(pose: MovePose): void {
      if (terrain === null) return;
      const dx = pose.x - fromX;
      const dz = pose.z - fromZ;
      if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
        // never integrate a NaN: stay at a finite start, else leave the (finite) integrated pose alone
        if (Number.isFinite(fromX) && Number.isFinite(fromZ)) {
          pose.x = fromX;
          pose.z = fromZ;
        }
        return;
      }
      resolveMoveInto(out, terrain, fromX, fromZ, dx, dz);
      // resolveMove's corner probes land a capsule radius (0.35 m) around the target, and a blocked start escapes to
      // the nearest passable sample (≤ 4 m): either can move the pose several times farther than the step asked for,
      // which the server's per-message speed cap rejects (30 rejections in 10 s is a kick). Clamp every step to the
      // requested length (a small floor lets a stuck avatar walk out of a blocker) — IMPLEMENTATION-NOTES part 2, P6.
      const want = Math.max(Math.hypot(dx, dz), ESCAPE_STEP_M);
      const gx = out.x - fromX;
      const gz = out.z - fromZ;
      const got = Math.hypot(gx, gz);
      if (got <= want + 1e-9) {
        pose.x = out.x;
        pose.z = out.z;
        return;
      }
      const k = want / got;
      const cx = fromX + gx * k;
      const cz = fromZ + gz * k;
      if (terrain.passable(cx, cz) || !terrain.passable(fromX, fromZ)) {
        pose.x = cx;
        pose.z = cz;
      } else {
        pose.x = fromX;
        pose.z = fromZ;
      }
    },
    height(x, z) {
      if (terrain === null) return 0;
      const y = terrain.sample(x, z);
      return Number.isFinite(y) ? y : 0;
    },
  };
}
