import { and, countDistinct, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, max, ne, or, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { bounties, ghostBattles } from '../schema/index';
import type { BountyRow } from '../schema/index';

export type BountyKind = 'game' | 'player' | 'nemesis';
export type BountyStatus = 'open' | 'claimed' | 'expired';

export interface Bounty {
  readonly id: string;
  readonly kind: BountyKind;
  readonly targetId: string | null;
  readonly targetName: string;
  readonly speciesId: string;
  readonly level: number;
  readonly zoneId: string;
  readonly wins: number;
  readonly posterId: string | null;
  readonly posterName: string | null;
  readonly reward: number;
  readonly fee: number;
  readonly status: BountyStatus;
  readonly claimerId: string | null;
  readonly claimerName: string | null;
  readonly payout: number | null;
  readonly bonus: boolean;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly claimedAt: Date | null;
}

/** What a poster on a ghost carries (a game bounty or a player's post). */
export interface NewGhostBounty {
  readonly targetId: string;
  readonly targetName: string;
  readonly speciesId: string;
  readonly level: number;
  readonly zoneId: string;
  readonly wins: number;
  readonly reward: number;
  readonly expiresAt: Date;
}

function toBounty(r: BountyRow): Bounty {
  return {
    id: r.id,
    kind: r.kind as BountyKind,
    targetId: r.targetId,
    targetName: r.targetName,
    speciesId: r.speciesId,
    level: r.level,
    zoneId: r.zoneId,
    wins: r.wins,
    posterId: r.posterId,
    posterName: r.posterName,
    reward: r.reward,
    fee: r.fee,
    status: r.status as BountyStatus,
    claimerId: r.claimerId,
    claimerName: r.claimerName,
    payout: r.payout,
    bonus: r.bonus,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    claimedAt: r.claimedAt,
  };
}

const live = (now: Date) => and(eq(bounties.status, 'open'), gt(bounties.expiresAt, now));

/** The bounty board (migration 0019, content bounties.ts): posters, escrow, claims. Money moves are the caller's. */
export const bountyRepo = {
  /** A trainer's post on a ghost: `reward` + `fee` are already taken from them (in the same transaction). */
  async post(tx: Tx, p: NewGhostBounty & { readonly posterId: string; readonly posterName: string; readonly fee: number }, now: Date): Promise<Bounty> {
    const [row] = await tx
      .insert(bounties)
      .values({ ...p, kind: 'player', status: 'open', createdAt: now })
      .returning();
    return toBounty(row!);
  },

  /** The board's own bounty on a ghost: posted, or (already up) its reward raised, record, zone and fade time renewed. */
  async upsertGame(tx: Tx, p: NewGhostBounty, now: Date): Promise<void> {
    const [cur] = await tx
      .select()
      .from(bounties)
      .where(and(eq(bounties.kind, 'game'), eq(bounties.status, 'open'), eq(bounties.targetId, p.targetId)))
      .limit(1);
    if (cur === undefined) {
      await tx.insert(bounties).values({ ...p, kind: 'game', status: 'open', createdAt: now }).onConflictDoNothing();
      return;
    }
    await tx
      .update(bounties)
      .set({ reward: Math.max(cur.reward, p.reward), wins: Math.max(cur.wins, p.wins), zoneId: p.zoneId, speciesId: p.speciesId, level: p.level, targetName: p.targetName, expiresAt: p.expiresAt })
      .where(eq(bounties.id, cur.id));
  },

  /** Every open poster on the board (game and players' posts), the richest first. */
  async open(tx: Tx, now: Date, limit: number): Promise<Bounty[]> {
    const rows = await tx
      .select()
      .from(bounties)
      .where(and(live(now), ne(bounties.kind, 'nemesis')))
      .orderBy(desc(bounties.reward), desc(bounties.createdAt))
      .limit(Math.min(100, Math.max(1, limit)));
    return rows.map(toBounty);
  },

  /** Which of these ghosts' owners have an open bounty on them now. */
  async wanted(tx: Tx, targetIds: readonly string[], now: Date): Promise<Set<string>> {
    if (targetIds.length === 0) return new Set();
    const rows = await tx
      .selectDistinct({ id: bounties.targetId })
      .from(bounties)
      .where(and(live(now), inArray(bounties.targetId, [...targetIds])));
    return new Set(rows.map((r) => r.id!).filter((x) => x !== null));
  },

  /** A trainer's open posts. */
  async openBy(tx: Tx, posterId: string, now: Date): Promise<Bounty[]> {
    const rows = await tx
      .select()
      .from(bounties)
      .where(and(live(now), eq(bounties.posterId, posterId)))
      .orderBy(desc(bounties.createdAt));
    return rows.map(toBounty);
  },

  /** A trainer's posts of any status, newest first. */
  async postedBy(tx: Tx, posterId: string, limit: number): Promise<Bounty[]> {
    const rows = await tx
      .select()
      .from(bounties)
      .where(eq(bounties.posterId, posterId))
      .orderBy(desc(bounties.createdAt))
      .limit(Math.min(50, Math.max(1, limit)));
    return rows.map(toBounty);
  },

  /** The latest claims on the board (nemesis records are the trainer's own: left out), newest first. */
  async recentClaims(tx: Tx, limit: number): Promise<Bounty[]> {
    const rows = await tx
      .select()
      .from(bounties)
      .where(and(eq(bounties.status, 'claimed'), ne(bounties.kind, 'nemesis')))
      .orderBy(desc(bounties.claimedAt))
      .limit(Math.min(50, Math.max(1, limit)));
    return rows.map(toBounty);
  },

  /** The bounties a trainer brought in (every kind), newest first (camp bases: their trophies). */
  async claimedBy(tx: Tx, claimerId: string, limit: number): Promise<Bounty[]> {
    const rows = await tx
      .select()
      .from(bounties)
      .where(and(eq(bounties.claimerId, claimerId), eq(bounties.status, 'claimed')))
      .orderBy(desc(bounties.claimedAt))
      .limit(Math.min(50, Math.max(1, limit)));
    return rows.map(toBounty);
  },

  /** How many bounties a trainer claimed since `since` (every kind). */
  async claimsSince(tx: Tx, claimerId: string, since: Date): Promise<number> {
    const [r] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(bounties)
      .where(and(eq(bounties.claimerId, claimerId), eq(bounties.status, 'claimed'), gte(bounties.claimedAt, since)));
    return Number(r?.n ?? 0);
  },

  /**
   * The claim: every open bounty on `targetId` the claimer may take (not their own post), the richest first, at most
   * `max`, marked claimed with its payout in one statement guarded by `status = 'open'`: a bounty is claimed once.
   * `payoutOf` gives each one's payout from its reward. Returns the claimed rows.
   */
  async claim(
    tx: Tx,
    p: { readonly targetId: string; readonly claimerId: string; readonly claimerName: string; readonly bonus: boolean; readonly max: number; readonly payoutOf: (reward: number) => number },
    now: Date,
  ): Promise<Bounty[]> {
    if (p.max <= 0) return [];
    const candidates = await tx
      .select({ id: bounties.id, reward: bounties.reward })
      .from(bounties)
      .where(and(live(now), eq(bounties.targetId, p.targetId), or(isNull(bounties.posterId), ne(bounties.posterId, p.claimerId))))
      .orderBy(desc(bounties.reward), bounties.createdAt)
      .limit(p.max);
    const out: Bounty[] = [];
    for (const c of candidates) {
      const [row] = await tx
        .update(bounties)
        .set({ status: 'claimed', claimerId: p.claimerId, claimerName: p.claimerName, payout: p.payoutOf(c.reward), bonus: p.bonus, claimedAt: now })
        .where(and(eq(bounties.id, c.id), eq(bounties.status, 'open')))
        .returning();
      if (row !== undefined) out.push(toBounty(row));
    }
    return out;
  },

  /** A nemesis brought in by its own trainer: the claimed record (it was never on the public board). */
  async recordNemesis(
    tx: Tx,
    p: { readonly targetName: string; readonly speciesId: string; readonly level: number; readonly zoneId: string; readonly rank: number; readonly reward: number; readonly claimerId: string; readonly claimerName: string; readonly payout: number; readonly bonus: boolean },
    now: Date,
  ): Promise<Bounty> {
    const [row] = await tx
      .insert(bounties)
      .values({
        kind: 'nemesis',
        targetName: p.targetName,
        speciesId: p.speciesId,
        level: p.level,
        zoneId: p.zoneId,
        wins: p.rank,
        reward: p.reward,
        status: 'claimed',
        claimerId: p.claimerId,
        claimerName: p.claimerName,
        payout: p.payout,
        bonus: p.bonus,
        createdAt: now,
        expiresAt: now,
        claimedAt: now,
      })
      .returning();
    return toBounty(row!);
  },

  /** Open bounties whose time is up, marked expired in one statement (so each is returned once): the caller refunds. */
  async expireDue(tx: Tx, now: Date): Promise<Bounty[]> {
    const rows = await tx
      .update(bounties)
      .set({ status: 'expired' })
      .where(and(eq(bounties.status, 'open'), lte(bounties.expiresAt, now)))
      .returning();
    return rows.map(toBounty);
  },

  /**
   * The different trainers each ghost beat since `since` and since the last claimed bounty on it (a claim starts its
   * record over), by ghost owner id.
   */
  async ghostWins(tx: Tx, since: Date): Promise<Map<string, number>> {
    const last = tx
      .select({ targetId: bounties.targetId, at: max(bounties.claimedAt).as('last_at') })
      .from(bounties)
      .where(and(eq(bounties.status, 'claimed'), isNotNull(bounties.targetId)))
      .groupBy(bounties.targetId)
      .as('last');
    const rows = await tx
      .select({ ghostId: ghostBattles.ghostId, wins: countDistinct(ghostBattles.challenger) })
      .from(ghostBattles)
      .leftJoin(last, eq(last.targetId, ghostBattles.ghostId))
      .where(and(eq(ghostBattles.won, true), gte(ghostBattles.at, since), or(isNull(last.at), gt(ghostBattles.at, last.at))))
      .groupBy(ghostBattles.ghostId);
    return new Map(rows.map((r) => [r.ghostId, Number(r.wins)]));
  },
};

export type BountyRepo = typeof bountyRepo;
