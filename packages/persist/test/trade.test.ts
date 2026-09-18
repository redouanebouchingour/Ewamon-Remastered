import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb, Tx } from '../src/db';
import type { AuditRow } from '../src/schema/index';
import { auditRepo } from '../src/repos/audit';
import { creatureRepo } from '../src/repos/creatures';
import { historyRepo } from '../src/repos/history';
import { T0, mkCreature, mkPlayer, money, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

interface Sides {
  a: string;
  b: string;
  aGives: string;
  bGives: string;
}

/** A (5000) and B (1000) each have two party members and one creature parked in trade_escrow. */
async function sides(): Promise<Sides> {
  return db.transaction(async (tx) => {
    const a = await mkPlayer(tx, undefined, 5000);
    const b = await mkPlayer(tx, undefined, 1000);
    await mkCreature(tx, a, { kind: 'party', index: 0 });
    await mkCreature(tx, b, { kind: 'party', index: 0 });
    const aGives = await mkCreature(tx, a, { kind: 'party', index: 1 }, { speciesId: 'glimfin', level: 12 });
    const bGives = await mkCreature(tx, b, { kind: 'party', index: 1 }, { speciesId: 'cindercap', level: 9 });
    await creatureRepo.moveToSlot(tx, aGives.id, 'trade_escrow', 0);
    await creatureRepo.moveToSlot(tx, bGives.id, 'trade_escrow', 0);
    return { a, b, aGives: aGives.id, bGives: bGives.id };
  });
}

/** creature.transfer audit rows about this fixture's two creatures (the audit table is shared across the file). */
async function transferAudits(tx: Tx, s: Sides): Promise<AuditRow[]> {
  return (await auditRepo.recent(tx, { action: 'creature.transfer' })).filter((e) => e.subject === s.aGives || e.subject === s.bGives);
}

async function snapshot(s: Sides): Promise<{ aOwner: string; bOwner: string; aMoney: number; bMoney: number; aSlot: string; bSlot: string }> {
  return db.transaction(async (tx) => {
    const ra = (await creatureRepo.recordById(tx, s.aGives))!;
    const rb = (await creatureRepo.recordById(tx, s.bGives))!;
    return { aOwner: ra.ownerId!, bOwner: rb.ownerId!, aMoney: await money(tx, s.a), bMoney: await money(tx, s.b), aSlot: ra.slotKind, bSlot: rb.slotKind };
  });
}

describe('trade completion — one transaction, two-way transfer (§5.2)', () => {
  it('swaps creatures and money atomically and records both history rows plus an audit entry', async () => {
    const s = await sides();
    const tradeId = randomUUID();
    await db.transaction((tx) =>
      historyRepo.completeTrade(tx, tradeId, { playerId: s.a, creatureIds: [s.aGives], money: 500 }, { playerId: s.b, creatureIds: [s.bGives], money: 0 }, T0),
    );
    expect(await snapshot(s)).toEqual({ aOwner: s.b, bOwner: s.a, aMoney: 4500, bMoney: 1500, aSlot: 'box', bSlot: 'box' });
    await db.transaction(async (tx) => {
      expect((await creatureRepo.box(tx, s.a, 0, 10)).map((c) => c.id)).toEqual([s.bGives]);
      expect((await creatureRepo.box(tx, s.b, 0, 10)).map((c) => c.id)).toEqual([s.aGives]);
      const ha = await historyRepo.trades(tx, s.a, 1, 10);
      const hb = await historyRepo.trades(tx, s.b, 1, 10);
      expect(ha).toHaveLength(1);
      expect(hb).toHaveLength(1);
      expect(ha[0]).toMatchObject({ tradeId, partnerId: s.b, sent: [{ id: s.aGives, speciesId: 'glimfin', level: 12 }], received: [{ id: s.bGives, speciesId: 'cindercap', level: 9 }], moneySent: 500, moneyReceived: 0 });
      expect(hb[0]).toMatchObject({ tradeId, partnerId: s.a, sent: [{ id: s.bGives, speciesId: 'cindercap', level: 9 }], received: [{ id: s.aGives, speciesId: 'glimfin', level: 12 }], moneySent: 0, moneyReceived: 500 });
      expect((await auditRepo.recent(tx, { action: 'trade.complete' })).filter((e) => e.subject === tradeId)).toHaveLength(1);
      expect(await transferAudits(tx, s)).toHaveLength(2);
    });
  });

  it('InsufficientFunds anywhere rolls back everything: no creature moves, no money moves, no history', async () => {
    const s = await sides();
    const before = await snapshot(s);
    await expect(
      db.transaction((tx) =>
        historyRepo.completeTrade(tx, randomUUID(), { playerId: s.a, creatureIds: [s.aGives], money: 0 }, { playerId: s.b, creatureIds: [s.bGives], money: 2000 }, T0),
      ),
    ).rejects.toMatchObject({ code: 'InsufficientFunds' });
    expect(await snapshot(s)).toEqual(before);
    expect(before).toMatchObject({ aOwner: s.a, bOwner: s.b, aMoney: 5000, bMoney: 1000, aSlot: 'trade_escrow', bSlot: 'trade_escrow' });
    await db.transaction(async (tx) => {
      expect(await historyRepo.trades(tx, s.a, 1, 10)).toEqual([]);
      expect(await historyRepo.trades(tx, s.b, 1, 10)).toEqual([]);
      expect(await transferAudits(tx, s)).toEqual([]);
    });
  });

  it('a creature that is not in trade_escrow, not owned by the side, or locked aborts the whole trade', async () => {
    const s = await sides();
    const before = await snapshot(s);
    const extra = await db.transaction((tx) => mkCreature(tx, s.a, { kind: 'box', index: 'nextBox' }));
    const run = (aIds: string[], bIds: string[]) =>
      db.transaction((tx) => historyRepo.completeTrade(tx, randomUUID(), { playerId: s.a, creatureIds: aIds, money: 0 }, { playerId: s.b, creatureIds: bIds, money: 0 }, T0));
    await expect(run([s.aGives, extra.id], [s.bGives])).rejects.toMatchObject({ code: 'NotInEscrow' });
    await expect(run([s.bGives], [s.aGives])).rejects.toMatchObject({ code: 'NotOwner' });
    await expect(run([s.aGives], [randomUUID()])).rejects.toMatchObject({ code: 'NotFound' });
    await expect(run([s.aGives, s.aGives], [])).rejects.toMatchObject({ code: 'InvalidArgument' });
    await expect(run([], [])).rejects.toMatchObject({ code: 'InvalidArgument' });
    await db.transaction(async (tx) => {
      const c = (await creatureRepo.byId(tx, s.bGives))!;
      await creatureRepo.update(tx, { ...c, locked: true });
    });
    await expect(run([s.aGives], [s.bGives])).rejects.toMatchObject({ code: 'Locked' });
    expect(await snapshot(s)).toEqual(before);
  });

  it('a failure injected after the transfers (e.g. the caller\'s own follow-up) rolls the swap back too', async () => {
    const s = await sides();
    const before = await snapshot(s);
    await expect(
      db.transaction(async (tx) => {
        await historyRepo.completeTrade(tx, randomUUID(), { playerId: s.a, creatureIds: [s.aGives], money: 100 }, { playerId: s.b, creatureIds: [s.bGives], money: 0 }, T0);
        expect((await creatureRepo.byId(tx, s.aGives))!.ownerId).toBe(s.b);
        throw new Error('boom after trade');
      }),
    ).rejects.toThrow(/boom/);
    expect(await snapshot(s)).toEqual(before);
  });
});
