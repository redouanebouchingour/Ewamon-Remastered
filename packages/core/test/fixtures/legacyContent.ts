/**
 * Test fixture: a ContentIndex built from the legacy data in .design/legacy/ewamon.js, migrated to the §2
 * definitions (dex numbers, learn levels, effect rewrites, ability/item hooks, consumables). This is NOT
 * @ewa/content — it exists so core's tests can run against the real 130 species / 193 moves.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  AbilityDef,
  AbilityHook,
  ConsumableDef,
  ConsumableEffect,
  ContentIndex,
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
  TypeChart,
  TypeName,
} from '../../src/index';

// ─── legacy shapes (only the fields we read) ────────────────────────────────

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

const LEGACY_PATH = fileURLToPath(new URL('../../../../.design/legacy/ewamon.js', import.meta.url));

/**
 * ewamon.js is a dependency-free CommonJS module, but the workspace root is `"type": "module"`, so
 * `createRequire(...)(path)` parses it as ESM and fails on `module.exports`. Evaluate it in a CJS-shaped
 * wrapper instead; it is data with a few pure helpers and no `require` calls.
 */
export function loadLegacy(): LegacyModule {
  const src = readFileSync(LEGACY_PATH, 'utf8');
  const mod: { exports: Partial<LegacyModule> } = { exports: {} };
  const fn = new Function('module', 'exports', src) as (m: typeof mod, e: unknown) => void;
  fn(mod, mod.exports);
  return mod.exports as LegacyModule;
}

// ─── §2.4 move migration ────────────────────────────────────────────────────

const NON_CONTACT: readonly string[] = ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Psychic', 'Ghost', 'Cosmic', 'Fairy'];

const EFFECT_IDS: readonly MoveEffect[] = [
  'lower_atk', 'first', 'paralyze', 'flinch', 'crit', 'confuse', 'poison', 'raise_def', 'burn', 'recoil',
  'lower_def', 'drain', 'heal', 'sun', 'lower_spd', 'freeze', 'raise_all', 'trap', 'weather', 'sleep',
  'lower_spAtk', 'raise_atk', 'raise_spd',
];

function migrateEffect(effect: string | null): MoveEffect | null {
  if (effect === null) return null;
  if (effect === 'weaknessPolicy') return null; // held-item key leaking into a move: content sets null
  if (effect === 'lower_spAtk') return 'lower_atk'; // no Sp.Atk in this game: rewritten on the defender
  if (EFFECT_IDS.indexOf(effect as MoveEffect) === -1) throw new Error(`unknown legacy effect ${effect}`);
  return effect as MoveEffect;
}

/** Default chance from the §2.4 table. */
export function defaultEffectChance(effect: MoveEffect | null, power: number): number {
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
  if (power === 0 && (effect === 'heal' || effect === 'raise_atk' || effect === 'raise_def' || effect === 'raise_spd' || effect === 'raise_all')) {
    return 'self';
  }
  return 'foe';
}

export function migrateMove(id: string, m: LegacyMove): MoveDef {
  const effect = migrateEffect(m.effect);
  const type = m.type as TypeName;
  return {
    id,
    type,
    power: m.power,
    pp: m.pp,
    accuracy: m.accuracy,
    priority: effect === 'first' ? 1 : 0,
    contact: m.power > 0 && NON_CONTACT.indexOf(type) === -1,
    effect,
    effectChance: defaultEffectChance(effect, m.power),
    target: targetFor(effect, m.power),
    description: '',
  };
}

// ─── §2.3 species migration ─────────────────────────────────────────────────

function round3(x: number): number {
  return Math.max(3, Math.round(x / 3) * 3);
}

/** Default moves at level 1; the rest spaced evenly between 5 and min(evolveAt ?? 40, 60), rounded to a multiple of 3. */
export function migrateLearnset(moves: readonly string[], learnable: readonly string[], evolveAt: number | null): LearnEntry[] {
  const out: LearnEntry[] = moves.map((move) => ({ move, level: 1 }));
  const rest: string[] = [];
  for (const m of learnable) if (moves.indexOf(m) === -1 && rest.indexOf(m) === -1) rest.push(m);
  const hi = Math.min(evolveAt ?? 40, 60);
  for (let i = 0; i < rest.length; i++) {
    const level = rest.length === 1 ? round3(hi) : round3(5 + ((hi - 5) * i) / (rest.length - 1));
    out.push({ move: rest[i]!, level });
  }
  out.sort((a, b) => a.level - b.level || moves.indexOf(a.move) - moves.indexOf(b.move));
  return out;
}

function migrateEvolution(s: LegacySpecies): Evolution {
  if (s.splitEvolvesInto !== undefined) {
    const branches = s.splitEvolvesInto.map((b) => ({
      into: b.into,
      condition: b.condition === 'ability' && b.value !== undefined ? ({ kind: 'ability', ability: b.value } as const) : null,
    }));
    // the default (condition null) branch must be last
    branches.sort((a, b) => (a.condition === null ? 1 : 0) - (b.condition === null ? 1 : 0));
    return { kind: 'split', atLevel: s.evolvesAt ?? 40, branches };
  }
  if (s.evolvesInto !== undefined) return { kind: 'level', into: s.evolvesInto, atLevel: s.evolvesAt ?? 40 };
  return null;
}

export function migrateSpecies(s: LegacySpecies, dexNumber: number): SpeciesDef {
  const evolution = migrateEvolution(s);
  const types = s.type as TypeName[];
  if (types.length < 1 || types.length > 2) throw new Error(`${s.id}: bad type count`);
  return {
    id: s.id,
    name: s.name,
    dexNumber,
    flavor: s.flavor,
    types: types.length === 1 ? [types[0]!] : [types[0]!, types[1]!],
    baseHp: s.baseHp,
    baseAtk: s.baseAtk,
    baseDef: s.baseDef,
    baseSpd: s.baseSpd,
    rarity: s.rarity as Rarity,
    catchRate: s.catchRate,
    heightM: 1,                 // no core test reads it (the renderer and the dex do)
    expYield: s.expYield,
    moves: s.moves.slice(0, 4),
    learnableMoves: migrateLearnset(s.moves.slice(0, 4), s.learnableMoves, evolution === null ? null : evolution.atLevel),
    abilities: s.abilities,
    role: s.role as SpeciesRole,
    evolution,
    evolvesFrom: s.evolvesFrom ?? null,
    sprite: { front: `${s.id}_front`, back: `${s.id}_back` },
    legendary: s.rarity === 'legendary' || s.rarity === 'mythical',
  };
}

// ─── §2.5 the 25 ability rows ───────────────────────────────────────────────

export const ABILITY_HOOKS: Readonly<Record<string, readonly AbilityHook[]>> = {
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

// ─── §2.6 the 17 held/key items ─────────────────────────────────────────────

const HELD: Readonly<Record<string, { hooks: readonly HeldItemHook[]; price: number | null; slot?: 'key'; fieldVerb?: 'surf' | 'cut' | 'strength' }>> = {
  'Assault Vest': { hooks: [{ kind: 'statMul', stat: 'def', mul: 1.25 }, { kind: 'noStatusMoves' }], price: 4500 },
  'Choice Band': { hooks: [{ kind: 'statMul', stat: 'atk', mul: 1.25 }, { kind: 'choiceLock' }], price: 5000 },
  'Choice Scarf': { hooks: [{ kind: 'statMul', stat: 'spd', mul: 1.25 }, { kind: 'choiceLock' }], price: 5000 },
  'Choice Specs': { hooks: [{ kind: 'statMul', stat: 'atk', mul: 1.25 }, { kind: 'choiceLock' }], price: 5000 },
  'Eviolite': { hooks: [{ kind: 'statMul', stat: 'def', mul: 1.5, unevolvedOnly: true }], price: 5000 },
  'Heavy Duty Boots': { hooks: [{ kind: 'hazardImmunity' }], price: 4000 },
  'Sitrus Berry': { hooks: [{ kind: 'berry', belowFraction: 0.5, heal: { kind: 'fraction', value: 0.25 } }], price: 2000 },
  'Oran Berry': { hooks: [{ kind: 'berry', belowFraction: 0.25, heal: { kind: 'flat', value: 10 } }], price: 1500 },
  'Charcoal': { hooks: [{ kind: 'typeBoost', type: 'Fire', mul: 1.2 }], price: 3000 },
  'Mystic Water': { hooks: [{ kind: 'typeBoost', type: 'Water', mul: 1.2 }], price: 3000 },
  'Mirrorcoat': { hooks: [{ kind: 'typeBoost', type: 'Psychic', mul: 1.2 }], price: 3000 },
  'Black Sludge': { hooks: [{ kind: 'typeBoost', type: 'Poison', mul: 1.2 }], price: 3000 },
  'Weakness Policy': { hooks: [{ kind: 'onSuperEffectiveHit', raise: { stat: 'atk', stages: 2 }, consume: true }], price: null },
  'Speed Scarf': { hooks: [{ kind: 'statMul', stat: 'spd', mul: 1.1 }], price: 3500 },
  'HM Surf': { hooks: [], price: null, slot: 'key', fieldVerb: 'surf' },
  'HM Cut': { hooks: [], price: null, slot: 'key', fieldVerb: 'cut' },
  'HM Strength': { hooks: [], price: null, slot: 'key', fieldVerb: 'strength' },
};

// ─── §2.6 consumables (prices from legacy shop.js) ──────────────────────────

interface ConsumableRow {
  readonly name: string;
  readonly effect: ConsumableEffect;
  readonly battle: boolean;
  readonly price: number;
}

export const CONSUMABLES: Readonly<Record<string, ConsumableRow>> = {
  potion: { name: 'Potion', effect: { kind: 'healHp', amount: 20 }, battle: true, price: 150 },
  superpotion: { name: 'Super Potion', effect: { kind: 'healHp', amount: 50 }, battle: true, price: 400 },
  hyper_potion: { name: 'Hyper Potion', effect: { kind: 'healHp', amount: 100 }, battle: true, price: 900 },
  max_potion: { name: 'Max Potion', effect: { kind: 'healHp', amount: 'full' }, battle: true, price: 800 },
  full_restore: { name: 'Full Restore', effect: { kind: 'fullRestore' }, battle: true, price: 1800 },
  revive: { name: 'Revive', effect: { kind: 'revive', fraction: 0.5 }, battle: true, price: 800 },
  max_revive: { name: 'Max Revive', effect: { kind: 'revive', fraction: 1 }, battle: true, price: 2000 },
  antidote: { name: 'Antidote', effect: { kind: 'cureStatus', statuses: ['poison'] }, battle: true, price: 100 },
  burn_heal: { name: 'Burn Heal', effect: { kind: 'cureStatus', statuses: ['burn'] }, battle: true, price: 150 },
  ice_heal: { name: 'Ice Heal', effect: { kind: 'cureStatus', statuses: ['freeze'] }, battle: true, price: 150 },
  awakening: { name: 'Awakening', effect: { kind: 'cureStatus', statuses: ['sleep'] }, battle: true, price: 100 },
  paralyze_heal: { name: 'Paralyze Heal', effect: { kind: 'cureStatus', statuses: ['paralyze'] }, battle: true, price: 100 },
  full_heal: { name: 'Full Heal', effect: { kind: 'cureStatus', statuses: 'all' }, battle: true, price: 300 },
  elixir: { name: 'Elixir', effect: { kind: 'restorePp', amount: 10 }, battle: false, price: 800 },
  max_ether: { name: 'Max Ether', effect: { kind: 'restorePp', amount: 'full' }, battle: false, price: 1500 },
  rarecandy: { name: 'Rare Candy', effect: { kind: 'rareCandy' }, battle: false, price: 2500 },
  repel: { name: 'Repel', effect: { kind: 'repel', steps: 50 }, battle: false, price: 500 },
  lure: { name: 'Lure', effect: { kind: 'lure', steps: 30 }, battle: false, price: 400 },
  escape_rope: { name: 'Escape Rope', effect: { kind: 'escapeRope' }, battle: true, price: 550 },
  nugget: { name: 'Nugget', effect: { kind: 'sellOnly' }, battle: false, price: 10000 },
  big_nugget: { name: 'Big Nugget', effect: { kind: 'sellOnly' }, battle: false, price: 40000 },
  stardust: { name: 'Stardust', effect: { kind: 'sellOnly' }, battle: false, price: 1000 },
  star_piece: { name: 'Star Piece', effect: { kind: 'sellOnly' }, battle: false, price: 4000 },
};

// ─── the index ──────────────────────────────────────────────────────────────

export interface LegacyContent extends ContentIndex {
  readonly speciesIds: readonly string[];
  readonly moveIds: readonly string[];
  readonly abilityIds: readonly string[];
  readonly itemIds: readonly string[];
  readonly orbIds: readonly string[];
  /** Species→move references in legacy that name no move; dropped from the migrated species. */
  readonly unknownMoves: readonly { readonly species: string; readonly move: string }[];
  /** Register (or replace) a move for a test scenario. */
  withMove(m: MoveDef): LegacyContent;
  /** Register (or replace) a species for a test scenario. */
  withSpecies(s: SpeciesDef): LegacyContent;
  /** Register (or replace) an ability for a test scenario. */
  withAbility(a: AbilityDef): LegacyContent;
  /** Register (or replace) a held item for a test scenario. */
  withItem(i: ItemDef): LegacyContent;
}

/** Builds a FRESH ContentIndex from the legacy module every call (the determinism test needs two independent instances). */
export function buildLegacyContent(): LegacyContent {
  const legacy = loadLegacy();

  const species = new Map<string, SpeciesDef>();
  const speciesIds = Object.keys(legacy.EWAMON_SPECIES); // insertion order = dex order
  speciesIds.forEach((id, i) => species.set(id, migrateSpecies(legacy.EWAMON_SPECIES[id]!, i + 1)));

  const moves = new Map<string, MoveDef>();
  const moveIds = Object.keys(legacy.MOVES).sort();
  for (const id of moveIds) moves.set(id, migrateMove(id, legacy.MOVES[id]!));

  const abilities = new Map<string, AbilityDef>();
  const abilityIds = Object.keys(legacy.ABILITIES).sort();
  for (const id of abilityIds) {
    const hooks = ABILITY_HOOKS[id];
    if (hooks === undefined) throw new Error(`no §2.5 hook row for legacy ability ${id}`);
    abilities.set(id, { id, name: legacy.ABILITIES[id]!.name, description: legacy.ABILITIES[id]!.desc, hooks });
  }

  const items = new Map<string, ItemDef | ConsumableDef>();
  const heldIds = Object.keys(legacy.ITEMS).sort();
  for (const id of heldIds) {
    const row = HELD[id];
    if (row === undefined) throw new Error(`no §2.6 row for legacy item ${id}`);
    items.set(id, {
      id,
      name: legacy.ITEMS[id]!.name,
      description: legacy.ITEMS[id]!.desc,
      slot: row.slot ?? 'held',
      fieldVerb: row.fieldVerb ?? null,
      hooks: row.hooks,
      price: row.price,
    });
  }
  const consumableIds = Object.keys(CONSUMABLES).sort();
  for (const id of consumableIds) {
    const c = CONSUMABLES[id]!;
    items.set(id, {
      id,
      name: c.name,
      description: '',
      effect: c.effect,
      usableInBattle: c.battle,
      price: c.price,
      sellPrice: Math.floor(c.price / 2),
      maxStack: 99,
    });
  }

  const orbs = new Map<string, OrbDef>();
  const orbIds = Object.keys(legacy.ORBS).sort();
  for (const id of orbIds) {
    const o = legacy.ORBS[id]!;
    let bonus: OrbDef['bonus'] = null;
    if (o.bonus !== undefined) {
      bonus =
        o.bonus.kind === 'type'
          ? { kind: 'type', type: o.bonus.type as TypeName, multiplier: o.bonus.multiplier }
          : { kind: 'alpha_or_variant', multiplier: o.bonus.multiplier };
    }
    orbs.set(id, {
      id,
      name: o.name,
      description: o.desc,
      catchRate: o.catchRate,
      bonus,
      price: o.price,
      sellPrice: o.sellPrice,
      maxStack: o.maxStack,
      rarity: o.rarity as Rarity,
    });
  }

  const typeChart = legacy.TYPE_CHART as unknown as TypeChart;

  // Legacy references moves that do not exist (`archonosis` → 'Abyssal Nova'); @ewa/content's validate.ts
  // would reject them. The fixture drops them and records what it dropped so a test can pin the count.
  const unknownMoves: { species: string; move: string }[] = [];
  for (const id of speciesIds) {
    const sp = species.get(id)!;
    const okMoves = sp.moves.filter((m) => moves.has(m));
    const okLearn = sp.learnableMoves.filter((e) => moves.has(e.move));
    for (const m of sp.moves) if (!moves.has(m)) unknownMoves.push({ species: id, move: m });
    if (okMoves.length !== sp.moves.length || okLearn.length !== sp.learnableMoves.length) {
      species.set(id, { ...sp, moves: okMoves, learnableMoves: okLearn });
    }
    if (okMoves.length === 0) throw new Error(`${id}: no known default move`);
    for (const a of sp.abilities) if (!abilities.has(a)) throw new Error(`${id}: unknown ability ${a}`);
  }

  const get = <T>(map: Map<string, T>, kind: string, id: string): T => {
    const v = map.get(id);
    if (v === undefined) throw new RangeError(`unknown ${kind} '${id}'`);
    return v;
  };

  const index: LegacyContent = {
    species: (id) => get(species, 'species', id),
    move: (id) => get(moves, 'move', id),
    ability: (id) => get(abilities, 'ability', id),
    item: (id) => get(items, 'item', id),
    orb: (id) => get(orbs, 'orb', id),
    typeChart,
    allSpecies: () => [...species.values()].sort((a, b) => a.dexNumber - b.dexNumber),
    speciesIds,
    moveIds,
    abilityIds,
    itemIds: [...heldIds, ...consumableIds],
    orbIds,
    unknownMoves,
    withMove(m) {
      moves.set(m.id, m);
      return index;
    },
    withSpecies(s) {
      species.set(s.id, s);
      return index;
    },
    withAbility(a) {
      abilities.set(a.id, a);
      return index;
    },
    withItem(i) {
      items.set(i.id, i);
      return index;
    },
  };
  return index;
}
