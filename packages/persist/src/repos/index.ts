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
import { worldHonorRepo } from './worldHonor';
import type { WorldHonorRepo } from './worldHonor';
import { factionRepo } from './factions';
import type { FactionRepo } from './factions';
import { legendRepo } from './legends';
import type { LegendRepo } from './legends';
import { ghostRepo } from './ghosts';
import type { GhostRepo } from './ghosts';
import { breedingRepo } from './breeding';
import type { BreedingRepo } from './breeding';
import { nemesisRepo } from './nemeses';
import type { NemesisRepo } from './nemeses';
import { ecosystemRepo } from './ecosystem';
import type { EcosystemRepo } from './ecosystem';
import { bountyRepo } from './bounties';
import type { BountyRepo } from './bounties';
import { npcMemoryRepo } from './npcMemory';
import type { NpcMemoryRepo } from './npcMemory';
import { npcQuestRepo } from './npcQuests';
import type { NpcQuestRepo } from './npcQuests';
import { campRepo } from './camps';
import { rivalRepo } from './rivals';
import type { RivalRepo } from './rivals';
import { worldNewsRepo } from './worldNews';
import type { WorldNewsRepo } from './worldNews';
import { journalRepo } from './journal';
import type { JournalRepo } from './journal';
import type { CampRepo } from './camps';
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
  /** honor shapes the world: each zone's season tally of light and shadow (migration 0012) */
  readonly worldHonor: WorldHonorRepo;
  /** Majin vs Tenjin seasons: a trainer's side, its points, the totals (migration 0013) */
  readonly factions: FactionRepo;
  /** one roaming legendary per season: the first catcher of each season's roamer (migration 0014) */
  readonly legends: LegendRepo;
  /** ghost trainers: the party a trainer left with, and its fights (migration 0015) */
  readonly ghosts: GhostRepo;
  /** breeding: the Daycare's egg timer and the eggs a trainer carries or keeps (migration 0016) */
  readonly breeding: BreedingRepo;
  /** nemeses: the wild creatures that beat or escaped a trainer and rose against them (migration 0017) */
  readonly nemeses: NemesisRepo;
  /** a living ecosystem: each zone's weekly catches and knockouts per species (migration 0018) */
  readonly ecosystem: EcosystemRepo;
  /** the bounty board: posters on ghosts and nemeses, escrow and claims (migration 0019) */
  readonly bounties: BountyRepo;
  /** NPC memory: what each NPC remembers of a player, its standing, the deeds a town gossips about (migration 0021) */
  readonly npcMemory: NpcMemoryRepo;
  /** NPC side quests: the favours NPCs asked of a player, open and closed (migration 0022) */
  readonly npcQuests: NpcQuestRepo;
  /** camp bases: the claimed travellers' camps and the raids on them (migration 0020) */
  readonly camps: CampRepo;
  /** a recurring rival: its identity, the record and the last meeting (migration 0023) */
  readonly rivals: RivalRepo;
  /** the rumour board (LLM feature 8): read-only news across players, public names only */
  readonly worldNews: WorldNewsRepo;
  /** the adventure journal (migration 0024): a diary entry per player per UTC day, and the reads behind a day */
  readonly journal: JournalRepo;
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
    worldHonor: worldHonorRepo,
    factions: factionRepo,
    legends: legendRepo,
    ghosts: ghostRepo,
    breeding: breedingRepo,
    nemeses: nemesisRepo,
    ecosystem: ecosystemRepo,
    bounties: bountyRepo,
    npcMemory: npcMemoryRepo,
    npcQuests: npcQuestRepo,
    camps: campRepo,
    rivals: rivalRepo,
    worldNews: worldNewsRepo,
    journal: journalRepo,
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
export type { DexEntryState, DexSummary, QuestObjectiveState } from './progress';
export { DEX_COUNTER_MAX } from './progress';
export type { FriendLists } from './social';
export type { SeasonStanding, SeasonWindow } from './seasons';
export type { ZoneHonor } from './worldHonor';
export type { FactionSide, FactionTotals } from './factions';
export type { SeasonLegend } from './legends';
export type { Ghost, GhostFight } from './ghosts';
export type { Egg, EggPlace, NewEgg } from './breeding';
export type { Nemesis, NemesisStatus, NewNemesis } from './nemeses';
export type { EcoTake } from './ecosystem';
export type { Bounty, BountyKind, BountyStatus, NewGhostBounty } from './bounties';
export { NPC_MEMORY_LIMITS, rollSummary } from './npcMemory';
export type { NpcMemory, NpcMemoryChange } from './npcMemory';
export type { NewNpcQuest, NpcQuest, NpcQuestStatus } from './npcQuests';
export type { Camp, CampRaid, NewCamp } from './camps';
export type { Rival, RivalIdentityRow, RivalMeeting, RivalResult } from './rivals';
export type { NewsBadge, NewsCampTakeover, NewsNemesis, NewsSale, NewsSplit } from './worldNews';
export { JOURNAL_READ_MAX } from './journal';
export type { JournalAudit, JournalBattle, JournalCreatureEvent, JournalEntry, JournalMemory } from './journal';
