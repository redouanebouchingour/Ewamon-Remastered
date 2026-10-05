/**
 * SPEC §20.4.5 — the client's protocol `Collider`: a small adapter over the zone's `TerrainCollider` +
 * `resolveMoveInto` (render §10.6.2). `stepMovement` integrates the pose and then calls `resolve`; the adapter
 * resolves the step from the position recorded by `begin()` (the pose before the step) to the integrated one and
 * writes the accepted point back. `resolveMove` never returns an unwalkable position. Building, prop, trunk and rock
 * footprints are content's (`walkable = 0` in the heightfield the server validates with, audit R1), so a predicted
 * step lands exactly where `validateInput` accepts it; only extra client-side blockers (`addBlocker`, none in a
 * built zone) could make prediction stricter than the server, never looser. Allocation-free.
 *
 * Phase A gates: a hall's per-player gates are never stamped into the heightfield (the server checks them in movement
 * validation against the player's flags). The adapter keeps the closed ones as removable blockers (`addBlocker(id,
 * solid)` / `removeBlocker(id)`, content's `WorldGate.solid` — the physical gate grown by the capsule radius, the
 * centre-exclusion shape the server tests) and resolves every step against `terrain.passable && !inside a gate`.
 * Render's `TerrainCollider.addBlocker` has no removal, so the gates live here, not in the zone collider (the battle
 * camera's `blocked()` does not need them).
 */
import type { Collider, MovePose } from '@ewa/protocol';
import { resolveMoveInto } from '@ewa/render';
import type { MoveResultMut, TerrainCollider } from '@ewa/render';

/** A stuck avatar (spawned inside a blocker) walks out at ≤ this per step (≈ 4.2 m/s at 60 Hz). */
export const ESCAPE_STEP_M = 0.07;

/** A yawed rectangle (content `RectSolid`): centre, half extents, yaw (local x = c·dx − s·dz, local z = s·dx + c·dz). */
export interface GateSolid { readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly yaw: number }

/** The removable client-side blockers the director drives from the player's flags (Phase A gates). */
export interface GateBlockers {
  addBlocker(id: string, s: GateSolid): void;
  removeBlocker(id: string): void;
  blockerIds(): readonly string[];
}

export interface StepCollider extends Collider, GateBlockers {
  /** Records the pre-step position (the controller calls it before every stepMovement). */
  begin(x: number, z: number): void;
  /** Ground height for rendering / audio. */
  height(x: number, z: number): number;
  /** terrain.passable minus the closed gates (what prediction resolves against). */
  passable(x: number, z: number): boolean;
  readonly terrain: TerrainCollider | null;
}

interface GateEntry { readonly id: string; readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly c: number; readonly s: number; readonly r2: number }

export function createStepCollider(terrain: TerrainCollider | null): StepCollider {
  const out: MoveResultMut = { x: 0, z: 0, y: 0, blocked: false, slid: false };
  let fromX = 0;
  let fromZ = 0;
  const gates: GateEntry[] = [];
  const inGate = (x: number, z: number): boolean => {
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i]!;
      const dx = x - g.x;
      const dz = z - g.z;
      if (dx * dx + dz * dz >= g.r2) continue;
      if (Math.abs(g.c * dx - g.s * dz) < g.hw && Math.abs(g.s * dx + g.c * dz) < g.hd) return true;
    }
    return false;
  };
  const passable = (x: number, z: number): boolean => terrain !== null && terrain.passable(x, z) && (gates.length === 0 || !inGate(x, z));
  // the solver's view: the zone collider with the closed gates added to `passable` (resolveMoveInto reads passable,
  // sample, slopeDeg and — for a blocked start — nearestPassable)
  const view =
    terrain === null
      ? null
      : ({
          passable,
          sample: (x: number, z: number) => terrain.sample(x, z),
          slopeDeg: (x: number, z: number) => terrain.slopeDeg(x, z),
          nearestPassable: (x: number, z: number, r: number) => {
            const p = terrain.nearestPassable(x, z, r);
            return p !== null && gates.length > 0 && inGate(p[0], p[1]) ? null : p;
          },
        } as unknown as TerrainCollider);
  const remove = (id: string): void => {
    const i = gates.findIndex((g) => g.id === id);
    if (i >= 0) gates.splice(i, 1);
  };
  return {
    terrain,
    passable,
    addBlocker(id, sol) {
      remove(id);
      gates.push({ id, x: sol.x, z: sol.z, hw: sol.hw, hd: sol.hd, c: Math.cos(sol.yaw), s: Math.sin(sol.yaw), r2: sol.hw * sol.hw + sol.hd * sol.hd + 1e-9 });
    },
    removeBlocker: remove,
    blockerIds() {
      return gates.map((g) => g.id);
    },
    begin(x, z) {
      fromX = x;
      fromZ = z;
    },
    resolve(pose: MovePose): void {
      if (terrain === null || view === null) return;
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
      resolveMoveInto(out, view, fromX, fromZ, dx, dz);
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
      if (passable(cx, cz) || !passable(fromX, fromZ)) {
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
