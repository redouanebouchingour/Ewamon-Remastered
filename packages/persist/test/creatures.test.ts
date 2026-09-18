import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { auditRepo } from '../src/repos/audit';
import { creatureToColumns } from '../src/repos/creatureMap';
import { creatureRepo } from '../src/repos/creatures';
import { creatureInstances } from '../src/schema/index';
import type { CreatureInstance } from '../src/types';
import { T0, creatureFixture, expectDbError, expectPersistError, mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('CreatureInstance round-trip (§2.8)', () => {
  it('persists and reads back every field, including the status array and moves jsonb', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      const full = creatureFixture(owner, {
        speciesId: 'glimfin',
        nickname: 'Sparky',
        level: 37,
        exp: 50653,
        hp: 91,
        moves: [
          { id: 'spark', pp: 20, ppMax: 20 },
          { id: 'tail_whip', pp: 0, ppMax: 30 },
          { id: 'charge', pp: 15, ppMax: 20 },
          { id: 'discharge', pp: 5, ppMax: 5 },
        ],
        status: ['paralyze', 'confuse'],
        ability: 'static',
        heldItem: 'leftovers',
        variantKey: 'dusk',
        isAlpha: true,
        caughtAt: { zoneId: 'galvan_route', at: Date.UTC(2026, 8, 17, 8, 30, 0, 0) },
        ribbons: ['league_bloom', 'first_catch'],
        favorite: true,
        locked: true,
      });
      const inserted = await creatureRepo.insert(tx, full, { kind: 'party', index: 0 });
      expect(inserted.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(inserted).toEqual({ ...full, id: inserted.id });

      const read = await creatureRepo.byId(tx, inserted.id);
      expect(read).toEqual({ ...full, id: inserted.id });
      expect(read!.status).toEqual(['paralyze', 'confuse']);
      expect(read!.moves).toHaveLength(4);
      expect(read!.caughtAt).toEqual({ zoneId: 'galvan_route', at: Date.UTC(2026, 8, 17, 8, 30, 0, 0) });

      const rec = await creatureRepo.recordById(tx, inserted.id);
      expect(rec).toMatchObject({ slotKind: 'party', slotIndex: 0, version: 0 });
    });
  });

  it('null nickname / heldItem / caughtAt survive; update() rewrites the row and bumps version', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      const c = await mkCreature(tx, owner, { kind: 'box', index: 'nextBox' });
      expect(c.nickname).toBeNull();
      expect(c.heldItem).toBeNull();
      expect(c.caughtAt).toBeNull();
      const next: CreatureInstance = { ...c, hp: 0, status: ['burn'], moves: [{ id: 'tackle', pp: 34, ppMax: 35 }], nickname: 'Bram', level: 6, exp: 216 };
      await creatureRepo.update(tx, next);
      expect(await creatureRepo.byId(tx, c.id)).toEqual(next);
      expect((await creatureRepo.recordById(tx, c.id))!.version).toBe(1);
    });
  });

  it('the CHECKs reject level outside 1..100 and negative hp', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      await expectDbError(/creature_level_ck/, () => mkCreature(tx, owner, { kind: 'box', index: 0 }, { level: 101 }));
    });
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      await expectDbError(/creature_hp_ck/, () => mkCreature(tx, owner, { kind: 'box', index: 0 }, { hp: -1 }));
    });
  });
});

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

  it('refuses an occupied party slot, a party index >= 6 and nextBox for the party', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      await mkCreature(tx, owner, { kind: 'party', index: 0 });
      await expectPersistError('InvalidSlot', () => mkCreature(tx, owner, { kind: 'party', index: 0 }));
      await expectPersistError('InvalidSlot', () => mkCreature(tx, owner, { kind: 'party', index: 6 }));
      await expectPersistError('InvalidSlot', () => creatureRepo.insert(tx, creatureFixture(owner), { kind: 'party', index: 'nextBox' } as never));
    });
  });

  it('the unique index itself rejects a duplicate (owner, slot_kind, slot_index) written around the repo', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      await mkCreature(tx, owner, { kind: 'box', index: 3 });
      await expectDbError(/creature_owner_slot_uq/, () =>
        tx.insert(creatureInstances).values({ ...creatureToColumns(creatureFixture(owner)), ownerId: owner, slotKind: 'box', slotIndex: 3 }),
      );
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
      // nothing left parked in the 100..105 staging band
      const parked = await tx
        .select({ id: creatureInstances.id })
        .from(creatureInstances)
        .where(and(eq(creatureInstances.ownerId, owner), eq(creatureInstances.slotKind, 'party')));
      expect(parked).toHaveLength(6);
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

  it('moveToSlot / swap keep the party between 1 and 6 members', async () => {
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
    });
  });
});

describe('transferCreature (§5.2) — atomic, locked, audited', () => {
  async function setup(): Promise<{ a: string; b: string; aParty: string[]; aBox: string }> {
    return db.transaction(async (tx) => {
      const a = await mkPlayer(tx);
      const b = await mkPlayer(tx);
      const p0 = await mkCreature(tx, a, { kind: 'party', index: 0 });
      const p1 = await mkCreature(tx, a, { kind: 'party', index: 1 });
      const box = await mkCreature(tx, a, { kind: 'box', index: 'nextBox' }, { speciesId: 'cindercap' });
      await mkCreature(tx, b, { kind: 'party', index: 0 });
      return { a, b, aParty: [p0.id, p1.id], aBox: box.id };
    });
  }

  it('a failure later in the same transaction rolls the transfer back: nothing moved, no audit row', async () => {
    const { a, b, aBox } = await setup();
    await expect(
      db.transaction(async (tx) => {
        await creatureRepo.transferCreature(tx, aBox, a, b, 'gift', T0);
        // the transfer has been written inside this tx…
        expect((await creatureRepo.byId(tx, aBox))!.ownerId).toBe(b);
        throw new Error('boom: simulated failure after the transfer');
      }),
    ).rejects.toThrow(/boom/);
    await db.transaction(async (tx) => {
      const rec = await creatureRepo.recordById(tx, aBox);
      expect(rec).toMatchObject({ ownerId: a, slotKind: 'box', slotIndex: 0 });
      expect(await creatureRepo.box(tx, b, 0, 10)).toEqual([]);
      expect(await auditRepo.recent(tx, { action: 'creature.transfer' })).toEqual([]);
    });
  });

  it('moves the creature to the recipient\'s next box slot and writes audit creature.transfer', async () => {
    const { a, b, aBox } = await setup();
    await db.transaction(async (tx) => {
      await mkCreature(tx, b, { kind: 'box', index: 0 }); // recipient already has box[0]
      await creatureRepo.transferCreature(tx, aBox, a, b, 'gift', T0);
    });
    await db.transaction(async (tx) => {
      const rec = await creatureRepo.recordById(tx, aBox);
      expect(rec).toMatchObject({ ownerId: b, slotKind: 'box', slotIndex: 1, version: 1 });
      expect(await creatureRepo.box(tx, a, 0, 10)).toEqual([]);
      const audit = await auditRepo.recent(tx, { action: 'creature.transfer' });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ actorId: a, subject: aBox, detail: { from: a, to: b, reason: 'gift', speciesId: 'cindercap' } });
    });
  });

  it('throws NotOwner / Locked / PartyMinimum and leaves the row untouched', async () => {
    const { a, b, aParty, aBox } = await setup();
    await db.transaction(async (tx) => {
      const stranger = await mkPlayer(tx);
      await expectPersistError('NotOwner', () => creatureRepo.transferCreature(tx, aBox, stranger, b, 'gift', T0));
      await expectPersistError('InvalidArgument', () => creatureRepo.transferCreature(tx, aBox, a, a, 'gift', T0));
      const boxed = (await creatureRepo.byId(tx, aBox))!;
      await creatureRepo.update(tx, { ...boxed, locked: true });
      await expectPersistError('Locked', () => creatureRepo.transferCreature(tx, aBox, a, b, 'trade', T0));
      // party of 2: the first transfer is fine, the second would empty it
      await creatureRepo.transferCreature(tx, aParty[0]!, a, b, 'trade', T0);
      await expectPersistError('PartyMinimum', () => creatureRepo.transferCreature(tx, aParty[1]!, a, b, 'trade', T0));
      expect((await creatureRepo.recordById(tx, aParty[1]!))!).toMatchObject({ ownerId: a, slotKind: 'party' });
      expect((await creatureRepo.recordById(tx, aBox))!).toMatchObject({ ownerId: a, slotKind: 'box' });
    });
  });

  it('release refuses locked creatures and the last party member, otherwise deletes', async () => {
    const { a, aParty, aBox } = await setup();
    await db.transaction(async (tx) => {
      const boxed = (await creatureRepo.byId(tx, aBox))!;
      await creatureRepo.update(tx, { ...boxed, locked: true });
      await expectPersistError('Locked', () => creatureRepo.release(tx, aBox, a));
      await creatureRepo.update(tx, boxed);
      await creatureRepo.release(tx, aBox, a);
      expect(await creatureRepo.byId(tx, aBox)).toBeNull();
      await creatureRepo.release(tx, aParty[0]!, a);
      await expectPersistError('PartyMinimum', () => creatureRepo.release(tx, aParty[1]!, a));
      const other = await mkPlayer(tx);
      await expectPersistError('NotOwner', () => creatureRepo.release(tx, aParty[1]!, other));
    });
  });
});
