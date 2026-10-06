import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, real, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const players = pgTable(
  'players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 20 }).notNull(),
    usernameLower: varchar('username_lower', { length: 20 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    /** argon2id (hash-wasm), m=19456 t=2 p=1 — hashed by the server, opaque here. */
    passwordHash: text('password_hash').notNull(),
    /** Phase C6: set by POST /auth/verify; null = unverified. Never gates play (a nudge only). */
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    money: integer('money').notNull().default(3000),
    zoneId: varchar('zone_id', { length: 32 }).notNull().default('mirevale'),
    x: real('x').notNull().default(0),
    z: real('z').notNull().default(6),
    angle: real('angle').notNull().default(0),
    body: varchar('body', { length: 32 }).notNull().default('ranger_m'),
    title: varchar('title', { length: 40 }).notNull().default('Rookie Trainer'),
    motto: varchar('motto', { length: 120 }).notNull().default(''),
    rating: integer('rating').notNull().default(1000),
    peakRating: integer('peak_rating').notNull().default(1000),
    rankedMatches: integer('ranked_matches').notNull().default(0),
    trainerExp: integer('trainer_exp').notNull().default(0),
    isAdmin: boolean('is_admin').notNull().default(false),
    bannedAt: timestamp('banned_at', { withTimezone: true }),
    banReason: text('ban_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('players_username_lower_uq').on(t.usernameLower),
    uniqueIndex('players_email_uq').on(t.email),
    index('players_rating_idx').on(t.rating),
    // Defence in depth for PlayerRepo.addMoney (which already refuses a negative result in its WHERE).
    check('players_money_ck', sql`${t.money} >= 0`),
  ],
);

export type PlayerRow = typeof players.$inferSelect;
export type NewPlayerRow = typeof players.$inferInsert;
