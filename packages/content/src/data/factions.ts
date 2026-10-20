/**
 * Majin vs Tenjin seasons: each ranked season (seasons.ts) a trainer may side with the Majin (what refuses to be
 * unmade) or the Tenjin (what knows it is held). Once chosen, the side holds for the season. A ranked win, a raid
 * cleared and a mission claimed earn the trainer's side points; the side with more points when the season closes holds
 * the sky over Solenne all the next season, and the Chronicle records it. Nothing here gates the story or changes a
 * battle.
 */

export const FACTIONS = ['majin', 'tenjin'] as const;
export type Faction = (typeof FACTIONS)[number];

export const FACTION_LABELS: Readonly<Record<Faction, { readonly name: string; readonly motto: string; readonly creed: string }>> = Object.freeze({
  majin: {
    name: 'Majin',
    motto: 'Unmade, and refusing.',
    creed: "Sable's lens shows a thing being unmade. The Majin are the ones who look anyway and break open rather than go quietly.",
  },
  tenjin: {
    name: 'Tenjin',
    motto: 'Held, and rising.',
    creed: "Wynn's lens shows a thing that is held. The Tenjin are the ones who trust it and climb, because something keeps them.",
  },
});

/** Points a deed earns the trainer's side. */
export const FACTION_POINTS = { rankedWin: 3, raidClear: 2, mission: 1 } as const;

/** The zone whose sky the last season's winning side holds. */
export const FACTION_SKY_ZONE = 'solenne';

/** The winning side of a season's totals; null on a tie (or nobody earned anything). */
export function factionWinner(points: Readonly<Record<Faction, number>>): Faction | null {
  if (points.majin === points.tenjin) return null;
  return points.majin > points.tenjin ? 'majin' : 'tenjin';
}

/** The Chronicle's entry for a closed season. */
export function chronicleLine(season: number, winner: Faction | null, points: Readonly<Record<Faction, number>>): string {
  if (winner === null) {
    return points.majin === 0
      ? `Season ${season}: no side took the field. The sky over Solenne stayed its own.`
      : `Season ${season}: the Majin and the Tenjin ended level at ${points.majin}. The sky over Solenne stayed its own.`;
  }
  const loser: Faction = winner === 'majin' ? 'tenjin' : 'majin';
  const how =
    winner === 'majin'
      ? 'The capital woke under a red sky that would not clear, and the cathedral bells rang the hours wrong.'
      : 'The capital woke under a gold sky, and for a season nobody in Solenne was in a hurry.';
  return `Season ${season}: the ${FACTION_LABELS[winner].name} held the sky, ${points[winner]} to ${points[loser]}. ${how}`;
}
