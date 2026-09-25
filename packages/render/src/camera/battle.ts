/**
 * SPEC §10.7.4 — `BattleCamera` and arena framing (Pillar 7), plus the §10.7.5 inspector close-up.
 *
 * Every number lives in the constants region below (`camera-constants.test.ts` greps the rest of this file for
 * numeric literals). Pure math: the rig and the stage call these; node tests assert them.
 *
 * Interpretation (IMPLEMENTATION-NOTES "Part 3" P5): §10.7.4 says the battlers stand "on the line through the
 * BattleSummary (x, z) perpendicular to the diorama heading" but also that the player's battler is "the nearer
 * one" and that the +12° yaw keeps the two "staggered, not eclipsed" — both only hold when the line runs along
 * the camera's horizontal forward. The line here runs along the heading's view direction (near = player side 0).
 */
import type { Vector3 } from 'three/webgpu';

// #region constants — §10.7.4 arena framing (verbatim) + the inspector pose (§10.7.5 "4 m close-up")
/** Camera distance from the arena centre in the default battle pose (m). */
export const BATTLE_DISTANCE = 12;
/** Battle pose pitch (degrees from horizontal, negative = looking down). */
export const BATTLE_PITCH = -28;
/** Battle yaw = diorama yaw + 12° (so the two battlers are staggered, not eclipsed). */
export const BATTLE_YAW_OFFSET = 12;
/** The two battlers stand 5.5 m apart. */
export const BATTLER_SEPARATION = 5.5;
/** `SceneDirector.enterBattle` / `exitBattle` durations (20-client.md PUSH_IN / RELEASE). */
export const PUSH_IN_MS = 600;
export const RELEASE_MS = 600;
/** Pillar 7: the battle camera stays within 40 units of the pre-battle player position. */
export const PILLAR7_RADIUS = 40;
/** Doubles/raids: lateral spacing between battlers of one side (m; implementation value). */
export const SLOT_SPACING = 1.8;
/** The arena ring (7 m, §10.7.5). */
export const RING_DIAMETER = 7;
/** Inspector close-up: 4 m from the creature (§10.7.5), a shallow look-down, the card 1.2 m in front of the feet. */
export const INSPECT_DISTANCE = 4;
export const INSPECT_PITCH = -18;
export const INSPECT_OFFSET = 1.2;
/** The inspector frames the creature's chest: this fraction of its height above the feet. */
export const INSPECT_AIM = 0.45;
// #endregion

// #region constants — §10.7.4 CameraWork registry (verbatim)
export interface CameraWork {
  readonly push: { readonly distance: number; readonly ms: number } | null;   // dolly toward the cue target (m)
  readonly orbit: { readonly deg: number; readonly ms: number } | null;       // yaw around the arena centre
  readonly shake: { readonly amp: number; readonly ms: number } | null;       // forwarded to rig.shake (effects.shake gates)
  readonly slowmo: { readonly scale: number; readonly ms: number } | null;    // forwarded to setTimeScale (effects.slowmo gates)
  readonly hold: number;                                                       // ms before returning to the arena pose
}
export type CueKind = 'attacker' | 'defender' | 'impact' | 'wide' | 'ko' | 'throw';
export const CAMERA_WORK: Readonly<Record<'attacker' | 'defender' | 'impact' | 'wide' | 'ko' | 'throw', CameraWork>> = {
  attacker: { push: { distance: 2.5, ms: 220 }, orbit: { deg: -10, ms: 220 }, shake: null, slowmo: null, hold: 300 },
  defender: { push: { distance: 2.5, ms: 220 }, orbit: { deg: 10, ms: 220 }, shake: null, slowmo: null, hold: 300 },
  impact:   { push: { distance: 1.2, ms: 90 },  orbit: null, shake: { amp: 0.25, ms: 180 }, slowmo: null, hold: 200 },
  wide:     { push: { distance: -3.0, ms: 400 }, orbit: { deg: 25, ms: 400 }, shake: null, slowmo: null, hold: 500 },
  ko:       { push: { distance: 1.8, ms: 300 }, orbit: { deg: 35, ms: 900 }, shake: null, slowmo: { scale: 0.35, ms: 400 }, hold: 900 },
  throw:    { push: { distance: 1.5, ms: 600 }, orbit: { deg: 15, ms: 600 }, shake: null, slowmo: null, hold: 700 },   // follows the orb to the wild battler; the orb shakes play in this pose
};
export const CUE_KINDS: readonly CueKind[] = ['attacker', 'defender', 'impact', 'wide', 'ko', 'throw'];
// #endregion

const DEG = Math.PI / 180;

/** An orbit pose: the camera sits at `center + distance · (cos p · sin yaw, −sin p, cos p · cos yaw)`. */
export interface OrbitPose { readonly center: Vector3; yaw: number; pitch: number; distance: number }

/** Writes the camera position of `pose` into `out` (§10.7.1 formula; pitch negative = looking down). */
export function orbitPosition(pose: OrbitPose, out: Vector3): Vector3 {
  const c = Math.cos(pose.pitch);
  return out.set(
    pose.center.x + pose.distance * c * Math.sin(pose.yaw),
    pose.center.y + pose.distance * Math.sin(-pose.pitch),
    pose.center.z + pose.distance * c * Math.cos(pose.yaw),
  );
}

/** Horizontal forward (camera → scene) for a yaw, as (x, z) written into `out.x` / `out.z` (`out.y = 0`). */
export function forwardOfYaw(yaw: number, out: Vector3): Vector3 {
  return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}

/** The default battle pose around `center` for a diorama yaw (radians). */
export function battlePose(center: Vector3, dioramaYaw: number, out: OrbitPose): OrbitPose {
  out.center.copy(center);
  out.yaw = dioramaYaw + BATTLE_YAW_OFFSET * DEG;
  out.pitch = BATTLE_PITCH * DEG;
  out.distance = BATTLE_DISTANCE;
  return out;
}

/**
 * Feet position of battler (`side`, `slot`) of a side holding `count` battlers: side 0 (the player's) on the near
 * half of the arena axis, side 1 on the far half, 5.5 m apart; slots spread laterally by `SLOT_SPACING`.
 */
export function battlerSlot(center: Vector3, dioramaYaw: number, side: 0 | 1, slot: number, count: number, out: Vector3): Vector3 {
  const fx = -Math.sin(dioramaYaw); const fz = -Math.cos(dioramaYaw);   // forward
  const rx = Math.cos(dioramaYaw); const rz = -Math.sin(dioramaYaw);    // right
  const along = (side === 0 ? -1 : 1) * BATTLER_SEPARATION / 2;
  const n = Math.max(1, count);
  const lateral = (Math.min(Math.max(0, slot), n - 1) - (n - 1) / 2) * SLOT_SPACING * (side === 0 ? 1 : -1);
  return out.set(center.x + fx * along + rx * lateral, center.y, center.z + fz * along + rz * lateral);
}

/** Inspector pose: the camera 4 m from the creature's aim point, a shallow look-down, the current diorama yaw. */
export function inspectPose(aim: Vector3, dioramaYaw: number, out: OrbitPose): OrbitPose {
  out.center.copy(aim);
  out.yaw = dioramaYaw;
  out.pitch = INSPECT_PITCH * DEG;
  out.distance = INSPECT_DISTANCE;
  return out;
}

/** Duration of a cue's ease-in (the longer of push / orbit). */
export function cueInMs(w: CameraWork): number {
  return Math.max(w.push?.ms ?? 0, w.orbit?.ms ?? 0);
}

/**
 * Cue envelope 0..1 at `t` ms: smoothstep in over the push/orbit ms, hold, smoothstep out over the same ms.
 * `holdMs` is the row's `hold` unless the timeline passes its own shot length (then `max(0, ms − in)`).
 */
export function cueEnvelope(tMs: number, inMs: number, holdMs: number, component: number): number {
  const i = Math.max(component, 0);
  const outStart = inMs + holdMs;
  if (tMs <= 0) return 0;
  if (i > 0 && tMs < i) { const x = tMs / i; return x * x * (3 - 2 * x); }
  if (tMs < outStart) return 1;
  const o = Math.max(inMs, 1);
  const x = Math.min(1, (tMs - outStart) / o);
  return 1 - x * x * (3 - 2 * x);
}

/** Total length of a cue (in + hold + out). */
export function cueTotalMs(inMs: number, holdMs: number): number {
  return inMs + holdMs + inMs;
}
