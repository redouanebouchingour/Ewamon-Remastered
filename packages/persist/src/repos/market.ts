import { and, asc, desc, eq, gt, gte, ilike, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { MARKET, MIN_BID_INCREMENT } from '../constants';
import type { Tx } from '../db';
import { fail } from '../errors';
import { bids, creatureInstances, listings } from '../schema/index';
import type { ListingRow } from '../schema/index';
import type { BidView, ListingView, MarketQuery, VariantKey } from '../types';
import { clampInt, escapeLike } from '../util';
import { auditRepo } from './audit';
import { creatureRepo } from './creatures';
import { playerRepo } from './players';

/** One listing closed by the expiry job (server §30.8.2 job: the caller marks the buyer's dex in the same tx). */
export interface ClosedListing {
  readonly id: string;
  readonly sold: boolean;
  readonly sellerId: string;
  /** the high bidder when sold */
  readonly buyerId: string | null;
  readonly creatureId: string;
  readonly speciesId: string;
  readonly variantKey: VariantKey;
  readonly isAlpha: boolean;
  /** Phase D4 */
  readonly isShiny: boolean;
  /** the sale price when sold */
  readonly price: number | null;
}

export interface NewListing {
  readonly sellerId: string;
  readonly creatureId: string;
  readonly startingBid: number;
  readonly buyNowPrice: number | null;
  readonly durationHours: 12 | 24 | 48;
}

function view(r: ListingRow): ListingView {
  return {
    id: r.id,
    sellerId: r.sellerId,
    creatureId: r.creatureId,
    speciesId: r.speciesId,
    level: r.level,
    variantKey: r.variantKey as VariantKey,
    isAlpha: r.isAlpha,
    isShiny: r.isShiny,
    startingBid: r.startingBid,
    currentBid: r.currentBid,
    currentBidderId: r.currentBidderId,
    buyNowPrice: r.buyNowPrice,
    status: r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    resolvedAt: r.resolvedAt,
  };
}

/** §3.8: the seller pays feePercent of the sale price, floored. */
export function marketFee(price: number): number {
  return Math.floor((price * MARKET.feePercent) / 100);
}

async function lockListing(tx: Tx, id: string, skipLocked = false): Promise<ListingRow> {
  const q = tx.select().from(listings).where(eq(listings.id, id));
  const [row] = skipLocked ? await q.for('update', { skipLocked: true }) : await q.for('update');
  if (!row) fail('NotFound', `listing ${id}`);
  return row;
}

function assertOpen(l: ListingRow, now: Date): void {
  if (l.status !== 'active' || now.getTime() >= l.expiresAt.getTime()) fail('ListingClosed');
}

/** Returns the listed creature to the seller's box (used by cancel and no-bid expiry). */
async function returnToSeller(tx: Tx, l: ListingRow): Promise<void> {
  await creatureRepo.moveToSlot(tx, l.creatureId, 'box', 'nextBox');
}

/** Sells the listing's creature to `buyerId` for `price`: transfer + pay seller (price - fee). Money for the buyer is already escrowed/charged by the caller. */
async function settleSale(tx: Tx, l: ListingRow, buyerId: string, price: number, now: Date): Promise<void> {
  await creatureRepo.transferCreature(tx, l.creatureId, l.sellerId, buyerId, 'marketSale', now);
  await playerRepo.addMoney(tx, l.sellerId, price - marketFee(price));
  await tx
    .update(listings)
    .set({ status: 'sold', currentBid: price, currentBidderId: buyerId, resolvedAt: now })
    .where(eq(listings.id, l.id));
  await auditRepo.write(tx, { actorId: buyerId, action: 'listing.sold', subject: l.id, detail: { sellerId: l.sellerId, price, fee: marketFee(price), creatureId: l.creatureId } }, now);
}

export const marketRepo = {
  async search(tx: Tx, q: MarketQuery): Promise<{ rows: ListingView[]; total: number }> {
    const conds: SQL[] = [eq(listings.status, 'active'), gt(listings.expiresAt, q.now)];
    if (q.search && q.search.trim()) conds.push(ilike(listings.speciesId, `%${escapeLike(q.search.trim())}%`));
    if (q.variant) conds.push(eq(listings.variantKey, q.variant));
    if (q.isAlpha !== undefined) conds.push(eq(listings.isAlpha, q.isAlpha));
    if (q.isShiny !== undefined) conds.push(eq(listings.isShiny, q.isShiny));
    if (q.levelMin !== undefined) conds.push(gte(listings.level, clampInt(q.levelMin, 1, 100)));
    if (q.levelMax !== undefined) conds.push(lte(listings.level, clampInt(q.levelMax, 1, 100)));
    const where = and(...conds);
    const pageSize = clampInt(q.pageSize ?? 20, 1, 50);
    const page = Math.max(1, Math.trunc(q.page ?? 1));
    const price = sql`coalesce(${listings.currentBid}, ${listings.startingBid})`;
    const order = (() => {
      switch (q.sort ?? 'endingSoon') {
        case 'newest':
          return [desc(listings.createdAt), asc(listings.id)];
        case 'priceAsc':
          return [asc(price), asc(listings.id)];
        case 'priceDesc':
          return [desc(price), asc(listings.id)];
        case 'levelDesc':
          return [desc(listings.level), asc(listings.id)];
        case 'endingSoon':
          return [asc(listings.expiresAt), asc(listings.id)];
      }
    })();
    const rows = await tx
      .select()
      .from(listings)
      .where(where)
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [c] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .where(where);
    return { rows: rows.map(view), total: Number(c?.n ?? 0) };
  },

  async byId(tx: Tx, id: string): Promise<ListingView | null> {
    const [row] = await tx.select().from(listings).where(eq(listings.id, id)).limit(1);
    return row ? view(row) : null;
  },

  async bidsFor(tx: Tx, listingId: string): Promise<BidView[]> {
    return tx.select().from(bids).where(eq(bids.listingId, listingId)).orderBy(desc(bids.placedAt), desc(bids.id));
  },

  async myActive(tx: Tx, sellerId: string): Promise<ListingView[]> {
    const rows = await tx
      .select()
      .from(listings)
      .where(and(eq(listings.sellerId, sellerId), eq(listings.status, 'active')))
      .orderBy(asc(listings.expiresAt));
    return rows.map(view);
  },

  /** Active listings where the player is the current high bidder. */
  async myBids(tx: Tx, bidderId: string): Promise<ListingView[]> {
    const rows = await tx
      .select()
      .from(listings)
      .where(and(eq(listings.currentBidderId, bidderId), eq(listings.status, 'active')))
      .orderBy(asc(listings.expiresAt));
    return rows.map(view);
  },

  /** Moves the creature into the seller's 'listing' slot kind and opens the auction. */
  async create(tx: Tx, l: NewListing, now: Date): Promise<ListingView> {
    if (!Number.isInteger(l.startingBid) || l.startingBid < MARKET.minStartingBid) fail('InvalidArgument', `startingBid >= ${MARKET.minStartingBid}`);
    if (l.buyNowPrice !== null && (!Number.isInteger(l.buyNowPrice) || l.buyNowPrice <= l.startingBid)) fail('InvalidArgument', 'buyNowPrice must exceed startingBid');
    if (!(MARKET.durationsHours as readonly number[]).includes(l.durationHours)) fail('InvalidArgument', 'durationHours must be 12 | 24 | 48');
    await playerRepo.lock(tx, l.sellerId);
    const c = await creatureRepo.lock(tx, l.creatureId);
    if (c.ownerId !== l.sellerId) fail('NotOwner');
    if (c.locked) fail('Locked');
    if (c.slotKind !== 'party' && c.slotKind !== 'box') fail('InvalidSlot', `creature is ${c.slotKind}`);
    await creatureRepo.moveToSlot(tx, l.creatureId, 'listing', 'nextBox'); // throws PartyMinimum when it would empty the party
    const [row] = await tx
      .insert(listings)
      .values({
        sellerId: l.sellerId,
        creatureId: l.creatureId,
        speciesId: c.speciesId,
        level: c.level,
        variantKey: c.variantKey,
        isAlpha: c.isAlpha,
        isShiny: c.isShiny === true,
        startingBid: l.startingBid,
        buyNowPrice: l.buyNowPrice,
        status: 'active',
        createdAt: now,
        expiresAt: new Date(now.getTime() + l.durationHours * 3_600_000),
      })
      .returning();
    await auditRepo.write(tx, { actorId: l.sellerId, action: 'listing.create', subject: row!.id, detail: { creatureId: l.creatureId, startingBid: l.startingBid, buyNowPrice: l.buyNowPrice } }, now);
    return view(row!);
  },

  /**
   * Lock the listing FOR UPDATE; assert open, not seller, amount >= max(startingBid, currentBid + 50)
   * and < buyNowPrice; lock the bidder (and previous bidder) rows in id order; refund the previous
   * bidder's escrow; escrow the new amount; insert the bid; update the listing; audit.
   * Throws ListingClosed | SelfBid | BidTooLow | BidAboveBuyNow | InsufficientFunds.
   */
  async placeBid(tx: Tx, listingId: string, bidderId: string, amount: number, now: Date): Promise<ListingView> {
    if (!Number.isInteger(amount) || amount <= 0) fail('InvalidArgument', 'amount must be a positive integer');
    const l = await lockListing(tx, listingId);
    assertOpen(l, now);
    if (l.sellerId === bidderId) fail('SelfBid');
    const min = l.currentBid === null ? l.startingBid : Math.max(l.startingBid, l.currentBid + MIN_BID_INCREMENT);
    if (amount < min) fail('BidTooLow', `minimum bid is ${min}`);
    if (l.buyNowPrice !== null && amount >= l.buyNowPrice) fail('BidAboveBuyNow', `use buyNow (${l.buyNowPrice})`);
    const toLock = [bidderId, ...(l.currentBidderId ? [l.currentBidderId] : [])];
    await playerRepo.lockMany(tx, toLock);
    if (l.currentBidderId !== null && l.currentBid !== null) await playerRepo.addMoney(tx, l.currentBidderId, l.currentBid);
    await playerRepo.addMoney(tx, bidderId, -amount);
    await tx.insert(bids).values({ listingId, bidderId, amount, placedAt: now });
    const [updated] = await tx
      .update(listings)
      .set({ currentBid: amount, currentBidderId: bidderId })
      .where(eq(listings.id, listingId))
      .returning();
    await auditRepo.write(tx, { actorId: bidderId, action: 'listing.bid', subject: listingId, detail: { amount, previousBidderId: l.currentBidderId, previousBid: l.currentBid } }, now);
    return view(updated!);
  },

  /** FOR UPDATE; assert open && buyNowPrice !== null; refund current bidder; charge buyer; transfer; pay seller minus fee. */
  async buyNow(tx: Tx, listingId: string, buyerId: string, now: Date): Promise<ListingView> {
    const l = await lockListing(tx, listingId);
    assertOpen(l, now);
    if (l.buyNowPrice === null) fail('NoBuyNow');
    if (l.sellerId === buyerId) fail('SelfBid');
    const price = l.buyNowPrice;
    await playerRepo.lockMany(tx, [buyerId, l.sellerId, ...(l.currentBidderId ? [l.currentBidderId] : [])]);
    if (l.currentBidderId !== null && l.currentBid !== null) await playerRepo.addMoney(tx, l.currentBidderId, l.currentBid);
    await playerRepo.addMoney(tx, buyerId, -price);
    await settleSale(tx, l, buyerId, price, now);
    return (await marketRepo.byId(tx, listingId))!;
  },

  /** FOR UPDATE; assert seller && active && no bids; creature back to the seller's box; status cancelled. */
  async cancel(tx: Tx, listingId: string, sellerId: string, now: Date): Promise<ListingView> {
    const l = await lockListing(tx, listingId);
    if (l.sellerId !== sellerId) fail('NotOwner');
    if (l.status !== 'active') fail('ListingClosed');
    if (l.currentBid !== null) fail('ListingHasBids');
    await playerRepo.lock(tx, sellerId);
    await returnToSeller(tx, l);
    const [updated] = await tx
      .update(listings)
      .set({ status: 'cancelled', resolvedAt: now })
      .where(eq(listings.id, listingId))
      .returning();
    await auditRepo.write(tx, { actorId: sellerId, action: 'listing.cancel', subject: listingId, detail: {} }, now);
    return view(updated!);
  },

  /**
   * Expiry job: FOR UPDATE SKIP LOCKED over active && expiresAt <= now. With a bid → sold (transfer,
   * pay seller minus fee; the winner's money was escrowed at bid time). Without → creature back to
   * the seller's box, status expired. Returns how many listings were closed.
   */
  async closeExpired(tx: Tx, now: Date, limit: number): Promise<number> {
    return (await marketRepo.closeExpiredDetailed(tx, now, limit)).length;
  },

  /** `closeExpired`, returning what each closed listing became (sold → buyer, or returned to the seller). */
  async closeExpiredDetailed(tx: Tx, now: Date, limit: number): Promise<ClosedListing[]> {
    const out: ClosedListing[] = [];
    const due = await tx
      .select()
      .from(listings)
      .where(and(eq(listings.status, 'active'), lte(listings.expiresAt, now)))
      .orderBy(asc(listings.expiresAt), asc(listings.id))
      .limit(clampInt(limit, 1, 1000))
      .for('update', { skipLocked: true });
    for (const l of due) {
      const base = { id: l.id, sellerId: l.sellerId, creatureId: l.creatureId, speciesId: l.speciesId, variantKey: l.variantKey as VariantKey, isAlpha: l.isAlpha, isShiny: l.isShiny };
      if (l.currentBidderId !== null && l.currentBid !== null) {
        await playerRepo.lockMany(tx, [l.sellerId, l.currentBidderId]);
        await settleSale(tx, l, l.currentBidderId, l.currentBid, now);
        out.push({ ...base, sold: true, buyerId: l.currentBidderId, price: l.currentBid });
      } else {
        await playerRepo.lock(tx, l.sellerId);
        await returnToSeller(tx, l);
        await tx.update(listings).set({ status: 'expired', resolvedAt: now }).where(eq(listings.id, l.id));
        await auditRepo.write(tx, { actorId: null, action: 'listing.expired', subject: l.id, detail: { sellerId: l.sellerId } }, now);
        out.push({ ...base, sold: false, buyerId: null, price: null });
      }
    }
    return out;
  },

  /** Where a listed creature currently sits — a diagnostic for tests and admin tooling. */
  async creatureSlot(tx: Tx, creatureId: string): Promise<{ ownerId: string; slotKind: string; slotIndex: number } | null> {
    const [r] = await tx
      .select({ ownerId: creatureInstances.ownerId, slotKind: creatureInstances.slotKind, slotIndex: creatureInstances.slotIndex })
      .from(creatureInstances)
      .where(eq(creatureInstances.id, creatureId))
      .limit(1);
    return r ?? null;
  },
};

export type MarketRepo = typeof marketRepo;
