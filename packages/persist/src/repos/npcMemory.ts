import { and, desc, eq, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { npcMemories } from '../schema/index';
import type { NpcDeedJson, NpcMemoryRow } from '../schema/index';

/** Bounds the repo enforces whatever the caller passes (protocol carries the same numbers). */
export const NPC_MEMORY_LIMITS = { standingMin: -10, standingMax: 10, summaryMax: 400, deedsMax: 5 } as const;

export interface NpcMemory {
  readonly playerId: string;
  readonly npcId: string;
  readonly zoneId: string;
  readonly summary: string;
  readonly standing: number;
  /** oldest first */
  readonly deeds: readonly NpcDeedJson[];
  readonly talks: number;
  readonly updatedAt: Date;
}

/** One change to an NPC's memory of a player. */
export interface NpcMemoryChange {
  readonly zoneId: string;
  /** appended to the summary (older sentences drop off the front past the cap); '' adds nothing */
  readonly note?: string;
  /** added to the standing (clamped to -10..10) */
  readonly delta?: number;
  /** recorded as notable deeds at `now` (the last `deedsMax` are kept) */
  readonly deeds?: readonly string[];
  /** a conversation ended (counts `talks`) */
  readonly talk?: boolean;
}

function toMemory(r: NpcMemoryRow): NpcMemory {
  return { playerId: r.playerId, npcId: r.npcId, zoneId: r.zoneId, summary: r.summary, standing: r.standing, deeds: r.deeds, talks: r.talks, updatedAt: r.updatedAt };
}

const clamp = (n: number): number => Math.max(NPC_MEMORY_LIMITS.standingMin, Math.min(NPC_MEMORY_LIMITS.standingMax, Math.trunc(n)));

/** `old` + `note`, cut from the front at a sentence boundary so the newest part fits `max`. */
export function rollSummary(old: string, note: string, max: number = NPC_MEMORY_LIMITS.summaryMax): string {
  const joined = [old.trim(), note.trim()].filter((s) => s !== '').join(' ');
  if (joined.length <= max) return joined;
  const tail = joined.slice(joined.length - max);
  const cut = tail.search(/(?<=[.!?])\s+\S/);
  return (cut >= 0 ? tail.slice(cut) : tail).trim();
}

/** NPC memory (migration 0021): per player per NPC, a rolling summary, a standing and the recent notable deeds. */
export const npcMemoryRepo = {
  async of(tx: Tx, playerId: string, npcId: string): Promise<NpcMemory | null> {
    const [r] = await tx
      .select()
      .from(npcMemories)
      .where(and(eq(npcMemories.playerId, playerId), eq(npcMemories.npcId, npcId)))
      .limit(1);
    return r === undefined ? null : toMemory(r);
  },

  /** Every NPC of a zone that remembers the player, most recently changed first. */
  async inZone(tx: Tx, playerId: string, zoneId: string): Promise<NpcMemory[]> {
    const rows = await tx
      .select()
      .from(npcMemories)
      .where(and(eq(npcMemories.playerId, playerId), eq(npcMemories.zoneId, zoneId)))
      .orderBy(desc(npcMemories.updatedAt), desc(npcMemories.npcId));
    return rows.map(toMemory);
  },

  /**
   * Applies one change under a row lock (the row is created on first contact) and returns the memory after it. The
   * standing is clamped, the summary rolled, the deeds capped.
   */
  async remember(tx: Tx, playerId: string, npcId: string, change: NpcMemoryChange, now: Date): Promise<NpcMemory> {
    await tx
      .insert(npcMemories)
      .values({ playerId, npcId, zoneId: change.zoneId, updatedAt: now })
      .onConflictDoNothing();
    const [cur] = await tx
      .select()
      .from(npcMemories)
      .where(and(eq(npcMemories.playerId, playerId), eq(npcMemories.npcId, npcId)))
      .for('update');
    if (cur === undefined) throw new Error('npc memory row vanished');
    const deeds = [...cur.deeds, ...(change.deeds ?? []).map((deed) => ({ deed, at: now.toISOString() }))].slice(-NPC_MEMORY_LIMITS.deedsMax);
    const [r] = await tx
      .update(npcMemories)
      .set({
        zoneId: change.zoneId,
        summary: rollSummary(cur.summary, change.note ?? ''),
        standing: clamp(cur.standing + (change.delta ?? 0)),
        deeds,
        talks: change.talk === true ? sql`${npcMemories.talks} + 1` : cur.talks,
        updatedAt: now,
      })
      .where(and(eq(npcMemories.playerId, playerId), eq(npcMemories.npcId, npcId)))
      .returning();
    return toMemory(r!);
  },
};

export type NpcMemoryRepo = typeof npcMemoryRepo;
