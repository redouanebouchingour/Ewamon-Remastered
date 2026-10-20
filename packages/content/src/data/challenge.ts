/**
 * Challenge modes: Nuzlocke and Hardcore, a per-player run kept in the server's colon-namespaced story flags (no
 * schema change, and the flags already reach the room cache and the client). A run is active from its mode flag until
 * a result flag: `challenge:cleared` (the Champion beaten during the run) or `challenge:failed` (no creature left that
 * has not fallen). While active:
 * - only the first wild encounter in each zone may be caught (`challengeMetFlag(zone)` is set when it starts, fled,
 *   won or lost; a legendary static counts as that zone's encounter too);
 * - a creature that faints has fallen (`FALLEN_RIBBON`): it cannot be healed, revived, withdrawn, traded, listed or
 *   evolved, and never fights again (not even as an arena or tower copy);
 * - Hardcore also refuses bag items in battle (orbs still catch).
 * The mode can change only before the first badge and before anything has fallen. When a run fails, the fallen keep
 * a memorial ribbon instead (`FALLEN_MEMORIAL_RIBBON`, no rule reads it) so the account plays on as normal.
 */
export const CHALLENGE_MODES = ['nuzlocke', 'hardcore'] as const;
export type ChallengeMode = (typeof CHALLENGE_MODES)[number];
export type ChallengeState = 'active' | 'cleared' | 'failed';

export const CHALLENGE_MODE_FLAG: Readonly<Record<ChallengeMode, string>> = Object.freeze({ nuzlocke: 'challenge:nuzlocke', hardcore: 'challenge:hardcore' });
export const CHALLENGE_CLEARED_FLAG = 'challenge:cleared';
export const CHALLENGE_FAILED_FLAG = 'challenge:failed';
export const FALLEN_RIBBON = 'fallen';
export const FALLEN_MEMORIAL_RIBBON = 'fallen_memorial';

/** The flag a zone's first wild encounter of the run sets. */
export function challengeMetFlag(zoneId: string): string {
  return `challenge:met:${zoneId}`;
}

export interface ChallengeStatus {
  readonly mode: ChallengeMode;
  readonly state: ChallengeState;
}

/** The run in a set of flags, or null for a normal game. */
export function challengeOf(flags: Iterable<string>): ChallengeStatus | null {
  const set = flags instanceof Set ? (flags as ReadonlySet<string>) : new Set(flags);
  const mode = CHALLENGE_MODES.find((m) => set.has(CHALLENGE_MODE_FLAG[m])) ?? null;
  if (mode === null) return null;
  const state: ChallengeState = set.has(CHALLENGE_CLEARED_FLAG) ? 'cleared' : set.has(CHALLENGE_FAILED_FLAG) ? 'failed' : 'active';
  return { mode, state };
}

/** The run's rules apply (a mode flag and no result yet). */
export function challengeActive(flags: Iterable<string>): ChallengeMode | null {
  const c = challengeOf(flags);
  return c !== null && c.state === 'active' ? c.mode : null;
}

export function isFallen(c: { readonly ribbons: readonly string[] }): boolean {
  return c.ribbons.includes(FALLEN_RIBBON);
}

export const CHALLENGE_LABELS: Readonly<Record<ChallengeMode, { readonly name: string; readonly rules: string }>> = Object.freeze({
  nuzlocke: { name: 'Nuzlocke', rules: 'Only the first wild Ewamon you meet on each route can be caught. A creature that faints has fallen for good.' },
  hardcore: { name: 'Hardcore', rules: 'The Nuzlocke rules, and no items from the bag in battle (orbs still catch).' },
});
