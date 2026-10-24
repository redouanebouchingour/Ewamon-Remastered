import { check, integer, jsonb, pgTable, smallint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { players } from './players';

/** One creature of the team the rival last fielded. */
export interface RivalTeamMemberJson {
  readonly speciesId: string;
  readonly level: number;
}

/**
 * A recurring rival (migration 0023, LLM feature 7): one row per player, created the first time the rival is drawn.
 * The identity (`name`, `look`, `temperament`, `signature`: the root of its starter line) is stored as drawn, so a new
 * world seed never renames it. The record counts the meetings from both sides; `last_result` is the player's view
 * (`won` / `lost` / `draw`); `next_at` is the end of the cooldown; `last_words` the rival's parting line of the last
 * meeting as the player saw it (null until the client sends it).
 */
export const rivals = pgTable(
  'rivals',
  {
    playerId: uuid('player_id')
      .primaryKey()
      .references(() => players.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 16 }).notNull(),
    look: varchar('look', { length: 32 }).notNull(),
    temperament: varchar('temperament', { length: 16 }).notNull(),
    signature: varchar('signature', { length: 32 }).notNull(),
    playerWins: smallint('player_wins').notNull().default(0),
    rivalWins: smallint('rival_wins').notNull().default(0),
    draws: smallint('draws').notNull().default(0),
    meetings: integer('meetings').notNull().default(0),
    lastResult: varchar('last_result', { length: 8 }),
    lastZone: varchar('last_zone', { length: 32 }),
    lastMetAt: timestamp('last_met_at', { withTimezone: true }),
    lastTeam: jsonb('last_team').$type<RivalTeamMemberJson[]>().notNull().default([]),
    lastWords: varchar('last_words', { length: 200 }),
    nextAt: timestamp('next_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('rivals_record_ck', sql`${t.playerWins} >= 0 and ${t.rivalWins} >= 0 and ${t.draws} >= 0 and ${t.meetings} >= 0`),
    check('rivals_result_ck', sql`${t.lastResult} is null or ${t.lastResult} in ('won', 'lost', 'draw')`),
  ],
);

export type RivalRow = typeof rivals.$inferSelect;
