import { check, index, integer, jsonb, pgTable, smallint, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { players } from './players';

/** A favour's objective as the server wrote it (protocol `NpcQuestObjective`: `{ kind, ... }`). */
export interface NpcQuestObjectiveJson {
  readonly kind: string;
  readonly [field: string]: unknown;
}

/** A favour's reward (protocol `NpcQuestReward`). */
export interface NpcQuestRewardJson {
  readonly money: number;
  readonly item: { readonly id: string; readonly qty: number } | null;
}

/**
 * NPC side quests (migration 0022, LLM feature 2): one row per favour an NPC asked of a player. `status`: `offered`
 * (asked, not answered), `active` (accepted), then `claimed`, or `declined` / `abandoned` / `expired` (an offer left
 * unanswered). `seq` numbers an NPC's favours for the player (it seeds the next one). `zone_id` is where the NPC
 * stands (the hand-in). At most one open (offered or active) favour per player and NPC.
 */
export const npcQuests = pgTable(
  'npc_quests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    npcId: varchar('npc_id', { length: 80 }).notNull(),
    zoneId: varchar('zone_id', { length: 32 }).notNull(),
    seq: integer('seq').notNull(),
    status: varchar('status', { length: 10 }).notNull().default('offered'),
    objective: jsonb('objective').$type<NpcQuestObjectiveJson>().notNull(),
    reward: jsonb('reward').$type<NpcQuestRewardJson>().notNull(),
    target: smallint('target').notNull(),
    progress: smallint('progress').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    index('npc_quests_player_idx').on(t.playerId, t.status),
    index('npc_quests_npc_idx').on(t.playerId, t.npcId),
    uniqueIndex('npc_quests_open_uq').on(t.playerId, t.npcId).where(sql`${t.status} in ('offered', 'active')`),
    check('npc_quests_status_ck', sql`${t.status} in ('offered', 'active', 'claimed', 'declined', 'abandoned', 'expired')`),
    check('npc_quests_progress_ck', sql`${t.progress} >= 0 and ${t.target} >= 1`),
  ],
);

export type NpcQuestRow = typeof npcQuests.$inferSelect;
