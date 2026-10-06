import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, smallint, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import type { MoveSlot, StatusId } from '../types';
import { slotKind } from './enums';
import { players } from './players';

/**
 * The `(owner_id, slot_kind, slot_index)` unique index IS the slot model (§5.1): there is no
 * party_slots/box_slots table. A reorder is one transaction that rewrites slot_index for the
 * affected rows in two phases (see `reorderParty`).
 */
export const creatureInstances = pgTable(
  'creature_instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    slotKind: slotKind('slot_kind').notNull(),
    /** party 0..5 (or the 100..105 reorder staging band, transaction-local); box 0..; listing/escrow 0.. */
    slotIndex: integer('slot_index').notNull(),
    speciesId: varchar('species_id', { length: 32 }).notNull(),
    nickname: varchar('nickname', { length: 16 }),
    level: smallint('level').notNull(),
    exp: integer('exp').notNull().default(0),
    hp: integer('hp').notNull(),
    moves: jsonb('moves').$type<MoveSlot[]>().notNull(),
    status: jsonb('status').$type<StatusId[]>().notNull().default([]),
    ability: varchar('ability', { length: 32 }).notNull(),
    heldItem: varchar('held_item', { length: 32 }),
    variantKey: varchar('variant_key', { length: 8 }).notNull().default('normal'),
    isAlpha: boolean('is_alpha').notNull().default(false),
    /** Phase D4 (migration 0003): the 1/512 shiny tier */
    isShiny: boolean('is_shiny').notNull().default(false),
    caughtZoneId: varchar('caught_zone_id', { length: 32 }),
    caughtAt: timestamp('caught_at', { withTimezone: true }),
    ribbons: jsonb('ribbons').$type<string[]>().notNull().default([]),
    favorite: boolean('favorite').notNull().default(false),
    locked: boolean('locked').notNull().default(false),
    /** bumped on every write; informational only — locks do the work */
    version: integer('version').notNull().default(0),
  },
  (t) => [
    uniqueIndex('creature_owner_slot_uq').on(t.ownerId, t.slotKind, t.slotIndex),
    index('creature_owner_idx').on(t.ownerId),
    index('creature_species_idx').on(t.speciesId),
    check('creature_level_ck', sql`${t.level} between 1 and 100`),
    check('creature_hp_ck', sql`${t.hp} >= 0`),
    // 0..5 are the party slots. 100..105 is the reorder staging band: reorderParty parks the rows
    // there for the duration of one statement so the unique index never sees a duplicate; the
    // same transaction always renumbers them back into 0..5 (see IMPLEMENTATION-NOTES.md).
    check('creature_party_slot_ck', sql`${t.slotKind} <> 'party' or ${t.slotIndex} between 0 and 5 or ${t.slotIndex} between 100 and 105`),
  ],
);

export type CreatureRow = typeof creatureInstances.$inferSelect;
export type NewCreatureRow = typeof creatureInstances.$inferInsert;
