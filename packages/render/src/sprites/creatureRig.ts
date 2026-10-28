/**
 * Rigged 3D creature bodies (addition 2026-10-28, IMPLEMENTATION-NOTES "Rigged creatures"): a creature GLB with a skin
 * and animation clips (`tools/creature-models` rig.mjs) plays its clips by name instead of only bobbing.
 *
 * Clip names are the contract:
 * - `idle` and `walk` loop; the body walks while its feet move faster than `RIG.walkSpeed`.
 * - `idle_*` are fidgets: one plays now and then (`RIG.fidgetS`) while the body idles.
 * - one clip per battle pose (`windup`, `lunge`, `hurt`, `recoil`, `faint`, `celebrate`, `enter`, `exit`), stretched to
 *   the pose's ms; `faint` holds its last frame, `setFaint(p)` scrubs it.
 * A missing clip falls back to the loop (the card's lift / squash / lunge still move the body as a whole).
 *
 * Each body is its own clone of the template (bones, skeleton, mixer); the geometry is shared. The skinned mesh draws
 * with the pool's one model material and the card's per-object record, like a static body.
 */
import { AnimationMixer, LoopOnce, LoopRepeat } from 'three/webgpu';
import type { AnimationAction, AnimationClip, Material, Object3D, SkinnedMesh } from 'three/webgpu';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { BattlerPose } from '../contracts.js';

/** A loaded rig: the GLB's scene (bones + skinned mesh, never drawn itself) and its clips. */
export interface CreatureRigTemplate {
  readonly scene: Object3D;
  readonly clips: readonly AnimationClip[];
}

export const RIG = Object.freeze({
  /** Feet speed (m/s, smoothed) above which the body plays `walk`. */
  walkSpeed: 0.35,
  /** Smoothing of the measured feet speed (1/s). */
  speedRate: 8,
  /** `walk` plays at speed / walkRefSpeed, clamped to walkRate. */
  walkRefSpeed: 2.6,
  walkRate: [0.7, 1.6] as const,
  /** Cross-fades (s): loop to loop, into a one-shot, back to the loop. */
  loopFadeS: 0.3,
  shotFadeS: 0.07,
  backFadeS: 0.3,
  /** Seconds between fidgets while idling: min + hash × spread. */
  fidgetS: [6, 7] as const,
  /** A `windup` with no follow-up holds this long before the loop returns. */
  windupHoldS: 0.6,
  /** The skinned bounds (computed once in the rest pose) grow by this much for the clips' reach. */
  boundsPad: 1.5,
});

/** Deterministic 0..1 per (seed, n): bodies of one species fidget apart, and tests can predict them. */
function hash01(seed: number, n: number): number {
  const s = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function seedOf(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100003;
  return h;
}

/** One rigged body: its clone, mixer and the small state machine that picks the clip. */
export class CreatureRigPlayer {
  /** The clone's root (add to the body group). */
  readonly root: Object3D;
  readonly mesh: SkinnedMesh;
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly fidgets: string[] = [];
  private readonly seed: number;
  private loopName: 'idle' | 'walk' = 'idle';
  /** The action at (or fading to) full weight. */
  private current: AnimationAction | null = null;
  /** The one-shot playing (a pose or a fidget), null while looping. */
  private shot: { readonly name: string; readonly hold: boolean; readonly fidget: boolean } | null = null;
  private heldS = 0;
  /** `setFaint` drives the faint clip's time by hand. */
  private scrubbing = false;
  private fidgetInS: number;
  private fidgetCount = 0;
  private speed = 0;
  private boundsDone = false;
  private disposed = false;

  constructor(t: CreatureRigTemplate, material: Material, userData: Record<string, unknown>, id: string, layers: number, shadowLayer: number) {
    this.seed = seedOf(id);
    this.root = cloneSkinned(t.scene);
    this.root.name = 'ewa:creature-rig';
    let mesh: SkinnedMesh | null = null;
    this.root.traverse((n) => { if (mesh === null && (n as SkinnedMesh).isSkinnedMesh === true) mesh = n as SkinnedMesh; });
    if (mesh === null) throw new Error('@ewa/render: rigged creature without a skinned mesh');
    this.mesh = mesh;
    this.mesh.material = material;
    this.mesh.userData = userData;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.layers.set(layers);
    this.mesh.layers.enable(shadowLayer);
    this.mesh.name = 'ewa:creature-model';
    this.mixer = new AnimationMixer(this.root);
    for (const c of t.clips) {
      this.actions.set(c.name, this.mixer.clipAction(c));
      if (c.name.startsWith('idle_')) this.fidgets.push(c.name);
    }
    this.fidgetInS = this.nextFidgetS();
    const idle = this.actions.get('idle');
    if (idle !== undefined) {
      // a per-id phase: a crowd of one species does not bob in step
      idle.setLoop(LoopRepeat, Infinity).play();
      idle.time = hash01(this.seed, 0.5) * idle.getClip().duration;
      this.current = idle;
    }
    this.mixer.update(0);
  }

  /** Clip names this rig carries. */
  get clipNames(): readonly string[] { return [...this.actions.keys()]; }
  /** The clip at (or fading to) full weight; null when the rig has none. */
  get playing(): string | null { return this.current?.getClip().name ?? null; }

  /** A battle pose: its clip stretched to `ms` (the loop for `idle` or a pose without a clip). */
  setPose(p: BattlerPose, ms: number): void {
    if (this.disposed) return;
    const a = p === 'idle' ? undefined : this.actions.get(p);
    if (a === undefined) { this.toLoop(this.loopName, this.shot !== null ? RIG.backFadeS : RIG.loopFadeS); return; }
    const d = a.getClip().duration;
    this.playShot(p, a, ms > 0 ? d / (ms / 1000) : 1, p === 'faint' || p === 'windup', false);
  }

  /**
   * Plays any clip by name once (a fidget, a pose clip at its authored length), then back to the loop; `idle` / `walk`
   * switch the loop's clip until the feet speed picks again. False when the rig has no such clip. Sandbox / inspection.
   */
  play(name: string): boolean {
    const a = this.actions.get(name);
    if (a === undefined || this.disposed) return false;
    if (name === 'idle' || name === 'walk') this.toLoop(name, RIG.loopFadeS);
    else this.playShot(name, a, 1, name === 'faint', name.startsWith('idle_'));
    return true;
  }

  /** Holds clip `name` at `t01` of its length, alone at full weight (inspection, screenshots); `play` / a pose resumes. */
  scrub(name: string, t01: number): boolean {
    const a = this.actions.get(name);
    if (a === undefined || this.disposed) return false;
    this.mixer.stopAllAction();
    this.playShot(name, a, 1, true, false);
    a.stopFading().setEffectiveWeight(1);
    this.scrubbing = true;
    a.paused = true;
    a.time = Math.min(1, Math.max(0, t01)) * a.getClip().duration;
    this.mixer.update(0);
    return true;
  }

  /** The client's own faint progress (0..1): scrubs `faint`; 0 returns to the loop. */
  setFaint(progress: number): void {
    if (this.disposed) return;
    const a = this.actions.get('faint');
    if (a === undefined) return;
    if (progress <= 0) { if (this.shot?.name === 'faint') this.toLoop(this.loopName, RIG.backFadeS); return; }
    if (this.shot?.name !== 'faint') this.playShot('faint', a, 1, true, false);
    this.scrubbing = true;
    a.paused = true;
    a.time = Math.min(1, progress) * a.getClip().duration;
  }

  /** Per frame: the walk / idle switch from the feet speed, fidgets, one-shot ends. `moved` = metres this frame. */
  update(dtS: number, moved: number): void {
    if (this.disposed || dtS <= 0) return;
    const inst = moved / dtS;
    this.speed += (inst - this.speed) * Math.min(1, dtS * RIG.speedRate);
    const want = this.speed > RIG.walkSpeed && this.actions.has('walk') ? 'walk' : 'idle';
    const walk = this.actions.get('walk');
    if (walk !== undefined) walk.timeScale = Math.min(RIG.walkRate[1], Math.max(RIG.walkRate[0], this.speed / RIG.walkRefSpeed));
    if (want !== this.loopName) {
      this.loopName = want;
      // a fidget gives way to walking at once; a battle pose plays out
      if (this.shot === null || this.shot.fidget) this.toLoop(want, RIG.loopFadeS);
    }
    if (this.shot !== null) {
      const a = this.actions.get(this.shot.name)!;
      // a finished LoopOnce clamps (paused at its last frame)
      const done = a.time >= a.getClip().duration - 1e-4 || !a.enabled;
      if (done && !this.scrubbing) {
        if (!this.shot.hold) this.toLoop(this.loopName, RIG.backFadeS);
        else if (this.shot.name === 'windup' && (this.heldS += dtS) >= RIG.windupHoldS) this.toLoop(this.loopName, RIG.backFadeS);
      }
    } else if (this.loopName === 'idle' && this.fidgets.length > 0 && (this.fidgetInS -= dtS) <= 0) {
      const name = this.fidgets[Math.floor(hash01(this.seed, ++this.fidgetCount) * this.fidgets.length)]!;
      this.playShot(name, this.actions.get(name)!, 1, false, true);
      this.fidgetInS = this.nextFidgetS();
    }
    this.mixer.update(dtS);
    if (!this.boundsDone) this.fitBounds();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.mesh.skeleton.dispose();
    this.root.removeFromParent();
  }

  private playShot(name: string, a: AnimationAction, timeScale: number, hold: boolean, fidget: boolean): void {
    a.reset();
    a.setLoop(LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = timeScale;
    a.paused = false;
    a.play();
    if (this.current !== null && this.current !== a) a.crossFadeFrom(this.current, RIG.shotFadeS, false);
    this.current = a;
    this.shot = { name, hold, fidget };
    this.heldS = 0;
    this.scrubbing = false;
  }

  private toLoop(name: 'idle' | 'walk', fadeS: number): void {
    const a = this.actions.get(name) ?? this.actions.get('idle');
    this.shot = null;
    this.scrubbing = false;
    if (a === undefined || a === this.current) return;
    a.reset();
    a.setLoop(LoopRepeat, Infinity);
    a.play();
    if (this.current !== null) a.crossFadeFrom(this.current, fadeS, false);
    this.current = a;
  }

  private nextFidgetS(): number {
    return RIG.fidgetS[0] + hash01(this.seed, this.fidgetCount + 0.25) * RIG.fidgetS[1];
  }

  /** The skinned bounds once the body sits in a scene graph (the culling sphere, grown for the clips' reach). */
  private fitBounds(): void {
    if (this.root.parent === null) return;
    this.boundsDone = true;
    this.root.updateWorldMatrix(true, true);
    this.mesh.computeBoundingSphere();
    this.mesh.boundingSphere!.radius *= RIG.boundsPad;
  }
}
