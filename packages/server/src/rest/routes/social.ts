/**
 * §4.7 social rows + §30.7: friends (FriendView online/zoneId/inBattle from presence, never the DB), persisted DMs
 * (pushed live as the spine's `dm` variant through `ewa:dm:<toId>`), guilds (5 000 to found, open join, leader must
 * promote before leaving, kick/promote rules, `ewa:profile` so the room refreshes `PlayerState.guildTag`).
 *
 * Usernames in URLs/bodies are lowercased and matched by equality on username_lower (§30.6.6).
 */
import type { PlayerRow, Tx } from '@ewa/persist';
import { GUILD_CREATE_COST } from '@ewa/persist';
import {
  BlockListRes,
  ConversationsRes,
  FriendListsSchema,
  GuildCreateReq,
  GuildCreateRes,
  GuildDetailRes,
  GuildListRes,
  GuildMemberReq,
  GuildParams,
  GuildViewSchema,
  GuildsQuery,
  MessageViewSchema,
  MessagesQuery,
  MessagesRes,
  RelationRes,
  SendMessageReq,
  SocialPrefsSchema,
  UsernameParams,
  UsernameReq,
} from '@ewa/protocol';
import type { FriendView, GuildView, MessageView } from '@ewa/protocol';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { DM_MAX, containsBlocked, sanitizeChat } from '../../chat/filter';
import { BLOCKS_TOPIC } from '../blocksTopic';
import type { BlocksPush } from '../blocksTopic';
import { HttpError, inventoryDeltaBody, iso, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

/** Talking to other players: ≤ 200 blocked players each (409 blockLimit). */
export const BLOCK_LIMIT = 200;
const CONVERSATION_LIMIT = 50;

/**
 * Whether `from` may DM `to` now: neither blocked the other, and they are friends or `to` takes DMs from everyone.
 * A refusal reads the same (409 dmsClosed) whichever the reason, so nobody learns they were blocked.
 */
async function mayMessage(deps: RestDeps, tx: Tx, from: string, to: PlayerRow): Promise<boolean> {
  if (await deps.repos.social.blockedEither(tx, from, to.id)) return false;
  return to.dmsFrom === 'everyone' || (await deps.repos.social.areFriends(tx, from, to.id));
}

/** §30.7.1: ≤ 100 accepted friends per player (409 friendLimit). */
export const FRIEND_LIMIT = 100;
/** §30.6.6: `search` on /guilds is capped at 32 chars before escaping. */
export const SEARCH_CAP = 32;
const GUILD_LIST_LIMIT = 50;

type PersistGuild = { readonly id: string; readonly name: string; readonly tag: string; readonly leaderId: string; readonly motd: string; readonly memberCount: number; readonly createdAt: Date };
type PersistMessage = { readonly id: number; readonly fromId: string; readonly toId: string; readonly text: string; readonly sentAt: Date; readonly readAt: Date | null };

export function guildView(g: PersistGuild): GuildView {
  return { id: g.id, name: g.name, tag: g.tag, leaderId: g.leaderId, motd: g.motd, memberCount: g.memberCount, createdAt: iso(g.createdAt) };
}

export function messageView(m: PersistMessage): MessageView {
  return { id: m.id, fromId: m.fromId, toId: m.toId, text: m.text, sentAt: iso(m.sentAt), readAt: m.readAt === null ? null : iso(m.readAt) };
}

function usernameParam(req: FastifyRequest): string {
  return UsernameParams.parse({ username: String((req.params as { username?: unknown }).username ?? '').toLowerCase() }).username;
}

function usernameBody(req: FastifyRequest): string {
  const raw = (req.body ?? {}) as { username?: unknown };
  return UsernameReq.parse({ ...raw, username: typeof raw.username === 'string' ? raw.username.toLowerCase() : raw.username }).username;
}

export function registerSocialRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };
  const limited = (key: 'friendReq' | 'message' | 'guildOp') => ({ onRequest: requireAuth(deps), preHandler: rateLimit(deps, key) });

  /** An existing, unbanned player other than me (404 otherwise — a banned player is indistinguishable from none). */
  async function target(tx: Tx, username: string, me: string): Promise<PlayerRow> {
    const row = await repos.players.byUsername(tx, username);
    if (row === null || row.bannedAt !== null) throw new HttpError(404, 'NotFound');
    if (row.id === me) throw new HttpError(409, 'self');
    return row;
  }

  async function friendCount(tx: Tx, id: string): Promise<number> {
    return (await repos.social.friendLists(tx, id)).friends.length;
  }

  /** FriendLists with title/body/lastSeenAt from rows and online/zoneId/inBattle from presence (§30.7.1). */
  async function lists(me: string): Promise<{ friends: FriendView[]; incoming: FriendView[]; outgoing: FriendView[] }> {
    const { raw, rows } = await repos.db.transaction(async (tx) => {
      const raw = await repos.social.friendLists(tx, me);
      const ids = [...raw.friends, ...raw.incoming, ...raw.outgoing].map((f) => f.id);
      return { raw, rows: new Map((await repos.players.byIds(tx, ids)).map((r) => [r.id, r])) };
    });
    const view = async (f: { id: string; username: string }): Promise<FriendView> => {
      const row = rows.get(f.id);
      const p = await deps.presenceMirror.lookup(f.id);
      return {
        id: f.id,
        username: f.username,
        title: row?.title ?? '',
        body: row?.body ?? 'ranger_m',
        online: p !== null,
        zoneId: p?.zoneId ?? null,
        inBattle: p?.battleId != null,
        lastSeenAt: iso(row?.lastSeenAt ?? new Date(0)),
      };
    };
    return {
      friends: await Promise.all(raw.friends.map(view)),
      incoming: await Promise.all(raw.incoming.map(view)),
      outgoing: await Promise.all(raw.outgoing.map(view)),
    };
  }

  // ---- friends ---------------------------------------------------------------------------------------------

  app.get('/friends', bearer, async (req) => out(deps, FriendListsSchema, await lists(req.user.sub)));

  /** target exists, not self, not banned; ≤ 100 accepted each; a reverse pending request is accepted (persist). */
  app.post('/friends/request', limited('friendReq'), async (req) => {
    const username = usernameBody(req);
    const me = req.user.sub;
    const now = new Date(clock());
    await repos.db.transaction(async (tx) => {
      const other = await target(tx, username, me);
      // a block either way refuses the request with a code that does not say who blocked whom
      if (await repos.social.blockedEither(tx, me, other.id)) throw new HttpError(409, 'requestRefused');
      if ((await friendCount(tx, me)) >= FRIEND_LIMIT || (await friendCount(tx, other.id)) >= FRIEND_LIMIT) throw new HttpError(409, 'friendLimit');
      await repos.social.requestFriend(tx, me, other.id, now);
    });
    return out(deps, FriendListsSchema, await lists(me));
  });

  /** only the addressee of a pending row */
  app.post('/friends/accept', bearer, async (req) => {
    const username = usernameBody(req);
    const me = req.user.sub;
    await repos.db.transaction(async (tx) => {
      const other = await target(tx, username, me);
      if ((await friendCount(tx, me)) >= FRIEND_LIMIT || (await friendCount(tx, other.id)) >= FRIEND_LIMIT) throw new HttpError(409, 'friendLimit');
      await repos.social.acceptFriend(tx, me, other.id);
    });
    return out(deps, FriendListsSchema, await lists(me));
  });

  app.post('/friends/decline', bearer, async (req) => {
    const username = usernameBody(req);
    const me = req.user.sub;
    await repos.db.transaction(async (tx) => {
      const row = await repos.players.byUsername(tx, username);
      if (row === null) throw new HttpError(404, 'NotFound');
      await repos.social.declineFriend(tx, me, row.id);
    });
    return out(deps, FriendListsSchema, await lists(me));
  });

  app.post('/friends/remove', bearer, async (req) => {
    const username = usernameBody(req);
    const me = req.user.sub;
    await repos.db.transaction(async (tx) => {
      const row = await repos.players.byUsername(tx, username);
      if (row === null) throw new HttpError(404, 'NotFound');
      await repos.social.removeFriend(tx, me, row.id);
    });
    return out(deps, FriendListsSchema, await lists(me));
  });

  // ---- messages (§30.7.2) ----------------------------------------------------------------------------------

  /** Registered before `/messages/:username` (Fastify prefers the static segment anyway). */
  app.post('/messages/read', bearer, async (req, reply) => {
    const username = usernameBody(req);
    const me = req.user.sub;
    const now = new Date(clock());
    await repos.db.transaction(async (tx) => {
      const row = await repos.players.byUsername(tx, username);
      if (row === null) throw new HttpError(404, 'NotFound');
      await repos.social.markRead(tx, me, row.id, now);
    });
    return reply.status(204).send();
  });

  app.get('/messages/:username', bearer, async (req) => {
    const username = usernameParam(req);
    const q = MessagesQuery.parse(req.query);
    const me = req.user.sub;
    const rows = await repos.db.transaction(async (tx) => {
      const other = await repos.players.byUsername(tx, username);
      if (other === null) throw new HttpError(404, 'NotFound');
      return repos.social.thread(tx, me, other.id, q.before === undefined ? null : new Date(q.before), q.limit);
    });
    return out(deps, MessagesRes, { messages: rows.map(messageView) });
  });

  /**
   * Friends, or anyone when the recipient takes DMs from everyone (talking to other players); a block either way or a
   * friends-only recipient → 409 dmsClosed. sanitizeChat (300) + containsBlocked hard reject (400 blockedWord).
   */
  app.post('/messages/:username', limited('message'), async (req) => {
    const username = usernameParam(req);
    const body = SendMessageReq.parse(req.body);
    const me = req.user.sub;
    const text = sanitizeChat(body.text, DM_MAX);
    if (text === null) throw new HttpError(400, 'invalidPayload');
    if (containsBlocked(text)) throw new HttpError(400, 'blockedWord');
    const now = new Date(clock());
    const { msg, toId } = await repos.db.transaction(async (tx) => {
      const other = await target(tx, username, me);
      if (!(await mayMessage(deps, tx, me, other))) throw new HttpError(409, 'dmsClosed');
      return { msg: await repos.social.sendMessage(tx, me, other.id, text, now), toId: other.id };
    });
    // pushed live when the recipient is online (any process: the room holding them subscribed ewa:dm:<id>)
    if ((await deps.presenceMirror.lookup(toId)) !== null) {
      deps.bus.publish(`ewa:dm:${toId}`, { id: msg.id, fromId: me, fromName: req.user.usr, text: msg.text, sentAt: msg.sentAt.getTime() });
    }
    return out(deps, MessageViewSchema, messageView(msg));
  });

  /** Every thread of the caller, friends or not, newest first (the Social screen's Messages tab). */
  app.get('/conversations', bearer, async (req) => {
    const me = req.user.sub;
    const { rows, friends } = await repos.db.transaction(async (tx) => ({
      rows: await repos.social.conversations(tx, me, CONVERSATION_LIMIT),
      friends: new Set((await repos.social.friendLists(tx, me)).friends.map((f) => f.id)),
    }));
    return out(deps, ConversationsRes, {
      conversations: rows.map((r) => ({ username: r.username, lastText: r.lastText, lastAt: iso(r.lastAt), fromMe: r.fromMe, unread: r.unread, friend: friends.has(r.otherId) })),
    });
  });

  // ---- talking to other players: the DM preference, the player card's relation, blocks ----------------------------

  app.get('/social/prefs', bearer, async (req) => {
    const row = await repos.db.transaction((tx) => repos.players.byId(tx, req.user.sub));
    if (row === null) throw new HttpError(404, 'NotFound');
    return out(deps, SocialPrefsSchema, { dmsFrom: row.dmsFrom === 'friends' ? 'friends' : 'everyone' });
  });

  app.post('/social/prefs', bearer, async (req) => {
    const body = SocialPrefsSchema.parse(req.body);
    await repos.db.transaction((tx) => repos.social.setDmsFrom(tx, req.user.sub, body.dmsFrom));
    return out(deps, SocialPrefsSchema, body);
  });

  /** What the player card offers: friendship state, whether the caller blocked them, whether a DM would go through. */
  app.get('/social/relation/:username', bearer, async (req) => {
    const username = usernameParam(req);
    const me = req.user.sub;
    const r = await repos.db.transaction(async (tx) => {
      const other = await target(tx, username, me);
      const lists = await repos.social.friendLists(tx, me);
      const has = (l: readonly { readonly id: string }[]): boolean => l.some((f) => f.id === other.id);
      const friend = has(lists.friends) ? 'friends' : has(lists.outgoing) ? 'outgoing' : has(lists.incoming) ? 'incoming' : 'none';
      return { id: other.id, username: other.username, friend, blocked: await repos.social.hasBlocked(tx, me, other.id), canMessage: await mayMessage(deps, tx, me, other) } as const;
    });
    return out(deps, RelationRes, r);
  });

  async function blockList(me: string): Promise<{ blocked: { id: string; username: string; blockedAt: string }[] }> {
    const rows = await repos.db.transaction((tx) => repos.social.blockList(tx, me));
    return { blocked: rows.map((b) => ({ id: b.id, username: b.username, blockedAt: iso(b.blockedAt) })) };
  }

  app.get('/social/blocks', bearer, async (req) => out(deps, BlockListRes, await blockList(req.user.sub)));

  /** Blocks a player (a friendship or a pending request between them ends); the zone rooms hear it at once. */
  app.post('/social/block', limited('friendReq'), async (req) => {
    const username = usernameBody(req);
    const me = req.user.sub;
    const now = new Date(clock());
    const otherId = await repos.db.transaction(async (tx) => {
      const other = await target(tx, username, me);
      if ((await repos.social.blockList(tx, me)).length >= BLOCK_LIMIT) throw new HttpError(409, 'blockLimit');
      await repos.social.block(tx, me, other.id, now);
      await repos.audit.write(tx, { actorId: me, action: 'social.block', subject: other.id, detail: {} }, now);
      return other.id;
    });
    deps.bus.publish(BLOCKS_TOPIC, { blockerId: me, blockedId: otherId, on: true } satisfies BlocksPush);
    return out(deps, BlockListRes, await blockList(me));
  });

  app.post('/social/unblock', bearer, async (req) => {
    const username = usernameBody(req);
    const me = req.user.sub;
    const otherId = await repos.db.transaction(async (tx) => {
      const other = await repos.players.byUsername(tx, username);
      if (other === null) throw new HttpError(404, 'NotFound');
      await repos.social.unblock(tx, me, other.id);
      return other.id;
    });
    deps.bus.publish(BLOCKS_TOPIC, { blockerId: me, blockedId: otherId, on: false } satisfies BlocksPush);
    return out(deps, BlockListRes, await blockList(me));
  });

  // ---- guilds (§30.7.3) ------------------------------------------------------------------------------------

  app.get('/guilds', bearer, async (req) => {
    const q = GuildsQuery.parse(req.query);
    const rows = await repos.db.transaction((tx) => repos.social.searchGuilds(tx, (q.search ?? '').slice(0, SEARCH_CAP), GUILD_LIST_LIMIT));
    return out(deps, GuildListRes, rows.map(guildView));
  });

  app.get('/guilds/:id', bearer, async (req) => {
    const { id } = GuildParams.parse(req.params);
    const r = await repos.db.transaction(async (tx) => {
      const g = await repos.social.guildById(tx, id);
      return g === null ? null : { g, members: await repos.social.guildMembers(tx, id) };
    });
    if (r === null) throw new HttpError(404, 'NotFound');
    return out(deps, GuildDetailRes, { ...guildView(r.g), members: r.members.map((m) => ({ playerId: m.playerId, username: m.username, role: m.role, joinedAt: iso(m.joinedAt) })) });
  });

  /** 5 000 in the same tx (409 InsufficientFunds); name/tag unique (409 GuildNameTaken); one guild per player. */
  app.post('/guilds', limited('guildOp'), async (req) => {
    const body = GuildCreateReq.parse(req.body);
    const me = req.user.sub;
    const now = new Date(clock());
    const { g, money } = await repos.db.transaction(async (tx) => {
      const g = await repos.social.createGuild(tx, { leaderId: me, name: body.name, tag: body.tag, cost: GUILD_CREATE_COST }, now);
      return { g, money: (await repos.players.byId(tx, me))!.money };
    });
    deps.bus.publish('ewa:profile', { playerId: me });
    return out(deps, GuildCreateRes, { ...guildView(g), inventoryDelta: inventoryDeltaBody({ money }) });
  });

  /** open join in v1; 409 GuildFull at 50 / AlreadyInGuild */
  app.post('/guilds/:id/join', limited('guildOp'), async (req) => {
    const { id } = GuildParams.parse(req.params);
    GuildMemberReq.parse(req.body ?? {});
    const me = req.user.sub;
    const g = await repos.db.transaction((tx) => repos.social.joinGuild(tx, id, me, new Date(clock())));
    deps.bus.publish('ewa:profile', { playerId: me });
    return out(deps, GuildViewSchema, guildView(g));
  });

  /** a leader with other members must promote first (409 leaderMustPromote); the last member's leave deletes the guild */
  app.post('/guilds/:id/leave', limited('guildOp'), async (req) => {
    const { id } = GuildParams.parse(req.params);
    GuildMemberReq.parse(req.body ?? {});
    const me = req.user.sub;
    const view = await repos.db.transaction(async (tx) => {
      const g = await repos.social.guildById(tx, id);
      if (g === null) throw new HttpError(404, 'NotFound');
      if (g.leaderId === me && g.memberCount > 1) throw new HttpError(409, 'leaderMustPromote');
      await repos.social.leaveGuild(tx, id, me);
      return (await repos.social.guildById(tx, id)) ?? { ...g, memberCount: 0 };
    });
    deps.bus.publish('ewa:profile', { playerId: me });
    return out(deps, GuildViewSchema, guildView(view));
  });

  /** leader kicks anyone but themselves; officer kicks members (persist enforces, 403 Forbidden otherwise) */
  app.post('/guilds/:id/kick', limited('guildOp'), async (req) => {
    const { id } = GuildParams.parse(req.params);
    const body = GuildMemberReq.parse(req.body ?? {});
    if (body.playerId === undefined) throw new HttpError(400, 'invalidPayload');
    const targetId = body.playerId;
    const me = req.user.sub;
    const view = await repos.db.transaction(async (tx) => {
      await repos.social.kickMember(tx, id, me, targetId);
      return repos.social.guildById(tx, id);
    });
    deps.bus.publish('ewa:profile', { playerId: targetId });
    if (view === null) throw new HttpError(404, 'NotFound');
    return out(deps, GuildViewSchema, guildView(view));
  });

  /** leader only: member → officer; officer → leader (the caller becomes officer) */
  app.post('/guilds/:id/promote', limited('guildOp'), async (req) => {
    const { id } = GuildParams.parse(req.params);
    const body = GuildMemberReq.parse(req.body ?? {});
    if (body.playerId === undefined) throw new HttpError(400, 'invalidPayload');
    const targetId = body.playerId;
    const me = req.user.sub;
    const view = await repos.db.transaction(async (tx) => {
      const members = await repos.social.guildMembers(tx, id);
      const t = members.find((m) => m.playerId === targetId);
      if (t === undefined) throw new HttpError(404, 'NotFound');
      if (t.role === 'leader') throw new HttpError(409, 'alreadyLeader');
      await repos.social.setRole(tx, id, me, targetId, t.role === 'member' ? 'officer' : 'leader');
      return repos.social.guildById(tx, id);
    });
    if (view === null) throw new HttpError(404, 'NotFound');
    return out(deps, GuildViewSchema, guildView(view));
  });
}
