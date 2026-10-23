/**
 * SPEC §10.3.1 (sun + 4 cascades) and §10.3.2 (light budget and descriptor).
 *
 * - One `DirectionalLight` (sun by day, moon by night — same object, §10.3.4) with a `CSMShadowNode`
 *   of 4 cascades split at 14 / 34 / 72 / 160 m, attached through `light.shadow.shadowNode`.
 * - A `HemisphereLight` fill at 0.18 (§10.3.3).
 * - Punctual lights are created from `LightSource` descriptors (`createPunctuals`), parented by the
 *   caller (the zone root, so the zone's disposal owns them) and registered here so the day cycle
 *   multiplier, harvest switch and flicker reach them. Budget: 8 shadow-casting + 24 non-shadowing.
 * - The fixed light layout (handover, SPEC §10.3.2 as amended 2026-10-06): the renderer's `lighting` is the
 *   layout (`createLightingLayout`, `layout.ts`), which loops over every non-shadow Spot / Point light in one uniform
 *   array, so a zone's own non-shadow lights never change a program or a cache key. Shadow-casting lights keep one
 *   light node each, keyed by light id, so they are a fixed pool owned here and in the scene from boot: 2
 *   shadow-casting spot slots that a zone borrows. Every zone therefore renders with the boot's light set.
 *
 * `CSMShadowNode.updateFrustums()` dereferences its `camera`, which the node only receives on its
 * first build (`setup` → `_init(builder)`); calling it before the first render throws, so
 * `updateFrustums()` here is a guarded no-op until then (implementation note).
 */
import { DirectionalLight, Group, HemisphereLight, Object3D, PointLight, SpotLight, Vector3 as V3 } from 'three/webgpu';
import type { Scene, Vector3 } from 'three/webgpu';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { LightLayout } from './layout.js';
import { LIGHT_BUDGET, type LightKind, type LightSource } from '../descriptors.js';
import { isDevBuild } from '../env.js';

// ---- §10.3.1 constants ---------------------------------------------------------------------------------

export const SUN_SHADOW = Object.freeze({ mapSize: 2048, bias: -0.0004, normalBias: 0.02, radius: 2 });
/** Camera-space cascade far edges in metres (0–14, 14–34, 34–72, 72–160). */
export const CASCADE_SPLITS_M: readonly number[] = Object.freeze([14, 34, 72, 160]);
export const CSM_OPTIONS = Object.freeze({ cascades: 4, maxFar: 160, mode: 'custom' as const, lightMargin: 60 });
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

/** §10.3.1 `customSplitsCallback`: pushes the normalised breaks 14/far, 34/far, 72/far, 1. */
export function cascadeBreaks(far: number, breaks: number[]): number[] {
  breaks.length = 0;
  for (let i = 0; i < CASCADE_SPLITS_M.length - 1; i++) breaks.push(CASCADE_SPLITS_M[i]! / far);
  breaks.push(1);
  return breaks;
}

// ---- §10.3.2 local lights ------------------------------------------------------------------------------

export const SPOT_PARAMS = Object.freeze({ angle: 0.87, penumbra: 0.5, mapSize: 512, bias: -0.0006, normalBias: 0.03, radius: 2 });
export const LIGHT_DECAY = 2;

/**
 * The fixed light layout (handover; SPEC §10.3.2 as amended 2026-10-06).
 * - `shadowSpotSlots`: the shadow-map casters a zone may place. Every slot is a shadow map every lit fragment samples
 *   (PCF) whether lit or not, and WebGPU's default 16 sampled textures per fragment stage bound the scene's shadow
 *   maps: the billboard material already samples 5 textures + the environment, so 4 cascades + 2 beacons + 6 slots
 *   measured 17. 2 covers every zone (content max 1) with one spare.
 * - `maxLocalLights`: the uniform-array capacity of the looped non-shadow lights (24 per zone, with headroom; the
 *   loop runs over the lights present, not the capacity).
 * - `idleShadowMap`: the map size of a slot no zone uses (never rendered).
 */
export const LIGHT_LAYOUT = Object.freeze({ reservedShadowLights: 2, shadowSpotSlots: 2, maxLocalLights: 32, idleShadowMap: 1 });

/** The renderer's `lighting` (set at §10.1.2 step 4): non-shadow lights looped from one uniform array (`layout.ts`). */
export function createLightingLayout(): LightLayout {
  return new LightLayout(LIGHT_LAYOUT.maxLocalLights);
}

const SPOT_KINDS: ReadonlySet<LightKind> = new Set<LightKind>(['lamp', 'lantern', 'beacon', 'window']);

/** `lamp`/`lantern`/`beacon`/`window` → SpotLight pointing −Y; the rest → PointLight. */
export function lightTypeFor(kind: LightKind): 'SpotLight' | 'PointLight' {
  return SPOT_KINDS.has(kind) ? 'SpotLight' : 'PointLight';
}

/**
 * Whether the light renders a shadow map: spot kinds only (a layout slot). Amended 2026-10-06: a `castShadow`
 * point light (lava / fire, like brazier / crystal / candle before) counts against the shadow budget but renders
 * none. A cube-map slot in the fixed layout would cost every lit fragment 6 faces of shadow lookups for a kind no
 * zone casts with (content survey, render IMPLEMENTATION-NOTES "Handover: fixed light layout").
 */
export function castsShadowMap(s: Pick<LightSource, 'kind' | 'castShadow'>): boolean {
  return s.castShadow && lightTypeFor(s.kind) === 'SpotLight';
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
  /** The layout's shadow slot this source borrows (its `light` is the slot's), or null for a light of its own. */
  readonly slot: number | null;
}

/** Applies the §10.3.1 local spot-shadow parameters. */
function spotShadow(spot: SpotLight, mapSize: number): void {
  spot.shadow.mapSize.set(mapSize, mapSize);
  spot.shadow.bias = SPOT_PARAMS.bias;
  spot.shadow.normalBias = SPOT_PARAMS.normalBias;
  spot.shadow.radius = SPOT_PARAMS.radius;
}

const _p = new V3();

export class LightRig {
  readonly sun: DirectionalLight;
  readonly csm: CSMShadowNode;
  readonly hemi: HemisphereLight;
  private readonly handles: PunctualHandle[] = [];
  /** The fixed layout's shadow slots and their targets, in the scene from construction to dispose. */
  readonly layout: Group;
  private readonly slots: SpotLight[] = [];
  private readonly slotUsed: boolean[] = [];
  private punctualMul = 1;
  private punctualOn = true;
  private disposed = false;

  constructor(private readonly scene: Scene) {
    const sun = new DirectionalLight(0xffffff, 1.0);   // colour/intensity driven per frame by §10.3.5
    sun.name = 'ewa:sun';
    sun.castShadow = true;
    sun.shadow.mapSize.set(SUN_SHADOW.mapSize, SUN_SHADOW.mapSize);   // cloned per cascade by CSMShadowNode -> 4 × 2048²
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

    // the fixed layout: never removed, never hidden (an invisible parent drops a light from the light set, C13)
    this.layout = new Group();
    this.layout.name = 'ewa:light-layout';
    for (let i = 0; i < LIGHT_LAYOUT.shadowSpotSlots; i++) {
      const spot = new SpotLight(0xffffff, 0, 1, SPOT_PARAMS.angle, SPOT_PARAMS.penumbra, LIGHT_DECAY);
      spot.castShadow = true;
      spotShadow(spot, LIGHT_LAYOUT.idleShadowMap);
      spot.shadow.autoUpdate = false;
      spot.shadow.needsUpdate = false;
      spot.name = `ewa:light-slot:${i}`;
      spot.userData = { ewaSlot: i, ewaIdle: true };
      spot.target.name = `ewa:light-slot-target:${i}`;
      spot.target.position.set(0, -1, 0);
      this.layout.add(spot, spot.target);
      this.slots.push(spot);
      this.slotUsed.push(false);
    }
    scene.add(this.layout);
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
   * Quality presets (`quality.ts`): the per-cascade sun shadow map edge. The cascades clone the sun's shadow on their
   * first render and `ShadowNode.renderShadow` re-sizes its map from `mapSize` every update, so this applies live.
   */
  setSunShadowMap(size: number): void {
    this.sun.shadow.mapSize.set(size, size);
    for (const l of (this.csm as unknown as { lights: readonly DirectionalLight[] }).lights) l.shadow.mapSize.set(size, size);
  }

  /** CSM re-split after a camera projection/basis change (resize, zoom stop, heading). No-op before the first render. */
  updateFrustums(): void {
    if ((this.csm as unknown as { camera: unknown }).camera == null) return;
    this.csm.updateFrustums();
  }

  // ---- punctual lights ------------------------------------------------------------------------------

  counts(): LightCounts {
    let shadow = 0; let nonShadow = 0;
    for (const h of this.handles) { if (h.source.castShadow) shadow++; else nonShadow++; }
    return { shadow, nonShadow };
  }

  /**
   * Creates one light per non-shadow source, parented (with a spot's target) under `parent`; a shadow-casting spot
   * source borrows a free layout slot instead (the slot stays in the layout group, positioned in world space). All
   * are registered. Throws `RangeError('light budget')` in dev when the registered total would exceed 8 / 24 or the
   * slots run out (prod: logs; a source without a slot gets an unshadowed light of its own, the audit then fails).
   */
  createPunctuals(sources: readonly LightSource[], parent: Object3D): PunctualHandle[] {
    try {
      assertLightBudget(sources, this.counts());
      let want = 0;
      for (const s of sources) if (castsShadowMap(s)) want++;
      if (want > this.slotUsed.filter((u) => !u).length) throw new RangeError('light budget');
    } catch (e) {
      if (isDevBuild()) throw e;
      console.error('@ewa/render: light budget exceeded (§10.3.2)');
    }
    parent.updateWorldMatrix(true, false);
    const out: PunctualHandle[] = [];
    for (const s of sources) {
      const [x, y, z] = s.position;
      const slot = castsShadowMap(s) ? this.slotUsed.indexOf(false) : -1;
      let h: PunctualHandle;
      if (slot >= 0) {
        const spot = this.slots[slot]!;
        this.slotUsed[slot] = true;
        spot.color.set(s.color);
        spot.distance = s.range;
        spot.position.copy(_p.set(x, y, z).applyMatrix4(parent.matrixWorld));
        spot.target.position.copy(_p.set(x, y - 1, z).applyMatrix4(parent.matrixWorld));   // pointing −Y
        spotShadow(spot, SPOT_PARAMS.mapSize);
        spot.shadow.autoUpdate = true;
        spot.shadow.needsUpdate = true;
        spot.name = `ewa:light:${s.id}`;
        spot.userData = { ewaLightId: s.id, ewaLightKind: s.kind, ewaSlot: slot, ewaIdle: false };
        h = { source: s, light: spot, target: spot.target, slot };
      } else {
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
        h = { source: s, light, target, slot: null };
      }
      this.handles.push(h);
      out.push(h);
    }
    this.writeIntensities(0);
    return out;
  }

  /** Unregisters the handles: own lights are detached and disposed (`LightShadow.dispose`); a borrowed slot goes idle. */
  releasePunctuals(handles: readonly PunctualHandle[]): void {
    for (const h of handles) {
      const i = this.handles.indexOf(h);
      if (i < 0) continue;
      this.handles.splice(i, 1);
      if (h.slot !== null) { this.idleSlot(h.slot); continue; }
      h.light.removeFromParent();
      h.target?.removeFromParent();
      h.light.dispose();
    }
  }

  /** A slot no zone uses: dark, never rendered, its map shrunk back to the idle size (the boot's memory). */
  private idleSlot(k: number): void {
    const spot = this.slots[k]!;
    this.slotUsed[k] = false;
    spot.intensity = 0;
    spot.shadow.autoUpdate = false;
    spot.shadow.needsUpdate = false;
    spotShadow(spot, LIGHT_LAYOUT.idleShadowMap);
    (spot.shadow.map as { setSize?(w: number, h: number): void } | null)?.setSize?.(LIGHT_LAYOUT.idleShadowMap, LIGHT_LAYOUT.idleShadowMap);
    spot.name = `ewa:light-slot:${k}`;
    spot.userData = { ewaSlot: k, ewaIdle: true };
  }

  /** The layout slots a zone currently borrows (the zone dump lists them with the zone's own lights). */
  slotLightsInUse(): readonly SpotLight[] {
    return this.slots.filter((_, k) => this.slotUsed[k] === true);
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
    this.scene.remove(this.sun, this.sun.target, this.hemi, this.layout);
    for (const l of this.slots) l.dispose();
    this.csm.dispose();
    this.sun.dispose();
    this.hemi.dispose();
  }
}
