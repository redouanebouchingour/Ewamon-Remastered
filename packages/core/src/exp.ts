/** §2.16 — EXP, levels, evolution. */
import { calcMaxHp } from './stats';
import type { ContentIndex, CreatureInstance, Evolution, LevelUpResult, SpeciesDef } from './types';

export const MAX_LEVEL = 100;

/** Total exp required to BE level l. Medium-fast: l^3. */
export function expToLevel(l: number): number {
  return l * l * l;
}

/** Level for a total exp value: the largest l in 1..100 with expToLevel(l) <= exp. */
export function levelForExp(exp: number): number {
  let lvl = 1;
  for (let l = 2; l <= MAX_LEVEL; l++) {
    if (expToLevel(l) <= exp) lvl = l;
    else break;
  }
  return lvl;
}

/** floor(expYield * defeatedLevel / 7), then floor(x * 3 / 2) when the defeated battler belongs to a trainer/league/pvp side. */
export function expGain(defeated: SpeciesDef, defeatedLevel: number, trainerBattle: boolean): number {
  let x = Math.floor((defeated.expYield * defeatedLevel) / 7);
  if (trainerBattle) x = Math.floor((x * 3) / 2);
  return x;
}

/**
 * Resolves the LEVEL evolution target for a creature at its current species, given its ability and honor ledger
 * (`CreatureInstance.honor`, absent = 0). Null when none — and always null for the Phase D3 `item` / `trade` kinds,
 * which no level reaches.
 */
export function evolutionTarget(evolution: Evolution, ability: string, honor = 0): string | null {
  if (evolution === null) return null;
  if (evolution.kind === 'level') return evolution.into;
  if (evolution.kind === 'item' || evolution.kind === 'trade') return null;
  for (let i = 0; i < evolution.branches.length; i++) {
    const br = evolution.branches[i]!;
    if (br.condition === null) return br.into;
    if (br.condition.kind === 'ability' && br.condition.ability === ability) return br.into;
    if (br.condition.kind === 'honor' && honor >= br.condition.atLeast) return br.into;
  }
  return null;
}

export function applyExp(c: CreatureInstance, gained: number, content: ContentIndex): LevelUpResult {
  const sp = content.species(c.speciesId);
  const cap = expToLevel(MAX_LEVEL);
  const newExp = Math.min(cap, c.exp + Math.max(0, Math.floor(gained)));
  const oldLevel = c.level;
  const newLevel = Math.max(oldLevel, levelForExp(newExp));
  const levelsGained: number[] = [];
  for (let l = oldLevel + 1; l <= newLevel; l++) levelsGained.push(l);

  const oldMax = calcMaxHp(sp.baseHp, oldLevel);
  const newMax = calcMaxHp(sp.baseHp, newLevel);
  const hp = c.hp + (newMax - oldMax);

  const known: string[] = c.moves.map((m) => m.id);
  const learnable: { level: number; move: string }[] = [];
  for (let i = 0; i < sp.learnableMoves.length; i++) {
    const e = sp.learnableMoves[i]!;
    if (e.level > oldLevel && e.level <= newLevel && known.indexOf(e.move) === -1) {
      let dup = false;
      for (let j = 0; j < learnable.length; j++) if (learnable[j]!.move === e.move) dup = true;
      if (!dup) learnable.push({ level: e.level, move: e.move });
    }
  }

  let evolveReady: string | null = null;
  if (sp.evolution !== null && (sp.evolution.kind === 'level' || sp.evolution.kind === 'split') && newLevel >= sp.evolution.atLevel) {
    evolveReady = evolutionTarget(sp.evolution, c.ability, c.honor ?? 0);
  }

  return {
    creature: { ...c, level: newLevel, exp: newExp, hp },
    levelsGained,
    learnable,
    evolveReady,
  };
}

/**
 * Phase D3: the species `item` evolves into when the player uses it, or null (no stone evolution, or another
 * stone). Independent of level: a stone works at any level.
 */
export function itemEvolutionTarget(evolution: Evolution, item: string): string | null {
  return evolution !== null && evolution.kind === 'item' && evolution.item === item ? evolution.into : null;
}

/** Phase D3: the species a trade evolves this one into, or null when it has no trade evolution. */
export function tradeEvolutionTarget(evolution: Evolution): string | null {
  return evolution !== null && evolution.kind === 'trade' ? evolution.into : null;
}

/** Every species `evolution` can lead to, whatever the trigger (split branches in order). */
export function evolutionChildren(evolution: Evolution): readonly string[] {
  if (evolution === null) return [];
  if (evolution.kind === 'split') return evolution.branches.map((b) => b.into);
  return [evolution.into];
}

/** Species swap; nickname kept unless it equalled the old species name; moves kept; hp scaled by the new maxHp ratio. */
export function evolve(c: CreatureInstance, into: string, content: ContentIndex): CreatureInstance {
  const oldSp = content.species(c.speciesId);
  const newSp = content.species(into);
  const oldMax = calcMaxHp(oldSp.baseHp, c.level);
  const newMax = calcMaxHp(newSp.baseHp, c.level);
  let hp = Math.floor((c.hp * newMax) / oldMax);
  if (c.hp > 0 && hp < 1) hp = 1;
  if (hp > newMax) hp = newMax;
  const nickname = c.nickname === oldSp.name ? null : c.nickname;
  const ability = newSp.abilities.indexOf(c.ability) === -1 ? newSp.abilities[0]! : c.ability;
  return { ...c, speciesId: into, nickname, hp, ability };
}
