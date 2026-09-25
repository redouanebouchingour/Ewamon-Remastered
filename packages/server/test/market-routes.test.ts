/**
 * §30.8.2 marketplace routes + §30.5.1 #20 + the expiry job (§30.11: expired-with-bid → transfer to the high
 * bidder, expired-without → back to the seller's box). Every money/creature change also comes back to the caller
 * as an `inventoryDelta` (P1).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TRAINER_EXP } from '@ewa/core';
import { marketFee } from '@ewa/persist';
import { newCreature } from '../src/game/creatures';
import { runMarketExpiry } from '../src/jobs/marketExpiry';
import { silentLogger } from '../src/log';
import { START_MONEY, api, content, rawQuery, register, startServer } from './helpers';
import type { Account, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const HOUR = 3_600_000;

async function withCreature(acc: Account, species: string, level: number, slot: 'party' | 'box' = 'party'): Promise<string> {
  return s.repos.db.transaction(async (tx) => {
    const target = slot === 'party' ? ({ kind: 'party', index: (await s.repos.creatures.party(tx, acc.id)).length } as const) : ({ kind: 'box', index: 'nextBox' } as const);
    return (await s.repos.creatures.insert(tx, newCreature(content, species, level, { ownerId: acc.id }), target)).id;
  });
}

async function fund(acc: Account, amount: number): Promise<void> {
  await s.repos.db.transaction((tx) => s.repos.players.addMoney(tx, acc.id, amount));
}

describe('listing', () => {
  it('moves the creature out of the party (creaturesRemoved); locked / last party member / foreign / in-battle are refused', async () => {
    const seller = await register(s);
    const starterId = (await api(s, 'GET', '/me', seller.access)).body.party[0].id;
    // the last party member cannot be listed
    const last = await api(s, 'POST', '/marketplace/list', seller.access, { creatureId: starterId, startingBid: 100, buyNowPrice: null, durationHours: 12 });
    expect(last).toMatchObject({ status: 409, body: { code: 'PartyMinimum' } });
    const cid = await withCreature(seller, 'glimp', 12);
    await api(s, 'POST', `/creature/${cid}/flags`, seller.access, { locked: true });
    expect((await api(s, 'POST', '/marketplace/list', seller.access, { creatureId: cid, startingBid: 100, buyNowPrice: null, durationHours: 12 })).body.code).toBe('Locked');
    await api(s, 'POST', `/creature/${cid}/flags`, seller.access, { locked: false });
    // zod: startingBid ≥ 100, buyNow > startingBid, duration ∈ 12/24/48 (from another account: every attempt
    // counts against the 5 / h listing limit, rejected or not)
    const other = await register(s);
    expect((await api(s, 'POST', '/marketplace/list', other.access, { creatureId: cid, startingBid: 99, buyNowPrice: null, durationHours: 12 })).status).toBe(400);
    expect((await api(s, 'POST', '/marketplace/list', other.access, { creatureId: cid, startingBid: 500, buyNowPrice: 500, durationHours: 12 })).status).toBe(400);
    expect((await api(s, 'POST', '/marketplace/list', other.access, { creatureId: cid, startingBid: 500, buyNowPrice: null, durationHours: 6 })).status).toBe(400);
    expect((await api(s, 'POST', '/marketplace/list', other.access, { creatureId: cid, startingBid: 100, buyNowPrice: null, durationHours: 12 })).body.code).toBe('NotOwner');
    const r = await api(s, 'POST', '/marketplace/list', seller.access, { creatureId: cid, startingBid: 300, buyNowPrice: 900, durationHours: 24 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ sellerId: seller.id, creatureId: cid, speciesId: 'glimp', level: 12, startingBid: 300, buyNowPrice: 900, status: 'active', currentBid: null });
    expect(Date.parse(r.body.expiresAt) - Date.parse(r.body.createdAt)).toBe(24 * HOUR);
    expect(r.body.inventoryDelta).toEqual({ items: {}, money: null, creaturesAdded: [], creaturesRemoved: [cid], creaturesUpdated: [] });
    const me = (await api(s, 'GET', '/me', seller.access)).body;
    expect(me.party.map((c: { id: string }) => c.id)).toEqual([starterId]);
    expect((await api(s, 'GET', '/marketplace/my/active', seller.access)).body.map((l: { id: string }) => l.id)).toEqual([r.body.id]);
    const found = await api(s, 'GET', '/marketplace?search=gli&levelMin=10&levelMax=12&sort=newest', other.access);
    expect(found.body.listings.some((l: { id: string }) => l.id === r.body.id)).toBe(true);
    expect(found.body.listings[0]).not.toHaveProperty('bids');
    expect((await api(s, 'GET', '/marketplace?search=%25', other.access)).body.total).toBe(0); // '%' is literal
    // the sixth listing attempt within the hour is rate limited (LIMITS.listing = 5 / h)
    const burst = await api(s, 'POST', '/marketplace/list', other.access, { creatureId: cid, startingBid: 100, buyNowPrice: null, durationHours: 12 });
    const sixth = await api(s, 'POST', '/marketplace/list', other.access, { creatureId: cid, startingBid: 100, buyNowPrice: null, durationHours: 12 });
    expect(burst.status).toBe(409);
    expect(sixth.status).toBe(429);
  }, 60_000);
});

describe('#20 bids, buy-now, cancel', () => {
  it('escrow at bid time, +50 minimum, SelfBid, BidAboveBuyNow; the outbid bidder is refunded; the trail is on GET /:id', async () => {
    const seller = await register(s);
    const cid = await withCreature(seller, 'mossling', 9);
    const l = (await api(s, 'POST', '/marketplace/list', seller.access, { creatureId: cid, startingBid: 200, buyNowPrice: 1_000, durationHours: 12 })).body;
    const a = await register(s);
    const b = await register(s);
    expect((await api(s, 'POST', `/marketplace/${l.id}/bid`, seller.access, { amount: 300 })).body.code).toBe('SelfBid');
    expect((await api(s, 'POST', `/marketplace/${l.id}/bid`, a.access, { amount: 199 })).body.code).toBe('BidTooLow');
    const first = await api(s, 'POST', `/marketplace/${l.id}/bid`, a.access, { amount: 200 });
    expect(first.status).toBe(200);
    expect(first.body.inventoryDelta.money).toBe(START_MONEY - 200);
    expect((await api(s, 'POST', `/marketplace/${l.id}/bid`, b.access, { amount: 249 })).body.code).toBe('BidTooLow');
    expect((await api(s, 'POST', `/marketplace/${l.id}/bid`, b.access, { amount: 1_000 })).body.code).toBe('BidAboveBuyNow');
    const second = await api(s, 'POST', `/marketplace/${l.id}/bid`, b.access, { amount: 250 });
    expect(second.body).toMatchObject({ currentBid: 250, currentBidderId: b.id });
    expect((await api(s, 'GET', '/me', a.access)).body.money).toBe(START_MONEY); // refunded
    expect((await api(s, 'GET', '/marketplace/my/bids', b.access)).body.map((x: { id: string }) => x.id)).toEqual([l.id]);
    const detail = await api(s, 'GET', `/marketplace/${l.id}`, a.access);
    expect(detail.body.bids.map((x: { amount: number }) => x.amount)).toEqual([250, 200]);
    expect((await api(s, 'POST', `/marketplace/${l.id}/cancel`, seller.access)).body.code).toBe('ListingHasBids');
    // buy-now refunds the standing bidder; the buyer gets the creature, dex marks and tradeComplete exp; seller paid minus 5 %
    const buyer = await register(s);
    const exp0 = (await api(s, 'GET', '/me', buyer.access)).body.trainerExp;
    const sellerExp0 = (await api(s, 'GET', '/me', seller.access)).body.trainerExp;
    const bought = await api(s, 'POST', `/marketplace/${l.id}/buy-now`, buyer.access);
    expect(bought.status).toBe(200);
    expect(bought.body.status).toBe('sold');
    expect(bought.body.inventoryDelta.money).toBe(START_MONEY - 1_000);
    expect(bought.body.inventoryDelta.creaturesAdded[0]).toMatchObject({ id: cid, ownerId: buyer.id, speciesId: 'mossling' });
    expect((await api(s, 'GET', '/me', b.access)).body.money).toBe(START_MONEY);
    const sellerMe = (await api(s, 'GET', '/me', seller.access)).body;
    expect(sellerMe.money).toBe(START_MONEY + 1_000 - marketFee(1_000));
    expect(sellerMe.trainerExp).toBe(sellerExp0 + TRAINER_EXP.tradeComplete);
    const buyerMe = (await api(s, 'GET', '/me', buyer.access)).body;
    expect(buyerMe.trainerExp).toBe(exp0 + TRAINER_EXP.tradeComplete);
    expect(buyerMe.box.map((c: { id: string }) => c.id)).toContain(cid);
    expect((await api(s, 'GET', '/dex', buyer.access)).body.caught).toContain('mossling');
    expect((await api(s, 'POST', `/marketplace/${l.id}/bid`, a.access, { amount: 400 })).body.code).toBe('ListingClosed');
  }, 60_000);

  it('cancel without bids returns the creature (creaturesAdded); after expiry a bid is ListingClosed', async () => {
    const seller = await register(s);
    const cid = await withCreature(seller, 'glimp', 6, 'box');
    const l = (await api(s, 'POST', '/marketplace/list', seller.access, { creatureId: cid, startingBid: 100, buyNowPrice: null, durationHours: 12 })).body;
    const c = await api(s, 'POST', `/marketplace/${l.id}/cancel`, seller.access);
    expect(c.body.status).toBe('cancelled');
    expect(c.body.inventoryDelta.creaturesAdded.map((x: { id: string }) => x.id)).toEqual([cid]);
    const l2 = (await api(s, 'POST', '/marketplace/list', seller.access, { creatureId: cid, startingBid: 100, buyNowPrice: null, durationHours: 12 })).body;
    const bidder = await register(s);
    s.time.advance(12 * HOUR + 1000);
    try {
      expect((await api(s, 'POST', `/marketplace/${l2.id}/bid`, bidder.access, { amount: 100 })).body.code).toBe('ListingClosed');
    } finally {
      s.time.advance(-(12 * HOUR + 1000));
    }
  }, 60_000);

  it('list is refused during a live battle (409 inBattle)', async () => {
    const seller = await register(s);
    const cid = await withCreature(seller, 'glimp', 6);
    s.booted.runtime.presenceStore.enter(seller.id, { roomId: 'r', zoneId: 'mirevale', shard: 0, battleId: 'b', tradeId: null, since: 0 });
    try {
      expect((await api(s, 'POST', '/marketplace/list', seller.access, { creatureId: cid, startingBid: 100, buyNowPrice: null, durationHours: 12 })).body.code).toBe('inBattle');
    } finally {
      s.booted.runtime.presenceStore.leave(seller.id, 'r');
    }
  });
});

describe('expiry job (§30.8.2, §30.11)', () => {
  it('expired with a bid → sold to the high bidder (escrow never re-checked, seller paid minus fee, dex marked); without → back to the box', async () => {
    const T = new Date('2002-02-02T00:00:00.000Z');
    const seller = await register(s);
    const bidder = await register(s);
    await fund(bidder, 10_000);
    const withBid = await withCreature(seller, 'glimp', 8, 'box');
    const noBid = await withCreature(seller, 'mossling', 8, 'box');
    const { a, b } = await s.repos.db.transaction(async (tx) => {
      const a = await s.repos.market.create(tx, { sellerId: seller.id, creatureId: withBid, startingBid: 500, buyNowPrice: null, durationHours: 12 }, T);
      const b = await s.repos.market.create(tx, { sellerId: seller.id, creatureId: noBid, startingBid: 500, buyNowPrice: null, durationHours: 12 }, T);
      await s.repos.market.placeBid(tx, a.id, bidder.id, 700, new Date(T.getTime() + HOUR));
      return { a, b };
    });
    const bidderMoney = (await api(s, 'GET', '/me', bidder.access)).body.money;
    const n = await runMarketExpiry({ repos: s.repos, clock: () => 0, log: silentLogger() }, new Date(T.getTime() + 12 * HOUR), 100);
    expect(n).toBe(2);
    const rows = await rawQuery(s.db, 'select id, status from listings where id = any($1::uuid[])', [[a.id, b.id]]);
    expect(rows.find((r) => r.id === a.id)!.status).toBe('sold');
    expect(rows.find((r) => r.id === b.id)!.status).toBe('expired');
    expect((await api(s, 'GET', '/me', bidder.access)).body.money).toBe(bidderMoney); // escrowed at bid time, not charged again
    expect((await api(s, 'GET', '/me', bidder.access)).body.box.map((c: { id: string }) => c.id)).toContain(withBid);
    const sellerMe = (await api(s, 'GET', '/me', seller.access)).body;
    expect(sellerMe.money).toBe(START_MONEY + 700 - marketFee(700));
    expect(sellerMe.box.map((c: { id: string }) => c.id)).toContain(noBid);
    expect((await api(s, 'GET', '/dex', bidder.access)).body.caught).toContain('glimp');
    // a second run finds nothing
    expect(await runMarketExpiry({ repos: s.repos, clock: () => 0, log: silentLogger() }, new Date(T.getTime() + 12 * HOUR), 100)).toBe(0);
  }, 60_000);
});
