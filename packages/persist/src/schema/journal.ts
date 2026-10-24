import { check, integer, jsonb, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { players } from './players';

/** One fact of a journal day as the server read it when the entry was written (protocol `JournalFact`, typed loosely). */
export interface JournalFactJson {
  readonly kind: string;
  readonly text: string;
  readonly speciesId: string | null;
  readonly zoneId: string | null;
  readonly type: string | null;
  readonly count: number;
}

/**
 * The adventure journal (migration 0024, LLM feature 9): one diary entry per player per UTC day, in the player's voice,
 * written by the client (the model or its template) from the server's digest of the day. `day` is the UTC day key
 * `YYYY-MM-DD`, `day_number` the player's day ("Day 12": days since the account was made, from 1). `facts` is the
 * digest the entry was written from, kept so the list can show its chips without reading the day again. Text only:
 * nothing reads it but the Journal screen.
 */
export const journalEntries = pgTable(
  'journal_entries',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    day: varchar('day', { length: 10 }).notNull(),
    dayNumber: integer('day_number').notNull(),
    text: varchar('text', { length: 600 }).notNull(),
    facts: jsonb('facts').$type<JournalFactJson[]>().notNull().default([]),
    writtenAt: timestamp('written_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.day], name: 'journal_entries_pk' }),
    check('journal_entries_text_ck', sql`char_length(${t.text}) between 1 and 600`),
    check('journal_entries_day_ck', sql`${t.dayNumber} >= 1`),
  ],
);

export type JournalEntryRow = typeof journalEntries.$inferSelect;
