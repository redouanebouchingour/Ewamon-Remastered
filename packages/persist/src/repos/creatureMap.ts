import type { CreatureRow, NewCreatureRow } from '../schema/index';
import type { CreatureInstance, SlotKind, VariantKey } from '../types';

/** A CreatureInstance plus where it sits — what persist knows and core does not. */
export interface CreatureRecord extends CreatureInstance {
  readonly slotKind: SlotKind;
  readonly slotIndex: number;
  readonly version: number;
}

export function rowToCreature(r: CreatureRow): CreatureInstance {
  return {
    id: r.id,
    ownerId: r.ownerId,
    speciesId: r.speciesId,
    nickname: r.nickname,
    level: r.level,
    exp: r.exp,
    hp: r.hp,
    moves: r.moves,
    status: r.status,
    ability: r.ability,
    heldItem: r.heldItem,
    variantKey: r.variantKey as VariantKey,
    isAlpha: r.isAlpha,
    ...(r.isShiny ? { isShiny: true } : {}),
    caughtAt: r.caughtZoneId !== null && r.caughtAt !== null ? { zoneId: r.caughtZoneId, at: r.caughtAt.getTime() } : null,
    ...(r.honor !== 0 ? { honor: r.honor } : {}),
    ribbons: r.ribbons,
    favorite: r.favorite,
    locked: r.locked,
  };
}

export function rowToRecord(r: CreatureRow): CreatureRecord {
  return { ...rowToCreature(r), slotKind: r.slotKind, slotIndex: r.slotIndex, version: r.version };
}

export type CreatureColumns = Omit<NewCreatureRow, 'id' | 'ownerId' | 'slotKind' | 'slotIndex' | 'version'>;

/** The writable columns of a CreatureInstance (everything but id / owner / slot / version). */
export function creatureToColumns(c: Omit<CreatureInstance, 'id' | 'ownerId'>): CreatureColumns {
  return {
    speciesId: c.speciesId,
    nickname: c.nickname,
    level: c.level,
    exp: c.exp,
    hp: c.hp,
    moves: [...c.moves],
    status: [...c.status],
    ability: c.ability,
    heldItem: c.heldItem,
    variantKey: c.variantKey,
    isAlpha: c.isAlpha,
    isShiny: c.isShiny === true,
    caughtZoneId: c.caughtAt?.zoneId ?? null,
    caughtAt: c.caughtAt ? new Date(c.caughtAt.at) : null,
    honor: c.honor ?? 0,
    ribbons: [...c.ribbons],
    favorite: c.favorite,
    locked: c.locked,
  };
}
