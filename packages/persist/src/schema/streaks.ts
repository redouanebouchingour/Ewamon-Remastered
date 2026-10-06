import { check, index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { players } from './players';

/**
 * Phase D14 (migration 0004): the battle tower streak — `current` = wins in the run in progress (0 once a run ends),
 * `best` = the longest streak ever (never lowered). One row per player, created on the first tower result.
 */
export const playerStreaks = pgTable(
  'player_streaks',
  {
    playerId: uuid('player_id')
      .primaryKey()
      .references(() => players.id, { onDelete: 'cascade' }),
    current: integer('current').notNull().default(0),
    best: integer('best').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('player_streaks_best_idx').on(t.best),
    check('player_streaks_current_ck', sql`${t.current} >= 0`),
    check('player_streaks_best_ck', sql`${t.best} >= ${t.current}`),
  ],
);
