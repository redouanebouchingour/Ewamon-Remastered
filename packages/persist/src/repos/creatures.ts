import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { PARTY_MAX, PARTY_REORDER_OFFSET } from '../constants';
import type { Tx } from '../db';
import { fail } from '../errors';
import { creatureEvents, creatureInstances, listings } from '../schema/index';
import type { CreatureRow } from '../schema/index';
import type { CreatureEventDetail, CreatureHistory, CreatureInstance, SlotKind } from '../types';
import { auditRepo } from './audit';
import { creatureToColumns, rowToCreature, rowToRecord } from './creatureMap';
import type { CreatureRecord } from './creatureMap';
import { playerRepo } from './players';

export type SlotTarget = { readonly kind: 'party'; readonly index: number } | { readonly kind: 'box'; readonly index: number | 'nextBox' };

export type TransferReason = 'trade' | 'marketSale' | 'gift';

const ci = creatureInstances;

async function lockRow(tx: Tx, id: string): Promise<CreatureRow> {
  const [row] = await tx.select().from(ci).where(eq(ci.id, id)).for('update');
  if (!row) fail('NotFound', `creature ${id}`);
  return row;
}

/**
 * Lock order everywhere in persist is player row(s) FIRST, creature row SECOND (lockForTransfer,
 * insert, swap, market.create all do this). A path that locked the creature first and then its
 * owner would deadlock against a concurrent transfer. So: peek the owner without a lock, lock the
 * owner, lock the creature, and refuse if the owner changed in between (the caller retries).
 */
async function lockOwnerThenRow(tx: Tx, id: string, expectedOwner: string | null): Promise<CreatureRow> {
  let ownerId = expectedOwner;
  if (ownerId === null) {
    const [peek] = await tx.select({ ownerId: ci.ownerId }).from(ci).where(eq(ci.id, id)).limit(1);
    if (!peek) fail('NotFound', `creature ${id}`);
    ownerId = peek.ownerId;
  }
  await playerRepo.lock(tx, ownerId);
  const row = await lockRow(tx, id);
  if (row.ownerId !== ownerId) fail('NotOwner', `creature ${id} is owned by ${row.ownerId}`);
  return row;
}

async function partyCount(tx: Tx, ownerId: string): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(ci)
    .where(and(eq(ci.ownerId, ownerId), eq(ci.slotKind, 'party')));
  return Number(r?.n ?? 0);
}

/** Next free index in `kind` for `ownerId` (max + 1). Callers hold the owner's player-row lock. */
async function nextIndex(tx: Tx, ownerId: string, kind: SlotKind): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`coalesce(max(${ci.slotIndex}), -1) + 1` })
    .from(ci)
    .where(and(eq(ci.ownerId, ownerId), eq(ci.slotKind, kind)));
  return Number(r?.n ?? 0);
}

async function slotTaken(tx: Tx, ownerId: string, kind: SlotKind, index: number, exceptId: string | null): Promise<boolean> {
  const [r] = await tx
    .select({ id: ci.id })
    .from(ci)
    .where(and(eq(ci.ownerId, ownerId), eq(ci.slotKind, kind), eq(ci.slotIndex, index)))
    .limit(1);
  return r !== undefined && r.id !== exceptId;
}

/**
 * Resolves a slot request to a concrete (kind, index) for `ownerId`, refusing party indices outside
 * 0..5 or already occupied. 'nextBox' means "next free index of the target kind".
 */
async function resolveSlot(tx: Tx, ownerId: string, kind: SlotKind, index: number | 'nextBox', exceptId: string | null): Promise<number> {
  if (index === 'nextBox') {
    if (kind === 'party') fail('InvalidSlot', 'party slots are explicit (0..5)');
    return nextIndex(tx, ownerId, kind);
  }
  if (!Number.isInteger(index) || index < 0) fail('InvalidSlot', `slot index ${index}`);
  if (kind === 'party' && index >= PARTY_MAX) fail('InvalidSlot', `party slot ${index}`);
  if (await slotTaken(tx, ownerId, kind, index, exceptId)) fail('InvalidSlot', `${kind}[${index}] is occupied`);
  return index;
}

export const creatureRepo = {
  /** ordered by slot_index */
  async party(tx: Tx, ownerId: string): Promise<CreatureInstance[]> {
    const rows = await tx
      .select()
      .from(ci)
      .where(and(eq(ci.ownerId, ownerId), eq(ci.slotKind, 'party')))
      .orderBy(asc(ci.slotIndex));
    return rows.map(rowToCreature);
  },

  async box(tx: Tx, ownerId: string, offset: number, limit: number): Promise<CreatureInstance[]> {
    const rows = await tx
      .select()
      .from(ci)
      .where(and(eq(ci.ownerId, ownerId), eq(ci.slotKind, 'box')))
      .orderBy(asc(ci.slotIndex))
      .limit(Math.max(0, limit))
      .offset(Math.max(0, offset));
    return rows.map(rowToCreature);
  },

  /** Every creature of an owner in any slot kind, with slot info. */
  async byOwner(tx: Tx, ownerId: string): Promise<CreatureRecord[]> {
    const rows = await tx.select().from(ci).where(eq(ci.ownerId, ownerId)).orderBy(asc(ci.slotKind), asc(ci.slotIndex));
    return rows.map(rowToRecord);
  },

  async byId(tx: Tx, id: string): Promise<CreatureInstance | null> {
    const [row] = await tx.select().from(ci).where(eq(ci.id, id)).limit(1);
    return row ? rowToCreature(row) : null;
  },

  async recordById(tx: Tx, id: string): Promise<CreatureRecord | null> {
    const [row] = await tx.select().from(ci).where(eq(ci.id, id)).limit(1);
    return row ? rowToRecord(row) : null;
  },

  /** SELECT … FOR UPDATE on the creature row alone (owner must already be locked by the caller). */
  async lock(tx: Tx, id: string): Promise<CreatureRecord> {
    return rowToRecord(await lockRow(tx, id));
  },

  /** SELECT … FOR UPDATE on both owners' player rows (ascending uuid) and then the creature row. */
  async lockForTransfer(tx: Tx, id: string, fromOwner: string, toOwner: string): Promise<CreatureRecord> {
    await playerRepo.lockMany(tx, [fromOwner, toOwner]);
    return rowToRecord(await lockRow(tx, id));
  },

  /**
   * Inserts a new creature into `slot`. Locks the owner row so `nextBox` is race-free. `firstEvent`: the history's first
   * entry in place of the `met` it would write (breeding: `hatched`).
   */
  async insert(tx: Tx, c: Omit<CreatureInstance, 'id'>, slot: SlotTarget, firstEvent?: Extract<CreatureEventDetail, { kind: 'hatched' }>): Promise<CreatureInstance> {
    if (c.ownerId === null) fail('InvalidArgument', 'persisted creatures have an owner');
    const ownerId = c.ownerId;
    const owner = await playerRepo.lock(tx, ownerId);
    // spine §5.2: PartyFull when the party index is taken or the party already has 6 (Phase E5 — was InvalidSlot)
    if (slot.kind === 'party' && Number.isInteger(slot.index) && (slot.index as number) >= 0 && (slot.index as number) < PARTY_MAX) {
      if ((await partyCount(tx, ownerId)) >= PARTY_MAX || (await slotTaken(tx, ownerId, 'party', slot.index as number, null))) fail('PartyFull', `party[${slot.index}] is taken`);
    }
    const slotIndex = await resolveSlot(tx, ownerId, slot.kind, slot.index, null);
    const [row] = await tx
      .insert(ci)
      .values({ ...creatureToColumns(c), ownerId, slotKind: slot.kind, slotIndex, originalTrainerId: ownerId, originalTrainerName: owner.username })
      .returning();
    // creature history: how its first owner got it (a catch keeps the catch time; a starter or a gift is now)
    const met: CreatureEventDetail = firstEvent ?? { kind: 'met', how: c.caughtAt !== null ? 'caught' : 'received', speciesId: c.speciesId, level: c.level, zoneId: c.caughtAt?.zoneId ?? null, trainer: owner.username };
    await tx.insert(creatureEvents).values({ creatureId: row!.id, kind: met.kind, detail: met, ...(c.caughtAt !== null ? { at: new Date(c.caughtAt.at) } : {}) });
    return rowToCreature(row!);
  },

  /** Full-row write of the instance fields (not owner/slot); version + 1. */
  async update(tx: Tx, c: CreatureInstance): Promise<void> {
    const res = await tx
      .update(ci)
      .set({ ...creatureToColumns(c), version: sql`${ci.version} + 1` })
      .where(eq(ci.id, c.id))
      .returning({ id: ci.id });
    if (res.length === 0) fail('NotFound', `creature ${c.id}`);
  },

  /**
   * Two-phase renumber in one transaction: park every party row at slot_index + 100, then write the
   * final 0..n-1. The unique index (owner, kind, index) never sees a duplicate at any point.
   */
  async reorderParty(tx: Tx, ownerId: string, orderedIds: readonly string[]): Promise<void> {
    await playerRepo.lock(tx, ownerId);
    const current = await tx
      .select({ id: ci.id })
      .from(ci)
      .where(and(eq(ci.ownerId, ownerId), eq(ci.slotKind, 'party')))
      .orderBy(asc(ci.slotIndex));
    const have = new Set(current.map((r) => r.id));
    const want = new Set(orderedIds);
    if (orderedIds.length !== current.length || want.size !== have.size || [...want].some((id) => !have.has(id))) {
      fail('InvalidReorder', 'orderedIds must be a permutation of the current party');
    }
    if (orderedIds.length === 0) return;
    await tx
      .update(ci)
      .set({ slotIndex: sql`${ci.slotIndex} + ${PARTY_REORDER_OFFSET}`, version: sql`${ci.version} + 1` })
      .where(and(eq(ci.ownerId, ownerId), eq(ci.slotKind, 'party')));
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(ci).set({ slotIndex: i }).where(and(eq(ci.id, orderedIds[i]!), eq(ci.ownerId, ownerId)));
    }
  },

  /** Moves one creature to another slot of its owner; refuses to empty the party. */
  async moveToSlot(tx: Tx, id: string, kind: SlotKind, index: number | 'nextBox'): Promise<void> {
    const row = await lockOwnerThenRow(tx, id, null);
    if (row.slotKind === 'party' && kind !== 'party' && (await partyCount(tx, row.ownerId)) <= 1) fail('PartyMinimum');
    if (row.slotKind !== 'party' && kind === 'party' && (await partyCount(tx, row.ownerId)) >= PARTY_MAX) fail('PartyFull');
    const slotIndex = await resolveSlot(tx, row.ownerId, kind, index, id);
    await tx
      .update(ci)
      .set({ slotKind: kind, slotIndex, version: sql`${ci.version} + 1` })
      .where(eq(ci.id, id));
  },

  /** Swaps a party member with a box creature in one transaction (party count unchanged). */
  async swap(tx: Tx, ownerId: string, partyId: string, boxId: string): Promise<void> {
    await playerRepo.lock(tx, ownerId);
    const rows = await tx.select().from(ci).where(inArray(ci.id, [partyId, boxId])).for('update');
    const p = rows.find((r) => r.id === partyId);
    const b = rows.find((r) => r.id === boxId);
    if (!p || !b) fail('NotFound');
    if (p.ownerId !== ownerId || b.ownerId !== ownerId) fail('NotOwner');
    if (p.slotKind !== 'party' || b.slotKind !== 'box') fail('InvalidSlot');
    // park, then place: the unique index is never violated mid-way
    await tx.update(ci).set({ slotIndex: sql`${ci.slotIndex} + ${PARTY_REORDER_OFFSET}` }).where(eq(ci.id, partyId));
    await tx.update(ci).set({ slotKind: 'party', slotIndex: p.slotIndex, version: sql`${ci.version} + 1` }).where(eq(ci.id, boxId));
    await tx.update(ci).set({ slotKind: 'box', slotIndex: b.slotIndex, version: sql`${ci.version} + 1` }).where(eq(ci.id, partyId));
  },

  /**
   * Atomic ownership transfer. Locks via lockForTransfer, asserts current owner === fromOwner and
   * !locked, rewrites owner_id + slot to (box, nextBox) of toOwner, writes audit 'creature.transfer'.
   * Throws NotOwner | Locked | PartyMinimum.
   */
  async transferCreature(tx: Tx, id: string, fromOwner: string, toOwner: string, reason: TransferReason, now: Date): Promise<void> {
    if (fromOwner === toOwner) fail('InvalidArgument', 'transfer to self');
    const c = await creatureRepo.lockForTransfer(tx, id, fromOwner, toOwner);
    if (c.ownerId !== fromOwner) fail('NotOwner');
    if (c.locked) fail('Locked');
    if (c.slotKind === 'party' && (await partyCount(tx, fromOwner)) <= 1) fail('PartyMinimum');
    const slotIndex = await nextIndex(tx, toOwner, 'box');
    await tx
      .update(ci)
      .set({ ownerId: toOwner, slotKind: 'box', slotIndex, version: sql`${ci.version} + 1` })
      .where(eq(ci.id, id));
    await auditRepo.write(
      tx,
      { actorId: fromOwner, action: 'creature.transfer', subject: id, detail: { from: fromOwner, to: toOwner, reason, speciesId: c.speciesId, level: c.level } },
      now,
    );
    // creature history: the change of hands, with both names as they are now
    const names = new Map((await playerRepo.byIds(tx, [fromOwner, toOwner])).map((p) => [p.id, p.username]));
    const kind = reason === 'trade' ? 'traded' : reason === 'marketSale' ? 'sold' : 'gift';
    await creatureRepo.addEvent(tx, [id], { kind, from: names.get(fromOwner) ?? '', to: names.get(toOwner) ?? '' }, now);
  },

  /** Creature history: one event for each of `ids` (a party that won a badge shares one), at `now`. */
  async addEvent(tx: Tx, ids: readonly string[], detail: CreatureEventDetail, now: Date): Promise<void> {
    if (ids.length === 0) return;
    await tx.insert(creatureEvents).values(ids.map((creatureId) => ({ creatureId, kind: detail.kind, detail, at: now })));
  },

  /** Creature history: the original trainer and the events, oldest first (at most 200); null for an unknown creature. */
  async history(tx: Tx, id: string): Promise<CreatureHistory | null> {
    const [row] = await tx.select({ name: ci.originalTrainerName }).from(ci).where(eq(ci.id, id)).limit(1);
    if (!row) return null;
    const rows = await tx.select().from(creatureEvents).where(eq(creatureEvents.creatureId, id)).orderBy(asc(creatureEvents.at), asc(creatureEvents.id)).limit(200);
    return { originalTrainer: row.name, events: rows.map((r) => ({ detail: r.detail as unknown as CreatureEventDetail, at: r.at })) };
  },

  /** Deletes a party/box creature. Refuses locked; refuses the last party member; refuses listed/escrowed. */
  async release(tx: Tx, id: string, ownerId: string): Promise<void> {
    const row = await lockOwnerThenRow(tx, id, ownerId);
    if (row.locked) fail('Locked');
    if (row.slotKind !== 'party' && row.slotKind !== 'box') fail('InvalidSlot', `cannot release from ${row.slotKind}`);
    if (row.slotKind === 'party' && (await partyCount(tx, ownerId)) <= 1) fail('PartyMinimum');
    const [listed] = await tx.select({ id: listings.id }).from(listings).where(eq(listings.creatureId, id)).limit(1);
    if (listed) fail('InvalidArgument', 'creature has marketplace history; see IMPLEMENTATION-NOTES.md');
    await tx.delete(ci).where(eq(ci.id, id));
  },
};

export type CreatureRepo = typeof creatureRepo;
