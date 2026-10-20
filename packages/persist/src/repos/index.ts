import type { Db } from '../db';
import { auditRepo } from './audit';
import type { AuditRepo } from './audit';
import { authRepo } from './auth';
import type { AuthRepo } from './auth';
import { battlePassRepo } from './battlePass';
import type { BattlePassRepo } from './battlePass';
import { creatureRepo } from './creatures';
import { dailyRepo } from './daily';
import { runRepo } from './runs';
import type { RunRepo } from './runs';
import { seasonRepo } from './seasons';
import type { SeasonRepo } from './seasons';
import type { DailyRepo } from './daily';
import type { CreatureRepo } from './creatures';
import { historyRepo } from './history';
import type { HistoryRepo } from './history';
import { inventoryRepo } from './inventory';
import type { InventoryRepo } from './inventory';
import { marketRepo } from './market';
import type { MarketRepo } from './market';
import { playerRepo } from './players';
import type { PlayerRepo } from './players';
import { progressRepo } from './progress';
import type { ProgressRepo } from './progress';
import { socialRepo } from './social';
import type { SocialRepo } from './social';
import { streakRepo } from './streaks';
import type { StreakRepo } from './streaks';

export interface Repos {
  readonly players: PlayerRepo;
  readonly creatures: CreatureRepo;
  readonly inventory: InventoryRepo;
  readonly progress: ProgressRepo;
  readonly market: MarketRepo;
  readonly social: SocialRepo;
  readonly history: HistoryRepo;
  readonly battlePass: BattlePassRepo;
  readonly auth: AuthRepo;
  readonly audit: AuditRepo;
  /** Phase D14: battle tower streaks (migration 0004) */
  readonly streaks: StreakRepo;
  /** the daily challenge (migration 0008) */
  readonly daily: DailyRepo;
  /** verified speedruns: the play clock and the splits (migration 0009) */
  readonly runs: RunRepo;
  /** ranked seasons: closing a season, its final standings, the standings so far (migration 0011) */
  readonly seasons: SeasonRepo;
}

/**
 * §5.2 createRepos. Repositories are stateless: every function takes the transaction handle
 * explicitly and `now` as a parameter, so the same object serves every Db. `db` is accepted for
 * the spec's shape (and returned) so a caller can carry one handle around.
 */
export function createRepos(db: Db): Repos & { readonly db: Db } {
  return {
    db,
    players: playerRepo,
    creatures: creatureRepo,
    inventory: inventoryRepo,
    progress: progressRepo,
    market: marketRepo,
    social: socialRepo,
    history: historyRepo,
    battlePass: battlePassRepo,
    auth: authRepo,
    audit: auditRepo,
    streaks: streakRepo,
    daily: dailyRepo,
    runs: runRepo,
    seasons: seasonRepo,
  };
}

export { auditRepo, authRepo, battlePassRepo, creatureRepo, historyRepo, inventoryRepo, marketRepo, playerRepo, progressRepo, socialRepo, streakRepo };
export type { AuditRepo, AuthRepo, BattlePassRepo, CreatureRepo, HistoryRepo, InventoryRepo, MarketRepo, PlayerRepo, ProgressRepo, SocialRepo, StreakRepo };
export type { StreakBoardRow, StreakState } from './streaks';
export type { AuditEntry } from './audit';
export { hashRefreshToken } from './auth';
export type { EmailTokenRefusal } from './auth';
export { BATTLE_PASS_MAX_LEVEL, BATTLE_PASS_MYTHICAL_LEVEL } from './battlePass';
export type { CreatureRecord } from './creatureMap';
export { creatureToColumns, rowToCreature, rowToRecord } from './creatureMap';
export type { SlotTarget, TransferReason } from './creatures';
export type { NewBattleHistory, NewTradeHistory, TradeSide } from './history';
export { INVENTORY_MAX_QTY } from './inventory';
export { marketFee } from './market';
export type { ClosedListing, NewListing } from './market';
export { PUBLIC_PROFILE_KEYS } from './players';
export type { NewPlayer, PublicExtras } from './players';
export type { DexSummary, QuestObjectiveState } from './progress';
export type { FriendLists } from './social';
export type { SeasonStanding, SeasonWindow } from './seasons';
