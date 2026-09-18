import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MARKET, MIN_BID_INCREMENT } from '../src/constants';
import type { AnyDb } from '../src/db';
import { isPersistError } from '../src/errors';
import { auditRepo } from '../src/repos/audit';
import { creatureRepo } from '../src/repos/creatures';
import { marketFee, marketRepo } from '../src/repos/market';
import type { ListingView } from '../src/types';
import { DATABASE_URL, T0, at, mkCreature, mkPlayer, money, openTestDb, rejectsInTx } from './helpers';

const HOUR = 3_600_000;
const RICH = 1_000_000;

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

interface Fixture {
  seller: string;
  creature: string;
  bidders: string[];
  listing: ListingView;
}

/** A seller (money 0) with two party members lists the second one at T0; `n` bidders with RICH money each. */
async function fixture(n: number, over: { startingBid?: number; buyNowPrice?: number | null; durationHours?: 12 | 24 | 48; speciesId?: string } = {}): Promise<Fixture> {
  return db.transaction(async (tx) => {
    const seller = await mkPlayer(tx, undefined, 0);
    await mkCreature(tx, seller, { kind: 'party', index: 0 });
    const c = await mkCreature(tx, seller, { kind: 'party', index: 1 }, { speciesId: over.speciesId ?? 'glimfin', level: 30, variantKey: 'dawn' });
    const bidders: string[] = [];
    for (let i = 0; i < n; i++) bidders.push(await mkPlayer(tx, undefined, RICH));
    const listing = await marketRepo.create(
      tx,
      { sellerId: seller, creatureId: c.id, startingBid: over.startingBid ?? 100, buyNowPrice: over.buyNowPrice ?? null, durationHours: over.durationHours ?? 12 },
      T0,
    );
    return { seller, creature: c.id, bidders, listing };
  });
}

const listingById = (id: string): Promise<ListingView> => db.transaction(async (tx) => (await marketRepo.byId(tx, id))!);

describe('MarketRepo.create', () => {
  it('moves the creature into the listing slot kind and denormalises species/level/variant', async () => {
    const f = await fixture(0, { buyNowPrice: 5000 });
    expect(f.listing).toMatchObject({ sellerId: f.seller, creatureId: f.creature, speciesId: 'glimfin', level: 30, variantKey: 'dawn', isAlpha: false, startingBid: 100, currentBid: null, currentBidderId: null, buyNowPrice: 5000, status: 'active', resolvedAt: null });
    expect(f.listing.expiresAt.getTime()).toBe(T0.getTime() + 12 * HOUR);
    await db.transaction(async (tx) => {
      expect(await marketRepo.creatureSlot(tx, f.creature)).toEqual({ ownerId: f.seller, slotKind: 'listing', slotIndex: 0 });
      expect((await creatureRepo.party(tx, f.seller)).map((c) => c.id)).not.toContain(f.creature);
      expect(await marketRepo.myActive(tx, f.seller)).toHaveLength(1);
      expect((await auditRepo.recent(tx, { action: 'listing.create' })).some((e) => e.subject === f.listing.id)).toBe(true);
    });
  });

  it('validates startingBid >= 100, buyNow > startingBid, duration ∈ {12,24,48}, ownership, lock and party minimum', async () => {
    const { seller, only, locked, other } = await db.transaction(async (tx) => {
      const seller = await mkPlayer(tx);
      const only = await mkCreature(tx, seller, { kind: 'party', index: 0 });
      const locked = await mkCreature(tx, seller, { kind: 'box', index: 0 }, { locked: true });
      const other = await mkPlayer(tx);
      return { seller, only: only.id, locked: locked.id, other };
    });
    const base = { sellerId: seller, creatureId: only, startingBid: 100, buyNowPrice: null, durationHours: 12 as const };
    await rejectsInTx(db, 'InvalidArgument', (tx) => marketRepo.create(tx, { ...base, startingBid: MARKET.minStartingBid - 1 }, T0));
    await rejectsInTx(db, 'InvalidArgument', (tx) => marketRepo.create(tx, { ...base, buyNowPrice: 100 }, T0));
    await rejectsInTx(db, 'InvalidArgument', (tx) => marketRepo.create(tx, { ...base, durationHours: 6 as unknown as 12 }, T0));
    await rejectsInTx(db, 'NotOwner', (tx) => marketRepo.create(tx, { ...base, sellerId: other }, T0));
    await rejectsInTx(db, 'Locked', (tx) => marketRepo.create(tx, { ...base, creatureId: locked }, T0));
    await rejectsInTx(db, 'PartyMinimum', (tx) => marketRepo.create(tx, base, T0));
    await db.transaction(async (tx) => {
      expect(await marketRepo.myActive(tx, seller)).toEqual([]);
      expect((await creatureRepo.recordById(tx, only))!).toMatchObject({ slotKind: 'party', slotIndex: 0 });
    });
  });
});

describe('MarketRepo.placeBid — serial correctness', () => {
  it('20 sequential bids: final high bid = max, one current bidder, escrow = current bid, losers refunded', async () => {
    const f = await fixture(5);
    const amounts: number[] = [];
    const winners: string[] = [];
    for (let i = 0; i < 20; i++) {
      const bidder = f.bidders[i % f.bidders.length]!;
      const amount = 100 + i * (MIN_BID_INCREMENT + 3); // strictly rising by 53 → always >= previous + 50
      amounts.push(amount);
      winners.push(bidder);
      const view = await db.transaction((tx) => marketRepo.placeBid(tx, f.listing.id, bidder, amount, at(i * 1000)));
      expect(view.currentBid).toBe(amount);
      expect(view.currentBidderId).toBe(bidder);
    }
    const max = Math.max(...amounts);
    await db.transaction(async (tx) => {
      const l = (await marketRepo.byId(tx, f.listing.id))!;
      expect(l.status).toBe('active');
      expect(l.currentBid).toBe(max);
      expect(l.currentBid).toBe(amounts[19]);
      expect(l.currentBidderId).toBe(winners[19]);
      const bids = await marketRepo.bidsFor(tx, f.listing.id);
      expect(bids).toHaveLength(20);
      expect([...bids].map((b) => b.amount).sort((a, b) => a - b)).toEqual([...amounts].sort((a, b) => a - b));
      expect(bids[0]).toMatchObject({ amount: max, bidderId: winners[19] }); // newest first
      // escrow accounting: exactly the winning bid is held; every other bidder is whole again
      let escrowed = 0;
      for (const b of f.bidders) {
        const m = await money(tx, b);
        escrowed += RICH - m;
        if (b !== l.currentBidderId) expect(m).toBe(RICH);
      }
      expect(escrowed).toBe(max);
      expect(await money(tx, l.currentBidderId!)).toBe(RICH - max);
      expect(await money(tx, f.seller)).toBe(0); // the seller is paid at close, never at bid time
      expect(await marketRepo.myBids(tx, l.currentBidderId!)).toHaveLength(1);
      expect((await auditRepo.recent(tx, { action: 'listing.bid' })).filter((e) => e.subject === f.listing.id)).toHaveLength(20);
    });
  });

  it('rejects BidTooLow / SelfBid / BidAboveBuyNow / InsufficientFunds / ListingClosed, each rolled back without touching escrow', async () => {
    const f = await fixture(2, { buyNowPrice: 1000 });
    const [b1, b2] = f.bidders as [string, string];
    await db.transaction((tx) => marketRepo.placeBid(tx, f.listing.id, b1, 200, T0));
    const poor = await db.transaction((tx) => mkPlayer(tx, undefined, 100));
    await rejectsInTx(db, 'BidTooLow', (tx) => marketRepo.placeBid(tx, f.listing.id, b2, 200 + MIN_BID_INCREMENT - 1, at(1)));
    await rejectsInTx(db, 'SelfBid', (tx) => marketRepo.placeBid(tx, f.listing.id, f.seller, 500, at(1)));
    await rejectsInTx(db, 'BidAboveBuyNow', (tx) => marketRepo.placeBid(tx, f.listing.id, b2, 1000, at(1)));
    await rejectsInTx(db, 'InvalidArgument', (tx) => marketRepo.placeBid(tx, f.listing.id, b2, 0, at(1)));
    await rejectsInTx(db, 'InsufficientFunds', (tx) => marketRepo.placeBid(tx, f.listing.id, poor, 300, at(1)));
    await rejectsInTx(db, 'ListingClosed', (tx) => marketRepo.placeBid(tx, f.listing.id, b2, 300, at(12 * HOUR)));
    await rejectsInTx(db, 'NotFound', (tx) => marketRepo.placeBid(tx, '00000000-0000-0000-0000-000000000000', b2, 300, at(1)));
    await db.transaction(async (tx) => {
      const l = (await marketRepo.byId(tx, f.listing.id))!;
      expect(l).toMatchObject({ currentBid: 200, currentBidderId: b1, status: 'active' });
      expect(await marketRepo.bidsFor(tx, f.listing.id)).toHaveLength(1);
      expect(await money(tx, b1)).toBe(RICH - 200); // the failed InsufficientFunds bid did NOT leave b1 refunded
      expect(await money(tx, b2)).toBe(RICH);
      expect(await money(tx, poor)).toBe(100);
    });
  });

  it('the first bid needs only startingBid; raising your own bid re-escrows only the difference', async () => {
    const f = await fixture(1, { startingBid: 500 });
    const b = f.bidders[0]!;
    await rejectsInTx(db, 'BidTooLow', (tx) => marketRepo.placeBid(tx, f.listing.id, b, 499, T0));
    await db.transaction(async (tx) => {
      await marketRepo.placeBid(tx, f.listing.id, b, 500, T0);
      await marketRepo.placeBid(tx, f.listing.id, b, 550, at(1));
      expect(await money(tx, b)).toBe(RICH - 550);
    });
  });
});

describe('MarketRepo.buyNow / cancel / closeExpired', () => {
  it('buyNow ends the listing, refunds the outbid bidder, charges the buyer, pays seller minus fee, moves the creature to the buyer box', async () => {
    const f = await fixture(2, { buyNowPrice: 5000 });
    const [b1, buyer] = f.bidders as [string, string];
    await db.transaction((tx) => marketRepo.placeBid(tx, f.listing.id, b1, 300, T0));
    const view = await db.transaction((tx) => marketRepo.buyNow(tx, f.listing.id, buyer, at(60_000)));
    expect(view).toMatchObject({ status: 'sold', currentBid: 5000, currentBidderId: buyer, resolvedAt: at(60_000) });
    await db.transaction(async (tx) => {
      expect(await marketRepo.creatureSlot(tx, f.creature)).toEqual({ ownerId: buyer, slotKind: 'box', slotIndex: 0 });
      expect((await creatureRepo.byId(tx, f.creature))!.ownerId).toBe(buyer);
      expect(await money(tx, b1)).toBe(RICH);
      expect(await money(tx, buyer)).toBe(RICH - 5000);
      expect(marketFee(5000)).toBe(250);
      expect(await money(tx, f.seller)).toBe(5000 - 250);
      expect(await marketRepo.myActive(tx, f.seller)).toEqual([]);
      expect(await marketRepo.myBids(tx, b1)).toEqual([]);
      expect((await auditRepo.recent(tx, { action: 'listing.sold' })).find((e) => e.subject === f.listing.id)).toMatchObject({ actorId: buyer });
    });
    await rejectsInTx(db, 'ListingClosed', (tx) => marketRepo.placeBid(tx, f.listing.id, b1, 6000, at(61_000)));
    await rejectsInTx(db, 'ListingClosed', (tx) => marketRepo.buyNow(tx, f.listing.id, b1, at(61_000)));
  });

  it('buyNow refuses listings without a buy-now price, the seller, the poor and expired listings — and rolls back cleanly', async () => {
    const f = await fixture(1);
    await rejectsInTx(db, 'NoBuyNow', (tx) => marketRepo.buyNow(tx, f.listing.id, f.bidders[0]!, T0));
    const g = await fixture(2, { buyNowPrice: 2000 });
    const [b1, b2] = g.bidders as [string, string];
    await db.transaction((tx) => marketRepo.placeBid(tx, g.listing.id, b1, 150, T0));
    const poor = await db.transaction((tx) => mkPlayer(tx, undefined, 1999));
    await rejectsInTx(db, 'SelfBid', (tx) => marketRepo.buyNow(tx, g.listing.id, g.seller, T0));
    await rejectsInTx(db, 'InsufficientFunds', (tx) => marketRepo.buyNow(tx, g.listing.id, poor, T0));
    await rejectsInTx(db, 'ListingClosed', (tx) => marketRepo.buyNow(tx, g.listing.id, b2, at(12 * HOUR)));
    await db.transaction(async (tx) => {
      expect((await marketRepo.byId(tx, g.listing.id))!).toMatchObject({ status: 'active', currentBid: 150, currentBidderId: b1 });
      expect(await marketRepo.creatureSlot(tx, g.creature)).toMatchObject({ ownerId: g.seller, slotKind: 'listing' });
      expect(await money(tx, b1)).toBe(RICH - 150); // the poor buyer's failed attempt did not refund b1
      expect(await money(tx, poor)).toBe(1999);
    });
  });

  it('closeExpired with a high bid: sold, creature to the bidder box, seller paid price - fee (escrow already held)', async () => {
    const f = await fixture(2);
    const [b1, b2] = f.bidders as [string, string];
    await db.transaction((tx) => marketRepo.placeBid(tx, f.listing.id, b1, 400, T0));
    await db.transaction((tx) => marketRepo.placeBid(tx, f.listing.id, b2, 900, at(1000)));
    await db.transaction((tx) => marketRepo.closeExpired(tx, at(12 * HOUR - 1), 100));
    expect((await listingById(f.listing.id)).status).toBe('active'); // not due yet
    // other listings in this file share the same T0 + 12 h expiry, so the count is >= 1, never 0
    expect(await db.transaction((tx) => marketRepo.closeExpired(tx, at(12 * HOUR), 100))).toBeGreaterThanOrEqual(1);
    await db.transaction(async (tx) => {
      expect((await marketRepo.byId(tx, f.listing.id))!).toMatchObject({ status: 'sold', currentBid: 900, currentBidderId: b2, resolvedAt: at(12 * HOUR) });
      expect(await marketRepo.creatureSlot(tx, f.creature)).toEqual({ ownerId: b2, slotKind: 'box', slotIndex: 0 });
      expect(await money(tx, b1)).toBe(RICH);
      expect(await money(tx, b2)).toBe(RICH - 900);
      expect(await money(tx, f.seller)).toBe(900 - marketFee(900));
    });
    // a second sweep finds nothing left (everything from this file that was due is now closed)
    expect(await db.transaction((tx) => marketRepo.closeExpired(tx, at(13 * HOUR), 100))).toBe(0);
  });

  it('closeExpired with no bids returns the creature to the seller box and marks the listing expired', async () => {
    const f = await fixture(0, { durationHours: 24 });
    await db.transaction(async (tx) => {
      await mkCreature(tx, f.seller, { kind: 'box', index: 0 }); // seller has box[0] already → returns to box[1]
    });
    expect(await db.transaction((tx) => marketRepo.closeExpired(tx, at(24 * HOUR + 5), 100))).toBeGreaterThanOrEqual(1);
    await db.transaction(async (tx) => {
      expect((await marketRepo.byId(tx, f.listing.id))!).toMatchObject({ status: 'expired', currentBid: null, resolvedAt: at(24 * HOUR + 5) });
      expect(await marketRepo.creatureSlot(tx, f.creature)).toEqual({ ownerId: f.seller, slotKind: 'box', slotIndex: 1 });
      expect(await money(tx, f.seller)).toBe(0);
      expect((await auditRepo.recent(tx, { action: 'listing.expired' })).find((e) => e.subject === f.listing.id)).toMatchObject({ actorId: null });
    });
  });

  it('closeExpired honours its limit and orders by expiry', async () => {
    const a = await fixture(0, { durationHours: 48 });
    const b = await fixture(0, { durationHours: 48 });
    expect(await db.transaction((tx) => marketRepo.closeExpired(tx, at(48 * HOUR), 1))).toBe(1);
    const statuses = [(await listingById(a.listing.id)).status, (await listingById(b.listing.id)).status].sort();
    expect(statuses).toEqual(['active', 'expired']);
    expect(await db.transaction((tx) => marketRepo.closeExpired(tx, at(48 * HOUR), 1))).toBe(1);
    expect([(await listingById(a.listing.id)).status, (await listingById(b.listing.id)).status]).toEqual(['expired', 'expired']);
  });

  it('cancel without bids returns the creature to the seller box; a listing that already has bids cannot be cancelled, so escrow is never stranded', async () => {
    const f = await fixture(1, { durationHours: 48 });
    const other = await db.transaction((tx) => mkPlayer(tx));
    await rejectsInTx(db, 'NotOwner', (tx) => marketRepo.cancel(tx, f.listing.id, other, T0));
    const view = await db.transaction((tx) => marketRepo.cancel(tx, f.listing.id, f.seller, at(5000)));
    expect(view).toMatchObject({ status: 'cancelled', resolvedAt: at(5000) });
    await db.transaction(async (tx) => {
      expect(await marketRepo.creatureSlot(tx, f.creature)).toEqual({ ownerId: f.seller, slotKind: 'box', slotIndex: 0 });
      expect((await auditRepo.recent(tx, { action: 'listing.cancel' })).some((e) => e.subject === f.listing.id)).toBe(true);
    });
    await rejectsInTx(db, 'ListingClosed', (tx) => marketRepo.cancel(tx, f.listing.id, f.seller, at(6000)));
    // the same creature can be listed again now that the first listing is closed (partial unique index on active)
    const relisted = await db.transaction((tx) => marketRepo.create(tx, { sellerId: f.seller, creatureId: f.creature, startingBid: 100, buyNowPrice: null, durationHours: 48 }, at(7000)));
    expect(relisted.status).toBe('active');
    expect(relisted.id).not.toBe(f.listing.id);

    const g = await fixture(1, { durationHours: 48 });
    const bidder = g.bidders[0]!;
    await db.transaction((tx) => marketRepo.placeBid(tx, g.listing.id, bidder, 250, T0));
    await rejectsInTx(db, 'ListingHasBids', (tx) => marketRepo.cancel(tx, g.listing.id, g.seller, at(1)));
    await db.transaction(async (tx) => {
      expect((await marketRepo.byId(tx, g.listing.id))!).toMatchObject({ status: 'active', currentBid: 250, currentBidderId: bidder });
      expect(await money(tx, bidder)).toBe(RICH - 250); // escrow intact; it settles at expiry
    });
    expect(await db.transaction((tx) => marketRepo.closeExpired(tx, at(48 * HOUR), 100))).toBeGreaterThanOrEqual(1);
    await db.transaction(async (tx) => {
      expect(await marketRepo.creatureSlot(tx, g.creature)).toMatchObject({ ownerId: bidder, slotKind: 'box' });
      expect(await money(tx, g.seller)).toBe(250 - marketFee(250));
      expect((await marketRepo.byId(tx, g.listing.id))!.status).toBe('sold');
    });
  });

  it('search filters by variant / alpha / level, escapes LIKE wildcards, paginates and hides expired listings', async () => {
    // species ids carry a unique prefix so the assertions ignore every other listing in this file
    const f = await fixture(0, { speciesId: 'zq_glimfin', durationHours: 12 });
    await db.transaction(async (tx) => {
      const alpha = await mkCreature(tx, f.seller, { kind: 'box', index: 'nextBox' }, { speciesId: 'zq_cindercap', level: 60, isAlpha: true, variantKey: 'ember' });
      await marketRepo.create(tx, { sellerId: f.seller, creatureId: alpha.id, startingBid: 1000, buyNowPrice: null, durationHours: 48 }, T0);
      const q = { now: at(1), search: 'zq_' };
      expect((await marketRepo.search(tx, q)).total).toBe(2);
      expect((await marketRepo.search(tx, { ...q, isAlpha: true })).rows.map((r) => r.speciesId)).toEqual(['zq_cindercap']);
      expect((await marketRepo.search(tx, { ...q, isAlpha: false })).rows.map((r) => r.speciesId)).toEqual(['zq_glimfin']);
      expect((await marketRepo.search(tx, { ...q, variant: 'dawn' })).rows.map((r) => r.speciesId)).toEqual(['zq_glimfin']);
      expect((await marketRepo.search(tx, { ...q, levelMin: 50 })).total).toBe(1);
      expect((await marketRepo.search(tx, { ...q, levelMax: 50 })).total).toBe(1);
      expect((await marketRepo.search(tx, { ...q, search: 'zq_glim' })).total).toBe(1);
      expect((await marketRepo.search(tx, { ...q, search: 'zq_%' })).total).toBe(0); // % is escaped, not a wildcard
      expect((await marketRepo.search(tx, { ...q, search: 'zq_glimfi_' })).total).toBe(0); // so is _
      const page1 = await marketRepo.search(tx, { ...q, pageSize: 1, page: 1, sort: 'levelDesc' });
      const page2 = await marketRepo.search(tx, { ...q, pageSize: 1, page: 2, sort: 'levelDesc' });
      expect(page1.rows[0]!.level).toBe(60);
      expect(page2.rows[0]!.level).toBe(30);
      expect(page1.total).toBe(2);
      expect((await marketRepo.search(tx, { ...q, sort: 'priceAsc' })).rows.map((r) => r.startingBid)).toEqual([100, 1000]);
      expect((await marketRepo.search(tx, { ...q, sort: 'endingSoon' })).rows.map((r) => r.speciesId)).toEqual(['zq_glimfin', 'zq_cindercap']);
      expect((await marketRepo.search(tx, { ...q, now: at(13 * HOUR) })).rows.map((r) => r.speciesId)).toEqual(['zq_cindercap']); // the 12 h listing is no longer shown
    });
  });
});

/**
 * §5.4: FOR UPDATE / SKIP LOCKED under real contention. PGlite is single-connection so it cannot
 * exercise this; the suite runs when DATABASE_URL points at a Postgres (CI nightly / pre-release).
 */
describe.skipIf(!DATABASE_URL)('MarketRepo under 20 concurrent transactions (DATABASE_URL)', () => {
  it('20 concurrent equal bids: exactly one wins, the rest see BidTooLow, escrow equals one bid', async () => {
    const f = await fixture(20);
    const results = await Promise.allSettled(f.bidders.map((b, i) => db.transaction((tx) => marketRepo.placeBid(tx, f.listing.id, b, 100, at(i)))));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(19);
    for (const r of failed) expect(isPersistError(r.reason, 'BidTooLow')).toBe(true);
    await db.transaction(async (tx) => {
      const l = (await marketRepo.byId(tx, f.listing.id))!;
      expect(l.currentBid).toBe(100);
      expect(await marketRepo.bidsFor(tx, f.listing.id)).toHaveLength(1);
      let escrowed = 0;
      for (const b of f.bidders) escrowed += RICH - (await money(tx, b));
      expect(escrowed).toBe(100);
    });
  });

  it('20 concurrent buyNow: exactly one sale, the rest see ListingClosed, the creature moves once', async () => {
    const f = await fixture(20, { buyNowPrice: 3000 });
    const results = await Promise.allSettled(f.bidders.map((b, i) => db.transaction((tx) => marketRepo.buyNow(tx, f.listing.id, b, at(i)))));
    const ok = results.filter((r): r is PromiseFulfilledResult<ListingView> => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(19);
    for (const r of failed) expect(isPersistError(r.reason, 'ListingClosed')).toBe(true);
    const buyer = ok[0]!.value.currentBidderId!;
    await db.transaction(async (tx) => {
      expect(await marketRepo.creatureSlot(tx, f.creature)).toMatchObject({ ownerId: buyer, slotKind: 'box' });
      expect((await auditRepo.recent(tx, { action: 'creature.transfer' })).filter((e) => e.subject === f.creature)).toHaveLength(1);
      expect(await money(tx, f.seller)).toBe(3000 - marketFee(3000));
      let spent = 0;
      for (const b of f.bidders) spent += RICH - (await money(tx, b));
      expect(spent).toBe(3000);
    });
  });

  it('20 concurrent rising bids: every rejection is BidTooLow and escrow still equals the single high bid', async () => {
    const f = await fixture(20);
    const results = await Promise.allSettled(f.bidders.map((b, i) => db.transaction((tx) => marketRepo.placeBid(tx, f.listing.id, b, 100 + i * 1000, at(i)))));
    for (const r of results) if (r.status === 'rejected') expect(isPersistError(r.reason, 'BidTooLow')).toBe(true);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    await db.transaction(async (tx) => {
      const l = (await marketRepo.byId(tx, f.listing.id))!;
      let escrowed = 0;
      for (const b of f.bidders) {
        const m = await money(tx, b);
        escrowed += RICH - m;
        if (b !== l.currentBidderId) expect(m).toBe(RICH);
      }
      expect(escrowed).toBe(l.currentBid);
      const bids = await marketRepo.bidsFor(tx, f.listing.id);
      expect(Math.max(...bids.map((b) => b.amount))).toBe(l.currentBid);
    });
  });
});
