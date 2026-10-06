import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Tx } from '../db';
import { fail } from '../errors';
import { battleHistory, creatureInstances, tradeHistory } from '../schema/index';
import type { BattleHistoryRow, TradeHistoryRow } from '../schema/index';
import type { BattleFormat, BattleResult, BattleStartSnapshot, ReplayChoice, RewardsSummary, RngState, TradedCreatureSummary } from '../types';
import { clampInt } from '../util';
import { auditRepo } from './audit';
import { creatureRepo } from './creatures';
import { playerRepo } from './players';

export interface NewBattleHistory {
  readonly battleId: string;
  readonly playerId: string;
  readonly opponent: string;
  readonly format: BattleFormat;
  readonly result: BattleResult;
  readonly turns: number;
  readonly ratingDelta: number | null;
  readonly rewards: RewardsSummary;
  readonly seed: RngState;
  readonly actions: [ReplayChoice, ReplayChoice][];
  /** the starting sides for a database-only replay (optional so older callers keep compiling) */
  readonly start?: BattleStartSnapshot | null;
  /** digestBattleState of the final state */
  readonly finalDigest?: string | null;
  readonly happenedAt: Date;
}

export interface NewTradeHistory {
  readonly tradeId: string;
  readonly playerId: string;
  readonly partnerId: string;
  readonly sent: TradedCreatureSummary[];
  readonly received: TradedCreatureSummary[];
  readonly moneySent: number;
  readonly moneyReceived: number;
  readonly completedAt: Date;
}

export interface TradeSide {
  readonly playerId: string;
  /** Creatures this side gives; each must sit in this player's 'trade_escrow' slot kind. */
  readonly creatureIds: readonly string[];
  /** Money this side gives (>= 0). */
  readonly money: number;
}

export const historyRepo = {
  async recordBattle(tx: Tx, row: NewBattleHistory): Promise<void> {
    await tx.insert(battleHistory).values({
      battleId: row.battleId,
      playerId: row.playerId,
      opponent: row.opponent,
      format: row.format,
      result: row.result,
      turns: row.turns,
      ratingDelta: row.ratingDelta,
      rewards: row.rewards,
      seed: row.seed,
      actions: row.actions,
      start: row.start ?? null,
      finalDigest: row.finalDigest ?? null,
      happenedAt: row.happenedAt,
    });
  },

  async recordTrade(tx: Tx, row: NewTradeHistory): Promise<void> {
    await tx.insert(tradeHistory).values({
      tradeId: row.tradeId,
      playerId: row.playerId,
      partnerId: row.partnerId,
      sent: row.sent,
      received: row.received,
      moneySent: row.moneySent,
      moneyReceived: row.moneyReceived,
      completedAt: row.completedAt,
    });
  },

  async battles(tx: Tx, playerId: string, page: number, pageSize: number): Promise<BattleHistoryRow[]> {
    const size = clampInt(pageSize, 1, 50);
    return tx
      .select()
      .from(battleHistory)
      .where(eq(battleHistory.playerId, playerId))
      .orderBy(desc(battleHistory.happenedAt), desc(battleHistory.id))
      .limit(size)
      .offset(Math.max(0, page - 1) * size);
  },

  async battleById(tx: Tx, playerId: string, battleId: string): Promise<BattleHistoryRow | null> {
    const [row] = await tx
      .select()
      .from(battleHistory)
      .where(and(eq(battleHistory.playerId, playerId), eq(battleHistory.battleId, battleId)))
      .limit(1);
    return row ?? null;
  },

  async trades(tx: Tx, playerId: string, page: number, pageSize: number): Promise<TradeHistoryRow[]> {
    const size = clampInt(pageSize, 1, 50);
    return tx
      .select()
      .from(tradeHistory)
      .where(eq(tradeHistory.playerId, playerId))
      .orderBy(desc(tradeHistory.completedAt), desc(tradeHistory.id))
      .limit(size)
      .offset(Math.max(0, page - 1) * size);
  },

  /**
   * Trade completion — one transaction: lock both players (ascending uuid), lock every offered
   * creature, assert each sits in its owner's 'trade_escrow', transferCreature each way ('trade'),
   * addMoney both ways, recordTrade twice, audit. Any failure rolls back everything.
   * Throws NotInEscrow | NotOwner | Locked | InsufficientFunds | InvalidArgument.
   */
  async completeTrade(tx: Tx, tradeId: string, a: TradeSide, b: TradeSide, now: Date): Promise<void> {
    if (a.playerId === b.playerId) fail('InvalidArgument', 'trade with self');
    if (!Number.isInteger(a.money) || !Number.isInteger(b.money) || a.money < 0 || b.money < 0) fail('InvalidArgument', 'money must be a non-negative integer');
    if (a.creatureIds.length === 0 && b.creatureIds.length === 0 && a.money === 0 && b.money === 0) fail('InvalidArgument', 'empty trade');
    await playerRepo.lockMany(tx, [a.playerId, b.playerId]);
    const allIds = [...a.creatureIds, ...b.creatureIds];
    if (new Set(allIds).size !== allIds.length) fail('InvalidArgument', 'duplicate creature in trade');
    // Both players are locked; creatures follow, in ascending uuid order like every other multi-row lock.
    const rows = allIds.length
      ? await tx
          .select()
          .from(creatureInstances)
          .where(inArray(creatureInstances.id, allIds))
          .orderBy(asc(creatureInstances.id))
          .for('update')
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const summarise = (side: TradeSide): TradedCreatureSummary[] =>
      side.creatureIds.map((id) => {
        const r = byId.get(id);
        if (!r) fail('NotFound', `creature ${id}`);
        if (r.ownerId !== side.playerId) fail('NotOwner', `creature ${id}`);
        if (r.slotKind !== 'trade_escrow') fail('NotInEscrow', `creature ${id}`);
        return { id: r.id, speciesId: r.speciesId, level: r.level };
      });
    const aSent = summarise(a);
    const bSent = summarise(b);
    // money first so an InsufficientFunds surfaces before any creature moves (the tx would roll back either way)
    if (a.money > 0) await playerRepo.addMoney(tx, a.playerId, -a.money);
    if (b.money > 0) await playerRepo.addMoney(tx, b.playerId, -b.money);
    if (a.money > 0) await playerRepo.addMoney(tx, b.playerId, a.money);
    if (b.money > 0) await playerRepo.addMoney(tx, a.playerId, b.money);
    for (const id of a.creatureIds) await creatureRepo.transferCreature(tx, id, a.playerId, b.playerId, 'trade', now);
    for (const id of b.creatureIds) await creatureRepo.transferCreature(tx, id, b.playerId, a.playerId, 'trade', now);
    await historyRepo.recordTrade(tx, { tradeId, playerId: a.playerId, partnerId: b.playerId, sent: aSent, received: bSent, moneySent: a.money, moneyReceived: b.money, completedAt: now });
    await historyRepo.recordTrade(tx, { tradeId, playerId: b.playerId, partnerId: a.playerId, sent: bSent, received: aSent, moneySent: b.money, moneyReceived: a.money, completedAt: now });
    await auditRepo.write(tx, { actorId: null, action: 'trade.complete', subject: tradeId, detail: { a: a.playerId, b: b.playerId, aSent: aSent.map((c) => c.id), bSent: bSent.map((c) => c.id), aMoney: a.money, bMoney: b.money } }, now);
  },
};

export type HistoryRepo = typeof historyRepo;
