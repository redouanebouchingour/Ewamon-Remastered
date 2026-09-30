/**
 * SPEC §10.7.1 `DioramaCamera` (Pillar 1) and §10.7.2 `CameraRig`.
 *
 * - Diorama pose: FOV 28°, pitch −52°, yaw −35° + 90°·heading (smoothstep over 320 ms, shortest arc), distance
 *   20 / 26 / 34 m by zoom stop (smoothstep over 260 ms). The camera orbits a spring-followed target point:
 *   critically damped (τ = 0.12 s, semi-implicit Euler at the render dt) toward a goal that moves only when the
 *   followed feet leave a 0.8 m dead zone. `focus` (the DOF plane anchor) is the followed actor's feet exactly.
 * - `pushIn` / `release` blend the orbit parameters (centre, yaw, pitch, distance) between the diorama pose and
 *   the battle pose (§10.7.4) with smoothstep; rig input is ignored while a battle (or inspector) shot is active.
 * - `cue(kind, ms)` plays the §10.7.4 `CAMERA_WORK` row on top of the battle pose (dolly toward the cue target,
 *   orbit about the arena centre, shake, slow-mo request), then eases back.
 * - `shake` is a rotation about the camera's right and up axes after the pose plus a roll of amp · 0.4°, decaying
 *   linearly over ms; with `effects.shake === false` the call returns before writing anything and an active shake
 *   is cut (Pillar 8).
 *
 * Every number is in the constants regions (`camera-constants.test.ts` greps this file). Zero allocation in
 * `update` (module scratch objects).
 */
import { Vector3 } from 'three/webgpu';
import type { PerspectiveCamera } from 'three/webgpu';
import type { CameraRig } from '../contracts.js';
import type { EffectsFlags } from '../descriptors.js';
import {
  CAMERA_WORK, FRAMING_EASE_MS, NOMINAL_BATTLER_HEIGHT_M, PANEL_DEFAULT_FRACTION, battleFraming, battlePose, cueEnvelope, cueInMs, cueTotalMs,
  forwardOfYaw, inspectPose, orbitPosition, type CameraWork, type CueKind, type Framing, type OrbitPose,
} from './battle.js';

// #region constants — §10.7.1 table (verbatim)
/** Vertical field of view (degrees): 35 mm-equivalent as the spine defines it; 47.2° horizontal on 16:9. */
export const FOV_V = 28;
/** Fixed pitch, degrees from horizontal. */
export const PITCH = -52;
/** Heading 0 yaw; heading k ∈ 0..3 → YAW_BASE + HEADING_STEP · k (degrees). */
export const YAW_BASE = -35;
export const HEADING_STEP = 90;
/** Distance by zoom stop 0 · 1 · 2 (m); default stop 1. */
export const DISTANCE = [20, 26, 34] as const;
export const DEFAULT_ZOOM_STOP = 1;
/** Critically damped follow spring time constant (s): ω = 1/τ. */
export const SPRING_TAU = 0.12;
/** The target does not move until the feet leave this radius around the last target (m). */
export const DEAD_ZONE = 0.8;
/** Heading change: smoothstep yaw over 320 ms. */
export const HEADING_TURN_MS = 320;
/** Zoom-stop change: distance eased over 260 ms. */
export const ZOOM_MS = 260;
// #endregion

// #region constants — follow spring integration (implementation value)
/**
 * Longest semi-implicit Euler step of the follow spring (s). The integrator is stable only for dt < τ (0.12 s); a
 * longer frame (a shader-compile stall, a starved tab at ~4 fps) is integrated in sub-steps of at most this length.
 */
export const SPRING_MAX_STEP_S = 1 / 60;
// #endregion

// #region constants — shot camera vs tree crowns (implementation values, IMPLEMENTATION-NOTES Part 4, H11)
/** A battle / inspector camera stops this far (m) in front of the first crown between it and the orbit centre. */
export const CROWN_MARGIN_M = 0.4;
/** ... but never closer to the orbit centre than this (m). */
export const MIN_SHOT_DISTANCE_M = 3;
// #endregion

// #region constants — §10.7.2 shake (amp · 0.4° roll; oscillator rates/phases are implementation values)
/** Roll added to a shake: amp · 0.4 degrees per world unit. */
export const SHAKE_ROLL_DEG = 0.4;
/** `20-client.md` SHAKE_AMP ≤ 0.5 u: larger requests are clamped. */
export const SHAKE_AMP_MAX = 0.5;
/** Deterministic oscillator rates (Hz) and phases (rad) for pitch / yaw / roll (no Math.random, §10 NN 10). */
export const SHAKE_HZ = [13, 17, 11] as const;
export const SHAKE_PHASE = [0, 1.3, 2.1] as const;
// #endregion

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** The §10.7.1 heading yaw in radians. */
export function headingYaw(h: number): number {
  return (YAW_BASE + HEADING_STEP * h) * DEG;
}

/** §10.7.1 camera offset from the target at pitch −52°: height `d·sin 52°`, horizontal `d·cos 52°`. */
export function dioramaOffset(distance: number): { readonly height: number; readonly horizontal: number } {
  return { height: distance * Math.sin(-PITCH * DEG), horizontal: distance * Math.cos(-PITCH * DEG) };
}

function smooth(x: number): number { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); }

/** Shortest signed angular difference b − a in (−π, π]. */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/**
 * One critically damped spring axis step (semi-implicit Euler, §10.7.1): v first, then x with the new v. A frame
 * longer than SPRING_MAX_STEP_S runs as equal sub-steps: one step of dt ≥ τ diverges (at 250 ms the target flew
 * hundreds of metres off and went NaN — a black canvas that never recovered). Identical for dt ≤ 1/60 s.
 */
export function springStep(x: number, v: number, target: number, dtS: number, out: { x: number; v: number }): { x: number; v: number } {
  const w = 1 / SPRING_TAU;
  const n = dtS > SPRING_MAX_STEP_S ? Math.ceil(dtS / SPRING_MAX_STEP_S) : 1;
  const h = dtS / n;
  let px = x;
  let pv = v;
  for (let i = 0; i < n; i++) {
    pv = pv - (2 * w * pv + w * w * (px - target)) * h;
    px = px + pv * h;
  }
  out.v = pv;
  out.x = px;
  return out;
}

/** Feet lookup (ActorPool.feetOf). */
export type FeetResolver = (actorId: string, out: Vector3) => Vector3 | null;

export interface DioramaRigOptions {
  readonly effects: () => EffectsFlags;
  readonly feet?: FeetResolver;
  /** Called when a heading/zoom ease ends (§10.7.1: `csm.updateFrustums()` at the end). */
  readonly onSettled?: () => void;
  /** Slow-mo request from a `ko` cue (the host coerces it through `setTimeScale`, §10.8.4). */
  readonly onSlowmo?: (scale: number, ms: number) => void;
  /** Tree crowns of the loaded zone (the collider's `crownClearance`); null / absent = none (H11). */
  readonly occluders?: () => CameraOccluders | null;
}

/** What a shot camera avoids: the parameter t ∈ [0, 1] where the segment a → b first enters a crown (1 = clear). */
export interface CameraOccluders {
  crownClearance(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number;
}

type Mode = 'diorama' | 'battle' | 'inspect';

const _pos = new Vector3();
const _feet = new Vector3();
const _spring = { x: 0, v: 0 };
const _dolly = new Vector3();

export class DioramaRig implements CameraRig {
  readonly focus = new Vector3();
  // diorama state
  private heading: 0 | 1 | 2 | 3 = 0;
  private zoom: 0 | 1 | 2 = DEFAULT_ZOOM_STOP;
  private yaw = headingYaw(0);
  private yawFrom = this.yaw;
  private yawTo = this.yaw;
  private yawT = 1;
  private dist: number = DISTANCE[DEFAULT_ZOOM_STOP];
  private distFrom = this.dist;
  private distTo = this.dist;
  private distT = 1;
  private followed: string | null = null;
  private readonly goal = new Vector3();
  private readonly target = new Vector3();
  private readonly vel = new Vector3();
  // shot state (battle / inspect)
  private mode: Mode = 'diorama';
  private readonly shot: OrbitPose = { center: new Vector3(), yaw: 0, pitch: 0, distance: 0 };
  private readonly shotFocus = new Vector3();
  private blend = 0;              // 0 diorama … 1 shot
  private blendFrom = 0;
  private blendTo = 0;
  private blendMs = 0;
  private blendT = 0;
  // battle framing above the DOM panel (T2): insets as shares of the viewport height, subject heights, eased result
  private insetTop = 0;
  private insetBottom = PANEL_DEFAULT_FRACTION;
  private subjectNear = NOMINAL_BATTLER_HEIGHT_M;
  private subjectFar = NOMINAL_BATTLER_HEIGHT_M;
  private readonly framing: Framing = { distance: 0, tilt: 0, fits: true };
  private shotTilt = 0;
  private frameFromD = 0; private frameToD = 0; private frameFromTilt = 0; private frameToTilt = 0; private frameT = 1;
  // cue
  private cueWork: CameraWork | null = null;
  private cueT = 0;
  private cueIn = 0;
  private cueHold = 0;
  private readonly cueTarget = new Vector3();
  private readonly cueTargets: Record<'attacker' | 'defender' | 'ko' | 'throw', Vector3> = {
    attacker: new Vector3(), defender: new Vector3(), ko: new Vector3(), throw: new Vector3(),
  };
  // shake
  private shakeAmp = 0;
  private shakeMs = 0;
  private shakeLeft = 0;
  private shakeClock = 0;
  private settledPending = false;
  // blended pose (exposed for tests / HUD)
  private readonly pose: OrbitPose = { center: new Vector3(), yaw: 0, pitch: PITCH * DEG, distance: DISTANCE[DEFAULT_ZOOM_STOP] };

  constructor(readonly camera: PerspectiveCamera, private readonly o: DioramaRigOptions) {
    camera.fov = FOV_V;
    camera.updateProjectionMatrix();
    this.update(0);
  }

  // ---- §10.7.2 -------------------------------------------------------------------------------------------------

  setHeading(h: 0 | 1 | 2 | 3): void {
    if (this.mode !== 'diorama' || h === this.heading) return;
    this.heading = h;
    this.yawFrom = this.yaw;
    this.yawTo = this.yaw + angleDelta(this.yaw, headingYaw(h));
    this.yawT = 0;
  }

  setZoomStop(z: 0 | 1 | 2): void {
    if (this.mode !== 'diorama' || z === this.zoom) return;
    this.zoom = z;
    this.distFrom = this.dist;
    this.distTo = DISTANCE[z];
    this.distT = 0;
  }

  follow(actorId: string | null): void {
    if (this.mode !== 'diorama') return;
    this.followed = actorId;
    if (actorId !== null && this.o.feet?.(actorId, _feet)) {
      this.goal.copy(_feet); this.target.copy(_feet); this.vel.set(0, 0, 0); this.focus.copy(_feet);
    }
  }

  pushIn(target: { readonly x: number; readonly z: number }, ms: number): void {
    _pos.set(target.x, this.focus.y, target.z);
    battlePose(_pos, this.yawTo, this.shot);
    // T2: pulled back / tilted so both battlers sit in the screen band above the DOM battle panel
    battleFraming(this.camera.fov, this.insetTop, this.insetBottom, this.subjectNear, this.subjectFar, this.framing);
    this.shot.distance = this.framing.distance;
    this.shotTilt = this.framing.tilt;
    this.frameT = 1;
    this.shotFocus.copy(_pos);
    this.enterShot('battle', ms);
    this.cueWork = null;
    for (const k of ['attacker', 'defender', 'ko', 'throw'] as const) this.cueTargets[k].copy(_pos);
  }

  release(ms: number): void {
    if (this.mode === 'diorama') return;
    this.mode = 'diorama';
    this.cueWork = null;
    this.startBlend(0, ms);
    if (this.followed !== null && this.o.feet?.(this.followed, _feet)) this.goal.copy(_feet);
  }

  shake(amp: number, ms: number): void {
    if (!this.o.effects().shake) return;   // §10.7.2 / Pillar 8: returns before writing anything
    const a = Math.min(SHAKE_AMP_MAX, Math.max(0, Number.isFinite(amp) ? amp : 0));
    if (a <= 0 || !(ms > 0)) return;
    this.shakeAmp = a;
    this.shakeMs = ms;
    this.shakeLeft = ms;
  }

  cue(kind: 'attacker' | 'defender' | 'impact' | 'wide' | 'ko' | 'throw', ms: number): void {
    if (this.mode !== 'battle') return;
    const w = CAMERA_WORK[kind];
    this.cueWork = w;
    this.cueT = 0;
    this.cueIn = cueInMs(w);
    this.cueHold = ms > 0 ? Math.max(0, ms - this.cueIn) : w.hold;
    const t = kind === 'impact' ? this.cueTargets.defender : kind === 'wide' ? this.shot.center : this.cueTargets[kind as keyof typeof this.cueTargets];
    this.cueTarget.copy(t);
    if (w.shake !== null) this.shake(w.shake.amp, w.shake.ms);
    if (w.slowmo !== null && this.o.effects().slowmo) this.o.onSlowmo?.(w.slowmo.scale, w.slowmo.ms);
  }

  update(dtMs: number): void {
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    const dtS = dt / 1000;
    const settledBefore = this.yawT >= 1 && this.distT >= 1;

    // follow: focus = feet; dead-zone goal; critically damped target
    if (this.followed !== null && this.o.feet?.(this.followed, _feet)) {
      this.focus.copy(_feet);
      const dx = _feet.x - this.goal.x; const dz = _feet.z - this.goal.z;
      const d = Math.hypot(dx, dz);
      if (d > DEAD_ZONE) { const k = (d - DEAD_ZONE) / d; this.goal.x += dx * k; this.goal.z += dz * k; }
      this.goal.y = _feet.y;
    }
    springStep(this.target.x, this.vel.x, this.goal.x, dtS, _spring); this.target.x = _spring.x; this.vel.x = _spring.v;
    springStep(this.target.y, this.vel.y, this.goal.y, dtS, _spring); this.target.y = _spring.x; this.vel.y = _spring.v;
    springStep(this.target.z, this.vel.z, this.goal.z, dtS, _spring); this.target.z = _spring.x; this.vel.z = _spring.v;

    // heading / zoom eases
    if (this.yawT < 1) { this.yawT = Math.min(1, this.yawT + dt / HEADING_TURN_MS); this.yaw = this.yawFrom + (this.yawTo - this.yawFrom) * smooth(this.yawT); }
    if (this.distT < 1) { this.distT = Math.min(1, this.distT + dt / ZOOM_MS); this.dist = this.distFrom + (this.distTo - this.distFrom) * smooth(this.distT); }
    if (!settledBefore && this.yawT >= 1 && this.distT >= 1) this.settledPending = true;

    // framing ease (a panel resize / a switch-in during the battle)
    if (this.frameT < 1) {
      this.frameT = Math.min(1, this.frameT + dt / FRAMING_EASE_MS);
      const e = smooth(this.frameT);
      this.shot.distance = this.frameFromD + (this.frameToD - this.frameFromD) * e;
      this.shotTilt = this.frameFromTilt + (this.frameToTilt - this.frameFromTilt) * e;
    }

    // shot blend
    if (this.blendT < 1) {
      this.blendT = this.blendMs > 0 ? Math.min(1, this.blendT + dt / this.blendMs) : 1;
      this.blend = this.blendFrom + (this.blendTo - this.blendFrom) * smooth(this.blendT);
    }

    // cue on top of the shot
    let push = 0; let orbit = 0; let aim = 0;
    const w = this.cueWork;
    if (w !== null) {
      this.cueT += dt;
      const pe = cueEnvelope(this.cueT, this.cueIn, this.cueHold, w.push?.ms ?? 0);
      const oe = cueEnvelope(this.cueT, this.cueIn, this.cueHold, w.orbit?.ms ?? 0);
      push = (w.push?.distance ?? 0) * pe;
      orbit = (w.orbit?.deg ?? 0) * DEG * oe;
      aim = pe;
      if (this.cueT >= cueTotalMs(this.cueIn, this.cueHold)) this.cueWork = null;
    }

    // blend the orbit parameters: diorama ↔ shot
    const b = this.blend;
    const shotYaw = this.shot.yaw + orbit;
    this.pose.yaw = this.yaw + angleDelta(this.yaw, shotYaw) * b;
    this.pose.pitch = PITCH * DEG + (this.shot.pitch - PITCH * DEG) * b;
    this.pose.distance = this.dist + (this.shot.distance - this.dist) * b;
    this.pose.center.lerpVectors(this.target, this.shot.center, b);
    if (aim > 0) {
      // dolly toward the cue target: aim the orbit centre at it and shorten the distance by `push`
      _dolly.lerpVectors(this.shot.center, this.cueTarget, aim);
      this.pose.center.lerp(_dolly, b);
      this.pose.distance = Math.max(1, this.pose.distance - push * b);
    }
    orbitPosition(this.pose, this.camera.position);
    if (b > 0) this.avoidCrowns(b);
    this.camera.lookAt(this.pose.center);
    if (b > 0 && this.shotTilt !== 0) this.camera.rotateX(-this.shotTilt * b);   // T2: content up into the band

    // DOF focus: the feet in the diorama (held when nothing is followed), the shot's focus (arena centre /
    // inspected creature, pulled toward the cue target) in a shot
    if (b > 0) {
      this.focus.lerpVectors(this.followed !== null ? this.focus : this.target, this.shotFocus, b);
      if (aim > 0) this.focus.lerp(this.cueTarget, aim * b);
    }

    // shake: rotation about right/up after the pose, plus roll
    if (this.shakeLeft > 0) {
      if (!this.o.effects().shake) { this.shakeLeft = 0; }
      else {
        this.shakeLeft = Math.max(0, this.shakeLeft - dt);
        this.shakeClock += dtS;
        const mag = this.shakeOffset;
        const fd = Math.max(1, this.camera.position.distanceTo(this.focus));
        const a = mag / fd;
        this.camera.rotateX(a * Math.sin(TAU * SHAKE_HZ[0] * this.shakeClock + SHAKE_PHASE[0]));
        this.camera.rotateY(a * Math.sin(TAU * SHAKE_HZ[1] * this.shakeClock + SHAKE_PHASE[1]));
        this.camera.rotateZ(mag * SHAKE_ROLL_DEG * DEG * Math.sin(TAU * SHAKE_HZ[2] * this.shakeClock + SHAKE_PHASE[2]));
      }
    }
    this.camera.updateMatrixWorld();

    if (this.settledPending) { this.settledPending = false; this.o.onSettled?.(); }
  }

  /**
   * H11: a battle / inspector shot never puts the camera inside (or behind) a tree crown: the camera is pulled in
   * along the orbit ray to just before the first crown it would cross, by the shot blend (the diorama camera, high
   * above the canopy, is left alone). Zero allocation.
   */
  private avoidCrowns(b: number): void {
    const occ = this.o.occluders?.() ?? null;
    if (occ === null) return;
    const c = this.pose.center; const p = this.camera.position;
    const t = occ.crownClearance(c.x, c.y, c.z, p.x, p.y, p.z);
    if (!(t < 1)) return;
    const d = Math.max(this.pose.distance, MIN_SHOT_DISTANCE_M);
    const k = Math.min(1, Math.max(MIN_SHOT_DISTANCE_M / d, t - CROWN_MARGIN_M / d));
    const f = 1 + (k - 1) * b;
    p.set(c.x + (p.x - c.x) * f, c.y + (p.y - c.y) * f, c.z + (p.z - c.z) * f);
  }

  setAspect(aspect: number): void {
    if (!(aspect > 0)) return;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // ---- extras (documented in IMPLEMENTATION-NOTES "Part 3") ----------------------------------------------------

  /** Teleports the diorama target/focus to (x, y, z) when nothing is followed (sandbox, harness `setShot`). */
  setFocus(x: number, y: number, z: number): void {
    this.focus.set(x, y, z);
    this.goal.set(x, y, z);
    this.target.set(x, y, z);
    this.vel.set(0, 0, 0);
  }

  /** Stage → rig: where the cue kinds point (attacker / defender battler feet, the fainting battler, the orb target). */
  setCueTarget(kind: 'attacker' | 'defender' | 'ko' | 'throw', p: Vector3): void {
    this.cueTargets[kind].copy(p);
  }

  /**
   * T2 (IMPLEMENTATION-NOTES Part 5): the shares of the viewport height a battle shot must keep clear — the DOM battle
   * panel at the bottom, the far battler's HP-bar allowance at the top. Default: no top inset, the SPEC panel (bottom
   * 28 % + margin). During a battle the framing eases to the new values.
   */
  setShotInsets(topFrac: number, bottomFrac: number): void {
    const t = Number.isFinite(topFrac) ? Math.min(1, Math.max(0, topFrac)) : 0;
    const b = Number.isFinite(bottomFrac) ? Math.min(1, Math.max(0, bottomFrac)) : PANEL_DEFAULT_FRACTION;
    if (t === this.insetTop && b === this.insetBottom) return;
    this.insetTop = t; this.insetBottom = b;
    this.reframe();
  }

  /** T2: the tallest battler (m) of the near (player's) side and of the far side; the stage reports them on every layout. */
  setBattleSubjects(nearM: number, farM: number): void {
    const n = nearM > 0 ? nearM : NOMINAL_BATTLER_HEIGHT_M; const f = farM > 0 ? farM : NOMINAL_BATTLER_HEIGHT_M;
    if (n === this.subjectNear && f === this.subjectFar) return;
    this.subjectNear = n; this.subjectFar = f;
    this.reframe();
  }

  /** The battle framing in use (T2; distance before crown avoidance, tilt in rad). */
  get battleFramingNow(): Readonly<Framing> { return this.framing; }
  get tiltNow(): number { return this.mode === 'battle' ? this.shotTilt : 0; }

  private reframe(): void {
    battleFraming(this.camera.fov, this.insetTop, this.insetBottom, this.subjectNear, this.subjectFar, this.framing);
    if (this.mode !== 'battle') return;
    this.frameFromD = this.shot.distance; this.frameFromTilt = this.shotTilt;
    this.frameToD = this.framing.distance; this.frameToTilt = this.framing.tilt;
    this.frameT = 0;
  }

  /** Inspector close-up (§10.7.5 `stage.inspect`): the camera 4 m from `aim`; `release(ms)` exits. */
  inspect(aim: Vector3, ms: number): void {
    inspectPose(aim, this.yawTo, this.shot);
    this.shotTilt = 0;
    this.frameT = 1;
    this.shotFocus.copy(aim);
    this.enterShot('inspect', ms);
  }

  /** Current shake offset magnitude in world units (Pillar 8 hook: 0 whenever effects.shake is false). */
  get shakeOffset(): number {
    return this.shakeLeft > 0 && this.shakeMs > 0 ? this.shakeAmp * (this.shakeLeft / this.shakeMs) : 0;
  }

  get currentMode(): Mode { return this.mode; }
  get followedActor(): string | null { return this.followed; }
  get headingIndex(): 0 | 1 | 2 | 3 { return this.heading; }
  get zoomStop(): 0 | 1 | 2 { return this.zoom; }
  /** 0 = diorama pose, 1 = shot pose (battle / inspector). */
  get shotBlend(): number { return this.blend; }
  /** The blended orbit pose of the last update (read-only view). */
  get orbit(): Readonly<OrbitPose> { return this.pose; }
  /** Diorama yaw target (radians) — the heading the battle pose is built from. */
  get dioramaYaw(): number { return this.yawTo; }
  /** Horizontal forward of the diorama heading (camera → scene). */
  dioramaForward(out: Vector3): Vector3 { return forwardOfYaw(this.yawTo, out); }
  /** Whether a cue is playing. */
  get cueActive(): boolean { return this.cueWork !== null; }

  // ---- internals ---------------------------------------------------------------------------------------------

  private enterShot(mode: Mode, ms: number): void {
    this.mode = mode;
    // finish any heading/zoom ease so the shot is built from a settled diorama pose
    this.yaw = this.yawTo; this.yawT = 1; this.dist = this.distTo; this.distT = 1;
    this.startBlend(1, ms);
  }

  private startBlend(to: number, ms: number): void {
    this.blendFrom = this.blend;
    this.blendTo = to;
    this.blendMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
    this.blendT = 0;
    if (this.blendMs === 0) { this.blend = to; this.blendT = 1; }
  }
}

export type { CueKind };
/** Horizontal forward helper re-exported for the stage. */
export { forwardOfYaw };
/** Current camera forward (world), scratch-safe helper for other subsystems. */
export function cameraForward(camera: PerspectiveCamera, out: Vector3): Vector3 {
  return camera.getWorldDirection(out);
}
