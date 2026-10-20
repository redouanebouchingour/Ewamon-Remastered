/**
 * SPEC §10.3.6 — overworld weather is cosmetic. `weatherParams` is the pure table; `PrecipitationSheet`
 * is the one rain/hail draw (4 000 streaks, layer 29, no shadow).
 *
 * Deviation (notes): WebGPU has no wide lines or sized points without a sprite path, so the sheet is
 * `LineSegments` streaks animated in the vertex stage; `hail` uses short bright streaks instead of the
 * SPEC's `pointWidth 3`.
 */
import { BufferAttribute, BufferGeometry, Color, LineBasicNodeMaterial, LineSegments } from 'three/webgpu';
import type { Vector3 } from 'three/webgpu';
import { attribute, float, mod, positionLocal, uniform, vec3 } from 'three/tsl';
import type { Node, UniformNode } from 'three/webgpu';
import { LAYERS, type WeatherKind } from '../descriptors.js';
import type { SharedUniforms } from '../materials/harvest.js';
import { hexToSrgb } from './color.js';

export interface WeatherParams {
  readonly cloudCoverage: number;
  readonly sunMul: number;
  readonly envMul: number;
  readonly fogDensityMul: number;
  readonly fogTint: string | null;
  readonly fogTintSrgb: readonly [number, number, number] | null;
  readonly wetTarget: 0 | 1;
  readonly precipitation: 'none' | 'rain' | 'hail';
}

/** §10.3.3 default cloud coverage (0.35) is the `none` row. */
export const DEFAULT_CLOUD_COVERAGE = 0.35;

const row = (p: Omit<WeatherParams, 'fogTintSrgb'>): WeatherParams =>
  Object.freeze({ ...p, fogTintSrgb: p.fogTint !== null ? hexToSrgb(p.fogTint) : null });

const TABLE: Readonly<Record<WeatherKind, WeatherParams>> = {
  none: row({ cloudCoverage: DEFAULT_CLOUD_COVERAGE, sunMul: 1, envMul: 1, fogDensityMul: 1, fogTint: null, wetTarget: 0, precipitation: 'none' }),
  sun: row({ cloudCoverage: 0.1, sunMul: 1, envMul: 1.1, fogDensityMul: 1, fogTint: null, wetTarget: 0, precipitation: 'none' }),
  rain: row({ cloudCoverage: 0.85, sunMul: 0.55, envMul: 1, fogDensityMul: 1, fogTint: null, wetTarget: 1, precipitation: 'rain' }),
  sand: row({ cloudCoverage: DEFAULT_CLOUD_COVERAGE, sunMul: 1, envMul: 1, fogDensityMul: 2.5, fogTint: '#c9a24a', wetTarget: 0, precipitation: 'none' }),
  // SPEC: "hail → rain sheet with pointWidth 3, tint white"; surfaces also read wet (interpretation, notes).
  hail: row({ cloudCoverage: 0.85, sunMul: 0.55, envMul: 1, fogDensityMul: 1, fogTint: null, wetTarget: 1, precipitation: 'hail' }),
};

/**
 * Honor shapes the world: a zone's shadow level 0..4 (content worldHonor.ts) dims the sun and the sky light and pulls
 * the fog towards a dusky violet, a step per level; level 0 changes nothing.
 */
export const SHADOW_FOG = '#2b1e3a';
export interface ShadowParams {
  readonly sunMul: number;
  readonly envMul: number;
  /** how far the fog colour moves towards SHADOW_FOG */
  readonly fogMix: number;
  readonly fogDensityMul: number;
}
export function shadowParams(level: number): ShadowParams {
  const l = Math.max(0, Math.min(4, Math.round(level)));
  return { sunMul: 1 - 0.12 * l, envMul: 1 - 0.1 * l, fogMix: 0.14 * l, fogDensityMul: 1 + 0.2 * l };
}

/**
 * Majin vs Tenjin seasons: the side that won the last season holds the sky over Solenne. Majin: a hazed red sky
 * (turbidity up, less blue scatter) and a crimson haze; Tenjin: a clear gold sky (less turbidity) and a warm haze with
 * a little more sky light. null: the sky as it is.
 */
export type SkyMood = 'majin' | 'tenjin';
export interface SkyMoodParams {
  readonly turbidityAdd: number;
  readonly rayleighMul: number;
  readonly fogTint: string | null;
  readonly fogMix: number;
  readonly envMul: number;
  /** the hemisphere's sky colour (the fill every surface takes from above) moves this far to `skyTint` */
  readonly skyTint: string | null;
  readonly hemiMix: number;
  /** the sun's colour (what lights the diorama most) moves this far to `skyTint` */
  readonly sunMix: number;
}
const NO_MOOD: SkyMoodParams = Object.freeze({ turbidityAdd: 0, rayleighMul: 1, fogTint: null, fogMix: 0, envMul: 1, skyTint: null, hemiMix: 0, sunMix: 0 });
const MOODS: Readonly<Record<SkyMood, SkyMoodParams>> = Object.freeze({
  majin: Object.freeze({ turbidityAdd: 9, rayleighMul: 0.45, fogTint: '#7a2433', fogMix: 0.38, envMul: 0.92, skyTint: '#c0394f', hemiMix: 0.55, sunMix: 0.35 }),
  tenjin: Object.freeze({ turbidityAdd: -1.5, rayleighMul: 0.7, fogTint: '#f0d79a', fogMix: 0.32, envMul: 1.08, skyTint: '#ffd27a', hemiMix: 0.5, sunMix: 0.3 }),
});
export function skyMoodParams(mood: SkyMood | null): SkyMoodParams {
  return mood === null ? NO_MOOD : MOODS[mood];
}

export function weatherParams(w: WeatherKind): WeatherParams {
  return TABLE[w] ?? TABLE.none;
}

/** Streak count (§10.3.6). */
export const RAIN_STREAKS = 4000;
const BOX_XZ = 44;        // m, centred on the camera focus
const BOX_H = 22;         // m
const FALL_RAIN = 11;     // m/s
const FALL_HAIL = 7;

/** A deterministic hash in [0,1) — the sheet's layout must not use Math.random (§10.0.3 rule 2). */
function hash01(i: number): number {
  let x = (i + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * One `LineSegments` of `RAIN_STREAKS` streaks. Each streak's two vertices share a base (x, y0, z) and
 * differ by `tip`; the vertex stage wraps `y0 − t·speed` into the box, so a streak never stretches across
 * the wrap. The time source is the shared `windTime` (× timeScale), so hitstop freezes rain too.
 */
export class PrecipitationSheet {
  readonly object: LineSegments;
  private readonly speed: UniformNode<'float', number>;
  private readonly length: UniformNode<'float', number>;
  private readonly material: LineBasicNodeMaterial;
  private readonly geometry: BufferGeometry;
  private mode: 'none' | 'rain' | 'hail' = 'none';

  constructor(shared: SharedUniforms) {
    const n = RAIN_STREAKS;
    const pos = new Float32Array(n * 2 * 3);
    const tip = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = (hash01(i * 3) - 0.5) * BOX_XZ;
      const y = hash01(i * 3 + 1) * BOX_H;
      const z = (hash01(i * 3 + 2) - 0.5) * BOX_XZ;
      for (let k = 0; k < 2; k++) {
        const o = (i * 2 + k) * 3;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        tip[i * 2 + k] = k;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('tip', new BufferAttribute(tip, 1));
    this.geometry = g;

    this.speed = uniform(FALL_RAIN);
    this.length = uniform(0.55);
    const t = shared.windTime;
    const p = positionLocal as Node<'vec3'>;
    const tipA = attribute('tip', 'float') as Node<'float'>;
    const y = mod(p.y.sub(t.mul(this.speed)), float(BOX_H)).sub(BOX_H * 0.5).add(tipA.mul(this.length));
    const slant = tipA.mul(this.length).mul(0.25);
    const m = new LineBasicNodeMaterial({ transparent: true, depthWrite: false });
    m.positionNode = vec3(p.x.add(shared.windDir.x.mul(slant)), y, p.z.add(shared.windDir.y.mul(slant)));
    m.color = new Color(0xa9bccc);
    m.opacity = 0.35;
    this.material = m;

    const obj = new LineSegments(g, m);
    obj.name = 'ewa:precipitation';
    obj.frustumCulled = false;
    obj.castShadow = false;
    obj.receiveShadow = false;
    obj.layers.set(LAYERS.fx);
    obj.visible = false;
    obj.renderOrder = 10;
    this.object = obj;
  }

  setMode(mode: 'none' | 'rain' | 'hail'): void {
    this.mode = mode;
    this.object.visible = mode !== 'none';
    if (mode === 'hail') {
      this.speed.value = FALL_HAIL; this.length.value = 0.14;
      this.material.color.set(0xf4f7fa); this.material.opacity = 0.8;
    } else {
      this.speed.value = FALL_RAIN; this.length.value = 0.55;
      this.material.color.set(0xa9bccc); this.material.opacity = 0.35;
    }
  }

  get currentMode(): 'none' | 'rain' | 'hail' { return this.mode; }

  /** Keeps the sheet centred on the camera focus. */
  follow(focus: Vector3): void {
    this.object.position.set(focus.x, focus.y + BOX_H * 0.35, focus.z);
  }

  dispose(): void {
    this.object.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
