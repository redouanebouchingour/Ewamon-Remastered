/**
 * SPEC §20.5.2 — the move animation registry. `MOVE_ANIMS` is hand-authored per move id (ids ARE display names in
 * content, e.g. 'Vine Lash'); `DEFAULT_BY_TYPE` covers all 19 types; `createMoveAnimRegistry().get(id, move)` merges
 * defaults ← type default ← the move's own entry, once per move (cached). Every `vfx` is one of render's 47
 * `VFX_IDS` (asserted by timeline.test.ts).
 */
import type { MoveDef, TypeName } from '@ewa/core';

export type AttackerPose = 'lunge' | 'windup' | 'idle';
export type MoveCamera = 'attacker' | 'defender' | 'impact' | 'wide';

export interface MoveAnimDef {
  /** default 250 */
  readonly windupMs: number;
  /** default 200; 0 for self/field moves */
  readonly travelMs: number;
  /** default 300 */
  readonly recoverMs: number;
  /** render VFX id; default `type_${type.toLowerCase()}` */
  readonly vfx: string;
  /** default 'impact' for power > 0, 'attacker' for self, 'wide' for field */
  readonly camera: MoveCamera;
  /** default `move_${type.toLowerCase()}` */
  readonly sfx: string;
  /** default: contact ? 'lunge' : 'windup' */
  readonly attackerPose: AttackerPose;
}

export interface MoveAnimRegistry {
  get(moveId: string, move: MoveDef): MoveAnimDef;
}

/** Hand-authored entries, keyed by move id. ≥ 40 on the slice (every move a Mirevale / Mire Route species learns by 30). */
export const MOVE_ANIMS: Readonly<Record<string, Partial<MoveAnimDef>>> = {
  // Normal
  Tackle: { windupMs: 180, travelMs: 160, recoverMs: 260, vfx: 'impact_normal', attackerPose: 'lunge' },
  'Quick Attack': { windupMs: 90, travelMs: 110, recoverMs: 220, vfx: 'impact_normal', camera: 'defender', attackerPose: 'lunge' },
  Peck: { windupMs: 160, travelMs: 140, recoverMs: 240, vfx: 'impact_normal', attackerPose: 'lunge' },
  'Body Slam': { windupMs: 320, travelMs: 220, recoverMs: 340, vfx: 'impact_normal', attackerPose: 'lunge' },
  Growl: { windupMs: 300, travelMs: 0, recoverMs: 260, vfx: 'stat_down', camera: 'defender', attackerPose: 'windup' },
  Howl: { windupMs: 300, travelMs: 0, recoverMs: 260, vfx: 'stat_up', camera: 'attacker', attackerPose: 'windup' },
  Protect: { windupMs: 220, travelMs: 0, recoverMs: 240, vfx: 'stat_up', camera: 'attacker', attackerPose: 'idle' },
  'Feather Dance': { windupMs: 320, travelMs: 240, recoverMs: 280, vfx: 'type_flying', camera: 'defender', attackerPose: 'windup' },
  // Grass
  'Vine Lash': { windupMs: 240, travelMs: 220, recoverMs: 300, vfx: 'type_grass', attackerPose: 'windup' },
  'Leaf Blade': { windupMs: 260, travelMs: 180, recoverMs: 300, vfx: 'type_grass', attackerPose: 'lunge' },
  'Nature Drain': { windupMs: 260, travelMs: 260, recoverMs: 320, vfx: 'drain', attackerPose: 'windup' },
  'Solar Absorb': { windupMs: 320, travelMs: 0, recoverMs: 300, vfx: 'heal', camera: 'attacker', attackerPose: 'idle' },
  Synthesis: { windupMs: 320, travelMs: 0, recoverMs: 300, vfx: 'heal', camera: 'attacker', attackerPose: 'idle' },
  'Sunny Day': { windupMs: 300, travelMs: 0, recoverMs: 300, vfx: 'weather_sun', camera: 'wide', attackerPose: 'windup' },
  // Fire
  'Fire Fang': { windupMs: 200, travelMs: 170, recoverMs: 280, vfx: 'type_fire', attackerPose: 'lunge' },
  'Flame Dash': { windupMs: 220, travelMs: 200, recoverMs: 300, vfx: 'type_fire', attackerPose: 'lunge' },
  'Inferno Rush': { windupMs: 360, travelMs: 240, recoverMs: 360, vfx: 'type_fire', attackerPose: 'lunge' },
  'Will-O-Wisp': { windupMs: 300, travelMs: 320, recoverMs: 280, vfx: 'status_burn', attackerPose: 'windup' },
  // Water
  'Water Pulse': { windupMs: 240, travelMs: 240, recoverMs: 300, vfx: 'type_water', attackerPose: 'windup' },
  'Bubble Beam': { windupMs: 240, travelMs: 260, recoverMs: 300, vfx: 'type_water', attackerPose: 'windup' },
  'Aqua Blade': { windupMs: 260, travelMs: 200, recoverMs: 320, vfx: 'type_water', attackerPose: 'lunge' },
  // Electric
  'Thunder Claw': { windupMs: 220, travelMs: 160, recoverMs: 300, vfx: 'type_electric', attackerPose: 'lunge' },
  'Volt Crash': { windupMs: 340, travelMs: 220, recoverMs: 360, vfx: 'type_electric', attackerPose: 'lunge' },
  // Poison
  Acid: { windupMs: 240, travelMs: 240, recoverMs: 280, vfx: 'type_poison', attackerPose: 'windup' },
  'Cross Poison': { windupMs: 240, travelMs: 180, recoverMs: 300, vfx: 'type_poison', attackerPose: 'lunge' },
  'Venom Fang': { windupMs: 220, travelMs: 170, recoverMs: 300, vfx: 'type_poison', attackerPose: 'lunge' },
  'Stink Cloud': { windupMs: 280, travelMs: 260, recoverMs: 300, vfx: 'status_poison', attackerPose: 'windup' },
  // Flying
  'Aerial Ace': { windupMs: 160, travelMs: 150, recoverMs: 260, vfx: 'type_flying', camera: 'defender', attackerPose: 'lunge' },
  'Sky Pierce': { windupMs: 300, travelMs: 180, recoverMs: 320, vfx: 'type_flying', attackerPose: 'lunge' },
  'Wing Gust': { windupMs: 220, travelMs: 220, recoverMs: 280, vfx: 'type_flying', attackerPose: 'lunge' },
  // Psychic
  Confusion: { windupMs: 280, travelMs: 240, recoverMs: 300, vfx: 'type_psychic', attackerPose: 'windup' },
  'Psych Wave': { windupMs: 300, travelMs: 280, recoverMs: 320, vfx: 'type_psychic', attackerPose: 'windup' },
  'Calm Mind': { windupMs: 320, travelMs: 0, recoverMs: 260, vfx: 'stat_up', camera: 'attacker', attackerPose: 'idle' },
  'Light Screen': { windupMs: 300, travelMs: 0, recoverMs: 260, vfx: 'stat_up', camera: 'attacker', attackerPose: 'idle' },
  // Fairy
  'Fairy Wind': { windupMs: 240, travelMs: 240, recoverMs: 280, vfx: 'type_fairy', attackerPose: 'windup' },
  'Dazzling Gleam': { windupMs: 300, travelMs: 220, recoverMs: 320, vfx: 'type_fairy', camera: 'wide', attackerPose: 'windup' },
  Moonblast: { windupMs: 360, travelMs: 300, recoverMs: 340, vfx: 'type_fairy', attackerPose: 'windup' },
  // Bug
  'Bug Bite': { windupMs: 180, travelMs: 150, recoverMs: 260, vfx: 'type_bug', attackerPose: 'lunge' },
  'String Shot': { windupMs: 240, travelMs: 260, recoverMs: 260, vfx: 'stat_down', camera: 'defender', attackerPose: 'windup' },
  // Dark
  Bite: { windupMs: 180, travelMs: 150, recoverMs: 280, vfx: 'type_dark', attackerPose: 'lunge' },
};

/** All 19 types present (asserted). Type-level feel; the VFX/SFX default by type name. */
export const DEFAULT_BY_TYPE: Readonly<Record<TypeName, Partial<MoveAnimDef>>> = {
  Normal: { vfx: 'impact_normal' },
  Fire: { windupMs: 260 },
  Water: { travelMs: 230 },
  Grass: { travelMs: 220 },
  Electric: { windupMs: 220, travelMs: 150 },
  Ice: { travelMs: 240 },
  Fighting: { windupMs: 200, travelMs: 150 },
  Poison: { travelMs: 230 },
  Ground: { windupMs: 300, travelMs: 180 },
  Flying: { windupMs: 200, travelMs: 170 },
  Psychic: { windupMs: 300, travelMs: 260 },
  Bug: { windupMs: 200 },
  Rock: { windupMs: 300, travelMs: 220 },
  Ghost: { windupMs: 300, travelMs: 280 },
  Dragon: { windupMs: 320, recoverMs: 340 },
  Steel: { windupMs: 280, recoverMs: 320 },
  Fairy: { travelMs: 240 },
  Dark: { windupMs: 240 },
  Cosmic: { windupMs: 340, travelMs: 280, recoverMs: 340 },
};

export const ANIM_DEFAULTS = { windupMs: 250, travelMs: 200, recoverMs: 300 } as const;

function lower(t: TypeName): string {
  return t.toLowerCase();
}

/** The §20.5.2 defaults for one move before any table is applied. */
export function defaultAnim(move: MoveDef): MoveAnimDef {
  const selfOrField = move.target === 'self' || move.target === 'field';
  return {
    windupMs: ANIM_DEFAULTS.windupMs,
    travelMs: selfOrField ? 0 : ANIM_DEFAULTS.travelMs,
    recoverMs: ANIM_DEFAULTS.recoverMs,
    vfx: `type_${lower(move.type)}`,
    camera: move.target === 'field' ? 'wide' : move.target === 'self' ? 'attacker' : move.power > 0 ? 'impact' : 'defender',
    sfx: `move_${lower(move.type)}`,
    attackerPose: move.contact ? 'lunge' : 'windup',
  };
}

export function createMoveAnimRegistry(
  perMove: Readonly<Record<string, Partial<MoveAnimDef>>> = MOVE_ANIMS,
  byType: Readonly<Record<TypeName, Partial<MoveAnimDef>>> = DEFAULT_BY_TYPE,
): MoveAnimRegistry {
  const cache = new Map<string, MoveAnimDef>();
  return {
    get(moveId, move) {
      const hit = cache.get(moveId);
      if (hit !== undefined) return hit;
      const base = defaultAnim(move);
      const t = byType[move.type] ?? {};
      const own = perMove[moveId] ?? {};
      const merged: MoveAnimDef = { ...base, ...t, ...own };
      // self/field moves never travel, whatever a type default says
      const def = move.target === 'self' || move.target === 'field' ? { ...merged, travelMs: own.travelMs ?? 0 } : merged;
      cache.set(moveId, def);
      return def;
    },
  };
}
