/**
 * Phase D5 — achievements: 30 milestones modelled as `QuestDef { kind: 'achievement', giver: null, requires: [] }`.
 * They ride `QUESTS` (appended last), so the server's one quest code path auto-progresses them and
 * `POST /quests/claim` pays them. No tier requires the previous one: every tier counts from the first event, and
 * the absolute kinds (`dexCaught`, `loginStreak`) also catch up with progress made before they existed.
 * Rewards are small (money + a few consumables); none grants a creature or a flag.
 */
import { BADGE_ORDER } from '../types';
import type { QuestDef, QuestObjective } from '../types';

type Reward = QuestDef['rewards'];
const reward = (money: number, items: Readonly<Record<string, number>> = {}): Reward => ({ money, items, creature: null, flag: null });

function ach(id: string, title: string, summary: string, act: QuestDef['act'], objectives: QuestDef['objectives'], rewards: Reward): QuestDef {
  return { id, kind: 'achievement', title, summary, giver: null, zoneId: 'mirevale', act, requires: [], objectives, rewards };
}

const one = (id: string, label: string, objective: QuestObjective): QuestDef['objectives'] => [{ id, label, objective }];

/** The 9 legendary statics' win/catch flags (content `LEGENDARY_STATICS[].flag`). */
const STATIC_FLAGS: readonly (readonly [string, string])[] = [
  ['leg_raikitsune', 'Raikitsune'],
  ['leg_bankaiser', 'Bankaiser'],
  ['leg_galaxion', 'Galaxion'],
  ['leg_sunjaw', 'Sunjaw'],
  ['leg_glacinid', 'Glacinid'],
  ['leg_voltaura', 'Voltaura'],
  ['leg_zenryu', 'Zenryu'],
  ['leg_voidraxis', 'Voidraxis'],
  ['leg_hyoryu', 'Hyoryu'],
];

/** The 12 league trainers (content `LEAGUE[].id`) with their display names. */
const LEAGUE_IDS: readonly (readonly [string, string])[] = [
  ['verdant_gym', 'Verdant Gym'],
  ['blaze_gym', 'Blaze Gym'],
  ['tidal_gym', 'Tidal Gym'],
  ['volt_gym', 'Volt Gym'],
  ['stone_gym', 'Stone Gym'],
  ['phantom_gym', 'Phantom Gym'],
  ['iron_gym', 'Iron Gym'],
  ['draco_gym', 'Draco Gym'],
  ['veil', 'Warden Veil'],
  ['aurelia', 'Warden Aurelia'],
  ['kirei', 'Warden Kirei'],
  ['zeon', 'Champion Zeon'],
];

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const ACHIEVEMENTS: readonly QuestDef[] = [
  // ---- the record (distinct species caught; absolute) ----
  ach('ach_dex_10', 'Ten on the Page', 'Record 10 species in the dex.', 1, one('dex', 'Record 10 species', { kind: 'dexCaught', count: 10 }), reward(500, { crest_orb: 3 })),
  ach('ach_dex_30', 'A Field Notebook', 'Record 30 species in the dex.', 1, one('dex', 'Record 30 species', { kind: 'dexCaught', count: 30 }), reward(1500, { prism_orb: 3 })),
  ach('ach_dex_60', 'Half a Ledger', 'Record 60 species in the dex.', 2, one('dex', 'Record 60 species', { kind: 'dexCaught', count: 60 }), reward(3000, { prism_orb: 5, superpotion: 3 })),
  ach('ach_dex_90', 'The Long Record', 'Record 90 species in the dex.', 2, one('dex', 'Record 90 species', { kind: 'dexCaught', count: 90 }), reward(5000, { hyper_potion: 3, rarecandy: 1 })),
  // id kept from the 130-species roster (persisted unlocks); the target is the whole dex (138 with the post-legacy additions)
  ach('ach_dex_130', 'Nothing Quietly Lost', 'Record all 138 species in the dex.', 3, one('dex', 'Record all 138 species', { kind: 'dexCaught', count: 138 }), reward(15000, { rarecandy: 3, max_revive: 2 })),
  // ---- catches (every catch counts) ----
  ach('ach_catch_1', 'First Catch', 'Catch your first wild creature.', 1, one('catch', 'Catch 1 creature', { kind: 'catchSpecies', count: 1 }), reward(200, { spark_orb: 5 })),
  ach('ach_catch_10', 'Ten Orbs Thrown True', 'Catch 10 creatures.', 1, one('catch', 'Catch 10 creatures', { kind: 'catchSpecies', count: 10 }), reward(800, { crest_orb: 5 })),
  ach('ach_catch_50', 'Steady Hands', 'Catch 50 creatures.', 2, one('catch', 'Catch 50 creatures', { kind: 'catchSpecies', count: 50 }), reward(2500, { prism_orb: 5 })),
  ach('ach_catch_200', 'The Collector', 'Catch 200 creatures.', 3, one('catch', 'Catch 200 creatures', { kind: 'catchSpecies', count: 200 }), reward(8000, { aether_orb: 1 })),
  ach('ach_alpha_1', 'Bigger Than the Rest', 'Catch an alpha creature.', 1, one('alpha', 'Catch an alpha', { kind: 'catchTier', tier: 'alpha', count: 1 }), reward(1500, { prism_orb: 3 })),
  ach('ach_shiny_1', 'A Rare Light', 'Catch a shiny creature (one in 512 wild spawns).', 2, one('shiny', 'Catch a shiny', { kind: 'catchTier', tier: 'shiny', count: 1 }), reward(5000, { star_piece: 2 })),
  // ---- battles ----
  ach('ach_win_10', 'Finding Your Feet', 'Win 10 battles of any kind.', 1, one('wins', 'Win 10 battles', { kind: 'winBattles', format: 'any', count: 10 }), reward(500, { potion: 5 })),
  ach('ach_win_100', 'Seasoned', 'Win 100 battles of any kind.', 2, one('wins', 'Win 100 battles', { kind: 'winBattles', format: 'any', count: 100 }), reward(4000, { hyper_potion: 5 })),
  ach('ach_win_500', 'Veteran', 'Win 500 battles of any kind.', 3, one('wins', 'Win 500 battles', { kind: 'winBattles', format: 'any', count: 500 }), reward(12000, { max_potion: 5, full_restore: 2 })),
  ach('ach_trainer_50', 'Road Regular', 'Win 50 battles against trainers.', 2, one('trainers', 'Beat 50 trainers', { kind: 'winBattles', format: 'trainer', count: 50 }), reward(3000, { superpotion: 5 })),
  ach('ach_pvp_1', 'Across the Ring', 'Win a battle against another player.', 1, one('pvp', 'Win 1 PvP battle', { kind: 'winBattles', format: 'pvp', count: 1 }), reward(1000, { full_heal: 2 })),
  ach('ach_pvp_25', 'Ranked and Feared', 'Win 25 battles against other players.', 3, one('pvp', 'Win 25 PvP battles', { kind: 'winBattles', format: 'pvp', count: 25 }), reward(6000, { max_revive: 2 })),
  // ---- the league ----
  ach('ach_badges_8', 'Eight Badges', 'Earn all eight gym badges.', 2,
    BADGE_ORDER.map((b) => ({ id: b, label: `${cap(b)} Badge`, objective: { kind: 'earnBadge', badge: b } as const })), reward(8000, { max_potion: 3 })),
  ach('ach_league_all', 'Every Name on the Wall', 'Defeat all twelve league trainers: the eight gym leaders, the three Wardens and the Champion.', 3,
    LEAGUE_IDS.map(([id, name]) => ({ id, label: `Defeat ${name}`, objective: { kind: 'defeatTrainer', trainerId: id } as const })), reward(15000, { full_restore: 3, rarecandy: 2 })),
  ach('ach_champion', 'Champion', 'Defeat Champion Zeon.', 3, one('zeon', 'Beat Champion Zeon', { kind: 'flag', flag: 'champion:zeon:beaten' }), reward(10000, { max_revive: 3 })),
  // ---- the legendaries ----
  ach('ach_statics_all', 'Nine Old Powers', 'Defeat or catch all nine legendary statics.', 3,
    STATIC_FLAGS.map(([flag, name]) => ({ id: flag, label: `Face ${name}`, objective: { kind: 'flag', flag } as const })), reward(20000, { mythos_orb: 1 })),
  // ---- trades, raids ----
  ach('ach_trade_1', 'Fair Exchange', 'Complete a trade with another player.', 1, one('trade', 'Complete 1 trade', { kind: 'completeTrades', count: 1 }), reward(500, { potion: 3 })),
  ach('ach_trade_10', 'Known at the Market Cross', 'Complete 10 trades.', 2, one('trade', 'Complete 10 trades', { kind: 'completeTrades', count: 10 }), reward(3000, { nugget: 1 })),
  ach('ach_trade_50', 'Trade Route', 'Complete 50 trades.', 3, one('trade', 'Complete 50 trades', { kind: 'completeTrades', count: 50 }), reward(8000, { big_nugget: 1 })),
  ach('ach_raid_1', 'Shoulder to Shoulder', 'Clear a raid.', 1, one('raid', 'Clear 1 raid', { kind: 'clearRaids', count: 1 }), reward(1000, { revive: 2 })),
  ach('ach_raid_10', 'Raid Regular', 'Clear 10 raids.', 2, one('raid', 'Clear 10 raids', { kind: 'clearRaids', count: 10 }), reward(5000, { max_revive: 2 })),
  ach('ach_raid_50', 'The Wall That Holds', 'Clear 50 raids.', 3, one('raid', 'Clear 50 raids', { kind: 'clearRaids', count: 50 }), reward(12000, { full_restore: 3 })),
  // ---- login streaks (absolute: the live streak) ----
  ach('ach_streak_7', 'A Week of Mornings', 'Log in seven days in a row.', 1, one('streak', 'Reach a 7-day streak', { kind: 'loginStreak', days: 7 }), reward(1500, { superpotion: 3 })),
  ach('ach_streak_30', 'A Month of Mornings', 'Log in thirty days in a row.', 2, one('streak', 'Reach a 30-day streak', { kind: 'loginStreak', days: 30 }), reward(6000, { rarecandy: 2 })),
  ach('ach_streak_100', 'The Habit', 'Log in a hundred days in a row.', 3, one('streak', 'Reach a 100-day streak', { kind: 'loginStreak', days: 100 }), reward(15000, { rarecandy: 3, star_piece: 2 })),
];

export const ACHIEVEMENT_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((a) => a.id));

/** `kind === 'achievement'` (absent kind = story). */
export function isAchievement(q: Pick<QuestDef, 'kind'>): boolean {
  return q.kind === 'achievement';
}
