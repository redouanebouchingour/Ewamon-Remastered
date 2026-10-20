import { bigserial, boolean, index, jsonb, pgTable, smallint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { CreatureInstance } from '../types';
import { players } from './players';

/**
 * Ghost trainers (migration 0015): the party a trainer left the world with, haunting the zone they left (one row per
 * trainer, replaced on every leave), and the fights other trainers had with it.
 */
export const ghosts = pgTable(
  'ghosts',
  {
    playerId: uuid('player_id')
      .primaryKey()
      .references(() => players.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 20 }).notNull(),
    zoneId: varchar('zone_id', { length: 32 }).notNull(),
    party: jsonb('party').$type<CreatureInstance[]>().notNull(),
    topLevel: smallint('top_level').notNull(),
    leftAt: timestamp('left_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ghosts_zone_idx').on(t.zoneId, t.leftAt)],
);

export const ghostBattles = pgTable(
  'ghost_battles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ghostId: uuid('ghost_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    challenger: varchar('challenger', { length: 20 }).notNull(),
    zoneId: varchar('zone_id', { length: 32 }).notNull(),
    /** the ghost's side won */
    won: boolean('won').notNull(),
    seen: boolean('seen').notNull().default(false),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ghost_battles_ghost_idx').on(t.ghostId, t.seen, t.at)],
);

export type GhostRow = typeof ghosts.$inferSelect;
