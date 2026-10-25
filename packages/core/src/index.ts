/**
 * @ewa/core — the public surface of .design/spec/00-spine.md §2, in section order.
 * Core imports nothing, allocates no Date, never calls Math.random, and knows no data: every function
 * that needs species/moves/abilities/items or the type chart takes a ContentIndex.
 */

// §2.1 Rng
export type { Rng, RngState } from './types';
export { createRng, fnv1a32 } from './rng';

// §2.2 Types and the chart
export type { TypeName, TypeChart } from './types';
export { TYPE_NAMES, typeMultiplier } from './typechart';

// §2.3 SpeciesDef
export type { Rarity, SpeciesRole, LearnEntry, Evolution, SpeciesDef, BattleFormDef, BandKind, HonorReason } from './types';
export { activeForm, bandsFor, formBase, formLineMet, formMove, formMoveId, formsOf, formTypes, heldForm, transformError } from './forms';
export { HONOR_DELTAS, HONOR_MAX, HONOR_MIN, clampHonor, tracksHonor } from './honor';

// §2.4 MoveDef and the 23 effects
export type { MoveEffect, MoveTarget, MoveSpread, MoveDef } from './types';

// §2.5 AbilityDef and hooks
export type { StatKey, WeatherKind, MajorStatus, StatusId, AbilityHook, AbilityDef } from './types';

// §2.6 Items
export type { HeldItemHook, ItemDef, OrbDef, ConsumableEffect, ConsumableDef } from './types';

// §2.7 Stats and stages
export type { StatStage } from './types';
export { calcStat, calcMaxHp, stageRatio, accStageRatio, clampStage } from './stats';

// §2.8 CreatureInstance
export type { VariantKey, MoveSlot, CreatureInstance } from './types';
export { addStatus, removeStatus, majorStatus, hasStatus } from './status';

// §2.9 Battler and BattleState
export type {
  Volatile,
  Battler,
  BattleFormat,
  SideKind,
  Side,
  Terrain,
  Field,
  BattleOutcome,
  BattleState,
  CreateBattleOpts,
} from './types';
export { atLevel, capLevel, projectBattler } from './battler';
export { createBattle } from './turn';

// §2.10 Actions and resolveTurn
export type { Action, ActionError, TurnResult, FieldRef, SideChoice } from './types';
export { validateAction, resolveTurn, InvalidActionError } from './turn';
export { chooseNpcAction, chooseNpcDoubles } from './npc';
// Phase D6 doubles helpers
export { requiredPositions, validateSideChoice, choicePair, isSpread } from './doubles';

// §2.14 Damage
export type { DamageResult } from './types';
export { calcDamage } from './damage';

// §2.15 Catch (the committed table; the formula runs inside resolveTurn)
export { CATCH_B } from './catch';

// §2.16 EXP, levels, evolution
export type { LevelUpResult } from './types';
export { MAX_LEVEL, expToLevel, levelForExp, expGain, applyExp, evolve, evolutionChildren, evolutionTarget, itemEvolutionTarget, tradeEvolutionTarget } from './exp';

// §2.17 Elo
export type { EloResult } from './types';
export { ELO_K, ELO_DEFAULT, eloDelta, eloDrawDelta, RANK_TIERS, tierFor } from './elo';

// §2.18 Trainer exp
export type { TrainerExpEvent } from './types';
export { TRAINER_EXP, trainerExpFor, trainerLevelFor } from './trainerExp';

// §2.19 BattleEvent
export type { Ref, BattleEvent } from './types';

// §2.20 ContentIndex, digest
export type { ContentIndex } from './types';
export { canonicalJson, digestBattleState } from './digest';

// §2.21 Replays
export type { ReplayRun, ReplayStep } from './replay';
export { replayBattle } from './replay';
