import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { rivals } from '../schema/index';
import type { RivalRow, RivalTeamMemberJson } from '../schema/index';

export type RivalResult = 'won' | 'lost' | 'draw';

export interface Rival {
  readonly playerId: string;
  readonly name: string;
  readonly look: string;
  readonly temperament: string;
  /** the root of its starter line */
  readonly signature: string;
  readonly playerWins: number;
  readonly rivalWins: number;
  readonly draws: number;
  readonly meetings: number;
  /** the player's view of the last meeting */
  readonly lastResult: RivalResult | null;
  readonly lastZone: string | null;
  readonly lastMetAt: Date | null;
  readonly lastTeam: readonly RivalTeamMemberJson[];
  readonly lastWords: string | null;
  /** the rival stays away until then (null: never met) */
  readonly nextAt: Date | null;
  readonly createdAt: Date;
}

export interface RivalIdentityRow {
  readonly name: string;
  readonly look: string;
  readonly temperament: string;
  readonly signature: string;
}

export interface RivalMeeting {
  readonly result: RivalResult;
  readonly zoneId: string;
  readonly team: readonly RivalTeamMemberJson[];
  /** the cooldown after this meeting */
  readonly cooldownMs: number;
}

function toRival(r: RivalRow): Rival {
  return {
    playerId: r.playerId,
    name: r.name,
    look: r.look,
    temperament: r.temperament,
    signature: r.signature,
    playerWins: r.playerWins,
    rivalWins: r.rivalWins,
    draws: r.draws,
    meetings: r.meetings,
    lastResult: r.lastResult as RivalResult | null,
    lastZone: r.lastZone,
    lastMetAt: r.lastMetAt,
    lastTeam: r.lastTeam,
    lastWords: r.lastWords,
    nextAt: r.nextAt,
    createdAt: r.createdAt,
  };
}

/** A recurring rival (migration 0023): one per player, its identity as drawn, the record and the last meeting. */
export const rivalRepo = {
  async of(tx: Tx, playerId: string): Promise<Rival | null> {
    const [r] = await tx.select().from(rivals).where(eq(rivals.playerId, playerId)).limit(1);
    return r === undefined ? null : toRival(r);
  },

  /** The player's rival, created with `identity` on first call (a second call keeps the first identity). */
  async ensure(tx: Tx, playerId: string, identity: RivalIdentityRow, now: Date): Promise<Rival> {
    await tx
      .insert(rivals)
      .values({ playerId, ...identity, createdAt: now })
      .onConflictDoNothing();
    const [r] = await tx.select().from(rivals).where(eq(rivals.playerId, playerId)).limit(1);
    if (r === undefined) throw new Error('rival row vanished');
    return toRival(r);
  },

  /** One meeting, under a row lock: the record, the last meeting (its words cleared) and the cooldown. */
  async recordMeeting(tx: Tx, playerId: string, m: RivalMeeting, now: Date): Promise<Rival | null> {
    const [cur] = await tx.select().from(rivals).where(eq(rivals.playerId, playerId)).for('update');
    if (cur === undefined) return null;
    const [r] = await tx
      .update(rivals)
      .set({
        playerWins: m.result === 'won' ? sql`${rivals.playerWins} + 1` : cur.playerWins,
        rivalWins: m.result === 'lost' ? sql`${rivals.rivalWins} + 1` : cur.rivalWins,
        draws: m.result === 'draw' ? sql`${rivals.draws} + 1` : cur.draws,
        meetings: sql`${rivals.meetings} + 1`,
        lastResult: m.result,
        lastZone: m.zoneId,
        lastMetAt: now,
        lastTeam: m.team.map((t) => ({ speciesId: t.speciesId, level: t.level })),
        lastWords: null,
        nextAt: new Date(now.getTime() + m.cooldownMs),
      })
      .where(eq(rivals.playerId, playerId))
      .returning();
    return toRival(r!);
  },

  /**
   * The rival's parting words of the last meeting, once: only while `lastWords` is unset and the meeting is at most
   * `windowMs` old. False when refused.
   */
  async setWords(tx: Tx, playerId: string, words: string, now: Date, windowMs: number): Promise<boolean> {
    const rows = await tx
      .update(rivals)
      .set({ lastWords: words.slice(0, 200) })
      .where(and(eq(rivals.playerId, playerId), isNull(rivals.lastWords), gte(rivals.lastMetAt, new Date(now.getTime() - windowMs))))
      .returning({ playerId: rivals.playerId });
    return rows.length > 0;
  },
};

export type RivalRepo = typeof rivalRepo;
