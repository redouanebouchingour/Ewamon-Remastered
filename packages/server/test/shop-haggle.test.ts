/**
 * Shop haggling (`POST /shop/haggle`, game/haggle.ts): the discount the keeper's words named is capped by how the keeper
 * feels about the player, a second discount waits out the cooldown and shrinks (diminishing returns), a markup always
 * lands and is remembered (`haggledRudely`), the deal expires, `/shop/buy` and `/shop/sell` apply it and `GET /shop`
 * shows it; a keeper in another zone (or a villager who is no keeper) is refused; `NPC_TOOLS=off` turns it off.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HAGGLE_COOLDOWN_MS, HAGGLE_DEAL_MS, HAGGLE_DISCOUNT_CAP, HAGGLE_MARKUP_MAX, HAGGLE_WINDOW_MS, NPC_DEED_DELTA, dealBuyPrice, dealSellPrice, shopkeeperName } from '@ewa/protocol';
import { decideHaggle, discountCap } from '../src/game/haggle';
import type { ShopHaggle } from '../src/game/haggle';
import { api, content, enter, rawQuery, register, startServer } from './helpers';
import type { Account, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const KEEPER = 'mirevale.shop.keeper';
const haggle = (acc: Account, kind: 'discount' | 'markup', percent: number, npcId = KEEPER) => api(s, 'POST', '/shop/haggle', acc.access, { npcId, kind, percent });
const money = (acc: Account) => s.repos.db.transaction(async (tx) => (await s.repos.players.byId(tx, acc.id))!.money);
/** sets the keeper's standing with the player directly (the NPC memory row) */
const standing = (acc: Account, delta: number) => s.repos.db.transaction((tx) => s.repos.npcMemory.remember(tx, acc.id, KEEPER, { zoneId: 'mirevale', delta }, new Date(s.time.clock())));

describe('decideHaggle', () => {
  const empty: ShopHaggle = { deal: null, won: [], lastAt: null };
  it('caps a discount by the feeling, halves it per discount won in the window, and never waits on a markup', () => {
    let h = empty;
    let t = 1_000_000;
    const got: number[] = [];
    for (let i = 0; i < 4; i++) {
      const d = decideHaggle(h, 'discount', 40, 'trusted', t);
      if (!d.ok) throw new Error('refused');
      got.push(d.granted);
      h = d.next;
      expect(decideHaggle(h, 'discount', 40, 'trusted', t + 1)).toMatchObject({ ok: false, code: 'haggleCooldown' });
      t += HAGGLE_COOLDOWN_MS;
    }
    expect(got).toEqual([HAGGLE_DISCOUNT_CAP.trusted, 12, 6, 0]);
    // the deal kept the best discount
    expect(h.deal).toMatchObject({ kind: 'discount', percent: HAGGLE_DISCOUNT_CAP.trusted });
    // the window passes: the full cap again
    expect(discountCap('trusted', h, t + HAGGLE_WINDOW_MS)).toBe(HAGGLE_DISCOUNT_CAP.trusted);
    // a markup lands at once, capped, and replaces the deal
    const m = decideHaggle(h, 'markup', 49, 'hostile', t);
    expect(m).toMatchObject({ ok: true, granted: HAGGLE_MARKUP_MAX, next: { deal: { kind: 'markup', percent: HAGGLE_MARKUP_MAX } } });
    expect(decideHaggle(empty, 'discount', 30, 'hostile', t)).toMatchObject({ ok: true, granted: 0, next: { deal: null } });
  });

  it('prices: a discount lowers the buy price, a markup raises it, and selling never beats buying back', () => {
    expect(dealBuyPrice(300, { kind: 'discount', percent: 15 })).toBe(255);
    expect(dealBuyPrice(300, { kind: 'markup', percent: 10 })).toBe(330);
    expect(dealBuyPrice(1, { kind: 'discount', percent: 50 })).toBe(1);
    expect(dealSellPrice(150, 300, { kind: 'discount', percent: 20 })).toBe(165);
    expect(dealSellPrice(150, 300, { kind: 'markup', percent: 20 })).toBe(135);
    for (let pc = 1; pc <= 50; pc++) for (const [sell, buy] of [[150, 300], [90, 100], [5, 6]] as const) expect(dealSellPrice(sell, buy, { kind: 'discount', percent: pc })).toBeLessThan(dealBuyPrice(buy, { kind: 'discount', percent: pc }));
  });
});

describe('/shop/haggle', () => {
  it('a stranger gets the neutral cap, sees the deal in the shop, and buys and sells at it until it expires', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const shop0 = (await api(s, 'GET', '/shop/mirevale', acc.access)).body;
    expect(shop0.deal).toBeNull();
    expect(shop0.keeper).toEqual({ npcId: KEEPER, npcName: shopkeeperName(KEEPER), cap: HAGGLE_DISCOUNT_CAP.neutral, feeling: 'neutral', readyAt: null });

    const r = await haggle(acc, 'discount', 30);
    expect(r.status).toBe(200);
    expect(r.body.granted).toBe(HAGGLE_DISCOUNT_CAP.neutral);
    expect(r.body.deal).toMatchObject({ npcId: KEEPER, npcName: shopkeeperName(KEEPER), zoneId: 'mirevale', kind: 'discount', percent: HAGGLE_DISCOUNT_CAP.neutral });
    expect(Math.abs(Date.parse(r.body.deal.expiresAt) - (s.time.clock() + HAGGLE_DEAL_MS))).toBeLessThan(2_000);
    // the next one halves, and waits
    expect(r.body.keeper).toMatchObject({ cap: HAGGLE_DISCOUNT_CAP.neutral / 2 });
    expect(r.body.keeper.readyAt).not.toBeNull();
    const shop = (await api(s, 'GET', '/shop/mirevale', acc.access)).body;
    expect(shop.deal).toEqual(r.body.deal);
    // base prices stay base prices
    expect(shop.prices).toEqual(shop0.prices);

    const potion = content.item('potion') as { price: number; sellPrice: number };
    const unit = dealBuyPrice(potion.price, r.body.deal);
    expect(unit).toBeLessThan(potion.price);
    const before = await money(acc);
    const buy = await api(s, 'POST', '/shop/buy', acc.access, { item: 'potion', qty: 3 });
    expect(buy.status).toBe(200);
    expect(buy.body.money).toBe(before - unit * 3);
    const sell = await api(s, 'POST', '/shop/sell', acc.access, { item: 'potion', qty: 1 });
    expect(sell.body.money).toBe(buy.body.money + dealSellPrice(potion.sellPrice, potion.price, r.body.deal));

    // the keeper remembers a discount it gave as a gift (no standing change)
    const mem = (await api(s, 'GET', `/npc/memory/${KEEPER}`, acc.access)).body;
    expect(mem.deeds.map((d: { deed: string }) => d.deed)).toEqual(['giftReceived']);
    expect(mem.standing).toBe(0);

    // expired: base prices again
    s.time.advance(HAGGLE_DEAL_MS + 1);
    expect((await api(s, 'GET', '/shop/mirevale', acc.access)).body.deal).toBeNull();
    const m0 = await money(acc);
    expect((await api(s, 'POST', '/shop/buy', acc.access, { item: 'potion', qty: 1 })).body.money).toBe(m0 - potion.price);

    const audit = await rawQuery(s.db, "select action, detail from audit_log where actor_id = $1 and action like 'shop.%' order by at", [acc.id]);
    expect(audit.map((a) => a.action)).toEqual(['shop.haggle', 'shop.buy', 'shop.sell', 'shop.buy']);
    expect(audit[0]!.detail).toMatchObject({ zone: 'mirevale', kind: 'discount', asked: 30, granted: HAGGLE_DISCOUNT_CAP.neutral, feeling: 'neutral' });
    expect(audit[1]!.detail).toMatchObject({ price: unit, base: potion.price, deal: `discount:${HAGGLE_DISCOUNT_CAP.neutral}` });
    await j.room.leave(true);
  }, 60_000);

  it('caps by standing: a friend gets more, a hostile player nothing; repeats wait and shrink', async () => {
    const friend = await register(s);
    const jf = await enter(s, friend, 'mirevale');
    await standing(friend, 8);
    const f1 = await haggle(friend, 'discount', 40);
    expect(f1.body.granted).toBe(HAGGLE_DISCOUNT_CAP.trusted);
    expect((await haggle(friend, 'discount', 40)).body).toMatchObject({ code: 'haggleCooldown' });
    s.time.advance(HAGGLE_COOLDOWN_MS);
    const f2 = await haggle(friend, 'discount', 40);
    expect(f2.body.granted).toBe(Math.floor(HAGGLE_DISCOUNT_CAP.trusted / 2));
    // the better deal stands, with a fresh window
    expect(f2.body.deal).toMatchObject({ kind: 'discount', percent: HAGGLE_DISCOUNT_CAP.trusted });
    expect(Math.abs(Date.parse(f2.body.deal.expiresAt) - (s.time.clock() + HAGGLE_DEAL_MS))).toBeLessThan(2_000);
    s.time.advance(HAGGLE_COOLDOWN_MS);
    expect((await haggle(friend, 'discount', 40)).body.granted).toBe(Math.floor(HAGGLE_DISCOUNT_CAP.trusted / 4));
    s.time.advance(HAGGLE_COOLDOWN_MS);
    const spent = await haggle(friend, 'discount', 40);
    expect(spent.body.granted).toBe(0);
    expect(spent.body.keeper.cap).toBe(0);
    await jf.room.leave(true);

    const foe = await register(s);
    const jh = await enter(s, foe, 'mirevale');
    await standing(foe, -7);
    expect((await api(s, 'GET', '/shop/mirevale', foe.access)).body.keeper).toMatchObject({ cap: 0, feeling: 'hostile' });
    const none = await haggle(foe, 'discount', 20);
    expect(none.body).toMatchObject({ granted: 0, deal: null });
    await jh.room.leave(true);
  }, 60_000);

  it('rudeness raises the prices at once and costs standing; a later discount replaces the markup', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    await standing(acc, 4);
    const m = await haggle(acc, 'markup', 40);
    expect(m.body).toMatchObject({ granted: HAGGLE_MARKUP_MAX, deal: { kind: 'markup', percent: HAGGLE_MARKUP_MAX } });
    const potion = content.item('potion') as { price: number };
    const before = await money(acc);
    expect((await api(s, 'POST', '/shop/buy', acc.access, { item: 'potion', qty: 1 })).body.money).toBe(before - dealBuyPrice(potion.price, m.body.deal));
    const mem = (await api(s, 'GET', `/npc/memory/${KEEPER}`, acc.access)).body;
    expect(mem.standing).toBe(4 + NPC_DEED_DELTA.haggledRudely);
    expect(mem.deeds.map((d: { deed: string }) => d.deed)).toContain('haggledRudely');
    // a second rude line within the cooldown still lands
    expect((await haggle(acc, 'markup', 5)).body.deal).toMatchObject({ kind: 'markup', percent: 5 });
    const d = await haggle(acc, 'discount', 10);
    expect(d.body.deal).toMatchObject({ kind: 'discount', percent: 10 });
    await j.room.leave(true);
  }, 60_000);

  it('refuses a keeper in another zone and a villager who keeps no shop', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    expect((await haggle(acc, 'discount', 10, 'cinderhold.shop.keeper')).body.code).toBe('npcNotHere');
    expect((await haggle(acc, 'discount', 10, 'mirevale.archivist')).body.code).toBe('npcNotHere');
    expect((await haggle(acc, 'discount', 0)).status).toBe(400);
    expect((await haggle(acc, 'discount', 51)).status).toBe(400);
    await j.room.leave(true);
  }, 60_000);
});

describe('/shop/haggle off', () => {
  it('answers npcToolsOff when NPC_TOOLS=off, and the shop shows no keeper', async () => {
    const off = await startServer({ NPC_TOOLS: 'off' });
    try {
      const acc = await register(off);
      const j = await enter(off, acc, 'mirevale');
      expect((await api(off, 'POST', '/shop/haggle', acc.access, { npcId: KEEPER, kind: 'discount', percent: 10 })).body.code).toBe('npcToolsOff');
      const shop = (await api(off, 'GET', '/shop/mirevale', acc.access)).body;
      expect(shop.keeper).toBeUndefined();
      expect(shop.deal).toBeUndefined();
      await j.room.leave(true);
    } finally {
      await off.stop();
    }
  }, 120_000);
});
