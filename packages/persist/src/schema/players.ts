import { sql } from 'drizzle-orm';
import { bigint, boolean, check, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import type { WeatherCity } from '../types';

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
    /**
     * Verified speedruns (migration 0009): the server's play clock. `play_ms` is the banked time in the world (a zone or
     * an arena room); `play_started_at` is set while a room holds the player, so the time now is
     * `play_ms + (now - play_started_at)` and a split can be written inside any transaction.
     */
    playMs: bigint('play_ms', { mode: 'number' }).notNull().default(0),
    playStartedAt: timestamp('play_started_at', { withTimezone: true }),
    /** Weather from real life (migration 0010): the city the player picked, coordinates rounded to 0.1°; null = off */
    weatherCity: jsonb('weather_city').$type<WeatherCity>(),
    /** Talking to other players (migration 0026): who may DM the player, 'everyone' (minus blocks) or 'friends' */
    dmsFrom: varchar('dms_from', { length: 8 }).notNull().default('everyone'),
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
