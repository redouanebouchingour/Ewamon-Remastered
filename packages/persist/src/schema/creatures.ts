import { sql } from 'drizzle-orm';
import { bigserial, boolean, check, index, integer, jsonb, pgTable, smallint, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
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
    /** migration 0005: the honor ledger (core honor.ts), -10..10; 0 = none — only dustcub's line ever moves it */
    honor: smallint('honor').notNull().default(0),
    caughtZoneId: varchar('caught_zone_id', { length: 32 }),
    caughtAt: timestamp('caught_at', { withTimezone: true }),
    ribbons: jsonb('ribbons').$type<string[]>().notNull().default([]),
    /**
     * Creature history (migration 0007): the trainer who first owned it (the catcher, or who it was given to) and their
     * name kept as it was then; null for creatures that predate the history (and the id once that account is gone).
     */
    originalTrainerId: uuid('original_trainer_id').references(() => players.id, { onDelete: 'set null' }),
    originalTrainerName: varchar('original_trainer_name', { length: 20 }),
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

/**
 * Creature history (migration 0007): what happened to one creature, oldest first. `kind` names the event and `detail`
 * holds its fields (persist's `CreatureEventDetail`); names are kept as they were, so a history outlives renames and
 * departed accounts. Deleted with the creature.
 */
export const creatureEvents = pgTable(
  'creature_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    creatureId: uuid('creature_id')
      .notNull()
      .references(() => creatureInstances.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 16 }).notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('creature_events_creature_idx').on(t.creatureId, t.id)],
);

export type CreatureEventRow = typeof creatureEvents.$inferSelect;

