/**
 * §50.4.4 `slots.test.ts` — the slot model (spine §5.1): the `(owner_id, slot_kind, slot_index)` unique index IS the
 * party/box; `reorderParty` is a two-phase renumber through the 100..105 staging band; `creature_party_slot_ck`;
 * `moveToSlot` / `swap` / `insert` refusals. (Phase E5: the slot cases moved here from creatures.test.ts.)
 */
import { and, between, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb, Tx } from '../src/db';
import { creatureToColumns } from '../src/repos/creatureMap';
import { creatureRepo } from '../src/repos/creatures';
import { creatureInstances } from '../src/schema/index';
import { creatureFixture, expectDbError, expectPersistError, mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

/** A raw row write around the repo — only the database constraints stand in the way. */
function rawInsert(tx: Tx, owner: string, slotKind: 'party' | 'box', slotIndex: number) {
  return tx.insert(creatureInstances).values({ ...creatureToColumns(creatureFixture(owner)), ownerId: owner, slotKind, slotIndex });
}

describe('slots and party reorder (§5.1 unique (owner, slot_kind, slot_index))', () => {
  it('party() is ordered by slot_index regardless of insert order; nextBox appends', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      const c2 = await mkCreature(tx, owner, { kind: 'party', index: 2 }, { speciesId: 'c2' });
      const c0 = await mkCreature(tx, owner, { kind: 'party', index: 0 }, { speciesId: 'c0' });
      const c1 = await mkCreature(tx, owner, { kind: 'party', index: 1 }, { speciesId: 'c1' });
      expect((await creatureRepo.party(tx, owner)).map((c) => c.id)).toEqual([c0.id, c1.id, c2.id]);
      const b0 = await mkCreature(tx, owner, { kind: 'box', index: 'nextBox' });
      const b1 = await mkCreature(tx, owner, { kind: 'box', index: 'nextBox' });
      const recs = await creatureRepo.byOwner(tx, owner);
      expect(recs.find((r) => r.id === b0.id)!.slotIndex).toBe(0);
      expect(recs.find((r) => r.id === b1.id)!.slotIndex).toBe(1);
      expect((await creatureRepo.box(tx, owner, 1, 10)).map((c) => c.id)).toEqual([b1.id]);
    });
  });

  it('insert into a taken party index → PartyFull (spine §5.2); a party index ≥ 6 or nextBox for the party → InvalidSlot', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      await mkCreature(tx, owner, { kind: 'party', index: 0 });
      await expectPersistError('PartyFull', () => mkCreature(tx, owner, { kind: 'party', index: 0 }));
      await expectPersistError('InvalidSlot', () => mkCreature(tx, owner, { kind: 'party', index: 6 }));
      await expectPersistError('InvalidSlot', () => creatureRepo.insert(tx, creatureFixture(owner), { kind: 'party', index: 'nextBox' } as never));
      for (let i = 1; i < 6; i++) await mkCreature(tx, owner, { kind: 'party', index: i });
      await expectPersistError('PartyFull', () => mkCreature(tx, owner, { kind: 'party', index: 3 }));
      expect(await creatureRepo.party(tx, owner)).toHaveLength(6);
    });
  });

  it('the unique index itself rejects a duplicate party slot and a duplicate box slot written around the repo', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      await mkCreature(tx, owner, { kind: 'box', index: 3 });
      await expectDbError(/creature_owner_slot_uq/, () => rawInsert(tx, owner, 'box', 3));
    });
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      await mkCreature(tx, owner, { kind: 'party', index: 2 });
      await expectDbError(/creature_owner_slot_uq/, () => rawInsert(tx, owner, 'party', 2));
    });
  });

  it('creature_party_slot_ck rejects party index 6, 99 and 106; accepts 0..5 and the 100..105 staging band', async () => {
    for (const bad of [6, 99, 106, -1]) {
      await db.transaction(async (tx) => {
        const owner = await mkPlayer(tx);
        await expectDbError(/creature_party_slot_ck/, () => rawInsert(tx, owner, 'party', bad));
      });
    }
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      for (const ok of [0, 1, 2, 3, 4, 5, 100, 101, 102, 103, 104, 105]) await rawInsert(tx, owner, 'party', ok);
      // the check binds the party only: a box index is any non-negative integer
      await rawInsert(tx, owner, 'box', 106);
      expect((await creatureRepo.byOwner(tx, owner)).length).toBe(13);
    });
  });

  it('reorderParty renumbers 0..n-1 in the requested order and never leaves a duplicate', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) ids.push((await mkCreature(tx, owner, { kind: 'party', index: i }, { speciesId: `s${i}` })).id);
      const order = [ids[5]!, ids[3]!, ids[0]!, ids[4]!, ids[1]!, ids[2]!];
      await creatureRepo.reorderParty(tx, owner, order);
      const party = await creatureRepo.party(tx, owner);
      expect(party.map((c) => c.id)).toEqual(order);
      const recs = (await creatureRepo.byOwner(tx, owner)).filter((r) => r.slotKind === 'party');
      expect(recs.map((r) => r.slotIndex).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(new Set(recs.map((r) => `${r.slotKind}:${r.slotIndex}`)).size).toBe(6);
    });
  });

  it('a swap of slots 0 and 1 commits, and no row is left in the 100..105 staging band after commit', async () => {
    const { owner, a, b } = await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      const a = await mkCreature(tx, owner, { kind: 'party', index: 0 });
      const b = await mkCreature(tx, owner, { kind: 'party', index: 1 });
      await mkCreature(tx, owner, { kind: 'party', index: 2 });
      return { owner, a: a.id, b: b.id };
    });
    const third = await db.transaction(async (tx) => (await creatureRepo.party(tx, owner))[2]!.id);
    await db.transaction((tx) => creatureRepo.reorderParty(tx, owner, [b, a, third]));
    await db.transaction(async (tx) => {
      expect((await creatureRepo.party(tx, owner)).map((c) => c.id)).toEqual([b, a, third]);
      const parked = await tx
        .select({ id: creatureInstances.id })
        .from(creatureInstances)
        .where(and(eq(creatureInstances.ownerId, owner), eq(creatureInstances.slotKind, 'party'), between(creatureInstances.slotIndex, 100, 105)));
      expect(parked).toEqual([]);
    });
  });

  it('reorderParty rejects anything that is not a permutation of the current party', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      const other = await mkPlayer(tx);
      const a = await mkCreature(tx, owner, { kind: 'party', index: 0 });
      const b = await mkCreature(tx, owner, { kind: 'party', index: 1 });
      const foreign = await mkCreature(tx, other, { kind: 'party', index: 0 });
      await expectPersistError('InvalidReorder', () => creatureRepo.reorderParty(tx, owner, [a.id]));
      await expectPersistError('InvalidReorder', () => creatureRepo.reorderParty(tx, owner, [a.id, a.id]));
      await expectPersistError('InvalidReorder', () => creatureRepo.reorderParty(tx, owner, [a.id, foreign.id]));
      await creatureRepo.reorderParty(tx, owner, [b.id, a.id]);
      expect((await creatureRepo.party(tx, owner)).map((c) => c.id)).toEqual([b.id, a.id]);
    });
  });

  it("moveToSlot(…, 'box', 'nextBox') picks max + 1 (gaps are not refilled)", async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      await mkCreature(tx, owner, { kind: 'party', index: 0 });
      const p1 = await mkCreature(tx, owner, { kind: 'party', index: 1 });
      await mkCreature(tx, owner, { kind: 'box', index: 0 });
      await mkCreature(tx, owner, { kind: 'box', index: 3 });
      await creatureRepo.moveToSlot(tx, p1.id, 'box', 'nextBox');
      expect(await creatureRepo.recordById(tx, p1.id)).toMatchObject({ slotKind: 'box', slotIndex: 4 });
    });
  });

  it('moveToSlot / swap keep the party between 1 and 6 members; swap with a full party succeeds', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      const only = await mkCreature(tx, owner, { kind: 'party', index: 0 });
      await expectPersistError('PartyMinimum', () => creatureRepo.moveToSlot(tx, only.id, 'box', 'nextBox'));
      for (let i = 1; i < 6; i++) await mkCreature(tx, owner, { kind: 'party', index: i });
      const boxed = await mkCreature(tx, owner, { kind: 'box', index: 'nextBox' });
      await expectPersistError('PartyFull', () => creatureRepo.moveToSlot(tx, boxed.id, 'party', 0));
      await creatureRepo.swap(tx, owner, only.id, boxed.id);
      expect((await creatureRepo.recordById(tx, boxed.id))!).toMatchObject({ slotKind: 'party', slotIndex: 0 });
      expect((await creatureRepo.recordById(tx, only.id))!).toMatchObject({ slotKind: 'box', slotIndex: 0 });
      expect(await creatureRepo.party(tx, owner)).toHaveLength(6);
    });
  });
});
