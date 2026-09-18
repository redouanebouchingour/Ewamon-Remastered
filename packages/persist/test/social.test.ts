import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GUILD_CREATE_COST, GUILD_MAX_MEMBERS } from '../src/constants';
import type { AnyDb } from '../src/db';
import { socialRepo } from '../src/repos/social';
import { friendships } from '../src/schema/index';
import { T0, at, expectDbError, expectPersistError, mkPlayer, money, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('guilds — member cap under the guild row lock', () => {
  it(`enforces the ${GUILD_MAX_MEMBERS}-member cap, one guild per player, and charges the founder`, async () => {
    const { guildId, leader, members } = await db.transaction(async (tx) => {
      const leader = await mkPlayer(tx, undefined, 10_000);
      const g = await socialRepo.createGuild(tx, { leaderId: leader, name: 'Mire Wardens', tag: 'mw' }, T0);
      expect(g).toMatchObject({ name: 'Mire Wardens', tag: 'MW', leaderId: leader, memberCount: 1 });
      expect(await money(tx, leader)).toBe(10_000 - GUILD_CREATE_COST);
      const members: string[] = [];
      for (let i = 1; i < GUILD_MAX_MEMBERS; i++) {
        const p = await mkPlayer(tx);
        const view = await socialRepo.joinGuild(tx, g.id, p, at(i));
        expect(view.memberCount).toBe(i + 1);
        members.push(p);
      }
      return { guildId: g.id, leader, members };
    });
    await db.transaction(async (tx) => {
      expect((await socialRepo.guildById(tx, guildId))!.memberCount).toBe(GUILD_MAX_MEMBERS);
      const late = await mkPlayer(tx);
      await expectPersistError('GuildFull', () => socialRepo.joinGuild(tx, guildId, late, T0));
      expect((await socialRepo.guildById(tx, guildId))!.memberCount).toBe(GUILD_MAX_MEMBERS);
      await expectPersistError('AlreadyInGuild', () => socialRepo.joinGuild(tx, guildId, members[0]!, T0));
      // a member leaving frees one seat
      await socialRepo.leaveGuild(tx, guildId, members[0]!);
      expect((await socialRepo.joinGuild(tx, guildId, late, T0)).memberCount).toBe(GUILD_MAX_MEMBERS);
      expect((await socialRepo.guildMembers(tx, guildId)).length).toBe(GUILD_MAX_MEMBERS);
      expect((await socialRepo.guildOf(tx, late))!.id).toBe(guildId);
      expect(await socialRepo.guildOf(tx, members[0]!)).toBeNull();
      // the leader cannot walk out on a populated guild; a second guild for a member is refused
      await expectPersistError('Forbidden', () => socialRepo.leaveGuild(tx, guildId, leader));
      await expectPersistError('AlreadyInGuild', () => socialRepo.createGuild(tx, { leaderId: members[1]!, name: 'Other', tag: 'OT', cost: 0 }, T0));
    });
  });

  it('guild names/tags are unique case-insensitively and validated; search escapes LIKE', async () => {
    await db.transaction(async (tx) => {
      const a = await mkPlayer(tx, undefined, 20_000);
      const b = await mkPlayer(tx, undefined, 20_000);
      await socialRepo.createGuild(tx, { leaderId: a, name: 'Salt Tide', tag: 'ST' }, T0);
      await expectPersistError('GuildNameTaken', () => socialRepo.createGuild(tx, { leaderId: b, name: 'salt tide', tag: 'XX' }, T0));
      await expectPersistError('GuildNameTaken', () => socialRepo.createGuild(tx, { leaderId: b, name: 'Another', tag: 'st' }, T0));
      await expectPersistError('InvalidArgument', () => socialRepo.createGuild(tx, { leaderId: b, name: 'ab', tag: 'AB' }, T0));
      await expectPersistError('InvalidArgument', () => socialRepo.createGuild(tx, { leaderId: b, name: 'Fine Name', tag: 'toolong' }, T0));
      const poor = await mkPlayer(tx, undefined, GUILD_CREATE_COST - 1);
      await expectPersistError('InsufficientFunds', () => socialRepo.createGuild(tx, { leaderId: poor, name: 'Broke', tag: 'BR' }, T0));
      expect(await socialRepo.guildOf(tx, poor)).toBeNull();
      expect((await socialRepo.searchGuilds(tx, 'salt', 10)).map((g) => g.tag)).toEqual(['ST']);
      expect(await socialRepo.searchGuilds(tx, '%', 10)).toEqual([]);
    });
  });
});

describe('friendships — one row per unordered pair', () => {
  it('a reverse request accepts the pending one instead of creating a second row', async () => {
    await db.transaction(async (tx) => {
      const a = await mkPlayer(tx, 'alice');
      const b = await mkPlayer(tx, 'bob');
      expect(await socialRepo.requestFriend(tx, a, b, T0)).toBe('requested');
      expect(await socialRepo.requestFriend(tx, a, b, at(1))).toBe('requested'); // idempotent
      let lists = await socialRepo.friendLists(tx, a);
      expect(lists.outgoing.map((f) => f.username)).toEqual(['bob']);
      expect((await socialRepo.friendLists(tx, b)).incoming.map((f) => f.username)).toEqual(['alice']);
      expect(await socialRepo.requestFriend(tx, b, a, at(2))).toBe('accepted');
      expect(await socialRepo.areFriends(tx, a, b)).toBe(true);
      expect(await socialRepo.areFriends(tx, b, a)).toBe(true);
      lists = await socialRepo.friendLists(tx, a);
      expect(lists.friends.map((f) => f.username)).toEqual(['bob']);
      expect(lists.incoming).toEqual([]);
      expect(lists.outgoing).toEqual([]);
      const rows = await tx.select().from(friendships);
      expect(rows.filter((r) => (r.requesterId === a && r.addresseeId === b) || (r.requesterId === b && r.addresseeId === a))).toHaveLength(1);
      await expectPersistError('AlreadyFriends', () => socialRepo.requestFriend(tx, a, b, at(3)));
      await expectPersistError('InvalidArgument', () => socialRepo.requestFriend(tx, a, a, at(3)));
    });
  });

  it('the canonical-pair unique index rejects the mirrored row even when written around the repo', async () => {
    await db.transaction(async (tx) => {
      const a = await mkPlayer(tx);
      const b = await mkPlayer(tx);
      await tx.insert(friendships).values({ requesterId: a, addresseeId: b, status: 'pending', createdAt: T0 });
      await expectDbError(/friendships_pair_uq/, () => tx.insert(friendships).values({ requesterId: b, addresseeId: a, status: 'pending', createdAt: T0 }));
    });
    await db.transaction(async (tx) => {
      const a = await mkPlayer(tx);
      await expectDbError(/friendship_not_self_ck/, () => tx.insert(friendships).values({ requesterId: a, addresseeId: a, status: 'pending', createdAt: T0 }));
    });
  });

  it('accept / decline / remove act on the pair whichever direction it was requested', async () => {
    await db.transaction(async (tx) => {
      const a = await mkPlayer(tx);
      const b = await mkPlayer(tx);
      const c = await mkPlayer(tx);
      await socialRepo.requestFriend(tx, a, b, T0);
      await socialRepo.acceptFriend(tx, b, a);
      expect(await socialRepo.areFriends(tx, a, b)).toBe(true);
      await socialRepo.removeFriend(tx, b, a);
      expect(await socialRepo.areFriends(tx, a, b)).toBe(false);
      await socialRepo.requestFriend(tx, c, a, T0);
      await socialRepo.declineFriend(tx, a, c);
      expect((await socialRepo.friendLists(tx, a)).incoming).toEqual([]);
      await expectPersistError('NotFound', () => socialRepo.acceptFriend(tx, a, c));
    });
  });
});

describe('messages', () => {
  it('threads are pairwise, newest first, with read tracking', async () => {
    await db.transaction(async (tx) => {
      const a = await mkPlayer(tx);
      const b = await mkPlayer(tx);
      await socialRepo.sendMessage(tx, a, b, 'hi', at(0));
      await socialRepo.sendMessage(tx, b, a, 'hello', at(1));
      await socialRepo.sendMessage(tx, a, b, 'trade?', at(2));
      await expectPersistError('InvalidArgument', () => socialRepo.sendMessage(tx, a, b, '   ', at(3)));
      await expectPersistError('InvalidArgument', () => socialRepo.sendMessage(tx, a, b, 'x'.repeat(301), at(3)));
      const thread = await socialRepo.thread(tx, a, b, null, 50);
      expect(thread.map((m) => m.text)).toEqual(['trade?', 'hello', 'hi']);
      expect(await socialRepo.unreadCounts(tx, b)).toEqual({ [a]: 2 });
      expect(await socialRepo.markRead(tx, b, a, at(5))).toBe(2);
      expect(await socialRepo.unreadCounts(tx, b)).toEqual({});
      expect((await socialRepo.thread(tx, a, b, at(2), 50)).map((m) => m.text)).toEqual(['hello', 'hi']);
    });
  });
});
