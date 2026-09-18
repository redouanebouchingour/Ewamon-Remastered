import { bigserial, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** null = system */
    actorId: uuid('actor_id'),
    /** 'creature.transfer' | 'listing.bid' | 'admin.ban' | 'badge.award' | … */
    action: varchar('action', { length: 48 }).notNull(),
    subject: varchar('subject', { length: 64 }),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_actor_idx').on(t.actorId, t.at), index('audit_log_action_idx').on(t.action, t.at)],
);

export type AuditRow = typeof auditLog.$inferSelect;
