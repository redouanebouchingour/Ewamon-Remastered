import { and, asc, desc, eq, ilike, isNull, lt, or, sql } from 'drizzle-orm';
import { GUILD_CREATE_COST, GUILD_MAX_MEMBERS } from '../constants';
import type { Tx } from '../db';
import { fail } from '../errors';
import { friendships, guildMembers, guilds, messages, playerBlocks, players } from '../schema/index';
import type { FriendshipRow, GuildRow } from '../schema/index';
import type { FriendView, GuildMemberView, GuildView, MessageView } from '../types';
import { clampInt, escapeLike } from '../util';
import { auditRepo } from './audit';
import { playerRepo } from './players';

/** `conversations` reads at most this many of the newest messages to find the threads */
const CONVERSATION_SCAN = 2000;

export interface FriendLists {
  readonly friends: FriendView[];
  readonly incoming: FriendView[];
  readonly outgoing: FriendView[];
}

/** The friendship row between two players, whichever direction it was requested in. */
async function pairRow(tx: Tx, a: string, b: string, lock: boolean): Promise<FriendshipRow | null> {
  const q = tx
    .select()
    .from(friendships)
    .where(or(and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)), and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a))))
    .limit(1);
  const [row] = lock ? await q.for('update') : await q;
  return row ?? null;
}

function guildView(g: GuildRow, memberCount: number): GuildView {
  return { id: g.id, name: g.name, tag: g.tag, leaderId: g.leaderId, motd: g.motd, memberCount, createdAt: g.createdAt };
}

async function memberCount(tx: Tx, guildId: string): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(guildMembers)
    .where(eq(guildMembers.guildId, guildId));
  return Number(r?.n ?? 0);
}

async function lockGuild(tx: Tx, guildId: string): Promise<GuildRow> {
  const [g] = await tx.select().from(guilds).where(eq(guilds.id, guildId)).for('update');
  if (!g) fail('NotFound', `guild ${guildId}`);
  return g;
}

export const socialRepo = {
  // ---- friendships -------------------------------------------------------------------------
  /**
   * Sends a request. The unordered pair is unique (friendships_pair_uq): if the addressee already
   * asked us, the pending row is accepted instead. Throws AlreadyFriends when already accepted.
   */
  async requestFriend(tx: Tx, requesterId: string, addresseeId: string, now: Date): Promise<'requested' | 'accepted'> {
    if (requesterId === addresseeId) fail('InvalidArgument', 'cannot befriend yourself');
    await playerRepo.lockMany(tx, [requesterId, addresseeId]);
    const existing = await pairRow(tx, requesterId, addresseeId, true);
    if (existing) {
      if (existing.status === 'accepted') fail('AlreadyFriends');
      if (existing.requesterId === requesterId) return 'requested'; // already pending from us: idempotent
      await tx
        .update(friendships)
        .set({ status: 'accepted' })
        .where(and(eq(friendships.requesterId, existing.requesterId), eq(friendships.addresseeId, existing.addresseeId)));
      return 'accepted';
    }
    await tx.insert(friendships).values({ requesterId, addresseeId, status: 'pending', createdAt: now });
    return 'requested';
  },

  /** `addresseeId` accepts the pending request from `requesterId`. */
  async acceptFriend(tx: Tx, addresseeId: string, requesterId: string): Promise<void> {
    const res = await tx
      .update(friendships)
      .set({ status: 'accepted' })
      .where(and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, addresseeId), eq(friendships.status, 'pending')))
      .returning({ r: friendships.requesterId });
    if (res.length === 0) fail('NotFound', 'no pending request');
  },

  /** Declines an incoming request (or withdraws an outgoing one). */
  async declineFriend(tx: Tx, playerId: string, otherId: string): Promise<void> {
    const res = await tx
      .delete(friendships)
      .where(
        and(
          eq(friendships.status, 'pending'),
          or(and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, playerId)), and(eq(friendships.requesterId, playerId), eq(friendships.addresseeId, otherId))),
        ),
      )
      .returning({ r: friendships.requesterId });
    if (res.length === 0) fail('NotFound', 'no pending request');
  },

  /** Removes an accepted friendship in either direction. */
  async removeFriend(tx: Tx, playerId: string, otherId: string): Promise<void> {
    const res = await tx
      .delete(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, playerId)), and(eq(friendships.requesterId, playerId), eq(friendships.addresseeId, otherId))),
        ),
      )
      .returning({ r: friendships.requesterId });
    if (res.length === 0) fail('NotFound', 'not friends');
  },

  async areFriends(tx: Tx, a: string, b: string): Promise<boolean> {
    const row = await pairRow(tx, a, b, false);
    return row?.status === 'accepted';
  },

  async friendLists(tx: Tx, playerId: string): Promise<FriendLists> {
    const rows = await tx
      .select({
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        status: friendships.status,
        createdAt: friendships.createdAt,
        otherId: players.id,
        otherName: players.username,
      })
      .from(friendships)
      .innerJoin(players, sql`${players.id} = case when ${friendships.requesterId} = ${playerId} then ${friendships.addresseeId} else ${friendships.requesterId} end`)
      .where(or(eq(friendships.requesterId, playerId), eq(friendships.addresseeId, playerId)))
      .orderBy(asc(players.usernameLower));
    const out: { friends: FriendView[]; incoming: FriendView[]; outgoing: FriendView[] } = { friends: [], incoming: [], outgoing: [] };
    for (const r of rows) {
      const view: FriendView = { id: r.otherId, username: r.otherName, since: r.createdAt };
      if (r.status === 'accepted') out.friends.push(view);
      else if (r.addresseeId === playerId) out.incoming.push(view);
      else out.outgoing.push(view);
    }
    return out;
  },

  // ---- messages -------------------------------------------------------------------------------
  async sendMessage(tx: Tx, fromId: string, toId: string, text: string, now: Date): Promise<MessageView> {
    if (fromId === toId) fail('InvalidArgument', 'cannot message yourself');
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 300) fail('InvalidArgument', 'text must be 1..300 chars');
    const [row] = await tx.insert(messages).values({ fromId, toId, text: trimmed, sentAt: now }).returning();
    return row!;
  },

  /** Newest first, optionally before a timestamp; limit clamped to 1..50. */
  async thread(tx: Tx, a: string, b: string, before: Date | null, limit: number): Promise<MessageView[]> {
    const pair = or(and(eq(messages.fromId, a), eq(messages.toId, b)), and(eq(messages.fromId, b), eq(messages.toId, a)));
    return tx
      .select()
      .from(messages)
      .where(before ? and(pair, lt(messages.sentAt, before)) : pair)
      .orderBy(desc(messages.sentAt), desc(messages.id))
      .limit(clampInt(limit, 1, 50));
  },

  /** Marks every unread message from `fromId` to `readerId` as read. Returns the count. */
  async markRead(tx: Tx, readerId: string, fromId: string, now: Date): Promise<number> {
    const res = await tx
      .update(messages)
      .set({ readAt: now })
      .where(and(eq(messages.toId, readerId), eq(messages.fromId, fromId), isNull(messages.readAt)))
      .returning({ id: messages.id });
    return res.length;
  },

  async unreadCounts(tx: Tx, playerId: string): Promise<Record<string, number>> {
    const rows = await tx
      .select({ fromId: messages.fromId, n: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.toId, playerId), isNull(messages.readAt)))
      .groupBy(messages.fromId);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.fromId] = Number(r.n);
    return out;
  },

  /**
   * Talking to other players: the player's threads, newest first, one per other player (friends or not): the last
   * message, whether the player sent it, and the unread count from them. At most `limit` (1..50).
   */
  async conversations(
    tx: Tx,
    playerId: string,
    limit: number,
  ): Promise<{ otherId: string; username: string; lastText: string; lastAt: Date; fromMe: boolean; unread: number }[]> {
    // the newest messages either way, one per other player (DISTINCT ON cannot take the player id as two parameters)
    const rows = await tx
      .select({ fromId: messages.fromId, toId: messages.toId, text: messages.text, sentAt: messages.sentAt })
      .from(messages)
      .where(or(eq(messages.fromId, playerId), eq(messages.toId, playerId)))
      .orderBy(desc(messages.sentAt), desc(messages.id))
      .limit(CONVERSATION_SCAN);
    const last: { otherId: string; text: string; sentAt: Date; fromId: string }[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const otherId = r.fromId === playerId ? r.toId : r.fromId;
      if (seen.has(otherId)) continue;
      seen.add(otherId);
      last.push({ otherId, text: r.text, sentAt: r.sentAt, fromId: r.fromId });
    }
    const top = last.slice(0, clampInt(limit, 1, 50));
    const names = new Map((await playerRepo.byIds(tx, top.map((r) => r.otherId))).map((p) => [p.id, p.username]));
    const unread = await this.unreadCounts(tx, playerId);
    return top.flatMap((r) => {
      const username = names.get(r.otherId);
      return username === undefined ? [] : [{ otherId: r.otherId, username, lastText: r.text, lastAt: r.sentAt, fromMe: r.fromId === playerId, unread: unread[r.otherId] ?? 0 }];
    });
  },

  // ---- blocks (talking to other players, migration 0026) -------------------------------------
  /** `blockerId` blocks `blockedId` (idempotent); a friendship or pending request between them ends. */
  async block(tx: Tx, blockerId: string, blockedId: string, now: Date): Promise<void> {
    if (blockerId === blockedId) fail('InvalidArgument', 'cannot block yourself');
    await tx.insert(playerBlocks).values({ blockerId, blockedId, createdAt: now }).onConflictDoNothing();
    await tx
      .delete(friendships)
      .where(or(and(eq(friendships.requesterId, blockerId), eq(friendships.addresseeId, blockedId)), and(eq(friendships.requesterId, blockedId), eq(friendships.addresseeId, blockerId))));
  },

  async unblock(tx: Tx, blockerId: string, blockedId: string): Promise<void> {
    await tx.delete(playerBlocks).where(and(eq(playerBlocks.blockerId, blockerId), eq(playerBlocks.blockedId, blockedId)));
  },

  /** Whom the player blocked, by username. */
  async blockList(tx: Tx, blockerId: string): Promise<{ id: string; username: string; blockedAt: Date }[]> {
    return tx
      .select({ id: players.id, username: players.username, blockedAt: playerBlocks.createdAt })
      .from(playerBlocks)
      .innerJoin(players, eq(players.id, playerBlocks.blockedId))
      .where(eq(playerBlocks.blockerId, blockerId))
      .orderBy(asc(players.usernameLower));
  },

  /** Whether `blockerId` blocked `blockedId` (one direction). */
  async hasBlocked(tx: Tx, blockerId: string, blockedId: string): Promise<boolean> {
    const [r] = await tx
      .select({ b: playerBlocks.blockerId })
      .from(playerBlocks)
      .where(and(eq(playerBlocks.blockerId, blockerId), eq(playerBlocks.blockedId, blockedId)))
      .limit(1);
    return r !== undefined;
  },

  /** Whether either player blocked the other. */
  async blockedEither(tx: Tx, a: string, b: string): Promise<boolean> {
    const [r] = await tx
      .select({ b: playerBlocks.blockerId })
      .from(playerBlocks)
      .where(or(and(eq(playerBlocks.blockerId, a), eq(playerBlocks.blockedId, b)), and(eq(playerBlocks.blockerId, b), eq(playerBlocks.blockedId, a))))
      .limit(1);
    return r !== undefined;
  },

  /** Every player id `playerId` blocked or was blocked by (the zone room's challenge / trade / chat guard). */
  async blockPeers(tx: Tx, playerId: string): Promise<string[]> {
    const rows = await tx
      .select({ blockerId: playerBlocks.blockerId, blockedId: playerBlocks.blockedId })
      .from(playerBlocks)
      .where(or(eq(playerBlocks.blockerId, playerId), eq(playerBlocks.blockedId, playerId)));
    return [...new Set(rows.map((r) => (r.blockerId === playerId ? r.blockedId : r.blockerId)))];
  },

  /** Who may DM the player ('everyone' | 'friends'). */
  async setDmsFrom(tx: Tx, playerId: string, dmsFrom: 'everyone' | 'friends'): Promise<void> {
    await tx.update(players).set({ dmsFrom }).where(eq(players.id, playerId));
  },

  // ---- guilds ----------------------------------------------------------------------------------
  /** Creates a guild, charging `cost` from the leader in the same transaction. Throws AlreadyInGuild | GuildNameTaken | InsufficientFunds. */
  async createGuild(tx: Tx, p: { leaderId: string; name: string; tag: string; cost?: number }, now: Date): Promise<GuildView> {
    const name = p.name.trim();
    const tag = p.tag.trim().toUpperCase();
    if (name.length < 3 || name.length > 24) fail('InvalidArgument', 'name must be 3..24 chars');
    if (!/^[A-Z0-9]{2,4}$/.test(tag)) fail('InvalidArgument', 'tag must match /^[A-Z0-9]{2,4}$/');
    await playerRepo.lock(tx, p.leaderId);
    const [member] = await tx.select({ guildId: guildMembers.guildId }).from(guildMembers).where(eq(guildMembers.playerId, p.leaderId)).limit(1);
    if (member) fail('AlreadyInGuild');
    const nameLower = name.toLowerCase();
    const [taken] = await tx
      .select({ id: guilds.id })
      .from(guilds)
      .where(or(eq(guilds.nameLower, nameLower), eq(guilds.tag, tag)))
      .limit(1);
    if (taken) fail('GuildNameTaken');
    await playerRepo.addMoney(tx, p.leaderId, -(p.cost ?? GUILD_CREATE_COST));
    const [g] = await tx.insert(guilds).values({ name, nameLower, tag, leaderId: p.leaderId, createdAt: now }).returning();
    await tx.insert(guildMembers).values({ guildId: g!.id, playerId: p.leaderId, role: 'leader', joinedAt: now });
    await auditRepo.write(tx, { actorId: p.leaderId, action: 'guild.create', subject: g!.id, detail: { name, tag, cost: p.cost ?? GUILD_CREATE_COST } }, now);
    return guildView(g!, 1);
  },

  /** Joins under a lock on the guild row; the 50-member limit holds at commit. */
  async joinGuild(tx: Tx, guildId: string, playerId: string, now: Date): Promise<GuildView> {
    const g = await lockGuild(tx, guildId);
    const [member] = await tx.select({ guildId: guildMembers.guildId }).from(guildMembers).where(eq(guildMembers.playerId, playerId)).limit(1);
    if (member) fail('AlreadyInGuild');
    const n = await memberCount(tx, guildId);
    if (n >= GUILD_MAX_MEMBERS) fail('GuildFull');
    await tx.insert(guildMembers).values({ guildId, playerId, role: 'member', joinedAt: now });
    return guildView(g, n + 1);
  },

  /** Leaves. The leader may only leave when alone (the guild is then deleted); otherwise promote first. */
  async leaveGuild(tx: Tx, guildId: string, playerId: string): Promise<void> {
    const g = await lockGuild(tx, guildId);
    const [m] = await tx
      .select()
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, playerId)))
      .limit(1);
    if (!m) fail('NotGuildMember');
    if (g.leaderId === playerId) {
      if ((await memberCount(tx, guildId)) > 1) fail('Forbidden', 'promote a new leader before leaving');
      await tx.delete(guilds).where(eq(guilds.id, guildId)); // cascades the membership row
      return;
    }
    await tx.delete(guildMembers).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, playerId)));
  },

  /** Leader or officer removes a member (officers cannot kick officers/leader). */
  async kickMember(tx: Tx, guildId: string, actorId: string, targetId: string): Promise<void> {
    await lockGuild(tx, guildId);
    const rows = await tx
      .select()
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), or(eq(guildMembers.playerId, actorId), eq(guildMembers.playerId, targetId))));
    const actor = rows.find((r) => r.playerId === actorId);
    const target = rows.find((r) => r.playerId === targetId);
    if (!actor) fail('NotGuildMember');
    if (!target) fail('NotFound', 'target is not a member');
    if (actorId === targetId) fail('InvalidArgument', 'use leaveGuild');
    const allowed = actor.role === 'leader' || (actor.role === 'officer' && target.role === 'member');
    if (!allowed) fail('Forbidden');
    await tx.delete(guildMembers).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, targetId)));
  },

  /** Leader-only. 'leader' hands over leadership (the old leader becomes officer). */
  async setRole(tx: Tx, guildId: string, actorId: string, targetId: string, role: 'leader' | 'officer' | 'member'): Promise<void> {
    const g = await lockGuild(tx, guildId);
    if (g.leaderId !== actorId) fail('Forbidden', 'leader only');
    if (actorId === targetId) fail('InvalidArgument');
    const [target] = await tx
      .select()
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, targetId)))
      .limit(1);
    if (!target) fail('NotGuildMember');
    if (role === 'leader') {
      await tx.update(guilds).set({ leaderId: targetId }).where(eq(guilds.id, guildId));
      await tx.update(guildMembers).set({ role: 'officer' }).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, actorId)));
    }
    await tx.update(guildMembers).set({ role }).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, targetId)));
  },

  async setMotd(tx: Tx, guildId: string, actorId: string, motd: string): Promise<void> {
    const g = await lockGuild(tx, guildId);
    if (g.leaderId !== actorId) fail('Forbidden', 'leader only');
    await tx.update(guilds).set({ motd: motd.slice(0, 200) }).where(eq(guilds.id, guildId));
  },

  async guildById(tx: Tx, guildId: string): Promise<GuildView | null> {
    const [g] = await tx.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);
    return g ? guildView(g, await memberCount(tx, guildId)) : null;
  },

  async guildOf(tx: Tx, playerId: string): Promise<GuildView | null> {
    const [m] = await tx.select({ guildId: guildMembers.guildId }).from(guildMembers).where(eq(guildMembers.playerId, playerId)).limit(1);
    return m ? socialRepo.guildById(tx, m.guildId) : null;
  },

  async guildMembers(tx: Tx, guildId: string): Promise<GuildMemberView[]> {
    return tx
      .select({ playerId: guildMembers.playerId, username: players.username, role: guildMembers.role, joinedAt: guildMembers.joinedAt })
      .from(guildMembers)
      .innerJoin(players, eq(players.id, guildMembers.playerId))
      .where(eq(guildMembers.guildId, guildId))
      .orderBy(asc(guildMembers.joinedAt));
  },

  /** Name search; every LIKE goes through escapeLike. */
  async searchGuilds(tx: Tx, search: string, limit: number): Promise<GuildView[]> {
    const q = search.trim();
    const rows = await tx
      .select({ g: guilds, n: sql<number>`(select count(*)::int from ${guildMembers} where ${guildMembers.guildId} = ${guilds.id})` })
      .from(guilds)
      .where(q ? ilike(guilds.name, `%${escapeLike(q)}%`) : undefined)
      .orderBy(asc(guilds.nameLower))
      .limit(clampInt(limit, 1, 50));
    return rows.map((r) => guildView(r.g, Number(r.n)));
  },
};

export type SocialRepo = typeof socialRepo;
