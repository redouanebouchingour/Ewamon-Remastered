/**
 * World effects (SPEC §10.7.8): the air's own life. A field of `AMBIENT_MOTES` motes round the camera focus, drawn as
 * one instanced `Sprite` whose every position is computed in the vertex stage (like the rain sheet, §10.3.6): each
 * mote has a fixed seed, drifts with its layer's velocity, wanders on a slow sine and wraps in a 40 m box that moves
 * with the focus, so the field is world-anchored and endless and a frame writes only uniforms.
 *
 * Two layers share the pool. The first follows the zone's biome and the time of day (fireflies in the grove at
 * night, pollen by day, embers over Cinderhold, salt spray, storm sparks, snow motes, star motes at the shrine, void
 * spores in the rift). The second carries the zone's mood: falling ash where honor has cast a shadow (denser per
 * level), else the season's sky over Solenne (red embers for the Majin, gold motes for the Tenjin). Rain thins the
 * first layer. Indoors (`setAmbient(false)`) the field is off. The detail distance (`zone/detail.ts`) narrows the field:
 * motes past it fade out and draw at size 0 (no fragments).
 */
import { Color, CustomBlending, InstancedBufferAttribute, OneFactor, OneMinusSrcAlphaFactor, PointsNodeMaterial, Sprite, Vector3, Vector4 } from 'three/webgpu';
import type { Node, PerspectiveCamera, UniformNode } from 'three/webgpu';
import { Discard, Fn, cos, float, instancedBufferAttribute, length, mix, mod, sin, smoothstep, step, uniform, uv, varying, vec2, vec3, vec4 } from 'three/tsl';
import type { Biome } from '../contracts.js';
import type { WeatherKind } from '../descriptors.js';
import { LAYERS } from '../descriptors.js';
import { overlayMrt } from '../sprites/overlayMrt.js';
import { hexToLinearInto } from '../sprites/typeColors.js';
import { mulberry32 } from '../stage/vfx.js';
import { detailState } from '../zone/detail.js';

/** Motes in the field: the biome layer, then the mood layer. */
export const AMBIENT_MOTES = 720;
export const AMBIENT_MOOD_MOTES = 240;
/** The wrap box round the focus (m): horizontal extent, height. */
export const AMBIENT_BOX = Object.freeze({ xz: 40, y: 7 });

export interface AmbientProfile {
  readonly color: string;
  readonly color2: string;
  /** fraction of the layer's motes shown, 0..1 */
  readonly density: number;
  /** world diameter (m) */
  readonly size: number;
  /** peak opacity (glowing motes: brightness) */
  readonly alpha: number;
  /** 0 = lit and blended (dust, pollen) … 1 = additive glow (fireflies, embers) */
  readonly glow: number;
  /** drift (m/s) */
  readonly vel: readonly [number, number, number];
  /** wander amplitude (m) and rate (Hz) */
  readonly wander: number;
  readonly wanderHz: number;
  /** 0 = steady … 1 = blinks (fireflies) */
  readonly blink: number;
  /** height band above the focus (m) */
  readonly yMin: number;
  readonly yMax: number;
}

const P = (o: Partial<AmbientProfile> & Pick<AmbientProfile, 'color' | 'color2'>): AmbientProfile => Object.freeze({
  density: 0.4, size: 0.04, alpha: 0.8, glow: 0, vel: [0, 0, 0] as const, wander: 0.3, wanderHz: 0.4, blink: 0, yMin: 0.2, yMax: 3, ...o,
});

export const AMBIENT_PROFILES = Object.freeze({
  none: P({ color: '#000000', color2: '#000000', density: 0 }),
  fireflies: P({ color: '#eaff86', color2: '#ffd86a', density: 0.6, size: 0.13, alpha: 4, glow: 1, vel: [0, 0.04, 0], wander: 0.7, wanderHz: 0.28, blink: 0.9, yMin: 0.3, yMax: 2.4 }),
  wisps: P({ color: '#9fd8ff', color2: '#c8b8ff', density: 0.45, size: 0.14, alpha: 3.2, glow: 1, vel: [0, 0.05, 0], wander: 0.8, wanderHz: 0.22, blink: 0.7, yMin: 0.4, yMax: 2.6 }),
  pollen: P({ color: '#fffbe8', color2: '#f2eec0', density: 0.35, size: 0.035, alpha: 0.75, vel: [0.22, 0.03, 0.14], wander: 0.25, wanderHz: 0.5, yMin: 0.4, yMax: 3.2 }),
  spores: P({ color: '#dcd2f2', color2: '#b8c8a8', density: 0.3, size: 0.04, alpha: 0.6, vel: [0.08, 0.06, 0.05], wander: 0.4, wanderHz: 0.3, yMin: 0.3, yMax: 3 }),
  embers: P({ color: '#ff7a2a', color2: '#ffc45a', density: 0.5, size: 0.08, alpha: 3, glow: 1, vel: [0.08, 0.5, 0.04], wander: 0.35, wanderHz: 0.7, blink: 0.45, yMin: 0, yMax: 6 }),
  forgeEmbers: P({ color: '#ff8a3a', color2: '#ffd07a', density: 0.25, size: 0.07, alpha: 2.6, glow: 1, vel: [0.1, 0.42, 0.05], wander: 0.3, wanderHz: 0.8, blink: 0.5, yMin: 0, yMax: 6 }),
  spray: P({ color: '#ffffff', color2: '#e2eef4', density: 0.3, size: 0.03, alpha: 0.55, vel: [0.7, 0.04, 0.25], wander: 0.2, wanderHz: 0.6, yMin: 0.2, yMax: 2.2 }),
  sparks: P({ color: '#cfe4ff', color2: '#ffffff', density: 0.22, size: 0.05, alpha: 3.2, glow: 1, vel: [0.25, 0, 0.12], wander: 0.5, wanderHz: 1.4, blink: 0.95, yMin: 0.5, yMax: 4.5 }),
  dust: P({ color: '#f2d4a2', color2: '#e0b884', density: 0.4, size: 0.03, alpha: 0.6, vel: [0.1, 0.02, 0.05], wander: 0.25, wanderHz: 0.35, yMin: 0.3, yMax: 3.5 }),
  snow: P({ color: '#ffffff', color2: '#e8f0fa', density: 0.45, size: 0.045, alpha: 0.85, vel: [0.15, -0.35, 0.08], wander: 0.35, wanderHz: 0.4, yMin: 0, yMax: 7 }),
  stars: P({ color: '#bfe8ff', color2: '#ffffff', density: 0.35, size: 0.07, alpha: 3, glow: 1, vel: [0, 0.12, 0], wander: 0.3, wanderHz: 0.3, blink: 0.6, yMin: 0, yMax: 4.5 }),
  void: P({ color: '#b07cff', color2: '#6a46c0', density: 0.45, size: 0.09, alpha: 2.6, glow: 1, vel: [0, 0.08, 0], wander: 0.5, wanderHz: 0.25, blink: 0.3, yMin: 0, yMax: 4 }),
  // the mood layer
  ash: P({ color: '#3a3440', color2: '#6a6074', density: 0.2, size: 0.05, alpha: 0.75, vel: [0.06, -0.14, 0.03], wander: 0.3, wanderHz: 0.3, yMin: 0, yMax: 7 }),
  majin: P({ color: '#ff3a4a', color2: '#ff8a5a', density: 0.4, size: 0.08, alpha: 3, glow: 1, vel: [0.05, 0.3, 0.03], wander: 0.35, wanderHz: 0.5, blink: 0.5, yMin: 0, yMax: 6 }),
  tenjin: P({ color: '#ffd76a', color2: '#fff3c4', density: 0.4, size: 0.07, alpha: 3, glow: 1, vel: [0, 0.2, 0], wander: 0.3, wanderHz: 0.35, blink: 0.4, yMin: 0, yMax: 6 }),
});
export type AmbientProfileId = keyof typeof AMBIENT_PROFILES;

/** The biome layer's profile for a biome at a daylight 0..1 (night below 0.35). Pure. */
export function biomeProfile(biome: Biome | null, daylight: number): AmbientProfileId {
  const night = daylight < 0.35;
  switch (biome) {
    case 'grove': case 'capital': return night ? 'fireflies' : 'pollen';
    case 'vesper': return night ? 'wisps' : 'spores';
    case 'marrow': return night ? 'fireflies' : 'dust';
    case 'cinder': return 'embers';
    case 'forge': return 'forgeEmbers';
    case 'salt': return 'spray';
    case 'storm': return 'sparks';
    case 'sky': return 'snow';
    case 'shrine': return 'stars';
    case 'rift': return 'void';
    default: return 'none';
  }
}

/** The mood layer: a zone's shadow (honor) wins; else the season's sky mood; else nothing. Pure. */
export function moodProfile(shadow: number, mood: 'majin' | 'tenjin' | null): { readonly id: AmbientProfileId; readonly density: number } {
  const l = Math.max(0, Math.min(4, Math.round(shadow)));
  if (l > 0) return { id: 'ash', density: 0.22 * l };
  if (mood !== null) return { id: mood, density: AMBIENT_PROFILES[mood].density };
  return { id: 'none', density: 0 };
}

/** How much of the biome layer a weather leaves (rain and hail ground the fireflies and the pollen). Pure. */
export function weatherThins(w: WeatherKind): number {
  return w === 'rain' || w === 'hail' ? 0.25 : w === 'sand' ? 0.5 : 1;
}

interface LayerUniforms {
  readonly color: UniformNode<'vec3', Vector3>;
  readonly color2: UniformNode<'vec3', Vector3>;
  readonly vel: UniformNode<'vec3', Vector3>;
  /** density, size, alpha, glow */
  readonly look: UniformNode<'vec4', Vector4>;
  /** wander, wanderHz, blink, unused */
  readonly move: UniformNode<'vec4', Vector4>;
  /** yMin, yMax, unused */
  readonly band: UniformNode<'vec3', Vector3>;
}

const _c = new Color();

export class AmbientMotes {
  readonly object: Sprite;
  readonly material: PointsNodeMaterial;
  readonly clock: UniformNode<'float', number>;
  readonly focus: UniformNode<'vec3', Vector3>;
  readonly sizeScale: UniformNode<'float', number>;
  private readonly layers: readonly [LayerUniforms, LayerUniforms];
  private readonly seeds: InstancedBufferAttribute;     // x, y, z in 0..1, phase
  private readonly extra: InstancedBufferAttribute;     // density draw, colour mix, layer (0 / 1), size jitter
  private biome: Biome | null = null;
  private shadow = 0;
  private mood: 'majin' | 'tenjin' | null = null;
  private weather: WeatherKind = 'none';
  private on = true;
  private nowS = 0;
  private current: [AmbientProfileId, AmbientProfileId] = ['none', 'none'];
  /** eased densities of both layers (a profile swap fades out, then in) */
  private readonly shown = [0, 0];
  private disposed = false;

  constructor(private readonly light: UniformNode<'vec3', Vector3>) {
    const n = AMBIENT_MOTES;
    const seeds = new Float32Array(n * 4); const extra = new Float32Array(n * 4);
    const rnd = mulberry32(0xa1b1e7);
    for (let i = 0; i < n; i++) {
      seeds[i * 4] = rnd(); seeds[i * 4 + 1] = rnd(); seeds[i * 4 + 2] = rnd(); seeds[i * 4 + 3] = rnd();
      extra[i * 4] = rnd(); extra[i * 4 + 1] = rnd(); extra[i * 4 + 2] = i >= n - AMBIENT_MOOD_MOTES ? 1 : 0; extra[i * 4 + 3] = 0.7 + rnd() * 0.6;
    }
    this.seeds = new InstancedBufferAttribute(seeds, 4);
    this.extra = new InstancedBufferAttribute(extra, 4);
    this.clock = uniform(0).setName('ewaAmbientClock');
    this.focus = uniform(new Vector3()).setName('ewaAmbientFocus');
    this.sizeScale = uniform(4).setName('ewaAmbientSizeScale');
    const mk = (k: number): LayerUniforms => ({
      color: uniform(new Vector3()).setName(`ewaAmbientColor${k}`), color2: uniform(new Vector3()).setName(`ewaAmbientColorB${k}`),
      vel: uniform(new Vector3()).setName(`ewaAmbientVel${k}`), look: uniform(new Vector4()).setName(`ewaAmbientLook${k}`),
      move: uniform(new Vector4()).setName(`ewaAmbientMove${k}`), band: uniform(new Vector3(0, 3, 0)).setName(`ewaAmbientBand${k}`),
    });
    this.layers = [mk(0), mk(1)];
    this.material = this.buildMaterial();
    const s = new Sprite(this.material);
    s.count = n;
    s.frustumCulled = false;
    s.layers.set(LAYERS.fx);
    s.renderOrder = 8;
    s.name = 'ewa:ambient';
    s.castShadow = false;
    s.receiveShadow = false;
    s.visible = false;
    this.object = s;
  }

  setBiome(b: Biome | null): void { this.biome = b; }
  setShadow(level: number): void { this.shadow = Number.isFinite(level) ? level : 0; }
  setSkyMood(m: 'majin' | 'tenjin' | null): void { this.mood = m; }
  setWeather(w: WeatherKind): void { this.weather = w; }
  /** Off indoors (a pocket) and wherever the client says the air is still. */
  setOn(on: boolean): void { this.on = on; }

  /** The profiles shown now (tests, the sandbox). */
  get profiles(): readonly [AmbientProfileId, AmbientProfileId] { return this.current; }
  get densities(): readonly number[] { return this.shown; }

  /** Per frame: scaled ms, the focus, the daylight 0..1. Uniform writes only. */
  update(dtScaledMs: number, focus: Vector3, daylight: number, camera: PerspectiveCamera | null): void {
    if (this.disposed) return;
    const dt = Math.max(0, Number.isFinite(dtScaledMs) ? dtScaledMs : 0) / 1000;
    this.nowS = (this.nowS + dt) % 3600;
    this.clock.value = this.nowS;
    this.focus.value.copy(focus);
    if (camera !== null) this.sizeScale.value = 1 / Math.tan((camera.fov * Math.PI / 180) / 2);
    const a = biomeProfile(this.biome, daylight);
    const m = moodProfile(this.shadow, this.mood);
    const targets = [this.on ? AMBIENT_PROFILES[a].density * weatherThins(this.weather) : 0, this.on ? m.density : 0];
    const want: [AmbientProfileId, AmbientProfileId] = [a, m.id];
    const k = 1 - Math.exp(-dt * 1.5);
    for (let l = 0; l < 2; l++) {
      // a swap fades the old profile out first, then writes the new one and fades it in
      if (want[l] !== this.current[l]) {
        this.shown[l] = Math.max(0, this.shown[l]! - dt * 1.2);
        if (this.shown[l]! <= 0) { this.current[l] = want[l]!; this.write(l, this.current[l]!); }
      } else this.shown[l] = this.shown[l]! + (targets[l]! - this.shown[l]!) * k;
      this.layers[l]!.look.value.x = this.shown[l]!;
    }
    this.object.visible = this.shown[0]! > 0.005 || this.shown[1]! > 0.005;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    this.material.dispose();
  }

  private write(l: number, id: AmbientProfileId): void {
    const p = AMBIENT_PROFILES[id];
    const u = this.layers[l]!;
    hexToLinearInto(p.color, _c); u.color.value.set(_c.r, _c.g, _c.b);
    hexToLinearInto(p.color2, _c); u.color2.value.set(_c.r, _c.g, _c.b);
    u.vel.value.set(p.vel[0], p.vel[1], p.vel[2]);
    u.look.value.set(this.shown[l]!, p.size, p.alpha, p.glow);
    u.move.value.set(p.wander, p.wanderHz, p.blink, 0);
    u.band.value.set(p.yMin, p.yMax, 0);
  }

  private buildMaterial(): PointsNodeMaterial {
    const m = new PointsNodeMaterial();
    const seed = instancedBufferAttribute(this.seeds) as unknown as Node<'vec4'>;
    const ex = instancedBufferAttribute(this.extra) as unknown as Node<'vec4'>;
    const [A, Bl] = this.layers;
    const isB = ex.z;
    const pick3 = (a: Node<'vec3'>, b: Node<'vec3'>): Node<'vec3'> => mix(a, b, isB) as Node<'vec3'>;
    const pick4 = (a: Node<'vec4'>, b: Node<'vec4'>): Node<'vec4'> => mix(a, b, isB) as Node<'vec4'>;
    const vel = pick3(A.vel as unknown as Node<'vec3'>, Bl.vel as unknown as Node<'vec3'>);
    const look = pick4(A.look as unknown as Node<'vec4'>, Bl.look as unknown as Node<'vec4'>);
    const move = pick4(A.move as unknown as Node<'vec4'>, Bl.move as unknown as Node<'vec4'>);
    const band = pick3(A.band as unknown as Node<'vec3'>, Bl.band as unknown as Node<'vec3'>);
    const t = this.clock;
    const box = float(AMBIENT_BOX.xz);
    const half = box.mul(0.5);
    const f = this.focus as unknown as Node<'vec3'>;
    // world-anchored, wrapped round the focus: x = focus + mod(seed·box + vel·t − focus + box/2, box) − box/2
    const px = f.x.add(mod(seed.x.mul(box).add(vel.x.mul(t)).sub(f.x).add(half), box)).sub(half);
    const pz = f.z.add(mod(seed.z.mul(box).add(vel.z.mul(t)).sub(f.z).add(half), box)).sub(half);
    const range = band.y.sub(band.x).max(0.1);
    const py = f.y.add(band.x).add(mod(seed.y.mul(range).add(vel.y.mul(t)), range));
    const ph = seed.w.mul(6.2832);
    const w = t.mul(move.y).mul(6.2832).add(ph);
    const wander = vec3(sin(w), cos(w.mul(0.7).add(1.3)).mul(0.5), cos(w.mul(1.3))).mul(move.x);
    const pos = vec3(px, py, pz).add(wander);
    m.positionNode = pos;
    // the density draw, a blink, and a fade at the box's rim and the band's ends (no pop as a mote wraps)
    const distM = length(vec2(px.sub(f.x), pz.sub(f.z)));
    const dxz = distM.div(half);
    const field = detailState.uniform as unknown as Node<'vec4'>;
    const near = float(1).sub(smoothstep(field.z.sub(field.w), field.z, distM));   // the detail distance
    const rim = smoothstep(1, 0.7, dxz).mul(near);
    const yk = py.sub(f.y).sub(band.x).div(range);
    const ends = smoothstep(0, 0.12, yk).mul(smoothstep(1, 0.88, yk));
    const blinkWave = sin(t.mul(1.7).add(ph.mul(13))).mul(0.5).add(0.5);
    const blink = mix(float(1), smoothstep(0.55, 0.95, blinkWave), move.z);
    const shown = step(ex.x, look.x);
    m.sizeNode = look.y.mul(ex.w).mul(shown).mul(step(0.001, near)).mul(this.sizeScale);
    // per mote, in the vertex stage (TSL builds a node shared by select branches inside the first one: varyings)
    const alphaV = varying(look.z.mul(rim).mul(ends).mul(blink).mul(shown));
    const glowV = varying(look.w);
    const colV = varying(mix(pick3(A.color as unknown as Node<'vec3'>, Bl.color as unknown as Node<'vec3'>), pick3(A.color2 as unknown as Node<'vec3'>, Bl.color2 as unknown as Node<'vec3'>), ex.y));
    const r = length(uv().sub(0.5));
    const disc = smoothstep(0.5, 0.08, r).mul(mix(float(1), smoothstep(0.5, 0, r), glowV));
    const lit = colV.mul(this.light as unknown as Node<'vec3'>);
    m.colorNode = Fn(() => {
      const a = disc.mul(alphaV);
      Discard(a.lessThan(0.004));
      return vec4(mix(lit, colV, glowV).mul(a), a.mul(float(1).sub(glowV)).clamp(0, 1));
    })();
    m.transparent = true;
    m.blending = CustomBlending;
    m.blendSrc = OneFactor; m.blendDst = OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = OneFactor; m.blendDstAlpha = OneMinusSrcAlphaFactor;
    m.depthWrite = false;
    m.depthTest = true;
    m.sizeAttenuation = true;
    m.fog = false;
    m.mrtNode = overlayMrt(true);
    m.name = 'ewa:ambient';
    m.userData = { ewaClass: 'fx' };
    return m;
  }
}
