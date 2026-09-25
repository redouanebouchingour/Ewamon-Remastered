/**
 * §4.7 marketplace rows + §30.8.2. The rules live in `MarketRepo` (listing lock → player rows ascending uuid,
 * 50 minimum increment, escrow at bid time, 5 % fee floored, SKIP LOCKED expiry); this file is the server's
 * contract around them: rate limits, the in-battle guard for listing, dex marks and `tradeComplete` trainer exp
 * on buy-now, and the caller's `inventoryDelta` (P1).
 */
import { TRAINER_EXP } from '@ewa/core';
import type { CreatureInstance } from '@ewa/core';
import type { ListingView as PersistListing, Tx } from '@ewa/persist';
import { BidReq, ListCreateReq, ListingDetailRes, ListingListRes, ListingMutationRes, ListingParams, MarketQuery, MarketSearchRes } from '@ewa/protocol';
import type { ListingView } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { toInstance } from '../../rooms/battleSession';
import { HttpError, inventoryDeltaBody, iso, out, rateLimit, refuseInBattle, requireAuth } from '../http';
import type { RestDeps } from '../http';
import { SEARCH_CAP } from './social';

export function listingView(l: PersistListing): ListingView {
  return {
    id: l.id,
    sellerId: l.sellerId,
    creatureId: l.creatureId,
    speciesId: l.speciesId,
    level: l.level,
    variantKey: l.variantKey,
    isAlpha: l.isAlpha,
    startingBid: l.startingBid,
    currentBid: l.currentBid,
    currentBidderId: l.currentBidderId,
    buyNowPrice: l.buyNowPrice,
    status: l.status,
    createdAt: iso(l.createdAt),
    expiresAt: iso(l.expiresAt),
    resolvedAt: l.resolvedAt === null ? null : iso(l.resolvedAt),
  };
}

export function registerMarketRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  async function moneyOf(tx: Tx, id: string): Promise<number> {
    return (await repos.players.byId(tx, id))!.money;
  }

  async function creatureOf(tx: Tx, id: string): Promise<CreatureInstance> {
    return toInstance((await repos.creatures.byId(tx, id))!);
  }

  /** search on species_id (escaped by persist, capped at 32 chars first); bids are never in list views */
  app.get('/marketplace', bearer, async (req) => {
    const q = MarketQuery.parse(req.query);
    const now = new Date(clock());
    const r = await repos.db.transaction((tx) =>
      repos.market.search(tx, {
        ...(q.search !== undefined ? { search: q.search.slice(0, SEARCH_CAP) } : {}),
        ...(q.variant !== undefined ? { variant: q.variant } : {}),
        ...(q.isAlpha !== undefined ? { isAlpha: q.isAlpha } : {}),
        ...(q.levelMin !== undefined ? { levelMin: q.levelMin } : {}),
        ...(q.levelMax !== undefined ? { levelMax: q.levelMax } : {}),
        sort: q.sort,
        page: q.page,
        pageSize: q.pageSize,
        now,
      }),
    );
    return out(deps, MarketSearchRes, { listings: r.rows.map(listingView), total: r.total });
  });

  app.get('/marketplace/my/active', bearer, async (req) => {
    const rows = await repos.db.transaction((tx) => repos.market.myActive(tx, req.user.sub));
    return out(deps, ListingListRes, rows.map(listingView));
  });

  app.get('/marketplace/my/bids', bearer, async (req) => {
    const rows = await repos.db.transaction((tx) => repos.market.myBids(tx, req.user.sub));
    return out(deps, ListingListRes, rows.map(listingView));
  });

  app.get('/marketplace/:id', bearer, async (req) => {
    const { id } = ListingParams.parse(req.params);
    const r = await repos.db.transaction(async (tx) => {
      const l = await repos.market.byId(tx, id);
      return l === null ? null : { l, bids: await repos.market.bidsFor(tx, id) };
    });
    if (r === null) throw new HttpError(404, 'NotFound');
    return out(deps, ListingDetailRes, { ...listingView(r.l), bids: r.bids.map((b) => ({ id: b.id, listingId: b.listingId, bidderId: b.bidderId, amount: b.amount, placedAt: iso(b.placedAt) })) });
  });

  /**
   * creature owned, not locked, not the last party member (repo: NotOwner / Locked / PartyMinimum → 409);
   * startingBid ≥ 100, buyNow > startingBid, duration ∈ 12/24/48 (zod + repo); 5 / h. The creature leaves the
   * party/box immediately → `creaturesRemoved`. Refused while the creature's owner is in a live battle (the
   * party is projected there, §30.6.3).
   */
  app.post('/marketplace/list', { onRequest: requireAuth(deps), preHandler: rateLimit(deps, 'listing') }, async (req) => {
    const body = ListCreateReq.parse(req.body);
    const me = req.user.sub;
    refuseInBattle(deps, me);
    const now = new Date(clock());
    const l = await repos.db.transaction((tx) => repos.market.create(tx, { sellerId: me, creatureId: body.creatureId, startingBid: body.startingBid, buyNowPrice: body.buyNowPrice, durationHours: body.durationHours }, now));
    return out(deps, ListingMutationRes, { ...listingView(l), inventoryDelta: inventoryDeltaBody({ creaturesRemoved: [l.creatureId] }) });
  });

  /** FOR UPDATE on the listing, then the bidder + previous bidder rows (ascending uuid); escrow; 30 / h */
  app.post('/marketplace/:id/bid', { onRequest: requireAuth(deps), preHandler: rateLimit(deps, 'bid') }, async (req) => {
    const { id } = ListingParams.parse(req.params);
    const body = BidReq.parse(req.body);
    const me = req.user.sub;
    const now = new Date(clock());
    const { l, money } = await repos.db.transaction(async (tx) => {
      const l = await repos.market.placeBid(tx, id, me, body.amount, now);
      return { l, money: await moneyOf(tx, me) };
    });
    return out(deps, ListingMutationRes, { ...listingView(l), inventoryDelta: inventoryDeltaBody({ money }) });
  });

  /** FOR UPDATE; refund the standing bidder; transfer; seller paid price − 5 %; dex + tradeComplete exp to both */
  app.post('/marketplace/:id/buy-now', bearer, async (req) => {
    const { id } = ListingParams.parse(req.params);
    const me = req.user.sub;
    const now = new Date(clock());
    const r = await repos.db.transaction(async (tx) => {
      const l = await repos.market.buyNow(tx, id, me, now);
      const c = await creatureOf(tx, l.creatureId);
      await repos.progress.markSeen(tx, me, c.speciesId, now);
      await repos.progress.markCaught(tx, me, c.speciesId, c.variantKey, c.isAlpha, now);
      await repos.players.addTrainerExp(tx, me, TRAINER_EXP.tradeComplete);
      await repos.players.addTrainerExp(tx, l.sellerId, TRAINER_EXP.tradeComplete);
      return { l, c, money: await moneyOf(tx, me) };
    });
    return out(deps, ListingMutationRes, { ...listingView(r.l), inventoryDelta: inventoryDeltaBody({ money: r.money, creaturesAdded: [r.c] }) });
  });

  /** seller, active, no bid (409 ListingHasBids) → creature back to the seller's box */
  app.post('/marketplace/:id/cancel', bearer, async (req) => {
    const { id } = ListingParams.parse(req.params);
    const me = req.user.sub;
    const now = new Date(clock());
    const r = await repos.db.transaction(async (tx) => {
      const l = await repos.market.cancel(tx, id, me, now);
      return { l, c: await creatureOf(tx, l.creatureId) };
    });
    return out(deps, ListingMutationRes, { ...listingView(r.l), inventoryDelta: inventoryDeltaBody({ creaturesAdded: [r.c] }) });
  });
}
