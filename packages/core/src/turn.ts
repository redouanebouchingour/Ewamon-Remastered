/**
 * §2.10–§2.11 — createBattle, validateAction, resolveTurn. Pure: the incoming state is deep-cloned and
 * never mutated; the rng advances from state.rng and the new state carries the new snapshot.
 */
import { abilityHooks, hooksOfKind } from './abilities';
import { accuracyCheck } from './accuracy';
import { resolveCatch } from './catch';
import { calcDamageFor, damageStop } from './damage';
import { EFFECT_HANDLERS, effectAlwaysApplies, effectTargetsDefender } from './effects';
import {
  active,
  activeRef,
  anyAlive,
  applySwitchIn,
  applySwitchOut,
  changeStage,
  checkFaint,
  cloneState,
  cureAllMajor,
  cureStatus,
  dealDamage,
  emit,
  fireSwitchInHooks,
  firstAlive,
  placeActive,
  fractionOfMax,
  healBattler,
  isAlive,
  other,
  ref,
  rollPercent,
  tryApplyStatus,
} from './engine';
import type { Ctx, MBattler, MState } from './engine';
import { blocksStatusMoves, consumableFor, hasChoiceLock, heldHooks, heldHooksOfKind } from './items';
import { chooseNpcAction } from './npc';
import { createRng } from './rng';
import { otherSide } from './side';
import { effectiveSpeed } from './speed';
import { applyRatio, calcStat, ratioOf, stageRatio } from './stats';
import { hasStatus } from './status';
import type {
  Action,
  ActionError,
  BattleOutcome,
  BattleState,
  ConsumableDef,
  ContentIndex,
  CreateBattleOpts,
  MoveDef,
  Side,
  TurnResult,
} from './types';

// ─── plumbing ───────────────────────────────────────────────────────────────

const SIDES: readonly (0 | 1)[] = [0, 1];

function makeCtx(state: BattleState, content: ContentIndex): Ctx {
  return { st: cloneState(state), events: [], rng: createRng(state.rng), content, fainted: {} };
}

function finish(ctx: Ctx): TurnResult {
  ctx.st.rng = ctx.rng.snapshot();
  return { state: ctx.st as unknown as BattleState, events: ctx.events };
}

function asState(st: MState): BattleState {
  return st as unknown as BattleState;
}

/** Thrown by resolveTurn when an action fails validateAction. The server is expected to have validated first. */
export class InvalidActionError extends Error {
  readonly side: 0 | 1;
  readonly code: ActionError;
  constructor(side: 0 | 1, code: ActionError) {
    super(`resolveTurn: invalid action for side ${side}: ${code}`);
    this.name = 'InvalidActionError';
    this.side = side;
    this.code = code;
  }
}

function endBattle(ctx: Ctx, outcome: BattleOutcome): void {
  ctx.st.ended = outcome;
  ctx.st.sides[0].mustSwitch = false;
  ctx.st.sides[1].mustSwitch = false;
  emit(ctx, { t: 'battleEnd', outcome, turns: ctx.st.turn });
}

// ─── createBattle ───────────────────────────────────────────────────────────

/** Applies onSwitchIn hooks for both leads (side 0 first) and returns those events. */
export function createBattle(o: CreateBattleOpts, content: ContentIndex): TurnResult {
  const rng = createRng(o.seed);
  const sides: readonly [Side, Side] = [
    { ...o.sides[0], mustSwitch: false, consumedItems: [] },
    { ...o.sides[1], mustSwitch: false, consumedItems: [] },
  ];
  const state: BattleState = {
    id: o.id,
    format: o.format,
    sides,
    field: { weather: { kind: 'none', turns: 0 }, terrain: o.terrain },
    turn: 0,
    rng: rng.snapshot(),
    ended: null,
    zoneId: o.zoneId,
  };
  const ctx = makeCtx(state, content);
  for (let i = 0; i < SIDES.length; i++) placeActive(ctx, SIDES[i]!, ctx.st.sides[SIDES[i]!].active);
  for (let i = 0; i < SIDES.length; i++) fireSwitchInHooks(ctx, SIDES[i]!);
  return finish(ctx);
}

// ─── validateAction ─────────────────────────────────────────────────────────

function validateSwitch(state: BattleState, side: 0 | 1, to: number, checkTrap: boolean): ActionError | null {
  const s = state.sides[side];
  if (!Number.isInteger(to) || to < 0 || to >= s.party.length) return 'badSwitchIndex';
  if (to === s.active) return 'switchToActive';
  if (s.party[to]!.creature.hp <= 0) return 'switchToFainted';
  if (checkTrap && s.party[s.active]!.volatile.trappedTurns > 0) return 'trapped';
  return null;
}

function validateItem(
  state: BattleState,
  side: 0 | 1,
  item: string,
  target: number | undefined,
  content: ContentIndex,
): ActionError | null {
  const s = state.sides[side];
  const def = consumableFor(content, item);
  if (def === null) {
    // Distinguish an unknown id (RangeError from content) from a known-but-not-consumable item (a held item).
    let known = true;
    try {
      content.item(item);
    } catch (_e) {
      known = false;
    }
    return known ? 'itemNotUsableInBattle' : 'unknownItem';
  }
  if (!def.usableInBattle) return 'itemNotUsableInBattle';
  if (def.effect.kind === 'escapeRope' && !s.canFlee) return 'itemNotUsableInBattle';
  const t = target === undefined ? s.active : target;
  if (!Number.isInteger(t) || t < 0 || t >= s.party.length) return 'badItemTarget';
  const b = s.party[t]!;
  const fainted = b.creature.hp <= 0;
  if (def.effect.kind === 'revive') return fainted ? null : 'badItemTarget';
  if (fainted) return 'badItemTarget';
  return null;
}

/**
 * null = valid. Pure over (state, side, action). The server calls this before resolveTurn; resolveTurn throws
 * InvalidActionError on an invalid action.
 *
 * `content` is optional (a deviation from the §2.10 three-argument signature, see IMPLEMENTATION-NOTES.md):
 * without it the structural checks run (pp, choice lock, switch indices, trap, flee/forfeit/catch permissions,
 * mustSwitch phase) and the id-resolving ones (`unknownMove` against content, `statusMoveBlocked`, all item
 * checks, `unknownOrb`) are skipped. resolveTurn always passes content.
 */
export function validateAction(
  state: BattleState,
  side: 0 | 1,
  action: Action | null,
  content: ContentIndex | null = null,
): ActionError | null {
  if (state.ended !== null) return 'battleEnded';
  const s = state.sides[side];
  const o = state.sides[otherSide(side)];

  if (s.mustSwitch) {
    if (action === null || action.kind !== 'switch') return 'mustSwitch';
    return validateSwitch(state, side, action.to, false);
  }
  if (o.mustSwitch) return action === null ? null : 'actionNotRequired';
  if (action === null) return s.kind === 'player' ? 'actionNotRequired' : null;

  const b = s.party[s.active];
  if (b === undefined) return 'badSwitchIndex';
  switch (action.kind) {
    case 'move': {
      let slot = -1;
      for (let i = 0; i < b.creature.moves.length; i++) if (b.creature.moves[i]!.id === action.move) slot = i;
      if (slot === -1) return 'unknownMove';
      let md: MoveDef | null = null;
      if (content !== null) {
        try {
          md = content.move(action.move);
        } catch (_e) {
          return 'unknownMove';
        }
      }
      if (b.creature.moves[slot]!.pp <= 0) return 'noPp';
      if (b.volatile.choiceLockedMove !== null && b.volatile.choiceLockedMove !== action.move) return 'choiceLocked';
      if (content !== null && md !== null && md.power === 0 && blocksStatusMoves(heldHooks(b, content))) {
        return 'statusMoveBlocked';
      }
      return null;
    }
    case 'switch':
      return validateSwitch(state, side, action.to, true);
    case 'item':
      return content === null ? null : validateItem(state, side, action.item, action.target, content);
    case 'catch': {
      if (!s.canCatch || side !== 0) return 'cannotCatch';
      if (content !== null) {
        try {
          content.orb(action.orb);
        } catch (_e) {
          return 'unknownOrb';
        }
      }
      return null;
    }
    case 'flee':
      return s.canFlee && side === 0 ? null : 'cannotFlee';
    case 'forfeit':
      // A side that may flee leaves by fleeing; forfeit is for trainer/league/pvp sides and NPC/wild sides.
      return s.canFlee ? 'cannotForfeit' : null;
    default:
      return 'unknownMove';
  }
}

// ─── ordering ───────────────────────────────────────────────────────────────

interface Actor {
  readonly side: 0 | 1;
  readonly priority: number;
}

/** priority desc, then effective speed desc, then rng.int(2). Draws only when two actors tie fully. */
function order(ctx: Ctx, actors: readonly Actor[]): readonly Actor[] {
  if (actors.length < 2) return actors;
  const a = actors[0]!;
  const b = actors[1]!;
  if (a.priority !== b.priority) return a.priority > b.priority ? [a, b] : [b, a];
  const w = ctx.st.field.weather.kind;
  const sa = effectiveSpeed(active(ctx, a.side), w, ctx.content);
  const sb = effectiveSpeed(active(ctx, b.side), w, ctx.content);
  if (sa !== sb) return sa > sb ? [a, b] : [b, a];
  return ctx.rng.int(2) === 0 ? [a, b] : [b, a];
}

// ─── items ──────────────────────────────────────────────────────────────────

function useItem(ctx: Ctx, side: 0 | 1, def: ConsumableDef, targetIdx: number): 'ended' | null {
  const who = activeRef(ctx, side);
  const tRef = ref(side, targetIdx);
  const t = ctx.st.sides[side].party[targetIdx]!;
  emit(ctx, { t: 'itemUsed', who, item: def.id, target: tRef, consumedHeld: false });
  ctx.st.sides[side].consumedItems.push(def.id);
  const e = def.effect;
  switch (e.kind) {
    case 'healHp':
      healBattler(ctx, tRef, e.amount === 'full' ? t.maxHp - t.creature.hp : e.amount, 'item', def.id);
      break;
    case 'revive':
      healBattler(ctx, tRef, Math.max(1, fractionOfMax(t, e.fraction)), 'item', def.id);
      break;
    case 'cureStatus':
      if (e.statuses === 'all') {
        cureAllMajor(ctx, tRef, 'item');
        cureStatus(ctx, tRef, 'confuse', 'item');
      } else {
        for (let i = 0; i < e.statuses.length; i++) cureStatus(ctx, tRef, e.statuses[i]!, 'item');
      }
      break;
    case 'fullRestore':
      healBattler(ctx, tRef, t.maxHp - t.creature.hp, 'item', def.id);
      cureAllMajor(ctx, tRef, 'item');
      cureStatus(ctx, tRef, 'confuse', 'item');
      break;
    case 'restorePp':
      for (let i = 0; i < t.creature.moves.length; i++) {
        const m = t.creature.moves[i]!;
        m.pp = e.amount === 'full' ? m.ppMax : Math.min(m.ppMax, m.pp + e.amount);
      }
      break;
    case 'escapeRope':
      emit(ctx, { t: 'fled', side });
      endBattle(ctx, { winner: 'fled' });
      return 'ended';
    default:
      // rareCandy / repel / lure / evolutionStone / sellOnly are rejected by validateAction.
      break;
  }
  return null;
}

// ─── moves ──────────────────────────────────────────────────────────────────

function confusionSelfHit(ctx: Ctx, side: 0 | 1, b: MBattler): void {
  const sp = ctx.content.species(b.creature.speciesId);
  const L = b.creature.level;
  const A = applyRatio(calcStat(sp.baseAtk, L), stageRatio(b.stages.atk));
  const D = Math.max(1, applyRatio(calcStat(sp.baseDef, L), stageRatio(b.stages.def)));
  const base = Math.floor(Math.floor((Math.floor((2 * L) / 5 + 2) * 40 * A) / D) / 50) + 2;
  dealDamage(ctx, activeRef(ctx, side), Math.max(1, base), 'confusion', activeRef(ctx, side), null);
}

/** Pre-action checks in §2.11 order. Returns true when the battler may act. */
function canAct(ctx: Ctx, side: 0 | 1): boolean {
  const b = active(ctx, side);
  const who = activeRef(ctx, side);
  if (!isAlive(b)) return false;
  if (b.volatile.flinched) {
    b.volatile.flinched = false;
    b.volatile.movedThisTurn = true;
    emit(ctx, { t: 'flinch', who });
    return false;
  }
  if (b.volatile.sleepTurns > 0) {
    b.volatile.sleepTurns -= 1;
    if (b.volatile.sleepTurns > 0) {
      b.volatile.movedThisTurn = true;
      emit(ctx, { t: 'statusTick', target: who, status: 'sleep', detail: 'asleep' });
      return false;
    }
    cureStatus(ctx, who, 'sleep', 'timer');
  }
  if (hasStatus(b.creature.status, 'freeze')) {
    if (rollPercent(ctx, 20)) {
      cureStatus(ctx, who, 'freeze', 'thaw');
    } else {
      b.volatile.movedThisTurn = true;
      emit(ctx, { t: 'statusTick', target: who, status: 'freeze', detail: 'frozen' });
      return false;
    }
  }
  if (hasStatus(b.creature.status, 'paralyze') && rollPercent(ctx, 25)) {
    b.volatile.movedThisTurn = true;
    emit(ctx, { t: 'statusTick', target: who, status: 'paralyze', detail: 'paralyzed' });
    return false;
  }
  if (b.volatile.confusedTurns > 0) {
    b.volatile.confusedTurns -= 1;
    if (b.volatile.confusedTurns === 0) {
      cureStatus(ctx, who, 'confuse', 'timer');
    } else if (rollPercent(ctx, 33)) {
      b.volatile.movedThisTurn = true;
      emit(ctx, { t: 'statusTick', target: who, status: 'confuse', detail: 'confused' });
      confusionSelfHit(ctx, side, b);
      checkFaint(ctx, who);
      return false;
    }
  }
  return true;
}

function executeMove(ctx: Ctx, side: 0 | 1, moveId: string): void {
  if (!canAct(ctx, side)) return;
  const b = active(ctx, side);
  const who = activeRef(ctx, side);
  const move = ctx.content.move(moveId);
  const foeSide = other(side);
  const foe = active(ctx, foeSide);
  const foeRef = activeRef(ctx, foeSide);
  // A damaging move always hits the foe; `target` only steers power-0 moves (self/field) — see IMPLEMENTATION-NOTES.
  const hitsFoe = move.power > 0 || move.target === 'foe';
  const targetRef = hitsFoe ? foeRef : who;

  // PP, moveUsed, bookkeeping
  let ppLeft = 0;
  for (let i = 0; i < b.creature.moves.length; i++) {
    const m = b.creature.moves[i]!;
    if (m.id === moveId) {
      m.pp = Math.max(0, m.pp - 1);
      ppLeft = m.pp;
    }
  }
  emit(ctx, { t: 'moveUsed', who, move: moveId, target: targetRef, ppLeft });
  b.volatile.lastMove = moveId;
  b.volatile.movedThisTurn = true;
  if (b.volatile.choiceLockedMove === null && hasChoiceLock(heldHooks(b, ctx.content))) {
    b.volatile.choiceLockedMove = moveId;
  }

  if (hitsFoe && !isAlive(foe)) {
    emit(ctx, { t: 'moveFailed', who, move: moveId, reason: 'noTarget' });
    return;
  }

  // Accuracy: exactly one draw.
  const weather = ctx.st.field.weather.kind;
  const defenderForAcc = hitsFoe ? foe : null;
  if (!accuracyCheck(b, defenderForAcc, move, weather, ctx.content, ctx.rng)) {
    emit(ctx, { t: 'moveMissed', who, move: moveId, target: targetRef });
    return;
  }

  if (!hitsFoe) {
    applyEffect(ctx, side, move, 0);
    return;
  }

  const inp = { attacker: b, defender: foe, weather };
  const stop = damageStop(inp, move, ctx.content);
  if (stop.stop === 'typeChart') {
    emit(ctx, { t: 'moveFailed', who, move: moveId, reason: 'immune' });
    return;
  }
  if (stop.stop === 'abilityImmunity') {
    emit(ctx, { t: 'abilityTrigger', who: foeRef, ability: foe.creature.ability, detail: 'typeImmunity' });
    const imm = hooksOfKind(abilityHooks(foe, ctx.content), 'typeImmunity');
    for (let i = 0; i < imm.length; i++) {
      const h = imm[i]!;
      if (h.moveType !== move.type) continue;
      const r = h.reaction;
      if (r.kind === 'heal') healBattler(ctx, foeRef, fractionOfMax(foe, r.fraction), 'absorb', null);
      else if (r.kind === 'flag') foe.volatile.flashFired = true;
      else if (r.kind === 'raiseStat') changeStage(ctx, foeRef, r.stat, r.stages, foeRef, 'ability');
      break;
    }
    emit(ctx, { t: 'moveFailed', who, move: moveId, reason: 'immune' });
    return;
  }
  if (stop.stop === 'wonderGuard') {
    emit(ctx, { t: 'abilityTrigger', who: foeRef, ability: foe.creature.ability, detail: 'wonderGuard' });
    emit(ctx, { t: 'moveFailed', who, move: moveId, reason: 'wonderGuard' });
    return;
  }

  // Damage
  let dealt = 0;
  const res = calcDamageFor(inp, move, ctx.rng, ctx.content);
  if (move.power > 0) {
    dealt = dealDamage(ctx, foeRef, res.amount, 'move', who, moveId, {
      effectiveness: res.effectiveness,
      crit: res.crit,
      stab: res.stab,
    });
    if (move.type === 'Fire' && hasStatus(foe.creature.status, 'freeze')) cureStatus(ctx, foeRef, 'freeze', 'fireHit');
  }

  // Effect
  applyEffect(ctx, side, move, dealt);

  // Contact hooks (defender's ability reacts to the attacker's touch)
  if (move.power > 0 && move.contact && isAlive(b)) {
    const contact = hooksOfKind(abilityHooks(foe, ctx.content), 'onContact');
    for (let i = 0; i < contact.length; i++) {
      const r = contact[i]!.reaction;
      if (r.kind === 'inflictStatus') {
        if (rollPercent(ctx, r.chance)) {
          emit(ctx, { t: 'abilityTrigger', who: foeRef, ability: foe.creature.ability, detail: 'onContact' });
          tryApplyStatus(ctx, who, r.status, foeRef);
        }
      } else {
        emit(ctx, { t: 'abilityTrigger', who: foeRef, ability: foe.creature.ability, detail: 'onContact' });
        dealDamage(ctx, who, Math.max(1, fractionOfMax(b, r.fraction)), 'contact', foeRef, null);
      }
    }
  }

  // onSuperEffectiveHit held items (Weakness Policy)
  if (move.power > 0 && res.effectiveness >= 2 && isAlive(foe) && !foe.volatile.weaknessPolicyUsed) {
    const hooks = heldHooksOfKind(heldHooks(foe, ctx.content), 'onSuperEffectiveHit');
    for (let i = 0; i < hooks.length; i++) {
      const h = hooks[i]!;
      const item = foe.creature.heldItem;
      if (item === null) break; // hooks came from the held item, so this cannot happen; defensive
      emit(ctx, { t: 'heldItemTrigger', who: foeRef, item, consumed: true });
      changeStage(ctx, foeRef, h.raise.stat, h.raise.stages, foeRef, 'item');
      foe.volatile.weaknessPolicyUsed = true;
      foe.creature.heldItem = null;
    }
  }

  // Faint checks
  checkFaint(ctx, foeRef);
  checkFaint(ctx, who);
}

function applyEffect(ctx: Ctx, side: 0 | 1, move: MoveDef, dealt: number): void {
  if (move.effect === null) return;
  if (effectTargetsDefender(move.effect) && !isAlive(active(ctx, other(side)))) return;
  // "always" effects (§2.4 table) never roll; chance-gated ones roll once when effectChance < 100.
  if (!effectAlwaysApplies(move.effect) && move.effectChance < 100 && !rollPercent(ctx, move.effectChance)) return;
  EFFECT_HANDLERS[move.effect](ctx, side, move, dealt);
}

// ─── end of turn ────────────────────────────────────────────────────────────

function chip(ctx: Ctx, side: 0 | 1, den: number, cause: 'burn' | 'poison' | 'trap' | 'sand' | 'hail'): void {
  const b = active(ctx, side);
  if (!isAlive(b)) return;
  dealDamage(ctx, activeRef(ctx, side), Math.max(1, Math.floor(b.maxHp / den)), cause, null, null);
}

function endOfTurn(ctx: Ctx): void {
  const st = ctx.st;
  // weather damage
  const w = st.field.weather.kind;
  if (w === 'sand' || w === 'hail') {
    for (let i = 0; i < SIDES.length; i++) {
      const side = SIDES[i]!;
      const b = active(ctx, side);
      if (!isAlive(b)) continue;
      const types = ctx.content.species(b.creature.speciesId).types;
      const immune =
        w === 'sand'
          ? types.indexOf('Rock') !== -1 || types.indexOf('Ground') !== -1 || types.indexOf('Steel') !== -1
          : types.indexOf('Ice') !== -1;
      if (!immune) chip(ctx, side, 16, w);
    }
  }
  // burn
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    if (hasStatus(active(ctx, side).creature.status, 'burn')) chip(ctx, side, 16, 'burn');
  }
  // poison
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    if (hasStatus(active(ctx, side).creature.status, 'poison')) chip(ctx, side, 8, 'poison');
  }
  // trap
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    const b = active(ctx, side);
    if (b.volatile.trappedTurns > 0 && isAlive(b)) {
      chip(ctx, side, 8, 'trap');
      b.volatile.trappedTurns -= 1;
      if (b.volatile.trappedTurns === 0) emit(ctx, { t: 'trapEnd', target: activeRef(ctx, side) });
    }
  }
  // berries
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    const b = active(ctx, side);
    if (!isAlive(b) || b.volatile.berryConsumed || b.creature.heldItem === null) continue;
    const berries = heldHooksOfKind(heldHooks(b, ctx.content), 'berry');
    for (let j = 0; j < berries.length; j++) {
      const h = berries[j]!;
      const [num, den] = ratioOf(h.belowFraction);
      if (b.creature.hp * den >= b.maxHp * num) continue;
      const item = b.creature.heldItem;
      if (item === null) break;
      const amt = h.heal.kind === 'fraction' ? fractionOfMax(b, h.heal.value) : h.heal.value;
      emit(ctx, { t: 'heldItemTrigger', who: activeRef(ctx, side), item, consumed: true });
      healBattler(ctx, activeRef(ctx, side), amt, 'berry', item);
      b.volatile.berryConsumed = true;
      b.creature.heldItem = null;
      break;
    }
  }
  // endOfTurn abilities (Speed Boost)
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    const b = active(ctx, side);
    if (!isAlive(b)) continue;
    const hooks = hooksOfKind(abilityHooks(b, ctx.content), 'endOfTurn');
    for (let j = 0; j < hooks.length; j++) {
      const h = hooks[j]!;
      emit(ctx, { t: 'abilityTrigger', who: activeRef(ctx, side), ability: b.creature.ability, detail: 'endOfTurn' });
      changeStage(ctx, activeRef(ctx, side), h.raise.stat, h.raise.stages, activeRef(ctx, side), 'ability');
    }
  }
  // weather countdown
  if (st.field.weather.kind !== 'none') {
    const kind = st.field.weather.kind;
    const left = st.field.weather.turns - 1;
    if (left <= 0) {
      st.field.weather = { kind: 'none', turns: 0 };
      emit(ctx, { t: 'weatherEnd', kind });
    } else {
      st.field.weather = { kind, turns: left };
      emit(ctx, { t: 'weatherTick', kind, turnsLeft: left });
    }
  }
  // faint checks
  for (let i = 0; i < SIDES.length; i++) checkFaint(ctx, activeRef(ctx, SIDES[i]!));
  // mustSwitch
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    const s = st.sides[side];
    s.mustSwitch = !isAlive(active(ctx, side)) && firstAlive(s, s.active) !== -1;
    if (s.mustSwitch) emit(ctx, { t: 'switchRequired', side });
  }
  st.turn += 1;
  emit(ctx, { t: 'turnEnd', turn: st.turn });
}

function checkEnd(ctx: Ctx): void {
  const a0 = anyAlive(ctx.st.sides[0]);
  const a1 = anyAlive(ctx.st.sides[1]);
  if (a0 && a1) return;
  if (!a0 && !a1) endBattle(ctx, { winner: 'draw' });
  else if (!a0) endBattle(ctx, { winner: 1 });
  else endBattle(ctx, { winner: 0 });
}

// ─── resolveTurn ────────────────────────────────────────────────────────────

export function resolveTurn(
  state: BattleState,
  actions: readonly [Action | null, Action | null],
  content: ContentIndex,
): TurnResult {
  if (state.ended !== null) throw new InvalidActionError(0, 'battleEnded');
  const ctx = makeCtx(state, content);
  const st = ctx.st;
  const replacement = st.sides[0].mustSwitch || st.sides[1].mustSwitch;

  // NPC sides never pass actions: choose deterministically from the battle rng.
  const acts: [Action | null, Action | null] = [actions[0], actions[1]];
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    if (acts[side] !== null || st.sides[side].kind === 'player') continue;
    if (replacement && !st.sides[side].mustSwitch) continue;
    acts[side] = chooseNpcAction(asState(st), side, content, ctx.rng);
  }
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    const err = validateAction(asState(st), side, acts[side], content);
    if (err !== null) throw new InvalidActionError(side, err);
  }

  // 1. Replacement phase
  if (replacement) {
    // Both fainted leads leave, both replacements enter, then onSwitchIn hooks fire (side 0 first) — so each
    // Intimidate sees the foe that is actually on the field, as in createBattle.
    const swapped: (0 | 1)[] = [];
    for (let i = 0; i < SIDES.length; i++) {
      const side = SIDES[i]!;
      const a = acts[side];
      if (!st.sides[side].mustSwitch || a === null || a.kind !== 'switch') continue;
      applySwitchOut(ctx, side, 'faint');
      swapped.push(side);
    }
    for (let i = 0; i < swapped.length; i++) {
      const side = swapped[i]!;
      const a = acts[side];
      if (a === null || a.kind !== 'switch') continue;
      placeActive(ctx, side, a.to);
      st.sides[side].mustSwitch = false;
    }
    for (let i = 0; i < swapped.length; i++) fireSwitchInHooks(ctx, swapped[i]!);
    return finish(ctx);
  }

  emit(ctx, { t: 'turnStart', turn: st.turn + 1 });
  for (let i = 0; i < SIDES.length; i++) {
    const b = active(ctx, SIDES[i]!);
    b.volatile.flinched = false;
    b.volatile.movedThisTurn = false;
  }

  // 2. Forfeit / flee
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    const a = acts[side];
    if (a !== null && a.kind === 'forfeit') {
      emit(ctx, { t: 'forfeit', side });
      st.turn += 1;
      endBattle(ctx, { winner: other(side) });
      return finish(ctx);
    }
  }
  const a0 = acts[0];
  if (a0 !== null && a0.kind === 'flee') {
    if (active(ctx, 0).volatile.trappedTurns > 0) {
      emit(ctx, { t: 'moveFailed', who: activeRef(ctx, 0), move: null, reason: 'trapped' });
      acts[0] = null;
    } else {
      emit(ctx, { t: 'fled', side: 0 });
      st.turn += 1;
      endBattle(ctx, { winner: 'fled' });
      return finish(ctx);
    }
  }

  // 3. Switches
  const switchers: Actor[] = [];
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    const a = acts[side];
    if (a !== null && a.kind === 'switch') switchers.push({ side, priority: 0 });
  }
  const orderedSwitchers = order(ctx, switchers);
  for (let i = 0; i < orderedSwitchers.length; i++) {
    const side = orderedSwitchers[i]!.side;
    const a = acts[side];
    if (a === null || a.kind !== 'switch') continue;
    applySwitchOut(ctx, side, 'action');
    applySwitchIn(ctx, side, a.to);
  }

  // 4. Items
  const users: Actor[] = [];
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    const a = acts[side];
    if (a !== null && a.kind === 'item') users.push({ side, priority: 0 });
  }
  const orderedUsers = order(ctx, users);
  for (let i = 0; i < orderedUsers.length; i++) {
    const side = orderedUsers[i]!.side;
    const a = acts[side];
    if (a === null || a.kind !== 'item') continue;
    const def = consumableFor(content, a.item);
    if (def === null) throw new InvalidActionError(side, 'unknownItem'); // validated above; defensive
    const target = a.target === undefined ? st.sides[side].active : a.target;
    if (useItem(ctx, side, def, target) === 'ended') {
      st.turn += 1;
      return finish(ctx);
    }
  }

  // 5. Catch (side 0 only)
  const c0 = acts[0];
  if (c0 !== null && c0.kind === 'catch') {
    const orb = content.orb(c0.orb);
    const wild = active(ctx, 1);
    const target = activeRef(ctx, 1);
    emit(ctx, { t: 'catchThrow', orb: orb.id, target });
    st.sides[0].consumedItems.push(orb.id);
    const roll = resolveCatch(wild, content.species(wild.creature.speciesId), orb, ctx.rng);
    const shown = Math.min(3, roll.shakes);
    for (let n = 1; n <= shown; n++) emit(ctx, { t: 'catchShake', n: n as 1 | 2 | 3 });
    emit(ctx, { t: 'catchResult', caught: roll.caught, target, shakes: roll.shakes });
    if (roll.caught) {
      st.turn += 1;
      endBattle(ctx, { winner: 'caught', slot: st.sides[1].active });
      return finish(ctx);
    }
  }

  // 6. Moves
  const movers: Actor[] = [];
  for (let i = 0; i < SIDES.length; i++) {
    const side = SIDES[i]!;
    const a = acts[side];
    if (a !== null && a.kind === 'move') movers.push({ side, priority: content.move(a.move).priority });
  }
  const orderedMovers = order(ctx, movers);
  for (let i = 0; i < orderedMovers.length; i++) {
    const side = orderedMovers[i]!.side;
    const a = acts[side];
    if (a === null || a.kind !== 'move') continue;
    executeMove(ctx, side, a.move);
  }

  // 7. End of turn
  endOfTurn(ctx);

  // 8. Battle end
  checkEnd(ctx);
  return finish(ctx);
}
