import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { players } from './players';

/**
 * One roaming legendary per season (migration 0014): the first trainer to catch the season's roamer. One row per
 * season, written once (the insert is the race); the name outlives the account.
 */
export const seasonLegends = pgTable('season_legends', {
  season: integer('season').primaryKey(),
  species: varchar('species', { length: 32 }).notNull(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'set null' }),
  playerName: varchar('player_name', { length: 20 }).notNull(),
  caughtAt: timestamp('caught_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SeasonLegendRow = typeof seasonLegends.$inferSelect;
