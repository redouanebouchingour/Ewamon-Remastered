/**
 * World effects (SPEC §10.7.8): light shafts at dawn and dusk (the "≤ 6 light-shaft billboards" of the cut list's
 * volumetric-fog replacement, 50-verification-budget.md §50.3). Nine soft additive ribbons stand on a 12 m world grid
 * round the camera focus, each a quad from the ground toward the sun, turned about its own axis to face the camera,
 * fading along its length, across its width and with distance from the focus (so at most about six read at once and
 * a ribbon never pops as the grid follows the focus). They show only in the golden hours, in the sun's colour, thinned
 * by clouds and rain; one draw, every position computed in the vertex stage.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu';
import type { Node, UniformNode } from 'three/webgpu';
import { Discard, Fn, attribute, cameraPosition, cross, float, floor, fract, length, normalize, sin, smoothstep, uniform, varying, vec2, vec3, vec4 } from 'three/tsl';
import { LAYERS } from '../descriptors.js';
import { overlayMrt } from '../sprites/overlayMrt.js';

export const SHAFTS = Object.freeze({
  /** a 3 × 3 block of grid cells round the focus, one ribbon each */
  cellM: 12, side: 3,
  /** ribbon length toward the sun (m) and width (m) */
  lengthM: 18, widthM: 2.6,
  /** fully visible within `nearM` of the focus, gone by `farM` */
  nearM: 7, farM: 16,
  /** peak brightness (HDR, over the bloom threshold at its core) */
  intensity: 0.7,
});

/** Golden-hour shafts brightness 0..1 for a golden weight, a daylight and a weather clearness 0..1. Pure. */
export function shaftLevel(golden: number, daylight: number, clear: number): number {
  const g = Math.max(0, Math.min(1, golden));
  return g * Math.min(1, Math.max(0, daylight) * 3) * Math.max(0, Math.min(1, clear));
}

export class SunShafts {
  readonly mesh: Mesh;
  readonly material: MeshBasicNodeMaterial;
  readonly level: UniformNode<'float', number>;
  readonly sunDir: UniformNode<'vec3', Vector3>;
  readonly sunColor: UniformNode<'vec3', Vector3>;
  readonly focus: UniformNode<'vec3', Vector3>;
  readonly clock: UniformNode<'float', number>;
  private readonly geometry: BufferGeometry;
  private nowS = 0;
  private disposed = false;

  constructor() {
    const n = SHAFTS.side * SHAFTS.side;
    const corner = new Float32Array(n * 4 * 3);   // cell dx, cell dz, corner index
    const index: number[] = [];
    for (let i = 0; i < n; i++) {
      const dx = (i % SHAFTS.side) - 1; const dz = Math.floor(i / SHAFTS.side) - 1;
      for (let k = 0; k < 4; k++) { const o = (i * 4 + k) * 3; corner[o] = dx; corner[o + 1] = dz; corner[o + 2] = k; }
      const b = i * 4;
      index.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 4 * 3), 3));   // unused: the vertex stage places everything
    g.setAttribute('shaft', new BufferAttribute(corner, 3));
    g.setIndex(index);
    g.name = 'ewa:shafts';
    this.geometry = g;
    this.level = uniform(0).setName('ewaShaftLevel');
    this.sunDir = uniform(new Vector3(0, 1, 0)).setName('ewaShaftSunDir');
    this.sunColor = uniform(new Vector3(1, 0.8, 0.6)).setName('ewaShaftSunColor');
    this.focus = uniform(new Vector3()).setName('ewaShaftFocus');
    this.clock = uniform(0).setName('ewaShaftClock');
    this.material = this.buildMaterial();
    const m = new Mesh(g, this.material);
    m.name = 'ewa:shafts';
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    m.layers.set(LAYERS.fx);
    m.renderOrder = 7;
    m.visible = false;
    this.mesh = m;
  }

  /** Per frame: scaled ms, the focus, the sun (unit direction toward it, linear colour) and the level 0..1. */
  update(dtScaledMs: number, focus: Vector3, sunDir: Vector3, sunColor: readonly number[], level: number): void {
    if (this.disposed) return;
    this.nowS = (this.nowS + Math.max(0, dtScaledMs) / 1000) % 3600;
    this.clock.value = this.nowS;
    this.focus.value.copy(focus);
    this.sunDir.value.copy(sunDir).normalize();
    this.sunColor.value.set(sunColor[0] ?? 1, sunColor[1] ?? 1, sunColor[2] ?? 1);
    this.level.value = level;
    // a sun under the horizon (or straight overhead) casts no ribbon
    this.mesh.visible = level > 0.01 && sunDir.y > 0.02;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }

  private buildMaterial(): MeshBasicNodeMaterial {
    const m = new MeshBasicNodeMaterial();
    const a = attribute('shaft', 'vec3') as unknown as Node<'vec3'>;
    const f = this.focus as unknown as Node<'vec3'>;
    const cell = float(SHAFTS.cellM);
    // the ribbon's foot: a hashed spot in its grid cell (the cells follow the focus a whole cell at a time)
    const cx = floor(f.x.div(cell)).add(a.x); const cz = floor(f.z.div(cell)).add(a.y);
    const hx = fract(sin(cx.mul(127.1).add(cz.mul(311.7))).mul(43758.5));
    const hz = fract(sin(cx.mul(269.5).add(cz.mul(183.3))).mul(43758.5));
    const foot = vec3(cx.add(hx.mul(0.8).add(0.1)).mul(cell), f.y.sub(0.5), cz.add(hz.mul(0.8).add(0.1)).mul(cell));
    const axis = normalize(this.sunDir as unknown as Node<'vec3'>);
    const view = normalize(cameraPosition.sub(foot));
    const side = normalize(cross(axis, view));
    const k = a.z;
    const u = k.mod(2);                  // 0 / 1 across
    const v = floor(k.div(2));           // 0 at the foot, 1 at the sun end
    const w = float(SHAFTS.widthM).mul(hx.mul(0.6).add(0.7));
    m.positionNode = foot.add(axis.mul(v.mul(SHAFTS.lengthM))).add(side.mul(u.sub(0.5).mul(w)));
    const dist = length(vec2(foot.x.sub(f.x), foot.z.sub(f.z)));
    const near = varying(smoothstep(SHAFTS.farM, SHAFTS.nearM, dist).mul(hz.mul(0.5).add(0.5)));
    const uv0 = varying(vec2(u, v));
    const flick = varying(sin(this.clock.mul(0.6).add(hx.mul(20))).mul(0.25).add(0.75));
    m.colorNode = Fn(() => {
      const across = smoothstep(0, 0.5, uv0.x).mul(smoothstep(1, 0.5, uv0.x));
      const along = smoothstep(0, 0.25, uv0.y).mul(smoothstep(1, 0.45, uv0.y));
      const s = across.mul(across).mul(along).mul(near).mul(flick).mul(this.level).mul(SHAFTS.intensity);
      Discard(s.lessThan(0.002));
      return vec4((this.sunColor as unknown as Node<'vec3'>).mul(s), s);
    })();
    m.transparent = true;
    m.blending = AdditiveBlending;
    m.depthWrite = false;
    m.depthTest = true;
    m.side = DoubleSide;                 // the ribbon turns to face the camera: either face may show
    m.fog = false;
    m.mrtNode = overlayMrt(true);
    m.name = 'ewa:shafts';
    m.userData = { ewaClass: 'fx' };
    return m;
  }
}
