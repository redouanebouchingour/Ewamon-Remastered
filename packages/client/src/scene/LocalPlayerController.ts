/**
 * SPEC §20.4.5 — LocalPlayerController: input sampling, client prediction with protocol's `stepMovement`, input
 * messages at 20 Hz and reconciliation against the server's acked `seq`.
 *
 * Numbers: `seq` is a uint32 from 1, incremented per SENT message. Every 50 ms of accumulated fixed steps an
 * `input { seq, x, z, angle, running, dtMs }` goes out (skipped while standing still). The pending ring holds 64
 * STEP entries `{ seq, ax, az, running, dtMs }` (`Float32Array(64*4)` + `Uint32Array(64)`, allocated once; overflow
 * drops the oldest) tagged with the seq of the message that carries them, so a replay reproduces the prediction
 * exactly. A second small ring remembers the pose each message was sent with (IMPLEMENTATION-NOTES part 2, P1): the
 * server echoes the client's own position, so "the server agrees" means ack pose == the pose sent under that seq.
 *
 * reconcile(sx, sz, sa, acked): drop entries ≤ acked; agree (< 0.01 u) → return; otherwise rewind to the server
 * pose and re-run `stepMovement` over the remaining entries; a correction > 4.0 u snaps (a "rubber-band" in the dev
 * HUD), anything smaller blends the RENDER offset linearly over 100 ms — simulation state is never blended.
 * React-free and allocation-free on the sample / step / reconcile path.
 *
 * Phase D11 bike: `setBike(true)` rides at `MOVEMENT.bikeSpeed` (stepMovement's `bike`); a step entry stores its gait
 * as 0 walk / 1 run / 2 bike so a replay rides too, and a message carries `bike: true` when any step of its window was
 * ridden (the server's per-message cap is the bike cap only for an owner outdoors — World3D enforces the same rules
 * before it turns the bike on, and turns it off when they stop holding).
 *
 * Followers with field powers (SPEC §3.18): with a `glider` set (World3D: FIELD_POWERS on in this room, a Flying lead,
 * outdoors, on foot), a step the collider would stop at a drop asks content's `planGlide` (the server's rule, over the
 * collider's own `passable`) and, when it answers, the controller glides: every step moves along the plan's line at
 * `GLIDE.speedMps` whatever the keys say, until the landing. A glide step is stored as gait 3 with the plan's direction,
 * so a replay glides too; every message of a glide window carries `glide { x, z, dx, dz }` (the take-off the server
 * re-plans from). The probe must stay blocked for `GLIDE_INTENT_STEPS` steps (a push toward the drop, not a slide along a
 * ledge). Any correction mid-glide ends the glide and rests take-offs for 3 s, so a refusal never loops.
 */
import { GLIDE } from '@ewa/content';
import type { GlidePlan } from '@ewa/content';
import { MOVEMENT, stepMovement, wrapAngle } from '@ewa/protocol';
import type { MoveInput, MovePose } from '@ewa/protocol';
import type { StepCollider } from './collider';
import { HELD } from './input';

export const PENDING_CAPACITY = 64;
export const SENT_CAPACITY = 32;
export const SEND_INTERVAL_MS = 1000 / MOVEMENT.sendHz;
export const AGREE_EPS = 0.01;
export const SNAP_DISTANCE = 4.0;
export const RENDER_BLEND_MS = 100;

/** The mutable input payload (validated and sent by WorldSession.send). `bike` (Phase D11): the window was ridden. */
export interface InputPayload { seq: number; x: number; z: number; angle: number; running: boolean; dtMs: number; bike: boolean; glide?: { x: number; z: number; dx: number; dz: number } }

/** Followers: a refused glide rests the take-off this many fixed steps (3 s), so a refusal never loops. */
export const GLIDE_REST_STEPS = 180;
/** Followers: the probe ahead of a blocked step that asks for a glide (m). */
export const GLIDE_PROBE_M = 0.6;
/** Followers: steps the player must push toward the drop before a glide is asked for (0.1 s: an intent, not a slide). */
export const GLIDE_INTENT_STEPS = 6;

export interface LocalPlayerDeps {
  /** held-key latch from input.ts */
  readonly held: Uint8Array;
  /** diorama yaw target (radians): movement is camera-relative */
  readonly cameraYaw: () => number;
  /** true when movement keys must be ignored this frame (typing, battle, dialogue, modal, chat) */
  readonly blocked: () => boolean;
  readonly send: (p: InputPayload) => void;
  /** a correction above SNAP_DISTANCE (teleport, join, handover): the camera jumps with it */
  readonly onSnap?: () => void;
}

export class LocalPlayerController {
  readonly pose: MovePose = { x: 0, z: 0, angle: 0, vx: 0, vz: 0 };
  /** Where the avatar is drawn: pose + a linearly decaying correction offset. */
  renderX = 0;
  renderZ = 0;
  rubberBands = 0;
  /** last correction distance (dev HUD "prediction error") */
  lastError = 0;
  /** corrections below the snap distance (blended) */
  corrections = 0;

  private collider: StepCollider | null = null;
  private enabled = true;
  /** Phase D11: riding the bicycle */
  private bike = false;
  private readonly input: { ax: number; az: number; running: boolean; bike: boolean } = { ax: 0, az: 0, running: false, bike: false };
  private readonly replayInput: { ax: number; az: number; running: boolean; bike: boolean } = { ax: 0, az: 0, running: false, bike: false };
  private readonly payload: InputPayload = { seq: 0, x: 0, z: 0, angle: 0, running: false, dtMs: 1, bike: false };
  /** a glide window's message (a separate object, so a plain message never carries an undefined `glide` key) */
  private readonly glidePayload: InputPayload & { glide: { x: number; z: number; dx: number; dz: number } } = {
    seq: 0, x: 0, z: 0, angle: 0, running: true, dtMs: 1, bike: false, glide: { x: 0, z: 0, dx: 0, dz: 1 },
  };
  /** followers: the glide in flight, how far along it the pose is, the plan the current window glided on */
  private glide: GlidePlan | null = null;
  private glideT = 0;
  private glideWindow: GlidePlan | null = null;
  private glideRest = 0;
  private edgeSteps = 0;
  /**
   * Followers with field powers: the glide rule for this zone and lead (null = no glides): content's `planGlide` over
   * the collider's `passable`. `onGlide` hears a take-off (the gust, the sound).
   */
  glider: ((x: number, z: number, dx: number, dz: number) => GlidePlan | null) | null = null;
  onGlide: ((p: GlidePlan) => void) | null = null;
  // pending step ring
  private readonly stepSeq = new Uint32Array(PENDING_CAPACITY);
  private readonly stepData = new Float32Array(PENDING_CAPACITY * 4);
  private stepHead = 0;
  private stepCount = 0;
  // sent-pose ring
  private readonly sentSeq = new Uint32Array(SENT_CAPACITY);
  private readonly sentPose = new Float64Array(SENT_CAPACITY * 5);
  private sentHead = 0;
  private sentCount = 0;
  private nextSeq = 1;
  private accumMs = 0;
  private ranInWindow = false;
  private bikedInWindow = false;
  private lastSentBike = false;
  private lastSentX = Number.NaN;
  private lastSentZ = Number.NaN;
  private lastSentAngle = Number.NaN;
  private lastSentRunning = false;
  private ackSeq = 0;
  private ackX = Number.NaN;
  private ackZ = Number.NaN;
  /** messages up to this seq were computed from a pose the server rejected; their acks report `base` */
  private staleUpTo = 0;
  private baseX = Number.NaN;
  private baseZ = Number.NaN;
  private sentVx = 0;
  private sentVz = 0;
  private blendLeft = 0;
  private offX = 0;
  private offZ = 0;
  private placed = false;

  constructor(private readonly deps: LocalPlayerDeps) {}

  get isEnabled(): boolean {
    return this.enabled;
  }
  get pendingCount(): number {
    return this.stepCount;
  }
  get lastSeq(): number {
    return this.nextSeq - 1;
  }
  /** false until the first server position arrived */
  get isPlaced(): boolean {
    return this.placed;
  }
  get moving(): boolean {
    return Math.abs(this.pose.vx) + Math.abs(this.pose.vz) > 0.05;
  }
  get running(): boolean {
    return this.input.running;
  }
  /** Phase D11: riding the bicycle. */
  get biking(): boolean {
    return this.bike;
  }
  /** Followers: the glide in flight (null on the ground) and how far along it the pose is (m). */
  get gliding(): GlidePlan | null {
    return this.glide;
  }
  get glideAt(): number {
    return this.glideT;
  }

  /** Phase D11: mounts / dismounts (World3D checks ownership, indoors and water first). */
  setBike(on: boolean): void {
    this.bike = on;
  }

  setCollider(c: StepCollider | null): void {
    this.collider = c;
  }

  /** false during battles / dialogue / modals; zeroes velocity. */
  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) {
      this.pose.vx = 0;
      this.pose.vz = 0;
      this.input.ax = 0;
      this.input.az = 0;
    }
  }

  /**
   * Dev / harness autopilot: a world-space input direction used instead of the keys (the prediction, the collider,
   * the wire and the server validation are the real ones). null = keys.
   */
  override: { ax: number; az: number; running: boolean } | null = null;

  /** NPC talk's kick: a forced run in a world direction for a few steps, even while the dialogue holds the keys. */
  private readonly shoveDir = { ax: 0, az: 0 };
  private shoveLeft = 0;

  /** Knocks the player back: runs along (ax, az) (normalised here) for `ms` through the real prediction and wire. */
  shove(ax: number, az: number, ms: number): void {
    const m = Math.hypot(ax, az);
    if (m < 1e-6) return;
    this.shoveDir.ax = ax / m;
    this.shoveDir.az = az / m;
    this.shoveLeft = ms;
  }

  get shoving(): boolean {
    return this.shoveLeft > 0;
  }

  /** DOM key state → the input frame (camera-relative, normalised). */
  sample(): void {
    const inp = this.input;
    inp.bike = this.bike;
    if (this.enabled && this.shoveLeft > 0) {
      inp.ax = this.shoveDir.ax;
      inp.az = this.shoveDir.az;
      inp.running = true;
      return;
    }
    if (!this.enabled || this.deps.blocked()) {
      inp.ax = 0;
      inp.az = 0;
      inp.running = false;
      return;
    }
    const o = this.override;
    if (o !== null) {
      inp.ax = o.ax;
      inp.az = o.az;
      inp.running = o.running;
      return;
    }
    const h = this.deps.held;
    const fwd = h[HELD.forward]! - h[HELD.back]!;
    const strafe = h[HELD.right]! - h[HELD.left]!;
    const yaw = this.deps.cameraYaw();
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    // forward = (−sin yaw, −cos yaw) (camera → scene), right = (cos yaw, −sin yaw)
    let ax = -s * fwd + c * strafe;
    let az = -c * fwd - s * strafe;
    const m = Math.hypot(ax, az);
    if (m > 1) {
      ax /= m;
      az /= m;
    }
    inp.ax = ax;
    inp.az = az;
    inp.running = h[HELD.run] === 1;
  }

  /** One fixed step: predict, record, and every 50 ms send. */
  step(dtMs: number): void {
    if (this.blendLeft > 0) this.blendLeft = Math.max(0, this.blendLeft - dtMs);
    if (this.shoveLeft > 0) {
      this.shoveLeft = Math.max(0, this.shoveLeft - dtMs);
      if (this.shoveLeft === 0) {
        this.input.ax = 0;
        this.input.az = 0;
        this.input.running = false;
      }
    }
    if (!this.placed) {
      this.writeRender();
      return;
    }
    if (this.glideRest > 0) this.glideRest--;
    if (this.enabled) {
      const inp = this.input;
      const glided = this.glide !== null ? this.glideStep(dtMs) : this.walkStep(inp, dtMs);
      if (!glided) {
        this.pushStep(this.nextSeq, inp.ax, inp.az, inp.running, dtMs, inp.bike);
        if (inp.running) this.ranInWindow = true;
        if (inp.bike) this.bikedInWindow = true;
      }
      this.accumMs += dtMs;
      if (this.accumMs >= SEND_INTERVAL_MS - 0.001) this.maybeSend();
    } else {
      this.accumMs = 0;
    }
    this.writeRender();
  }

  /**
   * Server ack: `players.get(selfId)` changed (seq / x / z).
   *
   * The server validates each message's ABSOLUTE position against its last accepted one, so after a disagreement
   * every message already in flight (computed from the pre-correction pose) will be rejected too. A correction
   * therefore rebases on the server pose, drops the in-flight steps and replays only the steps not yet sent; acks of
   * those stale messages are expected to report the rebase pose (no second correction). Replaying the in-flight steps
   * as well would re-send movement the server cannot accept and cascade rejections while the player keeps moving
   * (IMPLEMENTATION-NOTES part 2, P2).
   */
  reconcile(serverX: number, serverZ: number, serverAngle: number, ackedSeq: number): void {
    if (ackedSeq < this.ackSeq) return;
    // drop acknowledged steps
    while (this.stepCount > 0 && this.stepSeq[this.stepHead]! <= ackedSeq) {
      this.stepHead = (this.stepHead + 1) % PENDING_CAPACITY;
      this.stepCount--;
    }
    // where the server should be after `ackedSeq`: the pose sent under it, or the rebase pose for a stale message
    let ex = Number.NaN;
    let ez = Number.NaN;
    if (ackedSeq === this.ackSeq) {
      ex = this.ackX;
      ez = this.ackZ;
    } else {
      while (this.sentCount > 0) {
        const i = this.sentHead;
        const sq = this.sentSeq[i]!;
        if (sq > ackedSeq) break;
        if (sq === ackedSeq) {
          ex = this.sentPose[i * 5]!;
          ez = this.sentPose[i * 5 + 1]!;
        }
        this.sentHead = (this.sentHead + 1) % SENT_CAPACITY;
        this.sentCount--;
      }
      if (ackedSeq <= this.staleUpTo) {
        ex = this.baseX;
        ez = this.baseZ;
      }
    }
    this.ackSeq = ackedSeq;
    this.ackX = serverX;
    this.ackZ = serverZ;
    if (this.placed && Math.hypot(ex - serverX, ez - serverZ) < AGREE_EPS) return; // NaN (no record) never agrees
    // rebase on the server pose: in-flight steps are dropped, unsent ones replayed
    const oldX = this.renderX;
    const oldZ = this.renderZ;
    const sent = this.nextSeq - 1;
    while (this.stepCount > 0 && this.stepSeq[this.stepHead]! <= sent) {
      this.stepHead = (this.stepHead + 1) % PENDING_CAPACITY;
      this.stepCount--;
    }
    this.sentHead = 0;
    this.sentCount = 0;
    this.staleUpTo = sent;
    this.baseX = serverX;
    this.baseZ = serverZ;
    const pose = this.pose;
    pose.x = serverX;
    pose.z = serverZ;
    pose.angle = wrapAngle(serverAngle);
    pose.vx = this.placed ? this.sentVx : 0;
    pose.vz = this.placed ? this.sentVz : 0;
    // followers: the server accepts every position on a glide it planned too, so a correction mid-glide means it refused
    // the glide (or ended it): the glide ends here, the replay walks, and take-offs rest (a refusal never loops)
    if (this.glide !== null) this.cancelGlide();
    const inp = this.replayInput;
    for (let k = 0; k < this.stepCount; k++) {
      const i = ((this.stepHead + k) % PENDING_CAPACITY) * 4;
      inp.ax = this.stepData[i]!;
      inp.az = this.stepData[i + 1]!;
      const gait = this.stepData[i + 2]!;
      if (gait > 2.5 && this.glide !== null) {
        // a glide step replays along its line
        const g = this.glide;
        this.glideT = Math.min(g.dist, this.glideT + (GLIDE.speedMps * Math.min(MOVEMENT.maxDtMs, this.stepData[i + 3]!)) / 1000);
        pose.x = g.x0 + g.dx * this.glideT;
        pose.z = g.z0 + g.dz * this.glideT;
        if (this.glideT >= g.dist - 1e-6) this.glide = null;
        continue;
      }
      inp.running = (gait > 0.5 && gait < 1.5) || gait > 2.5;
      inp.bike = gait > 1.5 && gait < 2.5;
      this.collider?.begin(pose.x, pose.z);
      stepMovement(pose, inp as MoveInput, this.stepData[i + 3]!, this.collider ?? NO_COLLIDER_STEP);
    }
    // the next message is relative to the server's pose
    this.lastSentX = Number.NaN;
    const err = Math.hypot(oldX - pose.x, oldZ - pose.z);
    this.lastError = err;
    // a non-finite error (no finite render pose to blend from) snaps too
    if (!this.placed || !(err <= SNAP_DISTANCE)) {
      if (this.placed) this.rubberBands++;
      this.placed = true;
      this.offX = 0;
      this.offZ = 0;
      this.blendLeft = 0;
      this.writeRender();
      this.deps.onSnap?.();
      return;
    }
    this.corrections++;
    if (err < AGREE_EPS) return;
    this.offX = oldX - pose.x;
    this.offZ = oldZ - pose.z;
    this.blendLeft = RENDER_BLEND_MS;
    this.writeRender();
  }

  /**
   * One walking step; true when it turned into a take-off instead (the glide step is already taken and recorded). A
   * step toward a drop the collider stops (the probe ahead is not passable) asks the glider for a plan.
   */
  private walkStep(inp: { ax: number; az: number; running: boolean; bike: boolean }, dtMs: number): boolean {
    const pose = this.pose;
    const bx = pose.x;
    const bz = pose.z;
    this.collider?.begin(bx, bz);
    stepMovement(pose, inp as MoveInput, dtMs, this.collider ?? NO_COLLIDER_STEP);
    const g = this.glider;
    const c = this.collider;
    if (g === null || c === null || inp.bike || this.glideRest > 0) return false;
    const m = Math.hypot(inp.ax, inp.az);
    if (m < 0.5) return false;
    const dx = inp.ax / m;
    const dz = inp.az / m;
    if (c.passable(bx + dx * GLIDE_PROBE_M, bz + dz * GLIDE_PROBE_M)) {
      this.edgeSteps = 0;
      return false;
    }
    // held toward the drop for a moment (not a slide along a ledge): ask for a plan
    if (++this.edgeSteps < GLIDE_INTENT_STEPS) return false;
    this.edgeSteps = 0;
    const plan = g(bx, bz, dx, dz);
    if (plan === null) {
      this.glideRest = 12; // walking along an edge with no drop: ask again in 0.2 s
      return false;
    }
    pose.x = bx;
    pose.z = bz;
    this.glide = plan;
    this.glideT = 0;
    this.onGlide?.(plan);
    return this.glideStep(dtMs);
  }

  /** One glide step along the plan (whatever the keys say); recorded as gait 3. Lands at the plan's end. */
  private glideStep(dtMs: number): boolean {
    const p = this.glide!;
    const pose = this.pose;
    const dt = Math.min(MOVEMENT.maxDtMs, dtMs) / 1000;
    this.glideT = Math.min(p.dist, this.glideT + GLIDE.speedMps * dt);
    pose.x = p.x0 + p.dx * this.glideT;
    pose.z = p.z0 + p.dz * this.glideT;
    pose.vx = p.dx * GLIDE.speedMps;
    pose.vz = p.dz * GLIDE.speedMps;
    pose.angle = wrapAngle(Math.atan2(p.dx, p.dz));
    this.pushStep(this.nextSeq, p.dx, p.dz, true, dtMs, false, true);
    this.ranInWindow = true;
    this.glideWindow = p;
    if (this.glideT >= p.dist - 1e-6) this.glide = null; // landed
    return true;
  }

  /** Followers: ends a glide and rests take-offs (a refusal, a zone change). */
  cancelGlide(rest = GLIDE_REST_STEPS): void {
    this.glide = null;
    this.glideT = 0;
    this.glideRest = rest;
  }

  /** Reconnect / zone change: clears the rings; the next server position places the avatar. */
  clear(): void {
    this.glide = null;
    this.glideT = 0;
    this.glideWindow = null;
    this.stepHead = 0;
    this.stepCount = 0;
    this.sentHead = 0;
    this.sentCount = 0;
    this.accumMs = 0;
    this.ackSeq = 0;
    this.ackX = Number.NaN;
    this.ackZ = Number.NaN;
    this.staleUpTo = 0;
    this.baseX = Number.NaN;
    this.baseZ = Number.NaN;
    this.blendLeft = 0;
    this.offX = 0;
    this.offZ = 0;
    this.pose.vx = 0;
    this.pose.vz = 0;
    this.lastSentX = Number.NaN;
    this.placed = false;
  }

  private writeRender(): void {
    if (this.blendLeft <= 0) {
      // no blend: the render pose IS the pose (never `off · 0`, which keeps a NaN offset alive)
      this.renderX = this.pose.x;
      this.renderZ = this.pose.z;
      return;
    }
    const k = this.blendLeft / RENDER_BLEND_MS;
    this.renderX = this.pose.x + this.offX * k;
    this.renderZ = this.pose.z + this.offZ * k;
  }

  private pushStep(seq: number, ax: number, az: number, running: boolean, dt: number, bike = false, glide = false): void {
    let slot: number;
    if (this.stepCount < PENDING_CAPACITY) {
      slot = (this.stepHead + this.stepCount) % PENDING_CAPACITY;
      this.stepCount++;
    } else {
      slot = this.stepHead; // overflow: drop the oldest
      this.stepHead = (this.stepHead + 1) % PENDING_CAPACITY;
    }
    this.stepSeq[slot] = seq;
    const i = slot * 4;
    this.stepData[i] = ax;
    this.stepData[i + 1] = az;
    this.stepData[i + 2] = glide ? 3 : bike ? 2 : running ? 1 : 0;
    this.stepData[i + 3] = dt;
  }

  private maybeSend(): void {
    const pose = this.pose;
    // the server caps the message's displacement by its `running` flag: any running step in the window counts
    // (releasing Shift mid-window would otherwise send a run-speed displacement under the walk cap → a `speed` reject)
    const running = this.ranInWindow;
    this.ranInWindow = false;
    // Phase D11: any ridden step in the window claims the bike cap for the whole message
    const bike = this.bikedInWindow;
    this.bikedInWindow = false;
    const moved = !(pose.x === this.lastSentX && pose.z === this.lastSentZ && pose.angle === this.lastSentAngle && running === this.lastSentRunning && bike === this.lastSentBike);
    const dt = Math.max(1, Math.min(MOVEMENT.maxDtMs, Math.round(this.accumMs)));
    this.accumMs = 0;
    const glided = this.glideWindow;
    this.glideWindow = null;
    if (!moved) return;
    const seq = this.nextSeq;
    this.nextSeq = seq >= 0xffffffff ? 1 : seq + 1;
    // followers: a window with a glide step carries the take-off the server re-plans from
    let p: InputPayload = this.payload;
    if (glided !== null) {
      const gp = this.glidePayload;
      gp.glide.x = glided.x0;
      gp.glide.z = glided.z0;
      gp.glide.dx = glided.dx;
      gp.glide.dz = glided.dz;
      p = gp;
    }
    p.seq = seq;
    p.x = pose.x;
    p.z = pose.z;
    p.angle = pose.angle;
    p.running = running;
    p.dtMs = dt;
    p.bike = bike;
    // remember the pose sent under this seq
    let slot: number;
    if (this.sentCount < SENT_CAPACITY) {
      slot = (this.sentHead + this.sentCount) % SENT_CAPACITY;
      this.sentCount++;
    } else {
      slot = this.sentHead;
      this.sentHead = (this.sentHead + 1) % SENT_CAPACITY;
    }
    this.sentSeq[slot] = seq;
    const j = slot * 5;
    this.sentPose[j] = pose.x;
    this.sentPose[j + 1] = pose.z;
    this.sentPose[j + 2] = pose.angle;
    this.sentPose[j + 3] = pose.vx;
    this.sentPose[j + 4] = pose.vz;
    this.lastSentX = pose.x;
    this.lastSentZ = pose.z;
    this.lastSentAngle = pose.angle;
    this.lastSentRunning = running;
    this.lastSentBike = bike;
    this.sentVx = pose.vx;
    this.sentVz = pose.vz;
    this.deps.send(p);
  }
}

const NO_COLLIDER_STEP = { resolve(): void {} };
