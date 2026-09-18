import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type { Tx } from '../db';
import { fail } from '../errors';
import { battlePass } from '../schema/index';

export const BATTLE_PASS_MAX_LEVEL = 100;
export const BATTLE_PASS_MYTHICAL_LEVEL = 50;

export const battlePassRepo = {
  async claimedLevels(tx: Tx, playerId: string): Promise<number[]> {
    const rows = await tx.select({ level: battlePass.level }).from(battlePass).where(eq(battlePass.playerId, playerId)).orderBy(asc(battlePass.level));
    return rows.map((r) => r.level);
  },

  /**
   * Records a claim for `level`. false when already claimed. The caller has verified
   * trainerLevelFor(exp) >= level and grants the reward in the same transaction.
   */
  async claim(tx: Tx, playerId: string, level: number, now: Date): Promise<boolean> {
    if (!Number.isInteger(level) || level < 1 || level > BATTLE_PASS_MAX_LEVEL) fail('InvalidArgument', `level 1..${BATTLE_PASS_MAX_LEVEL}`);
    const res = await tx
      .insert(battlePass)
      .values({ playerId, level, claimedAt: now })
      .onConflictDoNothing({ target: [battlePass.playerId, battlePass.level] })
      .returning({ level: battlePass.level });
    return res.length > 0;
  },

  async mythicalChoice(tx: Tx, playerId: string): Promise<string | null> {
    const [row] = await tx
      .select({ choice: battlePass.mythicalChoice })
      .from(battlePass)
      .where(and(eq(battlePass.playerId, playerId), eq(battlePass.level, BATTLE_PASS_MYTHICAL_LEVEL), isNotNull(battlePass.mythicalChoice)))
      .limit(1);
    return row?.choice ?? null;
  },

  /** One-time: sets the level-50 row's mythical choice (creating the row if the level was not yet claimed). Throws AlreadyClaimed. */
  async setMythicalChoice(tx: Tx, playerId: string, species: string, now: Date): Promise<void> {
    const [row] = await tx
      .select({ choice: battlePass.mythicalChoice })
      .from(battlePass)
      .where(and(eq(battlePass.playerId, playerId), eq(battlePass.level, BATTLE_PASS_MYTHICAL_LEVEL)))
      .for('update');
    if (row?.choice) fail('AlreadyClaimed', 'mythical choice already made');
    if (row) {
      await tx
        .update(battlePass)
        .set({ mythicalChoice: species })
        .where(and(eq(battlePass.playerId, playerId), eq(battlePass.level, BATTLE_PASS_MYTHICAL_LEVEL)));
    } else {
      await tx.insert(battlePass).values({ playerId, level: BATTLE_PASS_MYTHICAL_LEVEL, claimedAt: now, mythicalChoice: species });
    }
  },
};

export type BattlePassRepo = typeof battlePassRepo;
