import { and, asc, eq, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { fail } from '../errors';
import { creatureInstances, daycare, eggs } from '../schema/index';
import type { EggParent, EggRow } from '../schema/index';
import type { VariantKey } from '../types';
import { rowToRecord } from './creatureMap';
import type { CreatureRecord } from './creatureMap';

export type EggPlace = 'party' | 'box';

export interface Egg {
  readonly id: string;
  readonly ownerId: string;
  readonly place: EggPlace;
  readonly speciesId: string;
  readonly stepsTotal: number;
  readonly stepsWalked: number;
  readonly honor: number;
  readonly variantKey: VariantKey;
  readonly ability: string;
  readonly moves: readonly string[];
  readonly isShiny: boolean;
  readonly bandborn: boolean;
  readonly parents: readonly EggParent[];
  readonly zoneId: string;
  readonly laidAt: Date;
}

export type NewEgg = Omit<Egg, 'id' | 'stepsWalked' | 'laidAt'>;

function toEgg(r: EggRow): Egg {
  return {
    id: r.id,
    ownerId: r.ownerId,
    place: r.place as EggPlace,
    speciesId: r.speciesId,
    stepsTotal: r.stepsTotal,
    stepsWalked: r.stepsWalked,
    honor: r.honor,
    variantKey: r.variantKey as VariantKey,
    ability: r.ability,
    moves: r.moves,
    isShiny: r.isShiny,
    bandborn: r.bandborn,
    parents: r.parents,
    zoneId: r.zoneId,
    laidAt: r.laidAt,
  };
}

/**
 * Breeding (migration 0016). The Daycare's pair are creature rows in the `daycare` slot kind (moved with
 * `creatures.moveToSlot`); this repo keeps the egg timer and the eggs. Callers hold the player-row lock for writes.
 */
export const breedingRepo = {
  /** The creatures left at the Daycare, in the order they were left. */
  async pair(tx: Tx, ownerId: string): Promise<CreatureRecord[]> {
    const rows = await tx
      .select()
      .from(creatureInstances)
      .where(and(eq(creatureInstances.ownerId, ownerId), eq(creatureInstances.slotKind, 'daycare')))
      .orderBy(asc(creatureInstances.slotIndex));
    return rows.map(rowToRecord);
  },

  /** When the keeper has the next egg ready; null while the pair cannot breed (or nothing was ever left). */
  async eggAt(tx: Tx, ownerId: string): Promise<Date | null> {
    const [r] = await tx.select({ at: daycare.eggAt }).from(daycare).where(eq(daycare.playerId, ownerId)).limit(1);
    return r?.at ?? null;
  },

  async setEggAt(tx: Tx, ownerId: string, at: Date | null): Promise<void> {
    await tx.insert(daycare).values({ playerId: ownerId, eggAt: at }).onConflictDoUpdate({ target: daycare.playerId, set: { eggAt: at } });
  },

  /** Every egg of the owner, carried first, then oldest first. */
  async eggs(tx: Tx, ownerId: string): Promise<Egg[]> {
    const rows = await tx.select().from(eggs).where(eq(eggs.ownerId, ownerId)).orderBy(sql`${eggs.place} = 'box'`, asc(eggs.laidAt), asc(eggs.id));
    return rows.map(toEgg);
  },

  async insertEgg(tx: Tx, e: NewEgg, now: Date): Promise<Egg> {
    const [row] = await tx
      .insert(eggs)
      .values({ ...e, moves: [...e.moves], parents: [...e.parents], laidAt: now })
      .returning();
    return toEgg(row!);
  },

  /** Carries an egg or puts it in the box. NotFound for anyone else's egg. */
  async moveEgg(tx: Tx, ownerId: string, id: string, place: EggPlace): Promise<void> {
    const res = await tx
      .update(eggs)
      .set({ place })
      .where(and(eq(eggs.id, id), eq(eggs.ownerId, ownerId)))
      .returning({ id: eggs.id });
    if (res.length === 0) fail('NotFound', `egg ${id}`);
  },

  /** The steps the owner walked count for every carried egg (capped at each egg's total). Returns the carried eggs after. */
  async addSteps(tx: Tx, ownerId: string, steps: number): Promise<Egg[]> {
    const n = Math.max(0, Math.floor(steps));
    if (n > 0) {
      await tx
        .update(eggs)
        .set({ stepsWalked: sql`least(${eggs.stepsTotal}, ${eggs.stepsWalked} + ${n})` })
        .where(and(eq(eggs.ownerId, ownerId), eq(eggs.place, 'party')));
    }
    const rows = await tx
      .select()
      .from(eggs)
      .where(and(eq(eggs.ownerId, ownerId), eq(eggs.place, 'party')))
      .orderBy(asc(eggs.laidAt), asc(eggs.id));
    return rows.map(toEgg);
  },

  /** Removes a carried egg that has walked all its steps (the caller inserts the hatchling); null when it is not one. */
  async takeHatched(tx: Tx, ownerId: string, id: string): Promise<Egg | null> {
    const [row] = await tx
      .delete(eggs)
      .where(and(eq(eggs.id, id), eq(eggs.ownerId, ownerId), eq(eggs.place, 'party'), sql`${eggs.stepsWalked} >= ${eggs.stepsTotal}`))
      .returning();
    return row === undefined ? null : toEgg(row);
  },
};

export type BreedingRepo = typeof breedingRepo;
