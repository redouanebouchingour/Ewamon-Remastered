/**
 * Internal turn-engine primitives shared by effects.ts and turn.ts. resolveTurn works on a deep clone
 * of the incoming BattleState (so the input is never mutated) and these helpers mutate that clone
 * while appending events in resolution order.
 */
import { abilityHooks, hooksOfKind, stageLowerImmune, statusImmune } from './abilities';
import { DEFAULT_VOLATILE, ZERO_STAGES } from './battler';
import { applyExp, expGain } from './exp';
import { otherSide } from './side';
import { calcMaxHp, calcStat, clampStage, ratioOf, applyRatio } from './stats';
import { addStatus, hasStatus, isMajorStatus, majorStatus, removeStatus, clearMajorStatus } from './status';
import type {
  BattleEvent,
  BattleOutcome,
  BattleState,
  Battler,
  ContentIndex,
  CreatureInstance,
  Effectiveness,
  Field,
  MajorStatus,
  MoveSlot,
  Ref,
  Rng,
  RngState,
  Side,
  StatKey,
  StatStage,
  StatusId,
  TypeName,
  Volatile,
  WeatherKind,
} from './types';

// ─── mutable mirrors of the §2.9 types ──────────────────────────────────────

export type MMoveSlot = { -readonly [K in keyof MoveSlot]: MoveSlot[K] };
export type MCreature = Omit<{ -readonly [K in keyof CreatureInstance]: CreatureInstance[K] }, 'moves' | 'status'> & {
  moves: MMoveSlot[];
  status: readonly StatusId[];
};
export type MVolatile = { -readonly [K in keyof Volatile]: Volatile[K] };
export interface MBattler {
  creature: MCreature;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  stages: Record<StatKey, StatStage>;
  volatile: MVolatile;
  participated: boolean;
}
export interface MSide {
  kind: Side['kind'];
  party: MBattler[];
  active: number;
  trainerId: string | null;
  canFlee: boolean;
  canCatch: boolean;
  mustSwitch: boolean;
  consumedItems: string[];
  /** Phase D6: doubles only — party index per field position; absent in singles */
  actives?: [number, number];
}
export interface MState {
  id: string;
  format: BattleState['format'];
  sides: [MSide, MSide];
  field: { weather: { kind: WeatherKind; turns: number }; terrain: Field['terrain'] };
  turn: number;
  rng: RngState;
  ended: BattleOutcome | null;
  zoneId: string;
  /** Phase D6: 2 in doubles, absent in singles */
  slots?: 2;
}

export interface Ctx {
  readonly st: MState;
  readonly events: BattleEvent[];
  readonly rng: Rng;
  readonly content: ContentIndex;
  /** faint events already emitted this resolveTurn call, keyed "side:slot". */
  readonly fainted: Record<string, true>;
}

export function cloneBattler(b: Battler): MBattler {
  return {
    creature: {
      ...b.creature,
      moves: b.creature.moves.map((m) => ({ id: m.id, pp: m.pp, ppMax: m.ppMax })),
      status: b.creature.status.slice(),
      ribbons: b.creature.ribbons.slice(),
      caughtAt: b.creature.caughtAt === null ? null : { ...b.creature.caughtAt },
    },
    maxHp: b.maxHp,
    atk: b.atk,
    def: b.def,
    spd: b.spd,
    stages: { ...b.stages },
    volatile: { ...b.volatile },
    participated: b.participated,
  };
}

export function cloneSide(s: Side): MSide {
  const out: MSide = {
    kind: s.kind,
    party: s.party.map(cloneBattler),
    active: s.active,
    trainerId: s.trainerId,
    canFlee: s.canFlee,
    canCatch: s.canCatch,
    mustSwitch: s.mustSwitch,
    consumedItems: s.consumedItems.slice(),
  };
  // Phase D6: the key exists only in doubles, so a singles state keeps its exact shape
  if (s.actives !== undefined) out.actives = [s.actives[0], s.actives[1]];
  return out;
}

export function cloneState(s: BattleState): MState {
  const out: MState = {
    id: s.id,
    format: s.format,
    sides: [cloneSide(s.sides[0]), cloneSide(s.sides[1])],
    field: { weather: { kind: s.field.weather.kind, turns: s.field.weather.turns }, terrain: s.field.terrain },
    turn: s.turn,
    rng: [s.rng[0], s.rng[1], s.rng[2], s.rng[3]],
    ended: s.ended === null ? null : { ...s.ended },
    zoneId: s.zoneId,
  };
  if (s.slots === 2) out.slots = 2;
  return out;
}

// ─── refs and access ────────────────────────────────────────────────────────

export function ref(side: 0 | 1, slot: number): Ref {
  return { side, slot };
}

export function activeRef(ctx: Ctx, side: 0 | 1): Ref {
  return { side, slot: ctx.st.sides[side].active };
}

export function active(ctx: Ctx, side: 0 | 1): MBattler {
  const s = ctx.st.sides[side];
  return s.party[s.active]!;
}

export const other = otherSide;

/** The battler a Ref names (Ref.slot is a party index). */
export function at(ctx: Ctx, r: Ref): MBattler {
  return ctx.st.sides[r.side].party[r.slot]!;
}

/** Phase D6: whether party index `idx` of `side` stands on the field (singles: the active; doubles: either position). */
export function onField(side: MSide, idx: number): boolean {
  return side.actives === undefined ? side.active === idx : side.actives[0] === idx || side.actives[1] === idx;
}

export function emit(ctx: Ctx, ev: BattleEvent): void {
  ctx.events.push(ev);
}

export function speciesOf(ctx: Ctx, b: MBattler) {
  return ctx.content.species(b.creature.speciesId);
}

export function isAlive(b: MBattler): boolean {
  return b.creature.hp > 0;
}

/** rng.int(100) < pct — the one percentage roll primitive (integer discipline). */
export function rollPercent(ctx: Ctx, pct: number): boolean {
  return ctx.rng.int(100) < pct;
}

// ─── hp changes ─────────────────────────────────────────────────────────────

export interface DamageMeta {
  readonly effectiveness: Effectiveness;
  readonly crit: boolean;
  readonly stab: boolean;
}

const PLAIN: DamageMeta = { effectiveness: 1, crit: false, stab: false };

/** Applies `amount` (capped at remaining hp) to the battler at `target`; emits `damage`; returns hp actually lost. */
export function dealDamage(
  ctx: Ctx,
  target: Ref,
  amount: number,
  cause: Extract<BattleEvent, { t: 'damage' }>['cause'],
  source: Ref | null,
  move: string | null,
  meta: DamageMeta = PLAIN,
): number {
  const b = ctx.st.sides[target.side].party[target.slot]!;
  const dealt = Math.max(0, Math.min(b.creature.hp, Math.floor(amount)));
  b.creature.hp -= dealt;
  emit(ctx, {
    t: 'damage',
    target,
    amount: dealt,
    hpAfter: b.creature.hp,
    maxHp: b.maxHp,
    effectiveness: meta.effectiveness,
    crit: meta.crit,
    stab: meta.stab,
    cause,
    source,
    move,
  });
  return dealt;
}

/** Heals up to maxHp; emits `heal` with the actual amount (possibly 0). Returns the amount healed. */
export function healBattler(
  ctx: Ctx,
  target: Ref,
  amount: number,
  cause: Extract<BattleEvent, { t: 'heal' }>['cause'],
  item: string | null,
): number {
  const b = ctx.st.sides[target.side].party[target.slot]!;
  const healed = Math.max(0, Math.min(b.maxHp - b.creature.hp, Math.floor(amount)));
  b.creature.hp += healed;
  emit(ctx, { t: 'heal', target, amount: healed, hpAfter: b.creature.hp, cause, item });
  return healed;
}

/** floor(maxHp * fraction) via an exact ratio (0.3333 → /3, 0.125 → /8, 0.25 → /4). */
export function fractionOfMax(b: MBattler, fraction: number): number {
  return applyRatio(b.maxHp, ratioOf(fraction));
}

// ─── stat stages ────────────────────────────────────────────────────────────

/**
 * Changes one stage; clamps at ±6 (a fully clamped change emits delta 0 / clamped true). Honors
 * stageLowerImmunity and fires onStatLowered on a foe-caused lowering.
 */
export function changeStage(
  ctx: Ctx,
  target: Ref,
  stat: StatKey,
  delta: number,
  source: Ref | null,
  cause: 'move' | 'ability' | 'item',
): void {
  const b = ctx.st.sides[target.side].party[target.slot]!;
  const hooks = abilityHooks(b, ctx.content);
  if (delta < 0 && stageLowerImmune(hooks, stat)) {
    emit(ctx, { t: 'abilityTrigger', who: target, ability: b.creature.ability, detail: `${stat} cannot be lowered` });
    return;
  }
  const before = b.stages[stat];
  const after = clampStage(before + delta);
  const actual = after - before;
  b.stages[stat] = after;
  emit(ctx, {
    t: 'statStage',
    target,
    stat,
    delta: actual,
    after,
    clamped: actual !== delta,
    source,
    cause,
  });
  if (actual < 0 && source !== null && source.side !== target.side && isAlive(b)) {
    const reacts = hooksOfKind(hooks, 'onStatLowered');
    for (let i = 0; i < reacts.length; i++) {
      const h = reacts[i]!;
      emit(ctx, { t: 'abilityTrigger', who: target, ability: b.creature.ability, detail: 'onStatLowered' });
      changeStage(ctx, target, h.raise.stat, h.raise.stages, target, 'ability');
    }
  }
}

// ─── statuses ───────────────────────────────────────────────────────────────

const STATUS_TYPE_IMMUNITY: Readonly<Record<MajorStatus, readonly TypeName[]>> = {
  burn: ['Fire'],
  poison: ['Poison', 'Steel'],
  paralyze: ['Electric'],
  freeze: ['Ice'],
  sleep: [],
};

/**
 * Attempts to inflict a status (major or confusion) on the battler at `target`. Emits statusApplied
 * or statusBlocked. Returns true when applied. Sleep draws 1 + rng.int(3); confusion 2 + rng.int(3).
 */
export function tryApplyStatus(ctx: Ctx, target: Ref, status: StatusId, source: Ref | null): boolean {
  const b = ctx.st.sides[target.side].party[target.slot]!;
  if (!isAlive(b)) return false;
  if (status === 'confuse') {
    if (b.volatile.confusedTurns > 0) {
      emit(ctx, { t: 'statusBlocked', target, status, reason: 'alreadyStatused' });
      return false;
    }
    const hooks = abilityHooks(b, ctx.content);
    if (statusImmune(hooks, status)) {
      emit(ctx, { t: 'abilityTrigger', who: target, ability: b.creature.ability, detail: 'statusImmunity' });
      emit(ctx, { t: 'statusBlocked', target, status, reason: 'ability' });
      return false;
    }
    const turns = 2 + ctx.rng.int(3);
    b.volatile.confusedTurns = turns;
    b.creature.status = addStatus(b.creature.status, 'confuse');
    emit(ctx, { t: 'statusApplied', target, status, source, turns });
    return true;
  }
  const types = speciesOf(ctx, b).types;
  const immuneTypes = STATUS_TYPE_IMMUNITY[status];
  for (let i = 0; i < immuneTypes.length; i++) {
    if (types.indexOf(immuneTypes[i]!) !== -1) {
      emit(ctx, { t: 'statusBlocked', target, status, reason: 'type' });
      return false;
    }
  }
  const hooks = abilityHooks(b, ctx.content);
  if (statusImmune(hooks, status)) {
    emit(ctx, { t: 'abilityTrigger', who: target, ability: b.creature.ability, detail: 'statusImmunity' });
    emit(ctx, { t: 'statusBlocked', target, status, reason: 'ability' });
    return false;
  }
  if (majorStatus(b.creature.status) !== null) {
    emit(ctx, { t: 'statusBlocked', target, status, reason: 'alreadyStatused' });
    return false;
  }
  b.creature.status = addStatus(b.creature.status, status);
  let turns: number | null = null;
  if (status === 'sleep') {
    turns = 1 + ctx.rng.int(3);
    b.volatile.sleepTurns = turns;
  }
  emit(ctx, { t: 'statusApplied', target, status, source, turns });
  return true;
}

/** Removes a status (major or confusion) and emits statusCured. No-op when absent. */
export function cureStatus(
  ctx: Ctx,
  target: Ref,
  status: StatusId,
  cause: Extract<BattleEvent, { t: 'statusCured' }>['cause'],
): boolean {
  const b = ctx.st.sides[target.side].party[target.slot]!;
  if (status === 'confuse') {
    if (b.volatile.confusedTurns === 0 && !hasStatus(b.creature.status, 'confuse')) return false;
    b.volatile.confusedTurns = 0;
    b.creature.status = removeStatus(b.creature.status, 'confuse');
    emit(ctx, { t: 'statusCured', target, status, cause });
    return true;
  }
  if (!hasStatus(b.creature.status, status)) return false;
  b.creature.status = removeStatus(b.creature.status, status);
  if (status === 'sleep') b.volatile.sleepTurns = 0;
  emit(ctx, { t: 'statusCured', target, status, cause });
  return true;
}

/** Clears every major status (not confusion), emitting statusCured for each. */
export function cureAllMajor(
  ctx: Ctx,
  target: Ref,
  cause: Extract<BattleEvent, { t: 'statusCured' }>['cause'],
): void {
  const b = ctx.st.sides[target.side].party[target.slot]!;
  const st = b.creature.status;
  for (let i = 0; i < st.length; i++) {
    const s = st[i]!;
    if (isMajorStatus(s)) emit(ctx, { t: 'statusCured', target, status: s, cause });
  }
  b.creature.status = clearMajorStatus(st);
  b.volatile.sleepTurns = 0;
}

// ─── weather ────────────────────────────────────────────────────────────────

export function setWeather(ctx: Ctx, kind: WeatherKind, source: Ref | null): void {
  ctx.st.field.weather = { kind, turns: 5 };
  emit(ctx, { t: 'weatherSet', kind, turns: 5, source });
}

// ─── faint + exp ────────────────────────────────────────────────────────────

/** Recomputes the derived stats after a level change; keeps stages/volatile/participation. */
export function refreshDerived(ctx: Ctx, b: MBattler): void {
  const sp = speciesOf(ctx, b);
  b.maxHp = calcMaxHp(sp.baseHp, b.creature.level);
  b.atk = calcStat(sp.baseAtk, b.creature.level);
  b.def = calcStat(sp.baseDef, b.creature.level);
  b.spd = calcStat(sp.baseSpd, b.creature.level);
  if (b.creature.hp > b.maxHp) b.creature.hp = b.maxHp;
}

/**
 * Every participating, standing battler on the player side opposite the defeated battler gains exp for it (no split:
 * each gets the full gain — in doubles too, where both positions' battlers are participants).
 */
export function awardExp(ctx: Ctx, defeatedRef: Ref): void {
  const defeatedSide = defeatedRef.side;
  const loser = ctx.st.sides[defeatedSide];
  const defeated = loser.party[defeatedRef.slot]!;
  const winnerSide = other(defeatedSide);
  const winner = ctx.st.sides[winnerSide];
  if (winner.kind !== 'player') return;
  const gain = expGain(speciesOf(ctx, defeated), defeated.creature.level, loser.kind !== 'wild');
  if (gain <= 0) return;
  for (let slot = 0; slot < winner.party.length; slot++) {
    const b = winner.party[slot]!;
    if (!b.participated || !isAlive(b)) continue;
    const who = ref(winnerSide, slot);
    const oldExp = b.creature.exp;
    const res = applyExp(b.creature, gain, ctx.content);
    b.creature = { ...b.creature, level: res.creature.level, exp: res.creature.exp, hp: res.creature.hp };
    refreshDerived(ctx, b);
    emit(ctx, { t: 'expGain', who, amount: res.creature.exp - oldExp, expAfter: res.creature.exp });
    const sp = speciesOf(ctx, b);
    for (let i = 0; i < res.levelsGained.length; i++) {
      const lvl = res.levelsGained[i]!;
      emit(ctx, {
        t: 'levelUp',
        who,
        level: lvl,
        maxHp: calcMaxHp(sp.baseHp, lvl),
        atk: calcStat(sp.baseAtk, lvl),
        def: calcStat(sp.baseDef, lvl),
        spd: calcStat(sp.baseSpd, lvl),
      });
    }
    for (let i = 0; i < res.learnable.length; i++) {
      emit(ctx, { t: 'learnMove', who, move: res.learnable[i]!.move, level: res.learnable[i]!.level });
    }
    if (res.evolveReady !== null) emit(ctx, { t: 'evolveReady', who, into: res.evolveReady });
  }
}

/** Emits `faint` once per battler per turn when its hp is 0, then awards exp to the opposing player side. */
export function checkFaint(ctx: Ctx, target: Ref): boolean {
  const b = ctx.st.sides[target.side].party[target.slot]!;
  if (isAlive(b)) return false;
  const key = `${target.side}:${target.slot}`;
  if (ctx.fainted[key] === true) return true;
  ctx.fainted[key] = true;
  emit(ctx, { t: 'faint', who: target });
  if (onField(ctx.st.sides[target.side], target.slot)) awardExp(ctx, target);
  return true;
}

// ─── switching ──────────────────────────────────────────────────────────────

export function resetOnLeave(b: MBattler): void {
  b.stages = { ...ZERO_STAGES };
  b.volatile = { ...DEFAULT_VOLATILE };
  b.creature.status = removeStatus(b.creature.status, 'confuse');
}

/** onSwitchOut hooks for the current active of `side`, then volatile/stage reset. Clears the foe's trap. */
export function applySwitchOut(ctx: Ctx, side: 0 | 1, reason: 'action' | 'faint'): void {
  switchOutAt(ctx, activeRef(ctx, side), reason, null, [activeRef(ctx, other(side))]);
}

/**
 * The battler at `who` leaves the field: onSwitchOut hooks (action only), `switchOut` (with `pos` in doubles), reset,
 * and every trap on `foes` (the opposing battlers on the field) ends.
 */
export function switchOutAt(ctx: Ctx, who: Ref, reason: 'action' | 'faint', pos: 0 | 1 | null, foes: readonly Ref[]): void {
  const b = at(ctx, who);
  if (reason === 'action' && isAlive(b)) {
    const hooks = hooksOfKind(abilityHooks(b, ctx.content), 'onSwitchOut');
    for (let i = 0; i < hooks.length; i++) {
      const h = hooks[i]!;
      if (h.action === 'healFraction') {
        const amt = fractionOfMax(b, h.fraction ?? 0);
        if (b.creature.hp < b.maxHp && amt > 0) {
          emit(ctx, { t: 'abilityTrigger', who, ability: b.creature.ability, detail: 'onSwitchOut' });
          healBattler(ctx, who, amt, 'regenerator', null);
        }
      } else if (h.action === 'cureStatus' && majorStatus(b.creature.status) !== null) {
        emit(ctx, { t: 'abilityTrigger', who, ability: b.creature.ability, detail: 'onSwitchOut' });
        cureAllMajor(ctx, who, 'ability');
      }
    }
  }
  emit(ctx, pos === null ? { t: 'switchOut', who, reason } : { t: 'switchOut', who, reason, pos });
  resetOnLeave(b);
  // Trap is cleared when either side's active battler leaves the field (doubles: every foe on the field).
  for (let i = 0; i < foes.length; i++) {
    const foe = at(ctx, foes[i]!);
    if (foe.volatile.trappedTurns > 0) {
      foe.volatile.trappedTurns = 0;
      emit(ctx, { t: 'trapEnd', target: foes[i]! });
    }
  }
}

/** Sets `to` active, marks participation and emits switchIn. Does NOT fire hooks (see applySwitchIn). */
export function placeActive(ctx: Ctx, side: 0 | 1, to: number): void {
  const s = ctx.st.sides[side];
  const b = s.party[to];
  if (b === undefined) throw new RangeError(`placeActive: side ${side} has no party slot ${to}`);
  s.active = to;
  b.participated = true;
  emit(ctx, { t: 'switchIn', who: ref(side, to) });
}

/** placeActive + onSwitchIn hooks (Intimidate). */
export function applySwitchIn(ctx: Ctx, side: 0 | 1, to: number): void {
  placeActive(ctx, side, to);
  fireSwitchInHooks(ctx, side);
}

export function fireSwitchInHooks(ctx: Ctx, side: 0 | 1): void {
  fireSwitchInHooksAt(ctx, activeRef(ctx, side), [activeRef(ctx, other(side))]);
}

/** onSwitchIn hooks of the battler at `who` against `foes` (doubles: Intimidate lowers every standing foe). */
export function fireSwitchInHooksAt(ctx: Ctx, who: Ref, foes: readonly Ref[]): void {
  const b = at(ctx, who);
  const hooks = hooksOfKind(abilityHooks(b, ctx.content), 'onSwitchIn');
  for (let i = 0; i < hooks.length; i++) {
    const h = hooks[i]!;
    let any = false;
    for (let j = 0; j < foes.length; j++) if (isAlive(at(ctx, foes[j]!))) any = true;
    if (!any) continue;
    emit(ctx, { t: 'abilityTrigger', who, ability: b.creature.ability, detail: 'onSwitchIn' });
    for (let j = 0; j < foes.length; j++) {
      if (!isAlive(at(ctx, foes[j]!))) continue;
      changeStage(ctx, foes[j]!, h.lowerFoe.stat, -h.lowerFoe.stages, who, 'ability');
    }
  }
}

/** Phase D6: puts party index `to` on field position `pos` of a doubles side (`active` mirrors position 0). No hooks. */
export function placeAt(ctx: Ctx, side: 0 | 1, pos: 0 | 1, to: number): void {
  const s = ctx.st.sides[side];
  const b = s.party[to];
  if (b === undefined || s.actives === undefined) throw new RangeError(`placeAt: side ${side} has no party slot ${to} / is not doubles`);
  s.actives[pos] = to;
  if (pos === 0) s.active = to;
  b.participated = true;
  emit(ctx, { t: 'switchIn', who: ref(side, to), pos });
}

/** First party index with hp > 0 other than `except`, or -1. */
export function firstAlive(side: MSide, except: number): number {
  for (let i = 0; i < side.party.length; i++) {
    if (i !== except && isAlive(side.party[i]!)) return i;
  }
  return -1;
}

export function anyAlive(side: MSide): boolean {
  return firstAlive(side, -1) !== -1;
}
