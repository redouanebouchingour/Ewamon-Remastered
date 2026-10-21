import { boolean, check, index, integer, jsonb, pgTable, smallint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { players } from './players';

/**
 * Breeding (migration 0016). The two creatures a trainer left at the Daycare are `creature_instances` rows in the
 * `daycare` slot kind (slot index = the order they were left in); this row holds when the keeper has the next egg
 * ready (null while the pair cannot breed).
 */
export const daycare = pgTable('daycare', {
  playerId: uuid('player_id')
    .primaryKey()
    .references(() => players.id, { onDelete: 'cascade' }),
  eggAt: timestamp('egg_at', { withTimezone: true }),
});

/** One parent of an egg, as it was when the egg was laid. */
export interface EggParent {
  readonly speciesId: string;
  readonly nickname: string | null;
}

/**
 * An egg the trainer carries (`place` 'party': it counts the steps they walk) or keeps in the box (it waits). It
 * becomes a creature when `steps_walked` reaches `steps_total`; everything the hatchling inherits is fixed when the
 * egg is laid.
 */
export const eggs = pgTable(
  'eggs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    place: varchar('place', { length: 8 }).notNull().default('party'),
    speciesId: varchar('species_id', { length: 32 }).notNull(),
    stepsTotal: integer('steps_total').notNull(),
    stepsWalked: integer('steps_walked').notNull().default(0),
    honor: smallint('honor').notNull().default(0),
    variantKey: varchar('variant_key', { length: 8 }).notNull().default('normal'),
    ability: varchar('ability', { length: 32 }).notNull(),
    /** the egg moves (move ids), oldest first */
    moves: jsonb('moves').$type<string[]>().notNull().default([]),
    isShiny: boolean('is_shiny').notNull().default(false),
    bandborn: boolean('bandborn').notNull().default(false),
    parents: jsonb('parents').$type<EggParent[]>().notNull(),
    /** the Daycare's zone */
    zoneId: varchar('zone_id', { length: 32 }).notNull(),
    laidAt: timestamp('laid_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('eggs_owner_idx').on(t.ownerId, t.place),
    check('eggs_place_ck', sql`${t.place} in ('party', 'box')`),
    check('eggs_steps_ck', sql`${t.stepsWalked} between 0 and ${t.stepsTotal}`),
  ],
);

export type EggRow = typeof eggs.$inferSelect;
