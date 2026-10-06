/**
 * The one place the client spells badge ids (§50.1 #13, `test/no-client-badge.test.ts`): a DISPLAY map from a
 * BadgeId the server sent (progressionDelta.badges / GET /me) to its glyph. Nothing here — or anywhere in the
 * client — produces a badge; the list of earned badges only ever comes from the session store.
 */
import { BADGES } from '@ewa/content';
import type { BadgeId } from '@ewa/protocol';
import type { TypeName } from '@ewa/core';

export const BADGE_GLYPH: Readonly<Record<BadgeId, string>> = {
  bloom: '❀',
  ember: '✹',
  current: '≈',
  circuit: 'ϟ',
  fault: '◆',
  wraith: '☾',
  anvil: '⚒',
  ascend: '▲',
};

export interface BadgeDisplay {
  readonly id: BadgeId;
  readonly name: string;
  readonly type: TypeName;
  readonly glyph: string;
}

/** All eight in league order, for the badge case; `earned` comes from the caller (the store). */
export const BADGE_CASE: readonly BadgeDisplay[] = BADGES.map((b) => ({ id: b.id as BadgeId, name: b.name, type: b.type, glyph: BADGE_GLYPH[b.id as BadgeId] ?? '•' }));

/** Phase B7: the display row of a badge the server awarded (the result card), null for an unknown id. */
export function badgeDisplay(id: BadgeId): BadgeDisplay | null {
  return BADGE_CASE.find((b) => b.id === id) ?? null;
}
