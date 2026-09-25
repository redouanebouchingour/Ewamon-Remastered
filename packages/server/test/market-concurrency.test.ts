/**
 * §50.4.4 / §50.5 M4 market-concurrency.test.ts, driven through the server's REST routes and expiry job.
 *
 * Runs on PGlite by default (single connection: the 20 transactions are serialised, so this asserts the
 * serial outcome) and against real Postgres when `DATABASE_URL` is set (a node-postgres pool of 32: genuine
 * `FOR UPDATE` contention and `SKIP LOCKED` partitioning). The Postgres run never truncates anything — every
 * listing here is created by this file, the expiry listings with an early-2001 clock so no other test's rows
 * are due at the job's `now`.
 *
 * - 20 concurrent `POST /marketplace/:id/bid` at the same amount: exactly one 200, 19 × 409 BidTooLow
 * - 20 concurrent `POST /marketplace/:id/buy-now`: exactly one sale / one `creature.transfer`, 19 × 409 ListingClosed
 * - `runMarketExpiry` from 4 concurrent workers: each due listing closed exactly once (Σ returns = count)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { marketFee } from '@ewa/persist';
import { newCreature } from '../src/game/creatures';
import { runMarketExpiry } from '../src/jobs/marketExpiry';
import { silentLogger } from '../src/log';
import { START_MONEY, api, content, rawQuery, register, startServer, uniqueName } from './helpers';
import type { Account, TestServer } from './helpers';

const DATABASE_URL = process.env['DATABASE_URL'];
const RICH = 1_000_000;

let s: TestServer;
beforeAll(async () => {
  s = await startServer({}, DATABASE_URL !== undefined ? { databaseUrl: DATABASE_URL } : {});
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

async function rich(): Promise<Account> {
  const a = await register(s);
  await s.repos.db.transaction((tx) => s.repos.players.addMoney(tx, a.id, RICH));
  return a;
}

/** A seller with a second party member listed through the REST route. */
async function listed(buyNowPrice: number | null): Promise<{ seller: Account; listingId: string; creatureId: string }> {
  const seller = await register(s);
  const creatureId = await s.repos.db.transaction(async (tx) => (await s.repos.creatures.insert(tx, newCreature(content, 'glimp', 20, { ownerId: seller.id }), { kind: 'party', index: 1 })).id);
  const r = await api(s, 'POST', '/marketplace/list', seller.access, { creatureId, startingBid: 100, buyNowPrice, durationHours: 12 });
  expect(r.status).toBe(200);
  return { seller, listingId: r.body.id, creatureId };
}

describe(`market concurrency (${DATABASE_URL !== undefined ? 'Postgres' : 'PGlite, serialised'})`, () => {
  it('20 concurrent equal bids: exactly one wins, 19 BidTooLow; only the winner is charged', async () => {
    const { listingId } = await listed(null);
    const bidders = await Promise.all(Array.from({ length: 20 }, () => rich()));
    const before = await Promise.all(bidders.map((b) => api(s, 'GET', '/me', b.access).then((r) => r.body.money as number)));
    const results = await Promise.all(bidders.map((b) => api(s, 'POST', `/marketplace/${listingId}/bid`, b.access, { amount: 100 })));
    const ok = results.filter((r) => r.status === 200);
    const lost = results.filter((r) => r.status !== 200);
    expect(ok).toHaveLength(1);
    expect(lost).toHaveLength(19);
    for (const r of lost) expect(r).toMatchObject({ status: 409, body: { code: 'BidTooLow' } });
    const winner = results.findIndex((r) => r.status === 200);
    expect(ok[0]!.body.inventoryDelta.money).toBe(before[winner]! - 100);
    const after = await Promise.all(bidders.map((b) => api(s, 'GET', '/me', b.access).then((r) => r.body.money as number)));
    for (let i = 0; i < bidders.length; i++) expect(after[i]).toBe(i === winner ? before[i]! - 100 : before[i]);
    const bids = await rawQuery(s.db, 'select count(*)::int as n from bids where listing_id = $1', [listingId]);
    expect(bids[0]!.n).toBe(1);
  }, 120_000);

  it('20 concurrent buy-now: exactly one sale and one transfer, 19 ListingClosed; the seller is paid price − 5 %', async () => {
    const price = 2_000;
    const { seller, listingId, creatureId } = await listed(price);
    const buyers = await Promise.all(Array.from({ length: 20 }, () => rich()));
    const results = await Promise.all(buyers.map((b) => api(s, 'POST', `/marketplace/${listingId}/buy-now`, b.access)));
    const ok = results.filter((r) => r.status === 200);
    expect(ok).toHaveLength(1);
    for (const r of results.filter((x) => x.status !== 200)) expect(r).toMatchObject({ status: 409, body: { code: 'ListingClosed' } });
    const buyer = buyers[results.findIndex((r) => r.status === 200)]!;
    expect(ok[0]!.body.inventoryDelta.creaturesAdded.map((c: { id: string }) => c.id)).toEqual([creatureId]);
    const transfers = await rawQuery(s.db, "select count(*)::int as n from audit_log where action = 'creature.transfer' and subject = $1", [creatureId]);
    expect(transfers[0]!.n).toBe(1);
    const owner = await rawQuery(s.db, 'select owner_id, slot_kind from creature_instances where id = $1', [creatureId]);
    expect(owner[0]).toMatchObject({ owner_id: buyer.id, slot_kind: 'box' });
    expect((await api(s, 'GET', '/me', seller.access)).body.money).toBe(START_MONEY + price - marketFee(price));
  }, 120_000);

  it('closeExpired from 4 concurrent workers (SKIP LOCKED) closes each due listing exactly once', async () => {
    const T = new Date('2001-01-01T00:00:00.000Z');
    const due = new Date(T.getTime() + 13 * 3_600_000);
    const created = await s.repos.db.transaction(async (tx) => {
      const out: { id: string; bid: boolean }[] = [];
      const bidderName = uniqueName('xb');
      const bidder = await s.repos.players.create(tx, { username: bidderName, email: `${bidderName}@x.test`, passwordHash: 'x' }, T);
      await s.repos.players.addMoney(tx, bidder.id, RICH);
      for (let i = 0; i < 12; i++) {
        const name = uniqueName('xs');
        const seller = await s.repos.players.create(tx, { username: name, email: `${name}@x.test`, passwordHash: 'x' }, T);
        await s.repos.creatures.insert(tx, newCreature(content, 'mossling', 5, { ownerId: seller.id }), { kind: 'party', index: 0 });
        const c = await s.repos.creatures.insert(tx, newCreature(content, 'glimp', 7, { ownerId: seller.id }), { kind: 'box', index: 'nextBox' });
        const l = await s.repos.market.create(tx, { sellerId: seller.id, creatureId: c.id, startingBid: 100, buyNowPrice: null, durationHours: 12 }, T);
        const bid = i % 2 === 0;
        if (bid) await s.repos.market.placeBid(tx, l.id, bidder.id, 100 + i, new Date(T.getTime() + 1000));
        out.push({ id: l.id, bid });
      }
      return out;
    });
    const deps = { repos: s.repos, clock: () => due.getTime(), log: silentLogger() };
    const counts = await Promise.all([0, 1, 2, 3].map(() => runMarketExpiry(deps, due, 5)));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(created.length);
    const ids = created.map((c) => c.id);
    const rows = await rawQuery(s.db, 'select id, status from listings where id = any($1::uuid[])', [ids]);
    for (const c of created) expect(rows.find((r) => r.id === c.id)!.status).toBe(c.bid ? 'sold' : 'expired');
    const audits = await rawQuery(s.db, "select subject, count(*)::int as n from audit_log where action in ('listing.sold', 'listing.expired') and subject = any($1::text[]) group by subject", [ids]);
    expect(audits).toHaveLength(created.length);
    for (const a of audits) expect(a.n).toBe(1);
  }, 120_000);
});
