/**
 * §2.10 — deterministic NPC policy.
 * Wild: uniform pick among moves with pp > 0. NPC trainer: highest expected damage, rng tiebreak.
 * A side that mustSwitch switches to its lowest-index standing party member. With no usable move and
 * no standing bench, the side flees when it may (`canFlee`) and forfeits otherwise (there is no Struggle
 * in v1), so every battle terminates. Every action returned passes validateAction.
 */
import { damageAmount, damageStop } from './damage';
import { benchOf, requiredPositions } from './doubles';
import { blocksStatusMoves, heldHooks } from './items';
import { otherSide } from './side';
import type { Action, BattleState, Battler, ContentIndex, FieldRef, MoveDef, Rng } from './types';

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
  return expectedDamageVs(attacker, defender, state.field.weather.kind, move, content);
}

/** expectedDamage between two given battlers (Phase D6: doubles scores every attacker × target pair). */
export function expectedDamageVs(attacker: Battler, defender: Battler, weather: BattleState['field']['weather']['kind'], move: MoveDef, content: ContentIndex): number {
  const inp = { attacker, defender, weather };
  const s = damageStop(inp, move, content);
  if (s.stop !== null) return 0;
  const { amount } = damageAmount(inp, move, s.effectiveness, false, 92, content);
  return Math.floor((amount * (move.accuracy ?? 100)) / 100);
}

/**
 * Phase D6 — the doubles policy, both positions of `side` at once (position 0 decides first; rng draws in that
 * order). Replacement: the required positions take the bench in ascending party order. Otherwise per standing
 * position: wild picks a move uniformly; an NPC trainer scores every (move, target) pair by expected damage — a spread
 * move by the sum over the foes it reaches (×0.75 when 2+ targets, minus what it would deal to the ally for `'all'`) —
 * and takes the best, rng tiebreak. No usable move: the lowest bench creature not already chosen (when not trapped),
 * else flee / forfeit as in singles. Positions that need no action are null. Every action passes validateSideChoice.
 */
export function chooseNpcDoubles(state: BattleState, side: 0 | 1, content: ContentIndex, rng: Rng): [Action | null, Action | null] {
  const s = state.sides[side];
  const a = s.actives;
  if (a === undefined) throw new RangeError('chooseNpcDoubles: not a doubles battle');
  const out: [Action | null, Action | null] = [null, null];
  const req = requiredPositions(state, side);
  const bench = benchOf(s);
  if (s.mustSwitch) {
    req.forEach((p, i) => {
      out[p] = { kind: 'switch', to: bench[i]! };
    });
    return out;
  }
  const foeSide = otherSide(side);
  const foes = state.sides[foeSide];
  const fa = foes.actives!;
  const weather = state.field.weather.kind;
  const chosen: number[] = [];
  for (const p of req) {
    const b = s.party[a[p]]!;
    const moves = usableMoves(b, content);
    if (moves.length === 0) {
      const to = bench.find((i) => !chosen.includes(i));
      if (to !== undefined && b.volatile.trappedTurns === 0) {
        chosen.push(to);
        out[p] = { kind: 'switch', to };
      } else out[p] = s.canFlee ? { kind: 'flee' } : { kind: 'forfeit' };
      continue;
    }
    if (s.kind === 'wild') {
      out[p] = { kind: 'move', move: rng.pick(moves) };
      continue;
    }
    const standingFoes: (0 | 1)[] = ([0, 1] as const).filter((q) => foes.party[fa[q]]!.creature.hp > 0);
    const ally = s.party[a[p === 0 ? 1 : 0]]!;
    let best = -Infinity;
    let bests: { move: string; target: FieldRef | null }[] = [];
    const consider = (move: string, target: FieldRef | null, e: number): void => {
      if (e > best) {
        best = e;
        bests = [{ move, target }];
      } else if (e === best) bests.push({ move, target });
    };
    for (const id of moves) {
      let md: MoveDef;
      try {
        md = content.move(id);
      } catch (_e) {
        continue;
      }
      if (md.power > 0 && (md.spread === 'foes' || md.spread === 'all')) {
        let e = 0;
        let n = standingFoes.length;
        for (const q of standingFoes) e += expectedDamageVs(b, foes.party[fa[q]]!, weather, md, content);
        let hurt = 0;
        if (md.spread === 'all' && ally.creature.hp > 0) {
          n += 1;
          hurt = expectedDamageVs(b, ally, weather, md, content);
        }
        const k = n >= 2 ? 0.75 : 1;
        consider(id, null, Math.floor(e * k) - Math.floor(hurt * k));
      } else if (md.power > 0 || md.target === 'foe') {
        if (standingFoes.length === 0) consider(id, null, 0);
        for (const q of standingFoes) consider(id, { side: foeSide, pos: q }, expectedDamageVs(b, foes.party[fa[q]]!, weather, md, content));
      } else consider(id, null, 0);
    }
    if (bests.length === 0) {
      out[p] = { kind: 'move', move: moves[0]! };
      continue;
    }
    const pick = bests.length === 1 ? bests[0]! : rng.pick(bests);
    out[p] = pick.target === null ? { kind: 'move', move: pick.move } : { kind: 'move', move: pick.move, target: pick.target };
  }
  return out;
}

/**
 * Singles policy (§2.10). Phase D6: in a doubles battle it returns position `pos`'s action from chooseNpcDoubles
 * (throws when that position needs no action — use chooseNpcDoubles to drive a doubles side).
 */
export function chooseNpcAction(state: BattleState, side: 0 | 1, content: ContentIndex, rng: Rng, pos: 0 | 1 = 0): Action {
  if (state.slots === 2) {
    const a = chooseNpcDoubles(state, side, content, rng)[pos];
    if (a === null) throw new RangeError(`chooseNpcAction: doubles position ${pos} of side ${side} needs no action`);
    return a;
  }
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
