import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Tx } from '../db';
import { nemeses } from '../schema/index';
import type { NemesisMemoryJson, NemesisRow } from '../schema/index';
import type { VariantKey } from '../types';

export type NemesisStatus = 'active' | 'beaten' | 'caught' | 'faded';

export interface Nemesis {
  readonly id: string;
  readonly ownerId: string;
  readonly speciesId: string;
  readonly level: number;
  readonly name: string;
  readonly title: string;
  readonly scar: string;
  readonly move: string | null;
  readonly rank: number;
  readonly ability: string;
  readonly variantKey: VariantKey;
  readonly isShiny: boolean;
  readonly isAlpha: boolean;
  readonly bornZone: string;
  readonly lastZone: string;
  readonly memory: NemesisMemoryJson;
  readonly status: NemesisStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewNemesis = Omit<Nemesis, 'id' | 'rank' | 'status' | 'createdAt' | 'updatedAt' | 'lastZone'>;

function toNemesis(r: NemesisRow): Nemesis {
  return {
    id: r.id,
    ownerId: r.ownerId,
    speciesId: r.speciesId,
    level: r.level,
    name: r.name,
    title: r.title,
    scar: r.scar,
    move: r.move,
    rank: r.rank,
    ability: r.ability,
    variantKey: r.variantKey as VariantKey,
    isShiny: r.isShiny,
    isAlpha: r.isAlpha,
    bornZone: r.bornZone,
    lastZone: r.lastZone,
    memory: r.memory,
    status: r.status as NemesisStatus,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Nemeses (migration 0017, content nemesis.ts): one trainer's promoted wild creatures. */
export const nemesisRepo = {
  /** The trainer's active nemeses, newest first. */
  async active(tx: Tx, ownerId: string): Promise<Nemesis[]> {
    const rows = await tx
      .select()
      .from(nemeses)
      .where(and(eq(nemeses.ownerId, ownerId), eq(nemeses.status, 'active')))
      .orderBy(desc(nemeses.createdAt), desc(nemeses.id));
    return rows.map(toNemesis);
  },

  async of(tx: Tx, id: string): Promise<Nemesis | null> {
    const [r] = await tx.select().from(nemeses).where(eq(nemeses.id, id)).limit(1);
    return r === undefined ? null : toNemesis(r);
  },

  /** A new nemesis rises (rank 1, last seen where it rose); beyond `max` active the oldest fade. Returns it and the faded. */
  async rise(tx: Tx, n: NewNemesis, max: number, now: Date): Promise<{ nemesis: Nemesis; faded: Nemesis[] }> {
    const [row] = await tx
      .insert(nemeses)
      .values({ ...n, memory: { ...n.memory }, lastZone: n.bornZone, rank: 1, status: 'active', createdAt: now, updatedAt: now })
      .returning();
    const active = await nemesisRepo.active(tx, n.ownerId);
    const over = active.slice(Math.max(0, max));
    if (over.length > 0) {
      await tx
        .update(nemeses)
        .set({ status: 'faded', updatedAt: now })
        .where(
          inArray(
            nemeses.id,
            over.map((x) => x.id),
          ),
        );
    }
    return { nemesis: toNemesis(row!), faded: over.map((x) => ({ ...x, status: 'faded' as const })) };
  },

  /** It beat or escaped its trainer again: the new rank, level and memory, met in `zoneId`. */
  async rankUp(tx: Tx, id: string, p: { readonly rank: number; readonly level: number; readonly memory: NemesisMemoryJson; readonly zoneId: string }, now: Date): Promise<Nemesis | null> {
    const [row] = await tx
      .update(nemeses)
      .set({ rank: p.rank, level: p.level, memory: { ...p.memory }, lastZone: p.zoneId, updatedAt: now })
      .where(and(eq(nemeses.id, id), eq(nemeses.status, 'active')))
      .returning();
    return row === undefined ? null : toNemesis(row);
  },

  /** The trainer met it in `zoneId` and the fight settled nothing (they ran before anything happened). */
  async seen(tx: Tx, id: string, zoneId: string, now: Date): Promise<void> {
    await tx
      .update(nemeses)
      .set({ lastZone: zoneId, updatedAt: now })
      .where(and(eq(nemeses.id, id), eq(nemeses.status, 'active')));
  },

  /** Its story ends: knocked out or caught. False when it was no longer active. */
  async end(tx: Tx, id: string, status: 'beaten' | 'caught', zoneId: string, now: Date): Promise<boolean> {
    const rows = await tx
      .update(nemeses)
      .set({ status, lastZone: zoneId, updatedAt: now })
      .where(and(eq(nemeses.id, id), eq(nemeses.status, 'active')))
      .returning({ id: nemeses.id });
    return rows.length > 0;
  },
};

export type NemesisRepo = typeof nemesisRepo;
