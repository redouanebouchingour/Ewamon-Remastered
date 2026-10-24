/**
 * Prof. Wynn's facts (LLM feature 5): what the professor knows, computed from content and the player's own save.
 * Pure and deterministic: every lookup takes a `ProfSave` (a snapshot of the session) and returns a `FactSheet`, short
 * true sentences plus the species and types they are about (the panel shows their sprites and type icons). This is
 * where correctness lives: the model in talk/professor.ts only words a sheet, and the sheet itself is the answer when
 * the model is down, slow or says something the sheet does not hold.
 *
 * The lookups are also the professor's tools (`PROF_TOOLS`, `runTool`): talk/professor.ts measured a tool loop where
 * the model picks them against `routeQuestion`, which picks them itself from the names and keywords in the question
 * (see the header there for the numbers and what shipped).
 *
 * Spoilers: a legendary's spot is only named when the player asks for that legendary by name; a type search never lists
 * legendaries. A league trainer's team is listed when the player names the trainer or the trainer's town is open to
 * them (the next gym always is); otherwise only its type and top level. The next step of the story is the one the HUD
 * hint already shows (`storyHint`), never the beats after it.
 */
import {
  BADGES,
  CONSUMABLES,
  ENCOUNTER_TABLES,
  EVOLUTION_STONES,
  ITEMS,
  KEY_ITEMS,
  LEAGUE,
  LEGENDARY_STATICS,
  MOVES,
  ORBS,
  QUESTS,
  SHOP_STOCK_DEFAULT,
  SPECIES,
  TYPE_CHART,
  ZONES,
  ZONE_ORDER,
} from '@ewa/content';
import type { BadgeId, EncounterSlot, LeagueTrainer, ZoneDef, ZoneId } from '@ewa/content';
import { HONOR_DELTAS, TYPE_NAMES, typeMultiplier } from '@ewa/core';
import type { CreatureInstance, MoveDef, SpeciesDef, TypeName } from '@ewa/core';
import { storyHint, storyFlagSet } from '../scene/dialogue';

// ---- the save ------------------------------------------------------------------------------------------------------

/** One of the player's creatures, as the professor sees it. */
export interface ProfMon {
  readonly speciesId: string;
  /** nickname or species name */
  readonly name: string;
  readonly level: number;
  readonly moves: readonly string[];
  /** the honor ledger of a species that keeps one (dustcub, cryptorb), else null */
  readonly honor: number | null;
}

/** What the professor knows of the player: a snapshot of the session (`saveOf`). */
export interface ProfSave {
  readonly party: readonly ProfMon[];
  readonly box: readonly ProfMon[];
  readonly badges: readonly BadgeId[];
  readonly flags: readonly string[];
  readonly dexCaught: readonly string[];
  readonly dexSeen: readonly string[];
  readonly zoneId: ZoneId | null;
  readonly items: Readonly<Record<string, number>>;
}

const speciesById = new Map<string, SpeciesDef>(SPECIES.map((sp) => [sp.id, sp]));
const moveById = new Map<string, MoveDef>(MOVES.map((m) => [m.id, m]));
const zoneById = new Map<ZoneId, ZoneDef>(ZONES.map((z) => [z.id, z]));

function honorSplit(sp: SpeciesDef): boolean {
  const e = sp.evolution;
  return e !== null && e.kind === 'split' && e.branches.some((b) => b.condition?.kind === 'honor');
}

export function monOf(c: Pick<CreatureInstance, 'speciesId' | 'nickname' | 'level' | 'moves' | 'honor'>): ProfMon {
  const sp = speciesById.get(c.speciesId);
  return {
    speciesId: c.speciesId,
    name: c.nickname ?? sp?.name ?? c.speciesId,
    level: c.level,
    moves: c.moves.map((m) => m.id),
    honor: sp !== undefined && honorSplit(sp) ? (c.honor ?? 0) : null,
  };
}

/** the parts of the session's progression the professor reads (read only: session.ts stays the one writer) */
interface ProgressionSource {
  readonly badges: readonly BadgeId[];
  readonly flags: readonly string[];
  readonly dexCaught: readonly string[];
  readonly dexSeen: readonly string[];
}
interface InventorySource {
  readonly party: readonly CreatureInstance[];
  readonly box: readonly CreatureInstance[];
  readonly items: Readonly<Record<string, number>>;
}

export interface SaveSources {
  readonly progression: ProgressionSource | null;
  readonly inventory: InventorySource | null;
  readonly zoneId: ZoneId | null;
}

/** The professor's snapshot of the session store. */
export function saveOf(s: SaveSources): ProfSave {
  return {
    party: (s.inventory?.party ?? []).map(monOf),
    box: (s.inventory?.box ?? []).map(monOf),
    badges: s.progression?.badges ?? [],
    flags: s.progression?.flags ?? [],
    dexCaught: s.progression?.dexCaught ?? [],
    dexSeen: s.progression?.dexSeen ?? [],
    zoneId: s.zoneId,
    items: s.inventory?.items ?? {},
  };
}

// ---- the answer's shape --------------------------------------------------------------------------------------------

export type Topic = 'species' | 'find' | 'evolve' | 'types' | 'team' | 'next' | 'trainer' | 'matchup' | 'item' | 'zone' | 'help';

export interface FactSheet {
  readonly topic: Topic;
  /** a short heading for the panel ("Mira Thornwell's team") */
  readonly title: string;
  /** short true sentences, the most useful first */
  readonly facts: readonly string[];
  /** species the facts are about (sprites) */
  readonly species: readonly string[];
  /** types the facts are about (type icons) */
  readonly types: readonly TypeName[];
}

/** the most facts one sheet carries (the small model words six or seven lines well, a dozen badly) */
export const MAX_FACTS = 7;

function sheet(topic: Topic, title: string, facts: readonly string[], species: readonly string[] = [], types: readonly TypeName[] = []): FactSheet {
  return { topic, title, facts: facts.slice(0, MAX_FACTS), species: [...new Set(species)].slice(0, 6), types: [...new Set(types)].slice(0, 6) };
}

// ---- small helpers -------------------------------------------------------------------------------------------------

const nameOf = (id: string): string => speciesById.get(id)?.name ?? id;
const typesOf = (id: string): readonly TypeName[] => speciesById.get(id)?.types ?? [];
const typeText = (id: string): string => typesOf(id).join('/');
const zoneName = (id: ZoneId): string => zoneById.get(id)?.name ?? id;
const badgeName = (b: BadgeId): string => BADGES.find((x) => x.id === b)?.name ?? b;

/** "a, b and c" */
export function listText(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]!}`;
}

/** Whether the player may enter a zone (its badge gate held). */
export function zoneOpen(z: ZoneDef, save: Pick<ProfSave, 'badges'>): boolean {
  return z.gate === null || save.badges.includes(z.gate);
}

/** How far a zone is from where the player stands (zone order steps), for "nearest first". */
function distance(zoneId: ZoneId, save: ProfSave): number {
  const here = save.zoneId === null ? 0 : ZONE_ORDER.indexOf(save.zoneId);
  return Math.abs(ZONE_ORDER.indexOf(zoneId) - Math.max(0, here));
}

/** The species' moves at a level, as the server builds a league or route trainer's creature (the last four learned). */
export function movesAtLevel(sp: SpeciesDef, level: number): readonly string[] {
  const seen: string[] = [];
  for (const e of sp.learnableMoves) {
    if (e.level > level) continue;
    const i = seen.indexOf(e.move);
    if (i !== -1) seen.splice(i, 1);
    seen.push(e.move);
  }
  return seen.length > 0 ? seen.slice(-4) : sp.moves.slice(0, 4);
}

/** Types whose moves hit these defending types for double damage or more. */
export function superEffectiveOn(defending: readonly TypeName[]): TypeName[] {
  return TYPE_NAMES.filter((t) => typeMultiplier(TYPE_CHART, t, defending) >= 2);
}
/** Types whose moves do half damage or less (but some) to these defending types. */
export function resistedBy(defending: readonly TypeName[]): TypeName[] {
  return TYPE_NAMES.filter((t) => {
    const m = typeMultiplier(TYPE_CHART, t, defending);
    return m > 0 && m < 1;
  });
}
export function immuneTo(defending: readonly TypeName[]): TypeName[] {
  return TYPE_NAMES.filter((t) => typeMultiplier(TYPE_CHART, t, defending) === 0);
}
/** Defending types this attacking type hits for double damage. */
export function strongAgainst(attacking: TypeName): TypeName[] {
  return TYPE_NAMES.filter((t) => typeMultiplier(TYPE_CHART, attacking, [t]) >= 2);
}


/** The best damaging move of `moves` against `defending`: power × type × same-type bonus. */
export function bestMove(attackerTypes: readonly TypeName[], moves: readonly string[], defending: readonly TypeName[]): { readonly move: string; readonly type: TypeName; readonly mult: number; readonly score: number } | null {
  let best: { move: string; type: TypeName; mult: number; score: number } | null = null;
  for (const id of moves) {
    const m = moveById.get(id);
    if (m === undefined || m.power <= 0) continue;
    const mult = typeMultiplier(TYPE_CHART, m.type, defending);
    const score = m.power * mult * (attackerTypes.includes(m.type) ? 1.5 : 1);
    if (best === null || score > best.score) best = { move: m.id, type: m.type, mult, score };
  }
  return best;
}

// ---- where a species comes from -------------------------------------------------------------------------------------

interface Spot {
  readonly zoneId: ZoneId;
  readonly slot: EncounterSlot;
}

const spotsBySpecies = new Map<string, Spot[]>();
for (const t of ENCOUNTER_TABLES) {
  for (const slot of t.slots) {
    if (slot.tier === 'alpha') continue;
    const list = spotsBySpecies.get(slot.species) ?? [];
    list.push({ zoneId: t.zoneId, slot });
    spotsBySpecies.set(slot.species, list);
  }
}

function spotText(sp: Spot, save: ProfSave): string {
  const z = zoneById.get(sp.zoneId);
  const s = sp.slot;
  const when = s.timeOfDay === 'day' ? ', by day' : s.timeOfDay === 'night' ? ', at night' : '';
  const where = s.medium === 'water' ? ', in the water' : '';
  const levels = s.levelMin === s.levelMax ? `level ${s.levelMin}` : `level ${s.levelMin} to ${s.levelMax}`;
  const gate = z !== undefined && !zoneOpen(z, save) && z.gate !== null ? `; you need the ${badgeName(z.gate)} to go there` : '';
  return `${z?.kind === 'route' ? 'on' : 'in'} ${zoneName(sp.zoneId)} at ${levels}${when}${where} (${s.tier}${gate})`;
}

/** The wild spots of a species, open zones first, then the nearest, one per zone (the widest level range). */
function spotsOf(speciesId: string, save: ProfSave): Spot[] {
  const byZone = new Map<ZoneId, Spot>();
  for (const s of spotsBySpecies.get(speciesId) ?? []) {
    const cur = byZone.get(s.zoneId);
    if (cur === undefined || s.slot.weight > cur.slot.weight) byZone.set(s.zoneId, s);
  }
  return [...byZone.values()].sort((a, b) => {
    const oa = zoneOpen(zoneById.get(a.zoneId)!, save) ? 0 : 1;
    const ob = zoneOpen(zoneById.get(b.zoneId)!, save) ? 0 : 1;
    return oa - ob || distance(a.zoneId, save) - distance(b.zoneId, save) || ZONE_ORDER.indexOf(a.zoneId) - ZONE_ORDER.indexOf(b.zoneId);
  });
}

function staticGateText(when: string): string {
  if (when.startsWith('badge:')) return `once you hold the ${badgeName(when.slice('badge:'.length) as BadgeId)}`;
  if (when === 'flag:champion:zeon:beaten') return 'after you beat the Champion';
  return 'later in the story';
}

/** Where the species can be had: wild spots, else evolving its pre-evolution, a legendary's spot, a quest reward. */
function originFacts(speciesId: string, save: ProfSave, depth = 0): string[] {
  const sp = speciesById.get(speciesId);
  if (sp === undefined) return [];
  const name = sp.name;
  const spots = spotsOf(speciesId, save);
  if (spots.length > 0) return [`${name} lives ${spots.slice(0, 3).map((s) => spotText(s, save)).join(', and ')}.`];
  const st = LEGENDARY_STATICS.find((s) => s.species === speciesId);
  if (st !== undefined) return [`${name} is a legendary: it appears once in ${zoneName(st.zoneId)} at level ${st.level}, ${staticGateText(st.when)}.`];
  const q = QUESTS.find((x) => x.rewards.creature?.species === speciesId);
  if (q !== undefined) return [`${name} is the reward of the quest "${q.title}".`];
  if (sp.evolvesFrom !== null && depth < 3) {
    const from = speciesById.get(sp.evolvesFrom);
    const how = from === undefined ? '' : evolveHow(from, speciesId);
    return [`${name} is not found in the wild: evolve a ${nameOf(sp.evolvesFrom)}${how === '' ? '' : ` (${how})`}.`, ...originFacts(sp.evolvesFrom, save, depth + 1)];
  }
  return [`${name} is not found in the wild.`];
}

// ---- evolution ------------------------------------------------------------------------------------------------------

const itemNameOf = (id: string): string => ITEM_NAMES.get(id) ?? id;

/** How `from` evolves into `into`, as a phrase ("at level 16", "with an Ember Stone", "when traded"). */
function evolveHow(from: SpeciesDef, into: string): string {
  const e = from.evolution;
  if (e === null) return '';
  if (e.kind === 'level') return `at level ${e.atLevel}`;
  if (e.kind === 'item') return `with a ${itemNameOf(e.item)}`;
  if (e.kind === 'trade') return 'when traded';
  const b = e.branches.find((x) => x.into === into);
  if (b === undefined) return `at level ${e.atLevel}`;
  if (b.condition === null) return `at level ${e.atLevel}, when no other branch applies`;
  if (b.condition.kind === 'honor') return `at level ${e.atLevel} with honor ${b.condition.atLeast} or more`;
  return `at level ${e.atLevel} with the ability ${b.condition.ability}`;
}

/** Shops that sell an item in zones the player can enter, nearest first. */
function shopsSelling(itemId: string, save: ProfSave): ZoneDef[] {
  return ZONES.filter((z) => z.shop !== null && (z.shop.length > 0 ? z.shop : SHOP_STOCK_DEFAULT).includes(itemId)).sort(
    (a, b) => (zoneOpen(a, save) ? 0 : 1) - (zoneOpen(b, save) ? 0 : 1) || distance(a.id, save) - distance(b.id, save),
  );
}

function owned(save: ProfSave, speciesId: string): ProfMon[] {
  return [...save.party, ...save.box].filter((m) => m.speciesId === speciesId);
}

export function evolveFacts(speciesId: string, save: ProfSave): FactSheet {
  const sp = speciesById.get(speciesId);
  if (sp === undefined) return helpSheet(save);
  const facts: string[] = [];
  const species = [speciesId];
  const e = sp.evolution;
  const mine = owned(save, speciesId).sort((a, b) => b.level - a.level)[0];
  if (e === null) facts.push(`${sp.name} does not evolve.`);
  else if (e.kind === 'level') {
    facts.push(`${sp.name} evolves into ${nameOf(e.into)} at level ${e.atLevel}.`);
    species.push(e.into);
    if (mine !== undefined) facts.push(mine.level >= e.atLevel ? `Your ${mine.name} is level ${mine.level}: it evolves on its next level up.` : `Your ${mine.name} is level ${mine.level}, ${e.atLevel - mine.level} levels to go.`);
  } else if (e.kind === 'item') {
    const shops = shopsSelling(e.item, save);
    facts.push(`${sp.name} evolves into ${nameOf(e.into)} when you use a ${itemNameOf(e.item)} on it.`);
    species.push(e.into);
    const have = save.items[e.item] ?? 0;
    if (have > 0) facts.push(`You have ${have} ${itemNameOf(e.item)} in your bag.`);
    else if (shops.length > 0) facts.push(`The ${itemNameOf(e.item)} is sold in ${listText(shops.slice(0, 2).map((z) => z.name))}${zoneOpen(shops[0]!, save) ? '' : ` (you need the ${badgeName(shops[0]!.gate!)} to go there)`}.`);
  } else if (e.kind === 'trade') {
    facts.push(`${sp.name} evolves into ${nameOf(e.into)} when it is traded to another player.`);
    species.push(e.into);
  } else {
    const parts = e.branches.map((b) => `${nameOf(b.into)} ${evolveHow(sp, b.into).replace(`at level ${e.atLevel}`, '').replace(/^, /, '').trim() || 'otherwise'}`);
    facts.push(`${sp.name} evolves at level ${e.atLevel}, into ${listText(parts.map((p) => p.replace(/ when no other branch applies$/, ' otherwise')))}.`);
    species.push(...e.branches.map((b) => b.into));
    if (honorSplit(sp)) {
      facts.push(`Honor goes up by ${HONOR_DELTAS.duelWon} when its side wins a trainer battle it fought in, and by ${HONOR_DELTAS.spared} when you catch a wild Ewamon while it is out. It goes down by ${-HONOR_DELTAS.dirtyTrick} when it lands a Dark move or knocks out a wild Ewamon.`);
      if (mine !== undefined && mine.honor !== null) facts.push(`Your ${mine.name} is level ${mine.level} with honor ${mine.honor}.`);
    } else if (mine !== undefined) facts.push(`Your ${mine.name} is level ${mine.level}.`);
  }
  if (sp.evolvesFrom !== null) {
    const from = speciesById.get(sp.evolvesFrom);
    facts.push(`${sp.name} itself evolves from ${nameOf(sp.evolvesFrom)}${from === undefined ? '' : ` ${evolveHow(from, speciesId)}`}.`);
  }
  if (mine === undefined && !save.dexCaught.includes(speciesId)) facts.push(...originFacts(speciesId, save).slice(0, 1));
  return sheet('evolve', `Evolving ${sp.name}`, facts, species, sp.types);
}

// ---- species, finding, types ----------------------------------------------------------------------------------------

export function speciesFacts(speciesId: string, save: ProfSave): FactSheet {
  const sp = speciesById.get(speciesId);
  if (sp === undefined) return helpSheet(save);
  const facts = [`${sp.name} is ${sp.types.length === 2 ? 'a' : 'a pure'} ${sp.types.join('/')} type.`];
  const weak = superEffectiveOn(sp.types);
  if (weak.length > 0) facts.push(`${listText(weak)} moves are super effective on it.`);
  const mine = owned(save, speciesId);
  if (mine.length > 0) facts.push(`You have ${mine.length === 1 ? 'one' : mine.length}: ${listText(mine.slice(0, 3).map((m) => `${m.name} (level ${m.level})`))}.`);
  const e = sp.evolution;
  if (e !== null) {
    const into = e.kind === 'split' ? e.branches.map((b) => b.into) : [e.into];
    facts.push(`It evolves into ${listText(into.map((i) => `${nameOf(i)} ${evolveHow(sp, i)}`.replace(/, when no other branch applies$/, ' otherwise')))}.`);
  }
  if (mine.length === 0) facts.push(...originFacts(speciesId, save).slice(0, 2));
  return sheet('species', sp.name, facts, [speciesId], sp.types);
}

export function findSpeciesFacts(speciesId: string, save: ProfSave): FactSheet {
  const sp = speciesById.get(speciesId);
  if (sp === undefined) return helpSheet(save);
  const facts = originFacts(speciesId, save);
  const mine = owned(save, speciesId);
  if (mine.length > 0) facts.unshift(`You already have ${listText(mine.slice(0, 2).map((m) => `${m.name} (level ${m.level})`))}.`);
  return sheet('find', `Finding ${sp.name}`, facts, [speciesId], sp.types);
}

/** Wild species of a type, open zones and the nearest first; legendaries never. */
export function findTypeFacts(type: TypeName, save: ProfSave): FactSheet {
  const found: { id: string; spot: Spot }[] = [];
  for (const sp of SPECIES) {
    if (sp.legendary || !sp.types.includes(type)) continue;
    const spot = spotsOf(sp.id, save)[0];
    if (spot !== undefined) found.push({ id: sp.id, spot });
  }
  found.sort((a, b) => {
    const oa = zoneOpen(zoneById.get(a.spot.zoneId)!, save) ? 0 : 1;
    const ob = zoneOpen(zoneById.get(b.spot.zoneId)!, save) ? 0 : 1;
    return oa - ob || distance(a.spot.zoneId, save) - distance(b.spot.zoneId, save) || a.spot.slot.levelMin - b.spot.slot.levelMin;
  });
  const facts = found.slice(0, 4).map((f) => `${nameOf(f.id)} (${typeText(f.id)}) lives ${spotText(f.spot, save)}.`);
  if (facts.length === 0) facts.push(`No wild ${type} type lives anywhere you can reach yet.`);
  const mine = [...save.party, ...save.box].filter((m) => typesOf(m.speciesId).includes(type));
  if (mine.length > 0) facts.push(`You already have ${listText(mine.slice(0, 3).map((m) => `${m.name} (level ${m.level})`))}.`);
  return sheet('find', `${type} types`, facts, found.slice(0, 4).map((f) => f.id), [type]);
}

/**
 * A type as defender ("what beats Ghost": `defend`), as attacker ("what is Fire good against": `attack`) or both. Only
 * the side asked for: given both, the small model read "Ghost moves are super effective on Psychic and Ghost" as what
 * beats Ghost.
 */
export type TypeView = 'defend' | 'attack' | 'both';

export function typeFacts(types: readonly TypeName[], save: ProfSave, view: TypeView = 'both'): FactSheet {
  const facts: string[] = [];
  for (const t of types.slice(0, 2)) {
    if (view !== 'attack') {
      const se = superEffectiveOn([t]);
      const res = resistedBy([t]);
      const imm = immuneTo([t]);
      facts.push(se.length === 0 ? `Nothing is super effective on ${t}.` : `${listText(se)} moves are super effective on ${t}.`);
      if (res.length > 0) facts.push(`${t} resists ${listText(res)} moves.`);
      if (imm.length > 0) facts.push(`${listText(imm)} moves have no effect on ${t}.`);
    }
    if (view !== 'defend') {
      const strong = strongAgainst(t);
      const weak = TYPE_NAMES.filter((d) => {
        const m = typeMultiplier(TYPE_CHART, t, [d]);
        return m > 0 && m < 1;
      });
      facts.push(strong.length === 0 ? `${t} moves are not super effective on any type.` : `${t} moves are super effective on ${listText(strong)}.`);
      if (weak.length > 0) facts.push(`${t} moves are not very effective on ${listText(weak)}.`);
    }
  }
  if (view === 'attack') return sheet('types', `${types.join(' and ')} moves`, facts, [], [...types, ...strongAgainst(types[0]!)]);
  const se = superEffectiveOn(types.slice(0, 1));
  const users: string[] = [];
  for (const m of save.party) {
    const best = bestMove(typesOf(m.speciesId), m.moves, types.slice(0, 1));
    if (best !== null && best.mult >= 2) users.push(`${m.name}'s ${best.move}`);
  }
  if (users.length > 0) facts.push(`In your party, ${listText(users.slice(0, 3))} ${users.length === 1 ? 'is' : 'are'} super effective on ${types[0]!}.`);
  else if (save.party.length > 0 && se.length > 0) facts.push(`No move in your party is super effective on ${types[0]!}.`);
  return sheet('types', `${types.join(' and ')} matchups`, facts, [], [...types, ...se]);
}

export function zoneFacts(zoneId: ZoneId, save: ProfSave): FactSheet {
  const z = zoneById.get(zoneId);
  if (z === undefined) return helpSheet(save);
  const facts: string[] = [];
  if (!zoneOpen(z, save) && z.gate !== null) facts.push(`You need the ${badgeName(z.gate)} to enter ${z.name}.`);
  const table = ENCOUNTER_TABLES.find((t) => t.zoneId === zoneId);
  const ids: string[] = [];
  if (table !== undefined) {
    const seen = new Set<string>();
    const slots = [...table.slots].filter((s) => s.tier !== 'alpha' && !speciesById.get(s.species)?.legendary).sort((a, b) => b.weight - a.weight);
    const parts: string[] = [];
    for (const s of slots) {
      if (seen.has(s.species)) continue;
      seen.add(s.species);
      ids.push(s.species);
      const when = s.timeOfDay === 'day' ? ', by day' : s.timeOfDay === 'night' ? ', at night' : '';
      parts.push(`${nameOf(s.species)} (${typeText(s.species)}, level ${s.levelMin} to ${s.levelMax}${when})`);
    }
    facts.push(`Wild Ewamon in ${z.name}: ${listText(parts.slice(0, 6))}.`);
  } else facts.push(`No wild Ewamon live in ${z.name}.`);
  if (z.shop !== null) facts.push(`${z.name} has a shop.`);
  if (z.healer) facts.push(`${z.name} has a healer.`);
  const lt = LEAGUE.find((l) => l.stage === 'gym' && l.zoneId === zoneId);
  if (lt !== undefined) facts.push(`${lt.name} runs the ${lt.type} type gym here.`);
  return sheet('zone', z.name, facts, ids.slice(0, 6), z.type === null ? [] : [z.type]);
}

// ---- the player's team ----------------------------------------------------------------------------------------------

export function teamFacts(save: ProfSave): FactSheet {
  if (save.party.length === 0) return sheet('team', 'Your team', ['Your party is empty.']);
  const facts = [`Your party: ${listText(save.party.map((m) => `${m.name} (${typeText(m.speciesId)}, level ${m.level})`))}.`];
  const cover = new Set<TypeName>();
  for (const m of save.party) {
    for (const id of m.moves) {
      const mv = moveById.get(id);
      if (mv !== undefined && mv.power > 0) for (const t of strongAgainst(mv.type)) cover.add(t);
    }
  }
  const missing = TYPE_NAMES.filter((t) => !cover.has(t));
  if (cover.size > 0) facts.push(`Your moves hit ${listText(TYPE_NAMES.filter((t) => cover.has(t)))} super effective.`);
  if (missing.length > 0 && cover.size > 0) facts.push(`Nothing in your party hits ${listText(missing.slice(0, 6))} super effective.`);
  // the attacking type most of the party is weak to
  let worst: { t: TypeName; n: number } | null = null;
  for (const t of TYPE_NAMES) {
    const n = save.party.filter((m) => typeMultiplier(TYPE_CHART, t, typesOf(m.speciesId)) >= 2).length;
    if (n >= 2 && (worst === null || n > worst.n)) worst = { t, n };
  }
  if (worst !== null) facts.push(`${worst.n} of your ${save.party.length} are weak to ${worst.t} moves.`);
  const top = Math.max(...save.party.map((m) => m.level));
  facts.push(`Your highest level is ${top}.`);
  return sheet('team', 'Your team', facts, save.party.map((m) => m.speciesId), worst === null ? [] : [worst.t]);
}

// ---- the league -----------------------------------------------------------------------------------------------------

const GYMS = LEAGUE.filter((l) => l.stage === 'gym').sort((a, b) => a.order - b.order);
const LEAGUE_ORDER: readonly LeagueTrainer[] = [...GYMS, ...LEAGUE.filter((l) => l.stage === 'elite').sort((a, b) => a.order - b.order), ...LEAGUE.filter((l) => l.stage === 'champion')];

/** The next league trainer to beat: the first gym without its badge, then the Wardens and the Champion. */
export function nextLeague(save: ProfSave): LeagueTrainer | null {
  const g = GYMS.find((x) => x.badge !== null && !save.badges.includes(x.badge));
  if (g !== undefined) return g;
  for (const l of LEAGUE_ORDER) if (l.stage !== 'gym' && !l.setsFlags.every((f) => save.flags.includes(f))) return l;
  return null;
}

/** Whether the player has reached the trainer's town. */
function reached(lt: LeagueTrainer, save: ProfSave): boolean {
  const z = zoneById.get(lt.zoneId);
  return z !== undefined && zoneOpen(z, save);
}

const who = (lt: LeagueTrainer): string => (lt.stage === 'gym' ? `${lt.name}, the ${lt.type} type gym leader of ${zoneName(lt.zoneId)}` : `${lt.name}, ${lt.title}, a ${lt.type} type expert`);

export function trainerFacts(lt: LeagueTrainer, save: ProfSave, direct: boolean): FactSheet {
  const top = Math.max(...lt.team.map((m) => m.level));
  const facts = [`${who(lt)}.`];
  if (direct || reached(lt, save)) {
    facts.push(`Team: ${listText(lt.team.map((m) => `${nameOf(m.species)} (${typeText(m.species)}, level ${m.level})`))}.`);
  } else facts.push(`Their team is mostly ${lt.type} type, up to level ${top}.`);
  const se = superEffectiveOn([lt.type]);
  facts.push(`${listText(se)} moves are super effective on ${lt.type}.`);
  if (lt.badge !== null) facts.push(save.badges.includes(lt.badge) ? `You already won the ${badgeName(lt.badge)} from ${lt.name}.` : `Beating ${lt.name} earns the ${badgeName(lt.badge)}.`);
  const show = direct || reached(lt, save);
  return sheet('trainer', `${lt.name}`, facts, show ? lt.team.map((m) => m.species) : [], [lt.type]);
}

/** The player's party against a league trainer's team: who answers whom, what hurts, the level gap, what to bring. */
export function matchupFacts(lt: LeagueTrainer, save: ProfSave): FactSheet {
  if (save.party.length === 0) return trainerFacts(lt, save, true);
  const facts: string[] = [];
  const top = Math.max(...lt.team.map((m) => m.level));
  const mineTop = Math.max(...save.party.map((m) => m.level));
  facts.push(`${who(lt)}. Their strongest is level ${top}; your highest is level ${mineTop}.`);
  // the player's answers, grouped by creature and move: "Your Pyrecap's Ember is super effective on their Ampmite and Luxtrik."
  const answers = new Map<string, { readonly mult: number; readonly foes: string[] }>();
  const unanswered: string[] = [];
  for (const foe of lt.team) {
    const ft = typesOf(foe.species);
    let best: { mon: ProfMon; move: string; mult: number; score: number } | null = null;
    for (const m of save.party) {
      const b = bestMove(typesOf(m.speciesId), m.moves, ft);
      if (b !== null && (best === null || b.score > best.score)) best = { mon: m, move: b.move, mult: b.mult, score: b.score };
    }
    if (best !== null && best.mult >= 2) {
      const k = `Your ${best.mon.name}'s ${best.move}`;
      const cur = answers.get(k) ?? { mult: best.mult, foes: [] };
      cur.foes.push(nameOf(foe.species));
      answers.set(k, cur);
    } else unanswered.push(nameOf(foe.species));
  }
  for (const [k, a] of [...answers].slice(0, 2)) facts.push(`${k} is super effective on their ${listText(a.foes)}.`);
  if (unanswered.length > 0) facts.push(`Nothing in your party is super effective on their ${listText(unanswered.slice(0, 3))}.`);
  // who stands up to the leader's type
  const sturdy = save.party.filter((m) => typeMultiplier(TYPE_CHART, lt.type, typesOf(m.speciesId)) < 1);
  if (sturdy.length > 0 && answers.size === 0) facts.push(`Your best pick is ${sturdy[0]!.name} (${typeText(sturdy[0]!.speciesId)}): it takes ${typeMultiplier(TYPE_CHART, lt.type, typesOf(sturdy[0]!.speciesId)) === 0 ? 'no' : 'half'} damage from ${lt.type} moves.`);
  // threats, grouped by the foe's creature and move: "Their Bramblecub's Leaf Blade is super effective on your Glimfin and Dustcub."
  const threats = new Map<string, string[]>();
  for (const m of save.party) {
    let worst: { foe: string; move: string; mult: number } | null = null;
    for (const foe of lt.team) {
      const sp = speciesById.get(foe.species);
      if (sp === undefined) continue;
      const b = bestMove(sp.types, movesAtLevel(sp, foe.level), typesOf(m.speciesId));
      if (b !== null && b.mult >= 2 && (worst === null || b.mult > worst.mult)) worst = { foe: foe.species, move: b.move, mult: b.mult };
    }
    if (worst === null) continue;
    const k = `Their ${nameOf(worst.foe)}'s ${worst.move}`;
    threats.set(k, [...(threats.get(k) ?? []), m.name]);
  }
  for (const [k, mine] of [...threats].slice(0, 2)) facts.push(`Watch out: ${k} is super effective on your ${listText(mine)}.`);
  const se = superEffectiveOn([lt.type]);
  const bench = save.box.filter((m) => typesOf(m.speciesId).some((t) => se.includes(t))).sort((a, b) => b.level - a.level);
  if (bench.length > 0) facts.push(`In your box, ${listText(bench.slice(0, 2).map((m) => `${m.name} (${typeText(m.speciesId)}, level ${m.level})`))} could help: ${listText(se)} moves are super effective on ${lt.type}.`);
  else {
    const wild = findTypeFacts(se[0] ?? lt.type, save);
    if (wild.species.length > 0 && se.length > 0) facts.push(`${listText(se)} moves are super effective on ${lt.type}. ${wild.facts[0]!}`);
  }
  if (top - mineTop >= 3) facts.push(`Train about ${top - mineTop} more levels before you go in.`);
  return sheet('matchup', `You against ${lt.name}`, facts, lt.team.map((m) => m.species), [lt.type, ...se.slice(0, 3)]);
}

// ---- what next ------------------------------------------------------------------------------------------------------

export function nextFacts(save: ProfSave): FactSheet {
  const facts: string[] = [];
  const flags = storyFlagSet(save.flags, save.badges);
  const hint = storyHint(flags, save.badges);
  if (save.party.length === 0) facts.push('First get your partner Ewamon: talk to Prof. Wynn in Mirevale.');
  else if (hint !== null) facts.push(`Your next step: ${hint}.`);
  const lt = nextLeague(save);
  const types: TypeName[] = [];
  if (lt !== null) {
    const top = Math.max(...lt.team.map((m) => m.level));
    facts.push(`Next league fight: ${who(lt)}, strongest at level ${top}.`);
    if (save.party.length > 0) {
      const mineTop = Math.max(...save.party.map((m) => m.level));
      if (top - mineTop >= 3) facts.push(`Your highest is level ${mineTop}: train about ${top - mineTop} levels first.`);
      else facts.push(`Your highest is level ${mineTop}, close enough.`);
    }
    facts.push(`${listText(superEffectiveOn([lt.type]))} moves are super effective on ${lt.type}.`);
    types.push(lt.type);
    if (lt.badge !== null) {
      const opens = ZONES.filter((z) => z.gate === lt.badge).map((z) => z.name);
      if (opens.length > 0) facts.push(`The ${badgeName(lt.badge)} opens ${listText(opens.slice(0, 2))}.`);
    }
  } else facts.push('You are the Champion. Rematches with the league, the battle tower and the legendaries are left.');
  return sheet('next', 'What next', facts, [], types);
}

// ---- items ----------------------------------------------------------------------------------------------------------

interface ItemRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: number | null;
}
const ITEM_ROWS: readonly ItemRow[] = [...ITEMS, ...KEY_ITEMS, ...CONSUMABLES, ...EVOLUTION_STONES, ...ORBS].map((i) => ({ id: i.id, name: i.name, description: i.description, price: i.price ?? null }));
const ITEM_NAMES = new Map<string, string>(ITEM_ROWS.map((i) => [i.id, i.name]));

export function itemFacts(itemId: string, save: ProfSave): FactSheet {
  const row = ITEM_ROWS.find((i) => i.id === itemId);
  if (row === undefined) return helpSheet(save);
  const facts = [`${row.name}: ${row.description.replace(/\u2014/g, ',')}`.replace(/([^.!?])$/, '$1.')];
  const have = save.items[itemId] ?? 0;
  if (have > 0) facts.push(`You have ${have}.`);
  const shops = shopsSelling(itemId, save);
  if (shops.length > 0) {
    const open = shops.filter((z) => zoneOpen(z, save));
    if (open.length > 0) facts.push(`Sold in ${listText(open.slice(0, 3).map((z) => z.name))}${row.price !== null ? ` for ${row.price}` : ''}.`);
    else facts.push(`Sold in ${shops[0]!.name}, once you hold the ${badgeName(shops[0]!.gate!)}.`);
  } else facts.push(`No shop sells it.`);
  const evolves = SPECIES.filter((sp) => sp.evolution?.kind === 'item' && sp.evolution.item === itemId);
  if (evolves.length > 0) facts.push(`It evolves ${listText(evolves.slice(0, 4).map((sp) => `${sp.name} into ${nameOf((sp.evolution as { into: string }).into)}`))}.`);
  return sheet('item', row.name, facts, evolves.slice(0, 4).map((sp) => sp.id));
}

// ---- help -----------------------------------------------------------------------------------------------------------

export function helpSheet(save: ProfSave): FactSheet {
  const next = nextFacts(save);
  return sheet('help', 'Ask me about', ['Ask me about an Ewamon, a type, a gym leader, an item, a place, your team or what to do next.', ...next.facts.slice(0, 2)], [], next.types);
}

// ---- reading the question -------------------------------------------------------------------------------------------

const norm = (s: string): string => s.toLowerCase().replace(/[‘’]/g, "'").replace(/'s\b/g, '').replace(/[^a-z0-9' -]+/g, ' ');
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (q: string, word: string): boolean => new RegExp(`(^|[^a-z0-9])${esc(word)}s?($|[^a-z0-9])`).test(q);

/** Names in the question, longest first so "Mire Route" wins over "Mire". */
function matchNames<T>(q: string, rows: readonly { readonly key: string; readonly value: T }[]): T[] {
  const out: T[] = [];
  let rest = q;
  for (const r of rows) {
    if (r.key.length < 3 || !has(rest, r.key)) continue;
    if (!out.includes(r.value)) out.push(r.value);
    rest = rest.replace(new RegExp(esc(r.key), 'g'), ' ');
  }
  return out;
}

const byLength = <T>(rows: { key: string; value: T }[]): { key: string; value: T }[] => rows.sort((a, b) => b.key.length - a.key.length);
const SPECIES_KEYS = byLength(SPECIES.map((sp) => ({ key: sp.name.toLowerCase(), value: sp.id })));
const ZONE_KEYS = byLength(ZONES.flatMap((z) => [{ key: z.name.toLowerCase(), value: z.id }, ...(z.name.includes(',') ? [{ key: z.name.split(',')[0]!.toLowerCase(), value: z.id }] : []), ...(z.name.startsWith('The ') ? [{ key: z.name.slice(4).toLowerCase(), value: z.id }] : [])]));
const ITEM_KEYS = byLength(ITEM_ROWS.map((i) => ({ key: i.name.toLowerCase(), value: i.id })));
const LEAGUE_KEYS = byLength(
  LEAGUE.flatMap((l) => {
    const words = l.name.split(' ');
    const first = l.stage === 'gym' ? words[0]! : words[words.length - 1]!;
    const keys = [l.name.toLowerCase(), first.toLowerCase(), l.id.replace(/_/g, ' ')];
    if (l.stage === 'gym') keys.push(`${zoneName(l.zoneId).toLowerCase()} gym`, `${l.type.toLowerCase()} gym`);
    if (l.stage === 'champion') keys.push('champion');
    if (l.badge !== null) keys.push(badgeName(l.badge).toLowerCase());
    return keys.map((key) => ({ key, value: l.id }));
  }),
);
const TYPE_KEYS = TYPE_NAMES.map((t) => ({ key: t.toLowerCase(), value: t }));

export interface Parsed {
  readonly species: readonly string[];
  readonly types: readonly TypeName[];
  readonly trainers: readonly string[];
  readonly items: readonly string[];
  readonly zones: readonly ZoneId[];
  /** "the next gym", "the gym" without a name */
  readonly nextGym: boolean;
  /** "here", "this route" */
  readonly here: boolean;
}

/** The content names in a question (and the player's nicknames, which name their species). */
export function parseQuestion(question: string, save: ProfSave): Parsed {
  let q = ` ${norm(question)} `;
  const nick = byLength([...save.party, ...save.box].filter((m) => m.name.toLowerCase() !== nameOf(m.speciesId).toLowerCase()).map((m) => ({ key: m.name.toLowerCase(), value: m.speciesId })));
  const trainers = matchNames(q, LEAGUE_KEYS);
  for (const r of LEAGUE_KEYS) if (trainers.includes(r.value)) q = q.replace(new RegExp(esc(r.key), 'g'), ' ');
  const items = matchNames(q, ITEM_KEYS);
  for (const r of ITEM_KEYS) if (items.includes(r.value)) q = q.replace(new RegExp(esc(r.key), 'g'), ' ');
  const zones = matchNames(q, ZONE_KEYS);
  for (const r of ZONE_KEYS) if (zones.includes(r.value)) q = q.replace(new RegExp(esc(r.key), 'g'), ' ');
  const species = [...matchNames(q, SPECIES_KEYS), ...matchNames(q, nick)].filter((v, i, a) => a.indexOf(v) === i);
  // "normal" and "dark" are ordinary words: only as a type when "type" follows
  const types = TYPE_KEYS.filter((t) => (t.key === 'normal' || t.key === 'dark' ? new RegExp(`\\b${t.key}[ -]?types?\\b`).test(q) : has(q, t.key))).map((t) => t.value);
  const nextGym = /\b(next|this|the|a|upcoming) (gym|leader|badge)\b/.test(q) || /\bgym\b/.test(q);
  const here = /\b(here|around here|this (route|town|zone|area|place))\b/.test(q);
  return { species, types, trainers, items, zones, nextGym, here };
}

const EVOLVE = /\bevol|\bgrow up\b/;
const FIND = /\bwhere\b|\bfind\b|\bcatch\b|\bget (a|an|one)\b|\bencounter|\bspawn|\blive|\blocat/;
const BEAT = /\bbeat|\bagainst\b|\bcounter|\bweak|\bstrong(er)?\b|\beffective|\bvs\b|\bversus\b|\bready\b|\bgood enough\b|\bwin\b|\bfight|\bdefeat|\bchance/;
const NEXT = /\bnext\b|\bwhat (should|do|can) i do\b|\bwhat now\b|\bstuck\b|\bwhere (should|do) i go\b|\bgoal\b|\blost\b/;
const TEAM = /\bmy (team|party|ewamon)\b|\bteam (good|ok|okay|strong|balanced)\b/;
const BUY = /\bbuy\b|\bshop\b|\bsell|\bcost|\bprice|\bwhat does\b|\bwhat is\b|\bused for\b|\buse\b/;

/** Whether a type question asks what beats the type or what the type beats. */
export function typeView(q: string, t: TypeName): TypeView {
  const k = t.toLowerCase();
  const T = `${k}(?:[ -]?types?)?(?: moves?| attacks?)?`;
  if (new RegExp(`\\b${T} (?:is |are )?(?:good|strong|super effective|effective|best)(?: against| on| vs)?\\b`).test(q) || new RegExp(`\\bwhat (?:does|do|can) (?:an? )?${T} (?:beat|hit|counter)`).test(q)) return 'attack';
  if (new RegExp(`\\b(?:against|beats?|counters?|vs|versus|on|to) (?:an? |the )?${T}\\b`).test(q) || new RegExp(`\\b${T} (?:is |are )?weak`).test(q) || /\bweak(ness)?\b/.test(q)) return 'defend';
  return 'both';
}

export interface Route {
  readonly tool: ToolName;
  readonly args: ToolArgs;
}

/**
 * The lookup a question needs, from its names and keywords (the deterministic retrieval). `null` in the parsed lists
 * means the question named nothing the professor knows; then the help sheet (the next step and what to ask).
 */
export function routeQuestion(question: string, save: ProfSave): Route {
  const p = parseQuestion(question, save);
  const q = ` ${norm(question)} `;
  const sp = p.species[0];
  const lt = p.trainers[0];
  const beat = BEAT.test(q);
  if (lt !== undefined) return { tool: beat || TEAM.test(q) ? 'team_vs_trainer' : 'trainer_team', args: { trainer: lt, direct: true } };
  if (sp !== undefined && EVOLVE.test(q)) return { tool: 'evolve_info', args: { species: sp } };
  if (sp !== undefined && FIND.test(q)) return { tool: 'where_to_find', args: { species: sp } };
  if (p.types.length > 0 && FIND.test(q) && !beat) return { tool: 'where_to_find', args: { type: p.types[0]! } };
  if (p.nextGym && (beat || TEAM.test(q))) return { tool: 'team_vs_trainer', args: { trainer: 'next', direct: false } };
  if (p.types.length > 0) return { tool: 'type_matchup', args: { types: p.types.slice(0, 2), view: typeView(q, p.types[0]!) } };
  if (sp !== undefined && beat) {
    const t = typesOf(sp);
    return { tool: 'type_matchup', args: { types: t.slice(0, 2), view: 'defend' } };
  }
  if (sp !== undefined) return { tool: 'species_info', args: { species: sp } };
  if (p.items[0] !== undefined) return { tool: 'item_info', args: { item: p.items[0] } };
  if (p.zones[0] !== undefined) return { tool: 'zone_info', args: { zone: p.zones[0] } };
  if (p.here && FIND.test(q)) return { tool: 'zone_info', args: { zone: 'here' } };
  if (p.nextGym) return { tool: 'trainer_team', args: { trainer: 'next', direct: false } };
  if (TEAM.test(q)) return { tool: 'my_team', args: {} };
  if (NEXT.test(q)) return { tool: 'next_goal', args: {} };
  if (BUY.test(q) && p.items.length > 0) return { tool: 'item_info', args: { item: p.items[0]! } };
  return { tool: 'help', args: {} };
}

// ---- the tools ------------------------------------------------------------------------------------------------------

export type ToolName = 'species_info' | 'evolve_info' | 'where_to_find' | 'type_matchup' | 'my_team' | 'next_goal' | 'trainer_team' | 'team_vs_trainer' | 'item_info' | 'zone_info' | 'help';

export interface ToolArgs {
  readonly species?: string;
  readonly type?: string;
  readonly types?: readonly string[];
  readonly trainer?: string;
  readonly item?: string;
  readonly zone?: string;
  readonly direct?: boolean;
  readonly view?: TypeView;
}

/** A species by id or by name (the model writes names). */
export function speciesIdOf(s: string | undefined): string | null {
  if (s === undefined) return null;
  const k = s.trim().toLowerCase();
  if (speciesById.has(k)) return k;
  return SPECIES.find((sp) => sp.name.toLowerCase() === k)?.id ?? null;
}
function typeOf(s: string | undefined): TypeName | null {
  if (s === undefined) return null;
  const k = s.trim().toLowerCase().replace(/[ -]?types?$/, '');
  return TYPE_NAMES.find((t) => t.toLowerCase() === k) ?? null;
}
function leagueOf(s: string | undefined, save: ProfSave): LeagueTrainer | null {
  if (s === undefined || s === 'next' || s === '') return nextLeague(save);
  const k = ` ${norm(s)} `;
  const id = LEAGUE_KEYS.find((r) => r.value === s || has(k, r.key))?.value;
  return LEAGUE.find((l) => l.id === id) ?? null;
}
function itemOf(s: string | undefined): string | null {
  if (s === undefined) return null;
  const k = s.trim().toLowerCase();
  return ITEM_ROWS.find((i) => i.id === k || i.name.toLowerCase() === k)?.id ?? null;
}
function zoneOf(s: string | undefined, save: ProfSave): ZoneId | null {
  if (s === undefined || s === 'here') return save.zoneId;
  const k = s.trim().toLowerCase();
  return ZONE_KEYS.find((r) => r.key === k || r.value === k)?.value ?? null;
}

/** Runs one lookup. Unknown or bad arguments give the help sheet, never a throw. */
export function runTool(tool: ToolName, args: ToolArgs, save: ProfSave): FactSheet {
  switch (tool) {
    case 'species_info': {
      const id = speciesIdOf(args.species);
      return id === null ? helpSheet(save) : speciesFacts(id, save);
    }
    case 'evolve_info': {
      const id = speciesIdOf(args.species);
      return id === null ? helpSheet(save) : evolveFacts(id, save);
    }
    case 'where_to_find': {
      const id = speciesIdOf(args.species);
      if (id !== null) return findSpeciesFacts(id, save);
      const t = typeOf(args.type ?? args.types?.[0]);
      return t === null ? helpSheet(save) : findTypeFacts(t, save);
    }
    case 'type_matchup': {
      const ts = (args.types ?? (args.type !== undefined ? [args.type] : [])).map(typeOf).filter((t): t is TypeName => t !== null);
      return ts.length === 0 ? helpSheet(save) : typeFacts(ts, save, args.view ?? 'both');
    }
    case 'my_team':
      return teamFacts(save);
    case 'next_goal':
      return nextFacts(save);
    case 'trainer_team': {
      const lt = leagueOf(args.trainer, save);
      return lt === null ? nextFacts(save) : trainerFacts(lt, save, args.direct === true);
    }
    case 'team_vs_trainer': {
      const lt = leagueOf(args.trainer, save);
      return lt === null ? teamFacts(save) : matchupFacts(lt, save);
    }
    case 'item_info': {
      const id = itemOf(args.item);
      return id === null ? helpSheet(save) : itemFacts(id, save);
    }
    case 'zone_info': {
      const z = zoneOf(args.zone, save);
      return z === null ? helpSheet(save) : zoneFacts(z, save);
    }
    default:
      return helpSheet(save);
  }
}

/** The answer's facts for a question: route it, run the lookup. */
export function factsFor(question: string, save: ProfSave): FactSheet {
  const r = routeQuestion(question, save);
  return runTool(r.tool, r.args, save);
}

// ---- the grounding guard --------------------------------------------------------------------------------------------

const SPECIES_NAMES: ReadonlySet<string> = new Set(SPECIES.map((sp) => sp.name));

/** Every proper name the game knows: a model answer may only use the ones its facts hold. */
const PROPER_NAMES: readonly string[] = [
  ...SPECIES.map((sp) => sp.name),
  ...ZONES.map((z) => z.name),
  ...ZONES.filter((z) => z.name.includes(',')).map((z) => z.name.split(',')[0]!),
  ...LEAGUE.map((l) => l.name),
  ...LEAGUE.map((l) => l.name.split(' ')[0]!).filter((w) => !['Captain', 'Marshal', 'Warden', 'Champion'].includes(w)),
  ...BADGES.map((b) => b.name),
  ...ITEM_ROWS.map((i) => i.name).filter((n) => n.length > 3),
  ...TYPE_NAMES,
]
  .filter((n, i, a) => a.indexOf(n) === i)
  .sort((a, b) => b.length - a.length);

/**
 * What a model answer says that its facts do not: a game name (species, place, trainer, badge, item, type; matched as
 * written, capitalised) or a number that is not in the facts. Empty = grounded.
 */
export function ungrounded(answer: string, facts: readonly string[], question = '', mine: readonly string[] = []): string[] {
  const src = `${facts.join(' ')} ${question}`;
  const out: string[] = [];
  // "your Bramblecub" when the Bramblecub is the trainer's: the small model swaps sides (see talk/professor.ts)
  const own = new Set(mine.map((n) => n.toLowerCase()));
  for (const m of answer.matchAll(/\b[Yy]our ([A-Z][A-Za-z]+)/g)) {
    const n = m[1]!;
    if (SPECIES_NAMES.has(n) && !own.has(n.toLowerCase())) out.push(`your ${n}`);
  }
  let rest = answer;
  for (const n of PROPER_NAMES) {
    const re = new RegExp(`(^|[^A-Za-z])${esc(n)}($|[^A-Za-z])`);
    if (!re.test(rest)) continue;
    if (!new RegExp(`(^|[^A-Za-z])${esc(n)}($|[^A-Za-z])`, 'i').test(src)) out.push(n);
    rest = rest.replace(new RegExp(esc(n), 'g'), ' ');
  }
  for (const m of answer.matchAll(/\d+/g)) if (!new RegExp(`(^|[^0-9])${m[0]}($|[^0-9])`).test(src)) out.push(m[0]);
  return [...new Set(out)];
}

// ---- the type-claim guard -------------------------------------------------------------------------------------------

const TYPE_ALT = TYPE_NAMES.join('|');
const TYPE_LIST = `(?:${TYPE_ALT})(?:(?:, and |, | and | or )(?:${TYPE_ALT}))*`;
const KIND = '(?:[ -]types?)?(?: moves| attacks| type moves)?';
const typesIn = (list: string): TypeName[] => TYPE_NAMES.filter((t) => new RegExp(`\\b${t}\\b`).test(list));
const mult = (a: TypeName, d: TypeName): number => typeMultiplier(TYPE_CHART, a, [d]);

/**
 * Type claims in a model answer that the chart contradicts ("Psychic and Ghost are strong against Ghost types", the
 * small model turning "Ghost moves are super effective on Psychic and Ghost" around). Each claim names types as the
 * facts do: super effective / strong on, weak to, resists, no effect on. Empty = none wrong.
 */
export function wrongTypeClaims(answer: string): string[] {
  const out: string[] = [];
  const check = (claim: string, ok: boolean): void => {
    if (!ok) out.push(claim.trim());
  };
  const SE = '(?:super effective|very effective|strong|effective|good)';
  for (const m of answer.matchAll(new RegExp(`(${TYPE_LIST})${KIND} (?:is|are) ${SE} (?:on|against) (${TYPE_LIST})`, 'g'))) {
    for (const a of typesIn(m[1]!)) for (const d of typesIn(m[2]!)) check(m[0], mult(a, d) >= 2);
  }
  for (const m of answer.matchAll(new RegExp(`${SE} (?:on|against) (${TYPE_LIST})${KIND},? (?:is|are) (?:the )?(${TYPE_LIST})`, 'gi'))) {
    for (const d of typesIn(m[1]!)) for (const a of typesIn(m[2]!)) check(m[0], mult(a, d) >= 2);
  }
  for (const m of answer.matchAll(new RegExp(`(${TYPE_LIST})${KIND} (?:is|are) weak (?:to|against) (${TYPE_LIST})`, 'g'))) {
    for (const d of typesIn(m[1]!)) for (const a of typesIn(m[2]!)) check(m[0], mult(a, d) >= 2);
  }
  for (const m of answer.matchAll(new RegExp(`(${TYPE_LIST})${KIND} resists? (${TYPE_LIST})`, 'g'))) {
    for (const d of typesIn(m[1]!)) for (const a of typesIn(m[2]!)) check(m[0], mult(a, d) < 1);
  }
  for (const m of answer.matchAll(new RegExp(`(${TYPE_LIST})${KIND} (?:has|have) no effect on (${TYPE_LIST})`, 'g'))) {
    for (const a of typesIn(m[1]!)) for (const d of typesIn(m[2]!)) check(m[0], mult(a, d) === 0);
  }
  return [...new Set(out)];
}
