/**
 * §50.4.4 `transfer.test.ts` — `transferCreature` (spine §5.2): ownership and slot move in one transaction, locked,
 * audited; the typed refusals write nothing; a later failure rolls the transfer back; `release` refuses a creature with
 * marketplace history. (Phase E5: the transfer cases moved here from creatures.test.ts, plus the byte-identical and
 * listed-release cases.)
 */
import { canonicalJson } from '@ewa/core';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb, Tx } from '../src/db';
import { auditRepo } from '../src/repos/audit';
import { creatureRepo } from '../src/repos/creatures';
import { marketRepo } from '../src/repos/market';
import { creatureInstances } from '../src/schema/index';
import { T0, expectPersistError, mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

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

/** canonicalJson of both players' creature rows (slot + version included) and the audit row count. */
async function snapshot(tx: Tx, a: string, b: string): Promise<{ json: string; rows: number; audit: number }> {
  const recs = [...(await creatureRepo.byOwner(tx, a)), ...(await creatureRepo.byOwner(tx, b))];
  const [n] = await tx.select({ n: sql<number>`count(*)::int` }).from(creatureInstances);
  return { json: canonicalJson(recs), rows: Number(n!.n), audit: (await auditRepo.recent(tx, { action: 'creature.transfer' })).length };
}

describe('transferCreature (§5.2) — atomic, locked, audited', () => {
  it('a failure later in the same transaction rolls the transfer back: nothing moved, no audit row', async () => {
    const { a, b, aBox } = await setup();
    const before = await db.transaction((tx) => snapshot(tx, a, b));
    await expect(
      db.transaction(async (tx) => {
        await creatureRepo.transferCreature(tx, aBox, a, b, 'gift', T0);
        // the transfer has been written inside this tx…
        expect((await creatureRepo.byId(tx, aBox))!.ownerId).toBe(b);
        throw new Error('boom: simulated failure after the transfer');
      }),
    ).rejects.toThrow(/boom/);
    await db.transaction(async (tx) => {
      expect(await snapshot(tx, a, b)).toEqual(before);
      const rec = await creatureRepo.recordById(tx, aBox);
      expect(rec).toMatchObject({ ownerId: a, slotKind: 'box', slotIndex: 0 });
      expect(await creatureRepo.box(tx, b, 0, 10)).toEqual([]);
    });
  });

  it("moves the creature to the recipient's next box slot and writes exactly one audit creature.transfer", async () => {
    const { a, b, aBox } = await setup();
    const auditBefore = await db.transaction(async (tx) => (await auditRepo.recent(tx, { action: 'creature.transfer' })).length);
    await db.transaction(async (tx) => {
      await mkCreature(tx, b, { kind: 'box', index: 0 }); // recipient already has box[0]
      await creatureRepo.transferCreature(tx, aBox, a, b, 'gift', T0);
    });
    await db.transaction(async (tx) => {
      const rec = await creatureRepo.recordById(tx, aBox);
      expect(rec).toMatchObject({ ownerId: b, slotKind: 'box', slotIndex: 1, version: 1 });
      expect(await creatureRepo.box(tx, a, 0, 10)).toEqual([]);
      const audit = (await auditRepo.recent(tx, { action: 'creature.transfer' })).filter((e) => e.subject === aBox);
      expect(audit).toHaveLength(1);
      expect((await auditRepo.recent(tx, { action: 'creature.transfer' })).length).toBe(auditBefore + 1);
      expect(audit[0]).toMatchObject({ actorId: a, subject: aBox, detail: { from: a, to: b, reason: 'gift', speciesId: 'cindercap' } });
    });
  });

  it('NotOwner / Locked / PartyMinimum: thrown, and both players\' rows stay byte-identical (canonicalJson, row count, audit)', async () => {
    const { a, b, aParty, aBox } = await setup();
    const stranger = await db.transaction((tx) => mkPlayer(tx));
    // lock the boxed creature and drop to one party member, committed, before the refusals
    await db.transaction(async (tx) => {
      const boxed = (await creatureRepo.byId(tx, aBox))!;
      await creatureRepo.update(tx, { ...boxed, locked: true });
      await creatureRepo.transferCreature(tx, aParty[0]!, a, b, 'trade', T0);
    });
    const before = await db.transaction((tx) => snapshot(tx, a, b));
    await expectPersistError('NotOwner', () => db.transaction((tx) => creatureRepo.transferCreature(tx, aParty[1]!, stranger, b, 'gift', T0)));
    await expectPersistError('Locked', () => db.transaction((tx) => creatureRepo.transferCreature(tx, aBox, a, b, 'trade', T0)));
    await expectPersistError('PartyMinimum', () => db.transaction((tx) => creatureRepo.transferCreature(tx, aParty[1]!, a, b, 'trade', T0)));
    await expectPersistError('InvalidArgument', () => db.transaction((tx) => creatureRepo.transferCreature(tx, aBox, a, a, 'gift', T0)));
    await db.transaction(async (tx) => {
      expect(await snapshot(tx, a, b)).toEqual(before);
      expect((await creatureRepo.recordById(tx, aParty[1]!))!).toMatchObject({ ownerId: a, slotKind: 'party' });
      expect((await creatureRepo.recordById(tx, aBox))!).toMatchObject({ ownerId: a, slotKind: 'box', locked: true });
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

  it('release of a creature that was ever listed → InvalidArgument (listings keep their history)', async () => {
    const { a, aParty } = await setup();
    const listing = await db.transaction((tx) =>
      marketRepo.create(tx, { sellerId: a, creatureId: aParty[1]!, startingBid: 100, buyNowPrice: null, durationHours: 12 }, T0),
    );
    await db.transaction((tx) => marketRepo.cancel(tx, listing.id, a, T0));
    await db.transaction(async (tx) => {
      // back in the seller's box after the cancel — still refused
      expect((await creatureRepo.recordById(tx, aParty[1]!))!.ownerId).toBe(a);
      await expectPersistError('InvalidArgument', () => creatureRepo.release(tx, aParty[1]!, a));
      expect(await creatureRepo.byId(tx, aParty[1]!)).not.toBeNull();
    });
  });
});
