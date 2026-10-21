/**
 * World effects (SPEC §10.7.8): footprints in sand, snow and mud. One `InstancedMesh` of flat quads on the ground
 * normal, a ring of `PRINT_SLOTS`, multiply-blended like the contact decal (§10.4.7) so a print darkens the ground it
 * lies on in that ground's own colour. Each slot carries its birth (s, the world-effects clock) and tint; the
 * fragment stage fades it out over `PRINTS.lifeS`, so a frame writes nothing unless a foot came down.
 */
import { DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, MultiplyBlending, PlaneGeometry, Quaternion, Vector3 } from 'three/webgpu';
import type { Node, UniformNode } from 'three/webgpu';
import { float, instancedBufferAttribute, length, max, oneMinus, smoothstep, uv, vec2, vec4 } from 'three/tsl';
import { LAYERS } from '../descriptors.js';
import { OVERLAY_ALPHA_CUT, overlayMrt } from '../sprites/overlayMrt.js';
import { BILLBOARD } from '../sprites/tables.js';
import type { GroundKind } from './ground.js';

export const PRINT_SLOTS = 160;
export const PRINTS = Object.freeze({
  /** a print lasts this long (s), fading over the last `fadeFrac` of it */
  lifeS: 14, fadeFrac: 0.45,
  /** one foot (m): width, length; the lateral offset of the left / right foot from the walker's centre line */
  w: 0.19, l: 0.33, side: 0.11,
  liftM: 0.012,
});

/** Linear multiply tint and strength of a print per ground. */
const TINT: Readonly<Partial<Record<GroundKind, readonly [number, number, number, number]>>> = Object.freeze({
  sand: [0.68, 0.6, 0.48, 0.7],
  snow: [0.58, 0.66, 0.84, 0.65],
  mud: [0.45, 0.38, 0.3, 0.6],
});

const _m = new Matrix4();
const _q = new Quaternion();
const _qYaw = new Quaternion();
const _qFlat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const _up = new Vector3(0, 1, 0);
const _p = new Vector3();
const _s = new Vector3();
const ZERO = new Matrix4().makeScale(0, 0, 0);

export class FootprintDecals {
  readonly mesh: InstancedMesh;
  readonly material: MeshBasicNodeMaterial;
  private readonly geometry: PlaneGeometry;
  private readonly aPrint: InstancedBufferAttribute;   // birth (s), tint r g b
  private readonly aStrength: InstancedBufferAttribute;
  private cursor = 0;
  private placed = 0;
  private disposed = false;

  constructor(private readonly clock: UniformNode<'float', number>, harvestLevel: UniformNode<'float', number>) {
    this.geometry = new PlaneGeometry(1, 1);
    this.geometry.name = 'ewa:footprints';
    this.aPrint = new InstancedBufferAttribute(new Float32Array(PRINT_SLOTS * 4), 4);
    this.aPrint.setUsage(DynamicDrawUsage);
    this.aStrength = new InstancedBufferAttribute(new Float32Array(PRINT_SLOTS), 1);
    this.aStrength.setUsage(DynamicDrawUsage);
    for (let i = 0; i < PRINT_SLOTS; i++) this.aPrint.array[i * 4] = -1e6;
    this.material = this.buildMaterial(harvestLevel);
    const mesh = new InstancedMesh(this.geometry, this.material, PRINT_SLOTS);
    mesh.name = 'ewa:footprints';
    mesh.userData = { ewaDecal: true };
    mesh.renderOrder = BILLBOARD.decalRenderOrder - 1;
    mesh.layers.set(LAYERS.decals);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    for (let i = 0; i < PRINT_SLOTS; i++) mesh.setMatrixAt(i, ZERO);
    mesh.count = PRINT_SLOTS;
    mesh.visible = false;
    this.mesh = mesh;
  }

  /**
   * A print of `kind` at the foot (x, y, z) on the unit ground normal `n`, facing `yaw` (the actor pool's
   * atan2(dx, dz)). Kinds that keep no print are ignored. Allocation-free.
   */
  place(kind: GroundKind, x: number, y: number, z: number, yaw: number, n: Vector3, now: number): void {
    const t = TINT[kind];
    if (t === undefined || this.disposed || !Number.isFinite(x + y + z + yaw)) return;
    const i = this.cursor;
    this.cursor = (i + 1) % PRINT_SLOTS;
    _qYaw.setFromAxisAngle(_up, yaw);
    _q.setFromUnitVectors(_up, n).multiply(_qYaw).multiply(_qFlat);
    _p.set(x + n.x * PRINTS.liftM, y + n.y * PRINTS.liftM, z + n.z * PRINTS.liftM);
    _s.set(PRINTS.w, PRINTS.l, 1);
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(i, _m);
    this.mesh.instanceMatrix.addUpdateRange(i * 16, 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    const a = this.aPrint.array as Float32Array;
    a[i * 4] = now; a[i * 4 + 1] = t[0]; a[i * 4 + 2] = t[1]; a[i * 4 + 3] = t[2];
    (this.aStrength.array as Float32Array)[i] = t[3];
    this.aPrint.addUpdateRange(i * 4, 4); this.aPrint.needsUpdate = true;
    this.aStrength.addUpdateRange(i, 1); this.aStrength.needsUpdate = true;
    this.placed++;
    this.mesh.visible = true;
  }

  /** Removes every print (a zone change). */
  clear(): void {
    for (let i = 0; i < PRINT_SLOTS; i++) { this.mesh.setMatrixAt(i, ZERO); (this.aPrint.array as Float32Array)[i * 4] = -1e6; }
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aPrint.clearUpdateRanges();
    this.aPrint.needsUpdate = true;
    this.mesh.visible = false;
  }

  get count(): number { return this.placed; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  private buildMaterial(harvestLevel: UniformNode<'float', number>): MeshBasicNodeMaterial {
    const m = new MeshBasicNodeMaterial();
    const p = instancedBufferAttribute(this.aPrint) as unknown as Node<'vec4'>;
    const strength = instancedBufferAttribute(this.aStrength) as unknown as Node<'float'>;
    const age = this.clock.sub(p.x);
    const k = age.div(PRINTS.lifeS).clamp(0, 1);
    const fade = smoothstep(1, 1 - PRINTS.fadeFrac, k).mul(smoothstep(0, 0.04, age.div(PRINTS.lifeS)));
    // a sole: a toe oval and a heel oval (uv y up = toward the heading)
    const q = uv().sub(0.5);
    const toe = smoothstep(0.5, 0.36, length(vec2(q.x.mul(1.15), q.y.sub(0.17).mul(1.45))));
    const heel = smoothstep(0.5, 0.34, length(vec2(q.x.mul(1.35), q.y.add(0.25).mul(2.1))));
    const shape = max(toe, heel);
    const h = harvestLevel.clamp(0, 2).div(2);
    m.colorNode = vec4(p.yzw, 1);
    m.opacityNode = shape.mul(fade).mul(strength).mul(oneMinus(h)).mul(float(1));
    m.transparent = true;
    m.blending = MultiplyBlending;
    m.premultipliedAlpha = true;
    m.depthWrite = false;
    m.polygonOffset = true;
    m.polygonOffsetFactor = BILLBOARD.decalPolygonOffset;
    m.polygonOffsetUnits = BILLBOARD.decalPolygonOffset;
    m.fog = false;
    m.mrtNode = overlayMrt(false);
    m.alphaTest = OVERLAY_ALPHA_CUT;
    m.name = 'ewa:footprints';
    m.userData = { ewaClass: 'decal' };
    return m;
  }
}
