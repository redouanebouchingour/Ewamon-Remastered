import { and, asc, eq, inArray, isNotNull, isNull, like, lt } from 'drizzle-orm';
import type { Tx } from '../db';
import { badges, dexEntries, questProgress, storyFlags } from '../schema/index';
import type { BadgeId, VariantKey } from '../types';
import { escapeLike } from '../util';
import { auditRepo } from './audit';

export interface DexSummary {
  readonly seen: string[];
  readonly caught: string[];
  readonly variants: Record<string, VariantKey[]>;
  readonly alpha: string[];
  /** Phase D4: species of which the player caught a shiny */
  readonly shiny: string[];
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
    const out: { seen: string[]; caught: string[]; variants: Record<string, VariantKey[]>; alpha: string[]; shiny: string[] } = { seen: [], caught: [], variants: {}, alpha: [], shiny: [] };
    for (const r of rows) {
      out.seen.push(r.speciesId);
      if (r.caughtAt !== null) out.caught.push(r.speciesId);
      if (r.variants.length > 0) out.variants[r.speciesId] = [...r.variants];
      if (r.alphaSeen) out.alpha.push(r.speciesId);
      if (r.shinyCaught) out.shiny.push(r.speciesId);
    }
    return out;
  },

  /** Phase D5: distinct species caught (the `dexCaught` achievement value). */
  async caughtCount(tx: Tx, playerId: string): Promise<number> {
    const rows = await tx.select({ s: dexEntries.speciesId }).from(dexEntries).where(and(eq(dexEntries.playerId, playerId), isNotNull(dexEntries.caughtAt)));
    return rows.length;
  },

  /** Idempotent. Returns true when the species was new to the player's dex (live-ops `newSpeciesSeen`). */
  async markSeen(tx: Tx, playerId: string, speciesId: string, now: Date): Promise<boolean> {
    const res = await tx
      .insert(dexEntries)
      .values({ playerId, speciesId, seenAt: now })
      .onConflictDoNothing({ target: [dexEntries.playerId, dexEntries.speciesId] })
      .returning({ s: dexEntries.speciesId });
    return res.length > 0;
  },

  /** Records a catch; appends the variant when new; flags alpha (and shiny, Phase D4). Returns whether the species was new to the caught list. */
  async markCaught(tx: Tx, playerId: string, speciesId: string, variant: VariantKey, isAlpha: boolean, now: Date, isShiny = false): Promise<{ newSpecies: boolean }> {
    const [existing] = await tx
      .select()
      .from(dexEntries)
      .where(and(eq(dexEntries.playerId, playerId), eq(dexEntries.speciesId, speciesId)))
      .for('update');
    if (!existing) {
      await tx.insert(dexEntries).values({ playerId, speciesId, seenAt: now, caughtAt: now, variants: [variant], alphaSeen: isAlpha, shinyCaught: isShiny });
      return { newSpecies: true };
    }
    const variants = existing.variants.includes(variant) ? existing.variants : [...existing.variants, variant];
    await tx
      .update(dexEntries)
      .set({ caughtAt: existing.caughtAt ?? now, variants, alphaSeen: existing.alphaSeen || isAlpha, shinyCaught: existing.shinyCaught || isShiny })
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

  /**
   * Claims ONE done, unclaimed objective (server §30.9.1 daily / weekly missions are claimed per mission).
   * false when the objective is missing, not done, or already claimed.
   */
  async claimObjective(tx: Tx, playerId: string, questId: string, objectiveId: string, now: Date): Promise<boolean> {
    const res = await tx
      .update(questProgress)
      .set({ claimedAt: now })
      .where(
        and(
          eq(questProgress.playerId, playerId),
          eq(questProgress.questId, questId),
          eq(questProgress.objectiveId, objectiveId),
          eq(questProgress.done, true),
          isNull(questProgress.claimedAt),
        ),
      )
      .returning({ o: questProgress.objectiveId });
    return res.length > 0;
  },

  /**
   * Live-ops rollover (server §30.9.1): deletes every player's synthetic quest rows `<prefix><key>` whose key
   * sorts before `beforeKey` (day/week keys are ISO-ordered strings). Returns the number of rows removed.
   */
  async pruneSyntheticQuests(tx: Tx, prefix: string, beforeKey: string): Promise<number> {
    const res = await tx
      .delete(questProgress)
      .where(and(like(questProgress.questId, `${escapeLike(prefix)}%`), lt(questProgress.questId, `${prefix}${beforeKey}`)))
      .returning({ q: questProgress.questId });
    return res.length;
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
