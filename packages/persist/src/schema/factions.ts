import { index, integer, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { players } from './players';

/**
 * Majin vs Tenjin seasons (migration 0013): the side a trainer took for a season ('majin' | 'tenjin', content
 * factions.ts) and the points they earned it. One row per (season, player): the side never changes within a season.
 */
export const seasonFactions = pgTable(
  'season_factions',
  {
    season: integer('season').notNull(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    side: varchar('side', { length: 8 }).notNull(),
    points: integer('points').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.season, t.playerId] }), index('season_factions_side_idx').on(t.season, t.side, t.points)],
);

export type SeasonFactionRow = typeof seasonFactions.$inferSelect;
