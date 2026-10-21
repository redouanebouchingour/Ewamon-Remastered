/**
 * World effects (SPEC §10.7.8): the overworld's own particle pool: footstep dust, sand and snow kicked up, splashes,
 * grass bits, surf wake, the encounter rustle.
 *
 * Built like the battle `VfxSystem` (one instanced `Sprite` on a `PointsNodeMaterial`, preallocated instanced
 * attributes, the vertex stage integrating every particle from one clock) with two differences:
 * - ONE ring buffer of `WORLD_PARTICLES` instead of fixed emitters: footsteps emit a few particles at a time, so a
 *   burst takes the next free run of slots and the oldest particles are the ones overwritten.
 * - Premultiplied alpha (One, OneMinusSrcAlpha), not additive: dust and sand must darken what is behind them. A
 *   particle's `glow` (0..1) moves it from lit-and-blended (dust, takes the day's light) to additive (embers, sparks):
 *   the same material draws both, so the pool is one draw call and one program.
 *
 * Nothing here reads a wall clock or Math.random (§10 NN 10): the clock is `dt × timeScale` (hitstop freezes the
 * world's particles too) and jitter comes from a seeded mulberry32.
 */
import { Color, CustomBlending, DynamicDrawUsage, InstancedBufferAttribute, OneFactor, OneMinusSrcAlphaFactor, PointsNodeMaterial, Sprite, Vector3 } from 'three/webgpu';
import type { Node, PerspectiveCamera, UniformNode } from 'three/webgpu';
import { Discard, Fn, abs, cos, exp, float, instancedBufferAttribute, length, max, min, mix, select, sin, smoothstep, step, uniform, uv, varying, vec2, vec3, vec4 } from 'three/tsl';
import { LAYERS } from '../descriptors.js';
import { OVERLAY_ALPHA_CUT, overlayMrt } from '../sprites/overlayMrt.js';
import { hexToLinearInto } from '../sprites/typeColors.js';
import { mulberry32 } from '../stage/vfx.js';

/** Particles in the pool (one ring buffer). */
export const WORLD_PARTICLES = 2048;

export type WorldShape = 'puff' | 'grain' | 'leaf' | 'drop' | 'flake' | 'spark' | 'ring';
export const WORLD_SHAPE_INDEX: Readonly<Record<WorldShape, number>> = Object.freeze({ puff: 0, grain: 1, leaf: 2, drop: 3, flake: 4, spark: 5, ring: 6 });

/** One emission: `count` particles round a point, thrown along a direction (the walker's heading) and up. */
export interface WorldBurst {
  readonly count: number;
  /** sRGB hex; a second colour mixes per particle */
  readonly color: string;
  readonly color2?: string;
  /** peak opacity 0..1 (glowing particles: brightness multiplier instead) */
  readonly alpha: number;
  /** 0 = lit dust (blended, takes the day's light) … 1 = additive glow */
  readonly glow: number;
  readonly lifeMs: number;
  /** emission spread (ms): particles are born over this window */
  readonly spreadMs: number;
  readonly size: number;
  readonly sizeEnd: number;
  /** horizontal speed (m/s) along the burst direction, ± `spread` sideways */
  readonly speed: number;
  /** upward speed (m/s) */
  readonly up: number;
  readonly spread: number;
  /** m/s² (positive = down) */
  readonly gravity: number;
  readonly drag: number;
  /** emission radius round the point (m) and height above it */
  readonly radius: number;
  readonly height: number;
  readonly shape: WorldShape;
}

const B = (o: Partial<WorldBurst> & Pick<WorldBurst, 'count' | 'color' | 'shape'>): WorldBurst => Object.freeze({
  alpha: 0.5, glow: 0, lifeMs: 700, spreadMs: 40, size: 0.18, sizeEnd: 2, speed: 0.4, up: 0.5, spread: 0.6, gravity: 0.6, drag: 2.5,
  radius: 0.12, height: 0.04, ...o,
});

/** The recipes the world effects emit (footsteps, splashes, the encounter rustle, the surf wake). */
export const WORLD_BURSTS = Object.freeze({
  /** a gravel / earth road: a low tan puff that drifts and thins */
  dust: B({ count: 5, color: '#cdb995', color2: '#a8946f', shape: 'puff', alpha: 0.5, lifeMs: 900, size: 0.26, sizeEnd: 3.2, speed: 0.35, up: 0.35, gravity: -0.05, drag: 2.2 }),
  /** canyon dust: redder and thicker */
  canyon: B({ count: 6, color: '#d1a477', color2: '#b38556', shape: 'puff', alpha: 0.52, lifeMs: 1000, size: 0.24, sizeEnd: 3.4, speed: 0.4, up: 0.4, gravity: -0.05, drag: 2 }),
  /** salt sand: grains thrown back and a faint puff */
  sand: B({ count: 8, color: '#e8dcbc', color2: '#cbb98f', shape: 'grain', alpha: 0.9, lifeMs: 460, size: 0.065, sizeEnd: 0.8, speed: 1.1, up: 1.3, gravity: 7, drag: 1.2, spread: 0.9 }),
  /** snow: white flakes kicked up and a soft powder puff */
  snow: B({ count: 7, color: '#eef3fa', color2: '#cfdcea', shape: 'flake', alpha: 0.85, lifeMs: 600, size: 0.07, sizeEnd: 0.7, speed: 0.9, up: 1.4, gravity: 4.5, drag: 1.6, spread: 1 }),
  powder: B({ count: 3, color: '#d9e3ef', shape: 'puff', alpha: 0.45, lifeMs: 800, size: 0.2, sizeEnd: 2.6, speed: 0.2, up: 0.25, gravity: -0.02, drag: 2.4 }),
  /** volcanic ash: grey puff, a few embers on cinder ground */
  ash: B({ count: 5, color: '#6e6660', color2: '#4e4844', shape: 'puff', alpha: 0.5, lifeMs: 1000, size: 0.22, sizeEnd: 3, speed: 0.3, up: 0.4, gravity: -0.08, drag: 2 }),
  ember: B({ count: 2, color: '#ff8a3a', color2: '#ffd06a', shape: 'spark', alpha: 1.6, glow: 1, lifeMs: 900, spreadMs: 120, size: 0.05, sizeEnd: 0.4, speed: 0.2, up: 0.9, gravity: -0.4, drag: 1, spread: 0.5 }),
  /** moss / grass ground: a few dark soil bits, no cloud */
  soil: B({ count: 3, color: '#5e5034', color2: '#3f3624', shape: 'grain', alpha: 0.85, lifeMs: 360, size: 0.04, sizeEnd: 0.9, speed: 0.6, up: 0.9, gravity: 8, drag: 1, spread: 0.7 }),
  /** tall grass: blades and seeds flicked up as the walker pushes through */
  grass: B({ count: 4, color: '#7fa24a', color2: '#b9c46a', shape: 'leaf', alpha: 0.95, lifeMs: 800, spreadMs: 80, size: 0.09, sizeEnd: 0.7, speed: 0.5, up: 1.4, gravity: 2.2, drag: 2.5, radius: 0.25, height: 0.35, spread: 1.2 }),
  /** shallow water, a wet road, mud: droplets and a ring */
  splash: B({ count: 8, color: '#d6e6f0', color2: '#a8c4d6', shape: 'drop', alpha: 0.75, lifeMs: 420, size: 0.06, sizeEnd: 0.6, speed: 0.7, up: 1.9, gravity: 9, drag: 0.6, spread: 1.2 }),
  ripple: B({ count: 1, color: '#e4f0f6', shape: 'ring', alpha: 0.5, lifeMs: 600, size: 0.35, sizeEnd: 3.4, speed: 0, up: 0, gravity: 0, drag: 1, radius: 0, height: 0.03 }),
  mud: B({ count: 5, color: '#4c3e2a', color2: '#665238', shape: 'drop', alpha: 0.9, lifeMs: 380, size: 0.05, sizeEnd: 0.7, speed: 0.6, up: 1.4, gravity: 9, drag: 0.6, spread: 1 }),
  /** the surf wake: foam thrown off both sides of the bow and a trailing ring */
  wake: B({ count: 6, color: '#f2f8fb', color2: '#cfe2ec', shape: 'puff', alpha: 0.55, lifeMs: 1100, size: 0.16, sizeEnd: 3.4, speed: 1.1, up: 0.15, gravity: 0, drag: 1.4, spread: 0.2, radius: 0.3, height: 0.02 }),
  /** the encounter rustle: a burst of blades all round the walker (render `WorldFx.rustle`) */
  rustle: B({ count: 26, color: '#7fa24a', color2: '#c7cf73', shape: 'leaf', alpha: 1, lifeMs: 1100, spreadMs: 160, size: 0.11, sizeEnd: 0.6, speed: 1.6, up: 2.6, gravity: 2.6, drag: 2, radius: 0.7, height: 0.4, spread: 6.3 }),
});
export type WorldBurstId = keyof typeof WORLD_BURSTS;

const _c1 = new Color();
const _c2 = new Color();

export class WorldParticles {
  readonly object: Sprite;
  readonly material: PointsNodeMaterial;
  readonly clock: UniformNode<'float', number>;
  readonly sizeScale: UniformNode<'float', number>;
  /** linear light the lit (glow 0) particles take: the sun and sky at the walker (written by the frame hook) */
  readonly light: UniformNode<'vec3', Vector3>;
  private readonly aOrigin: InstancedBufferAttribute;   // xyz origin, w birth (s)
  private readonly aVel: InstancedBufferAttribute;      // xyz velocity, w life (s)
  private readonly aColor: InstancedBufferAttribute;    // rgb linear, w size (m)
  private readonly aMisc: InstancedBufferAttribute;     // drag, shape, sizeEnd, gravity
  private readonly aLook: InstancedBufferAttribute;     // alpha, glow, spin, spare
  private readonly attrs: readonly InstancedBufferAttribute[];
  private readonly rand = mulberry32(0x77f0);
  private cursor = 0;
  private nowS = 0;
  private aliveUntil = 0;
  private emitted = 0;
  private disposed = false;

  constructor() {
    const mk = (): InstancedBufferAttribute => {
      const a = new InstancedBufferAttribute(new Float32Array(WORLD_PARTICLES * 4), 4);
      a.setUsage(DynamicDrawUsage);
      return a;
    };
    this.aOrigin = mk(); this.aVel = mk(); this.aColor = mk(); this.aMisc = mk(); this.aLook = mk();
    this.attrs = [this.aOrigin, this.aVel, this.aColor, this.aMisc, this.aLook];
    for (let i = 0; i < WORLD_PARTICLES; i++) this.aOrigin.array[i * 4 + 3] = -1e6;
    this.clock = uniform(0).setName('ewaWorldFxClock');
    this.sizeScale = uniform(4).setName('ewaWorldFxSizeScale');
    this.light = uniform(new Vector3(1, 1, 1)).setName('ewaWorldFxLight');
    this.material = this.buildMaterial();
    const s = new Sprite(this.material);
    s.count = WORLD_PARTICLES;
    s.frustumCulled = false;
    s.layers.set(LAYERS.fx);
    s.renderOrder = 9;
    s.name = 'ewa:worldfx';
    s.visible = false;
    s.castShadow = false;
    s.receiveShadow = false;
    this.object = s;
  }

  /**
   * Emits `b` at (x, y, z), thrown along the unit direction (dx, dz) (0, 0 = all round), `scale` × count and speed.
   * Writes one contiguous run of slots (two when it wraps). Allocation-free.
   */
  emit(b: WorldBurst, x: number, y: number, z: number, dx = 0, dz = 0, scale = 1): void {
    if (this.disposed || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    const n = Math.min(64, Math.max(0, Math.round(b.count * scale)));
    if (n === 0) return;
    const rnd = this.rand;
    hexToLinearInto(b.color, _c1);
    hexToLinearInto(b.color2 ?? b.color, _c2);
    const dl = Math.hypot(dx, dz);
    const hx = dl > 1e-4 ? dx / dl : 0; const hz = dl > 1e-4 ? dz / dl : 0;
    const O = this.aOrigin.array as Float32Array; const V = this.aVel.array as Float32Array; const C = this.aColor.array as Float32Array;
    const M = this.aMisc.array as Float32Array; const L = this.aLook.array as Float32Array;
    const start = this.cursor;
    let lastDeath = this.nowS;
    const sp = Math.min(2, Math.max(0.3, scale));
    for (let k = 0; k < n; k++) {
      const slot = (start + k) % WORLD_PARTICLES;
      const i = slot * 4;
      const birth = this.nowS + (n > 1 ? (k / (n - 1)) * b.spreadMs / 1000 : 0);
      const life = (b.lifeMs / 1000) * (0.7 + rnd() * 0.6);
      const ang = rnd() * Math.PI * 2;
      const rad = b.radius * Math.sqrt(rnd());
      // the throw: along the heading (or a random azimuth without one), fanned by `spread` radians
      const base = dl > 1e-4 ? Math.atan2(hz, hx) : rnd() * Math.PI * 2;
      const a = base + (rnd() - 0.5) * b.spread;
      const v = b.speed * sp * (0.5 + rnd() * 0.7);
      O[i] = x + Math.cos(ang) * rad; O[i + 1] = y + b.height * (0.6 + rnd() * 0.8); O[i + 2] = z + Math.sin(ang) * rad; O[i + 3] = birth;
      V[i] = Math.cos(a) * v; V[i + 1] = b.up * sp * (0.6 + rnd() * 0.8); V[i + 2] = Math.sin(a) * v; V[i + 3] = life;
      const m = rnd();
      C[i] = _c1.r + (_c2.r - _c1.r) * m; C[i + 1] = _c1.g + (_c2.g - _c1.g) * m; C[i + 2] = _c1.b + (_c2.b - _c1.b) * m;
      C[i + 3] = b.size * (0.7 + rnd() * 0.6);
      M[i] = Math.max(0.001, b.drag); M[i + 1] = WORLD_SHAPE_INDEX[b.shape]; M[i + 2] = b.sizeEnd; M[i + 3] = b.gravity;
      L[i] = b.alpha * (0.8 + rnd() * 0.4); L[i + 1] = b.glow; L[i + 2] = (rnd() - 0.5) * 10; L[i + 3] = 0;
      lastDeath = Math.max(lastDeath, birth + life);
    }
    const end = start + n;
    if (end <= WORLD_PARTICLES) {
      for (const at of this.attrs) at.addUpdateRange(start * 4, n * 4);
    } else {
      for (const at of this.attrs) { at.addUpdateRange(start * 4, (WORLD_PARTICLES - start) * 4); at.addUpdateRange(0, (end - WORLD_PARTICLES) * 4); }
    }
    for (const at of this.attrs) at.needsUpdate = true;
    this.cursor = end % WORLD_PARTICLES;
    this.aliveUntil = Math.max(this.aliveUntil, lastDeath);
    this.emitted += n;
    this.object.visible = true;
  }

  /** Per frame: the clock (seconds × timeScale) and the size attenuation. Zero allocation. */
  update(dtScaledMs: number, camera: PerspectiveCamera | null): void {
    if (this.disposed) return;
    this.nowS += Math.max(0, Number.isFinite(dtScaledMs) ? dtScaledMs : 0) / 1000;
    this.clock.value = this.nowS;
    if (camera !== null) this.sizeScale.value = 1 / Math.tan((camera.fov * Math.PI / 180) / 2);
    this.object.visible = this.nowS <= this.aliveUntil;
  }

  /** Kills every particle (a zone change, a battle). */
  clear(): void {
    const o = this.aOrigin.array as Float32Array;
    for (let i = 0; i < WORLD_PARTICLES; i++) o[i * 4 + 3] = -1e6;
    this.aOrigin.clearUpdateRanges();
    this.aOrigin.needsUpdate = true;
    this.aliveUntil = 0;
    this.object.visible = false;
  }

  /** Particles emitted since construction (tests, the sandbox). */
  get count(): number { return this.emitted; }
  get now(): number { return this.nowS; }
  /** Whether a particle of the pool is alive now. */
  get alive(): boolean { return this.nowS <= this.aliveUntil; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    this.material.dispose();
  }

  private buildMaterial(): PointsNodeMaterial {
    const m = new PointsNodeMaterial();
    const aO = instancedBufferAttribute(this.aOrigin) as unknown as Node<'vec4'>;
    const aV = instancedBufferAttribute(this.aVel) as unknown as Node<'vec4'>;
    const aC = instancedBufferAttribute(this.aColor) as unknown as Node<'vec4'>;
    const aM = instancedBufferAttribute(this.aMisc) as unknown as Node<'vec4'>;
    const aL = instancedBufferAttribute(this.aLook) as unknown as Node<'vec4'>;
    const age = this.clock.sub(aO.w);
    const life = max(aV.w, float(1e-4));
    const k = age.div(life).clamp(0, 1);
    const alive = step(float(0), age).mul(step(age, life));
    const drag = aM.x;
    const disp = aV.xyz.mul(float(1).sub(exp(drag.mul(age).negate())).div(drag));
    m.positionNode = aO.xyz.add(disp).add(vec3(0, aM.w.mul(age).mul(age).mul(-0.5), 0));
    m.sizeNode = aC.w.mul(mix(float(1), aM.z, k)).mul(alive).mul(this.sizeScale);
    // shapes: puff · grain · leaf · drop · flake · spark · ring (the leaf spins about the view axis)
    const q0 = uv().sub(0.5);
    // the life fraction and the leaf's spin are per particle: computed once in the vertex stage. Read in the fragment
    // stage they were built inside the first select branch that used them (the leaf's) and read uninitialised in every
    // other branch (measured in the WGSL: every non-leaf particle faded to 0 and was discarded)
    const kF = varying(k);
    const spin = varying(aL.z.mul(age));
    const cs = cos(spin); const sn = sin(spin);
    const q = vec2(q0.x.mul(cs).sub(q0.y.mul(sn)), q0.x.mul(sn).add(q0.y.mul(cs)));
    const r = length(q0);
    const shapeAlpha = Fn(() => {
      const s = aM.y;
      const puff = smoothstep(0.5, 0.05, r);
      const grain = smoothstep(0.5, 0.3, r);
      const leaf = smoothstep(0.5, 0.42, length(vec2(q.x.mul(2.6), q.y)));
      const drop = smoothstep(0.5, 0.38, length(vec2(q0.x.mul(1.8), q0.y.mul(0.9))));
      const flake = smoothstep(0.5, 0.2, r);
      const spark = max(smoothstep(0.1, 0.0, min(abs(q0.x), abs(q0.y)).mul(2.2)).mul(smoothstep(0.5, 0.1, r)), smoothstep(0.2, 0.0, r));
      const ring = smoothstep(0.07, 0.0, abs(r.sub(0.4)));
      return select(s.lessThan(0.5), puff, select(s.lessThan(1.5), grain, select(s.lessThan(2.5), leaf, select(s.lessThan(3.5), drop,
        select(s.lessThan(4.5), flake, select(s.lessThan(5.5), spark, ring))))));
    })();
    // in fast, then out linearly over the life (a puff thins as it grows: its size end does the rest)
    const fade = smoothstep(0, 0.08, kF).mul(float(1).sub(kF));
    const a = shapeAlpha.mul(fade).mul(aL.x).clamp(0, 4);
    const glow = aL.y;
    const lit = aC.rgb.mul(this.light);
    // premultiplied: rgb·a, and the coverage term shrinks to 0 for an additive (glow 1) particle. The cut is on the
    // coverage before that (an alpha test would drop every additive texel), so a faint texel writes no MRT channel.
    m.colorNode = Fn(() => {
      Discard(a.lessThan(OVERLAY_ALPHA_CUT));
      return vec4(mix(lit, aC.rgb, glow).mul(a), a.mul(float(1).sub(glow)).clamp(0, 1));
    })();
    m.transparent = true;
    m.blending = CustomBlending;
    m.blendSrc = OneFactor; m.blendDst = OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = OneFactor; m.blendDstAlpha = OneMinusSrcAlphaFactor;
    // the colour node is premultiplied already: three's `premultipliedAlpha` would multiply by alpha a second time and
    // turn every puff into a dark smudge (measured in the sandbox)
    m.depthWrite = false;
    m.depthTest = true;
    m.sizeAttenuation = true;
    m.fog = false;
    m.mrtNode = overlayMrt(true);
    m.name = 'ewa:worldfx';
    m.userData = { ewaClass: 'fx' };
    return m;
  }
}
