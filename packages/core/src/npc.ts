/**
 * §2.10 — deterministic NPC policy.
 * Wild: uniform pick among moves with pp > 0. NPC trainer: highest expected damage, rng tiebreak.
 * A side that mustSwitch switches to its lowest-index standing party member. With no usable move and
 * no standing bench, the side forfeits (there is no Struggle in v1) so every battle terminates.
 */
import { damageAmount, damageStop } from './damage';
import type { Action, BattleState, Battler, ContentIndex, MoveDef, Rng } from './types';

function usableMoves(b: Battler): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < b.creature.moves.length; i++) {
    const m = b.creature.moves[i]!;
    if (m.pp > 0 && (b.volatile.choiceLockedMove === null || b.volatile.choiceLockedMove === m.id)) out.push(m.id);
  }
  return out;
}

function firstStanding(state: BattleState, side: 0 | 1): number {
  const s = state.sides[side];
  for (let i = 0; i < s.party.length; i++) {
    if (i !== s.active && s.party[i]!.creature.hp > 0) return i;
  }
  return -1;
}

/** Expected damage with no crit and the mean random factor (92), scaled by accuracy. No rng. */
export function expectedDamage(state: BattleState, side: 0 | 1, move: MoveDef, content: ContentIndex): number {
  const atkSide = state.sides[side];
  const defSide = state.sides[1 - side];
  const attacker = atkSide.party[atkSide.active]!;
  const defender = defSide.party[defSide.active]!;
  const inp = { attacker, defender, weather: state.field.weather.kind };
  const s = damageStop(inp, move, content);
  if (s.stop !== null) return 0;
  const { amount } = damageAmount(inp, move, s.effectiveness, false, 92, content);
  return Math.floor((amount * (move.accuracy ?? 100)) / 100);
}

export function chooseNpcAction(state: BattleState, side: 0 | 1, content: ContentIndex, rng: Rng): Action {
  const s = state.sides[side];
  if (s.mustSwitch) {
    const to = firstStanding(state, side);
    return { kind: 'switch', to: to === -1 ? 0 : to };
  }
  const b = s.party[s.active]!;
  const moves = usableMoves(b);
  if (moves.length === 0) {
    const to = firstStanding(state, side);
    if (to !== -1 && b.volatile.trappedTurns === 0) return { kind: 'switch', to };
    return { kind: 'forfeit' };
  }
  if (s.kind === 'wild') return { kind: 'move', move: rng.pick(moves) };

  let best = -1;
  const bestMoves: string[] = [];
  for (let i = 0; i < moves.length; i++) {
    const id = moves[i]!;
    let md: MoveDef;
    try {
      md = content.move(id);
    } catch (_e) {
      continue;
    }
    const e = expectedDamage(state, side, md, content);
    if (e > best) {
      best = e;
      bestMoves.length = 0;
      bestMoves.push(id);
    } else if (e === best) {
      bestMoves.push(id);
    }
  }
  if (bestMoves.length === 0) return { kind: 'move', move: moves[0]! };
  return { kind: 'move', move: bestMoves.length === 1 ? bestMoves[0]! : rng.pick(bestMoves) };
}
