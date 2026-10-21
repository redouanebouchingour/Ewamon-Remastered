import { boolean, check, index, jsonb, pgTable, smallint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { players } from './players';

/** What a nemesis remembers of its last fight with its trainer (content `NemesisMemory`). */
export interface NemesisMemoryJson {
  readonly how: 'ko' | 'breakout';
  readonly zoneId: string;
  readonly foeSpecies: string;
  readonly foeName: string | null;
  readonly move: string | null;
  readonly orb: string | null;
}

/**
 * Nemeses (migration 0017, content nemesis.ts): a wild creature that knocked out one of the trainer's creatures or
 * broke out of their orb and got away, promoted for that trainer alone. `status`: `active` (it may ambush), `beaten`
 * (knocked out), `caught` (it became the trainer's creature), `faded` (pushed out by a newer one).
 */
export const nemeses = pgTable(
  'nemeses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    speciesId: varchar('species_id', { length: 32 }).notNull(),
    level: smallint('level').notNull(),
    name: varchar('name', { length: 16 }).notNull(),
    title: varchar('title', { length: 32 }).notNull(),
    scar: varchar('scar', { length: 16 }).notNull(),
    /** the move it gained (null: it found none to learn) */
    move: varchar('move', { length: 32 }),
    rank: smallint('rank').notNull().default(1),
    ability: varchar('ability', { length: 32 }).notNull(),
    variantKey: varchar('variant_key', { length: 8 }).notNull().default('normal'),
    isShiny: boolean('is_shiny').notNull().default(false),
    isAlpha: boolean('is_alpha').notNull().default(false),
    /** where it rose (it never ambushes there) */
    bornZone: varchar('born_zone', { length: 32 }).notNull(),
    /** where the trainer last met it */
    lastZone: varchar('last_zone', { length: 32 }).notNull(),
    memory: jsonb('memory').$type<NemesisMemoryJson>().notNull(),
    status: varchar('status', { length: 8 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** the last fight with the trainer (rise, rank up, sighting or end) */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('nemeses_owner_idx').on(t.ownerId, t.status),
    check('nemeses_status_ck', sql`${t.status} in ('active', 'beaten', 'caught', 'faded')`),
    check('nemeses_rank_ck', sql`${t.rank} between 1 and 5`),
    check('nemeses_level_ck', sql`${t.level} between 1 and 100`),
  ],
);

export type NemesisRow = typeof nemeses.$inferSelect;
