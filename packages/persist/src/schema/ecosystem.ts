import { integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core';

/**
 * A living ecosystem (migration 0018): how many of each species players caught and knocked out in each zone, per
 * ecosystem week (content `ecoWeek`: Monday to Monday from the first season). Added to in the wild battle's own turn
 * transaction; the zone's encounter weights this week are derived from this week's and last week's rows.
 */
export const ecoTakes = pgTable(
  'eco_takes',
  {
    zoneId: varchar('zone_id', { length: 32 }).notNull(),
    week: integer('week').notNull(),
    speciesId: varchar('species_id', { length: 32 }).notNull(),
    caught: integer('caught').notNull().default(0),
    ko: integer('ko').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.zoneId, t.week, t.speciesId] })],
);

export type EcoTakeRow = typeof ecoTakes.$inferSelect;
