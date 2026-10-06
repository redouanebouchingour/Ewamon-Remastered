/**
 * 20-client.md §20.4.5 / 30-server-netcode.md §30.2.4 — the ONE movement constants table shared by
 * client prediction and server validation, and the pure `stepMovement` the client predicts with.
 *
 * The server does NOT re-simulate: it validates each `input` against a speed cap derived from
 * `MOVEMENT` (`runSpeed × SPEED_TOLERANCE`), the dt budget and the heightfield. Its `WALK_SPEED` /
 * `RUN_SPEED` are re-exports of the values below.
 */

export const MOVEMENT = {
  /** units / s (= 30-server-netcode.md WALK_SPEED) */
  walkSpeed: 4.2,
  /** units / s (= RUN_SPEED) */
  runSpeed: 7.0,
  /** units / s on the bicycle (Phase D11: `MoveInput.bike` / `InputMsg.bike`; the server's BIKE_SPEED) */
  bikeSpeed: 10.5,
  /** units / s^2 toward target velocity */
  accel: 40,
  /** rad / s toward input heading */
  turnRate: 12,
  /** capsule radius for edge/collider tests (= 10-render.md MOVER.capsuleRadius) */
  radius: 0.35,
  /** 16.667: client fixed step */
  stepMs: 1000 / 60,
  /** input messages per second */
  sendHz: 20,
  /** matches InputMsg.dtMs max */
  maxDtMs: 100,
} as const;

/**
 * §30.2.4 validation constants, restated here so the server's `movement.ts` and the netcode harness
 * read one table. (The spine's §20.4.5 block holds only `MOVEMENT`; these are the server-side
 * companions the task placed alongside it.)
 */
export const MOVEMENT_VALIDATION = {
  /** +15 % over the nominal speed before an input is rejected with `speed` */
  speedTolerance: 1.15,
  /** an input may not spend more than 100 ms of time the server has not seen */
  budgetMinMs: -100,
  /** idle time does not bank more than 250 ms */
  budgetMaxMs: 250,
  /** metres absorbed on the speed check for float32 quantisation on the wire */
  quantisationSlack: 0.02,
  /** the server samples the prev → new segment at this spacing for walkability */
  segmentSampleM: 0.25,
} as const;

/** The nominal speed of a gait (m/s): bike (Phase D11) > run > walk. */
export function gaitSpeed(running: boolean, bike = false): number {
  return bike ? MOVEMENT.bikeSpeed : running ? MOVEMENT.runSpeed : MOVEMENT.walkSpeed;
}

/** Maximum accepted displacement per second, including tolerance (m/s). */
export function speedCap(running: boolean, bike = false): number {
  return gaitSpeed(running, bike) * MOVEMENT_VALIDATION.speedTolerance;
}

/** Maximum accepted displacement for one input of `dtMs`, including tolerance and quantisation slack (m). */
export function maxStep(running: boolean, dtMs: number, bike = false): number {
  return (speedCap(running, bike) * dtMs) / 1000 + MOVEMENT_VALIDATION.quantisationSlack;
}

/** ax/az in [-1,1], normalised by the caller */
export interface MoveInput {
  readonly ax: number;
  readonly az: number;
  readonly running: boolean;
  /** Phase D11: riding the bicycle — `MOVEMENT.bikeSpeed`, `running` ignored */
  readonly bike?: boolean;
}

/** mutable scratch — the ONLY mutable type in protocol */
export interface MovePose {
  x: number;
  z: number;
  angle: number;
  vx: number;
  vz: number;
}

/** heightfield + blockers; pushes the pose out in place */
export interface Collider {
  resolve(pose: MovePose, radius: number): void;
}

/** A collider that never pushes back (open field / tests). */
export const NO_COLLIDER: Collider = { resolve(): void {} };

export function createPose(x = 0, z = 0, angle = 0): MovePose {
  return { x, z, angle, vx: 0, vz: 0 };
}

const TWO_PI = Math.PI * 2;

/** Wrap an angle into [-π, π). */
export function wrapAngle(a: number): number {
  let r = a - TWO_PI * Math.floor((a + Math.PI) / TWO_PI);
  if (r >= Math.PI) r -= TWO_PI; // guards the exact +π edge from float rounding
  return r;
}

/**
 * Advances pose in place by dtMs. Deterministic for identical inputs; allocation-free.
 *
 * - dtMs ≤ 0 (or non-finite) is a no-op; dtMs above `MOVEMENT.maxDtMs` is clamped to it (the client
 *   always passes `stepMs`).
 * - Velocity accelerates toward `input × speed` at `accel` and snaps exactly onto it when within one
 *   step, so a released stick stops the avatar dead (no exponential tail — §20.4.6 forbids it).
 * - Heading turns toward `atan2(ax, az)` (angle 0 = +z, radians, wrapped to [-π, π)) at `turnRate`
 *   along the shortest arc; no input → heading kept.
 * - The collider runs last and may move the pose; its velocity is left for the next step to correct.
 */
export function stepMovement(pose: MovePose, input: MoveInput, dtMs: number, collider: Collider): void {
  if (!(dtMs > 0) || !Number.isFinite(dtMs)) return;
  const dt = (dtMs > MOVEMENT.maxDtMs ? MOVEMENT.maxDtMs : dtMs) / 1000;

  let ax = input.ax;
  let az = input.az;
  let mag = Math.hypot(ax, az);
  if (!Number.isFinite(mag)) {
    ax = 0;
    az = 0;
    mag = 0;
  } else if (mag > 1) {
    ax /= mag;
    az /= mag;
    mag = 1;
  }

  const speed = gaitSpeed(input.running, input.bike === true);
  const tvx = ax * speed;
  const tvz = az * speed;
  const dvx = tvx - pose.vx;
  const dvz = tvz - pose.vz;
  const dv = Math.hypot(dvx, dvz);
  const maxDv = MOVEMENT.accel * dt;
  if (dv <= maxDv) {
    pose.vx = tvx;
    pose.vz = tvz;
  } else {
    const k = maxDv / dv;
    pose.vx += dvx * k;
    pose.vz += dvz * k;
  }

  if (mag > 1e-6) {
    const target = Math.atan2(ax, az);
    const diff = wrapAngle(target - pose.angle);
    const maxTurn = MOVEMENT.turnRate * dt;
    if (Math.abs(diff) <= maxTurn) pose.angle = target;
    else pose.angle = wrapAngle(pose.angle + (diff < 0 ? -maxTurn : maxTurn));
  }

  pose.x += pose.vx * dt;
  pose.z += pose.vz * dt;
  collider.resolve(pose, MOVEMENT.radius);
}
