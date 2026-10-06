/**
 * §4.7 / 50.4.3 rest.test.ts — every request/response schema accepts its documented example and
 * rejects the listed boundary cases; the route table is well-formed.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
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
  RegisterReq,
  ResetReq,
  RestErrorSchema,
  SendMessageReq,
  SetupReq,
  ShopTradeReq,
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
    expect(ROUTE_KEYS).toHaveLength(65); // 60 of §4.7 + the four Phase C6 email routes + Phase D2 POST /creature/:id/tutor
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
