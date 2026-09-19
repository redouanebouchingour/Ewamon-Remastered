/**
 * §2.10 — deterministic NPC policy.
 * Wild: uniform pick among moves with pp > 0. NPC trainer: highest expected damage, rng tiebreak.
 * A side that mustSwitch switches to its lowest-index standing party member. With no usable move and
 * no standing bench, the side flees when it may (`canFlee`) and forfeits otherwise (there is no Struggle
 * in v1), so every battle terminates. Every action returned passes validateAction.
 */
import { damageAmount, damageStop } from './damage';
import { blocksStatusMoves, heldHooks } from './items';
import { otherSide } from './side';
import type { Action, BattleState, Battler, ContentIndex, MoveDef, Rng } from './types';

/** Moves the battler may legally select: pp > 0, not choice-locked to another move, not a status move under Assault Vest. */
function usableMoves(b: Battler, content: ContentIndex): readonly string[] {
  const out: string[] = [];
  const noStatus = blocksStatusMoves(heldHooks(b, content));
  for (let i = 0; i < b.creature.moves.length; i++) {
    const m = b.creature.moves[i]!;
    if (m.pp <= 0) continue;
    if (b.volatile.choiceLockedMove !== null && b.volatile.choiceLockedMove !== m.id) continue;
    if (noStatus) {
      let power = 0;
      try {
        power = content.move(m.id).power;
      } catch (_e) {
        continue;
      }
      if (power === 0) continue;
    }
    out.push(m.id);
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
  const defSide = state.sides[otherSide(side)];
  const attacker = atkSide.party[atkSide.active];
  const defender = defSide.party[defSide.active];
  if (attacker === undefined || defender === undefined) return 0;
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
  const moves = usableMoves(b, content);
  if (moves.length === 0) {
    // No usable move (there is no Struggle in v1): bench in, else leave the battle the way this side is allowed to.
    const to = firstStanding(state, side);
    if (to !== -1 && b.volatile.trappedTurns === 0) return { kind: 'switch', to };
    if (s.canFlee) return { kind: 'flee' };
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
