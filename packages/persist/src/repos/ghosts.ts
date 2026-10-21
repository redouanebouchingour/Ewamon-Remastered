import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { ghostBattles, ghosts, players } from '../schema/index';
import type { CreatureInstance } from '../types';

export interface Ghost {
  readonly playerId: string;
  readonly name: string;
  readonly zoneId: string;
  readonly party: readonly CreatureInstance[];
  readonly topLevel: number;
  readonly leftAt: Date;
}

export interface GhostFight {
  readonly challenger: string;
  readonly zoneId: string;
  readonly won: boolean;
  readonly at: Date;
}

/** Ghost trainers (migration 0015): the party a trainer left with, and the fights it had while they were away. */
export const ghostRepo = {
  /** The trainer left the world: their party haunts `zoneId` from now (an earlier ghost is replaced). */
  async save(tx: Tx, playerId: string, name: string, zoneId: string, party: readonly CreatureInstance[], now: Date): Promise<void> {
    if (party.length === 0) return;
    const topLevel = Math.max(...party.map((c) => c.level));
    const row = { name, zoneId, party: [...party], topLevel, leftAt: now };
    await tx.insert(ghosts).values({ playerId, ...row }).onConflictDoUpdate({ target: ghosts.playerId, set: row });
  },

  /** The trainer's ghost, or null. */
  async of(tx: Tx, playerId: string): Promise<Ghost | null> {
    const [r] = await tx.select().from(ghosts).where(eq(ghosts.playerId, playerId)).limit(1);
    return r === undefined ? null : { playerId: r.playerId, name: r.name, zoneId: r.zoneId, party: r.party, topLevel: r.topLevel, leftAt: r.leftAt };
  },

  /** The latest ghosts haunting a zone since `since` (banned trainers' ghosts never walk), newest first. */
  async recent(tx: Tx, zoneId: string, since: Date, limit: number): Promise<Ghost[]> {
    const rows = await tx
      .select({ g: ghosts })
      .from(ghosts)
      .innerJoin(players, eq(players.id, ghosts.playerId))
      .where(and(eq(ghosts.zoneId, zoneId), gte(ghosts.leftAt, since), isNull(players.bannedAt)))
      .orderBy(desc(ghosts.leftAt))
      .limit(Math.min(50, Math.max(1, limit)));
    return rows.map(({ g }) => ({ playerId: g.playerId, name: g.name, zoneId: g.zoneId, party: g.party, topLevel: g.topLevel, leftAt: g.leftAt }));
  },

  /** The bounty board: every ghost still haunting since `since` (banned trainers' left out), newest first. */
  async everywhere(tx: Tx, since: Date, limit: number): Promise<Ghost[]> {
    const rows = await tx
      .select({ g: ghosts })
      .from(ghosts)
      .innerJoin(players, eq(players.id, ghosts.playerId))
      .where(and(gte(ghosts.leftAt, since), isNull(players.bannedAt)))
      .orderBy(desc(ghosts.leftAt))
      .limit(Math.min(500, Math.max(1, limit)));
    return rows.map(({ g }) => ({ playerId: g.playerId, name: g.name, zoneId: g.zoneId, party: g.party, topLevel: g.topLevel, leftAt: g.leftAt }));
  },

  /** A fight with a trainer's ghost. */
  async record(tx: Tx, ghostId: string, challenger: string, zoneId: string, won: boolean, now: Date): Promise<void> {
    await tx.insert(ghostBattles).values({ ghostId, challenger, zoneId, won, at: now });
  },

  /** The fights the owner has not been told of; they are marked told. */
  async report(tx: Tx, ghostId: string): Promise<GhostFight[]> {
    const rows = await tx
      .update(ghostBattles)
      .set({ seen: true })
      .where(and(eq(ghostBattles.ghostId, ghostId), eq(ghostBattles.seen, false)))
      .returning({ challenger: ghostBattles.challenger, zoneId: ghostBattles.zoneId, won: ghostBattles.won, at: ghostBattles.at });
    return rows.sort((a, b) => a.at.getTime() - b.at.getTime());
  },

  /** The ghost's latest fights, newest first, and its record. */
  async fights(tx: Tx, ghostId: string, limit: number): Promise<{ fights: GhostFight[]; won: number; lost: number }> {
    const rows = await tx
      .select({ challenger: ghostBattles.challenger, zoneId: ghostBattles.zoneId, won: ghostBattles.won, at: ghostBattles.at })
      .from(ghostBattles)
      .where(eq(ghostBattles.ghostId, ghostId))
      .orderBy(desc(ghostBattles.at))
      .limit(Math.min(50, Math.max(1, limit)));
    const [t] = await tx
      .select({ won: sql<number>`count(*) filter (where ${ghostBattles.won})::int`, lost: sql<number>`count(*) filter (where not ${ghostBattles.won})::int` })
      .from(ghostBattles)
      .where(eq(ghostBattles.ghostId, ghostId));
    return { fights: rows, won: Number(t?.won ?? 0), lost: Number(t?.lost ?? 0) };
  },
};

export type GhostRepo = typeof ghostRepo;
