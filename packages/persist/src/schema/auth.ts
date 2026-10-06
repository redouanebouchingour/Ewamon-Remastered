import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { players } from './players';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    /** sha-256 of the opaque token; the token itself is never stored */
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('refresh_tokens_hash_uq').on(t.tokenHash), index('refresh_tokens_player_idx').on(t.playerId)],
);

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

/** Phase C6 — the two kinds of single-use email token. */
export const EMAIL_TOKEN_KINDS = ['reset', 'verify'] as const;
export type EmailTokenKind = (typeof EMAIL_TOKEN_KINDS)[number];

/**
 * Phase C6 — password-reset and email-verification tokens. Like refresh tokens, only the sha-256 hex of the
 * opaque token is stored; a token is single use (`used_at`) and short-lived (`expires_at`).
 */
export const emailTokens = pgTable(
  'email_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 8 }).$type<EmailTokenKind>().notNull(),
    /** sha-256 of the opaque token; the token itself is never stored */
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('email_tokens_hash_uq').on(t.tokenHash),
    index('email_tokens_player_kind_idx').on(t.playerId, t.kind),
    check('email_tokens_kind_ck', sql`${t.kind} in ('reset', 'verify')`),
  ],
);

export type EmailTokenRow = typeof emailTokens.$inferSelect;
