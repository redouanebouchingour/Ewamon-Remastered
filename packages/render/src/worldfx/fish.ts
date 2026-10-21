/**
 * World effects (SPEC §10.7.8): fish in the water. Six dark fish shapes swim lazy loops on open water near the camera
 * focus: one `InstancedMesh` of flat quads on the water surface, multiply-blended like the contact decal (§10.4.7) so a
 * fish darkens the water it is in. Each fish picks a loop centre on open water within 18 m of the focus (seeded, no
 * Math.random), swims round it with a slow sway and, when its path would leave the water or the focus moves off,
 * fades out and picks another. Shown by day, faint at night. Allocation-free per frame.
 */
import { DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, MultiplyBlending, PlaneGeometry, Quaternion, Vector3 } from 'three/webgpu';
import type { Node, UniformNode } from 'three/webgpu';
import { abs, float, instancedBufferAttribute, length, max, sin, smoothstep, step, uv, vec2, vec4 } from 'three/tsl';
import { LAYERS } from '../descriptors.js';
import { OVERLAY_ALPHA_CUT, overlayMrt } from '../sprites/overlayMrt.js';
import { BILLBOARD } from '../sprites/tables.js';
import { mulberry32 } from '../stage/vfx.js';

export const FISH = Object.freeze({
  count: 6,
  /** loop centres within this far of the focus (m); a fish farther than `leaveM` from the focus moves on */
  rangeM: 18, leaveM: 24,
  /** loop radius (m), angular speed (rad/s), body length (m) */
  radiusMin: 1.2, radiusMax: 3.2, speedMin: 0.35, speedMax: 0.8, lengthMin: 0.45, lengthMax: 0.8,
  /** fade in / out (1/s); darkness at full (multiply strength) */
  fadeRate: 1.6, strength: 0.42,
  liftM: 0.025,
});

/** What the fish read of the zone (the collider). */
export interface FishWater {
  onWater(x: number, z: number): boolean;
  surfaceY(x: number, z: number): number;
}

interface Fish { cx: number; cz: number; r: number; w: number; a: number; len: number; vis: number; leaving: boolean; alive: boolean }

const _m = new Matrix4();
const _q = new Quaternion();
const _qFlat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const _qYaw = new Quaternion();
const _up = new Vector3(0, 1, 0);
const _p = new Vector3();
const _s = new Vector3();
const ZERO = new Matrix4().makeScale(0, 0, 0);

export class FishShadows {
  readonly mesh: InstancedMesh;
  readonly material: MeshBasicNodeMaterial;
  private readonly geometry: PlaneGeometry;
  private readonly aFade: InstancedBufferAttribute;
  private readonly fish: Fish[] = [];
  private readonly rand = mulberry32(0xf15e5);
  private water: FishWater | null = null;
  private disposed = false;

  constructor(private readonly clock: UniformNode<'float', number>, harvestLevel: UniformNode<'float', number>) {
    this.geometry = new PlaneGeometry(1, 1);
    this.geometry.name = 'ewa:fish';
    this.aFade = new InstancedBufferAttribute(new Float32Array(FISH.count), 1);
    this.aFade.setUsage(DynamicDrawUsage);
    for (let i = 0; i < FISH.count; i++) this.fish.push({ cx: 0, cz: 0, r: 2, w: 0.5, a: 0, len: 0.6, vis: 0, leaving: false, alive: false });
    this.material = this.buildMaterial(harvestLevel);
    const mesh = new InstancedMesh(this.geometry, this.material, FISH.count);
    mesh.name = 'ewa:fish';
    mesh.userData = { ewaDecal: true };
    mesh.renderOrder = BILLBOARD.decalRenderOrder - 2;
    mesh.layers.set(LAYERS.decals);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    for (let i = 0; i < FISH.count; i++) mesh.setMatrixAt(i, ZERO);
    mesh.visible = false;
    this.mesh = mesh;
  }

  /** The zone's water (null = none: every fish goes). */
  setWater(w: FishWater | null): void {
    this.water = w;
    for (const f of this.fish) { f.alive = false; f.vis = 0; }
    this.mesh.visible = false;
  }

  /** Fish shown now (tests). */
  get swimming(): number { let n = 0; for (const f of this.fish) if (f.alive && f.vis > 0.01) n++; return n; }

  /** Per frame: scaled seconds, the focus, the daylight 0..1. */
  update(dtS: number, focus: Vector3, daylight: number): void {
    const w = this.water;
    if (this.disposed || w === null || !(dtS >= 0)) return;
    const fades = this.aFade.array as Float32Array;
    let any = false;
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i]!;
      if (!f.alive && !this.spawn(f, focus, w)) { this.mesh.setMatrixAt(i, ZERO); fades[i] = 0; continue; }
      f.a += f.w * dtS;
      const x = f.cx + Math.cos(f.a) * f.r; const z = f.cz + Math.sin(f.a) * f.r;
      // look a little ahead: about to leave the water (or the focus moved off) → fade out and choose again
      const ax = f.cx + Math.cos(f.a + 0.35 * Math.sign(f.w)) * f.r; const az = f.cz + Math.sin(f.a + 0.35 * Math.sign(f.w)) * f.r;
      if (!f.leaving && (!w.onWater(ax, az) || Math.hypot(x - focus.x, z - focus.z) > FISH.leaveM)) f.leaving = true;
      f.vis = Math.max(0, Math.min(1, f.vis + (f.leaving ? -1 : 1) * FISH.fadeRate * dtS));
      if (f.leaving && f.vis <= 0) { f.alive = false; this.mesh.setMatrixAt(i, ZERO); fades[i] = 0; continue; }
      // heading: the loop's tangent, with a slow sway
      const yaw = Math.atan2(-Math.sin(f.a) * Math.sign(f.w), Math.cos(f.a) * Math.sign(f.w)) + Math.sin(f.a * 3.1) * 0.25;
      _qYaw.setFromAxisAngle(_up, yaw);
      _q.copy(_qYaw).multiply(_qFlat);
      _p.set(x, w.surfaceY(x, z) + FISH.liftM, z);
      _s.set(f.len * 0.42, f.len, 1);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      fades[i] = f.vis * (0.3 + 0.7 * Math.max(0, Math.min(1, daylight)));
      any = true;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aFade.needsUpdate = true;
    this.mesh.visible = any;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  /** A loop on open water near the focus: up to 6 tries; false when none fits (no water here). */
  private spawn(f: Fish, focus: Vector3, w: FishWater): boolean {
    const rnd = this.rand;
    for (let k = 0; k < 6; k++) {
      const ang = rnd() * Math.PI * 2; const d = Math.sqrt(rnd()) * FISH.rangeM;
      const cx = focus.x + Math.cos(ang) * d; const cz = focus.z + Math.sin(ang) * d;
      const r = FISH.radiusMin + rnd() * (FISH.radiusMax - FISH.radiusMin);
      // the whole loop must be open water
      let ok = w.onWater(cx, cz);
      for (let s = 0; s < 8 && ok; s++) ok = w.onWater(cx + Math.cos(s * Math.PI / 4) * r, cz + Math.sin(s * Math.PI / 4) * r);
      if (!ok) continue;
      f.cx = cx; f.cz = cz; f.r = r;
      f.w = (FISH.speedMin + rnd() * (FISH.speedMax - FISH.speedMin)) * (rnd() < 0.5 ? -1 : 1);
      f.a = rnd() * Math.PI * 2;
      f.len = FISH.lengthMin + rnd() * (FISH.lengthMax - FISH.lengthMin);
      f.vis = 0; f.leaving = false; f.alive = true;
      return true;
    }
    return false;
  }

  private buildMaterial(harvestLevel: UniformNode<'float', number>): MeshBasicNodeMaterial {
    const m = new MeshBasicNodeMaterial();
    const fade = instancedBufferAttribute(this.aFade) as unknown as Node<'float'>;
    // a fish seen from above: a tapered body and a tail that beats (uv y up = toward the head)
    const q = uv().sub(0.5);
    const beat = sin(this.clock.mul(7).add(fade.mul(3))).mul(0.06).mul(smoothstep(0.1, -0.5, q.y));
    const bx = q.x.sub(beat);
    const body = smoothstep(0.5, 0.36, length(vec2(bx.mul(2.4), q.y.sub(0.08).mul(1.25))));
    // the tail: a fan behind the body, widening toward the end (ty 0 at its root, 0.25 at the tip)
    const ty = q.y.add(0.22).negate();
    const tail = smoothstep(0.03, 0, abs(bx).sub(ty.mul(0.9))).mul(step(0, ty)).mul(smoothstep(0.28, 0.22, ty));
    const shape = max(body, tail);
    const h = harvestLevel.clamp(0, 2).div(2);
    m.colorNode = vec4(0.12, 0.16, 0.18, 1);
    m.opacityNode = shape.mul(fade).mul(FISH.strength).mul(float(1).sub(h));
    m.transparent = true;
    m.blending = MultiplyBlending;
    m.premultipliedAlpha = true;
    m.depthWrite = false;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
    m.fog = false;
    m.mrtNode = overlayMrt(false);
    m.alphaTest = OVERLAY_ALPHA_CUT;
    m.name = 'ewa:fish';
    m.userData = { ewaClass: 'decal' };
    return m;
  }
}
