/**
 * PLACEHOLDER subsystems wired into `createRenderer` until the owning agents land (§10.4–§10.9):
 *
 * - `BasicDioramaRig`: a `CameraRig` holding the §10.7.1 diorama pose (FOV 28°, pitch −52°, yaw −35° +
 *   90°·heading, distances 20 / 26 / 34 m) and the §10.7.4 battle pose (12 m, 28°, yaw + 12°), with no
 *   springs, dead zone or easing. The camera agent's `camera/rig.ts` replaces it.
 * - `NullBattleStage`, `NullHudLayer`, `NullActorPool`: no-op implementations of the verbatim interfaces.
 * - `unimplementedZoneLoader`: `loadZone` rejects until the zone builder (§10.5) lands.
 *
 * The replacement point is `DEFAULT_SUBSYSTEMS` in `renderer.ts`.
 */
import { Vector3 } from 'three/webgpu';
import type { PerspectiveCamera } from 'three/webgpu';
import type {
  ActorPool, BattleStage, CameraRig, HudLayer, ZoneHandle, ZoneSpec,
} from './contracts.js';
import type { EffectsFlags } from './descriptors.js';
import { shakeAllowed } from './post/effects.js';

const DEG = Math.PI / 180;

/** §10.7.1 / §10.7.4 pose numbers used by the placeholder rig (the camera agent owns the canonical table). */
export const PLACEHOLDER_POSE = Object.freeze({
  pitchDeg: -52, yawBaseDeg: -35, distances: [20, 26, 34] as const,
  battleDistance: 12, battlePitchDeg: -28, battleYawOffsetDeg: 12,
});

export class BasicDioramaRig implements CameraRig {
  readonly focus = new Vector3();
  private heading: 0 | 1 | 2 | 3 = 0;
  private zoom: 0 | 1 | 2 = 1;
  private battle = false;
  private shakeAmp = 0;
  private shakeMs = 0;
  private shakeLeft = 0;
  private clock = 0;
  private followed: string | null = null;

  constructor(readonly camera: PerspectiveCamera, private readonly effects: () => EffectsFlags) {
    this.update(0);
  }

  /** Placeholder-only: puts the focus (the DOF plane's anchor, the player's feet) at (x, y, z). */
  setFocus(x: number, y: number, z: number): void { this.focus.set(x, y, z); }

  setHeading(h: 0 | 1 | 2 | 3): void { this.heading = h; }
  setZoomStop(z: 0 | 1 | 2): void { this.zoom = z; }
  follow(actorId: string | null): void { this.followed = actorId; }
  get followedActor(): string | null { return this.followed; }

  pushIn(target: { readonly x: number; readonly z: number }, _ms: number): void {
    this.focus.set(target.x, this.focus.y, target.z);
    this.battle = true;
  }

  release(_ms: number): void { this.battle = false; }

  shake(amp: number, ms: number): void {
    if (!shakeAllowed(this.effects())) return;   // §10.7.2: returns before writing anything
    this.shakeAmp = Math.max(0, amp);
    this.shakeMs = Math.max(1, ms);
    this.shakeLeft = this.shakeMs;
  }

  cue(_kind: 'attacker' | 'defender' | 'impact' | 'wide' | 'ko' | 'throw', _ms: number): void { /* placeholder */ }

  /** Current shake offset magnitude (Pillar 8 test hook: must stay 0 with reduced effects). */
  get shakeOffset(): number { return this.shakeLeft > 0 ? this.shakeAmp * (this.shakeLeft / this.shakeMs) : 0; }

  update(dtMs: number): void {
    this.clock += dtMs;
    const P = PLACEHOLDER_POSE;
    const yaw = (P.yawBaseDeg + 90 * this.heading + (this.battle ? P.battleYawOffsetDeg : 0)) * DEG;
    const pitch = (this.battle ? P.battlePitchDeg : P.pitchDeg) * DEG;
    const dist = this.battle ? P.battleDistance : P.distances[this.zoom];
    const c = Math.cos(pitch);
    this.camera.position.set(
      this.focus.x + dist * c * Math.sin(yaw),
      this.focus.y + dist * Math.sin(-pitch),
      this.focus.z + dist * c * Math.cos(yaw),
    );
    this.camera.lookAt(this.focus);
    if (this.shakeLeft > 0) {
      this.shakeLeft = Math.max(0, this.shakeLeft - dtMs);
      const a = this.shakeOffset / dist;
      this.camera.rotateX(a * Math.sin(this.clock * 0.071));
      this.camera.rotateY(a * Math.sin(this.clock * 0.053 + 1.3));
    }
    this.camera.updateMatrixWorld();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}

export class NullBattleStage implements BattleStage {
  dress(): void {} dressSpectator(): void {} undress(): void {} setBattler(): void {} setPose(): void {} hurt(): void {}
  faint(): void {} setWeather(): void {} vfx(): void {} prewarm(): void {} syncFrom(): void {} setTypeColors(): void {}
  inspect(): void {} dispose(): void {}
}

export class NullHudLayer implements HudLayer {
  set(): void {} drawIfDirty(): boolean { return false; } setFonts(): void {} setScale(): void {} resize(): void {} dispose(): void {}
}

export class NullActorPool implements ActorPool {
  spawn(): void {} setTransform(): void {} setEmote(): void {} despawn(): void {}
  feetOf(): Vector3 | null { return null; }
  screenPositions(): number { return 0; }
  dispose(): void {}
}

export interface ZoneLoader {
  /** `opts.heroGate`: the hero-tier texture stream starts when it resolves (IMPLEMENTATION-NOTES Part 4, H5). */
  load(spec: ZoneSpec, opts?: { readonly heroGate?: Promise<void> }): Promise<ZoneHandle>;
}

export const unimplementedZoneLoader: ZoneLoader = {
  load: (spec) => Promise.reject(new Error(`@ewa/render: loadZone('${spec.id}') — the zone builder (§10.5) is not implemented yet`)),
};
