/**
 * Ranked seasons: four weeks each, back to back from the first one (Monday 5 October 2026, 00:00 UTC). The last week of
 * a season is League Finals week: ranked fights between two players in the season's top eight are the Finals and are
 * shown first to anyone watching. When a season ends the server keeps its final standings and every rating moves
 * halfway back to the start (`seasonResetRating`).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Monday 2026-10-05 00:00 UTC, the first day of season 1. */
export const SEASON_ANCHOR_MS = Date.UTC(2026, 9, 5);
export const SEASON_LENGTH_MS = 28 * DAY_MS;
/** League Finals: the season's last seven days. */
export const SEASON_FINALS_MS = 7 * DAY_MS;
/** The players a season ranks as Finalists (and whose meetings in Finals week are the Finals). */
export const SEASON_FINALISTS = 8;
/** Where every rating starts and is pulled back towards at a season's end. */
export const SEASON_BASE_RATING = 1000;

export interface Season {
  /** 1 for the first season; 0 or less before it */
  readonly number: number;
  readonly startsAt: number;
  readonly endsAt: number;
  /** when League Finals week starts */
  readonly finalsAt: number;
}

/** The season running at `atMs`. */
export function seasonAt(atMs: number): Season {
  const index = Math.floor((atMs - SEASON_ANCHOR_MS) / SEASON_LENGTH_MS);
  return seasonByNumber(index + 1);
}

/** Season `n` (1-based) by its number. */
export function seasonByNumber(n: number): Season {
  const startsAt = SEASON_ANCHOR_MS + (n - 1) * SEASON_LENGTH_MS;
  const endsAt = startsAt + SEASON_LENGTH_MS;
  return { number: n, startsAt, endsAt, finalsAt: endsAt - SEASON_FINALS_MS };
}

/** Whether League Finals week is on at `atMs`. */
export function finalsWeek(atMs: number): boolean {
  return atMs >= seasonAt(atMs).finalsAt;
}

/** A rating after a season ends: halfway back to the base, rounded towards it. */
export function seasonResetRating(rating: number): number {
  const d = rating - SEASON_BASE_RATING;
  return SEASON_BASE_RATING + Math.trunc(d / 2);
}

/** The title a final place earns: Champion for the first, Finalist for the top eight, none below. */
export function seasonTitle(rank: number): 'champion' | 'finalist' | null {
  if (rank === 1) return 'champion';
  if (rank >= 1 && rank <= SEASON_FINALISTS) return 'finalist';
  return null;
}
