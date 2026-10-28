/**
 * §4.7 / 50.4.3 rest.test.ts — every request/response schema accepts its documented example and
 * rejects the listed boundary cases; the route table is well-formed.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  RivalRes,
  RivalWordsReq,
  BountiesRes,
  BountyPostReq,
  CampEditReq,
  CampsRes,
  AuthRes,
  BadTokenErr,
  BanReq,
  BattlePassClaimReq,
  BattlePassStateSchema,
  BidReq,
  CreatureFlagsReq,
  DexRes,
  FriendListsSchema,
  GUILD_TAG_RE,
  GuildCreateReq,
  GuildDetailRes,
  GuildMemberReq,
  HealthRes,
  ItemUseReq,
  LeaderboardQuery,
  LeaderboardRes,
  ListCreateReq,
  ListingDetailRes,
  ListingViewSchema,
  ForgotReq,
  LoginReq,
  MarketQuery,
  MeRes,
  MessageViewSchema,
  MessagesQuery,
  MovesReq,
  MythicalChoiceReq,
  NicknameReq,
  PartyReorderReq,
  PlayerProfileSchema,
  ProfileReq,
  PublicProfileSchema,
  QuestClaimReq,
  QuestClaimRes,
  ROUTES,
  ROUTE_KEYS,
  ChallengeReq,
  RealWeatherRes,
  LiveFeedRes,
  LiveListRes,
  SeasonParams,
  SeasonsRes,
  SeasonTitlesRes,
  WorldShadowRes,
  FactionJoinReq,
  FactionsRes,
  LegendsRes,
  GhostRes,
  NemesesRes,
  EcosystemRes,
  DaycareRes,
  DaycareActionRes,
  EggMoveReq,
  WeatherCitiesQuery,
  WeatherCityReq,
  SpeedrunRes,
  CreatureHistoryRes,
  DailyRes,
  LeaderboardRowSchema,
  REPLAY_BATTLE_ID,
  ReplayRes,
  BattleShareRes,
  BattleShareParams,
  RegisterReq,
  ResetReq,
  RestErrorSchema,
  SendMessageReq,
  SetupReq,
  ShopTradeReq,
  HAGGLE_PERCENT_MAX,
  HaggleReq,
  HaggleRes,
  ShopRes,
  dealBuyPrice,
  dealSellPrice,
  haggleFactor,
  shopkeeperName,
  USERNAME_RE,
  UnbanReq,
  VerifyReq,
  ZoneEnterReq,
  ZoneEnterRes,
  ZoneGatedErr,
  profileRequestFor,
  routePath,
} from '../src/index';
import type { PlayerProfile, RouteKey } from '../src/index';
import { ISO, U1, U2, U3, creature } from './fixtures';

const ok = (s: z.ZodType, v: unknown): void => {
  const r = s.safeParse(v);
  expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
};
const bad = (s: z.ZodType, v: unknown): void => {
  expect(s.safeParse(v).success, `expected rejection of ${JSON.stringify(v)}`).toBe(false);
};

const profile: PlayerProfile = {
  id: U1, username: 'ash_k', email: 'ash@example.com', title: 'Rookie Trainer', motto: '', body: 'ranger_m', money: 3000,
  rating: 1000, peakRating: 1000, rankedMatches: 0, tier: 'Bronze', trainerExp: 0, trainerLevel: 1, isAdmin: false,
  zoneId: 'mirevale', createdAt: ISO,
};

describe('§4.7 auth', () => {
  it('register accepts the example and rejects username / password / starter / email boundaries', () => {
    const v = { username: 'ash_k', email: 'ash@example.com', password: 'pikachu12', starter: 'bramblecub' };
    ok(RegisterReq, v);
    for (const u of ['ab', 'a'.repeat(21), 'Ash', 'ash-k', 'ash k', '']) bad(RegisterReq, { ...v, username: u });
    expect(USERNAME_RE.test('a_1')).toBe(true);
    bad(RegisterReq, { ...v, password: 'x'.repeat(7) });
    ok(RegisterReq, { ...v, password: 'x'.repeat(8) });
    ok(RegisterReq, { ...v, password: 'x'.repeat(128) });
    bad(RegisterReq, { ...v, password: 'x'.repeat(129) });
    bad(RegisterReq, { ...v, starter: 'yahit' });
    bad(RegisterReq, { ...v, starter: 'pikachu' });
    ok(RegisterReq, { ...v, starter: 'glimfin' });
    ok(RegisterReq, { ...v, starter: 'cindercap' });
    bad(RegisterReq, { ...v, email: 'not-an-email' });
    ok(AuthRes, { access: 'a.b.c', refresh: 'r', player: profile });
    bad(AuthRes, { access: '', refresh: 'r', player: profile });
    ok(LoginReq, { username: 'ash_k', password: 'pikachu12' });
    bad(LoginReq, { username: '', password: 'pikachu12' });
    bad(LoginReq, { username: 'ash_k' });
  });

  it('Phase C6 email routes: forgot / reset / verify bodies, emailVerified on the profile, the badToken error', () => {
    ok(ForgotReq, { email: 'ash@example.com' });
    bad(ForgotReq, { email: 'nope' });
    const token = 'A'.repeat(43);
    ok(ResetReq, { token, password: 'pikachu12' });
    bad(ResetReq, { token, password: 'short' });
    bad(ResetReq, { token: 'x', password: 'pikachu12' });
    ok(VerifyReq, { token });
    bad(VerifyReq, {});
    ok(AuthRes, { access: 'a.b.c', refresh: 'r', player: { ...profile, emailVerified: false } });
    ok(BadTokenErr, { code: 'badToken', reason: 'expired' });
    bad(BadTokenErr, { code: 'badToken', reason: 'stolen' });
    expect(ROUTES.authForgot).toMatchObject({ auth: 'none', response: null, limit: 'forgot' });
    expect(ROUTES.authResend).toMatchObject({ auth: 'bearer', response: null, limit: 'resend' });
  });
});

describe('§4.7 me / zone / profile / quests', () => {
  it('GET /me shape', () => {
    ok(MeRes, {
      ...profile,
      party: [creature()], box: [], inventory: { potion: 5 }, badges: ['bloom'], flags: ['met_wynn'],
      quests: [{ id: 'first_catch', progress: [{ questId: 'first_catch', objectiveId: 'catch_one', count: 0, done: false }], claimed: false }],
      battlePass: { trainerExp: 0, trainerLevel: 1, claimed: [], mythicalChoice: null, rewards: [] },
      presence: { roomId: null, zoneId: 'mirevale', shard: 0 }, unreadDm: { [U2]: 2 }, friendRequests: 1,
      liveOps: { dayKey: '2026-09-20', weekKey: '2026-W38', weekdayVariant: null, loginStreak: 3, extra: 'allowed' },
    });
    bad(MeRes, { ...profile, party: [] }); // a player always has ≥ 1 party member
    bad(MeRes, { ...profile }); // missing the extension
  });

  it('POST /zone/enter accepts a ZoneId and rejects a non-ZoneId; response is a SeatReservation; 403 gated names the badge', () => {
    ok(ZoneEnterReq, { zoneId: 'mire_route' });
    bad(ZoneEnterReq, { zoneId: 'pallet_town' });
    bad(ZoneEnterReq, { zoneId: 'route_21' });
    bad(ZoneEnterReq, {});
    ok(ZoneEnterRes, { seat: { name: 'zone', sessionId: 's', roomId: 'r', processId: 'p' } });
    bad(ZoneEnterRes, { seat: 'sess' });
    ok(ZoneGatedErr, { code: 'gated', badge: 'bloom' });
    bad(ZoneGatedErr, { code: 'gated', badge: 'gold' });
    ok(RestErrorSchema, { code: 'inBattle' });
    ok(RestErrorSchema, { code: 'invalidPayload', detail: 'x' });
  });

  it('POST /profile: base shape, then TITLES/BODIES refinement via profileRequestFor', () => {
    ok(ProfileReq, { title: 'Rookie Trainer' });
    ok(ProfileReq, { motto: 'x'.repeat(120) });
    bad(ProfileReq, { motto: 'x'.repeat(121) });
    bad(ProfileReq, { title: '' });
    bad(ProfileReq, { body: 42 });
    const refined = profileRequestFor(['Rookie Trainer', 'Gym Leader'], ['ranger_m', 'ranger_f']);
    ok(refined, { title: 'Gym Leader', body: 'ranger_f', motto: 'hi' });
    ok(refined, {});
    bad(refined, { title: 'God Emperor' });
    bad(refined, { body: 'pikachu' });
    const r = refined.safeParse({ title: 'God Emperor', body: 'pikachu' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join('.')).sort()).toEqual(['body', 'title']);
  });

  it('POST /quests/claim requires questId; objectiveId optional', () => {
    ok(QuestClaimReq, { questId: 'first_catch' });
    ok(QuestClaimReq, { questId: 'daily:2026-09-20', objectiveId: 'catches' });
    bad(QuestClaimReq, {});
    bad(QuestClaimReq, { objectiveId: 'catches' });
    bad(QuestClaimReq, { questId: '' });
    bad(QuestClaimReq, { questId: 'x'.repeat(65) });
    ok(QuestClaimRes, { inventory: {}, money: 3100, creaturesAdded: [], questProgress: [] });
  });
});

describe('§4.7 party / creature / items', () => {
  it('party reorder 1..6 unique uuids', () => {
    ok(PartyReorderReq, { order: [U1, U2] });
    bad(PartyReorderReq, { order: [] });
    bad(PartyReorderReq, { order: [U1, U2, U3, U1, U2, U3, U1] });
    bad(PartyReorderReq, { order: [U1, U1] });
    bad(PartyReorderReq, { order: ['c1'] });
  });

  it('nickname 1..16 | null; moves 1..4 unique; setup; flags', () => {
    ok(NicknameReq, { nickname: 'Sprout' });
    ok(NicknameReq, { nickname: null });
    ok(NicknameReq, { nickname: 'x'.repeat(16) });
    bad(NicknameReq, { nickname: 'x'.repeat(17) });
    bad(NicknameReq, { nickname: '' });
    bad(NicknameReq, {});
    ok(MovesReq, { moves: ['tackle'] });
    ok(MovesReq, { moves: ['a', 'b', 'c', 'd'] });
    bad(MovesReq, { moves: [] });
    bad(MovesReq, { moves: ['a', 'b', 'c', 'd', 'e'] });
    bad(MovesReq, { moves: ['a', 'a'] });
    ok(SetupReq, { ability: 'overgrow', heldItem: null });
    ok(SetupReq, { ability: 'overgrow', heldItem: 'leftovers' });
    bad(SetupReq, { ability: 'overgrow' });
    bad(SetupReq, { ability: '', heldItem: null });
    ok(CreatureFlagsReq, { favorite: true });
    ok(CreatureFlagsReq, {});
    bad(CreatureFlagsReq, { favorite: 'yes' });
  });

  it('item use qty 1..99, target uuid | null', () => {
    ok(ItemUseReq, { item: 'potion', target: U2, qty: 1 });
    ok(ItemUseReq, { item: 'repel', target: null, qty: 99 });
    bad(ItemUseReq, { item: 'potion', target: U2, qty: 0 });
    bad(ItemUseReq, { item: 'potion', target: U2, qty: 100 });
    bad(ItemUseReq, { item: 'potion', target: 'c1', qty: 1 });
    bad(ItemUseReq, { item: 'potion', qty: 1 });
  });
});

describe('§4.7 dex / shop / marketplace', () => {
  it('dex + shop', () => {
    ok(DexRes, { seen: ['glimfin'], caught: [], variants: { glimfin: ['dawn'] }, alpha: [] });
    bad(DexRes, { seen: [], caught: [], variants: { glimfin: ['gold'] }, alpha: [] });
    ok(ShopTradeReq, { item: 'potion', qty: 5 });
    bad(ShopTradeReq, { item: 'potion', qty: 0 });
    bad(ShopTradeReq, { item: 'potion', qty: 100 });
    bad(ShopTradeReq, { item: '', qty: 1 });
  });

  it('shop haggling: the request, the deal on the shop, and the keeper names', () => {
    ok(HaggleReq, { npcId: 'mirevale.shop.keeper', kind: 'discount', percent: 15 });
    ok(HaggleReq, { npcId: 'mirevale.shop.keeper', kind: 'markup', percent: HAGGLE_PERCENT_MAX });
    bad(HaggleReq, { npcId: 'mirevale.shop.keeper', kind: 'discount', percent: 0 });
    bad(HaggleReq, { npcId: 'mirevale.shop.keeper', kind: 'gift', percent: 5 });
    bad(HaggleReq, { npcId: 'mirevale.shop.keeper', kind: 'discount', percent: HAGGLE_PERCENT_MAX + 1 });
    const deal = { npcId: 'k', npcName: 'Hessa', zoneId: 'mirevale', kind: 'discount', percent: 15, expiresAt: '2026-10-24T10:00:00.000Z' };
    const keeper = { npcId: 'k', npcName: 'Hessa', cap: 10, feeling: 'neutral', readyAt: null };
    ok(ShopRes, { stock: ['potion'], prices: { potion: 300 } });
    ok(ShopRes, { stock: ['potion'], prices: { potion: 300 }, deal, keeper });
    ok(ShopRes, { stock: ['potion'], prices: { potion: 300 }, deal: null, keeper: null });
    ok(HaggleRes, { deal: null, granted: 0, keeper });
    expect(shopkeeperName('mirevale.shop.keeper')).toBe(shopkeeperName('mirevale.shop.keeper'));
    expect(new Set(['mirevale', 'cinderhold', 'stormrook', 'marrowdig', 'vesperveil', 'forgewall', 'solenne'].map((z) => shopkeeperName(`${z}.shop.keeper`))).size).toBeGreaterThan(3);
    expect(dealBuyPrice(300, null)).toBe(300);
    expect(dealSellPrice(150, 300, null)).toBe(150);
    expect(haggleFactor(0)).toBe(1);
    expect(haggleFactor(3)).toBe(0);
  });

  it('a recurring rival: the view, the state before the first meeting and the parting words', () => {
    const rival = {
      name: 'Corin', look: 'casual2_male', temperament: 'cool', signature: 'glimfin', arc: 'cocky',
      record: { playerWins: 0, rivalWins: 1, draws: 0, meetings: 1 },
      last: { result: 'lost', zoneId: 'mire_route', at: '2026-10-24T10:00:00.000Z', words: null },
      team: [{ speciesId: 'glimfin', level: 14 }],
    };
    ok(RivalRes, { enabled: true, rival });
    ok(RivalRes, { enabled: true, rival: { ...rival, last: null, team: [] } });
    ok(RivalRes, { enabled: false, rival: null });
    bad(RivalRes, { enabled: true, rival: { ...rival, arc: 'smug' } });
    bad(RivalRes, { enabled: true, rival: { ...rival, temperament: 'sleepy' } });
    bad(RivalRes, { enabled: true, rival: { ...rival, last: { ...rival.last, result: 'fled' } } });
    ok(RivalWordsReq, { text: 'Next time, I win.' });
    bad(RivalWordsReq, { text: '   ' });
    bad(RivalWordsReq, { text: 'x'.repeat(201) });
  });

  it('marketplace query coerces strings and caps pageSize at 50', () => {
    const r = MarketQuery.safeParse({ search: 'glim', variant: 'dawn', isAlpha: 'true', levelMin: '5', levelMax: '30', sort: 'priceAsc', page: '2', pageSize: '50' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ search: 'glim', variant: 'dawn', isAlpha: true, levelMin: 5, levelMax: 30, sort: 'priceAsc', page: 2, pageSize: 50 });
    const d = MarketQuery.safeParse({});
    expect(d.success).toBe(true);
    if (d.success) expect(d.data).toEqual({ sort: 'endingSoon', page: 1, pageSize: 20 });
    bad(MarketQuery, { pageSize: 51 });
    bad(MarketQuery, { pageSize: '51' });
    bad(MarketQuery, { page: 0 });
    bad(MarketQuery, { sort: 'random' });
    bad(MarketQuery, { variant: 'shiny' });
    bad(MarketQuery, { levelMin: 101 });
  });

  it('list: startingBid ≥ 100, duration 12|24|48, buyNow > startingBid or null; bid amount', () => {
    ok(ListCreateReq, { creatureId: U2, startingBid: 100, buyNowPrice: null, durationHours: 12 });
    ok(ListCreateReq, { creatureId: U2, startingBid: 100, buyNowPrice: 101, durationHours: 48 });
    bad(ListCreateReq, { creatureId: U2, startingBid: 99, buyNowPrice: null, durationHours: 24 });
    bad(ListCreateReq, { creatureId: U2, startingBid: 100, buyNowPrice: null, durationHours: 36 });
    bad(ListCreateReq, { creatureId: U2, startingBid: 100, buyNowPrice: 100, durationHours: 24 });
    bad(ListCreateReq, { creatureId: 'c1', startingBid: 100, buyNowPrice: null, durationHours: 24 });
    bad(ListCreateReq, { creatureId: U2, startingBid: 100, durationHours: 24 });
    ok(BidReq, { amount: 150 });
    bad(BidReq, { amount: 0 });
    bad(BidReq, { amount: 1.5 });
  });

  it('listing views', () => {
    const listing = {
      id: U3, sellerId: U1, creatureId: U2, speciesId: 'glimfin', level: 20, variantKey: 'dusk', isAlpha: false,
      startingBid: 100, currentBid: null, currentBidderId: null, buyNowPrice: 500, status: 'active',
      createdAt: ISO, expiresAt: '2026-09-21T12:00:00+02:00', resolvedAt: null,
    };
    ok(ListingViewSchema, listing);
    ok(ListingDetailRes, { ...listing, bids: [{ id: 1, listingId: U3, bidderId: U2, amount: 150, placedAt: ISO }] });
    bad(ListingViewSchema, { ...listing, status: 'open' });
    bad(ListingViewSchema, { ...listing, createdAt: 'yesterday' });
  });
});

describe('§4.7 friends / messages / guilds / leaderboard / players', () => {
  it('friend lists + DMs', () => {
    const f = { id: U2, username: 'misty', title: 'Rookie Trainer', body: 'ranger_f', online: true, zoneId: 'saltmourn', inBattle: false, lastSeenAt: ISO };
    ok(FriendListsSchema, { friends: [f], incoming: [], outgoing: [{ ...f, online: false, zoneId: null }] });
    bad(FriendListsSchema, { friends: [{ ...f, zoneId: 'cerulean' }], incoming: [], outgoing: [] });
    ok(SendMessageReq, { text: 'x'.repeat(300) });
    bad(SendMessageReq, { text: 'x'.repeat(301) });
    bad(SendMessageReq, { text: '' });
    ok(MessageViewSchema, { id: 1, fromId: U1, toId: U2, text: 'hi', sentAt: ISO, readAt: null });
    const q = MessagesQuery.safeParse({ limit: '50' });
    expect(q.success && q.data.limit === 50).toBe(true);
    bad(MessagesQuery, { limit: 51 });
    ok(MessagesQuery, { before: ISO });
    bad(MessagesQuery, { before: 'now' });
  });

  it('guild tag /^[A-Z0-9]{3,4}$/: AB rejected, ABC/ABCD accepted; name 3..24', () => {
    ok(GuildCreateReq, { name: 'Mire Rangers', tag: 'ABC' });
    ok(GuildCreateReq, { name: 'Mire Rangers', tag: 'ABCD' });
    ok(GuildCreateReq, { name: 'Mire Rangers', tag: 'R4NG' });
    bad(GuildCreateReq, { name: 'Mire Rangers', tag: 'AB' });
    bad(GuildCreateReq, { name: 'Mire Rangers', tag: 'ABCDE' });
    bad(GuildCreateReq, { name: 'Mire Rangers', tag: 'abc' });
    bad(GuildCreateReq, { name: 'Mi', tag: 'ABC' });
    bad(GuildCreateReq, { name: 'x'.repeat(25), tag: 'ABC' });
    expect(GUILD_TAG_RE.test('AB')).toBe(false);
    ok(GuildMemberReq, {});
    ok(GuildMemberReq, { playerId: U2 });
    bad(GuildMemberReq, { playerId: 'bob' });
    ok(GuildDetailRes, {
      id: U3, name: 'Mire Rangers', tag: 'ABC', leaderId: U1, motd: '', memberCount: 1, createdAt: ISO,
      members: [{ playerId: U1, username: 'ash_k', role: 'leader', joinedAt: ISO }],
    });
  });

  it('leaderboard mode enum + PublicProfile allow-list shape', () => {
    const q = LeaderboardQuery.safeParse({ mode: 'dex', page: '3' });
    expect(q.success && q.data.mode === 'dex' && q.data.page === 3).toBe(true);
    expect(LeaderboardQuery.parse({})).toEqual({ mode: 'rating', page: 1 });
    bad(LeaderboardQuery, { mode: 'money' });
    ok(LeaderboardRes, { rows: [{ rank: 1, id: U1, username: 'ash_k', title: 't', body: 'ranger_m', rating: 1200, tier: 'Silver', trainerLevel: 4, dexCaughtCount: 12, guildTag: null }] });
    const pub = {
      id: U1, username: 'ash_k', title: 'Rookie Trainer', motto: '', body: 'ranger_m', rating: 1000, peakRating: 1000, tier: 'Bronze',
      trainerLevel: 1, badges: [], guildTag: null, dexCaughtCount: 3, showcase: [creature({ ownerId: null })], createdAt: ISO,
    };
    ok(PublicProfileSchema, pub);
    bad(PublicProfileSchema, { ...pub, showcase: [creature(), creature(), creature(), creature()] });
    bad(PublicProfileSchema, { ...pub, guildTag: 'AB' });
    ok(PlayerProfileSchema, profile);
    bad(PlayerProfileSchema, { ...profile, zoneId: 'kanto' });
  });
});

describe('§4.7 battle pass / admin / health', () => {
  it('battle pass', () => {
    ok(BattlePassStateSchema, {
      trainerExp: 500, trainerLevel: 5, claimed: [1, 2], mythicalChoice: null,
      rewards: [{ level: 1, label: 'Welcome', rarity: 'common', money: 500, items: { potion: 3 }, creature: null, mythicalChoice: null }],
    });
    ok(BattlePassClaimReq, { level: 1 });
    ok(BattlePassClaimReq, { level: 100 });
    bad(BattlePassClaimReq, { level: 0 });
    bad(BattlePassClaimReq, { level: 101 });
    bad(BattlePassClaimReq, { level: '5' });
    ok(MythicalChoiceReq, { species: 'lumyth' });
    ok(MythicalChoiceReq, { species: 'noxmyth' });
    bad(MythicalChoiceReq, { species: 'mew' });
  });

  it('admin ban reason 1..200; health', () => {
    ok(BanReq, { username: 'ash_k', reason: 'botting' });
    bad(BanReq, { username: 'ash_k', reason: '' });
    bad(BanReq, { username: 'ash_k', reason: 'x'.repeat(201) });
    bad(BanReq, { username: 'Ash', reason: 'x' });
    ok(UnbanReq, { username: 'ash_k' });
    ok(HealthRes, { status: 'ok', time: 1_758_369_600_000 });
    bad(HealthRes, { status: 'degraded', time: 1 });
  });
});

describe('route table', () => {
  it('every §4.7 route is present with a unique method+path and a schema for each :param', () => {
    const seen = new Set<string>();
    for (const key of ROUTE_KEYS) {
      const r = ROUTES[key];
      expect(r.path.startsWith('/')).toBe(true);
      expect(['GET', 'POST']).toContain(r.method);
      expect(['none', 'bearer', 'admin']).toContain(r.auth);
      const sig = `${r.method} ${r.path}`;
      expect(seen.has(sig), `duplicate ${sig}`).toBe(false);
      seen.add(sig);
      if (r.path.includes(':')) expect('params' in r && r.params, `${key} needs params`).toBeTruthy();
      if (r.method === 'GET') expect('request' in r).toBe(false);
    }
    const paths = ROUTE_KEYS.map((k: RouteKey) => `${ROUTES[k].method} ${ROUTES[k].path}`);
    for (const must of [
      'POST /auth/register', 'POST /auth/login', 'POST /auth/refresh', 'POST /auth/logout',
      'POST /auth/forgot', 'POST /auth/reset', 'POST /auth/verify', 'POST /auth/resend', 'GET /me', 'POST /zone/enter', 'POST /profile',
      'POST /quests/claim', 'POST /party/reorder', 'POST /party/swap', 'POST /party/withdraw', 'POST /party/deposit',
      'POST /creature/:id/nickname', 'POST /creature/:id/moves', 'POST /creature/:id/setup', 'POST /creature/:id/evolve',
      'POST /creature/:id/release', 'POST /creature/:id/flags', 'POST /item/use', 'POST /heal', 'GET /dex', 'GET /shop/:zoneId',
      'POST /shop/buy', 'POST /shop/sell', 'GET /marketplace', 'GET /marketplace/my/active', 'GET /marketplace/my/bids',
      'GET /marketplace/:id', 'POST /marketplace/list', 'POST /marketplace/:id/bid', 'POST /marketplace/:id/buy-now',
      'POST /marketplace/:id/cancel', 'GET /friends', 'POST /friends/request', 'POST /friends/accept', 'POST /friends/decline',
      'POST /friends/remove', 'GET /messages/:username', 'POST /messages/:username', 'POST /messages/read', 'GET /guilds',
      'GET /guilds/:id', 'POST /guilds', 'POST /guilds/:id/join', 'POST /guilds/:id/leave', 'POST /guilds/:id/kick',
      'POST /guilds/:id/promote', 'GET /leaderboard', 'GET /players/:username', 'GET /battle-pass', 'POST /battle-pass/claim',
      'POST /battle-pass/mythical-choice', 'GET /history/battles', 'GET /history/trades', 'GET /admin/stats', 'GET /admin/players',
      'GET /admin/metrics', 'POST /admin/ban', 'POST /admin/unban', 'GET /health',
    ]) {
      expect(paths, must).toContain(must);
    }
    expect(ROUTE_KEYS).toHaveLength(130); // GET /conversations + the 6 /social routes (prefs, relation, blocks) + POST /dex/rewards/:rewardId/claim + POST /dex/viewed/:speciesId + GET /journal + GET + POST /journal/day/:day + GET /world/rumours/:zoneId + GET + POST /rival/words + POST /shop/haggle + the 5 /npc/quests routes + GET + POST /npc/memory + POST /npc/act + GET /camps + POST /camps/edit + /camps/abandon + GET + POST /bounties + GET /world/ecosystem/:zoneId + GET /nemeses + the 5 daycare / egg routes + GET /ghost + GET /legends + the 3 faction routes + GET /world/shadow + the 3 season routes + the 2 live routes + the 3 weather routes + GET /speedrun + /speedrun/:username + POST /challenge + 60 of §4.7 + the four Phase C6 email routes + Phase D2 POST /creature/:id/tutor + the 7 arena routes + the 2 replay routes + GET /creature/:id/history + the 2 daily routes
    expect(paths).toContain('GET /daily');
    expect(paths).toContain('POST /challenge');
    expect(paths).toContain('POST /daily/start');
    expect(paths).toContain('GET /creature/:id/history');
    expect(paths).toContain('POST /history/battles/:battleId/share');
    expect(paths).toContain('GET /replay/:token');
    expect(ROUTES.replay.auth).toBe('none');
    expect(ROUTES.replay.limit).toBe('replay');
    expect(ROUTES.historyShare.auth).toBe('bearer');
    expect(ROUTES.authRegister.auth).toBe('none');
    expect(ROUTES.health.auth).toBe('none');
    expect(ROUTES.adminBan.auth).toBe('admin');
    expect(ROUTES.creatureRelease.response).toBeNull();
    expect(ROUTES.messagesRead.response).toBeNull();
    expect(ROUTES.marketplaceList.limit).toBe('listing');
    expect(ROUTES.marketplaceBid.limit).toBe('bid');
  });

  it('routePath substitutes and encodes params', () => {
    expect(routePath('shop', { zoneId: 'mirevale' })).toBe('/shop/mirevale');
    expect(routePath('messagesThread', { username: 'ash k' })).toBe('/messages/ash%20k');
    expect(routePath('me')).toBe('/me');
    expect(() => routePath('marketplaceBid')).toThrow(RangeError);
  });
});

describe('battle replays', () => {
  const replay = {
    token: 'AbC123_-xyz0',
    format: 'pvp',
    seat: 1,
    labels: ['ash_k', 'misty'],
    result: 'win',
    turns: 4,
    happenedAt: '2026-10-20T10:00:00.000Z',
    seed: [1, 2, 3, 4],
    start: { zoneId: 'mirevale', terrain: 'grove', sides: [{ kind: 'player' }, { kind: 'player' }], arena: 'ranked' },
    actions: [[{ kind: 'move', move: 'tackle' }, { kind: 'move', move: 'ember' }]],
    finalDigest: '0a1b2c3d',
  };
  it('ReplayRes accepts an anonymised replay and refuses a bad token, seat or digest', () => {
    ok(ReplayRes, replay);
    ok(ReplayRes, { ...replay, labels: ['ash_k', null], format: 'wild', start: { zoneId: 'mirevale', terrain: 'grove', sides: [{}, {}], slots: 2, noExp: true } });
    bad(ReplayRes, { ...replay, token: 'short' });
    bad(ReplayRes, { ...replay, token: 'has space in' });
    bad(ReplayRes, { ...replay, seat: 2 });
    bad(ReplayRes, { ...replay, finalDigest: 'XYZ' });
    ok(BattleShareRes, { token: 'AbC123_-xyz0' });
    bad(BattleShareParams, { battleId: 'not-a-uuid' });
    expect(REPLAY_BATTLE_ID).toBe('replay');
  });
});

describe('creature history', () => {
  it('CreatureHistoryRes accepts every event kind and refuses an unknown kind or a bad field', () => {
    const at = '2026-10-20T10:00:00.000Z';
    ok(CreatureHistoryRes, {
      originalTrainer: 'ash_k',
      events: [
        { kind: 'met', at, how: 'caught', speciesId: 'glimfin', level: 7, zoneId: 'mire_route', trainer: 'ash_k' },
        { kind: 'met', at, how: 'received', speciesId: 'glimfin', level: 5, zoneId: null, trainer: 'ash_k' },
        { kind: 'traded', at, from: 'ash_k', to: 'misty' },
        { kind: 'sold', at, from: 'misty', to: 'brock' },
        { kind: 'gift', at, from: 'brock', to: 'ash_k' },
        { kind: 'evolved', at, from: 'glimfin', into: 'tidefin' },
        { kind: 'badge', at, badge: 'tidal' },
        { kind: 'champion', at },
        { kind: 'legendary', at, species: 'hyoryu', caught: true },
        { kind: 'hatched', at, speciesId: 'dustcub', zoneId: 'mirevale', parents: ['Badlander', 'Rex'], trainer: 'ash_k' },
        { kind: 'nemesis', at, how: 'beaten', name: 'Scarjaw the Unbroken', speciesId: 'dustcub', rank: 2, zoneId: 'mire_route' },
      ],
    });
    ok(CreatureHistoryRes, { originalTrainer: null, events: [] });
    bad(CreatureHistoryRes, { originalTrainer: null, events: [{ kind: 'stolen', at }] });
    bad(CreatureHistoryRes, { originalTrainer: null, events: [{ kind: 'met', at, how: 'hatched', speciesId: 'x', level: 1, zoneId: null, trainer: 'a' }] });
    bad(CreatureHistoryRes, { originalTrainer: null, events: [{ kind: 'legendary', at, species: 'hyoryu' }] });
  });
});

describe('the daily challenge', () => {
  it('DailyRes: three a side, a day key, par; the leaderboard row carries the daily turns and strip', () => {
    const c = { speciesId: 'glimfin', level: 50, moves: ['tackle'], ability: 'Swift Swim' };
    const daily = { dayKey: '2026-10-20', number: 1, endsAt: '2026-10-21T00:00:00.000Z', team: [c, c, c], foe: [c, c, c], foeName: 'Daily Rival', par: 7, best: null, attempts: 0, winners: 0 };
    ok(DailyRes, daily);
    ok(DailyRes, { ...daily, best: { turns: 5, marks: '.K.KK', battleId: '00000000-0000-4000-8000-000000000001' }, attempts: 3 });
    bad(DailyRes, { ...daily, team: [c, c] });
    bad(DailyRes, { ...daily, dayKey: '20-10-2026' });
    bad(DailyRes, { ...daily, par: 0 });
    expect(LeaderboardRowSchema.safeParse({ rank: 1, id: '00000000-0000-4000-8000-000000000001', username: 'ash_k', title: 't', body: 'b', rating: 1000, tier: 'bronze', trainerLevel: 1, dexCaughtCount: 0, guildTag: null, dailyTurns: 5, dailyMarks: '.K.KK' }).success).toBe(true);
  });
});

describe('challenge modes', () => {
  it('register takes an optional run; the switch takes normal or a mode; leaderboard rows carry the run', () => {
    const reg = { username: 'ash_k', email: 'a@b.cd', password: 'correct horse battery', starter: 'bramblecub' };
    ok(RegisterReq, reg);
    ok(RegisterReq, { ...reg, challenge: 'nuzlocke' });
    ok(RegisterReq, { ...reg, challenge: 'hardcore' });
    bad(RegisterReq, { ...reg, challenge: 'ironman' });
    for (const mode of ['normal', 'nuzlocke', 'hardcore']) ok(ChallengeReq, { mode });
    bad(ChallengeReq, { mode: 'easy' });
    expect(LeaderboardRowSchema.safeParse({ rank: 1, id: '00000000-0000-4000-8000-000000000001', username: 'ash_k', title: 't', body: 'b', rating: 1000, tier: 'bronze', trainerLevel: 1, dexCaughtCount: 0, guildTag: null, challengeBadges: 3, challengeState: 'cleared' }).success).toBe(true);
  });
});

describe('verified speedruns', () => {
  it('SpeedrunRes: the clock, whether the run counts, the finish and the splits', () => {
    const at = '2026-10-20T10:00:00.000Z';
    ok(SpeedrunRes, { username: 'ash_k', playMs: 90_000, running: true, counted: true, finishMs: null, splits: [{ split: 'beat:first_witness', playMs: 12_000, at }] });
    ok(SpeedrunRes, { username: 'ash_k', playMs: 9_000_000, running: false, counted: true, finishMs: 8_999_000, splits: [{ split: 'champion', playMs: 8_999_000, at }] });
    bad(SpeedrunRes, { username: 'ash_k', playMs: -1, running: false, counted: false, finishMs: null, splits: [] });
    expect(ROUTES.speedrunOf.path).toBe('/speedrun/:username');
  });
});

describe('weather from real life', () => {
  it('a city is rounded coordinates and a name; the search needs two letters; null turns it off', () => {
    const city = { name: 'Rotterdam', country: 'Netherlands', lat: 51.9, lon: 4.5 };
    ok(WeatherCityReq, { city });
    ok(WeatherCityReq, { city: null });
    ok(WeatherCityReq, { city: { ...city, region: 'South Holland' } });
    bad(WeatherCityReq, { city: { ...city, lat: 91 } });
    ok(WeatherCitiesQuery, { q: 'Ro' });
    bad(WeatherCitiesQuery, { q: 'R' });
    ok(RealWeatherRes, { city, kind: 'rain' });
    ok(RealWeatherRes, { city: null, kind: null });
    bad(RealWeatherRes, { city, kind: 'snow' });
    expect(ROUTES.weatherCities.limit).toBe('weather');
  });
});

describe('seasons and spectator mode', () => {
  it('season rows carry a title; the season param is a number; past seasons are at most six', () => {
    const row = { rank: 1, username: 'ash', rating: 1301, wins: 4, losses: 1, title: 'champion' };
    const info = { season: 1, startsAt: ISO, endsAt: ISO, finalsAt: ISO };
    ok(SeasonsRes, { current: { ...info, finals: false, top: [row] }, past: [{ ...info, top: [{ ...row, rank: 9, title: null }] }] });
    bad(SeasonsRes, { current: { ...info, finals: false, top: [{ ...row, title: 'winner' }] }, past: [] });
    expect(SeasonParams.parse({ season: '3' }).season).toBe(3);
    bad(SeasonParams, { season: '0' });
    ok(SeasonTitlesRes, { username: 'ash', titles: [{ season: 1, rank: 2, title: 'finalist' }] });
    expect(ROUTES.seasonTitles.path).toBe('/seasons/titles/:username');
  });

  it('a live match lists two players; its feed is a replay with a digest and, at the end, an outcome', () => {
    const match = { matchId: U1, kind: 'ranked', finals: true, players: [{ name: 'ash', rating: 1200 }, { name: 'gary', rating: 1190 }], turn: 3, startedAt: ISO };
    ok(LiveListRes, { matches: [match] });
    bad(LiveListRes, { matches: [{ ...match, kind: 'friend' }] });
    const replay = { format: 'pvp', seat: 0, labels: ['ash', 'gary'], seed: [1, 2, 3, 4], start: { zoneId: 'arena', terrain: 'capital', sides: [{}, {}] }, actions: [], digest: '0a1b2c3d' };
    ok(LiveFeedRes, { ...match, replay, outcome: null });
    ok(LiveFeedRes, { ...match, replay, outcome: { winner: 0 } });
    bad(LiveFeedRes, { ...match, replay: { ...replay, digest: 'nope' }, outcome: null });
  });
});

describe('honor shapes the world', () => {
  it('lists only shadowed zones, at levels 1 to 4', () => {
    ok(WorldShadowRes, { season: 1, zones: [{ zoneId: 'mire_route', level: 2, light: 10, shadow: 40 }] });
    bad(WorldShadowRes, { season: 1, zones: [{ zoneId: 'mire_route', level: 0, light: 10, shadow: 4 }] });
    bad(WorldShadowRes, { season: 1, zones: [{ zoneId: 'mire_route', level: 5, light: 0, shadow: 99 }] });
  });
});

describe('Majin vs Tenjin seasons', () => {
  it('two sides only; the chronicle carries a winner or none', () => {
    ok(FactionJoinReq, { side: 'majin' });
    bad(FactionJoinReq, { side: 'neutral' });
    const view = {
      season: 2,
      endsAt: ISO,
      mine: { side: 'tenjin', points: 9 },
      points: { majin: 40, tenjin: 52 },
      members: { majin: 4, tenjin: 5 },
      top: { majin: [{ username: 'ash', points: 12 }], tenjin: [] },
      sky: 'majin',
      chronicle: [{ season: 1, winner: 'majin', line: 'Season 1: the Majin held the sky.' }],
    };
    ok(FactionsRes, view);
    ok(FactionsRes, { ...view, mine: null, sky: null, chronicle: [] });
    bad(FactionsRes, { ...view, chronicle: [{ season: 0, winner: null, line: 'before the first season' }] });
    bad(FactionsRes, { ...view, points: { majin: -1, tenjin: 0 } });
  });
});

describe('one roaming legendary per season', () => {
  it('roaming (a route and when it moves) or caught (by whom)', () => {
    ok(LegendsRes, { season: 1, species: 'voltaura', zoneId: 'mire_route', movesAt: ISO, caught: null, past: [] });
    const caught = { season: 1, species: 'voltaura', username: 'ash', at: ISO };
    ok(LegendsRes, { season: 1, species: 'voltaura', zoneId: null, movesAt: null, caught, past: [caught] });
    bad(LegendsRes, { season: 1, species: 'voltaura', zoneId: null, movesAt: null, caught: { ...caught, season: 0 }, past: [] });
  });
});

describe('ghost trainers', () => {
  it('a haunting zone with its party (at most six), or none; the fights', () => {
    const fight = { challenger: 'gary', zoneId: 'mire_route', won: true, at: ISO };
    ok(GhostRes, { haunting: { zoneId: 'mire_route', leftAt: ISO, party: [{ speciesId: 'bramblecub', level: 12 }] }, won: 1, lost: 0, fights: [fight] });
    ok(GhostRes, { haunting: null, won: 0, lost: 0, fights: [] });
    bad(GhostRes, { haunting: { zoneId: 'mire_route', leftAt: ISO, party: Array.from({ length: 7 }, () => ({ speciesId: 'x', level: 5 })) }, won: 0, lost: 0, fights: [] });
  });
});

describe('breeding', () => {
  const eggView = { id: U1, place: 'party', stepsTotal: 900, stepsWalked: 12, bandborn: true, parents: ['Badlander', 'Rex'], zoneId: 'mirevale', laidAt: ISO };
  const view = { zoneId: 'mirevale', pair: [creature(), creature({ id: U2 })], refusal: null, hatches: 'dustcub', bandborn: true, eggAt: ISO, eggReady: false, eggs: [eggView], carryMax: 3, eggMax: 12 };
  it('the Daycare: at most two left, a refusal or what hatches, the eggs', () => {
    ok(DaycareRes, view);
    ok(DaycareRes, { ...view, pair: [], refusal: null, hatches: null, bandborn: false, eggAt: null, eggs: [] });
    ok(DaycareRes, { ...view, refusal: 'legendary', hatches: null, eggAt: null });
    bad(DaycareRes, { ...view, pair: [creature(), creature(), creature()] });
    bad(DaycareRes, { ...view, refusal: 'shy' });
    bad(DaycareRes, { ...view, eggs: [{ ...eggView, place: 'pocket' }] });
    ok(DaycareActionRes, { daycare: view, party: [creature()], box: [] });
    ok(EggMoveReq, { place: 'box' });
    bad(EggMoveReq, { place: 'daycare' });
  });
});

describe('nemeses', () => {
  const memory = { how: 'ko', zoneId: 'mire_route', foeSpecies: 'pyrekit', foeName: null, move: 'Ember', orb: null };
  const n = { id: U1, name: 'Scarjaw', title: 'the Unbroken', speciesId: 'dustcub', level: 12, isShiny: false, scar: 'burn', move: 'Dig', rank: 1, bornZone: 'mire_route', lastZone: 'mire_route', lastSeenAt: ISO, memory };
  it('the active nemeses: a scar of the list, a rank of 1 to 5, a name that fits a nickname', () => {
    ok(NemesesRes, { nemeses: [n], max: 3 });
    ok(NemesesRes, { nemeses: [], max: 3 });
    ok(NemesesRes, { nemeses: [{ ...n, move: null, memory: { ...memory, how: 'breakout', move: null, orb: 'great_orb' } }], max: 3 });
    bad(NemesesRes, { nemeses: [{ ...n, scar: 'tattoo' }], max: 3 });
    bad(NemesesRes, { nemeses: [{ ...n, rank: 6 }], max: 3 });
    bad(NemesesRes, { nemeses: [{ ...n, name: 'A name much too long' }], max: 3 });
  });
});

describe('ecosystem', () => {
  const sp = { speciesId: 'pebblit', factor: 0.62, cause: 'hunted', caught: 30, ko: 10, preyOn: [], huntedBy: ['pebfist', 'yahit'] };
  const view = {
    zoneId: 'deepcut_route', enabled: true, season: 1, week: 3, endsAt: ISO, takes: 40, judged: true,
    surging: [{ ...sp, speciesId: 'yahit', factor: 1.6, cause: 'feeding', caught: 0, ko: 0, preyOn: ['pebblit'], huntedBy: [] }],
    scarce: [sp], tilted: [], migrantsIn: [{ speciesId: 'tidespine', from: 'tide_route' }], migrantsOut: [{ speciesId: 'wooltug', to: 'umbral_observatory' }],
    shadow: 0, light: 2,
  };
  it('this week on a zone: a known zone, a week of 1 to 4, causes of the list, levels of 0 to 4', () => {
    ok(EcosystemRes, view);
    ok(EcosystemRes, { ...view, enabled: false, takes: 0, judged: false, surging: [], scarce: [], migrantsIn: [], migrantsOut: [] });
    bad(EcosystemRes, { ...view, zoneId: 'atlantis' });
    bad(EcosystemRes, { ...view, week: 5 });
    bad(EcosystemRes, { ...view, scarce: [{ ...sp, cause: 'bored' }] });
    bad(EcosystemRes, { ...view, light: 5 });
  });
});

describe('bounty board', () => {
  const poster = {
    id: 'b1', kind: 'game', target: 'kestrel', speciesId: 'badlander', level: 34, zoneId: 'deepcut_route', wins: 40, rank: null,
    reward: 5000, withLawlander: 6250, postedBy: null, postedAt: ISO, expiresAt: ISO, mine: false,
  };
  const view = {
    enabled: true, nextPostingAt: ISO,
    wanted: [poster, { ...poster, id: 'b2', kind: 'player', reward: 800, withLawlander: 1000, postedBy: 'outlaw', wins: 2 }],
    personal: [{ ...poster, id: 'n1', kind: 'nemesis', target: 'Murkjaw the Drowned', wins: null, rank: 3, reward: 1200, withLawlander: 1500, expiresAt: null }],
    posted: [{ id: 'b3', target: 'kestrel', reward: 800, fee: 200, status: 'expired', claimedBy: null, postedAt: ISO, expiresAt: ISO }],
    claims: [{ kind: 'player', target: 'kestrel', claimedBy: 'marshal', payout: 1000, bonus: true, zoneId: 'deepcut_route', at: ISO }],
    ghosts: [{ name: 'kestrel', zoneId: 'deepcut_route', speciesId: 'badlander', level: 34, wins: 40, wanted: true }],
    you: { badlander: true, lawlander: false, open: 1, claimsToday: 0, atBoard: true },
    money: 1200,
  };
  it("posters of three kinds, the caller's posts and claims; a post names a ghost and a whole reward", () => {
    ok(BountiesRes, view);
    ok(BountiesRes, { ...view, enabled: false, wanted: [], personal: [], posted: [], claims: [], ghosts: [] });
    bad(BountiesRes, { ...view, wanted: [{ ...poster, kind: 'bribe' }] });
    bad(BountiesRes, { ...view, posted: [{ ...view.posted[0], status: 'lost' }] });
    bad(BountiesRes, { ...view, personal: [{ ...view.personal[0], rank: 6 }] });
    bad(BountiesRes, { ...view, money: -1 });
    ok(BountyPostReq, { target: 'kestrel', reward: 800 });
    bad(BountyPostReq, { target: '', reward: 800 });
    bad(BountyPostReq, { target: 'kestrel', reward: 80.5 });
  });
});

describe('camp bases', () => {
  const camp = {
    zoneId: 'mire_route', owner: 'bh_outlaw', name: 'Ironhold', claimedAt: ISO, mine: false, ownerOnline: false, ownerInRun: false, inactive: false, raidedToday: false, cut: 120,
    trophies: [{ id: 'medal:champion', kind: 'medal', label: "Champion's medal" }, { id: 'legend:solaris', kind: 'legend', label: 'Solaris caught' }],
    guard: [{ speciesId: 'dustcub', level: 30, isShiny: false }],
  };
  const view = {
    enabled: true,
    here: { zoneId: 'mire_route', camp },
    mine: { ...camp, zoneId: 'ash_route', owner: 'me', mine: true, cut: 0 },
    earned: camp.trophies,
    log: [{ zoneId: 'ash_route', raider: 'bh_outlaw', won: true, cut: 120, tookOver: false, line: 'bh_outlaw raided your camp and took 120.', at: ISO }],
    camps: [{ zoneId: 'mire_route', owner: 'bh_outlaw', name: 'Ironhold' }],
    you: { inRun: false, money: 5000 },
  };
  it('the camp here, your camp, the trophies you earned and the log; edits name a banner or trophies', () => {
    ok(CampsRes, view);
    ok(CampsRes, { ...view, enabled: false, here: null, mine: null, earned: [], log: [], camps: [] });
    ok(CampsRes, { ...view, here: { zoneId: 'mire_route', camp: null } });
    bad(CampsRes, { ...view, here: { zoneId: 'mire_route', camp: { ...camp, trophies: [...camp.trophies, ...camp.trophies] } } });
    bad(CampsRes, { ...view, earned: [{ id: 'x:y', kind: 'crown', label: 'Crown' }] });
    bad(CampsRes, { ...view, mine: { ...camp, name: '' } });
    ok(CampEditReq, { name: 'Ironhold' });
    ok(CampEditReq, { trophies: ['medal:champion'] });
    ok(CampEditReq, { name: 'Ironhold', trophies: [] });
    bad(CampEditReq, {});
    bad(CampEditReq, { name: 'x'.repeat(25) });
    bad(CampEditReq, { trophies: ['a:b', 'a:c', 'a:d', 'a:e'] });
  });
});
