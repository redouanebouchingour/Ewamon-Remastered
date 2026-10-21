/**
 * Nemeses (content nemesis.ts): what a wild battle did that can make its creature rise, the new nemesis and its rank
 * ups, the creature an ambush fights with, and its taunt. Pure: the battle coordinator and the zone room pass the
 * battle state, an rng and content.
 */
import {
  NEMESIS_GAIN,
  NEMESIS_LEVEL_MAX,
  NEMESIS_RANK_GAIN,
  NEMESIS_RANK_MAX,
  nemesisMove,
  nemesisMoves,
  nemesisName,
  nemesisTaunt,
  scarOf,
  zone as zoneById,
} from '@ewa/content';
import type { NemesisMemory, ZoneId } from '@ewa/content';
import type { BattleEvent, BattleOutcome, BattleState, ContentIndex, CreatureInstance, Rng, TypeName } from '@ewa/core';
import type { Nemesis, NewNemesis } from '@ewa/persist';
import { movesAtLevel, newCreature, withSyntheticId } from './creatures';

/** What the wild side did to the player over one wild battle so far (accumulated turn by turn). */
export interface NemesisTrack {
  /** the last of the player's creatures it knocked out, and the move that did it (null: something else) */
  readonly ko: { readonly foeSpecies: string; readonly foeName: string | null; readonly move: string | null } | null;
  /** the last orb it broke out of, and the player's creature facing it then */
  readonly breakout: { readonly foeSpecies: string; readonly foeName: string | null; readonly orb: string } | null;
  /** the hardest blow the player's side landed on it (that move's type) */
  readonly hardest: { readonly amount: number; readonly type: TypeName } | null;
}

export const EMPTY_TRACK: NemesisTrack = Object.freeze({ ko: null, breakout: null, hardest: null });

/** The spawn id of an ambush (`<zone>:nemesis:<n>`, ZoneRoom). */
export function isNemesisSpawn(spawnId: string | null): boolean {
  return spawnId !== null && spawnId.includes(':nemesis:');
}

/** Folds one resolved turn of a wild battle (side 0 the player, side 1 the wild creature) into the track. */
export function trackNemesis(prev: NemesisTrack, before: BattleState, events: readonly BattleEvent[], content: ContentIndex): NemesisTrack {
  let { ko, breakout, hardest } = prev;
  const lastHit = new Map<number, string | null>();
  let orb: string | null = null;
  for (const e of events) {
    if (e.t === 'damage' && e.target.side === 0) {
      lastHit.set(e.target.slot, e.source?.side === 1 && e.cause === 'move' ? e.move : null);
    } else if (e.t === 'damage' && e.target.side === 1 && e.source?.side === 0 && e.cause === 'move' && e.move !== null && e.amount > 0) {
      if (hardest === null || e.amount > hardest.amount) hardest = { amount: e.amount, type: content.move(e.move).type };
    } else if (e.t === 'faint' && e.who.side === 0) {
      const c = before.sides[0].party[e.who.slot]?.creature;
      if (c !== undefined) ko = { foeSpecies: c.speciesId, foeName: c.nickname, move: lastHit.get(e.who.slot) ?? null };
    } else if (e.t === 'catchThrow') {
      orb = e.orb;
    } else if (e.t === 'catchResult' && !e.caught && orb !== null) {
      const side = before.sides[0];
      const c = side.party[side.active]?.creature;
      if (c !== undefined) breakout = { foeSpecies: c.speciesId, foeName: c.nickname, orb };
    }
  }
  return { ko, breakout, hardest };
}

/** How the battle let it get away, or null: it knocked one out or broke out, and was neither caught nor knocked out. */
export function promotionOf(track: NemesisTrack, outcome: BattleOutcome): 'ko' | 'breakout' | null {
  if (outcome.winner === 0 || outcome.winner === 'caught') return null;
  if (track.ko !== null) return 'ko';
  if (track.breakout !== null) return 'breakout';
  return null;
}

/** What it remembers of this fight. */
export function memoryOf(track: NemesisTrack, how: 'ko' | 'breakout', zoneId: string): NemesisMemory {
  if (how === 'ko' && track.ko !== null) return { how, zoneId, foeSpecies: track.ko.foeSpecies, foeName: track.ko.foeName, move: track.ko.move, orb: null };
  const b = track.breakout!;
  return { how: 'breakout', zoneId, foeSpecies: b.foeSpecies, foeName: b.foeName, move: null, orb: b.orb };
}

function gain(rng: Rng, g: { readonly min: number; readonly max: number }): number {
  return g.min + rng.int(g.max - g.min + 1);
}

/** The wild creature rises as the player's nemesis: levels, a move, a name and title, its scar and its memory. */
export function riseNemesis(rng: Rng, content: ContentIndex, wild: CreatureInstance, track: NemesisTrack, how: 'ko' | 'breakout', zoneId: string, ownerId: string, taken: readonly string[]): NewNemesis {
  const sp = content.species(wild.speciesId);
  const level = Math.min(NEMESIS_LEVEL_MAX, wild.level + gain(rng, NEMESIS_GAIN));
  const known = movesAtLevel(content, sp, level).map((m) => m.id);
  const move = nemesisMove(sp, level, known, rng);
  const { name, title } = nemesisName(rng, sp.types, how, taken);
  return {
    ownerId,
    speciesId: sp.id,
    level,
    name,
    title,
    scar: scarOf(how, track.hardest?.type ?? null),
    move,
    ability: wild.ability,
    variantKey: wild.variantKey,
    isShiny: wild.isShiny === true,
    isAlpha: wild.isAlpha,
    bornZone: zoneId,
    memory: memoryOf(track, how, zoneId),
  };
}

/** It beat or escaped the player again: one rank up (to the most), a level or two, the newest memory. */
export function rankUpOf(rng: Rng, n: Nemesis, track: NemesisTrack, how: 'ko' | 'breakout', zoneId: string): { rank: number; level: number; memory: NemesisMemory; zoneId: string } {
  return {
    rank: Math.min(NEMESIS_RANK_MAX, n.rank + 1),
    level: Math.min(NEMESIS_LEVEL_MAX, n.level + gain(rng, NEMESIS_RANK_GAIN)),
    memory: memoryOf(track, how, zoneId),
    zoneId,
  };
}

/** The creature an ambush fights with: its species at `level` (held near the lead), its name, look, ability and gained move. */
export function nemesisCreature(content: ContentIndex, n: Nemesis, level: number, id: string): CreatureInstance {
  const base = newCreature(content, n.speciesId, level, { nickname: n.name, ability: n.ability, variantKey: n.variantKey, isAlpha: n.isAlpha, isShiny: n.isShiny });
  const moves = nemesisMoves(
    base.moves.map((m) => m.id),
    n.move,
  ).map((mid) => {
    const pp = content.move(mid).pp;
    return { id: mid, pp, ppMax: pp };
  });
  return withSyntheticId({ ...base, moves }, id);
}

function safe(f: () => string, fallback: string): string {
  try {
    return f();
  } catch {
    return fallback;
  }
}

/** The ambush's opening line, from the last fight it remembers. */
export function tauntOf(content: ContentIndex, n: Pick<Nemesis, 'name' | 'rank' | 'memory'>): string {
  const m = n.memory;
  const foe = m.foeName ?? safe(() => content.species(m.foeSpecies).name, m.foeSpecies);
  const orb = m.orb === null ? null : safe(() => content.orb(m.orb!).name, m.orb);
  const zone = safe(() => zoneById(m.zoneId as ZoneId).name, m.zoneId);
  return nemesisTaunt(n.name, n.rank, m, { foe, orb, zone });
}

/** Whether a nemesis can come at the player on this medium (the water: a species that swims or flies). */
export function ambushesOn(content: ContentIndex, n: Pick<Nemesis, 'speciesId'>, medium: 'land' | 'water'): boolean {
  if (medium === 'land') return true;
  const types = content.species(n.speciesId).types as readonly TypeName[];
  return types.includes('Water') || types.includes('Flying') || types.includes('Ice');
}
