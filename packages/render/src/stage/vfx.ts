/**
 * SPEC §10.7.5 — the VFX id table (47 ids) and the pooled effect system.
 *
 * One pooled particle cloud: `EMITTERS × MAX_PARTICLES` (8 × 512) particles in preallocated instanced attributes,
 * drawn as ONE instanced `Sprite` with ONE shared additive `PointsNodeMaterial` on layer 29. A spawn writes its
 * emitter's slice of the attributes once (birth, lifetime, origin, velocity, orbit offset, colour, size, shape);
 * the vertex stage integrates every particle from the VFX clock (seconds × timeScale — hitstop freezes effects),
 * so a frame costs one uniform write. "Alpha-card bursts" are the same particles with a card shape (star / ring /
 * streak) and ≤ 8 count. Pools are allocated at construction (§10.1.2 step 7) and never grow.
 *
 * - VFX never write `mask.y = 1` and write valid normal/mask values where they draw (`overlayMrt(true)`): effects
 *   blur with the scene and never sharpen; the HUD is a later overlay pass (Pillar 8).
 * - `impact_super` requests 120 ms of chromatic aberration (0.012, gated by `effects.chroma`); `impact_crit` asks
 *   the stage for a 3-frame white flash on the target (`hurt 1.0`).
 * - No punctual lights: a light added or removed mid-battle changes every lit program's cache key (C13); the arena
 *   beacons (the 2 reserved light slots) pulse instead (`battleStage.ts`).
 *
 * three 0.186 correction: a `Points` object rasterises 1-px points on WebGPU (no point size); sized particles are an
 * instanced `Sprite` (`sprite.count`) with a `PointsNodeMaterial` (`setupVertexSprite`), which is what this is.
 */
import {
  AdditiveBlending, Color, DynamicDrawUsage, InstancedBufferAttribute, PointsNodeMaterial, Sprite, Vector3,
} from 'three/webgpu';
import type { Node, PerspectiveCamera, UniformNode } from 'three/webgpu';
import {
  Fn, abs, cos, exp, float, instancedBufferAttribute, length, max, min, mix, select, sin, smoothstep, step, uniform, uv, vec3, vec4,
} from 'three/tsl';
import type { TypeName, VfxId } from '../contracts.js';
import { LAYERS } from '../descriptors.js';
import { OVERLAY_ALPHA_CUT, overlayMrt } from '../sprites/overlayMrt.js';
import { TYPE_COLORS, TYPE_NAMES, hexToLinearInto, typeVfxSuffix } from '../sprites/typeColors.js';

// ---- the id table (§10.7.5, exactly 19 + 4 + 6 + 5 + 4 + 4 + 5 = 47, + 1 shiny burst since Phase D4 = 48) ------------

export const VFX_TYPE_IDS: readonly VfxId[] = Object.freeze(TYPE_NAMES.map((t) => `type_${typeVfxSuffix(t)}` as VfxId));
export const VFX_IMPACT_IDS: readonly VfxId[] = Object.freeze(['impact_normal', 'impact_super', 'impact_resist', 'impact_crit'] as const);
export const VFX_STATUS_IDS: readonly VfxId[] = Object.freeze(['status_burn', 'status_poison', 'status_paralyze', 'status_sleep', 'status_freeze', 'status_confuse'] as const);
export const VFX_STAT_IDS: readonly VfxId[] = Object.freeze(['stat_up', 'stat_down', 'heal', 'drain', 'recoil'] as const);
export const VFX_WEATHER_IDS: readonly VfxId[] = Object.freeze(['weather_sun', 'weather_rain', 'weather_sand', 'weather_hail'] as const);
export const VFX_ORB_IDS: readonly VfxId[] = Object.freeze(['orb_throw', 'orb_shake', 'orb_catch', 'orb_break'] as const);
export const VFX_MISC_IDS: readonly VfxId[] = Object.freeze(['switch_out', 'switch_in', 'faint', 'trap', 'flinch'] as const);
/** Phase D4: the shiny encounter burst (the one id beyond the §10.7.5 47). */
export const VFX_SHINY_IDS: readonly VfxId[] = Object.freeze(['shiny_sparkle'] as const);
/** Battle forms (`SpeciesDef.battleForm`): one burst per form. */
export const VFX_FORM_IDS: readonly VfxId[] = Object.freeze(['form_rage'] as const);

export const VFX_IDS: readonly VfxId[] = Object.freeze([
  ...VFX_TYPE_IDS, ...VFX_IMPACT_IDS, ...VFX_STATUS_IDS, ...VFX_STAT_IDS, ...VFX_WEATHER_IDS, ...VFX_ORB_IDS, ...VFX_MISC_IDS, ...VFX_SHINY_IDS, ...VFX_FORM_IDS,
]);

export function isVfxId(s: string): s is VfxId {
  return (VFX_IDS as readonly string[]).includes(s);
}

// ---- recipes -------------------------------------------------------------------------------------------------------

/** Particle motion families (CPU-side emission; the shader integrates all of them the same way). */
export type VfxMotion =
  | 'stream'   // from → to, lifetime = travel (projectile)
  | 'arc'      // from → to under gravity (orb throw, lobbed moves)
  | 'drain'    // to → from (drain / absorb)
  | 'burst'    // sphere burst at the anchor
  | 'ring'     // horizontal ring at the anchor's feet
  | 'rise'     // column rising from the anchor's feet
  | 'fall'     // falling from above the anchor
  | 'orbit'    // circling the anchor (swirl)
  | 'field';   // arena-wide (weather)

export type VfxShape = 'disc' | 'star' | 'ring' | 'streak' | 'pixel';
export const SHAPE_INDEX: Readonly<Record<VfxShape, number>> = Object.freeze({ disc: 0, star: 1, ring: 2, streak: 3, pixel: 4 });

/** One emission phase. */
export interface VfxPhase {
  readonly motion: VfxMotion;
  readonly anchor: 'from' | 'to' | 'center';
  readonly count: number;             // ≤ 512 (cards ≤ 8)
  /** sRGB hex, or 'type' (the recipe's type colour from the stage's table). */
  readonly color: string;
  readonly color2?: string;           // second colour, mixed per particle
  readonly intensity: number;         // HDR multiplier (bloom reads > 1.15)
  readonly lifeMs: number;
  readonly spreadMs: number;          // emission window
  readonly size: number;              // world diameter (m)
  readonly sizeEnd: number;           // multiplier at end of life
  readonly speed: number;             // m/s
  readonly gravity: number;           // m/s² (positive = down)
  readonly drag: number;              // 1/s
  readonly swirl: number;             // rad/s about the anchor's vertical axis
  readonly radius: number;            // emission radius (m)
  readonly height: number;            // emission height above the feet (m, fraction of creature height when ≤ 1.5 … absolute metres)
  readonly shape: VfxShape;
  /** Delay (fraction of the requested ms) before this phase emits (impact after travel). */
  readonly delay: number;
}

/**
 * A recipe outside the 47-id table: the sequence effects of the evolution sequence (`stage/evolution.ts`), built per
 * sequence (the type colour of the new form) and spawned through `spawnRecipe` into the same pooled emitters.
 */
export interface SequenceVfxRecipe extends Omit<VfxRecipe, 'id'> { readonly id: string }

export interface VfxRecipe {
  readonly id: VfxId;
  readonly type: TypeName | null;
  readonly phases: readonly VfxPhase[];
  /** Chromatic aberration request (amount, ms) — `impact_super`. */
  readonly chroma: { readonly amount: number; readonly ms: number } | null;
  /** White flash on the target (hurt strength) — `impact_crit`. */
  readonly flash: number;
  /** Beacon pulse strength (the arena's reserved lights brighten briefly). */
  readonly beaconPulse: number;
  /** Default duration when `vfx(…, ms)` passes ms ≤ 0. */
  readonly defaultMs: number;
}

const P = (o: Partial<VfxPhase> & Pick<VfxPhase, 'motion' | 'anchor' | 'count' | 'color'>): VfxPhase => ({
  intensity: 2.2, lifeMs: 500, spreadMs: 200, size: 0.18, sizeEnd: 0.4, speed: 3, gravity: 0, drag: 1.5, swirl: 0, radius: 0.3,
  height: 0.9, shape: 'disc', delay: 0, color2: undefined, ...o,
});

interface TypeFlavour { readonly travel: Partial<VfxPhase>; readonly impact: Partial<VfxPhase> }

/** Per-type flavour of the 19 `type_*` effects (colour from the type table). */
const TYPE_FLAVOUR: Readonly<Record<TypeName, TypeFlavour>> = {
  Normal: { travel: { shape: 'star', size: 0.16 }, impact: { shape: 'star', speed: 3.5 } },
  Fire: { travel: { color2: '#ffd26a', gravity: -2.5, size: 0.22 }, impact: { color2: '#ffd26a', gravity: -4, lifeMs: 650, motion: 'rise' } },
  Water: { travel: { color2: '#dff4ff', gravity: 3, size: 0.16 }, impact: { color2: '#dff4ff', gravity: 7, speed: 4 } },
  Grass: { travel: { swirl: 5, shape: 'pixel', color2: '#c6e67a' }, impact: { swirl: 4, shape: 'pixel', motion: 'orbit', color2: '#c6e67a' } },
  Electric: { travel: { speed: 9, shape: 'streak', lifeMs: 180, color2: '#ffffff' }, impact: { speed: 7, shape: 'streak', lifeMs: 220, color2: '#ffffff' } },
  Ice: { travel: { shape: 'star', color2: '#ffffff', size: 0.14 }, impact: { shape: 'star', motion: 'ring', color2: '#ffffff', speed: 2.5 } },
  Fighting: { travel: { count: 40, size: 0.2 }, impact: { motion: 'ring', shape: 'ring', count: 6, size: 1.2, sizeEnd: 2.2, speed: 0.3, lifeMs: 320 } },
  Poison: { travel: { gravity: -0.8, size: 0.24, shape: 'ring' }, impact: { motion: 'rise', shape: 'ring', gravity: -1.2, lifeMs: 900, speed: 0.8 } },
  Ground: { travel: { gravity: 6, shape: 'pixel', color2: '#6b5638' }, impact: { gravity: 9, shape: 'pixel', speed: 5, color2: '#6b5638' } },
  Flying: { travel: { swirl: 7, color2: '#ffffff' }, impact: { motion: 'orbit', swirl: 8, color2: '#ffffff', lifeMs: 600 } },
  Psychic: { travel: { swirl: 6, shape: 'ring' }, impact: { motion: 'ring', shape: 'ring', count: 8, size: 0.9, sizeEnd: 2.4, speed: 0.2, lifeMs: 520 } },
  Bug: { travel: { swirl: 9, shape: 'pixel', size: 0.1 }, impact: { motion: 'orbit', swirl: 10, shape: 'pixel', size: 0.1 } },
  Rock: { travel: { gravity: 5, shape: 'pixel', size: 0.26, color2: '#5d5040' }, impact: { gravity: 10, shape: 'pixel', size: 0.24, speed: 5 } },
  Ghost: { travel: { swirl: 3, gravity: -0.5, size: 0.3, intensity: 1.6 }, impact: { motion: 'rise', swirl: 2, gravity: -1, lifeMs: 900, size: 0.34, intensity: 1.6 } },
  Dragon: { travel: { swirl: 8, size: 0.24, color2: '#b4a6ff' }, impact: { motion: 'orbit', swirl: 6, color2: '#b4a6ff' } },
  Steel: { travel: { shape: 'streak', speed: 8, color2: '#ffffff' }, impact: { shape: 'streak', speed: 6, gravity: 6, color2: '#ffffff' } },
  Fairy: { travel: { shape: 'star', color2: '#ffffff', swirl: 3 }, impact: { shape: 'star', motion: 'rise', gravity: -1, color2: '#ffffff', lifeMs: 800 } },
  Dark: { travel: { size: 0.34, intensity: 1.3, color2: '#1a1320' }, impact: { size: 0.5, sizeEnd: 1.6, intensity: 1.3, speed: 1.6, color2: '#1a1320' } },
  Cosmic: { travel: { shape: 'star', color2: '#ffffff', swirl: 4 }, impact: { shape: 'star', motion: 'burst', color2: '#e0d0ff', speed: 4 } },
};

function typeRecipe(t: TypeName): VfxRecipe {
  const fl = TYPE_FLAVOUR[t];
  return {
    id: `type_${typeVfxSuffix(t)}` as VfxId, type: t, chroma: null, flash: 0, beaconPulse: 0.35, defaultMs: 700,
    phases: [
      P({ motion: 'stream', anchor: 'from', count: 110, color: 'type', lifeMs: 380, spreadMs: 320, size: 0.16, speed: 0.9, drag: 0.001, radius: 0.28, ...fl.travel }),
      P({ motion: 'burst', anchor: 'to', count: 140, color: 'type', lifeMs: 520, spreadMs: 60, delay: 0.55, speed: 3.2, drag: 2.2, ...fl.impact }),
    ],
  };
}

const R = (id: VfxId, phases: readonly VfxPhase[], extra: Partial<Pick<VfxRecipe, 'chroma' | 'flash' | 'beaconPulse' | 'defaultMs'>> = {}): VfxRecipe => ({
  id, type: null, phases, chroma: null, flash: 0, beaconPulse: 0, defaultMs: 600, ...extra,
});

/** Every VFX id → its recipe (the table the client's MOVE_ANIMS / DEFAULT_BY_TYPE reference). */
export const VFX_TABLE: Readonly<Record<VfxId, VfxRecipe>> = Object.freeze({
  ...Object.fromEntries(TYPE_NAMES.map((t) => [`type_${typeVfxSuffix(t)}`, typeRecipe(t)])),
  impact_normal: R('impact_normal', [P({ motion: 'burst', anchor: 'to', count: 60, color: '#fff4d8', speed: 3, lifeMs: 300, size: 0.14 }), P({ motion: 'burst', anchor: 'to', count: 2, color: '#ffffff', shape: 'star', size: 0.7, sizeEnd: 0.2, speed: 0, lifeMs: 160, intensity: 1.6 })], { beaconPulse: 0.3 }),
  impact_super: R('impact_super', [P({ motion: 'burst', anchor: 'to', count: 130, color: '#fff0b0', color2: '#ffb347', speed: 5, lifeMs: 420, intensity: 2.2, size: 0.14 }), P({ motion: 'ring', anchor: 'to', count: 2, color: '#fff6d0', shape: 'ring', size: 0.8, sizeEnd: 2.6, speed: 0, lifeMs: 280, intensity: 1.3 })], { chroma: { amount: 0.012, ms: 120 }, beaconPulse: 0.8 }),
  impact_resist: R('impact_resist', [P({ motion: 'burst', anchor: 'to', count: 30, color: '#9aa6b0', speed: 1.6, lifeMs: 260, intensity: 1.4 })], { beaconPulse: 0.1 }),
  impact_crit: R('impact_crit', [P({ motion: 'burst', anchor: 'to', count: 160, color: '#ffffff', color2: '#ffe27a', speed: 5.5, lifeMs: 380, intensity: 2.4, size: 0.14 }), P({ motion: 'burst', anchor: 'to', count: 2, color: '#ffffff', shape: 'star', size: 1.1, sizeEnd: 0.1, speed: 0, lifeMs: 180, intensity: 1.8 })], { flash: 1, beaconPulse: 1 }),
  status_burn: R('status_burn', [P({ motion: 'rise', anchor: 'to', count: 90, color: '#ff6a2a', color2: '#ffd26a', gravity: -3, speed: 0.6, lifeMs: 700, spreadMs: 400, radius: 0.5, height: 0.1 })]),
  status_poison: R('status_poison', [P({ motion: 'rise', anchor: 'to', count: 50, color: '#9a5bb0', color2: '#d49aff', shape: 'ring', gravity: -1, speed: 0.5, lifeMs: 900, spreadMs: 500, radius: 0.45, height: 0.2, size: 0.22 })]),
  status_paralyze: R('status_paralyze', [P({ motion: 'burst', anchor: 'to', count: 60, color: '#f4cf3f', color2: '#ffffff', shape: 'streak', speed: 5, lifeMs: 160, spreadMs: 450, radius: 0.5 })]),
  status_sleep: R('status_sleep', [P({ motion: 'rise', anchor: 'to', count: 8, color: '#b8c8ff', shape: 'ring', size: 0.3, sizeEnd: 1.2, gravity: -0.6, speed: 0.4, swirl: 1.5, lifeMs: 1100, spreadMs: 600, height: 1.2, intensity: 1.6 })], { defaultMs: 900 }),
  status_freeze: R('status_freeze', [P({ motion: 'ring', anchor: 'to', count: 90, color: '#8fd6e8', color2: '#ffffff', shape: 'star', speed: 1.2, lifeMs: 700, spreadMs: 150, height: 0.2 })]),
  status_confuse: R('status_confuse', [P({ motion: 'orbit', anchor: 'to', count: 6, color: '#f4cf3f', shape: 'star', size: 0.34, sizeEnd: 1, speed: 0, swirl: 5, radius: 0.55, lifeMs: 900, spreadMs: 30, height: 1.25, drag: 0.001 })], { defaultMs: 900 }),
  stat_up: R('stat_up', [P({ motion: 'rise', anchor: 'to', count: 70, color: '#6fd0ff', color2: '#ffffff', shape: 'streak', gravity: -5, speed: 1.5, lifeMs: 600, spreadMs: 350, radius: 0.55, height: 0.05 })]),
  stat_down: R('stat_down', [P({ motion: 'fall', anchor: 'to', count: 70, color: '#ff6a6a', color2: '#ffc0c0', shape: 'streak', gravity: 4, speed: 1, lifeMs: 600, spreadMs: 350, radius: 0.55, height: 1.6 })]),
  heal: R('heal', [P({ motion: 'rise', anchor: 'to', count: 80, color: '#7df09a', color2: '#ffffff', shape: 'star', gravity: -1.5, speed: 0.7, swirl: 2, lifeMs: 900, spreadMs: 500, radius: 0.55, height: 0.1 })]),
  drain: R('drain', [P({ motion: 'drain', anchor: 'to', count: 120, color: '#7df09a', color2: '#c0ffd0', speed: 0, drag: 0.001, lifeMs: 520, spreadMs: 420, radius: 0.2, swirl: 3 })], { defaultMs: 900 }),
  recoil: R('recoil', [P({ motion: 'burst', anchor: 'from', count: 40, color: '#ffb0a0', speed: 2.2, lifeMs: 280, intensity: 1.6 })]),
  weather_sun: R('weather_sun', [P({ motion: 'field', anchor: 'center', count: 140, color: '#ffe7a0', gravity: 0.2, speed: 0.3, lifeMs: 1800, spreadMs: 900, radius: 6, height: 5, size: 0.14, intensity: 1.5 })], { defaultMs: 1400 }),
  weather_rain: R('weather_rain', [P({ motion: 'field', anchor: 'center', count: 380, color: '#a8c8e8', shape: 'streak', gravity: 0, speed: 11, drag: 0.001, lifeMs: 600, spreadMs: 900, radius: 6, height: 7, size: 0.22, intensity: 1.2 })], { defaultMs: 1400 }),
  weather_sand: R('weather_sand', [P({ motion: 'field', anchor: 'center', count: 300, color: '#d9b877', color2: '#a88a50', shape: 'pixel', gravity: 0.4, speed: 5, drag: 0.001, lifeMs: 1200, spreadMs: 900, radius: 6, height: 2.5, size: 0.08, intensity: 1.1 })], { defaultMs: 1400 }),
  weather_hail: R('weather_hail', [P({ motion: 'field', anchor: 'center', count: 200, color: '#e8f4ff', shape: 'pixel', gravity: 6, speed: 7, drag: 0.001, lifeMs: 700, spreadMs: 900, radius: 6, height: 7, size: 0.1, intensity: 1.6 })], { defaultMs: 1400 }),
  orb_throw: R('orb_throw', [P({ motion: 'arc', anchor: 'from', count: 60, color: '#ffffff', color2: '#ff5a5a', gravity: 9, speed: 0, drag: 0.001, lifeMs: 600, spreadMs: 40, radius: 0.04, size: 0.22, sizeEnd: 1 })], { defaultMs: 600 }),
  orb_shake: R('orb_shake', [P({ motion: 'burst', anchor: 'to', count: 24, color: '#ffffff', shape: 'star', speed: 1.4, lifeMs: 260, height: 0.25, size: 0.14 })], { defaultMs: 400 }),
  orb_catch: R('orb_catch', [P({ motion: 'burst', anchor: 'to', count: 120, color: '#ffe27a', color2: '#ffffff', shape: 'star', speed: 2.6, lifeMs: 800, height: 0.3, gravity: -0.5 }), P({ motion: 'ring', anchor: 'to', count: 4, color: '#fff2b0', shape: 'ring', size: 1, sizeEnd: 3, speed: 0.1, lifeMs: 500, height: 0.3 })], { beaconPulse: 0.6, defaultMs: 900 }),
  orb_break: R('orb_break', [P({ motion: 'burst', anchor: 'to', count: 160, color: '#ffffff', color2: '#ff7070', speed: 4.5, lifeMs: 420, height: 0.3 })], { beaconPulse: 0.4 }),
  switch_out: R('switch_out', [P({ motion: 'rise', anchor: 'from', count: 110, color: '#ff8080', color2: '#ffffff', shape: 'pixel', gravity: -2.5, speed: 1, lifeMs: 450, spreadMs: 300, radius: 0.5, height: 0.2, size: 0.1 })], { defaultMs: 350 }),
  switch_in: R('switch_in', [P({ motion: 'burst', anchor: 'to', count: 120, color: '#ffffff', color2: '#ffe0e0', shape: 'pixel', speed: 2.8, lifeMs: 450, size: 0.1 }), P({ motion: 'ring', anchor: 'to', count: 3, color: '#ffffff', shape: 'ring', size: 1.1, sizeEnd: 2.6, speed: 0, lifeMs: 380, height: 0.1 })], { defaultMs: 450 }),
  faint: R('faint', [P({ motion: 'ring', anchor: 'to', count: 90, color: '#b8b0a0', shape: 'pixel', speed: 1.4, gravity: 0.5, lifeMs: 900, spreadMs: 400, height: 0.05, intensity: 0.9, size: 0.14 })], { defaultMs: 900 }),
  trap: R('trap', [P({ motion: 'orbit', anchor: 'to', count: 48, color: '#c9a24a', color2: '#ffe0a0', shape: 'pixel', speed: 0, swirl: 4, radius: 0.9, lifeMs: 1100, spreadMs: 200, height: 0.5, drag: 0.001 })], { defaultMs: 1000 }),
  // Phase D4: a shiny's encounter burst — gold stars ringing and rising round the creature, one card flash
  shiny_sparkle: R('shiny_sparkle', [P({ motion: 'orbit', anchor: 'to', count: 28, color: '#fff3b8', color2: '#ffffff', shape: 'star', speed: 0, swirl: 3.2, radius: 0.85, lifeMs: 1000, spreadMs: 260, height: 0.9, size: 0.24, sizeEnd: 0.06, intensity: 2.2, drag: 0.001 }), P({ motion: 'burst', anchor: 'to', count: 2, color: '#ffffff', shape: 'star', size: 1.2, sizeEnd: 0.1, speed: 0, lifeMs: 260, height: 0.9, intensity: 2 })], { beaconPulse: 0.5, defaultMs: 1100 }),
  // hollowmane's rage form: crimson shards blown outward, embers torn upward, a shockwave ring, one white flash
  form_rage: R('form_rage', [
    P({ motion: 'burst', anchor: 'to', count: 180, color: '#c0102c', color2: '#ff3a52', shape: 'pixel', speed: 5.2, lifeMs: 560, height: 0.9, size: 0.12, intensity: 2.4 }),
    P({ motion: 'rise', anchor: 'to', count: 120, color: '#ff2a44', color2: '#3a0812', shape: 'streak', gravity: -4.5, speed: 1.2, lifeMs: 950, spreadMs: 520, radius: 0.75, height: 0.05, intensity: 2 }),
    P({ motion: 'ring', anchor: 'to', count: 2, color: '#ff4a62', shape: 'ring', size: 1, sizeEnd: 3.6, speed: 0, lifeMs: 440, height: 0.15, intensity: 1.6 }),
  ], { flash: 1, beaconPulse: 1, chroma: { amount: 0.016, ms: 160 }, defaultMs: 1100 }),
  flinch: R('flinch', [P({ motion: 'burst', anchor: 'to', count: 5, color: '#ffffff', shape: 'star', speed: 1.1, lifeMs: 360, height: 1.3, size: 0.3, sizeEnd: 0.6 })], { defaultMs: 400 }),
}) as Readonly<Record<VfxId, VfxRecipe>>;

// ---- the pooled system --------------------------------------------------------------------------------------------

/** 8 concurrent emitters × ≤ 512 particles each. */
export const EMITTERS = 8;
export const MAX_PARTICLES = 512;
export const CAPACITY = EMITTERS * MAX_PARTICLES;

/** Deterministic PRNG (mulberry32): VFX jitter without Math.random (§10 NN 10). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A world anchor for a spawn: feet position + creature height (null = absent). */
export interface VfxAnchor { readonly feet: Vector3; readonly height: number }

export interface VfxHooks {
  /** `impact_super`: chroma request (the host gates it by `effects.chroma`). */
  chroma?(amount: number, ms: number): void;
}

interface Emitter { readonly start: number; busyUntil: number }

const _o = new Vector3();
const _v = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _c1 = new Color();
const _c2 = new Color();

export class VfxSystem {
  readonly object: Sprite;
  readonly material: PointsNodeMaterial;
  readonly clock: UniformNode<'float', number>;
  readonly sizeScale: UniformNode<'float', number>;
  private readonly aOrigin: InstancedBufferAttribute;   // xyz origin, w birth (s)
  private readonly aVel: InstancedBufferAttribute;      // xyz velocity, w life (s)
  private readonly aColor: InstancedBufferAttribute;    // rgb (linear × intensity), w size (m)
  private readonly aOrbit: InstancedBufferAttribute;    // x/z orbit offset, swirl, gravity
  private readonly aMisc: InstancedBufferAttribute;     // drag, shape, sizeEnd, spare
  private readonly emitters: Emitter[] = [];
  private readonly attrs: readonly InstancedBufferAttribute[];
  private readonly rand = mulberry32(0x5eed);
  private typeTable: Readonly<Record<TypeName, string>> = TYPE_COLORS;
  private readonly ready = new Set<VfxId>();
  private nowS = 0;
  private aliveUntil = 0;
  private spawnCount = 0;
  private disposed = false;

  constructor(private readonly hooks: VfxHooks = {}) {
    const mk = (): InstancedBufferAttribute => {
      const a = new InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
      a.setUsage(DynamicDrawUsage);
      return a;
    };
    this.aOrigin = mk(); this.aVel = mk(); this.aColor = mk(); this.aOrbit = mk(); this.aMisc = mk();
    this.attrs = [this.aOrigin, this.aVel, this.aColor, this.aOrbit, this.aMisc];
    // everything starts dead: birth far in the past, life 0
    for (let i = 0; i < CAPACITY; i++) { this.aOrigin.array[i * 4 + 3] = -1e6; }
    for (let e = 0; e < EMITTERS; e++) this.emitters.push({ start: e * MAX_PARTICLES, busyUntil: -1 });
    this.clock = uniform(0).setName('ewaVfxClock');
    this.sizeScale = uniform(4).setName('ewaVfxSizeScale');
    this.material = this.buildMaterial();
    const s = new Sprite(this.material);
    s.count = CAPACITY;
    s.frustumCulled = false;
    s.layers.set(LAYERS.fx);
    s.renderOrder = 10;
    s.name = 'ewa:vfx';
    s.visible = false;
    s.castShadow = false;
    s.receiveShadow = false;
    this.object = s;
  }

  // ---- public --------------------------------------------------------------------------------------------------

  setTypeColors(table: Readonly<Record<TypeName, string>>): void { this.typeTable = table; }

  /** Marks recipes as resident (the one shared material is compiled in the renderer's warm-up frame). */
  prewarm(ids: readonly VfxId[]): void {
    for (const id of ids) { if (!isVfxId(id)) throw new RangeError(`@ewa/render: unknown VfxId '${String(id)}'`); this.ready.add(id); }
  }

  isPrewarmed(id: VfxId): boolean { return this.ready.has(id); }

  /**
   * Spawns `id` between the anchors (`from` = the acting battler, `to` = the target; `center` = the arena centre)
   * over `ms` (the recipe default when ≤ 0). Returns the recipe (for the stage's flash / beacon / camera cues).
   */
  spawn(id: VfxId, from: VfxAnchor | null, to: VfxAnchor | null, center: Vector3, ms: number): VfxRecipe {
    const r = VFX_TABLE[id];
    if (r === undefined) throw new RangeError(`@ewa/render: unknown VfxId '${String(id)}'`);
    this.spawnRecipe(r, from, to, center, ms);
    return r;
  }

  /**
   * Spawns any recipe (a table entry or a `SequenceVfxRecipe`) into the pooled emitters — the same slices, the same
   * shared material; nothing is allocated on the GPU side.
   */
  spawnRecipe(r: VfxRecipe | SequenceVfxRecipe, from: VfxAnchor | null, to: VfxAnchor | null, center: Vector3, ms: number): void {
    const dur = Number.isFinite(ms) && ms > 0 ? ms : r.defaultMs;
    for (const ph of r.phases) this.emitPhase(r, ph, from, to, center, dur);
    if (r.chroma !== null) this.hooks.chroma?.(r.chroma.amount, r.chroma.ms);
    this.spawnCount++;
  }

  /** Per frame: advance the VFX clock (seconds × timeScale) and the size-attenuation scale. Zero allocation. */
  update(dtScaledMs: number, camera: PerspectiveCamera | null): void {
    if (this.disposed) return;
    this.nowS += Math.max(0, dtScaledMs) / 1000;
    this.clock.value = this.nowS;
    if (camera !== null) this.sizeScale.value = 1 / Math.tan((camera.fov * Math.PI / 180) / 2);
    this.object.visible = this.nowS <= this.aliveUntil;
  }

  /** Kills every particle (battle end, resync). */
  clear(): void {
    const o = this.aOrigin.array as Float32Array;
    for (let i = 0; i < CAPACITY; i++) o[i * 4 + 3] = -1e6;
    this.aOrigin.clearUpdateRanges();
    this.aOrigin.needsUpdate = true;
    for (const e of this.emitters) e.busyUntil = -1;
    this.aliveUntil = 0;
    this.object.visible = false;
  }

  /** Live particle budget used (for tests / stats). */
  activeEmitters(): number {
    let n = 0;
    for (const e of this.emitters) if (e.busyUntil > this.nowS) n++;
    return n;
  }

  get spawned(): number { return this.spawnCount; }
  get now(): number { return this.nowS; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    this.material.dispose();   // the Sprite quad geometry is three's module-level shared one: never disposed here
  }

  // ---- internals ---------------------------------------------------------------------------------------------

  private takeEmitter(): Emitter {
    let best = this.emitters[0]!;
    for (const e of this.emitters) { if (e.busyUntil < best.busyUntil) best = e; }
    return best;
  }

  private anchorPoint(which: VfxPhase['anchor'], from: VfxAnchor | null, to: VfxAnchor | null, center: Vector3, height: number, out: Vector3): Vector3 {
    const a = which === 'from' ? (from ?? to) : which === 'to' ? (to ?? from) : null;
    if (a === null) return out.copy(center).setY(center.y + height);
    const h = height <= 1.5 ? height * a.height : height;   // ≤ 1.5 → fraction of the creature's height
    return out.copy(a.feet).setY(a.feet.y + h);
  }

  private emitPhase(r: VfxRecipe | SequenceVfxRecipe, ph: VfxPhase, from: VfxAnchor | null, to: VfxAnchor | null, center: Vector3, durMs: number): void {
    const n = Math.min(MAX_PARTICLES, Math.max(0, Math.floor(ph.count)));
    if (n === 0) return;
    const em = this.takeEmitter();
    const rnd = this.rand;
    const t0 = this.nowS + ph.delay * durMs / 1000;
    const spread = ph.spreadMs / 1000;
    const hexA = ph.color === 'type' ? this.typeTable[r.type ?? 'Normal'] : ph.color;
    hexToLinearInto(hexA, _c1);
    hexToLinearInto(ph.color2 ?? hexA, _c2);
    // endpoints for travelling motions
    this.anchorPoint('from', from, to, center, ph.height, _a);
    this.anchorPoint('to', from, to, center, ph.height, _b);
    const travelS = Math.min(0.6, Math.max(0.12, durMs * 0.5 / 1000));
    const O = this.aOrigin.array as Float32Array; const V = this.aVel.array as Float32Array; const C = this.aColor.array as Float32Array;
    const B = this.aOrbit.array as Float32Array; const M = this.aMisc.array as Float32Array;
    let lastDeath = t0;
    for (let k = 0; k < n; k++) {
      const i = (em.start + k) * 4;
      const birth = t0 + (n > 1 ? (k / (n - 1)) * spread : 0) + rnd() * 0.02;
      let life = (ph.lifeMs / 1000) * (0.75 + rnd() * 0.5);
      let ox = 0; let oz = 0;
      const ang = rnd() * Math.PI * 2;
      const rad = ph.radius * Math.sqrt(rnd());
      switch (ph.motion) {
        case 'stream': case 'drain': case 'arc': {
          const src = ph.motion === 'drain' ? _b : _a; const dst = ph.motion === 'drain' ? _a : _b;
          _o.set(src.x + Math.cos(ang) * rad, src.y + (rnd() - 0.5) * ph.radius, src.z + Math.sin(ang) * rad);
          life = travelS;
          _v.set((dst.x - _o.x) / life, (dst.y - _o.y) / life, (dst.z - _o.z) / life);
          if (ph.motion === 'arc' || ph.gravity !== 0) _v.y += 0.5 * ph.gravity * life;   // lob so gravity lands it on the target
          _v.x += (rnd() - 0.5) * ph.speed; _v.y += (rnd() - 0.5) * ph.speed; _v.z += (rnd() - 0.5) * ph.speed;
          break;
        }
        case 'burst': {
          this.anchorPoint(ph.anchor, from, to, center, ph.height, _o);
          const u = rnd() * 2 - 1; const th = rnd() * Math.PI * 2; const s = Math.sqrt(1 - u * u);
          const sp = ph.speed * (0.4 + rnd() * 0.6);
          _v.set(s * Math.cos(th) * sp, Math.abs(u) * sp * 0.8 + sp * 0.2, s * Math.sin(th) * sp);
          break;
        }
        case 'ring': {
          this.anchorPoint(ph.anchor, from, to, center, ph.height, _o);
          const sp = ph.speed * (0.7 + rnd() * 0.3);
          _v.set(Math.cos(ang) * sp, rnd() * 0.3, Math.sin(ang) * sp);
          break;
        }
        case 'rise': case 'fall': {
          this.anchorPoint(ph.anchor, from, to, center, ph.height, _o);
          _o.x += Math.cos(ang) * rad; _o.z += Math.sin(ang) * rad;
          const sp = ph.speed * (0.6 + rnd() * 0.8);
          _v.set((rnd() - 0.5) * 0.3, ph.motion === 'rise' ? sp : -sp, (rnd() - 0.5) * 0.3);
          break;
        }
        case 'orbit': {
          this.anchorPoint(ph.anchor, from, to, center, ph.height, _o);
          ox = Math.cos(ang) * ph.radius; oz = Math.sin(ang) * ph.radius;
          _v.set(0, ph.speed * (rnd() - 0.2), 0);
          break;
        }
        case 'field': {
          _o.set(center.x + (rnd() * 2 - 1) * ph.radius, center.y + ph.height * (0.6 + rnd() * 0.4), center.z + (rnd() * 2 - 1) * ph.radius);
          const sp = ph.speed * (0.8 + rnd() * 0.4);
          if (r.id === 'weather_sand') _v.set(sp, -0.2, sp * 0.3);
          else _v.set(sp * 0.04, -sp, 0);
          break;
        }
      }
      const mixK = rnd();
      const inten = ph.intensity * (0.8 + rnd() * 0.4);
      O[i] = _o.x; O[i + 1] = _o.y; O[i + 2] = _o.z; O[i + 3] = birth;
      V[i] = _v.x; V[i + 1] = _v.y; V[i + 2] = _v.z; V[i + 3] = life;
      C[i] = (_c1.r + (_c2.r - _c1.r) * mixK) * inten; C[i + 1] = (_c1.g + (_c2.g - _c1.g) * mixK) * inten; C[i + 2] = (_c1.b + (_c2.b - _c1.b) * mixK) * inten;
      C[i + 3] = ph.size * (0.7 + rnd() * 0.6);
      // travelling motions never swirl (a rotation about the emission point would swing the stream off target)
      const travelling = ph.motion === 'stream' || ph.motion === 'drain' || ph.motion === 'arc';
      B[i] = ox; B[i + 1] = oz; B[i + 2] = travelling ? 0 : ph.swirl; B[i + 3] = ph.gravity;
      M[i] = Math.max(0.001, ph.drag); M[i + 1] = SHAPE_INDEX[ph.shape]; M[i + 2] = ph.sizeEnd; M[i + 3] = 0;
      lastDeath = Math.max(lastDeath, birth + life);
    }
    // the rest of the emitter's slice dies
    for (let k = n; k < MAX_PARTICLES; k++) O[(em.start + k) * 4 + 3] = -1e6;
    for (const a of this.attrs) {
      a.addUpdateRange(em.start * 4, MAX_PARTICLES * 4);
      a.needsUpdate = true;
    }
    em.busyUntil = lastDeath;
    this.aliveUntil = Math.max(this.aliveUntil, lastDeath);
    this.object.visible = true;
  }

  private buildMaterial(): PointsNodeMaterial {
    const m = new PointsNodeMaterial();
    const aO = instancedBufferAttribute(this.aOrigin) as unknown as Node<'vec4'>;
    const aV = instancedBufferAttribute(this.aVel) as unknown as Node<'vec4'>;
    const aC = instancedBufferAttribute(this.aColor) as unknown as Node<'vec4'>;
    const aB = instancedBufferAttribute(this.aOrbit) as unknown as Node<'vec4'>;
    const aM = instancedBufferAttribute(this.aMisc) as unknown as Node<'vec4'>;
    const age = this.clock.sub(aO.w);
    const life = max(aV.w, float(1e-4));
    const k = age.div(life);
    const alive = step(float(0), age).mul(step(age, life));
    const drag = aM.x;
    const disp = aV.xyz.mul(oneMinusExp(drag.mul(age)).div(drag));
    const fall = vec3(0, aB.w.mul(age).mul(age).mul(-0.5), 0);
    const local = vec3(aB.x, 0, aB.y).add(disp).add(fall);
    const sw = aB.z.mul(age);
    const cs = cos(sw); const sn = sin(sw);
    const rotated = vec3(local.x.mul(cs).sub(local.z.mul(sn)), local.y, local.x.mul(sn).add(local.z.mul(cs)));
    m.positionNode = aO.xyz.add(rotated);
    m.sizeNode = aC.w.mul(mix(float(1), aM.z, k.clamp(0, 1))).mul(alive).mul(this.sizeScale);
    // shapes: disc · star · ring · streak · pixel
    const q = uv().sub(0.5);
    const r = length(q);
    const shapeAlpha = Fn(() => {
      const s = aM.y;
      const disc = smoothstep(0.5, 0.18, r);
      const star = max(smoothstep(0.1, 0.0, min(abs(q.x), abs(q.y)).mul(2.2)).mul(smoothstep(0.5, 0.1, r)), smoothstep(0.16, 0.0, r));
      const ring = smoothstep(0.09, 0.0, abs(r.sub(0.36)));
      const streak = smoothstep(0.14, 0.02, abs(q.x)).mul(smoothstep(0.5, 0.3, abs(q.y)));
      const pixel = step(max(abs(q.x), abs(q.y)), float(0.32));
      return select(s.lessThan(0.5), disc, select(s.lessThan(1.5), star, select(s.lessThan(2.5), ring, select(s.lessThan(3.5), streak, pixel))));
    })();
    const fade = smoothstep(0, 0.12, k).mul(oneMinusSq(k));
    m.colorNode = vec4(aC.rgb, shapeAlpha.mul(fade));   // additive (SrcAlpha, One): rgb × alpha is added
    m.transparent = true;
    m.blending = AdditiveBlending;
    m.depthWrite = false;
    m.depthTest = true;
    m.sizeAttenuation = true;
    m.fog = false;
    m.mrtNode = overlayMrt(true);         // view-axis normal, mask (1, 0): never sharpens (see overlayMrt.ts)
    m.alphaTest = OVERLAY_ALPHA_CUT;
    m.name = 'ewa:vfx';
    m.userData = { ewaClass: 'fx' };
    return m;
  }
}

function oneMinusExp(x: Node<'float'>): Node<'float'> {
  return float(1).sub(exp(x.negate()));
}

function oneMinusSq(k: Node<'float'>): Node<'float'> {
  const c = float(1).sub(k.clamp(0, 1));
  return c.mul(c);
}
