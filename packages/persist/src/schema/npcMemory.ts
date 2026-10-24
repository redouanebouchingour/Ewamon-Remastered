import { check, index, integer, jsonb, pgTable, primaryKey, smallint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { players } from './players';

/** One remembered deed (protocol `NPC_DEEDS`), newest last. */
export interface NpcDeedJson {
  readonly deed: string;
  /** ISO time */
  readonly at: string;
}

/**
 * NPC memory (migration 0021, the LLM NPC talk): what each NPC remembers of each player. `summary` is a rolling note
 * from the NPC's point of view (older sentences drop off the front), `standing` -10..10, `deeds` the last few notable
 * deeds. `zone_id` is the zone the NPC stands in (a town's interior residents carry the town), so a town's reputation
 * is one indexed read.
 */
export const npcMemories = pgTable(
  'npc_memories',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    npcId: varchar('npc_id', { length: 80 }).notNull(),
    zoneId: varchar('zone_id', { length: 32 }).notNull(),
    summary: varchar('summary', { length: 400 }).notNull().default(''),
    standing: smallint('standing').notNull().default(0),
    deeds: jsonb('deeds').$type<NpcDeedJson[]>().notNull().default([]),
    /** conversations remembered */
    talks: integer('talks').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.npcId], name: 'npc_memories_pk' }),
    index('npc_memories_zone_idx').on(t.playerId, t.zoneId),
    check('npc_memories_standing_ck', sql`${t.standing} between -10 and 10`),
  ],
);

export type NpcMemoryRow = typeof npcMemories.$inferSelect;
