import { index, integer, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { players } from './players';

/**
 * Ranked seasons (migration 0011): one row per season once it has been closed. The row is the lock: the server that
 * inserts it writes the standings and pulls the ratings back, in the same transaction; any other finds it taken.
 */
export const seasons = pgTable('seasons', {
  season: integer('season').primaryKey(),
  closedAt: timestamp('closed_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A closed season's final standings: everyone who played a rated fight in it, ranked by rating at the close, with their
 * rated wins and losses in it.
 */
export const seasonResults = pgTable(
  'season_results',
  {
    season: integer('season')
      .notNull()
      .references(() => seasons.season, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    rating: integer('rating').notNull(),
    wins: integer('wins').notNull(),
    losses: integer('losses').notNull(),
  },
  (t) => [primaryKey({ columns: [t.season, t.playerId] }), index('season_results_rank_idx').on(t.season, t.rank), index('season_results_player_idx').on(t.playerId)],
);

export type SeasonResultRow = typeof seasonResults.$inferSelect;
