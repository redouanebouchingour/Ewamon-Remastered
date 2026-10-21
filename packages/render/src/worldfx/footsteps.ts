/**
 * World effects (SPEC §10.7.8): footsteps. Every actor near the camera focus lands a foot each stride of the ground
 * it covers (the actor pool's MEASURED speed, the same number the gait blends by, so the effect falls with the
 * animation's feet), alternating left and right of its centre line. Each landing asks `classify` what the foot is on
 * and throws that ground's burst behind the walker; sand, snow and mud keep a print. Fast movers (the bike) also
 * leave a dust trail between strides. Allocation-free per frame.
 */
import { Vector3 } from 'three/webgpu';
import { WORLD_BURSTS, type WorldParticles } from './particles.js';
import { classify, keepsPrint, type GroundKind, type GroundSource } from './ground.js';
import type { FootprintDecals } from './prints.js';
import { PRINTS } from './prints.js';

export const STEPS = Object.freeze({
  /** ground covered per foot (m) at a walk, and at a run (the stride lengthens with speed between them) */
  strideWalkM: 0.62, strideRunM: 1.0, runFromMps: 1.6, runToMps: 4.2,
  /** below this an actor stands (the actor pool's standMps, with a margin) */
  minMps: 0.4,
  /** only actors this close to the camera focus (m) */
  rangeM: 30,
  /** above this speed (m/s; running is 4.2, the bike faster) a trail puff every `trailEveryM` between strides */
  trailMps: 5.2, trailEveryM: 0.45,
  /** surfing: foam off both sides of the bow every `wakeEveryM`, a ring every `wakeRingM`, from `wakeMps` */
  wakeMps: 0.6, wakeEveryM: 0.32, wakeRingM: 1.1, bowM: 0.4, beamM: 0.3,
  slots: 48,
});

/** Stride length for a speed (m per foot). Pure. */
export function strideFor(speed: number): number {
  const t = Math.min(1, Math.max(0, (speed - STEPS.runFromMps) / (STEPS.runToMps - STEPS.runFromMps)));
  return STEPS.strideWalkM + (STEPS.strideRunM - STEPS.strideWalkM) * t;
}

/** A live actor as the world effects see it (the actor pool's `forEachWalker`). */
export type WalkerVisitor = (slot: number, feet: Vector3, normal: Vector3, speed: number, yaw: number, dist2: number) => void;
export interface WalkerSource { forEachWalker(visit: WalkerVisitor): void }

/** Burst scale per gait: a run throws more. Pure. */
export function burstScale(speed: number): number {
  return speed > 3 ? 1.35 : speed > 1.6 ? 1.1 : 0.8;
}

const _focus = new Vector3();

export class Footsteps {
  private readonly covered = new Float32Array(STEPS.slots);
  private readonly trail = new Float32Array(STEPS.slots);
  private readonly left = new Uint8Array(STEPS.slots);
  private readonly seen = new Uint8Array(STEPS.slots);
  private ground: GroundSource | null = null;
  private wet = 0;
  private dt = 0;
  private landed = 0;
  private embers = false;
  private printsAt = 0;

  constructor(private readonly particles: WorldParticles, private readonly prints: FootprintDecals) {}

  /** The loaded zone's ground (null = none); `embers`: cinder ground throws a spark now and then. */
  setGround(g: GroundSource | null, embers = false): void {
    this.ground = g;
    this.embers = embers;
    this.covered.fill(0); this.trail.fill(0); this.seen.fill(0);
  }

  /** Steps landed since construction (tests, the sandbox). */
  get steps(): number { return this.landed; }

  /** Per frame: `dtS` scaled seconds, the walkers, the camera focus, weather wetness 0..1. */
  update(dtS: number, walkers: WalkerSource, focus: Vector3, wetness: number): void {
    if (this.ground === null || !(dtS > 0)) return;
    this.dt = dtS;
    this.wet = wetness;
    _focus.copy(focus);
    this.seen.fill(0);
    walkers.forEachWalker(this.visit);
    // a slot nobody stood in this frame starts its next walk on a fresh stride
    for (let i = 0; i < STEPS.slots; i++) if (this.seen[i] === 0) { this.covered[i] = 0; this.trail[i] = 0; }
  }

  private readonly visit: WalkerVisitor = (slot, feet, normal, speed, yaw) => {
    if (slot < 0 || slot >= STEPS.slots) return;
    this.seen[slot] = 1;
    const dx = feet.x - _focus.x; const dz = feet.z - _focus.z;
    if (dx * dx + dz * dz > STEPS.rangeM * STEPS.rangeM || !(speed > STEPS.minMps)) { this.covered[slot] = 0; return; }
    const d = speed * this.dt;
    if (this.ground!.onWater(feet.x, feet.z)) { this.wake(slot, feet, speed, yaw, d); return; }
    const stride = strideFor(speed);
    this.covered[slot] = this.covered[slot]! + d;
    if (speed > STEPS.trailMps) {
      this.trail[slot] = this.trail[slot]! + d;
      if (this.trail[slot]! >= STEPS.trailEveryM) { this.trail[slot] = 0; this.land(slot, feet, normal, speed, yaw, true); }
    }
    if (this.covered[slot]! < stride) return;
    this.covered[slot] = this.covered[slot]! - stride;
    this.left[slot] = this.left[slot] === 1 ? 0 : 1;
    this.land(slot, feet, normal, speed, yaw, false);
  };

  /** A surfer: foam thrown off both sides of the bow, a ring now and then behind. */
  private wake(slot: number, feet: Vector3, speed: number, yaw: number, d: number): void {
    if (speed < STEPS.wakeMps) return;
    this.trail[slot] = this.trail[slot]! + d;
    this.covered[slot] = this.covered[slot]! + d;
    const fx = Math.sin(yaw); const fz = Math.cos(yaw);
    const rx = fz; const rz = -fx;
    const p = this.particles; const W = WORLD_BURSTS;
    if (this.trail[slot]! >= STEPS.wakeEveryM) {
      this.trail[slot] = 0;
      const bx = feet.x + fx * STEPS.bowM; const bz = feet.z + fz * STEPS.bowM;
      const s = Math.min(1.6, 0.6 + speed / 4);
      p.emit(W.wake, bx + rx * STEPS.beamM, feet.y, bz + rz * STEPS.beamM, rx - fx * 0.5, rz - fz * 0.5, s);
      p.emit(W.wake, bx - rx * STEPS.beamM, feet.y, bz - rz * STEPS.beamM, -rx - fx * 0.5, -rz - fz * 0.5, s);
    }
    if (this.covered[slot]! >= STEPS.wakeRingM) {
      this.covered[slot] = 0;
      p.emit(W.ripple, feet.x - fx * 0.6, feet.y, feet.z - fz * 0.6, 0, 0, 1);
    }
  }

  private land(slot: number, feet: Vector3, normal: Vector3, speed: number, yaw: number, trail: boolean): void {
    const g = this.ground!;
    const fx = Math.sin(yaw); const fz = Math.cos(yaw);              // forward (the pool's atan2(dx, dz) facing)
    const side = trail ? 0 : (this.left[slot] === 1 ? -1 : 1) * PRINTS.side;
    const x = feet.x + fz * side; const z = feet.z - fx * side;      // right hand = (fz, −fx)
    const kind = classify(g, x, z, this.wet);
    if (kind === 'none' || (kind === 'stone' && !trail)) return;   // paving takes a step silently; only a bike raises its dust
    const s = burstScale(speed) * (trail ? 0.55 : 1);
    this.emit(kind, x, feet.y, z, -fx, -fz, s, trail);
    if (!trail) {
      this.landed++;
      if (keepsPrint(kind)) this.prints.place(kind, x, feet.y, z, yaw, normal, this.particles.now);
      this.printsAt++;
    }
  }

  private emit(kind: GroundKind, x: number, y: number, z: number, bx: number, bz: number, s: number, trail: boolean): void {
    const p = this.particles; const W = WORLD_BURSTS;
    switch (kind) {
      case 'dust': p.emit(W.dust, x, y, z, bx, bz, s); break;
      case 'canyon': p.emit(W.canyon, x, y, z, bx, bz, s); break;
      case 'sand': p.emit(W.sand, x, y, z, bx, bz, s); p.emit(W.dust, x, y, z, bx, bz, trail || s > 1.2 ? 0.6 : 0.3); break;
      case 'snow': p.emit(W.snow, x, y, z, bx, bz, s); p.emit(W.powder, x, y, z, bx, bz, s * 0.7); break;
      case 'ash':
        p.emit(W.ash, x, y, z, bx, bz, s);
        if (this.embers && (this.printsAt % 3 === 0)) p.emit(W.ember, x, y, z, bx, bz, 1);
        break;
      case 'soil': if (!trail) p.emit(W.soil, x, y, z, bx, bz, s * 0.8); break;
      case 'stone': p.emit(W.dust, x, y, z, bx, bz, s * 0.4); break;
      case 'grass': p.emit(W.grass, x, y, z, bx, bz, s); break;
      case 'shallow': p.emit(W.splash, x, y, z, bx, bz, s); if (!trail) p.emit(W.ripple, x, y, z, 0, 0, 1); break;
      case 'mud': p.emit(W.mud, x, y, z, bx, bz, s); break;
      case 'none': break;
    }
  }
}
