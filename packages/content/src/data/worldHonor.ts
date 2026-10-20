/**
 * Honor shapes the world: what trainers do in a zone during a ranked season (seasons.ts) is tallied there, and the
 * balance sets the zone's shadow level. Cruel deeds (a player's creature landing a Dark-type move, a wild creature
 * knocked out) add shadow; kind and fair ones (a wild creature caught instead, a trainer or league battle won) add
 * light. Below `SHADOW_MIN_DEEDS` points a zone stays clear. A shadowed zone looks darker, Dark types turn up more
 * often in its grass, and at the highest level Vesperveil turns: its people speak of the Hollowing.
 * Nothing here gates the story: a fully shadowed zone plays exactly as before.
 */

import type { BattleEvent, TypeName } from '@ewa/core';

/** Shadow points per deed. */
export const SHADOW_POINTS = { darkMove: 2, wildKo: 1 } as const;
/** Light points per deed. */
export const LIGHT_POINTS = { caught: 3, duelWon: 3 } as const;
/** Below this many points in all a zone has too little history to judge: level 0. */
export const SHADOW_MIN_DEEDS = 40;
/** The shadow share each level starts at (level 1 at 55 %, ... level 4 at 85 %). */
export const SHADOW_THRESHOLDS: readonly number[] = Object.freeze([0.55, 0.65, 0.75, 0.85]);
export const SHADOW_MAX = 4;
/** How much more often Dark-type species are rolled per shadow level (level 4: three times as often). */
export const SHADOW_DARK_BOOST = 0.5;

export type ShadowLevel = 0 | 1 | 2 | 3 | 4;

export interface Deeds {
  readonly light: number;
  readonly shadow: number;
}

/**
 * The deeds in one resolved turn of a world battle: a player side's creature landing a damaging Dark-type move, a wild
 * creature fainting (a wild battle: `wildSide`), a wild creature caught; and, when `wonBy` is a player side of a
 * trainer, league or PvP battle, the fair win.
 */
export function deedsOf(
  events: readonly BattleEvent[],
  players: readonly (0 | 1)[],
  wildSide: 0 | 1 | null,
  moveType: (moveId: string) => TypeName | null,
  wonBy: 0 | 1 | null,
): Deeds {
  let light = 0;
  let shadow = 0;
  if (players.length === 0) return { light, shadow };
  for (const e of events) {
    if (e.t === 'damage' && e.cause === 'move' && e.amount > 0 && e.source !== null && e.move !== null && players.includes(e.source.side) && moveType(e.move) === 'Dark') shadow += SHADOW_POINTS.darkMove;
    else if (e.t === 'faint' && wildSide !== null && e.who.side === wildSide) shadow += SHADOW_POINTS.wildKo;
    else if (e.t === 'catchResult' && e.caught) light += LIGHT_POINTS.caught;
  }
  if (wonBy !== null && players.includes(wonBy)) light += LIGHT_POINTS.duelWon;
  return { light, shadow };
}

/** The zone's level from its season tally. */
export function shadowLevel(light: number, shadow: number): ShadowLevel {
  const total = light + shadow;
  if (total < SHADOW_MIN_DEEDS || shadow <= 0) return 0;
  const share = shadow / total;
  let level = 0;
  for (let i = 0; i < SHADOW_THRESHOLDS.length; i++) if (share >= SHADOW_THRESHOLDS[i]!) level = i + 1;
  return level as ShadowLevel;
}

/** The weight multiplier of a Dark-type slot in a zone at `level`. */
export function shadowDarkWeight(level: number): number {
  return 1 + SHADOW_DARK_BOOST * Math.max(0, Math.min(SHADOW_MAX, level));
}

/**
 * What a player is told when they find a zone shadowed (on arriving, or when its level rises), or when the shadow
 * lifts; null when there is nothing to say (no shadow, or it only eased).
 */
export function shadowNotice(zoneName: string, level: number, was = 0): string | null {
  if (level <= 0) return was > 0 ? `The shadow over ${zoneName} has lifted.` : null;
  if (level < was) return null;
  if (level >= SHADOW_MAX) return `${zoneName} has fallen under the Hollowing. Catch, spare and win fair to bring the light back.`;
  if (level >= 3) return `A deep shadow lies over ${zoneName}. Too many fights here were won the cruel way.`;
  return `A shadow lies over ${zoneName}. Catch, spare and win fair to lift it.`;
}

/** The town that turns at the highest level. */
export const HOLLOWED_TOWN = 'vesperveil';
/** A pseudo-flag the client adds to its flag set while the zone it stands in is at the highest level (dialogue). */
export const HOLLOWED_FLAG = 'world:hollowed';

/** What Vesperveil's people say while it is hollowed (by npc id); the lines they say otherwise come back with the light. */
export const HOLLOWED_LINES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'vesperveil.medium': [
    'They have stopped arguing. They agree now, all of them, and they agree about you.',
    'Whatever is done out there is heard in here. Every creature struck down and left. Bring the light back, if you can.',
  ],
  'vesperveil.constable': ['Gate stays shut tonight. Not my order. The lanterns will not stay lit past the square.'],
  'vesperveil.lantern_maker': [
    'The lanterns burn black. I did not make them that way. The Hollowing did.',
    'Catch them, spare them, win fair. Each kindness out on the roads lights one again.',
  ],
  'vesperveil.gravetender': ['Something is buried here now. I do not know what. The ground is cold where it went in.'],
});
