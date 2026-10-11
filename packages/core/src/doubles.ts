/**
 * Phase D6 — doubles (`BattleState.slots === 2`): two battlers per side on field positions 0 and 1.
 *
 * Singles never reaches this module (createBattle / validateAction / resolveTurn dispatch here only when slots is 2),
 * so the singles state shape, rng stream and events are untouched (the §2.20 fuzz digests are the proof).
 *
 * Rules (each pinned by test/doubles.test.ts):
 * - `Side.actives` holds the party index on each position; `active` mirrors position 0. A battler that faints with no
 *   bench left stays on its position at hp 0 and is skipped by every rule (it takes no action, cannot be targeted:
 *   a move aimed at it retargets to the other foe, or fails with `noTarget`).
 * - A side submits one action per position (`SideChoice` `[pos0, pos1]`). Required positions: in a normal turn every
 *   position whose battler stands; in a replacement phase the fainted positions in order, as many as the bench can
 *   fill (the player only picks who comes in). Two positions may not switch to the same creature.
 * - Order: switches, then items, then moves — each across all four positions by priority (moves only) desc, then
 *   effective speed desc; a group of exact ties is shuffled with the battle rng (`rng.shuffle`, size − 1 draws).
 * - A single-target move aims at `Action.target` (a foe or the ally position), default the first standing foe. A foe
 *   target that has fainted retargets to the other standing foe; an ally target that has fainted fails (`noTarget`).
 * - Spread moves (`MoveDef.spread`): `'foes'` hits every standing foe, `'all'` every other standing battler (ally
 *   included), in field order (foe pos 0, foe pos 1, ally). One accuracy roll, damage roll and defender-effect roll per
 *   target; when 2+ targets were aimed at, each damage is ×0.75 (floor, min 1) after the whole §2.14 pipeline.
 *   Attacker-side effects (raise_*, heal, weather, recoil, drain) apply once after the last target, with the total dealt,
 *   if at least one target was hit.
 * - Intimidate (onSwitchIn lowerFoe) lowers every standing foe; a battler leaving the field ends every foe's trap.
 * - EXP: unchanged rule — every participating standing battler of the winning player side gains the full yield of each
 *   foe that faints (no split); both positions' battlers are participants.
 * - Catch and flee do not exist in doubles (doubles is for trainer / league / pvp); `cannotCatch` / `cannotFlee`.
 */
import { abilityHooks, hooksOfKind } from './abilities';
import { accuracyCheck } from './accuracy';
import { calcDamageFor, damageStop } from './damage';
import { effectTargetsDefender } from './effects';
import { formMoveId, transformError } from './forms';
import {
  at,
  changeStage,
  checkFaint,
  cureStatus,
  dealDamage,
  emit,
  fireSwitchInHooksAt,
  fractionOfMax,
  healBattler,
  isAlive,
  placeAt,
  ref,
  rollPercent,
  switchOutAt,
  transformAt,
  tryApplyStatus,
} from './engine';
import type { Ctx, MSide } from './engine';
import { consumableFor, hasChoiceLock, heldHooks, heldHooksOfKind } from './items';
import { chooseNpcDoubles } from './npc';
import { createRng } from './rng';
import { otherSide } from './side';
import { effectiveSpeed } from './speed';
import { hasStatus } from './status';
import {
  InvalidActionError,
  applyEffect,
  asState,
  canActAt,
  checkEnd,
  endBattle,
  endOfTurnAt,
  executeMoveAt,
  finish,
  makeCtx,
  needsReplacement,
  useItemAt,
  validateItem,
  validateMoveChoice,
} from './turn';
import type {
  Action,
  ActionError,
  BattleState,
  ContentIndex,
  CreateBattleOpts,
  FieldRef,
  MoveDef,
  Ref,
  Side,
  SideChoice,
  TurnResult,
} from './types';

const SIDES: readonly (0 | 1)[] = [0, 1];
const POSITIONS: readonly (0 | 1)[] = [0, 1];

type Pair = [Action | null, Action | null];

// ─── field access ───────────────────────────────────────────────────────────

function actives(s: { readonly actives?: readonly [number, number] }): readonly [number, number] {
  if (s.actives === undefined) throw new RangeError('doubles: side has no actives');
  return s.actives;
}

/** The Ref (party index) of the battler on `pos` of `side`. */
function posRef(ctx: Ctx, side: 0 | 1, pos: 0 | 1): Ref {
  return ref(side, actives(ctx.st.sides[side])[pos]);
}

/** Every battler on the field in field order: side 0 pos 0, pos 1, side 1 pos 0, pos 1. */
function fieldRefs(ctx: Ctx): Ref[] {
  return [posRef(ctx, 0, 0), posRef(ctx, 0, 1), posRef(ctx, 1, 0), posRef(ctx, 1, 1)];
}

function foeRefs(ctx: Ctx, side: 0 | 1): Ref[] {
  const f = otherSide(side);
  return [posRef(ctx, f, 0), posRef(ctx, f, 1)];
}

/** Standing party indices of a doubles side that are not on the field, ascending. */
export function benchOf(s: Side | MSide): number[] {
  const a = actives(s);
  const out: number[] = [];
  for (let i = 0; i < s.party.length; i++) if (i !== a[0] && i !== a[1] && s.party[i]!.creature.hp > 0) out.push(i);
  return out;
}

/**
 * The positions of `side` that must act this call: in a replacement phase the fainted positions (in order) the bench
 * can fill; while the other side replaces, none; otherwise every position whose battler stands.
 */
export function requiredPositions(state: BattleState, side: 0 | 1): (0 | 1)[] {
  const s = state.sides[side];
  const o = state.sides[otherSide(side)];
  const a = actives(s);
  if (s.mustSwitch) {
    const n = benchOf(s).length;
    const out: (0 | 1)[] = [];
    for (const p of POSITIONS) if (s.party[a[p]]!.creature.hp <= 0 && out.length < n) out.push(p);
    return out;
  }
  if (o.mustSwitch) return [];
  return POSITIONS.filter((p) => s.party[a[p]]!.creature.hp > 0);
}

/** A SideChoice as a per-position pair (null → [null, null]; a bare Action → [it, null]). */
export function choicePair(c: SideChoice): Pair {
  if (c === null) return [null, null];
  if (Array.isArray(c)) {
    const arr = c as readonly (Action | null)[];
    return [arr[0] ?? null, arr[1] ?? null];
  }
  return [c as Action, null];
}

// ─── createBattle ───────────────────────────────────────────────────────────

function pickActives(s: CreateBattleOpts['sides'][number], side: 0 | 1): [number, number] {
  const alive = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < s.party.length && s.party[i]!.creature.hp > 0;
  if (s.actives !== undefined) {
    const [a, b] = s.actives;
    if (a === b || !alive(a) || !alive(b)) throw new RangeError(`createBattle: doubles side ${side} actives must be two different standing creatures`);
    return [a, b];
  }
  if (!alive(s.active)) throw new RangeError(`createBattle: doubles side ${side} lead has fainted`);
  for (let i = 0; i < s.party.length; i++) if (i !== s.active && alive(i)) return [s.active, i];
  throw new RangeError(`createBattle: doubles side ${side} needs two standing creatures`);
}

export function createDoubles(o: CreateBattleOpts, content: ContentIndex): TurnResult {
  if (o.format === 'wild' || o.format === 'raid') throw new RangeError(`createBattle: doubles is for trainer / league / pvp battles, not ${o.format}`);
  const rng = createRng(o.seed);
  const ambient = o.weather ?? 'none';
  const a0 = pickActives(o.sides[0], 0);
  const a1 = pickActives(o.sides[1], 1);
  const sides: readonly [Side, Side] = [
    { ...o.sides[0], active: a0[0], actives: a0, mustSwitch: false, consumedItems: [] },
    { ...o.sides[1], active: a1[0], actives: a1, mustSwitch: false, consumedItems: [] },
  ];
  const state: BattleState = {
    id: o.id,
    format: o.format,
    sides,
    field: { weather: { kind: ambient, turns: 0 }, terrain: o.terrain },
    turn: 0,
    rng: rng.snapshot(),
    ended: null,
    zoneId: o.zoneId,
    slots: 2,
    ...(o.noExp === true ? { noExp: true as const } : {}),
  };
  const ctx = makeCtx(state, content);
  if (ambient !== 'none') emit(ctx, { t: 'weatherSet', kind: ambient, turns: 0, source: null });
  for (const side of SIDES) for (const p of POSITIONS) placeAt(ctx, side, p, actives(ctx.st.sides[side])[p]);
  for (const side of SIDES) for (const p of POSITIONS) fireSwitchInHooksAt(ctx, posRef(ctx, side, p), foeRefs(ctx, side));
  return finish(ctx);
}

// ─── validation ─────────────────────────────────────────────────────────────

function validateSwitchAt(state: BattleState, side: 0 | 1, to: number, pos: 0 | 1, checkTrap: boolean): ActionError | null {
  const s = state.sides[side];
  const a = actives(s);
  if (!Number.isInteger(to) || to < 0 || to >= s.party.length) return 'badSwitchIndex';
  if (to === a[0] || to === a[1]) return 'switchToActive';
  if (s.party[to]!.creature.hp <= 0) return 'switchToFainted';
  if (checkTrap && s.party[a[pos]]!.volatile.trappedTurns > 0) return 'trapped';
  return null;
}

function isFieldRef(t: unknown): t is FieldRef {
  if (t === null || typeof t !== 'object') return false;
  const r = t as { side?: unknown; pos?: unknown };
  return (r.side === 0 || r.side === 1) && (r.pos === 0 || r.pos === 1);
}

/** validateAction for position `pos` of a doubles side (see the module header for the required positions). */
export function validateDoublesAction(
  state: BattleState,
  side: 0 | 1,
  action: Action | null,
  content: ContentIndex | null,
  pos: 0 | 1,
): ActionError | null {
  if (state.ended !== null) return 'battleEnded';
  const s = state.sides[side];
  if (action === null && s.kind !== 'player') return null;
  if (pos !== 0 && pos !== 1) return 'actionNotRequired';
  const req = requiredPositions(state, side);
  if (!req.includes(pos)) return action === null ? null : 'actionNotRequired';
  if (s.mustSwitch) {
    if (action === null || action.kind !== 'switch') return 'mustSwitch';
    return validateSwitchAt(state, side, action.to, pos, false);
  }
  if (action === null) return 'actionNotRequired';
  const a = actives(s);
  const b = s.party[a[pos]]!;
  switch (action.kind) {
    case 'move': {
      const err = validateMoveChoice(b, action.move, content);
      if (err !== null) return err;
      const t = action.target;
      if (t !== undefined && (!isFieldRef(t) || (t.side === side && t.pos === pos))) return 'badTarget';
      if (action.transform === true && content !== null) return transformError(s, b, content.species(b.creature.speciesId));
      return null;
    }
    case 'switch':
      return validateSwitchAt(state, side, action.to, pos, true);
    case 'item':
      return content === null ? null : validateItem(state, side, action.item, action.target === undefined ? a[pos] : action.target, content);
    case 'catch':
      return 'cannotCatch';
    case 'flee':
      return 'cannotFlee';
    case 'forfeit':
      return s.canFlee ? 'cannotForfeit' : null;
    default:
      return 'unknownMove';
  }
}

/**
 * Both positions of one side, including the cross-position rule (no two switches to the same creature).
 * null = valid; otherwise the first failing position and its error.
 */
export function validateSideChoice(
  state: BattleState,
  side: 0 | 1,
  choice: SideChoice,
  content: ContentIndex | null = null,
): { readonly pos: 0 | 1; readonly code: ActionError } | null {
  if (state.slots !== 2) throw new RangeError('validateSideChoice: doubles battles only');
  const pair = choicePair(choice);
  for (const p of POSITIONS) {
    const err = validateDoublesAction(state, side, pair[p], content, p);
    if (err !== null) return { pos: p, code: err };
  }
  const x = pair[0];
  const y = pair[1];
  if (x !== null && y !== null && x.kind === 'switch' && y.kind === 'switch' && x.to === y.to) return { pos: 1, code: 'switchToActive' };
  // Majin / Tenjin: one transformation per side per battle — never two in one turn
  if (x !== null && y !== null && x.kind === 'move' && y.kind === 'move' && x.transform === true && y.transform === true) return { pos: 1, code: 'cannotTransform' };
  return null;
}

// ─── ordering ───────────────────────────────────────────────────────────────

interface Actor {
  readonly side: 0 | 1;
  readonly pos: 0 | 1;
  readonly priority: number;
}

/** priority desc, then effective speed desc; every group of exact ties is shuffled with the battle rng. */
function orderActors(ctx: Ctx, actors: readonly Actor[]): Actor[] {
  if (actors.length < 2) return actors.slice();
  const w = ctx.st.field.weather.kind;
  const keyed = actors.map((a, i) => ({ a, i, spd: effectiveSpeed(at(ctx, posRef(ctx, a.side, a.pos)), w, ctx.content) }));
  keyed.sort((x, y) => (y.a.priority - x.a.priority) || (y.spd - x.spd) || (x.i - y.i));
  const out: Actor[] = [];
  for (let i = 0; i < keyed.length; ) {
    let j = i + 1;
    while (j < keyed.length && keyed[j]!.a.priority === keyed[i]!.a.priority && keyed[j]!.spd === keyed[i]!.spd) j++;
    const group = keyed.slice(i, j).map((k) => k.a);
    if (group.length > 1) out.push(...ctx.rng.shuffle(group));
    else out.push(group[0]!);
    i = j;
  }
  return out;
}

// ─── moves ──────────────────────────────────────────────────────────────────

/** The single-target move's target at execution time (see the module header). */
function resolveTarget(ctx: Ctx, side: 0 | 1, t: FieldRef | undefined): Ref {
  const foe = otherSide(side);
  if (t !== undefined && t.side === side) return posRef(ctx, side, t.pos);
  if (t === undefined) {
    for (const p of POSITIONS) if (isAlive(at(ctx, posRef(ctx, foe, p)))) return posRef(ctx, foe, p);
    return posRef(ctx, foe, 0);
  }
  const first = posRef(ctx, foe, t.pos);
  if (isAlive(at(ctx, first))) return first;
  const second = posRef(ctx, foe, t.pos === 0 ? 1 : 0);
  return isAlive(at(ctx, second)) ? second : first;
}

/** Whether `move` is a spread move in a doubles battle. */
export function isSpread(move: MoveDef): boolean {
  return move.spread === 'foes' || move.spread === 'all';
}

function executeSpreadAt(ctx: Ctx, side: 0 | 1, pos: 0 | 1, move: MoveDef): void {
  const who = posRef(ctx, side, pos);
  if (!canActAt(ctx, who)) return;
  const b = at(ctx, who);
  const content = ctx.content;
  const targets: Ref[] = [];
  for (const r of foeRefs(ctx, side)) if (isAlive(at(ctx, r))) targets.push(r);
  if (move.spread === 'all') {
    const ally = posRef(ctx, side, pos === 0 ? 1 : 0);
    if (isAlive(at(ctx, ally))) targets.push(ally);
  }
  let ppLeft = 0;
  for (let i = 0; i < b.creature.moves.length; i++) {
    const m = b.creature.moves[i]!;
    if (m.id === move.id) {
      m.pp = Math.max(0, m.pp - 1);
      ppLeft = m.pp;
    }
  }
  const primary = targets[0] ?? posRef(ctx, otherSide(side), 0);
  emit(ctx, { t: 'moveUsed', who, move: move.id, target: primary, ppLeft, targets: targets.slice() });
  b.volatile.lastMove = move.id;
  b.volatile.movedThisTurn = true;
  if (b.volatile.choiceLockedMove === null && hasChoiceLock(heldHooks(b, content))) b.volatile.choiceLockedMove = move.id;
  if (targets.length === 0) {
    emit(ctx, { t: 'moveFailed', who, move: move.id, reason: 'noTarget' });
    return;
  }
  const spreadMul = targets.length >= 2;
  const weather = ctx.st.field.weather.kind;
  let total = 0;
  let hitAny = false;
  for (const t of targets) {
    if (!isAlive(b)) break; // the attacker fell to a contact hook mid-spread
    const foe = at(ctx, t);
    if (!isAlive(foe)) continue;
    if (!accuracyCheck(b, foe, move, weather, content, ctx.rng)) {
      emit(ctx, { t: 'moveMissed', who, move: move.id, target: t });
      continue;
    }
    const inp = { attacker: b, defender: foe, weather };
    const stop = damageStop(inp, move, content);
    if (stop.stop === 'typeChart') {
      emit(ctx, { t: 'moveFailed', who, move: move.id, reason: 'immune', target: t });
      continue;
    }
    if (stop.stop === 'abilityImmunity') {
      emit(ctx, { t: 'abilityTrigger', who: t, ability: foe.creature.ability, detail: 'typeImmunity' });
      const imm = hooksOfKind(abilityHooks(foe, content), 'typeImmunity');
      for (let i = 0; i < imm.length; i++) {
        const h = imm[i]!;
        if (h.moveType !== move.type) continue;
        const r = h.reaction;
        if (r.kind === 'heal') healBattler(ctx, t, fractionOfMax(foe, r.fraction), 'absorb', null);
        else if (r.kind === 'flag') foe.volatile.flashFired = true;
        else if (r.kind === 'raiseStat') changeStage(ctx, t, r.stat, r.stages, t, 'ability');
        break;
      }
      emit(ctx, { t: 'moveFailed', who, move: move.id, reason: 'immune', target: t });
      continue;
    }
    if (stop.stop === 'wonderGuard') {
      emit(ctx, { t: 'abilityTrigger', who: t, ability: foe.creature.ability, detail: 'wonderGuard' });
      emit(ctx, { t: 'moveFailed', who, move: move.id, reason: 'wonderGuard', target: t });
      continue;
    }
    hitAny = true;
    const res = calcDamageFor(inp, move, ctx.rng, content);
    let dealt = 0;
    if (move.power > 0) {
      const amount = spreadMul ? Math.max(1, Math.floor((res.amount * 3) / 4)) : res.amount;
      dealt = dealDamage(ctx, t, amount, 'move', who, move.id, { effectiveness: res.effectiveness, crit: res.crit, stab: res.stab });
      if (move.type === 'Fire' && hasStatus(foe.creature.status, 'freeze')) cureStatus(ctx, t, 'freeze', 'fireHit');
    }
    total += dealt;
    if (move.effect !== null && effectTargetsDefender(move.effect)) applyEffect(ctx, who, t, move, dealt);
    if (move.power > 0 && move.contact && isAlive(b)) {
      const contact = hooksOfKind(abilityHooks(foe, content), 'onContact');
      for (let i = 0; i < contact.length; i++) {
        const r = contact[i]!.reaction;
        if (r.kind === 'inflictStatus') {
          if (rollPercent(ctx, r.chance)) {
            emit(ctx, { t: 'abilityTrigger', who: t, ability: foe.creature.ability, detail: 'onContact' });
            tryApplyStatus(ctx, who, r.status, t);
          }
        } else {
          emit(ctx, { t: 'abilityTrigger', who: t, ability: foe.creature.ability, detail: 'onContact' });
          dealDamage(ctx, who, Math.max(1, fractionOfMax(b, r.fraction)), 'contact', t, null);
        }
      }
    }
    if (move.power > 0 && res.effectiveness >= 2 && isAlive(foe) && !foe.volatile.weaknessPolicyUsed) {
      const hooks = heldHooksOfKind(heldHooks(foe, content), 'onSuperEffectiveHit');
      for (let i = 0; i < hooks.length; i++) {
        const h = hooks[i]!;
        const item = foe.creature.heldItem;
        if (item === null) break;
        emit(ctx, { t: 'heldItemTrigger', who: t, item, consumed: true });
        changeStage(ctx, t, h.raise.stat, h.raise.stages, t, 'item');
        foe.volatile.weaknessPolicyUsed = true;
        foe.creature.heldItem = null;
      }
    }
    checkFaint(ctx, t);
  }
  if (hitAny && move.effect !== null && !effectTargetsDefender(move.effect)) applyEffect(ctx, who, primary, move, total);
  checkFaint(ctx, who);
}

function executeAt(ctx: Ctx, side: 0 | 1, pos: 0 | 1, a: Extract<Action, { kind: 'move' }>): void {
  // a battle form's signature move stands in for the move it replaces (executeMoveAt swaps it again for the PP slot)
  const b = at(ctx, posRef(ctx, side, pos));
  const move = ctx.content.move(formMoveId(ctx.content.species(b.creature.speciesId), b, a.move));
  if (isSpread(move)) {
    executeSpreadAt(ctx, side, pos, move);
    return;
  }
  // self / field status moves keep a defender ref for the singles-shaped effect path (the first standing foe)
  const hitsFoe = move.power > 0 || move.target === 'foe';
  executeMoveAt(ctx, posRef(ctx, side, pos), a.move, resolveTarget(ctx, side, hitsFoe ? a.target : undefined));
}

// ─── resolveTurn ────────────────────────────────────────────────────────────

export function resolveDoublesTurn(state: BattleState, actions: readonly [SideChoice, SideChoice], content: ContentIndex): TurnResult {
  const ctx = makeCtx(state, content);
  const st = ctx.st;
  const replacement = st.sides[0].mustSwitch || st.sides[1].mustSwitch;

  const acts: [Pair, Pair] = [choicePair(actions[0]), choicePair(actions[1])];
  for (const side of SIDES) {
    if (st.sides[side].kind === 'player') continue;
    if (replacement && !st.sides[side].mustSwitch) continue;
    if (acts[side][0] !== null || acts[side][1] !== null) continue;
    acts[side] = chooseNpcDoubles(asState(st), side, content, ctx.rng);
  }
  for (const side of SIDES) {
    const err = validateSideChoice(asState(st), side, acts[side], content);
    if (err !== null) throw new InvalidActionError(side, err.code);
  }

  // 1. Replacement phase: every fainted leaver goes, every replacement enters, then the switch-in hooks — field order
  if (replacement) {
    const swaps: { side: 0 | 1; pos: 0 | 1; to: number }[] = [];
    for (const side of SIDES) {
      if (!st.sides[side].mustSwitch) continue;
      for (const p of POSITIONS) {
        const a = acts[side][p];
        if (a === null || a.kind !== 'switch') continue;
        switchOutAt(ctx, posRef(ctx, side, p), 'faint', p, foeRefs(ctx, side));
        swaps.push({ side, pos: p, to: a.to });
      }
    }
    for (const s of swaps) placeAt(ctx, s.side, s.pos, s.to);
    for (const side of SIDES) st.sides[side].mustSwitch = needsReplacement(st.sides[side]);
    for (const s of swaps) fireSwitchInHooksAt(ctx, posRef(ctx, s.side, s.pos), foeRefs(ctx, s.side));
    return finish(ctx);
  }

  emit(ctx, { t: 'turnStart', turn: st.turn + 1 });
  for (const r of fieldRefs(ctx)) {
    const b = at(ctx, r);
    b.volatile.flinched = false;
    b.volatile.movedThisTurn = false;
  }

  // 2. Forfeit (any position's forfeit forfeits the side; side 0 first)
  for (const side of SIDES) {
    for (const p of POSITIONS) {
      const a = acts[side][p];
      if (a !== null && a.kind === 'forfeit') {
        emit(ctx, { t: 'forfeit', side });
        st.turn += 1;
        endBattle(ctx, { winner: otherSide(side) });
        return finish(ctx);
      }
    }
  }

  const actorsOf = (kind: Action['kind']): Actor[] => {
    const out: Actor[] = [];
    for (const side of SIDES) {
      for (const p of POSITIONS) {
        const a = acts[side][p];
        if (a === null || a.kind !== kind) continue;
        const b = at(ctx, posRef(ctx, side, p));
        out.push({ side, pos: p, priority: a.kind === 'move' ? content.move(formMoveId(content.species(b.creature.speciesId), b, a.move)).priority : 0 });
      }
    }
    return out;
  };

  // 3. Switches
  for (const actor of orderActors(ctx, actorsOf('switch'))) {
    const a = acts[actor.side][actor.pos];
    if (a === null || a.kind !== 'switch') continue;
    switchOutAt(ctx, posRef(ctx, actor.side, actor.pos), 'action', actor.pos, foeRefs(ctx, actor.side));
    placeAt(ctx, actor.side, actor.pos, a.to);
    fireSwitchInHooksAt(ctx, posRef(ctx, actor.side, actor.pos), foeRefs(ctx, actor.side));
  }

  // 4. Items
  for (const actor of orderActors(ctx, actorsOf('item'))) {
    const a = acts[actor.side][actor.pos];
    if (a === null || a.kind !== 'item') continue;
    const def = consumableFor(content, a.item);
    if (def === null) throw new InvalidActionError(actor.side, 'unknownItem'); // validated above; defensive
    const who = posRef(ctx, actor.side, actor.pos);
    if (useItemAt(ctx, who, def, a.target === undefined ? who.slot : a.target) === 'ended') {
      st.turn += 1;
      return finish(ctx);
    }
  }

  // 4b. Majin / Tenjin: transformations happen before any move (faster first), then the move runs in the new form
  const transformers = actorsOf('move').filter((actor) => {
    const a = acts[actor.side][actor.pos];
    return a !== null && a.kind === 'move' && a.transform === true;
  }).map((actor) => ({ ...actor, priority: 0 }));
  for (const actor of orderActors(ctx, transformers)) transformAt(ctx, posRef(ctx, actor.side, actor.pos));

  // 5. Moves
  for (const actor of orderActors(ctx, actorsOf('move'))) {
    const a = acts[actor.side][actor.pos];
    if (a === null || a.kind !== 'move') continue;
    executeAt(ctx, actor.side, actor.pos, a);
  }

  // 6. End of turn over the four positions, 7. battle end
  endOfTurnAt(ctx, fieldRefs(ctx));
  checkEnd(ctx);
  return finish(ctx);
}
