import { and, desc, eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Tx } from '../db';
import { auditLog } from '../schema/index';
import type { AuditRow } from '../schema/index';

export interface AuditEntry {
  /** null = system */
  readonly actorId: string | null;
  readonly action: string;
  readonly subject: string | null;
  readonly detail: Record<string, unknown>;
}

export const auditRepo = {
  async write(tx: Tx, e: AuditEntry, now: Date): Promise<void> {
    await tx.insert(auditLog).values({ actorId: e.actorId, action: e.action, subject: e.subject, detail: e.detail, at: now });
  },

  async recent(tx: Tx, q: { actorId?: string; action?: string; limit?: number }): Promise<AuditRow[]> {
    const conds: SQL[] = [];
    if (q.actorId !== undefined) conds.push(eq(auditLog.actorId, q.actorId));
    if (q.action !== undefined) conds.push(eq(auditLog.action, q.action));
    return tx
      .select()
      .from(auditLog)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(auditLog.at), desc(auditLog.id))
      .limit(Math.min(500, Math.max(1, q.limit ?? 100)));
  },
};

export type AuditRepo = typeof auditRepo;
