/**
 * Breeding on the server (the rules are content daycare.ts): the egg two Daycare parents lay, the creature an egg
 * hatches into, and the Daycare view. Pure apart from the seeded shiny roll; every number comes from content / core.
 */
import {
  EGG_CARRY_MAX,
  EGG_MAX,
  EGG_SHINY_ODDS,
  EGG_SHINY_ODDS_SHINY_PARENT,
  HATCH_LEVEL,
  breedRefusal,
  eggAbility,
  eggHonor,
  eggMoves,
  eggSpecies,
  eggSteps,
  eggVariant,
  hatchMoves,
  isBandbornPair,
} from '@ewa/content';
import type { BreedRefusal } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { ContentIndex, CreatureInstance } from '@ewa/core';
import type { Egg, NewEgg } from '@ewa/persist';
import type { DaycareView, EggView } from '@ewa/protocol';
import { movesAtLevel, newCreature } from './creatures';
import type { NewCreature } from './creatures';
import { toInstance } from '../rooms/battleSession';

type Parent = Pick<CreatureInstance, 'speciesId' | 'nickname' | 'moves' | 'honor' | 'variantKey' | 'ability' | 'isShiny'>;

/** A parent's name as the history and the egg keep it: its nickname, else its species' name. */
export function parentName(content: ContentIndex, c: Pick<CreatureInstance, 'speciesId' | 'nickname'>): string {
  return c.nickname ?? content.species(c.speciesId).name;
}

/** Why the pair cannot breed (null when it can, or when fewer than two are left). */
export function pairRefusal(content: ContentIndex, pair: readonly Parent[]): BreedRefusal | null {
  if (pair.length < 2) return null;
  return breedRefusal(content.species(pair[0]!.speciesId), content.species(pair[1]!.speciesId));
}

/** True when the pair can lay an egg. */
export function canBreed(content: ContentIndex, pair: readonly Parent[]): boolean {
  return pair.length === 2 && pairRefusal(content, pair) === null;
}

/** The egg `pair` (in the order they were left) lays for `ownerId` at `nowMs`; the shiny roll is seeded, not stored. */
export function layEgg(content: ContentIndex, ownerId: string, pair: readonly [Parent, Parent], zoneId: string, nowMs: number, worldSeed: string): NewEgg {
  const [a, b] = pair;
  const spA = content.species(a.speciesId);
  const spB = content.species(b.speciesId);
  const hatch = content.species(eggSpecies(spA));
  const odds = a.isShiny === true || b.isShiny === true ? EGG_SHINY_ODDS_SHINY_PARENT : EGG_SHINY_ODDS;
  const rng = createRng(`${worldSeed}:egg:${ownerId}:${nowMs}`);
  return {
    ownerId,
    place: 'party',
    speciesId: hatch.id,
    stepsTotal: eggSteps(hatch),
    honor: eggHonor(a.honor, b.honor),
    variantKey: eggVariant(a.variantKey, b.variantKey),
    ability: eggAbility(hatch, spA, a.ability),
    moves: eggMoves(hatch, [a.moves.map((m) => m.id), b.moves.map((m) => m.id)]),
    isShiny: rng.int(odds) === 0,
    bandborn: isBandbornPair(spA, spB),
    parents: [
      { speciesId: a.speciesId, nickname: a.nickname },
      { speciesId: b.speciesId, nickname: b.nickname },
    ],
    zoneId,
  };
}

/** The creature an egg hatches into (level HATCH_LEVEL, full hp, its level moves with the egg moves). */
export function hatchling(content: ContentIndex, egg: Egg): NewCreature {
  const sp = content.species(egg.speciesId);
  const base = newCreature(content, egg.speciesId, HATCH_LEVEL, {
    ownerId: egg.ownerId,
    ability: egg.ability,
    variantKey: egg.variantKey,
    ...(egg.isShiny ? { isShiny: true } : {}),
  });
  const ids = hatchMoves(
    movesAtLevel(content, sp, HATCH_LEVEL).map((m) => m.id),
    egg.moves.filter((m) => {
      try {
        content.move(m);
        return true;
      } catch (_e) {
        return false;
      }
    }),
  );
  const moves = ids.map((id) => {
    const pp = content.move(id).pp;
    return { id, pp, ppMax: pp };
  });
  return {
    ...base,
    moves,
    ...(egg.honor !== 0 ? { honor: egg.honor } : {}),
    ...(egg.bandborn ? { bandborn: true as const } : {}),
  };
}

export function eggParents(content: ContentIndex, egg: Pick<Egg, 'parents'>): [string, string] {
  const names = egg.parents.map((p) => parentName(content, p));
  return [names[0] ?? '?', names[1] ?? '?'];
}

export function eggView(content: ContentIndex, egg: Egg): EggView {
  return {
    id: egg.id,
    place: egg.place,
    stepsTotal: egg.stepsTotal,
    stepsWalked: egg.stepsWalked,
    bandborn: egg.bandborn,
    parents: eggParents(content, egg),
    zoneId: egg.zoneId,
    laidAt: egg.laidAt.toISOString(),
  };
}

/** The Daycare as the client sees it. */
export function daycareView(content: ContentIndex, zoneId: string, pair: readonly CreatureInstance[], eggAt: Date | null, eggs: readonly Egg[], nowMs: number): DaycareView {
  const refusal = pairRefusal(content, pair);
  const breeds = canBreed(content, pair);
  return {
    zoneId,
    pair: pair.slice(0, 2).map(toInstance) as DaycareView['pair'],
    refusal,
    hatches: breeds ? eggSpecies(content.species(pair[0]!.speciesId)) : null,
    bandborn: breeds && isBandbornPair(content.species(pair[0]!.speciesId), content.species(pair[1]!.speciesId)),
    eggAt: breeds && eggAt !== null ? eggAt.toISOString() : null,
    eggReady: breeds && eggAt !== null && eggAt.getTime() <= nowMs,
    eggs: eggs.slice(0, 64).map((e) => eggView(content, e)),
    carryMax: EGG_CARRY_MAX,
    eggMax: EGG_MAX,
  };
}
