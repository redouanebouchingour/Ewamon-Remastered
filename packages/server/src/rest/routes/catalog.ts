/**
 * §4.7 rows: GET /dex, /shop/*, /battle-pass*, /history/*, /players/:username, /leaderboard.
 * Prices, rewards and levels are content + core; the client sends intents (item, qty, level) only.
 */
import { BATTLE_PASS, CHALLENGE_CLEARED_FLAG, CHALLENGE_FAILED_FLAG, CHALLENGE_MODE_FLAG, SHOP_STOCK_DEFAULT, zone as zoneById } from '@ewa/content';
import type { ZoneDef } from '@ewa/content';
import { trainerLevelFor, tierFor } from '@ewa/core';
import type { ConsumableDef, ItemDef, OrbDef } from '@ewa/core';
import {
  ARENA_KINDS,
  BattleHistoryRes,
  BattlePassClaimReq,
  BattlePassClaimRes,
  BattlePassStateSchema,
  CreaturesAddedRes,
  DexRes,
  InventoryMoneyRes,
  LeaderboardQuery,
  LeaderboardRes,
  MythicalChoiceReq,
  PageQuery,
  PublicProfileSchema,
  ShopParams,
  ShopRes,
  ShopTradeReq,
  SpeedrunRes,
  TradeHistoryRes,
  UsernameParams,
  dealBuyPrice,
  dealSellPrice,
} from '@ewa/protocol';
import type { ArenaKind } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { newCreature } from '../../game/creatures';
import { toInstance } from '../../rooms/battleSession';
import { CHAMPION_SPLIT, RUN_START_SPLIT } from '../../game/speedrun';
import { dayKey } from '../../liveops/schedule';
import { HttpError, iso, out, presenceZone, rateLimit, refuseInBattle, requireAuth } from '../http';
import { haggleBook } from '../../game/haggle';
import { npcToolsOn, shopHaggleState } from './haggle';
import type { RestDeps } from '../http';

const HISTORY_PAGE = 25;

/** A history row's arena kind from its start snapshot (null for every other battle). */
function arenaKindOf(v: unknown): ArenaKind | null {
  return typeof v === 'string' && (ARENA_KINDS as readonly string[]).includes(v) ? (v as ArenaKind) : null;
}
const LEADERBOARD_PAGE = 25;
/** Held items (ItemDef.price !== null) are sold only here (§30.6.3). */
export const HELD_ITEM_SHOP_ZONE = 'solenne';

export function shopStock(zone: ZoneDef): readonly string[] | null {
  if (zone.shop === null) return null;
  return zone.shop.length > 0 ? zone.shop : SHOP_STOCK_DEFAULT;
}

type Priced = { readonly buy: number | null; readonly sell: number | null };

/** Content prices: consumables/orbs have price + sellPrice; held items a price (sell = none in v1). */
export function priceOf(deps: RestDeps, item: string): Priced | null {
  let def: ItemDef | ConsumableDef | OrbDef;
  try {
    def = deps.content.item(item);
  } catch (_e) {
    try {
      def = deps.content.orb(item);
    } catch (_e2) {
      return null;
    }
  }
  if ('sellPrice' in def) return { buy: def.price > 0 ? def.price : null, sell: def.sellPrice > 0 ? def.sellPrice : null };
  return { buy: def.price, sell: null };
}

/** Phase D2: `slot: 'key'` items (TMs, old_rod, the HMs) — never stacked, never sold back. */
export function isKeyItem(deps: RestDeps, item: string): boolean {
  try {
    const def = deps.content.item(item);
    return 'slot' in def && def.slot === 'key';
  } catch (_e) {
    return false;
  }
}

export function registerCatalogRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, content, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };
  const haggleOn = npcToolsOn(deps);

  app.get('/dex', bearer, async (req) => {
    const dex = await repos.db.transaction((tx) => repos.progress.dex(tx, req.user.sub));
    return out(deps, DexRes, dex);
  });

  // ---- shop -----------------------------------------------------------------------------------------------------

  app.get('/shop/:zoneId', bearer, async (req) => {
    const { zoneId } = ShopParams.parse(req.params);
    const stock = shopStock(zoneById(zoneId));
    if (stock === null) throw new HttpError(404, 'NotFound');
    const prices: Record<string, number> = {};
    for (const item of stock) {
      const p = priceOf(deps, item);
      if (p?.buy != null) prices[item] = p.buy;
    }
    // shop haggling: the base prices stay as they are; the caller's deal there and the keeper ride along
    return out(deps, ShopRes, { stock: [...stock], prices, ...(await shopHaggleState(deps, haggleOn, req.user.sub, zoneId)) });
  });

  app.post('/shop/buy', bearer, async (req) => {
    const body = ShopTradeReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const zone = presenceZone(deps, id);
    const stock = zone === null ? null : shopStock(zone);
    if (stock === null || !stock.includes(body.item)) throw new HttpError(409, 'notInStock');
    const base = priceOf(deps, body.item)?.buy ?? null;
    if (base === null) throw new HttpError(409, 'notForSale');
    // shop haggling: the deal with this zone's keeper sets the price (the client never sends one)
    const deal = haggleOn ? haggleBook(deps).dealView(id, zone!.id, clock()) : null;
    const price = dealBuyPrice(base, deal);
    // Phase D2: a key item (a TM) is reusable — one copy, bought once
    const key = isKeyItem(deps, body.item);
    if (key && body.qty !== 1) throw new HttpError(409, 'oneAtATime');
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      if (key && (await repos.inventory.qty(tx, id, body.item)) > 0) throw new HttpError(409, 'alreadyOwned');
      const money = await repos.players.addMoney(tx, id, -price * body.qty);
      await repos.inventory.add(tx, id, body.item, body.qty);
      await repos.audit.write(tx, { actorId: id, action: 'shop.buy', subject: body.item, detail: { qty: body.qty, price, ...(deal !== null ? { base, deal: `${deal.kind}:${deal.percent}` } : {}) } }, now);
      return { inventory: await repos.inventory.all(tx, id), money };
    });
    return out(deps, InventoryMoneyRes, res);
  });

  app.post('/shop/sell', bearer, async (req) => {
    const body = ShopTradeReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const zone = presenceZone(deps, id);
    if (zone === null || zone.shop === null) throw new HttpError(409, 'noShopHere');
    const priced = priceOf(deps, body.item);
    const base = priced?.sell ?? null;
    if (base === null) throw new HttpError(409, 'notSellable');
    const deal = haggleOn ? haggleBook(deps).dealView(id, zone.id, clock()) : null;
    const sell = dealSellPrice(base, priced?.buy ?? null, deal);
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      await repos.inventory.add(tx, id, body.item, -body.qty);
      const money = await repos.players.addMoney(tx, id, sell * body.qty);
      await repos.audit.write(tx, { actorId: id, action: 'shop.sell', subject: body.item, detail: { qty: body.qty, price: sell, ...(deal !== null ? { base, deal: `${deal.kind}:${deal.percent}` } : {}) } }, now);
      return { inventory: await repos.inventory.all(tx, id), money };
    });
    return out(deps, InventoryMoneyRes, res);
  });

  // ---- battle pass ----------------------------------------------------------------------------------------------

  app.get('/battle-pass', bearer, async (req) => {
    const id = req.user.sub;
    const s = await repos.db.transaction(async (tx) => ({
      row: await repos.players.byId(tx, id),
      claimed: await repos.battlePass.claimedLevels(tx, id),
      mythical: await repos.battlePass.mythicalChoice(tx, id),
    }));
    if (s.row === null) throw new HttpError(404, 'NotFound');
    return out(deps, BattlePassStateSchema, { trainerExp: s.row.trainerExp, trainerLevel: trainerLevelFor(s.row.trainerExp), claimed: s.claimed, mythicalChoice: s.mythical, rewards: [...BATTLE_PASS] });
  });

  /** level ≤ trainerLevel, no row yet; one tx: row, money, items, creature (box if party full). */
  app.post('/battle-pass/claim', bearer, async (req) => {
    const body = BattlePassClaimReq.parse(req.body);
    const id = req.user.sub;
    const reward = BATTLE_PASS.find((r) => r.level === body.level);
    if (reward === undefined) throw new HttpError(404, 'NotFound');
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      const row = await repos.players.lock(tx, id);
      if (body.level > trainerLevelFor(row.trainerExp)) throw new HttpError(409, 'levelLocked');
      if (!(await repos.battlePass.claim(tx, id, body.level, now))) throw new HttpError(409, 'AlreadyClaimed');
      const money = reward.money > 0 ? await repos.players.addMoney(tx, id, reward.money) : row.money;
      if (Object.keys(reward.items).length > 0) await repos.inventory.addMany(tx, id, reward.items);
      const creaturesAdded = [];
      if (reward.creature !== null) {
        const partySize = (await repos.creatures.party(tx, id)).length;
        const used = new Set((await repos.creatures.byOwner(tx, id)).filter((r) => r.slotKind === 'party').map((r) => r.slotIndex));
        let idx = 0;
        while (used.has(idx)) idx++;
        const c = newCreature(content, reward.creature.species, reward.creature.level, { ownerId: id });
        creaturesAdded.push(toInstance(await repos.creatures.insert(tx, c, partySize < 6 ? { kind: 'party', index: idx } : { kind: 'box', index: 'nextBox' })));
        await repos.progress.markCaught(tx, id, reward.creature.species, 'normal', false, now);
      }
      await repos.audit.write(tx, { actorId: id, action: 'battlePass.claim', subject: String(body.level), detail: {} }, now);
      return { claimed: await repos.battlePass.claimedLevels(tx, id), inventory: await repos.inventory.all(tx, id), money, creaturesAdded };
    });
    return out(deps, BattlePassClaimRes, res);
  });

  /** Exactly one mythical per account, ever: requires the level-50 row with mythical_choice null. */
  app.post('/battle-pass/mythical-choice', bearer, async (req) => {
    const body = MythicalChoiceReq.parse(req.body);
    const id = req.user.sub;
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      const row = await repos.players.lock(tx, id);
      // Phase E5: the choice was ungated (a level-1 account could take a level-50 mythical). The client offers the choice
      // in place of a Claim button on the level-50 tile, so choosing also claims level 50 (row + its money / items).
      const lvl50 = BATTLE_PASS.find((r) => r.mythicalChoice !== null);
      if (lvl50 === undefined || lvl50.level > trainerLevelFor(row.trainerExp)) throw new HttpError(409, 'levelLocked');
      if (await repos.battlePass.claim(tx, id, lvl50.level, now)) {
        if (lvl50.money > 0) await repos.players.addMoney(tx, id, lvl50.money);
        if (Object.keys(lvl50.items).length > 0) await repos.inventory.addMany(tx, id, lvl50.items);
        await repos.audit.write(tx, { actorId: id, action: 'battlePass.claim', subject: String(lvl50.level), detail: {} }, now);
      }
      await repos.battlePass.setMythicalChoice(tx, id, body.species, now);
      const partySize = (await repos.creatures.party(tx, id)).length;
      const used = new Set((await repos.creatures.byOwner(tx, id)).filter((r) => r.slotKind === 'party').map((r) => r.slotIndex));
      let idx = 0;
      while (used.has(idx)) idx++;
      const c = newCreature(content, body.species, 50, { ownerId: id, moves: 'default' });
      const inserted = toInstance(await repos.creatures.insert(tx, c, partySize < 6 ? { kind: 'party', index: idx } : { kind: 'box', index: 'nextBox' }));
      await repos.progress.markSeen(tx, id, body.species, now);
      await repos.progress.markCaught(tx, id, body.species, 'normal', false, now);
      await repos.audit.write(tx, { actorId: id, action: 'battlePass.mythical', subject: body.species, detail: {} }, now);
      return { creaturesAdded: [inserted] };
    });
    return out(deps, CreaturesAddedRes, res);
  });

  // ---- history / players / leaderboard ---------------------------------------------------------------------

  app.get('/history/battles', bearer, async (req) => {
    const { page } = PageQuery.parse(req.query);
    const rows = await repos.db.transaction((tx) => repos.history.battles(tx, req.user.sub, page, HISTORY_PAGE));
    return out(deps, BattleHistoryRes, {
      rows: rows.map((r) => ({
        id: r.id,
        battleId: r.battleId,
        opponent: r.opponent,
        format: r.format,
        result: r.result as 'win' | 'loss' | 'draw' | 'fled' | 'caught',
        turns: r.turns,
        ratingDelta: r.ratingDelta,
        rewards: r.rewards as never,
        happenedAt: iso(r.happenedAt),
        // arena PvP: the kind rides the start snapshot (absent → null)
        arena: arenaKindOf(r.start?.arena),
      })),
    });
  });

  app.get('/history/trades', bearer, async (req) => {
    const { page } = PageQuery.parse(req.query);
    const { rows, names } = await repos.db.transaction(async (tx) => {
      const rows = await repos.history.trades(tx, req.user.sub, page, HISTORY_PAGE);
      // the partner's username for the client's history list (one lookup per page, not per row)
      const partners = rows.length === 0 ? [] : await repos.players.byIds(tx, [...new Set(rows.map((r) => r.partnerId))]);
      return { rows, names: new Map(partners.map((p) => [p.id, p.username])) };
    });
    return out(deps, TradeHistoryRes, {
      rows: rows.map((r) => ({
        id: r.id,
        tradeId: r.tradeId,
        partnerId: r.partnerId,
        partnerUsername: names.get(r.partnerId) ?? null,
        sent: r.sent as never,
        received: r.received as never,
        moneySent: r.moneySent,
        moneyReceived: r.moneyReceived,
        completedAt: iso(r.completedAt),
      })),
    });
  });

  /** toPublic() allow-list (§5.3); unknown or banned → 404. Username matched by equality on username_lower. */
  app.get('/players/:username', bearer, async (req) => {
    // usernames in URLs are lowercased and matched by equality on username_lower (§30.6.6)
    const { username } = UsernameParams.parse({ username: String((req.params as { username?: unknown }).username ?? '').toLowerCase() });
    const pub = await repos.db.transaction(async (tx) => {
      const row = await repos.players.byUsername(tx, username.toLowerCase());
      if (row === null || row.bannedAt !== null) return null;
      return repos.players.publicProfile(tx, row.id);
    });
    if (pub === null) throw new HttpError(404, 'NotFound');
    return out(deps, PublicProfileSchema, { ...pub, badges: [...pub.badges], showcase: pub.showcase.map(toInstance), createdAt: iso(pub.createdAt) });
  });

  /** Verified speedruns: a player's play clock and splits (the caller's own, or a trainer's by name: runs are public). */
  async function speedrunOf(username: string | null, me: string) {
    const now = new Date(clock());
    const v = await repos.db.transaction(async (tx) => {
      const row = username === null ? await repos.players.byId(tx, me) : await repos.players.byUsername(tx, username.toLowerCase());
      if (row === null || (username !== null && row.bannedAt !== null)) return null;
      const c = (await repos.runs.clock(tx, row.id, now))!;
      const splits = await repos.runs.splits(tx, row.id);
      return { row, c, splits };
    });
    if (v === null) throw new HttpError(404, 'NotFound');
    const finish = v.splits.find((x) => x.split === CHAMPION_SPLIT) ?? null;
    return out(deps, SpeedrunRes, {
      username: v.row.username,
      playMs: v.c.playMs,
      running: v.c.running,
      counted: v.splits.some((x) => x.split === RUN_START_SPLIT),
      finishMs: finish?.playMs ?? null,
      splits: v.splits.map((x) => ({ split: x.split, playMs: x.playMs, at: iso(x.at) })),
    });
  }

  app.get('/speedrun', bearer, async (req) => speedrunOf(null, req.user.sub));
  app.get('/speedrun/:username', bearer, async (req) => speedrunOf(UsernameParams.parse(req.params).username, req.user.sub));

  app.get('/leaderboard', bearer, async (req) => {
    const q = LeaderboardQuery.parse(req.query);
    const rows = await repos.db.transaction(async (tx) => {
      // §30.6.3: rating (ties peak, username) / dex caught count / trainer exp; banned excluded in SQL. Phase D14
      // `towerStreak`: best battle tower streak desc (then current, then username), players with a best > 0 only
      // the daily challenge `daily`: today's winners (UTC), fewest turns first, then the earlier win
      const board = q.mode === 'towerStreak' ? await repos.streaks.leaderboard(tx, q.page, LEADERBOARD_PAGE) : null;
      const daily = q.mode === 'daily' ? await repos.daily.leaderboard(tx, dayKey(deps.clock()), q.page, LEADERBOARD_PAGE) : null;
      const dailyOf = new Map((daily ?? []).map((r) => [r.player.id, r]));
      // challenge modes: the mode's runs, cleared first (earliest), then going, then failed, by badges
      const challenge =
        q.mode === 'nuzlocke' || q.mode === 'hardcore'
          ? await repos.progress.challengeBoard(tx, { mode: CHALLENGE_MODE_FLAG[q.mode], cleared: CHALLENGE_CLEARED_FLAG, failed: CHALLENGE_FAILED_FLAG }, q.page, LEADERBOARD_PAGE)
          : null;
      const challengeOf = new Map((challenge ?? []).map((r) => [r.player.id, r]));
      // verified speedruns: the Champion split of counted runs, fastest first
      const speedrun = q.mode === 'speedrun' ? await repos.runs.board(tx, RUN_START_SPLIT, CHAMPION_SPLIT, q.page, LEADERBOARD_PAGE) : null;
      const speedrunOfId = new Map((speedrun ?? []).map((r) => [r.player.id, r.playMs]));
      const mode = q.mode;
      const players =
        mode === 'towerStreak'
          ? (board ?? []).map((r) => r.player)
          : mode === 'daily'
            ? (daily ?? []).map((r) => r.player)
            : mode === 'nuzlocke' || mode === 'hardcore'
              ? (challenge ?? []).map((r) => r.player)
              : mode === 'speedrun'
                ? (speedrun ?? []).map((r) => r.player)
                : await repos.players.leaderboard(tx, mode, q.page, LEADERBOARD_PAGE);
      const streaks = board !== null ? new Map(board.map((r) => [r.player.id, { current: r.current, best: r.best }])) : await repos.streaks.byPlayers(tx, players.map((p) => p.id));
      const out = [];
      for (let i = 0; i < players.length; i++) {
        const p = players[i]!;
        const guild = await repos.social.guildOf(tx, p.id);
        const streak = streaks.get(p.id);
        out.push({
          rank: (q.page - 1) * LEADERBOARD_PAGE + i + 1,
          id: p.id,
          username: p.username,
          title: p.title,
          body: p.body,
          rating: p.rating,
          tier: tierFor(p.rating).key,
          trainerLevel: trainerLevelFor(p.trainerExp),
          dexCaughtCount: (await repos.progress.dex(tx, p.id)).caught.length,
          guildTag: guild?.tag ?? null,
          towerBest: streak?.best ?? 0,
          towerCurrent: streak?.current ?? 0,
          ...(dailyOf.has(p.id) ? { dailyTurns: dailyOf.get(p.id)!.turns, dailyMarks: dailyOf.get(p.id)!.marks } : {}),
          ...(challengeOf.has(p.id) ? { challengeBadges: challengeOf.get(p.id)!.badges, challengeState: challengeOf.get(p.id)!.state } : {}),
          ...(speedrunOfId.has(p.id) ? { speedrunMs: speedrunOfId.get(p.id)! } : {}),
        });
      }
      return out;
    });
    return out(deps, LeaderboardRes, { rows });
  });
}
