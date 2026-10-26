import { boolean, integer, jsonb, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { VariantKey } from '../types';
import { players } from './players';

export const badges = pgTable(
  'badges',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    badgeId: varchar('badge_id', { length: 16 }).notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.badgeId] })],
);

export const storyFlags = pgTable(
  'story_flags',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    flag: varchar('flag', { length: 64 }).notNull(),
    setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.flag] })],
);

export const dexEntries = pgTable(
  'dex_entries',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    speciesId: varchar('species_id', { length: 32 }).notNull(),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
    caughtAt: timestamp('caught_at', { withTimezone: true }),
    variants: jsonb('variants').$type<VariantKey[]>().notNull().default([]),
    alphaSeen: boolean('alpha_seen').notNull().default(false),
    /** Phase D4 (migration 0003): a shiny of this species was caught */
    shinyCaught: boolean('shiny_caught').notNull().default(false),
    /** Dex research (migration 0025): counter id -> count (content `RESEARCH_COUNTERS`, `form:<id>`); absent = 0 */
    counters: jsonb('counters').$type<Record<string, number>>().notNull().default({}),
    /** Dex research: the zone the species was first seen in; null when it came another way (a gift, a trade) */
    firstSeenZone: varchar('first_seen_zone', { length: 32 }),
    /** Dex research: when the player last opened the entry (the client's "new" marker); null = never */
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.speciesId] })],
);

export const questProgress = pgTable(
  'quest_progress',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    questId: varchar('quest_id', { length: 48 }).notNull(),
    objectiveId: varchar('objective_id', { length: 48 }).notNull(),
    count: integer('count').notNull().default(0),
    done: boolean('done').notNull().default(false),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.questId, t.objectiveId] })],
);

/** Dex research: a completion reward the player claimed (content reward ids), once each. */
export const dexRewards = pgTable(
  'dex_rewards',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    rewardId: varchar('reward_id', { length: 64 }).notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.rewardId] })],
);

export type BadgeRow = typeof badges.$inferSelect;
export type StoryFlagRow = typeof storyFlags.$inferSelect;
export type DexEntryRow = typeof dexEntries.$inferSelect;
export type DexRewardRow = typeof dexRewards.$inferSelect;
export type QuestProgressRow = typeof questProgress.$inferSelect;
