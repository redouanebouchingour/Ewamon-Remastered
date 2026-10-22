import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { campRaids, camps } from '../schema/index';
import type { CampRaidRow, CampRow, CampTrophyJson } from '../schema/index';
import type { CreatureInstance } from '../types';

export interface Camp {
  readonly zoneId: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly name: string;
  readonly trophies: readonly CampTrophyJson[];
  readonly guard: readonly CreatureInstance[];
  readonly guardTop: number;
  readonly claimedAt: Date;
  readonly updatedAt: Date;
}

export interface CampRaid {
  readonly id: number;
  readonly zoneId: string;
  readonly ownerId: string;
  readonly raiderId: string;
  readonly raiderName: string;
  readonly won: boolean;
  readonly cut: number;
  readonly tookOver: boolean;
  readonly held: boolean;
  readonly at: Date;
}

export interface NewCamp {
  readonly zoneId: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly name: string;
  readonly guard: readonly CreatureInstance[];
}

function toCamp(r: CampRow): Camp {
  return { zoneId: r.zoneId, ownerId: r.ownerId, ownerName: r.ownerName, name: r.name, trophies: r.trophies, guard: r.guard, guardTop: r.guardTop, claimedAt: r.claimedAt, updatedAt: r.updatedAt };
}

function toRaid(r: CampRaidRow): CampRaid {
  return { id: r.id, zoneId: r.zoneId, ownerId: r.ownerId, raiderId: r.raiderId, raiderName: r.raiderName, won: r.won, cut: r.cut, tookOver: r.tookOver, held: r.held, at: r.at };
}

function topLevel(party: readonly CreatureInstance[]): number {
  return party.length === 0 ? 1 : Math.max(...party.map((c) => c.level));
}

/** Camp bases (migration 0020, content camps.ts): the claimed camps and the raids on them. */
export const campRepo = {
  async of(tx: Tx, zoneId: string): Promise<Camp | null> {
    const [r] = await tx.select().from(camps).where(eq(camps.zoneId, zoneId)).limit(1);
    return r === undefined ? null : toCamp(r);
  },

  async byOwner(tx: Tx, ownerId: string): Promise<Camp | null> {
    const [r] = await tx.select().from(camps).where(eq(camps.ownerId, ownerId)).limit(1);
    return r === undefined ? null : toCamp(r);
  },

  /** Every claimed camp (a handful: one per route), by zone. */
  async all(tx: Tx): Promise<Camp[]> {
    const rows = await tx.select().from(camps).orderBy(asc(camps.zoneId)).limit(64);
    return rows.map(toCamp);
  },

  /** Claims a free camp; false when the camp is held or the owner already holds one (nothing written). */
  async claim(tx: Tx, c: NewCamp, now: Date): Promise<boolean> {
    const rows = await tx
      .insert(camps)
      .values({ zoneId: c.zoneId, ownerId: c.ownerId, ownerName: c.ownerName, name: c.name, trophies: [], guard: [...c.guard], guardTop: topLevel(c.guard), claimedAt: now, updatedAt: now })
      .onConflictDoNothing()
      .returning({ zoneId: camps.zoneId });
    return rows.length === 1;
  },

  /** The owner gives their camp up; the camp it was, or null. */
  async abandon(tx: Tx, ownerId: string): Promise<Camp | null> {
    const [r] = await tx.delete(camps).where(eq(camps.ownerId, ownerId)).returning();
    return r === undefined ? null : toCamp(r);
  },

  /** A new banner name and / or trophies; the camp after, or null when the owner holds none. */
  async edit(tx: Tx, ownerId: string, p: { readonly name?: string; readonly trophies?: readonly CampTrophyJson[] }, now: Date): Promise<Camp | null> {
    const set: Partial<typeof camps.$inferInsert> = { updatedAt: now };
    if (p.name !== undefined) set.name = p.name;
    if (p.trophies !== undefined) set.trophies = [...p.trophies];
    const [r] = await tx.update(camps).set(set).where(eq(camps.ownerId, ownerId)).returning();
    return r === undefined ? null : toCamp(r);
  },

  /** The guard becomes the owner's party as it is now (claim, leaving the world); nothing for an empty party. */
  async setGuard(tx: Tx, ownerId: string, party: readonly CreatureInstance[], now: Date): Promise<boolean> {
    if (party.length === 0) return false;
    const rows = await tx.update(camps).set({ guard: [...party], guardTop: topLevel(party), updatedAt: now }).where(eq(camps.ownerId, ownerId)).returning({ zoneId: camps.zoneId });
    return rows.length === 1;
  },

  /** The camp passes from `fromOwnerId` to a raider (fresh banner, no trophies, their party on guard). */
  async transfer(tx: Tx, zoneId: string, fromOwnerId: string, to: Omit<NewCamp, 'zoneId'>, now: Date): Promise<boolean> {
    const rows = await tx
      .update(camps)
      .set({ ownerId: to.ownerId, ownerName: to.ownerName, name: to.name, trophies: [], guard: [...to.guard], guardTop: topLevel(to.guard), claimedAt: now, updatedAt: now })
      .where(and(eq(camps.zoneId, zoneId), eq(camps.ownerId, fromOwnerId)))
      .returning({ zoneId: camps.zoneId });
    return rows.length === 1;
  },

  async recordRaid(tx: Tx, r: Omit<CampRaid, 'id' | 'at'>, now: Date): Promise<void> {
    await tx.insert(campRaids).values({ ...r, at: now });
  },

  /** Whether the raider won a raid on this camp since `since` (the daily cooldown). */
  async wonSince(tx: Tx, raiderId: string, zoneId: string, since: Date): Promise<boolean> {
    const [r] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(campRaids)
      .where(and(eq(campRaids.raiderId, raiderId), eq(campRaids.zoneId, zoneId), eq(campRaids.won, true), gte(campRaids.at, since)));
    return Number(r?.n ?? 0) > 0;
  },

  /** How often the owner's guard earned their side a point since `since`. */
  async heldSince(tx: Tx, ownerId: string, since: Date): Promise<number> {
    const [r] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(campRaids)
      .where(and(eq(campRaids.ownerId, ownerId), eq(campRaids.held, true), gte(campRaids.at, since)));
    return Number(r?.n ?? 0);
  },

  /** The raids the owner has not been told of, oldest first; they are marked told. */
  async report(tx: Tx, ownerId: string): Promise<CampRaid[]> {
    const rows = await tx
      .update(campRaids)
      .set({ seen: true })
      .where(and(eq(campRaids.ownerId, ownerId), eq(campRaids.seen, false)))
      .returning();
    return rows.map(toRaid).sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
  },

  /** The owner's camp log, newest first. */
  async log(tx: Tx, ownerId: string, limit: number): Promise<CampRaid[]> {
    const rows = await tx
      .select()
      .from(campRaids)
      .where(eq(campRaids.ownerId, ownerId))
      .orderBy(desc(campRaids.at), desc(campRaids.id))
      .limit(Math.min(50, Math.max(1, limit)));
    return rows.map(toRaid);
  },
};

export type CampRepo = typeof campRepo;
