/**
 * @ewa/core public types — §2 of .design/spec/00-spine.md, verbatim.
 * Core knows no data: every function that needs species/moves/abilities/items/type chart takes a ContentIndex.
 */

// ─── §2.1 Rng ────────────────────────────────────────────────────────────────

/** Four uint32 words. Serialisable as JSON; the only thing a battle stores about randomness. */
export type RngState = readonly [number, number, number, number];

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). n must be an integer 1..2^31-1; throws otherwise. */
  int(n: number): number;
  /** True with probability p (0..1). Consumes exactly one draw. */
  chance(p: number): boolean;
  /** One element, uniform. Throws on empty. Consumes exactly one draw. */
  pick<T>(a: readonly T[]): T;
  /** Fisher–Yates, returns a NEW array; consumes exactly a.length - 1 draws. */
  shuffle<T>(a: readonly T[]): T[];
  /** A new independent stream seeded from 4 draws of this one (this stream advances by 4). */
  fork(): Rng;
  /** The current state. Feeding it to createRng resumes the identical sequence. */
  snapshot(): RngState;
}

// ─── §2.2 Types and the chart ────────────────────────────────────────────────

export type TypeName =
  | 'Normal' | 'Fire' | 'Water' | 'Grass' | 'Electric' | 'Ice' | 'Fighting' | 'Poison'
  | 'Ground' | 'Flying' | 'Psychic' | 'Bug' | 'Rock' | 'Ghost' | 'Dragon' | 'Steel'
  | 'Fairy' | 'Dark' | 'Cosmic';

/** chart[attacking][defending] = 0 | 0.5 | 2. Missing entry = 1. */
export type TypeChart = Readonly<Record<TypeName, Readonly<Partial<Record<TypeName, 0 | 0.5 | 2>>>>>;

export type Effectiveness = 0 | 0.25 | 0.5 | 1 | 2 | 4;

// ─── §2.3 SpeciesDef ─────────────────────────────────────────────────────────

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythical';
export type SpeciesRole =
  | 'Physical Attacker' | 'Special Attacker' | 'Mixed Attacker' | 'Physical Defender'
  | 'Special Defender' | 'Mixed Defender' | 'Healer' | 'Speed' | 'Tank';

export interface LearnEntry { readonly move: string; readonly level: number } // level 1 = known at creation

export type Evolution =
  | { readonly kind: 'level'; readonly into: string; readonly atLevel: number }
  | { readonly kind: 'split'; readonly atLevel: number;
      readonly branches: readonly { readonly into: string;
        readonly condition: { readonly kind: 'ability'; readonly ability: string } | null }[] }
  // Phase D3: stone and trade evolutions. Never level-triggered (`applyExp` reports no `evolveReady` for them);
  // the server evolves on an explicit request, resolved by `itemEvolutionTarget` / `tradeEvolutionTarget`.
  | { readonly kind: 'item'; readonly item: string; readonly into: string }
  | { readonly kind: 'trade'; readonly into: string }
  | null;

export interface SpeciesDef {
  readonly id: string;                 // snake_case, e.g. 'bramblecub'
  readonly name: string;               // display, e.g. 'Bramblecub'
  readonly dexNumber: number;          // 1..130, unique, dense
  readonly flavor: string;
  readonly types: readonly [TypeName] | readonly [TypeName, TypeName];
  readonly baseHp: number; readonly baseAtk: number; readonly baseDef: number; readonly baseSpd: number;
  readonly rarity: Rarity;
  readonly catchRate: number;          // 3..255
  readonly sizeScale: number;          // billboard scale, 0.5..2.2
  readonly expYield: number;
  readonly moves: readonly string[];   // the default 4 at creation, length 1..4
  readonly learnableMoves: readonly LearnEntry[]; // sorted by level asc, includes `moves` at level 1
  readonly abilities: readonly string[];          // 1..2 ability ids; index 0 is the default
  readonly role: SpeciesRole;
  readonly evolution: Evolution;
  readonly evolvesFrom: string | null;
  readonly sprite: { readonly front: string; readonly back: string }; // pipeline output ids, e.g. 'bramblecub_front'
  readonly legendary: boolean;         // true for exactly the 10 legendaries incl. the 2 mythicals
}

// ─── §2.4 MoveDef and the 23 effects ─────────────────────────────────────────

export type MoveEffect =
  | 'lower_atk' | 'first' | 'paralyze' | 'flinch' | 'crit' | 'confuse' | 'poison' | 'raise_def'
  | 'burn' | 'recoil' | 'lower_def' | 'drain' | 'heal' | 'sun' | 'lower_spd' | 'freeze'
  | 'raise_all' | 'trap' | 'weather' | 'sleep' | 'lower_spAtk' | 'raise_atk' | 'raise_spd';

export type MoveTarget = 'foe' | 'self' | 'field';

/**
 * Phase D6 — doubles reach of a move. `'foes'` hits every standing foe on the field, `'all'` every other standing
 * battler (both foes and the ally). Absent = single target. Read only in doubles (`BattleState.slots === 2`); a spread
 * move that actually strikes 2+ targets deals ×0.75 (floor, min 1) to each. Content assigns it from a curated list.
 */
export type MoveSpread = 'foes' | 'all';

export interface MoveDef {
  readonly id: string;              // the legacy display name, e.g. 'Vine Lash' — ids ARE names
  readonly type: TypeName;
  readonly power: number;           // 0 = status move
  readonly pp: number;              // 5..40
  readonly accuracy: number | null; // 1..100; null = never misses
  readonly priority: -1 | 0 | 1;    // 'first' moves are 1; content may set -1 on none in v1
  readonly contact: boolean;        // derived at content build: power > 0 && type not in the non-contact set
  readonly effect: MoveEffect | null;
  readonly effectChance: number;    // 1..100, applied AFTER the move hits (see table)
  readonly target: MoveTarget;      // 'field' for weather/sun; 'self' for raise_*/heal; else 'foe'
  readonly description: string;
  /** Phase D6: doubles spread reach (absent = single target); ignored in singles */
  readonly spread?: MoveSpread;
}

// ─── §2.5 AbilityDef and hooks ───────────────────────────────────────────────

export type StatKey = 'atk' | 'def' | 'spd' | 'acc' | 'eva';
export type WeatherKind = 'none' | 'sun' | 'rain' | 'sand' | 'hail';
export type MajorStatus = 'burn' | 'poison' | 'paralyze' | 'sleep' | 'freeze';
export type StatusId = MajorStatus | 'confuse';

export type AbilityHook =
  | { readonly kind: 'onSwitchIn'; readonly lowerFoe: { readonly stat: StatKey; readonly stages: number } }
  | { readonly kind: 'onSwitchOut'; readonly action: 'healFraction' | 'cureStatus'; readonly fraction?: number }
  | { readonly kind: 'modifySpeed'; readonly whenWeather: WeatherKind; readonly mul: number }
  | { readonly kind: 'modifyAttack'; readonly when: 'always' | 'statused'; readonly mul: number }
  | { readonly kind: 'modifyDamage'; readonly side: 'attacker' | 'defender';
      readonly moveTypes?: readonly TypeName[]; readonly when?: 'superEffective' | 'flashFired'; readonly mul: number }
  | { readonly kind: 'modifyAccuracy'; readonly side: 'attacker' | 'defender';
      readonly whenWeather?: WeatherKind; readonly onlyDamaging?: boolean; readonly mul: number }
  | { readonly kind: 'typeImmunity'; readonly moveType: TypeName;
      readonly reaction:
        | { readonly kind: 'none' }
        | { readonly kind: 'heal'; readonly fraction: number }
        | { readonly kind: 'flag'; readonly flag: 'flashFired' }
        | { readonly kind: 'raiseStat'; readonly stat: StatKey; readonly stages: number } }
  | { readonly kind: 'statusImmunity'; readonly statuses: readonly StatusId[] }
  | { readonly kind: 'stageLowerImmunity'; readonly stats: readonly StatKey[] }
  | { readonly kind: 'onContact';
      readonly reaction:
        | { readonly kind: 'inflictStatus'; readonly status: MajorStatus; readonly chance: number }
        | { readonly kind: 'damageFraction'; readonly fraction: number } }
  | { readonly kind: 'onStatLowered'; readonly raise: { readonly stat: StatKey; readonly stages: number } }
  | { readonly kind: 'endOfTurn'; readonly raise: { readonly stat: StatKey; readonly stages: number } }
  | { readonly kind: 'wonderGuard' };

export interface AbilityDef {
  readonly id: string;          // legacy display name, e.g. 'Intimidate'
  readonly name: string;
  readonly description: string;
  readonly hooks: readonly AbilityHook[];
}

// ─── §2.6 Items: held, key, orbs, consumables ────────────────────────────────

export type HeldItemHook =
  | { readonly kind: 'statMul'; readonly stat: 'atk' | 'def' | 'spd'; readonly mul: number; readonly unevolvedOnly?: boolean }
  | { readonly kind: 'typeBoost'; readonly type: TypeName; readonly mul: number }
  | { readonly kind: 'berry'; readonly belowFraction: number;
      readonly heal: { readonly kind: 'fraction'; readonly value: number } | { readonly kind: 'flat'; readonly value: number } }
  | { readonly kind: 'onSuperEffectiveHit'; readonly raise: { readonly stat: StatKey; readonly stages: number }; readonly consume: true }
  | { readonly kind: 'choiceLock' }          // locked to the first move used until switched out
  | { readonly kind: 'noStatusMoves' }       // cannot select power-0 moves
  | { readonly kind: 'hazardImmunity' };     // no hazards exist in v1: documented no-op

export interface ItemDef {
  readonly id: string;             // legacy display name, e.g. 'Choice Band'
  readonly name: string;
  readonly description: string;
  readonly slot: 'held' | 'key';   // 'key' = inventory-only field verb (HM Surf / Cut / Strength)
  readonly fieldVerb: 'surf' | 'cut' | 'strength' | null;
  readonly hooks: readonly HeldItemHook[];
  readonly price: number | null;   // null = not sold
}

export interface OrbDef {
  readonly id: string;             // 'spark_orb' … 'phantom_orb'
  readonly name: string;
  readonly description: string;
  readonly catchRate: number;      // flat multiplier; 999 = guaranteed (aether_orb)
  readonly bonus:
    | { readonly kind: 'type'; readonly type: TypeName; readonly multiplier: number }
    | { readonly kind: 'alpha_or_variant'; readonly multiplier: number }
    | null;
  readonly price: number; readonly sellPrice: number; readonly maxStack: number; readonly rarity: Rarity;
}

export type ConsumableEffect =
  | { readonly kind: 'healHp'; readonly amount: number | 'full' }
  | { readonly kind: 'revive'; readonly fraction: 0.5 | 1 }
  | { readonly kind: 'cureStatus'; readonly statuses: readonly StatusId[] | 'all' }
  | { readonly kind: 'fullRestore' }
  | { readonly kind: 'restorePp'; readonly amount: number | 'full' }
  | { readonly kind: 'rareCandy' }
  | { readonly kind: 'repel'; readonly steps: number }
  | { readonly kind: 'lure'; readonly steps: number }
  | { readonly kind: 'escapeRope' }
  | { readonly kind: 'evolutionStone' } // Phase D3: the species it evolves name it in SpeciesDef.evolution { kind: 'item', item }
  | { readonly kind: 'sellOnly' };

export interface ConsumableDef {
  readonly id: string;             // snake_case
  readonly name: string;
  readonly description: string;
  readonly effect: ConsumableEffect;
  readonly usableInBattle: boolean;
  readonly price: number; readonly sellPrice: number; readonly maxStack: number;
}

// ─── §2.7 Stats and stages ───────────────────────────────────────────────────

export type StatStage = -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ─── §2.8 CreatureInstance ───────────────────────────────────────────────────

export type VariantKey = 'normal' | 'dawn' | 'dusk' | 'verdant' | 'ember';

export interface MoveSlot { readonly id: string; readonly pp: number; readonly ppMax: number }

export interface CreatureInstance {
  readonly id: string;                 // uuid v4, assigned by persist
  readonly ownerId: string | null;     // uuid of the player; null for a wild/NPC battler projection
  readonly speciesId: string;
  readonly nickname: string | null;    // null = show species name
  readonly level: number;              // 1..100
  readonly exp: number;                // total exp; expToLevel(level) <= exp < expToLevel(level + 1)
  readonly hp: number;                 // 0..calcMaxHp
  readonly moves: readonly MoveSlot[]; // length 1..4
  readonly status: readonly StatusId[];// major statuses mutually exclusive; 'confuse' may coexist
  readonly ability: string;            // one of species.abilities
  readonly heldItem: string | null;
  readonly variantKey: VariantKey;
  readonly isAlpha: boolean;
  /** Phase D4: the 1/512 shiny tier; present (true) only on a shiny, absent otherwise (no effect on battle maths) */
  readonly isShiny?: boolean;
  readonly caughtAt: { readonly zoneId: string; readonly at: number } | null; // at = unix ms; null = starter/gift
  readonly ribbons: readonly string[];
  readonly favorite: boolean;
  readonly locked: boolean;            // locked creatures cannot be released, traded or listed
}

// ─── §2.9 Battler and BattleState ────────────────────────────────────────────

export interface Volatile {
  readonly confusedTurns: number;    // 0 = not confused
  readonly trappedTurns: number;     // 0 = not trapped
  readonly sleepTurns: number;       // remaining, 0 when not asleep
  readonly flinched: boolean;        // this turn only
  readonly flashFired: boolean;      // Flash Fire triggered; cleared on switch-out
  readonly choiceLockedMove: string | null;
  readonly berryConsumed: boolean;
  readonly weaknessPolicyUsed: boolean;
  readonly lastMove: string | null;
  readonly movedThisTurn: boolean;
}

export interface Battler {
  readonly creature: CreatureInstance;      // hp here is the AUTHORITATIVE current HP
  readonly maxHp: number;                   // calcMaxHp(species.baseHp, level)
  readonly atk: number; readonly def: number; readonly spd: number; // calcStat(...) — unstaged
  readonly stages: Readonly<Record<StatKey, StatStage>>;
  readonly volatile: Volatile;
  readonly participated: boolean;           // was ever active; drives exp share
}

export type BattleFormat = 'wild' | 'trainer' | 'league' | 'pvp' | 'raid';
export type SideKind = 'player' | 'wild' | 'npc';

export interface Side {
  readonly kind: SideKind;
  readonly party: readonly Battler[];      // 1..6
  readonly active: number;                 // index into party
  readonly trainerId: string | null;       // player uuid, or content id of the NPC/league trainer
  readonly canFlee: boolean;               // wild: player side true; trainer/league/pvp: false
  readonly canCatch: boolean;              // wild + raid catch window: player side true
  readonly mustSwitch: boolean;            // active fainted and a replacement exists
  readonly consumedItems: readonly string[]; // consumable ids used this battle (raid/pvp limits)
  /**
   * Phase D6 — doubles only (present iff `BattleState.slots === 2`): the party index on field position 0 and 1.
   * `active` mirrors `actives[0]`. A fainted battler with no bench left to replace it stays in its position (hp 0)
   * and is skipped by every rule. `mustSwitch` = some position holds a fainted battler and a bench creature stands.
   */
  readonly actives?: readonly [number, number];
}

export type Terrain = 'none' | 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'shrine' | 'rift';

export interface Field {
  readonly weather: { readonly kind: WeatherKind; readonly turns: number }; // turns remaining incl. current
  readonly terrain: Terrain;   // cosmetic in v1: no rule reads it. Exists so the render arena can dress.
}

export type BattleOutcome =
  | { readonly winner: 0 | 1 }
  | { readonly winner: 'draw' }
  | { readonly winner: 'fled' }                          // side 0 (player) fled
  | { readonly winner: 'caught'; readonly slot: number }; // the wild battler at sides[1].party[slot] was caught

export interface BattleState {
  readonly id: string;
  readonly format: BattleFormat;
  readonly sides: readonly [Side, Side];
  readonly field: Field;
  readonly turn: number;          // 1-based; the first resolveTurn produces turn 1
  readonly rng: RngState;
  readonly ended: BattleOutcome | null;
  readonly zoneId: string;
  /** Phase D6: present (2) only in a doubles battle; absent = singles (state shape byte-identical to pre-D6) */
  readonly slots?: 2;
  /**
   * Phase D14: present (true) only in a battle tower fight — no battler gains exp (no `expGain` / `levelUp` /
   * `learnMove` / `evolveReady` events). Absent = exp as usual (state shape byte-identical to pre-D14).
   */
  readonly noExp?: true;
}

export interface CreateBattleOpts {
  readonly id: string;
  readonly format: BattleFormat;
  readonly zoneId: string;
  readonly terrain: Terrain;
  readonly seed: RngState | number | string;
  readonly sides: readonly [Omit<Side, 'mustSwitch' | 'consumedItems'>, Omit<Side, 'mustSwitch' | 'consumedItems'>];
  /**
   * Phase D7: the zone's overworld weather. Ambient: `field.weather = { kind, turns: 0 }` (turns 0 = no countdown)
   * and one `weatherSet { source: null, turns: 0 }` before the switch-in hooks. A move's weather replaces it for
   * 5 turns as usual. Absent or 'none' → the state and events are byte-identical to a battle without the field.
   */
  readonly weather?: WeatherKind;
  /**
   * Phase D6: 2 = doubles (format trainer / league / pvp only; each side needs two standing creatures — the side's
   * `actives` if given, else its `active` plus the lowest-index other standing creature). Absent or 1 = singles,
   * byte-identical to pre-D6.
   */
  readonly slots?: 1 | 2;
  /** Phase D14: true = `BattleState.noExp` (battle tower). Absent / false = byte-identical to pre-D14. */
  readonly noExp?: boolean;
}

// ─── §2.10 Actions ───────────────────────────────────────────────────────────

/** Phase D6: a field position (doubles move target). `pos` is 0 or 1 — NOT a party index. */
export interface FieldRef { readonly side: 0 | 1; readonly pos: 0 | 1 }

export type Action =
  // must be in active.creature.moves with pp > 0. `target` (doubles only; ignored in singles): the foe or ally position a
  // single-target move aims at — absent = the first standing foe; spread / self / field moves take none.
  | { readonly kind: 'move'; readonly move: string; readonly target?: FieldRef }
  | { readonly kind: 'switch'; readonly to: number }          // party index, not active, hp > 0
  | { readonly kind: 'item'; readonly item: string; readonly target?: number } // consumable id; target = party index (default active)
  | { readonly kind: 'catch'; readonly orb: string }
  | { readonly kind: 'flee' }
  | { readonly kind: 'forfeit' };

export type ActionError =
  | 'battleEnded' | 'unknownMove' | 'noPp' | 'choiceLocked' | 'statusMoveBlocked'
  | 'badSwitchIndex' | 'switchToFainted' | 'switchToActive' | 'trapped'
  | 'unknownItem' | 'itemNotUsableInBattle' | 'badItemTarget'
  | 'cannotCatch' | 'unknownOrb' | 'cannotFlee' | 'cannotForfeit' | 'mustSwitch' | 'actionNotRequired'
  // Phase D6 (doubles only): a move target that is not a position on the field / is the user itself
  | 'badTarget';

/**
 * Phase D6: what one side submits to resolveTurn. Singles: one Action (or null). Doubles: one entry per field position
 * (`[pos0, pos1]`); an entry is null when that position needs no action (fainted with no replacement, or the side is
 * NPC/wild — core chooses). A bare Action in doubles is position 0's action with position 1 null.
 */
export type SideChoice = Action | null | readonly [Action | null, Action | null];

export interface TurnResult { readonly state: BattleState; readonly events: readonly BattleEvent[] }

// ─── §2.14 Damage ────────────────────────────────────────────────────────────

export interface DamageResult {
  readonly amount: number;                          // 0 only on immunity / Wonder Guard
  readonly effectiveness: Effectiveness;
  readonly crit: boolean;
  readonly stab: boolean;
  readonly absorbed: 'heal' | 'flag' | 'raiseStat' | null; // typeImmunity reaction that fired
}

// ─── §2.16 EXP ───────────────────────────────────────────────────────────────

export interface LevelUpResult {
  readonly creature: CreatureInstance;      // level/exp/hp updated; hp raised by the maxHp delta
  readonly levelsGained: readonly number[]; // e.g. [12, 13]
  readonly learnable: readonly { readonly level: number; readonly move: string }[]; // moves reached and not yet known
  readonly evolveReady: string | null;      // species id, when level >= evolution.atLevel (branch resolved by ability)
}

// ─── §2.17 Elo ───────────────────────────────────────────────────────────────

export interface EloResult { readonly winnerDelta: number; readonly loserDelta: number } // winnerDelta >= 0, loserDelta <= 0

// ─── §2.18 Trainer exp ───────────────────────────────────────────────────────

export type TrainerExpEvent =
  | 'wildWin' | 'catch' | 'catchNewSpecies' | 'trainerWin' | 'gymWin' | 'eliteWin' | 'championWin'
  | 'pvpWin' | 'pvpLoss' | 'raidClear' | 'questComplete' | 'dailyLogin' | 'tradeComplete' | 'zoneRestored';

// ─── §2.19 BattleEvent ───────────────────────────────────────────────────────

export interface Ref { readonly side: 0 | 1; readonly slot: number }

export type BattleEvent =
  | { readonly t: 'turnStart'; readonly turn: number }
  // Phase D6: `pos` (the field position, 0/1) is present only in doubles
  | { readonly t: 'switchOut'; readonly who: Ref; readonly reason: 'action' | 'faint'; readonly pos?: 0 | 1 }
  | { readonly t: 'switchIn'; readonly who: Ref; readonly pos?: 0 | 1 }
  | { readonly t: 'abilityTrigger'; readonly who: Ref; readonly ability: string; readonly detail: string }
  // Phase D6: `targets` (every battler a doubles spread move aims at) is present only for a doubles spread move
  | { readonly t: 'moveUsed'; readonly who: Ref; readonly move: string; readonly target: Ref; readonly ppLeft: number; readonly targets?: readonly Ref[] }
  | { readonly t: 'moveMissed'; readonly who: Ref; readonly move: string; readonly target: Ref }
  | { readonly t: 'moveFailed'; readonly who: Ref; readonly move: string | null;
      readonly reason: 'fullHp' | 'noTarget' | 'trapped' | 'noEffect' | 'immune' | 'wonderGuard';
      // Phase D6: the target a doubles spread move failed against (present only then)
      readonly target?: Ref }
  | { readonly t: 'damage'; readonly target: Ref; readonly amount: number; readonly hpAfter: number; readonly maxHp: number;
      readonly effectiveness: Effectiveness; readonly crit: boolean; readonly stab: boolean;
      readonly cause: 'move' | 'confusion' | 'recoil' | 'burn' | 'poison' | 'trap' | 'sand' | 'hail' | 'contact';
      readonly source: Ref | null; readonly move: string | null }
  | { readonly t: 'heal'; readonly target: Ref; readonly amount: number; readonly hpAfter: number;
      readonly cause: 'drain' | 'move' | 'berry' | 'absorb' | 'regenerator' | 'item'; readonly item: string | null }
  | { readonly t: 'statusApplied'; readonly target: Ref; readonly status: StatusId; readonly source: Ref | null; readonly turns: number | null }
  | { readonly t: 'statusBlocked'; readonly target: Ref; readonly status: StatusId; readonly reason: 'type' | 'ability' | 'alreadyStatused' }
  | { readonly t: 'statusTick'; readonly target: Ref; readonly status: StatusId; readonly detail: 'asleep' | 'frozen' | 'paralyzed' | 'confused' }
  | { readonly t: 'statusCured'; readonly target: Ref; readonly status: StatusId; readonly cause: 'timer' | 'thaw' | 'fireHit' | 'item' | 'ability' }
  | { readonly t: 'flinch'; readonly who: Ref }
  | { readonly t: 'statStage'; readonly target: Ref; readonly stat: StatKey; readonly delta: number; readonly after: StatStage;
      readonly clamped: boolean; readonly source: Ref | null; readonly cause: 'move' | 'ability' | 'item' }
  | { readonly t: 'weatherSet'; readonly kind: WeatherKind; readonly turns: number; readonly source: Ref | null }
  | { readonly t: 'weatherTick'; readonly kind: WeatherKind; readonly turnsLeft: number }
  | { readonly t: 'weatherEnd'; readonly kind: WeatherKind }
  | { readonly t: 'trapped'; readonly target: Ref; readonly turns: number; readonly source: Ref }
  | { readonly t: 'trapEnd'; readonly target: Ref }
  | { readonly t: 'itemUsed'; readonly who: Ref; readonly item: string; readonly target: Ref; readonly consumedHeld: boolean }
  | { readonly t: 'heldItemTrigger'; readonly who: Ref; readonly item: string; readonly consumed: boolean }
  | { readonly t: 'faint'; readonly who: Ref }
  | { readonly t: 'switchRequired'; readonly side: 0 | 1 }
  | { readonly t: 'catchThrow'; readonly orb: string; readonly target: Ref }
  | { readonly t: 'catchShake'; readonly n: 1 | 2 | 3 }
  | { readonly t: 'catchResult'; readonly caught: boolean; readonly target: Ref; readonly shakes: 0 | 1 | 2 | 3 | 4 }
  | { readonly t: 'fled'; readonly side: 0 | 1 }
  | { readonly t: 'forfeit'; readonly side: 0 | 1 }
  | { readonly t: 'expGain'; readonly who: Ref; readonly amount: number; readonly expAfter: number }
  | { readonly t: 'levelUp'; readonly who: Ref; readonly level: number; readonly maxHp: number; readonly atk: number; readonly def: number; readonly spd: number }
  | { readonly t: 'learnMove'; readonly who: Ref; readonly move: string; readonly level: number }
  | { readonly t: 'evolveReady'; readonly who: Ref; readonly into: string }
  | { readonly t: 'turnEnd'; readonly turn: number }
  | { readonly t: 'battleEnd'; readonly outcome: BattleOutcome; readonly turns: number };

// ─── §2.20 ContentIndex ──────────────────────────────────────────────────────

export interface ContentIndex {
  species(id: string): SpeciesDef;          // throws RangeError on unknown id
  move(id: string): MoveDef;
  ability(id: string): AbilityDef;
  item(id: string): ItemDef | ConsumableDef;
  orb(id: string): OrbDef;
  readonly typeChart: TypeChart;
  allSpecies(): readonly SpeciesDef[];      // sorted by dexNumber
}
