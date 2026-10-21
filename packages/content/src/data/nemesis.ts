/**
 * Nemeses: a wild creature that knocks out one of a trainer's creatures, or breaks out of their orb, and gets away
 * (the trainer ran, whited out, or it was never caught or knocked out) is promoted, for that trainer alone. It gets a
 * name and a title, a scar from the fight, a few levels and one new move, and it remembers the fight. Later it ambushes
 * the trainer in the tall grass (or the water) of another zone, opening with a taunt about the last fight.
 *
 * The rules, kept legible:
 * - **Who rises:** plain wild creatures only (tall grass, surfing, fishing, a visible spawn). Never a legendary, the
 *   season's roamer, a static, a trainer's or a ghost's creature, the tower, the arena or a raid.
 * - **How often:** `NEMESIS_PROMOTE_CHANCE` by the zone's shadow level (honor shapes the world): a darkened zone breeds
 *   more of them. At most `NEMESIS_MAX` at a time per trainer; when a new one rises the oldest fades.
 * - **What it gains:** `NEMESIS_GAIN` levels (2 to 5), one move (the next it would learn by level-up, else a TM it can
 *   learn), a scar (`scarOf`), a name and a title flavoured by its type (`nemesisName`), rank 1.
 * - **Again:** each time it knocks out or escapes the same trainer again its rank rises (to `NEMESIS_RANK_MAX`) and it
 *   gains `NEMESIS_RANK_GAIN` more levels; its memory becomes the newest fight.
 * - **Ambush:** `NEMESIS_AMBUSH_CHANCE` of the trainer's grass / surf encounters, by shadow level, in a zone other than
 *   where it rose. It fights at `nemesisFightLevel` (its own level held near the trainer's lead: never more than
 *   `NEMESIS_OVER_LEAD` above it, never less than `NEMESIS_UNDER_LEAD` below), so a dark zone means more of them, never
 *   harder ones.
 * - **Endings:** knocked out, it is gone and the creature that landed the blow keeps a trophy line in its history;
 *   caught, it keeps its name as a nickname, its scar (a ribbon), its gained move and a history line.
 */
import type { MoveDef, SpeciesDef, TypeName } from '@ewa/core';
import { MOVES } from './moves';
import { TM_MOVES, canLearnMachineMove } from './progressionItems';

/** Active nemeses per trainer; the oldest fades when one more rises. */
export const NEMESIS_MAX = 3;
export const NEMESIS_RANK_MAX = 5;
/** Levels gained on rising (inclusive). */
export const NEMESIS_GAIN = Object.freeze({ min: 2, max: 5 });
/** Levels gained each time its rank rises (inclusive). */
export const NEMESIS_RANK_GAIN = Object.freeze({ min: 1, max: 2 });
export const NEMESIS_LEVEL_MAX = 100;
/** The chance a qualifying escape promotes the creature, by the zone's shadow level 0..4. */
export const NEMESIS_PROMOTE_CHANCE: readonly number[] = Object.freeze([0.6, 0.7, 0.8, 0.9, 1]);
/** The share of grass / surf encounters that are an ambush by one of the trainer's nemeses, by shadow level 0..4. */
export const NEMESIS_AMBUSH_CHANCE: readonly number[] = Object.freeze([0.08, 0.1, 0.12, 0.14, 0.16]);
/** An ambush fights at most this many levels above the trainer's lead... */
export const NEMESIS_OVER_LEAD = 3;
/** ...and at least this many below it. */
export const NEMESIS_UNDER_LEAD = 2;

const lvl = (shadow: number): number => Math.max(0, Math.min(4, Math.floor(shadow)));

export function nemesisPromoteChance(shadow: number): number {
  return NEMESIS_PROMOTE_CHANCE[lvl(shadow)]!;
}

export function nemesisAmbushChance(shadow: number): number {
  return NEMESIS_AMBUSH_CHANCE[lvl(shadow)]!;
}

/** The level an ambush fights at: the nemesis's own, held between lead - NEMESIS_UNDER_LEAD and lead + NEMESIS_OVER_LEAD. */
export function nemesisFightLevel(level: number, lead: number): number {
  const lo = Math.max(1, lead - NEMESIS_UNDER_LEAD);
  const hi = Math.min(NEMESIS_LEVEL_MAX, Math.max(lo, lead + NEMESIS_OVER_LEAD));
  return Math.max(lo, Math.min(hi, level));
}

// ─── scars ─────────────────────────────────────────────────────────────────────

export const NEMESIS_SCARS = ['burn', 'frost', 'lightning', 'venom', 'cracked_horn', 'brand', 'claw_marks', 'torn_ear'] as const;
export type NemesisScar = (typeof NEMESIS_SCARS)[number];

/** The scar's name and how the creature detail describes it. */
export const NEMESIS_SCAR_TEXT: Readonly<Record<NemesisScar, { readonly label: string; readonly line: string }>> = Object.freeze({
  burn: { label: 'Burn scar', line: 'A burn scar runs down its flank.' },
  frost: { label: 'Frostbitten ear', line: 'One ear is white and stiff with old frostbite.' },
  lightning: { label: 'Lightning mark', line: 'A forked lightning mark is burned into its hide.' },
  venom: { label: 'Venom stain', line: 'A dark venom stain never washed out of its fur.' },
  cracked_horn: { label: 'Cracked horn', line: 'A crack runs through its horn where a blow landed.' },
  brand: { label: 'Shadow brand', line: 'A cold shadow brand sits where something strange struck it.' },
  claw_marks: { label: 'Claw marks', line: 'Three healed claw marks cross its back.' },
  torn_ear: { label: 'Torn ear', line: 'Its ear is torn where it ripped free of an orb.' },
});

const SCAR_BY_TYPE: Readonly<Record<TypeName, NemesisScar>> = Object.freeze({
  Fire: 'burn',
  Ice: 'frost',
  Electric: 'lightning',
  Poison: 'venom',
  Bug: 'venom',
  Rock: 'cracked_horn',
  Ground: 'cracked_horn',
  Steel: 'cracked_horn',
  Fighting: 'cracked_horn',
  Dark: 'brand',
  Ghost: 'brand',
  Psychic: 'brand',
  Cosmic: 'brand',
  Fairy: 'brand',
  Normal: 'claw_marks',
  Dragon: 'claw_marks',
  Flying: 'claw_marks',
  Water: 'claw_marks',
  Grass: 'claw_marks',
});

/**
 * How it won shows: an orb it broke out of leaves a torn ear; a knockout leaves the mark of the hardest blow it took
 * (`hardestHit`: that move's type), or a cracked horn when nothing landed.
 */
export function scarOf(how: 'ko' | 'breakout', hardestHit: TypeName | null): NemesisScar {
  if (how === 'breakout') return 'torn_ear';
  return hardestHit === null ? 'cracked_horn' : SCAR_BY_TYPE[hardestHit];
}

const SCAR_RIBBON = 'nemesis-scar:';

/** The ribbon a caught nemesis keeps its scar as. */
export function nemesisScarRibbon(scar: NemesisScar): string {
  return `${SCAR_RIBBON}${scar}`;
}

/** The scar a creature carries from its days as a nemesis (null for any other creature). */
export function scarOfRibbons(ribbons: readonly string[]): NemesisScar | null {
  for (const r of ribbons) {
    if (!r.startsWith(SCAR_RIBBON)) continue;
    const s = r.slice(SCAR_RIBBON.length);
    if ((NEMESIS_SCARS as readonly string[]).includes(s)) return s as NemesisScar;
  }
  return null;
}

// ─── names and titles ──────────────────────────────────────────────────────────

/** First halves of a name, by type (7 letters at most). */
const NAME_HEADS: Readonly<Record<TypeName, readonly string[]>> = Object.freeze({
  Normal: ['Grey', 'Scrap', 'Dust', 'Rag', 'Knot'],
  Fire: ['Ash', 'Cinder', 'Ember', 'Scorch', 'Soot'],
  Water: ['Brine', 'Tide', 'Silt', 'Drown', 'Murk'],
  Grass: ['Bramble', 'Thorn', 'Moss', 'Briar', 'Root'],
  Electric: ['Volt', 'Spark', 'Static', 'Jolt', 'Arc'],
  Ice: ['Rime', 'Frost', 'Sleet', 'Hoar', 'Chill'],
  Fighting: ['Brawl', 'Knuckle', 'Grit', 'Bruise', 'Stomp'],
  Poison: ['Blight', 'Bile', 'Rot', 'Venom', 'Gall'],
  Ground: ['Clay', 'Grave', 'Mud', 'Rubble', 'Quake'],
  Flying: ['Gale', 'Gust', 'Squall', 'Kite', 'Talon'],
  Psychic: ['Hex', 'Omen', 'Haze', 'Wraith', 'Gloam'],
  Bug: ['Chitin', 'Mite', 'Itch', 'Hive', 'Sting'],
  Rock: ['Flint', 'Crag', 'Slate', 'Shale', 'Boulder'],
  Ghost: ['Wisp', 'Shade', 'Hollow', 'Grim', 'Pale'],
  Dragon: ['Wyrm', 'Drake', 'Scale', 'Fury', 'Rend'],
  Steel: ['Rivet', 'Rust', 'Iron', 'Anvil', 'Blade'],
  Fairy: ['Hush', 'Gleam', 'Thistle', 'Wile', 'Fey'],
  Dark: ['Scar', 'Night', 'Gloom', 'Dusk', 'Black'],
  Cosmic: ['Void', 'Star', 'Comet', 'Nova', 'Orbit'],
});

/** Second halves (5 letters at most, so a name stays within a nickname's 16). */
const NAME_TAILS: readonly string[] = Object.freeze(['jaw', 'fang', 'claw', 'maw', 'hide', 'tail', 'horn', 'eye', 'back', 'mane', 'spine', 'tooth', 'wing', 'heart', 'snout', 'hook']);

/** Titles by how it got away. */
const TITLES_BY_HOW: Readonly<Record<'ko' | 'breakout', readonly string[]>> = Object.freeze({
  ko: ['the Unbroken', 'the Merciless', 'the Unbowed', 'the Relentless', 'the Grim'],
  breakout: ['the Orbless', 'the Unbound', 'the Slippery', 'the Untamed', 'the Unkept'],
});

/** Titles by type. */
const TITLES_BY_TYPE: Readonly<Record<TypeName, readonly string[]>> = Object.freeze({
  Normal: ['the Stubborn'],
  Fire: ['the Unburnt', 'the Smouldering'],
  Water: ['the Tideborn', 'the Drowned'],
  Grass: ['the Overgrown', 'the Thorned'],
  Electric: ['the Crackling', 'the Stormstruck'],
  Ice: ['the Frozen', 'the Pale'],
  Fighting: ['the Brawler', 'the Undaunted'],
  Poison: ['the Rotten', 'the Bitter'],
  Ground: ['the Buried', 'the Quaking'],
  Flying: ['the Windborne', 'the Highflier'],
  Psychic: ['the Knowing', 'the Watcher'],
  Bug: ['the Swarming', 'the Gnawing'],
  Rock: ['the Unmoved', 'the Cragborn'],
  Ghost: ['the Restless', 'the Unburied'],
  Dragon: ['the Wyrmblooded', 'the Ancient'],
  Steel: ['the Ironclad', 'the Rusted'],
  Fairy: ['the Fickle', 'the Wicked'],
  Dark: ['the Cruel', 'the Nightborn'],
  Cosmic: ['the Fallen Star', 'the Starless'],
});

/** A random source (core `Rng.int`): an integer in [0, n). */
export interface NemesisRng {
  int(n: number): number;
}

function pick<T>(rng: NemesisRng, xs: readonly T[]): T {
  return xs[rng.int(xs.length)]!;
}

/**
 * A name (its type's head and a tail, e.g. "Scarjaw") and a title (by how it got away or by its type, e.g. "the
 * Unbroken"), avoiding the names in `taken` (the trainer's other nemeses) when it can.
 */
export function nemesisName(rng: NemesisRng, types: readonly TypeName[], how: 'ko' | 'breakout', taken: readonly string[] = []): { readonly name: string; readonly title: string } {
  const type = types[0] ?? 'Normal';
  let name = '';
  for (let i = 0; i < 6; i++) {
    const t = i % 2 === 1 && types[1] !== undefined ? types[1] : type;
    name = pick(rng, NAME_HEADS[t]) + pick(rng, NAME_TAILS);
    if (!taken.includes(name)) break;
  }
  const titles = [...TITLES_BY_HOW[how], ...TITLES_BY_TYPE[type]];
  return { name, title: pick(rng, titles) };
}

/** "Scarjaw the Unbroken". */
export function nemesisFullName(n: { readonly name: string; readonly title: string }): string {
  return `${n.name} ${n.title}`;
}

// ─── the move it gains ───────────────────────────────────────────────────────

const MOVE_BY_ID = new Map<string, MoveDef>(MOVES.map((m) => [m.id, m]));

/**
 * The move a nemesis gains at `level`: the next move its learnset teaches above that level that it does not know, else
 * a damaging TM it can learn (picked by `rng`), else null.
 */
export function nemesisMove(sp: SpeciesDef, level: number, known: readonly string[], rng: NemesisRng): string | null {
  const next = [...sp.learnableMoves].filter((e) => e.level > level && !known.includes(e.move)).sort((a, b) => a.level - b.level)[0];
  if (next !== undefined) return next.move;
  const tms = TM_MOVES.filter((id) => {
    const def = MOVE_BY_ID.get(id);
    return def !== undefined && def.power > 0 && !known.includes(id) && canLearnMachineMove(sp, def);
  });
  return tms.length === 0 ? null : pick(rng, tms);
}

/** Its moves in battle: its level moves with the gained move in place of the oldest, at most four (oldest first). */
export function nemesisMoves(levelMoves: readonly string[], gained: string | null): string[] {
  if (gained === null || levelMoves.includes(gained)) return [...levelMoves];
  return [...levelMoves, gained].slice(-4);
}

// ─── memory and taunts ──────────────────────────────────────────────────────────

/** What it remembers of the last fight with the trainer. */
export interface NemesisMemory {
  readonly how: 'ko' | 'breakout';
  readonly zoneId: string;
  /** the trainer's creature it knocked out (`ko`), or the one facing it when it broke out (`breakout`) */
  readonly foeSpecies: string;
  /** that creature's nickname (null: none) */
  readonly foeName: string | null;
  /** the move that knocked it out (`ko`; null when it fell to something else) */
  readonly move: string | null;
  /** the orb it broke out of (`breakout`) */
  readonly orb: string | null;
}

/** Names the taunt needs, resolved by the caller (species, orb and zone display names). */
export interface TauntNames {
  readonly foe: string;
  readonly orb: string | null;
  readonly zone: string;
}

/**
 * The line an ambush opens with, from the last fight: "Scarjaw remembers your Pyrekit. It remembers Ember." A higher
 * rank remembers more.
 */
export function nemesisTaunt(name: string, rank: number, m: NemesisMemory, names: TauntNames): string {
  if (m.how === 'breakout') {
    const orb = names.orb ?? 'orb';
    if (rank >= 3) return `${name} has slipped away from you ${rank} times. Your ${orb} will not hold it.`;
    if (rank === 2) return `${name} tore free of your ${orb} on ${names.zone}. It has not forgotten.`;
    return `${name} remembers your ${orb}. It broke out once. It will again.`;
  }
  if (rank >= 3) return `${name} has beaten you ${rank} times. It remembers your ${names.foe} best of all.`;
  if (rank === 2) return `${name} remembers your ${names.foe} falling on ${names.zone}${m.move !== null ? ` to ${m.move}` : ''}. It wants more.`;
  return m.move !== null ? `${name} remembers your ${names.foe}. It remembers ${m.move}.` : `${name} remembers your ${names.foe}. It remembers how it fell.`;
}
