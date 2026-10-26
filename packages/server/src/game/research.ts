/**
 * Dex research (content research.ts): what a player's counters are worth, and which counters a battle turn moves.
 * Pure, except `withResearch`, which reads the counters around a write in the caller's transaction to report level-ups.
 *
 * The counters are written next to the dex writes that already exist: `markSeen` counts a sighting (plus `seenNight`
 * at night and `seenWater` on water), `markCaught` a catch (plus `variant` and `alpha`), and `bumpCounters` the rest:
 * a foe knocked out (`defeated`), a battle form seen on either side (`form:<id>`), a signature move used on either side
 * (`signature`), an honor-split creature reaching High / Low Honor (`honorHigh` / `honorLow`), an evolution (`evolved`
 * on the species it left, `evolvedInto` on the one it became).
 *
 * The perks: from research level 3 a wild battle's species is easier to catch (`catchBonusFor`, core
 * `BattleState.catchBonus`), and at level 5 its shiny odds double (`RESEARCH_SHINY_ODDS`, rooms/spawnDirector.ts).
 */
import { RESEARCH_HONOR_LINE, formCounter, researchLevelOf, signatureMovesOf } from '@ewa/content';
import type { BattleEvent, BattleState, ContentIndex } from '@ewa/core';
import type { Repos, Tx } from '@ewa/persist';
import type { ResearchLevelUp } from '@ewa/protocol';

/** The research level a species needs for the catch bonus, and the bonus per level from there. */
export const CATCH_BONUS_LEVEL = 3;
export const CATCH_BONUS_BY_LEVEL: Readonly<Record<number, number>> = { 3: 1.25, 4: 1.25, 5: 1.5 };
/** The research level a species needs for the doubled shiny odds. */
export const SHINY_RESEARCH_LEVEL = 5;

/** A species' research level from a player's counters for it (no entry: 0). */
export function researchLevelFor(speciesId: string, counters: Readonly<Record<string, number>> | undefined): number {
  if (counters === undefined) return 0;
  try {
    return researchLevelOf(speciesId, counters);
  } catch (_e) {
    return 0; // a species content no longer knows
  }
}

/** Every entry's research level, by species id. */
export function researchLevels(entries: Readonly<Record<string, { readonly counters: Readonly<Record<string, number>> }>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sp of Object.keys(entries).sort()) out[sp] = researchLevelFor(sp, entries[sp]!.counters);
  return out;
}

/** The catch multiplier at a research level (1 below CATCH_BONUS_LEVEL). */
export function catchBonusFor(level: number): number {
  return CATCH_BONUS_BY_LEVEL[Math.min(5, Math.max(0, Math.trunc(level)))] ?? 1;
}

/** createBattle's `catchBonus` for one wild species at this research level; undefined when there is none. */
export function catchBonusOpt(speciesId: string, level: number): Readonly<Record<string, number>> | undefined {
  const b = catchBonusFor(level);
  return b === 1 ? undefined : { [speciesId]: b };
}

/** The research counters a sighting adds to `seen`. */
export function sightingExtras(s: { readonly night?: boolean; readonly water?: boolean }): Record<string, number> {
  return { ...(s.night === true ? { seenNight: 1 } : {}), ...(s.water === true ? { seenWater: 1 } : {}) };
}

const SIGNATURES = new Map<string, readonly string[]>();
function signaturesOf(content: ContentIndex, speciesId: string): readonly string[] {
  let hit = SIGNATURES.get(speciesId);
  if (hit === undefined) {
    try {
      hit = signatureMovesOf(content.species(speciesId));
    } catch (_e) {
      hit = [];
    }
    SIGNATURES.set(speciesId, hit);
  }
  return hit;
}

type Bumps = Map<string, Record<string, number>>;

function add(out: Bumps, speciesId: string | undefined, counter: string): void {
  if (speciesId === undefined) return;
  const cur = out.get(speciesId) ?? {};
  cur[counter] = (cur[counter] ?? 0) + 1;
  out.set(speciesId, cur);
}

/**
 * The counters one resolved turn moves for the player on `side` (besides the sightings and catches, which `markSeen`
 * and `markCaught` count): each foe knocked out, each battle form and signature move seen on either side, and each of
 * the player's honor-split creatures that crossed the High / Low Honor line. `next` is the state after the turn.
 */
export function battleResearchBumps(events: readonly BattleEvent[], next: BattleState, side: 0 | 1, content: ContentIndex): Bumps {
  const out: Bumps = new Map();
  const speciesAt = (s: 0 | 1, slot: number): string | undefined => next.sides[s].party[slot]?.creature.speciesId;
  for (const ev of events) {
    if (ev.t === 'faint' && ev.who.side !== side) add(out, speciesAt(ev.who.side, ev.who.slot), 'defeated');
    else if (ev.t === 'formChange') add(out, speciesAt(ev.who.side, ev.who.slot), formCounter(ev.form));
    else if (ev.t === 'moveUsed') {
      const sp = speciesAt(ev.who.side, ev.who.slot);
      if (sp !== undefined && signaturesOf(content, sp).includes(ev.move)) add(out, sp, 'signature');
    } else if (ev.t === 'honor' && ev.who.side === side) {
      const before = ev.honorAfter - ev.delta;
      const sp = speciesAt(ev.who.side, ev.who.slot);
      if (ev.honorAfter >= RESEARCH_HONOR_LINE && before < RESEARCH_HONOR_LINE) add(out, sp, 'honorHigh');
      if (ev.honorAfter <= -RESEARCH_HONOR_LINE && before > -RESEARCH_HONOR_LINE) add(out, sp, 'honorLow');
    }
  }
  return out;
}

/** The species whose research level is higher in `after` than in `before`, with the new level (species id order). */
export function researchLevelUps(
  before: Readonly<Record<string, Readonly<Record<string, number>>>>,
  after: Readonly<Record<string, Readonly<Record<string, number>>>>,
): ResearchLevelUp[] {
  const out: ResearchLevelUp[] = [];
  for (const sp of Object.keys(after).sort()) {
    const level = researchLevelFor(sp, after[sp]);
    if (level > researchLevelFor(sp, before[sp])) out.push({ speciesId: sp, level });
  }
  return out;
}

/**
 * Runs `write` (the caller's dex writes for `speciesIds`) between two reads of their counters in the same transaction
 * and reports the research levels it raised.
 */
export async function withResearch<T>(
  repos: Pick<Repos, 'progress'>,
  tx: Tx,
  playerId: string,
  speciesIds: readonly string[],
  write: () => Promise<T>,
): Promise<{ readonly result: T; readonly levelUps: ResearchLevelUp[]; readonly counters: Record<string, Record<string, number>> }> {
  if (speciesIds.length === 0) return { result: await write(), levelUps: [], counters: {} };
  const before = await repos.progress.counters(tx, playerId, speciesIds);
  const result = await write();
  const after = await repos.progress.counters(tx, playerId, speciesIds);
  return { result, levelUps: researchLevelUps(before, after), counters: after };
}
