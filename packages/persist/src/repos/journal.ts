import { and, asc, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import type { Tx } from '../db';
import { auditLog, badges, battleHistory, creatureEvents, creatureInstances, journalEntries, npcMemories, runSplits } from '../schema/index';
import type { JournalFactJson, NpcDeedJson } from '../schema/index';

/** A journal entry as stored (migration 0024). */
export interface JournalEntry {
  readonly playerId: string;
  /** UTC `YYYY-MM-DD` */
  readonly day: string;
  readonly dayNumber: number;
  readonly text: string;
  readonly facts: readonly JournalFactJson[];
  readonly writtenAt: Date;
}

/** What happened to one of the player's creatures in the window (creature history, migration 0007). */
export interface JournalCreatureEvent {
  readonly kind: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly at: Date;
  readonly speciesId: string;
  readonly nickname: string | null;
  readonly isShiny: boolean;
  readonly isAlpha: boolean;
}

export interface JournalBattle {
  readonly opponent: string;
  readonly format: string;
  readonly result: string;
  /** the battle's zone (from the replay start snapshot; null for rows that predate it) */
  readonly zoneId: string | null;
  readonly at: Date;
}

export interface JournalAudit {
  readonly action: string;
  readonly subject: string | null;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly at: Date;
}

export interface JournalMemory {
  readonly npcId: string;
  readonly zoneId: string;
  readonly deeds: readonly NpcDeedJson[];
}

/** Caps on what one day reads (a day busier than this is told from its first rows). */
export const JOURNAL_READ_MAX = 400;

/** The adventure journal (migration 0024): the entries, and the reads behind a day's digest. Read-only but `write`. */
export const journalRepo = {
  async entry(tx: Tx, playerId: string, day: string): Promise<JournalEntry | null> {
    const [r] = await tx
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.playerId, playerId), eq(journalEntries.day, day)))
      .limit(1);
    return r ?? null;
  },

  /** The player's entries, newest day first (before `beforeDay` when given). */
  async entries(tx: Tx, playerId: string, limit: number, beforeDay?: string): Promise<JournalEntry[]> {
    return tx
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.playerId, playerId), ...(beforeDay !== undefined ? [lt(journalEntries.day, beforeDay)] : [])))
      .orderBy(desc(journalEntries.day))
      .limit(Math.min(100, Math.max(1, Math.trunc(limit))));
  },

  /** Writes the day's entry (a second write of the same day replaces it: the caller decides who may). */
  async write(tx: Tx, e: Omit<JournalEntry, 'writtenAt'>, now: Date): Promise<JournalEntry> {
    const [r] = await tx
      .insert(journalEntries)
      .values({ playerId: e.playerId, day: e.day, dayNumber: e.dayNumber, text: e.text, facts: [...e.facts], writtenAt: now })
      .onConflictDoUpdate({ target: [journalEntries.playerId, journalEntries.day], set: { text: e.text, facts: [...e.facts], dayNumber: e.dayNumber, writtenAt: now } })
      .returning();
    return r!;
  },

  // ---- a day's reads ------------------------------------------------------------------------------------------------

  /** History events in [from, to) of the creatures the player owns now, the earliest first. */
  async creatureEvents(tx: Tx, ownerId: string, from: Date, to: Date): Promise<JournalCreatureEvent[]> {
    return tx
      .select({
        kind: creatureEvents.kind,
        detail: creatureEvents.detail,
        at: creatureEvents.at,
        speciesId: creatureInstances.speciesId,
        nickname: creatureInstances.nickname,
        isShiny: creatureInstances.isShiny,
        isAlpha: creatureInstances.isAlpha,
      })
      .from(creatureEvents)
      .innerJoin(creatureInstances, eq(creatureInstances.id, creatureEvents.creatureId))
      .where(and(eq(creatureInstances.ownerId, ownerId), gte(creatureEvents.at, from), lt(creatureEvents.at, to)))
      .orderBy(asc(creatureEvents.at), asc(creatureEvents.id))
      .limit(JOURNAL_READ_MAX);
  },

  /** The player's battles that ended in [from, to), the earliest first. */
  async battles(tx: Tx, playerId: string, from: Date, to: Date): Promise<JournalBattle[]> {
    const rows = await tx
      .select({ opponent: battleHistory.opponent, format: battleHistory.format, result: battleHistory.result, start: battleHistory.start, at: battleHistory.happenedAt })
      .from(battleHistory)
      .where(and(eq(battleHistory.playerId, playerId), gte(battleHistory.happenedAt, from), lt(battleHistory.happenedAt, to)))
      .orderBy(asc(battleHistory.happenedAt), asc(battleHistory.id))
      .limit(JOURNAL_READ_MAX);
    return rows.map((r) => ({ opponent: r.opponent, format: r.format, result: r.result, zoneId: r.start?.zoneId ?? null, at: r.at }));
  },

  /** The player's audit rows of `actions` in [from, to), the earliest first. */
  async audit(tx: Tx, actorId: string, actions: readonly string[], from: Date, to: Date): Promise<JournalAudit[]> {
    if (actions.length === 0) return [];
    return tx
      .select({ action: auditLog.action, subject: auditLog.subject, detail: auditLog.detail, at: auditLog.at })
      .from(auditLog)
      .where(and(eq(auditLog.actorId, actorId), inArray(auditLog.action, [...actions]), gte(auditLog.at, from), lt(auditLog.at, to)))
      .orderBy(asc(auditLog.at), asc(auditLog.id))
      .limit(JOURNAL_READ_MAX);
  },

  /** Badges the player earned in [from, to). */
  async badges(tx: Tx, playerId: string, from: Date, to: Date): Promise<{ readonly badgeId: string; readonly at: Date }[]> {
    return tx
      .select({ badgeId: badges.badgeId, at: badges.earnedAt })
      .from(badges)
      .where(and(eq(badges.playerId, playerId), gte(badges.earnedAt, from), lt(badges.earnedAt, to)))
      .orderBy(asc(badges.earnedAt), asc(badges.badgeId));
  },

  /** Run splits (`champion`, `badge:<id>`, `beat:<id>`) the player first reached in [from, to). */
  async splits(tx: Tx, playerId: string, from: Date, to: Date): Promise<{ readonly split: string; readonly at: Date }[]> {
    return tx
      .select({ split: runSplits.split, at: runSplits.at })
      .from(runSplits)
      .where(and(eq(runSplits.playerId, playerId), gte(runSplits.at, from), lt(runSplits.at, to)))
      .orderBy(asc(runSplits.at), asc(runSplits.split));
  },

  /** Every NPC's memory of the player (its last few deeds carry their times). */
  async memories(tx: Tx, playerId: string): Promise<JournalMemory[]> {
    return tx
      .select({ npcId: npcMemories.npcId, zoneId: npcMemories.zoneId, deeds: npcMemories.deeds })
      .from(npcMemories)
      .where(eq(npcMemories.playerId, playerId))
      .orderBy(asc(npcMemories.npcId));
  },
};

export type JournalRepo = typeof journalRepo;
