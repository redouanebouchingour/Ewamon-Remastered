/**
 * Ghost trainers: when a trainer leaves the world, their party stays behind as a ghost in the zone they left. Other
 * trainers walking that zone's tall grass sometimes meet it (`GHOST_CHANCE` of the encounters, while the owner is
 * offline and their party is near the challenger's level) and fight it as an AI trainer: healed copies, nothing of the
 * owner's creatures is touched. The owner is told how their ghost fared when they come back. A ghost fades after
 * `GHOST_DAYS` days without its owner returning.
 */

/** The share of tall-grass encounters that meet a ghost, where one haunts. */
export const GHOST_CHANCE = 1 / 10;
/** A ghost fades this long after its owner left. */
export const GHOST_DAYS = 7;
/** Only a ghost whose best creature is within this many levels of the challenger's lead appears. */
export const GHOST_LEVEL_SPAN = 12;
/** How many recent ghosts a zone keeps in mind. */
export const GHOSTS_PER_ZONE = 8;

const PREFIX = 'ghost:';

/** A ghost's trainer id (its owner's username: public, unique). */
export function ghostTrainerId(username: string): string {
  return `${PREFIX}${username}`;
}

export function isGhostTrainer(trainerId: string | null | undefined): boolean {
  return typeof trainerId === 'string' && trainerId.startsWith(PREFIX);
}

/** The owner's username behind a ghost trainer id (null for any other trainer). */
export function ghostOwner(trainerId: string): string | null {
  return isGhostTrainer(trainerId) ? trainerId.slice(PREFIX.length) : null;
}

/** The money a win over a ghost pays: like a route trainer of its level. */
export function ghostReward(topLevel: number): number {
  return Math.max(100, Math.round(topLevel) * 40);
}

/** What the owner hears on coming back (null when the ghost fought nobody). */
export function ghostReport(wins: number, losses: number): string | null {
  const fights = wins + losses;
  if (fights === 0) return null;
  const trainers = fights === 1 ? 'a trainer' : `${fights} trainers`;
  const how = wins === fights ? (fights === 1 ? 'and won' : 'and won every time') : losses === fights ? (fights === 1 ? 'and lost' : 'and lost every time') : `: ${wins} won, ${losses} lost`;
  return `While you were away, your ghost fought ${trainers}${how.startsWith(':') ? how : ` ${how}`}.`;
}
