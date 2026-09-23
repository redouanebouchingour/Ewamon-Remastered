import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Tx } from '../db';
import { badges, dexEntries, questProgress, storyFlags } from '../schema/index';
import type { BadgeId, VariantKey } from '../types';
import { auditRepo } from './audit';

export interface DexSummary {
  readonly seen: string[];
  readonly caught: string[];
  readonly variants: Record<string, VariantKey[]>;
  readonly alpha: string[];
}

export interface QuestObjectiveState {
  readonly objectiveId: string;
  readonly count: number;
  readonly done: boolean;
  readonly claimedAt: Date | null;
}

export const progressRepo = {
  // ---- badges ------------------------------------------------------------------------------
  async badges(tx: Tx, playerId: string): Promise<BadgeId[]> {
    const rows = await tx.select({ badgeId: badges.badgeId }).from(badges).where(eq(badges.playerId, playerId)).orderBy(asc(badges.earnedAt));
    return rows.map((r) => r.badgeId as BadgeId);
  },

  /** false if already held; audit 'badge.award' on a fresh award. */
  async awardBadge(tx: Tx, playerId: string, badge: BadgeId, now: Date): Promise<boolean> {
    const res = await tx
      .insert(badges)
      .values({ playerId, badgeId: badge, earnedAt: now })
      .onConflictDoNothing({ target: [badges.playerId, badges.badgeId] })
      .returning({ badgeId: badges.badgeId });
    if (res.length === 0) return false;
    await auditRepo.write(tx, { actorId: playerId, action: 'badge.award', subject: badge, detail: {} }, now);
    return true;
  },

  // ---- story flags -------------------------------------------------------------------------
  async flags(tx: Tx, playerId: string): Promise<string[]> {
    const rows = await tx.select({ flag: storyFlags.flag }).from(storyFlags).where(eq(storyFlags.playerId, playerId)).orderBy(asc(storyFlags.setAt), asc(storyFlags.flag));
    return rows.map((r) => r.flag);
  },

  /** When `flag` was set for the player, or null (trainer rematch windows, server §30.4.4). */
  async flagSetAt(tx: Tx, playerId: string, flag: string): Promise<Date | null> {
    const [row] = await tx
      .select({ setAt: storyFlags.setAt })
      .from(storyFlags)
      .where(and(eq(storyFlags.playerId, playerId), eq(storyFlags.flag, flag)))
      .limit(1);
    return row?.setAt ?? null;
  },

  /** Sets every flag (idempotent). Flags are never unset by this call. */
  async setFlags(tx: Tx, playerId: string, flags: readonly string[], now: Date): Promise<void> {
    const unique = [...new Set(flags)];
    if (unique.length === 0) return;
    await tx
      .insert(storyFlags)
      .values(unique.map((flag) => ({ playerId, flag, setAt: now })))
      .onConflictDoNothing({ target: [storyFlags.playerId, storyFlags.flag] });
  },

  async clearFlags(tx: Tx, playerId: string, flags: readonly string[]): Promise<void> {
    if (flags.length === 0) return;
    await tx.delete(storyFlags).where(and(eq(storyFlags.playerId, playerId), inArray(storyFlags.flag, [...flags])));
  },

  // ---- dex -----------------------------------------------------------------------------------
  async dex(tx: Tx, playerId: string): Promise<DexSummary> {
    const rows = await tx.select().from(dexEntries).where(eq(dexEntries.playerId, playerId)).orderBy(asc(dexEntries.speciesId));
    const out: { seen: string[]; caught: string[]; variants: Record<string, VariantKey[]>; alpha: string[] } = { seen: [], caught: [], variants: {}, alpha: [] };
    for (const r of rows) {
      out.seen.push(r.speciesId);
      if (r.caughtAt !== null) out.caught.push(r.speciesId);
      if (r.variants.length > 0) out.variants[r.speciesId] = [...r.variants];
      if (r.alphaSeen) out.alpha.push(r.speciesId);
    }
    return out;
  },

  async markSeen(tx: Tx, playerId: string, speciesId: string, now: Date): Promise<void> {
    await tx
      .insert(dexEntries)
      .values({ playerId, speciesId, seenAt: now })
      .onConflictDoNothing({ target: [dexEntries.playerId, dexEntries.speciesId] });
  },

  /** Records a catch; appends the variant when new; flags alpha. Returns whether the species was new to the caught list. */
  async markCaught(tx: Tx, playerId: string, speciesId: string, variant: VariantKey, isAlpha: boolean, now: Date): Promise<{ newSpecies: boolean }> {
    const [existing] = await tx
      .select()
      .from(dexEntries)
      .where(and(eq(dexEntries.playerId, playerId), eq(dexEntries.speciesId, speciesId)))
      .for('update');
    if (!existing) {
      await tx.insert(dexEntries).values({ playerId, speciesId, seenAt: now, caughtAt: now, variants: [variant], alphaSeen: isAlpha });
      return { newSpecies: true };
    }
    const variants = existing.variants.includes(variant) ? existing.variants : [...existing.variants, variant];
    await tx
      .update(dexEntries)
      .set({ caughtAt: existing.caughtAt ?? now, variants, alphaSeen: existing.alphaSeen || isAlpha })
      .where(and(eq(dexEntries.playerId, playerId), eq(dexEntries.speciesId, speciesId)));
    return { newSpecies: existing.caughtAt === null };
  },

  // ---- quests --------------------------------------------------------------------------------
  async quest(tx: Tx, playerId: string, questId: string): Promise<QuestObjectiveState[]> {
    const rows = await tx
      .select({ objectiveId: questProgress.objectiveId, count: questProgress.count, done: questProgress.done, claimedAt: questProgress.claimedAt })
      .from(questProgress)
      .where(and(eq(questProgress.playerId, playerId), eq(questProgress.questId, questId)))
      .orderBy(asc(questProgress.objectiveId));
    return rows;
  },

  async allQuests(tx: Tx, playerId: string): Promise<Record<string, QuestObjectiveState[]>> {
    const rows = await tx
      .select()
      .from(questProgress)
      .where(eq(questProgress.playerId, playerId))
      .orderBy(asc(questProgress.questId), asc(questProgress.objectiveId));
    const out: Record<string, QuestObjectiveState[]> = {};
    for (const r of rows) (out[r.questId] ??= []).push({ objectiveId: r.objectiveId, count: r.count, done: r.done, claimedAt: r.claimedAt });
    return out;
  },

  /** Upsert of one objective's progress. A claimed objective is never rewound. */
  async advance(tx: Tx, playerId: string, questId: string, objectiveId: string, count: number, done: boolean): Promise<void> {
    await tx
      .insert(questProgress)
      .values({ playerId, questId, objectiveId, count, done })
      .onConflictDoUpdate({
        target: [questProgress.playerId, questProgress.questId, questProgress.objectiveId],
        set: { count, done },
        setWhere: isNull(questProgress.claimedAt),
      });
  },

  /** Marks every done+unclaimed objective claimed. false when any objective is not done or all were already claimed. */
  async claim(tx: Tx, playerId: string, questId: string, now: Date): Promise<boolean> {
    const rows = await tx
      .select({ done: questProgress.done, claimedAt: questProgress.claimedAt })
      .from(questProgress)
      .where(and(eq(questProgress.playerId, playerId), eq(questProgress.questId, questId)))
      .for('update');
    if (rows.length === 0 || rows.some((r) => !r.done)) return false;
    if (rows.every((r) => r.claimedAt !== null)) return false;
    await tx
      .update(questProgress)
      .set({ claimedAt: now })
      .where(and(eq(questProgress.playerId, playerId), eq(questProgress.questId, questId), isNull(questProgress.claimedAt)));
    return true;
  },

  async claimedQuestIds(tx: Tx, playerId: string): Promise<string[]> {
    const rows = await tx
      .selectDistinct({ questId: questProgress.questId })
      .from(questProgress)
      .where(and(eq(questProgress.playerId, playerId), isNotNull(questProgress.claimedAt)))
      .orderBy(asc(questProgress.questId));
    return rows.map((r) => r.questId);
  },
};

export type ProgressRepo = typeof progressRepo;
