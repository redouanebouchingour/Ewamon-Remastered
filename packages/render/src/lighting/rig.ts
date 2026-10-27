/**
 * SPEC §10.3.1 (sun + 4 cascades) and §10.3.2 (light budget and descriptor).
 *
 * - One `DirectionalLight` (sun by day, moon by night — same object, §10.3.4) with a `CSMShadowNode`, attached through
 *   `light.shadow.shadowNode`. 2026-10-25 (performance, a deviation from §10.3.1's 4 cascades at 14 / 34 / 72 / 160 m,
 *   render IMPLEMENTATION-NOTES "Cheaper shadows and reflections"): 2 cascades split at 44 / 160 m. The diorama camera
 *   (pitch −52°, 20 / 26 / 34 m) sees view depths of ~17–42 m, so one cascade covers every zoom stop and the second
 *   only the far view; the old near cascade (0–14 m, rendered every frame) held almost nothing on screen.
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
 *
 * `CSMShadowNode.updateFrustums()` dereferences its `camera`, which the node only receives on its
 * first build (`setup` → `_init(builder)`); calling it before the first render throws, so
 * `updateFrustums()` here is a guarded no-op until then (implementation note).
 */
import { DirectionalLight, HemisphereLight, Object3D, PointLight, Quaternion, SpotLight, Vector3 as V3 } from 'three/webgpu';
import type { PerspectiveCamera, Scene, Vector3 } from 'three/webgpu';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { LightLayout } from './layout.js';
import { LIGHT_BUDGET, type LightKind, type LightSource } from '../descriptors.js';
import { isDevBuild } from '../env.js';

// ---- §10.3.1 constants ---------------------------------------------------------------------------------

/** `mapSize`: the near cascade's edge at `high` (`quality.ts` sets both cascades; the far one is half). */
export const SUN_SHADOW = Object.freeze({ mapSize: 1536, bias: -0.0004, normalBias: 0.02, radius: 2 });
/** Camera-space cascade far edges in metres (0–44: every diorama zoom stop, 44–160: the far view). */
export const CASCADE_SPLITS_M: readonly number[] = Object.freeze([44, 160]);
export const CSM_OPTIONS = Object.freeze({ cascades: 2, maxFar: 160, mode: 'custom' as const, lightMargin: 60 });
/** The far cascade's map edge relative to the near one's. */
export const FAR_CASCADE_SCALE = 0.5;
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

/**
 * Cascade staggering (performance addition 2026-10-25, render IMPLEMENTATION-NOTES "Shadow update staggering" and
 * "Cheaper shadows and reflections"): the sun cascades a frame re-renders, by frame index mod 4. The 0–44 m cascade
 * (everything the diorama camera sees) every 2nd frame, the 44–160 m one every 4th, the 4th frame none: 0.75 map renders
 * per frame, never more than 1. Each map render is a full scene traversal (measured ~3.5 ms of main-thread time per
 * cascade on an i7-10750H). A skipped cascade keeps its map and its matrix together (three re-derives `shadow.matrix`
 * only when it renders the map), so it lags a frame or three without swimming. The visible cascade keeps the cadence
 * the old 14–34 m cascade (where the player stood at every zoom stop) already had.
 */
export const CASCADE_SCHEDULE: readonly (readonly number[])[] = Object.freeze([[0], [1], [0], []]);
/**
 * The `low` preset's schedule (`QualityProfile.slowShadows`): the near cascade every 3rd frame, the far one every 6th,
 * 0.5 map renders per frame. Jumps, turns and resizes still render every cascade at once.
 */
export const CASCADE_SCHEDULE_SLOW: readonly (readonly number[])[] = Object.freeze([[0], [], [1], [0], [], []]);
/** Every cascade renders when the camera moved more than this in one frame (a warp, a cut). */
export const CASCADE_JUMP_M = 2;
/** … or turned, or the sun did: `1 − |q·q'|` / `1 − d·d'` above this (≈ 0.16° of rotation). */
export const CASCADE_TURN_EPS = 1e-6;

/** §10.3.1 `customSplitsCallback`: pushes the normalised breaks 14/far, 34/far, 72/far, 1. */
export function cascadeBreaks(far: number, breaks: number[]): number[] {
  breaks.length = 0;
  for (let i = 0; i < CASCADE_SPLITS_M.length - 1; i++) breaks.push(CASCADE_SPLITS_M[i]! / far);
  breaks.push(1);
  return breaks;
}

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

const _p = new V3();
const _q = new Quaternion();
const _d = new V3();

export class LightRig {
  readonly sun: DirectionalLight;
  readonly csm: CSMShadowNode;
  readonly hemi: HemisphereLight;
  private readonly handles: PunctualHandle[] = [];
  private punctualMul = 1;
  private punctualOn = true;
  private disposed = false;
  // cascade staggering: the frame index, and the camera / sun pose of the previous frame (NaN = refresh everything)
  private cascadeFrame = 0;
  private readonly lastCamPos = new V3(NaN, NaN, NaN);
  private readonly lastCamQuat = new Quaternion();
  private readonly lastSunDir = new V3();
  private readonly lastProjection = [NaN, NaN, NaN, NaN, NaN];   // fov, aspect, zoom, near, far
  // per-cascade map edges (`setSunShadowMap`), applied to the cascade lights once the CSM has created them
  private schedule: readonly (readonly number[])[] = CASCADE_SCHEDULE;
  private readonly mapSizes: number[] = [SUN_SHADOW.mapSize, Math.round(SUN_SHADOW.mapSize * FAR_CASCADE_SCALE)];
  private mapsPending = true;

  constructor(private readonly scene: Scene) {
    const sun = new DirectionalLight(0xffffff, 1.0);   // colour/intensity driven per frame by §10.3.5
    sun.name = 'ewa:sun';
    sun.castShadow = true;
    sun.shadow.mapSize.set(SUN_SHADOW.mapSize, SUN_SHADOW.mapSize);   // cloned per cascade by CSMShadowNode; the far one is re-sized (`applyMapSizes`)
    sun.shadow.bias = SUN_SHADOW.bias;                                // cascade i gets bias × (i + 1)
    sun.shadow.normalBias = SUN_SHADOW.normalBias;
    sun.shadow.radius = SUN_SHADOW.radius;
    const csm = new CSMShadowNode(sun, {
      ...CSM_OPTIONS,
      customSplitsCallback: (_cascades: number, _near: number, far: number, breaks: number[]) => { cascadeBreaks(far, breaks); },
    });
    csm.fade = true;
    sun.shadow.shadowNode = csm;
    this.sun = sun;
    this.csm = csm;
    scene.add(sun, sun.target);

    this.hemi = new HemisphereLight(0x9fb8d8, 0x4a5236, HEMI_INTENSITY * SPEC_LIGHT_UNIT);
    this.hemi.name = 'ewa:hemi';
    scene.add(this.hemi);
  }

  /** §10.3.1: the sun follows the camera focus so the cascades follow the player. */
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

  /**
   * Quality presets (`quality.ts`): the near cascade's sun shadow map edge; the far cascade gets `FAR_CASCADE_SCALE` of
   * it. The cascades clone the sun's shadow on their first render (so the sizes land on them in the next
   * `scheduleShadows`) and `ShadowNode.renderShadow` re-sizes its map from `mapSize` every update: this applies live.
   */
  setSunShadowMap(size: number): void {
    this.sun.shadow.mapSize.set(size, size);
    for (let i = 0; i < this.mapSizes.length; i++) this.mapSizes[i] = i === 0 ? size : Math.max(1, Math.round(size * FAR_CASCADE_SCALE));
    this.mapsPending = true;
    this.applyMapSizes();
  }

  /** Quality presets: the slow cascade schedule (`CASCADE_SCHEDULE_SLOW`) or the normal one. */
  setSlowShadows(slow: boolean): void {
    this.schedule = slow ? CASCADE_SCHEDULE_SLOW : CASCADE_SCHEDULE;
    this.refreshCascades();
  }

  /** The cascade lights' map edges (`setSunShadowMap`; the far ones also once the CSM created them). */
  cascadeMapSizes(): readonly number[] {
    return this.cascadeLights().map((l) => l.shadow.mapSize.x);
  }

  private applyMapSizes(): void {
    const lights = this.cascadeLights();
    if (!this.mapsPending || lights.length === 0) return;
    for (let i = 0; i < lights.length; i++) {
      const s = this.mapSizes[Math.min(i, this.mapSizes.length - 1)]!;
      lights[i]!.shadow.mapSize.set(s, s);
    }
    this.mapsPending = false;
    this.refreshCascades();   // a resized map is empty until it renders
  }

  /** CSM re-split after a camera projection/basis change (resize, zoom stop, heading). No-op before the first render. */
  updateFrustums(): void {
    if ((this.csm as unknown as { camera: unknown }).camera == null) return;
    this.csm.updateFrustums();
    this.refreshCascades();
  }

  /** The CSM's per-cascade lights (created on its first build; empty before). */
  private cascadeLights(): readonly DirectionalLight[] {
    return (this.csm as unknown as { lights: readonly DirectionalLight[] }).lights;
  }

  /** The next `scheduleShadows` renders every cascade. */
  refreshCascades(): void {
    this.lastCamPos.set(NaN, NaN, NaN);
  }

  /**
   * Per frame, before the render (`CASCADE_SCHEDULE`): sets which sun cascades re-render their map this frame. All of
   * them when the camera jumped, turned or changed its projection, when the sun turned, or after `refreshCascades`.
   * Zero allocation.
   */
  scheduleShadows(camera: PerspectiveCamera): void {
    const lights = this.cascadeLights();
    if (lights.length === 0) return;
    this.applyMapSizes();
    camera.getWorldPosition(_p);
    camera.getWorldQuaternion(_q);
    _d.subVectors(this.sun.position, this.sun.target.position).normalize();
    const pr = this.lastProjection;
    const all = !(_p.distanceTo(this.lastCamPos) <= CASCADE_JUMP_M)   // NaN (a refresh) fails the test too
      || 1 - Math.abs(_q.dot(this.lastCamQuat)) > CASCADE_TURN_EPS
      || 1 - _d.dot(this.lastSunDir) > CASCADE_TURN_EPS
      || camera.fov !== pr[0] || camera.aspect !== pr[1] || camera.zoom !== pr[2] || camera.near !== pr[3] || camera.far !== pr[4];
    this.lastCamPos.copy(_p);
    this.lastCamQuat.copy(_q);
    this.lastSunDir.copy(_d);
    pr[0] = camera.fov; pr[1] = camera.aspect; pr[2] = camera.zoom; pr[3] = camera.near; pr[4] = camera.far;
    const due = this.schedule[this.cascadeFrame % this.schedule.length]!;
    this.cascadeFrame++;
    for (let i = 0; i < lights.length; i++) lights[i]!.shadow.autoUpdate = all || due.includes(i);
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
    this.csm.dispose();
    this.sun.dispose();
    this.hemi.dispose();
  }
}
