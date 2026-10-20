import { bigint, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { players } from './players';

/**
 * Verified speedruns (migration 0009): the play-clock time a player first reached each split (`beat:<id>`,
 * `badge:<id>`, `champion`; the server names them). Written once, in the transaction of the moment it marks.
 */
export const runSplits = pgTable(
  'run_splits',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    split: varchar('split', { length: 48 }).notNull(),
    playMs: bigint('play_ms', { mode: 'number' }).notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.split] })],
);

export type RunSplitRow = typeof runSplits.$inferSelect;
