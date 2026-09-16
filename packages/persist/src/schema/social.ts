import { sql } from 'drizzle-orm';
import { bigserial, check, index, pgTable, primaryKey, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { friendshipStatus, guildRole } from './enums';
import { players } from './players';

export const friendships = pgTable(
  'friendships',
  {
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    status: friendshipStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.requesterId, t.addresseeId] }),
    index('friendships_addressee_idx').on(t.addresseeId),
    check('friendship_not_self_ck', sql`${t.requesterId} <> ${t.addresseeId}`),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    fromId: uuid('from_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    toId: uuid('to_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    text: varchar('text', { length: 300 }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [index('messages_pair_idx').on(t.fromId, t.toId, t.sentAt), index('messages_to_unread_idx').on(t.toId, t.readAt)],
);

export const guilds = pgTable(
  'guilds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 24 }).notNull(),
    nameLower: varchar('name_lower', { length: 24 }).notNull(),
    tag: varchar('tag', { length: 4 }).notNull(),
    leaderId: uuid('leader_id')
      .notNull()
      .references(() => players.id),
    motd: varchar('motd', { length: 200 }).notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('guilds_name_lower_uq').on(t.nameLower), uniqueIndex('guilds_tag_uq').on(t.tag)],
);

export const guildMembers = pgTable(
  'guild_members',
  {
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    role: guildRole('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // one guild per player
  (t) => [primaryKey({ columns: [t.guildId, t.playerId] }), uniqueIndex('guild_members_player_uq').on(t.playerId)],
);

export type FriendshipRow = typeof friendships.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type GuildRow = typeof guilds.$inferSelect;
export type GuildMemberRow = typeof guildMembers.$inferSelect;
