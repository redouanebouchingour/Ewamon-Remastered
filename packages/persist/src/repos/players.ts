import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { tierFor, trainerLevelFor } from '../constants';
import type { Tx } from '../db';
import { fail } from '../errors';
import { badges, creatureInstances, dexEntries, guildMembers, guilds, players } from '../schema/index';
import type { PlayerRow } from '../schema/index';
import type { BadgeId, CreatureInstance, PublicProfile, ZoneId } from '../types';
import { sortIds } from '../util';
import { rowToCreature } from './creatureMap';

export interface NewPlayer {
  readonly username: string;
  readonly email: string;
  /** argon2id hash produced by the server; opaque to persist. */
  readonly passwordHash: string;
}

/** What `toPublic` needs beyond the players row. `publicProfile` gathers these; tests pass them directly. */
export interface PublicExtras {
  readonly badges: readonly BadgeId[];
  readonly guildTag: string | null;
  readonly dexCaughtCount: number;
  readonly showcase: readonly CreatureInstance[];
}

/** §5.3 — the exact key list, in order. Asserted by test. */
export const PUBLIC_PROFILE_KEYS = [
  'id',
  'username',
  'title',
  'motto',
  'body',
  'rating',
  'peakRating',
  'tier',
  'trainerLevel',
  'badges',
  'guildTag',
  'dexCaughtCount',
  'showcase',
  'createdAt',
] as const;

function assertInt(n: number, what: string): void {
  if (!Number.isInteger(n)) fail('InvalidArgument', `${what} must be an integer`);
}

async function mustExist(tx: Tx, id: string): Promise<void> {
  if (!(await playerRepo.byId(tx, id))) fail('NotFound', `player ${id}`);
}

export const playerRepo = {
  async create(tx: Tx, p: NewPlayer, now: Date): Promise<{ id: string }> {
    const usernameLower = p.username.toLowerCase();
    const email = p.email.trim().toLowerCase();
    const clash = await tx
      .select({ usernameLower: players.usernameLower, email: players.email })
      .from(players)
      .where(sql`${players.usernameLower} = ${usernameLower} or ${players.email} = ${email}`);
    if (clash.some((c) => c.usernameLower === usernameLower)) fail('UsernameTaken');
    if (clash.some((c) => c.email === email)) fail('EmailTaken');
    const [row] = await tx
      .insert(players)
      .values({ username: p.username, usernameLower, email, passwordHash: p.passwordHash, createdAt: now, lastSeenAt: now })
      .returning({ id: players.id });
    return { id: row!.id };
  },

  async byId(tx: Tx, id: string): Promise<PlayerRow | null> {
    const [row] = await tx.select().from(players).where(eq(players.id, id)).limit(1);
    return row ?? null;
  },

  async byUsername(tx: Tx, usernameLower: string): Promise<PlayerRow | null> {
    const [row] = await tx.select().from(players).where(eq(players.usernameLower, usernameLower.toLowerCase())).limit(1);
    return row ?? null;
  },

  async byEmail(tx: Tx, email: string): Promise<PlayerRow | null> {
    const [row] = await tx.select().from(players).where(eq(players.email, email.trim().toLowerCase())).limit(1);
    return row ?? null;
  },

  /** SELECT … FOR UPDATE. Every write to money/rating/trainerExp/position/slots goes through a row locked by this. */
  async lock(tx: Tx, id: string): Promise<PlayerRow> {
    const [row] = await tx.select().from(players).where(eq(players.id, id)).for('update');
    if (!row) fail('NotFound', `player ${id}`);
    return row;
  },

  /** Locks several player rows in ascending uuid order (deadlock-free). Returns them keyed by id. */
  async lockMany(tx: Tx, ids: readonly string[]): Promise<Map<string, PlayerRow>> {
    const out = new Map<string, PlayerRow>();
    for (const id of sortIds(ids)) out.set(id, await playerRepo.lock(tx, id));
    return out;
  },

  /** money += delta in one statement guarded by `money + delta >= 0`; throws InsufficientFunds when it would go negative. */
  async addMoney(tx: Tx, id: string, delta: number): Promise<number> {
    assertInt(delta, 'delta');
    const [row] = await tx
      .update(players)
      .set({ money: sql`${players.money} + ${delta}` })
      .where(and(eq(players.id, id), sql`${players.money} + ${delta} >= 0`))
      .returning({ money: players.money });
    if (row) return row.money;
    await mustExist(tx, id);
    return fail('InsufficientFunds');
  },

  async setPosition(tx: Tx, id: string, zoneId: ZoneId, x: number, z: number, angle: number): Promise<void> {
    const res = await tx.update(players).set({ zoneId, x, z, angle }).where(eq(players.id, id)).returning({ id: players.id });
    if (res.length === 0) fail('NotFound', `player ${id}`);
  },

  /** rating floors at 0; peak tracks the new rating; rankedMatches + 1. */
  async applyRating(tx: Tx, id: string, delta: number): Promise<{ rating: number; peakRating: number }> {
    assertInt(delta, 'delta');
    const next = sql`greatest(0, ${players.rating} + ${delta})`;
    const [row] = await tx
      .update(players)
      .set({ rating: next, peakRating: sql`greatest(${players.peakRating}, ${next})`, rankedMatches: sql`${players.rankedMatches} + 1` })
      .where(eq(players.id, id))
      .returning({ rating: players.rating, peakRating: players.peakRating });
    if (!row) fail('NotFound', `player ${id}`);
    return row;
  },

  async addTrainerExp(tx: Tx, id: string, delta: number): Promise<{ trainerExp: number; trainerLevel: number }> {
    assertInt(delta, 'delta');
    if (delta < 0) fail('InvalidArgument', 'trainer exp never decreases');
    const [row] = await tx
      .update(players)
      .set({ trainerExp: sql`${players.trainerExp} + ${delta}` })
      .where(eq(players.id, id))
      .returning({ trainerExp: players.trainerExp });
    if (!row) fail('NotFound', `player ${id}`);
    return { trainerExp: row.trainerExp, trainerLevel: trainerLevelFor(row.trainerExp) };
  },

  async setIdentity(tx: Tx, id: string, identity: { title?: string; motto?: string; body?: string }): Promise<void> {
    const patch: Partial<typeof players.$inferInsert> = {};
    if (identity.title !== undefined) patch.title = identity.title;
    if (identity.motto !== undefined) patch.motto = identity.motto;
    if (identity.body !== undefined) patch.body = identity.body;
    if (Object.keys(patch).length === 0) return;
    const res = await tx.update(players).set(patch).where(eq(players.id, id)).returning({ id: players.id });
    if (res.length === 0) fail('NotFound', `player ${id}`);
  },

  async setPasswordHash(tx: Tx, id: string, passwordHash: string): Promise<void> {
    const res = await tx.update(players).set({ passwordHash }).where(eq(players.id, id)).returning({ id: players.id });
    if (res.length === 0) fail('NotFound', `player ${id}`);
  },

  async touchLastSeen(tx: Tx, id: string, now: Date): Promise<void> {
    await tx.update(players).set({ lastSeenAt: now }).where(eq(players.id, id));
  },

  async ban(tx: Tx, id: string, reason: string, now: Date): Promise<void> {
    const res = await tx
      .update(players)
      .set({ bannedAt: now, banReason: reason })
      .where(and(eq(players.id, id), eq(players.isAdmin, false)))
      .returning({ id: players.id });
    if (res.length === 0) {
      await mustExist(tx, id);
      fail('Forbidden', 'admins cannot be banned');
    }
  },

  async unban(tx: Tx, id: string): Promise<void> {
    const res = await tx.update(players).set({ bannedAt: null, banReason: null }).where(eq(players.id, id)).returning({ id: players.id });
    if (res.length === 0) fail('NotFound', `player ${id}`);
  },

  async leaderboard(tx: Tx, mode: 'rating' | 'trainerLevel', page: number, pageSize: number): Promise<PlayerRow[]> {
    const size = Math.min(100, Math.max(1, pageSize));
    const offset = Math.max(0, page - 1) * size;
    const order = mode === 'rating' ? desc(players.rating) : desc(players.trainerExp);
    return tx.select().from(players).orderBy(order, asc(players.usernameLower)).limit(size).offset(offset);
  },

  /**
   * §5.3 ALLOW-LIST. Built by naming fields, never by spreading or deleting. Adding a column to
   * `players` never leaks it. Pure — everything not on the row arrives in `extras`.
   */
  toPublic(row: PlayerRow, extras: PublicExtras): PublicProfile {
    return {
      id: row.id,
      username: row.username,
      title: row.title,
      motto: row.motto,
      body: row.body,
      rating: row.rating,
      peakRating: row.peakRating,
      tier: tierFor(row.rating).key,
      trainerLevel: trainerLevelFor(row.trainerExp),
      badges: [...extras.badges],
      guildTag: extras.guildTag,
      dexCaughtCount: extras.dexCaughtCount,
      showcase: extras.showcase.slice(0, 3).map((c) => ({ ...c, ownerId: null })),
      createdAt: row.createdAt,
    };
  },

  /** Gathers the extras and calls toPublic. showcase = the first three party slots. */
  async publicProfile(tx: Tx, id: string): Promise<PublicProfile | null> {
    const row = await playerRepo.byId(tx, id);
    if (!row) return null;
    const badgeRows = await tx.select({ badgeId: badges.badgeId }).from(badges).where(eq(badges.playerId, id)).orderBy(asc(badges.earnedAt));
    const guildRows = await tx
      .select({ tag: guilds.tag })
      .from(guildMembers)
      .innerJoin(guilds, eq(guilds.id, guildMembers.guildId))
      .where(eq(guildMembers.playerId, id))
      .limit(1);
    const dexRows = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(dexEntries)
      .where(and(eq(dexEntries.playerId, id), isNotNull(dexEntries.caughtAt)));
    const partyRows = await tx
      .select()
      .from(creatureInstances)
      .where(and(eq(creatureInstances.ownerId, id), eq(creatureInstances.slotKind, 'party')))
      .orderBy(asc(creatureInstances.slotIndex))
      .limit(3);
    return playerRepo.toPublic(row, {
      badges: badgeRows.map((b) => b.badgeId as BadgeId),
      guildTag: guildRows[0]?.tag ?? null,
      dexCaughtCount: Number(dexRows[0]?.n ?? 0),
      showcase: partyRows.map(rowToCreature),
    });
  },
};

export type PlayerRepo = typeof playerRepo;
