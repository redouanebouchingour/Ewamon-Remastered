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
import { Quaternion, Vector3 } from 'three/webgpu';
import type { PerspectiveCamera } from 'three/webgpu';
import type { CameraRig } from '../contracts.js';
import type { EffectsFlags } from '../descriptors.js';
import {
  BATTLER_SEPARATION, CAMERA_WORK, FRAME_BOTTOM_GAP, FRAMING_EASE_MS, NOMINAL_BATTLER_HEIGHT_M, PANEL_DEFAULT_FRACTION, battleFraming, battlePose,
  cueEnvelope, cueInMs, cueTotalMs,
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

// #region constants — free orbit (implementation values, IMPLEMENTATION-NOTES "CameraRig.orbitBy")
/** Headings per turn (HEADING_STEP · HEADINGS = 360°). */
const HEADINGS = 4;
/** A yaw within this many radians of a heading counts as on the grid. */
const ON_GRID_RAD = 1e-6;
// #endregion

// #region constants — follow spring integration (implementation value)
/**
 * Longest semi-implicit Euler step of the follow spring (s). The integrator is stable only for dt < τ (0.12 s); a
 * longer frame (a shader-compile stall, a starved tab at ~4 fps) is integrated in sub-steps of at most this length.
 */
export const SPRING_MAX_STEP_S = 1 / 60;
// #endregion

// #region constants — battle cues inside the band (implementation value, IMPLEMENTATION-NOTES Part 5, T2)
/** Bisection steps when a cue must be scaled back to keep both battlers above the panel (1/64 resolution). */
export const CUE_FIT_STEPS = 6;
/** A shake uses at most 1 / this of the band's remaining room (off-centre points move more than the axis). */
export const SHAKE_BAND_SAFETY = 1.5;
/** A cue keeps both battlers' anchors inside this NDC |x| (room for the creature's half width and its bar). */
export const FRAME_SIDE_NDC = 0.72;
/** A final tilt correction smaller than this (NDC) is skipped. */
export const TILT_EPS_NDC = 1e-4;
/** A battle shot whose orbit ray enters a crown first tries these yaw offsets (degrees) for a clear ray (T2 + H11). */
export const CROWN_YAW_STEPS = [15, -15, 30, -30, 45, -45] as const;
// #endregion

// #region constants — shot camera vs tree crowns (implementation values, IMPLEMENTATION-NOTES Part 4, H11)
/** A battle / inspector camera stops this far (m) in front of the first crown between it and the orbit centre. */
export const CROWN_MARGIN_M = 0.4;
/** ... but never closer to the orbit centre than this (m). */
export const MIN_SHOT_DISTANCE_M = 3;
// #endregion

// #region constants — first-person view (client NPC-voice build, IMPLEMENTATION-NOTES "First-person view")
/**
 * Eye height above the followed actor's feet (m), and how far in front of the body's axis the camera sits (m). The
 * chibi rigs are 1.54 m tall and 0.70 m deep (measured on ranger_lad): the face is 0.35 m in front of the axis, the
 * eyes ~1.2 m up. The camera sits just in front of the face (the client also hides the player's own body).
 */
export const FP_EYE_HEIGHT_M = 1.2;
export const FP_EYE_FORWARD_M = 0.4;
/** Vertical FOV (degrees) and near plane (m) while in first person (the diorama's 28° / 0.5 m are restored after). */
export const FP_FOV_V = 70;
export const FP_NEAR_M = 0.08;
/** Pitch clamp (degrees). */
export const FP_PITCH_MAX = 80;
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

/** The §10.7.1 heading yaw in radians; `baseDeg` is the diorama yaw base (Phase A: a hall's axis, `setYawBase`). */
export function headingYaw(h: number, baseDeg: number = YAW_BASE): number {
  return (baseDeg + HEADING_STEP * h) * DEG;
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
/** The body's root position and tilt while it breakdances (`CharacterPool.bodyTilt`); false when upright. */
export type BodyTiltResolver = (actorId: string, outPos: Vector3, outQ: Quaternion) => boolean;

export interface DioramaRigOptions {
  readonly effects: () => EffectsFlags;
  readonly feet?: FeetResolver;
  /** First person rides the followed body's tilt (the breakdance); absent = always upright. */
  readonly bodyTilt?: BodyTiltResolver;
  /** Called when a heading/zoom ease ends (§10.7.1's `csm.updateFrustums()`; the cached sun shadows need none). */
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
const _bodyPos = new Vector3();
const _bodyQ = new Quaternion();
const _band = new Vector3();
const _rows = { feet: 0, top: 0, side: 0 };
const _clear = new Vector3();
const _fwdBand = new Vector3();

export class DioramaRig implements CameraRig {
  readonly focus = new Vector3();
  // diorama state
  private heading: 0 | 1 | 2 | 3 = 0;
  private yawBase: number = YAW_BASE;
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
  private frameMs: number = FRAMING_EASE_MS;
  private cueScale = 1;
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
  // first person: the look the client sets each frame (null = the diorama); the lens it last applied
  private fp: { yaw: number; pitch: number } | null = null;
  private fpLens = false;
  private fpActive = false;   // whether the last update posed the eye in first person (the occluder fade is off then)
  private dioramaNear = 0;
  // blended pose (exposed for tests / HUD)
  private readonly pose: OrbitPose = { center: new Vector3(), yaw: 0, pitch: PITCH * DEG, distance: DISTANCE[DEFAULT_ZOOM_STOP] };

  constructor(readonly camera: PerspectiveCamera, private readonly o: DioramaRigOptions) {
    camera.fov = FOV_V;
    camera.updateProjectionMatrix();
    this.update(0);
  }

  // ---- §10.7.2 -------------------------------------------------------------------------------------------------

  /**
   * First-person view: `view` = the look (yaw in the diorama convention — forward is (−sin yaw, −cos yaw) — and pitch
   * in radians, clamped to ±FP_PITCH_MAX); null = back to the diorama. Applies only to the diorama pose of a followed
   * actor: a battle / inspector shot blends from and releases to the diorama as before (the client turns first person
   * off for those).
   */
  setFirstPerson(view: { readonly yaw: number; readonly pitch: number } | null): void {
    if (view === null || !Number.isFinite(view.yaw) || !Number.isFinite(view.pitch)) {
      this.fp = null;
      return;
    }
    const lim = FP_PITCH_MAX * DEG;
    const pitch = Math.max(-lim, Math.min(lim, view.pitch));
    if (this.fp === null) this.fp = { yaw: view.yaw, pitch };
    else {
      this.fp.yaw = view.yaw;
      this.fp.pitch = pitch;
    }
  }

  get firstPerson(): boolean { return this.fp !== null; }
  /** True when the last `update` posed the eye in first person (a look is set, diorama mode, no shot, a followed actor). */
  get firstPersonActive(): boolean { return this.fpActive; }

  /** Switches the lens between the diorama's (28°, near 0.5 m) and first person's (70°, near 0.08 m). */
  private applyLens(fp: boolean): void {
    if (fp === this.fpLens) return;
    this.fpLens = fp;
    if (fp) this.dioramaNear = this.camera.near;
    this.camera.fov = fp ? FP_FOV_V : FOV_V;
    this.camera.near = fp ? FP_NEAR_M : this.dioramaNear;
    this.camera.updateProjectionMatrix();
  }

  setHeading(h: 0 | 1 | 2 | 3): void {
    // a free orbit (`orbitBy`) can leave the yaw between headings: the same index then still eases back onto the grid
    if (this.mode !== 'diorama' || (h === this.heading && Math.abs(angleDelta(this.yawTo, headingYaw(h, this.yawBase))) < ON_GRID_RAD)) return;
    this.heading = h;
    this.yawFrom = this.yaw;
    this.yawTo = this.yaw + angleDelta(this.yaw, headingYaw(h, this.yawBase));
    this.yawT = 0;
  }

  /**
   * A drag over the canvas: turns the diorama yaw by `rad` at once (no ease; the drag itself is the motion). The
   * heading index follows the nearest 90° step, so the rotate keys and the hall / interior logic keep working.
   */
  orbitBy(rad: number): void {
    if (this.mode !== 'diorama' || !Number.isFinite(rad) || rad === 0) return;
    this.yaw = this.yawTo + rad;
    this.yawFrom = this.yawTo = this.yaw;
    this.yawT = 1;
    const k = Math.round(angleDelta(headingYaw(0, this.yawBase), this.yaw) / (HEADING_STEP * DEG));
    this.heading = (((k % HEADINGS) + HEADINGS) % HEADINGS) as 0 | 1 | 2 | 3;
  }

  /**
   * Phase A: the diorama yaw base in degrees (headings become base + 90°·k; the current heading index is kept); null
   * restores the default diagonal. Eases like a heading turn; during a battle / inspector shot the new yaw applies to
   * the diorama pose the shot releases to (the shot itself keeps the yaw it was built from).
   */
  setYawBase(deg: number | null): void {
    const b = deg === null || !Number.isFinite(deg) ? YAW_BASE : deg;
    if (b === this.yawBase) return;
    this.yawBase = b;
    this.yawFrom = this.yaw;
    this.yawTo = this.yaw + angleDelta(this.yaw, headingYaw(this.heading, b));
    this.yawT = 0;
  }

  /** The diorama yaw base in degrees (YAW_BASE unless a hall set its axis). */
  get yawBaseDeg(): number { return this.yawBase; }

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
    this.clearShotYaw();
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
      this.frameT = Math.min(1, this.frameT + dt / Math.max(1, this.frameMs));
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

    // blend the orbit parameters: diorama ↔ shot; a battle cue is scaled back until both battlers stay in the band
    // above the DOM panel (T2 / M2-battle-5: the impact push had put the near battler below the frame)
    const b = this.blend;
    let k = 1;
    this.composePose(b, orbit, push, aim);
    const banded = this.mode === 'battle' && b > 0;
    if (w !== null && banded && this.bandSlack() < 0) {
      let lo = 0; let hi = 1;
      for (let i = 0; i < CUE_FIT_STEPS; i++) {
        const m = (lo + hi) / 2;
        this.composePose(b, orbit * m, push * m, aim * m);
        if (this.bandSlack() >= 0) lo = m; else hi = m;
      }
      k = lo;
      this.composePose(b, orbit * k, push * k, aim * k);
    }
    aim *= k;
    this.cueScale = k;
    // the shake may use what is left of the band (a rotation of α moves NDC y by ≈ α / tan(fov/2))
    const shakeRoom = banded ? Math.max(0, this.bandSlack()) * Math.tan((this.camera.fov * DEG) / 2) / SHAKE_BAND_SAFETY : Number.POSITIVE_INFINITY;

    // DOF focus: the feet in the diorama (held when nothing is followed), the shot's focus (arena centre /
    // inspected creature, pulled toward the cue target) in a shot
    if (b > 0) {
      this.focus.lerpVectors(this.followed !== null ? this.focus : this.target, this.shotFocus, b);
      if (aim > 0) this.focus.lerp(this.cueTarget, aim * b);
    }

    // first person: the eye at the followed actor's head, looking along the client's yaw / pitch (focus stays the feet)
    const fpOn = this.fp !== null && this.mode === 'diorama' && b === 0 && this.followed !== null;
    this.applyLens(fpOn);
    this.fpActive = fpOn;
    if (fpOn) {
      const f = this.fp!;
      const fx = -Math.sin(f.yaw);
      const fz = -Math.cos(f.yaw);
      const cp = Math.cos(f.pitch);
      this.camera.position.set(this.focus.x + fx * FP_EYE_FORWARD_M, this.focus.y + FP_EYE_HEIGHT_M, this.focus.z + fz * FP_EYE_FORWARD_M);
      _pos.set(this.camera.position.x + fx * cp, this.camera.position.y + Math.sin(f.pitch), this.camera.position.z + fz * cp);
      this.camera.lookAt(_pos);
      // a breakdancing body: the eye stays at the head and turns with it — spins, flips, upside down
      if (this.o.bodyTilt?.(this.followed!, _bodyPos, _bodyQ) === true) {
        _pos.set(fx * FP_EYE_FORWARD_M, FP_EYE_HEIGHT_M, fz * FP_EYE_FORWARD_M).applyQuaternion(_bodyQ);
        this.camera.position.copy(_bodyPos).add(_pos);
        this.camera.quaternion.premultiply(_bodyQ);
      }
      this.camera.updateMatrixWorld();
    }

    // shake: rotation about right/up after the pose, plus roll
    if (this.shakeLeft > 0) {
      if (!this.o.effects().shake) { this.shakeLeft = 0; }
      else {
        this.shakeLeft = Math.max(0, this.shakeLeft - dt);
        this.shakeClock += dtS;
        // first person: the eye is ~1.4 m from the feet; shake as at the diorama distance, not ~18× harder
        const fd = fpOn ? DISTANCE[DEFAULT_ZOOM_STOP] : Math.max(1, this.camera.position.distanceTo(this.focus));
        const mag = Math.min(this.shakeOffset, shakeRoom * fd);     // T2: never shakes a battler out of the band
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
   * T2 + H11: pulling the camera in front of a crown (below) shrinks the battle shot until both battlers cannot fit
   * above the panel (7.6 m measured in a mire_route grove), so a battle shot first orbits to the nearest yaw offset
   * whose ray from the arena centre is clear of every crown; none clear → the pose stays and the pull-in applies.
   */
  private clearShotYaw(): void {
    const occ = this.o.occluders?.() ?? null;
    if (occ === null) return;
    const c = this.shot.center; const base = this.shot.yaw;
    const clear = (): boolean => { orbitPosition(this.shot, _clear); return !(occ.crownClearance(c.x, c.y, c.z, _clear.x, _clear.y, _clear.z) < 1); };
    if (clear()) return;
    for (const off of CROWN_YAW_STEPS) {
      this.shot.yaw = base + off * DEG;
      if (clear()) return;
    }
    this.shot.yaw = base;
  }

  /** The orbit pose, camera position (crown-avoided), look-at and band tilt for blend `b` and cue components. */
  private composePose(b: number, orbit: number, push: number, aim: number): void {
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
    this.camera.updateMatrixWorld();
    if (b > 0 && this.mode === 'battle') this.correctTilt(b);
  }

  /**
   * T2: the framing was solved for the orbit distance; a crown can pull the camera in (H11) and a cue moves it, so the
   * final camera is re-checked: the view is tilted until the near battler's feet clear the band's bottom (the panel),
   * and down again while the tops are above its top as far as the feet allow — the player's battler wins when both
   * cannot fit (the far bar is clamped inside the screen by the HUD). Two passes (the NDC ↔ angle map is not linear).
   */
  private correctTilt(b: number): void {
    const t = Math.tan((this.camera.fov * DEG) / 2);
    const bottom = 1 - 2 * Math.min(1, 1 - this.insetBottom - FRAME_BOTTOM_GAP);
    const top = 1 - 2 * this.insetTop;
    for (let pass = 0; pass < 2; pass++) {
      this.bandRows();
      const need = bottom - _rows.feet;                // > 0: the feet are below the band
      const room = top - _rows.top;                    // < 0: a top is above the band
      let sh = 0;
      if (need > 0) sh = need;
      else if (room < 0) sh = Math.max(room, need);    // move down, but never below the feet's limit
      if (Math.abs(sh) < TILT_EPS_NDC) return;
      this.camera.rotateX(-Math.atan(sh * t) * b);
      this.camera.updateMatrixWorld();
    }
  }

  /** NDC y of the lower feet and the higher top of the two battlers for the current camera (into `_rows`). */
  private bandRows(): void {
    const c = this.shot.center; const half = BATTLER_SEPARATION / 2;
    forwardOfYaw(this.yawTo, _fwdBand);
    _rows.feet = Number.POSITIVE_INFINITY; _rows.top = Number.NEGATIVE_INFINITY; _rows.side = 0;
    for (let side = 0; side < 2; side++) {
      const s = side === 0 ? -half : half;
      _band.set(c.x + _fwdBand.x * s, c.y, c.z + _fwdBand.z * s).project(this.camera);
      if (_band.y < _rows.feet) _rows.feet = _band.y;
      _rows.side = Math.max(_rows.side, Math.abs(_band.x));
      _band.set(c.x + _fwdBand.x * s, c.y + (side === 0 ? this.subjectNear : this.subjectFar), c.z + _fwdBand.z * s).project(this.camera);
      if (_band.y > _rows.top) _rows.top = _band.y;
      _rows.side = Math.max(_rows.side, Math.abs(_band.x));
    }
  }

  /**
   * T2: how far (NDC y) both battlers — nominal slots on the arena axis, the reported heights — are inside the band:
   * the feet above `1 − insetBottom − gap`, the tops below `insetTop` (which holds the HP-bar allowance). Negative =
   * outside. Zero allocation.
   */
  private bandSlack(): number {
    const bottom = 1 - 2 * Math.min(1, 1 - this.insetBottom - FRAME_BOTTOM_GAP);
    const top = 1 - 2 * this.insetTop;
    this.bandRows();
    return Math.min(_rows.feet - bottom, top - _rows.top, FRAME_SIDE_NDC - _rows.side);
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
    this.frameMs = FRAMING_EASE_MS;
  }

  /**
   * Inspector close-up (§10.7.5 `stage.inspect`): the camera 4 m from `aim` (or `distance` m — the evolution sequence
   * frames the taller of two forms); `release(ms)` exits.
   */
  inspect(aim: Vector3, ms: number, distance?: number): void {
    inspectPose(aim, this.yawTo, this.shot);
    if (distance !== undefined && Number.isFinite(distance) && distance > 0) this.shot.distance = distance;
    this.shotTilt = 0;
    this.frameT = 1;
    this.shotFocus.copy(aim);
    this.enterShot('inspect', ms);
  }

  /**
   * Eases the current shot's orbit distance to `distance` m over `ms` (smoothstep): the evolution sequence's slow
   * push toward the creature during its build-up. Ignored in the diorama pose.
   */
  dollyShot(distance: number, ms: number): void {
    if (this.mode === 'diorama' || !(Number.isFinite(distance) && distance > 0)) return;
    this.frameFromD = this.shot.distance; this.frameToD = distance;
    this.frameFromTilt = this.shotTilt; this.frameToTilt = this.shotTilt;
    this.frameMs = Number.isFinite(ms) && ms > 0 ? ms : FRAMING_EASE_MS;
    this.frameT = 0;
  }

  /** The current shot's orbit distance (m; the inspector's 4 m, a battle framing, a dolly in progress). */
  get shotDistance(): number { return this.shot.distance; }

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
  /** The share of the current cue's push / orbit / aim that keeps both battlers in the band (1 = the full row; T2). */
  get cueFit(): number { return this.cueScale; }

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
