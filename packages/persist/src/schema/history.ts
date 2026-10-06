import { index, integer, jsonb, pgTable, primaryKey, smallint, timestamp, uuid, varchar, bigserial } from 'drizzle-orm/pg-core';
import type { BattleStartSnapshot, ReplayChoice, RewardsSummary, RngState, TradedCreatureSummary } from '../types';
import { battleFormat } from './enums';
import { players } from './players';

export const battleHistory = pgTable(
  'battle_history',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    battleId: uuid('battle_id').notNull(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    /** username or content trainer id */
    opponent: varchar('opponent', { length: 64 }).notNull(),
    format: battleFormat('format').notNull(),
    /** 'win' | 'loss' | 'draw' | 'fled' | 'caught' */
    result: varchar('result', { length: 8 }).notNull(),
    turns: smallint('turns').notNull(),
    ratingDelta: integer('rating_delta'),
    rewards: jsonb('rewards').$type<RewardsSummary>().notNull(),
    /** replay: seed + actions reproduce the battle */
    seed: jsonb('seed').$type<RngState>().notNull(),
    actions: jsonb('actions').$type<[ReplayChoice, ReplayChoice][]>().notNull(),
    /** replay: the createBattle input minus seed (zoneId, terrain, both starting sides); null for rows written before migration 0001 */
    start: jsonb('start').$type<BattleStartSnapshot>(),
    /** digestBattleState of the final state — what a replay must reproduce; null for rows before migration 0001 */
    finalDigest: varchar('final_digest', { length: 8 }),
    happenedAt: timestamp('happened_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('battle_history_player_idx').on(t.playerId, t.happenedAt)],
);

export const tradeHistory = pgTable(
  'trade_history',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tradeId: uuid('trade_id').notNull(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => players.id),
    sent: jsonb('sent').$type<TradedCreatureSummary[]>().notNull(),
    received: jsonb('received').$type<TradedCreatureSummary[]>().notNull(),
    moneySent: integer('money_sent').notNull().default(0),
    moneyReceived: integer('money_received').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('trade_history_player_idx').on(t.playerId, t.completedAt)],
);

export const battlePass = pgTable(
  'battle_pass',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    level: smallint('level').notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
    /** set on the level-50 row only */
    mythicalChoice: varchar('mythical_choice', { length: 16 }),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.level] })],
);

export type BattleHistoryRow = typeof battleHistory.$inferSelect;
export type NewBattleHistoryRow = typeof battleHistory.$inferInsert;
export type TradeHistoryRow = typeof tradeHistory.$inferSelect;
export type NewTradeHistoryRow = typeof tradeHistory.$inferInsert;
export type BattlePassRow = typeof battlePass.$inferSelect;
