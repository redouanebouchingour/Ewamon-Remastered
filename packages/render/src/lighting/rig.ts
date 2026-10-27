/**
 * SPEC §10.3.1 (sun + 4 cascades) and §10.3.2 (light budget and descriptor).
 *
 * - One `DirectionalLight` (sun by day, moon by night — same object, §10.3.4) with a `SunShadowNode` (`sunShadow.ts`),
 *   attached through `light.shadow.shadowNode`. 2026-10-27 (performance, a deviation from §10.3.1's cascades, render
 *   IMPLEMENTATION-NOTES "Cached sun shadows"): a static map re-rendered about once a second and an actor map for the
 *   moving casters, instead of the 2-cascade CSM re-rendered on a stagger (2026-10-25, "Cheaper shadows and reflections").
 * - A `HemisphereLight` fill at 0.18 (§10.3.3).
 * - Punctual lights are created from `LightSource` descriptors (`createPunctuals`), parented by the
 *   caller (the zone root, so the zone's disposal owns them) and registered here so the day cycle
 *   multiplier, harvest switch and flicker reach them. Budget: 8 shadow-casting + 24 non-shadowing.
 * - The fixed light layout (handover, SPEC §10.3.2 as amended 2026-10-06): the renderer's `lighting` is the
 *   layout (`createLightingLayout`, `layout.ts`), which loops over every non-shadow Spot / Point light in one uniform
 *   array, so a zone's own lights never change a program or a cache key. Every zone renders with the boot's light set.
 * - 2026-10-25 (load time; a deviation from §10.3.2, render IMPLEMENTATION-NOTES "Lit shaders without spot shadows"): no punctual light
 *   renders a shadow map. The 2 shadow-casting spot slots a zone borrowed are gone; a `castShadow` source is a looped
 *   local light like the rest (it still counts against the content budget's 8). Each shadowed spot light was ~88
 *   lines of every lit fragment shader whether lit or not, and shader compiles were most of the load time.
 */
import { DirectionalLight, HemisphereLight, Object3D, PointLight, SpotLight } from 'three/webgpu';
import type { Scene, Vector3 } from 'three/webgpu';
import { SunShadowNode } from './sunShadow.js';
import { LightLayout } from './layout.js';
import { LIGHT_BUDGET, type LightKind, type LightSource } from '../descriptors.js';
import { isDevBuild } from '../env.js';

// ---- §10.3.1 constants ---------------------------------------------------------------------------------

/** `mapSize`: the static map's edge at `high` (`quality.ts` sets it and the actor map's per preset). */
export const SUN_SHADOW = Object.freeze({ mapSize: 4096, bias: -0.0004, normalBias: 0.02, radius: 2 });
/** §10.3.3 as amended 2026-10-06: the noon fill level (the day table's `hemi` column drives it per frame). */
export const HEMI_INTENSITY = 0.08;

/**
 * Unit bridge (implementation note): the SPEC's sun / moon / hemisphere numbers (§10.3.3, §10.3.5) use
 * the legacy convention in which a white Lambert surface under intensity 1 returns 1 — that is what its
 * ceiling arithmetic assumes ("albedo 0.85 × noon sun 1.0 = 0.85"). three r155+ lights are physically
 * based: a directional/hemisphere light of intensity E yields ρE/π. The rig multiplies those SPEC values by
 * π. `LightSource.intensity` is already "candela-scaled three intensity" and is written unchanged.
 */
export const SPEC_LIGHT_UNIT = Math.PI;

// ---- §10.3.2 local lights ------------------------------------------------------------------------------

export const SPOT_PARAMS = Object.freeze({ angle: 0.87, penumbra: 0.5 });
export const LIGHT_DECAY = 2;

/**
 * The fixed light layout (handover; SPEC §10.3.2 as amended 2026-10-06; no shadow slots since 2026-10-25, a deviation).
 * - `maxLocalLights`: the uniform-array capacity of the looped lights: a zone's 8 + 24 sources, the arena's 2 beacons
 *   and the follower's light, with headroom (the loop runs over the lights that reach the view, not the capacity).
 */
export const LIGHT_LAYOUT = Object.freeze({ maxLocalLights: 40 });

/** The renderer's `lighting` (set at §10.1.2 step 4): non-shadow lights looped from one uniform array (`layout.ts`). */
export function createLightingLayout(): LightLayout {
  return new LightLayout(LIGHT_LAYOUT.maxLocalLights);
}

const SPOT_KINDS: ReadonlySet<LightKind> = new Set<LightKind>(['lamp', 'lantern', 'beacon', 'window']);

/** `lamp`/`lantern`/`beacon`/`window` → SpotLight pointing −Y; the rest → PointLight. */
export function lightTypeFor(kind: LightKind): 'SpotLight' | 'PointLight' {
  return SPOT_KINDS.has(kind) ? 'SpotLight' : 'PointLight';
}

export interface LightCounts { shadow: number; nonShadow: number }

/**
 * §10.3.2: throws `RangeError('light budget')` at the 9th `castShadow: true` or the 25th
 * `castShadow: false` source, counting `existing` (already registered) first. Pure.
 */
export function assertLightBudget(sources: readonly Pick<LightSource, 'castShadow'>[], existing: LightCounts = { shadow: 0, nonShadow: 0 }): LightCounts {
  let shadow = existing.shadow;
  let nonShadow = existing.nonShadow;
  for (const s of sources) {
    if (s.castShadow) { shadow++; if (shadow > LIGHT_BUDGET.shadowCasters) throw new RangeError('light budget'); }
    else { nonShadow++; if (nonShadow > LIGHT_BUDGET.nonShadow) throw new RangeError('light budget'); }
  }
  return { shadow, nonShadow };
}

/** Deterministic hash in [0, 1) of an integer (flicker noise; no Math.random, §10.0.3 rule 2). */
export function hash1(n: number): number {
  let x = Math.imul((n | 0) ^ 0x27d4eb2d, 0x165667b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca77);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

/** §10.3.2 flicker multiplier: `1 + a·sin(2π·hz·t)·0.6 + a·hash(floor(t·hz·3))·0.4`, a clamped to ≤ 0.15. */
export function flickerFactor(amplitude: number, hz: number, t: number): number {
  const a = Math.min(0.15, Math.max(0, amplitude));
  return 1 + a * Math.sin(2 * Math.PI * hz * t) * 0.6 + a * hash1(Math.floor(t * hz * 3)) * 0.4;
}

/** A registered punctual light. */
export interface PunctualHandle {
  readonly source: LightSource;
  readonly light: PointLight | SpotLight;
  /** The spot target (a sibling object 1 m below the light), null for point lights. */
  readonly target: Object3D | null;
}

export class LightRig {
  readonly sun: DirectionalLight;
  readonly sunShadow: SunShadowNode;
  readonly hemi: HemisphereLight;
  private readonly handles: PunctualHandle[] = [];
  private punctualMul = 1;
  private punctualOn = true;
  private disposed = false;

  constructor(private readonly scene: Scene) {
    const sun = new DirectionalLight(0xffffff, 1.0);   // colour/intensity driven per frame by §10.3.5
    sun.name = 'ewa:sun';
    sun.castShadow = true;
    sun.shadow.mapSize.set(SUN_SHADOW.mapSize, SUN_SHADOW.mapSize);   // copied into the static map (`setShadowMaps` re-sizes both)
    sun.shadow.bias = SUN_SHADOW.bias;
    sun.shadow.normalBias = SUN_SHADOW.normalBias;
    sun.shadow.radius = SUN_SHADOW.radius;
    const node = new SunShadowNode(sun);
    sun.shadow.shadowNode = node as unknown as typeof sun.shadow.shadowNode;
    this.sun = sun;
    this.sunShadow = node;
    scene.add(sun, sun.target);

    this.hemi = new HemisphereLight(0x9fb8d8, 0x4a5236, HEMI_INTENSITY * SPEC_LIGHT_UNIT);
    this.hemi.name = 'ewa:hemi';
    scene.add(this.hemi);
  }

  /** §10.3.1: the sun follows the camera focus so the shadow maps follow the player. */
  setFocus(focus: Vector3): void {
    this.sun.target.position.copy(focus);
  }

  /** Direction (unit, toward the body), linear colour and SPEC-unit intensity (§10.3.5 column) of the one directional light. */
  applyDirectional(dir: readonly number[], linear: readonly number[], intensity: number): void {
    const t = this.sun.target.position;
    this.sun.position.set(t.x + dir[0]! * 120, t.y + dir[1]! * 120, t.z + dir[2]! * 120);
    this.sun.color.setRGB(linear[0]!, linear[1]!, linear[2]!);
    this.sun.intensity = intensity * SPEC_LIGHT_UNIT;   // never toggle `visible`: the lights set is part of every program's cache key
  }

  /** Hemisphere colours (linear, normalised to a unit sky) and SPEC-unit intensity (§10.3.5 `hemi` column). */
  setHemisphere(skyLinear: readonly number[], groundLinear: readonly number[], intensity: number = HEMI_INTENSITY): void {
    this.hemi.color.setRGB(skyLinear[0]!, skyLinear[1]!, skyLinear[2]!);
    this.hemi.groundColor.setRGB(groundLinear[0]!, groundLinear[1]!, groundLinear[2]!);
    this.hemi.intensity = intensity * SPEC_LIGHT_UNIT;
  }

  /** Quality presets (`quality.ts`): the static and actor shadow map edges. The static map re-renders. */
  setShadowMaps(staticSize: number, actorSize: number): void {
    this.sunShadow.setMapSizes(staticSize, actorSize);
  }

  /** The static shadow map re-renders on the next frame (static casters added or removed). */
  refreshShadows(): void {
    this.sunShadow.refresh();
  }

  /** Per frame, after the day cycle moved the sun and before the render: places the shadow maps (`SunShadowNode.track`). */
  scheduleShadows(): void {
    this.sunShadow.track();
  }

  // ---- punctual lights ------------------------------------------------------------------------------

  counts(): LightCounts {
    let shadow = 0; let nonShadow = 0;
    for (const h of this.handles) { if (h.source.castShadow) shadow++; else nonShadow++; }
    return { shadow, nonShadow };
  }

  /**
   * Creates one light per source, parented (with a spot's target) under `parent`, and registers it. Every light is
   * looped by the layout (`castShadow` false whatever the source says: no punctual light renders a shadow map, see the
   * header). Throws `RangeError('light budget')` in dev when the registered total would exceed 8 / 24 (prod: logs).
   */
  createPunctuals(sources: readonly LightSource[], parent: Object3D): PunctualHandle[] {
    try {
      assertLightBudget(sources, this.counts());
    } catch (e) {
      if (isDevBuild()) throw e;
      console.error('@ewa/render: light budget exceeded (§10.3.2)');
    }
    const out: PunctualHandle[] = [];
    for (const s of sources) {
      const [x, y, z] = s.position;
      let light: PointLight | SpotLight;
      let target: Object3D | null = null;
      if (lightTypeFor(s.kind) === 'SpotLight') {
        const spot = new SpotLight(s.color, s.intensity, s.range, SPOT_PARAMS.angle, SPOT_PARAMS.penumbra, LIGHT_DECAY);
        target = new Object3D();
        target.name = `ewa:light-target:${s.id}`;
        target.position.set(x, y - 1, z);   // pointing −Y
        spot.target = target;
        light = spot;
      } else {
        light = new PointLight(s.color, s.intensity, s.range, LIGHT_DECAY);
      }
      light.name = `ewa:light:${s.id}`;
      light.userData = { ewaLightId: s.id, ewaLightKind: s.kind };
      light.castShadow = false;   // looped by the layout (createLightingLayout): adding or removing it changes no program
      light.position.set(x, y, z);
      parent.add(light);
      if (target !== null) parent.add(target);
      const h: PunctualHandle = { source: s, light, target };
      this.handles.push(h);
      out.push(h);
    }
    this.writeIntensities(0);
    return out;
  }

  /** Unregisters the handles: the lights are detached and disposed. */
  releasePunctuals(handles: readonly PunctualHandle[]): void {
    for (const h of handles) {
      const i = this.handles.indexOf(h);
      if (i < 0) continue;
      this.handles.splice(i, 1);
      h.light.removeFromParent();
      h.target?.removeFromParent();
      h.light.dispose();
    }
  }

  handlesList(): readonly PunctualHandle[] { return this.handles; }

  /** §10.3.5 punctual multiplier (lamps off at noon, full at night). */
  setPunctualMultiplier(m: number): void { this.punctualMul = m; }

  /** §10.2.6: harvest level 2 → every punctual light at intensity 0 (objects stay, the audit still counts housings). */
  setPunctualEnabled(on: boolean): void { this.punctualOn = on; }

  get punctualEnabled(): boolean { return this.punctualOn; }

  /** Writes every punctual intensity once for this frame (flicker from the render-side clock `t`, seconds). */
  update(t: number): void { this.writeIntensities(t); }

  private writeIntensities(t: number): void {
    const base = this.punctualOn ? this.punctualMul : 0;
    for (const h of this.handles) {
      const f = h.source.flicker ? flickerFactor(h.source.flicker.amplitude, h.source.flicker.hz, t) : 1;
      h.light.intensity = h.source.intensity * base * f;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releasePunctuals([...this.handles]);
    this.scene.remove(this.sun, this.sun.target, this.hemi);
    this.sunShadow.dispose();
    this.sun.dispose();
    this.hemi.dispose();
  }
}
