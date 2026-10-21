import { boolean, check, index, integer, pgTable, smallint, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { players } from './players';

/**
 * The bounty board (migration 0019, content bounties.ts): one row per poster. `kind`: `game` (the board's own, on a
 * ghost that keeps winning), `player` (a trainer's escrow on a ghost: `reward` + `fee` were taken from the poster), or
 * `nemesis` (written when a trainer brings in one of their own nemeses: a claimed record, never open). `status`: `open`,
 * `claimed` (by `claimer_id`, paid `payout` once) or `expired` (a player's escrow went back). At most one open game
 * bounty per ghost.
 */
export const bounties = pgTable(
  'bounties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: varchar('kind', { length: 8 }).notNull(),
    /** the ghost's owner (null for a nemesis) */
    targetId: uuid('target_id').references(() => players.id, { onDelete: 'cascade' }),
    /** the ghost's owner's name, or the nemesis's full name, as it was */
    targetName: varchar('target_name', { length: 64 }).notNull(),
    /** the creature on the poster: the ghost's strongest, or the nemesis */
    speciesId: varchar('species_id', { length: 32 }).notNull(),
    level: smallint('level').notNull(),
    /** where the ghost haunted (or the nemesis was brought in) when the row was last written */
    zoneId: varchar('zone_id', { length: 32 }).notNull(),
    /** the record behind it: trainers the ghost beat (a game bounty), or the nemesis's rank */
    wins: integer('wins').notNull().default(0),
    /** null = the board */
    posterId: uuid('poster_id').references(() => players.id, { onDelete: 'cascade' }),
    posterName: varchar('poster_name', { length: 20 }),
    reward: integer('reward').notNull(),
    /** the board's cut held in escrow with a player's reward (0 otherwise) */
    fee: integer('fee').notNull().default(0),
    status: varchar('status', { length: 8 }).notNull().default('open'),
    claimerId: uuid('claimer_id').references(() => players.id, { onDelete: 'set null' }),
    claimerName: varchar('claimer_name', { length: 20 }),
    payout: integer('payout'),
    /** the claimer's party held a Lawlander */
    bonus: boolean('bonus').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
  },
  (t) => [
    index('bounties_open_idx').on(t.status, t.targetId),
    index('bounties_poster_idx').on(t.posterId, t.status),
    index('bounties_claimer_idx').on(t.claimerId, t.claimedAt),
    uniqueIndex('bounties_game_open_uq').on(t.targetId).where(sql`${t.kind} = 'game' and ${t.status} = 'open'`),
    check('bounties_kind_ck', sql`${t.kind} in ('game', 'player', 'nemesis')`),
    check('bounties_status_ck', sql`${t.status} in ('open', 'claimed', 'expired')`),
    check('bounties_reward_ck', sql`${t.reward} >= 0 and ${t.fee} >= 0`),
  ],
);

export type BountyRow = typeof bounties.$inferSelect;
