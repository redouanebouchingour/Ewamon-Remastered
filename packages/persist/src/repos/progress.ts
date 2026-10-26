import { and, asc, eq, inArray, isNotNull, isNull, like, lt, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Tx } from '../db';
import { badges, dexEntries, dexRewards, players, questProgress, storyFlags } from '../schema/index';
import type { PlayerRow } from '../schema/index';
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
  /** Dex research (migration 0025): every entry with its timestamps and counters, by species id */
  readonly entries: Record<string, DexEntryState>;
}

/** One dex entry for the research system. */
export interface DexEntryState {
  readonly seenAt: Date;
  readonly caughtAt: Date | null;
  /** counter id -> count (content `RESEARCH_COUNTERS`, `form:<id>`); absent = 0 */
  readonly counters: Record<string, number>;
  readonly firstSeenZone: string | null;
  readonly viewedAt: Date | null;
}

/** A research counter never goes past this (int4 stays far away). */
export const DEX_COUNTER_MAX = 1_000_000;

/** Positive integer bumps only, keys sorted (a stable statement). */
function cleanBumps(bumps: Readonly<Record<string, number>>): [string, number][] {
  return Object.keys(bumps)
    .sort()
    .flatMap((k): [string, number][] => {
      const n = Math.trunc(bumps[k]!);
      return k.length > 0 && k.length <= 48 && Number.isFinite(n) && n > 0 ? [[k, Math.min(n, DEX_COUNTER_MAX)]] : [];
    });
}

/** `counters` plus the bumps, each capped at DEX_COUNTER_MAX (JS side, for a row read under lock). */
function addCounters(counters: Readonly<Record<string, number>>, bumps: readonly [string, number][]): Record<string, number> {
  const out: Record<string, number> = { ...counters };
  for (const [k, n] of bumps) out[k] = Math.min(DEX_COUNTER_MAX, (out[k] ?? 0) + n);
  return out;
}

/** The SQL `counters || jsonb_build_object(k, least(coalesce(counters->>k, 0) + n, max), ...)`: an atomic bump. */
function bumpSql(bumps: readonly [string, number][]): SQL {
  const parts = bumps.map(([k, n]) => sql`${k}::text, least(coalesce((${dexEntries.counters} ->> ${k}::text)::int, 0) + ${n}::int, ${DEX_COUNTER_MAX}::int)`);
  return sql`${dexEntries.counters} || jsonb_build_object(${sql.join(parts, sql`, `)})`;
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
    const out: { seen: string[]; caught: string[]; variants: Record<string, VariantKey[]>; alpha: string[]; shiny: string[]; entries: Record<string, DexEntryState> } = {
      seen: [],
      caught: [],
      variants: {},
      alpha: [],
      shiny: [],
      entries: {},
    };
    for (const r of rows) {
      out.seen.push(r.speciesId);
      if (r.caughtAt !== null) out.caught.push(r.speciesId);
      if (r.variants.length > 0) out.variants[r.speciesId] = [...r.variants];
      if (r.alphaSeen) out.alpha.push(r.speciesId);
      if (r.shinyCaught) out.shiny.push(r.speciesId);
      out.entries[r.speciesId] = { seenAt: r.seenAt, caughtAt: r.caughtAt, counters: { ...r.counters }, firstSeenZone: r.firstSeenZone, viewedAt: r.viewedAt };
    }
    return out;
  },

  /** Dex research: the counters of these species (a species without an entry is absent). */
  async counters(tx: Tx, playerId: string, speciesIds: readonly string[]): Promise<Record<string, Record<string, number>>> {
    const unique = [...new Set(speciesIds)];
    if (unique.length === 0) return {};
    const rows = await tx
      .select({ speciesId: dexEntries.speciesId, counters: dexEntries.counters })
      .from(dexEntries)
      .where(and(eq(dexEntries.playerId, playerId), inArray(dexEntries.speciesId, unique)));
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) out[r.speciesId] = { ...r.counters };
    return out;
  },

  /** Phase D5: distinct species caught (the `dexCaught` achievement value). */
  async caughtCount(tx: Tx, playerId: string): Promise<number> {
    const rows = await tx.select({ s: dexEntries.speciesId }).from(dexEntries).where(and(eq(dexEntries.playerId, playerId), isNotNull(dexEntries.caughtAt)));
    return rows.length;
  },

  /**
   * An upsert: the entry is created when new, and every call counts one sighting (`counters.seen`) plus `also` (the
   * research counters a sighting can add, e.g. `seenNight`, `seenWater`). `zone`: where it was seen (kept as
   * `first_seen_zone` while none is recorded). Returns true when the species was new to the player's dex (live-ops
   * `newSpeciesSeen`).
   */
  async markSeen(tx: Tx, playerId: string, speciesId: string, now: Date, opts: { readonly zone?: string | null; readonly also?: Readonly<Record<string, number>> } = {}): Promise<boolean> {
    const bumps = cleanBumps({ ...opts.also, seen: 1 });
    const zone = opts.zone === undefined || opts.zone === null ? null : opts.zone.slice(0, 32);
    const res = await tx
      .insert(dexEntries)
      .values({ playerId, speciesId, seenAt: now, counters: addCounters({}, bumps), firstSeenZone: zone })
      .onConflictDoUpdate({
        target: [dexEntries.playerId, dexEntries.speciesId],
        set: { counters: bumpSql(bumps), firstSeenZone: sql`coalesce(${dexEntries.firstSeenZone}, excluded.first_seen_zone)` },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    return res[0]?.inserted === true;
  },

  /**
   * Records a catch; appends the variant when new; flags alpha (and shiny, Phase D4). Dex research: counts the catch
   * (`counters.caught`, plus `variant` for a non-normal variant and `alpha` for an alpha); an entry created here also
   * counts as seen once. Returns whether the species was new to the caught list.
   */
  async markCaught(tx: Tx, playerId: string, speciesId: string, variant: VariantKey, isAlpha: boolean, now: Date, isShiny = false): Promise<{ newSpecies: boolean }> {
    const bumps = cleanBumps({ caught: 1, ...(variant !== 'normal' ? { variant: 1 } : {}), ...(isAlpha ? { alpha: 1 } : {}) });
    const [existing] = await tx
      .select()
      .from(dexEntries)
      .where(and(eq(dexEntries.playerId, playerId), eq(dexEntries.speciesId, speciesId)))
      .for('update');
    if (!existing) {
      await tx.insert(dexEntries).values({ playerId, speciesId, seenAt: now, caughtAt: now, variants: [variant], alphaSeen: isAlpha, shinyCaught: isShiny, counters: addCounters({ seen: 1 }, bumps) });
      return { newSpecies: true };
    }
    const variants = existing.variants.includes(variant) ? existing.variants : [...existing.variants, variant];
    await tx
      .update(dexEntries)
      .set({ caughtAt: existing.caughtAt ?? now, variants, alphaSeen: existing.alphaSeen || isAlpha, shinyCaught: existing.shinyCaught || isShiny, counters: addCounters(existing.counters, bumps) })
      .where(and(eq(dexEntries.playerId, playerId), eq(dexEntries.speciesId, speciesId)));
    return { newSpecies: existing.caughtAt === null };
  },

  /** Dex research: adds `by` to one counter of an existing entry. false when the species has no entry (nothing is created). */
  async bumpCounter(tx: Tx, playerId: string, speciesId: string, counter: string, by = 1): Promise<boolean> {
    return progressRepo.bumpCounters(tx, playerId, speciesId, { [counter]: by });
  },

  /** Dex research: several counters of one existing entry in one statement. false when there is no entry or no bump. */
  async bumpCounters(tx: Tx, playerId: string, speciesId: string, bumps: Readonly<Record<string, number>>): Promise<boolean> {
    const clean = cleanBumps(bumps);
    if (clean.length === 0) return false;
    const res = await tx
      .update(dexEntries)
      .set({ counters: bumpSql(clean) })
      .where(and(eq(dexEntries.playerId, playerId), eq(dexEntries.speciesId, speciesId)))
      .returning({ s: dexEntries.speciesId });
    return res.length > 0;
  },

  /** Dex research: the player opened the entry. false when the species has no entry. */
  async markViewed(tx: Tx, playerId: string, speciesId: string, now: Date): Promise<boolean> {
    const res = await tx
      .update(dexEntries)
      .set({ viewedAt: now })
      .where(and(eq(dexEntries.playerId, playerId), eq(dexEntries.speciesId, speciesId)))
      .returning({ s: dexEntries.speciesId });
    return res.length > 0;
  },

  /** Dex research: claims a completion reward once. true on the first claim, false when it was already claimed. */
  async claimReward(tx: Tx, playerId: string, rewardId: string, now: Date): Promise<boolean> {
    const res = await tx
      .insert(dexRewards)
      .values({ playerId, rewardId, claimedAt: now })
      .onConflictDoNothing({ target: [dexRewards.playerId, dexRewards.rewardId] })
      .returning({ r: dexRewards.rewardId });
    return res.length > 0;
  },

  /** Dex research: the reward ids the player claimed, oldest first. */
  async claimedRewards(tx: Tx, playerId: string): Promise<string[]> {
    const rows = await tx
      .select({ rewardId: dexRewards.rewardId })
      .from(dexRewards)
      .where(eq(dexRewards.playerId, playerId))
      .orderBy(asc(dexRewards.claimedAt), asc(dexRewards.rewardId));
    return rows.map((r) => r.rewardId);
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

  /**
   * Challenge modes (the server's flags, passed in: persist knows no content): the players who hold `flags.mode`,
   * cleared runs first (earliest clear first), then runs still going, then failed ones, each by badges desc, then
   * username; banned excluded.
   */
  async challengeBoard(
    tx: Tx,
    flags: { readonly mode: string; readonly cleared: string; readonly failed: string },
    page: number,
    pageSize: number,
  ): Promise<{ player: PlayerRow; badges: number; state: 'active' | 'cleared' | 'failed' }[]> {
    const size = Math.min(100, Math.max(1, pageSize));
    const badgeCount = sql<number>`(select count(*)::int from ${badges} b where b.player_id = ${players.id})`;
    const clearedAt = sql<Date | null>`(select f.set_at from ${storyFlags} f where f.player_id = ${players.id} and f.flag = ${flags.cleared})`;
    const failed = sql<boolean>`exists (select 1 from ${storyFlags} f where f.player_id = ${players.id} and f.flag = ${flags.failed})`;
    const rows = await tx
      .select({ player: players, badges: badgeCount, clearedAt, failed })
      .from(storyFlags)
      .innerJoin(players, eq(players.id, storyFlags.playerId))
      .where(and(eq(storyFlags.flag, flags.mode), isNull(players.bannedAt)))
      .orderBy(sql`${clearedAt} is null`, sql`${clearedAt} asc`, sql`${failed}`, sql`${badgeCount} desc`, asc(players.usernameLower))
      .limit(size)
      .offset(Math.max(0, page - 1) * size);
    return rows.map((r) => ({ player: r.player, badges: Number(r.badges), state: r.clearedAt !== null ? 'cleared' : r.failed ? 'failed' : 'active' }));
  },
};

export type ProgressRepo = typeof progressRepo;
