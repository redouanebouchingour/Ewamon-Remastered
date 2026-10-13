/**
 * story-bible.md §11 — the flags registry, embedded as data. Every non-badge flag a beat needs/sets, a quest
 * grants, a static sets, a league row sets, or an NpcDef gates on must be listed here; validate.ts asserts
 * `flags ⊆ FLAG_REGISTRY ∪ badge sugar`. Naming rule (§11.4): snake_case, no zone prefix; colon-namespaced
 * flags are the server's.
 */
import type { BadgeId, ZoneId } from './types';
import { BADGE_ORDER, ZONE_ORDER } from './types';

export interface FlagEntry {
  readonly id: string;
  /** who sets it: a beat id, a quest id, a static species, a league id, or 'server' */
  readonly setBy: string;
}

export const FLAG_REGISTRY: readonly FlagEntry[] = [
  // beats (§5.2)
  { id: 'met_wynn', setBy: 'first_witness' },
  { id: 'met_sable', setBy: 'mire_rival' },
  { id: 'saw_thinning', setBy: 'grove_stone' },
  { id: 'bloom_spoken', setBy: 'bloom_after' },
  { id: 'saw_assessment', setBy: 'first_harvest' },
  { id: 'heard_grey_year', setBy: 'forge_gratitude' },
  { id: 'sable_livery', setBy: 'sable_livery' },
  { id: 'saw_old_harbour', setBy: 'drowned_harbour' },
  { id: 'act1_done', setBy: 'current_after' },
  { id: 'saw_grid_draw', setBy: 'grid_numbers' },
  { id: 'saw_forgetting', setBy: 'the_lineman' },
  { id: 'sable_refused', setBy: 'sable_refuses' },
  { id: 'saw_seam', setBy: 'the_seam' },
  { id: 'read_lease', setBy: 'fault_after' },
  { id: 'grove_harvested', setBy: 'grove_gone' },
  { id: 'observatory_open', setBy: 'wraith_after' },
  { id: 'saw_holding', setBy: 'the_holding' },
  { id: 'ledger_read', setBy: 'the_ledger' },
  { id: 'sable_turned', setBy: 'sables_turn' },
  { id: 'escorted_out', setBy: 'escorted_out' },
  { id: 'saw_requisition', setBy: 'the_requisition' },
  { id: 'siege_held', setBy: 'siege_of_forgewall' },
  { id: 'act2_done', setBy: 'sable_beside' },
  { id: 'saw_star_counts', setBy: 'star_counts' },
  { id: 'shrine_seen', setBy: 'shrine_of_first_night' },
  { id: 'act3_started', setBy: 'permanence_notice' },
  { id: 'grove_reremembered', setBy: 'restore_the_grove' },
  { id: 'spire_confronted', setBy: 'spire_withdrawal' },
  { id: 'saw_capital_thinning', setBy: 'capital_thinning' },
  { id: 'wardens_met', setBy: 'wardens_charge' },
  { id: 'name_held', setBy: 'name_restored' },
  { id: 'new_column', setBy: 'the_new_column' },
  { id: 'rift_seen', setBy: 'rift_edge' },
  // quests (roster-coverage §12.1 rewards.flag)
  { id: 'harbour_witness', setBy: 'q04_drowned_harbour' },
  { id: 'grove_restored', setBy: 'q10_restore_the_grove' },
  { id: 'mythical_night', setBy: 'q11_first_night' },
  { id: 'mythical_morning', setBy: 'q12_first_morning' },
  // server + league setsFlags
  { id: 'champion:zeon:beaten', setBy: 'zeon' },
  { id: 'elite:veil:beaten', setBy: 'veil' },
  { id: 'elite:aurelia:beaten', setBy: 'aurelia' },
  { id: 'elite:kirei:beaten', setBy: 'kirei' },
  // legendary statics (LegendaryStatic.flag, on win or catch)
  { id: 'leg_raikitsune', setBy: 'raikitsune' },
  { id: 'leg_bankaiser', setBy: 'bankaiser' },
  { id: 'leg_galaxion', setBy: 'galaxion' },
  { id: 'leg_sunjaw', setBy: 'sunjaw' },
  { id: 'leg_glacinid', setBy: 'glacinid' },
  { id: 'leg_voltaura', setBy: 'voltaura' },
  { id: 'leg_zenryu', setBy: 'zenryu' },
  { id: 'leg_voidraxis', setBy: 'voidraxis' },
  { id: 'leg_hyoryu', setBy: 'hyoryu' },
];

export const FLAG_IDS: ReadonlySet<string> = new Set(FLAG_REGISTRY.map((f) => f.id));

/** `badge:<BadgeId>` sugar (§3.5); the server materialises badges as flags with this spelling. */
export function badgeFlag(badge: BadgeId): string {
  return `badge:${badge}`;
}

export const BADGE_FLAGS: ReadonlySet<string> = new Set(BADGE_ORDER.map(badgeFlag));

/**
 * Phase C3: `visited:<ZoneId>` — the server writes it the first time a player joins a zone (fresh join or handover
 * arrival). The world map reads it; fast travel only goes to visited towns. Server-set, like every colon flag.
 */
export const VISITED_PREFIX = 'visited:';
export function visitedFlag(zoneId: ZoneId): string {
  return `${VISITED_PREFIX}${zoneId}`;
}
export const VISITED_FLAGS: ReadonlySet<string> = new Set(ZONE_ORDER.map(visitedFlag));

/** True for a registered flag, a badge sugar flag or a `visited:<zone>` flag. */
export function isKnownFlag(flag: string): boolean {
  return FLAG_IDS.has(flag) || BADGE_FLAGS.has(flag) || VISITED_FLAGS.has(flag);
}
