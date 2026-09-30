/**
 * Pixel-art character animation (SPEC §10.7.6 / §10.7.7 as proposed in tools/character-pipeline
 * IMPLEMENTATION-NOTES): the pure part — which facing and which frame an actor shows. No `three` import;
 * node tests drive it directly. Everything here is scalar math on preallocated records (zero allocation).
 *
 * Facing: the actor's heading relative to the camera heading, quantised to 4 with hysteresis. With `angle` the
 * actor's yaw (a model facing +Z at 0, forward = (sin a, 0, cos a)) and `cameraYaw` the direction toward the
 * camera (`BillboardUniforms.cameraYaw`, §10.4.4), `rel = angle − cameraYaw`: cos rel > 0 faces the camera (D),
 * sin rel > 0 walks screen-right (R; the card's local +x is world (cos yaw, 0, −sin yaw)). The side views own
 * ±50° and the front/back ±40°, so a screen diagonal reads as a side view (the classic 4-direction choice), and a
 * facing is kept until the heading leaves its sector by `HYSTERESIS` (no flicker walking a diagonal).
 *
 * Frames: idle breathes at 1.6 fps; walk / run advance by distance (speed / cycle metres × 4 frames), so feet do
 * not skate at any speed; emotes (wave, cheer) play facing the camera while the actor stands still.
 */

export type CharFacing = 0 | 1 | 2 | 3;          // D U L R (the manifest's facing order)
export type CharState = 0 | 1 | 2 | 3 | 4;       // idle walk run wave cheer
export const FACING_KEYS = Object.freeze(['D', 'U', 'L', 'R'] as const);
export const STATE_KEYS = Object.freeze(['idle', 'walk', 'run', 'wave', 'cheer'] as const);
export const FACING_D = 0; export const FACING_U = 1; export const FACING_L = 2; export const FACING_R = 3;
export const STATE_IDLE = 0; export const STATE_WALK = 1; export const STATE_RUN = 2; export const STATE_WAVE = 3; export const STATE_CHEER = 4;

const DEG = Math.PI / 180;
/** Half-width of the side (L/R) sectors; D/U get the remaining 40°. */
export const SIDE_HALF = 50 * DEG;
export const HYSTERESIS = 8 * DEG;

export const CHAR_ANIM = Object.freeze({
  idleFps: 1.6,
  waveFps: 5,
  cheerFps: 4,
  /** Metres per 4-frame cycle (the pipeline's CYCLE_M): walk / run fps = speed / cycle × 4. */
  walkCycleM: 1.3,
  runCycleM: 2.4,
  /** Clamp of the distance-driven rates (fps). */
  walkFpsMin: 4, walkFpsMax: 12, runFpsMin: 7, runFpsMax: 16,
  /** Nominal rates when no speed was measured yet (a teleport, the first frame). */
  walkFps: 7, runFps: 11,
  /** Speed smoothing time constant (s) and the speed below which a `moving` actor is treated as stepping in place. */
  speedTau: 0.12,
  /** An actor whose position jumps farther than this in one update teleported: no speed from it. */
  teleportM: 3,
});

/** Wraps an angle to (−π, π]. */
export function wrapPi(a: number): number {
  let x = a % (2 * Math.PI);
  if (x > Math.PI) x -= 2 * Math.PI;
  else if (x <= -Math.PI) x += 2 * Math.PI;
  return x;
}

const CENTRES: readonly number[] = [0, Math.PI, -Math.PI / 2, Math.PI / 2];   // D U L R, as rel angles
const HALF: readonly number[] = [Math.PI / 2 - SIDE_HALF, Math.PI / 2 - SIDE_HALF, SIDE_HALF, SIDE_HALF];

/** The raw facing sector of a relative heading (no hysteresis). */
export function facingOf(rel: number): CharFacing {
  const r = wrapPi(rel);
  const s = Math.sin(r);
  if (Math.abs(r) <= Math.PI / 2 - SIDE_HALF) return FACING_D;
  if (Math.abs(r) >= Math.PI / 2 + SIDE_HALF) return FACING_U;
  return s > 0 ? FACING_R : FACING_L;
}

/** Facing with hysteresis: keeps `current` while `rel` is within its sector widened by HYSTERESIS. */
export function facingFor(actorAngle: number, cameraYaw: number, current: CharFacing): CharFacing {
  const rel = wrapPi(actorAngle - cameraYaw);
  const d = Math.abs(wrapPi(rel - CENTRES[current]!));
  if (d <= HALF[current]! + HYSTERESIS) return current;
  return facingOf(rel);
}

/** Emote id (spine §4.1: 1..6 wave happy sad alert heart cool) → the pose it plays; idle when none. */
export function emoteState(n: number): CharState {
  if (n === 1 || n === 6) return STATE_WAVE;
  if (n === 2 || n === 5) return STATE_CHEER;
  return STATE_IDLE;
}

/** Per-actor animation record (preallocated in the pool). */
export interface CharAnim {
  facing: CharFacing;
  state: CharState;
  /** Continuous frame clock of the current state (frames). */
  t: number;
  /** Smoothed ground speed (m/s). */
  speed: number;
  lastX: number;
  lastZ: number;
  hasLast: boolean;
}

export function createCharAnim(): CharAnim {
  return { facing: FACING_D, state: STATE_IDLE, t: 0, speed: 0, lastX: 0, lastZ: 0, hasLast: false };
}

export function resetCharAnim(a: CharAnim, phase: number): void {
  a.facing = FACING_D; a.state = STATE_IDLE; a.t = phase; a.speed = 0; a.hasLast = false;
}

/** Frame rate of a state at a measured speed. */
export function stateFps(state: CharState, speed: number): number {
  const A = CHAR_ANIM;
  if (state === STATE_WALK) return speed > 0.05 ? Math.min(A.walkFpsMax, Math.max(A.walkFpsMin, (speed / A.walkCycleM) * 4)) : A.walkFps;
  if (state === STATE_RUN) return speed > 0.05 ? Math.min(A.runFpsMax, Math.max(A.runFpsMin, (speed / A.runCycleM) * 4)) : A.runFps;
  if (state === STATE_WAVE) return A.waveFps;
  if (state === STATE_CHEER) return A.cheerFps;
  return A.idleFps;
}

function isGait(s: CharState): boolean { return s === STATE_WALK || s === STATE_RUN; }

/**
 * One animation step. `x, z` the actor's current position, `angle` its yaw, `emote` 0..6 while its card shows.
 * Updates the record in place; the caller reads `facing`, `state` and `frameIndex(a, count)`.
 */
export function stepCharAnim(a: CharAnim, dtMs: number, x: number, z: number, angle: number, moving: boolean, running: boolean, emote: number, cameraYaw: number): void {
  const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs / 1000 : 0;
  if (dt > 0) {
    if (a.hasLast) {
      const d = Math.hypot(x - a.lastX, z - a.lastZ);
      if (d < CHAR_ANIM.teleportM) {
        const k = 1 - Math.exp(-dt / CHAR_ANIM.speedTau);
        a.speed += (d / dt - a.speed) * k;
      }
    }
    a.lastX = x; a.lastZ = z; a.hasLast = true;
  } else if (!a.hasLast) { a.lastX = x; a.lastZ = z; a.hasLast = true; }
  const emoting = !moving && emote !== 0 ? emoteState(emote) : STATE_IDLE;
  const next: CharState = moving ? (running ? STATE_RUN : STATE_WALK) : emoting;
  if (next !== a.state) {
    // walk ↔ run keep the stride phase (both are 4-frame cycles with the same contact order); anything else restarts
    if (!(isGait(next) && isGait(a.state))) a.t = 0;
    a.state = next;
  }
  a.facing = next === STATE_WAVE || next === STATE_CHEER ? FACING_D : facingFor(angle, cameraYaw, a.facing);
  a.t += dt * stateFps(a.state, a.speed);
  if (a.t > 1e6) a.t %= 4;
}

/** Frame index within a state of `count` frames. */
export function frameIndex(a: CharAnim, count: number): number {
  if (count <= 1) return 0;
  const f = Math.floor(a.t) % count;
  return f < 0 ? f + count : f;
}
