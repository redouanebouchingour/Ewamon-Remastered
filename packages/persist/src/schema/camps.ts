import { bigserial, boolean, index, integer, jsonb, pgTable, smallint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { CreatureInstance } from '../types';
import { players } from './players';

/** A trophy on a camp as it was set (content camps.ts `Trophy`: `<kind>:<ref>` id, kind, the label it showed). */
export interface CampTrophyJson {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
}

/**
 * Camp bases (migration 0020, content camps.ts): one row per claimed travellers' camp (a route's, keyed by its zone),
 * one camp per owner. `guard` is the party snapshot that fights raiders while the owner is away (replaced on claim and
 * every time the owner leaves the world); `trophies` the owner's pick.
 */
export const camps = pgTable(
  'camps',
  {
    zoneId: varchar('zone_id', { length: 32 }).primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .unique('camps_owner_uq')
      .references(() => players.id, { onDelete: 'cascade' }),
    ownerName: varchar('owner_name', { length: 20 }).notNull(),
    name: varchar('name', { length: 24 }).notNull(),
    trophies: jsonb('trophies').$type<CampTrophyJson[]>().notNull().default([]),
    guard: jsonb('guard').$type<CreatureInstance[]>().notNull(),
    guardTop: smallint('guard_top').notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

/** Every raid on a camp: the owner's camp log (`seen` once told on coming back) and the raider's daily cooldown. */
export const campRaids = pgTable(
  'camp_raids',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    zoneId: varchar('zone_id', { length: 32 }).notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    raiderId: uuid('raider_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    raiderName: varchar('raider_name', { length: 20 }).notNull(),
    /** the raider won */
    won: boolean('won').notNull(),
    /** what the raider took from the owner */
    cut: integer('cut').notNull().default(0),
    /** the raider took the camp over (its owner had been away too long) */
    tookOver: boolean('took_over').notNull().default(false),
    /** the owner's side earned a faction point for the guard holding */
    held: boolean('held').notNull().default(false),
    seen: boolean('seen').notNull().default(false),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('camp_raids_owner_idx').on(t.ownerId, t.seen, t.at), index('camp_raids_raider_idx').on(t.raiderId, t.zoneId, t.at)],
);

export type CampRow = typeof camps.$inferSelect;
export type CampRaidRow = typeof campRaids.$inferSelect;
