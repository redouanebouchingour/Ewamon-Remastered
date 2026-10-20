import { integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core';

/**
 * Honor shapes the world (migration 0012): the light and shadow points trainers earned in each zone during a season
 * (content worldHonor.ts). Added to in the battle's own turn transaction; the zone's shadow level is derived from it.
 */
export const worldHonor = pgTable(
  'world_honor',
  {
    season: integer('season').notNull(),
    zoneId: varchar('zone_id', { length: 32 }).notNull(),
    light: integer('light').notNull().default(0),
    shadow: integer('shadow').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.season, t.zoneId] })],
);

export type WorldHonorRow = typeof worldHonor.$inferSelect;
