import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, primaryKey, smallint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { players } from './players';

/**
 * The daily challenge (migration 0008): one row per player and UTC day. `attempts` counts every finished try; the best
 * win (`turns`, its per-turn `marks` and battle) is kept, null until the first win. Fewer turns is better; a tie keeps
 * the earlier win (`won_at`).
 */
export const dailyResults = pgTable(
  'daily_results',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    dayKey: varchar('day_key', { length: 10 }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    turns: smallint('turns'),
    marks: varchar('marks', { length: 200 }),
    battleId: uuid('battle_id'),
    wonAt: timestamp('won_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.dayKey] }),
    index('daily_results_day_idx').on(t.dayKey, t.turns, t.wonAt),
    check('daily_results_turns_ck', sql`${t.turns} is null or ${t.turns} >= 1`),
  ],
);

export type DailyResultRow = typeof dailyResults.$inferSelect;
