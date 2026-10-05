/**
 * Display lookups over @ewa/content for the DOM screens. Read-only: nothing here decides game truth — stats are
 * shown "at level" with core's calcStat, exactly the numbers the server uses (§20.9.3).
 */
import { ABILITIES, CONSUMABLES, ITEMS, MOVES, ORBS, SPECIES, allZones, createContentIndex } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { calcMaxHp, calcStat } from '@ewa/core';
import type { AbilityDef, ContentIndex, CreatureInstance, MoveDef, SpeciesDef, TypeName } from '@ewa/core';

let index: ContentIndex | null = null;
export function content(): ContentIndex {
  index ??= createContentIndex();
  return index;
}

const speciesMap = new Map<string, SpeciesDef>(SPECIES.map((sp) => [sp.id, sp]));
const moveMap = new Map<string, MoveDef>(MOVES.map((m) => [m.id, m]));
const abilityMap = new Map<string, AbilityDef>(ABILITIES.map((a) => [a.id, a]));

export const SPECIES_BY_DEX: readonly SpeciesDef[] = [...SPECIES].sort((a, b) => a.dexNumber - b.dexNumber);
export const DEX_TOTAL = SPECIES_BY_DEX.length;

export function species(id: string): SpeciesDef | undefined {
  return speciesMap.get(id);
}
export function move(id: string): MoveDef | undefined {
  return moveMap.get(id);
}
export function ability(id: string): AbilityDef | undefined {
  return abilityMap.get(id);
}

export function speciesName(id: string): string {
  return speciesMap.get(id)?.name ?? id;
}

export function primaryType(id: string): TypeName {
  return speciesMap.get(id)?.types[0] ?? 'Normal';
}

export function displayName(c: Pick<CreatureInstance, 'nickname' | 'speciesId'>): string {
  return c.nickname ?? speciesName(c.speciesId);
}

export function maxHpOf(c: Pick<CreatureInstance, 'speciesId' | 'level'>): number {
  const sp = speciesMap.get(c.speciesId);
  return sp === undefined ? 1 : calcMaxHp(sp.baseHp, c.level);
}

export interface StatLine {
  readonly key: 'hp' | 'atk' | 'def' | 'spd';
  readonly label: string;
  readonly value: number;
  readonly base: number;
}

export function statsOf(c: Pick<CreatureInstance, 'speciesId' | 'level'>): readonly StatLine[] {
  const sp = speciesMap.get(c.speciesId);
  if (sp === undefined) return [];
  return [
    { key: 'hp', label: 'HP', value: calcMaxHp(sp.baseHp, c.level), base: sp.baseHp },
    { key: 'atk', label: 'Attack', value: calcStat(sp.baseAtk, c.level), base: sp.baseAtk },
    { key: 'def', label: 'Defense', value: calcStat(sp.baseDef, c.level), base: sp.baseDef },
    { key: 'spd', label: 'Speed', value: calcStat(sp.baseSpd, c.level), base: sp.baseSpd },
  ];
}

// ---- items ----------------------------------------------------------------------------------------------

export type ItemKind = 'held' | 'key' | 'consumable' | 'orb';
export interface ItemInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: ItemKind;
  /** buy price as content lists it (the shop's GET response is authoritative for the shop screen) */
  readonly price: number | null;
  readonly sellPrice: number;
  readonly usableInBattle: boolean;
}

const itemMap = new Map<string, ItemInfo>();
for (const i of ITEMS) {
  // held/key items have no sell price in v1 (server priceOf: sell = none)
  itemMap.set(i.id, { id: i.id, name: i.name, description: i.description, kind: i.slot, price: i.price, sellPrice: 0, usableInBattle: false });
}
for (const c of CONSUMABLES) {
  itemMap.set(c.id, { id: c.id, name: c.name, description: c.description, kind: 'consumable', price: c.price, sellPrice: c.sellPrice, usableInBattle: c.usableInBattle });
}
for (const o of ORBS) {
  itemMap.set(o.id, { id: o.id, name: o.name, description: o.description, kind: 'orb', price: o.price, sellPrice: o.sellPrice, usableInBattle: true });
}

export function itemInfo(id: string): ItemInfo {
  return itemMap.get(id) ?? { id, name: id, description: '', kind: 'consumable', price: null, sellPrice: 0, usableInBattle: false };
}

export const HELD_ITEMS: readonly ItemInfo[] = [...itemMap.values()].filter((i) => i.kind === 'held');

/** Consumable effects the server applies to one creature outside battle (`POST /item/use` with a target). */
const CREATURE_EFFECTS: ReadonlySet<string> = new Set(['healHp', 'revive', 'cureStatus', 'fullRestore', 'restorePp', 'rareCandy']);
/** Field items usable on a creature from its panel, in content order. */
export const CREATURE_ITEMS: readonly ItemInfo[] = CONSUMABLES.filter((c) => CREATURE_EFFECTS.has(c.effect.kind)).map((c) => itemInfo(c.id));
/** True for items whose effect can be applied several times in one request (`qty` > 1). */
export const MULTI_USE_ITEMS: ReadonlySet<string> = new Set(CONSUMABLES.filter((c) => c.effect.kind === 'rareCandy').map((c) => c.id));

// ---- zones ----------------------------------------------------------------------------------------------

const zoneNames = new Map<string, string>(allZones().map((z) => [z.id, z.name]));
export function zoneName(id: ZoneId | string | null | undefined): string {
  if (id === null || id === undefined) return 'Unknown';
  return zoneNames.get(id) ?? id;
}

export function zonesWithShop(): readonly ZoneId[] {
  return allZones()
    .filter((z) => z.shop !== null)
    .map((z) => z.id);
}

/** Evolution chain containing `id`, root first (linear chains; branches are listed in content order). */
export function evolutionChain(id: string): readonly SpeciesDef[] {
  let root = speciesMap.get(id);
  const seen = new Set<string>();
  while (root !== undefined && root.evolvesFrom !== null && !seen.has(root.id)) {
    seen.add(root.id);
    root = speciesMap.get(root.evolvesFrom);
  }
  if (root === undefined) return [];
  const out: SpeciesDef[] = [root];
  for (let i = 0; i < out.length && out.length < 6; i++) {
    const cur = out[i]!;
    for (const sp of SPECIES_BY_DEX) if (sp.evolvesFrom === cur.id && !out.includes(sp)) out.push(sp);
  }
  return out;
}
