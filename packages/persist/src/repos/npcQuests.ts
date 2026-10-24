import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { npcQuests } from '../schema/index';
import type { NpcQuestObjectiveJson, NpcQuestRewardJson, NpcQuestRow } from '../schema/index';

export type NpcQuestStatus = 'offered' | 'active' | 'claimed' | 'declined' | 'abandoned' | 'expired';
const OPEN: NpcQuestStatus[] = ['offered', 'active'];

export interface NpcQuest {
  readonly id: string;
  readonly playerId: string;
  readonly npcId: string;
  readonly zoneId: string;
  readonly seq: number;
  readonly status: NpcQuestStatus;
  readonly objective: NpcQuestObjectiveJson;
  readonly reward: NpcQuestRewardJson;
  readonly target: number;
  readonly progress: number;
  readonly createdAt: Date;
  readonly acceptedAt: Date | null;
  readonly closedAt: Date | null;
}

export interface NewNpcQuest {
  readonly playerId: string;
  readonly npcId: string;
  readonly zoneId: string;
  readonly seq: number;
  readonly objective: NpcQuestObjectiveJson;
  readonly reward: NpcQuestRewardJson;
  readonly target: number;
}

function toQuest(r: NpcQuestRow): NpcQuest {
  return {
    id: r.id,
    playerId: r.playerId,
    npcId: r.npcId,
    zoneId: r.zoneId,
    seq: r.seq,
    status: r.status as NpcQuestStatus,
    objective: r.objective,
    reward: r.reward,
    target: r.target,
    progress: r.progress,
    createdAt: r.createdAt,
    acceptedAt: r.acceptedAt,
    closedAt: r.closedAt,
  };
}

/** NPC side quests (migration 0022): the favours NPCs asked of a player, open and closed. */
export const npcQuestRepo = {
  /** The player's open favours (offered or active), oldest first. */
  async open(tx: Tx, playerId: string): Promise<NpcQuest[]> {
    const rows = await tx
      .select()
      .from(npcQuests)
      .where(and(eq(npcQuests.playerId, playerId), inArray(npcQuests.status, OPEN)))
      .orderBy(npcQuests.createdAt, npcQuests.id);
    return rows.map(toQuest);
  },

  /** One NPC's favours for the player, newest first. */
  async ofNpc(tx: Tx, playerId: string, npcId: string): Promise<NpcQuest[]> {
    const rows = await tx
      .select()
      .from(npcQuests)
      .where(and(eq(npcQuests.playerId, playerId), eq(npcQuests.npcId, npcId)))
      .orderBy(desc(npcQuests.seq));
    return rows.map(toQuest);
  },

  /** The last favours handed in, newest first. */
  async claimed(tx: Tx, playerId: string, limit: number): Promise<NpcQuest[]> {
    const rows = await tx
      .select()
      .from(npcQuests)
      .where(and(eq(npcQuests.playerId, playerId), eq(npcQuests.status, 'claimed')))
      .orderBy(desc(npcQuests.closedAt), desc(npcQuests.id))
      .limit(limit);
    return rows.map(toQuest);
  },

  /** One favour under a row lock (null: none, or another player's). */
  async lock(tx: Tx, playerId: string, id: string): Promise<NpcQuest | null> {
    const [r] = await tx
      .select()
      .from(npcQuests)
      .where(and(eq(npcQuests.id, id), eq(npcQuests.playerId, playerId)))
      .for('update');
    return r === undefined ? null : toQuest(r);
  },

  async offer(tx: Tx, q: NewNpcQuest, now: Date): Promise<NpcQuest> {
    const [r] = await tx
      .insert(npcQuests)
      .values({ ...q, status: 'offered', progress: 0, createdAt: now })
      .returning();
    return toQuest(r!);
  },

  /** Moves a favour on: `active` stamps `accepted_at`, every closing status `closed_at`. */
  async setStatus(tx: Tx, id: string, status: NpcQuestStatus, now: Date): Promise<NpcQuest> {
    const [r] = await tx
      .update(npcQuests)
      .set(status === 'active' ? { status, acceptedAt: now } : status === 'offered' ? { status } : { status, closedAt: now })
      .where(eq(npcQuests.id, id))
      .returning();
    return toQuest(r!);
  },

  async setProgress(tx: Tx, id: string, progress: number): Promise<void> {
    await tx
      .update(npcQuests)
      .set({ progress: sql`least(${progress}, ${npcQuests.target})` })
      .where(eq(npcQuests.id, id));
  },

  /** Offers older than `before` nobody answered lapse (`expired`); returns how many. */
  async expireOffers(tx: Tx, playerId: string, before: Date, now: Date): Promise<number> {
    const rows = await tx
      .update(npcQuests)
      .set({ status: 'expired', closedAt: now })
      .where(and(eq(npcQuests.playerId, playerId), eq(npcQuests.status, 'offered'), lt(npcQuests.createdAt, before)))
      .returning({ id: npcQuests.id });
    return rows.length;
  },
};

export type NpcQuestRepo = typeof npcQuestRepo;
