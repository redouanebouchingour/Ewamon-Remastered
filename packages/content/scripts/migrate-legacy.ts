/**
 * One-shot generator: .design/legacy/{ewamon.js, shop.js} + .design/additions/species.js → packages/content/src/data/{species,moves,
 * abilities,items,orbs,consumables,typechart}.ts. Run with `pnpm --filter @ewa/content run migrate`.
 *
 * Rules applied (spine §2.3–§2.6; each is restated in the generated header):
 *  - species dexNumber = legacy object insertion order (1..130), then .design/additions/species.js in its
 *    insertion order (131..); rows emitted in that order.
 *  - learnableMoves: the default `moves` at level 1; every other legacy learnable move gets a level spaced
 *    evenly between 5 and min(evolution.atLevel ?? 40, 60) in legacy list order, rounded to a multiple of 3
 *    (§2.3 migration rule); duplicates and moves that name no MOVES row are dropped and listed in the header.
 *  - rarity 'epic' (13 legacy rows) → 'rare' (the spine's Rarity has no epic; roster-coverage §15).
 *  - catchRate clamped into 3..255, sizeScale into 0.5..2.2 (schema ranges); clamps are listed in the header.
 *  - evolution: level | split (darkone: the `condition: null` branch last) | null; evolvesFrom kept.
 *  - sprite ids `<id>_front` / `<id>_back` (spine §2.3 example `bramblecub_front`).
 *  - moves: id = legacy display name; priority 1 iff effect 'first'; contact = power > 0 && type ∉ non-contact set;
 *    target 'field' for weather/sun, 'self' for power-0 raise_atk/def/spd/all and heal, else 'foe'; effectChance per §2.4;
 *    'weaknessPolicy' → null; 'lower_spAtk' → 'lower_atk' (no Sp.Atk exists — §2.4); description generated.
 *  - flavor: the 12 story-bible §8.3 sample entries replace legacy text; every other row keeps legacy for now.
 *  - moves are emitted sorted by id; abilities/items/orbs/consumables sorted by id; the type chart with sorted keys.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STONE_AND_TRADE_EVOLUTIONS } from '../src/data/evolutions';
import type {
  AbilityDef,
  AbilityHook,
  BattleFormDef,
  ConsumableDef,
  ConsumableEffect,
  Evolution,
  HeldItemHook,
  ItemDef,
  LearnEntry,
  MoveDef,
  MoveEffect,
  MoveTarget,
  OrbDef,
  Rarity,
  SpeciesDef,
  SpeciesRole,
  StatKey,
  TypeChart,
  TypeName,
} from '@ewa/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGACY_DIR = resolve(HERE, '../../../.design/legacy');
const ADDITIONS_FILE = resolve(HERE, '../../../.design/additions/species.js');
const OUT_DIR = resolve(HERE, '../src/data');

// ─── legacy shapes ──────────────────────────────────────────────────────────

interface LegacySpecies {
  id: string;
  name: string;
  flavor: string;
  type: string[];
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpd: number;
  rarity: string;
  catchRate: number;
  sizeScale: number;
  expYield: number;
  moves: string[];
  learnableMoves: string[];
  abilities: string[];
  role: string;
  evolvesInto?: string;
  evolvesAt?: number;
  evolvesFrom?: string;
  splitEvolvesInto?: { condition?: string; value?: string; into: string }[];
  /** .design/additions only: a mid-battle form (sprite files under the form's own sprite key, see the sprite pipeline) */
  battleForm?: {
    id: string;
    name: string;
    hpBelowPct: number;
    baseAtk: number;
    baseDef: number;
    baseSpd: number;
    onEnter: { clearNegativeStages: boolean; lowerFoes: { stat: string; stages: number } | null };
  };
}
interface LegacyMove {
  power: number;
  type: string;
  pp: number;
  effect: string | null;
  accuracy: number;
}
interface LegacyOrb {
  id: string;
  name: string;
  desc: string;
  catchRate: number;
  bonus?: { kind: 'type'; type: string; multiplier: number } | { kind: 'alpha_or_variant'; multiplier: number };
  price: number;
  sellPrice: number;
  maxStack: number;
  rarity: string;
}
interface LegacyModule {
  EWAMON_SPECIES: Record<string, LegacySpecies>;
  MOVES: Record<string, LegacyMove>;
  TYPE_CHART: Record<string, Record<string, number>>;
  ABILITIES: Record<string, { name: string; desc: string }>;
  ITEMS: Record<string, { name: string; desc: string }>;
  ORBS: Record<string, LegacyOrb>;
}

/** ewamon.js is dependency-free CommonJS under a "type": "module" root: evaluate it in a CJS-shaped wrapper. */
function loadLegacy(): LegacyModule {
  const src = readFileSync(resolve(LEGACY_DIR, 'ewamon.js'), 'utf8');
  const mod: { exports: Partial<LegacyModule> } = { exports: {} };
  const fn = new Function('module', 'exports', src) as (m: typeof mod, e: unknown) => void;
  fn(mod, mod.exports);
  const legacy = mod.exports as LegacyModule;
  // post-legacy species: same row shape, appended after the legacy rows so dex numbers continue at 131
  const add: { exports: { EWAMON_SPECIES_ADDITIONS?: Record<string, LegacySpecies> } } = { exports: {} };
  (new Function('module', 'exports', readFileSync(ADDITIONS_FILE, 'utf8')) as (m: typeof add, e: unknown) => void)(add, add.exports);
  const additions = add.exports.EWAMON_SPECIES_ADDITIONS ?? {};
  for (const id of Object.keys(additions)) {
    if (id in legacy.EWAMON_SPECIES) throw new Error(`additions: species '${id}' already exists in ewamon.js`);
  }
  return { ...legacy, EWAMON_SPECIES: { ...legacy.EWAMON_SPECIES, ...additions } };
}

const notes: string[] = [];

// ─── §2.4 moves ─────────────────────────────────────────────────────────────

const NON_CONTACT: readonly string[] = [
  'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Psychic', 'Ghost', 'Cosmic', 'Fairy',
];
const EFFECT_IDS: readonly MoveEffect[] = [
  'lower_atk', 'first', 'paralyze', 'flinch', 'crit', 'confuse', 'poison', 'raise_def', 'burn', 'recoil',
  'lower_def', 'drain', 'heal', 'sun', 'lower_spd', 'freeze', 'raise_all', 'trap', 'weather', 'sleep',
  'lower_spAtk', 'raise_atk', 'raise_spd',
];

function migrateEffect(id: string, effect: string | null): MoveEffect | null {
  if (effect === null) return null;
  if (effect === 'weaknessPolicy') {
    notes.push(`move '${id}': legacy effect "weaknessPolicy" (a held-item key) → null (§2.4)`);
    return null;
  }
  if (effect === 'lower_spAtk') {
    notes.push(`move '${id}': legacy effect "lower_spAtk" → "lower_atk" on the defender (§2.4: no Sp.Atk exists)`);
    return 'lower_atk';
  }
  if (!EFFECT_IDS.includes(effect as MoveEffect)) throw new Error(`unknown legacy effect ${effect} on ${id}`);
  return effect as MoveEffect;
}

function defaultEffectChance(effect: MoveEffect | null, power: number): number {
  switch (effect) {
    case 'lower_atk':
    case 'lower_def':
    case 'lower_spd':
    case 'lower_spAtk':
    case 'burn':
    case 'poison':
    case 'paralyze':
      return power === 0 ? 100 : 30;
    case 'freeze':
      return power === 0 ? 100 : 10;
    case 'flinch':
    case 'confuse':
      return 30;
    default:
      return 100;
  }
}

function targetFor(effect: MoveEffect | null, power: number): MoveTarget {
  if (effect === 'weather' || effect === 'sun') return 'field';
  if (
    power === 0 &&
    (effect === 'heal' || effect === 'raise_atk' || effect === 'raise_def' || effect === 'raise_spd' || effect === 'raise_all')
  ) {
    return 'self';
  }
  return 'foe';
}

const WEATHER_BY_TYPE: Readonly<Record<string, string>> = { Water: 'rain', Fire: 'sun', Ice: 'hail' };

function effectSentence(effect: MoveEffect | null, power: number, type: string, chance: number): string {
  const pct = power > 0 && chance < 100 ? ` (${chance}% chance)` : '';
  switch (effect) {
    case null: return '';
    case 'lower_atk': return ` Lowers the target's Attack by one stage${pct}.`;
    case 'lower_spAtk': return ` Lowers the target's Attack by one stage${pct}.`;
    case 'lower_def': return ` Lowers the target's Defense by one stage${pct}.`;
    case 'lower_spd': return ` Lowers the target's Speed by one stage${pct}.`;
    case 'raise_atk': return " Raises the user's Attack by one stage.";
    case 'raise_def': return " Raises the user's Defense by one stage.";
    case 'raise_spd': return " Raises the user's Speed by one stage.";
    case 'raise_all': return " Raises the user's Attack, Defense and Speed by one stage each.";
    case 'crit': return ' High critical-hit ratio.';
    case 'first': return ' Always strikes first.';
    case 'flinch': return ` May make the target flinch if the user moves first${pct}.`;
    case 'burn': return ` Burns the target${pct}.`;
    case 'poison': return ` Poisons the target${pct}.`;
    case 'paralyze': return ` Paralyzes the target${pct}.`;
    case 'freeze': return ` Freezes the target${pct}.`;
    case 'sleep': return ' Puts the target to sleep for 1–3 turns.';
    case 'confuse': return ` Confuses the target${pct}.`;
    case 'trap': return ' Traps the target for 4–5 turns; it takes damage each turn and cannot switch or flee.';
    case 'recoil': return ' The user takes a quarter of the damage dealt as recoil.';
    case 'drain': return ' The user recovers half the damage dealt.';
    case 'heal': return ' The user recovers half its maximum HP.';
    case 'weather': return ` Sets ${WEATHER_BY_TYPE[type] ?? 'sand'} weather for 5 turns.`;
    case 'sun': return ' Sets harsh sunlight for 5 turns.';
  }
}

function migrateMove(id: string, m: LegacyMove): MoveDef {
  const effect = migrateEffect(id, m.effect);
  const type = m.type as TypeName;
  const chance = defaultEffectChance(effect, m.power);
  const head = m.power > 0 ? `${type}-type attack, ${m.power} power` : `${type}-type status move`;
  const acc = m.accuracy === null || m.accuracy === undefined ? 'never misses' : `${m.accuracy}% accuracy`;
  return {
    id,
    type,
    power: m.power,
    pp: m.pp,
    accuracy: m.accuracy ?? null,
    priority: effect === 'first' ? 1 : 0,
    contact: m.power > 0 && !NON_CONTACT.includes(type),
    effect,
    effectChance: chance,
    target: targetFor(effect, m.power),
    description: `${head}; ${acc}; ${m.pp} PP.${effectSentence(effect, m.power, type, chance)}`,
  };
}

// ─── §2.3 species ───────────────────────────────────────────────────────────

/** story-bible.md §8.3 — the twelve sample entries in the recollection voice. */
const BIBLE_FLAVOR: Readonly<Record<string, string>> = {
  bramblecub:
    'The Held half-remembers a cub in the brambles: the weight of it, not yet its size. It precipitates on Mire Route where the hedge has never been cut. Wynn held the first one for a year before she gave it away.',
  briarbear:
    'The same memory, now sure of its shoulders. Nothing new was added; the Held simply stopped hesitating. It appears wild only where a bramblecub was witnessed growing — the Hollow, at level, never earlier.',
  thornback:
    'The cub made certain. Grass filed under Rock: a thing that was soft and is now unarguable. It does not precipitate wild. Someone had to be there while it made its mind up.',
  glimfin:
    'Water filed under Electric — a memory of a fish that carried a current, precipitated in the Tide shallows and the drowned basin at Saltmourn. It is steadier with a holder. Most things are.',
  cindercap:
    'The Held remembers a cap of embers on a stalk and is not sure whether it was a mushroom or a fire. Both. It is rare on Ash Route since the second draw, and the Office notes this without comment.',
  bloomsprite:
    'Grass filed under Fairy: the memory of something small opening in a hedge in spring. The rarest thing a new holder can meet, by day, on Mire Route. Four were drawn Yr 38. The Attestor holds the rest.',
  wraithtide:
    'Water filed under Ghost. It is the memory of a harbour that was never here, sitting on the stones of one. It precipitates in any black water at night because the Held has begun filing it under lost. Take it home.',
  darkone:
    'The Held remembers this one twice and cannot decide which. Watched drawing lightning, it becomes aonred; watched refusing to be lowered, darkyon. The only memory in Ewa certain of two things.',
  acier:
    'Steel filed under Fighting — the memory of a thing that was made, and then hit back. Rare in the engine-hulks on Siege Road; the Held did not remember many made things that fought for themselves.',
  voidraxis:
    'The memory of before there was anything to remember. Cosmic, because it is about the world and not in it; Dragon, because it was certain from the start. No one who saw its face has held it — until a record held it for them.',
  lumyth:
    'The first morning: the first time there was light to remember anything by. Cosmic and Psychic — the world, and the mind that noticed. It comes to be counted last, by the holder who has counted everything else.',
  noxmyth:
    'The first night: the dark there had to be for a morning to be first. Cosmic and Dark, and Dark here refuses nothing; it only came before. It comes to be counted at the shrine where it was first written down.',
};

function round3(x: number): number {
  return Math.max(3, Math.round(x / 3) * 3);
}

function migrateLearnset(
  id: string,
  moves: readonly string[],
  learnable: readonly string[],
  evolveAt: number | null,
  known: ReadonlySet<string>,
): LearnEntry[] {
  const out: LearnEntry[] = moves.map((move) => ({ move, level: 1 }));
  const rest: string[] = [];
  for (const m of learnable) {
    if (!known.has(m)) {
      notes.push(`species '${id}': learnable move '${m}' names no MOVES row — dropped`);
      continue;
    }
    if (moves.includes(m) || rest.includes(m)) continue;
    rest.push(m);
  }
  const hi = Math.min(evolveAt ?? 40, 60);
  for (let i = 0; i < rest.length; i++) {
    const level = rest.length === 1 ? round3(hi) : round3(5 + ((hi - 5) * i) / (rest.length - 1));
    out.push({ move: rest[i]!, level });
  }
  const order = (m: string): number => {
    const i = moves.indexOf(m);
    return i === -1 ? moves.length + rest.indexOf(m) : i;
  };
  out.sort((a, b) => a.level - b.level || order(a.move) - order(b.move));
  return out;
}

function migrateEvolution(s: LegacySpecies): Extract<Evolution, { kind: 'level' | 'split' }> | null {
  if (s.splitEvolvesInto != null) {
    const branches = s.splitEvolvesInto.map((b) => ({
      into: b.into,
      condition:
        b.condition === 'ability' && b.value !== undefined
          ? ({ kind: 'ability', ability: b.value } as const)
          : null,
    }));
    branches.sort((a, b) => (a.condition === null ? 1 : 0) - (b.condition === null ? 1 : 0));
    return { kind: 'split', atLevel: s.evolvesAt ?? 40, branches };
  }
  // legacy writes `evolvesInto: null` on 12 finals/singles: null and undefined both mean "no evolution"
  if (s.evolvesInto != null) return { kind: 'level', into: s.evolvesInto, atLevel: s.evolvesAt ?? 40 };
  return null;
}

/** parent map derived from evolvesInto/splitEvolvesInto — legacy `evolvesFrom` is missing on some mids (lithokrysm). */
function buildParentOf(all: Readonly<Record<string, LegacySpecies>>): Map<string, string> {
  const parentOf = new Map<string, string>();
  for (const id of Object.keys(all).sort()) {
    const s = all[id]!;
    if (s.evolvesInto != null) parentOf.set(s.evolvesInto, id);
    if (s.splitEvolvesInto != null) for (const b of s.splitEvolvesInto) parentOf.set(b.into, id);
  }
  return parentOf;
}

function clamp(id: string, field: string, v: number, lo: number, hi: number): number {
  const c = Math.min(hi, Math.max(lo, v));
  if (c !== v) notes.push(`species '${id}': ${field} ${v} clamped to ${c} (schema range ${lo}..${hi})`);
  return c;
}

function migrateSpecies(s: LegacySpecies, dexNumber: number, moveIds: ReadonlySet<string>, parentOf: ReadonlyMap<string, string>): SpeciesDef {
  // Phase D3: nine families evolve by stone / trade (src/data/evolutions.ts); the legacy level still spaces the learnset
  const legacyEvolution = migrateEvolution(s);
  const evolution: Evolution = STONE_AND_TRADE_EVOLUTIONS[s.id] ?? legacyEvolution;
  const evolvesFrom = parentOf.get(s.id) ?? null;
  if ((s.evolvesFrom ?? null) !== evolvesFrom) {
    notes.push(`species '${s.id}': evolvesFrom ${JSON.stringify(s.evolvesFrom ?? null)} in legacy, derived '${evolvesFrom}' from the parent's evolvesInto`);
  }
  const types = s.type as TypeName[];
  if (types.length < 1 || types.length > 2) throw new Error(`${s.id}: bad type count`);
  let rarity = s.rarity as Rarity | 'epic';
  if (rarity === 'epic') {
    notes.push(`species '${s.id}': rarity "epic" → "rare" (no epic Rarity in the spine)`);
    rarity = 'rare';
  }
  const moves = s.moves.slice(0, 4).filter((m) => {
    if (moveIds.has(m)) return true;
    notes.push(`species '${s.id}': default move '${m}' names no MOVES row — dropped`);
    return false;
  });
  if (moves.length === 0) throw new Error(`${s.id}: no known default move`);
  const bibleFlavor = BIBLE_FLAVOR[s.id];
  return {
    id: s.id,
    name: s.name,
    dexNumber,
    flavor: bibleFlavor ?? s.flavor,
    types: types.length === 1 ? [types[0]!] : [types[0]!, types[1]!],
    baseHp: s.baseHp,
    baseAtk: s.baseAtk,
    baseDef: s.baseDef,
    baseSpd: s.baseSpd,
    rarity,
    catchRate: clamp(s.id, 'catchRate', s.catchRate, 3, 255),
    sizeScale: clamp(s.id, 'sizeScale', s.sizeScale, 0.5, 2.2),
    expYield: s.expYield,
    moves,
    learnableMoves: migrateLearnset(s.id, moves, s.learnableMoves, legacyEvolution?.atLevel ?? null, moveIds),
    abilities: s.abilities,
    role: s.role as SpeciesRole,
    evolution,
    evolvesFrom,
    sprite: { front: `${s.id}_front`, back: `${s.id}_back` },
    legendary: s.rarity === 'legendary' || s.rarity === 'mythical',
    ...(s.battleForm !== undefined ? { battleForm: migrateBattleForm(s.id, s.battleForm) } : {}),
  };
}

/** sprite ids `<species>_<form>_front|back`: the sprite pipeline ships the form under the key `<species>_<form>`. */
function migrateBattleForm(speciesId: string, f: NonNullable<LegacySpecies['battleForm']>): BattleFormDef {
  return {
    id: f.id,
    name: f.name,
    hpBelowPct: f.hpBelowPct,
    baseAtk: f.baseAtk,
    baseDef: f.baseDef,
    baseSpd: f.baseSpd,
    onEnter: {
      clearNegativeStages: f.onEnter.clearNegativeStages,
      lowerFoes: f.onEnter.lowerFoes === null ? null : { stat: f.onEnter.lowerFoes.stat as StatKey, stages: f.onEnter.lowerFoes.stages },
    },
    sprite: { front: `${speciesId}_${f.id}_front`, back: `${speciesId}_${f.id}_back` },
  };
}

// ─── §2.5 abilities ─────────────────────────────────────────────────────────

const ABILITY_HOOKS: Readonly<Record<string, readonly AbilityHook[]>> = {
  'Chlorophyll': [{ kind: 'modifySpeed', whenWeather: 'sun', mul: 2 }],
  'Swift Swim': [{ kind: 'modifySpeed', whenWeather: 'rain', mul: 2 }],
  'Thick Fat': [{ kind: 'modifyDamage', side: 'defender', moveTypes: ['Fire', 'Ice'], mul: 0.5 }],
  'Lightning Rod': [{ kind: 'typeImmunity', moveType: 'Electric', reaction: { kind: 'raiseStat', stat: 'atk', stages: 1 } }],
  'Competitive': [{ kind: 'onStatLowered', raise: { stat: 'atk', stages: 2 } }],
  'Flame Body': [{ kind: 'onContact', reaction: { kind: 'inflictStatus', status: 'burn', chance: 30 } }],
  'Poison Spores': [{ kind: 'onContact', reaction: { kind: 'inflictStatus', status: 'poison', chance: 30 } }],
  'Rough Skin': [{ kind: 'onContact', reaction: { kind: 'damageFraction', fraction: 0.125 } }],
  'Water Absorb': [{ kind: 'typeImmunity', moveType: 'Water', reaction: { kind: 'heal', fraction: 0.25 } }],
  'Volt Absorb': [{ kind: 'typeImmunity', moveType: 'Electric', reaction: { kind: 'heal', fraction: 0.25 } }],
  'Flash Fire': [
    { kind: 'typeImmunity', moveType: 'Fire', reaction: { kind: 'flag', flag: 'flashFired' } },
    { kind: 'modifyDamage', side: 'attacker', moveTypes: ['Fire'], when: 'flashFired', mul: 1.5 },
  ],
  'Immunity': [{ kind: 'statusImmunity', statuses: ['poison'] }],
  'Speed Boost': [{ kind: 'endOfTurn', raise: { stat: 'spd', stages: 1 } }],
  'Intimidate': [{ kind: 'onSwitchIn', lowerFoe: { stat: 'atk', stages: 1 } }],
  'Wonder Guard': [{ kind: 'wonderGuard' }],
  'Regenerator': [{ kind: 'onSwitchOut', action: 'healFraction', fraction: 0.3333 }],
  'Keen Eye': [{ kind: 'stageLowerImmunity', stats: ['acc'] }],
  'Solid Rock': [{ kind: 'modifyDamage', side: 'defender', when: 'superEffective', mul: 0.75 }],
  'Natural Cure': [{ kind: 'onSwitchOut', action: 'cureStatus' }],
  'Sand Veil': [{ kind: 'modifyAccuracy', side: 'defender', whenWeather: 'sand', mul: 0.8 }],
  'Hustle': [
    { kind: 'modifyAttack', when: 'always', mul: 1.5 },
    { kind: 'modifyAccuracy', side: 'attacker', onlyDamaging: true, mul: 0.8 },
  ],
  'Guts': [{ kind: 'modifyAttack', when: 'statused', mul: 1.5 }],
  'Iron Barbs': [{ kind: 'onContact', reaction: { kind: 'damageFraction', fraction: 0.125 } }],
  'Levitate': [{ kind: 'typeImmunity', moveType: 'Ground', reaction: { kind: 'none' } }],
  'Void Sovereign': [{ kind: 'typeImmunity', moveType: 'Fairy', reaction: { kind: 'none' } }],
};

/** Descriptions rewritten where the spine changes the legacy semantics. */
const ABILITY_DESC: Readonly<Record<string, string>> = {
  'Intimidate': "Lowers the opponent's Attack by one stage on switch-in, once.",
  'Keen Eye': 'Its accuracy cannot be lowered.',
  'Sand Veil': 'Foes hit it less often in a sandstorm.',
  'Hustle': 'Boosts Attack by 50% but lowers the accuracy of damaging moves by 20%.',
  'Regenerator': 'Restores a third of its HP when switched out.',
  'Natural Cure': 'Cures major status conditions when switched out.',
  'Lightning Rod': 'Immune to Electric moves; raises Attack by one stage when hit by one.',
  'Competitive': 'Raises Attack by two stages when a foe lowers one of its stats.',
};

// ─── §2.6 items ─────────────────────────────────────────────────────────────

interface HeldRow {
  hooks: readonly HeldItemHook[];
  price: number | null;
  slot?: 'key';
  fieldVerb?: 'surf' | 'cut' | 'strength';
  desc?: string;
}
const HELD: Readonly<Record<string, HeldRow>> = {
  'Assault Vest': {
    hooks: [{ kind: 'statMul', stat: 'def', mul: 1.25 }, { kind: 'noStatusMoves' }],
    price: 4500,
    desc: '+25% Defense (there is no Sp.Def in this game); the holder cannot use status moves.',
  },
  'Choice Band': { hooks: [{ kind: 'statMul', stat: 'atk', mul: 1.25 }, { kind: 'choiceLock' }], price: 5000 },
  'Choice Scarf': { hooks: [{ kind: 'statMul', stat: 'spd', mul: 1.25 }, { kind: 'choiceLock' }], price: 5000 },
  'Choice Specs': {
    hooks: [{ kind: 'statMul', stat: 'atk', mul: 1.25 }, { kind: 'choiceLock' }],
    price: 5000,
    desc: '+25% Attack (there is no Sp.Atk in this game; identical to Choice Band), locked to one move.',
  },
  'Eviolite': {
    hooks: [{ kind: 'statMul', stat: 'def', mul: 1.5, unevolvedOnly: true }],
    price: 5000,
    desc: '+50% Defense for a species that can still evolve.',
  },
  'Heavy Duty Boots': { hooks: [{ kind: 'hazardImmunity' }], price: 4000, desc: 'Negates entry hazard damage. No hazards exist yet; this item does nothing.' },
  'Sitrus Berry': { hooks: [{ kind: 'berry', belowFraction: 0.5, heal: { kind: 'fraction', value: 0.25 } }], price: 2000 },
  'Oran Berry': { hooks: [{ kind: 'berry', belowFraction: 0.25, heal: { kind: 'flat', value: 10 } }], price: 1500 },
  'Charcoal': { hooks: [{ kind: 'typeBoost', type: 'Fire', mul: 1.2 }], price: 3000 },
  'Mystic Water': { hooks: [{ kind: 'typeBoost', type: 'Water', mul: 1.2 }], price: 3000 },
  'Mirrorcoat': { hooks: [{ kind: 'typeBoost', type: 'Psychic', mul: 1.2 }], price: 3000 },
  'Black Sludge': { hooks: [{ kind: 'typeBoost', type: 'Poison', mul: 1.2 }], price: 3000 },
  'Weakness Policy': {
    hooks: [{ kind: 'onSuperEffectiveHit', raise: { stat: 'atk', stages: 2 }, consume: true }],
    price: null,
    desc: '+2 Attack when hit by a super-effective move, then consumed.',
  },
  'Speed Scarf': { hooks: [{ kind: 'statMul', stat: 'spd', mul: 1.1 }], price: 3500 },
  'HM Surf': { hooks: [], price: null, slot: 'key', fieldVerb: 'surf' },
  'HM Cut': { hooks: [], price: null, slot: 'key', fieldVerb: 'cut' },
  'HM Strength': { hooks: [], price: null, slot: 'key', fieldVerb: 'strength' },
};

// ─── §2.6 consumables (effects from the spine table; name/desc/price/sellPrice/maxStack parsed from shop.js) ──

const CONSUMABLE_EFFECTS: Readonly<Record<string, { effect: ConsumableEffect; battle: boolean }>> = {
  potion: { effect: { kind: 'healHp', amount: 20 }, battle: true },
  superpotion: { effect: { kind: 'healHp', amount: 50 }, battle: true },
  hyper_potion: { effect: { kind: 'healHp', amount: 100 }, battle: true },
  max_potion: { effect: { kind: 'healHp', amount: 'full' }, battle: true },
  full_restore: { effect: { kind: 'fullRestore' }, battle: true },
  revive: { effect: { kind: 'revive', fraction: 0.5 }, battle: true },
  max_revive: { effect: { kind: 'revive', fraction: 1 }, battle: true },
  antidote: { effect: { kind: 'cureStatus', statuses: ['poison'] }, battle: true },
  burn_heal: { effect: { kind: 'cureStatus', statuses: ['burn'] }, battle: true },
  ice_heal: { effect: { kind: 'cureStatus', statuses: ['freeze'] }, battle: true },
  awakening: { effect: { kind: 'cureStatus', statuses: ['sleep'] }, battle: true },
  paralyze_heal: { effect: { kind: 'cureStatus', statuses: ['paralyze'] }, battle: true },
  full_heal: { effect: { kind: 'cureStatus', statuses: 'all' }, battle: true },
  elixir: { effect: { kind: 'restorePp', amount: 10 }, battle: false },
  max_ether: { effect: { kind: 'restorePp', amount: 'full' }, battle: false },
  rarecandy: { effect: { kind: 'rareCandy' }, battle: false },
  repel: { effect: { kind: 'repel', steps: 50 }, battle: false },
  lure: { effect: { kind: 'lure', steps: 30 }, battle: false },
  escape_rope: { effect: { kind: 'escapeRope' }, battle: true },
  nugget: { effect: { kind: 'sellOnly' }, battle: false },
  big_nugget: { effect: { kind: 'sellOnly' }, battle: false },
  stardust: { effect: { kind: 'sellOnly' }, battle: false },
  star_piece: { effect: { kind: 'sellOnly' }, battle: false },
};

interface ShopRow { name: string; desc: string; price: number; sellPrice: number; maxStack: number }

function parseShopItems(): Map<string, ShopRow> {
  const src = readFileSync(resolve(LEGACY_DIR, 'shop.js'), 'utf8');
  const out = new Map<string, ShopRow>();
  const re =
    /^\s*([a-z_]+):\s*\{\s*name:\s*"([^"]+)",[^\n]*?desc:\s*"([^"]+)",\s*price:\s*(\d+),\s*sellPrice:\s*(\d+),\s*maxStack:\s*(\d+)/gm;
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    out.set(m[1]!, { name: m[2]!, desc: m[3]!, price: Number(m[4]), sellPrice: Number(m[5]), maxStack: Number(m[6]) });
  }
  return out;
}

// ─── §3.9 battle pass (legacy battlePass.js, dependency-free CommonJS) ────────

interface LegacyBpRow {
  type?: string;
  money: number;
  items?: Record<string, number>;
  label: string;
  rarity: string;
  choices?: string[];
  ewamon?: { speciesId: string; level: number };
}

interface BattlePassRow {
  level: number;
  label: string;
  rarity: string;
  money: number;
  items: Record<string, number>;
  creature: { species: string; level: number } | null;
  mythicalChoice: string[] | null;
}

function loadBattlePass(): BattlePassRow[] {
  const src = readFileSync(resolve(LEGACY_DIR, 'battlePass.js'), 'utf8');
  const mod: { exports: { BATTLE_PASS_REWARDS?: (LegacyBpRow | null)[] } } = { exports: {} };
  const fn = new Function('module', 'exports', src) as (m: typeof mod, e: unknown) => void;
  fn(mod, mod.exports);
  const rows = mod.exports.BATTLE_PASS_REWARDS;
  if (rows === undefined || rows.length !== 101) throw new Error('battlePass.js: expected 101 entries (index 0 unused)');
  const out: BattlePassRow[] = [];
  for (let level = 1; level <= 100; level++) {
    const r = rows[level];
    if (r === null || r === undefined) throw new Error(`battlePass.js: missing level ${level}`);
    const items: Record<string, number> = {};
    for (const k of Object.keys(r.items ?? {}).sort()) items[k] = r.items![k]!;
    out.push({
      level,
      label: r.label,
      rarity: r.rarity,
      money: r.money,
      items,
      creature: r.ewamon ? { species: r.ewamon.speciesId, level: r.ewamon.level } : null,
      mythicalChoice: r.choices ? [...r.choices] : null,
    });
  }
  return out;
}

// ─── serialiser (deterministic, single-quoted, prettier-shaped) ──────────────

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function str(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function ser(v: unknown, indent: string): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return str(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    const inner = indent + '  ';
    const items = v.map((x) => ser(x, inner));
    const flat = `[${items.join(', ')}]`;
    if (flat.length + indent.length <= 100 && !flat.includes('\n')) return flat;
    return `[\n${items.map((s) => inner + s).join(',\n')},\n${indent}]`;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined);
    if (keys.length === 0) return '{}';
    const inner = indent + '  ';
    const items = keys.map((k) => `${IDENT.test(k) ? k : str(k)}: ${ser(o[k], inner)}`);
    const flat = `{ ${items.join(', ')} }`;
    if (flat.length + indent.length <= 100 && !flat.includes('\n')) return flat;
    return `{\n${items.map((s) => inner + s).join(',\n')},\n${indent}}`;
  }
  throw new Error(`cannot serialise ${String(v)}`);
}

function header(what: string, extra: readonly string[]): string {
  const lines = [
    `// GENERATED — edit the generator (packages/content/scripts/migrate-legacy.ts), not this file.`,
    `// Source: .design/legacy/ewamon.js${what === 'consumables' ? ' + shop.js' : ''}${what === 'species' ? ' + .design/additions/species.js' : ''}. Regenerate with \`pnpm --filter @ewa/content run migrate\`.`,
    ...extra.map((l) => `// ${l}`),
  ];
  return lines.join('\n') + '\n';
}

function emit(file: string, body: string): void {
  writeFileSync(resolve(OUT_DIR, file), body.endsWith('\n') ? body : body + '\n', 'utf8');
  console.log(`wrote src/data/${file}`);
}

// ─── main ───────────────────────────────────────────────────────────────────

function main(): void {
  const legacy = loadLegacy();
  mkdirSync(OUT_DIR, { recursive: true });

  // moves
  const moveIds = Object.keys(legacy.MOVES).sort();
  const moves: MoveDef[] = moveIds.map((id) => migrateMove(id, legacy.MOVES[id]!));
  const moveSet = new Set(moveIds);

  // species (legacy insertion order = dex order)
  const speciesIds = Object.keys(legacy.EWAMON_SPECIES);
  const parentOf = buildParentOf(legacy.EWAMON_SPECIES);
  const species: SpeciesDef[] = speciesIds.map((id, i) => migrateSpecies(legacy.EWAMON_SPECIES[id]!, i + 1, moveSet, parentOf));

  // abilities
  const abilityIds = Object.keys(legacy.ABILITIES).sort();
  const abilities: AbilityDef[] = abilityIds.map((id) => {
    const hooks = ABILITY_HOOKS[id];
    if (hooks === undefined) throw new Error(`no §2.5 hook row for legacy ability ${id}`);
    return { id, name: legacy.ABILITIES[id]!.name, description: ABILITY_DESC[id] ?? legacy.ABILITIES[id]!.desc, hooks };
  });

  // items
  const itemIds = Object.keys(legacy.ITEMS).sort();
  const items: ItemDef[] = itemIds.map((id) => {
    const row = HELD[id];
    if (row === undefined) throw new Error(`no §2.6 row for legacy item ${id}`);
    return {
      id,
      name: legacy.ITEMS[id]!.name,
      description: row.desc ?? legacy.ITEMS[id]!.desc,
      slot: row.slot ?? 'held',
      fieldVerb: row.fieldVerb ?? null,
      hooks: row.hooks,
      price: row.price,
    };
  });

  // orbs
  const orbIds = Object.keys(legacy.ORBS).sort();
  const orbs: OrbDef[] = orbIds.map((id) => {
    const o = legacy.ORBS[id]!;
    const bonus: OrbDef['bonus'] =
      o.bonus === undefined
        ? null
        : o.bonus.kind === 'type'
          ? { kind: 'type', type: o.bonus.type as TypeName, multiplier: o.bonus.multiplier }
          : { kind: 'alpha_or_variant', multiplier: o.bonus.multiplier };
    return {
      id,
      name: o.name,
      description: o.desc,
      catchRate: o.catchRate,
      bonus,
      price: o.price,
      sellPrice: o.sellPrice,
      maxStack: o.maxStack,
      rarity: o.rarity as Rarity,
    };
  });

  // consumables
  const shop = parseShopItems();
  const consumableIds = Object.keys(CONSUMABLE_EFFECTS).sort();
  const consumables: ConsumableDef[] = consumableIds.map((id) => {
    const row = shop.get(id);
    if (row === undefined) throw new Error(`shop.js has no SHOP_ITEMS row for consumable ${id}`);
    const eff = CONSUMABLE_EFFECTS[id]!;
    return {
      id,
      name: row.name,
      description: row.desc,
      effect: eff.effect,
      usableInBattle: eff.battle,
      price: row.price,
      sellPrice: Math.floor(row.price / 2),
      maxStack: row.maxStack,
    };
  });
  for (const id of shop.keys()) {
    if (!(id in CONSUMABLE_EFFECTS) && !(id in legacy.ORBS)) notes.push(`shop.js item '${id}' has no spine consumable row — not carried`);
  }

  // type chart
  const chart: Record<string, Record<string, number>> = {};
  for (const atk of Object.keys(legacy.TYPE_CHART).sort()) {
    const row = legacy.TYPE_CHART[atk]!;
    const sorted: Record<string, number> = {};
    for (const def of Object.keys(row).sort()) sorted[def] = row[def]!;
    chart[atk] = sorted;
  }
  for (const t of ['Normal','Fire','Water','Grass','Electric','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Steel','Fairy','Dark','Cosmic']) {
    if (!(t in chart)) chart[t] = {};
  }
  const typeChart = chart as unknown as TypeChart;

  // ── emit ──
  const speciesNotes = notes.filter((n) => n.startsWith('species'));
  const moveNotes = notes.filter((n) => n.startsWith('move'));
  const shopNotes = notes.filter((n) => n.startsWith('shop'));

  emit(
    'species.ts',
    header('species', [
      'dexNumber = legacy insertion order. learnableMoves: defaults at 1, the rest evenly spaced 5..min(evolvesAt ?? 40, 60), ×3-rounded (§2.3).',
      ...speciesNotes,
    ]) +
      `import type { SpeciesDef } from '@ewa/core';\n\nexport const SPECIES: readonly SpeciesDef[] = ${ser(species, '')};\n`,
  );
  emit(
    'moves.ts',
    header('moves', [
      'priority 1 iff legacy effect "first"; contact = power > 0 && type ∉ {Fire,Water,Grass,Electric,Ice,Psychic,Ghost,Cosmic,Fairy} (§2.4).',
      'effectChance defaults: lower_*/burn/poison/paralyze 100 (power 0) / 30; freeze 100 / 10; flinch/confuse 30; else 100.',
      ...moveNotes,
    ]) + `import type { MoveDef } from '@ewa/core';\n\nexport const MOVES: readonly MoveDef[] = ${ser(moves, '')};\n`,
  );
  emit(
    'abilities.ts',
    header('abilities', ['Hooks are the 25 §2.5 rows; descriptions rewritten where the spine changed the legacy semantics.']) +
      `import type { AbilityDef } from '@ewa/core';\n\nexport const ABILITIES: readonly AbilityDef[] = ${ser(abilities, '')};\n`,
  );
  emit(
    'items.ts',
    header('items', ['The 17 held/key items of §2.6 with their hooks; prices from legacy shop.js HELD_ITEMS_SHOP (null = not sold).']) +
      `import type { ItemDef } from '@ewa/core';\n\nexport const ITEMS: readonly ItemDef[] = ${ser(items, '')};\n`,
  );
  emit(
    'orbs.ts',
    header('orbs', ['The 10 legacy orbs verbatim; legacy ball aliases are not carried (§2.6).']) +
      `import type { OrbDef } from '@ewa/core';\n\nexport const ORBS: readonly OrbDef[] = ${ser(orbs, '')};\n`,
  );
  emit(
    'consumables.ts',
    header('consumables', [
      'Effects from the §2.6 table; name/description/price/maxStack from legacy shop.js SHOP_ITEMS; sellPrice = floor(price / 2).',
      ...shopNotes,
    ]) +
      `import type { ConsumableDef } from '@ewa/core';\n\nexport const CONSUMABLES: readonly ConsumableDef[] = ${ser(consumables, '')};\n`,
  );
  emit(
    'typechart.ts',
    header('typechart', ['chart[attacking][defending] = 0 | 0.5 | 2; missing = 1. Keys sorted.']) +
      `import type { TypeChart } from '@ewa/core';\n\nexport const TYPE_CHART: TypeChart = ${ser(typeChart, '')};\n`,
  );

  // battle pass (legacy battlePass.js: 100 rows; index 0 unused)
  const bp = loadBattlePass();
  emit(
    'battlePass.ts',
    header('battlePass', [
      'Source: .design/legacy/battlePass.js BATTLE_PASS_REWARDS[1..100]. level 50 → mythicalChoice; level 100 → creature zenryu L100',
      '(legacy variantKey/isAlpha on that row have no field in §3.9 BattlePassReward and are dropped — see IMPLEMENTATION-NOTES).',
    ]) +
      `import type { BattlePassReward } from '../types';\n\nexport const BATTLE_PASS: readonly BattlePassReward[] = ${ser(bp, '')};\n`,
  );

  console.log(`species ${species.length} · moves ${moves.length} · abilities ${abilities.length} · items ${items.length} · orbs ${orbs.length} · consumables ${consumables.length} · battle pass ${bp.length}`);
  if (notes.length > 0) {
    console.log(`notes (${notes.length}):`);
    for (const n of notes) console.log(`  - ${n}`);
  }
}

main();
